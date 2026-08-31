import type { CoachScenario } from '../course/coach.ts';
import type { GrammarLesson, GrammarQuestion } from '../course/grammar.ts';
import { stableHash, takeLowest } from '../deterministic.ts';
import { localDateKey } from '../stats/learning.ts';
import type {
  DailyMinutes,
  DetailedCefrLevel,
  LearningGoal,
  MistakeTag,
  Note,
  StudyCard,
} from '../types.ts';
import {
  communicationSkillId,
  grammarSkillId,
  listeningSkillId,
  vocabularySkillId,
} from './skills.ts';
import type {
  DailyLessonPlan,
  DailySessionRecord,
  DailySessionSummary,
  LearningEvidence,
  LessonActivity,
  SkillState,
} from './types.ts';

type LessonTemplate = {
  reviewSeconds: number;
  reviewCount: number;
  focus: Array<{ kind: 'grammar' | 'listening'; seconds: number }>;
  transferSeconds: number;
  closeSeconds: number;
};

type RankedReviewCard = {
  card: StudyCard;
  dueAt: number;
  tier: number;
  exam: number;
  skillPriority: number;
};

const LESSON_TEMPLATES: Record<DailyMinutes, LessonTemplate> = {
  5: {
    reviewSeconds: 120,
    reviewCount: 2,
    focus: [{ kind: 'listening', seconds: 90 }],
    transferSeconds: 60,
    closeSeconds: 30,
  },
  10: {
    reviewSeconds: 180,
    reviewCount: 3,
    focus: [{ kind: 'listening', seconds: 180 }],
    transferSeconds: 180,
    closeSeconds: 60,
  },
  20: {
    reviewSeconds: 300,
    reviewCount: 5,
    focus: [
      { kind: 'grammar', seconds: 150 },
      { kind: 'listening', seconds: 150 },
    ],
    transferSeconds: 480,
    closeSeconds: 120,
  },
};

export type DailyPlannerInput = {
  now: Date;
  minutes: DailyMinutes;
  learningGoal: LearningGoal;
  cards: StudyCard[];
  notes: Note[];
  skillStates: SkillState[];
  learningEvidence: LearningEvidence[];
  grammarLessons: GrammarLesson[];
  coachScenarios: CoachScenario[];
  chapters: PlannerChapter[];
  currentChapterId?: string;
  examTag?: string;
};

export type PlannerChapter = {
  id: string;
  number: number;
  level: DetailedCefrLevel;
  title: string;
  grammarLessonId: string;
  coachScenarioId: string;
  grammarLessonIds: string[];
  coachScenarioIds: string[];
  modelSentences: Array<{ de: string; cs: string }>;
  dialogue: Array<{ de: string; cs: string }>;
};

function stableIndex(seed: string, length: number): number {
  return length > 0 ? stableHash(seed) % length : 0;
}

function statePriority(state: SkillState | undefined, now: Date): number {
  if (!state) return -1_000_000;
  const overdueDays = Math.max(0, (now.getTime() - Date.parse(state.nextReviewAt)) / 86_400_000);
  return state.stage * 10_000 - overdueDays;
}

function compareReviewCards(left: RankedReviewCard, right: RankedReviewCard): number {
  return (
    left.tier - right.tier ||
    (left.tier === 0 ? left.dueAt - right.dueAt : 0) ||
    left.exam - right.exam ||
    left.skillPriority - right.skillPriority ||
    left.dueAt - right.dueAt ||
    left.card.id.localeCompare(right.card.id)
  );
}

function selectReviewCards(input: DailyPlannerInput, count: number): StudyCard[] {
  const noteById = new Map(input.notes.map((note) => [note.id, note]));
  const stateById = new Map(input.skillStates.map((state) => [state.skillId, state]));
  const nowMs = input.now.getTime();
  const bestByNote = new Map<string, RankedReviewCard>();
  for (const card of input.cards) {
    const note = noteById.get(card.noteId);
    if (!note) continue;
    const dueAt = Date.parse(card.dueAt);
    const candidate = {
      card,
      dueAt,
      tier: dueAt <= nowMs ? 0 : 1,
      exam: input.examTag && note.tags.includes(input.examTag) ? 0 : 1,
      skillPriority: statePriority(
        stateById.get(vocabularySkillId(card.noteId, 'recall')),
        input.now,
      ),
    };
    const current = bestByNote.get(card.noteId);
    if (!current || compareReviewCards(candidate, current) < 0) {
      bestByNote.set(card.noteId, candidate);
    }
  }
  return takeLowest([...bestByNote.values()], Math.ceil(count), compareReviewCards).map(
    (candidate) => candidate.card,
  );
}

type ConversationRepairSignal = {
  evidenceId: string;
  mistakeTag: MistakeTag;
  scenario: CoachScenario;
};

function selectConversationRepair(input: DailyPlannerInput): ConversationRepairSignal | undefined {
  const scenarioBySkillId = new Map(
    input.coachScenarios.map((scenario) => [communicationSkillId(scenario.id), scenario]),
  );
  const resolvedEvidenceIds = new Set<string>();
  for (const evidence of input.learningEvidence) {
    if (
      !evidence.excludedFromLearning &&
      evidence.repairOfEvidenceId &&
      (evidence.outcome === 'correct' || evidence.outcome === 'completed')
    ) {
      resolvedEvidenceIds.add(evidence.repairOfEvidenceId);
    }
  }
  const oldestUsefulSignal = input.now.getTime() - 30 * 86_400_000;
  let latest: { occurredAt: string; signal: ConversationRepairSignal } | undefined;
  for (const evidence of input.learningEvidence) {
    if (
      evidence.source !== 'coach-session' ||
      evidence.excludedFromLearning ||
      resolvedEvidenceIds.has(evidence.id) ||
      Date.parse(evidence.occurredAt) < oldestUsefulSignal ||
      !evidence.mistakeTags?.length
    ) {
      continue;
    }
    let scenario: CoachScenario | undefined;
    for (const skillId of evidence.skillIds) {
      scenario = scenarioBySkillId.get(skillId);
      if (scenario) break;
    }
    const mistakeTag = evidence.mistakeTags[0];
    if (!scenario || !mistakeTag || mistakeTag === 'unknown') continue;
    if (!latest || evidence.occurredAt.localeCompare(latest.occurredAt) > 0) {
      latest = {
        occurredAt: evidence.occurredAt,
        signal: { evidenceId: evidence.id, mistakeTag, scenario },
      };
    }
  }
  return latest?.signal;
}

const REPAIR_TITLES: Record<MistakeTag, string> = {
  article: 'Člen u podstatného jména',
  gender: 'Rod podstatného jména',
  plural: 'Množné číslo',
  'verb-form': 'Tvar slovesa',
  auxiliary: 'Pomocné sloveso',
  'separable-prefix': 'Odlučitelná předpona',
  'word-order': 'Slovosled',
  case: 'Správný pád',
  preposition: 'Předložka',
  negation: 'Zápor',
  spelling: 'Německý zápis',
  meaning: 'Přesný význam',
  register: 'Přirozená formulace',
  fluency: 'Plynulá replika',
  unknown: 'Krátká oprava',
};

function chapterScore(
  chapter: PlannerChapter,
  input: DailyPlannerInput,
  stateById: Map<string, SkillState>,
): number {
  const isCurrent = chapter.id === input.currentChapterId ? 0 : 1;
  const listening = statePriority(stateById.get(listeningSkillId(chapter.id)), input.now);
  const grammar = statePriority(stateById.get(grammarSkillId(chapter.grammarLessonId)), input.now);
  return Math.min(listening, grammar) * 10 + isCurrent;
}

function selectChapter(input: DailyPlannerInput): PlannerChapter | undefined {
  const stateById = new Map(input.skillStates.map((state) => [state.skillId, state]));
  return input.chapters.toSorted((left, right) => {
    const score = chapterScore(left, input, stateById) - chapterScore(right, input, stateById);
    return score || left.number - right.number || left.id.localeCompare(right.id);
  })[0];
}

function selectGrammarLesson(
  input: DailyPlannerInput,
  chapter: PlannerChapter | undefined,
): GrammarLesson | undefined {
  const stateById = new Map(input.skillStates.map((state) => [state.skillId, state]));
  return input.grammarLessons.toSorted((left, right) => {
    const leftCurrent = left.id === chapter?.grammarLessonId ? 0 : 1;
    const rightCurrent = right.id === chapter?.grammarLessonId ? 0 : 1;
    const weak =
      statePriority(stateById.get(grammarSkillId(left.id)), input.now) -
      statePriority(stateById.get(grammarSkillId(right.id)), input.now);
    return (
      weak ||
      leftCurrent - rightCurrent ||
      left.unit - right.unit ||
      left.id.localeCompare(right.id)
    );
  })[0];
}

function selectQuestion(lesson: GrammarLesson, seed: string): GrammarQuestion {
  return lesson.questions[stableIndex(seed, lesson.questions.length)];
}

function selectScenario(
  input: DailyPlannerInput,
  chapter: PlannerChapter | undefined,
): CoachScenario | undefined {
  const stateById = new Map(input.skillStates.map((state) => [state.skillId, state]));
  return input.coachScenarios.toSorted((left, right) => {
    const leftCurrent = left.id === chapter?.coachScenarioId ? 0 : 1;
    const rightCurrent = right.id === chapter?.coachScenarioId ? 0 : 1;
    const weak =
      statePriority(stateById.get(communicationSkillId(left.id)), input.now) -
      statePriority(stateById.get(communicationSkillId(right.id)), input.now);
    const goalBias = input.learningGoal === 'conversation' ? weak * 10 : weak;
    return goalBias || leftCurrent - rightCurrent || left.id.localeCompare(right.id);
  })[0];
}

function grammarFocus(lesson: GrammarLesson, localDay: string, seconds: number): LessonActivity {
  const question = selectQuestion(lesson, `${localDay}:${lesson.id}:grammar`);
  return {
    id: `daily:${localDay}:grammar:${lesson.id}:${question.id}`,
    kind: 'grammar',
    phase: 'focus',
    title: lesson.shortTitle,
    instruction: question.instruction,
    estimatedSeconds: seconds,
    skillIds: [grammarSkillId(lesson.id)],
    lessonId: lesson.id,
    questionId: question.id,
    questionKind: question.kind,
  };
}

function listeningFocus(
  chapter: PlannerChapter,
  localDay: string,
  seconds: number,
): LessonActivity {
  const sentenceIndex = stableIndex(
    `${localDay}:${chapter.id}:listening`,
    chapter.modelSentences.length,
  );
  const sentence = chapter.modelSentences[sentenceIndex] ?? {
    de: chapter.dialogue[0]?.de ?? chapter.title,
    cs: chapter.dialogue[0]?.cs ?? '',
  };
  return {
    id: `daily:${localDay}:listening:${chapter.id}`,
    kind: 'listening',
    phase: 'focus',
    title: 'Poslech bez opory',
    instruction: 'Poslechni si větu a napiš přesně to, co slyšíš.',
    estimatedSeconds: seconds,
    skillIds: [listeningSkillId(chapter.id)],
    chapterId: chapter.id,
    audioId: `chapter-${chapter.id}-${sentenceIndex}`,
    transcript: sentence.de,
    translation: sentence.cs,
  };
}

function reviewActivities(
  input: DailyPlannerInput,
  localDay: string,
  template: LessonTemplate,
): LessonActivity[] {
  const selected = selectReviewCards(input, template.reviewCount);
  const eachSeconds = selected.length
    ? Math.floor(template.reviewSeconds / selected.length)
    : template.reviewSeconds;
  return selected.map((card, index) => ({
    id: `daily:${localDay}:review:${card.id}`,
    kind: 'review' as const,
    phase: 'review' as const,
    title: `Opakování ${index + 1} z ${selected.length}`,
    instruction:
      card.direction === 'cs-de' ? 'Napiš německý výraz bez nápovědy.' : 'Vybav si český význam.',
    estimatedSeconds: eachSeconds,
    skillIds: [vocabularySkillId(card.noteId, card.direction === 'cs-de' ? 'recall' : 'meaning')],
    cardId: card.id,
    noteId: card.noteId,
    direction: card.direction,
  }));
}

export function buildDailyLessonPlan(input: DailyPlannerInput): DailyLessonPlan {
  const localDay = localDateKey(input.now);
  const template = LESSON_TEMPLATES[input.minutes];
  const chapter = selectChapter(input);
  const grammar = selectGrammarLesson(input, chapter);
  const repairSignal = selectConversationRepair(input);
  const scenario = repairSignal?.scenario ?? selectScenario(input, chapter);
  const activities = reviewActivities(input, localDay, template);

  const focusKinds = template.focus.map((focus) => focus.kind);
  if (input.minutes !== 20 && input.learningGoal === 'school') focusKinds[0] = 'grammar';
  for (let index = 0; index < template.focus.length; index += 1) {
    const focus = template.focus[index];
    const kind = focusKinds[index];
    if (kind === 'grammar' && grammar) {
      activities.push(grammarFocus(grammar, localDay, focus.seconds));
    } else if (chapter) {
      activities.push(listeningFocus(chapter, localDay, focus.seconds));
    } else if (grammar) {
      activities.push(grammarFocus(grammar, localDay, focus.seconds));
    }
  }

  if (scenario) {
    const repairTitle = repairSignal ? REPAIR_TITLES[repairSignal.mistakeTag] : undefined;
    activities.push({
      id: repairSignal
        ? `daily:${localDay}:repair:${scenario.id}:${repairSignal.mistakeTag}`
        : `daily:${localDay}:transfer:${scenario.id}`,
      kind: 'transfer',
      phase: repairSignal ? 'repair' : 'transfer',
      title: repairTitle ? `Krátká oprava: ${repairTitle}` : scenario.title,
      instruction: repairSignal
        ? `Jednou krátkou replikou si ověř ${repairTitle?.toLocaleLowerCase('cs-CZ')}. Text po dokončení nezůstane uložený.`
        : 'Odpověz vlastní německou větou. Text ani nahrávku neukládáme.',
      estimatedSeconds: template.transferSeconds,
      skillIds: [communicationSkillId(scenario.id)],
      scenarioId: scenario.id,
      prompt: scenario.opening,
      starter:
        scenario.starterPrompts[
          stableIndex(`${localDay}:${scenario.id}`, scenario.starterPrompts.length)
        ] ?? '',
      turnsTarget: repairSignal ? 1 : input.minutes === 20 ? 3 : input.minutes === 10 ? 2 : 1,
      repair: repairSignal
        ? {
            evidenceId: repairSignal.evidenceId,
            mistakeTag: repairSignal.mistakeTag,
          }
        : undefined,
    });
  }

  activities.push({
    id: `daily:${localDay}:exit-ticket`,
    kind: 'exit-ticket',
    phase: 'close',
    title: 'Co dnes zůstalo v hlavě?',
    instruction: 'Jedním klepnutím uzavři lekci a ulož pokrok.',
    estimatedSeconds: template.closeSeconds,
    skillIds: [],
    prompt: 'Která část byla dnes nejtěžší?',
  });

  return {
    id: `daily:${localDay}:${input.minutes}:${input.learningGoal}:v2`,
    schemaVersion: 2,
    localDay,
    minutes: input.minutes,
    learningGoal: input.learningGoal,
    generatedAt: input.now.toISOString(),
    estimatedSeconds: input.minutes * 60,
    activities,
  };
}

export function createDailySession(plan: DailyLessonPlan, now = new Date()): DailySessionRecord {
  return {
    key: plan.id,
    schemaVersion: 2,
    plan,
    cursor: 0,
    completedActivityIds: [],
    evidenceIds: [],
    updatedAt: now.toISOString(),
  };
}

export function normalizeDailySessionRecord(value: unknown): DailySessionRecord | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const session = value as Record<string, unknown>;
  const plan = session.plan;
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return undefined;
  const rawPlan = plan as Record<string, unknown>;
  if (
    (session.schemaVersion !== 1 && session.schemaVersion !== 2) ||
    (rawPlan.schemaVersion !== 1 && rawPlan.schemaVersion !== 2) ||
    typeof session.key !== 'string' ||
    typeof rawPlan.id !== 'string' ||
    !Array.isArray(rawPlan.activities) ||
    !Array.isArray(session.completedActivityIds) ||
    !Array.isArray(session.evidenceIds)
  ) {
    return undefined;
  }
  return {
    ...(session as unknown as DailySessionRecord),
    schemaVersion: 2,
    plan: {
      ...(rawPlan as unknown as DailyLessonPlan),
      schemaVersion: 2,
    },
  };
}

export function dailySessionSummary(session: DailySessionRecord): DailySessionSummary {
  const total = session.plan.activities.length;
  const completed = session.completedActivityIds.filter((id) =>
    session.plan.activities.some((activity) => activity.id === id),
  ).length;
  return {
    completed,
    total,
    percent: total === 0 ? 100 : Math.round((completed / total) * 100),
    finished: total === 0 || completed >= total,
  };
}

export function completeDailyActivity(
  session: DailySessionRecord,
  activityId: string,
  evidenceId: string | undefined,
  now = new Date(),
): DailySessionRecord {
  const completedActivityIds = session.completedActivityIds.includes(activityId)
    ? session.completedActivityIds
    : [...session.completedActivityIds, activityId];
  const evidenceIds =
    evidenceId && !session.evidenceIds.includes(evidenceId)
      ? [...session.evidenceIds, evidenceId]
      : session.evidenceIds;
  const nextIndex = session.plan.activities.findIndex(
    (activity) => !completedActivityIds.includes(activity.id),
  );
  const finished = nextIndex === -1;
  return {
    ...session,
    cursor: finished ? session.plan.activities.length : nextIndex,
    completedActivityIds,
    evidenceIds,
    startedAt: session.startedAt ?? now.toISOString(),
    completedAt: finished ? (session.completedAt ?? now.toISOString()) : undefined,
    updatedAt: now.toISOString(),
  };
}

export function insertRepairActivity(
  session: DailySessionRecord,
  failedActivityId: string,
  now = new Date(),
): DailySessionRecord {
  const sourceIndex = session.plan.activities.findIndex(
    (activity) => activity.id === failedActivityId,
  );
  const source = session.plan.activities[sourceIndex];
  if (!source || source.kind === 'exit-ticket' || source.repairOf) return session;
  const repairId = `${source.id}:repair`;
  if (session.plan.activities.some((activity) => activity.id === repairId)) return session;

  const insertAt = Math.min(session.plan.activities.length - 1, sourceIndex + 3);
  const repair: LessonActivity = {
    ...source,
    id: repairId,
    phase: 'repair',
    title: `Oprava · ${source.title}`,
    instruction: 'Zkus stejnou dovednost znovu bez předchozí odpovědi na očích.',
    estimatedSeconds: Math.min(90, source.estimatedSeconds),
    repairOf: source.id,
  };
  const activities = session.plan.activities.slice();
  activities.splice(insertAt, 0, repair);
  return {
    ...session,
    plan: { ...session.plan, activities },
    updatedAt: now.toISOString(),
  };
}
