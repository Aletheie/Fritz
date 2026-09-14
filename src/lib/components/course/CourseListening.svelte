<script lang="ts">
  import type { CoursePathQuestion } from '$lib/domain/course/path-activities.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import { onMount } from 'svelte';

  let {
    question,
    feedback,
    saving,
  }: {
    question: CoursePathQuestion;
    feedback?: 'correct' | 'wrong';
    saving: boolean;
  } = $props();

  let supported = $state(false);
  let transcriptVisible = $state(false);
  let playing = $state(false);
  let audioFailed = $state(false);
  let activeUtterance: SpeechSynthesisUtterance | undefined;

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function stop(): void {
    activeUtterance = undefined;
    if (supported) window.speechSynthesis.cancel();
    playing = false;
  }

  onMount(() => {
    supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    if (!supported) transcriptVisible = true;
    return stop;
  });

  $effect(() => {
    if (feedback) stop();
  });

  function play(rate: number): void {
    if (!supported || !question.audio || feedback || saving) return;
    stop();
    const utterance = new SpeechSynthesisUtterance(question.audio.transcript);
    activeUtterance = utterance;
    utterance.lang = 'de-DE';
    utterance.rate = rate;
    playing = true;
    utterance.addEventListener('end', () => {
      if (activeUtterance !== utterance) return;
      activeUtterance = undefined;
      playing = false;
    });
    utterance.addEventListener('error', () => {
      if (activeUtterance !== utterance) return;
      stop();
      audioFailed = true;
      transcriptVisible = true;
    });
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      stop();
      audioFailed = true;
      transcriptVisible = true;
    }
  }
</script>

<div class="listening-message">
  <strong>{question.audio?.title}</strong>
  <p class="mode-note" role="status">
    {audioFailed || !supported
      ? copy(
          'Zvuk není dostupný. Pokračuj se stejnou zprávou v textu.',
          'Audio is unavailable. Continue with the same message in text.',
        )
      : playing
        ? copy('Zpráva právě zní…', 'The message is playing…')
        : copy('Poslech s porozuměním · hlas zařízení', 'Listening comprehension · device voice')}
  </p>
  {#if supported}
    <div class="controls">
      <button type="button" disabled={Boolean(feedback) || saving} onclick={() => play(1)}>
        <Volume2 size={18} aria-hidden="true" />{copy('Přehrát zprávu', 'Play message')}
      </button>
      <button type="button" disabled={Boolean(feedback) || saving} onclick={() => play(0.8)}>
        {copy('Pomaleji', 'Slower')}
      </button>
      {#if playing}<button type="button" onclick={stop}>{copy('Zastavit', 'Stop')}</button>{/if}
    </div>
  {/if}
  <button
    class="transcript-toggle"
    type="button"
    aria-expanded={transcriptVisible || Boolean(feedback)}
    aria-controls="course-listening-transcript"
    disabled={Boolean(feedback)}
    onclick={() => {
      transcriptVisible = !transcriptVisible;
      stop();
    }}
  >
    {transcriptVisible || feedback
      ? copy('Přepis zprávy', 'Message transcript')
      : copy(
          'Teď nemůžu poslouchat — zobrazit přepis',
          'I cannot listen right now — show transcript',
        )}
  </button>
  {#if transcriptVisible || feedback}
    <div id="course-listening-transcript">
      <p lang="de">{question.audio?.transcript}</p>
      <p class="mode-note">
        {feedback
          ? copy('Porovnej přepis se svou odpovědí.', 'Compare the transcript with your answer.')
          : copy(
              'S přepisem procvičuješ čtení. Odměna za dokončení je stejná.',
              'With the transcript, you are practising reading. The completion reward is the same.',
            )}
      </p>
    </div>
  {/if}
</div>

<style>
  .listening-message {
    margin-block: 1rem 1.5rem;
    padding-block: 1rem;
    border-block: 1px solid var(--color-line);
  }
  strong {
    font-size: 1rem;
    color: var(--color-ink-950);
  }
  p {
    max-width: 65ch;
    line-height: 1.65;
    color: var(--color-ink-950);
  }
  .mode-note {
    font-size: 0.82rem;
    color: var(--color-ink-800);
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-block: 0.8rem;
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 44px;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--color-line-strong);
    border-radius: 0.5rem;
    background: var(--color-paper-50);
    color: var(--color-ink-950);
    font-weight: 700;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: var(--color-paper-200);
  }
  button:disabled {
    cursor: default;
  }
  .transcript-toggle {
    padding-inline: 0;
    border: 0;
    background: transparent;
    color: var(--color-cobalt-700);
    text-align: left;
    justify-content: start;
    font-size: 0.85rem;
  }
</style>
