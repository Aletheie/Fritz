<script lang="ts">
  import { insertAtSelection, restoreCaret } from '$lib/client/insert-character.ts';
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import { answerZone, submitButton } from '$lib/components/study/study-styles.ts';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';

  import type { ClozeExercise } from '$lib/domain/exercises/context.ts';
  import type { StudySession } from '$lib/state/study-session.svelte.ts';

  let {
    session,
    cloze,
    showKeyboardHints,
  }: { session: StudySession; cloze: ClozeExercise; showKeyboardHints: boolean } = $props();

  let input = $state<HTMLInputElement>();
  const copy = (cs: string, en: string) => session.copy(cs, en);

  $effect(() => {
    void session.focusRequest;
    input?.focus();
  });

  function insert(character: string): void {
    if (session.result) return;
    const next = insertAtSelection(input, session.answer, character);
    session.answer = next.value;
    void restoreCaret(input, next.caret);
  }
</script>

<form
  class={answerZone}
  onsubmit={(event) => {
    event.preventDefault();
    void session.submitCloze();
  }}
>
  <div
    class="flex flex-wrap items-center justify-center gap-[0.45rem] border-y border-line px-2 py-[1.4rem] text-[clamp(1.2rem,4vw,1.8rem)] leading-normal font-[780] max-[521px]:px-[0.35rem] max-[521px]:py-4 max-[521px]:text-[1.15rem]"
    lang="de"
  >
    {#if cloze.before}<span>{cloze.before}</span>{/if}
    <input
      class={[
        'min-w-28 border-0 border-b-[3px] px-[0.4rem] py-[0.18rem] text-center text-ink-950 [font:inherit] focus:outline-0',
        session.result?.correct
          ? 'border-mint-700 bg-mint-50'
          : session.result
            ? 'border-coral-700 bg-coral-50'
            : 'border-ink-950 bg-acid-100 focus:border-cobalt-700',
      ]}
      bind:this={input}
      bind:value={session.answer}
      disabled={Boolean(session.result) || session.reviewing}
      aria-label={copy('Chybějící německý výraz', 'Missing German expression')}
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      size={Math.min(18, Math.max(7, cloze.answer.length))}
    />
    {#if cloze.after}<span>{cloze.after}</span>{/if}
  </div>
  {#if showKeyboardHints && !session.result}
    <div class="mt-4"><GermanKeyboard oninsert={insert} /></div>
  {/if}
  {#if !session.result}
    <button
      class={submitButton}
      type="submit"
      disabled={!session.answer.trim() || session.reviewing}
      >{copy('Doplnit', 'Complete')} <ArrowRight size={18} /></button
    >
  {/if}
</form>
