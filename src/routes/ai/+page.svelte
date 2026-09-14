<script lang="ts">
  import { getAiKeyStatus, requestVocabulary } from '$lib/client/ai.ts';
  import AiVocabularyCard from '$lib/components/ai/AiVocabularyCard.svelte';
  import ContextDrillPanel from '$lib/components/ai/ContextDrillPanel.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import PageHeading from '$lib/components/PageHeading.svelte';
  import { AI_VOCABULARY_MAX_ITEMS } from '$lib/domain/ai/limits.ts';
  import { aiEndpointAvailable, aiItemToDraft } from '$lib/domain/ai/types.ts';
  import { chapterForPathNode, currentCoursePathNode } from '$lib/domain/course/path.ts';
  import { normalizeGermanKey } from '$lib/domain/grading/normalize.ts';
  import { baseCefrLevel } from '$lib/domain/levels.ts';
  import { draftHasRequiredFields } from '$lib/domain/vocabulary/validation.ts';
  import { languageTag, localized } from '$lib/i18n';
  import { noteMeaning } from '$lib/i18n/vocabulary.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import BookOpenText from '@lucide/svelte/icons/book-open-text';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import FileSearch from '@lucide/svelte/icons/file-search';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Settings from '@lucide/svelte/icons/settings';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import WandSparkles from '@lucide/svelte/icons/wand-sparkles';
  import { onDestroy, onMount } from 'svelte';

  import type {
    AiKeyStatus,
    AiVocabularyFocus,
    AiVocabularyMode,
    AiVocabularyRequest,
  } from '$lib/domain/ai/types.ts';
  import type { CoursePathChapter } from '$lib/domain/course/path.ts';
  import type { CefrLevel, ImportedNoteDraft, Note } from '$lib/domain/types.ts';

  type ResultItem = {
    id: string;
    selected: boolean;
    draft: ImportedNoteDraft;
  };

  const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const focusOptions: Array<{ value: AiVocabularyFocus; cs: string; en: string }> = [
    { value: 'balanced', cs: 'Vyváženě', en: 'Balanced' },
    { value: 'nouns', cs: 'Podstatná jména', en: 'Nouns' },
    { value: 'verbs', cs: 'Slovesa', en: 'Verbs' },
    { value: 'phrases', cs: 'Fráze', en: 'Phrases' },
  ];

  let mode: AiVocabularyMode = 'generate';
  let topic = 'škola a běžný den';
  let sourceText = '';
  let level: CefrLevel = 'A2';
  let count = 10;
  let focus: AiVocabularyFocus = 'balanced';
  let includeMnemonics = false;
  let sharedTag = '';
  let selectedNoteId = '';
  let keyStatus: AiKeyStatus | undefined;
  let statusLoading = true;
  let generating = false;
  let saving = false;
  let message = '';
  let failed = false;
  let resultTitle = '';
  let resultSummary = '';
  let resultModel = '';
  let results: ResultItem[] = [];
  let controller: AbortController | undefined;
  let activeChapter: CoursePathChapter | undefined;

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function recipientLabel(value: string): string {
    if ($motherTongue === 'cs') return value;
    if (value === 'Vlastní služba kompatibilní s OpenAI') {
      return 'Custom OpenAI-compatible service';
    }
    if (value === 'Žádný externí provider') return 'no external provider';
    return value;
  }

  $: selectedNote = $appStore.notes.find((note) => note.id === selectedNoteId);
  $: aiAvailable = aiEndpointAvailable(keyStatus);
  $: selectedCount = countSelectedResults(results, mode, selectedNoteId, $appStore.notes);
  $: requestIssue = requestValidationIssue(mode, count, topic, sourceText, selectedNote, sharedTag);
  $: activeChapter =
    $appStore.course && $appStore.settings
      ? chapterForPathNode(
          currentCoursePathNode($appStore.course, $appStore.settings.grammarLevel)?.id ?? '',
        )
      : undefined;

  onMount(async () => {
    await appStore.initialize();
    topic = copy('škola a běžný den', 'school and everyday life');
    level = baseCefrLevel($appStore.settings?.grammarLevel ?? 'A2.1');
    const parameters = new URLSearchParams(window.location.search);
    const enrichId = parameters.get('enrich');
    if (enrichId && $appStore.notes.some((note) => note.id === enrichId)) {
      mode = 'enrich';
      selectedNoteId = enrichId;
    } else {
      selectedNoteId = $appStore.notes[0]?.id ?? '';
    }

    try {
      keyStatus = await getAiKeyStatus();
    } catch {
      keyStatus = {
        configured: false,
        source: 'demo',
        model: 'Fritz Demo Coach',
        canStoreUserKey: false,
        mode: 'demo',
        fallbackConfigured: false,
        fallbackConsentFeatures: [],
        sponsoredAvailable: false,
        dataRecipient: copy('Žádný externí provider', 'No external provider'),
      };
    } finally {
      statusLoading = false;
    }
  });

  onDestroy(() => controller?.abort());

  function keyFor(draft: ImportedNoteDraft): string {
    return normalizeGermanKey(draft.german, draft.kind === 'noun' ? draft.article : undefined);
  }

  function countSelectedResults(
    items: ResultItem[],
    currentMode: AiVocabularyMode,
    currentSelectedNoteId: string,
    notes: Note[],
  ): number {
    return items.filter(
      (item, index) =>
        item.selected && usable(item, index, currentMode, currentSelectedNoteId, notes, items),
    ).length;
  }

  function duplicate(
    item: ResultItem,
    index: number,
    currentMode = mode,
    currentSelectedNoteId = selectedNoteId,
    notes = $appStore.notes,
    items = results,
  ): boolean {
    const key = keyFor(item.draft);
    if (!key) return false;
    const ignoredNoteId = currentMode === 'enrich' ? currentSelectedNoteId : '';
    if (notes.some((note) => note.normalizedGerman === key && note.id !== ignoredNoteId)) {
      return true;
    }
    return items.some((other, otherIndex) => otherIndex < index && keyFor(other.draft) === key);
  }

  function usable(
    item: ResultItem,
    index: number,
    currentMode = mode,
    currentSelectedNoteId = selectedNoteId,
    notes = $appStore.notes,
    items = results,
  ): boolean {
    if (!draftHasRequiredFields(item.draft)) return false;
    return currentMode === 'enrich'
      ? true
      : !duplicate(item, index, currentMode, currentSelectedNoteId, notes, items);
  }

  function switchMode(next: AiVocabularyMode): void {
    mode = next;
    message = '';
    failed = false;
    results = [];
    resultTitle = '';
    resultSummary = '';
    resultModel = '';
  }

  function requestValidationIssue(
    currentMode = mode,
    currentCount = count,
    currentTopic = topic,
    currentSourceText = sourceText,
    currentSelectedNote = selectedNote,
    currentSharedTag = sharedTag,
  ): string {
    if (
      currentMode !== 'enrich' &&
      (!Number.isInteger(currentCount) ||
        currentCount < 1 ||
        currentCount > AI_VOCABULARY_MAX_ITEMS)
    ) {
      return copy(
        `Zvol celé číslo od 1 do ${AI_VOCABULARY_MAX_ITEMS}.`,
        `Choose a whole number from 1 to ${AI_VOCABULARY_MAX_ITEMS}.`,
      );
    }
    if (
      currentMode === 'generate' &&
      (currentTopic.trim().length < 2 || currentTopic.trim().length > 500)
    ) {
      return copy(
        'Popiš téma alespoň dvěma znaky, nejvýše 500 znaky.',
        'Describe the topic using 2 to 500 characters.',
      );
    }
    if (
      currentMode === 'extract' &&
      (currentSourceText.trim().length < 20 || currentSourceText.trim().length > 20_000)
    ) {
      return copy(
        'Vlož německý text dlouhý 20 až 20 000 znaků.',
        'Paste a German text between 20 and 20,000 characters.',
      );
    }
    if (currentMode === 'enrich' && !currentSelectedNote) {
      return copy('Vyber kartičku k doplnění.', 'Choose a card to enrich.');
    }
    if (currentMode !== 'enrich' && currentSharedTag.trim().length > 40) {
      return copy(
        'Společný štítek může mít nejvýše 40 znaků.',
        'The shared tag can contain up to 40 characters.',
      );
    }
    if (currentMode !== 'enrich' && currentSharedTag.includes(',')) {
      return copy(
        'Zadej jeden společný štítek bez čárky.',
        'Enter one shared tag without a comma.',
      );
    }
    return '';
  }

  function requestBody(): AiVocabularyRequest | undefined {
    if (requestValidationIssue()) return undefined;
    if (mode === 'generate') {
      if (topic.trim().length < 2 || topic.trim().length > 500) return undefined;
      return {
        mode,
        motherTongue: $motherTongue,
        topic: topic.trim(),
        count,
        level,
        focus,
        includeMnemonics,
      };
    }
    if (mode === 'extract') {
      if (sourceText.trim().length < 20 || sourceText.trim().length > 20_000) return undefined;
      return {
        mode,
        motherTongue: $motherTongue,
        text: sourceText.trim(),
        count,
        level,
        includeMnemonics,
      };
    }
    if (!selectedNote) return undefined;
    return {
      mode,
      motherTongue: $motherTongue,
      note: {
        german: selectedNote.german,
        czech: noteMeaning(selectedNote, $motherTongue),
        kind: selectedNote.kind,
        article: selectedNote.article,
        plural: selectedNote.plural,
        acceptedGerman: selectedNote.acceptedGerman,
        acceptedCzech: $motherTongue === 'cs' ? selectedNote.acceptedCzech : [],
        tags: selectedNote.tags,
        exampleDe: selectedNote.exampleDe,
        exampleCs: $motherTongue === 'cs' ? selectedNote.exampleCs : undefined,
        cefr: selectedNote.cefr,
        learningNote: $motherTongue === 'cs' ? selectedNote.learningNote : undefined,
        mnemonic: $motherTongue === 'cs' ? selectedNote.mnemonic : undefined,
        verbForms: selectedNote.verbForms,
      },
    };
  }

  async function generate(): Promise<void> {
    const body = requestBody();
    if (!body || !aiAvailable || generating) return;
    controller?.abort();
    controller = new AbortController();
    generating = true;
    failed = false;
    message = '';
    results = [];
    const tagForBatch = mode === 'enrich' ? '' : sharedTag.trim();

    try {
      const output = await requestVocabulary(body, controller.signal);
      resultTitle = output.title;
      resultSummary = output.summary;
      resultModel = output.model;
      results = output.items.map((item, index) => ({
        id: `${Date.now()}-${index}`,
        selected: true,
        draft: { ...aiItemToDraft(item, tagForBatch), sourceLine: index + 1 },
      }));
      if (results.length === 0) {
        throw new Error(
          copy('AI nevrátila žádné použitelné kartičky.', 'AI returned no usable cards.'),
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      failed = true;
      message =
        error instanceof Error && $motherTongue === 'cs'
          ? error.message
          : copy('AI návrh se nepodařilo vytvořit.', 'The AI draft could not be created.');
    } finally {
      generating = false;
    }
  }

  async function saveSelected(): Promise<void> {
    if (selectedCount === 0) return;
    saving = true;
    failed = false;
    message = '';
    try {
      if (mode === 'enrich') {
        const item = results.find(
          (candidate, index) => candidate.selected && usable(candidate, index),
        );
        if (!item || !selectedNote) return;
        await appStore.updateNote(selectedNote.id, item.draft);
        message = copy(
          `Kartička „${item.draft.german}“ byla zkontrolována a doplněna.`,
          `The card “${item.draft.german}” was reviewed and enriched.`,
        );
        results = results.map((candidate) => ({ ...candidate, selected: false }));
      } else {
        const selected = results
          .filter((item, index) => item.selected && usable(item, index))
          .map((item) => item.draft);
        const imported = await appStore.importNotes(selected);
        message = copy(
          `Uloženo ${imported.added} kartiček${imported.duplicates ? `, ${imported.duplicates} duplicit přeskočeno` : ''}.`,
          `Saved ${imported.added} cards${imported.duplicates ? `; ${imported.duplicates} duplicates skipped` : ''}.`,
        );
        const savedKeys = new Set(selected.map(keyFor));
        results = results.map((item) => ({
          ...item,
          selected: item.selected && !savedKeys.has(keyFor(item.draft)),
        }));
      }
    } catch (error) {
      failed = true;
      message =
        error instanceof Error && $motherTongue === 'cs'
          ? error.message
          : copy('Kartičky se nepodařilo uložit.', 'The cards could not be saved.');
    } finally {
      saving = false;
    }
  }

  function selectAll(value: boolean): void {
    results = results.map((item, index) => ({
      ...item,
      selected: value && usable(item, index),
    }));
  }
</script>

<svelte:head>
  <title>{copy('AI tvorba slovíček – Fritz', 'AI vocabulary builder – Fritz')}</title>
  <meta
    name="description"
    content={copy(
      'Připrav si s AI slovíčka k tématu, z textu nebo z vlastního seznamu.',
      'Use AI to prepare vocabulary from a topic, a text, or your own list.',
    )}
  />
</svelte:head>

{#if !$appStore.ready}
  <LoadingState label={copy('Připravuji AI dílnu…', 'Preparing the AI studio…')} />
{:else}
  <div class="space-y-7">
    <div class="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
      <PageHeading
        eyebrow={copy('AI dílna', 'AI studio')}
        title={copy('Připrav si slovíčka s AI', 'Prepare vocabulary with AI')}
        description={copy(
          'Zadej téma, vlož německý text nebo vyber kartičku k doplnění. Návrhy si před uložením můžeš upravit.',
          'Choose a topic, paste German text, or select a card to fill in. You can edit the suggestions before saving.',
        )}
      />
      {#if aiAvailable && keyStatus}
        <span class="status ready"
          ><ShieldCheck size={16} />
          {keyStatus.source === 'demo'
            ? copy('Demo bez klíče', 'Keyless demo')
            : keyStatus.model}</span
        >
      {:else if !statusLoading}
        <a class="status missing" href="/settings/#ai"
          ><Settings size={16} /> {copy('Nastavit serverovou AI', 'Set up server AI')}</a
        >
      {/if}
    </div>

    <section class="surface overflow-hidden">
      <div class="mode-tabs" aria-label={copy('Režim AI tvorby', 'AI creation mode')}>
        <button
          type="button"
          aria-pressed={mode === 'generate'}
          class:active={mode === 'generate'}
          onclick={() => switchMode('generate')}
        >
          <WandSparkles size={18} />
          {copy('Vytvořit sadu', 'Create a set')}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'extract'}
          class:active={mode === 'extract'}
          onclick={() => switchMode('extract')}
        >
          <FileSearch size={18} />
          {copy('Z textu', 'From text')}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'enrich'}
          class:active={mode === 'enrich'}
          onclick={() => switchMode('enrich')}
        >
          <BookOpenText size={18} />
          {copy('Doplnit kartičku', 'Enrich a card')}
        </button>
      </div>

      <div class="grid xl:grid-cols-[0.82fr_1.18fr]">
        <div class="border-b border-line p-5 sm:p-7 xl:border-r xl:border-b-0">
          {#if keyStatus?.source === 'demo' && !statusLoading}
            <div class="mb-6 rounded-2xl border border-butter-200 bg-butter-50 p-4">
              <div class="flex gap-3">
                <Sparkles class="mt-0.5 flex-none text-butter-600" size={19} />
                <div>
                  <p class="font-extrabold">
                    {copy('Demo režim je připravený hned', 'Demo mode is ready right away')}
                  </p>
                  <p class="mt-1 text-sm leading-relaxed text-ink-600">
                    {copy(
                      'Teď se zobrazují ukázkové návrhy. Vlastní návrhy budou dostupné, až správce aplikace zapne AI.',
                      'You’re seeing sample suggestions. Your app administrator can enable AI to generate new ones.',
                    )}
                  </p>
                  <a class="btn-base btn-secondary mt-4" href="/settings/#ai">
                    {copy('Jak zapnout živé AI', 'How to enable live AI')}
                    <ArrowRight size={17} />
                  </a>
                </div>
              </div>
            </div>
          {/if}

          {#if mode === 'generate'}
            <label class="field-label" for="topic">
              <span>{copy('Téma nebo zadání', 'Topic or brief')}</span>
              <textarea
                id="topic"
                class="field min-h-32 resize-y"
                bind:value={topic}
                maxlength="500"
                placeholder={copy(
                  'Např. slovíčka z 5. lekce: cestování vlakem a orientace na nádraží',
                  'For example: lesson 5 vocabulary about train travel and finding your way around a station',
                )}></textarea>
            </label>
            <fieldset class="mt-5">
              <legend class="field-legend">{copy('Zaměření', 'Practise a topic')}</legend>
              <div class="option-grid">
                {#each focusOptions as option}
                  <button
                    type="button"
                    class:active={focus === option.value}
                    aria-pressed={focus === option.value}
                    onclick={() => (focus = option.value)}>{copy(option.cs, option.en)}</button
                  >
                {/each}
              </div>
            </fieldset>
          {:else if mode === 'extract'}
            <label class="field-label" for="source-text">
              <span>{copy('Německý text', 'German text')}</span>
              <textarea
                id="source-text"
                class="field min-h-64 resize-y"
                bind:value={sourceText}
                maxlength="20000"
                placeholder={copy(
                  'Vlož odstavec z učebnice, zadání, článek nebo vlastní poznámky…',
                  'Paste a textbook paragraph, assignment, article, or your own notes…',
                )}></textarea>
            </label>
            <p class="mt-2 text-xs font-semibold text-ink-600">
              {sourceText.length.toLocaleString(languageTag($motherTongue))} / 20,000
              {copy('znaků', 'characters')}
            </p>
          {:else}
            {#if $appStore.notes.length > 0}
              <label class="field-label" for="enrich-note">
                <span>{copy('Kartička k doplnění', 'Card to enrich')}</span>
                <select id="enrich-note" class="field" bind:value={selectedNoteId}>
                  {#each $appStore.notes as note}
                    <option value={note.id}
                      >{note.article ? `${note.article} ` : ''}{note.german} — {noteMeaning(
                        note,
                        $motherTongue,
                      )}</option
                    >
                  {/each}
                </select>
              </label>
              {#if selectedNote}
                <div class="mt-5 rounded-2xl border border-line bg-paper-50 p-4">
                  <p class="kicker">{copy('Současná data', 'Current data')}</p>
                  <p class="mt-2 text-xl font-extrabold" lang="de">
                    {selectedNote.article ? `${selectedNote.article} ` : ''}{selectedNote.german}
                  </p>
                  <p class="mt-1 text-ink-600">{noteMeaning(selectedNote, $motherTongue)}</p>
                  <p class="mt-3 text-sm leading-relaxed text-ink-600">
                    {copy(
                      'AI zkontroluje druh slova a může doplnit člen, plurál, tvary slovesa, příklad a stručnou českou poznámku.',
                      'AI checks the word type and can add an article, plural, verb forms, an example, and a concise English note.',
                    )}
                  </p>
                </div>
              {/if}
            {:else}
              <div class="rounded-2xl border border-dashed border-line bg-paper-50 p-5 text-center">
                <p class="font-extrabold">
                  {copy('Nejdřív přidej alespoň jedno slovíčko', 'Add at least one word first')}
                </p>
                <p class="mt-1 text-sm text-ink-600">
                  {copy(
                    'Potom může AI doplnit jeho člen, tvary, příklad a poznámku.',
                    'AI can then add its article, forms, example, and note.',
                  )}
                </p>
                <a class="btn-base btn-secondary mt-4" href="/create/"
                  >{copy('Přidat slovíčko', 'Add a word')}</a
                >
              </div>
            {/if}
          {/if}

          {#if mode !== 'enrich'}
            <div class="mt-5 grid grid-cols-2 gap-3">
              <label class="field-label" for="level">
                <span>{copy('Úroveň', 'Level')}</span>
                <select id="level" class="field" bind:value={level}>
                  {#each levels as item}<option value={item}>{item}</option>{/each}
                </select>
              </label>
              <label class="field-label" for="count">
                <span>{copy('Počet', 'Count')}</span>
                <input
                  id="count"
                  class="field"
                  type="number"
                  min="1"
                  max={AI_VOCABULARY_MAX_ITEMS}
                  step="1"
                  inputmode="numeric"
                  aria-invalid={Boolean(
                    requestIssue &&
                    (!Number.isInteger(count) || count < 1 || count > AI_VOCABULARY_MAX_ITEMS),
                  )}
                  bind:value={count}
                />
              </label>
            </div>
            <label class="field-label mt-4" for="shared-tag">
              <span
                >{copy('Společný štítek', 'Shared tag')}
                <small class="font-normal normal-case">({copy('volitelné', 'optional')})</small
                ></span
              >
              <input
                id="shared-tag"
                class="field"
                bind:value={sharedTag}
                maxlength="40"
                autocomplete="off"
                spellcheck="false"
                aria-describedby="shared-tag-help"
                aria-invalid={sharedTag.includes(',') || sharedTag.trim().length > 40}
                placeholder={copy('např. test-10-23', 'e.g. test-10-23')}
              />
              <small id="shared-tag-help" class="mt-1.5 block text-xs leading-relaxed text-ink-600">
                {copy(
                  'Přidá se ke každé nové kartičce. Vlastní štítky navržené AI zůstanou zachované.',
                  'It will be added to every new card. Tags suggested by AI will stay intact.',
                )}
              </small>
            </label>
            <label
              class="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-paper-50 p-3.5"
            >
              <input
                class="mt-0.5 h-5 w-5 accent-ink-950"
                type="checkbox"
                bind:checked={includeMnemonics}
              />
              <span>
                <strong class="block text-sm"
                  >{copy('Navrhnout i pomůcky', 'Suggest memory aids')}</strong
                >
                <span class="mt-0.5 block text-xs leading-relaxed text-ink-600"
                  >{copy(
                    'Přidá krátkou pomůcku k zapamatování, pokud se ke slovu hodí.',
                    'Adds a short memory aid where it fits the word.',
                  )}</span
                >
              </span>
            </label>
          {/if}

          {#if requestIssue}
            <p class="mt-4 text-sm font-semibold text-coral-700" aria-live="polite">
              {requestIssue}
            </p>
          {/if}

          <button
            class="btn-base btn-primary mt-6 w-full"
            type="button"
            disabled={generating || !aiAvailable || !requestBody()}
            onclick={generate}
          >
            {#if generating}<LoaderCircle class="spin" size={18} />{:else}<Sparkles
                size={18}
              />{/if}
            {generating
              ? copy('AI připravuje návrh…', 'AI is preparing a draft…')
              : mode === 'enrich'
                ? copy('Zkontrolovat a doplnit', 'Review and enrich')
                : copy('Vytvořit návrh', 'Create draft')}
          </button>
          <p class="mt-3 text-center text-xs leading-relaxed text-ink-600">
            {copy(
              'AI může udělat chybu. Před uložením zkontroluj hlavně člen, plurál a význam příkladu.',
              'AI can make mistakes. Before saving, check the article, plural, and example meaning in particular.',
            )}
          </p>
        </div>

        <div class="min-w-0 bg-paper-100/45 p-5 sm:p-7">
          {#if generating}
            <div class="grid min-h-[25rem] place-items-center text-center" aria-live="polite">
              <div>
                <span
                  class="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-sky-50 text-sky-700"
                >
                  <LoaderCircle class="spin" size={28} />
                </span>
                <h2 class="mt-5 text-xl font-extrabold">
                  {copy(
                    'Kontroluji němčinu i český význam',
                    'Checking the German and English meaning',
                  )}
                </h2>
                <p class="mt-2 max-w-sm text-sm leading-relaxed text-ink-600">
                  {copy(
                    'Výsledek se neuloží automaticky. Po dokončení můžeš každou položku upravit nebo vypnout.',
                    'Nothing is saved automatically. You can edit or deselect every item when the draft is ready.',
                  )}
                </p>
              </div>
            </div>
          {:else if results.length > 0}
            <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p class="kicker">{copy('Návrh k revizi', 'Draft to review')}</p>
                <h2 class="mt-1 text-2xl font-extrabold tracking-[-0.035em]">{resultTitle}</h2>
                <p class="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">{resultSummary}</p>
              </div>
              <span
                class="flex-none rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700"
                >{resultModel}</span
              >
            </div>

            <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm font-bold">
                {copy(
                  `Vybráno ${selectedCount} z ${results.length}`,
                  `${selectedCount} of ${results.length} selected`,
                )}
              </p>
              <div class="flex gap-2">
                <button class="text-button" type="button" onclick={() => selectAll(true)}
                  >{copy('Vybrat použitelné', 'Select usable')}</button
                >
                <button class="text-button" type="button" onclick={() => selectAll(false)}
                  >{copy('Zrušit výběr', 'Clear selection')}</button
                >
              </div>
            </div>

            <div class="mt-4 space-y-3">
              {#each results as item, index (item.id)}
                <AiVocabularyCard
                  bind:draft={item.draft}
                  bind:selected={item.selected}
                  {index}
                  duplicate={mode !== 'enrich' && duplicate(item, index)}
                />
              {/each}
            </div>

            <div
              class="sticky bottom-[4.6rem] z-10 mt-5 rounded-2xl border border-line bg-paper-50/95 p-3.5 shadow-[0_12px_40px_rgb(23_32_42_/_0.12)] backdrop-blur-xl lg:bottom-4"
            >
              <button
                class="btn-base btn-primary w-full"
                type="button"
                disabled={saving || selectedCount === 0}
                onclick={saveSelected}
              >
                <CheckCircle2 size={18} />
                {saving
                  ? copy('Ukládám…', 'Saving…')
                  : mode === 'enrich'
                    ? copy('Použít doplnění', 'Apply enrichment')
                    : copy(`Uložit ${selectedCount} kartiček`, `Save ${selectedCount} cards`)}
              </button>
            </div>
          {:else}
            <div
              class="grid min-h-[25rem] place-items-center rounded-2xl border border-dashed border-line bg-paper-50/50 p-8 text-center"
            >
              <div>
                <span
                  class="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-butter-50 text-butter-600"
                >
                  <WandSparkles size={28} />
                </span>
                <h2 class="mt-5 text-xl font-extrabold">
                  {copy('Tady se objeví upravitelný návrh', 'Your editable draft will appear here')}
                </h2>
                <p class="mt-2 max-w-md text-sm leading-relaxed text-ink-600">
                  {copy(
                    'Návrhy si projdi a uprav. Uloží se jen kartičky, které vybereš.',
                    'Review and edit the suggestions. Only the cards you select will be saved.',
                  )}
                </p>
              </div>
            </div>
          {/if}

          {#if message}
            <p
              class="mt-4 flex items-start gap-2 rounded-xl p-3.5 text-sm font-semibold"
              class:bg-coral-50={failed}
              class:text-coral-700={failed}
              class:bg-mint-50={!failed}
              class:text-mint-700={!failed}
              aria-live={failed ? 'assertive' : 'polite'}
            >
              {#if failed}<AlertTriangle class="mt-0.5 flex-none" size={18} />{:else}<CheckCircle2
                  class="mt-0.5 flex-none"
                  size={18}
                />{/if}
              {message}
            </p>
          {/if}
        </div>
      </div>
    </section>

    <ContextDrillPanel
      notes={$appStore.notes}
      cards={$appStore.cards}
      reviews={$appStore.recentReviews}
      level={baseCefrLevel($appStore.settings?.grammarLevel ?? 'A2.1')}
      chapter={activeChapter}
      dataRecipient={recipientLabel(
        keyStatus?.dataRecipient ?? copy('Žádný externí provider', 'No external provider'),
      )}
    />
  </div>
{/if}

<style>
  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    align-self: flex-start;
    border-radius: 999px;
    padding: 0.55rem 0.8rem;
    font-size: 0.76rem;
    font-weight: 780;
  }
  .status.ready {
    color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .status.missing {
    color: var(--color-butter-600);
    background: var(--color-butter-50);
  }

  .mode-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-bottom: 1px solid var(--color-line);
    background: var(--color-paper-50);
    padding: 0.45rem;
    gap: 0.35rem;
  }
  .mode-tabs button {
    display: inline-flex;
    min-height: 3.1rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border-radius: 0.85rem;
    color: var(--color-ink-600);
    font-size: 0.78rem;
    font-weight: 760;
    transition:
      transform 150ms var(--ease-out-emil),
      color 160ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil);
  }
  .mode-tabs button:active {
    transform: scale(0.98);
  }
  .mode-tabs button.active {
    color: var(--color-ink-950);
    background: var(--color-butter-50);
    box-shadow: inset 0 0 0 1px var(--color-butter-200);
  }

  .field-label > span,
  .field-legend {
    display: block;
    margin-bottom: 0.45rem;
    color: var(--color-ink-600);
    font-size: 0.82rem;
    font-weight: 740;
  }
  .option-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
  }
  .option-grid button {
    min-height: 2.8rem;
    border: 1px solid var(--color-line);
    border-radius: 0.85rem;
    color: var(--color-ink-600);
    background: var(--color-paper-50);
    padding: 0.55rem;
    font-size: 0.78rem;
    font-weight: 740;
  }
  .option-grid button.active {
    border-color: var(--color-ink-950);
    color: white;
    background: var(--color-ink-950);
  }
  .text-button {
    min-height: 2.4rem;
    border-radius: 0.7rem;
    color: var(--color-sky-700);
    padding: 0.35rem 0.5rem;
    font-size: 0.76rem;
    font-weight: 760;
  }
  :global(.spin) {
    animation: spin 900ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (hover: hover) and (pointer: fine) {
    .mode-tabs button:hover {
      color: var(--color-ink-950);
      background: var(--color-paper-100);
    }
    .text-button:hover {
      background: var(--color-sky-50);
    }
  }

  @media (max-width: 540px) {
    .mode-tabs button {
      flex-direction: column;
      gap: 0.15rem;
      font-size: 0.68rem;
    }
  }
</style>
