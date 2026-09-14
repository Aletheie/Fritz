<script lang="ts">
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Brain from '@lucide/svelte/icons/brain';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Pause from '@lucide/svelte/icons/pause';
  import Play from '@lucide/svelte/icons/play';
  import Zap from '@lucide/svelte/icons/zap';

  import type { TrainingSourceFilter } from '$lib/domain/types.ts';

  type TagOption = {
    value: string;
    count: number;
  };

  type ResumeSummary = {
    remaining: number;
    total: number;
    selectedTag: string;
    sourceFilter: TrainingSourceFilter;
    updatedAt: string;
  };

  let {
    selectedTag = $bindable('all'),
    sourceFilter,
    sessionSize = $bindable(10),
    tags,
    dueCount,
    resume,
    onstart,
    onresume,
    onsourcechange,
  } = $props<{
    selectedTag: string;
    sourceFilter: TrainingSourceFilter;
    sessionSize: number;
    tags: TagOption[];
    dueCount: number;
    resume?: ResumeSummary;
    onstart: () => void;
    onresume: () => void;
    onsourcechange: (value: TrainingSourceFilter) => void;
  }>();

  const sizes = [5, 10, 20, 30];
  let plannedCount = $derived(Math.min(dueCount, sessionSize));
  let allTagCount = $derived(tags.find((tag: TagOption) => tag.value === 'all')?.count ?? 0);
  let visibleTags = $derived(tags.filter((tag: TagOption) => tag.value !== 'all'));

  function cardsLabel(count: number): string {
    if ($motherTongue === 'en') return `${count} ${count === 1 ? 'card' : 'cards'}`;
    if (count === 1) return '1 karta';
    if (count >= 2 && count <= 4) return `${count} karty`;
    return `${count} karet`;
  }

  function groupLabel(tag: string): string {
    if ($motherTongue === 'en') return tag === 'all' ? 'all groups' : `group “${tag}”`;
    return tag === 'all' ? 'všechny skupiny' : `skupina „${tag}“`;
  }

  function sourceLabel(value: TrainingSourceFilter): string {
    if (value === 'course') return copy('jen slova z kurzu', 'course words only');
    if (value === 'own') return copy('jen vlastní slova', 'your words only');
    if (value === 'without-course') return copy('bez slov z kurzu', 'without course words');
    return copy('všechna slova', 'all words');
  }

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }
</script>

<section class="setup-page mx-auto max-w-5xl pt-1 sm:pt-8">
  <a class="back-link" href="/"><ArrowLeft size={18} /> {copy('Zpět na dnešek', 'Back to today')}</a
  >

  <div class:has-resume={Boolean(resume)} class="setup-sheet">
    <div class="setup-main">
      <span class="setup-icon"><Brain size={25} /></span>
      <p class="kicker mt-5">{copy('Dlouhodobé studium', 'Long-term study')}</p>
      <h1>
        {copy('Kolik slovíček si chceš zopakovat?', 'How many words would you like to review?')}
      </h1>
      <p class="intro">
        {copy(
          'Vybereš si počet slovíček k opakování. Další během procvičování nepřibudou. Odpovědi se ukládají průběžně, takže můžeš kdykoli přestat.',
          'Choose how many words to review. No more will be added during practice. Answers save as you go, so you can stop at any time.',
        )}
      </p>

      <button
        class="recommended-start"
        type="button"
        disabled={plannedCount === 0}
        onclick={onstart}
      >
        <span class="recommended-icon"><Play size={20} fill="currentColor" /></span>
        <span>
          <small>{copy('doporučená dávka', 'recommended batch')}</small>
          <strong
            >{plannedCount > 0
              ? copy(
                  `Začít rovnou · ${cardsLabel(plannedCount)}`,
                  `Start now · ${cardsLabel(plannedCount)}`,
                )
              : copy('Dnešní opakování je hotové', 'Today’s review is complete')}</strong
          >
          <em
            >{plannedCount > 0
              ? `${copy('přibližně', 'about')} ${Math.max(2, Math.round(plannedCount * 0.6))} min`
              : copy(
                  'Další kartička se objeví, až přijde čas ji zopakovat.',
                  'The next card appears when it is due.',
                )}</em
          >
        </span>
        <ArrowRight size={20} />
      </button>

      <a class="cram-callout" href="/exam/">
        <span><Zap size={20} fill="currentColor" /></span>
        <span>
          <small>{copy('Rychlý režim', 'Quick mode')}</small>
          <strong>{copy('Naplánovat písemku', 'Plan a test')}</strong>
          <em
            >{copy(
              'Datum, rozsah, denní dávka a nejrizikovější slova na jednom místě.',
              'Date, scope, daily batch, and riskiest words in one place.',
            )}</em
          >
        </span>
        <ArrowRight size={19} />
      </a>

      {#if resume}
        <section class="resume-card" aria-labelledby="resume-title">
          <span><Pause size={18} /></span>
          <div>
            <p class="resume-label">{copy('Pozastavená dávka', 'Paused batch')}</p>
            <h2 id="resume-title">
              {cardsLabel(resume.remaining)}
              {copy('zbývá z', 'remaining of')}
              {resume.total}
            </h2>
            <p>
              {groupLabel(resume.selectedTag)} · {sourceLabel(resume.sourceFilter)} · {copy(
                'pokrok i další karta zůstaly uložené',
                'progress and the next card are saved',
              )}
            </p>
          </div>
          <button type="button" onclick={onresume}>
            <Play size={17} />
            {copy('Pokračovat', 'Continue')}
          </button>
        </section>
      {/if}

      <details class="advanced-setup">
        <summary>
          <span
            ><strong>{copy('Upravit dávku', 'Customize batch')}</strong><small
              >{sourceLabel(sourceFilter)} · {groupLabel(selectedTag)} · max. {sessionSize}</small
            ></span
          >
          <ArrowRight size={18} />
        </summary>

        <fieldset>
          <legend>{copy('Zdroj slov', 'Word source')}</legend>
          <p class="field-help">
            {copy(
              'Filtr jen sestaví tuto relaci. Nemění termíny ani dlouhodobou úroveň vynechaných slov.',
              'This filter only builds the current session. It does not change due dates or the long-term level of omitted words.',
            )}
          </p>
          <div
            class="source-list"
            aria-label={copy(
              'Zdroj slov pro dlouhodobé opakování',
              'Word source for long-term review',
            )}
          >
            <button
              class:active={sourceFilter === 'all'}
              type="button"
              aria-pressed={sourceFilter === 'all'}
              onclick={() => onsourcechange('all')}
            >
              <strong>{copy('Všechna slova', 'All words')}</strong><span
                >{copy('vlastní i kurzová', 'your words and course words')}</span
              >
            </button>
            <button
              class:active={sourceFilter === 'own'}
              type="button"
              aria-pressed={sourceFilter === 'own'}
              onclick={() => onsourcechange('own')}
            >
              <strong>{copy('Jen vlastní slova', 'Your words only')}</strong><span
                >{copy(
                  'ruční, importovaná a AI slovíčka',
                  'manual, imported, and AI-generated words',
                )}</span
              >
            </button>
            <button
              class:active={sourceFilter === 'course'}
              type="button"
              aria-pressed={sourceFilter === 'course'}
              onclick={() => onsourcechange('course')}
            >
              <strong>{copy('Jen slova z kurzu', 'Course words only')}</strong><span
                >{copy(
                  'včetně dříve vlastních propojených slov',
                  'including linked words that were previously yours',
                )}</span
              >
            </button>
            <button
              class:active={sourceFilter === 'without-course'}
              class="exclude-course"
              type="button"
              aria-pressed={sourceFilter === 'without-course'}
              onclick={() => onsourcechange('without-course')}
            >
              <strong>{copy('Bez slov z kurzu', 'Without course words')}</strong><span
                >{copy(
                  'vlastní slova použitá později v kurzu zůstávají',
                  'your words later reused by the course remain',
                )}</span
              >
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>{copy('Studijní skupina', 'Study group')}</legend>
          <p class="field-help">
            {copy(
              'Počítáme slovíčka k dnešnímu opakování a nové výrazy podle denního limitu.',
              'Counts include only cards due today and today’s new-word allowance.',
            )}
          </p>
          <div class="tag-list">
            <button
              class:active={selectedTag === 'all'}
              class="tag"
              type="button"
              aria-pressed={selectedTag === 'all'}
              onclick={() => (selectedTag = 'all')}
              ><span>{copy('Všechny skupiny', 'All groups')}</span><strong>{allTagCount}</strong
              ></button
            >
            {#each visibleTags as tag}
              <button
                class:active={selectedTag === tag.value}
                class="tag"
                type="button"
                aria-pressed={selectedTag === tag.value}
                onclick={() => (selectedTag = tag.value)}
                ><span>{tag.value}</span><strong>{tag.count}</strong></button
              >
            {/each}
          </div>
        </fieldset>

        <fieldset>
          <legend>{copy('Velikost dávky', 'Batch size')}</legend>
          <p class="field-help">
            {copy(
              'Další slovíčka si můžeš zopakovat později.',
              'You can review the remaining words later.',
            )}
          </p>
          <div class="size-list" aria-label={copy('Velikost studijní dávky', 'Study batch size')}>
            {#each sizes as size}
              <button
                class:active={sessionSize === size}
                class="size"
                type="button"
                aria-pressed={sessionSize === size}
                onclick={() => (sessionSize = size)}
                ><strong>{size}</strong><span>max.</span></button
              >
            {/each}
          </div>
        </fieldset>

        <div class="start-row">
          <button
            class="btn-base btn-primary"
            type="button"
            disabled={plannedCount === 0}
            onclick={onstart}
          >
            {resume
              ? copy('Začít novou dávku', 'Start a new batch')
              : copy('Začít dnešní dávku', 'Start today’s batch')}
            <ArrowRight size={18} />
          </button>
          <p>
            {#if plannedCount > 0}
              {cardsLabel(plannedCount)} · {copy('přibližně', 'about')}
              {Math.max(2, Math.round(plannedCount * 0.6))} min
            {:else}
              {copy(
                'V tomto výběru teď není nic k opakování.',
                'No words are due for this filter right now.',
              )}
            {/if}
          </p>
          {#if plannedCount === 0 && sourceFilter !== 'all'}
            <button class="clear-source" type="button" onclick={() => onsourcechange('all')}>
              {copy('Zobrazit všechna slova', 'Show all words')}
            </button>
          {/if}
        </div>
      </details>
    </div>

    <aside class="principles">
      <div class="principle-heading">
        <Clock3 size={20} /><span>{copy('Pravidla dnešní dávky', 'Rules for today’s batch')}</span>
      </div>
      <ol>
        <li>
          <span>1</span>
          <div>
            <strong>{copy('Slovíčka na dnešek', 'Only what is due')}</strong>
            <p>
              {copy(
                'Slovíčka s pozdějším termínem si zopakuješ, až na ně přijde řada.',
                'Words with later review dates will wait until they’re due.',
              )}
            </p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <strong>{copy('Jedna karta jednou', 'Each card once')}</strong>
            <p>
              {copy(
                'Slovo, ve kterém uděláš chybu, dostane nový termín opakování.',
                'If you miss a word, it gets a new review date.',
              )}
            </p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <strong>{copy('Pauza nic nemaže', 'Pausing loses nothing')}</strong>
            <p>
              {copy(
                'Zavři relaci kdykoli. Příště začneš přesně první nehotovou kartou.',
                'Close the session at any time. Next time you start with the first unfinished card.',
              )}
            </p>
          </div>
        </li>
      </ol>
    </aside>
  </div>
</section>

<style>
  .setup-page {
    width: 100%;
    min-width: 0;
  }
  .back-link {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.45rem;
    border-radius: 0.75rem;
    color: var(--color-ink-600);
    padding: 0 0.45rem;
    font-size: 0.82rem;
    font-weight: 750;
  }
  .setup-sheet {
    display: grid;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    margin-top: 1rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.35rem 1.8rem 0.35rem 0.35rem;
    background: var(--color-paper-50);
    box-shadow: 7px 7px 0 var(--color-ink-950);
  }
  .setup-main {
    min-width: 0;
    padding: clamp(1.35rem, 5vw, 3.2rem);
  }
  .setup-icon {
    display: grid;
    width: 3.3rem;
    height: 3.3rem;
    place-items: center;
    border-radius: 1rem;
    color: var(--color-ink-950);
    background: var(--color-acid-100);
  }
  h1 {
    max-width: 43rem;
    margin-top: 0.5rem;
    text-wrap: balance;
    font-size: clamp(2.2rem, 7vw, 4.5rem);
    font-weight: 920;
    line-height: 0.92;
    letter-spacing: -0.04em;
  }
  .intro {
    max-width: 39rem;
    margin-top: 1rem;
    color: var(--color-ink-600);
    line-height: 1.65;
  }
  .recommended-start {
    display: grid;
    width: min(100%, 39rem);
    min-height: 5.4rem;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.8rem;
    margin-top: 1.25rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.35rem 1rem 0.35rem 0.35rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
    padding: 0.8rem;
    text-align: left;
    box-shadow: 4px 4px 0 var(--color-ink-950);
    transition:
      transform 140ms var(--ease-out-emil),
      box-shadow 140ms var(--ease-out-emil),
      opacity 160ms var(--ease-out-emil);
  }
  .recommended-start:active:not(:disabled) {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .recommended-start:disabled {
    cursor: default;
    opacity: 0.55;
  }
  .recommended-icon {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    background: white;
  }
  .recommended-start > span:nth-child(2) {
    display: grid;
    gap: 0.12rem;
  }
  .recommended-start small {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 850;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .recommended-start strong {
    font-size: 0.94rem;
    font-weight: 880;
  }
  .recommended-start em {
    font-size: 0.7rem;
    font-style: normal;
  }
  .cram-callout {
    display: grid;
    max-width: 39rem;
    min-height: 4.8rem;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.25rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.35rem 1rem 0.35rem 0.35rem;
    background: var(--color-coral-50);
    padding: 0.75rem;
    box-shadow: 3px 3px 0 var(--color-ink-950);
    transition:
      transform 140ms var(--ease-out-emil),
      box-shadow 140ms var(--ease-out-emil);
  }
  .advanced-setup {
    max-width: 39rem;
    margin-top: 1rem;
    border-top: 1px solid var(--color-line);
  }
  .advanced-setup > summary {
    display: flex;
    min-height: 3.6rem;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: var(--color-ink-950);
    padding: 0.65rem 0.2rem;
    list-style: none;
    cursor: pointer;
  }
  .advanced-setup > summary::-webkit-details-marker {
    display: none;
  }
  .advanced-setup > summary span {
    display: grid;
    gap: 0.12rem;
  }
  .advanced-setup > summary strong {
    font-size: 0.82rem;
  }
  .advanced-setup > summary small {
    color: var(--color-ink-600);
    font-size: 0.68rem;
  }
  .advanced-setup > summary :global(svg) {
    flex: none;
    transition: transform 180ms var(--ease-out-emil);
  }
  .advanced-setup[open] > summary :global(svg) {
    transform: rotate(90deg);
  }
  .cram-callout > span:first-child {
    display: grid;
    width: 2.65rem;
    height: 2.65rem;
    place-items: center;
    border-radius: 999px;
    color: white;
    background: var(--color-coral-700);
  }
  .cram-callout small,
  .cram-callout strong,
  .cram-callout em {
    display: block;
  }
  .cram-callout small {
    color: var(--color-coral-700);
    font-family: var(--font-mono);
    font-size: 0.56rem;
    font-weight: 850;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .cram-callout strong {
    margin-top: 0.08rem;
    font-size: 0.88rem;
    font-weight: 880;
  }
  .cram-callout em {
    margin-top: 0.14rem;
    color: var(--color-ink-800);
    font-size: 0.68rem;
    font-style: normal;
    line-height: 1.35;
  }
  .cram-callout:active {
    transform: scale(0.98);
    box-shadow: 1px 1px 0 var(--color-ink-950);
  }
  fieldset {
    min-width: 0;
    min-inline-size: 0;
    margin-top: 2rem;
  }
  legend {
    font-size: 0.9rem;
    font-weight: 850;
  }
  .field-help {
    margin-top: 0.25rem;
    color: var(--color-ink-600);
    font-size: 0.74rem;
    line-height: 1.45;
  }
  .tag-list {
    display: flex;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    max-height: 11rem;
    flex-wrap: wrap;
    gap: 0.55rem;
    overflow-y: auto;
    margin-top: 0.8rem;
    padding: 0.1rem 0.2rem 0.2rem 0.1rem;
  }
  .source-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
    margin-top: 0.8rem;
  }
  .source-list button {
    min-height: 4.4rem;
    border: 1px solid var(--color-line);
    border-radius: 0.3rem 0.9rem 0.3rem 0.3rem;
    background: white;
    padding: 0.7rem;
    text-align: left;
    transition:
      transform 140ms var(--ease-out-emil),
      border-color 150ms var(--ease-out-emil),
      background-color 150ms var(--ease-out-emil);
  }
  .source-list strong,
  .source-list span {
    display: block;
  }
  .source-list strong {
    font-size: 0.78rem;
    font-weight: 850;
  }
  .source-list span {
    margin-top: 0.25rem;
    color: var(--color-ink-600);
    font-size: 0.66rem;
    line-height: 1.35;
  }
  .source-list button.active {
    border-color: var(--color-ink-950);
    background: var(--color-acid-100);
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .source-list button.exclude-course {
    border-style: dashed;
  }
  .source-list button:active {
    transform: scale(0.97);
  }
  .tag {
    display: inline-flex;
    min-height: 2.8rem;
    align-items: center;
    gap: 0.6rem;
    border: 1px solid var(--color-line);
    border-radius: 0.85rem;
    color: var(--color-ink-600);
    background: white;
    padding: 0.55rem 0.65rem 0.55rem 0.8rem;
    font-size: 0.78rem;
    font-weight: 760;
    transition:
      transform 140ms var(--ease-out-emil),
      border-color 150ms var(--ease-out-emil),
      background-color 150ms var(--ease-out-emil);
  }
  .tag strong {
    display: grid;
    min-width: 1.55rem;
    height: 1.55rem;
    place-items: center;
    border-radius: 999px;
    color: var(--color-ink-950);
    background: var(--color-paper-200);
    font-family: var(--font-mono);
    font-size: 0.65rem;
  }
  .tag.active {
    border-color: var(--color-ink-950);
    color: var(--color-ink-950);
    background: var(--color-acid-100);
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .tag.active strong {
    background: white;
  }
  .size-list {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.55rem;
    margin-top: 0.8rem;
  }
  .size {
    display: flex;
    min-height: 4.2rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-line);
    border-radius: 0.9rem;
    background: white;
    transition:
      transform 140ms var(--ease-out-emil),
      border-color 150ms var(--ease-out-emil),
      background-color 150ms var(--ease-out-emil);
  }
  .size strong {
    font-size: 1.12rem;
    line-height: 1;
  }
  .size span {
    margin-top: 0.22rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.6rem;
  }
  .size.active {
    border-color: var(--color-ink-950);
    color: white;
    background: var(--color-ink-950);
  }
  .size.active span {
    color: rgb(255 255 255 / 0.68);
  }
  .tag:active,
  .size:active,
  .resume-card button:active {
    transform: scale(0.97);
  }
  .resume-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.8rem;
    margin-top: 1.5rem;
    border: 1px solid var(--color-cobalt-700);
    border-radius: 0.3rem 1rem 0.3rem 0.3rem;
    background: var(--color-sky-50);
    padding: 0.85rem;
    box-shadow: 3px 3px 0 var(--color-cobalt-300);
  }
  .resume-card > span {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    place-items: center;
    border-radius: 999px;
    color: white;
    background: var(--color-cobalt-700);
  }
  .resume-label {
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 820;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .resume-card h2 {
    margin-top: 0.1rem;
    font-size: 1rem;
    font-weight: 860;
  }
  .resume-card div > p:last-child {
    margin-top: 0.16rem;
    color: var(--color-ink-600);
    font-size: 0.7rem;
  }
  .resume-card button {
    display: inline-flex;
    min-height: 2.65rem;
    grid-column: 1 / -1;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border-radius: 0.25rem;
    color: white;
    background: var(--color-cobalt-700);
    padding: 0.6rem 0.8rem;
    font-size: 0.78rem;
    font-weight: 820;
    transition: transform 140ms var(--ease-out-emil);
  }
  .start-row {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 2rem;
  }
  .start-row p {
    color: var(--color-ink-600);
    font-size: 0.78rem;
    font-weight: 700;
  }
  .clear-source {
    align-self: flex-start;
    min-height: 2.75rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem;
    background: white;
    padding: 0.55rem 0.8rem;
    font-size: 0.72rem;
    font-weight: 820;
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .principles {
    border-top: 1px solid var(--color-ink-950);
    background: var(--color-butter-50);
    padding: clamp(1.35rem, 4vw, 2.1rem);
  }
  .principle-heading {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    font-family: var(--font-mono);
    font-size: 0.67rem;
    font-weight: 830;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .principles ol {
    display: grid;
    gap: 1.35rem;
    margin-top: 1.4rem;
  }
  .principles li {
    display: flex;
    gap: 0.75rem;
  }
  .principles li > span {
    display: grid;
    width: 2rem;
    height: 2rem;
    flex: none;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem;
    background: white;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 850;
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .principles strong {
    font-size: 0.86rem;
  }
  .principles p {
    margin-top: 0.2rem;
    color: var(--color-ink-600);
    font-size: 0.75rem;
    line-height: 1.5;
  }
  @media (hover: hover) and (pointer: fine) {
    .back-link:hover {
      color: var(--color-ink-950);
      background: var(--color-paper-200);
    }
    .cram-callout:hover {
      transform: translateY(-2px);
      box-shadow: 5px 5px 0 var(--color-ink-950);
    }
  }
  @media (min-width: 620px) {
    .resume-card {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }
    .resume-card button {
      grid-column: auto;
    }
    .start-row {
      flex-direction: row;
      align-items: center;
    }
  }
  @media (min-width: 960px) {
    .setup-sheet {
      grid-template-columns: minmax(0, 1.45fr) minmax(17rem, 0.55fr);
    }
    .principles {
      border-top: 0;
      border-left: 1px solid var(--color-ink-950);
    }
  }
  @media (min-width: 960px) and (max-height: 900px) {
    section.setup-page {
      padding-top: 0;
    }
    .setup-sheet {
      margin-top: 0.75rem;
    }
    .setup-main {
      padding: 1.75rem 2rem;
    }
    .setup-icon {
      width: 2.65rem;
      height: 2.65rem;
      border-radius: 0.8rem;
    }
    .setup-main .kicker {
      margin-top: 0.75rem;
    }
    h1 {
      margin-top: 0.35rem;
      font-size: 3rem;
      line-height: 0.94;
    }
    .intro {
      margin-top: 0.65rem;
      line-height: 1.5;
    }
    .cram-callout {
      min-height: 4.2rem;
      margin-top: 0.75rem;
    }
    .resume-card {
      margin-top: 0.85rem;
      padding: 0.7rem;
    }
    .setup-sheet.has-resume .tag-list {
      max-height: none;
      flex-wrap: nowrap;
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-inline: contain;
    }
    .setup-sheet.has-resume .tag {
      flex: none;
    }
    fieldset {
      margin-top: 1rem;
    }
    .tag-list,
    .size-list {
      margin-top: 0.55rem;
    }
    .size {
      min-height: 3.5rem;
    }
    .start-row {
      margin-top: 1rem;
    }
    .principles {
      padding: 1.5rem;
    }
    .principles ol {
      gap: 1rem;
      margin-top: 1rem;
    }
  }
  @media (max-width: 420px) {
    .source-list,
    .size-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 360px) {
    .source-list {
      grid-template-columns: 1fr;
    }
  }
</style>
