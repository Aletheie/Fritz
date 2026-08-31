import { createId } from '../id.ts';

import type { Note, StudyCard } from '../types.ts';

export function createNoteAndCard(
  deckId: string,
  input: Omit<Note, 'id' | 'deckId' | 'createdAt' | 'updatedAt'>,
  now = new Date(),
): { note: Note; card: StudyCard } {
  const timestamp = now.toISOString();
  const note: Note = {
    ...input,
    id: createId('note'),
    deckId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const card: StudyCard = {
    id: createId('card'),
    deckId,
    noteId: note.id,
    direction: 'cs-de',
    dueAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { note, card };
}
