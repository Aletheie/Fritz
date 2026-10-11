<script lang="ts">
  import { goto } from '$app/navigation';
  import ChapterRail from '$lib/components/home/ChapterRail.svelte';
  import { createHomeViewModel } from '$lib/components/home/home-view-model.ts';
  import HomeHeader from '$lib/components/home/HomeHeader.svelte';
  import HomeJourney from '$lib/components/home/HomeJourney.svelte';
  import HomeQuickActions from '$lib/components/home/HomeQuickActions.svelte';
  import TodayPlanCard from '$lib/components/home/TodayPlanCard.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
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
  import { LiveCoursePath } from '$lib/state/live-course-path.svelte.ts';
  import { onMount } from 'svelte';

  const path = new LiveCoursePath();
  let onboarded = $state(false);

  onMount(async () => {
    await appStore.initialize();
    if ($appStore.settings && !$appStore.settings.onboardingCompleted) {
      await goto('/onboarding/', { replaceState: true });
      return;
    }
    onboarded = true;
  });

  // Progress from another tab, a new level or a language switch redraws the path.
  $effect(() => {
    if (!onboarded) return;
    void path.load($appStore.course, $appStore.settings?.grammarLevel ?? 'A1.1', $motherTongue);
  });

  const model = $derived(
    createHomeViewModel({
      chapters: path.chapters,
      recommended: path.recommendation,
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

{#if !$appStore.ready || !$appStore.settings || !path.ready}
  <LoadingState label={t($motherTongue, 'home.loading')} />
{:else}
  <div class="mx-auto w-full pb-5 min-[480px]:w-[min(100%,76rem)]">
    <HomeHeader game={model.game} />
    <div
      class="mt-[0.35rem] grid items-start gap-[1.15rem] [grid-template-areas:'plan'_'journey'_'rail'_'quick'] min-[900px]:grid-cols-[minmax(0,1fr)_minmax(17.5rem,18.5rem)] min-[900px]:gap-[1.35rem] min-[900px]:[grid-template-areas:'rail_rail'_'journey_plan'_'quick_plan'] min-[1280px]:grid-cols-[10.75rem_minmax(0,1fr)_18rem] min-[1280px]:gap-6 min-[1280px]:[grid-template-areas:'rail_journey_plan'_'rail_quick_plan']"
    >
      <ChapterRail class="[grid-area:rail]" items={model.rail} />
      <HomeJourney class="[grid-area:journey]" {model} />
      <TodayPlanCard
        class="[grid-area:plan]"
        daily={model.daily}
        dueCount={model.dueCount}
        {examPlan}
        {examReadiness}
      />
      <HomeQuickActions class="[grid-area:quick]" />
    </div>
  </div>
{/if}
