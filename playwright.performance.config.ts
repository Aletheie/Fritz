import { defineConfig, devices } from '@playwright/test';
import config from './playwright.config.ts';

export default defineConfig({
  ...config,
  testDir: './tests/performance',
  // Large IndexedDB fixtures are seeded before the timed UI assertions.
  timeout: 300_000,
  outputDir: 'artifacts/performance/browser/traces',
  reporter: [['line'], ['json', { outputFile: 'artifacts/performance/browser/results.json' }]],
  use: {
    ...config.use,
    storageState: 'artifacts/performance/browser/auth.json',
    // Cache installation is covered by resilience.spec.ts. Cold-load measurements
    // must not compete with a service worker preloading the entire application.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-cpu4', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
  ],
});
