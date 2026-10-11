<script lang="ts">
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';

  import { answerZone, tokenButton } from './study-styles.ts';

  import type { WordOrderExercise, WordOrderToken } from '$lib/domain/exercises/context.ts';

  let {
    exercise,
    selected,
    locked,
    ready,
    reviewing,
    onselect,
    onremove,
    onclear,
    onsubmit,
  }: {
    exercise: WordOrderExercise;
    selected: WordOrderToken[];
    /** A result is showing. */
    locked: boolean;
    ready: boolean;
    reviewing: boolean;
    onselect: (token: WordOrderToken) => void;
    onremove: (token: WordOrderToken) => void;
    onclear: () => void;
    onsubmit: () => void;
  } = $props();

  const copy = (cs: string, en: string) => localized($motherTongue, { cs, en });
  const selectedIds = $derived(new Set(selected.map((token) => token.id)));
</script>

<div class={answerZone}>
  <div
    class={[
      'flex min-h-28 flex-wrap content-center gap-[0.55rem] rounded-[0.25rem] border-2 border-ink-950 bg-white p-4 shadow-[inset_0_-1.5rem_0_rgb(196_255_47/0.08)] max-[521px]:min-h-[4.7rem] max-[521px]:p-[0.7rem]',
      selected.length === 0 && 'items-center justify-center text-[0.82rem] font-bold text-ink-600',
    ]}
    aria-label={copy('Sestavená věta', 'Built sentence')}
  >
    {#if selected.length === 0}
      <span>{copy('Klepni na slova ve správném pořadí', 'Tap the words in the correct order')}</span
      >
    {:else}
      {#each selected as token}
        <button class={tokenButton} type="button" disabled={locked} onclick={() => onremove(token)}
          >{token.text}</button
        >
      {/each}
    {/if}
  </div>
  <div
    class="mt-4 flex flex-wrap justify-center gap-[0.55rem] max-[521px]:mt-[0.7rem] max-[521px]:gap-[0.42rem]"
    aria-label={copy('Dostupná slova', 'Available words')}
  >
    {#each exercise.shuffled as token}
      {@const used = selectedIds.has(token.id)}
      <button
        class={[tokenButton, used && 'opacity-18 shadow-none']}
        type="button"
        disabled={locked || used}
        onclick={() => onselect(token)}>{token.text}</button
      >
    {/each}
  </div>
  {#if !locked}
    <div
      class="mt-[1.2rem] flex justify-end gap-[0.7rem] max-[521px]:mt-3 max-[521px]:flex-col-reverse max-[521px]:gap-2 max-[521px]:[&>.btn-base]:min-h-[2.8rem] max-[521px]:[&>.btn-base]:w-full"
    >
      <button
        class="btn-base btn-secondary"
        type="button"
        disabled={selected.length === 0}
        onclick={onclear}>{copy('Vyčistit', 'Clear')}</button
      >
      <button
        class="btn-base btn-primary"
        type="button"
        disabled={!ready || reviewing}
        onclick={onsubmit}>{copy('Zkontrolovat', 'Check')} <ArrowRight size={18} /></button
      >
    </div>
  {/if}
</div>
