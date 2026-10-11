<script lang="ts">
  import { t } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';

  import type { NavigationItem } from './navigation.ts';

  let { items }: { items: NavigationItem[] } = $props();
</script>

<nav
  class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[color-mix(in_srgb,var(--color-ink-950)_17%,transparent)] bg-[color-mix(in_srgb,var(--color-paper-50)_94%,transparent)] px-1 pt-[0.4rem] pb-[calc(0.35rem+var(--safe-bottom))] shadow-[0_-12px_35px_rgb(21_25_28/0.08)] backdrop-blur-[18px] lg:hidden"
  aria-label={t($motherTongue, 'shell.mobileNavigation')}
>
  {#each items as item}
    {@const Icon = item.icon}
    <a
      href={item.href}
      aria-label={item.label}
      aria-current={item.active ? 'page' : undefined}
      class={[
        'flex min-h-[4.1rem] flex-col items-center justify-center gap-[0.22rem] text-center text-[0.75rem] font-[720] [transition:transform_140ms_var(--ease-out-emil),color_160ms_var(--ease-out-emil)] active:[transform:scale(0.95)]',
        item.active ? 'text-ink-950' : 'text-ink-600',
      ]}
    >
      <span
        class={[
          'grid h-[1.8rem] w-11 place-items-center rounded-[0.7rem] [transition:background-color_180ms_var(--ease-out-emil)]',
          item.active && 'bg-acid-500 shadow-[inset_0_0_0_1px_rgb(21_25_28/0.12)]',
        ]}><Icon size={20} strokeWidth={item.active ? 2.55 : 2.05} /></span
      >
      <span>{item.mobileLabel}</span>
    </a>
  {/each}
</nav>
