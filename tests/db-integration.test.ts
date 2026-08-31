// oxlint-disable-next-line import/no-unassigned-import -- installs IndexedDB globals for Node.
import 'fake-indexeddb/auto';

import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';

import {
  DB_VERSION,
  closeDatabaseConnection,
  getAll,
  getOne,
  openDatabase,
  putCourseProgress,
  readRecentReviewsForNote,
} from '../src/lib/data/db.ts';
import {
  addImportedNotes,
  disputeReview,
  ensureSeeded,
  loadSnapshot,
  loadOrCreateDailySession,
  recordReview,
  exportBackup,
  resetToSeed,
  restoreBackup,
  rollbackLastDestructiveChange,
  saveCourseRewardClaim,
  saveCourseAnswer,
  saveStoryCheckpoint,
  saveDailyActivityResult,
} from '../src/lib/data/repository.ts';
import { createCourseProgress, grammarLessons } from '../src/lib/domain/course/grammar.ts';
import { normalizeGermanKey } from '../src/lib/domain/grading/normalize.ts';
import { createDailySession } from '../src/lib/domain/learning/planner.ts';
import type { ReviewStats } from '../src/lib/domain/stats/review-stats.ts';

import type {
  DailyLessonPlan,
  DailySessionRecord,
  LearningEvidence,
  SkillState,
} from '../src/lib/domain/learning/types.ts';
import type {
  AnswerSignal,
  CourseProgress,
  ImportedNoteDraft,
  Note,
  ReviewLog,
  StudyCard,
} from '../src/lib/domain/types.ts';

const TEST_DATABASE_NAMES = ['fritz', 'wortly'] as const;
const LEGACY_DATABASE_NAME = TEST_DATABASE_NAMES[1];

async function deleteTestDatabase(): Promise<void> {
  await closeDatabaseConnection();
  for (const name of TEST_DATABASE_NAMES) {
    // oxlint-disable-next-line no-await-in-loop -- deletion order keeps migration fixtures isolated.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.addEventListener('success', () => resolve(), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
      request.addEventListener(
        'blocked',
        () => reject(new Error('Testovací databázi stále drží otevřené spojení.')),
        { once: true },
      );
    });
  }
}

beforeEach(deleteTestDatabase);
after(deleteTestDatabase);

function importedWord(german = 'Zug'): ImportedNoteDraft {
  return {
    german,
    normalizedGerman: normalizeGermanKey(german),
    czech: 'vlak',
    kind: 'noun',
    article: 'der',
    plural: 'die Züge',
    acceptedGerman: [],
    acceptedCzech: [],
    tags: ['test'],
    cefr: 'A1',
    source: 'import',
    sourceLine: 1,
  };
}

function exactSignal(): AnswerSignal {
  return {
    exercise: 'typing',
    submittedText: 'Hund',
    normalizedText: 'hund',
    expectedText: 'Hund',
    wordCorrect: true,
    articleCorrect: true,
    exact: true,
    keyboardEquivalent: false,
    editDistance: 0,
    responseMs: 1_200,
    hintsUsed: 0,
    attempt: 1,
  };
}

test('fresh seed is atomic and DB v8 exposes compound identity indexes', async () => {
  await Promise.all([ensureSeeded(), ensureSeeded()]);
  const database = await openDatabase();
  assert.equal(database.version, DB_VERSION);

  const transaction = database.transaction(['notes', 'cards', 'reviews'], 'readonly');
  assert.equal(transaction.objectStore('notes').index('deckAndNormalizedGerman').unique, true);
  assert.equal(transaction.objectStore('cards').index('noteAndDirection').unique, true);
  assert.equal(transaction.objectStore('reviews').index('operationId').unique, true);
  assert.equal((await getAll<Note>('notes')).length, 14);
});

test('Fritz migration preserves legacy duplicate records and a non-sensitive conflict report', async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DATABASE_NAME, 5);
    request.addEventListener('upgradeneeded', () => {
      const notes = request.result.createObjectStore('notes', { keyPath: 'id' });
      notes.add({ id: 'legacy-note-a', deckId: 'deck-a', normalizedGerman: 'bank' });
      notes.add({ id: 'legacy-note-b', deckId: 'deck-a', normalizedGerman: 'bank' });
    });
    request.addEventListener(
      'success',
      () => {
        request.result.close();
        resolve();
      },
      { once: true },
    );
    request.addEventListener('error', () => reject(request.error), { once: true });
  });

  const database = await openDatabase();
  const transaction = database.transaction(['notes', 'meta'], 'readonly');
  const noteIndex = transaction.objectStore('notes').index('deckAndNormalizedGerman');
  const report = await getOne<{
    conflictGroups: number;
    recordIds: string[];
    normalizedGerman?: string;
  }>('meta', 'migration-conflicts:notes');

  assert.equal(noteIndex.unique, false);
  assert.equal((await getAll<Note>('notes')).length, 2);
  assert.equal(report?.conflictGroups, 1);
  assert.deepEqual(report?.recordIds, ['legacy-note-a', 'legacy-note-b']);
  assert.equal(report?.normalizedGerman, undefined);
});

test('Fritz migration upgrades DB v6 review and course history into learning evidence', async () => {
  const reviewedAt = '2026-08-06T09:00:00.000Z';
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DATABASE_NAME, 6);
    request.addEventListener('upgradeneeded', () => {
      const cards = request.result.createObjectStore('cards', { keyPath: 'id' });
      const reviews = request.result.createObjectStore('reviews', { keyPath: 'id' });
      const course = request.result.createObjectStore('course', { keyPath: 'key' });
      cards.add({
        id: 'legacy-card',
        deckId: 'legacy-deck',
        noteId: 'legacy-note',
        direction: 'cs-de',
        dueAt: reviewedAt,
        createdAt: reviewedAt,
        updatedAt: reviewedAt,
      });
      reviews.add({
        id: 'legacy-review',
        operationId: 'legacy-operation',
        cardId: 'legacy-card',
        noteId: 'legacy-note',
        deckId: 'legacy-deck',
        reviewedAt,
        localDay: '2026-08-06',
        mode: 'long-term',
        exercise: 'typing',
        rating: 'good',
        signal: exactSignal(),
      });
      course.add({
        ...createCourseProgress(new Date(reviewedAt)),
        events: [
          {
            id: 'legacy-course-answer',
            lessonId: grammarLessons[0].id,
            questionId: grammarLessons[0].questions[0].id,
            answeredAt: reviewedAt,
            correct: true,
            firstTry: true,
            xpAwarded: 2,
            responseMs: 900,
          },
        ],
      });
    });
    request.addEventListener(
      'success',
      () => {
        request.result.close();
        resolve();
      },
      { once: true },
    );
    request.addEventListener('error', () => reject(request.error), { once: true });
  });

  await openDatabase();
  const evidence = await getAll<LearningEvidence>('learningEvidence');
  const states = await getAll<SkillState>('skillStates');
  const reviewStats = await getOne<ReviewStats>('reviewStats', 'reviews');
  assert.deepEqual(evidence.map((event) => event.id).toSorted(), [
    'evidence:course-answer:legacy-course-answer',
    'evidence:review:legacy-review',
  ]);
  assert.equal(states.length, 2);
  assert.equal(reviewStats?.countedReviews, 1);
  assert.ok((reviewStats?.reviewXp ?? 0) > 0);
});

test('two concurrent imports of one deck-scoped word commit exactly one note and card', async () => {
  const snapshot = await loadSnapshot();
  const deckId = snapshot.decks[0].id;
  const [left, right] = await Promise.all([
    addImportedNotes(deckId, [importedWord()]),
    addImportedNotes(deckId, [importedWord()]),
  ]);

  assert.equal(left.addedNotes.length + right.addedNotes.length, 1);
  assert.equal(left.duplicates + right.duplicates, 1);
  const notes = (await getAll<Note>('notes')).filter(
    (note) => note.deckId === deckId && note.normalizedGerman === normalizeGermanKey('Zug', 'der'),
  );
  assert.equal(notes.length, 1);
  const cards = (await getAll<StudyCard>('cards')).filter((card) => card.noteId === notes[0].id);
  assert.equal(cards.length, 1);
});

test('same review operation is idempotent even when submitted concurrently', async () => {
  const snapshot = await loadSnapshot();
  const card = snapshot.cards[0];
  const note = snapshot.notes.find((candidate) => candidate.id === card.noteId)!;
  const input = {
    operationId: 'review-operation:test-same',
    cardId: card.id,
    noteId: note.id,
    mode: 'long-term' as const,
    rating: 'good' as const,
    signal: exactSignal(),
    now: new Date('2026-08-07T10:00:00.000Z'),
  };

  const [left, right] = await Promise.all([recordReview(input), recordReview(input)]);
  assert.equal(left.log.id, right.log.id);
  assert.equal((await getAll<ReviewLog>('reviews')).length, 1);
  assert.equal((await getAll<LearningEvidence>('learningEvidence')).length, 1);
  assert.equal((await getAll<SkillState>('skillStates')).length, 1);
  const stored = await getOne<StudyCard>('cards', card.id);
  assert.equal(stored?.fsrs?.reps, 1);
});

test('daily activity commits session, evidence, and derived skill state atomically', async () => {
  await loadSnapshot();
  const plan: DailyLessonPlan = {
    id: 'daily:2026-08-13:5:school:v2',
    schemaVersion: 2,
    localDay: '2026-08-13',
    minutes: 5,
    learningGoal: 'school',
    generatedAt: '2026-08-13T08:00:00.000Z',
    estimatedSeconds: 300,
    activities: [
      {
        id: 'daily-listening-test',
        kind: 'listening',
        phase: 'focus',
        title: 'Poslech',
        instruction: 'Napiš větu.',
        estimatedSeconds: 90,
        skillIds: ['listening:chapter-test'],
        chapterId: 'chapter-test',
        audioId: 'chapter-test-1',
        transcript: 'Heute lerne ich Deutsch.',
        translation: 'Dnes se učím německy.',
      },
    ],
  };
  await loadOrCreateDailySession(createDailySession(plan, new Date(plan.generatedAt)));
  const evidence: LearningEvidence = {
    id: 'evidence:daily-listening-test',
    activityId: 'daily-listening-test',
    source: 'listening-dictation',
    sourceId: 'chapter-test-1',
    skillIds: ['listening:chapter-test'],
    occurredAt: '2026-08-13T08:01:00.000Z',
    localDay: '2026-08-13',
    mode: 'long-term',
    modality: 'dictation',
    outcome: 'correct',
    hintsUsed: 0,
    responseMs: 1200,
    independent: true,
  };
  const completed = await saveDailyActivityResult({
    sessionKey: plan.id,
    activityId: plan.activities[0].id,
    evidence,
    now: new Date(evidence.occurredAt),
  });

  assert.equal(completed.completedAt, evidence.occurredAt);
  assert.equal(
    (await getOne<DailySessionRecord>('dailySessions', plan.id))?.completedAt,
    evidence.occurredAt,
  );
  assert.equal(
    (await getOne<LearningEvidence>('learningEvidence', evidence.id))?.activityId,
    evidence.activityId,
  );
  assert.equal((await getOne<SkillState>('skillStates', 'listening:chapter-test'))?.stage, 1);
});

test('two distinct concurrent ratings serialize from the latest committed FSRS card', async () => {
  const snapshot = await loadSnapshot();
  const card = snapshot.cards[0];
  const note = snapshot.notes.find((candidate) => candidate.id === card.noteId)!;
  const common = {
    cardId: card.id,
    noteId: note.id,
    mode: 'long-term' as const,
    rating: 'good' as const,
    signal: exactSignal(),
    now: new Date('2026-08-07T10:00:00.000Z'),
  };

  await Promise.all([
    recordReview({ ...common, operationId: 'review-operation:first' }),
    recordReview({ ...common, operationId: 'review-operation:second' }),
  ]);

  assert.equal((await getAll<ReviewLog>('reviews')).length, 2);
  const stored = await getOne<StudyCard>('cards', card.id);
  assert.equal(stored?.fsrs?.reps, 2);
});

test('cram review records evidence but leaves long-term FSRS and due date byte-for-byte unchanged', async () => {
  const snapshot = await loadSnapshot();
  const card = snapshot.cards[0];
  const note = snapshot.notes.find((candidate) => candidate.id === card.noteId)!;
  const before = JSON.stringify(card);

  await recordReview({
    operationId: 'review-operation:cram',
    cardId: card.id,
    noteId: note.id,
    mode: 'cram',
    rating: 'easy',
    signal: exactSignal(),
    now: new Date('2026-08-07T10:00:00.000Z'),
  });

  assert.equal(JSON.stringify(await getOne<StudyCard>('cards', card.id)), before);
  assert.equal((await getAll<ReviewLog>('reviews')).length, 1);
});

test('reklamace vyřadí AI verdikt a atomicky obnoví předchozí plán karty', async () => {
  const snapshot = await loadSnapshot();
  const card = snapshot.cards[0];
  const note = snapshot.notes.find((candidate) => candidate.id === card.noteId)!;
  const dueBefore = card.dueAt;
  const reviewedAt = new Date(Date.parse(card.dueAt) + 60_000);
  const saved = await recordReview({
    operationId: 'review-operation:disputed',
    cardId: card.id,
    noteId: note.id,
    mode: 'long-term',
    rating: 'good',
    signal: { ...exactSignal(), exercise: 'sentence', aiAccepted: true, aiScore: 72 },
    now: reviewedAt,
  });

  const disputed = await disputeReview({
    reviewId: saved.log.id,
    reason: 'ai-too-strict',
    now: new Date(reviewedAt.getTime() + 500),
  });
  assert.equal(disputed.log.excludedFromLearning, true);
  assert.equal(disputed.log.disputeReason, 'ai-too-strict');
  assert.equal(disputed.log.xpAwarded, 0);
  assert.equal(disputed.card.dueAt, dueBefore);
  assert.equal((await getOne<StudyCard>('cards', card.id))?.dueAt, dueBefore);
  assert.equal((await getOne<ReviewLog>('reviews', saved.log.id))?.excludedFromLearning, true);
  assert.equal((await getAll<SkillState>('skillStates')).length, 0);
});

test('reklamace staršího verdiktu nepřepíše novější plán stejné karty', async () => {
  const snapshot = await loadSnapshot();
  const card = snapshot.cards[0];
  const note = snapshot.notes.find((candidate) => candidate.id === card.noteId)!;
  const first = await recordReview({
    operationId: 'review-operation:historical-first',
    cardId: card.id,
    noteId: note.id,
    mode: 'long-term',
    rating: 'good',
    signal: exactSignal(),
    now: new Date('2026-08-07T10:00:00.000Z'),
  });
  await recordReview({
    operationId: 'review-operation:historical-second',
    cardId: card.id,
    noteId: note.id,
    mode: 'long-term',
    rating: 'easy',
    signal: exactSignal(),
    now: new Date('2026-08-07T10:05:00.000Z'),
  });
  const latestDue = (await getOne<StudyCard>('cards', card.id))!.dueAt;

  await disputeReview({
    reviewId: first.log.id,
    reason: 'ai-too-strict',
    now: new Date('2026-08-07T10:06:00.000Z'),
  });

  assert.equal((await getOne<StudyCard>('cards', card.id))?.dueAt, latestDue);
  assert.equal((await getOne<ReviewLog>('reviews', first.log.id))?.excludedFromLearning, true);
});

test('review command reads only the indexed local day instead of scanning full history', async () => {
  const snapshot = await loadSnapshot();
  const card = snapshot.cards[0];
  const note = snapshot.notes.find((candidate) => candidate.id === card.noteId)!;
  const database = await openDatabase();
  const sampleStore = database.transaction('reviews', 'readonly').objectStore('reviews');
  const prototype = Object.getPrototypeOf(sampleStore) as IDBObjectStore;
  const originalGetAll = prototype.getAll;
  let fullHistoryReads = 0;
  prototype.getAll = function trackFullHistoryRead(...args: Parameters<IDBObjectStore['getAll']>) {
    if (this.name === 'reviews') fullHistoryReads += 1;
    return originalGetAll.apply(this, args);
  };

  try {
    await recordReview({
      operationId: 'review-operation:indexed-day',
      cardId: card.id,
      noteId: note.id,
      mode: 'long-term',
      rating: 'good',
      signal: exactSignal(),
      now: new Date('2026-08-07T10:00:00.000Z'),
    });
    assert.equal(fullHistoryReads, 0);
  } finally {
    prototype.getAll = originalGetAll;
  }
});

test('start aplikace načte omezenou historii a detail slovíčka ji čte indexovaně', async () => {
  const snapshot = await loadSnapshot();
  const card = snapshot.cards[0];
  const note = snapshot.notes.find((candidate) => candidate.id === card.noteId)!;
  await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      recordReview({
        operationId: `review-operation:history-${index}`,
        cardId: card.id,
        noteId: note.id,
        mode: 'cram',
        rating: 'good',
        signal: exactSignal(),
        now: new Date(`2026-08-07T10:0${index}:00.000Z`),
      }),
    ),
  );

  const database = await openDatabase();
  const sampleStore = database.transaction('reviews', 'readonly').objectStore('reviews');
  const prototype = Object.getPrototypeOf(sampleStore) as IDBObjectStore;
  const originalGetAll = prototype.getAll;
  let fullHistoryReads = 0;
  prototype.getAll = function trackFullHistoryRead(...args: Parameters<IDBObjectStore['getAll']>) {
    if (this.name === 'reviews') fullHistoryReads += 1;
    return originalGetAll.apply(this, args);
  };

  try {
    const loaded = await loadSnapshot();
    const history = await readRecentReviewsForNote(note.id, 5);
    assert.equal(fullHistoryReads, 0);
    assert.equal(loaded.reviewStats.countedReviews, 6);
    assert.equal(history.length, 5);
    assert.deepEqual(
      history.map((review) => review.reviewedAt),
      history
        .map((review) => review.reviewedAt)
        .toSorted()
        .toReversed(),
    );
  } finally {
    prototype.getAll = originalGetAll;
  }
});

test('normal startup never clears stores to persist an in-memory normalization', async () => {
  const snapshot = await loadSnapshot();
  const legacyShape = { ...snapshot.course };
  delete legacyShape.appliedOperations;
  await putCourseProgress(legacyShape);

  const database = await openDatabase();
  const store = database.transaction('course', 'readonly').objectStore('course');
  const prototype = Object.getPrototypeOf(store) as IDBObjectStore;
  const originalClear = prototype.clear;
  let clearCalls = 0;
  prototype.clear = function clear(...args: Parameters<IDBObjectStore['clear']>) {
    clearCalls += 1;
    return originalClear.apply(this, args);
  };

  try {
    const loaded = await loadSnapshot();
    assert.deepEqual(loaded.course.appliedOperations, []);
    assert.equal(clearCalls, 0);
    const stillStored = await getOne<CourseProgress>('course', 'course');
    assert.equal(stillStored?.appliedOperations, undefined);
  } finally {
    prototype.clear = originalClear;
  }
});

test('story and reward commands merge against latest course state and remain idempotent', async () => {
  const snapshot = await loadSnapshot();
  await putCourseProgress({
    ...snapshot.course,
    unlockedStoryBooks: ['a1-maerchen'],
  });
  const storyInput = {
    progress: snapshot.course,
    operationId: 'story-checkpoint:test-same',
    bookId: 'a1-maerchen' as const,
    episodeId: 'a1-maerchen-e01',
    checkpointId: 'a1-maerchen-e01-c01',
    result: { completed: true, correct: true },
    now: new Date('2026-08-07T10:00:00.000Z'),
  };

  await Promise.all([saveStoryCheckpoint(storyInput), saveStoryCheckpoint(storyInput)]);
  await Promise.all([
    saveCourseRewardClaim(snapshot.course, 'xp-2000'),
    saveCourseRewardClaim(snapshot.course, 'xp-2000'),
  ]);

  const course = await getOne<CourseProgress>('course', 'course');
  assert.equal(course?.storyBooks['a1-maerchen']?.exerciseAttempts, 1);
  assert.equal(course?.storyBooks['a1-maerchen']?.correctExercises, 1);
  assert.deepEqual(course?.claimedRewards, ['xp-2000']);
});

test('reset creates a validated rollback and undo restores the exact prior records', async () => {
  const snapshot = await loadSnapshot();
  const deckId = snapshot.decks[0].id;
  const imported = await addImportedNotes(deckId, [importedWord('Bahnhof')]);
  const noteId = imported.addedNotes[0].id;
  const before = await exportBackup();

  await resetToSeed();
  assert.equal(
    (await getAll<Note>('notes')).some((note) => note.id === noteId),
    false,
  );

  await rollbackLastDestructiveChange();
  const restored = await exportBackup();
  assert.deepEqual(
    restored.notes.map((note) => note.id).toSorted(),
    before.notes.map((note) => note.id).toSorted(),
  );
  assert.equal(
    restored.notes.some((note) => note.id === noteId),
    true,
  );
});

test('invalid restore fails during dry-run validation without touching current DB', async () => {
  await loadSnapshot();
  const before = await exportBackup();
  const corrupt = { ...before, cards: [{ ...before.cards[0], noteId: 'missing-note' }] };

  await assert.rejects(() => restoreBackup(corrupt), /neplatnou vazbu/u);
  const afterRestore = await exportBackup();
  assert.deepEqual(afterRestore.notes, before.notes);
  assert.deepEqual(afterRestore.cards, before.cards);
});

test('course answer retry uses a stable operation ID and never awards XP twice', async () => {
  const snapshot = await loadSnapshot();
  const lesson = grammarLessons[0];
  const input = {
    operationId: 'course-answer-operation:same',
    progress: snapshot.course,
    lessonId: lesson.id,
    questionId: lesson.questions[0].id,
    correct: true,
    responseMs: 1_000,
    now: new Date('2026-08-07T12:00:00.000Z'),
  };

  const [first, second] = await Promise.all([saveCourseAnswer(input), saveCourseAnswer(input)]);
  const stored = await getOne<CourseProgress>('course', 'course');
  assert.equal(stored?.events.length, 1);
  assert.equal(stored?.events[0].id, `course-answer:${input.operationId}`);
  assert.equal(first.event.id, second.event.id);
  assert.equal(
    stored?.events.reduce((sum, event) => sum + event.xpAwarded, 0),
    first.xpAwarded,
  );
});
