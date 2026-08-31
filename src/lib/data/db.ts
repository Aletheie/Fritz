import { COURSE_CONTENT_VERSION } from '../domain/course/content-version.ts';
import {
  deriveLegacyLearningEvidence,
  learningEvidenceFromReview,
} from '../domain/learning/evidence.ts';
import { normalizeDailySessionRecord } from '../domain/learning/planner.ts';
import {
  applyEvidenceToSkillState,
  deriveSkillState,
  deriveSkillStates,
} from '../domain/learning/skills.ts';
import type { DailySessionRecord, LearningEvidence, SkillState } from '../domain/learning/types.ts';
import {
  appendReviewStats,
  createReviewStats,
  deriveReviewStats,
  type ReviewStats,
} from '../domain/stats/review-stats.ts';
import type {
  AppBackup,
  AppSettings,
  CourseProgress,
  Deck,
  Note,
  ReviewLog,
  StudyCard,
} from '../domain/types.ts';

const DB_NAME = 'fritz';
const LEGACY_DB_NAME = 'wortly';
export const DB_VERSION = 8;

export type StoreName =
  | 'decks'
  | 'notes'
  | 'cards'
  | 'reviews'
  | 'settings'
  | 'course'
  | 'learningEvidence'
  | 'skillStates'
  | 'dailySessions'
  | 'reviewStats'
  | 'meta';

export type DatabaseSyncEvent = {
  type: 'mutation-committed' | 'db-versionchange' | 'restore-started' | 'reset-started';
  revision?: number;
  stores?: StoreName[];
};

export type ReviewCommandSnapshot = {
  card: StudyCard;
  note: Note;
  settings: AppSettings;
  reviews: ReviewLog[];
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

type LegacyIndexSnapshot = {
  name: string;
  keyPath: string | string[];
  multiEntry: boolean;
  unique: boolean;
};

type LegacyStoreSnapshot = {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: LegacyIndexSnapshot[];
  records: Array<{ key: IDBValidKey; value: unknown }>;
};

type LegacyDatabaseSnapshot = {
  version: number;
  stores: LegacyStoreSnapshot[];
};

let databasePromise: Promise<IDBDatabase> | undefined;
let syncChannel: BroadcastChannel | undefined;
const syncListeners = new Set<(event: DatabaseSyncEvent) => void>();

function getSyncChannel(): BroadcastChannel | undefined {
  if (typeof window === 'undefined' || !('BroadcastChannel' in globalThis)) return undefined;
  if (!syncChannel) {
    syncChannel = new BroadcastChannel('fritz-sync-v1');
    syncChannel.addEventListener('message', (event: MessageEvent<DatabaseSyncEvent>) => {
      if (!event.data || typeof event.data.type !== 'string') return;
      for (const listener of syncListeners) listener(event.data);
    });
  }
  return syncChannel;
}

export function subscribeDatabaseSync(listener: (event: DatabaseSyncEvent) => void): () => void {
  syncListeners.add(listener);
  getSyncChannel();
  return () => syncListeners.delete(listener);
}

export function publishDatabaseSync(event: DatabaseSyncEvent): void {
  getSyncChannel()?.postMessage(event);
}

async function bumpRevision(transaction: IDBTransaction): Promise<number> {
  const store = transaction.objectStore('meta');
  const current = (await requestResult(store.get('state'))) as
    | { key: 'state'; revision: number }
    | undefined;
  const revision = Math.max(0, current?.revision ?? 0) + 1;
  store.put({ key: 'state', revision, updatedAt: new Date().toISOString() });
  return revision;
}

function announceCommit(revision: number, stores: StoreName[]): void {
  publishDatabaseSync({ type: 'mutation-committed', revision, stores });
}

async function addEvidenceAndAdvanceSkills(
  transaction: IDBTransaction,
  evidence: LearningEvidence,
): Promise<boolean> {
  const evidenceStore = transaction.objectStore('learningEvidence');
  const existing = (await requestResult(evidenceStore.get(evidence.id))) as
    | LearningEvidence
    | undefined;
  if (existing) return false;
  evidenceStore.add(evidence);
  if (evidence.excludedFromLearning || evidence.mode === 'cram' || evidence.outcome === 'skipped') {
    return true;
  }
  const stateStore = transaction.objectStore('skillStates');
  const skillIds = [...new Set(evidence.skillIds)];
  const currentStates = await Promise.all(
    skillIds.map(
      async (skillId) => requestResult(stateStore.get(skillId)) as Promise<SkillState | undefined>,
    ),
  );
  for (const [index, skillId] of skillIds.entries()) {
    stateStore.put(applyEvidenceToSkillState(currentStates[index], evidence, skillId));
  }
  return true;
}

async function replaceEvidenceAndRebuildSkills(
  transaction: IDBTransaction,
  evidence: LearningEvidence,
): Promise<void> {
  const evidenceStore = transaction.objectStore('learningEvidence');
  evidenceStore.put(evidence);
  const stateStore = transaction.objectStore('skillStates');
  const skillIds = [...new Set(evidence.skillIds)];
  const histories = await Promise.all(
    skillIds.map(
      async (skillId) =>
        requestResult(evidenceStore.index('skillIds').getAll(IDBKeyRange.only(skillId))) as Promise<
          LearningEvidence[]
        >,
    ),
  );
  for (const [index, skillId] of skillIds.entries()) {
    const state = deriveSkillState(histories[index], skillId);
    if (state) stateStore.put(state);
    else stateStore.delete(skillId);
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  const pending = databasePromise;
  databasePromise = undefined;
  if (!pending) return;
  try {
    const database = await pending;
    database.close();
  } catch {
    // A failed open has no live connection to close.
  }
}

function ensureIndexedDb(): IDBFactory {
  if (!globalThis.indexedDB) {
    throw new Error('IndexedDB není v tomto prostředí dostupná.');
  }
  return globalThis.indexedDB;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
}

function recentCursorResults<T>(
  request: IDBRequest<IDBCursorWithValue | null>,
  limit: number,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const values: T[] = [];
    request.addEventListener('success', () => {
      const cursor = request.result;
      if (!cursor || values.length >= limit) {
        resolve(values);
        return;
      }
      values.push(cursor.value as T);
      cursor.continue();
    });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
}

function recentReviewCursorResults(
  request: IDBRequest<IDBCursorWithValue | null>,
  limit: number,
): Promise<ReviewLog[]> {
  return new Promise((resolve, reject) => {
    const results: ReviewLog[] = [];
    request.addEventListener('error', () => reject(request.error), { once: true });
    request.addEventListener('success', () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(results);
        return;
      }
      const review = cursor.value as ReviewLog;
      const insertionIndex = results.findIndex(
        (candidate) => candidate.reviewedAt.localeCompare(review.reviewedAt) < 0,
      );
      if (insertionIndex < 0) results.push(review);
      else results.splice(insertionIndex, 0, review);
      if (results.length > limit) results.pop();
      cursor.continue();
    });
  });
}

function normalizeDailySessions(values: unknown[]): DailySessionRecord[] {
  const sessions: DailySessionRecord[] = [];
  for (const value of values) {
    const session = normalizeDailySessionRecord(value);
    if (session) sessions.push(session);
  }
  return sessions;
}

function latestDailySession(values: unknown[]): DailySessionRecord | undefined {
  let latest: DailySessionRecord | undefined;
  for (const value of values) {
    const session = normalizeDailySessionRecord(value);
    if (!session) continue;
    if (!latest || session.updatedAt.localeCompare(latest.updatedAt) > 0) latest = session;
  }
  return latest;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error), { once: true });
  });
}

async function readLegacyDatabase(): Promise<LegacyDatabaseSnapshot> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = ensureIndexedDb().open(LEGACY_DB_NAME);
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener(
      'error',
      () => reject(request.error ?? new Error('Původní lokální databázi se nepodařilo otevřít.')),
      { once: true },
    );
  });

  try {
    const storeNames = [...database.objectStoreNames];
    if (storeNames.length === 0) return { version: database.version, stores: [] };
    const transaction = database.transaction(storeNames, 'readonly');
    const done = transactionDone(transaction);
    const stores = await Promise.all(
      storeNames.map(async (name): Promise<LegacyStoreSnapshot> => {
        const store = transaction.objectStore(name);
        const indexes = [...store.indexNames].map((indexName): LegacyIndexSnapshot => {
          const index = store.index(indexName);
          return {
            name: index.name,
            keyPath: index.keyPath,
            multiEntry: index.multiEntry,
            unique: index.unique,
          };
        });
        const [values, keys] = await Promise.all([
          requestResult(store.getAll()),
          requestResult(store.getAllKeys()),
        ]);
        return {
          name,
          keyPath: store.keyPath,
          autoIncrement: store.autoIncrement,
          indexes,
          records: values.map((value, index) => ({ key: keys[index] as IDBValidKey, value })),
        };
      }),
    );
    await done;
    return { version: database.version, stores };
  } finally {
    database.close();
  }
}

function cloneLegacyDatabase(snapshot: LegacyDatabaseSnapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = ensureIndexedDb().open(DB_NAME, snapshot.version);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      for (const source of snapshot.stores) {
        const store = database.createObjectStore(source.name, {
          keyPath: source.keyPath,
          autoIncrement: source.autoIncrement,
        });
        for (const index of source.indexes) {
          store.createIndex(index.name, index.keyPath, {
            multiEntry: index.multiEntry,
            unique: index.unique,
          });
        }
        for (const record of source.records) {
          if (source.keyPath === null) store.put(record.value, record.key);
          else store.put(record.value);
        }
      }
    });
    request.addEventListener(
      'success',
      () => {
        request.result.close();
        resolve();
      },
      { once: true },
    );
    request.addEventListener(
      'error',
      () =>
        reject(request.error ?? new Error('Původní data se nepodařilo převést do aplikace Fritz.')),
      { once: true },
    );
    request.addEventListener(
      'blocked',
      () => reject(new Error('Převod dat blokuje jiná otevřená karta aplikace.')),
      { once: true },
    );
  });
}

async function migrateLegacyDatabaseIfNeeded(): Promise<void> {
  const factory = ensureIndexedDb();
  if (typeof factory.databases !== 'function') return;
  const databaseNames = new Set(
    (await factory.databases())
      .map((database) => database.name)
      .filter((name): name is string => typeof name === 'string'),
  );
  if (databaseNames.has(DB_NAME) || !databaseNames.has(LEGACY_DB_NAME)) return;
  await cloneLegacyDatabase(await readLegacyDatabase());
}

async function abortTransaction(transaction: IDBTransaction, done: Promise<void>): Promise<void> {
  try {
    transaction.abort();
  } catch {}
  try {
    await done;
  } catch {}
}

function ensureIndex(
  store: IDBObjectStore,
  name: string,
  keyPath: string | string[],
  options: IDBIndexParameters = { unique: false },
): void {
  if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, options);
}

function ensureUniqueIndexPreservingConflicts(
  store: IDBObjectStore,
  meta: IDBObjectStore,
  name: string,
  keyPath: string[],
  conflictKey: string,
): void {
  if (store.indexNames.contains(name)) return;
  const request = store.getAll();
  request.addEventListener('success', () => {
    const groups = new Map<string, string[]>();
    for (const raw of request.result as Array<Record<string, unknown>>) {
      const identity = keyPath.map((field) => JSON.stringify(raw[field] ?? null)).join('\u0000');
      const ids = groups.get(identity) ?? [];
      if (typeof raw.id === 'string') ids.push(raw.id);
      groups.set(identity, ids);
    }
    const conflicts = [...groups.values()].filter((ids) => ids.length > 1);
    store.createIndex(name, keyPath, { unique: conflicts.length === 0 });
    if (conflicts.length === 0) {
      meta.delete(conflictKey);
      return;
    }
    const conflictingRecordIds = conflicts.flat();
    meta.put({
      key: conflictKey,
      indexName: name,
      conflictGroups: conflicts.length,
      recordIds: conflictingRecordIds.slice(0, 500),
      truncated: conflictingRecordIds.length > 500,
      detectedAt: new Date().toISOString(),
    });
  });
}

function openCurrentDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const request = ensureIndexedDb().open(DB_NAME, DB_VERSION);

    request.addEventListener('upgradeneeded', (event) => {
      const database = request.result;
      const transaction = request.transaction;
      if (!transaction) throw new Error('Migraci databáze se nepodařilo zahájit.');

      const metaExisted = database.objectStoreNames.contains('meta');
      const meta = metaExisted
        ? transaction.objectStore('meta')
        : database.createObjectStore('meta', { keyPath: 'key' });
      if (!metaExisted) {
        meta.add({ key: 'state', revision: 0, updatedAt: new Date().toISOString() });
      }

      if (!database.objectStoreNames.contains('decks')) {
        database.createObjectStore('decks', { keyPath: 'id' });
      }

      const notesExisted = database.objectStoreNames.contains('notes');
      const notes = notesExisted
        ? transaction.objectStore('notes')
        : database.createObjectStore('notes', { keyPath: 'id' });
      ensureIndex(notes, 'deckId', 'deckId');
      ensureIndex(notes, 'normalizedGerman', 'normalizedGerman');
      if (notesExisted) {
        ensureUniqueIndexPreservingConflicts(
          notes,
          meta,
          'deckAndNormalizedGerman',
          ['deckId', 'normalizedGerman'],
          'migration-conflicts:notes',
        );
      } else {
        ensureIndex(notes, 'deckAndNormalizedGerman', ['deckId', 'normalizedGerman'], {
          unique: true,
        });
      }
      ensureIndex(notes, 'source', 'source');

      const cardsExisted = database.objectStoreNames.contains('cards');
      const cards = cardsExisted
        ? transaction.objectStore('cards')
        : database.createObjectStore('cards', { keyPath: 'id' });
      ensureIndex(cards, 'deckId', 'deckId');
      ensureIndex(cards, 'noteId', 'noteId');
      if (cardsExisted) {
        ensureUniqueIndexPreservingConflicts(
          cards,
          meta,
          'noteAndDirection',
          ['noteId', 'direction'],
          'migration-conflicts:cards',
        );
      } else {
        ensureIndex(cards, 'noteAndDirection', ['noteId', 'direction'], { unique: true });
      }
      ensureIndex(cards, 'dueAt', 'dueAt');

      const reviews = database.objectStoreNames.contains('reviews')
        ? transaction.objectStore('reviews')
        : database.createObjectStore('reviews', { keyPath: 'id' });
      ensureIndex(reviews, 'cardId', 'cardId');
      ensureIndex(reviews, 'noteId', 'noteId');
      ensureIndex(reviews, 'deckId', 'deckId');
      ensureIndex(reviews, 'reviewedAt', 'reviewedAt');
      ensureIndex(reviews, 'localDay', 'localDay');
      ensureIndex(reviews, 'cardAndLocalDay', ['cardId', 'localDay']);
      ensureIndex(reviews, 'operationId', 'operationId', { unique: true });

      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }

      if (!database.objectStoreNames.contains('course')) {
        database.createObjectStore('course', { keyPath: 'key' });
      }

      const learningEvidence = database.objectStoreNames.contains('learningEvidence')
        ? transaction.objectStore('learningEvidence')
        : database.createObjectStore('learningEvidence', { keyPath: 'id' });
      ensureIndex(learningEvidence, 'occurredAt', 'occurredAt');
      ensureIndex(learningEvidence, 'localDay', 'localDay');
      ensureIndex(learningEvidence, 'sourceId', 'sourceId');
      ensureIndex(learningEvidence, 'operationId', 'operationId');
      ensureIndex(learningEvidence, 'skillIds', 'skillIds', { unique: false, multiEntry: true });

      const skillStates = database.objectStoreNames.contains('skillStates')
        ? transaction.objectStore('skillStates')
        : database.createObjectStore('skillStates', { keyPath: 'skillId' });
      ensureIndex(skillStates, 'nextReviewAt', 'nextReviewAt');

      const dailySessions = database.objectStoreNames.contains('dailySessions')
        ? transaction.objectStore('dailySessions')
        : database.createObjectStore('dailySessions', { keyPath: 'key' });
      ensureIndex(dailySessions, 'localDay', 'plan.localDay');
      ensureIndex(dailySessions, 'completedAt', 'completedAt');

      const reviewStats = database.objectStoreNames.contains('reviewStats')
        ? transaction.objectStore('reviewStats')
        : database.createObjectStore('reviewStats', { keyPath: 'key' });

      if ((event as IDBVersionChangeEvent).oldVersion < 8) {
        const reviewsRequest = transaction.objectStore('reviews').getAll();
        reviewsRequest.addEventListener('success', () => {
          reviewStats.put(deriveReviewStats(reviewsRequest.result as ReviewLog[]));
        });
      }

      if ((event as IDBVersionChangeEvent).oldVersion < 7) {
        let legacyCards: StudyCard[] | undefined;
        let legacyReviews: ReviewLog[] | undefined;
        let legacyCourse: CourseProgress | undefined;
        let courseRead = false;
        const migrateLegacyEvidence = () => {
          if (!legacyCards || !legacyReviews || !courseRead) return;
          let migrated: LearningEvidence[];
          if (legacyCourse) {
            migrated = deriveLegacyLearningEvidence({
              cards: legacyCards,
              reviews: legacyReviews,
              course: legacyCourse,
            });
          } else {
            const cardDirections = new Map<string, StudyCard['direction']>();
            for (const card of legacyCards) cardDirections.set(card.id, card.direction);
            migrated = legacyReviews.map((review) =>
              learningEvidenceFromReview(review, cardDirections.get(review.cardId)),
            );
          }
          for (const evidence of migrated) learningEvidence.put(evidence);
          for (const state of deriveSkillStates(migrated)) skillStates.put(state);
        };
        const cardsRequest = transaction.objectStore('cards').getAll();
        const reviewsRequest = transaction.objectStore('reviews').getAll();
        const courseRequest = transaction.objectStore('course').get('course');
        cardsRequest.addEventListener('success', () => {
          legacyCards = cardsRequest.result as StudyCard[];
          migrateLegacyEvidence();
        });
        reviewsRequest.addEventListener('success', () => {
          legacyReviews = reviewsRequest.result as ReviewLog[];
          migrateLegacyEvidence();
        });
        courseRequest.addEventListener('success', () => {
          legacyCourse = courseRequest.result as CourseProgress | undefined;
          courseRead = true;
          migrateLegacyEvidence();
        });
      }
    });

    request.addEventListener('success', () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      database.addEventListener('versionchange', () => {
        publishDatabaseSync({ type: 'db-versionchange' });
        for (const listener of syncListeners) listener({ type: 'db-versionchange' });
        database.close();
        databasePromise = undefined;
      });
      resolve(database);
    });
    request.addEventListener('error', () => {
      if (settled) return;
      settled = true;
      databasePromise = undefined;
      reject(request.error ?? new Error('Lokální databázi se nepodařilo otevřít.'));
    });
    request.addEventListener('blocked', () => {
      if (settled) return;
      settled = true;
      databasePromise = undefined;
      reject(
        new Error(
          'Databázi blokuje jiná otevřená verze aplikace. Zavři ostatní karty Fritz a načti stránku znovu.',
        ),
      );
    });
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = migrateLegacyDatabaseIfNeeded()
    .then(openCurrentDatabase)
    .catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });

  return databasePromise;
}

export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const done = transactionDone(transaction);
  const result = await requestResult(transaction.objectStore(storeName).getAll());
  await done;
  return result as T[];
}

export async function getOne<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const done = transactionDone(transaction);
  const result = await requestResult(transaction.objectStore(storeName).get(key));
  await done;
  return result as T | undefined;
}

export async function getAllByIndex<T>(
  storeName: StoreName,
  indexName: string,
  key: IDBValidKey | IDBKeyRange,
): Promise<T[]> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const done = transactionDone(transaction);
  const result = await requestResult(
    transaction.objectStore(storeName).index(indexName).getAll(key),
  );
  await done;
  return result as T[];
}

export async function readRecentReviewsForNote(noteId: string, limit = 5): Promise<ReviewLog[]> {
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
  const database = await openDatabase();
  const transaction = database.transaction('reviews', 'readonly');
  const done = transactionDone(transaction);
  const reviews = await recentReviewCursorResults(
    transaction.objectStore('reviews').index('noteId').openCursor(IDBKeyRange.only(noteId)),
    safeLimit,
  );
  await done;
  return reviews;
}

export async function readStoredSnapshot(): Promise<StoredSnapshot> {
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
    recentCursorResults<ReviewLog>(
      transaction.objectStore('reviews').index('reviewedAt').openCursor(null, 'prev'),
      2_000,
    ),
    requestResult(transaction.objectStore('settings').get('app')),
    requestResult(transaction.objectStore('course').get('course')),
    requestResult(transaction.objectStore('learningEvidence').getAll()),
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

export async function putSettingsAndDeck(settings: AppSettings, deck?: Deck): Promise<void> {
  const database = await openDatabase();
  const stores: StoreName[] = deck ? ['settings', 'decks', 'meta'] : ['settings', 'meta'];
  const transaction = database.transaction(stores, 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore('settings').put(settings);
  if (deck) transaction.objectStore('decks').put(deck);
  const revision = await bumpRevision(transaction);
  await done;
  announceCommit(revision, deck ? ['settings', 'decks'] : ['settings']);
}

export async function mutateSettingsAndDeck<T>(
  deckId: string | undefined,
  mutate: (snapshot: { settings?: AppSettings; deck?: Deck }) => {
    settings: AppSettings;
    deck?: Deck;
    result: T;
  },
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(['settings', 'decks', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  const settingsStore = transaction.objectStore('settings');
  const deckStore = transaction.objectStore('decks');
  try {
    const [settings, deck] = await Promise.all([
      requestResult(settingsStore.get('app')),
      deckId ? requestResult(deckStore.get(deckId)) : Promise.resolve(undefined),
    ]);
    const mutation = mutate({
      settings: settings as AppSettings | undefined,
      deck: deck as Deck | undefined,
    });
    settingsStore.put(mutation.settings);
    if (mutation.deck) deckStore.put(mutation.deck);
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(revision, mutation.deck ? ['settings', 'decks'] : ['settings']);
    return mutation.result;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

export async function putCourseProgress(course: CourseProgress): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(['course', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore('course').put(course);
  const revision = await bumpRevision(transaction);
  await done;
  announceCommit(revision, ['course']);
}

export async function mutateCourseProgress<T>(
  mutate: (course: CourseProgress | undefined) => {
    course: CourseProgress;
    evidence?: LearningEvidence | LearningEvidence[];
    result: T;
  },
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(
    ['course', 'learningEvidence', 'skillStates', 'meta'],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const store = transaction.objectStore('course');

  try {
    const current = (await requestResult(store.get('course'))) as CourseProgress | undefined;
    const mutation = mutate(current);
    store.put(mutation.course);
    const evidence = Array.isArray(mutation.evidence)
      ? mutation.evidence
      : mutation.evidence
        ? [mutation.evidence]
        : [];
    for (const event of evidence) {
      // Evidence can share skills, so later events must see earlier updates.
      // oxlint-disable-next-line no-await-in-loop
      await addEvidenceAndAdvanceSkills(transaction, event);
    }
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(
      revision,
      evidence.length ? ['course', 'learningEvidence', 'skillStates'] : ['course'],
    );
    return mutation.result;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

export async function mutateCourseAndVocabulary<T>(
  mutate: (snapshot: { course?: CourseProgress; notes: Note[] }) => {
    course: CourseProgress;
    notesToPut?: Note[];
    cardsToPut?: StudyCard[];
    result: T;
  },
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(['course', 'notes', 'cards', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  const courseStore = transaction.objectStore('course');
  const noteStore = transaction.objectStore('notes');
  const cardStore = transaction.objectStore('cards');

  try {
    const [course, notes] = await Promise.all([
      requestResult(courseStore.get('course')),
      requestResult(noteStore.getAll()),
    ]);
    const mutation = mutate({
      course: course as CourseProgress | undefined,
      notes: notes as Note[],
    });
    for (const note of mutation.notesToPut ?? []) noteStore.put(note);
    for (const card of mutation.cardsToPut ?? []) cardStore.put(card);
    courseStore.put(mutation.course);
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(revision, ['course', 'notes', 'cards']);
    return mutation.result;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

export async function mutateCourseWithReviewStats<T>(
  mutate: (snapshot: { course?: CourseProgress; reviewStats: ReviewStats }) => {
    course: CourseProgress;
    result: T;
  },
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(['course', 'reviewStats', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  const courseStore = transaction.objectStore('course');

  try {
    const [course, reviewStats] = await Promise.all([
      requestResult(courseStore.get('course')),
      requestResult(transaction.objectStore('reviewStats').get('reviews')),
    ]);
    const mutation = mutate({
      course: course as CourseProgress | undefined,
      reviewStats: (reviewStats as ReviewStats | undefined) ?? createReviewStats(),
    });
    courseStore.put(mutation.course);
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(revision, ['course']);
    return mutation.result;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

export async function putNote(note: Note): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(['notes', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore('notes').put(note);
  const revision = await bumpRevision(transaction);
  await done;
  announceCommit(revision, ['notes']);
}

export async function putNotesAndCards(notes: Note[], cards: StudyCard[]): Promise<void> {
  if (notes.length === 0 && cards.length === 0) return;
  const database = await openDatabase();
  const transaction = database.transaction(['notes', 'cards', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  const noteStore = transaction.objectStore('notes');
  const cardStore = transaction.objectStore('cards');
  for (const note of notes) noteStore.put(note);
  for (const card of cards) cardStore.put(card);
  const revision = await bumpRevision(transaction);
  await done;
  announceCommit(revision, ['notes', 'cards']);
}

export async function mutateVocabularyRecords<T>(
  mutate: (snapshot: { notes: Note[]; cards: StudyCard[] }) => {
    notesToPut?: Note[];
    cardsToPut?: StudyCard[];
    result: T;
  },
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(['notes', 'cards', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  const noteStore = transaction.objectStore('notes');
  const cardStore = transaction.objectStore('cards');

  try {
    const [notes, cards] = await Promise.all([
      requestResult(noteStore.getAll()),
      requestResult(cardStore.getAll()),
    ]);
    const mutation = mutate({ notes: notes as Note[], cards: cards as StudyCard[] });
    for (const note of mutation.notesToPut ?? []) noteStore.put(note);
    for (const card of mutation.cardsToPut ?? []) cardStore.put(card);
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(revision, ['notes', 'cards']);
    return mutation.result;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

export async function commitReviewCommand(
  input: { operationId: string; cardId: string; noteId: string; localDay: string },
  mutate: (snapshot: ReviewCommandSnapshot) => {
    card: StudyCard;
    log: ReviewLog;
    evidence: LearningEvidence;
  },
): Promise<{ card: StudyCard; log: ReviewLog; replayed: boolean }> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [
      'cards',
      'notes',
      'reviews',
      'settings',
      'learningEvidence',
      'skillStates',
      'reviewStats',
      'meta',
    ],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const cardStore = transaction.objectStore('cards');
  const noteStore = transaction.objectStore('notes');
  const reviewStore = transaction.objectStore('reviews');
  const reviewStatsStore = transaction.objectStore('reviewStats');
  const settingsStore = transaction.objectStore('settings');

  try {
    const [existing, card, note, settings, reviews, reviewStats] = await Promise.all([
      requestResult(reviewStore.index('operationId').get(input.operationId)),
      requestResult(cardStore.get(input.cardId)),
      requestResult(noteStore.get(input.noteId)),
      requestResult(settingsStore.get('app')),
      // XP repeat protection and missions only need a transactionally consistent local day.
      // The localDay index keeps a review write O(today) instead of O(all history).
      requestResult(reviewStore.index('localDay').getAll(input.localDay)),
      requestResult(reviewStatsStore.get('reviews')),
    ]);
    if (!card || !note || !settings) {
      throw new Error('Karta, slovíčko nebo nastavení už nejsou dostupné. Načti relaci znovu.');
    }
    if ((card as StudyCard).noteId !== input.noteId || (note as Note).id !== input.noteId) {
      throw new Error('Studijní karta neodpovídá zvolenému slovíčku.');
    }

    if (existing) {
      const log = existing as ReviewLog;
      if (log.cardId !== input.cardId || log.noteId !== input.noteId) {
        throw new Error('ID opakované operace bylo použito pro jinou kartu.');
      }
      await done;
      return { card: card as StudyCard, log, replayed: true };
    }

    const mutation = mutate({
      card: card as StudyCard,
      note: note as Note,
      settings: settings as AppSettings,
      reviews: reviews as ReviewLog[],
    });
    if (
      mutation.log.operationId !== input.operationId ||
      mutation.log.cardId !== input.cardId ||
      mutation.log.noteId !== input.noteId ||
      mutation.log.localDay !== input.localDay
    ) {
      throw new Error('Review mutace vrátila nekonzistentní identitu.');
    }
    if (mutation.log.mode === 'long-term') cardStore.put(mutation.card);
    reviewStore.add(mutation.log);
    reviewStatsStore.put(appendReviewStats(reviewStats as ReviewStats | undefined, mutation.log));
    await addEvidenceAndAdvanceSkills(transaction, mutation.evidence);
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(revision, [
      'cards',
      'reviews',
      'reviewStats',
      'learningEvidence',
      'skillStates',
    ]);
    return { ...mutation, replayed: false };
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
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

export async function commitReview(review: ReviewLog, card?: StudyCard): Promise<void> {
  const database = await openDatabase();
  const stores: StoreName[] = card
    ? ['cards', 'reviews', 'reviewStats', 'meta']
    : ['reviews', 'reviewStats', 'meta'];
  const transaction = database.transaction(stores, 'readwrite');
  const done = transactionDone(transaction);
  if (card) transaction.objectStore('cards').put(card);
  transaction.objectStore('reviews').put(review);
  const storedStats = (await requestResult(
    transaction.objectStore('reviewStats').get('reviews'),
  )) as ReviewStats | undefined;
  transaction.objectStore('reviewStats').put(appendReviewStats(storedStats, review));
  const revision = await bumpRevision(transaction);
  await done;
  announceCommit(revision, card ? ['cards', 'reviews', 'reviewStats'] : ['reviews', 'reviewStats']);
}

export async function getOrCreateDailySession(
  proposed: DailySessionRecord,
): Promise<DailySessionRecord> {
  const database = await openDatabase();
  const transaction = database.transaction(['dailySessions', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore('dailySessions');
  try {
    const rawExact = await requestResult(store.get(proposed.key));
    const exact = normalizeDailySessionRecord(rawExact);
    const sameDay = exact
      ? undefined
      : latestDailySession(
          (await requestResult(
            store.index('localDay').getAll(proposed.plan.localDay),
          )) as unknown[],
        );
    const existing = exact ?? sameDay;
    if (existing) {
      const needsMigration =
        (rawExact && (rawExact as { schemaVersion?: unknown }).schemaVersion !== 2) ||
        existing.plan.schemaVersion !== 2;
      if (needsMigration) {
        store.put(existing);
        const revision = await bumpRevision(transaction);
        await done;
        announceCommit(revision, ['dailySessions']);
        return existing;
      }
      await done;
      return existing;
    }
    if (rawExact) throw new Error('Uložená dnešní lekce má neplatný formát.');
    store.add(proposed);
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(revision, ['dailySessions']);
    return proposed;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

export async function mutateDailySession<T>(
  key: string,
  mutate: (session: DailySessionRecord) => {
    session: DailySessionRecord;
    evidence?: LearningEvidence;
    result: T;
  },
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(
    ['dailySessions', 'learningEvidence', 'skillStates', 'meta'],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const store = transaction.objectStore('dailySessions');
  try {
    const current = normalizeDailySessionRecord(await requestResult(store.get(key)));
    if (!current) throw new Error('Dnešní lekce už není dostupná nebo má neplatný formát.');
    const mutation = mutate(current);
    if (mutation.session.key !== key || mutation.session.plan.id !== current.plan.id) {
      throw new Error('Zápis dnešní lekce vrátil nekonzistentní identitu.');
    }
    store.put(mutation.session);
    if (mutation.evidence) await addEvidenceAndAdvanceSkills(transaction, mutation.evidence);
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(
      revision,
      mutation.evidence ? ['dailySessions', 'learningEvidence', 'skillStates'] : ['dailySessions'],
    );
    return mutation.result;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

export async function mutateReviewAndCard<T>(
  reviewId: string,
  mutate: (
    review: ReviewLog,
    card: StudyCard,
    cardReviews: ReviewLog[],
  ) => {
    review: ReviewLog;
    card: StudyCard;
    evidence?: LearningEvidence;
    result: T;
  },
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(
    ['cards', 'reviews', 'learningEvidence', 'skillStates', 'reviewStats', 'meta'],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const reviewStore = transaction.objectStore('reviews');
  const cardStore = transaction.objectStore('cards');
  try {
    const review = (await requestResult(reviewStore.get(reviewId))) as ReviewLog | undefined;
    if (!review) throw new Error('Hodnocení už není dostupné.');
    const [card, cardReviews] = await Promise.all([
      requestResult(cardStore.get(review.cardId)),
      requestResult(reviewStore.index('cardId').getAll(review.cardId)),
    ]);
    if (!card) throw new Error('Karta k tomuto hodnocení už není dostupná.');
    const mutation = mutate(review, card as StudyCard, cardReviews as ReviewLog[]);
    if (mutation.review.id !== review.id || mutation.card.id !== card.id) {
      throw new Error('Reklamace vrátila nekonzistentní záznam.');
    }
    reviewStore.put(mutation.review);
    const allReviews = (await requestResult(reviewStore.getAll())) as ReviewLog[];
    transaction.objectStore('reviewStats').put(deriveReviewStats(allReviews));
    cardStore.put(mutation.card);
    if (mutation.evidence) {
      await replaceEvidenceAndRebuildSkills(transaction, mutation.evidence);
    }
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(
      revision,
      mutation.evidence
        ? ['cards', 'reviews', 'reviewStats', 'learningEvidence', 'skillStates']
        : ['cards', 'reviews', 'reviewStats'],
    );
    return mutation.result;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

export async function deleteNoteCascade<T>(
  noteId: string,
  mutateCourse: (course: CourseProgress | undefined) => {
    course: CourseProgress;
    result: T;
  },
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(
    ['notes', 'cards', 'reviews', 'course', 'reviewStats', 'meta'],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const courseStore = transaction.objectStore('course');

  try {
    const [course, cardKeys, reviewKeys] = await Promise.all([
      requestResult(courseStore.get('course')),
      requestResult(transaction.objectStore('cards').index('noteId').getAllKeys(noteId)),
      requestResult(transaction.objectStore('reviews').index('noteId').getAllKeys(noteId)),
    ]);
    const mutation = mutateCourse(course as CourseProgress | undefined);
    transaction.objectStore('notes').delete(noteId);
    for (const key of cardKeys) transaction.objectStore('cards').delete(key);
    for (const key of reviewKeys) transaction.objectStore('reviews').delete(key);
    const remainingReviews = (await requestResult(
      transaction.objectStore('reviews').getAll(),
    )) as ReviewLog[];
    transaction.objectStore('reviewStats').put(deriveReviewStats(remainingReviews));
    courseStore.put(mutation.course);
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(revision, ['notes', 'cards', 'reviews', 'reviewStats', 'course']);
    return mutation.result;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

export async function replaceWithBackup(backup: AppBackup): Promise<void> {
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
    'readwrite',
  );
  const done = transactionDone(transaction);

  for (const name of [
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
  ] as StoreName[]) {
    transaction.objectStore(name).clear();
  }
  for (const deck of backup.decks) transaction.objectStore('decks').put(deck);
  for (const note of backup.notes) transaction.objectStore('notes').put(note);
  for (const card of backup.cards) transaction.objectStore('cards').put(card);
  for (const review of backup.reviews) transaction.objectStore('reviews').put(review);
  for (const evidence of backup.learningEvidence) {
    transaction.objectStore('learningEvidence').put(evidence);
  }
  for (const state of deriveSkillStates(backup.learningEvidence)) {
    transaction.objectStore('skillStates').put(state);
  }
  transaction.objectStore('settings').put(backup.settings);
  transaction.objectStore('course').put(backup.course);
  transaction.objectStore('reviewStats').put(deriveReviewStats(backup.reviews));

  const revision = await bumpRevision(transaction);
  await done;
  announceCommit(revision, [
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
  ]);
}

export async function readBackup(): Promise<AppBackup> {
  const snapshot = await readStoredSnapshot();
  if (!snapshot.settings) throw new Error('Nastavení aplikace nebylo nalezeno.');
  const reviews = await getAll<ReviewLog>('reviews');

  return {
    schemaVersion: 8,
    exportedAt: new Date().toISOString(),
    decks: snapshot.decks,
    notes: snapshot.notes,
    cards: snapshot.cards,
    reviews,
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
