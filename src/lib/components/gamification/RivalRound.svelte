<script lang="ts">
  import { insertAtSelection, restoreCaret } from '$lib/client/insert-character.ts';
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
  const muted = 'text-[0.86rem] leading-normal text-ink-600';
  const footerClass =
    'mt-4 bg-paper-50 pt-3 pb-1 max-[761px]:sticky max-[761px]:bottom-0 max-[761px]:z-2 max-[761px]:pb-[max(0.75rem,var(--safe-bottom))]';
  const tactic =
    'inline-flex min-h-11 items-center justify-center gap-[0.35rem] rounded-lg border px-[0.7rem] py-2 text-[0.8rem] transition-transform duration-140 ease-out-emil active:not-disabled:[transform:scale(0.97)] disabled:cursor-default disabled:text-ink-600 fine-hover:not-disabled:border-ink-600 motion-reduce:transition-none';
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
    const next = insertAtSelection(input, answer, character);
    if (next.value.length > 1000) return;
    answer = next.value;
    await restoreCaret(input, next.caret, { preventScroll: true });
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

<section
  class="min-w-0 rounded-[14px] border border-line bg-paper-50 p-6 max-[481px]:p-[1.1rem]"
  aria-labelledby="round-question"
  aria-busy={busy}
>
  <div class="flex justify-between gap-4 text-[0.8rem] text-ink-600">
    <span>{rivalTopics[question.topic][language]}</span>
    <span>{copy(`Kolo ${match.rounds.length} z 5`, `Round ${match.rounds.length} of 5`)}</span>
  </div>
  <h2
    id="round-question"
    class="mt-[1.6rem] mb-[0.8rem] text-[1.8rem] leading-[1.2] tracking-[-0.025em] text-balance [overflow-wrap:anywhere] focus:outline-none max-[481px]:mt-[1.1rem] max-[481px]:text-[1.5rem]"
    tabindex="-1"
    bind:this={heading}
    lang={question.promptLanguage === 'de' ? 'de' : language}
  >
    {question.prompt[language]}
  </h2>

  {#if !round.result}
    <p class="{muted} mb-5" id="answer-help">
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
          class={[
            'm-0 grid min-w-0 gap-[0.55rem] border-0 p-0',
            question.topic === 'articles' && 'grid-cols-3',
          ]}
          disabled={busy || pendingSwap}
        >
          <legend class="sr-only">{copy('Tvoje odpověď', 'Your answer')}</legend>
          {#each question.options as option}
            <label
              class={[
                'flex min-h-13 cursor-pointer items-center rounded-[10px] border py-[0.7rem] [overflow-wrap:anywhere] fine-hover:border-ink-600',
                question.topic === 'articles' ? 'gap-[0.4rem] px-2' : 'gap-3 px-[0.85rem]',
                answer === option ? 'border-cobalt-700 bg-cobalt-50' : 'border-line',
              ]}
            >
              <input
                class="size-[1.1rem] flex-none accent-cobalt-700"
                type="radio"
                name="duel-answer"
                value={option}
                bind:group={answer}
              />
              <span class="min-w-0 flex-1" lang="de">{option}</span>
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
          class="min-h-[3.4rem] w-full scroll-my-[1rem_6rem] rounded-[10px] border border-ink-600 bg-white p-[0.7rem] text-[1.15rem] placeholder:text-[1rem] placeholder:text-ink-600"
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
        <div class="mt-[0.65rem]"><GermanKeyboard oninsert={insertCharacter} /></div>
      {/if}
      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class={[
            tactic,
            boosted
              ? 'border-cobalt-700 bg-cobalt-50 text-cobalt-700'
              : 'border-line bg-transparent text-ink-800',
          ]}
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
            class="{tactic} border-line bg-transparent text-ink-800"
            disabled={busy || pendingSwap}
            bind:this={swapButton}
            onclick={requestSwap}
            ><RefreshCw size={14} aria-hidden="true" />
            {copy('Vyměnit otázku', 'Swap question')}</button
          >
        {:else}<span class="text-[0.8rem] text-ink-600">{copy('Výměna využitá', 'Swap used')}</span
          >{/if}
      </div>
      <p class="mt-[0.7rem] text-[0.76rem] leading-normal text-ink-600" id="bonus-help">
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
      {#if round.botStake === 2}<p class="mt-[0.4rem] text-[0.78rem] text-cobalt-700">
          {copy(
            `${rivalNames[match.rivalId]} teď hraje s bonusem za 2 body.`,
            `${rivalNames[match.rivalId]} is using a 2-point bonus this round.`,
          )}
        </p>{/if}
      <div class={footerClass} data-testid="round-footer" bind:this={footer}>
        {#if pendingSwap}
          <div role="group" aria-labelledby="swap-warning">
            <p class="mb-3 text-[0.85rem] leading-normal" id="swap-warning">
              {copy(
                'Výměnou přijdeš o tuto odpověď. Vyměnit otázku?',
                'Swapping will clear this answer. Swap the question?',
              )}
            </p>
            <div class="grid grid-cols-2 gap-[0.6rem]">
              <button
                type="button"
                class="btn-base btn-secondary px-[0.65rem] text-[0.85rem]"
                bind:this={keepAnswerButton}
                onclick={cancelSwap}
                disabled={busy}>{copy('Nechat otázku', 'Keep question')}</button
              >
              <button
                type="button"
                class="btn-base btn-primary px-[0.65rem] text-[0.85rem]"
                onclick={onswitch}
                disabled={busy}>{copy('Vyměnit i tak', 'Swap anyway')}</button
              >
            </div>
          </div>
        {:else}
          <button
            class="btn-base btn-primary flex w-full justify-center gap-[0.6rem]"
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
    <div
      class="mt-[1.1rem] scroll-my-[1rem_6rem] border-t border-line pt-4 text-[0.9rem] leading-[1.55]"
      bind:this={feedbackPanel}
    >
      <div role="status">
        <strong class={round.result.correct ? 'text-mint-800' : 'text-coral-800'}
          >{round.result.correct
            ? copy('Přesná odpověď.', 'Correct answer.')
            : copy('Správná odpověď:', 'The correct answer:')}</strong
        >
        <p class="my-2 text-[1.35rem] font-[750] [overflow-wrap:anywhere]" lang="de">
          {question.answer}
        </p>
        <div class="flex justify-between gap-4 py-[0.8rem] [&_b]:text-ink-950">
          <span>{copy('Ty', 'You')}: <b>+{round.result.correct ? round.result.stake : 0}</b></span>
          <span>{rivalNames[match.rivalId]}: <b>+{round.botCorrect ? round.botStake : 0}</b></span>
        </div>
        <p class={muted}>
          {copy('Odpověď robota:', 'Robot answer:')}
          <span lang={round.botAnswer === '—' ? language : 'de'}
            >{round.botAnswer === '—' ? copy('Nevím.', 'I do not know.') : round.botAnswer}</span
          >
          · {round.botCorrect ? copy('správně', 'correct') : copy('bez bodu', 'no point')}
        </p>
      </div>
      <details
        class="mt-2 [overflow-wrap:anywhere] text-ink-700"
        data-testid="answer-explanation"
        open={!round.result.correct}
      >
        <summary class="min-h-11 cursor-pointer content-center text-[0.83rem]"
          >{copy('Vysvětlení odpovědi', 'Answer explained')}</summary
        >
        <p class="pt-[0.2rem]">{question.explanation[language]}</p>
      </details>
    </div>
    <div class={footerClass}>
      <button
        class="btn-base btn-primary flex w-full justify-center gap-[0.6rem]"
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
