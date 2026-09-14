import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers.ts';

const viewports = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 812 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1280', width: 1280, height: 900 },
  { name: '1440', width: 1440, height: 1000 },
  { name: 'landscape', width: 844, height: 390 },
] as const;

test.beforeEach(async ({ page }) => {
  await completeOnboarding(page);
});

for (const viewport of viewports) {
  test(`homepage reflows at ${viewport.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Kam dál' })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    if (viewport.width < 900) {
      const mobileOrder = await page.evaluate(() => ({
        plan: document.querySelector('.today-plan')?.getBoundingClientRect().top ?? Infinity,
        journey: document.querySelector('.home-journey')?.getBoundingClientRect().top ?? -Infinity,
      }));
      expect(mobileOrder.plan).toBeLessThan(mobileOrder.journey);
    }

    const smallestNode = await page
      .locator('.node-button')
      .evaluateAll((nodes) =>
        Math.min(
          ...nodes.map((node) =>
            Math.min(node.getBoundingClientRect().width, node.getBoundingClientRect().height),
          ),
        ),
      );
    expect(smallestNode).toBeGreaterThanOrEqual(44);

    const screenshotDirectory = path.resolve('artifacts/screenshots');
    await mkdir(screenshotDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(screenshotDirectory, `home-${viewport.name}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  });
}

test('path remains an ordered, keyboard-accessible journey', async ({ page }) => {
  const learningPath = page.locator('ol.learning-path');
  await expect(learningPath).toBeVisible();
  await expect(learningPath.locator('[data-path-node-anchor]')).toHaveCount(8);
  await expect(page.locator('svg.connector')).toBeVisible();

  await page.keyboard.press('Tab');
  const focusVisible = await page.evaluate(() => document.activeElement?.matches(':focus-visible'));
  expect(focusVisible).toBe(true);
});

test('reduced motion keeps content and removes meaningful spatial animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Kam dál' })).toBeVisible();
  const duration = await page
    .locator('.node-button')
    .first()
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  const longestDuration = Math.max(
    ...duration.split(',').map((value) => Number.parseFloat(value.trim())),
  );
  expect(longestDuration).toBeLessThanOrEqual(0.001);
});

test('homepage reflows at 200% browser-equivalent zoom', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.zoom = '200%';
  });
  await expect(page.getByRole('heading', { name: 'Kam dál' })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('full syllabus link opens the complete ordered course map', async ({ context, page }) => {
  await page.getByRole('link', { name: 'Celá osnova' }).click();
  await expect(page).toHaveURL(/\/course\/$/u);
  await expect(page.getByRole('heading', { name: 'Celá osnova', level: 1 })).toBeVisible();
  await expect(page.locator('.level-section')).toHaveCount(10);
  await expect(page.locator('.chapter-row')).toHaveCount(120);
  await expect(page.getByText('Nákup na trhu', { exact: true })).toBeVisible();
  await expect(page.getByText('Komunikace v krizové situaci', { exact: true })).toBeVisible();
  await expect(page.locator('.state-current details[open]')).toHaveCount(1);
  await expect(page.getByRole('link', { name: /Katalog gramatiky/u })).toBeVisible();

  const courseViewports = [
    { name: 'course-430', width: 430, height: 932 },
    { name: 'course-1440', width: 1440, height: 1000 },
  ] as const;
  const screenshotDirectory = path.resolve('artifacts/screenshots');
  await mkdir(screenshotDirectory, { recursive: true });

  await Promise.all(
    courseViewports.map(async (viewport) => {
      const viewportPage = await context.newPage();
      await viewportPage.setViewportSize({ width: viewport.width, height: viewport.height });
      await viewportPage.goto('/course/');
      await expect(
        viewportPage.getByRole('heading', { name: 'Celá osnova', level: 1 }),
      ).toBeVisible();
      const overflow = await viewportPage.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      await viewportPage.screenshot({
        path: path.join(screenshotDirectory, `${viewport.name}.png`),
        fullPage: true,
        animations: 'disabled',
      });
      await viewportPage.close();
    }),
  );
});

test('mother tongue switches the app to English and persists across pages', async ({ page }) => {
  await page.goto('/settings/');
  await page.getByRole('radio', { name: /English/u }).check();
  await page.getByRole('button', { name: 'Save settings' }).click();

  await expect(page.getByText('Settings saved.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'What’s next' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Full course map' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'What’s next' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.getByRole('link', { name: 'Full course map' }).click();
  await expect(page.getByRole('heading', { name: 'Full course map', level: 1 })).toBeVisible();
  await expect(page.locator('.chapter-row')).toHaveCount(120);
  await expect(page.getByText('Shopping at the market', { exact: true })).toBeVisible();
  await expect(page.getByText('Communication during a crisis', { exact: true })).toBeVisible();

  await page.goto('/grammar/');
  await expect(page.getByRole('heading', { name: 'Find the grammar you need' })).toBeVisible();

  await page.goto('/library/');
  await expect(
    page.getByRole('heading', { name: 'All your vocabulary in one place' }),
  ).toBeVisible();
});
