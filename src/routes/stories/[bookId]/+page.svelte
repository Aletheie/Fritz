<script lang="ts">
  import { page } from '$app/state';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { bookAccents } from '$lib/components/stories/book-accents.ts';
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

  const eyebrow =
    'm-0 font-mono text-[0.67rem] font-[850] tracking-[0.08em] text-ink-600 uppercase';
  const panel = 'rounded-[0.5rem_1.15rem_0.5rem_0.5rem] border border-ink-950';
  const missing = 'surface mx-auto my-16 max-w-lg p-6';
  const missingTitle = 'mt-[0.4rem] mb-4 text-[2rem] tracking-[-0.04em]';
  const sourceLink =
    'flex min-h-11 items-center justify-between rounded-[0.7rem] border border-line px-3 py-[0.65rem] text-[0.72rem] font-[780]';
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
  <section class={missing}>
    <p class="kicker">{copy('Knihu se nepodařilo načíst', 'The book could not be loaded')}</p>
    <h1 class={missingTitle}>{copy('Zkus knihu otevřít znovu.', 'Try opening the book again.')}</h1>
    <p>{bookLoadError}</p>
    <button class="btn-base btn-primary" type="button" onclick={() => void openBook(routeBookId)}>
      {copy('Zkusit znovu', 'Try again')}
    </button>
  </section>
{:else if !book}
  <section class={missing}>
    <p class="kicker">{copy('Kniha nenalezena', 'Book not found')}</p>
    <h1 class={missingTitle}>
      {copy('Tuhle knihu jsme nenašli.', 'We could not find this book.')}
    </h1>
    <a class="btn-base btn-primary" href="/stories/"
      ><ArrowLeft size={18} /> {copy('Zpět do čítárny', 'Back to the reading room')}</a
    >
  </section>
{:else if !unlocked}
  <section
    class="surface mx-auto mt-[8vh] max-w-[40rem] border-dashed p-6"
    aria-labelledby="locked-book-title"
  >
    <span
      class="grid size-14 place-items-center rounded-[0.7rem_1.2rem_0.7rem_0.7rem] border border-ink-950 bg-cobalt-100 shadow-[3px_3px_0_var(--color-ink-950)]"
      ><LockKeyhole size={28} /></span
    >
    <p class="kicker">{copy('Bonusová četba · zatím zamčeno', 'Bonus reading · locked for now')}</p>
    <h1 class={missingTitle} id="locked-book-title">
      {copy(
        `${book.title} se odemkne po testu kapitoly.`,
        `${book.title} unlocks after the chapter test.`,
      )}
    </h1>
    <p class="max-w-lg leading-[1.55] text-ink-600">{unlockReason()}</p>
    <div class="mt-5 flex flex-wrap gap-[0.65rem]">
      <a class="btn-base btn-primary" href="/"
        ><ArrowRight size={18} /> {copy('Pokračovat v cestě', 'Continue on the path')}</a
      >
      <a class="btn-base btn-secondary" href="/stories/"
        ><ArrowLeft size={18} /> {copy('Zpět do čítárny', 'Back to the reading room')}</a
      >
    </div>
  </section>
{:else}
  <div class={['mx-auto max-w-[78rem]', bookAccents[book.accent]]}>
    <a
      class="inline-flex min-h-11 items-center gap-[0.4rem] text-[0.75rem] font-[750] text-ink-600"
      href="/stories/"><ArrowLeft size={16} /> {copy('Všechny příběhy', 'All stories')}</a
    >

    <header
      class="grid gap-5 border-y border-ink-950 py-5 min-[640px]:grid-cols-[10rem_minmax(0,1fr)] min-[640px]:items-end min-[1000px]:grid-cols-[12rem_minmax(0,1fr)_18rem] min-[1000px]:gap-8 min-[1000px]:py-7"
    >
      <div
        class="flex aspect-[0.72] w-[min(12rem,42vw)] flex-col justify-between rounded-[0.45rem_1.1rem_1.1rem_0.45rem] border border-ink-950 bg-(--book-accent) p-4 shadow-[inset_8px_0_rgb(255_255_255/0.23),6px_6px_0_rgb(21_25_28/0.12)] min-[640px]:row-span-2 min-[640px]:w-40 min-[1000px]:row-auto min-[1000px]:w-48"
        aria-hidden="true"
      >
        <span class="font-mono text-[0.75rem] font-black">{book.level}</span>
        <BookOpenText class="self-center" size={38} strokeWidth={1.65} />
        <i class="font-(family-name:--font-reader) text-[0.7rem] font-bold not-italic"
          >{storyAuthor(book.author, $motherTongue)}</i
        >
      </div>
      <div>
        <p class={eyebrow}>{copy('Vedená četba', 'Guided reading')} · {book.level}</p>
        <h1
          class="mt-[0.55rem] max-w-[17ch] text-[clamp(2.1rem,8vw,4.8rem)] leading-[0.92] font-[920] tracking-[-0.04em]"
        >
          {book.title}
        </h1>
        <p class="mt-[0.6rem] font-(family-name:--font-reader) text-[0.94rem] text-ink-600 italic">
          {storyAuthor(book.author, $motherTongue)}
        </p>
        <p class="mt-4 max-w-[40rem] text-[1rem] leading-[1.55] text-ink-800">
          {storyDescription(book, $motherTongue)}
        </p>
        <div
          class="mt-4 flex flex-wrap gap-[0.45rem] [&>span]:inline-flex [&>span]:min-h-8 [&>span]:items-center [&>span]:gap-[0.3rem] [&>span]:rounded-full [&>span]:border [&>span]:border-line [&>span]:bg-paper-50 [&>span]:px-[0.62rem] [&>span]:py-[0.35rem] [&>span]:font-mono [&>span]:text-[0.62rem] [&>span]:font-extrabold"
        >
          <span><Sparkles size={15} /> {storyGenre(book, $motherTongue)}</span>
          {#if book.audience !== 'all-ages'}<span>{storyAudience(book, $motherTongue)}</span>{/if}
          <span><Clock3 size={15} /> {book.approximateMinutes} min</span>
          <span>{copy(`${book.episodeCount} epizod`, `${book.episodeCount} episodes`)}</span>
          <span>{copy(`${book.screenCount} obrazovek`, `${book.screenCount} screens`)}</span>
        </div>
        {#if resumeEpisode}
          <a
            class="mt-[1.1rem] flex min-h-12 items-center justify-center gap-2 rounded-[0.8rem] bg-ink-950 px-4 py-[0.8rem] text-[0.82rem] font-[850] text-white [&>svg:last-child]:ml-auto"
            href={`/stories/${book.id}/${resumeEpisode.id}/`}
          >
            <Play size={18} fill="currentColor" />
            {progress
              ? copy('Pokračovat', 'Continue')
              : copy('Otevřít první epizodu', 'Open the first episode')}
            <ArrowRight size={18} />
          </a>
        {/if}
      </div>

      <aside
        class="self-end rounded-[0.5rem_1.2rem_0.5rem_0.5rem] border border-ink-950 bg-paper-50 p-4 shadow-[4px_4px_0_rgb(21_25_28/0.09)] min-[640px]:col-start-2 min-[1000px]:col-auto"
        aria-label={copy(`Postup knihou ${percent} procent`, `${percent} percent through the book`)}
      >
        <div class="flex items-end justify-between">
          <span class="text-[0.72rem] font-[750] text-ink-600"
            >{copy('Tvůj postup', 'Your progress')}</span
          >
          <strong class="font-mono text-[1.35rem]">{percent}%</strong>
        </div>
        <div class="mt-[0.65rem] h-2 overflow-hidden rounded-full bg-paper-200">
          <i class="block h-full rounded-[inherit] bg-cobalt-700" style={`width: ${percent}%`}></i>
        </div>
        <dl
          class="mt-4 mb-0 grid grid-cols-3 [&_dd]:m-0 [&_dd]:font-mono [&_dd]:text-[0.72rem] [&_dd]:font-[850] [&_dt]:text-[0.62rem] [&_dt]:text-ink-600 [&>div]:grid [&>div]:gap-[0.15rem] [&>div]:border-l [&>div]:border-line [&>div]:pl-[0.65rem] [&>div:first-child]:border-l-0 [&>div:first-child]:pl-0"
        >
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

    <section
      class="grid gap-[1.8rem] pt-9 min-[1000px]:grid-cols-[minmax(0,1fr)_19rem] min-[1000px]:gap-8"
    >
      <section aria-labelledby="episodes-title">
        <header
          class="grid gap-[0.7rem] min-[640px]:grid-cols-[minmax(0,1fr)_20rem] min-[640px]:items-end"
        >
          <div>
            <p class={eyebrow}>{copy('Čtenářská cesta', 'Reading path')}</p>
            <h2
              class="mt-[0.4rem] max-w-[18ch] text-[clamp(1.7rem,6vw,2.8rem)] leading-none font-black tracking-[-0.04em]"
              id="episodes-title"
            >
              {copy('Kapitola po malých scénách.', 'A chapter in small scenes.')}
            </h2>
          </div>
          <p class="m-0 max-w-lg text-[0.78rem] leading-normal text-ink-600">
            {copy(
              'Každá epizoda má čtyři krátké části se dvěma cvičeními. Zopakuješ si slovíčka a ověříš, jak rozumíš ději.',
              'Each episode has four short parts and two exercises. You’ll review vocabulary and check your understanding of the story.',
            )}
          </p>
        </header>

        <ol
          class="relative mt-5 mb-0 grid list-none gap-[0.65rem] p-0 before:absolute before:inset-y-4 before:left-[1.52rem] before:border-l before:border-dashed before:border-line"
        >
          {#each book.episodes as episode}
            {@const complete = progress?.completedEpisodeIds.includes(episode.id)}
            {@const current = resumeEpisode?.id === episode.id && !complete}
            <li class="relative">
              <a
                class={[
                  'grid min-h-[6.25rem] grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[0.45rem_1rem_0.45rem_0.45rem] border p-3 min-[640px]:grid-cols-[3rem_minmax(0,1fr)_5rem_auto]',
                  current
                    ? 'border-ink-950 bg-(--book-soft) shadow-[3px_3px_0_rgb(21_25_28/0.1)]'
                    : 'border-[color-mix(in_srgb,var(--color-ink-950)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-paper-50)_94%,var(--book-soft))]',
                ]}
                href={`/stories/${book.id}/${episode.id}/`}
              >
                <span
                  class={[
                    'z-1 grid size-12 place-items-center rounded-[0.85rem] border border-ink-950 font-mono text-[0.69rem] font-black shadow-[2px_2px_0_rgb(21_25_28/0.12)]',
                    complete ? 'bg-mint-200' : 'bg-paper-50',
                  ]}
                >
                  {#if complete}<Check size={18} />{:else}{String(episode.number).padStart(
                      2,
                      '0',
                    )}{/if}
                </span>
                <span class="grid min-w-0 gap-[0.16rem]">
                  <small
                    class="font-mono text-[0.57rem] font-extrabold tracking-[0.06em] text-ink-600 uppercase"
                    >{complete
                      ? copy('Přečteno', 'Read')
                      : current
                        ? copy('Pokračuj tady', 'Continue here')
                        : copy(`Epizoda ${episode.number}`, `Episode ${episode.number}`)}</small
                  >
                  <strong class="text-[0.94rem] font-[880] tracking-[-0.025em]"
                    >{storyEpisodeTitle(episode, $motherTongue)}</strong
                  >
                  <span class="line-clamp-2 text-[0.7rem] leading-[1.4] text-ink-600"
                    >{storyEpisodeSummary(episode, $motherTongue)}</span
                  >
                </span>
                <span
                  class="hidden font-mono text-[0.62rem] text-ink-600 min-[640px]:flex min-[640px]:items-center min-[640px]:gap-[0.3rem]"
                  ><Clock3 size={14} /> {episode.minutes} min</span
                >
                <span class="grid size-10 place-items-center rounded-full bg-white/58"
                  ><ArrowRight size={19} /></span
                >
              </a>
            </li>
          {/each}
        </ol>
      </section>

      <aside class="grid content-start gap-[0.8rem]">
        <section class="{panel} flex gap-3 bg-paper-50 p-4">
          <span class="grid size-[2.6rem] flex-none place-items-center rounded-xl bg-acid-500"
            ><Sparkles size={19} /></span
          >
          <div>
            <h2 class="mt-[0.15rem] text-[1rem] font-[880]">
              {copy('Jak funguje čtení', 'How reading works')}
            </h2>
            <ul class="mt-[0.7rem] mb-0 list-disc pl-4 text-[0.72rem] leading-[1.55] text-ink-600">
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

        <section class="{panel} flex gap-[0.65rem] bg-coral-50 p-[0.9rem] text-coral-700">
          <AlertCircle class="flex-none" size={18} />
          <div>
            <strong class="text-[0.76rem]">{copy('Upozornění k obsahu', 'Content note')}</strong>
            <p class="mt-[0.22rem] mb-0 text-[0.7rem] leading-[1.45] text-ink-800">
              {storyContentNote(book, $motherTongue)}
            </p>
          </div>
        </section>

        <details class="{panel} group overflow-hidden bg-paper-50">
          <summary
            class="flex min-h-13 cursor-pointer list-none items-center justify-between px-[0.9rem] py-[0.8rem] [&::-webkit-details-marker]:hidden"
          >
            <span class="flex items-center gap-[0.45rem] text-[0.77rem] font-[820]"
              ><Quote size={17} />
              {book.source.adapted
                ? copy('Předloha a adaptace', 'Source and adaptation')
                : copy('Zdroj a vydání', 'Source and edition')}</span
            ><ChevronDown class="group-open:rotate-180" size={18} />
          </summary>
          <div
            class="grid gap-[0.65rem] border-t border-dashed border-line p-[0.9rem] [&>p]:m-0 [&>p]:text-[0.7rem] [&>p]:leading-normal [&>p]:text-ink-600"
          >
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
            <a class={sourceLink} href={book.source.ebookUrl} target="_blank" rel="noreferrer">
              {book.source.sourceLabel}
              <ExternalLink size={15} />
            </a>
            <a class={sourceLink} href={book.source.textUrl} target="_blank" rel="noreferrer">
              {book.source.adapted
                ? copy('Prostý text volné předlohy', 'Plain text of the public-domain source')
                : copy('Celý prostý text', 'Complete plain text')}
              <ExternalLink size={15} />
            </a>
            <a class={sourceLink} href={book.source.licenseUrl} target="_blank" rel="noreferrer">
              {copy('Podmínky zdroje', 'Source terms')}
              <ExternalLink size={15} />
            </a>
          </div>
        </details>
      </aside>
    </section>
  </div>
{/if}
