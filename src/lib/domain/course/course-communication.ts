import type { DetailedCefrLevel } from '../types.ts';

export type LearnerCopy = { cs: string; en: string };
export type EvidenceVerdict = 'supported' | 'contradicted' | 'not-stated';

type ListeningTask = {
  focus: 'gist' | 'detail';
  prompt: LearnerCopy;
  answer: string;
  distractors: [string, string, string];
  explanation: LearnerCopy;
};

export type CourseCommunication = {
  chapterId: string;
  level: DetailedCefrLevel;
  listening: {
    title: LearnerCopy;
    transcript: string;
    tasks: [ListeningTask, ListeningTask];
  };
  reading: {
    title: LearnerCopy;
    text: string;
    claim: string;
    verdict: EvidenceVerdict;
    explanation: LearnerCopy;
  };
  writing: {
    prompt: LearnerCopy;
    criteria: [LearnerCopy, LearnerCopy, LearnerCopy];
    model: string;
    phrases: [string, string];
  };
};

export const courseCommunications: readonly CourseCommunication[] = [
  {
    chapterId: 'chapter-102-hobby-meetup',
    level: 'A1.1',
    listening: {
      title: { cs: 'Hlasová zpráva od Ley', en: 'A voice message from Lea' },
      transcript:
        'Hallo! Hier ist Lea. Am Samstag spielen wir im Park Volleyball. Wir treffen uns um drei Uhr am Eingang. Bring bitte Wasser mit. Du brauchst keinen Ball. Ich habe einen. Kommst du auch?',
      tasks: [
        {
          focus: 'gist',
          prompt: { cs: 'Proč Lea volá?', en: 'Why is Lea calling?' },
          answer: 'Sie lädt zum Volleyball ein.',
          distractors: [
            'Sie sagt das Volleyballspiel ab.',
            'Sie sucht ihren Ball.',
            'Sie bestellt Wasser.',
          ],
          explanation: {
            cs: 'Lea říká, kdy a kde budete hrát, a ptá se, jestli přijdeš.',
            en: 'Lea says when and where you will play and asks if you are coming.',
          },
        },
        {
          focus: 'detail',
          prompt: { cs: 'Co si máš přinést?', en: 'What should you bring?' },
          answer: 'Wasser.',
          distractors: ['Einen Ball.', 'Ein Spiel.', 'Drei Euro.'],
          explanation: {
            cs: 'Bring bitte Wasser mit je žádost o vodu. Míč už má Lea.',
            en: 'Bring bitte Wasser mit asks you to bring water. Lea already has a ball.',
          },
        },
      ],
    },
    reading: {
      title: { cs: 'Nová pozvánka na nástěnce', en: 'A new invitation on the noticeboard' },
      text: 'Spieleabend am Mittwoch, 17 Uhr, Raum 2. Neue Leute sind willkommen. Bitte ein Spiel mitbringen.',
      claim: 'Der Spieleabend kostet fünf Euro.',
      verdict: 'not-stated',
      explanation: {
        cs: 'Pozvánka cenu neuvádí. Z toho nelze rozhodnout, jestli je večer placený nebo zdarma.',
        en: 'The invitation gives no price. It does not say whether the evening is paid or free.',
      },
    },
    writing: {
      prompt: {
        cs: 'Odpověz Lee německy: potvrď účast na volejbalu, zopakuj čas setkání a napiš, co přineseš.',
        en: 'Reply to Lea in German: accept the volleyball invitation, confirm the meeting time, and say what you will bring.',
      },
      criteria: [
        {
          cs: 'Lea pozná, že přijdu na volejbal.',
          en: 'Lea can tell that I am coming to volleyball.',
        },
        {
          cs: 'Uvádím sobotu v 15:00, ne jiný den nebo čas.',
          en: 'I give Saturday at 15:00, not a different day or time.',
        },
        { cs: 'Píšu, že přinesu vodu.', en: 'I say that I will bring water.' },
      ],
      model:
        'Hallo Lea! Ich möchte am Samstag beim Volleyball mitspielen. Wir treffen uns um drei Uhr am Eingang. Ich bringe Wasser mit.',
      phrases: ['Ich komme gern.', 'Ich bringe … mit.'],
    },
  },
  {
    chapterId: 'chapter-104-library-services',
    level: 'A1.2',
    listening: {
      title: { cs: 'Zpráva z knihovny', en: 'A message from the library' },
      transcript:
        'Guten Tag, hier ist die Stadtbibliothek. Ihr Buch ist da. Sie können es heute bis sechs Uhr abholen. Morgen öffnen wir erst um zwölf Uhr. Bringen Sie bitte Ihren Bibliotheksausweis mit. Sie finden das Buch an der Information im Erdgeschoss.',
      tasks: [
        {
          focus: 'gist',
          prompt: { cs: 'Co ti knihovna oznamuje?', en: 'What does the library tell you?' },
          answer: 'Das bestellte Buch ist jetzt da.',
          distractors: [
            'Die Leihfrist ist zu Ende.',
            'Die Bibliothek ist heute geschlossen.',
            'Der Bibliotheksausweis fehlt.',
          ],
          explanation: {
            cs: 'Ihr Buch ist da znamená, že je kniha připravena k vyzvednutí.',
            en: 'Ihr Buch ist da means that the book is ready to collect.',
          },
        },
        {
          focus: 'detail',
          prompt: {
            cs: 'Kdy se zítra knihovna otevírá?',
            en: 'When does the library open tomorrow?',
          },
          answer: 'Um zwölf Uhr.',
          distractors: ['Um sechs Uhr.', 'Um zehn Uhr.', 'Um achtzehn Uhr.'],
          explanation: {
            cs: 'Morgen … erst um zwölf je zítřejší otevření. Bis sechs se vztahuje k dnešku.',
            en: 'Morgen … erst um zwölf gives tomorrow’s opening time. Bis sechs refers to today.',
          },
        },
      ],
    },
    reading: {
      title: { cs: 'Pokyn u vracení knih', en: 'A notice at book returns' },
      text: 'Bücher bitte am Automaten im Erdgeschoss zurückgeben. Der Lesesaal im ersten Stock ist heute geschlossen. Die Information ist bis 18 Uhr geöffnet.',
      claim: 'Heute kann man den Lesesaal im ersten Stock benutzen.',
      verdict: 'contradicted',
      explanation: {
        cs: 'Text říká, že je čítárna dnes zavřená. Otevřená informační přepážka je jiné místo.',
        en: 'The notice says that the reading room is closed today. The open information desk is a different place.',
      },
    },
    writing: {
      prompt: {
        cs: 'Kamarád ti chce zítra pomoci najít knihu. Předej mu německy, kdy knihovna otevírá, kde knihu najdeš a co si vezmeš.',
        en: 'A friend wants to help you find the book tomorrow. Tell them in German when the library opens, where you will find the book, and what you will bring.',
      },
      criteria: [
        { cs: 'Píšu, že zítra otevírá ve 12:00.', en: 'I say that it opens at 12:00 tomorrow.' },
        {
          cs: 'Posílám kamaráda k informacím v přízemí.',
          en: 'I direct my friend to the information desk on the ground floor.',
        },
        { cs: 'Zmiňuji čtenářský průkaz.', en: 'I mention the library card.' },
      ],
      model:
        'Die Bibliothek öffnet morgen erst um zwölf Uhr. Mein Buch ist an der Information im Erdgeschoss. Ich bringe meinen Bibliotheksausweis mit. Treffen wir uns um zwölf am Eingang?',
      phrases: ['Morgen öffnet … um …', 'Ich brauche meinen …'],
    },
  },
  {
    chapterId: 'chapter-106-civic-services',
    level: 'A2.1',
    listening: {
      title: { cs: 'Změna termínu na úřadě', en: 'A changed appointment' },
      transcript:
        'Guten Tag, hier ist das Bürgeramt. Ihr Termin am Dienstag um neun Uhr muss leider ausfallen. Wir können Ihnen einen neuen Termin am Donnerstag um halb zehn anbieten. Bitte antworten Sie auf unsere E-Mail, wenn Sie kommen können. Das ausgefüllte Formular können Sie mitbringen. Schicken Sie uns bitte keine Ausweiskopie per E-Mail.',
      tasks: [
        {
          focus: 'gist',
          prompt: {
            cs: 'Jaký je hlavní účel zprávy?',
            en: 'What is the main purpose of the message?',
          },
          answer: 'Das Bürgeramt bietet einen Ersatztermin an.',
          distractors: [
            'Das Bürgeramt bestätigt den Dienstagstermin.',
            'Das Bürgeramt lehnt den Antrag ab.',
            'Das Bürgeramt verlangt eine Ausweiskopie per E-Mail.',
          ],
          explanation: {
            cs: 'Původní termín odpadá a úřad nabízí nový. O rozhodnutí o žádosti se nemluví.',
            en: 'The original appointment is cancelled and another is offered. There is no decision about the application.',
          },
        },
        {
          focus: 'detail',
          prompt: {
            cs: 'Co máš udělat, pokud nový termín vyhovuje?',
            en: 'What should you do if the new appointment works?',
          },
          answer: 'Auf die E-Mail antworten.',
          distractors: [
            'Am Dienstag um neun Uhr kommen.',
            'Eine Ausweiskopie per E-Mail schicken.',
            'Das Formular zu Hause lassen.',
          ],
          explanation: {
            cs: 'Termín potvrdíš odpovědí na e-mail. Kopii dokladu zpráva výslovně nechce.',
            en: 'Confirm by replying to the email. The message explicitly says not to email a copy of your ID.',
          },
        },
      ],
    },
    reading: {
      title: { cs: 'Pokyny k jiné návštěvě', en: 'Instructions for another visit' },
      text: 'Ihr Termin: Freitag, 11 Uhr. Bitte bringen Sie den Ausweis und das unterschriebene Formular mit. Wenn Sie nicht kommen können, sagen Sie den Termin bitte online ab.',
      claim: 'Man soll das Formular vor dem Termin unterschreiben.',
      verdict: 'supported',
      explanation: {
        cs: 'Má se přinést unterschriebenes Formular — už podepsaný formulář.',
        en: 'The notice asks you to bring an unterschriebenes Formular: a form that is already signed.',
      },
    },
    writing: {
      prompt: {
        cs: 'Napiš úřadu zdvořilý e-mail. Přijmi nabídnutý čtvrteční termín, potvrď čas a zeptej se, kde získáš formulář.',
        en: 'Write a polite email to the office. Accept the offered Thursday appointment, confirm its time, and ask where to get the form.',
      },
      criteria: [
        { cs: 'Potvrzuji čtvrtek v 9:30.', en: 'I confirm Thursday at 9:30.' },
        { cs: 'Zdvořile se ptám na formulář.', en: 'I politely ask about the form.' },
        {
          cs: 'E-mail má oslovení a závěr; neslibuji poslat kopii dokladu.',
          en: 'The email has a greeting and closing; I do not offer to email a copy of my ID.',
        },
      ],
      model:
        'Guten Tag, vielen Dank für Ihre Nachricht. Ich kann am Donnerstag um halb zehn kommen und bestätige den neuen Termin. Können Sie mir bitte sagen, wo ich das Formular bekomme? Ich möchte es vor dem Termin ausfüllen. Freundliche Grüße, Alex',
      phrases: ['Hiermit bestätige ich …', 'Können Sie mir bitte sagen, wo …?'],
    },
  },
  {
    chapterId: 'chapter-108-cultural-evening',
    level: 'A2.2',
    listening: {
      title: { cs: 'Večer s náhradním plánem', en: 'An evening with another plan' },
      transcript:
        'Hallo Alex, ich habe im Kino angerufen. Der Film um sechs ist schon ausverkauft. Um halb neun gibt es noch Plätze, aber dann fährt mein letzter Bus zu früh. Wie wäre es stattdessen mit dem Konzert im Jugendzentrum? Es beginnt um sieben und kostet acht Euro. Ich kann die Karten bis morgen reservieren. Sag mir bitte heute Abend Bescheid.',
      tasks: [
        {
          focus: 'gist',
          prompt: { cs: 'Co kamarádka navrhuje?', en: 'What does your friend suggest?' },
          answer: 'Ein Konzert statt des Kinobesuchs.',
          distractors: [
            'Den späteren Film im Kino.',
            'Einen Kinobesuch morgen früh.',
            'Den Abend ganz abzusagen.',
          ],
          explanation: {
            cs: 'Místo obou nevyhovujících filmových časů nabízí koncert.',
            en: 'She suggests a concert because neither film time works.',
          },
        },
        {
          focus: 'detail',
          prompt: { cs: 'Do kdy chce tvoji odpověď?', en: 'When does she want your reply?' },
          answer: 'Heute Abend.',
          distractors: ['Morgen Abend.', 'Um halb neun nach dem Film.', 'Erst beim Konzert.'],
          explanation: {
            cs: 'Odpověď chce dnes večer. Do zítřka je lhůta pro rezervaci, nikoli pro tvoji reakci.',
            en: 'She wants your reply this evening. Tomorrow is the reservation deadline, not the requested reply time.',
          },
        },
      ],
    },
    reading: {
      title: { cs: 'Další kulturní akce', en: 'Another cultural event' },
      text: 'Konzert am Sonntag: Beginn 19 Uhr, Einlass 18:30 Uhr. Karten kosten im Vorverkauf acht Euro, an der Abendkasse zehn Euro. Karten können online reserviert werden.',
      claim: 'Für Schülerinnen und Schüler ist der Eintritt kostenlos.',
      verdict: 'not-stated',
      explanation: {
        cs: 'Ceník neuvádí zvláštní podmínky pro studující. Nemůžeme si je domyslet.',
        en: 'The notice gives no special conditions for students. We cannot invent them.',
      },
    },
    writing: {
      prompt: {
        cs: 'Odpověz kamarádce: přijmi koncert, vysvětli, proč se pozdější film nehodí, a navrhni místo i čas setkání před koncertem.',
        en: 'Reply to your friend: accept the concert, explain why the later film does not work, and propose a meeting place and time before the concert.',
      },
      criteria: [
        {
          cs: 'Volím koncert v 19:00 za osm eur.',
          en: 'I choose the concert at 19:00 for eight euros.',
        },
        {
          cs: 'Důvod souvisí s posledním autobusem, ne s cenou filmu.',
          en: 'My reason concerns the last bus, not the film’s price.',
        },
        {
          cs: 'Navrhuji konkrétní setkání a požádám o rezervaci.',
          en: 'I propose a specific meeting and ask for a reservation.',
        },
      ],
      model:
        'Das Konzert im Jugendzentrum klingt gut. Der spätere Film passt nicht, weil du sonst deinen letzten Bus verpasst. Acht Euro sind für mich in Ordnung. Können wir uns um halb sieben vor dem Jugendzentrum treffen? Reservierst du bitte zwei Eintrittskarten?',
      phrases: ['Das passt besser, weil …', 'Wie wäre es mit …?'],
    },
  },
  {
    chapterId: 'chapter-110-workplace-onboarding',
    level: 'B1.1',
    listening: {
      title: { cs: 'První den na brigádě', en: 'Your first day at a part-time job' },
      transcript:
        'Willkommen im Team! Heute zeige ich dir zuerst die Werkstatt. Danach bearbeitest du zusammen mit Mira eine Kundenanfrage. Wenn ein technisches Problem auftaucht, frag bitte Ben. Mira kümmert sich um Termine und Kundenkontakte. Morgen kannst du selbst einen Antwortentwurf schreiben. Bevor du ihn verschickst, muss Mira ihn allerdings prüfen. Die Zugangskarte bekommst du nach unserer Mittagspause.',
      tasks: [
        {
          focus: 'gist',
          prompt: { cs: 'Jak bude zapracování probíhat?', en: 'How will the onboarding work?' },
          answer: 'Schrittweise, zunächst mit Unterstützung.',
          distractors: [
            'Sofort allein und ohne Rückfragen.',
            'Nur durch ein Handbuch zu Hause.',
            'Erst ab nächster Woche im Team.',
          ],
          explanation: {
            cs: 'Nejprve prohlídka, potom práce s Mirou a teprve zítra vlastní návrh ke kontrole.',
            en: 'First a tour, then work with Mira, then your own draft for review tomorrow.',
          },
        },
        {
          focus: 'detail',
          prompt: {
            cs: 'Kdo má před odesláním zkontrolovat návrh odpovědi?',
            en: 'Who must check the draft before it is sent?',
          },
          answer: 'Mira.',
          distractors: ['Ben.', 'Die Kundin.', 'Niemand.'],
          explanation: {
            cs: 'Mira kontroluje odpovědi; Ben pomáhá s technickými problémy.',
            en: 'Mira reviews replies; Ben helps with technical problems.',
          },
        },
      ],
    },
    reading: {
      title: { cs: 'Nový zápis v předávacím sešitu', en: 'A new handover note' },
      text: 'Montag: Nora übernimmt die Kundenanfragen, Deniz prüft die Geräte. Zwei Anfragen sind noch offen. Antworten dürfen erst nach Noras Freigabe verschickt werden. Am Dienstag gibt es um 9 Uhr eine Teambesprechung.',
      claim: 'Deniz muss jede Antwort an die Kundschaft freigeben.',
      verdict: 'contradicted',
      explanation: {
        cs: 'Schválení odpovědí má na starosti Nora, nikoli Deniz. Deniz kontroluje zařízení.',
        en: 'Nora approves replies, not Deniz. Deniz checks the equipment.',
      },
    },
    writing: {
      prompt: {
        cs: 'Sepiš pro dalšího brigádníka krátké předání podle poslechu: kdo s čím pomáhá, co může zítra zkusit sám a co musí před odesláním udělat.',
        en: 'Write a short handover for the next new colleague based on the audio: who helps with what, what they may try independently tomorrow, and what must happen before sending a reply.',
      },
      criteria: [
        {
          cs: 'Správně rozlišuji Miru a Bena.',
          en: 'I distinguish Mira’s and Ben’s responsibilities correctly.',
        },
        {
          cs: 'Samostatný návrh nezaměňuji za povolení odeslat odpověď.',
          en: 'I distinguish drafting independently from permission to send.',
        },
        {
          cs: 'Předání má srozumitelné pořadí kroků.',
          en: 'The handover gives a clear sequence of steps.',
        },
      ],
      model:
        'Während der Einarbeitung hilft dir Mira bei Terminen und Kundenanfragen. Wenn du ein technisches Problem hast, kannst du Ben fragen. Morgen darfst du einen Antwortentwurf selbst schreiben. Schicke ihn aber noch nicht ab: Mira muss ihn zuerst prüfen. Die Zugangskarte bekommst du heute nach der Mittagspause. So kannst du Schritt für Schritt selbstständiger arbeiten.',
      phrases: ['Für … ist … zuständig.', 'Bevor du …, musst du …'],
    },
  },
  {
    chapterId: 'chapter-112-media-literacy',
    level: 'B1.2',
    listening: {
      title: { cs: 'Co se ve škole skutečně změnilo', en: 'What actually changed at school' },
      transcript:
        'In unserer Klassengruppe steht, dass die Schulkantine dauerhaft schließt. Ich habe deshalb im Sekretariat nachgefragt. Die Kantine bleibt nur nächste Woche wegen einer Reparatur geschlossen. Danach soll sie wieder öffnen. Kalte Snacks gibt es während der Reparatur in der Aula. Der Screenshot in der Gruppe stammt vom letzten Jahr und betrifft eine andere Schule. Könntest du die richtige Information bitte weitergeben?',
      tasks: [
        {
          focus: 'gist',
          prompt: { cs: 'Co mluvčí potřebuje?', en: 'What does the speaker need?' },
          answer: 'Eine falsche Meldung in der Klassengruppe korrigieren.',
          distractors: [
            'Die Kantine dauerhaft schließen lassen.',
            'Eine Beschwerde über die Preise schreiben.',
            'Den alten Screenshot weiterverbreiten.',
          ],
          explanation: {
            cs: 'Mluvčí ověřil informaci a žádá o předání opravy do skupiny.',
            en: 'The speaker checked the information and asks you to pass the correction to the group.',
          },
        },
        {
          focus: 'detail',
          prompt: {
            cs: 'Kde informaci ověřil?',
            en: 'Where did the speaker verify the information?',
          },
          answer: 'Im Sekretariat.',
          distractors: [
            'Auf dem alten Screenshot.',
            'Bei einer anderen Schule.',
            'In einer Werbeanzeige.',
          ],
          explanation: {
            cs: 'Ich habe im Sekretariat nachgefragt pojmenovává zdroj. Screenshot se týká jiné školy.',
            en: 'Ich habe im Sekretariat nachgefragt identifies the source. The screenshot concerns a different school.',
          },
        },
      ],
    },
    reading: {
      title: { cs: 'Oznámení o studovně', en: 'A notice about the study room' },
      text: 'Die Schule teilt mit: Der Lernraum bleibt am Donnerstag wegen Wartungsarbeiten geschlossen. Am Freitag ist er wieder regulär geöffnet. Die Bibliothek kann am Donnerstag wie gewohnt genutzt werden.',
      claim: 'Die Bibliothek bleibt am Donnerstag zugänglich.',
      verdict: 'supported',
      explanation: {
        cs: 'Wie gewohnt genutzt znamená běžný provoz knihovny. Omezení se týká studovny.',
        en: 'Wie gewohnt genutzt means the library operates as usual. The restriction applies to the study room.',
      },
    },
    writing: {
      prompt: {
        cs: 'Napiš spolužákům opravu zprávy o jídelně. Uveď ověřený zdroj, skutečné trvání omezení a náhradní možnost. Nikoho za sdílení zesměšňujícím způsobem nekritizuj.',
        en: 'Write a correction about the canteen for your classmates. State the verified source, the actual duration of the closure, and the alternative. Keep the tone respectful toward people who shared the claim.',
      },
      criteria: [
        {
          cs: 'Uvádím sekretariát jako zdroj a omezení na příští týden.',
          en: 'I name the school office as the source and limit the closure to next week.',
        },
        {
          cs: 'Vysvětluji, proč starý screenshot tuto školu nepopisuje.',
          en: 'I explain why the old screenshot does not describe this school.',
        },
        {
          cs: 'Přidávám možnost občerstvení v aule a držím věcný tón.',
          en: 'I include the snacks in the hall and keep a factual tone.',
        },
      ],
      model:
        'Kurze Korrektur zur Kantine: Nach Auskunft des Sekretariats bleibt sie nur nächste Woche wegen einer Reparatur geschlossen. Danach soll sie wieder öffnen. Während der Reparatur gibt es kalte Snacks in der Aula. Der Screenshot stammt vom letzten Jahr und betrifft eine andere Schule. Das Gerücht über eine dauerhafte Schließung stimmt also nicht. Bitte gebt diese Information weiter, damit niemand umsonst zur Kantine geht.',
      phrases: ['Nach Auskunft von …', 'Die Meldung bezieht sich auf …'],
    },
  },
  {
    chapterId: 'chapter-114-project-risk',
    level: 'B2.1',
    listening: {
      title: { cs: 'Porada před školním festivalem', en: 'A meeting before the school festival' },
      transcript:
        'Die Wettervorhersage ist noch unsicher. Wir sollten das Festival deshalb nicht vorschnell absagen, aber auch nicht so tun, als sei Regen ausgeschlossen. Die Sporthalle wäre eine Alternative, sofern wir sie bis Dienstag reservieren. Die Reservierung ist kostenlos; Kosten entstehen erst bei der Nutzung. Am Mittwoch liegen genauere Wetterdaten vor. Ich schlage vor, die Halle jetzt zu sichern und die endgültige Entscheidung am Mittwoch gemeinsam zu treffen. Eine Zusage für gutes Wetter können wir dem Publikum natürlich nicht geben.',
      tasks: [
        {
          focus: 'gist',
          prompt: {
            cs: 'Jaký přístup mluvčí doporučuje?',
            en: 'What approach does the speaker recommend?',
          },
          answer:
            'Eine Alternative offenhalten und später anhand besserer Informationen entscheiden.',
          distractors: [
            'Das Festival sofort endgültig absagen.',
            'Dem Publikum trockenes Wetter garantieren.',
            'Bis Mittwoch ohne Vorbereitung abwarten.',
          ],
          explanation: {
            cs: 'Rezervace drží možnost otevřenou; rozhodnutí má padnout až po aktualizaci předpovědi.',
            en: 'The reservation keeps an option open; the decision follows the updated forecast.',
          },
        },
        {
          focus: 'detail',
          prompt: {
            cs: 'Za jakých okolností vzniknou náklady na halu?',
            en: 'Under what circumstances will the hall cost money?',
          },
          answer: 'Erst wenn die Halle genutzt wird.',
          distractors: [
            'Sobald sie reserviert wird.',
            'Bei jeder Änderung der Wettervorhersage.',
            'Nur wenn das Festival draußen stattfindet.',
          ],
          explanation: {
            cs: 'Mluvčí výslovně rozlišuje bezplatnou rezervaci a placené využití.',
            en: 'The speaker explicitly distinguishes a free reservation from paid use.',
          },
        },
      ],
    },
    reading: {
      title: { cs: 'Nová nabídka ozvučení', en: 'A new sound-system offer' },
      text: 'Die Anlage kann bis Montag unverbindlich reserviert werden. Die Lieferzeit wird nach Eingang der Bestellung bestätigt. Im Angebot sind Aufbau und Abholung enthalten. Angaben zu einer Versicherung enthält das Angebot nicht.',
      claim: 'Eine Versicherung gegen Schäden ist im Preis enthalten.',
      verdict: 'not-stated',
      explanation: {
        cs: 'O pojištění nabídka nic neříká. To nedokazuje ani jeho zahrnutí, ani jeho vyloučení.',
        en: 'The offer says nothing about insurance. That proves neither its inclusion nor its exclusion.',
      },
    },
    writing: {
      prompt: {
        cs: 'Předej návrh z porady organizátorům, kteří chyběli. Doporuč další krok, vysvětli rozdíl mezi rezervací a využitím a určete, kdy padne rozhodnutí.',
        en: 'Pass the meeting proposal to organisers who were absent. Recommend the next step, explain the difference between reservation and use, and specify when the decision will be made.',
      },
      criteria: [
        {
          cs: 'Zachovávám rezervaci do úterý a rozhodnutí ve středu.',
          en: 'I preserve the Tuesday reservation deadline and Wednesday decision.',
        },
        {
          cs: 'Rozlišuji bezplatnou rezervaci od případných nákladů na využití.',
          en: 'I distinguish free reservation from possible costs of use.',
        },
        {
          cs: 'Nejistou předpověď nepodávám jako jistotu; doporučení zdůvodňuji.',
          en: 'I do not present an uncertain forecast as certain; I justify my recommendation.',
        },
      ],
      model:
        'Wir sollten die Sporthalle vorbeugend bis Dienstag kostenlos reservieren, damit uns bei Regen eine Alternative zur Verfügung steht. Kosten entstehen laut Besprechung erst, wenn wir die Halle tatsächlich nutzen. Die Wettervorhersage ist derzeit unsicher; eine sofortige Absage wäre deshalb ebenso voreilig wie eine Garantie für trockenes Wetter. Am Mittwoch erhalten wir genauere Daten und entscheiden gemeinsam über den Veranstaltungsort. So halten wir eine Möglichkeit offen, ohne die Nutzung schon verbindlich festzulegen. Dem Publikum können wir diesen Ablauf transparent mitteilen.',
      phrases: ['Für den Fall, dass …', 'Die Entscheidung hängt davon ab, ob …'],
    },
  },
  {
    chapterId: 'chapter-116-accessible-city',
    level: 'B2.2',
    listening: {
      title: { cs: 'Cesta na výstavu', en: 'Getting to an exhibition' },
      transcript:
        'Zum Zugang zur Ausstellung gibt es eine Änderung: Der Haupteingang ist wegen Bauarbeiten nur über Stufen erreichbar. Über den Innenhof besteht dagegen ein stufenloser Zugang. Dieser Weg ist ungefähr zweihundert Meter länger. Die Beschilderung fehlt noch; das Museum hat zugesagt, sie bis Freitag anzubringen. Ob die Bauarbeiten nächste Woche abgeschlossen werden, konnte uns niemand bestätigen. Für unseren Besuch am Samstag sollten wir daher den Innenhof einplanen und vorher prüfen, ob die angekündigten Schilder tatsächlich stehen.',
      tasks: [
        {
          focus: 'gist',
          prompt: {
            cs: 'Jaký praktický závěr zpráva přináší?',
            en: 'What practical conclusion does the message offer?',
          },
          answer: 'Für den Besuch den stufenlosen Weg durch den Innenhof einplanen.',
          distractors: [
            'Das Museum ist für alle Besucher vollständig geschlossen.',
            'Der Haupteingang ist bereits wieder stufenlos.',
            'Ein Besuch ist erst nach Ende aller Bauarbeiten möglich.',
          ],
          explanation: {
            cs: 'Použitelná alternativa existuje, ale je delší a zatím není označena.',
            en: 'A usable alternative exists, but it is longer and is not yet signposted.',
          },
        },
        {
          focus: 'detail',
          prompt: {
            cs: 'Co muzeum slíbilo do pátku?',
            en: 'What did the museum promise by Friday?',
          },
          answer: 'Den Weg durch den Innenhof auszuschildern.',
          distractors: [
            'Alle Bauarbeiten abzuschließen.',
            'Den Weg um zweihundert Meter zu verkürzen.',
            'Den Haupteingang dauerhaft zu schließen.',
          ],
          explanation: {
            cs: 'Příslib se týká označení cesty. Konec stavebních prací potvrzen nebyl.',
            en: 'The promise concerns signs. The completion of construction was not confirmed.',
          },
        },
      ],
    },
    reading: {
      title: { cs: 'Aktualizace dopravního podniku', en: 'A transport operator’s update' },
      text: 'Der Aufzug am Westausgang ist außer Betrieb. Ein stufenloser Zugang ist am Ostausgang möglich. Die Reparaturfirma prüft den Schaden am Montag; ein Termin für die Wiederinbetriebnahme steht noch nicht fest.',
      claim: 'Der Aufzug wird am Montag garantiert wieder in Betrieb genommen.',
      verdict: 'contradicted',
      explanation: {
        cs: 'Na pondělí je plánována prohlídka závady. Zprovoznění nemá stanovený termín, natož záruku.',
        en: 'Monday is the inspection date. There is no confirmed reopening date, let alone a guarantee.',
      },
    },
    writing: {
      prompt: {
        cs: 'Napiš skupině návštěvníků praktické doporučení podle poslechu. Zachovej rozdíl mezi dostupnou cestou, slíbeným značením a nepotvrzeným koncem prací. Uveď, co před sobotou ověříš.',
        en: 'Write practical guidance for the visiting group based on the audio. Distinguish the available route, promised signs, and unconfirmed end of construction. Say what you will check before Saturday.',
      },
      criteria: [
        {
          cs: 'Uvádím vnitřní dvůr a přibližně 200 metrů navíc.',
          en: 'I mention the courtyard and approximately 200 extra metres.',
        },
        {
          cs: 'Páteční značení nezaměňuji s opravou hlavního vstupu.',
          en: 'I do not confuse Friday’s signs with restoration of the main entrance.',
        },
        {
          cs: 'Navrhuji ověření značení a píšu pro potřeby návštěvníků.',
          en: 'I propose checking the signs and write for the visitors’ needs.',
        },
      ],
      model:
        'Für unseren Museumsbesuch am Samstag sollten wir den stufenlosen Zugang über den Innenhof nutzen. Gegenüber dem Haupteingang ist der Weg ungefähr zweihundert Meter länger; plant dafür bitte zusätzliche Zeit ein. Das Museum hat angekündigt, die fehlenden Schilder bis Freitag anzubringen. Daraus lässt sich jedoch nicht schließen, dass auch die Bauarbeiten am Haupteingang beendet sein werden. Ein Abschlussdatum ist bislang nicht bestätigt. Ich werde vor unserem Besuch nachfragen, ob die Beschilderung tatsächlich angebracht wurde, und euch den aktuellen Stand mitteilen. Wer den längeren Weg nicht einplanen kann, sollte das frühzeitig wissen.',
      phrases: ['Nach bisherigem Stand …', 'Zugesagt wurde lediglich, dass …'],
    },
  },
  {
    chapterId: 'chapter-118-science-communication',
    level: 'C1.1',
    listening: {
      title: { cs: 'Výzkumnice ve školním podcastu', en: 'A researcher on the school podcast' },
      transcript:
        'Unsere Untersuchung verglich zwei freiwillige Lerngruppen an einer einzigen Schule. Die Gruppe, die regelmäßig gemeinsam übte, schnitt im Abschlusstest besser ab. Das ist ein interessanter Zusammenhang, aber noch kein Beleg dafür, dass allein das gemeinsame Üben den Unterschied verursacht hat. Wir haben weder die Vorkenntnisse noch die Motivation systematisch erfasst. Die Schlagzeile, Gruppenarbeit mache jeden Menschen automatisch erfolgreicher, geht daher deutlich über unsere Ergebnisse hinaus. Wir möchten die Untersuchung mit einer größeren Stichprobe und einer zufälligen Zuteilung wiederholen. Bis dahin ist das Ergebnis ein Anlass für weitere Fragen, keine allgemeine Erfolgsgarantie.',
      tasks: [
        {
          focus: 'gist',
          prompt: {
            cs: 'Jak výzkumnice hodnotí význam zjištění?',
            en: 'How does the researcher assess the finding?',
          },
          answer: 'Als interessanten, aber begrenzt aussagekräftigen Zusammenhang.',
          distractors: [
            'Als universellen Beweis für den Erfolg von Gruppenarbeit.',
            'Als Nachweis, dass Motivation keinen Einfluss hat.',
            'Als Grund, jede weitere Untersuchung abzubrechen.',
          ],
          explanation: {
            cs: 'Zjištění uznává, ale odmítá všeobecnou příčinnou interpretaci a žádá další výzkum.',
            en: 'She acknowledges the finding but rejects a universal causal interpretation and calls for further research.',
          },
        },
        {
          focus: 'detail',
          prompt: {
            cs: 'Který postup teprve plánuje pro další studii?',
            en: 'Which procedure is only planned for the next study?',
          },
          answer: 'Eine zufällige Zuteilung zu den Gruppen.',
          distractors: [
            'Die Beschränkung auf eine einzige Schule als endgültigen Standard.',
            'Die Veröffentlichung einer Erfolgsgarantie.',
            'Den Verzicht auf eine größere Stichprobe.',
          ],
          explanation: {
            cs: 'Náhodné rozdělení je součástí plánovaného opakování, nikoli již provedeného výzkumu.',
            en: 'Random assignment is part of the planned replication, not the completed study.',
          },
        },
      ],
    },
    reading: {
      title: { cs: 'Jiná výzkumná zpráva', en: 'A different research report' },
      text: 'Ein Pilotprojekt erprobte längere Bibliotheksöffnungszeiten an zwei Standorten. Die Zahl der Besuche nahm zu. Eine Kontrollgruppe gab es nicht; zugleich startete eine Werbekampagne. Ob sich die Ergebnisse auf andere Städte übertragen lassen, wurde nicht untersucht.',
      claim:
        'Die Studie belegt, dass die längeren Öffnungszeiten allein die zusätzlichen Besuche verursacht haben.',
      verdict: 'contradicted',
      explanation: {
        cs: 'Bez kontrolní skupiny a při souběžné kampani zpráva výlučnou příčinu nedokládá. Tvrdí nárůst návštěv, nikoli takový důkaz.',
        en: 'Without a control group and with a concurrent campaign, the report does not establish an exclusive cause. It reports an increase, not that proof.',
      },
    },
    writing: {
      prompt: {
        cs: 'Pro školní časopis napiš srozumitelné shrnutí rozhovoru. Odděl pozorování, možné vysvětlení a omezení. Připiš hodnocení výzkumnici a zakonči tím, co by měla objasnit další studie.',
        en: 'Write an accessible summary of the interview for the school magazine. Separate the observation, possible explanation, and limitations. Attribute the assessment to the researcher and finish with what a further study should clarify.',
      },
      criteria: [
        {
          cs: 'Zachovávám dobrovolnou účast, jedinou školu a neznámé vstupní rozdíly.',
          en: 'I preserve voluntary participation, the single school, and unknown initial differences.',
        },
        {
          cs: 'Vyšší výsledek nezaměňuji s prokázanou příčinou pro všechny.',
          en: 'I do not turn a higher score into a proven cause applying to everyone.',
        },
        {
          cs: 'Uvádím zdroj tvrzení a vysvětluji další výzkum běžnému čtenáři.',
          en: 'I attribute the claim and explain the planned research to a general reader.',
        },
      ],
      model:
        'Die Kernaussage lautet: Gemeinsames Üben könnte beim Lernen helfen, doch die vorgestellte Untersuchung liefert noch keine Erfolgsgarantie. Verglichen wurden zwei freiwillige Lerngruppen an einer Schule. Die regelmäßig gemeinsam übende Gruppe erreichte im Abschlusstest bessere Ergebnisse. Die Forscherin betont jedoch, dass weder Vorkenntnisse noch Motivation systematisch erfasst worden seien. Der Unterschied könnte deshalb auch mit Voraussetzungen zusammenhängen, die schon vor dem Üben bestanden. Die Behauptung, Gruppenarbeit mache jeden Menschen automatisch erfolgreicher, wäre durch diese Daten nicht gedeckt. Geplant ist eine größere Untersuchung mit zufälliger Gruppenzuteilung. Sie soll dazu beitragen, den Einfluss des gemeinsamen Übens besser von anderen möglichen Erklärungen zu unterscheiden.',
      phrases: [
        'Die Forscherin weist darauf hin, dass …',
        'Aus dem Befund lässt sich noch nicht ableiten, dass …',
      ],
    },
  },
  {
    chapterId: 'chapter-120-crisis-communication',
    level: 'C1.2',
    listening: {
      title: { cs: 'Interní porada při výpadku', en: 'An internal outage briefing' },
      transcript:
        'Stand vierzehn Uhr: Unser Anmeldeportal ist seit dreizehn Uhr vierzig nicht erreichbar. Die Technik untersucht die Ursache. Hinweise auf einen Datenabfluss sind bisher nicht bestätigt; ausgeschlossen werden kann er zum jetzigen Zeitpunkt ebenfalls nicht. Bereits bestätigte Anmeldungen behalten ihre Gültigkeit. Bitte raten Sie den Teilnehmenden deshalb nicht, sich erneut anzumelden. Das könnte zu doppelten Einträgen führen, sobald das System wieder läuft. Um fünfzehn Uhr veröffentlichen wir ein weiteres Update, auch wenn die Untersuchung dann noch andauern sollte. Einen Zeitpunkt für die vollständige Wiederherstellung können wir derzeit nicht verlässlich nennen.',
      tasks: [
        {
          focus: 'gist',
          prompt: {
            cs: 'Jaký komunikační postup porada stanovuje?',
            en: 'What communication approach does the briefing establish?',
          },
          answer:
            'Gesicherte Fakten, offene Fragen und einen nächsten Informationszeitpunkt klar trennen.',
          distractors: [
            'Die Ursache als geklärt darstellen, um Nachfragen zu vermeiden.',
            'Bis zum Ende der Untersuchung jede Information zurückhalten.',
            'Allen Teilnehmenden eine sofortige Neuanmeldung empfehlen.',
          ],
          explanation: {
            cs: 'Zpráva odděluje potvrzený výpadek, nejistotu a čas další informace.',
            en: 'The message separates the confirmed outage, uncertainty, and the next update time.',
          },
        },
        {
          focus: 'detail',
          prompt: { cs: 'Co je slíbeno na 15:00?', en: 'What is promised for 15:00?' },
          answer: 'Ein weiteres Update, auch bei laufender Untersuchung.',
          distractors: [
            'Die garantierte Wiederherstellung des Portals.',
            'Der sichere Ausschluss eines Datenabflusses.',
            'Die Löschung aller bisherigen Anmeldungen.',
          ],
          explanation: {
            cs: 'Čas dalšího sdělení je pevný; termín obnovení služby zatím nelze spolehlivě určit.',
            en: 'The next update time is fixed; a reliable restoration time is still unavailable.',
          },
        },
      ],
    },
    reading: {
      title: { cs: 'Aktualizace z jiného incidentu', en: 'An update on a different incident' },
      text: 'Update, 16 Uhr: Der Versand von Bestätigungen ist wieder möglich. Einige ältere Nachrichten werden noch nachgeliefert. Die Anmeldung selbst war nicht betroffen. Wir prüfen weiterhin, warum sich die Nachrichten verzögert haben. Ein Abschlussbericht ist für nächste Woche vorgesehen.',
      claim: 'Die genaue technische Ursache der Verzögerung wird in diesem Update genannt.',
      verdict: 'contradicted',
      explanation: {
        cs: 'Zpráva příčinu neuvádí a říká, že ji dál zkoumá. Obnovení odesílání neznamená dokončenou analýzu.',
        en: 'The update does not name the cause and says investigation continues. Restored delivery does not mean the analysis is complete.',
      },
    },
    writing: {
      prompt: {
        cs: 'Z interní porady vytvoř veřejné oznámení účastníkům. Napiš, co funguje a co ne, co se ještě neví, jak mají postupovat a kdy dostanou další zprávu. Vynech interní pokyny, které pro ně nejsou potřebné.',
        en: 'Turn the internal briefing into a public notice for participants. State what works and what does not, what remains unknown, what people should do, and when they will receive another update. Omit internal instructions they do not need.',
      },
      criteria: [
        {
          cs: 'Zachovávám čas výpadku 13:40 a platnost potvrzených přihlášek.',
          en: 'I preserve the outage time of 13:40 and the validity of confirmed registrations.',
        },
        {
          cs: 'Nezaručuji bezpečnost dat ani termín opravy bez podkladu.',
          en: 'I do not guarantee data security or a repair time without evidence.',
        },
        {
          cs: 'Nedoporučuji novou registraci a slibuji pouze aktualizaci v 15:00.',
          en: 'I advise against registering again and promise only an update at 15:00.',
        },
      ],
      model:
        'Nach aktuellem Informationsstand ist unser Anmeldeportal seit 13:40 Uhr nicht erreichbar. Die Ursache wird derzeit untersucht. Ein möglicher Datenabfluss ist bislang weder bestätigt noch ausgeschlossen; wir informieren Sie, sobald hierzu gesicherte Erkenntnisse vorliegen. Bereits bestätigte Anmeldungen bleiben gültig. Bitte melden Sie sich deshalb nicht erneut an und bewahren Sie Ihre Bestätigung auf. Eine erneute Anmeldung könnte nach der Wiederherstellung zu doppelten Einträgen führen. Um 15 Uhr veröffentlichen wir den nächsten Stand, auch wenn die Untersuchung bis dahin noch nicht abgeschlossen sein sollte. Einen verlässlichen Zeitpunkt für die vollständige Wiederherstellung können wir aktuell nicht nennen. Vielen Dank für Ihre Geduld.',
      phrases: ['Nach gesichertem Stand …', 'Unabhängig vom Fortgang der Untersuchung …'],
    },
  },
];

export function courseCommunicationForChapter(chapterId: string): CourseCommunication | undefined {
  return courseCommunications.find((item) => item.chapterId === chapterId);
}
