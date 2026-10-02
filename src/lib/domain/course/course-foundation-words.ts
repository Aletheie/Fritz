import type { Article, VerbForms } from '../types.ts';
import type { CourseWord } from './path.ts';

export type FoundationWord = CourseWord & { english: string };

export function term(
  german: string,
  czech: string,
  english: string,
  exampleDe: string,
  exampleCs: string,
): FoundationWord {
  const [meaning, ...acceptedCzech] = czech.split(';').map((part) => part.trim());
  return {
    german,
    czech: meaning,
    acceptedCzech,
    english,
    exampleDe,
    exampleCs,
    kind: 'other',
    cefr: 'A1',
    role: 'target',
    contexts: [exampleDe],
    collocations: [exampleDe],
  };
}

export function noun(
  german: string,
  czech: string,
  english: string,
  article: Article,
  plural: string,
  exampleDe: string,
  exampleCs: string,
): FoundationWord {
  return { ...term(german, czech, english, exampleDe, exampleCs), kind: 'noun', article, plural };
}

export function verb(
  german: string,
  czech: string,
  english: string,
  forms: [string, string, string, VerbForms['auxiliary']],
  exampleDe: string,
  exampleCs: string,
): FoundationWord {
  return {
    ...term(german, czech, english, exampleDe, exampleCs),
    kind: 'verb',
    verbForms: {
      thirdPerson: forms[0],
      preterite: forms[1],
      participle: forms[2],
      auxiliary: forms[3],
    },
  };
}
