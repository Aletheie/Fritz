import { grammarOptionCopy } from '../../i18n/grammar.ts';
import { localized } from '../../i18n/index.ts';
import { normalizeText } from '../grading/normalize.ts';

import type { GrammarQuestion } from '../course/grammar.ts';
import type { AnswerSignal, MotherTongue, Note, RatingKey } from '../types.ts';
import type {
  DailySessionRecord,
  EvidenceModality,
  LearningEvidence,
  LessonActivity,
} from './types.ts';

/** The learner's current answer to a daily grammar question. */
export type GrammarDraft = {
  choice: string;
  text: string;
  orderIndexes: readonly number[];
};

export type MeaningGrade = {
  correct: boolean;
  rating: RatingKey;
  signal: AnswerSignal;
  message: string;
};

/** German → meaning recall: exact match against the meaning and its accepted variants. */
export function gradeMeaning(
  note: Note,
  submitted: string,
  responseMs: number,
  hintsUsed: number,
  language: MotherTongue,
): MeaningGrade {
  const normalized = normalizeText(submitted);
  const correct = [note.czech, ...note.acceptedCzech].map(normalizeText).includes(normalized);
  return {
    correct,
    rating: correct ? 'good' : 'again',
    message: correct
      ? localized(language, {
          cs: 'Význam sis vybavila bez nápovědy.',
          en: 'You recalled the meaning without a hint.',
        })
      : localized(language, {
          cs: 'Význam nesedí. Tohle slovo si ještě zopakuješ.',
          en: 'The meaning isn’t right. You’ll practise this word again.',
        }),
    signal: {
      exercise: 'typing',
      submittedText: submitted,
      normalizedText: normalized,
      expectedText: note.czech,
      wordCorrect: correct,
      articleCorrect: true,
      exact: correct,
      keyboardEquivalent: false,
      editDistance: correct ? 0 : 1,
      responseMs,
      hintsUsed,
      attempt: 1,
    },
  };
}

export function orderedGrammarAnswer(question: GrammarQuestion, draft: GrammarDraft): string {
  return question.kind === 'order'
    ? draft.orderIndexes.map((index) => question.tokens[index]).join(' ')
    : '';
}

export function grammarAnswerIsReady(question: GrammarQuestion, draft: GrammarDraft): boolean {
  if (question.kind === 'choice') return Boolean(draft.choice);
  if (question.kind === 'fill') return Boolean(draft.text.trim());
  return draft.orderIndexes.length === question.tokens.length;
}

export function grammarAnswerIsCorrect(question: GrammarQuestion, draft: GrammarDraft): boolean {
  if (question.kind === 'choice') return draft.choice === question.answer;
  if (question.kind === 'fill') {
    return question.answers.map(normalizeText).includes(normalizeText(draft.text));
  }
  return question.answer.join(' ') === orderedGrammarAnswer(question, draft);
}

export function expectedGrammarAnswer(question: GrammarQuestion, language: MotherTongue): string {
  if (question.kind === 'choice') return grammarOptionCopy(language, question.answer);
  if (question.kind === 'fill') return question.answers[0];
  return question.answer.join(' ');
}

/** Toggles a token in or out of the ordered answer, keeping selection order. */
export function toggleOrderIndex(indexes: readonly number[], index: number): number[] {
  return indexes.includes(index)
    ? indexes.filter((candidate) => candidate !== index)
    : [...indexes, index];
}

/**
 * Evidence for daily activities that do not go through the review or course-answer
 * commands. IDs derive from the session and activity, so a retried save is idempotent.
 */
export function dailyActivityEvidence(input: {
  session: DailySessionRecord;
  activity: LessonActivity;
  source: LearningEvidence['source'];
  sourceId: string;
  modality: EvidenceModality;
  correct: boolean;
  independent: boolean;
  hintsUsed: number;
  responseMs: number;
  occurredAt: Date;
  mistakeTags?: LearningEvidence['mistakeTags'];
  repairOfEvidenceId?: string;
}): LearningEvidence {
  const { session, activity } = input;
  return {
    id: `evidence:daily:${session.key}:${activity.id}`,
    operationId: `daily:${session.key}:${activity.id}`,
    activityId: activity.id,
    source: input.source,
    sourceId: input.sourceId,
    skillIds: [...activity.skillIds],
    occurredAt: input.occurredAt.toISOString(),
    localDay: session.plan.localDay,
    mode: 'long-term',
    modality: input.modality,
    outcome: input.correct ? 'correct' : 'incorrect',
    hintsUsed: input.hintsUsed,
    responseMs: input.responseMs,
    independent: input.independent,
    mistakeTags: input.mistakeTags ? [...input.mistakeTags] : undefined,
    repairOfEvidenceId: input.repairOfEvidenceId,
  };
}
