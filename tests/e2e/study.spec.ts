import { expect, test } from '@playwright/test';

import { completeOnboarding } from './helpers.ts';

test('long-term study grades a typed answer, requires a correction and resumes later', async ({
  page,
}) => {
  await completeOnboarding(page);

  await page.goto('/settings/');
  await page.getByTestId('exercise-settings').locator('summary').click();
  await page.getByRole('button', { name: /^Jen psaní/u }).click();
  await page.getByRole('button', { name: 'Uložit nastavení' }).click();
  await expect(page.getByText('Nastavení je uložené.')).toBeVisible();

  await page.goto('/study/?size=5&start=1');
  const answer = page.locator('#study-answer');
  await expect(answer).toBeFocused();

  await answer.fill('ganz falsch');
  await answer.press('Enter');
  await expect(page.getByText('podívej se na opravu')).toBeVisible();
  await expect(answer).toBeDisabled();
  await expect(page.getByRole('button', { name: /Další úloha/u })).toBeDisabled();

  await page.goto('/study/');
  await expect(page.getByText('Pozastavená dávka')).toBeVisible();
  await page.getByRole('button', { name: /^Pokračovat/u }).click();
  await expect(page.locator('#study-answer')).toBeFocused();
  await expect(page.locator('#study-answer')).toHaveValue('');

  const weakSpot = page.getByTestId('weak-spot-link');
  await page.goto('/study/');
  await expect(weakSpot).toBeVisible();
  await weakSpot.click();
  await expect(page).toHaveURL(/focus=weak/u);
  await expect(page.locator('#study-answer')).toBeVisible();
});
