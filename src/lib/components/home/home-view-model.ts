import {
  coursePathChapterMinutes,
  coursePathNodeHref,
} from '../../domain/course/path-presentation.ts';
import { courseChapterCopy } from '../../i18n/course.ts';
import { t } from '../../i18n/index.ts';

import type {
  CoursePathChapterView,
  CoursePathNode,
  CoursePathNodeState,
  CoursePathNodeType,
} from '../../domain/course/path.ts';
import type { LearningGoal, MotherTongue } from '../../domain/types.ts';

export type HomeDailyProgress = {
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

export type HomeGameProgress = {
  streak: number;
  todayXp: number;
  level: number;
  levelTitle: string;
};

export type HomePrimaryAction = {
  kind: 'daily' | 'complete';
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
  urgent: boolean;
};

export type HomeCourseAction = {
  node: CoursePathNode;
  state: CoursePathNodeState;
  href: string;
  label: string;
  xp: number;
};

export type HomeRailItem = {
  id: string;
  number: number;
  level: string;
  title: string;
  percent: number;
  state: 'completed' | 'current' | 'available' | 'locked';
  href: string;
};

export type HomeViewModel = {
  currentChapter?: CoursePathChapterView;
  previousChapter?: CoursePathChapterView;
  nextChapter?: CoursePathChapterView;
  currentChapterIndex: number;
  chapterMinutes: number;
  primary: HomePrimaryAction;
  courseAction?: HomeCourseAction;
  dueCount: number;
  daily: HomeDailyProgress;
  game: HomeGameProgress;
  rail: HomeRailItem[];
};

export function nodeTypeLabel(type: CoursePathNodeType, language: MotherTongue = 'cs'): string {
  const keys: Record<
    CoursePathNodeType,
    | 'home.node.vocabulary'
    | 'home.node.practice'
    | 'home.node.grammar'
    | 'home.node.mix'
    | 'home.node.sentence'
    | 'home.node.coach'
    | 'home.node.checkpoint'
    | 'home.node.reading'
  > = {
    vocabulary: 'home.node.vocabulary',
    practice: 'home.node.practice',
    grammar: 'home.node.grammar',
    mix: 'home.node.mix',
    sentence: 'home.node.sentence',
    coach: 'home.node.coach',
    checkpoint: 'home.node.checkpoint',
    reading: 'home.node.reading',
  };
  return t(language, keys[type]);
}

export function nodeStateLabel(type: CoursePathNodeState, language: MotherTongue = 'cs'): string {
  const keys: Record<
    CoursePathNodeState,
    | 'home.state.completed'
    | 'home.state.current'
    | 'home.state.available'
    | 'home.state.locked'
    | 'home.state.bonus'
    | 'home.state.inProgress'
  > = {
    completed: 'home.state.completed',
    current: 'home.state.current',
    available: 'home.state.available',
    locked: 'home.state.locked',
    bonus: 'home.state.bonus',
    'in-progress': 'home.state.inProgress',
  };
  return t(language, keys[type]);
}

function courseActionLabel(
  state: CoursePathNodeState,
  node: CoursePathNode,
  language: MotherTongue,
): string {
  if (state === 'in-progress') return t(language, 'home.action.continue');
  if (state === 'completed') {
    return node.type === 'checkpoint'
      ? t(language, 'home.action.improveCheckpoint')
      : t(language, 'home.action.repeat');
  }
  if (node.type === 'checkpoint') return t(language, 'home.action.verifyChapter');
  return t(language, 'home.action.start');
}

function currentChapterIndex(
  chapters: CoursePathChapterView[],
  recommended?: CoursePathNode,
): number {
  const preferred = recommended
    ? chapters.findIndex((view) => view.chapter.id === recommended.chapterId)
    : -1;
  if (preferred >= 0) return preferred;
  const current = chapters.findIndex((view) => view.current);
  if (current >= 0) return current;
  const available = chapters.findIndex((view) => view.unlocked && !view.completed);
  return available >= 0 ? available : Math.max(0, chapters.length - 1);
}

export function createHomeViewModel(input: {
  chapters: CoursePathChapterView[];
  recommended?: CoursePathNode;
  dueCount: number;
  daily: HomeDailyProgress;
  game: HomeGameProgress;
  activeBoost: boolean;
  learningGoal?: LearningGoal;
  language?: MotherTongue;
}): HomeViewModel {
  const language = input.language ?? 'cs';
  const dailyHref = '/today/';
  const index = input.chapters.length ? currentChapterIndex(input.chapters, input.recommended) : -1;
  const currentChapter = index >= 0 ? input.chapters[index] : undefined;
  const recommendedView = input.recommended
    ? currentChapter?.nodes.find((view) => view.node.id === input.recommended?.id)
    : undefined;
  const courseAction = input.recommended
    ? {
        node: input.recommended,
        state: recommendedView?.state ?? 'completed',
        href: coursePathNodeHref(input.recommended),
        label: courseActionLabel(
          recommendedView?.state ?? 'completed',
          input.recommended,
          language,
        ),
        xp:
          recommendedView?.state === 'completed'
            ? 0
            : input.recommended.xp * (input.activeBoost ? 2 : 1),
      }
    : undefined;

  const goalFocus: Record<LearningGoal, { cs: string; en: string }> = {
    school: {
      cs: 'paměť, pravidlo a vlastní věta',
      en: 'memory, one pattern, and your own sentence',
    },
    memory: { cs: 'opakování slovíček a poslech', en: 'vocabulary review and listening' },
    conversation: {
      cs: 'opakování, poslech a aktivní replika',
      en: 'review, listening, and an active reply',
    },
  };
  const focus = goalFocus[input.learningGoal ?? 'school'][language];
  const primary: HomePrimaryAction = input.daily.reached
    ? {
        kind: 'complete',
        eyebrow: language === 'cs' ? 'dnešní plán hotový' : "today's plan complete",
        title: language === 'cs' ? 'Dnes je hotovo.' : 'You are done for today.',
        description:
          language === 'cs'
            ? 'Termíny dalšího opakování jsou uložené. Kurz můžeš dál procházet vlastním tempem.'
            : 'Your next review dates are saved. Continue the course at your own pace.',
        href: dailyHref,
        action: language === 'cs' ? 'Zobrazit souhrn' : 'View summary',
        urgent: false,
      }
    : {
        kind: 'daily',
        eyebrow:
          input.dueCount > 0
            ? language === 'cs'
              ? `${input.dueCount} slovíček k opakování`
              : `${input.dueCount} words to review`
            : language === 'cs'
              ? 'nejlepší další krok'
              : 'best next step',
        title:
          language === 'cs'
            ? `Jedna lekce · ${input.daily.minutes} minut`
            : `One lesson · ${input.daily.minutes} minutes`,
        description:
          language === 'cs'
            ? `Fritz spojí ${focus} v pořadí podle tvého učení.`
            : `Fritz combines ${focus} in an order adapted to your learning.`,
        href: dailyHref,
        action:
          input.daily.completed > 0
            ? language === 'cs'
              ? 'Pokračovat v lekci'
              : 'Continue lesson'
            : language === 'cs'
              ? 'Spustit dnešní lekci'
              : "Start today's lesson",
        urgent: input.dueCount >= 50,
      };

  return {
    currentChapter,
    previousChapter: index > 0 ? input.chapters[index - 1] : undefined,
    nextChapter: index >= 0 ? input.chapters[index + 1] : undefined,
    currentChapterIndex: index,
    chapterMinutes: currentChapter ? coursePathChapterMinutes(currentChapter.chapter) : 0,
    primary,
    courseAction,
    dueCount: Math.max(0, input.dueCount),
    daily: input.daily,
    game: input.game,
    rail: input.chapters.map((chapter, chapterIndex) => ({
      id: chapter.chapter.id,
      number: chapterIndex + 1,
      level: chapter.chapter.level,
      title: courseChapterCopy(language, chapter.chapter).title,
      percent: chapter.percent,
      state: chapter.completed
        ? 'completed'
        : chapterIndex === index
          ? 'current'
          : chapter.unlocked
            ? 'available'
            : 'locked',
      href: chapter.unlocked ? `/#${chapter.chapter.id}` : '/',
    })),
  };
}
