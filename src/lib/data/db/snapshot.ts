import { COURSE_CONTENT_VERSION } from '../../domain/course/content-version.ts';
import { localizedError } from '../../domain/errors.ts';
import { deriveSkillStates } from '../../domain/learning/skills.ts';
import {
  createReviewStats,
  deriveReviewStats,
  type ReviewStats,
} from '../../domain/stats/review-stats.ts';
import type { StoreName } from './connection.ts';
import {
  abortTransaction,
  openDatabase,
  recentCursorResults,
  requestResult,
  transactionDone,
} from './connection.ts';
import { normalizeDailySessions } from './learning.ts';
import { announceCommit, bumpRevision, publishDatabaseSync } from './sync.ts';

import type {
  DailySessionRecord,
  LearningEvidence,
  SkillState,
} from '../../domain/learning/types.ts';
import type {
  AppBackup,
  AppSettings,
  CourseProgress,
  Deck,
  Note,
  ReviewLog,
  StudyCard,
} from '../../domain/types.ts';

export type LocalAccountBinding = {
  key: 'account';
  accountId: string;
  boundAt: string;
};

export type StoredSnapshot = {
  decks: Deck[];
  notes: Note[];
  cards: StudyCard[];
  recentReviews: ReviewLog[];
  reviewStats: ReviewStats;
  learningEvidence: LearningEvidence[];
  skillStates: SkillState[];
  dailySessions: DailySessionRecord[];
  settings?: AppSettings;
  course?: CourseProgress;
};

export async function readRecentReviewsForNote(noteId: string, limit = 5): Promise<ReviewLog[]> {
  const safeLimit = Number.isNaN(limit) ? 5 : Math.max(1, Math.min(50, Math.trunc(limit)));
  const database = await openDatabase();
  const transaction = database.transaction('reviews', 'readonly');
  const done = transactionDone(transaction);
  const reviews = await recentCursorResults<ReviewLog>(
    transaction
      .objectStore('reviews')
      .index('noteAndReviewedAt')
      .openCursor(IDBKeyRange.bound([noteId, ''], [noteId, '\uffff']), 'prev'),
    safeLimit,
  );
  await done;
  return reviews;
}

export async function readStoredSnapshot(
  options: { fullHistory?: boolean } = {},
): Promise<StoredSnapshot> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [
      'decks',
      'notes',
      'cards',
      'reviews',
      'settings',
      'course',
      'learningEvidence',
      'skillStates',
      'dailySessions',
      'reviewStats',
      'meta',
    ],
    'readonly',
  );
  const done = transactionDone(transaction);
  const [
    decks,
    notes,
    cards,
    recentReviews,
    settings,
    course,
    learningEvidence,
    skillStates,
    dailySessions,
    storedReviewStats,
  ] = await Promise.all([
    requestResult(transaction.objectStore('decks').getAll()),
    requestResult(transaction.objectStore('notes').getAll()),
    requestResult(transaction.objectStore('cards').getAll()),
    options.fullHistory
      ? requestResult(transaction.objectStore('reviews').getAll())
      : recentCursorResults<ReviewLog>(
          transaction.objectStore('reviews').index('reviewedAt').openCursor(null, 'prev'),
          2_000,
        ),
    requestResult(transaction.objectStore('settings').get('app')),
    requestResult(transaction.objectStore('course').get('course')),
    options.fullHistory
      ? requestResult(transaction.objectStore('learningEvidence').getAll())
      : requestResult(
          transaction
            .objectStore('learningEvidence')
            .index('occurredAt')
            .getAll(IDBKeyRange.lowerBound(new Date(Date.now() - 31 * 86_400_000).toISOString())),
        ),
    requestResult(transaction.objectStore('skillStates').getAll()),
    requestResult(transaction.objectStore('dailySessions').getAll()),
    requestResult(transaction.objectStore('reviewStats').get('reviews')),
  ]);
  await done;

  return {
    decks: decks as Deck[],
    notes: notes as Note[],
    cards: cards as StudyCard[],
    recentReviews: recentReviews as ReviewLog[],
    reviewStats: (storedReviewStats as ReviewStats | undefined) ?? createReviewStats(),
    learningEvidence: learningEvidence as LearningEvidence[],
    skillStates: skillStates as SkillState[],
    dailySessions: normalizeDailySessions(dailySessions as unknown[]),
    settings: settings as AppSettings | undefined,
    course: course as CourseProgress | undefined,
  };
}

export async function seedDatabaseIfEmpty(backup: AppBackup): Promise<boolean> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [
      'decks',
      'notes',
      'cards',
      'reviews',
      'settings',
      'course',
      'learningEvidence',
      'skillStates',
      'reviewStats',
      'meta',
    ],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const settingsStore = transaction.objectStore('settings');

  try {
    const existing = await requestResult(settingsStore.get('app'));
    if (existing) {
      await done;
      return false;
    }

    for (const deck of backup.decks) transaction.objectStore('decks').add(deck);
    for (const note of backup.notes) transaction.objectStore('notes').add(note);
    for (const card of backup.cards) transaction.objectStore('cards').add(card);
    for (const review of backup.reviews) transaction.objectStore('reviews').add(review);
    for (const evidence of backup.learningEvidence) {
      transaction.objectStore('learningEvidence').add(evidence);
    }
    for (const state of deriveSkillStates(backup.learningEvidence)) {
      transaction.objectStore('skillStates').add(state);
    }
    settingsStore.add(backup.settings);
    transaction.objectStore('course').add(backup.course);
    transaction.objectStore('reviewStats').put(deriveReviewStats(backup.reviews));
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(revision, [
      'decks',
      'notes',
      'cards',
      'settings',
      'course',
      'learningEvidence',
      'skillStates',
      'reviewStats',
    ]);
    return true;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

const backupStores: StoreName[] = [
  'decks',
  'notes',
  'cards',
  'reviews',
  'settings',
  'course',
  'learningEvidence',
  'skillStates',
  'dailySessions',
  'reviewStats',
];

function replaceBackupRecords(transaction: IDBTransaction, backup: AppBackup): void {
  for (const name of backupStores) transaction.objectStore(name).clear();
  for (const deck of backup.decks) transaction.objectStore('decks').put(deck);
  for (const note of backup.notes) transaction.objectStore('notes').put(note);
  for (const card of backup.cards) transaction.objectStore('cards').put(card);
  for (const review of backup.reviews) transaction.objectStore('reviews').put(review);
  for (const evidence of backup.learningEvidence)
    transaction.objectStore('learningEvidence').put(evidence);
  for (const state of deriveSkillStates(backup.learningEvidence))
    transaction.objectStore('skillStates').put(state);
  transaction.objectStore('settings').put(backup.settings);
  transaction.objectStore('course').put(backup.course);
  transaction.objectStore('reviewStats').put(deriveReviewStats(backup.reviews));
}

export async function bindLocalAccount(
  accountId: string,
  freshBackup: AppBackup,
): Promise<boolean> {
  const database = await openDatabase();
  const transaction = database.transaction([...backupStores, 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  try {
    const meta = transaction.objectStore('meta');
    const binding = (await requestResult(meta.get('account'))) as LocalAccountBinding | undefined;
    if (binding?.accountId === accountId) {
      await done;
      return false;
    }
    const accountChanged = Boolean(binding?.accountId);
    if (accountChanged) {
      publishDatabaseSync({ type: 'reset-started' });
      replaceBackupRecords(transaction, freshBackup);
    }
    meta.put({
      key: 'account',
      accountId,
      boundAt: new Date().toISOString(),
    } satisfies LocalAccountBinding);
    const revision = await bumpRevision(transaction);
    await done;
    if (accountChanged) announceCommit(revision, backupStores);
    return accountChanged;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

export async function replaceWithBackup(backup: AppBackup): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([...backupStores, 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  try {
    replaceBackupRecords(transaction, backup);
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(revision, backupStores);
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

export async function readBackup(): Promise<AppBackup> {
  const snapshot = await readStoredSnapshot({ fullHistory: true });
  if (!snapshot.settings)
    throw localizedError('Nastavení aplikace nebylo nalezeno.', 'App settings were not found.');

  return {
    schemaVersion: 8,
    exportedAt: new Date().toISOString(),
    decks: snapshot.decks,
    notes: snapshot.notes,
    cards: snapshot.cards,
    reviews: snapshot.recentReviews,
    learningEvidence: snapshot.learningEvidence,
    settings: snapshot.settings,
    course: snapshot.course ?? {
      key: 'course',
      schemaVersion: 6,
      contentVersion: COURSE_CONTENT_VERSION,
      grandfatheredChapterIds: [],
      events: [],
      coachEvents: [],
      lessonBestStars: {},
      claimedRewards: [],
      storyBooks: {},
      pathNodes: {},
      pathEvents: [],
      vocabularyEvents: [],
      unlockedStoryBooks: [],
      wallet: { purchases: [], boosts: [] },
      appliedOperations: [],
      createdAt: snapshot.settings.createdAt,
      updatedAt: snapshot.settings.updatedAt,
    },
  };
}
