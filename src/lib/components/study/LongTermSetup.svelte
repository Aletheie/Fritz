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

  const fieldset = 'mt-8 min-w-0 short-desktop:mt-4';
  const legend = 'text-[0.9rem] font-[850]';
  const help = 'mt-1 text-[0.74rem] leading-[1.45] text-ink-600';
  const press =
    '[transition:transform_140ms_var(--ease-out-emil),border-color_150ms_var(--ease-out-emil),background-color_150ms_var(--ease-out-emil)] active:[transform:scale(0.97)]';
  const sourceButton = (active: boolean, dashed = false) => [
    'min-h-[4.4rem] rounded-[0.3rem_0.9rem_0.3rem_0.3rem] border p-[0.7rem] text-left',
    press,
    dashed && 'border-dashed',
    active
      ? 'border-ink-950 bg-acid-100 shadow-[2px_2px_0_var(--color-ink-950)]'
      : 'border-line bg-white',
  ];
  const sourceTitle = 'block text-[0.78rem] font-[850]';
  const sourceNote = 'mt-1 block text-[0.66rem] leading-[1.35] text-ink-600';
  const tagButton = (active: boolean) => [
    'inline-flex min-h-[2.8rem] items-center gap-[0.6rem] rounded-[0.85rem] border py-[0.55rem] pr-[0.65rem] pl-[0.8rem] text-[0.78rem] font-[760]',
    press,
    resume && 'short-desktop:flex-none',
    active
      ? 'border-ink-950 bg-acid-100 text-ink-950 shadow-[2px_2px_0_var(--color-ink-950)]'
      : 'border-line bg-white text-ink-600',
  ];
  const tagCount = (active: boolean) => [
    'grid h-[1.55rem] min-w-[1.55rem] place-items-center rounded-full font-mono text-[0.65rem] text-ink-950',
    active ? 'bg-white' : 'bg-paper-200',
  ];
  const ruleStep =
    'flex gap-3 [&>span]:grid [&>span]:size-8 [&>span]:flex-none [&>span]:place-items-center [&>span]:rounded-[0.25rem] [&>span]:border [&>span]:border-ink-950 [&>span]:bg-white [&>span]:font-mono [&>span]:text-[0.7rem] [&>span]:font-[850] [&>span]:shadow-[2px_2px_0_var(--color-ink-950)] [&_p]:mt-[0.2rem] [&_p]:text-[0.75rem] [&_p]:leading-normal [&_p]:text-ink-600 [&_strong]:text-[0.86rem]';
</script>

<section class="mx-auto w-full max-w-5xl min-w-0 pt-1 sm:pt-8 short-desktop:pt-0">
  <a
    class="inline-flex min-h-11 items-center gap-[0.45rem] rounded-xl px-[0.45rem] text-[0.82rem] font-[750] text-ink-600 fine-hover:bg-paper-200 fine-hover:text-ink-950"
    href="/"><ArrowLeft size={18} /> {copy('Zpět na dnešek', 'Back to today')}</a
  >

  <div
    class="mt-4 grid w-full min-w-0 overflow-hidden rounded-[0.35rem_1.8rem_0.35rem_0.35rem] border border-ink-950 bg-paper-50 shadow-[7px_7px_0_var(--color-ink-950)] min-[960px]:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.55fr)] short-desktop:mt-3"
  >
    <div class="min-w-0 p-[clamp(1.35rem,5vw,3.2rem)] short-desktop:px-8 short-desktop:py-7">
      <span
        class="grid size-[3.3rem] place-items-center rounded-2xl bg-acid-100 text-ink-950 short-desktop:size-[2.65rem] short-desktop:rounded-[0.8rem]"
        ><Brain size={25} /></span
      >
      <p class="kicker mt-5 short-desktop:mt-3">{copy('Dlouhodobé studium', 'Long-term study')}</p>
      <h1
        class="mt-2 max-w-[43rem] text-[clamp(2.2rem,7vw,4.5rem)] leading-[0.92] font-[920] tracking-[-0.04em] text-balance short-desktop:mt-[0.35rem] short-desktop:text-[3rem] short-desktop:leading-[0.94]"
      >
        {copy('Kolik slovíček si chceš zopakovat?', 'How many words would you like to review?')}
      </h1>
      <p
        class="mt-4 max-w-[39rem] leading-[1.65] text-ink-600 short-desktop:mt-[0.65rem] short-desktop:leading-normal"
      >
        {copy(
          'Vybereš si počet slovíček k opakování. Další během procvičování nepřibudou. Odpovědi se ukládají průběžně, takže můžeš kdykoli přestat.',
          'Choose how many words to review. No more will be added during practice. Answers save as you go, so you can stop at any time.',
        )}
      </p>

      <button
        class="mt-5 grid min-h-[5.4rem] w-[min(100%,39rem)] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.8rem] rounded-[0.35rem_1rem_0.35rem_0.35rem] border border-ink-950 bg-acid-500 p-[0.8rem] text-left text-ink-950 shadow-[4px_4px_0_var(--color-ink-950)] [transition:transform_140ms_var(--ease-out-emil),box-shadow_140ms_var(--ease-out-emil),opacity_160ms_var(--ease-out-emil)] active:not-disabled:[transform:translate(2px,2px)] active:not-disabled:shadow-[2px_2px_0_var(--color-ink-950)] disabled:cursor-default disabled:opacity-55"
        type="button"
        disabled={plannedCount === 0}
        onclick={onstart}
      >
        <span class="grid size-11 place-items-center rounded-full border border-ink-950 bg-white"
          ><Play size={20} fill="currentColor" /></span
        >
        <span class="grid gap-[0.12rem]">
          <small class="font-mono text-[0.58rem] font-[850] tracking-[0.06em] uppercase"
            >{copy('doporučená dávka', 'recommended batch')}</small
          >
          <strong class="text-[0.94rem] font-[880]"
            >{plannedCount > 0
              ? copy(
                  `Začít rovnou · ${cardsLabel(plannedCount)}`,
                  `Start now · ${cardsLabel(plannedCount)}`,
                )
              : copy('Dnešní opakování je hotové', 'Today’s review is complete')}</strong
          >
          <em class="text-[0.7rem] not-italic"
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

      <a
        class="mt-5 grid min-h-[4.8rem] max-w-[39rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[0.35rem_1rem_0.35rem_0.35rem] border border-ink-950 bg-coral-50 p-3 shadow-[3px_3px_0_var(--color-ink-950)] [transition:transform_140ms_var(--ease-out-emil),box-shadow_140ms_var(--ease-out-emil)] active:[transform:scale(0.98)] active:shadow-[1px_1px_0_var(--color-ink-950)] short-desktop:mt-3 short-desktop:min-h-[4.2rem] fine-hover:[transform:translateY(-2px)] fine-hover:shadow-[5px_5px_0_var(--color-ink-950)]"
        href="/exam/"
      >
        <span class="grid size-[2.65rem] place-items-center rounded-full bg-coral-700 text-white"
          ><Zap size={20} fill="currentColor" /></span
        >
        <span>
          <small
            class="block font-mono text-[0.56rem] font-[850] tracking-[0.06em] text-coral-700 uppercase"
            >{copy('Rychlý režim', 'Quick mode')}</small
          >
          <strong class="mt-[0.08rem] block text-[0.88rem] font-[880]"
            >{copy('Naplánovat písemku', 'Plan a test')}</strong
          >
          <em class="mt-[0.14rem] block text-[0.68rem] leading-[1.35] text-ink-800 not-italic"
            >{copy(
              'Datum, rozsah, denní dávka a nejrizikovější slova na jednom místě.',
              'Date, scope, daily batch, and riskiest words in one place.',
            )}</em
          >
        </span>
        <ArrowRight size={19} />
      </a>

      {#if resume}
        <section
          class="mt-6 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.8rem] rounded-[0.3rem_1rem_0.3rem_0.3rem] border border-cobalt-700 bg-sky-50 p-[0.85rem] shadow-[3px_3px_0_var(--color-cobalt-300)] min-[620px]:grid-cols-[auto_minmax(0,1fr)_auto] short-desktop:mt-[0.85rem] short-desktop:p-[0.7rem]"
          aria-labelledby="resume-title"
        >
          <span class="grid size-10 place-items-center rounded-full bg-cobalt-700 text-white"
            ><Pause size={18} /></span
          >
          <div>
            <p
              class="font-mono text-[0.58rem] font-[820] tracking-[0.06em] text-cobalt-700 uppercase"
            >
              {copy('Pozastavená dávka', 'Paused batch')}
            </p>
            <h2 class="mt-[0.1rem] text-[1rem] font-[860]" id="resume-title">
              {cardsLabel(resume.remaining)}
              {copy('zbývá z', 'remaining of')}
              {resume.total}
            </h2>
            <p class="mt-[0.16rem] text-[0.7rem] text-ink-600">
              {groupLabel(resume.selectedTag)} · {sourceLabel(resume.sourceFilter)} · {copy(
                'pokrok i další karta zůstaly uložené',
                'progress and the next card are saved',
              )}
            </p>
          </div>
          <button
            class="col-span-full inline-flex min-h-[2.65rem] items-center justify-center gap-[0.45rem] rounded-[0.25rem] bg-cobalt-700 px-[0.8rem] py-[0.6rem] text-[0.78rem] font-[820] text-white transition-transform duration-140 ease-out-emil active:[transform:scale(0.97)] min-[620px]:col-auto"
            type="button"
            onclick={onresume}
          >
            <Play size={17} />
            {copy('Pokračovat', 'Continue')}
          </button>
        </section>
      {/if}

      <details class="group mt-4 max-w-[39rem] border-t border-line">
        <summary
          class="flex min-h-[3.6rem] cursor-pointer list-none items-center justify-between gap-4 px-[0.2rem] py-[0.65rem] text-ink-950 [&::-webkit-details-marker]:hidden"
        >
          <span class="grid gap-[0.12rem]"
            ><strong class="text-[0.82rem]">{copy('Upravit dávku', 'Customize batch')}</strong
            ><small class="text-[0.68rem] text-ink-600"
              >{sourceLabel(sourceFilter)} · {groupLabel(selectedTag)} · max. {sessionSize}</small
            ></span
          >
          <ArrowRight
            class="flex-none transition-transform duration-180 ease-out-emil group-open:rotate-90"
            size={18}
          />
        </summary>

        <fieldset class={fieldset}>
          <legend class={legend}>{copy('Zdroj slov', 'Word source')}</legend>
          <p class={help}>
            {copy(
              'Filtr jen sestaví tuto relaci. Nemění termíny ani dlouhodobou úroveň vynechaných slov.',
              'This filter only builds the current session. It does not change due dates or the long-term level of omitted words.',
            )}
          </p>
          <div
            class="mt-[0.8rem] grid grid-cols-2 gap-[0.55rem] max-[361px]:grid-cols-1"
            aria-label={copy(
              'Zdroj slov pro dlouhodobé opakování',
              'Word source for long-term review',
            )}
          >
            <button
              class={sourceButton(sourceFilter === 'all')}
              type="button"
              aria-pressed={sourceFilter === 'all'}
              onclick={() => onsourcechange('all')}
            >
              <strong class={sourceTitle}>{copy('Všechna slova', 'All words')}</strong><span
                class={sourceNote}>{copy('vlastní i kurzová', 'your words and course words')}</span
              >
            </button>
            <button
              class={sourceButton(sourceFilter === 'own')}
              type="button"
              aria-pressed={sourceFilter === 'own'}
              onclick={() => onsourcechange('own')}
            >
              <strong class={sourceTitle}>{copy('Jen vlastní slova', 'Your words only')}</strong
              ><span class={sourceNote}
                >{copy(
                  'ruční, importovaná a AI slovíčka',
                  'manual, imported, and AI-generated words',
                )}</span
              >
            </button>
            <button
              class={sourceButton(sourceFilter === 'course')}
              type="button"
              aria-pressed={sourceFilter === 'course'}
              onclick={() => onsourcechange('course')}
            >
              <strong class={sourceTitle}>{copy('Jen slova z kurzu', 'Course words only')}</strong
              ><span class={sourceNote}
                >{copy(
                  'včetně dříve vlastních propojených slov',
                  'including linked words that were previously yours',
                )}</span
              >
            </button>
            <button
              class={sourceButton(sourceFilter === 'without-course', true)}
              type="button"
              aria-pressed={sourceFilter === 'without-course'}
              onclick={() => onsourcechange('without-course')}
            >
              <strong class={sourceTitle}>{copy('Bez slov z kurzu', 'Without course words')}</strong
              ><span class={sourceNote}
                >{copy(
                  'vlastní slova použitá později v kurzu zůstávají',
                  'your words later reused by the course remain',
                )}</span
              >
            </button>
          </div>
        </fieldset>

        <fieldset class={fieldset}>
          <legend class={legend}>{copy('Studijní skupina', 'Study group')}</legend>
          <p class={help}>
            {copy(
              'Počítáme slovíčka k dnešnímu opakování a nové výrazy podle denního limitu.',
              'Counts include only cards due today and today’s new-word allowance.',
            )}
          </p>
          <div
            class={[
              'mt-[0.8rem] flex max-h-44 w-full max-w-full min-w-0 flex-wrap gap-[0.55rem] overflow-y-auto pt-[0.1rem] pr-[0.2rem] pb-[0.2rem] pl-[0.1rem] short-desktop:mt-[0.55rem]',
              resume &&
                'short-desktop:max-h-none short-desktop:flex-nowrap short-desktop:overflow-x-auto short-desktop:overflow-y-hidden short-desktop:overscroll-x-contain',
            ]}
          >
            <button
              class={tagButton(selectedTag === 'all')}
              type="button"
              aria-pressed={selectedTag === 'all'}
              onclick={() => (selectedTag = 'all')}
              ><span>{copy('Všechny skupiny', 'All groups')}</span><strong
                class={tagCount(selectedTag === 'all')}>{allTagCount}</strong
              ></button
            >
            {#each visibleTags as tag}
              <button
                class={tagButton(selectedTag === tag.value)}
                type="button"
                aria-pressed={selectedTag === tag.value}
                onclick={() => (selectedTag = tag.value)}
                ><span>{tag.value}</span><strong class={tagCount(selectedTag === tag.value)}
                  >{tag.count}</strong
                ></button
              >
            {/each}
          </div>
        </fieldset>

        <fieldset class={fieldset}>
          <legend class={legend}>{copy('Velikost dávky', 'Batch size')}</legend>
          <p class={help}>
            {copy(
              'Další slovíčka si můžeš zopakovat později.',
              'You can review the remaining words later.',
            )}
          </p>
          <div
            class="mt-[0.8rem] grid grid-cols-4 gap-[0.55rem] max-[421px]:grid-cols-2 short-desktop:mt-[0.55rem]"
            aria-label={copy('Velikost studijní dávky', 'Study batch size')}
          >
            {#each sizes as size}
              <button
                class={[
                  'flex min-h-[4.2rem] flex-col items-center justify-center rounded-[0.9rem] border short-desktop:min-h-14',
                  press,
                  sessionSize === size
                    ? 'border-ink-950 bg-ink-950 text-white'
                    : 'border-line bg-white',
                ]}
                type="button"
                aria-pressed={sessionSize === size}
                onclick={() => (sessionSize = size)}
                ><strong class="text-[1.12rem] leading-none">{size}</strong><span
                  class={[
                    'mt-[0.22rem] font-mono text-[0.6rem]',
                    sessionSize === size ? 'text-white/68' : 'text-ink-600',
                  ]}>max.</span
                ></button
              >
            {/each}
          </div>
        </fieldset>

        <div
          class="mt-8 flex flex-col gap-3 min-[620px]:flex-row min-[620px]:items-center short-desktop:mt-4"
        >
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
          <p class="text-[0.78rem] font-bold text-ink-600">
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
            <button
              class="min-h-11 self-start rounded-[0.25rem] border border-ink-950 bg-white px-[0.8rem] py-[0.55rem] text-[0.72rem] font-[820] shadow-[2px_2px_0_var(--color-ink-950)]"
              type="button"
              onclick={() => onsourcechange('all')}
            >
              {copy('Zobrazit všechna slova', 'Show all words')}
            </button>
          {/if}
        </div>
      </details>
    </div>

    <aside
      class="border-t border-ink-950 bg-butter-50 p-[clamp(1.35rem,4vw,2.1rem)] min-[960px]:border-t-0 min-[960px]:border-l short-desktop:p-6"
    >
      <div
        class="flex items-center gap-[0.55rem] font-mono text-[0.67rem] font-[830] tracking-[0.05em] uppercase"
      >
        <Clock3 size={20} /><span>{copy('Pravidla dnešní dávky', 'Rules for today’s batch')}</span>
      </div>
      <ol class="mt-[1.4rem] grid gap-[1.35rem] short-desktop:mt-4 short-desktop:gap-4">
        <li class={ruleStep}>
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
        <li class={ruleStep}>
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
        <li class={ruleStep}>
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
