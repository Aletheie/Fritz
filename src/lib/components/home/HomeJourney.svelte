<script lang="ts">
  import { t } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Check from '@lucide/svelte/icons/check';

  import ChapterSection from './ChapterSection.svelte';

  import type { HomeViewModel } from './home-view-model.ts';

  let { model, class: className = '' }: { model: HomeViewModel; class?: string } = $props();
</script>

<div class={['grid min-w-0 gap-[1.15rem]', className]} data-testid="home-journey">
  {#if model.currentChapter}
    <ChapterSection
      chapter={model.currentChapter}
      number={model.currentChapterIndex + 1}
      total={model.rail.length}
      minutes={model.chapterMinutes}
      courseAction={model.courseAction}
      reviewIsPrimary={false}
      previousChapter={model.previousChapter}
      nextChapter={model.nextChapter}
    />
  {:else}
    <section class="rounded-[0.65rem_1rem_0.65rem_0.65rem] bg-paper-50 p-8 text-center">
      <span
        class="mx-auto mb-[0.9rem] grid size-14 place-items-center rounded-full bg-mint-50 text-mint-700"
        ><Check size={28} /></span
      >
      <p class="kicker">{t($motherTongue, 'home.courseJourney')}</p>
      <h2 class="mt-[0.3rem] text-[1.8rem]">{model.primary.title}</h2>
      <p class="mx-auto mt-2 mb-4 max-w-lg leading-normal text-ink-600">
        {model.primary.description}
      </p>
      <a class="btn-base btn-primary" href={model.primary.href}>{model.primary.action}</a>
    </section>
  {/if}
</div>
