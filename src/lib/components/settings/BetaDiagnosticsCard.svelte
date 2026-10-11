<script lang="ts">
  import { DB_VERSION, readStoredSnapshot } from '$lib/data/db.ts';
  import { createBetaDiagnostics } from '$lib/domain/beta-diagnostics.ts';
  import {
    createCourseProgress,
    normalizeCourseProgress,
  } from '$lib/domain/course/course-progress.ts';
  import { tr } from '$lib/state/app';
  import Check from '@lucide/svelte/icons/check';
  import FileDown from '@lucide/svelte/icons/file-down';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';

  let message = $state('');
  let failed = $state(false);
  let downloading = $state(false);

  async function downloadDiagnostics(): Promise<void> {
    if (downloading) return;
    downloading = true;
    try {
      const snapshot = await readStoredSnapshot({ fullHistory: true });
      const settings = snapshot.settings;
      if (!settings) {
        failed = true;
        message = $tr('Data ještě nejsou připravená.', 'The data is not ready yet.');
        return;
      }

      const report = createBetaDiagnostics({
        appVersion: FRITZ_APP_VERSION,
        databaseVersion: DB_VERSION,
        counts: {
          decks: snapshot.decks.length,
          notes: snapshot.notes.length,
          cards: snapshot.cards.length,
        },
        settings,
        reviewStats: snapshot.reviewStats,
        recentReviews: snapshot.recentReviews,
        learningEvidence: snapshot.learningEvidence,
        dailySessions: snapshot.dailySessions,
        course: normalizeCourseProgress(
          snapshot.course ?? createCourseProgress(new Date(settings.createdAt)),
        ),
        notes: snapshot.notes,
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
      message = $tr('Beta report je stažený.', 'The beta report has been downloaded.');
    } catch {
      failed = true;
      message = $tr(
        'Report se nepodařilo načíst. Zkus to znovu.',
        'The report could not be loaded. Try again.',
      );
    } finally {
      downloading = false;
    }
  }
</script>

<section
  data-testid="beta-diagnostics"
  class="surface self-start p-[1.2rem]"
  aria-labelledby="beta-diagnostics-title"
>
  <div class="flex items-center gap-[0.65rem]">
    <ShieldCheck class="flex-none text-cobalt-700" size={21} aria-hidden="true" />
    <div>
      <h2 class="text-[1rem] font-[850]" id="beta-diagnostics-title">
        {$tr('Beta diagnostika', 'Beta diagnostics')}
      </h2>
      <p class="mt-[0.12rem] font-mono text-[0.68rem] text-ink-600">
        Fritz {FRITZ_APP_VERSION} · DB {DB_VERSION}
      </p>
    </div>
  </div>
  <p class="mt-[0.9rem] text-[0.875rem] leading-normal text-ink-600">
    {$tr(
      'Stáhne souhrn dokončení, návratů, typů úloh a nahlášených problémů. Soubor vznikne jen po klepnutí a nikam se sám neodesílá.',
      'Downloads a summary of completion, returns, activity types, and reported issues. The file is created only when you click and is never uploaded automatically.',
    )}
  </p>
  <details class="mt-3 border-t border-line pt-[0.7rem]">
    <summary class="min-h-11 text-[0.8rem] font-extrabold text-cobalt-700"
      >{$tr('Co v reportu není', 'What the report excludes')}</summary
    >
    <p class="pb-[0.7rem] text-[0.875rem] leading-normal text-ink-600">
      {$tr(
        'Jméno, napsané odpovědi, vlastní slovíčka, poznámky, AI prompty, cookies, klíče ani identifikátor zařízení.',
        'Your name, written answers, custom vocabulary, notes, AI prompts, cookies, keys, and device identifiers.',
      )}
    </p>
  </details>
  <button
    class="btn-base btn-secondary mt-[0.85rem] w-full"
    type="button"
    onclick={downloadDiagnostics}
    disabled={downloading}
    aria-busy={downloading}
  >
    <FileDown size={18} aria-hidden="true" />
    {$tr('Stáhnout soukromý beta report', 'Download private beta report')}
  </button>
  {#if message}
    <p
      class={[
        'mt-[0.7rem] flex items-center gap-[0.4rem] text-[0.8rem] font-[750]',
        failed ? 'text-coral-700' : 'text-mint-700',
      ]}
      role="status"
    >
      {#if !failed}<Check size={16} aria-hidden="true" />{/if}{message}
    </p>
  {/if}
</section>
