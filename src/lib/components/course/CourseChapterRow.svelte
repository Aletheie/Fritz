<script lang="ts">
  import {
    coursePathChapterMinutes,
    coursePathNodeHref,
  } from '$lib/domain/course/path-presentation.ts';
  import { t } from '$lib/i18n';
  import { courseChapterCopy } from '$lib/i18n/course.ts';
  import { motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import Play from '@lucide/svelte/icons/play';
  import Target from '@lucide/svelte/icons/target';

  import type { CoursePathChapterView } from '$lib/domain/course/path.ts';

  let { view, hideOnMobile }: { view: CoursePathChapterView; hideOnMobile: boolean } = $props();

  const state = $derived(
    view.completed ? 'completed' : view.current ? 'current' : view.unlocked ? 'open' : 'locked',
  );
  const copy = $derived(courseChapterCopy($motherTongue, view.chapter));
  const action = $derived(chapterAction());
  const stateLabels = {
    completed: 'course.completeChapter',
    current: 'course.continueHere',
    open: 'course.openChapter',
    locked: 'course.lockedChapter',
  } as const;

  const indexStyles = {
    completed:
      'border-ink-950 bg-mint-700 text-white shadow-[0_4px_0_color-mix(in_srgb,var(--color-mint-700)_70%,black)]',
    current:
      'border-ink-950 bg-accent-500 text-ink-950 shadow-[0_4px_0_color-mix(in_srgb,var(--color-accent-500)_55%,black)]',
    open: 'border-ink-950 bg-cobalt-700 text-white shadow-[0_4px_0_color-mix(in_srgb,var(--color-cobalt-700)_65%,black)]',
    locked:
      'border-[color-mix(in_srgb,var(--color-ink-950)_46%,transparent)] bg-paper-200 text-ink-600 shadow-[0_4px_0_color-mix(in_srgb,var(--color-paper-200)_72%,black)]',
  };
  const labelColors = {
    completed: 'text-mint-700',
    current: 'text-cobalt-700',
    open: 'text-ink-800',
    locked: 'text-ink-800',
  };
  const divider = 'border-t border-[color-mix(in_srgb,var(--color-ink-950)_14%,transparent)]';

  function chapterAction(): { href: string; label: string; primary: boolean } | undefined {
    const next = view.nodes.find(
      (nodeView) => nodeView.state === 'current' || nodeView.state === 'in-progress',
    );
    if (next)
      return {
        href: coursePathNodeHref(next.node),
        label: t(
          $motherTongue,
          next.state === 'in-progress' ? 'course.continueStep' : 'course.startNextStep',
        ),
        primary: true,
      };
    if (view.completed) {
      const checkpoint = view.nodes.find((nodeView) => nodeView.node.type === 'checkpoint')?.node;
      return (
        checkpoint && {
          href: coursePathNodeHref(checkpoint),
          label: t($motherTongue, 'course.replay'),
          primary: false,
        }
      );
    }
    const firstAvailable = view.nodes.find((nodeView) => nodeView.state !== 'locked')?.node;
    return (
      firstAvailable && {
        href: coursePathNodeHref(firstAvailable),
        label: t($motherTongue, 'course.openChapterAction'),
        primary: true,
      }
    );
  }
</script>

<li
  class={['relative', hideOnMobile && 'max-[640px]:hidden']}
  data-testid="chapter-row"
  data-state={state}
>
  <details
    class="group border-b border-[color-mix(in_srgb,var(--color-ink-950)_16%,transparent)]"
    open={view.current}
  >
    <summary
      class={[
        'relative z-1 grid min-h-21 cursor-pointer list-none grid-cols-[3rem_minmax(0,1fr)_auto_1.5rem] items-center gap-3 px-2 py-[0.7rem] [transition:background-color_160ms_var(--ease-out-emil)] max-[768px]:grid-cols-[3rem_minmax(0,1fr)_1.25rem] max-[768px]:gap-[0.6rem] max-[480px]:min-h-20 max-[480px]:grid-cols-[2.75rem_minmax(0,1fr)_1.15rem] max-[480px]:px-1 short-tablet:min-h-18 short-tablet:py-[0.55rem] [&::-webkit-details-marker]:hidden',
        state === 'current'
          ? 'bg-accent-100'
          : 'fine-hover:bg-[color-mix(in_srgb,var(--color-paper-50)_76%,transparent)]',
        state === 'locked' && 'text-ink-600',
      ]}
    >
      <span
        class={[
          'grid size-11 place-items-center rounded-full border-2 font-mono text-[0.68rem] font-black',
          indexStyles[state],
        ]}
        aria-hidden="true"
      >
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

      <span class="grid min-w-0">
        <small
          class={[
            'font-mono text-[0.62rem] font-extrabold max-[360px]:text-[0.58rem]',
            state === 'locked' ? 'text-ink-600' : 'text-cobalt-700',
          ]}
        >
          {t($motherTongue, 'course.chapterLabel', {
            number: String(view.chapter.number).padStart(2, '0'),
          })}
          · {t($motherTongue, 'course.stepCount', {
            done: view.completedRequired,
            total: view.requiredTotal,
          })}
        </small>
        <strong
          class="mt-[0.16rem] text-[1rem] leading-[1.2] text-balance max-[360px]:text-[0.88rem]"
          >{copy.title}</strong
        >
        <span
          class={[
            'mt-[0.16rem] truncate text-[0.76rem] leading-[1.35] max-[480px]:hidden',
            state === 'locked' ? 'text-ink-600' : 'text-ink-800',
          ]}>{copy.subtitle}</span
        >
      </span>

      <span
        class={[
          'text-[0.7rem] font-[820] whitespace-nowrap max-[768px]:col-start-2 max-[768px]:row-start-2',
          labelColors[state],
        ]}>{t($motherTongue, stateLabels[state])}</span
      >
      <ChevronDown
        class="[transition:transform_160ms_var(--ease-out-emil)] group-open:rotate-180 max-[768px]:col-start-3 max-[768px]:row-[1/span_2]"
        size={19}
      />
    </summary>

    <div
      class="relative z-1 mb-[0.7rem] ml-15 rounded-[0.55rem_0.85rem_0.55rem_0.55rem] border border-[color-mix(in_srgb,var(--color-ink-950)_20%,transparent)] bg-paper-50 p-[0.85rem] max-[480px]:ml-0 max-[480px]:p-3 short-tablet:mb-[0.55rem] short-tablet:p-3"
    >
      <div
        class="grid grid-cols-[auto_minmax(0,1fr)] gap-[0.55rem] text-cobalt-700"
        data-testid="chapter-mission"
      >
        <Target size={19} />
        <p class="m-0 text-[0.84rem] leading-[1.4] font-[780] text-ink-950">{copy.mission}</p>
      </div>

      <div
        class="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.65rem] text-[0.68rem]"
        role="progressbar"
        aria-label={t($motherTongue, 'course.chapterProgress', { title: copy.title })}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={view.percent}
      >
        <span>{t($motherTongue, 'course.progressShort')}</span>
        <i class="block h-[0.38rem] overflow-hidden rounded-full bg-paper-200"
          ><b
            class="block h-full w-full origin-left bg-cobalt-700 [transition:transform_220ms_var(--ease-out-emil)]"
            style:transform={`scaleX(${view.percent / 100})`}
          ></b></i
        >
        <strong>{view.percent}%</strong>
      </div>

      <div
        class="{divider} mt-[0.8rem] grid grid-cols-[minmax(0,1fr)_minmax(13rem,0.75fr)] gap-[0.8rem] pt-[0.8rem] max-[768px]:grid-cols-1 short-tablet:mt-[0.65rem] short-tablet:gap-[0.65rem] short-tablet:pt-[0.65rem]"
        data-testid="chapter-content"
      >
        <div>
          <strong class="text-[0.74rem]">{t($motherTongue, 'course.outcomes')}</strong>
          <ul class="mt-[0.45rem] mb-0 grid list-none gap-[0.35rem] p-0">
            {#each copy.outcomes as outcome}
              <li class="flex items-start gap-[0.35rem] text-[0.73rem] leading-[1.4] text-ink-800">
                <Check class="mt-[0.08rem] flex-none text-mint-700" size={15} /><span
                  >{outcome}</span
                >
              </li>
            {/each}
          </ul>
        </div>
        <aside
          class="rounded-[0.45rem_0.7rem_0.45rem_0.45rem] border border-[color-mix(in_srgb,var(--color-ink-950)_16%,transparent)] p-[0.65rem]"
        >
          <span class="text-[0.66rem] text-ink-800">{t($motherTongue, 'home.corePattern')}</span>
          <code
            class="mt-1 block font-mono text-[0.74rem] leading-[1.4] font-[760] wrap-anywhere"
            lang="de">{view.chapter.grammarPattern}</code
          >
        </aside>
      </div>

      <footer
        class="{divider} mt-[0.8rem] flex items-center justify-between gap-3 pt-3 max-[480px]:grid short-tablet:mt-[0.65rem] short-tablet:pt-[0.65rem]"
      >
        <span class="inline-flex items-center gap-[0.35rem] text-[0.7rem] text-ink-800">
          <Clock3 size={15} />
          {t($motherTongue, 'course.minutesAndExpressions', {
            minutes: coursePathChapterMinutes(view.chapter),
            count: view.chapter.words.length,
          })}
        </span>
        {#if action}
          <a
            class={[
              'btn-base flex-none text-[0.78rem] no-underline max-[480px]:w-full',
              action.primary ? 'btn-primary' : 'btn-secondary',
            ]}
            href={action.href}
          >
            {action.label}<ArrowRight size={17} />
          </a>
        {:else}
          <span class="inline-flex items-center gap-[0.35rem] text-[0.7rem] text-ink-600"
            ><LockKeyhole size={15} />
            {t($motherTongue, 'course.finishPrevious')}</span
          >
        {/if}
      </footer>
    </div>
  </details>
</li>
