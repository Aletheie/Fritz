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
  <div class="review-note">
    <RotateCcw size={17} aria-hidden="true" />
    <p>
      <strong>{localized($motherTongue, { cs: 'Krátký návrat', en: 'A quick revisit' })}</strong>
      <span>{courseChapterCopy($motherTongue, source).title}</span>
    </p>
  </div>
{/if}
{#if question.context}
  <div class="situation-context">
    <strong>{question.context.title}</strong>
    <p lang="de">{question.context.text}</p>
  </div>
{/if}

<style>
  .review-note {
    display: flex;
    align-items: start;
    gap: 0.6rem;
    margin: 1rem 0;
    color: var(--color-cobalt-700);
  }
  .review-note p {
    display: grid;
    gap: 0.15rem;
    margin: 0;
    font-size: 0.82rem;
  }
  .review-note span {
    color: var(--color-ink-800);
  }
  .situation-context {
    margin: 1rem 0;
    padding: 1rem 0;
    border-block: 1px solid var(--color-line);
  }
  .situation-context strong {
    font-size: 0.9rem;
  }
  .situation-context p {
    margin: 0.55rem 0 0;
    max-width: 65ch;
    color: var(--color-ink-950);
    font-size: 1rem;
    line-height: 1.65;
    text-wrap: pretty;
  }
</style>
