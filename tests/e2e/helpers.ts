import { expect } from '@playwright/test';

import type { Page } from '@playwright/test';

export async function completeOnboarding(page: Page): Promise<void> {
  await page.goto('/');
  const onboardingTitle = page.getByRole('heading', {
    name: 'Co chceš s němčinou zvládnout?',
  });
  const homeTitle = page.getByRole('heading', { name: 'Kam dál' });

  // A fresh IndexedDB seed can take longer on slower browser runs. Wait for the
  // app to choose a landing screen instead of guessing from a short timeout.
  await expect
    .poll(async () => (await onboardingTitle.isVisible()) || (await homeTitle.isVisible()), {
      timeout: 15_000,
    })
    .toBe(true);

  if (await onboardingTitle.isVisible()) {
    await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Odkud navážeme?' })).toBeVisible();
    await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Kolik času máš běžně denně?' })).toBeVisible();
    await page.getByRole('button', { name: /Nahrát vlastní školní látku/u }).click();
    await page.waitForURL(/\/import\/$/u);
    await page.goto('/');
  }
  await expect(homeTitle).toBeVisible();
}

export async function unlockStoryBook(page: Page, bookId: string): Promise<void> {
  await completeOnboarding(page);
  await page.evaluate(async (storyBookId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fritz');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const transaction = database.transaction('course', 'readwrite');
    const store = transaction.objectStore('course');
    const course = await new Promise<{ unlockedStoryBooks: string[]; updatedAt: string }>(
      (resolve, reject) => {
        const request = store.get('course');
        request.addEventListener('success', () => resolve(request.result), { once: true });
        request.addEventListener('error', () => reject(request.error), { once: true });
      },
    );
    course.unlockedStoryBooks = [...new Set([...course.unlockedStoryBooks, storyBookId])];
    course.updatedAt = new Date().toISOString();
    store.put(course);
    await new Promise<void>((resolve, reject) => {
      transaction.addEventListener('complete', () => resolve(), { once: true });
      transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
      transaction.addEventListener('error', () => reject(transaction.error), { once: true });
    });
    database.close();
  }, bookId);
}
