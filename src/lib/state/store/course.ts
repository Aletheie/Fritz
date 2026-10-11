import { get } from 'svelte/store';
import {
  saveCoachSession,
  saveCourseAnswer,
  saveCourseRewardClaim,
  saveGrammarLessonRun,
  savePathNodeCompletion,
  savePathNodeStart,
  savePathWritingDraft,
  saveVocabularyPathNodeCompletion,
  saveDoubleXpPurchase,
} from '../../data/repository.ts';
import { localizedError } from '../../domain/errors.ts';
import { createId } from '../../domain/id.ts';
import { learningEvidenceFromCoachSession } from '../../domain/learning/evidence.ts';
import { currentCourse, minimumLevel, setCourse, state, stateWithEvidence } from './core.ts';

import type { CaseAction } from '../../domain/cases/types.ts';
import type { LearningEvidence } from '../../domain/learning/types.ts';
import type { RivalAction, RivalQuestion } from '../../domain/rival/types.ts';
import type { CourseProgress } from '../../domain/types.ts';

export async function answerCourseQuestion(input: {
  operationId?: string;
  activityId?: string;
  hintsUsed?: number;
  lessonId: string;
  questionId: string;
  correct: boolean;
  responseMs: number;
  now?: Date;
}): Promise<Awaited<ReturnType<typeof saveCourseAnswer>>> {
  const result = await saveCourseAnswer({
    ...input,
    operationId: input.operationId ?? createId('course-answer-operation'),
    progress: currentCourse(),
  });
  state.update((value) =>
    stateWithEvidence({ ...value, course: result.progress }, result.evidence),
  );
  return result;
}

export async function completeGrammarLessonRun(input: {
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
    minimumLevel: minimumLevel(),
  });
  if (result.progress !== current.course) {
    setCourse(result.progress);
  }
  return result;
}

export async function completeCoachSession(input: {
  scenarioId: string;
  score: number;
  turns: number;
  independentTurns?: number;
  mistakeTags?: LearningEvidence['mistakeTags'];
  pathNodeId?: string;
  now?: Date;
}): Promise<Awaited<ReturnType<typeof saveCoachSession>>> {
  const result = await saveCoachSession({
    ...input,
    operationId: createId('coach-session-operation'),
    progress: currentCourse(),
    minimumLevel: minimumLevel(),
  });
  state.update((value) =>
    stateWithEvidence(
      { ...value, course: result.progress },
      learningEvidenceFromCoachSession(result.event),
    ),
  );
  return result;
}

export async function startPathNode(nodeId: string, now?: Date): Promise<CourseProgress> {
  const current = get(state);
  const course = await savePathNodeStart({
    progress: current.course,
    nodeId,
    now,
    minimumLevel: minimumLevel(),
  });
  if (course !== current.course) setCourse(course);
  return course;
}

export async function saveWritingDraft(nodeId: string, text: string): Promise<void> {
  const course = await savePathWritingDraft({
    progress: currentCourse(),
    nodeId,
    text,
    minimumLevel: minimumLevel(),
  });
  setCourse(course);
}

export async function completePathNode(input: {
  nodeId: string;
  writtenResponse?: string;
  stars?: number;
  now?: Date;
}): Promise<Awaited<ReturnType<typeof savePathNodeCompletion>>> {
  const result = await savePathNodeCompletion({
    ...input,
    progress: currentCourse(),
    minimumLevel: minimumLevel(),
  });
  setCourse(result.progress);
  return result;
}

export async function completeVocabularyPathNode(input: {
  nodeId: string;
  stars?: number;
  now?: Date;
}): Promise<Awaited<ReturnType<typeof saveVocabularyPathNodeCompletion>>> {
  const current = get(state);
  const deck = current.decks[0];
  if (!deck)
    throw localizedError(
      'Kurzová slovíčka nemají cílový balíček.',
      'Course words have no target deck.',
    );
  const result = await saveVocabularyPathNodeCompletion({
    ...input,
    progress: current.course,
    deckId: deck.id,
    minimumLevel: minimumLevel(),
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

export async function purchaseDoubleXp(
  now?: Date,
): Promise<Awaited<ReturnType<typeof saveDoubleXpPurchase>>> {
  const result = await saveDoubleXpPurchase({
    progress: currentCourse(),
    now,
  });
  setCourse(result.progress);
  return result;
}

export async function claimReward(rewardId: string): Promise<void> {
  const course = await saveCourseRewardClaim(currentCourse(), rewardId);
  setCourse(course);
}

export async function rivalAction(action: RivalAction, pool: RivalQuestion[] = []): Promise<void> {
  const settings = get(state).settings;
  if (!settings?.gamificationEnabled || !settings.rivalryEnabled) {
    throw localizedError(
      'Soupeření je vypnuté. Zapnout ho můžeš v nastavení.',
      'The rival is turned off. You can turn it on in settings.',
    );
  }
  const { saveRivalAction } = await import('../../data/rival.ts');
  const course = await saveRivalAction(action, pool);
  setCourse(course);
}

export async function caseAction(action: CaseAction): Promise<void> {
  const { saveCaseAction } = await import('../../data/cases.ts');
  const course = await saveCaseAction(action);
  setCourse(course);
}
