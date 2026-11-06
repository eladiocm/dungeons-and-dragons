import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestCharacter } from '../src/game/character.ts';
import { GameService, hashPayload } from '../src/server/game-service.ts';
import { createMaster, type JsonGenerator } from '../src/server/master.ts';
import { SessionStore } from '../src/server/session-store.ts';

const setup = async (json: JsonGenerator) => {
  const store = new SessionStore(':memory:');
  const service = new GameService(
    store,
    () => 15,
    undefined,
    createMaster(json),
  );
  const session = (
    await service.create('owner', 'create', suggestCharacter('fighter'))
  ).session;
  return {
    store,
    service,
    session,
    actorId: session.participants[0].characterId,
  };
};
test('Master sends compact dialogue and only accessible spells without changing authoritative state', async () => {
  const f = await setup(async (_system, raw) => {
    const data = raw as {
      estado: Record<string, unknown>;
      conjuros: Record<string, unknown>;
    };
    assert.equal(data.estado.id, undefined);
    assert.ok(!JSON.stringify(data.estado.messages).includes('imagePrompt'));
    assert.ok(Object.keys(data.conjuros).length < 15);
    assert.ok(!('magicMissile' in data.conjuros));
    assert.ok('scene' in data.estado && 'battle' in data.estado);
    return { kind: 'clarify', question: '¿Qué decides?' };
  });
  try {
    await f.service.intent('owner', f.session.id, 0, {
      id: 'compact',
      actorId: f.actorId,
      text: 'Miro alrededor',
    });
  } finally {
    f.store.close();
  }
});
test('Master interprets once and duplicate intent cannot repeat travel or provider work', async () => {
  let calls = 0;
  const f = await setup(async () => {
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
  const f = await setup(async () => ({
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
    assert.equal((await f.service.get('owner', f.session.id)).version, 0);
  } finally {
    f.store.close();
  }
});
test('clarification is replayable without a die or a character action', async () => {
  let calls = 0;
  const f = await setup(async () => {
    calls++;
    return { kind: 'clarify', question: '¿A quién quieres hablarle?' };
  });
  try {
    const before = await f.service.get('owner', f.session.id);
    const command = { id: 'vague', actorId: f.actorId, text: 'Le hablo' };
    const a = await f.service.intent('owner', f.session.id, 0, command);
    assert.equal(a.clarification, '¿A quién quieres hablarle?');
    assert.equal(a.session.version, 1);
    assert.deepEqual(a.session.world, before.world);
    assert.deepEqual(a.session.battle, before.battle);
    assert.deepEqual(a.session.events, before.events);
    assert.equal(a.session.messages.at(-2)?.content, command.text);
    assert.equal(a.session.messages.at(-2)?.role, 'user');
    assert.equal(a.session.messages.at(-1)?.content, a.clarification);
    assert.equal(a.session.messages.at(-1)?.narrationPending, false);
    const replay = await f.service.intent('owner', f.session.id, 0, command);
    assert.equal(replay.replayed, true);
    assert.equal(replay.session.messages.length, a.session.messages.length);
    assert.equal(calls, 1);
  } finally {
    f.store.close();
  }
});
for (const responseKind of ['action', 'clarify'] as const) {
  test(`concurrent ${responseKind} interpretation cannot overwrite a newer turn`, async () => {
    let resolve!: (v: unknown) => void;
    const f = await setup(
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
      await f.service.execute('owner', f.session.id, 0, {
        type: 'propose',
        id: 'other',
        actorId: f.actorId,
        text: 'Miro el mapa',
        plan: { kind: 'interact', targetId: 'village-map', method: 'inspect' },
      });
      resolve(
        responseKind === 'clarify'
          ? { kind: 'clarify', question: '¿A quién te refieres?' }
          : { kind: 'action', plan: { kind: 'travel', destination: 'road' } },
      );
      await assert.rejects(first);
      assert.equal(
        (await f.service.get('owner', f.session.id)).scene.id,
        'square',
      );
    } finally {
      f.store.close();
    }
  });
}

test('narrative failure preserves resolved mechanics and retry changes prose only', async () => {
  let fail = true,
    calls = 0;
  const f = await setup(async (system) => {
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
  const f = await setup(async () => ({
    narrative: 'La plaza respira bajo la lluvia; Mara sostiene su lámpara.',
    question: '¿Qué decides hacer?',
  }));
  try {
    let state = (
      await f.service.execute('owner', f.session.id, 0, {
        type: 'propose',
        id: 'road',
        actorId: f.actorId,
        text: 'Avanzo',
        plan: { kind: 'travel', destination: 'road' },
      })
    ).session;
    state = (
      await f.service.execute('owner', f.session.id, state.version, {
        type: 'propose',
        id: 'mill',
        actorId: f.actorId,
        text: 'Avanzo',
        plan: { kind: 'travel', destination: 'mill' },
      })
    ).session;
    state = (
      await f.service.execute('owner', f.session.id, state.version, {
        type: 'propose',
        id: 'convince',
        actorId: f.actorId,
        text: 'Lo convenzo',
        plan: { kind: 'interact', targetId: 'bram', method: 'persuade' },
      })
    ).session;
    assert.ok(state.pending);
    state = (
      await f.service.execute('owner', f.session.id, state.version, {
        type: 'roll',
        id: 'roll',
        actorId: f.actorId,
        pendingId: state.pending.id,
      })
    ).session;
    state = (
      await f.service.narrate('owner', f.session.id, state.messages[0].id)
    ).session;
    assert.ok(state.pending);
    state = (
      await f.service.execute('owner', f.session.id, state.version, {
        type: 'accept',
        id: 'accept',
        actorId: f.actorId,
        pendingId: state.pending.id,
      })
    ).session;
    assert.match(state.messages[0].content, /Mara sostiene/);
    assert.equal(state.messages[0].narrationPending, false);
  } finally {
    f.store.close();
  }
});

for (const cachedJob of [false, true]) {
  test(`stale pending narration respects an already amended message, cached job: ${cachedJob}`, async () => {
    const store = new SessionStore(':memory:');
    let calls = 0;
    const master = createMaster(async () => {
      calls++;
      return { narrative: 'Prosa repetida.', question: '¿Qué decides?' };
    });
    const service = new GameService(store, () => 15, undefined, master);
    try {
      const state = (
        await service.create('owner', 'create', suggestCharacter('fighter'))
      ).session;
      const stale = store.read('owner', state.id),
        messageId = state.messages[0].id,
        key = `narration:${messageId}`;
      const done = store.amendNarration(
        'owner',
        state.id,
        messageId,
        'Prosa ya completada. ¿Qué decides?',
      );
      if (cachedJob) {
        store.claim('owner', state.id, key, hashPayload(messageId));
        store.finishJob(state.id, key, '{}');
      }
      let first = true;
      const delayed = new Proxy(store, {
        get(target, key) {
          if (key === 'read')
            return (owner: string, id: string) => {
              if (first) {
                first = false;
                return structuredClone(stale);
              }
              return target.read(owner, id);
            };
          const value = Reflect.get(target, key);
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
      const result = await new GameService(
        delayed,
        () => 15,
        undefined,
        master,
      ).narrate('owner', state.id, messageId);
      assert.equal(calls, 0);
      assert.equal(result.session.version, done.version);
      assert.equal(
        result.session.messages[0].content,
        done.messages[0].content,
      );
    } finally {
      store.close();
    }
  });
}

test('the reply to a clarification includes the original dialogue in the Master context', async () => {
  let calls = 0;
  const f = await setup(async (_system, raw) => {
    calls++;
    const data = raw as {
      intencion: string;
      estado: { messages: { role: string; content: string }[] };
    };
    if (data.intencion === 'Le hablo')
      return { kind: 'clarify', question: '¿A quién quieres hablarle?' };
    assert.ok(
      data.estado.messages.some(
        (m) => m.role === 'user' && m.content === 'Le hablo',
      ),
    );
    assert.ok(
      data.estado.messages.some(
        (m) =>
          m.role === 'assistant' && m.content === '¿A quién quieres hablarle?',
      ),
    );
    return {
      kind: 'action',
      plan: { kind: 'interact', targetId: 'mara', method: 'talk' },
    };
  });
  try {
    const first = await f.service.intent('owner', f.session.id, 0, {
      id: 'vague',
      actorId: f.actorId,
      text: 'Le hablo',
    });
    const reply = await f.service.intent(
      'owner',
      f.session.id,
      first.session.version,
      { id: 'reply', actorId: f.actorId, text: 'Con Mara.' },
    );
    assert.equal(calls, 2);
    assert.equal(
      reply.session.messages.filter((m) => m.role === 'user').length,
      2,
    );
  } finally {
    f.store.close();
  }
});

test('an old cached clarification is saved without repeating the provider call', async () => {
  let calls = 0;
  const f = await setup(async () => {
    calls++;
    throw Error('must reuse cached clarification');
  });
  try {
    const input = { id: 'old-vague', actorId: f.actorId, text: 'Le hablo' },
      hash = hashPayload({ expectedVersion: 0, input }),
      key = `intent:${input.id}`;
    f.store.claim('owner', f.session.id, key, hash);
    f.store.finishJob(
      f.session.id,
      key,
      JSON.stringify({ clarification: '¿A quién quieres hablarle?' }),
    );
    const result = await f.service.intent('owner', f.session.id, 0, input);
    assert.equal(calls, 0);
    assert.equal(result.session.version, 1);
    assert.equal(
      result.session.messages.at(-1)?.content,
      '¿A quién quieres hablarle?',
    );
  } finally {
    f.store.close();
  }
});
