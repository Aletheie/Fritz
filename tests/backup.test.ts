import assert from 'node:assert/strict';
import test from 'node:test';

import { createSeedData } from '../src/lib/data/seed.ts';
import { parseBackup } from '../src/lib/domain/backup/validate.ts';
import { createCourseProgress } from '../src/lib/domain/course/grammar.ts';
import {
  completeCoursePathNode,
  currentCoursePathNode,
  pathXp,
} from '../src/lib/domain/course/path.ts';
import {
  buildCourseVocabularyMutation,
  removeNoteFromCourseVocabularyEvents,
} from '../src/lib/domain/course/vocabulary.ts';
import { purchaseDoubleXp } from '../src/lib/domain/course/wallet.ts';
import { storyBookIds } from '../src/lib/domain/stories/progress.ts';

function validBackup() {
  const seed = createSeedData(new Date('2026-08-03T12:00:00.000Z'));
  return {
    schemaVersion: 8,
    exportedAt: '2026-08-03T12:01:00.000Z',
    decks: [seed.deck],
    notes: seed.notes,
    cards: seed.cards,
    reviews: [] as Array<Record<string, unknown>>,
    learningEvidence: [],
    settings: seed.settings,
    course: createCourseProgress(new Date('2026-08-03T12:00:00.000Z')),
  };
}

test('validní záloha projde kontrolou', () => {
  const parsed = parseBackup(validBackup());
  assert.equal(parsed.decks.length, 1);
  assert.equal(parsed.notes.length, parsed.cards.length);
});

test('obnova odmítne neúplnou nebo poškozenou FSRS kartu místo tichého resetu', () => {
  const incomplete = validBackup();
  incomplete.cards[0] = { ...incomplete.cards[0], fsrs: { due: incomplete.cards[0].dueAt } };

  const invalidCounter = validBackup();
  invalidCounter.cards[0] = {
    ...invalidCounter.cards[0],
    fsrs: { ...invalidCounter.cards[0].fsrs, reps: -1 },
  };

  assert.throws(() => parseBackup(incomplete), /FSRS/iu);
  assert.throws(() => parseBackup(invalidCounter), /FSRS/iu);
});

test('starší záloha se bezpečně migruje na verzi 8', () => {
  const backup = validBackup();
  const {
    dailyGoal: _dailyGoal,
    accentTheme: _accentTheme,
    grammarLevel: _grammarLevel,
    motherTongue: _motherTongue,
    autoSpeakGerman: _autoSpeakGerman,
    celebrations: _celebrations,
    gamificationEnabled: _gamificationEnabled,
    requireCorrection: _requireCorrection,
    showKeyboardHints: _showKeyboardHints,
    ...legacySettings
  } = backup.settings;

  const parsed = parseBackup({
    ...backup,
    schemaVersion: 1,
    settings: { ...legacySettings, schemaVersion: 1 },
    course: undefined,
  });

  assert.equal(parsed.schemaVersion, 8);
  assert.deepEqual(parsed.learningEvidence, []);
  assert.equal(parsed.settings.schemaVersion, 9);
  assert.equal(parsed.settings.onboardingCompleted, true);
  assert.equal(parsed.settings.dailyMinutes, 10);
  assert.equal(parsed.settings.motherTongue, 'cs');
  assert.equal(parsed.settings.grammarLevel, 'A1.1');
  assert.equal(parsed.course.schemaVersion, 6);
  assert.deepEqual(parsed.course.events, []);
  assert.deepEqual(parsed.course.coachEvents, []);
  assert.deepEqual(parsed.course.lessonBestStars, {});
  assert.deepEqual(parsed.course.storyBooks, {});
  assert.deepEqual(parsed.course.pathNodes, {});
  assert.deepEqual(parsed.course.pathEvents, []);
  assert.deepEqual(parsed.course.vocabularyEvents, []);
  assert.deepEqual(parsed.course.unlockedStoryBooks, []);
  assert.deepEqual(parsed.course.wallet, { purchases: [], boosts: [] });
  assert.equal(parsed.settings.dailyGoal, 20);
  assert.equal(parsed.settings.accentTheme, 'green');
  assert.equal(parsed.settings.gamificationEnabled, true);
  assert.equal(parsed.settings.requireCorrection, true);
  assert.equal(parsed.settings.trainingSourceFilter, 'all');
});

test('záloha v6 bez nového pole odvodí evidenci z existujícího review', () => {
  const backup = validBackup();
  const card = backup.cards[0];
  const note = backup.notes[0];
  backup.reviews = [
    {
      id: 'legacy-review-for-evidence',
      cardId: card.id,
      noteId: note.id,
      deckId: note.deckId,
      reviewedAt: '2026-08-03T12:02:00.000Z',
      mode: 'long-term',
      exercise: 'typing',
      rating: 'good',
      signal: {
        exercise: 'typing',
        wordCorrect: true,
        articleCorrect: true,
        exact: true,
        keyboardEquivalent: false,
        editDistance: 0,
        responseMs: 900,
        hintsUsed: 0,
        attempt: 1,
      },
    },
  ];
  const legacy = { ...backup, schemaVersion: 6 } as Record<string, unknown>;
  delete legacy.learningEvidence;

  const parsed = parseBackup(legacy);
  assert.equal(parsed.schemaVersion, 8);
  assert.equal(parsed.learningEvidence.length, 1);
  assert.equal(parsed.learningEvidence[0].source, 'vocabulary-review');
});

test('záloha v7 musí nést zdrojovou evidenci, ne pouze odvozený stav', () => {
  const current = { ...validBackup(), schemaVersion: 7 } as Record<string, unknown>;
  delete current.learningEvidence;
  assert.throws(() => parseBackup(current), /neobsahuje důkazy učení/iu);
});

test('postup kurzem verze 2 doplní nejlepší hvězdy bez ztráty historie', () => {
  const backup = validBackup();
  const legacyCourse = {
    ...backup.course,
    schemaVersion: 2,
  } as Record<string, unknown>;
  delete legacyCourse.lessonBestStars;

  const parsed = parseBackup({ ...backup, course: legacyCourse });
  assert.equal(parsed.course.schemaVersion, 6);
  assert.deepEqual(parsed.course.lessonBestStars, {});
  assert.deepEqual(parsed.course.events, backup.course.events);
});

test('záloha zachová mateřštinu, barevný akcent i podrobnou úroveň', () => {
  const backup = validBackup();
  backup.settings = {
    ...backup.settings,
    motherTongue: 'en',
    accentTheme: 'rose',
    grammarLevel: 'B1.2',
  };

  assert.equal(parseBackup(backup).settings.motherTongue, 'en');
  assert.equal(parseBackup(backup).settings.accentTheme, 'rose');
  assert.equal(parseBackup(backup).settings.grammarLevel, 'B1.2');
});

test('neznámá verze zálohy se odmítne', () => {
  const backup = { ...validBackup(), schemaVersion: 9 };
  assert.throws(() => parseBackup(backup), /Nepodporovaná verze/u);
});

test('duplicitní ID se odmítne', () => {
  const backup = validBackup();
  backup.notes = [backup.notes[0], backup.notes[0]];
  assert.throws(() => parseBackup(backup), /duplicitní ID/u);
});

test('karta s neznámou poznámkou se odmítne', () => {
  const backup = validBackup();
  backup.cards[0] = { ...backup.cards[0], noteId: 'missing' };
  assert.throws(() => parseBackup(backup), /neplatnou vazbu/u);
});

test('mix úloh musí mít součet 100 procent', () => {
  const backup = validBackup();
  backup.settings = {
    ...backup.settings,
    exerciseMix: { typing: 60, choice: 20, flashcard: 10 },
  };
  assert.throws(() => parseBackup(backup), /součet není 100/u);
});

test('neznámý rating v historii se odmítne', () => {
  const backup = validBackup();
  const card = backup.cards[0];
  const note = backup.notes[0];
  backup.reviews = [
    {
      id: 'review-invalid-rating',
      cardId: card.id,
      noteId: note.id,
      deckId: note.deckId,
      reviewedAt: '2026-08-03T12:02:00.000Z',
      mode: 'long-term',
      exercise: 'typing',
      rating: 'perfect',
      signal: {
        exercise: 'typing',
        submittedText: note.german,
        normalizedText: note.normalizedGerman,
        selectedArticle: note.article,
        wordCorrect: true,
        articleCorrect: true,
        exact: true,
        keyboardEquivalent: false,
        editDistance: 0,
        responseMs: 1_200,
        hintsUsed: 0,
        attempt: 1,
      },
    },
  ];
  assert.throws(() => parseBackup(backup), /neplatný režim, typ úlohy nebo rating/u);
});

test('typ úlohy v review musí odpovídat signálu', () => {
  const backup = validBackup();
  const card = backup.cards[0];
  const note = backup.notes[0];
  backup.reviews = [
    {
      id: 'review-mismatch',
      cardId: card.id,
      noteId: note.id,
      deckId: note.deckId,
      reviewedAt: '2026-08-03T12:02:00.000Z',
      mode: 'cram',
      exercise: 'choice',
      rating: 'good',
      signal: {
        exercise: 'typing',
        wordCorrect: true,
        articleCorrect: true,
        exact: true,
        keyboardEquivalent: false,
        editDistance: 0,
        responseMs: 900,
        hintsUsed: 0,
        attempt: 1,
      },
    },
  ];
  assert.throws(() => parseBackup(backup), /neodpovídá uloženému signálu/u);
});

test('review nesmí odkazovat na jinou kartu nebo poznámku', () => {
  const backup = validBackup();
  const card = backup.cards[0];
  const note = backup.notes[0];
  backup.reviews = [
    {
      id: 'review-bad-link',
      cardId: card.id,
      noteId: backup.notes[1].id,
      deckId: note.deckId,
      reviewedAt: '2026-08-03T12:02:00.000Z',
      mode: 'long-term',
      exercise: 'flashcard',
      rating: 'good',
      signal: {
        exercise: 'flashcard',
        wordCorrect: true,
        articleCorrect: true,
        exact: true,
        keyboardEquivalent: false,
        editDistance: 0,
        responseMs: 1_000,
        hintsUsed: 0,
        attempt: 1,
      },
    },
  ];
  assert.throws(() => parseBackup(backup), /má neplatnou vazbu/u);
});

test('záloha čistí gramatická pole, která nepatří k druhu slova', () => {
  const backup = validBackup();
  backup.notes[8] = {
    ...backup.notes[8],
    kind: 'verb',
    article: 'der',
    plural: 'die Lernens',
  };

  const parsed = parseBackup(backup);
  assert.equal(parsed.notes[8].article, undefined);
  assert.equal(parsed.notes[8].plural, undefined);
  assert.equal(parsed.notes[8].verbForms?.participle, 'gelernt');
});

test('podstatné jméno bez členu se v záloze odmítne', () => {
  const backup = validBackup();
  backup.notes[0] = { ...backup.notes[0], article: undefined };
  assert.throws(() => parseBackup(backup), /člen/iu);
});

test('duplicitní normalizované slovíčko se odmítne i s jiným ID', () => {
  const backup = validBackup();
  backup.notes[1] = {
    ...backup.notes[1],
    german: backup.notes[0].german,
    article: backup.notes[0].article,
    normalizedGerman: 'podvržená-hodnota',
  };
  assert.throws(() => parseBackup(backup), /duplicitní slovíčko/iu);
});

test('starší extrémní nastavení se stáhne do podporovaného rozsahu', () => {
  const backup = validBackup();
  backup.settings = {
    ...backup.settings,
    profileName: 'A'.repeat(200),
    desiredRetention: 0.99,
    dailyNewLimit: 1_000,
    dailyGoal: 500,
  };

  const parsed = parseBackup(backup);
  assert.equal(parsed.settings.profileName.length, 50);
  assert.equal(parsed.settings.desiredRetention, 0.95);
  assert.equal(parsed.settings.dailyNewLimit, 30);
  assert.equal(parsed.settings.dailyGoal, 200);
});

test('primární balíček se při migraci sjednotí s globálním nastavením', () => {
  const backup = validBackup();
  backup.decks[0] = {
    ...backup.decks[0],
    desiredRetention: 0.72,
    dailyNewLimit: 999,
    exerciseMix: { typing: 10, choice: 10, flashcard: 80 },
  };

  const parsed = parseBackup(backup);
  assert.equal(parsed.decks[0].desiredRetention, parsed.settings.desiredRetention);
  assert.equal(parsed.decks[0].dailyNewLimit, parsed.settings.dailyNewLimit);
  assert.deepEqual(parsed.decks[0].exerciseMix, parsed.settings.exerciseMix);
});

test('každé slovíčko musí mít alespoň jednu studijní kartu', () => {
  const backup = validBackup();
  const orphan = backup.notes[0];
  backup.cards = backup.cards.filter((card) => card.noteId !== orphan.id);

  assert.throws(() => parseBackup(backup), /nemá žádnou studijní kartu/iu);
});

test('stejné slovíčko nesmí mít dvě karty ve stejném směru', () => {
  const backup = validBackup();
  backup.cards.push({ ...backup.cards[0], id: 'duplicate-direction-card' });

  assert.throws(() => parseBackup(backup), /duplicitní kartu/iu);
});

test('postup kurzem verze 4 zachová starou četbu dostupnou a doplní nový stav', () => {
  const backup = validBackup();
  const legacyCourse = { ...backup.course, schemaVersion: 4 } as Record<string, unknown>;
  delete legacyCourse.pathNodes;
  delete legacyCourse.pathEvents;
  delete legacyCourse.vocabularyEvents;
  delete legacyCourse.unlockedStoryBooks;
  delete legacyCourse.wallet;

  const parsed = parseBackup({ ...backup, course: legacyCourse });
  assert.equal(parsed.course.schemaVersion, 6);
  assert.deepEqual(parsed.course.pathNodes, {});
  assert.deepEqual(parsed.course.pathEvents, []);
  assert.deepEqual(parsed.course.vocabularyEvents, []);
  assert.deepEqual(parsed.course.wallet, { purchases: [], boosts: [] });
  assert.deepEqual(new Set(parsed.course.unlockedStoryBooks), new Set(storyBookIds));
});

test('export a obnova zachová postup cesty, původ kurzových slov a jejich vazby', () => {
  const backup = validBackup();
  const now = new Date('2026-08-03T12:02:00.000Z');
  const node = currentCoursePathNode(backup.course, backup.settings.grammarLevel);
  assert.ok(node);
  assert.equal(node.type, 'vocabulary');

  const mutation = buildCourseVocabularyMutation({
    progress: backup.course,
    notes: backup.notes,
    deckId: backup.decks[0].id,
    nodeId: node.id,
    now,
  });
  const changedById = new Map(mutation.notesToPut.map((note) => [note.id, note]));
  const existingIds = new Set(backup.notes.map((note) => note.id));
  backup.notes = [
    ...backup.notes.map((note) => changedById.get(note.id) ?? note),
    ...mutation.notesToPut.filter((note) => !existingIds.has(note.id)),
  ];
  backup.cards = [...backup.cards, ...mutation.cardsToPut];
  const completed = completeCoursePathNode(backup.course, node.id, 2, now);
  backup.course = {
    ...completed.progress,
    vocabularyEvents: mutation.event
      ? [...completed.progress.vocabularyEvents, mutation.event]
      : completed.progress.vocabularyEvents,
  };

  const parsed = parseBackup(backup);
  assert.equal(parsed.course.pathEvents.length, 1);
  assert.equal(parsed.course.vocabularyEvents.length, 1);
  assert.equal(parsed.course.pathNodes[node.id]?.bestStars, 2);
  assert.equal(mutation.summary.added, 3);
  assert.equal(mutation.summary.linked, 2);
  for (const noteId of [...mutation.summary.addedNoteIds, ...mutation.summary.linkedNoteIds]) {
    const note = parsed.notes.find((candidate) => candidate.id === noteId);
    assert.ok(note);
    assert.equal(note.systemTags?.includes('kurz'), true);
    assert.equal(
      note.courseLinks?.some((link) => link.nodeId === node.id),
      true,
    );
  }
  const linkedSeedNote = parsed.notes.find((note) => note.german === 'Schule');
  assert.ok(linkedSeedNote);
  assert.equal(linkedSeedNote.source, 'seed');
  assert.equal(linkedSeedNote.tags.includes('škola'), true);
});

test('záloha zůstane platná po smazání dříve importovaného kurzového slova', () => {
  const backup = validBackup();
  const now = new Date('2026-08-03T12:02:00.000Z');
  const node = currentCoursePathNode(backup.course, backup.settings.grammarLevel);
  assert.ok(node);
  const mutation = buildCourseVocabularyMutation({
    progress: backup.course,
    notes: backup.notes,
    deckId: backup.decks[0].id,
    nodeId: node.id,
    now,
  });
  assert.ok(mutation.event);
  const changedById = new Map(mutation.notesToPut.map((note) => [note.id, note]));
  const existingIds = new Set(backup.notes.map((note) => note.id));
  backup.notes = [
    ...backup.notes.map((note) => changedById.get(note.id) ?? note),
    ...mutation.notesToPut.filter((note) => !existingIds.has(note.id)),
  ];
  backup.cards = [...backup.cards, ...mutation.cardsToPut];
  const completion = completeCoursePathNode(
    backup.course,
    node.id,
    2,
    now,
    backup.settings.grammarLevel,
  );
  backup.course = {
    ...completion.progress,
    vocabularyEvents: [...completion.progress.vocabularyEvents, mutation.event],
  };

  const deletedNoteId = mutation.event.addedNoteIds[0];
  assert.ok(deletedNoteId);
  backup.notes = backup.notes.filter((note) => note.id !== deletedNoteId);
  backup.cards = backup.cards.filter((card) => card.noteId !== deletedNoteId);
  backup.course = removeNoteFromCourseVocabularyEvents(
    backup.course,
    deletedNoteId,
    new Date('2026-08-03T12:03:00.000Z'),
  );

  const parsed = parseBackup(backup);
  assert.equal(
    parsed.notes.some((note) => note.id === deletedNoteId),
    false,
  );
  assert.equal(parsed.course.vocabularyEvents[0].addedNoteIds.includes(deletedNoteId), false);
});

test('export a obnova zachová peněženku a aktivní double XP', () => {
  const backup = validBackup();
  let progress = backup.course;
  let tick = 0;
  while (pathXp(progress) < 120) {
    const node = currentCoursePathNode(progress, backup.settings.grammarLevel);
    assert.ok(node);
    progress = completeCoursePathNode(
      progress,
      node.id,
      2,
      new Date(Date.parse('2026-08-03T12:05:00.000Z') + tick * 1_000),
      backup.settings.grammarLevel,
    ).progress;
    tick += 1;
  }
  backup.course = purchaseDoubleXp(
    progress,
    pathXp(progress),
    new Date('2026-08-03T12:20:00.000Z'),
  ).progress;

  const parsed = parseBackup(backup);
  assert.equal(parsed.course.wallet.purchases.length, 1);
  assert.equal(parsed.course.wallet.boosts.length, 1);
  assert.equal(parsed.course.wallet.boosts[0].status, 'active');
  assert.equal(parsed.course.wallet.purchases[0].price, 120);
});

test('peněženka uzná i XP dopočítaná ze starších review bez uloženého xpAwarded', () => {
  const backup = validBackup();
  const card = backup.cards[0];
  const note = backup.notes[0];
  backup.exportedAt = '2026-08-14T12:00:00.000Z';
  backup.reviews = Array.from({ length: 10 }, (_, index) => ({
    id: `legacy-review-${index + 1}`,
    cardId: card.id,
    noteId: note.id,
    deckId: note.deckId,
    reviewedAt: new Date(Date.parse('2026-08-03T12:02:00.000Z') + index * 86_400_000).toISOString(),
    mode: 'long-term',
    exercise: 'typing',
    rating: 'good',
    signal: {
      exercise: 'typing',
      submittedText: note.german,
      normalizedText: note.normalizedGerman,
      selectedArticle: note.article,
      wordCorrect: true,
      articleCorrect: true,
      exact: true,
      keyboardEquivalent: false,
      editDistance: 0,
      responseMs: 1_200,
      hintsUsed: 0,
      attempt: 1,
    },
  }));
  backup.course = purchaseDoubleXp(
    backup.course,
    120,
    new Date('2026-08-14T11:00:00.000Z'),
  ).progress;

  const parsed = parseBackup(backup);
  assert.equal(parsed.course.wallet.purchases.length, 1);
  assert.equal(parsed.course.wallet.boosts[0].status, 'active');
});

test('záloha odmítne duplicitní nebo překrývající se ID v importu kurzových slov', () => {
  const backup = validBackup();
  const now = new Date('2026-08-03T12:02:00.000Z');
  const node = currentCoursePathNode(backup.course, backup.settings.grammarLevel);
  assert.ok(node);
  const mutation = buildCourseVocabularyMutation({
    progress: backup.course,
    notes: backup.notes,
    deckId: backup.decks[0].id,
    nodeId: node.id,
    now,
  });
  assert.ok(mutation.event);
  const changedById = new Map(mutation.notesToPut.map((note) => [note.id, note]));
  const existingIds = new Set(backup.notes.map((note) => note.id));
  backup.notes = [
    ...backup.notes.map((note) => changedById.get(note.id) ?? note),
    ...mutation.notesToPut.filter((note) => !existingIds.has(note.id)),
  ];
  backup.cards = [...backup.cards, ...mutation.cardsToPut];
  const completion = completeCoursePathNode(
    backup.course,
    node.id,
    2,
    now,
    backup.settings.grammarLevel,
  );
  const sharedNoteId = mutation.event.addedNoteIds[0] ?? mutation.event.linkedNoteIds[0];
  assert.ok(sharedNoteId);
  backup.course = {
    ...completion.progress,
    vocabularyEvents: [
      {
        ...mutation.event,
        linkedNoteIds: [...mutation.event.linkedNoteIds, sharedNoteId],
      },
    ],
  };

  assert.throws(() => parseBackup(backup), /stejné slovíčko jako nové i existující/iu);
});

test('záloha odmítne dokončený uzel bez první kreditované události', () => {
  const backup = validBackup();
  const node = currentCoursePathNode(backup.course, backup.settings.grammarLevel);
  assert.ok(node);
  const completion = completeCoursePathNode(
    backup.course,
    node.id,
    2,
    new Date('2026-08-03T12:02:00.000Z'),
    backup.settings.grammarLevel,
  );
  backup.course = { ...completion.progress, pathEvents: [] };

  assert.throws(() => parseBackup(backup), /chybí první kreditovaná událost/iu);
});

test('grandfathered replay uloží nulovou událost a zůstane načitatelný', () => {
  const backup = validBackup();
  const nodeId = 'chapter-11-classroom:vocabulary';
  backup.course = {
    ...backup.course,
    grandfatheredChapterIds: ['chapter-11-classroom'],
  };

  const replay = completeCoursePathNode(
    backup.course,
    nodeId,
    3,
    new Date('2026-08-03T12:02:00.000Z'),
    backup.settings.grammarLevel,
  );
  backup.course = replay.progress;

  assert.equal(replay.firstCompletion, false);
  assert.equal(replay.event?.xpAwarded, 0);
  assert.equal(parseBackup(backup).course.pathEvents.at(-1)?.nodeId, nodeId);
});

test('záloha zachová spotřebovaný double XP a odmítne bonus odpojený od události', () => {
  const backup = validBackup();
  let progress = backup.course;
  let tick = 0;
  while (pathXp(progress) < 120) {
    const node = currentCoursePathNode(progress, backup.settings.grammarLevel);
    assert.ok(node);
    progress = completeCoursePathNode(
      progress,
      node.id,
      2,
      new Date(Date.parse('2026-08-03T12:05:00.000Z') + tick * 1_000),
      backup.settings.grammarLevel,
    ).progress;
    tick += 1;
  }
  progress = purchaseDoubleXp(
    progress,
    pathXp(progress),
    new Date('2026-08-03T12:20:00.000Z'),
  ).progress;
  const boostedNode = currentCoursePathNode(progress, backup.settings.grammarLevel);
  assert.ok(boostedNode);
  progress = completeCoursePathNode(
    progress,
    boostedNode.id,
    2,
    new Date('2026-08-03T12:21:00.000Z'),
    backup.settings.grammarLevel,
  ).progress;
  backup.course = progress;

  const parsed = parseBackup(backup);
  assert.equal(parsed.course.wallet.boosts[0].status, 'consumed');
  assert.equal(parsed.course.wallet.boosts[0].consumedByNodeId, boostedNode.id);
  assert.equal(parsed.course.pathEvents.at(-1)?.boosted, true);

  const consumedBoost = backup.course.wallet.boosts[0];
  backup.course = {
    ...backup.course,
    wallet: {
      ...backup.course.wallet,
      boosts: [
        {
          id: consumedBoost.id,
          itemId: consumedBoost.itemId,
          purchasedAt: consumedBoost.purchasedAt,
          status: 'active',
        },
      ],
    },
  };
  assert.throws(() => parseBackup(backup), /chybí spotřebovaný double XP bonus/iu);
});
