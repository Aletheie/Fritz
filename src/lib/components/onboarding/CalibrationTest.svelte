<script lang="ts">
  import {
    recommendStartingLevel,
    type CalibrationAnswer,
    type CalibrationRecommendation,
  } from '$lib/domain/onboarding/calibration.ts';
  import HelpCircle from '@lucide/svelte/icons/circle-help';
  import { onMount, tick } from 'svelte';

  type CalibrationQuestion = {
    prompt: string;
    options: string[];
    correct: number;
  };

  const questions: CalibrationQuestion[] = [
    { prompt: 'Ich ___ Anna.', options: ['heiße', 'heißt', 'heißen'], correct: 0 },
    { prompt: 'Gestern ___ wir im Kino.', options: ['sind', 'waren', 'werden'], correct: 1 },
    {
      prompt: 'Wenn ich Zeit hätte, ___ ich mehr lesen.',
      options: ['werde', 'würde', 'wurde'],
      correct: 1,
    },
    {
      prompt: 'Das ist die Frau, ___ Sohn in Berlin studiert.',
      options: ['deren', 'dessen', 'der'],
      correct: 0,
    },
    {
      prompt: 'Er tat so, als ___ er nichts bemerkt.',
      options: ['hat', 'hätte', 'wird'],
      correct: 1,
    },
  ];

  let { oncomplete, oncancel } = $props<{
    oncomplete: (result: CalibrationRecommendation) => void;
    oncancel: () => void;
  }>();

  let questionIndex = $state(0);
  let answers = $state<CalibrationAnswer[]>([]);
  let questionHeading = $state<HTMLLegendElement | undefined>();

  onMount(async () => {
    await tick();
    questionHeading?.focus();
  });

  async function submitAnswer(value?: number): Promise<void> {
    const outcome: CalibrationAnswer =
      value === undefined
        ? 'unknown'
        : value === questions[questionIndex].correct
          ? 'correct'
          : 'incorrect';
    const nextAnswers = [...answers, outcome];
    answers = nextAnswers;
    if (questionIndex === questions.length - 1) {
      oncomplete(recommendStartingLevel(nextAnswers));
      return;
    }
    questionIndex += 1;
    await tick();
    questionHeading?.focus();
  }

  const answer =
    'inline-flex min-h-12 items-center justify-center gap-[0.4rem] rounded-[0.3rem] border font-[750] fine-hover:bg-accent-100';
</script>

<div class="mt-6 rounded-[0.35rem] border border-ink-950 bg-paper-50 p-[1.1rem]">
  <div class="grid grid-cols-[auto_1fr] items-center gap-4 text-[0.75rem] font-[750] text-ink-600">
    <span>Otázka {questionIndex + 1} z {questions.length}</span>
    <progress
      class="w-full accent-cobalt-700"
      value={questionIndex + 1}
      max={questions.length}
      aria-label={`Průběh orientačního testu: otázka ${questionIndex + 1} z ${questions.length}`}
    >
      {questionIndex + 1} z {questions.length}
    </progress>
  </div>
  <fieldset class="m-0 border-0 p-0">
    <legend
      class="my-[1.4rem] w-full font-(family-name:--font-reader) text-[clamp(1.45rem,5vw,2.2rem)] font-[750] focus-visible:outline-3 focus-visible:outline-offset-[0.3rem] focus-visible:outline-cobalt-700"
      bind:this={questionHeading}
      tabindex="-1"
      lang="de"
    >
      {questions[questionIndex].prompt}
    </legend>
    <div class="grid gap-[0.55rem]">
      {#each questions[questionIndex].options as option, index}
        <button
          class="{answer} border-ink-950 bg-white"
          type="button"
          onclick={() => void submitAnswer(index)}
          lang="de">{option}</button
        >
      {/each}
      <button
        class="{answer} border-line bg-paper-100 text-ink-800"
        type="button"
        onclick={() => void submitAnswer()}
      >
        <HelpCircle size={18} aria-hidden="true" /> Nevím
      </button>
    </div>
  </fieldset>
  <button
    class="mx-auto mt-[0.55rem] block min-h-11 text-ink-600 underline underline-offset-[0.2rem]"
    type="button"
    onclick={oncancel}>Ukončit test</button
  >
</div>
