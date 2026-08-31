import assert from 'node:assert/strict';
import test from 'node:test';

import type { CoachScenario } from '../src/lib/domain/course/coach.ts';
import type { GrammarLesson } from '../src/lib/domain/course/grammar.ts';
import {
  buildDailyLessonPlan,
  completeDailyActivity,
  createDailySession,
  dailySessionSummary,
  insertRepairActivity,
} from '../src/lib/domain/learning/planner.ts';
import type { PlannerChapter } from '../src/lib/domain/learning/planner.ts';
import type { LearningEvidence } from '../src/lib/domain/learning/types.ts';
import type { Note, StudyCard } from '../src/lib/domain/types.ts';

const now = new Date('2026-08-13T08:00:00.000Z');

function note(id: string, dueTag = ''): Note {
  return {
    id,
    deckId: 'deck',
    german: `Wort ${id}`,
    normalizedGerman: `wort ${id}`,
    czech: `slovo ${id}`,
    kind: 'other',
    acceptedGerman: [`Wort ${id}`],
    acceptedCzech: [`slovo ${id}`],
    tags: dueTag ? [dueTag] : [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function card(id: string, dueAt: string): StudyCard {
  return {
    id: `card:${id}`,
    deckId: 'deck',
    noteId: id,
    direction: 'cs-de',
    dueAt,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

const grammarLesson = {
  id: 'lesson-1',
  categoryId: 'basics',
  unit: 1,
  title: 'Sloveso ve větě',
  shortTitle: 'Pozice slovesa',
  subtitle: 'Test',
  cefr: 'A1',
  minutes: 5,
  completionXp: 10,
  concept: 'Test',
  formula: 'Test',
  examples: [],
  questions: [
    {
      id: 'q1',
      kind: 'choice',
      prompt: 'Heute ___ ich.',
      instruction: 'Vyber.',
      explanation: 'Test',
      skill: 'word order',
      options: ['lerne', 'lernen'],
      answer: 'lerne',
    },
  ],
} satisfies GrammarLesson;

const scenario = {
  id: 'cafe',
  title: 'V kavárně',
  eyebrow: 'Roleplay',
  description: 'Test',
  goal: 'Objednat',
  level: 'A1',
  minutes: 5,
  turns: 3,
  opening: 'Was möchten Sie?',
  openingCs: 'Co si dáte?',
  focusWords: ['bitte'],
  contextCues: ['Kaffee'],
  starterPrompts: ['Ich hätte gern einen Kaffee.'],
  learnerRole: 'host',
  coachRole: 'staff',
  icon: 'coffee',
  accent: 'coral',
} satisfies CoachScenario;

const chapter = {
  id: 'chapter-1',
  number: 1,
  level: 'A1.1',
  title: 'První kapitola',
  grammarLessonId: grammarLesson.id,
  coachScenarioId: scenario.id,
  grammarLessonIds: [grammarLesson.id],
  coachScenarioIds: [scenario.id],
  modelSentences: [
    { de: 'Heute lerne ich Deutsch.', cs: 'Dnes se učím německy.' },
    { de: 'Morgen lese ich ein Buch.', cs: 'Zítra čtu knihu.' },
  ],
  dialogue: [],
} satisfies PlannerChapter;

function plan(minutes: 5 | 10 | 20 = 10, learningEvidence: LearningEvidence[] = []) {
  const notes = ['1', '2', '3', '4', '5', '6'].map((id) => note(id, id === '3' ? 'test' : ''));
  const cards = [
    card('1', '2026-08-10T08:00:00.000Z'),
    card('2', '2026-08-11T08:00:00.000Z'),
    card('3', '2026-08-12T08:00:00.000Z'),
    card('4', '2026-08-14T08:00:00.000Z'),
    card('5', '2026-08-15T08:00:00.000Z'),
    card('6', '2026-08-16T08:00:00.000Z'),
  ];
  return buildDailyLessonPlan({
    now,
    minutes,
    learningGoal: 'school',
    cards,
    notes,
    skillStates: [],
    learningEvidence,
    grammarLessons: [grammarLesson],
    coachScenarios: [scenario],
    chapters: [chapter],
    currentChapterId: chapter.id,
    examTag: 'test',
  });
}

test('the same local day produces a stable daily plan', () => {
  const first = plan(10);
  const second = plan(10);
  assert.deepEqual(first, second);
  assert.equal(first.id, 'daily:2026-08-13:10:school:v2');
  assert.equal(first.schemaVersion, 2);
  assert.equal(first.estimatedSeconds, 600);
  assert.equal(first.activities.at(-1)?.kind, 'exit-ticket');
});

test('time templates keep due FSRS cards first and provide active output', () => {
  const five = plan(5);
  const ten = plan(10);
  const twenty = plan(20);
  assert.equal(five.activities.filter((activity) => activity.kind === 'review').length, 2);
  assert.equal(ten.activities.filter((activity) => activity.kind === 'review').length, 3);
  assert.equal(twenty.activities.filter((activity) => activity.kind === 'review').length, 5);
  assert.deepEqual(
    ten.activities
      .filter((activity) => activity.kind === 'review')
      .map((activity) => activity.noteId),
    ['1', '2', '3'],
  );
  assert.ok(twenty.activities.some((activity) => activity.kind === 'grammar'));
  assert.ok(twenty.activities.some((activity) => activity.kind === 'listening'));
  assert.ok(twenty.activities.some((activity) => activity.kind === 'transfer'));
  const listening = twenty.activities.find((activity) => activity.kind === 'listening');
  assert.ok(listening && listening.kind === 'listening');
  const sentenceIndex = chapter.modelSentences.findIndex(
    (sentence) => sentence.de === listening.transcript,
  );
  assert.equal(listening.audioId, `chapter-${chapter.id}-${sentenceIndex}`);
});

test('session progress is idempotent and a failed item returns after two activities', () => {
  const session = createDailySession(plan(10), now);
  const first = session.plan.activities[0];
  const withRepair = insertRepairActivity(session, first.id, now);
  assert.equal(withRepair.plan.activities[3].repairOf, first.id);
  assert.equal(insertRepairActivity(withRepair, first.id, now), withRepair);

  const completed = completeDailyActivity(withRepair, first.id, 'evidence:1', now);
  const replayed = completeDailyActivity(completed, first.id, 'evidence:1', now);
  assert.equal(replayed.completedActivityIds.length, 1);
  assert.equal(replayed.evidenceIds.length, 1);
  assert.deepEqual(dailySessionSummary(replayed), {
    completed: 1,
    total: withRepair.plan.activities.length,
    percent: Math.round(100 / withRepair.plan.activities.length),
    finished: false,
  });
});

test('nový den nahradí běžný transfer jednou cílenou opravou známé chyby', () => {
  const signal: LearningEvidence = {
    id: 'evidence:coach:cafe:weak',
    source: 'coach-session',
    sourceId: scenario.id,
    skillIds: [`communication:${scenario.id}`],
    occurredAt: '2026-08-12T08:00:00.000Z',
    localDay: '2026-08-12',
    mode: 'long-term',
    modality: 'free-production',
    outcome: 'incorrect',
    hintsUsed: 0,
    responseMs: 1_200,
    independent: true,
    mistakeTags: ['word-order'],
  };
  const repairPlan = plan(10, [signal]);
  const repair = repairPlan.activities.find((activity) => activity.phase === 'repair');

  assert.ok(repair?.kind === 'transfer');
  assert.equal(repair.turnsTarget, 1);
  assert.deepEqual(repair.repair, {
    evidenceId: signal.id,
    mistakeTag: 'word-order',
  });

  const resolved: LearningEvidence = {
    ...signal,
    id: 'evidence:coach:cafe:repair',
    occurredAt: '2026-08-13T07:00:00.000Z',
    localDay: '2026-08-13',
    outcome: 'correct',
    mistakeTags: [],
    repairOfEvidenceId: signal.id,
  };
  const nextPlan = plan(10, [signal, resolved]);
  assert.equal(
    nextPlan.activities.some((activity) => activity.phase === 'repair'),
    false,
  );
});
