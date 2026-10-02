import type { CoachScenario } from '../course/coach.ts';
import type { GrammarLesson } from '../course/grammar.ts';
import type { CoursePathChapter } from '../course/path.ts';
import type { StoryBook } from '../stories/types.ts';
import type { Note } from '../types.ts';
import type {
  EvidenceModality,
  LearningEvidence,
  SkillDefinition,
  SkillStage,
  SkillState,
} from './types.ts';

const DAY_MS = 86_400_000;
const STAGE_INTERVAL_DAYS: Record<SkillStage, number> = {
  0: 1,
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

const MODALITY_STAGE_CAP: Record<EvidenceModality, SkillStage> = {
  recognition: 2,
  'guided-recall': 4,
  dictation: 4,
  'free-production': 5,
  reading: 3,
};

export type VocabularySkillAspect = 'meaning' | 'recall' | 'article' | 'plural' | 'form';

export function vocabularySkillId(noteId: string, aspect: VocabularySkillAspect): string {
  return `vocabulary:${noteId}:${aspect}`;
}

export function grammarSkillId(lessonId: string): string {
  return `grammar:${lessonId}`;
}

export function listeningSkillId(chapterId: string): string {
  return `listening:${chapterId}`;
}

export function communicationSkillId(scenarioId: string): string {
  return `communication:${scenarioId}`;
}

export function readingSkillId(bookId: string): string {
  return `reading:${bookId}`;
}

function vocabularyDefinitions(note: Note): SkillDefinition[] {
  const meaningId = vocabularySkillId(note.id, 'meaning');
  const recallId = vocabularySkillId(note.id, 'recall');
  const common = {
    domain: 'vocabulary' as const,
    sourceId: note.id,
    cefr: note.cefr,
    relatedSkillIds: [meaningId, recallId],
  };
  const definitions: SkillDefinition[] = [
    {
      ...common,
      id: meaningId,
      title: `${note.german} · význam`,
      prerequisiteIds: [],
    },
    {
      ...common,
      id: recallId,
      title: `${note.german} · aktivní vybavení`,
      prerequisiteIds: [meaningId],
    },
  ];

  if (note.kind === 'noun' && note.article) {
    const articleId = vocabularySkillId(note.id, 'article');
    definitions.push({
      ...common,
      id: articleId,
      title: `${note.german} · člen`,
      prerequisiteIds: [meaningId],
      relatedSkillIds: [meaningId, recallId, articleId],
    });
  }
  if (note.kind === 'noun' && note.plural) {
    const pluralId = vocabularySkillId(note.id, 'plural');
    definitions.push({
      ...common,
      id: pluralId,
      title: `${note.german} · množné číslo`,
      prerequisiteIds: [meaningId],
      relatedSkillIds: [meaningId, recallId, pluralId],
    });
  }
  if (note.kind === 'verb' && note.verbForms) {
    const formId = vocabularySkillId(note.id, 'form');
    definitions.push({
      ...common,
      id: formId,
      title: `${note.german} · slovesné tvary`,
      prerequisiteIds: [meaningId],
      relatedSkillIds: [meaningId, recallId, formId],
    });
  }
  return definitions;
}

export function buildSkillGraph(input: {
  notes: Note[];
  grammarLessons: GrammarLesson[];
  chapters: CoursePathChapter[];
  coachScenarios: CoachScenario[];
  storyBooks: StoryBook[];
}): SkillDefinition[] {
  const graph = input.notes.flatMap(vocabularyDefinitions);
  const grammarIds = new Set(input.grammarLessons.map((lesson) => lesson.id));

  for (const lesson of input.grammarLessons) {
    graph.push({
      id: grammarSkillId(lesson.id),
      domain: 'grammar',
      title: lesson.title,
      sourceId: lesson.id,
      cefr: lesson.cefr,
      prerequisiteIds: [],
      relatedSkillIds: [],
    });
  }

  for (const chapter of input.chapters) {
    const grammarPrerequisites = chapter.grammarLessonIds
      .filter((lessonId) => grammarIds.has(lessonId))
      .map(grammarSkillId);
    const listeningId = listeningSkillId(chapter.id);
    graph.push({
      id: listeningId,
      domain: 'listening',
      title: `${chapter.title} · poslech`,
      sourceId: chapter.id,
      cefr: chapter.level,
      prerequisiteIds: grammarPrerequisites,
      relatedSkillIds: chapter.coachScenarioIds.map(communicationSkillId),
    });
  }

  const chapterByScenario = new Map<string, CoursePathChapter>();
  for (const chapter of input.chapters) {
    for (const scenarioId of chapter.coachScenarioIds) {
      if (!chapterByScenario.has(scenarioId)) chapterByScenario.set(scenarioId, chapter);
    }
  }
  for (const scenario of input.coachScenarios) {
    const chapter = chapterByScenario.get(scenario.id);
    graph.push({
      id: communicationSkillId(scenario.id),
      domain: 'communication',
      title: scenario.title,
      sourceId: scenario.id,
      cefr: scenario.level,
      prerequisiteIds: chapter
        ? [listeningSkillId(chapter.id), grammarSkillId(chapter.grammarLessonId)]
        : [],
      relatedSkillIds: chapter ? [listeningSkillId(chapter.id)] : [],
    });
  }

  for (const book of input.storyBooks) {
    graph.push({
      id: readingSkillId(book.id),
      domain: 'reading',
      title: book.title,
      sourceId: book.id,
      cefr: book.level,
      prerequisiteIds: [],
      relatedSkillIds: [],
    });
  }

  return graph.toSorted((left, right) => left.id.localeCompare(right.id));
}

function clampStage(value: number): SkillStage {
  return Math.max(0, Math.min(5, value)) as SkillStage;
}

function nextReviewAt(occurredAt: string, stage: SkillStage): string {
  return new Date(Date.parse(occurredAt) + STAGE_INTERVAL_DAYS[stage] * DAY_MS).toISOString();
}

export function applyEvidenceToSkillState(
  current: SkillState | undefined,
  evidence: LearningEvidence,
  skillId: string,
): SkillState {
  const initial: SkillState = current ?? {
    skillId,
    stage: 0,
    nextReviewAt: evidence.occurredAt,
    independentSuccesses: 0,
    attempts: 0,
  };

  if (evidence.excludedFromLearning || evidence.mode === 'cram' || evidence.outcome === 'skipped') {
    return initial;
  }

  const successful = evidence.outcome === 'correct' || evidence.outcome === 'completed';
  const independent = successful && evidence.independent && evidence.hintsUsed === 0;
  const cap = MODALITY_STAGE_CAP[evidence.modality];
  const occurredAt = Date.parse(evidence.occurredAt);
  const previousDueAt = Date.parse(initial.nextReviewAt);
  const due = !Number.isFinite(previousDueAt) || previousDueAt <= occurredAt;
  // A second answer minutes later is practice, not another spaced retrieval.
  // Recognition also cannot renew a skill demonstrated through free production.
  const renewsMastery = independent && due && cap >= initial.stage;
  const stage = successful
    ? renewsMastery
      ? clampStage(Math.max(initial.stage, Math.min(cap, initial.stage + 1)))
      : initial.stage
    : clampStage(initial.stage - 1);

  const nextDueAt = !successful
    ? nextReviewAt(evidence.occurredAt, 0)
    : renewsMastery
      ? nextReviewAt(evidence.occurredAt, stage)
      : current && Number.isFinite(previousDueAt)
        ? initial.nextReviewAt
        : nextReviewAt(evidence.occurredAt, 0);

  return {
    skillId,
    stage,
    nextReviewAt: nextDueAt,
    independentSuccesses: initial.independentSuccesses + (independent ? 1 : 0),
    attempts: initial.attempts + 1,
    lastEvidenceAt: evidence.occurredAt,
    lastWeakness:
      evidence.outcome === 'incorrect'
        ? (evidence.mistakeTags?.[0] ?? initial.lastWeakness)
        : initial.lastWeakness,
  };
}

export function deriveSkillStates(evidence: LearningEvidence[]): SkillState[] {
  const stateBySkill = new Map<string, SkillState>();
  const ordered = evidence.toSorted(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id),
  );
  for (const event of ordered) {
    if (event.excludedFromLearning || event.mode === 'cram' || event.outcome === 'skipped') {
      continue;
    }
    for (const skillId of new Set(event.skillIds)) {
      stateBySkill.set(
        skillId,
        applyEvidenceToSkillState(stateBySkill.get(skillId), event, skillId),
      );
    }
  }
  return [...stateBySkill.values()].toSorted((left, right) =>
    left.skillId.localeCompare(right.skillId),
  );
}

export function deriveSkillState(
  evidence: LearningEvidence[],
  skillId: string,
): SkillState | undefined {
  let state: SkillState | undefined;
  const ordered = evidence.toSorted(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) || left.id.localeCompare(right.id),
  );
  for (const event of ordered) {
    if (
      event.excludedFromLearning ||
      event.mode === 'cram' ||
      event.outcome === 'skipped' ||
      !event.skillIds.includes(skillId)
    ) {
      continue;
    }
    state = applyEvidenceToSkillState(state, event, skillId);
  }
  return state;
}

export function skillNeedsPractice(state: SkillState | undefined, now: Date): boolean {
  return !state || Date.parse(state.nextReviewAt) <= now.getTime();
}

export function skillStageCap(modality: EvidenceModality): SkillStage {
  return MODALITY_STAGE_CAP[modality];
}
