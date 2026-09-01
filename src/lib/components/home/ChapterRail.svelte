<script lang="ts">
  import { t } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';

  import type { HomeRailItem } from './home-view-model.ts';

  let { items }: { items: HomeRailItem[] } = $props();

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

<nav class="chapter-rail" aria-label={t($motherTongue, 'home.courseChapters')}>
  <header>
    <div>
      <span>{t($motherTongue, 'home.courseMap')}</span>
      <strong>{currentItem?.level ?? 'A1.1'}</strong>
    </div>
    <small>{currentItem?.number ?? 0}/{items.length}</small>
  </header>

  <ol>
    {#each visibleItems as item}
      <li class:current={item.state === 'current'} class:completed={item.state === 'completed'}>
        <a
          href={item.href}
          aria-current={item.state === 'current' ? 'step' : undefined}
          aria-disabled={item.state === 'locked' ? 'true' : undefined}
          onclick={(event) => item.state === 'locked' && event.preventDefault()}
        >
          <span class="rail-number">
            {#if item.state === 'completed'}
              <Check size={15} strokeWidth={3} />
            {:else if item.state === 'locked'}
              <LockKeyhole size={14} />
            {:else}
              {String(item.number).padStart(2, '0')}
            {/if}
          </span>
          <span class="rail-copy">
            <small>{item.level}</small>
            <strong>{item.title}</strong>
          </span>
          <span
            class="rail-progress"
            role="progressbar"
            aria-label={t($motherTongue, 'home.chapterProgress', { title: item.title })}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={item.percent}
          >
            <i style={`--rail-progress:${item.percent / 100}`}></i>
          </span>
        </a>
      </li>
    {/each}
  </ol>

  <a class="course-link" href="/course/"
    >{t($motherTongue, 'home.fullSyllabus')} <ArrowRight size={15} /></a
  >
</nav>

<style>
  .chapter-rail {
    min-width: 0;
  }
  header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
    padding: 0 0.25rem;
  }
  header div {
    display: grid;
    gap: 0.08rem;
  }
  header span,
  header small {
    color: var(--color-ink-800);
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 760;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  header strong {
    font-size: 0.9rem;
  }
  ol {
    display: grid;
    gap: 0.28rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  li > a {
    display: grid;
    grid-template-columns: 2.1rem minmax(0, 1fr);
    align-items: center;
    gap: 0.55rem;
    min-height: 3.45rem;
    border: 1px solid transparent;
    border-radius: 0.55rem 0.85rem 0.55rem 0.55rem;
    padding: 0.42rem 0.5rem;
    transition:
      background-color 160ms var(--ease-out-emil),
      border-color 160ms var(--ease-out-emil),
      transform 140ms var(--ease-out-emil);
  }
  li > a[aria-disabled='true'] {
    cursor: default;
    opacity: 0.5;
  }
  .rail-number {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 26%, transparent);
    border-radius: 50%;
    background: var(--color-paper-50);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 850;
  }
  .rail-copy {
    display: grid;
    min-width: 0;
  }
  .rail-copy small {
    color: var(--color-ink-800);
    font-family: var(--font-mono);
    font-size: 0.63rem;
    font-weight: 720;
  }
  .rail-copy strong {
    overflow: hidden;
    margin-top: 0.08rem;
    font-size: 0.78rem;
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rail-progress {
    grid-column: 2;
    height: 0.2rem;
    overflow: hidden;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-ink-950) 10%, transparent);
  }
  .rail-progress i {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--color-cobalt-700);
    transform: scaleX(var(--rail-progress));
    transform-origin: left;
  }
  li.current > a {
    border-color: var(--color-ink-950);
    background: var(--color-acid-100);
  }
  li.current .rail-number {
    border-color: var(--color-ink-950);
    background: var(--color-acid-500);
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  li.completed .rail-number {
    color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .course-link {
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: 0.45rem;
    border-top: 1px solid color-mix(in srgb, var(--color-ink-950) 14%, transparent);
    padding: 0.65rem 0.35rem 0;
    color: var(--color-cobalt-700);
    font-size: 0.75rem;
    font-weight: 800;
  }
  li > a:active:not([aria-disabled='true']),
  .course-link:active {
    transform: scale(0.97);
  }
  @media (hover: hover) and (pointer: fine) {
    li > a:hover:not([aria-disabled='true']):not([aria-current='step']) {
      background: color-mix(in srgb, var(--color-paper-50) 76%, transparent);
    }
    .course-link:hover {
      color: var(--color-ink-950);
    }
  }
  @media (max-width: 1279px) {
    .chapter-rail {
      overflow-x: auto;
      border-bottom: 1px solid color-mix(in srgb, var(--color-ink-950) 13%, transparent);
      padding-bottom: 0.55rem;
      scrollbar-width: thin;
    }
    header {
      margin-bottom: 0.4rem;
    }
    ol {
      display: flex;
      width: max-content;
      max-width: none;
      overflow: visible;
    }
    li {
      width: 12.5rem;
    }
    .course-link {
      width: fit-content;
      min-height: 2.35rem;
      margin-top: 0.3rem;
      margin-left: auto;
      border-top: 0;
      padding: 0.25rem;
    }
  }
  @media (min-width: 1280px) {
    .chapter-rail {
      position: sticky;
      top: 1.5rem;
      align-self: start;
    }
  }
</style>
