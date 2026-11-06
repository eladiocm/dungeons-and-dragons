import assert from 'node:assert/strict';
import test from 'node:test';
import { storageConfig } from '../src/server/runtime-config.ts';

test('serverless runtime refuses local or incomplete storage and validates stable backup key', () => {
  assert.throws(() => storageConfig({ VERCEL: '1' }));
  assert.throws(() => storageConfig({ VERCEL: '1', GAME_STORE: 'sqlite' }));
  assert.throws(() =>
    storageConfig({
      GAME_STORE: 'supabase',
      SUPABASE_URL: 'https://example.supabase.co',
    }),
  );
  const env = {
    VERCEL: '1',
    GAME_STORE: 'supabase',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'public',
    DND_BACKEND_SECRET: 'a'.repeat(64),
    SAVE_KEY_BASE64: Buffer.alloc(32, 9).toString('base64'),
  };
  const valid = storageConfig(env);
  assert.equal(valid.kind, 'supabase');
  if (valid.kind === 'supabase') {
    assert.equal(valid.saveKey.byteLength, 32);
    assert.equal(valid.dailyLimit, 100);
  }
  assert.throws(() => storageConfig({ ...env, SAVE_KEY_BASE64: 'broken' }));
  assert.throws(() => storageConfig({ ...env, DEMO_AI_DAILY_LIMIT: '1001' }));
  assert.equal(storageConfig({}).kind, 'sqlite');
});
