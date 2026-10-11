<script lang="ts">
  import CourseWritingPortfolio from '$lib/components/course/CourseWritingPortfolio.svelte';
  import RivalDuel from '$lib/components/gamification/RivalDuel.svelte';
  import LevelBadge from '$lib/components/LevelBadge.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import MissionList from '$lib/components/MissionList.svelte';
  import PageHeading from '$lib/components/PageHeading.svelte';
  import WeeklyLearningReport from '$lib/components/progress/WeeklyLearningReport.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import { courseSummary } from '$lib/domain/course/grammar.ts';
  import {
    DAILY_MISSION_SET_BONUS_XP,
    masteryDistribution,
    masteryLabel,
  } from '$lib/domain/gamification.ts';
  import { localDateKey, recentAccuracy } from '$lib/domain/stats/learning.ts';
  import { languageTag } from '$lib/i18n';
  import {
    appClock,
    appStore,
    dailyProgress,
    gameProgress,
    motherTongue,
    tr,
  } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Award from '@lucide/svelte/icons/award';
  import BookOpenText from '@lucide/svelte/icons/book-open-text';
  import Brain from '@lucide/svelte/icons/brain';
  import Check from '@lucide/svelte/icons/check';
  import Flame from '@lucide/svelte/icons/flame';
  import Gift from '@lucide/svelte/icons/gift';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import MessageCircle from '@lucide/svelte/icons/message-circle';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Target from '@lucide/svelte/icons/target';
  import Trophy from '@lucide/svelte/icons/trophy';
  import { onMount } from 'svelte';

  import type { MasteryDistribution, MasteryTier } from '$lib/domain/gamification.ts';
  import type { ReviewStats } from '$lib/domain/stats/review-stats.ts';
  import type { CourseProgress, StudyCard } from '$lib/domain/types.ts';

  const tiers: MasteryTier[] = ['new', 'learning', 'familiar', 'strong', 'mastered'];
  const tierFill: Record<MasteryTier, string> = {
    new: 'bg-ink-600',
    learning: 'bg-coral-700',
    familiar: 'bg-butter-400',
    strong: 'bg-cobalt-700',
    mastered: 'bg-mint-700',
  };

  const card = 'p-[1.15rem] min-[640px]:p-6';
  const cardHeading = 'flex items-start justify-between gap-3';
  const cardTitle =
    'mt-1 text-[clamp(1.35rem,5vw,1.85rem)] leading-none font-black tracking-[-0.04em]';
  const sectionHeading =
    'flex flex-col items-start justify-between gap-[0.65rem] min-[900px]:flex-row min-[900px]:items-end';
  const sectionLead = 'max-w-[37rem] text-[0.78rem] leading-[1.55] text-ink-600';
  const compactTitle =
    'mt-1 text-[clamp(1.45rem,5vw,2rem)] leading-[0.98] font-[920] tracking-[-0.04em] text-balance';
  const iconTile = 'grid size-11 place-items-center rounded-[0.8rem]';
  const skillCard =
    'grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-line p-4 transition-colors duration-160 ease-out-emil last:border-b-0 active:bg-paper-100 fine-hover:bg-[color-mix(in_srgb,var(--color-paper-100)_72%,white)] min-[640px]:p-[1.2rem]';
  const skillTitle =
    'mt-1 max-w-md text-[1.08rem] leading-[1.15] font-[880] tracking-[-0.03em] text-balance';
  const skillStats = 'mt-[0.45rem] text-[0.71rem] leading-[1.45] text-ink-600';
  const skillLink =
    'col-start-2 inline-flex items-center justify-start gap-[0.35rem] pt-[0.15rem] text-[0.72rem] font-[820]';
  const metricValue =
    'block text-[clamp(1.45rem,6vw,2.1rem)] leading-none font-black tracking-[-0.04em]';
  const metricLabel = 'mt-[0.28rem] block text-[0.68rem] font-[720] text-ink-600';
  const chip =
    'inline-flex items-center gap-[0.32rem] rounded-full border border-line bg-white px-[0.55rem] py-[0.4rem] text-[0.63rem] font-[720] text-ink-600 [&>strong]:font-mono [&>strong]:text-ink-950';
  const footValue = 'block text-[1.35rem] leading-none font-black';
  const footLabel = 'mt-1 block text-[0.62rem] font-bold text-ink-600';

  const englishAchievements: Record<string, [string, string]> = {
    first: ['First step', 'Complete your first answer.'],
    'clean-25': [
      'Without training wheels',
      'Complete 25 answers correctly on the first try without a hint.',
    ],
    'run-10': ['Clean ten', 'Get 10 clean answers in a row.'],
    'typing-100': ['Typing at speed', 'Type 100 German answers.'],
    'reviews-500': ['Perseverance', 'Complete 500 reviews.'],
    'streak-7': ['A week in rhythm', 'Study for seven days in a row.'],
    'streak-30': ['A month in rhythm', 'Study for thirty days in a row.'],
    'grammar-5': ['Grammar foundations', 'Complete 5 grammar micro-lessons.'],
    'coach-5': ['Speaking while learning', 'Complete 5 AI conversation missions.'],
    'xp-1000': ['One thousand XP', 'Earn 1,000 experience points.'],
    'xp-2000': ['Two thousand XP', 'Unlock your personal 2,000 XP reward.'],
    'mastered-10': ['A solid ten', 'Move 10 cards into strong long-term memory.'],
  };

  function masteryName(tier: MasteryTier): string {
    if ($motherTongue === 'cs') return masteryLabel(tier);
    return {
      new: 'New',
      learning: 'Learning',
      familiar: 'Familiar',
      strong: 'Strong',
      mastered: 'Mastered',
    }[tier];
  }

  onMount(() => {
    void appStore.initialize();
  });

  let masteryCards: StudyCard[] | undefined;
  let masteryCounts: MasteryDistribution | undefined;

  function currentMasteryCounts(): MasteryDistribution {
    if (masteryCards !== $appStore.cards || !masteryCounts) {
      masteryCards = $appStore.cards;
      masteryCounts = masteryDistribution(masteryCards);
    }
    return masteryCounts;
  }

  function masteryCount(tier: MasteryTier): number {
    return currentMasteryCounts()[tier];
  }

  function masteryPercent(tier: MasteryTier): number {
    return $appStore.cards.length === 0 ? 0 : (masteryCount(tier) / $appStore.cards.length) * 100;
  }

  function recentDays(
    reviewStats: ReviewStats,
    course: CourseProgress,
    now = new Date(),
  ): Array<{ key: string; label: string; count: number; xp: number }> {
    const formatter = new Intl.DateTimeFormat(languageTag($motherTongue), { weekday: 'short' });
    const days = Array.from({ length: 7 }, (_, offset) => {
      const day = new Date(now);
      day.setHours(12, 0, 0, 0);
      day.setDate(day.getDate() - (6 - offset));
      const key = localDateKey(day);
      const reviews = reviewStats.byDay[key];
      return {
        key,
        label: formatter.format(day).replace('.', ''),
        count: reviews?.count ?? 0,
        xp: reviews?.xp ?? 0,
      };
    });
    const dayIndex = new Map(days.map((day, index) => [day.key, index]));
    for (const event of course.events) {
      const key = localDateKey(new Date(event.answeredAt));
      const index = dayIndex.get(key);
      if (index === undefined) continue;
      days[index].xp += event.xpAwarded;
      days[index].count += 1;
    }
    for (const session of course.coachEvents) {
      const key = localDateKey(new Date(session.completedAt));
      const index = dayIndex.get(key);
      if (index === undefined) continue;
      days[index].xp += session.xpAwarded;
      days[index].count += session.turns;
    }
    return days;
  }
  const grammar = $derived(courseSummary($appStore.course, new Date($appClock)));
  const activityDays = $derived(
    recentDays($appStore.reviewStats, $appStore.course, new Date($appClock)),
  );
  const activityMaximum = $derived(Math.max(1, ...activityDays.map((day) => day.count)));
  let totalLearningMoments = $derived(
    $appStore.reviewStats.countedReviews +
      $appStore.course.events.length +
      $appStore.course.coachEvents.reduce((sum, session) => sum + session.turns, 0),
  );
  const remainingRewardXp = $derived(
    Math.max(0, $gameProgress.reward.target - $gameProgress.totalXp),
  );
</script>

<svelte:head>
  <title>{$tr('Pokrok a odměny – Fritz', 'Progress and rewards – Fritz')}</title>
</svelte:head>

{#if !$appStore.ready || !$appStore.settings}
  <LoadingState label={$tr('Načítám pokrok…', 'Loading progress…')} />
{:else}
  <div class="grid gap-[1.35rem] min-[640px]:gap-7">
    <div
      class="flex flex-col items-start justify-between gap-4 min-[900px]:flex-row min-[900px]:items-end"
    >
      <PageHeading
        eyebrow={$tr('Pokrok', 'Progress')}
        title={$tr('Co už umíš a co si zopakovat', 'What you know and what to review')}
        description={$tr(
          'Podívej se, kolik slovíček, lekcí a rozhovorů máš za sebou a co si ještě zopakovat.',
          'See the words, lessons, and conversations you’ve practised, and what to review next.',
        )}
      />
      {#if !$appStore.settings.gamificationEnabled}
        <a class="btn-base btn-secondary min-[900px]:flex-none" href="/settings/#motivace"
          >{$tr('Zapnout body a odznaky', 'Enable points and badges')}</a
        >
      {/if}
    </div>

    <section
      class="grid gap-4 rounded-[0.875rem] border border-[color-mix(in_srgb,var(--color-line)_65%,var(--color-accent-500))] bg-accent-100 p-[clamp(1rem,3vw,1.4rem)] min-[760px]:grid-cols-[minmax(0,1fr)_minmax(16rem,0.55fr)] min-[760px]:items-center"
      aria-labelledby="learning-first-title"
    >
      <div>
        <p class="kicker">
          {$tr(
            `Dnes · ${$dailyProgress.minutes} minut`,
            `Today · ${$dailyProgress.minutes} minutes`,
          )}
        </p>
        <h2
          class="mt-1 text-[clamp(1.45rem,4vw,2rem)] tracking-[-0.04em]"
          id="learning-first-title"
        >
          {$tr(
            `${$dailyProgress.completed} z ${$dailyProgress.goal} kroků hotovo`,
            `${$dailyProgress.completed} of ${$dailyProgress.goal} steps done`,
          )}
        </h2>
        <p class="mt-[0.45rem] max-w-[38rem] text-[0.82rem] leading-normal text-ink-800">
          {$tr(
            'Tady uvidíš, co zvládáš bez nápovědy a co potřebuje víc procvičit.',
            'See what you can do without hints and what needs more practice.',
          )}
        </p>
      </div>
      <div class="grid content-center gap-3">
        <ProgressBar
          value={$dailyProgress.percent}
          label={$tr('Dokončení dnešního učebního plánu', "Today's learning plan completion")}
          showValue
        />
        <a class="btn-base btn-primary" href="/">
          {$tr('Pokračovat podle plánu', 'Continue with the plan')}
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </div>
    </section>

    <section class="grid gap-4 min-[900px]:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <div
        class="relative overflow-hidden rounded-[0.875rem] border border-line bg-paper-50 p-[1.2rem] min-[640px]:p-6"
      >
        <div class="flex flex-wrap items-center justify-between gap-3">
          <LevelBadge level={$gameProgress.level} />
          <span
            class="inline-flex items-center gap-[0.4rem] text-[0.75rem] font-extrabold text-orange-700"
            ><Sparkles size={17} /> {$gameProgress.totalXp} XP</span
          >
        </div>
        <div class="mt-[1.15rem] grid grid-cols-2 gap-[0.55rem] min-[640px]:grid-cols-4">
          {#each [[$gameProgress.streak, $tr('dní v sérii', 'days in your streak')], [totalLearningMoments, $tr('učebních kroků', 'learning steps')], [$gameProgress.masteredCards, $tr('zvládnutých slov', 'mastered words')], [$gameProgress.completedGrammarLessons, $tr('hotových lekcí', 'completed lessons')]] as [value, label]}
            <article class="border-t border-line pt-[0.8rem]">
              <strong class={metricValue}>{value}</strong><span class={metricLabel}>{label}</span>
            </article>
          {/each}
        </div>
      </div>

      <a
        class={[
          'relative grid grid-cols-[auto_minmax(0,1fr)] content-start gap-[0.8rem] overflow-hidden rounded-[0.875rem] border border-line p-[1.2rem] [transition:transform_180ms_var(--ease-out-emil),background-color_180ms_var(--ease-out-emil)] active:[transform:scale(0.98)] min-[640px]:p-6 fine-hover:[transform:translateY(-1px)]',
          $gameProgress.reward.unlocked ? 'bg-acid-500 text-ink-950' : 'bg-ink-950 text-white',
        ]}
        href="/reward/"
      >
        <span
          class={[
            'grid size-12 place-items-center rounded-[0.85rem]',
            $gameProgress.reward.unlocked ? 'bg-ink-950 text-white' : 'bg-acid-500 text-ink-950',
          ]}><Gift size={24} /></span
        >
        <div>
          <p
            class={['kicker', $gameProgress.reward.unlocked ? 'text-ink-950/58' : 'text-white/48']}
          >
            {$tr('Milník 2 000 XP', '2,000 XP milestone')}
          </p>
          <h2
            class="mt-1 text-[clamp(1.25rem,5vw,1.75rem)] leading-[1.02] font-black tracking-[-0.04em] text-balance"
          >
            {$gameProgress.reward.unlocked
              ? $tr('Odměna je odemčená.', 'Your reward is unlocked.')
              : $tr('Blížíš se k odměně.', 'You are earning a personal reward.')}
          </h2>
          <p
            class={[
              'mt-2 text-[0.75rem] leading-normal',
              $gameProgress.reward.unlocked ? 'text-ink-950/68' : 'text-white/58',
            ]}
          >
            {$gameProgress.reward.unlocked
              ? $tr(
                  'Vytvoř podepsaný obrázek, pošli ho rodině a vyber si skutečnou odměnu.',
                  'Create a signed image, share it with family, and choose a real-world reward.',
                )
              : $tr(
                  `Ještě ${remainingRewardXp} XP. Po dosažení cíle vznikne sdílitelný certifikát.`,
                  `${remainingRewardXp} XP to go. Reaching the goal unlocks a shareable certificate.`,
                )}
          </p>
        </div>
        <div class="col-span-full mt-[0.35rem]">
          <ProgressBar
            value={$gameProgress.reward.percent}
            label={$tr('Postup k odměně', 'Progress to reward')}
          />
          <span
            class="mt-2 flex items-center justify-end gap-[0.35rem] font-mono text-[0.62rem] font-extrabold"
            >{$gameProgress.reward.progress} / {$gameProgress.reward.target} XP <ArrowRight
              size={15}
            /></span
          >
        </div>
      </a>
    </section>

    <WeeklyLearningReport reviews={$appStore.recentReviews} now={new Date($appClock)} />

    <section class="grid gap-4 py-[0.4rem]" aria-labelledby="portfolio-title">
      <div class={sectionHeading}>
        <div>
          <p class="kicker">{$tr('Dovednosti', 'Skills')}</p>
          <h2
            class="mt-1 text-[clamp(1.7rem,6vw,2.65rem)] leading-[0.98] font-[920] tracking-[-0.04em] text-balance"
            id="portfolio-title"
          >
            {$tr('Slovní zásoba, gramatika a mluvení', 'Vocabulary, grammar, and speaking')}
          </h2>
        </div>
        <p class={sectionLead}>
          {$tr(
            'Každá část procvičuje něco jiného, proto má vlastní přehled.',
            'Each part trains something different, so it has its own overview.',
          )}
        </p>
      </div>

      <div class="grid overflow-hidden rounded-[0.875rem] border border-line bg-paper-50">
        <a class={skillCard} href="/library/">
          <span class="{iconTile} bg-coral-50 text-coral-700"><Brain size={22} /></span>
          <div>
            <p class="kicker">{$tr('Slovní zásoba', 'Vocabulary')}</p>
            <h3 class={skillTitle}>
              {$tr(
                `${$appStore.notes.length} výrazů v osobním slovníku`,
                `${$appStore.notes.length} entries in your vocabulary`,
              )}
            </h3>
            <p class={skillStats}>
              {$tr(
                `${$appStore.reviewStats.countedReviews} odpovědí · ${$gameProgress.reviewXp} XP · ${$gameProgress.masteredCards} pevně zvládnutých`,
                `${$appStore.reviewStats.countedReviews} answers · ${$gameProgress.reviewXp} XP · ${$gameProgress.masteredCards} mastered`,
              )}
            </p>
          </div>
          <span class={skillLink}
            >{$tr('Otevřít slovník', 'Open vocabulary')} <ArrowRight size={16} /></span
          >
        </a>

        <a class={skillCard} href="/grammar/">
          <span class="{iconTile} bg-sky-50 text-cobalt-700"><BookOpenText size={22} /></span>
          <div>
            <p class="kicker">{$tr('Gramatický kurz', 'Grammar course')}</p>
            <h3 class={skillTitle}>
              {$tr(
                `${grammar.completedLessons} z ${grammar.totalLessons} lekcí hotovo`,
                `${grammar.completedLessons} of ${grammar.totalLessons} micro-lessons complete`,
              )}
            </h3>
            <p class={skillStats}>
              {$tr(
                `${grammar.completedQuestions} z ${grammar.totalQuestions} pravidel upevněno · ${$gameProgress.grammarXp} XP`,
                `${grammar.completedQuestions} of ${grammar.totalQuestions} rules reinforced · ${$gameProgress.grammarXp} XP`,
              )}
            </p>
          </div>
          <ProgressBar
            class="col-start-2"
            value={grammar.percent}
            label={$tr('Postup gramatickým kurzem', 'Grammar course progress')}
          />
          <span class={skillLink}
            >{$tr('Pokračovat v kurzu', 'Continue course')} <ArrowRight size={16} /></span
          >
        </a>

        <a class={skillCard} href="/coach/">
          <span class="{iconTile} bg-mint-50 text-mint-700"><MessageCircle size={22} /></span>
          <div>
            <p class="kicker">{$tr('AI konverzace', 'AI conversations')}</p>
            <h3 class={skillTitle}>
              {$tr(
                `${$gameProgress.coachSessions} dokončených situací`,
                `${$gameProgress.coachSessions} completed scenarios`,
              )}
            </h3>
            <p class={skillStats}>
              {$tr(
                `${$gameProgress.coachXp} XP · kavárna, škola, nádraží i nakupování bez stresu`,
                `${$gameProgress.coachXp} XP · café, school, station, and shopping without the stress`,
              )}
            </p>
          </div>
          <span class={skillLink}
            >{$tr('Vstoupit do situace', 'Enter a scenario')} <ArrowRight size={16} /></span
          >
        </a>
      </div>
    </section>

    <CourseWritingPortfolio />

    <section class="grid gap-4 min-[900px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div class="surface {card}">
        <div class={cardHeading}>
          <div>
            <p class="kicker">{$tr('Dnešní mix', "Today's mix")}</p>
            <h2 class={cardTitle}>
              {$tr(
                `${$dailyProgress.completed} / ${$dailyProgress.goal} učebních kroků`,
                `${$dailyProgress.completed} / ${$dailyProgress.goal} learning steps`,
              )}
            </h2>
          </div>
          <span
            class={[
              'grid size-[2.8rem] flex-none place-items-center rounded-[0.85rem]',
              $dailyProgress.reached ? 'bg-mint-50 text-mint-700' : 'bg-orange-100 text-orange-700',
            ]}
          >
            {#if $dailyProgress.reached}<Check size={22} />{:else}<Target size={22} />{/if}
          </span>
        </div>
        <ProgressBar
          class="mt-4"
          value={$dailyProgress.percent}
          label={$tr('Dnešní studijní cíl', "Today's study goal")}
          showValue
        />
        <div class="mt-[0.9rem] flex flex-wrap gap-[0.4rem]">
          <span class={chip}
            ><Brain size={15} /><strong>{$dailyProgress.vocabularyCompleted}</strong>
            {$tr('slovíčka', 'vocabulary')}</span
          >
          <span class={chip}
            ><BookOpenText size={15} /><strong>{$dailyProgress.grammarCompleted}</strong>
            {$tr('gramatika', 'grammar')}</span
          >
          <span class={chip}
            ><MessageCircle size={15} /><strong>{$dailyProgress.coachCompleted}</strong>
            {$tr('AI dialog', 'AI dialogue')}</span
          >
        </div>
        <p class="mt-[0.9rem] text-[0.78rem] leading-[1.55] text-ink-600">
          {$dailyProgress.reached
            ? $tr(
                'Dnešní cíl máš hotový. Dej si pauzu, nebo pokračuj, pokud máš chuť.',
                'Today’s goal is done. Take a break, or keep going if you feel like it.',
              )
            : $tr(
                `Zbývá ${Math.max(0, $dailyProgress.goal - $dailyProgress.completed)} krátkých kroků. Nejrychlejší cesta je dokončit další blok z dnešní trasy.`,
                `${Math.max(0, $dailyProgress.goal - $dailyProgress.completed)} short steps remain. The fastest route is the next block on today's path.`,
              )}
        </p>
        <a class="btn-base btn-primary mt-4 w-full" href="/"
          >{$tr('Otevřít dnešní cestu', "Open today's path")} <ArrowRight size={18} /></a
        >
      </div>

      <div class="surface {card}">
        <div class={cardHeading}>
          <div>
            <p class="kicker">{$tr('Posledních sedm dní', 'Last seven days')}</p>
            <h2 class={cardTitle}>{$tr('Rytmus učení', 'Learning rhythm')}</h2>
          </div>
          <span
            class="inline-flex flex-none items-center gap-[0.32rem] rounded-full bg-orange-100 px-[0.55rem] py-[0.42rem] font-mono text-[0.58rem] font-[850] text-orange-700"
            ><Flame size={16} />
            {$tr(
              `rekord ${$gameProgress.longestStreak} dní`,
              `record: ${$gameProgress.longestStreak} days`,
            )}</span
          >
        </div>
        <div
          class="mt-4 grid h-44 grid-cols-7 items-end gap-[0.35rem]"
          aria-label={$tr(
            'Počet učebních kroků za posledních sedm dní',
            'Learning steps over the last seven days',
          )}
        >
          {#each activityDays as day}
            <div
              class="grid h-full grid-rows-[1rem_minmax(0,1fr)_1rem] gap-[0.3rem] text-center"
              title={$tr(`${day.count} kroků · ${day.xp} XP`, `${day.count} steps · ${day.xp} XP`)}
            >
              <span class="text-[0.58rem] font-[760] text-ink-600">{day.count || ''}</span>
              <div
                class="flex items-end overflow-hidden rounded-[0.45rem] bg-paper-200"
                role="meter"
                aria-label={$tr(
                  `${day.label}: ${day.count} kroků, ${day.xp} XP`,
                  `${day.label}: ${day.count} steps, ${day.xp} XP`,
                )}
                aria-valuemin="0"
                aria-valuemax={activityMaximum}
                aria-valuenow={day.count}
              >
                <i
                  class="block h-full w-full origin-bottom rounded-[inherit] bg-ink-950 transition-transform duration-260 ease-out-emil"
                  style:transform={`scaleY(${day.count > 0 ? Math.max(0.1, day.count / activityMaximum) : 0.02})`}
                ></i>
              </div>
              <strong class="text-[0.58rem] text-ink-600 lowercase">{day.label}</strong>
            </div>
          {/each}
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-[0.9rem]">
          <div>
            <strong class={footValue}>{recentAccuracy($appStore.recentReviews)} %</strong><span
              class={footLabel}
              >{$tr('přesnost posledních 40 slov', 'accuracy over the last 40 words')}</span
            >
          </div>
          <div>
            <strong class={footValue}>{$gameProgress.todayXp}</strong><span class={footLabel}
              >{$tr('XP získaných dnes', 'XP earned today')}</span
            >
          </div>
        </div>
      </div>
    </section>

    {#if $appStore.settings.gamificationEnabled}
      <section
        class={[
          'grid gap-4',
          $appStore.settings.rivalryEnabled
            ? 'min-[900px]:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]'
            : 'grid-cols-[minmax(0,1fr)]',
        ]}
      >
        <div class="surface {card}">
          <div class="mb-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-[0.7rem]">
            <span class="{iconTile} bg-orange-100 text-orange-700"><Target size={21} /></span>
            <div>
              <p class="kicker">{$tr('Dnešní vedlejší výzvy', "Today's side quests")}</p>
              <h2 class="mt-[0.2rem] text-[1.35rem] font-black tracking-[-0.04em]">
                {$tr('Denní mise', 'Daily missions')}
              </h2>
              <p class="mt-1 text-[0.69rem] leading-[1.4] text-ink-600">
                {$tr(
                  'Malé cíle navíc. Nikdy nejsou podmínkou pro pokračování v kurzu.',
                  'Small optional goals. They never block progress through the course.',
                )}
              </p>
            </div>
            <span
              class={[
                'grid size-[3.15rem] place-items-center content-center rounded-full border border-ink-950',
                $gameProgress.missionSummary.allCompleted ? 'bg-acid-500' : 'bg-paper-100',
              ]}
              ><strong class="block text-center font-mono text-[0.68rem] leading-none"
                >{$gameProgress.missionSummary.completed}/3</strong
              ><small
                class="mt-[0.13rem] block text-center text-[0.5rem] font-extrabold text-ink-600"
                >{$tr('hotovo', 'done')}</small
              ></span
            >
          </div>
          <MissionList missions={$gameProgress.missions} />
          <p
            class="mt-[0.8rem] flex items-center gap-[0.35rem] text-[0.68rem] font-[780] text-orange-700"
          >
            <Check size={14} />
            {$tr(
              `Celá sada přidá +${DAILY_MISSION_SET_BONUS_XP} bonusových XP.`,
              `The complete set adds +${DAILY_MISSION_SET_BONUS_XP} bonus XP.`,
            )}
          </p>
        </div>

        {#if $appStore.settings.rivalryEnabled}
          <div
            class="surface {card} self-start bg-[color-mix(in_srgb,var(--color-sky-50)_46%,var(--color-paper-50))]"
          >
            <RivalDuel
              rival={$gameProgress.rival}
              userName={$appStore.settings.profileName.trim() || $tr('Ty', 'You')}
            />
          </div>
        {/if}
      </section>

      <section id="odznaky" class="surface {card}">
        <div class={sectionHeading}>
          <div class="flex items-center gap-[0.7rem]">
            <span class="{iconTile} bg-sky-50 text-cobalt-700"><Award size={21} /></span>
            <div>
              <p class="kicker">{$tr('Sbírka milníků', 'Milestone collection')}</p>
              <h2 class={compactTitle}>{$tr('Odznaky', 'Badges')}</h2>
            </div>
          </div>
          <p class={sectionLead}>
            {$tr(
              'Odznaky za procvičená slovíčka, gramatiku, rozhovory a pravidelné učení.',
              'Badges for vocabulary, grammar, conversations, and regular practice.',
            )}
          </p>
        </div>
        <div class="mt-4 grid gap-[0.65rem] min-[640px]:grid-cols-2 min-[900px]:grid-cols-3">
          {#each $gameProgress.achievements as achievement (achievement.id)}
            <article
              class={[
                'flex gap-[0.7rem] rounded-[0.85rem] border p-[0.8rem]',
                achievement.unlocked
                  ? 'border-butter-200 bg-butter-50'
                  : 'border-line bg-paper-100',
              ]}
            >
              <span
                class={[
                  'grid size-[2.3rem] flex-none place-items-center rounded-[0.7rem]',
                  achievement.unlocked ? 'bg-white text-orange-700' : 'bg-paper-200 text-ink-600',
                ]}
                >{#if achievement.unlocked}<Trophy size={19} />{:else}<LockKeyhole
                    size={18}
                  />{/if}</span
              >
              <div>
                <h3 class="text-[0.85rem] font-[860]">
                  {$motherTongue === 'en'
                    ? (englishAchievements[achievement.id]?.[0] ?? 'Achievement')
                    : achievement.title}
                </h3>
                <p class="mt-[0.2rem] text-[0.875rem] leading-[1.4] text-ink-600">
                  {$motherTongue === 'en'
                    ? (englishAchievements[achievement.id]?.[1] ?? 'Keep learning to unlock it.')
                    : achievement.description}
                </p>
                <div class="mt-[0.55rem] h-[0.28rem] overflow-hidden rounded-full bg-paper-200">
                  <i
                    class="block h-full w-full origin-left rounded-[inherit] bg-ink-950"
                    style:transform={`scaleX(${Math.min(1, achievement.progress / Math.max(1, achievement.target))})`}
                  ></i>
                </div>
                <small class="mt-[0.3rem] block font-mono text-[0.75rem] font-[780] text-ink-600"
                  >{achievement.progress} / {achievement.target}</small
                >
              </div>
            </article>
          {/each}
        </div>
      </section>
    {/if}

    <section class="surface {card}">
      <div class={sectionHeading}>
        <div>
          <p class="kicker">{$tr('Dlouhodobá paměť', 'Long-term memory')}</p>
          <h2 class={compactTitle}>
            {$tr('Jak dobře si pamatuješ slovíčka', 'How securely your words are remembered')}
          </h2>
        </div>
        <p class={sectionLead}>
          {$tr(
            'Odhad vychází z toho, jak často a jak úspěšně si slova vybavíš při opakování.',
            'This estimate is based on how often and how successfully you recall words during reviews.',
          )}
        </p>
      </div>
      <div
        class="mt-4 grid gap-[0.8rem] min-[640px]:grid-cols-2 min-[640px]:gap-x-6 min-[640px]:gap-y-4 min-[900px]:grid-cols-5"
      >
        {#each tiers as tier}
          <div>
            <div class="mb-[0.4rem] flex items-baseline justify-between gap-3">
              <span class="text-[0.74rem] font-extrabold">{masteryName(tier)}</span><strong
                class="font-mono text-[0.68rem]">{masteryCount(tier)}</strong
              >
            </div>
            <div
              class="h-[0.55rem] overflow-hidden rounded-full bg-paper-200"
              role="progressbar"
              aria-label={$tr(
                `${masteryLabel(tier)}: ${masteryCount(tier)} karet`,
                `${masteryName(tier)}: ${masteryCount(tier)} cards`,
              )}
              aria-valuemin="0"
              aria-valuemax={Math.max(1, $appStore.cards.length)}
              aria-valuenow={masteryCount(tier)}
            >
              <i
                class="block h-full w-full origin-left rounded-[inherit] transition-transform duration-260 ease-out-emil {tierFill[
                  tier
                ]}"
                style:transform={`scaleX(${masteryPercent(tier) / 100})`}
              ></i>
            </div>
          </div>
        {/each}
      </div>
    </section>
  </div>
{/if}
