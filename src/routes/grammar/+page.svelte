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
  import { localized } from '$lib/i18n';
  import { grammarCategoryCopy, grammarLessonCopy } from '$lib/i18n/grammar.ts';
  import { appStore, motherTongue } from '$lib/state/app';
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

  let searchQuery = '';
  let levelFilter: DetailedCefrLevel | 'all' = 'all';
  let statusFilter: StatusFilter = 'all';
  let categoryFilter = 'all';

  const categoryById = new Map(grammarCategories.map((category) => [category.id, category]));

  onMount(() => void appStore.initialize());

  $: selectedLevel = $appStore.settings?.grammarLevel ?? 'A1.1';
  $: availableLevels = DETAILED_CEFR_LEVELS;
  $: profileLessons = grammarLessonsForLevel(selectedLevel);
  $: catalogScopeLessons = levelFilter === 'all' ? profileLessons : grammarLessons;
  $: catalogCategories = grammarCategories.filter(
    (category) => lessonsForCategory(category.id, catalogScopeLessons).length > 0,
  );
  $: if (
    categoryFilter !== 'all' &&
    !catalogCategories.some((category) => category.id === categoryFilter)
  ) {
    categoryFilter = 'all';
  }
  $: summary = courseSummaryForLessons($appStore.course, profileLessons);
  $: recommended = recommendedGrammarLesson($appStore.course, profileLessons);
  $: recommendedCopy = grammarLessonCopy($motherTongue, recommended);
  $: recommendedProgress = lessonProgress($appStore.course, recommended);
  $: courseComplete = summary.completedLessons === summary.totalLessons;
  $: totalMinutes = profileLessons.reduce((sum, lesson) => sum + lesson.minutes, 0);
  $: matchingLessons = catalogScopeLessons.filter(
    (lesson) =>
      matchesSearch(lesson, searchQuery) &&
      matchesLevel(lesson, levelFilter) &&
      matchesStatus(lesson, statusFilter, $appStore.course),
  );
  $: filteredLessons =
    categoryFilter === 'all'
      ? matchingLessons
      : matchingLessons.filter((lesson) => lesson.categoryId === categoryFilter);
  $: visibleCategories = catalogCategories.filter(
    (category) =>
      (categoryFilter === 'all' || category.id === categoryFilter) &&
      filteredLessons.some((lesson) => lesson.categoryId === category.id),
  );
  $: activeFilterCount =
    Number(searchQuery.trim().length > 0) +
    Number(levelFilter !== 'all') +
    Number(statusFilter !== 'all') +
    Number(categoryFilter !== 'all');

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

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }
</script>

<svelte:head>
  <title>{copy('Katalog gramatiky A1–C1', 'German grammar A1–C1')} · Fritz</title>
  <meta
    name="description"
    content={copy(
      `${grammarLessons.length} krátkých lekcí německé gramatiky od A1.1 po C1.2 s vyhledáváním, filtry a okamžitou zpětnou vazbou.`,
      `${grammarLessons.length} short German grammar lessons from A1.1 to C1.2 with search, filters, and instant feedback.`,
    )}
  />
</svelte:head>

{#if !$appStore.ready}
  <LoadingState label={copy('Připravuji katalog gramatiky…', 'Preparing the grammar catalog…')} />
{:else}
  <div class="course-page">
    <header class="course-header">
      <div class="header-copy">
        <div class="title-label">
          <BookOpenCheck size={16} />
          {copy('Kurz gramatiky', 'German grammar')} · A1–C1
        </div>
        <h1>
          {copy(
            'Od první věty po přesný C1 styl.',
            'From your first sentence to precise C1 style.',
          )}
        </h1>
        <p>
          {copy(
            'Ucelený katalog krátkých lekcí. Najdi konkrétní pravidlo, pokračuj v rozdělaném tématu nebo postupuj podle doporučeného pořadí.',
            'A complete catalog of short lessons. Find one rule, continue an active topic, or follow the recommended order.',
          )}
        </p>
        <dl class="course-facts">
          <div>
            <dt>{copy('Lekce', 'Lessons')}</dt>
            <dd>{profileLessons.length}</dd>
          </div>
          <div>
            <dt>{copy('Úlohy', 'Activities')}</dt>
            <dd>{summary.totalQuestions}</dd>
          </div>
          <div>
            <dt>{copy('Čas', 'Time')}</dt>
            <dd>{totalMinutes} min</dd>
          </div>
          <div>
            <dt>{copy('Od úrovně', 'From level')}</dt>
            <dd>{selectedLevel}</dd>
          </div>
        </dl>
      </div>

      <aside
        class="progress-card"
        aria-label={copy(
          `Postup kurzem ${summary.percent} procent`,
          `Course progress ${summary.percent} percent`,
        )}
      >
        <div class="progress-heading">
          <div>
            <span>{copy('Tvůj postup', 'Your progress')}</span>
            <strong
              >{summary.completedLessons}/{summary.totalLessons} {copy('lekcí', 'lessons')}</strong
            >
          </div>
          <div class="progress-percent">{summary.percent}%</div>
        </div>
        <ProgressBar value={summary.percent} label={copy('Postup kurzem', 'Course progress')} />
        <div class="progress-foot">
          <span><Sparkles size={14} /> {summary.grammarXp} XP</span>
          <a href="/progress/"
            >{copy('Detail pokroku', 'Progress details')} <ArrowRight size={14} /></a
          >
        </div>
      </aside>
    </header>

    <section class="next-card" aria-labelledby="next-lesson-title">
      <div class="next-icon"><Play size={20} fill="currentColor" /></div>
      <div class="next-copy">
        <span
          >{courseComplete
            ? copy('Doporučené opakování', 'Recommended review')
            : copy('Pokračuj tady', 'Continue here')}</span
        >
        <h2 id="next-lesson-title">{recommendedCopy.title}</h2>
        <p>{recommendedCopy.subtitle}</p>
      </div>
      <div class="next-meta">
        <span>{grammarLevelForLesson(recommended)}</span>
        <span><Clock3 size={13} /> {recommended.minutes} min</span>
        {#if recommendedProgress.answered > 0 && !recommendedProgress.completed}
          <span
            >{recommendedProgress.correct}/{recommendedProgress.total}
            {copy('úloh', 'activities')}</span
          >
        {:else if recommendedProgress.completed}
          <span>{recommendedProgress.stars}/3 {copy('hvězdy', 'stars')}</span>
        {:else}
          <span>+{recommended.completionXp} XP</span>
        {/if}
      </div>
      <a class="next-button" href={`/grammar/${recommended.id}/`}>
        {recommendedProgress.answered > 0 && !recommendedProgress.completed
          ? copy('Pokračovat', 'Continue')
          : recommendedProgress.completed
            ? copy('Zopakovat', 'Review')
            : copy('Začít', 'Start')}
        <ArrowRight size={17} />
      </a>
    </section>

    <section class="catalog" aria-labelledby="catalog-title">
      <header class="catalog-header">
        <div>
          <span class="catalog-label"
            ><SlidersHorizontal size={15} /> {copy('Katalog lekcí', 'Lesson catalog')}</span
          >
          <h2 id="catalog-title">
            {copy('Najdi pravidlo, které právě potřebuješ.', 'Find the rule you need right now.')}
          </h2>
        </div>
        <p>
          {copy(
            `Výchozí výběr začíná na ${selectedLevel}. Ve filtru můžeš otevřít i starší gramatiku.`,
            `Your default selection starts at ${selectedLevel}. Use the filter to open earlier grammar too.`,
          )}
          <a href="/settings/">{copy('Změnit úroveň', 'Change level')}</a>
        </p>
      </header>

      <div class="catalog-tools">
        <label class="search-field">
          <span class="visually-hidden">{copy('Hledat v lekcích', 'Search lessons')}</span>
          <Search class="search-icon" size={18} aria-hidden="true" />
          <input
            type="search"
            bind:value={searchQuery}
            placeholder={copy(
              'Hledat: pasivum, dativ, obwohl…',
              'Search: passive, dative, obwohl…',
            )}
            autocomplete="off"
          />
          {#if searchQuery}
            <button
              type="button"
              onclick={() => (searchQuery = '')}
              aria-label={copy('Vymazat hledání', 'Clear search')}
            >
              <X size={16} />
            </button>
          {/if}
        </label>

        <label class="select-field">
          <span>{copy('Úroveň', 'Level')}</span>
          <select bind:value={levelFilter}>
            <option value="all"
              >{copy('Vše od', 'All from')} {selectedLevel} · {copy('výchozí', 'default')}</option
            >
            {#each availableLevels as level}
              <option value={level}>{copy('Jen', 'Only')} {level}</option>
            {/each}
          </select>
          <ChevronDown class="select-chevron" size={15} aria-hidden="true" />
        </label>

        <label class="select-field">
          <span>{copy('Stav', 'Status')}</span>
          <select bind:value={statusFilter}>
            <option value="all">{copy('Všechny lekce', 'All lessons')}</option>
            <option value="open">{copy('Nezahájené', 'Not started')}</option>
            <option value="active">{copy('Rozdělané', 'In progress')}</option>
            <option value="done">{copy('Dokončené', 'Completed')}</option>
          </select>
          <ChevronDown class="select-chevron" size={15} aria-hidden="true" />
        </label>

        <label class="select-field mobile-category-select">
          <span>{copy('Téma', 'Topic')}</span>
          <select bind:value={categoryFilter}>
            <option value="all">{copy('Všechna témata', 'All topics')}</option>
            {#each catalogCategories as category}
              <option value={category.id}
                >{category.number} · {grammarCategoryCopy($motherTongue, category).title}</option
              >
            {/each}
          </select>
          <ChevronDown class="select-chevron" size={15} aria-hidden="true" />
        </label>
      </div>

      <div class="result-bar" aria-live="polite">
        <span>
          <strong>{filteredLessons.length}</strong>
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
            ? copy('odpovídá výběru', 'match the selection')
            : copy('v katalogu', 'in the catalog')}
        </span>
        {#if activeFilterCount > 0}
          <button type="button" onclick={clearFilters}
            ><X size={14} /> {copy('Zrušit filtry', 'Clear filters')}</button
          >
        {:else}
          <span
            >{copy('Kapitoly lze rozbalit jednotlivě.', 'Open each section independently.')}</span
          >
        {/if}
      </div>

      <div class="catalog-layout">
        <aside class="category-sidebar" aria-label={copy('Témata gramatiky', 'Grammar topics')}>
          <div class="sidebar-heading">
            <span>{copy('Témata', 'Topics')}</span>
            <small>{catalogCategories.length}</small>
          </div>
          <nav>
            <button
              type="button"
              class:active={categoryFilter === 'all'}
              aria-pressed={categoryFilter === 'all'}
              onclick={() => (categoryFilter = 'all')}
            >
              <span class="all-dot"><BookOpenCheck size={14} /></span>
              <span
                ><strong>{copy('Všechna témata', 'All topics')}</strong><small
                  >{matchingLessons.length} {copy('lekcí', 'lessons')}</small
                ></span
              >
            </button>
            {#each catalogCategories as category}
              {@const total = scopedCategoryLessons(category.id).length}
              {@const completed = categoryCompleted(category.id)}
              {@const categoryCopy = grammarCategoryCopy($motherTongue, category)}
              <button
                type="button"
                class:active={categoryFilter === category.id}
                aria-pressed={categoryFilter === category.id}
                onclick={() => (categoryFilter = category.id)}
              >
                <span class={`category-dot accent-${category.accent}`}>{category.number}</span>
                <span>
                  <strong>{categoryCopy.title}</strong>
                  <small>{completed}/{total} {copy('hotovo', 'done')}</small>
                </span>
                <em>{categoryMatchCount(category.id)}</em>
              </button>
            {/each}
          </nav>
        </aside>

        <div class="lesson-catalog">
          {#if filteredLessons.length === 0}
            <div class="empty-state">
              <span><Search size={25} /></span>
              <h3>{copy('Pro tento výběr tu nic není.', 'No lessons match this selection.')}</h3>
              <p>
                {copy(
                  'Zkus obecnější výraz, jinou úroveň nebo zobraz všechny stavy lekcí.',
                  'Try a broader term, another level, or show lessons in every status.',
                )}
              </p>
              <button type="button" onclick={clearFilters}
                >{copy('Zobrazit celý katalog', 'Show the full catalog')}</button
              >
            </div>
          {:else}
            {#each visibleCategories as category}
              {@const lessons = categoryLessons(category.id)}
              {@const total = scopedCategoryLessons(category.id).length}
              {@const completed = categoryCompleted(category.id)}
              {@const categoryCopy = grammarCategoryCopy($motherTongue, category)}
              <details
                class={`category-section accent-${category.accent}`}
                open={shouldOpenCategory(category.id)}
              >
                <summary>
                  <span class="category-number">{category.number}</span>
                  <span class="category-copy">
                    <strong>{categoryCopy.title}</strong>
                    <small>{categoryCopy.description}</small>
                  </span>
                  <span class="category-count">
                    <strong>{lessons.length}</strong>
                    <small
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
                    class="category-progress"
                    style={`--category-progress: ${categoryPercent(category.id)}%`}
                    aria-label={copy(
                      `${completed} z ${total} lekcí hotovo`,
                      `${completed} of ${total} lessons complete`,
                    )}><i></i></span
                  >
                  <ChevronDown class="summary-chevron" size={18} aria-hidden="true" />
                </summary>

                <div class="lesson-list">
                  {#each lessons as lesson}
                    {@const progress = lessonProgress($appStore.course, lesson)}
                    {@const isRecommended = !courseComplete && lesson.id === recommended.id}
                    {@const lessonCopy = grammarLessonCopy($motherTongue, lesson)}
                    <a
                      class="lesson-row"
                      class:completed={progress.completed}
                      class:recommended={isRecommended}
                      href={`/grammar/${lesson.id}/`}
                    >
                      <span class="lesson-state">
                        {#if progress.completed}
                          <Check size={18} strokeWidth={3} />
                        {:else if isRecommended}
                          <Play size={16} fill="currentColor" />
                        {:else}
                          {lesson.unit}
                        {/if}
                      </span>
                      <span class="lesson-copy">
                        <span class="lesson-title">
                          <strong>{lessonCopy.title}</strong>
                          {#if isRecommended}<em>{copy('další', 'next')}</em>{/if}
                        </span>
                        <small>{lessonCopy.subtitle}</small>
                      </span>
                      <span class="lesson-meta">
                        <span>{grammarLevelForLesson(lesson)}</span>
                        <span><Clock3 size={12} /> {lesson.minutes} min</span>
                        <span>{lesson.questions.length} {copy('úloh', 'activities')}</span>
                      </span>
                      <span class="lesson-result">
                        {#if progress.completed}
                          <span
                            class="stars"
                            aria-label={copy(
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
                            class="row-progress"
                            aria-label={copy(
                              `${progress.percent} procent hotovo`,
                              `${progress.percent} percent complete`,
                            )}
                          >
                            <i style={`width: ${progress.percent}%`}></i>
                          </span>
                          <small>{progress.correct}/{progress.total}</small>
                        {:else}
                          <small>{copy('Nezahájeno', 'Not started')}</small>
                        {/if}
                      </span>
                      <ArrowRight class="lesson-arrow" size={17} aria-hidden="true" />
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

<style>
  .course-page {
    max-width: 78rem;
    margin: 0 auto;
    padding-bottom: 2rem;
    container: grammar-page / inline-size;
  }

  .course-header {
    display: grid;
    gap: 1rem;
  }

  .header-copy {
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem 1.5rem 0.65rem 0.65rem;
    color: white;
    background: var(--color-ink-950);
    padding: 1.35rem;
    box-shadow: 6px 6px 0 rgb(21 25 28 / 0.12);
  }

  .title-label,
  .catalog-label {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.72rem;
    font-weight: 800;
  }

  .title-label {
    color: var(--color-acid-500);
  }

  .header-copy h1 {
    max-width: 18ch;
    margin: 0.65rem 0 0;
    font-size: 2.25rem;
    font-weight: 920;
    letter-spacing: -0.04em;
    line-height: 0.98;
    text-wrap: balance;
  }

  .header-copy > p {
    max-width: 46rem;
    margin: 0.8rem 0 0;
    color: rgb(255 255 255 / 0.68);
    font-size: 0.88rem;
    line-height: 1.55;
    text-wrap: pretty;
  }

  .course-facts {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin: 1.15rem 0 0;
  }

  .course-facts div {
    border: 1px solid rgb(255 255 255 / 0.13);
    border-radius: 0.65rem;
    background: rgb(255 255 255 / 0.055);
    padding: 0.55rem 0.65rem;
  }

  .course-facts dt {
    color: rgb(255 255 255 / 0.55);
    font-size: 0.62rem;
  }

  .course-facts dd {
    margin: 0.12rem 0 0;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 850;
  }

  .progress-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem 1.25rem 0.65rem 0.65rem;
    background: var(--color-acid-500);
    padding: 1.15rem;
    box-shadow: 5px 5px 0 var(--color-ink-950);
  }

  .progress-heading,
  .progress-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .progress-heading > div:first-child {
    display: grid;
    gap: 0.15rem;
  }

  .progress-heading span,
  .progress-foot {
    font-size: 0.65rem;
  }

  .progress-heading strong {
    font-size: 0.88rem;
  }

  .progress-percent {
    font-family: var(--font-mono);
    font-size: 1.8rem;
    font-weight: 900;
    letter-spacing: -0.04em;
  }

  .progress-card :global(.progress-track) {
    margin-top: 1rem;
  }

  .progress-foot {
    margin-top: 0.75rem;
    font-weight: 750;
  }

  .progress-foot span,
  .progress-foot a {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
  }

  .progress-foot a {
    border-bottom: 1px solid currentColor;
  }

  .next-card {
    display: grid;
    align-items: center;
    gap: 0.8rem;
    margin-top: 1rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem 1.15rem 0.65rem 0.65rem;
    background: var(--color-paper-50);
    padding: 0.9rem;
    box-shadow: 4px 4px 0 rgb(21 25 28 / 0.1);
  }

  .next-icon {
    display: grid;
    width: 2.8rem;
    height: 2.8rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }

  .next-copy > span {
    color: var(--color-ink-600);
    font-size: 0.65rem;
    font-weight: 780;
  }

  .next-copy h2 {
    margin: 0.12rem 0 0;
    font-size: 1.1rem;
    font-weight: 880;
    letter-spacing: -0.025em;
    line-height: 1.1;
  }

  .next-copy p {
    margin: 0.3rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.72rem;
    line-height: 1.4;
  }

  .next-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .next-meta span {
    display: inline-flex;
    align-items: center;
    gap: 0.22rem;
    border-radius: 99px;
    background: var(--color-paper-100);
    padding: 0.28rem 0.45rem;
    font-family: var(--font-mono);
    font-size: 0.55rem;
    font-weight: 700;
  }

  .next-button {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.6rem;
    color: white;
    background: var(--color-ink-950);
    padding: 0.65rem 0.85rem;
    font-size: 0.72rem;
    font-weight: 820;
    transition:
      transform 160ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil);
  }

  .catalog {
    overflow: hidden;
    margin-top: 1.5rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem 1.4rem 0.65rem 0.65rem;
    background: color-mix(in srgb, var(--color-paper-50) 97%, transparent);
    box-shadow: 6px 6px 0 rgb(21 25 28 / 0.09);
  }

  .catalog-header {
    display: grid;
    gap: 0.65rem;
    border-bottom: 1px solid var(--color-ink-950);
    padding: 1.15rem;
  }

  .catalog-label {
    color: var(--color-cobalt-700);
  }

  .catalog-header h2 {
    max-width: 24ch;
    margin: 0.32rem 0 0;
    font-size: 1.65rem;
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1;
    text-wrap: balance;
  }

  .catalog-header > p {
    max-width: 31rem;
    margin: 0;
    color: var(--color-ink-600);
    font-size: 0.74rem;
    line-height: 1.5;
  }

  .catalog-header a {
    color: var(--color-cobalt-700);
    font-weight: 780;
    text-decoration: underline;
    text-underline-offset: 0.16rem;
  }

  .catalog-tools {
    display: grid;
    gap: 0.65rem;
    border-bottom: 1px solid var(--color-line);
    background: var(--color-paper-100);
    padding: 0.85rem;
  }

  .search-field,
  .select-field {
    position: relative;
    display: flex;
    min-width: 0;
    min-height: 2.75rem;
    align-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.55rem;
    background: var(--color-paper-50);
  }

  .search-field {
    gap: 0.5rem;
    padding-left: 0.75rem;
  }

  :global(.search-icon) {
    flex: none;
    color: var(--color-ink-600);
  }

  .search-field input,
  .select-field select {
    min-width: 0;
    border: 0;
    color: var(--color-ink-950);
    background: transparent;
    outline: 0;
  }

  .search-field input {
    width: 100%;
    height: 100%;
    padding: 0.65rem 0;
    font-size: 0.78rem;
  }

  .search-field input::placeholder {
    color: var(--color-ink-600);
  }

  .search-field button {
    display: grid;
    width: 2.6rem;
    height: 2.6rem;
    flex: none;
    place-items: center;
    border: 0;
    color: var(--color-ink-600);
    background: transparent;
  }

  .select-field {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 0.25rem 0.65rem;
  }

  .select-field > span {
    position: absolute;
    top: 0.3rem;
    left: 0.65rem;
    color: var(--color-ink-600);
    font-size: 0.48rem;
    font-weight: 750;
  }

  .select-field select {
    z-index: 1;
    width: 100%;
    height: 100%;
    appearance: none;
    padding: 0.72rem 1.35rem 0.05rem 0;
    font-size: 0.7rem;
    font-weight: 760;
  }

  :global(.select-chevron) {
    pointer-events: none;
  }

  .search-field:focus-within,
  .select-field:focus-within {
    border-color: var(--color-cobalt-700);
    box-shadow: 0 0 0 3px rgb(49 83 199 / 0.12);
  }

  .result-bar {
    display: flex;
    min-height: 2.7rem;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-bottom: 1px solid var(--color-line);
    padding: 0.6rem 0.9rem;
    color: var(--color-ink-600);
    font-size: 0.64rem;
  }

  .result-bar strong {
    color: var(--color-ink-950);
    font-family: var(--font-mono);
  }

  .result-bar button {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    border: 0;
    border-bottom: 1px solid currentColor;
    color: var(--color-cobalt-700);
    background: transparent;
    padding: 0.15rem 0;
    font-size: inherit;
    font-weight: 760;
  }

  .catalog-layout {
    min-height: 30rem;
  }

  .category-sidebar {
    display: none;
  }

  .lesson-catalog {
    container: lesson-catalog / inline-size;
    display: grid;
    min-width: 0;
    align-content: start;
    gap: 0.7rem;
    padding: 0.75rem;
  }

  .category-section {
    --category-accent: var(--color-acid-500);
    overflow: hidden;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.55rem 1rem 0.55rem 0.55rem;
    background: var(--color-paper-50);
  }

  .accent-sky {
    --category-accent: var(--color-sky-200);
  }

  .accent-coral {
    --category-accent: var(--color-coral-200);
  }

  .accent-orange {
    --category-accent: var(--color-orange-100);
  }

  .accent-mint {
    --category-accent: var(--color-mint-200);
  }

  .accent-cobalt {
    --category-accent: var(--color-cobalt-300);
  }

  .category-section summary {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 0.65rem;
    min-height: 4.25rem;
    list-style: none;
    background: color-mix(in srgb, var(--category-accent) 58%, var(--color-paper-50));
    padding: 0.65rem;
    cursor: pointer;
  }

  .category-section summary::-webkit-details-marker {
    display: none;
  }

  .category-number,
  .category-dot,
  .all-dot {
    display: grid;
    width: 2.25rem;
    height: 2.25rem;
    flex: none;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.55rem;
    background: var(--category-accent);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 850;
  }

  .category-copy {
    display: grid;
    min-width: 0;
    gap: 0.16rem;
  }

  .category-copy strong {
    font-size: 0.9rem;
    font-weight: 870;
    letter-spacing: -0.02em;
  }

  .category-copy small {
    display: -webkit-box;
    overflow: hidden;
    color: var(--color-ink-800);
    font-size: 0.75rem;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }

  .category-count {
    display: grid;
    justify-items: end;
    line-height: 1;
  }

  .category-count strong {
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }

  .category-count small {
    margin-top: 0.18rem;
    color: var(--color-ink-800);
    font-size: 0.75rem;
  }

  .category-progress {
    display: grid;
    width: 1.8rem;
    height: 1.8rem;
    place-items: center;
    border-radius: 50%;
    background: conic-gradient(
      var(--color-ink-950) var(--category-progress),
      rgb(255 255 255 / 0.72) 0
    );
  }

  .category-progress i {
    width: 1.35rem;
    height: 1.35rem;
    border-radius: 50%;
    background: var(--category-accent);
  }

  .summary-chevron {
    display: none;
    transition: transform 180ms var(--ease-out-emil);
  }

  .category-section[open] :global(.summary-chevron) {
    transform: rotate(180deg);
  }

  .lesson-list {
    border-top: 1px solid var(--color-ink-950);
  }

  .lesson-row {
    display: grid;
    grid-template-columns: 2.3rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.6rem;
    min-height: 4.65rem;
    border-bottom: 1px solid var(--color-line);
    padding: 0.65rem;
    transition:
      background-color 160ms var(--ease-out-emil),
      transform 160ms var(--ease-out-emil);
  }

  .lesson-row:last-child {
    border-bottom: 0;
  }

  .lesson-row.recommended {
    background: color-mix(in srgb, var(--category-accent) 43%, white);
  }

  .lesson-state {
    display: grid;
    width: 2.3rem;
    height: 2.3rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.55rem;
    background: var(--color-paper-50);
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 850;
    box-shadow: 2px 2px 0 rgb(21 25 28 / 0.12);
  }

  .lesson-row.completed .lesson-state {
    color: var(--color-mint-700);
    background: var(--color-mint-200);
  }

  .lesson-row.recommended .lesson-state {
    color: white;
    background: var(--color-ink-950);
  }

  .lesson-copy {
    display: grid;
    min-width: 0;
    gap: 0.22rem;
  }

  .lesson-title {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.32rem;
  }

  .lesson-title strong {
    min-width: 0;
    font-size: 0.8rem;
    font-weight: 840;
    letter-spacing: -0.015em;
    line-height: 1.18;
  }

  .lesson-title em {
    border-radius: 99px;
    color: white;
    background: var(--color-ink-950);
    padding: 0.14rem 0.3rem;
    font-size: 0.44rem;
    font-style: normal;
    font-weight: 820;
    text-transform: uppercase;
  }

  .lesson-copy > small {
    display: -webkit-box;
    overflow: hidden;
    color: var(--color-ink-600);
    font-size: 0.62rem;
    line-height: 1.35;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }

  .lesson-meta,
  .lesson-result {
    display: none;
  }

  .lesson-arrow {
    color: var(--color-ink-600);
  }

  .empty-state {
    display: grid;
    min-height: 24rem;
    place-items: center;
    align-content: center;
    padding: 2rem;
    text-align: center;
  }

  .empty-state > span {
    display: grid;
    width: 3.25rem;
    height: 3.25rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.8rem;
    background: var(--color-sky-200);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }

  .empty-state h3 {
    margin: 1rem 0 0;
    font-size: 1.1rem;
    font-weight: 880;
  }

  .empty-state p {
    max-width: 26rem;
    margin: 0.35rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.72rem;
    line-height: 1.5;
  }

  .empty-state button {
    min-height: 2.65rem;
    margin-top: 1rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.55rem;
    color: white;
    background: var(--color-ink-950);
    padding: 0.6rem 0.85rem;
    font-size: 0.7rem;
    font-weight: 800;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (hover: hover) and (pointer: fine) {
    .next-button:hover,
    .empty-state button:hover {
      background: var(--color-cobalt-700);
      transform: translateY(-1px);
    }

    .lesson-row:hover {
      background: white;
      transform: translateX(2px);
    }

    .lesson-row.recommended:hover {
      background: color-mix(in srgb, var(--category-accent) 58%, white);
    }

    .category-sidebar button:hover {
      background: var(--color-paper-50);
    }
  }

  @container grammar-page (min-width: 42rem) {
    .course-facts {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .next-card {
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      padding: 0.8rem 0.9rem;
    }

    .next-meta {
      max-width: 11rem;
      justify-content: flex-end;
    }

    .next-button {
      min-width: 7.5rem;
    }

    .catalog-header {
      grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.5fr);
      align-items: end;
      padding: 1.25rem;
    }

    .catalog-tools {
      grid-template-columns: minmax(16rem, 1fr) minmax(9rem, 0.45fr) minmax(9rem, 0.45fr);
    }

    .mobile-category-select {
      grid-column: 1 / -1;
    }

    .category-section summary {
      grid-template-columns: auto minmax(0, 1fr) auto auto auto;
      padding: 0.7rem 0.8rem;
    }

    .summary-chevron {
      display: block;
    }
  }

  @container lesson-catalog (min-width: 46rem) {
    .lesson-row {
      grid-template-columns: 2.3rem minmax(0, 1fr) minmax(9rem, auto) 4.2rem auto;
      padding: 0.68rem 0.8rem;
    }

    .lesson-meta {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.25rem;
    }

    .lesson-meta > span {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      border-radius: 99px;
      background: var(--color-paper-100);
      padding: 0.24rem 0.36rem;
      font-family: var(--font-mono);
      font-size: 0.48rem;
    }

    .lesson-result {
      display: flex;
      min-width: 0;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
      color: var(--color-ink-600);
    }

    .lesson-result small {
      font-family: var(--font-mono);
      font-size: 0.48rem;
      white-space: nowrap;
    }

    .stars {
      display: flex;
      gap: 0.04rem;
      color: var(--color-orange-700);
    }

    .row-progress {
      width: 2.8rem;
      height: 0.26rem;
      overflow: hidden;
      border-radius: 99px;
      background: var(--color-paper-200);
    }

    .row-progress i {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--color-cobalt-700);
    }
  }

  @container grammar-page (min-width: 58rem) {
    .course-header {
      grid-template-columns: minmax(0, 1.75fr) minmax(17rem, 0.65fr);
    }

    .header-copy {
      padding: 1.6rem 1.75rem;
    }

    .header-copy h1 {
      font-size: 2.75rem;
    }

    .progress-card {
      padding: 1.35rem;
    }

    .catalog-tools {
      padding: 0.85rem 1rem;
    }

    .mobile-category-select {
      display: none;
    }

    .catalog-layout {
      display: grid;
      grid-template-columns: 14.5rem minmax(0, 1fr);
      align-items: start;
    }

    .category-sidebar {
      position: sticky;
      top: 0.75rem;
      display: block;
      max-height: calc(100dvh - 1.5rem);
      overflow: auto;
      border-right: 1px solid var(--color-line);
      padding: 0.75rem;
      scrollbar-width: thin;
    }

    .sidebar-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.2rem 0.35rem 0.55rem;
      color: var(--color-ink-600);
      font-size: 0.62rem;
      font-weight: 800;
    }

    .sidebar-heading small {
      display: grid;
      min-width: 1.35rem;
      height: 1.35rem;
      place-items: center;
      border-radius: 99px;
      color: var(--color-ink-950);
      background: var(--color-paper-200);
      font-family: var(--font-mono);
      font-size: 0.5rem;
    }

    .category-sidebar nav {
      display: grid;
      gap: 0.28rem;
    }

    .category-sidebar button {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      min-height: 2.9rem;
      border: 1px solid transparent;
      border-radius: 0.55rem;
      color: var(--color-ink-950);
      background: transparent;
      padding: 0.35rem;
      text-align: left;
    }

    .category-sidebar button.active {
      border-color: var(--color-ink-950);
      background: var(--color-paper-50);
      box-shadow: 2px 2px 0 rgb(21 25 28 / 0.14);
    }

    .category-sidebar button > span:nth-child(2) {
      display: grid;
      min-width: 0;
      gap: 0.08rem;
    }

    .category-sidebar button strong {
      overflow: hidden;
      font-size: 0.64rem;
      font-weight: 790;
      line-height: 1.15;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .category-sidebar button small {
      color: var(--color-ink-600);
      font-size: 0.5rem;
    }

    .category-sidebar button em {
      color: var(--color-ink-600);
      font-family: var(--font-mono);
      font-size: 0.5rem;
      font-style: normal;
    }

    .category-dot,
    .all-dot {
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 0.45rem;
      font-size: 0.46rem;
    }

    .all-dot {
      background: var(--color-acid-500);
    }

    .lesson-catalog {
      padding: 0.9rem;
    }
  }

  @media (min-width: 1024px) and (max-height: 900px) {
    .category-sidebar {
      position: relative;
      top: auto;
      max-height: none;
      overflow: visible;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .next-button,
    .lesson-row,
    .summary-chevron {
      transition: none;
    }
  }
</style>
