import type { DetailedCefrLevel } from '../types.ts';
import type { LearnerCopy } from './course-communication.ts';

export type CourseInformationGap = {
  chapterId: string;
  level: DetailedCefrLevel;
  title: LearnerCopy;
  goal: LearnerCopy;
  known: string;
  partner: string;
  queries: Array<{ id: string; question: string; reply: string }>;
  requiredQueryIds: string[];
  decision: string;
  answer: string;
  alternatives: string[];
  explanation: LearnerCopy;
};

export const courseInformationGaps: CourseInformationGap[] = [
  {
    chapterId: 'chapter-101-market-groceries',
    level: 'A1.1',
    title: { cs: 'Co koupíš za čtyři eura?', en: 'What can you buy for four euros?' },
    goal: {
      cs: 'Máš čtyři eura a chceš koupit rajčata i okurku. Zjisti ceny a vyber nákup.',
      en: 'You have four euros and want both tomatoes and a cucumber. Find the prices and choose your shopping.',
    },
    known: 'Ich habe vier Euro. Ich möchte Tomaten und eine Gurke.',
    partner: 'Verkäuferin',
    queries: [
      {
        id: 'tomatoes',
        question: 'Was kostet ein Kilo Tomaten?',
        reply: 'Ein Kilo kostet vier Euro. Ein halbes Kilo kostet zwei Euro.',
      },
      {
        id: 'cucumber',
        question: 'Was kostet eine Gurke?',
        reply: 'Eine Gurke kostet einen Euro.',
      },
      {
        id: 'bag',
        question: 'Haben Sie eine Tasche?',
        reply: 'Ja. Eine Tasche kostet zwei Euro. Du kannst auch deinen Stoffbeutel nehmen.',
      },
    ],
    requiredQueryIds: ['tomatoes', 'cucumber'],
    decision: 'Was kaufst du für höchstens vier Euro?',
    answer: 'Ein halbes Kilo Tomaten und eine Gurke.',
    alternatives: [
      'Ein Kilo Tomaten und eine Gurke.',
      'Ein halbes Kilo Tomaten, eine Gurke und eine Tasche.',
    ],
    explanation: {
      cs: 'Půl kila rajčat stojí dvě eura a okurka jedno. Celkem tři eura; ostatní nákupy stojí pět.',
      en: 'Half a kilo of tomatoes costs two euros and a cucumber one. That totals three euros; the other purchases cost five.',
    },
  },
  {
    chapterId: 'chapter-103-weather-and-clothing',
    level: 'A1.2',
    title: { cs: 'Výlet a počasí', en: 'A trip and the weather' },
    goal: {
      cs: 'Domluv výlet na suchý den a zjisti, co si vzít. Máš čas v sobotu i v neděli.',
      en: 'Arrange a trip on a dry day and find out what to bring. You are free on Saturday and Sunday.',
    },
    known: 'Ich habe am Samstag und am Sonntag Zeit. Ich möchte ohne Regen spazieren gehen.',
    partner: 'Lea',
    queries: [
      {
        id: 'day',
        question: 'Wie wird das Wetter am Wochenende?',
        reply: 'Am Samstag regnet es. Am Sonntag bleibt es trocken.',
      },
      {
        id: 'clothes',
        question: 'Brauche ich eine warme Jacke?',
        reply: 'Ja, es ist an beiden Tagen kalt.',
      },
      {
        id: 'food',
        question: 'Gibt es dort ein Café?',
        reply: 'Ja, am Park gibt es ein kleines Café.',
      },
    ],
    requiredQueryIds: ['day', 'clothes'],
    decision: 'Welcher Plan passt?',
    answer: 'Wir gehen am Sonntag und nehmen warme Jacken mit.',
    alternatives: ['Wir gehen am Samstag ohne Jacken.', 'Wir gehen am Sonntag ohne Jacken.'],
    explanation: {
      cs: 'Sucho bude v neděli, ale zima zůstane oba dny. Je potřeba spojit den výletu s vhodným oblečením.',
      en: 'Sunday will be dry, but both days will be cold. Combine the choice of day with suitable clothing.',
    },
  },
  {
    chapterId: 'chapter-105-dietary-needs',
    level: 'A2.1',
    title: { cs: 'Vyber jídlo podle složení', en: 'Choose by the ingredients' },
    goal: {
      cs: 'Chceš teplé vegetariánské jídlo bez mléčných výrobků. Zeptej se obsluhy na dvě nabídky.',
      en: 'You want a warm vegetarian meal without dairy. Ask the server about two dishes.',
    },
    known: 'Ich esse vegetarisch und möchte keine Milchprodukte. Heute möchte ich etwas Warmes.',
    partner: 'Kellner',
    queries: [
      {
        id: 'soup',
        question: 'Ist die Gemüsesuppe mit Milch oder Sahne?',
        reply: 'Die Suppe ist warm und vegetarisch, aber wir kochen sie mit Sahne.',
      },
      {
        id: 'rice',
        question: 'Welche Zutaten hat das Reisgericht?',
        reply:
          'Es besteht aus Reis, Gemüse und Olivenöl. Es ist warm und enthält weder Fleisch noch Milchprodukte.',
      },
      {
        id: 'salad',
        question: 'Ist der Salat warm?',
        reply: 'Nein, der Salat wird kalt serviert.',
      },
    ],
    requiredQueryIds: ['soup', 'rice'],
    decision: 'Was bestellst du?',
    answer: 'Das warme Reisgericht mit Gemüse und Olivenöl.',
    alternatives: ['Die Gemüsesuppe mit Sahne.', 'Den kalten Salat.'],
    explanation: {
      cs: 'Rýžové jídlo splňuje všechny tři požadavky. Polévka obsahuje smetanu a salát není teplý.',
      en: 'The rice dish meets all three requirements. The soup contains cream and the salad is not warm.',
    },
  },
  {
    chapterId: 'chapter-107-travel-disruptions',
    level: 'A2.2',
    title: { cs: 'Stihni schůzku', en: 'Make your appointment' },
    goal: {
      cs: 'Do cíle musíš přijet nejpozději v 17:30 a můžeš připlatit nejvýše deset eur. Zjisti možnosti.',
      en: 'You must arrive by 17:30 and can pay at most ten euros extra. Find your options.',
    },
    known:
      'Mein Zug fällt aus. Ich muss spätestens um 17:30 Uhr ankommen. Ich habe noch zehn Euro.',
    partner: 'Mitarbeiterin am Bahnhof',
    queries: [
      {
        id: 'bus',
        question: 'Wann kommt der Ersatzbus an und was kostet er?',
        reply: 'Der Ersatzbus kommt um 18:00 Uhr an. Deine Fahrkarte gilt auch im Bus.',
      },
      {
        id: 'express',
        question: 'Gibt es eine frühere Verbindung?',
        reply:
          'Der Schnellzug kommt um 17:10 Uhr an. Dafür brauchst du einen Zuschlag von acht Euro.',
      },
      {
        id: 'refund',
        question: 'Wo kann ich später eine Erstattung beantragen?',
        reply: 'Dafür gibt es ein Formular im Servicezentrum.',
      },
    ],
    requiredQueryIds: ['bus', 'express'],
    decision: 'Welche Entscheidung passt zu Zeit und Budget?',
    answer: 'Ich zahle acht Euro und nehme den Schnellzug.',
    alternatives: [
      'Ich nehme den kostenlosen Ersatzbus.',
      'Ich nehme den Schnellzug ohne Zuschlag.',
    ],
    explanation: {
      cs: 'Rychlík přijede včas a příplatek osm eur se vejde do rozpočtu. Náhradní autobus přijede pozdě.',
      en: 'The express arrives in time and its eight-euro supplement fits the budget. The replacement bus arrives too late.',
    },
  },
  {
    chapterId: 'chapter-109-community-volunteering',
    level: 'B1.1',
    title: { cs: 'Najdi vhodnou roli', en: 'Find a suitable role' },
    goal: {
      cs: 'Můžeš pomáhat od deseti do dvanácti a nemůžeš nosit těžké věci. Domluv si práci i příchod.',
      en: 'You can help from ten to twelve and cannot carry heavy items. Arrange a task and when to arrive.',
    },
    known: 'Ich kann zwischen 10 und 12 Uhr helfen, aber keine schweren Sachen tragen.',
    partner: 'Organisatorin',
    queries: [
      {
        id: 'tasks',
        question: 'Welche Aufgaben sind in dieser Zeit noch frei?',
        reply:
          'Wir brauchen Hilfe beim Tragen der Kisten und am Infotisch. Am Infotisch gibst du nur Auskunft.',
      },
      {
        id: 'briefing',
        question: 'Wann bekomme ich die Einweisung für den Infotisch?',
        reply:
          'Komm um 10 Uhr direkt zum Infotisch. Wir erklären dir dort alles, bevor du anfängst.',
      },
      {
        id: 'end',
        question: 'Wie lange dauert die ganze Veranstaltung?',
        reply: 'Die Veranstaltung endet um 16 Uhr. Du musst nicht bis zum Ende bleiben.',
      },
    ],
    requiredQueryIds: ['tasks', 'briefing'],
    decision: 'Was bestätigst du?',
    answer: 'Ich komme um 10 Uhr zur Einweisung am Infotisch und helfe bis 12 Uhr.',
    alternatives: [
      'Ich trage von 10 bis 12 Uhr die schweren Kisten.',
      'Ich komme erst um 12 Uhr zur Einweisung am Infotisch.',
    ],
    explanation: {
      cs: 'Informační stolek nevyžaduje zvedání břemen. Zaškolení proběhne při tvém příchodu v deset a směna skončí v poledne.',
      en: 'The information desk requires no lifting. Your briefing happens when you arrive at ten and your shift ends at noon.',
    },
  },
  {
    chapterId: 'chapter-111-academic-presentation',
    level: 'B1.2',
    title: { cs: 'Připrav společnou prezentaci', en: 'Prepare a joint presentation' },
    goal: {
      cs: 'Rozděl osm minut mezi sebe a spolužačku a zajisti odevzdání snímků.',
      en: 'Divide eight minutes between yourself and your classmate, and arrange submission of the slides.',
    },
    known:
      'Unsere Präsentation darf acht Minuten dauern. Ich übernehme Einleitung und Schluss; Mira erklärt das Beispiel.',
    partner: 'Mira',
    queries: [
      {
        id: 'length',
        question: 'Wie viel Zeit brauchst du für dein Beispiel?',
        reply: 'Mein Beispiel dauert fünf Minuten. Für deinen Teil bleiben also drei Minuten.',
      },
      {
        id: 'file',
        question: 'Wer schickt die Folien ab und bis wann?',
        reply:
          'Ich schicke unsere gemeinsame Datei heute bis 18 Uhr ab. Bitte gib mir deinen Teil bis 17 Uhr.',
      },
      {
        id: 'style',
        question: 'Welche Farbe haben deine Überschriften?',
        reply: 'Ich habe dunkelblaue Überschriften verwendet.',
      },
    ],
    requiredQueryIds: ['length', 'file'],
    decision: 'Welcher Arbeitsplan ist richtig?',
    answer: 'Ich spreche drei Minuten und gebe Mira meine Folien bis 17 Uhr.',
    alternatives: [
      'Ich spreche fünf Minuten und gebe Mira die Folien morgen.',
      'Ich spreche drei Minuten und gebe Mira die Folien erst um 18 Uhr.',
    ],
    explanation: {
      cs: 'Po pětiminutovém příkladu zbývají tři minuty. Tvůj díl musí být u Miry v 17 hodin, hodinu před společným odevzdáním.',
      en: 'The five-minute example leaves three minutes. Mira needs your part at 17:00, one hour before the joint submission.',
    },
  },
  {
    chapterId: 'chapter-113-energy-efficiency',
    level: 'B2.1',
    title: { cs: 'Porovnej návrhy úspory', en: 'Compare energy-saving proposals' },
    goal: {
      cs: 'Pro školní klub můžeš schválit jen opatření do 300 eur se srovnatelně podloženou úsporou.',
      en: 'For the school club, you may approve only a measure costing at most 300 euros with comparable evidence of savings.',
    },
    known:
      'Unser Budget beträgt 300 Euro. Wir wollen zunächst eine Maßnahme mit nachvollziehbar gemessener Einsparung umsetzen.',
    partner: 'Projektgruppe',
    queries: [
      {
        id: 'cost',
        question: 'Was kosten die beiden Vorschläge?',
        reply: 'Die Zeitschaltuhren kosten 180 Euro. Neue Fenster würden 8.000 Euro kosten.',
      },
      {
        id: 'evidence',
        question: 'Wie habt ihr die mögliche Einsparung geprüft?',
        reply:
          'Die Zeitschaltuhren wurden in zwei gleich genutzten Räumen verglichen. Für die Fenster haben wir nur eine Herstellerangabe ohne Vergleich im Gebäude.',
      },
      {
        id: 'colour',
        question: 'Sind die Zeitschaltuhren in verschiedenen Farben erhältlich?',
        reply: 'Es gibt sie in Weiß und Grau.',
      },
    ],
    requiredQueryIds: ['cost', 'evidence'],
    decision: 'Welche Empfehlung folgt aus den Angaben?',
    answer:
      'Wir setzen zunächst die Zeitschaltuhren ein und prüfen die Einsparung im weiteren Betrieb.',
    alternatives: [
      'Wir bestellen sofort die Fenster, weil die Herstellerangabe ausreicht.',
      'Wir lehnen die Zeitschaltuhren ab, weil sie über dem Budget liegen.',
    ],
    explanation: {
      cs: 'Spínací hodiny se vejdou do rozpočtu a mají místní srovnání. Další měření je vhodné; pokus nezaručuje stejnou úsporu v každém prostoru.',
      en: 'The timers fit the budget and have a local comparison. Further measurement is appropriate; the trial does not guarantee identical savings everywhere.',
    },
  },
  {
    chapterId: 'chapter-115-digital-privacy',
    level: 'B2.2',
    title: { cs: 'Nastav sdílení projektu', en: 'Set up project sharing' },
    goal: {
      cs: 'Chceš dát zpětnou vazbu ke třídnímu projektu bez veřejného přístupu a bez možnosti měnit obsah.',
      en: 'You want to give feedback on a class project without public access or permission to change its content.',
    },
    known:
      'Nur unsere Projektgruppe soll die Datei sehen. Ich möchte Kommentare schreiben, aber den Inhalt nicht bearbeiten.',
    partner: 'Projektleitung',
    queries: [
      {
        id: 'access',
        question: 'Wer kann den aktuellen Link öffnen?',
        reply:
          'Im Moment kann jeder mit dem Link die Datei öffnen. Ich kann den Zugriff auf die eingeladenen Konten beschränken.',
      },
      {
        id: 'roles',
        question: 'Welche Berechtigungen stehen zur Auswahl?',
        reply:
          'Lesen erlaubt keine Kommentare. Kommentieren erlaubt Rückmeldungen ohne Änderungen am Inhalt. Bearbeiten erlaubt beides.',
      },
      {
        id: 'name',
        question: 'Wie heißt die Datei?',
        reply: 'Die Datei heißt Klassenprojekt – Entwurf.',
      },
    ],
    requiredQueryIds: ['access', 'roles'],
    decision: 'Welche Einstellung bittest du einzurichten?',
    answer: 'Zugriff nur für eingeladene Konten und für mich die Rolle Kommentieren.',
    alternatives: [
      'Öffentlicher Link und für mich die Rolle Bearbeiten.',
      'Zugriff nur für eingeladene Konten und für mich die Rolle Lesen.',
    ],
    explanation: {
      cs: 'Omezení přístupu řeší okruh lidí; role pro komentování řeší tvoje oprávnění. Jedno nastavení nenahrazuje druhé.',
      en: 'Restricted access controls who can open the file; the commenting role controls your permissions. Neither setting replaces the other.',
    },
  },
  {
    chapterId: 'chapter-117-research-ethics',
    level: 'C1.1',
    title: { cs: 'Rozliš svolení a zveřejnění', en: 'Distinguish consent from publication' },
    goal: {
      cs: 'Podle pravidel fiktivního školního projektu zvol, jak dnes použít rozhovor v prezentaci.',
      en: 'Using the rules of this fictional school project, decide how to use an interview in today’s presentation.',
    },
    known:
      'Die Projektregeln erlauben die namentliche Veröffentlichung eines Interviewzitats nur nach ausdrücklicher Freigabe. Eine anonyme Zusammenfassung ist bei entsprechender Zustimmung möglich.',
    partner: 'Interviewteam',
    queries: [
      {
        id: 'permission',
        question: 'Wofür liegt die Zustimmung der befragten Person konkret vor?',
        reply:
          'Sie hat einer anonymen Zusammenfassung zugestimmt. Die Freigabe eines Zitats mit Namen steht noch aus.',
      },
      {
        id: 'identifiers',
        question: 'Enthält die vorgesehene Zusammenfassung indirekte Hinweise auf die Person?',
        reply:
          'Ja, die Kombination aus ihrer seltenen Funktion und dem genauen Arbeitsort würde sie erkennbar machen. Beides können wir weglassen, ohne die Aussage zu verändern.',
      },
      {
        id: 'recording',
        question: 'Wie lang war das Gespräch?',
        reply: 'Das Gespräch dauerte ungefähr zwanzig Minuten.',
      },
    ],
    requiredQueryIds: ['permission', 'identifiers'],
    decision: 'Welche Fassung entspricht den vorliegenden Projektregeln?',
    answer: 'Eine sinngemäße Zusammenfassung ohne Namen, seltene Funktion oder genauen Arbeitsort.',
    alternatives: [
      'Das wörtliche Zitat mit Namen, weil dem Interview zugestimmt wurde.',
      'Eine Zusammenfassung ohne Namen, aber mit seltener Funktion und genauem Arbeitsort.',
    ],
    explanation: {
      cs: 'Svolení se vztahuje jen na anonymní shrnutí. Anonymitu by rušila i rozpoznatelná kombinace nepřímých údajů.',
      en: 'The permission covers only an anonymous summary. A recognisable combination of indirect details would also defeat anonymity.',
    },
  },
  {
    chapterId: 'chapter-119-public-policy',
    level: 'C1.2',
    title: { cs: 'Doporučení po konzultaci', en: 'A recommendation after consultation' },
    goal: {
      cs: 'Připrav doporučení školy k pilotnímu omezení dopravy. Odliš podporu účastníků od názoru celé obce a ověř podmínky.',
      en: 'Prepare the school’s recommendation on a pilot traffic restriction. Distinguish respondents’ support from the whole town’s view and check the conditions.',
    },
    known:
      'Die Schule möchte einen befristeten Pilotversuch empfehlen, sofern die Anlieferung möglich bleibt. Im Bericht steht: 70 Prozent Zustimmung.',
    partner: 'Koordination der Konsultation',
    queries: [
      {
        id: 'sample',
        question: 'Auf welche Gruppe beziehen sich die 70 Prozent, und wie wurde sie ausgewählt?',
        reply:
          'Auf 60 Personen, die freiwillig an einer Onlinebefragung teilgenommen haben. Es handelt sich nicht um eine repräsentative Stichprobe der Gemeinde.',
      },
      {
        id: 'delivery',
        question: 'Welche Regelung ist für die Anlieferung während des Pilotversuchs vorgesehen?',
        reply:
          'Der Entwurf erhält ein morgendliches Lieferfenster. Nach vier Wochen sollen dessen Nutzung und mögliche Probleme ausgewertet werden.',
      },
      {
        id: 'layout',
        question: 'Wann wird die grafische Fassung des Berichts fertig?',
        reply: 'Die grafische Fassung ist für nächste Woche geplant.',
      },
    ],
    requiredQueryIds: ['sample', 'delivery'],
    decision: 'Welche Empfehlung ist durch die Auskünfte gedeckt?',
    answer:
      'Wir unterstützen einen befristeten Versuch mit Lieferfenster und Auswertung; die Befragung beschreibt nur die freiwillig Teilnehmenden.',
    alternatives: [
      'Die gesamte Gemeinde unterstützt den dauerhaften Ausschluss aller Lieferungen.',
      'Die Befragung beweist repräsentativ, dass eine Auswertung überflüssig ist.',
    ],
    explanation: {
      cs: 'Dobrovolný vzorek neopravňuje tvrdit, co si myslí celá obec. Návrh zachovává zásobování a počítá s vyhodnocením pilotu.',
      en: 'A voluntary sample does not establish the whole town’s view. The draft preserves deliveries and includes an evaluation of the pilot.',
    },
  },
];

export function informationGapReady(gap: CourseInformationGap, asked: readonly string[]): boolean {
  return gap.requiredQueryIds.every((id) => asked.includes(id));
}

export function informationGapForChapter(chapterId: string): CourseInformationGap | undefined {
  return courseInformationGaps.find((gap) => gap.chapterId === chapterId);
}
