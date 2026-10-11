<script lang="ts">
  import ArticlePicker from '$lib/components/ArticlePicker.svelte';
  import { displayPlural } from '$lib/domain/vocabulary/display.ts';
  import { dueMomentLabel } from '$lib/i18n/schedule.ts';
  import { motherTongue, tr } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Flag from '@lucide/svelte/icons/flag';
  import Flame from '@lucide/svelte/icons/flame';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import X from '@lucide/svelte/icons/x';
  import { tick } from 'svelte';

  import type { AiExplanationResult } from '$lib/domain/ai/types.ts';
  import type { StudyResult } from '$lib/domain/study/types.ts';
  import type { Article, ExerciseKind, Note, ReviewDisputeReason } from '$lib/domain/types.ts';

  let {
    note,
    result,
    exercise,
    gamificationEnabled,
    combo,
    requireCorrection,
    showStudyTips,
    aiConfigured,
    aiBusy,
    aiExplanation,
    aiExplanationError,
    reviewing,
    disputing,
    nextAllowed,
    correction = $bindable(''),
    correctionArticle = $bindable<Article | undefined>(),
    onspeak,
    onexplain,
    ondispute,
    onadvance,
  } = $props<{
    note: Note;
    result: StudyResult;
    exercise: ExerciseKind;
    gamificationEnabled: boolean;
    combo: number;
    requireCorrection: boolean;
    showStudyTips: boolean;
    aiConfigured: boolean;
    aiBusy: boolean;
    aiExplanation?: AiExplanationResult;
    aiExplanationError: string;
    reviewing: boolean;
    disputing: boolean;
    nextAllowed: boolean;
    correction: string;
    correctionArticle?: Article;
    onspeak: () => void;
    onexplain: () => void | Promise<void>;
    ondispute: (reason: ReviewDisputeReason) => void | Promise<void>;
    onadvance: () => void | Promise<void>;
  }>();

  let correctionInput = $state<HTMLInputElement | undefined>();

  $effect(() => {
    if (
      (exercise === 'typing' || exercise === 'speaking') &&
      !result.correct &&
      requireCorrection
    ) {
      void tick().then(() => correctionInput?.focus());
    }
  });

  const tone = $derived(result.correct ? 'correct' : result.nearCorrect ? 'near' : 'wrong');
  const label = 'font-mono text-[0.63rem] font-extrabold tracking-[0.065em] text-ink-600 uppercase';
  const pill = 'flex-none rounded-full border font-mono font-[850]';
  const outlinedCard =
    'border border-cobalt-700 bg-white shadow-[3px_3px_0_var(--color-cobalt-300)]';
</script>

<div
  class={[
    'border-t border-ink-950 pt-[1.2rem] pr-5 pb-[1.4rem] pl-[3.7rem] text-ink-950 min-[900px]:pt-6 min-[900px]:pr-8 min-[900px]:pb-7 min-[900px]:pl-[4.6rem]',
    'max-[900px]:absolute max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:z-30 max-[900px]:max-h-[min(54dvh,30rem)] max-[900px]:animate-feedback-in max-[900px]:[scrollbar-width:thin] max-[900px]:overflow-y-auto max-[900px]:overscroll-contain max-[900px]:rounded-t-2xl max-[900px]:px-[0.85rem] max-[900px]:pt-4 max-[900px]:pb-[calc(0.85rem+env(safe-area-inset-bottom))] max-[900px]:shadow-[0_-12px_32px_rgb(25_31_36/0.18)]',
    'max-[900px]:before:mx-auto max-[900px]:before:-mt-[0.45rem] max-[900px]:before:mb-3 max-[900px]:before:block max-[900px]:before:h-1 max-[900px]:before:w-10 max-[900px]:before:rounded-full max-[900px]:before:bg-[rgb(25_31_36/0.22)]',
    'max-[521px]:max-h-[min(58dvh,31rem)] max-[521px]:px-3',
    {
      correct: 'bg-[color-mix(in_srgb,var(--color-mint-50)_75%,white)]',
      near: 'bg-[color-mix(in_srgb,var(--color-orange-100)_72%,white)]',
      wrong: 'bg-[color-mix(in_srgb,var(--color-coral-50)_76%,white)]',
    }[tone],
  ]}
  aria-live="polite"
>
  <div class="mx-auto max-w-[44rem] max-[900px]:max-w-none">
    <div
      class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 max-[521px]:grid-cols-[auto_minmax(0,1fr)]"
    >
      <span
        class={[
          'grid size-8 place-items-center rounded-full border border-current bg-white',
          { correct: 'text-mint-700', near: 'text-orange-700', wrong: 'text-coral-700' }[tone],
        ]}
        >{#if result.correct}<Check size={18} />{:else}<X size={18} />{/if}</span
      >
      <div>
        <p class={label}>
          {result.correct
            ? $tr('správná odpověď', 'correct answer')
            : result.nearCorrect
              ? $tr('téměř, ale ne přesně', 'almost, but not exact')
              : $tr('podívej se na opravu', 'check the correction')}
        </p>
        <p class="mt-1 leading-[1.35] font-[850]">{result.message}</p>
        {#if !result.correct && exercise !== 'sentence'}
          <p class="mt-[0.3rem] text-[0.82rem] font-[650]">
            {$tr('Správně:', 'Correct answer:')} <span lang="de">{result.expectedDisplay}</span>
          </p>
        {/if}
      </div>
      <div class="flex items-center gap-[0.4rem] max-[521px]:col-start-2 max-[521px]:justify-start">
        {#if gamificationEnabled}<span
            class="{pill} border-orange-500 bg-white px-[0.52rem] py-[0.38rem] text-[0.64rem] text-orange-700"
            >+{result.xp} XP</span
          >{/if}
        {#if gamificationEnabled && combo >= 2}<span
            class="{pill} inline-flex items-center gap-1 border-ink-950 bg-acid-500 px-2 py-[0.36rem] text-[0.61rem] text-ink-950"
            aria-label={$tr(`Čistá série ${combo} odpovědí`, `Clean streak of ${combo} answers`)}
            ><Flame size={14} /> {$tr('série', 'streak')} {combo}</span
          >{/if}
        <button
          class="grid size-[2.4rem] place-items-center rounded-full border border-ink-950 bg-white text-ink-950 transition-transform duration-120 ease-out-emil active:[transform:scale(0.95)]"
          type="button"
          aria-label={$tr('Přehrát výslovnost', 'Play pronunciation')}
          onclick={onspeak}
        >
          <Volume2 size={18} />
        </button>
      </div>
    </div>

    {#if result.aiSentenceEvaluation}
      <article
        class="{outlinedCard} mt-4 grid gap-[0.9rem] p-4 min-[540px]:grid-cols-[auto_minmax(0,1fr)]"
      >
        <div class="flex items-baseline font-mono text-cobalt-700">
          <span class="text-[2.2rem] leading-none font-black"
            >{Math.round(
              (result.aiSentenceEvaluation.grammarScore +
                result.aiSentenceEvaluation.naturalnessScore) /
                2,
            )}</span
          >
          <small class="text-[0.65rem]">/ 100</small>
        </div>
        <div>
          <p class={label}>
            AI · {$tr('smysl a použití výrazu', 'meaning and expression use')}
          </p>
          <p class="mt-[0.35rem] leading-normal font-[760]">
            {result.aiSentenceEvaluation.feedback}
          </p>
          {#if result.aiSentenceEvaluation.correctedSentence}
            <p class="mt-[0.6rem] text-[0.78rem] leading-normal">
              <strong>{$tr('Lepší podoba:', 'Better version:')}</strong>
              <span lang="de">{result.aiSentenceEvaluation.correctedSentence}</span>
            </p>
          {/if}
          <p class="mt-[0.6rem] text-[0.78rem] leading-normal">
            <strong>{$tr('Význam:', 'Meaning:')}</strong>
            {result.aiSentenceEvaluation.czechMeaning}
          </p>
          <div
            class="mt-3 flex flex-wrap gap-[0.35rem] [&>span]:rounded-full [&>span]:border [&>span]:border-line [&>span]:bg-paper-100 [&>span]:px-[0.48rem] [&>span]:py-[0.32rem] [&>span]:font-mono [&>span]:text-[0.59rem] [&>span]:font-[750]"
          >
            <span>{$tr('gramatika', 'grammar')} {result.aiSentenceEvaluation.grammarScore}</span>
            <span
              >{$tr('přirozenost', 'naturalness')}
              {result.aiSentenceEvaluation.naturalnessScore}</span
            >
            <span
              >{result.aiSentenceEvaluation.targetUsedCorrectly
                ? $tr('výraz použit správně', 'expression used correctly')
                : $tr('výraz nesedí', 'expression does not fit')}</span
            >
          </div>
          {#if !result.disputed}
            <button
              class="mt-3 inline-flex min-h-11 items-center gap-[0.42rem] rounded-[0.3rem] border border-ink-950 bg-paper-50 px-3 py-[0.55rem] text-[0.73rem] font-[780] text-ink-800 disabled:opacity-55"
              type="button"
              disabled={disputing}
              onclick={() => void ondispute('ai-too-strict')}
            >
              <Flag size={16} aria-hidden="true" />
              {disputing
                ? $tr('Ukládám reklamaci…', 'Saving dispute…')
                : $tr('Nesedí hodnocení', 'Report a grading error')}
            </button>
          {/if}
        </div>
      </article>
    {/if}

    {#if result.scheduledFor}
      <div
        class="mt-[0.9rem] flex items-center gap-2 border border-cobalt-700 bg-white px-[0.8rem] py-[0.7rem] text-[0.76rem] text-cobalt-700"
      >
        <Clock3 size={16} /><span class="text-ink-800"
          >{$tr('Tahle karta se vrátí', 'This card returns')}
          <strong>{dueMomentLabel($motherTongue, result.scheduledFor)}</strong>.</span
        >
      </div>
    {/if}

    {#if showStudyTips && (note.plural || note.verbForms || ($motherTongue === 'cs' && note.learningNote) || note.exampleDe)}
      <div
        class="mt-[0.9rem] grid gap-[0.55rem] border border-dashed border-ink-600 bg-white/64 p-[0.85rem] [&_strong]:font-mono [&_strong]:text-[0.64rem] [&_strong]:tracking-[0.04em] [&_strong]:uppercase [&>p]:grid [&>p]:grid-cols-[5.5rem_minmax(0,1fr)] [&>p]:gap-[0.7rem] [&>p]:text-[0.77rem] [&>p]:leading-normal [&>p]:text-ink-800 max-[521px]:[&>p]:grid-cols-1 max-[521px]:[&>p]:gap-[0.15rem]"
      >
        {#if displayPlural(note.plural)}<p>
            <strong>{$tr('Plurál', 'Plural')}</strong><span lang="de"
              >{displayPlural(note.plural)}</span
            >
          </p>{/if}
        {#if note.verbForms}
          <p>
            <strong>{$tr('Tvary', 'Forms')}</strong>
            <span lang="de"
              >{note.verbForms.thirdPerson ?? '—'} · {note.verbForms.preterite ?? '—'} · {note
                .verbForms.participle ?? '—'}{note.verbForms.auxiliary
                ? ` · ${note.verbForms.auxiliary}`
                : ''}</span
            >
          </p>
        {/if}
        {#if $motherTongue === 'cs' && note.learningNote}<p>
            <strong>Pozor</strong><span>{note.learningNote}</span>
          </p>{/if}
        {#if note.exampleDe}
          <p>
            <strong>{$tr('Příklad', 'Example')}</strong><span
              ><span lang="de">{note.exampleDe}</span
              >{#if $motherTongue === 'cs' && note.exampleCs}<br />{note.exampleCs}{/if}</span
            >
          </p>
        {/if}
      </div>
    {/if}

    {#if showStudyTips && !result.correct && exercise !== 'sentence' && aiConfigured}
      <div class="mt-[0.9rem]">
        {#if !aiExplanation && !aiExplanationError}
          <button
            class="inline-flex min-h-[2.65rem] items-center gap-[0.45rem] rounded-[0.2rem] border border-cobalt-700 bg-white px-3 py-[0.55rem] text-[0.75rem] font-[780] text-cobalt-700 shadow-[2px_2px_0_var(--color-cobalt-300)] [transition:transform_120ms_var(--ease-out-emil),box-shadow_120ms_var(--ease-out-emil)] active:not-disabled:[transform:translate(1px,1px)_scale(0.97)] active:not-disabled:shadow-[1px_1px_0_var(--color-cobalt-300)]"
            type="button"
            disabled={aiBusy}
            onclick={() => void onexplain()}
          >
            {#if aiBusy}<LoaderCircle class="animate-spin" size={17} />{:else}<Sparkles
                size={17}
              />{/if}
            {aiBusy
              ? $tr('AI vysvětluje…', 'AI is explaining…')
              : $tr('Vysvětlit konkrétní chybu', 'Explain this specific mistake')}
          </button>
        {/if}
        {#if aiExplanation}
          <article
            class="{outlinedCard} mt-3 p-4 text-ink-800 [&>p]:mt-[0.55rem] [&>p]:text-[0.8rem] [&>p]:leading-[1.55]"
          >
            <p class={label}>
              {$tr('AI vysvětlení', 'AI explanation')} · {aiExplanation.model}
            </p>
            <h3 class="mt-[0.3rem] font-[850] text-ink-950">{aiExplanation.headline}</h3>
            <p>{aiExplanation.explanation}</p>
            <p><strong>{$tr('Pomůcka:', 'Tip:')}</strong> {aiExplanation.tip}</p>
            <p class="border-t border-line pt-[0.65rem] font-bold">
              <span lang="de">{aiExplanation.miniExampleDe}</span>{#if $motherTongue === 'cs'}<br
                /><span class="font-medium text-ink-600">{aiExplanation.miniExampleCs}</span>{/if}
            </p>
          </article>
        {:else if aiExplanationError}
          <p
            class="mt-[0.65rem] border border-coral-700 bg-white p-3 text-[0.75rem] font-bold text-coral-700"
          >
            {aiExplanationError}
          </p>
        {/if}
      </div>
    {/if}

    {#if (exercise === 'typing' || exercise === 'speaking') && !result.correct && !result.disputed && requireCorrection}
      <div
        class="mt-[0.9rem] border border-ink-950 bg-white p-[0.9rem] text-ink-950 shadow-[3px_3px_0_var(--color-coral-200)]"
      >
        <p class={label}>
          {$tr('rychlá oprava před pokračováním', 'quick correction before continuing')}
        </p>
        <p class="mt-1 text-[0.85rem] font-[830]">
          {$tr(
            'Napiš správnou podobu jednou bez nápovědy.',
            'Type the correct form once without a hint.',
          )}
        </p>
        {#if showStudyTips}
          <p class="mt-1 text-[0.72rem] leading-[1.45] text-ink-600">
            {$tr(
              'Napiš správný tvar ještě jednou. Za opravu se další XP nepřidávají.',
              'Type the correct form once more. Corrections don’t earn extra XP.',
            )}
          </p>
        {/if}
        {#if note.article}
          <div class="mt-3">
            <ArticlePicker
              bind:value={correctionArticle}
              legend={$tr('Správný člen', 'Correct article')}
            />
          </div>
        {/if}
        <input
          bind:this={correctionInput}
          class="field mt-3"
          bind:value={correction}
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          maxlength="300"
          lang="de"
          placeholder={$tr(`Napiš přesně ${note.german}`, `Type exactly ${note.german}`)}
        />
      </div>
    {/if}

    {#if result.disputed}
      <p
        class="mt-3 flex items-center gap-[0.4rem] text-[0.76rem] font-[760] text-mint-700"
        role="status"
      >
        <Check size={16} aria-hidden="true" />
        {result.disputeReason === 'content-error'
          ? $tr(
              'Podnět je uložený lokálně a výsledek se nepočítá.',
              'The report is stored locally and the result does not count.',
            )
          : $tr(
              'Hodnocení se nepočítá do učení ani XP.',
              'This result won’t affect learning or XP.',
            )}
      </p>
    {:else}
      <button
        class="mt-[0.7rem] flex min-h-11 items-center gap-[0.4rem] text-[0.75rem] font-[750] text-ink-600 underline underline-offset-[0.18rem] disabled:opacity-55"
        type="button"
        disabled={disputing}
        onclick={() => void ondispute('content-error')}
      >
        <Flag size={15} aria-hidden="true" />
        {disputing
          ? $tr('Ukládám podnět…', 'Saving report…')
          : $tr('Nesedí slovíčko nebo řešení', 'Report a content issue')}
      </button>
    {/if}

    <button
      class="btn-base btn-primary mt-4 w-full max-[900px]:sticky max-[900px]:bottom-0 max-[900px]:z-2 max-[900px]:shadow-[0_-0.6rem_0.8rem_rgb(255_255_255/0.38)]"
      type="button"
      disabled={reviewing || disputing || !nextAllowed}
      onclick={() => void onadvance()}
    >
      {$tr('Další úloha', 'Next activity')}
      <ArrowRight size={18} />
    </button>
  </div>
</div>
