<script lang="ts">
  import BrandMark from '$lib/components/BrandMark.svelte';
  import { gameLevelTitle, t } from '$lib/i18n';
  import { appStore, gameProgress, motherTongue } from '$lib/state/app';
  import BookMarked from '@lucide/svelte/icons/book-marked';
  import Flame from '@lucide/svelte/icons/flame';
  import LogOut from '@lucide/svelte/icons/log-out';
  import Plus from '@lucide/svelte/icons/plus';
  import Settings from '@lucide/svelte/icons/settings';
  import WifiOff from '@lucide/svelte/icons/wifi-off';

  import type { NavigationItem } from './navigation.ts';

  let {
    items,
    online,
    offlineReady,
    settingsActive,
    showLogout,
    loggingOut,
    onsignout,
  }: {
    items: NavigationItem[];
    online: boolean;
    offlineReady: boolean;
    settingsActive: boolean;
    showLogout: boolean;
    loggingOut: boolean;
    onsignout: () => void;
  } = $props();

  const footerButton =
    'flex min-h-10 items-center justify-center gap-[0.4rem] rounded-[0.65rem] border border-white/12 p-[0.55rem] text-[0.68rem] font-bold text-white/66 fine-hover:not-disabled:bg-white/6 fine-hover:not-disabled:text-white';
</script>

<aside
  class="sticky top-0 hidden h-dvh flex-col overflow-x-hidden overflow-y-auto border-r border-white/12 bg-ink-950 p-[0.9rem] text-paper-50 lg:flex xl:p-[1.1rem]"
  data-testid="desktop-sidebar"
>
  <a
    href="/"
    class="flex items-center gap-3 px-1 pt-[0.1rem] pb-[0.85rem]"
    aria-label={t($motherTongue, 'shell.todayJourney')}
  >
    <BrandMark size={43} />
    <span class="grid min-w-0 gap-[0.2rem]">
      <strong class="text-[1.35rem] leading-none font-black tracking-[-0.04em] text-white"
        >Fritz</strong
      >
      <small class="truncate text-[0.68rem] font-[650] text-white/50"
        >{t($motherTongue, 'shell.brandTagline')}</small
      >
    </span>
  </a>

  <div class="flex items-center gap-[0.7rem] border-y border-white/12 px-1 py-3">
    <div
      class="grid size-[2.4rem] flex-none place-items-center rounded-xl border border-white/30 bg-acid-500 font-mono text-[0.75rem] font-black text-ink-950"
    >
      {$gameProgress.level.level}
    </div>
    <div class="grid min-w-0 gap-[0.15rem]">
      <span class="truncate text-[0.86rem] font-extrabold text-white"
        >{$appStore.settings?.profileName || t($motherTongue, 'shell.student')}</span
      >
      <small class="text-[0.62rem] text-white/48"
        >{gameLevelTitle($motherTongue, $gameProgress.level.title)} · {$gameProgress.totalXp}
        XP</small
      >
    </div>
  </div>

  <nav
    class="mt-3 flex flex-col gap-[0.2rem] short-sidebar:mt-[0.65rem] short-sidebar:gap-[0.16rem]"
    aria-label={t($motherTongue, 'shell.mainNavigation')}
  >
    {#each items as item}
      {@const Icon = item.icon}
      <a
        href={item.href}
        aria-current={item.active ? 'page' : undefined}
        class={[
          'grid min-h-[2.8rem] grid-cols-[2rem_minmax(0,1fr)] items-center gap-[0.45rem] rounded-xl border px-[0.65rem] py-[0.55rem] text-[0.83rem] font-[720] [transition:transform_150ms_var(--ease-out-emil),color_180ms_var(--ease-out-emil),background-color_180ms_var(--ease-out-emil),border-color_180ms_var(--ease-out-emil)] short-sidebar:py-[0.35rem]',
          item.active
            ? 'border-white/12 bg-white/[0.085] text-white'
            : 'border-transparent text-white/70 fine-hover:[transform:translateX(2px)] fine-hover:bg-white/5 fine-hover:text-white',
        ]}
      >
        <span
          class={[
            'grid size-8 place-items-center rounded-[0.58rem]',
            item.active ? 'bg-acid-500 text-ink-950' : 'bg-white/6',
          ]}><Icon size={18} strokeWidth={2.2} /></span
        >
        <span>{item.label}</span>
      </a>
    {/each}
  </nav>

  <div
    class="mt-[0.65rem] grid gap-[0.35rem] short-sidebar:mt-[0.55rem]"
    aria-label={t($motherTongue, 'shell.secondaryTools')}
  >
    <a
      class="flex min-h-[2.85rem] items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/4 text-[0.75rem] font-[760] text-white [transition:transform_150ms_var(--ease-out-emil),background-color_180ms_var(--ease-out-emil)] active:[transform:scale(0.97)] short-sidebar:min-h-[2.55rem] fine-hover:[transform:translateY(-1px)] fine-hover:bg-white/9"
      href="/create/"
    >
      <Plus size={18} strokeWidth={2.5} />
      {t($motherTongue, 'shell.addMaterial')}
    </a>
    <a
      class="flex min-h-[2.65rem] items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-[0.72rem] font-[730] text-white/70"
      href="/stories/"
    >
      <BookMarked size={17} />
      {t($motherTongue, 'shell.stories')}
    </a>
  </div>

  <div class="mt-auto grid grid-cols-2 gap-[0.45rem] pt-[0.65rem]">
    <div
      class="col-span-full flex items-center gap-[0.65rem] rounded-[0.85rem] border border-white/12 bg-white/5 p-[0.65rem] short-sidebar:hidden"
    >
      <span
        class="grid size-9 place-items-center rounded-[0.7rem] bg-[rgb(233_154_49/0.12)] text-orange-500"
        ><Flame size={19} fill="currentColor" /></span
      >
      <div class="grid gap-[0.12rem]">
        <strong class="text-[0.76rem] text-white"
          >{t($motherTongue, 'shell.streak', { count: $gameProgress.streak })}</strong
        >
        <small class="font-mono text-[0.56rem] text-white/46"
          >{t($motherTongue, 'common.xpToday', { xp: $gameProgress.todayXp })}</small
        >
      </div>
    </div>

    <div
      class="col-span-full flex items-center gap-[0.4rem] px-[0.35rem] py-[0.1rem] text-[0.62rem] text-white/55"
    >
      {#if online}
        <span
          class="size-[0.42rem] rounded-full bg-mint-200 shadow-[0_0_0_3px_rgb(174_231_199/0.12)]"
        ></span>
        {offlineReady
          ? t($motherTongue, 'shell.courseOffline')
          : t($motherTongue, 'shell.deviceOnline')}
      {:else}
        <WifiOff size={14} /> {t($motherTongue, 'shell.studyOffline')}
      {/if}
    </div>

    <a href="/settings/" aria-current={settingsActive ? 'page' : undefined} class={footerButton}>
      <Settings size={17} />
      {t($motherTongue, 'common.settings')}
    </a>
    {#if showLogout}
      <button
        class="{footerButton} text-left disabled:cursor-wait disabled:opacity-60"
        type="button"
        onclick={onsignout}
        disabled={loggingOut}
      >
        <LogOut size={17} />
        {loggingOut ? 'Odhlašuji…' : 'Odhlásit'}
      </button>
    {/if}
  </div>
</aside>
