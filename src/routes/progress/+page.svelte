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
  import { languageTag, localized } from '$lib/i18n';
  import { appClock, appStore, dailyProgress, gameProgress, motherTongue } from '$lib/state/app';
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

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

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

  $: grammar = courseSummary($appStore.course, new Date($appClock));
  $: activityDays = recentDays($appStore.reviewStats, $appStore.course, new Date($appClock));
  $: activityMaximum = Math.max(1, ...activityDays.map((day) => day.count));
  $: totalLearningMoments =
    $appStore.reviewStats.countedReviews +
    $appStore.course.events.length +
    $appStore.course.coachEvents.reduce((sum, session) => sum + session.turns, 0);
  $: remainingRewardXp = Math.max(0, $gameProgress.reward.target - $gameProgress.totalXp);

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
</script>

<svelte:head>
  <title>{copy('Pokrok a odměny – Fritz', 'Progress and rewards – Fritz')}</title>
</svelte:head>

{#if !$appStore.ready || !$appStore.settings}
  <LoadingState label={copy('Načítám pokrok…', 'Loading progress…')} />
{:else}
  <div class="progress-page">
    <div class="heading-row">
      <PageHeading
        eyebrow={copy('Pokrok', 'Progress')}
        title={copy('Co už drží a co je na řadě.', 'What is sticking and what comes next.')}
        description={copy(
          'Najdeš tu slovní zásobu, gramatiku, konverzace i rytmus učení. XP zůstávají jen doplňkovou motivací.',
          'See your vocabulary, grammar, conversations, and learning rhythm. XP remain a little extra motivation.',
        )}
      />
      {#if !$appStore.settings.gamificationEnabled}
        <a class="btn-base btn-secondary" href="/settings/#motivace"
          >{copy('Zapnout motivaci', 'Enable motivation')}</a
        >
      {/if}
    </div>

    <section class="learning-first" aria-labelledby="learning-first-title">
      <div>
        <p class="kicker">
          {copy(
            `Dnes · ${$dailyProgress.minutes} minut`,
            `Today · ${$dailyProgress.minutes} minutes`,
          )}
        </p>
        <h2 id="learning-first-title">
          {copy(
            `${$dailyProgress.completed} z ${$dailyProgress.goal} kroků hotovo`,
            `${$dailyProgress.completed} of ${$dailyProgress.goal} steps done`,
          )}
        </h2>
        <p>
          {copy(
            'Hlavní je, co už umíš použít bez nápovědy. Body a odznaky jsou až za tím.',
            'What matters is what you can use without a hint. Points and badges come second.',
          )}
        </p>
      </div>
      <div class="learning-first-progress">
        <ProgressBar
          value={$dailyProgress.percent}
          label={copy('Dokončení dnešního učebního plánu', "Today's learning plan completion")}
          showValue
        />
        <a class="btn-base btn-primary" href="/">
          {copy('Pokračovat podle plánu', 'Continue with the plan')}
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </div>
    </section>

    <section class="progress-hero">
      <div class="level-panel">
        <div class="level-topline">
          <LevelBadge level={$gameProgress.level} />
          <span class="total-xp"><Sparkles size={17} /> {$gameProgress.totalXp} XP</span>
        </div>
        <div class="hero-metrics">
          <article>
            <strong>{$gameProgress.streak}</strong><span
              >{copy('dní v sérii', 'days in your streak')}</span
            >
          </article>
          <article>
            <strong>{totalLearningMoments}</strong><span
              >{copy('učebních kroků', 'learning steps')}</span
            >
          </article>
          <article>
            <strong>{$gameProgress.masteredCards}</strong><span
              >{copy('zvládnutých slov', 'mastered words')}</span
            >
          </article>
          <article>
            <strong>{$gameProgress.completedGrammarLessons}</strong><span
              >{copy('hotových lekcí', 'completed lessons')}</span
            >
          </article>
        </div>
      </div>

      <a class:unlocked={$gameProgress.reward.unlocked} class="reward-panel" href="/reward/">
        <span class="reward-icon"><Gift size={24} /></span>
        <div>
          <p class="kicker">{copy('Milník 2 000 XP', '2,000 XP milestone')}</p>
          <h2>
            {$gameProgress.reward.unlocked
              ? copy('Odměna je odemčená.', 'Your reward is unlocked.')
              : copy('Vyděláváš si osobní odměnu.', 'You are earning a personal reward.')}
          </h2>
          <p>
            {$gameProgress.reward.unlocked
              ? copy(
                  'Vytvoř podepsaný obrázek, pošli ho rodině a vyber si skutečnou odměnu.',
                  'Create a signed image, share it with family, and choose a real-world reward.',
                )
              : copy(
                  `Ještě ${remainingRewardXp} XP. Po dosažení cíle vznikne sdílitelný certifikát.`,
                  `${remainingRewardXp} XP to go. Reaching the goal unlocks a shareable certificate.`,
                )}
          </p>
        </div>
        <div class="reward-progress">
          <ProgressBar
            value={$gameProgress.reward.percent}
            label={copy('Postup k odměně', 'Progress to reward')}
          />
          <span
            >{$gameProgress.reward.progress} / {$gameProgress.reward.target} XP <ArrowRight
              size={15}
            /></span
          >
        </div>
      </a>
    </section>

    <WeeklyLearningReport reviews={$appStore.recentReviews} now={new Date($appClock)} />

    <section class="portfolio" aria-labelledby="portfolio-title">
      <div class="section-heading">
        <div>
          <p class="kicker">{copy('Dovednosti', 'Skills')}</p>
          <h2 id="portfolio-title">
            {copy('Slovní zásoba, gramatika a mluvení', 'Vocabulary, grammar, and speaking')}
          </h2>
        </div>
        <p>
          {copy(
            'Každá část procvičuje něco jiného, proto má vlastní přehled.',
            'Each part trains something different, so it has its own overview.',
          )}
        </p>
      </div>

      <div class="portfolio-grid">
        <a class="skill-card vocabulary" href="/library/">
          <span class="skill-icon"><Brain size={22} /></span>
          <div>
            <p class="kicker">{copy('Slovní zásoba', 'Vocabulary')}</p>
            <h3>
              {copy(
                `${$appStore.notes.length} výrazů v osobním slovníku`,
                `${$appStore.notes.length} entries in your vocabulary`,
              )}
            </h3>
            <p>
              {copy(
                `${$appStore.reviewStats.countedReviews} odpovědí · ${$gameProgress.reviewXp} XP · ${$gameProgress.masteredCards} pevně zvládnutých`,
                `${$appStore.reviewStats.countedReviews} answers · ${$gameProgress.reviewXp} XP · ${$gameProgress.masteredCards} mastered`,
              )}
            </p>
          </div>
          <span class="skill-link"
            >{copy('Otevřít slovník', 'Open vocabulary')} <ArrowRight size={16} /></span
          >
        </a>

        <a class="skill-card grammar" href="/grammar/">
          <span class="skill-icon"><BookOpenText size={22} /></span>
          <div>
            <p class="kicker">{copy('Gramatický kurz', 'Grammar course')}</p>
            <h3>
              {copy(
                `${grammar.completedLessons} z ${grammar.totalLessons} mikrolekcí hotovo`,
                `${grammar.completedLessons} of ${grammar.totalLessons} micro-lessons complete`,
              )}
            </h3>
            <p>
              {copy(
                `${grammar.completedQuestions} z ${grammar.totalQuestions} pravidel upevněno · ${$gameProgress.grammarXp} XP`,
                `${grammar.completedQuestions} of ${grammar.totalQuestions} rules reinforced · ${$gameProgress.grammarXp} XP`,
              )}
            </p>
          </div>
          <ProgressBar
            value={grammar.percent}
            label={copy('Postup gramatickým kurzem', 'Grammar course progress')}
          />
          <span class="skill-link"
            >{copy('Pokračovat v kurzu', 'Continue course')} <ArrowRight size={16} /></span
          >
        </a>

        <a class="skill-card coach" href="/coach/">
          <span class="skill-icon"><MessageCircle size={22} /></span>
          <div>
            <p class="kicker">{copy('AI konverzace', 'AI conversations')}</p>
            <h3>
              {copy(
                `${$gameProgress.coachSessions} dokončených situací`,
                `${$gameProgress.coachSessions} completed scenarios`,
              )}
            </h3>
            <p>
              {copy(
                `${$gameProgress.coachXp} XP · kavárna, škola, nádraží i nakupování bez stresu`,
                `${$gameProgress.coachXp} XP · café, school, station, and shopping without the stress`,
              )}
            </p>
          </div>
          <span class="skill-link"
            >{copy('Vstoupit do situace', 'Enter a scenario')} <ArrowRight size={16} /></span
          >
        </a>
      </div>
    </section>

    <CourseWritingPortfolio />

    <section class="today-grid">
      <div class="today-card surface">
        <div class="today-heading">
          <div>
            <p class="kicker">{copy('Dnešní mix', "Today's mix")}</p>
            <h2>
              {copy(
                `${$dailyProgress.completed} / ${$dailyProgress.goal} učebních kroků`,
                `${$dailyProgress.completed} / ${$dailyProgress.goal} learning steps`,
              )}
            </h2>
          </div>
          <span class:reached={$dailyProgress.reached} class="goal-icon">
            {#if $dailyProgress.reached}<Check size={22} />{:else}<Target size={22} />{/if}
          </span>
        </div>
        <ProgressBar
          value={$dailyProgress.percent}
          label={copy('Dnešní studijní cíl', "Today's study goal")}
          showValue
        />
        <div class="daily-breakdown">
          <span
            ><Brain size={15} /><strong>{$dailyProgress.vocabularyCompleted}</strong>
            {copy('slovíčka', 'vocabulary')}</span
          >
          <span
            ><BookOpenText size={15} /><strong>{$dailyProgress.grammarCompleted}</strong>
            {copy('gramatika', 'grammar')}</span
          >
          <span
            ><MessageCircle size={15} /><strong>{$dailyProgress.coachCompleted}</strong>
            {copy('AI dialog', 'AI dialogue')}</span
          >
        </div>
        <p class="today-message">
          {$dailyProgress.reached
            ? copy(
                'Dnešní minimum je hotové. Teď můžeš skončit s dobrým pocitem, nebo pokračovat pro radost.',
                "Today's minimum is complete. You can stop with a clear conscience or keep going for fun.",
              )
            : copy(
                `Zbývá ${Math.max(0, $dailyProgress.goal - $dailyProgress.completed)} krátkých kroků. Nejrychlejší cesta je dokončit další blok z dnešní trasy.`,
                `${Math.max(0, $dailyProgress.goal - $dailyProgress.completed)} short steps remain. The fastest route is the next block on today's path.`,
              )}
        </p>
        <a class="btn-base btn-primary" href="/"
          >{copy('Otevřít dnešní cestu', "Open today's path")} <ArrowRight size={18} /></a
        >
      </div>

      <div class="activity-card surface">
        <div class="activity-heading">
          <div>
            <p class="kicker">{copy('Posledních sedm dní', 'Last seven days')}</p>
            <h2>{copy('Rytmus učení', 'Learning rhythm')}</h2>
          </div>
          <span
            ><Flame size={16} />
            {copy(
              `rekord ${$gameProgress.longestStreak} dní`,
              `record: ${$gameProgress.longestStreak} days`,
            )}</span
          >
        </div>
        <div
          class="activity"
          aria-label={copy(
            'Počet učebních kroků za posledních sedm dní',
            'Learning steps over the last seven days',
          )}
        >
          {#each activityDays as day}
            <div
              class="day"
              title={copy(`${day.count} kroků · ${day.xp} XP`, `${day.count} steps · ${day.xp} XP`)}
            >
              <span class="count">{day.count || ''}</span>
              <div
                class="bar-track"
                role="meter"
                aria-label={copy(
                  `${day.label}: ${day.count} kroků, ${day.xp} XP`,
                  `${day.label}: ${day.count} steps, ${day.xp} XP`,
                )}
                aria-valuemin="0"
                aria-valuemax={activityMaximum}
                aria-valuenow={day.count}
              >
                <i
                  style:transform={`scaleY(${day.count > 0 ? Math.max(0.1, day.count / activityMaximum) : 0.02})`}
                ></i>
              </div>
              <strong>{day.label}</strong>
            </div>
          {/each}
        </div>
        <div class="activity-foot">
          <div>
            <strong>{recentAccuracy($appStore.recentReviews)} %</strong><span
              >{copy('přesnost posledních 40 slov', 'accuracy over the last 40 words')}</span
            >
          </div>
          <div>
            <strong>{$gameProgress.todayXp}</strong><span
              >{copy('XP získaných dnes', 'XP earned today')}</span
            >
          </div>
        </div>
      </div>
    </section>

    {#if $appStore.settings.gamificationEnabled}
      <section class:solo={!$appStore.settings.rivalryEnabled} class="challenge-grid">
        <div class="surface challenge-card">
          <div class="quest-heading">
            <span class="quest-icon"><Target size={21} /></span>
            <div>
              <p class="kicker">{copy('Dnešní vedlejší výzvy', "Today's side quests")}</p>
              <h2>{copy('Denní mise', 'Daily missions')}</h2>
              <p>
                {copy(
                  'Malé cíle navíc. Nikdy nejsou podmínkou pro pokračování v kurzu.',
                  'Small optional goals. They never block progress through the course.',
                )}
              </p>
            </div>
            <span class:complete={$gameProgress.missionSummary.allCompleted} class="quest-count"
              ><strong>{$gameProgress.missionSummary.completed}/3</strong><small
                >{copy('hotovo', 'done')}</small
              ></span
            >
          </div>
          <MissionList missions={$gameProgress.missions} />
          <p class="quest-bonus">
            <Check size={14} />
            {copy(
              `Celá sada přidá +${DAILY_MISSION_SET_BONUS_XP} bonusových XP.`,
              `The complete set adds +${DAILY_MISSION_SET_BONUS_XP} bonus XP.`,
            )}
          </p>
        </div>

        {#if $appStore.settings.rivalryEnabled}
          <div class="surface rival-progress">
            <RivalDuel
              rival={$gameProgress.rival}
              userName={$appStore.settings.profileName.trim() || copy('Ty', 'You')}
            />
          </div>
        {/if}
      </section>

      <section id="odznaky" class="surface achievement-section">
        <div class="section-heading compact">
          <div class="achievement-title">
            <span><Award size={21} /></span>
            <div>
              <p class="kicker">{copy('Sbírka milníků', 'Milestone collection')}</p>
              <h2>{copy('Odznaky', 'Badges')}</h2>
            </div>
          </div>
          <p>
            {copy(
              'Trvalé důkazy pokroku za slovíčka, gramatiku, AI trénink i pravidelnost.',
              'Permanent milestones for vocabulary, grammar, AI practice, and consistency.',
            )}
          </p>
        </div>
        <div class="achievement-shelf">
          {#each $gameProgress.achievements as achievement}
            <article class:unlocked={achievement.unlocked} class="achievement">
              <span
                >{#if achievement.unlocked}<Trophy size={19} />{:else}<LockKeyhole
                    size={18}
                  />{/if}</span
              >
              <div>
                <h3>
                  {$motherTongue === 'en'
                    ? (englishAchievements[achievement.id]?.[0] ?? 'Achievement')
                    : achievement.title}
                </h3>
                <p>
                  {$motherTongue === 'en'
                    ? (englishAchievements[achievement.id]?.[1] ?? 'Keep learning to unlock it.')
                    : achievement.description}
                </p>
                <div class="achievement-progress">
                  <i
                    style:transform={`scaleX(${Math.min(1, achievement.progress / Math.max(1, achievement.target))})`}
                  ></i>
                </div>
                <small>{achievement.progress} / {achievement.target}</small>
              </div>
            </article>
          {/each}
        </div>
      </section>
    {/if}

    <section class="mastery-section surface">
      <div class="section-heading compact">
        <div>
          <p class="kicker">{copy('Dlouhodobá paměť', 'Long-term memory')}</p>
          <h2>{copy('Jak pevně drží slovíčka', 'How securely your words are remembered')}</h2>
        </div>
        <p>
          {copy(
            'Úroveň vychází z počtu opakování a stability v plánovači. XP ji neumí uměle nafouknout.',
            'This level comes from review count and scheduler stability. XP cannot inflate it.',
          )}
        </p>
      </div>
      <div class="mastery-grid">
        {#each tiers as tier}
          <div class={`mastery-item mastery-${tier}`}>
            <div><span>{masteryName(tier)}</span><strong>{masteryCount(tier)}</strong></div>
            <div
              class="mastery-track"
              role="progressbar"
              aria-label={copy(
                `${masteryLabel(tier)}: ${masteryCount(tier)} karet`,
                `${masteryName(tier)}: ${masteryCount(tier)} cards`,
              )}
              aria-valuemin="0"
              aria-valuemax={Math.max(1, $appStore.cards.length)}
              aria-valuenow={masteryCount(tier)}
            >
              <i style:transform={`scaleX(${masteryPercent(tier) / 100})`}></i>
            </div>
          </div>
        {/each}
      </div>
    </section>
  </div>
{/if}

<style>
  .progress-page {
    display: grid;
    gap: 1.35rem;
  }
  .heading-row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .learning-first {
    display: grid;
    gap: 1rem;
    border: 1px solid color-mix(in srgb, var(--color-line) 65%, var(--color-accent-500));
    border-radius: 0.875rem;
    background: var(--color-accent-100);
    padding: clamp(1rem, 3vw, 1.4rem);
  }
  .learning-first h2 {
    margin-top: 0.25rem;
    font-size: clamp(1.45rem, 4vw, 2rem);
    letter-spacing: -0.04em;
  }
  .learning-first > div:first-child > p:last-child {
    max-width: 38rem;
    margin-top: 0.45rem;
    color: var(--color-ink-800);
    font-size: 0.82rem;
    line-height: 1.5;
  }
  .learning-first-progress {
    display: grid;
    gap: 0.75rem;
    align-content: center;
  }
  .progress-hero {
    display: grid;
    gap: 1rem;
  }
  @media (min-width: 760px) {
    .learning-first {
      grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.55fr);
      align-items: center;
    }
  }
  .level-panel,
  .reward-panel {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--color-line);
    border-radius: 0.875rem;
  }
  .level-panel {
    background: var(--color-paper-50);
    padding: 1.2rem;
  }
  .level-topline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .total-xp {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-orange-700);
    font-size: 0.75rem;
    font-weight: 800;
  }
  .hero-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
    margin-top: 1.15rem;
  }
  .hero-metrics article {
    border-top: 1px solid var(--color-line);
    padding-top: 0.8rem;
  }
  .hero-metrics strong,
  .hero-metrics span {
    display: block;
  }
  .hero-metrics strong {
    font-size: clamp(1.45rem, 6vw, 2.1rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .hero-metrics span {
    margin-top: 0.28rem;
    color: var(--color-ink-600);
    font-size: 0.68rem;
    font-weight: 720;
  }

  .reward-panel {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-content: start;
    gap: 0.8rem;
    color: white;
    background: var(--color-ink-950);
    padding: 1.2rem;
    transition:
      transform 180ms var(--ease-out-emil),
      background-color 180ms var(--ease-out-emil);
  }
  .reward-panel.unlocked {
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }
  .reward-panel:active {
    transform: scale(0.98);
  }
  .reward-icon {
    display: grid;
    width: 3rem;
    height: 3rem;
    place-items: center;
    border-radius: 0.85rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }
  .reward-panel.unlocked .reward-icon {
    color: white;
    background: var(--color-ink-950);
  }
  .reward-panel .kicker {
    color: rgb(255 255 255 / 0.48);
  }
  .reward-panel.unlocked .kicker {
    color: color-mix(in srgb, var(--color-ink-950) 58%, transparent);
  }
  .reward-panel h2 {
    margin-top: 0.25rem;
    text-wrap: balance;
    font-size: clamp(1.25rem, 5vw, 1.75rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1.02;
  }
  .reward-panel p:not(.kicker) {
    margin-top: 0.5rem;
    color: rgb(255 255 255 / 0.58);
    font-size: 0.75rem;
    line-height: 1.5;
  }
  .reward-panel.unlocked p:not(.kicker) {
    color: color-mix(in srgb, var(--color-ink-950) 68%, transparent);
  }
  .reward-progress {
    grid-column: 1 / -1;
    margin-top: 0.35rem;
  }
  .reward-progress > span {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.35rem;
    margin-top: 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 800;
  }

  .portfolio {
    display: grid;
    gap: 1rem;
    padding-block: 0.4rem;
  }
  .section-heading {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.65rem;
  }
  .section-heading h2 {
    margin-top: 0.25rem;
    text-wrap: balance;
    font-size: clamp(1.7rem, 6vw, 2.65rem);
    font-weight: 920;
    letter-spacing: -0.04em;
    line-height: 0.98;
  }
  .section-heading > p {
    max-width: 37rem;
    color: var(--color-ink-600);
    font-size: 0.78rem;
    line-height: 1.55;
  }
  .section-heading.compact h2 {
    font-size: clamp(1.45rem, 5vw, 2rem);
  }
  .portfolio-grid {
    display: grid;
    overflow: hidden;
    border: 1px solid var(--color-line);
    border-radius: 0.875rem;
    background: var(--color-paper-50);
  }
  .skill-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.75rem;
    border-bottom: 1px solid var(--color-line);
    padding: 1rem;
    transition: background-color 160ms var(--ease-out-emil);
  }
  .skill-card:last-child {
    border-bottom: 0;
  }
  .skill-card:active {
    background: var(--color-paper-100);
  }
  .skill-icon {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border-radius: 0.8rem;
  }
  .skill-card.vocabulary .skill-icon {
    color: var(--color-coral-700);
    background: var(--color-coral-50);
  }
  .skill-card.grammar .skill-icon {
    color: var(--color-cobalt-700);
    background: var(--color-sky-50);
  }
  .skill-card.coach .skill-icon {
    color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .skill-card h3 {
    max-width: 28rem;
    margin-top: 0.25rem;
    text-wrap: balance;
    font-size: 1.08rem;
    font-weight: 880;
    letter-spacing: -0.03em;
    line-height: 1.15;
  }
  .skill-card div > p:last-child {
    margin-top: 0.45rem;
    color: var(--color-ink-600);
    font-size: 0.71rem;
    line-height: 1.45;
  }
  .skill-card :global(.progress-wrap) {
    grid-column: 2;
  }
  .skill-link {
    grid-column: 2;
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.35rem;
    padding-top: 0.15rem;
    font-size: 0.72rem;
    font-weight: 820;
  }

  .today-grid {
    display: grid;
    gap: 1rem;
  }
  .today-card,
  .activity-card,
  .challenge-card,
  .rival-progress,
  .achievement-section,
  .mastery-section {
    padding: 1.15rem;
  }
  .today-heading,
  .activity-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .today-heading h2,
  .activity-heading h2 {
    margin-top: 0.25rem;
    font-size: clamp(1.35rem, 5vw, 1.85rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .goal-icon {
    display: grid;
    width: 2.8rem;
    height: 2.8rem;
    flex: none;
    place-items: center;
    border-radius: 0.85rem;
    color: var(--color-orange-700);
    background: var(--color-orange-100);
  }
  .goal-icon.reached {
    color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .today-card :global(.progress-wrap) {
    margin-top: 1rem;
  }
  .daily-breakdown {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.9rem;
  }
  .daily-breakdown span {
    display: inline-flex;
    align-items: center;
    gap: 0.32rem;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    background: white;
    padding: 0.4rem 0.55rem;
    color: var(--color-ink-600);
    font-size: 0.63rem;
    font-weight: 720;
  }
  .daily-breakdown strong {
    color: var(--color-ink-950);
    font-family: var(--font-mono);
  }
  .today-message {
    margin-top: 0.9rem;
    color: var(--color-ink-600);
    font-size: 0.78rem;
    line-height: 1.55;
  }
  .today-card .btn-base {
    width: 100%;
    margin-top: 1rem;
  }
  .activity-heading > span {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 0.32rem;
    border-radius: 999px;
    color: var(--color-orange-700);
    background: var(--color-orange-100);
    padding: 0.42rem 0.55rem;
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 850;
  }
  .activity {
    display: grid;
    height: 11rem;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    align-items: end;
    gap: 0.35rem;
    margin-top: 1rem;
  }
  .day {
    display: grid;
    height: 100%;
    grid-template-rows: 1rem minmax(0, 1fr) 1rem;
    gap: 0.3rem;
    text-align: center;
  }
  .count {
    color: var(--color-ink-600);
    font-size: 0.58rem;
    font-weight: 760;
  }
  .bar-track {
    display: flex;
    align-items: end;
    overflow: hidden;
    border-radius: 0.45rem;
    background: var(--color-paper-200);
  }
  .bar-track i {
    display: block;
    width: 100%;
    height: 100%;
    transform-origin: bottom center;
    border-radius: inherit;
    background: var(--color-ink-950);
    transition: transform 260ms var(--ease-out-emil);
  }
  .day strong {
    color: var(--color-ink-600);
    font-size: 0.58rem;
    text-transform: lowercase;
  }
  .activity-foot {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    margin-top: 1rem;
    border-top: 1px solid var(--color-line);
    padding-top: 0.9rem;
  }
  .activity-foot strong,
  .activity-foot span {
    display: block;
  }
  .activity-foot strong {
    font-size: 1.35rem;
    font-weight: 900;
    line-height: 1;
  }
  .activity-foot span {
    margin-top: 0.25rem;
    color: var(--color-ink-600);
    font-size: 0.62rem;
    font-weight: 700;
  }

  .challenge-grid {
    display: grid;
    gap: 1rem;
  }
  .challenge-grid.solo {
    grid-template-columns: minmax(0, 1fr);
  }
  .quest-heading {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.7rem;
    margin-bottom: 1rem;
  }
  .quest-icon {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border-radius: 0.8rem;
    color: var(--color-orange-700);
    background: var(--color-orange-100);
  }
  .quest-heading h2 {
    margin-top: 0.2rem;
    font-size: 1.35rem;
    font-weight: 900;
    letter-spacing: -0.04em;
  }
  .quest-heading div > p:last-child {
    margin-top: 0.25rem;
    color: var(--color-ink-600);
    font-size: 0.69rem;
    line-height: 1.4;
  }
  .quest-count {
    display: grid;
    width: 3.15rem;
    height: 3.15rem;
    place-items: center;
    align-content: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    background: var(--color-paper-100);
  }
  .quest-count.complete {
    background: var(--color-acid-500);
  }
  .quest-count strong,
  .quest-count small {
    display: block;
    text-align: center;
  }
  .quest-count strong {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    line-height: 1;
  }
  .quest-count small {
    margin-top: 0.13rem;
    color: var(--color-ink-600);
    font-size: 0.5rem;
    font-weight: 800;
  }
  .quest-bonus {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.8rem;
    color: var(--color-orange-700);
    font-size: 0.68rem;
    font-weight: 780;
  }
  .rival-progress {
    align-self: start;
    background: color-mix(in srgb, var(--color-sky-50) 46%, var(--color-paper-50));
  }

  .achievement-title {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }
  .achievement-title > span {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border-radius: 0.8rem;
    color: var(--color-cobalt-700);
    background: var(--color-sky-50);
  }
  .achievement-shelf {
    display: grid;
    gap: 0.65rem;
    margin-top: 1rem;
  }
  .achievement {
    display: flex;
    gap: 0.7rem;
    border: 1px solid var(--color-line);
    border-radius: 0.85rem;
    background: var(--color-paper-100);
    padding: 0.8rem;
    opacity: 0.72;
  }
  .achievement > span {
    display: grid;
    width: 2.3rem;
    height: 2.3rem;
    flex: none;
    place-items: center;
    border-radius: 0.7rem;
    color: var(--color-ink-600);
    background: var(--color-paper-200);
  }
  .achievement.unlocked {
    border-color: var(--color-butter-200);
    background: var(--color-butter-50);
    opacity: 1;
  }
  .achievement.unlocked > span {
    color: var(--color-orange-700);
    background: white;
  }
  .achievement h3 {
    font-size: 0.85rem;
    font-weight: 860;
  }
  .achievement p {
    margin-top: 0.2rem;
    color: var(--color-ink-600);
    font-size: 0.67rem;
    line-height: 1.4;
  }
  .achievement small {
    display: block;
    margin-top: 0.3rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.56rem;
    font-weight: 780;
  }
  .achievement-progress {
    height: 0.28rem;
    overflow: hidden;
    margin-top: 0.55rem;
    border-radius: 999px;
    background: var(--color-paper-200);
  }
  .achievement-progress i {
    display: block;
    width: 100%;
    height: 100%;
    transform-origin: left center;
    border-radius: inherit;
    background: var(--color-ink-950);
  }

  .mastery-grid {
    display: grid;
    gap: 0.8rem;
    margin-top: 1rem;
  }
  .mastery-item > div:first-child {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.4rem;
  }
  .mastery-item span {
    font-size: 0.74rem;
    font-weight: 800;
  }
  .mastery-item strong {
    font-family: var(--font-mono);
    font-size: 0.68rem;
  }
  .mastery-track {
    height: 0.55rem;
    overflow: hidden;
    border-radius: 999px;
    background: var(--color-paper-200);
  }
  .mastery-track i {
    display: block;
    width: 100%;
    height: 100%;
    transform-origin: left center;
    border-radius: inherit;
    transition: transform 260ms var(--ease-out-emil);
  }
  .mastery-new i {
    background: var(--color-ink-600);
  }
  .mastery-learning i {
    background: var(--color-coral-700);
  }
  .mastery-familiar i {
    background: var(--color-butter-400);
  }
  .mastery-strong i {
    background: var(--color-cobalt-700);
  }
  .mastery-mastered i {
    background: var(--color-mint-700);
  }

  @media (hover: hover) and (pointer: fine) {
    .reward-panel:hover {
      transform: translateY(-1px);
    }
    .skill-card:hover {
      background: color-mix(in srgb, var(--color-paper-100) 72%, white);
    }
  }

  @media (min-width: 640px) {
    .progress-page {
      gap: 1.75rem;
    }
    .level-panel,
    .reward-panel,
    .today-card,
    .activity-card,
    .challenge-card,
    .rival-progress,
    .achievement-section,
    .mastery-section {
      padding: 1.5rem;
    }
    .hero-metrics {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .skill-card {
      padding: 1.2rem;
    }
    .achievement-shelf {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .mastery-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem 1.5rem;
    }
  }

  @media (min-width: 900px) {
    .heading-row,
    .section-heading {
      flex-direction: row;
      align-items: flex-end;
    }
    .heading-row .btn-base {
      flex: none;
    }
    .progress-hero {
      grid-template-columns: minmax(0, 1.2fr) minmax(20rem, 0.8fr);
    }
    .today-grid {
      grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    }
    .challenge-grid {
      grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
    }
    .challenge-grid.solo {
      grid-template-columns: minmax(0, 1fr);
    }
    .achievement-shelf {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .mastery-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }
</style>
