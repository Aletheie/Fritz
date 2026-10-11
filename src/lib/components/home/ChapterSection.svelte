<script lang="ts">
  import CourseMilestonePreview from '$lib/components/course/CourseMilestonePreview.svelte';
  import { t } from '$lib/i18n';
  import { courseChapterCopy, coursePhaseCopy } from '$lib/i18n/course.ts';
  import { motherTongue } from '$lib/state/app';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import Target from '@lucide/svelte/icons/target';
  import Trophy from '@lucide/svelte/icons/trophy';
  import { onMount } from 'svelte';

  import { coursePathPhaseInfo } from '../../domain/course/path-presentation.ts';
  import { normalizedPathPosition } from './path-geometry.ts';
  import PathConnector from './PathConnector.svelte';
  import PathNode from './PathNode.svelte';

  import type { CoursePathChapterView } from '../../domain/course/path.ts';
  import type { HomeCourseAction } from './home-view-model.ts';

  let {
    chapter,
    number,
    total,
    minutes,
    courseAction,
    reviewIsPrimary,
    previousChapter,
    nextChapter,
  }: {
    chapter: CoursePathChapterView;
    number: number;
    total: number;
    minutes: number;
    courseAction?: HomeCourseAction;
    reviewIsPrimary: boolean;
    previousChapter?: CoursePathChapterView;
    nextChapter?: CoursePathChapterView;
  } = $props();

  let compactMobile = $state(false);
  let showFullPath = $state(false);
  const compactStart = $derived.by(() => {
    const actionIndex = courseAction
      ? chapter.nodes.findIndex((view) => view.node.id === courseAction.node.id)
      : -1;
    if (actionIndex >= 0) return actionIndex;
    const nextIndex = chapter.nodes.findIndex(
      (view) =>
        view.state === 'current' || view.state === 'in-progress' || view.state === 'available',
    );
    return Math.max(0, nextIndex);
  });
  const visibleNodes = $derived(
    compactMobile && !showFullPath
      ? chapter.nodes.slice(compactStart, compactStart + 2)
      : chapter.nodes,
  );

  onMount(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => (compactMobile = query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  });

  const copy = $derived(courseChapterCopy($motherTongue, chapter.chapter));
  const previousCopy = $derived(
    previousChapter ? courseChapterCopy($motherTongue, previousChapter.chapter) : undefined,
  );
  const nextCopy = $derived(
    nextChapter ? courseChapterCopy($motherTongue, nextChapter.chapter) : undefined,
  );

  function phaseStep(index: number): number {
    let count = 0;
    for (let cursor = 0; cursor <= index; cursor += 1) {
      if (
        cursor === 0 ||
        chapter.nodes[cursor - 1]?.node.phase !== chapter.nodes[cursor]?.node.phase
      ) {
        count += 1;
      }
    }
    return count;
  }

  const monoLabel = 'font-mono font-[780] tracking-[0.05em] uppercase';
  const noteRow =
    'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.7rem] px-[0.85rem] py-[0.8rem]';
  const noteTitle = 'text-[0.84rem] text-ink-950';
  const noteText = 'mt-[0.12rem] text-[0.75rem] leading-[1.4] text-ink-800';
</script>

<section id={chapter.chapter.id} class="min-w-0" aria-labelledby="journey-chapter-title">
  {#if previousChapter}
    <a
      class="mb-[0.65rem] inline-flex min-h-11 items-center gap-[0.55rem] text-mint-700 no-underline"
      href={`/#${previousChapter.chapter.id}`}
    >
      <span class="grid size-[1.7rem] place-items-center rounded-full bg-mint-50"
        ><Check size={15} strokeWidth={3} /></span
      >
      <span class="grid"
        ><small class="{monoLabel} text-[0.62rem] font-[760]">{t($motherTongue, 'home.done')}</small
        ><strong class="text-[0.8rem] text-ink-950">{previousCopy?.title}</strong></span
      >
    </a>
  {/if}

  <header
    class="grid grid-cols-[auto_minmax(0,1fr)_8.25rem] gap-x-4 gap-y-[0.9rem] rounded-[0.65rem_1rem_0.65rem_0.65rem] border border-ink-950 bg-cobalt-700 p-4 text-white shadow-[5px_5px_0_var(--color-ink-950)] max-[640px]:grid-cols-[auto_minmax(0,1fr)] max-[640px]:gap-[0.8rem] max-[640px]:p-[0.85rem] max-[640px]:shadow-[4px_4px_0_var(--color-ink-950)]"
  >
    <div
      class="grid size-[3.7rem] content-center justify-items-center rounded-[0.45rem_0.8rem_0.45rem_0.45rem] border border-ink-950 bg-accent-500 text-ink-950 shadow-[3px_3px_0_var(--color-ink-950)] max-[640px]:size-[3.2rem] max-[360px]:size-[2.85rem]"
      aria-hidden="true"
    >
      <span class="font-mono text-[0.55rem] font-extrabold tracking-[0.06em] uppercase"
        >{t($motherTongue, 'home.chapterAbbreviation')}</span
      >
      <strong class="mt-[0.05rem] font-mono text-[1.25rem] leading-none"
        >{String(number).padStart(2, '0')}</strong
      >
    </div>

    <div class="min-w-0">
      <p
        class="m-0 font-mono text-[0.68rem] font-extrabold tracking-[0.06em] text-[color-mix(in_srgb,white_75%,var(--color-cobalt-300))] uppercase"
      >
        {t($motherTongue, 'home.chapterPosition', {
          level: chapter.chapter.level,
          number,
          total,
        })}
      </p>
      <h2
        class="mt-[0.22rem] text-[2rem] leading-[1.02] font-[920] tracking-[-0.035em] text-balance max-[640px]:text-[1.65rem] max-[360px]:text-[1.48rem]"
        id="journey-chapter-title"
      >
        {copy.title}
      </h2>
      <span
        class="mt-[0.35rem] block max-w-[38rem] text-[0.84rem] leading-[1.4] text-white/78 max-[360px]:hidden"
        >{copy.subtitle}</span
      >
    </div>

    <div
      class="self-center max-[640px]:col-span-full max-[640px]:grid max-[640px]:grid-cols-[auto_minmax(0,1fr)] max-[640px]:items-center max-[640px]:gap-[0.7rem]"
      role="progressbar"
      aria-label={t($motherTongue, 'home.chapterProgress', { title: copy.title })}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={chapter.percent}
    >
      <div class="grid justify-items-end max-[640px]:justify-items-start">
        <strong class="font-mono text-[1rem]"
          >{chapter.completedRequired}/{chapter.requiredTotal}</strong
        >
        <span class="text-[0.68rem] text-white/85">{t($motherTongue, 'home.requiredSteps')}</span>
      </div>
      <i
        class="mt-[0.42rem] block h-[0.45rem] overflow-hidden rounded-full bg-white/18 max-[640px]:mt-0"
        ><b
          class="block h-full w-full origin-left bg-accent-500 transition-transform duration-220 ease-out-emil"
          style:transform={`scaleX(${chapter.percent / 100})`}
        ></b></i
      >
    </div>

    <div
      class="col-span-full grid grid-cols-[auto_minmax(0,1fr)] gap-[0.65rem] border-t border-white/20 pt-[0.8rem] text-accent-500"
      data-testid="chapter-mission"
    >
      <Target size={21} />
      <div class="grid">
        <span class="{monoLabel} text-[0.62rem] text-white/85"
          >{t($motherTongue, 'home.chapterGoal')}</span
        >
        <strong class="mt-[0.12rem] text-[0.87rem] leading-[1.4] text-white">{copy.mission}</strong>
      </div>
    </div>
  </header>

  <details
    class="group mt-[0.85rem] border-b border-[color-mix(in_srgb,var(--color-ink-950)_18%,transparent)]"
  >
    <summary
      class="grid min-h-[2.85rem] cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-[0.55rem] px-[0.35rem] py-[0.55rem] text-[0.82rem] max-[640px]:grid-cols-[minmax(0,1fr)_auto] [&::-webkit-details-marker]:hidden"
    >
      <span class="font-[820]">{t($motherTongue, 'home.chapterContents')}</span>
      <strong class="text-[0.73rem] text-ink-800 max-[640px]:col-start-1 max-[640px]:row-start-2"
        >{t($motherTongue, 'home.expressionsAndMinutes', {
          count: chapter.chapter.words.length,
          minutes,
        })}</strong
      >
      <ChevronDown
        class="transition-transform duration-160 ease-out-emil group-open:rotate-180 max-[640px]:col-start-2 max-[640px]:row-[1/span_2]"
        size={18}
      />
    </summary>
    <div
      class="grid grid-cols-[minmax(0,1fr)_minmax(12rem,0.72fr)] gap-[0.9rem] px-[0.35rem] pt-[0.3rem] pb-[0.85rem] max-[640px]:grid-cols-1"
    >
      <ul class="m-0 grid list-none gap-[0.4rem] p-0">
        {#each copy.outcomes as outcome}
          <li class="flex items-start gap-[0.4rem] text-[0.8rem] leading-[1.4] text-ink-800">
            <Check class="mt-[0.08rem] flex-none text-mint-700" size={16} /><span>{outcome}</span>
          </li>
        {/each}
      </ul>
      <aside
        class="rounded-[0.5rem_0.8rem_0.5rem_0.5rem] border border-[color-mix(in_srgb,var(--color-ink-950)_18%,transparent)] bg-paper-50 p-[0.65rem]"
      >
        <span class="text-[0.68rem] text-ink-600">{t($motherTongue, 'home.corePattern')}</span>
        <code
          class="mt-[0.28rem] block font-mono text-[0.78rem] leading-[1.4] font-[760] [overflow-wrap:anywhere]"
          lang="de">{chapter.chapter.grammarPattern}</code
        >
      </aside>
    </div>
  </details>

  <CourseMilestonePreview chapterId={chapter.chapter.id} />
  <div class="mx-auto mt-[1.1rem] flex items-baseline justify-between gap-4 px-[0.35rem]">
    <span class="text-[0.92rem] font-[880]">{t($motherTongue, 'home.pathThroughChapter')}</span>
    <strong class="font-mono text-[0.67rem] text-ink-800"
      >{t($motherTongue, 'home.stepsDone', {
        done: chapter.completedRequired,
        total: chapter.requiredTotal,
      })}</strong
    >
  </div>

  <PathConnector>
    <ol class="mx-auto mt-[0.55rem] w-[min(100%,39rem)] list-none p-0" data-testid="learning-path">
      {#each visibleNodes as view, index}
        {#if index === 0 || visibleNodes[index - 1]?.node.phase !== view.node.phase}
          {@const phase = coursePhaseCopy(
            $motherTongue,
            view.node.phase,
            coursePathPhaseInfo[view.node.phase],
          )}
          <li
            class="relative z-2 mx-auto mt-[0.35rem] mb-[0.6rem] grid min-h-[3.1rem] w-[min(100%,31rem)] grid-cols-[2rem_minmax(0,1fr)] items-center gap-[0.55rem] border-b border-[color-mix(in_srgb,var(--color-ink-950)_16%,transparent)] bg-paper-100 px-1 pb-[0.55rem]"
          >
            <span
              class="grid size-[1.85rem] place-items-center rounded-full border border-[color-mix(in_srgb,var(--color-ink-950)_24%,transparent)] bg-paper-50 font-mono text-[0.62rem] font-[850] text-cobalt-700"
              data-testid="phase-step"
              >{String(phaseStep(chapter.nodes.indexOf(view))).padStart(2, '0')}</span
            >
            <div
              class="flex items-baseline justify-between gap-3 max-[640px]:grid max-[640px]:gap-[0.12rem]"
            >
              <strong class="text-[0.82rem]">{phase.label}</strong>
              <small
                class="max-w-68 text-right text-[0.68rem] leading-[1.35] text-ink-800 max-[640px]:text-left"
                >{phase.description}</small
              >
            </div>
          </li>
        {/if}
        <PathNode
          {view}
          position={normalizedPathPosition(index, visibleNodes.length)}
          action={courseAction?.node.id === view.node.id ? courseAction : undefined}
          secondaryAction={reviewIsPrimary}
        />
      {/each}
    </ol>
  </PathConnector>

  {#if compactMobile && !showFullPath && chapter.nodes.length > visibleNodes.length}
    <button
      class="mx-auto mt-2 mb-[0.9rem] flex min-h-[2.85rem] w-[min(100%,31rem)] items-center justify-center gap-[0.45rem] rounded-[0.35rem] border border-line bg-paper-50 text-[0.75rem] font-[780] text-cobalt-700"
      type="button"
      onclick={() => (showFullPath = true)}
    >
      {t($motherTongue, 'home.pathThroughChapter')} · {chapter.nodes.length} kroků
      <ChevronDown size={17} aria-hidden="true" />
    </button>
  {/if}

  <footer
    class="{noteRow} rounded-[0.55rem_0.9rem_0.55rem_0.55rem] border border-[color-mix(in_srgb,var(--color-orange-700)_34%,transparent)] bg-orange-100 text-orange-700"
  >
    <Trophy size={21} />
    <div class="grid">
      <strong class={noteTitle}
        >{chapter.completed
          ? t($motherTongue, 'home.chapterClosed')
          : t($motherTongue, 'home.closeWithoutSupport')}</strong
      >
      <span class={noteText}>
        {chapter.completed
          ? t($motherTongue, 'home.checkpointRepeat')
          : t($motherTongue, 'home.checkpointDescription')}
      </span>
    </div>
  </footer>

  {#if nextChapter}
    <aside
      class="{noteRow} mt-[0.55rem] border-b border-[color-mix(in_srgb,var(--color-ink-950)_15%,transparent)] text-ink-600"
    >
      <span class="grid size-[2.3rem] place-items-center rounded-full bg-paper-200"
        ><LockKeyhole size={18} /></span
      >
      <div class="grid">
        <span class={noteText}
          >{t($motherTongue, 'home.then', { level: nextChapter.chapter.level })}</span
        >
        <strong class={noteTitle}>{nextCopy?.title}</strong>
      </div>
    </aside>
  {/if}
</section>
