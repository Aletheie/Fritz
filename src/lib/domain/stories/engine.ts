import { stableHash, stableShuffle, takeLowest } from '../deterministic.ts';
import { buildMatchingRound } from '../exercises/matching.ts';

import type { CefrLevel } from '../types.ts';

import type {
  StoryBookId,
  StoryArcExercise,
  StoryCheckpoint,
  StoryEpisode,
  StoryExercise,
  StoryGlossaryEntry,
  StoryMemoryExercise,
  StoryMatchingExercise,
  StoryOrderExercise,
  StoryPage,
  StoryProductionExercise,
  StoryRecallExercise,
  StorySequenceExercise,
  StoryTextToken,
} from './types.ts';

type ParsedParagraph = {
  index: number;
  sectionTitle?: string;
  text: string;
};

type ParsedSentence = {
  paragraphIndex: number;
  sectionTitle?: string;
  text: string;
  wordCount: number;
};

export type StoryPaginationOptions = {
  bookId: StoryBookId;
  screenCount: number;
  modernize?: boolean;
  namedHeadings?: string[];
};

export type StoryEpisodeBlueprint = {
  title: string;
  summaryCs: string;
};

const WORD_PATTERN = /\p{L}[\p{L}\p{M}’'-]*/gu;
const TOKEN_PATTERN = /(\p{L}[\p{L}\p{M}’'-]*|\d+|[^\p{L}\p{M}\d]+)/gu;
const SENTENCE_FALLBACK = /(?<=[.!?…»”])\s+(?=[„“»A-ZÄÖÜ])/gu;
let germanSentenceSegmenter: Intl.Segmenter | null | undefined;
const pageSentenceCache = new WeakMap<StoryPage, string[]>();
const glossaryLookupCache = new WeakMap<StoryGlossaryEntry[], Map<string, StoryGlossaryEntry>>();
const glossaryWordPatternCache = new WeakMap<StoryGlossaryEntry, RegExp | null>();
const glossaryMentionPatternCache = new WeakMap<StoryGlossaryEntry, RegExp | null>();
const STORY_LEVEL_RANK: Record<CefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

function sentenceSegments(text: string): string[] {
  if (germanSentenceSegmenter === undefined) {
    try {
      germanSentenceSegmenter = new Intl.Segmenter('de', { granularity: 'sentence' });
    } catch {
      germanSentenceSegmenter = null;
    }
  }
  return germanSentenceSegmenter
    ? [...germanSentenceSegmenter.segment(text)].map((part) => part.segment.trim()).filter(Boolean)
    : text.split(SENTENCE_FALLBACK).filter(Boolean);
}

const ORDER_COPY = [
  [
    'Poskládej ozvěnu příběhu.',
    'Klepáním vrať úseky věty na správná místa.',
    'Ozvěna zní přesně jako v textu.',
  ],
  [
    'Rozsypaná věta čeká na záchranu.',
    'Slož úseky v pořadí, ve kterém právě zazněly.',
    'Zachráněno — věta zase drží pohromadě.',
  ],
  [
    'Dokážeš obnovit větu z děje?',
    'Vyber jednotlivé úseky od začátku do konce.',
    'Ano. Příběhová nit se nepřetrhla.',
  ],
] as const;

const MEMORY_COPY = [
  [
    'Která věta opravdu patřila do děje?',
    'Najdi větu, kterou jsi právě četla.',
    'Dějová stopa zůstala v paměti.',
  ],
  [
    'Malý test čtenářského radaru.',
    'Jedna věta je z poslední části, dvě jsou vetřelci.',
    'Radar funguje — vetřelci neprošli.',
  ],
  [
    'Co se v příběhu skutečně objevilo?',
    'Vyber jedinou větu z právě přečtených stránek.',
    'Přesně tak. Detail ti neutekl.',
  ],
] as const;

const MATCHING_COPY = [
  [
    'Propoj slova, která patří k sobě.',
    'Vlevo je český význam, vpravo německý výraz.',
    'Všechny významové dvojice drží pohromadě.',
  ],
  [
    'Srovnej slovní kompas.',
    'Spoj české a německé výrazy z příběhu.',
    'Kompas je srovnaný. Další stránka čeká.',
  ],
  [
    'Najdi čtyři tajné dvojice.',
    'Vyber vždy český význam a jeho německého parťáka.',
    'Dvojice odhaleny — slovní zásoba se propojuje.',
  ],
] as const;

const RECALL_COPY = [
  [
    'Vybav si slovo bez nabídky.',
    'Doplň přesný německý tvar, který patří do právě přečtené věty.',
    'Tvar ses vybavila z kontextu, ne z možností.',
  ],
  [
    'Co přesně v té větě zaznělo?',
    'Napiš chybějící výraz. Po chybě dostaneš postupnou oporu.',
    'Paměť i větný kontext se propojily.',
  ],
  [
    'Doplň stopu zpaměti.',
    'Vrať do věty německé slovo ve správném tvaru.',
    'Správný tvar je zpátky na svém místě.',
  ],
] as const;

const SEQUENCE_COPY = [
  [
    'Sestav dějovou osu.',
    'Klepni na všechny tři události v pořadí, v jakém se skutečně staly.',
    'Celá scéna drží pohromadě od začátku do konce.',
  ],
  [
    'Tři stopy, jedna správná cesta.',
    'Poskládej události podle příběhu, ne podle známých slov.',
    'Našla jsi cestu scénou bez přeskakování.',
  ],
] as const;

const ARC_COPY = [
  [
    'Který oblouk patří této scéně?',
    'Vyber dvojici stop, která spojuje začátek právě dočtené epizody s její změnou na konci.',
    'Ano — spojila jsi dvě vzdálené stopy do jednoho významu.',
  ],
  [
    'Najdi skutečný střih příběhu.',
    'Každá možnost ukazuje začátek a konec jiné epizody. Která dvojice patří sem?',
    'Správný střih. Teď vidíš, co se v celé scéně změnilo.',
  ],
] as const;

const PRODUCTION_COPY = [
  [
    'Převyprávěj klíčový moment vlastní větou.',
    'Napiš krátkou německou větu o změně v epizodě a potom ji porovnej s oporou přímo z děje.',
    'Smysl scény jsi převedla do vlastní němčiny.',
  ],
  [
    'Teď bez kopírování textu.',
    'Shrň jeden důležitý moment epizody. Stejné znění jako v knize není cílem.',
    'Z porozumění vznikla vlastní věta.',
  ],
] as const;

const MODERN_GERMAN_WORDS = new Map<string, string>([
  ['daß', 'dass'],
  ['muß', 'muss'],
  ['mußt', 'musst'],
  ['mußte', 'musste'],
  ['mußten', 'mussten'],
  ['wußte', 'wusste'],
  ['wußten', 'wussten'],
  ['thun', 'tun'],
  ['thut', 'tut'],
  ['that', 'tat'],
  ['thaten', 'taten'],
  ['thust', 'tust'],
  ['thür', 'Tür'],
  ['thüre', 'Türe'],
  ['thüren', 'Türen'],
  ['thräne', 'Träne'],
  ['thränen', 'Tränen'],
  ['hülfe', 'Hilfe'],
  ['giebt', 'gibt'],
  ['ließest', 'ließest'],
  ['paßte', 'passte'],
  ['paßten', 'passten'],
  ['läßt', 'lässt'],
  ['bißchen', 'bisschen'],
  ['fluß', 'Fluss'],
  ['thore', 'Tore'],
  ['thor', 'Tor'],
  ['thal', 'Tal'],
  ['theil', 'Teil'],
  ['theile', 'Teile'],
  ['theilen', 'teilen'],
  ['kniee', 'Knie'],
]);

function preserveInitialCase(source: string, replacement: string): string {
  const initial = source.charAt(0);
  if (initial === initial.toLocaleUpperCase('de-DE')) {
    return replacement.charAt(0).toLocaleUpperCase('de-DE') + replacement.slice(1);
  }
  return replacement.charAt(0).toLocaleLowerCase('de-DE') + replacement.slice(1);
}

export function modernizeGermanOrthography(text: string): string {
  return text.replace(WORD_PATTERN, (word) => {
    const replacement = MODERN_GERMAN_WORDS.get(word.toLocaleLowerCase('de-DE'));
    return replacement ? preserveInitialCase(word, replacement) : word;
  });
}

export function normalizeStoryWord(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE')
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
}

export function countStoryWords(text: string): number {
  return text.match(WORD_PATTERN)?.length ?? 0;
}

export function storyGlossaryTier(
  entryLevel: CefrLevel,
  bookLevel: CefrLevel,
): 'support' | 'focus' | 'advanced' {
  const entryRank = STORY_LEVEL_RANK[entryLevel];
  const bookRank = STORY_LEVEL_RANK[bookLevel];
  const advancedThreshold = Math.min(bookRank + 1, STORY_LEVEL_RANK.C1);
  if (entryRank >= advancedThreshold) return 'advanced';
  if (entryRank < bookRank) return 'support';
  return 'focus';
}

function cleanHeading(value: string): string {
  return value
    .replace(/^\d+\.\s*/u, '')
    .replace(/\.\(\d+\)\.?$/u, '')
    .replace(/^_+|_+$/gu, '')
    .replace(/\.$/u, '')
    .trim();
}

function headingFrom(block: string, namedHeadings: Set<string>): string | undefined {
  if (namedHeadings.has(block)) return cleanHeading(block);
  if (/^[IVXLC]+\.$/u.test(block)) return block;
  if (/^\d+\.\s+[^\n]{2,100}$/u.test(block)) return cleanHeading(block);
  return undefined;
}

function parseParagraphs(raw: string, options: StoryPaginationOptions): ParsedParagraph[] {
  const namedHeadings = new Set(options.namedHeadings ?? []);
  const blocks = raw
    .replace(/\r/gu, '')
    .split(/\n\s*\n/gu)
    .map((block) =>
      block
        .replace(/\s*\n\s*/gu, ' ')
        .replace(/\s{2,}/gu, ' ')
        .trim(),
    )
    .filter(Boolean);

  const paragraphs: ParsedParagraph[] = [];
  let sectionTitle: string | undefined;
  for (const block of blocks) {
    if (/^\(\d+\)\s+[A-Z]/u.test(block)) continue;
    const heading = headingFrom(block, namedHeadings);
    if (heading) {
      sectionTitle = heading;
      continue;
    }
    const text = options.modernize ? modernizeGermanOrthography(block) : block;
    paragraphs.push({ index: paragraphs.length, sectionTitle, text });
  }
  return paragraphs;
}

function segmentParagraph(paragraph: ParsedParagraph): ParsedSentence[] {
  return sentenceSegments(paragraph.text)
    .flatMap((text) => splitLongSentence(text))
    .map((text) => ({
      paragraphIndex: paragraph.index,
      sectionTitle: paragraph.sectionTitle,
      text,
      wordCount: countStoryWords(text),
    }))
    .filter((sentence) => sentence.wordCount > 0);
}

function splitLongSentence(text: string, maximumWords = 56): string[] {
  if (countStoryWords(text) <= maximumWords) return [text];

  const clauses = text.split(/(?<=[,;:—–])\s+/gu).filter(Boolean);
  const fragments: string[] = [];
  let current = '';
  let currentWords = 0;
  for (const clause of clauses) {
    const clauseWords = countStoryWords(clause);
    if (!current) {
      current = clause;
      currentWords = clauseWords;
      continue;
    }
    if (currentWords + clauseWords <= maximumWords) {
      current += ` ${clause}`;
      currentWords += clauseWords;
      continue;
    }
    fragments.push(current);
    current = clause;
    currentWords = clauseWords;
  }
  if (current) fragments.push(current);

  return fragments.flatMap((fragment) => {
    if (countStoryWords(fragment) <= maximumWords) return [fragment];
    const words = fragment.split(/\s+/u).filter(Boolean);
    const chunks: string[] = [];
    for (let index = 0; index < words.length; index += maximumWords) {
      chunks.push(words.slice(index, index + maximumWords).join(' '));
    }
    return chunks;
  });
}

function sentencesToParagraphs(sentences: ParsedSentence[]): string[] {
  const paragraphs: string[] = [];
  let currentIndex = -1;
  for (const sentence of sentences) {
    if (sentence.paragraphIndex !== currentIndex) {
      paragraphs.push(sentence.text);
      currentIndex = sentence.paragraphIndex;
    } else {
      paragraphs[paragraphs.length - 1] += ` ${sentence.text}`;
    }
  }
  return paragraphs;
}

export function paginateStorySource(raw: string, options: StoryPaginationOptions): StoryPage[] {
  const sentences = parseParagraphs(raw, options).flatMap(segmentParagraph);
  if (sentences.length < options.screenCount) {
    throw new Error(`Text ${options.bookId} nemá dost vět pro ${options.screenCount} obrazovek.`);
  }

  const totalWords = sentences.reduce((sum, sentence) => sum + sentence.wordCount, 0);
  const pages: StoryPage[] = [];
  let cursor = 0;
  let consumedWords = 0;

  while (pages.length < options.screenCount) {
    const pagesRemaining = options.screenCount - pages.length;
    const remainingWords = totalWords - consumedWords;
    const targetWords = remainingWords / pagesRemaining;
    const latestEnd = sentences.length - (pagesRemaining - 1);
    let end = cursor + 1;
    let words = sentences[cursor].wordCount;

    if (pagesRemaining === 1) {
      end = sentences.length;
      words = remainingWords;
    } else {
      let bestDistance = Math.abs(words - targetWords);
      while (end < latestEnd) {
        const nextWords = words + sentences[end].wordCount;
        const nextDistance = Math.abs(nextWords - targetWords);
        if (nextDistance > bestDistance && words >= targetWords * 0.72) break;
        words = nextWords;
        bestDistance = nextDistance;
        end += 1;
      }
    }

    const current = sentences.slice(cursor, end);
    const paragraphs = sentencesToParagraphs(current);
    pages.push({
      id: `${options.bookId}-p${String(pages.length + 1).padStart(3, '0')}`,
      index: pages.length,
      number: pages.length + 1,
      sectionTitle: current.find((item) => item.sectionTitle)?.sectionTitle,
      paragraphs,
      wordCount: current.reduce((sum, item) => sum + item.wordCount, 0),
    });
    cursor = end;
    consumedWords += words;
  }

  if (pages.length !== options.screenCount) {
    throw new Error(
      `Text ${options.bookId} se rozdělil na ${pages.length} místo ${options.screenCount} obrazovek.`,
    );
  }
  return pages;
}

export { stableShuffle } from '../deterministic.ts';

export function storyPageSentences(page: StoryPage): string[] {
  const cached = pageSentenceCache.get(page);
  if (cached) return cached;
  const sentences = page.paragraphs.flatMap(sentenceSegments);
  pageSentenceCache.set(page, sentences);
  return sentences;
}

function sentenceForOrder(page: StoryPage): string {
  const sentences = storyPageSentences(page);
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/u).filter(Boolean).length;
    const distance = Math.abs(wordCount - 8);
    if (wordCount >= 5 && wordCount <= 12 && distance < bestDistance) {
      best = sentence;
      bestDistance = distance;
    }
  }
  return best ?? sentences[0] ?? page.paragraphs[0];
}

function chunksForSentence(sentence: string): string[] {
  const words = sentence.split(/\s+/u).filter(Boolean);
  if (words.length <= 10) return words;
  const chunkCount = 6;
  const chunks: string[] = [];
  for (let index = 0; index < chunkCount; index += 1) {
    const start = Math.round((words.length * index) / chunkCount);
    const end = Math.round((words.length * (index + 1)) / chunkCount);
    chunks.push(words.slice(start, end).join(' '));
  }
  return chunks.filter(Boolean);
}

function exerciseCopy(
  seed: string,
  options: ReadonlyArray<readonly [string, string, string]>,
): { promptCs: string; instructionCs: string; successCs: string } {
  const [promptCs, instructionCs, successCs] = options[stableHash(seed) % options.length];
  return { promptCs, instructionCs, successCs };
}

function buildOrderExercise(page: StoryPage, seed: string): StoryOrderExercise {
  const sentence = sentenceForOrder(page);
  const answer = chunksForSentence(sentence);
  return {
    id: `${seed}-order`,
    kind: 'order',
    ...exerciseCopy(seed, ORDER_COPY),
    tokens: stableShuffle(answer, seed),
    answer,
    sentence,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function glossaryPattern(entry: StoryGlossaryEntry, singleWord: boolean): RegExp | undefined {
  const cache = singleWord ? glossaryWordPatternCache : glossaryMentionPatternCache;
  const cached = cache.get(entry);
  if (cached !== undefined) return cached ?? undefined;
  const forms = [...new Set([entry.german, ...entry.forms])]
    .map((form) => form.trim())
    .filter((form) => form.length > 0 && (!singleWord || !/\s/u.test(form)))
    .toSorted((left, right) => right.length - left.length);
  const pattern = forms.length
    ? new RegExp(`(?<!\\p{L})(?:${forms.map(escapeRegExp).join('|')})(?!\\p{L})`, 'iu')
    : null;
  cache.set(entry, pattern);
  return pattern ?? undefined;
}

function buildRecallExercise(
  page: StoryPage,
  glossary: StoryGlossaryEntry[],
  seed: string,
): StoryRecallExercise | undefined {
  const sentences = storyPageSentences(page);
  let selected:
    | {
        entry: StoryGlossaryEntry;
        sentence: string;
        match: RegExpExecArray;
        tie: number;
      }
    | undefined;
  for (const entry of glossary) {
    const pattern = glossaryPattern(entry, true);
    if (!pattern) continue;
    let matched: { sentence: string; match: RegExpExecArray } | undefined;
    for (const sentence of sentences) {
      const match = pattern.exec(sentence);
      if (match) {
        matched = { sentence, match };
        break;
      }
    }
    if (!matched) continue;
    const tie = stableHash(`${seed}:${entry.id}`);
    if (!selected || tie < selected.tie) selected = { entry, ...matched, tie };
  }
  if (!selected || selected.match.index === undefined) return undefined;

  const answer = selected.match[0];
  const modernized = modernizeGermanOrthography(answer);
  const firstLetter = answer.match(/\p{L}/u)?.[0] ?? answer.charAt(0);
  const letterCount = [...answer].filter((character) => /\p{L}/u.test(character)).length;
  return {
    id: `${seed}-recall`,
    kind: 'recall',
    ...exerciseCopy(seed, RECALL_COPY),
    before: selected.sentence.slice(0, selected.match.index),
    after: selected.sentence.slice(selected.match.index + answer.length),
    answer,
    acceptedAnswers: [...new Set([answer, modernized])],
    hintDe: `${firstLetter}… · ${letterCount} ${letterCount === 1 ? 'Buchstabe' : 'Buchstaben'}`,
    entryId: selected.entry.id,
  };
}

function memorySentence(page: StoryPage): string {
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const sentence of storyPageSentences(page)) {
    const wordCount = countStoryWords(sentence);
    const distance = Math.abs(wordCount - 10);
    if (wordCount >= 5 && distance < bestDistance) {
      best = sentence;
      bestDistance = distance;
    }
  }
  return best ?? page.paragraphs[0];
}

function cleanStoryBeat(value: string): string {
  return value
    .trim()
    .replace(/^[\s\-–—=»„“"'<>]+/u, '')
    .replace(/[\s\-–—=]+$/u, '')
    .trim();
}

function boundedStoryBeat(value: string, maximumWords = 18): string {
  const words = [...value.matchAll(WORD_PATTERN)];
  if (words.length <= maximumWords) return cleanStoryBeat(value);
  const lastWord = words[maximumWords - 1];
  return cleanStoryBeat(value.slice(0, lastWord.index + lastWord[0].length));
}

function storyBeat(page: StoryPage): string {
  const sentences = storyPageSentences(page).filter((sentence) => countStoryWords(sentence) >= 5);
  const hardBreaks = sentences.flatMap((sentence) =>
    sentence.split(/(?:\s+--+\s+|\s+-\s+|(?<=[.!?])\s+|;\s+)/u).map(cleanStoryBeat),
  );
  const clauseBreaks = hardBreaks.flatMap((sentence) =>
    sentence
      .split(
        /,\s+(?=(?:aber|doch|dann|nun|da|als|während|weil|wenn|obwohl|und|er|sie|es|ich|wir|der|die|das|ein|eine)\b)/iu,
      )
      .map(cleanStoryBeat),
  );
  const seen = new Set<string>();
  let best: string | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const sentence of [...sentences, ...hardBreaks, ...clauseBreaks]) {
    if (!sentence || seen.has(sentence)) continue;
    seen.add(sentence);
    const wordCount = countStoryWords(sentence);
    if (wordCount < 5 || wordCount > 18) continue;
    const score = Math.abs(wordCount - 11) + (/^\p{Lu}/u.test(sentence) ? 0 : 3);
    if (score < bestScore) {
      best = sentence;
      bestScore = score;
    }
  }
  return best ?? boundedStoryBeat(memorySentence(page));
}

function productionModelSentence(pages: StoryPage[]): string {
  for (const page of pages.toReversed()) {
    let best: string | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const sentence of storyPageSentences(page)) {
      const wordCount = countStoryWords(sentence);
      const distance = Math.abs(wordCount - 12);
      if (
        wordCount >= 5 &&
        wordCount <= 22 &&
        /[.!?…][»”"']?$/u.test(sentence.trim()) &&
        distance < bestDistance
      ) {
        best = sentence;
        bestDistance = distance;
      }
    }
    if (best) return best;
  }
  const fallback = storyBeat(pages.at(-1)!);
  return /[.!?…][»”"']?$/u.test(fallback) ? fallback : `${fallback}.`;
}

function buildMemoryExercise(
  pages: StoryPage[],
  currentPages: StoryPage[],
  seed: string,
): StoryMemoryExercise {
  const answer = memorySentence(currentPages.at(-1)!);
  const currentPageIds = new Set(currentPages.map((page) => page.id));
  const outside = pages.filter((page) => !currentPageIds.has(page.id));
  const offset = stableHash(seed) % Math.max(1, outside.length);
  const candidates = [
    outside[offset],
    outside[(offset + Math.max(1, Math.floor(outside.length / 2))) % outside.length],
  ]
    .filter(Boolean)
    .map(memorySentence)
    .filter((sentence) => sentence !== answer);
  while (candidates.length < 2) {
    candidates.push(`Tato věta v právě přečtené části nebyla číslo ${candidates.length + 1}.`);
  }
  return {
    id: `${seed}-memory`,
    kind: 'memory',
    ...exerciseCopy(seed, MEMORY_COPY),
    options: stableShuffle([answer, ...candidates.slice(0, 2)], seed),
    answer,
  };
}

function buildSequenceExercise(
  currentPages: StoryPage[],
  seed: string,
): StorySequenceExercise | undefined {
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const page of currentPages) {
    const sentence = storyBeat(page);
    if (seen.has(sentence)) continue;
    seen.add(sentence);
    ordered.push(sentence);
  }
  if (ordered.length < 3) return undefined;
  const middleIndex = Math.max(1, Math.floor((ordered.length - 1) / 2));
  const events = [ordered[0], ordered[middleIndex], ordered.at(-1)!];
  return {
    id: `${seed}-sequence`,
    kind: 'sequence',
    ...exerciseCopy(seed, SEQUENCE_COPY),
    options: stableShuffle(events, seed),
    answer: events,
    explanationCs:
      'Všechny tři události se v epizodě opravdu objevily. Smysl vznikne až jejich úplným pořadím od první stopy po závěrečnou změnu.',
  };
}

function buildArcExercise(
  episodePages: StoryPage[][],
  blueprints: StoryEpisodeBlueprint[],
  episodeIndex: number,
  seed: string,
): StoryArcExercise | undefined {
  if (episodePages.length < 3) return undefined;
  const otherIndices = [episodeIndex - 1, episodeIndex - 2].filter((index) => index >= 0);
  const optionIndices = [episodeIndex, ...otherIndices];
  if (optionIndices.length < 3) return undefined;
  const options = optionIndices.map((index) => {
    const pages = episodePages[index];
    return {
      id: `${seed}-arc-option-${index + 1}`,
      openingDe: storyBeat(pages[0]),
      closingDe: storyBeat(pages.at(-1)!),
    };
  });
  const answerId = options[0].id;
  return {
    id: `${seed}-arc`,
    kind: 'arc',
    ...exerciseCopy(seed, ARC_COPY),
    options: stableShuffle(options, seed),
    answerId,
    summaryCs: blueprints[episodeIndex].summaryCs,
  };
}

function buildProductionExercise(
  pages: StoryPage[],
  glossary: StoryGlossaryEntry[],
  seed: string,
): StoryProductionExercise {
  const text = pages.flatMap((page) => page.paragraphs).join(' ');
  const mentioned: Array<{ entry: StoryGlossaryEntry; tie: number; order: number }> = [];
  for (const [order, entry] of glossary.entries()) {
    if (!glossaryPattern(entry, false)?.test(text)) continue;
    mentioned.push({ entry, tie: stableHash(`${seed}:${entry.id}`), order });
  }
  const supportWords = takeLowest(
    mentioned,
    3,
    (left, right) => left.tie - right.tie || left.order - right.order,
  ).map(({ entry }) => storyMatchingGerman(entry));
  return {
    id: `${seed}-production`,
    kind: 'production',
    ...exerciseCopy(seed, PRODUCTION_COPY),
    starterDe: 'In dieser Szene …',
    modelAnswerDe: productionModelSentence(pages),
    supportWords,
    checklistCs: [
      'Věta má osobu nebo věc a určité sloveso.',
      'Vystihuje skutečnou událost z právě přečtené scény.',
      'Není jen opsaným českým překladem slovo po slovu.',
    ],
    minimumWords: 6,
  };
}

function buildStoryMatchingExercise(
  pages: StoryPage[],
  glossary: StoryGlossaryEntry[],
  seed: string,
): StoryMatchingExercise | undefined {
  const text = pages.flatMap((page) => page.paragraphs).join(' ');
  const candidates = glossary.map((entry, order) => ({
    entry,
    mentioned: Boolean(glossaryPattern(entry, false)?.test(text)),
    tie: stableHash(`${seed}:${entry.id}`),
    order,
  }));
  const ranked = takeLowest(
    candidates,
    4,
    (left, right) =>
      Number(right.mentioned) - Number(left.mentioned) ||
      left.tie - right.tie ||
      left.order - right.order,
  );
  const round = buildMatchingRound(
    ranked.map(({ entry }) => ({
      id: entry.id,
      czech: entry.czech,
      german: storyMatchingGerman(entry),
    })),
    seed,
  );
  if (round.pairs.length < 3) return undefined;
  return {
    id: `${seed}-matching`,
    kind: 'matching',
    ...exerciseCopy(seed, MATCHING_COPY),
    ...round,
  };
}

function storyMatchingGerman(entry: StoryGlossaryEntry): string {
  if (/^(der|die|das)\s/iu.test(entry.german)) return entry.german;
  const normalizedGerman = normalizeStoryWord(entry.german);
  const displayedAsPlural =
    entry.kind === 'noun' &&
    Boolean(entry.plural) &&
    normalizeStoryWord(entry.plural ?? '') === normalizedGerman &&
    entry.forms.some((form) => normalizeStoryWord(form) !== normalizedGerman);
  const article = displayedAsPlural ? 'die' : entry.article;
  return article ? `${article} ${entry.german}` : entry.german;
}

export function buildStoryEpisodes(input: {
  bookId: StoryBookId;
  pages: StoryPage[];
  glossary: StoryGlossaryEntry[];
  blueprints: StoryEpisodeBlueprint[];
  pagesPerEpisode?: number;
}): StoryEpisode[] {
  const pagesPerEpisode = input.pagesPerEpisode ?? 4;
  const episodeCount = Math.ceil(input.pages.length / pagesPerEpisode);
  if (input.blueprints.length !== episodeCount) {
    throw new Error(
      `${input.bookId} potřebuje ${episodeCount} názvů epizod, ale má ${input.blueprints.length}.`,
    );
  }

  const episodePages = input.blueprints.map((_, index) =>
    input.pages.slice(index * pagesPerEpisode, (index + 1) * pagesPerEpisode),
  );

  return input.blueprints.map((blueprint, index) => {
    const pages = episodePages[index];
    const firstCheckpointPage = pages[Math.min(1, pages.length - 1)];
    const firstSeed = `${input.bookId}-e${index + 1}-a`;
    const firstExercise: StoryExercise =
      (index % 3 === 2
        ? buildStoryMatchingExercise(pages.slice(0, 2), input.glossary, firstSeed)
        : undefined) ??
      buildRecallExercise(firstCheckpointPage, input.glossary, firstSeed) ??
      buildOrderExercise(firstCheckpointPage, firstSeed);
    const lastPage = pages.at(-1)!;
    const secondSeed = `${input.bookId}-e${index + 1}-b`;
    const finalExercise: StoryExercise =
      index % 2 === 1
        ? buildProductionExercise(pages, input.glossary, secondSeed)
        : index % 4 === 2
          ? (buildArcExercise(episodePages, input.blueprints, index, secondSeed) ??
            buildSequenceExercise(pages, secondSeed) ??
            buildMemoryExercise(input.pages, pages, secondSeed))
          : (buildSequenceExercise(pages, secondSeed) ??
            buildMemoryExercise(input.pages, pages, secondSeed));
    const checkpoints: StoryCheckpoint[] = [
      {
        id: `${firstSeed}-checkpoint`,
        afterPageId: firstCheckpointPage.id,
        exercise: firstExercise,
      },
      {
        id: `${secondSeed}-checkpoint`,
        afterPageId: lastPage.id,
        exercise: finalExercise,
      },
    ];
    return {
      id: `${input.bookId}-e${String(index + 1).padStart(2, '0')}`,
      index,
      number: index + 1,
      title: blueprint.title,
      summaryCs: blueprint.summaryCs,
      minutes: 5,
      pages,
      checkpoints,
    };
  });
}

function glossaryLookup(glossary: StoryGlossaryEntry[]): Map<string, StoryGlossaryEntry> {
  const cached = glossaryLookupCache.get(glossary);
  if (cached) return cached;
  const lookup = new Map<string, StoryGlossaryEntry>();
  for (const entry of glossary) {
    for (const form of [entry.german, ...entry.forms]) {
      lookup.set(normalizeStoryWord(form), entry);
    }
  }
  glossaryLookupCache.set(glossary, lookup);
  return lookup;
}

export function tokenizeStoryText(text: string, glossary: StoryGlossaryEntry[]): StoryTextToken[] {
  const lookup = glossaryLookup(glossary);
  return (text.match(TOKEN_PATTERN) ?? [text]).map((value) => {
    const word = value.match(/^\p{L}/u) ? value : undefined;
    const normalized = word ? normalizeStoryWord(word) : undefined;
    return {
      value,
      word,
      normalized,
      glossary: normalized ? lookup.get(normalized) : undefined,
    };
  });
}

export function uniquePageWords(page: StoryPage): string[] {
  const words = page.paragraphs
    .flatMap((paragraph) => paragraph.match(WORD_PATTERN) ?? [])
    .map((word) => word.trim());
  const seen = new Set<string>();
  return words.filter((word) => {
    const normalized = normalizeStoryWord(word);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}
