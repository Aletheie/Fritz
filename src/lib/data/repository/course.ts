import {
  claimCourseReward,
  normalizeCourseProgress,
  recordCoachSession,
} from '../../domain/course/course-progress.ts';
import { purchaseDoubleXp } from '../../domain/course/wallet.ts';
import { localizedError } from '../../domain/errors.ts';
import { totalCourseXp } from '../../domain/gamification.ts';
import {
  learningEvidenceFromCoachSession,
  learningEvidenceFromCourseAnswer,
} from '../../domain/learning/evidence.ts';
import { localDateKey } from '../../domain/stats/learning.ts';
import {
  mutateCourseAndVocabulary,
  mutateCourseProgress,
  mutateCourseWithReviewStats,
} from '../db.ts';
import { markOperation } from './operations.ts';

import type {
  RecordCourseAnswerResult,
  RecordLessonRunResult,
} from '../../domain/course/grammar.ts';
import type { completeCoursePathNode } from '../../domain/course/path.ts';
import type { buildCourseVocabularyCompletion } from '../../domain/course/vocabulary.ts';
import type { LearningEvidence } from '../../domain/learning/types.ts';
import type { CourseProgress, Note, StudyCard, DetailedCefrLevel } from '../../domain/types.ts';

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
  const { recordCourseAnswer } = await import('../../domain/course/grammar.ts');
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
    await import('../../domain/course/grammar.ts');
  const { pathNodeId } = input;
  const path = pathNodeId ? await import('../../domain/course/path.ts') : undefined;
  const lesson = grammarLessonById(input.lessonId);
  if (path && pathNodeId) {
    const node = path.coursePathNodeById(pathNodeId);
    if (node?.type !== 'grammar' || node.grammarLessonId !== input.lessonId) {
      throw localizedError(
        'Tato gramatická lekce neodpovídá otevřenému uzlu cesty.',
        'This grammar lesson does not match the open path step.',
      );
    }
    if (!lesson || input.total !== lesson.questions.length) {
      throw localizedError(
        'Kurzovou gramatiku je potřeba projít jako celou mikrolekci.',
        'Course grammar has to be completed as a whole micro-lesson.',
      );
    }
  }
  return mutateCourseProgress((stored) => {
    const current = normalizeCourseProgress(stored ?? input.progress, input.now);
    if ((current.appliedOperations ?? []).includes(input.operationId)) {
      const replay = recordLessonRun(current, input);
      return { course: current, result: { ...replay, progress: current } };
    }
    if (pathNodeId && lesson && !lessonProgress(current, lesson).completed) {
      throw localizedError(
        'Nejdřív správně dokonči všech pět gramatických otázek.',
        'First answer all five grammar questions correctly.',
      );
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
  const path = pathNodeId ? await import('../../domain/course/path.ts') : undefined;
  if (path && pathNodeId) {
    const node = path.coursePathNodeById(pathNodeId);
    if (node?.type !== 'coach' || node.coachScenarioId !== input.scenarioId) {
      throw localizedError(
        'Tato konverzace neodpovídá otevřenému uzlu cesty.',
        'This conversation does not match the open path step.',
      );
    }
    const { coachScenarioById } = await import('../../domain/course/coach.ts');
    const scenario = coachScenarioById(input.scenarioId);
    if (!scenario || input.turns < scenario.turns) {
      throw localizedError(
        `Kurzová konverzace se dokončí až po ${scenario?.turns ?? 3} kreditovaných replikách.`,
        `A course conversation is complete after ${scenario?.turns ?? 3} credited replies.`,
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
  const { coursePathNodeById, startCoursePathNode } = await import('../../domain/course/path.ts');
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
  const { coursePathNodeById, startCoursePathNode } = await import('../../domain/course/path.ts');
  if (
    coursePathNodeById(input.nodeId)?.type !== 'sentence' ||
    typeof input.text !== 'string' ||
    input.text.length > 5000
  )
    throw localizedError(
      'Rozepsaný text nemá platný písemný krok nebo rozsah.',
      'The draft has no valid writing step or length.',
    );
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
    await import('../../domain/course/path.ts');
  const node = coursePathNodeById(input.nodeId);
  if (!node || node.type === 'reading' || node.type === 'vocabulary') {
    throw localizedError(
      'Tento uzel vyžaduje jiný způsob dokončení.',
      'This step has to be completed in a different way.',
    );
  }
  if (node.type === 'grammar' || node.type === 'coach') {
    throw localizedError(
      'Nejdřív dokonči připojenou lekci nebo konverzaci.',
      'Finish the linked lesson or conversation first.',
    );
  }
  if (input.writtenResponse !== undefined) {
    const { checkCourseWriting } = await import('../../domain/course/course-writing.ts');
    const chapter = coursePathChapterById(node.chapterId);
    if (
      node.type !== 'sentence' ||
      !chapter ||
      !checkCourseWriting(chapter, input.writtenResponse).ready
    ) {
      throw localizedError(
        'Text nesplňuje rozsah nebo slovní zásobu tohoto písemného úkolu.',
        'The text does not meet the length or vocabulary of this writing task.',
      );
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
    import('../../domain/course/path.ts'),
    import('../../domain/course/vocabulary.ts'),
  ]);
  const node = coursePathNodeById(input.nodeId);
  if (node?.type !== 'vocabulary') {
    throw localizedError(
      'Tento uzel nepředstavuje kurzová slovíčka.',
      'This step does not introduce course words.',
    );
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
