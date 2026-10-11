import { expect, test } from '@playwright/test';

import { completeOnboarding } from './helpers.ts';

test('speaking answers get word-level pronunciation feedback from speech recognition', async ({
  page,
}) => {
  await page.addInitScript(() => {
    class FakeRecognition extends EventTarget {
      lang = '';
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      start() {
        queueMicrotask(() => {
          this.dispatchEvent(new Event('start'));
          const result = Object.assign([{ transcript: 'Hallo', confidence: 0.4 }], {
            isFinal: true,
          });
          this.dispatchEvent(Object.assign(new Event('result'), { results: [result] }));
          this.dispatchEvent(new Event('end'));
        });
      }
      stop() {}
      abort() {}
    }
    for (const name of ['SpeechRecognition', 'webkitSpeechRecognition']) {
      Object.defineProperty(window, name, { configurable: true, value: FakeRecognition });
    }
  });
  await completeOnboarding(page);

  await page.goto('/settings/');
  await page.getByTestId('exercise-settings').locator('summary').click();
  const picker = page.getByTestId('exercise-settings');
  await page.getByRole('button', { name: /^Jen psaní/u }).click();
  await picker.getByRole('button', { name: /^Mluvení /u }).click();
  await picker.getByRole('button', { name: /^Psaní /u }).click();
  await expect(picker.locator('button[aria-pressed="true"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Uložit nastavení' }).click();
  await expect(page.getByText('Nastavení je uložené.')).toBeVisible();

  await page.goto('/study/?mode=cram&tag=all&minutes=20&start=1&distinct=1');
  await page.getByRole('button', { name: 'Spustit německé rozpoznání řeči' }).click();
  await expect(page.locator('#speech-answer')).toHaveValue('Hallo');
  await page.getByRole('button', { name: 'Zkontrolovat přepis' }).click();

  const feedback = page.getByTestId('pronunciation-feedback');
  await expect(feedback).toBeVisible();
  await expect(feedback).toContainText('Prohlížeč slyšel:');
  await expect(feedback).toContainText('Rozpoznávání si nebylo jisté');
  await feedback.screenshot({ path: 'artifacts/screenshots/pronunciation-feedback.png' });
});
