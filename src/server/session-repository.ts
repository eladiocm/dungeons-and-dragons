import type { GameSession } from '../game/session-types.ts';
import type { StoredResult } from './session-store.ts';
export type MaybePromise<T> = T | Promise<T>;
export interface SessionSummary {
  id: string;
  version: number;
  status: string;
  character: string;
  scene: string;
  updatedAt: number;
}
export interface SessionRepository {
  media(key: string): MaybePromise<string | undefined>;
  saveMedia(key: string, data: string): MaybePromise<void>;
  replay(
    owner: string,
    id: string,
    commandId: string,
    hash: string,
  ): MaybePromise<GameSession | undefined>;
  claim(
    owner: string,
    id: string,
    key: string,
    hash: string,
  ): MaybePromise<{ cached?: string }>;
  finishJob(id: string, key: string, value: string): MaybePromise<void>;
  releaseJob(id: string, key: string): MaybePromise<void>;
  amendNarration(
    owner: string,
    id: string,
    messageId: string,
    content: string,
  ): MaybePromise<GameSession>;
  read(owner: string, id: string): MaybePromise<GameSession>;
  list(owner: string): MaybePromise<SessionSummary[]>;
  create(
    owner: string,
    commandId: string,
    hash: string,
    make: () => GameSession,
  ): MaybePromise<StoredResult>;
  transact(
    owner: string,
    id: string,
    expectedVersion: number,
    commandId: string,
    hash: string,
    change: (state: GameSession) => GameSession,
  ): MaybePromise<StoredResult>;
}
