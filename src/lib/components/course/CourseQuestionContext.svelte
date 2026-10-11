<script lang="ts">
  import type { CoursePathQuestion } from '$lib/domain/course/path-activities.ts';
  import { coursePathChapterById } from '$lib/domain/course/path.ts';
  import { localized } from '$lib/i18n';
  import { courseChapterCopy } from '$lib/i18n/course.ts';
  import { motherTongue } from '$lib/state/app';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';

  let { question }: { question: CoursePathQuestion } = $props();
  const source = $derived(coursePathChapterById(question.reviewChapterId ?? ''));
</script>

{#if source}
  <div class="my-4 flex items-start gap-[0.6rem] text-cobalt-700">
    <RotateCcw size={17} aria-hidden="true" />
    <p class="m-0 grid gap-[0.15rem] text-[0.82rem]">
      <strong>{localized($motherTongue, { cs: 'Krátký návrat', en: 'A quick revisit' })}</strong>
      <span class="text-ink-800">{courseChapterCopy($motherTongue, source).title}</span>
    </p>
  </div>
{/if}
{#if question.context}
  <div class="my-4 border-y border-line py-4">
    <strong class="text-[0.9rem]">{question.context.title}</strong>
    <p
      class="mt-[0.55rem] max-w-[65ch] text-[1rem] leading-[1.65] text-pretty text-ink-950"
      lang="de"
    >
      {question.context.text}
    </p>
  </div>
{/if}
