<script lang="ts">
  import { readLearner, rivalWeakness } from '$lib/domain/rival/engine.ts';
  import { localized } from '$lib/i18n';
  import {
    rivalPersonalities,
    rivalReadingLine,
    rivalRematchLine,
    rivalTopics,
  } from '$lib/i18n/rival.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Bot from '@lucide/svelte/icons/bot';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import UserRound from '@lucide/svelte/icons/user-round';
  import RivalAvatar from './RivalAvatar.svelte';

  import type { WeeklyRival } from '$lib/domain/gamification.ts';

  type Props = {
    rival: WeeklyRival;
    userName?: string;
    compact?: boolean;
  };
  let { rival, userName = 'Ty', compact = false }: Props = $props();

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  const reading = $derived(readLearner($appStore.recentReviews, $appStore.course.events));
  const activeMatch = $derived($appStore.course.rivalry?.match);
  const lastResult = $derived(
    $appStore.course.rivalry?.history.findLast((match) => match.rivalId === rival.profile.id),
  );

  let deadlineLabel = $derived(
    rival.daysLeft === 1
      ? copy('poslední den', 'last day')
      : copy(
          `${rival.daysLeft} ${rival.daysLeft >= 2 && rival.daysLeft <= 4 ? 'dny' : 'dní'}`,
          `${rival.daysLeft} days`,
        ),
  );

  let statusMessage = $derived(
    $motherTongue === 'cs'
      ? rival.message
      : rival.standing === 'leading'
        ? `You lead by ${rival.difference} XP.`
        : rival.standing === 'trailing'
          ? `${rival.profile.name} leads by ${Math.abs(rival.difference)} XP.`
          : 'You are tied.',
  );

  let rivalStyle = $derived(
    $motherTongue === 'cs'
      ? rival.profile.style
      : rival.profile.id === 'konrad'
        ? 'strong finish'
        : rival.profile.id === 'nora'
          ? 'short daily sessions'
          : 'steady pace',
  );
</script>

<div class:compact class="rival-duel">
  <header>
    <div class="duel-heading">
      <span class="bot-mark" aria-hidden="true"><Bot size={19} /></span>
      <div>
        <p>{copy('Soukromý soupeř', 'Private rival')}</p>
        <h3>{userName} vs. {rival.profile.name}</h3>
      </div>
    </div>
    <span class="deadline"><Clock3 size={13} /> {deadlineLabel}</span>
  </header>

  <div
    class="scoreboard"
    role="group"
    aria-label={copy(
      `Týdenní duel: ${userName} ${rival.userXp} XP, ${rival.profile.name} ${rival.rivalXp} XP`,
      `Weekly duel: ${userName} ${rival.userXp} XP, ${rival.profile.name} ${rival.rivalXp} XP`,
    )}
  >
    <div class:leading={rival.standing === 'leading'} class="player user-player">
      <span class="avatar" aria-hidden="true"><UserRound size={19} /></span>
      <div><strong>{userName}</strong><small>{rival.userXp} XP</small></div>
    </div>
    <span class="versus">VS</span>
    <div class:leading={rival.standing === 'trailing'} class="player rival-player">
      <div><strong>{rival.profile.name}</strong><small>{rival.rivalXp} XP</small></div>
      <span class="avatar" aria-hidden="true">{rival.profile.initials}</span>
    </div>
  </div>

  <div class="duel-tracks">
    <div
      class="track user-track"
      role="progressbar"
      aria-label={`${userName}: ${rival.userXp} XP`}
      aria-valuemin="0"
      aria-valuemax={Math.max(rival.targetXp, rival.userXp, rival.rivalXp)}
      aria-valuenow={rival.userXp}
    >
      <i style:transform={`scaleX(${rival.userPercent / 100})`}></i>
    </div>
    <div
      class="track rival-track"
      role="progressbar"
      aria-label={`${rival.profile.name}: ${rival.rivalXp} XP`}
      aria-valuemin="0"
      aria-valuemax={Math.max(rival.targetXp, rival.userXp, rival.rivalXp)}
      aria-valuenow={rival.rivalXp}
    >
      <i style:transform={`scaleX(${rival.rivalPercent / 100})`}></i>
    </div>
  </div>

  <div class="duel-status">
    <strong>{statusMessage}</strong>
    <span>{rivalStyle} · {rival.weekLabel}</span>
  </div>

  {#if !compact}
    <div class="rival-thought">
      <RivalAvatar small />
      <p>
        {lastResult
          ? rivalRematchLine(
              lastResult.rounds.filter((round) => round.correct).length,
              $motherTongue,
            )
          : rivalReadingLine(reading, $motherTongue)}
      </p>
    </div>
    <details class="rival-plan">
      <summary>{copy('Přečíst soupeřovu taktiku', 'Read your rival’s strategy')}</summary>
      <p>{rivalPersonalities[rival.profile.id].plan[$motherTongue]}</p>
      <strong
        >{copy('Slabší místo:', 'Weaker side:')}
        {rivalTopics[rivalWeakness(rival.profile.id)][$motherTongue]}</strong
      >
    </details>
  {/if}
  <a class="duel-link" href="/rival/"
    >{activeMatch && !activeMatch.completedAt
      ? copy('Pokračovat v souboji', 'Resume duel')
      : copy('Vyzvat na souboj · 5 kol', 'Challenge rival · 5 rounds')}<ArrowRight
      size={16}
      aria-hidden="true"
    /></a
  >

  {#if !compact}
    <p class="privacy-note">
      {copy(
        'Týdenní tempo i soupeř jsou lokální simulace. V přímém souboji robot reaguje na tvoje odpovědi a pamatuje si odvety.',
        'The weekly pace and rival are simulated locally. In a direct duel the robot adapts to your answers and remembers rematches.',
      )}
    </p>
  {/if}
</div>

<style>
  .rival-duel {
    display: grid;
    gap: 1rem;
  }
  .rival-thought {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    background: var(--color-cobalt-50);
    border-radius: 10px;
    padding: 0.75rem;
  }
  .rival-thought p {
    font-size: 0.81rem;
    line-height: 1.55;
    color: var(--color-ink-800);
  }
  .rival-plan {
    font-size: 0.8rem;
    line-height: 1.5;
  }
  .rival-plan summary {
    min-height: 44px;
    align-content: center;
    cursor: pointer;
  }
  .rival-plan p {
    color: var(--color-ink-700);
    margin-bottom: 0.5rem;
  }
  .duel-link {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
    border: 1px solid var(--color-cobalt-700);
    background: var(--color-cobalt-50);
    color: var(--color-cobalt-700);
    border-radius: 8px;
    padding: 0.65rem 0.8rem;
    font-size: 0.83rem;
    font-weight: 750;
    text-decoration: none;
    transition: transform 140ms var(--ease-out-emil);
  }
  .duel-link:active {
    transform: scale(0.97);
  }
  @media (hover: hover) and (pointer: fine) {
    .duel-link:hover {
      background: var(--color-cobalt-100);
    }
  }

  header,
  .duel-heading,
  .scoreboard,
  .player,
  .deadline {
    display: flex;
    align-items: center;
  }

  header {
    justify-content: space-between;
    gap: 1rem;
  }

  .duel-heading {
    min-width: 0;
    gap: 0.65rem;
  }

  .bot-mark,
  .avatar {
    display: grid;
    flex: none;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
  }

  .bot-mark {
    width: 2.45rem;
    height: 2.45rem;
    color: var(--color-cobalt-700);
    background: var(--color-sky-50);
  }

  .duel-heading p {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.59rem;
    font-weight: 800;
    letter-spacing: 0.065em;
    text-transform: uppercase;
  }

  .duel-heading h3 {
    margin-top: 0.1rem;
    font-size: 1.05rem;
    font-weight: 880;
    letter-spacing: -0.025em;
  }

  .deadline {
    flex: none;
    gap: 0.3rem;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    color: var(--color-ink-600);
    background: var(--color-paper-50);
    padding: 0.35rem 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 780;
  }

  .scoreboard {
    justify-content: space-between;
    gap: 0.65rem;
  }

  .player {
    min-width: 0;
    flex: 1;
    gap: 0.55rem;
    color: var(--color-ink-600);
  }

  .player.leading {
    color: var(--color-ink-950);
  }

  .rival-player {
    justify-content: flex-end;
    text-align: right;
  }

  .avatar {
    width: 2.35rem;
    height: 2.35rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
    font-family: var(--font-mono);
    font-size: 0.63rem;
    font-weight: 900;
  }

  .rival-player .avatar {
    color: white;
    background: var(--color-cobalt-700);
  }

  .player strong,
  .player small {
    display: block;
  }

  .player strong {
    overflow: hidden;
    font-size: 0.78rem;
    font-weight: 850;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .player small {
    margin-top: 0.08rem;
    font-family: var(--font-mono);
    font-size: 0.64rem;
    font-weight: 800;
  }

  .versus {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.55rem;
    font-weight: 900;
  }

  .duel-tracks {
    display: grid;
    gap: 0.35rem;
  }

  .track {
    height: 0.58rem;
    overflow: hidden;
    border-radius: 999px;
    background: var(--color-paper-200);
  }

  .track i {
    display: block;
    width: 100%;
    height: 100%;
    transform-origin: left center;
    border-radius: inherit;
    transition: transform 220ms var(--ease-out-emil);
  }

  .user-track i {
    background: var(--color-acid-500);
  }

  .rival-track i {
    background: var(--color-cobalt-700);
  }

  .duel-status strong,
  .duel-status span {
    display: block;
  }

  .duel-status strong {
    font-size: 0.82rem;
  }

  .duel-status span,
  .privacy-note {
    margin-top: 0.2rem;
    color: var(--color-ink-600);
    font-size: 0.7rem;
    line-height: 1.45;
  }

  .privacy-note {
    border-top: 1px solid var(--color-line);
    padding-top: 0.75rem;
  }

  .compact {
    gap: 0.75rem;
  }

  .compact .bot-mark {
    width: 2.1rem;
    height: 2.1rem;
  }

  @media (max-width: 430px) {
    header {
      align-items: flex-start;
    }

    .deadline {
      border: 0;
      background: transparent;
      padding-inline: 0;
    }
  }
</style>
