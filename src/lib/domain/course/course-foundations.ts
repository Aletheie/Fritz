import type { Article, VerbForms } from '../types.ts';
import type { CourseWord } from './path.ts';

type FoundationWord = CourseWord & { english: string };

function term(
  german: string,
  czech: string,
  english: string,
  exampleDe: string,
  exampleCs: string,
): FoundationWord {
  const [meaning, ...acceptedCzech] = czech.split(';').map((part) => part.trim());
  return {
    german,
    czech: meaning,
    acceptedCzech,
    english,
    exampleDe,
    exampleCs,
    kind: 'other',
    cefr: 'A1',
    role: 'target',
    contexts: [exampleDe],
    collocations: [exampleDe],
  };
}

function noun(
  german: string,
  czech: string,
  english: string,
  article: Article,
  plural: string,
  exampleDe: string,
  exampleCs: string,
): FoundationWord {
  return { ...term(german, czech, english, exampleDe, exampleCs), kind: 'noun', article, plural };
}

function verb(
  german: string,
  czech: string,
  english: string,
  forms: [string, string, string, VerbForms['auxiliary']],
  exampleDe: string,
  exampleCs: string,
): FoundationWord {
  return {
    ...term(german, czech, english, exampleDe, exampleCs),
    kind: 'verb',
    verbForms: {
      thirdPerson: forms[0],
      preterite: forms[1],
      participle: forms[2],
      auxiliary: forms[3],
    },
  };
}

export const courseFoundations: Record<string, FoundationWord[]> = {
  'chapter-31-first-introduction': [
    noun('Name', 'jméno', 'name', 'der', 'Namen', 'Mein Name ist Lea.', 'Jmenuji se Lea.'),
    verb(
      'heißen',
      'jmenovat se',
      'to be called',
      ['heißt', 'hieß', 'geheißen', 'haben'],
      'Wie heißt du?',
      'Jak se jmenuješ?',
    ),
    verb(
      'kommen',
      'přijít; pocházet',
      'to come',
      ['kommt', 'kam', 'gekommen', 'sein'],
      'Ich komme aus Prag.',
      'Pocházím z Prahy.',
    ),
    term('aus', 'z; ze', 'from; out of', 'Lea kommt aus Berlin.', 'Lea pochází z Berlína.'),
    verb(
      'sein',
      'být',
      'to be',
      ['ist', 'war', 'gewesen', 'sein'],
      'Ich bin neu in der Klasse.',
      'Jsem ve třídě nová.',
    ),
    verb(
      'haben',
      'mít',
      'to have',
      ['hat', 'hatte', 'gehabt', 'haben'],
      'Ich habe ein Heft.',
      'Mám sešit.',
    ),
  ],
  'chapter-32-find-the-right-page': [
    term('eins', 'jedna', 'one', 'Die Antwort ist eins.', 'Odpověď je jedna.'),
    term('zwei', 'dva', 'two', 'Wir lesen Seite zwei.', 'Čteme stranu dvě.'),
    term('drei', 'tři', 'three', 'Ich habe drei Hefte.', 'Mám tři sešity.'),
    term('vier', 'čtyři', 'four', 'Die Aufgabe steht auf Seite vier.', 'Úloha je na straně čtyři.'),
  ],
  'chapter-33-ask-for-repetition': [
    term('fünf', 'pět', 'five', 'Bitte wiederhole die Nummer fünf.', 'Zopakuj prosím číslo pět.'),
    term('sechs', 'šest', 'six', 'Meinst du Seite sechs?', 'Myslíš stranu šest?'),
    term('sieben', 'sedm', 'seven', 'Die Nummer ist sieben.', 'Číslo je sedm.'),
    term(
      'acht',
      'osm',
      'eight',
      'Bitte lies Satz acht noch einmal.',
      'Přečti prosím větu osm ještě jednou.',
    ),
  ],
  'chapter-34-simple-order': [
    noun(
      'Wasser',
      'voda',
      'water',
      'das',
      'Wasser',
      'Ich möchte ein Glas Wasser.',
      'Chtěla bych sklenici vody.',
    ),
    noun('Brot', 'chléb', 'bread', 'das', 'Brote', 'Das Brot ist frisch.', 'Chléb je čerstvý.'),
    noun(
      'Milch',
      'mléko',
      'milk',
      'die',
      'Milch',
      'Ich nehme eine Tasse Milch.',
      'Dám si šálek mléka.',
    ),
    noun('Tee', 'čaj', 'tea', 'der', 'Tees', 'Ein Tee, bitte.', 'Jeden čaj, prosím.'),
  ],
  'chapter-35-price-and-payment': [
    term('neun', 'devět', 'nine', 'Das kostet neun Euro.', 'To stojí devět eur.'),
    term('zehn', 'deset', 'ten', 'Ich habe zehn Euro.', 'Mám deset eur.'),
    term('zwanzig', 'dvacet', 'twenty', 'Ich bezahle mit zwanzig Euro.', 'Platím dvaceti eury.'),
    term(
      'hundert',
      'sto',
      'one hundred',
      'Hundert Cent sind ein Euro.',
      'Sto centů je jedno euro.',
    ),
  ],
  'chapter-36-takeaway-order': [
    term(
      'bitte',
      'prosím',
      'please',
      'Ein Brötchen zum Mitnehmen, bitte.',
      'Jednu housku s sebou, prosím.',
    ),
    term('danke', 'děkuji', 'thank you', 'Danke für das Brot.', 'Děkuji za chléb.'),
    noun(
      'Apfel',
      'jablko',
      'apple',
      'der',
      'Äpfel',
      'Ich nehme noch einen Apfel.',
      'Vezmu si ještě jedno jablko.',
    ),
    verb(
      'essen',
      'jíst',
      'to eat',
      ['isst', 'aß', 'gegessen', 'haben'],
      'Ich esse das Brötchen zu Hause.',
      'Housku sním doma.',
    ),
  ],
  'chapter-37-repair-the-order': [
    term('nicht', 'ne; nikoli', 'not', 'Ich möchte das Brot nicht.', 'Ten chléb nechci.'),
    term('kein', 'žádný', 'no; not a', 'Ich möchte kein Croissant.', 'Nechci žádný croissant.'),
    term('mit', 's; se', 'with', 'Einen Tee mit Milch, bitte.', 'Jeden čaj s mlékem, prosím.'),
    term('ohne', 'bez', 'without', 'Bitte ohne Milch.', 'Prosím bez mléka.'),
  ],
  'chapter-38-morning-time': [
    term('heute', 'dnes', 'today', 'Heute stehe ich früh auf.', 'Dnes vstávám brzy.'),
    term(
      'morgen',
      'zítra',
      'tomorrow',
      'Morgen beginnt die Schule um acht.',
      'Zítra začíná škola v osm.',
    ),
    noun(
      'Tag',
      'den',
      'day',
      'der',
      'Tage',
      'Mein Tag beginnt um sieben.',
      'Můj den začíná v sedm.',
    ),
    noun(
      'Uhr',
      'hodiny; hodinky',
      'clock; watch',
      'die',
      'Uhren',
      'Die Uhr zeigt sieben.',
      'Hodiny ukazují sedm.',
    ),
  ],
  'chapter-39-who-lives-here': [
    noun(
      'Mutter',
      'matka',
      'mother',
      'die',
      'Mütter',
      'Meine Mutter wohnt hier.',
      'Moje matka bydlí tady.',
    ),
    noun(
      'Vater',
      'otec',
      'father',
      'der',
      'Väter',
      'Mein Vater kommt aus Brünn.',
      'Můj otec pochází z Brna.',
    ),
    noun(
      'Familie',
      'rodina',
      'family',
      'die',
      'Familien',
      'Meine Familie wohnt in Prag.',
      'Moje rodina bydlí v Praze.',
    ),
    noun(
      'Eltern',
      'rodiče',
      'parents',
      'die',
      'Eltern',
      'Meine Eltern sind zu Hause.',
      'Moji rodiče jsou doma.',
    ),
  ],
  'chapter-40-whose-is-it': [
    term('mein', 'můj', 'my', 'Das ist mein Schlüssel.', 'To je můj klíč.'),
    term('dein', 'tvůj', 'your', 'Ist das dein Heft?', 'Je to tvůj sešit?'),
    noun(
      'Tasche',
      'taška',
      'bag',
      'die',
      'Taschen',
      'Der Schlüssel liegt in meiner Tasche.',
      'Klíč leží v mé tašce.',
    ),
    noun('Zimmer', 'pokoj', 'room', 'das', 'Zimmer', 'Das ist unser Zimmer.', 'To je náš pokoj.'),
  ],
  'chapter-41-evening-together': [
    verb(
      'machen',
      'dělat',
      'to do; to make',
      ['macht', 'machte', 'gemacht', 'haben'],
      'Was machen wir heute Abend?',
      'Co budeme dnes večer dělat?',
    ),
    verb(
      'spielen',
      'hrát',
      'to play',
      ['spielt', 'spielte', 'gespielt', 'haben'],
      'Wir spielen zusammen.',
      'Hrajeme spolu.',
    ),
    noun(
      'Abend',
      'večer',
      'evening',
      'der',
      'Abende',
      'Am Abend bin ich zu Hause.',
      'Večer jsem doma.',
    ),
    noun(
      'Abendessen',
      'večeře',
      'dinner',
      'das',
      'Abendessen',
      'Das Abendessen ist fertig.',
      'Večeře je hotová.',
    ),
  ],
  'chapter-42-route-to-destination': [
    noun(
      'Straße',
      'ulice',
      'street',
      'die',
      'Straßen',
      'Die Schule ist in dieser Straße.',
      'Škola je v této ulici.',
    ),
    noun('Park', 'park', 'park', 'der', 'Parks', 'Der Park ist links.', 'Park je vlevo.'),
    noun(
      'Haus',
      'dům',
      'house',
      'das',
      'Häuser',
      'Das Haus steht neben der Schule.',
      'Dům stojí vedle školy.',
    ),
    term('wo', 'kde', 'where', 'Wo ist die Haltestelle?', 'Kde je zastávka?'),
  ],
  'chapter-43-right-stop': [
    noun(
      'Bus',
      'autobus',
      'bus',
      'der',
      'Busse',
      'Der Bus fährt zum Bahnhof.',
      'Autobus jede na nádraží.',
    ),
    noun(
      'Zug',
      'vlak',
      'train',
      'der',
      'Züge',
      'Der Zug fährt um neun Uhr.',
      'Vlak jede v devět hodin.',
    ),
    noun(
      'Montag',
      'pondělí',
      'Monday',
      'der',
      'Montage',
      'Am Montag nehme ich den Bus.',
      'V pondělí jedu autobusem.',
    ),
    noun(
      'Dienstag',
      'úterý',
      'Tuesday',
      'der',
      'Dienstage',
      'Am Dienstag fährt der Zug später.',
      'V úterý jede vlak později.',
    ),
  ],
  'chapter-44-transfer-in-town': [
    noun(
      'Mittwoch',
      'středa',
      'Wednesday',
      'der',
      'Mittwoche',
      'Am Mittwoch steige ich hier um.',
      'Ve středu tady přestupuji.',
    ),
    noun(
      'Donnerstag',
      'čtvrtek',
      'Thursday',
      'der',
      'Donnerstage',
      'Am Donnerstag fährt der Bus um acht.',
      'Ve čtvrtek jede autobus v osm.',
    ),
    noun(
      'Freitag',
      'pátek',
      'Friday',
      'der',
      'Freitage',
      'Am Freitag fahren wir in die Stadt.',
      'V pátek jedeme do města.',
    ),
    noun(
      'Samstag',
      'sobota',
      'Saturday',
      'der',
      'Samstage',
      'Am Samstag fährt der Bus jede Stunde.',
      'V sobotu jede autobus každou hodinu.',
    ),
    noun(
      'Sonntag',
      'neděle',
      'Sunday',
      'der',
      'Sonntage',
      'Am Sonntag fährt hier kein Bus.',
      'V neděli tady autobus nejezdí.',
    ),
  ],
  'chapter-103-weather-and-clothing': [
    noun(
      'Wetter',
      'počasí',
      'weather',
      'das',
      'Wetter',
      'Das Wetter ist heute gut.',
      'Dnes je dobré počasí.',
    ),
    noun(
      'Jacke',
      'bunda',
      'jacket',
      'die',
      'Jacken',
      'Ich nehme eine Jacke mit.',
      'Beru si s sebou bundu.',
    ),
    {
      ...term('warm', 'teplý', 'warm', 'Die Jacke ist warm.', 'Bunda je teplá.'),
      kind: 'adjective',
    },
    {
      ...term('kalt', 'studený', 'cold', 'Heute ist es kalt.', 'Dnes je zima.'),
      kind: 'adjective',
    },
  ],
  'chapter-104-library-services': [
    noun(
      'Buch',
      'kniha',
      'book',
      'das',
      'Bücher',
      'Ich suche ein Buch auf Deutsch.',
      'Hledám knihu v němčině.',
    ),
    verb(
      'lesen',
      'číst',
      'to read',
      ['liest', 'las', 'gelesen', 'haben'],
      'Ich lese das Buch zu Hause.',
      'Knihu čtu doma.',
    ),
    verb(
      'öffnen',
      'otevřít',
      'to open',
      ['öffnet', 'öffnete', 'geöffnet', 'haben'],
      'Die Bibliothek öffnet um zehn Uhr.',
      'Knihovna otevírá v deset hodin.',
    ),
    verb(
      'schließen',
      'zavřít',
      'to close',
      ['schließt', 'schloss', 'geschlossen', 'haben'],
      'Die Bibliothek schließt um sechs Uhr.',
      'Knihovna zavírá v šest hodin.',
    ),
  ],
};

for (const word of Object.values(courseFoundations).flat()) {
  if (['Wasser', 'Milch', 'Wetter'].includes(word.german)) {
    word.plural = '—';
    word.learningNote = 'V tomto významu se běžně používá bez množného čísla.';
  }
  if (word.german === 'Eltern')
    word.learningNote = 'Tento výraz má pouze množné číslo: die Eltern.';
}

export const foundationEnglishByGerman: Record<string, string> = Object.fromEntries(
  Object.values(courseFoundations)
    .flat()
    .map((word) => [word.german, word.english]),
);
