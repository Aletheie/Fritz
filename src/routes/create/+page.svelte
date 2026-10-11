<script lang="ts">
  import LoadingState from '$lib/components/LoadingState.svelte';
  import PageHeading from '$lib/components/PageHeading.svelte';
  import VocabularyEditor from '$lib/components/vocabulary/VocabularyEditor.svelte';
  import { errorText } from '$lib/domain/errors.ts';
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

  let draft = $state.raw(createEmptyDraft('manual'));
  let saving = $state(false);
  let message = $state('');
  let failed = $state(false);

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
      message = errorText(error, $motherTongue, {
        cs: 'Slovíčko se nepodařilo uložit.',
        en: 'The word could not be saved.',
      });
    } finally {
      saving = false;
    }
  }

  const methodCard =
    'relative grid min-h-[7.3rem] grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-[0.8rem] rounded-[1.25rem] border p-4 text-ink-950 [transition:transform_160ms_var(--ease-out-emil),border-color_170ms_var(--ease-out-emil),box-shadow_170ms_var(--ease-out-emil)] active:[transform:scale(0.985)] fine-hover:border-[color-mix(in_srgb,var(--color-line)_42%,var(--color-ink-600))] fine-hover:shadow-[0_14px_35px_rgb(23_32_42/0.06)] fine-hover:[transform:translateY(-2px)]';
  const methodIcon = 'row-[1/3] grid size-[2.7rem] place-items-center rounded-[0.85rem]';
  const methodTitle = 'self-end text-[0.98rem]';
  const methodNote = 'self-start text-[0.78rem] text-ink-600';
  const methodArrow = 'col-start-3 row-[1/3] text-ink-600';
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
      title={copy('Přidej si vlastní slovíčka', 'Add your own vocabulary')}
      description={copy(
        'Napiš slovíčko ručně, vlož celý seznam nebo si nech poradit od AI.',
        'Enter a word, paste a list, or ask AI for suggestions.',
      )}
    />

    <nav
      class="grid gap-3 md:grid-cols-3"
      aria-label={copy('Způsoby přidávání', 'Ways to add vocabulary')}
    >
      <a class="{methodCard} border-butter-200 bg-butter-50" href="#rucne">
        <span class="{methodIcon} bg-white text-butter-600"><Plus size={21} /></span>
        <strong class={methodTitle}>{copy('Ručně', 'Manually')}</strong>
        <small class={methodNote}>{copy('Jedno přesné slovíčko', 'One precise entry')}</small>
      </a>
      <a class="{methodCard} border-line bg-paper-50" href="/ai/">
        <span class="{methodIcon} bg-sky-50 text-sky-700"><WandSparkles size={21} /></span>
        <strong class={methodTitle}>{copy('S pomocí AI', 'With AI')}</strong>
        <small class={methodNote}
          >{copy('Téma, text nebo doplnění', 'Topic, text, or enrichment')}</small
        >
        <ArrowRight class={methodArrow} size={18} />
      </a>
      <a class="{methodCard} border-line bg-paper-50" href="/import/">
        <span class="{methodIcon} bg-mint-50 text-mint-700"><FileText size={21} /></span>
        <strong class={methodTitle}>{copy('Rychlý import', 'Quick import')}</strong>
        <small class={methodNote}>{copy('Více řádků najednou', 'Multiple rows at once')}</small>
        <ArrowRight class={methodArrow} size={18} />
      </a>
    </nav>

    <section id="rucne" class="surface scroll-mt-24 p-5 sm:p-7">
      <div class="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p class="kicker">{copy('Ruční kartička', 'Manual card')}</p>
          <h2 class="mt-1 text-2xl font-extrabold tracking-[-0.035em]">
            {copy('Jaké slovíčko si chceš procvičit?', 'Which word would you like to practise?')}
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
          class={[
            'mt-5 flex items-center gap-2 rounded-xl p-3.5 text-sm font-semibold',
            failed ? 'bg-coral-50 text-coral-700' : 'bg-mint-50 text-mint-700',
          ]}
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
