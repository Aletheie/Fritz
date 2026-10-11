import type { StoryBookId } from '../stories/types.ts';
import type {
  Article,
  CefrLevel,
  CoursePathEvent,
  CoursePathNodeProgress,
  CourseProgress,
  DetailedCefrLevel,
  LexemeKind,
  VerbForms,
} from '../types.ts';

export type CoursePathNodeType =
  | 'vocabulary'
  | 'practice'
  | 'grammar'
  | 'mix'
  | 'sentence'
  | 'coach'
  | 'checkpoint'
  | 'reading';

export type CoursePathPhase = 'foundation' | 'connection' | 'production' | 'check' | 'bonus';

export type CoursePathNodeState =
  | 'completed'
  | 'current'
  | 'available'
  | 'locked'
  | 'bonus'
  | 'in-progress';

export type CourseWord = {
  german: string;
  czech: string;
  kind: LexemeKind;
  article?: Article;
  plural?: string;
  acceptedGerman?: string[];
  acceptedCzech?: string[];
  cefr: CefrLevel;
  exampleDe?: string;
  exampleCs?: string;
  learningNote?: string;
  verbForms?: VerbForms;
  senseId?: string;
  role?: 'target' | 'review' | 'stretch';
  contexts?: string[];
  collocations?: string[];
  usageNote?: string;
};

export type CourseLexeme = {
  id: string;
  lemma: string;
  displayGerman: string;
  primaryCzech: string;
  acceptedGerman: string[];
  acceptedCzech: string[];
  senseId: string;
  role: 'target' | 'review' | 'stretch';
  contexts: string[];
  collocations: string[];
} & CourseWord;

export type CourseDialogueTurn = {
  speaker: string;
  de: string;
  cs: string;
};

export type CourseAssessment = {
  id: string;
  instruction: string;
  criteria: string[];
  deterministic: true;
};

export type CourseModelSentence = {
  de: string;
  cs: string;
  trap: string;
  note: string;
};

export type CoursePathNode = {
  id: string;
  chapterId: string;
  order: number;
  type: CoursePathNodeType;
  phase: CoursePathPhase;
  title: string;
  description: string;
  minutes: number;
  xp: number;
  required: boolean;
  grammarLessonId?: string;
  coachScenarioId?: string;
  storyBookId?: StoryBookId;
};

export type CoursePathChapter = {
  id: string;
  number: number;
  level: DetailedCefrLevel;
  title: string;
  subtitle: string;
  themeTag: string;
  grammarLessonId: string;
  coachScenarioId: string;
  storyBookId: StoryBookId;
  grammarIdea: string;
  mission: string;
  outcomes: string[];
  grammarPattern: string;
  modelSentences: CourseModelSentence[];
  sentencePrompt: string;
  sentenceStarter: string;
  sentenceChecklist: string[];
  words: CourseLexeme[];
  nodes: CoursePathNode[];
  contentVersion: number;
  situation: string;
  prerequisites: string[];
  targetLexemeIds: string[];
  reviewLexemeIds: string[];
  grammarLessonIds: string[];
  coachScenarioIds: string[];
  readingIds: StoryBookId[];
  nodeIds: string[];
  estimatedMinutes: number;
  legacyAnchor: boolean;
  legacyNumber?: number;
  dialogue: CourseDialogueTurn[];
  assessment: CourseAssessment;
};

export type CoursePathNodeView = {
  node: CoursePathNode;
  state: CoursePathNodeState;
  progress?: CoursePathNodeProgress;
  lockReason?: string;
};

export type CoursePathChapterView = {
  chapter: CoursePathChapter;
  unlocked: boolean;
  completed: boolean;
  current: boolean;
  completedRequired: number;
  requiredTotal: number;
  percent: number;
  nodes: CoursePathNodeView[];
};

export type CompleteCoursePathNodeResult = {
  progress: CourseProgress;
  firstCompletion: boolean;
  starsImproved: boolean;
  previousStars: 0 | 1 | 2 | 3;
  stars: 0 | 1 | 2 | 3;
  xpAwarded: number;
  boosted: boolean;
  event?: CoursePathEvent;
  unlockedStoryBookId?: StoryBookId;
};

export type CourseChapterDefinition = {
  words: CourseWord[];
  contentVersion?: number;
  situation?: string;
  prerequisites?: string[];
  reviewLexemeIds?: string[];
  grammarLessonIds?: string[];
  coachScenarioIds?: string[];
  readingIds?: StoryBookId[];
  estimatedMinutes?: number;
  legacyAnchor?: boolean;
  dialogue?: CourseDialogueTurn[];
  assessment?: CourseAssessment;
} & Omit<
  CoursePathChapter,
  | 'nodes'
  | 'words'
  | 'contentVersion'
  | 'situation'
  | 'prerequisites'
  | 'targetLexemeIds'
  | 'reviewLexemeIds'
  | 'grammarLessonIds'
  | 'coachScenarioIds'
  | 'readingIds'
  | 'nodeIds'
  | 'estimatedMinutes'
  | 'legacyAnchor'
  | 'legacyNumber'
  | 'dialogue'
  | 'assessment'
>;
