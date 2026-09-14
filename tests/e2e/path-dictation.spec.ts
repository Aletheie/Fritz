import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { courseCommunications } from '../../src/lib/domain/course/course-communication.ts';
import { courseInformationGaps } from '../../src/lib/domain/course/course-information-gaps.ts';
import { coursePathQuestionsForNode } from '../../src/lib/domain/course/path-activities.ts';
import { coursePathChapters } from '../../src/lib/domain/course/path.ts';

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
        chapterId: nodeId.split(':')[0],
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

async function openCommunicationStep(
  page: Page,
  chapterId: string,
  step: 'mix' | 'sentence' | 'checkpoint',
): Promise<void> {
  const chapter = coursePathChapters.find((candidate) => candidate.id === chapterId)!;
  const target = chapter.nodes.find((node) => node.type === step)!;
  await seedCompletedNodes(
    page,
    coursePathChapters
      .filter((candidate) => candidate.number <= chapter.number)
      .flatMap((candidate) =>
        candidate.nodes
          .filter(
            (node) => node.required && (candidate.id !== chapter.id || node.order < target.order),
          )
          .map((node) => node.id),
      ),
  );
  await page.goto(`/path/${encodeURIComponent(target.id)}/`);
}

test('a conversation reveals only requested information before an accessible decision', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const gap = courseInformationGaps[0];
  const chapter = coursePathChapters.find((candidate) => candidate.id === gap.chapterId)!;
  await openCommunicationStep(page, chapter.id, 'checkpoint');
  const questions = coursePathQuestionsForNode(chapter, 'checkpoint');
  /* oxlint-disable no-await-in-loop -- Every answer unlocks the next question. */
  for (const question of questions.filter((entry) => entry.kind !== 'information-gap')) {
    if (question.response === 'recall') {
      await page.getByLabel('Tvoje odpověď německy').fill(question.answer);
      await page.getByRole('button', { name: 'Zkontrolovat odpověď' }).click();
    } else {
      await page.locator('.answer-list button').filter({ hasText: question.answer }).click();
    }
    await page.getByRole('button', { name: 'Další', exact: true }).click();
  }
  /* oxlint-enable no-await-in-loop */
  await expect(page.getByRole('heading', { name: gap.title.cs })).toBeVisible();
  await expect(page.getByText(gap.queries[0].reply, { exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: gap.answer, exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/course-conversation-mobile.png', fullPage: true });
  await page.getByRole('button', { name: gap.queries[2].question, exact: true }).click();
  await expect(page.getByRole('button', { name: gap.answer, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: gap.queries[0].question, exact: true }).click();
  await expect(page.getByText(gap.queries[0].reply, { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: gap.answer, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: gap.queries[1].question, exact: true }).click();
  await expect(page.getByRole('heading', { name: gap.decision })).toBeFocused();
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: gap.answer, exact: true }).click();
  await page.getByRole('button', { name: 'Dokončit', exact: true }).click();
  await expect(page.getByText('Krok dokončen', { exact: true })).toBeVisible();
});

test('writing drafts and finished texts appear in the collection and empty edits survive reopening', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCommunicationStep(page, 'chapter-01-school', 'sentence');
  const input = page.getByLabel('Tvůj text německy');
  await input.fill('Heute lerne');
  await expect(
    page.getByText('Rozepsaný text je uložený v tomto zařízení.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(input).toHaveValue('Heute lerne');
  await page.getByRole('link', { name: 'Moje rozepsané a dokončené texty' }).click();
  const collection = page.locator('.writing-portfolio');
  await expect(collection.getByText('Heute lerne', { exact: true })).toBeVisible();
  await page.getByLabel('Zobrazit texty').selectOption('drafts');
  await collection.getByRole('link', { name: 'Pokračovat v psaní' }).click();
  await expect(input).toHaveValue('Heute lerne');
  await input.fill('Heute lerne ich in der Schule Deutsch.');
  await page.getByRole('button', { name: 'Přejít ke kontrole textu' }).click();
  await page.getByRole('checkbox').nth(0).check();
  await page.getByRole('checkbox').nth(1).check();
  await page.getByRole('checkbox').nth(2).check();
  await page.getByRole('button', { name: 'Uložit text a dokončit' }).click();
  await expect(page.getByText('Krok dokončen', { exact: true })).toBeVisible();
  await page.goto('/progress/#writing-portfolio-title');
  await page.getByLabel('Zobrazit texty').selectOption('finished');
  await expect(
    collection.getByText('Heute lerne ich in der Schule Deutsch.', { exact: true }),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .include('.writing-portfolio')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await collection.screenshot({ path: 'artifacts/course-writing-collection-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await collection.screenshot({ path: 'artifacts/course-writing-collection-desktop.png' });
  await collection.getByRole('link', { name: 'Otevřít a upravit' }).click();
  await input.fill('');
  await expect(
    page.getByText('Rozepsaný text je uložený v tomto zařízení.', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(input).toHaveValue('');
});

test('listening comprehension keeps the transcript hidden, handles playback failure, and completes in text mode', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installSpeechMock(page);
  const content = courseCommunications[0];
  const chapter = coursePathChapters.find((candidate) => candidate.id === content.chapterId)!;
  await openCommunicationStep(page, chapter.id, 'mix');
  await page.getByRole('button', { name: 'Teď nemůžu poslouchat', exact: true }).click();
  const questions = coursePathQuestionsForNode(chapter, 'mix');
  /* oxlint-disable no-await-in-loop -- Each answer unlocks the next activity. */
  for (const question of questions.filter((candidate) => candidate.kind !== 'listening')) {
    await page.locator('.answer-list button').filter({ hasText: question.answer }).click();
    await page.getByRole('button', { name: 'Další', exact: true }).click();
  }
  /* oxlint-enable no-await-in-loop */
  await expect(page.getByRole('heading', { name: 'Proč Lea volá?' })).toBeVisible();
  await expect(page.getByText(content.listening.transcript, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Přehrát zprávu' }).click();
  const lastSpoken = await page.evaluate(
    () => (Reflect.get(window, 'fritzSpokenLog') as Array<{ text: string }>).at(-1)?.text,
  );
  expect(lastSpoken).toBe(content.listening.transcript);
  await page.screenshot({ path: 'artifacts/course-listening-mobile.png', fullPage: true });
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page
    .locator('.answer-list button')
    .filter({ hasText: content.listening.tasks[0].answer })
    .click();
  await expect(page.getByText(content.listening.transcript, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Další', exact: true }).click();
  await expect(page.getByText(content.listening.transcript, { exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    window.speechSynthesis.speak = () => {
      throw new Error('Audio device unavailable');
    };
  });
  await page.getByRole('button', { name: 'Přehrát zprávu' }).click();
  await expect(
    page.getByText('Zvuk není dostupný. Pokračuj se stejnou zprávou v textu.'),
  ).toBeVisible();
  await expect(page.getByText(content.listening.transcript, { exact: true })).toBeVisible();
  await page
    .locator('.answer-list button')
    .filter({ hasText: content.listening.tasks[1].answer })
    .click();
  await page.getByRole('button', { name: 'Dokončit', exact: true }).click();
  await expect(page.getByText('Krok dokončen', { exact: true })).toBeVisible();
  await expect(page.getByLabel('3 ze 3 hvězd')).toBeVisible();
});

test('advanced writing supports longer texts, review after editing, English copy, and reopening saved work', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const content = courseCommunications[9];
  await openCommunicationStep(page, content.chapterId, 'sentence');
  await page.goto('/settings/');
  await page.getByRole('radio', { name: /English/u }).check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();
  await page.goto(`/path/${encodeURIComponent(`${content.chapterId}:sentence`)}/`);
  await expect(page.getByText(content.writing.prompt.en, { exact: true })).toBeVisible();
  const input = page.getByLabel('Your text in German');
  await expect(input).toHaveAttribute('maxlength', '5000');
  await input.fill('Das Lagebild ist aktuell.');
  await page.getByRole('button', { name: 'Review my text' }).click();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Develop your text to at least 45 words.')).toBeVisible();
  await input.fill(content.writing.model);
  await page.getByRole('button', { name: 'Review my text' }).click();
  await expect(page.getByRole('heading', { name: 'Reread, compare, revise' })).toBeFocused();
  const checkboxes = page.getByRole('checkbox');
  await expect(checkboxes).toHaveCount(3);
  await checkboxes.nth(0).check();
  await input.fill(`${content.writing.model} Bitte beachten Sie die nächste Mitteilung.`);
  await expect(checkboxes.nth(0)).not.toBeChecked();
  await page.getByRole('button', { name: 'Save text and finish' }).click();
  await expect(page.getByText('Review all three checklist items before saving.')).toBeVisible();
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await checkboxes.nth(2).check();
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(audit.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/course-writing-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: 'artifacts/course-writing-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Save text and finish' }).click();
  await expect(page.getByText('Step complete', { exact: true })).toBeVisible();
  await page.reload();
  await expect(input).toHaveValue(
    `${content.writing.model} Bitte beachten Sie die nächste Mitteilung.`,
  );
});

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

test('checkpoint requires an accessible written sentence repair on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await unlockFirstCheckpoint(page);
  await page.goto(checkpointHref);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Ověření: První den ve škole' }),
  ).toBeVisible();

  await page.getByLabel('Tvoje odpověď německy').fill('die Stunde');
  await page.getByRole('button', { name: 'Zkontrolovat odpověď' }).click();
  await expect(page.getByText('Správně.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Další', exact: true }).click();
  await page.getByLabel('Tvoje odpověď německy').fill('lernen');
  await page.getByRole('button', { name: 'Zkontrolovat odpověď' }).click();
  await expect(page.getByText('Správně.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Další', exact: true }).click();

  await expect(page.getByText('Doplň opravený úsek', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Die erste Stunde _____' })).toBeVisible();
  await expect(page.locator('.answer-list button')).toHaveCount(0);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(blocking).toEqual([]);

  await page.getByLabel('Tvoje odpověď německy').fill('beginnt um acht Uhr.');
  await page.getByRole('button', { name: 'Zkontrolovat odpověď' }).click();
  await expect(page.getByText('Správně.', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Opravená věta: „Die erste Stunde beginnt um acht Uhr\.“/u),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('recall requires the noun article, restores focus on retry, and completes a sentence from memory', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await unlockFirstCheckpoint(page);
  await page.goto(checkpointHref);
  const input = page.getByLabel('Tvoje odpověď německy');
  await expect(page.locator('.answer-list button')).toHaveCount(0);
  await input.fill('Stunde');
  await input.press('Enter');
  await expect(page.getByText('Ještě ne.', { exact: true })).toBeVisible();
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Zkusit znovu' })).toBeFocused();
  await page.screenshot({ path: 'artifacts/course-recall-mobile.png', fullPage: true });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    ),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Zkusit znovu' }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await input.fill('die Stunde');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Další', exact: true }).click();
  await input.fill('lernen');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Další', exact: true }).click();
  await page.getByLabel('Tvoje odpověď německy').fill('beginnt um acht Uhr.');
  await page.getByRole('button', { name: 'Zkontrolovat odpověď' }).click();
  await page.getByRole('button', { name: 'Další', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Heute lerne ich in der _____ Deutsch.' }),
  ).toBeVisible();
  await expect(input).toHaveValue('');
  await input.fill('Schule');
  await input.press('Enter');
  await expect(page.getByText('Správně.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('practice moves from recognising meaning to typing German with no answer options', async ({
  page,
}) => {
  await seedCompletedNodes(page, ['chapter-01-school:vocabulary']);
  await page.goto('/path/chapter-01-school%3Apractice/');
  await expect(page.getByRole('heading', { name: 'Od významu k němčině', level: 1 })).toBeVisible();
  /* oxlint-disable no-await-in-loop -- Each answer renders the next question on the same page. */
  for (const meaning of ['škola', 'vyučovací hodina', 'sešit']) {
    await page.getByRole('button', { name: new RegExp(meaning, 'u') }).click();
    await page.getByRole('button', { name: 'Další', exact: true }).click();
  }
  /* oxlint-enable no-await-in-loop */
  await expect(page.locator('.answer-list button')).toHaveCount(0);
  await expect(page.getByLabel('Tvoje odpověď německy')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'spolužák', exact: true })).toBeVisible();
});

test('active course recall also works with English learner copy', async ({ page }) => {
  await unlockFirstCheckpoint(page);
  await page.goto('/settings/');
  await page.getByRole('radio', { name: /English/u }).check();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();
  await page.goto(checkpointHref);
  await expect(page.getByLabel('Your answer in German')).toBeVisible();
  await page.getByLabel('Your answer in German').fill('die Stunde');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByText('Correct.', { exact: true })).toBeVisible();
});

test('a band closes with a revisit and two contextual decisions, saves completion, and previews its mission', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const chapter = coursePathChapters.find(
    (candidate) => candidate.id === 'chapter-102-hobby-meetup',
  );
  expect(chapter).toBeTruthy();
  if (!chapter) return;
  await seedCompletedNodes(
    page,
    coursePathChapters
      .filter((candidate) => candidate.number <= chapter.number)
      .flatMap((candidate) =>
        candidate.nodes
          .filter(
            (node) => node.required && (candidate.id !== chapter.id || node.type !== 'checkpoint'),
          )
          .map((node) => node.id),
      ),
  );
  await page.goto('/');
  await expect(page.locator('.phase-marker > span').first()).toHaveText('04');
  await page.goto('/course/');
  await expect(page.getByText('Tvůj první herní večer', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/course-mission-preview-mobile.png', fullPage: true });
  await page.goto(`/path/${encodeURIComponent(`${chapter.id}:checkpoint`)}/`);
  const questions = coursePathQuestionsForNode(chapter, 'checkpoint');
  /* oxlint-disable no-await-in-loop -- The checkpoint unlocks each question only after the previous answer. */
  for (const [index, question] of questions.entries()) {
    if (question.reviewChapterId)
      await expect(page.getByText('Krátký návrat', { exact: true })).toBeVisible();
    if (question.kind === 'situation') {
      await expect(page.getByText('Tvůj první herní večer', { exact: true })).toBeVisible();
      await expect(page.getByText(question.context?.text ?? '', { exact: true })).toBeVisible();
      if (question.id.endsWith(':1')) {
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          results.violations.filter(
            (violation) => violation.impact === 'critical' || violation.impact === 'serious',
          ),
        ).toEqual([]);
        await page.screenshot({ path: 'artifacts/course-mission-mobile.png', fullPage: true });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.screenshot({ path: 'artifacts/course-mission-desktop.png', fullPage: true });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        ).toBe(true);
        await page.setViewportSize({ width: 390, height: 844 });
      }
    }
    if (question.response === 'recall') {
      await page.getByLabel('Tvoje odpověď německy').fill(question.answer);
      await page.getByRole('button', { name: 'Zkontrolovat odpověď' }).click();
    } else {
      await page.locator('.answer-list button').filter({ hasText: question.answer }).click();
    }
    await expect(page.getByText('Správně.', { exact: true })).toBeVisible();
    await page
      .getByRole('button', {
        name: index === questions.length - 1 ? 'Dokončit' : 'Další',
        exact: true,
      })
      .click();
  }
  /* oxlint-enable no-await-in-loop */
  await expect(page.getByText('Krok dokončen', { exact: true })).toBeVisible();
  await expect(page.getByLabel('3 ze 3 hvězd')).toBeVisible();
  await page.getByRole('link', { name: 'Pokračovat po cestě' }).click();
  await page.waitForURL('/');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Můj běžný den', exact: true })).toBeVisible();
});
