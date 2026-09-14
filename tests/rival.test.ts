import assert from 'node:assert/strict';
import test from 'node:test';

import { createSeedData } from '../src/lib/data/seed.ts';
import { grammarLessons } from '../src/lib/domain/course/grammar.ts';
import {
  readLearner,
  rivalAnswerIsCorrect,
  rivalScore,
  updateRivalry,
} from '../src/lib/domain/rival/engine.ts';
import { buildRivalQuestions } from '../src/lib/domain/rival/questions.ts';
import type {
  RivalAction,
  RivalQuestion,
  RivalryState,
  RivalTopic,
} from '../src/lib/domain/rival/types.ts';
import { parseRivalry } from '../src/lib/domain/rival/validation.ts';
import type { CourseAnswerEvent, ReviewLog } from '../src/lib/domain/types.ts';

const now = new Date('2026-09-12T12:00:00.000Z');
const pool: RivalQuestion[] = (['recall', 'articles', 'grammar'] as RivalTopic[]).flatMap((topic) =>
  Array.from({ length: 12 }, (_, index) => ({
    id: `${topic}:${index}`,
    sourceId: `${topic}:${index}`,
    topic,
    prompt: { cs: '___ Haus', en: '___ Haus' },
    promptLanguage: 'de' as const,
    answer: 'das',
    accepted: ['das'],
    options: ['der', 'die', 'das'],
    explanation: { cs: 'Das Haus je středního rodu.', en: 'Das Haus is neuter.' },
    difficulty: (index % 3) + 1,
    priority: 0,
  })),
);

function start(
  overrides: Partial<Extract<RivalAction, { type: 'start' }>> = {},
  state: RivalryState = { history: [] },
): RivalryState {
  return updateRivalry(
    state,
    {
      type: 'start',
      id: 'match',
      rivalId: 'mila',
      strategy: 'balanced',
      weakness: 'recall',
      ...overrides,
    },
    pool,
    now,
  );
}

function answer(state: RivalryState, correct = true, stake: 1 | 2 = 1): RivalryState {
  const match = state.match!;
  const question = match.rounds.at(-1)!.question;
  return updateRivalry(
    state,
    {
      type: 'answer',
      matchId: match.id,
      questionId: question.id,
      answer: correct ? question.answer : 'wrong',
      stake,
    },
    [],
    now,
  );
}

function advance(state: RivalryState, type: 'next' | 'switch' = 'next'): RivalryState {
  return updateRivalry(
    state,
    { type, matchId: state.match!.id, questionId: state.match!.rounds.at(-1)!.question.id },
    pool,
    now,
  );
}

function finish(state: RivalryState, correct = true): RivalryState {
  let result = state;
  while (!result.match!.completedAt) {
    if (!result.match!.rounds.at(-1)!.result) result = answer(result, correct);
    if (!result.match!.completedAt) result = advance(result);
  }
  return result;
}

test('the robot commits before the user answers and cannot reroll after a reload or retry', () => {
  const initial = start();
  const committed = initial.match!.rounds[0];
  assert.deepEqual(start(), initial);
  assert.deepEqual(start({ id: 'another-match' }, initial), initial);
  for (const correct of [true, false]) {
    const answered = answer(parseRivalry(initial), correct, 2);
    const { result, ...botRound } = answered.match!.rounds[0];
    assert.deepEqual(botRound, committed);
    assert.equal(result?.correct, correct);
    assert.equal(answer(answered, !correct), answered);
  }
  assert.equal(initial.match!.rounds[0].result, undefined);
  assert.deepEqual(rivalScore(initial.match!), { user: 0, bot: 0 });
});

test('mistakes change the next question, a streak changes the angle, and counterplay targets a real rival weakness', () => {
  const missed = advance(answer(start(), false));
  assert.equal(missed.match!.rounds[1].move, 'retry');
  assert.equal(missed.match!.rounds[1].question.topic, 'recall');
  const streak = advance(answer(advance(answer(start()))));
  assert.equal(streak.match!.rounds[2].move, 'raise');
  assert.equal(streak.match!.rounds[2].question.difficulty, 3);
  const pressure = start({ strategy: 'pressure' });
  assert.equal(pressure.match!.rounds[0].question.difficulty, 3);
  const counter = finish(start({ strategy: 'counter', rivalId: 'mila' }));
  for (const index of [0, 2, 4]) {
    assert.equal(counter.match!.rounds[index].question.topic, 'articles');
    assert.equal(counter.match!.rounds[index].move, 'counter');
  }
});

test('one swap and one double stake are enforced, including stale commands from another tab', () => {
  const initial = start();
  assert.throws(() => advance(initial), /Nejdřív/u);
  const swapped = advance(initial, 'switch');
  assert.notEqual(
    swapped.match!.rounds[0].question.sourceId,
    initial.match!.rounds[0].question.sourceId,
  );
  assert.throws(() => advance(swapped, 'switch'), /jednou/u);
  const boosted = answer(swapped, true, 2);
  const next = advance(boosted);
  assert.equal(advance(boosted).match!.rounds[1].question.id, next.match!.rounds[1].question.id);
  assert.equal(
    updateRivalry(
      next,
      { type: 'next', matchId: 'match', questionId: boosted.match!.rounds[0].question.id },
      pool,
      now,
    ),
    next,
  );
  assert.throws(() => answer(next, true, 2), /využitou/u);
  const finished = finish(next);
  assert.equal(rivalScore(finished.match!).user, 6);
  assert.equal(finished.match!.rounds.filter((round) => round.botStake === 2).length, 1);
  const used = [
    ...finished.match!.rounds.map((round) => round.question.sourceId),
    ...finished.match!.discardedSourceIds,
  ];
  assert.equal(new Set(used).size, 6);
  assert.equal(finished.history.length, 1);
  assert.equal(answer(finished), finished);
  assert.throws(() => advance(finished), /změnil/u);
});

test('rematches remember missed topics and adjust strength without leaking memory between rivals', () => {
  const lost = finish(start({ weakness: 'articles' }), false);
  const rematch = start({ id: 'rematch', weakness: 'grammar' }, lost);
  assert.equal(rematch.match!.weakness, 'articles');
  assert.ok(rematch.match!.adjustment < 0);
  const otherRival = start({ id: 'other', rivalId: 'konrad', weakness: 'grammar' }, lost);
  assert.equal(otherRival.match!.weakness, 'grammar');
  assert.equal(otherRival.match!.adjustment, 0);

  const history = Array.from({ length: 30 }, (_, index) => ({
    ...lost.history[0],
    id: `old:${index}`,
  }));
  const bounded = finish(start({ id: 'latest' }, { history }));
  assert.equal(bounded.history.length, 30);
  assert.equal(bounded.history[0].id, 'old:1');
  assert.equal(bounded.history.at(-1)?.id, 'latest');
});

function review(id: string, overrides: Partial<ReviewLog> = {}): ReviewLog {
  return {
    id,
    cardId: 'card',
    deckId: 'deck',
    noteId: 'note',
    reviewedAt: now.toISOString(),
    mode: 'long-term',
    exercise: 'typing',
    rating: 'again',
    signal: {
      exercise: 'typing',
      wordCorrect: true,
      articleCorrect: false,
      selectedArticle: 'die',
      exact: false,
      keyboardEquivalent: false,
      editDistance: 0,
      responseMs: 1000,
      hintsUsed: 0,
      attempt: 1,
    },
    ...overrides,
  };
}

test('scouting uses recent counted learning, with an honest cold start and no cram or disputed evidence', () => {
  const actual = [review('a'), review('b'), review('c')];
  const grammar: CourseAnswerEvent[] = Array.from({ length: 3 }, (_, index) => ({
    id: `grammar:${index}`,
    lessonId: 'lesson',
    questionId: 'question',
    answeredAt: now.toISOString(),
    correct: true,
    firstTry: true,
    xpAwarded: 0,
    responseMs: 1000,
  }));
  const reading = readLearner(
    [
      ...actual,
      review('cram', { mode: 'cram' }),
      review('disputed', { excludedFromLearning: true }),
      review('old', { reviewedAt: '2026-07-01T12:00:00.000Z' }),
    ],
    grammar,
    now,
  );
  assert.equal(reading.observations, 6);
  assert.equal(reading.weakness, 'articles');
  assert.deepEqual(
    reading.topics.map((topic) => [topic.attempts, topic.correct]),
    [
      [3, 3],
      [3, 0],
      [3, 3],
    ],
  );
  assert.equal(readLearner([], [], now).observations, 0);
});

test('real vocabulary retains accepted spellings and shares identity across recall and article questions', () => {
  const seed = createSeedData(now);
  const questions = buildRivalQuestions(
    seed.notes,
    [],
    grammarLessons.filter((lesson) => lesson.cefr === 'A1'),
  );
  const key = seed.notes.find((note) => note.german === 'Schlüssel')!;
  const recall = questions.find((question) => question.id === `recall:${key.id}`)!;
  const article = questions.find((question) => question.id === `articles:${key.id}`)!;
  assert.equal(recall.sourceId, article.sourceId);
  assert.equal(rivalAnswerIsCorrect(recall, ' DER SCHLUESSEL. '), true);
  assert.equal(rivalAnswerIsCorrect(recall, 'Schlüssel'), false);
  assert.equal(rivalAnswerIsCorrect(recall, 'die Schlüssel'), false);
  assert.ok(questions.some((question) => question.topic === 'grammar' && question.options.length));
  assert.ok(questions.some((question) => question.topic === 'grammar' && !question.options.length));
  const prioritized = buildRivalQuestions(
    seed.notes,
    [review('miss', { noteId: key.id }), review('cram', { noteId: key.id, mode: 'cram' })],
    [],
  );
  assert.equal(prioritized[0].sourceId, `note:${key.id}`);
  assert.equal(prioritized[0].priority, 2);
  assert.throws(
    () =>
      updateRivalry(
        { history: [] },
        {
          type: 'start',
          id: 'too-small',
          rivalId: 'mila',
          strategy: 'balanced',
          weakness: 'recall',
        },
        questions.filter((question) => question.sourceId === recall.sourceId),
        now,
      ),
    /šest/u,
  );
});

test('saved matches round-trip without typed transcripts and reject impossible scores or duplicate rounds', () => {
  const initial = start();
  const restored = parseRivalry({
    ...initial,
    transcript: 'private',
    match: { ...initial.match, submittedAnswer: 'private' },
  });
  assert.equal(JSON.stringify(restored).includes('private'), false);
  assert.deepEqual(parseRivalry(undefined), { history: [] });
  const complete = finish(initial);
  assert.deepEqual(parseRivalry(complete).history, complete.history);
  assert.throws(
    () => parseRivalry({ ...complete, history: [{ ...complete.history[0], userScore: 6 }] }),
    /neplatný/u,
  );
  assert.throws(
    () =>
      parseRivalry({
        ...complete,
        match: { ...complete.match, rounds: Array(5).fill(complete.match!.rounds[0]) },
      }),
    /neplatný/u,
  );
  const forged = structuredClone(initial);
  forged.match!.rounds[0].botCorrect = !forged.match!.rounds[0].botCorrect;
  assert.throws(() => parseRivalry(forged), /neplatný/u);
  assert.throws(() => parseRivalry({ history: Array(31).fill(complete.history[0]) }), /neplatný/u);
});

test('large imported notes cannot produce a match that fails to load on the next move', () => {
  const seed = createSeedData(now);
  const notes = seed.notes.map((note) => ({
    ...note,
    acceptedGerman: Array.from({ length: 200 }, (_, index) => `Variante ${index}`),
    exampleDe: 'Beispiel. '.repeat(900),
    plural: 'Plural '.repeat(1000),
  }));
  const questions = buildRivalQuestions(notes, [], []);
  assert.ok(questions.length);
  for (const question of questions) {
    const initial = start();
    initial.match!.rounds[0] = {
      question,
      move: 'opening',
      botAnswer: question.answer,
      botCorrect: true,
      botStake: 1,
    };
    assert.doesNotThrow(() => parseRivalry(initial));
    assert.equal(rivalAnswerIsCorrect(question, question.answer), true);
  }
  assert.equal(
    buildRivalQuestions([{ ...notes[0], german: 'Wort'.repeat(1000) }], [], []).length,
    0,
  );
});

test('grammar duels keep the actual sentence and required context in both languages', () => {
  const questions = buildRivalQuestions([], [], grammarLessons);
  assert.ok(questions.length > 200);
  for (const question of questions) {
    assert.match(question.prompt.cs, /_{2,}/u);
    assert.match(question.prompt.en, /_{2,}/u);
    assert.doesNotMatch(question.prompt.en, /[áčďéěíňóřšťúůýž]/iu);
    assert.ok(question.explanation.en.includes(question.answer));
    const initial = start();
    initial.match!.rounds[0] = {
      question,
      move: 'opening',
      botAnswer: question.answer,
      botCorrect: true,
      botStake: 1,
    };
    assert.doesNotThrow(() => parseRivalry(initial));
  }
  const friends = questions.find((question) => question.id.endsWith(':imperative-basics-2'))!;
  assert.match(friends.prompt.en, /two friends/u);
});
