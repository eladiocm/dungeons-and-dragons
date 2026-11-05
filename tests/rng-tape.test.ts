import assert from 'node:assert/strict';
import test from 'node:test';
import { createTapeRoller } from '../src/game/rng-tape.ts';

test('replaying an action preserves existing groups even when a reroll creates new damage dice', () => {
  let n = 0;
  const first = createTapeRoller([], () => [4, 3][n++]);
  assert.equal(first.roller.scope?.('Ataque', 'hero')(20), 4);
  assert.equal(first.roller.scope?.('Otra prueba', 'other')(4), 3);
  const old = structuredClone(first.tape);
  old[0].value = 20;
  const replay = createTapeRoller(old, () => 6);
  assert.equal(replay.roller.scope?.('Ataque', 'hero')(20), 20);
  assert.equal(replay.roller.scope?.('Daño nuevo', 'hero')(6), 6);
  assert.equal(replay.roller.scope?.('Otra prueba', 'other')(4), 3);
  assert.equal(replay.tape.length, 3);
  assert.equal(first.tape[0].value, 4);
});

test('two separate saving throws are distinct groups while advantage dice stay together', () => {
  const rolled = createTapeRoller([], () => 1);
  const advantage = rolled.roller.scope?.('Salvación', 'hero');
  assert.ok(advantage);
  advantage(20);
  advantage(20);
  rolled.roller.scope?.('Salvación', 'hero')(20);
  assert.equal(rolled.tape[0].groupId, rolled.tape[1].groupId);
  assert.notEqual(rolled.tape[0].groupId, rolled.tape[2].groupId);
});
