import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessCoachMessage,
  rejectedCoachResult,
} from '../src/lib/domain/course/coach-relevance.ts';
import { coachScenarios } from '../src/lib/domain/course/coach.ts';
import {
  claimCourseReward,
  courseAnswersOnDay,
  courseSummary,
  courseSummaryForLessons,
  creditedCoachTurnsOnDay,
  createCourseProgress,
  grammarCategories,
  grammarLessonById,
  grammarLevelForLesson,
  grammarLessons,
  grammarLessonsForLevel,
  lessonProgress,
  recordCoachSession,
  recordCourseAnswer,
  recordLessonRun,
  recommendedGrammarLesson,
} from '../src/lib/domain/course/grammar.ts';
import { DETAILED_CEFR_LEVELS } from '../src/lib/domain/levels.ts';
import { demoCoach } from '../src/lib/server/ai/demo.server.ts';

test('gramatický kurz má ucelený katalog 125 krátkých lekcí od A1.1 do C1.2', () => {
  assert.equal(grammarCategories.length, 17);
  assert.equal(grammarLessons.length, 125);
  assert.equal(
    grammarLessons.reduce((sum, lesson) => sum + lesson.questions.length, 0),
    625,
  );
  assert.deepEqual(
    [...new Set(grammarLessons.map((lesson) => lesson.cefr))],
    ['A1', 'A2', 'B1', 'B2', 'C1'],
  );
  assert.deepEqual([...new Set(grammarLessons.map(grammarLevelForLesson))], DETAILED_CEFR_LEVELS);
  assert.deepEqual(
    DETAILED_CEFR_LEVELS.map((level) => [
      level,
      grammarLessons.filter((lesson) => grammarLevelForLesson(lesson) === level).length,
    ]),
    [
      ['A1.1', 13],
      ['A1.2', 13],
      ['A2.1', 16],
      ['A2.2', 14],
      ['B1.1', 13],
      ['B1.2', 10],
      ['B2.1', 12],
      ['B2.2', 12],
      ['C1.1', 11],
      ['C1.2', 11],
    ],
  );
  assert.deepEqual(
    grammarLessons.map((lesson) => lesson.unit).toSorted((left, right) => left - right),
    Array.from({ length: 125 }, (_, index) => index + 1),
  );
  assert.equal(grammarLessons.filter((lesson) => lesson.unit >= 36).length, 90);

  const lessonIds = new Set<string>();
  const questionIds = new Set<string>();
  const categoryIds = new Set<string>();
  const categoryNumbers = new Set<string>();
  for (const lesson of grammarLessons) {
    assert.ok(lesson.minutes >= 5 && lesson.minutes <= 8, `${lesson.id} musí mít 5–8 minut`);
    assert.equal(lesson.questions.length, 5, `${lesson.id} musí mít právě pět otázek`);
    assert.equal(grammarLevelForLesson(lesson).slice(0, 2), lesson.cefr);
    assert.ok(lesson.concept.length >= 70, `${lesson.id} potřebuje úplné vysvětlení`);
    assert.ok(lesson.formula.length > 0, `${lesson.id} potřebuje vzorec`);
    assert.ok(lesson.examples.length >= 2, `${lesson.id} potřebuje nejméně dva příklady`);
    assert.ok(!lessonIds.has(lesson.id), `duplicitní lekce ${lesson.id}`);
    lessonIds.add(lesson.id);
    assert.ok(grammarCategories.some((category) => category.id === lesson.categoryId));

    for (const question of lesson.questions) {
      assert.ok(!questionIds.has(question.id), `duplicitní otázka ${question.id}`);
      questionIds.add(question.id);
      assert.ok(question.prompt.length > 0);
      assert.ok(question.explanation.length > 0);
      assert.ok(question.skill.length > 0);
      if (question.kind === 'choice') {
        assert.ok(question.options.length >= 3);
        assert.equal(new Set(question.options).size, question.options.length);
        assert.ok(question.options.includes(question.answer));
      }
      if (question.kind === 'fill') assert.ok(question.answers.every(Boolean));
      if (question.kind === 'order') {
        assert.deepEqual(
          question.tokens.toSorted((left, right) => left.localeCompare(right)),
          question.answer.toSorted((left, right) => left.localeCompare(right)),
        );
      }
    }
  }

  for (const category of grammarCategories) {
    assert.equal(categoryIds.has(category.id), false, `duplicitní kategorie ${category.id}`);
    assert.equal(
      categoryNumbers.has(category.number),
      false,
      `duplicitní číslo kategorie ${category.number}`,
    );
    categoryIds.add(category.id);
    categoryNumbers.add(category.number);
    assert.ok(
      grammarLessons.some((lesson) => lesson.categoryId === category.id),
      `kategorie ${category.id} nesmí být prázdná`,
    );
  }
});

test('podrobná úroveň skryje jen jednodušší gramatiku a doporučení zůstane ve výběru', () => {
  const visible = grammarLessonsForLevel('B1.1');
  const levels = new Set(visible.map(grammarLevelForLesson));

  assert.ok(visible.length > 0);
  assert.equal(levels.has('A1.1'), false);
  assert.equal(levels.has('A2.2'), false);
  assert.equal(levels.has('B1.1'), true);
  assert.equal(levels.has('C1.2'), true);
  assert.equal(grammarLessonsForLevel('A1.1').length, 125);
  assert.equal(grammarLessonsForLevel('C1.2').length, 11);
  assert.deepEqual(
    visible.map(grammarLevelForLesson),
    visible
      .map(grammarLevelForLesson)
      .toSorted(
        (left, right) => DETAILED_CEFR_LEVELS.indexOf(left) - DETAILED_CEFR_LEVELS.indexOf(right),
      ),
  );

  const progress = createCourseProgress();
  const summary = courseSummaryForLessons(progress, visible);
  assert.equal(summary.totalLessons, visible.length);
  assert.ok(visible.includes(grammarLessonById('praeteritum-core')!));
  assert.equal(recommendedGrammarLesson(progress, visible).id, visible[0].id);
});

test('AI trenér nabízí nejméně devadesát šest různorodých scénářů napříč A1 až C1', () => {
  assert.ok(coachScenarios.length >= 96);
  assert.deepEqual(
    [...new Set(coachScenarios.map((scenario) => scenario.level))],
    ['A1', 'A2', 'B1', 'B2', 'C1'],
  );
  for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
    assert.ok(
      coachScenarios.filter((scenario) => scenario.level === level).length >= 5,
      `${level} potřebuje alespoň pět rozdílných situací`,
    );
  }
  const genericReplies = new Set([
    'Gut. Kannst du mir noch einen Satz dazu sagen?',
    'Verstanden. Was möchtest du als Nächstes sagen?',
    'Sehr schön. Stelle mir jetzt bitte eine kurze Frage.',
  ]);
  const ids = new Set<string>();
  for (const scenario of coachScenarios) {
    assert.equal(ids.has(scenario.id), false, `duplicitní scénář ${scenario.id}`);
    ids.add(scenario.id);
    assert.equal(scenario.turns, 3);
    assert.equal(scenario.starterPrompts.length, 3);
    assert.ok(scenario.contextCues.length >= 8, `${scenario.id} potřebuje situační slovník`);
    if (scenario.level === 'A1' || scenario.level === 'A2') {
      assert.equal(
        scenario.guidedHints?.length,
        scenario.turns,
        `${scenario.id} potřebuje nápovědu pro každý tah`,
      );
    }
    for (const [index, message] of scenario.starterPrompts.entries()) {
      const demo = demoCoach({
        mode: 'conversation',
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        goal: scenario.goal,
        level: scenario.level,
        turn: index + 1,
        maxTurns: scenario.turns,
        message,
        focusWords: scenario.focusWords,
        history: [{ role: 'coach', text: scenario.opening }],
      });
      assert.equal(
        demo.accepted,
        true,
        `${scenario.id}, tah ${index + 1} musí fungovat i v demo režimu`,
      );
      assert.ok(demo.reply.length > 0);
      assert.equal(
        genericReplies.has(demo.reply),
        false,
        `${scenario.id} potřebuje vlastní navazující repliku pro tah ${index + 1}`,
      );
    }
  }
});

test('AI trenér odmítne nesmysl, jiný jazyk i německou větu mimo situaci', () => {
  const scenario = coachScenarios.find((candidate) => candidate.id === 'cafe');
  assert.ok(scenario);
  const history = [{ role: 'coach' as const, text: scenario.opening }];

  assert.deepEqual(
    assessCoachMessage({ scenario, message: 'asdfghjkl qwertzuiop', turn: 1, history }).issue,
    'nonsense',
  );
  assert.deepEqual(
    assessCoachMessage({ scenario, message: 'Dnes půjdu domů.', turn: 1, history }).issue,
    'not-german',
  );
  assert.deepEqual(
    assessCoachMessage({
      scenario,
      message: 'Ich spiele heute mit meinem Elefanten Fußball.',
      turn: 1,
      history,
    }).issue,
    'off-topic',
  );

  const demo = demoCoach({
    mode: 'conversation',
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    goal: scenario.goal,
    level: scenario.level,
    turn: 1,
    maxTurns: scenario.turns,
    message: 'Ich spiele heute mit meinem Elefanten Fußball.',
    focusWords: scenario.focusWords,
    history,
  });
  assert.equal(demo.accepted, false);
  assert.equal(demo.score, 0);
  assert.equal(demo.missionProgress, 0);
  assert.match(demo.feedback, /nesouvisí/u);

  for (const candidate of coachScenarios) {
    const result = assessCoachMessage({
      scenario: candidate,
      message: 'Mein Elefant programmiert heute eine violette Kartoffel.',
      turn: 1,
      history: [{ role: 'coach', text: candidate.opening }],
    });
    assert.equal(result.issue, 'off-topic', `${candidate.id} musí hlídat vlastní kontext`);
  }
});

test('kontextová kontrola přijme přirozenou alternativu i krátkou přímou odpověď', () => {
  const cafe = coachScenarios.find((candidate) => candidate.id === 'cafe');
  const invitation = coachScenarios.find((candidate) => candidate.id === 'invitation');
  assert.ok(cafe);
  assert.ok(invitation);

  assert.equal(
    assessCoachMessage({
      scenario: cafe,
      message: 'Einen Kaffee und ein Stück Kuchen, bitte.',
      turn: 1,
      history: [{ role: 'coach', text: cafe.opening }],
    }).accepted,
    true,
  );
  assert.equal(
    assessCoachMessage({
      scenario: invitation,
      message: 'Ja, natürlich.',
      turn: 1,
      history: [{ role: 'coach', text: invitation.opening }],
    }).accepted,
    true,
  );
});

test('AI trenér po neúspěšném pokusu zachová původní otázku a reaguje podle typu odpovědi', () => {
  const scenario = coachScenarios.find(
    (candidate) => candidate.id === 'transfer-measurable-study-goal',
  );
  assert.ok(scenario);
  const activeQuestion = 'Das passt zur Situation. Welche konkrete Angabe fehlt noch?';
  const history = [
    { role: 'coach' as const, text: scenario.opening },
    { role: 'learner' as const, text: scenario.starterPrompts[0] },
    { role: 'coach' as const, text: activeQuestion },
    { role: 'learner' as const, text: 'Ich habe keine Ahnung.' },
    {
      role: 'coach' as const,
      text: 'Das passt noch nicht zu unserer Situation. Versuch es bitte noch einmal.',
    },
  ];

  const support = assessCoachMessage({
    scenario,
    message: 'Ich habe keine Ahnung.',
    turn: 2,
    history,
  });
  assert.equal(support.issue, 'needs-support');
  assert.equal(support.activeCoachMessage, activeQuestion);
  const supportResult = rejectedCoachResult({
    scenario,
    assessment: support,
    turn: 2,
    maxTurns: 3,
  });
  assert.equal(supportResult.outcome, 'needs-support');
  assert.match(supportResult.reply, /Welche konkrete Angabe fehlt noch/u);
  assert.match(supportResult.nextHint, /Dafür übe ich …/u);

  const tooShort = assessCoachMessage({ scenario, message: 'Was?', turn: 2, history });
  assert.equal(tooShort.issue, 'too-short');
  assert.equal(tooShort.activeCoachMessage, activeQuestion);

  const attemptedButWrong = assessCoachMessage({
    scenario,
    message: 'Meine Angabe ist die Fern sehen.',
    turn: 2,
    history,
  });
  assert.equal(attemptedButWrong.issue, 'off-topic');
  assert.equal(attemptedButWrong.activeCoachMessage, activeQuestion);
  const retry = rejectedCoachResult({
    scenario,
    assessment: attemptedButWrong,
    turn: 2,
    maxTurns: 3,
  });
  assert.match(retry.feedback, /Dafür übe ich …/u);
  assert.notEqual(retry.reply, history.at(-1)?.text);

  assert.equal(
    assessCoachMessage({
      scenario,
      message: 'Ich lerne regelmäßig.',
      turn: 2,
      history,
    }).accepted,
    true,
  );
});

test('demo konverzace po přijaté odpovědi navede na skutečně následující bod', () => {
  const scenario = coachScenarios.find(
    (candidate) => candidate.id === 'transfer-measurable-study-goal',
  );
  assert.ok(scenario);

  const first = demoCoach({
    mode: 'conversation',
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    goal: scenario.goal,
    level: scenario.level,
    turn: 1,
    maxTurns: scenario.turns,
    message: scenario.starterPrompts[0],
    focusWords: scenario.focusWords,
    history: [{ role: 'coach', text: scenario.opening }],
  });
  assert.equal(first.outcome, 'accepted');
  assert.match(first.reply, /Dafür übe ich …/u);

  const second = demoCoach({
    mode: 'conversation',
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    goal: scenario.goal,
    level: scenario.level,
    turn: 2,
    maxTurns: scenario.turns,
    message: scenario.starterPrompts[1],
    focusWords: scenario.focusWords,
    history: [
      { role: 'coach', text: scenario.opening },
      { role: 'learner', text: scenario.starterPrompts[0] },
      { role: 'coach', text: first.reply },
    ],
  });
  assert.equal(second.outcome, 'accepted');
  assert.match(second.reply, /Am Monatsende nehme ich …/u);
});

test('kontrola nesmyslu neodmítne platná německá slova s kořenem wert', () => {
  const remoteWork = coachScenarios.find((candidate) => candidate.id === 'remote-work');
  assert.ok(remoteWork);

  assert.equal(
    assessCoachMessage({
      scenario: remoteWork,
      message: 'Wir sollten die Ergebnisse nach sechs Wochen auswerten.',
      turn: 3,
      history: [{ role: 'coach', text: remoteWork.opening }],
    }).accepted,
    true,
  );
});

test('první zvládnutí dává plné XP a denní opakování nejde farmit', () => {
  const lesson = grammarLessons[0];
  const question = lesson.questions[0];
  const first = recordCourseAnswer(createCourseProgress(), {
    lessonId: lesson.id,
    questionId: question.id,
    correct: true,
    responseMs: 900,
    now: new Date('2026-08-04T10:00:00.000Z'),
  });
  const repeatedSameDay = recordCourseAnswer(first.progress, {
    lessonId: lesson.id,
    questionId: question.id,
    correct: true,
    responseMs: 500,
    now: new Date('2026-08-04T10:01:00.000Z'),
  });
  const practicedNextDay = recordCourseAnswer(repeatedSameDay.progress, {
    lessonId: lesson.id,
    questionId: question.id,
    correct: true,
    responseMs: 500,
    now: new Date('2026-08-05T10:01:00.000Z'),
  });
  const repeatedNextDay = recordCourseAnswer(practicedNextDay.progress, {
    lessonId: lesson.id,
    questionId: question.id,
    correct: true,
    responseMs: 500,
    now: new Date('2026-08-05T10:02:00.000Z'),
  });

  assert.equal(first.xpAwarded, 12);
  assert.equal(first.event.firstTry, true);
  assert.equal(repeatedSameDay.xpAwarded, 0);
  assert.equal(practicedNextDay.xpAwarded, 3);
  assert.equal(repeatedNextDay.xpAwarded, 0);
  assert.equal(courseSummary(repeatedNextDay.progress).grammarXp, 15);
});

test('denní gramatický blok počítá jen unikátní správně zvládnuté otázky', () => {
  const lesson = grammarLessons[0];
  const firstQuestion = lesson.questions[0];
  const secondQuestion = lesson.questions[1];
  let progress = createCourseProgress(new Date('2026-08-04T09:00:00.000Z'));

  for (const [index, answer] of [
    { questionId: firstQuestion.id, correct: false },
    { questionId: firstQuestion.id, correct: true },
    { questionId: firstQuestion.id, correct: true },
    { questionId: secondQuestion.id, correct: true },
  ].entries()) {
    progress = recordCourseAnswer(progress, {
      lessonId: lesson.id,
      questionId: answer.questionId,
      correct: answer.correct,
      responseMs: 900,
      now: new Date(`2026-08-04T09:0${index}:00.000Z`),
    }).progress;
  }

  assert.equal(courseAnswersOnDay(progress, new Date('2026-08-04T12:00:00.000Z')), 2);
});

test('lekce se dokončí až po zvládnutí všech pěti otázek a přidá bonus', () => {
  const lesson = grammarLessonById('verb-second-position');
  assert.ok(lesson);
  let progress = createCourseProgress(new Date('2026-08-04T08:00:00.000Z'));
  let finalXp = 0;

  for (const [index, question] of lesson.questions.entries()) {
    const result = recordCourseAnswer(progress, {
      lessonId: lesson.id,
      questionId: question.id,
      correct: true,
      responseMs: 1_000 + index,
      now: new Date(`2026-08-04T08:0${index}:00.000Z`),
    });
    progress = result.progress;
    finalXp = result.xpAwarded;
    assert.equal(result.lessonCompletedNow, index === lesson.questions.length - 1);
  }

  const state = lessonProgress(progress, lesson);
  assert.equal(state.completed, true);
  assert.equal(state.stars, 3);
  assert.equal(finalXp, 12 + lesson.completionXp);
});

test('opakovaná celá jízda může zlepšit nejlepší hodnocení lekce', () => {
  const lesson = grammarLessons[0];
  let progress = createCourseProgress(new Date('2026-08-04T08:00:00.000Z'));

  for (const [index, question] of lesson.questions.entries()) {
    if (index < 3) {
      progress = recordCourseAnswer(progress, {
        lessonId: lesson.id,
        questionId: question.id,
        correct: false,
        responseMs: 1_200,
        now: new Date(`2026-08-04T08:${String(index * 2).padStart(2, '0')}:00.000Z`),
      }).progress;
    }
    progress = recordCourseAnswer(progress, {
      lessonId: lesson.id,
      questionId: question.id,
      correct: true,
      responseMs: 900,
      now: new Date(`2026-08-04T08:${String(index * 2 + 1).padStart(2, '0')}:00.000Z`),
    }).progress;
  }

  assert.equal(lessonProgress(progress, lesson).stars, 1);

  const improved = recordLessonRun(progress, {
    lessonId: lesson.id,
    correctFirstTry: lesson.questions.length,
    total: lesson.questions.length,
    now: new Date('2026-08-05T09:00:00.000Z'),
  });
  assert.equal(improved.improved, true);
  assert.equal(improved.previousBest, 1);
  assert.equal(improved.stars, 3);
  assert.equal(lessonProgress(improved.progress, lesson).stars, 3);

  const lowerReplay = recordLessonRun(improved.progress, {
    lessonId: lesson.id,
    correctFirstTry: 0,
    total: lesson.questions.length,
    now: new Date('2026-08-06T09:00:00.000Z'),
  });
  assert.equal(lowerReplay.improved, false);
  assert.equal(lowerReplay.progress, improved.progress);
  assert.equal(lessonProgress(lowerReplay.progress, lesson).stars, 3);
});

test('AI scénář dává denní odměnu jen jednou', () => {
  const day = new Date('2026-08-04T12:00:00.000Z');
  const first = recordCoachSession(createCourseProgress(day), {
    scenarioId: 'cafe-order',
    score: 88,
    turns: 3,
    now: day,
  });
  const repeated = recordCoachSession(first.progress, {
    scenarioId: 'cafe-order',
    score: 100,
    turns: 3,
    now: new Date('2026-08-04T15:00:00.000Z'),
  });
  const nextDay = recordCoachSession(repeated.progress, {
    scenarioId: 'cafe-order',
    score: 75,
    turns: 3,
    now: new Date('2026-08-05T09:00:00.000Z'),
  });

  assert.equal(first.xpAwarded, 24);
  assert.equal(repeated.xpAwarded, 0);
  assert.equal(nextDay.xpAwarded, 23);
  assert.equal(creditedCoachTurnsOnDay(repeated.progress, day), 3);
});

test('odměna se označí jako vyzvednutá pouze jednou', () => {
  const progress = createCourseProgress();
  const claimed = claimCourseReward(progress, 'xp-2000');
  const claimedAgain = claimCourseReward(claimed, 'xp-2000');

  assert.deepEqual(claimed.claimedRewards, ['xp-2000']);
  assert.equal(claimedAgain, claimed);
});
