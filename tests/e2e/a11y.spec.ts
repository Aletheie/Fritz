import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import type { Page } from '@playwright/test';
import { completeOnboarding, unlockStoryBook } from './helpers.ts';

const routes = [
  ['home', '/', false],
  ['today lesson', '/today/', false],
  ['course', '/course/', false],
  ['study', '/study/', false],
  ['grammar', '/grammar/', false],
  ['coach', '/coach/', false],
  ['library', '/library/', false],
  ['create vocabulary', '/create/', false],
  ['import vocabulary', '/import/', false],
  ['AI vocabulary', '/ai/', false],
  ['progress', '/progress/', false],
  ['rewards', '/reward/', false],
  ['rival', '/rival/', false],
  ['settings', '/settings/', false],
  ['exam plan', '/exam/', false],
  ['stories', '/stories/', false],
  ['story details', '/stories/a1-maerchen/', true],
  ['story reader', '/stories/a1-maerchen/a1-maerchen-e01/', true],
] as const;

test('first-run onboarding has no WCAG 2.2 A/AA violations', async ({ page }) => {
  await page.goto('/onboarding/');
  await expect(page.getByRole('heading', { name: 'Co chceš s němčinou zvládnout?' })).toBeVisible();
  await expectNoWcagViolations(page);

  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await page.getByRole('button', { name: /Nevím přesně/u }).click();
  await expect(page.getByRole('button', { name: 'Nevím', exact: true })).toBeVisible();
  await expectNoWcagViolations(page);
});

async function unlockFirstStory(page: Page): Promise<void> {
  await unlockStoryBook(page, 'a1-maerchen');
}

async function expectNoWcagViolations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finiteAnimations = document
      .getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(
      finiteAnimations.map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = results.violations;
  if (blocking.length) {
    throw new Error(
      blocking
        .map(
          (violation) =>
            `${violation.id}: ${violation.help}\n${violation.nodes
              .slice(0, 8)
              .map((node) => `  - ${node.target.join(' > ')}: ${node.failureSummary}`)
              .join('\n')}`,
        )
        .join('\n'),
    );
  }
}

for (const [name, route, needsStoryAccess] of routes) {
  test(`${name} has no WCAG 2.2 A/AA violations`, async ({ page }) => {
    await completeOnboarding(page);
    if (needsStoryAccess) await unlockFirstStory(page);
    await page.goto(route);
    await expect(page.getByRole('main')).toBeVisible();
    const minimumTextLength = route === '/today/' ? 100 : 250;
    await page.waitForFunction(
      (minimum) => (document.querySelector('main')?.textContent?.length ?? 0) > minimum,
      minimumTextLength,
    );
    await expectNoWcagViolations(page);
  });
}

test('mobile navigation has readable labels and no WCAG 2.2 A/AA violations', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await completeOnboarding(page);
  await page.goto('/ai/');
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoWcagViolations(page);
});

test('advanced story vocabulary is visibly and accessibly identified', async ({ page }) => {
  await unlockFirstStory(page);
  await page.goto('/stories/a1-maerchen/a1-maerchen-e02/');
  await page.getByRole('button', { name: 'Začít číst' }).click();

  const advancedWord = page.locator('.advanced-word').first();
  await expect(advancedWord).toBeVisible();
  await expect(advancedWord).toHaveAttribute('data-tier', 'advanced');
  await expect(advancedWord).toHaveAttribute('aria-label', /pokročilejší výraz úrovně/u);
  await expect(page.getByText(/Každý nový výraz svítí jen při prvním výskytu/u)).toBeVisible();
  await expectNoWcagViolations(page);
});

test('story retrieval and private production states have no WCAG 2.2 A/AA violations', async ({
  page,
}) => {
  await unlockStoryBook(page, 'a1-haensel-gretel');
  await page.goto('/stories/a1-haensel-gretel/a1-haensel-gretel-e04/');
  await page.getByRole('button', { name: 'Začít číst' }).click();
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  await page.getByRole('button', { name: 'Pokračovat' }).click();

  const recall = page.getByLabel('Chybějící německý tvar');
  await expect(recall).toBeVisible();
  await expectNoWcagViolations(page);
  await recall.fill('Baum');
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.getByRole('status')).toContainText('Nápověda');
  await expectNoWcagViolations(page);
  await page.getByRole('button', { name: 'Provést opravu' }).click();
  await recall.fill('Wald');
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await page.getByRole('button', { name: 'Číst dál' }).click();

  await page.getByRole('button', { name: 'Pokračovat' }).click();
  await page.getByRole('button', { name: 'Dokončit' }).click();
  const production = page.getByLabel('Tvoje německá věta');
  await expect(production).toBeVisible();
  await production.fill('Am Ende finden beide Kinder sicher nach Hause.');
  await page.getByRole('button', { name: 'Porovnat s dějem' }).click();
  await expect(page.getByText('Text zůstane jen na této obrazovce.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Opora přímo z děje' })).toBeVisible();
  await expectNoWcagViolations(page);
});
