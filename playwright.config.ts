import { defineConfig, devices } from '@playwright/test';

const authDataDir = `/private/tmp/fritz-playwright-auth-${process.pid}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['line']],
  outputDir: 'artifacts/playwright',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    storageState: 'artifacts/playwright/auth.json',
    locale: 'cs-CZ',
    timezoneId: 'Europe/Prague',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `FRITZ_AUTH_DATA_DIR=${authDataDir} node scripts/account-create.mjs --username test --password 'correct horse battery staple' && env HOST=127.0.0.1 PORT=4173 ORIGIN=http://127.0.0.1:4173 FRITZ_AUTH_DATA_DIR=${authDataDir} AI_SPONSORED_MODE=off node build`,
    url: 'http://127.0.0.1:4173/healthz',
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
