import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

import type { Locator, Page } from '@playwright/test';
import { completeOnboarding } from './helpers.ts';

const storyHref = '/stories/a1-maerchen/a1-maerchen-e01/';

async function seedCourse(
  page: Page,
  options: { unlockStory?: boolean; reward?: boolean },
): Promise<void> {
  await completeOnboarding(page);
  await page.evaluate(async ({ unlockStory, reward }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fritz');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const transaction = database.transaction('course', 'readwrite');
    const store = transaction.objectStore('course');
    const course = await new Promise<{
      unlockedStoryBooks: string[];
      events: Array<Record<string, unknown>>;
      updatedAt: string;
    }>((resolve, reject) => {
      const request = store.get('course');
      request.addEventListener(
        'success',
        () => {
          if (request.result) resolve(request.result);
          else reject(new Error('Testovací kurz nebyl inicializovaný.'));
        },
        { once: true },
      );
      request.addEventListener('error', () => reject(request.error), { once: true });
    });

    if (unlockStory) {
      course.unlockedStoryBooks = [...new Set([...course.unlockedStoryBooks, 'a1-maerchen'])];
    }
    if (reward) {
      const rewardEvents = Array.from({ length: 20 }, (_, index) => ({
        id: `motion-reward-${index}`,
        lessonId: 'verb-second-position',
        questionId: 'v2-1',
        answeredAt: new Date(Date.now() - index * 1_000).toISOString(),
        correct: true,
        firstTry: true,
        xpAwarded: 100,
        responseMs: 1,
      }));
      course.events = [
        ...course.events.filter(
          (event) => typeof event.id !== 'string' || !event.id.startsWith('motion-reward-'),
        ),
        ...rewardEvents,
      ];
    }
    course.updatedAt = new Date().toISOString();
    store.put(course);

    await new Promise<void>((resolve, reject) => {
      transaction.addEventListener('complete', () => resolve(), { once: true });
      transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
      transaction.addEventListener('error', () => reject(transaction.error), { once: true });
    });
    database.close();
  }, options);
}

function durationsInSeconds(value: string): number[] {
  return value.split(',').map((duration) => Number.parseFloat(duration.trim()));
}

async function generateCards(target: Page): Promise<Locator> {
  await completeOnboarding(target);
  await target.goto('/ai/');
  await target.locator('#topic').fill('cestování vlakem');
  await target.locator('#count').fill('4');
  const generate = target.getByRole('button', { name: 'Vytvořit návrh' });
  await expect(generate).toBeEnabled();
  await generate.click();
  const cards = target.locator('.ai-card');
  await expect(cards).toHaveCount(4);
  return cards;
}

test('story dialog and selection toolbar retain their exit state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedCourse(page, { unlockStory: true });
  await page.goto(storyHref);
  await expect(page.getByRole('heading', { name: 'Jakobův nový dům' })).toBeVisible();
  await page.getByRole('button', { name: 'Začít číst' }).click();

  await page.locator('.story-word').first().click();
  const dialog = page.locator('dialog.word-dialog');
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(200);
  const dialogStyle = await dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    return { property: style.transitionProperty, duration: style.transitionDuration };
  });
  expect(dialogStyle.property).toBe('opacity, transform');
  expect(durationsInSeconds(dialogStyle.duration)).toEqual([0.18, 0.18]);

  const screenshotDirectory = path.resolve('artifacts/screenshots');
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, 'motion-story-dialog-390.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Zavřít rozbor slova' }).click();
  await expect(dialog).toHaveAttribute('data-closing', '');
  const dialogExitDuration = await dialog.evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  expect(durationsInSeconds(dialogExitDuration)).toEqual([0.14]);
  await expect(dialog).not.toBeVisible();

  await page.locator('.story-text').evaluate((article) => {
    const paragraph = article.querySelector('p');
    if (!paragraph) throw new Error('Čtenář nemá odstavec k označení.');
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    article.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }));
  });

  const toolbar = page.locator('.selection-toolbar');
  await expect(toolbar).toBeVisible();
  const toolbarDuration = await toolbar.evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  expect(durationsInSeconds(toolbarDuration)).toEqual([0.15, 0.15]);

  await page.locator('.story-text').evaluate((article) => {
    window.getSelection()?.removeAllRanges();
    article.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }));
  });
  await expect(toolbar).toHaveAttribute('data-closing', '');
  const toolbarExitDuration = await toolbar.evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  expect(durationsInSeconds(toolbarExitDuration)).toEqual([0.12]);
  await expect(toolbar).not.toBeVisible();
});

test('reward notice exits and uses an opacity-only reduced-motion fallback', async ({
  context,
  page,
}) => {
  await seedCourse(page, { reward: true });
  await page.reload();
  const notice = page.locator('.reward-notice');
  await expect(notice).toBeVisible();
  const noticeStyle = await notice.evaluate((element) => {
    const style = getComputedStyle(element);
    return { property: style.transitionProperty, duration: style.transitionDuration };
  });
  expect(noticeStyle.property).toBe('opacity, transform');
  expect(durationsInSeconds(noticeStyle.duration)).toEqual([0.26, 0.26]);

  await page.getByRole('button', { name: 'Zavřít oznámení' }).click();
  await expect(notice).toHaveAttribute('data-closing', '');
  const noticeExitDuration = await notice.evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  expect(durationsInSeconds(noticeExitDuration)).toEqual([0.16]);
  await expect(notice).not.toBeVisible();

  const reducedPage = await context.newPage();
  await reducedPage.emulateMedia({ reducedMotion: 'reduce' });
  await reducedPage.goto('/');
  const reducedNotice = reducedPage.locator('.reward-notice');
  await expect(reducedNotice).toBeVisible();
  const reducedStyle = await reducedNotice.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      property: style.transitionProperty,
      duration: style.transitionDuration,
      transform: style.transform,
    };
  });
  expect(reducedStyle).toEqual({ property: 'opacity', duration: '0.16s', transform: 'none' });
  await reducedPage.close();
});

test('AI result cards cap stagger at 90ms and remove movement for reduced motion', async ({
  context,
  page,
}) => {
  const cards = await generateCards(page);
  const cardStyles = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element);
      return {
        delay: style.getPropertyValue('--result-delay').trim(),
        property: style.transitionProperty,
        duration: style.transitionDuration,
      };
    }),
  );
  expect(cardStyles.map((style) => style.delay)).toEqual(['0ms', '30ms', '60ms', '90ms']);
  expect(cardStyles[0]?.property).toBe('opacity, transform, border-color');
  expect(durationsInSeconds(cardStyles[0]?.duration ?? '')).toEqual([0.18, 0.18, 0.17]);

  const reducedPage = await context.newPage();
  await reducedPage.emulateMedia({ reducedMotion: 'reduce' });
  const reducedCards = await generateCards(reducedPage);
  const reducedStyle = await reducedCards.first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      property: style.transitionProperty,
      duration: style.transitionDuration,
      delay: style.transitionDelay,
      transform: style.transform,
    };
  });
  expect(reducedStyle).toEqual({
    property: 'opacity',
    duration: '0.14s',
    delay: '0s',
    transform: 'none',
  });
  await reducedPage.close();
});
