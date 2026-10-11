import {
  assessCoachMessage,
  coachTurnFrame,
  rejectedCoachResult,
} from '../../../domain/course/coach-relevance.ts';
import { coachScenarioById } from '../../../domain/course/coach.ts';
import { normalizedIncludes } from './drills.server.ts';
import { DEMO_MODEL } from './model.server.ts';

import type { AiCoachRequest, AiCoachResult } from '../../../domain/ai/types.ts';

const coachReplies: Record<string, string[]> = {
  cafe: [
    'Sehr gern. Was möchten Sie trinken?',
    'Möchten Sie dazu etwas essen?',
    'Gut. Zahlen Sie zusammen oder getrennt?',
  ],
  train: [
    'Wohin möchten Sie fahren?',
    'Möchten Sie eine einfache Fahrt oder hin und zurück?',
    'Der Zug fährt von Gleis vier ab. Müssen Sie noch etwas wissen?',
  ],
  school: [
    'Welche Aufgabe ist für dich schwierig?',
    'Was verstehst du schon und wo brauchst du Hilfe?',
    'Gut erklärt. Wann möchtest du die Aufgabe fertig haben?',
  ],
  shopping: [
    'Natürlich. Welche Größe suchen Sie?',
    'Wie passt Ihnen das? Möchten Sie eine andere Farbe?',
    'Sehr gut. Möchten Sie bar oder mit Karte zahlen?',
  ],
  introductions: [
    'Freut mich! Woher kommst du?',
    'Schön. Und was machst du gern in deiner Freizeit?',
    'Das mag ich auch. Dann haben wir schon etwas gemeinsam!',
  ],
  bakery: [
    'Gern. Möchten Sie sonst noch etwas?',
    'Ja, das haben wir. Soll es ein ganzes Brot sein?',
    'Sehr gern. Das macht fünf Euro zwanzig.',
  ],
  directions: [
    'Gehen Sie hier geradeaus und dann an der Ampel nach links.',
    'Genau. Danach sehen Sie den Bahnhof auf der rechten Seite.',
    'Gern geschehen. Einen schönen Tag noch!',
  ],
  'hotel-check-in': [
    'Danke. Darf ich bitte noch Ihren Ausweis sehen?',
    'Das Frühstück gibt es ab halb sieben im Erdgeschoss.',
    'Der WLAN-Code steht auf Ihrer Zimmerkarte. Ihr Zimmer ist im zweiten Stock.',
  ],
  pharmacy: [
    'Haben Sie außerdem Fieber oder Husten?',
    'Ich empfehle Ihnen diese Lutschtabletten. Wenn es schlimmer wird, gehen Sie bitte zum Arzt.',
    'Nehmen Sie höchstens vier Tabletten am Tag und lesen Sie die Packungsbeilage.',
  ],
  invitation: [
    'Super, das freut mich! Die Feier beginnt um sechs.',
    'Sieben Uhr passt gut. Wir essen ungefähr um halb acht.',
    'Wenn du möchtest, bring bitte etwas zu trinken mit.',
  ],
  'apartment-repair': [
    'Das tut mir leid. Betrifft es die ganze Wohnung?',
    'Verstanden, dann ist die Reparatur dringend. Wann sind Sie zu Hause?',
    'Der Techniker kann morgen zwischen neun und elf Uhr kommen. Passt das?',
  ],
  'job-interview': [
    'Danke. Welche Aufgabe hat Ihnen dabei besonders viel Spaß gemacht?',
    'Können Sie mir ein konkretes Beispiel für gute Teamarbeit geben?',
    'Gute Frage. Ein typischer Tag beginnt mit einer kurzen Teambesprechung.',
  ],
  'lost-luggage': [
    'Das sehe ich mir sofort an. Haben Sie den Gepäckabschnitt dabei?',
    'Danke. Hat der Koffer noch ein besonderes Merkmal?',
    'Sie bekommen die Bestätigung per E-Mail. Wir liefern den Koffer an Ihre Unterkunft.',
  ],
  'project-meeting': [
    'Priorisieren klingt sinnvoll. Welche Aufgabe sollte zuerst fertig werden?',
    'Der kleinere Umfang wäre realistischer. Was verschieben wir konkret?',
    'Einverstanden. Sie übernehmen die Präsentation, ich kläre heute die offenen Daten.',
  ],
  'deadline-negotiation': [
    'Die Daten kommen vermutlich erst morgen. Welche Auswirkung hätte das?',
    'Eine Kurzfassung am Freitag könnte funktionieren. Was würde sie enthalten?',
    'Gut, dann halten wir Freitag für die Kurzfassung und Montag für die Vollversion fest.',
  ],
  'difficult-feedback': [
    'Danke, dass du es konkret ansprichst. Welche Änderung war für dich besonders schwierig?',
    'Das verstehe ich. Ich hätte dich früher informieren sollen.',
    'Lass uns Änderungen künftig bis mittags im gemeinsamen Kanal bestätigen.',
  ],
  'defend-position': [
    'Der längere Zeitraum verändert die Rechnung. Welche Annahme ist dafür entscheidend?',
    'Das ist nachvollziehbar. Wie würden Sie das Risiko einer falschen Annahme begrenzen?',
    'Eine schrittweise Einführung verbindet also Kontrolle und Lernmöglichkeit. Das überzeugt mich eher.',
  ],
  'media-interview': [
    'Welche Daten widersprechen denn konkret der Kritik?',
    'Hinweise sind noch kein Beweis. Wie sicher ist Ihre Aussage tatsächlich?',
    'Transparente Prüfung ist ein klares Versprechen. Wann werden die ersten Ergebnisse veröffentlicht?',
  ],
  'supermarket-checkout': [
    'Gern. Möchten Sie bar oder mit Karte zahlen?',
    'Bitte halten Sie die Karte an das Lesegerät. Möchten Sie den Kassenbon?',
    'Natürlich. Hier sind Ihr Kassenbon und Ihre Einkäufe. Auf Wiedersehen!',
  ],
  'city-bus': [
    'Gern. Fahren Sie direkt zum Museum oder zuerst ins Stadtzentrum?',
    'Ja, die Linie vier fährt zum Museum. Haben Sie noch eine Frage?',
    'Steigen Sie an der Haltestelle Rathaus aus. Ich sage Ihnen rechtzeitig Bescheid.',
  ],
  'new-neighbor': [
    'Dann herzlich willkommen im Haus! Haben Sie schon alles gefunden?',
    'Der Müllraum ist im Keller, gleich neben der Treppe.',
    'Sehr gern, danke. Morgen Nachmittag hätte ich Zeit.',
  ],
  'doctor-appointment': [
    'Natürlich. Passt es Ihnen am Dienstagvormittag?',
    'Wir hätten um zehn Uhr noch einen freien Termin. Geht das?',
    'Perfekt, ich habe den Termin eingetragen. Bringen Sie bitte Ihre Versicherungskarte mit.',
  ],
  'restaurant-reservation': [
    'Am Freitag ist um neunzehn Uhr noch ein Tisch frei. Passt das?',
    'Ja, wir haben mehrere vegetarische Hauptgerichte. Auf welchen Namen darf ich reservieren?',
    'Vielen Dank. Der Tisch für zwei ist auf Novák reserviert. Wir freuen uns auf Sie!',
  ],
  'return-purchase': [
    'Das tut mir leid. Haben Sie den Kassenbon noch?',
    'Danke. Wir können die Kopfhörer umtauschen oder den Kaufpreis erstatten. Was ist Ihnen lieber?',
    'In Ordnung. Die Erstattung geht zurück auf Ihre Karte.',
  ],
  'post-office': [
    'Das Paket wiegt zwei Kilo. Soll es normal oder per Express verschickt werden?',
    'Der Expressversand kostet achtzehn Euro und dauert voraussichtlich zwei Tage.',
    'Ja. Die Sendungsnummer steht oben auf diesem Beleg.',
  ],
  'bike-rental': [
    'Ein Tag kostet achtzehn Euro. Brauchen Sie auch einen Helm oder ein Schloss?',
    'Ja, Helm und Schloss sind im Preis enthalten.',
    'Bitte bringen Sie das Fahrrad heute bis achtzehn Uhr hierher zurück.',
  ],
  'apartment-viewing': [
    'Heizung und Wasser sind enthalten, Strom zahlen Sie separat. Was möchten Sie noch wissen?',
    'Die Straßenbahn hält um die Ecke und fährt zehn Minuten ins Zentrum.',
    'Die Wohnung ist ab dem ersten Oktober frei. Möchten Sie die Unterlagen mitnehmen?',
  ],
  'call-in-sick': [
    'Natürlich, erholen Sie sich. Gibt es heute etwas Dringendes, das wir übernehmen müssen?',
    'Ja, Lea kann den Termin übernehmen. Schicken Sie ihr bitte nur die wichtigsten Notizen.',
    'Das reicht völlig. Melden Sie sich erst, wenn Sie wissen, wie es Ihnen geht. Gute Besserung!',
  ],
  'phone-contract': [
    'Ich sehe eine zusätzliche Gebühr. Haben Sie im Ausland mobile Daten genutzt?',
    'Die Gebühr stammt aus Ihrem aktuellen Roaming-Paket. Soll ich günstigere Tarife prüfen?',
    'Der Flex-Tarif passt besser zu Ihrer Nutzung. Ich kann den Wechsel zum Monatsende eintragen.',
  ],
  'weekend-planning': [
    'Das Museum ist eine gute Alternative. Was machen wir, falls es am Sonntag trocken bleibt?',
    'Ein kurzer Sonntagsausflug klingt gut. Wer organisiert was?',
    'Perfekt. Du besorgst die Tickets, ich kümmere mich um die Zugverbindung.',
  ],
  'customer-complaint': [
    'Gut, dann prüfen Sie es. Welche Angabe brauchen Sie von mir?',
    'Die Bestellnummer lautet 8472. Können Sie jetzt sehen, wo das Paket ist?',
    'Die Erstattung und Lieferung morgen sind für mich eine faire Lösung. Bitte bestätigen Sie das per E-Mail.',
  ],
  'remote-work': [
    'Mehr Konzentration ist ein Argument. Wie stellen Sie sicher, dass das Team Sie erreicht?',
    'Feste Kernzeiten helfen. Trotzdem fehlt uns möglicherweise der spontane Austausch im Büro.',
    'Eine sechswöchige Pilotphase mit klaren Kriterien halte ich für vertretbar. Formulieren Sie bitte einen kurzen Vorschlag.',
  ],
  'salary-conversation': [
    'Welche konkreten Ergebnisse verbinden Sie mit der zusätzlichen Verantwortung?',
    'Die Ergebnisse sind gut, unser Budget ist dieses Quartal allerdings bereits festgelegt.',
    'Einverstanden. Wir definieren heute die Kriterien und entscheiden beim nächsten Quartalsgespräch über die Anpassung.',
  ],
  'academic-seminar': [
    'Die Stichprobe ist klein, aber die Ergebnisse sind statistisch signifikant. Warum reicht Ihnen das nicht?',
    'Sie unterscheiden also zwischen einem belastbaren Trend und einem kausalen Nachweis. Welche Prüfung schlagen Sie vor?',
    'Eine größere Vergleichsgruppe würde die zentrale Schwäche tatsächlich adressieren. Das ist ein konstruktiver Einwand.',
  ],
  'town-hall': [
    'Die Ladenbesitzer berichten bereits von sinkenden Umsätzen. Warum sollte das nicht am Verkehrskonzept liegen?',
    'Feste Lieferzeiten wären hilfreich, lösen aber nicht jede Sorge. Welche weitere Absicherung sehen Sie vor?',
    'Eine ausgewertete Übergangsphase mit klaren Ausnahmen wäre ein überprüfbarer Kompromiss.',
  ],
  'team-mediation': [
    'Verlässliche Prioritäten wollen alle. Gestritten wird darüber, wer sie festlegen darf.',
    'Frühere Dokumentation klingt sinnvoll, doch wie verhindern wir weiterhin einseitige Entscheidungen?',
    'Eine verbindliche wöchentliche Abstimmung gibt beiden Seiten Einfluss. Das können wir so festhalten.',
  ],
  'bakery-preorder': [
    'Danke, ich habe die Bestellung gefunden. Was genau hatten Sie bestellt?',
    'Richtig, zwei Brezeln und eine Zimtschnecke. Möchten Sie noch etwas dazu?',
    'Sehr gern. Ich packe alles zusammen ein. Das macht acht Euro zwanzig.',
  ],
  'medical-examination': [
    'Haben Sie außer Halsschmerzen und Fieber noch weitere Beschwerden?',
    'Dann untersuche ich jetzt Ihren Hals. Nehmen Sie bereits Medikamente?',
    'Für die Blutuntersuchung kommen Sie bitte nüchtern. Das Rezept erhalten Sie anschließend.',
  ],
  'study-planning': [
    'Freies Sprechen ist ein klares Ziel. Wie teilen Sie die vier Wochen konkret ein?',
    'Die drei Etappen sind sinnvoll. Woran erkennen Sie am Ende jeder Woche Ihren Fortschritt?',
    'Eine wöchentliche Probeaufgabe macht den Fortschritt sichtbar. Tragen Sie die Termine direkt in Ihren Zeitplan ein.',
  ],
  'hybrid-team-coordination': [
    'Ein gemeinsamer Termin reduziert die Belastung. Wie halten wir die übrigen Personen auf dem Laufenden?',
    'Asynchrone Dokumentation hilft. Wer koordiniert offene Entscheidungen zwischen den Zeitzonen?',
    'Feste Übergaben und klare Zuständigkeiten ergeben einen belastbaren Arbeitsablauf. Testen wir ihn vier Wochen lang.',
  ],
  'fact-checking-briefing': [
    'Einverstanden, Reichweite ersetzt keine verlässliche Quelle. Welche Angaben können wir unabhängig prüfen?',
    'Ort, Zeitpunkt und Urheber sind die richtigen Prüfpunkte. Wie formulieren wir den Zwischenstand ohne Vorverurteilung?',
    'Die Quellenangabe schafft den nötigen Abstand. Wir veröffentlichen erst nach einer zweiten unabhängigen Bestätigung.',
  ],
  'weather-outfit': [
    'Ein Spaziergang ist möglich, aber am Nachmittag sind Schauer angekündigt. Was ziehst du an?',
    'Die Regenjacke passt gut. Brauchst du für stärkeren Regen noch etwas?',
    'Mit dem Regenschirm bist du vorbereitet. Dann können wir trotz des Wetters losgehen.',
  ],
  'library-card': [
    'Gern. Für den Ausweis brauche ich Ihren Namen, Ihre Adresse und einen Lichtbildausweis.',
    'Sie können Bücher vier Wochen ausleihen und online zweimal verlängern.',
    'Die deutschen Kinderbücher finden Sie im ersten Stock, gleich hinter der Treppe.',
  ],
  'dietary-request': [
    'Danke für den Hinweis. Die Nussallergie vermerke ich sofort. Welches Gericht interessiert Sie?',
    'Die Suppe enthält Sahne, wir haben aber eine vegane Tomatensuppe ohne Milchprodukte.',
    'Ja, den Salat bereiten wir ohne Käse und mit einem separaten Dressing zu.',
  ],
  'missed-connection': [
    'Ich prüfe das. Aus welcher Richtung kamen Sie und wohin möchten Sie weiterfahren?',
    'Die nächste Verbindung nach Leipzig fährt um vierzehn Uhr zwölf von Gleis sieben.',
    'Wegen der Verspätung gilt Ihre Fahrkarte auch in diesem Zug; eine neue Buchung ist nicht nötig.',
  ],
  'volunteer-event': [
    'Eine Aufgabenliste ist ein guter Anfang. Wie viele Freiwillige und welche Ausrüstung brauchen wir?',
    'Damit sind Material und Treffpunkt geklärt. Wer informiert die Gemeinde und die Teilnehmenden?',
    'Der Ersatztermin am Sonntag ist sinnvoll. Wir bestätigen ihn am Freitag anhand der Wettervorhersage.',
  ],
  'study-project-presentation': [
    'Die Folgen für Studierende geben der Präsentation einen klaren Fokus. Welche Argumente brauchen wir?',
    'Die Dreiteilung ist nachvollziehbar. Wer übernimmt Quellen, Beispiele und Lösungsvorschläge?',
    'Montag passt. Nach der Probe geben wir uns gezielt Feedback zu Aufbau, Zeit und Verständlichkeit.',
  ],
  'energy-saving-proposal': [
    'Die Wärmeverluste sprechen für die Dämmung. Auf welche Verbrauchsdaten stützen Sie diese Priorität?',
    'Die erwartete Einsparung ist relevant, aber die Anfangsinvestition bleibt beträchtlich. Wie bewerten Sie das?',
    'Eine Amortisation in sechs Jahren wäre vertretbar. Legen Sie bitte Annahmen und Messkriterien offen.',
  ],
  'privacy-incident-response': [
    'Zwölf auffällige Konten sind ein belastbarer erster Befund. Was ist noch unklar?',
    'Sperren und Beweissicherung haben jetzt Vorrang. Wie verhindern wir dabei den Verlust von Protokolldaten?',
    'Einverstanden. Wir informieren transparent, trennen bestätigte Fakten von Vermutungen und nennen nächste Schritte.',
  ],
  'research-ethics-review': [
    'Die mögliche Belastung ist zentral. Welche Schutzmaßnahme würde dieses Risiko konkret begrenzen?',
    'Ein folgenloser Rückzug stärkt die Freiwilligkeit. Wie prüfen wir, ob die Einwilligung wirklich verstanden wurde?',
    'Eine unabhängige Ansprechstelle ist eine sinnvolle Auflage. Ich nehme sie in das überarbeitete Protokoll auf.',
  ],
  'policy-consultation': [
    'Der Zielkonflikt ist präzise benannt. Welche Gruppen wären von einer starren Regel besonders betroffen?',
    'Begrenzte Ausnahmen könnten berechtigte Härten auffangen. Wie verhindern wir, dass sie zur Regel werden?',
    'Klare Kriterien und eine befristete Auswertung machen den Kompromiss überprüfbar. Das halten wir im Entwurf fest.',
  ],
};

function compactGermanCorrection(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed) return null;
  let corrected = trimmed.charAt(0).toLocaleUpperCase('de-DE') + trimmed.slice(1);
  corrected = corrected.replace(/\bich möchte gerne\b/iu, 'ich möchte gern');
  corrected = corrected
    .replace(/\bkonnen\b/giu, 'können')
    .replace(/\bmussen\b/giu, 'müssen')
    .replace(/\bmochte\b/giu, 'möchte')
    .replace(/\bdie\s+Fern\s*sehen\b/giu, 'das Fernsehen')
    .replace(/\bdie Momenten\b/giu, 'die Momente')
    .replace(/\bnichts (?:können )?machen kann\b/giu, 'nichts machen kann');
  if (!/[.!?]$/u.test(corrected)) corrected += '.';
  return corrected === trimmed ? null : corrected;
}

export function demoCoach(request: AiCoachRequest): AiCoachResult {
  const message = request.message.trim();
  const words = message.split(/\s+/u).filter(Boolean);
  const focusHits = request.focusWords.filter((word) => normalizedIncludes(message, word)).length;
  const scenario = coachScenarioById(request.scenarioId);
  const assessment = scenario
    ? assessCoachMessage({
        scenario,
        message,
        turn: request.turn,
        history: request.history,
      })
    : undefined;
  if (scenario && assessment && !assessment.accepted && assessment.issue) {
    return rejectedCoachResult({
      scenario,
      assessment,
      turn: request.turn,
      maxTurns: request.maxTurns,
      motherTongue: request.motherTongue,
    });
  }
  const accepted = assessment?.accepted ?? words.length >= 2;
  const relevanceHits = assessment
    ? new Set([...assessment.contextMatches, ...assessment.turnMatches]).size
    : 0;
  const score = Math.max(
    35,
    Math.min(
      100,
      48 +
        (accepted ? 24 : 0) +
        Math.min(12, words.length * 2) +
        Math.min(10, focusHits * 5) +
        Math.min(6, relevanceHits * 2),
    ),
  );
  const replyPool = coachReplies[request.scenarioId];
  const index = Math.min((replyPool?.length ?? 1) - 1, Math.max(0, request.turn - 1));
  const nextFrame =
    scenario && request.turn < request.maxTurns ? coachTurnFrame(scenario, request.turn + 1) : null;
  const reply = replyPool
    ? replyPool[index]
    : scenario
      ? nextFrame
        ? `Gut. Ergänze jetzt den nächsten Punkt mit „${nextFrame}“.`
        : 'Gut gemacht. Damit ist die Situation vollständig.'
      : [
          'Gut. Kannst du mir noch einen Satz dazu sagen?',
          'Verstanden. Was möchtest du als Nächstes sagen?',
          'Sehr schön. Stelle mir jetzt bitte eine kurze Frage.',
        ][Math.min(2, Math.max(0, request.turn - 1))];
  const correction = accepted ? compactGermanCorrection(message) : null;
  const progress = Math.min(100, Math.round((request.turn / Math.max(1, request.maxTurns)) * 100));
  const diagnostics: AiCoachResult['diagnostics'] = [];
  if (/\bich\s+(?:haben|sein|mochten|möchten|konnen|können)\b/iu.test(message)) {
    diagnostics.push({ tag: 'verb-form', confidence: 'high' });
  }
  if (/\bweil\b[^.!?]*\b(?:ich|du|er|sie|wir|ihr)\s+\p{L}+(?:e|st|t|en)\b/iu.test(message)) {
    diagnostics.push({ tag: 'word-order', confidence: 'medium' });
  }

  return {
    reply,
    accepted,
    outcome: accepted ? 'accepted' : 'retry',
    score,
    feedback: accepted
      ? focusHits > 0
        ? request.motherTongue === 'en'
          ? 'The expression fits your reply. Let’s continue.'
          : 'Výraz se do odpovědi hodí. Můžeme pokračovat.'
        : request.motherTongue === 'en'
          ? 'Your message is clear. In the next turn, try to add one of the suggested words.'
          : 'Sdělení je srozumitelné. V dalším tahu zkus přidat jedno z doporučených slov.'
      : request.motherTongue === 'en'
        ? 'Try one short German sentence. A subject, verb, and the information you want to share are enough.'
        : 'Zkus jednu krátkou německou větu. Stačí podmět, sloveso a informace, kterou chceš sdělit.',
    correction,
    nextHint:
      request.turn >= request.maxTurns
        ? request.motherTongue === 'en'
          ? 'The final step is complete—review your conversation summary now.'
          : 'Poslední krok je hotový — teď si prohlédni souhrn rozhovoru.'
        : request.level === 'A1' || request.level === 'A2'
          ? request.motherTongue === 'en'
            ? `Complete the next short frame “${nextFrame ?? 'Ich …'}” with your own detail.`
            : `Doplň další krátkou kostru „${nextFrame ?? 'Ich …'}“ vlastním údajem.`
          : request.motherTongue === 'en'
            ? `Continue with the next point; “${nextFrame ?? 'eine klare Begründung …'}” can help.`
            : `Pokračuj dalším bodem; pomoci může „${nextFrame ?? 'eine klare Begründung …'}“.`,
    missionProgress: progress,
    diagnostics: diagnostics.slice(0, 3),
    model: DEMO_MODEL,
  };
}
