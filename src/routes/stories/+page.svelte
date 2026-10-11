<script lang="ts">
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { bookAccents } from '$lib/components/stories/book-accents.ts';
  import StoryBookRow from '$lib/components/stories/StoryBookRow.svelte';
  import { storyBookIsUnlocked, storyBookUnlockReason } from '$lib/domain/course/story-unlocks.ts';
  import { errorText } from '$lib/domain/errors.ts';
  import { storyBookSummaries as storyBooks } from '$lib/domain/stories/catalog.ts';
  import { storyBookPercent, storyEpisodeToResume } from '$lib/domain/stories/progress.ts';
  import {
    storyAuthor,
    storyAudience,
    storyDescription,
    storyEpisodeSummary,
    storyEpisodeTitle,
    storyGenre,
  } from '$lib/i18n/stories.ts';
  import { appStore, motherTongue, tr } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Heart from '@lucide/svelte/icons/heart';
  import LibraryBig from '@lucide/svelte/icons/library-big';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import Play from '@lucide/svelte/icons/play';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import { onMount } from 'svelte';

  import type { StoryBookSummary } from '$lib/domain/stories/types.ts';
  import type { CefrLevel } from '$lib/domain/types.ts';

  const storyShelves: Array<{
    level: CefrLevel;
    titleCs: string;
    titleEn: string;
    descriptionCs: string;
    descriptionEn: string;
  }> = [
    {
      level: 'A1',
      titleCs: 'První souvislé příběhy',
      titleEn: 'Your first complete stories',
      descriptionCs: 'Krátké věty a jednoduchý děj. Důležitá slova se často opakují.',
      descriptionEn: 'Short sentences and a simple plot. Important words appear often.',
    },
    {
      level: 'A2',
      titleCs: 'Rytmus a vyprávění',
      titleEn: 'Rhythm and storytelling',
      descriptionCs: 'Delší scény a vyprávění v minulém čase. Děj je stále snadné sledovat.',
      descriptionEn:
        'Longer scenes and stories in the past tense. The plot is still easy to follow.',
    },
    {
      level: 'B1',
      titleCs: 'Postavy v delším oblouku',
      titleEn: 'Characters across a longer arc',
      descriptionCs: 'Souvislé kapitoly, motivace postav a slovní zásoba pro samostatné čtení.',
      descriptionEn:
        'Connected chapters, character motivation, and vocabulary for independent reading.',
    },
    {
      level: 'B2',
      titleCs: 'Atmosféra a perspektiva',
      titleEn: 'Atmosphere and perspective',
      descriptionCs: 'Složitější vypravěč, dobový styl a význam, který není vždy vyslovený přímo.',
      descriptionEn:
        'A more complex narrator, period style, and meaning that is not always stated directly.',
    },
    {
      level: 'C1',
      titleCs: 'Literární přesnost',
      titleEn: 'Literary precision',
      descriptionCs: 'Složitější souvětí a významy, které se odhalí při pozorném čtení.',
      descriptionEn: 'Complex sentences and meanings that take a closer reading to understand.',
    },
  ];
  let showAllShelves = $state(false);
  let showFavorites = $state(false);
  let favoriteSaving = $state(false);
  let favoriteError = $state('');

  function unlockReason(book: StoryBookSummary): string {
    return $motherTongue === 'cs'
      ? storyBookUnlockReason(book.id)
      : 'Finish the previous chapter test to unlock this book.';
  }

  onMount(() => void appStore.initialize());

  const unlockedBooks = $derived(
    storyBooks.filter((book) => storyBookIsUnlocked($appStore.course, book.id)),
  );
  const favoriteBookIds = $derived(new Set($appStore.settings?.favoriteStoryBookIds ?? []));
  const startedBooks = $derived(storyBooks.filter((book) => $appStore.course.storyBooks[book.id]));
  const completedEpisodes = $derived(
    storyBooks.reduce(
      (sum, book) => sum + ($appStore.course.storyBooks[book.id]?.completedEpisodeIds.length ?? 0),
      0,
    ),
  );
  const profileLevel = $derived(($appStore.settings?.grammarLevel ?? 'A1.1').slice(0, 2));
  const recentBook = $derived(
    startedBooks.toSorted((left, right) =>
      ($appStore.course.storyBooks[right.id]?.updatedAt ?? '').localeCompare(
        $appStore.course.storyBooks[left.id]?.updatedAt ?? '',
      ),
    )[0],
  );
  let recommended = $derived(
    recentBook ??
      unlockedBooks.find((book) => book.level === profileLevel) ??
      storyBooks.find((book) => book.level === profileLevel) ??
      storyBooks[0],
  );
  const recommendedUnlocked = $derived(storyBookIsUnlocked($appStore.course, recommended.id));
  const recommendedEpisode = $derived(
    storyEpisodeToResume(recommended.episodes, $appStore.course.storyBooks[recommended.id]),
  );

  function stateLabel(book: StoryBookSummary): string {
    const progress = $appStore.course.storyBooks[book.id];
    if (!progress) return $tr('Nová kniha', 'New book');
    if (progress.completedEpisodeIds.length === book.episodeCount) {
      return $tr('Přečtený výběr', 'Selection completed');
    }
    return $tr(
      `${progress.completedEpisodeIds.length}/${book.episodeCount} epizod`,
      `${progress.completedEpisodeIds.length}/${book.episodeCount} episodes`,
    );
  }

  function booksForLevel(level: CefrLevel): StoryBookSummary[] {
    return storyBooks.filter((book) => book.level === level);
  }

  function bookCountLabel(count: number): string {
    if ($motherTongue === 'en') return `${count} books`;
    return count === 1 ? '1 kniha' : count >= 2 && count <= 4 ? `${count} knihy` : `${count} knih`;
  }

  async function toggleFavorite(bookId: StoryBookSummary['id']): Promise<void> {
    if (!$appStore.settings || favoriteSaving) return;
    favoriteSaving = true;
    favoriteError = '';
    const current = $appStore.settings.favoriteStoryBookIds;
    const next = current.includes(bookId)
      ? current.filter((id) => id !== bookId)
      : [...current, bookId];
    try {
      await appStore.updateSettings({ favoriteStoryBookIds: next });
    } catch (error) {
      favoriteError = errorText(error, $motherTongue, {
        cs: 'Oblíbené se nepodařilo uložit.',
        en: 'Could not save favorites.',
      });
    } finally {
      favoriteSaving = false;
    }
  }

  const label =
    'flex items-center gap-[0.4rem] font-mono text-[0.69rem] font-extrabold tracking-[0.07em] text-ink-600 uppercase';
  const continueButton =
    'col-span-full inline-flex min-h-[2.85rem] items-center justify-center gap-[0.45rem] rounded-xl px-4 py-3 text-[0.8rem] font-[850] fine-hover:[transform:translateY(-1px)] min-[700px]:col-auto min-[700px]:min-w-36';
</script>

<svelte:head>
  <title>{$tr('Příběhy v němčině A1–C1 · Fritz', 'German stories A1–C1 · Fritz')}</title>
  <meta
    name="description"
    content={$tr(
      'Krátké vedené čtení německých knih od A1 po C1 s interaktivními úlohami, překlady slov a uložením do opakování.',
      'Short guided readings of German books from A1 to C1 with interactive exercises, word meanings, and spaced review.',
    )}
  />
</svelte:head>

{#if !$appStore.ready}
  <LoadingState label={$tr('Otevírám čítárnu…', 'Opening the reading room…')} />
{:else}
  <div class="mx-auto max-w-[78rem]">
    <header
      class="grid gap-5 border-b border-ink-950 px-[0.15rem] pt-[1.15rem] pb-6 min-[700px]:grid-cols-[minmax(0,1fr)_18rem] min-[700px]:items-end min-[700px]:pt-7 min-[700px]:pb-8 min-[1100px]:grid-cols-[minmax(0,1fr)_21rem]"
    >
      <div>
        <p class={label}>
          <LibraryBig size={16} />
          {$tr('Čítárna', 'Reading room')} · A1–C1
        </p>
        <h1
          class="mt-[0.7rem] max-w-[15ch] text-[clamp(2.5rem,9vw,5.4rem)] leading-[0.88] font-[920] tracking-[-0.04em]"
        >
          {$tr('Přečti si něco německy', 'Read something in German')}
        </h1>
        <p class="mt-4 max-w-[43rem] text-[clamp(1rem,2vw,1.15rem)] leading-[1.55] text-ink-800">
          {$tr(
            'Vyber si příběh a čti po krátkých částech. Klepnutím na neznámé slovo zjistíš význam. Mezi scénami si procvičíš slovíčka a porozumění.',
            'Choose a story and read in short sections. Tap an unfamiliar word for its meaning. Between scenes, practise vocabulary and check your understanding.',
          )}
        </p>
        <dl
          class="mt-5 mb-0 flex flex-wrap gap-x-[1.6rem] gap-y-3 [&_dd]:m-0 [&_dd]:font-mono [&_dd]:text-[0.82rem] [&_dd]:font-black [&_dt]:text-[0.75rem] [&_dt]:font-bold [&_dt]:text-ink-600 [&>div]:flex [&>div]:items-baseline [&>div]:gap-[0.45rem]"
        >
          <div>
            <dt>{$tr('Knihy', 'Books')}</dt>
            <dd>{storyBooks.length}</dd>
          </div>
          <div>
            <dt>{$tr('Obrazovky', 'Screens')}</dt>
            <dd>{storyBooks.reduce((sum, book) => sum + book.screenCount, 0)}</dd>
          </div>
          <div>
            <dt>{$tr('Dokončeno', 'Completed')}</dt>
            <dd>{completedEpisodes} ep.</dd>
          </div>
        </dl>
      </div>

      <aside
        class="flex items-start gap-[0.9rem] rounded-[0.55rem_1.35rem_0.55rem_0.55rem] border border-ink-950 bg-paper-50 p-4 shadow-[4px_4px_0_rgb(21_25_28/0.1)]"
      >
        <span
          class="grid size-12 flex-none place-items-center rounded-full bg-acid-500 font-(family-name:--font-reader) font-extrabold"
          >Aa</span
        >
        <div>
          <strong class="block text-[0.94rem]"
            >{$tr('Pár minut čtení', 'A few minutes of reading')}</strong
          >
          <p class="mt-[0.3rem] mb-0 text-[0.78rem] leading-normal text-ink-600">
            {$tr(
              'Po čtení si zopakuješ slovíčka, seřadíš události nebo napíšeš německy, co se stalo.',
              'After reading, review words, put events in order, or write what happened in German.',
            )}
          </p>
        </div>
      </aside>
    </header>

    <section
      class={[
        'mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-[0.85rem] rounded-[0.55rem_1.45rem_0.55rem_0.55rem] border border-ink-950 bg-(--book-soft) p-4 shadow-[5px_5px_0_var(--color-ink-950)] min-[700px]:grid-cols-[auto_minmax(0,1fr)_auto_auto] min-[700px]:items-center min-[700px]:px-5 min-[700px]:py-[1.15rem]',
        bookAccents[recommended.accent],
        !recommendedUnlocked && 'border-dashed',
      ]}
      aria-labelledby="continue-title"
    >
      <div class="grid size-12 place-items-center rounded-[0.9rem] bg-ink-950 text-white">
        {#if recommendedUnlocked}
          <Play size={21} fill="currentColor" />
        {:else}
          <LockKeyhole size={21} />
        {/if}
      </div>
      <div>
        <span class="{label} text-ink-800">
          {recommendedUnlocked
            ? startedBooks.length
              ? $tr('Pokračuj ve čtení', 'Continue reading')
              : $tr(`Odemčeno pro ${recommended.level}`, `Unlocked for ${recommended.level}`)
            : $tr('Bonus na dohled', 'A bonus is close')}
        </span>
        <h2
          class="mt-1 text-[clamp(1.25rem,4vw,1.75rem)] leading-[1.05] font-black tracking-[-0.04em]"
          id="continue-title"
        >
          {recommended.title}
        </h2>
        <p class="mt-[0.35rem] mb-0 text-[0.78rem] leading-[1.4] text-ink-800">
          {recommendedUnlocked
            ? `${storyEpisodeTitle(recommendedEpisode, $motherTongue)} · ${storyEpisodeSummary(
                recommendedEpisode,
                $motherTongue,
              )}`
            : unlockReason(recommended)}
        </p>
      </div>
      <div
        class="col-span-full flex flex-wrap gap-[0.45rem] min-[700px]:col-auto min-[700px]:flex-nowrap [&>span]:inline-flex [&>span]:min-h-[1.85rem] [&>span]:items-center [&>span]:gap-1 [&>span]:rounded-full [&>span]:border [&>span]:border-[color-mix(in_srgb,var(--color-ink-950)_20%,transparent)] [&>span]:bg-white/45 [&>span]:px-[0.58rem] [&>span]:py-[0.32rem] [&>span]:font-mono [&>span]:text-[0.63rem] [&>span]:font-extrabold"
      >
        <span>{recommended.level}</span>
        <span><Clock3 size={14} /> {recommendedEpisode.minutes} min</span>
        <span
          >{storyBookPercent($appStore.course.storyBooks[recommended.id], recommended.screenCount)} %</span
        >
      </div>
      {#if recommendedUnlocked}
        <a
          href={`/stories/${recommended.id}/${recommendedEpisode.id}/`}
          class="{continueButton} bg-ink-950 text-white"
        >
          {startedBooks.length ? $tr('Pokračovat', 'Continue') : $tr('Začít číst', 'Start reading')}
          <ArrowRight size={18} />
        </a>
      {:else}
        <a href="/" class="{continueButton} border border-ink-950 bg-paper-50 text-ink-950">
          {$tr('Pokračovat k testu kapitoly', 'Continue to the chapter test')}
          <ArrowRight size={18} />
        </a>
      {/if}
    </section>

    <section class="pt-10 pb-2" aria-labelledby="shelf-title">
      <header
        class="grid gap-[0.8rem] px-[0.15rem] min-[700px]:grid-cols-[minmax(0,1fr)_25rem] min-[700px]:items-end"
      >
        <div>
          <span class={label}>{$tr('Knihy od A1 do C1', 'Books from A1 to C1')}</span>
          <h2
            class="mt-[0.35rem] max-w-[19ch] text-[clamp(1.75rem,6vw,3.25rem)] leading-[0.98] font-black tracking-[-0.04em]"
            id="shelf-title"
          >
            {$tr('Co si chceš přečíst?', 'What would you like to read?')}
          </h2>
        </div>
        <p class="m-0 max-w-xl text-[0.82rem] leading-[1.55] text-ink-600">
          {$tr(
            'Na každé úrovni od A1 do C1 si můžeš vybrat z pěti knih. Každou doplňují slovíčka a otázky k příběhu.',
            'Choose from five books at each level from A1 to C1. Each includes vocabulary practice and questions about the story.',
          )}
        </p>
      </header>

      <div class="mt-4 flex">
        <button
          class={[
            'inline-flex min-h-11 items-center gap-[0.45rem] rounded-full border px-3 py-2 text-[0.75rem] font-[820]',
            showFavorites
              ? 'border-coral-700 bg-coral-50 text-coral-700'
              : 'border-line bg-paper-50 text-ink-800',
          ]}
          type="button"
          aria-pressed={showFavorites}
          onclick={() => {
            showFavorites = !showFavorites;
            if (showFavorites) showAllShelves = true;
          }}
        >
          <Heart size={16} fill={showFavorites ? 'currentColor' : 'none'} aria-hidden="true" />
          {$tr('Oblíbené', 'Favorites')}
          <span
            class="inline-grid h-[1.35rem] min-w-[1.35rem] place-items-center rounded-full bg-[rgb(21_25_28/0.08)] font-mono text-[0.65rem]"
            >{favoriteBookIds.size}</span
          >
        </button>
      </div>
      {#if favoriteError}<p
          class="mt-[0.6rem] text-[0.76rem] font-[750] text-coral-700"
          role="alert"
        >
          {favoriteError}
        </p>{/if}

      <button
        class="mt-4 hidden min-h-[2.85rem] w-full items-center justify-center gap-[0.45rem] rounded-[0.35rem] border border-line bg-paper-50 text-[0.75rem] font-extrabold text-cobalt-700 max-[700px]:flex"
        type="button"
        aria-expanded={showAllShelves}
        onclick={() => (showAllShelves = !showAllShelves)}
      >
        {showAllShelves
          ? $tr('Zobrazit jen doporučenou úroveň', 'Show only the recommended level')
          : $tr('Procházet všechny úrovně A1–C1', 'Browse every level from A1 to C1')}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
      <div class="mt-8 grid gap-8">
        {#each storyShelves as shelf (shelf.level)}
          {@const shelfBooks = booksForLevel(shelf.level)}
          <section
            class={[
              'min-w-0',
              showFavorites && !shelfBooks.some((book) => favoriteBookIds.has(book.id)) && 'hidden',
              !showAllShelves &&
                !showFavorites &&
                shelf.level !== profileLevel &&
                'max-[700px]:hidden',
            ]}
            aria-labelledby={`shelf-${shelf.level}`}
          >
            <header
              class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-dashed border-line px-[0.15rem] pb-3"
            >
              <span
                class="grid size-10 place-items-center rounded-xl border border-ink-950 bg-ink-950 font-mono text-[0.72rem] font-black text-white"
                >{shelf.level}</span
              >
              <div>
                <h3
                  class="m-0 text-[1rem] font-black tracking-[-0.025em]"
                  id={`shelf-${shelf.level}`}
                >
                  {$tr(shelf.titleCs, shelf.titleEn)}
                </h3>
                <p
                  class="mt-[0.2rem] mb-0 max-w-[44rem] text-[0.72rem] leading-[1.45] text-ink-600"
                >
                  {$tr(shelf.descriptionCs, shelf.descriptionEn)}
                </p>
              </div>
              <strong class="font-mono text-[0.62rem] whitespace-nowrap text-ink-600"
                >{bookCountLabel(shelfBooks.length)}</strong
              >
            </header>
            <ol class="mt-3 mb-0 grid list-none gap-[0.7rem] p-0">
              {#each shelfBooks as book (book.id)}
                {@const progress = $appStore.course.storyBooks[book.id]}
                {@const unlocked = storyBookIsUnlocked($appStore.course, book.id)}
                <StoryBookRow
                  {book}
                  number={storyBooks.indexOf(book) + 1}
                  percent={storyBookPercent(progress, book.screenCount)}
                  completed={progress?.completedEpisodeIds.length === book.episodeCount}
                  {unlocked}
                  status={unlocked ? stateLabel(book) : unlockReason(book)}
                  favorite={favoriteBookIds.has(book.id)}
                  {favoriteSaving}
                  hidden={showFavorites && !favoriteBookIds.has(book.id)}
                  ontogglefavorite={() => void toggleFavorite(book.id)}
                />
              {/each}
            </ol>
          </section>
        {/each}
        {#if showFavorites && favoriteBookIds.size === 0}
          <div
            class="grid min-h-56 place-items-center content-center gap-[0.55rem] text-center text-ink-600"
          >
            <Heart size={28} aria-hidden="true" />
            <strong>{$tr('Zatím nemáš oblíbenou knihu.', 'No favorite books yet.')}</strong>
            <p class="max-w-md text-[0.76rem] leading-[1.45]">
              {$tr(
                'Srdíčkem si připni příběhy, které chceš číst příště.',
                'Use the heart to pin stories you want to read next.',
              )}
            </p>
            <button
              class="min-h-11 text-[0.76rem] font-[820] text-cobalt-700"
              type="button"
              onclick={() => (showFavorites = false)}
            >
              {$tr('Procházet knihy', 'Browse books')}
            </button>
          </div>
        {/if}
      </div>
    </section>

    <footer
      class="mt-8 flex items-start gap-[0.65rem] border-t border-dashed border-line px-1 pt-5 text-ink-600"
    >
      <Sparkles class="flex-none text-cobalt-700" size={17} />
      <p class="m-0 text-[0.75rem] leading-normal">
        {$tr(
          'U každé knihy najdeš odkaz na původní text. U upravených verzí uvádíme také zdroj a licenci úpravy.',
          'Each book links to the original text. Adapted versions also list their source and the adaptation’s license.',
        )}
      </p>
    </footer>
  </div>
{/if}
