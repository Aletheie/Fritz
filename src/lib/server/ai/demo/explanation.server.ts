import {
  containsLexicalForm,
  germanAdjectiveInflectionMatches,
  germanVerbInflectionMatches,
  lexicalTokens,
} from '../../../domain/grading/lexical.ts';
import { DEMO_MODEL } from './model.server.ts';

import type {
  AiExplanationResult,
  AiSentenceEvaluationRequest,
  AiSentenceEvaluationResult,
} from '../../../domain/ai/types.ts';
import type { Article, MotherTongue } from '../../../domain/types.ts';

export function demoExplanation(request: {
  motherTongue?: MotherTongue;
  german: string;
  czech: string;
  article?: Article;
  submitted: string;
  selectedArticle?: Article;
  wordCorrect: boolean;
  articleCorrect: boolean;
  keyboardEquivalent: boolean;
  editDistance: number;
  learningNote?: string;
}): AiExplanationResult {
  const target = request.article ? `${request.article} ${request.german}` : request.german;
  if (request.motherTongue === 'en') {
    let headline = 'Check the correct form';
    let explanation = `The correct answer is “${target}”.`;
    let tip = `Say “${target}” aloud and use it immediately in a short German sentence.`;
    if (!request.articleCorrect && request.article) {
      headline = `Learn the whole unit “${target}”`;
      explanation = request.selectedArticle
        ? `The word was close, but change the article “${request.selectedArticle}” to “${request.article}”. In German, gender belongs to the noun.`
        : `Add the article “${request.article}”. It is best to store a German noun and its article as one unit.`;
      tip = `Next time, start with “${target}”, not the noun on its own.`;
    } else if (request.keyboardEquivalent) {
      headline = 'The meaning works; fix the spelling';
      explanation = `The answer is correct in meaning. Use the exact German spelling shown in “${target}”.`;
      tip = 'On mobile, hold a letter to choose ä, ö, or ü; ß is available on a German keyboard.';
    } else if (!request.wordCorrect) {
      const attempt = request.submitted.trim() || 'an empty answer';
      headline = request.editDistance <= 2 ? 'A small typo' : 'Review the correct word';
      explanation = `You wrote “${attempt}”; the target form is “${target}”. Focus on letter order and the ending.`;
    } else {
      headline = 'Correct. Try your own sentence';
      explanation = `“${target}” is correct. Next, recall it without a hint inside a full sentence.`;
    }
    return {
      headline,
      explanation,
      tip,
      miniExampleDe: request.article
        ? `Das ist ${request.article === 'der' ? 'der' : request.article === 'die' ? 'die' : 'das'} ${request.german}.`
        : `Ich benutze heute „${request.german}“.`,
      miniExampleCs: request.article
        ? `That is ${request.czech}.`
        : `Today I am using the expression “${request.czech}”.`,
      model: DEMO_MODEL,
    };
  }
  let headline = 'Podívej se na správný tvar';
  let explanation = `Správná odpověď je „${target}“.`;
  let tip = request.learningNote ?? `Řekni si „${target}“ nahlas a hned ho použij v krátké větě.`;

  if (!request.articleCorrect && request.article) {
    headline = `Uč se celé spojení „${target}“`;
    explanation = request.selectedArticle
      ? `Slovo bylo blízko, ale člen „${request.selectedArticle}“ změň na „${request.article}“. V němčině je rod součást slovíčka.`
      : `Doplň člen „${request.article}“. U podstatných jmen je nejlepší ukládat do paměti člen a slovo jako jeden celek.`;
    tip = `Při dalším opakování nezačínej samotným „${request.german}“, ale rovnou „${target}“.`;
  } else if (request.keyboardEquivalent) {
    headline = 'Význam sedí, dolaď správný zápis';
    explanation = `Odpověď je významově správná. Ve finálním zápisu ale použij německou diakritiku přesně jako v „${target}“.`;
    tip = 'Na mobilu podrž písmeno a vyber ä, ö nebo ü; ß bývá v německé klávesnici samostatně.';
  } else if (!request.wordCorrect) {
    const attempt = request.submitted.trim() || 'prázdná odpověď';
    headline = request.editDistance <= 2 ? 'Zkontroluj pravopis' : 'Připomeň si správné slovo';
    explanation = `Napsala jsi „${attempt}“, cílový tvar je „${target}“. Zaměř se na pořadí písmen a koncovku.`;
  } else {
    headline = 'Správně. Zkus vlastní větu';
    explanation = `Tvar „${target}“ sedí. Další krok je vybavit ho bez nápovědy v celé větě.`;
  }

  return {
    headline,
    explanation,
    tip,
    miniExampleDe: request.article
      ? `Das ist ${request.article === 'der' ? 'der' : request.article === 'die' ? 'die' : 'das'} ${request.german}.`
      : `Ich benutze heute „${request.german}“.`,
    miniExampleCs: request.article
      ? `To je ${request.czech}.`
      : `Dnes používám výraz „${request.czech}“.`,
    model: DEMO_MODEL,
  };
}

function wordForms(request: AiSentenceEvaluationRequest): string[] {
  const forms = [request.german];
  if (request.verbForms) {
    forms.push(
      request.verbForms.thirdPerson ?? '',
      request.verbForms.preterite ?? '',
      request.verbForms.participle ?? '',
    );
  }
  if (request.plural) forms.push(request.plural);
  return forms.map((value) => value.trim().toLocaleLowerCase('de-DE')).filter(Boolean);
}

export function demoSentenceEvaluation(
  request: AiSentenceEvaluationRequest,
): AiSentenceEvaluationResult {
  const sentence = request.sentence.trim();
  const sentenceTokens = lexicalTokens(sentence);
  const targetUsed =
    wordForms(request).some((form) => containsLexicalForm(sentenceTokens, form)) ||
    (request.kind === 'adjective' &&
      germanAdjectiveInflectionMatches(sentenceTokens, request.german)) ||
    (request.kind === 'verb' && germanVerbInflectionMatches(sentenceTokens, request.german));
  const startsUppercase = /^[A-ZÄÖÜ]/u.test(sentence);
  const hasVerbShape =
    /\b(ich|du|er|sie|es|wir|ihr|Sie)\b/iu.test(sentence) || request.kind === 'phrase';
  const hasEnding = /[.!?]$/u.test(sentence);
  const enoughWords = sentence.split(/\s+/u).length >= 3;

  const grammarScore = Math.max(
    35,
    Math.min(
      100,
      45 +
        (targetUsed ? 25 : 0) +
        (startsUppercase ? 10 : 0) +
        (hasVerbShape ? 12 : 0) +
        (hasEnding ? 8 : 0),
    ),
  );
  const naturalnessScore = Math.max(
    40,
    Math.min(96, 50 + (enoughWords ? 22 : 0) + (targetUsed ? 16 : 0) + (hasEnding ? 8 : 0)),
  );
  const accepted = targetUsed && enoughWords && grammarScore >= 72;
  const correctedSentence =
    startsUppercase && hasEnding
      ? null
      : `${sentence.charAt(0).toLocaleUpperCase('de-DE')}${sentence.slice(1)}${hasEnding ? '' : '.'}`;

  let feedback =
    request.motherTongue === 'en'
      ? 'The target expression works in this sentence.'
      : 'Cílový výraz ve větě funguje.';
  if (!targetUsed) {
    feedback =
      request.motherTongue === 'en'
        ? `Use “${request.german}” or a correct inflected form directly in the sentence.`
        : `Použij ve větě přímo výraz „${request.german}“ nebo jeho správný tvar.`;
  } else if (!startsUppercase) {
    feedback =
      request.motherTongue === 'en'
        ? 'The expression is used well; start the sentence with a capital letter.'
        : 'Výraz je použitý dobře; začni větu velkým písmenem.';
  } else if (!hasEnding) {
    feedback =
      request.motherTongue === 'en'
        ? 'The expression is used well; add punctuation at the end.'
        : 'Výraz je použitý dobře; doplň na konec interpunkci.';
  } else if (!hasVerbShape) {
    feedback =
      request.motherTongue === 'en'
        ? 'The expression is present, but the sentence needs a clearer subject and verb.'
        : 'Výraz je použitý, ale věta potřebuje jasnější podmět a sloveso.';
  }

  return {
    accepted,
    targetUsedCorrectly: targetUsed,
    grammarScore,
    naturalnessScore,
    feedback,
    correctedSentence,
    czechMeaning: accepted
      ? request.motherTongue === 'en'
        ? `The sentence meaningfully uses “${request.czech}”; verify the exact translation against your intended context.`
        : `Věta smysluplně používá výraz „${request.czech}“; přesný překlad si ještě ověř podle zamýšleného kontextu.`
      : request.motherTongue === 'en'
        ? 'The meaning is not yet clear enough for a reliable translation.'
        : 'Význam zatím není dost jednoznačný pro spolehlivý překlad.',
    model: DEMO_MODEL,
  };
}
