import type { Article, Note } from '../types.ts';

export function displayGerman(value: Pick<Note, 'article' | 'german'>): string {
  return `${value.article ? `${value.article} ` : ''}${value.german}`;
}

export function displayPlural(plural?: string): string | undefined {
  if (!plural || /^[-–—]$/u.test(plural.trim())) return undefined;
  return /^die\s/iu.test(plural) ? plural : `die ${plural}`;
}

export function articleLabel(article?: Article): string {
  if (article === 'der') return 'mužský rod';
  if (article === 'die') return 'ženský rod';
  if (article === 'das') return 'střední rod';
  return 'bez členu';
}
