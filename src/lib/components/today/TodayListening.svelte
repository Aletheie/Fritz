<script lang="ts">
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import { tr } from '$lib/state/app';
  import Headphones from '@lucide/svelte/icons/headphones';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import { answerField } from './answer-focus.svelte.ts';
  import {
    answerForm,
    button,
    errorClass,
    field,
    fieldLabel,
    formActions,
    hint,
    hintButton,
    primaryButton,
  } from './today-styles.ts';

  import type { ListeningLessonActivity } from '$lib/domain/learning/types.ts';
  import type { DailyLesson } from '$lib/state/daily-lesson.svelte.ts';

  let { lesson, activity }: { lesson: DailyLesson; activity: ListeningLessonActivity } = $props();

  let input = $state<HTMLInputElement>();
  const keyboard = answerField(
    () => lesson,
    () => input,
  );
</script>

<div
  class="mt-[1.6rem] grid justify-items-center gap-3 rounded-[0.7rem] border border-line bg-ink-950 p-[1.4rem] text-white"
>
  <Headphones size={30} aria-hidden="true" />
  <button
    class="{button} border-white/45 bg-acid-500 text-ink-950"
    type="button"
    onclick={() => void lesson.playListening()}
    disabled={lesson.audioPlaying}
  >
    {#if lesson.audioPlaying}<LoaderCircle
        class="animate-spin"
        size={20}
        aria-hidden="true"
      />{:else}<Volume2 size={20} aria-hidden="true" />{/if}
    {lesson.audioPlays === 0
      ? $tr('Přehrát větu', 'Play sentence')
      : $tr('Přehrát znovu', 'Play again')}
  </button>
  <small class="text-white/65"
    >{lesson.audioSource === 'canonical'
      ? $tr('Nahrávka věty', 'Sentence recording')
      : lesson.audioSource === 'system-voice'
        ? $tr('Systémový německý hlas', 'System German voice')
        : $tr('Bez zobrazeného textu', 'Text stays hidden')}</small
  >
</div>
{#if lesson.audioError}<p class={errorClass} role="alert">{lesson.audioError}</p>{/if}
{#if !lesson.feedback}
  <form
    class={answerForm}
    onsubmit={(event) => {
      event.preventDefault();
      lesson.submitListening();
    }}
  >
    <label class={fieldLabel} for="dictation-answer"
      >{$tr('Napiš, co slyšíš', 'Type what you hear')}</label
    >
    <input
      id="dictation-answer"
      class={field}
      bind:this={input}
      bind:value={lesson.answer}
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
    />
    <GermanKeyboard oninsert={keyboard.insert} />
    <div class={formActions}>
      <button
        class={hintButton}
        type="button"
        onclick={() => lesson.showHint()}
        disabled={lesson.hintVisible}
        ><Lightbulb size={18} aria-hidden="true" />{$tr('Význam', 'Meaning')}</button
      >
      <button class={primaryButton} type="submit" disabled={!lesson.answer.trim()}
        >{$tr('Zkontrolovat', 'Check')}</button
      >
    </div>
  </form>
  {#if lesson.hintVisible}<p class={hint} role="status">{activity.translation}</p>{/if}
{/if}
