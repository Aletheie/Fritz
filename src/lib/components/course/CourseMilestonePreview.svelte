<script lang="ts">
  import { courseMilestones } from '$lib/domain/course/course-milestones.ts';
  import type { DetailedCefrLevel } from '$lib/domain/types.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Flag from '@lucide/svelte/icons/flag';
  import CourseLevelGuide from './CourseLevelGuide.svelte';

  let { level, chapterId }: { level?: DetailedCefrLevel; chapterId?: string } = $props();
  const milestone = $derived(
    courseMilestones.find((item) =>
      chapterId ? item.chapterId === chapterId : item.level === level,
    ),
  );
</script>

{#if milestone}
  {#if level}<CourseLevelGuide {level} />{/if}
  <aside class="milestone-preview">
    <Flag size={20} aria-hidden="true" />
    <div>
      <p>
        {localized($motherTongue, {
          cs: `Závěrečná mise ${milestone.level}`,
          en: `${milestone.level} final mission`,
        })}
      </p>
      <strong>{localized($motherTongue, milestone.title)}</strong>
      <span>{localized($motherTongue, milestone.goal)}</span>
    </div>
  </aside>
{/if}

<style>
  .milestone-preview {
    display: flex;
    align-items: start;
    gap: 0.75rem;
    padding: 1rem 0.25rem;
    color: var(--color-cobalt-700);
  }
  div {
    min-width: 0;
  }
  p {
    margin: 0 0 0.25rem;
    font-size: 0.78rem;
    font-weight: 700;
  }
  strong {
    display: block;
    color: var(--color-ink-950);
    font-size: 1rem;
    line-height: 1.4;
  }
  span {
    display: block;
    margin-top: 0.25rem;
    max-width: 65ch;
    color: var(--color-ink-800);
    font-size: 0.86rem;
    line-height: 1.5;
  }
  .milestone-preview :global(svg) {
    flex: none;
    margin-top: 0.1rem;
  }
</style>
