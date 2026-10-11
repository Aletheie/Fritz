<script lang="ts">
  import { localized } from '$lib/i18n';
  import { storyAudience, storyAuthor, storyDescription, storyGenre } from '$lib/i18n/stories.ts';
  import { motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Check from '@lucide/svelte/icons/check';
  import Heart from '@lucide/svelte/icons/heart';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import Sparkles from '@lucide/svelte/icons/sparkles';

  import { bookAccents } from './book-accents.ts';

  import type { StoryBookSummary } from '$lib/domain/stories/types.ts';

  let {
    book,
    number,
    percent,
    completed,
    unlocked,
    status,
    favorite,
    favoriteSaving,
    hidden,
    ontogglefavorite,
  }: {
    book: StoryBookSummary;
    number: number;
    percent: number;
    completed: boolean;
    unlocked: boolean;
    /** Locked reason or reading state shown above the title. */
    status: string;
    favorite: boolean;
    favoriteSaving: boolean;
    hidden: boolean;
    ontogglefavorite: () => void;
  } = $props();

  const copy = (cs: string, en: string) => localized($motherTongue, { cs, en });
</script>

<li class={['relative', hidden && 'hidden', bookAccents[book.accent]]} data-testid="book-row">
  <svelte:element
    this={unlocked ? 'a' : 'div'}
    class={[
      'relative grid min-h-[8.75rem] grid-cols-[1.5rem_3.65rem_minmax(0,1fr)_auto] items-center gap-[0.65rem] overflow-hidden rounded-[0.45rem_1.15rem_0.45rem_0.45rem] border border-ink-950 p-[0.8rem] shadow-[3px_3px_0_rgb(21_25_28/0.08)] [transition:transform_170ms_var(--ease-out-emil),box-shadow_170ms_var(--ease-out-emil)] motion-reduce:transition-none min-[700px]:grid-cols-[2rem_4rem_minmax(0,1fr)_9rem_3rem] min-[700px]:gap-4 min-[700px]:px-[1.1rem] min-[700px]:py-[0.9rem]',
      unlocked
        ? 'bg-[color-mix(in_srgb,var(--book-soft)_52%,var(--color-paper-50))] fine-hover:[transform:translateY(-2px)] fine-hover:shadow-[5px_6px_0_rgb(21_25_28/0.12)]'
        : 'border-dashed bg-[color-mix(in_srgb,var(--color-paper-50)_82%,var(--book-soft))]',
    ]}
    href={unlocked ? `/stories/${book.id}/` : undefined}
    aria-label={copy(
      `${book.title}, úroveň ${book.level}${unlocked ? '' : ', zamčeno'}`,
      `${book.title}, level ${book.level}${unlocked ? '' : ', locked'}`,
    )}
  >
    <span class="self-start pt-1 font-mono text-[0.58rem] font-extrabold text-ink-600"
      >{String(number).padStart(2, '0')}</span
    >
    <span
      class={[
        'flex h-[6.75rem] w-[3.65rem] flex-col items-center justify-between rounded-[0.45rem_0.9rem_0.9rem_0.45rem] border border-ink-950 bg-(--book-accent) px-1 py-[0.65rem] shadow-[inset_5px_0_rgb(255_255_255/0.2)]',
        !unlocked && 'saturate-[0.35]',
      ]}
      aria-hidden="true"
      ><i class="font-mono text-[0.68rem] font-black not-italic">{book.level}</i><BookOpen
        size={22}
      /></span
    >
    <span class="grid min-w-0 gap-[0.18rem]">
      <span
        class={[
          'flex items-center gap-[0.4rem] font-mono text-[0.69rem] font-extrabold tracking-[0.07em]',
          unlocked ? 'text-ink-600 uppercase' : 'text-cobalt-700',
        ]}
      >
        {#if !unlocked}
          <LockKeyhole size={14} />
          {copy('Zamčeno', 'Locked')} · {status}
        {:else}
          {#if completed}<Check size={14} />{/if}
          {status}
        {/if}
      </span>
      <strong
        class="mt-1 text-[1.02rem] leading-[1.1] font-black tracking-[-0.035em] min-[1100px]:text-[1.15rem]"
        >{book.title}</strong
      >
      <small class="text-[0.69rem] font-[650] text-ink-600"
        >{storyAuthor(book.author, $motherTongue)}</small
      >
      <span
        class="inline-flex w-fit items-center gap-[0.28rem] font-mono text-[0.62rem] font-extrabold text-cobalt-700"
        ><Sparkles size={12} />
        {storyGenre(book, $motherTongue)}{#if book.audience !== 'all-ages'}
          · {storyAudience(book, $motherTongue)}{/if}</span
      >
      <span class="mt-[0.35rem] line-clamp-2 text-[0.72rem] leading-[1.4] text-ink-800"
        >{storyDescription(book, $motherTongue)}</span
      >
    </span>
    <span
      class="hidden font-mono text-[0.62rem] text-ink-600 min-[700px]:grid min-[700px]:gap-[0.35rem]"
    >
      <span>{book.episodeCount} × 5 min</span>
      <span>{copy(`${book.screenCount} stran`, `${book.screenCount} pages`)}</span>
      <span
        class="h-[0.35rem] w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--color-ink-950)_12%,transparent)]"
        role="progressbar"
        aria-label={copy(`Přečteno ${percent} procent`, `${percent} percent read`)}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={percent}
      >
        <i
          class="block h-full w-full origin-left rounded-[inherit] bg-cobalt-700"
          style:transform={`scaleX(${percent / 100})`}
        ></i>
      </span>
    </span>
    <span class="grid size-[2.6rem] place-items-center rounded-full bg-white/48">
      {#if unlocked}<ArrowRight size={21} />{:else}<LockKeyhole size={18} />{/if}
    </span>
  </svelte:element>
  <button
    class={[
      'absolute top-[0.7rem] right-[0.7rem] z-2 grid size-11 place-items-center rounded-full border [transition:color_150ms_var(--ease-out-emil),background-color_150ms_var(--ease-out-emil),transform_140ms_var(--ease-out-emil)] active:[transform:scale(0.94)] disabled:cursor-wait disabled:opacity-65 fine-hover:not-disabled:bg-coral-50 fine-hover:not-disabled:text-coral-700',
      favorite
        ? 'border-coral-700 bg-coral-50 text-coral-700'
        : 'border-[color-mix(in_srgb,var(--color-ink-950)_24%,transparent)] bg-white/88 text-ink-600',
    ]}
    type="button"
    aria-label={favorite
      ? copy(`Odebrat ${book.title} z oblíbených`, `Remove ${book.title} from favorites`)
      : copy(`Přidat ${book.title} do oblíbených`, `Add ${book.title} to favorites`)}
    aria-pressed={favorite}
    disabled={favoriteSaving}
    onclick={ontogglefavorite}
  >
    <Heart size={17} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
  </button>
</li>
