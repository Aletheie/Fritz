import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers.ts';

test('production responses enforce CSP and private API caching policy', async ({ page }) => {
  const response = await page.goto('/');
  expect(response).not.toBeNull();
  const headers = response?.headers() ?? {};
  const csp = headers['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("'unsafe-eval'");

  const api = await page.request.get('/api/ai/key/');
  expect(api.status()).toBe(200);
  expect(api.headers()['cache-control']).toContain('no-store');
  expect(await api.json()).toMatchObject({
    configured: false,
    mode: 'demo',
    source: 'demo',
    sponsoredAvailable: false,
  });
});

test('AI provider configuration cannot be mutated from the web', async ({ request }) => {
  const response = await request.delete('/api/ai/key/');
  expect(response.status()).toBe(405);
});

test('installed service worker serves the app shell offline and never caches API responses', async ({
  context,
  page,
}) => {
  await completeOnboarding(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();

  const apiWasCached = await page.evaluate(async () => {
    const names = await caches.keys();
    const matches = await Promise.all(
      names.map(async (name) => (await caches.open(name)).match('/api/ai/key/')),
    );
    return matches.some(Boolean);
  });
  expect(apiWasCached).toBe(false);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Kam dál' })).toBeVisible();
  await context.setOffline(false);
});
