<script lang="ts">
  import { displayGerman, displayPlural } from '$lib/domain/vocabulary/display.ts';
  import { localized } from '$lib/i18n';
  import { scheduleIntervalLabel } from '$lib/i18n/schedule.ts';
  import { motherTongue } from '$lib/state/app';
  import Eye from '@lucide/svelte/icons/eye';
  import Volume2 from '@lucide/svelte/icons/volume-2';

  import { answerZone, labIndex, speakButton } from './study-styles.ts';

  import type { SchedulePreviewOption } from '$lib/domain/scheduler/fsrs.ts';
  import type { Note, RatingKey } from '$lib/domain/types.ts';

  let {
    note,
    revealed = $bindable(false),
    reviewing,
    schedule,
    onrate,
    onspeak,
  }: {
    note: Note;
    revealed?: boolean;
    reviewing: boolean;
    /** Next-review options used to label each rating. */
    schedule: SchedulePreviewOption[];
    onrate: (rating: RatingKey) => void;
    onspeak: () => void;
  } = $props();

  const copy = (cs: string, en: string) => localized($motherTongue, { cs, en });

  function interval(rating: RatingKey): string {
    const option = schedule.find((candidate) => candidate.rating === rating);
    return option ? scheduleIntervalLabel($motherTongue, option.intervalMs) : '';
  }
  const ratings: Array<{ key: RatingKey; label: [string, string] }> = [
    { key: 'again', label: ['Znovu', 'Again'] },
    { key: 'hard', label: ['Těžké', 'Hard'] },
    { key: 'good', label: ['Dobré', 'Good'] },
    { key: 'easy', label: ['Lehké', 'Easy'] },
  ];
</script>

<div class="{answerZone} text-center">
  {#if !revealed}
    <button
      class="inline-flex min-h-16 items-center gap-[0.6rem] rounded-[0.25rem] border border-ink-950 bg-ink-950 px-5 py-[0.9rem] font-[820] text-white shadow-[5px_5px_0_var(--color-acid-500)] [transition:transform_140ms_var(--ease-out-emil),box-shadow_140ms_var(--ease-out-emil)] active:[transform:translate(3px,3px)_scale(0.97)] active:shadow-[2px_2px_0_var(--color-acid-500)]"
      type="button"
      disabled={reviewing}
      onclick={() => (revealed = true)}
      ><Eye size={20} /> {copy('Odhalit němčinu', 'Reveal the German')}</button
    >
    <p class="mt-3 font-mono text-[0.67rem] text-ink-600">
      {copy('Mezerník funguje také.', 'The space bar works too.')}
    </p>
  {:else}
    <div
      class="rounded-[0.25rem] border border-ink-950 bg-acid-100 px-4 py-6 shadow-[5px_5px_0_var(--color-ink-950)] max-[521px]:px-3 max-[521px]:py-4 max-[521px]:shadow-[3px_3px_0_var(--color-ink-950)]"
    >
      <p class={labIndex}>{copy('německy', 'German')}</p>
      <div class="flex items-center justify-center gap-[0.8rem]">
        <h2
          class="mt-[0.45rem] text-[clamp(2.3rem,7vw,4.8rem)] leading-[0.94] font-black tracking-[-0.04em] text-balance max-[521px]:text-[clamp(2rem,10vw,3.35rem)]"
          lang="de"
        >
          {displayGerman(note)}
        </h2>
        <button
          class={speakButton}
          type="button"
          aria-label={copy('Přehrát německou výslovnost', 'Play German pronunciation')}
          onclick={onspeak}><Volume2 size={19} /></button
        >
      </div>
      {#if displayPlural(note.plural)}<p class="mt-[0.55rem] font-bold" lang="de">
          {displayPlural(note.plural)}
        </p>{/if}
      {#if note.exampleDe}<p class="mt-4 text-[0.86rem] text-ink-600 italic" lang="de">
          „{note.exampleDe}“
        </p>{/if}
    </div>
    <p class="mt-[1.4rem] text-[0.82rem] font-extrabold max-[521px]:mt-[0.9rem]">
      {copy('Jak dobře sis odpověď vybavila?', 'How well did you recall the answer?')}
    </p>
    <div
      class="mt-3 grid grid-cols-2 gap-[0.55rem] max-[521px]:mt-[0.55rem] max-[521px]:gap-[0.4rem] min-[640px]:grid-cols-4"
    >
      {#each ratings as rating, index}
        <button
          class="grid min-h-[4.4rem] grid-cols-[auto_1fr] grid-rows-[auto_auto] items-center gap-x-[0.45rem] rounded-[0.25rem] border border-ink-950 bg-white p-[0.65rem] text-left shadow-[3px_3px_0_var(--color-line)] [transition:transform_130ms_var(--ease-out-emil),box-shadow_130ms_var(--ease-out-emil),background-color_140ms_ease] active:[transform:translate(2px,2px)_scale(0.97)] active:shadow-[1px_1px_0_var(--color-line)] max-[521px]:min-h-[3.55rem] max-[521px]:p-2 fine-hover:not-disabled:bg-acid-100"
          type="button"
          disabled={reviewing}
          onclick={() => onrate(rating.key)}
          ><span
            class="row-span-2 grid size-[1.8rem] place-items-center rounded-full bg-paper-100 font-mono text-[0.65rem]"
            >{index + 1}</span
          ><strong class="text-[0.8rem]">{copy(...rating.label)}</strong><small
            class="font-mono text-[0.63rem] text-ink-600">{interval(rating.key)}</small
          ></button
        >
      {/each}
    </div>
  {/if}
</div>
