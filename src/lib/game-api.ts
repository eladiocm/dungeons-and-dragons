import { createProvider } from './ai-provider.ts';
import {
  GameError,
  validateImagePrompt,
  validateStoryRequest,
} from './game-contract.ts';
import { validateSpeechRequest } from './speech-contract.ts';
import { speechService } from './voice-provider.ts';

const requests = new Map<string, { count: number; reset: number }>();
async function body(request: Request): Promise<unknown> {
  const origin = request.headers.get('origin');
  if (origin) {
    const internalUrl = new URL(request.url);
    // Next may use localhost internally even when the browser uses 127.0.0.1.
    // Host is the actual request authority; forwarded-host is deliberately ignored.
    const host = request.headers.get('host') || internalUrl.host;
    const forwardedProtocol = request.headers
      .get('x-forwarded-proto')
      ?.split(',')[0]
      .trim();
    const protocol =
      forwardedProtocol === 'https' || forwardedProtocol === 'http'
        ? `${forwardedProtocol}:`
        : internalUrl.protocol;
    let matches = false;
    try {
      matches =
        new URL(origin).origin === new URL(`${protocol}//${host}`).origin;
    } catch {
      /* Invalid origins are rejected. */
    }
    if (!matches) throw new GameError('Origen de solicitud no permitido.', 403);
  }
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  )
    throw new GameError('Envía un cuerpo JSON.', 415);
  const key =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const now = Date.now();
  for (const [id, item] of requests) if (item.reset <= now) requests.delete(id);
  const current = requests.get(key) || { count: 0, reset: now + 60000 };
  if (current.count >= 30 || requests.size >= 2000)
    throw new GameError(
      'Demasiadas peticiones. Espera un minuto y reintenta.',
      429,
    );
  current.count++;
  requests.set(key, current);
  const reader = request.body?.getReader();
  if (!reader) throw new GameError('Falta el cuerpo de la solicitud.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw new GameError('La solicitud supera el tamaño permitido.', 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof GameError) throw error;
    throw new GameError('El cuerpo JSON no es válido.');
  } finally {
    reader.releaseLock();
  }
}
function failure(error: unknown): Response {
  const known = error instanceof GameError;
  return Response.json(
    {
      error: known
        ? error.message
        : 'No se pudo generar la escena. Puedes reintentar.',
    },
    {
      status: known ? error.status : 500,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
export async function handleStory(request: Request): Promise<Response> {
  try {
    const input = validateStoryRequest(await body(request));
    return Response.json(await createProvider().story(input, request.signal), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function handleImage(request: Request): Promise<Response> {
  try {
    const prompt = validateImagePrompt(await body(request));
    return Response.json(
      { image: await createProvider().image(prompt, request.signal) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function handleSpeech(request: Request): Promise<Response> {
  try {
    const input = validateSpeechRequest(await body(request));
    const audio = await speechService().synthesize(input, request.signal);
    return new Response(new Uint8Array(audio).buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return failure(error);
  }
}
