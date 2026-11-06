import { expect, test } from '@playwright/test';
import { action, create, image, quiet } from './helpers';

// Separate virtual clients retain the real server rate limit.
test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.11' } });

test('loading does not start a game and reloading a private game does not call AI again', async ({
  page,
}) => {
  await quiet(page);
  let calls = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/narrative') || r.url().endsWith('/intent')) calls++;
  });
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Crear personaje' }),
  ).toBeVisible();
  expect(calls).toBe(0);
  await create(page);
  const before = calls;
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'El refugio de Valdumbría' }),
  ).toBeVisible();
  expect(calls).toBe(before);
});
test('lost response retries the same command without duplicated action and clears only the submitted draft', async ({
  page,
}) => {
  await quiet(page);
  await create(page);
  let requests = 0;
  const ids: string[] = [];
  await page.route('**/intent', async (route) => {
    requests++;
    ids.push(route.request().postDataJSON().id);
    if (requests === 1) {
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await action(page, 'Voy al camino');
  await expect(
    page.getByRole('button', { name: 'Reintentar la misma acción' }),
  ).toBeVisible();
  await expect(page.getByLabel('Tu acción')).toHaveValue('Voy al camino');
  await page
    .getByRole('button', { name: 'Reintentar la misma acción' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'El camino anegado' }),
  ).toBeVisible();
  await expect(page.getByLabel('Tu acción')).toHaveValue('');
  expect(ids[0]).toBe(ids[1]);
  await expect(page.locator('.chat-message.user')).toHaveCount(1);
});
test('illustration failure leaves scene playable and retry reloads from persistent image cache', async ({
  page,
}) => {
  await quiet(page, true);
  let calls = 0;
  await page.route('**/image', (route) => {
    calls++;
    return route.fulfill(
      calls === 1
        ? { status: 502, json: { error: 'Imagen temporalmente no disponible' } }
        : { json: { image } },
    );
  });
  await create(page);
  await expect(
    page.getByRole('button', { name: 'Reintentar ilustración' }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Ilustración de/ }),
  ).toHaveAttribute('src', '/scenes/square.svg');
  await page.getByRole('button', { name: 'Reintentar ilustración' }).click();
  await expect(
    page.getByRole('img', { name: /Ilustración de/ }),
  ).toHaveAttribute('src', /^data:/);
  await action(page, 'Examino el mapa');
  expect(calls).toBe(2);
  await page.reload();
  await expect(
    page.getByRole('img', { name: /Ilustración de/ }),
  ).toHaveAttribute('src', /^data:/);
  expect(calls).toBe(2);
});
test('new game preserves the previous save and old illustrations cannot enter the creator', async ({
  page,
}) => {
  await quiet(page);
  await create(page);
  await page.getByLabel('Menú de partida').click();
  await page
    .getByRole('button', { name: 'Nueva partida', exact: true })
    .click();
  await page.getByRole('button', { name: 'Crear otra partida' }).click();
  await expect(
    page.getByRole('heading', { name: 'Da forma a tu aventurero' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Continúa tu historia' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Aren La última luz/ }).click();
  await expect(
    page.getByRole('heading', { name: 'El refugio de Valdumbría' }),
  ).toBeVisible();
});
test('unavailable Master keeps draft and resources and has no request storm', async ({
  page,
}) => {
  await quiet(page);
  await create(page);
  let calls = 0;
  await page.route('**/intent', (route) => {
    calls++;
    return route.fulfill({
      status: 429,
      json: { error: 'Cuota agotada. Reintenta después.' },
    });
  });
  await action(page, 'Examino el mapa');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Cuota agotada',
  );
  await expect(page.getByLabel('Tu acción')).toHaveValue('Examino el mapa');
  expect(calls).toBe(1);
  await expect(page.locator('.health strong')).toContainText('12');
});
test('legacy adventure stays readable and a cached new game is read only offline', async ({
  page,
  context,
}) => {
  await quiet(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      'dnd-adventure-v1',
      JSON.stringify({
        version: 1,
        imagesEnabled: false,
        messages: [
          {
            id: 'old',
            role: 'assistant',
            content: 'Tu antiguo viaje junto al roble.',
          },
        ],
      }),
    ),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Leer tu aventura anterior' }).click();
  await expect(page.locator('.legacy-story')).toContainText(
    'Tu antiguo viaje junto al roble.',
  );
  await create(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'El refugio de Valdumbría' }),
  ).toBeVisible();
  await expect(page.getByText('Sin conexión', { exact: true })).toBeVisible();
  await page.getByLabel('Tu acción').fill('Espero');
  await expect(
    page.getByRole('button', { name: 'Enviar acción' }),
  ).toBeDisabled();
});

test('Enter sends a clarification into persistent chat and Shift Enter keeps a newline', async ({
  page,
}) => {
  await quiet(page);
  await create(page);
  const field = page.getByLabel('Tu acción');
  await field.fill('Le hablo');
  await field.press('Shift+Enter');
  await expect(field).toHaveValue('Le hablo\n');
  await field.fill('Le hablo');
  await page.locator('.conversation').evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
  });
  await field.press('Enter');
  await expect(page.locator('.chat-message.user').last()).toContainText(
    'Le hablo',
  );
  await expect(page.locator('.chat-message.assistant').last()).toContainText(
    '¿A quién quieres hablarle?',
  );
  await expect(field).toHaveValue('');
  const questionVisible = () =>
    page
      .locator('.chat-message.assistant')
      .last()
      .evaluate((el) => {
        const r = el.getBoundingClientRect(),
          c = el.closest('.conversation')?.getBoundingClientRect();
        return Boolean(c && r.top >= c.top - 2 && r.top < c.bottom);
      });
  await expect.poll(questionVisible).toBe(true);
  await page.reload();
  await expect(page.locator('.chat-message.assistant').last()).toContainText(
    '¿A quién quieres hablarle?',
  );
  await field.fill('Con Mara.');
  await field.press('Enter');
  await expect(page.locator('.chat-message.user')).toHaveCount(2);
  await expect(field).toHaveValue('');
});

for (const newerDraft of [
  'Otra idea que todavía no he enviado',
  'Le hablo\n',
]) {
  test(`retrying a lost clarification preserves edited draft ${JSON.stringify(newerDraft)}`, async ({
    page,
  }) => {
    await quiet(page);
    await create(page);
    let calls = 0;
    await page.route('**/intent', async (route) => {
      calls++;
      if (calls === 1) {
        await route.fetch();
        await route.abort('failed');
      } else await route.continue();
    });
    const field = page.getByLabel('Tu acción');
    await field.fill('Le hablo');
    await field.press('Enter');
    await expect(
      page.getByRole('button', { name: 'Reintentar la misma acción' }),
    ).toBeVisible();
    await expect(field).toHaveValue('Le hablo');
    await field.fill(newerDraft);
    await page
      .getByRole('button', { name: 'Reintentar la misma acción' })
      .click();
    await expect(page.locator('.chat-message.user')).toHaveCount(1);
    await expect(page.locator('.chat-message.assistant').last()).toContainText(
      '¿A quién quieres hablarle?',
    );
    await expect(field).toHaveValue(newerDraft);
    expect(calls).toBe(2);
  });
}
