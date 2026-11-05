import { createHash } from 'node:crypto';
import { GameError } from './game-contract.ts';
import {
  type SpeechRequest,
  validateSpeechRequest,
} from './speech-contract.ts';

interface VoiceConfig {
  accountId?: string;
  token?: string;
  enabled?: boolean;
}
export function createSpeechService(
  config: VoiceConfig,
  fetcher: typeof fetch = fetch,
) {
  const cache = new Map<string, { audio: Uint8Array; expires: number }>();
  let cachedBytes = 0;
  return {
    async synthesize(
      input: SpeechRequest,
      signal?: AbortSignal,
    ): Promise<Uint8Array> {
      const { text, speaker } = validateSpeechRequest(input);
      if (config.enabled === false)
        throw new GameError(
          'La voz natural está desactivada. Puedes usar la voz del dispositivo.',
          409,
        );
      if (!/^[a-f\d]{32}$/i.test(config.accountId || '') || !config.token)
        throw new GameError(
          'La voz natural no está configurada. Puedes elegir la voz del dispositivo.',
          503,
        );
      const key = createHash('sha256')
        .update(`${speaker}\n${text}`)
        .digest('hex');
      const now = Date.now();
      for (const [id, item] of cache)
        if (item.expires <= now) {
          cachedBytes -= item.audio.byteLength;
          cache.delete(id);
        }
      const hit = cache.get(key);
      if (hit) return hit.audio;
      try {
        const response = await fetcher(
          `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/@cf/deepgram/aura-2-es`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.token}`,
            },
            body: JSON.stringify({ text, speaker, encoding: 'mp3' }),
            cache: 'no-store',
            signal: AbortSignal.any([
              AbortSignal.timeout(60000),
              ...(signal ? [signal] : []),
            ]),
          },
        );
        if (!response.ok) {
          if (response.status === 429)
            throw new GameError(
              'Se alcanzó la cuota o el límite de voz. Espera o elige la voz del dispositivo.',
              429,
            );
          throw new GameError(
            'No se pudo generar la voz natural. Reintenta o elige la voz del dispositivo.',
            502,
          );
        }
        if (
          !response.headers
            .get('content-type')
            ?.match(/audio\/|application\/octet-stream/i)
        )
          throw new GameError(
            'El narrador no devolvió audio válido. Puedes reintentar.',
            502,
          );
        const reader = response.body?.getReader();
        if (!reader) throw new GameError('El audio llegó vacío.', 502);
        const parts: Uint8Array[] = [];
        let length = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.length;
            if (length > 5000000) {
              await reader.cancel();
              throw new GameError(
                'El audio generado supera el tamaño permitido.',
                502,
              );
            }
            parts.push(value);
          }
        } finally {
          reader.releaseLock();
        }
        if (!length)
          throw new GameError('El audio llegó vacío. Puedes reintentar.', 502);
        const audio = new Uint8Array(length);
        let offset = 0;
        for (const part of parts) {
          audio.set(part, offset);
          offset += part.length;
        }
        while (cache.size >= 16 || cachedBytes + length > 16000000) {
          const oldest = cache.entries().next().value;
          if (!oldest) break;
          cachedBytes -= oldest[1].audio.byteLength;
          cache.delete(oldest[0]);
        }
        cache.set(key, { audio, expires: now + 30 * 60000 });
        cachedBytes += length;
        return audio;
      } catch (error) {
        if (error instanceof GameError) throw error;
        throw new GameError(
          'La voz no pudo completarse. Comprueba la conexión o usa la voz del dispositivo.',
          503,
        );
      }
    },
  };
}
let service: ReturnType<typeof createSpeechService> | undefined;
export function speechService() {
  service ??= createSpeechService({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    token: process.env.CLOUDFLARE_API_TOKEN,
    enabled: process.env.ENABLE_VOICE !== 'false',
  });
  return service;
}
