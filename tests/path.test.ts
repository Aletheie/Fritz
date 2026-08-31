import assert from 'node:assert/strict';
import test from 'node:test';

import { createCourseProgress, normalizeCourseProgress } from '../src/lib/domain/course/grammar.ts';
import {
  checkpointForChapter,
  completeCoursePathNode,
  coursePathChapterById,
  coursePathChapterUnlocked,
  coursePathNodeState,
  coursePathViews,
  currentCoursePathNode,
  startCoursePathNode,
  storyBookIsUnlocked,
  visibleCoursePathChapters,
} from '../src/lib/domain/course/path.ts';

const now = new Date('2026-08-06T08:00:00.000Z');

test('cesta začne prvním uzlem první kapitoly odpovídající nastavené úrovni', () => {
  const progress = createCourseProgress(now);
  assert.equal(currentCoursePathNode(progress, 'A1.1')?.id, 'chapter-01-school:vocabulary');
  assert.equal(currentCoursePathNode(progress, 'B1.1')?.id, 'chapter-19-study-goals:vocabulary');
  assert.equal(visibleCoursePathChapters('B1.1')[0].level, 'B1.1');
  assert.equal(
    visibleCoursePathChapters('B1.1').some((chapter) => chapter.level === 'A1.1'),
    false,
  );
});

test('budoucí uzel je zamčený a dokončení aktuálního odemkne právě jeden další', () => {
  const chapter = coursePathChapterById('chapter-01-school');
  assert.ok(chapter);
  const [first, second, third] = chapter.nodes;
  const initial = createCourseProgress(now);
  assert.equal(coursePathNodeState(initial, first, 'A1.1'), 'current');
  assert.equal(coursePathNodeState(initial, second, 'A1.1'), 'locked');
  assert.equal(coursePathNodeState(initial, third, 'A1.1'), 'locked');

  const completed = completeCoursePathNode(initial, first.id, 2, now).progress;
  assert.equal(coursePathNodeState(completed, first, 'A1.1'), 'completed');
  assert.equal(coursePathNodeState(completed, second, 'A1.1'), 'current');
  assert.equal(coursePathNodeState(completed, third, 'A1.1'), 'locked');
});

test('rozpracovaný uzel se po obnovení označí jako rozpracovaný', () => {
  const progress = createCourseProgress(now);
  const node = currentCoursePathNode(progress, 'A1.1');
  assert.ok(node);
  const started = startCoursePathNode(progress, node.id, now);
  assert.equal(coursePathNodeState(started, node, 'A1.1'), 'in-progress');
  assert.equal(started.pathNodes[node.id]?.startedAt, now.toISOString());

  const completed = completeCoursePathNode(
    started,
    node.id,
    3,
    new Date('2026-08-06T08:05:00.000Z'),
  );
  assert.equal(completed.progress.pathNodes[node.id]?.xpAwarded, node.xp);
  assert.equal(completed.event?.xpAwarded, node.xp);
});

test('checkpoint odemkne další kapitolu i bonusovou četbu', () => {
  const first = coursePathChapterById('chapter-01-school');
  const second = coursePathChapterById('chapter-31-first-introduction');
  assert.ok(first);
  assert.ok(second);
  let progress = createCourseProgress(now);
  for (const node of first.nodes.filter((candidate) => candidate.required)) {
    progress = completeCoursePathNode(progress, node.id, 3, now).progress;
  }

  assert.equal(coursePathChapterUnlocked(progress, second, 'A1.1'), true);
  assert.equal(progress.unlockedStoryBooks.includes(first.storyBookId), true);
  assert.equal(coursePathNodeState(progress, first.nodes.at(-1)!, 'A1.1'), 'bonus');
});

test('opakované dokončení je idempotentní pro XP a může jen zlepšit hvězdy', () => {
  const progress = createCourseProgress(now);
  const node = currentCoursePathNode(progress, 'A1.1');
  assert.ok(node);
  const first = completeCoursePathNode(progress, node.id, 1, now);
  const repeated = completeCoursePathNode(
    first.progress,
    node.id,
    3,
    new Date('2026-08-06T08:05:00.000Z'),
  );

  assert.equal(first.firstCompletion, true);
  assert.equal(first.xpAwarded, node.xp);
  assert.equal(repeated.firstCompletion, false);
  assert.equal(repeated.xpAwarded, 0);
  assert.equal(repeated.starsImproved, true);
  assert.equal(repeated.stars, 3);
  assert.equal(repeated.progress.pathEvents.length, 1);
  assert.equal(repeated.progress.pathNodes[node.id]?.attempts, 2);
});

test('kapitola má konečný průběh se sedmi povinnými uzly a checkpointem', () => {
  const views = coursePathViews(createCourseProgress(now), 'A1.1');
  const first = views[0];
  assert.equal(first.requiredTotal, 7);
  assert.equal(first.chapter.nodes.length, 8);
  assert.equal(checkpointForChapter(first.chapter).order, 7);
  assert.equal(first.percent, 0);
  assert.equal(first.nodes.filter((view) => view.state === 'current').length, 1);
});

test('doménová vrstva odmítne přeskočení uzlu i obsah pod nastavenou úrovní', () => {
  const progress = createCourseProgress(now);
  const firstChapter = coursePathChapterById('chapter-01-school');
  assert.ok(firstChapter);
  assert.throws(
    () => startCoursePathNode(progress, firstChapter.nodes[1].id, now, 'A1.1'),
    /zamčený/u,
  );
  assert.throws(
    () => completeCoursePathNode(progress, firstChapter.nodes[0].id, 2, now, 'B1.1'),
    /zamčený/u,
  );
  assert.equal(currentCoursePathNode(progress, 'B1.1')?.chapterId, 'chapter-19-study-goals');
});

test('rozečtená kniha zůstane dostupná i bez nového seznamu odemčení', () => {
  const progress = createCourseProgress(now);
  assert.equal(storyBookIsUnlocked(progress, 'a1-maerchen'), false);
  const started = {
    ...progress,
    storyBooks: {
      'a1-maerchen': {
        bookId: 'a1-maerchen' as const,
        furthestPage: 1,
        lastPage: 1,
        currentEpisodeId: 'a1-maerchen-e01',
        completedEpisodeIds: [],
        completedCheckpointIds: [],
        exerciseAttempts: 0,
        correctExercises: 0,
        savedWords: 0,
        startedAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    },
  };
  assert.equal(storyBookIsUnlocked(started, 'a1-maerchen'), true);
});

test('nový třetí titul úrovně se odemkne spolu s jejím druhým checkpointem', () => {
  const progress = {
    ...createCourseProgress(now),
    unlockedStoryBooks: ['a1-haewelmann' as const],
  };
  assert.equal(storyBookIsUnlocked(progress, 'a1-bremer'), true);
  assert.equal(storyBookIsUnlocked(progress, 'a2-alice'), false);
});

test('pět dalších titulů se odemkne se stávajícím checkpointem své úrovně', () => {
  const pairs = [
    ['a1-haewelmann', 'a1-fabeln'],
    ['a2-max-moritz', 'a2-mondfahrt'],
    ['b1-kleider', 'b1-immensee'],
    ['b2-sandmann', 'b2-bahnwaerter'],
    ['c1-urteil', 'c1-wahlverwandtschaften'],
  ] as const;

  for (const [checkpointBookId, newBookId] of pairs) {
    const progress = {
      ...createCourseProgress(now),
      unlockedStoryBooks: [checkpointBookId],
    };
    assert.equal(storyBookIsUnlocked(progress, newBookId), true, newBookId);
  }
});

test('známé YA a NA adaptace se odemknou s odpovídající policí své úrovně', () => {
  const pairs = [
    ['a1-haewelmann', 'a1-haensel-gretel'],
    ['a2-max-moritz', 'a2-biene-maja'],
    ['b1-kleider', 'b1-tom-sawyer'],
    ['b2-sandmann', 'b2-schatzinsel'],
    ['c1-urteil', 'c1-dorian-gray'],
  ] as const;

  for (const [checkpointBookId, adaptedBookId] of pairs) {
    const progress = {
      ...createCourseProgress(now),
      unlockedStoryBooks: [checkpointBookId],
    };
    assert.equal(storyBookIsUnlocked(progress, adaptedBookId), true, adaptedBookId);
  }
});

test('normalizace opraví dvě známé nekonzistence z živého dokončení cesty', () => {
  const initial = createCourseProgress(now);
  const node = currentCoursePathNode(initial, 'A1.1');
  assert.ok(node);
  const started = startCoursePathNode(initial, node.id, now);
  const completion = completeCoursePathNode(
    started,
    node.id,
    3,
    new Date('2026-08-06T08:05:00.000Z'),
  );
  assert.ok(completion.event);
  const corrupted = {
    ...completion.progress,
    pathNodes: {
      ...completion.progress.pathNodes,
      [node.id]: { ...completion.progress.pathNodes[node.id], xpAwarded: 0 },
    },
    vocabularyEvents: [
      {
        id: `course-vocabulary:${node.id}`,
        nodeId: node.id,
        chapterId: node.chapterId,
        completedAt: '2026-08-06T08:05:00.004Z',
        addedNoteIds: [],
        linkedNoteIds: [],
        systemTags: ['kurz'],
      },
    ],
  };
  const normalized = normalizeCourseProgress(corrupted, now);
  assert.equal(normalized.pathNodes[node.id].xpAwarded, completion.event.xpAwarded);
  assert.equal(normalized.vocabularyEvents[0].completedAt, completion.event.completedAt);
});

test('content v4 zachová pozici uživatele z v1 bez relocku a bez syntetických odměn', () => {
  const first = coursePathChapterById('chapter-01-school');
  assert.ok(first);
  const completedAt = now.toISOString();
  const legacy = {
    ...createCourseProgress(now),
    contentVersion: 1,
    pathNodes: Object.fromEntries(
      first.nodes
        .filter((node) => node.required)
        .map((node) => [
          node.id,
          {
            nodeId: node.id,
            startedAt: completedAt,
            completedAt,
            attempts: 1,
            bestStars: 2 as const,
            xpAwarded: node.xp,
            updatedAt: completedAt,
          },
        ]),
    ),
  };

  const migrated = normalizeCourseProgress(legacy, now);
  assert.deepEqual(migrated.grandfatheredChapterIds, [
    'chapter-31-first-introduction',
    'chapter-11-classroom',
    'chapter-32-find-the-right-page',
    'chapter-33-ask-for-repetition',
    'chapter-12-cafe-bakery',
    'chapter-34-simple-order',
    'chapter-35-price-and-payment',
    'chapter-36-takeaway-order',
    'chapter-37-repair-the-order',
    'chapter-101-market-groceries',
    'chapter-102-hobby-meetup',
  ]);
  assert.equal(currentCoursePathNode(migrated, 'A1.1')?.id, 'chapter-02-day:vocabulary');

  const replay = completeCoursePathNode(migrated, 'chapter-11-classroom:vocabulary', 3, now);
  assert.equal(replay.firstCompletion, false);
  assert.equal(replay.xpAwarded, 0);
  assert.equal(replay.event?.xpAwarded, 0);
  assert.equal(replay.event?.baseXp, 0);
  assert.equal(replay.progress.pathEvents.length, migrated.pathEvents.length + 1);
  assert.equal(replay.progress.pathNodes['chapter-11-classroom:vocabulary']?.xpAwarded, 0);
});

test('content v4 zachová také pozici uživatele z třicetikapitolové v2 mapy', () => {
  const first = coursePathChapterById('chapter-01-school');
  assert.ok(first);
  const completedAt = now.toISOString();
  const versionTwo = {
    ...createCourseProgress(now),
    contentVersion: 2,
    pathNodes: Object.fromEntries(
      first.nodes
        .filter((node) => node.required)
        .map((node) => [
          node.id,
          {
            nodeId: node.id,
            startedAt: completedAt,
            completedAt,
            attempts: 1,
            bestStars: 2 as const,
            xpAwarded: node.xp,
            updatedAt: completedAt,
          },
        ]),
    ),
  };

  const migrated = normalizeCourseProgress(versionTwo, now);
  assert.deepEqual(migrated.grandfatheredChapterIds, ['chapter-31-first-introduction']);
  assert.equal(currentCoursePathNode(migrated, 'A1.1')?.id, 'chapter-11-classroom:vocabulary');
});

test('content v4 zachová pozici uživatele ze stokapitolové v3 mapy', () => {
  const completedA11Chapters = visibleCoursePathChapters('A1.1').filter(
    (chapter) => chapter.level === 'A1.1' && chapter.contentVersion <= 3,
  );
  const completedAt = now.toISOString();
  const versionThree = {
    ...createCourseProgress(now),
    contentVersion: 3,
    pathNodes: Object.fromEntries(
      completedA11Chapters
        .flatMap((chapter) => chapter.nodes.filter((node) => node.required))
        .map((node) => [
          node.id,
          {
            nodeId: node.id,
            startedAt: completedAt,
            completedAt,
            attempts: 1,
            bestStars: 2 as const,
            xpAwarded: node.xp,
            updatedAt: completedAt,
          },
        ]),
    ),
  };

  const migrated = normalizeCourseProgress(versionThree, now);
  assert.equal(migrated.grandfatheredChapterIds.includes('chapter-101-market-groceries'), true);
  assert.equal(migrated.grandfatheredChapterIds.includes('chapter-102-hobby-meetup'), true);
  assert.equal(currentCoursePathNode(migrated, 'A1.1')?.id, 'chapter-02-day:vocabulary');
});

test('nový uživatel content v4 musí vložené kapitoly skutečně projít', () => {
  const progress = createCourseProgress(now);
  assert.equal(progress.contentVersion, 4);
  assert.deepEqual(progress.grandfatheredChapterIds, []);
  assert.equal(
    coursePathChapterUnlocked(
      progress,
      coursePathChapterById('chapter-31-first-introduction')!,
      'A1.1',
    ),
    false,
  );
});
