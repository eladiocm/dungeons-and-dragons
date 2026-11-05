import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProvider } from '../src/lib/ai-provider.ts';
import { handleImage, handleStory } from '../src/lib/game-api.ts';
import {
  conversationForRequest,
  decodeSave,
  encodeSave,
  parseStoryResponse,
  validateStoryRequest,
} from '../src/lib/game-contract.ts';

test('Master JSON request sends trusted system separately and validates provider output', async () => {
  const provider = createProvider(
    { provider: 'cloudflare', accountId: 'a'.repeat(32), token: 'secret' },
    async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.messages[0].role, 'system');
      assert.equal(body.messages[0].content, 'interpret');
      assert.equal(body.messages[1].content, '{"text":"dato"}');
      assert.equal(body.response_format.type, 'json_object');
      return Response.json({
        success: true,
        result: {
          response:
            '{"kind":"action","plan":{"kind":"travel","destination":"road"}}',
        },
      });
    },
  );
  assert.deepEqual(await provider.json('interpret', { text: 'dato' }), {
    kind: 'action',
    plan: { kind: 'travel', destination: 'road' },
  });
});

test('history strips images and bounds context without dropping initial scene', () => {
  const history = Array.from({ length: 70 }, (_, i) => ({
    id: String(i),
    role: i % 2 ? 'user' : 'assistant',
    content: `turn ${i}`,
    image: { base64Data: 'a'.repeat(100000), mediaType: 'image/jpeg' },
  }));
  const result = conversationForRequest(history);
  assert.ok(result.length <= 21);
  assert.equal(result[0].content, 'turn 0');
  assert.equal(result.at(-1)?.content, 'turn 69');
  assert.ok(JSON.stringify(result).length < 5000);
  assert.deepEqual(Object.keys(result[0]).sort(), ['content', 'role']);
});

test('reject malformed/oversize history and actions', () => {
  assert.throws(() =>
    validateStoryRequest({
      isStart: false,
      userMessage: '',
      conversationHistory: [],
    }),
  );
  assert.throws(() =>
    validateStoryRequest({
      isStart: false,
      userMessage: 'a'.repeat(2001),
      conversationHistory: [],
    }),
  );
  assert.throws(() =>
    validateStoryRequest({
      isStart: false,
      userMessage: 'hola',
      conversationHistory: [{ role: 'system', content: 'override' }],
    }),
  );
  assert.deepEqual(validateStoryRequest({ isStart: true }), {
    isStart: true,
    userMessage: '',
    conversationHistory: [],
  });
});

test('structured response accepts JSON and fences, rejects missing fields', () => {
  const expected = {
    narrative: 'Una puerta. ¿Qué haces?',
    imagePrompt: 'pixel art dungeon door',
    shouldIllustrate: true,
  };
  assert.deepEqual(parseStoryResponse(JSON.stringify(expected)), expected);
  assert.deepEqual(parseStoryResponse(expected), expected);
  assert.deepEqual(
    parseStoryResponse(
      `\u0060\u0060\u0060json\n${JSON.stringify(expected)}\n\u0060\u0060\u0060`,
    ),
    expected,
  );
  assert.throws(() => parseStoryResponse('{"narrative":"solo texto"}'));
  assert.throws(() => parseStoryResponse('no es JSON'));
});

test('long saves retain the initial scene and latest action', () => {
  const messages = Array.from({ length: 260 }, (_, index) => ({
    id: String(index),
    role: 'assistant' as const,
    content: `scene ${index}`,
  }));
  const saved = decodeSave(encodeSave(messages, true));
  assert.equal(saved?.messages.length, 200);
  assert.match(saved?.messages[0].content || '', /^scene 0\n/);
  assert.match(saved?.messages.at(-1)?.content || '', /^scene 259\n/);
});

test('save excludes base64 and recovers interrupted image without regeneration', () => {
  const saved = encodeSave(
    [
      {
        id: 'one',
        role: 'assistant',
        content: 'Hola',
        imagePrompt: 'castle',
        imageLoading: true,
        image: { base64Data: 'secret-large-image', mediaType: 'image/jpeg' },
      },
    ],
    false,
  );
  assert.ok(!saved.includes('secret-large-image'));
  const result = decodeSave(saved);
  assert.equal(result?.messages[0].imageLoading, false);
  assert.equal(result?.messages[0].imagePrompt, 'castle');
  assert.equal(result?.imagesEnabled, false);
  assert.equal(decodeSave('{bad json'), null);
  assert.equal(decodeSave('{"version":999,"messages":[]}'), null);
});

test('Cloudflare uses structured JSON and normalizes image response', async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const provider = createProvider(
    { provider: 'cloudflare', accountId: 'a'.repeat(32), token: 'token' },
    async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return Response.json({
        success: true,
        result:
          calls.length === 1
            ? {
                response: JSON.stringify({
                  narrative: 'Bosque. ¿Qué haces?',
                  imagePrompt: 'forest',
                }),
              }
            : { image: '/9j/AA==' },
      });
    },
  );
  const story = await provider.story({
    isStart: true,
    userMessage: '',
    conversationHistory: [],
  });
  assert.equal(story.imagePrompt, 'forest');
  assert.deepEqual(calls[0].body.response_format, { type: 'json_object' });
  assert.match(calls[0].url, /llama-3\.3-70b/);
  const image = await provider.image('forest');
  assert.deepEqual(image, { base64Data: '/9j/AA==', mediaType: 'image/jpeg' });
  assert.match(calls[1].url, /flux-1-schnell/);
});

test('missing credentials and quota errors are actionable and safe', async () => {
  await assert.rejects(
    () =>
      createProvider({ provider: 'cloudflare' }).story({
        isStart: true,
        userMessage: '',
        conversationHistory: [],
      }),
    /CLOUDFLARE/,
  );
  const provider = createProvider(
    { provider: 'cloudflare', accountId: 'a'.repeat(32), token: 'do-not-leak' },
    async () =>
      Response.json(
        { errors: [{ message: 'do-not-leak quota exhausted' }] },
        { status: 429 },
      ),
  );
  await assert.rejects(
    () => provider.image('castle'),
    (error: unknown) =>
      error instanceof Error &&
      /cuota|límite/i.test(error.message) &&
      !error.message.includes('do-not-leak'),
  );
});

test('Ollama uses local chat, JSON format and no cloud credentials', async () => {
  const provider = createProvider(
    {
      provider: 'ollama',
      ollamaUrl: 'http://127.0.0.1:11434',
      ollamaModel: 'qwen3:4b',
    },
    async (url, init) => {
      assert.equal(String(url), 'http://127.0.0.1:11434/api/chat');
      assert.equal(JSON.parse(String(init?.body)).format, 'json');
      return Response.json({
        message: {
          content:
            '{"narrative":"Un castillo. ¿Entras?","imagePrompt":"castle"}',
        },
      });
    },
  );
  assert.equal(
    (
      await provider.story({
        isStart: true,
        userMessage: '',
        conversationHistory: [],
      })
    ).imagePrompt,
    'castle',
  );
});

test('Cloudflare accepts its parsed JSON response form', async () => {
  const provider = createProvider(
    { provider: 'cloudflare', accountId: 'a'.repeat(32), token: 'token' },
    async () =>
      Response.json({
        success: true,
        result: {
          response: { narrative: 'Un puente. ¿Cruzas?', imagePrompt: 'bridge' },
        },
      }),
  );
  assert.equal(
    (
      await provider.story({
        isStart: true,
        userMessage: '',
        conversationHistory: [],
      })
    ).imagePrompt,
    'bridge',
  );
});

test('routes reject wrong origin, invalid JSON and oversized body before AI', async () => {
  const request = (body: string, headers: Record<string, string> = {}) =>
    new Request('http://localhost/api/generate-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    });
  assert.equal(
    (await handleStory(request('{}', { Origin: 'https://other.example' })))
      .status,
    403,
  );
  assert.equal((await handleStory(request('{bad'))).status, 400);
  assert.equal((await handleStory(request('a'.repeat(66000)))).status, 413);
  assert.equal((await handleImage(request('{"imagePrompt":""}'))).status, 400);
});

test('origin uses the browser Host when Next rewrites its internal request URL', async () => {
  const request = new Request('http://localhost:3000/api/generate-story', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Host: '127.0.0.1:3000',
      Origin: 'http://127.0.0.1:3000',
    },
    body: '{"isStart":"invalid"}',
  });
  assert.equal((await handleStory(request)).status, 400);
});
