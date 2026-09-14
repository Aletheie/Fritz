<script lang="ts">
  import CelebrationBurst from '$lib/components/gamification/CelebrationBurst.svelte';
  import RivalDuel from '$lib/components/gamification/RivalDuel.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import { formatDueMoment } from '$lib/domain/scheduler/fsrs.ts';
  import { gameLevelTitle, localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Flame from '@lucide/svelte/icons/flame';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Target from '@lucide/svelte/icons/target';

  import type { LevelProgress, MissionSummary, WeeklyRival } from '$lib/domain/gamification.ts';

  const englishTimeFormatter = new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const englishDateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

  let {
    mode,
    reviews,
    successes,
    xp,
    streak,
    goalReached,
    goalNewlyReached = false,
    level,
    missionSummary,
    rival,
    leveledUp = false,
    newMissions = 0,
    bestCombo = 0,
    celebrations,
    gamificationEnabled,
    nextDueAt,
    remainingDueCount = 0,
    onsetup,
  } = $props<{
    mode: 'long-term' | 'cram';
    reviews: number;
    successes: number;
    xp: number;
    streak: number;
    goalReached: boolean;
    goalNewlyReached?: boolean;
    level: LevelProgress;
    missionSummary: MissionSummary;
    rival?: WeeklyRival;
    leveledUp?: boolean;
    newMissions?: number;
    bestCombo?: number;
    celebrations: boolean;
    gamificationEnabled: boolean;
    nextDueAt?: string;
    remainingDueCount?: number;
    onsetup: () => void;
  }>();

  let accuracy = $derived(reviews === 0 ? 0 : Math.round((successes / reviews) * 100));

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function dueLabel(value: string): string {
    if ($motherTongue === 'cs') return formatDueMoment(value);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'unknown due date';
    const now = new Date();
    const seconds = Math.max(0, Math.round((date.getTime() - now.getTime()) / 1_000));
    if (seconds < 45) return 'now';
    if (seconds < 90) return 'in 1 min';
    if (seconds < 3600) return `in ${Math.round(seconds / 60)} min`;
    if (date.toDateString() === now.toDateString()) {
      return `today at ${englishTimeFormatter.format(date)}`;
    }
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) {
      return `tomorrow at ${englishTimeFormatter.format(date)}`;
    }
    return englishDateFormatter.format(date);
  }
</script>

<section class="complete-wrap">
  <div class="complete-sheet completion-arrival">
    <CelebrationBurst
      visible={celebrations && reviews > 0 && (goalNewlyReached || leveledUp || newMissions > 0)}
    />
    <div class="complete-stamp"><Check size={28} /></div>
    <p class="lab-index">
      {mode === 'cram'
        ? copy('sprint uzavřen', 'sprint complete')
        : copy('opakování dokončeno', 'review complete')}
    </p>
    <h1>
      {reviews === 0
        ? copy('Teď není nic k opakování', 'Nothing is due right now.')
        : mode === 'cram'
          ? copy('Sprint máš hotový', 'Sprint complete')
          : remainingDueCount > 0
            ? copy('Jedna dávka je hotová.', 'One batch is complete.')
            : copy('Pro teď máš hotovo', 'You’re done for now')}
    </h1>
    <p class="intro">
      {reviews === 0
        ? copy(
            'Teď nemáš žádná slovíčka k opakování. Dej si pauzu nebo pokračuj v kurzu.',
            'No words are due for review right now. Take a break or continue the course.',
          )
        : mode === 'cram'
          ? copy(
              'Sprint máš hotový. Běžné termíny opakování zůstávají stejné.',
              'Sprint complete. Your regular review dates are unchanged.',
            )
          : remainingDueCount > 0
            ? copy(
                `Ve vybrané skupině zbývá ${remainingDueCount} kartiček k opakování. Můžeš si je nechat na později.`,
                `${remainingDueCount} cards left to review in this group. You can leave them for later.`,
              )
            : copy(
                'Všechna slova mají uložený další termín opakování. Pro teď máš hotovo.',
                'Every word has its next review date saved. You’re done for now.',
              )}
    </p>

    {#if nextDueAt && mode === 'long-term'}
      <div class="next-plan">
        <Clock3 size={19} />
        <div>
          <span>{copy('Nejbližší návrat', 'Next return')}</span><strong
            >{dueLabel(nextDueAt)}</strong
          >
        </div>
      </div>
    {/if}

    {#if reviews > 0}
      <div class="stats">
        <article>
          <Target size={19} /><strong>{reviews}</strong><small>{copy('odpovědí', 'answers')}</small>
        </article>
        <article>
          <Check size={19} /><strong>{accuracy}%</strong><small
            >{copy('úspěšnost', 'accuracy')}</small
          >
        </article>
        {#if gamificationEnabled}
          <article><Sparkles size={19} /><strong>+{xp}</strong><small>XP</small></article>
          <article>
            <Flame size={19} /><strong>{streak}</strong><small
              >{copy('dní v sérii', 'day streak')}</small
            >
          </article>
        {/if}
      </div>
      {#if goalReached}<p class="goal">
          <Check size={16} />
          {copy(
            'Dnešní cíl je hotový. Další učení je volitelný bonus.',
            'Today’s goal is complete. More learning is an optional bonus.',
          )}
        </p>{/if}

      {#if gamificationEnabled}
        <section class="reward-board" aria-labelledby="reward-title">
          <div class="reward-heading">
            <div>
              <p class="lab-index">{copy('postup po relaci', 'progress after the session')}</p>
              <h2 id="reward-title">
                {leveledUp
                  ? copy(
                      `Nová úroveň ${level.level}: ${level.title}`,
                      `New level ${level.level}: ${gameLevelTitle('en', level.title)}`,
                    )
                  : newMissions > 0
                    ? $motherTongue === 'en'
                      ? `${newMissions} ${newMissions === 1 ? 'quest' : 'quests'} complete`
                      : `${newMissions === 1 ? 'Jedna mise splněna' : `${newMissions} mise splněny`}`
                    : bestCombo >= 3
                      ? copy(
                          `Nejlepší série v dávce: ${bestCombo}`,
                          `Best streak in the batch: ${bestCombo}`,
                        )
                      : copy('Tvoje odpovědi jsou uložené.', 'Your answers are saved.')}
              </h2>
            </div>
            <span class:complete={missionSummary.allCompleted} class="quest-seal">
              <strong>{missionSummary.completed}/{missionSummary.total}</strong>
              <small>{copy('mise', 'quests')}</small>
            </span>
          </div>

          <div class="level-progress">
            <div>
              <span
                >{copy('Úroveň', 'Level')}
                {level.level} · {gameLevelTitle($motherTongue, level.title)}</span
              ><strong>{level.totalXp} XP</strong>
            </div>
            <ProgressBar
              value={level.percent}
              label={copy('Postup do další úrovně', 'Progress to the next level')}
            />
            <small
              >{copy('Do další úrovně zbývá', 'XP to the next level:')}
              {Math.max(0, level.nextLevelXp - level.currentLevelXp)} XP.</small
            >
          </div>

          {#if rival}
            <div class="rival-after-session"><RivalDuel {rival} compact /></div>
          {/if}
        </section>
      {/if}
    {/if}

    <div class="complete-actions">
      <a class="btn-base btn-primary" href="/"
        >{copy('Zpět na dnešek', 'Back to today')} <ArrowRight size={18} /></a
      >
      {#if mode === 'cram'}
        <button class="btn-base btn-secondary" type="button" onclick={onsetup}
          ><RotateCcw size={18} /> {copy('Změnit sprint', 'Change sprint')}</button
        >
      {:else}
        <button class="btn-base btn-secondary" type="button" onclick={onsetup}
          ><RotateCcw size={18} /> {copy('Sestavit další dávku', 'Build another batch')}</button
        >
      {/if}
    </div>
  </div>
</section>

<style>
  .complete-wrap {
    max-width: 58rem;
    margin: 0 auto;
    padding-top: clamp(1rem, 7vw, 4rem);
  }
  .complete-sheet {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.35rem 1.35rem 0.35rem 0.35rem;
    background: var(--color-paper-50);
    padding: clamp(1.5rem, 6vw, 4rem);
    text-align: center;
    box-shadow: 8px 8px 0 var(--color-ink-950);
  }
  .complete-sheet::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 1.8rem;
    border-left: 1px solid var(--color-coral-500);
    pointer-events: none;
  }
  .complete-stamp {
    display: grid;
    width: 4.4rem;
    height: 4.4rem;
    margin: 0 auto;
    place-items: center;
    border: 2px solid var(--color-mint-700);
    border-radius: 999px;
    color: var(--color-mint-700);
    background: var(--color-mint-50);
    transform: rotate(-5deg);
  }
  .lab-index {
    margin-top: 1.25rem;
    color: var(--color-coral-700);
    font-family: var(--font-mono);
    font-size: 0.67rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h1 {
    max-width: 46rem;
    margin: 0.55rem auto 0;
    text-wrap: balance;
    font-size: clamp(2.4rem, 8vw, 5.6rem);
    font-weight: 900;
    line-height: 0.9;
    letter-spacing: -0.04em;
  }
  .intro {
    max-width: 39rem;
    margin: 1.2rem auto 0;
    color: var(--color-ink-600);
    line-height: 1.65;
  }
  .next-plan {
    display: inline-flex;
    align-items: center;
    gap: 0.7rem;
    margin-top: 1.4rem;
    border: 1px solid var(--color-cobalt-700);
    border-radius: 0.2rem;
    color: var(--color-cobalt-700);
    background: white;
    padding: 0.75rem 0.9rem;
    text-align: left;
    box-shadow: 3px 3px 0 var(--color-cobalt-300);
  }
  .next-plan span,
  .next-plan strong {
    display: block;
  }
  .next-plan span {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .next-plan strong {
    margin-top: 0.1rem;
    color: var(--color-ink-950);
    font-size: 0.82rem;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.6rem;
    max-width: 38rem;
    margin: 1.6rem auto 0;
  }
  .stats article {
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    align-items: center;
    column-gap: 0.55rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.2rem;
    background: white;
    padding: 0.8rem;
    text-align: left;
    box-shadow: 2px 2px 0 var(--color-line);
  }
  .stats article :global(svg) {
    grid-row: 1 / 3;
    color: var(--color-orange-700);
  }
  .stats strong {
    font-size: 1.1rem;
    line-height: 1;
  }
  .stats small {
    margin-top: 0.1rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.61rem;
    font-weight: 700;
  }
  .goal {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 1.1rem;
    border-bottom: 2px solid var(--color-mint-700);
    color: var(--color-mint-700);
    padding: 0.35rem;
    font-size: 0.74rem;
    font-weight: 780;
  }
  .reward-board {
    max-width: 42rem;
    margin: 1.7rem auto 0;
    border-top: 1px solid var(--color-ink-950);
    border-bottom: 1px solid var(--color-line);
    padding: 1.2rem 0;
    text-align: left;
  }
  .reward-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .reward-heading .lab-index {
    margin-top: 0;
    color: var(--color-ink-600);
  }
  .reward-heading h2 {
    margin-top: 0.2rem;
    text-wrap: balance;
    font-size: 1.1rem;
    font-weight: 880;
    letter-spacing: -0.025em;
  }
  .quest-seal {
    display: grid;
    width: 3.35rem;
    height: 3.35rem;
    flex: none;
    place-items: center;
    align-content: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    background: var(--color-paper-100);
  }
  .quest-seal.complete {
    background: var(--color-acid-500);
  }
  .quest-seal strong,
  .quest-seal small {
    display: block;
    text-align: center;
  }
  .quest-seal strong {
    font-family: var(--font-mono);
    font-size: 0.76rem;
    line-height: 1;
  }
  .quest-seal small {
    margin-top: 0.15rem;
    color: var(--color-ink-600);
    font-size: 0.56rem;
    font-weight: 800;
  }
  .level-progress {
    margin-top: 1rem;
  }
  .level-progress > div:first-child {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.45rem;
    font-size: 0.75rem;
    font-weight: 800;
  }
  .level-progress > div:first-child strong {
    font-family: var(--font-mono);
    font-size: 0.68rem;
  }
  .level-progress > small {
    display: block;
    margin-top: 0.4rem;
    color: var(--color-ink-600);
    font-size: 0.68rem;
  }
  .rival-after-session {
    margin-top: 1rem;
    border-top: 1px dashed var(--color-line);
    padding-top: 1rem;
  }
  .complete-actions {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 0.7rem;
    margin-top: 1.7rem;
  }
  @media (min-width: 540px) {
    .stats {
      grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    }
    .complete-actions {
      flex-direction: row;
    }
  }
</style>
