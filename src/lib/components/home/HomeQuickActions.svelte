<script lang="ts">
  import { t } from '$lib/i18n';
  import { rivalNames } from '$lib/i18n/rival.ts';
  import { appStore, gameProgress, motherTongue } from '$lib/state/app';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Bot from '@lucide/svelte/icons/bot';
  import CalendarCheck from '@lucide/svelte/icons/calendar-check';
  import Plus from '@lucide/svelte/icons/plus';
  import Swords from '@lucide/svelte/icons/swords';
  const match = $derived($appStore.course.rivalry?.match);
  const rivalName = $derived(match ? rivalNames[match.rivalId] : $gameProgress.rival.profile.name);
  const canResume = $derived(Boolean(match && !match.completedAt));
</script>

<section class="quick-actions" aria-labelledby="detours-title">
  <header>
    <h2 id="detours-title">{t($motherTongue, 'home.detours')}</h2>
    <span>{t($motherTongue, 'home.detoursDescription')}</span>
  </header>

  <nav aria-label={t($motherTongue, 'home.detoursNavigation')}>
    {#if $appStore.settings?.gamificationEnabled && $appStore.settings.rivalryEnabled}
      <a href="/rival/">
        <span class="action-icon"><Swords size={18} aria-hidden="true" /></span>
        <span
          ><strong>{$motherTongue === 'cs' ? `Souboj: ${rivalName}` : `Duel: ${rivalName}`}</strong
          ><small
            >{canResume && match
              ? $motherTongue === 'cs'
                ? `Pokračovat · kolo ${match.rounds.length} z 5`
                : `Continue · round ${match.rounds.length} of 5`
              : $motherTongue === 'cs'
                ? 'Pět otázek, vlastním tempem'
                : 'Five questions, at your own pace'}</small
          ></span
        >
      </a>
    {/if}
    <a href="/create/">
      <span class="action-icon"><Plus size={18} /></span>
      <span
        ><strong>{t($motherTongue, 'home.ownWords')}</strong><small
          >{t($motherTongue, 'home.ownWordsDescription')}</small
        ></span
      >
    </a>
    <a href="/stories/">
      <span class="action-icon"><BookOpen size={18} /></span>
      <span
        ><strong>{t($motherTongue, 'home.reading')}</strong><small
          >{t($motherTongue, 'home.readingDescription')}</small
        ></span
      >
    </a>
    <a href="/coach/">
      <span class="action-icon"><Bot size={18} /></span>
      <span
        ><strong>{t($motherTongue, 'home.aiLab')}</strong><small
          >{t($motherTongue, 'home.aiLabDescription')}</small
        ></span
      >
    </a>
    <a href="/exam/">
      <span class="action-icon"><CalendarCheck size={18} /></span>
      <span
        ><strong>{$motherTongue === 'cs' ? 'Plán na písemku' : 'Test plan'}</strong><small
          >{$motherTongue === 'cs'
            ? 'Co už umíš a co si zopakovat'
            : 'What you know and what to review'}</small
        ></span
      >
    </a>
  </nav>
</section>

<style>
  .quick-actions {
    min-width: 0;
    border-top: 1px solid color-mix(in srgb, var(--color-ink-950) 16%, transparent);
    padding-top: 0.8rem;
  }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }
  h2 {
    margin: 0;
    font-size: 0.92rem;
  }
  header > span {
    color: var(--color-ink-800);
    font-size: 0.7rem;
  }
  nav {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    margin-top: 0.55rem;
  }
  a {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.55rem;
    min-height: 4.25rem;
    border-radius: 0.5rem 0.8rem 0.5rem 0.5rem;
    background: color-mix(in srgb, var(--color-paper-50) 68%, transparent);
    padding: 0.65rem;
    color: inherit;
    text-decoration: none;
    transition:
      background-color 160ms var(--ease-out-emil),
      transform 140ms var(--ease-out-emil);
  }
  .action-icon {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 0.45rem 0.65rem 0.45rem 0.45rem;
    color: var(--color-cobalt-700);
    background: var(--color-sky-50);
  }
  a > span:last-child {
    display: grid;
    min-width: 0;
  }
  strong {
    font-size: 0.79rem;
  }
  small {
    margin-top: 0.14rem;
    color: var(--color-ink-600);
    font-size: 0.66rem;
    line-height: 1.3;
  }
  a:active {
    transform: scale(0.97);
  }
  @media (hover: hover) and (pointer: fine) {
    a:hover {
      background: white;
    }
  }
  @media (max-width: 679px) {
    header {
      display: grid;
      gap: 0.15rem;
    }
    nav {
      grid-template-columns: 1fr;
    }
    a {
      min-height: 3.8rem;
    }
  }
</style>
