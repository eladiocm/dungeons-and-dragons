import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { GameSession } from '../game/session-types.ts';
import { RuleError } from '../game/types.ts';

export interface SealedSave {
  format: 'dnd-save-v2';
  iv: string;
  tag: string;
  ciphertext: string;
}
const AAD = Buffer.from('Valdumbria/dnd-save-v2');
export class SaveCodec {
  private readonly key: Buffer;
  constructor(key: Uint8Array) {
    if (key.byteLength !== 32)
      throw new RuleError('La clave de copias no es válida.', 503);
    this.key = Buffer.from(key);
  }
  seal(state: GameSession): SealedSave {
    const bytes = Buffer.from(JSON.stringify(state));
    if (bytes.length > 8000000)
      throw new RuleError(
        'La partida supera el tamaño de exportación permitido.',
        413,
      );
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(AAD);
    const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return {
      format: 'dnd-save-v2',
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: encrypted.toString('base64'),
    };
  }
  open(raw: unknown): GameSession {
    try {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        throw new Error();
      const value = raw as Record<string, unknown>;
      if (
        value.format !== 'dnd-save-v2' ||
        Object.keys(value).some(
          (k) => !['format', 'iv', 'tag', 'ciphertext'].includes(k),
        )
      )
        throw new Error();
      for (const key of ['iv', 'tag', 'ciphertext'])
        if (
          typeof value[key] !== 'string' ||
          !/^[A-Za-z0-9+/]+={0,2}$/.test(value[key] as string)
        )
          throw new Error();
      if ((value.ciphertext as string).length > 11000000) throw new Error();
      const iv = Buffer.from(value.iv as string, 'base64'),
        tag = Buffer.from(value.tag as string, 'base64');
      if (iv.length !== 12 || tag.length !== 16) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAAD(AAD);
      decipher.setAuthTag(tag);
      const bytes = Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext as string, 'base64')),
        decipher.final(),
      ]);
      if (bytes.length > 8000000) throw new Error();
      const state = JSON.parse(bytes.toString('utf8')) as GameSession;
      if (
        state.schemaVersion !== 2 ||
        state.rulesetVersion !== 'SRD-5.2.1' ||
        state.catalogVersion !== 1 ||
        state.moduleVersion !== 1 ||
        !state.participants?.length ||
        state.participants.length > 4 ||
        !state.battle ||
        !state.world
      )
        throw new Error();
      return state;
    } catch {
      throw new RuleError(
        'No se pudo abrir la copia. Debe ser una exportación íntegra de esta instalación y conservarse su clave de guardado.',
      );
    }
  }
}
export function readSaveKey(path: string): Uint8Array {
  mkdirSync(dirname(path), { recursive: true });
  try {
    const key = readFileSync(path);
    if (key.length !== 32)
      throw new RuleError('La clave de copias guardada no es válida.', 503);
    return key;
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    )
      throw error;
  }
  try {
    writeFileSync(path, randomBytes(32), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'EEXIST'
    )
      throw error;
  }
  const key = readFileSync(path);
  if (key.length !== 32)
    throw new RuleError('La clave de copias guardada no es válida.', 503);
  return key;
}
