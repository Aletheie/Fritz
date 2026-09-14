<script lang="ts">
  import CourseMilestonePreview from '$lib/components/course/CourseMilestonePreview.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import {
    coursePathChapterMinutes,
    coursePathNodeHref,
  } from '$lib/domain/course/path-presentation.ts';
  import { DETAILED_CEFR_LEVELS } from '$lib/domain/levels.ts';
  import { t } from '$lib/i18n';
  import { courseChapterCopy, courseLevelName } from '$lib/i18n/course.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import { loadCoursePath } from '$lib/state/course-path.ts';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import GraduationCap from '@lucide/svelte/icons/graduation-cap';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import Play from '@lucide/svelte/icons/play';
  import Search from '@lucide/svelte/icons/search';
  import Target from '@lucide/svelte/icons/target';
  import { onMount } from 'svelte';

  import type { CoursePathChapterView, CoursePathNode } from '$lib/domain/course/path.ts';
  import type { DetailedCefrLevel } from '$lib/domain/types.ts';

  type ChapterAction = {
    href: string;
    label: string;
    primary: boolean;
  };

  let showAllLevels = $state(false);
  let showAllCurrentLevelChapters = $state(false);
  let courseQuery = $state('');
  let chapters = $state<CoursePathChapterView[]>([]);
  let courseReady = $state(false);

  onMount(async () => {
    await appStore.initialize();
    const path = await loadCoursePath(
      $appStore.course,
      $appStore.settings?.grammarLevel ?? 'A1.1',
      $motherTongue,
    );
    chapters = path.chapters;
    courseReady = true;
  });

  const levelGroups = $derived.by(() =>
    DETAILED_CEFR_LEVELS.map((level) => ({
      level,
      chapters: chapters.filter((view) => view.chapter.level === level),
    })).filter((group) => group.chapters.length > 0),
  );
  const visibleLevelGroups = $derived.by(() => {
    const normalized = courseQuery
      .trim()
      .toLocaleLowerCase($motherTongue === 'cs' ? 'cs-CZ' : 'en');
    if (!normalized) return levelGroups;
    return levelGroups
      .map((group) => ({
        ...group,
        chapters: group.chapters.filter((view) => {
          const copy = courseChapterCopy($motherTongue, view.chapter);
          return [
            group.level,
            copy.title,
            copy.subtitle,
            copy.mission,
            ...copy.outcomes,
            ...view.chapter.words.flatMap((word) => [
              word.displayGerman,
              word.primaryCzech,
              ...word.contexts,
              ...word.collocations,
            ]),
          ]
            .join(' ')
            .toLocaleLowerCase($motherTongue === 'cs' ? 'cs-CZ' : 'en')
            .includes(normalized);
        }),
      }))
      .filter((group) => group.chapters.length > 0);
  });
  const currentChapter = $derived(
    chapters.find((view) => view.current) ??
      chapters.find((view) => view.unlocked && !view.completed) ??
      chapters.at(-1),
  );
  const currentLevel = $derived(currentChapter?.chapter.level);
  const currentLevelChapters = $derived(
    chapters.filter((view) => view.chapter.level === currentLevel),
  );
  const currentLevelCompleted = $derived(
    currentLevelChapters.filter((view) => view.completed).length,
  );
  const currentLevelCompletedRequired = $derived(
    currentLevelChapters.reduce((sum, view) => sum + view.completedRequired, 0),
  );
  const currentLevelRequired = $derived(
    currentLevelChapters.reduce((sum, view) => sum + view.requiredTotal, 0),
  );
  const currentLevelMinutes = $derived(levelMinutes(currentLevelChapters));
  const currentLevelPercent = $derived(
    Math.round((currentLevelCompletedRequired / Math.max(1, currentLevelRequired)) * 100),
  );

  function levelId(level: DetailedCefrLevel): string {
    return `uroven-${level.toLocaleLowerCase().replace('.', '-')}`;
  }

  function levelCompleted(group: CoursePathChapterView[]): number {
    return group.filter((view) => view.completed).length;
  }

  function levelMinutes(group: CoursePathChapterView[]): number {
    return group.reduce((sum, view) => sum + coursePathChapterMinutes(view.chapter), 0);
  }

  function isCurrentLevelPreview(
    group: CoursePathChapterView[],
    view: CoursePathChapterView,
  ): boolean {
    const fallbackIndex = group.findIndex((item) => item.unlocked && !item.completed);
    const currentIndex = group.findIndex((item) => item.current);
    const pivot = currentIndex >= 0 ? currentIndex : Math.max(0, fallbackIndex);
    const start = Math.max(0, Math.min(pivot - 1, group.length - 4));
    const index = group.indexOf(view);
    return index >= start && index < start + 4;
  }

  function hiddenPreviewCount(group: CoursePathChapterView[]): number {
    return group.filter((view) => !isCurrentLevelPreview(group, view)).length;
  }

  function chapterState(view: CoursePathChapterView): 'completed' | 'current' | 'open' | 'locked' {
    if (view.completed) return 'completed';
    if (view.current) return 'current';
    return view.unlocked ? 'open' : 'locked';
  }

  function chapterStateLabel(view: CoursePathChapterView): string {
    const state = chapterState(view);
    if (state === 'completed') return t($motherTongue, 'course.completeChapter');
    if (state === 'current') return t($motherTongue, 'course.continueHere');
    if (state === 'open') return t($motherTongue, 'course.openChapter');
    return t($motherTongue, 'course.lockedChapter');
  }

  function currentNode(view: CoursePathChapterView): CoursePathNode | undefined {
    return view.nodes.find(
      (nodeView) => nodeView.state === 'current' || nodeView.state === 'in-progress',
    )?.node;
  }

  function checkpointNode(view: CoursePathChapterView): CoursePathNode | undefined {
    return view.nodes.find((nodeView) => nodeView.node.type === 'checkpoint')?.node;
  }

  function chapterAction(view: CoursePathChapterView): ChapterAction | undefined {
    const next = currentNode(view);
    if (next) {
      const inProgress = view.nodes.some(
        (nodeView) => nodeView.node.id === next.id && nodeView.state === 'in-progress',
      );
      return {
        href: coursePathNodeHref(next),
        label: inProgress
          ? t($motherTongue, 'course.continueStep')
          : t($motherTongue, 'course.startNextStep'),
        primary: true,
      };
    }

    if (view.completed) {
      const checkpoint = checkpointNode(view);
      return checkpoint
        ? {
            href: coursePathNodeHref(checkpoint),
            label: t($motherTongue, 'course.replay'),
            primary: false,
          }
        : undefined;
    }

    const firstAvailable = view.nodes.find((nodeView) => nodeView.state !== 'locked')?.node;
    return firstAvailable
      ? {
          href: coursePathNodeHref(firstAvailable),
          label: t($motherTongue, 'course.openChapterAction'),
          primary: true,
        }
      : undefined;
  }
</script>

<svelte:head>
  <title>{t($motherTongue, 'course.metaTitle')}</title>
  <meta name="description" content={t($motherTongue, 'course.metaDescription')} />
</svelte:head>

{#if !$appStore.ready || !$appStore.settings || !courseReady}
  <LoadingState label={t($motherTongue, 'course.loading')} />
{:else}
  <div class="syllabus-page">
    <a class="back-link" href="/"><ArrowLeft size={17} /> {t($motherTongue, 'course.back')}</a>

    <header class="syllabus-header">
      <div class="header-copy">
        <h1>{t($motherTongue, 'course.title')}</h1>
        <p>{t($motherTongue, 'course.description')}</p>
        <div class="header-links">
          <a href={`#${levelId(currentLevel ?? levelGroups[0]?.level ?? 'A1.1')}`}>
            {t($motherTongue, 'course.findCurrent')}
            <ArrowRight size={16} />
          </a>
          <a href="/grammar/"
            ><GraduationCap size={16} /> {t($motherTongue, 'course.grammarCatalog')}</a
          >
        </div>
      </div>

      <aside
        class="overall-progress"
        role="progressbar"
        aria-label={$motherTongue === 'cs'
          ? `Postup v úrovni ${currentLevel ?? ''}`
          : `Progress in level ${currentLevel ?? ''}`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={currentLevelPercent}
      >
        <div>
          <span>
            {$motherTongue === 'cs' ? `Moje úroveň ${currentLevel}` : `My level ${currentLevel}`}
          </span>
          <strong
            >{t($motherTongue, 'course.completedChapters', {
              done: currentLevelCompleted,
              total: currentLevelChapters.length,
            })}</strong
          >
        </div>
        <i><b style={`--course-progress:${currentLevelPercent / 100}`}></b></i>
        <p>
          {t($motherTongue, 'course.requiredSteps', {
            done: currentLevelCompletedRequired,
            total: currentLevelRequired,
          })}
          · {t($motherTongue, 'course.approxMinutes', { minutes: currentLevelMinutes })}
        </p>
      </aside>
    </header>

    <label class="course-search" for="course-search">
      <Search size={18} aria-hidden="true" />
      <input
        id="course-search"
        bind:value={courseQuery}
        placeholder={$motherTongue === 'cs'
          ? 'Hledat téma, situaci nebo slovíčko…'
          : 'Search a topic, situation, or word…'}
      />
      {#if courseQuery}<button type="button" onclick={() => (courseQuery = '')}>
          {$motherTongue === 'cs' ? 'Vymazat' : 'Clear'}
        </button>{/if}
    </label>

    <nav class="level-index" aria-label={t($motherTongue, 'course.levelNavigation')}>
      {#each visibleLevelGroups as group}
        <a
          class:current={group.level === currentLevel}
          class:completed={levelCompleted(group.chapters) === group.chapters.length}
          href={`#${levelId(group.level)}`}
          aria-current={group.level === currentLevel ? 'step' : undefined}
          onclick={() => (showAllLevels = true)}
        >
          <strong>{group.level}</strong>
          <span>{levelCompleted(group.chapters)}/{group.chapters.length}</span>
        </a>
      {/each}
    </nav>

    <button
      class="mobile-level-toggle"
      type="button"
      aria-expanded={showAllLevels}
      onclick={() => (showAllLevels = !showAllLevels)}
    >
      {showAllLevels
        ? $motherTongue === 'cs'
          ? 'Zobrazit jen moji úroveň'
          : 'Show only my level'
        : $motherTongue === 'cs'
          ? `Zobrazit celý kurz A1–C1`
          : 'Show the full A1–C1 course'}
      <ChevronDown size={17} aria-hidden="true" />
    </button>

    <div class:show-all-levels={showAllLevels || Boolean(courseQuery)} class="level-stack">
      {#each visibleLevelGroups as group}
        <section
          id={levelId(group.level)}
          class:current-level={group.level === currentLevel}
          class:completed-level={levelCompleted(group.chapters) === group.chapters.length}
          class:show-all-current-chapters={showAllCurrentLevelChapters ||
            showAllLevels ||
            Boolean(courseQuery)}
          class="level-section"
          aria-labelledby={`${levelId(group.level)}-title`}
        >
          <header class="level-header">
            <span class="level-code">{group.level}</span>
            <div>
              <h2 id={`${levelId(group.level)}-title`}>
                {courseLevelName($motherTongue, group.level)}
              </h2>
              <p>
                {t($motherTongue, 'course.chapterCount', { count: group.chapters.length })} ·
                {t($motherTongue, 'course.approxMinutes', {
                  minutes: levelMinutes(group.chapters),
                })}
              </p>
            </div>
            <strong
              >{t($motherTongue, 'course.completeCount', {
                done: levelCompleted(group.chapters),
                total: group.chapters.length,
              })}</strong
            >
          </header>

          <CourseMilestonePreview level={group.level} />
          <ol class="chapter-list">
            {#each group.chapters as view}
              {@const state = chapterState(view)}
              {@const action = chapterAction(view)}
              {@const copy = courseChapterCopy($motherTongue, view.chapter)}
              <li
                class:mobile-preview-hidden={!isCurrentLevelPreview(group.chapters, view)}
                class={`chapter-row state-${state}`}
              >
                <details open={view.current}>
                  <summary>
                    <span class="chapter-index" aria-hidden="true">
                      {#if state === 'completed'}
                        <Check size={19} strokeWidth={3} />
                      {:else if state === 'current'}
                        <Play size={19} fill="currentColor" />
                      {:else if state === 'locked'}
                        <LockKeyhole size={17} />
                      {:else}
                        {String(view.chapter.number).padStart(2, '0')}
                      {/if}
                    </span>

                    <span class="chapter-summary">
                      <small>
                        {t($motherTongue, 'course.chapterLabel', {
                          number: String(view.chapter.number).padStart(2, '0'),
                        })}
                        · {t($motherTongue, 'course.stepCount', {
                          done: view.completedRequired,
                          total: view.requiredTotal,
                        })}
                      </small>
                      <strong>{copy.title}</strong>
                      <span>{copy.subtitle}</span>
                    </span>

                    <span class="state-label">{chapterStateLabel(view)}</span>
                    <ChevronDown class="chapter-chevron" size={19} />
                  </summary>

                  <div class="chapter-details">
                    <div class="chapter-mission">
                      <Target size={19} />
                      <p>{copy.mission}</p>
                    </div>

                    <div
                      class="chapter-progress"
                      role="progressbar"
                      aria-label={t($motherTongue, 'course.chapterProgress', {
                        title: copy.title,
                      })}
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={view.percent}
                    >
                      <span>{t($motherTongue, 'course.progressShort')}</span>
                      <i><b style={`--chapter-progress:${view.percent / 100}`}></b></i>
                      <strong>{view.percent}%</strong>
                    </div>

                    <div class="chapter-content">
                      <div>
                        <strong>{t($motherTongue, 'course.outcomes')}</strong>
                        <ul>
                          {#each copy.outcomes as outcome}
                            <li><Check size={15} /><span>{outcome}</span></li>
                          {/each}
                        </ul>
                      </div>
                      <aside>
                        <span>{t($motherTongue, 'home.corePattern')}</span>
                        <code lang="de">{view.chapter.grammarPattern}</code>
                      </aside>
                    </div>

                    <footer>
                      <span>
                        <Clock3 size={15} />
                        {t($motherTongue, 'course.minutesAndExpressions', {
                          minutes: coursePathChapterMinutes(view.chapter),
                          count: view.chapter.words.length,
                        })}
                      </span>
                      {#if action}
                        <a
                          class:btn-primary={action.primary}
                          class:btn-secondary={!action.primary}
                          class="btn-base"
                          href={action.href}
                        >
                          {action.label}<ArrowRight size={17} />
                        </a>
                      {:else}
                        <span class="lock-note"
                          ><LockKeyhole size={15} />
                          {t($motherTongue, 'course.finishPrevious')}</span
                        >
                      {/if}
                    </footer>
                  </div>
                </details>
              </li>
            {/each}
          </ol>
          {#if group.level === currentLevel && hiddenPreviewCount(group.chapters) > 0 && !showAllLevels && !courseQuery}
            <button
              class="chapter-slice-toggle"
              type="button"
              aria-expanded={showAllCurrentLevelChapters}
              onclick={() => (showAllCurrentLevelChapters = !showAllCurrentLevelChapters)}
            >
              {showAllCurrentLevelChapters
                ? $motherTongue === 'cs'
                  ? 'Skrýt ostatní kapitoly'
                  : 'Hide the other chapters'
                : $motherTongue === 'cs'
                  ? `Zobrazit dalších ${hiddenPreviewCount(group.chapters)} kapitol`
                  : `Show ${hiddenPreviewCount(group.chapters)} more chapters`}
              <ChevronDown size={17} aria-hidden="true" />
            </button>
          {/if}
        </section>
      {/each}
      {#if visibleLevelGroups.length === 0}
        <div class="course-empty">
          <Search size={25} aria-hidden="true" />
          <strong
            >{$motherTongue === 'cs'
              ? 'Nic takového v kurzu není.'
              : 'No course topic matches.'}</strong
          >
          <button type="button" onclick={() => (courseQuery = '')}>
            {$motherTongue === 'cs' ? 'Vymazat hledání' : 'Clear search'}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .syllabus-page {
    width: min(100%, 66rem);
    margin: 0 auto;
    padding-bottom: 1.5rem;
  }
  .back-link {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-cobalt-700);
    font-size: 0.8rem;
    font-weight: 800;
    text-decoration: none;
  }
  .syllabus-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(16rem, 19rem);
    align-items: end;
    gap: 1.5rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-ink-950) 18%, transparent);
    padding: 0.35rem 0 1.25rem;
  }
  h1 {
    margin: 0;
    font-size: 2.75rem;
    font-weight: 930;
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .header-copy > p {
    max-width: 42rem;
    margin: 0.55rem 0 0;
    color: var(--color-ink-800);
    font-size: 0.92rem;
    line-height: 1.5;
    text-wrap: pretty;
  }
  .header-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 1rem;
    margin-top: 0.85rem;
  }
  .header-links a {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-cobalt-700);
    font-size: 0.78rem;
    font-weight: 820;
    text-decoration: none;
  }
  .overall-progress {
    border: 1px solid var(--color-ink-950);
    border-radius: 0.55rem 0.9rem 0.55rem 0.55rem;
    background: var(--color-paper-50);
    padding: 0.85rem;
    box-shadow: 0 4px 0 var(--color-ink-950);
  }
  .overall-progress > div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .overall-progress span {
    color: var(--color-ink-800);
    font-size: 0.72rem;
  }
  .overall-progress strong {
    font-size: 0.86rem;
  }
  .overall-progress i,
  .chapter-progress i {
    display: block;
    overflow: hidden;
    border-radius: 999px;
    background: var(--color-paper-200);
  }
  .overall-progress i {
    height: 0.52rem;
    margin-top: 0.6rem;
  }
  .overall-progress b,
  .chapter-progress b {
    display: block;
    width: 100%;
    height: 100%;
    transform-origin: left;
    transition: transform 220ms var(--ease-out-emil);
  }
  .overall-progress b {
    background: var(--color-accent-500);
    transform: scaleX(var(--course-progress));
  }
  .overall-progress p {
    margin: 0.45rem 0 0;
    color: var(--color-ink-800);
    font-family: var(--font-mono);
    font-size: 0.65rem;
  }
  .level-index {
    display: flex;
    gap: 0.35rem;
    overflow-x: auto;
    margin-top: 1.15rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-ink-950) 15%, transparent);
    padding: 0.1rem 0 0.65rem;
    scrollbar-width: thin;
  }
  .course-search {
    display: grid;
    min-height: 3rem;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.6rem;
    margin-top: 1rem;
    border: 1px solid var(--color-line);
    border-radius: 0.4rem 0.85rem 0.4rem 0.4rem;
    background: var(--color-paper-50);
    padding: 0 0.8rem;
  }
  .course-search:focus-within {
    border-color: var(--color-cobalt-700);
    box-shadow: 0 0 0 3px rgb(49 83 199 / 0.12);
  }
  .course-search input {
    min-width: 0;
    border: 0;
    background: transparent;
    outline: 0;
  }
  .course-search button {
    color: var(--color-cobalt-700);
    font-size: 0.72rem;
    font-weight: 800;
  }
  .course-empty {
    display: grid;
    min-height: 14rem;
    place-items: center;
    align-content: center;
    gap: 0.55rem;
    color: var(--color-ink-600);
    text-align: center;
  }
  .course-empty button {
    color: var(--color-cobalt-700);
    font-size: 0.76rem;
    font-weight: 800;
    text-decoration: underline;
    text-underline-offset: 0.2rem;
  }
  .level-index a {
    display: flex;
    min-width: 5.15rem;
    min-height: 2.8rem;
    flex: 1 0 auto;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 20%, transparent);
    border-radius: 0.5rem 0.75rem 0.5rem 0.5rem;
    background: color-mix(in srgb, var(--color-paper-50) 70%, transparent);
    padding: 0.55rem 0.65rem;
    color: var(--color-ink-800);
    text-decoration: none;
    transition:
      transform 140ms var(--ease-out-emil),
      border-color 160ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil);
  }
  .level-index a.current {
    border-color: var(--color-ink-950);
    color: var(--color-ink-950);
    background: var(--color-accent-100);
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .level-index a.completed {
    color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .level-index strong {
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }
  .level-index span {
    font-size: 0.66rem;
    font-weight: 800;
  }
  .level-index a:active {
    transform: scale(0.97);
  }
  .level-stack {
    display: grid;
    gap: 2rem;
    margin-top: 1.5rem;
  }
  .mobile-level-toggle {
    display: none;
  }
  .chapter-slice-toggle {
    display: none;
  }
  .level-section {
    scroll-margin-top: 1rem;
  }
  .level-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.8rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem 1rem 0.65rem 0.65rem;
    color: var(--color-ink-950);
    background: var(--color-paper-50);
    padding: 0.85rem;
    box-shadow: 0 4px 0 color-mix(in srgb, var(--color-ink-950) 16%, transparent);
  }
  .current-level .level-header {
    color: white;
    background: var(--color-cobalt-700);
    box-shadow: 0 4px 0 var(--color-ink-950);
  }
  .completed-level .level-header {
    color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .level-code {
    display: grid;
    min-width: 3.5rem;
    height: 3.2rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 0.75rem 0.45rem 0.45rem;
    color: var(--color-ink-950);
    background: var(--color-accent-500);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 900;
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .level-header h2 {
    margin: 0;
    font-size: 1.28rem;
    line-height: 1.15;
    text-wrap: balance;
  }
  .level-header p {
    margin: 0.18rem 0 0;
    color: var(--color-ink-800);
    font-size: 0.72rem;
  }
  .current-level .level-header p {
    color: rgb(255 255 255 / 0.82);
  }
  .level-header > strong {
    font-family: var(--font-mono);
    font-size: 0.68rem;
  }
  .chapter-list {
    position: relative;
    margin: 0;
    padding: 0 0 0 1rem;
    list-style: none;
  }
  .chapter-list::before {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 2.4rem;
    width: 5px;
    background: color-mix(in srgb, var(--color-cobalt-700) 20%, var(--color-paper-200));
    content: '';
  }
  .chapter-row {
    position: relative;
  }
  details {
    border-bottom: 1px solid color-mix(in srgb, var(--color-ink-950) 16%, transparent);
  }
  summary {
    position: relative;
    z-index: 1;
    display: grid;
    min-height: 5.25rem;
    grid-template-columns: 3rem minmax(0, 1fr) auto 1.5rem;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 0.5rem;
    cursor: pointer;
    list-style: none;
    transition: background-color 160ms var(--ease-out-emil);
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .state-current summary {
    background: var(--color-accent-100);
  }
  .state-locked summary {
    color: var(--color-ink-600);
  }
  .chapter-index {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border: 2px solid var(--color-ink-950);
    border-radius: 50%;
    color: white;
    background: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 900;
    box-shadow: 0 4px 0 color-mix(in srgb, var(--color-cobalt-700) 65%, black);
  }
  .state-current .chapter-index {
    color: var(--color-ink-950);
    background: var(--color-accent-500);
    box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent-500) 55%, black);
  }
  .state-completed .chapter-index {
    background: var(--color-mint-700);
    box-shadow: 0 4px 0 color-mix(in srgb, var(--color-mint-700) 70%, black);
  }
  .state-locked .chapter-index {
    border-color: color-mix(in srgb, var(--color-ink-950) 46%, transparent);
    color: var(--color-ink-600);
    background: var(--color-paper-200);
    box-shadow: 0 4px 0 color-mix(in srgb, var(--color-paper-200) 72%, black);
  }
  .chapter-summary {
    display: grid;
    min-width: 0;
  }
  .chapter-summary small {
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 800;
  }
  .state-locked .chapter-summary small {
    color: var(--color-ink-600);
  }
  .chapter-summary > strong {
    margin-top: 0.16rem;
    font-size: 1rem;
    line-height: 1.2;
    text-wrap: balance;
  }
  .chapter-summary > span {
    overflow: hidden;
    margin-top: 0.16rem;
    color: var(--color-ink-800);
    font-size: 0.76rem;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .state-locked .chapter-summary > span {
    color: var(--color-ink-600);
  }
  .state-label {
    color: var(--color-ink-800);
    font-size: 0.7rem;
    font-weight: 820;
    white-space: nowrap;
  }
  .state-current .state-label {
    color: var(--color-cobalt-700);
  }
  .state-completed .state-label {
    color: var(--color-mint-700);
  }
  .chapter-chevron {
    transition: transform 160ms var(--ease-out-emil);
  }
  details[open] summary :global(.chapter-chevron) {
    transform: rotate(180deg);
  }
  .chapter-details {
    position: relative;
    z-index: 1;
    margin: 0 0 0.7rem 3.75rem;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 20%, transparent);
    border-radius: 0.55rem 0.85rem 0.55rem 0.55rem;
    background: var(--color-paper-50);
    padding: 0.85rem;
  }
  .chapter-mission {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.55rem;
    color: var(--color-cobalt-700);
  }
  .chapter-mission p {
    margin: 0;
    color: var(--color-ink-950);
    font-size: 0.84rem;
    font-weight: 780;
    line-height: 1.4;
  }
  .chapter-progress {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    margin-top: 0.75rem;
    font-size: 0.68rem;
  }
  .chapter-progress i {
    height: 0.38rem;
  }
  .chapter-progress b {
    background: var(--color-cobalt-700);
    transform: scaleX(var(--chapter-progress));
  }
  .chapter-content {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(13rem, 0.75fr);
    gap: 0.8rem;
    margin-top: 0.8rem;
    border-top: 1px solid color-mix(in srgb, var(--color-ink-950) 14%, transparent);
    padding-top: 0.8rem;
  }
  .chapter-content > div > strong {
    font-size: 0.74rem;
  }
  .chapter-content ul {
    display: grid;
    gap: 0.35rem;
    margin: 0.45rem 0 0;
    padding: 0;
    list-style: none;
  }
  .chapter-content li {
    display: flex;
    align-items: start;
    gap: 0.35rem;
    color: var(--color-ink-800);
    font-size: 0.73rem;
    line-height: 1.4;
  }
  .chapter-content li :global(svg) {
    flex: none;
    margin-top: 0.08rem;
    color: var(--color-mint-700);
  }
  .chapter-content aside {
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 16%, transparent);
    border-radius: 0.45rem 0.7rem 0.45rem 0.45rem;
    padding: 0.65rem;
  }
  .chapter-content aside span {
    color: var(--color-ink-800);
    font-size: 0.66rem;
  }
  .chapter-content code {
    display: block;
    margin-top: 0.25rem;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    font-weight: 760;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .chapter-details footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.8rem;
    border-top: 1px solid color-mix(in srgb, var(--color-ink-950) 14%, transparent);
    padding-top: 0.75rem;
  }
  .chapter-details footer > span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-ink-800);
    font-size: 0.7rem;
  }
  .chapter-details footer a {
    flex: none;
    font-size: 0.78rem;
    text-decoration: none;
  }
  .lock-note {
    color: var(--color-ink-600) !important;
  }
  @media (hover: hover) and (pointer: fine) {
    .back-link:hover,
    .header-links a:hover {
      color: var(--color-ink-950);
    }
    .level-index a:hover:not(.current) {
      border-color: color-mix(in srgb, var(--color-ink-950) 38%, transparent);
      background: white;
    }
    summary:hover {
      background: color-mix(in srgb, var(--color-paper-50) 76%, transparent);
    }
    .state-current summary:hover {
      background: var(--color-accent-100);
    }
  }
  @media (max-width: 639px) {
    .mobile-level-toggle {
      display: flex;
      width: 100%;
      min-height: 2.85rem;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      margin-top: 0.85rem;
      border: 1px solid var(--color-line);
      border-radius: 0.35rem;
      color: var(--color-cobalt-700);
      background: var(--color-paper-50);
      font-size: 0.75rem;
      font-weight: 800;
    }
    .level-stack:not(.show-all-levels) .level-section:not(.current-level) {
      display: none;
    }
    .current-level:not(.show-all-current-chapters) .chapter-row.mobile-preview-hidden {
      display: none;
    }
    .chapter-slice-toggle {
      display: flex;
      width: calc(100% - 0.5rem);
      min-height: 2.85rem;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      margin: 0.65rem 0 0 0.5rem;
      border: 1px dashed color-mix(in srgb, var(--color-cobalt-700) 45%, transparent);
      border-radius: 0.4rem;
      color: var(--color-cobalt-700);
      background: color-mix(in srgb, var(--color-paper-50) 72%, transparent);
      font-size: 0.74rem;
      font-weight: 820;
    }
    .chapter-slice-toggle[aria-expanded='true'] :global(svg) {
      transform: rotate(180deg);
    }
    .level-stack {
      margin-top: 0.85rem;
    }
  }
  @media (max-width: 767px) {
    .syllabus-header {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    h1 {
      font-size: 2.2rem;
    }
    .overall-progress {
      width: 100%;
    }
    .level-stack {
      gap: 1.6rem;
    }
    .level-header {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .level-header > strong {
      grid-column: 2;
    }
    summary {
      grid-template-columns: 3rem minmax(0, 1fr) 1.25rem;
      gap: 0.6rem;
    }
    .state-label {
      grid-column: 2;
      grid-row: 2;
    }
    .chapter-chevron {
      grid-column: 3;
      grid-row: 1 / span 2;
    }
    .chapter-content {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 479px) {
    .header-links {
      display: grid;
      gap: 0.15rem;
    }
    .level-header {
      padding: 0.75rem;
    }
    .level-code {
      min-width: 3.15rem;
    }
    .level-header h2 {
      font-size: 1.08rem;
    }
    .chapter-list {
      padding-left: 0;
    }
    .chapter-list::before {
      left: 1.82rem;
    }
    summary {
      min-height: 5rem;
      grid-template-columns: 2.75rem minmax(0, 1fr) 1.15rem;
      padding-inline: 0.25rem;
    }
    .chapter-summary > span {
      display: none;
    }
    .chapter-details {
      margin-left: 0;
      padding: 0.75rem;
    }
    .chapter-details footer {
      display: grid;
    }
    .chapter-details footer a {
      width: 100%;
    }
  }
  @media (max-width: 359px) {
    .level-header > strong {
      display: none;
    }
    .chapter-summary small {
      font-size: 0.58rem;
    }
    .chapter-summary > strong {
      font-size: 0.88rem;
    }
  }
  @media (min-width: 768px) and (max-height: 800px) {
    .level-index {
      margin-top: 0.85rem;
      padding-bottom: 0.5rem;
    }
    .level-stack {
      gap: 1.25rem;
      margin-top: 1rem;
    }
    .level-header {
      padding: 0.7rem;
    }
    summary {
      min-height: 4.5rem;
      padding-block: 0.55rem;
    }
    .chapter-details {
      margin-bottom: 0.55rem;
      padding: 0.75rem;
    }
    .chapter-content {
      gap: 0.65rem;
      margin-top: 0.65rem;
      padding-top: 0.65rem;
    }
    .chapter-details footer {
      margin-top: 0.65rem;
      padding-top: 0.65rem;
    }
  }
</style>
