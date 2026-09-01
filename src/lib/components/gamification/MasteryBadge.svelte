<script lang="ts">
  import { masteryLabel } from '$lib/domain/gamification.ts';
  import type { MasteryTier } from '$lib/domain/gamification.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';

  let { tier }: { tier: MasteryTier } = $props();

  const englishLabels: Record<MasteryTier, string> = {
    new: 'New',
    learning: 'Learning',
    familiar: 'Familiar',
    strong: 'Strong',
    mastered: 'Mastered',
  };
</script>

<span class={`mastery mastery-${tier}`}>
  <i aria-hidden="true"></i>
  {localized($motherTongue, { cs: masteryLabel(tier), en: englishLabels[tier] })}
</span>

<style>
  .mastery {
    display: inline-flex;
    align-items: center;
    gap: 0.38rem;
    border-radius: 999px;
    padding: 0.32rem 0.55rem;
    font-size: 0.75rem;
    font-weight: 780;
    white-space: nowrap;
  }

  i {
    width: 0.42rem;
    height: 0.42rem;
    border-radius: 999px;
    background: currentColor;
  }

  .mastery-new {
    color: var(--color-ink-800);
    background: var(--color-paper-200);
  }
  .mastery-learning {
    color: var(--color-coral-700);
    background: var(--color-coral-50);
  }
  .mastery-familiar {
    color: var(--color-butter-600);
    background: var(--color-butter-50);
  }
  .mastery-strong {
    color: var(--color-sky-700);
    background: var(--color-sky-50);
  }
  .mastery-mastered {
    color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
</style>
