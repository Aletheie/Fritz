import { createId } from '../id.ts';
import type {
  CourseDoubleXpBoost,
  CourseProgress,
  CoursePurchaseTransaction,
  CourseRewardItemId,
} from '../types.ts';

export type RewardShopItem = {
  id: CourseRewardItemId;
  title: string;
  description: string;
  price: number;
  scope: string;
};

export const DOUBLE_XP_NEXT_NODE: RewardShopItem = {
  id: 'double-xp-next-node',
  title: '2× XP na další uzel',
  description: 'Zdvojnásobí pouze XP za první dokončení příštího uzlu kurzové cesty.',
  price: 120,
  scope: 'Jedno první dokončení uzlu; bez vlivu na FSRS a mastery.',
};

export type PurchaseDoubleXpResult = {
  progress: CourseProgress;
  transaction: CoursePurchaseTransaction;
  boost: CourseDoubleXpBoost;
  balance: number;
};

export function spentXp(progress: CourseProgress): number {
  return progress.wallet.purchases.reduce(
    (sum, transaction) => sum + Math.max(0, Math.round(transaction.price)),
    0,
  );
}

export function availableXpBalance(totalEarnedXp: number, progress: CourseProgress): number {
  return Math.max(0, Math.round(totalEarnedXp) - spentXp(progress));
}

export function activeDoubleXp(progress: CourseProgress): CourseDoubleXpBoost | undefined {
  return progress.wallet.boosts.find((boost) => boost.status === 'active');
}

export function purchaseDoubleXp(
  progress: CourseProgress,
  totalEarnedXp: number,
  now = new Date(),
): PurchaseDoubleXpResult {
  if (activeDoubleXp(progress)) {
    throw new Error('Double XP už je aktivní pro další uzel cesty.');
  }
  const price = DOUBLE_XP_NEXT_NODE.price;
  const balance = availableXpBalance(totalEarnedXp, progress);
  if (balance < price) {
    throw new Error(`Na tuto odměnu chybí ${price - balance} XP.`);
  }

  const purchasedAt = now.toISOString();
  const boostId = createId('boost');
  const transaction: CoursePurchaseTransaction = {
    id: createId('purchase'),
    itemId: DOUBLE_XP_NEXT_NODE.id,
    price,
    purchasedAt,
    boostId,
  };
  const boost: CourseDoubleXpBoost = {
    id: boostId,
    itemId: DOUBLE_XP_NEXT_NODE.id,
    purchasedAt,
    status: 'active',
  };
  const next: CourseProgress = {
    ...progress,
    wallet: {
      purchases: [...progress.wallet.purchases, transaction],
      boosts: [...progress.wallet.boosts, boost],
    },
    updatedAt: purchasedAt,
  };
  return {
    progress: next,
    transaction,
    boost,
    balance: availableXpBalance(totalEarnedXp, next),
  };
}
