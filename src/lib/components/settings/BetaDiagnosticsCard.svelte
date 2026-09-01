<script lang="ts">
  import { DB_VERSION } from '$lib/data/db.ts';
  import { createBetaDiagnostics } from '$lib/domain/beta-diagnostics.ts';
  import { localized } from '$lib/i18n';
  import { appStore, motherTongue } from '$lib/state/app';
  import Check from '@lucide/svelte/icons/check';
  import FileDown from '@lucide/svelte/icons/file-down';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';

  let message = $state('');
  let failed = $state(false);

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function downloadDiagnostics(): void {
    const settings = $appStore.settings;
    if (!settings) {
      failed = true;
      message = copy('Data ještě nejsou připravená.', 'The data is not ready yet.');
      return;
    }

    const report = createBetaDiagnostics({
      appVersion: FRITZ_APP_VERSION,
      databaseVersion: DB_VERSION,
      counts: {
        decks: $appStore.decks.length,
        notes: $appStore.notes.length,
        cards: $appStore.cards.length,
      },
      settings,
      reviewStats: $appStore.reviewStats,
      recentReviews: $appStore.recentReviews,
      learningEvidence: $appStore.learningEvidence,
      dailySessions: $appStore.dailySessions,
      course: $appStore.course,
      notes: $appStore.notes,
    });
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `fritz-beta-report-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    failed = false;
    message = copy('Beta report je stažený.', 'The beta report has been downloaded.');
  }
</script>

<section class="beta-diagnostics surface" aria-labelledby="beta-diagnostics-title">
  <div class="heading">
    <ShieldCheck size={21} aria-hidden="true" />
    <div>
      <h2 id="beta-diagnostics-title">{copy('Beta diagnostika', 'Beta diagnostics')}</h2>
      <p>Fritz {FRITZ_APP_VERSION} · DB {DB_VERSION}</p>
    </div>
  </div>
  <p class="description">
    {copy(
      'Stáhne souhrn dokončení, návratů, typů úloh a nahlášených problémů. Soubor vznikne jen po klepnutí a nikam se sám neodesílá.',
      'Downloads a summary of completion, returns, activity types, and reported issues. The file is created only when you click and is never uploaded automatically.',
    )}
  </p>
  <details>
    <summary>{copy('Co v reportu není', 'What the report excludes')}</summary>
    <p>
      {copy(
        'Jméno, napsané odpovědi, vlastní slovíčka, poznámky, AI prompty, cookies, klíče ani identifikátor zařízení.',
        'Your name, written answers, custom vocabulary, notes, AI prompts, cookies, keys, and device identifiers.',
      )}
    </p>
  </details>
  <button class="btn-base btn-secondary" type="button" onclick={downloadDiagnostics}>
    <FileDown size={18} aria-hidden="true" />
    {copy('Stáhnout soukromý beta report', 'Download private beta report')}
  </button>
  {#if message}
    <p class:error={failed} class="status" role="status">
      {#if !failed}<Check size={16} aria-hidden="true" />{/if}{message}
    </p>
  {/if}
</section>

<style>
  .beta-diagnostics {
    align-self: start;
    padding: 1.2rem;
  }
  .heading {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }
  .heading > :global(svg) {
    flex: none;
    color: var(--color-cobalt-700);
  }
  h2 {
    font-size: 1rem;
    font-weight: 850;
  }
  .heading p {
    margin-top: 0.12rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.68rem;
  }
  .description,
  details p {
    color: var(--color-ink-600);
    font-size: 0.875rem;
    line-height: 1.5;
  }
  .description {
    margin-top: 0.9rem;
  }
  details {
    margin-top: 0.75rem;
    border-top: 1px solid var(--color-line);
    padding-top: 0.7rem;
  }
  summary {
    min-height: 2.75rem;
    color: var(--color-cobalt-700);
    font-size: 0.8rem;
    font-weight: 800;
  }
  details p {
    padding-bottom: 0.7rem;
  }
  button {
    width: 100%;
    margin-top: 0.85rem;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.7rem;
    color: var(--color-mint-700);
    font-size: 0.8rem;
    font-weight: 750;
  }
  .status.error {
    color: var(--color-coral-700);
  }
</style>
