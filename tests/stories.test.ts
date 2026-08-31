import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildStoryEpisodes,
  modernizeGermanOrthography,
  paginateStorySource,
  storyGlossaryTier,
  tokenizeStoryText,
} from '../src/lib/domain/stories/engine.ts';
import {
  normalizeStoryProgressMap,
  recordStoryEpisodeComplete,
  recordStoryExercise,
  recordStoryPage,
  recordStorySavedWord,
  storyBookPercent,
  storyBookIds,
} from '../src/lib/domain/stories/progress.ts';
import {
  enrichStoryGlossary,
  storySupportTokens,
} from '../src/lib/domain/stories/reading-support.ts';

import type { StoryBookId, StoryGlossaryEntry } from '../src/lib/domain/stories/types.ts';

const sourceCases: Array<{
  id: StoryBookId;
  screens: number;
  modernize?: boolean;
  namedHeadings?: string[];
}> = [
  { id: 'a1-maerchen', screens: 40, modernize: true },
  {
    id: 'a1-haewelmann',
    screens: 24,
    modernize: true,
    namedHeadings: ['Der kleine Häwelmann'],
  },
  {
    id: 'a1-bremer',
    screens: 16,
    modernize: true,
    namedHeadings: ['Die Bremer Stadtmusikanten'],
  },
  {
    id: 'a1-fabeln',
    screens: 16,
    modernize: true,
    namedHeadings: [
      'Das Roß und der Stier',
      'Der Affe und der Fuchs',
      'Der Besitzer des Bogens',
      'Der Esel mit dem Löwen',
      'Der Esel und das Jagdpferd',
      'Der Esel und der Wolf',
      'Der Fuchs',
      'Der Geizige',
    ],
  },
  {
    id: 'a1-haensel-gretel',
    screens: 16,
    namedHeadings: ['Brotkrumen im Wald', 'Das duftende Haus', 'Der Plan am Ofen', 'Der Heimweg'],
  },
  { id: 'a2-maerchen', screens: 40, modernize: true },
  {
    id: 'a2-max-moritz',
    screens: 32,
    modernize: true,
    namedHeadings: [
      '_VORWORT._',
      '_Erster Streich._',
      '_Zweiter Streich._',
      '_Dritter Streich._',
      '_Vierter Streich._',
      '_Fünfter Streich._',
      '_Sechster Streich._',
      '_Letzter Streich._',
      '_SCHLUSS._',
    ],
  },
  {
    id: 'a2-alice',
    screens: 24,
    modernize: true,
    namedHeadings: ['Erstes Kapitel', 'Hinunter in den Kaninchenbau.'],
  },
  {
    id: 'a2-mondfahrt',
    screens: 20,
    modernize: true,
    namedHeadings: ['1. Bild.'],
  },
  {
    id: 'a2-biene-maja',
    screens: 16,
    namedHeadings: [
      'Der erste Tag im Bienenstock',
      'Hinter dem Tor',
      'Stimmen auf der Wiese',
      'Das Netz zwischen den Blumen',
    ],
  },
  { id: 'b1-heidi', screens: 48 },
  { id: 'b1-kleider', screens: 128, modernize: true, namedHeadings: ['Kleider machen Leute'] },
  {
    id: 'b1-nils',
    screens: 28,
    modernize: true,
    namedHeadings: ['Der Junge', 'Das Wichtelmännchen'],
  },
  {
    id: 'b1-immensee',
    screens: 20,
    modernize: true,
    namedHeadings: ['IMMENSEE'],
  },
  {
    id: 'b1-tom-sawyer',
    screens: 16,
    namedHeadings: [
      'Die Strafe am Zaun',
      'Ein Handel ohne Geld',
      'Zeugen in der Nacht',
      'Der Mut zur Wahrheit',
    ],
  },
  { id: 'b2-schimmelreiter', screens: 60 },
  {
    id: 'b2-sandmann',
    screens: 116,
    modernize: true,
    namedHeadings: ['Der Sandmann', 'Nathanael an Lothar', 'Clara an Nathanael'],
  },
  {
    id: 'b2-taugenichts',
    screens: 36,
    modernize: true,
    namedHeadings: ['Erstes Kapitel'],
  },
  {
    id: 'b2-bahnwaerter',
    screens: 24,
    modernize: true,
    namedHeadings: ['Bahnwärter Thiel', 'Erstes Kapitel'],
  },
  {
    id: 'b2-schatzinsel',
    screens: 16,
    namedHeadings: [
      'Der Fremde an der Küste',
      'Die Karte in der Kiste',
      'Die Stimme im Fass',
      'Eine Entscheidung auf der Insel',
    ],
  },
  { id: 'c1-verwandlung', screens: 60 },
  { id: 'c1-urteil', screens: 40, modernize: true },
  {
    id: 'c1-krug',
    screens: 32,
    modernize: true,
    namedHeadings: ['Erster Auftritt', 'Zweiter Auftritt'],
  },
  {
    id: 'c1-wahlverwandtschaften',
    screens: 24,
    modernize: true,
    namedHeadings: ['Erster Teil', 'Erstes Kapitel'],
  },
  {
    id: 'c1-dorian-gray',
    screens: 16,
    namedHeadings: [
      'Das Porträt im Atelier',
      'Der Preis ewiger Jugend',
      'Die erste Veränderung',
      'Das verschlossene Gewissen',
    ],
  },
];

function source(id: StoryBookId): string {
  return readFileSync(
    new URL(`../src/lib/domain/stories/sources/${id}.txt`, import.meta.url),
    'utf8',
  );
}

test('všechny literární výběry se rozdělí na přesný počet krátkých obrazovek', () => {
  for (const item of sourceCases) {
    const pages = paginateStorySource(source(item.id), {
      bookId: item.id,
      screenCount: item.screens,
      modernize: item.modernize,
      namedHeadings:
        item.namedHeadings ?? (item.id === 'b1-heidi' ? ['Zum Alm-Öhi hinauf'] : undefined),
    });
    assert.equal(pages.length, item.screens);
    assert.equal(pages[0].number, 1);
    assert.equal(pages.at(-1)?.number, item.screens);
    assert.ok(Math.max(...pages.map((page) => page.wordCount)) <= 135);
    assert.ok(pages.every((page) => page.paragraphs.length > 0 && page.wordCount > 0));
  }
  assert.equal(sourceCases.length, 25);
  assert.equal(
    sourceCases.reduce((sum, item) => sum + item.screens, 0),
    908,
  );
  assert.deepEqual(
    storyBookIds,
    sourceCases.map((item) => item.id),
  );
});

test('lehká modernizace mění jen známé historické tvary', () => {
  assert.equal(
    modernizeGermanOrthography('Daß er die Thür öffnet, muß Hülfe geben.'),
    'Dass er die Tür öffnet, muss Hilfe geben.',
  );
  assert.equal(
    modernizeGermanOrthography('Jakob und Bonn bleiben gleich.'),
    'Jakob und Bonn bleiben gleich.',
  );
});

test('slovníček podtrhne i skloňovaný nebo časovaný tvar', () => {
  const entry: StoryGlossaryEntry = {
    id: 'test-erwachen',
    german: 'erwachen',
    czech: 'probudit se',
    kind: 'verb',
    cefr: 'B1',
    forms: ['erwachte'],
    distractors: ['schlief', 'blieb'],
    learningNote: 'Sloveso označuje přechod ze spánku do bdění.',
  };
  const tokens = tokenizeStoryText('Gregor erwachte unruhig.', [entry]);
  assert.equal(tokens.find((token) => token.word === 'erwachte')?.glossary?.id, entry.id);
});

test('náročnější slovní zásoba se odliší relativně k úrovni knihy', () => {
  assert.equal(storyGlossaryTier('B1', 'A2'), 'advanced');
  assert.equal(storyGlossaryTier('B1', 'B1'), 'focus');
  assert.equal(storyGlossaryTier('A2', 'B1'), 'support');
  assert.equal(storyGlossaryTier('C1', 'C1'), 'advanced');
});

test('čtyřstránkové epizody střídají dějovou osu, oblouk scény a vlastní převyprávění', () => {
  const pages = paginateStorySource(source('a1-maerchen'), {
    bookId: 'a1-maerchen',
    screenCount: 40,
    modernize: true,
  });
  const episodes = buildStoryEpisodes({
    bookId: 'a1-maerchen',
    pages,
    glossary: [],
    blueprints: Array.from({ length: 10 }, (_, index) => ({
      title: `Epizoda ${index + 1}`,
      summaryCs: 'Souvislá část příběhu.',
    })),
  });
  assert.equal(episodes.length, 10);
  assert.ok(episodes.every((episode) => episode.pages.length === 4));
  assert.ok(episodes.every((episode) => episode.checkpoints.length === 2));
  assert.ok(episodes.every((episode) => episode.checkpoints[0].exercise.kind === 'order'));
  assert.ok(
    episodes.every((episode, index) =>
      index % 2 === 1
        ? episode.checkpoints[1].exercise.kind === 'production'
        : index % 4 === 2
          ? episode.checkpoints[1].exercise.kind === 'arc'
          : episode.checkpoints[1].exercise.kind === 'sequence',
    ),
  );

  const timeline = episodes[0].checkpoints[1].exercise;
  assert.equal(timeline.kind, 'sequence');
  if (timeline.kind !== 'sequence') return;
  assert.equal(timeline.answer.length, 3);
  assert.deepEqual(timeline.options.toSorted(), timeline.answer.toSorted());
  const episodeText = episodes[0].pages.flatMap((page) => page.paragraphs).join(' ');
  const eventOffsets = timeline.answer.map((event) => episodeText.indexOf(event));
  assert.ok(eventOffsets.every((offset) => offset >= 0));
  assert.deepEqual(
    eventOffsets,
    eventOffsets.toSorted((left, right) => left - right),
  );

  const arc = episodes[2].checkpoints[1].exercise;
  assert.equal(arc.kind, 'arc');
  if (arc.kind !== 'arc') return;
  assert.equal(arc.options.length, 3);
  const answer = arc.options.find((option) => option.id === arc.answerId);
  assert.ok(answer);
  const arcEpisodeText = episodes[2].pages.flatMap((page) => page.paragraphs).join(' ');
  assert.ok(arcEpisodeText.includes(answer.openingDe));
  assert.ok(arcEpisodeText.includes(answer.closingDe));
  const earlierEpisodeText = episodes
    .slice(0, 2)
    .flatMap((episode) => episode.pages)
    .flatMap((page) => page.paragraphs)
    .join(' ');
  assert.ok(
    arc.options
      .filter((option) => option.id !== arc.answerId)
      .every(
        (option) =>
          earlierEpisodeText.includes(option.openingDe) &&
          earlierEpisodeText.includes(option.closingDe),
      ),
  );
  assert.equal(arc.summaryCs, 'Souvislá část příběhu.');
});

test('čtenářská podpora přidá jen ověřené výrazy z textu na hranici dané úrovně', () => {
  const pages = paginateStorySource(
    'Das Gesicht war eigentümlich. Das Kind schlief ruhig. Niemand rief.',
    {
      bookId: 'b2-schatzinsel',
      screenCount: 1,
    },
  );
  const glossary = enrichStoryGlossary({
    bookId: 'b2-schatzinsel',
    level: 'B2',
    pages,
    glossary: [],
  });

  assert.deepEqual(
    glossary.map((entry) => entry.german),
    ['eigentümlich'],
  );
  assert.equal(glossary[0].cefr, 'B2');
  assert.ok(glossary[0].forms.includes('eigentümliche'));

  const repeated = storySupportTokens(
    { paragraphs: ['eigentümlich, ganz eigentümlich und eigentümliche Zeichen'] },
    glossary,
    new Set(),
  ).flat();
  assert.equal(repeated.filter((token) => token.highlight).length, 1);

  const known = storySupportTokens(
    { paragraphs: ['ein eigentümliches Gesicht'] },
    glossary,
    new Set(['eigentümlich']),
  ).flat();
  assert.equal(known.filter((token) => token.highlight).length, 0);
});

test('každá třetí epizoda nabídne česko-německou slovní spojovačku', () => {
  const pages = paginateStorySource(source('a1-maerchen'), {
    bookId: 'a1-maerchen',
    screenCount: 40,
    modernize: true,
  });
  const glossary: StoryGlossaryEntry[] = [
    {
      id: 'horn',
      german: 'Hörner',
      czech: 'rohy',
      kind: 'noun',
      article: 'das',
      plural: 'Hörner',
      cefr: 'A1',
      forms: ['Horn'],
      distractors: ['anders', 'falsch'],
      learningNote: 'Testovací heslo.',
    },
    ...[
      ['wald', 'Wald', 'les', 'der'],
      ['haus', 'Haus', 'dům', 'das'],
      ['kind', 'Kind', 'dítě', 'das'],
    ].map(([id, german, czech, article]) => ({
      id,
      german,
      czech,
      kind: 'noun' as const,
      article: article as 'der' | 'die' | 'das',
      cefr: 'A1' as const,
      forms: [],
      distractors: ['anders', 'falsch'],
      learningNote: 'Testovací heslo.',
    })),
  ];
  const episodes = buildStoryEpisodes({
    bookId: 'a1-maerchen',
    pages,
    glossary,
    blueprints: Array.from({ length: 10 }, (_, index) => ({
      title: `Epizoda ${index + 1}`,
      summaryCs: 'Souvislá část příběhu.',
    })),
  });
  const exercise = episodes[2].checkpoints[0].exercise;

  assert.equal(exercise.kind, 'matching');
  if (exercise.kind !== 'matching') return;
  assert.equal(exercise.pairs.length, 4);
  assert.equal(exercise.czechOptions.length, exercise.germanOptions.length);
  assert.ok(exercise.pairs.some((pair) => pair.german === 'die Hörner'));
});

test('nové checkpointy vyžadují psané vybavení a produkci bez objektivního verdiktu', () => {
  const raw = Array.from(
    { length: 32 },
    (_, index) => `Im Wald entdeckt Leni die Spur Nummer ${index + 1} und geht ruhig weiter.`,
  ).join(' ');
  const pages = paginateStorySource(raw, {
    bookId: 'a1-haensel-gretel',
    screenCount: 8,
  });
  const glossary: StoryGlossaryEntry[] = [
    {
      id: 'wald',
      german: 'Wald',
      czech: 'les',
      kind: 'noun',
      article: 'der',
      plural: 'Wälder',
      cefr: 'A1',
      forms: [],
      distractors: ['Haus', 'Garten'],
      learningNote: 'Testovací heslo.',
    },
  ];
  const episodes = buildStoryEpisodes({
    bookId: 'a1-haensel-gretel',
    pages,
    glossary,
    blueprints: [
      { title: 'První', summaryCs: 'První část.' },
      { title: 'Druhá', summaryCs: 'Druhá část.' },
    ],
  });

  assert.equal(episodes[0].checkpoints[0].exercise.kind, 'recall');
  assert.equal(episodes[0].checkpoints[1].exercise.kind, 'sequence');
  assert.equal(episodes[1].checkpoints[0].exercise.kind, 'recall');
  assert.equal(episodes[1].checkpoints[1].exercise.kind, 'production');
  const production = episodes[1].checkpoints[1].exercise;
  if (production.kind !== 'production') return;
  assert.ok(production.modelAnswerDe.includes('Wald'));
  assert.ok(production.minimumWords >= 4);
});

test('postup četbou ukládá stránku, pokus, checkpoint, epizodu i slovíčko', () => {
  const now = new Date('2026-08-05T10:00:00.000Z');
  let progress = recordStoryPage(undefined, {
    bookId: 'b1-heidi',
    episodeId: 'b1-heidi-e01',
    pageNumber: 3,
    now,
  });
  progress = recordStoryExercise(progress, {
    bookId: 'b1-heidi',
    episodeId: 'b1-heidi-e01',
    checkpointId: 'b1-check-1',
    result: { completed: false, correct: false },
    now,
  });
  progress = recordStoryExercise(progress, {
    bookId: 'b1-heidi',
    episodeId: 'b1-heidi-e01',
    checkpointId: 'b1-check-1',
    result: { completed: true, correct: true },
    now,
  });
  progress = recordStorySavedWord(progress, {
    bookId: 'b1-heidi',
    episodeId: 'b1-heidi-e01',
    now,
  });
  progress = recordStoryEpisodeComplete(progress, {
    bookId: 'b1-heidi',
    episodeId: 'b1-heidi-e01',
    nextEpisodeId: 'b1-heidi-e02',
    now,
  });

  assert.equal(progress.furthestPage, 3);
  assert.equal(progress.exerciseAttempts, 2);
  assert.equal(progress.correctExercises, 1);
  assert.deepEqual(progress.completedCheckpointIds, ['b1-check-1']);
  assert.deepEqual(progress.completedEpisodeIds, ['b1-heidi-e01']);
  assert.equal(progress.currentEpisodeId, 'b1-heidi-e02');
  assert.equal(progress.savedWords, 1);
  assert.equal(storyBookPercent(progress, 48), 6);
});

test('produkční reflexe dokončí checkpoint, ale nefalšuje objektivní přesnost', () => {
  const progress = recordStoryExercise(undefined, {
    bookId: 'c1-dorian-gray',
    episodeId: 'c1-dorian-gray-e02',
    checkpointId: 'c1-dorian-gray-e2-b-checkpoint',
    result: { completed: true },
    now: new Date('2026-08-13T12:00:00.000Z'),
  });

  assert.deepEqual(progress.completedCheckpointIds, ['c1-dorian-gray-e2-b-checkpoint']);
  assert.equal(progress.exerciseAttempts, 0);
  assert.equal(progress.correctExercises, 0);
});

test('normalizace starého nebo částečného postupu doplní bezpečné výchozí hodnoty', () => {
  const normalized = normalizeStoryProgressMap({
    'a2-maerchen': {
      furthestPage: 8,
      lastPage: 7,
      currentEpisodeId: 'a2-maerchen-e02',
      completedEpisodeIds: ['a2-maerchen-e01'],
      exerciseAttempts: 3,
      correctExercises: 2,
      savedWords: 1,
      startedAt: '2026-08-05T09:00:00.000Z',
      updatedAt: '2026-08-05T10:00:00.000Z',
    },
    'c1-urteil': {
      furthestPage: 12,
      currentEpisodeId: 'c1-urteil-e03',
      completedEpisodeIds: ['c1-urteil-e01', 'c1-urteil-e02'],
      updatedAt: '2026-08-05T11:00:00.000Z',
    },
  });
  assert.deepEqual(normalized['a2-maerchen']?.completedCheckpointIds, []);
  assert.equal(normalized['a2-maerchen']?.furthestPage, 8);
  assert.equal(normalized['c1-urteil']?.furthestPage, 12);
  assert.equal(normalized['c1-urteil']?.currentEpisodeId, 'c1-urteil-e03');
});
