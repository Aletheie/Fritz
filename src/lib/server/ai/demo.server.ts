import {
  assessCoachMessage,
  coachTurnFrame,
  rejectedCoachResult,
} from '../../domain/course/coach-relevance.ts';
import { coachScenarioById } from '../../domain/course/coach.ts';
import {
  containsLexicalForm,
  germanAdjectiveInflectionMatches,
  germanVerbInflectionMatches,
  lexicalTokens,
} from '../../domain/grading/lexical.ts';
import { normalizeGermanKey } from '../../domain/grading/normalize.ts';
import { sourceMeaning } from '../../i18n/vocabulary.ts';

import type {
  AiCoachRequest,
  AiCoachResult,
  AiExplanationResult,
  AiGeneratedVocabularyItem,
  AiSentenceEvaluationRequest,
  AiSentenceEvaluationResult,
  AiVocabularyRequest,
  AiVocabularyResult,
  AiStorySelectionRequest,
  AiStorySelectionResult,
  AiStoryWordRequest,
  AiStoryWordResult,
  AiContextDrillRequest,
  AiContextDrillResult,
  AiAdaptiveHintRequest,
  AiAdaptiveHintResult,
} from '../../domain/ai/types.ts';
import type { Article, CefrLevel, LexemeKind, MotherTongue } from '../../domain/types.ts';

const DEMO_MODEL = 'fritz-demo';

type DemoEntry = Omit<AiGeneratedVocabularyItem, 'cefr'> & { cefr?: CefrLevel };

function entry(
  german: string,
  czech: string,
  kind: LexemeKind,
  options: Partial<DemoEntry> = {},
): DemoEntry {
  return {
    german,
    czech,
    kind,
    article: null,
    plural: null,
    acceptedGerman: [],
    acceptedCzech: [],
    tags: ['praktická němčina'],
    exampleDe: null,
    exampleCs: null,
    learningNote: null,
    mnemonic: null,
    verbForms: null,
    ...options,
  };
}

const common: DemoEntry[] = [
  entry('brauchen', 'potřebovat', 'verb', {
    exampleDe: 'Ich brauche heute Hilfe.',
    exampleCs: 'Dnes potřebuji pomoc.',
    learningNote: 'Po „brauchen“ často následuje akuzativ: Ich brauche einen Stift.',
    verbForms: {
      thirdPerson: 'braucht',
      preterite: 'brauchte',
      participle: 'gebraucht',
      auxiliary: 'haben',
    },
  }),
  entry('wichtig', 'důležitý', 'adjective', {
    exampleDe: 'Das ist für mich wichtig.',
    exampleCs: 'To je pro mě důležité.',
    learningNote: 'Často se pojí s „für + akuzativ“.',
  }),
  entry('Möglichkeit', 'možnost', 'noun', {
    article: 'die',
    plural: 'Möglichkeiten',
    exampleDe: 'Wir haben zwei Möglichkeiten.',
    exampleCs: 'Máme dvě možnosti.',
  }),
  entry('sich entscheiden', 'rozhodnout se', 'verb', {
    exampleDe: 'Ich entscheide mich für den Zug.',
    exampleCs: 'Rozhoduji se pro vlak.',
    learningNote: 'Vazba je „sich für etwas entscheiden“.',
    verbForms: {
      thirdPerson: 'entscheidet sich',
      preterite: 'entschied sich',
      participle: 'sich entschieden',
      auxiliary: 'haben',
    },
  }),
  entry('eigentlich', 'vlastně; vůbec', 'other', {
    exampleDe: 'Was möchtest du eigentlich?',
    exampleCs: 'Co vlastně chceš?',
    learningNote: 'V otázce často zjemňuje tón nebo vyjadřuje opravdový zájem.',
  }),
  entry('Bescheid sagen', 'dát vědět', 'phrase', {
    exampleDe: 'Sag mir bitte morgen Bescheid.',
    exampleCs: 'Dej mi prosím zítra vědět.',
    learningNote: '„Bescheid“ se v této frázi píše s velkým B.',
  }),
  entry('auf jeden Fall', 'v každém případě; určitě', 'phrase', {
    exampleDe: 'Ich komme auf jeden Fall.',
    exampleCs: 'Určitě přijdu.',
  }),
  entry('Termin', 'termín; schůzka', 'noun', {
    article: 'der',
    plural: 'Termine',
    exampleDe: 'Ich habe morgen einen Termin.',
    exampleCs: 'Zítra mám schůzku.',
  }),
  entry('erklären', 'vysvětlit', 'verb', {
    exampleDe: 'Kannst du mir das erklären?',
    exampleCs: 'Můžeš mi to vysvětlit?',
    learningNote: 'Osoba bývá v dativu: jemandem etwas erklären.',
    verbForms: {
      thirdPerson: 'erklärt',
      preterite: 'erklärte',
      participle: 'erklärt',
      auxiliary: 'haben',
    },
  }),
  entry('trotzdem', 'přesto', 'other', {
    exampleDe: 'Es regnet, trotzdem gehen wir raus.',
    exampleCs: 'Prší, přesto jdeme ven.',
    learningNote: 'Když stojí na začátku věty, sloveso následuje hned za ním.',
  }),
];

const travel: DemoEntry[] = [
  entry('Bahnhof', 'nádraží', 'noun', {
    article: 'der',
    plural: 'Bahnhöfe',
    exampleDe: 'Der Bahnhof ist nicht weit.',
    exampleCs: 'Nádraží není daleko.',
  }),
  entry('Gleis', 'nástupiště; kolej', 'noun', {
    article: 'das',
    plural: 'Gleise',
    exampleDe: 'Der Zug fährt von Gleis vier ab.',
    exampleCs: 'Vlak odjíždí ze čtvrtého nástupiště.',
  }),
  entry('umsteigen', 'přestoupit', 'verb', {
    exampleDe: 'In Dresden müssen wir umsteigen.',
    exampleCs: 'V Drážďanech musíme přestoupit.',
    verbForms: {
      thirdPerson: 'steigt um',
      preterite: 'stieg um',
      participle: 'umgestiegen',
      auxiliary: 'sein',
    },
  }),
  entry('Verspätung', 'zpoždění', 'noun', {
    article: 'die',
    plural: 'Verspätungen',
    exampleDe: 'Der Zug hat zehn Minuten Verspätung.',
    exampleCs: 'Vlak má deset minut zpoždění.',
  }),
  entry('abfahren', 'odjet; odjíždět', 'verb', {
    exampleDe: 'Wann fährt der Bus ab?',
    exampleCs: 'Kdy odjíždí autobus?',
    verbForms: {
      thirdPerson: 'fährt ab',
      preterite: 'fuhr ab',
      participle: 'abgefahren',
      auxiliary: 'sein',
    },
  }),
  entry('ankommen', 'přijet; dorazit', 'verb', {
    exampleDe: 'Wir kommen um acht Uhr an.',
    exampleCs: 'Dorazíme v osm hodin.',
    verbForms: {
      thirdPerson: 'kommt an',
      preterite: 'kam an',
      participle: 'angekommen',
      auxiliary: 'sein',
    },
  }),
  entry('eine Fahrkarte lösen', 'koupit si jízdenku', 'phrase', {
    exampleDe: 'Wo kann ich eine Fahrkarte lösen?',
    exampleCs: 'Kde si mohu koupit jízdenku?',
  }),
  entry('Hin und zurück', 'tam a zpět', 'phrase', {
    exampleDe: 'Eine Fahrkarte nach Berlin, hin und zurück.',
    exampleCs: 'Jednu jízdenku do Berlína, tam a zpět.',
  }),
  entry('Verbindung', 'spojení; spoj', 'noun', {
    article: 'die',
    plural: 'Verbindungen',
    exampleDe: 'Gibt es eine direkte Verbindung?',
    exampleCs: 'Existuje přímé spojení?',
  }),
  entry('Wo muss ich umsteigen?', 'Kde musím přestoupit?', 'phrase', {
    exampleDe: 'Entschuldigung, wo muss ich umsteigen?',
    exampleCs: 'Promiňte, kde musím přestoupit?',
  }),
];

const school: DemoEntry[] = [
  entry('Aufgabe', 'úkol', 'noun', {
    article: 'die',
    plural: 'Aufgaben',
    exampleDe: 'Die Aufgabe ist schwierig.',
    exampleCs: 'Úkol je těžký.',
  }),
  entry('Prüfung', 'zkouška; test', 'noun', {
    article: 'die',
    plural: 'Prüfungen',
    exampleDe: 'Morgen schreiben wir eine Prüfung.',
    exampleCs: 'Zítra píšeme test.',
  }),
  entry('sich vorbereiten', 'připravovat se', 'verb', {
    exampleDe: 'Ich bereite mich auf die Prüfung vor.',
    exampleCs: 'Připravuji se na zkoušku.',
    learningNote: 'Vazba: sich auf etwas vorbereiten.',
    verbForms: {
      thirdPerson: 'bereitet sich vor',
      preterite: 'bereitete sich vor',
      participle: 'sich vorbereitet',
      auxiliary: 'haben',
    },
  }),
  entry('bestehen', 'udělat; úspěšně složit', 'verb', {
    exampleDe: 'Sie hat die Prüfung bestanden.',
    exampleCs: 'Úspěšně složila zkoušku.',
    verbForms: {
      thirdPerson: 'besteht',
      preterite: 'bestand',
      participle: 'bestanden',
      auxiliary: 'haben',
    },
  }),
  entry('sich melden', 'přihlásit se; ozvat se', 'verb', {
    exampleDe: 'Bitte meldet euch, wenn ihr die Antwort wisst.',
    exampleCs: 'Přihlaste se, když znáte odpověď.',
    verbForms: {
      thirdPerson: 'meldet sich',
      preterite: 'meldete sich',
      participle: 'sich gemeldet',
      auxiliary: 'haben',
    },
  }),
  entry('Note', 'známka', 'noun', {
    article: 'die',
    plural: 'Noten',
    exampleDe: 'Welche Note hast du bekommen?',
    exampleCs: 'Jakou známku jsi dostala?',
  }),
  entry('etwas nachholen', 'něco dohnat; nahradit', 'phrase', {
    exampleDe: 'Ich muss den Stoff nachholen.',
    exampleCs: 'Musím dohnat učivo.',
  }),
  entry('Ich verstehe die Aufgabe nicht.', 'Nerozumím zadání.', 'phrase', {
    exampleDe: 'Entschuldigung, ich verstehe die Aufgabe nicht.',
    exampleCs: 'Promiňte, nerozumím zadání.',
  }),
];

const food: DemoEntry[] = [
  entry('bestellen', 'objednat', 'verb', {
    exampleDe: 'Ich möchte eine Suppe bestellen.',
    exampleCs: 'Chtěla bych si objednat polévku.',
    verbForms: {
      thirdPerson: 'bestellt',
      preterite: 'bestellte',
      participle: 'bestellt',
      auxiliary: 'haben',
    },
  }),
  entry('Speisekarte', 'jídelní lístek', 'noun', {
    article: 'die',
    plural: 'Speisekarten',
    exampleDe: 'Kann ich bitte die Speisekarte haben?',
    exampleCs: 'Mohu prosím dostat jídelní lístek?',
  }),
  entry('Rechnung', 'účet', 'noun', {
    article: 'die',
    plural: 'Rechnungen',
    exampleDe: 'Die Rechnung, bitte.',
    exampleCs: 'Účet, prosím.',
  }),
  entry('lecker', 'chutný', 'adjective', {
    exampleDe: 'Die Suppe ist sehr lecker.',
    exampleCs: 'Polévka je velmi chutná.',
  }),
  entry('ohne', 'bez', 'other', {
    exampleDe: 'Einen Tee ohne Zucker, bitte.',
    exampleCs: 'Jeden čaj bez cukru, prosím.',
    learningNote: 'Předložka „ohne“ se pojí s akuzativem.',
  }),
  entry('Ich hätte gern …', 'Dal/a bych si …', 'phrase', {
    exampleDe: 'Ich hätte gern einen Salat.',
    exampleCs: 'Dala bych si salát.',
  }),
  entry('Ist das vegetarisch?', 'Je to vegetariánské?', 'phrase', {
    exampleDe: 'Entschuldigung, ist das vegetarisch?',
    exampleCs: 'Promiňte, je to vegetariánské?',
  }),
  entry('zusammen oder getrennt', 'dohromady, nebo zvlášť', 'phrase', {
    exampleDe: 'Möchten Sie zusammen oder getrennt zahlen?',
    exampleCs: 'Chcete platit dohromady, nebo zvlášť?',
  }),
];

const shopping: DemoEntry[] = [
  entry('anprobieren', 'vyzkoušet si', 'verb', {
    exampleDe: 'Kann ich die Jacke anprobieren?',
    exampleCs: 'Mohu si vyzkoušet tu bundu?',
    verbForms: {
      thirdPerson: 'probiert an',
      preterite: 'probierte an',
      participle: 'anprobiert',
      auxiliary: 'haben',
    },
  }),
  entry('Größe', 'velikost', 'noun', {
    article: 'die',
    plural: 'Größen',
    exampleDe: 'Haben Sie das in Größe M?',
    exampleCs: 'Máte to ve velikosti M?',
  }),
  entry('passen', 'sedět; pasovat', 'verb', {
    exampleDe: 'Die Hose passt mir gut.',
    exampleCs: 'Kalhoty mi dobře sedí.',
    learningNote: 'Osoba je v dativu: Das passt mir.',
    verbForms: {
      thirdPerson: 'passt',
      preterite: 'passte',
      participle: 'gepasst',
      auxiliary: 'haben',
    },
  }),
  entry('umtauschen', 'vyměnit zboží', 'verb', {
    exampleDe: 'Kann ich das umtauschen?',
    exampleCs: 'Mohu to vyměnit?',
    verbForms: {
      thirdPerson: 'tauscht um',
      preterite: 'tauschte um',
      participle: 'umgetauscht',
      auxiliary: 'haben',
    },
  }),
  entry('günstig', 'výhodný; levný', 'adjective', {
    exampleDe: 'Das Angebot ist wirklich günstig.',
    exampleCs: 'Ta nabídka je opravdu výhodná.',
  }),
  entry('bar bezahlen', 'zaplatit v hotovosti', 'phrase', {
    exampleDe: 'Kann ich bar bezahlen?',
    exampleCs: 'Mohu zaplatit hotově?',
  }),
  entry('mit Karte zahlen', 'platit kartou', 'phrase', {
    exampleDe: 'Ich möchte mit Karte zahlen.',
    exampleCs: 'Chtěla bych platit kartou.',
  }),
  entry('Das ist mir zu teuer.', 'To je na mě příliš drahé.', 'phrase', {
    exampleDe: 'Danke, aber das ist mir zu teuer.',
    exampleCs: 'Děkuji, ale to je na mě příliš drahé.',
  }),
];

const topicGroups = [
  {
    pattern: /vlak|nádra|cest|reise|zug|bahnhof|dovolen|hotel|letišt/iu,
    title: 'Cestování bez zmatku',
    entries: travel,
  },
  {
    pattern: /škol|zkoušk|učiv|stud|schule|prüfung|lekc/iu,
    title: 'Škola a učení',
    entries: school,
  },
  {
    pattern: /jíd|restaur|kavár|café|kafe|essen|restaurant|pití/iu,
    title: 'V kavárně a restauraci',
    entries: food,
  },
  {
    pattern: /obchod|nakup|oblečen|shopping|kaufen|velikost/iu,
    title: 'Nakupování',
    entries: shopping,
  },
];

function cloneItem(
  item: DemoEntry,
  level: CefrLevel,
  includeMnemonic = false,
  language: MotherTongue = 'cs',
): AiGeneratedVocabularyItem {
  const source = sourceMeaning(item.german.replace(/\s+\(\d+\)$/u, ''), item.czech, language);
  const mnemonic = includeMnemonic
    ? language === 'en'
      ? item.article
        ? `Learn it as one unit: “${item.article} ${item.german.replace(/^(der|die|das)\s+/iu, '')}”.`
        : item.german.includes(' ')
          ? 'Say the whole phrase three times in one rhythm, not word by word.'
          : null
      : (item.mnemonic ?? mnemonicFor(item.german, item.article))
    : null;
  return {
    ...item,
    czech: source,
    acceptedGerman: [...item.acceptedGerman],
    acceptedCzech: language === 'en' ? [] : [...item.acceptedCzech],
    tags:
      language === 'en'
        ? ['practical German', level.toLowerCase()]
        : [...new Set([...item.tags, level.toLowerCase()])],
    exampleCs: language === 'en' ? null : item.exampleCs,
    learningNote:
      language === 'en'
        ? item.article
          ? `Learn “${item.article} ${item.german}” as one unit so the noun's gender stays attached.`
          : item.kind === 'verb'
            ? 'Notice the verb form and use it in one short German sentence.'
            : 'Use this expression in one short German sentence of your own.'
        : item.learningNote,
    cefr: item.cefr ?? level,
    mnemonic,
    verbForms: item.verbForms ? { ...item.verbForms } : null,
  };
}

function mnemonicFor(german: string, article: Article | null): string | null {
  if (article)
    return `Uč se jako jeden zvukový celek: „${article} ${german.replace(/^(der|die|das)\s+/iu, '')}“.`;
  if (german.includes(' '))
    return `Řekni celou frázi třikrát v jednom rytmu, ne po jednotlivých slovech.`;
  return null;
}

function topicPool(topic: string): { title: string; entries: DemoEntry[] } {
  const group = topicGroups.find((candidate) => candidate.pattern.test(topic));
  if (!group) return { title: 'Praktická němčina', entries: common };
  return { title: group.title, entries: [...group.entries, ...common] };
}

function requestedKindMatches(item: DemoEntry, request: AiVocabularyRequest): boolean {
  if (request.mode !== 'generate' || request.focus === 'balanced') return true;
  if (request.focus === 'nouns') return item.kind === 'noun';
  if (request.focus === 'verbs') return item.kind === 'verb';
  return item.kind === 'phrase';
}

function uniqueItems(entries: DemoEntry[]): DemoEntry[] {
  const seen = new Set<string>();
  return entries.filter((item) => {
    const key = normalizeGermanKey(item.german, item.article ?? undefined);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function genericFallback(index: number): DemoEntry {
  const variants: DemoEntry[] = [
    entry('Könnten Sie das bitte wiederholen?', 'Mohl/a byste to prosím zopakovat?', 'phrase', {
      exampleDe: 'Entschuldigung, könnten Sie das bitte wiederholen?',
      exampleCs: 'Promiňte, mohl/a byste to prosím zopakovat?',
    }),
    entry('Was bedeutet das?', 'Co to znamená?', 'phrase', {
      exampleDe: 'Was bedeutet dieses Wort?',
      exampleCs: 'Co znamená toto slovo?',
    }),
    entry('Ich bin mir nicht sicher.', 'Nejsem si jistý/jistá.', 'phrase', {
      exampleDe: 'Ich bin mir bei der Antwort nicht sicher.',
      exampleCs: 'Nejsem si jistá odpovědí.',
    }),
    entry('gemeinsam', 'společně', 'adjective', {
      exampleDe: 'Wir lernen gemeinsam.',
      exampleCs: 'Učíme se společně.',
    }),
    entry('verbessern', 'zlepšit', 'verb', {
      exampleDe: 'Ich möchte mein Deutsch verbessern.',
      exampleCs: 'Chci zlepšit svou němčinu.',
      verbForms: {
        thirdPerson: 'verbessert',
        preterite: 'verbesserte',
        participle: 'verbessert',
        auxiliary: 'haben',
      },
    }),
  ];
  const base = variants[index % variants.length];
  return {
    ...base,
    german: index < variants.length ? base.german : `${base.german} (${index + 1})`,
  };
}

function generationResult(
  request: Extract<AiVocabularyRequest, { mode: 'generate' }>,
): AiVocabularyResult {
  const selected = topicPool(request.topic);
  let candidates = uniqueItems(
    selected.entries.filter((item) => requestedKindMatches(item, request)),
  );
  if (candidates.length < request.count) {
    candidates = uniqueItems([
      ...candidates,
      ...[...travel, ...school, ...food, ...shopping, ...common].filter((item) =>
        requestedKindMatches(item, request),
      ),
    ]);
  }
  while (candidates.length < request.count) candidates.push(genericFallback(candidates.length));
  return {
    title:
      request.motherTongue === 'en'
        ? ({
            'Cestování bez zmatku': 'Travel without confusion',
            'Škola a učení': 'School and learning',
            'V kavárně a restauraci': 'At a café and restaurant',
            Nakupování: 'Shopping',
            'Praktická němčina': 'Practical German',
          }[selected.title] ?? 'Practical German')
        : selected.title,
    summary:
      request.motherTongue === 'en'
        ? `A short ${request.level} set. Review the suggestions first and save only expressions that fit your current lesson.`
        : `Krátká sada pro úroveň ${request.level}. Nejdřív projdi návrhy a ulož jen výrazy, které se hodí do aktuální lekce.`,
    items: candidates
      .slice(0, request.count)
      .map((item) =>
        cloneItem(item, request.level, request.includeMnemonics, request.motherTongue),
      ),
    model: DEMO_MODEL,
  };
}

function extractionResult(
  request: Extract<AiVocabularyRequest, { mode: 'extract' }>,
): AiVocabularyResult {
  const lower = request.text.toLocaleLowerCase('de-DE');
  const dictionary = uniqueItems([...travel, ...school, ...food, ...shopping, ...common]);
  const matches = dictionary.filter((item) => {
    const bare = item.german.replace(/^(der|die|das)\s+/iu, '').toLocaleLowerCase('de-DE');
    const stem = bare.split(/\s+/u).find((part) => part.length >= 4) ?? bare;
    return lower.includes(bare) || lower.includes(stem);
  });
  const pool = uniqueItems([...matches, ...topicPool(request.text).entries, ...common]);
  return {
    title:
      request.motherTongue === 'en' ? 'Expressions from your text' : 'Výrazy z vloženého textu',
    summary:
      request.motherTongue === 'en'
        ? 'Demo mode selected familiar practical expressions and formatted them as cards. Check each meaning in context before saving.'
        : 'Demo režim vybral známé praktické výrazy a doplnil je do formátu kartiček. Před uložením zkontroluj význam v kontextu.',
    items: pool
      .slice(0, request.count)
      .map((item) =>
        cloneItem(item, request.level, request.includeMnemonics, request.motherTongue),
      ),
    model: DEMO_MODEL,
  };
}

function enrichResult(
  request: Extract<AiVocabularyRequest, { mode: 'enrich' }>,
): AiVocabularyResult {
  const note = request.note;
  const known = uniqueItems([...travel, ...school, ...food, ...shopping, ...common]).find(
    (candidate) =>
      normalizeGermanKey(candidate.german, candidate.article ?? undefined) ===
      normalizeGermanKey(note.german, note.article),
  );
  const level = note.cefr ?? 'A2';
  const base = known
    ? cloneItem(known, level, true, request.motherTongue)
    : ({
        german: note.german,
        czech: note.czech,
        kind: note.kind,
        article: note.kind === 'noun' ? (note.article ?? null) : null,
        plural: note.kind === 'noun' ? (note.plural ?? null) : null,
        acceptedGerman: [...note.acceptedGerman],
        acceptedCzech: [...note.acceptedCzech],
        tags: [...new Set([...note.tags, level.toLowerCase()])],
        exampleDe: note.exampleDe ?? `Ich benutze das Wort „${note.german}“ in einem kurzen Satz.`,
        exampleCs:
          request.motherTongue === 'en'
            ? null
            : (note.exampleCs ?? `Používám slovo „${note.czech}“ v krátké větě.`),
        cefr: level,
        learningNote:
          note.learningNote ??
          (request.motherTongue === 'en'
            ? note.kind === 'noun' && note.article
              ? `Always learn this expression with the article “${note.article}”.`
              : 'Use the expression in one short German sentence of your own.'
            : note.kind === 'noun' && note.article
              ? `Uč se výraz vždy se členem „${note.article}“.`
              : 'Zkus výraz použít ještě ve vlastní krátké větě.'),
        mnemonic:
          note.mnemonic ??
          (request.motherTongue === 'en'
            ? note.article
              ? `Learn “${note.article} ${note.german}” as one unit.`
              : null
            : mnemonicFor(note.german, note.article ?? null)),
        verbForms: note.verbForms
          ? {
              thirdPerson: note.verbForms.thirdPerson ?? null,
              preterite: note.verbForms.preterite ?? null,
              participle: note.verbForms.participle ?? null,
              auxiliary: note.verbForms.auxiliary ?? null,
            }
          : null,
      } satisfies AiGeneratedVocabularyItem);

  return {
    title:
      request.motherTongue === 'en' ? `Enrichment: ${note.german}` : `Doplnění: ${note.german}`,
    summary:
      request.motherTongue === 'en'
        ? 'The card is ready for manual review. Demo mode preserved the intended meaning and added only safe details.'
        : 'Kartička je připravená k ruční kontrole. Demo režim zachoval původní význam a doplnil jen bezpečné údaje.',
    items: [
      {
        ...base,
        german: note.german,
        czech: note.czech,
        acceptedGerman: [...new Set([...base.acceptedGerman, ...note.acceptedGerman])],
        acceptedCzech: [...new Set([...base.acceptedCzech, ...note.acceptedCzech])],
        tags: [...new Set([...base.tags, ...note.tags])].slice(0, 8),
      },
    ],
    model: DEMO_MODEL,
  };
}

export function demoVocabulary(request: AiVocabularyRequest): AiVocabularyResult {
  if (request.mode === 'generate') return generationResult(request);
  if (request.mode === 'extract') return extractionResult(request);
  return enrichResult(request);
}

export function demoExplanation(request: {
  motherTongue?: MotherTongue;
  german: string;
  czech: string;
  article?: Article;
  submitted: string;
  selectedArticle?: Article;
  wordCorrect: boolean;
  articleCorrect: boolean;
  keyboardEquivalent: boolean;
  editDistance: number;
  learningNote?: string;
}): AiExplanationResult {
  const target = request.article ? `${request.article} ${request.german}` : request.german;
  if (request.motherTongue === 'en') {
    let headline = 'Almost there — fix one detail';
    let explanation = `The correct answer is “${target}”.`;
    let tip = `Say “${target}” aloud and use it immediately in a short German sentence.`;
    if (!request.articleCorrect && request.article) {
      headline = `Learn the whole unit “${target}”`;
      explanation = request.selectedArticle
        ? `The word was close, but change the article “${request.selectedArticle}” to “${request.article}”. In German, gender belongs to the noun.`
        : `Add the article “${request.article}”. It is best to store a German noun and its article as one unit.`;
      tip = `Next time, start with “${target}”, not the noun on its own.`;
    } else if (request.keyboardEquivalent) {
      headline = 'The meaning works; fix the spelling';
      explanation = `The answer is correct in meaning. Use the exact German spelling shown in “${target}”.`;
      tip = 'On mobile, hold a letter to choose ä, ö, or ü; ß is available on a German keyboard.';
    } else if (!request.wordCorrect) {
      const attempt = request.submitted.trim() || 'an empty answer';
      headline = request.editDistance <= 2 ? 'A small typo' : 'Return to the meaning hook';
      explanation = `You wrote “${attempt}”; the target form is “${target}”. Focus on letter order and the ending.`;
    } else {
      headline = 'Correct — now use it in context';
      explanation = `“${target}” is correct. Next, recall it without a hint inside a full sentence.`;
    }
    return {
      headline,
      explanation,
      tip,
      miniExampleDe: request.article
        ? `Das ist ${request.article === 'der' ? 'der' : request.article === 'die' ? 'die' : 'das'} ${request.german}.`
        : `Ich benutze heute „${request.german}“.`,
      miniExampleCs: request.article
        ? `That is ${request.czech}.`
        : `Today I am using the expression “${request.czech}”.`,
      model: DEMO_MODEL,
    };
  }
  let headline = 'Téměř tam — oprav jednu věc';
  let explanation = `Správná odpověď je „${target}“.`;
  let tip = request.learningNote ?? `Řekni si „${target}“ nahlas a hned ho použij v krátké větě.`;

  if (!request.articleCorrect && request.article) {
    headline = `Uč se celé spojení „${target}“`;
    explanation = request.selectedArticle
      ? `Slovo bylo blízko, ale člen „${request.selectedArticle}“ změň na „${request.article}“. V němčině je rod součást slovíčka.`
      : `Doplň člen „${request.article}“. U podstatných jmen je nejlepší ukládat do paměti člen a slovo jako jeden celek.`;
    tip = `Při dalším opakování nezačínej samotným „${request.german}“, ale rovnou „${target}“.`;
  } else if (request.keyboardEquivalent) {
    headline = 'Význam sedí, dolaď správný zápis';
    explanation = `Odpověď je významově správná. Ve finálním zápisu ale použij německou diakritiku přesně jako v „${target}“.`;
    tip = 'Na mobilu podrž písmeno a vyber ä, ö nebo ü; ß bývá v německé klávesnici samostatně.';
  } else if (!request.wordCorrect) {
    const attempt = request.submitted.trim() || 'prázdná odpověď';
    headline =
      request.editDistance <= 2
        ? 'Malý překlep, ne špatně naučené slovo'
        : 'Vrať se k významovému háčku';
    explanation = `Napsala jsi „${attempt}“, cílový tvar je „${target}“. Zaměř se na pořadí písmen a koncovku.`;
  } else {
    headline = 'Správně — teď upevnit v kontextu';
    explanation = `Tvar „${target}“ sedí. Další krok je vybavit ho bez nápovědy v celé větě.`;
  }

  return {
    headline,
    explanation,
    tip,
    miniExampleDe: request.article
      ? `Das ist ${request.article === 'der' ? 'der' : request.article === 'die' ? 'die' : 'das'} ${request.german}.`
      : `Ich benutze heute „${request.german}“.`,
    miniExampleCs: request.article
      ? `To je ${request.czech}.`
      : `Dnes používám výraz „${request.czech}“.`,
    model: DEMO_MODEL,
  };
}

export function demoStoryWord(request: AiStoryWordRequest): AiStoryWordResult {
  if (!request.known) {
    if (request.motherTongue === 'en') {
      return {
        word: request.word,
        contextMeaning: 'The precise meaning of this word requires connected AI.',
        grammarNote:
          'In demo mode, every pre-annotated word remains available without AI. Add an AI key in Settings to inspect a custom selection.',
        morphology: 'The form cannot be identified safely offline without a verified entry.',
        collocation: 'The offline demo does not invent an unverified collocation.',
        recallQuestion: `What does “${request.word}” mean in this sentence?`,
        registerNote: null,
        item: null,
        available: false,
        model: DEMO_MODEL,
      };
    }
    return {
      word: request.word,
      contextMeaning: 'Přesný význam tohoto slova vyžaduje připojenou AI.',
      grammarNote:
        'Ve zkušebním režimu jsou bez AI dostupná všechna předem podtržená slova. Vlastní slovo můžeš znovu otevřít po přidání AI klíče v nastavení.',
      morphology: 'Bez ověřeného hesla nelze tvar offline bezpečně určit.',
      collocation: 'Offline demo nevymýšlí neověřenou vazbu.',
      recallQuestion: `Jaký význam má „${request.word}“ právě v této větě?`,
      registerNote: null,
      item: null,
      available: false,
      model: DEMO_MODEL,
    };
  }
  const known = request.known;
  const item: AiGeneratedVocabularyItem = {
    german: known.german,
    czech: known.czech,
    kind: known.kind,
    article: known.article ?? null,
    plural: known.plural ?? null,
    acceptedGerman: [],
    acceptedCzech: [],
    tags: [request.motherTongue === 'en' ? 'reading' : 'četba', request.level.toLowerCase()],
    exampleDe: request.sentence.slice(0, 300),
    exampleCs: null,
    cefr: known.cefr,
    learningNote: known.learningNote ?? null,
    mnemonic: null,
    verbForms: null,
  };
  return {
    word: request.word,
    contextMeaning: known.czech,
    grammarNote:
      request.motherTongue === 'en'
        ? `In this sentence, “${request.word}” is a form of “${known.german}”.`
        : (known.learningNote ??
          `V této větě je „${request.word}“ tvarem výrazu „${known.german}“.`),
    morphology:
      request.motherTongue === 'en'
        ? known.kind === 'noun'
          ? `${known.article ?? 'article unknown'} ${known.german}; plural ${known.plural ?? 'not listed'}`
          : `Dictionary form: ${known.german}.`
        : known.kind === 'noun'
          ? `${known.article ?? 'člen neurčen'} ${known.german}; plurál ${known.plural ?? 'není v hesle uveden'}`
          : `Základní tvar: ${known.german}.`,
    collocation:
      request.motherTongue === 'en'
        ? `Expression in context: ${request.sentence.slice(0, 180)}`
        : `Kontextová vazba: ${request.sentence.slice(0, 180)}`,
    recallQuestion:
      request.motherTongue === 'en'
        ? `How would you express “${request.word}” in English in this sentence?`
        : `Jak bys v této větě česky vyjádřil/a „${request.word}“?`,
    registerNote:
      request.level === 'B2' || request.level === 'C1'
        ? request.motherTongue === 'en'
          ? 'When reviewing, notice the style and meaning of this exact sentence, not only the dictionary lemma.'
          : 'Při opakování sleduj také styl a význam konkrétní věty, ne jen slovníkové lemma.'
        : null,
    item,
    available: true,
    model: DEMO_MODEL,
  };
}

export function demoStorySelection(request: AiStorySelectionRequest): AiStorySelectionResult {
  if (request.motherTongue === 'en') {
    return {
      translationCs:
        'Translation of a freely selected passage is available after you add an AI key in Settings.',
      explanationCs:
        request.action === 'explain'
          ? 'Without connected AI, you can still use the manually verified translations of annotated words.'
          : 'Your selection is preserved; after connecting AI you will get a translation for this exact context.',
      grammarHighlights: [],
      suggestedGerman: request.text,
      suggestedCzech: '',
      available: false,
      model: DEMO_MODEL,
    };
  }
  return {
    translationCs: 'Překlad volně vybraného úseku je dostupný po přidání AI klíče v nastavení.',
    explanationCs:
      request.action === 'explain'
        ? 'Bez připojené AI můžeš dál používat ručně ověřené překlady podtržených slov.'
        : 'Označení zůstalo zachované; po připojení AI dostaneš překlad přesně v tomto kontextu.',
    grammarHighlights: [],
    suggestedGerman: request.text,
    suggestedCzech: '',
    available: false,
    model: DEMO_MODEL,
  };
}

function wordForms(request: AiSentenceEvaluationRequest): string[] {
  const forms = [request.german];
  if (request.verbForms) {
    forms.push(
      request.verbForms.thirdPerson ?? '',
      request.verbForms.preterite ?? '',
      request.verbForms.participle ?? '',
    );
  }
  if (request.plural) forms.push(request.plural);
  return forms.map((value) => value.trim().toLocaleLowerCase('de-DE')).filter(Boolean);
}

export function demoSentenceEvaluation(
  request: AiSentenceEvaluationRequest,
): AiSentenceEvaluationResult {
  const sentence = request.sentence.trim();
  const sentenceTokens = lexicalTokens(sentence);
  const targetUsed =
    wordForms(request).some((form) => containsLexicalForm(sentenceTokens, form)) ||
    (request.kind === 'adjective' &&
      germanAdjectiveInflectionMatches(sentenceTokens, request.german)) ||
    (request.kind === 'verb' && germanVerbInflectionMatches(sentenceTokens, request.german));
  const startsUppercase = /^[A-ZÄÖÜ]/u.test(sentence);
  const hasVerbShape =
    /\b(ich|du|er|sie|es|wir|ihr|Sie)\b/iu.test(sentence) || request.kind === 'phrase';
  const hasEnding = /[.!?]$/u.test(sentence);
  const enoughWords = sentence.split(/\s+/u).length >= 3;

  const grammarScore = Math.max(
    35,
    Math.min(
      100,
      45 +
        (targetUsed ? 25 : 0) +
        (startsUppercase ? 10 : 0) +
        (hasVerbShape ? 12 : 0) +
        (hasEnding ? 8 : 0),
    ),
  );
  const naturalnessScore = Math.max(
    40,
    Math.min(96, 50 + (enoughWords ? 22 : 0) + (targetUsed ? 16 : 0) + (hasEnding ? 8 : 0)),
  );
  const accepted = targetUsed && enoughWords && grammarScore >= 72;
  const correctedSentence =
    startsUppercase && hasEnding
      ? null
      : `${sentence.charAt(0).toLocaleUpperCase('de-DE')}${sentence.slice(1)}${hasEnding ? '' : '.'}`;

  let feedback =
    request.motherTongue === 'en'
      ? 'The target expression works in this sentence.'
      : 'Cílový výraz ve větě funguje.';
  if (!targetUsed) {
    feedback =
      request.motherTongue === 'en'
        ? `Use “${request.german}” or a correct inflected form directly in the sentence.`
        : `Použij ve větě přímo výraz „${request.german}“ nebo jeho správný tvar.`;
  } else if (!startsUppercase) {
    feedback =
      request.motherTongue === 'en'
        ? 'The expression is used well; start the sentence with a capital letter.'
        : 'Výraz je použitý dobře; začni větu velkým písmenem.';
  } else if (!hasEnding) {
    feedback =
      request.motherTongue === 'en'
        ? 'The expression is used well; add punctuation at the end.'
        : 'Výraz je použitý dobře; doplň na konec interpunkci.';
  } else if (!hasVerbShape) {
    feedback =
      request.motherTongue === 'en'
        ? 'The expression is present, but the sentence needs a clearer subject and verb.'
        : 'Výraz je použitý, ale věta potřebuje jasnější podmět a sloveso.';
  }

  return {
    accepted,
    targetUsedCorrectly: targetUsed,
    grammarScore,
    naturalnessScore,
    feedback,
    correctedSentence,
    czechMeaning: accepted
      ? request.motherTongue === 'en'
        ? `The sentence meaningfully uses “${request.czech}”; verify the exact translation against your intended context.`
        : `Věta smysluplně používá výraz „${request.czech}“; přesný překlad si ještě ověř podle zamýšleného kontextu.`
      : request.motherTongue === 'en'
        ? 'The meaning is not yet clear enough for a reliable translation.'
        : 'Význam zatím není dost jednoznačný pro spolehlivý překlad.',
    model: DEMO_MODEL,
  };
}

const coachReplies: Record<string, string[]> = {
  cafe: [
    'Sehr gern. Was möchten Sie trinken?',
    'Möchten Sie dazu etwas essen?',
    'Gut. Zahlen Sie zusammen oder getrennt?',
  ],
  train: [
    'Wohin möchten Sie fahren?',
    'Möchten Sie eine einfache Fahrt oder hin und zurück?',
    'Der Zug fährt von Gleis vier ab. Müssen Sie noch etwas wissen?',
  ],
  school: [
    'Welche Aufgabe ist für dich schwierig?',
    'Was verstehst du schon und wo brauchst du Hilfe?',
    'Gut erklärt. Wann möchtest du die Aufgabe fertig haben?',
  ],
  shopping: [
    'Natürlich. Welche Größe suchen Sie?',
    'Wie passt Ihnen das? Möchten Sie eine andere Farbe?',
    'Sehr gut. Möchten Sie bar oder mit Karte zahlen?',
  ],
  introductions: [
    'Freut mich! Woher kommst du?',
    'Schön. Und was machst du gern in deiner Freizeit?',
    'Das mag ich auch. Dann haben wir schon etwas gemeinsam!',
  ],
  bakery: [
    'Gern. Möchten Sie sonst noch etwas?',
    'Ja, das haben wir. Soll es ein ganzes Brot sein?',
    'Sehr gern. Das macht fünf Euro zwanzig.',
  ],
  directions: [
    'Gehen Sie hier geradeaus und dann an der Ampel nach links.',
    'Genau. Danach sehen Sie den Bahnhof auf der rechten Seite.',
    'Gern geschehen. Einen schönen Tag noch!',
  ],
  'hotel-check-in': [
    'Danke. Darf ich bitte noch Ihren Ausweis sehen?',
    'Das Frühstück gibt es ab halb sieben im Erdgeschoss.',
    'Der WLAN-Code steht auf Ihrer Zimmerkarte. Ihr Zimmer ist im zweiten Stock.',
  ],
  pharmacy: [
    'Haben Sie außerdem Fieber oder Husten?',
    'Ich empfehle Ihnen diese Lutschtabletten. Wenn es schlimmer wird, gehen Sie bitte zum Arzt.',
    'Nehmen Sie höchstens vier Tabletten am Tag und lesen Sie die Packungsbeilage.',
  ],
  invitation: [
    'Super, das freut mich! Die Feier beginnt um sechs.',
    'Sieben Uhr passt gut. Wir essen ungefähr um halb acht.',
    'Wenn du möchtest, bring bitte etwas zu trinken mit.',
  ],
  'apartment-repair': [
    'Das tut mir leid. Betrifft es die ganze Wohnung?',
    'Verstanden, dann ist die Reparatur dringend. Wann sind Sie zu Hause?',
    'Der Techniker kann morgen zwischen neun und elf Uhr kommen. Passt das?',
  ],
  'job-interview': [
    'Danke. Welche Aufgabe hat Ihnen dabei besonders viel Spaß gemacht?',
    'Können Sie mir ein konkretes Beispiel für gute Teamarbeit geben?',
    'Gute Frage. Ein typischer Tag beginnt mit einer kurzen Teambesprechung.',
  ],
  'lost-luggage': [
    'Das sehe ich mir sofort an. Haben Sie den Gepäckabschnitt dabei?',
    'Danke. Hat der Koffer noch ein besonderes Merkmal?',
    'Sie bekommen die Bestätigung per E-Mail. Wir liefern den Koffer an Ihre Unterkunft.',
  ],
  'project-meeting': [
    'Priorisieren klingt sinnvoll. Welche Aufgabe sollte zuerst fertig werden?',
    'Der kleinere Umfang wäre realistischer. Was verschieben wir konkret?',
    'Einverstanden. Sie übernehmen die Präsentation, ich kläre heute die offenen Daten.',
  ],
  'deadline-negotiation': [
    'Die Daten kommen vermutlich erst morgen. Welche Auswirkung hätte das?',
    'Eine Kurzfassung am Freitag könnte funktionieren. Was würde sie enthalten?',
    'Gut, dann halten wir Freitag für die Kurzfassung und Montag für die Vollversion fest.',
  ],
  'difficult-feedback': [
    'Danke, dass du es konkret ansprichst. Welche Änderung war für dich besonders schwierig?',
    'Das verstehe ich. Ich hätte dich früher informieren sollen.',
    'Lass uns Änderungen künftig bis mittags im gemeinsamen Kanal bestätigen.',
  ],
  'defend-position': [
    'Der längere Zeitraum verändert die Rechnung. Welche Annahme ist dafür entscheidend?',
    'Das ist nachvollziehbar. Wie würden Sie das Risiko einer falschen Annahme begrenzen?',
    'Eine schrittweise Einführung verbindet also Kontrolle und Lernmöglichkeit. Das überzeugt mich eher.',
  ],
  'media-interview': [
    'Welche Daten widersprechen denn konkret der Kritik?',
    'Hinweise sind noch kein Beweis. Wie sicher ist Ihre Aussage tatsächlich?',
    'Transparente Prüfung ist ein klares Versprechen. Wann werden die ersten Ergebnisse veröffentlicht?',
  ],
  'supermarket-checkout': [
    'Gern. Möchten Sie bar oder mit Karte zahlen?',
    'Bitte halten Sie die Karte an das Lesegerät. Möchten Sie den Kassenbon?',
    'Natürlich. Hier sind Ihr Kassenbon und Ihre Einkäufe. Auf Wiedersehen!',
  ],
  'city-bus': [
    'Gern. Fahren Sie direkt zum Museum oder zuerst ins Stadtzentrum?',
    'Ja, die Linie vier fährt zum Museum. Haben Sie noch eine Frage?',
    'Steigen Sie an der Haltestelle Rathaus aus. Ich sage Ihnen rechtzeitig Bescheid.',
  ],
  'new-neighbor': [
    'Dann herzlich willkommen im Haus! Haben Sie schon alles gefunden?',
    'Der Müllraum ist im Keller, gleich neben der Treppe.',
    'Sehr gern, danke. Morgen Nachmittag hätte ich Zeit.',
  ],
  'doctor-appointment': [
    'Natürlich. Passt es Ihnen am Dienstagvormittag?',
    'Wir hätten um zehn Uhr noch einen freien Termin. Geht das?',
    'Perfekt, ich habe den Termin eingetragen. Bringen Sie bitte Ihre Versicherungskarte mit.',
  ],
  'restaurant-reservation': [
    'Am Freitag ist um neunzehn Uhr noch ein Tisch frei. Passt das?',
    'Ja, wir haben mehrere vegetarische Hauptgerichte. Auf welchen Namen darf ich reservieren?',
    'Vielen Dank. Der Tisch für zwei ist auf Novák reserviert. Wir freuen uns auf Sie!',
  ],
  'return-purchase': [
    'Das tut mir leid. Haben Sie den Kassenbon noch?',
    'Danke. Wir können die Kopfhörer umtauschen oder den Kaufpreis erstatten. Was ist Ihnen lieber?',
    'In Ordnung. Die Erstattung geht zurück auf Ihre Karte.',
  ],
  'post-office': [
    'Das Paket wiegt zwei Kilo. Soll es normal oder per Express verschickt werden?',
    'Der Expressversand kostet achtzehn Euro und dauert voraussichtlich zwei Tage.',
    'Ja. Die Sendungsnummer steht oben auf diesem Beleg.',
  ],
  'bike-rental': [
    'Ein Tag kostet achtzehn Euro. Brauchen Sie auch einen Helm oder ein Schloss?',
    'Ja, Helm und Schloss sind im Preis enthalten.',
    'Bitte bringen Sie das Fahrrad heute bis achtzehn Uhr hierher zurück.',
  ],
  'apartment-viewing': [
    'Heizung und Wasser sind enthalten, Strom zahlen Sie separat. Was möchten Sie noch wissen?',
    'Die Straßenbahn hält um die Ecke und fährt zehn Minuten ins Zentrum.',
    'Die Wohnung ist ab dem ersten Oktober frei. Möchten Sie die Unterlagen mitnehmen?',
  ],
  'call-in-sick': [
    'Natürlich, erholen Sie sich. Gibt es heute etwas Dringendes, das wir übernehmen müssen?',
    'Ja, Lea kann den Termin übernehmen. Schicken Sie ihr bitte nur die wichtigsten Notizen.',
    'Das reicht völlig. Melden Sie sich erst, wenn Sie wissen, wie es Ihnen geht. Gute Besserung!',
  ],
  'phone-contract': [
    'Ich sehe eine zusätzliche Gebühr. Haben Sie im Ausland mobile Daten genutzt?',
    'Die Gebühr stammt aus Ihrem aktuellen Roaming-Paket. Soll ich günstigere Tarife prüfen?',
    'Der Flex-Tarif passt besser zu Ihrer Nutzung. Ich kann den Wechsel zum Monatsende eintragen.',
  ],
  'weekend-planning': [
    'Das Museum ist eine gute Alternative. Was machen wir, falls es am Sonntag trocken bleibt?',
    'Ein kurzer Sonntagsausflug klingt gut. Wer organisiert was?',
    'Perfekt. Du besorgst die Tickets, ich kümmere mich um die Zugverbindung.',
  ],
  'customer-complaint': [
    'Gut, dann prüfen Sie es. Welche Angabe brauchen Sie von mir?',
    'Die Bestellnummer lautet 8472. Können Sie jetzt sehen, wo das Paket ist?',
    'Die Erstattung und Lieferung morgen sind für mich eine faire Lösung. Bitte bestätigen Sie das per E-Mail.',
  ],
  'remote-work': [
    'Mehr Konzentration ist ein Argument. Wie stellen Sie sicher, dass das Team Sie erreicht?',
    'Feste Kernzeiten helfen. Trotzdem fehlt uns möglicherweise der spontane Austausch im Büro.',
    'Eine sechswöchige Pilotphase mit klaren Kriterien halte ich für vertretbar. Formulieren Sie bitte einen kurzen Vorschlag.',
  ],
  'salary-conversation': [
    'Welche konkreten Ergebnisse verbinden Sie mit der zusätzlichen Verantwortung?',
    'Die Ergebnisse sind gut, unser Budget ist dieses Quartal allerdings bereits festgelegt.',
    'Einverstanden. Wir definieren heute die Kriterien und entscheiden beim nächsten Quartalsgespräch über die Anpassung.',
  ],
  'academic-seminar': [
    'Die Stichprobe ist klein, aber die Ergebnisse sind statistisch signifikant. Warum reicht Ihnen das nicht?',
    'Sie unterscheiden also zwischen einem belastbaren Trend und einem kausalen Nachweis. Welche Prüfung schlagen Sie vor?',
    'Eine größere Vergleichsgruppe würde die zentrale Schwäche tatsächlich adressieren. Das ist ein konstruktiver Einwand.',
  ],
  'town-hall': [
    'Die Ladenbesitzer berichten bereits von sinkenden Umsätzen. Warum sollte das nicht am Verkehrskonzept liegen?',
    'Feste Lieferzeiten wären hilfreich, lösen aber nicht jede Sorge. Welche weitere Absicherung sehen Sie vor?',
    'Eine ausgewertete Übergangsphase mit klaren Ausnahmen wäre ein überprüfbarer Kompromiss.',
  ],
  'team-mediation': [
    'Verlässliche Prioritäten wollen alle. Gestritten wird darüber, wer sie festlegen darf.',
    'Frühere Dokumentation klingt sinnvoll, doch wie verhindern wir weiterhin einseitige Entscheidungen?',
    'Eine verbindliche wöchentliche Abstimmung gibt beiden Seiten Einfluss. Das können wir so festhalten.',
  ],
  'bakery-preorder': [
    'Danke, ich habe die Bestellung gefunden. Was genau hatten Sie bestellt?',
    'Richtig, zwei Brezeln und eine Zimtschnecke. Möchten Sie noch etwas dazu?',
    'Sehr gern. Ich packe alles zusammen ein. Das macht acht Euro zwanzig.',
  ],
  'medical-examination': [
    'Haben Sie außer Halsschmerzen und Fieber noch weitere Beschwerden?',
    'Dann untersuche ich jetzt Ihren Hals. Nehmen Sie bereits Medikamente?',
    'Für die Blutuntersuchung kommen Sie bitte nüchtern. Das Rezept erhalten Sie anschließend.',
  ],
  'study-planning': [
    'Freies Sprechen ist ein klares Ziel. Wie teilen Sie die vier Wochen konkret ein?',
    'Die drei Etappen sind sinnvoll. Woran erkennen Sie am Ende jeder Woche Ihren Fortschritt?',
    'Eine wöchentliche Probeaufgabe macht den Fortschritt sichtbar. Tragen Sie die Termine direkt in Ihren Zeitplan ein.',
  ],
  'hybrid-team-coordination': [
    'Ein gemeinsamer Termin reduziert die Belastung. Wie halten wir die übrigen Personen auf dem Laufenden?',
    'Asynchrone Dokumentation hilft. Wer koordiniert offene Entscheidungen zwischen den Zeitzonen?',
    'Feste Übergaben und klare Zuständigkeiten ergeben einen belastbaren Arbeitsablauf. Testen wir ihn vier Wochen lang.',
  ],
  'fact-checking-briefing': [
    'Einverstanden, Reichweite ersetzt keine verlässliche Quelle. Welche Angaben können wir unabhängig prüfen?',
    'Ort, Zeitpunkt und Urheber sind die richtigen Prüfpunkte. Wie formulieren wir den Zwischenstand ohne Vorverurteilung?',
    'Die Quellenangabe schafft den nötigen Abstand. Wir veröffentlichen erst nach einer zweiten unabhängigen Bestätigung.',
  ],
  'weather-outfit': [
    'Ein Spaziergang ist möglich, aber am Nachmittag sind Schauer angekündigt. Was ziehst du an?',
    'Die Regenjacke passt gut. Brauchst du für stärkeren Regen noch etwas?',
    'Mit dem Regenschirm bist du vorbereitet. Dann können wir trotz des Wetters losgehen.',
  ],
  'library-card': [
    'Gern. Für den Ausweis brauche ich Ihren Namen, Ihre Adresse und einen Lichtbildausweis.',
    'Sie können Bücher vier Wochen ausleihen und online zweimal verlängern.',
    'Die deutschen Kinderbücher finden Sie im ersten Stock, gleich hinter der Treppe.',
  ],
  'dietary-request': [
    'Danke für den Hinweis. Die Nussallergie vermerke ich sofort. Welches Gericht interessiert Sie?',
    'Die Suppe enthält Sahne, wir haben aber eine vegane Tomatensuppe ohne Milchprodukte.',
    'Ja, den Salat bereiten wir ohne Käse und mit einem separaten Dressing zu.',
  ],
  'missed-connection': [
    'Ich prüfe das. Aus welcher Richtung kamen Sie und wohin möchten Sie weiterfahren?',
    'Die nächste Verbindung nach Leipzig fährt um vierzehn Uhr zwölf von Gleis sieben.',
    'Wegen der Verspätung gilt Ihre Fahrkarte auch in diesem Zug; eine neue Buchung ist nicht nötig.',
  ],
  'volunteer-event': [
    'Eine Aufgabenliste ist ein guter Anfang. Wie viele Freiwillige und welche Ausrüstung brauchen wir?',
    'Damit sind Material und Treffpunkt geklärt. Wer informiert die Gemeinde und die Teilnehmenden?',
    'Der Ersatztermin am Sonntag ist sinnvoll. Wir bestätigen ihn am Freitag anhand der Wettervorhersage.',
  ],
  'study-project-presentation': [
    'Die Folgen für Studierende geben der Präsentation einen klaren Fokus. Welche Argumente brauchen wir?',
    'Die Dreiteilung ist nachvollziehbar. Wer übernimmt Quellen, Beispiele und Lösungsvorschläge?',
    'Montag passt. Nach der Probe geben wir uns gezielt Feedback zu Aufbau, Zeit und Verständlichkeit.',
  ],
  'energy-saving-proposal': [
    'Die Wärmeverluste sprechen für die Dämmung. Auf welche Verbrauchsdaten stützen Sie diese Priorität?',
    'Die erwartete Einsparung ist relevant, aber die Anfangsinvestition bleibt beträchtlich. Wie bewerten Sie das?',
    'Eine Amortisation in sechs Jahren wäre vertretbar. Legen Sie bitte Annahmen und Messkriterien offen.',
  ],
  'privacy-incident-response': [
    'Zwölf auffällige Konten sind ein belastbarer erster Befund. Was ist noch unklar?',
    'Sperren und Beweissicherung haben jetzt Vorrang. Wie verhindern wir dabei den Verlust von Protokolldaten?',
    'Einverstanden. Wir informieren transparent, trennen bestätigte Fakten von Vermutungen und nennen nächste Schritte.',
  ],
  'research-ethics-review': [
    'Die mögliche Belastung ist zentral. Welche Schutzmaßnahme würde dieses Risiko konkret begrenzen?',
    'Ein folgenloser Rückzug stärkt die Freiwilligkeit. Wie prüfen wir, ob die Einwilligung wirklich verstanden wurde?',
    'Eine unabhängige Ansprechstelle ist eine sinnvolle Auflage. Ich nehme sie in das überarbeitete Protokoll auf.',
  ],
  'policy-consultation': [
    'Der Zielkonflikt ist präzise benannt. Welche Gruppen wären von einer starren Regel besonders betroffen?',
    'Begrenzte Ausnahmen könnten berechtigte Härten auffangen. Wie verhindern wir, dass sie zur Regel werden?',
    'Klare Kriterien und eine befristete Auswertung machen den Kompromiss überprüfbar. Das halten wir im Entwurf fest.',
  ],
};

function compactGermanCorrection(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  let corrected = trimmed.charAt(0).toLocaleUpperCase('de-DE') + trimmed.slice(1);
  corrected = corrected.replace(/\bich möchte gerne\b/iu, 'ich möchte gern');
  corrected = corrected
    .replace(/\bkonnen\b/giu, 'können')
    .replace(/\bmussen\b/giu, 'müssen')
    .replace(/\bmochte\b/giu, 'möchte')
    .replace(/\bdie\s+Fern\s*sehen\b/giu, 'das Fernsehen')
    .replace(/\bdie Momenten\b/giu, 'die Momente')
    .replace(/\bnichts (?:können )?machen kann\b/giu, 'nichts machen kann');
  if (!/[.!?]$/u.test(corrected)) corrected += '.';
  return corrected === trimmed ? null : corrected;
}

export function demoCoach(request: AiCoachRequest): AiCoachResult {
  const message = request.message.trim();
  const words = message.split(/\s+/u).filter(Boolean);
  const focusHits = request.focusWords.filter((word) => normalizedIncludes(message, word)).length;
  const scenario = coachScenarioById(request.scenarioId);
  const assessment = scenario
    ? assessCoachMessage({
        scenario,
        message,
        turn: request.turn,
        history: request.history,
      })
    : undefined;
  if (scenario && assessment && !assessment.accepted && assessment.issue) {
    return rejectedCoachResult({
      scenario,
      assessment,
      turn: request.turn,
      maxTurns: request.maxTurns,
      motherTongue: request.motherTongue,
    });
  }
  const accepted = assessment?.accepted ?? words.length >= 2;
  const relevanceHits = assessment
    ? new Set([...assessment.contextMatches, ...assessment.turnMatches]).size
    : 0;
  const score = Math.max(
    35,
    Math.min(
      100,
      48 +
        (accepted ? 24 : 0) +
        Math.min(12, words.length * 2) +
        Math.min(10, focusHits * 5) +
        Math.min(6, relevanceHits * 2),
    ),
  );
  const replyPool = coachReplies[request.scenarioId];
  const index = Math.min((replyPool?.length ?? 1) - 1, Math.max(0, request.turn - 1));
  const nextFrame =
    scenario && request.turn < request.maxTurns ? coachTurnFrame(scenario, request.turn + 1) : null;
  const reply = replyPool
    ? replyPool[index]
    : scenario
      ? nextFrame
        ? `Gut. Ergänze jetzt den nächsten Punkt mit „${nextFrame}“.`
        : 'Gut gemacht. Damit ist die Situation vollständig.'
      : [
          'Gut. Kannst du mir noch einen Satz dazu sagen?',
          'Verstanden. Was möchtest du als Nächstes sagen?',
          'Sehr schön. Stelle mir jetzt bitte eine kurze Frage.',
        ][Math.min(2, Math.max(0, request.turn - 1))];
  const correction = accepted ? compactGermanCorrection(message) : null;
  const progress = Math.min(100, Math.round((request.turn / Math.max(1, request.maxTurns)) * 100));
  const diagnostics: AiCoachResult['diagnostics'] = [];
  if (/\bich\s+(?:haben|sein|mochten|möchten|konnen|können)\b/iu.test(message)) {
    diagnostics.push({ tag: 'verb-form', confidence: 'high' });
  }
  if (/\bweil\b[^.!?]*\b(?:ich|du|er|sie|wir|ihr)\s+\p{L}+(?:e|st|t|en)\b/iu.test(message)) {
    diagnostics.push({ tag: 'word-order', confidence: 'medium' });
  }

  return {
    reply,
    accepted,
    outcome: accepted ? 'accepted' : 'retry',
    score,
    feedback: accepted
      ? focusHits > 0
        ? request.motherTongue === 'en'
          ? 'Good response. You used a target word naturally and kept the conversation moving.'
          : 'Dobrá reakce. Použila jsi cílové slovo přirozeně a rozhovor pokračuje.'
        : request.motherTongue === 'en'
          ? 'Your message is clear. In the next turn, try to add one of the suggested words.'
          : 'Sdělení je srozumitelné. V dalším tahu zkus přidat jedno z doporučených slov.'
      : request.motherTongue === 'en'
        ? 'Try one short German sentence. A subject, verb, and the information you want to share are enough.'
        : 'Zkus jednu krátkou německou větu. Stačí podmět, sloveso a informace, kterou chceš sdělit.',
    correction,
    nextHint:
      request.turn >= request.maxTurns
        ? request.motherTongue === 'en'
          ? 'The final step is complete—review your conversation summary now.'
          : 'Poslední krok je hotový — teď si prohlédni souhrn rozhovoru.'
        : request.level === 'A1' || request.level === 'A2'
          ? request.motherTongue === 'en'
            ? `Complete the next short frame “${nextFrame ?? 'Ich …'}” with your own detail.`
            : `Doplň další krátkou kostru „${nextFrame ?? 'Ich …'}“ vlastním údajem.`
          : request.motherTongue === 'en'
            ? `Continue with the next point; “${nextFrame ?? 'eine klare Begründung …'}” can help.`
            : `Pokračuj dalším bodem; pomoci může „${nextFrame ?? 'eine klare Begründung …'}“.`,
    missionProgress: progress,
    diagnostics: diagnostics.slice(0, 3),
    model: DEMO_MODEL,
  };
}

function contextAnswer(request: AiContextDrillRequest, index: number): string {
  const lexeme = request.lexemes[index % request.lexemes.length];
  return lexeme.article ? `${lexeme.article} ${lexeme.german}` : lexeme.german;
}

export function demoContextDrills(request: AiContextDrillRequest): AiContextDrillResult {
  const count = Math.min(6, Math.max(3, request.lexemes.length));
  const types = ['translation', 'cloze', 'contrast', 'word-order'] as const;
  const drills = Array.from({ length: count }, (_, index) => {
    const lexeme = request.lexemes[index % request.lexemes.length];
    const answer = contextAnswer(request, index);
    const type = types[index % types.length];
    const prompt =
      type === 'cloze'
        ? request.motherTongue === 'en'
          ? `Complete the exact German expression: ___ — ${lexeme.exampleCs ?? lexeme.czech}`
          : `Doplň přesný německý výraz: ___ — ${lexeme.exampleCs ?? lexeme.czech}`
        : type === 'word-order'
          ? request.motherTongue === 'en'
            ? `Build the correct expression: ${answer.split(/\s+/u).toReversed().join(' · ')}`
            : `Sestav správný výraz: ${answer.split(/\s+/u).toReversed().join(' · ')}`
          : type === 'contrast'
            ? request.motherTongue === 'en'
              ? `Which exact German expression matches “${lexeme.czech}”?`
              : `Který přesný německý výraz odpovídá významu „${lexeme.czech}“?`
            : request.motherTongue === 'en'
              ? `Translate into German: ${lexeme.czech}`
              : `Přelož do němčiny: ${lexeme.czech}`;
    return {
      id: `demo-context:${index + 1}:${lexeme.noteId}`,
      type,
      prompt,
      answer,
      acceptedAnswers: [...new Set([answer, lexeme.german, ...lexeme.acceptedGerman])],
      explanation:
        lexeme.exampleDe && lexeme.exampleCs
          ? `${lexeme.exampleDe} — ${lexeme.exampleCs}`
          : request.motherTongue === 'en'
            ? `The target expression is “${answer}”.`
            : `Cílový výraz je „${answer}“.`,
      sourceNoteIds: [lexeme.noteId],
      objectiveIds: request.objectiveIds.slice(0, 1),
      provenance: 'demo-template' as const,
    };
  });
  return { drills, available: true, model: DEMO_MODEL };
}

export function demoAdaptiveHint(request: AiAdaptiveHintRequest): AiAdaptiveHintResult {
  const label = request.note.article
    ? request.motherTongue === 'en'
      ? `a noun with the article “${request.note.article}”`
      : `podstatné jméno rodu „${request.note.article}“`
    : request.note.kind === 'verb'
      ? request.motherTongue === 'en'
        ? 'a verb; check its inflected form and position'
        : 'sloveso; zkontroluj jeho časovaný tvar a pozici'
      : request.motherTongue === 'en'
        ? `an expression of type “${request.note.kind}”`
        : `výraz typu „${request.note.kind}“`;
  return {
    hint: request.revealAnswer
      ? request.motherTongue === 'en'
        ? `The target expression is ${request.note.article ? `${request.note.article} ` : ''}${request.note.german}.`
        : `Cílový výraz je ${request.note.article ? `${request.note.article} ` : ''}${request.note.german}.`
      : request.motherTongue === 'en'
        ? `Look for ${label}; the meaning is “${request.note.czech}”.`
        : `Hledej ${label}; význam je „${request.note.czech}“.`,
    rule:
      request.mistakeTags.includes('article') && request.note.article
        ? request.motherTongue === 'en'
          ? `Learn this entry with the article ${request.note.article}.`
          : `Tento záznam se učí se členem ${request.note.article}.`
        : request.motherTongue === 'en'
          ? 'Recall the meaning, then check the form in the complete sentence.'
          : 'Vybav si význam a potom ověř tvar v celé větě.',
    exampleDe: request.note.exampleDe ?? `Ich übe den Ausdruck ${request.note.german}.`,
    exampleCs:
      request.note.exampleCs ??
      (request.motherTongue === 'en'
        ? `I am practising the expression ${request.note.czech}.`
        : `Procvičuji výraz ${request.note.czech}.`),
    confidence: request.note.exampleDe ? 'high' : 'medium',
    sourceObjectiveIds: request.objectiveIds.slice(0, 2),
    model: DEMO_MODEL,
  };
}

function normalizedIncludes(message: string, word: string): boolean {
  const haystack = message.toLocaleLowerCase('de-DE');
  const needle = word
    .replace(/^(der|die|das)\s+/iu, '')
    .split(/\s+/u)
    .find((part) => part.length >= 3)
    ?.toLocaleLowerCase('de-DE');
  return Boolean(needle && haystack.includes(needle));
}
