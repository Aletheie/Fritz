import { mistakeLabel } from '../../../i18n/mistakes.ts';
import { DEMO_MODEL } from './model.server.ts';

import type {
  AiContextDrillRequest,
  AiAdaptiveHintRequest,
  AiAdaptiveHintResult,
  AiContextDrillResult,
  AiWeeklySummaryRequest,
  AiWeeklySummaryResult,
} from '../../../domain/ai/types.ts';

function contextAnswer(request: AiContextDrillRequest, index: number): string {
  const lexeme = request.lexemes[index % request.lexemes.length];
  return lexeme.article ? `${lexeme.article} ${lexeme.german}` : lexeme.german;
}

export function demoContextDrills(request: AiContextDrillRequest): AiContextDrillResult {
  const count = Math.min(6, Math.max(3, request.lexemes.length));
  const types = ['translation', 'cloze', 'contrast', 'word-order'] as const;
  const drills = Array.from({ length: count }, (_, index) => {
    const lexeme = request.lexemes[index % request.lexemes.length];
    const answer = contextAnswer(request, index);
    const type = types[index % types.length];
    const prompt =
      type === 'cloze'
        ? request.motherTongue === 'en'
          ? `Complete the exact German expression: ___ — ${lexeme.exampleCs ?? lexeme.czech}`
          : `Doplň přesný německý výraz: ___ — ${lexeme.exampleCs ?? lexeme.czech}`
        : type === 'word-order'
          ? request.motherTongue === 'en'
            ? `Build the correct expression: ${answer.split(/\s+/u).toReversed().join(' · ')}`
            : `Sestav správný výraz: ${answer.split(/\s+/u).toReversed().join(' · ')}`
          : type === 'contrast'
            ? request.motherTongue === 'en'
              ? `Which exact German expression matches “${lexeme.czech}”?`
              : `Který přesný německý výraz odpovídá významu „${lexeme.czech}“?`
            : request.motherTongue === 'en'
              ? `Translate into German: ${lexeme.czech}`
              : `Přelož do němčiny: ${lexeme.czech}`;
    return {
      id: `demo-context:${index + 1}:${lexeme.noteId}`,
      type,
      prompt,
      answer,
      acceptedAnswers: [...new Set([answer, lexeme.german, ...lexeme.acceptedGerman])],
      explanation:
        lexeme.exampleDe && lexeme.exampleCs
          ? `${lexeme.exampleDe} — ${lexeme.exampleCs}`
          : request.motherTongue === 'en'
            ? `The target expression is “${answer}”.`
            : `Cílový výraz je „${answer}“.`,
      sourceNoteIds: [lexeme.noteId],
      objectiveIds: request.objectiveIds.slice(0, 1),
      provenance: 'demo-template' as const,
    };
  });
  return { drills, available: true, model: DEMO_MODEL };
}

export function normalizedIncludes(message: string, word: string): boolean {
  const haystack = message.toLocaleLowerCase('de-DE');
  const needle = word
    .replace(/^(der|die|das)\s+/iu, '')
    .split(/\s+/u)
    .find((part) => part.length >= 3)
    ?.toLocaleLowerCase('de-DE');
  return Boolean(needle && haystack.includes(needle));
}

export function demoAdaptiveHint(request: AiAdaptiveHintRequest): AiAdaptiveHintResult {
  const label = request.note.article
    ? request.motherTongue === 'en'
      ? `a noun with the article “${request.note.article}”`
      : `podstatné jméno rodu „${request.note.article}“`
    : request.note.kind === 'verb'
      ? request.motherTongue === 'en'
        ? 'a verb; check its inflected form and position'
        : 'sloveso; zkontroluj jeho časovaný tvar a pozici'
      : request.motherTongue === 'en'
        ? `an expression of type “${request.note.kind}”`
        : `výraz typu „${request.note.kind}“`;
  return {
    hint: request.revealAnswer
      ? request.motherTongue === 'en'
        ? `The target expression is ${request.note.article ? `${request.note.article} ` : ''}${request.note.german}.`
        : `Cílový výraz je ${request.note.article ? `${request.note.article} ` : ''}${request.note.german}.`
      : request.motherTongue === 'en'
        ? `Look for ${label}; the meaning is “${request.note.czech}”.`
        : `Hledej ${label}; význam je „${request.note.czech}“.`,
    rule:
      request.mistakeTags.includes('article') && request.note.article
        ? request.motherTongue === 'en'
          ? `Learn this entry with the article ${request.note.article}.`
          : `Tento záznam se učí se členem ${request.note.article}.`
        : request.motherTongue === 'en'
          ? 'Recall the meaning, then check the form in the complete sentence.'
          : 'Vybav si význam a potom ověř tvar v celé větě.',
    exampleDe: request.note.exampleDe ?? `Ich übe den Ausdruck ${request.note.german}.`,
    exampleCs:
      request.note.exampleCs ??
      (request.motherTongue === 'en'
        ? `I am practising the expression ${request.note.czech}.`
        : `Procvičuji výraz ${request.note.czech}.`),
    confidence: request.note.exampleDe ? 'high' : 'medium',
    sourceObjectiveIds: request.objectiveIds.slice(0, 2),
    model: DEMO_MODEL,
  };
}

export function demoWeeklySummary(request: AiWeeklySummaryRequest): AiWeeklySummaryResult {
  const en = request.motherTongue === 'en';
  const top = request.mistakes[0];
  if (request.totalReviews === 0) {
    return {
      headline: en ? 'This week is still empty.' : 'Tenhle týden je zatím prázdný.',
      wins: [en ? 'Your plan is ready whenever you are.' : 'Plán na tebe počká.'],
      focus: en ? 'Start with one short daily lesson.' : 'Začni jednou krátkou denní lekcí.',
      nextSteps: [en ? 'Open today’s lesson.' : 'Otevři dnešní lekci.'],
      model: DEMO_MODEL,
    };
  }
  return {
    headline: en
      ? `You practised on ${request.activeDays} days this week.`
      : `Tento týden ses učila ${request.activeDays} dní.`,
    wins: [
      en
        ? `${request.totalReviews} answers in total, ${request.longTermReviews} of them in long-term review.`
        : `Celkem ${request.totalReviews} odpovědí, z toho ${request.longTermReviews} v dlouhodobém opakování.`,
    ],
    focus: top
      ? en
        ? `The most frequent mistake type was “${mistakeLabel(top.tag, 'en')}” (${top.count}×). Give it one focused exercise.`
        : `Nejčastější typ chyby byl „${mistakeLabel(top.tag, 'cs')}“ (${top.count}×). Věnuj mu jedno cílené cvičení.`
      : en
        ? 'No repeated mistakes. Keep your rhythm.'
        : 'Žádná chyba se neopakovala. Drž svůj rytmus.',
    nextSteps: [
      en ? 'Keep your daily review going.' : 'Pokračuj v denním opakování.',
      en ? 'Try one AI conversation.' : 'Zkus jednu AI konverzaci.',
    ],
    model: DEMO_MODEL,
  };
}
