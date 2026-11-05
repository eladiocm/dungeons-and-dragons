import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacter, suggestCharacter } from '../src/game/character.ts';
import { startSession } from '../src/game/engine.ts';
import { SaveCodec } from '../src/server/save-codec.ts';

test('save export conceals Master data and round-trips a versioned game without access cookies', () => {
  const codec = new SaveCodec(new Uint8Array(32).fill(7));
  const state = startSession(
    'session',
    'person',
    createCharacter(suggestCharacter('fighter'), 'hero'),
  );
  state.dmState.secrets = ['private-master-data'];
  const sealed = codec.seal(state);
  const raw = JSON.stringify(sealed);
  assert.ok(!raw.includes('private-master-data'));
  assert.ok(!raw.includes('dnd_owner'));
  const restored = codec.open(sealed);
  assert.equal(restored.battle.actors.hero.hp.current, 12);
  assert.equal(restored.world.sceneId, 'square');
  assert.deepEqual(restored.dmState.secrets, ['private-master-data']);
});

test('modified or foreign-installation saves cannot forge character statistics', () => {
  const codec = new SaveCodec(new Uint8Array(32).fill(7));
  const state = startSession(
    'session',
    'person',
    createCharacter(suggestCharacter('fighter'), 'hero'),
  );
  const sealed = codec.seal(state);
  const changed = {
    ...sealed,
    ciphertext:
      (sealed.ciphertext[0] === 'A' ? 'B' : 'A') + sealed.ciphertext.slice(1),
  };
  assert.throws(() => codec.open(changed));
  assert.throws(() => new SaveCodec(new Uint8Array(32).fill(8)).open(sealed));
  assert.throws(() => codec.open({ ...sealed, format: 'other' }));
});
