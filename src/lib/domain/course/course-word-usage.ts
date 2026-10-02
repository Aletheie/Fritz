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

function expandedContractions(value: string): string {
  return value.replace(/(?<!\p{L})(?:zum|zur)(?!\p{L})/giu, (token) =>
    token.toLocaleLowerCase('de') === 'zum' ? 'zu dem' : 'zu der',
  );
}

function separatedVerbFormMatches(tokens: readonly string[], word: CourseWord): boolean {
  if (word.kind !== 'verb' || !word.verbForms) return false;
  return [word.verbForms.thirdPerson, word.verbForms.preterite].some((form) => {
    const parts = lexicalTokens(form ?? '');
    if (parts.length < 2) return false;
    // Keep every part of a separable or reflexive form, even with intervening objects.
    return parts.every((part) =>
      part === 'sich'
        ? tokens.some((token) => ['mich', 'dich', 'sich', 'uns', 'euch'].includes(token))
        : tokens.includes(part),
    );
  });
}

export function sentenceUsesCourseWord(sentence: string, words: CourseWord[]): boolean {
  const sentenceTokens = lexicalTokens(expandedContractions(sentence));
  return words.some(
    (word) =>
      normalizedForms(word).some((form) =>
        containsLexicalForm(sentenceTokens, expandedContractions(form)),
      ) ||
      separatedVerbFormMatches(sentenceTokens, word) ||
      (word.kind === 'adjective' &&
        germanAdjectiveInflectionMatches(sentenceTokens, word.german)) ||
      ((word.kind === 'verb' || (word.kind === 'phrase' && /(?:en|ern|eln)$/u.test(word.german))) &&
        germanVerbInflectionMatches(sentenceTokens, word.german)),
  );
}
