import { masteryTier } from '../../domain/gamification.ts';
import { displayGerman } from '../../domain/vocabulary/display.ts';
import { sortedVocabularyTags } from '../../domain/vocabulary/tags.ts';
import { noteSearchText } from '../../i18n/vocabulary.ts';

import type { LexemeKind, MotherTongue, Note, StudyCard } from '../../domain/types.ts';

export type LibraryKindFilter = 'all' | LexemeKind;
export type LibrarySortMode = 'recent' | 'alphabetical' | 'mastery' | 'due';
export type LibraryFilters = {
  query: string;
  kind: LibraryKindFilter;
  tag: string;
  sort: LibrarySortMode;
};
type LibraryEntry = {
  note: Note;
  searchText: string;
  display: string;
  mastery: number;
  dueAt: number;
};
export type LibraryIndex = {
  entries: LibraryEntry[];
  noteById: Map<string, Note>;
  cardByNoteId: Map<string, StudyCard>;
  tags: string[];
};

const germanCollator = new Intl.Collator('de');
const masteryRanks = { new: 0, learning: 1, familiar: 2, strong: 3, mastered: 4 } as const;

export function buildLibraryIndex(
  notes: Note[],
  cards: StudyCard[],
  language: MotherTongue,
): LibraryIndex {
  const cardByNoteId = new Map<string, StudyCard>();
  for (const card of cards) {
    if (!cardByNoteId.has(card.noteId)) cardByNoteId.set(card.noteId, card);
  }
  return {
    cardByNoteId,
    noteById: new Map(notes.map((note) => [note.id, note])),
    tags: sortedVocabularyTags(notes, language === 'cs' ? 'cs-CZ' : 'en'),
    entries: notes.map((note) => {
      const card = cardByNoteId.get(note.id);
      const dueAt = Date.parse(card?.dueAt ?? '');
      return {
        note,
        searchText: noteSearchText(note, language),
        display: displayGerman(note),
        mastery: card ? masteryRanks[masteryTier(card)] : 0,
        dueAt: Number.isFinite(dueAt) ? dueAt : Number.NEGATIVE_INFINITY,
      };
    }),
  };
}

export function selectLibraryNotes(index: LibraryIndex, filters: LibraryFilters): Note[] {
  const query = filters.query.trim().toLocaleLowerCase('cs-CZ');
  const entries = index.entries.filter(
    ({ note, searchText }) =>
      (filters.kind === 'all' || note.kind === filters.kind) &&
      (filters.tag === 'all' || note.tags.includes(filters.tag)) &&
      (!query || searchText.includes(query)),
  );
  entries.sort((left, right) => {
    if (filters.sort === 'alphabetical') return germanCollator.compare(left.display, right.display);
    if (filters.sort === 'mastery')
      return (
        left.mastery - right.mastery || germanCollator.compare(left.note.german, right.note.german)
      );
    if (filters.sort === 'due')
      return (
        left.dueAt - right.dueAt || germanCollator.compare(left.note.german, right.note.german)
      );
    return right.note.updatedAt.localeCompare(left.note.updatedAt);
  });
  return entries.map((entry) => entry.note);
}
