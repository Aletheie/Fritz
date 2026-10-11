<script lang="ts">
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import { mistakeLabel } from '$lib/i18n/mistakes.ts';
  import { motherTongue, tr } from '$lib/state/app';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Mic from '@lucide/svelte/icons/mic';
  import MicOff from '@lucide/svelte/icons/mic-off';
  import { answerField } from './answer-focus.svelte.ts';
  import {
    button,
    errorClass,
    field,
    fieldLabel,
    formActions,
    hint,
    hintButton,
    primaryButton,
    prompt,
  } from './today-styles.ts';

  import type { CoachScenario } from '$lib/domain/course/coach.ts';
  import type { TransferLessonActivity } from '$lib/domain/learning/types.ts';
  import type { DailyLesson } from '$lib/state/daily-lesson.svelte.ts';

  let {
    lesson,
    activity,
    scenario,
  }: { lesson: DailyLesson; activity: TransferLessonActivity; scenario: CoachScenario } = $props();

  let input = $state<HTMLTextAreaElement>();
  const keyboard = answerField(
    () => lesson,
    () => input,
  );
  const speech = $derived(lesson.speech);
</script>

<div class={prompt}>
  <span
    >{activity.repair ? $tr('Krátká oprava', 'Quick repair') : $tr('Situace', 'Scenario')} ·
    {lesson.transferAcceptedTurns + 1}/{activity.turnsTarget}</span
  ><strong lang="de">{lesson.transferPrompt}</strong><small
    >{activity.repair
      ? $tr('Procvičuješ: ', 'You are practising: ') +
        mistakeLabel(activity.repair.mistakeTag, $motherTongue)
      : scenario.openingCs}</small
  >
</div>
{#if !lesson.pendingEvidence}
  <div class="mt-[1.4rem] grid gap-[0.8rem]">
    <label class={fieldLabel} for="transfer-answer"
      >{$tr('Tvoje německá replika', 'Your German reply')}</label
    >
    <textarea
      id="transfer-answer"
      class="{field} min-h-[6.5rem] resize-y"
      bind:this={input}
      bind:value={lesson.answer}
      rows="3"
      spellcheck="false"
      disabled={lesson.saving}></textarea>
    <div class="flex items-center gap-3 max-[561px]:flex-col max-[561px]:items-start">
      <button
        class={[
          button,
          speech.listening
            ? 'border-coral-500 bg-coral-50 text-ink-950'
            : 'border-line bg-paper-50 text-ink-950',
        ]}
        type="button"
        onclick={() => lesson.toggleMicrophone()}
        disabled={!speech.available || lesson.saving}
        aria-pressed={speech.listening}
      >
        {#if speech.listening}<MicOff size={19} aria-hidden="true" />{$tr(
            'Zastavit',
            'Stop',
          )}{:else}<Mic size={19} aria-hidden="true" />{$tr('Nadiktovat', 'Dictate')}{/if}
      </button>
      <span class="text-[0.75rem] leading-[1.4] text-ink-700"
        >{lesson.speechDraft
          ? $tr(
              'Přepis je návrh — před odesláním ho můžeš upravit.',
              'The transcript is a draft — edit it before submitting.',
            )
          : $tr(
              'Rozpoznání zajišťuje prohlížeč (může být online). Fritz audio neukládá.',
              'Recognition is provided by the browser (and may be online). Fritz does not store audio.',
            )}</span
      >
    </div>
    {#if speech.error}<p class={errorClass} role="alert">{speech.error}</p>{/if}
    <GermanKeyboard oninsert={keyboard.insert} />
    {#if !lesson.feedback}
      <div class={formActions}>
        <button
          class={hintButton}
          type="button"
          onclick={() => lesson.showHint()}
          disabled={lesson.hintVisible}
          ><Lightbulb size={18} aria-hidden="true" />{$tr('Vzor', 'Starter')}</button
        >
        <button
          class={primaryButton}
          type="button"
          onclick={() => void lesson.submitTransferTurn()}
          disabled={!lesson.answer.trim() || lesson.saving}
        >
          {#if lesson.saving}<LoaderCircle class="animate-spin" size={18} aria-hidden="true" />{/if}
          {$tr('Odeslat repliku', 'Submit reply')}
        </button>
      </div>
    {/if}
  </div>
  {#if lesson.hintVisible}<p class={hint} role="status" lang="de">{activity.starter}</p>{/if}
{/if}
