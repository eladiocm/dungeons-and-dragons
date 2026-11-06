import { RuleError } from '../game/types.ts';
import type { GeneratedImage } from '../lib/game-contract.ts';
import {
  type SpeechRequest,
  splitSpeechText,
  VOICES,
} from '../lib/speech-contract.ts';
import type { GameService } from './game-service.ts';
import { hashPayload } from './game-service.ts';
import { apiFailure, apiResponse, jsonBody, owner } from './session-api.ts';
import { validateRecording } from './transcription.ts';

interface MediaProviders {
  image(prompt: string, signal?: AbortSignal): Promise<GeneratedImage>;
  speech(input: SpeechRequest, signal?: AbortSignal): Promise<Uint8Array>;
  transcribe(audio: string, signal?: AbortSignal): Promise<string>;
}
function fields(raw: unknown, keys: string[]): Record<string, unknown> {
  if (
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    Object.keys(raw).some((k) => !keys.includes(k))
  )
    throw new RuleError('Solicitud de medios inválida.');
  return raw as Record<string, unknown>;
}
export function createMediaApi(
  service: GameService,
  providers: MediaProviders,
) {
  return {
    async image(request: Request, id: string) {
      try {
        const raw = fields(await jsonBody(request), ['sceneRevision']),
          identity = owner(request),
          state = await service.get(identity.hash, id);
        if (raw.sceneRevision !== state.world.sceneRevision)
          throw new RuleError(
            'La escena cambió. Actualiza antes de ilustrarla.',
            409,
          );
        const key = hashPayload({
            session: id,
            revision: raw.sceneRevision,
            prompt: state.scene.imagePrompt,
          }),
          cached = await service.store.media(key);
        if (cached) return apiResponse({ image: JSON.parse(cached) });
        const job = `image:${key}`;
        await service.store.claim(identity.hash, id, job, key);
        try {
          const image = await providers.image(
            state.scene.imagePrompt,
            request.signal,
          );
          await service.store.saveMedia(key, JSON.stringify(image));
          // The bounded media cache owns the result; an evicted image may be generated again.
          await service.store.releaseJob(id, job);
          return apiResponse({ image });
        } catch (error) {
          await service.store.releaseJob(id, job);
          throw error;
        }
      } catch (error) {
        return apiFailure(error);
      }
    },
    async speech(request: Request, id: string) {
      try {
        const raw = fields(await jsonBody(request), [
            'messageId',
            'chunkIndex',
            'speaker',
          ]),
          state = await service.get(owner(request).hash, id),
          message = state.messages.find(
            (m) => m.id === raw.messageId && m.role === 'assistant',
          );
        if (!message)
          throw new RuleError('No se encontró esa intervención.', 404);
        if (
          !Number.isInteger(raw.chunkIndex) ||
          (raw.chunkIndex as number) < 0 ||
          !VOICES.some((v) => v.id === raw.speaker)
        )
          throw new RuleError('Voz o segmento inválidos.');
        const text = splitSpeechText(message.content)[raw.chunkIndex as number];
        if (!text) throw new RuleError('No existe ese segmento de voz.');
        const key = hashPayload({
          kind: 'speech',
          session: id,
          messageId: message.id,
          text,
          speaker: raw.speaker,
        });
        const cached = await service.store.media(key);
        const respond = (audio: Uint8Array) =>
          new Response(new Uint8Array(audio).buffer, {
            headers: {
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'private, no-store',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        if (cached)
          return respond(Buffer.from(JSON.parse(cached).audio, 'base64'));
        const job = `speech:${key}`;
        await service.store.claim(owner(request).hash, id, job, key);
        try {
          const audio = await providers.speech(
            { text, speaker: raw.speaker as SpeechRequest['speaker'] },
            request.signal,
          );
          await service.store.saveMedia(
            key,
            JSON.stringify({ audio: Buffer.from(audio).toString('base64') }),
          );
          await service.store.releaseJob(id, job);
          return respond(audio);
        } catch (error) {
          await service.store.releaseJob(id, job);
          throw error;
        }
      } catch (error) {
        return apiFailure(error);
      }
    },
    async transcribe(request: Request, id: string) {
      try {
        const raw = fields(await jsonBody(request, 1920300), ['audio']);
        await service.get(owner(request).hash, id);
        return apiResponse({
          text: await providers.transcribe(
            validateRecording(raw.audio),
            request.signal,
          ),
        });
      } catch (error) {
        return apiFailure(error);
      }
    },
  };
}
