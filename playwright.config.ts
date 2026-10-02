import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const authDataDir = join(tmpdir(), `fritz-playwright-auth-${process.pid}`);
const testPort = process.env.FRITZ_TEST_PORT ?? '4173';
const baseURL = `http://127.0.0.1:${testPort}`;
const outputDir = process.env.FRITZ_TEST_OUTPUT_DIR ?? 'artifacts/playwright';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['line']],
  outputDir,
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL,
    storageState: join(outputDir, 'auth.json'),
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
    ...(process.env.FRITZ_TEST_WEBKIT === '1'
      ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]
      : []),
  ],
  webServer: {
    command:
      "node scripts/account-create.mjs --username test --password 'correct horse battery staple' && node build",
    env: {
      FRITZ_AUTH_DATA_DIR: authDataDir,
      HOST: '127.0.0.1',
      PORT: testPort,
      ORIGIN: baseURL,
      AI_SPONSORED_MODE: 'off',
      AI_ALLOW_LOCAL_PROVIDERS: 'true',
    },
    url: `${baseURL}/healthz`,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
