import { expect, test } from '@playwright/test';

import { completeOnboarding } from './helpers.ts';

test.use({ storageState: { cookies: [], origins: [] } });

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
  await expect(page.getByRole('alert')).toContainText('Aplikaci se nepodařilo bezpečně načíst');
  await expect(page.getByRole('heading', { name: 'Kam dál' })).toHaveCount(0);
  await page.unroute('**/api/auth/session/');
  await page.getByRole('button', { name: 'Zkusit znovu' }).click();
  await expect(page.getByRole('heading', { name: 'Kam dál' })).toBeVisible();
});
