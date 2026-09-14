<script lang="ts">
  import { page } from '$app/state';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import StoryExercise from '$lib/components/stories/StoryExercise.svelte';
  import StorySelectionSheet from '$lib/components/stories/StorySelectionSheet.svelte';
  import StoryWordSheet from '$lib/components/stories/StoryWordSheet.svelte';
  import { storyBookIsUnlocked, storyBookUnlockReason } from '$lib/domain/course/story-unlocks.ts';
  import { loadStoryBook, storyEpisodePages } from '$lib/domain/stories/catalog.ts';
  import {
    normalizeStoryWord,
    storyGlossaryTier,
    storyPageSentences,
    uniquePageWords,
  } from '$lib/domain/stories/engine.ts';
  import {
    storyKnownFormsFromNotes,
    storySupportTokens,
    type StoryReaderToken,
  } from '$lib/domain/stories/reading-support.ts';
  import { localized } from '$lib/i18n';
  import {
    storyEpisodeSummary,
    storyEpisodeTitle,
    storyGlossaryMeaning,
  } from '$lib/i18n/stories.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Languages from '@lucide/svelte/icons/languages';
  import List from '@lucide/svelte/icons/list';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Type from '@lucide/svelte/icons/type';
  import X from '@lucide/svelte/icons/x';
  import { onDestroy, onMount, tick } from 'svelte';

  import type {
    StoryBook,
    StoryCheckpoint,
    StoryExerciseResult,
    StoryGlossaryEntry,
    StoryPage,
  } from '$lib/domain/stories/types.ts';

  type ReaderStage = 'intro' | 'reading' | 'exercise' | 'complete';
  type ReaderPageModel = {
    words: string[];
    sentenceOptions: string[];
    tokenRows: StoryReaderToken[][];
    supportCount: number;
  };

  let book: StoryBook | undefined;
  let requestedBookId = '';
  let bookLoading = true;
  let bookLoadError = '';
  let stage: ReaderStage = 'intro';
  let currentPageIndex = 0;
  let useOriginal = false;
  let activeCheckpoint: StoryCheckpoint | undefined;
  let initializedKey = '';
  let completing = false;
  let completionError = '';
  let readingArticle: HTMLElement | undefined;
  let wordMenuOpen = false;
  let sentenceMenuOpen = false;
  let selectedWord = '';
  let selectedEntry: StoryGlossaryEntry | undefined;
  let selectedSentence = '';
  let wordSheetOpen = false;
  let selectionSheetOpen = false;
  let selectionAction: 'translate' | 'explain' = 'translate';
  let selectedText = '';
  let selectedContext = '';
  let suppressNextClick = false;
  let longPressTimer: ReturnType<typeof setTimeout> | undefined;
  const selectionToolbarExitMs = 120;
  let selectionToolbarMounted = false;
  let selectionToolbarClosing = false;
  let selectionToolbarText = '';
  let selectionToolbarCloseTimer: ReturnType<typeof setTimeout> | undefined;

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function unlockReason(): string {
    if (!book) return '';
    return $motherTongue === 'cs'
      ? storyBookUnlockReason(book.id)
      : 'Finish the previous chapter test to unlock this book.';
  }

  $: routeBookId = page.params.bookId ?? '';
  $: if (routeBookId !== requestedBookId) void openBook(routeBookId);
  $: episode = book?.episodes.find((candidate) => candidate.id === page.params.episodeId);
  $: pages = book && episode ? storyEpisodePages(book, episode.id, useOriginal) : [];
  $: currentPage = pages[currentPageIndex];
  $: progress = book ? $appStore.course.storyBooks[book.id] : undefined;
  $: unlocked = book ? storyBookIsUnlocked($appStore.course, book.id) : false;
  $: pagePercent =
    book && currentPage ? Math.round((currentPage.number / book.screenCount) * 100) : 0;
  $: nextEpisode = book && episode ? book.episodes[episode.index + 1] : undefined;
  $: readerPage = buildReaderPageModel(
    currentPage,
    book?.glossary ?? [],
    storyKnownFormsFromNotes($appStore.notes),
  );
  $: syncSelectionToolbar(selectedText, stage);

  async function openBook(bookId: string): Promise<void> {
    requestedBookId = bookId;
    book = undefined;
    bookLoading = true;
    bookLoadError = '';
    try {
      const loaded = await loadStoryBook(bookId);
      if (requestedBookId === bookId) book = loaded;
    } catch (error) {
      if (requestedBookId === bookId) {
        bookLoadError =
          error instanceof Error
            ? error.message
            : copy('Knihu se nepodařilo načíst.', 'The book could not be loaded.');
      }
    } finally {
      if (requestedBookId === bookId) bookLoading = false;
    }
  }

  onMount(() => {
    void appStore.initialize();
  });

  onDestroy(() => {
    clearLongPress();
    clearSelectionToolbarClose();
  });

  $: if ($appStore.ready && book && episode) {
    const key = `${book.id}:${episode.id}`;
    if (key !== initializedKey) initializeReader(key);
  }

  function initializeReader(key: string): void {
    if (!book || !episode) return;
    initializedKey = key;
    useOriginal = false;
    const saved = $appStore.course.storyBooks[book.id];
    const resumeIndex =
      saved?.currentEpisodeId === episode.id
        ? episode.pages.findIndex((candidate) => candidate.number === saved.lastPage)
        : -1;
    currentPageIndex = resumeIndex >= 0 ? resumeIndex : 0;
    activeCheckpoint = undefined;
    wordMenuOpen = false;
    sentenceMenuOpen = false;
    selectedText = '';
    completionError = '';
    completing = false;
    stage = 'intro';
  }

  async function startReading(): Promise<void> {
    if (!book || !episode || !currentPage) return;
    stage = 'reading';
    await appStore.readStoryPage({
      bookId: book.id,
      episodeId: episode.id,
      pageNumber: currentPage.number,
    });
  }

  async function moveToPage(index: number): Promise<void> {
    if (!book || !episode || !pages[index]) return;
    currentPageIndex = index;
    wordMenuOpen = false;
    sentenceMenuOpen = false;
    selectedText = '';
    await tick();
    const scrollOwner = readingArticle?.closest('.reader-scroll');
    scrollOwner?.scrollTo({ top: 0, behavior: 'smooth' });
    await appStore.readStoryPage({
      bookId: book.id,
      episodeId: episode.id,
      pageNumber: pages[index].number,
    });
  }

  async function previousPage(): Promise<void> {
    if (currentPageIndex <= 0) return;
    await moveToPage(currentPageIndex - 1);
  }

  async function advance(): Promise<void> {
    if (!episode || !currentPage) return;
    const checkpoint = episode.checkpoints.find(
      (candidate) => candidate.afterPageId === currentPage.id,
    );
    if (checkpoint && !progress?.completedCheckpointIds.includes(checkpoint.id)) {
      activeCheckpoint = checkpoint;
      stage = 'exercise';
      selectedText = '';
      return;
    }
    await advanceFromPage();
  }

  async function advanceFromPage(): Promise<void> {
    if (!episode) return;
    if (currentPageIndex >= pages.length - 1) {
      await finishEpisode();
      return;
    }
    stage = 'reading';
    activeCheckpoint = undefined;
    await moveToPage(currentPageIndex + 1);
  }

  async function recordCheckpoint(result: StoryExerciseResult): Promise<void> {
    if (!book || !episode || !activeCheckpoint) return;
    await appStore.answerStoryCheckpoint({
      bookId: book.id,
      episodeId: episode.id,
      checkpointId: activeCheckpoint.id,
      result,
    });
  }

  function continueAfterExercise(): void {
    void advanceFromPage();
  }

  async function finishEpisode(): Promise<void> {
    if (!book || !episode || completing) return;
    completing = true;
    completionError = '';
    try {
      await appStore.completeStoryEpisode({
        bookId: book.id,
        episodeId: episode.id,
        nextEpisodeId: nextEpisode?.id,
      });
      stage = 'complete';
    } catch (value) {
      completionError =
        value instanceof Error && $motherTongue === 'cs'
          ? value.message
          : copy('Dokončení se nepodařilo uložit.', 'The completed episode could not be saved.');
    } finally {
      completing = false;
    }
  }

  function toggleEdition(): void {
    if (!book?.originalPages) return;
    useOriginal = !useOriginal;
  }

  function glossaryEntryFor(word: string): StoryGlossaryEntry | undefined {
    if (!book) return undefined;
    const normalized = normalizeStoryWord(word);
    return book.glossary.find((entry) =>
      [entry.german, ...entry.forms].some((form) => normalizeStoryWord(form) === normalized),
    );
  }

  function sentenceContaining(word: string): string {
    const normalized = normalizeStoryWord(word);
    return (
      readerPage.sentenceOptions.find((sentence) =>
        (sentence.match(/\p{L}[\p{L}\p{M}’'-]*/gu) ?? []).some(
          (candidate) => normalizeStoryWord(candidate) === normalized,
        ),
      ) ??
      currentPage?.paragraphs.join(' ') ??
      ''
    );
  }

  function openWord(word: string, entry = glossaryEntryFor(word)): void {
    if (!book || !episode || !word) return;
    selectedWord = word;
    selectedEntry = entry;
    selectedSentence = sentenceContaining(word);
    wordMenuOpen = false;
    sentenceMenuOpen = false;
    wordSheetOpen = true;
  }

  function handleTextClick(event: MouseEvent): void {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (!window.getSelection()?.isCollapsed) return;
    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-word]') : null;
    const word = target?.dataset.word;
    if (word) openWord(word);
  }

  function startLongPress(event: PointerEvent): void {
    if (event.pointerType !== 'touch') return;
    const target =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-word]') : null;
    const word = target?.dataset.word;
    if (!word) return;
    clearLongPress();
    longPressTimer = setTimeout(() => {
      suppressNextClick = true;
      openWord(word);
      if ('vibrate' in navigator) navigator.vibrate(16);
    }, 520);
  }

  function clearLongPress(): void {
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressTimer = undefined;
  }

  function clearSelectionToolbarClose(): void {
    if (selectionToolbarCloseTimer) clearTimeout(selectionToolbarCloseTimer);
    selectionToolbarCloseTimer = undefined;
  }

  function syncSelectionToolbar(text: string, readerStage: ReaderStage): void {
    const nextText = readerStage === 'reading' ? text.trim() : '';
    if (nextText) {
      clearSelectionToolbarClose();
      selectionToolbarText = nextText;
      selectionToolbarMounted = true;
      selectionToolbarClosing = false;
      return;
    }
    if (!selectionToolbarMounted || selectionToolbarClosing) return;
    selectionToolbarClosing = true;
    if (typeof window === 'undefined') {
      selectionToolbarMounted = false;
      selectionToolbarClosing = false;
      selectionToolbarText = '';
      return;
    }
    selectionToolbarCloseTimer = setTimeout(() => {
      selectionToolbarCloseTimer = undefined;
      selectionToolbarMounted = false;
      selectionToolbarClosing = false;
      selectionToolbarText = '';
    }, selectionToolbarExitMs);
  }

  function finishPointerInteraction(): void {
    clearLongPress();
    window.setTimeout(captureSelection, 0);
  }

  function captureSelection(): void {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !readingArticle || selection.rangeCount === 0) {
      selectedText = '';
      return;
    }
    const range = selection.getRangeAt(0);
    if (!readingArticle.contains(range.commonAncestorContainer)) return;
    const value = selection.toString().replace(/\s+/gu, ' ').trim();
    selectedText = value.length >= 2 ? value.slice(0, 1_200) : '';
    selectedContext = currentPage?.paragraphs.join('\n\n') ?? '';
  }

  function openSelection(text: string, action: 'translate' | 'explain'): void {
    if (!text.trim() || !book || !episode) return;
    selectedText = text.trim().slice(0, 1_200);
    selectedContext = currentPage?.paragraphs.join('\n\n') ?? text;
    selectionAction = action;
    wordMenuOpen = false;
    sentenceMenuOpen = false;
    selectionSheetOpen = true;
  }

  function buildReaderPageModel(
    storyPage: StoryPage | undefined,
    glossary: StoryGlossaryEntry[],
    knownForms: ReadonlySet<string>,
  ): ReaderPageModel {
    if (!storyPage) return { words: [], sentenceOptions: [], tokenRows: [], supportCount: 0 };
    const tokenRows = storySupportTokens(storyPage, glossary, knownForms);
    let supportCount = 0;
    for (const row of tokenRows) {
      for (const token of row) {
        if (token.highlight) supportCount += 1;
      }
    }
    return {
      words: uniquePageWords(storyPage),
      sentenceOptions: storyPageSentences(storyPage),
      tokenRows,
      supportCount,
    };
  }

  function pageSupportLabel(count: number): string {
    if ($motherTongue === 'en') return `${count} guided ${count === 1 ? 'word' : 'words'}`;
    if (count === 1) return '1 výraz k objevení';
    if (count >= 2 && count <= 4) return `${count} výrazy k objevení`;
    return `${count} výrazů k objevení`;
  }

  function toggleWordMenu(): void {
    wordMenuOpen = !wordMenuOpen;
    sentenceMenuOpen = false;
    selectedText = '';
  }

  function toggleSentenceMenu(): void {
    sentenceMenuOpen = !sentenceMenuOpen;
    wordMenuOpen = false;
    selectedText = '';
  }
</script>

<svelte:head>
  <title
    >{book && episode
      ? `${storyEpisodeTitle(episode, $motherTongue)} · ${book.title}`
      : copy('Čtení', 'Reading')} · Fritz</title
  >
</svelte:head>

{#if !$appStore.ready || bookLoading}
  <div class="reader-loading">
    <LoadingState label={copy('Připravuji stránku…', 'Preparing the page…')} />
  </div>
{:else if bookLoadError}
  <section class="reader-missing">
    <div>
      <p class="kicker">{copy('Knihu se nepodařilo načíst', 'The book could not be loaded')}</p>
      <h1>{copy('Zkus knihu otevřít znovu.', 'Try opening the book again.')}</h1>
      <p>{bookLoadError}</p>
      <button class="btn-base btn-primary" type="button" onclick={() => void openBook(routeBookId)}>
        {copy('Zkusit znovu', 'Try again')}
      </button>
    </div>
  </section>
{:else if !book || !episode}
  <section class="reader-missing">
    <div>
      <p class="kicker">{copy('Epizoda nenalezena', 'Episode not found')}</p>
      <h1>{copy('Tahle stránka do knihy nepatří.', 'This page does not belong in the book.')}</h1>
      <a class="btn-base btn-primary" href="/stories/"
        ><ArrowLeft size={18} /> {copy('Zpět do čítárny', 'Back to the reading room')}</a
      >
    </div>
  </section>
{:else if !unlocked}
  <section class="reader-missing">
    <div class="locked-reader">
      <span class="locked-icon"><LockKeyhole size={28} /></span>
      <p class="kicker">
        {copy('Bonusová četba · zatím zamčeno', 'Bonus reading · locked for now')}
      </p>
      <h1>
        {copy(
          `${book.title} se odemkne po testu kapitoly.`,
          `${book.title} unlocks after the chapter test.`,
        )}
      </h1>
      <p>{unlockReason()}</p>
      <div class="locked-actions">
        <a class="btn-base btn-primary" href="/"
          ><ArrowRight size={18} /> {copy('Pokračovat v cestě', 'Continue on the path')}</a
        >
        <a class="btn-base btn-secondary" href="/stories/"
          ><ArrowLeft size={18} /> {copy('Čítárna', 'Reading room')}</a
        >
      </div>
    </div>
  </section>
{:else}
  <section class={`reader-shell accent-${book.accent}`}>
    <header class="reader-header">
      <a
        class="reader-close"
        href={`/stories/${book.id}/`}
        aria-label={copy('Zavřít čtečku', 'Close reader')}><X size={20} /></a
      >
      <div class="reader-title">
        <span>{book.level} · {copy('Epizoda', 'Episode')} {episode.number}/{book.episodeCount}</span
        >
        <strong>{storyEpisodeTitle(episode, $motherTongue)}</strong>
      </div>
      {#if stage === 'reading' || stage === 'exercise'}
        <div
          class="reader-progress"
          aria-label={copy(
            `Strana ${currentPage?.number ?? 0} z ${book.screenCount}`,
            `Page ${currentPage?.number ?? 0} of ${book.screenCount}`,
          )}
        >
          <span>{currentPage?.number ?? 0}/{book.screenCount}</span>
          <div><i style={`width: ${pagePercent}%`}></i></div>
        </div>
      {:else}
        <span class="reader-time"><Clock3 size={14} /> {episode.minutes} min</span>
      {/if}
    </header>

    <div class="reader-scroll">
      {#if stage === 'intro'}
        <section class="episode-intro">
          <div class="intro-number">{String(episode.number).padStart(2, '0')}</div>
          <p class="reader-kicker">{book.title}</p>
          <h1>{storyEpisodeTitle(episode, $motherTongue)}</h1>
          <p class="intro-summary">{storyEpisodeSummary(episode, $motherTongue)}</p>
          <div class="intro-preview">
            <BookOpen size={21} />
            <div>
              <strong>{copy('4 krátké stránky', '4 short pages')}</strong><span
                >{copy(
                  '2 příběhové výzvy · přibližně 5 minut',
                  '2 story challenges · about 5 minutes',
                )}</span
              >
            </div>
          </div>
          <ul>
            <li>
              <MousePointer2 size={16} />
              {copy('Klepni nebo podrž libovolné slovo.', 'Tap or press and hold any word.')}
            </li>
            <li>
              <Type size={16} />
              {copy(
                'Podtržená slova mají připravený překlad. Klepnutím ho zobrazíš.',
                'Underlined words have a translation ready. Tap to see it.',
              )}
            </li>
            <li>
              <Languages size={16} />
              {copy(
                'Označ větu a nech si ji vysvětlit.',
                'Select a sentence and ask for an explanation.',
              )}
            </li>
          </ul>
        </section>
      {:else if stage === 'reading' && currentPage}
        <section class="reading-stage">
          <div class="page-meta">
            <span>{copy('Fragment', 'Part')} {currentPageIndex + 1}/{episode.pages.length}</span>
            {#if currentPage.sectionTitle}<span>{currentPage.sectionTitle}</span>{/if}
            {#if readerPage.supportCount > 0}<span class="page-support-count">
                {pageSupportLabel(readerPage.supportCount)}
              </span>{/if}
            {#if book.originalPages}
              <button type="button" aria-pressed={useOriginal} onclick={toggleEdition}>
                {useOriginal
                  ? copy('Původní pravopis', 'Original spelling')
                  : copy('Lehce modernizováno', 'Lightly modernised')}
              </button>
            {/if}
          </div>

          <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events (delegated touch/click reader; explicit keyboard word and sentence tools are directly below) -->
          <article
            bind:this={readingArticle}
            class="story-text"
            lang="de"
            onclick={handleTextClick}
            onpointerdown={startLongPress}
            onpointerup={finishPointerInteraction}
            onpointercancel={clearLongPress}
          >
            {#each currentPage.paragraphs as paragraph, paragraphIndex}
              <p>
                {#each readerPage.tokenRows[paragraphIndex] ?? [] as token}
                  {#if token.word}
                    {#if token.glossary && token.highlight}
                      {@const glossaryTier = storyGlossaryTier(token.glossary.cefr, book.level)}
                      <button
                        class="glossary-word"
                        class:advanced-word={glossaryTier === 'advanced'}
                        type="button"
                        data-word={token.word}
                        data-meaning={storyGlossaryMeaning(token.glossary, $motherTongue)}
                        data-tier={glossaryTier}
                        aria-label={`${token.word}: ${storyGlossaryMeaning(
                          token.glossary,
                          $motherTongue,
                        )}${
                          glossaryTier === 'advanced'
                            ? copy(
                                `, pokročilejší výraz úrovně ${token.glossary.cefr}`,
                                `, advanced ${token.glossary.cefr} expression`,
                              )
                            : ''
                        }`}>{token.value}</button
                      >
                    {:else}
                      <span class="story-word" data-word={token.word}>{token.value}</span>
                    {/if}
                  {:else}{token.value}{/if}
                {/each}
              </p>
            {/each}
          </article>

          <p class="reading-hint">
            <Sparkles size={14} />
            <span
              >{copy(
                readerPage.supportCount > 0
                  ? 'Slovo podtrhujeme jen při prvním výskytu na stránce. Tečkovaná čára znamená dostupný překlad, plná označuje těžší výraz.'
                  : 'Na této stránce není nic podtržené. Význam si můžeš vyhledat klepnutím na kterékoli slovo.',
                readerPage.supportCount > 0
                  ? 'Words are underlined only the first time they appear on a page. Dots mark a word with a translation; a solid line marks a harder word.'
                  : 'Nothing is underlined on this page. You can still tap any word to look it up.',
              )}</span
            >
          </p>

          {#if wordMenuOpen}
            <aside class="tool-panel word-panel" aria-labelledby="word-panel-title">
              <header>
                <div>
                  <span>{copy('Klávesová alternativa', 'Keyboard alternative')}</span>
                  <h2 id="word-panel-title">
                    {copy('Vyber slovo ze stránky', 'Choose a word from the page')}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label={copy('Zavřít výběr slov', 'Close word picker')}
                  onclick={toggleWordMenu}><X size={18} /></button
                >
              </header>
              <div class="word-list">
                {#each readerPage.words as word}<button
                    type="button"
                    lang="de"
                    onclick={() => openWord(word)}>{word}</button
                  >{/each}
              </div>
            </aside>
          {/if}

          {#if sentenceMenuOpen}
            <aside class="tool-panel sentence-panel" aria-labelledby="sentence-panel-title">
              <header>
                <div>
                  <span>{copy('Nástroje k větě', 'Sentence tools')}</span>
                  <h2 id="sentence-panel-title">
                    {copy('Vyber celou větu', 'Choose a complete sentence')}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label={copy('Zavřít výběr vět', 'Close sentence picker')}
                  onclick={toggleSentenceMenu}><X size={18} /></button
                >
              </header>
              <div class="sentence-list">
                {#each readerPage.sentenceOptions as sentence}<button
                    type="button"
                    lang="de"
                    onclick={() => openSelection(sentence, 'explain')}
                    >{sentence}<ArrowRight size={16} /></button
                  >{/each}
              </div>
            </aside>
          {/if}
        </section>
      {:else if stage === 'exercise' && activeCheckpoint}
        <section class="exercise-stage">
          <StoryExercise
            exercise={activeCheckpoint.exercise}
            onanswer={recordCheckpoint}
            oncontinue={continueAfterExercise}
          />
        </section>
      {:else if stage === 'complete'}
        <section class="episode-complete completion-arrival">
          <span class="complete-icon"><CheckCircle2 size={32} /></span>
          <p class="reader-kicker">{copy('Epizoda dokončena', 'Episode complete')}</p>
          <h1>{storyEpisodeTitle(episode, $motherTongue)}</h1>
          <p>
            {copy(
              'Epizodu máš přečtenou. Uložená slovíčka najdeš v běžném procvičování.',
              'You’ve finished the episode. Your saved words will appear in regular practice.',
            )}
          </p>
          <dl>
            <div>
              <dt>{copy('Obrazovky', 'Screens')}</dt>
              <dd>{episode.pages.length}</dd>
            </div>
            <div>
              <dt>{copy('Zastávky', 'Checkpoints')}</dt>
              <dd>{episode.checkpoints.length}</dd>
            </div>
            <div>
              <dt>{copy('Celkem', 'Overall')}</dt>
              <dd>{progress?.completedEpisodeIds.length ?? 0}/{book.episodeCount}</dd>
            </div>
          </dl>
        </section>
      {/if}
    </div>

    {#if selectionToolbarMounted}
      <div
        class="selection-toolbar"
        data-closing={selectionToolbarClosing ? '' : undefined}
        aria-label={copy('Nástroje k označenému textu', 'Tools for selected text')}
      >
        <span
          >{selectionToolbarText.length > 48
            ? `${selectionToolbarText.slice(0, 48)}…`
            : selectionToolbarText}</span
        >
        <button type="button" onclick={() => openSelection(selectionToolbarText, 'translate')}
          ><Languages size={16} /> {copy('Přeložit', 'Translate')}</button
        >
        <button type="button" onclick={() => openSelection(selectionToolbarText, 'explain')}
          ><Sparkles size={16} /> {copy('Vysvětlit', 'Explain')}</button
        >
      </div>
    {/if}

    <footer class="reader-footer">
      {#if stage === 'intro'}
        <a class="quiet-action" href={`/stories/${book.id}/`}
          ><ChevronLeft size={18} /> {copy('Seznam epizod', 'Episode list')}</a
        >
        <button class="main-action" type="button" onclick={() => void startReading()}>
          {progress?.currentEpisodeId === episode.id && progress.lastPage > episode.pages[0].number
            ? copy('Pokračovat', 'Continue')
            : copy('Začít číst', 'Start reading')}
          <ArrowRight size={18} />
        </button>
      {:else if stage === 'reading'}
        <button
          class="icon-action"
          type="button"
          aria-label={copy('Předchozí stránka', 'Previous page')}
          disabled={currentPageIndex === 0}
          onclick={() => void previousPage()}><ChevronLeft size={21} /></button
        >
        <div class="reader-tools">
          <button class:active={wordMenuOpen} type="button" onclick={toggleWordMenu}
            ><List size={17} /><span>{copy('Slovo', 'Word')}</span></button
          >
          <button class:active={sentenceMenuOpen} type="button" onclick={toggleSentenceMenu}
            ><Languages size={17} /><span>{copy('Věta', 'Sentence')}</span></button
          >
        </div>
        <button
          class="main-action"
          type="button"
          disabled={completing}
          onclick={() => void advance()}
        >
          {currentPageIndex === pages.length - 1
            ? copy('Dokončit', 'Finish')
            : copy('Pokračovat', 'Continue')}
          <ArrowRight size={18} />
        </button>
      {:else if stage === 'exercise'}
        <span class="footer-note"
          ><Sparkles size={15} />
          {copy('Zastávka', 'Checkpoint')}
          {activeCheckpoint === episode.checkpoints[0] ? '1' : '2'}
          {copy('ze', 'of')} 2</span
        >
      {:else if stage === 'complete'}
        <a class="quiet-action" href={`/stories/${book.id}/`}
          ><ChevronLeft size={18} /> {copy('Přehled knihy', 'Book overview')}</a
        >
        {#if nextEpisode}
          <a class="main-action" href={`/stories/${book.id}/${nextEpisode.id}/`}
            >{copy('Další epizoda', 'Next episode')} <ArrowRight size={18} /></a
          >
        {:else}
          <a class="main-action" href="/stories/"
            >{copy('Zpět do čítárny', 'Back to the reading room')} <ArrowRight size={18} /></a
          >
        {/if}
      {/if}
      {#if completionError}<p class="footer-error" role="alert">{completionError}</p>{/if}
    </footer>
  </section>

  {#if selectedWord}
    <StoryWordSheet
      open={wordSheetOpen}
      {book}
      episodeId={episode.id}
      word={selectedWord}
      sentence={selectedSentence}
      entry={selectedEntry}
      onclose={() => (wordSheetOpen = false)}
    />
  {/if}

  {#if selectedText}
    <StorySelectionSheet
      open={selectionSheetOpen}
      {book}
      episodeId={episode.id}
      text={selectedText}
      context={selectedContext}
      initialAction={selectionAction}
      onclose={() => (selectionSheetOpen = false)}
    />
  {/if}
{/if}

<style>
  :global(body:has(.reader-shell)) {
    overflow: hidden;
  }
  .reader-shell {
    --book-accent: var(--color-sky-200);
    --book-soft: var(--color-sky-50);
    position: relative;
    display: grid;
    width: 100%;
    height: 100dvh;
    grid-template-rows: auto minmax(0, 1fr) auto;
    overflow: hidden;
    color: var(--color-ink-950);
    background: var(--color-paper-100);
  }
  .reader-header {
    z-index: 3;
    display: grid;
    min-height: calc(3.9rem + var(--safe-top));
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    border-bottom: 1px solid var(--color-ink-950);
    background: color-mix(in srgb, var(--color-paper-50) 94%, transparent);
    padding: var(--safe-top) 0.75rem 0;
    backdrop-filter: blur(16px);
  }
  .reader-close,
  .icon-action {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border: 1px solid var(--color-line);
    border-radius: 0.78rem;
    background: var(--color-paper-50);
  }
  .reader-title {
    display: grid;
    min-width: 0;
    gap: 0.1rem;
  }
  .reader-title span {
    color: var(--color-ink-800);
    font-family: var(--font-mono);
    font-size: 0.54rem;
    font-weight: 820;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .reader-title strong {
    overflow: hidden;
    font-size: 0.82rem;
    font-weight: 850;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .reader-progress {
    display: grid;
    width: 4.2rem;
    gap: 0.25rem;
  }
  .reader-progress > span {
    justify-self: end;
    font-family: var(--font-mono);
    font-size: 0.57rem;
    font-weight: 850;
  }
  .reader-progress > div {
    height: 0.3rem;
    overflow: hidden;
    border-radius: 99px;
    background: var(--color-paper-200);
  }
  .reader-progress i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--color-cobalt-700);
  }
  .reader-time {
    display: flex;
    align-items: center;
    gap: 0.28rem;
    color: var(--color-ink-800);
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 800;
  }
  .reader-scroll {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scroll-behavior: smooth;
  }
  .episode-intro,
  .episode-complete {
    display: grid;
    width: min(100%, 42rem);
    min-height: 100%;
    align-content: center;
    margin: 0 auto;
    padding: 2rem 1rem;
  }
  .intro-number {
    display: grid;
    width: 3.4rem;
    height: 3.4rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.9rem;
    background: var(--book-accent);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 900;
    box-shadow: 3px 3px 0 rgb(21 25 28 / 0.13);
  }
  .reader-kicker {
    margin: 1.2rem 0 0;
    color: var(--color-ink-800);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 850;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .episode-intro h1,
  .episode-complete h1 {
    max-width: 15ch;
    margin: 0.45rem 0 0;
    font-size: clamp(2.15rem, 10vw, 4.4rem);
    font-weight: 920;
    letter-spacing: -0.04em;
    line-height: 0.92;
  }
  .intro-summary,
  .episode-complete > p:not(.reader-kicker) {
    max-width: 34rem;
    margin: 0.9rem 0 0;
    color: var(--color-ink-800);
    font-size: 0.95rem;
    line-height: 1.55;
  }
  .intro-preview {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    margin-top: 1.25rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.5rem 1rem 0.5rem 0.5rem;
    background: var(--book-soft);
    padding: 0.85rem;
  }
  .intro-preview :global(svg) {
    flex: 0 0 auto;
  }
  .intro-preview div {
    display: grid;
    gap: 0.15rem;
  }
  .intro-preview strong {
    font-size: 0.78rem;
  }
  .intro-preview span {
    color: var(--color-ink-800);
    font-size: 0.67rem;
  }
  .episode-intro ul {
    display: grid;
    gap: 0.5rem;
    margin: 1rem 0 0;
    padding: 0;
    list-style: none;
  }
  .episode-intro li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-ink-800);
    font-size: 0.78rem;
  }
  .episode-intro li :global(svg) {
    flex: 0 0 auto;
    color: var(--color-cobalt-700);
  }
  .reading-stage {
    display: grid;
    width: min(100%, 62rem);
    min-height: 100%;
    align-content: start;
    margin: 0 auto;
    padding: 1rem;
  }
  .page-meta {
    display: flex;
    min-height: 2rem;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
    margin: 0 auto;
    color: var(--color-ink-800);
    font-family: var(--font-mono);
    font-size: 0.56rem;
    font-weight: 760;
  }
  .page-meta span + span::before {
    margin-right: 0.45rem;
    content: '·';
  }
  .page-support-count {
    color: var(--color-cobalt-700);
  }
  .page-meta button {
    min-height: 2rem;
    margin-left: auto;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    background: var(--color-paper-50);
    padding: 0.35rem 0.58rem;
    font-size: 0.7rem;
    font-weight: 800;
  }
  .story-text {
    width: min(100%, 65ch);
    margin: 1rem auto 0;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.55rem 1.35rem 0.55rem 0.55rem;
    background: var(--color-paper-50);
    padding: clamp(1.15rem, 5vw, 2.6rem);
    box-shadow: 5px 6px 0 rgb(21 25 28 / 0.09);
    cursor: text;
    user-select: text;
  }
  .story-text::before {
    display: block;
    width: 2.5rem;
    border-top: 3px solid var(--book-accent);
    margin-bottom: 1rem;
    content: '';
  }
  .story-text p {
    margin: 0;
    font-family: var(--font-reader);
    font-size: 1.125rem;
    font-variation-settings: 'opsz' 18;
    hyphens: auto;
    letter-spacing: -0.008em;
    line-height: 1.7;
    text-wrap: pretty;
  }
  .story-text p + p {
    margin-top: 1em;
  }
  .story-word {
    border-radius: 0.15rem;
  }
  .glossary-word {
    position: relative;
    display: inline;
    border-bottom: 2px dotted var(--color-cobalt-700);
    border-radius: 0;
    color: inherit;
    background: transparent;
    padding: 0;
    font: inherit;
    line-height: inherit;
    text-decoration: none;
    cursor: help;
    user-select: text;
  }
  .glossary-word.advanced-word {
    border-bottom-style: solid;
    border-radius: 0.15rem;
    background: var(--color-cobalt-100);
    padding-inline: 0.08em;
    font-weight: 720;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .glossary-word::after {
    position: absolute;
    bottom: calc(100% + 0.45rem);
    left: 50%;
    z-index: 5;
    width: max-content;
    max-width: min(14rem, 70vw);
    border: 1px solid var(--color-ink-950);
    border-radius: 0.55rem;
    color: white;
    background: var(--color-ink-950);
    padding: 0.38rem 0.55rem;
    font-family: var(--font-sans);
    font-size: 0.64rem;
    font-weight: 720;
    line-height: 1.3;
    opacity: 0;
    pointer-events: none;
    content: attr(data-meaning);
    transform: translate(-50%, 0.2rem);
    transition:
      opacity 130ms ease,
      transform 130ms ease;
  }
  .glossary-word:focus-visible::after {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  .reading-hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    margin: 1.1rem auto 0;
    color: var(--color-ink-800);
    font-size: 0.66rem;
    line-height: 1.4;
    text-align: center;
  }
  .reading-hint :global(svg) {
    flex: 0 0 auto;
    color: var(--color-cobalt-700);
  }
  .tool-panel {
    width: min(100%, 46rem);
    margin: 1rem auto 0;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.55rem 1.1rem 0.55rem 0.55rem;
    background: var(--color-paper-50);
    padding: 0.8rem;
  }
  .tool-panel > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
  }
  .tool-panel header span {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.54rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .tool-panel h2 {
    margin: 0.15rem 0 0;
    font-size: 0.9rem;
    font-weight: 860;
  }
  .tool-panel header button {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border: 1px solid var(--color-line);
    border-radius: 999px;
  }
  .word-list {
    display: flex;
    max-height: 10rem;
    flex-wrap: wrap;
    gap: 0.35rem;
    overflow-y: auto;
    margin-top: 0.7rem;
  }
  .word-list button {
    min-height: 2.75rem;
    border: 1px solid var(--color-line);
    border-radius: 0.65rem;
    background: var(--color-paper-100);
    padding: 0.5rem 0.65rem;
    font-family: var(--font-reader);
    font-size: 0.76rem;
  }
  .sentence-list {
    display: grid;
    max-height: 14rem;
    gap: 0.4rem;
    overflow-y: auto;
    margin-top: 0.7rem;
  }
  .sentence-list button {
    display: grid;
    min-height: 3rem;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--color-line);
    border-radius: 0.7rem;
    background: var(--color-paper-100);
    padding: 0.65rem;
    font-family: var(--font-reader);
    font-size: 0.72rem;
    line-height: 1.45;
    text-align: left;
  }
  .exercise-stage {
    display: grid;
    min-height: 100%;
    place-items: center;
    padding: 1.25rem 1rem 2rem;
  }
  .episode-complete {
    justify-items: start;
  }
  .complete-icon {
    display: grid;
    width: 4rem;
    height: 4rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 1.15rem;
    color: var(--color-mint-700);
    background: var(--color-mint-200);
    box-shadow: 4px 4px 0 rgb(21 25 28 / 0.12);
  }
  .episode-complete dl {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(3, 1fr);
    margin: 1.25rem 0 0;
    border-block: 1px solid var(--color-line);
    padding-block: 0.8rem;
  }
  .episode-complete dl div {
    display: grid;
    gap: 0.15rem;
    border-left: 1px solid var(--color-line);
    padding-left: 0.75rem;
  }
  .episode-complete dl div:first-child {
    border-left: 0;
    padding-left: 0;
  }
  .episode-complete dt {
    color: var(--color-ink-600);
    font-size: 0.64rem;
  }
  .episode-complete dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 900;
  }
  .selection-toolbar {
    position: absolute;
    right: 0.6rem;
    bottom: calc(5.2rem + var(--safe-bottom));
    left: 0.6rem;
    z-index: 8;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.8rem;
    color: white;
    background: var(--color-ink-950);
    padding: 0.4rem;
    box-shadow: 0 10px 35px rgb(21 25 28 / 0.25);
    opacity: 1;
    transform: translateY(0) scale(1);
    transform-origin: bottom center;
    transition:
      opacity 150ms var(--ease-out-emil),
      transform 150ms var(--ease-out-emil);
  }
  .selection-toolbar[data-closing] {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
    transition-duration: 120ms;
    transition-timing-function: var(--ease-in-out-emil);
  }
  @starting-style {
    .selection-toolbar {
      opacity: 0;
      transform: translateY(6px) scale(0.98);
    }
  }
  .selection-toolbar > span {
    overflow: hidden;
    padding-left: 0.35rem;
    color: rgb(255 255 255 / 0.62);
    font-family: var(--font-reader);
    font-size: 0.62rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .selection-toolbar button {
    display: inline-flex;
    min-height: 2.6rem;
    align-items: center;
    gap: 0.3rem;
    border-radius: 0.58rem;
    background: rgb(255 255 255 / 0.1);
    padding: 0.45rem 0.55rem;
    font-size: 0.72rem;
    font-weight: 800;
  }
  :global(html[data-motion='reduced']) .selection-toolbar {
    transform: none;
    transition-property: opacity;
    transition-duration: 120ms !important;
  }
  :global(html[data-motion='reduced']) .selection-toolbar[data-closing] {
    transform: none;
  }
  @starting-style {
    :global(html[data-motion='reduced']) .selection-toolbar {
      opacity: 0;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .glossary-word::after {
      transform: translate(-50%, 0);
      transition: none;
    }
    .selection-toolbar {
      transform: none;
      transition-property: opacity;
      transition-duration: 120ms !important;
    }
    .selection-toolbar[data-closing] {
      transform: none;
    }
    @starting-style {
      .selection-toolbar {
        opacity: 0;
        transform: none;
      }
    }
  }
  .reader-footer {
    z-index: 4;
    display: flex;
    min-height: calc(4.35rem + var(--safe-bottom));
    align-items: center;
    justify-content: space-between;
    gap: 0.55rem;
    border-top: 1px solid var(--color-ink-950);
    background: color-mix(in srgb, var(--color-paper-50) 95%, transparent);
    padding: 0.65rem 0.75rem calc(0.65rem + var(--safe-bottom));
    backdrop-filter: blur(16px);
  }
  .quiet-action,
  .main-action {
    display: inline-flex;
    min-height: 2.85rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border-radius: 0.75rem;
    padding: 0.65rem 0.8rem;
    font-size: 0.7rem;
    font-weight: 830;
  }
  .quiet-action {
    border: 1px solid var(--color-line);
    background: var(--color-paper-50);
  }
  .main-action {
    min-width: 8.6rem;
    color: white;
    background: var(--color-ink-950);
  }
  .main-action:disabled {
    opacity: 0.4;
  }
  .icon-action:disabled {
    opacity: 0.3;
  }
  .reader-tools {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .reader-tools button {
    display: flex;
    min-width: 3.3rem;
    min-height: 2.75rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.1rem;
    border-radius: 0.65rem;
    color: var(--color-ink-600);
    font-size: 0.53rem;
    font-weight: 760;
  }
  .reader-tools button.active {
    color: var(--color-ink-950);
    background: var(--book-soft);
  }
  .footer-note {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.61rem;
    font-weight: 800;
  }
  .footer-error {
    position: absolute;
    right: 0.75rem;
    bottom: calc(4.8rem + var(--safe-bottom));
    left: 0.75rem;
    margin: 0;
    border: 1px solid var(--color-coral-700);
    border-radius: 0.65rem;
    color: var(--color-coral-700);
    background: var(--color-coral-50);
    padding: 0.65rem;
    font-size: 0.68rem;
  }
  .reader-loading,
  .reader-missing {
    display: grid;
    min-height: 100dvh;
    place-items: center;
    padding: 1rem;
  }
  .reader-missing h1 {
    margin: 0.4rem 0 1rem;
    font-size: 2rem;
    letter-spacing: -0.04em;
  }
  .locked-reader {
    max-width: 38rem;
    border: 1px dashed var(--color-ink-950);
    border-radius: 0.7rem 1.5rem 0.7rem 0.7rem;
    background: var(--color-paper-50);
    padding: 1.5rem;
    box-shadow: 5px 5px 0 var(--color-ink-950);
  }
  .locked-reader > p:not(.kicker) {
    color: var(--color-ink-600);
    line-height: 1.55;
  }
  .locked-icon {
    display: grid;
    width: 3.5rem;
    height: 3.5rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.7rem 1.2rem 0.7rem 0.7rem;
    background: var(--color-cobalt-100);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .locked-actions {
    display: flex;
    gap: 0.65rem;
    flex-wrap: wrap;
    margin-top: 1.25rem;
  }
  .accent-butter {
    --book-accent: var(--color-butter-200);
    --book-soft: #fff4cf;
  }
  .accent-mint {
    --book-accent: var(--color-mint-200);
    --book-soft: var(--color-mint-50);
  }
  .accent-sky {
    --book-accent: var(--color-sky-200);
    --book-soft: var(--color-sky-50);
  }
  .accent-cobalt {
    --book-accent: var(--color-cobalt-300);
    --book-soft: #e6eaff;
  }
  .accent-coral {
    --book-accent: var(--color-coral-200);
    --book-soft: var(--color-coral-50);
  }
  @media (min-width: 640px) {
    .reader-header {
      padding-inline: 1rem;
    }
    .reader-progress {
      width: 7rem;
    }
    .reading-stage {
      padding: 1.25rem 1.5rem 2rem;
    }
    .story-text p {
      font-size: 1.1875rem;
    }
    .reader-footer {
      padding-inline: 1rem;
    }
    .selection-toolbar {
      right: 1rem;
      left: 1rem;
      width: min(40rem, calc(100vw - 2rem));
      margin-inline: auto;
    }
  }
  @media (min-width: 1024px) {
    .reader-header {
      min-height: 4.4rem;
      grid-template-columns: auto minmax(0, 1fr) 10rem;
      padding-inline: 1.25rem;
    }
    .reader-title strong {
      font-size: 0.86rem;
    }
    .reading-stage {
      align-content: center;
      padding-block: 1.5rem;
    }
    .story-text {
      margin-top: 0.75rem;
      padding: 2.2rem 2.8rem;
    }
    .story-text p {
      font-size: 1.25rem;
      line-height: 1.65;
    }
    .reader-footer {
      min-height: 4.6rem;
      padding-inline: 1.25rem;
    }
    .main-action {
      min-width: 10.5rem;
    }
  }
  @media (hover: hover) and (pointer: fine) {
    .glossary-word:hover::after {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    .story-word:hover {
      background: var(--color-acid-100);
    }
    .main-action:hover,
    .quiet-action:hover {
      transform: translateY(-1px);
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .story-text {
      animation: page-in 210ms var(--ease-out-emil) both;
    }
    @keyframes page-in {
      from {
        opacity: 0;
        clip-path: inset(0 0 8% 0);
        transform: translateY(7px);
      }
      to {
        opacity: 1;
        clip-path: inset(0);
        transform: translateY(0);
      }
    }
  }
  :global(html[data-motion='reduced']) .reader-scroll {
    scroll-behavior: auto;
  }
</style>
