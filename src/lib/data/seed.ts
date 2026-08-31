import { normalizeGermanKey } from '../domain/grading/normalize.ts';
import { createDefaultSettings } from '../domain/settings/defaults.ts';

import type { AppSettings, Deck, Note, StudyCard } from '../domain/types.ts';

type SeedWord = {
  german: string;
  czech: string;
  article?: 'der' | 'die' | 'das';
  plural?: string;
  kind: Note['kind'];
  tags: string[];
  exampleDe?: string;
  exampleCs?: string;
};

const words: SeedWord[] = [
  {
    german: 'Hund',
    czech: 'pes',
    article: 'der',
    plural: 'die Hunde',
    kind: 'noun',
    tags: ['zvířata', 'a1'],
    exampleDe: 'Der Hund schläft unter dem Tisch.',
    exampleCs: 'Pes spí pod stolem.',
  },
  {
    german: 'Katze',
    czech: 'kočka',
    article: 'die',
    plural: 'die Katzen',
    kind: 'noun',
    tags: ['zvířata', 'a1'],
  },
  {
    german: 'Haus',
    czech: 'dům',
    article: 'das',
    plural: 'die Häuser',
    kind: 'noun',
    tags: ['domov', 'a1'],
  },
  {
    german: 'Schule',
    czech: 'škola',
    article: 'die',
    plural: 'die Schulen',
    kind: 'noun',
    tags: ['škola', 'a1'],
  },
  {
    german: 'Freund',
    czech: 'kamarád',
    article: 'der',
    plural: 'die Freunde',
    kind: 'noun',
    tags: ['lidé', 'a1'],
  },
  {
    german: 'Buch',
    czech: 'kniha',
    article: 'das',
    plural: 'die Bücher',
    kind: 'noun',
    tags: ['škola', 'a1'],
  },
  {
    german: 'Schlüssel',
    czech: 'klíč',
    article: 'der',
    plural: 'die Schlüssel',
    kind: 'noun',
    tags: ['domov', 'a2'],
  },
  {
    german: 'Fahrrad',
    czech: 'jízdní kolo',
    article: 'das',
    plural: 'die Fahrräder',
    kind: 'noun',
    tags: ['doprava', 'a1'],
  },
  {
    german: 'lernen',
    czech: 'učit se',
    kind: 'verb',
    tags: ['slovesa', 'a1'],
    exampleDe: 'Ich lerne jeden Abend Deutsch.',
    exampleCs: 'Každý večer se učím německy.',
  },
  {
    german: 'sprechen',
    czech: 'mluvit',
    kind: 'verb',
    tags: ['slovesa', 'a1'],
  },
  {
    german: 'vergessen',
    czech: 'zapomenout',
    kind: 'verb',
    tags: ['slovesa', 'a2'],
  },
  {
    german: 'pünktlich',
    czech: 'dochvilný',
    kind: 'adjective',
    tags: ['vlastnosti', 'a2'],
  },
  {
    german: 'schön',
    czech: 'hezký',
    kind: 'adjective',
    tags: ['vlastnosti', 'a1'],
  },
  {
    german: 'Guten Morgen',
    czech: 'dobré ráno',
    kind: 'phrase',
    tags: ['fráze', 'a1'],
  },
];

export function createSeedData(now = new Date()): {
  deck: Deck;
  notes: Note[];
  cards: StudyCard[];
  settings: AppSettings;
} {
  const timestamp = now.toISOString();
  const deckId = 'deck_german_school';
  const deck: Deck = {
    id: deckId,
    title: 'Němčina do školy',
    description: 'Ukázkový balíček pro první spuštění',
    desiredRetention: 0.9,
    dailyNewLimit: 15,
    exerciseMix: { typing: 60, choice: 20, flashcard: 20 },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const notes = words.map<Note>((word, index) => ({
    id: `note_seed_${index + 1}`,
    deckId,
    german: word.german,
    normalizedGerman: normalizeGermanKey(word.german, word.article),
    czech: word.czech,
    kind: word.kind,
    article: word.article,
    plural: word.plural,
    acceptedGerman: [],
    acceptedCzech: [],
    tags: word.tags,
    exampleDe: word.exampleDe,
    exampleCs: word.exampleCs,
    cefr:
      (word.tags.find((tag) => /^a[12]$/u.test(tag))?.toUpperCase() as Note['cefr']) ?? undefined,
    source: 'seed',
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  const verbFormsByGerman: Record<string, Note['verbForms']> = {
    lernen: {
      thirdPerson: 'lernt',
      preterite: 'lernte',
      participle: 'gelernt',
      auxiliary: 'haben',
    },
    sprechen: {
      thirdPerson: 'spricht',
      preterite: 'sprach',
      participle: 'gesprochen',
      auxiliary: 'haben',
    },
    vergessen: {
      thirdPerson: 'vergisst',
      preterite: 'vergaß',
      participle: 'vergessen',
      auxiliary: 'haben',
    },
  };
  for (const note of notes) note.verbForms = verbFormsByGerman[note.german];

  const cards = notes.map<StudyCard>((note, index) => ({
    id: `card_seed_${index + 1}`,
    deckId,
    noteId: note.id,
    direction: 'cs-de',
    dueAt: new Date(now.getTime() - index * 1_000).toISOString(),
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  const settings: AppSettings = createDefaultSettings(now);

  return { deck, notes, cards, settings };
}
