import assert from 'node:assert/strict';
import test from 'node:test';

import {
  completedGrammarRunFirstTry,
  grammarChoiceOptions,
} from '../src/lib/domain/course/grammar-run.ts';

const questionIds = ['one', 'two', 'three', 'four', 'five'];

test('možnosti odpovědí se řadí stabilně podle běhu a nemění zdrojová data', () => {
  const options = ['A', 'B', 'C', 'D'];
  const first = grammarChoiceOptions(options, 'lesson:question:run-1');
  const repeated = grammarChoiceOptions(options, 'lesson:question:run-1');

  assert.deepEqual(first, repeated);
  assert.deepEqual(first.toSorted(), options);
  assert.deepEqual(options, ['A', 'B', 'C', 'D']);
  assert.ok(
    new Set(
      Array.from({ length: 24 }, (_, index) =>
        grammarChoiceOptions(options, `lesson:question:run-${index}`).indexOf('A'),
      ),
    ).size > 1,
  );
});

test('obnovená gramatická lekce dokončí běh z dřívějšího mastery a poslední odpovědi', () => {
  assert.equal(
    completedGrammarRunFirstTry({
      questionIds,
      initiallyMasteredQuestionIds: new Set(questionIds.slice(0, 4)),
      attemptedQuestionIds: new Set(['five']),
      sessionCorrectFirstTry: 1,
      reviewRun: false,
    }),
    5,
  );
});

test('neúplný obnovený běh ani zkrácené opakování se neoznačí za dokončené', () => {
  assert.equal(
    completedGrammarRunFirstTry({
      questionIds,
      initiallyMasteredQuestionIds: new Set(['one', 'two']),
      attemptedQuestionIds: new Set(['three', 'four']),
      sessionCorrectFirstTry: 2,
      reviewRun: false,
    }),
    undefined,
  );
  assert.equal(
    completedGrammarRunFirstTry({
      questionIds,
      initiallyMasteredQuestionIds: new Set(questionIds),
      attemptedQuestionIds: new Set(['one']),
      sessionCorrectFirstTry: 1,
      reviewRun: true,
    }),
    undefined,
  );
});
