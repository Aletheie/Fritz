import { sourceMeaning } from '$lib/i18n/vocabulary.ts';

import type { MotherTongue, Note } from '../types.ts';
import type { AiContextLexeme } from './types.ts';

/** The subset of a note sent to AI features, localised to the learner's language. */
export function noteAsLexeme(note: Note, language: MotherTongue): AiContextLexeme {
  return {
    noteId: note.id,
    german: note.german,
    czech: sourceMeaning(note.german, note.czech, language),
    kind: note.kind,
    article: note.article,
    acceptedGerman: note.acceptedGerman,
    acceptedCzech: language === 'cs' ? note.acceptedCzech : [],
    exampleDe: note.exampleDe,
    exampleCs: language === 'cs' ? note.exampleCs : undefined,
  };
}
