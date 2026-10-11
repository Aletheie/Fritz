<script lang="ts">
  import LoadingState from '$lib/components/LoadingState.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import {
    courseSummaryForLessons,
    grammarCategories,
    grammarLessons,
    grammarLevelForLesson,
    grammarLessonsForLevel,
    lessonProgress,
    lessonsForCategory,
    recommendedGrammarLesson,
  } from '$lib/domain/course/grammar.ts';
  import { DETAILED_CEFR_LEVELS } from '$lib/domain/levels.ts';
  import { grammarCategoryCopy, grammarLessonCopy } from '$lib/i18n/grammar.ts';
  import { appStore, motherTongue, tr } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import BookOpenCheck from '@lucide/svelte/icons/book-open-check';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Play from '@lucide/svelte/icons/play';
  import Search from '@lucide/svelte/icons/search';
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Star from '@lucide/svelte/icons/star';
  import X from '@lucide/svelte/icons/x';
  import { onMount } from 'svelte';

  import type { GrammarLesson } from '$lib/domain/course/grammar.ts';
  import type { CourseProgress, DetailedCefrLevel } from '$lib/domain/types.ts';

  type StatusFilter = 'all' | 'open' | 'active' | 'done';

  let searchQuery = $state('');
  let levelFilter: DetailedCefrLevel | 'all' = $state('all');
  let statusFilter: StatusFilter = $state('all');
  let categoryFilter = $state('all');

  const accents: Record<string, string> = {
    sky: '[--category-accent:var(--color-sky-200)]',
    coral: '[--category-accent:var(--color-coral-200)]',
    orange: '[--category-accent:var(--color-orange-100)]',
    mint: '[--category-accent:var(--color-mint-200)]',
    cobalt: '[--category-accent:var(--color-cobalt-300)]',
  };
  const accent = (name: string) => accents[name] ?? '[--category-accent:var(--color-acid-500)]';

  const pill =
    'inline-flex items-center gap-[0.22rem] rounded-full bg-paper-100 px-[0.45rem] py-[0.28rem] font-mono text-[0.55rem] font-bold';
  const field =
    'relative min-h-11 min-w-0 items-center rounded-[0.55rem] border border-ink-950 bg-paper-50 focus-within:border-cobalt-700 focus-within:shadow-[0_0_0_3px_rgb(49_83_199/0.12)]';
  const selectField = `${field} grid grid-cols-[minmax(0,1fr)_auto] px-[0.65rem] py-1`;
  const selectLabel = 'absolute top-[0.3rem] left-[0.65rem] text-[0.48rem] font-[750] text-ink-600';
  const select =
    'z-1 h-full w-full min-w-0 appearance-none border-0 bg-transparent pt-[0.72rem] pr-[1.35rem] pb-[0.05rem] pl-0 text-[0.7rem] font-[760] text-ink-950 outline-0';
  const darkButton =
    'border border-ink-950 bg-ink-950 text-white transition-[transform,background-color] duration-160 ease-out-emil fine-hover:bg-cobalt-700 fine-hover:[transform:translateY(-1px)] motion-reduce:transition-none';
  const sidebarDot =
    'grid size-7 flex-none place-items-center rounded-[0.45rem] border border-ink-950 font-mono text-[0.46rem] font-[850]';

  const categoryById = new Map(grammarCategories.map((category) => [category.id, category]));

  onMount(() => void appStore.initialize());

  function normalizeSearch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase('cs');
  }

  function matchesSearch(lesson: GrammarLesson, search: string): boolean {
    const query = normalizeSearch(search.trim());
    if (!query) return true;
    const category = categoryById.get(lesson.categoryId);
    const lessonCopy = grammarLessonCopy($motherTongue, lesson);
    const categoryCopy = category ? grammarCategoryCopy($motherTongue, category) : undefined;
    const haystack = normalizeSearch(
      [
        lesson.title,
        lesson.shortTitle,
        lesson.subtitle,
        lesson.concept,
        lesson.formula,
        category?.title,
        category?.description,
        lessonCopy.title,
        lessonCopy.shortTitle,
        lessonCopy.subtitle,
        lessonCopy.concept,
        categoryCopy?.title,
        categoryCopy?.description,
        ...lesson.questions.map((question) => question.skill),
      ].join(' '),
    );
    return haystack.includes(query);
  }

  function matchesLevel(lesson: GrammarLesson, selectedFilter: DetailedCefrLevel | 'all'): boolean {
    return selectedFilter === 'all' || grammarLevelForLesson(lesson) === selectedFilter;
  }

  function matchesStatus(
    lesson: GrammarLesson,
    selectedFilter: StatusFilter,
    courseProgress: CourseProgress,
  ): boolean {
    if (selectedFilter === 'all') return true;
    const progress = lessonProgress(courseProgress, lesson);
    if (selectedFilter === 'done') return progress.completed;
    if (selectedFilter === 'active') return progress.answered > 0 && !progress.completed;
    return progress.answered === 0;
  }

  function categoryLessons(categoryId: string): GrammarLesson[] {
    return filteredLessons.filter((lesson) => lesson.categoryId === categoryId);
  }

  function scopedCategoryLessons(categoryId: string): GrammarLesson[] {
    return catalogScopeLessons.filter((lesson) => lesson.categoryId === categoryId);
  }

  function categoryCompleted(categoryId: string): number {
    return scopedCategoryLessons(categoryId).filter(
      (lesson) => lessonProgress($appStore.course, lesson).completed,
    ).length;
  }

  function categoryMatchCount(categoryId: string): number {
    return matchingLessons.filter((lesson) => lesson.categoryId === categoryId).length;
  }

  function categoryPercent(categoryId: string): number {
    const total = scopedCategoryLessons(categoryId).length;
    return total === 0 ? 0 : Math.round((categoryCompleted(categoryId) / total) * 100);
  }

  function shouldOpenCategory(categoryId: string): boolean {
    return (
      categoryFilter !== 'all' ||
      searchQuery.trim().length > 0 ||
      levelFilter !== 'all' ||
      statusFilter !== 'all' ||
      categoryId === recommended.categoryId
    );
  }

  function clearFilters(): void {
    searchQuery = '';
    levelFilter = 'all';
    statusFilter = 'all';
    categoryFilter = 'all';
  }

  const selectedLevel = $derived($appStore.settings?.grammarLevel ?? 'A1.1');
  const availableLevels = $derived(DETAILED_CEFR_LEVELS);
  const profileLessons = $derived(grammarLessonsForLevel(selectedLevel));
  const catalogScopeLessons = $derived(levelFilter === 'all' ? profileLessons : grammarLessons);
  const catalogCategories = $derived(
    grammarCategories.filter(
      (category) => lessonsForCategory(category.id, catalogScopeLessons).length > 0,
    ),
  );
  $effect.pre(() => {
    if (
      categoryFilter !== 'all' &&
      !catalogCategories.some((category) => category.id === categoryFilter)
    ) {
      categoryFilter = 'all';
    }
  });
  const summary = $derived(courseSummaryForLessons($appStore.course, profileLessons));
  const recommended = $derived(recommendedGrammarLesson($appStore.course, profileLessons));
  const recommendedCopy = $derived(grammarLessonCopy($motherTongue, recommended));
  const recommendedProgress = $derived(lessonProgress($appStore.course, recommended));
  const courseComplete = $derived(summary.completedLessons === summary.totalLessons);
  const totalMinutes = $derived(profileLessons.reduce((sum, lesson) => sum + lesson.minutes, 0));
  const matchingLessons = $derived(
    catalogScopeLessons.filter(
      (lesson) =>
        matchesSearch(lesson, searchQuery) &&
        matchesLevel(lesson, levelFilter) &&
        matchesStatus(lesson, statusFilter, $appStore.course),
    ),
  );
  let filteredLessons = $derived(
    categoryFilter === 'all'
      ? matchingLessons
      : matchingLessons.filter((lesson) => lesson.categoryId === categoryFilter),
  );
  const visibleCategories = $derived(
    catalogCategories.filter(
      (category) =>
        (categoryFilter === 'all' || category.id === categoryFilter) &&
        filteredLessons.some((lesson) => lesson.categoryId === category.id),
    ),
  );
  let activeFilterCount = $derived(
    Number(searchQuery.trim().length > 0) +
      Number(levelFilter !== 'all') +
      Number(statusFilter !== 'all') +
      Number(categoryFilter !== 'all'),
  );
</script>

<svelte:head>
  <title>{$tr('Katalog gramatiky A1–C1', 'German grammar A1–C1')} · Fritz</title>
  <meta
    name="description"
    content={$tr(
      `${grammarLessons.length} krátkých lekcí německé gramatiky od A1.1 po C1.2 s vyhledáváním, filtry a okamžitou zpětnou vazbou.`,
      `${grammarLessons.length} short German grammar lessons from A1.1 to C1.2 with search, filters, and instant feedback.`,
    )}
  />
</svelte:head>

{#if !$appStore.ready}
  <LoadingState label={$tr('Připravuji katalog gramatiky…', 'Preparing the grammar catalog…')} />
{:else}
  <div class="@container/grammar-page mx-auto max-w-[78rem] pb-8">
    <header
      class="grid gap-4 @min-[58rem]/grammar-page:grid-cols-[minmax(0,1.75fr)_minmax(17rem,0.65fr)]"
    >
      <div
        class="rounded-[0.65rem_1.5rem_0.65rem_0.65rem] border border-ink-950 bg-ink-950 p-[1.35rem] text-white shadow-[6px_6px_0_rgb(21_25_28/0.12)] @min-[58rem]/grammar-page:px-7 @min-[58rem]/grammar-page:py-[1.6rem]"
      >
        <div
          class="inline-flex items-center gap-[0.45rem] text-[0.72rem] font-extrabold text-acid-500"
        >
          <BookOpenCheck size={16} />
          {$tr('Kurz gramatiky', 'German grammar')} · A1–C1
        </div>
        <h1
          class="mt-[0.65rem] max-w-[18ch] text-[2.25rem] leading-[0.98] font-[920] tracking-[-0.04em] text-balance @min-[58rem]/grammar-page:text-[2.75rem]"
        >
          {$tr('Procvič si německou gramatiku', 'Find the grammar you need')}
        </h1>
        <p
          class="mt-[0.8rem] max-w-[46rem] text-[0.88rem] leading-[1.55] text-pretty text-white/68"
        >
          {$tr(
            'Najdi pravidlo, které si chceš procvičit, nebo pokračuj v rozdělané lekci.',
            'Find a rule to practise or pick up an unfinished lesson.',
          )}
        </p>
        <dl class="mt-[1.15rem] grid grid-cols-2 gap-2 @min-[42rem]/grammar-page:grid-cols-4">
          {#each [[$tr('Lekce', 'Lessons'), profileLessons.length], [$tr('Úlohy', 'Activities'), summary.totalQuestions], [$tr('Čas', 'Time'), `${totalMinutes} min`], [$tr('Od úrovně', 'From level'), selectedLevel]] as [label, value]}
            <div
              class="rounded-[0.65rem] border border-white/13 bg-white/[0.055] px-[0.65rem] py-[0.55rem]"
            >
              <dt class="text-[0.62rem] text-white/55">{label}</dt>
              <dd class="mt-[0.12rem] font-mono text-[0.78rem] font-[850]">{value}</dd>
            </div>
          {/each}
        </dl>
      </div>

      <aside
        class="flex flex-col justify-center rounded-[0.65rem_1.25rem_0.65rem_0.65rem] border border-ink-950 bg-acid-500 p-[1.15rem] shadow-[5px_5px_0_var(--color-ink-950)] @min-[58rem]/grammar-page:p-[1.35rem]"
        aria-label={$tr(
          `Postup kurzem ${summary.percent} procent`,
          `Course progress ${summary.percent} percent`,
        )}
      >
        <div class="flex items-center justify-between gap-3">
          <div class="grid gap-[0.15rem]">
            <span class="text-[0.65rem]">{$tr('Tvůj postup', 'Your progress')}</span>
            <strong class="text-[0.88rem]"
              >{summary.completedLessons}/{summary.totalLessons} {$tr('lekcí', 'lessons')}</strong
            >
          </div>
          <div class="font-mono text-[1.8rem] font-black tracking-[-0.04em]">
            {summary.percent}%
          </div>
        </div>
        <ProgressBar
          class="mt-4"
          value={summary.percent}
          label={$tr('Postup kurzem', 'Course progress')}
        />
        <div
          class="mt-3 flex items-center justify-between gap-3 text-[0.65rem] font-[750] [&>*]:inline-flex [&>*]:items-center [&>*]:gap-[0.28rem]"
        >
          <span><Sparkles size={14} /> {summary.grammarXp} XP</span>
          <a class="border-b border-current" href="/progress/"
            >{$tr('Detail pokroku', 'Progress details')} <ArrowRight size={14} /></a
          >
        </div>
      </aside>
    </header>

    <section
      class="mt-4 grid items-center gap-[0.8rem] rounded-[0.65rem_1.15rem_0.65rem_0.65rem] border border-ink-950 bg-paper-50 p-[0.9rem] shadow-[4px_4px_0_rgb(21_25_28/0.1)] @min-[42rem]/grammar-page:grid-cols-[auto_minmax(0,1fr)_auto_auto] @min-[42rem]/grammar-page:py-[0.8rem]"
      aria-labelledby="next-lesson-title"
    >
      <div
        class="grid size-[2.8rem] place-items-center rounded-[0.65rem] border border-ink-950 bg-acid-500 text-ink-950 shadow-[2px_2px_0_var(--color-ink-950)]"
      >
        <Play size={20} fill="currentColor" />
      </div>
      <div>
        <span class="text-[0.65rem] font-[780] text-ink-600"
          >{courseComplete
            ? $tr('Doporučené opakování', 'Recommended review')
            : $tr('Pokračuj tady', 'Continue here')}</span
        >
        <h2
          class="mt-[0.12rem] text-[1.1rem] leading-[1.1] font-[880] tracking-[-0.025em]"
          id="next-lesson-title"
        >
          {recommendedCopy.title}
        </h2>
        <p class="mt-[0.3rem] text-[0.72rem] leading-[1.4] text-ink-600">
          {recommendedCopy.subtitle}
        </p>
      </div>
      <div
        class="flex flex-wrap gap-[0.3rem] @min-[42rem]/grammar-page:max-w-44 @min-[42rem]/grammar-page:justify-end"
      >
        <span class={pill}>{grammarLevelForLesson(recommended)}</span>
        <span class={pill}><Clock3 size={13} /> {recommended.minutes} min</span>
        {#if recommendedProgress.answered > 0 && !recommendedProgress.completed}
          <span class={pill}
            >{recommendedProgress.correct}/{recommendedProgress.total}
            {$tr('úloh', 'activities')}</span
          >
        {:else if recommendedProgress.completed}
          <span class={pill}>{recommendedProgress.stars}/3 {$tr('hvězdy', 'stars')}</span>
        {:else}
          <span class={pill}>+{recommended.completionXp} XP</span>
        {/if}
      </div>
      <a
        class="{darkButton} inline-flex min-h-11 items-center justify-center gap-[0.4rem] rounded-[0.6rem] px-[0.85rem] py-[0.65rem] text-[0.72rem] font-[820] @min-[42rem]/grammar-page:min-w-30"
        href={`/grammar/${recommended.id}/`}
      >
        {recommendedProgress.answered > 0 && !recommendedProgress.completed
          ? $tr('Pokračovat', 'Continue')
          : recommendedProgress.completed
            ? $tr('Zopakovat', 'Review')
            : $tr('Začít', 'Start')}
        <ArrowRight size={17} />
      </a>
    </section>

    <section
      class="mt-6 overflow-hidden rounded-[0.65rem_1.4rem_0.65rem_0.65rem] border border-ink-950 bg-[color-mix(in_srgb,var(--color-paper-50)_97%,transparent)] shadow-[6px_6px_0_rgb(21_25_28/0.09)]"
      aria-labelledby="catalog-title"
    >
      <header
        class="grid gap-[0.65rem] border-b border-ink-950 p-[1.15rem] @min-[42rem]/grammar-page:grid-cols-[minmax(0,1fr)_minmax(16rem,0.5fr)] @min-[42rem]/grammar-page:items-end @min-[42rem]/grammar-page:p-5"
      >
        <div>
          <span
            class="inline-flex items-center gap-[0.45rem] text-[0.72rem] font-extrabold text-cobalt-700"
            ><SlidersHorizontal size={15} /> {$tr('Katalog lekcí', 'Lesson catalog')}</span
          >
          <h2
            class="mt-[0.32rem] max-w-[24ch] text-[1.65rem] leading-none font-black tracking-[-0.04em] text-balance"
            id="catalog-title"
          >
            {$tr('Najdi pravidlo, které právě potřebuješ.', 'Find the rule you need right now.')}
          </h2>
        </div>
        <p class="m-0 max-w-[31rem] text-[0.74rem] leading-normal text-ink-600">
          {$tr(
            `Výchozí výběr začíná na ${selectedLevel}. Ve filtru můžeš otevřít i starší gramatiku.`,
            `Your default selection starts at ${selectedLevel}. Use the filter to open earlier grammar too.`,
          )}
          <a
            class="font-[780] text-cobalt-700 underline underline-offset-[0.16rem]"
            href="/settings/">{$tr('Změnit úroveň', 'Change level')}</a
          >
        </p>
      </header>

      <div
        class="grid gap-[0.65rem] border-b border-line bg-paper-100 p-[0.85rem] @min-[42rem]/grammar-page:grid-cols-[minmax(16rem,1fr)_minmax(9rem,0.45fr)_minmax(9rem,0.45fr)] @min-[58rem]/grammar-page:px-4"
      >
        <label class="{field} flex gap-2 pl-3">
          <span class="sr-only">{$tr('Hledat v lekcích', 'Search lessons')}</span>
          <Search class="flex-none text-ink-600" size={18} aria-hidden="true" />
          <input
            class="h-full w-full min-w-0 border-0 bg-transparent py-[0.65rem] text-[0.78rem] text-ink-950 outline-0 placeholder:text-ink-600"
            type="search"
            bind:value={searchQuery}
            placeholder={$tr('Hledat: pasivum, dativ, obwohl…', 'Search: passive, dative, obwohl…')}
            autocomplete="off"
          />
          {#if searchQuery}
            <button
              class="grid size-[2.6rem] flex-none place-items-center border-0 bg-transparent text-ink-600"
              type="button"
              onclick={() => (searchQuery = '')}
              aria-label={$tr('Vymazat hledání', 'Clear search')}
            >
              <X size={16} />
            </button>
          {/if}
        </label>

        <label class={selectField}>
          <span class={selectLabel}>{$tr('Úroveň', 'Level')}</span>
          <select class={select} bind:value={levelFilter}>
            <option value="all"
              >{$tr('Vše od', 'All from')} {selectedLevel} · {$tr('výchozí', 'default')}</option
            >
            {#each availableLevels as level}
              <option value={level}>{$tr('Jen', 'Only')} {level}</option>
            {/each}
          </select>
          <ChevronDown class="pointer-events-none" size={15} aria-hidden="true" />
        </label>

        <label class={selectField}>
          <span class={selectLabel}>{$tr('Stav', 'Status')}</span>
          <select class={select} bind:value={statusFilter}>
            <option value="all">{$tr('Všechny lekce', 'All lessons')}</option>
            <option value="open">{$tr('Nezahájené', 'Not started')}</option>
            <option value="active">{$tr('Rozdělané', 'In progress')}</option>
            <option value="done">{$tr('Dokončené', 'Completed')}</option>
          </select>
          <ChevronDown class="pointer-events-none" size={15} aria-hidden="true" />
        </label>

        <label
          class="{selectField} @min-[42rem]/grammar-page:col-span-full @min-[58rem]/grammar-page:hidden"
        >
          <span class={selectLabel}>{$tr('Téma', 'Topic')}</span>
          <select class={select} bind:value={categoryFilter}>
            <option value="all">{$tr('Všechna témata', 'All topics')}</option>
            {#each catalogCategories as category (category.id)}
              <option value={category.id}
                >{category.number} · {grammarCategoryCopy($motherTongue, category).title}</option
              >
            {/each}
          </select>
          <ChevronDown class="pointer-events-none" size={15} aria-hidden="true" />
        </label>
      </div>

      <div
        class="flex min-h-[2.7rem] items-center justify-between gap-3 border-b border-line px-[0.9rem] py-[0.6rem] text-[0.64rem] text-ink-600"
        aria-live="polite"
      >
        <span>
          <strong class="font-mono text-ink-950">{filteredLessons.length}</strong>
          {$motherTongue === 'en'
            ? filteredLessons.length === 1
              ? 'lesson'
              : 'lessons'
            : filteredLessons.length === 1
              ? 'lekce'
              : filteredLessons.length < 5
                ? 'lekce'
                : 'lekcí'}
          {activeFilterCount > 0
            ? $tr('odpovídá výběru', 'match the selection')
            : $tr('v katalogu', 'in the catalog')}
        </span>
        {#if activeFilterCount > 0}
          <button
            class="inline-flex items-center gap-[0.28rem] border-0 border-b border-current bg-transparent py-[0.15rem] font-[760] text-cobalt-700"
            type="button"
            onclick={clearFilters}><X size={14} /> {$tr('Zrušit filtry', 'Clear filters')}</button
          >
        {:else}
          <span>{$tr('Kapitoly lze rozbalit jednotlivě.', 'Open each section independently.')}</span
          >
        {/if}
      </div>

      <div
        class="min-h-[30rem] @min-[58rem]/grammar-page:grid @min-[58rem]/grammar-page:grid-cols-[14.5rem_minmax(0,1fr)] @min-[58rem]/grammar-page:items-start"
      >
        <aside
          class="hidden @min-[58rem]/grammar-page:sticky @min-[58rem]/grammar-page:top-3 @min-[58rem]/grammar-page:block @min-[58rem]/grammar-page:max-h-[calc(100dvh-1.5rem)] @min-[58rem]/grammar-page:[scrollbar-width:thin] @min-[58rem]/grammar-page:overflow-auto @min-[58rem]/grammar-page:border-r @min-[58rem]/grammar-page:border-line @min-[58rem]/grammar-page:p-3 [@media(min-width:1024px)_and_(max-height:900px)]:relative [@media(min-width:1024px)_and_(max-height:900px)]:top-auto [@media(min-width:1024px)_and_(max-height:900px)]:max-h-none [@media(min-width:1024px)_and_(max-height:900px)]:overflow-visible"
          aria-label={$tr('Témata gramatiky', 'Grammar topics')}
        >
          <div
            class="flex items-center justify-between px-[0.35rem] pt-[0.2rem] pb-[0.55rem] text-[0.62rem] font-extrabold text-ink-600"
          >
            <span>{$tr('Témata', 'Topics')}</span>
            <small
              class="grid h-[1.35rem] min-w-[1.35rem] place-items-center rounded-full bg-paper-200 font-mono text-[0.5rem] text-ink-950"
              >{catalogCategories.length}</small
            >
          </div>
          <nav class="grid gap-[0.28rem]">
            {#each [undefined, ...catalogCategories] as category (category?.id ?? 'all')}
              {@const id = category?.id ?? 'all'}
              <button
                type="button"
                class={[
                  'grid min-h-[2.9rem] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-[0.55rem] border p-[0.35rem] text-left text-ink-950',
                  categoryFilter === id
                    ? 'border-ink-950 bg-paper-50 shadow-[2px_2px_0_rgb(21_25_28/0.14)]'
                    : 'border-transparent bg-transparent fine-hover:bg-paper-50',
                ]}
                aria-pressed={categoryFilter === id}
                onclick={() => (categoryFilter = id)}
              >
                {#if category}
                  <span class="{sidebarDot} {accent(category.accent)} bg-(--category-accent)"
                    >{category.number}</span
                  >
                {:else}
                  <span class="{sidebarDot} bg-acid-500"><BookOpenCheck size={14} /></span>
                {/if}
                <span class="grid min-w-0 gap-[0.08rem]">
                  <strong class="truncate text-[0.64rem] leading-[1.15] font-[790]"
                    >{category
                      ? grammarCategoryCopy($motherTongue, category).title
                      : $tr('Všechna témata', 'All topics')}</strong
                  >
                  <small class="text-[0.5rem] text-ink-600"
                    >{category
                      ? `${categoryCompleted(category.id)}/${scopedCategoryLessons(category.id).length} ${$tr('hotovo', 'done')}`
                      : `${matchingLessons.length} ${$tr('lekcí', 'lessons')}`}</small
                  >
                </span>
                {#if category}
                  <em class="font-mono text-[0.5rem] text-ink-600 not-italic"
                    >{categoryMatchCount(category.id)}</em
                  >
                {/if}
              </button>
            {/each}
          </nav>
        </aside>

        <div
          class="@container/lesson-catalog grid min-w-0 content-start gap-[0.7rem] p-3 @min-[58rem]/grammar-page:p-[0.9rem]"
        >
          {#if filteredLessons.length === 0}
            <div class="grid min-h-96 place-items-center content-center p-8 text-center">
              <span
                class="grid size-13 place-items-center rounded-[0.8rem] border border-ink-950 bg-sky-200 shadow-[3px_3px_0_var(--color-ink-950)]"
                ><Search size={25} /></span
              >
              <h3 class="mt-4 text-[1.1rem] font-[880]">
                {$tr('Pro tento výběr tu nic není.', 'No lessons match this selection.')}
              </h3>
              <p class="mt-[0.35rem] max-w-[26rem] text-[0.72rem] leading-normal text-ink-600">
                {$tr(
                  'Zkus obecnější výraz, jinou úroveň nebo zobraz všechny stavy lekcí.',
                  'Try a broader term, another level, or show lessons in every status.',
                )}
              </p>
              <button
                class="{darkButton} mt-4 min-h-[2.65rem] rounded-[0.55rem] px-[0.85rem] py-[0.6rem] text-[0.7rem] font-extrabold"
                type="button"
                onclick={clearFilters}
                >{$tr('Zobrazit celý katalog', 'Show the full catalog')}</button
              >
            </div>
          {:else}
            {#each visibleCategories as category (category.id)}
              {@const lessons = categoryLessons(category.id)}
              {@const total = scopedCategoryLessons(category.id).length}
              {@const completed = categoryCompleted(category.id)}
              {@const categoryCopy = grammarCategoryCopy($motherTongue, category)}
              <details
                class="group overflow-hidden rounded-[0.55rem_1rem_0.55rem_0.55rem] border border-ink-950 bg-paper-50 {accent(
                  category.accent,
                )}"
                open={shouldOpenCategory(category.id)}
              >
                <summary
                  class="grid min-h-[4.25rem] cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-[0.65rem] bg-[color-mix(in_srgb,var(--category-accent)_58%,var(--color-paper-50))] p-[0.65rem] @min-[42rem]/grammar-page:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] @min-[42rem]/grammar-page:px-[0.8rem] @min-[42rem]/grammar-page:py-[0.7rem] [&::-webkit-details-marker]:hidden"
                >
                  <span
                    class="grid size-9 flex-none place-items-center rounded-[0.55rem] border border-ink-950 bg-(--category-accent) font-mono text-[0.75rem] font-[850]"
                    >{category.number}</span
                  >
                  <span class="grid min-w-0 gap-[0.16rem]">
                    <strong class="text-[0.9rem] font-[870] tracking-[-0.02em]"
                      >{categoryCopy.title}</strong
                    >
                    <small class="line-clamp-1 text-[0.75rem] leading-[1.35] text-ink-800"
                      >{categoryCopy.description}</small
                    >
                  </span>
                  <span class="grid justify-items-end leading-none">
                    <strong class="font-mono text-[0.72rem]">{lessons.length}</strong>
                    <small class="mt-[0.18rem] text-[0.75rem] text-ink-800"
                      >{$motherTongue === 'en'
                        ? lessons.length === 1
                          ? 'lesson'
                          : 'lessons'
                        : lessons.length === 1
                          ? 'lekce'
                          : lessons.length < 5
                            ? 'lekce'
                            : 'lekcí'}</small
                    >
                  </span>
                  <span
                    class="grid size-[1.8rem] place-items-center rounded-full bg-[conic-gradient(var(--color-ink-950)_var(--category-progress),rgb(255_255_255/0.72)_0)]"
                    style={`--category-progress: ${categoryPercent(category.id)}%`}
                    aria-label={$tr(
                      `${completed} z ${total} lekcí hotovo`,
                      `${completed} of ${total} lessons complete`,
                    )}><i class="size-[1.35rem] rounded-full bg-(--category-accent)"></i></span
                  >
                  <ChevronDown
                    class="hidden transition-transform duration-180 ease-out-emil group-open:rotate-180 motion-reduce:transition-none @min-[42rem]/grammar-page:block"
                    size={18}
                    aria-hidden="true"
                  />
                </summary>

                <div class="border-t border-ink-950">
                  {#each lessons as lesson (lesson.id)}
                    {@const progress = lessonProgress($appStore.course, lesson)}
                    {@const isRecommended = !courseComplete && lesson.id === recommended.id}
                    {@const lessonCopy = grammarLessonCopy($motherTongue, lesson)}
                    <a
                      class={[
                        'grid min-h-[4.65rem] grid-cols-[2.3rem_minmax(0,1fr)_auto] items-center gap-[0.6rem] border-b border-line p-[0.65rem] transition-[background-color,transform] duration-160 ease-out-emil last:border-b-0 motion-reduce:transition-none @min-[46rem]/lesson-catalog:grid-cols-[2.3rem_minmax(0,1fr)_minmax(9rem,auto)_4.2rem_auto] @min-[46rem]/lesson-catalog:px-[0.8rem] @min-[46rem]/lesson-catalog:py-[0.68rem] fine-hover:[transform:translateX(2px)]',
                        isRecommended
                          ? 'bg-[color-mix(in_srgb,var(--category-accent)_43%,white)] fine-hover:bg-[color-mix(in_srgb,var(--category-accent)_58%,white)]'
                          : 'fine-hover:bg-white',
                      ]}
                      href={`/grammar/${lesson.id}/`}
                    >
                      <span
                        class={[
                          'grid size-[2.3rem] place-items-center rounded-[0.55rem] border border-ink-950 font-mono text-[0.58rem] font-[850] shadow-[2px_2px_0_rgb(21_25_28/0.12)]',
                          isRecommended
                            ? 'bg-ink-950 text-white'
                            : progress.completed
                              ? 'bg-mint-200 text-mint-700'
                              : 'bg-paper-50',
                        ]}
                      >
                        {#if progress.completed}
                          <Check size={18} strokeWidth={3} />
                        {:else if isRecommended}
                          <Play size={16} fill="currentColor" />
                        {:else}
                          {lesson.unit}
                        {/if}
                      </span>
                      <span class="grid min-w-0 gap-[0.22rem]">
                        <span class="flex min-w-0 flex-wrap items-center gap-[0.32rem]">
                          <strong
                            class="min-w-0 text-[0.8rem] leading-[1.18] font-[840] tracking-[-0.015em]"
                            >{lessonCopy.title}</strong
                          >
                          {#if isRecommended}<em
                              class="rounded-full bg-ink-950 px-[0.3rem] py-[0.14rem] text-[0.44rem] font-[820] text-white uppercase not-italic"
                              >{$tr('další', 'next')}</em
                            >{/if}
                        </span>
                        <small class="line-clamp-1 text-[0.62rem] leading-[1.35] text-ink-600"
                          >{lessonCopy.subtitle}</small
                        >
                      </span>
                      <span
                        class="hidden @min-[46rem]/lesson-catalog:flex @min-[46rem]/lesson-catalog:flex-wrap @min-[46rem]/lesson-catalog:justify-end @min-[46rem]/lesson-catalog:gap-1 [&>span]:inline-flex [&>span]:items-center [&>span]:gap-[0.2rem] [&>span]:rounded-full [&>span]:bg-paper-100 [&>span]:px-[0.36rem] [&>span]:py-[0.24rem] [&>span]:font-mono [&>span]:text-[0.48rem]"
                      >
                        <span>{grammarLevelForLesson(lesson)}</span>
                        <span><Clock3 size={12} /> {lesson.minutes} min</span>
                        <span>{lesson.questions.length} {$tr('úloh', 'activities')}</span>
                      </span>
                      <span
                        class="hidden min-w-0 items-center justify-end gap-1 text-ink-600 @min-[46rem]/lesson-catalog:flex [&_small]:font-mono [&_small]:text-[0.48rem] [&_small]:whitespace-nowrap"
                      >
                        {#if progress.completed}
                          <span
                            class="flex gap-[0.04rem] text-orange-700"
                            aria-label={$tr(
                              `${progress.stars} ze 3 hvězd`,
                              `${progress.stars} of 3 stars`,
                            )}
                          >
                            {#each [1, 2, 3] as star}
                              <Star
                                size={12}
                                fill={star <= progress.stars ? 'currentColor' : 'none'}
                              />
                            {/each}
                          </span>
                        {:else if progress.answered > 0}
                          <span
                            class="h-[0.26rem] w-[2.8rem] overflow-hidden rounded-full bg-paper-200"
                            aria-label={$tr(
                              `${progress.percent} procent hotovo`,
                              `${progress.percent} percent complete`,
                            )}
                          >
                            <i
                              class="block h-full rounded-[inherit] bg-cobalt-700"
                              style={`width: ${progress.percent}%`}
                            ></i>
                          </span>
                          <small>{progress.correct}/{progress.total}</small>
                        {:else}
                          <small>{$tr('Nezahájeno', 'Not started')}</small>
                        {/if}
                      </span>
                      <ArrowRight class="text-ink-600" size={17} aria-hidden="true" />
                    </a>
                  {/each}
                </div>
              </details>
            {/each}
          {/if}
        </div>
      </div>
    </section>
  </div>
{/if}
