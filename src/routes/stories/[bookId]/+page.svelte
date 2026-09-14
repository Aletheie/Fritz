<script lang="ts">
  import { page } from '$app/state';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { storyBookIsUnlocked, storyBookUnlockReason } from '$lib/domain/course/story-unlocks.ts';
  import { loadStoryBook } from '$lib/domain/stories/catalog.ts';
  import {
    storyAccuracy,
    storyBookPercent,
    storyEpisodeToResume,
  } from '$lib/domain/stories/progress.ts';
  import { localized } from '$lib/i18n';
  import {
    storyAuthor,
    storyAudience,
    storyContentNote,
    storyDescription,
    storyEpisodeSummary,
    storyEpisodeTitle,
    storyGenre,
    storyLicenseNote,
  } from '$lib/i18n/stories.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import AlertCircle from '@lucide/svelte/icons/alert-circle';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import BookOpenText from '@lucide/svelte/icons/book-open-text';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import Play from '@lucide/svelte/icons/play';
  import Quote from '@lucide/svelte/icons/quote';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import { onMount } from 'svelte';

  import type { StoryBook } from '$lib/domain/stories/types.ts';

  let book: StoryBook | undefined;
  let requestedBookId = '';
  let bookLoading = true;
  let bookLoadError = '';

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function unlockReason(): string {
    if (!book) return '';
    return $motherTongue === 'cs'
      ? storyBookUnlockReason(book.id)
      : 'Finish the previous chapter test to unlock this book.';
  }

  $: routeBookId = page.params.bookId ?? '';
  $: if (routeBookId !== requestedBookId) void openBook(routeBookId);
  $: progress = book ? $appStore.course.storyBooks[book.id] : undefined;
  $: unlocked = book ? storyBookIsUnlocked($appStore.course, book.id) : false;
  $: percent = book ? storyBookPercent(progress, book.screenCount) : 0;
  $: accuracy = storyAccuracy(progress);
  $: resumeEpisode = book ? storyEpisodeToResume(book.episodes, progress) : undefined;

  async function openBook(bookId: string): Promise<void> {
    requestedBookId = bookId;
    book = undefined;
    bookLoading = true;
    bookLoadError = '';
    try {
      const loaded = await loadStoryBook(bookId);
      if (requestedBookId === bookId) book = loaded;
    } catch (error) {
      if (requestedBookId === bookId) {
        bookLoadError =
          error instanceof Error
            ? error.message
            : copy('Knihu se nepodařilo načíst.', 'The book could not be loaded.');
      }
    } finally {
      if (requestedBookId === bookId) bookLoading = false;
    }
  }

  onMount(() => void appStore.initialize());
</script>

<svelte:head>
  <title
    >{book
      ? `${book.title} · ${copy('Příběhy', 'Stories')}`
      : copy('Kniha nenalezena', 'Book not found')} · Fritz</title
  >
</svelte:head>

{#if !$appStore.ready || bookLoading}
  <LoadingState label={copy('Načítám knihu…', 'Opening the book…')} />
{:else if bookLoadError}
  <section class="missing surface">
    <p class="kicker">{copy('Knihu se nepodařilo načíst', 'The book could not be loaded')}</p>
    <h1>{copy('Zkus knihu otevřít znovu.', 'Try opening the book again.')}</h1>
    <p>{bookLoadError}</p>
    <button class="btn-base btn-primary" type="button" onclick={() => void openBook(routeBookId)}>
      {copy('Zkusit znovu', 'Try again')}
    </button>
  </section>
{:else if !book}
  <section class="missing surface">
    <p class="kicker">{copy('Kniha nenalezena', 'Book not found')}</p>
    <h1>{copy('Tuhle knihu jsme nenašli.', 'We could not find this book.')}</h1>
    <a class="btn-base btn-primary" href="/stories/"
      ><ArrowLeft size={18} /> {copy('Zpět do čítárny', 'Back to the reading room')}</a
    >
  </section>
{:else if !unlocked}
  <section class="missing surface locked-book" aria-labelledby="locked-book-title">
    <span class="locked-icon"><LockKeyhole size={28} /></span>
    <p class="kicker">{copy('Bonusová četba · zatím zamčeno', 'Bonus reading · locked for now')}</p>
    <h1 id="locked-book-title">
      {copy(
        `${book.title} se odemkne po testu kapitoly.`,
        `${book.title} unlocks after the chapter test.`,
      )}
    </h1>
    <p>{unlockReason()}</p>
    <div class="locked-actions">
      <a class="btn-base btn-primary" href="/"
        ><ArrowRight size={18} /> {copy('Pokračovat v cestě', 'Continue on the path')}</a
      >
      <a class="btn-base btn-secondary" href="/stories/"
        ><ArrowLeft size={18} /> {copy('Zpět do čítárny', 'Back to the reading room')}</a
      >
    </div>
  </section>
{:else}
  <div class={`book-page accent-${book.accent}`}>
    <a class="back-link" href="/stories/"
      ><ArrowLeft size={16} /> {copy('Všechny příběhy', 'All stories')}</a
    >

    <header class="book-hero">
      <div class="book-cover" aria-hidden="true">
        <span class="cover-level">{book.level}</span>
        <BookOpenText size={38} strokeWidth={1.65} />
        <i>{storyAuthor(book.author, $motherTongue)}</i>
      </div>
      <div class="book-intro">
        <p class="eyebrow">{copy('Vedená četba', 'Guided reading')} · {book.level}</p>
        <h1>{book.title}</h1>
        <p class="author">{storyAuthor(book.author, $motherTongue)}</p>
        <p class="description">{storyDescription(book, $motherTongue)}</p>
        <div class="book-facts">
          <span><Sparkles size={15} /> {storyGenre(book, $motherTongue)}</span>
          {#if book.audience !== 'all-ages'}<span>{storyAudience(book, $motherTongue)}</span>{/if}
          <span><Clock3 size={15} /> {book.approximateMinutes} min</span>
          <span>{copy(`${book.episodeCount} epizod`, `${book.episodeCount} episodes`)}</span>
          <span>{copy(`${book.screenCount} obrazovek`, `${book.screenCount} screens`)}</span>
        </div>
        {#if resumeEpisode}
          <a class="primary-read" href={`/stories/${book.id}/${resumeEpisode.id}/`}>
            <Play size={18} fill="currentColor" />
            {progress
              ? copy('Pokračovat', 'Continue')
              : copy('Otevřít první epizodu', 'Open the first episode')}
            <ArrowRight size={18} />
          </a>
        {/if}
      </div>

      <aside
        class="progress-panel"
        aria-label={copy(`Postup knihou ${percent} procent`, `${percent} percent through the book`)}
      >
        <div class="progress-top">
          <span>{copy('Tvůj postup', 'Your progress')}</span>
          <strong>{percent}%</strong>
        </div>
        <div class="progress-line"><i style={`width: ${percent}%`}></i></div>
        <dl>
          <div>
            <dt>{copy('Hotovo', 'Done')}</dt>
            <dd>{progress?.completedEpisodeIds.length ?? 0}/{book.episodeCount}</dd>
          </div>
          <div>
            <dt>{copy('Přesnost kontrol', 'Scored accuracy')}</dt>
            <dd>{accuracy === undefined ? '—' : `${accuracy}%`}</dd>
          </div>
          <div>
            <dt>{copy('Uloženo', 'Saved')}</dt>
            <dd>
              {copy(`${progress?.savedWords ?? 0} slov`, `${progress?.savedWords ?? 0} words`)}
            </dd>
          </div>
        </dl>
      </aside>
    </header>

    <section class="book-main">
      <section class="episodes" aria-labelledby="episodes-title">
        <header>
          <div>
            <p class="eyebrow">{copy('Čtenářská cesta', 'Reading path')}</p>
            <h2 id="episodes-title">
              {copy('Kapitola po malých scénách.', 'A chapter in small scenes.')}
            </h2>
          </div>
          <p>
            {copy(
              'Každá epizoda má čtyři krátké části se dvěma cvičeními. Zopakuješ si slovíčka a ověříš, jak rozumíš ději.',
              'Each episode has four short parts and two exercises. You’ll review vocabulary and check your understanding of the story.',
            )}
          </p>
        </header>

        <ol class="episode-list">
          {#each book.episodes as episode}
            {@const complete = progress?.completedEpisodeIds.includes(episode.id)}
            {@const current = resumeEpisode?.id === episode.id && !complete}
            <li class:complete class:current>
              <a href={`/stories/${book.id}/${episode.id}/`}>
                <span class="episode-number">
                  {#if complete}<Check size={18} />{:else}{String(episode.number).padStart(
                      2,
                      '0',
                    )}{/if}
                </span>
                <span class="episode-copy">
                  <small
                    >{complete
                      ? copy('Přečteno', 'Read')
                      : current
                        ? copy('Pokračuj tady', 'Continue here')
                        : copy(`Epizoda ${episode.number}`, `Episode ${episode.number}`)}</small
                  >
                  <strong>{storyEpisodeTitle(episode, $motherTongue)}</strong>
                  <span>{storyEpisodeSummary(episode, $motherTongue)}</span>
                </span>
                <span class="episode-time"><Clock3 size={14} /> {episode.minutes} min</span>
                <span class="episode-arrow"><ArrowRight size={19} /></span>
              </a>
            </li>
          {/each}
        </ol>
      </section>

      <aside class="book-notes">
        <section class="reader-tools">
          <span class="aside-icon"><Sparkles size={19} /></span>
          <div>
            <h2>{copy('Jak funguje čtení', 'How reading works')}</h2>
            <ul>
              <li>
                {copy(
                  'Podtržená těžší slova mají okamžitý český význam.',
                  'Underlined words reveal their English meaning instantly.',
                )}
              </li>
              <li>
                {copy(
                  'Libovolné slovo podrž nebo otevři přes nabídku.',
                  'Press and hold any word, or open it from the menu.',
                )}
              </li>
              <li>
                {copy(
                  'Označenou větu může AI přeložit i vysvětlit.',
                  'AI can translate and explain a selected sentence.',
                )}
              </li>
              <li>
                {copy(
                  'Tvoje věta zůstává jen v otevřeném cvičení. Do historie se neukládá.',
                  'Your sentence stays in the open exercise. It isn’t saved to history.',
                )}
              </li>
            </ul>
          </div>
        </section>

        <section class="content-note">
          <AlertCircle size={18} />
          <div>
            <strong>{copy('Upozornění k obsahu', 'Content note')}</strong>
            <p>{storyContentNote(book, $motherTongue)}</p>
          </div>
        </section>

        <details class="source-details">
          <summary>
            <span
              ><Quote size={17} />
              {book.source.adapted
                ? copy('Předloha a adaptace', 'Source and adaptation')
                : copy('Zdroj a vydání', 'Source and edition')}</span
            ><ChevronDown size={18} />
          </summary>
          <div class="source-body">
            <p>
              <strong>{copy('Zařazený úsek:', 'Included excerpt:')}</strong>
              {book.source.excerptLabel}
            </p>
            <p>{storyLicenseNote(book, $motherTongue)}</p>
            {#if book.source.translator}
              <p>
                <strong>{copy('Německý překlad:', 'German translation:')}</strong>
                {book.source.translator}
              </p>
            {/if}
            {#if book.modernizedByDefault}
              <p>
                {copy(
                  'Výchozí verze lehce modernizuje historický pravopis. V čtečce ji můžeš kdykoli přepnout na původní znění vybraného úseku.',
                  'The default version lightly modernises historical spelling. You can switch to the original wording in the reader at any time.',
                )}
              </p>
            {/if}
            <a href={book.source.ebookUrl} target="_blank" rel="noreferrer">
              {book.source.sourceLabel}
              <ExternalLink size={15} />
            </a>
            <a href={book.source.textUrl} target="_blank" rel="noreferrer">
              {book.source.adapted
                ? copy('Prostý text volné předlohy', 'Plain text of the public-domain source')
                : copy('Celý prostý text', 'Complete plain text')}
              <ExternalLink size={15} />
            </a>
            <a href={book.source.licenseUrl} target="_blank" rel="noreferrer">
              {copy('Podmínky zdroje', 'Source terms')}
              <ExternalLink size={15} />
            </a>
          </div>
        </details>
      </aside>
    </section>
  </div>
{/if}

<style>
  .book-page {
    max-width: 78rem;
    margin: 0 auto;
  }
  .back-link {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-ink-600);
    font-size: 0.75rem;
    font-weight: 750;
  }
  .book-hero {
    display: grid;
    gap: 1.25rem;
    border-block: 1px solid var(--color-ink-950);
    padding-block: 1.25rem;
  }
  .book-cover {
    display: flex;
    width: min(12rem, 42vw);
    aspect-ratio: 0.72;
    flex-direction: column;
    justify-content: space-between;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 1.1rem 1.1rem 0.45rem;
    background: var(--book-accent);
    padding: 1rem;
    box-shadow:
      inset 8px 0 rgb(255 255 255 / 0.23),
      6px 6px 0 rgb(21 25 28 / 0.12);
  }
  .cover-level {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 900;
  }
  .book-cover :global(svg) {
    align-self: center;
  }
  .book-cover i {
    font-family: var(--font-reader);
    font-size: 0.7rem;
    font-style: normal;
    font-weight: 700;
  }
  .eyebrow {
    margin: 0;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.67rem;
    font-weight: 850;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .book-intro h1 {
    max-width: 17ch;
    margin: 0.55rem 0 0;
    font-size: clamp(2.1rem, 8vw, 4.8rem);
    font-weight: 920;
    letter-spacing: -0.04em;
    line-height: 0.92;
  }
  .author {
    margin: 0.6rem 0 0;
    color: var(--color-ink-600);
    font-family: var(--font-reader);
    font-size: 0.94rem;
    font-style: italic;
  }
  .description {
    max-width: 40rem;
    margin: 1rem 0 0;
    color: var(--color-ink-800);
    font-size: 1rem;
    line-height: 1.55;
  }
  .book-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-top: 1rem;
  }
  .book-facts span {
    display: inline-flex;
    min-height: 2rem;
    align-items: center;
    gap: 0.3rem;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    background: var(--color-paper-50);
    padding: 0.35rem 0.62rem;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 800;
  }
  .primary-read {
    display: flex;
    min-height: 3rem;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1.1rem;
    border-radius: 0.8rem;
    color: white;
    background: var(--color-ink-950);
    padding: 0.8rem 1rem;
    font-size: 0.82rem;
    font-weight: 850;
  }
  .primary-read :global(svg:last-child) {
    margin-left: auto;
  }
  .progress-panel {
    align-self: end;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.5rem 1.2rem 0.5rem 0.5rem;
    background: var(--color-paper-50);
    padding: 1rem;
    box-shadow: 4px 4px 0 rgb(21 25 28 / 0.09);
  }
  .progress-top {
    display: flex;
    align-items: end;
    justify-content: space-between;
  }
  .progress-top span {
    color: var(--color-ink-600);
    font-size: 0.72rem;
    font-weight: 750;
  }
  .progress-top strong {
    font-family: var(--font-mono);
    font-size: 1.35rem;
  }
  .progress-line {
    height: 0.5rem;
    margin-top: 0.65rem;
    overflow: hidden;
    border-radius: 99px;
    background: var(--color-paper-200);
  }
  .progress-line i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--color-cobalt-700);
  }
  .progress-panel dl {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin: 1rem 0 0;
  }
  .progress-panel dl div {
    display: grid;
    gap: 0.15rem;
    border-left: 1px solid var(--color-line);
    padding-left: 0.65rem;
  }
  .progress-panel dl div:first-child {
    border-left: 0;
    padding-left: 0;
  }
  .progress-panel dt {
    color: var(--color-ink-600);
    font-size: 0.62rem;
  }
  .progress-panel dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 850;
  }
  .book-main {
    display: grid;
    gap: 1.8rem;
    padding-top: 2.25rem;
  }
  .episodes > header {
    display: grid;
    gap: 0.7rem;
  }
  .episodes h2 {
    max-width: 18ch;
    margin: 0.4rem 0 0;
    font-size: clamp(1.7rem, 6vw, 2.8rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .episodes > header > p {
    max-width: 32rem;
    margin: 0;
    color: var(--color-ink-600);
    font-size: 0.78rem;
    line-height: 1.5;
  }
  .episode-list {
    position: relative;
    display: grid;
    gap: 0.65rem;
    margin: 1.25rem 0 0;
    padding: 0;
    list-style: none;
  }
  .episode-list::before {
    position: absolute;
    top: 1rem;
    bottom: 1rem;
    left: 1.52rem;
    border-left: 1px dashed var(--color-line);
    content: '';
  }
  .episode-list li {
    position: relative;
  }
  .episode-list a {
    display: grid;
    min-height: 6.25rem;
    grid-template-columns: 3rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 24%, transparent);
    border-radius: 0.45rem 1rem 0.45rem 0.45rem;
    background: color-mix(in srgb, var(--color-paper-50) 94%, var(--book-soft));
    padding: 0.75rem;
  }
  .episode-list li.current a {
    border-color: var(--color-ink-950);
    background: var(--book-soft);
    box-shadow: 3px 3px 0 rgb(21 25 28 / 0.1);
  }
  .episode-number {
    z-index: 1;
    display: grid;
    width: 3rem;
    height: 3rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.85rem;
    background: var(--color-paper-50);
    font-family: var(--font-mono);
    font-size: 0.69rem;
    font-weight: 900;
    box-shadow: 2px 2px 0 rgb(21 25 28 / 0.12);
  }
  .complete .episode-number {
    background: var(--color-mint-200);
  }
  .episode-copy {
    display: grid;
    min-width: 0;
    gap: 0.16rem;
  }
  .episode-copy small {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.57rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .episode-copy strong {
    font-size: 0.94rem;
    font-weight: 880;
    letter-spacing: -0.025em;
  }
  .episode-copy > span {
    display: -webkit-box;
    overflow: hidden;
    color: var(--color-ink-600);
    font-size: 0.7rem;
    line-height: 1.4;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .episode-time {
    display: none;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.62rem;
  }
  .episode-arrow {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    place-items: center;
    border-radius: 99px;
    background: rgb(255 255 255 / 0.58);
  }
  .book-notes {
    display: grid;
    align-content: start;
    gap: 0.8rem;
  }
  .reader-tools,
  .content-note,
  .source-details {
    border: 1px solid var(--color-ink-950);
    border-radius: 0.5rem 1.15rem 0.5rem 0.5rem;
    background: var(--color-paper-50);
  }
  .reader-tools {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
  }
  .aside-icon {
    display: grid;
    width: 2.6rem;
    height: 2.6rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 0.75rem;
    background: var(--color-acid-500);
  }
  .reader-tools h2 {
    margin: 0.15rem 0 0;
    font-size: 1rem;
    font-weight: 880;
  }
  .reader-tools ul {
    margin: 0.7rem 0 0;
    padding-left: 1rem;
    color: var(--color-ink-600);
    font-size: 0.72rem;
    line-height: 1.55;
  }
  .content-note {
    display: flex;
    gap: 0.65rem;
    padding: 0.9rem;
    color: var(--color-coral-700);
    background: var(--color-coral-50);
  }
  .content-note :global(svg) {
    flex: 0 0 auto;
  }
  .content-note strong {
    font-size: 0.76rem;
  }
  .content-note p {
    margin: 0.22rem 0 0;
    color: var(--color-ink-800);
    font-size: 0.7rem;
    line-height: 1.45;
  }
  .source-details {
    overflow: hidden;
  }
  .source-details summary {
    display: flex;
    min-height: 3.25rem;
    align-items: center;
    justify-content: space-between;
    padding: 0.8rem 0.9rem;
    cursor: pointer;
    list-style: none;
  }
  .source-details summary::-webkit-details-marker {
    display: none;
  }
  .source-details summary span {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.77rem;
    font-weight: 820;
  }
  .source-details[open] summary > :global(svg) {
    transform: rotate(180deg);
  }
  .source-body {
    display: grid;
    gap: 0.65rem;
    border-top: 1px dashed var(--color-line);
    padding: 0.9rem;
  }
  .source-body p {
    margin: 0;
    color: var(--color-ink-600);
    font-size: 0.7rem;
    line-height: 1.5;
  }
  .source-body a {
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: space-between;
    border: 1px solid var(--color-line);
    border-radius: 0.7rem;
    padding: 0.65rem 0.75rem;
    font-size: 0.72rem;
    font-weight: 780;
  }
  .missing {
    max-width: 32rem;
    margin: 4rem auto;
    padding: 1.5rem;
  }
  .missing h1 {
    margin: 0.4rem 0 1rem;
    font-size: 2rem;
    letter-spacing: -0.04em;
  }
  .locked-book {
    max-width: 40rem;
    margin: 8vh auto 0;
    border-style: dashed;
  }
  .locked-book > p:not(.kicker) {
    max-width: 32rem;
    color: var(--color-ink-600);
    line-height: 1.55;
  }
  .locked-icon {
    display: grid;
    width: 3.5rem;
    height: 3.5rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.7rem 1.2rem 0.7rem 0.7rem;
    background: var(--color-cobalt-100);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .locked-actions {
    display: flex;
    gap: 0.65rem;
    flex-wrap: wrap;
    margin-top: 1.25rem;
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
  @media (min-width: 640px) {
    .book-hero {
      grid-template-columns: 10rem minmax(0, 1fr);
      align-items: end;
    }
    .book-cover {
      width: 10rem;
      grid-row: span 2;
    }
    .progress-panel {
      grid-column: 2;
    }
    .episodes > header {
      grid-template-columns: minmax(0, 1fr) 20rem;
      align-items: end;
    }
    .episode-list a {
      grid-template-columns: 3rem minmax(0, 1fr) 5rem auto;
    }
    .episode-time {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }
  }
  @media (min-width: 1000px) {
    .book-hero {
      grid-template-columns: 12rem minmax(0, 1fr) 18rem;
      gap: 2rem;
      padding-block: 1.75rem;
    }
    .book-cover {
      width: 12rem;
      grid-row: auto;
    }
    .progress-panel {
      grid-column: auto;
    }
    .book-main {
      grid-template-columns: minmax(0, 1fr) 19rem;
      gap: 2rem;
    }
  }
</style>
