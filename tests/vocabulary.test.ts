import assert from 'node:assert/strict';
import test from 'node:test';

import { aiItemToDraft } from '../src/lib/domain/ai/types.ts';
import { createEmptyDraft, normalizeDraft } from '../src/lib/domain/vocabulary/draft.ts';
import {
  draftHasRequiredFields,
  vocabularyDraftIssues,
} from '../src/lib/domain/vocabulary/validation.ts';

import type { AiGeneratedVocabularyItem } from '../src/lib/domain/ai/types.ts';

test('normalizace odstraní gramatická pole, která k druhu výrazu nepatří', () => {
  const draft = normalizeDraft({
    ...createEmptyDraft(),
    german: '  schnell  ',
    czech: '  rychlý  ',
    kind: 'adjective',
    article: 'das',
    plural: 'die Schnellen',
    verbForms: { preterite: 'war' },
    tags: [' A2 ', 'a2', ' Vlastnosti '],
  });

  assert.equal(draft.german, 'schnell');
  assert.equal(draft.czech, 'rychlý');
  assert.equal(draft.article, undefined);
  assert.equal(draft.plural, undefined);
  assert.equal(draft.verbForms, undefined);
  assert.deepEqual(draft.tags, ['a2', 'vlastnosti']);
});

test('prázdné tvary slovesa se při normalizaci neukládají', () => {
  const draft = normalizeDraft({
    ...createEmptyDraft(),
    german: 'lernen',
    czech: 'učit se',
    kind: 'verb',
    verbForms: { thirdPerson: '  ', preterite: '', participle: '' },
  });

  assert.equal(draft.verbForms, undefined);
});

test('validace vyžaduje u podstatného jména člen', () => {
  const draft = {
    ...createEmptyDraft(),
    german: 'Haus',
    czech: 'dům',
    kind: 'noun' as const,
  };

  assert.equal(draftHasRequiredFields(draft), false);
  assert.match(vocabularyDraftIssues(draft)[0], /člen/iu);
});

test('AI výstup se převádí na čistý česko-německý draft', () => {
  const item: AiGeneratedVocabularyItem = {
    german: '  fahren ',
    czech: ' jet ',
    kind: 'verb',
    article: 'der',
    plural: 'die Fahrten',
    acceptedGerman: ['reisen', ' reisen '],
    acceptedCzech: ['cestovat'],
    tags: [' Doprava ', 'A2'],
    exampleDe: 'Ich fahre nach Berlin.',
    exampleCs: 'Jedu do Berlína.',
    cefr: 'A2',
    learningNote: 'Používá pomocné sloveso sein.',
    mnemonic: null,
    verbForms: {
      thirdPerson: 'fährt',
      preterite: 'fuhr',
      participle: 'gefahren',
      auxiliary: 'sein',
    },
  };

  const draft = aiItemToDraft(item);
  assert.equal(draft.german, 'fahren');
  assert.equal(draft.article, undefined);
  assert.equal(draft.plural, undefined);
  assert.equal(draft.verbForms?.participle, 'gefahren');
  assert.deepEqual(draft.acceptedGerman, ['reisen']);
  assert.deepEqual(draft.tags, ['doprava', 'a2']);
  assert.equal(draft.source, 'ai');
});

test('společný AI štítek se přidá bez ztráty štítků jednotlivých slov', () => {
  const item: AiGeneratedVocabularyItem = {
    german: 'lernen',
    czech: 'učit se',
    kind: 'verb',
    article: null,
    plural: null,
    acceptedGerman: [],
    acceptedCzech: [],
    tags: ['Škola', 'B1'],
    exampleDe: null,
    exampleCs: null,
    cefr: 'B1',
    learningNote: null,
    mnemonic: null,
    verbForms: null,
  };

  assert.deepEqual(aiItemToDraft(item, ' Test-10-23 ').tags, ['škola', 'b1', 'test-10-23']);
  assert.deepEqual(aiItemToDraft({ ...item, tags: ['test-10-23'] }, 'TEST-10-23').tags, [
    'test-10-23',
  ]);
});
