export type CaseCopy = { cs: string; en: string };
export type CaseId = 'backpack' | 'soundcheck' | 'empty-frame';
export type CaseChoiceId = 'a' | 'b' | 'c';
export type CaseFeedback = 'choice' | 'evidence' | 'correct';

export type CaseDocument = {
  id: string;
  title: CaseCopy;
  kind: 'message' | 'notice' | 'poster';
  bylineDe: string;
  availableFrom?: number;
  lines: Array<{ id: string; textDe: string }>;
  glossary: Array<{ de: string; meaning: CaseCopy }>;
};

export type CaseStep = {
  title: CaseCopy;
  question: CaseCopy;
  context: CaseCopy;
  finding: CaseCopy;
  startDocumentId?: string;
  promptDe: string;
  choices: Array<{ id: CaseChoiceId; textDe: string; feedback: CaseCopy }>;
  hint: CaseCopy;
  explanation: CaseCopy;
  replyDe: string;
  language: { de: string; explanation: CaseCopy };
};

export type CaseFile = {
  id: CaseId;
  title: CaseCopy;
  level: 'A2' | 'B1';
  minutes: number;
  introduction: CaseCopy;
  previewDe: string;
  focus: CaseCopy;
  documents: CaseDocument[];
  steps: CaseStep[];
  endingDe: string;
  takeaway: CaseCopy;
  reconstruction?: Array<{ time: string; event: CaseCopy }>;
};

export type CaseStepProgress = {
  choiceId?: CaseChoiceId;
  clueIds: string[];
  hintUsed: boolean;
  attempts: number;
  feedback?: CaseFeedback;
};

export type CaseProgress = {
  revision: number;
  stepIndex: number;
  answers: CaseStepProgress[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  firstCompletedAt?: string;
};
export type CaseProgressMap = Partial<Record<CaseId, CaseProgress>>;

export type CaseStage = 'read' | 'answer' | 'evidence' | 'feedback';
export type CaseEvidence = { id: string; textDe: string; source: string };

export type CaseCommand =
  | { type: 'choose'; choiceId: CaseChoiceId }
  | { type: 'evidence'; clueId: string }
  | { type: 'hint' | 'submit' | 'continue' | 'restart' };
export type CaseAction = CaseCommand & { caseId: CaseId; revision: number };
