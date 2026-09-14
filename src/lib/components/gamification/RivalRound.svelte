<script lang="ts">
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import type { RivalMatch } from '$lib/domain/rival/types.ts';
  import type { MotherTongue } from '$lib/domain/types.ts';
  import { rivalNames, rivalTopics } from '$lib/i18n/rival.ts';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import { onMount, tick } from 'svelte';

  type Props = {
    match: RivalMatch;
    language: MotherTongue;
    busy: boolean;
    onanswer: (answer: string, stake: 1 | 2) => void;
    onnext: () => void;
    onswitch: () => void;
  };
  let { match, language, busy, onanswer, onnext, onswitch }: Props = $props();
  let answer = $state('');
  let boosted = $state(false);
  let pendingSwap = $state(false);
  let heading: HTMLHeadingElement;
  let input = $state<HTMLInputElement>();
  let nextButton = $state<HTMLButtonElement>();
  let swapButton = $state<HTMLButtonElement>();
  let keepAnswerButton = $state<HTMLButtonElement>();
  let feedbackPanel = $state<HTMLDivElement>();
  let footer = $state<HTMLDivElement>();
  const round = $derived(match.rounds.at(-1)!);
  const question = $derived(round.question);
  const boostSpent = $derived(match.rounds.some((item) => item.result?.stake === 2));
  const copy = (cs: string, en: string) => (language === 'cs' ? cs : en);
  onMount(() => {
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'nearest' });
    window.visualViewport?.addEventListener('resize', keepAnswerInView);
    return () => window.visualViewport?.removeEventListener('resize', keepAnswerInView);
  });
  $effect(() => {
    if (round.result)
      void tick().then(() => {
        nextButton?.focus({ preventScroll: true });
        return feedbackPanel?.scrollIntoView({ block: 'nearest' });
      });
  });

  async function insertCharacter(character: string): Promise<void> {
    if (busy || pendingSwap || !input) return;
    const start = input.selectionStart ?? answer.length;
    const end = input.selectionEnd ?? start;
    if (answer.length - (end - start) + character.length > 1000) return;
    answer = answer.slice(0, start) + character + answer.slice(end);
    await tick();
    input.focus({ preventScroll: true });
    input.setSelectionRange(start + character.length, start + character.length);
  }

  function keepAnswerInView(): void {
    if (!input || document.activeElement !== input || !footer) return;
    const answerBottom = input.getBoundingClientRect().bottom;
    const viewport = window.visualViewport;
    const visibleBottom = Math.min(
      footer.getBoundingClientRect().top,
      viewport ? viewport.height + viewport.offsetTop : window.innerHeight,
    );
    if (answerBottom + 16 > visibleBottom)
      input.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  async function requestSwap(): Promise<void> {
    if (!answer.trim()) {
      onswitch();
      return;
    }
    pendingSwap = true;
    await tick();
    keepAnswerButton?.focus({ preventScroll: true });
    keepAnswerButton?.scrollIntoView({ block: 'nearest' });
  }

  async function cancelSwap(): Promise<void> {
    pendingSwap = false;
    await tick();
    swapButton?.focus({ preventScroll: true });
  }
</script>

<svelte:window onresize={keepAnswerInView} />

<section class="round-panel" aria-labelledby="round-question" aria-busy={busy}>
  <div class="round-label">
    <span>{rivalTopics[question.topic][language]}</span>
    <span>{copy(`Kolo ${match.rounds.length} z 5`, `Round ${match.rounds.length} of 5`)}</span>
  </div>
  <h2
    id="round-question"
    tabindex="-1"
    bind:this={heading}
    lang={question.promptLanguage === 'de' ? 'de' : language}
  >
    {question.prompt[language]}
  </h2>

  {#if !round.result}
    <p class="instruction" id="answer-help">
      {question.topic === 'recall'
        ? /^(?:der|die|das)\s/iu.test(question.answer)
          ? copy(
              'Napiš německý výraz i se členem.',
              'Write the German expression with its article.',
            )
          : copy('Napiš německý výraz.', 'Write the German expression.')
        : question.topic === 'articles'
          ? copy('Vyber správný člen.', 'Choose the correct article.')
          : question.options.length
            ? copy('Vyber správnou možnost.', 'Choose the correct option.')
            : copy('Doplň chybějící německý tvar.', 'Fill in the missing German form.')}
    </p>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        if (answer.trim() && !busy && !pendingSwap) onanswer(answer, boosted ? 2 : 1);
      }}
    >
      {#if question.options.length}
        <fieldset
          class="answers"
          class:article-answers={question.topic === 'articles'}
          disabled={busy || pendingSwap}
        >
          <legend class="sr-only">{copy('Tvoje odpověď', 'Your answer')}</legend>
          {#each question.options as option}
            <label class:selected={answer === option}>
              <input type="radio" name="duel-answer" value={option} bind:group={answer} />
              <span lang="de">{option}</span>
              {#if answer === option && question.topic !== 'articles'}<Check
                  size={18}
                  aria-hidden="true"
                />{/if}
            </label>
          {/each}
        </fieldset>
      {:else}
        <label class="sr-only" for="duel-answer"
          >{copy('Tvoje německá odpověď', 'Your German answer')}</label
        >
        <input
          id="duel-answer"
          class="answer-input"
          lang="de"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck={false}
          placeholder={copy('Napiš odpověď německy', 'Type your answer in German')}
          enterkeyhint="done"
          onfocus={() => requestAnimationFrame(keepAnswerInView)}
          maxlength="1000"
          aria-describedby="answer-help"
          bind:value={answer}
          bind:this={input}
          disabled={busy || pendingSwap}
        />
        <div class="german-characters"><GermanKeyboard oninsert={insertCharacter} /></div>
      {/if}
      <div class="tactics">
        <button
          type="button"
          class:boosted
          aria-pressed={boosted}
          disabled={busy || boostSpent || pendingSwap}
          aria-describedby="bonus-help"
          onclick={() => (boosted = !boosted)}
        >
          {boostSpent
            ? copy('Bonus využitý', 'Bonus used')
            : boosted
              ? copy('Bonus 2× zapnutý', '2× bonus on')
              : copy('Bonus 2×', '2× bonus')}
        </button>
        {#if !match.discardedSourceIds.length}
          <button
            type="button"
            disabled={busy || pendingSwap}
            bind:this={swapButton}
            onclick={requestSwap}
            ><RefreshCw size={14} aria-hidden="true" />
            {copy('Vyměnit otázku', 'Swap question')}</button
          >
        {:else}<span>{copy('Výměna využitá', 'Swap used')}</span>{/if}
      </div>
      <p class="bonus-note" id="bonus-help">
        {boosted
          ? copy(
              'Za správnou odpověď teď získáš 2 body. Za chybu nic neztrácíš.',
              'A correct answer now earns 2 points. Mistakes never cost you points.',
            )
          : boostSpent
            ? copy(
                'Správná odpověď přidá 1 bod. Za chybu nic neztrácíš.',
                'A correct answer earns 1 point. Mistakes never cost you points.',
              )
            : copy(
                'Bonus zdvojnásobí body za správnou odpověď. Použít ho můžeš jednou.',
                'The bonus doubles your points for a correct answer. You can use it once.',
              )}
      </p>
      {#if round.botStake === 2}<p class="bot-stake">
          {copy(
            `${rivalNames[match.rivalId]} teď hraje s bonusem za 2 body.`,
            `${rivalNames[match.rivalId]} is using a 2-point bonus this round.`,
          )}
        </p>{/if}
      <div class="round-footer" bind:this={footer}>
        {#if pendingSwap}
          <div class="swap-confirmation" role="group" aria-labelledby="swap-warning">
            <p id="swap-warning">
              {copy(
                'Výměnou přijdeš o tuto odpověď. Vyměnit otázku?',
                'Swapping will clear this answer. Swap the question?',
              )}
            </p>
            <div>
              <button
                type="button"
                class="btn-base btn-secondary"
                bind:this={keepAnswerButton}
                onclick={cancelSwap}
                disabled={busy}>{copy('Nechat otázku', 'Keep question')}</button
              >
              <button type="button" class="btn-base btn-primary" onclick={onswitch} disabled={busy}
                >{copy('Vyměnit i tak', 'Swap anyway')}</button
              >
            </div>
          </div>
        {:else}
          <button
            class="btn-base btn-primary confirm"
            type="submit"
            disabled={!answer.trim() || busy}
            >{busy
              ? copy('Ukládám odpověď…', 'Saving answer…')
              : copy('Potvrdit odpověď', 'Confirm answer')}<ArrowRight
              size={18}
              aria-hidden="true"
            /></button
          >
        {/if}
      </div>
    </form>
  {:else}
    <div class:correct={round.result.correct} class="feedback" bind:this={feedbackPanel}>
      <div class="feedback-summary" role="status">
        <strong
          >{round.result.correct
            ? copy('Přesná odpověď.', 'Correct answer.')
            : copy('Správná odpověď:', 'The correct answer:')}</strong
        >
        <p class="correct-answer" lang="de">{question.answer}</p>
        <div class="round-result">
          <span>{copy('Ty', 'You')}: <b>+{round.result.correct ? round.result.stake : 0}</b></span>
          <span>{rivalNames[match.rivalId]}: <b>+{round.botCorrect ? round.botStake : 0}</b></span>
        </div>
        <p class="bot-answer">
          {copy('Odpověď robota:', 'Robot answer:')}
          <span lang={round.botAnswer === '—' ? language : 'de'}
            >{round.botAnswer === '—' ? copy('Nevím.', 'I do not know.') : round.botAnswer}</span
          >
          · {round.botCorrect ? copy('správně', 'correct') : copy('bez bodu', 'no point')}
        </p>
      </div>
      <details class="explanation" open={!round.result.correct}>
        <summary>{copy('Vysvětlení odpovědi', 'Answer explained')}</summary>
        <p>{question.explanation[language]}</p>
      </details>
    </div>
    <div class="round-footer">
      <button
        class="btn-base btn-primary confirm"
        bind:this={nextButton}
        onclick={onnext}
        disabled={busy}
        >{match.completedAt
          ? copy('Zobrazit výsledek', 'See result')
          : copy('Další kolo', 'Next round')}<ArrowRight size={18} aria-hidden="true" /></button
      >
    </div>
  {/if}
</section>

<style>
  .round-panel {
    min-width: 0;
    background: var(--color-paper-50);
    border: 1px solid var(--color-line);
    border-radius: 14px;
    padding: 1.5rem;
  }
  .round-label {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    color: var(--color-ink-600);
    font-size: 0.8rem;
  }
  h2 {
    margin: 1.6rem 0 0.8rem;
    font-size: 1.8rem;
    line-height: 1.2;
    letter-spacing: -0.025em;
    overflow-wrap: anywhere;
    text-wrap: balance;
  }
  h2:focus {
    outline: none;
  }
  .instruction,
  .bonus-note,
  .bot-answer {
    color: var(--color-ink-600);
    font-size: 0.86rem;
    line-height: 1.5;
  }
  .instruction {
    margin-bottom: 1.25rem;
  }
  .answers {
    display: grid;
    gap: 0.55rem;
    border: 0;
    padding: 0;
    margin: 0;
    min-width: 0;
  }
  .answers label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 3.25rem;
    padding: 0.7rem 0.85rem;
    border: 1px solid var(--color-line);
    border-radius: 10px;
    cursor: pointer;
    overflow-wrap: anywhere;
  }
  .answers label.selected {
    background: var(--color-cobalt-50);
    border-color: var(--color-cobalt-700);
  }
  .answers input {
    accent-color: var(--color-cobalt-700);
    flex: none;
    width: 1.1rem;
    height: 1.1rem;
  }
  .answers span {
    flex: 1;
    min-width: 0;
  }
  .article-answers {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .article-answers label {
    padding-inline: 0.5rem;
    gap: 0.4rem;
  }
  .answer-input {
    width: 100%;
    min-height: 3.4rem;
    border: 1px solid var(--color-ink-600);
    border-radius: 10px;
    background: white;
    padding: 0.7rem;
    font-size: 1.15rem;
    scroll-margin-block: 1rem 6rem;
  }
  .answer-input::placeholder {
    font-size: 1rem;
    color: var(--color-ink-600);
  }
  .german-characters {
    margin-top: 0.65rem;
  }
  .tactics {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
    align-items: center;
  }
  .tactics button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 0.35rem;
    min-height: 44px;
    background: transparent;
    border: 1px solid var(--color-line);
    border-radius: 8px;
    padding: 0.5rem 0.7rem;
    color: var(--color-ink-800);
    font-size: 0.8rem;
    transition: transform 140ms var(--ease-out-emil);
  }
  .tactics button:active:not(:disabled) {
    transform: scale(0.97);
  }
  .tactics button:disabled {
    color: var(--color-ink-600);
    cursor: default;
  }
  .tactics button.boosted {
    border-color: var(--color-cobalt-700);
    background: var(--color-cobalt-50);
    color: var(--color-cobalt-700);
  }
  .tactics span {
    font-size: 0.8rem;
    color: var(--color-ink-600);
  }
  .bonus-note {
    font-size: 0.76rem;
    margin-top: 0.7rem;
  }
  .bot-stake {
    font-size: 0.78rem;
    color: var(--color-cobalt-700);
    margin-top: 0.4rem;
  }
  .confirm {
    display: flex;
    justify-content: center;
    gap: 0.6rem;
    width: 100%;
  }
  .round-footer {
    margin-top: 1rem;
    padding-block: 0.75rem 0.25rem;
    background: var(--color-paper-50);
  }
  .swap-confirmation p {
    font-size: 0.85rem;
    line-height: 1.5;
    margin-bottom: 0.75rem;
  }
  .swap-confirmation > div {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
  }
  .swap-confirmation button {
    padding-inline: 0.65rem;
    font-size: 0.85rem;
  }
  .feedback {
    margin-top: 1.1rem;
    border-top: 1px solid var(--color-line);
    padding-top: 1rem;
    font-size: 0.9rem;
    line-height: 1.55;
    scroll-margin-block: 1rem 6rem;
  }
  .feedback-summary > strong {
    color: var(--color-coral-800);
  }
  .feedback.correct .feedback-summary > strong {
    color: var(--color-mint-800);
  }
  .correct-answer {
    font-size: 1.35rem;
    font-weight: 750;
    margin: 0.5rem 0;
    overflow-wrap: anywhere;
  }
  .round-result {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding-block: 0.8rem;
  }
  .round-result b {
    color: var(--color-ink-950);
  }
  .explanation {
    margin-top: 0.5rem;
    color: var(--color-ink-700);
    overflow-wrap: anywhere;
  }
  .explanation summary {
    min-height: 44px;
    align-content: center;
    cursor: pointer;
    font-size: 0.83rem;
  }
  .explanation p {
    padding-top: 0.2rem;
  }
  @media (hover: hover) and (pointer: fine) {
    .tactics button:hover:not(:disabled),
    .answers label:hover {
      border-color: var(--color-ink-600);
    }
  }
  @media (max-width: 480px) {
    .round-panel {
      padding: 1.1rem;
    }
    h2 {
      font-size: 1.5rem;
      margin-top: 1.1rem;
    }
  }
  @media (max-width: 760px) {
    .round-footer {
      position: sticky;
      bottom: 0;
      z-index: 2;
      padding-bottom: max(0.75rem, var(--safe-bottom));
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tactics button {
      transition: none;
    }
  }
</style>
