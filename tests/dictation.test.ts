import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DictationController,
  type RecognitionLike,
  type RecorderLike,
} from '../src/lib/dictation.ts';

const tick = () => new Promise((r) => setTimeout(r, 0));
function recognition(): RecognitionLike {
  return {
    lang: '',
    continuous: false,
    interimResults: false,
    onresult: null,
    onerror: null,
    onend: null,
    start() {},
    stop() {},
    abort() {},
  };
}
test('hold dictation updates a draft and release rejects late recognition results without sending', async () => {
  let draft = 'Abro la puerta y';
  const r = recognition();
  const controller = new DictationController(
    { recognition: () => r },
    (v) => {
      draft = v;
    },
    () => {},
  );
  await controller.start(draft);
  r.onresult?.({ results: [[{ transcript: 'examino el pasillo' }]] });
  assert.equal(draft, 'Abro la puerta y examino el pasillo');
  controller.stop();
  r.onresult?.({ results: [[{ transcript: 'mensaje atrasado' }]] });
  assert.equal(draft, 'Abro la puerta y examino el pasillo');
  controller.cancel();
});
test('releasing before microphone permission resolves immediately stops late streams', async () => {
  let resolve!: (stream: MediaStream) => void,
    stops = 0,
    recorders = 0;
  const c = new DictationController(
    {
      stream: () =>
        new Promise((r) => {
          resolve = r;
        }),
      recorder: () => {
        recorders++;
        throw new Error('must not record');
      },
      encode: async () => '',
      transcribe: async () => '',
    },
    () => {
      throw new Error('draft changed');
    },
    () => {},
  );
  const pending = c.start('Texto escrito');
  c.stop();
  resolve({
    getTracks: () => [
      {
        stop() {
          stops++;
        },
      },
    ],
  } as unknown as MediaStream);
  await pending;
  assert.equal(stops, 1);
  assert.equal(recorders, 0);
  c.cancel();
});

test('late stop from a cancelled recorder cannot stop a newer microphone stream', async () => {
  let stopped = 0;
  const recorders: RecorderLike[] = [];
  const c = new DictationController(
    {
      stream: async () =>
        ({
          getTracks: () => [
            {
              stop() {
                stopped++;
              },
            },
          ],
        }) as unknown as MediaStream,
      recorder: () => {
        const r: RecorderLike = {
          state: 'inactive',
          ondataavailable: null,
          onstop: null,
          start() {
            this.state = 'recording';
          },
          stop() {
            this.state = 'inactive';
          },
        };
        recorders.push(r);
        return r;
      },
      encode: async () => '',
      transcribe: async () => '',
    },
    () => {},
    () => {},
  );
  await c.start('');
  c.cancel();
  await c.start('');
  const before = stopped;
  recorders[0].onstop?.();
  assert.equal(stopped, before);
  c.cancel();
});
test('recorded transcription waits for release and cancellation discards an old transcript', async () => {
  let transcriptions = 0,
    resolve!: (text: string) => void,
    draft = 'Miro';
  const recorder: RecorderLike = {
    state: 'inactive',
    ondataavailable: null,
    onstop: null,
    start() {
      this.state = 'recording';
    },
    stop() {
      this.state = 'inactive';
      this.ondataavailable?.({ data: new Blob(['audio']) });
      this.onstop?.();
    },
  };
  const c = new DictationController(
    {
      stream: async () =>
        ({ getTracks: () => [{ stop() {} }] }) as unknown as MediaStream,
      recorder: () => recorder,
      encode: async () => 'audio',
      transcribe: () => {
        transcriptions++;
        return new Promise((r) => {
          resolve = r;
        });
      },
    },
    (v) => {
      draft = v;
    },
    () => {},
  );
  await c.start(draft);
  assert.equal(transcriptions, 0);
  c.stop();
  c.stop(); // pointerup followed by lostpointercapture must be harmless.
  await tick();
  assert.equal(transcriptions, 1);
  c.cancel();
  draft = 'Nuevo borrador';
  resolve('un resultado viejo');
  await tick();
  assert.equal(draft, 'Nuevo borrador');
});
