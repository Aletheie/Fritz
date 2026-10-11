import { localized } from '../../i18n/index.ts';
import { normalizeText } from '../grading/normalize.ts';
import { displayGerman } from '../vocabulary/display.ts';

import type { AiSentenceEvaluationResult } from '../ai/types.ts';
import type { ClozeExercise, ContextGrade, WordOrderExercise } from '../exercises/context.ts';
import type { VocabularyMatchingExercise } from '../exercises/matching.ts';
import type { masteryTier } from '../gamification.ts';
import type { GradeGermanResult } from '../grading/grade.ts';
import type {
  AnswerSignal,
  ExerciseKind,
  MotherTongue,
  Note,
  RatingKey,
  ReviewDisputeReason,
} from '../types.ts';
import type { StudyResult } from './types.ts';

/** A graded answer before the repository has awarded XP and scheduled the card. */
export type PendingStudyResult = Omit<StudyResult, 'xp'>;

/** Only first attempts are graded in the vocabulary study screen. */
const FIRST_ATTEMPT = 1;

function copy(language: MotherTongue, cs: string, en: string): string {
  return localized(language, { cs, en });
}

function contextSignal(
  exercise: ExerciseKind,
  submittedText: string,
  expectedText: string,
  grade: Pick<ContextGrade, 'exact' | 'keyboardEquivalent' | 'editDistance'>,
  wordCorrect: boolean,
  responseMs: number,
): AnswerSignal {
  return {
    exercise,
    submittedText,
    normalizedText: normalizeText(submittedText),
    expectedText,
    wordCorrect,
    articleCorrect: true,
    exact: grade.exact,
    keyboardEquivalent: grade.keyboardEquivalent,
    editDistance: grade.editDistance,
    responseMs,
    hintsUsed: 0,
    attempt: FIRST_ATTEMPT,
  };
}

export function typingResult(
  graded: GradeGermanResult,
  language: MotherTongue,
): PendingStudyResult {
  if (language !== 'en') return graded;
  return {
    ...graded,
    message: graded.correct
      ? 'Correct.'
      : graded.nearCorrect
        ? `Almost. The exact German answer is “${graded.expectedDisplay}”.`
        : `The correct German answer is “${graded.expectedDisplay}”.`,
  };
}

export function speakingResult(
  graded: GradeGermanResult,
  language: MotherTongue,
): PendingStudyResult {
  return {
    ...graded,
    message: graded.correct
      ? copy(language, 'Přepis je správně.', 'The transcript is correct.')
      : language === 'en'
        ? `The correct German answer is “${graded.expectedDisplay}”.`
        : graded.message,
    signal: { ...graded.signal, exercise: 'speaking' },
  };
}

export function choiceResult(
  graded: { rating: RatingKey; correct: boolean; signal: AnswerSignal },
  selected: Note,
  expected: Note,
  language: MotherTongue,
): PendingStudyResult {
  const selectedDisplay = displayGerman(selected);
  const expectedDisplay = displayGerman(expected);
  return {
    ...graded,
    expectedDisplay,
    message: graded.correct
      ? copy(language, 'Správná volba.', 'Correct choice.')
      : copy(
          language,
          `Vybrala jsi „${selectedDisplay}“. Správně je „${expectedDisplay}“.`,
          `You chose “${selectedDisplay}”. The correct answer is “${expectedDisplay}”.`,
        ),
  };
}

export function matchingResult(
  note: Note,
  exercise: VocabularyMatchingExercise,
  mistakes: number,
  responseMs: number,
  language: MotherTongue,
): PendingStudyResult {
  const expectedDisplay = displayGerman(note);
  return {
    rating: mistakes === 0 ? 'good' : 'hard',
    correct: true,
    nearCorrect: mistakes > 0,
    message:
      mistakes === 0
        ? copy(
            language,
            'Všechny dvojice propojené na první pokus.',
            'Every pair matched on the first try.',
          )
        : copy(
            language,
            `Všechny dvojice jsou spojené. Počet chybných pokusů: ${mistakes}.`,
            `All pairs matched. Incorrect attempts: ${mistakes}.`,
          ),
    expectedDisplay,
    signal: {
      exercise: 'matching',
      submittedText: copy(
        language,
        `${exercise.pairs.length} propojené dvojice`,
        `${exercise.pairs.length} matched pairs`,
      ),
      normalizedText: exercise.pairs.map((pair) => pair.id).join(' '),
      expectedText: expectedDisplay,
      wordCorrect: true,
      articleCorrect: true,
      exact: mistakes === 0,
      keyboardEquivalent: false,
      editDistance: mistakes,
      responseMs,
      hintsUsed: mistakes,
      attempt: FIRST_ATTEMPT,
    },
  };
}

export function wordOrderResult(
  graded: ContextGrade,
  exercise: WordOrderExercise,
  submitted: string,
  responseMs: number,
  language: MotherTongue,
): PendingStudyResult {
  return {
    rating: graded.rating,
    correct: graded.correct,
    nearCorrect: graded.nearCorrect,
    message: graded.correct
      ? copy(language, 'Slovosled sedí.', 'The word order is correct.')
      : graded.nearCorrect
        ? copy(
            language,
            `Skoro. Správné pořadí je „${exercise.sourceText}“.`,
            `Almost. The correct order is “${exercise.sourceText}”.`,
          )
        : copy(
            language,
            `Správné pořadí je „${exercise.sourceText}“.`,
            `The correct order is “${exercise.sourceText}”.`,
          ),
    expectedDisplay: exercise.sourceText,
    signal: contextSignal(
      'word-order',
      submitted,
      exercise.sourceText,
      graded,
      graded.correct,
      responseMs,
    ),
  };
}

export function clozeResult(
  graded: ContextGrade,
  exercise: ClozeExercise,
  submitted: string,
  responseMs: number,
  language: MotherTongue,
): PendingStudyResult {
  const acceptedAsCorrect = graded.exact || graded.keyboardEquivalent;
  return {
    rating: graded.rating,
    correct: acceptedAsCorrect,
    nearCorrect: graded.nearCorrect,
    message: graded.exact
      ? copy(language, 'Výraz do kontextu sedí.', 'The expression fits the context.')
      : graded.keyboardEquivalent
        ? copy(
            language,
            `Význam sedí. Přesný zápis je „${exercise.answer}“.`,
            `The meaning is right. The exact spelling is “${exercise.answer}”.`,
          )
        : graded.nearCorrect
          ? copy(
              language,
              `Téměř. Správně je „${exercise.answer}“.`,
              `Almost. The correct answer is “${exercise.answer}”.`,
            )
          : copy(
              language,
              `Do mezery patří „${exercise.answer}“.`,
              `The gap needs “${exercise.answer}”.`,
            ),
    expectedDisplay: exercise.answer,
    signal: contextSignal(
      'cloze',
      submitted,
      exercise.answer,
      graded,
      acceptedAsCorrect,
      responseMs,
    ),
  };
}

function sentenceScore(evaluation: AiSentenceEvaluationResult): number {
  return (evaluation.grammarScore + evaluation.naturalnessScore) / 2;
}

export function sentenceRating(evaluation: AiSentenceEvaluationResult): RatingKey {
  if (!evaluation.accepted || !evaluation.targetUsedCorrectly) return 'again';
  return sentenceScore(evaluation) >= 85 ? 'good' : 'hard';
}

export function sentenceResult(
  evaluation: AiSentenceEvaluationResult,
  note: Note,
  sentence: string,
  responseMs: number,
): PendingStudyResult {
  const rating = sentenceRating(evaluation);
  const expectedDisplay = displayGerman(note);
  return {
    rating,
    correct: rating !== 'again',
    nearCorrect: rating === 'hard',
    message: evaluation.feedback,
    expectedDisplay,
    aiSentenceEvaluation: evaluation,
    signal: {
      exercise: 'sentence',
      submittedText: sentence.trim(),
      normalizedText: normalizeText(sentence),
      expectedText: expectedDisplay,
      wordCorrect: evaluation.targetUsedCorrectly,
      articleCorrect: evaluation.targetUsedCorrectly,
      exact:
        evaluation.accepted &&
        evaluation.targetUsedCorrectly &&
        evaluation.grammarScore >= 95 &&
        evaluation.naturalnessScore >= 90,
      keyboardEquivalent: false,
      editDistance: 0,
      responseMs,
      hintsUsed: 0,
      attempt: FIRST_ATTEMPT,
      aiAccepted: evaluation.accepted,
      aiScore: Math.round(sentenceScore(evaluation)),
    },
  };
}

export function disputedResult(
  previous: StudyResult,
  reason: ReviewDisputeReason,
  language: MotherTongue,
): StudyResult {
  return {
    ...previous,
    disputed: true,
    disputeReason: reason,
    xp: 0,
    scheduledFor: undefined,
    message:
      reason === 'content-error'
        ? copy(
            language,
            'Položka je označená ke kontrole a tahle odpověď se nepočítá do učení ani XP.',
            'The item is flagged for review, and this answer does not count toward learning or XP.',
          )
        : copy(
            language,
            'Hodnocení je vyřazené z učení i XP. Původní termín karty byl obnoven.',
            'This result won’t affect learning or XP. The card’s previous review date has been restored.',
          ),
  };
}

/** A clean answer keeps the combo going: correct, unaided and first try. */
export function isCleanAnswer(result: Pick<StudyResult, 'correct' | 'signal'>): boolean {
  return result.correct && result.signal.hintsUsed === 0 && result.signal.attempt === 1;
}

export function hintText(note: Note, language: MotherTongue): string {
  const characters = Array.from(note.german.replace(/\s+/gu, ''));
  const first = Array.from(note.german.trim())[0] ?? '';
  const words = note.german.trim().split(/\s+/u).length;
  return words > 1
    ? copy(
        language,
        `Začíná na „${first}“ a má ${words} slova.`,
        `It starts with “${first}” and has ${words} words.`,
      )
    : copy(
        language,
        `Začíná na „${first}“ a má ${characters.length} písmen.`,
        `It starts with “${first}” and has ${characters.length} letters.`,
      );
}

export function formatWait(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1_000);
  return seconds < 60
    ? `${seconds} s`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const masteryLabels = {
  new: { cs: 'Nové', en: 'New' },
  learning: { cs: 'Rozpracované', en: 'Learning' },
  familiar: { cs: 'Známé', en: 'Familiar' },
  strong: { cs: 'Pevné', en: 'Strong' },
  mastered: { cs: 'Zvládnuté', en: 'Mastered' },
} as const;

export function masteryLabel(tier: ReturnType<typeof masteryTier>, language: MotherTongue): string {
  return localized(language, masteryLabels[tier]);
}

const exerciseLabels: Record<ExerciseKind, { cs: string; en: string }> = {
  typing: { cs: 'aktivní vybavení', en: 'active recall' },
  choice: { cs: 'rychlé rozpoznání', en: 'quick recognition' },
  flashcard: { cs: 'vlastní hodnocení', en: 'self-rating' },
  'word-order': { cs: 'skládání vět', en: 'word-order lab' },
  cloze: { cs: 'doplnění slova', en: 'context gap' },
  sentence: { cs: 'vlastní věta s AI', en: 'your own sentence with AI' },
  matching: { cs: 'slovní spojovačka', en: 'word matching' },
  speaking: { cs: 'mluvení nahlas', en: 'speaking aloud' },
};

export function exerciseLabel(kind: ExerciseKind, language: MotherTongue): string {
  return localized(language, exerciseLabels[kind]);
}
