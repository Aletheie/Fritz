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

<section class="rounded-[14px] border border-line bg-paper-50 p-[1.8rem] max-[481px]:p-[1.2rem]">
  <p class="mb-2 text-[0.8rem] text-ink-600">
    {copy('Pět kol. Hotovo.', 'Five rounds. Complete.')}
  </p>
  <h2
    class="text-[1.9rem] leading-[1.2] tracking-[-0.03em] text-balance [overflow-wrap:anywhere] focus:outline-none max-[481px]:text-[1.65rem]"
    tabindex="-1"
    bind:this={summaryHeading}
  >
    {score.user > score.bot
      ? copy('Tenhle souboj je tvůj.', 'This match is yours.')
      : score.user < score.bot
        ? copy(`${name} má dnes navrch.`, `${name} takes this match.`)
        : copy('Tentokrát nerozhodně.', 'A draw this time.')}
  </h2>
  <p class="flex items-center justify-between gap-4 pt-5 pb-2">
    <span>{copy('Ty', 'You')}</span><strong class="text-[2.6rem] tracking-[-0.025em] tabular-nums"
      >{score.user} : {score.bot}</strong
    ><span>{name}</span>
  </p>
  <p class="text-center text-[0.83rem] leading-normal text-ink-700">
    {copy(`Správně ${correct} z 5 otázek.`, `${correct} of 5 questions correct.`)}
  </p>
  <div class="mt-5 grid gap-3">
    <a class="btn-base btn-primary gap-2 no-underline" href="/"
      >{copy('Hotovo, zpět domů', 'Done, back home')}<ArrowRight size={18} aria-hidden="true" /></a
    >
    <button class="btn-base btn-secondary" onclick={onrematch} disabled={busy}
      >{busy
        ? copy('Připravuji odvetu…', 'Preparing rematch…')
        : copy('Chci odvetu', 'Rematch')}</button
    >
  </div>
  <RivalStrategyPicker bind:strategy {language} />
  <details class="border-t border-line pt-1 text-[0.85rem]">
    <summary class="min-h-11 cursor-pointer content-center text-ink-700"
      >{correct === 5
        ? copy('Prohlédnout všech 5 odpovědí', 'Review all 5 answers')
        : copy(
            `Projít otázky k procvičení (${5 - correct})`,
            `Review questions to practise (${5 - correct})`,
          )}</summary
    >
    {#if correct > 0 && correct < 5}
      <label class="flex min-h-11 items-center gap-2 py-2 text-[0.8rem]"
        ><input class="size-4 accent-cobalt-700" type="checkbox" bind:checked={showCorrect} />{copy(
          'Ukázat i správné odpovědi',
          'Include correct answers',
        )}</label
      >
    {/if}
    <ol class="m-0 list-none p-0" data-testid="round-review">
      {#each review as { round, index }}
        <li
          class="flex items-baseline gap-3 border-t border-line py-[0.8rem] text-[0.82rem] [overflow-wrap:anywhere]"
        >
          <span class="text-ink-600 tabular-nums"
            ><span class="sr-only">{copy('Kolo', 'Round')} </span>{index + 1}</span
          >
          <div class="min-w-0 flex-1">
            <strong class="block" lang={round.question.promptLanguage === 'de' ? 'de' : language}
              >{round.question.prompt[language]}</strong
            ><span
              class="mt-[0.3rem] block text-[1rem] font-[650] text-ink-950"
              data-testid="review-answer"
              lang="de">{round.question.answer}</span
            >
            <p class="mt-[0.4rem] leading-normal text-ink-700">
              {round.question.explanation[language]}
            </p>
          </div>
          <span
            role="img"
            class={round.result?.correct ? 'text-mint-800' : undefined}
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
