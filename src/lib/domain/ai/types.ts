import { normalizeGermanKey, stripLeadingArticle } from '../grading/normalize.ts';
import { normalizeDraft } from '../vocabulary/draft.ts';

import type {
  Article,
  CefrLevel,
  GermanAuxiliary,
  ImportedNoteDraft,
  LexemeKind,
  MistakeTag,
  MotherTongue,
  Note,
} from '../types.ts';
import type { AiConnectionSummary } from './connection.ts';
import type { AiAccessMode, AiFeature, AiProviderId } from './policy.ts';

export type AiKeySource = 'user' | 'server' | 'inkling' | 'demo' | 'none';
export type AiVocabularyMode = 'generate' | 'extract' | 'enrich';
export type AiVocabularyFocus = 'balanced' | 'nouns' | 'verbs' | 'phrases';

export type AiKeyStatus = {
  legacyMigrationAvailable?: boolean;
  configured: boolean;
  source: AiKeySource;
  model: string;
  canStoreUserKey: boolean;
  mode: AiAccessMode;
  provider?: AiProviderId;
  fallbackConfigured: boolean;
  fallbackConsentFeatures: AiFeature[];
  sponsoredAvailable: boolean;
  dataRecipient: string;
  connection?: AiConnectionSummary;
  localProvidersAllowed?: boolean;
  userConnectionNeedsAttention?: boolean;
};

export function aiEndpointAvailable(
  status: Pick<AiKeyStatus, 'configured' | 'mode'> | undefined,
): boolean {
  return Boolean(status && (status.configured || status.mode === 'demo'));
}

export type AiGeneratedVerbForms = {
  thirdPerson: string | null;
  preterite: string | null;
  participle: string | null;
  auxiliary: GermanAuxiliary | null;
};

export type AiGeneratedVocabularyItem = {
  german: string;
  czech: string;
  kind: LexemeKind;
  article: Article | null;
  plural: string | null;
  acceptedGerman: string[];
  acceptedCzech: string[];
  tags: string[];
  exampleDe: string | null;
  exampleCs: string | null;
  cefr: CefrLevel;
  learningNote: string | null;
  mnemonic: string | null;
  verbForms: AiGeneratedVerbForms | null;
};

export type AiVocabularyResult = {
  title: string;
  summary: string;
  items: AiGeneratedVocabularyItem[];
  model: string;
};

export type AiExplanationResult = {
  headline: string;
  explanation: string;
  tip: string;
  miniExampleDe: string;
  miniExampleCs: string;
  model: string;
};

export type GenerateVocabularyRequest = {
  mode: 'generate';
  motherTongue?: MotherTongue;
  topic: string;
  count: number;
  level: CefrLevel;
  focus: AiVocabularyFocus;
  includeMnemonics: boolean;
};

export type ExtractVocabularyRequest = {
  mode: 'extract';
  motherTongue?: MotherTongue;
  text: string;
  count: number;
  level: CefrLevel;
  includeMnemonics: boolean;
};

export type EnrichVocabularyRequest = {
  mode: 'enrich';
  motherTongue?: MotherTongue;
  note: Pick<
    Note,
    | 'german'
    | 'czech'
    | 'kind'
    | 'article'
    | 'plural'
    | 'acceptedGerman'
    | 'acceptedCzech'
    | 'tags'
    | 'exampleDe'
    | 'exampleCs'
    | 'cefr'
    | 'learningNote'
    | 'mnemonic'
    | 'verbForms'
  >;
};

export type AiVocabularyRequest =
  | GenerateVocabularyRequest
  | ExtractVocabularyRequest
  | EnrichVocabularyRequest;

export function aiItemToDraft(item: AiGeneratedVocabularyItem, sharedTag = ''): ImportedNoteDraft {
  const article = item.kind === 'noun' ? (item.article ?? undefined) : undefined;
  const german = item.kind === 'noun' ? stripLeadingArticle(item.german) : item.german.trim();
  return normalizeDraft({
    german,
    normalizedGerman: normalizeGermanKey(german, article),
    czech: item.czech.trim(),
    kind: item.kind,
    article,
    plural: item.plural?.trim() || undefined,
    acceptedGerman: item.acceptedGerman,
    acceptedCzech: item.acceptedCzech,
    tags: sharedTag.trim() ? [...item.tags, sharedTag] : item.tags,
    exampleDe: item.exampleDe?.trim() || undefined,
    exampleCs: item.exampleCs?.trim() || undefined,
    cefr: item.cefr,
    learningNote: item.learningNote?.trim() || undefined,
    mnemonic: item.mnemonic?.trim() || undefined,
    verbForms: item.verbForms
      ? {
          thirdPerson: item.verbForms.thirdPerson?.trim() || undefined,
          preterite: item.verbForms.preterite?.trim() || undefined,
          participle: item.verbForms.participle?.trim() || undefined,
          auxiliary: item.verbForms.auxiliary ?? undefined,
        }
      : undefined,
    source: 'ai',
    sourceLine: 1,
  });
}

export type AiSentenceEvaluationRequest = {
  motherTongue?: MotherTongue;
  german: string;
  czech: string;
  kind: LexemeKind;
  article?: Article;
  plural?: string;
  verbForms?: Note['verbForms'];
  sentence: string;
};

export type AiSentenceEvaluationResult = {
  accepted: boolean;
  targetUsedCorrectly: boolean;
  grammarScore: number;
  naturalnessScore: number;
  feedback: string;
  correctedSentence: string | null;
  czechMeaning: string;
  model: string;
};

export type AiCoachMessage = {
  role: 'coach' | 'learner';
  text: string;
};

type AiCoachRequestBase = {
  motherTongue?: MotherTongue;
  scenarioId: string;
  scenarioTitle: string;
  goal: string;
  level: CefrLevel;
  turn: number;
  maxTurns: number;
  message: string;
  focusWords: string[];
  history: AiCoachMessage[];
};

export type AiCoachConversationRequest = {
  mode: 'conversation';
} & AiCoachRequestBase;

export type AiCoachRepairRequest = {
  mode: 'repair';
  repair: {
    evidenceId: string;
    mistakeTag: MistakeTag;
  };
} & AiCoachRequestBase;

export type AiCoachRequest = AiCoachConversationRequest | AiCoachRepairRequest;

export type CoachDiagnosticConfidence = 'medium' | 'high';

export type CoachDiagnostic = {
  tag: MistakeTag;
  confidence: CoachDiagnosticConfidence;
};

export type AiCoachResult = {
  reply: string;
  accepted: boolean;
  outcome: 'accepted' | 'needs-support' | 'retry';
  score: number;
  feedback: string;
  correction: string | null;
  nextHint: string;
  missionProgress: number;
  diagnostics: CoachDiagnostic[];
  model: string;
};

export type AiStoryKnownWord = {
  german: string;
  czech: string;
  kind: LexemeKind;
  article?: Article;
  plural?: string;
  cefr: CefrLevel;
  learningNote?: string;
};

export type AiStoryWordRequest = {
  motherTongue?: MotherTongue;
  word: string;
  sentence: string;
  bookTitle: string;
  level: CefrLevel;
  known?: AiStoryKnownWord;
};

export type AiStoryWordResult = {
  word: string;
  contextMeaning: string;
  grammarNote: string;
  morphology: string;
  collocation: string;
  recallQuestion: string;
  registerNote: string | null;
  item: AiGeneratedVocabularyItem | null;
  available: boolean;
  model: string;
};

export type AiStorySelectionRequest = {
  motherTongue?: MotherTongue;
  action: 'translate' | 'explain';
  text: string;
  context: string;
  bookTitle: string;
  level: CefrLevel;
};

export type AiStorySelectionResult = {
  translationCs: string;
  explanationCs: string;
  grammarHighlights: string[];
  suggestedGerman: string;
  suggestedCzech: string;
  available: boolean;
  model: string;
};

export type AiContextLexeme = {
  noteId: string;
  german: string;
  czech: string;
  kind: LexemeKind;
  article?: Article;
  acceptedGerman: string[];
  acceptedCzech: string[];
  exampleDe?: string;
  exampleCs?: string;
};

export type AiContextDrillRequest = {
  motherTongue?: MotherTongue;
  chapterId?: string;
  level: CefrLevel;
  lexemes: AiContextLexeme[];
  objectiveIds: string[];
  mistakes: Array<{ tag: MistakeTag; count: number }>;
};

export type AiContextDrillType = 'translation' | 'cloze' | 'contrast' | 'word-order';

export type AiContextDrill = {
  id: string;
  type: AiContextDrillType;
  prompt: string;
  answer: string;
  acceptedAnswers: string[];
  explanation: string;
  sourceNoteIds: string[];
  objectiveIds: string[];
  provenance: 'ai' | 'demo-template';
};

export type AiContextDrillResult = {
  drills: AiContextDrill[];
  available: boolean;
  model: string;
};

export type AiAdaptiveHintRequest = {
  motherTongue?: MotherTongue;
  note: AiContextLexeme;
  submitted: string;
  objectiveIds: string[];
  mistakeTags: MistakeTag[];
  revealAnswer: boolean;
};

export type AiAdaptiveHintResult = {
  hint: string;
  rule: string;
  exampleDe: string;
  exampleCs: string;
  confidence: 'high' | 'medium' | 'low';
  sourceObjectiveIds: string[];
  model: string;
};
