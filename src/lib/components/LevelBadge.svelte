<script lang="ts">
  import { gameLevelTitle } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import ProgressBar from './ProgressBar.svelte';

  import type { LevelProgress } from '$lib/domain/gamification.ts';

  let { level, compact = false } = $props<{ level: LevelProgress; compact?: boolean }>();
</script>

<div
  class={[
    'relative flex items-center gap-[0.8rem] border border-ink-950 bg-orange-100 text-ink-950',
    compact
      ? 'rounded-[0.25rem_0.85rem_0.25rem_0.25rem] px-[0.7rem] pt-4 pb-[0.7rem]'
      : 'rounded-[0.3rem_1rem_0.3rem_0.3rem] px-[0.9rem] pt-[1.15rem] pb-[0.9rem] shadow-[3px_3px_0_rgb(21_25_28/0.15)]',
  ]}
>
  <span
    class="absolute top-[0.28rem] left-[0.48rem] font-mono text-[0.48rem] font-[850] tracking-[0.07em]"
    >LV/{level.level.toString().padStart(2, '0')}</span
  >
  <span
    class="grid size-[2.35rem] flex-none place-items-center rounded-full border border-ink-950 bg-acid-500 text-ink-950"
    ><Sparkles size={compact ? 16 : 19} /></span
  >
  <div class="min-w-0 flex-1">
    <div class="flex items-baseline justify-between gap-3">
      <p class="truncate font-extrabold">{gameLevelTitle($motherTongue, level.title)}</p>
      <span class="flex-none text-xs font-bold text-ink-600">{level.totalXp} XP</span>
    </div>
    <div class="mt-2">
      <ProgressBar
        value={level.percent}
        label={$motherTongue === 'en' ? 'Progress to the next level' : 'Postup do další úrovně'}
      />
    </div>
  </div>
</div>
