import { localizedError } from '../../domain/errors.ts';
import {
  appendReviewStats,
  createReviewStats,
  deriveReviewStats,
  type ReviewStats,
} from '../../domain/stats/review-stats.ts';
import { abortTransaction, openDatabase, requestResult, transactionDone } from './connection.ts';
import { addEvidenceAndAdvanceSkills, replaceEvidenceAndRebuildSkills } from './learning.ts';
import { announceCommit, bumpRevision } from './sync.ts';

import type { LearningEvidence } from '../../domain/learning/types.ts';
import type {
  AppSettings,
  CourseProgress,
  Deck,
  Note,
  ReviewLog,
  StudyCard,
} from '../../domain/types.ts';

export type ReviewCommandSnapshot = {
  card: StudyCard;
  note: Note;
  settings: AppSettings;
  reviews: ReviewLog[];
};

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
  mutate: (
    course: CourseProgress | undefined,
    priorEvidence?: LearningEvidence,
  ) => {
    course: CourseProgress;
    evidence?: LearningEvidence | LearningEvidence[];
    result: T;
  },
  options: { evidenceId?: string } = {},
): Promise<T> {
  const database = await openDatabase();
  const transaction = database.transaction(
    ['course', 'learningEvidence', 'skillStates', 'meta'],
    'readwrite',
  );
  const done = transactionDone(transaction);
  const store = transaction.objectStore('course');

  try {
    const [current, priorEvidence] = await Promise.all([
      requestResult(store.get('course')) as Promise<CourseProgress | undefined>,
      options.evidenceId
        ? (requestResult(
            transaction.objectStore('learningEvidence').get(options.evidenceId),
          ) as Promise<LearningEvidence | undefined>)
        : undefined,
    ]);
    const mutation = mutate(current, priorEvidence);
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

export async function mutateNote(noteId: string, mutate: (note: Note) => Note): Promise<Note> {
  const database = await openDatabase();
  const transaction = database.transaction(['notes', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore('notes');
  try {
    const current = (await requestResult(store.get(noteId))) as Note | undefined;
    if (!current)
      throw localizedError(
        'Slovíčko už v knihovně není.',
        'This word is no longer in your library.',
      );
    const note = mutate(current);
    // Older migrations can preserve a non-unique index. Check every matching key
    // within this same transaction so concurrent edits cannot introduce duplicates.
    const matchingIds = await requestResult(
      store.index('deckAndNormalizedGerman').getAllKeys([note.deckId, note.normalizedGerman]),
    );
    if (matchingIds.some((id) => id !== noteId)) {
      throw localizedError(
        'Stejné německé slovíčko už v tomto balíčku je.',
        'The same German word is already in this deck.',
      );
    }
    store.put(note);
    const revision = await bumpRevision(transaction);
    await done;
    announceCommit(revision, ['notes']);
    return note;
  } catch (error) {
    await abortTransaction(transaction, done);
    throw error;
  }
}

export async function mutateVocabularyRecords<T>(
  mutate: (snapshot: { notes: Note[] }) => {
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
    const notes = await requestResult(noteStore.getAll());
    const mutation = mutate({ notes: notes as Note[] });
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
      throw localizedError(
        'Karta, slovíčko nebo nastavení už nejsou dostupné. Načti relaci znovu.',
        'The card, word or settings are no longer available. Reload the session.',
      );
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
    if (!review)
      throw localizedError('Hodnocení už není dostupné.', 'This result is no longer available.');
    const [card, cardReviews] = await Promise.all([
      requestResult(cardStore.get(review.cardId)),
      requestResult(reviewStore.index('cardId').getAll(review.cardId)),
    ]);
    if (!card)
      throw localizedError(
        'Karta k tomuto hodnocení už není dostupná.',
        'The card for this result is no longer available.',
      );
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
