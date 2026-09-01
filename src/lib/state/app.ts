import { derived, get, writable } from 'svelte/store';
import { subscribeDatabaseSync } from '../data/db.ts';

import {
  addImportedNotes,
  exportBackup,
  loadOrCreateDailySession,
  loadSnapshot,
  recordReview,
  disputeReview as disputeStoredReview,
  removeNote,
  saveCoachSession,
  saveCourseAnswer,
  saveCourseRewardClaim,
  saveGrammarLessonRun,
  savePathNodeCompletion,
  savePathNodeStart,
  saveStoryCheckpoint,
  saveStoryEpisode,
  saveStoryPage,
  saveStoryWord,
  saveVocabularyPathNodeCompletion,
  saveDoubleXpPurchase,
  saveDailyActivityResult,
  resetToSeed,
  restoreBackup,
  rollbackIsAvailable,
  rollbackLastDestructiveChange,
  saveNote,
  saveSettings,
} from '../data/repository.ts';
import {
  createBackupPreview,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
} from '../domain/backup/encrypted.ts';
import type { BackupPreview, EncryptedBackupEnvelope } from '../domain/backup/encrypted.ts';
import {
  creditedCoachTurnsOnDay,
  courseAnswersOnDay,
  createCourseProgress,
} from '../domain/course/course-progress.ts';
import { dailyLearningTargets } from '../domain/course/daily.ts';
import { activeDoubleXp, availableXpBalance } from '../domain/course/wallet.ts';
import { gamificationSummary } from '../domain/gamification.ts';
import { createId } from '../domain/id.ts';
import { learningEvidenceFromCoachSession } from '../domain/learning/evidence.ts';
import { applyEvidenceToSkillState, deriveSkillStates } from '../domain/learning/skills.ts';
import type { DailySessionRecord, LearningEvidence, SkillState } from '../domain/learning/types.ts';
import { selectDueCards } from '../domain/scheduler/queue.ts';
import { localDateKey, remainingDailyNewCards, reviewsOnDay } from '../domain/stats/learning.ts';
import {
  appendReviewStats,
  createReviewStats,
  type ReviewStats,
} from '../domain/stats/review-stats.ts';
import type { StoryBookId, StoryExerciseResult } from '../domain/stories/types.ts';
import type {
  AnswerSignal,
  AppBackup,
  AppSettings,
  CourseProgress,
  Deck,
  ImportedNoteDraft,
  Note,
  RatingKey,
  ReviewDisputeReason,
  ReviewLog,
  StudyCard,
  StudyMode,
} from '../domain/types.ts';

export type AppState = {
  ready: boolean;
  loading: boolean;
  error?: string;
  decks: Deck[];
  notes: Note[];
  cards: StudyCard[];
  recentReviews: ReviewLog[];
  reviewStats: ReviewStats;
  learningEvidence: LearningEvidence[];
  skillStates: SkillState[];
  dailySessions: DailySessionRecord[];
  dailySession?: DailySessionRecord;
  settings?: AppSettings;
  course: CourseProgress;
};

const initialState: AppState = {
  ready: false,
  loading: false,
  decks: [],
  notes: [],
  cards: [],
  recentReviews: [],
  reviewStats: createReviewStats(new Date(0)),
  learningEvidence: [],
  skillStates: [],
  dailySessions: [],
  course: createCourseProgress(new Date(0)),
};

const state = writable<AppState>(initialState);
const clock = writable(Date.now());
let initialization: Promise<void> | undefined;
let remoteRefresh: Promise<void> | undefined;
let remoteRefreshPending = false;
let syncSubscribed = false;
let indexedEvidence: LearningEvidence[] | undefined;
let evidencePositions = new Map<string, number>();
let indexedCards: StudyCard[] | undefined;
let cardPositions = new Map<string, number>();

function evidencePosition(evidence: LearningEvidence[], id: string): number {
  if (indexedEvidence !== evidence) {
    indexedEvidence = evidence;
    evidencePositions = new Map(evidence.map((item, index) => [item.id, index]));
  }
  return evidencePositions.get(id) ?? -1;
}

function replaceCard(cards: StudyCard[], card: StudyCard): StudyCard[] {
  if (indexedCards !== cards) {
    indexedCards = cards;
    cardPositions = new Map(cards.map((item, index) => [item.id, index]));
  }
  const index = cardPositions.get(card.id);
  if (index === undefined) return cards;
  const updated = cards.slice();
  updated[index] = card;
  indexedCards = updated;
  return updated;
}

function stateWithEvidence(value: AppState, evidence: LearningEvidence): AppState {
  const existingIndex = evidencePosition(value.learningEvidence, evidence.id);
  if (existingIndex >= 0) {
    const learningEvidence = value.learningEvidence.slice();
    learningEvidence[existingIndex] = evidence;
    indexedEvidence = learningEvidence;
    return { ...value, learningEvidence, skillStates: deriveSkillStates(learningEvidence) };
  }

  const skillStateById = new Map(
    value.skillStates.map((skillState) => [skillState.skillId, skillState]),
  );
  if (
    !evidence.excludedFromLearning &&
    evidence.mode !== 'cram' &&
    evidence.outcome !== 'skipped'
  ) {
    for (const skillId of new Set(evidence.skillIds)) {
      skillStateById.set(
        skillId,
        applyEvidenceToSkillState(skillStateById.get(skillId), evidence, skillId),
      );
    }
  }
  const learningEvidence = [...value.learningEvidence, evidence];
  indexedEvidence = learningEvidence;
  evidencePositions.set(evidence.id, learningEvidence.length - 1);
  return {
    ...value,
    learningEvidence,
    skillStates: [...skillStateById.values()],
  };
}

function requestRemoteRefresh(): void {
  remoteRefreshPending = true;
  if (remoteRefresh) return;
  remoteRefresh = (async () => {
    while (remoteRefreshPending) {
      remoteRefreshPending = false;
      // Refreshes are intentionally serialized so a later tab update cannot be overwritten.
      // oxlint-disable-next-line no-await-in-loop
      const snapshot = await loadSnapshot();
      state.set({ ready: true, loading: false, ...snapshot });
    }
  })()
    .catch((error: unknown) => {
      state.update((value) => ({
        ...value,
        error: messageFrom(error, 'Změnu z jiné karty se nepodařilo načíst.'),
      }));
    })
    .finally(() => {
      remoteRefresh = undefined;
      if (remoteRefreshPending) requestRemoteRefresh();
    });
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function initialize(): Promise<void> {
  if (!syncSubscribed && typeof window !== 'undefined') {
    syncSubscribed = true;
    subscribeDatabaseSync((event) => {
      if (event.type === 'db-versionchange') {
        state.update((value) => ({
          ...value,
          error: 'Je dostupná nová verze lokální databáze. Ulož práci a znovu načti kartu.',
        }));
        return;
      }
      if (event.type === 'mutation-committed') requestRemoteRefresh();
    });
  }
  if (get(state).ready) return;
  if (initialization) return initialization;

  initialization = (async () => {
    state.update((value) => ({ ...value, loading: true, error: undefined }));
    try {
      const snapshot = await loadSnapshot();
      state.set({ ready: true, loading: false, ...snapshot });
    } catch (error) {
      state.update((value) => ({
        ...value,
        loading: false,
        error: messageFrom(error, 'Aplikaci se nepodařilo načíst.'),
      }));
    } finally {
      initialization = undefined;
    }
  })();

  return initialization;
}

async function importNotes(
  drafts: ImportedNoteDraft[],
): Promise<{ added: number; duplicates: number }> {
  const current = get(state);
  const deck = current.decks[0];
  if (!deck) throw new Error('Nejdřív je potřeba vytvořit balíček.');

  const result = await addImportedNotes(deck.id, drafts);
  state.update((value) => ({
    ...value,
    notes: [...value.notes, ...result.addedNotes],
    cards: [...value.cards, ...result.addedCards],
  }));
  return { added: result.addedNotes.length, duplicates: result.duplicates };
}

async function updateNote(noteId: string, draft: ImportedNoteDraft): Promise<Note> {
  const note = await saveNote(noteId, draft);
  state.update((value) => ({
    ...value,
    notes: value.notes.map((item) => (item.id === note.id ? note : item)),
  }));
  return note;
}

async function review(input: {
  operationId?: string;
  activityId?: string;
  card: StudyCard;
  note: Note;
  mode: StudyMode;
  rating: RatingKey;
  signal: AnswerSignal;
  now?: Date;
}): Promise<{ card: StudyCard; log: ReviewLog; evidence: LearningEvidence }> {
  const current = get(state);
  const settings = current.settings;
  if (!settings) throw new Error('Nastavení ještě není načtené.');
  const now = input.now ?? new Date();

  const result = await recordReview({
    operationId: input.operationId ?? createId('review-operation'),
    activityId: input.activityId,
    cardId: input.card.id,
    noteId: input.note.id,
    mode: input.mode,
    rating: input.rating,
    signal: input.signal,
    now,
  });
  const evidence = result.evidence;
  state.update((value) => {
    const reviewAlreadyStored = value.recentReviews.some(
      (storedReview) => storedReview.id === result.log.id,
    );
    return stateWithEvidence(
      {
        ...value,
        cards: replaceCard(value.cards, result.card),
        recentReviews: reviewAlreadyStored
          ? value.recentReviews
          : [result.log, ...value.recentReviews].slice(0, 2_000),
        reviewStats: reviewAlreadyStored
          ? value.reviewStats
          : appendReviewStats(value.reviewStats, result.log),
      },
      evidence,
    );
  });
  return result;
}

async function disputeReview(reviewId: string, reason: ReviewDisputeReason): Promise<ReviewLog> {
  const result = await disputeStoredReview({ reviewId, reason });
  const snapshot = await loadSnapshot();
  state.set({ ready: true, loading: false, ...snapshot });
  return result.log;
}

async function answerCourseQuestion(input: {
  operationId?: string;
  activityId?: string;
  hintsUsed?: number;
  lessonId: string;
  questionId: string;
  correct: boolean;
  responseMs: number;
  now?: Date;
}): Promise<Awaited<ReturnType<typeof saveCourseAnswer>>> {
  const current = get(state);
  const result = await saveCourseAnswer({
    ...input,
    operationId: input.operationId ?? createId('course-answer-operation'),
    progress: current.course,
  });
  state.update((value) =>
    stateWithEvidence({ ...value, course: result.progress }, result.evidence),
  );
  return result;
}

async function completeGrammarLessonRun(input: {
  lessonId: string;
  correctFirstTry: number;
  total: number;
  pathNodeId?: string;
  now?: Date;
}): Promise<Awaited<ReturnType<typeof saveGrammarLessonRun>>> {
  const current = get(state);
  const result = await saveGrammarLessonRun({
    ...input,
    operationId: createId('grammar-run-operation'),
    progress: current.course,
    minimumLevel: current.settings?.grammarLevel ?? 'A1.1',
  });
  if (result.progress !== current.course) {
    state.update((value) => ({ ...value, course: result.progress }));
  }
  return result;
}

async function completeCoachSession(input: {
  scenarioId: string;
  score: number;
  turns: number;
  independentTurns?: number;
  mistakeTags?: LearningEvidence['mistakeTags'];
  pathNodeId?: string;
  now?: Date;
}): Promise<Awaited<ReturnType<typeof saveCoachSession>>> {
  const current = get(state);
  const result = await saveCoachSession({
    ...input,
    operationId: createId('coach-session-operation'),
    progress: current.course,
    minimumLevel: current.settings?.grammarLevel ?? 'A1.1',
  });
  state.update((value) =>
    stateWithEvidence(
      { ...value, course: result.progress },
      learningEvidenceFromCoachSession(result.event),
    ),
  );
  return result;
}

async function startPathNode(nodeId: string, now?: Date): Promise<CourseProgress> {
  const current = get(state);
  const course = await savePathNodeStart({
    progress: current.course,
    nodeId,
    now,
    minimumLevel: current.settings?.grammarLevel ?? 'A1.1',
  });
  if (course !== current.course) state.update((value) => ({ ...value, course }));
  return course;
}

async function completePathNode(input: {
  nodeId: string;
  stars?: number;
  now?: Date;
}): Promise<Awaited<ReturnType<typeof savePathNodeCompletion>>> {
  const current = get(state);
  const result = await savePathNodeCompletion({
    ...input,
    progress: current.course,
    minimumLevel: current.settings?.grammarLevel ?? 'A1.1',
  });
  state.update((value) => ({ ...value, course: result.progress }));
  return result;
}

async function completeVocabularyPathNode(input: {
  nodeId: string;
  stars?: number;
  now?: Date;
}): Promise<Awaited<ReturnType<typeof saveVocabularyPathNodeCompletion>>> {
  const current = get(state);
  const deck = current.decks[0];
  if (!deck) throw new Error('Kurzová slovíčka nemají cílový balíček.');
  const result = await saveVocabularyPathNodeCompletion({
    ...input,
    progress: current.course,
    deckId: deck.id,
    minimumLevel: current.settings?.grammarLevel ?? 'A1.1',
  });
  state.update((value) => {
    const changedNotes = new Map(result.notes.map((note) => [note.id, note]));
    const existingNoteIds = new Set(value.notes.map((note) => note.id));
    return {
      ...value,
      course: result.completion.progress,
      notes: [
        ...value.notes.map((note) => changedNotes.get(note.id) ?? note),
        ...result.notes.filter((note) => !existingNoteIds.has(note.id)),
      ],
      cards: [...value.cards, ...result.cards],
    };
  });
  return result;
}

async function purchaseDoubleXp(
  now?: Date,
): Promise<Awaited<ReturnType<typeof saveDoubleXpPurchase>>> {
  const current = get(state);
  const result = await saveDoubleXpPurchase({
    progress: current.course,
    now,
  });
  state.update((value) => ({ ...value, course: result.progress }));
  return result;
}

async function claimReward(rewardId: string): Promise<void> {
  const current = get(state);
  const course = await saveCourseRewardClaim(current.course, rewardId);
  state.update((value) => ({ ...value, course }));
}

async function readStoryPage(input: {
  bookId: StoryBookId;
  episodeId: string;
  pageNumber: number;
  now?: Date;
}): Promise<void> {
  const current = get(state);
  const course = await saveStoryPage({
    ...input,
    progress: current.course,
    operationId: `story-page:${input.bookId}:${input.episodeId}:${input.pageNumber}`,
  });
  state.update((value) => ({ ...value, course }));
}

async function answerStoryCheckpoint(input: {
  bookId: StoryBookId;
  episodeId: string;
  checkpointId: string;
  result: StoryExerciseResult;
  now?: Date;
}): Promise<void> {
  const current = get(state);
  const course = await saveStoryCheckpoint({
    ...input,
    progress: current.course,
    operationId: createId('story-checkpoint-operation'),
  });
  state.update((value) => ({ ...value, course }));
}

async function completeStoryEpisode(input: {
  bookId: StoryBookId;
  episodeId: string;
  nextEpisodeId?: string;
  now?: Date;
}): Promise<void> {
  const current = get(state);
  const course = await saveStoryEpisode({
    ...input,
    progress: current.course,
    operationId: `story-episode:${input.bookId}:${input.episodeId}`,
  });
  state.update((value) => ({ ...value, course }));
}

async function countStorySavedWord(input: {
  bookId: StoryBookId;
  episodeId: string;
  now?: Date;
}): Promise<void> {
  const current = get(state);
  const course = await saveStoryWord({
    ...input,
    progress: current.course,
    operationId: createId('story-word-operation'),
  });
  state.update((value) => ({ ...value, course }));
}

async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = get(state);
  if (!current.settings) throw new Error('Nastavení ještě není načtené.');
  const result = await saveSettings(patch, current.decks[0]?.id);
  state.update((value) => ({
    ...value,
    settings: result.settings,
    decks: result.deck
      ? value.decks.map((deck) => (deck.id === result.deck?.id ? result.deck : deck))
      : value.decks,
  }));
}

async function deleteNote(noteId: string): Promise<void> {
  const current = get(state);
  const course = await removeNote(noteId, current.course);
  const snapshot = await loadSnapshot();
  state.set({ ready: true, loading: false, ...snapshot, course });
}

async function beginDailySession(proposed: DailySessionRecord): Promise<DailySessionRecord> {
  const dailySession = await loadOrCreateDailySession(proposed);
  state.update((value) => ({
    ...value,
    dailySession,
    dailySessions: value.dailySessions.some((candidate) => candidate.key === dailySession.key)
      ? value.dailySessions.map((candidate) =>
          candidate.key === dailySession.key ? dailySession : candidate,
        )
      : [...value.dailySessions, dailySession],
  }));
  return dailySession;
}

async function completeDailySessionActivity(input: {
  activityId: string;
  evidence?: LearningEvidence;
  needsRepair?: boolean;
  now?: Date;
}): Promise<DailySessionRecord> {
  const current = get(state);
  if (!current.dailySession) throw new Error('Dnešní lekce ještě není načtená.');
  const dailySession = await saveDailyActivityResult({
    ...input,
    sessionKey: current.dailySession.key,
  });
  state.update((value) => {
    const next = {
      ...value,
      dailySession,
      dailySessions: value.dailySessions.map((candidate) =>
        candidate.key === dailySession.key ? dailySession : candidate,
      ),
    };
    return input.evidence ? stateWithEvidence(next, input.evidence) : next;
  });
  return dailySession;
}

async function backup(): Promise<AppBackup> {
  return exportBackup();
}

async function encryptedBackup(passphrase: string): Promise<EncryptedBackupEnvelope> {
  return encryptBackup(await exportBackup(), passphrase);
}

async function prepareRestore(
  value: unknown,
  passphrase?: string,
): Promise<{ backup: AppBackup; preview: BackupPreview }> {
  const importedBackup = isEncryptedBackup(value)
    ? await decryptBackup(value, passphrase ?? '')
    : (value as AppBackup);
  const current = await exportBackup();
  return { backup: importedBackup, preview: createBackupPreview(importedBackup, current) };
}

async function reset(): Promise<void> {
  const snapshot = await resetToSeed();
  state.set({ ready: true, loading: false, ...snapshot });
}

async function restore(value: unknown): Promise<void> {
  const snapshot = await restoreBackup(value);
  state.set({ ready: true, loading: false, ...snapshot });
}

async function undoDestructiveChange(): Promise<void> {
  const snapshot = await rollbackLastDestructiveChange();
  state.set({ ready: true, loading: false, ...snapshot });
}

function refreshClock(now = Date.now()): void {
  clock.set(now);
}

export const appStore = {
  subscribe: state.subscribe,
  initialize,
  importNotes,
  updateNote,
  review,
  disputeReview,
  answerCourseQuestion,
  completeGrammarLessonRun,
  completeCoachSession,
  startPathNode,
  completePathNode,
  completeVocabularyPathNode,
  purchaseDoubleXp,
  claimReward,
  readStoryPage,
  answerStoryCheckpoint,
  completeStoryEpisode,
  countStorySavedWord,
  updateSettings,
  deleteNote,
  beginDailySession,
  completeDailySessionActivity,
  backup,
  encryptedBackup,
  prepareRestore,
  restore,
  reset,
  rollbackIsAvailable,
  undoDestructiveChange,
  refreshClock,
};

export const appClock = { subscribe: clock.subscribe };

export const motherTongue = derived(state, ($state) => $state.settings?.motherTongue ?? 'cs');

export const dueCards = derived([state, clock], ([$state, $clock]) =>
  selectDueCards(
    $state.cards,
    new Date($clock),
    50,
    remainingDailyNewCards(
      $state.recentReviews,
      $state.settings?.dailyNewLimit ?? 15,
      new Date($clock),
    ),
  ),
);

export const activeDeck = derived(state, ($state) => $state.decks[0]);

let dailyReviewCache: { reviews: ReviewLog[]; day: string; result: ReviewLog[] } | undefined;

function cachedReviewsOnDay(reviews: ReviewLog[], now: Date): ReviewLog[] {
  const day = localDateKey(now);
  if (dailyReviewCache?.reviews === reviews && dailyReviewCache.day === day) {
    return dailyReviewCache.result;
  }
  const result = reviewsOnDay(reviews, now);
  dailyReviewCache = { reviews, day, result };
  return result;
}

export const todayReviews = derived([state, clock], ([$state, $clock]) =>
  cachedReviewsOnDay($state.recentReviews, new Date($clock)),
);

let dailyProgressCache:
  | {
      reviews: ReviewLog[];
      course: CourseProgress;
      dailySessions: DailySessionRecord[];
      dailyMinutes: number;
      day: string;
      result: {
        completed: number;
        vocabularyCompleted: number;
        grammarCompleted: number;
        coachCompleted: number;
        minutes: 5 | 10 | 20;
        vocabularyGoal: number;
        grammarGoal: number;
        coachGoal: number;
        goal: number;
        percent: number;
        reached: boolean;
      };
    }
  | undefined;

export const dailyProgress = derived([state, clock], ([$state, $clock]) => {
  const now = new Date($clock);
  const day = localDateKey(now);
  const dailyMinutes = $state.settings?.dailyMinutes ?? 10;
  const targets = dailyLearningTargets(dailyMinutes);
  if (
    dailyProgressCache?.reviews === $state.recentReviews &&
    dailyProgressCache.course === $state.course &&
    dailyProgressCache.dailySessions === $state.dailySessions &&
    dailyProgressCache.dailyMinutes === dailyMinutes &&
    dailyProgressCache.day === day
  ) {
    return dailyProgressCache.result;
  }
  const dailySession = $state.dailySessions
    .filter(
      (candidate) => candidate.plan.localDay === day && candidate.plan.minutes === dailyMinutes,
    )
    .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  if (dailySession) {
    const completedIds = new Set(dailySession.completedActivityIds);
    const completedActivities = dailySession.plan.activities.filter((activity) =>
      completedIds.has(activity.id),
    );
    const vocabularyGoal = dailySession.plan.activities.filter(
      (activity) => activity.kind === 'review',
    ).length;
    const grammarGoal = dailySession.plan.activities.filter(
      (activity) => activity.kind === 'grammar' || activity.kind === 'listening',
    ).length;
    const coachGoal = dailySession.plan.activities.filter(
      (activity) => activity.kind === 'transfer',
    ).length;
    const result = {
      completed: completedActivities.length,
      vocabularyCompleted: completedActivities.filter((activity) => activity.kind === 'review')
        .length,
      grammarCompleted: completedActivities.filter(
        (activity) => activity.kind === 'grammar' || activity.kind === 'listening',
      ).length,
      coachCompleted: completedActivities.filter((activity) => activity.kind === 'transfer').length,
      minutes: dailySession.plan.minutes,
      vocabularyGoal,
      grammarGoal,
      coachGoal,
      goal: dailySession.plan.activities.length,
      percent:
        dailySession.plan.activities.length === 0
          ? 100
          : Math.min(
              100,
              Math.round((completedActivities.length / dailySession.plan.activities.length) * 100),
            ),
      reached: Boolean(dailySession.completedAt),
    };
    dailyProgressCache = {
      reviews: $state.recentReviews,
      course: $state.course,
      dailySessions: $state.dailySessions,
      dailyMinutes,
      day,
      result,
    };
    return result;
  }
  const vocabularyCompleted = Math.min(
    targets.vocabulary,
    new Set(
      cachedReviewsOnDay($state.recentReviews, now).map((storedReview) => storedReview.noteId),
    ).size,
  );
  const grammarCompleted = Math.min(targets.grammar, courseAnswersOnDay($state.course, now));
  const coachCompleted = Math.min(targets.coach, creditedCoachTurnsOnDay($state.course, now));
  const completed = vocabularyCompleted + grammarCompleted + coachCompleted;
  const result = {
    completed,
    vocabularyCompleted,
    grammarCompleted,
    coachCompleted,
    minutes: targets.minutes,
    vocabularyGoal: targets.vocabulary,
    grammarGoal: targets.grammar,
    coachGoal: targets.coach,
    goal: targets.total,
    percent: Math.min(100, Math.round((completed / targets.total) * 100)),
    reached: completed >= targets.total,
  };
  dailyProgressCache = {
    reviews: $state.recentReviews,
    course: $state.course,
    dailySessions: $state.dailySessions,
    dailyMinutes,
    day,
    result,
  };
  return result;
});

let gameProgressCache:
  | {
      reviews: ReviewLog[];
      reviewStats: ReviewStats;
      cards: StudyCard[];
      course: CourseProgress;
      dailyGoal: number;
      day: string;
      result: ReturnType<typeof gamificationSummary>;
    }
  | undefined;

export const gameProgress = derived([state, clock], ([$state, $clock]) => {
  const now = new Date($clock);
  const dailyGoal = $state.settings?.dailyGoal ?? 20;
  const day = localDateKey(now);
  if (
    gameProgressCache?.reviews === $state.recentReviews &&
    gameProgressCache.reviewStats === $state.reviewStats &&
    gameProgressCache.cards === $state.cards &&
    gameProgressCache.course === $state.course &&
    gameProgressCache.dailyGoal === dailyGoal &&
    gameProgressCache.day === day
  ) {
    return gameProgressCache.result;
  }
  const result = gamificationSummary(
    $state.recentReviews,
    $state.cards,
    now,
    dailyGoal,
    $state.course,
    $state.reviewStats,
  );
  gameProgressCache = {
    reviews: $state.recentReviews,
    reviewStats: $state.reviewStats,
    cards: $state.cards,
    course: $state.course,
    dailyGoal,
    day,
    result,
  };
  return result;
});

export const walletProgress = derived([state, gameProgress], ([$state, $game]) => ({
  balance: availableXpBalance($game.totalXp, $state.course),
  spent: $state.course.wallet.purchases.reduce((sum, purchase) => sum + purchase.price, 0),
  activeBoost: activeDoubleXp($state.course),
}));
