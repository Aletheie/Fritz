<script lang="ts">
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { storyBookIsUnlocked, storyBookUnlockReason } from '$lib/domain/course/story-unlocks.ts';
  import { storyBookSummaries as storyBooks } from '$lib/domain/stories/catalog.ts';
  import { storyBookPercent, storyEpisodeToResume } from '$lib/domain/stories/progress.ts';
  import { localized } from '$lib/i18n';
  import {
    storyAuthor,
    storyAudience,
    storyDescription,
    storyEpisodeSummary,
    storyEpisodeTitle,
    storyGenre,
  } from '$lib/i18n/stories.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Check from '@lucide/svelte/icons/check';
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
      descriptionCs:
        'Krátké věty, opakování a děj, který lze sledovat bez slovníku v každém řádku.',
      descriptionEn:
        'Short sentences, repetition, and a plot you can follow without checking every line.',
    },
    {
      level: 'A2',
      titleCs: 'Rytmus a vyprávění',
      titleEn: 'Rhythm and storytelling',
      descriptionCs: 'Delší scény, minulý čas a hravý jazyk se stále pevnou dějovou oporou.',
      descriptionEn:
        'Longer scenes, past tense, and playful language with a clear narrative thread.',
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
      descriptionCs: 'Hutná syntax, víceznačnost a texty, které odměňují pomalé pozorné čtení.',
      descriptionEn: 'Dense syntax, ambiguity, and texts that reward slow, attentive reading.',
    },
  ];
  let showAllShelves = false;
  let showFavorites = false;
  let favoriteSaving = false;
  let favoriteError = '';

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function unlockReason(book: StoryBookSummary): string {
    return $motherTongue === 'cs'
      ? storyBookUnlockReason(book.id)
      : 'Complete the previous course checkpoint to unlock this book.';
  }

  onMount(() => void appStore.initialize());

  $: unlockedBooks = storyBooks.filter((book) => storyBookIsUnlocked($appStore.course, book.id));
  $: favoriteBookIds = new Set($appStore.settings?.favoriteStoryBookIds ?? []);
  $: startedBooks = storyBooks.filter((book) => $appStore.course.storyBooks[book.id]);
  $: completedEpisodes = storyBooks.reduce(
    (sum, book) => sum + ($appStore.course.storyBooks[book.id]?.completedEpisodeIds.length ?? 0),
    0,
  );
  $: profileLevel = ($appStore.settings?.grammarLevel ?? 'A1.1').slice(0, 2);
  $: recentBook = startedBooks.toSorted((left, right) =>
    ($appStore.course.storyBooks[right.id]?.updatedAt ?? '').localeCompare(
      $appStore.course.storyBooks[left.id]?.updatedAt ?? '',
    ),
  )[0];
  $: recommended =
    recentBook ??
    unlockedBooks.find((book) => book.level === profileLevel) ??
    storyBooks.find((book) => book.level === profileLevel) ??
    storyBooks[0];
  $: recommendedUnlocked = storyBookIsUnlocked($appStore.course, recommended.id);
  $: recommendedEpisode = storyEpisodeToResume(
    recommended.episodes,
    $appStore.course.storyBooks[recommended.id],
  );

  function stateLabel(book: StoryBookSummary): string {
    const progress = $appStore.course.storyBooks[book.id];
    if (!progress) return copy('Nová kniha', 'New book');
    if (progress.completedEpisodeIds.length === book.episodeCount) {
      return copy('Přečtený výběr', 'Selection completed');
    }
    return copy(
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
      favoriteError =
        error instanceof Error
          ? error.message
          : copy('Oblíbené se nepodařilo uložit.', 'Could not save favorites.');
    } finally {
      favoriteSaving = false;
    }
  }
</script>

<svelte:head>
  <title>{copy('Příběhy v němčině A1–C1 · Fritz', 'German stories A1–C1 · Fritz')}</title>
  <meta
    name="description"
    content={copy(
      'Krátké vedené čtení německých knih od A1 po C1 s interaktivními úlohami, překlady slov a uložením do opakování.',
      'Short guided readings of German books from A1 to C1 with interactive exercises, word meanings, and spaced review.',
    )}
  />
</svelte:head>

{#if !$appStore.ready}
  <LoadingState label={copy('Otevírám čítárnu…', 'Opening the reading room…')} />
{:else}
  <div class="stories-page">
    <header class="stories-hero">
      <div class="hero-copy">
        <p class="section-label">
          <LibraryBig size={16} />
          {copy('Čítárna', 'Reading room')} · A1–C1
        </p>
        <h1>{copy('Němčina, která má další stránku.', 'German with another page waiting.')}</h1>
        <p class="hero-lead">
          {copy(
            'Klasické příběhy rozdělené do pětiminutových epizod. Čti po malých částech, dotkni se neznámého slova a mezi scénami si ověř, co zůstalo v hlavě.',
            'Classic stories split into five-minute episodes. Read in small sections, tap an unfamiliar word, and check what stayed with you between scenes.',
          )}
        </p>
        <dl class="hero-facts">
          <div>
            <dt>{copy('Knihy', 'Books')}</dt>
            <dd>{storyBooks.length}</dd>
          </div>
          <div>
            <dt>{copy('Obrazovky', 'Screens')}</dt>
            <dd>{storyBooks.reduce((sum, book) => sum + book.screenCount, 0)}</dd>
          </div>
          <div>
            <dt>{copy('Dokončeno', 'Completed')}</dt>
            <dd>{completedEpisodes} ep.</dd>
          </div>
        </dl>
      </div>

      <aside class="reading-note">
        <span class="note-mark">Aa</span>
        <div>
          <strong>{copy('Krátký úsek. Jeden rytmus.', 'A short passage. One rhythm.')}</strong>
          <p>
            {copy(
              'Po čtení nejdřív vybavíš tvar, pak srovnáš děj a pravidelně ho shrneš vlastní německou větou.',
              'After reading, retrieve a form, order the plot, and regularly retell it in your own German sentence.',
            )}
          </p>
        </div>
      </aside>
    </header>

    <section
      class={`continue-strip accent-${recommended.accent}`}
      class:locked={!recommendedUnlocked}
      aria-labelledby="continue-title"
    >
      <div class="continue-icon">
        {#if recommendedUnlocked}
          <Play size={21} fill="currentColor" />
        {:else}
          <LockKeyhole size={21} />
        {/if}
      </div>
      <div class="continue-copy">
        <span>
          {recommendedUnlocked
            ? startedBooks.length
              ? copy('Pokračuj ve čtení', 'Continue reading')
              : copy(`Odemčeno pro ${recommended.level}`, `Unlocked for ${recommended.level}`)
            : copy('Bonus na dohled', 'A bonus is close')}
        </span>
        <h2 id="continue-title">{recommended.title}</h2>
        <p>
          {recommendedUnlocked
            ? `${storyEpisodeTitle(recommendedEpisode, $motherTongue)} · ${storyEpisodeSummary(
                recommendedEpisode,
                $motherTongue,
              )}`
            : unlockReason(recommended)}
        </p>
      </div>
      <div class="continue-meta">
        <span>{recommended.level}</span>
        <span><Clock3 size={14} /> {recommendedEpisode.minutes} min</span>
        <span
          >{storyBookPercent($appStore.course.storyBooks[recommended.id], recommended.screenCount)} %</span
        >
      </div>
      {#if recommendedUnlocked}
        <a href={`/stories/${recommended.id}/${recommendedEpisode.id}/`} class="continue-button">
          {startedBooks.length
            ? copy('Pokračovat', 'Continue')
            : copy('Začít číst', 'Start reading')}
          <ArrowRight size={18} />
        </a>
      {:else}
        <a href="/" class="continue-button secondary">
          {copy('Pokračovat ke checkpointu', 'Continue to the checkpoint')}
          <ArrowRight size={18} />
        </a>
      {/if}
    </section>

    <section class="shelf" aria-labelledby="shelf-title">
      <header class="shelf-heading">
        <div>
          <span>{copy('Pět různých cest pro každou úroveň', 'Five paths at every level')}</span>
          <h2 id="shelf-title">{copy('Vyber si náladu i tempo.', 'Choose your mood and pace.')}</h2>
        </div>
        <p>
          {copy(
            'Každá úroveň A1–C1 má pět titulů. Nové známé příběhy pro young adult a new adult doplňují aktivní vybavení, dějovou posloupnost a vlastní produkci.',
            'Every level from A1 to C1 has five titles. Familiar young-adult and new-adult stories add active recall, plot sequencing, and original production.',
          )}
        </p>
      </header>

      <div class="shelf-controls">
        <button
          class:active={showFavorites}
          type="button"
          aria-pressed={showFavorites}
          onclick={() => {
            showFavorites = !showFavorites;
            if (showFavorites) showAllShelves = true;
          }}
        >
          <Heart size={16} fill={showFavorites ? 'currentColor' : 'none'} aria-hidden="true" />
          {copy('Oblíbené', 'Favorites')}
          <span>{favoriteBookIds.size}</span>
        </button>
      </div>
      {#if favoriteError}<p class="favorite-error" role="alert">{favoriteError}</p>{/if}

      <button
        class="mobile-shelf-toggle"
        type="button"
        aria-expanded={showAllShelves}
        onclick={() => (showAllShelves = !showAllShelves)}
      >
        {showAllShelves
          ? copy('Zobrazit jen doporučenou úroveň', 'Show only the recommended level')
          : copy('Procházet všechny úrovně A1–C1', 'Browse every level from A1 to C1')}
        <ArrowRight size={17} aria-hidden="true" />
      </button>
      <div
        class:show-all-shelves={showAllShelves || showFavorites}
        class:show-favorites={showFavorites}
        class="level-shelves"
      >
        {#each storyShelves as shelf}
          {@const shelfBooks = booksForLevel(shelf.level)}
          <section
            class:current-shelf={shelf.level === profileLevel}
            class:empty-favorite-shelf={showFavorites &&
              !shelfBooks.some((book) => favoriteBookIds.has(book.id))}
            class="level-shelf"
            aria-labelledby={`shelf-${shelf.level}`}
          >
            <header class="level-heading">
              <span>{shelf.level}</span>
              <div>
                <h3 id={`shelf-${shelf.level}`}>{copy(shelf.titleCs, shelf.titleEn)}</h3>
                <p>{copy(shelf.descriptionCs, shelf.descriptionEn)}</p>
              </div>
              <strong>{bookCountLabel(shelfBooks.length)}</strong>
            </header>
            <ol class="book-sequence">
              {#each shelfBooks as book}
                {@const progress = $appStore.course.storyBooks[book.id]}
                {@const percent = storyBookPercent(progress, book.screenCount)}
                {@const unlocked = storyBookIsUnlocked($appStore.course, book.id)}
                <li
                  class:hidden-favorite={showFavorites && !favoriteBookIds.has(book.id)}
                  class={`book-row accent-${book.accent}`}
                  class:locked={!unlocked}
                >
                  <svelte:element
                    this={unlocked ? 'a' : 'div'}
                    class="book-card"
                    href={unlocked ? `/stories/${book.id}/` : undefined}
                    aria-label={copy(
                      `${book.title}, úroveň ${book.level}${unlocked ? '' : ', zamčeno'}`,
                      `${book.title}, level ${book.level}${unlocked ? '' : ', locked'}`,
                    )}
                  >
                    <span class="sequence-number"
                      >{String(storyBooks.indexOf(book) + 1).padStart(2, '0')}</span
                    >
                    <span class="book-spine" aria-hidden="true"
                      ><i>{book.level}</i><BookOpen size={22} /></span
                    >
                    <span class="book-copy">
                      <span class="book-state">
                        {#if !unlocked}
                          <LockKeyhole size={14} />
                          {copy('Zamčeno', 'Locked')} · {unlockReason(book)}
                        {:else}
                          {#if progress?.completedEpisodeIds.length === book.episodeCount}<Check
                              size={14}
                            />{/if}
                          {stateLabel(book)}
                        {/if}
                      </span>
                      <strong>{book.title}</strong>
                      <small>{storyAuthor(book.author, $motherTongue)}</small>
                      <span class="book-genre"
                        ><Sparkles size={12} />
                        {storyGenre(book, $motherTongue)}{#if book.audience !== 'all-ages'}
                          · {storyAudience(book, $motherTongue)}{/if}</span
                      >
                      <span class="description">{storyDescription(book, $motherTongue)}</span>
                    </span>
                    <span class="book-stats">
                      <span>{book.episodeCount} × 5 min</span>
                      <span>{copy(`${book.screenCount} stran`, `${book.screenCount} pages`)}</span>
                      <span
                        class="progress-track"
                        role="progressbar"
                        aria-label={copy(`Přečteno ${percent} procent`, `${percent} percent read`)}
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow={percent}
                      >
                        <i style={`--book-progress:${percent / 100}`}></i>
                      </span>
                    </span>
                    <span class="book-arrow">
                      {#if unlocked}<ArrowRight size={21} />{:else}<LockKeyhole size={18} />{/if}
                    </span>
                  </svelte:element>
                  <button
                    class:active={favoriteBookIds.has(book.id)}
                    class="book-favorite"
                    type="button"
                    aria-label={favoriteBookIds.has(book.id)
                      ? copy(
                          `Odebrat ${book.title} z oblíbených`,
                          `Remove ${book.title} from favorites`,
                        )
                      : copy(
                          `Přidat ${book.title} do oblíbených`,
                          `Add ${book.title} to favorites`,
                        )}
                    aria-pressed={favoriteBookIds.has(book.id)}
                    disabled={favoriteSaving}
                    onclick={() => void toggleFavorite(book.id)}
                  >
                    <Heart
                      size={17}
                      fill={favoriteBookIds.has(book.id) ? 'currentColor' : 'none'}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              {/each}
            </ol>
          </section>
        {/each}
        {#if showFavorites && favoriteBookIds.size === 0}
          <div class="favorite-empty">
            <Heart size={28} aria-hidden="true" />
            <strong>{copy('Zatím nemáš oblíbenou knihu.', 'No favorite books yet.')}</strong>
            <p>
              {copy(
                'Srdíčkem si připni příběhy, které chceš číst příště.',
                'Use the heart to pin stories you want to read next.',
              )}
            </p>
            <button type="button" onclick={() => (showFavorites = false)}>
              {copy('Procházet knihy', 'Browse books')}
            </button>
          </div>
        {/if}
      </div>
    </section>

    <footer class="source-note">
      <Sparkles size={17} />
      <p>
        {copy(
          'Původní výběry odkazují na přesné vydání Project Gutenberg. Nové odstupňované adaptace odkazují na volnou předlohu a jasně uvádějí vlastní MIT licenci adaptace.',
          'Original selections link to their exact Project Gutenberg edition. New graded adaptations link to the public-domain source and clearly state the adaptation’s MIT license.',
        )}
      </p>
    </footer>
  </div>
{/if}

<style>
  .stories-page {
    max-width: 78rem;
    margin: 0 auto;
  }
  .stories-hero {
    display: grid;
    gap: 1.25rem;
    border-bottom: 1px solid var(--color-ink-950);
    padding: 1.15rem 0.15rem 1.5rem;
  }
  .section-label,
  .shelf-heading span,
  .continue-copy > span,
  .book-state {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.69rem;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .hero-copy h1 {
    max-width: 15ch;
    margin: 0.7rem 0 0;
    font-size: clamp(2.5rem, 9vw, 5.4rem);
    font-weight: 920;
    letter-spacing: -0.04em;
    line-height: 0.88;
  }
  .hero-lead {
    max-width: 43rem;
    margin: 1rem 0 0;
    color: var(--color-ink-800);
    font-size: clamp(1rem, 2vw, 1.15rem);
    line-height: 1.55;
  }
  .hero-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.6rem;
    margin: 1.25rem 0 0;
  }
  .hero-facts div {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
  }
  .hero-facts dt {
    color: var(--color-ink-600);
    font-size: 0.75rem;
    font-weight: 700;
  }
  .hero-facts dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.82rem;
    font-weight: 900;
  }
  .reading-note {
    display: flex;
    align-items: flex-start;
    gap: 0.9rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.55rem 1.35rem 0.55rem 0.55rem;
    background: var(--color-paper-50);
    padding: 1rem;
    box-shadow: 4px 4px 0 rgb(21 25 28 / 0.1);
  }
  .note-mark {
    display: grid;
    width: 3rem;
    height: 3rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 999px;
    background: var(--color-acid-500);
    font-family: 'Literata Variable', Georgia, serif;
    font-weight: 800;
  }
  .reading-note strong {
    display: block;
    font-size: 0.94rem;
  }
  .reading-note p {
    margin: 0.3rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.78rem;
    line-height: 1.5;
  }
  .continue-strip {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.85rem;
    margin-top: 1.25rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.55rem 1.45rem 0.55rem 0.55rem;
    background: var(--book-soft);
    padding: 1rem;
    box-shadow: 5px 5px 0 var(--color-ink-950);
  }
  .continue-icon {
    display: grid;
    width: 3rem;
    height: 3rem;
    place-items: center;
    border-radius: 0.9rem;
    color: white;
    background: var(--color-ink-950);
  }
  .continue-copy h2 {
    margin: 0.25rem 0 0;
    font-size: clamp(1.25rem, 4vw, 1.75rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1.05;
  }
  .continue-copy > span {
    color: var(--color-ink-800);
  }
  .continue-copy p {
    margin: 0.35rem 0 0;
    color: var(--color-ink-800);
    font-size: 0.78rem;
    line-height: 1.4;
  }
  .continue-meta {
    grid-column: 1 / -1;
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
  }
  .continue-meta span {
    display: inline-flex;
    min-height: 1.85rem;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 20%, transparent);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.45);
    padding: 0.32rem 0.58rem;
    font-family: var(--font-mono);
    font-size: 0.63rem;
    font-weight: 800;
  }
  .continue-button {
    grid-column: 1 / -1;
    display: inline-flex;
    min-height: 2.85rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border-radius: 0.75rem;
    color: white;
    background: var(--color-ink-950);
    padding: 0.75rem 1rem;
    font-size: 0.8rem;
    font-weight: 850;
  }
  .continue-strip.locked {
    border-style: dashed;
  }
  .continue-button.secondary {
    border: 1px solid var(--color-ink-950);
    color: var(--color-ink-950);
    background: var(--color-paper-50);
  }
  .shelf {
    padding: 2.5rem 0 0.5rem;
  }
  .shelf-heading {
    display: grid;
    gap: 0.8rem;
    padding-inline: 0.15rem;
  }
  .shelf-heading h2 {
    max-width: 19ch;
    margin: 0.35rem 0 0;
    font-size: clamp(1.75rem, 6vw, 3.25rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 0.98;
  }
  .shelf-heading > p {
    max-width: 36rem;
    margin: 0;
    color: var(--color-ink-600);
    font-size: 0.82rem;
    line-height: 1.55;
  }
  .level-shelves {
    display: grid;
    gap: 2rem;
    margin-top: 2rem;
  }
  .shelf-controls {
    display: flex;
    margin-top: 1rem;
  }
  .shelf-controls button {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    color: var(--color-ink-800);
    background: var(--color-paper-50);
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 820;
  }
  .shelf-controls button.active {
    border-color: var(--color-coral-700);
    color: var(--color-coral-700);
    background: var(--color-coral-50);
  }
  .shelf-controls span {
    display: inline-grid;
    min-width: 1.35rem;
    height: 1.35rem;
    place-items: center;
    border-radius: 999px;
    background: rgb(21 25 28 / 0.08);
    font-family: var(--font-mono);
    font-size: 0.65rem;
  }
  .favorite-error {
    margin-top: 0.6rem;
    color: var(--color-coral-700);
    font-size: 0.76rem;
    font-weight: 750;
  }
  .mobile-shelf-toggle {
    display: none;
  }
  .level-shelf {
    min-width: 0;
  }
  .level-heading {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.75rem;
    border-bottom: 1px dashed var(--color-line);
    padding: 0 0.15rem 0.75rem;
  }
  .level-heading > span {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.75rem;
    background: var(--color-ink-950);
    color: white;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 900;
  }
  .level-heading h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 900;
    letter-spacing: -0.025em;
  }
  .level-heading p {
    max-width: 44rem;
    margin: 0.2rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.72rem;
    line-height: 1.45;
  }
  .level-heading strong {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    white-space: nowrap;
  }
  .book-sequence {
    display: grid;
    gap: 0.7rem;
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
  }
  .book-row {
    position: relative;
  }
  .book-row.hidden-favorite,
  .level-shelf.empty-favorite-shelf {
    display: none;
  }
  .book-row .book-card {
    position: relative;
    display: grid;
    min-height: 8.75rem;
    grid-template-columns: 1.5rem 3.65rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    overflow: hidden;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 1.15rem 0.45rem 0.45rem;
    background: color-mix(in srgb, var(--book-soft) 52%, var(--color-paper-50));
    padding: 0.8rem;
    box-shadow: 3px 3px 0 rgb(21 25 28 / 0.08);
    transition:
      transform 170ms var(--ease-out-emil),
      box-shadow 170ms var(--ease-out-emil);
  }
  .sequence-number {
    align-self: start;
    padding-top: 0.25rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 800;
  }
  .book-spine {
    display: flex;
    width: 3.65rem;
    height: 6.75rem;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 0.9rem 0.9rem 0.45rem;
    background: var(--book-accent);
    padding: 0.65rem 0.25rem;
    box-shadow: inset 5px 0 rgb(255 255 255 / 0.2);
  }
  .book-spine i {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-style: normal;
    font-weight: 900;
  }
  .book-copy {
    display: grid;
    min-width: 0;
    gap: 0.18rem;
  }
  .book-copy strong {
    margin-top: 0.25rem;
    font-size: 1.02rem;
    font-weight: 900;
    letter-spacing: -0.035em;
    line-height: 1.1;
  }
  .book-copy small {
    color: var(--color-ink-600);
    font-size: 0.69rem;
    font-weight: 650;
  }
  .book-genre {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    gap: 0.28rem;
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 800;
  }
  .description {
    display: -webkit-box;
    margin-top: 0.35rem;
    overflow: hidden;
    color: var(--color-ink-800);
    font-size: 0.72rem;
    line-height: 1.4;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .book-stats {
    display: none;
  }
  .book-arrow {
    display: grid;
    width: 2.6rem;
    height: 2.6rem;
    place-items: center;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.48);
  }
  .book-favorite {
    position: absolute;
    z-index: 2;
    top: 0.7rem;
    right: 0.7rem;
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 24%, transparent);
    border-radius: 999px;
    color: var(--color-ink-600);
    background: color-mix(in srgb, white 88%, transparent);
    transition:
      color 150ms var(--ease-out-emil),
      background-color 150ms var(--ease-out-emil),
      transform 140ms var(--ease-out-emil);
  }
  .book-favorite.active {
    border-color: var(--color-coral-700);
    color: var(--color-coral-700);
    background: var(--color-coral-50);
  }
  .book-favorite:active {
    transform: scale(0.94);
  }
  .book-favorite:disabled {
    cursor: wait;
    opacity: 0.65;
  }
  .favorite-empty {
    display: grid;
    min-height: 14rem;
    place-items: center;
    align-content: center;
    gap: 0.55rem;
    color: var(--color-ink-600);
    text-align: center;
  }
  .favorite-empty p {
    max-width: 28rem;
    font-size: 0.76rem;
    line-height: 1.45;
  }
  .favorite-empty button {
    min-height: 2.75rem;
    color: var(--color-cobalt-700);
    font-size: 0.76rem;
    font-weight: 820;
  }
  .book-row.locked .book-card {
    border-style: dashed;
    background: color-mix(in srgb, var(--color-paper-50) 82%, var(--book-soft));
  }
  .book-row.locked .book-spine {
    filter: saturate(0.35);
  }
  .book-row.locked .book-state {
    color: var(--color-cobalt-700);
    text-transform: none;
  }
  .source-note {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    margin-top: 2rem;
    border-top: 1px dashed var(--color-line);
    padding: 1.25rem 0.25rem 0;
    color: var(--color-ink-600);
  }
  .source-note :global(svg) {
    flex: 0 0 auto;
    color: var(--color-cobalt-700);
  }
  .source-note p {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.5;
  }
  .accent-butter {
    --book-accent: var(--color-butter-200);
    --book-soft: #fff4cf;
  }
  .accent-mint {
    --book-accent: var(--color-mint-200);
    --book-soft: var(--color-mint-50);
  }
  .accent-sky {
    --book-accent: var(--color-sky-200);
    --book-soft: var(--color-sky-50);
  }
  .accent-cobalt {
    --book-accent: var(--color-cobalt-300);
    --book-soft: #e6eaff;
  }
  .accent-coral {
    --book-accent: var(--color-coral-200);
    --book-soft: var(--color-coral-50);
  }

  @media (hover: hover) and (pointer: fine) {
    .book-row a.book-card:hover {
      transform: translateY(-2px);
      box-shadow: 5px 6px 0 rgb(21 25 28 / 0.12);
    }
    .continue-button:hover {
      transform: translateY(-1px);
    }
    .book-favorite:hover:not(:disabled) {
      color: var(--color-coral-700);
      background: var(--color-coral-50);
    }
  }
  @media (min-width: 700px) {
    .stories-hero {
      grid-template-columns: minmax(0, 1fr) 18rem;
      align-items: end;
      padding-block: 1.75rem 2rem;
    }
    .continue-strip {
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      align-items: center;
      padding: 1.15rem 1.25rem;
    }
    .continue-meta,
    .continue-button {
      grid-column: auto;
    }
    .continue-meta {
      flex-wrap: nowrap;
    }
    .continue-button {
      min-width: 9rem;
    }
    .shelf-heading {
      grid-template-columns: minmax(0, 1fr) 25rem;
      align-items: end;
    }
    .book-row .book-card {
      grid-template-columns: 2rem 4rem minmax(0, 1fr) 9rem 3rem;
      gap: 1rem;
      padding: 0.9rem 1.1rem;
    }
    .book-stats {
      display: grid;
      gap: 0.35rem;
      color: var(--color-ink-600);
      font-family: var(--font-mono);
      font-size: 0.62rem;
    }
    .progress-track {
      width: 100%;
      height: 0.35rem;
      overflow: hidden;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-ink-950) 12%, transparent);
    }
    .progress-track i {
      display: block;
      width: 100%;
      height: 100%;
      border-radius: inherit;
      background: var(--color-cobalt-700);
      transform: scaleX(var(--book-progress));
      transform-origin: left;
    }
  }
  @media (max-width: 699px) {
    .mobile-shelf-toggle {
      display: flex;
      width: 100%;
      min-height: 2.85rem;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      margin-top: 1rem;
      border: 1px solid var(--color-line);
      border-radius: 0.35rem;
      color: var(--color-cobalt-700);
      background: var(--color-paper-50);
      font-size: 0.75rem;
      font-weight: 800;
    }
    .level-shelves:not(.show-all-shelves) .level-shelf:not(.current-shelf) {
      display: none;
    }
  }
  @media (min-width: 1100px) {
    .stories-hero {
      grid-template-columns: minmax(0, 1fr) 21rem;
    }
    .book-copy strong {
      font-size: 1.15rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .book-row .book-card {
      transition: none;
    }
  }
</style>
