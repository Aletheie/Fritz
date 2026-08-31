import type { CefrLevel, DetailedCefrLevel } from './types.ts';

export const DETAILED_CEFR_LEVELS: DetailedCefrLevel[] = [
  'A1.1',
  'A1.2',
  'A2.1',
  'A2.2',
  'B1.1',
  'B1.2',
  'B2.1',
  'B2.2',
  'C1.1',
  'C1.2',
];

export function isDetailedCefrLevel(value: unknown): value is DetailedCefrLevel {
  return typeof value === 'string' && DETAILED_CEFR_LEVELS.includes(value as DetailedCefrLevel);
}

export function baseCefrLevel(level: DetailedCefrLevel): CefrLevel {
  return level.slice(0, 2) as CefrLevel;
}

export function detailedCefrRank(level: DetailedCefrLevel): number {
  return DETAILED_CEFR_LEVELS.indexOf(level);
}
