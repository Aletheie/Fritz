import {
  containsLexicalForm,
  germanAdjectiveInflectionMatches,
  germanVerbInflectionMatches,
  lexicalTokens,
} from '../grading/lexical.ts';
import type { CourseWord } from './path.ts';

function normalizedForms(word: CourseWord): string[] {
  return [
    ...new Set(
      [
        word.german,
        word.article ? `${word.article} ${word.german}` : '',
        word.plural ?? '',
        word.verbForms?.thirdPerson ?? '',
        word.verbForms?.preterite ?? '',
        word.verbForms?.participle ?? '',
      ].filter(Boolean),
    ),
  ];
}

export function sentenceUsesCourseWord(sentence: string, words: CourseWord[]): boolean {
  const sentenceTokens = lexicalTokens(sentence);
  return words.some(
    (word) =>
      normalizedForms(word).some((form) => containsLexicalForm(sentenceTokens, form)) ||
      (word.kind === 'adjective' &&
        germanAdjectiveInflectionMatches(sentenceTokens, word.german)) ||
      (word.kind === 'verb' && germanVerbInflectionMatches(sentenceTokens, word.german)),
  );
}
