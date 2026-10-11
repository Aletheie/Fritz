<script lang="ts">
  import { insertAtSelection, restoreCaret } from '$lib/client/insert-character.ts';
  import ArticlePicker from '$lib/components/ArticlePicker.svelte';
  import AdaptiveHint from '$lib/components/study/AdaptiveHint.svelte';
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import {
    answerField,
    answerZone,
    fieldLabel,
    submitButton,
  } from '$lib/components/study/study-styles.ts';
  import { parseGermanAnswer } from '$lib/domain/grading/normalize.ts';
  import { hintText } from '$lib/domain/study/results.ts';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';

  import type { Note } from '$lib/domain/types.ts';
  import type { StudySession } from '$lib/state/study-session.svelte.ts';

  let {
    session,
    note,
    showKeyboardHints,
    showStudyTips,
  }: {
    session: StudySession;
    note: Note;
    showKeyboardHints: boolean;
    showStudyTips: boolean;
  } = $props();

  let input = $state<HTMLInputElement>();
  const copy = (cs: string, en: string) => session.copy(cs, en);
  const locked = $derived(Boolean(session.result) || session.reviewing);
  const missingArticle = $derived(
    Boolean(note.article) && !session.selectedArticle && !parseGermanAnswer(session.answer).article,
  );

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
    void session.submitTyping();
  }}
>
  {#if note.article}
    <ArticlePicker
      bind:value={session.selectedArticle}
      disabled={Boolean(session.result)}
      legend={copy('Nejdřív vyber člen', 'Choose the article first')}
    />
  {/if}
  <label class="mt-4 block max-[521px]:mt-[0.7rem]" for="study-answer">
    <span class={fieldLabel}>{copy('Německá odpověď', 'German answer')}</span>
    <input
      id="study-answer"
      bind:this={input}
      class={answerField(session.result?.correct)}
      bind:value={session.answer}
      disabled={locked}
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      enterkeyhint="done"
      lang="de"
      placeholder={note.kind === 'phrase'
        ? copy('Napiš německou frázi', 'Type the German phrase')
        : copy('Napiš německé slovo', 'Type the German word')}
    />
  </label>

  <div
    class="mt-[0.8rem] flex flex-wrap items-center justify-between gap-3 max-[521px]:mt-[0.6rem]"
  >
    {#if showKeyboardHints}
      <GermanKeyboard oninsert={insert} />
    {:else}<span></span>{/if}
    {#if !session.result && showStudyTips}
      <button
        class="inline-flex min-h-[2.45rem] items-center gap-[0.4rem] border-b border-current text-[0.74rem] font-[780] text-orange-700 disabled:cursor-default disabled:opacity-100 fine-hover:text-coral-700"
        type="button"
        disabled={session.hintVisible}
        onclick={() => session.revealHint()}
        ><Lightbulb size={15} />
        {session.hintVisible
          ? hintText(note, session.language)
          : copy('Malá nápověda', 'Small hint')}</button
      >
      {#if session.hintVisible && session.aiAvailable}
        {#key note.id}<AdaptiveHint {note} submitted={session.answer} />{/key}
      {/if}
    {/if}
  </div>

  {#if !session.result}
    <button
      class={submitButton}
      type="submit"
      disabled={!session.answer.trim() || session.reviewing || missingArticle}
    >
      {session.reviewing ? copy('Vyhodnocuji…', 'Checking…') : copy('Zkontrolovat', 'Check')}
      <ArrowRight size={18} />
    </button>
  {/if}
</form>
