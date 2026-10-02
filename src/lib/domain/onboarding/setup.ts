import { isDetailedCefrLevel } from '../levels.ts';
import type { DailyMinutes, DetailedCefrLevel, LearningGoal } from '../types.ts';

export type OnboardingDraft = {
  step: number;
  goal: LearningGoal;
  level: DetailedCefrLevel;
  minutes: DailyMinutes;
};

export const onboardingLevels: Array<{
  level: DetailedCefrLevel;
  title: string;
  description: string;
  example: string;
}> = [
  {
    level: 'A1.1',
    title: 'Úplné začátky',
    description: 'Začínám od pozdravů, čísel a jednoduchých vět o sobě.',
    example: 'Ich heiße Anna. Ich wohne in Prag.',
  },
  {
    level: 'A1.2',
    title: 'Základy už znám',
    description: 'Představím se. Chci mluvit o rodině, svém dni a domluvit se ve městě.',
    example: 'Am Montag gehe ich zur Schule.',
  },
  {
    level: 'A2.1',
    title: 'Běžné situace',
    description: 'Zvládnu krátký rozhovor. Procvičím cestování a vyprávění o minulosti.',
    example: 'Gestern bin ich mit dem Zug gefahren.',
  },
  {
    level: 'A2.2',
    title: 'Spojuji myšlenky',
    description: 'Používám minulý čas. Chci vysvětlit důvod, plán nebo přání.',
    example: 'Ich bleibe zu Hause, weil ich lernen muss.',
  },
  {
    level: 'B1.1',
    title: 'Mluvím samostatně',
    description: 'Domluvím se v běžných situacích. Chci vyprávět souvisleji a vyjádřit názor.',
    example: 'Wenn ich mehr Zeit hätte, würde ich öfter lesen.',
  },
  {
    level: 'B1.2',
    title: 'Vysvětluji a reaguji',
    description: 'Vedu delší rozhovor. Procvičím přesnější popis, vysvětlení a zdvořilou reakci.',
    example: 'Das ist die Kollegin, mit der ich zusammenarbeite.',
  },
  {
    level: 'B2.1',
    title: 'Diskutuji',
    description: 'Rozumím delším textům. Chci porovnávat argumenty a řešit složitější situace.',
    example: 'Obwohl die Aufgabe anspruchsvoll ist, lohnt sich der Aufwand.',
  },
  {
    level: 'B2.2',
    title: 'Zpřesňuji vyjádření',
    description: 'Dokážu obhájit názor. Zaměřím se na styl, přesnost a složitější větné vazby.',
    example: 'Je klarer das Ziel formuliert wird, desto leichter lässt es sich erreichen.',
  },
  {
    level: 'C1.1',
    title: 'Pracuji s nuancemi',
    description: 'Vyjadřuji se plynule. Procvičím nepřímou řeč, přesné shrnutí a odstíny významu.',
    example: 'Die Autorin betont, die Ergebnisse seien vorläufig.',
  },
  {
    level: 'C1.2',
    title: 'Tříbím styl',
    description: 'Rozumím náročným textům. Chci formulovat stručně, přesně a podle situace.',
    example: 'Angesichts der widersprüchlichen Befunde ist Zurückhaltung geboten.',
  },
];

export function parseOnboardingDraft(value: unknown): OnboardingDraft | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const draft = value as Partial<OnboardingDraft>;
  if (
    ![1, 2, 3].includes(draft.step ?? 0) ||
    !['school', 'memory', 'conversation'].includes(draft.goal ?? '') ||
    !isDetailedCefrLevel(draft.level) ||
    ![5, 10, 20].includes(draft.minutes ?? 0)
  )
    return undefined;
  return { step: draft.step!, goal: draft.goal!, level: draft.level, minutes: draft.minutes! };
}
