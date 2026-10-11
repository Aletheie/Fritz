<script lang="ts">
  import { answerZone, fieldLabel } from '$lib/components/study/study-styles.ts';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Sparkles from '@lucide/svelte/icons/sparkles';

  import type { Note } from '$lib/domain/types.ts';
  import type { StudySession } from '$lib/state/study-session.svelte.ts';

  let { session, note }: { session: StudySession; note: Note } = $props();

  let input = $state<HTMLTextAreaElement>();
  const copy = (cs: string, en: string) => session.copy(cs, en);

  $effect(() => {
    void session.focusRequest;
    input?.focus();
  });
</script>

<form
  class={answerZone}
  onsubmit={(event) => {
    event.preventDefault();
    void session.submitSentence();
  }}
>
  <label class={fieldLabel} for="sentence-answer">{copy('Tvoje věta', 'Your sentence')}</label>
  <textarea
    class="w-full resize-y rounded-[0.25rem] border-2 border-ink-950 bg-white p-4 text-[1.05rem] leading-[1.55] font-[650] text-ink-950 shadow-[4px_4px_0_var(--color-cobalt-300)] focus:shadow-[5px_5px_0_var(--color-cobalt-700)] focus:outline-0 max-[521px]:min-h-24 max-[521px]:resize-none max-[521px]:p-3"
    id="sentence-answer"
    bind:this={input}
    bind:value={session.answer}
    disabled={Boolean(session.result) || session.reviewing || session.aiBusy}
    maxlength="600"
    rows="4"
    lang="de"
    autocomplete="off"
    spellcheck="false"
    placeholder={copy(
      `Např. věta, ve které přirozeně použiješ „${note.german}“`,
      `For example, a sentence that naturally uses “${note.german}”`,
    )}></textarea>
  <div
    class="mt-[0.85rem] flex flex-wrap items-center justify-between gap-3 max-[521px]:mt-[0.55rem] max-[521px]:flex-col max-[521px]:items-stretch max-[521px]:[&>.btn-base]:min-h-[2.9rem] max-[521px]:[&>.btn-base]:w-full"
  >
    <span class="font-mono text-[0.67rem] text-ink-600"
      >{session.answer.length}/600 · Ctrl/⌘ + Enter</span
    >
    {#if !session.result}
      <button
        class="btn-base btn-primary"
        type="submit"
        disabled={session.answer.trim().length < 3 || session.aiBusy || session.reviewing}
      >
        {#if session.aiBusy}<LoaderCircle class="animate-spin" size={17} />
          {copy('AI posuzuje…', 'AI is checking…')}{:else}<Sparkles size={17} />
          {copy('Posoudit použití', 'Evaluate usage')}{/if}
      </button>
    {/if}
  </div>
</form>
