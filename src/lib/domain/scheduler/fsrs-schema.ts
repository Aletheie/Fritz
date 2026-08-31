import type { Card } from 'ts-fsrs';

import type { SerializedFsrsCard } from '../types.ts';

export const FSRS_SCHEMA_VERSION = 1;

const MAX_COUNTER = 10_000_000;
const MAX_DAYS = 3_650_000;
const MAX_DECIMAL = 1_000_000_000;

export class FsrsCorruptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FsrsCorruptionError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown, field: string, optional = false): string | undefined {
  if (optional && (value === undefined || value === null || value === '')) return undefined;
  if (typeof value !== 'string' || value.length > 100) {
    throw new FsrsCorruptionError(`FSRS obsahuje neplatné datum „${field}“.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new FsrsCorruptionError(`FSRS obsahuje neplatné datum „${field}“.`);
  }
  return date.toISOString();
}

function parseNumber(
  record: Record<string, unknown>,
  field: string,
  options: { integer?: boolean; max: number },
): number {
  const value = record[field];
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > options.max ||
    (options.integer && !Number.isInteger(value))
  ) {
    throw new FsrsCorruptionError(`FSRS obsahuje neplatné pole „${field}“.`);
  }
  return value;
}

/**
 * Parses the exact serialized shape used by ts-fsrs 5.x. Older Fritz cards did
 * not carry an explicit schema marker, so a complete legacy shape is accepted
 * once and canonicalized to schema version 1. Partial objects are never repaired
 * by inventing scheduler state.
 */
export function parseSerializedFsrsCard(value: unknown): SerializedFsrsCard {
  if (!isRecord(value)) throw new FsrsCorruptionError('FSRS stav není objekt.');
  if (value.schemaVersion !== undefined && value.schemaVersion !== FSRS_SCHEMA_VERSION) {
    throw new FsrsCorruptionError(
      `Nepodporovaná verze FSRS stavu: ${String(value.schemaVersion)}.`,
    );
  }

  const due = parseDate(value.due, 'due') as string;
  const lastReview = parseDate(value.last_review, 'last_review', true);
  const stability = parseNumber(value, 'stability', { max: MAX_DECIMAL });
  const difficulty = parseNumber(value, 'difficulty', { max: MAX_DECIMAL });
  const elapsedDays = parseNumber(value, 'elapsed_days', { integer: true, max: MAX_DAYS });
  const scheduledDays = parseNumber(value, 'scheduled_days', { integer: true, max: MAX_DAYS });
  const reps = parseNumber(value, 'reps', { integer: true, max: MAX_COUNTER });
  const lapses = parseNumber(value, 'lapses', { integer: true, max: MAX_COUNTER });
  const learningSteps = parseNumber(value, 'learning_steps', {
    integer: true,
    max: MAX_COUNTER,
  });
  const state = parseNumber(value, 'state', { integer: true, max: 3 });

  if (lapses > reps) {
    throw new FsrsCorruptionError('FSRS má více lapsů než opakování.');
  }
  if (
    lastReview &&
    new Date(lastReview).getTime() > new Date(due).getTime() + MAX_DAYS * 86_400_000
  ) {
    throw new FsrsCorruptionError('FSRS datum posledního opakování je mimo bezpečný rozsah.');
  }

  return {
    schemaVersion: FSRS_SCHEMA_VERSION,
    due,
    stability,
    difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: scheduledDays,
    reps,
    lapses,
    learning_steps: learningSteps,
    state,
    last_review: lastReview,
  };
}

export function serializeFsrsCard(card: Card): SerializedFsrsCard {
  return parseSerializedFsrsCard({
    schemaVersion: FSRS_SCHEMA_VERSION,
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString(),
  });
}

export function hydrateFsrsCard(value: unknown): Card {
  const parsed = parseSerializedFsrsCard(value);
  return {
    due: new Date(parsed.due as string),
    stability: parsed.stability as number,
    difficulty: parsed.difficulty as number,
    elapsed_days: parsed.elapsed_days as number,
    scheduled_days: parsed.scheduled_days as number,
    reps: parsed.reps as number,
    lapses: parsed.lapses as number,
    learning_steps: parsed.learning_steps as number,
    state: parsed.state as Card['state'],
    last_review: parsed.last_review ? new Date(parsed.last_review as string) : undefined,
  };
}

export function assertFsrsDueMatchesCard(fsrs: SerializedFsrsCard, dueAt: string): void {
  const fsrsDue = new Date(String(fsrs.due)).getTime();
  const cardDue = new Date(dueAt).getTime();
  if (fsrsDue !== cardDue) {
    throw new FsrsCorruptionError('Termín karty neodpovídá termínu uvnitř FSRS stavu.');
  }
}
