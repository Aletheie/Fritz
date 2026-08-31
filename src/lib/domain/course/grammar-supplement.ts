import type {
  GrammarChoiceQuestion,
  GrammarFillQuestion,
  GrammarLesson,
  GrammarOrderQuestion,
  GrammarQuestion,
} from './grammar.ts';

type QuestionDraft =
  | Omit<GrammarChoiceQuestion, 'id'>
  | Omit<GrammarFillQuestion, 'id'>
  | Omit<GrammarOrderQuestion, 'id'>;

function choice(
  prompt: string,
  options: string[],
  answer: string,
  explanation: string,
  skill: string,
  instruction = 'Vyber správnou možnost.',
): QuestionDraft {
  return { kind: 'choice', prompt, instruction, options, answer, explanation, skill };
}

function fill(
  prompt: string,
  before: string,
  after: string,
  answers: string[],
  hint: string,
  explanation: string,
  skill: string,
  instruction = 'Doplň chybějící část.',
): QuestionDraft {
  return {
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
  prompt: string,
  tokens: string[],
  answer: string[],
  translation: string,
  explanation: string,
  skill: string,
  instruction = 'Poskládej větu ve správném pořadí.',
): QuestionDraft {
  return {
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

function lesson(
  definition: Omit<GrammarLesson, 'questions'> & { questions: QuestionDraft[] },
): GrammarLesson {
  const { questions, ...metadata } = definition;
  return {
    ...metadata,
    questions: questions.map(
      (question, index) =>
        ({ ...question, id: `${definition.id}-${index + 1}` }) as GrammarQuestion,
    ),
  };
}

export const supplementalGrammarLessons: GrammarLesson[] = [
  lesson({
    id: 'compound-noun-gender',
    categoryId: 'daily-foundations',
    unit: 106,
    title: 'Rod německých složenin',
    shortTitle: 'Rod složených slov',
    subtitle: 'U dlouhého podstatného jména rozhoduje poslední část, ne první dojem.',
    cefr: 'A1',
    minutes: 6,
    completionXp: 20,
    concept:
      'Rod německého složeného podstatného jména určuje jeho poslední část. Bäckerei je die, proto je die Dorfbäckerei; Stück je das, proto je das Kuchenstück.',
    formula: 'první část + poslední podstatné jméno = člen posledního podstatného jména',
    examples: [
      { de: 'die Zimtschnecke → die Schnecke', cs: 'skořicový šnek → rozhoduje Schnecke' },
      { de: 'das Kuchenstück → das Stück', cs: 'kousek dortu → rozhoduje Stück' },
    ],
    questions: [
      choice(
        '___ Brotsorte ist heute besonders frisch.',
        ['Die', 'Der', 'Das', 'Den'],
        'Die',
        'Poslední část „Sorte“ má člen die, proto je celé složené slovo „die Brotsorte“.',
        'rod podle poslední části složeniny',
      ),
      choice(
        'Jaký člen má slovo „Zimtschnecke“?',
        ['die', 'der', 'das', 'den'],
        'die',
        'Rozhoduje poslední část „Schnecke“, která je ženského rodu: die Schnecke.',
        'člen složeného podstatného jména',
      ),
      fill(
        'Doplň člen podle poslední části slova.',
        'Ich nehme ',
        ' Croissant zum Frühstück.',
        ['ein', 'das'],
        'Croissant má člen das.',
        '„Croissant“ je středního rodu; v akuzativu zůstává neurčitý člen „ein“.',
        'střední rod v akuzativu',
      ),
      order(
        'Pekárna prodává čerstvé skořicové šneky.',
        ['frische', 'Die Bäckerei', 'Zimtschnecken.', 'verkauft'],
        ['Die Bäckerei', 'verkauft', 'frische', 'Zimtschnecken.'],
        'Pekárna prodává čerstvé skořicové šneky.',
        '„Die Bäckerei“ je podmět, časované sloveso stojí druhé a předmět následuje za ním.',
        'složené jméno v celé větě',
      ),
      choice(
        'Která dvojice je správně?',
        ['das Kuchenstück', 'die Kuchenstück', 'der Kuchenstück', 'den Kuchenstück'],
        'das Kuchenstück',
        'Poslední část „Stück“ je středního rodu, a proto má celé slovo člen das.',
        'rod podle základového slova',
      ),
    ],
  }),
  lesson({
    id: 'seit-versus-vor',
    categoryId: 'everyday-phrases',
    unit: 107,
    title: 'Seit, nebo vor? Potíže v čase',
    shortTitle: 'Seit × vor',
    subtitle: 'Rozliš, co stále trvá, od jednorázového okamžiku v minulosti.',
    cefr: 'A2',
    minutes: 6,
    completionXp: 22,
    concept:
      'Seit označuje začátek stavu, který trvá až do přítomnosti, a němčina proto používá přítomný čas. Vor určuje dokončený okamžik v minulosti a pojí se s minulým dějem.',
    formula: 'seit + dativ + Präsens · vor + dativ + minulý čas',
    examples: [
      { de: 'Seit Montag habe ich Fieber.', cs: 'Od pondělí mám horečku.' },
      { de: 'Vor zwei Tagen war ich beim Arzt.', cs: 'Před dvěma dny jsem byla u lékaře.' },
    ],
    questions: [
      choice(
        'Ich habe ___ drei Tagen Halsschmerzen.',
        ['seit', 'vor', 'nach', 'für'],
        'seit',
        'Bolest stále trvá, proto použijeme „seit“ a přítomný čas „habe“.',
        'trvající stav se seit',
      ),
      fill(
        'Vyjádři dokončený okamžik v minulosti.',
        'Die Untersuchung war ',
        ' einer Woche.',
        ['vor'],
        'Událost proběhla před týdnem.',
        '„Vor einer Woche“ odpovídá českému „před týdnem“ a popisuje minulý okamžik.',
        'minulý okamžik s vor',
      ),
      choice(
        'Která věta správně popisuje potíže, které stále trvají?',
        [
          'Seit gestern nehme ich diese Tabletten.',
          'Vor gestern nehme ich diese Tabletten.',
          'Seit gestern nahm ich diese Tabletten.',
          'Für gestern nehme ich diese Tabletten.',
        ],
        'Seit gestern nehme ich diese Tabletten.',
        'Děj začal včera a pokračuje, takže stojí „seit“ s přítomným časem.',
        'seit s přítomným časem',
      ),
      order(
        'Od včerejška mě bolí v krku.',
        ['der Hals', 'Seit gestern', 'weh.', 'tut', 'mir'],
        ['Seit gestern', 'tut', 'mir', 'der Hals', 'weh.'],
        'Od včerejška mě bolí v krku.',
        'Po časovém údaji „Seit gestern“ následuje sloveso „tut“ a potíž zůstává v přítomném čase.',
        'slovosled po časovém údaji',
      ),
      choice(
        '___ zwei Tagen hat mir die Ärztin ein Rezept verschrieben.',
        ['Vor', 'Seit', 'Bis', 'Ab'],
        'Vor',
        'Předepsání je dokončená událost v minulosti, proto použijeme „vor“.',
        'volba vor pro dokončený děj',
      ),
    ],
  }),
  lesson({
    id: 'ohne-anstatt-zu',
    categoryId: 'purpose-and-complements',
    unit: 108,
    title: 'Ohne zu a anstatt zu',
    shortTitle: 'Ohne/anstatt zu',
    subtitle: 'Přidej chybějící nebo alternativní děj bez další těžké vedlejší věty.',
    cefr: 'B1',
    minutes: 7,
    completionXp: 24,
    concept:
      'Když mají oba děje stejný podmět, lze použít ohne zu pro neuskutečněný doprovodný děj a anstatt zu pro nevyužitou alternativu. Infinitiv s zu stojí na konci skupiny.',
    formula: 'hlavní věta, ohne/anstatt + doplnění + zu + infinitiv',
    examples: [
      {
        de: 'Ich lerne weiter, ohne eine Pause zu machen.',
        cs: 'Učím se dál, aniž bych si udělala přestávku.',
      },
      {
        de: 'Anstatt alles nur zu lesen, wende ich die Regel an.',
        cs: 'Místo pouhého čtení pravidlo používám.',
      },
    ],
    questions: [
      fill(
        'Doplň konstrukci pro děj, který nenastal.',
        'Ich überprüfe die Lösung, ',
        ' sofort im Wörterbuch nachzuschlagen.',
        ['ohne'],
        'Řešení kontroluji, ale hned nehledám ve slovníku.',
        '„Ohne zu“ vyjadřuje, že doprovodný děj neproběhl; podmět obou dějů je „ich“.',
        'ohne zu se stejným podmětem',
      ),
      choice(
        '___ den Lernstoff nur zu lesen, mache ich eigene Notizen.',
        ['Anstatt', 'Ohne dass', 'Damit', 'Während'],
        'Anstatt',
        'Vlastní poznámky jsou zvolená alternativa k pouhému čtení, proto se hodí „anstatt zu“.',
        'alternativa s anstatt zu',
      ),
      order(
        'Rozvrhla si látku, aniž by ztratila přehled.',
        ['den Überblick', 'Sie teilte', 'ohne', 'ein,', 'zu verlieren.', 'den Stoff'],
        ['Sie teilte', 'den Stoff', 'ein,', 'ohne', 'den Überblick', 'zu verlieren.'],
        'Rozvrhla si látku, aniž by ztratila přehled.',
        'Odlučitelné „teilte … ein“ uzavírá hlavní větu a infinitiv „zu verlieren“ stojí na konci skupiny s ohne.',
        'větná závorka a ohne zu',
      ),
      fill(
        'Vyjádři vhodnější alternativu.',
        '',
        ', wiederhole ich jeden Tag eine kleine Einheit.',
        ['Anstatt alles auf einmal zu lernen'],
        'Neučím se vše najednou, volím malé denní části.',
        'Úvodní infinitivní skupina s „anstatt“ je oddělena čárkou od hlavní věty.',
        'úvodní skupina s anstatt zu',
      ),
      choice(
        'Která věta má stejný podmět v obou dějích a správnou stavbu?',
        [
          'Ich ändere den Zeitplan, ohne mein Ziel aufzugeben.',
          'Ich ändere den Zeitplan, ohne ich mein Ziel aufgebe.',
          'Ich ändere den Zeitplan, ohne mein Ziel aufgeben zu.',
          'Ich ändere den Zeitplan, ohne dass mein Ziel aufzugeben.',
        ],
        'Ich ändere den Zeitplan, ohne mein Ziel aufzugeben.',
        'U stejného podmětu stačí infinitivní skupina; u odlučitelného slovesa vzniká tvar „aufzugeben“.',
        'infinitiv odlučitelného slovesa s zu',
      ),
    ],
  }),
  lesson({
    id: 'man-versus-passive',
    categoryId: 'voice-and-modality',
    unit: 109,
    title: 'Man, nebo pasivum?',
    shortTitle: 'Man × pasivum',
    subtitle: 'Rozhodni, zda má být v centru obecný aktér, nebo samotný pracovní postup.',
    cefr: 'B2',
    minutes: 7,
    completionXp: 26,
    concept:
      'Zájmeno man představuje obecného lidského aktéra a věta zůstává činná. Dějové pasivum s werden přesune pozornost na proces nebo výsledek a původce může zcela vynechat.',
    formula: 'man + aktivní sloveso · předmět → podmět + werden + Partizip II',
    examples: [
      {
        de: 'Man dokumentiert alle Entscheidungen.',
        cs: 'Všechna rozhodnutí se dokumentují.',
      },
      {
        de: 'Alle Entscheidungen werden dokumentiert.',
        cs: 'Všechna rozhodnutí jsou dokumentována.',
      },
    ],
    questions: [
      choice(
        'Převeď „Man dokumentiert alle Entscheidungen“ do pasiva.',
        [
          'Alle Entscheidungen werden dokumentiert.',
          'Alle Entscheidungen sind dokumentieren.',
          'Alle Entscheidungen werden dokumentieren.',
          'Man wird alle Entscheidungen dokumentiert.',
        ],
        'Alle Entscheidungen werden dokumentiert.',
        'Akuzativní předmět se stane podmětem; následuje tvar „werden“ a příčestí „dokumentiert“.',
        'převod aktiva s man do pasiva',
      ),
      fill(
        'Doplň dějové pasivum v přítomném čase.',
        'Die Richtlinie ',
        ' nächste Woche eingeführt.',
        ['wird'],
        'Podmět „die Richtlinie“ je v jednotném čísle.',
        'Dějové pasivum tvoří „wird“ a příčestí „eingeführt“ na konci.',
        'werden v jednotném čísle',
      ),
      order(
        'Ve třech časových pásmech se domlouvají pevná předání.',
        ['vereinbart.', 'feste Übergaben', 'werden', 'In drei Zeitzonen'],
        ['In drei Zeitzonen', 'werden', 'feste Übergaben', 'vereinbart.'],
        'Ve třech časových pásmech se domlouvají pevná předání.',
        'Po úvodním místním údaji stojí „werden“, podmět následuje a příčestí uzavírá větu.',
        'slovosled pasivní věty',
      ),
      choice(
        'Která věta zdůrazňuje obecný postup i lidského vykonavatele?',
        [
          'Man stimmt die Termine wöchentlich ab.',
          'Die Termine werden wöchentlich abgestimmt.',
          'Die Termine sind wöchentlich abgestimmt.',
          'Wöchentlich abgestimmte Termine.',
        ],
        'Man stimmt die Termine wöchentlich ab.',
        'Zájmeno „man“ ponechává obecného lidského aktéra ve větě, zatímco pasivum ho odsouvá.',
        'významový rozdíl man a pasiva',
      ),
      fill(
        'Doplň pasivum v minulém čase.',
        'Die neuen Kernzeiten ',
        ' gestern im Team abgestimmt.',
        ['wurden'],
        'Jde o množné číslo a dokončený minulý děj.',
        'Préteritum pasivního pomocného slovesa „werden“ má v množném čísle tvar „wurden“.',
        'préteritum dějového pasiva',
      ),
    ],
  }),
  lesson({
    id: 'source-attribution-phrases',
    categoryId: 'academic-precision',
    unit: 110,
    title: 'Přesné uvedení zdroje',
    shortTitle: 'Laut, zufolge, nach Angaben',
    subtitle: 'Odděl vlastní tvrzení od informace převzaté z konkrétního zdroje.',
    cefr: 'C1',
    minutes: 7,
    completionXp: 28,
    concept:
      'Formální text připisuje informaci zdroji pomocí laut, postpozice zufolge nebo vazby nach Angaben. Volba pádu a umístění výrazu ukazují, odkud tvrzení pochází, aniž by je autor vydával za vlastní.',
    formula: 'laut + dativ/genitiv · zdroj v dativu + zufolge · nach Angaben + genitiv/von',
    examples: [
      {
        de: 'Laut der Quelle wurden die Zahlen korrigiert.',
        cs: 'Podle zdroje byla čísla opravena.',
      },
      {
        de: 'Der Redaktion zufolge war die Schlagzeile missverständlich.',
        cs: 'Podle redakce byl titulek nejednoznačný.',
      },
    ],
    questions: [
      choice(
        '___ der Quelle lässt sich die Behauptung nicht nachprüfen.',
        ['Laut', 'Zufolge', 'Entlang', 'Gegenüber'],
        'Laut',
        '„Laut der Quelle“ stojí před zdrojem a v této větě se pojí s dativem.',
        'předložka laut se zdrojem',
      ),
      order(
        'Podle mluvčího byla zpráva zveřejněna příliš brzy.',
        ['zu früh', 'Dem Sprecher zufolge', 'veröffentlicht.', 'wurde', 'die Meldung'],
        ['Dem Sprecher zufolge', 'wurde', 'die Meldung', 'zu früh', 'veröffentlicht.'],
        'Podle mluvčího byla zpráva zveřejněna příliš brzy.',
        'U „zufolge“ stojí zdroj v dativu před postpozicí; určité sloveso následuje na druhé pozici.',
        'postpozice zufolge s dativem',
      ),
      choice(
        'Která formulace je gramaticky správná a vhodná pro zprávu?',
        [
          'Nach Angaben der Redaktion wurde der Fehler korrigiert.',
          'Nach Angaben die Redaktion wurde der Fehler korrigiert.',
          'Nach der Redaktion Angaben wurde der Fehler korrigiert.',
          'Angaben nach der Redaktion wurde der Fehler korrigiert.',
        ],
        'Nach Angaben der Redaktion wurde der Fehler korrigiert.',
        'Ustálená vazba zní „nach Angaben“ a původce je zde vyjádřen genitivem „der Redaktion“.',
        'vazba nach Angaben s genitivem',
      ),
      fill(
        'Doplň neutrální odkaz na tiskovou konferenci.',
        '',
        ' der Pressekonferenz soll die Richtlinie im Herbst gelten.',
        ['Laut'],
        'Informaci připisujeme uvedenému zdroji.',
        '„Laut der Pressekonferenz“ signalizuje převzatou informaci; autor nepotvrzuje její pravdivost sám.',
        'atribuce pomocí laut',
      ),
      choice(
        'Která věta jasně odděluje tvrzení účtu od postoje autora?',
        [
          'Dem Konto zufolge stammt das Bild vom Montag.',
          'Das Bild stammt eindeutig vom Montag.',
          'Natürlich stammt das Bild vom Montag.',
          'Das Bild muss vom Montag stammen.',
        ],
        'Dem Konto zufolge stammt das Bild vom Montag.',
        'Postpozice „zufolge“ výslovně označuje účet jako zdroj tvrzení a zachovává odstup autora.',
        'epistemický odstup uvedením zdroje',
      ),
    ],
  }),
];
