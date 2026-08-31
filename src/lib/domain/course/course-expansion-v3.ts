import { coachScenarioById } from './coach.ts';
import { createWordOrderTrap } from './course-model-traps.ts';
import { transferChapterThreads } from './course-transfer-threads.ts';
import type { CourseChapterDefinition, CourseModelSentence, CourseWord } from './path.ts';

type ChapterFocus = {
  id: string;
  titleCs: string;
  titleEn: string;
  goalCs: string;
  goalEn: string;
};

type ExpandedChapterBlueprint = {
  sourceChapterId: string;
  variationIndex: number;
} & ChapterFocus;

export type ExpandedChapterEnglishCopy = {
  title: string;
  subtitle: string;
  mission: string;
  outcomes: [string, string, string];
};

function series(sourceChapterId: string, focuses: ChapterFocus[]): ExpandedChapterBlueprint[] {
  return focuses.map((focus, index) => ({
    ...focus,
    sourceChapterId,
    variationIndex: index,
  }));
}

const expandedChapterBlueprints: ExpandedChapterBlueprint[] = [
  ...series('chapter-01-school', [
    {
      id: 'chapter-31-first-introduction',
      titleCs: 'Pozdrav a první představení',
      titleEn: 'A greeting and first introduction',
      goalCs: 'představit se a říct, co se právě učíš',
      goalEn: 'introduce yourself and say what you are currently learning',
    },
  ]),
  ...series('chapter-11-classroom', [
    {
      id: 'chapter-32-find-the-right-page',
      titleCs: 'Najdi správnou stránku',
      titleEn: 'Find the right page',
      goalCs: 'porozumět krátkému pokynu a provést ho ve správném pořadí',
      goalEn: 'understand a short instruction and carry it out in the right order',
    },
    {
      id: 'chapter-33-ask-for-repetition',
      titleCs: 'Požádej o zopakování',
      titleEn: 'Ask for repetition',
      goalCs: 'požádat o pomalejší zopakování a ověřit jedno nejasné slovo',
      goalEn: 'ask for slower repetition and check one unclear word',
    },
  ]),
  ...series('chapter-12-cafe-bakery', [
    {
      id: 'chapter-34-simple-order',
      titleCs: 'Jednoduchá objednávka',
      titleEn: 'A simple order',
      goalCs: 'objednat nápoj a jednu položku zdvořilou celou větou',
      goalEn: 'order a drink and one item in a complete polite sentence',
    },
    {
      id: 'chapter-35-price-and-payment',
      titleCs: 'Cena a placení',
      titleEn: 'Price and payment',
      goalCs: 'zjistit cenu a domluvit hotovost nebo platbu kartou',
      goalEn: 'find out the price and arrange cash or card payment',
    },
    {
      id: 'chapter-36-takeaway-order',
      titleCs: 'Objednávka s sebou',
      titleEn: 'A takeaway order',
      goalCs: 'upřesnit množství a říct, že si objednávku bereš s sebou',
      goalEn: 'specify the quantity and say that you want the order to take away',
    },
    {
      id: 'chapter-37-repair-the-order',
      titleCs: 'Oprav nedorozumění',
      titleEn: 'Repair a misunderstanding',
      goalCs: 'opravit chybnou položku a znovu potvrdit celou objednávku',
      goalEn: 'correct a wrong item and confirm the full order again',
    },
  ]),
  ...series('chapter-02-day', [
    {
      id: 'chapter-38-morning-time',
      titleCs: 'Ráno krok za krokem',
      titleEn: 'Morning step by step',
      goalCs: 'popsat tři ranní činnosti a přidat ke každé konkrétní čas',
      goalEn: 'describe three morning activities and add a specific time to each one',
    },
  ]),
  ...series('chapter-13-home-family', [
    {
      id: 'chapter-39-who-lives-here',
      titleCs: 'Kdo bydlí doma',
      titleEn: 'Who lives here',
      goalCs: 'představit členy domácnosti a popsat, kde kdo bydlí',
      goalEn: 'introduce the members of a household and say where each person lives',
    },
    {
      id: 'chapter-40-whose-is-it',
      titleCs: 'Čí je to',
      titleEn: 'Whose is it',
      goalCs: 'vyjádřit vlastnictví a rozlišit moje, tvoje a společné věci',
      goalEn: 'express ownership and distinguish between mine, yours, and shared things',
    },
    {
      id: 'chapter-41-evening-together',
      titleCs: 'Společný večer',
      titleEn: 'An evening together',
      goalCs: 'domluvit jednu společnou domácí činnost a její čas',
      goalEn: 'arrange one shared household activity and its time',
    },
  ]),
  ...series('chapter-14-city', [
    {
      id: 'chapter-42-route-to-destination',
      titleCs: 'Cesta k cíli',
      titleEn: 'The route to your destination',
      goalCs: 'popsat krátkou pěší trasu pomocí tří navazujících pokynů',
      goalEn: 'describe a short walking route with three connected instructions',
    },
    {
      id: 'chapter-43-right-stop',
      titleCs: 'Správná zastávka',
      titleEn: 'The right stop',
      goalCs: 'ověřit správnou zastávku a směr městské dopravy',
      goalEn: 'check the correct stop and direction of public transport',
    },
    {
      id: 'chapter-44-transfer-in-town',
      titleCs: 'Přestup ve městě',
      titleEn: 'Changing in town',
      goalCs: 'zeptat se na přestup a potvrdit další spoj až do cíle',
      goalEn: 'ask about a transfer and confirm the next connection to the destination',
    },
  ]),
  ...series('chapter-03-travel', [
    {
      id: 'chapter-45-ticket-and-departure',
      titleCs: 'Jízdenka a odjezd',
      titleEn: 'Ticket and departure',
      goalCs: 'koupit správnou jízdenku a ověřit čas i kolej odjezdu',
      goalEn: 'buy the right ticket and check both the departure time and platform',
    },
  ]),
  ...series('chapter-15-hotel', [
    {
      id: 'chapter-46-confirm-reservation',
      titleCs: 'Potvrď rezervaci',
      titleEn: 'Confirm the reservation',
      goalCs: 'potvrdit jméno, termín a typ pokoje při příjezdu',
      goalEn: 'confirm the name, dates, and room type on arrival',
    },
    {
      id: 'chapter-47-room-problem',
      titleCs: 'Problém na pokoji',
      titleEn: 'A problem with the room',
      goalCs: 'popsat konkrétní závadu a zdvořile požádat o řešení',
      goalEn: 'describe a specific fault and politely ask for a solution',
    },
  ]),
  ...series('chapter-16-health', [
    {
      id: 'chapter-48-describe-symptoms',
      titleCs: 'Popiš příznaky',
      titleEn: 'Describe the symptoms',
      goalCs: 'popsat místo, intenzitu a délku zdravotního problému',
      goalEn: 'describe the location, intensity, and duration of a health problem',
    },
    {
      id: 'chapter-49-at-the-pharmacy',
      titleCs: 'V lékárně',
      titleEn: 'At the pharmacy',
      goalCs: 'požádat o vhodný přípravek a uvést důležitou alergii',
      goalEn: 'ask for a suitable medicine and mention an important allergy',
    },
    {
      id: 'chapter-50-safe-dosage',
      titleCs: 'Bezpečné dávkování',
      titleEn: 'Safe dosage',
      goalCs: 'ověřit dávku, četnost a správný způsob užívání léku',
      goalEn: 'check the dose, frequency, and correct way to take a medicine',
    },
    {
      id: 'chapter-51-when-to-see-doctor',
      titleCs: 'Kdy vyhledat lékaře',
      titleEn: 'When to see a doctor',
      goalCs: 'shrnout stav a domluvit další bezpečný krok s odbornou pomocí',
      goalEn: 'summarise the condition and arrange the next safe step with professional help',
    },
  ]),
  ...series('chapter-04-plans', [
    {
      id: 'chapter-52-suggest-a-time',
      titleCs: 'Navrhni termín',
      titleEn: 'Suggest a time',
      goalCs: 'navrhnout termín, stručně ho zdůvodnit a získat potvrzení',
      goalEn: 'suggest a time, give a brief reason, and get confirmation',
    },
  ]),
  ...series('chapter-17-shopping-returns', [
    {
      id: 'chapter-53-compare-two-options',
      titleCs: 'Porovnej dvě možnosti',
      titleEn: 'Compare two options',
      goalCs: 'porovnat cenu, kvalitu a vhodnost dvou výrobků',
      goalEn: 'compare the price, quality, and suitability of two products',
    },
    {
      id: 'chapter-54-describe-a-defect',
      titleCs: 'Popiš vadu',
      titleEn: 'Describe a defect',
      goalCs: 'popsat konkrétní vadu a doložit, kdy se problém objevil',
      goalEn: 'describe a specific defect and state when the problem appeared',
    },
    {
      id: 'chapter-55-request-a-remedy',
      titleCs: 'Požádej o nápravu',
      titleEn: 'Request a remedy',
      goalCs: 'požádat o výměnu nebo vrácení peněz a potvrdit podmínky',
      goalEn: 'ask for an exchange or refund and confirm the conditions',
    },
  ]),
  ...series('chapter-18-housing-neighbors', [
    {
      id: 'chapter-56-flat-viewing',
      titleCs: 'Prohlídka bytu',
      titleEn: 'A flat viewing',
      goalCs: 'ověřit polohu, vybavení a dvě důležité podmínky bydlení',
      goalEn: 'check the location, facilities, and two important housing conditions',
    },
    {
      id: 'chapter-57-neighbour-agreement',
      titleCs: 'Domluva se sousedem',
      titleEn: 'An agreement with a neighbour',
      goalCs: 'pojmenovat problém a domluvit praktické pravidlo soužití',
      goalEn: 'name the problem and agree on a practical rule for living together',
    },
    {
      id: 'chapter-58-house-rules',
      titleCs: 'Pravidla domu',
      titleEn: 'House rules',
      goalCs: 'vysvětlit jedno pravidlo domu a zdvořile vyjednat výjimku',
      goalEn: 'explain one house rule and politely negotiate an exception',
    },
  ]),
  ...series('chapter-19-study-goals', [
    {
      id: 'chapter-59-measurable-study-goal',
      titleCs: 'Měřitelný studijní cíl',
      titleEn: 'A measurable study goal',
      goalCs: 'formulovat konkrétní cíl s termínem a měřitelným výsledkem',
      goalEn: 'formulate a concrete goal with a deadline and measurable result',
    },
    {
      id: 'chapter-60-weekly-study-plan',
      titleCs: 'Týdenní plán učení',
      titleEn: 'A weekly study plan',
      goalCs: 'rozdělit studijní úkoly do realistického týdenního plánu',
      goalEn: 'divide study tasks into a realistic weekly plan',
    },
    {
      id: 'chapter-61-learning-obstacle',
      titleCs: 'Překážka při učení',
      titleEn: 'A learning obstacle',
      goalCs: 'popsat překážku a navrhnout jeden proveditelný způsob nápravy',
      goalEn: 'describe an obstacle and suggest one workable remedy',
    },
    {
      id: 'chapter-62-review-progress',
      titleCs: 'Vyhodnoť pokrok',
      titleEn: 'Review your progress',
      goalCs: 'porovnat plán se skutečným výsledkem a upravit další krok',
      goalEn: 'compare the plan with the actual result and adjust the next step',
    },
  ]),
  ...series('chapter-20-work-experience', [
    {
      id: 'chapter-63-practical-example',
      titleCs: 'Příklad z praxe',
      titleEn: 'A practical example',
      goalCs: 'popsat pracovní situaci, vlastní odpovědnost a výsledek',
      goalEn: 'describe a work situation, your responsibility, and the result',
    },
    {
      id: 'chapter-64-report-an-absence',
      titleCs: 'Oznam absenci',
      titleEn: 'Report an absence',
      goalCs: 'včas oznámit absenci a předat nutné informace o zastoupení',
      goalEn: 'report an absence promptly and pass on the necessary cover information',
    },
  ]),
  ...series('chapter-05-home-work', [
    {
      id: 'chapter-65-home-service-case',
      titleCs: 'Servisní problém doma',
      titleEn: 'A home service issue',
      goalCs: 'popsat závadu, uvést relevantní detail a navrhnout termín opravy',
      goalEn: 'describe a fault, add a relevant detail, and suggest a repair date',
    },
  ]),
  ...series('chapter-21-narrative-news', [
    {
      id: 'chapter-66-order-events',
      titleCs: 'Seřaď události',
      titleEn: 'Put events in order',
      goalCs: 'vyprávět tři události v jasném chronologickém pořadí',
      goalEn: 'tell three events in a clear chronological order',
    },
    {
      id: 'chapter-67-earlier-event',
      titleCs: 'Dřívější děj',
      titleEn: 'The earlier event',
      goalCs: 'odlišit dřívější událost od pozdějšího následku',
      goalEn: 'distinguish an earlier event from its later consequence',
    },
    {
      id: 'chapter-68-brief-report',
      titleCs: 'Stručná zpráva',
      titleEn: 'A concise report',
      goalCs: 'shrnout průběh události bez nejasných časových skoků',
      goalEn: 'summarise an event without unclear jumps in time',
    },
  ]),
  ...series('chapter-06-process', [
    {
      id: 'chapter-69-explain-a-process',
      titleCs: 'Vysvětli proces',
      titleEn: 'Explain a process',
      goalCs: 'popsat tři kroky procesu a určit odpovědnost za výsledek',
      goalEn: 'describe three process steps and identify responsibility for the result',
    },
  ]),
  ...series('chapter-22-opinion-compromise', [
    {
      id: 'chapter-70-opinion-with-reason',
      titleCs: 'Názor s důvodem',
      titleEn: 'An opinion with a reason',
      goalCs: 'vyjádřit jasný názor a podpořit ho jedním konkrétním důvodem',
      goalEn: 'state a clear opinion and support it with one specific reason',
    },
    {
      id: 'chapter-71-acknowledge-objection',
      titleCs: 'Uznej námitku',
      titleEn: 'Acknowledge an objection',
      goalCs: 'uznat platnou námitku a současně zachovat vlastní prioritu',
      goalEn: 'acknowledge a valid objection while maintaining your own priority',
    },
    {
      id: 'chapter-72-propose-compromise',
      titleCs: 'Navrhni kompromis',
      titleEn: 'Propose a compromise',
      goalCs: 'navrhnout podmíněný kompromis přijatelný pro obě strany',
      goalEn: 'propose a conditional compromise that works for both sides',
    },
  ]),
  ...series('chapter-07-project', [
    {
      id: 'chapter-73-compare-project-options',
      titleCs: 'Porovnej varianty projektu',
      titleEn: 'Compare project options',
      goalCs: 'porovnat dvě varianty a pojmenovat jejich hlavní dopady',
      goalEn: 'compare two options and identify their main impacts',
    },
  ]),
  ...series('chapter-23-feedback-conflict', [
    {
      id: 'chapter-74-specific-feedback',
      titleCs: 'Konkrétní zpětná vazba',
      titleEn: 'Specific feedback',
      goalCs: 'oddělit pozorování od hodnocení a uvést ověřitelný příklad',
      goalEn: 'separate observation from judgement and give a verifiable example',
    },
    {
      id: 'chapter-75-calm-the-conflict',
      titleCs: 'Uklidni konflikt',
      titleEn: 'Calm the conflict',
      goalCs: 'zmírnit příliš ostré tvrzení a potvrdit konkrétní další krok',
      goalEn: 'soften an overly harsh statement and confirm a concrete next step',
    },
  ]),
  ...series('chapter-24-remote-work', [
    {
      id: 'chapter-76-remote-work-pilot',
      titleCs: 'Pilot práce na dálku',
      titleEn: 'A remote-work pilot',
      goalCs: 'vymezit rozsah krátkého pilotu práce na dálku',
      goalEn: 'define the scope of a short remote-work pilot',
    },
    {
      id: 'chapter-77-measurable-criteria',
      titleCs: 'Měřitelná kritéria',
      titleEn: 'Measurable criteria',
      goalCs: 'stanovit dvě měřitelné podmínky úspěchu experimentu',
      goalEn: 'set two measurable conditions for a successful experiment',
    },
    {
      id: 'chapter-78-experiment-conditions',
      titleCs: 'Podmínky experimentu',
      titleEn: 'Experiment conditions',
      goalCs: 'popsat podmínku, riziko a způsob průběžné kontroly',
      goalEn: 'describe a condition, a risk, and a method for ongoing review',
    },
    {
      id: 'chapter-79-evidence-based-decision',
      titleCs: 'Rozhodnutí podle výsledků',
      titleEn: 'A decision based on results',
      goalCs: 'vyhodnotit pilot a formulovat omezené rozhodnutí podle dat',
      goalEn: 'evaluate the pilot and formulate a limited decision based on data',
    },
  ]),
  ...series('chapter-08-negotiation', [
    {
      id: 'chapter-80-set-conditions',
      titleCs: 'Nastav podmínky',
      titleEn: 'Set the conditions',
      goalCs: 'stanovit termín, minimální podmínku a prostor pro ústupek',
      goalEn: 'set a deadline, a minimum condition, and room for a concession',
    },
  ]),
  ...series('chapter-25-complaint-remedy', [
    {
      id: 'chapter-81-core-of-complaint',
      titleCs: 'Jádro stížnosti',
      titleEn: 'The core of the complaint',
      goalCs: 'shrnout fakta stížnosti bez obranných nebo vágních formulací',
      goalEn: 'summarise the complaint facts without defensive or vague language',
    },
    {
      id: 'chapter-82-proportionate-responsibility',
      titleCs: 'Přiměřená odpovědnost',
      titleEn: 'Proportionate responsibility',
      goalCs: 'odlišit příčinu od odpovědnosti a uznat přiměřený podíl',
      goalEn: 'distinguish cause from responsibility and acknowledge a fair share',
    },
    {
      id: 'chapter-83-remedy-with-deadline',
      titleCs: 'Náprava s termínem',
      titleEn: 'A remedy with a deadline',
      goalCs: 'nabídnout konkrétní nápravu a ověřit realistický termín',
      goalEn: 'offer a specific remedy and confirm a realistic deadline',
    },
  ]),
  ...series('chapter-26-data-consequences', [
    {
      id: 'chapter-84-describe-a-trend',
      titleCs: 'Popiš trend',
      titleEn: 'Describe a trend',
      goalCs: 'popsat změnu, její velikost a relevantní časové období',
      goalEn: 'describe a change, its size, and the relevant time period',
    },
    {
      id: 'chapter-85-correlation-not-cause',
      titleCs: 'Korelace není příčina',
      titleEn: 'Correlation is not causation',
      goalCs: 'oddělit pozorovanou souvislost od neprokázané příčiny',
      goalEn: 'separate an observed relationship from an unproven cause',
    },
    {
      id: 'chapter-86-limited-recommendation',
      titleCs: 'Omezené doporučení',
      titleEn: 'A limited recommendation',
      goalCs: 'formulovat doporučení a transparentně uvést omezení dat',
      goalEn: 'make a recommendation and state the data limitations transparently',
    },
  ]),
  ...series('chapter-27-expert-discussion', [
    {
      id: 'chapter-87-strength-of-evidence',
      titleCs: 'Síla důkazu',
      titleEn: 'Strength of evidence',
      goalCs: 'odlišit silný důkaz, nepřímou indicii a pouhou hypotézu',
      goalEn: 'distinguish strong evidence, an indirect indication, and a hypothesis',
    },
    {
      id: 'chapter-88-transparent-limitation',
      titleCs: 'Transparentní omezení',
      titleEn: 'A transparent limitation',
      goalCs: 'pojmenovat metodické omezení bez znehodnocení celého závěru',
      goalEn: 'state a methodological limitation without dismissing the whole conclusion',
    },
  ]),
  ...series('chapter-28-media-indirect-speech', [
    {
      id: 'chapter-89-report-a-claim',
      titleCs: 'Převeď tvrzení do nepřímé řeči',
      titleEn: 'Report a claim indirectly',
      goalCs: 'převést cizí tvrzení do přesné nepřímé řeči',
      goalEn: 'turn another person’s claim into precise reported speech',
    },
    {
      id: 'chapter-90-source-and-comment',
      titleCs: 'Zdroj a komentář',
      titleEn: 'Source and comment',
      goalCs: 'zřetelně oddělit převzaté tvrzení od vlastního komentáře',
      goalEn: 'clearly separate a reported claim from your own comment',
    },
    {
      id: 'chapter-91-calibrate-uncertainty',
      titleCs: 'Kalibruj nejistotu',
      titleEn: 'Calibrate uncertainty',
      goalCs: 'vyjádřit míru nejistoty a uvést, z čeho přesně vychází',
      goalEn: 'express the degree of uncertainty and identify its exact basis',
    },
    {
      id: 'chapter-92-compare-media-claims',
      titleCs: 'Porovnej mediální výroky',
      titleEn: 'Compare media claims',
      goalCs: 'porovnat dvě mediální tvrzení podle zdroje a míry jistoty',
      goalEn: 'compare two media claims by source and degree of certainty',
    },
  ]),
  ...series('chapter-09-argument', [
    {
      id: 'chapter-93-answer-counterargument',
      titleCs: 'Reaguj na protiargument',
      titleEn: 'Answer a counterargument',
      goalCs: 'shrnout protiargument, uznat jeho sílu a věcně odpovědět',
      goalEn: 'summarise a counterargument, acknowledge its strength, and answer it factually',
    },
  ]),
  ...series('chapter-10-style', [
    {
      id: 'chapter-94-cut-clumsy-text',
      titleCs: 'Zkrať těžkopádný text',
      titleEn: 'Cut a clumsy text',
      goalCs: 'odstranit výplň a zachovat přesný význam odborného sdělení',
      goalEn: 'remove padding while preserving the precise meaning of a professional message',
    },
  ]),
  ...series('chapter-29-mediation', [
    {
      id: 'chapter-95-neutral-summary',
      titleCs: 'Neutrální shrnutí stran',
      titleEn: 'A neutral summary of both sides',
      goalCs: 'parafrázovat dvě pozice bez hodnotícího zkreslení',
      goalEn: 'paraphrase two positions without evaluative distortion',
    },
    {
      id: 'chapter-96-false-agreement',
      titleCs: 'Odhal falešnou shodu',
      titleEn: 'Detect false agreement',
      goalCs: 'odlišit skutečnou shodu od stejné formulace s jiným významem',
      goalEn: 'distinguish genuine agreement from similar wording with a different meaning',
    },
    {
      id: 'chapter-97-procedural-next-step',
      titleCs: 'Procedurální další krok',
      titleEn: 'A procedural next step',
      goalCs: 'navrhnout ověřitelný další krok bez předstírání kompromisu',
      goalEn: 'propose a verifiable next step without pretending there is a compromise',
    },
  ]),
  ...series('chapter-30-policy-brief', [
    {
      id: 'chapter-98-synthesise-inputs',
      titleCs: 'Syntetizuj podklady',
      titleEn: 'Synthesise the inputs',
      goalCs: 'spojit dva podklady do jednoho přesného a nezkresleného shrnutí',
      goalEn: 'combine two inputs into one precise and undistorted summary',
    },
    {
      id: 'chapter-99-state-the-limits',
      titleCs: 'Formuluj limity',
      titleEn: 'State the limitations',
      goalCs: 'vymezit předpoklady, rizika a hranice platnosti doporučení',
      goalEn: 'define the assumptions, risks, and limits of a recommendation',
    },
    {
      id: 'chapter-100-decision-recommendation',
      titleCs: 'Doporučení pro rozhodnutí',
      titleEn: 'A recommendation for a decision',
      goalCs: 'formulovat stručné doporučení s kritériem a podmínkou revize',
      goalEn: 'formulate a concise recommendation with a criterion and review condition',
    },
  ]),
];

export { expandedCourseChapterIdsBySource } from './course-chapter-ids.ts';

function englishCopy(blueprint: ExpandedChapterBlueprint): ExpandedChapterEnglishCopy {
  const wordCount = transferChapterThreads[blueprint.id]?.wordLemmas.length ?? 5;
  return {
    title: blueprint.titleEn,
    subtitle: `A focused live reply: ${blueprint.goalEn}. The German opening line is your cue, not a complete script.`,
    mission: `Respond to the opening line and ${blueprint.goalEn}. In a second turn, change one concrete detail and continue without a template.`,
    outcomes: [
      `independently ${blueprint.goalEn}`,
      `use ${wordCount === 4 ? 'four' : 'five'} familiar expressions accurately in a new context`,
      'change one detail and continue with a second original German turn',
    ],
  };
}

export const expandedCourseChapterEnglishCopy: Record<string, ExpandedChapterEnglishCopy> =
  Object.fromEntries(
    expandedChapterBlueprints.map((blueprint) => [blueprint.id, englishCopy(blueprint)]),
  );

function selectThreadWords(
  chapterId: string,
  words: CourseWord[],
  lemmas: readonly string[],
): CourseWord[] {
  const wordsByLemma = new Map(words.map((word) => [word.german, word]));
  return lemmas.map((lemma) => {
    const word = wordsByLemma.get(lemma);
    if (!word) throw new Error(`${chapterId}: zdrojová kapitola neobsahuje výraz „${lemma}“.`);
    return word;
  });
}

function modelsFromWords(
  words: CourseWord[],
  grammarIdea: string,
  variationIndex: number,
): [CourseModelSentence, CourseModelSentence] {
  const rotated = words.map((_, index) => words[(index + variationIndex) % words.length]);
  const first = rotated[0];
  const second = rotated.slice(1).find((word) => word.kind !== first.kind) ?? rotated[1];
  return [first, second].map((word, index) => {
    if (!word.exampleDe || !word.exampleCs) {
      throw new Error(`Lexém ${word.german} nemá příklad pro transferovou kapitolu.`);
    }
    return {
      de: word.exampleDe,
      cs: word.exampleCs,
      trap: createWordOrderTrap(word.exampleDe, index + variationIndex),
      note: `Podpůrná věta ukazuje výraz „${word.german}“ v tématu kapitoly; v hlavní odpovědi ho propojíš s pravidlem „${grammarIdea}“.`,
    };
  }) as [CourseModelSentence, CourseModelSentence];
}

function sentenceCase(value: string): string {
  return `${value.charAt(0).toLocaleUpperCase('cs-CZ')}${value.slice(1)}`;
}

function definitionFromBlueprint(
  blueprint: ExpandedChapterBlueprint,
  source: CourseChapterDefinition,
): CourseChapterDefinition {
  const thread = transferChapterThreads[blueprint.id];
  if (!thread) throw new Error(`${blueprint.id}: chybí redakční červená nit kapitoly.`);
  const words = selectThreadWords(blueprint.id, source.words, thread.wordLemmas);
  const grammarLessonIds = source.grammarLessonIds ?? [source.grammarLessonId];
  const coachScenarioIds = source.coachScenarioIds ?? [source.coachScenarioId];
  const scenario = coachScenarioById(thread.coachScenarioId);
  if (!scenario) throw new Error(`${blueprint.id}: chybí situační role kapitoly.`);
  const supportModels = modelsFromWords(words, thread.grammarIdea, blueprint.variationIndex);
  const bridgeModel: CourseModelSentence = {
    de: thread.responseDe,
    cs: thread.responseCs,
    trap: createWordOrderTrap(thread.responseDe, blueprint.variationIndex),
    note: `Vzor „${thread.grammarPattern}“ přímo řeší situaci kapitoly a drží pravidlo „${thread.grammarIdea}“.`,
  };
  const models: [CourseModelSentence, CourseModelSentence, CourseModelSentence] = [
    bridgeModel,
    supportModels[0],
    supportModels[1],
  ];
  const outcomes: [string, string, string] = [
    `samostatně ${blueprint.goalCs}`,
    `správně použít ${words.length === 4 ? 'čtyři' : 'pět'} známých výrazů v novém kontextu`,
    'změnit jeden konkrétní detail a navázat druhou vlastní replikou',
  ];

  return {
    id: blueprint.id,
    number: 0,
    level: source.level,
    title: blueprint.titleCs,
    subtitle: `„${thread.promptCs}“ Tvoje role: ${scenario.learnerRole}.`,
    situation: `V rozhovoru vystupuješ jako ${scenario.learnerRole}; ${scenario.coachRole} právě říká: „${thread.promptCs}“`,
    themeTag: `${source.themeTag}-transfer`,
    grammarLessonId: thread.grammarLessonId,
    grammarLessonIds: [...new Set([thread.grammarLessonId, ...grammarLessonIds])],
    coachScenarioId: thread.coachScenarioId,
    coachScenarioIds: [...new Set([thread.coachScenarioId, ...coachScenarioIds])],
    storyBookId: source.storyBookId,
    readingIds: source.readingIds ?? [source.storyBookId],
    grammarIdea: thread.grammarIdea,
    mission: `Reaguj tak, abys dokázala ${blueprint.goalCs}. V první replice můžeš využít startér „${thread.sentenceStarter}“; ve druhé změň konkrétní detail a pokračuj bez hotové šablony.`,
    outcomes,
    grammarPattern: thread.grammarPattern,
    modelSentences: models,
    sentencePrompt: `Jako ${scenario.learnerRole} odpověz německy na: „${thread.promptCs}“ Změň alespoň jeden detail oproti modelové odpovědi.`,
    sentenceStarter: thread.sentenceStarter,
    sentenceChecklist: [
      'odpověď přímo reaguje na partnerovu repliku',
      'obsahuje alespoň jeden známý výraz v přesném významu',
      'obsahuje vlastní detail a dodržuje gramatické pravidlo kapitoly',
    ],
    words,
    dialogue: [
      { speaker: sentenceCase(scenario.coachRole), de: thread.promptDe, cs: thread.promptCs },
      { speaker: sentenceCase(scenario.learnerRole), de: thread.responseDe, cs: thread.responseCs },
    ],
    assessment: {
      id: `${blueprint.id}:assessment`,
      instruction: `Bez modelové odpovědi reaguj na repliku „${thread.promptCs}“ a dokaž, že umíš ${blueprint.goalCs}.`,
      criteria: [outcomes[0], outcomes[1], 'sdělení je významově úplné a srozumitelné'],
      deterministic: true,
    },
    contentVersion: 3,
  };
}

export function createExpandedCourseChapterDefinitions(
  sourceDefinitions: CourseChapterDefinition[],
): CourseChapterDefinition[] {
  const sourceById = new Map(sourceDefinitions.map((definition) => [definition.id, definition]));
  return expandedChapterBlueprints.map((blueprint) => {
    const source = sourceById.get(blueprint.sourceChapterId);
    if (!source) throw new Error(`Chybí zdrojová kapitola ${blueprint.sourceChapterId}.`);
    return definitionFromBlueprint(blueprint, source);
  });
}

export const expandedCourseChapterCount = expandedChapterBlueprints.length;
