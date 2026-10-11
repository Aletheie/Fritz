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
  class={[
    'relative z-3 mx-auto mt-[-0.25rem] mb-[1.35rem] w-[min(21.5rem,calc(100%-1rem))] origin-top rounded-[0.55rem_0.9rem_0.55rem_0.55rem] border-ink-950 p-[0.82rem]',
    'before:absolute before:top-[-0.48rem] before:left-[calc(50%-0.38rem)] before:size-[0.76rem] before:rotate-45 before:border before:border-ink-950',
    secondary
      ? 'border bg-paper-50 shadow-[0_4px_0_color-mix(in_srgb,var(--color-ink-950)_20%,transparent)] before:bg-paper-50'
      : 'border-2 bg-white shadow-[0_5px_0_var(--color-ink-950)] before:bg-white',
  ]}
  aria-label={t($motherTongue, 'home.courseContinuation')}
>
  <p class="m-0 font-mono text-[0.64rem] font-[820] tracking-[0.05em] text-cobalt-700 uppercase">
    {action.state === 'in-progress'
      ? t($motherTongue, 'home.inProgress')
      : t($motherTongue, 'home.readyNext')}
  </p>
  <h4 class="mt-[0.2rem] text-[1rem] leading-[1.22] text-balance">{copy.title}</h4>
  <div
    class="mt-[0.38rem] flex flex-wrap gap-x-[0.7rem] gap-y-[0.3rem] text-[0.7rem] text-ink-600 [&>span]:inline-flex [&>span]:items-center [&>span]:gap-[0.22rem]"
  >
    <span><Clock3 size={14} /> {action.node.minutes} min</span>
    <span>{nodeTypeLabel(action.node.type, $motherTongue)}</span>
    {#if action.xp > 0}<span><Sparkles size={14} /> +{action.xp} XP</span>{/if}
  </div>
  <a
    class={[
      'btn-base mt-[0.65rem] w-full text-[0.92rem]',
      secondary ? 'btn-secondary' : 'btn-primary',
    ]}
    href={action.href}
  >
    {action.label}<ArrowRight size={18} />
  </a>
</aside>
