<script lang="ts">
  import { t } from '$lib/i18n';
  import { courseNodeCopy } from '$lib/i18n/course.ts';
  import { motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Sparkles from '@lucide/svelte/icons/sparkles';

  import { nodeTypeLabel } from './home-view-model.ts';
  import type { HomeCourseAction } from './home-view-model.ts';

  let { action, secondary = false }: { action: HomeCourseAction; secondary?: boolean } = $props();
  const copy = $derived(courseNodeCopy($motherTongue, action.node));
</script>

<aside
  class:secondary
  class="continue-card"
  aria-label={t($motherTongue, 'home.courseContinuation')}
>
  <p>
    {action.state === 'in-progress'
      ? t($motherTongue, 'home.inProgress')
      : t($motherTongue, 'home.readyNext')}
  </p>
  <h4>{copy.title}</h4>
  <div class="meta">
    <span><Clock3 size={14} /> {action.node.minutes} min</span>
    <span>{nodeTypeLabel(action.node.type, $motherTongue)}</span>
    {#if action.xp > 0}<span><Sparkles size={14} /> +{action.xp} XP</span>{/if}
  </div>
  <a
    class:btn-secondary={secondary}
    class:btn-primary={!secondary}
    class="btn-base"
    href={action.href}
  >
    {action.label}<ArrowRight size={18} />
  </a>
</aside>

<style>
  .continue-card {
    position: relative;
    z-index: 3;
    width: min(21.5rem, calc(100% - 1rem));
    margin: -0.25rem auto 1.35rem;
    border: 2px solid var(--color-ink-950);
    border-radius: 0.55rem 0.9rem 0.55rem 0.55rem;
    background: white;
    padding: 0.82rem;
    box-shadow: 0 5px 0 var(--color-ink-950);
    transform-origin: top center;
  }
  .continue-card::before {
    position: absolute;
    top: -0.48rem;
    left: calc(50% - 0.38rem);
    width: 0.76rem;
    height: 0.76rem;
    border-top: 2px solid var(--color-ink-950);
    border: 1px solid var(--color-ink-950);
    background: white;
    content: '';
    transform: rotate(45deg);
  }
  .continue-card.secondary {
    border-width: 1px;
    background: var(--color-paper-50);
    box-shadow: 0 4px 0 color-mix(in srgb, var(--color-ink-950) 20%, transparent);
  }
  .continue-card.secondary::before {
    border-width: 1px;
    background: var(--color-paper-50);
  }
  p {
    margin: 0;
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.64rem;
    font-weight: 820;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  h4 {
    margin: 0.2rem 0 0;
    font-size: 1rem;
    line-height: 1.22;
    text-wrap: balance;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.7rem;
    margin-top: 0.38rem;
    color: var(--color-ink-600);
    font-size: 0.7rem;
  }
  .meta span {
    display: inline-flex;
    align-items: center;
    gap: 0.22rem;
  }
  a {
    width: 100%;
    margin-top: 0.65rem;
    font-size: 0.92rem;
  }
</style>
