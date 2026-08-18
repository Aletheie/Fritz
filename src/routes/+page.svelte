<script lang="ts">
  import { onMount } from 'svelte';

  import BrandMark from '$lib/components/BrandMark.svelte';
  import LessonProgress from '$lib/components/LessonProgress.svelte';
  import LessonStep from '$lib/components/LessonStep.svelte';
  import OfflineStatus from '$lib/components/OfflineStatus.svelte';
  import StreakBadge from '$lib/components/StreakBadge.svelte';

  const steps = [
    {
      title: 'Rozcvička',
      detail: '3 slovíčka',
      minutes: 2,
      action: 'Dokončit rozcvičku',
    },
    {
      title: 'Jedna myšlenka',
      detail: 'slovosled ve větě',
      minutes: 2,
      action: 'Dokončit jednu myšlenku',
    },
    {
      title: 'Použij ji',
      detail: 'krátká vlastní věta',
      minutes: 1,
      action: 'Použít vlastní větu',
    },
  ];
  const totalMinutes = steps.reduce((total, step) => total + step.minutes, 0);

  function formatMinutes(minutes: number) {
    const unit = minutes === 1 ? 'minuta' : minutes >= 2 && minutes <= 4 ? 'minuty' : 'minut';
    return `${minutes} ${unit}`;
  }

  const lessonStorageKey = 'wortly:daily-lesson';

  function getTodayKey() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${today.getFullYear()}-${month}-${day}`;
  }

  let started = $state(false);
  let completedSteps = $state(0);
  let storageReady = $state(false);
  let lessonProgress = $derived(Math.round((completedSteps / steps.length) * 100));
  let remainingMinutes = $derived(
    steps.slice(completedSteps).reduce((total, step) => total + step.minutes, 0),
  );
  let currentStep = $derived(started && completedSteps < steps.length ? completedSteps : -1);
  let actionLabel = $derived(
    !started ? 'Začít dnešní lekci' : (steps[completedSteps]?.action ?? ''),
  );

  function advanceLesson() {
    if (!started) {
      started = true;
      return;
    }

    completedSteps = Math.min(completedSteps + 1, steps.length);
  }

  function resetLesson() {
    started = false;
    completedSteps = 0;
  }

  function restoreLesson() {
    try {
      const saved = JSON.parse(localStorage.getItem(lessonStorageKey) ?? 'null') as {
        date?: string;
        started?: boolean;
        completedSteps?: number;
      } | null;
      const savedSteps = saved?.completedSteps;

      if (
        !saved ||
        saved.date !== getTodayKey() ||
        typeof savedSteps !== 'number' ||
        !Number.isInteger(savedSteps)
      ) {
        return;
      }

      completedSteps = Math.min(Math.max(savedSteps, 0), steps.length);
      started = Boolean(saved.started) || completedSteps > 0;
    } catch {
      // A disabled or corrupt store should not block the lesson.
    }
  }

  onMount(() => {
    restoreLesson();
    storageReady = true;
  });

  $effect(() => {
    if (!storageReady) return;

    try {
      localStorage.setItem(
        lessonStorageKey,
        JSON.stringify({ date: getTodayKey(), started, completedSteps }),
      );
    } catch {
      // The lesson remains usable when browser storage is unavailable.
    }
  });
</script>

<svelte:head>
  <title>Dnešní lekce · Wortly</title>
  <meta name="description" content="Krátká každodenní cesta ke skutečnému použití němčiny." />
</svelte:head>

<div class="page-shell">
  <header class="topbar">
    <a class="brand" href="/" aria-label="Wortly, domů">
      <BrandMark size={32} />
      <span>Wortly</span>
    </a>

    <StreakBadge days={3} />
  </header>

  <OfflineStatus />

  <main id="main-content" class="home" tabindex="-1">
    <section class="intro" aria-labelledby="page-title">
      <p class="section-label">Dnešní lekce · {formatMinutes(totalMinutes)}</p>
      <h1 id="page-title">Jeden malý krok<br />pro němčinu.</h1>
      <p class="intro-copy">
        Krátká cesta, která spojí to, co už znáš, s větou, kterou dnes opravdu použiješ.
      </p>

      {#if completedSteps < steps.length}
        <button class="primary-action" type="button" onclick={advanceLesson}>
          {actionLabel}
          <span aria-hidden="true">{started ? '→' : '↗'}</span>
        </button>
      {:else}
        <div class="completion-state">
          <p class="completion" role="status">
            <span class="completion-mark" aria-hidden="true">✓</span>
            Celá lekce je hotová. Skvělá práce.
          </p>
          <button class="secondary-action" type="button" onclick={resetLesson}
            >Zopakovat lekci</button
          >
        </div>
      {/if}
    </section>

    <section class="lesson-panel" aria-labelledby="lesson-title">
      <div class="panel-heading">
        <div>
          <p class="section-label">Tvoje cesta</p>
          <h2 id="lesson-title">Heute in drei Schritten</h2>
        </div>
        <p class="duration">
          {remainingMinutes === 0 ? 'Hotovo' : `${formatMinutes(remainingMinutes)} zbývá`}
        </p>
      </div>

      <LessonProgress value={lessonProgress} completed={completedSteps} total={steps.length} />

      <ol class="steps" aria-label="Kroky dnešní lekce">
        {#each steps as step, index}
          <LessonStep
            title={step.title}
            detail={step.detail}
            minutes={step.minutes}
            {index}
            current={currentStep === index}
            complete={completedSteps > index}
          />
        {/each}
      </ol>

      <div class="panel-footer">
        <p><span class="status-dot" aria-hidden="true"></span> Bez klíče. Bez cloudu.</p>
        <span class="language-chip">DE · CS</span>
      </div>
    </section>
  </main>

  <footer class="footer-note">
    <span>Wortly</span>
    <span>Učení, které se vejde do dne.</span>
  </footer>
</div>

<style>
  .page-shell {
    display: flex;
    min-height: 100vh;
    flex-direction: column;
    padding: 1.25rem clamp(1.25rem, 4vw, 4rem) 1rem;
  }

  .topbar,
  .home,
  .footer-note {
    width: min(100%, 72rem);
    margin: 0 auto;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--line);
    padding-bottom: 1rem;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--ink);
    font-size: 1.05rem;
    font-weight: 760;
    letter-spacing: -0.02em;
    text-decoration: none;
  }

  .home {
    display: grid;
    flex: 1;
    align-items: center;
    gap: clamp(2.5rem, 8vw, 8rem);
    grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
    padding: clamp(4rem, 10vh, 8rem) 0 clamp(3rem, 8vh, 6rem);
  }

  .intro {
    max-width: 38rem;
  }

  .section-label {
    margin: 0 0 1.15rem;
    color: var(--cobalt);
    font-size: 0.8rem;
    font-weight: 720;
    letter-spacing: 0.01em;
  }

  h1,
  h2,
  p {
    text-wrap: balance;
  }

  h1 {
    max-width: 11ch;
    margin: 0;
    font-size: 4.75rem;
    font-weight: 760;
    letter-spacing: -0.035em;
    line-height: 0.96;
  }

  .intro-copy {
    max-width: 34rem;
    margin: 1.6rem 0 2rem;
    color: var(--ink-muted);
    font-size: 1.1rem;
    line-height: 1.5;
  }

  .primary-action {
    display: inline-flex;
    min-height: 3.15rem;
    align-items: center;
    gap: 0.8rem;
    border: 1px solid var(--ink);
    border-radius: 0.7rem;
    padding: 0.8rem 1.1rem;
    color: var(--ink);
    background: var(--accent);
    box-shadow: 4px 4px 0 var(--ink);
    font-weight: 760;
    transition:
      transform 160ms cubic-bezier(0.23, 1, 0.32, 1),
      box-shadow 160ms ease;
  }

  .primary-action:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0 var(--ink);
  }

  @media (hover: hover) and (pointer: fine) {
    .primary-action:hover {
      transform: translate(-1px, -1px);
      box-shadow: 5px 5px 0 var(--ink);
    }
  }

  .completion {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0;
    color: var(--success);
    font-weight: 700;
  }

  .completion-state {
    display: grid;
    justify-items: start;
    gap: 0.8rem;
  }

  .secondary-action {
    border: 0;
    padding: 0;
    color: var(--cobalt);
    background: transparent;
    font-size: 0.9rem;
    font-weight: 720;
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.2em;
  }

  .secondary-action:hover {
    color: var(--ink);
  }

  .completion-mark {
    display: grid;
    width: 1.6rem;
    height: 1.6rem;
    place-items: center;
    border-radius: 50%;
    color: var(--surface);
    background: var(--success);
    font-size: 0.85rem;
  }

  .lesson-panel {
    border: 1px solid var(--line);
    border-radius: 0.9rem;
    background: var(--surface);
  }

  .panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--line);
    padding: 1.4rem 1.35rem 1.25rem;
  }

  .panel-heading .section-label {
    margin-bottom: 0.55rem;
    color: var(--ink-muted);
  }

  h2 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 740;
    letter-spacing: -0.025em;
  }

  .duration {
    margin: 0;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
    font-size: 0.9rem;
  }

  .steps {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding: 0.75rem;
    list-style: none;
  }

  .panel-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-top: 1px solid var(--line);
    padding: 1rem 1.35rem;
  }

  .panel-footer p {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0;
    color: var(--ink-muted);
    font-size: 0.8rem;
  }

  .status-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: var(--success);
  }

  .language-chip {
    color: var(--ink-muted);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .footer-note {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid var(--line);
    padding-top: 0.85rem;
    color: var(--ink-muted);
    font-size: 0.78rem;
  }

  .footer-note span:first-child {
    color: var(--ink);
    font-weight: 700;
  }

  @media (max-width: 760px) {
    .page-shell {
      padding-inline: 1rem;
    }

    .home {
      align-content: start;
      gap: 3.5rem;
      grid-template-columns: 1fr;
      padding-top: 4.5rem;
    }

    h1 {
      max-width: 10ch;
      font-size: 3.6rem;
    }
  }

  @media (max-width: 420px) {
    .footer-note {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .primary-action {
      transition: none;
    }
  }
</style>
