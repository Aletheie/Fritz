import type { Note } from '../types.ts';

export function displayGerman(value: Pick<Note, 'article' | 'german'>): string {
  return `${value.article ? `${value.article} ` : ''}${value.german}`;
}

export function displayPlural(plural?: string): string | undefined {
  if (!plural || /^[-–—]$/u.test(plural.trim())) return undefined;
  return /^die\s/iu.test(plural) ? plural : `die ${plural}`;
}
