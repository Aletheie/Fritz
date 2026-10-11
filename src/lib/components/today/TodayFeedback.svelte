<script lang="ts">
  import { mistakeLabel } from '$lib/i18n/mistakes.ts';
  import { motherTongue, tr } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import { wideButton } from './today-styles.ts';

  import type { LessonActivity } from '$lib/domain/learning/types.ts';
  import type { DailyFeedback, DailyLesson } from '$lib/state/daily-lesson.svelte.ts';

  let {
    lesson,
    activity,
    feedback,
  }: { lesson: DailyLesson; activity: LessonActivity; feedback: DailyFeedback } = $props();
</script>

<div
  class={[
    'mt-[1.4rem] grid grid-cols-[auto_minmax(0,1fr)] gap-[0.85rem] rounded-[0.65rem] border p-4',
    feedback.correct ? 'border-mint-600 bg-mint-50' : 'border-coral-500 bg-coral-50',
  ]}
  role="status"
  aria-live="polite"
>
  <span class="grid size-[2.35rem] place-items-center rounded-lg bg-paper-50"
    >{#if feedback.correct}<Check size={22} aria-hidden="true" />{:else}<RotateCcw
        size={21}
        aria-hidden="true"
      />{/if}</span
  >
  <div>
    <strong class="block">{feedback.title}</strong>
    <p class="mt-1 mb-0 leading-[1.45]">{feedback.message}</p>
    {#if feedback.expected}<small class="mt-[0.55rem] block"
        >{$tr('Správně:', 'Expected:')} <b lang="de">{feedback.expected}</b></small
      >{/if}
  </div>
</div>
{#if activity.kind === 'transfer' && lesson.conversation.complete && lesson.latestTransferDiagnostics.length > 0}
  <div class="mt-[0.65rem] flex items-center justify-between gap-3 text-[0.72rem] text-ink-700">
    <span>
      {lesson.transferDiagnosticsIgnored
        ? $tr(
            'Sporná oprava se do dalšího plánu neuloží.',
            'The disputed correction will not affect the next plan.',
          )
        : lesson.latestTransferDiagnostics
            .map((diagnostic) => mistakeLabel(diagnostic.tag, $motherTongue))
            .join(' · ')}
    </span>
    <button
      class="flex-none border-0 bg-transparent p-[0.35rem] font-extrabold text-cobalt-700 underline underline-offset-[0.18rem]"
      type="button"
      onclick={() => lesson.toggleTransferAssessment()}
    >
      {lesson.transferDiagnosticsIgnored
        ? $tr('Vrátit hodnocení', 'Restore assessment')
        : $tr('Hodnocení nesedí', 'This assessment is off')}
    </button>
  </div>
{/if}
{#if activity.kind === 'transfer' && !lesson.pendingEvidence}
  <button class={wideButton} type="button" onclick={() => lesson.retryTransfer()}
    >{feedback.correct
      ? $tr('Další replika', 'Next reply')
      : $tr('Upravit odpověď', 'Edit answer')}<ArrowRight size={18} aria-hidden="true" /></button
  >
{:else}
  <button
    class={wideButton}
    type="button"
    onclick={() => void lesson.finishCurrentActivity()}
    disabled={lesson.saving}
    >{#if lesson.saving}<LoaderCircle
        class="animate-spin"
        size={18}
        aria-hidden="true"
      />{/if}{feedback.correct
      ? $tr('Pokračovat', 'Continue')
      : $tr('Pokračovat · vrátí se později', 'Continue · returns later')}<ArrowRight
      size={18}
      aria-hidden="true"
    /></button
  >
{/if}
