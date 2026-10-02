import { parseBackup } from '../domain/backup/validate.ts';
import {
  claimCourseReward,
  createCourseProgress,
  normalizeCourseProgress,
  recordCoachSession,
} from '../domain/course/course-progress.ts';
import { storyBookIsUnlocked } from '../domain/course/story-unlocks.ts';
import { purchaseDoubleXp } from '../domain/course/wallet.ts';
import {
  calculateReviewXp,
  missionCompletionBonus,
  totalCourseXp,
} from '../domain/gamification.ts';
import {
  learningEvidenceFromCoachSession,
  learningEvidenceFromCourseAnswer,
  learningEvidenceFromReview,
} from '../domain/learning/evidence.ts';
import { classifyMistakes } from '../domain/learning/mistakes.ts';
import { completeDailyActivity, insertRepairActivity } from '../domain/learning/planner.ts';
import { scheduleReview } from '../domain/scheduler/fsrs.ts';
import { migrateSettings } from '../domain/settings/defaults.ts';
import { assertValidSettings } from '../domain/settings/validation.ts';
import { localDateKey } from '../domain/stats/learning.ts';
import {
  recordStoryEpisodeComplete,
  recordStoryExercise,
  recordStoryPage,
  recordStorySavedWord,
} from '../domain/stories/progress.ts';
import { normalizeDraft } from '../domain/vocabulary/draft.ts';
import { createNoteAndCard } from '../domain/vocabulary/factory.ts';
import { assertValidVocabularyDraft } from '../domain/vocabulary/validation.ts';
import {
  commitReviewCommand,
  deleteNoteCascade,
  getOrCreateDailySession,
  mutateCourseAndVocabulary,
  mutateCourseProgress,
  mutateCourseWithReviewStats,
  mutateReviewAndCard,
  mutateDailySession,
  mutateSettingsAndDeck,
  mutateVocabularyRecords,
  mutateNote,
  publishDatabaseSync,
  bindLocalAccount,
  readBackup,
  readRecentReviewsForNote,
  readStoredSnapshot,
  replaceWithBackup,
  seedDatabaseIfEmpty,
} from './db.ts';
import { createSeedData } from './seed.ts';

import type { RecordCourseAnswerResult, RecordLessonRunResult } from '../domain/course/grammar.ts';
import type { completeCoursePathNode } from '../domain/course/path.ts';
import type { buildCourseVocabularyCompletion } from '../domain/course/vocabulary.ts';
import type { DailySessionRecord, LearningEvidence, SkillState } from '../domain/learning/types.ts';
import type { ReviewStats } from '../domain/stats/review-stats.ts';
import type {
  StoryBookId,
  StoryBookProgress,
  StoryExerciseResult,
} from '../domain/stories/types.ts';
import type {
  AnswerSignal,
  AppBackup,
  AppSettings,
  CourseProgress,
  Deck,
  ImportedNoteDraft,
  Note,
  RatingKey,
  ReviewLog,
  ReviewDisputeReason,
  StudyCard,
  StudyMode,
  DetailedCefrLevel,
} from '../domain/types.ts';

export type AppSnapshot = {
  decks: Deck[];
  notes: Note[];
  cards: StudyCard[];
  recentReviews: ReviewLog[];
  reviewStats: ReviewStats;
  learningEvidence: LearningEvidence[];
  skillStates: SkillState[];
  dailySessions: DailySessionRecord[];
  settings: AppSettings;
  course: CourseProgress;
};

let rollbackBackup: AppBackup | undefined;

function createFreshBackup(): AppBackup {
  const seed = createSeedData();
  return {
    schemaVersion: 8,
    exportedAt: new Date().toISOString(),
    decks: [seed.deck],
    notes: seed.notes,
    cards: seed.cards,
    reviews: [],
    learningEvidence: [],
    settings: seed.settings,
    course: createCourseProgress(new Date(seed.settings.createdAt)),
  };
}

async function replaceDestructivelyWithRollback(backup: AppBackup): Promise<AppSnapshot> {
  const target = parseBackup(backup);
  const previous = parseBackup(await readBackup());
  try {
    await replaceWithBackup(target);
    // A successful commit is not enough: read and validate every invariant before exposing state.
    parseBackup(await readBackup());
    rollbackBackup = previous;
    return loadSnapshot();
  } catch (error) {
    // replaceWithBackup itself is atomic. This restores the previous snapshot only when a later
    // verification/read failed after the replacement transaction had committed.
    try {
      await replaceWithBackup(previous);
    } catch {
      throw new Error('Obnova selhala a automatický rollback se nepodařilo ověřit.', {
        cause: error,
      });
    }
    throw error;
  }
}

export async function ensureSeeded(): Promise<void> {
  await seedDatabaseIfEmpty(createFreshBackup());
}

export async function prepareLocalDataForAccount(input: {
  accountId: string;
  accountCreatedAt: string;
}): Promise<boolean> {
  const accountId = input.accountId.trim();
  const accountCreatedAt = Date.parse(input.accountCreatedAt);
  if (!accountId || Number.isNaN(accountCreatedAt)) {
    throw new Error('Server neposkytl platnou identitu účtu.');
  }

  const shouldReset = await bindLocalAccount(accountId, createFreshBackup());
  if (shouldReset) rollbackBackup = undefined;
  return shouldReset;
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  await ensureSeeded();
  const snapshot = await readStoredSnapshot();
  if (!snapshot.settings) throw new Error('Nastavení aplikace není dostupné.');

  return {
    decks: snapshot.decks,
    notes: snapshot.notes,
    cards: snapshot.cards,
    recentReviews: snapshot.recentReviews,
    reviewStats: snapshot.reviewStats,
    learningEvidence: snapshot.learningEvidence,
    skillStates: snapshot.skillStates,
    dailySessions: snapshot.dailySessions,
    settings: migrateSettings(snapshot.settings),
    course: normalizeCourseProgress(
      snapshot.course ?? createCourseProgress(new Date(snapshot.settings.createdAt)),
    ),
  };
}

export async function loadNoteReviewHistory(noteId: string, limit = 5): Promise<ReviewLog[]> {
  return readRecentReviewsForNote(noteId, limit);
}

export async function addImportedNotes(
  deckId: string,
  drafts: ImportedNoteDraft[],
): Promise<{ addedNotes: Note[]; addedCards: StudyCard[]; duplicates: number }> {
  const normalizedDrafts = drafts.map((rawDraft) => {
    const draft = normalizeDraft(rawDraft);
    assertValidVocabularyDraft(draft);
    return draft;
  });

  return mutateVocabularyRecords(({ notes }) => {
    const keys = new Set<string>();
    for (const note of notes) {
      if (note.deckId === deckId) keys.add(note.normalizedGerman);
    }
    const addedNotes: Note[] = [];
    const addedCards: StudyCard[] = [];
    let duplicates = 0;

    for (const draft of normalizedDrafts) {
      if (keys.has(draft.normalizedGerman)) {
        duplicates += 1;
        continue;
      }
      keys.add(draft.normalizedGerman);
      const { sourceLine: _sourceLine, ...noteInput } = draft;
      const created = createNoteAndCard(deckId, {
        ...noteInput,
        source: noteInput.source ?? 'import',
      });
      addedNotes.push(created.note);
      addedCards.push(created.card);
    }

    return {
      notesToPut: addedNotes,
      cardsToPut: addedCards,
      result: { addedNotes, addedCards, duplicates },
    };
  });
}

export async function saveNote(noteId: string, rawDraft: ImportedNoteDraft): Promise<Note> {
  const draft = normalizeDraft(rawDraft);
  assertValidVocabularyDraft(draft);
  const updatedAt = new Date().toISOString();

  return mutateNote(noteId, (current) => {
    const { sourceLine: _sourceLine, ...values } = draft;
    return {
      ...current,
      ...values,
      id: current.id,
      deckId: current.deckId,
      source: current.source ?? values.source ?? 'manual',
      createdAt: current.createdAt,
      updatedAt,
    };
  });
}

export async function saveSettings(
  patch: Partial<AppSettings>,
  deckId?: string,
): Promise<{ settings: AppSettings; deck?: Deck }> {
  return mutateSettingsAndDeck(deckId, ({ settings, deck }) => {
    if (!settings) throw new Error('Nastavení už v lokální databázi není dostupné.');
    const updatedAt = new Date().toISOString();
    const nextSettings = migrateSettings({
      ...settings,
      ...patch,
      key: 'app',
      createdAt: settings.createdAt,
      updatedAt,
    });
    assertValidSettings(nextSettings);
    const nextDeck = deck
      ? {
          ...deck,
          desiredRetention: nextSettings.desiredRetention,
          dailyNewLimit: nextSettings.dailyNewLimit,
          exerciseMix: nextSettings.exerciseMix,
          updatedAt,
        }
      : undefined;
    return {
      settings: nextSettings,
      deck: nextDeck,
      result: { settings: nextSettings, deck: nextDeck },
    };
  });
}

export async function recordReview(input: {
  operationId: string;
  activityId?: string;
  cardId: string;
  noteId: string;
  mode: StudyMode;
  rating: RatingKey;
  signal: AnswerSignal;
  now?: Date;
}): Promise<{ card: StudyCard; log: ReviewLog; evidence: LearningEvidence; replayed: boolean }> {
  const now = input.now ?? new Date();
  const dayKey = localDateKey(now);
  const result = await commitReviewCommand(
    { ...input, localDay: dayKey },
    ({ card, note, settings, reviews }) => {
      const scheduling =
        input.mode === 'long-term'
          ? scheduleReview(card, input.rating, settings.desiredRetention, now)
          : { card, before: card.fsrs, after: card.fsrs };
      const reviewedAt = now.toISOString();
      const countedReviews = reviews.filter((review) => !review.excludedFromLearning);
      const previousSameCardToday = countedReviews.filter(
        (review) =>
          review.cardId === card.id &&
          (review.localDay ?? localDateKey(new Date(review.reviewedAt))) === dayKey,
      ).length;
      const draft = {
        mode: input.mode,
        exercise: input.signal.exercise,
        rating: input.rating,
        signal: input.signal,
      } as const;
      const preview: ReviewLog = {
        id: `review:${input.operationId}`,
        operationId: input.operationId,
        cardId: card.id,
        noteId: note.id,
        deckId: note.deckId,
        reviewedAt,
        localDay: dayKey,
        dueAtBefore: card.dueAt,
        mistakeTags: classifyMistakes({ signal: input.signal, note }),
        ...draft,
      };
      const missionBonusAwarded = settings.gamificationEnabled
        ? Math.min(
            60,
            Math.max(
              0,
              Math.round(missionCompletionBonus(countedReviews, preview, now, settings.dailyGoal)),
            ),
          )
        : 0;
      const log: ReviewLog = {
        ...preview,
        xpAwarded: calculateReviewXp(draft, previousSameCardToday) + missionBonusAwarded,
        missionBonusAwarded: missionBonusAwarded || undefined,
        scheduleBefore: scheduling.before,
        scheduleAfter: scheduling.after,
      };
      const evidence = {
        ...learningEvidenceFromReview(log, card.direction),
        activityId: input.activityId,
      };
      return {
        card: scheduling.card,
        log,
        evidence,
      };
    },
  );
  return {
    card: result.card,
    log: result.log,
    replayed: result.replayed,
    evidence: {
      ...learningEvidenceFromReview(result.log, result.card.direction),
      activityId: input.activityId,
    },
  };
}

export async function disputeReview(input: {
  reviewId: string;
  reason: ReviewDisputeReason;
  now?: Date;
}): Promise<{ card: StudyCard; log: ReviewLog }> {
  const now = input.now ?? new Date();
  return mutateReviewAndCard(input.reviewId, (review, card, cardReviews) => {
    if (review.excludedFromLearning) return { review, card, result: { card, log: review } };

    const orderedScheduleReviews = cardReviews
      .filter((item) => item.mode === 'long-term')
      .toSorted(
        (left, right) =>
          left.reviewedAt.localeCompare(right.reviewedAt) || left.id.localeCompare(right.id),
      );
    const latestActive = orderedScheduleReviews.findLast((item) => !item.excludedFromLearning);
    const canRestoreSchedule = review.mode === 'long-term' && latestActive?.id === review.id;
    const previousActive = orderedScheduleReviews.findLast(
      (item) => item.id !== review.id && !item.excludedFromLearning,
    );
    const earliestSchedule = orderedScheduleReviews[0];
    const restoredSchedule = previousActive?.scheduleAfter ?? earliestSchedule?.scheduleBefore;
    const restoredDueAt =
      scheduleDue(previousActive?.scheduleAfter) ??
      earliestSchedule?.dueAtBefore ??
      review.dueAtBefore ??
      card.dueAt;
    const restoredCard: StudyCard = canRestoreSchedule
      ? {
          ...card,
          dueAt: restoredDueAt,
          fsrs: restoredSchedule,
          updatedAt: now.toISOString(),
        }
      : card;
    const disputedLog: ReviewLog = {
      ...review,
      excludedFromLearning: true,
      disputedAt: now.toISOString(),
      disputeReason: input.reason,
      xpAwarded: 0,
      missionBonusAwarded: undefined,
    };
    return {
      review: disputedLog,
      card: restoredCard,
      evidence: learningEvidenceFromReview(disputedLog, card.direction),
      result: { card: restoredCard, log: disputedLog },
    };
  });
}

function scheduleDue(schedule: ReviewLog['scheduleAfter']): string | undefined {
  const due = schedule?.due;
  if (typeof due !== 'string' || !Number.isFinite(Date.parse(due))) return undefined;
  return due;
}

export async function saveCourseAnswer(input: {
  operationId: string;
  activityId?: string;
  hintsUsed?: number;
  progress: CourseProgress;
  lessonId: string;
  questionId: string;
  correct: boolean;
  responseMs: number;
  now?: Date;
}): Promise<RecordCourseAnswerResult & { evidence: LearningEvidence }> {
  const { recordCourseAnswer } = await import('../domain/course/grammar.ts');
  return mutateCourseProgress<RecordCourseAnswerResult & { evidence: LearningEvidence }>(
    (stored, priorEvidence) => {
      const current = normalizeCourseProgress(stored ?? input.progress, input.now);
      const prior = current.events.find(
        (event) => event.id === `course-answer:${input.operationId}`,
      );
      if (prior) {
        const evidence = priorEvidence ?? learningEvidenceFromCourseAnswer(prior);
        return {
          course: current,
          result: {
            progress: current,
            event: prior,
            evidence,
            lessonCompletedNow: false,
            xpAwarded: prior.xpAwarded,
          },
        };
      }
      const recorded = recordCourseAnswer(current, input);
      const event = { ...recorded.event, id: `course-answer:${input.operationId}` };
      const progress = markOperation(
        {
          ...recorded.progress,
          events: [...recorded.progress.events.slice(0, -1), event],
        },
        input.operationId,
      );
      const baseEvidence = learningEvidenceFromCourseAnswer(event);
      // firstTry belongs to lifetime XP. Spaced retrieval can be independent again
      // on a later local day, but corrections and immediate repeats cannot.
      const alreadyAttemptedToday = current.events.some(
        (previous) =>
          previous.lessonId === event.lessonId &&
          previous.questionId === event.questionId &&
          localDateKey(new Date(previous.answeredAt)) === baseEvidence.localDay,
      );
      const evidence = {
        ...baseEvidence,
        activityId: input.activityId,
        hintsUsed: input.hintsUsed ?? 0,
        independent: !alreadyAttemptedToday && (input.hintsUsed ?? 0) === 0,
      };
      return {
        course: progress,
        evidence,
        result: { ...recorded, progress, event, evidence },
      };
    },
    { evidenceId: `evidence:course-answer:course-answer:${input.operationId}` },
  );
}

export async function saveGrammarLessonRun(input: {
  operationId: string;
  progress: CourseProgress;
  lessonId: string;
  correctFirstTry: number;
  total: number;
  pathNodeId?: string;
  minimumLevel?: DetailedCefrLevel;
  now?: Date;
}): Promise<
  RecordLessonRunResult & {
    pathCompletion?: ReturnType<typeof completeCoursePathNode>;
  }
> {
  const { grammarLessonById, lessonProgress, recordLessonRun } =
    await import('../domain/course/grammar.ts');
  const { pathNodeId } = input;
  const path = pathNodeId ? await import('../domain/course/path.ts') : undefined;
  const lesson = grammarLessonById(input.lessonId);
  if (path && pathNodeId) {
    const node = path.coursePathNodeById(pathNodeId);
    if (node?.type !== 'grammar' || node.grammarLessonId !== input.lessonId) {
      throw new Error('Tato gramatická lekce neodpovídá otevřenému uzlu cesty.');
    }
    if (!lesson || input.total !== lesson.questions.length) {
      throw new Error('Kurzovou gramatiku je potřeba projít jako celou mikrolekci.');
    }
  }
  return mutateCourseProgress((stored) => {
    const current = normalizeCourseProgress(stored ?? input.progress, input.now);
    if ((current.appliedOperations ?? []).includes(input.operationId)) {
      const replay = recordLessonRun(current, input);
      return { course: current, result: { ...replay, progress: current } };
    }
    if (pathNodeId && lesson && !lessonProgress(current, lesson).completed) {
      throw new Error('Nejdřív správně dokonči všech pět gramatických otázek.');
    }
    const result = recordLessonRun(current, input);
    const pathCompletion =
      path && pathNodeId
        ? path.completeCoursePathNode(
            result.progress,
            pathNodeId,
            result.stars,
            input.now,
            input.minimumLevel,
          )
        : undefined;
    const progress = markOperation(pathCompletion?.progress ?? result.progress, input.operationId);
    return {
      course: progress,
      result: {
        ...result,
        progress,
        ...(pathCompletion ? { pathCompletion: { ...pathCompletion, progress } } : {}),
      },
    };
  });
}

export async function saveCoachSession(input: {
  operationId: string;
  progress: CourseProgress;
  scenarioId: string;
  score: number;
  turns: number;
  independentTurns?: number;
  mistakeTags?: LearningEvidence['mistakeTags'];
  pathNodeId?: string;
  minimumLevel?: DetailedCefrLevel;
  now?: Date;
}): Promise<
  ReturnType<typeof recordCoachSession> & {
    pathCompletion?: ReturnType<typeof completeCoursePathNode>;
  }
> {
  const { pathNodeId } = input;
  const path = pathNodeId ? await import('../domain/course/path.ts') : undefined;
  if (path && pathNodeId) {
    const node = path.coursePathNodeById(pathNodeId);
    if (node?.type !== 'coach' || node.coachScenarioId !== input.scenarioId) {
      throw new Error('Tato konverzace neodpovídá otevřenému uzlu cesty.');
    }
    const { coachScenarioById } = await import('../domain/course/coach.ts');
    const scenario = coachScenarioById(input.scenarioId);
    if (!scenario || input.turns < scenario.turns) {
      throw new Error(
        `Kurzová konverzace se dokončí až po ${scenario?.turns ?? 3} kreditovaných replikách.`,
      );
    }
  }
  return mutateCourseProgress((stored) => {
    const current = normalizeCourseProgress(stored ?? input.progress, input.now);
    const prior = current.coachEvents.find(
      (event) => event.id === `coach-session:${input.operationId}`,
    );
    if (prior) {
      return {
        course: current,
        result: { progress: current, event: prior, xpAwarded: prior.xpAwarded },
      };
    }
    const recorded = recordCoachSession(current, input);
    const event = { ...recorded.event, id: `coach-session:${input.operationId}` };
    const coachProgress = {
      ...recorded.progress,
      coachEvents: [...recorded.progress.coachEvents.slice(0, -1), event],
    };
    const pathCompletion =
      path && pathNodeId
        ? path.completeCoursePathNode(
            coachProgress,
            pathNodeId,
            input.score >= 90 ? 3 : input.score >= 70 ? 2 : 1,
            input.now,
            input.minimumLevel,
          )
        : undefined;
    const progress = markOperation(pathCompletion?.progress ?? coachProgress, input.operationId);
    return {
      course: progress,
      evidence: learningEvidenceFromCoachSession(event),
      result: {
        ...recorded,
        progress,
        event,
        ...(pathCompletion ? { pathCompletion: { ...pathCompletion, progress } } : {}),
      },
    };
  });
}

export async function savePathNodeStart(input: {
  progress: CourseProgress;
  nodeId: string;
  minimumLevel?: DetailedCefrLevel;
  now?: Date;
}): Promise<CourseProgress> {
  const { coursePathNodeById, startCoursePathNode } = await import('../domain/course/path.ts');
  const node = coursePathNodeById(input.nodeId);
  if (!node || node.type === 'reading') throw new Error('Tento uzel cesty nelze spustit.');
  return mutateCourseProgress((stored) => {
    const current = normalizeCourseProgress(stored ?? input.progress, input.now);
    const course = startCoursePathNode(current, input.nodeId, input.now, input.minimumLevel);
    return { course, result: course };
  });
}

export async function savePathWritingDraft(input: {
  progress: CourseProgress;
  nodeId: string;
  text: string;
  minimumLevel?: DetailedCefrLevel;
  now?: Date;
}): Promise<CourseProgress> {
  const { coursePathNodeById, startCoursePathNode } = await import('../domain/course/path.ts');
  if (
    coursePathNodeById(input.nodeId)?.type !== 'sentence' ||
    typeof input.text !== 'string' ||
    input.text.length > 5000
  )
    throw new Error('Rozepsaný text nemá platný písemný krok nebo rozsah.');
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return mutateCourseProgress((stored) => {
    const current = normalizeCourseProgress(stored ?? input.progress, now);
    const started = startCoursePathNode(current, input.nodeId, now, input.minimumLevel);
    const course = {
      ...started,
      pathNodes: {
        ...started.pathNodes,
        [input.nodeId]: {
          ...started.pathNodes[input.nodeId],
          writingDraft: { text: input.text, updatedAt: timestamp },
          updatedAt: timestamp,
        },
      },
      updatedAt: timestamp,
    };
    return { course, result: course };
  });
}

export async function savePathNodeCompletion(input: {
  progress: CourseProgress;
  nodeId: string;
  writtenResponse?: string;
  stars?: number;
  minimumLevel?: DetailedCefrLevel;
  now?: Date;
}): Promise<ReturnType<typeof completeCoursePathNode>> {
  const { completeCoursePathNode, coursePathNodeById, coursePathChapterById } =
    await import('../domain/course/path.ts');
  const node = coursePathNodeById(input.nodeId);
  if (!node || node.type === 'reading' || node.type === 'vocabulary') {
    throw new Error('Tento uzel vyžaduje jiný způsob dokončení.');
  }
  if (node.type === 'grammar' || node.type === 'coach') {
    throw new Error('Nejdřív dokonči připojenou lekci nebo konverzaci.');
  }
  if (input.writtenResponse !== undefined) {
    const { checkCourseWriting } = await import('../domain/course/course-writing.ts');
    const chapter = coursePathChapterById(node.chapterId);
    if (
      node.type !== 'sentence' ||
      !chapter ||
      !checkCourseWriting(chapter, input.writtenResponse).ready
    ) {
      throw new Error('Text nesplňuje rozsah nebo slovní zásobu tohoto písemného úkolu.');
    }
  }
  return mutateCourseProgress((stored) => {
    const current = normalizeCourseProgress(stored ?? input.progress, input.now);
    const result = completeCoursePathNode(
      current,
      input.nodeId,
      input.stars,
      input.now,
      input.minimumLevel,
    );
    if (input.writtenResponse !== undefined) {
      result.progress.pathNodes[input.nodeId].writtenResponse = input.writtenResponse.trim();
      delete result.progress.pathNodes[input.nodeId].writingDraft;
    }
    return { course: result.progress, result };
  });
}

export async function saveVocabularyPathNodeCompletion(input: {
  progress: CourseProgress;
  deckId: string;
  nodeId: string;
  stars?: number;
  minimumLevel?: DetailedCefrLevel;
  now?: Date;
}): Promise<{
  completion: ReturnType<typeof completeCoursePathNode>;
  vocabulary: ReturnType<typeof buildCourseVocabularyCompletion>['vocabulary']['summary'];
  notes: Note[];
  cards: StudyCard[];
}> {
  const [{ coursePathNodeById }, { buildCourseVocabularyCompletion }] = await Promise.all([
    import('../domain/course/path.ts'),
    import('../domain/course/vocabulary.ts'),
  ]);
  const node = coursePathNodeById(input.nodeId);
  if (node?.type !== 'vocabulary') {
    throw new Error('Tento uzel nepředstavuje kurzová slovíčka.');
  }
  const now = input.now ?? new Date();
  return mutateCourseAndVocabulary((stored) => {
    const current = normalizeCourseProgress(stored.course ?? input.progress, now);
    const result = buildCourseVocabularyCompletion({
      progress: current,
      notes: stored.notes,
      deckId: input.deckId,
      nodeId: input.nodeId,
      stars: input.stars,
      minimumLevel: input.minimumLevel,
      now,
    });
    return {
      course: result.progress,
      notesToPut: result.vocabulary.notesToPut,
      cardsToPut: result.vocabulary.cardsToPut,
      result: {
        completion: result.completion,
        vocabulary: result.vocabulary.summary,
        notes: result.vocabulary.notesToPut,
        cards: result.vocabulary.cardsToPut,
      },
    };
  });
}

export async function saveDoubleXpPurchase(input: {
  progress: CourseProgress;
  now?: Date;
}): Promise<ReturnType<typeof purchaseDoubleXp>> {
  return mutateCourseWithReviewStats((stored) => {
    const now = input.now ?? new Date();
    const current = normalizeCourseProgress(stored.course ?? input.progress, now);
    const totalEarnedXp = stored.reviewStats.reviewXp + totalCourseXp(current);
    const result = purchaseDoubleXp(current, totalEarnedXp, now);
    return { course: result.progress, result };
  });
}

export async function saveCourseRewardClaim(
  progress: CourseProgress,
  rewardId: string,
  now = new Date(),
): Promise<CourseProgress> {
  return mutateCourseProgress((stored) => {
    const current = normalizeCourseProgress(stored ?? progress, now);
    const course = claimCourseReward(current, rewardId, now);
    return { course, result: course };
  });
}

function markOperation(progress: CourseProgress, operationId: string): CourseProgress {
  const recent = progress.appliedOperations ?? [];
  if (recent.includes(operationId)) return progress;
  return { ...progress, appliedOperations: [...recent, operationId].slice(-2_000) };
}

function saveStoryMutation(input: {
  progress: CourseProgress;
  bookId: StoryBookId;
  operationId: string;
  now?: Date;
  mutate: (current: StoryBookProgress | undefined) => StoryBookProgress;
}): Promise<CourseProgress> {
  return mutateCourseProgress((stored) => {
    const current = normalizeCourseProgress(stored ?? input.progress, input.now);
    if (!storyBookIsUnlocked(current, input.bookId)) {
      throw new Error('Tato četba je zatím zamčená. Dokonči příslušný checkpoint cesty.');
    }
    if ((current.appliedOperations ?? []).includes(input.operationId)) {
      return { course: current, result: current };
    }
    const nextBookProgress = input.mutate(current.storyBooks[input.bookId]);
    const course = markOperation(
      {
        ...current,
        storyBooks: { ...current.storyBooks, [input.bookId]: nextBookProgress },
        updatedAt: nextBookProgress.updatedAt,
      },
      input.operationId,
    );
    return { course, result: course };
  });
}

export function saveStoryPage(input: {
  progress: CourseProgress;
  operationId: string;
  bookId: StoryBookId;
  episodeId: string;
  pageNumber: number;
  now?: Date;
}): Promise<CourseProgress> {
  return saveStoryMutation({
    ...input,
    mutate: (current) => recordStoryPage(current, input),
  });
}

export function saveStoryCheckpoint(input: {
  progress: CourseProgress;
  operationId: string;
  bookId: StoryBookId;
  episodeId: string;
  checkpointId: string;
  result: StoryExerciseResult;
  now?: Date;
}): Promise<CourseProgress> {
  return saveStoryMutation({
    ...input,
    mutate: (current) => recordStoryExercise(current, input),
  });
}

export function saveStoryEpisode(input: {
  progress: CourseProgress;
  operationId: string;
  bookId: StoryBookId;
  episodeId: string;
  nextEpisodeId?: string;
  now?: Date;
}): Promise<CourseProgress> {
  return saveStoryMutation({
    ...input,
    mutate: (current) => recordStoryEpisodeComplete(current, input),
  });
}

export function saveStoryWord(input: {
  progress: CourseProgress;
  operationId: string;
  bookId: StoryBookId;
  episodeId: string;
  now?: Date;
}): Promise<CourseProgress> {
  return saveStoryMutation({
    ...input,
    mutate: (current) => recordStorySavedWord(current, input),
  });
}

export async function removeNote(
  noteId: string,
  progress: CourseProgress,
  now = new Date(),
): Promise<CourseProgress> {
  const { removeNoteFromCourseVocabularyEvents } = await import('../domain/course/vocabulary.ts');
  return deleteNoteCascade(noteId, (stored) => {
    const current = normalizeCourseProgress(stored ?? progress, now);
    const course = removeNoteFromCourseVocabularyEvents(current, noteId, now);
    return { course, result: course };
  });
}

export function loadOrCreateDailySession(
  proposed: DailySessionRecord,
): Promise<DailySessionRecord> {
  return getOrCreateDailySession(proposed);
}

export function saveDailyActivityResult(input: {
  sessionKey: string;
  activityId: string;
  evidence?: LearningEvidence;
  needsRepair?: boolean;
  now?: Date;
}): Promise<DailySessionRecord> {
  const now = input.now ?? new Date();
  return mutateDailySession(input.sessionKey, (stored) => {
    const activity = stored.plan.activities.find((candidate) => candidate.id === input.activityId);
    if (!activity) throw new Error('Tento krok už v dnešní lekci není dostupný.');
    if (stored.completedActivityIds.includes(activity.id)) {
      return { session: stored, result: stored };
    }
    if (input.evidence && input.evidence.activityId !== activity.id) {
      throw new Error('Důkaz učení neodpovídá dokončenému kroku.');
    }
    const repaired = input.needsRepair ? insertRepairActivity(stored, activity.id, now) : stored;
    const session = completeDailyActivity(repaired, activity.id, input.evidence?.id, now);
    return { session, evidence: input.evidence, result: session };
  });
}

export async function exportBackup(): Promise<AppBackup> {
  return parseBackup(await readBackup());
}

export async function resetToSeed(): Promise<AppSnapshot> {
  publishDatabaseSync({ type: 'reset-started' });
  return replaceDestructivelyWithRollback(createFreshBackup());
}

export async function restoreBackup(value: unknown): Promise<AppSnapshot> {
  const backup = parseBackup(value);
  publishDatabaseSync({ type: 'restore-started' });
  return replaceDestructivelyWithRollback(backup);
}

export function rollbackIsAvailable(): boolean {
  return rollbackBackup !== undefined;
}

export async function rollbackLastDestructiveChange(): Promise<AppSnapshot> {
  const target = rollbackBackup;
  if (!target) throw new Error('Žádná krátkodobá záloha pro vrácení změny není dostupná.');
  const current = parseBackup(await readBackup());
  await replaceWithBackup(target);
  parseBackup(await readBackup());
  rollbackBackup = current;
  return loadSnapshot();
}
