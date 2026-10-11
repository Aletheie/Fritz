<script lang="ts">
  import { requestWeeklySummary } from '$lib/client/ai.ts';
  import { errorText } from '$lib/domain/errors.ts';
  import { buildWeeklyLearningReport } from '$lib/domain/learning/mistakes.ts';
  import { localized } from '$lib/i18n';
  import { mistakeLabel } from '$lib/i18n/mistakes.ts';
  import { motherTongue } from '$lib/state/app';
  import BarChart3 from '@lucide/svelte/icons/chart-no-axes-column-increasing';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Sparkles from '@lucide/svelte/icons/sparkles';

  import type { AiWeeklySummaryResult } from '$lib/domain/ai/types.ts';
  import type { MistakeTag, ReviewLog } from '$lib/domain/types.ts';

  let { reviews, now }: { reviews: ReviewLog[]; now: Date } = $props();
  const report = $derived(buildWeeklyLearningReport(reviews, now));

  let summary = $state<AiWeeklySummaryResult>();
  let summaryLoading = $state(false);
  let summaryError = $state('');

  async function summarize(): Promise<void> {
    if (summaryLoading) return;
    summaryLoading = true;
    summaryError = '';
    try {
      summary = await requestWeeklySummary({
        motherTongue: $motherTongue,
        totalReviews: report.totalReviews,
        longTermReviews: report.longTermReviews,
        cramReviews: report.cramReviews,
        activeDays: report.activeDays,
        mistakes: report.topMistakes.slice(0, 5).map(({ tag, count }) => ({ tag, count })),
      });
    } catch (value) {
      summaryError = errorText(value, $motherTongue, {
        cs: 'Shrnutí se nepodařilo připravit.',
        en: 'The summary could not be prepared.',
      });
    } finally {
      summaryLoading = false;
    }
  }

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function recommendation(tag: MistakeTag | undefined, fallback: string): string {
    if ($motherTongue === 'cs') return fallback;
    if (!tag) return 'Keep following your review plan.';
    return `Use a short contextual exercise focused on ${mistakeLabel(tag, 'en')}.`;
  }

  const muted = 'mt-[0.45rem] text-[0.875rem] leading-normal text-ink-700';
  const row = 'rounded-[0.65rem] bg-white/78 px-[0.7rem] py-[0.6rem] text-[0.82rem] leading-[1.4]';
</script>

<section
  class="rounded-[1.25rem_1.25rem_0.7rem_1.25rem] border border-cobalt-700/25 bg-[color-mix(in_srgb,var(--color-sky-50)_70%,var(--color-paper-50))] p-[clamp(1.1rem,3vw,1.75rem)]"
  aria-labelledby="weekly-report-title"
>
  <header class="flex gap-[0.85rem]">
    <span
      class="grid size-[2.8rem] flex-[0_0_2.8rem] place-items-center rounded-[0.8rem] bg-cobalt-700 text-white"
      ><BarChart3 size={22} /></span
    >
    <div>
      <p
        class="m-0 font-mono text-[0.75rem] leading-[1.3] font-[760] tracking-[0.05em] text-cobalt-700 uppercase"
      >
        {copy('Učení za posledních 7 dní', 'Learning over the last 7 days')}
      </p>
      <h2 class="mt-[0.2rem] text-[clamp(1.15rem,2vw,1.45rem)]" id="weekly-report-title">
        {copy('Co si ještě procvičit', 'What to practise next')}
      </h2>
      <p class={muted}>
        {copy(
          'Tady najdeš doporučené typy úloh. Termíny opakování zůstávají v běžném plánu.',
          'Here are suggested activity types. Your regular review schedule stays the same.',
        )}
      </p>
    </div>
  </header>

  <div
    class="mt-4 grid grid-cols-3 gap-[0.55rem] max-[38rem]:grid-cols-1 [&_article]:rounded-xl [&_article]:bg-white/76 [&_article]:p-3 [&_span]:mt-[0.15rem] [&_span]:block [&_span]:text-[0.75rem] [&_span]:text-ink-700 [&_strong]:block [&_strong]:text-[1.35rem]"
  >
    <article>
      <strong>{report.longTermReviews}</strong><span
        >{copy('běžných opakování', 'long-term reviews')}</span
      >
    </article>
    <article>
      <strong>{report.cramReviews}</strong><span
        >{copy('odpovědí ve sprintu', 'sprint answers')}</span
      >
    </article>
    <article>
      <strong>{report.activeDays}</strong><span>{copy('aktivních dní', 'active days')}</span>
    </article>
  </div>

  <div class="mt-4 grid grid-cols-2 gap-4 max-[38rem]:grid-cols-1">
    <div>
      <h3 class="mt-0 mb-[0.55rem] text-[0.9rem]">
        {copy('Nejčastější chyby', 'Most frequent mistakes')}
      </h3>
      {#if report.topMistakes.length}
        <ol class="m-0 grid list-none gap-[0.45rem] p-0">
          {#each report.topMistakes.slice(0, 3) as cluster}
            <li class="{row} flex justify-between gap-2">
              <span>{mistakeLabel(cluster.tag, $motherTongue)}</span><strong
                >{cluster.count}×</strong
              >
            </li>
          {/each}
        </ol>
      {:else}
        <p class={muted}>
          {copy(
            'Zatím není co doporučit. Pokračuj podle svého plánu.',
            'No suggestions yet. Keep following your plan.',
          )}
        </p>
      {/if}
    </div>
    <div>
      <h3 class="mt-0 mb-[0.55rem] text-[0.9rem]">
        {copy('Doporučená cvičení', 'Suggested exercises')}
      </h3>
      <ul class="m-0 grid list-none gap-[0.45rem] p-0">
        {#each report.recommendations as item, index}
          <li class={row}>{recommendation(report.topMistakes[index]?.tag, item)}</li>
        {/each}
      </ul>
    </div>
  </div>

  {#if summary}
    <article
      class="mt-4 grid gap-2 rounded-xl border border-cobalt-700/30 bg-white/86 p-4"
      data-testid="weekly-summary"
      aria-live="polite"
    >
      <p
        class="flex items-center gap-[0.4rem] font-mono text-[0.7rem] font-[760] tracking-[0.05em] text-cobalt-700 uppercase"
      >
        <Sparkles size={15} />
        {copy('Shrnutí týdne', 'Weekly summary')}
      </p>
      <h3 class="text-[1.05rem] leading-[1.3]">{summary.headline}</h3>
      <ul class="m-0 grid list-disc gap-1 pl-5 text-[0.82rem] leading-[1.45] text-ink-800">
        {#each summary.wins as win}<li>{win}</li>{/each}
      </ul>
      <p class="text-[0.85rem] leading-normal">
        <strong>{copy('Zaměř se:', 'Focus:')}</strong>
        {summary.focus}
      </p>
      <ol class="m-0 grid list-decimal gap-1 pl-5 text-[0.82rem] leading-[1.45] text-ink-800">
        {#each summary.nextSteps as step}<li>{step}</li>{/each}
      </ol>
    </article>
  {:else if report.totalReviews > 0}
    <button
      class="btn-base btn-secondary mt-4"
      type="button"
      disabled={summaryLoading}
      onclick={() => void summarize()}
    >
      {#if summaryLoading}<LoaderCircle class="animate-spin" size={17} />{:else}<Sparkles
          size={17}
        />{/if}
      {copy('Shrnout týden s AI', 'Summarise my week with AI')}
    </button>
    <p class="mt-2 text-[0.72rem] text-ink-600">
      {copy(
        'Odesílají se jen souhrnná čísla a typy chyb, žádná slovíčka ani odpovědi.',
        'Only totals and mistake types are sent, never your words or answers.',
      )}
    </p>
    {#if summaryError}<p class="mt-2 text-[0.75rem] font-bold text-coral-700" role="alert">
        {summaryError}
      </p>{/if}
  {/if}
</section>
