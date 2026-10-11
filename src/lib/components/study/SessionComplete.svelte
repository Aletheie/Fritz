<script lang="ts">
  import CelebrationBurst from '$lib/components/gamification/CelebrationBurst.svelte';
  import RivalDuel from '$lib/components/gamification/RivalDuel.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import { gameLevelTitle } from '$lib/i18n';
  import { dueMomentLabel } from '$lib/i18n/schedule.ts';
  import { motherTongue, tr } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Flame from '@lucide/svelte/icons/flame';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Target from '@lucide/svelte/icons/target';

  import type { LevelProgress, MissionSummary, WeeklyRival } from '$lib/domain/gamification.ts';

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

  const labIndex = 'font-mono text-[0.67rem] font-extrabold tracking-[0.08em] uppercase';
  const stat =
    'grid grid-cols-[auto_1fr] grid-rows-[auto_auto] items-center gap-x-[0.55rem] rounded-[0.2rem] border border-ink-950 bg-white p-[0.8rem] text-left shadow-[2px_2px_0_var(--color-line)] [&>small]:mt-[0.1rem] [&>small]:font-mono [&>small]:text-[0.61rem] [&>small]:font-bold [&>small]:text-ink-600 [&>strong]:text-[1.1rem] [&>strong]:leading-none [&>svg]:row-[1/3] [&>svg]:text-orange-700';
</script>

<section class="mx-auto max-w-[58rem] pt-[clamp(1rem,7vw,4rem)]">
  <div
    class="completion-arrival relative overflow-hidden rounded-[0.35rem_1.35rem_0.35rem_0.35rem] border border-ink-950 bg-paper-50 p-[clamp(1.5rem,6vw,4rem)] text-center shadow-[8px_8px_0_var(--color-ink-950)] before:pointer-events-none before:absolute before:inset-y-0 before:left-[1.8rem] before:border-l before:border-coral-500"
  >
    <CelebrationBurst
      visible={celebrations && reviews > 0 && (goalNewlyReached || leveledUp || newMissions > 0)}
    />
    <div
      class="mx-auto grid size-[4.4rem] -rotate-5 place-items-center rounded-full border-2 border-mint-700 bg-mint-50 text-mint-700"
    >
      <Check size={28} />
    </div>
    <p class="{labIndex} mt-5 text-coral-700">
      {mode === 'cram'
        ? $tr('sprint uzavřen', 'sprint complete')
        : $tr('opakování dokončeno', 'review complete')}
    </p>
    <h1
      class="mx-auto mt-[0.55rem] max-w-[46rem] text-[clamp(2.4rem,8vw,5.6rem)] leading-[0.9] font-black tracking-[-0.04em] text-balance"
    >
      {reviews === 0
        ? $tr('Teď není nic k opakování', 'Nothing is due right now.')
        : mode === 'cram'
          ? $tr('Sprint máš hotový', 'Sprint complete')
          : remainingDueCount > 0
            ? $tr('Jedna dávka je hotová.', 'One batch is complete.')
            : $tr('Pro teď máš hotovo', 'You’re done for now')}
    </h1>
    <p class="mx-auto mt-[1.2rem] max-w-[39rem] leading-[1.65] text-ink-600">
      {reviews === 0
        ? $tr(
            'Teď nemáš žádná slovíčka k opakování. Dej si pauzu nebo pokračuj v kurzu.',
            'No words are due for review right now. Take a break or continue the course.',
          )
        : mode === 'cram'
          ? $tr(
              'Sprint máš hotový. Běžné termíny opakování zůstávají stejné.',
              'Sprint complete. Your regular review dates are unchanged.',
            )
          : remainingDueCount > 0
            ? $tr(
                `Ve vybrané skupině zbývá ${remainingDueCount} kartiček k opakování. Můžeš si je nechat na později.`,
                `${remainingDueCount} cards left to review in this group. You can leave them for later.`,
              )
            : $tr(
                'Všechna slova mají uložený další termín opakování. Pro teď máš hotovo.',
                'Every word has its next review date saved. You’re done for now.',
              )}
    </p>

    {#if nextDueAt && mode === 'long-term'}
      <div
        class="mt-[1.4rem] inline-flex items-center gap-[0.7rem] rounded-[0.2rem] border border-cobalt-700 bg-white px-[0.9rem] py-3 text-left text-cobalt-700 shadow-[3px_3px_0_var(--color-cobalt-300)]"
      >
        <Clock3 size={19} />
        <div>
          <span
            class="block font-mono text-[0.6rem] font-extrabold tracking-[0.05em] text-ink-600 uppercase"
            >{$tr('Nejbližší návrat', 'Next return')}</span
          ><strong class="mt-[0.1rem] block text-[0.82rem] text-ink-950"
            >{dueMomentLabel($motherTongue, nextDueAt)}</strong
          >
        </div>
      </div>
    {/if}

    {#if reviews > 0}
      <div
        class="mx-auto mt-[1.6rem] grid max-w-[38rem] grid-cols-2 gap-[0.6rem] min-[540px]:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]"
      >
        <article class={stat}>
          <Target size={19} /><strong>{reviews}</strong><small>{$tr('odpovědí', 'answers')}</small>
        </article>
        <article class={stat}>
          <Check size={19} /><strong>{accuracy}%</strong><small
            >{$tr('úspěšnost', 'accuracy')}</small
          >
        </article>
        {#if gamificationEnabled}
          <article class={stat}>
            <Sparkles size={19} /><strong>+{xp}</strong><small>XP</small>
          </article>
          <article class={stat}>
            <Flame size={19} /><strong>{streak}</strong><small
              >{$tr('dní v sérii', 'day streak')}</small
            >
          </article>
        {/if}
      </div>
      {#if goalReached}<p
          class="mt-[1.1rem] inline-flex items-center gap-[0.4rem] border-b-2 border-mint-700 p-[0.35rem] text-[0.74rem] font-[780] text-mint-700"
        >
          <Check size={16} />
          {$tr(
            'Dnešní cíl je hotový. Další učení je volitelný bonus.',
            'Today’s goal is complete. More learning is an optional bonus.',
          )}
        </p>{/if}

      {#if gamificationEnabled}
        <section
          class="mx-auto mt-[1.7rem] max-w-[42rem] border-t border-b border-t-ink-950 border-b-line py-[1.2rem] text-left"
          aria-labelledby="reward-title"
        >
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="{labIndex} text-ink-600">
                {$tr('postup po relaci', 'progress after the session')}
              </p>
              <h2
                class="mt-[0.2rem] text-[1.1rem] font-[880] tracking-[-0.025em] text-balance"
                id="reward-title"
              >
                {leveledUp
                  ? $tr(
                      `Nová úroveň ${level.level}: ${level.title}`,
                      `New level ${level.level}: ${gameLevelTitle('en', level.title)}`,
                    )
                  : newMissions > 0
                    ? $motherTongue === 'en'
                      ? `${newMissions} ${newMissions === 1 ? 'quest' : 'quests'} complete`
                      : `${newMissions === 1 ? 'Jedna mise splněna' : `${newMissions} mise splněny`}`
                    : bestCombo >= 3
                      ? $tr(
                          `Nejlepší série v dávce: ${bestCombo}`,
                          `Best streak in the batch: ${bestCombo}`,
                        )
                      : $tr('Tvoje odpovědi jsou uložené.', 'Your answers are saved.')}
              </h2>
            </div>
            <span
              class={[
                'grid size-[3.35rem] flex-none place-items-center content-center rounded-full border border-ink-950',
                missionSummary.allCompleted ? 'bg-acid-500' : 'bg-paper-100',
              ]}
            >
              <strong class="block text-center font-mono text-[0.76rem] leading-none"
                >{missionSummary.completed}/{missionSummary.total}</strong
              >
              <small
                class="mt-[0.15rem] block text-center text-[0.56rem] font-extrabold text-ink-600"
                >{$tr('mise', 'quests')}</small
              >
            </span>
          </div>

          <div class="mt-4">
            <div
              class="mb-[0.45rem] flex items-baseline justify-between gap-4 text-[0.75rem] font-extrabold"
            >
              <span
                >{$tr('Úroveň', 'Level')}
                {level.level} · {gameLevelTitle($motherTongue, level.title)}</span
              ><strong class="font-mono text-[0.68rem]">{level.totalXp} XP</strong>
            </div>
            <ProgressBar
              value={level.percent}
              label={$tr('Postup do další úrovně', 'Progress to the next level')}
            />
            <small class="mt-[0.4rem] block text-[0.68rem] text-ink-600"
              >{$tr('Do další úrovně zbývá', 'XP to the next level:')}
              {Math.max(0, level.nextLevelXp - level.currentLevelXp)} XP.</small
            >
          </div>

          {#if rival}
            <div class="mt-4 border-t border-dashed border-line pt-4">
              <RivalDuel {rival} compact />
            </div>
          {/if}
        </section>
      {/if}
    {/if}

    <div class="mt-[1.7rem] flex flex-col justify-center gap-[0.7rem] min-[540px]:flex-row">
      <a class="btn-base btn-primary" href="/"
        >{$tr('Zpět na dnešek', 'Back to today')} <ArrowRight size={18} /></a
      >
      {#if mode === 'cram'}
        <button class="btn-base btn-secondary" type="button" onclick={onsetup}
          ><RotateCcw size={18} /> {$tr('Změnit sprint', 'Change sprint')}</button
        >
      {:else}
        <button class="btn-base btn-secondary" type="button" onclick={onsetup}
          ><RotateCcw size={18} /> {$tr('Sestavit další dávku', 'Build another batch')}</button
        >
      {/if}
    </div>
  </div>
</section>
