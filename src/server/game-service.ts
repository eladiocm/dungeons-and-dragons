import { createHash, randomInt, randomUUID } from 'node:crypto';
import { createCharacter } from '../game/character.ts';
import { publicSession, startSession, transition } from '../game/engine.ts';
import type { GameCommand } from '../game/session-types.ts';
import { type Roller, RuleError } from '../game/types.ts';
import type { SaveCodec } from './save-codec.ts';
import type { SessionStore } from './session-store.ts';

export const hashPayload = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class GameService {
  readonly store: SessionStore;
  private readonly roller: Roller;
  private readonly codec?: SaveCodec;
  constructor(
    store: SessionStore,
    roller: Roller = (sides) => randomInt(1, sides + 1),
    codec?: SaveCodec,
  ) {
    this.store = store;
    this.roller = roller;
    this.codec = codec;
  }
  list(owner: string) {
    return this.store.list(owner);
  }
  get(owner: string, id: string) {
    return publicSession(this.store.read(owner, id));
  }
  create(owner: string, creationId: string, draft: unknown) {
    if (
      typeof creationId !== 'string' ||
      !creationId.trim() ||
      creationId.length > 100
    )
      throw new RuleError('Identificador de creación inválido.');
    const result = this.store.create(
      owner,
      creationId,
      hashPayload(draft),
      () =>
        startSession(
          randomUUID(),
          randomUUID(),
          createCharacter(draft, randomUUID()),
        ),
    );
    return { session: publicSession(result.state), replayed: result.replayed };
  }
  execute(
    owner: string,
    id: string,
    expectedVersion: number,
    command: GameCommand,
  ) {
    if (command.type === 'propose' && command.plan.kind === 'creative')
      throw new RuleError(
        'Describe esa acción en el chat para que el Master la interprete.',
      );
    const result = this.store.transact(
      owner,
      id,
      expectedVersion,
      command.id,
      hashPayload({ expectedVersion, command }),
      (state) => transition(state, command, this.roller),
    );
    return { session: publicSession(result.state), replayed: result.replayed };
  }
  export(owner: string, id: string) {
    if (!this.codec)
      throw new RuleError('Las copias no están configuradas.', 503);
    return this.codec.seal(this.store.read(owner, id));
  }
  import(owner: string, creationId: string, save: unknown) {
    if (!this.codec)
      throw new RuleError('Las copias no están configuradas.', 503);
    const result = this.store.create(
      owner,
      creationId,
      hashPayload(save),
      () => {
        const state = this.codec?.open(save);
        if (!state) throw new RuleError('Copia no válida.');
        const oldId = state.id,
          newId = randomUUID();
        const remap = (session: typeof state): void => {
          session.id = newId;
          session.version = 0;
          for (const message of session.messages) {
            message.id = message.id.replace(`${oldId}:`, `${newId}:`);
            if (message.eventId)
              message.eventId = message.eventId.replace(
                `${oldId}:`,
                `${newId}:`,
              );
          }
          for (const event of session.events)
            event.id = event.id.replace(`${oldId}:`, `${newId}:`);
          if (session.pending) {
            session.pending.id = session.pending.id.replace(
              `${oldId}:`,
              `${newId}:`,
            );
            remap(session.pending.base);
            if (session.pending.preview) remap(session.pending.preview.state);
          }
        };
        remap(state);
        return state;
      },
    );
    return { session: publicSession(result.state), replayed: result.replayed };
  }
}
