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
</script>

<div class="calibration">
  <div class="calibration-head">
    <span>Otázka {questionIndex + 1} z {questions.length}</span>
    <progress
      value={questionIndex + 1}
      max={questions.length}
      aria-label={`Průběh orientačního testu: otázka ${questionIndex + 1} z ${questions.length}`}
    >
      {questionIndex + 1} z {questions.length}
    </progress>
  </div>
  <fieldset>
    <legend bind:this={questionHeading} tabindex="-1" lang="de">
      {questions[questionIndex].prompt}
    </legend>
    <div class="answer-grid">
      {#each questions[questionIndex].options as option, index}
        <button type="button" onclick={() => void submitAnswer(index)} lang="de">{option}</button>
      {/each}
      <button class="unknown-answer" type="button" onclick={() => void submitAnswer()}>
        <HelpCircle size={18} aria-hidden="true" /> Nevím
      </button>
    </div>
  </fieldset>
  <button class="cancel-button" type="button" onclick={oncancel}>Ukončit test</button>
</div>

<style>
  .calibration {
    margin-top: 1.5rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.35rem;
    background: var(--color-paper-50);
    padding: 1.1rem;
  }
  .calibration-head {
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 1rem;
    color: var(--color-ink-600);
    font-size: 0.75rem;
    font-weight: 750;
  }
  progress {
    width: 100%;
    accent-color: var(--color-cobalt-700);
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
  }
  legend {
    width: 100%;
    margin: 1.4rem 0;
    font-family: var(--font-reader);
    font-size: clamp(1.45rem, 5vw, 2.2rem);
    font-weight: 750;
  }
  legend:focus-visible {
    outline: 3px solid var(--color-cobalt-700);
    outline-offset: 0.3rem;
  }
  .answer-grid {
    display: grid;
    gap: 0.55rem;
  }
  .answer-grid button {
    display: inline-flex;
    min-height: 3rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.3rem;
    background: white;
    font-weight: 750;
  }
  .answer-grid .unknown-answer {
    border-color: var(--color-line);
    color: var(--color-ink-800);
    background: var(--color-paper-100);
  }
  .cancel-button {
    display: block;
    min-height: 2.75rem;
    margin: 0.55rem auto 0;
    color: var(--color-ink-600);
    text-decoration: underline;
    text-underline-offset: 0.2rem;
  }
  @media (hover: hover) and (pointer: fine) {
    .answer-grid button:hover {
      background: var(--color-accent-100);
    }
  }
</style>
