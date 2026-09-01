<script lang="ts">
  import { goto } from '$app/navigation';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import CalibrationTest from '$lib/components/onboarding/CalibrationTest.svelte';
  import type { CalibrationRecommendation } from '$lib/domain/onboarding/calibration.ts';
  import { appStore } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import BookOpenCheck from '@lucide/svelte/icons/book-open-check';
  import Brain from '@lucide/svelte/icons/brain';
  import Check from '@lucide/svelte/icons/check';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import GraduationCap from '@lucide/svelte/icons/graduation-cap';
  import MessagesSquare from '@lucide/svelte/icons/messages-square';
  import Upload from '@lucide/svelte/icons/upload';
  import { onMount, tick } from 'svelte';

  import type { DailyMinutes, DetailedCefrLevel, LearningGoal } from '$lib/domain/types.ts';
  import type { Component } from 'svelte';

  const goals: Array<{
    id: LearningGoal;
    title: string;
    description: string;
    icon: Component;
  }> = [
    {
      id: 'school',
      title: 'Zvládnout školu a testy',
      description: 'Denní plán upřednostní látku, kterou potřebuješ umět včas.',
      icon: GraduationCap,
    },
    {
      id: 'memory',
      title: 'Pamatovat si slovíčka',
      description: 'Chytré opakování bude vracet výrazy těsně před zapomenutím.',
      icon: Brain,
    },
    {
      id: 'conversation',
      title: 'Rozmluvit se',
      description: 'V plánu dostane víc prostoru aktivní použití a AI konverzace.',
      icon: MessagesSquare,
    },
  ];

  const levels: DetailedCefrLevel[] = [
    'A1.1',
    'A1.2',
    'A2.1',
    'A2.2',
    'B1.1',
    'B1.2',
    'B2.1',
    'B2.2',
    'C1.1',
    'C1.2',
  ];
  const times: DailyMinutes[] = [5, 10, 20];
  let ready = $state(false);
  let saving = $state(false);
  let errorMessage = $state('');
  let step = $state(1);
  let goal = $state<LearningGoal>('school');
  let level = $state<DetailedCefrLevel>('A1.1');
  let minutes = $state<DailyMinutes>(10);
  let calibrating = $state(false);
  let calibrated = $state(false);
  let calibrationSummary = $state<CalibrationRecommendation | undefined>();
  let heading = $state<HTMLHeadingElement | undefined>();

  onMount(async () => {
    await appStore.initialize();
    let currentSettings = $appStore.settings;
    if (currentSettings?.onboardingCompleted) {
      await goto('/', { replaceState: true });
      return;
    }
    if (currentSettings) {
      goal = currentSettings.learningGoal;
      level = currentSettings.grammarLevel;
      minutes = currentSettings.dailyMinutes;
    }
    ready = true;
  });

  async function moveTo(nextStep: number): Promise<void> {
    step = nextStep;
    await tick();
    heading?.focus();
  }

  function startCalibration(): void {
    calibrating = true;
    calibrated = false;
    calibrationSummary = undefined;
  }

  function completeCalibration(recommendation: CalibrationRecommendation): void {
    level = recommendation.level;
    calibrationSummary = recommendation;
    calibrating = false;
    calibrated = true;
  }

  function cancelCalibration(): void {
    calibrating = false;
  }

  function goalTitle(value: LearningGoal): string {
    return goals.find((option) => option.id === value)?.title ?? goals[0].title;
  }

  async function finish(destination: 'study' | 'import'): Promise<void> {
    if (saving) return;
    saving = true;
    errorMessage = '';
    try {
      await appStore.updateSettings({
        onboardingCompleted: true,
        learningGoal: goal,
        grammarLevel: level,
        dailyMinutes: minutes,
        dailyGoal: minutes,
      });
      await goto(destination === 'study' ? '/today/' : '/import/', { replaceState: true });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Nastavení se nepodařilo uložit.';
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Začínáme · Fritz</title>
  <meta
    name="description"
    content="Krátké nastavení aplikace Fritz podle cíle, úrovně němčiny a času na učení."
  />
</svelte:head>

{#if !ready}
  <LoadingState label="Připravuji tvůj učební plán…" />
{:else}
  <main class="onboarding-page">
    <header class="onboarding-header">
      <span class="wordmark" aria-label="Fritz">Fritz<span>.</span></span>
      <ol class="stepper" aria-label="Průběh nastavení">
        {#each [1, 2, 3] as item}
          <li
            class:active={item === step}
            class:complete={item < step}
            aria-current={item === step ? 'step' : undefined}
          >
            {#if item < step}<Check size={15} aria-hidden="true" />{:else}{item}{/if}
          </li>
        {/each}
      </ol>
      <div class="header-actions">
        <span class="step-copy">krok {step} ze 3</span>
        <button type="button" disabled={saving} onclick={() => void finish('study')}
          >Přeskočit</button
        >
      </div>
    </header>

    <section class="onboarding-card surface" aria-labelledby="onboarding-title">
      {#if step === 1}
        <div class="intro-copy">
          <p class="intro-meta">První plán za méně než dvě minuty</p>
          <h1 id="onboarding-title" bind:this={heading} tabindex="-1">
            Co chceš s němčinou zvládnout?
          </h1>
          <p>
            Fritz připraví krátkou skutečnou lekci, ne ukázkovou prohlídku. Volby můžeš kdykoli
            změnit a učební data zůstanou v tomto zařízení.
          </p>
        </div>
        <fieldset class="choice-grid">
          <legend class="sr-only">Studijní cíl</legend>
          {#each goals as option}
            {@const Icon = option.icon}
            <label class:selected={goal === option.id} class="choice-card">
              <input type="radio" name="goal" value={option.id} bind:group={goal} />
              <span class="choice-icon"><Icon size={22} aria-hidden="true" /></span>
              <strong>{option.title}</strong>
              <small>{option.description}</small>
              <span class="choice-check" aria-hidden="true"><Check size={15} /></span>
            </label>
          {/each}
        </fieldset>
        <button class="btn-base btn-primary next" type="button" onclick={() => void moveTo(2)}>
          Pokračovat <ArrowRight size={18} aria-hidden="true" />
        </button>
      {:else if step === 2}
        <div class="intro-copy">
          <p class="intro-meta">Výchozí úroveň</p>
          <h1 id="onboarding-title" bind:this={heading} tabindex="-1">Odkud navážeme?</h1>
          <p>Vyber přibližnou úroveň, nebo si nech doporučit bezpečný start pěti otázkami.</p>
        </div>

        {#if calibrating}
          <CalibrationTest oncomplete={completeCalibration} oncancel={cancelCalibration} />
        {:else}
          <fieldset class="level-grid">
            <legend class="sr-only">Úroveň němčiny</legend>
            {#each levels as option}
              <label class:selected={level === option}>
                <input type="radio" name="level" value={option} bind:group={level} />
                <strong>{option}</strong>
              </label>
            {/each}
          </fieldset>
          <button class="calibrate-button" type="button" onclick={startCalibration}>
            <BookOpenCheck size={19} aria-hidden="true" />
            <span><strong>Nevím přesně</strong><small>Spustit minutový test</small></span>
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          {#if calibrated}
            <p class="result-note" role="status">
              <Check size={17} aria-hidden="true" />
              <span>
                Orientační start je <strong>{level}</strong> ({calibrationSummary?.correct ?? 0} z 5).
                Potvrď ho výše, nebo vyber jiný.
              </span>
            </p>
          {/if}
        {/if}

        <div class="button-row">
          <button class="btn-base btn-secondary" type="button" onclick={() => void moveTo(1)}
            >Zpět</button
          >
          <button
            class="btn-base btn-primary"
            type="button"
            disabled={calibrating}
            onclick={() => void moveTo(3)}
          >
            Pokračovat <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      {:else}
        <div class="intro-copy">
          <p class="intro-meta">Udržitelný rytmus</p>
          <h1 id="onboarding-title" bind:this={heading} tabindex="-1">
            Kolik času máš běžně denně?
          </h1>
          <p>Počet úloh se přizpůsobí času. Když budeš chtít, můžeš pokračovat dál.</p>
        </div>
        <fieldset class="time-grid">
          <legend class="sr-only">Denní čas na učení</legend>
          {#each times as option}
            <label class:selected={minutes === option}>
              <input type="radio" name="minutes" value={option} bind:group={minutes} />
              <Clock3 size={21} aria-hidden="true" />
              <strong>{option} minut</strong>
              <small
                >{option === 5
                  ? 'rychlé minimum'
                  : option === 10
                    ? 'doporučeno'
                    : 'hlubší blok'}</small
              >
            </label>
          {/each}
        </fieldset>

        <div class="plan-preview" aria-live="polite">
          <strong>První plán</strong>
          <span>{goalTitle(goal)} · {level} · {minutes} minut</span>
          <p>Začneš jedním dokončitelným blokem a potom se rozhodneš, zda pokračovat.</p>
        </div>

        <div class="finish-actions">
          <button
            class="btn-base btn-primary"
            type="button"
            disabled={saving}
            onclick={() => void finish('study')}
          >
            <Brain size={19} aria-hidden="true" />
            {saving ? 'Připravuji…' : 'Spustit první lekci'}
          </button>
          <button
            class="btn-base btn-secondary"
            type="button"
            disabled={saving}
            onclick={() => void finish('import')}
          >
            <Upload size={19} aria-hidden="true" /> Nahrát vlastní školní látku
          </button>
        </div>
        <button class="back-link" type="button" disabled={saving} onclick={() => void moveTo(2)}
          >Zpět k úrovni</button
        >
      {/if}

      {#if errorMessage}<p class="error-message" role="alert">{errorMessage}</p>{/if}
    </section>
  </main>
{/if}

<style>
  .onboarding-page {
    display: grid;
    min-height: 100dvh;
    place-items: center;
    padding: max(1rem, var(--safe-top)) 1rem max(1.25rem, var(--safe-bottom));
  }
  .onboarding-header,
  .onboarding-card {
    width: min(100%, 46rem);
  }
  .onboarding-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .wordmark {
    width: fit-content;
    color: var(--color-ink-950);
    font-size: 1.35rem;
    font-weight: 900;
    letter-spacing: -0.04em;
    text-decoration: none;
  }
  .wordmark span {
    color: var(--color-cobalt-700);
  }
  .stepper {
    display: flex;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .stepper li {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    color: var(--color-ink-600);
    background: var(--color-paper-50);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 850;
  }
  .stepper li.active {
    border-color: var(--color-ink-950);
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }
  .stepper li.complete {
    border-color: var(--color-mint-700);
    color: white;
    background: var(--color-mint-700);
  }
  .step-copy {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.67rem;
    font-weight: 750;
    text-transform: uppercase;
  }
  .header-actions {
    display: flex;
    align-items: center;
    justify-self: end;
    gap: 0.65rem;
  }
  .header-actions button {
    min-height: 2.75rem;
    color: var(--color-cobalt-700);
    font-size: 0.78rem;
    font-weight: 800;
    text-decoration: underline;
    text-underline-offset: 0.2rem;
  }
  .onboarding-card {
    padding: clamp(1.2rem, 4vw, 2.4rem);
  }
  .intro-copy {
    max-width: 38rem;
  }
  .intro-meta {
    color: var(--color-cobalt-700);
    font-size: 0.8rem;
    font-weight: 780;
  }
  h1 {
    max-width: 36rem;
    margin-top: 0.55rem;
    font-size: clamp(1.8rem, 6vw, 3.15rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 0.98;
    text-wrap: balance;
  }
  h1:focus-visible {
    outline: 3px solid var(--color-cobalt-700);
    outline-offset: 0.3rem;
  }
  .intro-copy > p:last-child {
    max-width: 35rem;
    margin-top: 0.8rem;
    color: var(--color-ink-600);
    line-height: 1.55;
  }
  fieldset {
    border: 0;
    margin: 0;
    padding: 0;
  }
  input[type='radio'] {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .choice-grid {
    display: grid;
    gap: 0.7rem;
    margin-top: 1.5rem;
  }
  .choice-card {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.25rem 0.85rem;
    min-height: 5rem;
    border: 1px solid var(--color-line);
    border-radius: 0.35rem 1rem 0.35rem 0.35rem;
    background: white;
    padding: 0.85rem;
    cursor: pointer;
  }
  .choice-card:focus-within {
    outline: 3px solid var(--color-cobalt-700);
    outline-offset: 3px;
  }
  .choice-card.selected {
    border-color: var(--color-ink-950);
    background: var(--color-accent-100);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .choice-icon {
    display: grid;
    grid-row: 1 / 3;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    background: var(--color-paper-50);
  }
  .choice-card strong {
    font-size: 0.96rem;
  }
  .choice-card small {
    grid-column: 2;
    color: var(--color-ink-600);
    line-height: 1.35;
  }

  .choice-card.selected small {
    color: var(--color-ink-800);
  }
  .choice-check {
    display: grid;
    width: 1.55rem;
    height: 1.55rem;
    place-items: center;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    color: transparent;
    background: white;
  }
  .choice-card.selected .choice-check {
    border-color: var(--color-ink-950);
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }
  .next {
    width: 100%;
    margin-top: 1.2rem;
  }
  .level-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.55rem;
    margin-top: 1.5rem;
  }
  .level-grid label {
    display: grid;
    min-height: 3.2rem;
    place-items: center;
    border: 1px solid var(--color-line);
    border-radius: 0.35rem;
    background: white;
    cursor: pointer;
  }
  .level-grid label:focus-within {
    outline: 3px solid var(--color-cobalt-700);
    outline-offset: 2px;
  }
  .level-grid label.selected {
    border-color: var(--color-ink-950);
    background: var(--color-acid-500);
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .calibrate-button {
    display: grid;
    width: 100%;
    min-height: 4.6rem;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.8rem;
    margin-top: 0.85rem;
    border: 1px dashed var(--color-ink-600);
    border-radius: 0.35rem;
    color: var(--color-ink-950);
    background: var(--color-paper-50);
    padding: 0.75rem 0.9rem;
    text-align: left;
  }
  .calibrate-button span {
    display: grid;
    gap: 0.15rem;
  }
  .calibrate-button small {
    color: var(--color-ink-600);
  }
  .result-note {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin-top: 0.8rem;
    color: var(--color-mint-700);
    font-size: 0.84rem;
    line-height: 1.45;
  }
  .result-note :global(svg) {
    flex: none;
    margin-top: 0.1rem;
  }
  .button-row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.7rem;
    margin-top: 1.2rem;
  }
  .time-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
    margin-top: 1.5rem;
  }
  .time-grid label {
    display: grid;
    min-height: 7rem;
    place-items: center;
    align-content: center;
    gap: 0.35rem;
    border: 1px solid var(--color-line);
    border-radius: 0.35rem 1rem 0.35rem 0.35rem;
    background: white;
    cursor: pointer;
  }
  .time-grid label:focus-within {
    outline: 3px solid var(--color-cobalt-700);
    outline-offset: 3px;
  }
  .time-grid label.selected {
    border-color: var(--color-ink-950);
    background: var(--color-accent-100);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .time-grid strong {
    font-size: 1.05rem;
  }
  .time-grid small {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    text-transform: uppercase;
  }
  .plan-preview {
    display: grid;
    gap: 0.2rem;
    margin-top: 1rem;
    border-top: 1px solid var(--color-line);
    padding-top: 0.85rem;
  }
  .plan-preview span {
    color: var(--color-cobalt-700);
    font-weight: 800;
  }
  .plan-preview p {
    color: var(--color-ink-600);
    font-size: 0.8rem;
  }
  .finish-actions {
    display: grid;
    gap: 0.7rem;
    margin-top: 1.25rem;
  }
  .back-link {
    display: block;
    min-height: 2.75rem;
    margin: 0.6rem auto 0;
    border: 0;
    color: var(--color-ink-600);
    background: transparent;
    text-decoration: underline;
    text-underline-offset: 0.2rem;
  }
  .error-message {
    margin-top: 1rem;
    color: var(--color-coral-700);
    font-weight: 750;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  @media (max-width: 600px) {
    .onboarding-page {
      align-content: start;
    }
    .onboarding-header {
      grid-template-columns: 1fr auto;
    }
    .stepper {
      grid-column: 1 / 3;
      grid-row: 2;
      justify-content: center;
    }
    .step-copy {
      display: none;
    }
    .level-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .time-grid {
      grid-template-columns: 1fr;
    }
    .time-grid label {
      min-height: 4.7rem;
      grid-template-columns: auto auto;
      column-gap: 0.55rem;
    }
    .time-grid label small {
      grid-column: 1 / 3;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      scroll-behavior: auto !important;
    }
  }
</style>
