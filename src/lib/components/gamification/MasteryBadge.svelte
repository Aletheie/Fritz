<script lang="ts">
  import { masteryLabel } from '$lib/domain/gamification.ts';
  import type { MasteryTier } from '$lib/domain/gamification.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';

  let { tier }: { tier: MasteryTier } = $props();

  const tones: Record<MasteryTier, string> = {
    new: 'bg-paper-200 text-ink-800',
    learning: 'bg-coral-50 text-coral-700',
    familiar: 'bg-butter-50 text-butter-600',
    strong: 'bg-sky-50 text-sky-700',
    mastered: 'bg-mint-50 text-mint-700',
  };

  const englishLabels: Record<MasteryTier, string> = {
    new: 'New',
    learning: 'Learning',
    familiar: 'Familiar',
    strong: 'Strong',
    mastered: 'Mastered',
  };
</script>

<span
  class={[
    'inline-flex items-center gap-[0.38rem] rounded-full px-[0.55rem] py-[0.32rem] text-[0.75rem] font-[780] whitespace-nowrap',
    tones[tier],
  ]}
>
  <i class="size-[0.42rem] rounded-full bg-current" aria-hidden="true"></i>
  {localized($motherTongue, { cs: masteryLabel(tier), en: englishLabels[tier] })}
</span>
