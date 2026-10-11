<script lang="ts">
  import { localized } from '$lib/i18n';
  import { dueMomentLabel, scheduleIntervalLabel } from '$lib/i18n/schedule.ts';
  import { motherTongue } from '$lib/state/app';
  import Check from '@lucide/svelte/icons/check';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';

  import { labIndex } from './study-styles.ts';

  import type { SchedulePreviewOption } from '$lib/domain/scheduler/fsrs.ts';
  import type { RatingKey } from '$lib/domain/types.ts';

  let {
    sprint,
    schedule,
    rating,
    scheduledFor,
    note,
  }: {
    sprint: boolean;
    schedule: SchedulePreviewOption[];
    /** Rating chosen for the current answer, if saved. */
    rating?: RatingKey;
    scheduledFor?: string;
    /** Optional learning tip for the current word. */
    note?: string;
  } = $props();

  const copy = (cs: string, en: string) => localized($motherTongue, { cs, en });
  const labels: Record<RatingKey, [string, string]> = {
    again: ['Znovu', 'Again'],
    hard: ['Těžké', 'Hard'],
    good: ['Dobré', 'Good'],
    easy: ['Lehké', 'Easy'],
  };
  const dots: Record<RatingKey, string> = {
    again: 'bg-coral-700',
    hard: 'bg-orange-500',
    good: 'bg-mint-700',
    easy: 'bg-cobalt-700',
  };
  const footnote = 'mt-[0.8rem] text-[0.72rem] leading-normal text-ink-600';
</script>

<aside
  class="self-start rounded-[0.25rem] border border-ink-950 bg-paper-50 p-4 shadow-[4px_4px_0_var(--color-cobalt-300)] max-[900px]:hidden min-[900px]:sticky min-[900px]:top-4"
>
  <div class="flex items-center gap-[0.7rem] border-b border-line pb-[0.85rem]">
    <span class="grid size-9 flex-none place-items-center rounded-full bg-cobalt-700 text-white"
      ><Clock3 size={17} /></span
    >
    <div>
      <p class={labIndex}>{copy('paměťový plán', 'memory plan')}</p>
      <h2 class="mt-[0.15rem] text-[1rem] font-[850] tracking-[-0.025em]">
        {copy('Kdy se karta vrátí', 'When this card returns')}
      </h2>
    </div>
  </div>

  {#if sprint}
    <div class="mt-[0.9rem] border border-cobalt-700 px-3 py-[0.65rem]">
      <strong class="text-[0.8rem]">{copy('Sprint je oddělený.', 'The sprint is separate.')}</strong
      >
      <p class={footnote}>
        {copy(
          'Příprava na test nemění běžné termíny opakování.',
          'Test practice doesn’t change your regular review dates.',
        )}
      </p>
    </div>
  {:else if schedule.length > 0}
    <div class="mt-[0.7rem]">
      {#each schedule as option}
        <div
          class={[
            'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.6rem] border-b py-[0.72rem]',
            rating === option.rating
              ? '-mx-[0.45rem] rounded-[0.2rem] border border-ink-950 bg-acid-100 px-[0.45rem] shadow-[2px_2px_0_var(--color-ink-950)]'
              : 'border-line px-[0.1rem]',
          ]}
        >
          <span class={['size-[0.55rem] rounded-full', dots[option.rating]]}></span>
          <div>
            <strong class="block text-[0.76rem]">{copy(...labels[option.rating])}</strong>
            <small class="mt-[0.08rem] block font-mono text-[0.62rem] text-ink-600"
              >{scheduleIntervalLabel($motherTongue, option.intervalMs)}</small
            >
          </div>
          <time class="text-right font-mono text-[0.62rem] text-ink-600" datetime={option.dueAt}
            >{dueMomentLabel($motherTongue, option.dueAt)}</time
          >
        </div>
      {/each}
    </div>
    {#if scheduledFor}
      <div
        class="mt-[0.85rem] flex items-start gap-[0.55rem] border border-mint-700 bg-mint-50 p-3 text-mint-700"
      >
        <Check class="mt-[0.08rem] flex-none" size={17} />
        <p class="text-[0.74rem] leading-[1.45] text-ink-800">
          <strong>{copy('Uloženo:', 'Saved:')}</strong>
          {copy('tuto kartu uvidíš znovu', 'you will see this card again')}
          {dueMomentLabel($motherTongue, scheduledFor)}.
        </p>
      </div>
    {:else}
      <p class={footnote}>
        {copy(
          'Další termín závisí na tvé odpovědi. Po uložení se zvýrazní.',
          'Your answer determines the next review date. It will be highlighted after saving.',
        )}
      </p>
    {/if}
  {:else}
    <p class={footnote}>
      {copy(
        'Plán se ukáže po načtení stavu karty.',
        'The plan appears after the card state loads.',
      )}
    </p>
  {/if}

  {#if note}
    <div
      class="mt-4 flex items-start gap-[0.55rem] border-t border-dashed border-coral-500 pt-[0.85rem] text-coral-700"
    >
      <Lightbulb class="flex-none" size={16} />
      <p class="text-[0.72rem] leading-normal text-ink-600">{note}</p>
    </div>
  {/if}
</aside>
