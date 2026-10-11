<script lang="ts">
  import CourseChapterRow from '$lib/components/course/CourseChapterRow.svelte';
  import CourseMilestonePreview from '$lib/components/course/CourseMilestonePreview.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { coursePathChapterMinutes } from '$lib/domain/course/path-presentation.ts';
  import { DETAILED_CEFR_LEVELS } from '$lib/domain/levels.ts';
  import { t } from '$lib/i18n';
  import { courseChapterCopy, courseLevelName } from '$lib/i18n/course.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import { LiveCoursePath } from '$lib/state/live-course-path.svelte.ts';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import GraduationCap from '@lucide/svelte/icons/graduation-cap';
  import Search from '@lucide/svelte/icons/search';
  import { onMount } from 'svelte';

  import type { CoursePathChapterView } from '$lib/domain/course/path.ts';
  import type { DetailedCefrLevel } from '$lib/domain/types.ts';

  let showAllLevels = $state(false);
  let showAllCurrentLevelChapters = $state(false);
  let courseQuery = $state('');
  const path = new LiveCoursePath();
  let initialized = $state(false);
  const chapters = $derived(path.chapters);
  const courseReady = $derived(path.ready);

  onMount(async () => {
    await appStore.initialize();
    initialized = true;
  });

  $effect(() => {
    if (!initialized) return;
    void path.load($appStore.course, $appStore.settings?.grammarLevel ?? 'A1.1', $motherTongue);
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

  const link =
    'inline-flex min-h-11 items-center gap-[0.4rem] font-extrabold text-cobalt-700 no-underline fine-hover:text-ink-950';
  const mobileToggle =
    'hidden min-h-[2.85rem] items-center justify-center gap-[0.45rem] text-cobalt-700 max-[640px]:flex';
</script>

<svelte:head>
  <title>{t($motherTongue, 'course.metaTitle')}</title>
  <meta name="description" content={t($motherTongue, 'course.metaDescription')} />
</svelte:head>

{#if !$appStore.ready || !$appStore.settings || !courseReady}
  <LoadingState label={t($motherTongue, 'course.loading')} />
{:else}
  {@const expanded = showAllLevels || Boolean(courseQuery)}
  <div class="mx-auto w-[min(100%,66rem)] pb-6">
    <a class="{link} text-[0.8rem]" href="/"
      ><ArrowLeft size={17} /> {t($motherTongue, 'course.back')}</a
    >

    <header
      class="grid grid-cols-[minmax(0,1fr)_minmax(16rem,19rem)] items-end gap-6 border-b border-[color-mix(in_srgb,var(--color-ink-950)_18%,transparent)] pt-[0.35rem] pb-5 max-[768px]:grid-cols-1 max-[768px]:gap-4"
    >
      <div>
        <h1
          class="m-0 text-[2.75rem] leading-none font-[930] tracking-[-0.04em] max-[768px]:text-[2.2rem]"
        >
          {t($motherTongue, 'course.title')}
        </h1>
        <p
          class="mt-[0.55rem] mb-0 max-w-[42rem] text-[0.92rem] leading-normal text-pretty text-ink-800"
        >
          {t($motherTongue, 'course.description')}
        </p>
        <div
          class="mt-[0.85rem] flex flex-wrap gap-x-4 gap-y-[0.45rem] max-[480px]:grid max-[480px]:gap-[0.15rem]"
        >
          <a
            class="{link} text-[0.78rem] font-[820]"
            href={`#${levelId(currentLevel ?? levelGroups[0]?.level ?? 'A1.1')}`}
          >
            {t($motherTongue, 'course.findCurrent')}
            <ArrowRight size={16} />
          </a>
          <a class="{link} text-[0.78rem] font-[820]" href="/grammar/"
            ><GraduationCap size={16} /> {t($motherTongue, 'course.grammarCatalog')}</a
          >
        </div>
      </div>

      <aside
        class="rounded-[0.55rem_0.9rem_0.55rem_0.55rem] border border-ink-950 bg-paper-50 p-[0.85rem] shadow-[0_4px_0_var(--color-ink-950)] max-[768px]:w-full"
        role="progressbar"
        aria-label={$motherTongue === 'cs'
          ? `Postup v úrovni ${currentLevel ?? ''}`
          : `Progress in level ${currentLevel ?? ''}`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={currentLevelPercent}
      >
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-[0.72rem] text-ink-800">
            {$motherTongue === 'cs' ? `Moje úroveň ${currentLevel}` : `My level ${currentLevel}`}
          </span>
          <strong class="text-[0.86rem]"
            >{t($motherTongue, 'course.completedChapters', {
              done: currentLevelCompleted,
              total: currentLevelChapters.length,
            })}</strong
          >
        </div>
        <i class="mt-[0.6rem] block h-[0.52rem] overflow-hidden rounded-full bg-paper-200"
          ><b
            class="block h-full w-full origin-left bg-accent-500 [transition:transform_220ms_var(--ease-out-emil)]"
            style:transform={`scaleX(${currentLevelPercent / 100})`}
          ></b></i
        >
        <p class="mt-[0.45rem] mb-0 font-mono text-[0.65rem] text-ink-800">
          {t($motherTongue, 'course.requiredSteps', {
            done: currentLevelCompletedRequired,
            total: currentLevelRequired,
          })}
          · {t($motherTongue, 'course.approxMinutes', { minutes: currentLevelMinutes })}
        </p>
      </aside>
    </header>

    <label
      class="mt-4 grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.6rem] rounded-[0.4rem_0.85rem_0.4rem_0.4rem] border border-line bg-paper-50 px-[0.8rem] focus-within:border-cobalt-700 focus-within:shadow-[0_0_0_3px_rgb(49_83_199/0.12)]"
      for="course-search"
    >
      <Search size={18} aria-hidden="true" />
      <input
        class="min-w-0 border-0 bg-transparent outline-0"
        id="course-search"
        bind:value={courseQuery}
        placeholder={$motherTongue === 'cs'
          ? 'Hledat téma, situaci nebo slovíčko…'
          : 'Search a topic, situation, or word…'}
      />
      {#if courseQuery}<button
          class="text-[0.72rem] font-extrabold text-cobalt-700"
          type="button"
          onclick={() => (courseQuery = '')}
        >
          {$motherTongue === 'cs' ? 'Vymazat' : 'Clear'}
        </button>{/if}
    </label>

    <nav
      class="mt-[1.15rem] flex [scrollbar-width:thin] gap-[0.35rem] overflow-x-auto border-b border-[color-mix(in_srgb,var(--color-ink-950)_15%,transparent)] pt-[0.1rem] pb-[0.65rem] short-tablet:mt-[0.85rem] short-tablet:pb-2"
      aria-label={t($motherTongue, 'course.levelNavigation')}
    >
      {#each visibleLevelGroups as group (group.level)}
        {@const current = group.level === currentLevel}
        {@const done = levelCompleted(group.chapters) === group.chapters.length}
        <a
          class={[
            'flex min-h-[2.8rem] min-w-[5.15rem] flex-[1_0_auto] items-center justify-between gap-2 rounded-[0.5rem_0.75rem_0.5rem_0.5rem] border px-[0.65rem] py-[0.55rem] no-underline [transition:transform_140ms_var(--ease-out-emil),border-color_160ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil)] active:[transform:scale(0.97)]',
            current
              ? 'border-ink-950 shadow-[2px_2px_0_var(--color-ink-950)]'
              : 'border-[color-mix(in_srgb,var(--color-ink-950)_20%,transparent)] fine-hover:border-[color-mix(in_srgb,var(--color-ink-950)_38%,transparent)] fine-hover:bg-white',
            done
              ? 'bg-mint-50 text-mint-700'
              : current
                ? 'bg-accent-100 text-ink-950'
                : 'bg-[color-mix(in_srgb,var(--color-paper-50)_70%,transparent)] text-ink-800',
          ]}
          href={`#${levelId(group.level)}`}
          aria-current={current ? 'step' : undefined}
          onclick={() => (showAllLevels = true)}
        >
          <strong class="font-mono text-[0.72rem]">{group.level}</strong>
          <span class="text-[0.66rem] font-extrabold"
            >{levelCompleted(group.chapters)}/{group.chapters.length}</span
          >
        </a>
      {/each}
    </nav>

    <button
      class="{mobileToggle} mt-[0.85rem] w-full rounded-[0.35rem] border border-line bg-paper-50 text-[0.75rem] font-extrabold"
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

    <div
      class="mt-6 grid gap-8 max-[768px]:gap-[1.6rem] max-[640px]:mt-[0.85rem] short-tablet:mt-4 short-tablet:gap-5"
    >
      {#each visibleLevelGroups as group (group.level)}
        {@const current = group.level === currentLevel}
        {@const done = levelCompleted(group.chapters) === group.chapters.length}
        <section
          id={levelId(group.level)}
          class={['scroll-mt-4', !expanded && !current && 'max-[640px]:hidden']}
          data-testid="level-section"
          aria-labelledby={`${levelId(group.level)}-title`}
        >
          <header
            class={[
              'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.8rem] rounded-[0.65rem_1rem_0.65rem_0.65rem] border border-ink-950 p-[0.85rem] max-[768px]:grid-cols-[auto_minmax(0,1fr)] max-[480px]:p-3 short-tablet:p-[0.7rem]',
              current
                ? 'shadow-[0_4px_0_var(--color-ink-950)]'
                : 'shadow-[0_4px_0_color-mix(in_srgb,var(--color-ink-950)_16%,transparent)]',
              done
                ? 'bg-mint-50 text-mint-700'
                : current
                  ? 'bg-cobalt-700 text-white'
                  : 'bg-paper-50 text-ink-950',
            ]}
          >
            <span
              class="grid h-[3.2rem] min-w-14 place-items-center rounded-[0.45rem_0.75rem_0.45rem_0.45rem] border border-ink-950 bg-accent-500 font-mono text-[0.78rem] font-black text-ink-950 shadow-[2px_2px_0_var(--color-ink-950)] max-[480px]:min-w-[3.15rem]"
              >{group.level}</span
            >
            <div>
              <h2
                class="m-0 text-[1.28rem] leading-[1.15] text-balance max-[480px]:text-[1.08rem]"
                id={`${levelId(group.level)}-title`}
              >
                {courseLevelName($motherTongue, group.level)}
              </h2>
              <p
                class={[
                  'mt-[0.18rem] mb-0 text-[0.72rem]',
                  current ? 'text-white/82' : 'text-ink-800',
                ]}
              >
                {t($motherTongue, 'course.chapterCount', { count: group.chapters.length })} ·
                {t($motherTongue, 'course.approxMinutes', {
                  minutes: levelMinutes(group.chapters),
                })}
              </p>
            </div>
            <strong class="font-mono text-[0.68rem] max-[768px]:col-start-2 max-[360px]:hidden"
              >{t($motherTongue, 'course.completeCount', {
                done: levelCompleted(group.chapters),
                total: group.chapters.length,
              })}</strong
            >
          </header>

          <CourseMilestonePreview level={group.level} />
          <ol
            class="relative m-0 list-none py-0 pr-0 pl-4 before:absolute before:inset-y-0 before:left-[2.4rem] before:w-[5px] before:bg-[color-mix(in_srgb,var(--color-cobalt-700)_20%,var(--color-paper-200))] before:content-[''] max-[480px]:pl-0 max-[480px]:before:left-[1.82rem]"
          >
            {#each group.chapters as view}
              <CourseChapterRow
                {view}
                hideOnMobile={current &&
                  !expanded &&
                  !showAllCurrentLevelChapters &&
                  !isCurrentLevelPreview(group.chapters, view)}
              />
            {/each}
          </ol>
          {#if current && hiddenPreviewCount(group.chapters) > 0 && !expanded}
            <button
              class="{mobileToggle} mt-[0.65rem] ml-2 w-[calc(100%-0.5rem)] rounded-[0.4rem] border border-dashed border-[color-mix(in_srgb,var(--color-cobalt-700)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-paper-50)_72%,transparent)] text-[0.74rem] font-[820] aria-expanded:[&>svg]:rotate-180"
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
        <div
          class="grid min-h-56 place-items-center content-center gap-[0.55rem] text-center text-ink-600"
        >
          <Search size={25} aria-hidden="true" />
          <strong
            >{$motherTongue === 'cs'
              ? 'Nic takového v kurzu není.'
              : 'No course topic matches.'}</strong
          >
          <button
            class="text-[0.76rem] font-extrabold text-cobalt-700 underline underline-offset-[0.2rem]"
            type="button"
            onclick={() => (courseQuery = '')}
          >
            {$motherTongue === 'cs' ? 'Vymazat hledání' : 'Clear search'}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
