import { createHash, randomBytes } from 'node:crypto';
import { validatePlan } from '../game/plan-contract.ts';
import type { GameCommand } from '../game/session-types.ts';
import { RuleError } from '../game/types.ts';
import type { GameService } from './game-service.ts';

const COOKIE = 'dnd_owner';
function record(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}
function exact(v: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(v).some((k) => !keys.includes(k)))
    throw new RuleError('La solicitud contiene campos no permitidos.');
}
function id(v: unknown, max = 100): string {
  if (
    typeof v !== 'string' ||
    !v.trim() ||
    v.length > max ||
    !/^[\w:-]+$/u.test(v)
  )
    throw new RuleError('Identificador inválido.');
  return v;
}
export function requestOrigin(request: Request): string {
  const internal = new URL(request.url),
    host = request.headers.get('host') || internal.host,
    forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  const protocol =
    forwarded === 'https' || forwarded === 'http'
      ? `${forwarded}:`
      : internal.protocol;
  let origin: URL;
  try {
    origin = new URL(`${protocol}//${host}`);
  } catch {
    throw new RuleError('Dirección de aplicación inválida.', 403);
  }
  const configured = process.env.APP_ORIGIN?.trim();
  if (configured) {
    let expected: string;
    try {
      expected = new URL(configured).origin;
    } catch {
      throw new RuleError('APP_ORIGIN no es una URL válida.', 503);
    }
    if (origin.origin !== expected)
      throw new RuleError('Dirección de aplicación no permitida.', 403);
  } else if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))
    throw new RuleError(
      'Configura APP_ORIGIN para utilizar esta dirección.',
      403,
    );
  const incoming = request.headers.get('origin');
  if (incoming && incoming !== origin.origin)
    throw new RuleError('Origen de solicitud no permitido.', 403);
  if (
    ['cross-site', 'same-site'].includes(
      request.headers.get('sec-fetch-site') || '',
    )
  )
    throw new RuleError('Solicitud desde otra página no permitida.', 403);
  return origin.origin;
}
export function owner(
  request: Request,
  create = false,
): { hash: string; cookie?: string } {
  const value = request.headers
    .get('cookie')
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  let token = value && /^[\w-]{43}$/.test(value) ? value : undefined;
  const fresh = !token;
  if (!token && !create)
    throw new RuleError('No se encontró esa partida privada.', 404);
  token ||= randomBytes(32).toString('base64url');
  const secure = requestOrigin(request).startsWith('https:');
  return {
    hash: createHash('sha256').update(token).digest('hex'),
    ...(fresh
      ? {
          cookie: `${COOKIE}=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`,
        }
      : {}),
  };
}
const windows = new Map<string, { count: number; until: number }>();
export function throttle(request: Request): void {
  const now = Date.now(),
    key =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  for (const [k, v] of windows) if (v.until <= now) windows.delete(k);
  const current = windows.get(key) || { count: 0, until: now + 60000 };
  if (current.count >= 120 || windows.size >= 2000)
    throw new RuleError('Demasiadas solicitudes; espera un minuto.', 429);
  current.count++;
  windows.set(key, current);
}
export async function jsonBody(
  request: Request,
  limit = 65536,
): Promise<unknown> {
  requestOrigin(request);
  throttle(request);
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
    'application/json'
  )
    throw new RuleError('Envía un cuerpo JSON.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new RuleError('Falta el cuerpo de la solicitud.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new RuleError('La solicitud supera el tamaño permitido.', 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof RuleError) throw error;
    throw new RuleError('El cuerpo JSON no es válido.');
  } finally {
    reader.releaseLock();
  }
}
export function apiResponse(
  value: unknown,
  status = 200,
  cookie?: string,
): Response {
  return Response.json(value, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(cookie ? { 'Set-Cookie': cookie } : {}),
    },
  });
}
export function apiFailure(error: unknown): Response {
  return apiResponse(
    {
      error:
        error instanceof RuleError
          ? error.message
          : 'No se pudo completar la operación. Reintenta.',
    },
    error instanceof RuleError ? error.status : 500,
  );
}
function commandBody(raw: unknown): {
  expectedVersion: number;
  command: GameCommand;
} {
  if (!record(raw)) throw new RuleError('Comando inválido.');
  exact(raw, ['expectedVersion', 'command']);
  if (
    !Number.isInteger(raw.expectedVersion) ||
    (raw.expectedVersion as number) < 0 ||
    !record(raw.command)
  )
    throw new RuleError('Versión o comando inválidos.');
  const v = raw.command,
    base = { id: id(v.id), actorId: id(v.actorId) };
  let command: GameCommand;
  switch (v.type) {
    case 'propose':
      exact(v, ['type', 'id', 'actorId', 'text', 'plan']);
      if (typeof v.text !== 'string' || !v.text.trim() || v.text.length > 2000)
        throw new RuleError('Escribe tu acción.');
      command = {
        ...base,
        type: 'propose',
        text: v.text,
        plan: validatePlan(v.plan),
      };
      break;
    case 'roll':
    case 'accept':
    case 'cancel':
      exact(v, ['type', 'id', 'actorId', 'pendingId']);
      command = { ...base, type: v.type, pendingId: id(v.pendingId, 250) };
      break;
    case 'reroll':
      exact(v, ['type', 'id', 'actorId', 'pendingId', 'dieIndex', 'source']);
      if (
        !Number.isInteger(v.dieIndex) ||
        (v.dieIndex as number) < 0 ||
        !['inspiration', 'lucky'].includes(v.source as string)
      )
        throw new RuleError('Repetición de dado inválida.');
      command = {
        ...base,
        type: 'reroll',
        pendingId: id(v.pendingId, 250),
        dieIndex: v.dieIndex as number,
        source: v.source as 'inspiration' | 'lucky',
      };
      break;
    case 'sync':
      exact(v, ['type', 'id', 'actorId']);
      command = { ...base, type: 'sync' };
      break;
    default:
      throw new RuleError('Comando no reconocido.');
  }
  return { expectedVersion: raw.expectedVersion as number, command };
}
export function createSessionApi(service: GameService) {
  return {
    async list(request: Request) {
      try {
        requestOrigin(request);
        const identity = owner(request, true);
        return apiResponse(
          { sessions: service.list(identity.hash) },
          200,
          identity.cookie,
        );
      } catch (error) {
        return apiFailure(error);
      }
    },
    async create(request: Request) {
      try {
        const raw = await jsonBody(request);
        if (!record(raw))
          throw new RuleError('Solicitud de creación inválida.');
        exact(raw, ['id', 'character']);
        const identity = owner(request, true),
          result = service.create(identity.hash, id(raw.id), raw.character);
        return apiResponse(
          result,
          result.replayed ? 200 : 201,
          identity.cookie,
        );
      } catch (error) {
        return apiFailure(error);
      }
    },
    async get(request: Request, sessionId: string) {
      try {
        requestOrigin(request);
        return apiResponse({
          session: service.get(owner(request).hash, id(sessionId)),
        });
      } catch (error) {
        return apiFailure(error);
      }
    },
    async export(request: Request, sessionId: string) {
      try {
        requestOrigin(request);
        return apiResponse(service.export(owner(request).hash, id(sessionId)));
      } catch (error) {
        return apiFailure(error);
      }
    },
    async import(request: Request) {
      try {
        const raw = await jsonBody(request, 11001000);
        if (!record(raw)) throw new RuleError('Copia inválida.');
        exact(raw, ['id', 'save']);
        const identity = owner(request, true),
          result = service.import(identity.hash, id(raw.id), raw.save);
        return apiResponse(
          result,
          result.replayed ? 200 : 201,
          identity.cookie,
        );
      } catch (error) {
        return apiFailure(error);
      }
    },
    async command(request: Request, sessionId: string) {
      try {
        const raw = commandBody(await jsonBody(request));
        return apiResponse(
          service.execute(
            owner(request).hash,
            id(sessionId),
            raw.expectedVersion,
            raw.command,
          ),
        );
      } catch (error) {
        return apiFailure(error);
      }
    },
  };
}
