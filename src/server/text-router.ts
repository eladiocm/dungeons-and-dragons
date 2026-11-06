import { GameError, isRecord } from '../lib/game-contract.ts';
import type { JsonGenerator } from './master.ts';

export interface CircuitStore {
  read(provider: string): Promise<number>;
  block(provider: string, until: number): Promise<void>;
}
interface Options {
  groqKey?: string;
  geminiKey?: string;
  fallback?: JsonGenerator;
  circuit?: CircuitStore;
  now?: () => number;
}
function jsonContent(raw: unknown): unknown {
  if (isRecord(raw)) return raw;
  if (typeof raw !== 'string' || raw.length > 12000) throw Error('format');
  const parsed: unknown = JSON.parse(
    raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
  );
  if (!isRecord(parsed)) throw Error('format');
  return parsed;
}
function retryTime(
  raw: string | null | undefined,
  now: number,
  minimum = 60000,
): number {
  const seconds = raw == null || !raw.trim() ? NaN : Number(raw);
  const date = raw ? Date.parse(raw) : NaN;
  // Do not shorten a server's pause. Unknown quotas get a minute before probing.
  return Math.max(
    now + minimum,
    Number.isFinite(seconds)
      ? now + seconds * 1000
      : Number.isFinite(date)
        ? date
        : 0,
  );
}
export function createTextRouter(
  options: Options,
  fetcher: typeof fetch = fetch,
): JsonGenerator {
  const local = new Map<string, number>();
  const circuit = options.circuit || {
    async read(key: string) {
      return local.get(key) || 0;
    },
    async block(key: string, until: number) {
      local.set(key, Math.max(until, local.get(key) || 0));
    },
  };
  const now = options.now || Date.now;
  return async (system, data, temperature = 0.3, validate) => {
    const accept = (raw: unknown) => {
      const parsed = jsonContent(raw);
      validate?.(parsed);
      return parsed;
    };
    const providers = [
      ...(options.groqKey?.trim() ? ['groq'] : []),
      ...(options.geminiKey?.trim() ? ['gemini'] : []),
      ...(options.fallback ? ['cloudflare'] : []),
    ];
    if (!providers.length)
      throw new GameError(
        'Configura al menos un proveedor gratuito del Master en el servidor.',
        503,
      );
    let unavailable = false;
    for (const provider of providers) {
      if ((await circuit.read(provider)) > now()) continue;
      if (provider === 'cloudflare') {
        try {
          return accept(await options.fallback?.(system, data, temperature));
        } catch (error) {
          const quota = error instanceof GameError && error.status === 429;
          unavailable ||= !quota;
          await circuit.block(
            provider,
            retryTime(
              error instanceof GameError ? error.retryAfter : undefined,
              now(),
              quota ? 60000 : 30000,
            ),
          );
          continue;
        }
      }
      let response: Response;
      try {
        const groq = provider === 'groq';
        response = await fetcher(
          groq
            ? 'https://api.groq.com/openai/v1/chat/completions'
            : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
          {
            method: 'POST',
            cache: 'no-store',
            redirect: 'error',
            headers: {
              'Content-Type': 'application/json',
              ...(groq
                ? { Authorization: `Bearer ${options.groqKey}` }
                : { 'x-goog-api-key': options.geminiKey || '' }),
            },
            body: JSON.stringify(
              groq
                ? {
                    model: 'openai/gpt-oss-120b',
                    messages: [
                      { role: 'system', content: system },
                      { role: 'user', content: JSON.stringify(data) },
                    ],
                    temperature,
                    max_completion_tokens: 1600,
                    reasoning_effort: 'low',
                    response_format: { type: 'json_object' },
                  }
                : {
                    systemInstruction: { parts: [{ text: system }] },
                    contents: [
                      { role: 'user', parts: [{ text: JSON.stringify(data) }] },
                    ],
                    generationConfig: {
                      temperature,
                      maxOutputTokens: 1600,
                      responseMimeType: 'application/json',
                    },
                  },
            ),
            signal: AbortSignal.timeout(20000),
          },
        );
      } catch {
        unavailable = true;
        await circuit.block(provider, now() + 30000);
        continue;
      }
      if (!response.ok) {
        unavailable ||= response.status !== 429;
        const until = retryTime(
          response.headers.get('Retry-After'),
          now(),
          response.status === 429
            ? 60000
            : [400, 401, 403, 404].includes(response.status)
              ? 600000
              : 30000,
        );
        await response.body?.cancel();
        await circuit.block(provider, until);
        continue;
      }
      try {
        const value = await response.json();
        const raw =
          provider === 'groq'
            ? value?.choices?.[0]?.message?.content
            : value?.candidates?.[0]?.content?.parts
                ?.filter(
                  (p: { thought?: boolean; text?: string }) => !p.thought,
                )
                .map((p: { text?: string }) => p.text || '')
                .join('');
        return accept(raw);
      } catch {
        unavailable = true;
        await circuit.block(provider, now() + 30000);
      }
    }
    throw new GameError(
      unavailable
        ? 'El Master no pudo responder con los proveedores disponibles. Tu partida se conserva; puedes reintentar.'
        : 'Los proveedores gratuitos están en pausa por cuota. Tu partida se conserva; espera y reintenta.',
      unavailable ? 503 : 429,
    );
  };
}
