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

<div class="my-[1rem_1.5rem] border-y border-line py-4">
  <strong class="text-[1rem] text-ink-950">{question.audio?.title}</strong>
  <p class="max-w-[65ch] text-[0.82rem] leading-[1.65] text-ink-800" role="status">
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
    <div class="my-[0.8rem] flex flex-wrap gap-2">
      <button
        class="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-strong bg-paper-50 px-[0.8rem] py-[0.6rem] font-bold text-ink-950 hover:not-disabled:bg-paper-200 disabled:cursor-default"
        type="button"
        disabled={Boolean(feedback) || saving}
        onclick={() => play(1)}
      >
        <Volume2 size={18} aria-hidden="true" />{copy('Přehrát zprávu', 'Play message')}
      </button>
      <button
        class="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-strong bg-paper-50 px-[0.8rem] py-[0.6rem] font-bold text-ink-950 hover:not-disabled:bg-paper-200 disabled:cursor-default"
        type="button"
        disabled={Boolean(feedback) || saving}
        onclick={() => play(0.8)}
      >
        {copy('Pomaleji', 'Slower')}
      </button>
      {#if playing}<button
          class="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line-strong bg-paper-50 px-[0.8rem] py-[0.6rem] font-bold text-ink-950 hover:not-disabled:bg-paper-200 disabled:cursor-default"
          type="button"
          onclick={stop}>{copy('Zastavit', 'Stop')}</button
        >{/if}
    </div>
  {/if}
  <button
    class="inline-flex min-h-11 cursor-pointer items-center justify-start gap-2 bg-transparent py-[0.6rem] text-left text-[0.85rem] font-bold text-cobalt-700 hover:not-disabled:bg-paper-200 disabled:cursor-default"
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
      <p class="max-w-[65ch] leading-[1.65] text-ink-950" lang="de">{question.audio?.transcript}</p>
      <p class="max-w-[65ch] text-[0.82rem] leading-[1.65] text-ink-800">
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
