import assert from 'node:assert/strict';
import test from 'node:test';
import { SupabaseStore } from '../src/server/supabase-store.ts';

test('remote repository sends backend credential only to HTTPS RPC and masks provider errors', async () => {
  let requests = 0;
  const secret = 's'.repeat(64);
  const repo = new SupabaseStore(
    {
      url: 'https://example.supabase.co',
      publishableKey: 'public-key',
      secret,
    },
    async (url, init) => {
      requests++;
      assert.equal(
        String(url),
        'https://example.supabase.co/rest/v1/rpc/dnd_backend',
      );
      assert.equal(new Headers(init?.headers).get('apikey'), 'public-key');
      const body = JSON.parse(String(init?.body));
      assert.equal(body.p_secret, secret);
      assert.equal(body.p_op, 'list');
      return Response.json(
        { message: `${secret} database error` },
        { status: 500 },
      );
    },
  );
  await assert.rejects(
    repo.list('owner'),
    (e: unknown) =>
      e instanceof Error &&
      !e.message.includes(secret) &&
      'status' in e &&
      e.status === 503,
  );
  assert.equal(requests, 1);
  assert.throws(
    () =>
      new SupabaseStore({
        url: 'http://example.com',
        publishableKey: 'key',
        secret,
      }),
  );
});

test('remote repository preserves controlled authorization and conflict statuses', async () => {
  const repo = new SupabaseStore(
    {
      url: 'https://example.supabase.co',
      publishableKey: 'public-key',
      secret: 's'.repeat(64),
    },
    async () => Response.json({ error: 'La partida cambió.', status: 409 }),
  );
  await assert.rejects(
    repo.read('owner', 'session'),
    (e: unknown) => e instanceof Error && 'status' in e && e.status === 409,
  );
});
