import { stableHash, stableShuffle } from '../deterministic.ts';
import { keyboardFoldGerman } from '../grading/normalize.ts';
import { isCountedReview } from '../stats/learning.ts';
import type { CourseAnswerEvent, ReviewLog } from '../types.ts';
import type {
  RivalAction,
  RivalId,
  RivalMatch,
  RivalMatchSummary,
  RivalMove,
  RivalQuestion,
  RivalReading,
  RivalRound,
  RivalryState,
  RivalTopic,
} from './types.ts';

export const RIVAL_ROUNDS = 5;
export const RIVAL_HISTORY_LIMIT = 30;
export const RIVAL_TOPICS: RivalTopic[] = ['recall', 'articles', 'grammar'];

export const RIVAL_SKILLS: Record<RivalId, Record<RivalTopic, number>> = {
  mila: { recall: 0.76, articles: 0.57, grammar: 0.9 },
  konrad: { recall: 0.9, articles: 0.74, grammar: 0.57 },
  nora: { recall: 0.57, articles: 0.9, grammar: 0.76 },
};

export function rivalWeakness(id: RivalId): RivalTopic {
  return RIVAL_TOPICS.toSorted((a, b) => RIVAL_SKILLS[id][a] - RIVAL_SKILLS[id][b])[0];
}

export function readLearner(
  reviews: ReviewLog[],
  grammar: CourseAnswerEvent[] = [],
  now = new Date(),
): RivalReading {
  const since = now.getTime() - 30 * 86_400_000;
  const topics = RIVAL_TOPICS.map((topic) => ({ topic, attempts: 0, correct: 0 }));
  const [recall, articles, syntax] = topics;
  const recent = reviews
    .filter(
      (review) =>
        isCountedReview(review) && review.mode !== 'cram' && Date.parse(review.reviewedAt) >= since,
    )
    .slice(0, 80);
  for (const review of recent) {
    recall.attempts += 1;
    if (review.signal.wordCorrect) recall.correct += 1;
    if (review.signal.selectedArticle || !review.signal.articleCorrect) {
      articles.attempts += 1;
      if (review.signal.articleCorrect) articles.correct += 1;
    }
  }
  const recentGrammar = grammar.filter((event) => Date.parse(event.answeredAt) >= since).slice(-40);
  for (const event of recentGrammar) {
    syntax.attempts += 1;
    if (event.correct) syntax.correct += 1;
  }
  const observed = topics.filter((topic) => topic.attempts >= 3);
  const weakest = observed.toSorted(
    (a, b) => (a.correct + 1) / (a.attempts + 2) - (b.correct + 1) / (b.attempts + 2),
  )[0];
  return {
    observations: recent.length + recentGrammar.length,
    weakness: weakest?.topic ?? 'recall',
    topics,
  };
}

export function rivalScore(match: RivalMatch): { user: number; bot: number } {
  let user = 0;
  let bot = 0;
  for (const round of match.rounds) {
    if (!round.result) continue;
    if (round.result.correct) user += round.result.stake;
    if (round.botCorrect) bot += round.botStake;
  }
  return { user, bot };
}

export function rivalAnswerIsCorrect(question: RivalQuestion, answer: string): boolean {
  const normalized = keyboardFoldGerman(answer);
  return question.accepted.some((accepted) => keyboardFoldGerman(accepted) === normalized);
}

function random(seed: string): number {
  return (stableHash(seed) % 10_000) / 10_000;
}

function nextMove(match: RivalMatch): { topic: RivalTopic; move: RivalMove; difficulty: number } {
  const last = match.rounds.at(-1);
  const recent = match.rounds.slice(-2);
  if (match.strategy === 'counter' && match.rounds.length % 2 === 0) {
    return { topic: rivalWeakness(match.rivalId), move: 'counter', difficulty: 2 };
  }
  if (
    last?.result &&
    !last.result.correct &&
    recent.filter((round) => round.question.topic === last.question.topic).length < 2
  ) {
    return {
      topic: last.question.topic,
      move: 'retry',
      difficulty: Math.max(1, last.question.difficulty - 1),
    };
  }
  if (recent.length === 2 && recent.every((round) => round.result?.correct)) {
    return { topic: RIVAL_TOPICS[match.rounds.length % 3], move: 'raise', difficulty: 3 };
  }
  if (match.rounds.length === 0 || match.rounds.length === 2) {
    return {
      topic: match.weakness,
      move: match.rounds.length ? 'weakness' : 'opening',
      difficulty: match.strategy === 'pressure' ? 3 : 1,
    };
  }
  const topic =
    RIVAL_TOPICS.find(
      (candidate) =>
        candidate !== last?.question.topic &&
        !recent.some((round) => round.question.topic === candidate),
    ) ?? 'grammar';
  return { topic, move: 'variety', difficulty: match.strategy === 'pressure' ? 3 : 2 };
}

function chooseRound(match: RivalMatch, pool: RivalQuestion[], switching = false): RivalRound {
  const seen = new Set([
    ...match.rounds.map((round) => round.question.sourceId),
    ...match.discardedSourceIds,
  ]);
  const plan = nextMove(match);
  const candidates = pool.filter((question) => !seen.has(question.sourceId));
  if (!candidates.length)
    throw new Error('Pro další kolo chybí nové otázky. Přidej pár slov do knihovny.');
  const seed = `${match.id}:${match.rounds.length}:${match.discardedSourceIds.length}`;
  const question = candidates.toSorted((a, b) => {
    const score = (value: RivalQuestion) =>
      (value.topic === plan.topic ? 20 : 0) -
      Math.abs(value.difficulty - plan.difficulty) * 3 +
      value.priority;
    return score(b) - score(a) || stableHash(`${seed}:${a.id}`) - stableHash(`${seed}:${b.id}`);
  })[0];
  const chance = Math.min(
    0.94,
    Math.max(
      0.35,
      RIVAL_SKILLS[match.rivalId][question.topic] +
        match.adjustment -
        (question.difficulty - 1) * 0.07,
    ),
  );
  const wrong = question.options.filter((option) => !rivalAnswerIsCorrect(question, option));
  const botCorrect = random(`${seed}:${question.id}:answer`) < chance;
  const botAnswer = botCorrect
    ? question.answer
    : (wrong[stableHash(`${seed}:wrong`) % wrong.length] ?? '—');
  const botCanBoost = !match.rounds.some((round) => round.botStake === 2);
  const botStake =
    botCanBoost && (chance >= 0.78 || match.rounds.length === RIVAL_ROUNDS - 1) ? 2 : 1;
  return {
    question: { ...question, options: stableShuffle(question.options, `${seed}:options`, false) },
    move: switching ? 'switch' : question.topic === plan.topic ? plan.move : 'variety',
    botAnswer,
    botCorrect,
    botStake,
  };
}

function summarize(match: RivalMatch): RivalMatchSummary {
  const score = rivalScore(match);
  return {
    id: match.id,
    rivalId: match.rivalId,
    userScore: score.user,
    botScore: score.bot,
    rounds: match.rounds.map((round) => ({
      topic: round.question.topic,
      correct: round.result!.correct,
      botCorrect: round.botCorrect,
    })),
    completedAt: match.completedAt!,
  };
}

export function updateRivalry(
  state: RivalryState,
  action: RivalAction,
  pool: RivalQuestion[] = [],
  now = new Date(),
): RivalryState {
  const timestamp = now.toISOString();
  if (action.type === 'start') {
    if (state.match && !state.match.completedAt) return state;
    if (state.history.some((match) => match.id === action.id)) return state;
    if (new Set(pool.map((question) => question.sourceId)).size < RIVAL_ROUNDS + 1) {
      throw new Error(
        'Na souboj je potřeba alespoň šest různých otázek. Přidej slovíčka nebo zvol úroveň kurzu.',
      );
    }
    const recent = state.history.filter((match) => match.rivalId === action.rivalId).slice(-5);
    const adjustment = recent.reduce(
      (sum, match) => sum + Math.sign(match.userScore - match.botScore) * 0.035,
      0,
    );
    const lastMatch = recent.at(-1);
    const missedTopics = RIVAL_TOPICS.map((topic) => ({
      topic,
      misses:
        lastMatch?.rounds.filter((round) => round.topic === topic && !round.correct).length ?? 0,
    }));
    const lastWeakness = missedTopics.toSorted((a, b) => b.misses - a.misses)[0];
    const match: RivalMatch = {
      id: action.id,
      rivalId: action.rivalId,
      strategy: action.strategy,
      weakness: lastWeakness.misses ? lastWeakness.topic : action.weakness,
      adjustment,
      rounds: [],
      discardedSourceIds: [],
      startedAt: timestamp,
      updatedAt: timestamp,
    };
    match.rounds = [chooseRound(match, pool)];
    return { ...state, match };
  }

  const match = state.match;
  if (!match || match.id !== action.matchId)
    throw new Error('Tento souboj už není otevřený. Načti aktuální zápas.');
  const round = match.rounds.at(-1)!;
  if (
    action.type === 'answer' &&
    match.rounds.some((item) => item.question.id === action.questionId && item.result)
  )
    return state;
  if (
    action.type === 'next' &&
    round.question.id !== action.questionId &&
    match.rounds.some((item) => item.question.id === action.questionId && item.result)
  )
    return state;
  if (round.question.id !== action.questionId || match.completedAt)
    throw new Error('Souboj se mezitím změnil. Pokračuj aktuálním kolem.');

  if (action.type === 'answer') {
    if (action.stake === 2 && match.rounds.some((item) => item.result?.stake === 2))
      throw new Error('Dvojnásobnou sázku už máš využitou.');
    const answered: RivalRound = {
      ...round,
      result: { correct: rivalAnswerIsCorrect(round.question, action.answer), stake: action.stake },
    };
    const next: RivalMatch = {
      ...match,
      rounds: [...match.rounds.slice(0, -1), answered],
      updatedAt: timestamp,
    };
    if (next.rounds.length === RIVAL_ROUNDS) next.completedAt = timestamp;
    return {
      match: next,
      history: next.completedAt
        ? [...state.history, summarize(next)].slice(-RIVAL_HISTORY_LIMIT)
        : state.history,
    };
  }
  if (action.type === 'switch') {
    if (round.result || match.discardedSourceIds.length)
      throw new Error('Výměna otázky je možná jednou, před odpovědí.');
    const next = {
      ...match,
      rounds: match.rounds.slice(0, -1),
      discardedSourceIds: [round.question.sourceId],
      updatedAt: timestamp,
    };
    return {
      ...state,
      match: { ...next, rounds: [...next.rounds, chooseRound(next, pool, true)] },
    };
  }
  if (!round.result) throw new Error('Nejdřív odpověz na otevřenou otázku.');
  return {
    ...state,
    match: { ...match, rounds: [...match.rounds, chooseRound(match, pool)], updatedAt: timestamp },
  };
}
