import type { DetailedCefrLevel } from '../types.ts';
import type { LearnerCopy } from './course-communication.ts';

export type CourseWritingProfile = {
  minimumWords: number;
  suggestedWords: [number, number];
  minutes: number;
  outcome: LearnerCopy;
  extension: LearnerCopy;
  review: LearnerCopy;
};

/** Editorial limits for short practice, not CEFR or examination word counts. */
export const courseWritingProfiles: Record<DetailedCefrLevel, CourseWritingProfile> = {
  'A1.1': {
    minimumWords: 4,
    suggestedWords: [8, 25],
    minutes: 4,
    outcome: {
      cs: 'Představím se a předám jednoduchý údaj.',
      en: 'I can introduce myself and pass on a simple detail.',
    },
    extension: {
      cs: 'Stačí jednoduché věty. Přidej jméno, místo nebo čas podle situace.',
      en: 'Use simple sentences. Include a name, place, or time that fits the situation.',
    },
    review: {
      cs: 'Je jasné, kdo co dělá? Zkontroluj osobu a sloveso.',
      en: 'Is it clear who does what? Check the subject and verb.',
    },
  },
  'A1.2': {
    minimumWords: 8,
    suggestedWords: [15, 35],
    minutes: 4,
    outcome: {
      cs: 'Popíšu běžný den a domluvím jednoduchý plán.',
      en: 'I can describe my day and make a simple arrangement.',
    },
    extension: {
      cs: 'Propoj dvě nebo tři krátké věty a přidej konkrétní údaj.',
      en: 'Connect two or three short sentences and include a specific detail.',
    },
    review: {
      cs: 'Jsou údaje srozumitelné? Zkontroluj koncovku slovesa a předponu.',
      en: 'Are the details clear? Check the verb ending and separable prefix.',
    },
  },
  'A2.1': {
    minimumWords: 12,
    suggestedWords: [25, 50],
    minutes: 5,
    outcome: {
      cs: 'Vyřídím běžnou záležitost a doptám se na chybějící údaj.',
      en: 'I can handle a routine matter and ask for a missing detail.',
    },
    extension: {
      cs: 'Napiš krátkou zprávu: popiš potřebu, přidej detail a polož doplňující otázku.',
      en: 'Write a short message: explain your need, add a detail, and ask a follow-up question.',
    },
    review: {
      cs: 'Ví příjemce, co potřebuji? Zkontroluj otázku a zdvořilé oslovení.',
      en: 'Does the recipient know what I need? Check the question and polite form of address.',
    },
  },
  'A2.2': {
    minimumWords: 16,
    suggestedWords: [30, 60],
    minutes: 5,
    outcome: {
      cs: 'Vysvětlím problém, důvod a navrhnu náhradní řešení.',
      en: 'I can explain a problem and reason, and suggest an alternative.',
    },
    extension: {
      cs: 'Doplň důvod svého rozhodnutí a navrhni konkrétní další krok.',
      en: 'Add a reason for your decision and propose a concrete next step.',
    },
    review: {
      cs: 'Navazuje důvod na návrh? Zkontroluj slovosled po spojkách.',
      en: 'Does the reason support the proposal? Check word order after conjunctions.',
    },
  },
  'B1.1': {
    minimumWords: 24,
    suggestedWords: [45, 80],
    minutes: 6,
    outcome: {
      cs: 'Předám zkušenost nebo postup v navazujícím textu.',
      en: 'I can convey an experience or procedure in a connected text.',
    },
    extension: {
      cs: 'Rozveď situaci konkrétním příkladem a zakonči výsledkem nebo dalším krokem.',
      en: 'Develop the situation with a concrete example and end with the result or a next step.',
    },
    review: {
      cs: 'Lze sledovat pořadí událostí a odpovědnost jednotlivých lidí?',
      en: 'Can the reader follow the sequence of events and each person’s responsibility?',
    },
  },
  'B1.2': {
    minimumWords: 30,
    suggestedWords: [60, 100],
    minutes: 6,
    outcome: {
      cs: 'Shrnu informaci, zdůvodním názor a rozliším zdroj.',
      en: 'I can summarise information, justify an opinion, and identify its source.',
    },
    extension: {
      cs: 'Napiš souvislý odstavec. Propoj hlavní sdělení, důvod nebo příklad a závěr.',
      en: 'Write a connected paragraph linking the main point, a reason or example, and a conclusion.',
    },
    review: {
      cs: 'Je jasné, co se stalo a co je můj názor? Zkontroluj návaznost vět.',
      en: 'Is it clear what happened and what is my opinion? Check how sentences connect.',
    },
  },
  'B2.1': {
    minimumWords: 35,
    suggestedWords: [70, 120],
    minutes: 7,
    outcome: {
      cs: 'Porovnám možnosti a obhájím doporučení s podmínkou.',
      en: 'I can compare options and justify a conditional recommendation.',
    },
    extension: {
      cs: 'Rozviň návrh do krátkého odstavce: zvaž alternativu, uveď důvod a podmínku doporučení.',
      en: 'Develop a short paragraph: consider an alternative, give a reason, and state a condition for your recommendation.',
    },
    review: {
      cs: 'Odpovídá síla doporučení uvedeným důvodům a omezením?',
      en: 'Does the strength of the recommendation match the reasons and limitations?',
    },
  },
  'B2.2': {
    minimumWords: 40,
    suggestedWords: [80, 140],
    minutes: 7,
    outcome: {
      cs: 'Napíšu přesné stanovisko a rozliším závazek od možnosti.',
      en: 'I can write a precise position and distinguish a commitment from a possibility.',
    },
    extension: {
      cs: 'Napiš krátké stanovisko s konkrétním požadavkem, omezením a ověřitelným dalším krokem.',
      en: 'Write a short position with a concrete request, a limitation, and a verifiable next step.',
    },
    review: {
      cs: 'Nezaměňuji přání za slib? Jsou požadavek, podmínka a termín přesné?',
      en: 'Am I turning a wish into a promise? Are the request, condition, and deadline precise?',
    },
  },
  'C1.1': {
    minimumWords: 45,
    suggestedWords: [90, 160],
    minutes: 8,
    outcome: {
      cs: 'Zprostředkuji složitější myšlenku a zachovám zdroj i nejistotu.',
      en: 'I can convey a complex idea while preserving its source and uncertainty.',
    },
    extension: {
      cs: 'Vysvětli myšlenku čtenáři mimo obor, uveď omezení a odliš převzatá tvrzení od svého závěru.',
      en: 'Explain the idea to a non-specialist, state limitations, and distinguish reported claims from your conclusion.',
    },
    review: {
      cs: 'Zůstaly po zjednodušení zachované význam, zdroj a míra jistoty?',
      en: 'After simplifying, have I preserved the meaning, source, and degree of certainty?',
    },
  },
  'C1.2': {
    minimumWords: 45,
    suggestedWords: [90, 160],
    minutes: 8,
    outcome: {
      cs: 'Spojím podklady do přesného textu pro konkrétní publikum.',
      en: 'I can combine source material into a precise text for a particular audience.',
    },
    extension: {
      cs: 'Přizpůsob výstup příjemci. Spoj hlavní body, vymez nejistotu a formuluj použitelný závěr.',
      en: 'Adapt the output to its recipient. Connect the main points, define uncertainty, and give an actionable conclusion.',
    },
    review: {
      cs: 'Každá věta slouží příjemci a žádná formulace nepřidává nepodložený závěr.',
      en: 'Every sentence serves the recipient and no wording adds an unsupported conclusion.',
    },
  },
};
