import { formatDueMoment, formatScheduleInterval } from '$lib/domain/scheduler/fsrs.ts';

import type { MotherTongue } from '$lib/domain/types.ts';

const englishTime = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' });
const englishDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

/** Relative review interval such as "in 3 d". */
export function scheduleIntervalLabel(language: MotherTongue, milliseconds: number): string {
  if (language === 'cs') return formatScheduleInterval(milliseconds);
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  if (seconds < 45) return 'now';
  if (seconds < 90) return 'in 1 min';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} hr`;
  const days = Math.round(hours / 24);
  if (days < 31) return `in ${days} d`;
  const months = Math.round(days / 30.44);
  if (months < 18) return `in ${months} mo`;
  return `in ${Math.round((days / 365.25) * 10) / 10} yr`;
}

/** When a card is due: relative within 20 minutes, then today/tomorrow at a time, then a date. */
export function dueMomentLabel(language: MotherTongue, value: string | Date): string {
  if (language === 'cs') return formatDueMoment(value);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown due date';
  const now = new Date();
  const interval = date.getTime() - now.getTime();
  if (interval < 20 * 60_000) return scheduleIntervalLabel(language, interval);
  const time = englishTime.format(date);
  if (date.toDateString() === now.toDateString()) return `today at ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return `tomorrow at ${time}`;
  return englishDate.format(date);
}
