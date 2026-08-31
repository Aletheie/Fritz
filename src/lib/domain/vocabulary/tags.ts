import type { Note } from '../types.ts';

export function sortedVocabularyTags(
  notes: readonly Pick<Note, 'tags'>[],
  locale: string,
): string[] {
  const tags = new Set<string>();
  for (const note of notes) {
    for (const tag of note.tags) tags.add(tag);
  }
  return [...tags].toSorted((left, right) => left.localeCompare(right, locale));
}
