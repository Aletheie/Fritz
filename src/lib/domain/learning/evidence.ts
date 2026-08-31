import { localDateKey } from '../stats/learning.ts';
import type { CourseProgress, ReviewLog, StudyCard } from '../types.ts';
import { communicationSkillId, grammarSkillId, vocabularySkillId } from './skills.ts';
import type { EvidenceModality, LearningEvidence } from './types.ts';

function reviewModality(review: ReviewLog): EvidenceModality {
  switch (review.exercise) {
    case 'choice':
    case 'flashcard':
    case 'matching':
      return 'recognition';
    case 'sentence':
    case 'speaking':
      return 'free-production';
    default:
      return 'guided-recall';
  }
}

export function learningEvidenceFromReview(
  review: ReviewLog,
  cardDirection: StudyCard['direction'] = 'cs-de',
): LearningEvidence {
  const skillIds = [
    vocabularySkillId(review.noteId, cardDirection === 'cs-de' ? 'recall' : 'meaning'),
  ];
  if (review.signal.selectedArticle !== undefined || review.mistakeTags?.includes('article')) {
    skillIds.push(vocabularySkillId(review.noteId, 'article'));
  }
  if (review.mistakeTags?.includes('plural')) {
    skillIds.push(vocabularySkillId(review.noteId, 'plural'));
  }
  if (
    review.mistakeTags?.some((tag) => ['verb-form', 'auxiliary', 'separable-prefix'].includes(tag))
  ) {
    skillIds.push(vocabularySkillId(review.noteId, 'form'));
  }
  const correct =
    review.rating !== 'again' && review.signal.wordCorrect && review.signal.articleCorrect;
  return {
    id: `evidence:review:${review.id}`,
    operationId: review.operationId,
    source: 'vocabulary-review',
    sourceId: review.id,
    skillIds: [...new Set(skillIds)],
    occurredAt: review.reviewedAt,
    localDay: review.localDay ?? localDateKey(new Date(review.reviewedAt)),
    mode: review.mode,
    modality: reviewModality(review),
    outcome: correct ? 'correct' : 'incorrect',
    hintsUsed: review.signal.hintsUsed,
    responseMs: review.signal.responseMs,
    independent: review.signal.hintsUsed === 0 && review.signal.attempt === 1,
    mistakeTags: review.mistakeTags,
    excludedFromLearning: review.excludedFromLearning,
  };
}

export function learningEvidenceFromCourseAnswer(
  event: CourseProgress['events'][number],
): LearningEvidence {
  return {
    id: `evidence:course-answer:${event.id}`,
    source: 'grammar-answer',
    sourceId: event.id,
    skillIds: [grammarSkillId(event.lessonId)],
    occurredAt: event.answeredAt,
    localDay: localDateKey(new Date(event.answeredAt)),
    mode: 'long-term',
    modality: 'guided-recall',
    outcome: event.correct ? 'correct' : 'incorrect',
    hintsUsed: event.firstTry ? 0 : 1,
    responseMs: event.responseMs,
    independent: event.firstTry,
  };
}

export function learningEvidenceFromCoachSession(
  event: CourseProgress['coachEvents'][number],
): LearningEvidence {
  return {
    id: `evidence:coach:${event.id}`,
    source: 'coach-session',
    sourceId: event.id,
    skillIds: [communicationSkillId(event.scenarioId)],
    occurredAt: event.completedAt,
    localDay: localDateKey(new Date(event.completedAt)),
    mode: 'long-term',
    modality: 'free-production',
    outcome: event.score >= 60 ? 'completed' : 'incorrect',
    hintsUsed: 0,
    responseMs: 0,
    independent: (event.independentTurns ?? (event.score >= 70 ? event.turns : 0)) >= event.turns,
    mistakeTags: event.mistakeTags,
  };
}

export function deriveLegacyLearningEvidence(input: {
  reviews: ReviewLog[];
  cards: StudyCard[];
  course: CourseProgress;
}): LearningEvidence[] {
  const directionByCard = new Map(input.cards.map((card) => [card.id, card.direction]));
  return [
    ...input.reviews.map((review) =>
      learningEvidenceFromReview(review, directionByCard.get(review.cardId)),
    ),
    ...input.course.events.map(learningEvidenceFromCourseAnswer),
    ...input.course.coachEvents.map(learningEvidenceFromCoachSession),
  ].toSorted(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id),
  );
}
