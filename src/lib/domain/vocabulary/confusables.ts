import { damerauLevenshtein } from '../grading/distance.ts';

import type { MotherTongue, Note } from '../types.ts';

type ConfusableGroup = {
  /** German lemmas without articles, compared case-sensitively (e.g. `ihr` vs `Ihr`). */
  words: readonly string[];
  tip: Record<MotherTongue, string>;
};

/**
 * Curated pairs that Czech learners mix up: false friends, near-homographs and
 * position/placement verb pairs. Small on purpose; spelling neighbours are found
 * automatically by `confusionRank`.
 */
export const CONFUSABLE_GROUPS: readonly ConfusableGroup[] = [
  {
    words: ['bekommen', 'werden'],
    tip: {
      cs: 'bekommen = dostat, werden = stát se. Anglické „become“ svádí ke špatné volbě.',
      en: 'bekommen means “to get”, werden means “to become”.',
    },
  },
  {
    words: ['liegen', 'legen'],
    tip: {
      cs: 'liegen = ležet (stav), legen = položit (pohyb, 4. pád).',
      en: 'liegen is a state (to lie), legen is an action (to lay, accusative).',
    },
  },
  {
    words: ['stehen', 'stellen'],
    tip: {
      cs: 'stehen = stát (stav), stellen = postavit (pohyb, 4. pád).',
      en: 'stehen is a state (to stand), stellen is an action (to place upright).',
    },
  },
  {
    words: ['sitzen', 'setzen'],
    tip: {
      cs: 'sitzen = sedět (stav), sich setzen = posadit se (pohyb).',
      en: 'sitzen is a state (to sit), sich setzen is the movement (to sit down).',
    },
  },
  {
    words: ['kennen', 'wissen', 'können'],
    tip: {
      cs: 'kennen = znát (osobu, místo), wissen = vědět (fakt), können = umět/moci.',
      en: 'kennen: know a person or place; wissen: know a fact; können: be able to.',
    },
  },
  {
    words: ['lernen', 'lehren'],
    tip: {
      cs: 'lernen = učit se, lehren = učit někoho.',
      en: 'lernen is to learn, lehren is to teach.',
    },
  },
  {
    words: ['fragen', 'bitten'],
    tip: {
      cs: 'fragen = zeptat se, bitten = poprosit.',
      en: 'fragen is to ask a question, bitten is to ask for something.',
    },
  },
  {
    words: ['zahlen', 'zählen'],
    tip: { cs: 'zahlen = platit, zählen = počítat.', en: 'zahlen is to pay, zählen is to count.' },
  },
  {
    words: ['schon', 'schön'],
    tip: { cs: 'schon = už, schön = hezký.', en: 'schon means “already”, schön means “nice”.' },
  },
  {
    words: ['Stadt', 'Staat'],
    tip: {
      cs: 'die Stadt = město, der Staat = stát.',
      en: 'die Stadt is a city, der Staat a state.',
    },
  },
  {
    words: ['Küche', 'Kuchen'],
    tip: {
      cs: 'die Küche = kuchyně, der Kuchen = koláč.',
      en: 'die Küche is a kitchen, der Kuchen a cake.',
    },
  },
  {
    words: ['Kirche', 'Kirsche'],
    tip: {
      cs: 'die Kirche = kostel, die Kirsche = třešeň.',
      en: 'die Kirche is a church, die Kirsche a cherry.',
    },
  },
  {
    words: ['denn', 'dann'],
    tip: {
      cs: 'denn = protože/vždyť, dann = potom.',
      en: 'denn means “because”, dann means “then”.',
    },
  },
  {
    words: ['wenn', 'wann', 'als'],
    tip: {
      cs: 'wann = kdy (otázka), wenn = když/pokaždé, als = když (jednou v minulosti).',
      en: 'wann asks “when?”, wenn is “if/whenever”, als is “when” for a single past event.',
    },
  },
  {
    words: ['seit', 'seid'],
    tip: {
      cs: 'seit = od (času), seid = jste (sein).',
      en: 'seit means “since”, seid is “you are” (sein).',
    },
  },
  {
    words: ['das', 'dass'],
    tip: {
      cs: 'das = to/ten, dass = že (spojka).',
      en: 'das is an article or pronoun, dass means “that”.',
    },
  },
  {
    words: ['ihr', 'Ihr'],
    tip: {
      cs: 'ihr = vy (tykání) nebo její/jejich, Ihr = Váš (vykání).',
      en: 'ihr is “you all” or “her/their”, Ihr is formal “your”.',
    },
  },
];

const groupByWord = new Map<string, ConfusableGroup>();
for (const group of CONFUSABLE_GROUPS) {
  for (const word of group.words) groupByWord.set(word, group);
}

/** The lemma used for comparisons: no article, no reflexive `sich`. */
function lemma(note: Pick<Note, 'german'>): string {
  return note.german
    .trim()
    .replace(/^(?:der|die|das)\s+/u, '')
    .replace(/^sich\s+/u, '');
}

/**
 * How likely the learner is to confuse two notes, lower is more confusable:
 * 0 for a curated pair, 1–2 for spelling neighbours, undefined otherwise.
 */
export function confusionRank(
  left: Pick<Note, 'german'>,
  right: Pick<Note, 'german'>,
): number | undefined {
  const a = lemma(left);
  const b = lemma(right);
  if (a === b) return undefined;
  const group = groupByWord.get(a);
  if (group && group.words.includes(b)) return 0;
  if (Math.min(a.length, b.length) < 4) return undefined;
  const distance = damerauLevenshtein(a.toLocaleLowerCase('de-DE'), b.toLocaleLowerCase('de-DE'));
  return distance <= 2 ? distance : undefined;
}

/** A short contrast tip when the note belongs to a curated confusable group. */
export function confusionTip(
  note: Pick<Note, 'german'>,
  language: MotherTongue,
): string | undefined {
  return groupByWord.get(lemma(note))?.tip[language];
}
