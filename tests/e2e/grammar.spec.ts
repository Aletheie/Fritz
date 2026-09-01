import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await completeOnboarding(page);
});

import type { Page } from '@playwright/test';

async function chooseOrderTokens(page: Page, tokens: string[]): Promise<void> {
  for (const token of tokens) {
    // oxlint-disable-next-line no-await-in-loop -- token order is the behavior under test.
    await page.locator('.token-bank').getByRole('button', { name: token, exact: true }).click();
  }
}

test('a corrected grammar answer advances and the lesson can finish', async ({ page }) => {
  await page.goto('/grammar/verb-second-position/');
  await page.getByRole('button', { name: 'Jdu na to' }).click();

  await page.getByText('lernen', { exact: true }).click();
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.getByText('Ještě ne.', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Zkusit znovu' }).click();
  await page.getByText('lerne', { exact: true }).click();
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.getByText('Teď už ano.', { exact: true })).toBeVisible();
  await expect(page.locator('.question-progress span')).toHaveText('1/5');

  await page.getByRole('button', { name: 'Další' }).click();

  await expect(page.locator('.question-progress span')).toHaveText('2/5');
  await expect(page.getByRole('heading', { name: 'Zítra jedeme do Berlína.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Další' })).toHaveCount(0);

  await chooseOrderTokens(page, ['Morgen', 'fahren', 'wir', 'nach Berlin']);
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await page.getByRole('button', { name: 'Další' }).click();
  await expect(page.locator('.question-progress span')).toHaveText('3/5');

  await page.getByRole('textbox', { name: 'Chybějící německý výraz' }).fill('arbeitet');
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await page.getByRole('button', { name: 'Další' }).click();
  await expect(page.locator('.question-progress span')).toHaveText('4/5');

  await page.getByText('In der Schule spreche ich Deutsch.', { exact: true }).click();
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await page.getByRole('button', { name: 'Další' }).click();
  await expect(page.locator('.question-progress span')).toHaveText('5/5');

  await chooseOrderTokens(page, ['Am Abend', 'lese', 'ich', 'oft', 'Bücher']);
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await page.getByRole('button', { name: 'Dokončit' }).click();

  await expect(page.getByText('Lekce dokončena', { exact: true })).toBeVisible();
});
