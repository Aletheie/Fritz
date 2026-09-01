import { z } from 'zod';

import { AI_VOCABULARY_MAX_ITEMS } from '../../domain/ai/limits.ts';
import { MISTAKE_TAGS } from '../../domain/types.ts';
import { VOCABULARY_LIMITS } from '../../domain/vocabulary/validation.ts';

export const cefrSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
export const articleSchema = z.enum(['der', 'die', 'das']);
export const kindSchema = z.enum(['noun', 'verb', 'adjective', 'phrase', 'other']);
export const auxiliarySchema = z.enum(['haben', 'sein']);
export const motherTongueSchema = z.enum(['cs', 'en']).default('cs');

export const generatedVerbFormsSchema = z.object({
  thirdPerson: z.string().max(100).nullable(),
  preterite: z.string().max(100).nullable(),
  participle: z.string().max(100).nullable(),
  auxiliary: auxiliarySchema.nullable(),
});

export const generatedVocabularyItemSchema = z.object({
  german: z.string().min(1).max(140),
  czech: z.string().min(1).max(220),
  kind: kindSchema,
  article: articleSchema.nullable(),
  plural: z.string().max(140).nullable(),
  acceptedGerman: z.array(z.string().min(1).max(140)).max(5),
  acceptedCzech: z.array(z.string().min(1).max(220)).max(5),
  tags: z.array(z.string().min(1).max(40)).max(8),
  exampleDe: z.string().max(300).nullable(),
  exampleCs: z.string().max(300).nullable(),
  cefr: cefrSchema,
  learningNote: z.string().max(320).nullable(),
  mnemonic: z.string().max(320).nullable(),
  verbForms: generatedVerbFormsSchema.nullable(),
});

export const vocabularyOutputSchema = z.object({
  title: z.string().min(1).max(100),
  summary: z.string().min(1).max(280),
  items: z.array(generatedVocabularyItemSchema).min(1).max(AI_VOCABULARY_MAX_ITEMS),
});

const baseGenerationSchema = {
  motherTongue: motherTongueSchema,
  count: z.number().int().min(1).max(AI_VOCABULARY_MAX_ITEMS),
  level: cefrSchema,
  includeMnemonics: z.boolean(),
};

export const vocabularyRequestSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('generate'),
    topic: z.string().trim().min(2).max(500),
    focus: z.enum(['balanced', 'nouns', 'verbs', 'phrases']),
    ...baseGenerationSchema,
  }),
  z.object({
    mode: z.literal('extract'),
    text: z.string().trim().min(20).max(20_000),
    ...baseGenerationSchema,
  }),
  z.object({
    mode: z.literal('enrich'),
    motherTongue: motherTongueSchema,
    note: z.object({
      german: z.string().trim().min(1).max(140),
      czech: z.string().trim().min(1).max(220),
      kind: kindSchema,
      article: articleSchema.optional(),
      plural: z.string().max(140).optional(),
      acceptedGerman: z.array(z.string().max(140)).max(5),
      acceptedCzech: z.array(z.string().max(220)).max(5),
      tags: z.array(z.string().max(40)).max(20),
      exampleDe: z.string().max(300).optional(),
      exampleCs: z.string().max(300).optional(),
      cefr: cefrSchema.optional(),
      learningNote: z.string().max(320).optional(),
      mnemonic: z.string().max(320).optional(),
      verbForms: z
        .object({
          thirdPerson: z.string().max(100).optional(),
          preterite: z.string().max(100).optional(),
          participle: z.string().max(100).optional(),
          auxiliary: auxiliarySchema.optional(),
        })
        .optional(),
    }),
  }),
]);

export const explanationRequestSchema = z.object({
  motherTongue: motherTongueSchema,
  german: z.string().trim().min(1).max(140),
  czech: z.string().trim().min(1).max(220),
  article: articleSchema.optional(),
  kind: kindSchema,
  submitted: z.string().max(300),
  selectedArticle: articleSchema.optional(),
  wordCorrect: z.boolean(),
  articleCorrect: z.boolean(),
  keyboardEquivalent: z.boolean(),
  editDistance: z.number().int().min(0).max(100),
  learningNote: z.string().max(320).optional(),
});

export const explanationOutputSchema = z.object({
  headline: z
    .string()
    .min(1)
    .max(60)
    .describe('Pouze 2 až 6 českých slov bez markdownu; název chyby, ne celé vysvětlení.'),
  explanation: z
    .string()
    .min(1)
    .max(500)
    .describe('Samostatné stručné české vysvětlení konkrétní chyby bez markdownu.'),
  tip: z
    .string()
    .min(1)
    .max(300)
    .describe('Jedna samostatná praktická pomůcka pro příští vybavení.'),
  miniExampleDe: z.string().min(1).max(220).describe('Pouze jedna krátká přirozená německá věta.'),
  miniExampleCs: z.string().min(1).max(220).describe('Přesný český překlad miniExampleDe.'),
});

export const sentenceEvaluationRequestSchema = z.object({
  motherTongue: motherTongueSchema,
  german: z.string().trim().min(1).max(140),
  czech: z.string().trim().min(1).max(220),
  kind: kindSchema,
  article: articleSchema.optional(),
  plural: z.string().max(140).optional(),
  verbForms: z
    .object({
      thirdPerson: z.string().max(100).optional(),
      preterite: z.string().max(100).optional(),
      participle: z.string().max(100).optional(),
      auxiliary: auxiliarySchema.optional(),
    })
    .optional(),
  sentence: z.string().trim().min(3).max(600),
});

export const sentenceEvaluationOutputSchema = z.object({
  accepted: z.boolean(),
  targetUsedCorrectly: z.boolean(),
  grammarScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Celé procentní skóre 0 až 100; nikdy nepoužívej stupnici 0 až 10.'),
  naturalnessScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Celé procentní skóre 0 až 100; nikdy nepoužívej stupnici 0 až 10.'),
  feedback: z.string().min(1).max(500),
  correctedSentence: z.string().max(600).nullable(),
  czechMeaning: z.string().min(1).max(500),
});

const coachMessageSchema = z.object({
  role: z.enum(['coach', 'learner']),
  text: z.string().trim().min(1).max(600),
});

const coachRequestBaseSchema = {
  motherTongue: motherTongueSchema,
  scenarioId: z.string().trim().min(1).max(80),
  scenarioTitle: z.string().trim().min(1).max(160),
  goal: z.string().trim().min(1).max(280),
  level: cefrSchema,
  turn: z.number().int().min(1).max(8),
  maxTurns: z.number().int().min(1).max(8),
  message: z.string().trim().min(1).max(600),
  focusWords: z.array(z.string().trim().min(1).max(100)).max(8),
  history: z.array(coachMessageSchema).max(16),
};

export const coachRequestSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('conversation'),
    ...coachRequestBaseSchema,
  }),
  z.object({
    mode: z.literal('repair'),
    ...coachRequestBaseSchema,
    turn: z.literal(1),
    maxTurns: z.literal(1),
    history: z.array(coachMessageSchema).max(2),
    repair: z.object({
      evidenceId: z.string().trim().min(1).max(300),
      mistakeTag: z.enum(MISTAKE_TAGS),
    }),
  }),
]);

export const coachOutputSchema = z.object({
  reply: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe('Jedna až dvě krátké přirozené německé věty postavy trenéra.'),
  accepted: z.boolean().describe('Zda replika studentky dává smysl v dané situaci.'),
  outcome: z
    .enum(['accepted', 'needs-support', 'retry'])
    .describe('Přijatá replika, žádost studentky o podporu bez postupu, nebo nový pokus.'),
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Celé procentní skóre 0 až 100; nikdy nepoužívej stupnici 0 až 10.'),
  feedback: z.string().trim().min(1).max(500).describe('Stručná konkrétní zpětná vazba v češtině.'),
  correction: z
    .string()
    .trim()
    .max(600)
    .nullable()
    .describe('Lepší německá verze, nebo null, pokud oprava není potřeba.'),
  nextHint: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .describe('Krátká česká nápověda pro následující repliku studentky.'),
  missionProgress: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe('Celé procento splnění mise od 0 do 100.'),
  diagnostics: z
    .array(
      z.object({
        tag: z.enum(MISTAKE_TAGS),
        confidence: z.enum(['medium', 'high']),
      }),
    )
    .max(3)
    .describe('Jen skutečně pozorované, dostatečně jisté vzorce chyb; jinak prázdné pole.'),
});

const storyKnownWordSchema = z.object({
  german: z.string().trim().min(1).max(140),
  czech: z.string().trim().min(1).max(220),
  kind: kindSchema,
  article: articleSchema.optional(),
  plural: z.string().max(140).optional(),
  cefr: cefrSchema,
  learningNote: z.string().max(320).optional(),
});

export const storyWordRequestSchema = z.object({
  motherTongue: motherTongueSchema,
  word: z.string().trim().min(1).max(100),
  sentence: z.string().trim().min(1).max(1_200),
  bookTitle: z.string().trim().min(1).max(180),
  level: cefrSchema,
  known: storyKnownWordSchema.optional(),
});

export const storyWordOutputSchema = z.object({
  word: z.string().trim().min(1).max(100),
  contextMeaning: z.string().trim().min(1).max(300),
  grammarNote: z.string().trim().min(1).max(400),
  morphology: z.string().trim().min(1).max(400),
  collocation: z.string().trim().min(1).max(300),
  recallQuestion: z.string().trim().min(1).max(300),
  registerNote: z.string().trim().min(1).max(300).nullable(),
  item: generatedVocabularyItemSchema,
});

export const storySelectionRequestSchema = z.object({
  motherTongue: motherTongueSchema,
  action: z.enum(['translate', 'explain']),
  text: z.string().trim().min(1).max(1_200),
  context: z.string().trim().min(1).max(2_400),
  bookTitle: z.string().trim().min(1).max(180),
  level: cefrSchema,
});

export const storySelectionOutputSchema = z.object({
  translationCs: z.string().trim().min(1).max(1_800),
  explanationCs: z.string().trim().min(1).max(VOCABULARY_LIMITS.learningNote),
  grammarHighlights: z.array(z.string().trim().min(1).max(300)).max(5),
  suggestedGerman: z.string().trim().min(1).max(VOCABULARY_LIMITS.german),
  suggestedCzech: z.string().trim().min(1).max(VOCABULARY_LIMITS.czech),
});

const mistakeTagSchema = z.enum([
  'article',
  'gender',
  'plural',
  'verb-form',
  'auxiliary',
  'separable-prefix',
  'word-order',
  'case',
  'preposition',
  'negation',
  'spelling',
  'meaning',
  'register',
  'fluency',
  'unknown',
]);

const contextLexemeSchema = z.object({
  noteId: z.string().trim().min(1).max(200),
  german: z.string().trim().min(1).max(140),
  czech: z.string().trim().min(1).max(220),
  kind: kindSchema,
  article: articleSchema.optional(),
  acceptedGerman: z.array(z.string().trim().min(1).max(140)).max(5),
  acceptedCzech: z.array(z.string().trim().min(1).max(220)).max(5),
  exampleDe: z.string().trim().max(300).optional(),
  exampleCs: z.string().trim().max(300).optional(),
});

export const contextDrillRequestSchema = z.object({
  motherTongue: motherTongueSchema,
  chapterId: z.string().trim().min(1).max(100).optional(),
  level: cefrSchema,
  lexemes: z.array(contextLexemeSchema).min(3).max(8),
  objectiveIds: z.array(z.string().trim().min(1).max(100)).max(8),
  mistakes: z
    .array(z.object({ tag: mistakeTagSchema, count: z.number().int().min(1).max(10_000) }))
    .max(8),
});

export const contextDrillOutputSchema = z.object({
  drills: z
    .array(
      z.object({
        type: z.enum(['translation', 'cloze', 'contrast', 'word-order']),
        prompt: z.string().trim().min(1).max(500),
        answer: z.string().trim().min(1).max(300),
        acceptedAnswers: z.array(z.string().trim().min(1).max(300)).max(6),
        explanation: z.string().trim().min(1).max(500),
        sourceNoteIds: z.array(z.string().trim().min(1).max(200)).min(1).max(3),
        objectiveIds: z.array(z.string().trim().min(1).max(100)).max(4),
      }),
    )
    .min(3)
    .max(6),
});

export const adaptiveHintRequestSchema = z.object({
  motherTongue: motherTongueSchema,
  note: contextLexemeSchema,
  submitted: z.string().max(300),
  objectiveIds: z.array(z.string().trim().min(1).max(100)).max(6),
  mistakeTags: z.array(mistakeTagSchema).max(6),
  revealAnswer: z.boolean(),
});

export const adaptiveHintOutputSchema = z.object({
  hint: z.string().trim().min(1).max(300),
  rule: z.string().trim().min(1).max(400),
  exampleDe: z.string().trim().min(1).max(220),
  exampleCs: z.string().trim().min(1).max(220),
  confidence: z.enum(['high', 'medium', 'low']),
  sourceObjectiveIds: z.array(z.string().trim().min(1).max(100)).max(6),
});
