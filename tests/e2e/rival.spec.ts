import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type {
  AppSettings,
  CourseProgress,
  StudyCard,
  ReviewLog,
} from '../../src/lib/domain/types.ts';
import { completeOnboarding } from './helpers.ts';

async function savedState(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fritz');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const transaction = database.transaction(['course', 'cards', 'reviews']);
    // oxlint-disable-next-line unicorn/consistent-function-scoping -- this helper runs in the browser, outside the test module.
    function value<T>(request: IDBRequest<T>): Promise<T> {
      return new Promise((resolve, reject) => {
        request.addEventListener('success', () => resolve(request.result), { once: true });
        request.addEventListener('error', () => reject(request.error), { once: true });
      });
    }
    const [course, cards, reviews] = await Promise.all([
      value<CourseProgress>(transaction.objectStore('course').get('course')),
      value<StudyCard[]>(transaction.objectStore('cards').getAll()),
      value<ReviewLog[]>(transaction.objectStore('reviews').getAll()),
    ]);
    database.close();
    return { course, cards, reviews };
  });
}

async function settings(page: Page, patch: Partial<AppSettings>) {
  await page.evaluate(async (values) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fritz');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const transaction = database.transaction('settings', 'readwrite');
    const store = transaction.objectStore('settings');
    const request = store.get('app');
    request.addEventListener('success', () => store.put({ ...request.result, ...values }), {
      once: true,
    });
    await new Promise<void>((resolve, reject) => {
      transaction.addEventListener('complete', () => resolve(), { once: true });
      transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
    });
    database.close();
  }, patch);
}

async function answerCorrectly(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Potvrdit odpověď' })).toBeVisible();
  const state = await savedState(page);
  const question = state.course.rivalry!.match!.rounds.at(-1)!.question;
  if (question.options.length)
    await page.getByRole('radio', { name: question.answer, exact: true }).check();
  else await page.getByRole('textbox').fill(question.answer);
  await page.getByRole('button', { name: 'Potvrdit odpověď' }).click();
  await expect(page.getByText('Přesná odpověď.', { exact: true })).toBeVisible();
}

async function noViolations(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({ target: node.target, reason: node.failureSummary })),
    })),
  ).toEqual([]);
}

async function noOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const arena = document.querySelector('.arena')!;
    return Math.max(
      document.documentElement.scrollWidth - innerWidth,
      arena.scrollWidth - arena.clientWidth,
    );
  });
  expect(overflow).toBeLessThanOrEqual(1);
}

test('a five-round duel supports tactics, reload, rematch and unchanged learning progress', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await completeOnboarding(page);
  const before = await savedState(page);
  await page.getByRole('link', { name: /Souboj:/u }).click();
  await expect(page.getByRole('button', { name: 'Začít souboj', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Začít souboj', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await page.screenshot({
    path: 'artifacts/screenshots/rival-invitation-390.png',
    fullPage: true,
    animations: 'disabled',
  });
  await noViolations(page);
  await page.getByText('Promluvit se soupeřem', { exact: true }).click();
  await page.getByRole('button', { name: 'Prozraď svůj plán' }).click();
  await expect(page.getByRole('button', { name: 'Prozraď svůj plán' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByText('Promluvit se soupeřem', { exact: true }).click();
  await page.getByText('Jak chceš hrát?', { exact: true }).click();
  await page.getByRole('radio', { name: /Využít slabinu/u }).check();
  await page.getByRole('button', { name: 'Začít souboj', exact: true }).click();
  await expect(page.getByText('Kolo 1 z 5', { exact: true })).toBeVisible();
  const committed = (await savedState(page)).course.rivalry!.match!.rounds[0];
  await page.reload();
  await expect(page.getByText('Kolo 1 z 5', { exact: true })).toBeVisible();
  expect((await savedState(page)).course.rivalry!.match!.rounds[0]).toEqual(committed);
  await expect(page.locator('#round-question')).toBeFocused();
  await noOverflow(page);
  await page.screenshot({
    path: 'artifacts/screenshots/rival-round-390.png',
    fullPage: true,
    animations: 'disabled',
  });
  await noViolations(page);
  await page.getByRole('button', { name: 'Bonus 2×' }).click();
  await answerCorrectly(page);
  await expect(page.getByRole('button', { name: 'Další kolo' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Další kolo' })).toBeVisible();
  await page.getByRole('button', { name: 'Další kolo' }).click();
  await expect(page.getByText('Kolo 2 z 5', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bonus využitý' })).toBeDisabled();
  const discarded = (await savedState(page)).course.rivalry!.match!.rounds.at(-1)!.question
    .sourceId;
  await page.getByRole('button', { name: 'Vyměnit otázku' }).click();
  await expect(page.getByText('Výměna využitá', { exact: true })).toBeVisible();
  expect((await savedState(page)).course.rivalry!.match!.rounds.at(-1)!.question.sourceId).not.toBe(
    discarded,
  );
  /* oxlint-disable no-await-in-loop -- Each round depends on the previous result. */
  for (let round = 2; round <= 5; round += 1) {
    await answerCorrectly(page);
    if (round < 5) {
      await page.getByRole('button', { name: 'Další kolo' }).click();
    }
  }
  /* oxlint-enable no-await-in-loop */
  await expect(page.getByRole('button', { name: 'Zobrazit výsledek' })).toBeVisible();
  await page.getByRole('button', { name: 'Zobrazit výsledek' }).click();
  await expect(page.getByText('Pět kol. Hotovo.', { exact: true })).toBeVisible();
  await expect(page.getByText('Správně 5 z 5 otázek.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hotovo, zpět domů' })).toBeInViewport({ ratio: 1 });
  await expect(page.locator('.round-review')).toBeHidden();
  await noViolations(page);
  await page.screenshot({
    path: 'artifacts/screenshots/rival-result-390.png',
    fullPage: true,
    animations: 'disabled',
  });
  const completed = await savedState(page);
  expect(completed.course.rivalry!.history).toHaveLength(1);
  expect(completed.course.rivalry!.history[0].userScore).toBe(6);
  expect(completed.cards).toEqual(before.cards);
  expect(completed.reviews).toEqual(before.reviews);
  expect(completed.course.events).toEqual(before.course.events);
  await page.getByText('Promluvit se soupeřem', { exact: true }).click();
  await page.getByRole('button', { name: 'Prozraď svůj plán' }).click();
  await expect(page.getByRole('button', { name: 'Prozraď svůj plán' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Jak mě čteš?' }).click();
  await expect(page.locator('.speech')).toContainText('Pět přesných odpovědí.');
  await page.getByText('Jak chceš hrát?', { exact: true }).click();
  await page.getByRole('radio', { name: /^Větší výzva/u }).check();
  await page.getByRole('button', { name: 'Chci odvetu' }).click();
  await expect(page.getByText('Kolo 1 z 5', { exact: true })).toBeVisible();
  const rematch = (await savedState(page)).course.rivalry!;
  expect(rematch.match!.id).not.toBe(completed.course.rivalry!.match!.id);
  expect(rematch.history).toHaveLength(1);
  expect(rematch.match!.strategy).toBe('pressure');
  await page.goto('/progress/');
  await expect(page.getByRole('link', { name: 'Pokračovat v souboji', exact: true })).toBeVisible();
  await expect(page.locator('.rival-thought')).toContainText('Pět přesných odpovědí.');
  await page.getByText('Přečíst soupeřovu taktiku', { exact: true }).click();
  await expect(page.getByText('Slabší místo:', { exact: false })).toBeVisible();
  await page
    .locator('.rival-duel')
    .screenshot({ path: 'artifacts/screenshots/rival-weekly-390.png', animations: 'disabled' });
  await page.getByRole('link', { name: 'Pokračovat v souboji', exact: true }).click();
  await expect(page.getByText('Kolo 1 z 5', { exact: true })).toBeVisible();
  expect((await savedState(page)).course.rivalry!.match!.id).toBe(rematch.match!.id);
});

test('the rival remains optional when either rivalry or all game features are disabled', async ({
  page,
}) => {
  await completeOnboarding(page);
  await page.goto('/settings/');
  await page.getByText('Soukromý soupeř', { exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /^Soukromý soupeř/u })).not.toBeChecked();
  await page.getByRole('button', { name: 'Uložit nastavení', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Uloženo', exact: true })).toBeVisible();
  await page.goto('/rival/');
  await expect(page.getByRole('heading', { name: 'Soupeření máš vypnuté.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Začít souboj', exact: true })).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Kam dál' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Souboj:/u })).toHaveCount(0);
  await settings(page, { gamificationEnabled: false, rivalryEnabled: true });
  await page.goto('/rival/');
  await expect(page.getByRole('heading', { name: 'Soupeření máš vypnuté.' })).toBeVisible();
  expect((await savedState(page)).course.rivalry?.match).toBeUndefined();
});

test('English, keyboard controls and reduced motion work at narrow and desktop widths', async ({
  page,
}) => {
  await completeOnboarding(page);
  await settings(page, { motherTongue: 'en', reduceMotion: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/rival/');
  await expect(page.getByRole('button', { name: 'Start match', exact: true })).toBeVisible();
  await page.screenshot({
    path: 'artifacts/screenshots/rival-invitation-1280.png',
    fullPage: true,
    animations: 'disabled',
  });
  await noOverflow(page);
  await page.getByRole('button', { name: 'Start match', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Round 1 of 5', { exact: true })).toBeVisible();
  await expect(page.locator('#round-question')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox')).toBeFocused();
  const answer = (await savedState(page)).course.rivalry!.match!.rounds[0].question.answer;
  await page.keyboard.type(answer);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Correct answer.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next round' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Round 2 of 5', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  await noOverflow(page);
  await noViolations(page);
  const eyeDuration = await page
    .locator('.robot .eyes')
    .evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(Number.parseFloat(eyeDuration)).toBeLessThanOrEqual(0.001);
  await page.screenshot({
    path: 'artifacts/screenshots/rival-round-320.png',
    fullPage: true,
    animations: 'disabled',
  });
});

test('typing tools preserve the cursor, swapping protects an answer and a paused match resumes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await completeOnboarding(page);
  await page.goto('/rival/');
  await expect(page.getByRole('button', { name: 'Začít souboj', exact: true })).toBeInViewport({
    ratio: 1,
  });
  await page.getByRole('button', { name: 'Začít souboj', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Tvoje německá odpověď' });
  await input.fill('schon');
  await input.evaluate((element: HTMLInputElement) => element.setSelectionRange(3, 4));
  await page.getByRole('button', { name: 'Vložit ö', exact: true }).click();
  await expect(input).toHaveValue('schön');
  await expect(input).toBeFocused();
  expect(await input.evaluate((element: HTMLInputElement) => element.selectionStart)).toBe(4);
  await page.getByRole('button', { name: 'Bonus 2×', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bonus 2× zapnutý' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Bonus 2× zapnutý' }).click();
  const before = (await savedState(page)).course.rivalry!.match!;
  await page.getByRole('button', { name: 'Vyměnit otázku', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nechat otázku' })).toBeFocused();
  await noViolations(page);
  await page.getByRole('button', { name: 'Nechat otázku' }).click();
  await expect(input).toHaveValue('schön');
  await expect(page.getByRole('button', { name: 'Vyměnit otázku', exact: true })).toBeFocused();
  expect((await savedState(page)).course.rivalry!.match!).toEqual(before);
  await page.getByRole('button', { name: 'Vyměnit otázku', exact: true }).click();
  await page.getByRole('button', { name: 'Vyměnit i tak' }).click();
  await expect(page.getByText('Výměna využitá', { exact: true })).toBeVisible();
  const after = (await savedState(page)).course.rivalry!.match!;
  expect(after.rounds[0].question.sourceId).not.toBe(before.rounds[0].question.sourceId);
  await expect(input).toHaveValue('');
  await page.getByRole('link', { name: 'Přerušit souboj' }).click();
  await expect(page.getByRole('heading', { name: 'Kam dál' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Souboj:/u })).toContainText(
    'Pokračovat · kolo 1 z 5',
  );
  await page.getByRole('link', { name: /Souboj:/u }).click();
  await expect(input).toBeVisible();
  expect((await savedState(page)).course.rivalry!.match!).toEqual(after);

  await page.setViewportSize({ width: 390, height: 480 });
  await input.fill('eine falsche Antwort');
  await expect(page.getByRole('button', { name: 'Potvrdit odpověď' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Potvrdit odpověď' })).toBeInViewport({ ratio: 1 });
  await expect
    .poll(() =>
      page.locator('.round-footer').evaluate((footer) => {
        const answer = document.querySelector('#duel-answer')!.getBoundingClientRect();
        const action = footer.getBoundingClientRect();
        return action.top < answer.bottom && action.bottom > answer.top;
      }),
    )
    .toBe(false);
  await page.getByRole('button', { name: 'Potvrdit odpověď' }).click();
  await expect(page.getByText('Správná odpověď:', { exact: true })).toBeVisible();
  await expect(page.locator('.explanation')).toHaveAttribute('open', '');
  await expect(page.locator('.explanation p')).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Další kolo' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Další kolo' })).toBeInViewport({ ratio: 1 });
  await noOverflow(page);
  await page.screenshot({
    path: 'artifacts/screenshots/rival-feedback-390-short.png',
    animations: 'disabled',
  });
});

test('the result offers focused mistake review and a clear way to finish', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await completeOnboarding(page);
  await page.goto('/rival/');
  await page.getByRole('button', { name: 'Začít souboj', exact: true }).click();
  await page.getByRole('textbox').fill('eine falsche Antwort');
  await page.getByRole('button', { name: 'Potvrdit odpověď' }).click();
  await expect(page.getByText('Správná odpověď:', { exact: true })).toBeVisible();
  const missed = (await savedState(page)).course.rivalry!.match!.rounds[0].question;
  /* oxlint-disable no-await-in-loop -- Each round depends on the previous result. */
  for (let round = 2; round <= 5; round += 1) {
    await page.getByRole('button', { name: 'Další kolo' }).click();
    await answerCorrectly(page);
  }
  /* oxlint-enable no-await-in-loop */
  await page.getByRole('button', { name: 'Zobrazit výsledek' }).click();
  await expect(page.getByText('Správně 4 z 5 otázek.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Hotovo, zpět domů' })).toBeInViewport({ ratio: 1 });
  await page.getByText('Projít otázky k procvičení (1)', { exact: true }).click();
  await expect(page.locator('.round-review li')).toHaveCount(1);
  await expect(page.locator('.round-review')).toContainText(missed.prompt.cs);
  await expect(page.locator('.review-answer')).toHaveText(missed.answer);
  await expect(page.locator('.round-review')).toContainText(missed.explanation.cs);
  await page.getByRole('checkbox', { name: 'Ukázat i správné odpovědi' }).check();
  await expect(page.locator('.round-review li')).toHaveCount(5);
  await noViolations(page);
  await page.getByRole('link', { name: 'Hotovo, zpět domů' }).click();
  await expect(page.getByRole('heading', { name: 'Kam dál' })).toBeVisible();
  expect((await savedState(page)).course.rivalry!.history).toHaveLength(1);
});
