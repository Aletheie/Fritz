import type { MatchingRound } from '../exercises/matching.ts';
import type { Article, CefrLevel, LexemeKind, VerbForms } from '../types.ts';

export type StoryBookId =
  | 'a1-maerchen'
  | 'a1-haewelmann'
  | 'a1-bremer'
  | 'a1-fabeln'
  | 'a1-haensel-gretel'
  | 'a2-maerchen'
  | 'a2-max-moritz'
  | 'a2-alice'
  | 'a2-mondfahrt'
  | 'a2-biene-maja'
  | 'b1-heidi'
  | 'b1-kleider'
  | 'b1-nils'
  | 'b1-immensee'
  | 'b1-tom-sawyer'
  | 'b2-schimmelreiter'
  | 'b2-sandmann'
  | 'b2-taugenichts'
  | 'b2-bahnwaerter'
  | 'b2-schatzinsel'
  | 'c1-verwandlung'
  | 'c1-urteil'
  | 'c1-krug'
  | 'c1-wahlverwandtschaften'
  | 'c1-dorian-gray';

export type StoryAccent = 'butter' | 'mint' | 'sky' | 'cobalt' | 'coral';
export type StoryAudience = 'all-ages' | 'young-adult' | 'new-adult';
export type StoryExerciseKind =
  | 'order'
  | 'cloze'
  | 'memory'
  | 'matching'
  | 'recall'
  | 'sequence'
  | 'arc'
  | 'production';

export type StoryExerciseResult = {
  completed: boolean;
  /** Undefined means a reflection/production task that is not objectively scored. */
  correct?: boolean;
};

export type StorySource = {
  gutenbergId: number;
  ebookUrl: string;
  textUrl: string;
  licenseUrl: string;
  sourceLabel: string;
  translator?: string;
  excerptLabel: string;
  licenseNoteCs: string;
  adapted: boolean;
};

export type StoryGlossaryEntry = {
  id: string;
  german: string;
  czech: string;
  kind: LexemeKind;
  article?: Article;
  plural?: string;
  verbForms?: VerbForms;
  cefr: CefrLevel;
  forms: string[];
  distractors: string[];
  learningNote: string;
  exampleDe?: string;
  exampleCs?: string;
};

export type StoryPage = {
  id: string;
  index: number;
  number: number;
  sectionTitle?: string;
  paragraphs: string[];
  wordCount: number;
};

type StoryExerciseBase = {
  id: string;
  kind: StoryExerciseKind;
  promptCs: string;
  instructionCs: string;
  successCs: string;
};

export type StoryOrderExercise = {
  kind: 'order';
  tokens: string[];
  answer: string[];
  sentence: string;
} & StoryExerciseBase;

export type StoryClozeExercise = {
  kind: 'cloze';
  before: string;
  after: string;
  options: string[];
  answer: string;
  entryId?: string;
} & StoryExerciseBase;

export type StoryMemoryExercise = {
  kind: 'memory';
  options: string[];
  answer: string;
} & StoryExerciseBase;

export type StoryMatchingExercise = {
  kind: 'matching';
} & StoryExerciseBase &
  MatchingRound;

export type StoryRecallExercise = {
  kind: 'recall';
  before: string;
  after: string;
  answer: string;
  acceptedAnswers: string[];
  hintDe: string;
  entryId?: string;
} & StoryExerciseBase;

export type StorySequenceExercise = {
  kind: 'sequence';
  options: string[];
  answer: string[];
  explanationCs: string;
} & StoryExerciseBase;

export type StoryArcOption = {
  id: string;
  openingDe: string;
  closingDe: string;
};

export type StoryArcExercise = {
  kind: 'arc';
  options: StoryArcOption[];
  answerId: string;
  summaryCs: string;
} & StoryExerciseBase;

export type StoryProductionExercise = {
  kind: 'production';
  starterDe: string;
  modelAnswerDe: string;
  supportWords: string[];
  checklistCs: string[];
  minimumWords: number;
} & StoryExerciseBase;

export type StoryExercise =
  | StoryOrderExercise
  | StoryClozeExercise
  | StoryMemoryExercise
  | StoryMatchingExercise
  | StoryRecallExercise
  | StorySequenceExercise
  | StoryArcExercise
  | StoryProductionExercise;

export type StoryCheckpoint = {
  id: string;
  afterPageId: string;
  exercise: StoryExercise;
};

export type StoryEpisode = {
  id: string;
  index: number;
  number: number;
  title: string;
  summaryCs: string;
  minutes: number;
  pages: StoryPage[];
  checkpoints: StoryCheckpoint[];
};

export type StoryBook = {
  id: StoryBookId;
  title: string;
  author: string;
  level: CefrLevel;
  audience: StoryAudience;
  accent: StoryAccent;
  genreCs: string;
  descriptionCs: string;
  contentNoteCs: string;
  screenCount: number;
  episodeCount: number;
  approximateMinutes: number;
  modernizedByDefault: boolean;
  source: StorySource;
  glossary: StoryGlossaryEntry[];
  pages: StoryPage[];
  originalPages?: StoryPage[];
  episodes: StoryEpisode[];
};

export type StoryBookSummary = {
  episodes: Array<
    Pick<StoryEpisode, 'id' | 'index' | 'number' | 'title' | 'summaryCs' | 'minutes'>
  >;
} & Omit<StoryBook, 'glossary' | 'pages' | 'originalPages' | 'episodes'>;

export type StoryBookProgress = {
  bookId: StoryBookId;
  furthestPage: number;
  lastPage: number;
  currentEpisodeId: string;
  completedEpisodeIds: string[];
  completedCheckpointIds: string[];
  exerciseAttempts: number;
  correctExercises: number;
  savedWords: number;
  startedAt: string;
  updatedAt: string;
};

export type StoryProgressMap = Partial<Record<StoryBookId, StoryBookProgress>>;

export type StoryTextToken = {
  value: string;
  word?: string;
  normalized?: string;
  glossary?: StoryGlossaryEntry;
};
