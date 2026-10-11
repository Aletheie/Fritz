<script lang="ts">
  import { gameLevelTitle, t } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Flame from '@lucide/svelte/icons/flame';
  import Settings from '@lucide/svelte/icons/settings';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Trophy from '@lucide/svelte/icons/trophy';

  import type { HomeGameProgress } from './home-view-model.ts';

  let { game }: { game: HomeGameProgress } = $props();

  const metric =
    'flex min-h-[2.9rem] items-center gap-2 rounded-[0.5rem_0.9rem_0.5rem_0.5rem] bg-[color-mix(in_srgb,var(--color-paper-50)_82%,transparent)] [transition:background-color_160ms_var(--ease-out-emil),transform_140ms_var(--ease-out-emil)] fine-hover:bg-white active:[transform:scale(0.97)]';
  const value = 'grid [&>strong]:text-[0.88rem] [&>strong]:leading-none';
  const caption = 'mt-[0.18rem] text-[0.75rem] leading-none whitespace-nowrap text-ink-600';
</script>

<header
  class="block px-[0.1rem] pt-[0.1rem] pb-[1.1rem] min-[1280px]:flex min-[1280px]:items-center min-[1280px]:justify-between min-[1280px]:gap-6 min-[1280px]:pt-[0.35rem]"
>
  <div>
    <p class="kicker text-ink-800">{t($motherTongue, 'home.kicker')}</p>
    <h1
      class="mt-[0.18rem] text-[2.15rem] leading-none font-[930] tracking-[-0.04em] min-[640px]:text-[2.75rem]"
    >
      {t($motherTongue, 'home.title')}
    </h1>
    <p
      class="mt-[0.42rem] max-w-[35rem] text-[0.86rem] leading-[1.45] text-ink-800 min-[640px]:text-[0.9rem]"
    >
      {t($motherTongue, 'home.intro')}
    </p>
  </div>

  <nav
    aria-label={t($motherTongue, 'home.todayStatus')}
    class="hidden items-stretch gap-[0.4rem] min-[1280px]:flex"
  >
    <a
      class="{metric} min-w-[5.2rem] px-[0.65rem] py-2 text-orange-700"
      href="/progress/"
      aria-label={t($motherTongue, 'shell.streakLabel', { count: game.streak })}
    >
      <Flame size={18} fill="currentColor" />
      <span class={value}
        ><strong>{game.streak}</strong><small class={caption}>{t($motherTongue, 'home.days')}</small
        ></span
      >
    </a>
    <a
      class="{metric} min-w-[5.2rem] px-[0.65rem] py-2 text-ink-950"
      href="/progress/"
      aria-label={t($motherTongue, 'shell.todayXpLabel', { xp: game.todayXp })}
    >
      <Sparkles size={18} />
      <span class={value}
        ><strong>{game.todayXp}</strong><small class={caption}
          >{t($motherTongue, 'home.xpToday')}</small
        ></span
      >
    </a>
    <a
      class="{metric} min-w-[5.2rem] px-[0.65rem] py-2 text-ink-950"
      href="/progress/"
      aria-label={t($motherTongue, 'home.levelLabel', {
        level: game.level,
        title: gameLevelTitle($motherTongue, game.levelTitle),
      })}
    >
      <Trophy size={18} />
      <span class={value}
        ><strong>{game.level}</strong><small class={caption}
          >{gameLevelTitle($motherTongue, game.levelTitle)}</small
        ></span
      >
    </a>
    <a
      class="{metric} min-w-[2.9rem] justify-center text-ink-950"
      href="/settings/"
      aria-label={t($motherTongue, 'home.openSettings')}><Settings size={20} /></a
    >
  </nav>
</header>
