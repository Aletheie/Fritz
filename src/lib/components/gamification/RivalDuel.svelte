<script lang="ts">
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Bot from '@lucide/svelte/icons/bot';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import UserRound from '@lucide/svelte/icons/user-round';

  import type { WeeklyRival } from '$lib/domain/gamification.ts';

  let {
    rival,
    userName = 'Ty',
    compact = false,
  } = $props<{
    rival: WeeklyRival;
    userName?: string;
    compact?: boolean;
  }>();

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

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
        <p>{copy('Soukromý AI duel', 'Private AI duel')}</p>
        <h3>{userName} vs. {rival.profile.name}</h3>
      </div>
    </div>
    <span class="deadline"><Clock3 size={13} /> {deadlineLabel}</span>
  </header>

  <div
    class="scoreboard"
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
    <p class="privacy-note">
      {copy(
        'Rival je simulovaný lokálně podle tvého obvyklého tempa. Není to skutečný člověk a žádná studijní data se kvůli duelu neposílají online.',
        'Your rival is simulated locally from your usual pace. It is not a real person, and no study data is sent online for the duel.',
      )}
    </p>
  {/if}
</div>

<style>
  .rival-duel {
    display: grid;
    gap: 1rem;
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
