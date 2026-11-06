import type { GameSession } from '../game/session-types.ts';
import { RuleError } from '../game/types.ts';
import type {
  SessionRepository,
  SessionSummary,
} from './session-repository.ts';
import type { StoredResult } from './session-store.ts';

interface Config {
  url: string;
  publishableKey: string;
  secret: string;
}
export class SupabaseStore implements SessionRepository {
  private readonly config: Config;
  private readonly fetcher: typeof fetch;
  constructor(config: Config, fetcher: typeof fetch = fetch) {
    const url = new URL(config.url);
    if (
      url.protocol !== 'https:' ||
      !config.publishableKey ||
      !/^[a-zA-Z0-9]{64}$/.test(config.secret)
    )
      throw new RuleError('El guardado remoto no está configurado.', 503);
    this.config = { ...config, url: url.origin };
    this.fetcher = fetcher;
  }
  async rpc<T>(
    op: string,
    args: Record<string, unknown>,
    endpoint = 'dnd_backend',
  ): Promise<T> {
    try {
      const response = await this.fetcher(
        `${this.config.url}/rest/v1/rpc/${endpoint}`,
        {
          method: 'POST',
          cache: 'no-store',
          headers: {
            apikey: this.config.publishableKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_secret: this.config.secret,
            p_op: op,
            p_args: args,
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok)
        throw new RuleError(
          'El guardado remoto no está disponible. Reintenta.',
          503,
        );
      const result = await response.json();
      if (result && typeof result === 'object' && 'error' in result) {
        const status = [400, 403, 404, 409, 413, 429, 500, 503].includes(
          result.status,
        )
          ? result.status
          : 503;
        throw new RuleError(
          typeof result.error === 'string'
            ? result.error
            : 'No se pudo completar el guardado.',
          status,
        );
      }
      return result as T;
    } catch (error) {
      if (error instanceof RuleError) throw error;
      throw new RuleError(
        'No se pudo conectar con el guardado remoto. Reintenta.',
        503,
      );
    }
  }
  read(owner: string, id: string): Promise<GameSession> {
    return this.rpc('read', { owner, id });
  }
  list(owner: string): Promise<SessionSummary[]> {
    return this.rpc('list', { owner });
  }
  async media(key: string): Promise<string | undefined> {
    return (
      (await this.rpc<{ data?: string }>('media', { key })).data || undefined
    );
  }
  async saveMedia(key: string, data: string): Promise<void> {
    await this.rpc('saveMedia', { key, data });
  }
  async claim(
    owner: string,
    id: string,
    key: string,
    hash: string,
  ): Promise<{ cached?: string }> {
    return this.rpc('claim', { owner, id, key, hash });
  }
  async finishJob(id: string, key: string, value: string): Promise<void> {
    await this.rpc('finishJob', { id, key, result: value });
  }
  async releaseJob(id: string, key: string): Promise<void> {
    await this.rpc('releaseJob', { id, key });
  }
  async replay(
    owner: string,
    id: string,
    commandId: string,
    hash: string,
  ): Promise<GameSession | undefined> {
    const result = await this.rpc<StoredResult>('prepare', {
      owner,
      id,
      commandId,
      hash,
    });
    return result.replayed ? result.state : undefined;
  }
  async create(
    owner: string,
    commandId: string,
    hash: string,
    make: () => GameSession,
  ): Promise<StoredResult> {
    const prior = await this.rpc<Partial<StoredResult>>('creation', {
      owner,
      commandId,
      hash,
    });
    if (prior.state) return prior as StoredResult;
    return this.rpc('create', { owner, commandId, hash, state: make() });
  }
  async transact(
    owner: string,
    id: string,
    expectedVersion: number,
    commandId: string,
    hash: string,
    change: (state: GameSession) => GameSession,
  ): Promise<StoredResult> {
    const before = await this.rpc<StoredResult>('prepare', {
      owner,
      id,
      commandId,
      hash,
    });
    if (before.replayed) return before;
    if (before.state.version !== expectedVersion)
      throw new RuleError(
        'La partida cambió. Actualiza el estado y revisa tu acción.',
        409,
      );
    return this.rpc('commit', {
      owner,
      id,
      expectedVersion,
      commandId,
      hash,
      state: change(before.state),
    });
  }
  async amendNarration(
    owner: string,
    id: string,
    messageId: string,
    content: string,
  ): Promise<GameSession> {
    for (let attempt = 0; attempt < 4; attempt++) {
      const state = await this.read(owner, id),
        expectedVersion = state.version;
      const amend = (s: GameSession): void => {
        const message = s.messages.find((m) => m.id === messageId);
        if (message) {
          message.content = content;
          message.narrationPending = false;
        }
        if (s.pending) {
          amend(s.pending.base);
          if (s.pending.preview) amend(s.pending.preview.state);
        }
      };
      amend(state);
      state.version++;
      try {
        return (
          await this.rpc<StoredResult>('amend', {
            owner,
            id,
            expectedVersion,
            state,
          })
        ).state;
      } catch (error) {
        if (
          !(error instanceof RuleError) ||
          error.status !== 409 ||
          attempt === 3
        )
          throw error;
      }
    }
    throw new RuleError('La partida cambió. Reintenta la narración.', 409);
  }
  async consumeAiBudget(limit = 100): Promise<void> {
    await this.rpc('quota', {
      bucket: `ai:${new Date().toISOString().slice(0, 10)}`,
      limit,
    });
  }
  async readAiCooldown(provider: string): Promise<number> {
    return (
      await this.rpc<{ until: number }>('get', { provider }, 'dnd_ai_state')
    ).until;
  }
  async blockAi(provider: string, until: number): Promise<void> {
    await this.rpc('block', { provider, until }, 'dnd_ai_state');
  }
}
