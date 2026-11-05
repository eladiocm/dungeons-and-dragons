import { unlinkSync, writeFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { action, create, quiet } from './helpers';

// Separate virtual clients retain the real server rate limit.
test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.12' } });

async function roll(page: Page) {
  await page.getByRole('button', { name: 'Tirar dados' }).click();
  await page.getByRole('button', { name: 'Confirmar resultado' }).click();
  await expect(page.locator('main.app')).toHaveAttribute('aria-busy', 'false');
}
for (const [text, title] of [
  ['Hago un descanso largo', 'La noche sin faro'],
  ['Abandono la misión', 'Un camino sin terminar'],
])
  test(`ending: ${title}`, async ({ page }) => {
    await quiet(page);
    await create(page);
    await action(page, text);
    await expect(
      page.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Enviar acción' }),
    ).toBeDisabled();
  });

test('wizard spell spends one slot and ends a defeated encounter', async ({
  page,
}) => {
  await quiet(page);
  await create(page, 'Mago');
  await action(page, 'Voy al camino');
  await action(page, 'Voy al molino');
  await action(page, 'Lanzo Proyectil mágico contra Bram');
  await roll(page);
  await page.getByRole('tab', { name: 'Magia', exact: true }).click();
  await expect(page.locator('.magic-budget')).toContainText('1 / 2');
  await expect(
    page.getByRole('button', { name: 'Finalizar turno' }),
  ).toHaveCount(0);
});
test('a fallen character makes death saves and reaches a persistent death ending', async ({
  page,
}) => {
  await quiet(page);
  await create(page, 'Mago');
  await action(page, 'Voy al camino');
  await action(page, 'Voy al molino');
  await action(page, 'Ataco a Bram con mi bastón');
  await roll(page);
  for (let turn = 0; turn < 2; turn++) {
    await page.getByRole('button', { name: 'Finalizar turno' }).click();
    await roll(page);
  }
  await expect(page.locator('.death-warning')).toContainText('Estás a 0 PG');
  try {
    writeFileSync('.data/e2e/rng.json', JSON.stringify([1, 1]));
    for (let save = 0; save < 2; save++) {
      await page
        .getByRole('button', { name: 'Salvación de muerte', exact: true })
        .click();
      await roll(page);
    }
    await expect(
      page.getByRole('heading', { name: 'Tu última guardia', exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Tu última guardia', exact: true }),
    ).toBeVisible();
  } finally {
    try {
      unlinkSync('.data/e2e/rng.json');
    } catch {}
  }
});
test('escaping a combat leaves the mission active instead of abandoning it', async ({
  page,
}) => {
  await quiet(page);
  await create(page, 'Mago');
  await action(page, 'Voy al camino');
  await action(page, 'Voy al molino');
  await action(page, 'Ataco a Bram con mi bastón');
  await roll(page);
  await action(page, 'Huyo hacia el camino sin abandonar la misión');
  await roll(page);
  await expect(
    page.getByRole('heading', { name: 'El camino anegado' }),
  ).toBeVisible();
  await expect(page.getByLabel('Tu acción')).toBeEnabled();
  await expect(page.locator('.ending')).toHaveCount(0);
});
test('two tabs detect a stale turn without applying its action or losing the draft', async ({
  page,
  context,
}) => {
  await quiet(page);
  await create(page);
  const second = await context.newPage();
  await second.goto('/');
  await expect(
    second.getByRole('heading', { name: 'El refugio de Valdumbría' }),
  ).toBeVisible();
  await action(page, 'Voy al camino');
  await action(second, 'Examino el mapa');
  await expect(
    second.getByRole('heading', { name: 'El camino anegado' }),
  ).toBeVisible();
  await expect(second.getByLabel('Tu acción')).toHaveValue('Examino el mapa');
  await expect(second.getByRole('main').getByRole('alert')).toContainText(
    'cambió',
  );
  await action(second, 'Voy al molino');
  await expect(
    second.getByRole('heading', { name: 'El molino sin viento' }),
  ).toBeVisible();
});
test('retrying prose after a saved action cannot repeat its mechanical consequences', async ({
  page,
}) => {
  await quiet(page);
  await create(page);
  await page.locator('.conversation').evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
  });
  let calls = 0;
  await page.route('**/narrative', (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({
          status: 503,
          json: { error: 'Proveedor no disponible' },
        })
      : route.continue();
  });
  await action(page, 'Voy al camino');
  const id = await page.evaluate(() => localStorage.getItem('dnd-current-v2')),
    before = await (await page.request.get(`/api/sessions/${id}`)).json();
  await page
    .getByRole('button', { name: 'Reintentar narración del Master' })
    .click({ timeout: 3000 });
  await expect(page.locator('main.app')).toHaveAttribute('aria-busy', 'false');
  const after = await (await page.request.get(`/api/sessions/${id}`)).json();
  expect(after.session.world.time).toBe(before.session.world.time);
  expect(after.session.events.length).toBe(before.session.events.length);
  expect(after.session.messages.at(-1).narrationPending).toBe(false);
});
