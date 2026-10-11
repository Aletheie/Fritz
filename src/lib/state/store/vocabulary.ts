import { get } from 'svelte/store';
import {
  addImportedNotes,
  loadSnapshot,
  recordReview,
  disputeReview as disputeStoredReview,
  removeNote,
  saveNote,
} from '../../data/repository.ts';
import { localizedError } from '../../domain/errors.ts';
import { createId } from '../../domain/id.ts';
import { appendReviewStats } from '../../domain/stats/review-stats.ts';
import { replaceCard, showSnapshot, state, stateWithEvidence } from './core.ts';

import type { LearningEvidence } from '../../domain/learning/types.ts';
import type {
  AnswerSignal,
  ImportedNoteDraft,
  Note,
  RatingKey,
  ReviewDisputeReason,
  ReviewLog,
  StudyCard,
  StudyMode,
} from '../../domain/types.ts';

export async function importNotes(
  drafts: ImportedNoteDraft[],
): Promise<{ added: number; duplicates: number }> {
  const current = get(state);
  const deck = current.decks[0];
  if (!deck) throw localizedError('Nejdřív je potřeba vytvořit balíček.', 'Create a deck first.');

  const result = await addImportedNotes(deck.id, drafts);
  state.update((value) => ({
    ...value,
    notes: [...value.notes, ...result.addedNotes],
    cards: [...value.cards, ...result.addedCards],
  }));
  return { added: result.addedNotes.length, duplicates: result.duplicates };
}

export async function updateNote(noteId: string, draft: ImportedNoteDraft): Promise<Note> {
  const note = await saveNote(noteId, draft);
  state.update((value) => ({
    ...value,
    notes: value.notes.map((item) => (item.id === note.id ? note : item)),
  }));
  return note;
}

export async function review(input: {
  operationId?: string;
  activityId?: string;
  card: StudyCard;
  note: Note;
  mode: StudyMode;
  rating: RatingKey;
  signal: AnswerSignal;
  now?: Date;
}): Promise<{ card: StudyCard; log: ReviewLog; evidence: LearningEvidence }> {
  const current = get(state);
  const settings = current.settings;
  if (!settings)
    throw localizedError('Nastavení ještě není načtené.', 'Settings have not loaded yet.');
  const now = input.now ?? new Date();

  const result = await recordReview({
    operationId: input.operationId ?? createId('review-operation'),
    activityId: input.activityId,
    cardId: input.card.id,
    noteId: input.note.id,
    mode: input.mode,
    rating: input.rating,
    signal: input.signal,
    now,
  });
  if (result.replayed) {
    showSnapshot(await loadSnapshot());
    return result;
  }
  const evidence = result.evidence;
  state.update((value) => {
    const reviewAlreadyStored = value.recentReviews.some(
      (storedReview) => storedReview.id === result.log.id,
    );
    return stateWithEvidence(
      {
        ...value,
        cards: replaceCard(value.cards, result.card),
        recentReviews: reviewAlreadyStored
          ? value.recentReviews
          : [result.log, ...value.recentReviews].slice(0, 2_000),
        reviewStats: reviewAlreadyStored
          ? value.reviewStats
          : appendReviewStats(value.reviewStats, result.log),
      },
      evidence,
    );
  });
  return result;
}

export async function disputeReview(
  reviewId: string,
  reason: ReviewDisputeReason,
): Promise<ReviewLog> {
  const result = await disputeStoredReview({ reviewId, reason });
  showSnapshot(await loadSnapshot());
  return result.log;
}

export async function deleteNote(noteId: string): Promise<void> {
  const current = get(state);
  const course = await removeNote(noteId, current.course);
  const snapshot = await loadSnapshot();
  state.set({ ready: true, loading: false, ...snapshot, course });
}
