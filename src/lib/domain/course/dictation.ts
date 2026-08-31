import { lexicalTokens } from '../grading/lexical.ts';
import { keyboardFoldGerman } from '../grading/normalize.ts';

export type CourseDictationGrade = {
  correct: boolean;
  exact: boolean;
  keyboardEquivalent: boolean;
  submittedWordCount: number;
  expectedWordCount: number;
};

function audibleText(value: string): string {
  return lexicalTokens(value).join(' ');
}

/**
 * Dictation checks the words that were heard, not punctuation or letter case.
 * Common German keyboard substitutions (ae/oe/ue/ss) remain accepted so the
 * exercise measures listening even on a Czech keyboard.
 */
export function gradeCourseDictation(submitted: string, expected: string): CourseDictationGrade {
  const submittedText = audibleText(submitted);
  const expectedText = audibleText(expected);
  const exact = submittedText === expectedText;
  const keyboardEquivalent =
    !exact && keyboardFoldGerman(submittedText) === keyboardFoldGerman(expectedText);

  return {
    correct: exact || keyboardEquivalent,
    exact,
    keyboardEquivalent,
    submittedWordCount: lexicalTokens(submitted).length,
    expectedWordCount: lexicalTokens(expected).length,
  };
}

export function courseDictationWordCount(sentence: string): number {
  return lexicalTokens(sentence).length;
}
