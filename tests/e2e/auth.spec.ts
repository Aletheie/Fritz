import { execFileSync } from 'node:child_process';

import { expect, test } from '@playwright/test';

import { completeOnboarding } from './helpers.ts';

test.use({ storageState: { cookies: [], origins: [] } });

test('the production router applies one login limit to all encoded URL spellings', () => {
  execFileSync(process.execPath, ['tests/fixtures/login-rate-limit.mjs'], {
    encoding: 'utf8',
    timeout: 20_000,
  });
});

test('login gates are never cached and retain security headers', async ({ request }) => {
  await Promise.all(
    ['/settings/', '/api/ai/explain'].map(async (path) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(path.startsWith('/api/') ? 401 : 303);
      expect(response.headers()['cache-control']).toContain('no-store');
      expect(response.headers()['x-content-type-options']).toBe('nosniff');
      expect(response.headers()['x-frame-options']).toBe('DENY');
    }),
  );
});

test('login normalizes redirect URLs before accepting their origin', async ({ page, baseURL }) => {
  const response = await page.request.post('/api/auth/login', {
    headers: { Origin: baseURL! },
    data: { username: 'test', password: 'correct horse battery staple' },
  });
  expect(response.ok()).toBe(true);
  await completeOnboarding(page);
  async function expectRedirect(target: string, expected = '/'): Promise<void> {
    await page.goto(`/login/?redirect=${encodeURIComponent(target)}`);
    await expect(page).toHaveURL(new URL(expected, baseURL).href);
  }
  await expectRedirect('/\\example.com');
  await expectRedirect('/\n/example.com');
  await expectRedirect('//example.com');
  await expectRedirect('/settings/?tab=backup', '/settings/?tab=backup');
});

test('single-user login gate rejects bad credentials and supports logout', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login\//u);
  await expect(page.getByRole('heading', { name: 'Vítej zpátky' })).toBeVisible();

  await page.getByLabel('Uživatelské jméno').fill('test');
  await page.getByLabel('Heslo').fill('wrong password');
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await expect(page.getByRole('alert')).toHaveText('Nesprávné přihlašovací údaje.');

  await page.getByLabel('Heslo').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await expect(page).toHaveURL(/\/$/u);
  await completeOnboarding(page);
  await page.goto('/settings/');
  await expect(page.locator('.settings-page')).toBeVisible();

  await page.getByRole('button', { name: 'Odhlásit' }).first().click();
  await expect(page).toHaveURL(/\/login\//u);
});

test('an invalid account identity cannot fall back to previously unlocked local data', async ({
  page,
}) => {
  await page.goto('/login/');
  await page.getByLabel('Uživatelské jméno').fill('test');
  await page.getByLabel('Heslo').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await expect(page).not.toHaveURL(/\/login\//u);
  await completeOnboarding(page);
  await page.route('**/api/auth/session/', (route) =>
    route.fulfill({
      json: { authenticated: true, accountId: 'invalid-account', accountCreatedAt: 'invalid-date' },
    }),
  );
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Aplikaci se nepodařilo načíst');
  await expect(page.getByRole('heading', { name: 'Kam dál' })).toHaveCount(0);
  await page.unroute('**/api/auth/session/');
  await page.getByRole('button', { name: 'Zkusit znovu' }).click();
  await expect(page.getByRole('heading', { name: 'Kam dál' })).toBeVisible();
});
