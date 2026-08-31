import type { AiSentenceEvaluationResult } from '../ai/types.ts';
import type { SchedulePreviewOption } from '../scheduler/fsrs.ts';
import type { AnswerSignal, RatingKey, ReviewDisputeReason } from '../types.ts';

export type StudyResult = {
  rating: RatingKey;
  correct: boolean;
  nearCorrect?: boolean;
  message: string;
  expectedDisplay: string;
  signal: AnswerSignal;
  xp: number;
  scheduledFor?: string;
  schedulePreview?: SchedulePreviewOption[];
  aiSentenceEvaluation?: AiSentenceEvaluationResult;
  disputed?: boolean;
  disputeReason?: ReviewDisputeReason;
};
