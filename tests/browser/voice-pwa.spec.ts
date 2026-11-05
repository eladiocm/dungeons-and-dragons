import { expect, type Page, test } from '@playwright/test';
import { create, quiet } from './helpers';

// Separate virtual clients retain the real server rate limit.
test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.13' } });

function silence() {
  const b = Buffer.alloc(44 + 64000);
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(64000, 40);
  return b;
}
async function voice(page: Page) {
  await page.route('**/api/config', (r) =>
    r.fulfill({
      json: { configured: true, imagesEnabled: false, voiceEnabled: true },
    }),
  );
  await page.route('**/speech', (r) =>
    r.fulfill({ contentType: 'audio/wav', body: silence() }),
  );
}

test('narration automatically starts after explicit game start with word tracking and pauses', async ({
  page,
}) => {
  await voice(page);
  let calls = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/speech')) calls++;
  });
  await page.goto('/');
  expect(calls).toBe(0);
  await create(page);
  await expect(
    page.getByRole('button', { name: 'Pausar narración' }),
  ).toBeVisible();
  await expect(page.locator('.spoken-word.active')).toHaveCount(1);
  await page.getByRole('button', { name: 'Pausar narración' }).click();
  const word = await page
    .locator('.spoken-word.active')
    .getAttribute('data-word');
  await page.waitForTimeout(350);
  expect(
    await page.locator('.spoken-word.active').getAttribute('data-word'),
  ).toBe(word);
  await page.getByRole('button', { name: 'Reproducir narración' }).click();
  await expect(
    page.getByRole('button', { name: 'Pausar narración' }),
  ).toBeVisible();
  expect(calls).toBe(1);
});
test('automatic narration preference stays disabled and replay uses cached audio', async ({
  page,
}) => {
  await voice(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      'dnd-voice-v2',
      JSON.stringify({ automatic: false, voice: 'nestor' }),
    ),
  );
  let calls = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/speech')) calls++;
  });
  await create(page);
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Reproducir narración' }).click();
  await expect(
    page.getByRole('button', { name: 'Pausar narración' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Detener narración' }).click();
  await page.getByRole('button', { name: 'Repetir narración' }).click();
  await expect(
    page.getByRole('button', { name: 'Pausar narración' }),
  ).toBeVisible();
  expect(calls).toBe(1);
});
test('stopped playback cannot restart when an older play promise resolves', async ({
  page,
}) => {
  await voice(page);
  await page.addInitScript(() => {
    const w = window as unknown as {
      Audio: unknown;
      lateAudio: unknown;
      resolvePlay?: () => void;
    };
    w.Audio = class {
      src = '';
      preload = 'none';
      paused = true;
      duration = 60;
      currentTime = 0;
      volume = 1;
      playbackRate = 1;
      onended: unknown;
      ontimeupdate: unknown;
      onloadedmetadata: unknown;
      onerror: unknown;
      constructor() {
        w.lateAudio = this;
      }
      play() {
        return new Promise<void>((resolve) => {
          w.resolvePlay = () => {
            this.paused = false;
            resolve();
          };
        });
      }
      pause() {
        this.paused = true;
      }
      removeAttribute() {}
      load() {}
    };
  });
  await create(page);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (window as unknown as { resolvePlay?: () => void }).resolvePlay,
        ),
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Detener narración' }).click();
  await page.evaluate(() =>
    (window as unknown as { resolvePlay: () => void }).resolvePlay(),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { lateAudio: { paused: boolean } }).lateAudio
            .paused,
      ),
    )
    .toBe(true);
  await expect(page.locator('.spoken-word.active')).toHaveCount(0);
});
test('hold microphone transcribes into editable draft and never sends on release or a late result', async ({
  page,
}) => {
  await quiet(page);
  await page.addInitScript(() => {
    class Recognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((v: unknown) => void) | null = null;
      onerror = null;
      onend = null;
      constructor() {
        (window as unknown as { recognition: unknown }).recognition = this;
      }
      start() {}
      stop() {}
      abort() {}
    }
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition =
      Recognition;
  });
  await create(page);
  let intents = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/intent')) intents++;
  });
  await page.getByLabel('Tu acción').fill('Primero');
  const mic = page.getByRole('button', { name: 'Mantén pulsado para dictar' }),
    box = await mic.boundingBox();
  if (!box) throw new Error('mic missing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.evaluate(() =>
    (
      window as unknown as { recognition: { onresult: (v: unknown) => void } }
    ).recognition.onresult({ results: [[{ transcript: 'examino el mapa' }]] }),
  );
  await expect(page.getByLabel('Tu acción')).toHaveValue(
    'Primero examino el mapa',
  );
  await page.mouse.up();
  await page.evaluate(() =>
    (
      window as unknown as { recognition: { onresult: (v: unknown) => void } }
    ).recognition.onresult({
      results: [[{ transcript: 'resultado atrasado' }]],
    }),
  );
  await expect(page.getByLabel('Tu acción')).toHaveValue(
    'Primero examino el mapa',
  );
  expect(intents).toBe(0);
  await page.getByLabel('Tu acción').fill('Examino el mapa corregido');
  await page.getByRole('button', { name: 'Enviar acción' }).click();
  await expect(page.locator('.chat-message.user')).toHaveText(
    /Examino el mapa corregido/,
  );
  expect(intents).toBe(1);
});
test('release before microphone permission stops the granted stream and no transcription runs', async ({
  page,
}) => {
  await quiet(page);
  await page.addInitScript(() => {
    const w = window as unknown as {
      SpeechRecognition: unknown;
      webkitSpeechRecognition: unknown;
      grant?: () => void;
      stops: number;
    };
    w.SpeechRecognition = undefined;
    w.webkitSpeechRecognition = undefined;
    w.stops = 0;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () =>
          new Promise((resolve) => {
            w.grant = () =>
              resolve({
                getTracks: () => [
                  {
                    stop() {
                      w.stops++;
                    },
                  },
                ],
              });
          }),
      },
      configurable: true,
    });
  });
  await create(page);
  const mic = page.getByRole('button', { name: 'Mantén pulsado para dictar' });
  await mic.focus();
  await page.keyboard.down('Space');
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean((window as unknown as { grant?: () => void }).grant),
      ),
    )
    .toBe(true);
  await page.keyboard.up('Space');
  await page.evaluate(() =>
    (window as unknown as { grant: () => void }).grant(),
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { stops: number }).stops),
    )
    .toBe(1);
  await expect(page.getByLabel('Tu acción')).toHaveValue('');
});
test('PWA install stays inside menu and service worker never caches private API responses', async ({
  page,
}) => {
  await quiet(page);
  await create(page);
  await page.getByLabel('Menú de partida').click();
  await page.getByText('Instalar en móvil', { exact: true }).click();
  await expect(
    page.getByText(/iPhone: abre esta página en Safari/),
  ).toBeVisible();
  const paths = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const names = await caches.keys();
    return (
      await Promise.all(
        names.map(async (n) =>
          (
            await (await caches.open(n)).keys()
          ).map((r) => new URL(r.url).pathname),
        ),
      )
    ).flat();
  });
  expect(paths.some((p) => p.startsWith('/api/'))).toBe(false);
  expect(paths).toContain('/scenes/square.svg');
});

test('recorded fallback transcribes only after release and leaves the result unsent', async ({
  page,
}) => {
  await quiet(page);
  const recording = silence().toString('base64');
  await page.addInitScript((base64) => {
    const w = window as unknown as {
      SpeechRecognition: unknown;
      webkitSpeechRecognition: unknown;
      MediaRecorder: unknown;
    };
    w.SpeechRecognition = undefined;
    w.webkitSpeechRecognition = undefined;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
      },
      configurable: true,
    });
    w.MediaRecorder = class {
      static isTypeSupported() {
        return true;
      }
      state = 'inactive';
      ondataavailable: ((e: unknown) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        setTimeout(() => {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          this.ondataavailable?.({
            data: new Blob([bytes], { type: 'audio/wav' }),
          });
          this.onstop?.();
        }, 30);
      }
    };
  }, recording);
  let transcriptions = 0,
    intents = 0;
  await page.route('**/transcribe', (route) => {
    transcriptions++;
    const audio = Buffer.from(route.request().postDataJSON().audio, 'base64');
    expect(audio.toString('ascii', 0, 4)).toBe('RIFF');
    return route.fulfill({ json: { text: 'Examino la ventana lateral' } });
  });
  page.on('request', (r) => {
    if (r.url().endsWith('/intent')) intents++;
  });
  await create(page);
  const box = await page
    .getByRole('button', { name: 'Mantén pulsado para dictar' })
    .boundingBox();
  if (!box) throw new Error('mic missing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByText(/Grabando… Se transcribirá/)).toBeVisible();
  expect(transcriptions).toBe(0);
  await page.mouse.up();
  await expect(page.getByLabel('Tu acción')).toHaveValue(
    'Examino la ventana lateral',
  );
  expect(transcriptions).toBe(1);
  expect(intents).toBe(0);
});

test('speech quota failure leaves text intact and does not retry automatically', async ({
  page,
}) => {
  await voice(page);
  await page.unroute('**/speech');
  let calls = 0;
  await page.route('**/speech', (route) => {
    calls++;
    return route.fulfill({
      status: 429,
      json: {
        error:
          'La cuota de voz se ha agotado. Puedes usar la voz del dispositivo.',
      },
    });
  });
  await create(page);
  await expect(page.getByText(/La cuota de voz se ha agotado/)).toBeVisible();
  await expect(page.locator('.chat-message.assistant')).toContainText(
    'Valdumbría',
  );
  expect(calls).toBe(1);
});

test('a queued audio progress event cannot move the highlighted word while paused', async ({
  page,
}) => {
  await voice(page);
  await page.addInitScript(() => {
    const w = window as unknown as {
      Audio: unknown;
      narrationAudio: { flushProgress: () => void };
    };
    w.Audio = class {
      src = '';
      preload = 'none';
      paused = true;
      duration = 2;
      currentTime = 0;
      volume = 1;
      playbackRate = 1;
      onended: unknown;
      onloadedmetadata: unknown;
      onerror: unknown;
      ontimeupdate?: () => void;
      constructor() {
        w.narrationAudio = this;
      }
      play() {
        this.paused = false;
        return Promise.resolve();
      }
      pause() {
        this.paused = true;
      }
      flushProgress() {
        this.currentTime = 1;
        this.ontimeupdate?.();
      }
    };
  });
  await create(page);
  await page.getByRole('button', { name: 'Pausar narración' }).click();
  await expect(page.locator('.spoken-word.active')).toHaveAttribute(
    'data-word',
    '0',
  );
  await page.evaluate(() =>
    (
      window as unknown as { narrationAudio: { flushProgress: () => void } }
    ).narrationAudio.flushProgress(),
  );
  await expect(page.locator('.spoken-word.active')).toHaveAttribute(
    'data-word',
    '0',
  );
  await page.getByRole('button', { name: 'Reproducir narración' }).click();
  await page.evaluate(() =>
    (
      window as unknown as { narrationAudio: { flushProgress: () => void } }
    ).narrationAudio.flushProgress(),
  );
  await expect(page.locator('.spoken-word.active')).not.toHaveAttribute(
    'data-word',
    '0',
  );
});
