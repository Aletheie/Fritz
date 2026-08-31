import type { Article } from '../types.ts';

const LEADING_ARTICLE = /^(der|die|das)\s+/iu;
const EDGE_PUNCTUATION = /^[\s.,!?;:„“”"'()[\]{}]+|[\s.,!?;:„“”"'()[\]{}]+$/gu;

export type ParsedGermanAnswer = {
  article?: Article;
  word: string;
};

export function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE')
    .replace(/[’‘`´]/gu, "'")
    .replace(/[‐‑‒–—]/gu, '-')
    .replace(EDGE_PUNCTUATION, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function parseGermanAnswer(value: string): ParsedGermanAnswer {
  const normalized = normalizeText(value);
  const match = normalized.match(LEADING_ARTICLE);

  if (!match) {
    return { word: normalized };
  }

  return {
    article: match[1] as Article,
    word: normalized.replace(LEADING_ARTICLE, '').trim(),
  };
}

export function keyboardFoldGerman(value: string): string {
  return foldGermanKeyboardCharacters(normalizeText(value));
}

export function foldGermanKeyboardCharacters(value: string): string {
  return value
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss');
}

export function normalizeGermanKey(german: string, article?: Article): string {
  const parsed = parseGermanAnswer(german);
  const effectiveArticle = article ?? parsed.article;
  return `${effectiveArticle ?? ''}:${keyboardFoldGerman(parsed.word)}`;
}

export function stripLeadingArticle(value: string): string {
  return parseGermanAnswer(value).word;
}
