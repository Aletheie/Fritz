<script lang="ts">
  import ArticlePicker from '$lib/components/ArticlePicker.svelte';
  import { formatDueMoment } from '$lib/domain/scheduler/fsrs.ts';
  import { displayPlural } from '$lib/domain/vocabulary/display.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
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

  const englishDateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

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

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function dueLabel(value: string): string {
    if ($motherTongue === 'cs') return formatDueMoment(value);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'unknown due date';
    const now = new Date();
    const seconds = Math.max(0, Math.round((date.getTime() - now.getTime()) / 1_000));
    if (seconds < 45) return 'now';
    if (seconds < 90) return 'in 1 min';
    if (seconds < 3600) return `in ${Math.round(seconds / 60)} min`;
    if (seconds < 86_400) return `in ${Math.round(seconds / 3600)} hr`;
    return englishDateFormatter.format(date);
  }
</script>

<div
  class:correct={result.correct}
  class:near={result.nearCorrect}
  class:wrong={!result.correct && !result.nearCorrect}
  class="feedback"
  aria-live="polite"
>
  <div class="feedback-inner">
    <div class="feedback-head">
      <span class="feedback-icon"
        >{#if result.correct}<Check size={18} />{:else}<X size={18} />{/if}</span
      >
      <div class="feedback-copy">
        <p class="feedback-label">
          {result.correct
            ? copy('paměťová stopa potvrzena', 'memory trace confirmed')
            : result.nearCorrect
              ? copy('téměř, ale ne přesně', 'almost, but not exact')
              : copy('slabé místo nalezeno', 'weak spot found')}
        </p>
        <p class="feedback-message">{result.message}</p>
        {#if !result.correct && exercise !== 'sentence'}
          <p class="expected">
            {copy('Správně:', 'Correct answer:')} <span lang="de">{result.expectedDisplay}</span>
          </p>
        {/if}
      </div>
      <div class="feedback-actions">
        {#if gamificationEnabled}<span class="xp-pop">+{result.xp} XP</span>{/if}
        {#if gamificationEnabled && combo >= 2}<span
            class="combo-pop"
            aria-label={copy(`Čistá série ${combo} odpovědí`, `Clean streak of ${combo} answers`)}
            ><Flame size={14} /> {copy('série', 'streak')} {combo}</span
          >{/if}
        <button
          class="speak-button"
          type="button"
          aria-label={copy('Přehrát výslovnost', 'Play pronunciation')}
          onclick={onspeak}
        >
          <Volume2 size={18} />
        </button>
      </div>
    </div>

    {#if result.aiSentenceEvaluation}
      <article class="sentence-verdict">
        <div class="verdict-score">
          <span
            >{Math.round(
              (result.aiSentenceEvaluation.grammarScore +
                result.aiSentenceEvaluation.naturalnessScore) /
                2,
            )}</span
          >
          <small>/ 100</small>
        </div>
        <div>
          <p class="feedback-label">
            AI · {copy('smysl a použití výrazu', 'meaning and expression use')}
          </p>
          <p class="verdict-text">{result.aiSentenceEvaluation.feedback}</p>
          {#if result.aiSentenceEvaluation.correctedSentence}
            <p class="corrected">
              <strong>{copy('Lepší podoba:', 'Better version:')}</strong>
              <span lang="de">{result.aiSentenceEvaluation.correctedSentence}</span>
            </p>
          {/if}
          <p class="meaning">
            <strong>{copy('Význam:', 'Meaning:')}</strong>
            {result.aiSentenceEvaluation.czechMeaning}
          </p>
          <div class="score-pills">
            <span>{copy('gramatika', 'grammar')} {result.aiSentenceEvaluation.grammarScore}</span>
            <span
              >{copy('přirozenost', 'naturalness')}
              {result.aiSentenceEvaluation.naturalnessScore}</span
            >
            <span
              >{result.aiSentenceEvaluation.targetUsedCorrectly
                ? copy('výraz použit správně', 'expression used correctly')
                : copy('výraz nesedí', 'expression does not fit')}</span
            >
          </div>
          {#if !result.disputed}
            <button
              class="dispute-button"
              type="button"
              disabled={disputing}
              onclick={() => void ondispute('ai-too-strict')}
            >
              <Flag size={16} aria-hidden="true" />
              {disputing
                ? copy('Ukládám reklamaci…', 'Saving dispute…')
                : copy('Nesedí hodnocení', 'Dispute verdict')}
            </button>
          {/if}
        </div>
      </article>
    {/if}

    {#if result.scheduledFor}
      <div class="next-return">
        <Clock3 size={16} /><span
          >{copy('Tahle karta se vrátí', 'This card returns')}
          <strong>{dueLabel(result.scheduledFor)}</strong>.</span
        >
      </div>
    {/if}

    {#if showStudyTips && (note.plural || note.verbForms || ($motherTongue === 'cs' && note.learningNote) || note.exampleDe)}
      <div class="learning-details">
        {#if displayPlural(note.plural)}<p>
            <strong>{copy('Plurál', 'Plural')}</strong><span lang="de"
              >{displayPlural(note.plural)}</span
            >
          </p>{/if}
        {#if note.verbForms}
          <p>
            <strong>{copy('Tvary', 'Forms')}</strong>
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
            <strong>{copy('Příklad', 'Example')}</strong><span
              ><span lang="de">{note.exampleDe}</span
              >{#if $motherTongue === 'cs' && note.exampleCs}<br />{note.exampleCs}{/if}</span
            >
          </p>
        {/if}
      </div>
    {/if}

    {#if showStudyTips && !result.correct && exercise !== 'sentence' && aiConfigured}
      <div class="ai-explanation-zone">
        {#if !aiExplanation && !aiExplanationError}
          <button
            class="ai-explain"
            type="button"
            disabled={aiBusy}
            onclick={() => void onexplain()}
          >
            {#if aiBusy}<LoaderCircle class="spin" size={17} />{:else}<Sparkles size={17} />{/if}
            {aiBusy
              ? copy('AI vysvětluje…', 'AI is explaining…')
              : copy('Vysvětlit konkrétní chybu', 'Explain this specific mistake')}
          </button>
        {/if}
        {#if aiExplanation}
          <article class="ai-box">
            <p class="feedback-label">
              {copy('AI vysvětlení', 'AI explanation')} · {aiExplanation.model}
            </p>
            <h3>{aiExplanation.headline}</h3>
            <p>{aiExplanation.explanation}</p>
            <p><strong>{copy('Pomůcka:', 'Tip:')}</strong> {aiExplanation.tip}</p>
            <p class="example">
              <span lang="de">{aiExplanation.miniExampleDe}</span>{#if $motherTongue === 'cs'}<br
                /><span>{aiExplanation.miniExampleCs}</span>{/if}
            </p>
          </article>
        {:else if aiExplanationError}
          <p class="ai-error">{aiExplanationError}</p>
        {/if}
      </div>
    {/if}

    {#if (exercise === 'typing' || exercise === 'speaking') && !result.correct && !result.disputed && requireCorrection}
      <div class="correction-box">
        <p class="feedback-label">
          {copy('rychlá oprava před pokračováním', 'quick correction before continuing')}
        </p>
        <p class="correction-title">
          {copy(
            'Napiš správnou podobu jednou bez nápovědy.',
            'Type the correct form once without a hint.',
          )}
        </p>
        {#if showStudyTips}
          <p class="correction-note">
            {copy(
              'Oprava není nové review ani další XP. Jen uzavře aktuální chybu.',
              'This correction is not a new review and earns no XP. It simply closes the current mistake.',
            )}
          </p>
        {/if}
        {#if note.article}
          <div class="mt-3">
            <ArticlePicker
              bind:value={correctionArticle}
              legend={copy('Správný člen', 'Correct article')}
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
          placeholder={copy(`Napiš přesně ${note.german}`, `Type exactly ${note.german}`)}
        />
      </div>
    {/if}

    {#if result.disputed}
      <p class="dispute-confirmation" role="status">
        <Check size={16} aria-hidden="true" />
        {result.disputeReason === 'content-error'
          ? copy(
              'Podnět je uložený lokálně a výsledek se nepočítá.',
              'The report is stored locally and the result does not count.',
            )
          : copy(
              'Hodnocení se nepočítá do učení ani XP.',
              'This verdict does not count toward learning or XP.',
            )}
      </p>
    {:else}
      <button
        class="content-report"
        type="button"
        disabled={disputing}
        onclick={() => void ondispute('content-error')}
      >
        <Flag size={15} aria-hidden="true" />
        {disputing
          ? copy('Ukládám podnět…', 'Saving report…')
          : copy('Nesedí slovíčko nebo řešení', 'Report a content issue')}
      </button>
    {/if}

    <button
      class="btn-base btn-primary next-button"
      type="button"
      disabled={reviewing || disputing || !nextAllowed}
      onclick={() => void onadvance()}
    >
      {copy('Další úloha', 'Next activity')}
      <ArrowRight size={18} />
    </button>
  </div>
</div>

<style>
  .feedback {
    border-top: 1px solid var(--color-ink-950);
    padding: 1.2rem 1.25rem 1.4rem 3.7rem;
    color: var(--color-ink-950);
  }
  .feedback.correct {
    background: color-mix(in srgb, var(--color-mint-50) 75%, white);
  }
  .feedback.near {
    background: color-mix(in srgb, var(--color-orange-100) 72%, white);
  }
  .feedback.wrong {
    background: color-mix(in srgb, var(--color-coral-50) 76%, white);
  }
  .feedback-inner {
    max-width: 44rem;
    margin: 0 auto;
  }
  .feedback-head {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.75rem;
  }
  .feedback-icon {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 1px solid currentColor;
    border-radius: 999px;
    background: white;
  }
  .feedback.correct .feedback-icon {
    color: var(--color-mint-700);
  }
  .feedback.near .feedback-icon {
    color: var(--color-orange-700);
  }
  .feedback.wrong .feedback-icon {
    color: var(--color-coral-700);
  }
  .feedback-label {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.63rem;
    font-weight: 800;
    letter-spacing: 0.065em;
    text-transform: uppercase;
  }
  .feedback-message {
    margin-top: 0.25rem;
    font-weight: 850;
    line-height: 1.35;
  }
  .expected {
    margin-top: 0.3rem;
    font-size: 0.82rem;
    font-weight: 650;
  }
  .feedback-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .xp-pop {
    flex: none;
    border: 1px solid var(--color-orange-500);
    border-radius: 999px;
    color: var(--color-orange-700);
    background: white;
    padding: 0.38rem 0.52rem;
    font-family: var(--font-mono);
    font-size: 0.64rem;
    font-weight: 850;
  }
  .combo-pop {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
    padding: 0.36rem 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.61rem;
    font-weight: 850;
  }
  .speak-button {
    display: grid;
    width: 2.4rem;
    height: 2.4rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    color: var(--color-ink-950);
    background: white;
    transition: transform 120ms var(--ease-out-emil);
  }
  .speak-button:active {
    transform: scale(0.95);
  }

  .next-return {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.9rem;
    border: 1px solid var(--color-cobalt-700);
    background: white;
    padding: 0.7rem 0.8rem;
    color: var(--color-cobalt-700);
    font-size: 0.76rem;
  }
  .next-return span {
    color: var(--color-ink-800);
  }

  .learning-details {
    display: grid;
    gap: 0.55rem;
    margin-top: 0.9rem;
    border: 1px dashed var(--color-ink-600);
    background: rgb(255 255 255 / 0.64);
    padding: 0.85rem;
  }
  .learning-details p {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr);
    gap: 0.7rem;
    color: var(--color-ink-800);
    font-size: 0.77rem;
    line-height: 1.5;
  }
  .learning-details strong {
    font-family: var(--font-mono);
    font-size: 0.64rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .sentence-verdict {
    display: grid;
    gap: 0.9rem;
    margin-top: 1rem;
    border: 1px solid var(--color-cobalt-700);
    background: white;
    padding: 1rem;
    box-shadow: 3px 3px 0 var(--color-cobalt-300);
  }
  .verdict-score {
    display: flex;
    align-items: baseline;
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
  }
  .verdict-score span {
    font-size: 2.2rem;
    font-weight: 900;
    line-height: 1;
  }
  .verdict-score small {
    font-size: 0.65rem;
  }
  .verdict-text {
    margin-top: 0.35rem;
    font-weight: 760;
    line-height: 1.5;
  }
  .corrected,
  .meaning {
    margin-top: 0.6rem;
    font-size: 0.78rem;
    line-height: 1.5;
  }
  .score-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.75rem;
  }
  .score-pills span {
    border: 1px solid var(--color-line);
    border-radius: 999px;
    background: var(--color-paper-100);
    padding: 0.32rem 0.48rem;
    font-family: var(--font-mono);
    font-size: 0.59rem;
    font-weight: 750;
  }
  .dispute-button {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.42rem;
    margin-top: 0.75rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.3rem;
    color: var(--color-ink-800);
    background: var(--color-paper-50);
    padding: 0.55rem 0.75rem;
    font-size: 0.73rem;
    font-weight: 780;
  }
  .dispute-button:disabled {
    opacity: 0.55;
  }
  .dispute-confirmation {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.75rem;
    color: var(--color-mint-700);
    font-size: 0.76rem;
    font-weight: 760;
  }
  .content-report {
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.7rem;
    color: var(--color-ink-600);
    font-size: 0.75rem;
    font-weight: 750;
    text-decoration: underline;
    text-underline-offset: 0.18rem;
  }
  .content-report:disabled {
    opacity: 0.55;
  }

  .ai-explanation-zone {
    margin-top: 0.9rem;
  }
  .ai-explain {
    display: inline-flex;
    min-height: 2.65rem;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid var(--color-cobalt-700);
    border-radius: 0.2rem;
    color: var(--color-cobalt-700);
    background: white;
    padding: 0.55rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 780;
    box-shadow: 2px 2px 0 var(--color-cobalt-300);
    transition:
      transform 120ms var(--ease-out-emil),
      box-shadow 120ms var(--ease-out-emil);
  }
  .ai-explain:active:not(:disabled) {
    transform: translate(1px, 1px) scale(0.97);
    box-shadow: 1px 1px 0 var(--color-cobalt-300);
  }
  .ai-box {
    margin-top: 0.75rem;
    border: 1px solid var(--color-cobalt-700);
    color: var(--color-ink-800);
    background: white;
    padding: 1rem;
    box-shadow: 3px 3px 0 var(--color-cobalt-300);
  }
  .ai-box h3 {
    margin-top: 0.3rem;
    color: var(--color-ink-950);
    font-weight: 850;
  }
  .ai-box p {
    margin-top: 0.55rem;
    font-size: 0.8rem;
    line-height: 1.55;
  }
  .ai-box .example {
    border-top: 1px solid var(--color-line);
    padding-top: 0.65rem;
    font-weight: 700;
  }
  .ai-box .example span {
    color: var(--color-ink-600);
    font-weight: 500;
  }
  .ai-error {
    margin-top: 0.65rem;
    border: 1px solid var(--color-coral-700);
    color: var(--color-coral-700);
    background: white;
    padding: 0.75rem;
    font-size: 0.75rem;
    font-weight: 700;
  }
  :global(.spin) {
    animation: spin 760ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .correction-box {
    margin-top: 0.9rem;
    border: 1px solid var(--color-ink-950);
    color: var(--color-ink-950);
    background: white;
    padding: 0.9rem;
    box-shadow: 3px 3px 0 var(--color-coral-200);
  }
  .correction-title {
    margin-top: 0.25rem;
    font-size: 0.85rem;
    font-weight: 830;
  }
  .correction-note {
    margin-top: 0.25rem;
    color: var(--color-ink-600);
    font-size: 0.72rem;
    line-height: 1.45;
  }
  .next-button {
    width: 100%;
    margin-top: 1rem;
  }

  @media (max-width: 899px) {
    .feedback {
      position: absolute;
      z-index: 30;
      inset: auto 0 0;
      max-height: min(54dvh, 30rem);
      overflow-y: auto;
      overscroll-behavior: contain;
      border-top: 1px solid var(--color-ink-950);
      border-radius: 1rem 1rem 0 0;
      padding: 1rem 0.85rem calc(0.85rem + env(safe-area-inset-bottom));
      box-shadow: 0 -12px 32px rgb(25 31 36 / 0.18);
      animation: feedback-in 220ms var(--ease-out-emil) both;
      scrollbar-width: thin;
    }
    .feedback::before {
      display: block;
      width: 2.5rem;
      height: 0.25rem;
      margin: -0.45rem auto 0.75rem;
      border-radius: 999px;
      background: rgb(25 31 36 / 0.22);
      content: '';
    }
    .feedback-inner {
      max-width: none;
    }
    .next-button {
      position: sticky;
      bottom: 0;
      z-index: 2;
      box-shadow: 0 -0.6rem 0.8rem rgb(255 255 255 / 0.38);
    }
    @keyframes feedback-in {
      from {
        opacity: 0;
        transform: translateY(1rem);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  }

  @media (min-width: 540px) {
    .sentence-verdict {
      grid-template-columns: auto minmax(0, 1fr);
    }
  }
  @media (min-width: 900px) {
    .feedback {
      padding: 1.5rem 2rem 1.75rem 4.6rem;
    }
  }
  @media (max-width: 520px) {
    .feedback {
      max-height: min(58dvh, 31rem);
      padding-inline: 0.75rem;
    }
    .feedback-head {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .feedback-actions {
      grid-column: 2;
      justify-content: flex-start;
    }
    .learning-details p {
      grid-template-columns: 1fr;
      gap: 0.15rem;
    }
  }
</style>
