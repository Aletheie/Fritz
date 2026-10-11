<script lang="ts">
  import Check from '@lucide/svelte/icons/check';

  let {
    options,
    answer,
    selected,
    feedback,
    saving,
    lang,
    sentences = false,
    onchoose,
  }: {
    options: string[];
    answer: string;
    selected: string;
    feedback?: 'correct' | 'wrong';
    saving: boolean;
    lang?: string;
    /** Long options stay in one column. */
    sentences?: boolean;
    onchoose: (option: string) => void;
  } = $props();

  function optionClass(option: string) {
    const correct = Boolean(feedback) && option === answer;
    const wrong = feedback === 'wrong' && selected === option;
    return [
      'grid min-h-14 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-[0.6rem] rounded-[0.3rem_0.8rem_0.3rem_0.3rem] border p-[0.65rem] text-left active:[transform:scale(0.97)] motion-reduce:transition-none',
      correct
        ? 'border-mint-700 bg-mint-50'
        : wrong
          ? 'border-coral-700 bg-coral-50'
          : selected === option
            ? 'border-ink-950 bg-white'
            : 'border-line bg-white',
      selected === option && 'shadow-[2px_2px_0_var(--color-ink-950)]',
    ];
  }
</script>

<div
  class={['mt-[1.35rem] grid gap-[0.55rem]', !sentences && 'min-[700px]:grid-cols-2']}
  data-testid="answer-list"
>
  {#each options as option, index}
    <button
      type="button"
      class={optionClass(option)}
      disabled={Boolean(feedback) || saving}
      onclick={() => onchoose(option)}
    >
      <span
        class="grid size-[1.8rem] place-items-center border border-line font-mono text-[0.65rem]"
        >{index + 1}</span
      ><strong class="leading-[1.35]" {lang}>{option}</strong>
      {#if feedback && option === answer}<Check size={18} />{/if}
    </button>
  {/each}
</div>
