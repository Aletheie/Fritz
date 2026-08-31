import type { CoursePathChapter, CoursePathNode, CoursePathPhase } from './path.ts';

export type CoursePathPhaseInfo = {
  label: string;
  description: string;
};

export const coursePathPhaseInfo: Record<CoursePathPhase, CoursePathPhaseInfo> = {
  foundation: {
    label: 'Postav základ',
    description: 'Nejdřív význam a výslovnost, potom pravidlo.',
  },
  connection: {
    label: 'Propoj souvislosti',
    description: 'Nová slova uslyšíš a použiješ v celých větách.',
  },
  production: {
    label: 'Použij aktivně',
    description: 'Jedna vlastní věta a krátká situace bez pasivního klikání.',
  },
  check: {
    label: 'Ověř bez opory',
    description: 'Krátký mix rozhodne, zda je kapitola opravdu uzavřená.',
  },
  bonus: {
    label: 'Rozšiř kontext',
    description: 'Volitelná četba přenese znalost do souvislého textu.',
  },
};

export function coursePathChapterMinutes(chapter: CoursePathChapter): number {
  let minutes = 0;
  for (const node of chapter.nodes) {
    if (node.required) minutes += node.minutes;
  }
  return minutes;
}

export function coursePathNodeHref(node: CoursePathNode): string {
  if (node.type === 'grammar' && node.grammarLessonId) {
    return `/grammar/${encodeURIComponent(node.grammarLessonId)}/?path=${encodeURIComponent(node.id)}`;
  }
  if (node.type === 'coach' && node.coachScenarioId) {
    return `/coach/session/${encodeURIComponent(node.coachScenarioId)}/?path=${encodeURIComponent(node.id)}`;
  }
  if (node.type === 'reading' && node.storyBookId) {
    return `/stories/${encodeURIComponent(node.storyBookId)}/`;
  }
  return `/path/${encodeURIComponent(node.id)}/`;
}
