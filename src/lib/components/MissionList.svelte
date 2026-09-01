<script lang="ts">
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Check from '@lucide/svelte/icons/check';
  import Circle from '@lucide/svelte/icons/circle';

  import ProgressBar from './ProgressBar.svelte';

  import type { DailyMission } from '$lib/domain/gamification.ts';

  let { missions } = $props<{ missions: DailyMission[] }>();

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function title(mission: DailyMission): string {
    if ($motherTongue === 'cs') return mission.title;
    if (mission.id === 'reviews') return 'Daily set';
    if (mission.id === 'recall') return 'From memory, without help';
    return 'Clean streak';
  }

  function description(mission: DailyMission): string {
    if ($motherTongue === 'cs') return mission.description;
    if (mission.id === 'reviews') return `Complete ${mission.target} answers.`;
    if (mission.id === 'recall') {
      return `Complete ${mission.target} active answers correctly on the first try without a hint.`;
    }
    return `Get ${mission.target} correct answers in a row without a hint.`;
  }
</script>

<div class="mission-list">
  {#each missions as mission, index}
    <article class:completed={mission.completed} class="mission-row">
      <span class="mission-index">M/{(index + 1).toString().padStart(2, '0')}</span>
      <span class="mission-status">
        {#if mission.completed}<Check size={16} />{:else}<Circle size={13} />{/if}
      </span>
      <div class="mission-copy">
        <div class="mission-title">
          <h3>{title(mission)}</h3>
          <span>{mission.progress}/{mission.target} · +{mission.rewardXp} XP</span>
        </div>
        <p>{description(mission)}</p>
        <div class="mt-3">
          <ProgressBar
            value={(mission.progress / mission.target) * 100}
            label={copy(`Postup mise ${mission.title}`, `Progress for mission ${title(mission)}`)}
          />
        </div>
      </div>
    </article>
  {/each}
</div>

<style>
  .mission-list {
    display: grid;
    border-top: 1px solid var(--color-ink-950);
  }

  .mission-row {
    position: relative;
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    gap: 0.7rem;
    border-bottom: 1px solid var(--color-line);
    background: transparent;
    padding: 1.25rem 0 1rem;
  }

  .mission-row.completed {
    background: linear-gradient(90deg, var(--color-acid-100), transparent 72%);
  }

  .mission-index {
    position: absolute;
    top: 0.35rem;
    left: 0;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.5rem;
    font-weight: 800;
    letter-spacing: 0.07em;
  }

  .mission-status {
    display: grid;
    width: 1.85rem;
    height: 1.85rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    color: var(--color-ink-600);
    background: var(--color-paper-50);
  }

  .completed .mission-status {
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }

  .mission-copy {
    min-width: 0;
  }

  .mission-title {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .mission-title h3 {
    font-size: 0.9rem;
    font-weight: 850;
  }

  .mission-title span {
    flex: none;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 800;
  }

  .mission-copy p {
    margin-top: 0.2rem;
    color: var(--color-ink-600);
    font-size: 0.76rem;
    line-height: 1.45;
  }
</style>
