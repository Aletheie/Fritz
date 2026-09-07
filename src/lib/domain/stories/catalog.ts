import { buildStoryEpisodes, paginateStorySource } from './engine.ts';
import { enrichStoryGlossary } from './reading-support.ts';

import type { CefrLevel, LexemeKind } from '../types.ts';
import type { StoryEpisodeBlueprint } from './engine.ts';
import type {
  StoryBook,
  StoryBookId,
  StoryBookSummary,
  StoryGlossaryEntry,
  StoryPage,
} from './types.ts';

type GlossaryOptions = {
  kind?: LexemeKind;
  forms?: string[];
  distractors?: string[];
  article?: 'der' | 'die' | 'das';
  plural?: string;
  learningNote?: string;
  exampleDe?: string;
  exampleCs?: string;
};

function glossary(
  id: string,
  german: string,
  czech: string,
  cefr: CefrLevel,
  options: GlossaryOptions = {},
): StoryGlossaryEntry {
  return {
    id,
    german,
    czech,
    cefr,
    kind: options.kind ?? 'other',
    forms: options.forms ?? [],
    distractors: options.distractors ?? ['gestern', 'ruhig'],
    article: options.article,
    plural: options.plural,
    learningNote: options.learningNote ?? `V příběhu znamená „${german}“ ${czech}.`,
    exampleDe: options.exampleDe,
    exampleCs: options.exampleCs,
  };
}

const a1Glossary: StoryGlossaryEntry[] = [
  glossary('a1-korn', 'Korn', 'obilí', 'A2', {
    kind: 'noun',
    article: 'das',
    plural: 'Körner',
    distractors: ['Haus', 'Garten'],
    learningNote: '„Korn“ je souhrnné označení obilí; v textu ho myš nachází v domě.',
  }),
  glossary('a1-fressen', 'fressen', 'žrát', 'A2', {
    kind: 'verb',
    forms: ['fraß', 'gefressen'],
    distractors: ['schlafen', 'bauen'],
    learningNote: '„Fressen“ se používá pro zvířata. U lidí se říká neutrálně „essen“.',
  }),
  glossary('a1-plagen', 'plagen', 'trápit, škádlit', 'B1', {
    kind: 'verb',
    forms: ['plagt', 'geplagt', 'plagte'],
    distractors: ['helfen', 'sehen'],
  }),
  glossary('a1-horn', 'Hörner', 'rohy', 'A2', {
    kind: 'noun',
    forms: ['Horn'],
    article: 'das',
    plural: 'Hörner',
    distractors: ['Augen', 'Häuser'],
  }),
  glossary('a1-melken', 'melken', 'dojit', 'B1', {
    kind: 'verb',
    forms: ['melkt', 'gemolken'],
    distractors: ['kaufen', 'weinen'],
  }),
  glossary('a1-einwohner', 'Einwohner', 'obyvatel', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Einwohner',
    distractors: ['Schläfer', 'Freund'],
  }),
  glossary('a1-traege', 'träge', 'malátný, líný', 'B1', {
    kind: 'adjective',
    distractors: ['schnell', 'hungrig'],
  }),
  glossary('a1-schlaefrig', 'schläfrig', 'ospalý', 'A2', {
    kind: 'adjective',
    forms: ['schläfrige', 'schläfrigen'],
    distractors: ['wach', 'traurig'],
  }),
  glossary('a1-hoehle', 'Höhle', 'jeskyně', 'A2', {
    kind: 'noun',
    article: 'die',
    plural: 'Höhlen',
    distractors: ['Stadt', 'Sonne'],
  }),
  glossary('a1-juengling', 'Jüngling', 'mladík', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Jünglinge',
    distractors: ['Mädchen', 'Mann'],
  }),
  glossary('a1-aufwachen', 'aufwachen', 'probudit se', 'A2', {
    kind: 'verb',
    forms: ['wachte', 'wachten', 'aufweckte', 'aufzuwachen'],
    distractors: ['einschlafen', 'verschwinden'],
    learningNote:
      'Odlučitelné „aufwachen“ se v příběhu objevuje jako „wachte … auf“; „aufwecken“ znamená někoho probudit.',
  }),
  glossary('a1-geraeusch', 'Geräusch', 'zvuk, šramot', 'B1', {
    kind: 'noun',
    article: 'das',
    plural: 'Geräusche',
    distractors: ['Gespräch', 'Lied'],
    learningNote: '„Geräusch“ je neurčitý zvuk; právě jeden takový po sedmi letech vzbudí spáče.',
  }),
];

const a2Glossary: StoryGlossaryEntry[] = [
  glossary('a2-daemmern', 'dämmern', 'stmívat se', 'A2', {
    kind: 'verb',
    forms: ['dämmerte'],
    distractors: ['schneien', 'frieren'],
  }),
  glossary('a2-buendel', 'Bündel', 'uzel, raneček', 'A2', {
    kind: 'noun',
    article: 'das',
    plural: 'Bündel',
    distractors: ['Brief', 'Bild'],
  }),
  glossary('a2-aengstlich', 'ängstlich', 'úzkostně, bázlivě', 'A2', {
    kind: 'adjective',
    forms: ['ängstliche', 'ängstlichen'],
    distractors: ['fröhlich', 'langsam'],
  }),
  glossary('a2-verwaist', 'verwaist', 'osiřelý', 'B1', {
    kind: 'adjective',
    forms: ['verwaiste', 'verwaistes'],
    distractors: ['berühmt', 'verloren'],
  }),
  glossary('a2-obdach', 'Obdach', 'přístřeší', 'B1', {
    kind: 'noun',
    article: 'das',
    plural: 'Obdächer',
    distractors: ['Geld', 'Feuer'],
  }),
  glossary('a2-erbarmen', 'sich erbarmen', 'slitovat se', 'B2', {
    kind: 'phrase',
    forms: ['erbarmt', 'erbarme'],
    distractors: ['sich verirren', 'sich erinnern'],
  }),
  glossary('a2-folgsam', 'folgsam', 'poslušný', 'B1', {
    kind: 'adjective',
    forms: ['folgsame', 'folgsames'],
    distractors: ['einsam', 'fleißig'],
  }),
  glossary('a2-foerster', 'Förster', 'lesník, hajný', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Förster',
    distractors: ['Künstler', 'Prinz'],
  }),
  glossary('a2-beruehmt', 'berühmt', 'slavný', 'A2', {
    kind: 'adjective',
    forms: ['berühmte', 'berühmten', 'berühmter'],
    distractors: ['krank', 'fremd'],
  }),
  glossary('a2-arbeitsam', 'arbeitsam', 'pracovitý', 'B1', {
    kind: 'adjective',
    distractors: ['reich', 'zufrieden'],
  }),
  glossary('a2-verleumden', 'verleumden', 'pomluvit', 'B2', {
    kind: 'verb',
    forms: ['verleumdet', 'verleumdete'],
    distractors: ['besuchen', 'bewundern'],
  }),
  glossary('a2-sich-entschliessen', 'sich entschließen', 'rozhodnout se', 'B1', {
    kind: 'phrase',
    forms: ['entschloß', 'entschloss'],
    distractors: ['sich bedanken', 'sich verstecken'],
  }),
];

const b1Glossary: StoryGlossaryEntry[] = [
  glossary('b1-flur', 'Fluren', 'polnosti, krajina', 'B2', {
    kind: 'noun',
    forms: ['Flur'],
    article: 'die',
    plural: 'Fluren',
    distractors: ['Höhen', 'Häuser'],
  }),
  glossary('b1-herniederschauen', 'herniederschauen', 'shlížet dolů', 'B2', {
    kind: 'verb',
    distractors: ['hinaufsteigen', 'weitergehen'],
  }),
  glossary('b1-bergkraeuter', 'Bergkräuter', 'horské byliny', 'B1', {
    kind: 'noun',
    forms: ['Bergkraut', 'Bergkräutern'],
    article: 'das',
    plural: 'Bergkräuter',
    distractors: ['Bergschuhe', 'Baumwolltücher'],
  }),
  glossary('b1-entgegenduften', 'entgegenduften', 'vanout vstříc', 'C1', {
    kind: 'verb',
    forms: ['entgegenzuduften'],
    distractors: ['entgegenrufen', 'hinuntersehen'],
  }),
  glossary('b1-sonnverbrannt', 'sonnverbrannt', 'opálený od slunce', 'B2', {
    kind: 'adjective',
    forms: ['sonnverbrannte'],
    distractors: ['glühend', 'blass'],
  }),
  glossary('b1-hinan', 'hinan', 'vzhůru', 'B2', {
    kind: 'other',
    distractors: ['hinunter', 'vorbei'],
  }),
  glossary('b1-weiler', 'Weiler', 'osada', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: 'Weiler',
    distractors: ['Dorf', 'Tal'],
  }),
  glossary('b1-behausung', 'Behausung', 'obydlí, příbytek', 'B2', {
    kind: 'noun',
    forms: ['Behausungen'],
    article: 'die',
    plural: 'Behausungen',
    distractors: ['Almhütte', 'Heimat'],
  }),
  glossary('b1-hinterlassen', 'hinterlassen', 'zanechat', 'B2', {
    kind: 'verb',
    forms: ['hinterlassene', 'hinterließ'],
    distractors: ['mitnehmen', 'vergessen'],
  }),
  glossary('b1-hitzig', 'hitzig', 'prudký, rozčilený', 'B2', {
    kind: 'adjective',
    distractors: ['freundlich', 'still'],
  }),
  glossary('b1-verstockt', 'verstockt', 'zatvrzelý', 'C1', {
    kind: 'adjective',
    forms: ['verstockter'],
    distractors: ['einsichtig', 'versöhnlich'],
    learningNote: '„Verstockt“ popisuje člověka, který tvrdošíjně odmítá změnit postoj.',
  }),
  glossary('b1-umherliegen', 'umherliegen', 'ležet kolem', 'B2', {
    kind: 'verb',
    forms: ['umherliegender', 'umherliegende'],
    distractors: ['herumlaufen', 'hinaufgehen'],
  }),
];

const b2Glossary: StoryGlossaryEntry[] = [
  glossary('b2-urgrossmutter', 'Urgroßmutter', 'prababička', 'B2', {
    kind: 'noun',
    article: 'die',
    plural: 'Urgroßmütter',
    distractors: ['Enkelin', 'Mutter'],
  }),
  glossary('b2-entsinnen', 'sich entsinnen', 'rozpomenout se', 'C1', {
    kind: 'phrase',
    forms: ['entsinnen', 'entsinne'],
    distractors: ['sich irren', 'sich fürchten'],
  }),
  glossary('b2-verbürgen', 'verbürgen', 'zaručit, dosvědčit', 'C1', {
    kind: 'verb',
    forms: ['verbürge'],
    distractors: ['bestreiten', 'erzählen'],
  }),
  glossary('b2-tatsache', 'Tatsachen', 'skutečnosti', 'B2', {
    kind: 'noun',
    forms: ['Tatsache'],
    article: 'die',
    plural: 'Tatsachen',
    distractors: ['Geschichten', 'Erinnerungen'],
  }),
  glossary('b2-deich', 'Deich', 'hráz proti moři', 'B2', {
    kind: 'noun',
    forms: ['Deiche', 'Deiches', 'Deiche'],
    article: 'der',
    plural: 'Deiche',
    distractors: ['Weg', 'Sturm'],
  }),
  glossary('b2-wattenmeer', 'Wattenmeer', 'watové moře, přílivová mělčina', 'C1', {
    kind: 'noun',
    article: 'das',
    plural: 'Wattenmeere',
    distractors: ['Festland', 'Wolkenmeer'],
  }),
  glossary('b2-daemmerung', 'Dämmerung', 'soumrak', 'B2', {
    kind: 'noun',
    forms: ['Nachtdämmerung'],
    article: 'die',
    plural: 'Dämmerungen',
    distractors: ['Dunkelheit', 'Sturmflut'],
  }),
  glossary('b2-sturmflut', 'Sturmflut', 'bouřlivý příliv', 'C1', {
    kind: 'noun',
    forms: ['Sturmfluten'],
    article: 'die',
    plural: 'Sturmfluten',
    distractors: ['Nordsee', 'Welle'],
  }),
  glossary('b2-werfte', 'Werfte', 'vyvýšené návrší pro dům', 'C1', {
    kind: 'noun',
    forms: ['Werften'],
    article: 'die',
    plural: 'Werften',
    distractors: ['Wehle', 'Hütte'],
    learningNote: 'Severoněmecké „Werft“ zde označuje umělý pahorek chránící dům před vodou.',
  }),
  glossary('b2-verklommen', 'verklommen', 'zkřehlý', 'C1', {
    kind: 'adjective',
    forms: ['verklommenen'],
    distractors: ['nass', 'kräftig'],
  }),
  glossary('b2-unwetter', 'Unwetter', 'prudká bouře, nečas', 'B2', {
    kind: 'noun',
    article: 'das',
    plural: 'Unwetter',
    distractors: ['Oktober', 'Wutgebrüll'],
  }),
  glossary('b2-bedächtig', 'bedächtig', 'rozvážně', 'C1', {
    kind: 'adjective',
    distractors: ['hastig', 'laut'],
  }),
];

const c1Glossary: StoryGlossaryEntry[] = [
  glossary('c1-ungeziefer', 'Ungeziefer', 'havěť', 'C1', {
    kind: 'noun',
    article: 'das',
    plural: '—',
    distractors: ['Reisender', 'Tierstimme'],
    learningNote:
      'Kafka záměrně nepojmenovává konkrétního živočicha; „Ungeziefer“ zůstává neurčité.',
  }),
  glossary('c1-gewoelbt', 'gewölbt', 'vyklenutý', 'C1', {
    kind: 'adjective',
    forms: ['gewölbten'],
    distractors: ['flach', 'dünn'],
  }),
  glossary('c1-versteifung', 'Versteifungen', 'ztužení, výztuhy', 'C1', {
    kind: 'noun',
    forms: ['Versteifung'],
    article: 'die',
    plural: 'Versteifungen',
    distractors: ['Beine', 'Wände'],
  }),
  glossary('c1-gaenzlich', 'gänzlich', 'zcela, naprosto', 'C1', {
    kind: 'other',
    distractors: ['allmählich', 'kaum'],
  }),
  glossary('c1-musterkollektion', 'Musterkollektion', 'kolekce vzorků', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Musterkollektionen',
    distractors: ['Zeitschrift', 'Bettdecke'],
  }),
  glossary('c1-melancholisch', 'melancholisch', 'melancholický, sklíčený', 'B2', {
    kind: 'adjective',
    distractors: ['aufgeregt', 'zufrieden'],
  }),
  glossary('c1-undurchfuehrbar', 'undurchführbar', 'neproveditelný', 'C1', {
    kind: 'adjective',
    distractors: ['möglich', 'unnötig'],
  }),
  glossary('c1-anstrengend', 'anstrengend', 'namáhavý', 'B2', {
    kind: 'adjective',
    forms: ['anstrengenden'],
    distractors: ['bequem', 'seltsam'],
  }),
  glossary('c1-aufregung', 'Aufregung', 'rozrušení', 'B2', {
    kind: 'noun',
    forms: ['Aufregungen'],
    article: 'die',
    plural: 'Aufregungen',
    distractors: ['Rücksicht', 'Gewohnheit'],
  }),
  glossary('c1-allmaehlich', 'allmählich', 'postupně', 'B2', {
    kind: 'other',
    distractors: ['sofort', 'gänzlich'],
  }),
  glossary('c1-prokurist', 'Prokurist', 'prokurista, zmocněný vedoucí', 'C1', {
    kind: 'noun',
    forms: ['Prokuristen'],
    article: 'der',
    plural: 'Prokuristen',
    distractors: ['Reisender', 'Vater'],
  }),
  glossary('c1-besinnungslos', 'besinnungslos', 'jako smyslů zbavený', 'C1', {
    kind: 'adjective',
    distractors: ['besonnen', 'vorsichtig'],
    learningNote:
      'V této scéně „besinnungslos“ neznamená jen bezvědomí, ale jednání bez rozmyslu a se vší silou.',
  }),
  glossary('c1-kläglich', 'kläglich', 'žalostně, uboze', 'C1', {
    kind: 'adjective',
    forms: ['kläglich'],
    distractors: ['auffallend', 'kräftig'],
  }),
  glossary('c1-begierig', 'begierig', 'dychtivý, nedočkavý', 'C1', {
    kind: 'adjective',
    distractors: ['gleichgültig', 'erschrocken'],
  }),
];

const a1HaewelmannGlossary: StoryGlossaryEntry[] = [
  glossary('a1h-rollbett', 'Rollbett', 'postel na kolečkách', 'A1', {
    kind: 'noun',
    article: 'das',
    plural: 'Rollbetten',
    forms: ['Rollbette'],
    distractors: ['Fenster', 'Hemd'],
  }),
  glossary('a1h-bettstelle', 'Bettstelle', 'postel, lůžko', 'A2', {
    kind: 'noun',
    article: 'die',
    plural: 'Bettstellen',
    forms: ['Bettstelle'],
    distractors: ['Straße', 'Laterne'],
  }),
  glossary('a1h-himmelbett', 'Himmelbett', 'postel s nebesy', 'A2', {
    kind: 'noun',
    article: 'das',
    plural: 'Himmelbetten',
    forms: ['Himmelbett'],
    distractors: ['Rollbett', 'Boot'],
  }),
  glossary('a1h-posserlich', 'possierlich', 'legrační, roztomilý', 'B1', {
    kind: 'adjective',
    forms: ['possierlich'],
    distractors: ['dunkel', 'einsam'],
  }),
  glossary('a1h-hemdzipfel', 'Hemdzipfel', 'cíp košile', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Hemdzipfel',
    forms: ['Hemdzipfelchen'],
    distractors: ['Pelzärmel', 'Fußboden'],
  }),
  glossary('a1h-backen', 'Backen', 'tváře', 'A2', {
    kind: 'noun',
    article: 'die',
    plural: 'Backen',
    forms: ['Backen'],
    distractors: ['Augen', 'Hände'],
  }),
  glossary('a1h-schluesselloch', 'Schlüsselloch', 'klíčová dírka', 'A2', {
    kind: 'noun',
    article: 'das',
    plural: 'Schlüssellöcher',
    forms: ['Schlüsselloch'],
    distractors: ['Fenster', 'Tür'],
  }),
  glossary('a1h-pflaster', 'Straßenpflaster', 'dlažba ulice', 'B1', {
    kind: 'noun',
    article: 'das',
    plural: 'Straßenpflaster',
    forms: ['Straßenpflaster'],
    distractors: ['Fußboden', 'Feld'],
  }),
  glossary('a1h-kraehen', 'krähen', 'kokrhat', 'A2', {
    kind: 'verb',
    forms: ['krähte', 'krähe'],
    distractors: ['rufen', 'schlafen'],
  }),
  glossary('a1h-funkeln', 'funkeln', 'třpytit se', 'A2', {
    kind: 'verb',
    forms: ['funkelte', 'funkelten'],
    distractors: ['rollen', 'leuchten'],
  }),
  glossary('a1h-heide', 'Heide', 'vřesoviště', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Heiden',
    forms: ['Heide'],
    distractors: ['Wald', 'Himmel'],
  }),
  glossary('a1h-ertrinken', 'ertrinken', 'utopit se', 'A2', {
    kind: 'verb',
    forms: ['ertrinken'],
    distractors: ['schwimmen', 'fallen'],
  }),
];

const a2MaxMoritzGlossary: StoryGlossaryEntry[] = [
  glossary('a2m-streich', 'Streich', 'rošťárna, kousek', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Streiche',
    forms: ['Streich', 'Streiche', 'Streichen'],
    distractors: ['Schule', 'Zweck'],
  }),
  glossary('a2m-federvieh', 'Federvieh', 'drůbež', 'B1', {
    kind: 'noun',
    article: 'das',
    plural: '—',
    forms: ['Federvieh'],
    distractors: ['Hühner', 'Käfer'],
  }),
  glossary('a2m-pfuehl', 'Pfühl', 'poduška, polštář', 'C1', {
    kind: 'noun',
    article: 'der',
    plural: 'Pfühle',
    forms: ['Pfühle'],
    distractors: ['Kissen', 'Decke'],
    learningNote: '„Pfühl“ je dnes už zastaralé slovo pro velký polštář nebo podušku.',
  }),
  glossary('a2m-witwe', 'Witwe', 'vdova', 'A2', {
    kind: 'noun',
    article: 'die',
    plural: 'Witwen',
    forms: ['Witwe'],
    distractors: ['Bäcker', 'Lehrer'],
  }),
  glossary('a2m-dienstbeflissen', 'dienstbeflissen', 'přehnaně ochotný posloužit', 'C1', {
    kind: 'adjective',
    distractors: ['nachlässig', 'unhöflich'],
    learningNote:
      'Knižní „dienstbeflissen“ označuje někoho, kdo je velmi horlivě připraven druhému posloužit.',
  }),
  glossary('a2m-steg', 'Steg', 'lávka', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Stege',
    forms: ['Stege'],
    distractors: ['Dach', 'Bach'],
  }),
  glossary('a2m-saege', 'Säge', 'pila', 'A2', {
    kind: 'noun',
    article: 'die',
    plural: 'Sägen',
    forms: ['Säge'],
    distractors: ['Brücke', 'Pfeife'],
  }),
  glossary('a2m-pulver', 'Pulver', 'střelný prach', 'A2', {
    kind: 'noun',
    article: 'das',
    plural: 'Pulver',
    forms: ['Pulver'],
    distractors: ['Mehl', 'Tabak'],
  }),
  glossary('a2mm-kaefer', 'Käfer', 'brouk; zde chroust', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Käfer',
    forms: ['Käfer', 'Käferkrabbelei'],
    distractors: ['Hühner', 'Gänse'],
    learningNote:
      'Ve verši je „Maikäfer“ rozděleno přes konec řádku jako „Mai-Käfer“; samotné „Käfer“ znamená brouk.',
  }),
  glossary('a2m-duete', 'Düte', 'papírový sáček (dnes Tüte)', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Düten',
    forms: ['Düte'],
    distractors: ['Tasche', 'Kiste'],
    learningNote: '„Düte“ je historický pravopis dnešního slova „Tüte“.',
  }),
  glossary('a2m-backhaus', 'Backhaus', 'pekárna, pečicí domek', 'B1', {
    kind: 'noun',
    article: 'das',
    plural: 'Backhäuser',
    forms: ['Backhaus'],
    distractors: ['Schule', 'Mühle'],
  }),
  glossary('a2m-schroten', 'schroten', 'hrubě semlít', 'B2', {
    kind: 'verb',
    forms: ['geschroten'],
    distractors: ['backen', 'sägen'],
  }),
  glossary('a2m-uebeltat', 'Übeltäterei', 'páchání nepravostí', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Übeltätereien',
    forms: ['Übeltäterei'],
    distractors: ['Trauer', 'Bosheit'],
  }),
];

const b1KleiderGlossary: StoryGlossaryEntry[] = [
  glossary('b1k-schneider', 'Schneider', 'krejčí', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Schneider',
    forms: ['Schneiderlein', 'Schneiders'],
    distractors: ['Kutscher', 'Amtsrat'],
  }),
  glossary('b1k-fingerhut', 'Fingerhut', 'náprstek', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Fingerhüte',
    forms: ['Fingerhut'],
    distractors: ['Münze', 'Handschuh'],
  }),
  glossary('b1k-falliment', 'Falliment', 'bankrot, úpadek', 'C1', {
    kind: 'noun',
    article: 'das',
    plural: 'Fallimente',
    forms: ['Fallimentes'],
    distractors: ['Vermögen', 'Geschäft'],
    learningNote: 'Historické „Falliment“ odpovídá dnešnímu „Bankrott“ nebo „Konkurs“.',
  }),
  glossary('b1k-arbeitslohn', 'Arbeitslohn', 'mzda za práci', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Arbeitslöhne',
    forms: ['Arbeitslohn'],
    distractors: ['Mittagsbrot', 'Vermögen'],
  }),
  glossary('b1k-radmantel', 'Radmantel', 'široký kruhový plášť', 'C1', {
    kind: 'noun',
    article: 'der',
    plural: 'Radmäntel',
    forms: ['Radmantel', 'Radmantels'],
    distractors: ['Pelzmütze', 'Sammet'],
  }),
  glossary('b1k-sammet', 'Sammet', 'samet', 'C1', {
    kind: 'noun',
    article: 'der',
    plural: 'Sammete',
    forms: ['Sammet', 'Sammetfutter', 'Sammetwesten'],
    distractors: ['Tuch', 'Pelz'],
    learningNote: '„Sammet“ je starší podoba dnešního slova „Samt“.',
  }),
  glossary('b1k-gewaehren', 'gewähren lassen', 'nechat někoho v klidu jednat', 'B2', {
    kind: 'phrase',
    forms: ['gewähren'],
    distractors: ['betrügen', 'verhungern'],
  }),
  glossary('b1k-kutscher', 'Kutscher', 'kočí', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Kutscher',
    forms: ['Kutscher'],
    distractors: ['Schneider', 'Gastwirt'],
  }),
  glossary('b1k-zeche', 'Zeche', 'účet v hostinci', 'B2', {
    kind: 'noun',
    article: 'die',
    plural: 'Zechen',
    forms: ['Zeche'],
    distractors: ['Rechnung', 'Münze'],
  }),
  glossary('b1k-graf', 'Graf', 'hrabě', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Grafen',
    forms: ['Graf', 'Grafen'],
    distractors: ['Schneider', 'Amtsrat'],
  }),
  glossary('b1k-argwohn', 'Argwohn', 'podezření', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: '—',
    forms: ['Argwohn'],
    distractors: ['Vertrauen', 'Neugierde'],
  }),
  glossary('b1k-verlobung', 'Verlobung', 'zasnoubení', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Verlobungen',
    forms: ['Verlobung'],
    distractors: ['Hochzeit', 'Schlittenfahrt'],
  }),
  glossary('b1k-aufgebot', 'Aufgebot', 'úřední ohlášky sňatku', 'C1', {
    kind: 'noun',
    article: 'das',
    plural: 'Aufgebote',
    forms: ['Aufgebot'],
    distractors: ['Zeugnis', 'Verfahren'],
  }),
  glossary('b1k-leumund', 'Leumund', 'pověst, bezúhonnost', 'C1', {
    kind: 'noun',
    article: 'der',
    plural: '—',
    forms: ['Leumunds'],
    distractors: ['Rang', 'Name'],
  }),
  glossary('b1k-sparsam', 'sparsam', 'spořivý', 'B1', {
    kind: 'adjective',
    forms: ['sparsam'],
    distractors: ['fleißig', 'verschwenderisch'],
  }),
  glossary('b1k-ansehen', 'angesehen', 'vážený, respektovaný', 'B2', {
    kind: 'adjective',
    forms: ['angesehener'],
    distractors: ['arm', 'fremd'],
  }),
];

const b2SandmannGlossary: StoryGlossaryEntry[] = [
  glossary('b2s-zuernen', 'zürnen', 'hněvat se', 'B2', {
    kind: 'verb',
    forms: ['zürnt'],
    distractors: ['lächeln', 'bitten'],
  }),
  glossary('b2s-ahnung', 'Ahnung', 'tušení', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Ahnungen',
    forms: ['Ahnungen', 'Ahnung'],
    distractors: ['Gedanke', 'Erinnerung'],
  }),
  glossary('b2s-geschick', 'Geschick', 'osud', 'B2', {
    kind: 'noun',
    article: 'das',
    plural: 'Geschicke',
    forms: ['Geschicks'],
    distractors: ['Zufall', 'Leben'],
  }),
  glossary('b2s-wetterglas', 'Wetterglashändler', 'prodavač barometrů', 'C1', {
    kind: 'noun',
    article: 'der',
    plural: 'Wetterglashändler',
    forms: ['Wetterglashändler', 'Wetterglashändlers'],
    distractors: ['Krämer', 'Advokat'],
  }),
  glossary('b2s-kraemer', 'Krämer', 'podomní obchodník', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: 'Krämer',
    forms: ['Krämers'],
    distractors: ['Vater', 'Optikus'],
  }),
  glossary('b2s-ermann', 'sich ermannen', 'vzchopit se', 'C1', {
    kind: 'phrase',
    forms: ['ermannend'],
    distractors: ['sich fürchten', 'sich erinnern'],
  }),
  glossary('b2s-lehnstuhl', 'Lehnstuhl', 'křeslo s opěradlem', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: 'Lehnstühle',
    forms: ['Lehnstuhl'],
    distractors: ['Tisch', 'Zimmer'],
  }),
  glossary('b2s-ammenmaerchen', 'Ammenmärchen', 'babská povídačka', 'C1', {
    kind: 'noun',
    article: 'das',
    plural: 'Ammenmärchen',
    forms: ['Ammenmärchen'],
    distractors: ['Geschichte', 'Brief'],
  }),
  glossary('b2s-graesslich', 'gräßlich', 'děsivý, příšerný', 'B2', {
    kind: 'adjective',
    forms: ['gräßlichen', 'gräßliche'],
    distractors: ['anmutig', 'freundlich'],
  }),
  glossary('b2s-perspektiv', 'Perspektiv', 'dalekohled', 'C1', {
    kind: 'noun',
    article: 'das',
    plural: 'Perspektive',
    forms: ['Perspektiv', 'Perspektive'],
    distractors: ['Brille', 'Fenster'],
  }),
  glossary('b2s-automat', 'Automat', 'automat, mechanická figura', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: 'Automaten',
    forms: ['Automat', 'Automats'],
    distractors: ['Mensch', 'Puppe'],
  }),
  glossary('b2s-traeumerei', 'Träumerei', 'snění, blouznění', 'B2', {
    kind: 'noun',
    article: 'die',
    plural: 'Träumereien',
    forms: ['Träumereien'],
    distractors: ['Gedanken', 'Wissenschaft'],
  }),
  glossary('b2s-gelaender', 'Geländer', 'zábradlí', 'B1', {
    kind: 'noun',
    article: 'das',
    plural: 'Geländer',
    forms: ['Geländer'],
    distractors: ['Galerie', 'Treppe'],
  }),
  glossary('b2s-zerschmettert', 'zerschmettert', 'roztříštěný', 'C1', {
    kind: 'adjective',
    forms: ['zerschmettertem'],
    distractors: ['ohnmächtig', 'ruhig'],
  }),
  glossary('b2s-bewandtnis', 'Bewandtnis', 'zvláštní okolnost, podstata věci', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Bewandtnisse',
    forms: ['Bewandtnis'],
    distractors: ['Gestalt', 'Täuschung'],
  }),
];

const c1UrteilGlossary: StoryGlossaryEntry[] = [
  glossary('c1u-kaufmann', 'Kaufmann', 'obchodník', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Kaufleute',
    forms: ['Kaufmann'],
    distractors: ['Freund', 'Vater'],
  }),
  glossary('c1u-jugendfreund', 'Jugendfreund', 'přítel z mládí', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: 'Jugendfreunde',
    forms: ['Jugendfreund', 'Jugendfreundes'],
    distractors: ['Geschäftsfreund', 'Verlobte'],
  }),
  glossary('c1u-fortkommen', 'Fortkommen', 'životní úspěch, postup', 'C1', {
    kind: 'noun',
    article: 'das',
    plural: '—',
    forms: ['Fortkommen'],
    distractors: ['Geschäft', 'Reise'],
  }),
  glossary('c1u-foermlich', 'förmlich', 'přímo, doslova; formálně', 'B2', {
    kind: 'adjective',
    forms: ['förmlich'],
    distractors: ['spielerisch', 'selten'],
  }),
  glossary('c1u-stocken', 'stocken', 'váznout, stagnovat', 'B2', {
    kind: 'verb',
    forms: ['stocken'],
    distractors: ['wachsen', 'gelingen'],
  }),
  glossary('c1u-verlobung', 'Verlobung', 'zasnoubení', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Verlobungen',
    forms: ['Verlobung'],
    distractors: ['Freundschaft', 'Hochzeit'],
  }),
  glossary('c1u-braut', 'Braut', 'nevěsta, snoubenka', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Bräute',
    forms: ['Braut'],
    distractors: ['Mutter', 'Schwester'],
  }),
  glossary('c1u-schlafrock', 'Schlafrock', 'župan', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: 'Schlafröcke',
    forms: ['Schlafrock', 'Schlafrocks'],
    distractors: ['Hemd', 'Mantel'],
  }),
  glossary('c1u-vorwurf', 'Vorwurf', 'výčitka', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: 'Vorwürfe',
    forms: ['Vorwurf', 'Vorwürfe'],
    distractors: ['Urteil', 'Frage'],
  }),
  glossary('c1u-verurteilen', 'verurteilen', 'odsoudit', 'B2', {
    kind: 'verb',
    forms: ['verurteile'],
    distractors: ['entschuldigen', 'erklären'],
  }),
  glossary('c1u-ertrinken', 'Ertrinken', 'utonutí', 'B2', {
    kind: 'noun',
    article: 'das',
    plural: '—',
    forms: ['Ertrinkens'],
    distractors: ['Sturz', 'Urteil'],
  }),
  glossary('c1u-bedienerin', 'Bedienerin', 'služebná', 'B2', {
    kind: 'noun',
    article: 'die',
    plural: 'Bedienerinnen',
    forms: ['Bedienerin'],
    distractors: ['Braut', 'Mutter'],
  }),
  glossary('c1u-gelaender', 'Geländer', 'zábradlí', 'B1', {
    kind: 'noun',
    article: 'das',
    plural: 'Geländer',
    forms: ['Geländer', 'Geländerstangen'],
    distractors: ['Brücke', 'Treppe'],
  }),
  glossary('c1u-uebertoenen', 'übertönen', 'přehlušit', 'C1', {
    kind: 'verb',
    forms: ['übertönen'],
    distractors: ['hören', 'rufen'],
  }),
];

const a1BremerGlossary: StoryGlossaryEntry[] = [
  glossary('a1b-unverdrossen', 'unverdrossen', 'neúnavně, vytrvale', 'B1', {
    kind: 'adjective',
    distractors: ['ängstlich', 'heimlich'],
  }),
  glossary('a1b-untauglich', 'untauglich', 'nezpůsobilý, nepoužitelný', 'B1', {
    kind: 'adjective',
    forms: ['untauglicher'],
    distractors: ['musikalisch', 'hungrig'],
  }),
  glossary('a1b-reissaus', 'Reißaus nehmen', 'vzít nohy na ramena', 'B1', {
    kind: 'phrase',
    forms: ['Reißaus'],
    distractors: ['Platz nehmen', 'Abschied nehmen'],
  }),
  glossary('a1b-jappen', 'jappen', 'funět, lapat po dechu', 'B1', {
    kind: 'verb',
    forms: ['jappte', 'jappst'],
    distractors: ['singen', 'schlafen'],
  }),
  glossary('a1b-ersaeufen', 'ersäufen', 'utopit', 'B2', {
    kind: 'verb',
    distractors: ['füttern', 'retten'],
  }),
  glossary('a1b-raeuber', 'Räuber', 'lupič', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Räuber',
    forms: ['Räuberhaus'],
    distractors: ['Musiker', 'Bauer'],
  }),
  glossary('a1b-musizieren', 'musizieren', 'hrát hudbu', 'A2', {
    kind: 'verb',
    distractors: ['arbeiten', 'reisen'],
  }),
  glossary('a1b-erschrecken', 'erschrecken', 'polekat se', 'A2', {
    kind: 'verb',
    forms: ['erschrak'],
    distractors: ['lachen', 'warten'],
  }),
];

const a2AliceGlossary: StoryGlossaryEntry[] = [
  glossary('a2a-langweilen', 'sich langweilen', 'nudit se', 'A2', {
    kind: 'phrase',
    forms: ['langweilen'],
    distractors: ['sich beeilen', 'sich erinnern'],
  }),
  glossary('a2a-gaensebluemchen', 'Gänseblümchen', 'sedmikráska', 'A2', {
    kind: 'noun',
    article: 'das',
    plural: 'Gänseblümchen',
    distractors: ['Schlüssel', 'Kaninchen'],
  }),
  glossary('a2a-kaninchenbau', 'Kaninchenbau', 'králičí nora', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Kaninchenbauten',
    distractors: ['Garten', 'Brunnen'],
  }),
  glossary('a2a-westentasche', 'Westentasche', 'kapsa u vesty', 'A2', {
    kind: 'noun',
    article: 'die',
    plural: 'Westentaschen',
    distractors: ['Landkarte', 'Glastür'],
  }),
  glossary('a2a-neugierig', 'neugierig', 'zvědavě, zvědavý', 'A2', {
    kind: 'adjective',
    distractors: ['langweilig', 'vorsichtig'],
  }),
  glossary('a2a-brunnen', 'Brunnen', 'studna', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Brunnen',
    distractors: ['Tunnel', 'Schrank'],
  }),
  glossary('a2a-vorhang', 'Vorhang', 'závěs', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Vorhänge',
    distractors: ['Tisch', 'Schlüssel'],
  }),
  glossary('a2a-flaeschchen', 'Fläschchen', 'lahvička', 'A2', {
    kind: 'noun',
    article: 'das',
    plural: 'Fläschchen',
    distractors: ['Kästchen', 'Töpfchen'],
  }),
];

const b1NilsGlossary: StoryGlossaryEntry[] = [
  glossary('b1n-wichtel', 'Wichtelmännchen', 'skřítek', 'B1', {
    kind: 'noun',
    article: 'das',
    plural: 'Wichtelmännchen',
    distractors: ['Nachbar', 'Jäger'],
  }),
  glossary('b1n-predigt', 'Predigt', 'kázání', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Predigten',
    distractors: ['Geschichte', 'Aufgabe'],
  }),
  glossary('b1n-flinte', 'Flinte', 'puška', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Flinten',
    distractors: ['Peitsche', 'Laterne'],
  }),
  glossary('b1n-postille', 'Postille', 'sbírka kázání', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Postillen',
    distractors: ['Chronik', 'Landkarte'],
  }),
  glossary('b1n-truhe', 'Truhe', 'truhla', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Truhen',
    distractors: ['Schublade', 'Kiste'],
  }),
  glossary('b1n-fliegennetz', 'Fliegennetz', 'síťka na mouchy', 'B1', {
    kind: 'noun',
    article: 'das',
    plural: 'Fliegennetze',
    distractors: ['Fischernetz', 'Fensterkreuz'],
  }),
  glossary('b1n-winzig', 'winzig', 'malinký', 'B1', {
    kind: 'adjective',
    distractors: ['riesig', 'unsichtbar'],
  }),
  glossary('b1n-verzaubern', 'verzaubern', 'začarovat', 'B1', {
    kind: 'verb',
    forms: ['verzaubert', 'verhext'],
    distractors: ['befreien', 'verstecken'],
  }),
];

const b2TaugenichtsGlossary: StoryGlossaryEntry[] = [
  glossary('b2t-muehle', 'Mühle', 'mlýn', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Mühlen',
    distractors: ['Werkstatt', 'Scheune'],
  }),
  glossary('b2t-schlendern', 'schlendern', 'toulat se, loudat se', 'B2', {
    kind: 'verb',
    forms: ['schlenderte'],
    distractors: ['eilen', 'klettern'],
  }),
  glossary('b2t-geige', 'Geige', 'housle', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Geigen',
    forms: ['Geigenspiel'],
    distractors: ['Flöte', 'Trommel'],
  }),
  glossary('b2t-landstrasse', 'Landstraße', 'silnice krajinou', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Landstraßen',
    distractors: ['Gasse', 'Grenze'],
  }),
  glossary('b2t-reisewagen', 'Reisewagen', 'cestovní kočár', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: 'Reisewagen',
    distractors: ['Güterwagen', 'Handkarren'],
  }),
  glossary('b2t-gaertner', 'Gärtner', 'zahradník', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Gärtner',
    forms: ['Gärtnerbursche'],
    distractors: ['Kutscher', 'Müller'],
  }),
  glossary('b2t-verspotten', 'verspotten', 'zesměšňovat', 'B2', {
    kind: 'verb',
    forms: ['verspottet'],
    distractors: ['bewundern', 'begrüßen'],
  }),
  glossary('b2t-hecke', 'Hecke', 'živý plot', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Hecken',
    forms: ['Hecken'],
    distractors: ['Wiese', 'Mauer'],
  }),
];

const c1KrugGlossary: StoryGlossaryEntry[] = [
  glossary('c1k-straucheln', 'straucheln', 'klopýtnout', 'C1', {
    kind: 'verb',
    forms: ['Straucheln', 'gestrauchelt'],
    distractors: ['knien', 'fliehen'],
  }),
  glossary('c1k-verbinden', 'sich verbinden', 'obvázat si', 'B2', {
    kind: 'phrase',
    forms: ['verbindet'],
    distractors: ['sich verbeugen', 'sich verstecken'],
  }),
  glossary('c1k-peruecke', 'Perücke', 'paruka', 'B2', {
    kind: 'noun',
    article: 'die',
    plural: 'Perücken',
    distractors: ['Mütze', 'Uniform'],
  }),
  glossary('c1k-wunde', 'Wunde', 'rána', 'B2', {
    kind: 'noun',
    article: 'die',
    plural: 'Wunden',
    distractors: ['Narbe', 'Schramme'],
  }),
  glossary('c1k-gerichtsrat', 'Gerichtsrat', 'soudní rada', 'C1', {
    kind: 'noun',
    article: 'der',
    plural: 'Gerichtsräte',
    distractors: ['Dorfrichter', 'Schreiber'],
  }),
  glossary('c1k-registratur', 'Registratur', 'spisovna, evidence', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Registraturen',
    distractors: ['Gerichtsstube', 'Kanzlei'],
  }),
  glossary('c1k-argwohn', 'Argwohn', 'podezřívavost', 'C1', {
    kind: 'noun',
    article: 'der',
    plural: '—',
    distractors: ['Nachsicht', 'Ungeduld'],
  }),
  glossary('c1k-richtstuhl', 'Richtstuhl', 'soudcovské křeslo', 'C1', {
    kind: 'noun',
    article: 'der',
    plural: 'Richtstühle',
    distractors: ['Lehnstuhl', 'Zeugenstand'],
  }),
];

const a1FabelnGlossary: StoryGlossaryEntry[] = [
  glossary('a1f-ross', 'Roß', 'kůň, oř', 'B1', {
    kind: 'noun',
    article: 'das',
    plural: 'Rosse',
    forms: ['Rosse'],
    distractors: ['Stier', 'Esel'],
    learningNote: 'Starší podoba „Roß“ se dnes píše „Ross“ a označuje koně.',
  }),
  glossary('a1f-stier', 'Stier', 'býk', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Stiere',
    distractors: ['Fuchs', 'Wolf'],
  }),
  glossary('a1f-dreist', 'dreist', 'drzý, troufalý', 'B1', {
    kind: 'adjective',
    forms: ['dreister'],
    distractors: ['vorsichtig', 'müde'],
  }),
  glossary('a1f-nachahmen', 'nachahmen', 'napodobovat', 'B1', {
    kind: 'verb',
    forms: ['nachahmen', 'nachzuahmen'],
    distractors: ['bewundern', 'verstecken'],
  }),
  glossary('a1f-bogen', 'Bogen', 'luk', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Bogen',
    distractors: ['Dorn', 'Schatz'],
  }),
  glossary('a1f-ebenholz', 'Ebenholz', 'ebenové dřevo', 'B2', {
    kind: 'noun',
    article: 'das',
    plural: 'Ebenhölzer',
    distractors: ['Eisen', 'Leder'],
  }),
  glossary('a1f-schnitzen', 'schnitzen', 'vyřezávat', 'B1', {
    kind: 'verb',
    forms: ['schnitzte', 'schnitzen'],
    distractors: ['malen', 'werfen'],
  }),
  glossary('a1f-dorn', 'Dorn', 'trn', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Dornen',
    forms: ['Dornen'],
    distractors: ['Blatt', 'Seil'],
  }),
  glossary('a1f-geizhals', 'Geizhals', 'lakomec', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: 'Geizhälse',
    distractors: ['Nachbar', 'Künstler'],
  }),
  glossary('a1f-entwenden', 'entwenden', 'odcizit', 'C1', {
    kind: 'verb',
    forms: ['entwendet'],
    distractors: ['vergraben', 'benutzen'],
  }),
];

const a2MondfahrtGlossary: StoryGlossaryEntry[] = [
  glossary('a2m-maikaefer', 'Maikäfer', 'chroust', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Maikäfer',
    distractors: ['Biene', 'Ameise'],
  }),
  glossary('a2m-vorhang', 'Vorhang', 'závěs', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Vorhänge',
    forms: ['Vorhängen'],
    distractors: ['Fenster', 'Teppich'],
  }),
  glossary('a2m-zoepfchen', 'Zöpfchen', 'copánek', 'B1', {
    kind: 'noun',
    article: 'das',
    plural: 'Zöpfchen',
    distractors: ['Kapuzen', 'Schleifen'],
  }),
  glossary('a2m-pantoffel', 'Pantoffel', 'papuč', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Pantoffeln',
    forms: ['Pantöffelchen'],
    distractors: ['Handtuch', 'Kissen'],
  }),
  glossary('a2m-brummen', 'brummen', 'bzučet, bručet', 'B1', {
    kind: 'verb',
    forms: ['brummen', 'herumgebrumst'],
    distractors: ['flüstern', 'pfeifen'],
  }),
  glossary('a2m-sich-verirren', 'sich verirren', 'zabloudit', 'B1', {
    kind: 'phrase',
    forms: ['verirrt'],
    distractors: ['sich beeilen', 'sich erinnern'],
  }),
  glossary('a2m-betruebt', 'betrübt', 'zarmoucený', 'B1', {
    kind: 'adjective',
    distractors: ['begeistert', 'hungrig'],
  }),
  glossary('a2m-witwer', 'Witwer', 'vdovec', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Witwer',
    distractors: ['Schuster', 'König'],
  }),
  glossary('a2m-einsperren', 'einsperren', 'zamknout, uvěznit', 'B1', {
    kind: 'verb',
    forms: ['eingesperrt'],
    distractors: ['befreien', 'wecken'],
  }),
  glossary('a2m-ruehrend', 'rührend', 'dojemný', 'B1', {
    kind: 'adjective',
    forms: ['rührend'],
    distractors: ['lächerlich', 'gefährlich'],
  }),
];

const b1ImmenseeGlossary: StoryGlossaryEntry[] = [
  glossary('b1i-abhang', 'Abhang', 'svah', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Abhänge',
    distractors: ['Ufer', 'Gipfel'],
  }),
  glossary('b1i-fernsicht', 'Fernsicht', 'výhled do dálky', 'B2', {
    kind: 'noun',
    article: 'die',
    plural: '—',
    distractors: ['Dämmerung', 'Landschaft'],
  }),
  glossary('b1i-herrenhaus', 'Herrenhaus', 'panské sídlo', 'B1', {
    kind: 'noun',
    article: 'das',
    plural: 'Herrenhäuser',
    forms: ['Herrenhauses'],
    distractors: ['Gartensaal', 'Kirche'],
  }),
  glossary('b1i-entgegenkommen', 'entgegenkommen', 'jít někomu naproti', 'B2', {
    kind: 'verb',
    forms: ['entgegen', 'entgegenkam'],
    distractors: ['zurückkehren', 'vorbeifahren'],
  }),
  glossary('b1i-weingarten', 'Weingarten', 'vinice', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Weingärten',
    forms: ['Weingärten'],
    distractors: ['Obstgarten', 'Blumenbeet'],
  }),
  glossary('b1i-kuechengarten', 'Küchengarten', 'užitková zahrada', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: 'Küchengärten',
    distractors: ['Weinhügel', 'Hofraum'],
  }),
  glossary('b1i-unerwartet', 'unerwartet', 'neočekávaný', 'B1', {
    kind: 'adjective',
    forms: ['unerwarteter'],
    distractors: ['heimlich', 'vertraut'],
  }),
  glossary('b1i-durchnaesst', 'durchnäßt', 'promočený', 'B2', {
    kind: 'adjective',
    forms: ['Durchnäßt'],
    distractors: ['sonnenbeschienen', 'trocken'],
    learningNote: 'Historické „durchnäßt“ se dnes píše „durchnässt“.',
  }),
  glossary('b1i-gestalt', 'Gestalt', 'postava, silueta', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Gestalten',
    forms: ['Frauengestalt'],
    distractors: ['Spiegelbild', 'Stimme'],
  }),
  glossary('b1i-sich-scheuen', 'sich scheuen', 'ostýchat se', 'B2', {
    kind: 'phrase',
    forms: ['scheuen', 'scheute'],
    distractors: ['sich freuen', 'sich nähern'],
  }),
];

const b2BahnwaerterGlossary: StoryGlossaryEntry[] = [
  glossary('b2b-bahnwaerter', 'Bahnwärter', 'železniční strážný', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Bahnwärter',
    distractors: ['Förster', 'Prediger'],
  }),
  glossary('b2b-tender', 'Tender', 'zásobní vůz lokomotivy', 'C1', {
    kind: 'noun',
    article: 'der',
    plural: 'Tender',
    distractors: ['Schnellzug', 'Bahngraben'],
  }),
  glossary('b2b-gesangbuch', 'Gesangbuch', 'zpěvník', 'B2', {
    kind: 'noun',
    article: 'das',
    plural: 'Gesangbücher',
    distractors: ['Bibel', 'Notizbuch'],
  }),
  glossary('b2b-sterbeglocke', 'Sterbeglocke', 'umíráček', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Sterbeglocken',
    distractors: ['Kirchenglocke', 'Laterne'],
  }),
  glossary('b2b-wochenbett', 'Wochenbett', 'šestinedělí', 'C1', {
    kind: 'noun',
    article: 'das',
    plural: 'Wochenbetten',
    distractors: ['Krankenbett', 'Kinderbett'],
  }),
  glossary('b2b-herrschsuechtig', 'herrschsüchtig', 'panovačný', 'C1', {
    kind: 'adjective',
    forms: ['herrschsüchtige', 'Herrschsucht'],
    distractors: ['nachgiebig', 'gelassen'],
  }),
  glossary('b2b-gewissensbiss', 'Gewissensbiß', 'výčitka svědomí', 'C1', {
    kind: 'noun',
    article: 'der',
    plural: 'Gewissensbisse',
    forms: ['Gewissensbisse'],
    distractors: ['Erinnerung', 'Andacht'],
    learningNote: 'Dnešní pravopis je „Gewissensbiss“, v množném čísle „Gewissensbisse“.',
  }),
  glossary('b2b-bahnuebergang', 'Bahnübergang', 'železniční přejezd', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: 'Bahnübergänge',
    distractors: ['Bahnstrecke', 'Waldweg'],
  }),
  glossary('b2b-einoede', 'Einöde', 'samota, pustina', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Einöden',
    distractors: ['Kolonie', 'Kapelle'],
  }),
  glossary('b2b-abneigung', 'Abneigung', 'odpor, nechuť', 'B2', {
    kind: 'noun',
    article: 'die',
    plural: 'Abneigungen',
    distractors: ['Zuneigung', 'Hoffnung'],
  }),
];

const c1WahlverwandtschaftenGlossary: StoryGlossaryEntry[] = [
  glossary('c1w-pfropfreis', 'Pfropfreis', 'roub', 'C1', {
    kind: 'noun',
    article: 'das',
    plural: 'Pfropfreiser',
    forms: ['Pfropfreiser'],
    distractors: ['Treibebeet', 'Baumwiese'],
  }),
  glossary('c1w-geraetschaft', 'Gerätschaft', 'náčiní', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Gerätschaften',
    forms: ['Gerätschaften'],
    distractors: ['Futteral', 'Schriftstück'],
  }),
  glossary('c1w-mooshuette', 'Mooshütte', 'mechem porostlá chata', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Mooshütten',
    distractors: ['Gewächshaus', 'Schloss'],
  }),
  glossary('c1w-vorkenntnis', 'Vorkenntnis', 'předchozí znalost', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Vorkenntnisse',
    forms: ['Vorkenntnissen'],
    distractors: ['Fertigkeit', 'Erinnerung'],
  }),
  glossary('c1w-paechter', 'Pächter', 'nájemce, pachtýř', 'C1', {
    kind: 'noun',
    article: 'der',
    plural: 'Pächter',
    distractors: ['Gärtner', 'Hauptmann'],
  }),
  glossary('c1w-vorhaben', 'Vorhaben', 'záměr', 'B2', {
    kind: 'noun',
    article: 'das',
    plural: 'Vorhaben',
    distractors: ['Anerbieten', 'Verhältnis'],
  }),
  glossary('c1w-ahnung', 'Ahnung', 'tušení', 'B2', {
    kind: 'noun',
    article: 'die',
    plural: 'Ahnungen',
    distractors: ['Absicht', 'Erfahrung'],
  }),
  glossary('c1w-dazwischenkunft', 'Dazwischenkunft', 'zásah třetí strany', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Dazwischenkünfte',
    distractors: ['Zusammenkunft', 'Unterhaltung'],
  }),
  glossary('c1w-sich-uebereilen', 'sich übereilen', 'ukvapit se', 'C1', {
    kind: 'phrase',
    forms: ['übereilen'],
    distractors: ['sich beschränken', 'sich erfreuen'],
  }),
  glossary('c1w-anheimgeben', 'anheimgeben', 'přenechat rozhodnutí', 'C1', {
    kind: 'verb',
    forms: ['anheim'],
    distractors: ['widersprechen', 'unterbrechen'],
    learningNote: 'V textu „dem Los anheimgeben“ znamená svěřit rozhodnutí náhodě.',
  }),
];

const a1HaenselGretelGlossary: StoryGlossaryEntry[] = [
  glossary('a1hg-wald', 'Wald', 'les', 'A1', {
    kind: 'noun',
    article: 'der',
    plural: 'Wälder',
    forms: ['Walde', 'Wälder'],
    distractors: ['Haus', 'Garten'],
  }),
  glossary('a1hg-brot', 'Brot', 'chléb', 'A1', {
    kind: 'noun',
    article: 'das',
    plural: 'Brote',
    forms: ['Brote'],
    distractors: ['Stein', 'Feuer'],
  }),
  glossary('a1hg-spur', 'Spur', 'stopa', 'A2', {
    kind: 'noun',
    article: 'die',
    plural: 'Spuren',
    forms: ['Spuren'],
    distractors: ['Stimme', 'Tasche'],
  }),
  glossary('a1hg-verirren', 'sich verirren', 'zabloudit', 'A2', {
    kind: 'verb',
    forms: ['verirrt', 'verirrten'],
    distractors: ['warten', 'schlafen'],
  }),
  glossary('a1hg-hexe', 'Hexe', 'čarodějnice', 'A1', {
    kind: 'noun',
    article: 'die',
    plural: 'Hexen',
    forms: ['Hexen'],
    distractors: ['Mutter', 'Schwester'],
  }),
  glossary('a1hg-ofen', 'Ofen', 'pec', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Öfen',
    forms: ['Ofens'],
    distractors: ['Tisch', 'Brunnen'],
  }),
  glossary('a1hg-retten', 'retten', 'zachránit', 'A2', {
    kind: 'verb',
    forms: ['rettet', 'rettete', 'gerettet'],
    distractors: ['verlieren', 'tragen'],
  }),
  glossary('a1hg-heimweg', 'Heimweg', 'cesta domů', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Heimwege',
    forms: ['Heimwege'],
    distractors: ['Ausgang', 'Umweg'],
  }),
];

const a2BieneMajaGlossary: StoryGlossaryEntry[] = [
  glossary('a2bm-bienenstock', 'Bienenstock', 'včelí úl', 'A2', {
    kind: 'noun',
    article: 'der',
    plural: 'Bienenstöcke',
    forms: ['Bienenstocks', 'Bienenstöcke'],
    distractors: ['Blumentopf', 'Ameisenhügel'],
  }),
  glossary('a2bm-schluepfen', 'schlüpfen', 'vylíhnout se, vyklouznout', 'B1', {
    kind: 'verb',
    forms: ['schlüpfte', 'geschlüpft'],
    distractors: ['landen', 'wachsen'],
  }),
  glossary('a2bm-neugierig', 'neugierig', 'zvědavý', 'A2', {
    kind: 'adjective',
    forms: ['neugierige', 'neugieriger'],
    distractors: ['vorsichtig', 'müde'],
  }),
  glossary('a2bm-gehorchen', 'gehorchen', 'poslouchat', 'B1', {
    kind: 'verb',
    forms: ['gehorcht', 'gehorchte'],
    distractors: ['fliehen', 'fragen'],
  }),
  glossary('a2bm-wiese', 'Wiese', 'louka', 'A2', {
    kind: 'noun',
    article: 'die',
    plural: 'Wiesen',
    forms: ['Wiesen'],
    distractors: ['Höhle', 'Straße'],
  }),
  glossary('a2bm-gefahr', 'Gefahr', 'nebezpečí', 'A2', {
    kind: 'noun',
    article: 'die',
    plural: 'Gefahren',
    forms: ['Gefahren'],
    distractors: ['Hoffnung', 'Freude'],
  }),
  glossary('a2bm-spinne', 'Spinne', 'pavouk', 'A2', {
    kind: 'noun',
    article: 'die',
    plural: 'Spinnen',
    forms: ['Spinnen'],
    distractors: ['Fliege', 'Biene'],
  }),
  glossary('a2bm-entkommen', 'entkommen', 'uniknout', 'B1', {
    kind: 'verb',
    forms: ['entkam', 'entkommt'],
    distractors: ['bleiben', 'gewinnen'],
  }),
];

const b1TomSawyerGlossary: StoryGlossaryEntry[] = [
  glossary('b1ts-zaun', 'Zaun', 'plot', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Zäune',
    forms: ['Zaunes', 'Zäune'],
    distractors: ['Dach', 'Ufer'],
  }),
  glossary('b1ts-streichen', 'streichen', 'natírat', 'B1', {
    kind: 'verb',
    forms: ['strich', 'gestrichen'],
    distractors: ['bauen', 'öffnen'],
  }),
  glossary('b1ts-ueberzeugen', 'überzeugen', 'přesvědčit', 'B1', {
    kind: 'verb',
    forms: ['überzeugt', 'überzeugte'],
    distractors: ['warnen', 'bestrafen'],
  }),
  glossary('b1ts-schatz', 'Schatz', 'poklad', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Schätze',
    forms: ['Schätze', 'Schätzen'],
    distractors: ['Brief', 'Schlüssel'],
  }),
  glossary('b1ts-friedhof', 'Friedhof', 'hřbitov', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Friedhöfe',
    forms: ['Friedhöfe'],
    distractors: ['Marktplatz', 'Schulhof'],
  }),
  glossary('b1ts-zeuge', 'Zeuge', 'svědek', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: 'Zeugen',
    forms: ['Zeugen'],
    distractors: ['Richter', 'Nachbar'],
  }),
  glossary('b1ts-gestehen', 'gestehen', 'přiznat, vypovědět', 'B2', {
    kind: 'verb',
    forms: ['gestand', 'gestanden'],
    distractors: ['schweigen', 'fliehen'],
  }),
  glossary('b1ts-mut', 'Mut', 'odvaha', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: '—',
    distractors: ['Angst', 'Lärm'],
  }),
];

const b2SchatzinselGlossary: StoryGlossaryEntry[] = [
  glossary('b2si-gasthaus', 'Gasthaus', 'hostinec', 'B1', {
    kind: 'noun',
    article: 'das',
    plural: 'Gasthäuser',
    forms: ['Gasthauses', 'Gasthäuser'],
    distractors: ['Lagerhaus', 'Rathaus'],
  }),
  glossary('b2si-seemann', 'Seemann', 'námořník', 'B1', {
    kind: 'noun',
    article: 'der',
    plural: 'Seeleute',
    forms: ['Seeleute', 'Seemanns'],
    distractors: ['Kaufmann', 'Wächter'],
  }),
  glossary('b2si-karte', 'Karte', 'mapa', 'B1', {
    kind: 'noun',
    article: 'die',
    plural: 'Karten',
    forms: ['Karten'],
    distractors: ['Liste', 'Flagge'],
  }),
  glossary('b2si-meuterei', 'Meuterei', 'vzpoura', 'B2', {
    kind: 'noun',
    article: 'die',
    plural: 'Meutereien',
    forms: ['Meutereien'],
    distractors: ['Überfahrt', 'Verhandlung'],
  }),
  glossary('b2si-misstrauen', 'misstrauen', 'nedůvěřovat', 'B2', {
    kind: 'verb',
    forms: ['misstraute', 'misstraut'],
    distractors: ['bewundern', 'gehorchen'],
  }),
  glossary('b2si-belauschen', 'belauschen', 'odposlouchávat', 'B2', {
    kind: 'verb',
    forms: ['belauschte', 'belauscht'],
    distractors: ['begrüßen', 'unterbrechen'],
  }),
  glossary('b2si-verrat', 'Verrat', 'zrada', 'B2', {
    kind: 'noun',
    article: 'der',
    plural: '—',
    forms: ['Verrats'],
    distractors: ['Befehl', 'Zufall'],
  }),
  glossary('b2si-entkommen', 'entkommen', 'uniknout', 'B2', {
    kind: 'verb',
    forms: ['entkam', 'entkommt'],
    distractors: ['angreifen', 'landen'],
  }),
];

const c1DorianGrayGlossary: StoryGlossaryEntry[] = [
  glossary('c1dg-atelier', 'Atelier', 'ateliér', 'B2', {
    kind: 'noun',
    article: 'das',
    plural: 'Ateliers',
    forms: ['Ateliers'],
    distractors: ['Salon', 'Theater'],
  }),
  glossary('c1dg-portraet', 'Porträt', 'portrét', 'B2', {
    kind: 'noun',
    article: 'das',
    plural: 'Porträts',
    forms: ['Porträts'],
    distractors: ['Spiegel', 'Rahmen'],
  }),
  glossary('c1dg-eitelkeit', 'Eitelkeit', 'marnivost', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Eitelkeiten',
    forms: ['Eitelkeiten'],
    distractors: ['Aufrichtigkeit', 'Geduld'],
  }),
  glossary('c1dg-beeinflussen', 'beeinflussen', 'ovlivnit', 'B2', {
    kind: 'verb',
    forms: ['beeinflusst', 'beeinflusste'],
    distractors: ['beobachten', 'verteidigen'],
  }),
  glossary('c1dg-gewissen', 'Gewissen', 'svědomí', 'C1', {
    kind: 'noun',
    article: 'das',
    plural: 'Gewissen',
    forms: ['Gewissens'],
    distractors: ['Gedächtnis', 'Gerücht'],
  }),
  glossary('c1dg-verbergen', 'verbergen', 'skrýt', 'C1', {
    kind: 'verb',
    forms: ['verbarg', 'verborgen'],
    distractors: ['enthüllen', 'zerstören'],
  }),
  glossary('c1dg-verfall', 'Verfall', 'úpadek, rozklad', 'C1', {
    kind: 'noun',
    article: 'der',
    plural: '—',
    distractors: ['Glanz', 'Fortschritt'],
  }),
  glossary('c1dg-versuchung', 'Versuchung', 'pokušení', 'C1', {
    kind: 'noun',
    article: 'die',
    plural: 'Versuchungen',
    forms: ['Versuchungen'],
    distractors: ['Warnung', 'Gewohnheit'],
  }),
];

const a1HaenselGretelEpisodes: StoryEpisodeBlueprint[] = [
  { title: 'Drobky v lese', summaryCs: 'Děti hledají cestu domů podle malé stopy.' },
  { title: 'Dům, který voní', summaryCs: 'Hlad přivede sourozence k nebezpečnému domu.' },
  { title: 'Plán u pece', summaryCs: 'Gretel pochopí lest a rozhodne se jednat.' },
  { title: 'Cesta domů', summaryCs: 'Sourozenci se zachrání a znovu najdou rodinu.' },
];

const a2BieneMajaEpisodes: StoryEpisodeBlueprint[] = [
  { title: 'První den v úlu', summaryCs: 'Maja se narodí a slyší pravidla včelího města.' },
  { title: 'Za bránou', summaryCs: 'Zvědavost je silnější než zákaz a Maja vyletí ven.' },
  { title: 'Louka plná hlasů', summaryCs: 'Noví známí ukazují Maje krásu i rizika svobody.' },
  { title: 'Síť mezi květy', summaryCs: 'Setkání s pavoukem prověří její klid a odvahu.' },
];

const b1TomSawyerEpisodes: StoryEpisodeBlueprint[] = [
  { title: 'Trest u plotu', summaryCs: 'Tom promění nepříjemnou práci ve vzácnou výsadu.' },
  { title: 'Obchod bez peněz', summaryCs: 'Kamarádi platí za možnost pracovat místo Toma.' },
  {
    title: 'Noční svědci',
    summaryCs: 'Dobrodružství na hřbitově se změní v nebezpečné tajemství.',
  },
  { title: 'Rozhodnutí mluvit', summaryCs: 'Tom musí zvolit mezi vlastním strachem a pravdou.' },
];

const b2SchatzinselEpisodes: StoryEpisodeBlueprint[] = [
  { title: 'Cizinec u pobřeží', summaryCs: 'Do hostince přichází muž, který se bojí minulosti.' },
  { title: 'Mapa v truhle', summaryCs: 'Jim objeví stopu vedoucí ke skrytému bohatství.' },
  { title: 'Hlas v sudu', summaryCs: 'Náhodně vyslechnutý rozhovor odhalí chystanou vzpouru.' },
  { title: 'Volba na ostrově', summaryCs: 'Jim jedná sám a neví, komu může důvěřovat.' },
];

const c1DorianGrayEpisodes: StoryEpisodeBlueprint[] = [
  {
    title: 'Portrét v ateliéru',
    summaryCs: 'Basil ukrývá obraz, do něhož vložil příliš mnoho sebe.',
  },
  {
    title: 'Cena věčného mládí',
    summaryCs: 'Dorian poprvé vysloví přání, které změní jeho život.',
  },
  { title: 'První změna', summaryCs: 'Po krutém rozhodnutí nese obraz stopu, kterou tvář skrývá.' },
  { title: 'Zamčené svědomí', summaryCs: 'Dorian schová portrét, ale neunikne jeho významu.' },
];

const a1Episodes: StoryEpisodeBlueprint[] = [
  { title: 'Jakobův nový dům', summaryCs: 'Jakob postaví dům a naplní ho obilím.' },
  {
    title: 'Kočka, myš a pes',
    summaryCs: 'Kočka chytí myš a po hostině ji v zahradě překvapí pes.',
  },
  {
    title: 'Od psa ke krávě',
    summaryCs: 'Pes pronásleduje kočku, kráva zase psa a do řetězu vstoupí smutná dívka.',
  },
  {
    title: 'Dívka a mladý muž',
    summaryCs: 'Při dojení krávy dívku osloví chudý mladík a nabídne jí společný domov.',
  },
  {
    title: 'Nabídka a spící kněz',
    summaryCs: 'Dívka souhlasí se svatbou, ale budoucí manželé musí nejprve probudit kněze.',
  },
  {
    title: 'Svatba a dobrý konec',
    summaryCs: 'Probuzený kněz pár oddá a dlouhý řetěz událostí se konečně uzavře.',
  },
  {
    title: 'Tři ospalci',
    summaryCs: 'Tři mladíci v Bonnu chtějí uniknout hluku a nejraději by pořád spali.',
  },
  {
    title: 'Cesta do jeskyně',
    summaryCs: 'Opustí své rodiny a najdou jeskyni, kde je konečně nikdo nebudí.',
  },
  {
    title: 'Prvních sedm let',
    summaryCs: 'Spáči prospí dlouhé roky a první probuzení přeruší jediný neurčitý zvuk.',
  },
  {
    title: 'Kráva, nebo vůl?',
    summaryCs: 'Každých sedm let jeden z mužů promluví, ale jejich rozhovor nikam nevede.',
  },
];

const a2Episodes: StoryEpisodeBlueprint[] = [
  { title: 'V zasněženém lese', summaryCs: 'Ztracený chlapec hledá cestu v nastávající tmě.' },
  {
    title: 'Světlo mezi stromy',
    summaryCs: 'Koleda přivede promrzlého chlapce ke dveřím domu, kde smí vyprávět svůj příběh.',
  },
  {
    title: 'Místo u stolu',
    summaryCs: 'Rodina ověří Augustova slova a rozhodne se osiřelého chlapce přijmout.',
  },
  {
    title: 'Pomocník a kreslíř',
    summaryCs: 'August se odvděčuje prací a ve volných chvílích kreslí les i stromy.',
  },
  {
    title: 'Talent na papíře',
    summaryCs: 'Umělec rozpozná Augustovo nadání a otevře mu cestu ke studiu i do Itálie.',
  },
  {
    title: 'Dopis z Itálie',
    summaryCs: 'August pošle první obraz a po letech se dozví o krizi své pěstounské rodiny.',
  },
  { title: 'Návrat slavného malíře', summaryCs: 'Vděčnost po letech zachrání pěstounskou rodinu.' },
  {
    title: 'Odměna a nový příběh',
    summaryCs:
      'Augustova pomoc přinese rodině jistotu; poté začíná vyprávění o Else a deseti vílách.',
  },
  {
    title: 'Elsino přání',
    summaryCs:
      'Elsa lituje své nešikovnosti, zavolá si na pomoc deset víl a tajemný muž jí je ukryje do prstů.',
  },
  {
    title: 'Deset pracovitých prstů',
    summaryCs:
      'Víly v prstech probudí Elsu k práci; její píle strhne služebnictvo a promění dům v ukázkovou domácnost.',
  },
];

const b1Episodes: StoryEpisodeBlueprint[] = [
  {
    title: 'Z Maienfeldu vzhůru',
    summaryCs: 'Dete vede navlečenou Heidi z údolí do hor a cestou se k nim přidá Barbel.',
  },
  {
    title: 'Kam dítě míří',
    summaryCs: 'Barbel zjistí, že má Heidi zůstat u obávaného Alm-Öhiho, a začne Dete varovat.',
  },
  {
    title: 'Otázky kolem Alm-Öhiho',
    summaryCs:
      'Dete hájí své rozhodnutí a Barbel chce konečně slyšet pravdu o samotářském dědečkovi.',
  },
  {
    title: 'Dědečkova minulost',
    summaryCs:
      'Dete začne vyprávět o statku, rodině a událostech, které Alm-Öhiho odvedly z kraje.',
  },
  {
    title: 'Pád rodiny',
    summaryCs: 'Dluhy, vojenská minulost a ztráta blízkých vysvětlují dědečkovu nedůvěru k lidem.',
  },
  {
    title: 'Tobias a Adelheid',
    summaryCs:
      'Vyprávění dospěje ke smrti Heidiných rodičů a k Detině nabídce práce ve Frankfurtu.',
  },
  {
    title: 'Kdo žije na Almě',
    summaryCs:
      'Barbel se s Dete rozloučí a vypravěč představí Geißenpetera, jeho rodinu a horskou chatu.',
  },
  {
    title: 'Heidi dohání kozy',
    summaryCs: 'Heidi se přidá k Peterovi, cestou odkládá těžké vrstvy oblečení a spěchá vzhůru.',
  },
  {
    title: 'První setkání',
    summaryCs:
      'Heidi dorazí k chatě, Dete ji představí dědečkovi a Alm-Öhi si vyžádá přímé vysvětlení.',
  },
  {
    title: 'Rozhlédnutí z Almy',
    summaryCs: 'Peter odnese odložené šaty a Heidi s dědečkem poprvé procházejí nový horský domov.',
  },
  {
    title: 'Dete předává odpovědnost',
    summaryCs: 'U chaty se vyostří rozhovor o péči, příbuzenství a Detině odjezdu za prací.',
  },
  {
    title: 'Cesta zpět',
    summaryCs:
      'Dete sestupuje do údolí a před otázkami vesničanů obhajuje své rozhodnutí nechat Heidi na Almě.',
  },
];

const b2Episodes: StoryEpisodeBlueprint[] = [
  { title: 'Bouře na hrázi', summaryCs: 'Jezdec míří nocí podél Severního moře.' },
  { title: 'Tichý jezdec', summaryCs: 'V mlze se objevuje postava, která nevydává zvuk.' },
  { title: 'Hostinec', summaryCs: 'Cizinec nachází světlo, teplo a místní společnost.' },
  { title: 'Vyprávění učitele', summaryCs: 'Starý učitel začne skládat příběh Haukeho Haiena.' },
  { title: 'Hauke a moře', summaryCs: 'Chlapec pozoruje vodu přesněji než ostatní.' },
  { title: 'Počítání vody', summaryCs: 'Čísla mu odhalují slabiny starých hrází.' },
  { title: 'Model hráze', summaryCs: 'Hauke kreslí a staví vlastní lepší profil.' },
  { title: 'Konflikt', summaryCs: 'Jeho jistota naráží na posměch a odpor.' },
  { title: 'Trien’ Jans', summaryCs: 'Na okraji hráze žije žena se zvláštním kocourem.' },
  { title: 'Kocour a pták', summaryCs: 'Setkání ukáže Haukeho tvrdost i neklid.' },
  {
    title: 'Ledňáček a kocour',
    summaryCs: 'Hauke odmítne vydat kocourovi uloveného ptáka a jejich zápas se prudce vyhrotí.',
  },
  {
    title: 'Smrt kocoura',
    summaryCs: 'Hauke zvíře zabije; zdrcená Trien’ Jans odnese jeho tělo k Tede Haienovi.',
  },
  {
    title: 'Trienina žaloba',
    summaryCs: 'Stará žena otci vypoví, co Hauke udělal, a připomene samotu po smrti svého syna.',
  },
  {
    title: 'Otcovo rozhodnutí',
    summaryCs:
      'Tede škodu nahradí, ale synovi oznámí, že jeho energie potřebuje práci mimo malý dům.',
  },
  {
    title: 'Cesta k Deichgrafovi',
    summaryCs:
      'Hauke si vybere službu u Deichgrafa, myslí na počtářku Elke a ještě večer vyráží žádat o místo.',
  },
];

const c1Episodes: StoryEpisodeBlueprint[] = [
  { title: 'Neklidné probuzení', summaryCs: 'Gregor se probouzí v těle, které nepoznává.' },
  { title: 'Nové tělo', summaryCs: 'Pokouší se pochopit krunýř, nohy a vlastní pohyb.' },
  { title: 'Známý pokoj', summaryCs: 'Běžné předměty ostře kontrastují s proměnou.' },
  { title: 'Práce a vlaky', summaryCs: 'Místo hrůzy Gregora nejdřív zaměstná jízdní řád.' },
  { title: 'Zmeškaný spoj', summaryCs: 'Čas běží a tlak zaměstnání roste.' },
  { title: 'Hlasy za dveřmi', summaryCs: 'Rodina zvenčí zjišťuje, proč Gregor nevstal.' },
  { title: 'Pokus vstát', summaryCs: 'Každý pohyb se mění v obtížný technický úkol.' },
  { title: 'Prokurista přichází', summaryCs: 'Z práce dorazí kontrola dřív než pomoc.' },
  { title: 'Rodina čeká', summaryCs: 'Za zamčenými dveřmi se hromadí otázky a strach.' },
  { title: 'Gregor odpovídá', summaryCs: 'Jeho řeč zní jemu normálně, ostatním už ne.' },
  { title: 'Klíč v zámku', summaryCs: 'Gregor hledá způsob, jak dveře vůbec otevřít.' },
  { title: 'Dveře se otevírají', summaryCs: 'Rodina i prokurista konečně uvidí proměnu.' },
  { title: 'Matčin úlek', summaryCs: 'První pohled vyvolá zmatek a fyzickou hrůzu.' },
  { title: 'Útěk', summaryCs: 'Prokurista prchá a Gregor se ho snaží zastavit.' },
  { title: 'Zpátky do pokoje', summaryCs: 'Otec násilně uzavírá Gregora do nového světa.' },
];

const a1HaewelmannEpisodes: StoryEpisodeBlueprint[] = [
  { title: 'Ještě nechci spát', summaryCs: 'Häwelmann chce, aby s ním maminka dál jezdila.' },
  { title: 'Košile jako plachta', summaryCs: 'Měsíc uvidí neobvyklé vozítko na stěně a stropě.' },
  { title: 'Tichým městem', summaryCs: 'Měsíční paprsek otevře cestu ven ke kostelní věži.' },
  { title: 'Noční les', summaryCs: 'Häwelmann hledá zvířata a potká bdělou kočku.' },
  { title: 'Mezi hvězdami', summaryCs: 'Touha po další jízdě zavede postýlku až do nebe.' },
  { title: 'Vychází slunce', summaryCs: 'Po tmě přichází prudké setkání se sluncem a vodou.' },
];

const a2MaxMoritzEpisodes: StoryEpisodeBlueprint[] = [
  { title: 'Dva známí rošťáci', summaryCs: 'Vypravěč představí Maxe, Moritze a jejich pověst.' },
  { title: 'Provázky pro drůbež', summaryCs: 'První kousek ohrozí slepice vdovy Bolte.' },
  { title: 'Vůně pečeně', summaryCs: 'Dvojice sleduje komín a zmocní se připraveného jídla.' },
  { title: 'Naříznutá lávka', summaryCs: 'Krejčí Böck vkročí do pečlivě připravené pasti.' },
  { title: 'Dýmka učitele Lämpela', summaryCs: 'Střelný prach promění klidnou chvíli ve výbuch.' },
  { title: 'Chrousti v posteli', summaryCs: 'Strýc Fritz dostane pod peřinu nevítané hosty.' },
  { title: 'Pekařova pec', summaryCs: 'Těsto a horká pec rošťáky téměř zastaví.' },
  { title: 'Pytle u mlynáře', summaryCs: 'Poslední kousek uzavře příběh temnou pointou.' },
];

const b1KleiderEpisodes: StoryEpisodeBlueprint[] = [
  { title: 'Krejčí v listopadu', summaryCs: 'Chudý Wenzel Strapinski míří bez mzdy do Goldachu.' },
  {
    title: 'Kočár do Goldachu',
    summaryCs:
      'Kočí sveze promoklého krejčího a jeho elegantní plášť u hostince vyvolá první omyl.',
  },
  {
    title: 'Za dveřmi hostince',
    summaryCs:
      'Personál vede Wenzela dovnitř a každé jeho mlčení si vykládá jako šlechtickou zdrženlivost.',
  },
  {
    title: 'U stolu jako hrabě',
    summaryCs:
      'Wenzel touží znovu odejít, ale hostinský jej usadí a nabídne mu péči určenou vzácnému hostu.',
  },
  { title: 'Stůl plný jídla', summaryCs: 'Hladový host přijímá péči, kterou si nemůže zaplatit.' },
  { title: 'Pokus zmizet', summaryCs: 'Wenzel hledá únikovou cestu, ale pozornost města roste.' },
  { title: 'Společnost přichází', summaryCs: 'Goldašští občané chtějí poznat tajemného hraběte.' },
  {
    title: 'Role bez přiznání',
    summaryCs: 'Každé mlčení si okolí vyloží jako šlechtickou zdrženlivost.',
  },
  { title: 'Hra o první mince', summaryCs: 'Náhoda u karet naplní dosud prázdnou kapsu.' },
  { title: 'Vyjížďka krajem', summaryCs: 'Noví známí ukazují hostu město i svůj blahobyt.' },
  {
    title: 'Ruka se šperky',
    summaryCs:
      'Při vyjížďce se Wenzel ocitne vedle Nettchen a okolí dál rozvíjí příběh tajemného hraběte.',
  },
  { title: 'Nettchen', summaryCs: 'Dcera radního vstupuje do společnosti a zaujme Wenzela.' },
  {
    title: 'První blízkost',
    summaryCs: 'Rozhovory a společné chvíle mění zdvořilost v náklonnost.',
  },
  { title: 'Město pozoruje', summaryCs: 'Goldach sleduje rodící se vztah s rostoucím očekáváním.' },
  { title: 'Böhniho podezření', summaryCs: 'Jeden z nápadníků hledá v cizincově příběhu slabinu.' },
  {
    title: 'Mezi pravdou a štěstím',
    summaryCs: 'Wenzel stále odkládá přiznání, které by vše změnilo.',
  },
  { title: 'Zasnoubení', summaryCs: 'Nettchen a domnělý hrabě udělají rozhodující krok.' },
  {
    title: 'Dva průvody',
    summaryCs:
      'Zásnubní jízda se střetne s hlučnou seldwylskou maškarádou, kterou Wenzel zatím nepovažuje za hrozbu.',
  },
  {
    title: 'Maska krejčovské dílny',
    summaryCs:
      'Böhni zbystří a maškaráda připraví krejčovský výjev namířený přímo proti domnělému hraběti.',
  },
  {
    title: 'Představení pravdy',
    summaryCs: 'Seldwylští sehrají Wenzelovu minulost a Nettchen pochopí, koho si chtěla vzít.',
  },
  {
    title: 'Odchod se slzami',
    summaryCs:
      'Wenzel beze slova opustí sál a vyprávění odlišuje jeho pasivní omyl od skutečného podvodu.',
  },
  {
    title: 'Kdo je podvodník',
    summaryCs:
      'Úvaha o falešných rolích končí Böhniho pokusem převzít místo průvodce zdrcené Nettchen.',
  },
  {
    title: 'Nettchen po odhalení',
    summaryCs:
      'Nettchen odmítá snadné vysvětlení svého neštěstí a rozhoduje se, co udělá bez souhlasu okolí.',
  },
  { title: 'Nettchen se rozhodne', summaryCs: 'Místo návratu domů vyjede za mužem do zimní noci.' },
  { title: 'U kmotry', summaryCs: 'Oba najdou útočiště a prostor k prvnímu pravdivému rozhovoru.' },
  { title: 'Wenzelovo přiznání', summaryCs: 'Krejčí popíše, jak se cizí domněnka změnila v past.' },
  {
    title: 'Příběh z dětství',
    summaryCs:
      'Wenzel vypráví o matce, ztraceném dětském štěstí a vojenské službě, která jej odvedla pryč.',
  },
  {
    title: 'Dívka z minulosti',
    summaryCs:
      'Jeho vzpomínka na milované dítě přivede rozhovor k poznání, které mění vztah obou uprchlíků.',
  },
  {
    title: 'Rozhodnutí a návrat',
    summaryCs:
      'Nettchen zvolí Wenzela i po odhalení a dvojice se vrátí do Seldwyly čelit ostatním.',
  },
  {
    title: 'Spor v hostinci',
    summaryCs:
      'V hostinci se střetnou obvinění z únosu a podvodu s Nettcheniným rozhodnutím i otázkou majetku.',
  },
  {
    title: 'Právní cesta ke svatbě',
    summaryCs:
      'Rodina přijme, že sňatku nezabrání, a začne řešit oznámení, listiny a případné námitky.',
  },
  {
    title: 'Svatba, dílna a návrat',
    summaryCs:
      'Wenzel a Nettchen vybudují úspěšnou dílnu a později se vrátí do Goldachu jako vážená rodina.',
  },
];

const b2SandmannEpisodes: StoryEpisodeBlueprint[] = [
  {
    title: 'Dopis plný neklidu',
    summaryCs: 'Nathanael píše Lotharovi o návštěvě podivného obchodníka.',
  },
  { title: 'Večery u otce', summaryCs: 'Vzpomínka se vrací k rodinným večerům a náhlému tichu.' },
  { title: 'Kdo je Sandmann', summaryCs: 'Dětské vyprávění promění zvuk kroků v trvalý strach.' },
  { title: 'Coppelius', summaryCs: 'Nathanael tajně sleduje muže, kterého spojil s přízrakem.' },
  {
    title: 'Zakázaný pokus',
    summaryCs: 'V otcově pracovně probíhá děsivý alchymistický experiment.',
  },
  { title: 'Výbuch', summaryCs: 'Další noční návštěva končí otcovou smrtí a zmizením hosta.' },
  {
    title: 'Coppola přichází',
    summaryCs: 'Současný prodavač probudí podobou i jménem starou hrůzu.',
  },
  {
    title: 'Dopis ve špatných rukou',
    summaryCs: 'Zprávu místo Lothara přečte Clara a začne odpovídat.',
  },
  {
    title: 'Clara hledá vysvětlení',
    summaryCs: 'Racionální pohled odmítá vnější moc temného přízraku.',
  },
  { title: 'Nathanael nesouhlasí', summaryCs: 'Nový dopis trvá na spojení Coppoly s Coppeliem.' },
  {
    title: 'Vypravěč vstupuje',
    summaryCs: 'Příběh opustí dopisy a skládá události z jiné perspektivy.',
  },
  { title: 'Návrat ke Claře', summaryCs: 'Setkání s rodinou na chvíli obnoví blízkost a bezpečí.' },
  {
    title: 'Clara a Nathanael',
    summaryCs:
      'Vypravěč postaví proti sobě Clařinu střízlivost a Nathanaelovu potřebu proměnit strach v osud.',
  },
  {
    title: 'Spor o temnou moc',
    summaryCs:
      'Clara hledá příčinu v Nathanaelově nitru, zatímco on trvá na vnějším démonickém nepříteli.',
  },
  {
    title: 'Vzdalování',
    summaryCs:
      'Jeho temné texty a její odpor k nim oba oddalují; Nathanael se rozhodne napsat báseň o jejich zkáze.',
  },
  {
    title: 'Báseň o zkáze',
    summaryCs: 'Nathanael dopíše děsivou vizi společné budoucnosti a chystá se ji Claře přečíst.',
  },
  {
    title: 'Hádka a souboj',
    summaryCs: 'Clara báseň odmítne, Nathanael ji urazí a Lotharův souboj zastaví až její zásah.',
  },
  {
    title: 'Usmíření, požár a okno',
    summaryCs:
      'Po smíření se Nathanael vrátí do města, najde vyhořelý dům a z nového pokoje poprvé pozoruje Olimpii.',
  },
  {
    title: 'Skla od Coppoly',
    summaryCs: 'Prodavač nabídne optiku, která mění Nathanaelův pohled.',
  },
  { title: 'Pohled dalekohledem', summaryCs: 'Olimpiiny oči se skrze čočku zdají náhle živé.' },
  {
    title: 'Spalanzaniho slavnost',
    summaryCs: 'Profesor představí dceru početné městské společnosti.',
  },
  { title: 'Koncert', summaryCs: 'Dokonale přesná hra a zpěv vyvolají obdiv i neklid.' },
  {
    title: 'Tanec s Olimpií',
    summaryCs: 'Nathanael přehlíží chlad i mechanický rytmus partnerky.',
  },
  {
    title: 'Posluchačka beze slov',
    summaryCs: 'Olimpiino mlčení se mu jeví jako nejhlubší porozumění.',
  },
  {
    title: 'Varování přátel',
    summaryCs: 'Siegmund pojmenuje nepřirozenost, kterou Nathanael odmítá.',
  },
  {
    title: 'Roztržená Olimpia',
    summaryCs: 'Spor Coppoly se Spalanzanim odhalí mechanismus místo člověka.',
  },
  { title: 'Zhroucení', summaryCs: 'Rozbitá iluze vrhne Nathanaela do horečky a ústavu.' },
  { title: 'Zdánlivý klid', summaryCs: 'Po uzdravení plánuje s Clarou pokojný společný život.' },
  {
    title: 'Věž a poslední pohled',
    summaryCs: 'Dalekohled znovu spustí šílenství a tragický konec.',
  },
];

const c1UrteilEpisodes: StoryEpisodeBlueprint[] = [
  { title: 'Dopis v neděli', summaryCs: 'Georg dokončí zprávu příteli žijícímu v Rusku.' },
  {
    title: 'Přítel v cizině',
    summaryCs: 'Úvaha o izolaci druhého muže odhaluje Georgovu nejistotu.',
  },
  { title: 'Co lze oznámit', summaryCs: 'Úspěch i zasnoubení se stávají problémem vyprávění.' },
  {
    title: 'Za dveřmi otcova pokoje',
    summaryCs: 'Georg vstupuje do temné místnosti s rozhodnutím o dopise.',
  },
  {
    title: 'Slábnoucí otec',
    summaryCs: 'Péče, obavy a přesun do postele mění rovnováhu mezi muži.',
  },
  {
    title: 'Existuje ten přítel?',
    summaryCs: 'Otcova otázka rozkolísá jistotu dosavadního rozhovoru.',
  },
  { title: 'Obvinění', summaryCs: 'Otec obrací Georgovy argumenty proti němu i jeho snoubence.' },
  { title: 'Otec vstává', summaryCs: 'Zdánlivě bezmocný muž znovu ovládne prostor i příběh.' },
  { title: 'Rozsudek', summaryCs: 'Rodinný konflikt vyústí v nepřiměřené a absolutní rozhodnutí.' },
  {
    title: 'Nekonečný provoz',
    summaryCs: 'Georg běží k mostu a závěrečná věta přehluší jeho pád.',
  },
];

const a1BremerEpisodes: StoryEpisodeBlueprint[] = [
  { title: 'Osel mění povolání', summaryCs: 'Starý osel uteče z mlýna a zamíří za hudbou.' },
  { title: 'Kapela roste', summaryCs: 'Pes, kočka a kohout dostanou stejnou druhou šanci.' },
  { title: 'Koncert v okně', summaryCs: 'Čtyři hlasy vytvoří plán, který vyžene lupiče.' },
  { title: 'Dům místo Brém', summaryCs: 'Noční návštěva potvrdí, že kapela našla nový domov.' },
];

const a2AliceEpisodes: StoryEpisodeBlueprint[] = [
  { title: 'Kniha bez obrázků', summaryCs: 'Znudenou Alici vyruší králík s hodinkami.' },
  { title: 'Za bílým králíkem', summaryCs: 'Zvědavost ji zavede rovnou do hluboké nory.' },
  { title: 'Pomalý pád', summaryCs: 'Police, mapy a prázdná sklenice míjejí Alici cestou dolů.' },
  { title: 'Síň zamčených dveří', summaryCs: 'Malý zlatý klíč odhalí zahradu, do níž se nevejde.' },
  { title: 'Vypij mě', summaryCs: 'Podezřelá lahvička promění Alici na velikost dveří.' },
  { title: 'Sněz mě', summaryCs: 'Zapomenutý klíč a rozinkový nápis spustí další pokus.' },
];

const b1NilsEpisodes: StoryEpisodeBlueprint[] = [
  { title: 'Neděle bez dozoru', summaryCs: 'Nils plánuje, co provede, až rodiče odejdou.' },
  { title: 'Čtrnáct stran kázání', summaryCs: 'Místo volnosti ho čeká dlouhé čtení a kontrola.' },
  { title: 'Otevřená truhla', summaryCs: 'V zrcadle zahlédne pohyb u rodinných pokladů.' },
  { title: 'Skřítek v síti', summaryCs: 'Nils promění setkání se skřítkem v nebezpečný žert.' },
  { title: 'Dohoda a zrada', summaryCs: 'Slib odměny nevydrží ani do skřítkova osvobození.' },
  { title: 'Pokoj narostl', summaryCs: 'Po probuzení jsou stůl, židle i kniha podivně obrovské.' },
  { title: 'Cizinec v zrcadle', summaryCs: 'Nils pochopí, že malým se nestal pokoj, ale on sám.' },
];

const b2TaugenichtsEpisodes: StoryEpisodeBlueprint[] = [
  { title: 'Od mlýna do světa', summaryCs: 'Otec pošle snílka pracovat a on si vezme jen housle.' },
  { title: 'Píseň na silnici', summaryCs: 'Volná cesta přivolá kočár se dvěma neznámými dámami.' },
  { title: 'Směr Vídeň', summaryCs: 'Jízda střídá euforii, stesk po domově a nečekané usnutí.' },
  {
    title: 'Zahradníkem na zámku',
    summaryCs: 'Bez peněz přijme místo, které mu nabídne cizí panství.',
  },
  { title: 'Oči v altánu', summaryCs: 'Práce v zahradě se mění v čekání na krásnou cestovatelku.' },
  {
    title: 'Láhev mezi květinami',
    summaryCs: 'Vzkaz od neznámé dámy rozehraje celou noční zahradu.',
  },
  { title: 'Kýchání v úkrytu', summaryCs: 'Tajné pozorování u okna skončí trapným prozrazením.' },
  {
    title: 'Společnost na člunu',
    summaryCs: 'Nedělní samotu přeruší hlučný výlet zámeckých hostů.',
  },
  {
    title: 'Píseň před publikem',
    summaryCs: 'Upřímné vyznání narazí na posměch i mlčení milované ženy.',
  },
];

const c1KrugEpisodes: StoryEpisodeBlueprint[] = [
  { title: 'Soudce po pádu', summaryCs: 'Adam vysvětluje zraněnou nohu až podezřele obrazně.' },
  { title: 'Tvář plná stop', summaryCs: 'Licht objeví škrábance, ránu i další nesrovnalosti.' },
  { title: 'Příběh o kamnech', summaryCs: 'Soudce skládá stále složitější verzi noční nehody.' },
  { title: 'Revize z Utrechtu', summaryCs: 'Zpráva o nečekané kontrole promění žert v paniku.' },
  {
    title: 'Co skrývá spisovna',
    summaryCs: 'Adam zkouší umlčet Lichta a uklidit úřední nepořádek.',
  },
  {
    title: 'Host už je ve vsi',
    summaryCs: 'Posel oznámí příjezd dřív, než se soudce stačí obléct.',
  },
  {
    title: 'Klobásy mezi spisy',
    summaryCs: 'Příprava na kontrolu odhalí neobvyklý obsah registratury.',
  },
  {
    title: 'Záhada ztracené paruky',
    summaryCs: 'Služebné a kočka rozloží Adamovu poslední věrohodnou výmluvu.',
  },
];

const a1FabelnEpisodes: StoryEpisodeBlueprint[] = [
  {
    title: 'Kůň, býk a opice',
    summaryCs: 'Krátké dialogy obrátí pýchu zvířecích postav proti nim samým.',
  },
  {
    title: 'Příliš ozdobný luk',
    summaryCs: 'Majitel vylepší dobrý nástroj tak důkladně, až jej zničí.',
  },
  {
    title: 'Tři oslí výmluvy',
    summaryCs: 'Osel se chlubí silným společníkem, prohraje závod a potká vlka.',
  },
  {
    title: 'Pomoc s trny a pokladem',
    summaryCs: 'Lišák i lakomec zjistí, že pomoc a majetek mají nečekanou cenu.',
  },
];

const a2MondfahrtEpisodes: StoryEpisodeBlueprint[] = [
  {
    title: 'Večerní pořádek',
    summaryCs: 'Minna ukládá Peterchena a Anneliese a snaží se zavřít okno i den.',
  },
  {
    title: 'Chroust v pokoji',
    summaryCs: 'Děti zaslechnou bzukot a přou se, zda se neznámého hosta bát.',
  },
  {
    title: 'Matčina píseň',
    summaryCs: 'Ukolébavka o cestě k Měsíci promění světlo i podobu pokoje.',
  },
  {
    title: 'Pan Chroust promluví',
    summaryCs: 'Pětinohý hudebník vypráví o ztrátě a zkoumá dětské hračky.',
  },
  {
    title: 'Tanec a první dohoda',
    summaryCs: 'Po komickém pádu chroust tančí a děti ho prosí, aby ještě zůstal.',
  },
];

const b1ImmenseeEpisodes: StoryEpisodeBlueprint[] = [
  {
    title: 'Cesta k jezeru',
    summaryCs: 'Reinhard po letech sestoupí z lesa a poprvé spatří Immensee.',
  },
  {
    title: 'Erichovo překvapení',
    summaryCs: 'Starý přítel ho vítá a přizná, že návštěvu před Elisabeth utajil.',
  },
  {
    title: 'Setkání v zahradním sále',
    summaryCs: 'Elisabeth návštěvníka pozná, ale radost provází dlouhé mlčení.',
  },
  {
    title: 'Dny na statku',
    summaryCs: 'Reinhard poznává hospodářství, pracuje a sleduje změněnou Elisabeth.',
  },
  {
    title: 'Bílá postava v dešti',
    summaryCs: 'Večer u jezera zahlédne čekající siluetu, která před ním zmizí.',
  },
];

const b2BahnwaerterEpisodes: StoryEpisodeBlueprint[] = [
  {
    title: 'Deset let ve službě',
    summaryCs: 'Thielův přesný režim narušily jen dvě železniční nehody.',
  },
  {
    title: 'Dvě manželství',
    summaryCs: 'Po smrti první ženy hledá pro malého Tobiase novou péči.',
  },
  {
    title: 'Moc v malém domě',
    summaryCs: 'Druhá žena převezme domácnost a Thielův odpor postupně mizí.',
  },
  {
    title: 'Kaple u trati',
    summaryCs: 'Samotářské strážní stanoviště se stává místem vzpomínek a vidin.',
  },
  {
    title: 'Život v lesní samotě',
    summaryCs: 'Vlaky, roční doby a několik návštěv určují rytmus odlehlé služby.',
  },
  {
    title: 'Tobiasova těžká léta',
    summaryCs: 'S novým dítětem roste nevraživost k Tobiasovi a okolí marně varuje otce.',
  },
];

const c1WahlverwandtschaftenEpisodes: StoryEpisodeBlueprint[] = [
  {
    title: 'Nová zahrada',
    summaryCs: 'Eduard dokončí roubování a přichází za Charlottou do její nové chaty.',
  },
  {
    title: 'Místo pro třetího',
    summaryCs: 'Nevinná poznámka o prostoru otevře otázku příjezdu starého přítele.',
  },
  {
    title: 'Hauptmann bez úkolu',
    summaryCs: 'Eduard vysvětluje, proč schopný přítel trpí nečinností a samotou.',
  },
  {
    title: 'Užitečný host',
    summaryCs: 'Praktické výhody návštěvy se střetnou s Charlottinou opatrností.',
  },
  {
    title: 'Dřívější rozhodnutí',
    summaryCs: 'Charlotte připomene jejich rozdělení, sňatky i pozdě získané soukromí.',
  },
  {
    title: 'Argument a tušení',
    summaryCs: 'Dvojice váží rozumové důvody proti pocitu, že třetí člověk změní rovnováhu.',
  },
];

function source(gutenbergId: number, excerptLabel: string, adapted = false, translator?: string) {
  return {
    gutenbergId,
    ebookUrl: `https://www.gutenberg.org/ebooks/${gutenbergId}`,
    textUrl: `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
    licenseUrl: 'https://www.gutenberg.org/policy/license.html',
    sourceLabel: adapted
      ? `Project Gutenberg #${gutenbergId} · volná předloha`
      : `Project Gutenberg #${gutenbergId}`,
    excerptLabel,
    ...(translator ? { translator } : {}),
    licenseNoteCs: adapted
      ? 'Původní dílo je v Česku a EU volné podle běžné 70leté lhůty po smrti autora. Tato nová zkrácená německá studijní adaptace vznikla pro aplikaci Fritz a je šířena pod MIT licencí repozitáře.'
      : 'Text pochází z vydání uvedeného ve zdrojích. Mimo USA je potřeba ověřit místní autorské právo také pro konkrétní překlad, nejen pro původní dílo.',
    adapted,
  };
}

type StoryBookDefinition = {
  id: StoryBookId;
  title: string;
  author: string;
  translator?: string;
  level: CefrLevel;
  audience?: StoryBook['audience'];
  accent: StoryBook['accent'];
  genreCs: string;
  descriptionCs: string;
  contentNoteCs: string;
  screenCount: number;
  blueprints: StoryEpisodeBlueprint[];
  glossary: StoryGlossaryEntry[];
  modernizedByDefault?: boolean;
  namedHeadings?: string[];
  gutenbergId: number;
  excerptLabel: string;
  adapted?: boolean;
};

function defineBook(input: StoryBookDefinition): StoryBookDefinition {
  return input;
}

function makeBook(input: StoryBookDefinition, sourceText: string): StoryBook {
  const pages = paginateStorySource(sourceText, {
    bookId: input.id,
    screenCount: input.screenCount,
    modernize: input.modernizedByDefault,
    namedHeadings: input.namedHeadings,
  });
  const originalPages: StoryPage[] | undefined = input.modernizedByDefault
    ? paginateStorySource(sourceText, {
        bookId: input.id,
        screenCount: input.screenCount,
        modernize: false,
        namedHeadings: input.namedHeadings,
      })
    : undefined;
  const enrichedGlossary = enrichStoryGlossary({
    bookId: input.id,
    level: input.level,
    pages,
    glossary: input.glossary,
  });
  const episodes = buildStoryEpisodes({
    bookId: input.id,
    pages,
    glossary: enrichedGlossary,
    blueprints: input.blueprints,
  });
  return {
    id: input.id,
    title: input.title,
    author: input.author,
    level: input.level,
    audience: input.audience ?? 'all-ages',
    accent: input.accent,
    genreCs: input.genreCs,
    descriptionCs: input.descriptionCs,
    contentNoteCs: input.contentNoteCs,
    screenCount: pages.length,
    episodeCount: episodes.length,
    approximateMinutes: episodes.reduce((sum, episode) => sum + episode.minutes, 0),
    modernizedByDefault: input.modernizedByDefault ?? false,
    source: source(input.gutenbergId, input.excerptLabel, input.adapted, input.translator),
    glossary: enrichedGlossary,
    pages,
    originalPages,
    episodes,
  };
}

const storyBookDefinitions: StoryBookDefinition[] = [
  defineBook({
    id: 'a1-maerchen',
    title: 'Märchen und Erzählungen I',
    author: 'H. A. Guerber (ed.)',
    level: 'A1',
    accent: 'butter',
    genreCs: 'řetězová pohádka',
    descriptionCs: 'Dvě rytmické pohádky s opakováním, krátkými větami a jasným dějem.',
    contentNoteCs: 'Pohádkové násilí mezi zvířaty a starší náboženské motivy.',
    screenCount: 40,
    blueprints: a1Episodes,
    glossary: a1Glossary,
    modernizedByDefault: true,
    gutenbergId: 35794,
    excerptLabel: 'Jakobs Haus + Die drei Schläfer · studijní výběr',
  }),
  defineBook({
    id: 'a1-haewelmann',
    title: 'Der kleine Häwelmann',
    author: 'Theodor Storm',
    level: 'A1',
    accent: 'sky',
    genreCs: 'noční pohádka',
    descriptionCs:
      'Krátká noční výprava v postýlce s opakováním, přímou řečí a jasnými místy děje.',
    contentNoteCs: 'Dítě se ocitne v nebezpečí a na konci spadne do vody; závěr je pohádkový.',
    screenCount: 24,
    blueprints: a1HaewelmannEpisodes,
    glossary: a1HaewelmannGlossary,
    modernizedByDefault: true,
    namedHeadings: ['Der kleine Häwelmann'],
    gutenbergId: 72801,
    excerptLabel: 'Der kleine Häwelmann z antologie Tag und Nacht · úplný text',
  }),
  defineBook({
    id: 'a1-bremer',
    title: 'Die Bremer Stadtmusikanten',
    author: 'Bratři Grimmové',
    level: 'A1',
    accent: 'mint',
    genreCs: 'zvířecí pohádka',
    descriptionCs:
      'Čtyři stárnoucí zvířata spojí hlasy, přechytračí lupiče a najdou si vlastní domov.',
    contentNoteCs:
      'Zvířatům hrozí usmrcení, objevují se lupiči a krátké komické násilí bez následků.',
    screenCount: 16,
    blueprints: a1BremerEpisodes,
    glossary: a1BremerGlossary,
    modernizedByDefault: true,
    namedHeadings: ['Die Bremer Stadtmusikanten'],
    gutenbergId: 77905,
    excerptLabel: 'Die Bremer Stadtmusikanten · úplný text pohádky',
  }),
  defineBook({
    id: 'a1-fabeln',
    title: 'Ausgewählte Fabeln',
    author: 'Gotthold Ephraim Lessing',
    level: 'A1',
    accent: 'coral',
    genreCs: 'krátké zvířecí bajky',
    descriptionCs:
      'Osm velmi krátkých bajek, v nichž zvířata a předměty odhalují pýchu, výmluvy a lakotu.',
    contentNoteCs:
      'Jedna bajka končí smrtí zvířete; text obsahuje moralizování, dobové narážky a starší slovní zásobu.',
    screenCount: 16,
    blueprints: a1FabelnEpisodes,
    glossary: a1FabelnGlossary,
    modernizedByDefault: true,
    namedHeadings: [
      'Das Roß und der Stier',
      'Der Affe und der Fuchs',
      'Der Besitzer des Bogens',
      'Der Esel mit dem Löwen',
      'Der Esel und das Jagdpferd',
      'Der Esel und der Wolf',
      'Der Fuchs',
      'Der Geizige',
    ],
    gutenbergId: 9375,
    excerptLabel: 'Osm bajek od Das Roß und der Stier po Der Geizige · souvislý výběr',
  }),
  defineBook({
    id: 'a1-haensel-gretel',
    title: 'Hänsel und Gretel',
    author: 'Ludwig Bechstein',
    level: 'A1',
    audience: 'young-adult',
    accent: 'cobalt',
    genreCs: 'temná známá pohádka',
    descriptionCs:
      'Známý příběh sourozenců, kteří se v lese spoléhají na plán, odvahu a jeden na druhého.',
    contentNoteCs:
      'Opuštění dětí, hlad, hrozba upečení a smrt čarodějnice; zpracování zůstává neexplicitní.',
    screenCount: 16,
    blueprints: a1HaenselGretelEpisodes,
    glossary: a1HaenselGretelGlossary,
    namedHeadings: ['Brotkrumen im Wald', 'Das duftende Haus', 'Der Plan am Ofen', 'Der Heimweg'],
    gutenbergId: 63465,
    excerptLabel: 'Nová A1 studijní adaptace příběhu Hänsel und Gretel z volné předlohy',
    adapted: true,
  }),
  defineBook({
    id: 'a2-maerchen',
    title: 'Märchen und Erzählungen II',
    author: 'H. A. Guerber',
    level: 'A2',
    accent: 'mint',
    genreCs: 'pohádková dvojice',
    descriptionCs: 'Příběhy o nalezeném domově, vděčnosti a kouzelné zkoušce.',
    contentNoteCs: 'Starší náboženské motivy, osiření a dobové společenské role.',
    screenCount: 40,
    blueprints: a2Episodes,
    glossary: a2Glossary,
    modernizedByDefault: true,
    gutenbergId: 45189,
    excerptLabel: 'Der Weihnachtsabend + Die zehn Feeen · studijní výběr',
  }),
  defineBook({
    id: 'a2-max-moritz',
    title: 'Max und Moritz',
    author: 'Wilhelm Busch',
    level: 'A2',
    accent: 'coral',
    genreCs: 'veršovaný černý humor',
    descriptionCs:
      'Rýmovaný příběh sedmi rošťáren, který trénuje rytmus, minulý čas i starší slovní zásobu.',
    contentNoteCs:
      'Černý humor, ubližování lidem i zvířatům a drastický konec obou dětských postav.',
    screenCount: 32,
    blueprints: a2MaxMoritzEpisodes,
    glossary: a2MaxMoritzGlossary,
    modernizedByDefault: true,
    namedHeadings: [
      '_VORWORT._',
      '_Erster Streich._',
      '_Zweiter Streich._',
      '_Dritter Streich._',
      '_Vierter Streich._',
      '_Fünfter Streich._',
      '_Sechster Streich._',
      '_Letzter Streich._',
      '_SCHLUSS._',
    ],
    gutenbergId: 17161,
    excerptLabel: 'Max und Moritz · úplný text všech sedmi kousků',
  }),
  defineBook({
    id: 'a2-alice',
    title: "Alice's Abenteuer im Wunderland",
    author: 'Lewis Carroll',
    translator: 'Antonie Zimmermann',
    level: 'A2',
    accent: 'cobalt',
    genreCs: 'literární nonsens',
    descriptionCs: 'Bílý králík, pád bez konce a dveře do zahrady v první absurdní výpravě Alenky.',
    contentNoteCs: 'Pád do hluboké nory a nejistota kolem jídla a pití; děj zůstává pohádkový.',
    screenCount: 24,
    blueprints: a2AliceEpisodes,
    glossary: a2AliceGlossary,
    modernizedByDefault: true,
    namedHeadings: ['Erstes Kapitel', 'Hinunter in den Kaninchenbau.'],
    gutenbergId: 19778,
    excerptLabel: '1. kapitola: Hinunter in den Kaninchenbau · úplný text',
  }),
  defineBook({
    id: 'a2-mondfahrt',
    title: 'Peterchens Mondfahrt',
    author: 'Gerdt von Bassewitz',
    level: 'A2',
    accent: 'butter',
    genreCs: 'pohádková divadelní hra',
    descriptionCs: 'První obraz hry: dvě děti před spaním objeví pětinohého chrousta s houslemi.',
    contentNoteCs:
      'Píseň popisuje zranění a smrt chrousta, jiné zvíře je sežráno a děti krátce mluví o zabití hmyzu.',
    screenCount: 20,
    blueprints: a2MondfahrtEpisodes,
    glossary: a2MondfahrtGlossary,
    modernizedByDefault: true,
    namedHeadings: ['1. Bild.'],
    gutenbergId: 31204,
    excerptLabel: '1. obraz od dětského pokoje po první rozhovor s chroustem · souvislý výběr',
  }),
  defineBook({
    id: 'a2-biene-maja',
    title: 'Die Biene Maja',
    author: 'Waldemar Bonsels',
    level: 'A2',
    audience: 'young-adult',
    accent: 'butter',
    genreCs: 'dobrodružství o dospívání',
    descriptionCs:
      'Maja opustí bezpečí úlu, poznává svobodu a zjišťuje, že zvědavost potřebuje odpovědnost.',
    contentNoteCs: 'Ohrožení pavoukem a napětí kolem opuštění domova; bez explicitního násilí.',
    screenCount: 16,
    blueprints: a2BieneMajaEpisodes,
    glossary: a2BieneMajaGlossary,
    namedHeadings: [
      'Der erste Tag im Bienenstock',
      'Hinter dem Tor',
      'Stimmen auf der Wiese',
      'Das Netz zwischen den Blumen',
    ],
    gutenbergId: 21021,
    excerptLabel: 'Nová A2 studijní adaptace úvodních dobrodružství včelky Máji',
    adapted: true,
  }),
  defineBook({
    id: 'b1-heidi',
    title: 'Heidis Lehr- und Wanderjahre',
    author: 'Johanna Spyri',
    level: 'B1',
    accent: 'sky',
    genreCs: 'horské vyprávění',
    descriptionCs: 'První cesta Heidi z údolí až k samotářskému dědečkovi na Almě.',
    contentNoteCs: 'Opuštění dítěte, rodinný konflikt a dobové předsudky.',
    screenCount: 48,
    blueprints: b1Episodes,
    glossary: b1Glossary,
    namedHeadings: ['Zum Alm-Öhi hinauf'],
    gutenbergId: 7500,
    excerptLabel: '1. kapitola: Zum Alm-Öhi hinauf',
  }),
  defineBook({
    id: 'b1-kleider',
    title: 'Kleider machen Leute',
    author: 'Gottfried Keller',
    level: 'B1',
    accent: 'butter',
    genreCs: 'společenská novela',
    descriptionCs:
      'Úplná novela o chudém krejčím, jehož elegantní plášť spustí společenskou záměnu.',
    contentNoteCs:
      'Veřejné ponížení, třídní předsudky, finanční nouze a dobové pojetí společenského postavení.',
    screenCount: 128,
    blueprints: b1KleiderEpisodes,
    glossary: b1KleiderGlossary,
    modernizedByDefault: true,
    namedHeadings: ['Kleider machen Leute'],
    gutenbergId: 28042,
    excerptLabel: 'Kleider machen Leute z Die Leute von Seldwyla II · úplný text',
  }),
  defineBook({
    id: 'b1-nils',
    title: 'Nils Holgerssons wunderbare Reise',
    author: 'Selma Lagerlöf',
    translator: 'Pauline Klaiber',
    level: 'B1',
    accent: 'mint',
    genreCs: 'severské dobrodružství',
    descriptionCs:
      'Líný Nils chytí skřítka, poruší vlastní slib a zjistí, jaké je být najednou maličký.',
    contentNoteCs:
      'Nils chce skřítka uvěznit a v dalším příběhu se připomíná jeho hrubé chování ke zvířatům.',
    screenCount: 28,
    blueprints: b1NilsEpisodes,
    glossary: b1NilsGlossary,
    modernizedByDefault: true,
    namedHeadings: ['Der Junge', 'Das Wichtelmännchen'],
    gutenbergId: 31114,
    excerptLabel: '1. kapitola Der Junge · část Das Wichtelmännchen',
  }),
  defineBook({
    id: 'b1-immensee',
    title: 'Immensee',
    author: 'Theodor Storm',
    level: 'B1',
    accent: 'coral',
    genreCs: 'vzpomínková novela',
    descriptionCs: 'Reinhard přichází po letech na statek Immensee a znovu se setkává s Elisabeth.',
    contentNoteCs:
      'Citové napětí, nenaplněný vztah a dobové pojetí manželství a společenských rolí.',
    screenCount: 20,
    blueprints: b1ImmenseeEpisodes,
    glossary: b1ImmenseeGlossary,
    modernizedByDefault: true,
    namedHeadings: ['IMMENSEE'],
    gutenbergId: 6651,
    excerptLabel: 'Oddíl Immensee od příchodu Reinharda po bílou postavu v dešti',
  }),
  defineBook({
    id: 'b1-tom-sawyer',
    title: 'Die Abenteuer Tom Sawyers',
    author: 'Mark Twain',
    level: 'B1',
    audience: 'young-adult',
    accent: 'sky',
    genreCs: 'young adult dobrodružství',
    descriptionCs:
      'Tom promění trest ve výhodu, ale později musí místo triku najít odvahu říct pravdu.',
    contentNoteCs:
      'Děti se stanou svědky vraždy; zločin, strach a ohrožení jsou popsány bez detailního násilí.',
    screenCount: 16,
    blueprints: b1TomSawyerEpisodes,
    glossary: b1TomSawyerGlossary,
    namedHeadings: [
      'Die Strafe am Zaun',
      'Ein Handel ohne Geld',
      'Zeugen in der Nacht',
      'Der Mut zur Wahrheit',
    ],
    gutenbergId: 74,
    excerptLabel: 'Nová B1 německá studijní adaptace vybraných scén z The Adventures of Tom Sawyer',
    adapted: true,
  }),
  defineBook({
    id: 'b2-schimmelreiter',
    title: 'Der Schimmelreiter',
    author: 'Theodor Storm',
    level: 'B2',
    accent: 'cobalt',
    genreCs: 'gotická novela',
    descriptionCs: 'Bouřlivý rámec a mládí Haukeho, který chce změnit staré hráze.',
    contentNoteCs: 'Bouře, ohrožení, smrt zvířete a místy kruté jednání.',
    screenCount: 60,
    blueprints: b2Episodes,
    glossary: b2Glossary,
    gutenbergId: 74008,
    excerptLabel: 'Úvod a první část Haukeho příběhu · studijní výběr',
  }),
  defineBook({
    id: 'b2-sandmann',
    title: 'Der Sandmann',
    author: 'E. T. A. Hoffmann',
    level: 'B2',
    accent: 'coral',
    genreCs: 'romantická psychologická povídka',
    descriptionCs:
      'Úplná romantická povídka v dopisech a scénách, kde se trauma, optika a automat prolínají.',
    contentNoteCs:
      'Psychické zhroucení, dětské trauma, násilí, smrt rodiče, sebevražda a znepokojivé obrazy očí.',
    screenCount: 116,
    blueprints: b2SandmannEpisodes,
    glossary: b2SandmannGlossary,
    modernizedByDefault: true,
    namedHeadings: ['Der Sandmann', 'Nathanael an Lothar', 'Clara an Nathanael'],
    gutenbergId: 6341,
    excerptLabel: 'Der Sandmann z Nachtstücke · úplný text',
  }),
  defineBook({
    id: 'b2-taugenichts',
    title: 'Aus dem Leben eines Taugenichts',
    author: 'Joseph von Eichendorff',
    level: 'B2',
    accent: 'sky',
    genreCs: 'cestovní romance',
    descriptionCs:
      'Mlynářův syn vyrazí s houslemi do světa a mezi Vídní, zahradou a písněmi se zamiluje.',
    contentNoteCs:
      'Třídní výsměch, romantická idealizace a krátké melancholické obrazy bez explicitního násilí.',
    screenCount: 36,
    blueprints: b2TaugenichtsEpisodes,
    glossary: b2TaugenichtsGlossary,
    modernizedByDefault: true,
    namedHeadings: ['Erstes Kapitel'],
    gutenbergId: 35312,
    excerptLabel: '1. kapitola · úplný text',
  }),
  defineBook({
    id: 'b2-bahnwaerter',
    title: 'Bahnwärter Thiel',
    author: 'Gerhart Hauptmann',
    level: 'B2',
    accent: 'mint',
    genreCs: 'naturalistická psychologická novela',
    descriptionCs:
      'První kapitola sleduje Thielův přesný život mezi rodinou, železnicí a vzpomínkou na první ženu.',
    contentNoteCs:
      'Úmrtí při porodu, zanedbávání a týrání dítěte, domácí mocenský vztah i dobově hrubé a misogynní výrazy.',
    screenCount: 24,
    blueprints: b2BahnwaerterEpisodes,
    glossary: b2BahnwaerterGlossary,
    modernizedByDefault: true,
    namedHeadings: ['Bahnwärter Thiel', 'Erstes Kapitel'],
    gutenbergId: 29376,
    excerptLabel: '1. kapitola · úplný text od úvodu po Tobiasovo dětství',
  }),
  defineBook({
    id: 'b2-schatzinsel',
    title: 'Die Schatzinsel',
    author: 'Robert Louis Stevenson',
    level: 'B2',
    audience: 'young-adult',
    accent: 'butter',
    genreCs: 'pirátské dobrodružství',
    descriptionCs:
      'Mapa pokladu přivede Jima na loď, kde přátelský kuchař připravuje nebezpečnou vzpouru.',
    contentNoteCs:
      'Pirátské násilí, vyhrožování, smrt a zrada; adaptace nepopisuje zranění explicitně.',
    screenCount: 16,
    blueprints: b2SchatzinselEpisodes,
    glossary: b2SchatzinselGlossary,
    namedHeadings: [
      'Der Fremde an der Küste',
      'Die Karte in der Kiste',
      'Die Stimme im Fass',
      'Eine Entscheidung auf der Insel',
    ],
    gutenbergId: 120,
    excerptLabel: 'Nová B2 německá studijní adaptace úvodního oblouku Treasure Island',
    adapted: true,
  }),
  defineBook({
    id: 'c1-verwandlung',
    title: 'Die Verwandlung',
    author: 'Franz Kafka',
    level: 'C1',
    accent: 'coral',
    genreCs: 'absurdní novela',
    descriptionCs: 'Celá první část Kafkovy novely, rozdělená do soustředěných výjevů.',
    contentNoteCs: 'Tělesná proměna, psychický tlak, rodinný konflikt a násilí.',
    screenCount: 60,
    blueprints: c1Episodes,
    glossary: c1Glossary,
    gutenbergId: 22367,
    excerptLabel: 'Část I · úplný souvislý výběr',
  }),
  defineBook({
    id: 'c1-urteil',
    title: 'Das Urteil',
    author: 'Franz Kafka',
    level: 'C1',
    accent: 'mint',
    genreCs: 'psychologická povídka',
    descriptionCs:
      'Celá sevřená povídka o dopisu, otci a rozhovoru, v němž se logika moci prudce převrátí.',
    contentNoteCs: 'Psychický nátlak mezi otcem a synem, ponižování, rozsudek smrti a sebevražda.',
    screenCount: 40,
    blueprints: c1UrteilEpisodes,
    glossary: c1UrteilGlossary,
    modernizedByDefault: true,
    gutenbergId: 21593,
    excerptLabel: 'Das Urteil · úplný text povídky',
  }),
  defineBook({
    id: 'c1-krug',
    title: 'Der zerbrochene Krug',
    author: 'Heinrich von Kleist',
    level: 'C1',
    accent: 'butter',
    genreCs: 'soudní komedie',
    descriptionCs:
      'Zraněný soudce čeká kontrolu a každou novou otázkou zamotává vlastní noční alibi.',
    contentNoteCs:
      'Celá hra pracuje se zneužitím soudní moci, nátlakem a sexuální hrozbou; vybraný úsek je situační komedie.',
    screenCount: 32,
    blueprints: c1KrugEpisodes,
    glossary: c1KrugGlossary,
    modernizedByDefault: true,
    namedHeadings: ['Erster Auftritt', 'Zweiter Auftritt'],
    gutenbergId: 6647,
    excerptLabel: '1. a 2. výstup · souvislý studijní výběr',
  }),
  defineBook({
    id: 'c1-wahlverwandtschaften',
    title: 'Die Wahlverwandtschaften',
    author: 'Johann Wolfgang von Goethe',
    level: 'C1',
    accent: 'cobalt',
    genreCs: 'společenský román idejí',
    descriptionCs:
      'První kapitola: Eduard a Charlotte rozhodují, zda do pečlivě uspořádaného života pozvou třetího člověka.',
    contentNoteCs:
      'Dobové zobecňování rolí mužů a žen, třídní hierarchie a vzpomínky na sňatky uzavřené z majetkových důvodů.',
    screenCount: 24,
    blueprints: c1WahlverwandtschaftenEpisodes,
    glossary: c1WahlverwandtschaftenGlossary,
    modernizedByDefault: true,
    namedHeadings: ['Erster Teil', 'Erstes Kapitel'],
    gutenbergId: 2403,
    excerptLabel: 'První část, 1. kapitola · úplný text kapitoly',
  }),
  defineBook({
    id: 'c1-dorian-gray',
    title: 'Das Bildnis des Dorian Gray',
    author: 'Oscar Wilde',
    level: 'C1',
    audience: 'new-adult',
    accent: 'coral',
    genreCs: 'gotický dark academia román',
    descriptionCs:
      'Krása, vliv a skryté svědomí v příběhu, kde obraz nese následky místo mladé tváře.',
    contentNoteCs:
      'Manipulace, sebevražda mimo scénu, morální rozklad a psychický tlak bez explicitního popisu.',
    screenCount: 16,
    blueprints: c1DorianGrayEpisodes,
    glossary: c1DorianGrayGlossary,
    namedHeadings: [
      'Das Porträt im Atelier',
      'Der Preis ewiger Jugend',
      'Die erste Veränderung',
      'Das verschlossene Gewissen',
    ],
    gutenbergId: 174,
    excerptLabel: 'Nová C1 německá studijní adaptace klíčových scén z The Picture of Dorian Gray',
    adapted: true,
  }),
];

const storySourceLoaders: Record<StoryBookId, () => Promise<{ default: string }>> = {
  'a1-maerchen': () => import('./sources/a1-maerchen.txt?raw'),
  'a1-haewelmann': () => import('./sources/a1-haewelmann.txt?raw'),
  'a1-bremer': () => import('./sources/a1-bremer.txt?raw'),
  'a1-fabeln': () => import('./sources/a1-fabeln.txt?raw'),
  'a1-haensel-gretel': () => import('./sources/a1-haensel-gretel.txt?raw'),
  'a2-maerchen': () => import('./sources/a2-maerchen.txt?raw'),
  'a2-max-moritz': () => import('./sources/a2-max-moritz.txt?raw'),
  'a2-alice': () => import('./sources/a2-alice.txt?raw'),
  'a2-mondfahrt': () => import('./sources/a2-mondfahrt.txt?raw'),
  'a2-biene-maja': () => import('./sources/a2-biene-maja.txt?raw'),
  'b1-heidi': () => import('./sources/b1-heidi.txt?raw'),
  'b1-kleider': () => import('./sources/b1-kleider.txt?raw'),
  'b1-nils': () => import('./sources/b1-nils.txt?raw'),
  'b1-immensee': () => import('./sources/b1-immensee.txt?raw'),
  'b1-tom-sawyer': () => import('./sources/b1-tom-sawyer.txt?raw'),
  'b2-schimmelreiter': () => import('./sources/b2-schimmelreiter.txt?raw'),
  'b2-sandmann': () => import('./sources/b2-sandmann.txt?raw'),
  'b2-taugenichts': () => import('./sources/b2-taugenichts.txt?raw'),
  'b2-bahnwaerter': () => import('./sources/b2-bahnwaerter.txt?raw'),
  'b2-schatzinsel': () => import('./sources/b2-schatzinsel.txt?raw'),
  'c1-verwandlung': () => import('./sources/c1-verwandlung.txt?raw'),
  'c1-urteil': () => import('./sources/c1-urteil.txt?raw'),
  'c1-krug': () => import('./sources/c1-krug.txt?raw'),
  'c1-wahlverwandtschaften': () => import('./sources/c1-wahlverwandtschaften.txt?raw'),
  'c1-dorian-gray': () => import('./sources/c1-dorian-gray.txt?raw'),
};

function summarizeBook(input: StoryBookDefinition): StoryBookSummary {
  return {
    id: input.id,
    title: input.title,
    author: input.author,
    level: input.level,
    audience: input.audience ?? 'all-ages',
    accent: input.accent,
    genreCs: input.genreCs,
    descriptionCs: input.descriptionCs,
    contentNoteCs: input.contentNoteCs,
    screenCount: input.screenCount,
    episodeCount: input.blueprints.length,
    approximateMinutes: input.blueprints.length * 5,
    modernizedByDefault: input.modernizedByDefault ?? false,
    source: source(input.gutenbergId, input.excerptLabel, input.adapted, input.translator),
    episodes: input.blueprints.map((blueprint, index) => ({
      id: `${input.id}-e${String(index + 1).padStart(2, '0')}`,
      index,
      number: index + 1,
      title: blueprint.title,
      summaryCs: blueprint.summaryCs,
      minutes: 5,
    })),
  };
}

export const storyBookSummaries: StoryBookSummary[] = storyBookDefinitions.map(summarizeBook);

const definitionsById = new Map(storyBookDefinitions.map((book) => [book.id, book]));
const summariesById = new Map(storyBookSummaries.map((book) => [book.id, book]));
const loadedBookPromises = new Map<StoryBookId, Promise<StoryBook>>();

export function storyBookSummaryById(id: string): StoryBookSummary | undefined {
  return summariesById.get(id as StoryBookId);
}

export function loadStoryBook(id: string): Promise<StoryBook | undefined> {
  const definition = definitionsById.get(id as StoryBookId);
  if (!definition) return Promise.resolve(undefined);
  const cached = loadedBookPromises.get(definition.id);
  if (cached) return cached;
  const promise = storySourceLoaders[definition.id]()
    .then((module) => makeBook(definition, module.default))
    .catch((error: unknown) => {
      loadedBookPromises.delete(definition.id);
      throw error;
    });
  loadedBookPromises.set(definition.id, promise);
  return promise;
}

export async function loadStoryBooks(): Promise<StoryBook[]> {
  return Promise.all(
    storyBookDefinitions.map((book) => loadStoryBook(book.id) as Promise<StoryBook>),
  );
}

export function storyPageEdition(book: StoryBook, useOriginal: boolean): StoryPage[] {
  return useOriginal && book.originalPages ? book.originalPages : book.pages;
}

export function storyEpisodePages(
  book: StoryBook,
  episodeId: string,
  useOriginal: boolean,
): StoryPage[] {
  const episode = book.episodes.find((candidate) => candidate.id === episodeId);
  if (!episode) return [];
  const edition = storyPageEdition(book, useOriginal);
  return episode.pages.map((page) => edition[page.index]);
}
