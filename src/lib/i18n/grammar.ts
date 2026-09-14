import type { GrammarCategory, GrammarLesson, GrammarQuestion } from '../domain/course/grammar.ts';
import type { MotherTongue } from '../domain/types.ts';

export type GrammarLessonCopy = {
  title: string;
  shortTitle: string;
  subtitle: string;
  concept: string;
  formula: string;
};

export type GrammarCategoryCopy = {
  title: string;
  description: string;
};

export type GrammarQuestionCopy = {
  prompt: string;
  instruction: string;
  explanation: string;
  skill: string;
  hint?: string;
};

const englishCategoryCopy: Record<string, GrammarCategoryCopy> = {
  'sentence-engine': {
    title: 'The sentence engine',
    description:
      'Verbs, questions, negation, and modal verbs: the structure that holds every sentence together.',
  },
  'verb-lab': {
    title: 'The verb workshop',
    description:
      'Present tense, separable prefixes, and the perfect tense without losing track of the forms.',
  },
  cases: {
    title: 'Articles and cases',
    description:
      'Gender, accusative, dative, and prepositions learned through meaning and context.',
  },
  'longer-sentences': {
    title: 'Longer, more precise sentences',
    description:
      'Connectors, information order, and adjective endings for more confident sentences.',
  },
  'connected-thoughts': {
    title: 'Connected ideas',
    description:
      'B1 clauses, hypotheses, and passive structures that move beyond short statements.',
  },
  'perspective-and-detail': {
    title: 'Relationships and perspective',
    description:
      'B2 control of time, conditions, relationships between events, and complete noun phrases.',
  },
  'precision-and-style': {
    title: 'Precision and style',
    description:
      'C1 control of information sources, degrees of certainty, and formal style without heavy prose.',
  },
  'daily-foundations': {
    title: 'Everyday foundations',
    description: 'Pronouns, possession, numbers, time, and instructions for early conversations.',
  },
  'everyday-phrases': {
    title: 'Sentences for everyday life',
    description: 'Objects, reflexive verbs, place, time, and ways to connect short statements.',
  },
  'reference-and-quantity': {
    title: 'Reference and quantity',
    description:
      'How much, to whom, and about what: pronouns, numbers, and verb-preposition pairs.',
  },
  'purpose-and-complements': {
    title: 'Purpose and verb complements',
    description:
      'Indirect questions, purpose clauses, infinitives, lassen, and first relative clauses.',
  },
  'narration-and-time': {
    title: 'Narration and time',
    description: 'Past events, time relationships, and natural ways to talk about the future.',
  },
  'case-system-plus': {
    title: 'The case system in depth',
    description: 'Genitive, strong endings, pronominal adverbs, and the order of two objects.',
  },
  'sentence-architecture': {
    title: 'Sentence architecture',
    description: 'Conditions, concession, result, and dense noun phrases at B2.',
  },
  'voice-and-modality': {
    title: 'Voice, tense, and modality',
    description: 'Future perfect, estimates, passive with modal meaning, and discourse particles.',
  },
  'text-cohesion': {
    title: 'Cohesion and information flow',
    description:
      'Links across sentences, proportional relationships, focus, and the right sentence field.',
  },
  'academic-precision': {
    title: 'Academic precision',
    description:
      'Fixed expressions, cautious claims, word formation, and punctuation in complex texts.',
  },
};

const englishLessonTitles: Record<string, string> = {
  'verb-second-position': 'The verb in second position',
  questions: 'Questions without guesswork',
  negation: 'Nicht or kein?',
  'modal-verbs': 'Modal verbs',
  'sein-haben': 'Using sein and haben automatically',
  'present-endings': 'Present-tense endings',
  'separable-verbs': 'Separable prefixes',
  'perfect-haben': 'The perfect tense with haben',
  'perfect-sein': 'The perfect tense with sein',
  'articles-gender': 'Gender and article as one unit',
  accusative: 'The accusative: whom or what?',
  dative: 'The dative: to whom or to what?',
  'two-way-prepositions': 'Where or where to?',
  'weil-dass': 'Weil and dass: the verb goes last',
  'time-manner-place': 'Time – manner – place',
  comparison: 'Comparatives and superlatives',
  'adjective-endings': 'Adjective endings: the first map',
  'mixed-checkpoint': 'Checkpoint: control the sentence',
  'praeteritum-core': 'Präteritum for stories and memories',
  'konjunktiv-two-present': 'Konjunktiv II: wishes, possibilities, and politeness',
  'relative-clauses': 'Relative clauses and the right pronoun case',
  'zu-infinitives': 'Infinitives with zu',
  'process-passive': 'The event passive: what is happening',
  'past-sequence': 'Plusquamperfekt and the order of past events',
  'past-counterfactual': 'Unreal situations in the past',
  'complex-connectors': 'Relationships between events',
  'passive-variants': 'Stative passive and natural alternatives',
  'adjective-endings-full': 'Adjective endings: the complete system',
  'n-declension': 'N-declension for masculine nouns',
  'indirect-speech': 'Konjunktiv I and neutral reported speech',
  'epistemic-modals': 'Modal verbs as degrees of certainty',
  'verb-clusters': 'The perfect tense with a double infinitive',
  'participial-attributes': 'Expanded participial attributes',
  'nominal-and-verbal-style': 'Choosing nominal or verbal style',
  'c1-editing-checkpoint': 'C1 checkpoint: precise without sounding heavy',
  'personal-pronouns': 'Personal pronouns as subjects',
  'possessive-articles': 'Possessive articles without guesswork',
  'numbers-and-prices': 'Numbers, prices, and decimal commas',
  'time-and-dates': 'Time, days, and dates',
  'imperative-basics': 'Commands, requests, and instructions',
  'dative-pronouns': 'Personal pronouns in the dative',
  'reflexive-verbs': 'Reflexive verbs in daily routines',
  'fixed-place-prepositions': 'Place and direction with fixed-case prepositions',
  'basic-time-prepositions': 'Time prepositions in a daily plan',
  'coordinating-connectors': 'Connectors that keep normal word order',
  'quantity-words': 'Quantity words for different noun types',
  'indefinite-pronouns': 'Indefinite pronouns for people and things',
  'ordinal-numbers': 'Ordinal numbers in dates and sequences',
  'possessive-pronouns': 'Possessive pronouns without a noun',
  'pronoun-es': 'The small word es in five common roles',
  'verb-preposition-basics': 'Verbs and their fixed prepositions',
  'indirect-questions': 'Indirect questions with ob and question words',
  'purpose-clauses': 'Purpose with damit and um … zu',
  'infinitive-complements': 'Zu-infinitives after verbs and adjectives',
  'lassen-constructions': 'Lassen: let, allow, and have something done',
  'paired-connectors-basic': 'Paired connectors for balanced sentences',
  'relative-clauses-basic': 'First relative clauses in nominative and accusative',
  'praeteritum-lexical-verbs': 'Präteritum of lexical verbs',
  'als-wenn-wann': 'Als, wenn, and wann',
  'before-after-clauses': 'Bevor and nachdem on a timeline',
  'future-with-werden': 'Futur I for plans, promises, and predictions',
  'present-for-future': 'Using the present tense for the future',
  'genitive-case': 'The genitive for relationships and possession',
  'genitive-prepositions': 'Genitive prepositions in precise writing',
  'adjectives-without-article': 'Adjectives without an article',
  'da-wo-compounds': 'Pronominal adverbs with da(r)- and wo(r)-',
  'two-object-order': 'Dative and accusative in one sentence',
  'conditional-without-wenn': 'Conditions without wenn',
  'concession-patterns': 'Concession with obwohl, trotzdem, and zwar',
  'result-and-degree': 'Result and degree with sodass and so … dass',
  'participles-as-adjectives': 'Partizip I and II as adjectives',
  'nominalized-adjectives': 'Nominalised adjectives and participles',
  'future-perfect': 'Futur II for a completed future',
  'subjective-modal-perfect': 'Modal assumptions about the past',
  'passive-with-modals': 'The passive with modal verbs',
  'passive-agent-and-tense': 'Tense and agent in the event passive',
  'modal-particles': 'Modal particles in natural speech',
  'reference-adverbs': 'Reference adverbs across sentences',
  'proportional-comparison': 'Proportional relationships with je … desto/umso',
  'focus-constructions': 'Focus and topic framing',
  'right-field-structure': 'The right sentence field without overload',
  'noun-verb-collocations': 'Functional verb phrases in formal writing',
  'hedging-and-distance': 'Distance, caution, and degrees of certainty',
  'word-formation': 'Word formation as a grammar tool',
  'complex-punctuation': 'Punctuation that reveals sentence structure',
  'noun-plurals': 'Noun plurals without a false universal ending',
  'present-vowel-change': 'Vowel changes in the present tense',
  'accusative-prepositions': 'Prepositions that always take the accusative',
  'dative-prepositions': 'Prepositions that always take the dative',
  'demonstrative-determiners': 'Dieser, jeder, and welcher as determiners',
  'connector-adverbs': 'Deshalb and sonst: connection with inversion',
  'adjective-endings-after-ein': 'Adjective endings after ein, mein, and kein',
  'position-and-placement-verbs': 'Liegen, legen, stehen, and stellen',
  'temporal-subordinate-clauses': 'Seitdem, bis, sobald, and solange',
  'brauchen-nicht-zu': 'Brauchen + nicht zu for “do not need to”',
  'adjective-prepositions': 'Adjectives and their fixed prepositions',
  'nominalized-infinitives': 'Infinitives used as nouns',
  'prepositional-relative-clauses': 'Relative clauses with prepositions',
  'hypothetical-comparisons': 'Hypothetical comparisons with als ob',
  'perfect-infinitive': 'The perfect infinitive: what should already have happened',
  'clause-correlates': 'Darauf, dass and daran, zu as bridges to complements',
  'negation-scope': 'The scope of negation',
  'connective-relative-clauses': 'Relative clauses referring to a whole idea',
  'gerundive-attributes': 'Gerundive attributes: what must or can be done',
  'nuanced-connectors': 'Nuanced logical relationships in advanced texts',
  'compound-noun-gender': 'The gender of German compounds',
  'seit-versus-vor': 'Seit or vor? Talking about time',
  'ohne-anstatt-zu': 'Ohne zu and anstatt zu',
  'man-versus-passive': 'Man or the passive?',
  'source-attribution-phrases': 'Precise source attribution',
  'es-gibt-accusative': 'Es gibt: saying what is there',
  'wer-wen-wem': 'Wer, wen, or wem?',
  'separable-imperative': 'Instructions with separable verbs',
  'hin-her-direction': 'Hin or her?',
  'schon-noch-erst': 'Schon, noch, and erst',
  'werden-change': 'Werden as a change of state',
  'nouns-with-prepositions': 'Nouns with prepositions',
  'waehrend-clause': 'Während as a conjunction',
  'reciprocal-einander': 'Sich or einander?',
  'genitive-relative-pronouns': 'Dessen and deren',
  'indem-dadurch-dass': 'Indem and dadurch, dass',
  'haben-sein-zu-infinitive': 'Haben and sein + zu',
  'evidential-sollen-wollen': 'Sollen and wollen for reported claims',
  'apposition-case-punctuation': 'Apposition: case and punctuation',
  'ellipsis-parallelism': 'Ellipsis and parallel structure',
};

export function grammarCategoryCopy(
  language: MotherTongue,
  category: GrammarCategory,
): GrammarCategoryCopy {
  if (language === 'cs') return { title: category.title, description: category.description };
  return (
    englishCategoryCopy[category.id] ?? {
      title: category.title,
      description: 'A focused set of German grammar lessons.',
    }
  );
}

export function grammarLessonCopy(
  language: MotherTongue,
  lesson: GrammarLesson,
): GrammarLessonCopy {
  if (language === 'cs') {
    return {
      title: lesson.title,
      shortTitle: lesson.shortTitle,
      subtitle: lesson.subtitle,
      concept: lesson.concept,
      formula: lesson.formula,
    };
  }

  const title = englishLessonTitles[lesson.id] ?? lesson.id.replaceAll('-', ' ');
  return {
    title,
    shortTitle: title,
    subtitle: `Practise ${title.toLocaleLowerCase('en')}.`,
    concept: `Focus on how German expresses ${title.toLocaleLowerCase('en')}. Notice the form and word order in the examples, then apply the same pattern in the short activities.`,
    formula: `German pattern · ${title}`,
  };
}

export function grammarQuestionCopy(
  language: MotherTongue,
  question: GrammarQuestion,
  lessonCopy: GrammarLessonCopy,
): GrammarQuestionCopy {
  if (language === 'cs') {
    return {
      prompt: question.prompt,
      instruction: question.instruction,
      explanation: question.explanation,
      skill: question.skill,
      hint: question.kind === 'fill' ? question.hint : undefined,
    };
  }

  const instruction =
    question.kind === 'choice'
      ? 'Choose the correct German option.'
      : question.kind === 'fill'
        ? 'Complete the missing part of the German sentence.'
        : 'Build a correct German sentence using all the tokens.';
  const prompt =
    question.kind === 'choice'
      ? `Which option correctly applies “${lessonCopy.title}”?`
      : question.kind === 'fill'
        ? 'Which form completes this German sentence?'
        : 'Build the German sentence.';

  return {
    prompt,
    instruction,
    explanation: `The correct answer follows the pattern from “${lessonCopy.title}”. Compare the verb position, case, and ending with the German example.`,
    skill: lessonCopy.shortTitle,
    hint:
      question.kind === 'fill'
        ? `Use the pattern from “${lessonCopy.title}” and check the surrounding words.`
        : undefined,
  };
}

export function grammarExampleTranslation(
  language: MotherTongue,
  example: GrammarLesson['examples'][number],
): string | undefined {
  return language === 'cs' ? example.cs : undefined;
}

export function hasEnglishGrammarTitle(lessonId: string): boolean {
  return lessonId in englishLessonTitles;
}
