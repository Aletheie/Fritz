<script lang="ts">
  import LoadingState from '$lib/components/LoadingState.svelte';
  import PageHeading from '$lib/components/PageHeading.svelte';
  import VocabularyEditor from '$lib/components/vocabulary/VocabularyEditor.svelte';
  import { createEmptyDraft } from '$lib/domain/vocabulary/draft.ts';
  import { draftHasRequiredFields } from '$lib/domain/vocabulary/validation.ts';
  import { localized } from '$lib/i18n';
  import { appStore, motherTongue } from '$lib/state/app';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import FileText from '@lucide/svelte/icons/file-text';
  import Plus from '@lucide/svelte/icons/plus';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import WandSparkles from '@lucide/svelte/icons/wand-sparkles';
  import { onMount } from 'svelte';

  let draft = createEmptyDraft('manual');
  let saving = false;
  let message = '';
  let failed = false;

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  onMount(() => {
    void appStore.initialize();
  });

  async function save(): Promise<void> {
    if (!draftHasRequiredFields(draft)) return;
    saving = true;
    message = '';
    failed = false;
    try {
      const result = await appStore.importNotes([{ ...draft, source: 'manual' }]);
      if (result.added === 0) {
        failed = true;
        message = copy(
          'Stejný německý výraz už v knihovně je.',
          'The same German entry is already in your vocabulary.',
        );
        return;
      }
      message = copy(
        'Slovíčko je uložené a připravené k procvičení.',
        'The word is saved and ready to practise.',
      );
      draft = createEmptyDraft('manual');
    } catch (error) {
      failed = true;
      message =
        error instanceof Error && $motherTongue === 'cs'
          ? error.message
          : copy('Slovíčko se nepodařilo uložit.', 'The word could not be saved.');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>{copy('Přidat slovíčka – Fritz', 'Add vocabulary – Fritz')}</title>
  <meta
    name="description"
    content={copy(
      'Přidej německo-česká slovíčka ručně, rychlým importem nebo s pomocí Gemini.',
      'Add English–German vocabulary manually, with a quick import, or with Gemini.',
    )}
  />
</svelte:head>

{#if !$appStore.ready}
  <LoadingState label={copy('Připravuji přidávání…', 'Preparing vocabulary tools…')} />
{:else}
  <div class="space-y-7">
    <PageHeading
      eyebrow={copy('Přidat slovíčka', 'Add vocabulary')}
      title={copy('Z jednoho výrazu i z celé kapitoly.', 'From one expression to a whole chapter.')}
      description={copy(
        'Vyber nejrychlejší cestu. AI návrhy se vždy nejdřív ukážou k opravě a teprve potom se uloží.',
        'Choose the fastest route. AI drafts are always shown for review before anything is saved.',
      )}
    />

    <nav
      class="grid gap-3 md:grid-cols-3"
      aria-label={copy('Způsoby přidávání', 'Ways to add vocabulary')}
    >
      <a class="method-card method-active" href="#rucne">
        <span class="method-icon"><Plus size={21} /></span>
        <strong>{copy('Ručně', 'Manually')}</strong>
        <small>{copy('Jedno přesné slovíčko', 'One precise entry')}</small>
      </a>
      <a class="method-card" href="/ai/">
        <span class="method-icon ai"><WandSparkles size={21} /></span>
        <strong>{copy('S pomocí AI', 'With AI')}</strong>
        <small>{copy('Téma, text nebo doplnění', 'Topic, text, or enrichment')}</small>
        <ArrowRight class="method-arrow" size={18} />
      </a>
      <a class="method-card" href="/import/">
        <span class="method-icon import"><FileText size={21} /></span>
        <strong>{copy('Rychlý import', 'Quick import')}</strong>
        <small>{copy('Více řádků najednou', 'Multiple rows at once')}</small>
        <ArrowRight class="method-arrow" size={18} />
      </a>
    </nav>

    <section id="rucne" class="surface scroll-mt-24 p-5 sm:p-7">
      <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p class="kicker">{copy('Ruční kartička', 'Manual card')}</p>
          <h2 class="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
            {copy(
              'Přidej jen to, co chceš opravdu trénovat.',
              'Add only what you genuinely want to practise.',
            )}
          </h2>
        </div>
        <span
          class="inline-flex items-center gap-2 self-start rounded-full bg-mint-50 px-3 py-1.5 text-xs font-bold text-mint-700"
        >
          <Sparkles size={15} />
          {copy('čeština', 'English')} → {copy('němčina', 'German')}
        </span>
      </div>

      <div class="mt-6">
        <VocabularyEditor bind:draft idPrefix="manual" />
      </div>

      {#if message}
        <p
          class="mt-5 flex items-center gap-2 rounded-xl p-3.5 text-sm font-semibold"
          class:bg-mint-50={!failed}
          class:text-mint-700={!failed}
          class:bg-coral-50={failed}
          class:text-coral-700={failed}
          aria-live={failed ? 'assertive' : 'polite'}
        >
          {#if failed}<AlertTriangle size={18} />{:else}<CheckCircle2 size={18} />{/if}
          {message}
        </p>
      {/if}

      <div
        class="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-sm leading-relaxed text-ink-600">
          {copy(
            'U podstatného jména je člen povinný. U sloves můžeš v rozšířených údajích přidat nepravidelné tvary.',
            'An article is required for nouns. For verbs, you can add irregular forms under the extra details.',
          )}
        </p>
        <button
          class="btn-base btn-primary flex-none"
          type="button"
          disabled={saving || !draftHasRequiredFields(draft)}
          onclick={save}
        >
          <Plus size={18} />
          {saving ? copy('Ukládám…', 'Saving…') : copy('Přidat do knihovny', 'Add to vocabulary')}
        </button>
      </div>
    </section>
  </div>
{/if}

<style>
  .method-card {
    position: relative;
    display: grid;
    min-height: 7.3rem;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
    align-items: center;
    column-gap: 0.8rem;
    border: 1px solid var(--color-line);
    border-radius: 1.25rem;
    color: var(--color-ink-950);
    background: var(--color-paper-50);
    padding: 1rem;
    transition:
      transform 160ms var(--ease-out-emil),
      border-color 170ms var(--ease-out-emil),
      box-shadow 170ms var(--ease-out-emil);
  }

  @media (hover: hover) and (pointer: fine) {
    .method-card:hover {
      border-color: color-mix(in srgb, var(--color-line) 42%, var(--color-ink-600));
      box-shadow: 0 14px 35px rgb(23 32 42 / 0.06);
      transform: translateY(-2px);
    }
  }

  .method-card:active {
    transform: scale(0.985);
  }
  .method-active {
    border-color: var(--color-butter-200);
    background: var(--color-butter-50);
  }
  .method-icon {
    grid-row: 1 / 3;
    display: grid;
    width: 2.7rem;
    height: 2.7rem;
    place-items: center;
    border-radius: 0.85rem;
    color: var(--color-butter-600);
    background: white;
  }
  .method-icon.ai {
    color: var(--color-sky-700);
    background: var(--color-sky-50);
  }
  .method-icon.import {
    color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .method-card strong {
    align-self: end;
    font-size: 0.98rem;
  }
  .method-card small {
    align-self: start;
    color: var(--color-ink-600);
    font-size: 0.78rem;
  }
  :global(.method-arrow) {
    grid-column: 3;
    grid-row: 1 / 3;
    color: var(--color-ink-600);
  }
</style>
