<script lang="ts">
  import MasteryBadge from '$lib/components/gamification/MasteryBadge.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import PageHeading from '$lib/components/PageHeading.svelte';
  import VocabularyEditor from '$lib/components/vocabulary/VocabularyEditor.svelte';
  import { loadNoteReviewHistory } from '$lib/data/repository.ts';
  import { masteryTier } from '$lib/domain/gamification.ts';
  import { cardLearningStatus } from '$lib/domain/scheduler/status.ts';
  import { reviewLocalDay } from '$lib/domain/stats/learning.ts';
  import { displayGerman, displayPlural } from '$lib/domain/vocabulary/display.ts';
  import { draftFromNote } from '$lib/domain/vocabulary/draft.ts';
  import { sortedVocabularyTags } from '$lib/domain/vocabulary/tags.ts';
  import { draftHasRequiredFields } from '$lib/domain/vocabulary/validation.ts';
  import { languageTag, localized } from '$lib/i18n';
  import { noteMeaning, noteSearchText } from '$lib/i18n/vocabulary.ts';
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

  type KindFilter = 'all' | LexemeKind;
  type SortMode = 'recent' | 'alphabetical' | 'mastery' | 'due';

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

  const kinds: Array<{ value: KindFilter; cs: string; en: string }> = [
    { value: 'all', cs: 'Vše', en: 'All' },
    { value: 'noun', cs: 'Podstatná', en: 'Nouns' },
    { value: 'verb', cs: 'Slovesa', en: 'Verbs' },
    { value: 'adjective', cs: 'Přídavná', en: 'Adjectives' },
    { value: 'phrase', cs: 'Fráze', en: 'Phrases' },
    { value: 'other', cs: 'Ostatní', en: 'Other' },
  ];

  let query = '';
  let kind: KindFilter = 'all';
  let selectedTag = 'all';
  let sort: SortMode = 'recent';
  let editingId = '';
  let editingDraft: ImportedNoteDraft | undefined;
  let saving = false;
  let deleting = '';
  let message = '';
  let failed = false;
  let editorElement: HTMLElement | undefined;
  let nowMs = Date.now();
  let reviewHistoryByNote: Record<string, ReviewLog[] | undefined> = {};
  let loadingReviewHistory = new Set<string>();
  let failedReviewHistory = new Set<string>();
  let tags: string[] = [];
  let noteById = new Map<string, Note>();
  let cardByNoteId = new Map<string, StudyCard>();
  let filtered: Note[] = [];
  let editingNote: Note | undefined;

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function indexCardsByNote(cards: StudyCard[]): Map<string, StudyCard> {
    const indexed = new Map<string, StudyCard>();
    for (const card of cards) {
      if (!indexed.has(card.noteId)) indexed.set(card.noteId, card);
    }
    return indexed;
  }

  $: {
    tags = sortedVocabularyTags($appStore.notes, languageTag($motherTongue));
    noteById = new Map($appStore.notes.map((note) => [note.id, note]));
    cardByNoteId = indexCardsByNote($appStore.cards);
    filtered = filteredNotes(query, kind, selectedTag, sort, $appStore.notes, cardByNoteId);
    editingNote = noteById.get(editingId);
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
    return cardByNoteId.get(note.id);
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

  function masteryRank(note: Note, cardsByNoteId: Map<string, StudyCard>): number {
    const card = cardsByNoteId.get(note.id);
    if (!card) return 0;
    return ['new', 'learning', 'familiar', 'strong', 'mastered'].indexOf(masteryTier(card));
  }

  function filteredNotes(
    currentQuery: string,
    currentKind: KindFilter,
    currentTag: string,
    currentSort: SortMode,
    notes: Note[],
    cardsByNoteId: Map<string, StudyCard>,
  ): Note[] {
    const normalized = currentQuery.trim().toLocaleLowerCase('cs-CZ');
    const result = notes.filter((note) => {
      if (currentKind !== 'all' && note.kind !== currentKind) return false;
      if (currentTag !== 'all' && !note.tags.includes(currentTag)) return false;
      return !normalized || noteSearchText(note, $motherTongue).includes(normalized);
    });

    return result.toSorted((left, right) => {
      if (currentSort === 'alphabetical') {
        return displayGerman(left).localeCompare(displayGerman(right), 'de');
      }
      if (currentSort === 'mastery') {
        return (
          masteryRank(left, cardsByNoteId) - masteryRank(right, cardsByNoteId) ||
          left.german.localeCompare(right.german, 'de')
        );
      }
      if (currentSort === 'due') {
        const leftDue =
          Date.parse(cardsByNoteId.get(left.id)?.dueAt ?? '') || Number.NEGATIVE_INFINITY;
        const rightDue =
          Date.parse(cardsByNoteId.get(right.id)?.dueAt ?? '') || Number.NEGATIVE_INFINITY;
        return leftDue - rightDue || left.german.localeCompare(right.german, 'de');
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
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
    return reviews === 0 ? 'Not reviewed yet' : `${reviews} reviews · memory is building`;
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
      message =
        error instanceof Error && $motherTongue === 'cs'
          ? error.message
          : copy('Kartičku se nepodařilo uložit.', 'The card could not be saved.');
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
      message =
        error instanceof Error && $motherTongue === 'cs'
          ? error.message
          : copy('Slovíčko se nepodařilo odstranit.', 'The word could not be deleted.');
    } finally {
      deleting = '';
    }
  }
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
        title={copy(
          'Každá kartička má být krátká, přesná a užitečná.',
          'Every card should be short, precise, and useful.',
        )}
        description={copy(
          'Hledej česky i německy, zkontroluj členy a nepravidelné tvary a sleduj, co už drží pevně v paměti.',
          'Search in English or German, check articles and irregular forms, and see what is already secure in memory.',
        )}
      />
      <a class="btn-base btn-primary self-start" href="/create/"
        ><Plus size={18} /> {copy('Přidat slovíčka', 'Add vocabulary')}</a
      >
    </div>

    <section class="surface p-4 sm:p-5">
      <div class="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto_auto]">
        <label class="search-field" for="library-search">
          <Search size={18} />
          <input
            id="library-search"
            bind:value={query}
            placeholder={copy(
              'Hledat německy, česky, podle tagu nebo tvaru…',
              'Search in German or English, by tag or word form…',
            )}
          />
          {#if query}<button
              type="button"
              aria-label={copy('Vymazat hledání', 'Clear search')}
              onclick={() => (query = '')}><X size={16} /></button
            >{/if}
        </label>
        <label class="select-field" for="tag-filter"
          ><Filter size={16} /><select
            id="tag-filter"
            aria-label={copy('Filtrovat podle tagu', 'Filter by tag')}
            bind:value={selectedTag}
            ><option value="all">{copy('Všechny tagy', 'All tags')}</option
            >{#each tags as tag}<option value={tag}>{tag}</option>{/each}</select
          ></label
        >
        <label class="select-field" for="sort"
          ><select
            id="sort"
            aria-label={copy('Seřadit slovíčka', 'Sort vocabulary')}
            bind:value={sort}
            ><option value="recent">{copy('Naposledy upravené', 'Recently edited')}</option><option
              value="alphabetical">{copy('Abecedně', 'Alphabetically')}</option
            ><option value="mastery">{copy('Nejméně zvládnuté', 'Lowest mastery')}</option><option
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
            class:active={kind === option.value}
            class="filter-chip"
            type="button"
            onclick={() => (kind = option.value)}>{copy(option.cs, option.en)}</button
          >
        {/each}
      </div>
    </section>

    <div class:editing={Boolean(editingDraft)} class="library-layout">
      <section class="min-w-0">
        <div class="results-heading mb-3 px-1">
          <p class="text-sm font-bold">
            {copy(
              `${filtered.length} z ${$appStore.notes.length} výrazů`,
              `${filtered.length} of ${$appStore.notes.length} entries`,
            )}
          </p>
          {#if selectedTag !== 'all'}
            <a
              class="study-group-link"
              href={`/study/?mode=long-term&tag=${encodeURIComponent(selectedTag)}`}
              ><BookOpenText size={15} />
              {copy('Studovat splatné z', 'Study due cards from')}
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
            {#each filtered as note (note.id)}
              {@const card = cardFor(note)}
              {@const learning = card ? cardLearningStatus(card, new Date(nowMs)) : undefined}
              {@const history = reviewHistoryByNote[note.id]}
              <article class:selected={editingId === note.id} class="word-card">
                <div class="word-main">
                  <div class="flex flex-wrap items-center gap-2">
                    <h2 lang="de">{displayGerman(note)}</h2>
                    {#if note.cefr}<span class="cefr">{note.cefr}</span>{/if}
                    {#if card}<MasteryBadge tier={masteryTier(card)} />{/if}
                  </div>
                  <p class="translation">{noteMeaning(note, $motherTongue)}</p>
                  <div class="details-line">
                    <span>{kindLabel(note.kind)}</span>
                    {#if displayPlural(note.plural)}<span lang="de"
                        >{displayPlural(note.plural)}</span
                      >{/if}
                    {#if note.kind === 'verb' && note.verbForms?.preterite}<span lang="de"
                        >{note.verbForms.preterite} · {note.verbForms.participle}</span
                      >{/if}
                  </div>
                  {#if card && learning}
                    <div class="learning-line">
                      <span class:due={learning.dueNow} class="next-review">
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
                  {#if note.tags.length > 0}<div class="tags">
                      {#each note.tags.slice(0, 4) as tag}<span>{tag}</span>{/each}
                    </div>{/if}
                  {#if storedReviewCount(card) > 0}
                    <details
                      class="review-history"
                      ontoggle={(event) => void openReviewHistory(note.id, event.currentTarget)}
                    >
                      <summary>
                        <Clock3 size={15} aria-hidden="true" />
                        {copy('Historie opakování', 'Review history')}
                      </summary>
                      {#if loadingReviewHistory.has(note.id)}
                        <p class="history-status">
                          {copy('Načítám historii…', 'Loading history…')}
                        </p>
                      {:else if failedReviewHistory.has(note.id)}
                        <p class="history-status error">
                          {copy('Historii se nepodařilo načíst.', 'History could not be loaded.')}
                        </p>
                      {:else if history?.length}
                        <ol>
                          {#each history as review}
                            <li class:disputed={review.excludedFromLearning}>
                              <time datetime={review.reviewedAt}>{reviewDate(review)}</time>
                              <span>{exerciseLabel(review)} · {reviewOutcome(review)}</span>
                              <small>{reviewLocalDay(review)}</small>
                            </li>
                          {/each}
                        </ol>
                      {:else if history}
                        <p class="history-status">
                          {copy('Zatím bez uložených pokusů.', 'No saved attempts yet.')}
                        </p>
                      {/if}
                    </details>
                  {/if}
                </div>
                <div class="actions">
                  <a
                    href={`/ai/?enrich=${note.id}`}
                    aria-label={copy(
                      `Doplnit ${displayGerman(note)} pomocí AI`,
                      `Enrich ${displayGerman(note)} with AI`,
                    )}
                    title={copy('Doplnit pomocí AI', 'Enrich with AI')}
                    ><WandSparkles size={17} /></a
                  >
                  <button
                    type="button"
                    aria-label={copy(
                      `Upravit ${displayGerman(note)}`,
                      `Edit ${displayGerman(note)}`,
                    )}
                    title={copy('Upravit', 'Edit')}
                    onclick={() => void edit(note)}><Edit3 size={17} /></button
                  >
                  <button
                    class="delete"
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
        <aside bind:this={editorElement} class="editor-panel surface scroll-mt-24 p-5 sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="kicker">{copy('Úprava kartičky', 'Edit card')}</p>
              <h2 class="mt-1 text-2xl font-extrabold tracking-[-0.04em]" lang="de">
                {displayGerman(editingNote)}
              </h2>
            </div>
            <button
              class="close-button"
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
              class:error={failed}
              class="editor-message"
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
      <p class:error={failed} class="page-message" aria-live={failed ? 'assertive' : 'polite'}>
        {message}
      </p>
    {/if}
  </div>
{/if}

<style>
  .search-field {
    display: grid;
    min-height: 3rem;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    border: 1px solid var(--color-line);
    border-radius: 0.9rem;
    color: var(--color-ink-600);
    background: var(--color-paper-50);
    padding: 0 0.85rem;
  }
  .search-field:focus-within {
    border-color: var(--color-sky-700);
    box-shadow: 0 0 0 4px rgb(42 102 143 / 0.1);
  }
  .search-field input {
    min-width: 0;
    border: 0;
    color: var(--color-ink-950);
    background: transparent;
    outline: 0;
  }
  .search-field button {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 0.6rem;
  }
  .select-field {
    display: flex;
    min-height: 3rem;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid var(--color-line);
    border-radius: 0.9rem;
    color: var(--color-ink-600);
    background: var(--color-paper-50);
    padding: 0 0.75rem;
  }
  .select-field select {
    min-width: 0;
    border: 0;
    color: var(--color-ink-950);
    background: transparent;
    font-size: 0.82rem;
    font-weight: 700;
    outline: 0;
  }
  .filter-chip {
    min-height: 2.45rem;
    flex: none;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    color: var(--color-ink-700);
    background: var(--color-paper-50);
    padding: 0.45rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 740;
    transition:
      transform 150ms var(--ease-out-emil),
      color 160ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil);
  }
  .filter-chip:active {
    transform: scale(0.97);
  }
  .filter-chip.active {
    border-color: var(--color-ink-950);
    color: white;
    background: var(--color-ink-950);
  }

  .library-layout {
    display: grid;
    gap: 1rem;
  }
  .results-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
  }
  .study-group-link {
    display: inline-flex;
    min-height: 2.5rem;
    align-items: center;
    gap: 0.38rem;
    border-bottom: 1px solid currentColor;
    color: var(--color-cobalt-700);
    font-size: 0.72rem;
    font-weight: 790;
    transition:
      color 150ms var(--ease-out-emil),
      transform 140ms var(--ease-out-emil);
  }
  .study-group-link:active {
    transform: scale(0.97);
  }
  .word-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.8rem;
    border: 1px solid var(--color-line);
    border-radius: 1.15rem;
    background: var(--color-paper-50);
    padding: 0.95rem;
    transition:
      border-color 160ms var(--ease-out-emil),
      box-shadow 160ms var(--ease-out-emil);
  }
  .word-card.selected {
    border-color: var(--color-butter-400);
    box-shadow: 0 0 0 3px rgb(236 207 71 / 0.13);
  }
  .word-main {
    min-width: 0;
  }
  .word-main h2 {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 1.05rem;
    font-weight: 820;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }
  .translation {
    margin-top: 0.14rem;
    color: var(--color-ink-800);
    font-size: 0.9rem;
    font-weight: 650;
  }
  .details-line {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 0.85rem;
    margin-top: 0.45rem;
    color: var(--color-ink-700);
    font-size: 0.72rem;
  }
  .details-line span + span::before {
    content: '·';
    margin-right: 0.85rem;
  }
  .learning-line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.8rem;
    margin-top: 0.55rem;
    color: var(--color-ink-700);
    font-size: 0.68rem;
    font-weight: 690;
  }
  .next-review {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-cobalt-700);
    font-weight: 790;
  }
  .next-review.due {
    color: var(--color-coral-700);
  }
  .cefr {
    border-radius: 0.45rem;
    color: var(--color-sky-700);
    background: var(--color-sky-50);
    padding: 0.22rem 0.4rem;
    font-size: 0.65rem;
    font-weight: 800;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.55rem;
  }
  .tags span {
    border-radius: 0.4rem;
    background: var(--color-paper-200);
    padding: 0.22rem 0.42rem;
    color: var(--color-ink-800);
    font-size: 0.75rem;
    font-weight: 720;
  }
  .review-history {
    max-width: 34rem;
    margin-top: 0.55rem;
  }
  .review-history summary {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.35rem;
    border-radius: 0.35rem;
    color: var(--color-cobalt-700);
    padding: 0.45rem 0.25rem;
    font-size: 0.72rem;
    font-weight: 780;
    list-style: none;
    cursor: pointer;
  }
  .review-history summary::-webkit-details-marker {
    display: none;
  }
  .review-history ol {
    display: grid;
    gap: 0.3rem;
    margin: 0.15rem 0 0;
    padding: 0;
    list-style: none;
  }
  .history-status {
    margin: 0.2rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.72rem;
  }
  .history-status.error {
    color: var(--color-coral-700);
  }
  .review-history li {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.55rem;
    border: 1px solid var(--color-line);
    border-radius: 0.3rem;
    background: white;
    padding: 0.5rem 0.6rem;
    font-size: 0.67rem;
  }
  .review-history li.disputed {
    color: var(--color-ink-600);
    background: var(--color-paper-100);
    text-decoration-color: var(--color-coral-700);
  }
  .review-history time {
    font-family: var(--font-mono);
    font-size: 0.59rem;
  }
  .review-history span {
    font-weight: 720;
  }
  .review-history small {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.56rem;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 0.2rem;
  }
  .actions a,
  .actions button,
  .close-button {
    display: grid;
    width: 2.65rem;
    height: 2.65rem;
    place-items: center;
    border-radius: 0.8rem;
    color: var(--color-ink-600);
    transition:
      color 160ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil),
      transform 150ms var(--ease-out-emil);
  }
  .actions a:active,
  .actions button:active,
  .close-button:active {
    transform: scale(0.95);
  }
  .editor-panel {
    align-self: start;
  }
  .editor-message,
  .page-message {
    margin-top: 1rem;
    border-radius: 0.8rem;
    color: var(--color-mint-700);
    background: var(--color-mint-50);
    padding: 0.8rem;
    font-size: 0.82rem;
    font-weight: 720;
  }
  .editor-message.error,
  .page-message.error {
    color: var(--color-coral-700);
    background: var(--color-coral-50);
  }

  @media (hover: hover) and (pointer: fine) {
    .word-card:hover {
      border-color: color-mix(in srgb, var(--color-line) 50%, var(--color-ink-600));
    }
    .study-group-link:hover {
      color: var(--color-ink-950);
    }
    .actions a:hover {
      color: var(--color-sky-700);
      background: var(--color-sky-50);
    }
    .actions button:hover,
    .close-button:hover {
      color: var(--color-ink-950);
      background: var(--color-paper-200);
    }
    .actions button.delete:hover {
      color: var(--color-coral-700);
      background: var(--color-coral-50);
    }
  }

  @media (min-width: 1180px) {
    .library-layout.editing {
      grid-template-columns: minmax(0, 0.84fr) minmax(29rem, 1.16fr);
    }
    .editor-panel {
      position: sticky;
      top: 2rem;
      max-height: calc(100dvh - 4rem);
      overflow-y: auto;
    }
  }
  @media (max-width: 520px) {
    .results-heading {
      align-items: flex-start;
      flex-direction: column;
    }
    .word-card {
      align-items: start;
    }
    .actions {
      flex-direction: column;
    }
  }
</style>
