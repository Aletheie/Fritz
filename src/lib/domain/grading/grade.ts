import { damerauLevenshtein, typoThreshold } from './distance.ts';
import { foldGermanKeyboardCharacters, normalizeText, parseGermanAnswer } from './normalize.ts';

import type { AnswerSignal, Article, RatingKey } from '../types.ts';

export type GradeGermanInput = {
  expectedGerman: string;
  acceptedGerman?: string[];
  expectedArticle?: Article;
  selectedArticle?: Article;
  submittedText: string;
  responseMs: number;
  hintsUsed?: number;
  attempt?: number;
  allowKeyboardFallback?: boolean;
  isMatureCard?: boolean;
};

export type GradeGermanResult = {
  rating: RatingKey;
  correct: boolean;
  nearCorrect: boolean;
  message: string;
  expectedDisplay: string;
  signal: AnswerSignal;
};

function expectedTiming(
  answerLength: number,
  hasArticle: boolean,
): {
  fastMs: number;
  slowMs: number;
} {
  const articleAllowance = hasArticle ? 700 : 0;
  return {
    fastMs: 1_200 + answerLength * 180 + articleAllowance,
    slowMs: 4_500 + answerLength * 420 + articleAllowance,
  };
}

export function gradeGermanAnswer(input: GradeGermanInput): GradeGermanResult {
  const parsedSubmission = parseGermanAnswer(input.submittedText);
  const selectedArticle = input.selectedArticle ?? parsedSubmission.article;
  const expected = parseGermanAnswer(input.expectedGerman);
  const expectedWord = expected.word;
  const expectedArticle = input.expectedArticle ?? expected.article;
  const normalizedSubmitted = normalizeText(parsedSubmission.word);

  const acceptedWords: string[] = [];
  for (const variant of [expectedWord, ...(input.acceptedGerman ?? [])]) {
    const word = parseGermanAnswer(variant).word;
    if (word) acceptedWords.push(word);
  }

  const exact = acceptedWords.includes(normalizedSubmitted);
  const foldedSubmitted = foldGermanKeyboardCharacters(normalizedSubmitted);
  const keyboardEquivalent =
    !exact &&
    Boolean(input.allowKeyboardFallback ?? true) &&
    acceptedWords.some((variant) => foldGermanKeyboardCharacters(variant) === foldedSubmitted);
  let editDistance = exact
    ? 0
    : acceptedWords.length > 0
      ? Number.POSITIVE_INFINITY
      : normalizedSubmitted.length;
  if (!exact) {
    for (const variant of acceptedWords) {
      editDistance = Math.min(editDistance, damerauLevenshtein(variant, normalizedSubmitted));
    }
  }
  const nearCorrect =
    !exact &&
    !keyboardEquivalent &&
    editDistance <= typoThreshold(Math.max(expectedWord.length, normalizedSubmitted.length));

  const wordCorrect = exact || keyboardEquivalent;
  const articleCorrect = expectedArticle ? selectedArticle === expectedArticle : true;
  const contentCorrect = wordCorrect && articleCorrect;
  const recallSucceeded = (wordCorrect || nearCorrect) && articleCorrect;
  const hintsUsed = input.hintsUsed ?? 0;
  const attempt = input.attempt ?? 1;
  const { fastMs, slowMs } = expectedTiming(expectedWord.length, Boolean(expectedArticle));

  let rating: RatingKey;
  if (!recallSucceeded) {
    rating = 'again';
  } else if (
    nearCorrect ||
    keyboardEquivalent ||
    hintsUsed > 0 ||
    attempt > 1 ||
    input.responseMs > slowMs
  ) {
    rating = 'hard';
  } else if (input.isMatureCard && input.responseMs < fastMs) {
    rating = 'easy';
  } else {
    rating = 'good';
  }

  let message = 'Správně.';
  if (!articleCorrect && wordCorrect) {
    message = `Slovo sedí, ale správný člen je ${expectedArticle}.`;
  } else if (!wordCorrect && articleCorrect && nearCorrect) {
    message = `Téměř. Zkontroluj zápis „${expectedWord}“ a napiš ho znovu.`;
  } else if (!wordCorrect && articleCorrect) {
    message = `Ještě jednou. Správná odpověď je „${expectedWord}“.`;
  } else if (!articleCorrect && !wordCorrect) {
    message = `Nesedí slovo ani člen. Správně je „${expectedArticle} ${expectedWord}“.`;
  } else if (keyboardEquivalent) {
    message = `Význam sedí. Přesný německý zápis je „${expectedWord}“.`;
  } else if (rating === 'hard') {
    message = 'Správně, ale s nápovědou nebo pomaleji. Brzy se vrátí.';
  } else if (rating === 'easy') {
    message = 'Přesně a bez váhání.';
  }

  const expectedDisplay = expectedArticle
    ? `${expectedArticle} ${input.expectedGerman.replace(/^(der|die|das)\s+/iu, '')}`
    : input.expectedGerman;

  return {
    rating,
    correct: contentCorrect,
    nearCorrect,
    message,
    expectedDisplay,
    signal: {
      exercise: 'typing',
      submittedText: input.submittedText,
      normalizedText: normalizedSubmitted,
      selectedArticle,
      wordCorrect,
      articleCorrect,
      exact,
      keyboardEquivalent,
      editDistance,
      responseMs: Math.max(0, input.responseMs),
      hintsUsed,
      attempt,
    },
  };
}

export function gradeChoiceAnswer(input: {
  selected: string;
  expected: string;
  responseMs: number;
}): { rating: RatingKey; correct: boolean; signal: AnswerSignal; message: string } {
  const correct = input.selected === input.expected;
  const rating: RatingKey = !correct ? 'again' : input.responseMs > 8_000 ? 'hard' : 'good';

  return {
    rating,
    correct,
    message: correct ? 'Správná volba.' : `Správně je „${input.expected}“.`,
    signal: {
      exercise: 'choice',
      selectedChoice: input.selected,
      wordCorrect: correct,
      articleCorrect: true,
      exact: correct,
      keyboardEquivalent: false,
      editDistance: correct ? 0 : 1,
      responseMs: Math.max(0, input.responseMs),
      hintsUsed: 0,
      attempt: 1,
    },
  };
}

export function signalForFlashcard(rating: RatingKey, responseMs: number): AnswerSignal {
  return {
    exercise: 'flashcard',
    wordCorrect: rating !== 'again',
    articleCorrect: rating !== 'again',
    exact: rating === 'good' || rating === 'easy',
    keyboardEquivalent: false,
    editDistance: rating === 'again' ? 1 : 0,
    responseMs: Math.max(0, responseMs),
    hintsUsed: 0,
    attempt: 1,
  };
}
