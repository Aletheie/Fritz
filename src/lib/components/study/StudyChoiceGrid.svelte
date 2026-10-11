<script lang="ts">
  import { displayGerman } from '$lib/domain/vocabulary/display.ts';

  import { answerZone } from './study-styles.ts';

  import type { Note } from '$lib/domain/types.ts';

  let {
    options,
    answerId,
    selectedId,
    revealed,
    disabled,
    onchoose,
  }: {
    options: Note[];
    answerId: string;
    selectedId?: string;
    revealed: boolean;
    disabled: boolean;
    onchoose: (option: Note) => void;
  } = $props();
</script>

<div class="{answerZone} grid gap-[0.65rem] max-[521px]:gap-2 min-[640px]:grid-cols-2">
  {#each options as option, index}
    {@const tone =
      revealed && option.id === answerId
        ? 'border-mint-700 bg-mint-50 shadow-[3px_3px_0_var(--color-mint-200)]'
        : revealed && selectedId === option.id
          ? 'border-coral-700 bg-coral-50 shadow-[3px_3px_0_var(--color-coral-200)]'
          : 'bg-white shadow-[3px_3px_0_var(--color-line)] active:not-disabled:shadow-[1px_1px_0_var(--color-line)] fine-hover:not-disabled:bg-acid-100'}
    <button
      class={[
        'grid min-h-[4.65rem] grid-cols-[2rem_minmax(0,1fr)] items-center gap-[0.8rem] rounded-[0.25rem] border border-ink-950 p-[0.85rem] text-left text-ink-950 [transition:transform_140ms_var(--ease-out-emil),box-shadow_140ms_var(--ease-out-emil),background-color_150ms_ease] active:not-disabled:[transform:translate(2px,2px)_scale(0.98)] max-[521px]:min-h-[3.55rem] max-[521px]:grid-cols-[1.75rem_minmax(0,1fr)] max-[521px]:gap-[0.6rem] max-[521px]:p-[0.65rem]',
        tone,
      ]}
      type="button"
      {disabled}
      onclick={() => onchoose(option)}
      lang="de"
      ><span
        class="grid size-8 place-items-center rounded-full border border-line font-mono text-[0.7rem] font-extrabold text-ink-600 max-[521px]:size-[1.65rem]"
        >{index + 1}</span
      ><strong class="truncate">{displayGerman(option)}</strong></button
    >
  {/each}
</div>
