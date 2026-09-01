<script lang="ts">
  import { goto } from '$app/navigation';
  import ChapterRail from '$lib/components/home/ChapterRail.svelte';
  import { createHomeViewModel } from '$lib/components/home/home-view-model.ts';
  import HomeHeader from '$lib/components/home/HomeHeader.svelte';
  import HomeJourney from '$lib/components/home/HomeJourney.svelte';
  import HomeQuickActions from '$lib/components/home/HomeQuickActions.svelte';
  import TodayPlanCard from '$lib/components/home/TodayPlanCard.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import type { CoursePathChapterView, CoursePathNode } from '$lib/domain/course/path.ts';
  import { examPlanReadiness } from '$lib/domain/exam-plan.ts';
  import { t } from '$lib/i18n';
  import {
    appStore,
    dailyProgress,
    dueCards,
    gameProgress,
    motherTongue,
    walletProgress,
  } from '$lib/state/app';
  import { loadCoursePath } from '$lib/state/course-path.ts';
  import { onMount } from 'svelte';

  let homeReady = $state(false);
  let chapters = $state<CoursePathChapterView[]>([]);
  let recommendation = $state<CoursePathNode | undefined>(undefined);

  onMount(async () => {
    await appStore.initialize();
    if ($appStore.settings && !$appStore.settings.onboardingCompleted) {
      await goto('/onboarding/', { replaceState: true });
      return;
    }
    const path = await loadCoursePath(
      $appStore.course,
      $appStore.settings?.grammarLevel ?? 'A1.1',
      $motherTongue,
    );
    chapters = path.chapters;
    recommendation = path.recommendation;
    homeReady = true;
  });

  const model = $derived(
    createHomeViewModel({
      chapters,
      recommended: recommendation,
      dueCount: $dueCards.length,
      daily: $dailyProgress,
      game: {
        streak: $gameProgress.streak,
        todayXp: $gameProgress.todayXp,
        level: $gameProgress.level.level,
        levelTitle: $gameProgress.level.title,
      },
      activeBoost: Boolean($walletProgress.activeBoost),
      learningGoal: $appStore.settings?.learningGoal ?? 'school',
      language: $motherTongue,
    }),
  );
  const examPlan = $derived($appStore.settings?.examPlan);
  const examReadiness = $derived(
    examPlan
      ? examPlanReadiness({
          plan: examPlan,
          notes: $appStore.notes,
          cards: $appStore.cards,
          reviews: $appStore.recentReviews,
        })
      : undefined,
  );
</script>

<svelte:head>
  <title>{t($motherTongue, 'home.metaTitle')}</title>
  <meta name="description" content={t($motherTongue, 'home.metaDescription')} />
</svelte:head>

{#if !$appStore.ready || !$appStore.settings || !homeReady}
  <LoadingState label={t($motherTongue, 'home.loading')} />
{:else}
  <div class="home-page">
    <HomeHeader game={model.game} />
    <div class="home-layout">
      <ChapterRail items={model.rail} />
      <HomeJourney {model} />
      <TodayPlanCard daily={model.daily} dueCount={model.dueCount} {examPlan} {examReadiness} />
      <HomeQuickActions />
    </div>
  </div>
{/if}

<style>
  .home-page {
    width: min(100%, 76rem);
    margin: 0 auto;
    padding-bottom: 1.25rem;
  }
  .home-layout {
    display: grid;
    grid-template-areas:
      'plan'
      'journey'
      'rail'
      'quick';
    gap: 1.15rem;
    align-items: start;
    margin-top: 0.35rem;
  }
  .home-layout > :global(.chapter-rail) {
    grid-area: rail;
  }
  .home-layout > :global(.home-journey) {
    grid-area: journey;
  }
  .home-layout > :global(.today-plan) {
    grid-area: plan;
  }
  .home-layout > :global(.quick-actions) {
    grid-area: quick;
  }

  @media (min-width: 900px) {
    .home-layout {
      grid-template-areas:
        'rail rail'
        'journey plan'
        'quick plan';
      grid-template-columns: minmax(0, 1fr) minmax(17.5rem, 18.5rem);
      gap: 1.35rem;
    }
  }

  @media (min-width: 1280px) {
    .home-layout {
      grid-template-areas:
        'rail journey plan'
        'rail quick plan';
      grid-template-columns: 10.75rem minmax(0, 1fr) 18rem;
      gap: 1.5rem;
    }
  }

  @media (max-width: 479px) {
    .home-page {
      width: 100%;
    }
  }
</style>
