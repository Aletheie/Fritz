import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChoiceOptions,
  chooseExercise,
  filterCardsBySource,
  filterCardsByTag,
  selectDueCards,
  selectDueCardsForTraining,
  selectDueCardsForTag,
  selectDistinctNoteCards,
} from '../src/lib/domain/scheduler/queue.ts';

import type { Note, ReviewLog, StudyCard } from '../src/lib/domain/types.ts';

const now = new Date('2026-08-03T12:00:00.000Z');

function card(
  id: string,
  options: { fsrs?: boolean; dueOffset?: number; createdOffset?: number } = {},
): StudyCard {
  return {
    id,
    deckId: 'deck',
    noteId: `note_${id}`,
    direction: 'cs-de',
    dueAt: new Date(now.getTime() + (options.dueOffset ?? -1_000)).toISOString(),
    fsrs: options.fsrs ? { due: now.toISOString(), reps: 2 } : undefined,
    createdAt: new Date(now.getTime() + (options.createdOffset ?? 0)).toISOString(),
    updatedAt: now.toISOString(),
  };
}

function note(id: string, kind: Note['kind'] = 'noun'): Note {
  return {
    id,
    deckId: 'deck',
    german: id,
    normalizedGerman: `:${id}`,
    czech: id,
    kind,
    acceptedGerman: [],
    acceptedCzech: [],
    tags: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

test('fronta se nezasekne, když zbývají jen nové karty', () => {
  const cards = [card('review', { fsrs: true }), card('new-a'), card('new-b'), card('new-c')];
  const selected = selectDueCards(cards, now, 20, 20);

  assert.equal(selected.length, 4);
  assert.deepEqual(new Set(selected.map((item) => item.id)), new Set(cards.map((item) => item.id)));
});

test('denní dávka vybere nanejvýš jednu kartu pro každé slovíčko', () => {
  const cards = [
    { ...card('a-front'), noteId: 'note-a' },
    { ...card('a-back'), noteId: 'note-a', direction: 'de-cs' as const },
    { ...card('b-front'), noteId: 'note-b' },
    { ...card('c-front'), noteId: 'note-c' },
  ];

  assert.deepEqual(
    selectDistinctNoteCards(cards, 2).map((item) => item.id),
    ['a-front', 'b-front'],
  );
  assert.equal(new Set(selectDistinctNoteCards(cards).map((item) => item.noteId)).size, 3);
});

test('platí limit nových karet a budoucí karty se nezařadí', () => {
  const cards = [
    card('review', { fsrs: true }),
    card('new-a', { createdOffset: -3_000 }),
    card('new-b', { createdOffset: -2_000 }),
    card('new-c', { createdOffset: -1_000 }),
    card('future', { dueOffset: 60_000 }),
  ];
  const selected = selectDueCards(cards, now, 50, 2);

  assert.equal(selected.filter((item) => !item.fsrs).length, 2);
  assert.equal(
    selected.some((item) => item.id === 'future'),
    false,
  );
});

test('velká dávka vybere jen nejstarší karty ve stejném pořadí', () => {
  const reviews = Array.from({ length: 1_000 }, (_, index) =>
    card(`review-${index}`, { fsrs: true, dueOffset: -index * 1_000 }),
  );
  const fresh = Array.from({ length: 200 }, (_, index) =>
    card(`new-${index}`, { createdOffset: -index * 1_000 }),
  );

  assert.deepEqual(
    selectDueCards([...fresh, ...reviews], now, 8, 3).map((item) => item.id),
    [
      'review-999',
      'review-998',
      'new-199',
      'review-997',
      'review-996',
      'new-198',
      'review-995',
      'review-994',
    ],
  );
});

test('poškozený termín kartu neschová navždy', () => {
  const damaged = { ...card('damaged', { fsrs: true }), dueAt: 'not-a-date' };
  const selected = selectDueCards([damaged], now, 10, 10);

  assert.deepEqual(
    selected.map((item) => item.id),
    ['damaged'],
  );
});

test('nulový limit vrátí prázdnou frontu', () => {
  assert.deepEqual(selectDueCards([card('a')], now, 0, 10), []);
});

test('dlouhodobá fronta skupiny obsahuje jen její právě splatné karty', () => {
  const home = { ...note('note_home'), tags: ['domov'] };
  const travel = { ...note('note_travel'), tags: ['cestování'] };
  const homeCard = { ...card('home'), noteId: home.id };
  const travelCard = { ...card('travel'), noteId: travel.id };
  const futureHomeCard = {
    ...card('future-home', { dueOffset: 60_000 }),
    noteId: home.id,
  };

  assert.deepEqual(
    filterCardsByTag([homeCard, travelCard], [home, travel], 'domov').map((item) => item.id),
    ['home'],
  );
  assert.deepEqual(
    selectDueCardsForTag(
      [homeCard, travelCard, futureHomeCard],
      [home, travel],
      'domov',
      now,
      10,
      10,
    ).map((item) => item.id),
    ['home'],
  );
});

test('volba bez slov z kurzu vyloučí pouze čistě kurzový původ', () => {
  const own = { ...note('note_own'), source: 'manual' as const };
  const linkedOwn = {
    ...note('note_linked'),
    source: 'manual' as const,
    courseLinks: [
      {
        chapterId: 'chapter-01-school',
        nodeId: 'chapter-01-school:vocabulary',
        linkedAt: now.toISOString(),
      },
    ],
  };
  const seed = { ...note('note_seed'), source: 'seed' as const };
  const course = { ...note('note_course'), source: 'course' as const };
  const cards = [
    { ...card('own'), noteId: own.id },
    { ...card('linked'), noteId: linkedOwn.id },
    { ...card('seed'), noteId: seed.id },
    { ...card('course'), noteId: course.id },
  ];

  assert.deepEqual(
    filterCardsBySource(cards, [own, linkedOwn, seed, course], 'without-course').map(
      (item) => item.id,
    ),
    ['own', 'linked', 'seed'],
  );
  assert.deepEqual(
    filterCardsBySource(cards, [own, linkedOwn, seed, course], 'own').map((item) => item.id),
    ['own', 'linked'],
  );
  assert.deepEqual(
    filterCardsBySource(cards, [own, linkedOwn, seed, course], 'course').map((item) => item.id),
    ['linked', 'course'],
  );
});

test('filtr původu se kombinuje s uživatelským štítkem před sestavením dávky', () => {
  const ownTagged = {
    ...note('note_own_tagged'),
    source: 'manual' as const,
    tags: ['test-biologie'],
  };
  const ownOther = { ...note('note_own_other'), source: 'manual' as const, tags: ['jiné'] };
  const courseTagged = {
    ...note('note_course_tagged'),
    source: 'course' as const,
    tags: ['test-biologie'],
  };
  const ownCard = { ...card('own-tagged'), noteId: ownTagged.id };
  const otherCard = { ...card('own-other'), noteId: ownOther.id };
  const courseCard = { ...card('course-tagged'), noteId: courseTagged.id };
  const originalCourseDueAt = courseCard.dueAt;

  const selected = selectDueCardsForTraining(
    [ownCard, otherCard, courseCard],
    [ownTagged, ownOther, courseTagged],
    { tag: 'test-biologie', source: 'without-course' },
    now,
    20,
    20,
  );

  assert.deepEqual(
    selected.map((item) => item.id),
    ['own-tagged'],
  );
  assert.equal(courseCard.dueAt, originalCourseDueAt);
});

test('zdrojový filtr může vrátit prázdnou splatnou frontu bez změny karet', () => {
  const course = { ...note('note_course'), source: 'course' as const };
  const courseCard = { ...card('course'), noteId: course.id };
  const snapshot = structuredClone(courseCard);

  assert.deepEqual(
    selectDueCardsForTraining([courseCard], [course], { source: 'without-course' }, now, 10, 10),
    [],
  );
  assert.deepEqual(courseCard, snapshot);
});

test('volba typu úlohy je deterministická a respektuje čistý mix', () => {
  const sample = card('a');
  assert.equal(chooseExercise({ typing: 100, choice: 0, flashcard: 0 }, sample, 0), 'typing');
  assert.equal(chooseExercise({ typing: 0, choice: 100, flashcard: 0 }, sample, 0), 'choice');
  assert.equal(chooseExercise({ typing: 0, choice: 0, flashcard: 100 }, sample, 0), 'flashcard');
});

test('výběrová úloha obsahuje správnou možnost právě jednou', () => {
  const current = note('current');
  const options = buildChoiceOptions(current, [
    current,
    note('a'),
    note('b'),
    note('c'),
    note('d', 'verb'),
  ]);

  assert.equal(options.length, 4);
  assert.equal(options.filter((item) => item.id === current.id).length, 1);
  assert.equal(new Set(options.map((item) => item.id)).size, options.length);
});

test('adaptivní volba respektuje režim pouze psaní', async () => {
  const { chooseAdaptiveExercise } = await import('../src/lib/domain/scheduler/queue.ts');
  const current = note('current');
  const decision = chooseAdaptiveExercise({
    card: card('current'),
    note: current,
    notes: [current, note('other')],
    reviews: [],
    preferences: {
      typing: true,
      choice: false,
      flashcard: false,
      wordOrder: false,
      cloze: false,
      sentence: false,
      matching: false,
      speaking: false,
    },
    sessionIndex: 0,
    aiAvailable: true,
  });
  assert.equal(decision.kind, 'typing');
  assert.deepEqual(decision.available, ['typing']);
});

test('reklamované hodnocení neovlivní adaptivní volbu další úlohy', async () => {
  const { chooseAdaptiveExercise } = await import('../src/lib/domain/scheduler/queue.ts');
  const current = note('current');
  const currentCard = card('current', { fsrs: true });
  const preferences = {
    typing: true,
    choice: true,
    flashcard: true,
    wordOrder: true,
    cloze: true,
    sentence: false,
    matching: false,
    speaking: true,
  };
  const disputed: ReviewLog = {
    id: 'disputed-review',
    cardId: currentCard.id,
    noteId: current.id,
    deckId: current.deckId,
    reviewedAt: now.toISOString(),
    mode: 'long-term',
    exercise: 'typing',
    rating: 'again',
    signal: {
      exercise: 'typing',
      wordCorrect: false,
      articleCorrect: false,
      exact: false,
      keyboardEquivalent: false,
      editDistance: 4,
      responseMs: 2_000,
      hintsUsed: 1,
      attempt: 1,
    },
    excludedFromLearning: true,
  };

  const withoutHistory = chooseAdaptiveExercise({
    card: currentCard,
    note: current,
    notes: [current, note('other')],
    reviews: [],
    preferences,
    sessionIndex: 3,
    aiAvailable: false,
  });
  const withDispute = chooseAdaptiveExercise({
    card: currentCard,
    note: current,
    notes: [current, note('other')],
    reviews: [disputed],
    preferences,
    sessionIndex: 3,
    aiAvailable: false,
  });

  assert.deepEqual(withDispute, withoutHistory);
});

test('AI věta není dostupná bez klíče a neplatná konfigurace nezablokuje relaci', async () => {
  const { chooseAdaptiveExercise } = await import('../src/lib/domain/scheduler/queue.ts');
  const current = note('current', 'phrase');
  const decision = chooseAdaptiveExercise({
    card: card('current'),
    note: current,
    notes: [current],
    reviews: [],
    preferences: {
      typing: false,
      choice: false,
      flashcard: false,
      wordOrder: false,
      cloze: false,
      sentence: true,
      matching: false,
      speaking: false,
    },
    sessionIndex: 0,
    aiAvailable: false,
  });
  assert.equal(decision.kind, 'typing');
  assert.deepEqual(decision.available, ['typing']);
});

test('adaptivní výběr nabídne párování jen s dostatkem unikátních slov', async () => {
  const { chooseAdaptiveExercise } = await import('../src/lib/domain/scheduler/queue.ts');
  const current = note('current');
  const preferences = {
    typing: false,
    choice: false,
    flashcard: false,
    wordOrder: false,
    cloze: false,
    sentence: false,
    matching: true,
    speaking: false,
  };
  const ready = chooseAdaptiveExercise({
    card: card('current'),
    note: current,
    notes: [current, note('a'), note('b'), note('c')],
    reviews: [],
    preferences,
    sessionIndex: 0,
    aiAvailable: false,
  });
  const sparse = chooseAdaptiveExercise({
    card: card('current'),
    note: current,
    notes: [current],
    reviews: [],
    preferences,
    sessionIndex: 0,
    aiAvailable: false,
  });

  assert.deepEqual(ready.available, ['matching']);
  assert.deepEqual(sparse.available, ['typing']);
});

test('mluvení zůstane dostupné i bez mikrofonu díky textovému fallbacku', async () => {
  const { chooseAdaptiveExercise } = await import('../src/lib/domain/scheduler/queue.ts');
  const current = note('current');
  const preferences = {
    typing: false,
    choice: false,
    flashcard: false,
    wordOrder: false,
    cloze: false,
    sentence: false,
    matching: false,
    speaking: true,
  };
  const decision = chooseAdaptiveExercise({
    card: card('current'),
    note: current,
    notes: [current],
    reviews: [],
    preferences,
    sessionIndex: 0,
    aiAvailable: false,
  });

  assert.deepEqual(decision.available, ['speaking']);
});
