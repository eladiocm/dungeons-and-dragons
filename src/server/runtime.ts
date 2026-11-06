import { resolve } from 'node:path';
import { createProvider } from '../lib/ai-provider.ts';
import { speechService } from '../lib/voice-provider.ts';
import { GameService } from './game-service.ts';
import { createMaster } from './master.ts';
import { createMediaApi } from './media-api.ts';
import { storageConfig } from './runtime-config.ts';
import { readSaveKey, SaveCodec } from './save-codec.ts';
import { createSessionApi } from './session-api.ts';
import type { SessionRepository } from './session-repository.ts';
import { SessionStore } from './session-store.ts';
import { SupabaseStore } from './supabase-store.ts';
import { createTranscriber } from './transcription.ts';

let service: GameService | undefined,
  cloud: SupabaseStore | undefined,
  dailyLimit = 100;
async function infer<T>(work: () => Promise<T>): Promise<T> {
  if (cloud) await cloud.consumeAiBudget(dailyLimit);
  return work();
}
export function gameService(): GameService {
  if (!service) {
    const config = storageConfig();
    let store: SessionRepository, key: Uint8Array;
    if (config.kind === 'supabase') {
      cloud = new SupabaseStore(config);
      store = cloud;
      key = config.saveKey;
      dailyLimit = config.dailyLimit;
    } else {
      const directory = resolve(/* turbopackIgnore: true */ config.directory);
      store = new SessionStore(resolve(directory, 'game.sqlite'));
      key = readSaveKey(resolve(directory, 'save-key'));
    }
    service = new GameService(
      store,
      undefined,
      new SaveCodec(key),
      createMaster((system, data, temperature) =>
        infer(() => createProvider().json(system, data, temperature)),
      ),
    );
  }
  return service;
}
export const sessionApi = () => createSessionApi(gameService());
export const mediaApi = () =>
  createMediaApi(gameService(), {
    image: (prompt, signal) =>
      infer(() => createProvider().image(prompt, signal)),
    speech: (input, signal) =>
      infer(() => speechService().synthesize(input, signal)),
    transcribe: (audio, signal) =>
      infer(() =>
        createTranscriber({
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
          token: process.env.CLOUDFLARE_API_TOKEN,
        })(audio, signal),
      ),
  });
