import { resolve } from 'node:path';
import { createProvider } from '../lib/ai-provider.ts';
import { speechService } from '../lib/voice-provider.ts';
import { GameService } from './game-service.ts';
import { createMaster } from './master.ts';
import { createMediaApi } from './media-api.ts';
import { readSaveKey, SaveCodec } from './save-codec.ts';
import { createSessionApi } from './session-api.ts';
import { SessionStore } from './session-store.ts';
import { createTranscriber } from './transcription.ts';

let service: GameService | undefined;
export function gameService(): GameService {
  if (!service) {
    // Runtime data is provisioned on a persistent volume, never bundled by Next.
    const directory = resolve(
      /* turbopackIgnore: true */ process.env.GAME_DATA_DIR || '.data',
    );
    service = new GameService(
      new SessionStore(resolve(directory, 'game.sqlite')),
      undefined,
      new SaveCodec(readSaveKey(resolve(directory, 'save-key'))),
      createMaster((system, data, temperature) =>
        createProvider().json(system, data, temperature),
      ),
    );
  }
  return service;
}
export const sessionApi = () => createSessionApi(gameService());
export const mediaApi = () =>
  createMediaApi(gameService(), {
    image: (prompt, signal) => createProvider().image(prompt, signal),
    speech: (input, signal) => speechService().synthesize(input, signal),
    transcribe: createTranscriber({
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
    }),
  });
