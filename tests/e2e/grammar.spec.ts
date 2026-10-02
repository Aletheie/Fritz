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

test('closing a consulted rule still records assisted evidence and does not inflate mastery', async ({
  page,
}) => {
  await page.goto('/grammar/verb-second-position/');
  await page.getByRole('button', { name: 'Jdu na to' }).click();
  const reminder = page.locator('.rule-reminder');
  await page.getByText('Připomenout pravidlo', { exact: true }).click();
  await expect(reminder).toHaveAttribute('open', '');
  await page.getByText('Připomenout pravidlo', { exact: true }).click();
  await expect(reminder).not.toHaveAttribute('open', '');
  await page.getByText('lerne', { exact: true }).click();
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.getByText('Přesně tak.', { exact: true })).toBeVisible();
  const stored = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fritz');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const transaction = database.transaction(['learningEvidence', 'skillStates'], 'readonly');
    const read = (store: string) =>
      new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
        const request = transaction.objectStore(store).getAll();
        request.addEventListener('success', () => resolve(request.result), { once: true });
        request.addEventListener('error', () => reject(request.error), { once: true });
      });
    const [evidence, skills] = await Promise.all([read('learningEvidence'), read('skillStates')]);
    database.close();
    return { evidence, skills };
  });
  const answers = stored.evidence.filter((item) => item.source === 'grammar-answer');
  expect(answers).toHaveLength(1);
  expect(answers[0]).toMatchObject({ outcome: 'correct', hintsUsed: 1, independent: false });
  expect(
    stored.skills.find((item) => item.skillId === 'grammar:verb-second-position'),
  ).toMatchObject({
    stage: 0,
    independentSuccesses: 0,
  });
});

test('a corrected grammar answer advances and the lesson can finish', async ({ page }) => {
  await page.goto('/grammar/verb-second-position/');
  await page.getByRole('button', { name: 'Jdu na to' }).click();
  await page.getByText('Připomenout pravidlo', { exact: true }).click();
  await expect(page.locator('.rule-reminder')).toHaveAttribute('open', '');

  await page.getByText('lernen', { exact: true }).click();
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.getByText('Ještě ne.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zkusit znovu' })).toBeFocused();

  await page.keyboard.press('Enter');
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

  const input = page.getByRole('textbox', { name: 'Chybějící německý výraz' });
  await input.fill('grose');
  await input.evaluate((element: HTMLInputElement) => element.setSelectionRange(3, 4));
  await page.getByRole('button', { name: 'Vložit ß' }).click();
  await expect(input).toHaveValue('große');
  await expect(input).toBeFocused();
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
  await expect(page.getByRole('region', { name: 'Co se podařilo opravit' })).toContainText('lerne');
});
