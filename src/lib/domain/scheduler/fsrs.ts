import { Rating, createEmptyCard, fsrs } from 'ts-fsrs';

import type { Card, Grade } from 'ts-fsrs';

import type { RatingKey, SerializedFsrsCard, StudyCard } from '../types.ts';
import { hydrateFsrsCard, serializeFsrsCard } from './fsrs-schema.ts';

const ratingMap: Record<RatingKey, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

const ratingOrder: RatingKey[] = ['again', 'hard', 'good', 'easy'];
const schedulerCache = new Map<number, ReturnType<typeof fsrs>>();
const czechTimeFormatter = new Intl.DateTimeFormat('cs-CZ', {
  hour: '2-digit',
  minute: '2-digit',
});
const czechDateTimeFormatter = new Intl.DateTimeFormat('cs-CZ', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const czechDateTimeWithYearFormatter = new Intl.DateTimeFormat('cs-CZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export type SchedulePreviewOption = {
  rating: RatingKey;
  dueAt: string;
  intervalMs: number;
};

function createScheduler(desiredRetention: number) {
  const retention = Math.min(0.97, Math.max(0.75, desiredRetention));
  const cached = schedulerCache.get(retention);
  if (cached) return cached;
  const scheduler = fsrs({
    request_retention: retention,
    maximum_interval: 36_500,
    // A visible preview must match the committed due date exactly.
    enable_fuzz: false,
    enable_short_term: true,
    learning_steps: ['1m', '10m'],
    relearning_steps: ['10m'],
  });
  schedulerCache.set(retention, scheduler);
  return scheduler;
}

function currentFsrsCard(studyCard: StudyCard, now: Date): Card {
  return studyCard.fsrs ? hydrateFsrsCard(studyCard.fsrs) : createEmptyCard(now);
}

export function previewSchedule(
  studyCard: StudyCard,
  desiredRetention: number,
  now = new Date(),
): SchedulePreviewOption[] {
  const scheduler = createScheduler(desiredRetention);
  const current = currentFsrsCard(studyCard, now);
  const preview = scheduler.repeat(current, now);

  return ratingOrder.map((rating) => {
    const card = preview[ratingMap[rating]].card;
    return {
      rating,
      dueAt: card.due.toISOString(),
      intervalMs: Math.max(0, card.due.getTime() - now.getTime()),
    };
  });
}

export function scheduleReview(
  studyCard: StudyCard,
  rating: RatingKey,
  desiredRetention: number,
  now = new Date(),
): { card: StudyCard; before?: SerializedFsrsCard; after: SerializedFsrsCard } {
  const scheduler = createScheduler(desiredRetention);
  const current = currentFsrsCard(studyCard, now);
  const result = scheduler.next(current, now, ratingMap[rating]);
  const after = serializeFsrsCard(result.card);

  return {
    before: studyCard.fsrs,
    after,
    card: {
      ...studyCard,
      dueAt: result.card.due.toISOString(),
      fsrs: after,
      updatedAt: now.toISOString(),
    },
  };
}

export function formatScheduleInterval(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  if (seconds < 45) return 'teď';
  if (seconds < 90) return 'za 1 min';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `za ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `za ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `za ${days} d`;
  const months = Math.round(days / 30.44);
  if (months < 18) return `za ${months} měs.`;
  const years = Math.round((days / 365.25) * 10) / 10;
  return `za ${String(years).replace('.', ',')} r.`;
}

export function formatDueMoment(value: string | Date, now = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'neznámý termín';
  const interval = date.getTime() - now.getTime();
  if (interval < 20 * 60_000) return formatScheduleInterval(interval);

  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return `dnes ${czechTimeFormatter.format(date)}`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `zítra ${czechTimeFormatter.format(date)}`;
  }

  return (
    date.getFullYear() === now.getFullYear()
      ? czechDateTimeFormatter
      : czechDateTimeWithYearFormatter
  ).format(date);
}

export function isMatureFsrsCard(card: StudyCard): boolean {
  const stability = Number(card.fsrs?.stability ?? 0);
  const reps = Number(card.fsrs?.reps ?? 0);
  return reps >= 3 && stability >= 7;
}
