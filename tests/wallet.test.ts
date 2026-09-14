import assert from 'node:assert/strict';
import test from 'node:test';

import { createCourseProgress } from '../src/lib/domain/course/grammar.ts';
import { completeCoursePathNode, currentCoursePathNode } from '../src/lib/domain/course/path.ts';
import {
  DOUBLE_XP_NEXT_NODE,
  activeDoubleXp,
  availableXpBalance,
  purchaseDoubleXp,
  spentXp,
} from '../src/lib/domain/course/wallet.ts';

const now = new Date('2026-08-06T08:00:00.000Z');

test('zůstatek vychází z vydělaných minus utracených XP a nemůže být záporný', () => {
  const progress = createCourseProgress(now);
  assert.equal(availableXpBalance(250, progress), 250);
  const purchased = purchaseDoubleXp(progress, 250, now);
  assert.equal(spentXp(purchased.progress), DOUBLE_XP_NEXT_NODE.price);
  assert.equal(purchased.balance, 130);
  assert.equal(availableXpBalance(50, purchased.progress), 0);
});

test('nákup odmítne nedostatek XP i dvojitou aktivaci', () => {
  const progress = createCourseProgress(now);
  assert.throws(() => purchaseDoubleXp(progress, 119, now), /chybí 1 XP/u);
  const purchased = purchaseDoubleXp(progress, 200, now);
  assert.throws(() => purchaseDoubleXp(purchased.progress, 500, now), /už máš zapnuté/u);
});

test('double XP se spotřebuje jen prvním dokončením uzlu a opakování nefarmí body', () => {
  const purchased = purchaseDoubleXp(createCourseProgress(now), 500, now);
  const node = currentCoursePathNode(purchased.progress, 'A1.1');
  assert.ok(node);
  const first = completeCoursePathNode(purchased.progress, node.id, 2, now);
  const repeated = completeCoursePathNode(
    first.progress,
    node.id,
    3,
    new Date('2026-08-06T08:05:00.000Z'),
  );

  assert.equal(first.xpAwarded, node.xp * 2);
  assert.equal(first.boosted, true);
  assert.equal(activeDoubleXp(first.progress), undefined);
  assert.equal(repeated.xpAwarded, 0);
  assert.equal(repeated.progress.pathEvents.length, 1);
});
