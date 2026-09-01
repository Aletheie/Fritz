<script lang="ts">
  import { gameLevelTitle } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import ProgressBar from './ProgressBar.svelte';

  import type { LevelProgress } from '$lib/domain/gamification.ts';

  let { level, compact = false } = $props<{ level: LevelProgress; compact?: boolean }>();
</script>

<div class:compact class="level-card">
  <span class="level-code">LV/{level.level.toString().padStart(2, '0')}</span>
  <span class="level-icon"><Sparkles size={compact ? 16 : 19} /></span>
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

<style>
  .level-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.3rem 1rem 0.3rem 0.3rem;
    color: var(--color-ink-950);
    background: var(--color-orange-100);
    padding: 1.15rem 0.9rem 0.9rem;
    box-shadow: 3px 3px 0 rgb(21 25 28 / 0.15);
  }

  .level-card.compact {
    border-radius: 0.25rem 0.85rem 0.25rem 0.25rem;
    padding: 1rem 0.7rem 0.7rem;
    box-shadow: none;
  }

  .level-code {
    position: absolute;
    top: 0.28rem;
    left: 0.48rem;
    font-family: var(--font-mono);
    font-size: 0.48rem;
    font-weight: 850;
    letter-spacing: 0.07em;
  }

  .level-icon {
    display: grid;
    width: 2.35rem;
    height: 2.35rem;
    flex: none;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }
</style>
