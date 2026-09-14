import type { LearningEvidence } from './learning/types.ts';
import type { StoryBookId, StoryProgressMap } from './stories/types.ts';

export type Article = 'der' | 'die' | 'das';
export type LexemeKind = 'noun' | 'verb' | 'adjective' | 'phrase' | 'other';
export type CardDirection = 'cs-de' | 'de-cs';
export type ExerciseKind =
  | 'typing'
  | 'choice'
  | 'flashcard'
  | 'word-order'
  | 'cloze'
  | 'sentence'
  | 'matching'
  | 'speaking';
export type StudyMode = 'long-term' | 'cram';
export type StudyPace = 'guided' | 'focused';
export type MotherTongue = 'cs' | 'en';
export type AccentTheme = 'green' | 'moss' | 'magenta' | 'rose' | 'blue' | 'teal';
export type RatingKey = 'again' | 'hard' | 'good' | 'easy';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type DetailedCefrLevel =
  | 'A1.1'
  | 'A1.2'
  | 'A2.1'
  | 'A2.2'
  | 'B1.1'
  | 'B1.2'
  | 'B2.1'
  | 'B2.2'
  | 'C1.1'
  | 'C1.2';
export type VocabularySource = 'seed' | 'manual' | 'import' | 'ai' | 'course';
export type TrainingSourceFilter = 'all' | 'own' | 'course' | 'without-course';
export type DailyMinutes = 5 | 10 | 20;
export type LearningGoal = 'school' | 'memory' | 'conversation';
export type ReviewDisputeReason = 'ai-too-strict' | 'content-error' | 'other';
export type GermanAuxiliary = 'haben' | 'sein';
export const MISTAKE_TAGS = [
  'article',
  'gender',
  'plural',
  'verb-form',
  'auxiliary',
  'separable-prefix',
  'word-order',
  'case',
  'preposition',
  'negation',
  'spelling',
  'meaning',
  'register',
  'fluency',
  'unknown',
] as const;

export type MistakeTag = (typeof MISTAKE_TAGS)[number];

export type CourseVocabularyLink = {
  chapterId: string;
  nodeId: string;
  linkedAt: string;
};

/**
 * Legacy deck weighting kept in backups for backwards compatibility.
 * New study sessions use ExercisePreferences and adaptive weighting instead.
 */
export type ExerciseMix = {
  typing: number;
  choice: number;
  flashcard: number;
};

export type ExercisePreferences = {
  typing: boolean;
  choice: boolean;
  flashcard: boolean;
  wordOrder: boolean;
  cloze: boolean;
  sentence: boolean;
  matching: boolean;
  speaking: boolean;
};

export type VerbForms = {
  thirdPerson?: string;
  preterite?: string;
  participle?: string;
  auxiliary?: GermanAuxiliary;
};

export type Deck = {
  id: string;
  title: string;
  description: string;
  desiredRetention: number;
  dailyNewLimit: number;
  exerciseMix: ExerciseMix;
  createdAt: string;
  updatedAt: string;
};

export type Note = {
  id: string;
  deckId: string;
  german: string;
  normalizedGerman: string;
  czech: string;
  kind: LexemeKind;
  article?: Article;
  plural?: string;
  acceptedGerman: string[];
  acceptedCzech: string[];
  tags: string[];
  exampleDe?: string;
  exampleCs?: string;
  cefr?: CefrLevel;
  learningNote?: string;
  mnemonic?: string;
  verbForms?: VerbForms;
  source?: VocabularySource;
  /**
   * Tags owned by Fritz. They are deliberately separated from editable user tags so a normal
   * vocabulary edit cannot accidentally remove origin metadata needed by Training filters.
   */
  systemTags?: string[];
  /** Stable links to every course node that introduced or reused this word. */
  courseLinks?: CourseVocabularyLink[];
  createdAt: string;
  updatedAt: string;
};

export type SerializedFsrsCard = Record<string, unknown>;

export type StudyCard = {
  id: string;
  deckId: string;
  noteId: string;
  direction: CardDirection;
  dueAt: string;
  fsrs?: SerializedFsrsCard;
  createdAt: string;
  updatedAt: string;
};

export type AnswerSignal = {
  exercise: ExerciseKind;
  submittedText?: string;
  normalizedText?: string;
  selectedArticle?: Article;
  selectedChoice?: string;
  expectedText?: string;
  wordCorrect: boolean;
  articleCorrect: boolean;
  exact: boolean;
  keyboardEquivalent: boolean;
  editDistance: number;
  responseMs: number;
  hintsUsed: number;
  attempt: number;
  aiAccepted?: boolean;
  aiScore?: number;
};

export type ReviewLog = {
  id: string;
  /** Stable client command ID used to make a retry idempotent. */
  operationId?: string;
  cardId: string;
  noteId: string;
  deckId: string;
  reviewedAt: string;
  /** Local calendar day captured when the review was committed. */
  localDay?: string;
  mode: StudyMode;
  exercise: ExerciseKind;
  rating: RatingKey;
  signal: AnswerSignal;
  /** Deterministic, privacy-minimizing learner-memory events. */
  mistakeTags?: MistakeTag[];
  xpAwarded?: number;
  missionBonusAwarded?: number;
  /** Due date before this review, used to restore a card after a grading dispute. */
  dueAtBefore?: string;
  scheduleBefore?: SerializedFsrsCard;
  scheduleAfter?: SerializedFsrsCard;
  /** Disputed reviews stay in history, but never affect learning statistics or XP. */
  excludedFromLearning?: boolean;
  disputedAt?: string;
  disputeReason?: ReviewDisputeReason;
};

export type CourseAnswerEvent = {
  id: string;
  lessonId: string;
  questionId: string;
  answeredAt: string;
  correct: boolean;
  firstTry: boolean;
  xpAwarded: number;
  responseMs: number;
};

export type CoachSessionEvent = {
  id: string;
  scenarioId: string;
  completedAt: string;
  score: number;
  turns: number;
  independentTurns?: number;
  /** Bounded diagnostic signals only; never a learner message or transcript. */
  mistakeTags?: MistakeTag[];
  xpAwarded: number;
};

export type CoursePathNodeProgress = {
  nodeId: string;
  startedAt?: string;
  completedAt?: string;
  attempts: number;
  bestStars: 0 | 1 | 2 | 3;
  xpAwarded: number;
  updatedAt: string;
};

export type CoursePathEvent = {
  id: string;
  nodeId: string;
  chapterId: string;
  completedAt: string;
  stars: 0 | 1 | 2 | 3;
  baseXp: number;
  bonusXp: number;
  xpAwarded: number;
  boosted: boolean;
};

export type CourseVocabularyEvent = {
  foundationRevision?: 1;
  id: string;
  nodeId: string;
  chapterId: string;
  completedAt: string;
  addedNoteIds: string[];
  linkedNoteIds: string[];
  systemTags: string[];
};

export type CourseRewardItemId = 'double-xp-next-node';

export type CoursePurchaseTransaction = {
  id: string;
  itemId: CourseRewardItemId;
  price: number;
  purchasedAt: string;
  boostId: string;
};

export type CourseDoubleXpBoost = {
  id: string;
  itemId: 'double-xp-next-node';
  purchasedAt: string;
  status: 'active' | 'consumed';
  consumedAt?: string;
  consumedByNodeId?: string;
};

export type CourseWallet = {
  purchases: CoursePurchaseTransaction[];
  boosts: CourseDoubleXpBoost[];
};

export type CourseProgress = {
  key: 'course';
  schemaVersion: 6;
  /** Additive catalog version; independent of the database schema. */
  contentVersion: number;
  /** New chapters satisfied solely to preserve a legacy learner's path position. */
  grandfatheredChapterIds: string[];
  events: CourseAnswerEvent[];
  coachEvents: CoachSessionEvent[];
  lessonBestStars: Record<string, 0 | 1 | 2 | 3>;
  claimedRewards: string[];
  storyBooks: StoryProgressMap;
  pathNodes: Record<string, CoursePathNodeProgress>;
  pathEvents: CoursePathEvent[];
  vocabularyEvents: CourseVocabularyEvent[];
  unlockedStoryBooks: StoryBookId[];
  wallet: CourseWallet;
  /** Bounded recent command IDs for idempotent story/course mutations. */
  appliedOperations?: string[];
  createdAt: string;
  updatedAt: string;
};

export type ExamPlan = {
  examDate: string;
  tag: string;
  dailyMinutes: DailyMinutes;
  createdAt: string;
  updatedAt: string;
};

export type AppSettings = {
  key: 'app';
  schemaVersion: 9;
  motherTongue: MotherTongue;
  profileName: string;
  grammarLevel: DetailedCefrLevel;
  onboardingCompleted: boolean;
  learningGoal: LearningGoal;
  dailyMinutes: DailyMinutes;
  examPlan?: ExamPlan;
  favoriteCoachScenarioIds: string[];
  favoriteStoryBookIds: StoryBookId[];
  accentTheme: AccentTheme;
  desiredRetention: number;
  dailyNewLimit: number;
  dailyGoal: number;
  exerciseMix: ExerciseMix;
  exercisePreferences: ExercisePreferences;
  studyPace: StudyPace;
  allowKeyboardFallback: boolean;
  autoSpeakGerman: boolean;
  celebrations: boolean;
  gamificationEnabled: boolean;
  rivalryEnabled: boolean;
  requireCorrection: boolean;
  showKeyboardHints: boolean;
  showStudyTips: boolean;
  reduceMotion: boolean;
  trainingSourceFilter: TrainingSourceFilter;
  createdAt: string;
  updatedAt: string;
};

export type AppBackup = {
  schemaVersion: 8;
  exportedAt: string;
  decks: Deck[];
  notes: Note[];
  cards: StudyCard[];
  reviews: ReviewLog[];
  learningEvidence: LearningEvidence[];
  settings: AppSettings;
  course: CourseProgress;
};

export type ImportedNoteDraft = {
  german: string;
  normalizedGerman: string;
  czech: string;
  kind: LexemeKind;
  article?: Article;
  plural?: string;
  acceptedGerman: string[];
  acceptedCzech: string[];
  tags: string[];
  exampleDe?: string;
  exampleCs?: string;
  cefr?: CefrLevel;
  learningNote?: string;
  mnemonic?: string;
  verbForms?: VerbForms;
  source?: VocabularySource;
  sourceLine: number;
};
