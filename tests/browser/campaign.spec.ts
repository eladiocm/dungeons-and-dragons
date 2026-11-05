import { expect, type Page, test } from '@playwright/test';

// Separate virtual clients retain the real server rate limit.
test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '198.51.100.10' } });

async function quiet(page: Page) {
  await page.route('**/api/config', (route) =>
    route.fulfill({
      json: { configured: true, imagesEnabled: false, voiceEnabled: false },
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem(
      'dnd-voice-v2',
      JSON.stringify({ automatic: false, voice: 'device' }),
    ),
  );
}
async function create(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear personaje' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Revisar personaje' }).click();
  await expect(
    page.getByRole('heading', { name: 'Tu personaje está listo' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Iniciar partida' }).click();
  await expect(
    page.getByRole('heading', { name: 'El refugio de Valdumbría' }),
  ).toBeVisible();
}
async function action(page: Page, text: string) {
  await page.getByLabel('Tu acción').fill(text);
  await page.getByRole('button', { name: 'Enviar acción' }).click();
  await expect(page.locator('main.app')).toHaveAttribute('aria-busy', 'false');
}
test('creation precedes play; choices can be reviewed; complete a prepared adventure with real private API', async ({
  page,
}) => {
  await quiet(page);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Iniciar partida' }),
  ).toHaveCount(0);
  await create(page);
  await expect(page.getByText('Cloudflare', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('img', { name: /Ilustración de/ })).toBeVisible();
  await page.screenshot({
    path: 'test-results/mvp-table-desktop.png',
    fullPage: true,
  });
  await action(page, 'Voy al camino');
  await expect(
    page.getByRole('heading', { name: 'El camino anegado' }),
  ).toBeVisible();
  await action(page, 'Voy al molino');
  await action(page, 'Intento convencer a Bram');
  await page.getByRole('button', { name: 'Tirar dados' }).click();
  await expect(
    page.getByRole('button', { name: 'Confirmar resultado' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar resultado' }).click();
  await action(page, 'Entro en la cámara');
  await action(page, 'Bajo la palanca');
  await action(page, 'Tomo la lente');
  await action(page, 'Rescato a Sira');
  await action(page, 'Vuelvo al molino');
  await action(page, 'Subo al faro');
  await action(page, 'Giro la manivela');
  await expect(
    page.getByRole('heading', { name: 'La luz vuelve al valle' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'La luz vuelve al valle' }),
  ).toBeVisible();
});
test('mobile table has usable tabs and no horizontal overflow', async ({
  page,
}) => {
  await quiet(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await create(page);
  await page.screenshot({
    path: 'test-results/mvp-table-mobile.png',
    fullPage: true,
  });
  await page.getByRole('tab', { name: 'Ficha' }).click();
  await expect(
    page.getByRole('heading', { name: 'Aren', exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Dados' }).click();
  await expect(
    page.getByRole('heading', { name: 'La suerte está en tus manos' }),
  ).toBeVisible();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByLabel('Menú de partida').click();
  await expect(page.getByText('Instalar en móvil')).toBeVisible();
});

test('creator changes class species and background before review without starting early', async ({
  page,
}) => {
  await quiet(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear personaje' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Iria');
  await page.getByRole('button', { name: /^Mago/ }).click();
  await page.getByRole('radio', { name: /^Enano/ }).check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page
    .getByRole('combobox', { name: 'Trasfondo', exact: true })
    .selectOption('criminal');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Revisar personaje' }).click();
  await expect(
    page.getByRole('heading', { name: 'Iria', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Enano · Mago de nivel 1 · Criminal', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Volver', exact: true }).click();
  await expect(
    page.getByRole('group', { name: /Libro de conjuros/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Revisar personaje' }).click();
  await page.screenshot({
    path: 'test-results/mvp-character-review.png',
    fullPage: true,
  });
});

for (const width of [390, 1280]) {
  test(`creator step navigation starts at the top at ${width}px`, async ({
    page,
  }) => {
    await quiet(page);
    await page.setViewportSize({ width, height: 600 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Crear personaje' }).click();
    for (const label of [
      'Continuar',
      'Continuar',
      'Revisar personaje',
      'Volver',
    ]) {
      const next = page.getByRole('button', { name: label, exact: true });
      await next.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
      await next.click();
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeLessThanOrEqual(1);
      await expect(page.locator('#creator-title')).toBeInViewport();
    }
    await page
      .getByRole('navigation', { name: 'Creación de personaje' })
      .getByRole('button', { name: '1 Identidad' })
      .click();
    await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue(
      'Aren',
    );
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeLessThanOrEqual(1);
  });
}
