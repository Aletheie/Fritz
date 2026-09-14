import { normalizeText } from '../grading/normalize.ts';

import type { AnswerSignal, MistakeTag, Note, ReviewLog } from '../types.ts';

const SEPARABLE_PREFIXES = [
  'ab',
  'an',
  'auf',
  'aus',
  'ein',
  'fest',
  'mit',
  'nach',
  'vor',
  'weg',
  'zu',
  'zurück',
] as const;

const PREPOSITIONS = new Set([
  'an',
  'auf',
  'aus',
  'bei',
  'durch',
  'für',
  'gegen',
  'in',
  'mit',
  'nach',
  'ohne',
  'seit',
  'über',
  'um',
  'unter',
  'von',
  'vor',
  'zu',
  'zwischen',
]);

function tokens(value: string | undefined): string[] {
  return normalizeText(value ?? '')
    .split(/\s+/u)
    .filter(Boolean);
}

function differsAtPreposition(signal: AnswerSignal): boolean {
  const expected = tokens(signal.expectedText);
  const submitted = tokens(signal.submittedText);
  const expectedPrepositions = expected.filter((token) => PREPOSITIONS.has(token));
  const submittedPrepositions = submitted.filter((token) => PREPOSITIONS.has(token));
  return (
    expectedPrepositions.length > 0 &&
    expectedPrepositions.join('|') !== submittedPrepositions.join('|')
  );
}

function missesSeparablePrefix(note: Note, signal: AnswerSignal): boolean {
  if (note.kind !== 'verb' || signal.wordCorrect) return false;
  const normalized = normalizeText(note.german);
  const prefix = SEPARABLE_PREFIXES.find(
    (candidate) => normalized.startsWith(candidate) && normalized.length > candidate.length + 4,
  );
  if (!prefix) return false;
  const submitted = tokens(signal.submittedText);
  return (
    !submitted.includes(prefix) && !normalizeText(signal.submittedText ?? '').startsWith(prefix)
  );
}

export function classifyMistakes(input: {
  signal: AnswerSignal;
  note: Note;
  objectiveIds?: string[];
}): MistakeTag[] {
  const { signal, note } = input;
  const tags = new Set<MistakeTag>();

  if (!signal.articleCorrect) {
    tags.add('article');
    tags.add('gender');
  }
  if (signal.keyboardEquivalent || (!signal.wordCorrect && signal.editDistance <= 2)) {
    tags.add('spelling');
  }
  if (!signal.wordCorrect) {
    if (signal.exercise === 'choice' || signal.exercise === 'matching') tags.add('meaning');
    if (signal.exercise === 'word-order') tags.add('word-order');
    if (differsAtPreposition(signal)) tags.add('preposition');
    if (missesSeparablePrefix(note, signal)) tags.add('separable-prefix');
    if (note.kind === 'verb' && !tags.has('separable-prefix')) tags.add('verb-form');
    if (note.kind === 'noun' && signal.articleCorrect && signal.exercise === 'cloze') {
      tags.add('case');
    }
  }
  const objectives = input.objectiveIds ?? [];
  if (!signal.wordCorrect && objectives.some((id) => /negation|nicht|kein/iu.test(id))) {
    tags.add('negation');
  }
  if (!signal.wordCorrect && objectives.some((id) => /register|style|tone/iu.test(id))) {
    tags.add('register');
  }
  if (signal.wordCorrect && (signal.hintsUsed > 0 || signal.responseMs > 12_000)) {
    tags.add('fluency');
  }
  if (!signal.wordCorrect && tags.size === 0) tags.add('unknown');
  return [...tags];
}

export type MistakeCluster = {
  tag: MistakeTag;
  count: number;
  noteIds: string[];
  lastSeenAt: string;
};

export function aggregateMistakes(reviews: ReviewLog[], since?: Date): MistakeCluster[] {
  const minimum = since?.getTime() ?? Number.NEGATIVE_INFINITY;
  const buckets = new Map<
    MistakeTag,
    { count: number; noteIds: Set<string>; lastSeenAt: string }
  >();
  for (const review of reviews) {
    if (review.excludedFromLearning) continue;
    if (Date.parse(review.reviewedAt) < minimum) continue;
    for (const tag of review.mistakeTags ?? []) {
      const current = buckets.get(tag) ?? {
        count: 0,
        noteIds: new Set(),
        lastSeenAt: review.reviewedAt,
      };
      current.count += 1;
      current.noteIds.add(review.noteId);
      if (review.reviewedAt > current.lastSeenAt) current.lastSeenAt = review.reviewedAt;
      buckets.set(tag, current);
    }
  }
  return [...buckets.entries()]
    .map(([tag, value]) => ({
      tag,
      count: value.count,
      noteIds: [...value.noteIds],
      lastSeenAt: value.lastSeenAt,
    }))
    .toSorted(
      (left, right) => right.count - left.count || right.lastSeenAt.localeCompare(left.lastSeenAt),
    );
}

const activityForTag: Record<MistakeTag, string> = {
  article: 'Procvič si členy u podstatných jmen ve větách.',
  gender: 'Roztřiď podstatná jména podle rodu.',
  plural: 'Zkus napsat množné číslo bez nápovědy.',
  'verb-form': 'Procvič si časování a nepravidelné tvary sloves.',
  auxiliary: 'Procvič si, kdy v perfektu použít haben a kdy sein.',
  'separable-prefix': 'Sestav větu se slovesem s odlučitelnou předponou.',
  'word-order': 'Seřaď slova do správné německé věty.',
  case: 'Doplň do věty člen ve správném pádu.',
  preposition: 'Zopakuj si, které předložky patří ke slovesům.',
  negation: 'Procvič si rozdíl mezi nicht a kein.',
  spelling: 'Opiš správný tvar, pak ho zkus napsat zpaměti.',
  meaning: 'Porovnej významy dvou slov, která se ti pletou.',
  register: 'Přepiš sdělení tak, aby se hodilo k dané situaci.',
  fluency: 'Zkus si slovo vybavit bez nápovědy. Nespěchej.',
  unknown: 'Zkus krátké cvičení a projdi si vysvětlení odpovědi.',
};

export type WeeklyLearningReport = {
  from: string;
  to: string;
  totalReviews: number;
  longTermReviews: number;
  cramReviews: number;
  activeDays: number;
  topMistakes: MistakeCluster[];
  recommendations: string[];
};

export function buildWeeklyLearningReport(
  reviews: ReviewLog[],
  now = new Date(),
): WeeklyLearningReport {
  const from = new Date(now);
  from.setDate(from.getDate() - 6);
  from.setHours(0, 0, 0, 0);
  const recent = reviews.filter((review) => {
    if (review.excludedFromLearning) return false;
    const timestamp = Date.parse(review.reviewedAt);
    return timestamp >= from.getTime() && timestamp <= now.getTime();
  });
  const clusters = aggregateMistakes(recent);
  const recommendations = clusters.slice(0, 3).map((cluster) => activityForTag[cluster.tag]);
  if (recommendations.length === 0) {
    recommendations.push('Pokračuj podle svého plánu opakování.');
  }
  return {
    from: from.toISOString(),
    to: now.toISOString(),
    totalReviews: recent.length,
    longTermReviews: recent.filter((review) => review.mode === 'long-term').length,
    cramReviews: recent.filter((review) => review.mode === 'cram').length,
    activeDays: new Set(recent.map((review) => review.localDay ?? review.reviewedAt.slice(0, 10)))
      .size,
    topMistakes: clusters.slice(0, 5),
    recommendations,
  };
}
