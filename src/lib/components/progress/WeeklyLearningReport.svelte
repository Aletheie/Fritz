<script lang="ts">
  import { buildWeeklyLearningReport } from '$lib/domain/learning/mistakes.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import BarChart3 from '@lucide/svelte/icons/chart-no-axes-column-increasing';

  import type { MistakeTag, ReviewLog } from '$lib/domain/types.ts';

  let { reviews, now }: { reviews: ReviewLog[]; now: Date } = $props();
  const report = $derived(buildWeeklyLearningReport(reviews, now));

  const labels: Record<MistakeTag, { cs: string; en: string }> = {
    article: { cs: 'člen', en: 'article' },
    gender: { cs: 'rod', en: 'gender' },
    plural: { cs: 'množné číslo', en: 'plural' },
    'verb-form': { cs: 'tvar slovesa', en: 'verb form' },
    auxiliary: { cs: 'pomocné sloveso', en: 'auxiliary verb' },
    'separable-prefix': { cs: 'odlučitelná předpona', en: 'separable prefix' },
    'word-order': { cs: 'slovosled', en: 'word order' },
    case: { cs: 'pád', en: 'case' },
    preposition: { cs: 'předložka', en: 'preposition' },
    negation: { cs: 'negace', en: 'negation' },
    spelling: { cs: 'pravopis', en: 'spelling' },
    meaning: { cs: 'význam', en: 'meaning' },
    register: { cs: 'registr', en: 'register' },
    fluency: { cs: 'plynulost vybavení', en: 'recall fluency' },
    unknown: { cs: 'diagnostika', en: 'diagnostics' },
  };

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function recommendation(tag: MistakeTag | undefined, fallback: string): string {
    if ($motherTongue === 'cs') return fallback;
    if (!tag) return 'Continue with the due queue; no extra workload is needed.';
    return `Use a short contextual exercise focused on ${labels[tag].en}.`;
  }
</script>

<section class="weekly-report" aria-labelledby="weekly-report-title">
  <header>
    <span><BarChart3 size={22} /></span>
    <div>
      <p class="kicker">{copy('Paměť za posledních 7 dní', 'Memory over the last 7 days')}</p>
      <h2 id="weekly-report-title">
        {copy(
          'Co procvičit — bez druhého scheduleru',
          'What to practise — without another scheduler',
        )}
      </h2>
      <p>
        {copy(
          'FSRS dál určuje kdy. Tento přehled jen navrhuje, jaký typ úlohy může pomoci.',
          'FSRS still decides when. This report only suggests which exercise type may help.',
        )}
      </p>
    </div>
  </header>

  <div class="summary">
    <article>
      <strong>{report.longTermReviews}</strong><span
        >{copy('dlouhodobých review', 'long-term reviews')}</span
      >
    </article>
    <article>
      <strong>{report.cramReviews}</strong><span
        >{copy('cram pokusů odděleně', 'separate cram attempts')}</span
      >
    </article>
    <article>
      <strong>{report.activeDays}</strong><span>{copy('aktivních dní', 'active days')}</span>
    </article>
  </div>

  <div class="report-grid">
    <div>
      <h3>{copy('Nejčastější signály', 'Most frequent signals')}</h3>
      {#if report.topMistakes.length}
        <ol>
          {#each report.topMistakes.slice(0, 3) as cluster}
            <li>
              <span>{localized($motherTongue, labels[cluster.tag])}</span><strong
                >{cluster.count}×</strong
              >
            </li>
          {/each}
        </ol>
      {:else}
        <p class="empty">
          {copy(
            'Zatím není dost chybových signálů. Není potřeba přidávat zátěž.',
            'There are not enough mistake signals yet. No extra workload is needed.',
          )}
        </p>
      {/if}
    </div>
    <div>
      <h3>{copy('Doporučené formy', 'Recommended formats')}</h3>
      <ul>
        {#each report.recommendations as item, index}
          <li>{recommendation(report.topMistakes[index]?.tag, item)}</li>
        {/each}
      </ul>
    </div>
  </div>
</section>

<style>
  .weekly-report {
    padding: clamp(1.1rem, 3vw, 1.75rem);
    border: 1px solid color-mix(in srgb, var(--color-cobalt-700) 25%, transparent);
    border-radius: 1.25rem 1.25rem 0.7rem 1.25rem;
    background: color-mix(in srgb, var(--color-sky-50) 70%, var(--color-paper-50));
  }
  header {
    display: flex;
    gap: 0.85rem;
  }
  header > span {
    display: grid;
    flex: 0 0 2.8rem;
    width: 2.8rem;
    height: 2.8rem;
    place-items: center;
    border-radius: 0.8rem;
    color: white;
    background: var(--color-cobalt-700);
  }
  .kicker {
    margin: 0;
    font: 760 0.75rem/1.3 var(--font-mono);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--color-cobalt-700);
  }
  h2 {
    margin: 0.2rem 0 0;
    font-size: clamp(1.15rem, 2vw, 1.45rem);
  }
  header p:last-child,
  .empty {
    margin: 0.45rem 0 0;
    color: var(--color-ink-700);
    font-size: 0.875rem;
    line-height: 1.5;
  }
  .summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.55rem;
    margin-top: 1rem;
  }
  .summary article {
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: color-mix(in srgb, white 76%, transparent);
  }
  .summary strong,
  .summary span {
    display: block;
  }
  .summary strong {
    font-size: 1.35rem;
  }
  .summary span {
    margin-top: 0.15rem;
    color: var(--color-ink-700);
    font-size: 0.75rem;
  }
  .report-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }
  h3 {
    margin: 0 0 0.55rem;
    font-size: 0.9rem;
  }
  ol,
  ul {
    display: grid;
    gap: 0.45rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  ol li,
  ul li {
    padding: 0.6rem 0.7rem;
    border-radius: 0.65rem;
    background: color-mix(in srgb, white 78%, transparent);
    font-size: 0.82rem;
    line-height: 1.4;
  }
  ol li {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }
  @media (max-width: 38rem) {
    .summary,
    .report-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
