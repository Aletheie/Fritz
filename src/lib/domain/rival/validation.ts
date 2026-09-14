import { keyboardFoldGerman } from '../grading/normalize.ts';
import type {
  RivalCopy,
  RivalMatch,
  RivalMatchSummary,
  RivalQuestion,
  RivalRound,
  RivalryState,
} from './types.ts';

function invalid(): never {
  throw new Error('Uložený souboj má neplatný formát.');
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function text(value: unknown, limit = 4_000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) invalid();
  return value;
}
function number(value: unknown, min: number, max: number, integer = true): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    invalid();
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') invalid();
  return value;
}
function choice<T extends string | number>(value: unknown, options: readonly T[]): T {
  if (!options.includes(value as T)) invalid();
  return value as T;
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid();
  return value;
}
function date(value: unknown): string {
  const result = text(value, 40);
  if (!Number.isFinite(Date.parse(result))) invalid();
  return result;
}
function copy(value: unknown): RivalCopy {
  const source = record(value);
  return { cs: text(source.cs), en: text(source.en) };
}
const rivals = ['mila', 'konrad', 'nora'] as const;
const topics = ['recall', 'articles', 'grammar'] as const;

function question(value: unknown): RivalQuestion {
  const source = record(value);
  const accepted = list(source.accepted, 201).map((item) => text(item, 1_000));
  const answer = text(source.answer);
  if (!accepted.some((item) => keyboardFoldGerman(item) === keyboardFoldGerman(answer))) invalid();
  const options = list(source.options, 12).map((item) => text(item));
  if (options.length && !options.includes(answer)) invalid();
  return {
    id: text(source.id, 500),
    sourceId: text(source.sourceId, 500),
    topic: choice(source.topic, topics),
    prompt: copy(source.prompt),
    promptLanguage: choice(source.promptLanguage, ['de', 'ui'] as const),
    answer,
    accepted,
    options,
    explanation: copy(source.explanation),
    difficulty: number(source.difficulty, 1, 3),
    priority: number(source.priority, 0, 6),
  };
}

function round(value: unknown): RivalRound {
  const source = record(value);
  const parsed = question(source.question);
  const botAnswer = text(source.botAnswer);
  const botCorrect = boolean(source.botCorrect);
  if (
    botCorrect !==
    parsed.accepted.some((answer) => keyboardFoldGerman(answer) === keyboardFoldGerman(botAnswer))
  )
    invalid();
  const result = source.result === undefined ? undefined : record(source.result);
  return {
    question: parsed,
    move: choice(source.move, [
      'opening',
      'weakness',
      'counter',
      'raise',
      'retry',
      'switch',
      'variety',
    ] as const),
    botAnswer,
    botCorrect,
    botStake: choice(source.botStake, [1, 2] as const),
    result: result
      ? { correct: boolean(result.correct), stake: choice(result.stake, [1, 2] as const) }
      : undefined,
  };
}

function match(value: unknown): RivalMatch {
  const source = record(value);
  const rounds = list(source.rounds, 5).map(round);
  const discardedSourceIds = list(source.discardedSourceIds, 1).map((item) => text(item, 500));
  if (!rounds.length || rounds.slice(0, -1).some((item) => !item.result)) invalid();
  if (
    rounds.filter((item) => item.botStake === 2).length > 1 ||
    rounds.filter((item) => item.result?.stake === 2).length > 1
  )
    invalid();
  const sources = [...rounds.map((item) => item.question.sourceId), ...discardedSourceIds];
  if (new Set(sources).size !== sources.length) invalid();
  const completedAt = source.completedAt === undefined ? undefined : date(source.completedAt);
  if (Boolean(completedAt) !== (rounds.length === 5 && rounds.every((item) => item.result)))
    invalid();
  const startedAt = date(source.startedAt);
  const updatedAt = date(source.updatedAt);
  if (Date.parse(updatedAt) < Date.parse(startedAt) || (completedAt && completedAt !== updatedAt))
    invalid();
  return {
    id: text(source.id, 200),
    rivalId: choice(source.rivalId, rivals),
    strategy: choice(source.strategy, ['balanced', 'pressure', 'counter'] as const),
    weakness: choice(source.weakness, topics),
    adjustment: number(source.adjustment, -0.2, 0.2, false),
    rounds,
    discardedSourceIds,
    startedAt,
    updatedAt,
    completedAt,
  };
}

function summary(value: unknown): RivalMatchSummary {
  const source = record(value);
  const rounds = list(source.rounds, 5).map((item) => {
    const row = record(item);
    return {
      topic: choice(row.topic, topics),
      correct: boolean(row.correct),
      botCorrect: boolean(row.botCorrect),
    };
  });
  if (rounds.length !== 5) invalid();
  const correct = rounds.filter((item) => item.correct).length;
  const botCorrect = rounds.filter((item) => item.botCorrect).length;
  return {
    id: text(source.id, 200),
    rivalId: choice(source.rivalId, rivals),
    userScore: number(source.userScore, correct, correct + (correct ? 1 : 0)),
    botScore: number(source.botScore, botCorrect, botCorrect + (botCorrect ? 1 : 0)),
    rounds,
    completedAt: date(source.completedAt),
  };
}

export function parseRivalry(value: unknown): RivalryState {
  if (value === undefined) return { history: [] };
  const source = record(value);
  const history = list(source.history, 30).map(summary);
  if (new Set(history.map((item) => item.id)).size !== history.length) invalid();
  const active = source.match === undefined ? undefined : match(source.match);
  if (active?.completedAt) {
    const saved = history.find((item) => item.id === active.id);
    if (!saved || saved.completedAt !== active.completedAt || saved.rivalId !== active.rivalId)
      invalid();
    const userScore = active.rounds.reduce(
      (sum, item) => sum + (item.result?.correct ? item.result.stake : 0),
      0,
    );
    const botScore = active.rounds.reduce(
      (sum, item) => sum + (item.botCorrect ? item.botStake : 0),
      0,
    );
    if (
      saved.userScore !== userScore ||
      saved.botScore !== botScore ||
      active.rounds.some(
        (item, index) =>
          item.question.topic !== saved.rounds[index].topic ||
          item.result?.correct !== saved.rounds[index].correct ||
          item.botCorrect !== saved.rounds[index].botCorrect,
      )
    )
      invalid();
  }
  return { match: active, history };
}
