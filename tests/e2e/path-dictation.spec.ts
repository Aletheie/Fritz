import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';
import { completeOnboarding } from './helpers.ts';

const mixHref = '/path/chapter-01-school%3Amix/';
const checkpointHref = '/path/chapter-01-school%3Acheckpoint/';
const expectedSentence = 'Heute lerne ich in der Schule Deutsch.';

async function installSpeechMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const spoken: Array<{ text: string; lang: string; rate: number }> = [];
    class MockSpeechSynthesisUtterance {
      lang = '';
      rate = 1;
      private readonly listeners: Record<'end' | 'error', Array<() => void>> = {
        end: [],
        error: [],
      };

      constructor(readonly text: string) {}

      addEventListener(type: 'end' | 'error', listener: () => void): void {
        this.listeners[type].push(listener);
      }

      dispatch(type: 'end' | 'error'): void {
        for (const listener of this.listeners[type]) listener();
      }
    }

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: MockSpeechSynthesisUtterance,
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance: MockSpeechSynthesisUtterance) {
          spoken.push({ text: utterance.text, lang: utterance.lang, rate: utterance.rate });
          window.setTimeout(() => utterance.dispatch('end'), 80);
        },
      },
    });
    Object.defineProperty(window, 'fritzSpokenLog', {
      configurable: true,
      value: spoken,
    });
  });
}

async function seedCompletedNodes(page: Page, completedNodeIds: string[]): Promise<void> {
  await completeOnboarding(page);
  await page.evaluate(async (nodeIds) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fritz');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const transaction = database.transaction('course', 'readwrite');
    const store = transaction.objectStore('course');
    const course = await new Promise<{
      pathNodes: Record<string, Record<string, unknown>>;
      pathEvents: Array<Record<string, unknown>>;
      updatedAt: string;
    }>((resolve, reject) => {
      const request = store.get('course');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const completedAt = new Date().toISOString();
    course.pathEvents = course.pathEvents.filter(
      (event) => !nodeIds.includes(String(event.nodeId)),
    );
    for (const [index, nodeId] of nodeIds.entries()) {
      course.pathNodes[nodeId] = {
        nodeId,
        startedAt: completedAt,
        completedAt,
        attempts: 1,
        bestStars: 3,
        xpAwarded: 0,
        updatedAt: completedAt,
      };
      course.pathEvents.push({
        id: `path-activity-seed-${index + 1}`,
        nodeId,
        chapterId: 'chapter-01-school',
        completedAt,
        stars: 3,
        baseXp: 0,
        bonusXp: 0,
        xpAwarded: 0,
        boosted: false,
      });
    }
    course.updatedAt = completedAt;
    store.put(course);

    await new Promise<void>((resolve, reject) => {
      transaction.addEventListener('complete', () => resolve(), { once: true });
      transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
      transaction.addEventListener('error', () => reject(transaction.error), { once: true });
    });
    database.close();
  }, completedNodeIds);
}

async function unlockFirstMix(page: Page): Promise<void> {
  await seedCompletedNodes(page, [
    'chapter-01-school:vocabulary',
    'chapter-01-school:practice',
    'chapter-01-school:grammar',
  ]);
}

async function unlockFirstCheckpoint(page: Page): Promise<void> {
  await seedCompletedNodes(page, [
    'chapter-01-school:vocabulary',
    'chapter-01-school:practice',
    'chapter-01-school:grammar',
    'chapter-01-school:mix',
    'chapter-01-school:sentence',
    'chapter-01-school:coach',
  ]);
}

async function openDictation(page: Page): Promise<void> {
  await installSpeechMock(page);
  await unlockFirstMix(page);
  await page.goto(mixHref);
  await expect(page.getByRole('heading', { level: 1, name: 'Poslech a věty' })).toBeVisible();
  await expect(page.getByText('Poslechový diktát')).toBeVisible();
}

test('chapter mix plays, slows, and grades the spoken sentence on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDictation(page);

  await expect(page.getByText('7 slov · interpunkci hodnotit nebudeme')).toBeVisible();
  await page.getByRole('button', { name: 'Přehrát větu' }).click();
  await page.getByRole('button', { name: 'Pomaleji' }).click();
  const spoken = await page.evaluate(
    () =>
      Reflect.get(window, 'fritzSpokenLog') as Array<{
        text: string;
        lang: string;
        rate: number;
      }>,
  );
  expect(spoken).toEqual([
    { text: expectedSentence, lang: 'de-DE', rate: 1 },
    { text: expectedSentence, lang: 'de-DE', rate: 0.78 },
  ]);

  await page.getByLabel('Co jsi slyšela?').fill('heute lerne ich in der schule deutsch');
  await page.getByRole('button', { name: 'Zkontrolovat přepis' }).click();
  await expect(page.getByText('Správně.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('text alternative keeps equal scoring and the activity passes WCAG A/AA', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDictation(page);

  await page.getByRole('button', { name: 'Teď nemůžu poslouchat' }).click();
  await expect(page.getByText('Textová alternativa')).toBeVisible();
  await expect(page.getByText('Dnes se ve škole učím německy.')).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(blocking).toEqual([]);

  await page.getByRole('button', { name: expectedSentence }).click();
  await expect(page.getByText('Správně.', { exact: true })).toBeVisible();
});

test('checkpoint includes an accessible language-detective error clinic on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await unlockFirstCheckpoint(page);
  await page.goto(checkpointHref);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ověření: První den ve škole' }),
  ).toBeVisible();

  await page.getByRole('button').filter({ hasText: 'die Stunde' }).click();
  await expect(page.getByText('Správně.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Další', exact: true }).click();
  await page.getByRole('button').filter({ hasText: 'lernen' }).click();
  await expect(page.getByText('Správně.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Další', exact: true }).click();

  await expect(page.getByText('Chybná věta', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Die erste Stunde um acht Uhr beginnt.' }),
  ).toBeVisible();
  await expect(page.locator('.answer-list button')).toHaveCount(4);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(blocking).toEqual([]);

  await page.getByRole('button', { name: /Větné členy jsou v chybném pořadí\./u }).click();
  await expect(page.getByText('Správně.', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Opravená věta: „Die erste Stunde beginnt um acht Uhr\.“/u),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
