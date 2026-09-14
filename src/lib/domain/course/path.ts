import { detailedCefrRank } from '../levels.ts';
import { localDateKey } from '../stats/learning.ts';
import type { StoryBookId } from '../stories/types.ts';
import type {
  Article,
  CefrLevel,
  CourseDoubleXpBoost,
  CoursePathEvent,
  CoursePathNodeProgress,
  CourseProgress,
  DetailedCefrLevel,
  LexemeKind,
  VerbForms,
} from '../types.ts';
import { coachScenarioById } from './coach.ts';
import {
  CORE_COURSE_CHAPTER_IDS,
  COURSE_CONTENT_VERSION,
  LEGACY_COURSE_CHAPTER_IDS,
} from './content-version.ts';
import { applyCourseCoherenceOverride } from './course-coherence-overrides.ts';
import { courseChapterContentSupplements } from './course-content-supplement.ts';
import { createDiversityCourseChapterDefinitions } from './course-diversity-chapters.ts';
import { createExpandedCourseChapterDefinitions } from './course-expansion-v3.ts';
import { additionalCourseChapterDefinitions } from './course-expansion.ts';
import { courseFoundations } from './course-foundations.ts';
import { grammarLessonById } from './grammar.ts';
import { primaryStoryBookId } from './story-unlocks.ts';

export type CoursePathNodeType =
  | 'vocabulary'
  | 'practice'
  | 'grammar'
  | 'mix'
  | 'sentence'
  | 'coach'
  | 'checkpoint'
  | 'reading';

export type CoursePathPhase = 'foundation' | 'connection' | 'production' | 'check' | 'bonus';

export type CoursePathNodeState =
  | 'completed'
  | 'current'
  | 'available'
  | 'locked'
  | 'bonus'
  | 'in-progress';

export type CourseWord = {
  german: string;
  czech: string;
  kind: LexemeKind;
  article?: Article;
  plural?: string;
  acceptedGerman?: string[];
  acceptedCzech?: string[];
  cefr: CefrLevel;
  exampleDe?: string;
  exampleCs?: string;
  learningNote?: string;
  verbForms?: VerbForms;
  senseId?: string;
  role?: 'target' | 'review' | 'stretch';
  contexts?: string[];
  collocations?: string[];
  usageNote?: string;
};

export type CourseLexeme = {
  id: string;
  lemma: string;
  displayGerman: string;
  primaryCzech: string;
  acceptedGerman: string[];
  acceptedCzech: string[];
  senseId: string;
  role: 'target' | 'review' | 'stretch';
  contexts: string[];
  collocations: string[];
} & CourseWord;

export type CourseDialogueTurn = {
  speaker: string;
  de: string;
  cs: string;
};

export type CourseAssessment = {
  id: string;
  instruction: string;
  criteria: string[];
  deterministic: true;
};

export type CourseModelSentence = {
  de: string;
  cs: string;
  trap: string;
  note: string;
};

export type CoursePathNode = {
  id: string;
  chapterId: string;
  order: number;
  type: CoursePathNodeType;
  phase: CoursePathPhase;
  title: string;
  description: string;
  minutes: number;
  xp: number;
  required: boolean;
  grammarLessonId?: string;
  coachScenarioId?: string;
  storyBookId?: StoryBookId;
};

export type CoursePathChapter = {
  id: string;
  number: number;
  level: DetailedCefrLevel;
  title: string;
  subtitle: string;
  themeTag: string;
  grammarLessonId: string;
  coachScenarioId: string;
  storyBookId: StoryBookId;
  grammarIdea: string;
  mission: string;
  outcomes: string[];
  grammarPattern: string;
  modelSentences: CourseModelSentence[];
  sentencePrompt: string;
  sentenceStarter: string;
  sentenceChecklist: string[];
  words: CourseLexeme[];
  nodes: CoursePathNode[];
  contentVersion: number;
  situation: string;
  prerequisites: string[];
  targetLexemeIds: string[];
  reviewLexemeIds: string[];
  grammarLessonIds: string[];
  coachScenarioIds: string[];
  readingIds: StoryBookId[];
  nodeIds: string[];
  estimatedMinutes: number;
  legacyAnchor: boolean;
  legacyNumber?: number;
  dialogue: CourseDialogueTurn[];
  assessment: CourseAssessment;
};

export type CoursePathNodeView = {
  node: CoursePathNode;
  state: CoursePathNodeState;
  progress?: CoursePathNodeProgress;
  lockReason?: string;
};

export type CoursePathChapterView = {
  chapter: CoursePathChapter;
  unlocked: boolean;
  completed: boolean;
  current: boolean;
  completedRequired: number;
  requiredTotal: number;
  percent: number;
  nodes: CoursePathNodeView[];
};

export type CompleteCoursePathNodeResult = {
  progress: CourseProgress;
  firstCompletion: boolean;
  starsImproved: boolean;
  previousStars: 0 | 1 | 2 | 3;
  stars: 0 | 1 | 2 | 3;
  xpAwarded: number;
  boosted: boolean;
  event?: CoursePathEvent;
  unlockedStoryBookId?: StoryBookId;
};

export type CourseChapterDefinition = {
  words: CourseWord[];
  contentVersion?: number;
  situation?: string;
  prerequisites?: string[];
  reviewLexemeIds?: string[];
  grammarLessonIds?: string[];
  coachScenarioIds?: string[];
  readingIds?: StoryBookId[];
  estimatedMinutes?: number;
  legacyAnchor?: boolean;
  dialogue?: CourseDialogueTurn[];
  assessment?: CourseAssessment;
} & Omit<
  CoursePathChapter,
  | 'nodes'
  | 'words'
  | 'contentVersion'
  | 'situation'
  | 'prerequisites'
  | 'targetLexemeIds'
  | 'reviewLexemeIds'
  | 'grammarLessonIds'
  | 'coachScenarioIds'
  | 'readingIds'
  | 'nodeIds'
  | 'estimatedMinutes'
  | 'legacyAnchor'
  | 'legacyNumber'
  | 'dialogue'
  | 'assessment'
>;

function chapterNodes(definition: CourseChapterDefinition): CoursePathNode[] {
  const prefix = definition.id;
  const grammarLesson = grammarLessonById(definition.grammarLessonId);
  const coachScenario = coachScenarioById(definition.coachScenarioId);
  return [
    {
      id: `${prefix}:vocabulary`,
      chapterId: prefix,
      order: 1,
      type: 'vocabulary',
      phase: 'foundation',
      title: `Slovní základ: ${definition.title}`,
      description: `Poznej ${definition.words.length} výrazů v celých větách a ulož je do dlouhodobého učení.`,
      minutes: 4,
      xp: 20,
      required: true,
    },
    {
      id: `${prefix}:practice`,
      chapterId: prefix,
      order: 2,
      type: 'practice',
      phase: 'foundation',
      title: 'Význam bez nápovědy',
      description: `Vybav si český význam všech ${definition.words.length} výrazů dřív, než přidáme nové pravidlo.`,
      minutes: 4,
      xp: 20,
      required: true,
    },
    {
      id: `${prefix}:grammar`,
      chapterId: prefix,
      order: 3,
      type: 'grammar',
      phase: 'connection',
      title: `Pravidlo: ${grammarLesson?.shortTitle ?? definition.grammarIdea}`,
      description:
        grammarLesson?.subtitle ??
        `Pochop princip „${definition.grammarIdea}“ na krátkých příkladech.`,
      minutes: grammarLesson?.minutes ?? 6,
      xp: 25,
      required: true,
      grammarLessonId: definition.grammarLessonId,
    },
    {
      id: `${prefix}:mix`,
      chapterId: prefix,
      order: 4,
      type: 'mix',
      phase: 'connection',
      title: 'Poslech a věty',
      description: `Zachyť jednu větu sluchem a potom rozliš ${Math.max(0, definition.modelSentences.length - 1)} další, ve kterých nové výrazy drží právě naučené pravidlo.`,
      minutes: 5,
      xp: 25,
      required: true,
    },
    {
      id: `${prefix}:sentence`,
      chapterId: prefix,
      order: 5,
      type: 'sentence',
      phase: 'production',
      title: 'Řekni to po svém',
      description: definition.sentencePrompt,
      minutes: 4,
      xp: 20,
      required: true,
    },
    {
      id: `${prefix}:coach`,
      chapterId: prefix,
      order: 6,
      type: 'coach',
      phase: 'production',
      title: `Situace: ${coachScenario?.title ?? definition.title}`,
      description: coachScenario?.goal ?? 'Použij obsah kapitoly ve třech navazujících replikách.',
      minutes: coachScenario?.minutes ?? 6,
      xp: 30,
      required: true,
      coachScenarioId: definition.coachScenarioId,
    },
    {
      id: `${prefix}:checkpoint`,
      chapterId: prefix,
      order: 7,
      type: 'checkpoint',
      phase: 'check',
      title: `Ověření: ${definition.title}`,
      description: `Dva výrazy, jedna jazyková detektivka a ${definition.modelSentences.length} celé věty ověří, co už zvládneš bez opory.`,
      minutes: 7,
      xp: 50,
      required: true,
    },
    {
      id: `${prefix}:reading`,
      chapterId: prefix,
      order: 8,
      type: 'reading',
      phase: 'bonus',
      title: 'Bonusová četba',
      description: 'Přenes znalost do souvislého příběhu s kontrolami porozumění a slovníčkem.',
      minutes: 8,
      xp: 0,
      required: false,
      storyBookId: definition.storyBookId,
    },
  ];
}

function noun(
  german: string,
  czech: string,
  article: Article,
  plural: string,
  cefr: CefrLevel,
  exampleDe: string,
  exampleCs: string,
): CourseWord {
  return { german, czech, kind: 'noun', article, plural, cefr, exampleDe, exampleCs };
}

function verb(
  german: string,
  czech: string,
  cefr: CefrLevel,
  exampleDe: string,
  exampleCs: string,
  verbForms?: VerbForms,
): CourseWord {
  return { german, czech, kind: 'verb', cefr, exampleDe, exampleCs, verbForms };
}

function other(
  german: string,
  czech: string,
  kind: Exclude<LexemeKind, 'noun' | 'verb'>,
  cefr: CefrLevel,
  exampleDe: string,
  exampleCs: string,
): CourseWord {
  return { german, czech, kind, cefr, exampleDe, exampleCs };
}

const chapterDefinitions: CourseChapterDefinition[] = [
  {
    id: 'chapter-01-school',
    number: 1,
    level: 'A1.1',
    title: 'První den ve škole',
    subtitle: 'Představ se, pojmenuj školní věci a postav jednoduchou oznamovací větu.',
    themeTag: 'skola',
    grammarLessonId: 'verb-second-position',
    coachScenarioId: 'introductions',
    storyBookId: 'a1-maerchen',
    grammarIdea: 'sloveso na druhé pozici',
    mission: 'Představíš se nové spolužačce a řekneš, co a kdy se ve škole učíš.',
    outcomes: [
      'pojmenovat pět školních výrazů i se členem nebo tvarem',
      'udržet určité sloveso na druhé pozici také po časovém údaji',
      'navázat krátké seznámení třemi vlastními replikami',
    ],
    grammarPattern: 'Heute + lerne + ich + Deutsch.',
    modelSentences: [
      {
        de: 'Heute lerne ich in der Schule Deutsch.',
        cs: 'Dnes se ve škole učím německy.',
        trap: 'Heute ich lerne in der Schule Deutsch.',
        note: '„Heute“ zabírá první pozici, proto musí následovat sloveso „lerne“.',
      },
      {
        de: 'Die erste Stunde beginnt um acht Uhr.',
        cs: 'První hodina začíná v osm hodin.',
        trap: 'Die erste Stunde um acht Uhr beginnt.',
        note: 'Podmět je první větný člen a sloveso „beginnt“ stojí hned za ním.',
      },
      {
        de: 'Mein Mitschüler schreibt die Aufgabe ins Heft.',
        cs: 'Můj spolužák píše úkol do sešitu.',
        trap: 'Mein Mitschüler die Aufgabe ins Heft schreibt.',
        note: 'V hlavní větě nezůstává časované sloveso na konci.',
      },
    ],
    sentencePrompt: 'Napiš, co se dnes ve škole učíš nebo kdy začíná tvoje první hodina.',
    sentenceStarter: 'Heute lerne ich ...',
    sentenceChecklist: [
      'určité sloveso je na druhé pozici',
      've větě je alespoň jeden výraz z kapitoly',
      'věta sděluje jednu konkrétní informaci',
    ],
    words: [
      noun(
        'Schule',
        'škola',
        'die',
        'Schulen',
        'A1',
        'Die Schule beginnt um acht.',
        'Škola začíná v osm.',
      ),
      noun(
        'Stunde',
        'vyučovací hodina',
        'die',
        'Stunden',
        'A1',
        'Die erste Stunde ist Deutsch.',
        'První hodina je němčina.',
      ),
      noun(
        'Heft',
        'sešit',
        'das',
        'Hefte',
        'A1',
        'Mein Heft liegt auf dem Tisch.',
        'Můj sešit leží na stole.',
      ),
      noun(
        'Mitschüler',
        'spolužák',
        'der',
        'Mitschüler',
        'A1',
        'Mein Mitschüler heißt Paul.',
        'Můj spolužák se jmenuje Paul.',
      ),
      verb(
        'lernen',
        'učit se',
        'A1',
        'Ich lerne jeden Tag Deutsch.',
        'Každý den se učím německy.',
        {
          thirdPerson: 'lernt',
          preterite: 'lernte',
          participle: 'gelernt',
          auxiliary: 'haben',
        },
      ),
    ],
  },
  {
    id: 'chapter-02-day',
    number: 2,
    level: 'A1.2',
    title: 'Můj běžný den',
    subtitle: 'Popiš rutinu, čas a věci, které děláš nebo neděláš.',
    themeTag: 'den',
    grammarLessonId: 'present-endings',
    coachScenarioId: 'bakery',
    storyBookId: 'a1-haewelmann',
    grammarIdea: 'koncovky přítomného času',
    mission: 'Popíšeš své ráno, řekneš, kolik času potřebuješ, a objednáš si snídani.',
    outcomes: [
      'popsat tři části běžného rána',
      'zvolit správnou koncovku slovesa podle osoby',
      'vyřídit krátkou objednávku v pekárně',
    ],
    grammarPattern: 'ich brauche · du brauchst · sie braucht',
    modelSentences: [
      {
        de: 'Morgens brauche ich zehn Minuten für das Frühstück.',
        cs: 'Ráno potřebuji deset minut na snídani.',
        trap: 'Morgens ich brauche zehn Minuten für das Frühstück.',
        note: 'Po „Morgens“ následuje sloveso; pro „ich“ má tvar „brauche“.',
      },
      {
        de: 'Ich stehe morgens um sieben Uhr auf.',
        cs: 'Ráno vstávám v sedm hodin.',
        trap: 'Ich aufstehe morgens um sieben Uhr.',
        note: 'U „aufstehen“ se časuje část „stehe“ a předpona „auf“ uzavírá větu.',
      },
      {
        de: 'Meine Mitschülerin kommt pünktlich zur ersten Stunde.',
        cs: 'Moje spolužačka přichází včas na první hodinu.',
        trap: 'Meine Mitschülerin kommen pünktlich zur ersten Stunde.',
        note: 'Podmět v jednotném čísle potřebuje tvar „kommt“, ne infinitiv „kommen“.',
      },
    ],
    sentencePrompt: 'Popiš jednu část svého rána a přidej konkrétní čas nebo délku.',
    sentenceStarter: 'Morgens ...',
    sentenceChecklist: [
      'sloveso má koncovku podle osoby',
      'věta obsahuje čas nebo délku',
      'použila jsi výraz z této nebo předchozí kapitoly',
    ],
    words: [
      other('morgens', 'ráno', 'other', 'A1', 'Morgens trinke ich Tee.', 'Ráno piji čaj.'),
      verb('aufstehen', 'vstávat', 'A1', 'Ich stehe um sieben Uhr auf.', 'Vstávám v sedm hodin.', {
        thirdPerson: 'steht auf',
        preterite: 'stand auf',
        participle: 'aufgestanden',
        auxiliary: 'sein',
      }),
      noun(
        'Frühstück',
        'snídaně',
        'das',
        'Frühstücke',
        'A1',
        'Das Frühstück ist schon fertig.',
        'Snídaně už je hotová.',
      ),
      verb('brauchen', 'potřebovat', 'A1', 'Ich brauche zehn Minuten.', 'Potřebuji deset minut.', {
        thirdPerson: 'braucht',
        preterite: 'brauchte',
        participle: 'gebraucht',
        auxiliary: 'haben',
      }),
      other(
        'pünktlich',
        'včas, dochvilně',
        'adjective',
        'A2',
        'Sie kommt immer pünktlich.',
        'Vždy chodí včas.',
      ),
    ],
  },
  {
    id: 'chapter-03-travel',
    number: 3,
    level: 'A2.1',
    title: 'Na cestě',
    subtitle: 'Kup jízdenku, zjisti odjezd a použij odlučitelná slovesa.',
    themeTag: 'cestovani',
    grammarLessonId: 'separable-verbs',
    coachScenarioId: 'train',
    storyBookId: 'a2-maerchen',
    grammarIdea: 'odlučitelná slovesa',
    mission: 'Koupíš si jízdenku, ověříš přestup a najdeš správné nástupiště.',
    outcomes: [
      'použít základní výrazy pro cestu vlakem',
      'oddělit předponu slovesa v hlavní větě',
      'získat tři potřebné informace u přepážky',
    ],
    grammarPattern: 'Der Zug + fährt + um 9:20 Uhr + ab.',
    modelSentences: [
      {
        de: 'Der Zug fährt um 9:20 Uhr von Gleis drei ab.',
        cs: 'Vlak odjíždí v 9:20 z nástupiště tři.',
        trap: 'Der Zug abfährt um 9:20 Uhr von Gleis drei.',
        note: 'Časovaná část „fährt“ stojí druhá a předpona „ab“ jde na konec.',
      },
      {
        de: 'In Leipzig steigen wir um.',
        cs: 'V Lipsku přestupujeme.',
        trap: 'In Leipzig wir umsteigen.',
        note: 'Po místním údaji následuje časované „steigen“ a „um“ uzavírá větu.',
      },
      {
        de: 'Ich kaufe eine Fahrkarte hin und zurück.',
        cs: 'Kupuji si zpáteční jízdenku.',
        trap: 'Ich eine Fahrkarte hin und zurück kaufe.',
        note: 'I delší výraz zůstává za slovesem, které drží druhou pozici.',
      },
    ],
    sentencePrompt: 'Napiš, odkud nebo kam jedeš, a přidej odjezd, přestup či nástupiště.',
    sentenceStarter: 'Ich fahre ...',
    sentenceChecklist: [
      'odlučitelná předpona je na konci hlavní věty',
      'věta obsahuje konkrétní údaj o cestě',
      'použila jsi jeden výraz z kapitoly',
    ],
    words: [
      noun(
        'Fahrkarte',
        'jízdenka',
        'die',
        'Fahrkarten',
        'A2',
        'Ich kaufe eine Fahrkarte nach Berlin.',
        'Kupuji si jízdenku do Berlína.',
      ),
      noun(
        'Gleis',
        'nástupiště, kolej',
        'das',
        'Gleise',
        'A2',
        'Der Zug fährt von Gleis drei ab.',
        'Vlak odjíždí z nástupiště tři.',
      ),
      verb(
        'umsteigen',
        'přestoupit',
        'A2',
        'In Leipzig müssen wir umsteigen.',
        'V Lipsku musíme přestoupit.',
        {
          thirdPerson: 'steigt um',
          preterite: 'stieg um',
          participle: 'umgestiegen',
          auxiliary: 'sein',
        },
      ),
      noun(
        'Abfahrt',
        'odjezd',
        'die',
        'Abfahrten',
        'A2',
        'Die Abfahrt ist um 9:20 Uhr.',
        'Odjezd je v 9:20.',
      ),
      other(
        'hin und zurück',
        'tam a zpět',
        'phrase',
        'A2',
        'Eine Fahrkarte hin und zurück, bitte.',
        'Jednu jízdenku tam a zpět, prosím.',
      ),
    ],
  },
  {
    id: 'chapter-04-plans',
    number: 4,
    level: 'A2.2',
    title: 'Domluva a plány',
    subtitle: 'Vysvětli důvod, navrhni termín a spoj dvě myšlenky do jedné věty.',
    themeTag: 'plany',
    grammarLessonId: 'weil-dass',
    coachScenarioId: 'invitation',
    storyBookId: 'a2-max-moritz',
    grammarIdea: 'vedlejší věty s weil a dass',
    mission: 'Navrhneš termín, vysvětlíš důvod změny a domluvu jasně potvrdíš.',
    outcomes: [
      'navrhnout, potvrdit nebo přesunout schůzku',
      'poslat sloveso na konec věty po „weil“ a „dass“',
      'dokončit pozvání bez nejasného ano nebo ne',
    ],
    grammarPattern: 'Ich verschiebe den Termin, weil ich arbeiten muss.',
    modelSentences: [
      {
        de: 'Ich verschiebe die Verabredung, weil ich arbeiten muss.',
        cs: 'Přesouvám schůzku, protože musím pracovat.',
        trap: 'Ich verschiebe die Verabredung, weil ich muss arbeiten.',
        note: 'Ve vedlejší větě s „weil“ stojí časované modální sloveso na konci.',
      },
      {
        de: 'Leider kann ich für Samstag nicht zusagen.',
        cs: 'Bohužel nemohu potvrdit účast na sobotu.',
        trap: 'Leider ich kann für Samstag nicht zusagen.',
        note: '„Leider“ je první pozice, proto za ním následuje „kann“.',
      },
      {
        de: 'Ich glaube, dass die neue Verabredung besser ist.',
        cs: 'Myslím, že je nový termín lepší.',
        trap: 'Ich glaube, dass ist die neue Verabredung besser.',
        note: 'Po „dass“ jde sloveso „ist“ až na konec vedlejší věty.',
      },
    ],
    sentencePrompt: 'Napiš, zda můžeš přijít, a jednou větou vysvětli proč.',
    sentenceStarter: 'Ich kann leider nicht kommen, weil ...',
    sentenceChecklist: [
      'věta obsahuje jasné potvrzení nebo odmítnutí',
      'po „weil“ nebo „dass“ je sloveso na konci',
      'uvedla jsi konkrétní důvod nebo nový termín',
    ],
    words: [
      noun(
        'Verabredung',
        'domluvená schůzka',
        'die',
        'Verabredungen',
        'A2',
        'Ich habe heute eine Verabredung.',
        'Dnes mám domluvenou schůzku.',
      ),
      verb(
        'verschieben',
        'přesunout',
        'A2',
        'Können wir den Termin verschieben?',
        'Můžeme termín přesunout?',
        {
          thirdPerson: 'verschiebt',
          preterite: 'verschob',
          participle: 'verschoben',
          auxiliary: 'haben',
        },
      ),
      other(
        'deshalb',
        'proto',
        'other',
        'A2',
        'Ich bin krank, deshalb bleibe ich zu Hause.',
        'Jsem nemocná, proto zůstanu doma.',
      ),
      verb(
        'zusagen',
        'potvrdit účast',
        'A2',
        'Ich kann für Samstag zusagen.',
        'Mohu potvrdit účast na sobotu.',
        {
          thirdPerson: 'sagt zu',
          preterite: 'sagte zu',
          participle: 'zugesagt',
          auxiliary: 'haben',
        },
      ),
      other(
        'leider',
        'bohužel',
        'other',
        'A1',
        'Leider habe ich keine Zeit.',
        'Bohužel nemám čas.',
      ),
    ],
  },
  {
    id: 'chapter-05-home-work',
    number: 5,
    level: 'B1.1',
    title: 'Práce a bydlení',
    subtitle: 'Popiš problém přesněji a doplň informace pomocí vztažné věty.',
    themeTag: 'bydleni-prace',
    grammarLessonId: 'relative-clauses',
    coachScenarioId: 'apartment-repair',
    storyBookId: 'b1-heidi',
    grammarIdea: 'vztažné věty',
    mission: 'Popíšeš problém s bydlením a doplníš přesný detail o člověku, věci nebo řešení.',
    outcomes: [
      'nahlásit poruchu a navrhnout další krok',
      'připojit vztažnou větu ke konkrétnímu podstatnému jménu',
      'popsat spolehlivé řešení i relevantní zkušenost',
    ],
    grammarPattern: 'Die Heizung, die nicht funktioniert, wird repariert.',
    modelSentences: [
      {
        de: 'Der Vermieter, der die Wohnung verwaltet, ruft morgen zurück.',
        cs: 'Pronajímatel, který spravuje byt, zítra zavolá zpět.',
        trap: 'Der Vermieter, die die Wohnung verwaltet, ruft morgen zurück.',
        note: 'Zájmeno „der“ přebírá mužský rod od slova „Vermieter“.',
      },
      {
        de: 'Die Heizung, die seit gestern nicht funktioniert, wird repariert.',
        cs: 'Topení, které od včerejška nefunguje, bude opraveno.',
        trap: 'Die Heizung, der seit gestern nicht funktioniert, wird repariert.',
        note: 'Ke slovu „die Heizung“ patří ve vztažné větě zájmeno „die“.',
      },
      {
        de: 'Meine Bewerbung passt zu einer Stelle, für die meine Erfahrung nützlich ist.',
        cs: 'Moje žádost odpovídá pozici, pro kterou je moje zkušenost užitečná.',
        trap: 'Meine Bewerbung passt zu einer Stelle, für der meine Erfahrung nützlich ist.',
        note: 'Předložka „für“ vyžaduje akuzativ, proto zde použijeme „die“.',
      },
    ],
    sentencePrompt: 'Popiš člověka, věc nebo problém a doplň o něm jeden přesný detail.',
    sentenceStarter: 'Ich brauche eine Lösung, die ...',
    sentenceChecklist: [
      'vztažná věta stojí hned za popisovaným slovem',
      'vztažné zájmeno má správný rod a pád',
      'věta obsahuje konkrétní problém nebo vlastnost',
    ],
    words: [
      noun(
        'Vermieter',
        'pronajímatel',
        'der',
        'Vermieter',
        'B1',
        'Der Vermieter ruft morgen zurück.',
        'Pronajímatel zítra zavolá zpět.',
      ),
      noun(
        'Heizung',
        'topení',
        'die',
        'Heizungen',
        'B1',
        'Die Heizung funktioniert nicht.',
        'Topení nefunguje.',
      ),
      verb(
        'reparieren',
        'opravit',
        'B1',
        'Ein Techniker repariert die Heizung.',
        'Technik opravuje topení.',
        {
          thirdPerson: 'repariert',
          preterite: 'reparierte',
          participle: 'repariert',
          auxiliary: 'haben',
        },
      ),
      other(
        'zuverlässig',
        'spolehlivý',
        'adjective',
        'B1',
        'Wir brauchen eine zuverlässige Lösung.',
        'Potřebujeme spolehlivé řešení.',
      ),
      noun(
        'Bewerbung',
        'žádost o práci',
        'die',
        'Bewerbungen',
        'B1',
        'Meine Bewerbung ist fast fertig.',
        'Moje žádost o práci je skoro hotová.',
      ),
    ],
  },
  {
    id: 'chapter-06-process',
    number: 6,
    level: 'B1.2',
    title: 'Proces a výsledek',
    subtitle: 'Vysvětli, co se děje, kdo za co odpovídá a jaký je další krok.',
    themeTag: 'proces',
    grammarLessonId: 'process-passive',
    coachScenarioId: 'job-interview',
    storyBookId: 'b1-kleider',
    grammarIdea: 'procesní pasivum',
    mission:
      'Na pohovoru popíšeš svou práci a vysvětlíš proces, ve kterém je důležitější děj než vykonavatel.',
    outcomes: [
      'popsat úkol, odpovědnost a výsledek práce',
      'postavit dějové pasivum pomocí „werden + Partizip II“',
      'uvést konkrétní zkušenost místo obecných frází',
    ],
    grammarPattern: 'Die Aufgabe + wird + heute + verteilt.',
    modelSentences: [
      {
        de: 'Die Aufgabe wird heute im Team verteilt.',
        cs: 'Úkol bude dnes rozdělen mezi členy týmu.',
        trap: 'Die Aufgabe ist heute im Team verteilt werden.',
        note: 'Dějové pasivum tvoří časované „wird“ a příčestí „verteilt“ na konci.',
      },
      {
        de: 'Das Ergebnis wird morgen vorgestellt.',
        cs: 'Výsledek bude zítra představen.',
        trap: 'Das Ergebnis wird morgen vorstellen.',
        note: 'Po „wird“ potřebujeme příčestí „vorgestellt“, ne infinitiv.',
      },
      {
        de: 'Die Verantwortung wird von einer erfahrenen Kollegin übernommen.',
        cs: 'Odpovědnost převezme zkušená kolegyně.',
        trap: 'Die Verantwortung wird von einer erfahrenen Kollegin übernehmen.',
        note: 'V pasivu uzavírá větu příčestí „übernommen“.',
      },
    ],
    sentencePrompt: 'Popiš jeden pracovní úkol: co se udělá, kdy a s jakým výsledkem.',
    sentenceStarter: 'Die Aufgabe wird ...',
    sentenceChecklist: [
      'věta obsahuje časovaný tvar „werden“',
      'příčestí stojí na konci',
      'uvedla jsi konkrétní úkol, čas nebo výsledek',
    ],
    words: [
      noun(
        'Aufgabe',
        'úkol',
        'die',
        'Aufgaben',
        'B1',
        'Die Aufgabe wird heute verteilt.',
        'Úkol bude dnes rozdělen.',
      ),
      noun(
        'Erfahrung',
        'zkušenost',
        'die',
        'Erfahrungen',
        'B1',
        'Ich habe Erfahrung mit Kunden.',
        'Mám zkušenost se zákazníky.',
      ),
      verb(
        'übernehmen',
        'převzít',
        'B1',
        'Ich übernehme die Verantwortung.',
        'Přebírám odpovědnost.',
        {
          thirdPerson: 'übernimmt',
          preterite: 'übernahm',
          participle: 'übernommen',
          auxiliary: 'haben',
        },
      ),
      noun(
        'Ergebnis',
        'výsledek',
        'das',
        'Ergebnisse',
        'B1',
        'Das Ergebnis wird morgen vorgestellt.',
        'Výsledek bude představen zítra.',
      ),
      other(
        'selbstständig',
        'samostatně',
        'adjective',
        'B1',
        'Sie arbeitet sehr selbstständig.',
        'Pracuje velmi samostatně.',
      ),
    ],
  },
  {
    id: 'chapter-07-project',
    number: 7,
    level: 'B2.1',
    title: 'Projekt a rozhodnutí',
    subtitle: 'Porovnej varianty, formuluj důsledky a obhaj rozhodnutí v týmu.',
    themeTag: 'projekt',
    grammarLessonId: 'complex-connectors',
    coachScenarioId: 'project-meeting',
    storyBookId: 'b2-schimmelreiter',
    grammarIdea: 'složité spojky a důsledky',
    mission: 'Porovnáš varianty, pojmenuješ jejich důsledky a obhájíš rozhodnutí před týmem.',
    outcomes: [
      'rozlišit návrh, dopad a konečné rozhodnutí',
      'vyjádřit ústupek, návaznost a důsledek přesnou spojkou',
      'reagovat na námitku v projektové diskusi',
    ],
    grammarPattern: 'Obwohl die Zeit knapp ist, prüfen wir den Vorschlag.',
    modelSentences: [
      {
        de: 'Obwohl die Zeit knapp ist, prüfen wir den Vorschlag.',
        cs: 'Ačkoli je málo času, návrh prověříme.',
        trap: 'Obwohl die Zeit ist knapp, prüfen wir den Vorschlag.',
        note: 'Po „obwohl“ stojí časované sloveso „ist“ na konci vedlejší věty.',
      },
      {
        de: 'Wir wägen die Auswirkungen ab, bevor wir eine Entscheidung treffen.',
        cs: 'Než se rozhodneme, zvážíme dopady.',
        trap: 'Wir wägen die Auswirkungen ab, bevor treffen wir eine Entscheidung.',
        note: '„Bevor“ otevírá vedlejší větu, takže „treffen“ jde na konec.',
      },
      {
        de: 'Der Vorschlag ist so klar, dass das Team zustimmt.',
        cs: 'Návrh je tak jasný, že s ním tým souhlasí.',
        trap: 'Der Vorschlag ist so klar, dass stimmt das Team zu.',
        note: 'Ve vedlejší větě s „dass“ uzavírá sloveso celý úsek.',
      },
    ],
    sentencePrompt: 'Porovnej dvě varianty a napiš, proč jednu doporučuješ nebo odmítáš.',
    sentenceStarter: 'Obwohl ..., schlage ich vor, dass ...',
    sentenceChecklist: [
      'spojka odpovídá vztahu mezi myšlenkami',
      'sloveso ve vedlejší větě stojí na konci',
      'věta obsahuje konkrétní dopad nebo rozhodnutí',
    ],
    words: [
      noun(
        'Vorschlag',
        'návrh',
        'der',
        'Vorschläge',
        'B2',
        'Der Vorschlag hat zwei Vorteile.',
        'Návrh má dvě výhody.',
      ),
      noun(
        'Auswirkung',
        'dopad',
        'die',
        'Auswirkungen',
        'B2',
        'Wir prüfen die Auswirkungen auf das Team.',
        'Prověřujeme dopady na tým.',
      ),
      verb(
        'abwägen',
        'zvážit',
        'B2',
        'Wir müssen Kosten und Nutzen abwägen.',
        'Musíme zvážit náklady a přínosy.',
        {
          thirdPerson: 'wägt ab',
          preterite: 'wog ab',
          participle: 'abgewogen',
          auxiliary: 'haben',
        },
      ),
      other(
        'obwohl',
        'ačkoli',
        'other',
        'B1',
        'Obwohl die Zeit knapp ist, testen wir weiter.',
        'Ačkoli je málo času, testujeme dál.',
      ),
      noun(
        'Entscheidung',
        'rozhodnutí',
        'die',
        'Entscheidungen',
        'B1',
        'Die Entscheidung fällt am Freitag.',
        'Rozhodnutí padne v pátek.',
      ),
    ],
  },
  {
    id: 'chapter-08-negotiation',
    number: 8,
    level: 'B2.2',
    title: 'Vyjednávání',
    subtitle: 'Vymez podmínky, navrhni kompromis a reaguj na námitku bez ztráty přesnosti.',
    themeTag: 'vyjednavani',
    grammarLessonId: 'passive-variants',
    coachScenarioId: 'deadline-negotiation',
    storyBookId: 'b2-sandmann',
    grammarIdea: 'varianty pasiva',
    mission: 'Vymezíš podmínky, navrhneš proveditelný kompromis a odpovíš na námitku.',
    outcomes: [
      'formulovat termín, podmínku a kompromis',
      'rozlišit děj, hotový stav a možnost bez těžkopádného pasiva',
      'udržet vyjednávání věcné i při nesouhlasu',
    ],
    grammarPattern: 'Die Frist kann verlängert werden. · Die Frist ist verlängert.',
    modelSentences: [
      {
        de: 'Die Frist kann verlängert werden, wenn beide Seiten zustimmen.',
        cs: 'Lhůtu lze prodloužit, pokud obě strany souhlasí.',
        trap: 'Die Frist kann verlängert, wenn beide Seiten zustimmen.',
        note: 'Pasivum s modálním slovesem potřebuje na konci celek „verlängert werden“.',
      },
      {
        de: 'Ein tragfähiger Kompromiss ist noch nicht gefunden.',
        cs: 'Proveditelný kompromis se zatím nenašel.',
        trap: 'Ein tragfähiger Kompromiss wird noch nicht gefunden sein.',
        note: '„Ist gefunden“ popisuje aktuální stav, ne probíhající hledání.',
      },
      {
        de: 'Der Einwand lässt sich unter dieser Voraussetzung klären.',
        cs: 'Za této podmínky lze námitku vyjasnit.',
        trap: 'Der Einwand lässt unter dieser Voraussetzung sich klären.',
        note: 'Konstrukce „lässt sich + infinitiv“ vyjadřuje možnost přirozeněji než další pasivum.',
      },
    ],
    sentencePrompt: 'Navrhni kompromis a jasně napiš, za jaké podmínky může platit.',
    sentenceStarter: 'Die Frist kann ..., wenn ...',
    sentenceChecklist: [
      'podmínka je formulovaná konkrétně',
      'zvolená pasivní varianta odpovídá ději, stavu nebo možnosti',
      'věta obsahuje termín, kompromis nebo námitku',
    ],
    words: [
      noun(
        'Frist',
        'lhůta, termín',
        'die',
        'Fristen',
        'B2',
        'Die Frist kann verlängert werden.',
        'Lhůtu lze prodloužit.',
      ),
      noun(
        'Kompromiss',
        'kompromis',
        'der',
        'Kompromisse',
        'B2',
        'Wir suchen einen tragfähigen Kompromiss.',
        'Hledáme životaschopný kompromis.',
      ),
      verb(
        'einräumen',
        'připustit, poskytnout',
        'B2',
        'Ich räume ein, dass der Plan riskant ist.',
        'Připouštím, že plán je riskantní.',
        {
          thirdPerson: 'räumt ein',
          preterite: 'räumte ein',
          participle: 'eingeräumt',
          auxiliary: 'haben',
        },
      ),
      other(
        'unter der Voraussetzung',
        'za předpokladu',
        'phrase',
        'B2',
        'Wir stimmen unter der Voraussetzung zu, dass die Frist gilt.',
        'Souhlasíme za předpokladu, že lhůta platí.',
      ),
      noun(
        'Einwand',
        'námitka',
        'der',
        'Einwände',
        'B2',
        'Ihr Einwand ist nachvollziehbar.',
        'Vaše námitka je pochopitelná.',
      ),
    ],
  },
  {
    id: 'chapter-09-argument',
    number: 9,
    level: 'C1.1',
    title: 'Argumentace',
    subtitle: 'Odděl tvrzení od zdroje, pracuj s mírou jistoty a obhaj stanovisko.',
    themeTag: 'argumentace',
    grammarLessonId: 'indirect-speech',
    coachScenarioId: 'defend-position',
    storyBookId: 'c1-verwandlung',
    grammarIdea: 'nepřímá řeč a odstup od tvrzení',
    mission:
      'Oddělíš cizí tvrzení od vlastního postoje a obhájíš stanovisko s přiměřenou jistotou.',
    outcomes: [
      'pojmenovat tvrzení, důkaz a vlastní stanovisko',
      'reprodukovat cizí výrok pomocí Konjunktivu I',
      'reagovat na námitku bez vydávání domněnky za fakt',
    ],
    grammarPattern: 'Die Expertin sagt, die Behauptung sei nicht belegt.',
    modelSentences: [
      {
        de: 'Die Expertin sagt, die Behauptung sei nicht belegt.',
        cs: 'Expertka říká, že tvrzení není doloženo.',
        trap: 'Die Expertin sagt, die Behauptung ist nicht belegt.',
        note: 'Tvar „sei“ označuje reprodukované tvrzení a drží od něj odstup.',
      },
      {
        de: 'Er erklärt, die Daten hätten seine Annahme widerlegt.',
        cs: 'Vysvětluje, že data vyvrátila jeho domněnku.',
        trap: 'Er erklärt, die Daten haben seine Annahme widerlegt.',
        note: '„Hätten widerlegt“ převádí minulý cizí výrok do nepřímé řeči.',
      },
      {
        de: 'Demnach müsse der Standpunkt neu eingeordnet werden.',
        cs: 'Podle toho je prý nutné stanovisko znovu zasadit do kontextu.',
        trap: 'Demnach muss der Standpunkt neu eingeordnet werden.',
        note: '„Müsse“ ukazuje, že jde o převzatý závěr, ne o vlastní jisté tvrzení.',
      },
    ],
    sentencePrompt:
      'Shrň cizí stanovisko a jedním jazykovým signálem ukaž, že ho pouze reprodukuješ.',
    sentenceStarter: 'Die Autorin erklärt, ...',
    sentenceChecklist: [
      'je jasné, kdo původní tvrzení vyslovil',
      'Konjunktiv I odděluje cizí výrok od tvého postoje',
      'věta obsahuje tvrzení, důkaz nebo zasazení do kontextu',
    ],
    words: [
      noun(
        'Behauptung',
        'tvrzení',
        'die',
        'Behauptungen',
        'C1',
        'Die Behauptung wird nicht belegt.',
        'Tvrzení není doloženo.',
      ),
      noun(
        'Standpunkt',
        'stanovisko',
        'der',
        'Standpunkte',
        'C1',
        'Sie begründet ihren Standpunkt präzise.',
        'Své stanovisko zdůvodňuje přesně.',
      ),
      verb(
        'widerlegen',
        'vyvrátit',
        'C1',
        'Die Daten widerlegen diese Annahme.',
        'Data tuto domněnku vyvracejí.',
        {
          thirdPerson: 'widerlegt',
          preterite: 'widerlegte',
          participle: 'widerlegt',
          auxiliary: 'haben',
        },
      ),
      other(
        'demnach',
        'podle toho, tudíž',
        'other',
        'C1',
        'Demnach wäre die Maßnahme unwirksam.',
        'Podle toho by opatření bylo neúčinné.',
      ),
      noun(
        'Einordnung',
        'zasazení do kontextu',
        'die',
        'Einordnungen',
        'C1',
        'Die Aussage braucht eine sachliche Einordnung.',
        'Výrok potřebuje věcné zasazení do kontextu.',
      ),
    ],
  },
  {
    id: 'chapter-10-style',
    number: 10,
    level: 'C1.2',
    title: 'Přesný styl',
    subtitle: 'Přepínej mezi slovesným a jmenným stylem a rediguj text bez vaty.',
    themeTag: 'styl',
    grammarLessonId: 'nominal-and-verbal-style',
    coachScenarioId: 'media-interview',
    storyBookId: 'c1-urteil',
    grammarIdea: 'jmenný a slovesný styl',
    mission:
      'Přepracuješ těžkopádný text tak, aby byl přesný, čitelný a vhodný pro konkrétní situaci.',
    outcomes: [
      'rozpoznat zbytečně abstraktní formulaci',
      'vědomě přepnout mezi jmenným a slovesným stylem',
      'obhájit redakční volbu v náročném rozhovoru',
    ],
    grammarPattern: 'Wir präzisieren die Aussage. ↔ Die Präzisierung der Aussage erfolgt.',
    modelSentences: [
      {
        de: 'Die Redaktion präzisiert die Formulierung.',
        cs: 'Redakce formulaci upřesňuje.',
        trap: 'Die Redaktion macht eine Präzisierung von der Formulierung.',
        note: 'Přímé sloveso „präzisiert“ je kratší a přesnější než prázdná opisná konstrukce.',
      },
      {
        de: 'Hinsichtlich der Kosten sind die Voraussetzungen noch nicht erfüllt.',
        cs: 'S ohledem na náklady zatím nejsou podmínky splněny.',
        trap: 'Hinsichtlich die Kosten sind die Voraussetzungen noch nicht erfüllt.',
        note: 'Předložka „hinsichtlich“ se ve formálním textu pojí s genitivem „der Kosten“.',
      },
      {
        de: 'Wir überarbeiten den Absatz, um die Aussage klarer zu formulieren.',
        cs: 'Odstavec přepracujeme, abychom výrok formulovali jasněji.',
        trap: 'Wir überarbeiten den Absatz, um formulieren die Aussage klarer.',
        note: 'V konstrukci „um … zu“ stojí infinitiv s „zu“ na konci.',
      },
    ],
    sentencePrompt:
      'Přepiš jednu abstraktní myšlenku do přímé věty s jasným vykonavatelem a slovesem.',
    sentenceStarter: 'Wir überarbeiten ..., damit ...',
    sentenceChecklist: [
      'věta má jasného vykonavatele nebo záměrně zvolený jmenný styl',
      'každé abstraktní slovo nese konkrétní význam',
      'formulace je kratší, aniž ztratila důležitou informaci',
    ],
    words: [
      noun(
        'Formulierung',
        'formulace',
        'die',
        'Formulierungen',
        'C1',
        'Diese Formulierung ist unnötig abstrakt.',
        'Tato formulace je zbytečně abstraktní.',
      ),
      verb(
        'präzisieren',
        'upřesnit',
        'C1',
        'Könnten Sie die Aussage präzisieren?',
        'Mohla byste výrok upřesnit?',
        {
          thirdPerson: 'präzisiert',
          preterite: 'präzisierte',
          participle: 'präzisiert',
          auxiliary: 'haben',
        },
      ),
      noun(
        'Voraussetzung',
        'předpoklad, podmínka',
        'die',
        'Voraussetzungen',
        'C1',
        'Die Voraussetzung ist noch nicht erfüllt.',
        'Podmínka zatím není splněna.',
      ),
      other(
        'hinsichtlich',
        'ohledně, s ohledem na',
        'other',
        'C1',
        'Hinsichtlich der Kosten bleiben Fragen offen.',
        'Ohledně nákladů zůstávají otázky otevřené.',
      ),
      verb(
        'überarbeiten',
        'přepracovat',
        'C1',
        'Ich überarbeite den Absatz noch einmal.',
        'Odstavec ještě jednou přepracuji.',
        {
          thirdPerson: 'überarbeitet',
          preterite: 'überarbeitete',
          participle: 'überarbeitet',
          auxiliary: 'haben',
        },
      ),
    ],
  },
];

function contentSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('de-DE')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

const lexicalCorrections: Record<string, Partial<CourseWord>> = {
  Schule: {
    collocations: ['zur Schule gehen', 'in der Schule lernen'],
  },
  Stunde: {
    collocations: ['die erste Stunde', 'eine Stunde dauern'],
  },
  Heft: {
    collocations: ['ins Heft schreiben', 'das Heft aufschlagen'],
  },
  Mitschüler: {
    collocations: ['mit einem Mitschüler sprechen', 'ein neuer Mitschüler'],
  },
  lernen: {
    collocations: ['Deutsch lernen', 'für einen Test lernen'],
  },
  morgens: {
    collocations: ['morgens früh aufstehen', 'morgens zur Schule gehen'],
  },
  aufstehen: {
    collocations: ['früh aufstehen', 'um sieben Uhr aufstehen'],
  },
  Frühstück: {
    collocations: ['Frühstück machen', 'zum Frühstück'],
  },
  brauchen: {
    collocations: ['zehn Minuten brauchen', 'Hilfe brauchen'],
  },
  Fahrkarte: {
    collocations: ['eine Fahrkarte kaufen', 'eine Fahrkarte nach Berlin'],
  },
  umsteigen: {
    collocations: ['in Leipzig umsteigen', 'einmal umsteigen'],
  },
  Abfahrt: {
    collocations: ['Abfahrt um 9:20 Uhr', 'vor der Abfahrt'],
  },
  'hin und zurück': {
    collocations: ['eine Fahrkarte hin und zurück', 'hin und zurück fahren'],
  },
  Verabredung: {
    collocations: ['eine Verabredung haben', 'eine Verabredung absagen'],
  },
  verschieben: {
    collocations: ['einen Termin verschieben', 'auf morgen verschieben'],
  },
  deshalb: {
    collocations: ['deshalb später kommen', 'und deshalb'],
  },
  zusagen: {
    collocations: ['einem Termin zusagen', 'verbindlich zusagen'],
  },
  leider: {
    role: 'review',
    usageNote: 'Běžný A1 výraz se zde znovu používá při změně plánů.',
    collocations: ['leider nicht', 'leider absagen'],
  },
  'aus diesem Grund': {
    collocations: ['aus diesem Grund ablehnen', 'aus diesem Grund verschieben'],
  },
  Vermieter: {
    collocations: ['den Vermieter anrufen', 'mit dem Vermieter sprechen'],
  },
  Heizung: {
    collocations: ['die Heizung ist kaputt', 'die Heizung reparieren'],
  },
  reparieren: {
    collocations: ['die Heizung reparieren', 'fachgerecht reparieren'],
  },
  zuverlässig: {
    collocations: ['zuverlässig arbeiten', 'eine zuverlässige Lösung'],
  },
  Bewerbung: {
    collocations: ['eine Bewerbung schreiben', 'eine Bewerbung einreichen'],
  },
  Aufgabe: {
    collocations: ['eine Aufgabe übernehmen', 'eine Aufgabe erledigen'],
  },
  Erfahrung: {
    collocations: ['Erfahrung sammeln', 'Berufserfahrung haben'],
  },
  übernehmen: {
    collocations: ['Verantwortung übernehmen', 'eine Aufgabe übernehmen'],
  },
  Ergebnis: {
    collocations: ['ein Ergebnis präsentieren', 'zu einem Ergebnis kommen'],
  },
  selbstständig: {
    collocations: ['selbstständig arbeiten', 'eine Aufgabe selbstständig lösen'],
  },
  Vorschlag: {
    collocations: ['einen Vorschlag machen', 'einen Vorschlag prüfen'],
  },
  Auswirkung: {
    collocations: ['Auswirkungen auf etwas haben', 'mögliche Auswirkungen'],
  },
  abwägen: {
    collocations: ['Kosten und Nutzen abwägen', 'Vor- und Nachteile abwägen'],
  },
  obwohl: {
    role: 'review',
    usageNote: 'B1 spojka se zde opakuje v argumentaci B2.',
    collocations: ['obwohl es regnet', 'obwohl die Frist knapp ist'],
  },
  'aus meiner Sicht': {
    collocations: ['aus meiner Sicht sinnvoll', 'aus meiner Sicht überwiegt'],
  },
  Kompromiss: {
    collocations: ['einen Kompromiss finden', 'einen Kompromiss aushandeln'],
  },
  'unter der Voraussetzung': {
    collocations: ['unter der Voraussetzung, dass', 'nur unter der Voraussetzung'],
  },
  Einwand: {
    collocations: ['einen Einwand äußern', 'auf einen Einwand eingehen'],
  },
  'im Vergleich zu': {
    collocations: ['im Vergleich zum Vorjahr', 'im Vergleich zu anderen'],
  },
  'insofern als': {
    collocations: ['insofern relevant, als', 'insofern zutreffend, als'],
  },
  Behauptung: {
    collocations: ['eine Behauptung aufstellen', 'eine Behauptung belegen'],
  },
  Standpunkt: {
    collocations: ['einen Standpunkt vertreten', 'einen Standpunkt begründen'],
  },
  widerlegen: {
    collocations: ['eine Behauptung widerlegen', 'durch Daten widerlegen'],
  },
  Formulierung: {
    collocations: ['eine präzise Formulierung', 'eine Formulierung überarbeiten'],
  },
  präzisieren: {
    collocations: ['eine Aussage präzisieren', 'sprachlich präzisieren'],
  },
  überarbeiten: {
    collocations: ['einen Absatz überarbeiten', 'gründlich überarbeiten'],
  },
  pünktlich: {
    czech: 'včas',
    acceptedCzech: ['dochvilně'],
    role: 'stretch',
    usageNote: 'V této A1.2 kapitole jde o výhledový výraz úrovně A2.',
    collocations: ['pünktlich ankommen', 'pünktlich beginnen'],
  },
  Gleis: {
    czech: 'nástupištní kolej',
    acceptedCzech: ['kolej', 'nástupiště'],
    senseId: 'railway-track-platform-context',
    usageNote:
      'V nádražním hlášení označuje kolej označenou číslem; české „nástupiště“ je přijatelné pouze v tomto situačním překladu.',
    collocations: ['von Gleis drei abfahren', 'an Gleis zwei ankommen'],
  },
  Entscheidung: {
    role: 'review',
    collocations: ['eine Entscheidung treffen', 'zu einer Entscheidung kommen'],
    usageNote: 'B1 lexém se zde opakuje v projektovém kontextu B2.',
  },
  Frist: {
    czech: 'lhůta',
    acceptedCzech: ['termín'],
    senseId: 'deadline-period',
    collocations: ['eine Frist setzen', 'eine Frist verlängern'],
    usageNote: 'Primárně časový úsek určený ke splnění povinnosti.',
  },
  einräumen: {
    czech: 'připustit',
    acceptedCzech: ['uznat'],
    senseId: 'concede-admit',
    collocations: ['einen Fehler einräumen', 'einräumen, dass'],
    usageNote:
      'Zde pouze ve významu „připustit/uznat“. Význam „poskytnout prostor či lhůtu“ je jiný sense.',
  },
  demnach: {
    czech: 'tudíž',
    acceptedCzech: ['z toho vyplývá'],
    senseId: 'inferential-therefore',
    collocations: ['demnach wäre', 'demnach gilt'],
    usageNote: 'Formální závěrový konektor odkazující na předchozí argument.',
  },
  Einordnung: {
    czech: 'zasazení do souvislostí',
    acceptedCzech: ['kontextualizace'],
    senseId: 'contextual-assessment',
    collocations: ['eine sachliche Einordnung', 'historische Einordnung'],
    usageNote: 'Zde jde o interpretační zasazení výroku, nikoli o administrativní zařazení.',
  },
  Voraussetzung: {
    czech: 'předpoklad',
    acceptedCzech: ['podmínka'],
    senseId: 'necessary-precondition',
    collocations: ['eine Voraussetzung erfüllen', 'unter der Voraussetzung'],
    usageNote: 'Nutná podmínka, která musí být splněna před dalším krokem.',
  },
  hinsichtlich: {
    czech: 's ohledem na',
    acceptedCzech: ['ohledně'],
    senseId: 'with-regard-to',
    collocations: ['hinsichtlich der Kosten', 'hinsichtlich des Verfahrens'],
    usageNote: 'Formální předložka, zpravidla s genitivem.',
  },
};

function canonicalizeWord(word: CourseWord): CourseLexeme {
  const corrected = { ...word, ...lexicalCorrections[word.german] };
  const lemma = corrected.german.trim();
  const senseId = corrected.senseId ?? `${contentSlug(lemma)}:default`;
  return {
    ...corrected,
    id: `lexeme:${contentSlug(lemma)}:${contentSlug(senseId)}`,
    lemma,
    displayGerman: corrected.article ? `${corrected.article} ${lemma}` : lemma,
    primaryCzech: corrected.czech.trim(),
    acceptedGerman: [...new Set(corrected.acceptedGerman ?? [])],
    acceptedCzech: [...new Set(corrected.acceptedCzech ?? [])],
    senseId,
    role: corrected.role ?? 'target',
    contexts: corrected.contexts?.length ? corrected.contexts : [corrected.exampleDe ?? lemma],
    collocations: corrected.collocations?.length
      ? corrected.collocations
      : [corrected.article ? `${corrected.article} ${lemma}` : lemma],
    usageNote: corrected.usageNote ?? corrected.learningNote,
  };
}

function addContentSupplement(definition: CourseChapterDefinition): CourseChapterDefinition {
  const supplement = courseChapterContentSupplements[definition.id];
  if (!supplement) return definition;
  return {
    ...definition,
    words: [...definition.words, ...supplement.words],
    grammarLessonIds: [
      ...new Set([
        ...(definition.grammarLessonIds ?? [definition.grammarLessonId]),
        ...supplement.grammarLessonIds,
      ]),
    ],
    coachScenarioIds: [
      ...new Set([
        ...(definition.coachScenarioIds ?? [definition.coachScenarioId]),
        ...supplement.coachScenarioIds,
      ]),
    ],
  };
}

const versionTwoDefinitions = [...chapterDefinitions, ...additionalCourseChapterDefinitions]
  .map(addContentSupplement)
  .map(applyCourseCoherenceOverride);
const versionThreeDefinitions = [
  ...versionTwoDefinitions,
  ...createExpandedCourseChapterDefinitions(versionTwoDefinitions),
];
const definitionById = new Map(
  [
    ...versionThreeDefinitions,
    ...createDiversityCourseChapterDefinitions(versionThreeDefinitions),
  ].map((definition) => [definition.id, definition]),
);
const legacyIds = new Set<string>(LEGACY_COURSE_CHAPTER_IDS);

export const coursePathChapters: CoursePathChapter[] = CORE_COURSE_CHAPTER_IDS.map(
  (chapterId, index) => {
    const source = definitionById.get(chapterId);
    if (!source) throw new Error(`Chybí definice core kapitoly ${chapterId}.`);
    const definition: CourseChapterDefinition = {
      ...source,
      number: index + 1,
      words: [...source.words, ...(courseFoundations[chapterId] ?? [])],
    };
    const nodes = chapterNodes(definition);
    const words = definition.words.map(canonicalizeWord);
    const legacyAnchor = legacyIds.has(definition.id);
    return {
      ...definition,
      words,
      nodes,
      contentVersion: definition.contentVersion ?? (legacyAnchor ? 1 : COURSE_CONTENT_VERSION),
      situation: definition.situation ?? definition.subtitle,
      prerequisites:
        definition.prerequisites ?? (index === 0 ? [] : [CORE_COURSE_CHAPTER_IDS[index - 1]]),
      targetLexemeIds: words
        .filter((word) => word.role === 'target' || word.role === 'stretch')
        .map((word) => word.id),
      reviewLexemeIds: definition.reviewLexemeIds ?? [],
      grammarLessonIds: definition.grammarLessonIds ?? [definition.grammarLessonId],
      coachScenarioIds: definition.coachScenarioIds ?? [definition.coachScenarioId],
      readingIds: definition.readingIds ?? [definition.storyBookId],
      nodeIds: nodes.map((node) => node.id),
      estimatedMinutes:
        definition.estimatedMinutes ??
        nodes.filter((node) => node.required).reduce((sum, node) => sum + node.minutes, 0),
      legacyAnchor,
      legacyNumber: legacyAnchor ? source.number : undefined,
      dialogue:
        definition.dialogue ??
        definition.modelSentences.slice(0, 2).map((sentence, turnIndex) => ({
          speaker: turnIndex === 0 ? 'A' : 'B',
          de: sentence.de,
          cs: sentence.cs,
        })),
      assessment:
        definition.assessment ??
        ({
          id: `${definition.id}:assessment`,
          instruction: definition.sentencePrompt,
          criteria: definition.sentenceChecklist,
          deterministic: true,
        } as const),
    };
  },
);

const chaptersById = new Map(coursePathChapters.map((chapter) => [chapter.id, chapter]));
const nodesById = new Map(
  coursePathChapters.flatMap((chapter) => chapter.nodes.map((node) => [node.id, node] as const)),
);
const chaptersByStoryBookId = new Map(
  coursePathChapters.map((chapter) => [chapter.storyBookId, chapter]),
);

export function coursePathChapterById(id: string): CoursePathChapter | undefined {
  return chaptersById.get(id);
}

export function coursePathNodeById(id: string): CoursePathNode | undefined {
  return nodesById.get(id);
}

export function chapterForPathNode(nodeId: string): CoursePathChapter | undefined {
  const node = coursePathNodeById(nodeId);
  return node ? coursePathChapterById(node.chapterId) : undefined;
}

export function visibleCoursePathChapters(minimumLevel: DetailedCefrLevel): CoursePathChapter[] {
  const minimumRank = detailedCefrRank(minimumLevel);
  return coursePathChapters.filter((chapter) => detailedCefrRank(chapter.level) >= minimumRank);
}

export function courseSystemTags(chapter: CoursePathChapter): string[] {
  const stableNumber = chapter.legacyNumber ?? chapter.number;
  return [
    'kurz',
    `kurz:${chapter.themeTag}`,
    `kurz:kapitola-${String(stableNumber).padStart(2, '0')}`,
  ];
}

export function chapterForStoryBook(bookId: StoryBookId): CoursePathChapter | undefined {
  const chapterBookId = primaryStoryBookId(bookId);
  return chaptersByStoryBookId.get(chapterBookId);
}

export { storyBookIsUnlocked, storyBookUnlockReason } from './story-unlocks.ts';

function nodeCompleted(progress: CourseProgress, node: CoursePathNode): boolean {
  if (node.required && progress.grandfatheredChapterIds.includes(node.chapterId)) return true;
  if (node.type === 'reading' && node.storyBookId) {
    return (progress.storyBooks[node.storyBookId]?.completedEpisodeIds.length ?? 0) > 0;
  }
  return Boolean(progress.pathNodes[node.id]?.completedAt);
}

export function checkpointForChapter(chapter: CoursePathChapter): CoursePathNode {
  const checkpoint = chapter.nodes.find((node) => node.type === 'checkpoint');
  if (!checkpoint) throw new Error(`Kapitola ${chapter.id} nemá checkpoint.`);
  return checkpoint;
}

export function chapterRequiredNodes(chapter: CoursePathChapter): CoursePathNode[] {
  return chapter.nodes.filter((node) => node.required);
}

export function coursePathChapterCompleted(
  progress: CourseProgress,
  chapter: CoursePathChapter,
): boolean {
  return nodeCompleted(progress, checkpointForChapter(chapter));
}

export function coursePathChapterUnlocked(
  progress: CourseProgress,
  chapter: CoursePathChapter,
  minimumLevel: DetailedCefrLevel,
): boolean {
  const visible = visibleCoursePathChapters(minimumLevel);
  const index = visible.findIndex((candidate) => candidate.id === chapter.id);
  if (index < 0) return false;
  if (index === 0) return true;
  return coursePathChapterCompleted(progress, visible[index - 1]);
}

function firstIncompleteRequiredNode(
  progress: CourseProgress,
  chapter: CoursePathChapter,
): CoursePathNode | undefined {
  for (const node of chapter.nodes) {
    if (node.required && !nodeCompleted(progress, node)) return node;
  }
  return undefined;
}

export function currentCoursePathNode(
  progress: CourseProgress,
  minimumLevel: DetailedCefrLevel,
): CoursePathNode | undefined {
  const visible = visibleCoursePathChapters(minimumLevel);
  for (const [index, chapter] of visible.entries()) {
    if (index > 0 && !coursePathChapterCompleted(progress, visible[index - 1])) break;
    const next = firstIncompleteRequiredNode(progress, chapter);
    if (next) return next;
  }
  return undefined;
}

export function recommendedCoursePathNode(
  progress: CourseProgress,
  minimumLevel: DetailedCefrLevel,
): CoursePathNode | undefined {
  const current = currentCoursePathNode(progress, minimumLevel);
  if (current) return current;
  const visible = visibleCoursePathChapters(minimumLevel);
  for (const chapter of visible) {
    for (const node of chapter.nodes) {
      if (
        node.type === 'reading' &&
        node.storyBookId &&
        progress.unlockedStoryBooks.includes(node.storyBookId) &&
        !nodeCompleted(progress, node)
      ) {
        return node;
      }
    }
  }
  return visible.at(-1)?.nodes.find((node) => node.type === 'checkpoint');
}

export function coursePathNodeState(
  progress: CourseProgress,
  node: CoursePathNode,
  minimumLevel: DetailedCefrLevel,
): CoursePathNodeState {
  if (nodeCompleted(progress, node)) return 'completed';
  const chapter = coursePathChapterById(node.chapterId);
  if (!chapter || !coursePathChapterUnlocked(progress, chapter, minimumLevel)) return 'locked';

  if (node.type === 'reading') {
    return node.storyBookId && progress.unlockedStoryBooks.includes(node.storyBookId)
      ? 'bonus'
      : 'locked';
  }

  const current = currentCoursePathNode(progress, minimumLevel);
  if (current?.id !== node.id) return 'locked';
  return progress.pathNodes[node.id]?.startedAt ? 'in-progress' : 'current';
}

export function coursePathViews(
  progress: CourseProgress,
  minimumLevel: DetailedCefrLevel,
): CoursePathChapterView[] {
  const visible = visibleCoursePathChapters(minimumLevel);
  const currentNode = currentCoursePathNode(progress, minimumLevel);
  const completedChapters = visible.map((chapter) => coursePathChapterCompleted(progress, chapter));
  const unlockedStoryBooks = new Set(progress.unlockedStoryBooks);

  return visible.map((chapter, chapterIndex) => {
    const completedNodeIds = new Set<string>();
    let completedRequired = 0;
    let requiredTotal = 0;
    for (const node of chapter.nodes) {
      const completed = nodeCompleted(progress, node);
      if (completed) completedNodeIds.add(node.id);
      if (!node.required) continue;
      requiredTotal += 1;
      if (completed) completedRequired += 1;
    }
    const unlocked = chapterIndex === 0 || completedChapters[chapterIndex - 1];
    const completed = completedChapters[chapterIndex];
    return {
      chapter,
      unlocked,
      completed,
      current: currentNode?.chapterId === chapter.id,
      completedRequired,
      requiredTotal,
      percent: Math.round((completedRequired / Math.max(1, requiredTotal)) * 100),
      nodes: chapter.nodes.map((node) => {
        const state: CoursePathNodeState = completedNodeIds.has(node.id)
          ? 'completed'
          : !unlocked
            ? 'locked'
            : node.type === 'reading'
              ? node.storyBookId && unlockedStoryBooks.has(node.storyBookId)
                ? 'bonus'
                : 'locked'
              : currentNode?.id !== node.id
                ? 'locked'
                : progress.pathNodes[node.id]?.startedAt
                  ? 'in-progress'
                  : 'current';
        return {
          node,
          state,
          progress: progress.pathNodes[node.id],
          lockReason:
            state !== 'locked'
              ? undefined
              : !unlocked
                ? 'Dokonči checkpoint předchozí kapitoly.'
                : node.type === 'reading'
                  ? 'Četbu odemkne checkpoint této kapitoly.'
                  : 'Nejdřív dokonči předchozí krok.',
        };
      }),
    };
  });
}

function assertCoursePathNodeCanAdvance(
  progress: CourseProgress,
  node: CoursePathNode,
  minimumLevel: DetailedCefrLevel,
): void {
  if (nodeCompleted(progress, node)) return;
  const current = currentCoursePathNode(progress, minimumLevel);
  if (current?.id !== node.id) {
    throw new Error('Tento krok je zatím zamčený. Nejdřív dokonči předchozí uzel cesty.');
  }
}

export function startCoursePathNode(
  progress: CourseProgress,
  nodeId: string,
  now = new Date(),
  minimumLevel: DetailedCefrLevel = 'A1.1',
): CourseProgress {
  const node = coursePathNodeById(nodeId);
  if (!node || node.type === 'reading') {
    throw new Error('Tento uzel kurzové cesty nelze spustit.');
  }
  assertCoursePathNodeCanAdvance(progress, node, minimumLevel);
  const timestamp = now.toISOString();
  const current = progress.pathNodes[nodeId];
  if (current?.startedAt || current?.completedAt) return progress;
  return {
    ...progress,
    pathNodes: {
      ...progress.pathNodes,
      [nodeId]: {
        nodeId,
        startedAt: timestamp,
        attempts: 0,
        bestStars: 0,
        xpAwarded: 0,
        updatedAt: timestamp,
      },
    },
    updatedAt: timestamp,
  };
}

function activeDoubleXpBoost(progress: CourseProgress): CourseDoubleXpBoost | undefined {
  return progress.wallet.boosts.find((boost) => boost.status === 'active');
}

function clampStars(value: number): 1 | 2 | 3 {
  if (value >= 3) return 3;
  if (value >= 2) return 2;
  return 1;
}

export function completeCoursePathNode(
  progress: CourseProgress,
  nodeId: string,
  rawStars = 1,
  now = new Date(),
  minimumLevel: DetailedCefrLevel = 'A1.1',
): CompleteCoursePathNodeResult {
  const node = coursePathNodeById(nodeId);
  if (!node || node.type === 'reading') throw new Error('Tento uzel kurzové cesty nelze dokončit.');
  const chapter = coursePathChapterById(node.chapterId);
  if (!chapter) throw new Error('Kapitola kurzové cesty už není dostupná.');
  assertCoursePathNodeCanAdvance(progress, node, minimumLevel);

  const timestamp = now.toISOString();
  const current = progress.pathNodes[nodeId];
  const grandfathered = progress.grandfatheredChapterIds.includes(node.chapterId);
  const firstCompletion = !current?.completedAt && !grandfathered;
  const materializedNow = !current?.completedAt;
  const stars = clampStars(rawStars);
  const previousStars = current?.bestStars ?? 0;
  const bestStars = Math.max(previousStars, stars) as 1 | 2 | 3;
  const boost = firstCompletion && node.xp > 0 ? activeDoubleXpBoost(progress) : undefined;
  const baseXp = firstCompletion ? node.xp : 0;
  const bonusXp = boost ? baseXp : 0;
  const xpAwarded = baseXp + bonusXp;
  const event: CoursePathEvent | undefined = materializedNow
    ? {
        id: `path:${node.id}`,
        nodeId: node.id,
        chapterId: node.chapterId,
        completedAt: timestamp,
        stars,
        baseXp,
        bonusXp,
        xpAwarded,
        boosted: Boolean(boost),
      }
    : undefined;

  const nextBoosts = boost
    ? progress.wallet.boosts.map((candidate) =>
        candidate.id === boost.id
          ? {
              ...candidate,
              status: 'consumed' as const,
              consumedAt: timestamp,
              consumedByNodeId: node.id,
            }
          : candidate,
      )
    : progress.wallet.boosts;

  const unlockedStoryBookId =
    firstCompletion && node.type === 'checkpoint' ? chapter.storyBookId : undefined;
  const unlockedStoryBooks =
    unlockedStoryBookId && !progress.unlockedStoryBooks.includes(unlockedStoryBookId)
      ? [...progress.unlockedStoryBooks, unlockedStoryBookId]
      : progress.unlockedStoryBooks;

  const nextProgress: CourseProgress = {
    ...progress,
    pathNodes: {
      ...progress.pathNodes,
      [nodeId]: {
        nodeId,
        startedAt: current?.startedAt ?? timestamp,
        completedAt: current?.completedAt ?? timestamp,
        attempts: (current?.attempts ?? 0) + 1,
        bestStars,
        xpAwarded: firstCompletion ? xpAwarded : (current?.xpAwarded ?? 0),
        updatedAt: timestamp,
      },
    },
    pathEvents: event ? [...progress.pathEvents, event] : progress.pathEvents,
    unlockedStoryBooks,
    wallet: boost ? { ...progress.wallet, boosts: nextBoosts } : progress.wallet,
    updatedAt: timestamp,
  };

  return {
    progress: nextProgress,
    firstCompletion,
    starsImproved: bestStars > previousStars,
    previousStars,
    stars: bestStars,
    xpAwarded,
    boosted: Boolean(boost),
    event,
    unlockedStoryBookId:
      unlockedStoryBookId && !progress.unlockedStoryBooks.includes(unlockedStoryBookId)
        ? unlockedStoryBookId
        : undefined,
  };
}

export function pathXp(progress: CourseProgress): number {
  return progress.pathEvents.reduce((sum, event) => sum + Math.max(0, event.xpAwarded), 0);
}

export function pathXpOnDay(progress: CourseProgress, day = new Date()): number {
  const target = localDateKey(day);
  let xp = 0;
  for (const event of progress.pathEvents) {
    if (localDateKey(new Date(event.completedAt)) === target) {
      xp += Math.max(0, event.xpAwarded);
    }
  }
  return xp;
}
