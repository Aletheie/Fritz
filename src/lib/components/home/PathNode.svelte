<script lang="ts">
  import { t } from '$lib/i18n';
  import { courseLockReason, courseNodeCopy } from '$lib/i18n/course.ts';
  import { motherTongue } from '$lib/state/app';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Brain from '@lucide/svelte/icons/brain';
  import Check from '@lucide/svelte/icons/check';
  import FlaskConical from '@lucide/svelte/icons/flask-conical';
  import GraduationCap from '@lucide/svelte/icons/graduation-cap';
  import Headphones from '@lucide/svelte/icons/headphones';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import MessageCircleMore from '@lucide/svelte/icons/message-circle-more';
  import Star from '@lucide/svelte/icons/star';
  import Trophy from '@lucide/svelte/icons/trophy';

  import { coursePathNodeHref } from '../../domain/course/path-presentation.ts';
  import ContinueCard from './ContinueCard.svelte';
  import { nodeStateLabel, nodeTypeLabel } from './home-view-model.ts';

  import type { CoursePathNodeView } from '../../domain/course/path.ts';
  import type { HomeCourseAction } from './home-view-model.ts';

  let {
    view,
    position,
    action,
    secondaryAction,
  }: {
    view: CoursePathNodeView;
    position: number;
    action?: HomeCourseAction;
    secondaryAction?: boolean;
  } = $props();

  const stars = $derived(view.progress?.bestStars ?? 0);
  const copy = $derived(courseNodeCopy($motherTongue, view.node));
  const copyOnLeft = $derived(position > 0.1);
  const visibleStateLabel = $derived(
    view.state === 'locked'
      ? nodeTypeLabel(view.node.type, $motherTongue)
      : nodeStateLabel(view.state, $motherTongue),
  );
  const ariaLabel = $derived(
    [
      nodeTypeLabel(view.node.type, $motherTongue),
      copy.title,
      nodeStateLabel(view.state, $motherTongue),
      stars ? t($motherTongue, 'home.stars', { count: stars }) : undefined,
      courseLockReason($motherTongue, view.lockReason),
    ]
      .filter(Boolean)
      .join('. '),
  );

  const buttonTones: Record<string, string> = {
    current:
      'bg-accent-500 text-ink-950 outline-[0.42rem] outline-accent-100 [--node-depth:color-mix(in_srgb,var(--color-accent-500)_58%,black)]',
    'in-progress':
      'bg-accent-500 text-ink-950 outline-[0.42rem] outline-accent-100 [--node-depth:color-mix(in_srgb,var(--color-accent-500)_58%,black)]',
    completed:
      'bg-mint-700 text-white [--node-depth:color-mix(in_srgb,var(--color-mint-700)_72%,black)]',
    available:
      'bg-cobalt-300 text-ink-950 [--node-depth:color-mix(in_srgb,var(--color-cobalt-300)_60%,black)]',
    bonus:
      'bg-orange-100 text-orange-700 [--node-depth:color-mix(in_srgb,var(--color-orange-500)_60%,black)]',
    locked:
      'bg-paper-200 text-ink-600 [--node-depth:color-mix(in_srgb,var(--color-paper-200)_72%,black)]',
  };
  const labelTones: Record<string, string> = {
    current: 'text-ink-950',
    'in-progress': 'text-ink-950',
    completed: 'text-mint-700',
    locked: 'text-ink-600',
  };
  const button = $derived([
    'relative grid h-[4.25rem] w-[4.45rem] place-items-center border-2 border-ink-950 shadow-[0_6px_0_var(--node-depth)] [transition:transform_140ms_var(--ease-out-emil),filter_160ms_var(--ease-out-emil),box-shadow_140ms_var(--ease-out-emil)] active:shadow-[0_2px_0_var(--node-depth)] active:[transform:translateY(4px)_scale(0.97)] fine-hover:not-active:brightness-[1.06] fine-hover:not-active:[transform:translateY(-2px)] max-[560px]:h-16 max-[560px]:w-[4.2rem]',
    view.node.type === 'checkpoint' ? 'rounded-[0.8rem_1.05rem_0.8rem_0.8rem]' : 'rounded-[48%]',
    buttonTones[view.state] ??
      'bg-cobalt-700 text-white [--node-depth:color-mix(in_srgb,var(--color-cobalt-700)_72%,black)]',
  ]);
</script>

<li
  class="relative z-1 min-h-[7.35rem] max-[560px]:min-h-[8.35rem]"
  style={`--journey-x:${position}`}
>
  <div
    class="grid min-h-[7.35rem] grid-cols-[minmax(0,1fr)_5.25rem_minmax(0,1fr)] items-start max-[560px]:min-h-[8.35rem] max-[560px]:grid-cols-1 max-[560px]:grid-rows-[auto_auto]"
  >
    <div
      class="col-start-2 grid [transform:translateX(calc(var(--journey-x)*clamp(2.5rem,9cqi,4.25rem)))] place-items-center pt-[0.2rem] max-[560px]:col-start-1 max-[560px]:row-start-1 max-[560px]:w-[4.2rem] max-[560px]:[transform:translateX(calc(var(--journey-x)*2.55rem))] max-[560px]:justify-self-center"
      data-path-node-anchor
    >
      {#if view.state === 'locked'}
        <span class={button} data-testid="path-node-button" aria-hidden="true"
          ><LockKeyhole size={25} /></span
        >
      {:else}
        <a
          class={button}
          data-testid="path-node-button"
          href={coursePathNodeHref(view.node)}
          aria-current={view.state === 'current' || view.state === 'in-progress'
            ? 'step'
            : undefined}
          aria-label={ariaLabel}
        >
          {#if view.node.type === 'vocabulary' || view.node.type === 'reading'}
            <BookOpen size={27} />
          {:else if view.node.type === 'practice'}
            <Brain size={27} />
          {:else if view.node.type === 'grammar'}
            <GraduationCap size={27} />
          {:else if view.node.type === 'mix'}
            <Headphones size={27} />
          {:else if view.node.type === 'coach' || view.node.type === 'sentence'}
            <MessageCircleMore size={27} />
          {:else if view.node.type === 'checkpoint'}
            <Trophy size={29} />
          {:else}
            <FlaskConical size={27} />
          {/if}
          {#if view.state === 'completed'}
            <span
              class="absolute -right-[0.18rem] -bottom-[0.18rem] grid size-[1.45rem] place-items-center rounded-full border-3 border-paper-100 bg-mint-700 text-white"
              aria-hidden="true"><Check size={12} strokeWidth={3} /></span
            >
          {/if}
        </a>
      {/if}
    </div>

    <div
      class={[
        'min-w-0 max-[560px]:col-start-1 max-[560px]:row-start-2 max-[560px]:w-[12.5rem] max-[560px]:[transform:translateX(calc(var(--journey-x)*2.55rem))] max-[560px]:justify-self-center max-[560px]:px-1 max-[560px]:pt-[0.48rem] max-[560px]:pb-[0.4rem] max-[560px]:text-center',
        copyOnLeft
          ? 'col-start-1 row-start-1 pt-[0.3rem] pr-[0.9rem] pb-2 pl-[0.3rem] text-right'
          : 'col-start-3 pt-[0.3rem] pr-[0.3rem] pb-2 pl-[0.9rem]',
      ]}
    >
      <span
        class={[
          'font-mono text-[0.64rem] font-[820] tracking-[0.05em] uppercase',
          labelTones[view.state] ?? 'text-cobalt-700',
        ]}>{visibleStateLabel}</span
      >
      <h3
        class={[
          'mt-[0.18rem] text-[0.9rem] leading-[1.22] font-[880] text-balance',
          view.state === 'locked' && 'text-ink-600',
        ]}
      >
        {copy.title}
      </h3>
      {#if view.state !== 'locked'}
        <p class="mt-[0.24rem] text-[0.74rem] leading-[1.35] text-ink-800">
          {nodeTypeLabel(view.node.type, $motherTongue)} · {view.node.minutes} min
        </p>
      {/if}
      {#if stars}
        <small
          class={[
            'mt-[0.28rem] flex gap-[0.1rem] text-orange-700 max-[560px]:justify-center',
            copyOnLeft && 'justify-end',
          ]}
          aria-label={t($motherTongue, 'home.stars', { count: stars })}
        >
          {#each [1, 2, 3] as star}
            <Star size={13} fill={star <= stars ? 'currentColor' : 'none'} />
          {/each}
        </small>
      {/if}
    </div>
  </div>

  {#if action}
    <ContinueCard {action} secondary={secondaryAction} />
  {/if}
</li>
