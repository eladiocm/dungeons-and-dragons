import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { GameSession } from '../game/session-types.ts';
import { RuleError } from '../game/types.ts';

export interface StoredResult {
  state: GameSession;
  replayed: boolean;
}
function decode(raw: unknown): GameSession {
  if (typeof raw !== 'string')
    throw new RuleError('Guardado no disponible.', 503);
  try {
    const state = JSON.parse(raw) as GameSession;
    if (
      state.schemaVersion !== 2 ||
      state.rulesetVersion !== 'SRD-5.2.1' ||
      !Number.isInteger(state.version) ||
      !state.participants?.length ||
      !state.world ||
      !state.battle
    )
      throw new Error();
    return state;
  } catch {
    throw new RuleError('El guardado está dañado o utiliza otra versión.', 503);
  }
}
function encode(state: GameSession): string {
  const raw = JSON.stringify(state);
  if (Buffer.byteLength(raw) > 8000000)
    throw new RuleError(
      'La partida supera el tamaño de guardado permitido.',
      413,
    );
  return raw;
}
export class SessionStore {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path, { timeout: 5000 });
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,owner_hash TEXT NOT NULL,version INTEGER NOT NULL,state TEXT NOT NULL,updated_at INTEGER NOT NULL) STRICT;
      CREATE INDEX IF NOT EXISTS sessions_owner ON sessions(owner_hash,updated_at);
      CREATE TABLE IF NOT EXISTS creations(owner_hash TEXT NOT NULL,command_id TEXT NOT NULL,request_hash TEXT NOT NULL,session_id TEXT NOT NULL REFERENCES sessions(id),PRIMARY KEY(owner_hash,command_id)) STRICT;
      CREATE TABLE IF NOT EXISTS commands(session_id TEXT NOT NULL REFERENCES sessions(id),command_id TEXT NOT NULL,request_hash TEXT NOT NULL,result_version INTEGER NOT NULL,PRIMARY KEY(session_id,command_id)) STRICT;
      CREATE TABLE IF NOT EXISTS jobs(session_id TEXT NOT NULL REFERENCES sessions(id),job_key TEXT NOT NULL,request_hash TEXT NOT NULL,lease_until INTEGER NOT NULL,result TEXT,PRIMARY KEY(session_id,job_key)) STRICT;
      CREATE TABLE IF NOT EXISTS media(cache_key TEXT PRIMARY KEY,data TEXT NOT NULL,created_at INTEGER NOT NULL) STRICT;
    `);
  }
  close(): void {
    this.db.close();
  }
  media(key: string): string | undefined {
    const row = this.db
      .prepare('SELECT data FROM media WHERE cache_key=?')
      .get(key);
    return typeof row?.data === 'string' ? row.data : undefined;
  }
  saveMedia(key: string, data: string): void {
    if (data.length > 10001000)
      throw new RuleError('Medio demasiado grande.', 413);
    this.db
      .prepare(
        'INSERT OR REPLACE INTO media(cache_key,data,created_at) VALUES(?,?,?)',
      )
      .run(key, data, Date.now());
    this.db
      .prepare(
        'DELETE FROM media WHERE cache_key NOT IN (SELECT cache_key FROM media ORDER BY created_at DESC LIMIT 24)',
      )
      .run();
  }
  replay(
    owner: string,
    id: string,
    commandId: string,
    hash: string,
  ): GameSession | undefined {
    const current = this.read(owner, id),
      row = this.db
        .prepare(
          'SELECT request_hash FROM commands WHERE session_id=? AND command_id=?',
        )
        .get(id, commandId);
    if (!row) return undefined;
    if (row.request_hash !== hash)
      throw new RuleError('Ese comando ya se usó con otros datos.', 409);
    return current;
  }
  claim(
    owner: string,
    id: string,
    key: string,
    hash: string,
  ): { cached?: string } {
    return this.transaction(() => {
      this.read(owner, id);
      const row = this.db
        .prepare('SELECT * FROM jobs WHERE session_id=? AND job_key=?')
        .get(id, key);
      if (row) {
        if (row.request_hash !== hash)
          throw new RuleError(
            'Ese identificador ya se usó con otros datos.',
            409,
          );
        if (typeof row.result === 'string') return { cached: row.result };
        if (Number(row.lease_until) > Date.now())
          throw new RuleError(
            'El Master ya está preparando esa respuesta. Espera y reintenta.',
            409,
          );
      }
      this.db
        .prepare(
          'INSERT INTO jobs(session_id,job_key,request_hash,lease_until) VALUES(?,?,?,?) ON CONFLICT(session_id,job_key) DO UPDATE SET lease_until=excluded.lease_until',
        )
        .run(id, key, hash, Date.now() + 130000);
      return {};
    });
  }
  finishJob(id: string, key: string, value: string): void {
    this.db
      .prepare(
        'UPDATE jobs SET result=?,lease_until=0 WHERE session_id=? AND job_key=?',
      )
      .run(value, id, key);
  }
  releaseJob(id: string, key: string): void {
    this.db
      .prepare('UPDATE jobs SET lease_until=0 WHERE session_id=? AND job_key=?')
      .run(id, key);
  }
  amendNarration(
    owner: string,
    id: string,
    messageId: string,
    content: string,
  ): GameSession {
    return this.transaction(() => {
      const state = this.read(owner, id);
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
      this.db
        .prepare(
          'UPDATE sessions SET state=?,version=?,updated_at=? WHERE id=? AND owner_hash=?',
        )
        .run(encode(state), state.version, Date.now(), id, owner);
      return state;
    });
  }
  private transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  read(owner: string, id: string): GameSession {
    const row = this.db
      .prepare('SELECT state FROM sessions WHERE id=? AND owner_hash=?')
      .get(id, owner);
    if (!row) throw new RuleError('No se encontró esa partida privada.', 404);
    return decode(row.state);
  }
  list(owner: string): {
    id: string;
    version: number;
    status: string;
    character: string;
    scene: string;
    updatedAt: number;
  }[] {
    return this.db
      .prepare(
        'SELECT id,version,state,updated_at FROM sessions WHERE owner_hash=? ORDER BY updated_at DESC LIMIT 100',
      )
      .all(owner)
      .map((row) => {
        const state = decode(row.state),
          hero = state.battle.actors[state.participants[0].characterId];
        return {
          id: String(row.id),
          version: Number(row.version),
          status: state.status,
          character: hero.name,
          scene: state.world.sceneId,
          updatedAt: Number(row.updated_at),
        };
      });
  }
  create(
    owner: string,
    commandId: string,
    requestHash: string,
    make: () => GameSession,
  ): StoredResult {
    return this.transaction(() => {
      const previous = this.db
        .prepare(
          'SELECT request_hash,session_id FROM creations WHERE owner_hash=? AND command_id=?',
        )
        .get(owner, commandId);
      if (previous) {
        if (previous.request_hash !== requestHash)
          throw new RuleError(
            'Ese identificador de creación ya se usó con otros datos.',
            409,
          );
        return {
          state: this.read(owner, String(previous.session_id)),
          replayed: true,
        };
      }
      const count = this.db
        .prepare('SELECT count(*) AS n FROM sessions WHERE owner_hash=?')
        .get(owner);
      if (Number(count?.n) >= 100)
        throw new RuleError(
          'Has alcanzado el límite de partidas guardadas en esta instalación.',
          409,
        );
      const state = make();
      const raw = encode(state);
      this.db
        .prepare(
          'INSERT INTO sessions(id,owner_hash,version,state,updated_at) VALUES(?,?,?,?,?)',
        )
        .run(state.id, owner, state.version, raw, Date.now());
      this.db
        .prepare(
          'INSERT INTO creations(owner_hash,command_id,request_hash,session_id) VALUES(?,?,?,?)',
        )
        .run(owner, commandId, requestHash, state.id);
      return { state, replayed: false };
    });
  }
  transact(
    owner: string,
    id: string,
    expectedVersion: number,
    commandId: string,
    requestHash: string,
    change: (state: GameSession) => GameSession,
  ): StoredResult {
    return this.transaction(() => {
      const current = this.read(owner, id);
      const previous = this.db
        .prepare(
          'SELECT request_hash FROM commands WHERE session_id=? AND command_id=?',
        )
        .get(id, commandId);
      if (previous) {
        if (previous.request_hash !== requestHash)
          throw new RuleError('Ese comando ya se usó con otros datos.', 409);
        return { state: current, replayed: true };
      }
      if (current.version !== expectedVersion)
        throw new RuleError(
          'La partida cambió en otra pestaña. Actualiza el estado y revisa tu acción.',
          409,
        );
      const next = change(current);
      if (next.id !== id || next.version !== current.version + 1)
        throw new RuleError('Transición de partida inválida.', 500);
      const updated = this.db
        .prepare(
          'UPDATE sessions SET version=?,state=?,updated_at=? WHERE id=? AND owner_hash=? AND version=?',
        )
        .run(
          next.version,
          encode(next),
          Date.now(),
          id,
          owner,
          expectedVersion,
        );
      if (Number(updated.changes) !== 1)
        throw new RuleError(
          'Otra acción actualizó la partida. Recarga el estado.',
          409,
        );
      this.db
        .prepare(
          'INSERT INTO commands(session_id,command_id,request_hash,result_version) VALUES(?,?,?,?)',
        )
        .run(id, commandId, requestHash, next.version);
      return { state: next, replayed: false };
    });
  }
}
