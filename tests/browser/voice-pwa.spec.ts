import { expect, type Page, test } from '@playwright/test';

const image = {
  base64Data:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK9sAAAAASUVORK5CYII=',
  mediaType: 'image/png',
};
async function setup(page: Page) {
  await page.route('**/api/config', (route) =>
    route.fulfill({
      json: {
        configured: true,
        imagesEnabled: true,
        voiceEnabled: true,
        provider: 'Cloudflare · Llama 3.3',
      },
    }),
  );
}
function silence() {
  const bytes = Buffer.alloc(44 + 32000);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24);
  bytes.writeUInt32LE(32000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(32000, 40);
  return bytes;
}
test('model label hidden; same scene reuses illustration, new location creates one', async ({
  page,
}) => {
  await setup(page);
  let stories = 0;
  let images = 0;
  await page.route('**/api/generate-story', (route) => {
    stories++;
    return route.fulfill({
      json: {
        narrative:
          stories === 1
            ? 'Estás ante una puerta.'
            : stories === 2
              ? 'El guardia te saluda.'
              : 'Llegas a un bosque.',
        question:
          stories === 1
            ? '¿Hablas con el guardia?'
            : stories === 2
              ? '¿Le preguntas por la llave?'
              : '¿Qué sendero sigues?',
        imagePrompt: stories < 3 ? 'castle gate' : 'forest',
        shouldIllustrate: stories !== 2,
      },
    });
  });
  await page.route('**/api/generate-image', (route) => {
    images++;
    return route.fulfill({ json: { image } });
  });
  await page.goto('/');
  await expect(
    page.getByText('Cloudflare · Llama 3.3', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('¿Hablas con el guardia?', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Tu próxima acción' })
    .fill('Saludo al guardia');
  await page.getByRole('button', { name: 'Enviar acción' }).click();
  await expect(
    page.getByText('¿Le preguntas por la llave?', { exact: false }),
  ).toBeVisible();
  expect(images).toBe(1);
  await page
    .getByRole('textbox', { name: 'Tu próxima acción' })
    .fill('Me marcho al bosque');
  await page.getByRole('button', { name: 'Enviar acción' }).click();
  await expect.poll(() => images).toBe(2);
});
test('voice speaks complete chat question, repeat reuses audio, reset stops it', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/generate-story', (route) =>
    route.fulfill({
      json: {
        narrative: 'La puerta se abre.',
        question: '¿Entras o esperas?',
        imagePrompt: 'door',
        shouldIllustrate: true,
      },
    }),
  );
  await page.route('**/api/generate-image', (route) =>
    route.fulfill({ json: { image } }),
  );
  let requests = 0;
  await page.route('**/api/narrate', (route) => {
    requests++;
    expect(route.request().postDataJSON().text).toContain('¿Entras o esperas?');
    expect(route.request().postDataJSON().text).not.toContain('imagePrompt');
    return route.fulfill({ body: silence(), contentType: 'audio/wav' });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Escuchar escena' }).click();
  await expect(page.getByLabel('Audio de la escena')).toHaveAttribute(
    'src',
    /^blob:/,
  );
  await page.getByRole('button', { name: 'Detener narración' }).click();
  await page.getByRole('button', { name: 'Escuchar escena' }).click();
  expect(requests).toBe(1);
  await page
    .getByLabel('Voz del narrador', { exact: true })
    .selectOption('device');
  await expect(page.getByLabel('Audio de la escena')).not.toHaveAttribute(
    'src',
    /^blob:/,
  );
  await page
    .getByLabel('Voz del narrador', { exact: true })
    .selectOption('nestor');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Nueva aventura' }).click();
  await expect
    .poll(() =>
      page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused),
    )
    .toBeTruthy();
  const cachedUrls = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys
          .filter((key) => key.startsWith('dnd-shell-'))
          .map(async (key) =>
            (
              await (await caches.open(key)).keys()
            ).map((request) => request.url),
          ),
      )
    ).flat();
  });
  expect(
    cachedUrls.every((url) => !new URL(url).pathname.startsWith('/api/')),
  ).toBeTruthy();
});

test('cancelled playback promise cannot restore old status after a new adventure', async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () =>
      new Promise<void>((_resolve, reject) => {
        (
          window as unknown as { rejectNarration: (reason: Error) => void }
        ).rejectNarration = reject;
      });
  });
  await setup(page);
  await page.route('**/api/generate-story', (route) =>
    route.fulfill({
      json: {
        narrative: 'Una puerta.',
        question: '¿Entras?',
        imagePrompt: 'door',
        shouldIllustrate: true,
      },
    }),
  );
  await page.route('**/api/generate-image', (route) =>
    route.fulfill({ json: { image } }),
  );
  await page.route('**/api/narrate', (route) =>
    route.fulfill({ body: silence(), contentType: 'audio/wav' }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Escuchar escena' }).click();
  await expect(page.getByLabel('Audio de la escena')).toHaveAttribute(
    'src',
    /^blob:/,
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Nueva aventura' }).click();
  await page.evaluate(() =>
    (
      window as unknown as { rejectNarration: (reason: Error) => void }
    ).rejectNarration(new DOMException('interrupted', 'AbortError')),
  );
  await expect(
    page.getByText('Pulsa reproducir en el audio para comenzar.'),
  ).toHaveCount(0);
});
test('mobile manifest and offline reload preserve saved chat without API caching', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await setup(page);
  await page.route('**/api/generate-story', (route) =>
    route.fulfill({
      json: {
        narrative: 'Una cueva silenciosa.',
        question: '¿Enciendes una antorcha?',
        imagePrompt: 'cave',
        shouldIllustrate: true,
      },
    }),
  );
  await page.route('**/api/generate-image', (route) =>
    route.fulfill({ json: { image } }),
  );
  await page.goto('/');
  await expect(
    page.getByText('Una cueva silenciosa.', { exact: false }),
  ).toBeVisible();
  const manifest = await (
    await page.request.get('/manifest.webmanifest')
  ).json();
  expect(manifest.display).toBe('standalone');
  expect(
    manifest.icons.some((icon: { sizes: string }) => icon.sizes === '512x512'),
  ).toBeTruthy();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(async () =>
        (await caches.keys()).some((key) => key.startsWith('dnd-shell-')),
      ),
    )
    .toBeTruthy();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const keys = await caches.keys();
        const urls = (
          await Promise.all(
            keys
              .filter((key) => key.startsWith('dnd-shell-'))
              .map(async (key) =>
                (
                  await (await caches.open(key)).keys()
                ).map((request) => request.url),
              ),
          )
        ).flat();
        return urls.some(
          (url) => url.includes('/_next/static/') && url.endsWith('.js'),
        );
      }),
    )
    .toBeTruthy();
  await page.unroute('**/api/config');
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByText('Una cueva silenciosa.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText('Sin conexión', { exact: false }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await context.setOffline(false);
});
