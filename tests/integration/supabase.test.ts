import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createCharacter, suggestCharacter } from '../../src/game/character.ts';
import { startSession, transition } from '../../src/game/engine.ts';
import { SupabaseStore } from '../../src/server/supabase-store.ts';

const repo = () =>
  new SupabaseStore({
    url: process.env.SUPABASE_URL || '',
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    secret: process.env.DND_BACKEND_SECRET || '',
  });
test('real Supabase keeps private state, atomic CAS, command replay, jobs and narration snapshots', async () => {
  const store = repo(),
    owner = `test-${randomUUID()}`,
    id = randomUUID(),
    actorId = randomUUID();
  const make = () =>
    startSession(
      id,
      randomUUID(),
      createCharacter(suggestCharacter('fighter'), actorId),
    );
  let current = (await store.create(owner, 'create', 'body', make)).state;
  assert.equal(
    (
      await store.create(owner, 'create', 'body', () => {
        throw Error('duplicate creation');
      })
    ).replayed,
    true,
  );
  await assert.rejects(store.create(owner, 'create', 'different', make));
  await assert.rejects(
    store.read('other', id),
    (e: unknown) => e instanceof Error && 'status' in e && e.status === 404,
  );
  assert.equal((await store.list(owner)).length, 1);
  const command = {
    id: 'walk',
    type: 'propose' as const,
    actorId,
    text: 'Avanzo',
    plan: { kind: 'travel' as const, destination: 'road' as const },
  };
  const both = await Promise.allSettled(
    ['one', 'two'].map((commandId) =>
      store.transact(owner, id, 0, commandId, commandId, (s) =>
        transition(s, { ...command, id: commandId }, () => 15),
      ),
    ),
  );
  assert.equal(both.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(both.filter((x) => x.status === 'rejected').length, 1);
  const winner = both[0].status === 'fulfilled' ? 'one' : 'two';
  const replay = await store.transact(owner, id, 0, winner, winner, () => {
    throw Error('replayed dice');
  });
  assert.equal(replay.replayed, true);
  current = replay.state;
  assert.equal(current.version, 1);
  await store.claim(owner, id, 'test-job', 'hash');
  await assert.rejects(store.claim(owner, id, 'test-job', 'hash'));
  await store.finishJob(id, 'test-job', 'cached');
  assert.equal(
    (await store.claim(owner, id, 'test-job', 'hash')).cached,
    'cached',
  );
  for (const [name, plan] of [
    ['mill', { kind: 'travel', destination: 'mill' }],
    ['convince', { kind: 'interact', targetId: 'bram', method: 'persuade' }],
  ] as const) {
    current = (
      await store.transact(owner, id, current.version, name, name, (s) =>
        transition(
          s,
          { id: name, type: 'propose', actorId, text: 'Actúo', plan },
          () => 15,
        ),
      )
    ).state;
  }
  assert.ok(current.pending);
  let rolls = 0;
  const roll = {
    id: 'roll',
    type: 'roll' as const,
    actorId,
    pendingId: current.pending.id,
  };
  const before = current.version;
  current = (
    await store.transact(owner, id, before, 'roll', 'roll', (s) =>
      transition(s, roll, () => {
        rolls++;
        return 15;
      }),
    )
  ).state;
  const again = await store.transact(owner, id, before, 'roll', 'roll', () => {
    throw Error('duplicate RNG');
  });
  assert.equal(rolls, 1);
  assert.deepEqual(again.state.pending?.tape, current.pending?.tape);
  const messageId = current.messages[0].id;
  current = await store.amendNarration(
    owner,
    id,
    messageId,
    'Narración corregida. ¿Qué decides?',
  );
  assert.equal(
    current.pending?.base.messages[0].content,
    'Narración corregida. ¿Qué decides?',
  );
  assert.equal(
    current.pending?.preview?.state.messages[0].content,
    'Narración corregida. ¿Qué decides?',
  );
  assert.equal((await repo().read(owner, id)).version, current.version);
  const invalid = new SupabaseStore({
    url: process.env.SUPABASE_URL || '',
    publishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    secret: '0'.repeat(64),
  });
  await assert.rejects(
    invalid.list(owner),
    (e: unknown) => e instanceof Error && 'status' in e && e.status === 403,
  );
  const bucket = `test-${randomUUID()}`;
  await store.rpc('quota', { bucket, limit: 2 });
  await store.rpc('quota', { bucket, limit: 2 });
  await assert.rejects(
    store.rpc('quota', { bucket, limit: 2 }),
    (e: unknown) => e instanceof Error && 'status' in e && e.status === 429,
  );
  await store.saveMedia('integration-cache', 'saved');
  assert.equal(await store.media('integration-cache'), 'saved');
});
