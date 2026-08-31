import type { CourseChapterDefinition } from './path.ts';

type CoherenceField =
  | 'title'
  | 'subtitle'
  | 'situation'
  | 'mission'
  | 'outcomes'
  | 'grammarLessonId'
  | 'grammarLessonIds'
  | 'grammarIdea'
  | 'grammarPattern'
  | 'sentencePrompt'
  | 'sentenceStarter'
  | 'sentenceChecklist'
  | 'coachScenarioId'
  | 'coachScenarioIds'
  | 'dialogue';

export type CourseCoherenceOverride = Partial<Pick<CourseChapterDefinition, CoherenceField>>;

/**
 * Small editorial corrections for the hand-authored anchor chapters. These
 * keep stable chapter and lexeme IDs while turning disconnected example pairs
 * into real exchanges and promoting the coach mission that matches the lesson.
 */
export const courseCoherenceOverrides: Readonly<Record<string, CourseCoherenceOverride>> = {
  'chapter-01-school': {
    dialogue: [
      {
        speaker: 'Spolužák',
        de: 'Hallo, ich bin Leo. Wie heißt du und was lernst du heute?',
        cs: 'Ahoj, já jsem Leo. Jak se jmenuješ a co se dnes učíš?',
      },
      {
        speaker: 'Studentka',
        de: 'Ich heiße Anna. Heute lerne ich in der Schule Deutsch.',
        cs: 'Jmenuji se Anna. Dnes se ve škole učím německy.',
      },
    ],
  },
  'chapter-02-day': {
    subtitle: 'Propoj čas, ranní činnosti a jejich délku do jedné přehledné rutiny.',
    situation: 'Ráno plánuješ od probuzení po odchod tak, abys přišla včas.',
    mission:
      'Popíšeš své ráno ve správném pořadí, uvedeš dva konkrétní časy a vysvětlíš, kolik času potřebuješ na snídani.',
    outcomes: [
      'popsat tři části běžného rána v logickém pořadí',
      'zvolit správnou koncovku slovesa podle osoby',
      'spojit vstávání, snídani a včasný odchod konkrétními časy',
    ],
    grammarIdea: 'koncovky přítomného času v navazující ranní rutině',
    grammarPattern: 'Morgens stehe ich um ... auf; danach brauche ich ...',
    coachScenarioId: 'transfer-morning-routine',
    dialogue: [
      {
        speaker: 'Kamarád',
        de: 'Guten Morgen! Wann musst du heute aus dem Haus?',
        cs: 'Dobré ráno! Kdy dnes musíš vyrazit z domu?',
      },
      {
        speaker: 'Studentka',
        de: 'Ich stehe um sieben Uhr auf und brauche zehn Minuten für das Frühstück. So bin ich pünktlich.',
        cs: 'Vstávám v sedm a potřebuji deset minut na snídani. Tak přijdu včas.',
      },
    ],
  },
  'chapter-03-travel': {
    dialogue: [
      {
        speaker: 'Pracovnice přepážky',
        de: 'Guten Tag. Wohin möchten Sie fahren?',
        cs: 'Dobrý den. Kam chcete jet?',
      },
      {
        speaker: 'Cestující',
        de: 'Eine Fahrkarte hin und zurück nach Leipzig, bitte. Von welchem Gleis fährt der Zug ab?',
        cs: 'Jednu zpáteční jízdenku do Lipska, prosím. Z kterého nástupiště vlak odjíždí?',
      },
      {
        speaker: 'Pracovnice přepážky',
        de: 'Die Abfahrt ist um 9:20 Uhr von Gleis drei; in Dresden steigen Sie um.',
        cs: 'Odjezd je v 9:20 z nástupiště tři; v Drážďanech přestoupíte.',
      },
    ],
  },
  'chapter-04-plans': {
    dialogue: [
      {
        speaker: 'Kamarád',
        de: 'Kannst du unserer Verabredung am Freitag zusagen?',
        cs: 'Můžeš potvrdit naši páteční schůzku?',
      },
      {
        speaker: 'Studentka',
        de: 'Leider nicht, weil ich arbeiten muss. Können wir sie auf Samstag verschieben?',
        cs: 'Bohužel ne, protože musím pracovat. Můžeme ji přesunout na sobotu?',
      },
      {
        speaker: 'Kamarád',
        de: 'Samstag passt; dann sage ich zu.',
        cs: 'Sobota se hodí; tedy potvrzuji účast.',
      },
    ],
  },
  'chapter-05-home-work': {
    title: 'Přesný popis doma i v práci',
    subtitle:
      'Jedním vztažným vzorem upřesni problém s bydlením a potom ho přenes do pracovního kontextu.',
    situation:
      'Nejdřív nahlásíš poruchu v bytě; stejnou stavbu pak použiješ k přesnému popisu pracovní nabídky.',
    mission:
      'Nahlásíš nefunkční topení a domluvíš opravu, potom pomocí stejné vztažné věty vysvětlíš, ke které pozici se hodí tvoje zkušenost.',
    outcomes: [
      'nahlásit poruchu a domluvit konkrétní další krok',
      'připojit vztažnou větu přímo k upřesňovanému podstatnému jménu',
      'přenést stejný větný vzor z bydlení do pracovní situace',
    ],
    sentencePrompt:
      'Popiš přesně problém v bytě a potom jednou další větou pracovní pozici nebo zkušenost.',
    sentenceChecklist: [
      'každá vztažná věta stojí hned za slovem, které upřesňuje',
      'vztažné zájmeno odpovídá rodu a pádu',
      'jedna věta řeší bydlení a druhá vědomě přenáší vzor do práce',
    ],
    coachScenarioIds: ['apartment-repair', 'job-interview'],
    dialogue: [
      {
        speaker: 'Pronajímatel',
        de: 'Welches Problem in der Wohnung soll repariert werden?',
        cs: 'Který problém v bytě je potřeba opravit?',
      },
      {
        speaker: 'Nájemnice',
        de: 'Die Heizung, die seit gestern nicht funktioniert, muss repariert werden.',
        cs: 'Topení, které od včerejška nefunguje, je potřeba opravit.',
      },
    ],
  },
  'chapter-06-process': {
    subtitle: 'Vysvětli pracovní postup od rozdělení úkolu až po ověřený výsledek.',
    situation: 'Kolegyni předáváš postup, ve kterém jsou důležité kroky a jejich pořadí.',
    mission:
      'Popíšeš týmový pracovní postup ve třech navazujících krocích a pomocí pasiva zdůrazníš úkol, převzetí odpovědnosti a kontrolu výsledku.',
    outcomes: [
      'seřadit úkol, převzetí odpovědnosti a kontrolu výsledku',
      'postavit dějové pasivum pomocí „werden + Partizip II“',
      'vysvětlit celý proces bez zbytečného přeskakování mezi vykonavateli',
    ],
    coachScenarioId: 'transfer-explain-process',
    dialogue: [
      {
        speaker: 'Kolegyně',
        de: 'Wie wird die Aufgabe von der Übergabe bis zum Ergebnis bearbeitet?',
        cs: 'Jak se úkol zpracuje od předání až po výsledek?',
      },
      {
        speaker: 'Studentka',
        de: 'Zuerst wird die Aufgabe verteilt; anschließend wird die Verantwortung übernommen und am Ende wird das Ergebnis geprüft.',
        cs: 'Nejdřív se úkol rozdělí, potom se převezme odpovědnost a nakonec se výsledek zkontroluje.',
      },
    ],
  },
  'chapter-07-project': {
    dialogue: [
      {
        speaker: 'Vedoucí projektu',
        de: 'Welche Variante sollen wir wählen, obwohl die Zeit knapp ist?',
        cs: 'Kterou variantu máme zvolit, přestože máme málo času?',
      },
      {
        speaker: 'Analytička',
        de: 'Obwohl Vorschlag A günstiger ist, empfehle ich B, weil seine Auswirkungen auf das Team geringer sind.',
        cs: 'Přestože je návrh A levnější, doporučuji B, protože jeho dopady na tým jsou menší.',
      },
    ],
  },
  'chapter-08-negotiation': {
    dialogue: [
      {
        speaker: 'Partner',
        de: 'Die Frist ist knapp. Unter welcher Voraussetzung können Sie zustimmen?',
        cs: 'Lhůta je krátká. Za jaké podmínky můžete souhlasit?',
      },
      {
        speaker: 'Vyjednavačka',
        de: 'Die Frist kann verlängert werden, wenn der Umfang kleiner wird; dann ist ein Kompromiss möglich.',
        cs: 'Lhůtu lze prodloužit, pokud se zmenší rozsah; potom je kompromis možný.',
      },
    ],
  },
  'chapter-09-argument': {
    dialogue: [
      {
        speaker: 'Moderátor',
        de: 'Die Autorin behauptet, die Daten belegten ihren Standpunkt. Wie ordnen Sie das ein?',
        cs: 'Autorka tvrdí, že data dokládají její stanovisko. Jak to zasadíte do souvislostí?',
      },
      {
        speaker: 'Analytička',
        de: 'Sie erklärt, die Behauptung sei belegt; meiner Einordnung zufolge reicht die Evidenz dafür noch nicht aus.',
        cs: 'Uvádí, že je tvrzení doložené; podle mého posouzení k tomu však důkazy ještě nestačí.',
      },
    ],
  },
  'chapter-10-style': {
    coachScenarioId: 'transfer-concise-editing',
    dialogue: [
      {
        speaker: 'Editorka',
        de: 'Dieser Absatz ist korrekt, aber schwerfällig. Wie überarbeiten Sie ihn?',
        cs: 'Tento odstavec je správný, ale těžkopádný. Jak ho přepracujete?',
      },
      {
        speaker: 'Autorka',
        de: 'Ich präzisiere die Formulierung und nenne die Voraussetzung direkt.',
        cs: 'Upřesním formulaci a podmínku uvedu přímo.',
      },
    ],
  },
  'chapter-17-shopping-returns': {
    coachScenarioId: 'return-purchase',
  },
  'chapter-19-study-goals': {
    coachScenarioId: 'study-planning',
  },
  'chapter-22-opinion-compromise': {
    coachScenarioId: 'transfer-propose-compromise',
  },
  'chapter-23-feedback-conflict': {
    grammarLessonId: 'hypothetical-comparisons',
  },
  'chapter-26-data-consequences': {
    coachScenarioId: 'transfer-limited-recommendation',
  },
  'chapter-30-policy-brief': {
    coachScenarioId: 'transfer-decision-recommendation',
  },
};

export function applyCourseCoherenceOverride(
  definition: CourseChapterDefinition,
): CourseChapterDefinition {
  const override = courseCoherenceOverrides[definition.id];
  if (!override) return definition;

  const coachScenarioId = override.coachScenarioId ?? definition.coachScenarioId;
  const coachScenarioIds = [
    coachScenarioId,
    ...(override.coachScenarioIds ?? []),
    ...(definition.coachScenarioIds ?? [definition.coachScenarioId]),
  ];
  const grammarLessonId = override.grammarLessonId ?? definition.grammarLessonId;
  const grammarLessonIds = [
    grammarLessonId,
    ...(override.grammarLessonIds ?? []),
    ...(definition.grammarLessonIds ?? [definition.grammarLessonId]),
  ];

  return {
    ...definition,
    ...override,
    coachScenarioId,
    coachScenarioIds: [...new Set(coachScenarioIds)],
    grammarLessonId,
    grammarLessonIds: [...new Set(grammarLessonIds)],
  };
}
