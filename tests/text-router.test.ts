import assert from 'node:assert/strict';
import test from 'node:test';
import { createCharacter, suggestCharacter } from '../src/game/character.ts';
import { startSession } from '../src/game/engine.ts';
import { createProvider } from '../src/lib/ai-provider.ts';
import { createMaster } from '../src/server/master.ts';
import {
  type CircuitStore,
  createTextRouter,
} from '../src/server/text-router.ts';

const answer = { kind: 'clarify', question: '¿Qué decides?' };
test('a provider object that violates the Master contract falls back before any game effects', async () => {
  const state = startSession(
    'router-test',
    'participant',
    createCharacter(suggestCharacter('fighter'), 'hero'),
  );
  let fallback = 0;
  const router = createTextRouter(
    {
      groqKey: 'g',
      fallback: async () => {
        fallback++;
        return answer;
      },
    },
    async () => Response.json({ choices: [{ message: { content: '{}' } }] }),
  );
  assert.deepEqual(
    await createMaster(router).interpret(state, 'hero', 'Miro'),
    answer,
  );
  assert.equal(fallback, 1);
  assert.equal(state.version, 0);
});
test('503 Retry-After and Cloudflare upstream retry metadata are honored', async () => {
  const f = fixture();
  const provider = createProvider(
    { provider: 'cloudflare', accountId: 'a'.repeat(32), token: 'private' },
    async () =>
      new Response('', { status: 503, headers: { 'Retry-After': '3600' } }),
  );
  const router = createTextRouter(
    { groqKey: 'g', fallback: provider.json, circuit: f.circuit, now: f.now },
    async () =>
      new Response('', { status: 503, headers: { 'Retry-After': '3600' } }),
  );
  await assert.rejects(router('', {}));
  assert.ok((f.blocks.get('groq') || 0) >= f.now() + 3600000);
  assert.ok((f.blocks.get('cloudflare') || 0) >= f.now() + 3600000);
});
function fixture() {
  let time = 100000;
  const blocks = new Map<string, number>();
  const circuit: CircuitStore = {
    async read(key) {
      return blocks.get(key) || 0;
    },
    async block(key, until) {
      blocks.set(key, Math.max(until, blocks.get(key) || 0));
    },
  };
  return {
    circuit,
    blocks,
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}
test('Groq keeps trusted instructions separate, JSON mode, bounded output and no key in URL', async () => {
  const router = createTextRouter(
    { groqKey: 'private-key' },
    async (url, init) => {
      assert.equal(
        String(url),
        'https://api.groq.com/openai/v1/chat/completions',
      );
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer private-key',
      );
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, 'openai/gpt-oss-120b');
      assert.equal(body.messages[0].content, 'trusted');
      assert.equal(body.messages[1].content, '{"text":"untrusted"}');
      assert.equal(body.response_format.type, 'json_object');
      assert.ok(body.max_completion_tokens <= 1600);
      return Response.json({
        choices: [{ message: { content: JSON.stringify(answer) } }],
      });
    },
  );
  assert.deepEqual(await router('trusted', { text: 'untrusted' }), answer);
});
test('quota switches to Gemini once, persists Retry-After across router instances, then allows recovery', async () => {
  const f = fixture(),
    calls: string[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes('groq.com'))
      return new Response('sensitive upstream error', {
        status: 429,
        headers: { 'Retry-After': '120' },
      });
    assert.equal(
      new Headers(init?.headers).get('x-goog-api-key'),
      'gemini-private',
    );
    const body = JSON.parse(String(init?.body));
    assert.equal(body.systemInstruction.parts[0].text, 'trusted');
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }],
    });
  };
  const options = {
    groqKey: 'groq-private',
    geminiKey: 'gemini-private',
    circuit: f.circuit,
    now: f.now,
  };
  assert.deepEqual(
    await createTextRouter(options, fetcher)('trusted', {}),
    answer,
  );
  await createTextRouter(options, fetcher)('trusted', {});
  assert.equal(calls.filter((u) => u.includes('groq.com')).length, 1);
  f.advance(120001);
  await createTextRouter(options, fetcher)('trusted', {});
  assert.equal(calls.filter((u) => u.includes('groq.com')).length, 2);
});
test('missing keys skip endpoints, malformed JSON fails over, no provider body or secret leaks', async () => {
  let calls = 0,
    fallback = 0;
  const router = createTextRouter(
    {
      groqKey: 'secret',
      fallback: async () => {
        fallback++;
        return answer;
      },
    },
    async () => {
      calls++;
      return Response.json({
        choices: [{ message: { content: 'not JSON secret' } }],
      });
    },
  );
  assert.deepEqual(await router('trusted', {}), answer);
  assert.equal(calls, 1);
  assert.equal(fallback, 1);
  await assert.rejects(
    createTextRouter({}, async () => {
      throw Error('must not call');
    })('', {}),
    /configura/i,
  );
  await assert.rejects(
    createTextRouter(
      { groqKey: 'secret' },
      async () => new Response('secret', { status: 401 }),
    )('', {}),
    (e) => e instanceof Error && !e.message.includes('secret'),
  );
});
test('all quotas exhausted produce controlled 429, never fabricated content or paid fallback', async () => {
  const f = fixture();
  let calls = 0;
  const router = createTextRouter(
    { groqKey: 'g', geminiKey: 'm', circuit: f.circuit, now: f.now },
    async () => {
      calls++;
      return new Response('', { status: 429 });
    },
  );
  await assert.rejects(
    router('', {}),
    (e) => e instanceof Error && 'status' in e && e.status === 429,
  );
  assert.equal(calls, 2);
  await assert.rejects(router('', {}));
  assert.equal(calls, 2);
});
test('Retry-After dates are honored and configuration errors are cooled without blocking another provider', async () => {
  const f = fixture();
  let fallback = 0;
  const router = createTextRouter(
    {
      groqKey: 'g',
      circuit: f.circuit,
      now: f.now,
      fallback: async () => {
        fallback++;
        return answer;
      },
    },
    async () =>
      new Response('', {
        status: 429,
        headers: { 'Retry-After': new Date(f.now() + 3600000).toUTCString() },
      }),
  );
  await router('', {});
  assert.ok((f.blocks.get('groq') || 0) >= f.now() + 3599000);
  assert.equal(fallback, 1);
});
