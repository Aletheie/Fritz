import {
  MISTAKE_TAGS,
  type MistakeTag,
  type StudyMode,
  type TrainingSourceFilter,
} from '../types.ts';

export type StudyStartOptions = {
  mode: StudyMode;
  cramDuration: number;
  sessionSize?: number;
  autoStart: boolean;
  resume: boolean;
  distinct: boolean;
  tag: string;
  /** A weak-spot sprint over recently missed words, optionally for one mistake type. */
  weakSpot?: MistakeTag | 'any';
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
    weakSpot: parseWeakSpot(parameters),
    source: parameters.get('source'),
  };
}

export function parseSourceFilter(
  value: string | null,
  fallback: TrainingSourceFilter,
): TrainingSourceFilter {
  return SOURCE_FILTERS.find((filter) => filter === value) ?? fallback;
}

function parseWeakSpot(parameters: URLSearchParams): MistakeTag | 'any' | undefined {
  if (parameters.get('focus') !== 'weak') return undefined;
  const mistake = parameters.get('mistake');
  return MISTAKE_TAGS.find((tag) => tag === mistake) ?? 'any';
}

/** Link to a weak-spot sprint; sprints never move long-term review dates. */
export function weakSpotStudyHref(mistake?: MistakeTag, minutes = 10): string {
  const query = new URLSearchParams({
    mode: 'cram',
    focus: 'weak',
    minutes: String(minutes),
    start: '1',
  });
  if (mistake) query.set('mistake', mistake);
  return `/study/?${query}`;
}
