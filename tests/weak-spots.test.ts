import assert from 'node:assert/strict';
import test from 'node:test';

import { parseStudySearchParams, weakSpotStudyHref } from '../src/lib/domain/study/params.ts';
import { weakSpotCards, weakSpots } from '../src/lib/domain/study/weak-spots.ts';

import type { MistakeTag, ReviewLog, StudyCard } from '../src/lib/domain/types.ts';

const now = new Date('2026-10-11T12:00:00.000Z');

function review(
  cardId: string,
  rating: ReviewLog['rating'],
  mistakeTags: MistakeTag[],
  daysAgo = 1,
  extra: Partial<ReviewLog> = {},
): ReviewLog {
  return {
    id: `${cardId}-${daysAgo}-${rating}`,
    cardId,
    noteId: `note-${cardId}`,
    deckId: 'deck',
    reviewedAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
    mode: 'long-term',
    exercise: 'typing',
    rating,
    mistakeTags,
    ...extra,
  } as ReviewLog;
}

const card = (id: string) => ({ id }) as StudyCard;

test('slabiny: počítá jen nedávné, započítané a nezdařené odpovědi', () => {
  const reviews = [
    review('a', 'again', ['article']),
    review('b', 'hard', ['article', 'plural']),
    review('c', 'again', ['plural']),
    review('a', 'again', ['article'], 2),
    review('d', 'good', ['article']),
    review('e', 'again', ['case'], 45),
    review('f', 'again', ['case'], 1, { excludedFromLearning: true }),
    review('g', 'again', ['unknown']),
  ];
  const spots = weakSpots(reviews, now);
  assert.deepEqual(
    spots.map((spot) => [spot.tag, spot.count]),
    [
      ['article', 3],
      ['plural', 2],
    ],
  );
  assert.deepEqual(spots[0].noteIds.toSorted(), ['note-a', 'note-b']);
});

test('slabiny: karty seřazené podle počtu chyb a filtrované podle typu', () => {
  const reviews = [
    review('a', 'again', ['article']),
    review('a', 'again', ['article'], 3),
    review('b', 'hard', ['plural']),
  ];
  const cards = [card('b'), card('a'), card('z')];
  assert.deepEqual(
    weakSpotCards(cards, reviews, now).map((item) => item.id),
    ['a', 'b'],
  );
  assert.deepEqual(
    weakSpotCards(cards, reviews, now, 'plural').map((item) => item.id),
    ['b'],
  );
});

test('slabiny: odkaz a parsování parametrů', () => {
  const href = weakSpotStudyHref('article');
  assert.match(href, /mode=cram/u);
  const parsed = parseStudySearchParams(new URL(href, 'https://fritz.test').searchParams);
  assert.equal(parsed.mode, 'cram');
  assert.equal(parsed.weakSpot, 'article');
  assert.equal(
    parseStudySearchParams(new URLSearchParams('focus=weak&mistake=xyz')).weakSpot,
    'any',
  );
  assert.equal(parseStudySearchParams(new URLSearchParams('mode=cram')).weakSpot, undefined);
});
