<script lang="ts">
  import CoachScenarioCard from '$lib/components/coach/CoachScenarioCard.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { coachScenarios } from '$lib/domain/course/coach.ts';
  import {
    coachSessionsOnDay,
    creditedCoachTurnsOnDay,
  } from '$lib/domain/course/course-progress.ts';
  import { dailyLearningTargets } from '$lib/domain/course/daily.ts';
  import { errorText } from '$lib/domain/errors.ts';
  import { baseCefrLevel } from '$lib/domain/levels.ts';
  import { localized } from '$lib/i18n';
  import { coachScenarioCopy } from '$lib/i18n/coach.ts';
  import { appStore, dueCards, motherTongue } from '$lib/state/app';
  import Bot from '@lucide/svelte/icons/bot';
  import Heart from '@lucide/svelte/icons/heart';
  import MessageCircleMore from '@lucide/svelte/icons/message-circle-more';
  import Search from '@lucide/svelte/icons/search';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Zap from '@lucide/svelte/icons/zap';
  import { onMount } from 'svelte';

  import type { CefrLevel, Note, StudyCard } from '$lib/domain/types.ts';

  const scenarioLevels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

  const scenarioCountByLevel = new Map<CefrLevel, number>();
  for (const scenario of coachScenarios) {
    scenarioCountByLevel.set(scenario.level, (scenarioCountByLevel.get(scenario.level) ?? 0) + 1);
  }

  function weakGermanWords(cards: StudyCard[], notes: Note[]): string[] {
    const notesById = new Map(notes.map((note) => [note.id, note]));
    const words: string[] = [];
    for (let index = 0; index < cards.length && index < 6 && words.length < 3; index += 1) {
      const word = notesById.get(cards[index].noteId)?.german;
      if (word) words.push(word);
    }
    return words;
  }

  let levelFilter: CefrLevel | 'all' | 'favorites' = $state('all');
  let levelFilterInitialized = $state(false);
  let scenarioQuery = $state('');
  let favoriteSaving = $state(false);
  let favoriteError = $state('');

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  onMount(() => void appStore.initialize());

  const todaySessions = $derived(coachSessionsOnDay($appStore.course, new Date()));
  const todayTurns = $derived(creditedCoachTurnsOnDay($appStore.course, new Date()));
  const coachTarget = $derived(dailyLearningTargets($appStore.settings?.dailyMinutes ?? 10).coach);
  const speakingDone = $derived(todayTurns >= coachTarget);
  const totalSessions = $derived($appStore.course.coachEvents.length);
  const allScenarios = $derived(
    coachScenarios.map((scenario) => coachScenarioCopy(scenario, $motherTongue)),
  );
  const favoriteScenarioIds = $derived(new Set($appStore.settings?.favoriteCoachScenarioIds ?? []));
  const practicedScenarioIds = $derived(
    new Set($appStore.course.coachEvents.map((event) => event.scenarioId)),
  );
  const practicedTodayIds = $derived(new Set(todaySessions.map((event) => event.scenarioId)));
  const profileScenarioLevel = $derived(baseCefrLevel($appStore.settings?.grammarLevel ?? 'A1.1'));
  $effect.pre(() => {
    if ($appStore.settings && !levelFilterInitialized) {
      levelFilter = profileScenarioLevel;
      levelFilterInitialized = true;
    }
  });
  const normalizedScenarioQuery = $derived(scenarioQuery.trim().toLocaleLowerCase('cs-CZ'));
  const visibleScenarios = $derived(
    allScenarios.filter((scenario) => {
      const matchesLevel =
        Boolean(normalizedScenarioQuery) ||
        levelFilter === 'all' ||
        (levelFilter === 'favorites'
          ? favoriteScenarioIds.has(scenario.id)
          : scenario.level === levelFilter);
      const matchesQuery =
        !normalizedScenarioQuery ||
        [scenario.title, scenario.description, scenario.goal, scenario.eyebrow, scenario.level]
          .join(' ')
          .toLocaleLowerCase('cs-CZ')
          .includes(normalizedScenarioQuery);
      return matchesLevel && matchesQuery;
    }),
  );
  const levelScenarios = $derived(
    allScenarios.filter((scenario) => scenario.level === profileScenarioLevel),
  );
  let recommendedScenario = $derived(
    levelScenarios.find(
      (scenario) => favoriteScenarioIds.has(scenario.id) && !practicedTodayIds.has(scenario.id),
    ) ??
      levelScenarios.find((scenario) => !practicedTodayIds.has(scenario.id)) ??
      levelScenarios[0] ??
      allScenarios[0],
  );
  const weakWords = $derived(weakGermanWords($dueCards, $appStore.notes));

  function changeLevelFilter(next: CefrLevel | 'all' | 'favorites'): void {
    levelFilter = next;
    levelFilterInitialized = true;
  }

  function scenarioCountForLevel(level: CefrLevel): number {
    return scenarioCountByLevel.get(level) ?? 0;
  }

  async function toggleFavorite(scenarioId: string): Promise<void> {
    if (!$appStore.settings || favoriteSaving) return;
    favoriteSaving = true;
    favoriteError = '';
    const current = $appStore.settings.favoriteCoachScenarioIds;
    const next = current.includes(scenarioId)
      ? current.filter((id) => id !== scenarioId)
      : [...current, scenarioId];
    try {
      await appStore.updateSettings({ favoriteCoachScenarioIds: next });
    } catch (error) {
      favoriteError = errorText(error, $motherTongue, {
        cs: 'Oblíbené se nepodařilo uložit.',
        en: 'Could not save favorites.',
      });
    } finally {
      favoriteSaving = false;
    }
  }

  const sectionKicker = 'kicker text-ink-800';
  const textButton = 'text-[0.72rem] font-extrabold text-cobalt-700';
  const levelButton = (active: boolean) => [
    'inline-flex min-h-[2.55rem] min-w-[3.1rem] flex-none items-center justify-center gap-[0.38rem] rounded-full border px-[0.7rem] py-[0.45rem] text-[0.75rem] font-[820] [transition:transform_140ms_var(--ease-out-emil),border-color_140ms_var(--ease-out-emil),background-color_140ms_var(--ease-out-emil)] active:[transform:scale(0.96)]',
    active ? 'border-ink-950 bg-ink-950 text-white' : 'border-line bg-paper-100 text-ink-800',
  ];
  const levelCount = (active: boolean) => [
    'inline-grid h-[1.3rem] min-w-[1.3rem] place-items-center rounded-full font-mono text-[0.75rem] leading-none',
    active ? 'bg-white/16' : 'bg-[rgb(21_25_28/0.08)]',
  ];
</script>

<svelte:head>
  <title>{copy('AI konverzace · Fritz', 'AI conversations · Fritz')}</title>
  <meta
    name="description"
    content={copy(
      'Krátké německé roleplay scénáře s okamžitou AI zpětnou vazbou.',
      'Short German role-play scenarios with instant AI feedback.',
    )}
  />
</svelte:head>

{#if !$appStore.ready}
  <LoadingState
    label={copy('Připravuji konverzační scénáře…', 'Preparing conversation scenarios…')}
  />
{:else}
  <div class="mx-auto max-w-[72rem] max-[521px]:-mx-[0.15rem]">
    <header
      class="relative grid overflow-hidden rounded-[1rem_2.2rem_1rem_1rem] border border-ink-950 bg-ink-950 text-white shadow-[7px_7px_0_rgb(21_25_28/0.13)] max-[521px]:rounded-[0.75rem_1.6rem_0.75rem_0.75rem] min-[980px]:grid-cols-[minmax(0,1fr)_17rem]"
    >
      <div
        class="pointer-events-none absolute -top-24 right-[10%] z-0 size-72 rounded-full border-[2.2rem] border-[rgb(201_255_56/0.08)]"
      ></div>
      <div
        class="pointer-events-none absolute -right-28 -bottom-32 z-0 size-88 rounded-full border-[2.2rem] border-[rgb(170_184_255/0.08)]"
      ></div>
      <div class="relative z-2 p-[clamp(1.4rem,5vw,3.4rem)]">
        <p
          class="m-0 inline-flex items-center gap-[0.42rem] font-mono text-[0.65rem] font-[850] tracking-[0.08em] text-acid-500 uppercase"
        >
          <Bot size={15} />
          {copy('AI konverzační trenér', 'AI conversation coach')}
        </p>
        <h1
          class="mt-[0.8rem] max-w-[12ch] text-[clamp(2.5rem,8vw,5.3rem)] leading-[0.88] font-[930] tracking-[-0.04em] text-balance"
        >
          {copy('Co řekneš německy?', 'What would you say in German?')}
        </h1>
        <p
          class="mt-[1.2rem] mb-0 max-w-[43rem] text-[clamp(0.92rem,2vw,1.06rem)] leading-[1.62] text-white/65"
        >
          {copy(
            `${coachScenarios.length} situací od A1 do C1 procvičuje vlastní odpověď v němčině. Každá je krátká a po odpovědi ukáže konkrétní opravu.`,
            `${coachScenarios.length} scenarios from A1 to C1. Write your replies in German and get feedback after each one.`,
          )}
        </p>
        <div class="mt-[1.4rem] flex flex-wrap items-center gap-[0.8rem]">
          <a
            href={`/coach/session/${recommendedScenario.id}/`}
            class="inline-flex min-h-12 items-center gap-2 rounded-[0.4rem_1rem_0.4rem_0.4rem] border border-acid-500 bg-acid-500 px-4 py-3 text-[0.82rem] font-[850] text-ink-950 shadow-[4px_4px_0_rgb(201_255_56/0.28)] [transition:transform_150ms_var(--ease-out-emil),box-shadow_170ms_var(--ease-out-emil)] active:[transform:scale(0.97)] active:shadow-[1px_1px_0_rgb(201_255_56/0.28)] fine-hover:[transform:translateY(-2px)] fine-hover:shadow-[6px_6px_0_rgb(201_255_56/0.28)]"
          >
            <Zap size={18} fill="currentColor" />
            {copy('Spustit doporučený scénář', 'Start recommended scenario')}
          </a>
          <span
            class="inline-flex items-center gap-[0.4rem] font-mono text-[0.62rem] font-[720] text-white/55"
            ><Sparkles size={15} />
            {copy('funguje i bez API klíče', 'works without an API key')}</span
          >
        </div>
      </div>

      <aside
        class="relative z-2 flex flex-col justify-center border-t border-white/13 bg-acid-500 p-[1.35rem] text-ink-950 min-[980px]:border-t-0 min-[980px]:border-l min-[980px]:border-l-ink-950"
      >
        <p class="m-0 font-mono text-[0.63rem] font-[850] tracking-[0.07em] uppercase">
          {copy('Dnešní mluvení', "Today's speaking")}
        </p>
        <strong
          class="mt-[0.65rem] text-[clamp(3.2rem,12vw,5.4rem)] leading-[0.82] font-[930] tracking-[-0.04em]"
          >{Math.min(todayTurns, coachTarget)}<small class="text-[0.33em]">/{coachTarget}</small
          ></strong
        >
        <span class="mt-[0.65rem] text-[0.78rem] font-[780]"
          >{speakingDone
            ? copy('Dnešní výzva splněna', "Today's challenge complete")
            : copy('Stačí tři krátké repliky', 'Just three short turns')}</span
        >
        <div
          class="mt-4 h-[0.55rem] overflow-hidden rounded-full border border-ink-950 bg-white/55"
        >
          <i
            class="block h-full w-full origin-left bg-ink-950 [transition:transform_280ms_var(--ease-out-emil)]"
            style:transform={`scaleX(${Math.min(1, todayTurns / coachTarget)})`}
          ></i>
        </div>
        <footer
          class="mt-[0.85rem] flex items-center gap-[0.38rem] font-mono text-[0.6rem] font-[820]"
        >
          <MessageCircleMore size={15} />
          {copy(`${totalSessions} konverzací celkem`, `${totalSessions} conversations total`)}
        </footer>
      </aside>
    </header>

    <section
      class="mt-4 grid rounded-[0.7rem_1.5rem_0.7rem_0.7rem] border border-ink-950 bg-paper-50 shadow-[4px_4px_0_rgb(21_25_28/0.1)] min-[720px]:grid-cols-3 [&_p]:mt-[0.22rem] [&_p]:mb-0 [&_p]:text-[0.73rem] [&_p]:leading-normal [&_p]:text-ink-800 [&_strong]:text-[0.83rem] [&_strong]:font-[850] [&>article]:flex [&>article]:gap-[0.8rem] [&>article]:p-4 [&>article+article]:border-t [&>article+article]:border-line min-[720px]:[&>article+article]:border-t-0 min-[720px]:[&>article+article]:border-l [&>article>span]:font-mono [&>article>span]:text-[0.62rem] [&>article>span]:font-black"
      aria-label={copy('Jak AI trenér funguje', 'How the AI coach works')}
    >
      <article>
        <span>01</span>
        <div>
          <strong>{copy('Situace místo testu', 'A situation, not a test')}</strong>
          <p>
            {copy(
              'Vybereš si situaci a odpovíš na první zprávu.',
              'Choose a situation and reply to the first message.',
            )}
          </p>
        </div>
      </article>
      <article>
        <span>02</span>
        <div>
          <strong>{copy('Jedna oprava včas', 'One useful correction')}</strong>
          <p>
            {copy(
              'AI navrhne jednu opravu, na kterou se můžeš soustředit.',
              'AI suggests one correction to focus on.',
            )}
          </p>
        </div>
      </article>
      <article>
        <span>03</span>
        <div>
          <strong>{copy('Slova z paměti', 'Words from memory')}</strong>
          <p>
            {copy(
              'Scénář ti nabídne výrazy, které se hodí právě teď procvičit.',
              'The scenario suggests words that are worth practising right now.',
            )}
          </p>
        </div>
      </article>
    </section>

    {#if weakWords.length > 0}
      <section
        class="mt-4 grid items-center gap-[0.9rem] rounded-[0.7rem_1.5rem_0.7rem_0.7rem] border border-ink-950 bg-sky-50 p-4 min-[720px]:grid-cols-[auto_minmax(0,1fr)_auto] min-[720px]:p-[1.2rem]"
      >
        <div
          class="grid size-[2.8rem] place-items-center rounded-[0.5rem_1rem_0.5rem_0.5rem] border border-ink-950 bg-cobalt-300 shadow-[3px_3px_0_var(--color-ink-950)]"
        >
          <Sparkles size={20} />
        </div>
        <div>
          <p class={sectionKicker}>
            {copy('Chytré propojení se slovníkem', 'Connected to your vocabulary')}
          </p>
          <h2 class="mt-[0.22rem] text-[1rem] font-[880] tracking-[-0.025em]">
            {copy('Zkus dnes použít tahle slova', 'Try to use these words today')}
          </h2>
        </div>
        <div class="flex flex-wrap gap-[0.45rem]">
          {#each weakWords as word}<span
              class="rounded-full border border-ink-950 bg-paper-50 px-[0.65rem] py-[0.42rem] text-[0.72rem] font-extrabold"
              lang="de">{word}</span
            >{/each}
        </div>
      </section>
    {/if}

    <section class="mt-[clamp(2rem,6vw,4.2rem)]" aria-labelledby="scenario-title">
      <div
        class="mb-4 flex flex-col gap-3 min-[720px]:flex-row min-[720px]:items-end min-[720px]:justify-between"
      >
        <div>
          <p class={sectionKicker}>
            {copy('Krátké mise · 5–8 minut', 'Quick missions · 5–8 minutes')}
          </p>
          <h2
            class="mt-[0.3rem] max-w-[15ch] text-[clamp(1.8rem,5vw,3.1rem)] leading-[0.96] font-[920] tracking-[-0.04em] text-balance"
            id="scenario-title"
          >
            {copy('Vyber situaci, kterou chceš zvládnout', 'Choose a conversation to practise')}
          </h2>
        </div>
        <p
          class="m-0 max-w-[33rem] text-[0.8rem] leading-[1.55] text-ink-600 min-[720px]:text-right"
        >
          {copy(
            'Každá konverzace přidá XP pouze jednou denně, ale trénovat ji můžeš opakovaně.',
            'Each conversation awards XP once per day, but you can practise it as often as you like.',
          )}
        </p>
      </div>

      <fieldset
        class="mx-0 mt-0 mb-4 grid gap-[0.55rem] rounded-[0.65rem] border border-line bg-paper-50 p-3"
        aria-describedby="level-filter-help"
      >
        <legend class="px-1 font-mono text-[0.75rem] font-[850] tracking-[0.05em] uppercase"
          >{copy('Úroveň scénářů', 'Scenario level')}</legend
        >
        <div
          class="flex [scrollbar-width:none] gap-[0.4rem] overflow-x-auto p-[0.1rem] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            class={levelButton(levelFilter === 'all')}
            aria-pressed={levelFilter === 'all'}
            onclick={() => changeLevelFilter('all')}
            >{copy('Vše', 'All')}
            <span class={levelCount(levelFilter === 'all')}>{coachScenarios.length}</span></button
          >
          <button
            type="button"
            class={levelButton(levelFilter === 'favorites')}
            aria-pressed={levelFilter === 'favorites'}
            onclick={() => changeLevelFilter('favorites')}
          >
            <Heart
              size={15}
              fill={levelFilter === 'favorites' ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
            {copy('Oblíbené', 'Favorites')}
            <span class={levelCount(levelFilter === 'favorites')}>{favoriteScenarioIds.size}</span>
          </button>
          {#each scenarioLevels as item}
            <button
              type="button"
              class={levelButton(levelFilter === item)}
              aria-pressed={levelFilter === item}
              onclick={() => changeLevelFilter(item)}
              >{item}{item === profileScenarioLevel ? copy(' · moje', ' · mine') : ''}<span
                class={levelCount(levelFilter === item)}>{scenarioCountForLevel(item)}</span
              ></button
            >
          {/each}
        </div>
        <p class="text-[0.75rem] font-bold text-ink-800" id="level-filter-help">
          {copy(
            `Zobrazeno ${visibleScenarios.length} z ${coachScenarios.length} scénářů.`,
            `Showing ${visibleScenarios.length} of ${coachScenarios.length} scenarios.`,
          )}
        </p>
      </fieldset>
      {#if favoriteError}<p
          class="-mt-[0.35rem] mb-[0.8rem] text-[0.76rem] font-[750] text-coral-700"
          role="alert"
        >
          {favoriteError}
        </p>{/if}

      <label
        class="grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.6rem] rounded-[0.4rem_0.85rem_0.4rem_0.4rem] border border-line bg-paper-50 px-[0.8rem] focus-within:border-cobalt-700 focus-within:shadow-[0_0_0_3px_rgb(49_83_199/0.12)]"
        for="scenario-search"
      >
        <Search size={18} aria-hidden="true" />
        <input
          class="min-w-0 border-0 bg-transparent outline-0"
          id="scenario-search"
          bind:value={scenarioQuery}
          placeholder={copy('Hledat situaci nebo komunikační cíl…', 'Search a situation or goal…')}
        />
        {#if scenarioQuery}<button
            class={textButton}
            type="button"
            onclick={() => (scenarioQuery = '')}
          >
            {copy('Vymazat', 'Clear')}
          </button>{/if}
      </label>

      <div class="mt-4 grid gap-[0.85rem] min-[720px]:grid-cols-2">
        {#each visibleScenarios as scenario, index}
          <CoachScenarioCard
            {scenario}
            number={index + 1}
            practiced={practicedScenarioIds.has(scenario.id)}
            practicedToday={practicedTodayIds.has(scenario.id)}
            favorite={favoriteScenarioIds.has(scenario.id)}
            {favoriteSaving}
            ontogglefavorite={() => void toggleFavorite(scenario.id)}
          />
        {/each}
      </div>
      {#if visibleScenarios.length === 0}
        <div
          class="grid min-h-48 place-items-center content-center gap-[0.55rem] text-center text-ink-600"
        >
          {#if levelFilter === 'favorites' && !scenarioQuery}
            <Heart size={26} aria-hidden="true" />
            <strong>{copy('Zatím nemáš oblíbený scénář.', 'No favorite scenarios yet.')}</strong>
            <p class="max-w-[27rem] text-[0.76rem] leading-[1.45] text-ink-600">
              {copy(
                'Srdíčkem si připni situace, ke kterým se chceš vracet.',
                'Use the heart to pin situations you want to revisit.',
              )}
            </p>
            <button
              class={textButton}
              type="button"
              onclick={() => changeLevelFilter(profileScenarioLevel)}
            >
              {copy('Procházet moji úroveň', 'Browse my level')}
            </button>
          {:else}
            <Search size={26} aria-hidden="true" />
            <strong
              >{copy(
                'Žádná situace neodpovídá hledání.',
                'No scenario matches your search.',
              )}</strong
            >
            <button class={textButton} type="button" onclick={() => (scenarioQuery = '')}
              >{copy('Vymazat hledání', 'Clear search')}</button
            >
          {/if}
        </div>
      {/if}
    </section>
  </div>
{/if}
