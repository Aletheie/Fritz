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

  const paragraph = 'mx-0 my-2 max-w-[65ch] leading-[1.65]';
  const hint = 'mx-0 my-2 max-w-[65ch] leading-[1.65] text-[0.86rem] text-ink-800';
  const heading = 'mt-[1.4rem] mb-[0.6rem] scroll-mt-20 text-[1.1rem] leading-[1.4]';
  const choice =
    'min-h-11 cursor-pointer rounded-[0.6rem] border px-4 py-[0.8rem] text-left leading-normal disabled:cursor-default fine-hover:not-disabled:bg-paper-200';
</script>

<div>
  <h2 class="mt-2 mb-4 text-[1.5rem] leading-[1.25]">{localized($motherTongue, gap.title)}</h2>
  <p class={paragraph}>{localized($motherTongue, gap.goal)}</p>
  <div class="my-4 border-y border-line py-4">
    <strong class="text-[0.86rem] text-ink-800">{copy('Co už víš', 'What you already know')}</strong
    >
    <p class={paragraph} lang="de">{gap.known}</p>
  </div>
  <h3 class={heading}>{copy('Na co se zeptáš?', 'What will you ask?')}</h3>
  <p class={hint}>
    {copy(
      'Vyber otázky, které ti pomohou rozhodnout. Odpovědi zůstanou po ruce.',
      'Choose questions that help you decide. The replies will remain available.',
    )}
  </p>
  <div class="flex flex-col gap-[0.6rem]">
    {#each gap.queries as query}
      <button
        class={[
          choice,
          'bg-paper-50',
          asked.includes(query.id)
            ? 'border-cobalt-700 text-cobalt-700'
            : 'border-line-strong text-ink-950',
        ]}
        type="button"
        lang="de"
        aria-pressed={asked.includes(query.id)}
        disabled={Boolean(feedback) || saving}
        onclick={() => void ask(query.id)}
      >
        {query.question}
        {#if asked.includes(query.id)}<span class="ml-2" aria-hidden="true">✓</span>{/if}
      </button>
    {/each}
  </div>
  <div role="log" aria-label={copy('Průběh rozhovoru', 'Conversation')}>
    {#each exchanges as exchange (exchange.id)}
      <div class="border-b border-line py-[0.8rem]">
        <p class="{paragraph} text-[0.88rem] text-ink-800" lang="de">
          <span lang={$motherTongue}>{copy('Ty', 'You')}:</span>
          {exchange.question}
        </p>
        <p class={paragraph} lang="de"><strong>{gap.partner}:</strong> {exchange.reply}</p>
      </div>
    {/each}
  </div>
  {#if ready}
    <h3 class={heading} tabindex="-1" bind:this={decisionHeading} lang="de">{gap.decision}</h3>
    <div class="flex flex-col gap-[0.6rem]">
      {#each options as option}
        <button
          type="button"
          lang="de"
          disabled={Boolean(feedback) || saving}
          class={[
            choice,
            'text-ink-950',
            Boolean(feedback) && option === gap.answer
              ? 'border-mint-700 bg-mint-50'
              : feedback === 'wrong' && selected === option
                ? 'border-coral-700 bg-paper-50'
                : 'border-line-strong bg-paper-50',
          ]}
          onclick={() => {
            if (!ready) return;
            selected = option;
            onanswer(option);
          }}>{option}</button
        >
      {/each}
    </div>
  {:else}
    <p class={hint} role="status">
      {copy(
        'Nejdřív zjisti údaje potřebné k rozhodnutí.',
        'First find the information you need to make the decision.',
      )}
    </p>
  {/if}
</div>
