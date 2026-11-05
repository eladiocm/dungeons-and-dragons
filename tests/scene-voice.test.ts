import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  composeNarrative,
  createSceneMessage,
  decodeSave,
  encodeSave,
  parseStoryResponse,
} from '../src/lib/game-contract.ts';
import {
  splitSpeechText,
  validateSpeechRequest,
} from '../src/lib/speech-contract.ts';
import { createSpeechService } from '../src/lib/voice-provider.ts';

test('question is part of narrated chat, contextual if supplied and never duplicated', () => {
  assert.equal(
    composeNarrative('Una puerta se abre.', '¿Entras o esperas?'),
    'Una puerta se abre.\n\n¿Entras o esperas?',
  );
  assert.equal(
    composeNarrative('Una puerta. ¿Entras?', '¿Entras?'),
    'Una puerta. ¿Entras?',
  );
  assert.match(composeNarrative('Una puerta.'), /¿Qué decides hacer\?$/);
  assert.equal(
    composeNarrative('Un bosque. ¿Qué examinas?'),
    'Un bosque. ¿Qué examinas?',
  );
});
test('visual continuation preserves scene without requesting a new illustration', () => {
  const first = createSceneMessage(
    'first',
    {
      narrative: 'Una torre.',
      question: '¿Subes?',
      imagePrompt: 'tower',
      shouldIllustrate: true,
    },
    [],
  );
  const continuation = createSceneMessage(
    'second',
    {
      narrative: 'La escalera cruje.',
      imagePrompt: 'same tower',
      shouldIllustrate: false,
    },
    [first],
  );
  assert.equal(continuation.sceneId, first.id);
  assert.equal(continuation.illustration, 'reuse');
  assert.equal(continuation.imagePrompt, 'tower');
  const next = createSceneMessage(
    'third',
    {
      narrative: 'Sales al bosque.',
      imagePrompt: 'forest',
      shouldIllustrate: true,
    },
    [first, continuation],
  );
  assert.equal(next.sceneId, next.id);
  assert.equal(next.illustration, 'new');
});
test('first scene always owns an illustration; saves preserve scene ownership', () => {
  const first = createSceneMessage(
    'first',
    { narrative: 'Una torre.', imagePrompt: 'tower', shouldIllustrate: false },
    [],
  );
  assert.equal(first.illustration, 'new');
  const second = createSceneMessage(
    'second',
    { narrative: 'Sigues ahí.', imagePrompt: 'tower', shouldIllustrate: false },
    [first],
  );
  const saved = decodeSave(encodeSave([first, second], true));
  assert.equal(saved?.messages[1].sceneId, first.id);
  assert.equal(saved?.messages[1].illustration, 'reuse');
  const legacy = decodeSave(
    '{"version":1,"imagesEnabled":true,"messages":[{"id":"old","role":"assistant","content":"Una cueva.","imagePrompt":"cave"}]}',
  );
  assert.match(legacy?.messages[0].content || '', /\?$/);
  assert.equal(legacy?.messages[0].illustration, 'new');
});
test('model response normalizes explicit question and visual decision', () => {
  const value = parseStoryResponse({
    narrative: 'El guardia responde.',
    question: '¿Le crees?',
    imagePrompt: 'same gate',
    shouldIllustrate: false,
  });
  assert.match(value.narrative, /¿Le crees\?$/);
  assert.equal(value.shouldIllustrate, false);
});
test('speech chunks preserve all text and respect service limit', () => {
  const original = 'Una sombra avanza por el corredor. ¿Te escondes? '
    .repeat(100)
    .trim();
  const chunks = splitSpeechText(original);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 1800));
  assert.equal(chunks.join(' '), original);
  assert.throws(() =>
    validateSpeechRequest({ text: 'a'.repeat(1801), speaker: 'nestor' }),
  );
  assert.throws(() =>
    validateSpeechRequest({ text: 'Hola', speaker: 'not-a-voice' }),
  );
  assert.equal(
    validateSpeechRequest({ text: 'Una puerta. ¿Entras?', speaker: 'nestor' })
      .text,
    'Una puerta. ¿Entras?',
  );
});
test('speech service returns actual audio bytes and caches repeated segments', async () => {
  let calls = 0;
  const service = createSpeechService(
    { accountId: 'a'.repeat(32), token: 'token' },
    async (url, init) => {
      calls++;
      assert.match(String(url), /aura-2-es/);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.speaker, 'nestor');
      assert.equal(body.encoding, 'mp3');
      assert.match(body.text, /¿Entras\?$/);
      return new Response(new Uint8Array([73, 68, 51, 0, 0]), {
        headers: { 'Content-Type': 'audio/mpeg' },
      });
    },
  );
  const input = { text: 'Una puerta. ¿Entras?', speaker: 'nestor' as const };
  assert.equal((await service.synthesize(input)).byteLength, 5);
  await service.synthesize(input);
  assert.equal(calls, 1);
});
test('speech rejects provider errors without leaking token', async () => {
  const service = createSpeechService(
    { accountId: 'a'.repeat(32), token: 'secret-token' },
    async () => Response.json({ message: 'secret-token' }, { status: 429 }),
  );
  await assert.rejects(
    () => service.synthesize({ text: 'Una escena.', speaker: 'nestor' }),
    (error: unknown) =>
      error instanceof Error &&
      /cuota|límite/.test(error.message) &&
      !error.message.includes('secret-token'),
  );
});

test('saving and restoring keeps a long contextual question and all legacy prose', () => {
  const content = `${'a'.repeat(5500)}\n\n¿Abres la puerta o te escondes?`;
  const restored = decodeSave(
    encodeSave(
      [{ id: 'long', role: 'assistant', content, imagePrompt: 'door' }],
      true,
    ),
  );
  assert.equal(restored?.messages[0].content, content);
  const oldContent = 'b'.repeat(6000);
  const legacy = decodeSave(
    JSON.stringify({
      version: 1,
      imagesEnabled: true,
      messages: [{ id: 'legacy', role: 'assistant', content: oldContent }],
    }),
  );
  assert.ok(legacy?.messages[0].content.startsWith(oldContent));
  assert.equal(
    decodeSave(encodeSave(legacy?.messages || [], true))?.messages[0].content,
    legacy?.messages[0].content,
  );
});
