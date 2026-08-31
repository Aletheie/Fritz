import type { CardDirection, DailyMinutes, LearningGoal, MistakeTag, StudyMode } from '../types.ts';

export type SkillDomain = 'vocabulary' | 'grammar' | 'listening' | 'communication' | 'reading';

export type SkillStage = 0 | 1 | 2 | 3 | 4 | 5;

export type SkillDefinition = {
  id: string;
  domain: SkillDomain;
  title: string;
  sourceId: string;
  cefr?: string;
  prerequisiteIds: string[];
  relatedSkillIds: string[];
};

export type EvidenceSource =
  | 'vocabulary-review'
  | 'grammar-answer'
  | 'listening-dictation'
  | 'transfer'
  | 'coach-session'
  | 'path-node'
  | 'reading';

export type EvidenceModality =
  | 'recognition'
  | 'guided-recall'
  | 'dictation'
  | 'free-production'
  | 'reading';

export type EvidenceOutcome = 'correct' | 'incorrect' | 'completed' | 'skipped';

/**
 * A privacy-minimising learning event. It stores the result and the affected skills,
 * never a microphone recording or a full free-form learner transcript.
 */
export type LearningEvidence = {
  id: string;
  operationId?: string;
  activityId?: string;
  source: EvidenceSource;
  sourceId: string;
  skillIds: string[];
  occurredAt: string;
  localDay: string;
  mode: StudyMode;
  modality: EvidenceModality;
  outcome: EvidenceOutcome;
  hintsUsed: number;
  responseMs: number;
  independent: boolean;
  mistakeTags?: MistakeTag[];
  /** Links a privacy-minimal repair result to the signal it was meant to resolve. */
  repairOfEvidenceId?: string;
  excludedFromLearning?: boolean;
};

export type SkillState = {
  skillId: string;
  stage: SkillStage;
  nextReviewAt: string;
  independentSuccesses: number;
  attempts: number;
  lastEvidenceAt?: string;
  lastWeakness?: MistakeTag;
};

export type LessonPhase = 'review' | 'focus' | 'transfer' | 'close' | 'repair';

type LessonActivityBase = {
  id: string;
  phase: LessonPhase;
  title: string;
  instruction: string;
  estimatedSeconds: number;
  skillIds: string[];
  repairOf?: string;
};

export type ReviewLessonActivity = {
  kind: 'review';
  cardId: string;
  noteId: string;
  direction: CardDirection;
} & LessonActivityBase;

export type GrammarLessonActivity = {
  kind: 'grammar';
  lessonId: string;
  questionId: string;
  questionKind: 'choice' | 'fill' | 'order';
} & LessonActivityBase;

export type ListeningLessonActivity = {
  kind: 'listening';
  chapterId: string;
  audioId: string;
  transcript: string;
  translation: string;
} & LessonActivityBase;

export type TransferLessonActivity = {
  kind: 'transfer';
  scenarioId: string;
  prompt: string;
  starter: string;
  turnsTarget: number;
  repair?: {
    evidenceId: string;
    mistakeTag: MistakeTag;
  };
} & LessonActivityBase;

export type ExitTicketLessonActivity = {
  kind: 'exit-ticket';
  prompt: string;
} & LessonActivityBase;

export type LessonActivity =
  | ReviewLessonActivity
  | GrammarLessonActivity
  | ListeningLessonActivity
  | TransferLessonActivity
  | ExitTicketLessonActivity;

export type DailyLessonPlan = {
  id: string;
  schemaVersion: 2;
  localDay: string;
  minutes: DailyMinutes;
  learningGoal: LearningGoal;
  generatedAt: string;
  estimatedSeconds: number;
  activities: LessonActivity[];
};

export type DailySessionRecord = {
  key: string;
  schemaVersion: 2;
  plan: DailyLessonPlan;
  cursor: number;
  completedActivityIds: string[];
  evidenceIds: string[];
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
};

export type DailySessionSummary = {
  completed: number;
  total: number;
  percent: number;
  finished: boolean;
};
