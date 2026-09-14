<script lang="ts">
  import {
    informationGapReady,
    type CourseInformationGap as Gap,
  } from '$lib/domain/course/course-information-gaps.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import { tick } from 'svelte';

  let {
    gap,
    options,
    feedback,
    saving,
    onanswer,
  }: {
    gap: Gap;
    options: string[];
    feedback?: 'correct' | 'wrong';
    saving: boolean;
    onanswer: (answer: string) => void;
  } = $props();
  let asked = $state<string[]>([]);
  let selected = $state('');
  let decisionHeading = $state<HTMLHeadingElement>();
  const ready = $derived(informationGapReady(gap, asked));
  const exchanges = $derived(asked.flatMap((id) => gap.queries.filter((query) => query.id === id)));

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  async function ask(id: string): Promise<void> {
    if (feedback || saving || asked.includes(id)) return;
    const wasReady = ready;
    asked = [...asked, id];
    await tick();
    if (!wasReady && ready) decisionHeading?.focus();
  }
</script>

<div class="information-gap">
  <h2>{localized($motherTongue, gap.title)}</h2>
  <p>{localized($motherTongue, gap.goal)}</p>
  <div class="known">
    <strong>{copy('Co už víš', 'What you already know')}</strong>
    <p lang="de">{gap.known}</p>
  </div>
  <h3>{copy('Na co se zeptáš?', 'What will you ask?')}</h3>
  <p class="hint">
    {copy(
      'Vyber otázky, které ti pomohou rozhodnout. Odpovědi zůstanou po ruce.',
      'Choose questions that help you decide. The replies will remain available.',
    )}
  </p>
  <div class="queries">
    {#each gap.queries as query}
      <button
        type="button"
        lang="de"
        aria-pressed={asked.includes(query.id)}
        disabled={Boolean(feedback) || saving}
        onclick={() => void ask(query.id)}
      >
        {query.question}
        {#if asked.includes(query.id)}<span aria-hidden="true">✓</span>{/if}
      </button>
    {/each}
  </div>
  <div role="log" aria-label={copy('Průběh rozhovoru', 'Conversation')} class="conversation">
    {#each exchanges as exchange (exchange.id)}
      <div class="exchange">
        <p lang="de"><span lang={$motherTongue}>{copy('Ty', 'You')}:</span> {exchange.question}</p>
        <p lang="de"><strong>{gap.partner}:</strong> {exchange.reply}</p>
      </div>
    {/each}
  </div>
  {#if ready}
    <h3 tabindex="-1" bind:this={decisionHeading} lang="de">{gap.decision}</h3>
    <div class="decisions">
      {#each options as option}
        <button
          type="button"
          lang="de"
          disabled={Boolean(feedback) || saving}
          class:correct={Boolean(feedback) && option === gap.answer}
          class:wrong={feedback === 'wrong' && selected === option}
          onclick={() => {
            if (!ready) return;
            selected = option;
            onanswer(option);
          }}>{option}</button
        >
      {/each}
    </div>
  {:else}
    <p class="hint" role="status">
      {copy(
        'Nejdřív zjisti údaje potřebné k rozhodnutí.',
        'First find the information you need to make the decision.',
      )}
    </p>
  {/if}
</div>

<style>
  h2 {
    margin: 0.5rem 0 1rem;
    font-size: 1.5rem;
    line-height: 1.25;
  }
  h3 {
    margin: 1.4rem 0 0.6rem;
    font-size: 1.1rem;
    line-height: 1.4;
    scroll-margin-top: 5rem;
  }
  p {
    max-width: 65ch;
    line-height: 1.65;
    margin: 0.5rem 0;
  }
  .known {
    padding-block: 1rem;
    margin-block: 1rem;
    border-block: 1px solid var(--color-line);
  }
  .known > strong,
  .hint {
    font-size: 0.86rem;
    color: var(--color-ink-800);
  }
  .queries,
  .decisions {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  button {
    min-height: 44px;
    padding: 0.8rem 1rem;
    text-align: left;
    border: 1px solid var(--color-line-strong);
    border-radius: 0.6rem;
    color: var(--color-ink-950);
    background: var(--color-paper-50);
    font: inherit;
    line-height: 1.5;
    cursor: pointer;
  }
  button[aria-pressed='true'] {
    border-color: var(--color-cobalt-700);
    color: var(--color-cobalt-700);
  }
  button > span {
    margin-left: 0.5rem;
  }
  button:disabled {
    cursor: default;
  }
  .exchange {
    padding-block: 0.8rem;
    border-bottom: 1px solid var(--color-line);
  }
  .exchange p:first-child {
    font-size: 0.88rem;
    color: var(--color-ink-800);
  }
  .correct {
    border-color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .wrong {
    border-color: var(--color-coral-700);
  }
  @media (hover: hover) and (pointer: fine) {
    button:hover:not(:disabled) {
      background: var(--color-paper-200);
    }
  }
</style>
