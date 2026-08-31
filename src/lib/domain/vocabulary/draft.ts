import { normalizeGermanKey } from '../grading/normalize.ts';
import type { ImportedNoteDraft, Note, VerbForms } from '../types.ts';

export function createEmptyDraft(
  source: ImportedNoteDraft['source'] = 'manual',
): ImportedNoteDraft {
  return {
    german: '',
    normalizedGerman: '',
    czech: '',
    kind: 'noun',
    article: undefined,
    acceptedGerman: [],
    acceptedCzech: [],
    tags: [],
    source,
    sourceLine: 1,
  };
}

export function normalizeDraft(draft: ImportedNoteDraft): ImportedNoteDraft {
  const german = draft.german.trim();
  const czech = draft.czech.trim();
  const article = draft.kind === 'noun' ? draft.article : undefined;
  const plural = draft.kind === 'noun' ? draft.plural?.trim() || undefined : undefined;
  const verbForms = draft.kind === 'verb' ? normalizeVerbForms(draft.verbForms) : undefined;
  return {
    ...draft,
    german,
    czech,
    article,
    plural,
    acceptedGerman: uniqueTrimmed(draft.acceptedGerman),
    acceptedCzech: uniqueTrimmed(draft.acceptedCzech),
    tags: uniqueTrimmed(draft.tags.map((tag) => tag.toLocaleLowerCase('cs-CZ'))),
    exampleDe: draft.exampleDe?.trim() || undefined,
    exampleCs: draft.exampleCs?.trim() || undefined,
    learningNote: draft.learningNote?.trim() || undefined,
    mnemonic: draft.mnemonic?.trim() || undefined,
    verbForms,
    normalizedGerman: normalizeGermanKey(german, article),
  };
}

function normalizeVerbForms(forms: VerbForms | undefined): VerbForms | undefined {
  if (!forms) return undefined;
  const normalized: VerbForms = {
    thirdPerson: forms.thirdPerson?.trim() || undefined,
    preterite: forms.preterite?.trim() || undefined,
    participle: forms.participle?.trim() || undefined,
    auxiliary: forms.auxiliary,
  };
  return Object.values(normalized).some(Boolean) ? normalized : undefined;
}

export function draftFromNote(note: Note): ImportedNoteDraft {
  return {
    german: note.german,
    normalizedGerman: note.normalizedGerman,
    czech: note.czech,
    kind: note.kind,
    article: note.article,
    plural: note.plural,
    acceptedGerman: [...note.acceptedGerman],
    acceptedCzech: [...note.acceptedCzech],
    tags: [...note.tags],
    exampleDe: note.exampleDe,
    exampleCs: note.exampleCs,
    cefr: note.cefr,
    learningNote: note.learningNote,
    mnemonic: note.mnemonic,
    verbForms: note.verbForms ? { ...note.verbForms } : undefined,
    source: note.source,
    sourceLine: 1,
  };
}

export function uniqueTrimmed(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase('de-DE');
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
