import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { caseFiles } from '../../src/lib/domain/cases/catalog.ts';
import { caseRules } from '../../src/lib/domain/cases/rules.ts';
import type { CaseFile } from '../../src/lib/domain/cases/types.ts';
import type { CourseProgress, MotherTongue } from '../../src/lib/domain/types.ts';
import { completeOnboarding } from './helpers.ts';

async function savedCourse(page: Page): Promise<CourseProgress> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fritz');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const transaction = database.transaction('course');
    const value = await new Promise<CourseProgress>((resolve, reject) => {
      const request = transaction.objectStore('course').get('course');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    database.close();
    return value;
  });
}

async function chooseLanguage(page: Page, language: MotherTongue) {
  await page.evaluate(async (motherTongue) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fritz');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const transaction = database.transaction('settings', 'readwrite');
    const store = transaction.objectStore('settings');
    const request = store.get('app');
    request.addEventListener('success', () => store.put({ ...request.result, motherTongue }), {
      once: true,
    });
    await new Promise<void>((resolve, reject) => {
      transaction.addEventListener('complete', () => resolve(), { once: true });
      transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
    });
    database.close();
  }, language);
}

async function openDocument(
  page: Page,
  item: CaseFile,
  clueId: string,
  language: MotherTongue = 'cs',
) {
  const document = item.documents.find((candidate) =>
    candidate.lines.some((line) => line.id === clueId),
  )!;
  await page
    .getByRole('group', { name: language === 'cs' ? 'Otevřít podklad' : 'Open a document' })
    .getByRole('button', { name: new RegExp(document.title[language], 'u') })
    .click();
  return document.lines.find((line) => line.id === clueId)!;
}

async function toggleClue(
  page: Page,
  item: CaseFile,
  clueId: string,
  language: MotherTongue = 'cs',
) {
  const line = await openDocument(page, item, clueId, language);
  const passage = page
    .locator('#case-document')
    .getByRole('button', { name: line.textDe, exact: true });
  const wasSelected = await passage.getAttribute('aria-pressed');
  await passage.click();
  await expect(passage).toHaveAttribute('aria-pressed', wasSelected === 'true' ? 'false' : 'true');
  await expect(passage).toBeEnabled();
}

async function chooseAnswer(
  page: Page,
  item: CaseFile,
  stepIndex: number,
  language: MotherTongue = 'cs',
) {
  await page
    .getByRole('button', {
      name: language === 'cs' ? 'Mám teorii' : 'I have a theory',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('heading', {
      name: language === 'cs' ? 'Která verze sedí?' : 'Which theory fits?',
      exact: true,
    }),
  ).toBeFocused();
  const rule = caseRules[item.id].steps[stepIndex];
  const choice = item.steps[stepIndex].choices.find((candidate) => candidate.id === rule.choiceId)!;
  await page
    .getByRole('group', { name: language === 'cs' ? 'Možné odpovědi' : 'Possible answers' })
    .getByRole('button', { name: choice.textDe, exact: true })
    .click();
  await expect(page.locator('#case-document .passage').first()).toBeVisible();
}

async function confirm(page: Page, language: MotherTongue = 'cs') {
  await page
    .getByRole('button', { name: language === 'cs' ? /^Potvrdit odpověď/u : /^Confirm answer/u })
    .click();
}

async function solve(page: Page, item: CaseFile, stepIndex: number, language: MotherTongue = 'cs') {
  await chooseAnswer(page, item, stepIndex, language);
  for (const clueId of caseRules[item.id].steps[stepIndex].clueIds) {
    // oxlint-disable-next-line no-await-in-loop -- user interactions must commit in order.
    await toggleClue(page, item, clueId, language);
  }
  await confirm(page, language);
  await expect(
    page.getByRole('heading', {
      name: item.steps[stepIndex].finding[language],
    }),
  ).toBeFocused();
}

async function accessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    result.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({ target: node.target, reason: node.failureSummary })),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `artifacts/screenshots/cases-detective-${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}

test('reading starts with a clear Czech question and real paragraphs, then progressively enables answering and highlighting', async ({
  page,
}) => {
  const item = caseFiles[1];
  await completeOnboarding(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/cases/soundcheck/');
  await expect(page.getByRole('heading', { name: item.steps[0].question.cs })).toBeFocused();
  await expect(page.getByText(item.steps[0].context.cs, { exact: true })).toBeVisible();
  await openDocument(page, item, 'show-move');
  await expect(page.locator('#case-document .document-body p')).toHaveCount(4);
  await expect(page.locator('#case-document .document-body')).toContainText(
    item.documents[1].lines[0].textDe,
  );
  await expect(page.locator('input')).toHaveCount(0);
  await expect(page.locator('#case-document .passage')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Možné odpovědi' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mám teorii', exact: true })).toBeInViewport();
  await accessible(page);
  await screenshot(page, 'reading-desktop');
  await page.getByRole('button', { name: 'Mám teorii', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Možné odpovědi' }).getByRole('button')).toHaveCount(
    3,
  );
  await expect(page.locator('#case-document .passage')).toHaveCount(0);
  await accessible(page);
  await screenshot(page, 'answer-desktop');
  await page
    .getByRole('group', { name: 'Možné odpovědi' })
    .getByRole('button', { name: item.steps[0].choices[2].textDe })
    .click();
  await expect(page.locator('#case-document .passage')).toHaveCount(4);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Potvrdit odpověď', exact: true })).toBeDisabled();
  await toggleClue(page, item, 'show-move');
  await toggleClue(page, item, 'show-same');
  await accessible(page);
  await screenshot(page, 'highlight-desktop');
  await confirm(page);
  await expect(page.getByRole('heading', { name: item.steps[0].finding.cs })).toBeFocused();
  await expect(page.locator('#case-document .passage')).toHaveCount(0);
  await expect(page.locator('#case-document mark')).toHaveCount(2);
  await screenshot(page, 'feedback-desktop');
});

test('the mobile case uses one pane at a time, resumes highlights and completes with feedback and replay', async ({
  page,
}) => {
  const item = caseFiles[0];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await completeOnboarding(page);
  const before = await savedCourse(page);
  await page.getByRole('link', { name: /Jazykové případy · Beta/u }).click();
  await page.getByRole('link', { name: `Otevřít případ: ${item.title.cs}` }).click();
  await expect(page.getByRole('heading', { name: item.steps[0].question.cs })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Začni u stop' })).not.toBeVisible();
  await page.getByText('Pomoc se slovíčky', { exact: true }).click();
  await expect(page.getByText('zip', { exact: true })).toBeVisible();
  await page.getByText('Pomoc se slovíčky', { exact: true }).click();
  await accessible(page);
  await screenshot(page, 'reading-mobile');
  await page.getByRole('button', { name: 'Mám teorii', exact: true }).click();
  await expect(page.locator('#case-document')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Která verze sedí?' })).toBeFocused();
  await accessible(page);
  await screenshot(page, 'answer-mobile');
  await page
    .getByRole('group', { name: 'Možné odpovědi' })
    .getByRole('button', { name: item.steps[0].choices[1].textDe })
    .click();
  await toggleClue(page, item, 'bag-description');
  await expect(page.getByRole('button', { name: /^Potvrdit odpověď/u })).toBeDisabled();
  await page.reload();
  await expect(
    page.locator('#case-document').getByRole('button', { name: item.documents[0].lines[0].textDe }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect((await savedCourse(page)).cases?.backpack?.answers[0].choiceId).toBe('b');
  await toggleClue(page, item, 'bag-red');
  await confirm(page);
  await expect(
    page.getByRole('heading', { name: 'Odpověď sedí. Zkus jiné pasáže.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Potřebuji nápovědu' }).click();
  await expect(page.getByText(item.steps[0].hint.cs, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zpět k textům', exact: true }).click();
  await toggleClue(page, item, 'bag-red');
  await toggleClue(page, item, 'bag-blue');
  await accessible(page);
  await screenshot(page, 'highlight-mobile');
  await confirm(page);
  await expect(page.getByRole('heading', { name: item.steps[0].finding.cs })).toBeFocused();
  await expect(page.getByText(item.steps[0].replyDe, { exact: true })).toBeVisible();
  await accessible(page);
  await screenshot(page, 'feedback-mobile');
  await page.getByRole('button', { name: 'Texty', exact: true }).click();
  await expect(page.locator('#case-document mark')).toHaveCount(1);
  await page.getByRole('button', { name: 'Zpět k vysvětlení' }).click();
  await expect(page.getByRole('heading', { name: item.steps[0].finding.cs })).toBeFocused();
  await page.getByRole('button', { name: 'Pokračovat v pátrání' }).click();
  await solve(page, item, 1);
  await page.getByRole('button', { name: 'Pokračovat v pátrání' }).click();
  await solve(page, item, 2);
  await page.getByRole('button', { name: 'Uzavřít případ' }).click();
  await expect(page.getByRole('heading', { name: 'Všechno do sebe zapadá.' })).toBeFocused();
  await expect(page.getByText(/Na první pokus bez nápovědy: 2/u)).toBeVisible();
  await accessible(page);
  await screenshot(page, 'ending-mobile');
  const finished = await savedCourse(page);
  expect(finished.events).toEqual(before.events);
  expect(finished.pathEvents).toEqual(before.pathEvents);
  expect(finished.wallet).toEqual(before.wallet);
  const completedAt = finished.cases?.backpack?.completedAt;
  await page.reload();
  await expect(page.getByText('Případ uzavřen', { exact: true })).toBeVisible();
  await page.getByText('Projít řešení a užitečné obraty', { exact: true }).click();
  await expect(
    page.getByText(item.steps[1].language.explanation.cs, { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Vyřešit znovu' }).click();
  await expect(page.getByRole('heading', { name: item.steps[0].question.cs })).toBeFocused();
  expect((await savedCourse(page)).cases?.backpack?.firstCompletedAt).toBe(completedAt);
  await expect(page.locator('#case-document .passage')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('the English B1 case supports keyboard highlighting and remains usable on tablet and small phones', async ({
  page,
}) => {
  const item = caseFiles[1];
  await completeOnboarding(page);
  await chooseLanguage(page, 'en');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/cases/soundcheck/');
  await expect(page.getByRole('heading', { name: item.steps[0].question.en })).toBeFocused();
  await chooseAnswer(page, item, 0, 'en');
  await openDocument(page, item, 'show-move', 'en');
  const first = page
    .locator('#case-document')
    .getByRole('button', { name: item.documents[1].lines[0].textDe });
  await first.focus();
  await page.keyboard.press('Space');
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await toggleClue(page, item, 'show-same', 'en');
  await page.setViewportSize({ width: 768, height: 1024 });
  await accessible(page);
  await screenshot(page, 'tablet');
  await page.setViewportSize({ width: 320, height: 740 });
  await accessible(page);
  await confirm(page, 'en');
  await expect(page.getByText(item.steps[0].explanation.en, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Follow the trail' }).click();
  await solve(page, item, 1, 'en');
  await page.getByRole('button', { name: 'Follow the trail' }).click();
  await solve(page, item, 2, 'en');
  await page.getByRole('button', { name: 'Close the case' }).click();
  await expect(page.getByText('Case closed', { exact: true })).toBeVisible();
  await expect(page.getByText(/First try without hints: 3/u)).toBeVisible();
  await accessible(page);
});

test('failed saves preserve the old answer and highlights and retry into the correct stage', async ({
  page,
}) => {
  const item = caseFiles[0];
  await completeOnboarding(page);
  await page.goto('/cases/backpack/');
  await expect(page.getByRole('heading', { name: item.steps[0].question.cs })).toBeFocused();
  await page.getByRole('button', { name: 'Mám teorii', exact: true }).click();
  await page
    .getByRole('group', { name: 'Možné odpovědi' })
    .getByRole('button', { name: item.steps[0].choices[0].textDe })
    .click();
  await toggleClue(page, item, 'bag-description');
  await page.getByRole('button', { name: 'Změnit', exact: true }).click();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (this.name === 'course') {
        IDBObjectStore.prototype.put = original;
        throw new DOMException('Simulated full storage', 'QuotaExceededError');
      }
      return original.call(this, value, key);
    };
  });
  await page
    .getByRole('group', { name: 'Možné odpovědi' })
    .getByRole('button', { name: item.steps[0].choices[1].textDe })
    .click();
  await expect(page.getByRole('alert').filter({ hasText: 'Poslední změnu' })).toBeFocused();
  const previous = (await savedCourse(page)).cases?.backpack?.answers[0];
  expect(previous?.choiceId).toBe('a');
  expect(previous?.clueIds).toEqual(['bag-description']);
  await page.getByRole('button', { name: 'Zkusit uložit znovu' }).click();
  await expect(page.getByRole('heading', { name: 'Zprávy a podklady' })).toBeFocused();
  await expect(page.getByRole('group', { name: 'Možné odpovědi' })).toHaveCount(0);
  expect((await savedCourse(page)).cases?.backpack?.answers[0].choiceId).toBe('b');
  await page.reload();
  await expect(
    page.locator('#case-document').getByRole('button', { name: item.documents[0].lines[0].textDe }),
  ).toHaveAttribute('aria-pressed', 'true');
});

for (const language of ['cs', 'en'] as const) {
  test(`the gallery mystery reveals documents in order, keeps an evidence notebook, and reconstructs the story (${language})`, async ({
    page,
  }) => {
    const item = caseFiles.find((candidate) => candidate.id === 'empty-frame')!;
    const cs = language === 'cs';
    await completeOnboarding(page);
    if (!cs) await chooseLanguage(page, language);
    await page.setViewportSize({ width: cs ? 1440 : 320, height: cs ? 1000 : 740 });
    await page.goto('/cases/');
    await expect(page.locator('.case-entry').first().getByRole('heading')).toHaveText(
      item.title[language],
    );
    await page
      .getByRole('link', {
        name: `${cs ? 'Otevřít případ' : 'Open case'}: ${item.title[language]}`,
      })
      .click();
    await expect(
      page.getByRole('heading', { name: item.steps[0].question[language] }),
    ).toBeFocused();
    const sources = page.getByRole('group', { name: cs ? 'Otevřít podklad' : 'Open a document' });
    await expect(sources.getByRole('button')).toHaveCount(2);
    await expect(page.getByText(item.documents[2].lines[0].textDe, { exact: true })).toHaveCount(0);
    await expect(page.getByText(item.documents[4].lines[1].textDe, { exact: true })).toHaveCount(0);
    await expect(page.locator('.notebook h2')).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await accessible(page);
    await screenshot(page, cs ? 'gallery-opening-desktop' : 'gallery-opening-small');
    await chooseAnswer(page, item, 0, language);
    if (cs) {
      // A plausible accusation with the right passages still cannot become a finding.
      await page.getByRole('button', { name: 'Změnit', exact: true }).click();
      await page
        .getByRole('button', { name: item.steps[0].choices[0].textDe, exact: true })
        .click();
    }
    for (const clueId of caseRules[item.id].steps[0].clueIds) {
      // oxlint-disable-next-line no-await-in-loop -- evidence must save in selection order.
      await toggleClue(page, item, clueId, language);
    }
    await confirm(page, language);
    if (cs) {
      await expect(
        page.getByRole('heading', { name: 'Tuhle odpověď je potřeba změnit.' }),
      ).toBeVisible();
      await expect(page.locator('.notebook h2')).toHaveCount(0);
      await expect(sources.getByRole('button')).toHaveCount(2);
      await page.getByRole('button', { name: 'Změnit odpověď', exact: true }).click();
      await page
        .getByRole('button', { name: item.steps[0].choices[1].textDe, exact: true })
        .click();
      await confirm(page, language);
    }
    await expect(page.locator('#decision-title')).toHaveText(item.steps[0].finding[language]);
    await expect(page.locator('#decision-title')).toBeFocused();
    // The mobile feedback pane hides the document controls, but future documents must also be absent from the DOM.
    await expect(page.locator('.document-switcher button')).toHaveCount(2);
    await page.locator('.notebook summary').click();
    await expect(page.locator('.notebook h2')).toHaveText(item.steps[0].finding[language]);
    await expect(page.locator('.notebook q')).toHaveCount(2);
    await accessible(page);
    await screenshot(page, cs ? 'gallery-notebook-desktop' : 'gallery-notebook-small');
    await page.locator('.notebook summary').click();
    await page
      .getByRole('button', { name: cs ? 'Pokračovat v pátrání' : 'Follow the trail' })
      .click();
    await expect(page.locator('#document-name')).toHaveText('Lea');
    await expect(sources.getByRole('button')).toHaveCount(4);
    await expect(page.locator('.new-document')).toHaveCount(2);
    await expect(page.getByText(item.documents[4].lines[1].textDe, { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole('heading', { name: item.steps[1].question[language] }),
    ).toBeFocused();
    await expect(sources.getByRole('button')).toHaveCount(4);
    await expect(page.locator('.notebook h2')).toHaveCount(1);
    if (cs) await page.setViewportSize({ width: 390, height: 844 });
    await accessible(page);
    await screenshot(page, cs ? 'gallery-new-lead-mobile' : 'gallery-new-lead-small');
    await solve(page, item, 1, language);
    await page
      .getByRole('button', { name: cs ? 'Pokračovat v pátrání' : 'Follow the trail' })
      .click();
    await expect(page.locator('#document-name')).toHaveText('Studio Nord');
    await expect(sources.getByRole('button')).toHaveCount(5);
    await expect(page.locator('.new-document')).toHaveCount(1);
    await accessible(page);
    await screenshot(page, cs ? 'gallery-final-clue-mobile' : 'gallery-final-clue-small');
    await solve(page, item, 2, language);
    await page.getByRole('button', { name: cs ? 'Uzavřít případ' : 'Close the case' }).click();
    await expect(page.locator('#ending-title')).toBeFocused();
    await expect(
      page.getByRole('heading', { name: cs ? 'Jak se to celé stalo' : 'What really happened' }),
    ).toBeVisible();
    await expect(page.locator('.reconstruction li')).toHaveCount(4);
    await accessible(page);
    await screenshot(page, cs ? 'gallery-ending-mobile' : 'gallery-ending-small');
    const finished = (await savedCourse(page)).cases?.['empty-frame'];
    expect(finished?.completedAt).toBeTruthy();
    await page.reload();
    await expect(page.locator('.reconstruction li')).toHaveCount(4);
    await page.getByRole('button', { name: cs ? 'Vyřešit znovu' : 'Solve again' }).click();
    await expect(
      page.getByRole('heading', { name: item.steps[0].question[language] }),
    ).toBeFocused();
    await expect(sources.getByRole('button')).toHaveCount(2);
    await expect(page.locator('.notebook h2')).toHaveCount(0);
    expect((await savedCourse(page)).cases?.['empty-frame']?.firstCompletedAt).toBe(
      finished?.completedAt,
    );
  });
}

test('an unknown case opens the app’s 404 page with a working way back', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/cases/missing-case/');
  await expect(page.getByText('Chyba 404', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Na přehled' }).click();
  await expect(page.getByRole('heading', { name: 'Kam dál' })).toBeVisible();
});
