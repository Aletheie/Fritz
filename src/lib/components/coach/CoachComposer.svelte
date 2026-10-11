<script lang="ts">
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import MessageCircleMore from '@lucide/svelte/icons/message-circle-more';
  import Send from '@lucide/svelte/icons/send';

  import type { CoachGuidedHint } from '$lib/domain/course/coach.ts';

  let {
    value = $bindable(''),
    input = $bindable(),
    turn,
    hint,
    starters,
    sending,
    onsubmit,
  }: {
    value?: string;
    input?: HTMLInputElement;
    turn: number;
    hint?: CoachGuidedHint;
    /** Shown before the first reply when the scenario has no guided hints. */
    starters: string[];
    sending: boolean;
    onsubmit: () => void;
  } = $props();

  const copy = (cs: string, en: string) => localized($motherTongue, { cs, en });

  function use(prompt: string): void {
    value = prompt;
    input?.focus();
  }
</script>

<form
  class="border-t border-ink-950 bg-paper-50 px-[0.65rem] pt-[0.55rem] pb-[calc(0.55rem+var(--safe-bottom))] shadow-[0_-10px_30px_rgb(21_25_28/0.07)] min-[860px]:px-[1.2rem]"
  onsubmit={(event) => {
    event.preventDefault();
    onsubmit();
  }}
>
  {#if hint}
    <div
      class="mx-auto mb-2 grid max-w-[42rem] grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.55rem] rounded-[0.45rem_0.9rem_0.45rem_0.45rem] border border-butter-600 bg-butter-50 px-[0.6rem] py-2"
      aria-label={copy(`Nápověda k replice ${turn}`, `Hint for turn ${turn}`)}
    >
      <span class="grid size-[1.8rem] place-items-center rounded-full bg-butter-200 text-ink-950"
        ><Lightbulb size={15} /></span
      >
      <span>
        <small
          class="block font-mono text-[0.49rem] font-[850] tracking-[0.05em] text-butter-600 uppercase"
          >{hint.label}</small
        >
        <button
          class="mt-[0.08rem] block border-b border-dashed border-current text-left text-[0.67rem] font-[850]"
          type="button"
          lang="de"
          onclick={() => use(hint.german)}>{hint.german}</button
        >
        <em class="mt-[0.08rem] block text-[0.57rem] text-ink-600 not-italic">{hint.czech}</em>
      </span>
    </div>
  {:else if starters.length > 0 && value.length === 0}
    <div
      class="mx-auto mb-[0.45rem] flex max-w-[42rem] [scrollbar-width:none] gap-[0.4rem] overflow-x-auto [&::-webkit-scrollbar]:hidden"
      aria-label={copy('Nápovědy pro první odpověď', 'Hints for your first answer')}
    >
      {#each starters as prompt}
        <button
          class="flex-none rounded-full border border-line bg-paper-100 px-[0.58rem] py-[0.38rem] text-[0.59rem] font-[760] text-ink-600 fine-hover:border-ink-950 fine-hover:bg-acid-100 fine-hover:text-ink-950"
          type="button"
          onclick={() => use(prompt)}>{prompt}</button
        >
      {/each}
    </div>
  {/if}
  <div class="mx-auto grid max-w-[42rem] grid-cols-[minmax(0,1fr)_3rem] gap-[0.45rem]">
    <label class="sr-only" for="coach-message">{copy('Německá odpověď', 'Answer in German')}</label>
    <input
      class="h-12 min-w-0 rounded-[0.45rem_0.95rem_0.45rem_0.45rem] border border-ink-950 bg-white px-[0.8rem] text-[0.84rem] font-[660] shadow-[inset_0_-2px_0_rgb(21_25_28/0.06)] focus:border-cobalt-700 focus:shadow-[0_0_0_3px_rgb(49_83_199/0.13)] focus:outline-none"
      id="coach-message"
      bind:this={input}
      bind:value
      maxlength="600"
      autocomplete="off"
      autocapitalize="sentences"
      spellcheck="false"
      placeholder={copy('Odpověz německy…', 'Reply in German…')}
      disabled={sending}
    />
    <button
      class="grid size-12 place-items-center rounded-[0.45rem_0.95rem_0.45rem_0.45rem] border border-ink-950 bg-acid-500 text-ink-950 shadow-[3px_3px_0_var(--color-ink-950)] [transition:transform_140ms_var(--ease-out-emil),box-shadow_140ms_var(--ease-out-emil),opacity_140ms_var(--ease-out-emil)] active:not-disabled:[transform:scale(0.95)] active:not-disabled:shadow-[0_0_0_var(--color-ink-950)] disabled:opacity-42"
      type="submit"
      aria-label={copy('Odeslat odpověď', 'Send answer')}
      disabled={sending || value.trim().length < 2}
    >
      {#if sending}<LoaderCircle class="animate-spin" size={20} />{:else}<Send size={20} />{/if}
    </button>
  </div>
  <p
    class="mx-auto mt-[0.38rem] mb-0 flex max-w-[42rem] items-center justify-center gap-1 text-[0.52rem] font-[680] text-ink-600"
  >
    <MessageCircleMore size={13} />
    {copy('Krátká věta stačí. Enter odešle.', 'A short sentence is enough. Press Enter to send.')}
  </p>
</form>
