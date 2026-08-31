import { createId } from '../id.ts';
import { detailedCefrRank } from '../levels.ts';
import { localDateKey } from '../stats/learning.ts';
import { advancedGrammarCategories, advancedGrammarLessons } from './grammar-advanced.ts';
import { expansionGrammarCategories, expansionGrammarLessons } from './grammar-expansion.ts';
import { additionalGrammarLessons } from './grammar-more.ts';
import { nextGrammarLessons } from './grammar-next.ts';
import { supplementalGrammarLessons } from './grammar-supplement.ts';

import type { CefrLevel, CourseAnswerEvent, CourseProgress, DetailedCefrLevel } from '../types.ts';

export {
  claimCourseReward,
  coachSessionsOnDay,
  courseActivityDates,
  courseAnswersOnDay,
  courseXpOnDay,
  createCourseProgress,
  creditedCoachTurnsOnDay,
  normalizeCourseProgress,
  recordCoachSession,
} from './course-progress.ts';
export type { RecordCoachSessionInput, RecordCoachSessionResult } from './course-progress.ts';

export type GrammarQuestionKind = 'choice' | 'fill' | 'order';

type GrammarQuestionBase = {
  id: string;
  kind: GrammarQuestionKind;
  prompt: string;
  instruction: string;
  explanation: string;
  skill: string;
};

export type GrammarChoiceQuestion = {
  kind: 'choice';
  options: string[];
  answer: string;
} & GrammarQuestionBase;

export type GrammarFillQuestion = {
  kind: 'fill';
  before: string;
  after: string;
  answers: string[];
  placeholder?: string;
  hint: string;
} & GrammarQuestionBase;

export type GrammarOrderQuestion = {
  kind: 'order';
  tokens: string[];
  answer: string[];
  translation: string;
} & GrammarQuestionBase;

export type GrammarQuestion = GrammarChoiceQuestion | GrammarFillQuestion | GrammarOrderQuestion;

export type GrammarLesson = {
  id: string;
  categoryId: string;
  unit: number;
  title: string;
  shortTitle: string;
  subtitle: string;
  cefr: CefrLevel;
  minutes: number;
  completionXp: number;
  concept: string;
  formula: string;
  examples: Array<{ de: string; cs: string }>;
  questions: GrammarQuestion[];
};

export type GrammarCategory = {
  id: string;
  number: string;
  title: string;
  description: string;
  accent: 'acid' | 'sky' | 'coral' | 'orange' | 'mint' | 'cobalt';
};

export type GrammarLessonProgress = {
  lessonId: string;
  answered: number;
  correct: number;
  total: number;
  percent: number;
  completed: boolean;
  stars: 0 | 1 | 2 | 3;
  attempts: number;
  xp: number;
  lastStudiedAt?: string;
};

export type CourseSummary = {
  completedLessons: number;
  totalLessons: number;
  completedQuestions: number;
  totalQuestions: number;
  percent: number;
  grammarXp: number;
  todayAnswers: number;
  todayXp: number;
};

export type RecordCourseAnswerInput = {
  lessonId: string;
  questionId: string;
  correct: boolean;
  responseMs: number;
  now?: Date;
};

export type RecordCourseAnswerResult = {
  progress: CourseProgress;
  event: CourseAnswerEvent;
  lessonCompletedNow: boolean;
  xpAwarded: number;
};

export type RecordLessonRunInput = {
  lessonId: string;
  correctFirstTry: number;
  total: number;
  now?: Date;
};

export type RecordLessonRunResult = {
  progress: CourseProgress;
  stars: 1 | 2 | 3;
  previousBest: 0 | 1 | 2 | 3;
  improved: boolean;
};

export const grammarCategories: GrammarCategory[] = [
  {
    id: 'sentence-engine',
    number: '01',
    title: 'Motor věty',
    description:
      'Sloveso, otázky, zápor a modální slovesa. Základ, který drží každou větu pohromadě.',
    accent: 'acid',
  },
  {
    id: 'verb-lab',
    number: '02',
    title: 'Slovesná dílna',
    description: 'Přítomný čas, odlučitelné předpony a minulý čas Perfekt bez chaosu v tvarech.',
    accent: 'sky',
  },
  {
    id: 'cases',
    number: '03',
    title: 'Členy a pády',
    description: 'Rod, akuzativ, dativ a předložky naučené přes význam, ne přes slepé tabulky.',
    accent: 'coral',
  },
  {
    id: 'longer-sentences',
    number: '04',
    title: 'Delší a přesnější věty',
    description: 'Spojky, pořadí informací a přídavná jména pro věty, které znějí jistěji.',
    accent: 'orange',
  },
  ...advancedGrammarCategories,
  ...expansionGrammarCategories,
];

function choice(
  id: string,
  prompt: string,
  options: string[],
  answer: string,
  explanation: string,
  skill: string,
  instruction = 'Vyber správnou možnost.',
): GrammarChoiceQuestion {
  return { id, kind: 'choice', prompt, instruction, options, answer, explanation, skill };
}

function fill(
  id: string,
  prompt: string,
  before: string,
  after: string,
  answers: string[],
  hint: string,
  explanation: string,
  skill: string,
  instruction = 'Doplň chybějící část.',
): GrammarFillQuestion {
  return {
    id,
    kind: 'fill',
    prompt,
    instruction,
    before,
    after,
    answers,
    hint,
    explanation,
    skill,
  };
}

function order(
  id: string,
  prompt: string,
  tokens: string[],
  answer: string[],
  translation: string,
  explanation: string,
  skill: string,
  instruction = 'Poskládej větu ve správném pořadí.',
): GrammarOrderQuestion {
  return {
    id,
    kind: 'order',
    prompt,
    instruction,
    tokens,
    answer,
    translation,
    explanation,
    skill,
  };
}

export const grammarLessons: GrammarLesson[] = [
  {
    id: 'verb-second-position',
    categoryId: 'sentence-engine',
    unit: 1,
    title: 'Sloveso na druhé pozici',
    shortTitle: 'Pozice slovesa',
    subtitle: 'Jedno pravidlo, které okamžitě narovná německý slovosled.',
    cefr: 'A1',
    minutes: 6,
    completionXp: 20,
    concept:
      'V oznamovací větě stojí určité sloveso na druhé větné pozici. První pozici může zabrat podmět, čas nebo jiné zvýrazněné slovo.',
    formula: '1. pozice + určité sloveso + zbytek věty',
    examples: [
      { de: 'Ich lerne heute Deutsch.', cs: 'Dnes se učím německy.' },
      { de: 'Heute lerne ich Deutsch.', cs: 'Dnes se učím německy.' },
    ],
    questions: [
      choice(
        'v2-1',
        'Heute ___ ich für den Test.',
        ['lerne', 'ich lerne', 'lernen', 'gelernt'],
        'lerne',
        '„Heute“ zabírá první pozici, proto musí být určité sloveso „lerne“ hned za ním.',
        'sloveso na druhé pozici',
      ),
      order(
        'v2-2',
        'Zítra jedeme do Berlína.',
        ['nach Berlin', 'wir', 'Morgen', 'fahren'],
        ['Morgen', 'fahren', 'wir', 'nach Berlin'],
        'Zítra jedeme do Berlína.',
        'Po časovém údaji „Morgen“ následuje sloveso „fahren“ a teprve potom podmět.',
        'inverze po časovém údaji',
      ),
      fill(
        'v2-3',
        'Doplň správný tvar a pozici slovesa.',
        'Am Montag ',
        ' meine Schwester lange.',
        ['arbeitet'],
        'Sloveso arbeiten, 3. osoba jednotného čísla.',
        '„Am Montag“ je první větný člen, takže „arbeitet“ musí být na druhé pozici.',
        'sloveso na druhé pozici',
      ),
      choice(
        'v2-4',
        'Která věta zachovává sloveso na druhé pozici po úvodním místním údaji?',
        [
          'In der Schule ich spreche Deutsch.',
          'In der Schule spreche ich Deutsch.',
          'In der Schule Deutsch ich spreche.',
          'Spreche in der Schule ich Deutsch.',
        ],
        'In der Schule spreche ich Deutsch.',
        'Celý výraz „In der Schule“ je první pozice; sloveso „spreche“ je druhé.',
        'větné pozice',
      ),
      order(
        'v2-5',
        'Večer čtu často knihy.',
        ['oft', 'Am Abend', 'Bücher', 'lese', 'ich'],
        ['Am Abend', 'lese', 'ich', 'oft', 'Bücher'],
        'Večer čtu často knihy.',
        'První pozice může být čas. Sloveso zůstává druhé a podmět se posune za něj.',
        'inverze po časovém údaji',
      ),
    ],
  },
  {
    id: 'questions',
    categoryId: 'sentence-engine',
    unit: 2,
    title: 'Otázky bez hádání',
    shortTitle: 'Otázky',
    subtitle: 'Ano/ne otázky a W-otázky mají dvě snadno rozpoznatelné kostry.',
    cefr: 'A1',
    minutes: 6,
    completionXp: 20,
    concept:
      'U otázky ano/ne začíná věta slovesem. U W-otázky stojí tázací slovo první a sloveso hned za ním.',
    formula: 'Sloveso + podmět…? / W-slovo + sloveso + podmět…?',
    examples: [
      { de: 'Kommst du heute?', cs: 'Přijdeš dnes?' },
      { de: 'Wann kommst du?', cs: 'Kdy přijdeš?' },
    ],
    questions: [
      order(
        'q-1',
        'Bydlíš v Praze?',
        ['du', 'in Prag', 'Wohnst'],
        ['Wohnst', 'du', 'in Prag'],
        'Bydlíš v Praze?',
        'Otázka ano/ne začíná určitým slovesem „Wohnst“.',
        'ano/ne otázka',
      ),
      choice(
        'q-2',
        '___ lernst du Deutsch?',
        ['Warum', 'Bist', 'Hast', 'Lernst'],
        'Warum',
        'Ptáme se na důvod, proto použijeme „Warum“. Sloveso „lernst“ je hned za ním.',
        'W-otázka',
      ),
      fill(
        'q-3',
        'Zeptej se na čas.',
        '',
        ' beginnt der Film?',
        ['Wann'],
        'Tázací slovo „kdy“.',
        '„Wann“ se používá pro otázku na časový okamžik.',
        'tázací slova',
      ),
      choice(
        'q-4',
        'Která otázka znamená „Jak se jmenuješ?“',
        ['Wo heißt du?', 'Wie heißt du?', 'Was bist du?', 'Wann heißt du?'],
        'Wie heißt du?',
        'U jména se v němčině používá spojení „Wie heißt du?“.',
        'ustálená otázka',
      ),
      order(
        'q-5',
        'Co děláš po škole?',
        ['du', 'nach der Schule', 'Was', 'machst'],
        ['Was', 'machst', 'du', 'nach der Schule'],
        'Co děláš po škole?',
        'W-slovo je první, sloveso druhé a podmět třetí.',
        'W-otázka',
      ),
    ],
  },
  {
    id: 'negation',
    categoryId: 'sentence-engine',
    unit: 3,
    title: 'Nicht, nebo kein?',
    shortTitle: 'Zápor',
    subtitle: 'Rozhodni se podle toho, co přesně popíráš.',
    cefr: 'A1',
    minutes: 7,
    completionXp: 20,
    concept:
      '„Kein“ nahrazuje neurčitý člen nebo popírá podstatné jméno bez členu. „Nicht“ popírá sloveso, vlastnost, konkrétní člen nebo jinou část věty.',
    formula: 'kein + podstatné jméno / nicht + ostatní',
    examples: [
      { de: 'Ich habe kein Fahrrad.', cs: 'Nemám kolo.' },
      { de: 'Das Fahrrad ist nicht neu.', cs: 'To kolo není nové.' },
    ],
    questions: [
      choice(
        'neg-1',
        'Ich habe ___ Bruder.',
        ['nicht', 'keinen', 'kein', 'keine'],
        'keinen',
        'Popíráme podstatné jméno „Bruder“ v akuzativu mužského rodu: „keinen Bruder“.',
        'kein v akuzativu',
      ),
      fill(
        'neg-2',
        'Popři vlastnost.',
        'Der Test ist ',
        ' schwer.',
        ['nicht'],
        'Zápor přídavného jména.',
        'Přídavné jméno „schwer“ popíráme pomocí „nicht“.',
        'nicht u vlastnosti',
      ),
      choice(
        'neg-3',
        'Wir trinken ___ Kaffee.',
        ['kein', 'keinen', 'nicht', 'keine'],
        'keinen',
        '„Kaffee“ je mužského rodu a je předmětem v akuzativu, proto „keinen“.',
        'kein v akuzativu',
      ),
      order(
        'neg-4',
        'Dnes nejdu do školy.',
        ['heute', 'nicht', 'Ich', 'gehe', 'in die Schule'],
        ['Ich', 'gehe', 'heute', 'nicht', 'in die Schule'],
        'Dnes nejdu do školy.',
        '„Nicht“ stojí před popíraným směrovým doplněním „in die Schule“.',
        'pozice nicht',
      ),
      choice(
        'neg-5',
        'Která věta správně popírá přivlastňovací výraz „mein Buch“?',
        [
          'Das ist kein mein Buch.',
          'Das ist nicht mein Buch.',
          'Das nicht ist mein Buch.',
          'Das ist mein nicht Buch.',
        ],
        'Das ist nicht mein Buch.',
        'Před přivlastňovacím zájmenem „mein“ nepoužíváme „kein“; popření vyjádří „nicht“.',
        'nicht před přivlastněním',
      ),
    ],
  },
  {
    id: 'modal-verbs',
    categoryId: 'sentence-engine',
    unit: 4,
    title: 'Modální slovesa',
    shortTitle: 'Můžu, musím, chci',
    subtitle: 'Jedno časované sloveso vpředu, druhé v infinitivu na konci.',
    cefr: 'A1',
    minutes: 7,
    completionXp: 20,
    concept:
      'Modální sloveso se časuje a stojí na druhé pozici. Významové sloveso zůstává v infinitivu na konci věty.',
    formula: 'podmět + modální sloveso + … + infinitiv',
    examples: [
      { de: 'Ich muss heute lernen.', cs: 'Dnes se musím učit.' },
      { de: 'Kannst du mir helfen?', cs: 'Můžeš mi pomoct?' },
    ],
    questions: [
      fill(
        'mod-1',
        'Vyjádři povinnost.',
        'Ich ',
        ' morgen früh aufstehen.',
        ['muss'],
        'Sloveso müssen, 1. osoba jednotného čísla.',
        '„Ich muss“ je správný tvar; infinitiv „aufstehen“ zůstává na konci.',
        'časování müssen',
      ),
      order(
        'mod-2',
        'Moje sestra umí dobře plavat.',
        ['gut', 'Meine Schwester', 'schwimmen', 'kann'],
        ['Meine Schwester', 'kann', 'gut', 'schwimmen'],
        'Moje sestra umí dobře plavat.',
        '„Kann“ je časované na druhé pozici, „schwimmen“ je infinitiv na konci.',
        'modální rámec',
      ),
      choice(
        'mod-3',
        'Du ___ hier nicht parken.',
        ['darfst', 'darf', 'kannst zu', 'musst zu'],
        'darfst',
        '„Du darfst“ je správný tvar slovesa „dürfen“ pro dovolení či zákaz.',
        'časování dürfen',
      ),
      choice(
        'mod-4',
        'Která věta znamená „Chceme dnes vařit“?',
        [
          'Wir wollen heute kochen.',
          'Wir heute wollen kochen.',
          'Wir wollen kocht heute.',
          'Wir heute kochen wollen.',
        ],
        'Wir wollen heute kochen.',
        'Časované „wollen“ stojí druhé, infinitiv „kochen“ uzavírá větu.',
        'modální rámec',
      ),
      order(
        'mod-5',
        'Můžeš dnes přijít?',
        ['heute', 'kommen', 'du', 'Kannst'],
        ['Kannst', 'du', 'heute', 'kommen'],
        'Můžeš dnes přijít?',
        'V otázce ano/ne stojí modální sloveso první a infinitiv zůstává na konci.',
        'otázka s modálním slovesem',
      ),
    ],
  },
  {
    id: 'sein-haben',
    categoryId: 'verb-lab',
    unit: 5,
    title: 'Sein a haben automaticky',
    shortTitle: 'Sein & haben',
    subtitle: 'Nejčastější nepravidelná slovesa musí být rychlejší než přemýšlení.',
    cefr: 'A1',
    minutes: 5,
    completionXp: 18,
    concept:
      'Tvary „sein“ a „haben“ jsou nepravidelné a objevují se samostatně i jako pomocná slovesa. Uč se je ve větách.',
    formula: 'ich bin / du bist / er ist · ich habe / du hast / er hat',
    examples: [
      { de: 'Wir sind heute zu Hause.', cs: 'Dnes jsme doma.' },
      { de: 'Sie hat eine Frage.', cs: 'Má otázku.' },
    ],
    questions: [
      choice(
        'sh-1',
        'Du ___ sehr müde.',
        ['bist', 'bin', 'seid', 'hast'],
        'bist',
        'K podmětu „du“ patří tvar „bist“. „Bin“ se pojí s „ich“, „seid“ s „ihr“ a „hast“ je tvar jiného slovesa: „haben“.',
        'sein',
      ),
      fill(
        'sh-2',
        'Doplň tvar haben.',
        'Wir ',
        ' heute viel Zeit.',
        ['haben'],
        '1. osoba množného čísla.',
        'U podmětu „wir“ má sloveso tvar „haben“, shodný s infinitivem. „Hast“ patří k „du“ a „hat“ k „er/sie/es“.',
        'haben',
      ),
      choice(
        'sh-3',
        'Meine Eltern ___ in Brno.',
        ['sind', 'ist', 'seid', 'haben'],
        'sind',
        'Množné číslo „meine Eltern“ vyžaduje „sind“.',
        'sein v množném čísle',
      ),
      order(
        'sh-4',
        'Máte zítra školu?',
        ['morgen', 'ihr', 'Schule', 'Habt'],
        ['Habt', 'ihr', 'morgen', 'Schule'],
        'Máte zítra školu?',
        'V otázce stojí „Habt“ první, potom podmět „ihr“.',
        'otázka s haben',
      ),
      fill(
        'sh-5',
        'Doplň správný tvar.',
        'Ich ',
        ' fünfzehn Jahre alt.',
        ['bin'],
        'Věk se německy vyjadřuje se sein.',
        'Němčina říká doslova „jsem patnáct let stará/starý“: „Ich bin … Jahre alt.“',
        'sein ve vyjádření věku',
      ),
    ],
  },
  {
    id: 'present-endings',
    categoryId: 'verb-lab',
    unit: 6,
    title: 'Koncovky v přítomném čase',
    shortTitle: 'Přítomný čas',
    subtitle: 'Jeden kmen a šest předvídatelných koncovek.',
    cefr: 'A1',
    minutes: 7,
    completionXp: 20,
    concept:
      'U pravidelných sloves odřízni -en a přidej koncovku podle osoby. U kmenů na -t nebo -d se často vkládá -e-.',
    formula: '-e, -st, -t, -en, -t, -en',
    examples: [
      { de: 'Ich lerne, du lernst, er lernt.', cs: 'Učím se, učíš se, učí se.' },
      { de: 'Du arbeitest heute.', cs: 'Dnes pracuješ.' },
    ],
    questions: [
      fill(
        'pres-1',
        'Doplň tvar lernen.',
        'Meine Freundin ',
        ' Deutsch.',
        ['lernt'],
        '3. osoba jednotného čísla.',
        'Pro „sie“ v jednotném čísle přidáme ke kmeni „lern-“ koncovku -t.',
        'koncovka -t',
      ),
      choice(
        'pres-2',
        'Ihr ___ jeden Tag.',
        ['lernt', 'lernen', 'lernst', 'lerne'],
        'lernt',
        'Pro „ihr“ přidáme ke kmeni „lern-“ koncovku -t: „ihr lernt“. Tvar „lernen“ patří k „wir“ a „sie/Sie“.',
        'ihr koncovka',
      ),
      fill(
        'pres-3',
        'Pozor na kmen končící na -t.',
        'Du ',
        ' am Wochenende.',
        ['arbeitest'],
        'arbeiten, 2. osoba jednotného čísla.',
        'Mezi kmen „arbeit-“ a koncovku -st vložíme -e-: „arbeitest“.',
        'vkladné e',
      ),
      choice(
        'pres-4',
        'Který tvar patří k „wir“?',
        ['macht', 'machst', 'machen', 'mache'],
        'machen',
        'U „wir“ je tvar stejný jako infinitiv: „machen“.',
        'wir koncovka',
      ),
      order(
        'pres-5',
        'On dnes hraje fotbal.',
        ['heute', 'Fußball', 'spielt', 'Er'],
        ['Er', 'spielt', 'heute', 'Fußball'],
        'On dnes hraje fotbal.',
        '„Er“ vyžaduje tvar „spielt“ a sloveso stojí na druhé pozici.',
        'časování a slovosled',
      ),
    ],
  },
  {
    id: 'separable-verbs',
    categoryId: 'verb-lab',
    unit: 7,
    title: 'Odlučitelné předpony',
    shortTitle: 'Odlučitelná slovesa',
    subtitle: 'Sloveso se otevře jako závorka: časovaná část vpředu, předpona na konci.',
    cefr: 'A2',
    minutes: 7,
    completionXp: 22,
    concept:
      'U hlavní věty se předpona oddělí a přesune na konec. V infinitivu a často ve vedlejší větě zůstává sloveso pohromadě.',
    formula: 'Ich stehe … auf. / Ich muss … aufstehen.',
    examples: [
      { de: 'Der Unterricht fängt um acht an.', cs: 'Vyučování začíná v osm.' },
      { de: 'Ich möchte früh aufstehen.', cs: 'Chci brzy vstát.' },
    ],
    questions: [
      order(
        'sep-1',
        'Vstávám v šest hodin.',
        ['um sechs Uhr', 'auf', 'Ich', 'stehe'],
        ['Ich', 'stehe', 'um sechs Uhr', 'auf'],
        'Vstávám v šest hodin.',
        'Časovaná část „stehe“ je druhá, předpona „auf“ uzavírá větu.',
        'slovesná závorka',
      ),
      fill(
        'sep-2',
        'Doplň oddělenou předponu.',
        'Der Film fängt um neun Uhr ',
        '.',
        ['an'],
        'Infinitiv je anfangen.',
        'U „anfangen“ se v hlavní větě oddělí předpona „an“.',
        'předpona an-',
      ),
      choice(
        'sep-3',
        'Která věta správně rozděluje sloveso „anrufen“?',
        [
          'Ich rufe meine Oma an.',
          'Ich anrufe meine Oma.',
          'Ich rufe an meine Oma.',
          'Ich meine Oma an rufe.',
        ],
        'Ich rufe meine Oma an.',
        '„Rufe“ stojí na druhé pozici a „an“ na konci.',
        'anrufen',
      ),
      order(
        'sep-4',
        'Nakupujeme v sobotu.',
        ['am Samstag', 'ein', 'Wir', 'kaufen'],
        ['Wir', 'kaufen', 'am Samstag', 'ein'],
        'Nakupujeme v sobotu.',
        'U „einkaufen“ se „ein“ oddělí a jde na konec.',
        'einkaufen',
      ),
      choice(
        'sep-5',
        'Po modálním slovese použij správnou podobu.',
        [
          'Ich muss früh aufstehen.',
          'Ich muss stehe früh auf.',
          'Ich aufstehen muss früh.',
          'Ich muss früh stehe auf.',
        ],
        'Ich muss früh aufstehen.',
        'Po modálním slovese zůstává infinitiv „aufstehen“ pohromadě na konci.',
        'infinitiv s předponou',
      ),
    ],
  },
  {
    id: 'perfect-haben',
    categoryId: 'verb-lab',
    unit: 8,
    title: 'Perfekt s haben',
    shortTitle: 'Minulost s haben',
    subtitle: 'Pomocné sloveso drží druhou pozici, příčestí uzavírá větu.',
    cefr: 'A2',
    minutes: 8,
    completionXp: 24,
    concept:
      'V mluvené němčině se minulost často tvoří pomocí „haben“ a příčestí minulého. U pravidelných sloves bývá ge- + kmen + -t.',
    formula: 'haben v určitém tvaru + … + Partizip II',
    examples: [
      { de: 'Ich habe gestern gelernt.', cs: 'Včera jsem se učila.' },
      { de: 'Wir haben einen Film gesehen.', cs: 'Viděli jsme film.' },
    ],
    questions: [
      order(
        'ph-1',
        'Včera jsem dělal domácí úkol.',
        ['gestern', 'gemacht', 'Ich', 'habe', 'die Hausaufgaben'],
        ['Ich', 'habe', 'gestern', 'die Hausaufgaben', 'gemacht'],
        'Včera jsem dělal domácí úkol.',
        '„Habe“ je na druhé pozici a příčestí „gemacht“ na konci.',
        'Perfekt rámec',
      ),
      fill(
        'ph-2',
        'Doplň pomocné sloveso.',
        'Wir ',
        ' lange gelernt.',
        ['haben'],
        'Podmět wir.',
        'Pro „wir“ má pomocné sloveso tvar „haben“.',
        'haben v perfektu',
      ),
      choice(
        'ph-3',
        'Jaké je Partizip II slovesa spielen?',
        ['gespielt', 'gespielen', 'gespieltet', 'spielen'],
        'gespielt',
        'Pravidelné „spielen“ tvoří příčestí ge- + spiel + -t.',
        'Partizip II pravidelné',
      ),
      choice(
        'ph-4',
        'Která věta správně tvoří Perfekt slovesa „lesen“?',
        [
          'Sie hat das Buch gelesen.',
          'Sie hat gelesen das Buch.',
          'Sie das Buch hat gelesen.',
          'Sie ist das Buch gelesen.',
        ],
        'Sie hat das Buch gelesen.',
        'Pomocné „hat“ je druhé a „gelesen“ uzavírá větu.',
        'Perfekt nepravidelné',
      ),
      order(
        'ph-5',
        'Co jste koupili?',
        ['gekauft', 'ihr', 'Was', 'habt'],
        ['Was', 'habt', 'ihr', 'gekauft'],
        'Co jste koupili?',
        'W-slovo je první, „habt“ druhé a příčestí „gekauft“ na konci.',
        'otázka v perfektu',
      ),
    ],
  },
  {
    id: 'perfect-sein',
    categoryId: 'verb-lab',
    unit: 9,
    title: 'Perfekt se sein',
    shortTitle: 'Minulost se sein',
    subtitle: 'Pohyb a změna stavu často přepínají pomocné sloveso.',
    cefr: 'A2',
    minutes: 7,
    completionXp: 24,
    concept:
      'Slovesa pohybu z místa na místo a změny stavu často tvoří Perfekt se „sein“. Tvar příčestí zůstává na konci.',
    formula: 'sein v určitém tvaru + … + Partizip II',
    examples: [
      { de: 'Ich bin nach Hause gegangen.', cs: 'Šla jsem domů.' },
      { de: 'Der Bus ist spät angekommen.', cs: 'Autobus přijel pozdě.' },
    ],
    questions: [
      choice(
        'ps-1',
        'Ich ___ nach Berlin gefahren.',
        ['bin', 'habe', 'ist', 'war'],
        'bin',
        '„Fahren“ jako pohyb do cíle tvoří Perfekt se „sein“: „ich bin gefahren“.',
        'pomocné sein',
      ),
      fill(
        'ps-2',
        'Doplň tvar sein.',
        'Meine Freunde ',
        ' spät gekommen.',
        ['sind'],
        'Podmět je v množném čísle.',
        'Pro množné číslo použijeme „sind gekommen“.',
        'sein v množném čísle',
      ),
      order(
        'ps-3',
        'Kdy jste přijeli?',
        ['angekommen', 'ihr', 'Wann', 'seid'],
        ['Wann', 'seid', 'ihr', 'angekommen'],
        'Kdy jste přijeli?',
        '„Seid“ je druhé, příčestí „angekommen“ na konci.',
        'otázka v perfektu',
      ),
      choice(
        'ps-4',
        'Které sloveso obvykle tvoří Perfekt se sein?',
        ['gehen', 'lernen', 'kaufen', 'machen'],
        'gehen',
        '„Gehen“ vyjadřuje pohyb a standardně tvoří Perfekt „ist gegangen“.',
        'volba pomocného slovesa',
      ),
      order(
        'ps-5',
        'Včera jsem zůstal doma.',
        ['zu Hause', 'gestern', 'geblieben', 'Ich', 'bin'],
        ['Ich', 'bin', 'gestern', 'zu Hause', 'geblieben'],
        'Včera jsem zůstal doma.',
        'Také „bleiben“ tvoří Perfekt se „sein“: „bin geblieben“.',
        'výjimka bleiben',
      ),
    ],
  },
  {
    id: 'articles-gender',
    categoryId: 'cases',
    unit: 10,
    title: 'Rod a člen jako jeden celek',
    shortTitle: 'Der, die, das',
    subtitle: 'Neuč se „Buch“, ale „das Buch“ — člen je součást slovíčka.',
    cefr: 'A1',
    minutes: 6,
    completionXp: 20,
    concept:
      'Rod často nejde bezpečně odhadnout, proto se podstatné jméno učí se členem. Některé koncovky ale poskytují spolehlivé vodítko.',
    formula: 'der (m.) · die (f.) · das (n.) · die (pl.)',
    examples: [
      { de: 'der Schlüssel', cs: 'klíč' },
      { de: 'die Zeitung', cs: 'noviny' },
      { de: 'das Mädchen', cs: 'dívka' },
    ],
    questions: [
      choice(
        'art-1',
        '___ Buch',
        ['das', 'der', 'die', 'den'],
        'das',
        '„Buch“ je středního rodu, proto v nominativu stojí „das Buch“. „Der“ a „die“ označují jiné rody; „den“ je mužský akuzativ.',
        'rod podstatného jména',
      ),
      choice(
        'art-2',
        'Který člen často patří ke slovům na -ung?',
        ['die', 'der', 'das', 'den'],
        'die',
        'Podstatná jména zakončená na -ung jsou zpravidla ženského rodu.',
        'rod podle koncovky',
      ),
      fill(
        'art-3',
        'Doplň určitý člen.',
        '',
        ' Mädchen lernt Deutsch.',
        ['Das'],
        'Slova na -chen jsou středního rodu.',
        'Zdrobněliny na -chen mají člen „das“: „das Mädchen“.',
        'rod podle koncovky',
      ),
      choice(
        'art-4',
        'Jaký člen má „Schule“?',
        ['die', 'das', 'der', 'den'],
        'die',
        'Správná slovní jednotka je „die Schule“.',
        'slovní zásoba se členem',
      ),
      choice(
        'art-5',
        'Která podoba je množné číslo určitého členu?',
        ['die', 'der', 'das', 'den'],
        'die',
        'V nominativu mají všechna podstatná jména v množném čísle člen „die“.',
        'člen v množném čísle',
      ),
    ],
  },
  {
    id: 'accusative',
    categoryId: 'cases',
    unit: 11,
    title: 'Akuzativ: koho, co?',
    shortTitle: 'Akuzativ',
    subtitle: 'Většina změny se odehraje jen u mužského rodu.',
    cefr: 'A1',
    minutes: 7,
    completionXp: 22,
    concept:
      'Přímý předmět bývá v akuzativu. U určitého členu se mění mužský „der“ na „den“, u neurčitého „ein“ na „einen“. Ostatní rody zůstávají stejné.',
    formula: 'der → den · ein → einen',
    examples: [
      { de: 'Ich sehe den Hund.', cs: 'Vidím psa.' },
      { de: 'Sie kauft eine Tasche.', cs: 'Kupuje tašku.' },
    ],
    questions: [
      fill(
        'akk-1',
        'Doplň člen v akuzativu.',
        'Ich sehe ',
        ' Lehrer.',
        ['den'],
        'Mužský rod, určitý člen.',
        'Přímý předmět „Lehrer“ je v akuzativu, proto „den Lehrer“.',
        'mužský akuzativ',
      ),
      choice(
        'akk-2',
        'Er hat ___ Bruder.',
        ['einen', 'ein', 'einem', 'eine'],
        'einen',
        'Mužský neurčitý člen se v akuzativu mění na „einen“.',
        'neurčitý člen v akuzativu',
      ),
      choice(
        'akk-3',
        'Wir kaufen ___ Lampe.',
        ['eine', 'einen', 'einem', 'der'],
        'eine',
        'Ženský neurčitý člen zůstává v akuzativu „eine“.',
        'ženský akuzativ',
      ),
      order(
        'akk-4',
        'Potřebuji nový počítač.',
        ['einen neuen Computer', 'brauche', 'Ich'],
        ['Ich', 'brauche', 'einen neuen Computer'],
        'Potřebuji nový počítač.',
        '„Computer“ je mužský přímý předmět, proto „einen … Computer“.',
        'akuzativ předmětu',
      ),
      choice(
        'akk-5',
        'Která věta používá správný akuzativ středního rodu?',
        ['Ich lese das Buch.', 'Ich lese dem Buch.', 'Ich lese der Buch.', 'Ich lese den Buch.'],
        'Ich lese das Buch.',
        'Střední člen „das“ se v akuzativu nemění.',
        'střední akuzativ',
      ),
    ],
  },
  {
    id: 'dative',
    categoryId: 'cases',
    unit: 12,
    title: 'Dativ: komu, čemu?',
    shortTitle: 'Dativ',
    subtitle: 'Příjemce, pomoc a několik důležitých předložek.',
    cefr: 'A2',
    minutes: 8,
    completionXp: 24,
    concept:
      'Dativ často označuje příjemce nebo osobu, které něco dáváme, říkáme či pomáháme. Členy jsou dem, der, dem a v množném čísle den.',
    formula: 'dem · der · dem · den (+ často -n)',
    examples: [
      { de: 'Ich helfe meinem Bruder.', cs: 'Pomáhám svému bratrovi.' },
      { de: 'Sie gibt der Lehrerin das Heft.', cs: 'Dává učitelce sešit.' },
    ],
    questions: [
      choice(
        'dat-1',
        'Ich helfe ___ Freund.',
        ['meinem', 'meinen', 'mein', 'meiner'],
        'meinem',
        'Sloveso „helfen“ vyžaduje dativ; mužský tvar je „meinem Freund“.',
        'dativ po helfen',
      ),
      fill(
        'dat-2',
        'Doplň určitý člen.',
        'Wir sprechen mit ',
        ' Lehrerin.',
        ['der'],
        'Předložka mit vždy řídí dativ.',
        'Ženský určitý člen má v dativu tvar „der“.',
        'dativ po mit',
      ),
      choice(
        'dat-3',
        'Er gibt ___ Kind ein Buch.',
        ['dem', 'den', 'das', 'der'],
        'dem',
        'Příjemce „Kind“ je v dativu středního rodu: „dem Kind“.',
        'dativ příjemce',
      ),
      order(
        'dat-4',
        'Píšu své babičce zprávu.',
        ['eine Nachricht', 'meiner Oma', 'Ich', 'schreibe'],
        ['Ich', 'schreibe', 'meiner Oma', 'eine Nachricht'],
        'Píšu své babičce zprávu.',
        'Osoba, které píšeme, je v dativu: „meiner Oma“.',
        'dativ a akuzativ',
      ),
      choice(
        'dat-5',
        'Která předložka vždy vyžaduje dativ?',
        ['mit', 'für', 'ohne', 'durch'],
        'mit',
        '„Mit“ patří mezi předložky, po nichž vždy následuje dativ.',
        'dativní předložky',
      ),
    ],
  },
  {
    id: 'two-way-prepositions',
    categoryId: 'cases',
    unit: 13,
    title: 'Kde, nebo kam?',
    shortTitle: 'Wechselpräpositionen',
    subtitle: 'Stejná předložka, jiný pád podle pohybu a cíle.',
    cefr: 'A2',
    minutes: 8,
    completionXp: 24,
    concept:
      'U předložek jako in, auf, an, unter rozhoduje význam: odpověď na „kde?“ používá dativ, směr nebo změna místa na „kam?“ akuzativ.',
    formula: 'Wo? + dativ · Wohin? + akuzativ',
    examples: [
      { de: 'Das Buch liegt auf dem Tisch.', cs: 'Kniha leží na stole.' },
      { de: 'Ich lege das Buch auf den Tisch.', cs: 'Pokládám knihu na stůl.' },
    ],
    questions: [
      choice(
        'tw-1',
        'Ich gehe in ___ Schule.',
        ['die', 'der', 'den', 'dem'],
        'die',
        'Jde o směr „kam?“, proto akuzativ: „in die Schule“.',
        'směr s akuzativem',
      ),
      fill(
        'tw-2',
        'Doplň člen pro místo.',
        'Ich bin in ',
        ' Schule.',
        ['der'],
        'Odpověď na „kde?“.',
        'Sloveso „bin“ popisuje polohu, tedy otázku „kde?“. Po „in“ proto následuje dativ ženského rodu: „in der Schule“.',
        'místo s dativem',
      ),
      choice(
        'tw-3',
        'Das Handy liegt auf ___ Tisch.',
        ['dem', 'den', 'der', 'das'],
        'dem',
        '„Leží“ popisuje polohu, proto dativ „auf dem Tisch“.',
        'poloha na povrchu',
      ),
      order(
        'tw-4',
        'Věším obraz na zeď.',
        ['an die Wand', 'das Bild', 'Ich', 'hänge'],
        ['Ich', 'hänge', 'das Bild', 'an die Wand'],
        'Věším obraz na zeď.',
        'Obraz mění místo a směřuje „kam?“, proto akuzativ „an die Wand“.',
        'změna místa',
      ),
      choice(
        'tw-5',
        'Která věta popisuje polohu?',
        [
          'Die Katze sitzt unter dem Stuhl.',
          'Die Katze läuft unter den Stuhl.',
          'Ich stelle die Tasche neben den Stuhl.',
          'Wir hängen die Lampe über den Tisch.',
        ],
        'Die Katze sitzt unter dem Stuhl.',
        'Sloveso „sitzt“ popisuje stav na místě; následuje dativ.',
        'rozlišení polohy a směru',
      ),
    ],
  },
  {
    id: 'weil-dass',
    categoryId: 'longer-sentences',
    unit: 14,
    title: 'Weil a dass: sloveso na konec',
    shortTitle: 'Vedlejší věty',
    subtitle: 'Spojka otevře vedlejší větu a určité sloveso ji uzavře.',
    cefr: 'A2',
    minutes: 8,
    completionXp: 25,
    concept:
      'Po podřadicích spojkách „weil“ a „dass“ se určité sloveso přesouvá na konec vedlejší věty. Hlavní věta si zachová své pravidlo.',
    formula: '…, weil/dass + podmět + … + sloveso.',
    examples: [
      { de: 'Ich lerne, weil ich morgen einen Test habe.', cs: 'Učím se, protože mám zítra test.' },
      { de: 'Ich glaube, dass Deutsch interessant ist.', cs: 'Myslím, že němčina je zajímavá.' },
    ],
    questions: [
      order(
        'wd-1',
        'Zůstávám doma, protože jsem nemocná/nemocný.',
        ['weil', 'zu Hause,', 'bin', 'Ich bleibe', 'ich', 'krank'],
        ['Ich bleibe', 'zu Hause,', 'weil', 'ich', 'krank', 'bin'],
        'Zůstávám doma, protože jsem nemocná/nemocný.',
        'Ve vedlejší větě po „weil“ jde určité sloveso „bin“ na konec.',
        'sloveso na konci',
      ),
      fill(
        'wd-2',
        'Doplň spojku vyjadřující důvod.',
        'Ich lerne viel, ',
        ' ich die Prüfung bestehen möchte.',
        ['weil'],
        'Protože.',
        '„Weil“ uvádí důvod a posouvá časované sloveso na konec.',
        'spojka weil',
      ),
      choice(
        'wd-3',
        'Která věta má správný slovosled po spojce „dass“?',
        [
          'Ich weiß, dass er heute kommt.',
          'Ich weiß, dass kommt er heute.',
          'Ich weiß, dass er kommt heute.',
          'Ich weiß, er dass heute kommt.',
        ],
        'Ich weiß, dass er heute kommt.',
        'Po „dass“ stojí podmět a časované sloveso „kommt“ je na konci.',
        'spojka dass',
      ),
      order(
        'wd-4',
        'Myslím, že má čas.',
        ['Zeit', 'Ich denke,', 'hat', 'dass', 'sie'],
        ['Ich denke,', 'dass', 'sie', 'Zeit', 'hat'],
        'Myslím, že má čas.',
        'Ve vedlejší větě uzavírá sloveso „hat“ celý úsek.',
        'vedlejší věta s dass',
      ),
      choice(
        'wd-5',
        'Jak dokončíš větu „Er kommt nicht, weil…“?',
        ['er arbeiten muss.', 'er muss arbeiten.', 'muss er arbeiten.', 'er arbeiten gemusst.'],
        'er arbeiten muss.',
        'U modálního rámce ve vedlejší větě stojí infinitiv před časovaným modálním slovesem na konci.',
        'modální sloveso ve vedlejší větě',
      ),
    ],
  },
  {
    id: 'time-manner-place',
    categoryId: 'longer-sentences',
    unit: 15,
    title: 'Čas – způsob – místo',
    shortTitle: 'Pořadí informací',
    subtitle: 'Přirozený rytmus věty bez memorování každé kombinace zvlášť.',
    cefr: 'A2',
    minutes: 6,
    completionXp: 20,
    concept:
      'Neutrální pořadí příslovečných údajů bývá čas, způsob, místo. Důležitější informaci lze posunout dopředu, ale sloveso zůstává druhé.',
    formula: 'TeKaMoLo: čas → příčina → způsob → místo',
    examples: [
      { de: 'Ich fahre morgen mit dem Bus zur Schule.', cs: 'Zítra jedu autobusem do školy.' },
      { de: 'Am Wochenende lerne ich ruhig zu Hause.', cs: 'O víkendu se v klidu učím doma.' },
    ],
    questions: [
      order(
        'tmp-1',
        'Zítra jedu vlakem do Prahy.',
        ['nach Prag', 'mit dem Zug', 'Morgen', 'fahre', 'ich'],
        ['Morgen', 'fahre', 'ich', 'mit dem Zug', 'nach Prag'],
        'Zítra jedu vlakem do Prahy.',
        'Čas stojí první; po slovese a podmětu následuje způsob „mit dem Zug“ a místo „nach Prag“.',
        'čas-způsob-místo',
      ),
      choice(
        'tmp-2',
        'Která věta má neutrální pořadí?',
        [
          'Ich lerne heute konzentriert in der Bibliothek.',
          'Ich lerne in der Bibliothek heute konzentriert.',
          'Ich konzentriert lerne heute in der Bibliothek.',
          'Ich in der Bibliothek lerne konzentriert heute.',
        ],
        'Ich lerne heute konzentriert in der Bibliothek.',
        'Po slovese následuje čas, způsob a místo.',
        'TeKaMoLo',
      ),
      fill(
        'tmp-3',
        'Doplň dopravní prostředek.',
        'Wir fahren am Montag ',
        ' nach Wien.',
        ['mit dem Bus'],
        'Způsob dopravy stojí před cílem.',
        'Neutrálně řadíme čas „am Montag“, způsob „mit dem Bus“ a místo „nach Wien“.',
        'způsob před místem',
      ),
      order(
        'tmp-4',
        'Po škole se rychle vracím domů.',
        ['schnell', 'Nach der Schule', 'nach Hause', 'komme', 'ich'],
        ['Nach der Schule', 'komme', 'ich', 'schnell', 'nach Hause'],
        'Po škole se rychle vracím domů.',
        'Časový údaj je první, sloveso druhé, potom způsob a místo.',
        'inverze a pořadí údajů',
      ),
      choice(
        'tmp-5',
        'Co obvykle stojí dřív?',
        ['čas před místem', 'místo před časem', 'sloveso vždy na konci', 'podmět vždy první'],
        'čas před místem',
        'V neutrální větě obvykle uvádíme čas dříve než místo.',
        'neutrální pořadí',
      ),
    ],
  },
  {
    id: 'comparison',
    categoryId: 'longer-sentences',
    unit: 16,
    title: 'Stupňování bez zbytečných výjimek',
    shortTitle: 'Větší, nejlepší',
    subtitle: 'Komparativ s -er, superlativ s am …-sten a několik důležitých tvarů.',
    cefr: 'A2',
    minutes: 7,
    completionXp: 22,
    concept:
      'Komparativ často přidává -er a srovnává pomocí „als“. Příslovečný superlativ má podobu „am …-sten“. Některá častá slova jsou nepravidelná.',
    formula: 'schnell → schneller als → am schnellsten',
    examples: [
      { de: 'Deutsch ist leichter als gestern.', cs: 'Němčina je lehčí než včera.' },
      { de: 'Sie lernt am schnellsten.', cs: 'Učí se nejrychleji.' },
    ],
    questions: [
      choice(
        'cmp-1',
        'Mein Bruder ist ___ als ich.',
        ['größer', 'groß', 'am größten', 'mehr groß'],
        'größer',
        'Komparativ od „groß“ je „größer“ a srovnání uvádí „als“.',
        'komparativ',
      ),
      fill(
        'cmp-2',
        'Doplň superlativ.',
        'Anna läuft ',
        '.',
        ['am schnellsten'],
        'Nejrychleji.',
        'Příslovečný superlativ tvoříme pomocí „am schnellsten“.',
        'superlativ',
      ),
      choice(
        'cmp-3',
        'Jaký je komparativ od „gut“?',
        ['besser', 'guter', 'mehr gut', 'am besten'],
        'besser',
        '„Gut“ má nepravidelný komparativ „besser“.',
        'nepravidelné stupňování',
      ),
      order(
        'cmp-4',
        'Tento úkol je jednodušší než ten test.',
        ['als der Test', 'ist', 'Diese Aufgabe', 'einfacher'],
        ['Diese Aufgabe', 'ist', 'einfacher', 'als der Test'],
        'Tento úkol je jednodušší než ten test.',
        'Srovnávaný druhý člen uvádíme pomocí „als“.',
        'srovnání s als',
      ),
      choice(
        'cmp-5',
        'Která věta správně porovnává dnešek se včerejškem?',
        [
          'Heute bin ich müder als gestern.',
          'Heute bin ich mehr müde wie gestern.',
          'Heute ich bin müder als gestern.',
          'Heute bin ich am müder als gestern.',
        ],
        'Heute bin ich müder als gestern.',
        'Komparativ „müder“, spojka „als“ a sloveso na druhé pozici tvoří správnou větu.',
        'komparativ ve větě',
      ),
    ],
  },
  {
    id: 'adjective-endings',
    categoryId: 'longer-sentences',
    unit: 17,
    title: 'Koncovky přídavných jmen: první mapa',
    shortTitle: 'Přídavná jména',
    subtitle: 'Ne celá tabulka najednou — nejdřív nejčastější vzorce v nominativu a akuzativu.',
    cefr: 'A2',
    minutes: 8,
    completionXp: 25,
    concept:
      'Po určitém členu nese většinu informace člen, proto má přídavné jméno často -e nebo -en. V množném čísle po „die“ je běžné -en.',
    formula: 'der neue Film · die neue Schule · das neue Buch · den neuen Film',
    examples: [
      { de: 'Das neue Buch ist interessant.', cs: 'Ta nová kniha je zajímavá.' },
      { de: 'Ich sehe den neuen Film.', cs: 'Vidím ten nový film.' },
    ],
    questions: [
      choice(
        'adj-1',
        'der ___ Hund',
        ['kleine', 'kleinen', 'kleiner', 'kleines'],
        'kleine',
        'V nominativu mužského rodu po „der“ má přídavné jméno koncovku -e.',
        'nominativ po určitém členu',
      ),
      fill(
        'adj-2',
        'Doplň koncovku.',
        'Ich lese das neu',
        ' Buch.',
        ['e'],
        'Střední rod po určitém členu das.',
        'Po „das“ v nominativu/akuzativu používáme „neue“.',
        'střední rod po das',
      ),
      choice(
        'adj-3',
        'Ich sehe den ___ Lehrer.',
        ['neuen', 'neue', 'neuer', 'neues'],
        'neuen',
        'Po „den“ v mužském akuzativu má přídavné jméno koncovku -en.',
        'mužský akuzativ',
      ),
      choice(
        'adj-4',
        'die ___ Bücher',
        ['interessanten', 'interessante', 'interessanter', 'interessantes'],
        'interessanten',
        'V množném čísle po určitém členu „die“ používáme koncovku -en.',
        'množné číslo',
      ),
      order(
        'adj-5',
        'Kupuje si červenou tašku.',
        ['eine rote Tasche', 'Sie', 'kauft'],
        ['Sie', 'kauft', 'eine rote Tasche'],
        'Kupuje si červenou tašku.',
        'Po „eine“ v ženském akuzativu má přídavné jméno koncovku -e: „rote“.',
        'ženský akuzativ',
      ),
    ],
  },
  {
    id: 'mixed-checkpoint',
    categoryId: 'longer-sentences',
    unit: 18,
    title: 'Checkpoint: věta pod kontrolou',
    shortTitle: 'Smíšený checkpoint',
    subtitle: 'Krátký mix nejdůležitějších vzorců před další úrovní.',
    cefr: 'A2',
    minutes: 8,
    completionXp: 30,
    concept:
      'Teď nejde o nové pravidlo. Propojíš slovosled, pád, minulost a vedlejší větu tak, jak se objevují v reálné komunikaci.',
    formula: 'rozpoznat význam → zvolit kostru → doplnit správný tvar',
    examples: [
      {
        de: 'Gestern habe ich meiner Freundin geholfen.',
        cs: 'Včera jsem pomohla kamarádce.',
      },
      {
        de: 'Ich bleibe zu Hause, weil ich lernen muss.',
        cs: 'Zůstávám doma, protože se musím učit.',
      },
    ],
    questions: [
      order(
        'mix-1',
        'Včera jsem jel autobusem do školy.',
        ['mit dem Bus', 'zur Schule', 'Gestern', 'bin', 'ich', 'gefahren'],
        ['Gestern', 'bin', 'ich', 'mit dem Bus', 'zur Schule', 'gefahren'],
        'Včera jsem jel autobusem do školy.',
        'Čas je první, pomocné „bin“ druhé, způsob před místem a příčestí na konci.',
        'kombinovaný slovosled',
      ),
      choice(
        'mix-2',
        'Ich helfe ___ neuen Schüler.',
        ['dem', 'den', 'der', 'das'],
        'dem',
        '„Helfen“ vyžaduje dativ; mužský určitý člen je „dem“ a přídavné jméno má -en.',
        'dativ',
      ),
      fill(
        'mix-3',
        'Dokonči vedlejší větu.',
        'Sie kommt nicht, weil sie krank ',
        '.',
        ['ist'],
        'Sloveso sein patří na konec.',
        'Po „weil“ stojí určité sloveso „ist“ na konci vedlejší věty.',
        'vedlejší věta',
      ),
      choice(
        'mix-4',
        'Která věta správně spojuje úvodní časový údaj s modálním slovesem?',
        [
          'Morgen muss ich früh aufstehen.',
          'Morgen ich muss früh aufstehen.',
          'Morgen muss früh ich aufstehen.',
          'Morgen muss ich stehe früh auf.',
        ],
        'Morgen muss ich früh aufstehen.',
        'Po „Morgen“ následuje časované modální sloveso a infinitiv zůstává pohromadě na konci.',
        'modální sloveso a inverze',
      ),
      order(
        'mix-5',
        'Myslím, že ten nový film je lepší.',
        ['der neue Film', 'besser', 'Ich glaube,', 'ist', 'dass'],
        ['Ich glaube,', 'dass', 'der neue Film', 'besser', 'ist'],
        'Myslím, že ten nový film je lepší.',
        'Po „dass“ jde sloveso „ist“ na konec; „der neue Film“ je podmět.',
        'vedlejší věta a přídavné jméno',
      ),
    ],
  },
  ...advancedGrammarLessons,
  ...expansionGrammarLessons,
  ...additionalGrammarLessons,
  ...supplementalGrammarLessons,
  ...nextGrammarLessons,
];

const grammarLessonsById = new Map(grammarLessons.map((lesson) => [lesson.id, lesson]));

export function grammarLessonById(id: string): GrammarLesson | undefined {
  return grammarLessonsById.get(id);
}

export function grammarLevelForLesson(lesson: Pick<GrammarLesson, 'unit'>): DetailedCefrLevel {
  if ([1, 2, 5, 10].includes(lesson.unit)) return 'A1.1';
  if ([3, 4, 6, 11].includes(lesson.unit)) return 'A1.2';
  if ([7, 8, 9, 12, 13].includes(lesson.unit)) return 'A2.1';
  if (lesson.unit >= 14 && lesson.unit <= 18) return 'A2.2';
  if (lesson.unit >= 19 && lesson.unit <= 21) return 'B1.1';
  if (lesson.unit >= 22 && lesson.unit <= 23) return 'B1.2';
  if (lesson.unit >= 24 && lesson.unit <= 26) return 'B2.1';
  if (lesson.unit >= 27 && lesson.unit <= 29) return 'B2.2';
  if (lesson.unit >= 30 && lesson.unit <= 32) return 'C1.1';
  if (lesson.unit >= 33 && lesson.unit <= 35) return 'C1.2';
  if (lesson.unit >= 36 && lesson.unit <= 40) return 'A1.1';
  if (lesson.unit >= 41 && lesson.unit <= 45) return 'A1.2';
  if (lesson.unit >= 46 && lesson.unit <= 51) return 'A2.1';
  if (lesson.unit >= 52 && lesson.unit <= 57) return 'A2.2';
  if (lesson.unit >= 58 && lesson.unit <= 62) return 'B1.1';
  if (lesson.unit >= 63 && lesson.unit <= 67) return 'B1.2';
  if (lesson.unit >= 68 && lesson.unit <= 72) return 'B2.1';
  if (lesson.unit >= 73 && lesson.unit <= 77) return 'B2.2';
  if (lesson.unit >= 78 && lesson.unit <= 81) return 'C1.1';
  if (lesson.unit >= 82 && lesson.unit <= 85) return 'C1.2';
  if (lesson.unit >= 86 && lesson.unit <= 87) return 'A1.1';
  if (lesson.unit >= 88 && lesson.unit <= 89) return 'A1.2';
  if (lesson.unit >= 90 && lesson.unit <= 91) return 'A2.1';
  if (lesson.unit >= 92 && lesson.unit <= 93) return 'A2.2';
  if (lesson.unit >= 94 && lesson.unit <= 95) return 'B1.1';
  if (lesson.unit >= 96 && lesson.unit <= 97) return 'B1.2';
  if (lesson.unit >= 98 && lesson.unit <= 99) return 'B2.1';
  if (lesson.unit >= 100 && lesson.unit <= 101) return 'B2.2';
  if (lesson.unit >= 102 && lesson.unit <= 103) return 'C1.1';
  if (lesson.unit >= 104 && lesson.unit <= 105) return 'C1.2';
  if (lesson.unit === 106) return 'A1.1';
  if (lesson.unit === 107) return 'A2.1';
  if (lesson.unit === 108) return 'B1.1';
  if (lesson.unit === 109) return 'B2.1';
  if (lesson.unit === 110) return 'C1.1';
  if (lesson.unit === 111) return 'A1.1';
  if (lesson.unit >= 112 && lesson.unit <= 113) return 'A1.2';
  if (lesson.unit >= 114 && lesson.unit <= 115) return 'A2.1';
  if (lesson.unit === 116) return 'A2.2';
  if (lesson.unit >= 117 && lesson.unit <= 118) return 'B1.1';
  if (lesson.unit === 119) return 'B1.2';
  if (lesson.unit === 120) return 'B2.1';
  if (lesson.unit >= 121 && lesson.unit <= 122) return 'B2.2';
  if (lesson.unit === 123) return 'C1.1';
  if (lesson.unit >= 124 && lesson.unit <= 125) return 'C1.2';
  throw new Error(`Lekce ${lesson.unit} nemá přiřazenou podrobnou úroveň.`);
}

export function grammarLessonsForLevel(minimumLevel: DetailedCefrLevel): GrammarLesson[] {
  const minimumRank = detailedCefrRank(minimumLevel);
  const ranked: Array<{ lesson: GrammarLesson; levelRank: number }> = [];
  for (const lesson of grammarLessons) {
    const levelRank = detailedCefrRank(grammarLevelForLesson(lesson));
    if (levelRank >= minimumRank) ranked.push({ lesson, levelRank });
  }
  ranked.sort(
    (left, right) => left.levelRank - right.levelRank || left.lesson.unit - right.lesson.unit,
  );
  return ranked.map(({ lesson }) => lesson);
}

export function lessonsForCategory(
  categoryId: string,
  lessons: GrammarLesson[] = grammarLessons,
): GrammarLesson[] {
  return lessons.filter((lesson) => lesson.categoryId === categoryId);
}

const eventsByLessonCache = new WeakMap<CourseAnswerEvent[], Map<string, CourseAnswerEvent[]>>();

function eventsByLesson(events: CourseAnswerEvent[]): Map<string, CourseAnswerEvent[]> {
  const cached = eventsByLessonCache.get(events);
  if (cached) return cached;
  const indexed = new Map<string, CourseAnswerEvent[]>();
  for (const event of events) {
    const lessonEvents = indexed.get(event.lessonId) ?? [];
    lessonEvents.push(event);
    indexed.set(event.lessonId, lessonEvents);
  }
  eventsByLessonCache.set(events, indexed);
  return indexed;
}

function progressFromEvents(
  progress: CourseProgress,
  lesson: GrammarLesson,
  events: CourseAnswerEvent[],
): GrammarLessonProgress {
  const correctIds = new Set<string>();
  const answeredIds = new Set<string>();
  const firstResults = new Map<string, boolean>();
  let xp = 0;
  let lastStudiedAt: string | undefined;
  for (const event of events) {
    answeredIds.add(event.questionId);
    if (event.correct) correctIds.add(event.questionId);
    if (!firstResults.has(event.questionId)) firstResults.set(event.questionId, event.correct);
    xp += event.xpAwarded;
    if (!lastStudiedAt || event.answeredAt.localeCompare(lastStudiedAt) > 0) {
      lastStudiedAt = event.answeredAt;
    }
  }

  let correct = 0;
  let firstTryCorrect = 0;
  for (const question of lesson.questions) {
    if (correctIds.has(question.id)) correct += 1;
    if (firstResults.get(question.id) === true) firstTryCorrect += 1;
  }
  const total = lesson.questions.length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);
  const completed = total > 0 && correct === total;
  const firstCompletionStars: 0 | 1 | 2 | 3 = !completed
    ? 0
    : firstTryCorrect === total
      ? 3
      : firstTryCorrect >= Math.ceil(total * 0.6)
        ? 2
        : 1;
  const stars = completed
    ? (Math.max(firstCompletionStars, progress.lessonBestStars[lesson.id] ?? 0) as 1 | 2 | 3)
    : 0;
  return {
    lessonId: lesson.id,
    answered: answeredIds.size,
    correct,
    total,
    percent,
    completed,
    stars,
    attempts: events.length,
    xp,
    lastStudiedAt,
  };
}

export function lessonProgress(
  progress: CourseProgress,
  lesson: GrammarLesson,
): GrammarLessonProgress {
  return progressFromEvents(progress, lesson, eventsByLesson(progress.events).get(lesson.id) ?? []);
}

export function courseSummaryForLessons(
  progress: CourseProgress,
  lessons: GrammarLesson[],
  now = new Date(),
): CourseSummary {
  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  let completedLessons = 0;
  let totalQuestions = 0;
  let completedQuestions = 0;
  for (const lesson of lessons) {
    const state = lessonProgress(progress, lesson);
    if (state.completed) completedLessons += 1;
    totalQuestions += state.total;
    completedQuestions += state.correct;
  }
  const todayKey = localDateKey(now);
  let grammarXp = 0;
  let todayAnswers = 0;
  let todayXp = 0;
  for (const event of progress.events) {
    if (!lessonIds.has(event.lessonId)) continue;
    grammarXp += event.xpAwarded;
    if (localDateKey(new Date(event.answeredAt)) === todayKey) {
      todayAnswers += 1;
      todayXp += event.xpAwarded;
    }
  }
  return {
    completedLessons,
    totalLessons: lessons.length,
    completedQuestions,
    totalQuestions,
    percent: totalQuestions === 0 ? 0 : Math.round((completedQuestions / totalQuestions) * 100),
    grammarXp,
    todayAnswers,
    todayXp,
  };
}

export function courseSummary(progress: CourseProgress, now = new Date()): CourseSummary {
  return courseSummaryForLessons(progress, grammarLessons, now);
}

export function recommendedGrammarLesson(
  progress: CourseProgress,
  lessons: GrammarLesson[] = grammarLessons,
): GrammarLesson {
  let firstIncomplete: GrammarLesson | undefined;
  for (const lesson of lessons) {
    const state = lessonProgress(progress, lesson);
    if (state.answered > 0 && !state.completed) return lesson;
    if (!state.completed && !firstIncomplete) firstIncomplete = lesson;
  }
  return firstIncomplete ?? lessons.at(-1) ?? grammarLessons.at(-1)!;
}

export function recordCourseAnswer(
  progress: CourseProgress,
  input: RecordCourseAnswerInput,
): RecordCourseAnswerResult {
  const lesson = grammarLessonById(input.lessonId);
  const question = lesson?.questions.find((candidate) => candidate.id === input.questionId);
  if (!lesson || !question) throw new Error('Tahle gramatická otázka už v kurzu není.');

  const lessonEvents = eventsByLesson(progress.events).get(input.lessonId) ?? [];
  const before = progressFromEvents(progress, lesson, lessonEvents);
  const previousEvents = lessonEvents.filter((event) => event.questionId === input.questionId);
  const alreadyCorrect = previousEvents.some((event) => event.correct);
  const firstTry = previousEvents.length === 0;
  const now = input.now ?? new Date();
  const todayKey = localDateKey(now);
  const alreadyCorrectToday = previousEvents.some(
    (event) => event.correct && localDateKey(new Date(event.answeredAt)) === todayKey,
  );
  let xpAwarded = alreadyCorrect
    ? input.correct && !alreadyCorrectToday
      ? 3
      : 0
    : input.correct
      ? firstTry
        ? 12
        : 8
      : firstTry
        ? 2
        : 0;

  const baseEvent: CourseAnswerEvent = {
    id: createId('course'),
    lessonId: input.lessonId,
    questionId: input.questionId,
    answeredAt: now.toISOString(),
    correct: input.correct,
    firstTry,
    xpAwarded,
    responseMs: Math.min(3_600_000, Math.max(0, Math.round(input.responseMs))),
  };
  const after = progressFromEvents(progress, lesson, [...lessonEvents, baseEvent]);
  const lessonCompletedNow = !before.completed && after.completed;
  if (lessonCompletedNow) xpAwarded += lesson.completionXp;

  const event = { ...baseEvent, xpAwarded };
  return {
    progress: {
      ...progress,
      events: [...progress.events, event],
      updatedAt: now.toISOString(),
    },
    event,
    lessonCompletedNow,
    xpAwarded,
  };
}

function starsForCompletedRun(correctFirstTry: number, total: number): 1 | 2 | 3 {
  if (correctFirstTry >= total) return 3;
  if (correctFirstTry >= Math.ceil(total * 0.6)) return 2;
  return 1;
}

export function recordLessonRun(
  progress: CourseProgress,
  input: RecordLessonRunInput,
): RecordLessonRunResult {
  const lesson = grammarLessonById(input.lessonId);
  if (!lesson) throw new Error('Tahle gramatická lekce už v kurzu není.');
  if (input.total !== lesson.questions.length || input.total <= 0) {
    throw new Error('Výsledek lekce není kompletní.');
  }
  const correctFirstTry = Math.min(input.total, Math.max(0, Math.round(input.correctFirstTry)));
  const stars = starsForCompletedRun(correctFirstTry, input.total);
  const previousBest = lessonProgress(progress, lesson).stars;
  const improved = stars > previousBest;
  if (!improved) return { progress, stars, previousBest, improved };

  const now = input.now ?? new Date();
  return {
    stars,
    previousBest,
    improved,
    progress: {
      ...progress,
      lessonBestStars: { ...progress.lessonBestStars, [input.lessonId]: stars },
      updatedAt: now.toISOString(),
    },
  };
}

export function nextGrammarQuestion(
  lesson: GrammarLesson,
  progress: CourseProgress,
): GrammarQuestion {
  const correctIds = new Set<string>();
  for (const event of eventsByLesson(progress.events).get(lesson.id) ?? []) {
    if (event.correct) correctIds.add(event.questionId);
  }
  return lesson.questions.find((question) => !correctIds.has(question.id)) ?? lesson.questions[0];
}
