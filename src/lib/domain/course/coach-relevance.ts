import type { AiCoachMessage, AiCoachResult } from '../ai/types.ts';
import type { CoachScenario } from './coach.ts';

export type CoachMessageIssue =
  | 'nonsense'
  | 'not-german'
  | 'off-topic'
  | 'too-short'
  | 'needs-support';

export type CoachMessageAssessment = {
  accepted: boolean;
  issue: CoachMessageIssue | null;
  contextMatches: string[];
  turnMatches: string[];
  activeCoachMessage: string;
  expectedPrompt: string;
};

const STOP_WORDS = new Set([
  'aber',
  'als',
  'auch',
  'auf',
  'aus',
  'bei',
  'bin',
  'bis',
  'das',
  'dass',
  'dem',
  'den',
  'der',
  'des',
  'die',
  'du',
  'ein',
  'eine',
  'einem',
  'einen',
  'einer',
  'er',
  'es',
  'fur',
  'hat',
  'haben',
  'heute',
  'ich',
  'ihr',
  'ihre',
  'im',
  'in',
  'ist',
  'kann',
  'konnen',
  'mein',
  'meine',
  'meinem',
  'meinen',
  'meiner',
  'meines',
  'mit',
  'mochte',
  'nach',
  'nicht',
  'oder',
  'sein',
  'sie',
  'sind',
  'und',
  'vom',
  'von',
  'war',
  'was',
  'wie',
  'wir',
  'zu',
  'zum',
  'zur',
]);

const GERMAN_SIGNAL =
  /\b(?:aber|also|am|an|auf|bei|bitte|danke|dass|denn|doch|ein|eine|einen|einem|einer|fur|gern|habe|hat|ich|im|in|leider|mein|meine|mich|mir|mit|mochte|mussen|nach|nicht|oder|schon|seit|sie|und|vielleicht|von|weil|wenn|werde|wir|wurde|zu|zum|zur)\b/u;
const KEYBOARD_MASH = /(?:asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|ertz|rtzu|tzui|zuiop|yxcv)/u;
const VOWEL = /[aeiouy]/u;
const GERMAN_QUESTION_WORD =
  /^(?:was|wer|wen|wem|wessen|wie|wo|wohin|woher|wann|warum|wieso|weshalb)$/u;
const SUPPORT_REQUEST =
  /\b(?:keine ahnung|weiss (?:es )?nicht|nicht verstanden|verstehe (?:das|dich|die frage|sie) nicht|wie bitte|was bedeutet|(?:kannst du|konnen sie) (?:das|die frage|es)? ?(?:noch einmal )?wiederholen|(?:kannst du|konnen sie) mir helfen|hilf mir|helfen sie mir|brauche hilfe|was soll ich (?:antworten|sagen))\b/u;
const NUMBER_OR_FREQUENCY =
  /\b(?:\d+|eins|zwei|drei|vier|funf|sechs|sieben|acht|neun|zehn|einmal|zweimal|taglich|jeden tag|wochentlich|jede woche|regelmassig|manchmal|selten|oft|stunden?|minuten?|tage?|wochen?|monate?)\b/u;
const RETRY_COACH_REPLY =
  /^(?:das passt noch nicht|das gehort noch nicht|das beantwortet die frage noch nicht|versuch es bitte noch einmal|antworte bitte noch einmal|bleib(?:en wir)? bei (?:der|dieser) frage|ich brauche noch einen kurzen satz|kein problem\. antworte auf diese frage)/u;

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ß/gu, 'ss')
    .toLocaleLowerCase('de-DE');
}

function tokens(value: string): string[] {
  return normalize(value).match(/\p{L}[\p{L}'’-]*/gu) ?? [];
}

function contentTokens(value: string): string[] {
  return tokens(value).filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function stem(value: string): string {
  if (value.length < 5) return value;
  return value.replace(/(?:ern|est|em|en|er|es|et|e|n|s)$/u, '');
}

function related(left: string, right: string): boolean {
  const leftStem = stem(left);
  const rightStem = stem(right);
  if (leftStem === rightStem) return true;
  if (Math.min(leftStem.length, rightStem.length) < 4) return false;
  return leftStem.startsWith(rightStem) || rightStem.startsWith(leftStem);
}

function looksLikeNonsense(message: string, words: string[]): boolean {
  const normalized = normalize(message).trim();
  const letters = normalized.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 2) return true;
  if (KEYBOARD_MASH.test(normalized) || /^(?:bla){2,}[.!?]*$/u.test(normalized)) return true;
  if (/(.)\1{5,}/u.test(normalized)) return true;
  if (words.length >= 3 && new Set(words).size === 1) return true;
  const suspicious = words.filter(
    (word) => word.length >= 7 && !VOWEL.test(word.replace(/sch|ch|ck/gu, '')),
  );
  return suspicious.length > 0 && suspicious.length === words.length;
}

function allowsShortReply(message: string, latestCoachMessage: string, turn: number): boolean {
  const normalized = normalize(message)
    .replace(/[^\p{L}\d:]+/gu, ' ')
    .trim();
  if (
    /^(?:das passt|das geht|kein problem|in ordnung|einverstanden|naturlich|leider nicht)$/u.test(
      normalized,
    )
  ) {
    return true;
  }
  if (
    /^(?:ja(?: naturlich| gern)?|nein|doch|naturlich|leider)(?: danke| bitte)?$/u.test(normalized)
  ) {
    const question =
      normalize(latestCoachMessage)
        .split(/[.!?]+/u)
        .map((part) => part.trim())
        .findLast(Boolean) ?? '';
    return /^(?:haben|hast|ist|sind|kann|konnen|mochten|mochtest|soll|sollen|darf|durfen|wollen)\b/u.test(
      question,
    );
  }
  if (turn > 1 && /^(?:danke|vielen dank|danke schon|gern geschehen)$/u.test(normalized)) {
    return true;
  }
  return /^(?:um|gegen) \d{1,2}(?::\d{2})?(?: uhr)?$/u.test(normalized);
}

function asksForSupport(message: string): boolean {
  return SUPPORT_REQUEST.test(normalize(message));
}

function scenarioPractisesSupport(scenario: CoachScenario, turn: number): boolean {
  return /\b(?:wiederholen|langsamer sprechen|nicht verstehen|um hilfe bitten|nachfragen)\b/u.test(
    normalize(
      [scenario.focusWords[turn - 1], scenario.starterPrompts[turn - 1], scenario.goal].join(' '),
    ),
  );
}

function answersQuestionShape(message: string, latestCoachMessage: string): boolean {
  const answer = normalize(message)
    .replace(/[^\p{L}\d:]+/gu, ' ')
    .trim();
  const question = normalize(latestCoachMessage);
  if (!answer) return false;
  if (/\b(?:wann|um wie viel uhr|zu welcher uhrzeit|welcher tag)\b/u.test(question)) {
    return (
      NUMBER_OR_FREQUENCY.test(answer) ||
      /\b(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/u.test(answer)
    );
  }
  if (/\b(?:wie oft|wie viele|wie lange|an wie vielen)\b/u.test(question)) {
    return NUMBER_OR_FREQUENCY.test(answer);
  }
  if (/\bwohin\b/u.test(question)) {
    return /^(?:nach|in|ins|zum|zur)\b/u.test(answer);
  }
  if (/\bwo\b/u.test(question)) {
    return /^(?:an|auf|bei|hinter|in|im|neben|uber|unter|vor|zwischen)\b/u.test(answer);
  }
  if (/\b(?:warum|wieso|weshalb)\b/u.test(question)) {
    return /\b(?:da|darum|denn|deshalb|weil)\b/u.test(answer);
  }
  return false;
}

function isRetryCoachMessage(message: string): boolean {
  return RETRY_COACH_REPLY.test(normalize(message).trim());
}

function lastCoachQuestion(message: string): string {
  return (
    message
      .match(/[^.!?]+\?/gu)
      ?.at(-1)
      ?.trim() ?? message.trim()
  );
}

export function coachTurnFrame(scenario: CoachScenario, turn: number): string {
  const prompt = scenario.starterPrompts[
    Math.min(scenario.starterPrompts.length - 1, Math.max(0, turn - 1))
  ]
    ?.trim()
    .replace(/[.!?]+$/u, '');
  if (!prompt) return 'Ich …';
  const words = prompt.split(/\s+/u);
  const count = /^(?:am|im|an|auf|nach|vor|zum|zur)$/iu.test(words[0] ?? '') ? 4 : 3;
  const visible = words.slice(0, Math.min(count, Math.max(1, words.length - 1))).join(' ');
  return `${visible.replace(/[,;:]$/u, '')} …`;
}

function scenarioContext(
  scenario: CoachScenario,
  history: AiCoachMessage[],
  turn: number,
): {
  coreVocabulary: string[];
  turnVocabulary: string[];
  questionVocabulary: string[];
  latestCoachMessage: string;
  expectedPrompt: string;
} {
  const latestCoachMessage =
    history.findLast((message) => message.role === 'coach' && !isRetryCoachMessage(message.text))
      ?.text ?? scenario.opening;
  const expectedPrompt =
    scenario.starterPrompts[Math.min(scenario.starterPrompts.length - 1, Math.max(0, turn - 1))] ??
    scenario.starterPrompts[0] ??
    '';
  const coreVocabulary = [
    ...scenario.focusWords,
    ...scenario.contextCues,
    ...scenario.starterPrompts,
  ].flatMap(contentTokens);
  const turnVocabulary = [expectedPrompt, scenario.focusWords[turn - 1] ?? ''].flatMap(
    contentTokens,
  );
  return {
    coreVocabulary: [...new Set(coreVocabulary)],
    turnVocabulary: [...new Set(turnVocabulary)],
    questionVocabulary: [...new Set(contentTokens(latestCoachMessage))],
    latestCoachMessage,
    expectedPrompt,
  };
}

export function assessCoachMessage(input: {
  scenario: CoachScenario;
  message: string;
  turn: number;
  history?: AiCoachMessage[];
}): CoachMessageAssessment {
  const { coreVocabulary, turnVocabulary, questionVocabulary, latestCoachMessage, expectedPrompt } =
    scenarioContext(input.scenario, input.history ?? [], input.turn);
  const base = { activeCoachMessage: latestCoachMessage, expectedPrompt };
  const messageTokens = tokens(input.message);
  if (looksLikeNonsense(input.message, messageTokens)) {
    return {
      accepted: false,
      issue: 'nonsense',
      contextMatches: [],
      turnMatches: [],
      ...base,
    };
  }

  const meaningful = contentTokens(input.message);
  const coreMatches = meaningful.filter((word) =>
    coreVocabulary.some((contextWord) => related(word, contextWord)),
  );
  const turnMatches = meaningful.filter((word) =>
    turnVocabulary.some((contextWord) => related(word, contextWord)),
  );
  const questionMatches = meaningful.filter((word) =>
    questionVocabulary.some((contextWord) => related(word, contextWord)),
  );
  const contextMatches = [...new Set([...coreMatches, ...turnMatches, ...questionMatches])];
  const normalizedMessage = normalize(input.message);
  const shortReplyAllowed = allowsShortReply(input.message, latestCoachMessage, input.turn);
  const directAnswer = answersQuestionShape(input.message, latestCoachMessage);
  const looksGerman =
    contextMatches.length > 0 ||
    directAnswer ||
    shortReplyAllowed ||
    asksForSupport(input.message) ||
    /[äöüß]/iu.test(input.message) ||
    GERMAN_SIGNAL.test(normalizedMessage) ||
    GERMAN_QUESTION_WORD.test(normalizedMessage.replace(/[^\p{L}]+/gu, ''));
  if (!looksGerman) {
    return {
      accepted: false,
      issue: 'not-german',
      contextMatches: [],
      turnMatches: [],
      ...base,
    };
  }

  if (asksForSupport(input.message) && !scenarioPractisesSupport(input.scenario, input.turn)) {
    return {
      accepted: false,
      issue: 'needs-support',
      contextMatches,
      turnMatches: [...new Set(turnMatches)],
      ...base,
    };
  }

  if (
    !shortReplyAllowed &&
    !directAnswer &&
    (messageTokens.length <= 1 || meaningful.length === 0)
  ) {
    return {
      accepted: false,
      issue: 'too-short',
      contextMatches,
      turnMatches: [...new Set(turnMatches)],
      ...base,
    };
  }

  const uniqueCoreMatches = [...new Set(coreMatches)];
  const uniqueTurnMatches = [...new Set(turnMatches)];
  const relevantShare = meaningful.length === 0 ? 0 : uniqueCoreMatches.length / meaningful.length;
  if (
    uniqueTurnMatches.length > 0 ||
    directAnswer ||
    shortReplyAllowed ||
    (uniqueCoreMatches.length > 0 &&
      (meaningful.length <= 2 || uniqueCoreMatches.length >= 2 || relevantShare >= 1 / 3))
  ) {
    return {
      accepted: true,
      issue: null,
      contextMatches,
      turnMatches: uniqueTurnMatches,
      ...base,
    };
  }
  return {
    accepted: false,
    issue: 'off-topic',
    contextMatches,
    turnMatches: uniqueTurnMatches,
    ...base,
  };
}

export function rejectedCoachResult(input: {
  scenario: CoachScenario;
  assessment: CoachMessageAssessment;
  turn: number;
  maxTurns: number;
  motherTongue?: 'cs' | 'en';
}): AiCoachResult {
  const issue = input.assessment.issue ?? 'off-topic';
  const frame = coachTurnFrame(input.scenario, input.turn);
  const question = lastCoachQuestion(input.assessment.activeCoachMessage)
    .replace(/\s+/gu, ' ')
    .slice(0, 220);
  const english = input.motherTongue === 'en';
  const feedbackCs: Record<CoachMessageIssue, string> = {
    nonsense:
      'Tahle replika zatím není srozumitelná. Napiš jednu krátkou německou větu k zopakované otázce.',
    'not-german':
      'Odpověď není rozpoznatelná jako němčina. Stačí jedna krátká německá věta k zopakované otázce.',
    'off-topic': `Tahle věta s otázkou ještě nesouvisí. V tomto kroku doplň informaci podle kostry „${frame}“.`,
    'too-short': `Tohle je německy, ale na vyhodnocení je odpověď příliš krátká. Rozviň ji podle kostry „${frame}“.`,
    'needs-support': `Žádost o pomoc dává smysl a není to chyba. Zkus teď doplnit jen kostru „${frame}“.`,
  };
  const feedbackEn: Record<CoachMessageIssue, string> = {
    nonsense:
      'This is not clear enough to assess yet. Write one short German sentence answering the repeated question.',
    'not-german':
      'The answer is not recognizable as German. One short German sentence answering the repeated question is enough.',
    'off-topic': `This sentence does not answer the question yet. Add the missing information with the frame “${frame}”.`,
    'too-short': `This is German, but it is too short to assess. Expand it with the frame “${frame}”.`,
    'needs-support': `Asking for help is valid, not a mistake. Now complete just the frame “${frame}”.`,
  };
  const reply =
    issue === 'needs-support'
      ? `Kein Problem. Antworte auf diese Frage: ${question} Du kannst mit „${frame}“ beginnen.`
      : issue === 'too-short'
        ? `Ich brauche noch einen kurzen Satz. Antworte bitte auf diese Frage: ${question}`
        : `Bleiben wir bei dieser Frage: ${question} Beginne zum Beispiel mit „${frame}“.`;
  return {
    reply,
    accepted: false,
    outcome: issue === 'needs-support' ? 'needs-support' : 'retry',
    score: issue === 'needs-support' ? 10 : issue === 'too-short' ? 5 : 0,
    feedback: english ? feedbackEn[issue] : feedbackCs[issue],
    correction: null,
    nextHint: english
      ? `The active question is still “${question}”. Complete “${frame}” with your own detail.`
      : `Aktivní zůstává otázka „${question}“. Doplň „${frame}“ vlastním údajem.`,
    missionProgress: Math.min(
      100,
      Math.round(((Math.max(1, input.turn) - 1) / Math.max(1, input.maxTurns)) * 100),
    ),
    diagnostics: [],
    model: 'fritz-context-check',
  };
}
