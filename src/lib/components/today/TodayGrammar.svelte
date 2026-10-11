<script lang="ts">
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import { grammarOptionCopy } from '$lib/i18n/grammar.ts';
  import { motherTongue, tr } from '$lib/state/app';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import { answerField } from './answer-focus.svelte.ts';
  import {
    answerForm,
    choiceGrid,
    field,
    fieldLabel,
    formActions,
    hint,
    hintButton,
    primaryButton,
    prompt,
    toggle,
  } from './today-styles.ts';

  import type { GrammarQuestion } from '$lib/domain/course/grammar.ts';
  import type { DailyLesson } from '$lib/state/daily-lesson.svelte.ts';

  let { lesson, question }: { lesson: DailyLesson; question: GrammarQuestion } = $props();

  let input = $state<HTMLInputElement>();
  const keyboard = answerField(
    () => lesson,
    () => input,
  );
</script>

<div class={prompt}>
  <span>{lesson.grammarCopy?.formula}</span>
  <strong>{lesson.questionCopy?.prompt}</strong>
</div>
{#if !lesson.feedback}
  <form
    class={answerForm}
    onsubmit={(event) => {
      event.preventDefault();
      void lesson.submitGrammar();
    }}
  >
    {#if question.kind === 'choice'}
      <fieldset class={choiceGrid}>
        <legend>{$tr('Vyber odpověď', 'Choose an answer')}</legend
        >{#each question.options as option}<button
            type="button"
            class={toggle(lesson.selectedChoice === option)}
            aria-pressed={lesson.selectedChoice === option}
            onclick={() => (lesson.selectedChoice = option)}
            >{grammarOptionCopy($motherTongue, option)}</button
          >{/each}
      </fieldset>
    {:else if question.kind === 'fill'}
      <label class={fieldLabel} for="grammar-answer"
        >{question.before}<span class="inline-block min-w-12 border-b-2 border-current text-center"
          >…</span
        >{question.after}</label
      >
      <input
        id="grammar-answer"
        class={field}
        bind:this={input}
        bind:value={lesson.answer}
        placeholder={question.placeholder ?? ''}
        autocomplete="off"
        spellcheck="false"
      />
      <GermanKeyboard oninsert={keyboard.insert} />
    {:else}
      <div
        class="min-h-14 border-b-2 border-ink-950 px-1 py-[0.8rem] text-[1.05rem] text-ink-700"
        aria-live="polite"
      >
        {lesson.orderedAnswer || $tr('Věta se skládá tady', 'Your sentence appears here')}
      </div>
      <div
        class="flex flex-wrap gap-[0.55rem]"
        aria-label={$tr('Slova k seřazení', 'Words to order')}
      >
        {#each question.tokens as token, index (index)}<button
            type="button"
            class={toggle(lesson.selectedOrderIndexes.includes(index))}
            aria-pressed={lesson.selectedOrderIndexes.includes(index)}
            onclick={() => lesson.toggleOrderToken(index)}>{token}</button
          >{/each}
      </div>
    {/if}
    <div class={formActions}>
      <button
        class={hintButton}
        type="button"
        onclick={() => lesson.showHint()}
        disabled={lesson.hintVisible}
        ><Lightbulb size={18} aria-hidden="true" />{$tr('Nápověda', 'Hint')}</button
      >
      <button class={primaryButton} type="submit" disabled={!lesson.grammarReady || lesson.saving}
        >{$tr('Zkontrolovat', 'Check')}</button
      >
    </div>
  </form>
  {#if lesson.hintVisible}<p class={hint} role="status">
      {lesson.questionCopy?.hint ?? lesson.grammarCopy?.concept}
    </p>{/if}
{/if}
