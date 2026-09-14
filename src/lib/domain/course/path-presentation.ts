import type { CoursePathChapter, CoursePathNode, CoursePathPhase } from './path.ts';

export type CoursePathPhaseInfo = {
  label: string;
  description: string;
};

export const coursePathPhaseInfo: Record<CoursePathPhase, CoursePathPhaseInfo> = {
  foundation: {
    label: 'Slovíčka a gramatika',
    description: 'Nejdřív význam a výslovnost, potom pravidlo.',
  },
  connection: {
    label: 'Poslech a věty',
    description: 'Nová slova uslyšíš a použiješ v celých větách.',
  },
  production: {
    label: 'Psaní a rozhovor',
    description: 'Napiš vlastní text a zkus krátký rozhovor.',
  },
  check: {
    label: 'Ověř, co zvládneš',
    description: 'Vybavení zpaměti, věty v kontextu a návrat ke starší látce.',
  },
  bonus: {
    label: 'Přečti si příběh',
    description: 'Přečti si příběh a procvič si, co už znáš.',
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
