<script lang="ts">
  import { t } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';

  import type { HomeRailItem } from './home-view-model.ts';

  let { items, class: className = '' }: { items: HomeRailItem[]; class?: string } = $props();

  const mono = 'font-mono text-[0.66rem] font-[760] tracking-[0.05em] text-ink-800 uppercase';

  const currentIndex = $derived.by(() => {
    const index = items.findIndex((item) => item.state === 'current');
    return index >= 0 ? index : 0;
  });
  const visibleItems = $derived.by(() => {
    const windowSize = 5;
    const start = Math.max(0, Math.min(currentIndex - 1, items.length - windowSize));
    return items.slice(start, start + windowSize);
  });
  const currentItem = $derived(items[currentIndex]);
</script>

<nav
  class={[
    'min-w-0 max-[1280px]:[scrollbar-width:thin] max-[1280px]:overflow-x-auto max-[1280px]:border-b max-[1280px]:border-[color-mix(in_srgb,var(--color-ink-950)_13%,transparent)] max-[1280px]:pb-[0.55rem] min-[1280px]:sticky min-[1280px]:top-6 min-[1280px]:self-start',
    className,
  ]}
  aria-label={t($motherTongue, 'home.courseChapters')}
>
  <header class="mb-2 flex items-end justify-between gap-3 px-1 max-[1280px]:mb-[0.4rem]">
    <div class="grid gap-[0.08rem]">
      <span class={mono}>{t($motherTongue, 'home.courseMap')}</span>
      <strong class="text-[0.9rem]">{currentItem?.level ?? 'A1.1'}</strong>
    </div>
    <small class={mono}>{currentItem?.number ?? 0}/{items.length}</small>
  </header>

  <ol class="m-0 grid list-none gap-[0.28rem] p-0 max-[1280px]:flex max-[1280px]:w-max">
    {#each visibleItems as item}
      <li class="max-[1280px]:w-[12.5rem]">
        <a
          class={[
            'grid min-h-[3.45rem] grid-cols-[2.1rem_minmax(0,1fr)] items-center gap-[0.55rem] rounded-[0.55rem_0.85rem_0.55rem_0.55rem] border px-2 py-[0.42rem] text-inherit no-underline [transition:background-color_160ms_var(--ease-out-emil),border-color_160ms_var(--ease-out-emil),transform_140ms_var(--ease-out-emil)]',
            item.state === 'current' ? 'border-ink-950 bg-acid-100' : 'border-transparent',
            item.state === 'locked'
              ? 'cursor-default opacity-50'
              : 'active:[transform:scale(0.97)]',
            item.state !== 'locked' &&
              item.state !== 'current' &&
              'fine-hover:bg-[color-mix(in_srgb,var(--color-paper-50)_76%,transparent)]',
          ]}
          href={item.href}
          aria-current={item.state === 'current' ? 'step' : undefined}
          aria-disabled={item.state === 'locked' ? 'true' : undefined}
          onclick={(event) => item.state === 'locked' && event.preventDefault()}
        >
          <span
            class={[
              'grid size-8 place-items-center rounded-full border font-mono text-[0.68rem] font-[850]',
              item.state === 'current'
                ? 'border-ink-950 bg-acid-500 shadow-[2px_2px_0_var(--color-ink-950)]'
                : 'border-[color-mix(in_srgb,var(--color-ink-950)_26%,transparent)]',
              item.state === 'completed' ? 'bg-mint-50 text-mint-700' : '',
              item.state !== 'current' && item.state !== 'completed' ? 'bg-paper-50' : '',
            ]}
          >
            {#if item.state === 'completed'}
              <Check size={15} strokeWidth={3} />
            {:else if item.state === 'locked'}
              <LockKeyhole size={14} />
            {:else}
              {String(item.number).padStart(2, '0')}
            {/if}
          </span>
          <span class="grid min-w-0">
            <small class="font-mono text-[0.63rem] font-[720] text-ink-800">{item.level}</small>
            <strong class="mt-[0.08rem] truncate text-[0.78rem] leading-[1.2]">{item.title}</strong>
          </span>
          <span
            class="col-start-2 h-[0.2rem] overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-ink-950)_10%,transparent)]"
            role="progressbar"
            aria-label={t($motherTongue, 'home.chapterProgress', { title: item.title })}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={item.percent}
          >
            <i
              class="block h-full w-full origin-left bg-cobalt-700"
              style:transform={`scaleX(${item.percent / 100})`}
            ></i>
          </span>
        </a>
      </li>
    {/each}
  </ol>

  <a
    class="flex min-h-11 items-center justify-between gap-2 text-[0.75rem] font-extrabold text-cobalt-700 no-underline active:[transform:scale(0.97)] max-[1280px]:mt-[0.3rem] max-[1280px]:ml-auto max-[1280px]:min-h-[2.35rem] max-[1280px]:w-fit max-[1280px]:p-1 min-[1280px]:mt-[0.45rem] min-[1280px]:border-t min-[1280px]:border-[color-mix(in_srgb,var(--color-ink-950)_14%,transparent)] min-[1280px]:px-[0.35rem] min-[1280px]:pt-[0.65rem] min-[1280px]:pb-0 fine-hover:text-ink-950"
    href="/course/">{t($motherTongue, 'home.fullSyllabus')} <ArrowRight size={15} /></a
  >
</nav>
