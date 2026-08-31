import { localized } from './index.ts';

import type { MistakeTag, MotherTongue } from '../domain/types.ts';

type LocalizedCopy = { cs: string; en: string };

const mistakeLabels: Record<MistakeTag, LocalizedCopy> = {
  article: { cs: 'člen', en: 'article' },
  gender: { cs: 'rod podstatného jména', en: 'noun gender' },
  plural: { cs: 'množné číslo', en: 'plural' },
  'verb-form': { cs: 'tvar slovesa', en: 'verb form' },
  auxiliary: { cs: 'pomocné sloveso', en: 'auxiliary verb' },
  'separable-prefix': { cs: 'odlučitelná předpona', en: 'separable prefix' },
  'word-order': { cs: 'slovosled', en: 'word order' },
  case: { cs: 'pád', en: 'case' },
  preposition: { cs: 'předložka', en: 'preposition' },
  negation: { cs: 'zápor', en: 'negation' },
  spelling: { cs: 'německý zápis', en: 'spelling' },
  meaning: { cs: 'přesný význam', en: 'precise meaning' },
  register: { cs: 'přirozená formulace', en: 'natural phrasing' },
  fluency: { cs: 'plynulost repliky', en: 'fluency' },
  unknown: { cs: 'další procvičení', en: 'more practice' },
};

export function mistakeLabel(tag: MistakeTag, language: MotherTongue): string {
  return localized(language, mistakeLabels[tag]);
}
