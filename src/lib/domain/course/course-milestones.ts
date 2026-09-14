import type { DetailedCefrLevel } from '../types.ts';

type LearnerCopy = { cs: string; en: string };

export type CourseMilestoneTask = {
  prompt: LearnerCopy;
  answer: string;
  distractors: [string, string, string];
  explanation: LearnerCopy;
};

export type CourseMilestone = {
  chapterId: string;
  level: DetailedCefrLevel;
  title: LearnerCopy;
  goal: LearnerCopy;
  scene: string;
  tasks: [CourseMilestoneTask, CourseMilestoneTask];
};

/** New situations at the end of each band. All alternatives are grammatical:
 * learners must understand the information and their communication goal. */
export const courseMilestones: readonly CourseMilestone[] = [
  {
    chapterId: 'chapter-102-hobby-meetup',
    level: 'A1.1',
    title: { cs: 'Tvůj první herní večer', en: 'Your first games evening' },
    goal: {
      cs: 'Vyber vhodnou akci, představ se a ověř místo setkání.',
      en: 'Choose an activity, introduce yourself, and check where to meet.',
    },
    scene:
      'Freizeitgruppe: Spieleabend am Freitag um 18 Uhr, Raum 4. Schnupperkurs in der Kletterhalle am Samstag um 10 Uhr. Du hast am Freitag Zeit.',
    tasks: [
      {
        prompt: {
          cs: 'Chceš přijít v den, kdy máš čas. Co napíšeš skupině?',
          en: 'You want to come on your free day. What do you write to the group?',
        },
        answer: 'Hallo, ich bin Alex. Ich möchte am Freitag beim Spieleabend mitspielen.',
        distractors: [
          'Hallo, ich bin Alex. Ich komme am Samstag zum Schnupperkurs.',
          'Hallo, ich bin Alex. Ich komme am Freitag um zehn Uhr in die Kletterhalle.',
          'Hallo, ich bin Alex. Ich möchte am Samstag beim Spieleabend mitspielen.',
        ],
        explanation: {
          cs: 'Čas máš v pátek a právě tehdy se koná herní večer. Zpráva spojuje představení s konkrétním přáním.',
          en: 'You are free on Friday, when the games evening takes place. The message introduces you and says what you want to do.',
        },
      },
      {
        prompt: {
          cs: 'Organizátorka píše „Raum 4“. Kterou otázkou ověříš místo?',
          en: 'The organiser writes “Raum 4”. Which question checks the location?',
        },
        answer: 'Ist der Spieleabend in Raum vier?',
        distractors: [
          'Kostet der Spieleabend vier Euro?',
          'Beginnt der Spieleabend um vier Uhr?',
          'Kommen vier Personen zum Spieleabend?',
        ],
        explanation: {
          cs: 'Raum označuje místnost. Číslo čtyři tu není cena, čas ani počet účastníků.',
          en: 'Raum means room. Four is the room number, not a price, time, or number of participants.',
        },
      },
    ],
  },
  {
    chapterId: 'chapter-104-library-services',
    level: 'A1.2',
    title: { cs: 'Kniha na další týden', en: 'Keeping a book for another week' },
    goal: {
      cs: 'Najdi správné místo a požádej o prodloužení výpůjčky.',
      en: 'Find the right place and ask to extend a loan.',
    },
    scene:
      'Bibliothek: Die Rückgabe ist im Erdgeschoss. Der Lesesaal ist im ersten Stock. Die Leihfrist für dein Buch endet am Montag. Du möchtest es bis Freitag behalten.',
    tasks: [
      {
        prompt: {
          cs: 'Knihu ještě potřebuješ. Na co se zeptáš?',
          en: 'You still need the book. What do you ask?',
        },
        answer: 'Kann ich die Leihfrist bis Freitag verlängern?',
        distractors: [
          'Kann ich das Buch am Montag zurückgeben?',
          'Wo finde ich den Lesesaal?',
          'Ist der Bibliotheksausweis gebührenfrei?',
        ],
        explanation: {
          cs: 'Potřebuješ změnit konec výpůjčky z pondělí na pátek. Verlängern znamená prodloužit.',
          en: 'You need to move the end of the loan from Monday to Friday. Verlängern means to extend.',
        },
      },
      {
        prompt: {
          cs: 'Prodloužení není možné. Kam půjdeš knihu vrátit?',
          en: 'An extension is not possible. Where do you go to return the book?',
        },
        answer: 'Ich gehe zur Rückgabe im Erdgeschoss.',
        distractors: [
          'Ich gehe zum Lesesaal im ersten Stock.',
          'Ich gehe zur Rückgabe im ersten Stock.',
          'Ich gehe zum Lesesaal im Erdgeschoss.',
        ],
        explanation: {
          cs: 'Pokyn uvádí vracení v přízemí. Čítárna v prvním patře slouží k jiné činnosti.',
          en: 'Returns are on the ground floor. The reading room upstairs serves a different purpose.',
        },
      },
    ],
  },
  {
    chapterId: 'chapter-106-civic-services',
    level: 'A2.1',
    title: { cs: 'Na úřad s připravenými doklady', en: 'Arriving with the right documents' },
    goal: {
      cs: 'Vyčti podmínky z potvrzení a zdvořile zjisti, co ti chybí.',
      en: 'Read the requirements in a confirmation and politely ask about a missing item.',
    },
    scene:
      'Terminbestätigung: Bürgeramt, Dienstag, 9:30 Uhr. Bitte bringen Sie Ihren Ausweis und das ausgefüllte Formular mit. Sie möchten eine Meldebescheinigung beantragen. Das Formular fehlt Ihnen noch.',
    tasks: [
      {
        prompt: {
          cs: 'Co je potřeba před návštěvou ještě zařídit?',
          en: 'What do you still need to do before the appointment?',
        },
        answer: 'Ich muss das Formular besorgen und ausfüllen.',
        distractors: [
          'Ich muss den Termin für Mittwoch bestätigen.',
          'Ich muss die Meldebescheinigung mitbringen.',
          'Ich muss erst um halb zehn einen Termin buchen.',
        ],
        explanation: {
          cs: 'Termín už máš a o potvrzení teprve žádáš. Chybí ti formulář, který má být vyplněný.',
          en: 'The appointment is already booked, and the certificate is what you are applying for. You still need the completed form.',
        },
      },
      {
        prompt: {
          cs: 'Kterou otázkou získáš chybějící formulář?',
          en: 'Which question helps you get the missing form?',
        },
        answer: 'Können Sie mir sagen, wo ich das Formular bekommen kann?',
        distractors: [
          'Können Sie mir sagen, ob das Bürgeramt am Mittwoch geöffnet ist?',
          'Können Sie mir sagen, wann ich meinen Ausweis beantragt habe?',
          'Können Sie mir sagen, warum mein Termin abgesagt wurde?',
        ],
        explanation: {
          cs: 'Otázka míří na chybějící dokument. Ve vložené otázce s wo stojí kann na konci.',
          en: 'The question asks about the missing document. In the embedded question with wo, kann comes last.',
        },
      },
    ],
  },
  {
    chapterId: 'chapter-108-cultural-evening',
    level: 'A2.2',
    title: { cs: 'Večer, který stihnete', en: 'An evening you can make' },
    goal: {
      cs: 'Porovnej možnosti, domluv plán a vysvětli důvod.',
      en: 'Compare options, agree on a plan, and explain the reason.',
    },
    scene:
      'Theater: Die Vorstellung um 18 Uhr ist ausverkauft. Für 20 Uhr gibt es noch Eintrittskarten. Einlass ist jeweils 30 Minuten vorher. Deine Freundin kann ab 19 Uhr kommen.',
    tasks: [
      {
        prompt: {
          cs: 'Který plán vyhovuje oběma a nabídce divadla?',
          en: 'Which plan works for both of you and the available tickets?',
        },
        answer: 'Wir buchen für 20 Uhr und treffen uns um 19:30 Uhr beim Einlass.',
        distractors: [
          'Wir buchen für 18 Uhr und treffen uns um 17:30 Uhr.',
          'Wir buchen für 19 Uhr und treffen uns um 18:30 Uhr.',
          'Wir buchen für 20 Uhr und kommen erst um 20:30 Uhr.',
        ],
        explanation: {
          cs: 'Volné vstupenky jsou na 20:00. Vstup začíná v 19:30 a kamarádka už může přijít.',
          en: 'Tickets are available for 20:00. Admission starts at 19:30, when your friend is available.',
        },
      },
      {
        prompt: {
          cs: 'Jak kamarádce vysvětlíš volbu pozdějšího představení?',
          en: 'How do you explain choosing the later performance?',
        },
        answer: 'Wir nehmen die spätere Vorstellung, weil die frühere ausverkauft ist.',
        distractors: [
          'Wir nehmen die spätere Vorstellung, weil sie schon ausverkauft ist.',
          'Wir nehmen die frühere Vorstellung, weil du ab 19 Uhr Zeit hast.',
          'Wir nehmen die spätere Vorstellung, weil das Theater erst um 20 Uhr öffnet.',
        ],
        explanation: {
          cs: 'Věta správně pojmenovává důvod: dřívější představení je vyprodané. Po weil je ist na konci.',
          en: 'The sentence gives the actual reason: the earlier performance is sold out. After weil, ist comes last.',
        },
      },
    ],
  },
  {
    chapterId: 'chapter-110-workplace-onboarding',
    level: 'B1.1',
    title: { cs: 'Předání bez ztraceného úkolu', en: 'A handover with no missing task' },
    goal: {
      cs: 'Vyjasni odpovědnost a navrhni postup při neúplném předání.',
      en: 'Clarify responsibility and propose a step when a handover is incomplete.',
    },
    scene:
      'Übergabe: Lea ist für Kundenanfragen zuständig. Omar übernimmt technische Probleme. Im Übergabeprotokoll fehlt die Antwort an eine Kundin. Du bist in der Einarbeitung und darfst noch keine Antworten ohne Aufsicht senden.',
    tasks: [
      {
        prompt: { cs: 'Na koho se obrátíš a proč?', en: 'Who do you contact, and why?' },
        answer: 'Ich frage Lea, die für Kundenanfragen zuständig ist.',
        distractors: [
          'Ich frage Omar, der alle Kundenanfragen übernimmt.',
          'Ich sende die Antwort ohne Rückfrage selbst.',
          'Ich warte bis zum Ende der Einarbeitung und lasse die Anfrage liegen.',
        ],
        explanation: {
          cs: 'Lea má zákaznické dotazy na starosti. Vztažná věta přesně vysvětluje, proč se obracíš právě na ni.',
          en: 'Lea handles customer enquiries. The relative clause explains exactly why she is the right contact.',
        },
      },
      {
        prompt: {
          cs: 'Jak navrhneš další krok a dodržíš pravidla zapracování?',
          en: 'How do you propose a next step while following the onboarding rules?',
        },
        answer: 'Ich bereite einen Entwurf vor, um die Antwort mit Lea abzustimmen.',
        distractors: [
          'Ich schicke die Antwort sofort, um Lea nicht zu stören.',
          'Ich lösche den Eintrag, um das Protokoll zu verkürzen.',
          'Ich leite alle technischen Probleme an Lea weiter.',
        ],
        explanation: {
          cs: 'Návrh připravíš a konzultuješ s odpovědnou osobou. Um … zu vyjadřuje účel přípravy.',
          en: 'You prepare a draft and check it with the responsible person. Um … zu expresses the purpose of preparing it.',
        },
      },
    ],
  },
  {
    chapterId: 'chapter-112-media-literacy',
    level: 'B1.2',
    title: { cs: 'Než zprávu pošleš dál', en: 'Before you share the story' },
    goal: {
      cs: 'Porovnej nadpis se zdrojem a shrň, co zpráva skutečně říká.',
      en: 'Compare a headline with its source and summarise what the story actually says.',
    },
    scene:
      'Überschrift: „Schule verbietet alle Handys!“ Die verlinkte Mitteilung der Schule sagt: Ab Montag bleiben Handys während der Prüfungen in der Tasche. In den Pausen ändert sich nichts. Ein alter Screenshot nennt dagegen ein Verbot im ganzen Gebäude.',
    tasks: [
      {
        prompt: {
          cs: 'Který zdroj nejlépe ověří současné pravidlo?',
          en: 'Which source best verifies the current rule?',
        },
        answer: 'Ich prüfe die aktuelle Mitteilung der Schule als Primärquelle.',
        distractors: [
          'Ich übernehme den alten Screenshot, weil er kürzer ist.',
          'Ich verlasse mich nur auf die Überschrift.',
          'Ich zähle, wie oft das Gerücht geteilt wurde.',
        ],
        explanation: {
          cs: 'Aktuální školní sdělení je přímý zdroj pravidla. Starší obrázek ani četnost sdílení jeho znění neověří.',
          en: 'The current school notice is the direct source of the rule. An old screenshot or the number of shares does not establish its wording.',
        },
      },
      {
        prompt: {
          cs: 'Jak zprávu shrneš bez přehánění?',
          en: 'How do you summarise the story without exaggerating?',
        },
        answer:
          'Während der Prüfungen bleiben Handys in der Tasche; in den Pausen gilt die bisherige Regel.',
        distractors: [
          'Ab Montag sind Handys im ganzen Schulgebäude verboten.',
          'Die Schule hat alle bisherigen Handyregeln aufgehoben.',
          'Die neue Regel gilt nur in den Pausen.',
        ],
        explanation: {
          cs: 'Shrnutí zachovává rozsah i čas pravidla. Nadpis rozšířil omezení ze zkoušek na celou školu.',
          en: 'The summary preserves the scope and timing of the rule. The headline expanded a restriction during exams to the entire school.',
        },
      },
    ],
  },
  {
    chapterId: 'chapter-114-project-risk',
    level: 'B2.1',
    title: { cs: 'Festival s náhradním plánem', en: 'A festival with a backup plan' },
    goal: {
      cs: 'Rozliš riziko od jistoty a stanov podmínku pro náhradní postup.',
      en: 'Distinguish a risk from a certainty and set a condition for a backup plan.',
    },
    scene:
      'Für das Schulfestival könnte die Tonanlage verspätet eintreffen. Eine Ersatzanlage kann bis Mittwoch kostenlos reserviert werden; danach ist sie nicht mehr verfügbar. Die Lieferung wird am Donnerstag bestätigt. Das Team will den möglichen Engpass abfedern.',
    tasks: [
      {
        prompt: {
          cs: 'Které opatření zachová možnost náhradního řešení?',
          en: 'Which measure keeps the backup option available?',
        },
        answer:
          'Wir reservieren die Ersatzanlage bis Mittwoch und prüfen am Donnerstag den Lieferstatus.',
        distractors: [
          'Wir warten bis Donnerstag und reservieren erst nach der Bestätigung.',
          'Wir sagen das Festival sofort ab, weil eine Verspätung feststeht.',
          'Wir streichen die Tonanlage aus der Planung und warten ab.',
        ],
        explanation: {
          cs: 'Rezervační lhůta končí před potvrzením dodávky. Bezplatná rezervace ponechá týmu možnost reagovat.',
          en: 'The reservation deadline comes before delivery confirmation. A free reservation keeps the team able to respond.',
        },
      },
      {
        prompt: {
          cs: 'Jak přesně popíšeš podmínku pro použití náhrady?',
          en: 'How do you state the condition for using the backup?',
        },
        answer:
          'Sollte die Lieferung ausfallen, würden wir die reservierte Ersatzanlage einsetzen.',
        distractors: [
          'Da die Lieferung bereits ausgefallen ist, setzen wir die Ersatzanlage ein.',
          'Die Ersatzanlage beweist, dass die ursprüngliche Lieferung pünktlich kommt.',
          'Wir setzen die Ersatzanlage nur ein, wenn beide Anlagen pünktlich eintreffen.',
        ],
        explanation: {
          cs: 'Sollte … würden vyjadřuje možnou budoucí situaci. Zpoždění zatím není potvrzený fakt.',
          en: 'Sollte … würden expresses a possible future situation. A delivery failure is not yet a confirmed fact.',
        },
      },
    ],
  },
  {
    chapterId: 'chapter-116-accessible-city',
    level: 'B2.2',
    title: { cs: 'Trasa, kterou lze opravdu použít', en: 'A route people can actually use' },
    goal: {
      cs: 'Popiš překážku a požaduj konkrétní nápravu s termínem.',
      en: 'Describe a barrier and request a concrete remedy with a deadline.',
    },
    scene:
      'Am Bahnhof ist der Aufzug am Nordzugang bis Freitag außer Betrieb. Der Südzugang ist stufenlos, aber nicht ausgeschildert. Eine Nutzergruppe bittet die Stadt um eine kurzfristige Lösung und eine verlässliche Information zur Reparatur.',
    tasks: [
      {
        prompt: {
          cs: 'Které oznámení umožní cestujícím rozhodnout se podle skutečného stavu?',
          en: 'Which notice lets travellers make a decision based on the actual situation?',
        },
        answer:
          'Wegen des Aufzugsausfalls ist der Nordzugang nicht stufenlos nutzbar; der Südzugang bietet eine stufenlose Alternative.',
        distractors: [
          'Der Bahnhof ist bis Freitag vollständig geschlossen.',
          'Alle Zugänge sind trotz des Aufzugsausfalls stufenlos nutzbar.',
          'Der Südzugang ist gesperrt; bitte nutzen Sie den Nordzugang.',
        ],
        explanation: {
          cs: 'Oznámení vymezuje postižený vstup a uvádí použitelnou alternativu. Nepřenáší závadu na celé nádraží.',
          en: 'The notice identifies the affected entrance and a usable alternative. It does not generalise the fault to the whole station.',
        },
      },
      {
        prompt: {
          cs: 'Jak požádáš o nápravu, jejíž splnění půjde ověřit?',
          en: 'How do you request a remedy whose completion can be checked?',
        },
        answer:
          'Bitte kennzeichnen Sie den Südzugang bis morgen und bestätigen Sie den vorgesehenen Reparaturtermin.',
        distractors: [
          'Bitte verbessern Sie die Situation irgendwann.',
          'Bitte bestätigen Sie, dass es keinerlei Einschränkungen gibt.',
          'Bitte entfernen Sie alle Hinweise, bis der Aufzug repariert ist.',
        ],
        explanation: {
          cs: 'Požadavek obsahuje konkrétní opatření, termín a informaci k opravě. Neslibuje datum dokončení, které zatím není potvrzené.',
          en: 'The request specifies an action, a deadline, and information about the repair. It does not promise an unconfirmed completion date.',
        },
      },
    ],
  },
  {
    chapterId: 'chapter-118-science-communication',
    level: 'C1.1',
    title: {
      cs: 'Výsledek bez přehnaného titulku',
      en: 'A finding without an exaggerated headline',
    },
    goal: {
      cs: 'Převeď odborný výsledek do srozumitelné zprávy a zachovej omezení.',
      en: 'Turn a research finding into a clear report while preserving its limitations.',
    },
    scene:
      'Eine kleine Beobachtungsstudie an einer Schule zeigt: Teilnehmende einer Lerngruppe erzielten im Durchschnitt fünf Punkte mehr. Die Teilnahme war freiwillig; Vorkenntnisse wurden nicht erhoben. Die Autorin erklärt die Kernaussage: „Unsere Daten zeigen einen Zusammenhang, aber keinen gesicherten Ursache-Wirkungs-Nachweis.“',
    tasks: [
      {
        prompt: {
          cs: 'Která formulace věrně připisuje závěr autorce?',
          en: 'Which wording faithfully attributes the conclusion to the author?',
        },
        answer:
          'Die Autorin erklärt, die Daten zeigten einen Zusammenhang; eine kausale Wirkung sei damit nicht nachgewiesen.',
        distractors: [
          'Die Autorin bestätigt, die Lerngruppe verbessere die Leistung aller Schülerinnen und Schüler.',
          'Der Studie zufolge seien Vorkenntnisse als Ursache ausgeschlossen.',
          'Die Autorin bestreitet, dass zwischen Teilnahme und Ergebnis ein Zusammenhang beobachtet wurde.',
        ],
        explanation: {
          cs: 'Nepřímá řeč zachovává zdroj i míru jistoty. Zeigten zastupuje neodlišitelný konjunktiv I množného čísla; sei vyjadřuje převzaté tvrzení.',
          en: 'Reported speech preserves both the source and the degree of certainty. Zeigten replaces the indistinguishable plural Konjunktiv I form; sei marks a reported claim.',
        },
      },
      {
        prompt: {
          cs: 'Jak výsledek vysvětlíš čtenáři bez odborného zázemí?',
          en: 'How do you explain the finding to a non-specialist reader?',
        },
        answer:
          'Die Gruppe schnitt besser ab. Ob das am gemeinsamen Lernen oder an unterschiedlichen Vorkenntnissen lag, lässt sich daraus nicht entscheiden.',
        distractors: [
          'Gemeinsames Lernen führt nachweislich bei jeder Person zu genau fünf zusätzlichen Punkten.',
          'Weil die Studie klein ist, hat sie überhaupt nichts beobachtet.',
          'Freiwillige Teilnahme schließt andere Erklärungen für den Unterschied aus.',
        ],
        explanation: {
          cs: 'Srozumitelné shrnutí odděluje pozorovaný rozdíl od jeho neprokázané příčiny. Omezení výsledek ani nezveličuje, ani nemaže.',
          en: 'The plain-language summary separates the observed difference from its unproven cause. It neither exaggerates nor erases the finding.',
        },
      },
    ],
  },
  {
    chapterId: 'chapter-120-crisis-communication',
    level: 'C1.2',
    title: { cs: 'Jasná zpráva při výpadku', en: 'A clear update during an outage' },
    goal: {
      cs: 'Spoj ověřená fakta, nejistotu a praktický další krok v jednu zprávu.',
      en: 'Combine verified facts, uncertainty, and a practical next step in one update.',
    },
    scene:
      'Lagebild, 14 Uhr: Das Buchungsportal ist seit 13:20 Uhr nicht erreichbar. Die Ursache wird untersucht; ein Datenabfluss ist weder bestätigt noch ausgeschlossen. Bestehende Buchungen bleiben gültig. Das nächste Update ist für 15 Uhr angekündigt.',
    tasks: [
      {
        prompt: {
          cs: 'Která úvodní zpráva odpovídá ověřenému stavu?',
          en: 'Which opening statement matches the verified situation?',
        },
        answer:
          'Das Buchungsportal ist derzeit nicht erreichbar. Die Ursache wird untersucht; zu einem möglichen Datenabfluss liegen noch keine gesicherten Erkenntnisse vor.',
        distractors: [
          'Ein Angriff hat nachweislich sämtliche Buchungsdaten offengelegt.',
          'Ein Datenabfluss wurde ausgeschlossen; das Portal steht gleich wieder zur Verfügung.',
          'Alle Buchungen seit 13:20 Uhr wurden unwiderruflich gelöscht.',
        ],
        explanation: {
          cs: 'Zpráva potvrzuje výpadek a otevřeně vymezuje, co se ještě neví. Nepotvrzenou příčinu ani únik dat nemění ve fakt.',
          en: 'The statement confirms the outage and clearly marks what is still unknown. It does not present an unconfirmed cause or data leak as fact.',
        },
      },
      {
        prompt: {
          cs: 'Čím zprávu uzavřeš, aby lidé věděli, jak postupovat?',
          en: 'How do you close the update so people know what to do?',
        },
        answer:
          'Bestehende Buchungen bleiben gültig. Bitte bewahren Sie Ihre Bestätigung auf; um 15 Uhr informieren wir über den aktuellen Stand.',
        distractors: [
          'Buchen Sie sofort erneut; alle bisherigen Bestätigungen sind ungültig.',
          'Bis 15 Uhr wird die Störung auf jeden Fall vollständig behoben sein.',
          'Weitere Informationen folgen erst, wenn jede mögliche Ursache ausgeschlossen ist.',
        ],
        explanation: {
          cs: 'Závěr dává praktický pokyn a přesný čas další informace. Ohlášený čas aktualizace neslibuje jako termín opravy.',
          en: 'The closing gives a practical action and a precise time for the next update. It does not turn the update time into a promised repair deadline.',
        },
      },
    ],
  },
];

export function courseMilestoneForChapter(chapterId: string): CourseMilestone | undefined {
  return courseMilestones.find((milestone) => milestone.chapterId === chapterId);
}
