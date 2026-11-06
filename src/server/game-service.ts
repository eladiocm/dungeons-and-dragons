import { createHash, randomInt, randomUUID } from 'node:crypto';
import { createCharacter } from '../game/character.ts';
import { publicSession, startSession, transition } from '../game/engine.ts';
import type { GameCommand } from '../game/session-types.ts';
import { getHero } from '../game/session-utils.ts';
import { type Roller, RuleError } from '../game/types.ts';
import type { Master } from './master.ts';
import type { SaveCodec } from './save-codec.ts';
import type { SessionRepository } from './session-repository.ts';

export const hashPayload = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class GameService {
  readonly store: SessionRepository;
  private readonly roller: Roller;
  private readonly codec?: SaveCodec;
  private readonly master?: Master;
  constructor(
    store: SessionRepository,
    roller: Roller = (sides) => randomInt(1, sides + 1),
    codec?: SaveCodec,
    master?: Master,
  ) {
    this.store = store;
    this.roller = roller;
    this.codec = codec;
    this.master = master;
  }
  async list(owner: string) {
    return await this.store.list(owner);
  }
  async get(owner: string, id: string) {
    return publicSession(await this.store.read(owner, id));
  }
  async create(owner: string, creationId: string, draft: unknown) {
    if (
      typeof creationId !== 'string' ||
      !creationId.trim() ||
      creationId.length > 100
    )
      throw new RuleError('Identificador de creación inválido.');
    const result = await this.store.create(
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
  async execute(
    owner: string,
    id: string,
    expectedVersion: number,
    command: GameCommand,
  ) {
    if (command.type === 'propose' && command.plan.kind === 'creative')
      throw new RuleError(
        'Describe esa acción en el chat para que el Master la interprete.',
      );
    const result = await this.store.transact(
      owner,
      id,
      expectedVersion,
      command.id,
      hashPayload({ expectedVersion, command }),
      (state) => transition(state, command, this.roller),
    );
    return { session: publicSession(result.state), replayed: result.replayed };
  }
  async export(owner: string, id: string) {
    if (!this.codec)
      throw new RuleError('Las copias no están configuradas.', 503);
    return this.codec.seal(await this.store.read(owner, id));
  }
  async intent(
    owner: string,
    id: string,
    expectedVersion: number,
    input: { id: string; actorId: string; text: string },
  ) {
    const hash = hashPayload({ expectedVersion, input }),
      replay = await this.store.replay(owner, id, input.id, hash);
    if (replay) return { session: publicSession(replay), replayed: true };
    const state = await this.store.read(owner, id);
    getHero(state, input.actorId);
    if (state.version !== expectedVersion)
      throw new RuleError(
        'La partida cambió. Actualiza y revisa tu acción.',
        409,
      );
    if (state.pending || state.status === 'ended')
      throw new RuleError(
        'Resuelve primero la acción pendiente o crea otra aventura.',
      );
    if (!this.master)
      throw new RuleError('El Master no está configurado.', 503);
    const key = `intent:${input.id}`,
      job = await this.store.claim(owner, id, key, hash);
    if (job.cached)
      return {
        session: await this.get(owner, id),
        replayed: true,
        clarification: JSON.parse(job.cached).clarification as
          | string
          | undefined,
      };
    try {
      const proposal = await this.master.interpret(
        state,
        input.actorId,
        input.text,
      );
      if (proposal.kind === 'clarify') {
        await this.store.finishJob(
          id,
          key,
          JSON.stringify({ clarification: proposal.question }),
        );
        return {
          session: await this.get(owner, id),
          replayed: false,
          clarification: proposal.question,
        };
      }
      const result = await this.store.transact(
        owner,
        id,
        expectedVersion,
        input.id,
        hash,
        (s) =>
          transition(
            s,
            { ...input, type: 'propose', plan: proposal.plan },
            this.roller,
          ),
      );
      await this.store.finishJob(id, key, '{}');
      return {
        session: publicSession(result.state),
        replayed: result.replayed,
      };
    } catch (error) {
      await this.store.releaseJob(id, key);
      throw error;
    }
  }
  async narrate(
    owner: string,
    id: string,
    messageId: string,
  ): Promise<{ session: ReturnType<typeof publicSession>; warning?: string }> {
    const state = await this.store.read(owner, id),
      message = state.messages.find(
        (m) => m.id === messageId && m.role === 'assistant',
      );
    if (!message) throw new RuleError('No se encontró esa intervención.', 404);
    if (!message.narrationPending) return { session: publicSession(state) };
    if (!this.master)
      return {
        session: publicSession(state),
        warning:
          'La narración está pendiente. Los resultados ya están guardados.',
      };
    const key = `narration:${messageId}`;
    const job = await this.store.claim(owner, id, key, hashPayload(messageId));
    if (job.cached) return { session: await this.get(owner, id) };
    try {
      const latest = await this.store.read(owner, id),
        latestMessage = latest.messages.find((m) => m.id === messageId);
      if (!latestMessage?.narrationPending) {
        await this.store.finishJob(id, key, '{}');
        return { session: publicSession(latest) };
      }
      const content = await this.master.narrate(latest, latestMessage),
        next = await this.store.amendNarration(owner, id, messageId, content);
      await this.store.finishJob(id, key, '{}');
      return { session: publicSession(next) };
    } catch {
      await this.store.releaseJob(id, key);
      return {
        session: await this.get(owner, id),
        warning:
          'No se pudo ampliar la narración. Los hechos y resultados se han conservado; puedes reintentar.',
      };
    }
  }
  async import(owner: string, creationId: string, save: unknown) {
    if (!this.codec)
      throw new RuleError('Las copias no están configuradas.', 503);
    const result = await this.store.create(
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
