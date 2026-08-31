import { masteryTier } from '../gamification.ts';
import { formatDueMoment, formatScheduleInterval } from './fsrs.ts';

import type { MasteryTier } from '../gamification.ts';
import type { StudyCard } from '../types.ts';

export type CardLearningStatus = {
  tier: MasteryTier;
  dueLabel: string;
  exactDueLabel: string;
  detail: string;
  dueNow: boolean;
};

function safeMetric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function repetitionLabel(count: number): string {
  if (count === 1) return '1 opakování';
  if (count >= 2 && count <= 4) return `${count} opakování`;
  return `${count} opakování`;
}

function stabilityLabel(value: number): string {
  if (value < 1) return 'stabilita pod 1 den';
  const rounded = Math.round(value);
  if (rounded === 1) return 'stabilita 1 den';
  if (rounded >= 2 && rounded <= 4) return `stabilita ${rounded} dny`;
  return `stabilita ${rounded} dní`;
}

export function cardLearningStatus(card: StudyCard, now = new Date()): CardLearningStatus {
  const dueAt = Date.parse(card.dueAt);
  const dueNow = !Number.isFinite(dueAt) || dueAt <= now.getTime();
  const reps = Math.round(safeMetric(card.fsrs?.reps));
  const stability = safeMetric(card.fsrs?.stability);
  const tier = masteryTier(card);

  return {
    tier,
    dueNow,
    dueLabel: !card.fsrs
      ? dueNow
        ? 'Připravené dnes'
        : `Nové ${formatScheduleInterval(dueAt - now.getTime())}`
      : dueNow
        ? 'Splatné teď'
        : `Další ${formatScheduleInterval(dueAt - now.getTime())}`,
    exactDueLabel: Number.isFinite(dueAt) ? formatDueMoment(card.dueAt, now) : 'Neznámý termín',
    detail:
      reps === 0
        ? 'Zatím bez opakování'
        : tier === 'learning'
          ? `${repetitionLabel(reps)} · paměť se buduje`
          : `${repetitionLabel(reps)} · ${stabilityLabel(stability)}`,
  };
}
