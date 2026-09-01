import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

import { completeOnboarding } from './helpers.ts';

import type { Page } from '@playwright/test';

const screenshotDirectory = path.resolve('artifacts/screenshots');

test.beforeEach(async ({ page }) => {
  await completeOnboarding(page);
});

async function completeReview(page: Page, heading: string, answer: string): Promise<void> {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await page.getByLabel('Německá odpověď').fill(answer);
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.getByRole('status')).toContainText('Sedí to.');
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
}

test('one daily CTA starts a resumable, privacy-minimal lesson', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const dailyLesson = page.getByRole('complementary', { name: 'Jedna souvislá lekce' });
  await expect(dailyLesson.getByRole('link', { name: 'Spustit dnešní lekci' })).toHaveCount(1);
  await dailyLesson.getByRole('link', { name: 'Spustit dnešní lekci' }).click();

  await expect(page).toHaveURL(/\/today\/$/u);
  await expect(page.getByRole('heading', { name: 'Opakování 1 z 3' })).toBeVisible();
  await expect(page.locator('.desktop-sidebar')).toHaveCount(0);
  await expect(page.getByText('dobré ráno', { exact: true })).toBeVisible();

  await page.getByLabel('Německá odpověď').fill('Guten Morgen');
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.getByRole('status')).toContainText('Sedí to.');
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Opakování 2 z 3' })).toBeVisible();
  await expect(page.getByText('hezký', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Opakování 2 z 3' })).toBeVisible();
  await expect(page.getByText('hezký', { exact: true })).toBeVisible();

  const stored = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fritz');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const transaction = database.transaction(['learningEvidence', 'dailySessions'], 'readonly');
    const readAll = <T>(storeName: string) =>
      new Promise<T[]>((resolve, reject) => {
        const request = transaction.objectStore(storeName).getAll();
        request.addEventListener('success', () => resolve(request.result), { once: true });
        request.addEventListener('error', () => reject(request.error), { once: true });
      });
    const [evidence, sessions] = await Promise.all([
      readAll<Record<string, unknown>>('learningEvidence'),
      readAll<Record<string, unknown>>('dailySessions'),
    ]);
    database.close();
    return { evidence, sessions };
  });

  expect(stored.evidence).toHaveLength(1);
  expect(stored.evidence[0]).not.toHaveProperty('submittedText');
  expect(stored.sessions).toHaveLength(1);

  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, 'today-resume-390.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test('daily lesson completes recall, listening, transfer, and exit ticket as one flow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings/');
  await page
    .getByRole('group', { name: 'Můj hlavní cíl' })
    .getByRole('radio', { name: /Pamatovat si slovíčka/u })
    .check();
  await page.getByRole('button', { name: 'Uložit nastavení' }).click();
  await expect(page.getByText('Nastavení je uložené.')).toBeVisible();
  await page.goto('/today/');

  await completeReview(page, 'Opakování 1 z 3', 'Guten Morgen');
  await completeReview(page, 'Opakování 2 z 3', 'schön');
  await completeReview(page, 'Opakování 3 z 3', 'pünktlich');

  await expect(page.getByRole('heading', { name: 'Poslech bez opory' })).toBeVisible();
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, 'today-listening-390.png'),
    fullPage: true,
    animations: 'disabled',
  });
  const transcript = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fritz');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const transaction = database.transaction('dailySessions', 'readonly');
    const sessions = await new Promise<
      Array<{ cursor: number; plan: { activities: Array<{ kind: string; transcript?: string }> } }>
    >((resolve, reject) => {
      const request = transaction.objectStore('dailySessions').getAll();
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    database.close();
    const active = sessions[0]?.plan.activities[sessions[0].cursor];
    return active?.kind === 'listening' ? active.transcript : undefined;
  });
  expect(transcript).toBeTruthy();
  await page.getByLabel('Napiš, co slyšíš').fill(transcript ?? '');
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.getByRole('status')).toContainText('Slyšela jsi celou větu.');
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'První seznámení' })).toBeVisible();
  await page.screenshot({
    path: path.join(screenshotDirectory, 'today-transfer-390.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByLabel('Tvoje německá replika').fill('Ich heiße Anna.');
  await page.getByRole('button', { name: 'Odeslat repliku' }).click();
  await expect(page.getByRole('status')).toContainText('Replika funguje.');
  await page.getByRole('button', { name: 'Další replika' }).click();
  await page.getByLabel('Tvoje německá replika').fill('Ich komme aus Tschechien.');
  await page.getByRole('button', { name: 'Odeslat repliku' }).click();
  await expect(page.getByRole('status')).toContainText('Domluvila ses.');
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Co dnes zůstalo v hlavě?' })).toBeVisible();
  await page.getByRole('button', { name: 'Dokončit dnešek' }).click();
  await expect(page.getByRole('heading', { name: 'Dnes je hotovo.' })).toBeVisible();
  await expect(page.getByText('Důkazy učení').locator('..')).toContainText('5');
  await page.screenshot({
    path: path.join(screenshotDirectory, 'today-complete-390.png'),
    fullPage: true,
    animations: 'disabled',
  });

  await page.getByRole('link', { name: 'Zpět na cestu' }).click();
  const dailyLesson = page.getByRole('complementary', { name: 'Jedna souvislá lekce' });
  await expect(dailyLesson.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  await expect(dailyLesson.getByRole('link', { name: 'Zobrazit dnešní souhrn' })).toHaveAttribute(
    'href',
    '/today/',
  );
});

test('an incorrect answer returns once after two different activities', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/today/');

  await page.getByLabel('Německá odpověď').fill('falsch');
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.getByRole('status')).toContainText('Tady je mezera.');
  await page.getByRole('button', { name: 'Pokračovat · vrátí se později' }).click();

  await completeReview(page, 'Opakování 2 z 3', 'schön');
  await completeReview(page, 'Opakování 3 z 3', 'pünktlich');

  await expect(page.getByRole('heading', { name: 'Oprava · Opakování 1 z 3' })).toBeVisible();
  await expect(page.getByText('dobré ráno', { exact: true })).toBeVisible();
  await page.getByLabel('Německá odpověď').fill('Guten Morgen');
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.getByRole('status')).toContainText('Sedí to.');
});

for (const viewport of [
  { name: 'phone', width: 320, height: 720 },
  { name: 'desktop', width: 1440, height: 1000 },
] as const) {
  test(`daily lesson has no horizontal overflow on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/today/');
    await expect(page.getByRole('heading', { name: 'Opakování 1 z 3' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    await mkdir(screenshotDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(screenshotDirectory, `today-${viewport.name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  });
}
