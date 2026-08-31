import type { DetailedCefrLevel } from '../types.ts';
import { createWordOrderTrap } from './course-model-traps.ts';
import type { FutureChapterVocabularyPack } from './future-chapter-vocabulary.ts';
import { futureChapterVocabularyPacks } from './future-chapter-vocabulary.ts';
import type {
  CourseChapterDefinition,
  CourseDialogueTurn,
  CourseModelSentence,
  CourseWord,
} from './path.ts';

type DiversityChapterBlueprint = {
  id: string;
  packId: string;
  grammarLessonId: string;
  titleCs: string;
  titleEn: string;
  goalCs: string;
  goalEn: string;
  grammarPattern: string;
  speakerA: string;
  speakerB: string;
  dialogue: [CourseDialogueTurn, CourseDialogueTurn, CourseDialogueTurn];
};

export type DiversityChapterEnglishCopy = {
  title: string;
  subtitle: string;
  mission: string;
  outcomes: [string, string, string];
};

export type DiversityChapterBridge = {
  de: string;
  cs: string;
  sentenceStarter: string;
};

export const diversityChapterBlueprints: DiversityChapterBlueprint[] = [
  {
    id: 'chapter-101-market-groceries',
    packId: 'market-groceries',
    grammarLessonId: 'numbers-and-prices',
    titleCs: 'Nákup na trhu',
    titleEn: 'Shopping at the market',
    goalCs: 'vybrat tři potraviny, určit jejich množství a ověřit cenu',
    goalEn: 'choose three groceries, specify their quantity, and check the price',
    grammarPattern: 'Ich nehme + Menge + Produkt. Was kostet das zusammen?',
    speakerA: 'Prodavačka',
    speakerB: 'Zákaznice',
    dialogue: [
      {
        speaker: 'Prodavačka',
        de: 'Guten Morgen! Was möchten Sie heute kaufen?',
        cs: 'Dobré ráno! Co si dnes přejete koupit?',
      },
      {
        speaker: 'Zákaznice',
        de: 'Ich nehme drei Tomaten und eine Gurke, bitte.',
        cs: 'Vezmu si tři rajčata a jednu okurku, prosím.',
      },
      {
        speaker: 'Prodavačka',
        de: 'Gern. Darf ich noch etwas dazulegen?',
        cs: 'Ráda. Mohu ještě něco přidat?',
      },
    ],
  },
  {
    id: 'chapter-102-hobby-meetup',
    packId: 'hobby-meetup',
    grammarLessonId: 'modal-verbs',
    titleCs: 'Najdi si nový koníček',
    titleEn: 'Find a new hobby',
    goalCs: 'zeptat se na volnočasovou aktivitu a domluvit první návštěvu',
    goalEn: 'ask about a leisure activity and arrange your first visit',
    grammarPattern: 'Ich möchte ... ausprobieren und kann am ... vorbeikommen.',
    speakerA: 'Organizátorka',
    speakerB: 'Zájemkyně',
    dialogue: [
      {
        speaker: 'Organizátorka',
        de: 'Möchtest du bei unserem Spieleabend mitspielen?',
        cs: 'Chceš si zahrát na našem večeru deskových her?',
      },
      {
        speaker: 'Zájemkyně',
        de: 'Ja, ich möchte das gern ausprobieren. Wann trefft ihr euch?',
        cs: 'Ano, ráda bych to vyzkoušela. Kdy se scházíte?',
      },
      {
        speaker: 'Organizátorka',
        de: 'Wir verabreden uns für Freitag um sechs Uhr.',
        cs: 'Domlouváme se na pátek v šest hodin.',
      },
    ],
  },
  {
    id: 'chapter-103-weather-and-clothing',
    packId: 'weather-and-clothing',
    grammarLessonId: 'separable-verbs',
    titleCs: 'Počasí a vhodné oblečení',
    titleEn: 'Weather and suitable clothing',
    goalCs: 'popsat počasí a zvolit oblečení pro konkrétní plán',
    goalEn: 'describe the weather and choose clothing for a specific plan',
    grammarPattern: 'Wenn es ..., ziehe ich ... an und nehme ... mit.',
    speakerA: 'Kamarád',
    speakerB: 'Výletnice',
    dialogue: [
      {
        speaker: 'Kamarád',
        de: 'Heute bleibt das Wetter wechselhaft.',
        cs: 'Dnes zůstane počasí proměnlivé.',
      },
      {
        speaker: 'Výletnice',
        de: 'Dann ziehe ich meine wasserdichte Jacke an.',
        cs: 'Tak si vezmu nepromokavou bundu.',
      },
      {
        speaker: 'Kamarád',
        de: 'Zieh vorsichtshalber auch die Kapuze auf.',
        cs: 'Pro jistotu si nasaď také kapuci.',
      },
    ],
  },
  {
    id: 'chapter-104-library-services',
    packId: 'library-services',
    grammarLessonId: 'questions',
    titleCs: 'První návštěva knihovny',
    titleEn: 'Your first library visit',
    goalCs: 'založit průkaz, najít knihu a ověřit výpůjční lhůtu',
    goalEn: 'get a library card, find a book, and check the loan period',
    grammarPattern: 'Wo finde ich ...? Kann ich ... verlängern?',
    speakerA: 'Knihovnice',
    speakerB: 'Čtenářka',
    dialogue: [
      {
        speaker: 'Knihovnice',
        de: 'Haben Sie schon einen Bibliotheksausweis?',
        cs: 'Máte už čtenářský průkaz?',
      },
      {
        speaker: 'Čtenářka',
        de: 'Noch nicht. Wo kann ich ihn beantragen?',
        cs: 'Ještě ne. Kde o něj mohu požádat?',
      },
      {
        speaker: 'Knihovnice',
        de: 'Hier am Schalter. Die Leihfrist beträgt vier Wochen.',
        cs: 'Zde u přepážky. Výpůjční lhůta je čtyři týdny.',
      },
    ],
  },
  {
    id: 'chapter-105-dietary-needs',
    packId: 'dietary-needs',
    grammarLessonId: 'accusative',
    titleCs: 'Dietní potřeby v restauraci',
    titleEn: 'Dietary needs at a restaurant',
    goalCs: 'ověřit složení jídla a bezpečně požádat o úpravu',
    goalEn: 'check a dish’s ingredients and safely request a change',
    grammarPattern: 'Ich vertrage kein ... . Enthält das Gericht ...?',
    speakerA: 'Obsluha',
    speakerB: 'Hostka',
    dialogue: [
      {
        speaker: 'Obsluha',
        de: 'Haben Sie schon ein Gericht ausgewählt?',
        cs: 'Už jste si vybrala jídlo?',
      },
      {
        speaker: 'Hostka',
        de: 'Ich vertrage keine Erdnüsse. Enthält die Soße Erdnüsse?',
        cs: 'Nesnáším arašídy. Obsahuje omáčka arašídy?',
      },
      {
        speaker: 'Obsluha',
        de: 'Nein, und wir können die Beilage separat servieren.',
        cs: 'Ne, a přílohu můžeme podávat odděleně.',
      },
    ],
  },
  {
    id: 'chapter-106-civic-services',
    packId: 'civic-services',
    grammarLessonId: 'indirect-questions',
    titleCs: 'Vyřízení na úřadě',
    titleEn: 'Handling an errand at the civic office',
    goalCs: 'zjistit správný postup a podat úplnou jednoduchou žádost',
    goalEn: 'find the correct procedure and submit a complete simple application',
    grammarPattern: 'Können Sie mir sagen, wo ich ... beantragen kann?',
    speakerA: 'Úřednice',
    speakerB: 'Žadatelka',
    dialogue: [
      {
        speaker: 'Úřednice',
        de: 'Welche Bescheinigung möchten Sie beantragen?',
        cs: 'O jaké potvrzení chcete požádat?',
      },
      {
        speaker: 'Žadatelka',
        de: 'Ich brauche eine Meldebescheinigung für meinen neuen Wohnsitz.',
        cs: 'Potřebuji potvrzení o bydlišti pro své nové bydliště.',
      },
      {
        speaker: 'Úřednice',
        de: 'Dann füllen Sie bitte dieses Formular aus und legen Ihren Pass vor.',
        cs: 'Pak prosím vyplňte tento formulář a předložte pas.',
      },
    ],
  },
  {
    id: 'chapter-107-travel-disruptions',
    packId: 'travel-disruptions',
    grammarLessonId: 'complex-connectors',
    titleCs: 'Komplikace na cestě',
    titleEn: 'Travel disruptions',
    goalCs: 'vyřešit zmeškaný spoj a ověřit platnost náhradní trasy',
    goalEn: 'handle a missed connection and verify an alternative route',
    grammarPattern: 'Da der Zug ausfällt, brauche ich eine Ersatzverbindung.',
    speakerA: 'Pracovník dopravy',
    speakerB: 'Cestující',
    dialogue: [
      {
        speaker: 'Cestující',
        de: 'Mein Anschlusszug ist ausgefallen. Welche Ersatzverbindung gibt es?',
        cs: 'Můj navazující vlak byl zrušen. Jaké existuje náhradní spojení?',
      },
      {
        speaker: 'Pracovník dopravy',
        de: 'Sie können voraussichtlich um 18 Uhr weiterfahren.',
        cs: 'Pravděpodobně můžete pokračovat v 18 hodin.',
      },
      {
        speaker: 'Cestující',
        de: 'Ist meine Fahrkarte dafür uneingeschränkt gültig?',
        cs: 'Platí pro to moje jízdenka bez omezení?',
      },
    ],
  },
  {
    id: 'chapter-108-cultural-evening',
    packId: 'cultural-evening',
    grammarLessonId: 'weil-dass',
    titleCs: 'Kulturní večer',
    titleEn: 'A cultural evening',
    goalCs: 'vybrat představení a naplánovat příchod, vstupenky i šatnu',
    goalEn: 'choose a performance and plan arrival, tickets, and the cloakroom',
    grammarPattern: 'Wir buchen im Voraus, weil die Vorstellung fast ausverkauft ist.',
    speakerA: 'Kamarádka',
    speakerB: 'Návštěvnice',
    dialogue: [
      {
        speaker: 'Kamarádka',
        de: 'Welche Vorstellung möchtest du besuchen?',
        cs: 'Které představení chceš navštívit?',
      },
      {
        speaker: 'Návštěvnice',
        de: 'Die frühe Vorstellung, weil die spätere schon ausverkauft ist.',
        cs: 'To časnější, protože pozdější už je vyprodané.',
      },
      {
        speaker: 'Kamarádka',
        de: 'Gut, dann kaufen wir die Eintrittskarten im Voraus.',
        cs: 'Dobře, pak koupíme vstupenky předem.',
      },
    ],
  },
  {
    id: 'chapter-109-community-volunteering',
    packId: 'community-volunteering',
    grammarLessonId: 'waehrend-clause',
    titleCs: 'Dobrovolnická akce',
    titleEn: 'A volunteer event',
    goalCs: 'rozdělit role, vybavení a záložní plán komunitní akce',
    goalEn: 'divide roles, equipment, and a backup plan for a community event',
    grammarPattern: 'Während ein Team ..., kümmert sich das andere um ... .',
    speakerA: 'Koordinátor',
    speakerB: 'Dobrovolnice',
    dialogue: [
      {
        speaker: 'Koordinátor',
        de: 'Wer verteilt die Arbeitshandschuhe an der Sammelstelle?',
        cs: 'Kdo rozdělí pracovní rukavice na sběrném místě?',
      },
      {
        speaker: 'Dobrovolnice',
        de: 'Das übernehme ich, während die anderen die Müllsäcke einsammeln.',
        cs: 'To převezmu já, zatímco ostatní budou sbírat pytle na odpad.',
      },
      {
        speaker: 'Koordinátor',
        de: 'Perfekt, so unterstützen wir einander.',
        cs: 'Perfektní, tak se navzájem podpoříme.',
      },
    ],
  },
  {
    id: 'chapter-110-workplace-onboarding',
    packId: 'workplace-onboarding',
    grammarLessonId: 'prepositional-relative-clauses',
    titleCs: 'První týden v nové práci',
    titleEn: 'Your first week in a new job',
    goalCs: 'ujasnit odpovědnosti a domluvit bezpečné převzetí agendy',
    goalEn: 'clarify responsibilities and arrange a safe handover',
    grammarPattern: 'Der Ansprechpartner, an den ich mich wende, erklärt den Ablauf.',
    speakerA: 'Vedoucí',
    speakerB: 'Nová kolegyně',
    dialogue: [
      {
        speaker: 'Vedoucí',
        de: 'Wie läuft deine Einarbeitung bisher?',
        cs: 'Jak zatím probíhá tvé zapracování?',
      },
      {
        speaker: 'Nová kolegyně',
        de: 'Gut, aber ich möchte die Zuständigkeiten für Anfragen noch klären.',
        cs: 'Dobře, ale ještě si chci ujasnit kompetence pro dotazy.',
      },
      {
        speaker: 'Vedoucí',
        de: 'Wir prüfen das Übergabeprotokoll nach und nach.',
        cs: 'Předávací protokol projdeme bod po bodu.',
      },
    ],
  },
  {
    id: 'chapter-111-academic-presentation',
    packId: 'academic-presentation',
    grammarLessonId: 'prepositional-relative-clauses',
    titleCs: 'Studijní prezentace',
    titleEn: 'An academic presentation',
    goalCs: 'vystavět prezentaci od hlavní otázky po podložený závěr',
    goalEn: 'build a presentation from its central question to a supported conclusion',
    grammarPattern: 'Die Leitfrage, auf die wir eingehen, bestimmt die Gliederung.',
    speakerA: 'Spolužačka',
    speakerB: 'Prezentující',
    dialogue: [
      {
        speaker: 'Spolužačka',
        de: 'Ist eure Leitfrage in der Gliederung klar erkennbar?',
        cs: 'Je vaše hlavní otázka ve struktuře jasně rozpoznatelná?',
      },
      {
        speaker: 'Prezentující',
        de: 'Ja, und jede Kernaussage hat eine Quellenangabe.',
        cs: 'Ano, a každé hlavní sdělení má uvedený zdroj.',
      },
      {
        speaker: 'Spolužačka',
        de: 'Dann fehlt nur noch ein gemeinsamer Probelauf.',
        cs: 'Pak už chybí jen společná zkouška nanečisto.',
      },
    ],
  },
  {
    id: 'chapter-112-media-literacy',
    packId: 'media-literacy',
    grammarLessonId: 'da-wo-compounds',
    titleCs: 'Ověřování zpráv',
    titleEn: 'Verifying news',
    goalCs: 'dohledat původ tvrzení a vysvětlit, nakolik je důvěryhodné',
    goalEn: 'trace a claim to its origin and explain how credible it is',
    grammarPattern: 'Worauf beruht die Aussage, und womit wurde sie gegengeprüft?',
    speakerA: 'Editorka',
    speakerB: 'Fact-checker',
    dialogue: [
      {
        speaker: 'Editorka',
        de: 'Die Überschrift wirkt sehr eindeutig. Ist die Darstellung quellenbasiert?',
        cs: 'Titulek působí velmi jednoznačně. Má způsob podání oporu ve zdrojích?',
      },
      {
        speaker: 'Fact-checker',
        de: 'Noch nicht. Ich verfolge die Zahl zuerst bis zur Primärquelle zurück.',
        cs: 'Zatím ne. Nejprve dohledám číslo k primárnímu zdroji.',
      },
      {
        speaker: 'Editorka',
        de: 'Gut, kontextualisiere danach auch die verkürzte Grafik.',
        cs: 'Dobře, potom také zasaď do souvislostí zavádějící graf.',
      },
    ],
  },
  {
    id: 'chapter-113-energy-efficiency',
    packId: 'energy-efficiency',
    grammarLessonId: 'indem-dadurch-dass',
    titleCs: 'Energetická účinnost',
    titleEn: 'Energy efficiency',
    goalCs: 'porovnat investici, úsporu a realistickou návratnost opatření',
    goalEn: 'compare the investment, savings, and realistic payback of a measure',
    grammarPattern: 'Indem wir ..., lässt sich der Energieverbrauch um ... senken.',
    speakerA: 'Správkyně budovy',
    speakerB: 'Energetický poradce',
    dialogue: [
      {
        speaker: 'Správkyně budovy',
        de: 'Welche Maßnahme senkt unseren Energieverbrauch am stärksten?',
        cs: 'Které opatření sníží naši spotřebu energie nejvíce?',
      },
      {
        speaker: 'Energetický poradce',
        de: 'Indem wir die Wärmedämmung nachrüsten, sparen wir langfristig am meisten.',
        cs: 'Dodatečným zateplením ušetříme dlouhodobě nejvíce.',
      },
      {
        speaker: 'Správkyně budovy',
        de: 'Dann prüfen wir noch die Amortisationszeit.',
        cs: 'Pak ještě prověříme dobu návratnosti.',
      },
    ],
  },
  {
    id: 'chapter-114-project-risk',
    packId: 'project-risk',
    grammarLessonId: 'conditional-without-wenn',
    titleCs: 'Rizika projektu',
    titleEn: 'Project risks',
    goalCs: 'seřadit rizika podle dopadu a přiřadit jim účinná opatření',
    goalEn: 'rank risks by impact and assign effective measures',
    grammarPattern: 'Sollte das Risiko eintreten, würden wir die Folgen durch ... abfedern.',
    speakerA: 'Projektová vedoucí',
    speakerB: 'Analytik',
    dialogue: [
      {
        speaker: 'Projektová vedoucí',
        de: 'Welches Risiko müssen wir in der Risikomatrix am höchsten gewichten?',
        cs: 'Kterému riziku musíme v matici rizik dát prioritu?',
      },
      {
        speaker: 'Analytik',
        de: 'Der Engpass ist wahrscheinlich, und sein Schadensausmaß wäre hoch.',
        cs: 'Úzké místo je pravděpodobné a rozsah škody by byl vysoký.',
      },
      {
        speaker: 'Projektová vedoucí',
        de: 'Dann legen wir sofort eine vorbeugende Gegenmaßnahme fest.',
        cs: 'Pak okamžitě stanovíme preventivní protiopatření.',
      },
    ],
  },
  {
    id: 'chapter-115-digital-privacy',
    packId: 'digital-privacy',
    grammarLessonId: 'haben-sein-zu-infinitive',
    titleCs: 'Digitální soukromí',
    titleEn: 'Digital privacy',
    goalCs: 'vyhodnotit přístup k datům a rozhodnout o prvních bezpečnostních krocích',
    goalEn: 'assess access to data and decide on the first security steps',
    grammarPattern: 'Die Zugriffsrechte sind zu widerrufen, indem ... .',
    speakerA: 'Bezpečnostní pracovnice',
    speakerB: 'Správce systému',
    dialogue: [
      {
        speaker: 'Bezpečnostní pracovnice',
        de: 'Welche Zugriffsrechte waren von dem Datenleck betroffen?',
        cs: 'Kterých přístupových práv se únik dat týkal?',
      },
      {
        speaker: 'Správce systému',
        de: 'Ein unbefugtes Konto konnte interne Dateien öffnen.',
        cs: 'Neoprávněný účet mohl otevírat interní soubory.',
      },
      {
        speaker: 'Bezpečnostní pracovnice',
        de: 'Widerrufen Sie den Zugang und aktivieren Sie die Zwei-Faktor-Authentifizierung.',
        cs: 'Zrušte přístup a aktivujte dvoufaktorové ověřování.',
      },
    ],
  },
  {
    id: 'chapter-116-accessible-city',
    packId: 'accessible-city',
    grammarLessonId: 'prepositional-relative-clauses',
    titleCs: 'Přístupné město',
    titleEn: 'An accessible city',
    goalCs: 'popsat překážku ve veřejném prostoru a obhájit konkrétní nápravu',
    goalEn: 'describe a barrier in public space and justify a concrete remedy',
    grammarPattern: 'Der Zugang, zu dem kein Aufzug führt, muss umgebaut werden.',
    speakerA: 'Obyvatelka',
    speakerB: 'Městský plánovač',
    dialogue: [
      {
        speaker: 'Obyvatelka',
        de: 'Der Aufzugsausfall beeinträchtigt den einzigen stufenlosen Zugang.',
        cs: 'Výpadek výtahu omezuje jediný bezbariérový přístup.',
      },
      {
        speaker: 'Městský plánovač',
        de: 'Wir kennzeichnen einen Ersatzweg und bauen die Kreuzung um.',
        cs: 'Označíme náhradní trasu a stavebně upravíme křižovatku.',
      },
      {
        speaker: 'Obyvatelka',
        de: 'Bitte beziehen Sie auch das taktile Leitsystem ein.',
        cs: 'Zahrňte prosím také hmatový orientační systém.',
      },
    ],
  },
  {
    id: 'chapter-117-research-ethics',
    packId: 'research-ethics',
    grammarLessonId: 'connective-relative-clauses',
    titleCs: 'Výzkumná etika',
    titleEn: 'Research ethics',
    goalCs: 'posoudit souhlas, rizika a podmínky eticky přijatelné studie',
    goalEn: 'assess consent, risks, and the conditions for an ethical study',
    grammarPattern: 'Die Studie soll ..., wobei das Abbruchkriterium ... .',
    speakerA: 'Členka komise',
    speakerB: 'Výzkumník',
    dialogue: [
      {
        speaker: 'Členka komise',
        de: 'Wie stellen Sie die freiwillige Einwilligung der Versuchspersonen sicher?',
        cs: 'Jak zajistíte dobrovolný souhlas účastníků výzkumu?',
      },
      {
        speaker: 'Výzkumník',
        de: 'Wir erklären jedes Risiko und anonymisieren alle persönlichen Daten.',
        cs: 'Vysvětlíme každé riziko a anonymizujeme všechny osobní údaje.',
      },
      {
        speaker: 'Členka komise',
        de: 'Dann ergänzen Sie bitte noch ein eindeutiges Abbruchkriterium.',
        cs: 'Pak prosím doplňte ještě jednoznačné kritérium ukončení.',
      },
    ],
  },
  {
    id: 'chapter-118-science-communication',
    packId: 'science-communication',
    grammarLessonId: 'source-attribution-phrases',
    titleCs: 'Srozumitelná věda',
    titleEn: 'Science made understandable',
    goalCs: 'vysvětlit odborný výsledek přesně a srozumitelně širšímu publiku',
    goalEn: 'explain a specialist finding accurately to a wider audience',
    grammarPattern: 'Den Daten zufolge ..., wobei der Unsicherheitsbereich ... .',
    speakerA: 'Novinářka',
    speakerB: 'Vědkyně',
    dialogue: [
      {
        speaker: 'Novinářka',
        de: 'Wie lautet die Kernaussage für ein Laienpublikum?',
        cs: 'Jak zní hlavní sdělení pro laické publikum?',
      },
      {
        speaker: 'Vědkyně',
        de: 'Der Zusammenhang ist belastbar, aber seine genaue Größenordnung bleibt unsicher.',
        cs: 'Souvislost je spolehlivě podložená, ale její přesnou velikost zatím nelze určit.',
      },
      {
        speaker: 'Novinářka',
        de: 'Dann veranschaulichen wir das, ohne den Befund zu vereinfachen.',
        cs: 'Pak to znázorníme, aniž bychom nález příliš zjednodušili.',
      },
    ],
  },
  {
    id: 'chapter-119-public-policy',
    packId: 'public-policy',
    grammarLessonId: 'conditional-without-wenn',
    titleCs: 'Veřejná politika a konzultace',
    titleEn: 'Public policy and consultation',
    goalCs: 'posoudit návrh, výjimky a měřitelné vyhodnocení jeho dopadů',
    goalEn: 'assess a proposal, its exceptions, and measurable impact evaluation',
    grammarPattern: 'Der Entwurf soll ..., vorausgesetzt, die Folgenabschätzung ... .',
    speakerA: 'Moderátorka',
    speakerB: 'Účastník konzultace',
    dialogue: [
      {
        speaker: 'Moderátorka',
        de: 'Welche Übergangsregelung halten Sie für verhältnismäßig?',
        cs: 'Které přechodné ustanovení považujete za přiměřené?',
      },
      {
        speaker: 'Účastník konzultace',
        de: 'Eine befristete Regelung wäre praktisch umsetzbar.',
        cs: 'Časově omezené ustanovení by bylo prakticky proveditelné.',
      },
      {
        speaker: 'Moderátorka',
        de: 'Dann muss der Gesetzentwurf bei Härtefällen nachgebessert werden.',
        cs: 'Pak musí být návrh zákona upraven také pro zvlášť tíživé případy.',
      },
    ],
  },
  {
    id: 'chapter-120-crisis-communication',
    packId: 'crisis-communication',
    grammarLessonId: 'nuanced-connectors',
    titleCs: 'Komunikace v krizové situaci',
    titleEn: 'Communication during a crisis',
    goalCs: 'sjednotit ověřené informace a vydat jasný, přiměřený další pokyn',
    goalEn: 'align verified information and issue a clear, proportionate next instruction',
    grammarPattern: 'Nach aktuellem Informationsstand ...; dennoch ist ... zu beachten.',
    speakerA: 'Vedoucí krizového štábu',
    speakerB: 'Tisková mluvčí',
    dialogue: [
      {
        speaker: 'Vedoucí krizového štábu',
        de: 'Ist unser Lagebild für die nächste Mitteilung widerspruchsfrei?',
        cs: 'Je náš situační přehled pro další sdělení bez rozporů?',
      },
      {
        speaker: 'Tisková mluvčí',
        de: 'Ja, aber die gemeldete Ursache ist weiterhin unbestätigt.',
        cs: 'Ano, ale uvedená příčina zůstává nepotvrzená.',
      },
      {
        speaker: 'Vedoucí krizového štábu',
        de: 'Dann aktualisieren wir die Handlungsempfehlung, ohne Entwarnung zu geben.',
        cs: 'Pak aktualizujeme doporučený postup, aniž bychom vyhlásili konec nebezpečí.',
      },
    ],
  },
];

export { diversityChapterIdsByPreviousChapter } from './course-chapter-ids.ts';

export const diversityChapterBridges: Readonly<Record<string, DiversityChapterBridge>> = {
  'chapter-101-market-groceries': {
    de: 'Ich nehme drei Tomaten und eine Gurke. Was kostet das zusammen?',
    cs: 'Vezmu si tři rajčata a jednu okurku. Kolik to stojí dohromady?',
    sentenceStarter: 'Ich nehme ...',
  },
  'chapter-102-hobby-meetup': {
    de: 'Ich möchte den Spieleabend ausprobieren und kann am Freitag vorbeikommen.',
    cs: 'Chtěla bych vyzkoušet herní večer a v pátek se mohu zastavit.',
    sentenceStarter: 'Ich möchte ... ausprobieren und kann ...',
  },
  'chapter-103-weather-and-clothing': {
    de: 'Wenn das Wetter wechselhaft bleibt, ziehe ich meine wasserdichte Jacke an und nehme vorsichtshalber Gummistiefel mit.',
    cs: 'Pokud zůstane počasí proměnlivé, vezmu si nepromokavou bundu a pro jistotu také holínky.',
    sentenceStarter: 'Wenn das Wetter ...',
  },
  'chapter-104-library-services': {
    de: 'Wo kann ich den Bibliotheksausweis beantragen, und kann ich die Leihfrist online verlängern?',
    cs: 'Kde mohu požádat o čtenářský průkaz a mohu výpůjční lhůtu prodloužit online?',
    sentenceStarter: 'Wo kann ich ...',
  },
  'chapter-105-dietary-needs': {
    de: 'Ich vertrage keine Erdnüsse. Enthält die Soße Erdnüsse?',
    cs: 'Nesnáším arašídy. Obsahuje omáčka arašídy?',
    sentenceStarter: 'Ich vertrage kein ...',
  },
  'chapter-106-civic-services': {
    de: 'Können Sie mir sagen, wo ich eine Meldebescheinigung beantragen kann?',
    cs: 'Můžete mi říct, kde mohu požádat o potvrzení o bydlišti?',
    sentenceStarter: 'Können Sie mir sagen, wo ...',
  },
  'chapter-107-travel-disruptions': {
    de: 'Da mein Anschlusszug ausfällt, brauche ich eine Ersatzverbindung.',
    cs: 'Protože byl můj navazující vlak zrušen, potřebuji náhradní spojení.',
    sentenceStarter: 'Da mein Anschlusszug ...',
  },
  'chapter-108-cultural-evening': {
    de: 'Wir kaufen die Eintrittskarten im Voraus, weil die spätere Vorstellung fast ausverkauft ist.',
    cs: 'Vstupenky koupíme předem, protože pozdější představení je téměř vyprodané.',
    sentenceStarter: 'Wir kaufen ... im Voraus, weil ...',
  },
  'chapter-109-community-volunteering': {
    de: 'Während ich die Arbeitshandschuhe verteile, sammeln die anderen die Müllsäcke ein.',
    cs: 'Zatímco rozdávám pracovní rukavice, ostatní sbírají pytle na odpad.',
    sentenceStarter: 'Während ich ...',
  },
  'chapter-110-workplace-onboarding': {
    de: 'Der Ansprechpartner, an den ich mich bei Fragen wende, erklärt mir die Zuständigkeiten.',
    cs: 'Kontaktní osoba, na kterou se obracím s dotazy, mi vysvětlí kompetence.',
    sentenceStarter: 'Der Ansprechpartner, an den ...',
  },
  'chapter-111-academic-presentation': {
    de: 'Die Leitfrage, auf die wir in der Präsentation eingehen, bestimmt unsere Gliederung.',
    cs: 'Hlavní otázka, kterou se v prezentaci zabýváme, určuje naši strukturu.',
    sentenceStarter: 'Die Leitfrage, auf die ...',
  },
  'chapter-112-media-literacy': {
    de: 'Worauf beruht die Zahl, lässt sie sich bis zur Primärquelle zurückverfolgen, und womit wurde sie gegengeprüft?',
    cs: 'Na čem je toto číslo založené, lze ho dohledat k primárnímu zdroji a čím bylo ověřeno?',
    sentenceStarter: 'Worauf beruht ...',
  },
  'chapter-113-energy-efficiency': {
    de: 'Indem wir die Wärmedämmung nachrüsten, lässt sich der Energieverbrauch langfristig senken.',
    cs: 'Dodatečným zateplením lze dlouhodobě snížit spotřebu energie.',
    sentenceStarter: 'Indem wir ...',
  },
  'chapter-114-project-risk': {
    de: 'Sollte der Engpass eintreten, würden wir die Folgen durch eine zweite Lieferquelle abfedern.',
    cs: 'Pokud by úzké místo nastalo, zmírnili bychom následky druhým dodavatelem.',
    sentenceStarter: 'Sollte der Engpass eintreten, ...',
  },
  'chapter-115-digital-privacy': {
    de: 'Die Zugriffsrechte sind zu widerrufen, indem das betroffene Konto sofort gesperrt wird.',
    cs: 'Přístupová práva je nutné odebrat tím, že se dotčený účet okamžitě zablokuje.',
    sentenceStarter: 'Die Zugriffsrechte sind zu widerrufen, indem ...',
  },
  'chapter-116-accessible-city': {
    de: 'Der Zugang, zu dem wegen des Aufzugsausfalls kein stufenloser Weg führt, muss für mehr Barrierefreiheit umgebaut werden.',
    cs: 'Přístup, ke kterému kvůli výpadku výtahu nevede bezbariérová cesta, musí být přestavěn pro lepší přístupnost.',
    sentenceStarter: 'Der Zugang, zu dem ...',
  },
  'chapter-117-research-ethics': {
    de: 'Die Studie soll nur mit freiwilliger Einwilligung beginnen, wobei ein klares Abbruchkriterium gilt.',
    cs: 'Studie má začít jen s dobrovolným souhlasem, přičemž musí platit jasné kritérium ukončení.',
    sentenceStarter: 'Die Studie soll ..., wobei ...',
  },
  'chapter-118-science-communication': {
    de: 'Den Daten zufolge ist der Zusammenhang belastbar, wobei der große Unsicherheitsbereich dem Laienpublikum allgemeinverständlich erklärt werden muss.',
    cs: 'Podle dat je souvislost spolehlivě podložená, přičemž velké rozpětí nejistoty je nutné laickému publiku vysvětlit srozumitelně.',
    sentenceStarter: 'Den Daten zufolge ...',
  },
  'chapter-119-public-policy': {
    de: 'Der Entwurf soll befristet gelten, vorausgesetzt, die Folgenabschätzung bestätigt seine Verhältnismäßigkeit.',
    cs: 'Návrh má platit po omezenou dobu za předpokladu, že posouzení dopadů potvrdí jeho přiměřenost.',
    sentenceStarter: 'Der Entwurf soll ..., vorausgesetzt, ...',
  },
  'chapter-120-crisis-communication': {
    de: 'Nach aktuellem Informationsstand besteht keine akute Gefahr; dennoch ist die unbestätigte Ursache zu beachten.',
    cs: 'Podle aktuálních informací nehrozí bezprostřední nebezpečí; přesto je nutné zohlednit nepotvrzenou příčinu.',
    sentenceStarter: 'Nach aktuellem Informationsstand ...',
  },
};

function englishCopy(blueprint: DiversityChapterBlueprint): DiversityChapterEnglishCopy {
  return {
    title: blueprint.titleEn,
    subtitle: `A real exchange opens this chapter: ${blueprint.goalEn}. Ten new expressions arrive inside the scene.`,
    mission: `Enter the exchange and ${blueprint.goalEn}. Use the opening line as your cue, then change one detail in a second original turn.`,
    outcomes: [
      `independently ${blueprint.goalEn}`,
      'use at least four of the ten new expressions accurately',
      'adapt the chapter pattern and continue with one original detail',
    ],
  };
}

export const diversityCourseChapterEnglishCopy: Record<string, DiversityChapterEnglishCopy> =
  Object.fromEntries(
    diversityChapterBlueprints.map((blueprint) => [blueprint.id, englishCopy(blueprint)]),
  );

function variedSupportWords(words: CourseWord[]): [CourseWord, CourseWord, CourseWord] {
  const noun = words.find((word) => word.kind === 'noun') ?? words[0];
  const verb = words.find((word) => word.kind === 'verb' && word !== noun) ?? words[1];
  const modifier = words.toReversed().find((word) => word !== noun && word !== verb) ?? words[2];
  return [noun, verb, modifier];
}

function modelsFromWords(
  words: CourseWord[],
  grammarPattern: string,
  bridge: DiversityChapterBridge,
): [CourseModelSentence, CourseModelSentence, CourseModelSentence, CourseModelSentence] {
  const bridgeModel: CourseModelSentence = {
    de: bridge.de,
    cs: bridge.cs,
    trap: createWordOrderTrap(bridge.de),
    note: `Tato odpověď propojuje situaci kapitoly s cílovým vzorem „${grammarPattern}“.`,
  };
  const supportModels = variedSupportWords(words).map((word, index) => {
    if (!word.exampleDe || !word.exampleCs) {
      throw new Error(`Lexém ${word.german} nemá dvojjazyčný příklad.`);
    }
    return {
      de: word.exampleDe,
      cs: word.exampleCs,
      trap: createWordOrderTrap(word.exampleDe, index + 1),
      note: `Podpůrná věta ukazuje výraz „${word.german}“ v tématu kapitoly; v závěrečné odpovědi ho propojíš vzorem „${grammarPattern}“.`,
    };
  });
  return [bridgeModel, ...supportModels] as [
    CourseModelSentence,
    CourseModelSentence,
    CourseModelSentence,
    CourseModelSentence,
  ];
}

function chapterFromPack(
  blueprint: DiversityChapterBlueprint,
  pack: FutureChapterVocabularyPack,
  source: CourseChapterDefinition,
): CourseChapterDefinition {
  const bridge = diversityChapterBridges[blueprint.id];
  if (!bridge) throw new Error(`Chybí propojující věta kapitoly ${blueprint.id}.`);
  const models = modelsFromWords(pack.words, blueprint.grammarPattern, bridge);
  const outcomes: [string, string, string] = [
    `samostatně ${blueprint.goalCs}`,
    'správně použít alespoň čtyři z deseti nových výrazů',
    'přizpůsobit větný vzor a navázat jedním vlastním detailem',
  ];
  return {
    id: blueprint.id,
    number: 0,
    level: pack.level,
    title: blueprint.titleCs,
    subtitle: `${blueprint.speakerA} otevírá scénu: „${blueprint.dialogue[0].cs}“ Vstupuješ do ní jako ${blueprint.speakerB.toLocaleLowerCase('cs-CZ')}.`,
    situation: pack.situation,
    themeTag: `rozmanitost-${pack.id}`,
    grammarLessonId: blueprint.grammarLessonId,
    grammarLessonIds: [...new Set([blueprint.grammarLessonId, ...pack.grammarLessonIds])],
    coachScenarioId: pack.coachScenarioIds[0],
    coachScenarioIds: [...pack.coachScenarioIds],
    storyBookId: source.storyBookId,
    readingIds: source.readingIds ?? [source.storyBookId],
    grammarIdea: `větný vzor pro situaci ${blueprint.titleCs.toLocaleLowerCase('cs-CZ')}: „${blueprint.grammarPattern}“`,
    mission: `Vstup do scény jako ${blueprint.speakerB.toLocaleLowerCase('cs-CZ')} a dokaž, že umíš ${blueprint.goalCs}. Odpověz na první repliku a potom změň jeden konkrétní detail bez hotové šablony.`,
    outcomes,
    grammarPattern: blueprint.grammarPattern,
    modelSentences: models,
    sentencePrompt: `Odpověz německy na repliku „${blueprint.dialogue[0].cs}“ a změň alespoň jeden detail oproti modelové odpovědi.`,
    sentenceStarter: bridge.sentenceStarter,
    sentenceChecklist: [
      'odpověď řeší konkrétní situaci kapitoly',
      'obsahuje alespoň dva nové výrazy v přesném významu',
      'větný vzor je přizpůsobený vlastnímu sdělení a obsahuje vlastní detail',
    ],
    words: pack.words,
    dialogue: blueprint.dialogue,
    assessment: {
      id: `${blueprint.id}:assessment`,
      instruction: `Bez modelové odpovědi reaguj na repliku „${blueprint.dialogue[0].cs}“ a dokaž, že umíš ${blueprint.goalCs}.`,
      criteria: [outcomes[0], outcomes[1], 'odpověď je významově úplná a situačně vhodná'],
      deterministic: true,
    },
    contentVersion: 4,
  };
}

export function createDiversityCourseChapterDefinitions(
  sourceDefinitions: CourseChapterDefinition[],
): CourseChapterDefinition[] {
  const packs = new Map(futureChapterVocabularyPacks.map((pack) => [pack.id, pack]));
  const sourcesByLevel = new Map<DetailedCefrLevel, CourseChapterDefinition>();
  for (const source of sourceDefinitions) sourcesByLevel.set(source.level, source);

  return diversityChapterBlueprints.map((blueprint) => {
    const pack = packs.get(blueprint.packId);
    if (!pack) throw new Error(`Chybí slovní balíček ${blueprint.packId}.`);
    const source = sourcesByLevel.get(pack.level);
    if (!source) throw new Error(`Chybí zdrojová kapitola úrovně ${pack.level}.`);
    return chapterFromPack(blueprint, pack, source);
  });
}

export const diversityCourseChapterCount = diversityChapterBlueprints.length;
