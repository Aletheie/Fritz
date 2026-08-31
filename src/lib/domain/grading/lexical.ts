import { normalizeText } from './normalize.ts';

const WORD_TOKEN = /[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu;
const SEPARABLE_PREFIXES = [
  'auseinander',
  'zurück',
  'zusammen',
  'vorbei',
  'weiter',
  'dazu',
  'gegen',
  'herein',
  'heraus',
  'hinein',
  'hinaus',
  'klar',
  'nahe',
  'offen',
  'statt',
  'fest',
  'frei',
  'nach',
  'rück',
  'weh',
  'ab',
  'an',
  'auf',
  'aus',
  'ein',
  'her',
  'hin',
  'los',
  'mit',
  'um',
  'vor',
  'weg',
  'zu',
] as const;

export function lexicalTokens(value: string): string[] {
  return normalizeText(value).match(WORD_TOKEN) ?? [];
}

export function containsLexicalForm(tokens: readonly string[], form: string): boolean {
  const formTokens = lexicalTokens(form);
  if (formTokens.length === 0 || formTokens.length > tokens.length) return false;
  return tokens.some((_, start) =>
    formTokens.every((token, offset) => tokens[start + offset] === token),
  );
}

export function germanVerbInflectionMatches(
  sentenceTokens: readonly string[],
  rawInfinitive: string,
): boolean {
  const infinitiveTokens = lexicalTokens(rawInfinitive);
  const infinitive = infinitiveTokens.at(-1);
  if (!infinitive) return false;

  const prefix = SEPARABLE_PREFIXES.find(
    (candidate) => infinitive.startsWith(candidate) && infinitive.length > candidate.length + 4,
  );
  const bareInfinitive = prefix ? infinitive.slice(prefix.length) : infinitive;
  const stem = bareInfinitive.replace(/(?:en|n)$/u, '');
  if (stem.length < 3) return false;

  const inflectedForms = new Set(
    ['e', 'est', 'st', 't', 'en', 'n', 'et'].map((ending) => `${stem}${ending}`),
  );
  const hasInflection = sentenceTokens.some((token) => inflectedForms.has(token));
  const hasPrefix = !prefix || sentenceTokens.includes(prefix);
  const reflexive = infinitiveTokens.includes('sich');
  const hasReflexivePronoun =
    !reflexive ||
    sentenceTokens.some((token) => ['mich', 'dich', 'sich', 'uns', 'euch'].includes(token));
  return hasInflection && hasPrefix && hasReflexivePronoun;
}

export function germanAdjectiveInflectionMatches(
  sentenceTokens: readonly string[],
  rawAdjective: string,
): boolean {
  const adjectiveTokens = lexicalTokens(rawAdjective);
  if (adjectiveTokens.length !== 1) return false;
  const adjective = adjectiveTokens[0];
  const inflectedForms = new Set(
    ['e', 'en', 'er', 'es', 'em'].map((ending) => `${adjective}${ending}`),
  );
  return sentenceTokens.some((token) => inflectedForms.has(token));
}
