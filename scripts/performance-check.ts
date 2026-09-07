// oxlint-disable-next-line import/no-unassigned-import -- installs IndexedDB globals for Node.
import 'fake-indexeddb/auto';

import { performance } from 'node:perf_hooks';

import { closeDatabaseConnection, openDatabase } from '../src/lib/data/db.ts';
import { loadSnapshot, recordReview, saveDoubleXpPurchase } from '../src/lib/data/repository.ts';
import { learningEvidenceFromReview } from '../src/lib/domain/learning/evidence.ts';
import { createReviewStats } from '../src/lib/domain/stats/review-stats.ts';

import type { AnswerSignal, ReviewLog } from '../src/lib/domain/types.ts';

const NOTE_COUNT = 10_000;
const REVIEW_COUNT = 100_000;

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error), { once: true });
  });
}

function exactSignal(): AnswerSignal {
  return {
    exercise: 'typing',
    submittedText: 'synthetisch',
    normalizedText: 'synthetisch',
    expectedText: 'synthetisch',
    wordCorrect: true,
    articleCorrect: true,
    exact: true,
    keyboardEquivalent: false,
    editDistance: 0,
    responseMs: 800,
    hintsUsed: 0,
    attempt: 1,
  };
}

const snapshot = await loadSnapshot();
const sourceNote = snapshot.notes[0];
const sourceCard =
  snapshot.cards.find((card) => card.noteId === sourceNote.id) ?? snapshot.cards[0];
const seedReview = await recordReview({
  operationId: 'performance-seed-review',
  cardId: sourceCard.id,
  noteId: sourceNote.id,
  mode: 'long-term',
  rating: 'good',
  signal: exactSignal(),
  now: new Date('2026-08-07T10:00:00.000Z'),
});

const database = await openDatabase();
const fixtureStart = performance.now();
const fixtureTransaction = database.transaction(
  ['notes', 'cards', 'reviews', 'learningEvidence', 'reviewStats'],
  'readwrite',
);
const notes = fixtureTransaction.objectStore('notes');
const cards = fixtureTransaction.objectStore('cards');
const reviews = fixtureTransaction.objectStore('reviews');
const reviewStats = fixtureTransaction.objectStore('reviewStats');
const evidenceStore = fixtureTransaction.objectStore('learningEvidence');

for (let index = 0; index < NOTE_COUNT; index += 1) {
  const noteId = `performance-note-${index}`;
  notes.put({
    ...sourceNote,
    id: noteId,
    german: `Synthetic ${index}`,
    normalizedGerman: `synthetic-${index}`,
  });
  cards.put({
    ...sourceCard,
    id: `performance-card-${index}`,
    noteId,
  });
}

for (let index = 0; index < REVIEW_COUNT; index += 1) {
  const noteIndex = index % NOTE_COUNT;
  const review: ReviewLog = {
    ...seedReview.log,
    id: `performance-review-${index}`,
    operationId: `performance-operation-${index}`,
    noteId: `performance-note-${noteIndex}`,
    cardId: `performance-card-${noteIndex}`,
    reviewedAt: '2025-01-01T12:00:00.000Z',
    localDay: '2025-01-01',
  };
  reviews.put(review);
  evidenceStore.put(learningEvidenceFromReview(review, sourceCard.direction));
}
const seedXp = seedReview.log.xpAwarded ?? 0;
reviewStats.put({
  ...createReviewStats(new Date('2026-08-07T10:00:00.000Z')),
  totalReviews: REVIEW_COUNT + 1,
  countedReviews: REVIEW_COUNT + 1,
  reviewXp: seedXp * (REVIEW_COUNT + 1),
  typingAnswers: REVIEW_COUNT + 1,
  unassistedAnswers: REVIEW_COUNT + 1,
  longestCleanRun: REVIEW_COUNT,
  currentCleanRun: 1,
  currentCleanRunDay: '2026-08-07',
  activityDays: ['2025-01-01', '2026-08-07'],
  byDay: {
    '2025-01-01': { count: REVIEW_COUNT, xp: seedXp * REVIEW_COUNT },
    '2026-08-07': { count: 1, xp: seedXp },
  },
});
await transactionDone(fixtureTransaction);
const fixtureMs = performance.now() - fixtureStart;

const sampleStore = database.transaction('reviews', 'readonly').objectStore('reviews');
const prototype = Object.getPrototypeOf(sampleStore) as IDBObjectStore;
const originalGetAll = prototype.getAll;
let fullHistoryReads = 0;
let fullEvidenceReads = 0;
let purchaseFullHistoryReads = 0;
let measuringPurchase = false;
prototype.getAll = function getAll(...args: Parameters<IDBObjectStore['getAll']>) {
  if (this.name === 'reviews') fullHistoryReads += 1;
  if (this.name === 'learningEvidence') fullEvidenceReads += 1;
  if (measuringPurchase && (this.name === 'reviews' || this.name === 'cards')) {
    purchaseFullHistoryReads += 1;
  }
  return originalGetAll.apply(this, args);
};

const startupStart = performance.now();
let loaded: Awaited<ReturnType<typeof loadSnapshot>> | undefined;
let commitMs = 0;
let purchaseMs = 0;
try {
  loaded = await loadSnapshot();
  const commitStart = performance.now();
  await recordReview({
    operationId: 'performance-indexed-review',
    cardId: sourceCard.id,
    noteId: sourceNote.id,
    mode: 'long-term',
    rating: 'good',
    signal: exactSignal(),
    now: new Date('2026-08-07T10:01:00.000Z'),
  });
  commitMs = performance.now() - commitStart;
  const purchaseStart = performance.now();
  measuringPurchase = true;
  await saveDoubleXpPurchase({
    progress: loaded.course,
    now: new Date('2026-08-07T10:02:00.000Z'),
  });
  purchaseMs = performance.now() - purchaseStart;
} finally {
  measuringPurchase = false;
  prototype.getAll = originalGetAll;
}
const startupMs = performance.now() - startupStart - commitMs - purchaseMs;

console.log(
  JSON.stringify(
    {
      fixture: {
        notes: NOTE_COUNT,
        cards: NOTE_COUNT,
        reviews: REVIEW_COUNT,
        learningEvidence: REVIEW_COUNT,
      },
      fixtureBuildMs: Math.round(fixtureMs),
      boundedStartupMs: Number(startupMs.toFixed(2)),
      indexedReviewCommitMs: Number(commitMs.toFixed(2)),
      indexedRewardPurchaseMs: Number(purchaseMs.toFixed(2)),
      fullHistoryReads,
      fullEvidenceReads,
      purchaseFullHistoryReads,
      startupReviewRows: loaded?.recentReviews.length ?? 0,
      startupEvidenceRows: loaded?.learningEvidence.length ?? 0,
      projectedReviewCount: loaded?.reviewStats.countedReviews ?? 0,
      heapUsedMiB: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)),
    },
    null,
    2,
  ),
);

await closeDatabaseConnection();
if (
  fullHistoryReads !== 0 ||
  fullEvidenceReads !== 0 ||
  (loaded?.learningEvidence.length ?? Number.POSITIVE_INFINITY) > 1 ||
  purchaseFullHistoryReads !== 0 ||
  (loaded?.recentReviews.length ?? Number.POSITIVE_INFINITY) > 2_000 ||
  loaded?.reviewStats.countedReviews !== REVIEW_COUNT + 1
) {
  process.exitCode = 1;
}
