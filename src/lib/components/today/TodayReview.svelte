<script lang="ts">
  import ArticlePicker from '$lib/components/ArticlePicker.svelte';
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import { noteMeaning } from '$lib/i18n/vocabulary.ts';
  import { motherTongue, tr } from '$lib/state/app';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import { answerField } from './answer-focus.svelte.ts';
  import {
    answerForm,
    field,
    fieldLabel,
    formActions,
    hint,
    hintButton,
    primaryButton,
    prompt,
  } from './today-styles.ts';

  import type { ReviewLessonActivity } from '$lib/domain/learning/types.ts';
  import type { Note } from '$lib/domain/types.ts';
  import type { DailyLesson } from '$lib/state/daily-lesson.svelte.ts';

  let {
    lesson,
    activity,
    note,
  }: { lesson: DailyLesson; activity: ReviewLessonActivity; note: Note } = $props();

  let input = $state<HTMLInputElement>();
  const keyboard = answerField(
    () => lesson,
    () => input,
  );
  const toGerman = $derived(activity.direction === 'cs-de');
  const germanDisplay = $derived(`${note.article ? `${note.article} ` : ''}${note.german}`);
</script>

<div class={prompt}>
  <span>{toGerman ? $tr('Česky', 'Meaning') : $tr('Německy', 'German')}</span>
  <strong>{toGerman ? noteMeaning(note, $motherTongue) : germanDisplay}</strong>
  {#if note.exampleCs && toGerman}<small>{note.exampleCs}</small>{/if}
</div>
{#if !lesson.feedback}
  <form
    class={answerForm}
    onsubmit={(event) => {
      event.preventDefault();
      void lesson.submitReview();
    }}
  >
    {#if toGerman && note.article}
      <ArticlePicker bind:value={lesson.selectedArticle} disabled={lesson.saving} />
    {/if}
    <label class={fieldLabel} for="daily-answer"
      >{toGerman ? $tr('Německá odpověď', 'German answer') : $tr('Význam', 'Meaning')}</label
    >
    <input
      id="daily-answer"
      class={field}
      bind:this={input}
      bind:value={lesson.answer}
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      disabled={lesson.saving}
    />
    {#if toGerman}<GermanKeyboard oninsert={keyboard.insert} />{/if}
    <div class={formActions}>
      <button
        class={hintButton}
        type="button"
        onclick={() => lesson.showHint()}
        disabled={lesson.hintVisible || lesson.saving}
        ><Lightbulb size={18} aria-hidden="true" />{$tr('Nápověda', 'Hint')}</button
      >
      <button class={primaryButton} type="submit" disabled={!lesson.answer.trim() || lesson.saving}
        >{#if lesson.saving}<LoaderCircle
            class="animate-spin"
            size={18}
            aria-hidden="true"
          />{/if}{$tr('Zkontrolovat', 'Check')}</button
      >
    </div>
  </form>
  {#if lesson.hintVisible}<p class={hint} role="status">
      {$tr('Začátek:', 'Starts with:')}
      <strong
        >{toGerman
          ? `${note.article ? `${note.article} ` : ''}${note.german.slice(0, 1)}…`
          : `${noteMeaning(note, $motherTongue).slice(0, 1)}…`}</strong
      >
    </p>{/if}
{/if}
