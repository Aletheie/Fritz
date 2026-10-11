import { expect, test } from '@playwright/test';

import { completeOnboarding } from './helpers.ts';

test('library filters by kind and saves an edited card', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/library/');

  const summary = page.getByText(/^\d+ z \d+ výrazů$/u);
  await expect(summary).toBeVisible();
  const total = Number((await summary.textContent())?.split(' z ')[1]?.split(' ')[0]);
  await page.getByRole('button', { name: 'Slovesa', exact: true }).click();
  await expect(summary).not.toHaveText(`${total} z ${total} výrazů`);
  await page.getByRole('button', { name: 'Vše', exact: true }).click();
  await expect(summary).toHaveText(`${total} z ${total} výrazů`);

  const search = page.getByLabel('Hledat slovíčka');
  const results = page.getByRole('region', { name: 'Výsledky hledání' });
  await results.getByTitle('Upravit').first().click();
  const czech = page.locator('#library-edit-czech');
  await expect(czech).toBeVisible();
  const edited = `${await czech.inputValue()} (upraveno)`;
  await czech.fill(edited);
  await page.getByRole('button', { name: 'Uložit změny' }).click();

  await search.fill('(upraveno)');
  await expect(results).toContainText(edited);
  await page.reload();
  await page.getByLabel('Hledat slovíčka').fill('(upraveno)');
  await expect(page.getByRole('region', { name: 'Výsledky hledání' })).toContainText(edited);
});
