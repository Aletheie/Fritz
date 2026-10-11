import { localizedError } from '../../domain/errors.ts';
import {
  deriveLegacyLearningEvidence,
  learningEvidenceFromReview,
} from '../../domain/learning/evidence.ts';
import { deriveSkillStates } from '../../domain/learning/skills.ts';
import { deriveReviewStats } from '../../domain/stats/review-stats.ts';
import { migrateLegacyDatabaseIfNeeded } from './legacy.ts';
import { publishDatabaseSync, syncListeners } from './sync.ts';

import type { LearningEvidence } from '../../domain/learning/types.ts';
import type { CourseProgress, ReviewLog, StudyCard } from '../../domain/types.ts';

export const DB_NAME = 'fritz';

export const LEGACY_DB_NAME = 'wortly';

export const DB_VERSION = 9;

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

let databasePromise: Promise<IDBDatabase> | undefined;

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

export function ensureIndexedDb(): IDBFactory {
  if (!globalThis.indexedDB) {
    throw localizedError(
      'IndexedDB není v tomto prostředí dostupná.',
      'Local storage (IndexedDB) is not available in this browser.',
    );
  }
  return globalThis.indexedDB;
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
}

export function recentCursorResults<T>(
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
      if (values.length >= limit) {
        resolve(values);
        return;
      }
      cursor.continue();
    });
    request.addEventListener('error', () => reject(request.error), { once: true });
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error), { once: true });
    transaction.addEventListener('error', () => reject(transaction.error), { once: true });
  });
}

export async function abortTransaction(
  transaction: IDBTransaction,
  done: Promise<void>,
): Promise<void> {
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
      ensureIndex(reviews, 'noteAndReviewedAt', ['noteId', 'reviewedAt']);
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
