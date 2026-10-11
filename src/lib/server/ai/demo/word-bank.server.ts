import type { AiGeneratedVocabularyItem } from '../../../domain/ai/types.ts';
import type { CefrLevel, LexemeKind } from '../../../domain/types.ts';

export type DemoEntry = Omit<AiGeneratedVocabularyItem, 'cefr'> & { cefr?: CefrLevel };

export function entry(
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

export const common: DemoEntry[] = [
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

export const travel: DemoEntry[] = [
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

export const school: DemoEntry[] = [
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

export const food: DemoEntry[] = [
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
  entry('Ich hätte gern …', 'Dám si …', 'phrase', {
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

export const shopping: DemoEntry[] = [
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

export const topicGroups = [
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
