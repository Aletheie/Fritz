import type { DailyMinutes, ExamPlan, Note, ReviewLog, StudyCard } from './types.ts';

export type ExamPlanReadiness = {
  total: number;
  ready: number;
  unassistedReviewed: number;
  percent: number;
  daysRemaining: number;
  dailyTarget: number;
  dailyCapacity: number;
  feasible: boolean;
  riskNoteIds: string[];
};

const DAILY_CAPACITY: Record<DailyMinutes, number> = {
  5: 5,
  10: 10,
  20: 18,
};

export function examPlanDaysRemaining(plan: ExamPlan, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const exam = new Date(`${plan.examDate}T12:00:00`);
  if (Number.isNaN(exam.getTime())) return 0;
  return Math.max(0, Math.ceil((exam.getTime() - today.getTime()) / 86_400_000));
}

export function examPlanScopeNotes(notes: Note[], tag: string): Note[] {
  if (tag === 'all') return notes;
  return notes.filter((note) => note.tags.includes(tag));
}

function isUnassistedSuccess(review: ReviewLog): boolean {
  return (
    !review.excludedFromLearning &&
    review.rating !== 'again' &&
    review.signal.hintsUsed === 0 &&
    review.signal.wordCorrect &&
    review.signal.articleCorrect
  );
}

function cardStability(card: StudyCard | undefined): number {
  const stability = card?.fsrs?.stability;
  return typeof stability === 'number' && Number.isFinite(stability) ? stability : 0;
}

export function examPlanReadiness(input: {
  plan: ExamPlan;
  notes: Note[];
  cards: StudyCard[];
  reviews: ReviewLog[];
  now?: Date;
}): ExamPlanReadiness {
  const now = input.now ?? new Date();
  const scope = examPlanScopeNotes(input.notes, input.plan.tag);
  const scopeIds = new Set(scope.map((note) => note.id));
  const latestByNote = new Map<string, { review: ReviewLog; reviewedAt: number }>();
  for (const review of input.reviews) {
    if (review.excludedFromLearning || !scopeIds.has(review.noteId)) continue;
    const previous = latestByNote.get(review.noteId);
    const reviewedAt = Date.parse(review.reviewedAt);
    if (!previous || previous.reviewedAt < reviewedAt) {
      latestByNote.set(review.noteId, { review, reviewedAt });
    }
  }

  const cardByNote = new Map<string, StudyCard>();
  for (const card of input.cards) {
    const previous = cardByNote.get(card.noteId);
    if (!previous || card.direction === 'cs-de') cardByNote.set(card.noteId, card);
  }

  let ready = 0;
  let unassistedReviewed = 0;
  const risk: Array<{
    noteId: string;
    missingReview: number;
    stability: number;
    dueAt: string;
  }> = [];
  for (const note of scope) {
    const latest = latestByNote.get(note.id)?.review;
    if (latest?.signal.hintsUsed === 0) unassistedReviewed += 1;
    if (latest && isUnassistedSuccess(latest)) {
      ready += 1;
      continue;
    }
    const card = cardByNote.get(note.id);
    risk.push({
      noteId: note.id,
      missingReview: latest ? 1 : 0,
      stability: cardStability(card),
      dueAt: card?.dueAt ?? '',
    });
  }
  risk.sort(
    (left, right) =>
      left.missingReview - right.missingReview ||
      left.stability - right.stability ||
      left.dueAt.localeCompare(right.dueAt),
  );
  const riskNoteIds = risk.map((item) => item.noteId);

  const daysRemaining = examPlanDaysRemaining(input.plan, now);
  const remaining = Math.max(0, scope.length - ready);
  const dailyCapacity = DAILY_CAPACITY[input.plan.dailyMinutes];
  const dailyTarget =
    remaining === 0 ? 0 : Math.max(1, Math.ceil(remaining / Math.max(1, daysRemaining)));

  return {
    total: scope.length,
    ready,
    unassistedReviewed,
    percent: scope.length === 0 ? 0 : Math.round((ready / scope.length) * 100),
    daysRemaining,
    dailyTarget,
    dailyCapacity,
    feasible: dailyTarget <= dailyCapacity,
    riskNoteIds,
  };
}
