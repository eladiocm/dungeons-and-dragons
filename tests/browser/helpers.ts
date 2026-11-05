import { expect, type Page } from '@playwright/test';
export async function quiet(page: Page, imagesEnabled = false) {
  await page.route('**/api/config', (route) =>
    route.fulfill({
      json: { configured: true, imagesEnabled, voiceEnabled: false },
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem(
      'dnd-voice-v2',
      JSON.stringify({ automatic: false, voice: 'device' }),
    ),
  );
}
export async function create(page: Page, className = '') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Crear personaje' }).click();
  if (className)
    await page
      .getByRole('button', { name: new RegExp(`^${className}`) })
      .click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Revisar personaje' }).click();
  await page.getByRole('button', { name: 'Iniciar partida' }).click();
  await expect(
    page.getByRole('heading', { name: 'El refugio de Valdumbría' }),
  ).toBeVisible();
  await expect(page.locator('main.app')).toHaveAttribute('aria-busy', 'false');
}
export async function action(page: Page, text: string) {
  await page.getByLabel('Tu acción').fill(text);
  await page.getByRole('button', { name: 'Enviar acción' }).click();
  await expect(page.locator('main.app')).toHaveAttribute('aria-busy', 'false');
}
export const image = {
  base64Data:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK9sAAAAASUVORK5CYII=',
  mediaType: 'image/png',
};
