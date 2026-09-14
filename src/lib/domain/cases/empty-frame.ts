import type { CaseFile } from './types.ts';

export const emptyFrameCase: CaseFile = {
  id: 'empty-frame',
  title: { cs: 'Prázdný rám', en: 'The empty frame' },
  level: 'B1',
  minutes: 10,
  introduction: {
    cs: 'V galerii právě začala vernisáž. Z rámu zmizela fotografie a podezření padá na hosta s velkou deskou. Jenže jeden časový údaj do téhle verze nezapadá. Pomoz Kláře zjistit, co se opravdu stalo.',
    en: 'The gallery opening has just begun. A photograph is missing from its frame, and a guest carrying a large folder looks suspicious. But one timestamp does not fit that story. Help Klara find out what really happened.',
  },
  previewDe: 'Das Foto „Nachtzug“ fehlt. Der Rahmen hängt noch an der Wand.',
  focus: {
    cs: 'Časová osa, zavádějící stopa a ověření totožnosti',
    en: 'A timeline, a misleading clue and proof of identity',
  },
  documents: [
    {
      id: 'klara',
      title: { cs: 'Klara', en: 'Klara' },
      kind: 'message',
      bylineDe: 'Klara · Freitag, 18:12',
      lines: [
        {
          id: 'frame-missing',
          textDe: 'Das Foto „Nachtzug“ fehlt. Der Rahmen hängt noch an der Wand.',
        },
        {
          id: 'frame-guest',
          textDe:
            'Ein Gast mit einer großen Mappe stand gerade vor dem leeren Rahmen. Vielleicht hat er das Foto mitgenommen?',
        },
        {
          id: 'frame-opening',
          textDe: 'Die ersten Gäste kamen heute erst um 18 Uhr in die Galerie.',
        },
        {
          id: 'frame-identity',
          textDe:
            'Nur das Original hat auf der Rückseite einen runden Stempel mit der Nummer 17. Die Kopien haben keinen Stempel.',
        },
      ],
      glossary: [
        { de: 'der Rahmen', meaning: { cs: 'rám', en: 'frame' } },
        {
          de: 'die Mappe',
          meaning: { cs: 'desky, složka na dokumenty', en: 'folder / portfolio' },
        },
        { de: 'erst um', meaning: { cs: 'teprve v', en: 'not until' } },
        { de: 'der Stempel', meaning: { cs: 'razítko', en: 'stamp' } },
        { de: 'die Rückseite', meaning: { cs: 'zadní strana', en: 'back / reverse side' } },
      ],
    },
    {
      id: 'inspection',
      title: { cs: 'Kontrola sálu', en: 'Room check' },
      kind: 'notice',
      bylineDe: 'Hausmeister · Freitag, 17:55',
      lines: [
        {
          id: 'frame-empty',
          textDe:
            '17:40 Uhr — Letzte Kontrolle vor der Eröffnung: Der Rahmen von „Nachtzug“ ist bereits leer. Klara eine Nachricht hinterlassen.',
        },
        {
          id: 'frame-coats',
          textDe:
            '17:50 Uhr — Garderobe vorbereitet. Große Taschen und Mappen können dort abgegeben werden.',
        },
      ],
      glossary: [
        { de: 'bereits', meaning: { cs: 'už, již', en: 'already' } },
        { de: 'die Eröffnung', meaning: { cs: 'zahájení, otevření', en: 'opening' } },
        {
          de: 'eine Nachricht hinterlassen',
          meaning: { cs: 'zanechat vzkaz', en: 'leave a message' },
        },
      ],
    },
    {
      id: 'lea',
      title: { cs: 'Lea', en: 'Lea' },
      kind: 'message',
      availableFrom: 1,
      bylineDe: 'Lea · Freitag, 18:16',
      lines: [
        {
          id: 'frame-cleaning',
          textDe: 'Um 17:20 habe ich „Nachtzug“ aus dem Rahmen genommen, um das Glas zu reinigen.',
        },
        {
          id: 'frame-packed',
          textDe:
            'Ich habe das Foto in eine graue Mappe gelegt. Auf der Mappe stand „KOPIEN · Studio Nord“.',
        },
        {
          id: 'frame-call',
          textDe:
            'Dann musste ich kurz ans Telefon. Als ich zurückkam, war die Mappe weg. Ich dachte, Klara hätte sie ins Büro gebracht.',
        },
      ],
      glossary: [
        { de: 'reinigen', meaning: { cs: 'čistit', en: 'clean' } },
        { de: 'gelegt', meaning: { cs: 'položil/a, dal/a naležato', en: 'placed / laid' } },
        {
          de: 'ich dachte, … hätte',
          meaning: { cs: 'myslel/a jsem si, že…; domněnka', en: 'I thought … had; an assumption' },
        },
      ],
    },
    {
      id: 'courier',
      title: { cs: 'Přepravní lístek', en: 'Delivery slip' },
      kind: 'notice',
      availableFrom: 1,
      bylineDe: 'Stadtkurier · Freitag, 17:30',
      lines: [
        {
          id: 'frame-shipped',
          textDe:
            '17:30 Uhr — In der Galerie West abgeholt: eine graue Mappe mit der Aufschrift „KOPIEN · Studio Nord“. Ziel: Studio Nord.',
        },
        {
          id: 'frame-unopened',
          textDe: 'Inhalt laut Aufschrift: Kopien. Die Mappe wurde beim Transport nicht geöffnet.',
        },
      ],
      glossary: [
        { de: 'abgeholt', meaning: { cs: 'vyzvednuto', en: 'collected' } },
        { de: 'die Aufschrift', meaning: { cs: 'nápis, označení', en: 'label / inscription' } },
        { de: 'laut', meaning: { cs: 'podle (zdroje informace)', en: 'according to' } },
        { de: 'der Inhalt', meaning: { cs: 'obsah', en: 'contents' } },
      ],
    },
    {
      id: 'studio',
      title: { cs: 'Studio Nord', en: 'Studio Nord' },
      kind: 'message',
      availableFrom: 2,
      bylineDe: 'Studio Nord · Freitag, 18:21',
      lines: [
        {
          id: 'frame-motif',
          textDe:
            'Die graue Mappe ist bei uns. Darin liegt ein Foto von einem Zug bei Nacht. Von vorne sieht es genauso aus wie unsere Kopien.',
        },
        {
          id: 'frame-stamp',
          textDe: 'Auf der Rückseite steht in einem runden Stempel die Nummer 17.',
        },
        {
          id: 'frame-safe',
          textDe: 'Das Foto ist unbeschädigt. Wir bewahren es hier auf, bis Klara es abholt.',
        },
      ],
      glossary: [
        { de: 'darin', meaning: { cs: 'v tom, uvnitř', en: 'inside it' } },
        { de: 'genauso wie', meaning: { cs: 'stejně jako', en: 'just like' } },
        { de: 'unbeschädigt', meaning: { cs: 'nepoškozený', en: 'undamaged' } },
        { de: 'aufbewahren', meaning: { cs: 'uschovat', en: 'keep safe' } },
      ],
    },
  ],
  steps: [
    {
      title: { cs: 'Podezření', en: 'The suspicion' },
      question: {
        cs: 'Mohl fotografii odnést některý z hostů?',
        en: 'Could one of the guests have taken the photograph?',
      },
      context: {
        cs: 'Klara podezírá hosta s velkou deskou. Než jí dáš za pravdu, porovnej její zprávu se záznamem kontroly sálu. Soustřeď se na časy.',
        en: 'Klara suspects a guest with a large folder. Before agreeing, compare her message with the room check. Pay attention to the times.',
      },
      finding: {
        cs: 'Rám byl prázdný už ve 17:40. Hosté přišli až v 18:00.',
        en: 'The frame was already empty at 17:40. Guests only arrived at 18:00.',
      },
      startDocumentId: 'klara',
      promptDe: 'Was lässt sich aus den beiden Zeitangaben schließen?',
      choices: [
        {
          id: 'a',
          textDe: 'Der Gast mit der großen Mappe hat das Foto während der Eröffnung genommen.',
          feedback: {
            cs: 'Velké desky vzbuzují podezření, ale nic nedokazují. Správce zaznamenal prázdný rám ještě před příchodem prvních hostů.',
            en: 'The large folder looks suspicious, but proves nothing. The caretaker recorded the empty frame before the first guests arrived.',
          },
        },
        {
          id: 'b',
          textDe: 'Das Foto fehlte schon, bevor die ersten Gäste kamen.',
          feedback: {
            cs: 'Záznam v 17:40 předchází příchodu hostů v 18:00.',
            en: 'The 17:40 record comes before the guests’ arrival at 18:00.',
          },
        },
        {
          id: 'c',
          textDe: 'Wir wissen nicht, ob das Foto vor oder nach der Eröffnung verschwand.',
          feedback: {
            cs: 'Přesný okamžik zmizení zatím neznáš, ale víš, že v 17:40 už byl rám prázdný. Zahájení pro hosty bylo až v 18:00.',
            en: 'You do not know the exact moment it disappeared, but the frame was already empty at 17:40. Guests were not admitted until 18:00.',
          },
        },
      ],
      hint: {
        cs: 'V kontrole sálu najdi, kdy byl rám prázdný. U Klary označ, kdy přišli první hosté. Potřebuješ oba časy.',
        en: 'Find when the frame was empty in the room check. In Klara’s message, highlight when the first guests arrived. You need both times.',
      },
      explanation: {
        cs: 'V 17:40 už fotografie chyběla, první hosté přišli teprve v 18:00. Její zmizení při vernisáži tedy časově nesedí. Přítomnost člověka u prázdného rámu není důkaz, že fotografii vzal.',
        en: 'The photograph was already missing at 17:40; the first guests arrived at 18:00. A disappearance during the opening does not fit the timeline. Standing near an empty frame does not prove someone took the photograph.',
      },
      replyDe:
        'Klara: Dann muss ich früher ansetzen. Lea hat vor der Eröffnung im Saal gearbeitet. Ich frage sie und suche den Abholbeleg.',
      language: {
        de: 'Das Foto fehlte schon, bevor die Gäste kamen.',
        explanation: {
          cs: '„Schon“ znamená „už“. „Bevor“ spojuje události ve významu „dříve než“ a posílá sloveso na konec vedlejší věty.',
          en: '“Schon” means “already”. “Bevor” connects events with “before” and puts the verb at the end of its clause.',
        },
      },
    },
    {
      title: { cs: 'Cesta fotografie', en: 'Following the photograph' },
      question: {
        cs: 'Kam teď vede stopa z galerie?',
        en: 'Where does the trail lead next?',
      },
      context: {
        cs: 'Klara poslala výpověď pomocnice Ley a přepravní lístek. Zjisti, co oba podklady spojuje a kde má smysl fotografii hledat dál.',
        en: 'Klara has sent Lea’s account and a delivery slip. Find what connects them and decide where to look for the photograph next.',
      },
      finding: {
        cs: 'Lea vložila fotografii do šedých desek. Stejně označené desky odvezl kurýr do Studia Nord.',
        en: 'Lea placed the photograph in a grey folder. A courier took a folder with that same label to Studio Nord.',
      },
      startDocumentId: 'lea',
      promptDe: 'Welche Spur verbindet Leas Nachricht mit dem Abholbeleg?',
      choices: [
        {
          id: 'a',
          textDe: 'Das Foto liegt sicher in Klaras Büro.',
          feedback: {
            cs: 'Lea píše „Ich dachte“ — pouze si to myslela. Kurýrův lístek naopak dokládá vyzvednutí desek.',
            en: 'Lea writes “Ich dachte” — she only assumed it. The courier’s slip records that the folder was collected.',
          },
        },
        {
          id: 'b',
          textDe:
            'Zum Studio Nord sind nur Kopien gefahren. Das Original muss noch in der Galerie sein.',
          feedback: {
            cs: 'Kurýr obsah neviděl, jen opsal nápis. Lea ale popisuje, že do takto označených desek vložila fotografii z rámu.',
            en: 'The courier did not see the contents, only the label. Lea says she placed the photograph from the frame in a folder with that label.',
          },
        },
        {
          id: 'c',
          textDe: 'Das Foto ist wahrscheinlich in der grauen Mappe zum Studio Nord gefahren.',
          feedback: {
            cs: 'Barva i označení desek propojují Leinu zprávu s přepravním lístkem.',
            en: 'The folder’s colour and label connect Lea’s message to the delivery slip.',
          },
        },
      ],
      hint: {
        cs: 'U Ley označ, do čeho fotografii vložila. Na přepravním lístku hledej shodnou barvu a nápis. Samotné slovo „KOPIEN“ neříká, co bylo uvnitř.',
        en: 'Highlight what Lea put the photograph into. Find the same colour and label on the delivery slip. “KOPIEN” alone does not establish what was inside.',
      },
      explanation: {
        cs: 'Lea popisuje šedé desky s nápisem „KOPIEN · Studio Nord“. Kurýr vyzvedl desky se stejnými znaky. Studio je tedy dobře podložená stopa; totožnost fotografie je ale ještě potřeba ověřit.',
        en: 'Lea describes a grey folder labelled “KOPIEN · Studio Nord”. The courier collected a folder with those same features. The studio is a well-supported lead, but the photograph’s identity still needs to be checked.',
      },
      replyDe:
        'Klara: Die Mappe sollte nur Kopien enthalten! Ich rufe im Studio an und bitte sie, nachzusehen, was wirklich darin liegt.',
      language: {
        de: 'Inhalt laut Aufschrift: Kopien.',
        explanation: {
          cs: '„Laut“ znamená „podle“. Záznam uvádí obsah podle nápisu, ne podle vlastní kontroly. Zdroj informace mění, jak jistý závěr můžeš udělat.',
          en: '“Laut” means “according to”. The slip reports the contents according to the label, not a personal inspection. The source affects how certain your conclusion can be.',
        },
      },
    },
    {
      title: { cs: 'Rozhodující detail', en: 'The decisive detail' },
      question: {
        cs: 'Je fotografie ve studiu opravdu originál?',
        en: 'Is the photograph at the studio really the original?',
      },
      context: {
        cs: 'Studio otevřelo desky a poslalo popis nálezu. Vrať se i k první zprávě od Klary. Najdi detail, který odliší originál od kopií.',
        en: 'The studio has opened the folder and described what it found. Return to Klara’s first message too. Find the detail that distinguishes the original from the copies.',
      },
      finding: {
        cs: 'Kulaté razítko s číslem 17 potvrzuje, že ve studiu je originál.',
        en: 'The round stamp numbered 17 confirms that the studio has the original.',
      },
      startDocumentId: 'studio',
      promptDe: 'Welches Merkmal beweist, dass es das Original ist?',
      choices: [
        {
          id: 'a',
          textDe: 'Ja. Der runde Stempel mit der Nummer 17 identifiziert das Original.',
          feedback: {
            cs: 'Tento znak má podle Klary pouze originál a studio ho našlo.',
            en: 'Klara says only the original has this mark, and the studio found it.',
          },
        },
        {
          id: 'b',
          textDe: 'Nein. Auf der Mappe steht „KOPIEN“, also kann es kein Original sein.',
          feedback: {
            cs: 'Nápis na deskách neodpovídá jejich obsahu. Máš už přesnější důkaz přímo ze zadní strany fotografie.',
            en: 'The folder’s label does not match its contents. You now have more precise evidence from the back of the photograph itself.',
          },
        },
        {
          id: 'c',
          textDe: 'Ja. Ein Zug bei Nacht ist zu sehen, und das reicht als Beweis.',
          feedback: {
            cs: 'Stejný motiv mají i kopie. Potřebuješ znak, který má jen originál, ne pouze podobný obrázek.',
            en: 'The copies show the same scene. You need a feature unique to the original, not just a similar picture.',
          },
        },
      ],
      hint: {
        cs: 'Ve zprávě od Klary najdi poznávací znak originálu. Ve zprávě studia označ odpovídající nález na zadní straně.',
        en: 'Find the original’s identifying mark in Klara’s message. In the studio’s reply, highlight the matching detail on the back.',
      },
      explanation: {
        cs: 'Motiv vlaku by nestačil — kopie vypadají stejně. Klara ale uvedla, že kulaté razítko 17 má pouze originál. Studio přesně toto razítko našlo. Místo pouhé domněnky máš potvrzenou totožnost.',
        en: 'The train scene alone would not be enough: the copies look the same. But Klara said only the original has the round stamp numbered 17. The studio found that exact stamp. Its identity is now confirmed.',
      },
      replyDe:
        'Klara: Das ist unser Original. Ich hole es ab. Und den Gast mit der großen Mappe lasse ich in Ruhe — er hat damit nichts zu tun.',
      language: {
        de: 'Nur das Original hat diesen Stempel.',
        explanation: {
          cs: '„Nur“ znamená „pouze“. Tady z obyčejného popisu dělá rozlišovací znak: razítko má pouze originál, kopie ne.',
          en: '“Nur” means “only”. Here it makes a description an identifying feature: the original has the stamp and the copies do not.',
        },
      },
    },
  ],
  endingDe:
    'Klara, 18:38: „Nachtzug“ hängt wieder. Lea hatte das Original in die Mappe für die Kopien gelegt. Der Kurier hat genau diese Mappe abgeholt. Danke — ohne die Uhrzeiten hätte ich den falschen Menschen verdächtigt.',
  takeaway: {
    cs: 'Fotografie odjela s kurýrem v deskách označených pro kopie. Zdánlivě podezřelý host přišel až později. Záhadu vyřešila časová osa, shodné označení desek a razítko na originálu.',
    en: 'The photograph left with the courier in a folder labelled for copies. The seemingly suspicious guest arrived later. The timeline, the matching folder label and the original’s stamp solved the mystery.',
  },
  reconstruction: [
    {
      time: '17:20',
      event: {
        cs: 'Lea vyndává fotografii kvůli čištění skla. Ukládá ji do desek označených „KOPIEN“.',
        en: 'Lea removes the photograph to clean the glass and places it in a folder labelled “KOPIEN”.',
      },
    },
    {
      time: '17:30',
      event: {
        cs: 'Kurýr odváží šedé desky do Studia Nord. Jejich obsah nekontroluje.',
        en: 'The courier takes the grey folder to Studio Nord without checking its contents.',
      },
    },
    {
      time: '17:40',
      event: {
        cs: 'Správce zaznamenává prázdný rám. Do příchodu prvních hostů zbývá dvacet minut.',
        en: 'The caretaker records the empty frame. The first guests will not arrive for another twenty minutes.',
      },
    },
    {
      time: '18:21',
      event: {
        cs: 'Studio nachází razítko 17. Originál je na světě a podezření na hosta padá.',
        en: 'The studio finds stamp 17. The original is located and the suspicion against the guest falls apart.',
      },
    },
  ],
};
