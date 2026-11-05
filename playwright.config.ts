import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    headless: true,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
  },
  webServer: [
    {
      command: 'node tests/browser/fixture-ai.mjs',
      url: 'http://127.0.0.1:11435',
      reuseExistingServer: false,
    },
    {
      command:
        'node --import ./tests/browser/deterministic-rng.mjs node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        AI_PROVIDER: 'ollama',
        OLLAMA_BASE_URL: 'http://127.0.0.1:11435',
        ENABLE_IMAGES: 'false',
        GAME_DATA_DIR: '.data/e2e',
        APP_ORIGIN: 'http://127.0.0.1:3100',
      },
    },
  ],
});
