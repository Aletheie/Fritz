<script lang="ts">
  import { gameLevelTitle, t } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Flame from '@lucide/svelte/icons/flame';
  import Settings from '@lucide/svelte/icons/settings';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Trophy from '@lucide/svelte/icons/trophy';

  import type { HomeGameProgress } from './home-view-model.ts';

  let { game }: { game: HomeGameProgress } = $props();
</script>

<header class="home-header">
  <div>
    <p class="kicker">{t($motherTongue, 'home.kicker')}</p>
    <h1>{t($motherTongue, 'home.title')}</h1>
    <p class="intro">{t($motherTongue, 'home.intro')}</p>
  </div>

  <nav aria-label={t($motherTongue, 'home.todayStatus')} class="home-metrics">
    <a href="/progress/" aria-label={t($motherTongue, 'shell.streakLabel', { count: game.streak })}>
      <Flame size={18} fill="currentColor" />
      <span><strong>{game.streak}</strong><small>{t($motherTongue, 'home.days')}</small></span>
    </a>
    <a href="/progress/" aria-label={t($motherTongue, 'shell.todayXpLabel', { xp: game.todayXp })}>
      <Sparkles size={18} />
      <span><strong>{game.todayXp}</strong><small>{t($motherTongue, 'home.xpToday')}</small></span>
    </a>
    <a
      href="/progress/"
      aria-label={t($motherTongue, 'home.levelLabel', {
        level: game.level,
        title: gameLevelTitle($motherTongue, game.levelTitle),
      })}
    >
      <Trophy size={18} />
      <span
        ><strong>{game.level}</strong><small>{gameLevelTitle($motherTongue, game.levelTitle)}</small
        ></span
      >
    </a>
    <a class="settings" href="/settings/" aria-label={t($motherTongue, 'home.openSettings')}
      ><Settings size={20} /></a
    >
  </nav>
</header>

<style>
  .home-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 0.35rem 0.1rem 1.1rem;
  }
  .home-header .kicker {
    color: var(--color-ink-800);
  }
  h1 {
    margin: 0.18rem 0 0;
    font-size: 2.75rem;
    font-weight: 930;
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .intro {
    max-width: 35rem;
    margin: 0.42rem 0 0;
    color: var(--color-ink-800);
    font-size: 0.9rem;
    line-height: 1.45;
  }
  .home-metrics {
    display: flex;
    align-items: stretch;
    gap: 0.4rem;
  }
  .home-metrics a {
    display: flex;
    min-width: 5.2rem;
    min-height: 2.9rem;
    align-items: center;
    gap: 0.5rem;
    border-radius: 0.5rem 0.9rem 0.5rem 0.5rem;
    color: var(--color-ink-950);
    background: color-mix(in srgb, var(--color-paper-50) 82%, transparent);
    padding: 0.5rem 0.65rem;
    transition:
      background-color 160ms var(--ease-out-emil),
      transform 140ms var(--ease-out-emil);
  }
  .home-metrics a:first-child {
    color: var(--color-orange-700);
  }
  .home-metrics span {
    display: grid;
  }
  .home-metrics strong {
    font-size: 0.88rem;
    line-height: 1;
  }
  .home-metrics small {
    margin-top: 0.18rem;
    color: var(--color-ink-600);
    font-size: 0.75rem;
    line-height: 1;
    white-space: nowrap;
  }
  .home-metrics .settings {
    min-width: 2.9rem;
    justify-content: center;
    padding: 0;
  }
  .home-metrics a:active {
    transform: scale(0.97);
  }
  @media (hover: hover) and (pointer: fine) {
    .home-metrics a:hover {
      background: white;
    }
  }
  @media (max-width: 1279px) {
    .home-header {
      display: block;
      padding-top: 0.1rem;
    }
    .home-metrics {
      display: none;
    }
  }
  @media (max-width: 639px) {
    h1 {
      font-size: 2.15rem;
    }
    .intro {
      font-size: 0.86rem;
    }
  }
</style>
