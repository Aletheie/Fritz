<script lang="ts">
  import { page } from '$app/state';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { bookAccents } from '$lib/components/stories/book-accents.ts';
  import ReaderToolPanel from '$lib/components/stories/ReaderToolPanel.svelte';
  import StoryExercise from '$lib/components/stories/StoryExercise.svelte';
  import StoryPageText from '$lib/components/stories/StoryPageText.svelte';
  import StorySelectionSheet from '$lib/components/stories/StorySelectionSheet.svelte';
  import StorySelectionToolbar from '$lib/components/stories/StorySelectionToolbar.svelte';
  import StoryWordSheet from '$lib/components/stories/StoryWordSheet.svelte';
  import { storyBookIsUnlocked, storyBookUnlockReason } from '$lib/domain/course/story-unlocks.ts';
  import { errorText } from '$lib/domain/errors.ts';
  import { loadStoryBook, storyEpisodePages } from '$lib/domain/stories/catalog.ts';
  import {
    normalizeStoryWord,
    storyPageSentences,
    uniquePageWords,
  } from '$lib/domain/stories/engine.ts';
  import {
    storyKnownFormsFromNotes,
    storySupportTokens,
    type StoryReaderToken,
  } from '$lib/domain/stories/reading-support.ts';
  import { storyEpisodeSummary, storyEpisodeTitle } from '$lib/i18n/stories.ts';
  import { appStore, motherTongue, tr } from '$lib/state/app';
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
  import { onDestroy, onMount, tick, untrack } from 'svelte';

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

  let book: StoryBook | undefined = $state.raw();
  let requestedBookId = $state('');
  let bookLoading = $state(true);
  let bookLoadError = $state('');
  let stage: ReaderStage = $state('intro');
  let currentPageIndex = $state(0);
  let useOriginal = $state(false);
  let activeCheckpoint: StoryCheckpoint | undefined = $state.raw();
  let initializedKey = $state('');
  let completing = $state(false);
  let completionError = $state('');
  let readingArticle: HTMLElement | undefined = $state();
  let wordMenuOpen = $state(false);
  let sentenceMenuOpen = $state(false);
  let selectedWord = $state('');
  let selectedEntry: StoryGlossaryEntry | undefined = $state.raw();
  let selectedSentence = $state('');
  let wordSheetOpen = $state(false);
  let selectionSheetOpen = $state(false);
  let selectionAction: 'translate' | 'explain' = $state('translate');
  let selectedText = $state('');
  let selectedContext = $state('');
  let suppressNextClick = false;
  let longPressTimer: ReturnType<typeof setTimeout> | undefined;
  const selectionToolbarExitMs = 120;
  let selectionToolbarMounted = $state(false);
  let selectionToolbarClosing = $state(false);
  let selectionToolbarText = $state('');
  let selectionToolbarCloseTimer: ReturnType<typeof setTimeout> | undefined;

  function unlockReason(): string {
    if (!book) return '';
    return $motherTongue === 'cs'
      ? storyBookUnlockReason(book.id)
      : 'Finish the previous chapter test to unlock this book.';
  }

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
        bookLoadError = errorText(error, $motherTongue, {
          cs: 'Knihu se nepodařilo načíst.',
          en: 'The book could not be loaded.',
        });
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
    const scrollOwner = readingArticle?.closest('[data-reader-scroll]');
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
      completionError = errorText(value, $motherTongue, {
        cs: 'Dokončení se nepodařilo uložit.',
        en: 'The completed episode could not be saved.',
      });
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

  const iconButton =
    'grid size-11 place-items-center rounded-[0.78rem] border border-line bg-paper-50';
  const action =
    'inline-flex min-h-[2.85rem] items-center justify-center gap-[0.4rem] rounded-xl px-[0.8rem] py-[0.65rem] text-[0.7rem] font-[830] fine-hover:[transform:translateY(-1px)]';
  const quietAction = `${action} border border-line bg-paper-50`;
  const mainAction = `${action} min-w-[8.6rem] bg-ink-950 text-white disabled:opacity-40 lg:min-w-[10.5rem]`;
  const centeredStage = 'mx-auto grid min-h-full w-[min(100%,42rem)] content-center px-4 py-8';
  const stageTitle =
    'mt-[0.45rem] mb-0 max-w-[15ch] text-[clamp(2.15rem,10vw,4.4rem)] leading-[0.92] font-[920] tracking-[-0.04em]';
  const stageKicker =
    'mt-[1.2rem] mb-0 font-mono text-[0.62rem] font-[850] tracking-[0.07em] text-ink-800 uppercase';
  const stageText = 'mt-[0.9rem] mb-0 max-w-[34rem] text-[0.95rem] leading-[1.55] text-ink-800';
  const notice = 'grid min-h-dvh place-items-center p-4';
  const noticeTitle = 'mt-[0.4rem] mb-4 text-[2rem] tracking-[-0.04em]';
  const routeBookId = $derived(page.params.bookId ?? '');
  $effect.pre(() => {
    const bookId = routeBookId;
    untrack(() => {
      if (bookId !== requestedBookId) void openBook(bookId);
    });
  });
  const episode = $derived(
    book?.episodes.find((candidate) => candidate.id === page.params.episodeId),
  );
  const pages = $derived(book && episode ? storyEpisodePages(book, episode.id, useOriginal) : []);
  const currentPage = $derived(pages[currentPageIndex]);
  const progress = $derived(book ? $appStore.course.storyBooks[book.id] : undefined);
  const unlocked = $derived(book ? storyBookIsUnlocked($appStore.course, book.id) : false);
  let pagePercent = $derived(
    book && currentPage ? Math.round((currentPage.number / book.screenCount) * 100) : 0,
  );
  const nextEpisode = $derived(book && episode ? book.episodes[episode.index + 1] : undefined);
  const readerPage = $derived(
    buildReaderPageModel(
      currentPage,
      book?.glossary ?? [],
      storyKnownFormsFromNotes($appStore.notes),
    ),
  );
  $effect.pre(() => {
    const text = selectedText;
    const readerStage = stage;
    untrack(() => syncSelectionToolbar(text, readerStage));
  });
  $effect.pre(() => {
    if ($appStore.ready && book && episode) {
      const key = `${book.id}:${episode.id}`;
      if (key !== untrack(() => initializedKey)) untrack(() => initializeReader(key));
    }
  });
</script>

<svelte:head>
  <title
    >{book && episode
      ? `${storyEpisodeTitle(episode, $motherTongue)} · ${book.title}`
      : $tr('Čtení', 'Reading')} · Fritz</title
  >
</svelte:head>

{#if !$appStore.ready || bookLoading}
  <div class={notice}>
    <LoadingState label={$tr('Připravuji stránku…', 'Preparing the page…')} />
  </div>
{:else if bookLoadError}
  <section class={notice}>
    <div>
      <p class="kicker">{$tr('Knihu se nepodařilo načíst', 'The book could not be loaded')}</p>
      <h1 class={noticeTitle}>
        {$tr('Zkus knihu otevřít znovu.', 'Try opening the book again.')}
      </h1>
      <p>{bookLoadError}</p>
      <button class="btn-base btn-primary" type="button" onclick={() => void openBook(routeBookId)}>
        {$tr('Zkusit znovu', 'Try again')}
      </button>
    </div>
  </section>
{:else if !book || !episode}
  <section class={notice}>
    <div>
      <p class="kicker">{$tr('Epizoda nenalezena', 'Episode not found')}</p>
      <h1 class={noticeTitle}>
        {$tr('Tahle stránka do knihy nepatří.', 'This page does not belong in the book.')}
      </h1>
      <a class="btn-base btn-primary" href="/stories/"
        ><ArrowLeft size={18} /> {$tr('Zpět do čítárny', 'Back to the reading room')}</a
      >
    </div>
  </section>
{:else if !unlocked}
  <section class={notice}>
    <div
      class="max-w-[38rem] rounded-[0.7rem_1.5rem_0.7rem_0.7rem] border border-dashed border-ink-950 bg-paper-50 p-6 shadow-[5px_5px_0_var(--color-ink-950)]"
    >
      <span
        class="grid size-14 place-items-center rounded-[0.7rem_1.2rem_0.7rem_0.7rem] border border-ink-950 bg-cobalt-100 shadow-[3px_3px_0_var(--color-ink-950)]"
        ><LockKeyhole size={28} /></span
      >
      <p class="kicker">
        {$tr('Bonusová četba · zatím zamčeno', 'Bonus reading · locked for now')}
      </p>
      <h1 class={noticeTitle}>
        {$tr(
          `${book.title} se odemkne po testu kapitoly.`,
          `${book.title} unlocks after the chapter test.`,
        )}
      </h1>
      <p class="leading-[1.55] text-ink-600">{unlockReason()}</p>
      <div class="mt-5 flex flex-wrap gap-[0.65rem]">
        <a class="btn-base btn-primary" href="/"
          ><ArrowRight size={18} /> {$tr('Pokračovat v cestě', 'Continue on the path')}</a
        >
        <a class="btn-base btn-secondary" href="/stories/"
          ><ArrowLeft size={18} /> {$tr('Čítárna', 'Reading room')}</a
        >
      </div>
    </div>
  </section>
{:else}
  <section
    class={[
      'relative grid h-dvh w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-paper-100 text-ink-950 [body:has(&)]:overflow-hidden',
      bookAccents[book.accent] ?? bookAccents.sky,
    ]}
  >
    <header
      class="z-3 grid min-h-[calc(3.9rem+var(--safe-top))] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.65rem] border-b border-ink-950 bg-[color-mix(in_srgb,var(--color-paper-50)_94%,transparent)] px-3 pt-(--safe-top) backdrop-blur-[16px] min-[640px]:px-4 lg:min-h-[4.4rem] lg:grid-cols-[auto_minmax(0,1fr)_10rem] lg:px-5"
    >
      <a
        class={iconButton}
        href={`/stories/${book.id}/`}
        aria-label={$tr('Zavřít čtečku', 'Close reader')}><X size={20} /></a
      >
      <div class="grid min-w-0 gap-[0.1rem]">
        <span class="font-mono text-[0.54rem] font-[820] tracking-[0.04em] text-ink-800 uppercase"
          >{book.level} · {$tr('Epizoda', 'Episode')} {episode.number}/{book.episodeCount}</span
        >
        <strong class="truncate text-[0.82rem] font-[850] lg:text-[0.86rem]"
          >{storyEpisodeTitle(episode, $motherTongue)}</strong
        >
      </div>
      {#if stage === 'reading' || stage === 'exercise'}
        <div
          class="grid w-[4.2rem] gap-1 min-[640px]:w-28"
          aria-label={$tr(
            `Strana ${currentPage?.number ?? 0} z ${book.screenCount}`,
            `Page ${currentPage?.number ?? 0} of ${book.screenCount}`,
          )}
        >
          <span class="justify-self-end font-mono text-[0.57rem] font-[850]"
            >{currentPage?.number ?? 0}/{book.screenCount}</span
          >
          <div class="h-[0.3rem] overflow-hidden rounded-full bg-paper-200">
            <i class="block h-full rounded-[inherit] bg-cobalt-700" style:width={`${pagePercent}%`}
            ></i>
          </div>
        </div>
      {:else}
        <span
          class="flex items-center gap-[0.28rem] font-mono text-[0.58rem] font-extrabold text-ink-800"
          ><Clock3 size={14} /> {episode.minutes} min</span
        >
      {/if}
    </header>

    <div
      class="min-h-0 overflow-y-auto overscroll-contain scroll-smooth motion-off:scroll-auto"
      data-reader-scroll
    >
      {#if stage === 'intro'}
        <section class={centeredStage}>
          <div
            class="grid size-[3.4rem] place-items-center rounded-[0.9rem] border border-ink-950 bg-(--book-accent) font-mono text-[0.78rem] font-black shadow-[3px_3px_0_rgb(21_25_28/0.13)]"
          >
            {String(episode.number).padStart(2, '0')}
          </div>
          <p class={stageKicker}>{book.title}</p>
          <h1 class={stageTitle}>{storyEpisodeTitle(episode, $motherTongue)}</h1>
          <p class={stageText}>{storyEpisodeSummary(episode, $motherTongue)}</p>
          <div
            class="mt-5 flex items-center gap-[0.7rem] rounded-[0.5rem_1rem_0.5rem_0.5rem] border border-ink-950 bg-(--book-soft) p-[0.85rem]"
          >
            <BookOpen class="flex-none" size={21} />
            <div class="grid gap-[0.15rem]">
              <strong class="text-[0.78rem]">{$tr('4 krátké stránky', '4 short pages')}</strong
              ><span class="text-[0.67rem] text-ink-800"
                >{$tr(
                  '2 příběhové výzvy · přibližně 5 minut',
                  '2 story challenges · about 5 minutes',
                )}</span
              >
            </div>
          </div>
          <ul
            class="mt-4 mb-0 grid list-none gap-2 p-0 [&_svg]:flex-none [&_svg]:text-cobalt-700 [&>li]:flex [&>li]:items-center [&>li]:gap-2 [&>li]:text-[0.78rem] [&>li]:text-ink-800"
          >
            <li>
              <MousePointer2 size={16} />
              {$tr('Klepni nebo podrž libovolné slovo.', 'Tap or press and hold any word.')}
            </li>
            <li>
              <Type size={16} />
              {$tr(
                'Podtržená slova mají připravený překlad. Klepnutím ho zobrazíš.',
                'Underlined words have a translation ready. Tap to see it.',
              )}
            </li>
            <li>
              <Languages size={16} />
              {$tr(
                'Označ větu a nech si ji vysvětlit.',
                'Select a sentence and ask for an explanation.',
              )}
            </li>
          </ul>
        </section>
      {:else if stage === 'reading' && currentPage}
        <section
          class="mx-auto grid min-h-full w-[min(100%,62rem)] content-start p-4 min-[640px]:px-6 min-[640px]:pt-5 min-[640px]:pb-8 lg:content-center lg:py-6"
          data-testid="reading-stage"
        >
          <div
            class="mx-auto flex min-h-8 flex-wrap items-center gap-[0.45rem] font-mono text-[0.56rem] font-[760] text-ink-800 [&>span+span]:before:mr-[0.45rem] [&>span+span]:before:content-['·']"
          >
            <span>{$tr('Fragment', 'Part')} {currentPageIndex + 1}/{episode.pages.length}</span>
            {#if currentPage.sectionTitle}<span>{currentPage.sectionTitle}</span>{/if}
            {#if readerPage.supportCount > 0}<span class="text-cobalt-700">
                {pageSupportLabel(readerPage.supportCount)}
              </span>{/if}
            {#if book.originalPages}
              <button
                class="ml-auto min-h-8 rounded-full border border-line bg-paper-50 px-[0.58rem] py-[0.35rem] text-[0.7rem] font-extrabold"
                type="button"
                aria-pressed={useOriginal}
                onclick={toggleEdition}
              >
                {useOriginal
                  ? $tr('Původní pravopis', 'Original spelling')
                  : $tr('Lehce modernizováno', 'Lightly modernised')}
              </button>
            {/if}
          </div>

          <StoryPageText
            rows={currentPage.paragraphs.map((_, index) => readerPage.tokenRows[index] ?? [])}
            level={book.level}
            bind:article={readingArticle}
            onclick={handleTextClick}
            onpointerdown={startLongPress}
            onpointerup={finishPointerInteraction}
            onpointercancel={clearLongPress}
          />

          <p
            class="mx-auto mt-[1.1rem] mb-0 flex items-center justify-center gap-[0.35rem] text-center text-[0.66rem] leading-[1.4] text-ink-800"
          >
            <Sparkles class="flex-none text-cobalt-700" size={14} />
            <span
              >{$tr(
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
            <ReaderToolPanel
              id="word-panel-title"
              kicker={$tr('Klávesová alternativa', 'Keyboard alternative')}
              title={$tr('Vyber slovo ze stránky', 'Choose a word from the page')}
              closeLabel={$tr('Zavřít výběr slov', 'Close word picker')}
              onclose={toggleWordMenu}
            >
              <div class="mt-[0.7rem] flex max-h-40 flex-wrap gap-[0.35rem] overflow-y-auto">
                {#each readerPage.words as word}<button
                    class="min-h-11 rounded-[0.65rem] border border-line bg-paper-100 px-[0.65rem] py-2 font-(family-name:--font-reader) text-[0.76rem]"
                    type="button"
                    lang="de"
                    onclick={() => openWord(word)}>{word}</button
                  >{/each}
              </div>
            </ReaderToolPanel>
          {/if}

          {#if sentenceMenuOpen}
            <ReaderToolPanel
              id="sentence-panel-title"
              kicker={$tr('Nástroje k větě', 'Sentence tools')}
              title={$tr('Vyber celou větu', 'Choose a complete sentence')}
              closeLabel={$tr('Zavřít výběr vět', 'Close sentence picker')}
              onclose={toggleSentenceMenu}
            >
              <div class="mt-[0.7rem] grid max-h-56 gap-[0.4rem] overflow-y-auto">
                {#each readerPage.sentenceOptions as sentence}<button
                    class="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[0.7rem] border border-line bg-paper-100 p-[0.65rem] text-left font-(family-name:--font-reader) text-[0.72rem] leading-[1.45]"
                    type="button"
                    lang="de"
                    onclick={() => openSelection(sentence, 'explain')}
                    >{sentence}<ArrowRight size={16} /></button
                  >{/each}
              </div>
            </ReaderToolPanel>
          {/if}
        </section>
      {:else if stage === 'exercise' && activeCheckpoint}
        <section class="grid min-h-full place-items-center px-4 pt-5 pb-8">
          <StoryExercise
            exercise={activeCheckpoint.exercise}
            onanswer={recordCheckpoint}
            oncontinue={continueAfterExercise}
          />
        </section>
      {:else if stage === 'complete'}
        <section class="{centeredStage} completion-arrival justify-items-start">
          <span
            class="grid size-16 place-items-center rounded-[1.15rem] border border-ink-950 bg-mint-200 text-mint-700 shadow-[4px_4px_0_rgb(21_25_28/0.12)]"
            ><CheckCircle2 size={32} /></span
          >
          <p class={stageKicker}>{$tr('Epizoda dokončena', 'Episode complete')}</p>
          <h1 class={stageTitle}>{storyEpisodeTitle(episode, $motherTongue)}</h1>
          <p class={stageText}>
            {$tr(
              'Epizodu máš přečtenou. Uložená slovíčka najdeš v běžném procvičování.',
              'You’ve finished the episode. Your saved words will appear in regular practice.',
            )}
          </p>
          <dl
            class="mt-5 mb-0 grid w-full grid-cols-3 border-y border-line py-[0.8rem] [&_dd]:m-0 [&_dd]:font-mono [&_dd]:text-[0.75rem] [&_dd]:font-black [&_dt]:text-[0.64rem] [&_dt]:text-ink-600 [&>div]:grid [&>div]:gap-[0.15rem] [&>div]:border-l [&>div]:border-line [&>div]:pl-3 [&>div:first-child]:border-l-0 [&>div:first-child]:pl-0"
          >
            <div>
              <dt>{$tr('Obrazovky', 'Screens')}</dt>
              <dd>{episode.pages.length}</dd>
            </div>
            <div>
              <dt>{$tr('Zastávky', 'Checkpoints')}</dt>
              <dd>{episode.checkpoints.length}</dd>
            </div>
            <div>
              <dt>{$tr('Celkem', 'Overall')}</dt>
              <dd>{progress?.completedEpisodeIds.length ?? 0}/{book.episodeCount}</dd>
            </div>
          </dl>
        </section>
      {/if}
    </div>

    {#if selectionToolbarMounted}
      <StorySelectionToolbar
        text={selectionToolbarText}
        closing={selectionToolbarClosing}
        onselect={(action) => openSelection(selectionToolbarText, action)}
      />
    {/if}

    <footer
      class="z-4 flex min-h-[calc(4.35rem+var(--safe-bottom))] items-center justify-between gap-[0.55rem] border-t border-ink-950 bg-[color-mix(in_srgb,var(--color-paper-50)_95%,transparent)] px-3 pt-[0.65rem] pb-[calc(0.65rem+var(--safe-bottom))] backdrop-blur-[16px] min-[640px]:px-4 lg:min-h-[4.6rem] lg:px-5"
    >
      {#if stage === 'intro'}
        <a class={quietAction} href={`/stories/${book.id}/`}
          ><ChevronLeft size={18} /> {$tr('Seznam epizod', 'Episode list')}</a
        >
        <button class={mainAction} type="button" onclick={() => void startReading()}>
          {progress?.currentEpisodeId === episode.id && progress.lastPage > episode.pages[0].number
            ? $tr('Pokračovat', 'Continue')
            : $tr('Začít číst', 'Start reading')}
          <ArrowRight size={18} />
        </button>
      {:else if stage === 'reading'}
        <button
          class="{iconButton} disabled:opacity-30"
          type="button"
          aria-label={$tr('Předchozí stránka', 'Previous page')}
          disabled={currentPageIndex === 0}
          onclick={() => void previousPage()}><ChevronLeft size={21} /></button
        >
        <div class="flex items-center gap-1">
          {#each [{ open: wordMenuOpen, toggle: toggleWordMenu, Icon: List, label: $tr('Slovo', 'Word') }, { open: sentenceMenuOpen, toggle: toggleSentenceMenu, Icon: Languages, label: $tr('Věta', 'Sentence') }] as tool}
            <button
              class={[
                'flex min-h-11 min-w-[3.3rem] flex-col items-center justify-center gap-[0.1rem] rounded-[0.65rem] text-[0.53rem] font-[760]',
                tool.open ? 'bg-(--book-soft) text-ink-950' : 'text-ink-600',
              ]}
              type="button"
              onclick={tool.toggle}><tool.Icon size={17} /><span>{tool.label}</span></button
            >
          {/each}
        </div>
        <button
          class={mainAction}
          type="button"
          disabled={completing}
          onclick={() => void advance()}
        >
          {currentPageIndex === pages.length - 1
            ? $tr('Dokončit', 'Finish')
            : $tr('Pokračovat', 'Continue')}
          <ArrowRight size={18} />
        </button>
      {:else if stage === 'exercise'}
        <span
          class="flex w-full items-center justify-center gap-[0.35rem] font-mono text-[0.61rem] font-extrabold text-ink-600"
          ><Sparkles size={15} />
          {$tr('Zastávka', 'Checkpoint')}
          {activeCheckpoint === episode.checkpoints[0] ? '1' : '2'}
          {$tr('ze', 'of')} 2</span
        >
      {:else if stage === 'complete'}
        <a class={quietAction} href={`/stories/${book.id}/`}
          ><ChevronLeft size={18} /> {$tr('Přehled knihy', 'Book overview')}</a
        >
        {#if nextEpisode}
          <a class={mainAction} href={`/stories/${book.id}/${nextEpisode.id}/`}
            >{$tr('Další epizoda', 'Next episode')} <ArrowRight size={18} /></a
          >
        {:else}
          <a class={mainAction} href="/stories/"
            >{$tr('Zpět do čítárny', 'Back to the reading room')} <ArrowRight size={18} /></a
          >
        {/if}
      {/if}
      {#if completionError}<p
          class="absolute inset-x-3 bottom-[calc(4.8rem+var(--safe-bottom))] m-0 rounded-[0.65rem] border border-coral-700 bg-coral-50 p-[0.65rem] text-[0.68rem] text-coral-700"
          role="alert"
        >
          {completionError}
        </p>{/if}
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
