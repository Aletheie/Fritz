<script lang="ts">
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
      saveError =
        error instanceof Error && $motherTongue === 'cs'
          ? error.message
          : copy('Výsledek se nepodařilo uložit.', 'The result could not be saved.');
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
      saveError =
        error instanceof Error && $motherTongue === 'cs'
          ? error.message
          : copy('Výsledek se nepodařilo uložit.', 'The result could not be saved.');
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
      saveError =
        error instanceof Error && $motherTongue === 'cs'
          ? error.message
          : copy('Výsledek se nepodařilo uložit.', 'The result could not be saved.');
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
</script>

<section class="exercise-card" aria-labelledby={`${exercise.id}-title`}>
  <header class="exercise-heading">
    <span class="exercise-mark"><Sparkles size={18} /></span>
    <div>
      <p>{copy('Učební zastávka', 'Reading exercise')}</p>
      <h2 id={`${exercise.id}-title`}>{displayExercise.prompt}</h2>
      <span>{displayExercise.instruction}</span>
    </div>
  </header>

  {#if exercise.kind === 'matching'}
    <div class="matching-wrap">
      <PairMatchingBoard
        round={matchingRound}
        compact
        disabled={Boolean(feedback) || saving}
        oncomplete={completeMatching}
      />
    </div>
  {:else if exercise.kind === 'order'}
    <div class="order-answer" aria-label={copy('Poskládaná věta', 'Assembled sentence')}>
      {#if selectedTokenIndices.length === 0}
        <span class="empty-answer">{copy('Věta začne tady…', 'Your sentence starts here…')}</span>
      {:else}
        {#each selectedTokenIndices as tokenIndex, position}
          <button
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
    <div class="token-bank" aria-label={copy('Dostupné úseky věty', 'Available sentence segments')}>
      {#each exercise.tokens as token, index}
        <button
          type="button"
          disabled={selectedTokenIndices.includes(index) || Boolean(feedback) || saving}
          onclick={() => chooseToken(index)}>{token}</button
        >
      {/each}
    </div>
  {:else if exercise.kind === 'sequence'}
    <div class="timeline-answer" aria-label={copy('Tvoje dějová osa', 'Your story timeline')}>
      {#if selectedTokenIndices.length === 0}
        <span class="empty-answer">
          {copy('První událost přijde sem…', 'The first event goes here…')}
        </span>
      {:else}
        {#each selectedTokenIndices as optionIndex, position}
          <button
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
    <div class="timeline-bank" aria-label={copy('Události k seřazení', 'Events to order')}>
      {#each exercise.options as option, index}
        {#if !selectedTokenIndices.includes(index)}
          <button
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
    <div class="arc-options" aria-label={copy('Možné oblouky scény', 'Possible scene arcs')}>
      {#each exercise.options as option, index}
        <button
          type="button"
          class:selected={selectedOption === option.id}
          class:correct-option={feedback === 'correct' && option.id === exercise.answerId}
          aria-pressed={selectedOption === option.id}
          disabled={Boolean(feedback) || saving}
          onclick={() => chooseOption(option.id)}
        >
          <span class="arc-number">{String(index + 1).padStart(2, '0')}</span>
          <span class="arc-beat">
            <small>{copy('Začátek', 'Opening')}</small>
            <strong lang="de">{option.openingDe}</strong>
          </span>
          <span class="arc-arrow"><ArrowRight size={17} aria-hidden="true" /></span>
          <span class="arc-beat">
            <small>{copy('Co se změnilo', 'What changed')}</small>
            <strong lang="de">{option.closingDe}</strong>
          </span>
          {#if feedback === 'correct' && option.id === exercise.answerId}
            <span class="arc-check"><Check size={18} aria-hidden="true" /></span>
          {/if}
        </button>
      {/each}
    </div>
  {:else if exercise.kind === 'recall'}
    <p class="cloze-sentence" lang="de">
      {exercise.before}<span aria-hidden="true">…</span>{exercise.after}
    </p>
    <form
      id={`${exercise.id}-recall-form`}
      class="recall-form"
      onsubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label for={`${exercise.id}-answer`}
        >{copy('Chybějící německý tvar', 'Missing German form')}</label
      >
      <input
        bind:this={recallInput}
        id={`${exercise.id}-answer`}
        bind:value={writtenAnswer}
        lang="de"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        disabled={Boolean(feedback) || saving}
        aria-invalid={feedback === 'incorrect'}
        aria-describedby={`${exercise.id}-recall-help`}
      />
      <p id={`${exercise.id}-recall-help`}>
        {failedAttempts > 0
          ? copy(`Nápověda: ${exercise.hintDe}`, `Hint: ${exercise.hintDe}`)
          : copy(
              'Nejdřív bez nabídky. Po chybě dostaneš nápovědu.',
              'Try without options first. A hint appears after an error.',
            )}
      </p>
    </form>
  {:else if exercise.kind === 'production'}
    <div class="production-workspace">
      <label for={`${exercise.id}-production`}
        >{copy('Tvoje německá věta', 'Your German sentence')}</label
      >
      <textarea
        bind:this={productionInput}
        id={`${exercise.id}-production`}
        bind:value={writtenAnswer}
        lang="de"
        rows="4"
        placeholder={exercise.starterDe}
        disabled={Boolean(feedback) || saving}
        aria-describedby={`${exercise.id}-production-help`}></textarea>
      <div class="production-meta" id={`${exercise.id}-production-help`}>
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
        <div class="support-words">
          <span>{copy('Můžeš použít', 'You can use')}</span>
          <ul>
            {#each exercise.supportWords as word}<li lang="de">{word}</li>{/each}
          </ul>
        </div>
      {/if}
      {#if productionRevealed}
        <section class="production-support" aria-labelledby={`${exercise.id}-support-title`}>
          <h3 id={`${exercise.id}-support-title`}>
            {copy('Opora přímo z děje', 'A clue from the story')}
          </h3>
          <p lang="de">{exercise.modelAnswerDe}</p>
          <fieldset>
            <legend>
              {copy(
                'Před pokračováním zkontroluj svou větu',
                'Check your sentence before continuing',
              )}
            </legend>
            {#each exercise.checklistCs as item, index}
              <label>
                <input type="checkbox" bind:checked={productionChecks[index]} />
                <span>{productionChecklistItem(item, index)}</span>
              </label>
            {/each}
          </fieldset>
        </section>
      {/if}
    </div>
  {:else}
    {#if exercise.kind === 'cloze'}
      <p class="cloze-sentence" lang="de">
        {exercise.before}<span aria-label={copy('chybějící výraz', 'missing expression')}>…</span
        >{exercise.after}
      </p>
    {/if}
    <div class="choice-list">
      {#each exercise.options as option, index}
        <button
          type="button"
          class:selected={selectedOption === option}
          class:correct-option={feedback === 'correct' && option === exercise.answer}
          disabled={Boolean(feedback) || saving}
          onclick={() => chooseOption(option)}
        >
          <span>{String(index + 1).padStart(2, '0')}</span>
          <strong lang="de">{option}</strong>
          {#if feedback === 'correct' && option === exercise.answer}<Check size={18} />{/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if saveError}<p class="save-error" role="alert">{saveError}</p>{/if}

  {#if feedback && !(feedback === 'correct' && exercise.kind === 'arc')}
    <div class:success={feedback === 'correct'} class="feedback" role="status" aria-live="polite">
      <span
        >{#if feedback === 'correct'}<CheckCircle2 size={22} />{:else}<X size={22} />{/if}</span
      >
      <div>
        <strong
          >{feedback === 'correct'
            ? copy('Sedí to.', 'Correct.')
            : copy('Ještě jeden pokus.', 'One more try.')}</strong
        >
        <p>
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
    <aside class="arc-reveal" role="status" aria-live="polite">
      <div>
        <CheckCircle2 size={20} aria-hidden="true" />
        <strong>{displayExercise.success}</strong>
      </div>
      <span>{copy('Teď jednou větou', 'The whole scene')}</span>
      <p>
        {copy(
          exercise.summaryCs,
          'The opening clue and the final change belong to the same scene.',
        )}
      </p>
    </aside>
  {/if}

  <div class="exercise-actions">
    {#if feedback === 'incorrect'}
      <button class="retry-button" type="button" onclick={retry}
        ><RotateCcw size={17} /> {copy('Provést opravu', 'Make the correction')}</button
      >
    {:else if feedback === 'correct'}
      <button class="continue-button" type="button" onclick={oncontinue}>
        {copy('Číst dál', 'Keep reading')}
        <ArrowRight size={18} />
      </button>
    {:else if exercise.kind === 'matching'}
      {#if saveError}
        <button
          class="retry-button"
          type="button"
          disabled={saving}
          onclick={() => completeMatching(matchingMistakes)}
        >
          <RotateCcw size={17} />
          {saving ? copy('Ukládám…', 'Saving…') : copy('Zkusit uložit znovu', 'Try saving again')}
        </button>
      {:else}
        <span class="matching-hint" aria-live="polite">
          {#if saving}<LoaderCircle class="spin" size={16} />
            {copy('Ukládám výsledek…', 'Saving result…')}{:else}{copy(
              'Spoj všechny dvojice a pokračování se odemkne.',
              'Match every pair to unlock the next section.',
            )}{/if}
        </span>
      {/if}
    {:else if exercise.kind === 'production'}
      {#if productionRevealed}
        <button class="retry-button" type="button" onclick={() => productionInput?.focus()}>
          {copy('Ještě upravit', 'Revise my sentence')}
        </button>
        <button
          class="continue-button"
          type="button"
          disabled={saving || !productionChecklistComplete()}
          onclick={completeProduction}
        >
          {#if saving}<LoaderCircle class="spin" size={18} />{/if}
          {saving
            ? copy('Ukládám…', 'Saving…')
            : copy('Zkontrolováno, pokračovat', 'Checked, continue')}
          <Check size={18} />
        </button>
      {:else}
        <button
          class="submit-button"
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
        class="submit-button"
        type={exercise.kind === 'recall' ? 'submit' : 'button'}
        form={exercise.kind === 'recall' ? `${exercise.id}-recall-form` : undefined}
        disabled={!canSubmit || saving}
        onclick={exercise.kind === 'recall' ? undefined : submit}
      >
        {#if saving}<LoaderCircle class="spin" size={18} />
          {copy('Ukládám…', 'Saving…')}{:else}{copy('Zkontrolovat', 'Check')}
          <Check size={18} />{/if}
      </button>
    {/if}
  </div>
</section>

<style>
  .exercise-card {
    width: min(100%, 48rem);
    margin: 0 auto;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem 1.5rem 0.65rem 0.65rem;
    background: var(--color-paper-50);
    padding: 1rem;
    box-shadow: 5px 6px 0 var(--color-ink-950);
  }
  .exercise-heading {
    display: flex;
    gap: 0.8rem;
  }
  .exercise-mark {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 0.8rem;
    background: var(--color-acid-500);
  }
  .exercise-heading p {
    margin: 0;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.61rem;
    font-weight: 850;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .exercise-heading h2 {
    margin: 0.25rem 0 0;
    font-size: clamp(1.12rem, 4vw, 1.55rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1.08;
  }
  .exercise-heading div > span {
    display: block;
    margin-top: 0.35rem;
    color: var(--color-ink-600);
    font-size: 0.73rem;
    line-height: 1.4;
  }
  .order-answer {
    display: flex;
    min-height: 4.35rem;
    flex-wrap: wrap;
    align-content: center;
    gap: 0.4rem;
    margin-top: 1rem;
    border: 1px dashed var(--color-line);
    border-radius: 0.85rem;
    background: var(--color-paper-100);
    padding: 0.65rem;
  }
  .matching-wrap {
    margin-top: 1rem;
  }
  .empty-answer {
    align-self: center;
    color: var(--color-ink-600);
    font-family: var(--font-reader);
    font-size: 0.87rem;
    font-style: italic;
  }
  .order-answer button,
  .token-bank button {
    min-height: 2.75rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.68rem;
    background: var(--color-paper-50);
    padding: 0.55rem 0.7rem;
    font-size: 0.78rem;
    font-weight: 750;
    box-shadow: 2px 2px 0 rgb(21 25 28 / 0.12);
  }
  .token-bank {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.65rem;
  }
  .token-bank button:disabled {
    opacity: 0.28;
    box-shadow: none;
  }
  .timeline-answer {
    display: grid;
    min-height: 5.1rem;
    gap: 0.45rem;
    margin-top: 1rem;
    border: 1px dashed var(--color-line);
    border-radius: 0.85rem;
    background: var(--color-paper-100);
    padding: 0.65rem;
  }
  .timeline-answer > .empty-answer {
    align-self: center;
  }
  .timeline-answer button,
  .timeline-bank button {
    display: grid;
    width: 100%;
    min-height: 3rem;
    grid-template-columns: 1.65rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.55rem;
    border: 1px solid var(--color-line);
    border-radius: 0.7rem;
    background: var(--color-paper-50);
    padding: 0.55rem 0.65rem;
    text-align: left;
  }
  .timeline-answer button > span,
  .timeline-bank button > span {
    display: grid;
    width: 1.5rem;
    height: 1.5rem;
    place-items: center;
    border-radius: 999px;
    color: var(--color-ink-950);
    background: var(--book-accent, var(--color-sky-200));
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 900;
  }
  .timeline-answer strong,
  .timeline-bank strong {
    font-family: var(--font-reader);
    font-size: 0.75rem;
    font-weight: 680;
    line-height: 1.4;
  }
  .timeline-bank {
    display: grid;
    gap: 0.4rem;
    margin-top: 0.65rem;
  }
  .timeline-bank button:disabled {
    opacity: 0.32;
  }
  .arc-options {
    display: grid;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .arc-options > button {
    display: grid;
    min-height: 6rem;
    grid-template-columns: 1.7rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.2rem 0.6rem;
    border: 1px solid var(--color-line);
    border-radius: 0.8rem;
    background: var(--color-paper-50);
    padding: 0.65rem 0.7rem;
    text-align: left;
  }
  .arc-options > button.selected {
    border-color: var(--color-ink-950);
    background: var(--color-sky-50);
    box-shadow: 2px 2px 0 rgb(21 25 28 / 0.12);
  }
  .arc-options > button.correct-option {
    background: var(--color-mint-50);
  }
  .arc-number {
    grid-row: 1 / span 3;
    align-self: start;
    padding-top: 0.1rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 850;
  }
  .arc-beat {
    display: grid;
    grid-column: 2;
    gap: 0.15rem;
  }
  .arc-beat small {
    color: var(--color-ink-600);
    font-size: 0.6rem;
    font-weight: 780;
  }
  .arc-beat strong {
    font-family: var(--font-reader);
    font-size: 0.76rem;
    font-weight: 680;
    line-height: 1.38;
  }
  .arc-arrow {
    grid-column: 2;
    color: var(--color-cobalt-700);
  }
  .arc-check {
    grid-row: 1 / span 3;
    grid-column: 3;
    color: var(--color-mint-700);
  }
  .cloze-sentence {
    margin: 1rem 0 0;
    border: 1px solid var(--color-cobalt-700);
    background: var(--color-sky-50);
    padding: 0.85rem;
    font-family: var(--font-reader);
    font-size: 1rem;
    line-height: 1.6;
  }
  .cloze-sentence span {
    display: inline-block;
    min-width: 3rem;
    margin-inline: 0.2rem;
    border-bottom: 2px dotted var(--color-cobalt-700);
    color: transparent;
  }
  .recall-form,
  .production-workspace {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.85rem;
  }
  .recall-form label,
  .production-workspace > label {
    color: var(--color-ink-800);
    font-size: 0.74rem;
    font-weight: 820;
  }
  .recall-form input,
  .production-workspace textarea {
    width: 100%;
    min-height: 3rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem;
    color: var(--color-ink-950);
    background: white;
    padding: 0.72rem 0.8rem;
    font: 750 1rem/1.45 var(--font-ui);
  }
  .production-workspace textarea {
    min-height: 7.5rem;
    resize: vertical;
  }
  .recall-form input:focus-visible,
  .production-workspace textarea:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--color-cobalt-700) 42%, transparent);
    outline-offset: 2px;
  }
  .recall-form input[aria-invalid='true'] {
    border-color: var(--color-coral-700);
    background: var(--color-coral-50);
  }
  .recall-form p,
  .production-meta {
    margin: 0;
    color: var(--color-ink-700);
    font-size: 0.68rem;
    line-height: 1.45;
  }
  .production-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.35rem 0.8rem;
  }
  .production-meta span {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .support-words {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    margin-top: 0.25rem;
  }
  .support-words > span {
    padding-top: 0.28rem;
    color: var(--color-ink-700);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 800;
  }
  .support-words ul {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .support-words li {
    border: 1px solid var(--color-line);
    border-radius: 999px;
    background: var(--color-sky-50);
    padding: 0.3rem 0.52rem;
    font-size: 0.68rem;
    font-weight: 760;
  }
  .production-support {
    margin-top: 0.35rem;
    border: 1px solid var(--color-cobalt-700);
    border-radius: 0.7rem;
    background: var(--color-sky-50);
    padding: 0.8rem;
  }
  .production-support h3 {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 850;
  }
  .production-support > p {
    margin: 0.45rem 0 0;
    font-family: var(--font-reader);
    font-size: 0.9rem;
    line-height: 1.55;
  }
  .production-support fieldset {
    display: grid;
    gap: 0.2rem;
    margin: 0.65rem 0 0;
    border: 0;
    padding: 0;
  }
  .production-support legend {
    margin-bottom: 0.3rem;
    color: var(--color-ink-800);
    font-size: 0.7rem;
    font-weight: 820;
  }
  .production-support label {
    display: grid;
    min-height: 2.75rem;
    grid-template-columns: 1.15rem minmax(0, 1fr);
    align-items: center;
    gap: 0.55rem;
    border-top: 1px solid color-mix(in srgb, var(--color-cobalt-700) 18%, transparent);
    color: var(--color-ink-800);
    font-size: 0.7rem;
    line-height: 1.4;
  }
  .production-support input {
    width: 1.05rem;
    height: 1.05rem;
    accent-color: var(--color-cobalt-700);
  }
  .choice-list {
    display: grid;
    gap: 0.48rem;
    margin-top: 1rem;
  }
  .choice-list button {
    display: grid;
    min-height: 3.35rem;
    grid-template-columns: 1.7rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.55rem;
    border: 1px solid var(--color-line);
    border-radius: 0.78rem;
    background: var(--color-paper-50);
    padding: 0.65rem 0.75rem;
    text-align: left;
  }
  .choice-list button > span {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.59rem;
    font-weight: 800;
  }
  .choice-list strong {
    font-size: 0.8rem;
    font-weight: 780;
    line-height: 1.35;
  }
  .choice-list button.selected {
    border-color: var(--color-ink-950);
    background: var(--color-sky-50);
    box-shadow: 2px 2px 0 rgb(21 25 28 / 0.12);
  }
  .choice-list button.correct-option {
    background: var(--color-mint-50);
  }
  .feedback {
    display: flex;
    gap: 0.65rem;
    margin-top: 0.85rem;
    border-radius: 0.8rem;
    color: var(--color-coral-700);
    background: var(--color-coral-50);
    padding: 0.75rem;
  }
  .feedback.success {
    color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .feedback > span {
    flex: 0 0 auto;
  }
  .feedback strong {
    font-size: 0.78rem;
  }
  .feedback p {
    margin: 0.2rem 0 0;
    color: var(--color-ink-800);
    font-size: 0.7rem;
    line-height: 1.4;
  }
  .arc-reveal {
    display: grid;
    gap: 0.35rem;
    margin-top: 0.8rem;
    border: 1px solid color-mix(in srgb, var(--color-mint-700) 35%, transparent);
    border-radius: 0.8rem;
    background: var(--color-mint-50);
    padding: 0.75rem;
  }
  .arc-reveal div {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--color-mint-700);
  }
  .arc-reveal div strong {
    font-size: 0.74rem;
    font-weight: 830;
    line-height: 1.35;
  }
  .arc-reveal span {
    margin-top: 0.2rem;
    color: var(--color-mint-700);
    font-family: var(--font-mono);
    font-size: 0.61rem;
    font-weight: 850;
  }
  .arc-reveal p {
    margin: 0;
    color: var(--color-ink-950);
    font-family: var(--font-reader);
    font-size: 0.86rem;
    font-weight: 720;
    line-height: 1.45;
  }
  .save-error {
    margin: 0.75rem 0 0;
    color: var(--color-coral-700);
    font-size: 0.7rem;
  }
  .exercise-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.9rem;
  }
  .matching-hint {
    display: inline-flex;
    min-height: 2.85rem;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.63rem;
    font-weight: 750;
  }
  .exercise-actions button {
    display: inline-flex;
    min-height: 2.85rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border-radius: 0.75rem;
    padding: 0.7rem 1rem;
    font-size: 0.78rem;
    font-weight: 850;
  }
  .submit-button,
  .continue-button {
    min-width: min(100%, 11rem);
    color: white;
    background: var(--color-ink-950);
  }
  .submit-button:disabled {
    opacity: 0.38;
  }
  .retry-button {
    border: 1px solid var(--color-ink-950);
    background: var(--color-paper-50);
  }
  :global(.spin) {
    animation: spin 850ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (min-width: 640px) {
    .exercise-card {
      padding: 1.25rem;
    }
    .choice-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .choice-list button {
      grid-template-columns: 1.5rem minmax(0, 1fr) auto;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.spin) {
      animation: none;
    }
  }
</style>
