import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import packageMetadata from '../../package.json' with { type: 'json' };

import { completeOnboarding, unlockStoryBook } from './helpers.ts';

const screenshotDirectory = path.resolve('artifacts/screenshots');

test('onboarding persists a personalized plan and starts the unified daily lesson', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Co chceš s němčinou zvládnout?' })).toBeVisible();

  await page.getByRole('radio', { name: /Pamatovat si slovíčka/u }).check();
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'B1.1', exact: true })).toHaveAccessibleDescription(
    'Mluvím samostatně',
  );
  await page.getByRole('radio', { name: 'B1.1', exact: true }).check();
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await page.getByRole('radio', { name: /20 minut/u }).check();

  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, 'onboarding-personalized-390.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: 'Spustit první lekci' }).click();
  await expect(page).toHaveURL(/\/today\/$/u);
  await expect(page.getByRole('heading', { name: 'Opakování 1 z 5' })).toBeVisible();

  const settings = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fritz');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const transaction = database.transaction('settings', 'readonly');
    const stored = await new Promise<Record<string, unknown>>((resolve, reject) => {
      const request = transaction.objectStore('settings').get('app');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    database.close();
    return stored;
  });

  expect(settings).toMatchObject({
    onboardingCompleted: true,
    learningGoal: 'memory',
    grammarLevel: 'B1.1',
    dailyMinutes: 20,
  });
});

test('onboarding treats placement as an optional conservative estimate', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/onboarding/');
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await page.getByRole('button', { name: /Nevím přesně/u }).click();

  for (let index = 0; index < 5; index += 1) {
    // oxlint-disable-next-line no-await-in-loop -- each answer renders the next question.
    await page.getByRole('button', { name: 'Nevím', exact: true }).click();
  }

  await expect(page.getByRole('status')).toContainText('Test doporučuje úroveň A1.1');
  await expect(page.getByRole('radio', { name: 'A1.1', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'A2.1', exact: true }).check();
  await expect(page.getByRole('status')).toContainText('Test doporučuje úroveň A1.1');
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, 'onboarding-calibration-390.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Přeskočit', exact: true }).click();
  await expect(page).toHaveURL(/\/today\/$/u);
});

test('setup survives a reload and explains the chosen starting level', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/onboarding/');
  await page.getByRole('radio', { name: /Rozmluvit se/u }).check();
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await page.getByRole('radio', { name: 'A2.1', exact: true }).check();
  await expect(page.locator('.level-description')).toContainText('cestování');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Odkud navážeme?' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'A2.1', exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await expect(page.locator('.plan-preview b')).not.toBeEmpty();
  await page.getByRole('radio', { name: /5 minut/u }).check();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Kolik času máš běžně denně?' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /5 minut/u })).toBeChecked();
  await expect(page.locator('.plan-preview')).toContainText('Rozmluvit se');
  await page.getByRole('button', { name: 'Spustit první lekci' }).click();
  await expect(page).toHaveURL(/\/today\/$/u);
  expect(await page.evaluate(() => sessionStorage.getItem('fritz:onboarding:v1'))).toBeNull();
});

test('exam plan persists its date and opens an isolated cram sprint', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await completeOnboarding(page);
  await page.goto('/exam/');
  await expect(page.getByRole('heading', { name: 'Plán na písemku' })).toBeVisible();

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const examDate = [
    nextWeek.getFullYear(),
    String(nextWeek.getMonth() + 1).padStart(2, '0'),
    String(nextWeek.getDate()).padStart(2, '0'),
  ].join('-');

  await page.getByLabel('Datum písemky').fill(examDate);
  await page.getByRole('radio', { name: '20 min' }).check();
  await page.getByRole('button', { name: 'Vytvořit plán' }).click();

  await expect(page.getByRole('status')).toHaveText('Plán je uložený v tomto zařízení.');
  await expect(page.getByRole('heading', { name: /% opravdu vybaveno$/u })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Spustit dnešní sprint' })).toHaveAttribute(
    'href',
    '/study/?mode=cram&tag=all&minutes=20&start=1&distinct=1',
  );

  await page.goto('/');
  const dailyLesson = page.getByRole('complementary', { name: 'Dnešní lekce' });
  await expect(dailyLesson).toContainText('plán se promítne do lekce');
  await expect(dailyLesson.getByRole('link', { name: 'Spustit dnešní lekci' })).toHaveAttribute(
    'href',
    '/today/',
  );

  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, 'home-exam-plan-390.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/exam/');
  await expect(page.getByRole('heading', { name: 'Plán na písemku' })).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(screenshotDirectory, 'exam-plan-390.png'),
    fullPage: true,
  });

  await page.reload();
  await expect(page.getByLabel('Datum písemky')).toHaveValue(examDate);
  await expect(page.getByRole('radio', { name: '20 min' })).toBeChecked();

  const today = [
    new Date().getFullYear(),
    String(new Date().getMonth() + 1).padStart(2, '0'),
    String(new Date().getDate()).padStart(2, '0'),
  ].join('-');
  await page.getByLabel('Datum písemky').fill(today);
  await page.getByRole('radio', { name: '5 min' }).check();
  await page.getByRole('button', { name: 'Přepočítat plán' }).click();
  await expect(page.getByRole('alert')).toContainText('Plán se do zvoleného času nevejde.');

  await page.getByRole('button', { name: 'Zrušit plán' }).click();
  await page.getByRole('button', { name: 'Ano, zrušit plán' }).click();
  await expect(page.getByRole('status')).toContainText('Plán byl zrušený.');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nejdřív ulož datum a rozsah' })).toBeVisible();
});

test('course and coach search expose content outside the default mobile slice', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await completeOnboarding(page);

  await page.goto('/course/');
  await expect(page.locator('.chapter-row:visible')).toHaveCount(4);
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, 'course-current-level-390.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Zobrazit dalších 8 kapitol' }).click();
  await expect(page.locator('.chapter-row:visible')).toHaveCount(12);
  await page.getByRole('button', { name: 'Skrýt ostatní kapitoly' }).click();
  await page.getByPlaceholder('Hledat téma, situaci nebo slovíčko…').fill('Kavárna');
  await expect(page.getByText('Kavárna a pekárna', { exact: true })).toBeVisible();

  await page.goto('/coach/');
  await page.getByPlaceholder('Hledat situaci nebo komunikační cíl…').fill('pohovor');
  await expect(page.getByRole('heading', { name: /pohovor/iu })).toBeVisible();
});

test('a rewritten advanced chapter stays concrete and readable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await completeOnboarding(page);

  await page.goto('/course/');
  await page
    .getByPlaceholder('Hledat téma, situaci nebo slovíčko…')
    .fill('Komunikace v krizové situaci');
  const chapter = page.locator('.chapter-row:visible');
  await expect(chapter).toHaveCount(1);
  await chapter.getByText('Komunikace v krizové situaci', { exact: true }).click();
  await expect(chapter.locator('.chapter-mission')).toContainText('sjednotit ověřené informace');
  await expect(chapter.locator('.chapter-content')).toContainText(
    'Nach aktuellem Informationsstand',
  );

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, 'course-crisis-chapter-390.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test('favorite conversations and books persist as a personal shortlist', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await completeOnboarding(page);

  await page.goto('/coach/');
  await page.getByRole('button', { name: 'Přidat Objednávka v kavárně do oblíbených' }).click();
  await expect(
    page.getByRole('button', { name: 'Odebrat Objednávka v kavárně z oblíbených' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Oblíbené 1/u }).click();
  await expect(page.locator('.scenario-card:visible')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: /Oblíbené 1/u }).click();
  await expect(page.getByRole('heading', { name: 'Objednávka v kavárně' })).toBeVisible();

  await page.goto('/stories/');
  await page
    .getByRole('button', { name: 'Přidat Märchen und Erzählungen I do oblíbených' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Odebrat Märchen und Erzählungen I z oblíbených' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Oblíbené 1/u }).click();
  await expect(page.locator('.book-row:visible')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: /Oblíbené 1/u }).click();
  await expect(page.locator('.book-row:visible')).toContainText('Märchen und Erzählungen I');
});

test('changing the learning goal keeps one adaptive daily destination', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await completeOnboarding(page);
  await page.goto('/settings/');

  const goalGroup = page.getByRole('group', { name: 'Můj hlavní cíl' });
  await goalGroup.getByRole('radio', { name: /Rozmluvit se/u }).check();
  await mkdir(screenshotDirectory, { recursive: true });
  await goalGroup.screenshot({
    path: path.join(screenshotDirectory, 'settings-learning-goal-390.png'),
  });
  await page.getByRole('button', { name: 'Uložit nastavení' }).click();
  await expect(page.getByText('Nastavení je uložené.')).toBeVisible();
  await page.goto('/');

  const plan = page.getByRole('complementary', { name: 'Dnešní lekce' });
  await expect(plan.getByRole('link', { name: 'Spustit dnešní lekci' })).toHaveAttribute(
    'href',
    '/today/',
  );
  await expect(plan.locator('.lesson-flow li')).toHaveCount(3);
});

test('settings keep expert controls optional and export a private beta report', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await completeOnboarding(page);
  await page.goto('/settings/');

  const exerciseDetails = page.locator('details.exercise-settings');
  const memoryDetails = page.locator('details').filter({ hasText: 'Podrobnosti opakování' });
  await expect(exerciseDetails).not.toHaveAttribute('open', '');
  await expect(memoryDetails).not.toHaveAttribute('open', '');

  await exerciseDetails.locator('summary').click();
  await expect(page.getByRole('button', { name: /^Psaní /u })).toBeVisible();
  await memoryDetails.locator('summary').click();
  await expect(page.getByLabel('Cílová retence')).toBeVisible();

  await mkdir(screenshotDirectory, { recursive: true });
  await page.locator('.learning-sheet').screenshot({
    path: path.join(screenshotDirectory, 'settings-progressive-disclosure-390.png'),
    animations: 'disabled',
  });

  const diagnostics = page.locator('.beta-diagnostics');
  await diagnostics.scrollIntoViewIfNeeded();
  await expect(diagnostics).toContainText(`Fritz ${packageMetadata.version} · DB 9`);
  await diagnostics.screenshot({
    path: path.join(screenshotDirectory, 'settings-beta-diagnostics-390.png'),
    animations: 'disabled',
  });
  const downloadPromise = page.waitForEvent('download');
  await diagnostics.getByRole('button', { name: 'Stáhnout soukromý beta report' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^fritz-beta-report-\d{4}-\d{2}-\d{2}\.json$/u);
  await expect(diagnostics.getByRole('status')).toHaveText('Beta report je stažený.');
});

test('guided reading turns a mistake into retrieval and keeps the private summary ephemeral', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await unlockStoryBook(page, 'a1-haensel-gretel');
  await page.goto('/stories/a1-haensel-gretel/a1-haensel-gretel-e04/');
  await page.getByRole('button', { name: 'Začít číst' }).click();
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  await page.getByRole('button', { name: 'Pokračovat' }).click();

  const recall = page.getByLabel('Chybějící německý tvar');
  await recall.fill('Baum');
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.getByRole('status')).toContainText('Nápověda: W… · 4 Buchstaben');
  await page.getByRole('button', { name: 'Provést opravu' }).click();
  await expect(recall).toBeFocused();
  await recall.fill('Wald');
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.getByRole('status')).toContainText('Sedí to.');
  await page.getByRole('button', { name: 'Číst dál' }).click();

  await page.getByRole('button', { name: 'Pokračovat' }).click();
  await page.getByRole('button', { name: 'Dokončit' }).click();
  const production = page.getByLabel('Tvoje německá věta');
  const compare = page.getByRole('button', { name: 'Porovnat s dějem' });
  await expect(compare).toBeDisabled();
  const privateDraft = 'Am Ende finden beide Kinder sicher nach Hause.';
  await production.fill(privateDraft);
  await expect(compare).toBeEnabled();
  await expect(page.getByText('Text zůstane jen na této obrazovce.')).toBeVisible();
  await compare.click();
  await expect(page.getByRole('heading', { name: 'Opora přímo z děje' })).toBeVisible();
  const checkedContinue = page.getByRole('button', { name: 'Zkontrolováno, pokračovat' });
  await expect(checkedContinue).toBeDisabled();
  const selfCheck = page.getByRole('group', {
    name: 'Před pokračováním zkontroluj svou větu',
  });
  const checkboxes = await selfCheck.getByRole('checkbox').all();
  for (const checkbox of checkboxes) {
    // oxlint-disable-next-line no-await-in-loop -- browser interactions share one page and must stay ordered.
    await checkbox.check();
  }
  await expect(checkedContinue).toBeEnabled();
  await checkedContinue.click();
  await expect(page.getByRole('status')).toContainText('Sedí to.');
  await page.getByRole('button', { name: 'Číst dál' }).click();
  await expect(page.getByText('Epizoda dokončena')).toBeVisible();

  const storedData = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fritz');
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const storeNames = Array.from(database.objectStoreNames);
    const transaction = database.transaction(storeNames, 'readonly');
    const records = await Promise.all(
      storeNames.map(
        (storeName) =>
          new Promise<unknown[]>((resolve, reject) => {
            const request = transaction.objectStore(storeName).getAll();
            request.addEventListener('success', () => resolve(request.result), { once: true });
            request.addEventListener('error', () => reject(request.error), { once: true });
          }),
      ),
    );
    database.close();
    return JSON.stringify(records);
  });
  expect(storedData).not.toContain(privateDraft);
});

test('guided reading turns the whole scene into a timeline and a spoiler-free story arc', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await unlockStoryBook(page, 'a1-maerchen');

  await page.goto('/stories/a1-maerchen/a1-maerchen-e01/');
  await page.getByRole('button', { name: 'Začít číst' }).click();
  const timelinePageTexts = [await page.locator('.story-text').innerText()];
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  timelinePageTexts.push(await page.locator('.story-text').innerText());
  await page.getByRole('button', { name: 'Pokračovat' }).click();

  const recall = page.getByLabel('Chybějící německý tvar');
  await recall.fill('falsch');
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await page.getByRole('button', { name: 'Provést opravu' }).click();
  await recall.fill('nochfalsch');
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  const correction = await page.locator('.feedback').innerText();
  const recalledForm = correction.match(/Správný tvar je „([^“]+)“/u)?.[1];
  expect(recalledForm).toBeTruthy();
  await page.getByRole('button', { name: 'Provést opravu' }).click();
  await recall.fill(recalledForm!);
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await page.getByRole('button', { name: 'Číst dál' }).click();
  timelinePageTexts.push(await page.locator('.story-text').innerText());
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  timelinePageTexts.push(await page.locator('.story-text').innerText());
  await page.getByRole('button', { name: 'Dokončit' }).click();
  await expect(page.locator('.timeline-answer')).toBeVisible();

  const timelineLabels = await page.locator('.timeline-bank strong').allTextContents();
  const chronologicalLabels = timelineLabels.toSorted(
    (left, right) =>
      timelinePageTexts.findIndex((text) => text.includes(left)) -
      timelinePageTexts.findIndex((text) => text.includes(right)),
  );
  expect(
    chronologicalLabels.every((label) => timelinePageTexts.some((text) => text.includes(label))),
  ).toBe(true);
  for (const label of chronologicalLabels) {
    // oxlint-disable-next-line no-await-in-loop -- the bank intentionally removes each selected event.
    await page.locator('.timeline-bank > button').filter({ hasText: label }).click();
  }
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.locator('.feedback.success')).toBeVisible();
  await expect(page.locator('.timeline-answer > button')).toHaveCount(3);
  await page.locator('.exercise-card').screenshot({
    path: path.join(screenshotDirectory, 'reading-timeline-390.png'),
    animations: 'disabled',
  });

  await page.goto('/stories/a1-maerchen/a1-maerchen-e03/');
  await page.getByRole('button', { name: 'Začít číst' }).click();
  await mkdir(screenshotDirectory, { recursive: true });
  await page.locator('.reading-stage').screenshot({
    path: path.join(screenshotDirectory, 'reading-guided-words-390.png'),
    animations: 'disabled',
  });
  const arcPageTexts = [await page.locator('.story-text').innerText()];
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  arcPageTexts.push(await page.locator('.story-text').innerText());
  await page.getByRole('button', { name: 'Pokračovat' }).click();

  const solveRemainingMatchingPairs = async (): Promise<void> => {
    const nextCzech = page.locator('.czech-column button:not(:disabled)').first();
    if (!(await nextCzech.count())) return;
    const czechLabel = await nextCzech.innerText();
    const czech = page.locator('.czech-column button').filter({ hasText: czechLabel });
    const germanLabels = await page
      .locator('.german-column button:not(:disabled)')
      .allTextContents();
    const tryGerman = async (candidateIndex = 0): Promise<void> => {
      const germanLabel = germanLabels[candidateIndex];
      if (!germanLabel) throw new Error('Matching pair could not be resolved.');
      const german = page.locator('.german-column button').filter({ hasText: germanLabel });
      await czech.click();
      await german.click();
      await page.waitForTimeout(460);
      if (await czech.isDisabled()) return solveRemainingMatchingPairs();
      return tryGerman(candidateIndex + 1);
    };
    return tryGerman();
  };
  await solveRemainingMatchingPairs();
  await expect(page.locator('.feedback.success')).toBeVisible();
  await page.getByRole('button', { name: 'Číst dál' }).click();
  arcPageTexts.push(await page.locator('.story-text').innerText());
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  arcPageTexts.push(await page.locator('.story-text').innerText());
  await page.getByRole('button', { name: 'Dokončit' }).click();
  await expect(page.locator('.arc-options > button')).toHaveCount(3);

  const arcBeats = await page
    .locator('.arc-options > button')
    .evaluateAll((options) =>
      options.map((option) =>
        Array.from(option.querySelectorAll<HTMLElement>('.arc-beat strong')).map(
          (beat) => beat.innerText,
        ),
      ),
    );
  const currentArcIndex = arcBeats.findIndex(
    ([opening, closing]) =>
      arcPageTexts[0].includes(opening) && arcPageTexts.at(-1)!.includes(closing),
  );
  expect(currentArcIndex).toBeGreaterThanOrEqual(0);
  await page.locator('.arc-options > button').nth(currentArcIndex).click();
  await page.getByRole('button', { name: 'Zkontrolovat' }).click();
  await expect(page.locator('.arc-reveal')).toContainText('Teď jednou větou');
  await page.locator('.exercise-card').screenshot({
    path: path.join(screenshotDirectory, 'reading-story-arc-390.png'),
    animations: 'disabled',
  });
});

test('coach keeps the active task after a failed answer and gives a specific recovery cue', async ({
  page,
}) => {
  await completeOnboarding(page);
  await page.goto('/coach/session/transfer-measurable-study-goal/');
  await expect(page.getByRole('heading', { name: 'Cíl, který lze ověřit' })).toBeVisible();

  const answer = page.getByLabel('Německá odpověď');
  const send = page.getByRole('button', { name: 'Odeslat odpověď' });
  const coachBubble = page.locator('.message-row.coach-message .bubble');

  await answer.fill('Ich möchte zehn Minuten frei über meinen Alltag sprechen können.');
  await send.click();
  await expect(page.getByText('Reakce funguje')).toBeVisible();
  await expect(coachBubble.last()).toContainText('Dafür übe ich');
  await expect(page.getByText('Replika 2 z 3')).toBeVisible();

  await answer.fill('Ich habe keine Ahnung.');
  await send.click();
  await expect(page.getByText('Pomůžeme ji doplnit')).toBeVisible();
  await expect(coachBubble.last()).toContainText('Dafür übe ich');

  await answer.fill('Was?');
  await send.click();
  await expect(page.getByText('Zkus jinou odpověď')).toBeVisible();
  await expect(coachBubble.last()).toContainText('Ich brauche noch einen kurzen Satz');
  await expect(coachBubble.last()).toContainText('Dafür übe ich');
  await expect(page.getByText('Das passt noch nicht zu unserer Situation.')).toHaveCount(0);

  await answer.fill('Dafür lerne ich regelmäßig.');
  await send.click();
  await expect(page.getByText('Reakce funguje')).toBeVisible();
  await expect(coachBubble.last()).toContainText('Am Monatsende nehme ich');
  await expect(page.getByText('Replika 3 z 3')).toBeVisible();
});
