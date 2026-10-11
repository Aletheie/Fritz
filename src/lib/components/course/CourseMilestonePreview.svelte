<script lang="ts">
  import { courseMilestones } from '$lib/domain/course/content/activities/course-milestones.ts';
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
  <aside class="flex items-start gap-3 px-1 py-4 text-cobalt-700">
    <Flag class="mt-[0.1rem] flex-none" size={20} aria-hidden="true" />
    <div class="min-w-0">
      <p class="mt-0 mb-1 text-[0.78rem] font-bold">
        {localized($motherTongue, {
          cs: `Závěrečná mise ${milestone.level}`,
          en: `${milestone.level} final mission`,
        })}
      </p>
      <strong class="block text-[1rem] leading-[1.4] text-ink-950"
        >{localized($motherTongue, milestone.title)}</strong
      >
      <span class="mt-1 block max-w-[65ch] text-[0.86rem] leading-normal text-ink-800"
        >{localized($motherTongue, milestone.goal)}</span
      >
    </div>
  </aside>
{/if}
