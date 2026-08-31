import type { ImportedNoteDraft } from '../types.ts';

export const VOCABULARY_LIMITS = {
  german: 140,
  czech: 220,
  plural: 140,
  acceptedGerman: 20,
  acceptedCzech: 20,
  tags: 20,
  tag: 40,
  example: 300,
  learningNote: 320,
  mnemonic: 320,
  verbForm: 100,
} as const;

export function draftHasRequiredFields(draft: ImportedNoteDraft): boolean {
  return Boolean(
    draft.german.trim() && draft.czech.trim() && (draft.kind !== 'noun' || draft.article),
  );
}

export function vocabularyDraftIssues(draft: ImportedNoteDraft): string[] {
  const issues: string[] = [];
  const limits = VOCABULARY_LIMITS;

  if (!draft.german.trim()) issues.push('Chybí německý výraz.');
  if (!draft.czech.trim()) issues.push('Chybí český význam.');
  if (draft.kind === 'noun' && !draft.article) issues.push('Podstatné jméno musí mít člen.');
  if (draft.german.length > limits.german) issues.push('Německý výraz je příliš dlouhý.');
  if (draft.czech.length > limits.czech) issues.push('Český význam je příliš dlouhý.');
  if ((draft.plural?.length ?? 0) > limits.plural) issues.push('Množné číslo je příliš dlouhé.');
  if (draft.acceptedGerman.length > limits.acceptedGerman) {
    issues.push('Je zadaných příliš mnoho německých variant.');
  }
  if (draft.acceptedCzech.length > limits.acceptedCzech) {
    issues.push('Je zadaných příliš mnoho českých variant.');
  }
  if (draft.tags.length > limits.tags) issues.push('Je zadaných příliš mnoho tagů.');
  if (draft.acceptedGerman.some((value) => value.length > limits.german)) {
    issues.push('Jedna německá varianta je příliš dlouhá.');
  }
  if (draft.acceptedCzech.some((value) => value.length > limits.czech)) {
    issues.push('Jedna česká varianta je příliš dlouhá.');
  }
  if (draft.tags.some((value) => value.length > limits.tag)) {
    issues.push('Jeden tag je příliš dlouhý.');
  }
  if ((draft.exampleDe?.length ?? 0) > limits.example) {
    issues.push('Německý příklad je příliš dlouhý.');
  }
  if ((draft.exampleCs?.length ?? 0) > limits.example) {
    issues.push('Český překlad příkladu je příliš dlouhý.');
  }
  if ((draft.learningNote?.length ?? 0) > limits.learningNote) {
    issues.push('Poznámka k učení je příliš dlouhá.');
  }
  if ((draft.mnemonic?.length ?? 0) > limits.mnemonic) {
    issues.push('Pomůcka je příliš dlouhá.');
  }
  if (
    draft.verbForms &&
    [draft.verbForms.thirdPerson, draft.verbForms.preterite, draft.verbForms.participle].some(
      (value) => (value?.length ?? 0) > limits.verbForm,
    )
  ) {
    issues.push('Jeden tvar slovesa je příliš dlouhý.');
  }

  return issues;
}

export function assertValidVocabularyDraft(draft: ImportedNoteDraft): void {
  const issues = vocabularyDraftIssues(draft);
  if (issues.length > 0) throw new Error(issues[0]);
}
