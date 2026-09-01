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
</script>

<li
  class:copy-left={copyOnLeft}
  class:checkpoint={view.node.type === 'checkpoint'}
  class:has-action={Boolean(action)}
  class={`path-node state-${view.state}`}
  style={`--journey-x:${position}`}
>
  <div class="node-row">
    <div class="node-anchor" data-path-node-anchor>
      {#if view.state === 'locked'}
        <span class="node-button locked" aria-hidden="true"><LockKeyhole size={25} /></span>
      {:else}
        <a
          class="node-button"
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
            <span class="node-check" aria-hidden="true"><Check size={12} strokeWidth={3} /></span>
          {/if}
        </a>
      {/if}
    </div>

    <div class="node-copy">
      <span>{visibleStateLabel}</span>
      <h3>{copy.title}</h3>
      {#if view.state !== 'locked'}
        <p>{nodeTypeLabel(view.node.type, $motherTongue)} · {view.node.minutes} min</p>
      {/if}
      {#if stars}
        <small aria-label={t($motherTongue, 'home.stars', { count: stars })}>
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

<style>
  .path-node {
    position: relative;
    z-index: 1;
    min-height: 7.35rem;
  }
  .node-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 5.25rem minmax(0, 1fr);
    align-items: start;
    min-height: 7.35rem;
  }
  .node-anchor {
    grid-column: 2;
    display: grid;
    place-items: center;
    padding-top: 0.2rem;
    transform: translateX(calc(var(--journey-x) * clamp(2.5rem, 9cqi, 4.25rem)));
  }
  .node-button {
    --node-depth: color-mix(in srgb, var(--color-cobalt-700) 72%, black);
    position: relative;
    display: grid;
    width: 4.45rem;
    height: 4.25rem;
    place-items: center;
    border: 2px solid var(--color-ink-950);
    border-radius: 48%;
    color: white;
    background: var(--color-cobalt-700);
    box-shadow: 0 6px 0 var(--node-depth);
    transition:
      transform 140ms var(--ease-out-emil),
      filter 160ms var(--ease-out-emil),
      box-shadow 140ms var(--ease-out-emil);
  }
  .node-button:active {
    box-shadow: 0 2px 0 var(--node-depth);
    transform: translateY(4px) scale(0.97);
  }
  .node-copy {
    grid-column: 3;
    min-width: 0;
    padding: 0.3rem 0.3rem 0.5rem 0.9rem;
  }
  .copy-left .node-copy {
    grid-column: 1;
    grid-row: 1;
    padding: 0.3rem 0.9rem 0.5rem 0.3rem;
    text-align: right;
  }
  .node-copy > span {
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.64rem;
    font-weight: 820;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  h3 {
    margin: 0.18rem 0 0;
    font-size: 0.9rem;
    font-weight: 880;
    line-height: 1.22;
    text-wrap: balance;
  }
  p {
    margin: 0.24rem 0 0;
    color: var(--color-ink-800);
    font-size: 0.74rem;
    line-height: 1.35;
  }
  small {
    display: flex;
    gap: 0.1rem;
    margin-top: 0.28rem;
    color: var(--color-orange-700);
  }
  .copy-left small {
    justify-content: flex-end;
  }
  .node-check {
    position: absolute;
    right: -0.18rem;
    bottom: -0.18rem;
    display: grid;
    width: 1.45rem;
    height: 1.45rem;
    place-items: center;
    border: 3px solid var(--color-paper-100);
    border-radius: 50%;
    color: white;
    background: var(--color-mint-700);
  }
  .state-current .node-button,
  .state-in-progress .node-button {
    --node-depth: color-mix(in srgb, var(--color-accent-500) 58%, black);
    color: var(--color-ink-950);
    background: var(--color-accent-500);
    outline: 0.42rem solid var(--color-accent-100);
  }
  .state-current .node-copy > span,
  .state-in-progress .node-copy > span {
    color: var(--color-ink-950);
  }
  .state-completed .node-button {
    --node-depth: color-mix(in srgb, var(--color-mint-700) 72%, black);
    background: var(--color-mint-700);
  }
  .state-completed .node-copy > span {
    color: var(--color-mint-700);
  }
  .state-available .node-button {
    --node-depth: color-mix(in srgb, var(--color-cobalt-300) 60%, black);
    color: var(--color-ink-950);
    background: var(--color-cobalt-300);
  }
  .state-bonus .node-button {
    --node-depth: color-mix(in srgb, var(--color-orange-500) 60%, black);
    color: var(--color-orange-700);
    background: var(--color-orange-100);
  }
  .node-button.locked {
    --node-depth: color-mix(in srgb, var(--color-paper-200) 72%, black);
    color: var(--color-ink-600);
    background: var(--color-paper-200);
  }
  .state-locked .node-copy > span,
  .state-locked h3 {
    color: var(--color-ink-600);
  }
  .checkpoint .node-button {
    border-radius: 0.8rem 1.05rem 0.8rem 0.8rem;
  }
  @media (hover: hover) and (pointer: fine) {
    .node-button:hover:not(:active) {
      filter: brightness(1.06);
      transform: translateY(-2px);
    }
  }
  @media (max-width: 559px) {
    .path-node {
      min-height: 8.35rem;
    }
    .node-row {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto;
      min-height: 8.35rem;
    }
    .node-anchor {
      grid-column: 1;
      grid-row: 1;
      width: 4.2rem;
      justify-self: center;
      transform: translateX(calc(var(--journey-x) * 2.55rem));
    }
    .node-copy,
    .copy-left .node-copy {
      grid-column: 1;
      grid-row: 2;
      width: 12.5rem;
      justify-self: center;
      padding: 0.48rem 0.25rem 0.4rem;
      text-align: center;
      transform: translateX(calc(var(--journey-x) * 2.55rem));
    }
    .copy-left small,
    small {
      justify-content: center;
    }
    .node-button {
      width: 4.2rem;
      height: 4rem;
    }
  }
</style>
