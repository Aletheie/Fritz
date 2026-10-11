import { normalizeCourseProgress } from '../../domain/course/course-progress.ts';
import { calculateReviewXp, missionCompletionBonus } from '../../domain/gamification.ts';
import { learningEvidenceFromReview } from '../../domain/learning/evidence.ts';
import { classifyMistakes } from '../../domain/learning/mistakes.ts';
import { scheduleReview } from '../../domain/scheduler/fsrs.ts';
import { localDateKey } from '../../domain/stats/learning.ts';
import { normalizeDraft } from '../../domain/vocabulary/draft.ts';
import { createNoteAndCard } from '../../domain/vocabulary/factory.ts';
import { assertValidVocabularyDraft } from '../../domain/vocabulary/validation.ts';
import {
  commitReviewCommand,
  deleteNoteCascade,
  mutateReviewAndCard,
  mutateVocabularyRecords,
  mutateNote,
  readRecentReviewsForNote,
} from '../db.ts';

import type { LearningEvidence } from '../../domain/learning/types.ts';
import type {
  AnswerSignal,
  CourseProgress,
  ImportedNoteDraft,
  Note,
  RatingKey,
  ReviewLog,
  ReviewDisputeReason,
  StudyCard,
  StudyMode,
} from '../../domain/types.ts';

export async function loadNoteReviewHistory(noteId: string, limit = 5): Promise<ReviewLog[]> {
  return readRecentReviewsForNote(noteId, limit);
}

export async function addImportedNotes(
  deckId: string,
  drafts: ImportedNoteDraft[],
): Promise<{ addedNotes: Note[]; addedCards: StudyCard[]; duplicates: number }> {
  const normalizedDrafts = drafts.map((rawDraft) => {
    const draft = normalizeDraft(rawDraft);
    assertValidVocabularyDraft(draft);
    return draft;
  });

  return mutateVocabularyRecords(({ notes }) => {
    const keys = new Set<string>();
    for (const note of notes) {
      if (note.deckId === deckId) keys.add(note.normalizedGerman);
    }
    const addedNotes: Note[] = [];
    const addedCards: StudyCard[] = [];
    let duplicates = 0;

    for (const draft of normalizedDrafts) {
      if (keys.has(draft.normalizedGerman)) {
        duplicates += 1;
        continue;
      }
      keys.add(draft.normalizedGerman);
      const { sourceLine: _sourceLine, ...noteInput } = draft;
      const created = createNoteAndCard(deckId, {
        ...noteInput,
        source: noteInput.source ?? 'import',
      });
      addedNotes.push(created.note);
      addedCards.push(created.card);
    }

    return {
      notesToPut: addedNotes,
      cardsToPut: addedCards,
      result: { addedNotes, addedCards, duplicates },
    };
  });
}

export async function saveNote(noteId: string, rawDraft: ImportedNoteDraft): Promise<Note> {
  const draft = normalizeDraft(rawDraft);
  assertValidVocabularyDraft(draft);
  const updatedAt = new Date().toISOString();

  return mutateNote(noteId, (current) => {
    const { sourceLine: _sourceLine, ...values } = draft;
    return {
      ...current,
      ...values,
      id: current.id,
      deckId: current.deckId,
      source: current.source ?? values.source ?? 'manual',
      createdAt: current.createdAt,
      updatedAt,
    };
  });
}

export async function recordReview(input: {
  operationId: string;
  activityId?: string;
  cardId: string;
  noteId: string;
  mode: StudyMode;
  rating: RatingKey;
  signal: AnswerSignal;
  now?: Date;
}): Promise<{ card: StudyCard; log: ReviewLog; evidence: LearningEvidence; replayed: boolean }> {
  const now = input.now ?? new Date();
  const dayKey = localDateKey(now);
  const result = await commitReviewCommand(
    { ...input, localDay: dayKey },
    ({ card, note, settings, reviews }) => {
      const scheduling =
        input.mode === 'long-term'
          ? scheduleReview(card, input.rating, settings.desiredRetention, now)
          : { card, before: card.fsrs, after: card.fsrs };
      const reviewedAt = now.toISOString();
      const countedReviews = reviews.filter((review) => !review.excludedFromLearning);
      const previousSameCardToday = countedReviews.filter(
        (review) =>
          review.cardId === card.id &&
          (review.localDay ?? localDateKey(new Date(review.reviewedAt))) === dayKey,
      ).length;
      const draft = {
        mode: input.mode,
        exercise: input.signal.exercise,
        rating: input.rating,
        signal: input.signal,
      } as const;
      const preview: ReviewLog = {
        id: `review:${input.operationId}`,
        operationId: input.operationId,
        cardId: card.id,
        noteId: note.id,
        deckId: note.deckId,
        reviewedAt,
        localDay: dayKey,
        dueAtBefore: card.dueAt,
        mistakeTags: classifyMistakes({ signal: input.signal, note }),
        ...draft,
      };
      const missionBonusAwarded = settings.gamificationEnabled
        ? Math.min(
            60,
            Math.max(
              0,
              Math.round(missionCompletionBonus(countedReviews, preview, now, settings.dailyGoal)),
            ),
          )
        : 0;
      const log: ReviewLog = {
        ...preview,
        xpAwarded: calculateReviewXp(draft, previousSameCardToday) + missionBonusAwarded,
        missionBonusAwarded: missionBonusAwarded || undefined,
        scheduleBefore: scheduling.before,
        scheduleAfter: scheduling.after,
      };
      const evidence = {
        ...learningEvidenceFromReview(log, card.direction),
        activityId: input.activityId,
      };
      return {
        card: scheduling.card,
        log,
        evidence,
      };
    },
  );
  return {
    card: result.card,
    log: result.log,
    replayed: result.replayed,
    evidence: {
      ...learningEvidenceFromReview(result.log, result.card.direction),
      activityId: input.activityId,
    },
  };
}

export async function disputeReview(input: {
  reviewId: string;
  reason: ReviewDisputeReason;
  now?: Date;
}): Promise<{ card: StudyCard; log: ReviewLog }> {
  const now = input.now ?? new Date();
  return mutateReviewAndCard(input.reviewId, (review, card, cardReviews) => {
    if (review.excludedFromLearning) return { review, card, result: { card, log: review } };

    const orderedScheduleReviews = cardReviews
      .filter((item) => item.mode === 'long-term')
      .toSorted(
        (left, right) =>
          left.reviewedAt.localeCompare(right.reviewedAt) || left.id.localeCompare(right.id),
      );
    const latestActive = orderedScheduleReviews.findLast((item) => !item.excludedFromLearning);
    const canRestoreSchedule = review.mode === 'long-term' && latestActive?.id === review.id;
    const previousActive = orderedScheduleReviews.findLast(
      (item) => item.id !== review.id && !item.excludedFromLearning,
    );
    const earliestSchedule = orderedScheduleReviews[0];
    const restoredSchedule = previousActive?.scheduleAfter ?? earliestSchedule?.scheduleBefore;
    const restoredDueAt =
      scheduleDue(previousActive?.scheduleAfter) ??
      earliestSchedule?.dueAtBefore ??
      review.dueAtBefore ??
      card.dueAt;
    const restoredCard: StudyCard = canRestoreSchedule
      ? {
          ...card,
          dueAt: restoredDueAt,
          fsrs: restoredSchedule,
          updatedAt: now.toISOString(),
        }
      : card;
    const disputedLog: ReviewLog = {
      ...review,
      excludedFromLearning: true,
      disputedAt: now.toISOString(),
      disputeReason: input.reason,
      xpAwarded: 0,
      missionBonusAwarded: undefined,
    };
    return {
      review: disputedLog,
      card: restoredCard,
      evidence: learningEvidenceFromReview(disputedLog, card.direction),
      result: { card: restoredCard, log: disputedLog },
    };
  });
}

function scheduleDue(schedule: ReviewLog['scheduleAfter']): string | undefined {
  const due = schedule?.due;
  if (typeof due !== 'string' || !Number.isFinite(Date.parse(due))) return undefined;
  return due;
}

export async function removeNote(
  noteId: string,
  progress: CourseProgress,
  now = new Date(),
): Promise<CourseProgress> {
  const { removeNoteFromCourseVocabularyEvents } =
    await import('../../domain/course/vocabulary.ts');
  return deleteNoteCascade(noteId, (stored) => {
    const current = normalizeCourseProgress(stored ?? progress, now);
    const course = removeNoteFromCourseVocabularyEvents(current, noteId, now);
    return { course, result: course };
  });
}
