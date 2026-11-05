import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestCharacter } from '../src/game/character.ts';
import { GameService } from '../src/server/game-service.ts';
import { createMaster, type JsonGenerator } from '../src/server/master.ts';
import { SessionStore } from '../src/server/session-store.ts';

const setup = (json: JsonGenerator) => {
  const store = new SessionStore(':memory:');
  const service = new GameService(
    store,
    () => 15,
    undefined,
    createMaster(json),
  );
  const session = service.create(
    'owner',
    'create',
    suggestCharacter('fighter'),
  ).session;
  return {
    store,
    service,
    session,
    actorId: session.participants[0].characterId,
  };
};
test('Master interprets once and duplicate intent cannot repeat travel or provider work', async () => {
  let calls = 0;
  const f = setup(async () => {
    calls++;
    return { kind: 'action', plan: { kind: 'travel', destination: 'road' } };
  });
  try {
    const input = {
      id: 'walk',
      actorId: f.actorId,
      text: 'Camino hacia el molino',
    };
    const a = await f.service.intent('owner', f.session.id, 0, input),
      b = await f.service.intent('owner', f.session.id, 0, input);
    assert.equal(calls, 1);
    assert.equal(a.session.scene.id, 'road');
    assert.equal(b.replayed, true);
    assert.equal(b.session.version, 1);
    assert.equal(b.session.events.length, 2);
  } finally {
    f.store.close();
  }
});
test('forged AI effects and nonexistent actions change no resources or version', async () => {
  const f = setup(async () => ({
    kind: 'action',
    plan: {
      kind: 'creative',
      description: 'Regalo',
      onSuccess: [{ type: 'gold', amount: 999 }],
      onFailure: [],
    },
  }));
  try {
    await assert.rejects(
      f.service.intent('owner', f.session.id, 0, {
        id: 'bad',
        actorId: f.actorId,
        text: 'Dame oro',
      }),
    );
    assert.equal(f.service.get('owner', f.session.id).version, 0);
  } finally {
    f.store.close();
  }
});
test('clarification is replayable without a die or a character action', async () => {
  let calls = 0;
  const f = setup(async () => {
    calls++;
    return { kind: 'clarify', question: '¿A quién quieres hablarle?' };
  });
  try {
    const command = { id: 'vague', actorId: f.actorId, text: 'Le hablo' };
    const a = await f.service.intent('owner', f.session.id, 0, command);
    assert.equal(a.clarification, '¿A quién quieres hablarle?');
    assert.equal(a.session.version, 0);
    await f.service.intent('owner', f.session.id, 0, command);
    assert.equal(calls, 1);
  } finally {
    f.store.close();
  }
});
test('concurrent interpretation leases reject duplicates and stale AI responses cannot overwrite a newer turn', async () => {
  let resolve!: (v: unknown) => void;
  const f = setup(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  try {
    const input = { id: 'slow', actorId: f.actorId, text: 'Avanzo' };
    const first = f.service.intent('owner', f.session.id, 0, input);
    await new Promise((r) => setTimeout(r, 5));
    await assert.rejects(f.service.intent('owner', f.session.id, 0, input));
    f.service.execute('owner', f.session.id, 0, {
      type: 'propose',
      id: 'other',
      actorId: f.actorId,
      text: 'Miro el mapa',
      plan: { kind: 'interact', targetId: 'village-map', method: 'inspect' },
    });
    resolve({ kind: 'action', plan: { kind: 'travel', destination: 'road' } });
    await assert.rejects(first);
    assert.equal(f.service.get('owner', f.session.id).scene.id, 'square');
  } finally {
    f.store.close();
  }
});
test('narrative failure preserves resolved mechanics and retry changes prose only', async () => {
  let fail = true,
    calls = 0;
  const f = setup(async (system) => {
    calls++;
    if (system.includes('NARRAR')) {
      if (fail) throw new Error('quota');
      return {
        narrative:
          'La lluvia repica sobre los juncos. Ante ti el molino recorta la niebla.',
        question: '¿Cómo quieres acercarte?',
      };
    }
    return { kind: 'action', plan: { kind: 'travel', destination: 'road' } };
  });
  try {
    const moved = await f.service.intent('owner', f.session.id, 0, {
      id: 'walk',
      actorId: f.actorId,
      text: 'Voy al camino',
    });
    const message = moved.session.messages.at(-1);
    assert.ok(message);
    const failed = await f.service.narrate('owner', f.session.id, message.id);
    assert.ok(failed.warning);
    assert.equal(failed.session.world.time, moved.session.world.time);
    fail = false;
    const narrated = await f.service.narrate('owner', f.session.id, message.id);
    assert.equal(narrated.session.world.time, moved.session.world.time);
    assert.equal(narrated.session.events.length, 2);
    assert.match(
      narrated.session.messages.at(-1)?.content || '',
      /¿Cómo quieres acercarte\?/,
    );
    assert.equal(narrated.session.messages.at(-1)?.narrationPending, false);
    const count = calls;
    await f.service.narrate('owner', f.session.id, message.id);
    assert.equal(calls, count);
  } finally {
    f.store.close();
  }
});
test('narrating while dice wait survives acceptance without resurrecting old prose', async () => {
  const f = setup(async () => ({
    narrative: 'La plaza respira bajo la lluvia; Mara sostiene su lámpara.',
    question: '¿Qué decides hacer?',
  }));
  try {
    let state = f.service.execute('owner', f.session.id, 0, {
      type: 'propose',
      id: 'road',
      actorId: f.actorId,
      text: 'Avanzo',
      plan: { kind: 'travel', destination: 'road' },
    }).session;
    state = f.service.execute('owner', f.session.id, state.version, {
      type: 'propose',
      id: 'mill',
      actorId: f.actorId,
      text: 'Avanzo',
      plan: { kind: 'travel', destination: 'mill' },
    }).session;
    state = f.service.execute('owner', f.session.id, state.version, {
      type: 'propose',
      id: 'convince',
      actorId: f.actorId,
      text: 'Lo convenzo',
      plan: { kind: 'interact', targetId: 'bram', method: 'persuade' },
    }).session;
    assert.ok(state.pending);
    state = f.service.execute('owner', f.session.id, state.version, {
      type: 'roll',
      id: 'roll',
      actorId: f.actorId,
      pendingId: state.pending.id,
    }).session;
    state = (
      await f.service.narrate('owner', f.session.id, state.messages[0].id)
    ).session;
    assert.ok(state.pending);
    state = f.service.execute('owner', f.session.id, state.version, {
      type: 'accept',
      id: 'accept',
      actorId: f.actorId,
      pendingId: state.pending.id,
    }).session;
    assert.match(state.messages[0].content, /Mara sostiene/);
    assert.equal(state.messages[0].narrationPending, false);
  } finally {
    f.store.close();
  }
});
