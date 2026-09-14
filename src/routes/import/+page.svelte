<script lang="ts">
  import LoadingState from '$lib/components/LoadingState.svelte';
  import PageHeading from '$lib/components/PageHeading.svelte';
  import { parseQuickImport } from '$lib/domain/import/parser';
  import { localized } from '$lib/i18n';
  import { appStore, motherTongue } from '$lib/state/app';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import FileText from '@lucide/svelte/icons/file-text';
  import Info from '@lucide/svelte/icons/info';
  import Upload from '@lucide/svelte/icons/upload';
  import { onMount } from 'svelte';

  const EXAMPLE_CS = `# německy | česky | množné číslo | tagy | druh | CEFR
der Tisch | stůl | die Tische | škola,lekce-4 | noun | A1
die Aufgabe | úkol | die Aufgaben | škola,lekce-4 | noun | A1
das Fenster | okno | die Fenster | domov | noun | A1
verstehen | rozumět | | slovesa | verb | A2
offen | otevřený | | vlastnosti | adjective | A2`;
  const EXAMPLE_EN = `# German | English | plural | tags | type | CEFR
der Tisch | table | die Tische | school,lesson-4 | noun | A1
die Aufgabe | task | die Aufgaben | school,lesson-4 | noun | A1
das Fenster | window | die Fenster | home | noun | A1
verstehen | to understand | | verbs | verb | A2
offen | open | | properties | adjective | A2`;

  let source = EXAMPLE_CS;
  let importing = false;
  let resultMessage = '';
  let resultError = false;
  let fileInput: HTMLInputElement | undefined;
  $: parsed = parseQuickImport(source);
  $: errors = parsed.issues.filter((issue) => issue.severity === 'error');
  $: warnings = parsed.issues.filter((issue) => issue.severity === 'warning');

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  onMount(async () => {
    await appStore.initialize();
    if (source === EXAMPLE_CS) source = $motherTongue === 'en' ? EXAMPLE_EN : EXAMPLE_CS;
  });

  async function importNow(): Promise<void> {
    if (parsed.notes.length === 0) return;
    importing = true;
    resultMessage = '';
    resultError = false;
    try {
      const result = await appStore.importNotes(parsed.notes);
      resultMessage = copy(
        `Přidáno ${result.added} položek${
          result.duplicates > 0 ? `, ${result.duplicates} už v knihovně bylo` : ''
        }${errors.length > 0 ? `; ${errors.length} chybných řádků bylo přeskočeno` : ''}.`,
        `Added ${result.added} entries${
          result.duplicates > 0 ? `; ${result.duplicates} were already in your vocabulary` : ''
        }${errors.length > 0 ? `; ${errors.length} invalid rows were skipped` : ''}.`,
      );
    } catch (error) {
      resultError = true;
      resultMessage =
        error instanceof Error && $motherTongue === 'cs'
          ? error.message
          : copy('Import se nepodařil.', 'The import failed.');
    } finally {
      importing = false;
    }
  }

  async function readFile(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    resultError = false;
    if (file.size > 2_000_000) {
      resultError = true;
      resultMessage = copy(
        'Soubor je příliš velký. Limit pro rychlý import je 2 MB.',
        'The file is too large. The quick-import limit is 2 MB.',
      );
      input.value = '';
      return;
    }
    try {
      source = await file.text();
      resultMessage = copy(`Načten soubor ${file.name}.`, `Loaded ${file.name}.`);
    } catch {
      resultError = true;
      resultMessage = copy('Soubor se nepodařilo přečíst.', 'The file could not be read.');
    } finally {
      input.value = '';
    }
  }
</script>

<svelte:head>
  <title>{copy('Import slovíček – Fritz', 'Import vocabulary – Fritz')}</title>
</svelte:head>

{#if !$appStore.ready}
  <LoadingState label={copy('Připravuji import…', 'Preparing the import…')} />
{:else}
  <div class="space-y-7">
    <PageHeading
      eyebrow={copy('Rychlý import', 'Quick import')}
      title={copy('Vlož seznam slovíček', 'Paste your vocabulary list')}
      description={copy(
        'Každé slovíčko dej na vlastní řádek. Člen napiš před německé podstatné jméno.',
        'Put each word on a separate line, with the article before German nouns.',
      )}
    />

    <div class="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
      <section class="surface p-4 sm:p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-extrabold tracking-[-0.025em]">
              {copy('Zdrojová data', 'Source data')}
            </h2>
            <p class="mt-1 text-sm text-ink-600">
              {copy(
                'Oddělovač může být svislá čára nebo tabulátor.',
                'Use a vertical bar or tab as the separator.',
              )}
            </p>
          </div>
          <button class="btn-base btn-secondary" type="button" onclick={() => fileInput?.click()}>
            <Upload size={17} />
            {copy('Nahrát soubor', 'Upload file')}
          </button>
          <input
            class="sr-only"
            aria-label={copy('Vybrat soubor se slovíčky', 'Choose a vocabulary file')}
            tabindex="-1"
            bind:this={fileInput}
            type="file"
            accept=".txt,.csv,.tsv,text/plain,text/csv"
            onchange={readFile}
          />
        </div>

        <label class="mt-5 block" for="quick-import">
          <span class="mb-2 block text-sm font-bold text-ink-600"
            >{copy('Řádky k importu', 'Rows to import')}</span
          >
          <textarea
            id="quick-import"
            class="field min-h-[21rem] resize-y font-mono text-[0.9rem] leading-relaxed"
            bind:value={source}
            oninput={() => {
              resultMessage = '';
              resultError = false;
            }}
            spellcheck="false"></textarea>
        </label>

        <div class="mt-4 flex items-start gap-3 rounded-xl bg-sky-50 p-3.5 text-sm text-sky-700">
          <Info class="mt-0.5 flex-none" size={18} />
          <p>
            {copy('Formát:', 'Format:')}
            <strong
              >{copy(
                'německy | česky | množné číslo | tagy | druh | CEFR',
                'German | English | plural | tags | type | CEFR',
              )}</strong
            >.
            {copy(
              'Poslední dva sloupce jsou volitelné; druh může být noun, verb, adjective, phrase nebo other.',
              'The final two columns are optional; type can be noun, verb, adjective, phrase, or other.',
            )}
          </p>
        </div>
      </section>

      <section class="surface min-w-0 p-4 sm:p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="kicker">{copy('Náhled', 'Preview')}</p>
            <h2 class="mt-1 text-xl font-extrabold tracking-[-0.03em]">
              {copy(
                `${parsed.notes.length} validních položek`,
                `${parsed.notes.length} valid entries`,
              )}
            </h2>
          </div>
          <div class="flex gap-2 text-xs font-bold">
            {#if warnings.length > 0}
              <span class="rounded-full bg-butter-50 px-2.5 py-1.5 text-butter-600">
                {copy(`${warnings.length} upozornění`, `${warnings.length} warnings`)}
              </span>
            {/if}
            {#if errors.length > 0}
              <span class="rounded-full bg-coral-50 px-2.5 py-1.5 text-coral-700">
                {copy(`${errors.length} chyb`, `${errors.length} errors`)}
              </span>
            {/if}
          </div>
        </div>

        {#if parsed.notes.length > 0}
          <div
            class="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-50"
          >
            {#each parsed.notes.slice(0, 7) as note}
              <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 p-3.5 sm:p-4">
                <div class="min-w-0">
                  <p class="truncate font-extrabold">
                    {note.article ? `${note.article} ` : ''}{note.german}
                  </p>
                  {#if note.plural}
                    <p class="mt-0.5 truncate text-xs text-ink-600">{note.plural}</p>
                  {/if}
                </div>
                <div class="min-w-0 text-right">
                  <p class="truncate font-semibold text-ink-800">{note.czech}</p>
                  <p class="mt-0.5 truncate text-xs text-ink-600">
                    {[note.kind, note.cefr, ...note.tags].filter(Boolean).join(' · ') ||
                      copy('bez tagu', 'no tag')}
                  </p>
                </div>
              </div>
            {/each}
            {#if parsed.notes.length > 7}
              <p class="p-3.5 text-center text-sm font-semibold text-ink-600">
                {copy(
                  `a dalších ${parsed.notes.length - 7}`,
                  `and ${parsed.notes.length - 7} more`,
                )}
              </p>
            {/if}
          </div>
        {:else}
          <div
            class="mt-5 grid min-h-56 place-items-center rounded-2xl border border-dashed border-line p-6 text-center"
          >
            <div>
              <FileText class="mx-auto text-ink-600" size={28} />
              <p class="mt-3 font-bold">
                {copy('Zatím není co zobrazit', 'Nothing to preview yet')}
              </p>
              <p class="mt-1 text-sm text-ink-600">
                {copy('Každý validní řádek se objeví tady.', 'Every valid row will appear here.')}
              </p>
            </div>
          </div>
        {/if}

        {#if parsed.issues.length > 0}
          <div class="mt-4 max-h-48 space-y-2 overflow-auto" aria-live="polite">
            {#each parsed.issues.slice(0, 12) as issue}
              <div
                class="flex gap-2 rounded-xl p-3 text-sm"
                class:bg-coral-50={issue.severity === 'error'}
                class:text-coral-700={issue.severity === 'error'}
                class:bg-butter-50={issue.severity === 'warning'}
                class:text-butter-600={issue.severity === 'warning'}
              >
                <AlertTriangle class="mt-0.5 flex-none" size={16} />
                <span
                  ><strong>{copy(`Řádek ${issue.line}:`, `Row ${issue.line}:`)}</strong>
                  {$motherTongue === 'cs'
                    ? issue.message
                    : 'Check the required German and English fields and the row format.'}</span
                >
              </div>
            {/each}
          </div>
        {/if}

        {#if resultMessage}
          <div
            class="mt-4 flex items-center gap-2 rounded-xl p-3.5 text-sm font-semibold"
            class:bg-mint-50={!resultError}
            class:text-mint-700={!resultError}
            class:bg-coral-50={resultError}
            class:text-coral-700={resultError}
            aria-live={resultError ? 'assertive' : 'polite'}
          >
            {#if resultError}<AlertTriangle size={18} />{:else}<CheckCircle2 size={18} />{/if}
            {resultMessage}
          </div>
        {/if}

        <button
          class="btn-base btn-primary mt-5 w-full"
          type="button"
          disabled={importing || parsed.notes.length === 0}
          onclick={importNow}
        >
          {importing
            ? copy('Ukládám…', 'Saving…')
            : copy(
                `Přidat ${parsed.notes.length} položek do balíčku`,
                `Add ${parsed.notes.length} entries to the collection`,
              )}
        </button>
      </section>
    </div>
  </div>
{/if}
