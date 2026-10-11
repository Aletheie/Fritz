import type { StudyMode, TrainingSourceFilter } from '../types.ts';

export type StudyStartOptions = {
  mode: StudyMode;
  cramDuration: number;
  sessionSize?: number;
  autoStart: boolean;
  resume: boolean;
  distinct: boolean;
  tag: string;
  source: string | null;
};

const SOURCE_FILTERS: TrainingSourceFilter[] = ['all', 'own', 'course', 'without-course'];
const SESSION_SIZES = new Set([5, 10, 20, 30]);

export function parseStudySearchParams(parameters: URLSearchParams): StudyStartOptions {
  const mode: StudyMode = parameters.get('mode') === 'cram' ? 'cram' : 'long-term';
  const parsedMinutes = Number(parameters.get('minutes') ?? 20);
  const requestedSize = parameters.get('size');
  const parsedSize = Number(requestedSize ?? 10);
  return {
    mode,
    cramDuration: Number.isFinite(parsedMinutes) ? Math.min(180, Math.max(5, parsedMinutes)) : 20,
    sessionSize:
      requestedSize === null ? undefined : SESSION_SIZES.has(parsedSize) ? parsedSize : 10,
    autoStart: parameters.get('start') === '1',
    resume: parameters.get('resume') === '1',
    distinct: parameters.get('distinct') === '1',
    tag: parameters.get('tag') || 'all',
    source: parameters.get('source'),
  };
}

export function parseSourceFilter(
  value: string | null,
  fallback: TrainingSourceFilter,
): TrainingSourceFilter {
  return SOURCE_FILTERS.find((filter) => filter === value) ?? fallback;
}
