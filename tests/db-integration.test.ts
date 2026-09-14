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
  replaceWithBackup,
} from '../src/lib/data/db.ts';
import {
  addImportedNotes,
  disputeReview,
  ensureSeeded,
  loadSnapshot,
  loadOrCreateDailySession,
  recordReview,
  removeNote,
  exportBackup,
  prepareLocalDataForAccount,
  resetToSeed,
  restoreBackup,
  rollbackLastDestructiveChange,
  saveCourseRewardClaim,
  saveCourseAnswer,
  saveGrammarLessonRun,
  saveCoachSession,
  saveStoryCheckpoint,
  saveDailyActivityResult,
  saveDoubleXpPurchase,
  saveVocabularyPathNodeCompletion,
  savePathNodeCompletion,
  savePathWritingDraft,
} from '../src/lib/data/repository.ts';
import { parseBackup } from '../src/lib/domain/backup/validate.ts';
import { coachScenarioById } from '../src/lib/domain/course/coach.ts';
import { courseFoundations } from '../src/lib/domain/course/course-foundations.ts';
import {
  createCourseProgress,
  grammarLessonById,
  grammarLessons,
  recordCourseAnswer,
} from '../src/lib/domain/course/grammar.ts';
import { completeCoursePathNode, coursePathChapterById } from '../src/lib/domain/course/path.ts';
import { availableXpBalance, DOUBLE_XP_NEXT_NODE } from '../src/lib/domain/course/wallet.ts';
import { totalXp } from '../src/lib/domain/gamification.ts';
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

test('vocabulary foundation revision survives a real export and restore', async () => {
  await ensureSeeded();
  const snapshot = await loadSnapshot();
  const chapter = coursePathChapterById('chapter-01-school')!;
  let progress = snapshot.course;
  for (const node of chapter.nodes.filter((candidate) => candidate.required))
    progress = completeCoursePathNode(progress, node.id, 3).progress;
  await putCourseProgress(progress);
  const nodeId = 'chapter-31-first-introduction:vocabulary';
  await saveVocabularyPathNodeCompletion({ progress, nodeId, deckId: snapshot.decks[0].id });
  const backup = parseBackup(await exportBackup());
  assert.equal(
    backup.course.vocabularyEvents.find((event) => event.nodeId === nodeId)?.foundationRevision,
    1,
  );
  await restoreBackup(backup);
  const repeat = await saveVocabularyPathNodeCompletion({
    progress: backup.course,
    nodeId,
    deckId: snapshot.decks[0].id,
  });
  assert.equal(repeat.completion.xpAwarded, 0);
  assert.equal(repeat.vocabulary.added, 0);
  const legacy = structuredClone(backup);
  const foundationLemmas = new Set(
    courseFoundations['chapter-31-first-introduction'].map((word) => word.german),
  );
  const removedIds = new Set(
    legacy.notes.filter((note) => foundationLemmas.has(note.german)).map((note) => note.id),
  );
  legacy.notes = legacy.notes.filter((note) => !removedIds.has(note.id));
  legacy.cards = legacy.cards.filter((card) => !removedIds.has(card.noteId));
  const legacyEvent = legacy.course.vocabularyEvents.find((event) => event.nodeId === nodeId)!;
  legacyEvent.addedNoteIds = legacyEvent.addedNoteIds.filter((id) => !removedIds.has(id));
  legacyEvent.linkedNoteIds = legacyEvent.linkedNoteIds.filter((id) => !removedIds.has(id));
  delete legacyEvent.foundationRevision;
  await restoreBackup(legacy);
  const later = new Date(Date.parse(legacyEvent.completedAt) + 1000);
  const upgraded = await saveVocabularyPathNodeCompletion({
    progress: legacy.course,
    nodeId,
    deckId: snapshot.decks[0].id,
    now: later,
  });
  assert.equal(upgraded.vocabulary.added, 6);
  assert.equal(upgraded.completion.xpAwarded, 0);
  const upgradedBackup = parseBackup(await exportBackup());
  assert.equal(
    upgradedBackup.course.vocabularyEvents.find((event) => event.nodeId === nodeId)?.completedAt,
    legacyEvent.completedAt,
  );
  await restoreBackup(upgradedBackup);
});

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

test('fresh seed is atomic and exposes compound identity indexes', async () => {
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

test('startup retains recent repair evidence and all skill progress without loading old evidence', async () => {
  const snapshot = await loadSnapshot();
  const card = snapshot.cards[0];
  for (const daysAgo of [90, 1]) {
    // oxlint-disable-next-line no-await-in-loop
    await recordReview({
      operationId: `evidence-window-${daysAgo}`,
      cardId: card.id,
      noteId: card.noteId,
      mode: 'long-term',
      rating: 'good',
      signal: exactSignal(),
      now: new Date(Date.now() - daysAgo * 86_400_000),
    });
  }
  const loaded = await loadSnapshot();
  const storedSkills = await getAll<SkillState>('skillStates');
  assert.equal(loaded.learningEvidence.length, 1);
  assert.equal(loaded.learningEvidence[0].operationId, 'evidence-window-1');
  assert.deepEqual(loaded.skillStates, storedSkills);
  assert.ok(loaded.skillStates.every((skill) => skill.attempts === 2));
  const backup = await exportBackup();
  assert.equal(backup.learningEvidence.length, 2);
  assert.equal(backup.reviews.length, 2);
  assert.doesNotThrow(() => parseBackup(backup));
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

for (const change of ['delete', 'dispute'] as const) {
  test(`backup, restore, reset and undo survive a review ${change} after spending its XP`, async () => {
    const snapshot = await loadSnapshot();
    const card = snapshot.cards[0];
    const reviews: ReviewLog[] = [];
    let earnedXp = 0;
    for (let attempt = 0; attempt < 40 && earnedXp < DOUBLE_XP_NEXT_NODE.price; attempt += 1) {
      // oxlint-disable-next-line no-await-in-loop -- earn XP through successive real review commands.
      const saved = await recordReview({
        operationId: `wallet-review-${attempt}`,
        cardId: card.id,
        noteId: card.noteId,
        mode: 'long-term',
        rating: 'good',
        signal: exactSignal(),
        now: new Date(Date.UTC(2026, 7, attempt + 1, 12)),
      });
      reviews.push(saved.log);
      earnedXp += saved.log.xpAwarded ?? 0;
    }
    assert.ok(earnedXp >= DOUBLE_XP_NEXT_NODE.price);
    const purchase = await saveDoubleXpPurchase({ progress: snapshot.course });
    const before = await exportBackup();

    if (change === 'delete') {
      await removeNote(card.noteId, purchase.progress);
    } else {
      await disputeReview({ reviewId: reviews.at(-1)!.id, reason: 'content-error' });
    }
    const remainingXp = totalXp(await getAll<ReviewLog>('reviews'));
    assert.ok(remainingXp < DOUBLE_XP_NEXT_NODE.price);
    const changed = await exportBackup();
    assert.equal(availableXpBalance(remainingXp, changed.course), 0);
    assert.deepEqual(changed.course.wallet, before.course.wallet);

    await restoreBackup(before);
    assert.deepEqual((await exportBackup()).reviews, before.reviews);
    await rollbackLastDestructiveChange();
    const undoneRestore = await exportBackup();
    assert.deepEqual(undoneRestore.notes, changed.notes);
    assert.deepEqual(undoneRestore.reviews, changed.reviews);
    assert.deepEqual(undoneRestore.course.wallet, changed.course.wallet);

    await resetToSeed();
    assert.deepEqual((await exportBackup()).course.wallet.purchases, []);
    await rollbackLastDestructiveChange();
    const undoneReset = await exportBackup();
    assert.deepEqual(undoneReset.notes, changed.notes);
    assert.deepEqual(undoneReset.reviews, changed.reviews);
    assert.deepEqual(undoneReset.course.wallet, changed.course.wallet);
  });
}

test('a newly created server account gets fresh local data without an undo path', async () => {
  const snapshot = await loadSnapshot();
  const imported = await addImportedNotes(snapshot.decks[0].id, [importedWord('Bahnhof')]);
  const noteId = imported.addedNotes[0].id;

  const firstBindingReset = await prepareLocalDataForAccount({
    accountId: 'account-one',
    accountCreatedAt: '2020-01-01T00:00:00.000Z',
  });
  assert.equal(firstBindingReset, false);
  assert.equal(
    (await getAll<Note>('notes')).some((note) => note.id === noteId),
    true,
  );

  const repeatedLoginReset = await prepareLocalDataForAccount({
    accountId: 'account-one',
    accountCreatedAt: '2020-01-01T00:00:00.000Z',
  });
  assert.equal(repeatedLoginReset, false);

  const newAccountReset = await prepareLocalDataForAccount({
    accountId: 'account-two',
    accountCreatedAt: '2026-09-02T00:00:00.000Z',
  });
  assert.equal(newAccountReset, true);
  assert.equal(
    (await getAll<Note>('notes')).some((note) => note.id === noteId),
    false,
  );
  await assert.rejects(() => rollbackLastDestructiveChange(), /není dostupn/u);
});

test('first account binding preserves existing study data even when it predates the account', async () => {
  const before = await exportBackupAfterSeed();
  const reset = await prepareLocalDataForAccount({
    accountId: 'first-known-account',
    accountCreatedAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  assert.equal(reset, false);
  const afterBinding = await exportBackup();
  assert.deepEqual(afterBinding.notes, before.notes);
  assert.deepEqual(afterBinding.settings, before.settings);
});

async function exportBackupAfterSeed() {
  await loadSnapshot();
  return exportBackup();
}

test('concurrent account binding resets data only once', async () => {
  await loadSnapshot();
  await prepareLocalDataForAccount({
    accountId: 'old-account',
    accountCreatedAt: new Date().toISOString(),
  });
  const results = await Promise.all([
    prepareLocalDataForAccount({
      accountId: 'new-account',
      accountCreatedAt: new Date().toISOString(),
    }),
    prepareLocalDataForAccount({
      accountId: 'new-account',
      accountCreatedAt: new Date().toISOString(),
    }),
  ]);
  assert.deepEqual(results.toSorted(), [false, true]);
  assert.equal((await getOne<{ accountId: string }>('meta', 'account'))?.accountId, 'new-account');
});

test('a synchronous restore write failure aborts all pending clears', async () => {
  const before = await exportBackupAfterSeed();
  const invalid = structuredClone(before);
  Object.assign(invalid.notes[0], { uncloneable: () => undefined });
  await assert.rejects(() => replaceWithBackup(invalid), { name: 'DataCloneError' });
  const afterFailure = await exportBackup();
  assert.deepEqual(afterFailure.notes, before.notes);
  assert.deepEqual(afterFailure.cards, before.cards);
  assert.deepEqual(afterFailure.settings, before.settings);
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

test('backup keeps one consistent snapshot when another tab clears history', async () => {
  const snapshot = await loadSnapshot();
  const card = snapshot.cards[0];
  const result = await recordReview({
    operationId: 'backup-concurrent-review',
    cardId: card.id,
    noteId: card.noteId,
    mode: 'long-term',
    rating: 'good',
    signal: exactSignal(),
  });
  const database = await openDatabase();
  const original = database.transaction.bind(database);
  let concurrentWrite: Promise<void> | undefined;
  database.transaction = (...args: Parameters<IDBDatabase['transaction']>) => {
    const transaction = original(...args);
    if (args[1] === 'readonly' && transaction.objectStoreNames.contains('notes')) {
      transaction.addEventListener(
        'complete',
        () => {
          const write = original(['reviews', 'learningEvidence', 'skillStates'], 'readwrite');
          write.objectStore('reviews').clear();
          write.objectStore('learningEvidence').clear();
          write.objectStore('skillStates').clear();
          concurrentWrite = new Promise<void>((resolve, reject) => {
            write.addEventListener('complete', () => resolve(), { once: true });
            write.addEventListener('abort', () => reject(write.error), { once: true });
          });
        },
        { once: true },
      );
    }
    return transaction;
  };

  try {
    const backup = parseBackup(await exportBackup());
    await concurrentWrite;
    assert.equal(backup.reviews.length, 1);
    assert.equal(backup.reviews[0].id, result.log.id);
    assert.equal(backup.learningEvidence.length, 1);
    assert.equal((await getAll<ReviewLog>('reviews')).length, 0);
  } finally {
    database.transaction = original;
  }
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

test('grammar completion requires finished questions and commits its path reward only once', async () => {
  const snapshot = await loadSnapshot();
  const now = new Date('2026-08-07T12:00:00.000Z');
  const chapter = coursePathChapterById('chapter-01-school')!;
  const node = chapter.nodes.find((candidate) => candidate.type === 'grammar')!;
  const lesson = grammarLessonById(node.grammarLessonId!)!;
  let progress = snapshot.course;
  for (const preceding of chapter.nodes) {
    if (preceding.id === node.id) break;
    progress = completeCoursePathNode(progress, preceding.id, 3, now).progress;
  }
  await putCourseProgress(progress);

  const input = {
    operationId: 'grammar-run-retry',
    progress: snapshot.course,
    lessonId: lesson.id,
    correctFirstTry: lesson.questions.length,
    total: lesson.questions.length,
    pathNodeId: node.id,
    now,
  };
  await assert.rejects(saveGrammarLessonRun(input), /otázek/u);
  assert.deepEqual(await getOne<CourseProgress>('course', 'course'), progress);

  for (const question of lesson.questions) {
    progress = recordCourseAnswer(progress, {
      lessonId: lesson.id,
      questionId: question.id,
      correct: true,
      responseMs: 1_000,
      now,
    }).progress;
  }
  await putCourseProgress(progress);

  const [first, retried] = await Promise.all([
    saveGrammarLessonRun(input),
    saveGrammarLessonRun(input),
  ]);
  const stored = await getOne<CourseProgress>('course', 'course');
  assert.equal(first.pathCompletion?.firstCompletion, true);
  assert.equal(first.pathCompletion?.xpAwarded, node.xp);
  assert.equal(first.stars, 3);
  assert.equal(stored?.pathNodes[node.id]?.attempts, 1);
  assert.equal(stored?.pathEvents.filter((event) => event.nodeId === node.id).length, 1);
  assert.deepEqual(retried.progress, first.progress);
  assert.deepEqual(stored, first.progress);

  const standalone = await saveGrammarLessonRun({
    ...input,
    operationId: 'grammar-standalone',
    pathNodeId: undefined,
  });
  assert.equal(standalone.pathCompletion, undefined);
  assert.deepEqual(standalone.progress.pathNodes, stored?.pathNodes);
});

test('coach completion enforces the turn target and retries neither evidence nor path rewards', async () => {
  const snapshot = await loadSnapshot();
  const now = new Date('2026-08-07T12:00:00.000Z');
  const chapter = coursePathChapterById('chapter-01-school')!;
  const node = chapter.nodes.find((candidate) => candidate.type === 'coach')!;
  const scenario = coachScenarioById(node.coachScenarioId!)!;
  let progress = snapshot.course;
  for (const preceding of chapter.nodes) {
    if (preceding.id === node.id) break;
    progress = completeCoursePathNode(progress, preceding.id, 3, now).progress;
  }
  await putCourseProgress(progress);

  const input = {
    operationId: 'coach-session-retry',
    progress: snapshot.course,
    scenarioId: scenario.id,
    score: 95,
    turns: scenario.turns,
    pathNodeId: node.id,
    now,
  };
  await assert.rejects(saveCoachSession({ ...input, turns: scenario.turns - 1 }), /replikách/u);
  assert.deepEqual(await getOne<CourseProgress>('course', 'course'), progress);
  assert.deepEqual(await getAll<LearningEvidence>('learningEvidence'), []);

  const [first, retried] = await Promise.all([saveCoachSession(input), saveCoachSession(input)]);
  const stored = await getOne<CourseProgress>('course', 'course');
  assert.equal(first.pathCompletion?.firstCompletion, true);
  assert.equal(first.pathCompletion?.xpAwarded, node.xp);
  assert.equal(stored?.coachEvents.length, 1);
  assert.equal(stored?.pathNodes[node.id]?.attempts, 1);
  assert.equal((await getAll<LearningEvidence>('learningEvidence')).length, 1);
  assert.equal((await getAll<SkillState>('skillStates'))[0]?.attempts, 1);
  assert.deepEqual(retried.progress, first.progress);
  assert.deepEqual(stored, first.progress);

  const standalone = await saveCoachSession({
    ...input,
    operationId: 'coach-standalone',
    pathNodeId: undefined,
  });
  assert.equal(standalone.pathCompletion, undefined);
  assert.equal(standalone.progress.coachEvents.length, 2);
  assert.equal(standalone.xpAwarded, 0);
  assert.deepEqual(standalone.progress.pathNodes, stored?.pathNodes);
});

test('unfinished course drafts survive backup restore, retain completion separately, and never award XP', async () => {
  await ensureSeeded();
  const chapter = coursePathChapterById('chapter-01-school')!;
  let progress = createCourseProgress();
  for (const node of chapter.nodes.filter((candidate) => candidate.order < 5))
    progress = completeCoursePathNode(progress, node.id, 3).progress;
  await putCourseProgress(progress);
  const nodeId = `${chapter.id}:sentence`;
  const draft = await savePathWritingDraft({ progress, nodeId, text: 'Heute lerne' });
  assert.equal(draft.pathNodes[nodeId].writingDraft?.text, 'Heute lerne');
  assert.equal(draft.pathNodes[nodeId].completedAt, undefined);
  assert.equal(draft.pathNodes[nodeId].xpAwarded, 0);
  assert.equal(draft.pathEvents.length, progress.pathEvents.length);
  const backup = parseBackup(await exportBackup());
  await restoreBackup(backup);
  assert.equal((await exportBackup()).course.pathNodes[nodeId].writingDraft?.text, 'Heute lerne');
  const text = 'Heute lerne ich in der Schule Deutsch.';
  const completed = await savePathNodeCompletion({
    progress: draft,
    nodeId,
    writtenResponse: text,
    stars: 2,
  });
  assert.equal(completed.progress.pathNodes[nodeId].writingDraft, undefined);
  const cleared = await savePathWritingDraft({ progress: completed.progress, nodeId, text: '' });
  assert.equal(cleared.pathNodes[nodeId].writtenResponse, text);
  assert.equal(cleared.pathNodes[nodeId].writingDraft?.text, '');
  assert.equal(parseBackup(await exportBackup()).course.pathNodes[nodeId].writingDraft?.text, '');
  await assert.rejects(savePathWritingDraft({ progress: cleared, nodeId, text: 'x'.repeat(5001) }));
  await assert.rejects(
    savePathWritingDraft({ progress: cleared, nodeId: `${chapter.id}:mix`, text: 'x' }),
  );
  const malformed = structuredClone(backup);
  malformed.course.pathNodes[nodeId].writingDraft = {
    text: 'x'.repeat(5001),
    updatedAt: new Date().toISOString(),
  };
  assert.throws(() => parseBackup(malformed), /Rozepsaný text/u);
});

test('course writing survives persistence, replay and backup restore without awarding duplicate XP', async () => {
  await ensureSeeded();
  const chapter = coursePathChapterById('chapter-01-school');
  assert.ok(chapter);
  let progress = createCourseProgress();
  for (const node of chapter.nodes.filter((candidate) => candidate.order < 5)) {
    progress = completeCoursePathNode(progress, node.id, 3).progress;
  }
  await putCourseProgress(progress);
  const nodeId = `${chapter.id}:sentence`;
  const writtenResponse = 'Heute lerne ich in der Schule Deutsch.';
  const first = await savePathNodeCompletion({ progress, nodeId, stars: 2, writtenResponse });
  assert.equal(first.progress.pathNodes[nodeId].writtenResponse, writtenResponse);
  const exported = parseBackup(await exportBackup());
  assert.equal(exported.course.pathNodes[nodeId].writtenResponse, writtenResponse);
  const repeat = await savePathNodeCompletion({ progress: first.progress, nodeId, stars: 2 });
  assert.equal(repeat.xpAwarded, 0);
  assert.equal(repeat.progress.pathNodes[nodeId].writtenResponse, writtenResponse);
  await restoreBackup(exported);
  assert.equal((await exportBackup()).course.pathNodes[nodeId].writtenResponse, writtenResponse);

  const oversized = structuredClone(exported);
  oversized.course.pathNodes[nodeId].writtenResponse = 'a'.repeat(5001);
  assert.throws(() => parseBackup(oversized), /writtenResponse/u);
  const misplaced = structuredClone(exported);
  misplaced.course.pathNodes[`${chapter.id}:mix`].writtenResponse = writtenResponse;
  assert.throws(() => parseBackup(misplaced), /Písemný výstup/u);
  await assert.rejects(
    savePathNodeCompletion({ progress: first.progress, nodeId, writtenResponse: 'Hallo' }),
    /Text nesplňuje/u,
  );
  assert.equal((await exportBackup()).course.pathNodes[nodeId].writtenResponse, writtenResponse);
});
