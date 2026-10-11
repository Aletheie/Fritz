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
  titleEn: string;
  description: string;
  descriptionEn: string;
  example: string;
}> = [
  {
    level: 'A1.1',
    title: 'Úplné začátky',
    titleEn: 'Complete beginner',
    description: 'Začínám od pozdravů, čísel a jednoduchých vět o sobě.',
    descriptionEn: 'I am starting with greetings, numbers and simple sentences about myself.',
    example: 'Ich heiße Anna. Ich wohne in Prag.',
  },
  {
    level: 'A1.2',
    title: 'Základy už znám',
    titleEn: 'I know the basics',
    description: 'Představím se. Chci mluvit o rodině, svém dni a domluvit se ve městě.',
    descriptionEn:
      'I can introduce myself. I want to talk about family, my day and getting around town.',
    example: 'Am Montag gehe ich zur Schule.',
  },
  {
    level: 'A2.1',
    title: 'Běžné situace',
    titleEn: 'Everyday situations',
    description: 'Zvládnu krátký rozhovor. Procvičím cestování a vyprávění o minulosti.',
    descriptionEn:
      'I can manage a short conversation. I want to practise travel and talking about the past.',
    example: 'Gestern bin ich mit dem Zug gefahren.',
  },
  {
    level: 'A2.2',
    title: 'Spojuji myšlenky',
    titleEn: 'Connecting ideas',
    description: 'Používám minulý čas. Chci vysvětlit důvod, plán nebo přání.',
    descriptionEn: 'I use the past tense. I want to explain a reason, a plan or a wish.',
    example: 'Ich bleibe zu Hause, weil ich lernen muss.',
  },
  {
    level: 'B1.1',
    title: 'Mluvím samostatně',
    titleEn: 'Speaking on my own',
    description: 'Domluvím se v běžných situacích. Chci vyprávět souvisleji a vyjádřit názor.',
    descriptionEn:
      'I get by in everyday situations. I want to tell longer stories and give my opinion.',
    example: 'Wenn ich mehr Zeit hätte, würde ich öfter lesen.',
  },
  {
    level: 'B1.2',
    title: 'Vysvětluji a reaguji',
    titleEn: 'Explaining and responding',
    description: 'Vedu delší rozhovor. Procvičím přesnější popis, vysvětlení a zdvořilou reakci.',
    descriptionEn:
      'I can hold a longer conversation. I want more precise descriptions, explanations and polite replies.',
    example: 'Das ist die Kollegin, mit der ich zusammenarbeite.',
  },
  {
    level: 'B2.1',
    title: 'Diskutuji',
    titleEn: 'Discussing',
    description: 'Rozumím delším textům. Chci porovnávat argumenty a řešit složitější situace.',
    descriptionEn:
      'I understand longer texts. I want to compare arguments and handle more complex situations.',
    example: 'Obwohl die Aufgabe anspruchsvoll ist, lohnt sich der Aufwand.',
  },
  {
    level: 'B2.2',
    title: 'Zpřesňuji vyjádření',
    titleEn: 'Sharpening expression',
    description: 'Dokážu obhájit názor. Zaměřím se na styl, přesnost a složitější větné vazby.',
    descriptionEn:
      'I can defend an opinion. I want to focus on style, precision and complex sentence patterns.',
    example: 'Je klarer das Ziel formuliert wird, desto leichter lässt es sich erreichen.',
  },
  {
    level: 'C1.1',
    title: 'Pracuji s nuancemi',
    titleEn: 'Working with nuance',
    description: 'Vyjadřuji se plynule. Procvičím nepřímou řeč, přesné shrnutí a odstíny významu.',
    descriptionEn:
      'I express myself fluently. I want to practise reported speech, precise summaries and shades of meaning.',
    example: 'Die Autorin betont, die Ergebnisse seien vorläufig.',
  },
  {
    level: 'C1.2',
    title: 'Tříbím styl',
    titleEn: 'Refining style',
    description: 'Rozumím náročným textům. Chci formulovat stručně, přesně a podle situace.',
    descriptionEn:
      'I understand demanding texts. I want to phrase things concisely, precisely and for the situation.',
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
