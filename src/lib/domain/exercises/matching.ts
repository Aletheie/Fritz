import { noteMeaning } from '../../i18n/vocabulary.ts';
import { stableHash, stableShuffle } from '../deterministic.ts';
import { displayGerman } from '../vocabulary/display.ts';

import type { MotherTongue, Note } from '../types.ts';

export type MatchingPair = {
  id: string;
  czech: string;
  german: string;
};

export type MatchingItem = {
  pairId: string;
  label: string;
};

export type MatchingRound = {
  pairs: MatchingPair[];
  czechOptions: MatchingItem[];
  germanOptions: MatchingItem[];
};

export type VocabularyMatchingExercise = {
  currentPairId: string;
} & MatchingRound;

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE').replace(/\s+/gu, ' ');
}

function matchingPair(note: Note, language: MotherTongue): MatchingPair {
  return {
    id: note.id,
    czech: noteMeaning(note, language),
    german: displayGerman(note),
  };
}

type RankedNote = {
  note: Note;
  score: number;
  tie: number;
  order: number;
};

function compareRankedNotes(left: RankedNote, right: RankedNote): number {
  return left.score - right.score || left.tie - right.tie || left.order - right.order;
}

function siftDown(heap: RankedNote[], start: number): void {
  let parent = start;
  while (true) {
    const left = parent * 2 + 1;
    if (left >= heap.length) return;
    const right = left + 1;
    const child =
      right < heap.length && compareRankedNotes(heap[right], heap[left]) < 0 ? right : left;
    if (compareRankedNotes(heap[parent], heap[child]) <= 0) return;
    [heap[parent], heap[child]] = [heap[child], heap[parent]];
    parent = child;
  }
}

function popBest(heap: RankedNote[]): RankedNote | undefined {
  if (heap.length === 0) return undefined;
  const best = heap[0];
  const tail = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = tail;
    siftDown(heap, 0);
  }
  return best;
}

function selectMatchingPairs(
  current: Note,
  notes: Note[],
  limit: number,
  seed: number,
  language: MotherTongue,
): MatchingPair[] {
  const currentPair = matchingPair(current, language);
  const pairs = uniquePairs([currentPair]);
  if (pairs.length === 0) return pairs;

  const currentTags = new Set(current.tags);
  const heap: RankedNote[] = [];
  for (const [order, note] of notes.entries()) {
    if (note.id === current.id) continue;
    heap.push({
      note,
      score:
        (note.kind === current.kind ? 0 : 4) +
        (note.cefr && current.cefr && note.cefr === current.cefr ? 0 : 1) +
        (note.tags.some((tag) => currentTags.has(tag)) ? 0 : 1),
      tie: stableHash(`${current.id}:${note.id}:${seed}`),
      order,
    });
  }
  for (let index = Math.floor(heap.length / 2) - 1; index >= 0; index -= 1) {
    siftDown(heap, index);
  }

  const czech = new Set([normalized(currentPair.czech)]);
  const german = new Set([normalized(currentPair.german)]);
  while (pairs.length < limit) {
    const candidate = popBest(heap);
    if (!candidate) break;
    const pair = matchingPair(candidate.note, language);
    const czechKey = normalized(pair.czech);
    const germanKey = normalized(pair.german);
    if (!czechKey || !germanKey || czech.has(czechKey) || german.has(germanKey)) continue;
    czech.add(czechKey);
    german.add(germanKey);
    pairs.push(pair);
  }
  return pairs;
}

function uniquePairs(pairs: MatchingPair[]): MatchingPair[] {
  const czech = new Set<string>();
  const german = new Set<string>();
  const unique: MatchingPair[] = [];
  for (const pair of pairs) {
    const czechKey = normalized(pair.czech);
    const germanKey = normalized(pair.german);
    if (!czechKey || !germanKey || czech.has(czechKey) || german.has(germanKey)) continue;
    czech.add(czechKey);
    german.add(germanKey);
    unique.push(pair);
  }
  return unique;
}

export function buildMatchingRound(pairs: MatchingPair[], seed: string): MatchingRound {
  const safePairs = uniquePairs(pairs);
  const czechOptions = stableShuffle(
    safePairs.map((pair) => ({ pairId: pair.id, label: pair.czech })),
    `${seed}:cs`,
    false,
  );
  let germanOptions = stableShuffle(
    safePairs.map((pair) => ({ pairId: pair.id, label: pair.german })),
    `${seed}:de`,
    false,
  );

  if (
    germanOptions.length > 1 &&
    germanOptions.every((option, index) => option.pairId === czechOptions[index]?.pairId)
  ) {
    germanOptions = [...germanOptions.slice(1), germanOptions[0]];
  }

  return { pairs: safePairs, czechOptions, germanOptions };
}

export function canBuildVocabularyMatchingExercise(
  current: Note,
  notes: Note[],
  seed = 0,
  language: MotherTongue = 'cs',
): boolean {
  return selectMatchingPairs(current, notes, 3, seed, language).length >= 3;
}

export function buildVocabularyMatchingExercise(
  current: Note,
  notes: Note[],
  limit = 4,
  seed = 0,
  language: MotherTongue = 'cs',
): VocabularyMatchingExercise | undefined {
  const safeLimit = Math.max(3, Math.min(5, Math.round(limit)));
  const pairs = selectMatchingPairs(current, notes, safeLimit, seed, language);
  if (pairs.length < 3 || !pairs.some((pair) => pair.id === current.id)) return undefined;

  return {
    ...buildMatchingRound(pairs, `${current.id}:${seed}`),
    currentPairId: current.id,
  };
}
