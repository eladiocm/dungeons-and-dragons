import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { suggestCharacter } from '../src/game/character.ts';
import { GameService } from '../src/server/game-service.ts';
import { SaveCodec } from '../src/server/save-codec.ts';
import { createSessionApi } from '../src/server/session-api.ts';
import { SessionStore } from '../src/server/session-store.ts';

test('HTTP awaits remote storage for creation, private reads, commands and backup roundtrip', async () => {
  const local = new SessionStore(':memory:');
  const remote = new Proxy(local, {
    get(target, key) {
      const value = Reflect.get(target, key);
      return typeof value === 'function'
        ? async (...args: unknown[]) => value.apply(target, args)
        : value;
    },
  });
  const api = createSessionApi(
    new GameService(remote, () => 15, new SaveCodec(randomBytes(32))),
  );
  let cookie = '';
  const req = (body?: unknown, identity = cookie) =>
    new Request('http://localhost:3000/api/sessions', {
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(identity ? { Cookie: identity } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    const creation = await api.create(
      req({ id: 'create', character: suggestCharacter('fighter') }),
    );
    assert.equal(creation.status, 201);
    cookie = creation.headers.get('set-cookie')?.split(';')[0] || '';
    const first = await creation.json();
    assert.equal(first.session?.world.sceneId, 'square');
    const id = first.session.id;
    assert.equal((await (await api.list(req())).json()).sessions.length, 1);
    assert.equal((await (await api.get(req(), id)).json()).session.id, id);
    assert.equal(
      (await api.get(req(undefined, `dnd_owner=${'b'.repeat(43)}`), id)).status,
      404,
    );
    const body = {
      expectedVersion: 0,
      command: {
        id: 'walk',
        actorId: first.session.participants[0].characterId,
        type: 'propose',
        text: 'Camino',
        plan: { kind: 'travel', destination: 'road' },
      },
    };
    const moved = await (await api.command(req(body), id)).json();
    assert.equal(moved.session.world.sceneId, 'road');
    const replay = await (await api.command(req(body), id)).json();
    assert.equal(replay.replayed, true);
    assert.equal(replay.session.version, moved.session.version);
    const backup = await (await api.export(req(), id)).json();
    assert.equal(backup.format, 'dnd-save-v2');
    const imported = await (
      await api.import(req({ id: 'import', save: backup }))
    ).json();
    assert.notEqual(imported.session.id, id);
    assert.equal(imported.session.world.sceneId, 'road');
  } finally {
    local.close();
  }
});
