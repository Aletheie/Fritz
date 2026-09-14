import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { deriveSkillStates } from '../../src/lib/domain/learning/skills.ts';
import { deriveReviewStats } from '../../src/lib/domain/stats/review-stats.ts';
import { completeOnboarding } from '../e2e/helpers.ts';
import { createPerformanceFixture } from '../fixtures/performance.ts';

import type { Page, TestInfo } from '@playwright/test';

type BrowserMetrics = {
  lcpMs: number;
  cls: number;
  longTasks: Array<{ startTime: number; duration: number }>;
  events: Array<{ name: string; duration: number; interactionId: number }>;
};
type MetricWindow = Window & { fritzPerformanceMetrics: BrowserMetrics };

async function observePerformance(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const metrics: BrowserMetrics = { lcpMs: 0, cls: 0, longTasks: [], events: [] };
    (window as unknown as MetricWindow).fritzPerformanceMetrics = metrics;
    let sessionStart = 0;
    let sessionEnd = 0;
    let sessionShift = 0;
    for (const type of ['largest-contentful-paint', 'layout-shift', 'longtask', 'event']) {
      if (!PerformanceObserver.supportedEntryTypes.includes(type)) continue;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') metrics.lcpMs = entry.startTime;
          if (entry.entryType === 'longtask')
            metrics.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
          if (entry.entryType === 'event') {
            const event = entry as PerformanceEntry & { interactionId: number };
            if (event.interactionId)
              metrics.events.push({
                name: event.name,
                duration: event.duration,
                interactionId: event.interactionId,
              });
          }
          if (entry.entryType === 'layout-shift') {
            const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
            if (shift.hadRecentInput) continue;
            if (entry.startTime - sessionEnd > 1_000 || entry.startTime - sessionStart > 5_000) {
              sessionStart = entry.startTime;
              sessionShift = 0;
            }
            sessionEnd = entry.startTime;
            sessionShift += shift.value;
            metrics.cls = Math.max(metrics.cls, sessionShift);
          }
        }
      }).observe({ type, buffered: true, ...(type === 'event' ? { durationThreshold: 16 } : {}) });
    }
  });
}

async function seedLargeLibrary(page: Page, count: number): Promise<void> {
  await completeOnboarding(page);
  const fixture = createPerformanceFixture(count, count * 2);
  const projectionData = {
    reviewStats: deriveReviewStats(fixture.reviews),
    skillStates: deriveSkillStates(fixture.learningEvidence),
  };
  const data = { backup: fixture, projections: projectionData };
  await page.evaluate(async (serialized) => {
    const { backup, projections } = JSON.parse(serialized) as typeof data;
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fritz');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    try {
      const transaction = database.transaction(
        [
          'decks',
          'notes',
          'cards',
          'reviews',
          'settings',
          'course',
          'learningEvidence',
          'skillStates',
          'reviewStats',
          'dailySessions',
        ],
        'readwrite',
      );
      const done = new Promise<void>((resolve, reject) => {
        transaction.addEventListener('complete', () => resolve(), { once: true });
        transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
        transaction.addEventListener('error', () => reject(transaction.error), { once: true });
      });
      for (const name of transaction.objectStoreNames) transaction.objectStore(name).clear();
      for (const name of ['decks', 'notes', 'cards', 'reviews', 'learningEvidence'] as const) {
        const store = transaction.objectStore(name);
        for (const value of backup[name]) store.put(value);
      }
      for (const state of projections.skillStates)
        transaction.objectStore('skillStates').put(state);
      transaction.objectStore('reviewStats').put(projections.reviewStats);
      transaction.objectStore('settings').put(backup.settings);
      transaction.objectStore('course').put(backup.course);
      await done;
    } finally {
      database.close();
    }
  }, JSON.stringify(data));
}

async function afterPaint(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now()))),
      ),
  );
}

async function attachMetrics(
  page: Page,
  info: TestInfo,
  name: string,
  extra: Record<string, unknown>,
): Promise<void> {
  const metrics = await page.evaluate(() => ({
    ...(window as unknown as MetricWindow).fritzPerformanceMetrics,
    domElements: document.querySelectorAll('*').length,
    wordCards: document.querySelectorAll('.word-card').length,
    resources: performance.getEntriesByType('resource').map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      return {
        path: new URL(resource.name).pathname,
        type: resource.initiatorType,
        durationMs: resource.duration,
        transferBytes: resource.transferSize,
        decodedBytes: resource.decodedBodySize,
      };
    }),
  }));
  await info.attach(name, {
    body: JSON.stringify({ ...extra, ...metrics }, null, 2),
    contentType: 'application/json',
  });
}

for (const count of [1_000, 10_000]) {
  test(`${count} words: cold library, search, sorting, filters and bounded DOM`, async ({
    page,
    context,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await observePerformance(page);
    await seedLargeLibrary(page, count);
    const mobile = info.project.name === 'mobile-cpu4';
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (mobile) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/library/');
    await expect(page.locator('.word-card').first()).toBeVisible({ timeout: 40_000 });
    const readyMs = await afterPaint(page);
    const initialDom = await page.locator('*').count();
    const initialCards = await page.locator('.word-card').count();
    await attachMetrics(page, info, 'cold-library', { count, cpuRate: mobile ? 4 : 1, readyMs });
    expect.soft(readyMs).toBeLessThan(mobile ? 15_000 : 5_000);
    expect
      .soft(initialCards, 'Only the current page of vocabulary should be rendered.')
      .toBeLessThanOrEqual(50);
    expect.soft(initialDom).toBeLessThan(5_000);

    const samples: Array<{ action: string; durationMs: number }> = [];
    /* oxlint-disable no-await-in-loop -- measure each complete interaction in sequence. */
    for (const suffix of ['00099', '00500', '00001']) {
      const start = await page.evaluate(() => performance.now());
      await page.locator('#library-search').fill(suffix);
      await expect(page.locator('.word-card')).toHaveCount(1);
      samples.push({ action: `search-${suffix}`, durationMs: (await afterPaint(page)) - start });
    }
    const clearStart = await page.evaluate(() => performance.now());
    await page.getByRole('button', { name: 'Vymazat hledání' }).click();
    await expect(page.locator('.results-heading')).toContainText(`${count} z ${count}`);
    samples.push({ action: 'clear-search', durationMs: (await afterPaint(page)) - clearStart });
    for (const sort of ['alphabetical', 'mastery', 'due', 'recent']) {
      const start = await page.evaluate(() => performance.now());
      await page.getByLabel('Seřadit slovíčka').selectOption(sort);
      samples.push({ action: `sort-${sort}`, durationMs: (await afterPaint(page)) - start });
    }
    /* oxlint-enable no-await-in-loop */
    const filterStart = await page.evaluate(() => performance.now());
    await page.getByLabel('Filtrovat podle tagu').selectOption('group-1');
    await expect(page.locator('.results-heading')).toContainText(`${count / 20} z ${count}`);
    samples.push({ action: 'tag-filter', durationMs: (await afterPaint(page)) - filterStart });
    await info.attach('interactions', {
      body: JSON.stringify(samples, null, 2),
      contentType: 'application/json',
    });
    for (const sample of samples)
      expect.soft(sample.durationMs, sample.action).toBeLessThan(mobile ? 1_500 : 500);
    expect(errors).toEqual([]);
    await attachMetrics(page, info, 'after-interactions', { count, samples });
  });
}

test('large library stays usable across pages, edits and repeated navigation', async ({
  page,
  context,
}, info) => {
  await observePerformance(page);
  await seedLargeLibrary(page, 10_000);
  const cdp = await context.newCDPSession(page);
  if (info.project.name === 'mobile-cpu4')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('/library/');
  await expect(page.locator('.word-card')).toHaveCount(50);
  const firstTitle = await page.locator('.word-card h2').first().textContent();
  await expect(page.locator('.reward-notice')).toBeVisible();
  await page.getByRole('button', { name: 'Další stránka', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Výsledky hledání', exact: true })).toBeFocused();
  await expect(page.locator('.word-card')).toHaveCount(50);
  await expect(page.locator('.word-card h2').first()).not.toHaveText(firstTitle!);
  await page.locator('#library-search').fill('09999');
  await expect(page.locator('.word-card')).toHaveCount(1);
  await page.getByRole('button', { name: /^Upravit /u }).click();
  await expect(page.locator('.editor-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Uložit změny', exact: true }).click();
  await expect(page.locator('.editor-message')).toHaveText('Změny byly uloženy.');
  await page.getByRole('button', { name: 'Zavřít editor' }).click();
  await page.getByRole('button', { name: 'Vymazat hledání' }).click();
  await expect(page.locator('.word-card')).toHaveCount(50);
  await expect(page.getByRole('button', { name: 'Předchozí stránka', exact: true })).toBeDisabled();
  await cdp.send('HeapProfiler.collectGarbage');
  const heapBefore = await cdp.send('Runtime.getHeapUsage');
  const domCounts: number[] = [];
  /* oxlint-disable no-await-in-loop -- measure each route after its content renders. */
  for (const route of [
    '/progress/',
    '/today/',
    '/course/',
    '/library/',
    '/progress/',
    '/library/',
  ]) {
    const link = page.locator(`a[href="${route}"]`).filter({ visible: true }).first();
    if (await link.count()) await link.click();
    else {
      await page.evaluate((href) => {
        const anchor = document.createElement('a');
        anchor.href = href;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      }, route);
    }
    await expect(page).toHaveURL(new RegExp(`${route}$`, 'u'));
    await afterPaint(page);
    if (route === '/library/') {
      await expect(page.locator('.word-card')).toHaveCount(50);
      domCounts.push(await page.locator('*').count());
    }
  }
  /* oxlint-enable no-await-in-loop */
  expect(Math.max(...domCounts) - Math.min(...domCounts)).toBeLessThan(100);
  await cdp.send('HeapProfiler.collectGarbage');
  const heap = await cdp.send('Runtime.getHeapUsage');
  await attachMetrics(page, info, 'navigation-and-memory', { domCounts, heapBefore, heap });
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await info.attach('large-library', {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
});
