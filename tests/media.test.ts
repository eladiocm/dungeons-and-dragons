import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { suggestCharacter } from '../src/game/character.ts';
import { encodeWav } from '../src/lib/recording.ts';
import { GameService } from '../src/server/game-service.ts';
import { createMediaApi } from '../src/server/media-api.ts';
import { SessionStore } from '../src/server/session-store.ts';
import { createTranscriber } from '../src/server/transcription.ts';

test('scene and speech use authorized IDs and reject raw prompts or text without provider calls', async () => {
  const store = new SessionStore(':memory:');
  let images = 0,
    speeches = 0;
  const service = new GameService(store),
    token = 'a'.repeat(43),
    owner = createHash('sha256').update(token).digest('hex');
  const state = (
    await service.create(owner, 'create', suggestCharacter('fighter'))
  ).session;
  const api = createMediaApi(service, {
    image: async (prompt) => {
      images++;
      assert.match(prompt, /village square/);
      return { base64Data: 'aGVsbG8=', mediaType: 'image/jpeg' };
    },
    speech: async (input) => {
      speeches++;
      assert.match(input.text, /Valdumbría/);
      return new Uint8Array([1, 2, 3]);
    },
    transcribe: async () => 'Avanzo hacia la puerta',
  });
  const req = (body: unknown, cookie = true) =>
    new Request('http://localhost:3000/api/media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: `dnd_owner=${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (
        await api.image(
          req({ sceneRevision: state.world.sceneRevision, prompt: 'evil' }),
          state.id,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await api.image(
          req({ sceneRevision: state.world.sceneRevision }, false),
          state.id,
        )
      ).status,
      404,
    );
    assert.equal(images, 0);
    assert.equal(
      (
        await api.image(
          req({ sceneRevision: state.world.sceneRevision }),
          state.id,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await api.image(
          req({ sceneRevision: state.world.sceneRevision }),
          state.id,
        )
      ).status,
      200,
    );
    assert.equal(images, 1);
    assert.equal(
      (
        await api.speech(
          req({
            messageId: state.messages[0].id,
            chunkIndex: 0,
            speaker: 'nestor',
            text: 'evil',
          }),
          state.id,
        )
      ).status,
      400,
    );
    assert.equal(speeches, 0);
    assert.equal(
      (
        await api.speech(
          req({
            messageId: state.messages[0].id,
            chunkIndex: 0,
            speaker: 'nestor',
          }),
          state.id,
        )
      ).status,
      200,
    );
    // A different API instance (cold function) must reuse persisted speech.
    const cold = createMediaApi(new GameService(store), {
      image: async () => {
        throw Error('unexpected image inference');
      },
      speech: async () => {
        throw Error('unexpected repeated speech inference');
      },
      transcribe: async () => '',
    });
    const cachedAudio = await cold.speech(
      req({
        messageId: state.messages[0].id,
        chunkIndex: 0,
        speaker: 'nestor',
      }),
      state.id,
    );
    assert.equal(cachedAudio.status, 200);
    assert.deepEqual(
      new Uint8Array(await cachedAudio.arrayBuffer()),
      new Uint8Array([1, 2, 3]),
    );
    assert.equal(speeches, 1);
  } finally {
    store.close();
  }
});
test('recording limit comes from actual WAV duration and malformed audio never reaches Whisper', async () => {
  let calls = 0;
  const transcribe = createTranscriber(
    { accountId: 'a'.repeat(32), token: 'secret' },
    async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.language, 'es');
      assert.ok(body.audio);
      return Response.json({
        success: true,
        result: { text: 'Examino la palanca.' },
      });
    },
  );
  const audio = (seconds: number) =>
    Buffer.from(encodeWav(new Float32Array(16000 * seconds), 16000)).toString(
      'base64',
    );
  await assert.rejects(transcribe('bm90IGF1ZGlv'));
  assert.equal(calls, 0);
  await assert.rejects(transcribe(audio(46)));
  assert.equal(calls, 0);
  assert.equal(await transcribe(audio(1)), 'Examino la palanca.');
  assert.equal(calls, 1);
});
