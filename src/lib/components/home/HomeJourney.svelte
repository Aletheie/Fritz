<script lang="ts">
  import { t } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Check from '@lucide/svelte/icons/check';

  import ChapterSection from './ChapterSection.svelte';

  import type { HomeViewModel } from './home-view-model.ts';

  let { model }: { model: HomeViewModel } = $props();
</script>

<div class="home-journey">
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
    <section class="journey-empty">
      <span><Check size={28} /></span>
      <p class="kicker">{t($motherTongue, 'home.courseJourney')}</p>
      <h2>{model.primary.title}</h2>
      <p>{model.primary.description}</p>
      <a class="btn-base btn-primary" href={model.primary.href}>{model.primary.action}</a>
    </section>
  {/if}
</div>

<style>
  .home-journey {
    display: grid;
    gap: 1.15rem;
    min-width: 0;
  }
  .journey-empty {
    border-radius: 0.65rem 1rem 0.65rem 0.65rem;
    background: var(--color-paper-50);
    padding: 2rem;
    text-align: center;
  }
  .journey-empty > span {
    display: grid;
    width: 3.5rem;
    height: 3.5rem;
    margin: 0 auto 0.9rem;
    place-items: center;
    border-radius: 50%;
    color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .journey-empty h2 {
    margin: 0.3rem 0 0;
    font-size: 1.8rem;
  }
  .journey-empty p:not(.kicker) {
    max-width: 32rem;
    margin: 0.5rem auto 1rem;
    color: var(--color-ink-600);
    line-height: 1.5;
  }
</style>
