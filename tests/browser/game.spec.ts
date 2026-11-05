import { expect, type Page, test } from '@playwright/test';

async function configure(page: Page) {
  await page.route('**/api/config', (route) =>
    route.fulfill({
      json: {
        provider: 'Prueba simulada',
        configured: true,
        imagesEnabled: true,
      },
    }),
  );
}
const image = {
  base64Data:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK9sAAAAASUVORK5CYII=',
  mediaType: 'image/png',
};

test('one initial scene, turn sends text only, reload restores without AI calls', async ({
  page,
}) => {
  await configure(page);
  let calls = 0;
  await page.route('**/api/generate-story', async (route) => {
    calls++;
    const body = route.request().postDataJSON();
    if (!body.isStart) {
      expect(body.userMessage).toBe('Abro la puerta');
      expect(JSON.stringify(body.conversationHistory)).not.toContain('base64');
      expect(body.conversationHistory[0]).toEqual({
        role: 'assistant',
        content: 'Hay una puerta. ¿Qué haces?',
      });
    }
    await route.fulfill({
      json: {
        narrative:
          calls === 1
            ? 'Hay una puerta. ¿Qué haces?'
            : 'La puerta se abre. ¿Entras?',
        imagePrompt: 'castle door',
      },
    });
  });
  await page.route('**/api/generate-image', (route) =>
    route.fulfill({ json: { image } }),
  );
  await page.goto('/');
  await expect(page.getByText('Hay una puerta. ¿Qué haces?')).toBeVisible();
  await expect(page.getByRole('img', { name: 'castle door' })).toBeVisible();
  expect(calls).toBe(1);
  await page
    .getByRole('textbox', { name: 'Tu próxima acción' })
    .fill('Abro la puerta');
  await page.getByRole('button', { name: 'Enviar acción' }).click();
  await expect(page.getByText('La puerta se abre. ¿Entras?')).toBeVisible();
  await page.reload();
  await expect(page.getByText('La puerta se abre. ¿Entras?')).toBeVisible();
  expect(calls).toBe(2);
});

test('failed story retries once without duplicated user message', async ({
  page,
}) => {
  await configure(page);
  let calls = 0;
  await page.route('**/api/generate-story', (route) => {
    calls++;
    return calls === 2
      ? route.fulfill({
          status: 429,
          json: { error: 'Cuota gratuita agotada' },
        })
      : route.fulfill({
          json: {
            narrative:
              calls === 1 ? 'Un bosque. ¿Qué haces?' : 'Encuentras un sendero.',
            imagePrompt: 'forest',
          },
        });
  });
  await page.route('**/api/generate-image', (route) =>
    route.fulfill({ json: { image } }),
  );
  await page.goto('/');
  await expect(page.getByText('Un bosque. ¿Qué haces?')).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Tu próxima acción' })
    .fill('Busco un sendero');
  await page.getByRole('button', { name: 'Enviar acción' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Cuota gratuita agotada',
  );
  await page.getByRole('button', { name: 'Reintentar escena' }).click();
  await expect(page.getByText('Encuentras un sendero.')).toBeVisible();
  await expect(page.getByText('Busco un sendero', { exact: true })).toHaveCount(
    1,
  );
});

test('image failure does not block story and retries independently', async ({
  page,
}) => {
  await configure(page);
  let stories = 0;
  let images = 0;
  await page.route('**/api/generate-story', (route) => {
    stories++;
    return route.fulfill({
      json: { narrative: 'Una torre. ¿Subes?', imagePrompt: 'tower' },
    });
  });
  await page.route('**/api/generate-image', (route) => {
    images++;
    return images === 1
      ? route.fulfill({ status: 503, json: { error: 'Imagen no disponible' } })
      : route.fulfill({ json: { image } });
  });
  await page.goto('/');
  await expect(page.getByText('Una torre. ¿Subes?')).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar imagen' }).click();
  await expect(page.getByRole('img', { name: 'tower' })).toBeVisible();
  expect(stories).toBe(1);
  expect(images).toBe(2);
});

test('reset cancels old scene and mobile layout fits viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await configure(page);
  let calls = 0;
  await page.route('**/api/generate-story', async (route) => {
    calls++;
    const first = calls === 1;
    if (first) await new Promise((resolve) => setTimeout(resolve, 500));
    await route
      .fulfill({
        json: {
          narrative: first ? 'Escena antigua' : 'Escena nueva',
          imagePrompt: 'forest',
        },
      })
      .catch(() => {});
  });
  await page.route('**/api/generate-image', (route) =>
    route.fulfill({ json: { image } }),
  );
  await page.goto('/');
  await expect.poll(() => calls).toBe(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Nueva aventura' }).click();
  await expect(page.getByText('Escena nueva')).toBeVisible();
  await expect(page.getByText('Escena antigua')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test('missing credentials shows configuration error without a request storm', async ({
  page,
}) => {
  await page.route('**/api/config', (route) =>
    route.fulfill({
      json: {
        provider: 'Cloudflare',
        configured: false,
        imagesEnabled: false,
        message: 'Falta configurar CLOUDFLARE_API_TOKEN',
      },
    }),
  );
  let stories = 0;
  await page.route('**/api/generate-story', (route) => {
    stories++;
    return route.abort();
  });
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'CLOUDFLARE_API_TOKEN',
  );
  expect(stories).toBe(0);
});
