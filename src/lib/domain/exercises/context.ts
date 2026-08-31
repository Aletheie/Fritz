import { localized } from '../../i18n/index.ts';
import { noteExampleTranslation, noteMeaning } from '../../i18n/vocabulary.ts';
import { stableHash } from '../deterministic.ts';
import { damerauLevenshtein } from '../grading/distance.ts';
import { foldGermanKeyboardCharacters, normalizeText } from '../grading/normalize.ts';
import { displayGerman } from '../vocabulary/display.ts';

import type { MotherTongue, Note, RatingKey } from '../types.ts';

export type WordOrderToken = {
  id: string;
  text: string;
  originalIndex: number;
};

export type WordOrderExercise = {
  sourceText: string;
  translation?: string;
  tokens: WordOrderToken[];
  shuffled: WordOrderToken[];
};

export type ClozeSource = 'example' | 'plural' | 'verb-third-person' | 'verb-participle' | 'recall';

export type ClozeExercise = {
  source: ClozeSource;
  label: string;
  before: string;
  after: string;
  answer: string;
  acceptedAnswers: string[];
  translation?: string;
};

export type ContextGrade = {
  rating: RatingKey;
  correct: boolean;
  nearCorrect: boolean;
  exact: boolean;
  keyboardEquivalent: boolean;
  editDistance: number;
};

function randomUnit(state: number): { value: number; state: number } {
  let next = state || 0x9e3779b9;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return { value: (next >>> 0) / 4_294_967_296, state: next >>> 0 };
}

function tokensFromSentence(sentence: string): string[] {
  return sentence
    .trim()
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter(Boolean);
}

function shuffledTokens(tokens: WordOrderToken[], seed: string): WordOrderToken[] {
  const result = [...tokens];
  let state = stableHash(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const generated = randomUnit(state);
    state = generated.state;
    const target = Math.floor(generated.value * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }

  const unchanged = result.every((token, index) => token.id === tokens[index]?.id);
  if (unchanged && result.length > 1) result.push(result.shift() as WordOrderToken);
  return result;
}

export function buildWordOrderExercise(
  note: Note,
  seed = 0,
  language: MotherTongue = 'cs',
): WordOrderExercise | undefined {
  const phraseTokens = tokensFromSentence(note.german);
  const exampleTokens = note.exampleDe ? tokensFromSentence(note.exampleDe) : [];
  const usePhrase = note.kind === 'phrase' && phraseTokens.length >= 2;
  const sourceText = usePhrase ? note.german : note.exampleDe;
  const translation = usePhrase
    ? noteMeaning(note, language)
    : noteExampleTranslation(note, language);
  const rawTokens = usePhrase ? phraseTokens : exampleTokens;

  if (!sourceText || rawTokens.length < 2 || rawTokens.length > 18) return undefined;
  const tokens = rawTokens.map<WordOrderToken>((text, originalIndex) => ({
    id: `${originalIndex}:${text}`,
    text,
    originalIndex,
  }));

  return {
    sourceText,
    translation,
    tokens,
    shuffled: shuffledTokens(tokens, `${note.id}:${seed}:${sourceText}`),
  };
}

export function wordOrderAnswer(tokens: WordOrderToken[]): string {
  return tokens
    .map((token) => token.text)
    .join(' ')
    .replace(/\s+([,.;:!?%)\]}])/gu, '$1')
    .replace(/([([{„])\s+/gu, '$1')
    .trim();
}

export function gradeWordOrder(
  selected: WordOrderToken[],
  exercise: WordOrderExercise,
): ContextGrade {
  const exact =
    selected.length === exercise.tokens.length &&
    selected.every((token, index) => token.id === exercise.tokens[index]?.id);
  return {
    rating: exact ? 'good' : 'again',
    correct: exact,
    nearCorrect: false,
    exact,
    keyboardEquivalent: false,
    editDistance: exact
      ? 0
      : damerauLevenshtein(
          normalizeText(wordOrderAnswer(selected)),
          normalizeText(exercise.sourceText),
        ),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/\s+/gu, '\\s+');
}

function findCandidate(
  sentence: string,
  candidate: string,
): { start: number; end: number; answer: string } | undefined {
  const trimmed = candidate.trim();
  if (!trimmed) return undefined;
  const expression = new RegExp(
    `(^|[^\\p{L}\\p{M}])(${escapeRegExp(trimmed)})(?=$|[^\\p{L}\\p{M}])`,
    'iu',
  );
  const match = expression.exec(sentence);
  if (!match || match.index === undefined) return undefined;
  const prefixLength = match[1]?.length ?? 0;
  const answer = match[2] ?? trimmed;
  const start = match.index + prefixLength;
  return { start, end: start + answer.length, answer };
}

function removePluralArticle(value: string): string {
  return value.replace(/^\s*(?:die|der|das)\s+/iu, '').trim();
}

function exampleCloze(note: Note, language: MotherTongue): ClozeExercise | undefined {
  const sentence = note.exampleDe?.trim();
  if (!sentence) return undefined;

  const candidates = [
    note.article ? `${note.article} ${note.german}` : '',
    note.german,
    ...note.acceptedGerman,
    note.plural ? removePluralArticle(note.plural) : '',
    note.verbForms?.thirdPerson ?? '',
    note.verbForms?.preterite ?? '',
    note.verbForms?.participle ?? '',
  ]
    .filter(Boolean)
    .toSorted((left, right) => right.length - left.length);

  let found: ReturnType<typeof findCandidate>;
  for (const candidate of candidates) {
    found = findCandidate(sentence, candidate);
    if (found) break;
  }

  if (!found && note.kind === 'verb') {
    const stem = note.german.replace(/(?:en|n)$/iu, '').toLocaleLowerCase('de');
    if (stem.length >= 3) {
      const words = [...sentence.matchAll(/[\p{L}\p{M}]+/gu)];
      const match = words.find((word) => word[0].toLocaleLowerCase('de').startsWith(stem));
      if (match?.index !== undefined) {
        found = { start: match.index, end: match.index + match[0].length, answer: match[0] };
      }
    }
  }

  if (!found) return undefined;
  return {
    source: 'example',
    label: localized(language, { cs: 'Doplň větu', en: 'Complete the sentence' }),
    before: sentence.slice(0, found.start).trimEnd(),
    after: sentence.slice(found.end).trimStart(),
    answer: found.answer,
    acceptedAnswers: [found.answer],
    translation: noteExampleTranslation(note, language),
  };
}

function pluralCloze(note: Note, language: MotherTongue): ClozeExercise | undefined {
  if (note.kind !== 'noun' || !note.article || !note.plural) return undefined;
  const plural = removePluralArticle(note.plural);
  if (!plural) return undefined;
  return {
    source: 'plural',
    label: localized(language, { cs: 'Množné číslo', en: 'Plural' }),
    before: `${note.article} ${note.german} → die`,
    after: '',
    answer: plural,
    acceptedAnswers: [plural, note.plural],
    translation: noteMeaning(note, language),
  };
}

function thirdPersonCloze(note: Note, language: MotherTongue): ClozeExercise | undefined {
  const answer = note.verbForms?.thirdPerson?.trim();
  if (note.kind !== 'verb' || !answer) return undefined;
  return {
    source: 'verb-third-person',
    label: localized(language, { cs: 'Slovesný tvar', en: 'Verb form' }),
    before: 'er / sie / es',
    after: '',
    answer,
    acceptedAnswers: [answer],
    translation: `${noteMeaning(note, language)} · ${localized(language, {
      cs: '3. osoba jednotného čísla',
      en: 'third person singular',
    })}`,
  };
}

function participleCloze(note: Note, language: MotherTongue): ClozeExercise | undefined {
  const answer = note.verbForms?.participle?.trim();
  if (note.kind !== 'verb' || !answer) return undefined;
  const auxiliary = note.verbForms?.auxiliary === 'sein' ? 'ist' : 'hat';
  return {
    source: 'verb-participle',
    label: 'Perfektum',
    before: `er / sie / es ${auxiliary}`,
    after: '',
    answer,
    acceptedAnswers: [answer],
    translation: `${noteMeaning(note, language)} · Partizip II`,
  };
}

function recallCloze(note: Note, language: MotherTongue): ClozeExercise {
  const acceptedAnswers = note.article
    ? [displayGerman(note), ...note.acceptedGerman.map((answer) => `${note.article} ${answer}`)]
    : [note.german, ...note.acceptedGerman];
  return {
    source: 'recall',
    label: note.article
      ? localized(language, {
          cs: 'Doplň výraz včetně členu',
          en: 'Complete the expression with its article',
        })
      : localized(language, { cs: 'Doplň výraz', en: 'Complete the expression' }),
    before: `${noteMeaning(note, language)} →`,
    after: '',
    answer: displayGerman(note),
    acceptedAnswers,
    translation: language === 'cs' ? note.learningNote : undefined,
  };
}

export function buildClozeExercise(
  note: Note,
  seed = 0,
  language: MotherTongue = 'cs',
): ClozeExercise {
  const options = [
    exampleCloze(note, language),
    pluralCloze(note, language),
    thirdPersonCloze(note, language),
    participleCloze(note, language),
  ].filter((option): option is ClozeExercise => Boolean(option));
  if (options.length === 0) return recallCloze(note, language);
  return options[stableHash(`${note.id}:${seed}`) % options.length];
}

export function gradeContextAnswer(input: {
  submitted: string;
  accepted: string[];
  allowKeyboardFallback: boolean;
}): ContextGrade {
  const submitted = normalizeText(input.submitted);
  const accepted: string[] = [];
  for (const value of input.accepted) {
    const normalized = normalizeText(value);
    if (normalized) accepted.push(normalized);
  }
  const exact = accepted.includes(submitted);
  const foldedSubmitted = foldGermanKeyboardCharacters(submitted);
  const keyboardEquivalent =
    !exact &&
    input.allowKeyboardFallback &&
    accepted.some((answer) => foldGermanKeyboardCharacters(answer) === foldedSubmitted);
  let editDistance = exact ? 0 : accepted.length > 0 ? Number.POSITIVE_INFINITY : submitted.length;
  let shortest = Number.POSITIVE_INFINITY;
  for (const answer of accepted) {
    shortest = Math.min(shortest, answer.length);
    if (!exact) editDistance = Math.min(editDistance, damerauLevenshtein(submitted, answer));
  }
  const typoLimit = Number.isFinite(shortest) && shortest >= 7 ? 1 : 0;
  const nearCorrect = keyboardEquivalent || (!exact && typoLimit > 0 && editDistance <= typoLimit);

  return {
    rating: exact ? 'good' : nearCorrect ? 'hard' : 'again',
    correct: exact,
    nearCorrect,
    exact,
    keyboardEquivalent,
    editDistance,
  };
}
