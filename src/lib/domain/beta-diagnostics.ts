import type { DailySessionRecord, LearningEvidence } from './learning/types.ts';
import type { ReviewStats } from './stats/review-stats.ts';
import type { AppSettings, CourseProgress, Note, ReviewLog, ReviewDisputeReason } from './types.ts';

type DiagnosticNote = Pick<Note, 'id' | 'source' | 'courseLinks'>;

export type BetaDiagnosticsInput = {
  appVersion: string;
  databaseVersion: number;
  generatedAt?: Date;
  counts: {
    decks: number;
    notes: number;
    cards: number;
  };
  settings: Pick<
    AppSettings,
    | 'schemaVersion'
    | 'grammarLevel'
    | 'learningGoal'
    | 'dailyMinutes'
    | 'studyPace'
    | 'reduceMotion'
  >;
  reviewStats: ReviewStats;
  recentReviews: ReviewLog[];
  learningEvidence: LearningEvidence[];
  dailySessions: DailySessionRecord[];
  course: CourseProgress;
  notes: DiagnosticNote[];
};

type ContentIssue = {
  source: Note['source'] | 'unknown';
  exercise: ReviewLog['exercise'];
  reference?: string;
  count: number;
};

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function countBy<T>(values: readonly T[], key: (value: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) increment(counts, key(value));
  return counts;
}

function dayNumber(day: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(day)) return undefined;
  const [year, month, date] = day.split('-').map(Number);
  const value = Date.UTC(year, month - 1, date);
  return Number.isFinite(value) ? Math.floor(value / 86_400_000) : undefined;
}

function returnDaySummary(days: readonly string[]): {
  activeDays: number;
  day2: boolean;
  day3: boolean;
  day7: boolean;
} {
  const numbered = [...new Set(days.map(dayNumber).filter((day) => day !== undefined))].toSorted(
    (left, right) => left - right,
  );
  const first = numbered[0];
  const offsets = new Set(first === undefined ? [] : numbered.map((day) => day - first));
  return {
    activeDays: numbered.length,
    day2: offsets.has(1),
    day3: offsets.has(2),
    day7: offsets.has(6),
  };
}

function latencyBuckets(reviews: readonly ReviewLog[]): Record<string, number> {
  const buckets = { under3s: 0, from3To10s: 0, over10s: 0 };
  for (const review of reviews) {
    const responseMs = Math.max(0, review.signal.responseMs);
    if (responseMs < 3_000) buckets.under3s += 1;
    else if (responseMs <= 10_000) buckets.from3To10s += 1;
    else buckets.over10s += 1;
  }
  return buckets;
}

function contentIssues(
  reviews: readonly ReviewLog[],
  notes: readonly DiagnosticNote[],
): ContentIssue[] {
  const noteById = new Map(notes.map((note) => [note.id, note]));
  const grouped = new Map<string, ContentIssue>();
  for (const review of reviews) {
    if (review.disputeReason !== 'content-error') continue;
    const note = noteById.get(review.noteId);
    const source = note?.source ?? 'unknown';
    const courseReference = note?.courseLinks?.at(-1)?.nodeId;
    const seedReference = note?.id.startsWith('note_seed_') ? note.id : undefined;
    const reference = courseReference ?? seedReference;
    const key = `${source}:${review.exercise}:${reference ?? 'private'}`;
    const current = grouped.get(key);
    grouped.set(key, {
      source,
      exercise: review.exercise,
      ...(reference ? { reference } : {}),
      count: (current?.count ?? 0) + 1,
    });
  }
  return [...grouped.values()].toSorted((left, right) => right.count - left.count);
}

function disputeCounts(reviews: readonly ReviewLog[]): Record<ReviewDisputeReason, number> {
  const result: Record<ReviewDisputeReason, number> = {
    'ai-too-strict': 0,
    'content-error': 0,
    other: 0,
  };
  for (const review of reviews) {
    if (review.disputeReason) result[review.disputeReason] += 1;
  }
  return result;
}

export function createBetaDiagnostics(input: BetaDiagnosticsInput) {
  const startedSessions = input.dailySessions.filter(
    (session) => Boolean(session.startedAt) || session.cursor > 0,
  );
  const completedSessions = input.dailySessions.filter((session) => Boolean(session.completedAt));
  const activityDays = [
    ...input.reviewStats.activityDays,
    ...startedSessions.map((session) => session.plan.localDay),
    ...input.learningEvidence.map((evidence) => evidence.localDay),
  ];
  const pathProgress = Object.values(input.course.pathNodes);
  const completedPathNodes = pathProgress.filter((node) => Boolean(node.completedAt)).length;
  const startedPathNodes = pathProgress.filter(
    (node) => Boolean(node.startedAt) || Boolean(node.completedAt),
  ).length;
  const correctCourseAnswers = input.course.events.filter((event) => event.correct).length;
  const independentCourseAnswers = input.course.events.filter(
    (event) => event.correct && event.firstTry,
  ).length;

  return {
    format: 'fritz-beta-diagnostics',
    schemaVersion: 1,
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    app: {
      version: input.appVersion,
      databaseVersion: input.databaseVersion,
      settingsSchemaVersion: input.settings.schemaVersion,
      courseContentVersion: input.course.contentVersion,
    },
    learnerSetup: {
      grammarLevel: input.settings.grammarLevel,
      learningGoal: input.settings.learningGoal,
      dailyMinutes: input.settings.dailyMinutes,
      studyPace: input.settings.studyPace,
      reduceMotion: input.settings.reduceMotion,
    },
    library: input.counts,
    retention: {
      activeDays: returnDaySummary(activityDays),
      dailyLessons: {
        created: input.dailySessions.length,
        started: startedSessions.length,
        completed: completedSessions.length,
        unfinished: Math.max(0, startedSessions.length - completedSessions.length),
      },
    },
    reviews: {
      total: input.reviewStats.totalReviews,
      counted: input.reviewStats.countedReviews,
      unassisted: input.reviewStats.unassistedAnswers,
      typing: input.reviewStats.typingAnswers,
      recentWindow: input.recentReviews.length,
      byRating: countBy(input.recentReviews, (review) => review.rating),
      byExercise: countBy(input.recentReviews, (review) => review.exercise),
      byMode: countBy(input.recentReviews, (review) => review.mode),
      responseTime: latencyBuckets(input.recentReviews),
      disputes: disputeCounts(input.recentReviews),
    },
    learningEvidence: {
      total: input.learningEvidence.length,
      bySource: countBy(input.learningEvidence, (evidence) => evidence.source),
      byModality: countBy(input.learningEvidence, (evidence) => evidence.modality),
      byOutcome: countBy(input.learningEvidence, (evidence) => evidence.outcome),
    },
    course: {
      startedPathNodes,
      completedPathNodes,
      answers: input.course.events.length,
      correctAnswers: correctCourseAnswers,
      independentCorrectAnswers: independentCourseAnswers,
      coachSessions: input.course.coachEvents.length,
      completedStoryEpisodes: Object.values(input.course.storyBooks).reduce(
        (total, book) => total + book.completedEpisodeIds.length,
        0,
      ),
    },
    contentIssues: contentIssues(input.recentReviews, input.notes),
    privacy: {
      included: 'Pouze počty, nastavení učebního plánu a anonymní technické verze.',
      omitted: [
        'jméno profilu',
        'německé a české odpovědi',
        'text poznámek a vlastních slovíček',
        'AI prompty a konverzace',
        'cookies, klíče a identifikátory zařízení',
        'absolutní dny studia',
      ],
    },
  } as const;
}
