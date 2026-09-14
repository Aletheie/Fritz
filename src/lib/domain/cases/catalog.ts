import { emptyFrameCase } from './empty-frame.ts';
import type { CaseFile } from './types.ts';

export const caseFiles: CaseFile[] = [
  {
    id: 'backpack',
    title: { cs: 'Batoh, který odjel', en: 'The backpack that left without you' },
    level: 'A2',
    minutes: 7,
    introduction: {
      cs: 'Jule vystoupila z autobusu bez batohu. Za chvíli jí jede vlak. Ve ztrátách a nálezech se sešly dva podobné batohy — pomoz jí najít ten správný a domluvit vyzvednutí.',
      en: 'Jule got off the bus without her backpack, and her train leaves soon. Lost property has reports of two similar bags. Help her identify hers and arrange collection.',
    },
    previewDe: 'Mein Zug fährt heute um 17 Uhr. Ich brauche den Rucksack vorher.',
    focus: {
      cs: 'Popis věcí, čas a pokyny k vyzvednutí',
      en: 'Descriptions, times and collection instructions',
    },
    documents: [
      {
        id: 'jule',
        kind: 'message',
        title: { cs: 'Zpráva od Jule', en: 'Message from Jule' },
        bylineDe: 'Jule · Freitag, 14:15',
        lines: [
          {
            id: 'bag-description',
            textDe: 'Mein Rucksack ist blau. Am Reißverschluss hängt ein gelber Stern.',
          },
          { id: 'bag-last', textDe: 'Ich habe ihn im Bus 24 vergessen, nicht an der Haltestelle.' },
          {
            id: 'bag-need',
            textDe: 'Mein Zug fährt heute um 17 Uhr. Ich brauche den Rucksack vorher.',
          },
        ],
        glossary: [
          { de: 'der Reißverschluss', meaning: { cs: 'zip', en: 'zip / zipper' } },
          { de: 'hängt', meaning: { cs: 'visí', en: 'hangs' } },
          { de: 'vorher', meaning: { cs: 'předtím', en: 'before then' } },
        ],
      },
      {
        id: 'lost-property',
        kind: 'message',
        title: { cs: 'Ztráty a nálezy', en: 'Lost property' },
        bylineDe: 'Fundbüro · Freitag, 14:30',
        lines: [
          { id: 'bag-red', textDe: 'Ein roter Rucksack aus Bus 24 liegt bei uns am Bahnhof.' },
          {
            id: 'bag-blue',
            textDe: 'Ein blauer Rucksack mit einem gelben Stern ist noch beim Fahrer von Bus 24.',
          },
          {
            id: 'bag-stop',
            textDe: 'Der Fahrer bringt ihn heute um 16:10 Uhr zum Büro am Marktplatz.',
          },
        ],
        glossary: [
          { de: 'das Fundbüro', meaning: { cs: 'ztráty a nálezy', en: 'lost property office' } },
          {
            de: 'noch beim Fahrer',
            meaning: { cs: 'ještě u řidiče', en: 'still with the driver' },
          },
          { de: 'der Marktplatz', meaning: { cs: 'náměstí s tržištěm', en: 'market square' } },
        ],
      },
      {
        id: 'collection',
        kind: 'notice',
        title: { cs: 'Vyzvednutí', en: 'Collection' },
        bylineDe: 'Büro am Marktplatz · Freitag',
        lines: [
          { id: 'bag-hours', textDe: 'Büro am Marktplatz: heute von 16 bis 18 Uhr geöffnet.' },
          {
            id: 'bag-proof',
            textDe: 'Zur Abholung brauchst du die Fundnummer F24 und einen Ausweis.',
          },
          { id: 'bag-saturday', textDe: 'Am Samstag bleibt dieses Büro geschlossen.' },
        ],
        glossary: [
          { de: 'die Abholung', meaning: { cs: 'vyzvednutí', en: 'collection / pickup' } },
          {
            de: 'die Fundnummer',
            meaning: { cs: 'číslo nalezené věci', en: 'lost property reference number' },
          },
          { de: 'der Ausweis', meaning: { cs: 'průkaz totožnosti', en: 'ID document' } },
        ],
      },
    ],
    steps: [
      {
        title: { cs: 'Najdi správný batoh', en: 'Identify the right backpack' },
        question: { cs: 'Kde je Julin batoh?', en: 'Where is Jule’s backpack?' },
        context: {
          cs: 'Jule zapomněla batoh v autobuse. Porovnej její popis se zprávou ze ztrát a nálezů a zjisti, který je její.',
          en: 'Jule left her backpack on a bus. Compare her description with the lost property message to work out which one is hers.',
        },
        finding: {
          cs: 'Modrý batoh se žlutou hvězdou je stále u řidiče autobusu 24.',
          en: 'The blue backpack with the yellow star is still with the driver of bus 24.',
        },
        startDocumentId: 'jule',
        promptDe:
          'Wo ist Jules Rucksack jetzt? Vergleiche ihre Beschreibung mit der Antwort des Fundbüros.',
        choices: [
          {
            id: 'a',
            textDe: 'Er liegt schon im Fundbüro am Bahnhof.',
            feedback: {
              cs: 'Na nádraží je červený batoh. Číslo autobusu souhlasí, ale Jule popisuje jinou barvu. Porovnej i žlutou hvězdu.',
              en: 'The bag at the station is red. The bus number matches, but Jule describes a different colour. Compare the yellow star too.',
            },
          },
          {
            id: 'b',
            textDe: 'Er ist noch beim Fahrer von Bus 24.',
            feedback: {
              cs: 'Modrá barva i žlutá hvězda souhlasí.',
              en: 'Both the blue colour and the yellow star match.',
            },
          },
          {
            id: 'c',
            textDe: 'Er liegt an der Haltestelle.',
            feedback: {
              cs: 'Jule výslovně píše „nicht an der Haltestelle“. Zpráva z nálezů navíc popisuje její batoh u řidiče.',
              en: 'Jule explicitly says “nicht an der Haltestelle”. Lost property also describes her bag as still being with the driver.',
            },
          },
        ],
        hint: {
          cs: 'Označ popis batohu ve zprávě od Jule a větu z nálezů, ve které se shodují oba poznávací znaky.',
          en: 'Select Jule’s description and the line from lost property that matches both identifying features.',
        },
        explanation: {
          cs: 'Samotný autobus 24 nestačí. Popis „blau“ a „gelber Stern“ propojuje Jule právě s batohem u řidiče.',
          en: 'Bus 24 alone is not enough. “Blau” and “gelber Stern” connect Jule to the bag that is still with the driver.',
        },
        replyDe: 'Jule: Genau, der mit dem Stern! Dann muss ich nicht zum Bahnhof laufen.',
        language: {
          de: 'Er ist noch beim Fahrer.',
          explanation: {
            cs: '„Noch“ znamená „ještě“. „Beim Fahrer“ říká, u koho batoh právě je: bei + dem → beim.',
            en: '“Noch” means “still”. “Beim Fahrer” tells you who has the bag: bei + dem → beim.',
          },
        },
      },
      {
        title: { cs: 'Slaď dva časy', en: 'Match the two times' },
        question: { cs: 'Kdy si ho může Jule vyzvednout?', en: 'When can Jule collect it?' },
        context: {
          cs: 'Batoh je u řidiče. Najdi čas, kdy už bude doručený a kancelář bude otevřená.',
          en: 'The driver has the bag. Find a time when it will have arrived and the office will be open.',
        },
        finding: {
          cs: 'V 16:15 už bude batoh na náměstí a kancelář bude otevřená.',
          en: 'At 16:15, the bag will be at the market square and the office will be open.',
        },
        startDocumentId: 'collection',
        promptDe: 'Wann kann Jule den Rucksack laut den Unterlagen abholen?',
        choices: [
          {
            id: 'a',
            textDe: 'Heute um 16:05 Uhr am Marktplatz.',
            feedback: {
              cs: 'Kancelář už má otevřeno, ale řidič dorazí s batohem až v 16:10. Otevírací doba sama nestačí.',
              en: 'The office is open, but the driver will not bring the bag until 16:10. Opening hours alone are not enough.',
            },
          },
          {
            id: 'b',
            textDe: 'Am Samstag um 10 Uhr am Marktplatz.',
            feedback: {
              cs: 'Sobotní vyzvednutí nejde: oznámení říká, že kancelář zůstává zavřená.',
              en: 'Saturday collection is not possible: the notice says the office will be closed.',
            },
          },
          {
            id: 'c',
            textDe: 'Heute um 16:15 Uhr am Marktplatz.',
            feedback: {
              cs: 'Batoh už bude doručený a kancelář bude otevřená.',
              en: 'The bag will have arrived and the office will be open.',
            },
          },
        ],
        hint: {
          cs: 'Potřebuješ čas, kdy řidič batoh přiveze, a dnešní otevírací dobu. Označ po jedné větě ve dvou podkladech.',
          en: 'You need the driver’s delivery time and today’s opening hours. Select one line in each of those two documents.',
        },
        explanation: {
          cs: 'Řidič dorazí v 16:10 a kancelář má otevřeno od 16 do 18. V 16:15 tedy platí obě podmínky.',
          en: 'The driver arrives at 16:10 and the office opens from 16:00 to 18:00. At 16:15, both conditions are met.',
        },
        replyDe:
          'Jule: Gut, dann gehe ich um 16:15 Uhr zum Büro am Marktplatz. Was muss ich mitnehmen?',
        language: {
          de: 'um 16:10 Uhr · von 16 bis 18 Uhr',
          explanation: {
            cs: '„Um“ označuje jeden časový bod. „Von … bis …“ vymezuje časový úsek.',
            en: '“Um” marks a single point in time. “Von … bis …” describes a time window.',
          },
        },
      },
      {
        title: { cs: 'Pošli poslední pokyn', en: 'Send the final instruction' },
        question: { cs: 'Co si má Jule vzít s sebou?', en: 'What does Jule need to bring?' },
        context: {
          cs: 'Místo a čas už Jule zná. Teď potřebuje vědět, co bude k vyzvednutí batohu potřebovat.',
          en: 'Jule knows where to go and when. Now she needs to know what to bring to collect her bag.',
        },
        finding: {
          cs: 'K vyzvednutí jsou potřeba průkaz totožnosti a číslo nálezu F24.',
          en: 'Collection requires an ID document and the reference number F24.',
        },
        startDocumentId: 'collection',
        promptDe: 'Was soll Jule zur Abholung mitbringen? Wähle deine Nachricht und belege sie.',
        choices: [
          {
            id: 'a',
            textDe: 'Nimm deinen Ausweis mit. Die Fundnummer ist F24.',
            feedback: {
              cs: 'Zpráva obsahuje obě požadované věci.',
              en: 'The message includes both required items.',
            },
          },
          {
            id: 'b',
            textDe: 'Ein Foto vom Rucksack reicht. Du brauchst keinen Ausweis.',
            feedback: {
              cs: 'Fotku podklady jako náhradu neuvádějí. Oznámení výslovně požaduje průkaz a číslo nálezu.',
              en: 'The documents do not offer a photo as an alternative. The notice explicitly requires ID and a reference number.',
            },
          },
          {
            id: 'c',
            textDe: 'Nimm deinen Ausweis mit. Die Fundnummer ist F42.',
            feedback: {
              cs: 'Průkaz je správně, ale číslo je prohozené. V oznámení stojí F24.',
              en: 'The ID is correct, but the digits are reversed. The notice says F24.',
            },
          },
        ],
        hint: {
          cs: 'Otevři Vyzvednutí. Hledej větu začínající „Zur Abholung“ a zkontroluj pořadí číslic.',
          en: 'Open Collection. Find the line beginning “Zur Abholung” and check the order of the digits.',
        },
        explanation: {
          cs: '„Und“ spojuje dva požadavky: Fundnummer F24 a einen Ausweis. Nestačí jen jeden z nich.',
          en: '“Und” connects two requirements: Fundnummer F24 and einen Ausweis. Just one of them is not enough.',
        },
        replyDe:
          'Jule: Ausweis ist in meiner Jacke, F24 habe ich gespeichert. Ich mache mich auf den Weg!',
        language: {
          de: 'Nimm deinen Ausweis mit.',
          explanation: {
            cs: '„Mitnehmen“ je odlučitelné sloveso. V pokynu „Nimm … mit“ stojí předpona až na konci.',
            en: '“Mitnehmen” is a separable verb. In the instruction “Nimm … mit”, the prefix goes at the end.',
          },
        },
      },
    ],
    endingDe: 'Jule, 16:18: Hab ihn! Blau, gelber Stern, alles drin. Danke fürs Mitdenken.',
    takeaway: {
      cs: 'Podařilo se spojit popis věci, čas doručení a podmínky vyzvednutí. Jedna shodná informace ještě nemusí znamenat správný závěr.',
      en: 'You connected an object’s description, its arrival time and the collection requirements. One matching detail is not always enough to reach the right conclusion.',
    },
  },
  {
    id: 'soundcheck',
    title: { cs: 'Než začne koncert', en: 'Before the first song' },
    level: 'B1',
    minutes: 9,
    introduction: {
      cs: 'Mina má lístek na dnešní koncert. Starý plakát, nová zpráva pořadatele a zvěst od kamaráda si ale odporují. Dej dohromady plán, podle kterého opravdu dorazí.',
      en: 'Mina has a ticket for tonight. An old poster, a new message from the organiser and a friend’s rumour tell different stories. Work out a plan that gets her to the concert.',
    },
    previewDe: 'Jemand meinte, wir müssten zur Osthalle. Auf meinem Plakat steht aber Westwerk.',
    focus: {
      cs: 'Změny plánů, spolehlivost zdrojů a časová návaznost',
      en: 'Changed plans, reliable sources and timing',
    },
    documents: [
      {
        id: 'poster',
        kind: 'poster',
        title: { cs: 'Původní plakát', en: 'Original poster' },
        bylineDe: 'Lokalabend · veröffentlicht am Montag',
        lines: [
          { id: 'show-place', textDe: 'Diesen Freitag: Lokalabend im Westwerk, Saal 1.' },
          { id: 'show-time', textDe: 'Einlass 19:00 Uhr · Beginn 19:30 Uhr.' },
          { id: 'show-ticket', textDe: 'Eintritt nur mit gültigem Ticket.' },
        ],
        glossary: [
          {
            de: 'der Einlass',
            meaning: { cs: 'vpuštění návštěvníků', en: 'doors opening / admission' },
          },
          { de: 'der Beginn', meaning: { cs: 'začátek', en: 'start' } },
          { de: 'gültig', meaning: { cs: 'platný', en: 'valid' } },
        ],
      },
      {
        id: 'organiser',
        kind: 'notice',
        title: { cs: 'Změna od pořadatele', en: 'Organiser’s update' },
        bylineDe: 'Lokalabend-Team · Freitag, 15:00',
        lines: [
          {
            id: 'show-move',
            textDe: 'Wegen eines Wasserschadens findet der Lokalabend heute im Saal 2 statt.',
          },
          {
            id: 'show-same',
            textDe: 'Der Veranstaltungsort bleibt das Westwerk; nur der Raum ändert sich.',
          },
          {
            id: 'show-delay',
            textDe: 'Der Einlass verschiebt sich um 30 Minuten. Konzertbeginn ist jetzt um 20 Uhr.',
          },
          { id: 'show-valid', textDe: 'Bereits gekaufte Tickets bleiben gültig.' },
        ],
        glossary: [
          {
            de: 'der Wasserschaden',
            meaning: { cs: 'škoda způsobená vodou, např. vytopení', en: 'water damage' },
          },
          { de: 'der Veranstaltungsort', meaning: { cs: 'místo konání', en: 'venue' } },
          { de: 'verschiebt sich um', meaning: { cs: 'posouvá se o', en: 'is moved back by' } },
          { de: 'bereits', meaning: { cs: 'už, již', en: 'already' } },
        ],
      },
      {
        id: 'mina',
        kind: 'message',
        title: { cs: 'Zpráva od Miny', en: 'Message from Mina' },
        bylineDe: 'Mina · Freitag, 15:10',
        lines: [
          {
            id: 'show-rumor',
            textDe:
              'Jemand meinte, wir müssten zur Osthalle. Auf meinem Plakat steht aber Westwerk.',
          },
          {
            id: 'show-arrival',
            textDe: 'Ich kann erst um 19:45 Uhr da sein. Verpasse ich dann den Anfang?',
          },
          { id: 'show-refund', textDe: 'Muss ich wegen des neuen Saals ein neues Ticket kaufen?' },
        ],
        glossary: [
          {
            de: 'jemand meinte',
            meaning: { cs: 'někdo říkal / domníval se', en: 'someone said / thought' },
          },
          {
            de: 'wir müssten',
            meaning: {
              cs: 'museli bychom; zde převzaté tvrzení',
              en: 'we would have to; here, a reported claim',
            },
          },
          { de: 'verpassen', meaning: { cs: 'zmeškat', en: 'to miss' } },
        ],
      },
    ],
    steps: [
      {
        title: { cs: 'Rozliš změnu a zvěst', en: 'Separate an update from a rumour' },
        question: {
          cs: 'Do které budovy a sálu má Mina jít?',
          en: 'Which building and hall should Mina go to?',
        },
        context: {
          cs: 'Mina jde na koncert, ale plakát, zpráva pořadatele a informace od kamaráda se rozcházejí. Pomoz jí najít správné místo.',
          en: 'Mina is going to a concert, but the poster, the organiser’s update and a friend’s rumour disagree. Help her find the right place.',
        },
        finding: {
          cs: 'Koncert zůstává ve Westwerku. Mění se pouze sál, nově číslo 2.',
          en: 'The concert is still at Westwerk. Only the hall changes, to number 2.',
        },
        startDocumentId: 'mina',
        promptDe:
          'Wohin soll Mina gehen? Belege sowohl das Gebäude als auch den Saal mit der aktuellen Mitteilung.',
        choices: [
          {
            id: 'a',
            textDe: 'Zur Osthalle, Saal 2.',
            feedback: {
              cs: 'Osthalle se objevuje pouze jako převzatá zvěst. Pořadatel výslovně píše, že budova zůstává Westwerk.',
              en: 'Osthalle appears only in a second-hand rumour. The organiser explicitly says the venue remains Westwerk.',
            },
          },
          {
            id: 'b',
            textDe: 'Zum Westwerk, Saal 1.',
            feedback: {
              cs: 'Budova souhlasí, ale sál 1 patří ke starému pondělnímu plakátu. Páteční oznámení sál mění.',
              en: 'The building is correct, but hall 1 comes from Monday’s old poster. Friday’s update changes the room.',
            },
          },
          {
            id: 'c',
            textDe: 'Zum Westwerk, Saal 2.',
            feedback: {
              cs: 'Aktuální oznámení potvrzuje budovu i nový sál.',
              en: 'The current update confirms both the building and the new hall.',
            },
          },
        ],
        hint: {
          cs: 'V oznámení pořadatele najdi jednu větu o novém sále a druhou o budově, která se nemění.',
          en: 'In the organiser’s update, find one line about the new hall and another about the building that stays the same.',
        },
        explanation: {
          cs: 'Nejnovější zpráva není automaticky nejspolehlivější: Mina píše v 15:10, ale jen předává zvěst. Pořadatel v 15:00 přímo potvrzuje Saal 2 a Westwerk.',
          en: 'The newest message is not automatically the most reliable. Mina writes at 15:10 but only repeats a rumour. The organiser’s 15:00 update directly confirms Saal 2 and Westwerk.',
        },
        replyDe: 'Mina: Also doch Westwerk, nur ein anderer Saal. Gut, dass wir nachgesehen haben.',
        language: {
          de: 'nur der Raum ändert sich',
          explanation: {
            cs: '„Nur“ omezuje změnu na místnost. Neznamená změnu celé budovy.',
            en: '“Nur” limits the change to the room. It does not mean the whole venue changes.',
          },
        },
      },
      {
        title: { cs: 'Stihne první píseň?', en: 'Will she make the first song?' },
        question: {
          cs: 'Stihne Mina v 19:45 začátek koncertu?',
          en: 'Will Mina make the start if she arrives at 19:45?',
        },
        context: {
          cs: 'Mina může dorazit až v 19:45. Porovnej původní časy s oznámeným posunem a zjisti, jestli už bude otevřeno a koncert ještě nezačne.',
          en: 'Mina cannot arrive before 19:45. Compare the original times with the announced delay: will the doors be open and the concert still ahead?',
        },
        finding: {
          cs: 'Dveře se otevírají v 19:30, koncert začíná ve 20:00. Mina dorazí včas.',
          en: 'Doors open at 19:30 and the concert starts at 20:00. Mina will be on time.',
        },
        startDocumentId: 'poster',
        promptDe: 'Mina kommt um 19:45 Uhr. Liegt das nach dem Einlass und vor dem Konzertbeginn?',
        choices: [
          {
            id: 'a',
            textDe: 'Ja. Sie kommt nach dem Einlass, aber vor dem Konzertbeginn.',
            feedback: {
              cs: 'Její příchod leží mezi otevřením dveří a začátkem koncertu.',
              en: 'Her arrival falls between doors opening and the start of the concert.',
            },
          },
          {
            id: 'b',
            textDe: 'Nein. Das Konzert läuft dann schon seit 15 Minuten.',
            feedback: {
              cs: 'To by platilo podle starého začátku v 19:30. Pořadatel ale posunul začátek koncertu na 20:00.',
              en: 'That would be true for the old 19:30 start. The organiser has moved the concert to 20:00.',
            },
          },
          {
            id: 'c',
            textDe: 'Nein. Der Einlass beginnt erst um 20 Uhr.',
            feedback: {
              cs: 'Ve 20:00 začíná koncert. „Einlass“ je jiný čas: původních 19:00 se posouvá o 30 minut.',
              en: '20:00 is the concert start. “Einlass” is a different time: the original 19:00 moves back by 30 minutes.',
            },
          },
        ],
        hint: {
          cs: 'Označ původní řádek s časy a nový řádek o posunu. K původnímu vpuštění v 19:00 přičti 30 minut.',
          en: 'Select the original times and the new line about the delay. Add 30 minutes to the original 19:00 doors time.',
        },
        explanation: {
          cs: 'Vpuštění: 19:00 + 30 minut = 19:30. Koncert: nově 20:00. Příchod v 19:45 je po vpuštění a 15 minut před koncertem.',
          en: 'Doors: 19:00 + 30 minutes = 19:30. Concert: now 20:00. Arriving at 19:45 is after doors open and 15 minutes before the concert.',
        },
        replyDe: 'Mina: Dann schaffe ich die erste Band doch. Ich bin gegen Viertel vor acht da.',
        language: {
          de: 'um 30 Minuten · um 20 Uhr',
          explanation: {
            cs: 'U posunu „um 30 Minuten“ znamená „o 30 minut“. S hodinou „um 20 Uhr“ znamená „ve 20 hodin“. „Viertel vor acht“ je 19:45.',
            en: 'For a delay, “um 30 Minuten” means “by 30 minutes”. With a clock time, “um 20 Uhr” means “at 20:00”. “Viertel vor acht” is 19:45 here.',
          },
        },
      },
      {
        title: { cs: 'Vyřeš lístek', en: 'Settle the ticket question' },
        question: { cs: 'Potřebuje Mina nový lístek?', en: 'Does Mina need a new ticket?' },
        context: {
          cs: 'Sál se změnil. Ověř v oznámení pořadatele, jestli její původní lístek pořád platí.',
          en: 'The hall has changed. Check the organiser’s update to find out whether her original ticket is still valid.',
        },
        finding: {
          cs: 'Původní lístek platí i po změně sálu.',
          en: 'The original ticket remains valid after the hall change.',
        },
        startDocumentId: 'organiser',
        promptDe: 'Muss Mina ein neues Ticket kaufen? Wähle die passende Nachricht und belege sie.',
        choices: [
          {
            id: 'a',
            textDe: 'Ja, für Saal 2 brauchst du ein neues Ticket.',
            feedback: {
              cs: 'Změna sálu sama o sobě výměnu lístku neznamená. Pořadatel píše, že už koupené lístky dál platí.',
              en: 'A room change does not itself mean a new ticket is needed. The organiser says tickets already bought remain valid.',
            },
          },
          {
            id: 'b',
            textDe: 'Nein, dein Ticket gilt auch für Saal 2.',
            feedback: {
              cs: 'Platnost už koupených lístků je výslovně potvrzená.',
              en: 'The validity of previously purchased tickets is explicitly confirmed.',
            },
          },
          {
            id: 'c',
            textDe: 'Nein, heute darf man ganz ohne Ticket hinein.',
            feedback: {
              cs: '„Bleiben gültig“ znamená, že staré lístky platí dál. Neznamená to, že je vstup bez lístku.',
              en: '“Bleiben gültig” means existing tickets stay valid. It does not mean you can enter without one.',
            },
          },
        ],
        hint: {
          cs: 'V oznámení pořadatele hledej větu s „Tickets“ a „gültig“. Stačí jeden důkaz.',
          en: 'Find the line with “Tickets” and “gültig” in the organiser’s update. One piece of evidence is enough.',
        },
        explanation: {
          cs: '„Bereits gekaufte Tickets bleiben gültig“ se vztahuje právě na lístek, který Mina už má. O novém nákupu ani vstupu zdarma zpráva nemluví.',
          en: '“Bereits gekaufte Tickets bleiben gültig” applies to the ticket Mina already owns. The message says nothing about buying another or free entry.',
        },
        replyDe: 'Mina: Westwerk, Saal 2, mein altes Ticket. Jetzt passt alles. Bis gleich!',
        language: {
          de: 'bleiben gültig',
          explanation: {
            cs: '„Bleiben“ zdůrazňuje, že stav trvá dál. Lístky platily před změnou a platí i po ní.',
            en: '“Bleiben” emphasises that a state continues. The tickets were valid before the change and remain valid afterwards.',
          },
        },
      },
    ],
    endingDe:
      'Mina, 19:47: Bin drin, richtiger Saal, Ticket hat funktioniert. Die Band baut noch auf. Ich halte dir einen Platz frei!',
    takeaway: {
      cs: 'Podařilo se oddělit potvrzenou změnu od zvěsti, přepočítat čas a ověřit platnost lístku. Rozhoduje obsah a původ zprávy, ne jen to, která přišla poslední.',
      en: 'You separated a confirmed update from a rumour, worked out the new time and checked the ticket. What a message says and who sent it matter more than simply which one arrived last.',
    },
  },
  emptyFrameCase,
];

export function caseFileById(id: string): CaseFile | undefined {
  return caseFiles.find((item) => item.id === id);
}
