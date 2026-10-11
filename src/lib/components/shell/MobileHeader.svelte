<script lang="ts">
  import BrandMark from '$lib/components/BrandMark.svelte';
  import { t } from '$lib/i18n';
  import { gameProgress, motherTongue } from '$lib/state/app';
  import Flame from '@lucide/svelte/icons/flame';
  import LogOut from '@lucide/svelte/icons/log-out';
  import Plus from '@lucide/svelte/icons/plus';
  import Sparkles from '@lucide/svelte/icons/sparkles';

  let {
    showLogout,
    loggingOut,
    onsignout,
  }: { showLogout: boolean; loggingOut: boolean; onsignout: () => void } = $props();

  const control =
    'inline-flex min-h-11 items-center justify-center rounded-[0.7rem] border border-[color-mix(in_srgb,var(--color-ink-950)_18%,transparent)] active:[transform:scale(0.96)]';
  const pill = `${control} gap-1 bg-[color-mix(in_srgb,var(--color-paper-50)_85%,transparent)] px-[0.52rem] font-mono text-[0.63rem] font-[850] fine-hover:border-[color-mix(in_srgb,var(--color-ink-950)_35%,transparent)] fine-hover:bg-white`;
</script>

<header
  class="sticky top-0 z-35 flex min-h-[calc(3.65rem+var(--safe-top))] items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--color-ink-950)_16%,transparent)] bg-[color-mix(in_srgb,var(--color-paper-100)_91%,transparent)] px-[0.9rem] pt-(--safe-top) backdrop-blur-[18px] lg:hidden"
>
  <a
    href="/"
    class="flex min-w-0 items-center gap-[0.55rem]"
    aria-label={t($motherTongue, 'shell.todayJourney')}
  >
    <BrandMark size={34} />
    <span class="grid min-w-0 gap-[0.02rem]"
      ><strong class="text-[1.08rem] leading-none font-black tracking-[-0.04em]">Fritz</strong
      ><small class="text-[0.58rem] font-bold text-ink-600"
        >{t($motherTongue, 'shell.todayJourneyShort')}</small
      ></span
    >
  </a>
  <div class="flex items-center gap-[0.35rem]">
    <a
      class="{pill} text-orange-700"
      href="/progress/"
      aria-label={t($motherTongue, 'shell.streakLabel', { count: $gameProgress.streak })}
    >
      <Flame size={15} fill="currentColor" />
      {$gameProgress.streak}
    </a>
    <a
      class="{pill} text-cobalt-700"
      href="/progress/"
      aria-label={t($motherTongue, 'shell.todayXpLabel', { xp: $gameProgress.todayXp })}
    >
      <Sparkles size={14} />
      {$gameProgress.todayXp}
    </a>
    <a
      class="{control} w-11 bg-acid-500 text-ink-950"
      href="/create/"
      aria-label={t($motherTongue, 'shell.addMaterialShort')}><Plus size={20} /></a
    >
    {#if showLogout}
      <button
        class="{control} w-11 bg-paper-50 text-coral-700 disabled:cursor-wait disabled:opacity-60"
        type="button"
        aria-label="Odhlásit"
        onclick={onsignout}
        disabled={loggingOut}><LogOut size={19} aria-hidden="true" /></button
      >
    {/if}
  </div>
</header>
