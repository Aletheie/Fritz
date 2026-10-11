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

<div class="grid border-t border-ink-950">
  {#each missions as mission, index}
    <article
      class={[
        'relative grid grid-cols-[2rem_minmax(0,1fr)] gap-[0.7rem] border-b border-line pt-5 pb-4',
        mission.completed
          ? 'bg-[linear-gradient(90deg,var(--color-acid-100),transparent_72%)]'
          : 'bg-transparent',
      ]}
    >
      <span
        class="absolute top-[0.35rem] left-0 font-mono text-[0.5rem] font-extrabold tracking-[0.07em] text-ink-600"
        >M/{(index + 1).toString().padStart(2, '0')}</span
      >
      <span
        class={[
          'grid size-[1.85rem] place-items-center rounded-full border border-ink-950',
          mission.completed ? 'bg-acid-500 text-ink-950' : 'bg-paper-50 text-ink-600',
        ]}
      >
        {#if mission.completed}<Check size={16} />{:else}<Circle size={13} />{/if}
      </span>
      <div class="min-w-0">
        <div class="flex items-baseline justify-between gap-3">
          <h3 class="text-[0.9rem] font-[850]">{title(mission)}</h3>
          <span class="flex-none font-mono text-[0.62rem] font-extrabold text-ink-600"
            >{mission.progress}/{mission.target} · +{mission.rewardXp} XP</span
          >
        </div>
        <p class="mt-[0.2rem] text-[0.76rem] leading-[1.45] text-ink-600">{description(mission)}</p>
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
