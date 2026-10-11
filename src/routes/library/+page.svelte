<script lang="ts">
  import MasteryBadge from '$lib/components/gamification/MasteryBadge.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import PageHeading from '$lib/components/PageHeading.svelte';
  import {
    buildLibraryIndex,
    selectLibraryNotes,
  } from '$lib/components/vocabulary/library-model.ts';
  import type {
    LibraryIndex,
    LibraryKindFilter,
    LibrarySortMode,
  } from '$lib/components/vocabulary/library-model.ts';
  import VocabularyEditor from '$lib/components/vocabulary/VocabularyEditor.svelte';
  import { loadNoteReviewHistory } from '$lib/data/repository.ts';
  import { errorText } from '$lib/domain/errors.ts';
  import { masteryTier } from '$lib/domain/gamification.ts';
  import { cardLearningStatus } from '$lib/domain/scheduler/status.ts';
  import { reviewLocalDay } from '$lib/domain/stats/learning.ts';
  import { displayGerman, displayPlural } from '$lib/domain/vocabulary/display.ts';
  import { draftFromNote } from '$lib/domain/vocabulary/draft.ts';
  import { draftHasRequiredFields } from '$lib/domain/vocabulary/validation.ts';
  import { localized } from '$lib/i18n';
  import { noteMeaning } from '$lib/i18n/vocabulary.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import BookOpenText from '@lucide/svelte/icons/book-open-text';
  import Check from '@lucide/svelte/icons/check';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Edit3 from '@lucide/svelte/icons/edit-3';
  import Filter from '@lucide/svelte/icons/filter';
  import Plus from '@lucide/svelte/icons/plus';
  import Search from '@lucide/svelte/icons/search';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import WandSparkles from '@lucide/svelte/icons/wand-sparkles';
  import X from '@lucide/svelte/icons/x';
  import { onMount, tick } from 'svelte';

  import type {
    ImportedNoteDraft,
    LexemeKind,
    Note,
    ReviewLog,
    StudyCard,
  } from '$lib/domain/types.ts';

  const PAGE_SIZE = 50;

  const reviewDateFormatters = {
    cs: new Intl.DateTimeFormat('cs-CZ', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    en: new Intl.DateTimeFormat('en', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
  const englishDueFormatter = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const kinds: Array<{ value: LibraryKindFilter; cs: string; en: string }> = [
    { value: 'all', cs: 'Vše', en: 'All' },
    { value: 'noun', cs: 'Podstatná', en: 'Nouns' },
    { value: 'verb', cs: 'Slovesa', en: 'Verbs' },
    { value: 'adjective', cs: 'Přídavná', en: 'Adjectives' },
    { value: 'phrase', cs: 'Fráze', en: 'Phrases' },
    { value: 'other', cs: 'Ostatní', en: 'Other' },
  ];

  let query = $state('');
  let kind: LibraryKindFilter = $state('all');
  let selectedTag = $state('all');
  let sort: LibrarySortMode = $state('recent');
  let editingId = $state('');
  let editingDraft: ImportedNoteDraft | undefined = $state.raw();
  let saving = $state(false);
  let deleting = $state('');
  let message = $state('');
  let failed = $state(false);
  let editorElement: HTMLElement | undefined = $state();
  let nowMs = $state(Date.now());
  let reviewHistoryByNote: Record<string, ReviewLog[] | undefined> = $state.raw({});
  let loadingReviewHistory = $state.raw(new Set<string>());
  let failedReviewHistory = $state.raw(new Set<string>());
  let pageNumber = $state(1);
  let resultsElement: HTMLElement | undefined = $state();

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  const libraryIndex: LibraryIndex = $derived(
    buildLibraryIndex($appStore.notes, $appStore.cards, $motherTongue),
  );
  const filtered: Note[] = $derived(
    selectLibraryNotes(libraryIndex, { query, kind, tag: selectedTag, sort }),
  );
  const pageCount = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const currentPage = $derived(Math.min(pageNumber, pageCount));
  const visibleNotes: Note[] = $derived(
    filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
  );
  const editingNote: Note | undefined = $derived(libraryIndex.noteById.get(editingId));

  // A new search or filter always starts again from the first page.
  $effect.pre(() => {
    void [query, kind, selectedTag, sort];
    pageNumber = 1;
  });

  async function changePage(nextPage: number): Promise<void> {
    pageNumber = Math.max(1, Math.min(pageCount, nextPage));
    await tick();
    resultsElement?.focus({ preventScroll: true });
    resultsElement?.scrollIntoView({ block: 'start' });
  }

  onMount(() => {
    void appStore.initialize();
    query = new URLSearchParams(window.location.search).get('q')?.slice(0, 300) ?? '';
    const timer = window.setInterval(() => {
      nowMs = Date.now();
    }, 60_000);
    return () => window.clearInterval(timer);
  });

  function cardFor(note: Note): StudyCard | undefined {
    return libraryIndex.cardByNoteId.get(note.id);
  }

  async function openReviewHistory(noteId: string, details: HTMLDetailsElement): Promise<void> {
    if (!details.open || reviewHistoryByNote[noteId] || loadingReviewHistory.has(noteId)) return;
    loadingReviewHistory = new Set(loadingReviewHistory).add(noteId);
    const nextFailures = new Set(failedReviewHistory);
    nextFailures.delete(noteId);
    failedReviewHistory = nextFailures;
    try {
      const reviews = await loadNoteReviewHistory(noteId, 5);
      reviewHistoryByNote = { ...reviewHistoryByNote, [noteId]: reviews };
    } catch {
      failedReviewHistory = new Set(failedReviewHistory).add(noteId);
    } finally {
      const nextLoading = new Set(loadingReviewHistory);
      nextLoading.delete(noteId);
      loadingReviewHistory = nextLoading;
    }
  }

  function reviewDate(review: ReviewLog): string {
    return reviewDateFormatters[$motherTongue].format(new Date(review.reviewedAt));
  }

  function reviewOutcome(review: ReviewLog): string {
    if (review.excludedFromLearning) return copy('sporné · nepočítá se', 'disputed · excluded');
    if (review.rating === 'again') return copy('chyba · vrátí se dřív', 'missed · returns sooner');
    if (review.signal.hintsUsed > 0) return copy('správně s nápovědou', 'correct with a hint');
    if (review.rating === 'hard') return copy('nejisté vybavení', 'uncertain recall');
    if (review.rating === 'easy') return copy('jisté vybavení', 'confident recall');
    return copy('vybaveno bez nápovědy', 'recalled without a hint');
  }

  function exerciseLabel(review: ReviewLog): string {
    const labels: Record<ReviewLog['exercise'], { cs: string; en: string }> = {
      typing: { cs: 'psaní', en: 'typing' },
      choice: { cs: 'výběr', en: 'choice' },
      flashcard: { cs: 'kartička', en: 'flashcard' },
      'word-order': { cs: 'slovosled', en: 'word order' },
      cloze: { cs: 'doplňování', en: 'fill-in' },
      sentence: { cs: 'vlastní věta', en: 'own sentence' },
      matching: { cs: 'párování', en: 'matching' },
      speaking: { cs: 'mluvení', en: 'speaking' },
    };
    return copy(labels[review.exercise].cs, labels[review.exercise].en);
  }

  function kindLabel(value: LexemeKind): string {
    if (value === 'noun') return copy('podstatné jméno', 'noun');
    if (value === 'verb') return copy('sloveso', 'verb');
    if (value === 'adjective') return copy('přídavné jméno', 'adjective');
    if (value === 'phrase') return copy('fráze', 'phrase');
    return copy('ostatní', 'other');
  }

  function learningDueLabel(card: StudyCard, fallback: string, dueNow: boolean): string {
    if ($motherTongue === 'cs') return fallback;
    if (dueNow) return card.fsrs ? 'Due now' : 'Ready today';
    return card.fsrs ? 'Next review' : 'New card';
  }

  function learningExactLabel(card: StudyCard, fallback: string): string {
    if ($motherTongue === 'cs') return fallback;
    const due = new Date(card.dueAt);
    return Number.isNaN(due.getTime()) ? 'Unknown due date' : englishDueFormatter.format(due);
  }

  function learningDetail(card: StudyCard, fallback: string): string {
    if ($motherTongue === 'cs') return fallback;
    const reviews = storedReviewCount(card);
    return reviews === 0 ? 'Not reviewed yet' : `${reviews} reviews so far`;
  }

  function storedReviewCount(card: StudyCard | undefined): number {
    const rawReviews = card?.fsrs?.reps;
    return typeof rawReviews === 'number' && Number.isFinite(rawReviews)
      ? Math.max(0, Math.round(rawReviews))
      : 0;
  }

  async function edit(note: Note): Promise<void> {
    editingId = note.id;
    editingDraft = draftFromNote(note);
    message = '';
    failed = false;
    await tick();
    editorElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeEditor(): void {
    editingId = '';
    editingDraft = undefined;
    message = '';
  }

  async function saveEdit(): Promise<void> {
    if (!editingDraft || !editingId || !draftHasRequiredFields(editingDraft)) return;
    saving = true;
    message = '';
    failed = false;
    try {
      await appStore.updateNote(editingId, editingDraft);
      message = copy('Změny byly uloženy.', 'Changes saved.');
    } catch (error) {
      failed = true;
      message = errorText(error, $motherTongue, {
        cs: 'Kartičku se nepodařilo uložit.',
        en: 'The card could not be saved.',
      });
    } finally {
      saving = false;
    }
  }

  async function remove(note: Note): Promise<void> {
    if (
      !window.confirm(
        copy(
          `Odstranit „${displayGerman(note)}“ včetně historie opakování?`,
          `Delete “${displayGerman(note)}” including its review history?`,
        ),
      )
    )
      return;
    deleting = note.id;
    message = '';
    failed = false;
    try {
      await appStore.deleteNote(note.id);
      if (editingId === note.id) closeEditor();
    } catch (error) {
      failed = true;
      message = errorText(error, $motherTongue, {
        cs: 'Slovíčko se nepodařilo odstranit.',
        en: 'The word could not be deleted.',
      });
    } finally {
      deleting = '';
    }
  }

  const fieldShell =
    'min-h-12 items-center rounded-[0.9rem] border border-line bg-paper-50 text-ink-600';
  const iconButton =
    'grid size-[2.65rem] place-items-center rounded-[0.8rem] text-ink-600 [transition:color_160ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil),transform_150ms_var(--ease-out-emil)] active:[transform:scale(0.95)]';
  const notice = (error: boolean) => [
    'mt-4 rounded-[0.8rem] p-[0.8rem] text-[0.82rem] font-[720]',
    error ? 'bg-coral-50 text-coral-700' : 'bg-mint-50 text-mint-700',
  ];

  const select = 'min-w-0 border-0 bg-transparent text-[0.82rem] font-bold text-ink-950 outline-0';
</script>

<svelte:head>
  <title>{copy('Slovíčka – Fritz', 'Vocabulary – Fritz')}</title>
</svelte:head>

{#if !$appStore.ready}
  <LoadingState label={copy('Otevírám knihovnu…', 'Opening your vocabulary…')} />
{:else}
  <div class="space-y-7">
    <div class="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
      <PageHeading
        eyebrow={copy('Knihovna', 'Vocabulary')}
        title={copy('Tvoje slovíčka na jednom místě', 'All your vocabulary in one place')}
        description={copy(
          'Hledej česky i německy, upravuj kartičky a vyber si slova k procvičení.',
          'Search in English or German, edit your cards, and choose words to practise.',
        )}
      />
      <a class="btn-base btn-primary self-start" href="/create/"
        ><Plus size={18} /> {copy('Přidat slovíčka', 'Add vocabulary')}</a
      >
    </div>

    <section class="surface p-4 sm:p-5">
      <div class="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto_auto]">
        <label
          class="{fieldShell} grid grid-cols-[auto_minmax(0,1fr)_auto] gap-[0.65rem] px-[0.85rem] focus-within:border-sky-700 focus-within:shadow-[0_0_0_4px_rgb(42_102_143/0.1)]"
          for="library-search"
        >
          <Search size={18} />
          <input
            id="library-search"
            class="min-w-0 border-0 bg-transparent text-ink-950 outline-0"
            aria-label={copy('Hledat slovíčka', 'Search vocabulary')}
            bind:value={query}
            placeholder={copy(
              'Hledat německy, česky, podle tagu nebo tvaru…',
              'Search in German or English, by tag or word form…',
            )}
          />
          {#if query}<button
              class="grid size-8 place-items-center rounded-[0.6rem]"
              type="button"
              aria-label={copy('Vymazat hledání', 'Clear search')}
              onclick={() => (query = '')}><X size={16} /></button
            >{/if}
        </label>
        <label class="{fieldShell} flex gap-[0.45rem] px-3" for="tag-filter"
          ><Filter size={16} /><select
            id="tag-filter"
            class={select}
            aria-label={copy('Filtrovat podle tagu', 'Filter by tag')}
            bind:value={selectedTag}
            ><option value="all">{copy('Všechny tagy', 'All tags')}</option
            >{#each libraryIndex.tags as tag}<option value={tag}>{tag}</option>{/each}</select
          ></label
        >
        <label class="{fieldShell} flex gap-[0.45rem] px-3" for="sort"
          ><select
            id="sort"
            class={select}
            aria-label={copy('Seřadit slovíčka', 'Sort vocabulary')}
            bind:value={sort}
            ><option value="recent">{copy('Naposledy upravené', 'Recently edited')}</option><option
              value="alphabetical">{copy('Abecedně', 'Alphabetically')}</option
            ><option value="mastery">{copy('Nejméně zvládnuté', 'Least familiar')}</option><option
              value="due">{copy('Nejdřív k opakování', 'Due first')}</option
            ></select
          ></label
        >
      </div>
      <div
        class="mt-4 flex gap-2 overflow-x-auto pb-1"
        aria-label={copy('Filtrovat podle druhu slova', 'Filter by word type')}
      >
        {#each kinds as option}
          <button
            class={[
              'min-h-[2.45rem] flex-none rounded-full border px-3 py-[0.45rem] text-[0.75rem] font-[740] [transition:transform_150ms_var(--ease-out-emil),color_160ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil)] active:[transform:scale(0.97)]',
              kind === option.value
                ? 'border-ink-950 bg-ink-950 text-white'
                : 'border-line bg-paper-50 text-ink-700',
            ]}
            type="button"
            onclick={() => (kind = option.value)}>{copy(option.cs, option.en)}</button
          >
        {/each}
      </div>
    </section>

    <div
      class={[
        'grid gap-4',
        editingDraft && 'min-[1180px]:grid-cols-[minmax(0,0.84fr)_minmax(29rem,1.16fr)]',
      ]}
    >
      <section
        class="min-w-0 scroll-mt-24"
        bind:this={resultsElement}
        tabindex="-1"
        aria-label={copy('Výsledky hledání', 'Search results')}
      >
        <div
          data-testid="results-heading"
          class="mb-3 flex items-center justify-between gap-[0.8rem] px-1 max-[521px]:flex-col max-[521px]:items-start"
        >
          <p class="text-sm font-bold">
            {copy(
              `${filtered.length} z ${$appStore.notes.length} výrazů`,
              `${filtered.length} of ${$appStore.notes.length} entries`,
            )}
          </p>
          {#if selectedTag !== 'all'}
            <a
              class="inline-flex min-h-10 items-center gap-[0.38rem] border-b border-current text-[0.72rem] font-[790] text-cobalt-700 [transition:color_150ms_var(--ease-out-emil),transform_140ms_var(--ease-out-emil)] active:[transform:scale(0.97)] fine-hover:text-ink-950"
              href={`/study/?mode=long-term&tag=${encodeURIComponent(selectedTag)}`}
              ><BookOpenText size={15} />
              {copy('Zopakovat slovíčka z', 'Study due cards from')}
              “{selectedTag}” <ArrowRight size={15} /></a
            >
          {:else}
            <p class="text-xs font-semibold text-ink-600">
              {copy('klikni na Upravit pro všechny údaje', 'choose Edit to see all details')}
            </p>
          {/if}
        </div>

        {#if filtered.length > 0}
          <div class="space-y-2.5">
            {#each visibleNotes as note (note.id)}
              {@const card = cardFor(note)}
              {@const learning = card ? cardLearningStatus(card, new Date(nowMs)) : undefined}
              {@const history = reviewHistoryByNote[note.id]}
              <article
                data-testid="word-card"
                class={[
                  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[0.8rem] rounded-[1.15rem] border bg-paper-50 p-[0.95rem] [transition:border-color_160ms_var(--ease-out-emil),box-shadow_160ms_var(--ease-out-emil)] max-[521px]:items-start fine-hover:border-[color-mix(in_srgb,var(--color-line)_50%,var(--color-ink-600))]',
                  editingId === note.id
                    ? 'border-butter-400 shadow-[0_0_0_3px_rgb(236_207_71/0.13)]'
                    : 'border-line',
                ]}
              >
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h2 class="truncate text-[1.05rem] font-[820] tracking-[-0.02em]" lang="de">
                      {displayGerman(note)}
                    </h2>
                    {#if note.cefr}<span
                        class="rounded-[0.45rem] bg-sky-50 px-[0.4rem] py-[0.22rem] text-[0.65rem] font-extrabold text-sky-700"
                        >{note.cefr}</span
                      >{/if}
                    {#if card}<MasteryBadge tier={masteryTier(card)} />{/if}
                  </div>
                  <p class="mt-[0.14rem] text-[0.9rem] font-[650] text-ink-800">
                    {noteMeaning(note, $motherTongue)}
                  </p>
                  <div
                    class="mt-[0.45rem] flex flex-wrap gap-x-[0.85rem] gap-y-[0.45rem] text-[0.72rem] text-ink-700 [&>span+span]:before:mr-[0.85rem] [&>span+span]:before:content-['·']"
                  >
                    <span>{kindLabel(note.kind)}</span>
                    {#if displayPlural(note.plural)}<span lang="de"
                        >{displayPlural(note.plural)}</span
                      >{/if}
                    {#if note.kind === 'verb' && note.verbForms?.preterite}<span lang="de"
                        >{note.verbForms.preterite} · {note.verbForms.participle}</span
                      >{/if}
                  </div>
                  {#if card && learning}
                    <div
                      class="mt-[0.55rem] flex flex-wrap items-center gap-x-[0.8rem] gap-y-[0.35rem] text-[0.68rem] font-[690] text-ink-700"
                    >
                      <span
                        class={[
                          'inline-flex items-center gap-[0.35rem] font-[790]',
                          learning.dueNow ? 'text-coral-700' : 'text-cobalt-700',
                        ]}
                      >
                        <Clock3 size={14} />
                        <time
                          datetime={card.dueAt}
                          title={learningExactLabel(card, learning.exactDueLabel)}
                          >{learningDueLabel(card, learning.dueLabel, learning.dueNow)}</time
                        >
                      </span>
                      <span>{learningDetail(card, learning.detail)}</span>
                    </div>
                  {/if}
                  {#if note.tags.length > 0}<div
                      class="mt-[0.55rem] flex flex-wrap gap-[0.35rem] [&>span]:rounded-[0.4rem] [&>span]:bg-paper-200 [&>span]:px-[0.42rem] [&>span]:py-[0.22rem] [&>span]:text-[0.75rem] [&>span]:font-[720] [&>span]:text-ink-800"
                    >
                      {#each note.tags.slice(0, 4) as tag}<span>{tag}</span>{/each}
                    </div>{/if}
                  {#if storedReviewCount(card) > 0}
                    <details
                      class="mt-[0.55rem] max-w-[34rem]"
                      ontoggle={(event) => void openReviewHistory(note.id, event.currentTarget)}
                    >
                      <summary
                        class="inline-flex min-h-11 cursor-pointer list-none items-center gap-[0.35rem] rounded-[0.35rem] px-1 py-[0.45rem] text-[0.72rem] font-[780] text-cobalt-700 [&::-webkit-details-marker]:hidden"
                      >
                        <Clock3 size={15} aria-hidden="true" />
                        {copy('Historie opakování', 'Review history')}
                      </summary>
                      {#if loadingReviewHistory.has(note.id)}
                        <p class="mt-[0.2rem] text-[0.72rem] text-ink-600">
                          {copy('Načítám historii…', 'Loading history…')}
                        </p>
                      {:else if failedReviewHistory.has(note.id)}
                        <p class="mt-[0.2rem] text-[0.72rem] text-coral-700">
                          {copy('Historii se nepodařilo načíst.', 'History could not be loaded.')}
                        </p>
                      {:else if history?.length}
                        <ol class="mt-[0.15rem] mb-0 grid list-none gap-[0.3rem] p-0">
                          {#each history as review}
                            <li
                              class={[
                                'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.55rem] rounded-[0.3rem] border border-line px-[0.6rem] py-2 text-[0.67rem]',
                                review.excludedFromLearning
                                  ? 'bg-paper-100 text-ink-600 decoration-coral-700'
                                  : 'bg-white',
                              ]}
                            >
                              <time class="font-mono text-[0.59rem]" datetime={review.reviewedAt}
                                >{reviewDate(review)}</time
                              >
                              <span class="font-[720]"
                                >{exerciseLabel(review)} · {reviewOutcome(review)}</span
                              >
                              <small class="font-mono text-[0.56rem] text-ink-600"
                                >{reviewLocalDay(review)}</small
                              >
                            </li>
                          {/each}
                        </ol>
                      {:else if history}
                        <p class="mt-[0.2rem] text-[0.72rem] text-ink-600">
                          {copy('Zatím bez uložených pokusů.', 'No saved attempts yet.')}
                        </p>
                      {/if}
                    </details>
                  {/if}
                </div>
                <div class="flex items-center gap-[0.2rem] max-[521px]:flex-col">
                  <a
                    class="{iconButton} fine-hover:bg-sky-50 fine-hover:text-sky-700"
                    href={`/ai/?enrich=${note.id}`}
                    aria-label={copy(
                      `Doplnit ${displayGerman(note)} pomocí AI`,
                      `Enrich ${displayGerman(note)} with AI`,
                    )}
                    title={copy('Doplnit pomocí AI', 'Enrich with AI')}
                    ><WandSparkles size={17} /></a
                  >
                  <button
                    class="{iconButton} fine-hover:bg-paper-200 fine-hover:text-ink-950"
                    type="button"
                    aria-label={copy(
                      `Upravit ${displayGerman(note)}`,
                      `Edit ${displayGerman(note)}`,
                    )}
                    title={copy('Upravit', 'Edit')}
                    onclick={() => void edit(note)}><Edit3 size={17} /></button
                  >
                  <button
                    class="{iconButton} fine-hover:bg-coral-50 fine-hover:text-coral-700"
                    type="button"
                    disabled={deleting === note.id}
                    aria-label={copy(
                      `Odstranit ${displayGerman(note)}`,
                      `Delete ${displayGerman(note)}`,
                    )}
                    title={copy('Odstranit', 'Delete')}
                    onclick={() => void remove(note)}><Trash2 size={17} /></button
                  >
                </div>
              </article>
            {/each}
          </div>
          {#if pageCount > 1}
            <nav
              class="mt-5 flex flex-wrap items-center justify-between gap-3"
              aria-label={copy('Stránky slovíček', 'Vocabulary pages')}
            >
              <button
                class="btn-base btn-secondary"
                type="button"
                disabled={currentPage === 1}
                onclick={() => void changePage(currentPage - 1)}
              >
                {copy('Předchozí stránka', 'Previous page')}
              </button>
              <p class="text-sm font-semibold text-ink-700" aria-live="polite" aria-atomic="true">
                {copy(
                  `Stránka ${currentPage} z ${pageCount}`,
                  `Page ${currentPage} of ${pageCount}`,
                )}
              </p>
              <button
                class="btn-base btn-secondary"
                type="button"
                disabled={currentPage === pageCount}
                onclick={() => void changePage(currentPage + 1)}
              >
                {copy('Další stránka', 'Next page')}
              </button>
            </nav>
          {/if}
        {:else}
          <div class="surface grid min-h-64 place-items-center p-8 text-center">
            <div>
              <Search class="mx-auto text-ink-600" size={28} />
              <h2 class="mt-3 text-lg font-extrabold">
                {copy('Nic takového tu není', 'No matching entries')}
              </h2>
              <p class="mt-1 text-sm text-ink-600">
                {copy(
                  'Zkus kratší hledání nebo jiný filtr.',
                  'Try a shorter search or a different filter.',
                )}
              </p>
            </div>
          </div>
        {/if}
      </section>

      {#if editingDraft && editingNote}
        <aside
          data-testid="editor-panel"
          bind:this={editorElement}
          class="surface scroll-mt-24 self-start p-5 min-[1180px]:sticky min-[1180px]:top-8 min-[1180px]:max-h-[calc(100dvh-4rem)] min-[1180px]:overflow-y-auto sm:p-6"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="kicker">{copy('Úprava kartičky', 'Edit card')}</p>
              <h2 class="mt-1 text-2xl font-extrabold tracking-[-0.04em]" lang="de">
                {displayGerman(editingNote)}
              </h2>
            </div>
            <button
              class="{iconButton} fine-hover:bg-paper-200 fine-hover:text-ink-950"
              type="button"
              aria-label={copy('Zavřít editor', 'Close editor')}
              onclick={closeEditor}><X size={19} /></button
            >
          </div>

          <div class="mt-6">
            <VocabularyEditor bind:draft={editingDraft} idPrefix="library-edit" />
          </div>

          {#if message}
            <p
              data-testid="editor-message"
              class={notice(failed)}
              aria-live={failed ? 'assertive' : 'polite'}
            >
              {message}
            </p>
          {/if}

          <div class="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row">
            <button
              class="btn-base btn-primary flex-1"
              type="button"
              disabled={saving || !draftHasRequiredFields(editingDraft)}
              onclick={saveEdit}
              ><Check size={18} />
              {saving ? copy('Ukládám…', 'Saving…') : copy('Uložit změny', 'Save changes')}</button
            >
            <a class="btn-base btn-secondary" href={`/ai/?enrich=${editingNote.id}`}
              ><WandSparkles size={18} /> {copy('Doplnit AI', 'Enrich with AI')}</a
            >
          </div>
        </aside>
      {/if}
    </div>

    {#if message && !editingDraft}
      <p class={notice(failed)} aria-live={failed ? 'assertive' : 'polite'}>
        {message}
      </p>
    {/if}
  </div>
{/if}
