<script lang="ts">
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { coachScenarios } from '$lib/domain/course/coach.ts';
  import {
    coachSessionsOnDay,
    creditedCoachTurnsOnDay,
  } from '$lib/domain/course/course-progress.ts';
  import { dailyLearningTargets } from '$lib/domain/course/daily.ts';
  import { baseCefrLevel } from '$lib/domain/levels.ts';
  import { localized } from '$lib/i18n';
  import { coachScenarioCopy } from '$lib/i18n/coach.ts';
  import { appStore, dueCards, motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Bot from '@lucide/svelte/icons/bot';
  import Briefcase from '@lucide/svelte/icons/briefcase';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import Check from '@lucide/svelte/icons/check';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Coffee from '@lucide/svelte/icons/coffee';
  import Croissant from '@lucide/svelte/icons/croissant';
  import GraduationCap from '@lucide/svelte/icons/graduation-cap';
  import Heart from '@lucide/svelte/icons/heart';
  import HeartPulse from '@lucide/svelte/icons/heart-pulse';
  import Hotel from '@lucide/svelte/icons/hotel';
  import House from '@lucide/svelte/icons/house';
  import Luggage from '@lucide/svelte/icons/luggage';
  import MapPinned from '@lucide/svelte/icons/map-pinned';
  import MessageCircleMore from '@lucide/svelte/icons/message-circle-more';
  import MessagesSquare from '@lucide/svelte/icons/messages-square';
  import MicVocal from '@lucide/svelte/icons/mic-vocal';
  import Presentation from '@lucide/svelte/icons/presentation';
  import Scale from '@lucide/svelte/icons/scale';
  import Search from '@lucide/svelte/icons/search';
  import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import TimerReset from '@lucide/svelte/icons/timer-reset';
  import TrainFront from '@lucide/svelte/icons/train-front';
  import Users from '@lucide/svelte/icons/users';
  import Zap from '@lucide/svelte/icons/zap';
  import { onMount } from 'svelte';

  import type { CefrLevel, Note, StudyCard } from '$lib/domain/types.ts';

  const scenarioLevels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

  const iconByScenario = {
    coffee: Coffee,
    train: TrainFront,
    school: GraduationCap,
    shopping: ShoppingBag,
    people: Users,
    food: Croissant,
    map: MapPinned,
    hotel: Hotel,
    health: HeartPulse,
    calendar: CalendarDays,
    home: House,
    work: Briefcase,
    luggage: Luggage,
    presentation: Presentation,
    timer: TimerReset,
    discussion: MessagesSquare,
    debate: Scale,
    interview: MicVocal,
  };

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

  let levelFilter: CefrLevel | 'all' | 'favorites' = 'all';
  let levelFilterInitialized = false;
  let scenarioQuery = '';
  let favoriteSaving = false;
  let favoriteError = '';

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  onMount(() => void appStore.initialize());

  $: todaySessions = coachSessionsOnDay($appStore.course, new Date());
  $: todayTurns = creditedCoachTurnsOnDay($appStore.course, new Date());
  $: coachTarget = dailyLearningTargets($appStore.settings?.dailyMinutes ?? 10).coach;
  $: speakingDone = todayTurns >= coachTarget;
  $: totalSessions = $appStore.course.coachEvents.length;
  $: allScenarios = coachScenarios.map((scenario) => coachScenarioCopy(scenario, $motherTongue));
  $: favoriteScenarioIds = new Set($appStore.settings?.favoriteCoachScenarioIds ?? []);
  $: practicedScenarioIds = new Set($appStore.course.coachEvents.map((event) => event.scenarioId));
  $: practicedTodayIds = new Set(todaySessions.map((event) => event.scenarioId));
  $: profileScenarioLevel = baseCefrLevel($appStore.settings?.grammarLevel ?? 'A1.1');
  $: if ($appStore.settings && !levelFilterInitialized) {
    levelFilter = profileScenarioLevel;
    levelFilterInitialized = true;
  }
  $: normalizedScenarioQuery = scenarioQuery.trim().toLocaleLowerCase('cs-CZ');
  $: visibleScenarios = allScenarios.filter((scenario) => {
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
  });
  $: levelScenarios = allScenarios.filter((scenario) => scenario.level === profileScenarioLevel);
  $: recommendedScenario =
    levelScenarios.find(
      (scenario) => favoriteScenarioIds.has(scenario.id) && !practicedTodayIds.has(scenario.id),
    ) ??
    levelScenarios.find((scenario) => !practicedTodayIds.has(scenario.id)) ??
    levelScenarios[0] ??
    allScenarios[0];
  $: weakWords = weakGermanWords($dueCards, $appStore.notes);

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
  <div class="coach-page">
    <header class="coach-hero">
      <div class="hero-orbit one"></div>
      <div class="hero-orbit two"></div>
      <div class="hero-copy">
        <p class="eyebrow">
          <Bot size={15} />
          {copy('AI konverzační trenér', 'AI conversation coach')}
        </p>
        <h1>
          {copy(
            'Neuč se jen odpověď. Nauč se reagovat.',
            "Don't just learn answers. Learn to respond.",
          )}
        </h1>
        <p>
          {copy(
            `${coachScenarios.length} situací od A1 do C1 procvičuje vlastní odpověď v němčině. Každá je krátká a po odpovědi ukáže konkrétní opravu.`,
            `${coachScenarios.length} scenarios from A1 to C1 help you actively use German instead of simply recognising the right card. Three turns, instant feedback, and done in a few minutes.`,
          )}
        </p>
        <div class="hero-actions">
          <a href={`/coach/session/${recommendedScenario.id}/`} class="hero-primary">
            <Zap size={18} fill="currentColor" />
            {copy('Spustit doporučený scénář', 'Start recommended scenario')}
          </a>
          <span
            ><Sparkles size={15} />
            {copy('funguje i bez API klíče', 'works without an API key')}</span
          >
        </div>
      </div>

      <aside class="coach-score">
        <p>{copy('Dnešní mluvení', "Today's speaking")}</p>
        <strong>{Math.min(todayTurns, coachTarget)}<small>/{coachTarget}</small></strong>
        <span
          >{speakingDone
            ? copy('Dnešní výzva splněna', "Today's challenge complete")
            : copy('Stačí tři krátké repliky', 'Just three short turns')}</span
        >
        <div class="score-line">
          <i style={`--coach-progress:${Math.min(1, todayTurns / coachTarget)}`}></i>
        </div>
        <footer>
          <MessageCircleMore size={15} />
          {copy(`${totalSessions} konverzací celkem`, `${totalSessions} conversations total`)}
        </footer>
      </aside>
    </header>

    <section
      class="how-it-works"
      aria-label={copy('Jak AI trenér funguje', 'How the AI coach works')}
    >
      <article>
        <span>01</span>
        <div>
          <strong>{copy('Situace místo testu', 'A situation, not a test')}</strong>
          <p>
            {copy(
              'Dostaneš roli, komunikační cíl a první repliku.',
              'You get a role, a communication goal, and the opening line.',
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
              'AI vytáhne nejdůležitější chybu, ne deset pravidel najednou.',
              'AI highlights the most important issue instead of ten rules at once.',
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
      <section class="focus-strip">
        <div class="focus-icon"><Sparkles size={20} /></div>
        <div>
          <p class="kicker">
            {copy('Chytré propojení se slovníkem', 'Connected to your vocabulary')}
          </p>
          <h2>{copy('Dnes se zkus aktivně opřít o tato slova', 'Try to use these words today')}</h2>
        </div>
        <div class="focus-words">
          {#each weakWords as word}<span lang="de">{word}</span>{/each}
        </div>
      </section>
    {/if}

    <section class="scenario-section" aria-labelledby="scenario-title">
      <div class="section-heading">
        <div>
          <p class="kicker">{copy('Krátké mise · 5–8 minut', 'Quick missions · 5–8 minutes')}</p>
          <h2 id="scenario-title">
            {copy('Vyber situaci, kterou chceš zvládnout', 'Choose a situation to master')}
          </h2>
        </div>
        <p>
          {copy(
            'Každá konverzace přidá XP pouze jednou denně, ale trénovat ji můžeš opakovaně.',
            'Each conversation awards XP once per day, but you can practise it as often as you like.',
          )}
        </p>
      </div>

      <fieldset class="level-filter" aria-describedby="level-filter-help">
        <legend>{copy('Úroveň scénářů', 'Scenario level')}</legend>
        <div>
          <button
            type="button"
            class:active={levelFilter === 'all'}
            aria-pressed={levelFilter === 'all'}
            onclick={() => changeLevelFilter('all')}
            >{copy('Vše', 'All')} <span>{coachScenarios.length}</span></button
          >
          <button
            type="button"
            class:active={levelFilter === 'favorites'}
            aria-pressed={levelFilter === 'favorites'}
            onclick={() => changeLevelFilter('favorites')}
          >
            <Heart
              size={15}
              fill={levelFilter === 'favorites' ? 'currentColor' : 'none'}
              aria-hidden="true"
            />
            {copy('Oblíbené', 'Favorites')}
            <span>{favoriteScenarioIds.size}</span>
          </button>
          {#each scenarioLevels as item}
            <button
              type="button"
              class:active={levelFilter === item}
              aria-pressed={levelFilter === item}
              onclick={() => changeLevelFilter(item)}
              >{item}{item === profileScenarioLevel ? copy(' · moje', ' · mine') : ''}<span
                >{scenarioCountForLevel(item)}</span
              ></button
            >
          {/each}
        </div>
        <p id="level-filter-help">
          {copy(
            `Zobrazeno ${visibleScenarios.length} z ${coachScenarios.length} scénářů.`,
            `Showing ${visibleScenarios.length} of ${coachScenarios.length} scenarios.`,
          )}
        </p>
      </fieldset>
      {#if favoriteError}<p class="favorite-error" role="alert">{favoriteError}</p>{/if}

      <label class="scenario-search" for="scenario-search">
        <Search size={18} aria-hidden="true" />
        <input
          id="scenario-search"
          bind:value={scenarioQuery}
          placeholder={copy('Hledat situaci nebo komunikační cíl…', 'Search a situation or goal…')}
        />
        {#if scenarioQuery}<button type="button" onclick={() => (scenarioQuery = '')}>
            {copy('Vymazat', 'Clear')}
          </button>{/if}
      </label>

      <div class="scenario-grid">
        {#each visibleScenarios as scenario, index}
          {@const Icon = iconByScenario[scenario.icon]}
          {@const practiced = practicedScenarioIds.has(scenario.id)}
          {@const practicedToday = practicedTodayIds.has(scenario.id)}
          <div class="scenario-card-shell">
            <a
              class={`scenario-card accent-${scenario.accent}`}
              href={`/coach/session/${scenario.id}/`}
            >
              <div class="scenario-topline">
                <span class="scenario-icon"><Icon size={24} /></span>
                <span class="scenario-number">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <p class="scenario-eyebrow">{scenario.eyebrow}</p>
              <h3>{scenario.title}</h3>
              <p class="scenario-description">{scenario.description}</p>
              <div class="scenario-goal"><Check size={15} /> {scenario.goal}</div>
              <footer>
                <span><Clock3 size={14} /> {scenario.minutes} min</span>
                <span>{scenario.level}</span>
                <span class:practiced={practicedToday}
                  >{practicedToday
                    ? copy('dnes hotovo', 'done today')
                    : practiced
                      ? copy('+ až 25 XP dnes', '+ up to 25 XP today')
                      : copy('+ až 25 XP', '+ up to 25 XP')}</span
                >
                <ArrowRight size={18} />
              </footer>
            </a>
            <button
              class:active={favoriteScenarioIds.has(scenario.id)}
              class="favorite-toggle"
              type="button"
              aria-label={favoriteScenarioIds.has(scenario.id)
                ? copy(
                    `Odebrat ${scenario.title} z oblíbených`,
                    `Remove ${scenario.title} from favorites`,
                  )
                : copy(
                    `Přidat ${scenario.title} do oblíbených`,
                    `Add ${scenario.title} to favorites`,
                  )}
              aria-pressed={favoriteScenarioIds.has(scenario.id)}
              disabled={favoriteSaving}
              onclick={() => void toggleFavorite(scenario.id)}
            >
              <Heart
                size={18}
                fill={favoriteScenarioIds.has(scenario.id) ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
            </button>
          </div>
        {/each}
      </div>
      {#if visibleScenarios.length === 0}
        <div class="scenario-empty">
          {#if levelFilter === 'favorites' && !scenarioQuery}
            <Heart size={26} aria-hidden="true" />
            <strong>{copy('Zatím nemáš oblíbený scénář.', 'No favorite scenarios yet.')}</strong>
            <p>
              {copy(
                'Srdíčkem si připni situace, ke kterým se chceš vracet.',
                'Use the heart to pin situations you want to revisit.',
              )}
            </p>
            <button type="button" onclick={() => changeLevelFilter(profileScenarioLevel)}>
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
            <button type="button" onclick={() => (scenarioQuery = '')}
              >{copy('Vymazat hledání', 'Clear search')}</button
            >
          {/if}
        </div>
      {/if}
    </section>
  </div>
{/if}

<style>
  .coach-page {
    max-width: 72rem;
    margin: 0 auto;
  }
  .coach-hero {
    position: relative;
    display: grid;
    overflow: hidden;
    border: 1px solid var(--color-ink-950);
    border-radius: 1rem 2.2rem 1rem 1rem;
    color: white;
    background: var(--color-ink-950);
    box-shadow: 7px 7px 0 rgb(21 25 28 / 0.13);
  }
  .hero-copy {
    position: relative;
    z-index: 2;
    padding: clamp(1.4rem, 5vw, 3.4rem);
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    margin: 0;
    color: var(--color-acid-500);
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 850;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .hero-copy h1 {
    max-width: 12ch;
    margin: 0.8rem 0 0;
    font-size: clamp(2.5rem, 8vw, 5.3rem);
    font-weight: 930;
    letter-spacing: -0.04em;
    line-height: 0.88;
    text-wrap: balance;
  }
  .hero-copy > p:not(.eyebrow) {
    max-width: 43rem;
    margin: 1.2rem 0 0;
    color: rgb(255 255 255 / 0.65);
    font-size: clamp(0.92rem, 2vw, 1.06rem);
    line-height: 1.62;
  }
  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.8rem;
    margin-top: 1.4rem;
  }
  .hero-primary {
    display: inline-flex;
    min-height: 3rem;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--color-acid-500);
    border-radius: 0.4rem 1rem 0.4rem 0.4rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
    padding: 0.75rem 1rem;
    font-size: 0.82rem;
    font-weight: 850;
    box-shadow: 4px 4px 0 rgb(201 255 56 / 0.28);
    transition:
      transform 150ms var(--ease-out-emil),
      box-shadow 170ms var(--ease-out-emil);
  }
  .hero-primary:active {
    transform: scale(0.97);
    box-shadow: 1px 1px 0 rgb(201 255 56 / 0.28);
  }
  .hero-actions > span {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: rgb(255 255 255 / 0.55);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 720;
  }
  .hero-orbit {
    position: absolute;
    z-index: 0;
    border: 2.2rem solid rgb(201 255 56 / 0.08);
    border-radius: 50%;
    pointer-events: none;
  }
  .hero-orbit.one {
    top: -6rem;
    right: 10%;
    width: 18rem;
    height: 18rem;
  }
  .hero-orbit.two {
    right: -7rem;
    bottom: -8rem;
    width: 22rem;
    height: 22rem;
    border-color: rgb(170 184 255 / 0.08);
  }
  .coach-score {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-top: 1px solid rgb(255 255 255 / 0.13);
    background: var(--color-acid-500);
    padding: 1.35rem;
    color: var(--color-ink-950);
  }
  .coach-score > p {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.63rem;
    font-weight: 850;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .coach-score > strong {
    margin-top: 0.65rem;
    font-size: clamp(3.2rem, 12vw, 5.4rem);
    font-weight: 930;
    letter-spacing: -0.04em;
    line-height: 0.82;
  }
  .coach-score strong small {
    font-size: 0.33em;
  }
  .coach-score > span {
    margin-top: 0.65rem;
    font-size: 0.78rem;
    font-weight: 780;
  }
  .score-line {
    height: 0.55rem;
    margin-top: 1rem;
    overflow: hidden;
    border: 1px solid var(--color-ink-950);
    border-radius: 99px;
    background: rgb(255 255 255 / 0.55);
  }
  .score-line i {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--color-ink-950);
    transform: scaleX(var(--coach-progress));
    transform-origin: left;
    transition: transform 280ms var(--ease-out-emil);
  }
  .coach-score footer {
    display: flex;
    align-items: center;
    gap: 0.38rem;
    margin-top: 0.85rem;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 820;
  }

  .how-it-works {
    display: grid;
    margin-top: 1rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.7rem 1.5rem 0.7rem 0.7rem;
    background: var(--color-paper-50);
    box-shadow: 4px 4px 0 rgb(21 25 28 / 0.1);
  }
  .how-it-works article {
    display: flex;
    gap: 0.8rem;
    padding: 1rem;
  }
  .how-it-works article + article {
    border-top: 1px solid var(--color-line);
  }
  .how-it-works article > span {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 900;
  }
  .how-it-works strong {
    font-size: 0.83rem;
    font-weight: 850;
  }
  .how-it-works p {
    margin: 0.22rem 0 0;
    color: var(--color-ink-800);
    font-size: 0.73rem;
    line-height: 1.5;
  }

  .focus-strip {
    display: grid;
    align-items: center;
    gap: 0.9rem;
    margin-top: 1rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.7rem 1.5rem 0.7rem 0.7rem;
    background: var(--color-sky-50);
    padding: 1rem;
  }
  .focus-icon {
    display: grid;
    width: 2.8rem;
    height: 2.8rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.5rem 1rem 0.5rem 0.5rem;
    background: var(--color-cobalt-300);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .focus-strip h2 {
    margin: 0.22rem 0 0;
    font-size: 1rem;
    font-weight: 880;
    letter-spacing: -0.025em;
  }
  .focus-strip .kicker,
  .scenario-section .kicker {
    color: var(--color-ink-800);
  }
  .focus-words {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }
  .focus-words span {
    border: 1px solid var(--color-ink-950);
    border-radius: 99px;
    background: var(--color-paper-50);
    padding: 0.42rem 0.65rem;
    font-size: 0.72rem;
    font-weight: 800;
  }

  .scenario-section {
    margin-top: clamp(2rem, 6vw, 4.2rem);
  }
  .section-heading {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .section-heading h2 {
    max-width: 15ch;
    margin: 0.3rem 0 0;
    font-size: clamp(1.8rem, 5vw, 3.1rem);
    font-weight: 920;
    letter-spacing: -0.04em;
    line-height: 0.96;
    text-wrap: balance;
  }
  .section-heading > p {
    max-width: 33rem;
    margin: 0;
    color: var(--color-ink-600);
    font-size: 0.8rem;
    line-height: 1.55;
  }
  .level-filter {
    display: grid;
    gap: 0.55rem;
    margin: 0 0 1rem;
    border: 1px solid var(--color-line);
    border-radius: 0.65rem;
    background: var(--color-paper-50);
    padding: 0.75rem;
  }
  .level-filter legend {
    padding-inline: 0.25rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 850;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .level-filter > div {
    display: flex;
    gap: 0.4rem;
    overflow-x: auto;
    padding: 0.1rem;
    scrollbar-width: none;
  }
  .level-filter > div::-webkit-scrollbar {
    display: none;
  }
  .level-filter button {
    display: inline-flex;
    min-width: 3.1rem;
    min-height: 2.55rem;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 0.38rem;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    color: var(--color-ink-800);
    background: var(--color-paper-100);
    padding: 0.45rem 0.7rem;
    font-size: 0.75rem;
    font-weight: 820;
    transition:
      transform 140ms var(--ease-out-emil),
      border-color 140ms var(--ease-out-emil),
      background-color 140ms var(--ease-out-emil);
  }
  .level-filter button span {
    display: inline-grid;
    min-width: 1.3rem;
    height: 1.3rem;
    place-items: center;
    border-radius: 999px;
    background: rgb(21 25 28 / 0.08);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    line-height: 1;
  }
  .level-filter button.active {
    border-color: var(--color-ink-950);
    color: white;
    background: var(--color-ink-950);
  }
  .level-filter button.active span {
    background: rgb(255 255 255 / 0.16);
  }
  .level-filter button:active {
    transform: scale(0.96);
  }
  .level-filter > p {
    color: var(--color-ink-800);
    font-size: 0.75rem;
    font-weight: 700;
  }
  .scenario-search {
    display: grid;
    min-height: 3rem;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.6rem;
    border: 1px solid var(--color-line);
    border-radius: 0.4rem 0.85rem 0.4rem 0.4rem;
    background: var(--color-paper-50);
    padding: 0 0.8rem;
  }
  .scenario-search:focus-within {
    border-color: var(--color-cobalt-700);
    box-shadow: 0 0 0 3px rgb(49 83 199 / 0.12);
  }
  .scenario-search input {
    min-width: 0;
    border: 0;
    background: transparent;
    outline: 0;
  }
  .scenario-search button,
  .scenario-empty button {
    color: var(--color-cobalt-700);
    font-size: 0.72rem;
    font-weight: 800;
  }
  .scenario-empty {
    display: grid;
    min-height: 12rem;
    place-items: center;
    align-content: center;
    gap: 0.55rem;
    color: var(--color-ink-600);
    text-align: center;
  }
  .scenario-empty p {
    max-width: 27rem;
    color: var(--color-ink-600);
    font-size: 0.76rem;
    line-height: 1.45;
  }
  .favorite-error {
    margin: -0.35rem 0 0.8rem;
    color: var(--color-coral-700);
    font-size: 0.76rem;
    font-weight: 750;
  }
  .scenario-grid {
    display: grid;
    gap: 0.85rem;
  }
  .scenario-card-shell {
    position: relative;
    min-width: 0;
  }
  .scenario-card {
    position: relative;
    display: flex;
    height: 100%;
    min-height: 19rem;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem 1.55rem 0.65rem 0.65rem;
    color: var(--color-ink-950);
    background: var(--card-bg, var(--color-paper-50));
    padding: 1.15rem;
    box-shadow: 5px 5px 0 rgb(21 25 28 / 0.12);
    transition:
      transform 190ms var(--ease-out-emil),
      box-shadow 190ms var(--ease-out-emil);
  }
  .scenario-card::after {
    position: absolute;
    right: -3.8rem;
    bottom: -4rem;
    width: 9rem;
    height: 9rem;
    border: 1.5rem solid rgb(21 25 28 / 0.055);
    border-radius: 50%;
    content: '';
  }
  .accent-coral {
    --card-bg: var(--color-coral-50);
  }
  .accent-sky {
    --card-bg: var(--color-sky-50);
  }
  .accent-mint {
    --card-bg: var(--color-mint-50);
  }
  .accent-butter {
    --card-bg: var(--color-butter-50);
  }
  .scenario-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .scenario-icon {
    display: grid;
    width: 3.1rem;
    height: 3.1rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.5rem 1rem 0.5rem 0.5rem;
    background: var(--color-paper-50);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .scenario-number {
    margin-right: 3.1rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 900;
  }
  .favorite-toggle {
    position: absolute;
    z-index: 2;
    top: 1rem;
    right: 1rem;
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 24%, transparent);
    border-radius: 999px;
    color: var(--color-ink-600);
    background: color-mix(in srgb, white 82%, transparent);
    transition:
      color 150ms var(--ease-out-emil),
      background-color 150ms var(--ease-out-emil),
      transform 140ms var(--ease-out-emil);
  }
  .favorite-toggle.active {
    border-color: var(--color-coral-700);
    color: var(--color-coral-700);
    background: var(--color-coral-50);
  }
  .favorite-toggle:active {
    transform: scale(0.94);
  }
  .favorite-toggle:disabled {
    cursor: wait;
    opacity: 0.65;
  }
  .scenario-eyebrow {
    margin: 1rem 0 0;
    color: var(--color-ink-800);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .scenario-card h3 {
    max-width: 13ch;
    margin: 0.35rem 0 0;
    font-size: 1.55rem;
    font-weight: 920;
    letter-spacing: -0.04em;
    line-height: 0.98;
  }
  .scenario-description {
    margin: 0.75rem 0 0;
    color: var(--color-ink-800);
    font-size: 0.8rem;
    line-height: 1.5;
  }
  .scenario-goal {
    display: flex;
    align-items: flex-start;
    gap: 0.45rem;
    margin-top: 1rem;
    border-top: 1px solid rgb(21 25 28 / 0.13);
    padding-top: 0.8rem;
    font-size: 0.7rem;
    font-weight: 760;
    line-height: 1.45;
  }
  .scenario-goal :global(svg) {
    flex: none;
    margin-top: 0.08rem;
  }
  .scenario-card footer {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: auto;
    padding-top: 1.2rem;
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 820;
  }
  .scenario-card footer span {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
  }
  .scenario-card footer span.practiced {
    color: var(--color-mint-700);
  }
  .scenario-card footer :global(svg:last-child) {
    margin-left: auto;
  }

  @media (min-width: 720px) {
    .how-it-works {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .how-it-works article + article {
      border-top: 0;
      border-left: 1px solid var(--color-line);
    }
    .focus-strip {
      grid-template-columns: auto minmax(0, 1fr) auto;
      padding: 1.2rem;
    }
    .scenario-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .section-heading {
      flex-direction: row;
      align-items: end;
      justify-content: space-between;
    }
    .section-heading > p {
      text-align: right;
    }
  }

  @media (min-width: 980px) {
    .coach-hero {
      grid-template-columns: minmax(0, 1fr) 17rem;
    }
    .coach-score {
      border-top: 0;
      border-left: 1px solid var(--color-ink-950);
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .hero-primary:hover {
      transform: translateY(-2px);
      box-shadow: 6px 6px 0 rgb(201 255 56 / 0.28);
    }
    .scenario-card:hover {
      transform: translateY(-3px);
      box-shadow: 8px 8px 0 rgb(21 25 28 / 0.12);
    }
    .favorite-toggle:hover:not(:disabled) {
      color: var(--color-coral-700);
      background: var(--color-coral-50);
    }
  }

  @media (max-width: 520px) {
    .coach-page {
      margin-inline: -0.15rem;
    }
    .coach-hero {
      border-radius: 0.75rem 1.6rem 0.75rem 0.75rem;
    }
    .scenario-card {
      min-height: 17rem;
    }
  }
</style>
