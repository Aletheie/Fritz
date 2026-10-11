<script lang="ts">
  import { errorText } from '$lib/domain/errors.ts';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import X from '@lucide/svelte/icons/x';

  import PairMatchingBoard from '$lib/components/study/PairMatchingBoard.svelte';
  import type { MatchingRound } from '$lib/domain/exercises/matching.ts';
  import type { StoryExercise, StoryExerciseResult } from '$lib/domain/stories/types.ts';
  import { localized } from '$lib/i18n';
  import { storyExerciseCopy } from '$lib/i18n/stories.ts';
  import { sourceMeaning } from '$lib/i18n/vocabulary.ts';
  import { motherTongue } from '$lib/state/app';

  let {
    exercise,
    onanswer,
    oncontinue,
  }: {
    exercise: StoryExercise;
    onanswer: (result: StoryExerciseResult) => Promise<void> | void;
    oncontinue: () => void;
  } = $props();

  let selectedOption = $state('');
  let selectedTokenIndices = $state<number[]>([]);
  let writtenAnswer = $state('');
  let feedback = $state<'correct' | 'incorrect' | undefined>();
  let saving = $state(false);
  let saveError = $state('');
  let exerciseId = $state('');
  let matchingMistakes = $state(0);
  let failedAttempts = $state(0);
  let productionRevealed = $state(false);
  let productionChecks = $state<boolean[]>([]);
  let recallInput = $state<HTMLInputElement>();
  let productionInput = $state<HTMLTextAreaElement>();

  const displayExercise = $derived(storyExerciseCopy(exercise, $motherTongue));
  const matchingRound = $derived.by((): MatchingRound => {
    if (exercise.kind !== 'matching') return { pairs: [], czechOptions: [], germanOptions: [] };
    if ($motherTongue === 'cs') return exercise;
    const labels = new Map(
      exercise.pairs.map((pair) => [pair.id, sourceMeaning(pair.german, pair.czech, 'en')]),
    );
    return {
      ...exercise,
      czechOptions: exercise.czechOptions.map((item) => ({
        ...item,
        label: labels.get(item.pairId) ?? item.label,
      })),
    };
  });

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function productionChecklistItem(itemCs: string, index: number): string {
    const english = [
      'The sentence has a subject or topic and a finite verb.',
      'It describes an event that really happened in this scene.',
      'It is phrased in your own words rather than translated word for word.',
    ];
    return copy(itemCs, english[index] ?? 'The sentence matches the scene.');
  }

  const canSubmit = $derived(
    exercise.kind === 'order'
      ? selectedTokenIndices.length === exercise.tokens.length
      : exercise.kind === 'sequence'
        ? selectedTokenIndices.length === exercise.options.length
        : exercise.kind === 'recall'
          ? Boolean(writtenAnswer.trim())
          : exercise.kind === 'production'
            ? false
            : exercise.kind === 'matching'
              ? false
              : Boolean(selectedOption),
  );

  $effect(() => {
    if (exercise.id === exerciseId) return;
    exerciseId = exercise.id;
    reset(true);
  });

  function normalize(value: string): string {
    return value.trim().toLocaleLowerCase('de-DE').replace(/\s+/gu, ' ');
  }

  function chooseToken(index: number): void {
    if (feedback || saving || selectedTokenIndices.includes(index)) return;
    selectedTokenIndices = [...selectedTokenIndices, index];
    vibrate(6);
  }

  function removeToken(position: number): void {
    if (feedback || saving) return;
    selectedTokenIndices = selectedTokenIndices.filter((_, index) => index !== position);
  }

  function chooseOption(option: string): void {
    if (feedback || saving) return;
    selectedOption = option;
    vibrate(6);
  }

  function isCorrect(): boolean {
    if (exercise.kind === 'order') {
      return selectedTokenIndices.every(
        (tokenIndex, index) =>
          normalize(exercise.tokens[tokenIndex]) === normalize(exercise.answer[index] ?? ''),
      );
    }
    if (exercise.kind === 'recall') {
      return exercise.acceptedAnswers.some(
        (answer) => normalize(writtenAnswer) === normalize(answer),
      );
    }
    if (exercise.kind === 'sequence') {
      return selectedTokenIndices.every(
        (optionIndex, index) =>
          normalize(exercise.options[optionIndex]) === normalize(exercise.answer[index] ?? ''),
      );
    }
    if (exercise.kind === 'arc') return selectedOption === exercise.answerId;
    if (exercise.kind === 'matching') return false;
    if (exercise.kind === 'production') return false;
    return normalize(selectedOption) === normalize(exercise.answer);
  }

  async function submit(): Promise<void> {
    if (!canSubmit || saving || feedback) return;
    saving = true;
    saveError = '';
    const correct = isCorrect();
    try {
      await onanswer({ completed: correct, correct });
      feedback = correct ? 'correct' : 'incorrect';
      if (!correct) failedAttempts += 1;
      vibrate(correct ? 18 : 45);
    } catch (error) {
      saveError = errorText(error, $motherTongue, {
        cs: 'Výsledek se nepodařilo uložit.',
        en: 'The result could not be saved.',
      });
    } finally {
      saving = false;
    }
  }

  async function completeMatching(mistakes: number): Promise<void> {
    if (saving || feedback) return;
    matchingMistakes = mistakes;
    saving = true;
    saveError = '';
    try {
      await onanswer({ completed: true, correct: mistakes === 0 });
      feedback = 'correct';
      vibrate(18);
    } catch (error) {
      saveError = errorText(error, $motherTongue, {
        cs: 'Výsledek se nepodařilo uložit.',
        en: 'The result could not be saved.',
      });
    } finally {
      saving = false;
    }
  }

  async function completeProduction(): Promise<void> {
    if (exercise.kind !== 'production' || saving || feedback || !productionRevealed) return;
    saving = true;
    saveError = '';
    try {
      await onanswer({ completed: true });
      feedback = 'correct';
      vibrate(18);
    } catch (error) {
      saveError = errorText(error, $motherTongue, {
        cs: 'Výsledek se nepodařilo uložit.',
        en: 'The result could not be saved.',
      });
    } finally {
      saving = false;
    }
  }

  function productionWordCount(): number {
    return writtenAnswer.trim().split(/\s+/u).filter(Boolean).length;
  }

  function revealProduction(): void {
    if (exercise.kind !== 'production' || productionWordCount() < exercise.minimumWords) return;
    productionChecks = exercise.checklistCs.map(() => false);
    productionRevealed = true;
    vibrate(8);
  }

  function productionChecklistComplete(): boolean {
    return (
      exercise.kind === 'production' &&
      productionChecks.length === exercise.checklistCs.length &&
      productionChecks.every(Boolean)
    );
  }

  function retry(): void {
    selectedOption = '';
    selectedTokenIndices = [];
    writtenAnswer = '';
    feedback = undefined;
    saveError = '';
    queueMicrotask(() => recallInput?.focus());
  }

  function reset(newExercise = false): void {
    selectedOption = '';
    selectedTokenIndices = [];
    writtenAnswer = '';
    feedback = undefined;
    saveError = '';
    saving = false;
    matchingMistakes = 0;
    productionRevealed = false;
    productionChecks = [];
    if (newExercise) failedAttempts = 0;
  }

  function vibrate(duration: number): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(duration);
  }

  const answerTray =
    'mt-4 rounded-[0.85rem] border border-dashed border-line bg-paper-100 p-[0.65rem]';
  const emptyAnswer =
    'self-center font-(family-name:--font-reader) text-[0.87rem] text-ink-600 italic';
  const token =
    'min-h-11 rounded-[0.68rem] border border-ink-950 bg-paper-50 px-[0.7rem] py-[0.55rem] text-[0.78rem] font-[750] shadow-[2px_2px_0_rgb(21_25_28/0.12)]';
  const timelineItem =
    'grid min-h-12 w-full grid-cols-[1.65rem_minmax(0,1fr)_auto] items-center gap-[0.55rem] rounded-[0.7rem] border border-line bg-paper-50 px-[0.65rem] py-[0.55rem] text-left [&>span]:grid [&>span]:size-6 [&>span]:place-items-center [&>span]:rounded-full [&>span]:bg-sky-200 [&>span]:font-mono [&>span]:text-[0.62rem] [&>span]:font-black [&>span]:text-ink-950 [&>strong]:font-(family-name:--font-reader) [&>strong]:text-[0.75rem] [&>strong]:leading-[1.4] [&>strong]:font-[680]';
  const clozeSentence =
    'mt-4 mb-0 border border-cobalt-700 bg-sky-50 p-[0.85rem] font-(family-name:--font-reader) text-[1rem] leading-[1.6] [&>span]:mx-[0.2rem] [&>span]:inline-block [&>span]:min-w-12 [&>span]:border-b-2 [&>span]:border-dotted [&>span]:border-cobalt-700 [&>span]:text-transparent';
  const fieldLabel = 'text-[0.74rem] font-[820] text-ink-800';
  const textField =
    'min-h-12 w-full rounded-[0.65rem] border border-ink-950 bg-white px-[0.8rem] py-[0.72rem] text-ink-950 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--color-cobalt-700)_42%,transparent)]';
  const smallNote = 'm-0 text-[0.68rem] leading-[1.45] text-ink-700';
  const optionState = (selected: boolean, correct: boolean) =>
    correct
      ? 'bg-mint-50' +
        (selected ? ' border-ink-950 shadow-[2px_2px_0_rgb(21_25_28/0.12)]' : ' border-line')
      : selected
        ? 'border-ink-950 bg-sky-50 shadow-[2px_2px_0_rgb(21_25_28/0.12)]'
        : 'border-line bg-paper-50';
  const actionButton =
    'inline-flex min-h-[2.85rem] items-center justify-center gap-[0.45rem] rounded-xl px-4 py-[0.7rem] text-[0.78rem] font-[850]';
  const primaryAction = `${actionButton} min-w-[min(100%,11rem)] bg-ink-950 text-white disabled:opacity-38`;
  const secondaryAction = `${actionButton} border border-ink-950 bg-paper-50`;

  const arcBeat =
    'col-start-2 grid gap-[0.15rem] [&>small]:text-[0.6rem] [&>small]:font-[780] [&>small]:text-ink-600 [&>strong]:font-(family-name:--font-reader) [&>strong]:text-[0.76rem] [&>strong]:leading-[1.38] [&>strong]:font-[680]';
</script>

<section
  data-testid="exercise-card"
  class="mx-auto w-[min(100%,48rem)] rounded-[0.65rem_1.5rem_0.65rem_0.65rem] border border-ink-950 bg-paper-50 p-4 shadow-[5px_6px_0_var(--color-ink-950)] min-[640px]:p-5"
  aria-labelledby={`${exercise.id}-title`}
>
  <header class="flex gap-[0.8rem]">
    <span class="grid size-11 flex-none place-items-center rounded-[0.8rem] bg-acid-500"
      ><Sparkles size={18} /></span
    >
    <div>
      <p class="m-0 font-mono text-[0.61rem] font-[850] tracking-[0.07em] text-ink-600 uppercase">
        {copy('Učební zastávka', 'Reading exercise')}
      </p>
      <h2
        class="mt-1 text-[clamp(1.12rem,4vw,1.55rem)] leading-[1.08] font-black tracking-[-0.04em]"
        id={`${exercise.id}-title`}
      >
        {displayExercise.prompt}
      </h2>
      <span class="mt-[0.35rem] block text-[0.73rem] leading-[1.4] text-ink-600"
        >{displayExercise.instruction}</span
      >
    </div>
  </header>

  {#if exercise.kind === 'matching'}
    <div class="mt-4">
      <PairMatchingBoard
        round={matchingRound}
        compact
        disabled={Boolean(feedback) || saving}
        oncomplete={completeMatching}
      />
    </div>
  {:else if exercise.kind === 'order'}
    <div
      class="{answerTray} flex min-h-[4.35rem] flex-wrap content-center gap-[0.4rem]"
      aria-label={copy('Poskládaná věta', 'Assembled sentence')}
    >
      {#if selectedTokenIndices.length === 0}
        <span class={emptyAnswer}>{copy('Věta začne tady…', 'Your sentence starts here…')}</span>
      {:else}
        {#each selectedTokenIndices as tokenIndex, position}
          <button
            class={token}
            type="button"
            disabled={Boolean(feedback) || saving}
            aria-label={copy(
              `Odebrat úsek ${exercise.tokens[tokenIndex]}`,
              `Remove segment ${exercise.tokens[tokenIndex]}`,
            )}
            onclick={() => removeToken(position)}>{exercise.tokens[tokenIndex]}</button
          >
        {/each}
      {/if}
    </div>
    <div
      class="mt-[0.65rem] flex flex-wrap gap-[0.4rem]"
      data-testid="token-bank"
      aria-label={copy('Dostupné úseky věty', 'Available sentence segments')}
    >
      {#each exercise.tokens as token, index}
        <button
          class="{token} disabled:opacity-28 disabled:shadow-none"
          type="button"
          disabled={selectedTokenIndices.includes(index) || Boolean(feedback) || saving}
          onclick={() => chooseToken(index)}>{token}</button
        >
      {/each}
    </div>
  {:else if exercise.kind === 'sequence'}
    <div
      class="{answerTray} grid min-h-[5.1rem] gap-[0.45rem]"
      data-testid="timeline-answer"
      aria-label={copy('Tvoje dějová osa', 'Your story timeline')}
    >
      {#if selectedTokenIndices.length === 0}
        <span class={emptyAnswer}>
          {copy('První událost přijde sem…', 'The first event goes here…')}
        </span>
      {:else}
        {#each selectedTokenIndices as optionIndex, position}
          <button
            class={timelineItem}
            type="button"
            disabled={Boolean(feedback) || saving}
            aria-label={copy(
              `Odebrat událost ${position + 1}: ${exercise.options[optionIndex]}`,
              `Remove event ${position + 1}: ${exercise.options[optionIndex]}`,
            )}
            onclick={() => removeToken(position)}
          >
            <span>{position + 1}</span>
            <strong lang="de">{exercise.options[optionIndex]}</strong>
            <X size={16} aria-hidden="true" />
          </button>
        {/each}
      {/if}
    </div>
    <div
      class="mt-[0.65rem] grid gap-[0.4rem]"
      data-testid="timeline-bank"
      aria-label={copy('Události k seřazení', 'Events to order')}
    >
      {#each exercise.options as option, index}
        {#if !selectedTokenIndices.includes(index)}
          <button
            class="{timelineItem} disabled:opacity-32"
            type="button"
            disabled={Boolean(feedback) || saving}
            onclick={() => chooseToken(index)}
          >
            <span>?</span>
            <strong lang="de">{option}</strong>
          </button>
        {/if}
      {/each}
    </div>
  {:else if exercise.kind === 'arc'}
    <div
      class="mt-4 grid gap-2"
      data-testid="arc-options"
      aria-label={copy('Možné oblouky scény', 'Possible scene arcs')}
    >
      {#each exercise.options as option, index}
        <button
          type="button"
          class={[
            'grid min-h-24 grid-cols-[1.7rem_minmax(0,1fr)_auto] items-center gap-x-[0.6rem] gap-y-[0.2rem] rounded-[0.8rem] border px-[0.7rem] py-[0.65rem] text-left',
            optionState(
              selectedOption === option.id,
              feedback === 'correct' && option.id === exercise.answerId,
            ),
          ]}
          aria-pressed={selectedOption === option.id}
          disabled={Boolean(feedback) || saving}
          onclick={() => chooseOption(option.id)}
        >
          <span
            class="row-[1/span_3] self-start pt-[0.1rem] font-mono text-[0.58rem] font-[850] text-ink-600"
            >{String(index + 1).padStart(2, '0')}</span
          >
          <span class={arcBeat} data-arc-beat>
            <small>{copy('Začátek', 'Opening')}</small>
            <strong lang="de">{option.openingDe}</strong>
          </span>
          <span class="col-start-2 text-cobalt-700"
            ><ArrowRight size={17} aria-hidden="true" /></span
          >
          <span class={arcBeat} data-arc-beat>
            <small>{copy('Co se změnilo', 'What changed')}</small>
            <strong lang="de">{option.closingDe}</strong>
          </span>
          {#if feedback === 'correct' && option.id === exercise.answerId}
            <span class="col-start-3 row-[1/span_3] text-mint-700"
              ><Check size={18} aria-hidden="true" /></span
            >
          {/if}
        </button>
      {/each}
    </div>
  {:else if exercise.kind === 'recall'}
    <p class={clozeSentence} lang="de">
      {exercise.before}<span aria-hidden="true">…</span>{exercise.after}
    </p>
    <form
      id={`${exercise.id}-recall-form`}
      class="mt-[0.85rem] grid gap-2"
      onsubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label class={fieldLabel} for={`${exercise.id}-answer`}
        >{copy('Chybějící německý tvar', 'Missing German form')}</label
      >
      <input
        bind:this={recallInput}
        id={`${exercise.id}-answer`}
        class="{textField} aria-invalid:border-coral-700 aria-invalid:bg-coral-50"
        bind:value={writtenAnswer}
        lang="de"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        disabled={Boolean(feedback) || saving}
        aria-invalid={feedback === 'incorrect'}
        aria-describedby={`${exercise.id}-recall-help`}
      />
      <p class={smallNote} id={`${exercise.id}-recall-help`}>
        {failedAttempts > 0
          ? copy(`Nápověda: ${exercise.hintDe}`, `Hint: ${exercise.hintDe}`)
          : copy(
              'Nejdřív bez nabídky. Po chybě dostaneš nápovědu.',
              'Try without options first. A hint appears after an error.',
            )}
      </p>
    </form>
  {:else if exercise.kind === 'production'}
    <div class="mt-[0.85rem] grid gap-2">
      <label class={fieldLabel} for={`${exercise.id}-production`}
        >{copy('Tvoje německá věta', 'Your German sentence')}</label
      >
      <textarea
        bind:this={productionInput}
        id={`${exercise.id}-production`}
        class="{textField} min-h-[7.5rem] resize-y"
        bind:value={writtenAnswer}
        lang="de"
        rows="4"
        placeholder={exercise.starterDe}
        disabled={Boolean(feedback) || saving}
        aria-describedby={`${exercise.id}-production-help`}></textarea>
      <div
        class="{smallNote} flex flex-wrap justify-between gap-x-[0.8rem] gap-y-[0.35rem] [&>span]:inline-flex [&>span]:items-center [&>span]:gap-[0.3rem]"
        id={`${exercise.id}-production-help`}
      >
        <span
          >{copy(
            `${productionWordCount()}/${exercise.minimumWords} slov minimum`,
            `${productionWordCount()}/${exercise.minimumWords} words minimum`,
          )}</span
        >
        <span
          ><ShieldCheck size={14} aria-hidden="true" />
          {copy(
            'Text zůstane jen na této obrazovce.',
            'Your text stays on this screen only.',
          )}</span
        >
      </div>
      {#if exercise.supportWords.length}
        <div class="mt-1 flex items-start gap-[0.55rem]">
          <span class="pt-[0.28rem] font-mono text-[0.62rem] font-extrabold text-ink-700"
            >{copy('Můžeš použít', 'You can use')}</span
          >
          <ul class="m-0 flex list-none flex-wrap gap-[0.35rem] p-0">
            {#each exercise.supportWords as word}<li
                class="rounded-full border border-line bg-sky-50 px-[0.52rem] py-[0.3rem] text-[0.68rem] font-[760]"
                lang="de"
              >
                {word}
              </li>{/each}
          </ul>
        </div>
      {/if}
      {#if productionRevealed}
        <section
          class="mt-[0.35rem] rounded-[0.7rem] border border-cobalt-700 bg-sky-50 p-[0.8rem]"
          aria-labelledby={`${exercise.id}-support-title`}
        >
          <h3 class="m-0 text-[0.78rem] font-[850]" id={`${exercise.id}-support-title`}>
            {copy('Opora přímo z děje', 'A clue from the story')}
          </h3>
          <p
            class="mt-[0.45rem] mb-0 font-(family-name:--font-reader) text-[0.9rem] leading-[1.55]"
            lang="de"
          >
            {exercise.modelAnswerDe}
          </p>
          <fieldset class="mt-[0.65rem] mb-0 grid gap-[0.2rem] border-0 p-0">
            <legend class="mb-[0.3rem] text-[0.7rem] font-[820] text-ink-800">
              {copy(
                'Před pokračováním zkontroluj svou větu',
                'Check your sentence before continuing',
              )}
            </legend>
            {#each exercise.checklistCs as item, index}
              <label
                class="grid min-h-11 grid-cols-[1.15rem_minmax(0,1fr)] items-center gap-[0.55rem] border-t border-[color-mix(in_srgb,var(--color-cobalt-700)_18%,transparent)] text-[0.7rem] leading-[1.4] text-ink-800"
              >
                <input
                  class="size-[1.05rem] accent-cobalt-700"
                  type="checkbox"
                  bind:checked={productionChecks[index]}
                />
                <span>{productionChecklistItem(item, index)}</span>
              </label>
            {/each}
          </fieldset>
        </section>
      {/if}
    </div>
  {:else}
    {#if exercise.kind === 'cloze'}
      <p class={clozeSentence} lang="de">
        {exercise.before}<span aria-label={copy('chybějící výraz', 'missing expression')}>…</span
        >{exercise.after}
      </p>
    {/if}
    <div class="mt-4 grid gap-[0.48rem] min-[640px]:grid-cols-3">
      {#each exercise.options as option, index}
        <button
          type="button"
          class={[
            'grid min-h-[3.35rem] grid-cols-[1.7rem_minmax(0,1fr)_auto] items-center gap-[0.55rem] rounded-[0.78rem] border px-3 py-[0.65rem] text-left min-[640px]:grid-cols-[1.5rem_minmax(0,1fr)_auto]',
            optionState(
              selectedOption === option,
              feedback === 'correct' && option === exercise.answer,
            ),
          ]}
          disabled={Boolean(feedback) || saving}
          onclick={() => chooseOption(option)}
        >
          <span class="font-mono text-[0.59rem] font-extrabold text-ink-600"
            >{String(index + 1).padStart(2, '0')}</span
          >
          <strong class="text-[0.8rem] leading-[1.35] font-[780]" lang="de">{option}</strong>
          {#if feedback === 'correct' && option === exercise.answer}<Check size={18} />{/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if saveError}<p class="mt-3 mb-0 text-[0.7rem] text-coral-700" role="alert">{saveError}</p>{/if}

  {#if feedback && !(feedback === 'correct' && exercise.kind === 'arc')}
    <div
      class={[
        'mt-[0.85rem] flex gap-[0.65rem] rounded-[0.8rem] p-3',
        feedback === 'correct' ? 'bg-mint-50 text-mint-700' : 'bg-coral-50 text-coral-700',
      ]}
      data-testid="exercise-feedback"
      data-state={feedback}
      role="status"
      aria-live="polite"
    >
      <span class="flex-none"
        >{#if feedback === 'correct'}<CheckCircle2 size={22} />{:else}<X size={22} />{/if}</span
      >
      <div>
        <strong class="text-[0.78rem]"
          >{feedback === 'correct'
            ? copy('Sedí to.', 'Correct.')
            : copy('Ještě jeden pokus.', 'One more try.')}</strong
        >
        <p class="mt-[0.2rem] mb-0 text-[0.7rem] leading-[1.4] text-ink-800">
          {feedback === 'correct'
            ? exercise.kind === 'matching' && matchingMistakes > 0
              ? `${displayExercise.success} ${copy(
                  matchingMistakes === 1
                    ? 'Dokončeno s jedním slepým pokusem.'
                    : `Dokončeno se ${matchingMistakes} slepými pokusy.`,
                  matchingMistakes === 1
                    ? 'Completed with one incorrect pairing.'
                    : `Completed with ${matchingMistakes} incorrect pairings.`,
                )}`
              : displayExercise.success
            : exercise.kind === 'recall'
              ? failedAttempts === 1
                ? copy(
                    `Nápověda: ${exercise.hintDe}. Zkus vybavit celý tvar znovu.`,
                    `Hint: ${exercise.hintDe}. Retrieve the complete form once more.`,
                  )
                : copy(
                    `Správný tvar je „${exercise.answer}“. Teď ho napiš ještě jednou bez kopírování.`,
                    `The correct form is “${exercise.answer}”. Now type it once more without copying.`,
                  )
              : exercise.kind === 'sequence'
                ? copy(
                    `${exercise.explanationCs} Začni událostí: „${exercise.answer[0]}“`,
                    `All three events appeared in the episode. Start with: “${exercise.answer[0]}”`,
                  )
                : exercise.kind === 'arc'
                  ? copy(
                      'Porovnej první a poslední stopu jako dvojici. Jedno známé slovo samo nestačí.',
                      'Compare the opening and closing clues as a pair. One familiar word is not enough.',
                    )
                  : exercise.kind === 'order'
                    ? copy(
                        `Správné pořadí je: „${exercise.sentence}“`,
                        `The correct order is: “${exercise.sentence}”`,
                      )
                    : exercise.kind === 'cloze' || exercise.kind === 'memory'
                      ? copy(
                          `Správně je: „${exercise.answer}“. Vyber ji teď znovu.`,
                          `The correct answer is: “${exercise.answer}”. Select it once more.`,
                        )
                      : copy(
                          'Vrať se k úloze a proveď opravu.',
                          'Return to the task and make the correction.',
                        )}
        </p>
      </div>
    </div>
  {/if}

  {#if feedback === 'correct' && exercise.kind === 'arc'}
    <aside
      class="mt-[0.8rem] grid gap-[0.35rem] rounded-[0.8rem] border border-[color-mix(in_srgb,var(--color-mint-700)_35%,transparent)] bg-mint-50 p-3"
      data-testid="arc-reveal"
      role="status"
      aria-live="polite"
    >
      <div class="flex items-center gap-[0.45rem] text-mint-700">
        <CheckCircle2 size={20} aria-hidden="true" />
        <strong class="text-[0.74rem] leading-[1.35] font-[830]">{displayExercise.success}</strong>
      </div>
      <span class="mt-[0.2rem] font-mono text-[0.61rem] font-[850] text-mint-700"
        >{copy('Teď jednou větou', 'The whole scene')}</span
      >
      <p
        class="m-0 font-(family-name:--font-reader) text-[0.86rem] leading-[1.45] font-[720] text-ink-950"
      >
        {copy(
          exercise.summaryCs,
          'The opening clue and the final change belong to the same scene.',
        )}
      </p>
    </aside>
  {/if}

  <div class="mt-[0.9rem] flex flex-wrap justify-end gap-2">
    {#if feedback === 'incorrect'}
      <button class={secondaryAction} type="button" onclick={retry}
        ><RotateCcw size={17} /> {copy('Provést opravu', 'Make the correction')}</button
      >
    {:else if feedback === 'correct'}
      <button class={primaryAction} type="button" onclick={oncontinue}>
        {copy('Číst dál', 'Keep reading')}
        <ArrowRight size={18} />
      </button>
    {:else if exercise.kind === 'matching'}
      {#if saveError}
        <button
          class={secondaryAction}
          type="button"
          disabled={saving}
          onclick={() => completeMatching(matchingMistakes)}
        >
          <RotateCcw size={17} />
          {saving ? copy('Ukládám…', 'Saving…') : copy('Zkusit uložit znovu', 'Try saving again')}
        </button>
      {:else}
        <span
          class="inline-flex min-h-[2.85rem] items-center gap-[0.4rem] font-mono text-[0.63rem] font-[750] text-ink-600"
          aria-live="polite"
        >
          {#if saving}<LoaderCircle class="animate-spin" size={16} />
            {copy('Ukládám výsledek…', 'Saving result…')}{:else}{copy(
              'Spoj všechny dvojice a pokračování se odemkne.',
              'Match every pair to unlock the next section.',
            )}{/if}
        </span>
      {/if}
    {:else if exercise.kind === 'production'}
      {#if productionRevealed}
        <button class={secondaryAction} type="button" onclick={() => productionInput?.focus()}>
          {copy('Ještě upravit', 'Revise my sentence')}
        </button>
        <button
          class={primaryAction}
          type="button"
          disabled={saving || !productionChecklistComplete()}
          onclick={completeProduction}
        >
          {#if saving}<LoaderCircle class="animate-spin" size={18} />{/if}
          {saving
            ? copy('Ukládám…', 'Saving…')
            : copy('Zkontrolováno, pokračovat', 'Checked, continue')}
          <Check size={18} />
        </button>
      {:else}
        <button
          class={primaryAction}
          type="button"
          disabled={productionWordCount() < exercise.minimumWords}
          onclick={revealProduction}
        >
          {copy('Porovnat s dějem', 'Compare with the story')}
          <ArrowRight size={18} />
        </button>
      {/if}
    {:else}
      <button
        class={primaryAction}
        type={exercise.kind === 'recall' ? 'submit' : 'button'}
        form={exercise.kind === 'recall' ? `${exercise.id}-recall-form` : undefined}
        disabled={!canSubmit || saving}
        onclick={exercise.kind === 'recall' ? undefined : submit}
      >
        {#if saving}<LoaderCircle class="animate-spin" size={18} />
          {copy('Ukládám…', 'Saving…')}{:else}{copy('Zkontrolovat', 'Check')}
          <Check size={18} />{/if}
      </button>
    {/if}
  </div>
</section>
