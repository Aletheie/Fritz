import assert from 'node:assert/strict';
import test from 'node:test';

import { createCourseProgress } from '../src/lib/domain/course/course-progress.ts';
import { purchaseDoubleXp } from '../src/lib/domain/course/wallet.ts';
import { errorText, LocalizedError, localizedError } from '../src/lib/domain/errors.ts';

const fallback = { cs: 'Něco se pokazilo.', en: 'Something went wrong.' };

test('lokalizovaná chyba mluví jazykem rozhraní a zachová českou message', () => {
  const error = localizedError(
    'Slovíčko už v knihovně není.',
    'This word is no longer in your library.',
  );
  assert.ok(error instanceof Error);
  assert.equal(error.message, 'Slovíčko už v knihovně není.');
  assert.equal(errorText(error, 'cs', fallback), 'Slovíčko už v knihovně není.');
  assert.equal(errorText(error, 'en', fallback), 'This word is no longer in your library.');
});

test('běžná chyba se v angličtině nahradí fallbackem a nezobrazí češtinu', () => {
  const error = new Error('Server odpověděl stavem 500.');
  assert.equal(errorText(error, 'cs', fallback), 'Server odpověděl stavem 500.');
  assert.equal(errorText(error, 'en', fallback), 'Something went wrong.');
  assert.equal(errorText('není Error', 'cs', fallback), 'Něco se pokazilo.');
});

test('doménové chyby nesou anglický překlad', () => {
  const progress = createCourseProgress(new Date('2026-01-01T00:00:00.000Z'));
  assert.throws(
    () => purchaseDoubleXp(progress, 0, new Date('2026-01-01T00:00:00.000Z')),
    (error) => error instanceof LocalizedError && /XP/u.test(error.copy.en),
  );
});
