import { resolve } from 'node:path';
import { GameService } from './game-service.ts';
import { readSaveKey, SaveCodec } from './save-codec.ts';
import { createSessionApi } from './session-api.ts';
import { SessionStore } from './session-store.ts';

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
    );
  }
  return service;
}
export const sessionApi = () => createSessionApi(gameService());
