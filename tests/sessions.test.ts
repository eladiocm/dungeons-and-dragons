import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { createCharacter, suggestCharacter } from '../src/game/character.ts';
import { startSession, transition } from '../src/game/engine.ts';
import { GameService } from '../src/server/game-service.ts';
import { SaveCodec } from '../src/server/save-codec.ts';
import { createSessionApi } from '../src/server/session-api.ts';
import { SessionStore } from '../src/server/session-store.ts';

const initial = () =>
  startSession(
    'session',
    'person',
    createCharacter(suggestCharacter('fighter'), 'hero'),
  );
const prep = () => {
  let state = initial();
  for (const [id, destination] of [
    ['road', 'road'],
    ['mill', 'mill'],
  ] as const)
    state = transition(
      state,
      {
        type: 'propose',
        id,
        actorId: 'hero',
        text: 'Avanzo',
        plan: { kind: 'travel', destination },
      },
      () => {
        throw new Error('unexpected dice');
      },
    );
  return state;
};
function temp() {
  const folder = mkdtempSync(join(tmpdir(), 'dnd-session-tests-'));
  return {
    file: join(folder, 'game.sqlite'),
    cleanup: () => {
      const target = resolve(folder);
      assert.equal(
        dirname(target).toLowerCase(),
        resolve(tmpdir()).toLowerCase(),
      );
      assert.ok(basename(target).startsWith('dnd-session-tests-'));
      rmSync(target, { recursive: true, force: true });
    },
  };
}

test('SQLite sessions survive reopening and another owner cannot read them', () => {
  const dir = temp();
  let store = new SessionStore(dir.file);
  try {
    store.create('owner', 'create', 'hash', initial);
    store.close();
    store = new SessionStore(dir.file);
    assert.equal(store.read('owner', 'session').world.sceneId, 'square');
    assert.throws(
      () => store.read('other', 'session'),
      (e) => e instanceof Error && 'status' in e && e.status === 404,
    );
    assert.equal(store.list('owner').length, 1);
    assert.equal(store.list('other').length, 0);
  } finally {
    store.close();
    dir.cleanup();
  }
});

test('duplicate creation is idempotent and a changed payload with the same key is rejected', () => {
  const store = new SessionStore(':memory:');
  try {
    const first = store.create('owner', 'create', 'hash', initial);
    const replay = store.create('owner', 'create', 'hash', () => {
      throw new Error('creation repeated');
    });
    assert.equal(first.state.id, replay.state.id);
    assert.equal(replay.replayed, true);
    assert.throws(
      () => store.create('owner', 'create', 'other', initial),
      (e) => e instanceof Error && 'status' in e && e.status === 409,
    );
  } finally {
    store.close();
  }
});

test('a lost roll response is replayed without invoking RNG again', () => {
  const store = new SessionStore(':memory:');
  try {
    store.create('owner', 'create', 'hash', prep);
    const before = store.read('owner', 'session');
    const proposed = store.transact(
      'owner',
      'session',
      before.version,
      'propose',
      'proposal',
      (s) =>
        transition(
          s,
          {
            type: 'propose',
            id: 'propose',
            actorId: 'hero',
            text: 'Intento convencer a Bram',
            plan: { kind: 'interact', targetId: 'bram', method: 'persuade' },
          },
          () => {
            throw new Error('unexpected RNG');
          },
        ),
    );
    assert.ok(proposed.state.pending);
    let calls = 0;
    const command = {
      type: 'roll' as const,
      id: 'roll',
      actorId: 'hero',
      pendingId: proposed.state.pending.id,
    };
    const first = store.transact(
      'owner',
      'session',
      proposed.state.version,
      'roll',
      'body',
      (s) =>
        transition(s, command, () => {
          calls++;
          return 15;
        }),
    );
    const replay = store.transact(
      'owner',
      'session',
      proposed.state.version,
      'roll',
      'body',
      () => {
        throw new Error('RNG rerun');
      },
    );
    assert.equal(calls, 1);
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.state.pending?.tape, first.state.pending?.tape);
  } finally {
    store.close();
  }
});

test('two stale writers cannot overwrite one another and failed transitions roll back', () => {
  const store = new SessionStore(':memory:');
  try {
    store.create('owner', 'create', 'hash', initial);
    store.transact('owner', 'session', 0, 'one', 'one', (s) =>
      transition(
        s,
        {
          type: 'propose',
          id: 'one',
          actorId: 'hero',
          text: 'Camino',
          plan: { kind: 'travel', destination: 'road' },
        },
        () => 1,
      ),
    );
    assert.throws(
      () => store.transact('owner', 'session', 0, 'two', 'two', (s) => s),
      (e) => e instanceof Error && 'status' in e && e.status === 409,
    );
    assert.throws(() =>
      store.transact('owner', 'session', 1, 'bad', 'bad', () => {
        throw new Error('failure');
      }),
    );
    assert.equal(store.read('owner', 'session').world.sceneId, 'road');
    assert.equal(store.read('owner', 'session').version, 1);
  } finally {
    store.close();
  }
});

test('HTTP session uses private cookie and rejects origin oversize and forged state before any changes', async () => {
  const store = new SessionStore(':memory:');
  const api = createSessionApi(new GameService(store));
  const request = (
    method: string,
    body?: unknown,
    cookie?: string,
    origin = 'http://127.0.0.1:3000',
  ) =>
    new Request('http://127.0.0.1:3000/api/sessions', {
      method,
      headers: {
        Origin: origin,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  try {
    const list = await api.list(request('GET'));
    const set = list.headers.get('set-cookie');
    assert.ok(set);
    assert.ok(set.includes('HttpOnly'));
    assert.ok(set.includes('SameSite=Strict'));
    const cookie = set.split(';')[0];
    const input = { id: 'creation', character: suggestCharacter('fighter') };
    const created = await api.create(request('POST', input, cookie));
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('cache-control'), 'private, no-store');
    const body = await created.json();
    const id = body.session.id;
    assert.ok(!JSON.stringify(body).includes('dmState'));
    assert.equal((await api.get(request('GET'), id)).status, 404);
    assert.equal(
      (
        await api.command(
          request(
            'POST',
            {
              expectedVersion: 0,
              command: {
                type: 'propose',
                id: 'cheat',
                actorId: body.session.participants[0].characterId,
                text: 'cheat',
                plan: { kind: 'retreat' },
              },
              state: { hp: 1000 },
            },
            cookie,
          ),
          id,
        )
      ).status,
      400,
    );
    assert.equal(
      (await api.create(request('POST', input, cookie, 'https://evil.example')))
        .status,
      403,
    );
    assert.equal(
      (
        await api.create(
          request('POST', { ...input, large: 'x'.repeat(70000) }, cookie),
        )
      ).status,
      413,
    );
    const unchanged = await api.get(request('GET', undefined, cookie), id);
    const current = await unchanged.json();
    assert.equal(current.session.version, 0);
    const replay = await api.create(request('POST', input, cookie));
    assert.equal((await replay.json()).session.id, id);
  } finally {
    store.close();
  }
});

test('HTTP encrypted backup restores a new private copy and rejects tampering', async () => {
  const store = new SessionStore(':memory:');
  const api = createSessionApi(
    new GameService(store, () => 12, new SaveCodec(new Uint8Array(32).fill(7))),
  );
  const req = (body?: unknown, cookie = `dnd_owner=${'a'.repeat(43)}`) =>
    new Request('http://localhost:3000/api/sessions', {
      method: body ? 'POST' : 'GET',
      headers: {
        Cookie: cookie,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    const first = await (
      await api.create(
        req({ id: 'original', character: suggestCharacter('fighter') }),
      )
    ).json();
    const backup = await api.export(req(), first.session.id);
    assert.equal(backup.status, 200);
    const save = await backup.json();
    assert.equal(save.format, 'dnd-save-v2');
    assert.ok(!JSON.stringify(save).includes('dmState'));
    const copy = await api.import(req({ id: 'restore', save }));
    assert.equal(copy.status, 201);
    const restored = await copy.json();
    assert.notEqual(restored.session.id, first.session.id);
    assert.equal(restored.session.scene.id, 'square');
    assert.equal(
      (
        await api.export(
          req(undefined, `dnd_owner=${'b'.repeat(43)}`),
          first.session.id,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await api.import(
          req({ id: 'bad', save: { ...save, tag: `${'A'.repeat(22)}==` } }),
        )
      ).status,
      400,
    );
  } finally {
    store.close();
  }
});

test('maximum command IDs remain valid when embedded in pending IDs', async () => {
  const store = new SessionStore(':memory:');
  store.create('owner', 'create', 'hash', prep);
  const service = new GameService(store, () => 12),
    api = createSessionApi(service);
  const cookie = `dnd_owner=${'a'.repeat(43)}`;
  const { createHash } = await import('node:crypto');
  const ownerHash = createHash('sha256').update('a'.repeat(43)).digest('hex');
  store.db
    .prepare('UPDATE sessions SET owner_hash=? WHERE id=?')
    .run(ownerHash, 'session');
  const send = async (expectedVersion: number, command: unknown) =>
    api.command(
      new Request('http://localhost:3000/api/sessions/session/commands', {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedVersion, command }),
      }),
      'session',
    );
  try {
    const proposed = await send(2, {
      type: 'propose',
      id: 'a'.repeat(100),
      actorId: 'hero',
      text: 'Convenzo a Bram',
      plan: { kind: 'interact', targetId: 'bram', method: 'persuade' },
    });
    assert.equal(proposed.status, 200);
    const body = await proposed.json();
    assert.ok(body.session.pending.id.length > 100);
    assert.equal(
      (
        await send(3, {
          type: 'roll',
          id: 'roll',
          actorId: 'hero',
          pendingId: body.session.pending.id,
        })
      ).status,
      200,
    );
  } finally {
    store.close();
  }
});

test('sync after an ending remains a legal versioned command without another ending event', () => {
  const store = new SessionStore(':memory:');
  const service = new GameService(store);
  try {
    const { session } = service.create(
        'owner',
        'end',
        suggestCharacter('fighter'),
      ),
      actorId = session.participants[0].characterId;
    const ended = service.execute('owner', session.id, 0, {
      type: 'propose',
      id: 'retreat',
      actorId,
      text: 'Abandono la misión',
      plan: { kind: 'retreat' },
    }).session;
    const synced = service.execute('owner', session.id, ended.version, {
      type: 'sync',
      id: 'sync',
      actorId,
    }).session;
    assert.equal(synced.version, ended.version + 1);
    assert.equal(synced.events.length, ended.events.length);
    assert.equal(synced.ending?.kind, 'retreat');
  } finally {
    store.close();
  }
});

test('reopening SQLite replays a previously rolled command without new randomness', () => {
  const dir = temp();
  let store = new SessionStore(dir.file);
  try {
    store.create('owner', 'create', 'hash', prep);
    let service = new GameService(store, () => 15);
    let state = service.get('owner', 'session');
    state = service.execute('owner', 'session', state.version, {
      type: 'propose',
      id: 'propose',
      actorId: 'hero',
      text: 'Convenzo a Bram',
      plan: { kind: 'interact', targetId: 'bram', method: 'persuade' },
    }).session;
    assert.ok(state.pending);
    const beforeVersion = state.version,
      command = {
        type: 'roll' as const,
        id: 'roll',
        actorId: 'hero',
        pendingId: state.pending.id,
      },
      rolled = service.execute(
        'owner',
        'session',
        beforeVersion,
        command,
      ).session;
    store.close();
    store = new SessionStore(dir.file);
    service = new GameService(store, () => {
      throw new Error('RNG repeated after restart');
    });
    const replay = service.execute('owner', 'session', beforeVersion, command);
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.session.pending?.dice, rolled.pending?.dice);
    assert.equal(replay.session.version, rolled.version);
  } finally {
    store.close();
    dir.cleanup();
  }
});
