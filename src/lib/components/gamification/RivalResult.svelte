<script lang="ts">
  import { rivalScore } from '$lib/domain/rival/engine.ts';
  import type { RivalMatch, RivalStrategy } from '$lib/domain/rival/types.ts';
  import type { MotherTongue } from '$lib/domain/types.ts';
  import { rivalNames } from '$lib/i18n/rival.ts';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import Minus from '@lucide/svelte/icons/minus';
  import { onMount } from 'svelte';
  import RivalStrategyPicker from './RivalStrategyPicker.svelte';

  type Props = {
    match: RivalMatch;
    language: MotherTongue;
    busy: boolean;
    strategy: RivalStrategy;
    onrematch: () => void;
  };
  let { match, language, busy, strategy = $bindable('balanced'), onrematch }: Props = $props();
  let summaryHeading: HTMLHeadingElement;
  let showCorrect = $state(false);
  const score = $derived(rivalScore(match));
  const correct = $derived(match.rounds.filter((round) => round.result?.correct).length);
  const review = $derived(
    match.rounds
      .map((round, index) => ({ round, index }))
      .filter(({ round }) => showCorrect || correct === 5 || !round.result?.correct),
  );
  const name = $derived(rivalNames[match.rivalId]);
  const copy = (cs: string, en: string) => (language === 'cs' ? cs : en);
  onMount(() => {
    summaryHeading?.focus({ preventScroll: true });
    summaryHeading?.scrollIntoView({ block: 'nearest' });
  });
</script>

<section class="result-panel">
  <p class="result-label">{copy('Pět kol. Hotovo.', 'Five rounds. Complete.')}</p>
  <h2 tabindex="-1" bind:this={summaryHeading}>
    {score.user > score.bot
      ? copy('Tenhle souboj je tvůj.', 'This match is yours.')
      : score.user < score.bot
        ? copy(`${name} má dnes navrch.`, `${name} takes this match.`)
        : copy('Tentokrát nerozhodně.', 'A draw this time.')}
  </h2>
  <p class="final-score">
    <span>{copy('Ty', 'You')}</span><strong>{score.user} : {score.bot}</strong><span>{name}</span>
  </p>
  <p class="answer-count">
    {copy(`Správně ${correct} z 5 otázek.`, `${correct} of 5 questions correct.`)}
  </p>
  <div class="result-actions">
    <a class="btn-base btn-primary" href="/"
      >{copy('Hotovo, zpět domů', 'Done, back home')}<ArrowRight size={18} aria-hidden="true" /></a
    >
    <button class="btn-base btn-secondary" onclick={onrematch} disabled={busy}
      >{busy
        ? copy('Připravuji odvetu…', 'Preparing rematch…')
        : copy('Chci odvetu', 'Rematch')}</button
    >
  </div>
  <RivalStrategyPicker bind:strategy {language} />
  <details class="review-details">
    <summary
      >{correct === 5
        ? copy('Prohlédnout všech 5 odpovědí', 'Review all 5 answers')
        : copy(
            `Projít otázky k procvičení (${5 - correct})`,
            `Review questions to practise (${5 - correct})`,
          )}</summary
    >
    {#if correct > 0 && correct < 5}
      <label class="review-filter"
        ><input type="checkbox" bind:checked={showCorrect} />{copy(
          'Ukázat i správné odpovědi',
          'Include correct answers',
        )}</label
      >
    {/if}
    <ol class="round-review">
      {#each review as { round, index }}
        <li>
          <span class="round-number"
            ><span class="sr-only">{copy('Kolo', 'Round')} </span>{index + 1}</span
          >
          <div>
            <strong lang={round.question.promptLanguage === 'de' ? 'de' : language}
              >{round.question.prompt[language]}</strong
            ><span class="review-answer" lang="de">{round.question.answer}</span>
            <p>{round.question.explanation[language]}</p>
          </div>
          <span
            role="img"
            class:won={round.result?.correct}
            aria-label={round.result?.correct
              ? copy('Tvoje odpověď správně', 'Your answer was correct')
              : copy('Tvoje odpověď chybně', 'Your answer was incorrect')}
            >{#if round.result?.correct}<Check size={18} aria-hidden="true" />{:else}<Minus
                size={18}
                aria-hidden="true"
              />{/if}</span
          >
        </li>
      {/each}
    </ol>
  </details>
</section>

<style>
  .result-panel {
    border: 1px solid var(--color-line);
    background: var(--color-paper-50);
    border-radius: 14px;
    padding: 1.8rem;
  }
  .result-label {
    font-size: 0.8rem;
    color: var(--color-ink-600);
    margin-bottom: 0.5rem;
  }
  h2 {
    font-size: 1.9rem;
    letter-spacing: -0.03em;
    line-height: 1.2;
    text-wrap: balance;
    overflow-wrap: anywhere;
  }
  h2:focus {
    outline: none;
  }
  .result-actions {
    display: grid;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }
  .result-actions a {
    text-decoration: none;
    gap: 0.5rem;
  }
  .final-score {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 0 0.5rem;
  }
  .final-score strong {
    font-size: 2.6rem;
    letter-spacing: -0.025em;
    font-variant-numeric: tabular-nums;
  }
  .round-review {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .round-review li {
    display: flex;
    gap: 0.75rem;
    align-items: baseline;
    border-top: 1px solid var(--color-line);
    padding: 0.8rem 0;
    font-size: 0.82rem;
    overflow-wrap: anywhere;
  }
  .round-number {
    color: var(--color-ink-600);
    font-variant-numeric: tabular-nums;
  }
  .round-review li > div {
    flex: 1;
    min-width: 0;
  }
  .round-review strong,
  .review-answer {
    display: block;
  }
  .review-answer {
    margin-top: 0.3rem;
    color: var(--color-ink-950);
    font-size: 1rem;
    font-weight: 650;
  }
  .round-review p {
    margin-top: 0.4rem;
    color: var(--color-ink-700);
    line-height: 1.5;
  }
  .round-review .won {
    color: var(--color-mint-800);
  }
  .answer-count {
    font-size: 0.83rem;
    line-height: 1.5;
    color: var(--color-ink-700);
    text-align: center;
  }
  .review-details {
    border-top: 1px solid var(--color-line);
    padding-top: 0.25rem;
    font-size: 0.85rem;
  }
  summary {
    min-height: 44px;
    align-content: center;
    cursor: pointer;
    color: var(--color-ink-700);
  }
  .review-filter {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    min-height: 44px;
    padding-block: 0.5rem;
    font-size: 0.8rem;
  }
  .review-filter input {
    accent-color: var(--color-cobalt-700);
    width: 1rem;
    height: 1rem;
  }

  @media (max-width: 480px) {
    .result-panel {
      padding: 1.2rem;
    }
    h2 {
      font-size: 1.65rem;
    }
  }
</style>
