<script lang="ts">
  import ProgressBar from '$lib/components/ProgressBar.svelte';

  const steps = [
    { title: 'Rozcvička', detail: '3 slovíčka', time: '2 min' },
    { title: 'Jedna myšlenka', detail: 'slovosled ve větě', time: '2 min' },
    { title: 'Použij ji', detail: 'krátká vlastní věta', time: '1 min' },
  ];

  let started = $state(false);
  let warmupDone = $state(false);
  let lessonProgress = $derived(warmupDone ? 100 : started ? 33 : 0);
</script>

<svelte:head>
  <title>Dnešní lekce · Wortly</title>
  <meta name="description" content="Krátká každodenní cesta ke skutečnému použití němčiny." />
</svelte:head>

<div class="page-shell">
  <header class="topbar">
    <a class="brand" href="/" aria-label="Wortly, domů">
      <span class="brand-mark" aria-hidden="true">W</span>
      <span>Wortly</span>
    </a>

    <p class="streak"><span aria-hidden="true">✦</span> 3 dny v řadě</p>
  </header>

  <main id="main-content" class="home" tabindex="-1">
    <section class="intro" aria-labelledby="page-title">
      <p class="section-label">Dnešní lekce · 5 minut</p>
      <h1 id="page-title">Jeden malý krok<br />pro němčinu.</h1>
      <p class="intro-copy">
        Krátká cesta, která spojí to, co už znáš, s větou, kterou dnes opravdu použiješ.
      </p>

      {#if !started}
        <button class="primary-action" type="button" onclick={() => (started = true)}>
          Začít dnešní lekci
          <span aria-hidden="true">↗</span>
        </button>
      {:else if !warmupDone}
        <button class="primary-action" type="button" onclick={() => (warmupDone = true)}>
          Dokončit rozcvičku
          <span aria-hidden="true">→</span>
        </button>
      {:else}
        <p class="completion" role="status">
          <span class="completion-mark" aria-hidden="true">✓</span>
          Rozcvička je hotová. Další krok čeká.
        </p>
      {/if}
    </section>

    <section class="lesson-panel" aria-labelledby="lesson-title">
      <div class="panel-heading">
        <div>
          <p class="section-label">Tvoje cesta</p>
          <h2 id="lesson-title">Heute in drei Schritten</h2>
        </div>
        <p class="duration">5 min</p>
      </div>

      <div class="panel-progress">
        <ProgressBar value={lessonProgress} label="Postup dnešní lekce" />
        <span>{lessonProgress}%</span>
      </div>

      <ol class="steps">
        {#each steps as step, index}
          <li class:current={started && index === 0} class:complete={warmupDone && index === 0}>
            <span class="step-number" aria-hidden="true">
              {#if warmupDone && index === 0}✓{:else}{index + 1}{/if}
            </span>
            <span class="step-copy">
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </span>
            <span class="step-time">{step.time}</span>
          </li>
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

  .brand-mark {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 1px solid var(--ink);
    border-radius: 0.6rem;
    background: var(--accent);
    box-shadow: 2px 2px 0 var(--ink);
    font-size: 0.9rem;
    font-weight: 850;
  }

  .streak {
    margin: 0;
    color: var(--ink-muted);
    font-size: 0.875rem;
  }

  .streak span {
    color: var(--cobalt);
    margin-right: 0.25rem;
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

  .panel-progress {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.35rem 0.25rem;
  }

  .panel-progress :global(.progress-track) {
    flex: 1;
  }

  .panel-progress > span {
    width: 2.4rem;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
    font-size: 0.78rem;
    text-align: right;
  }

  .steps {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding: 0.75rem;
    list-style: none;
  }

  .steps li {
    display: grid;
    align-items: center;
    gap: 0.8rem;
    grid-template-columns: 2rem minmax(0, 1fr) auto;
    border-radius: 0.65rem;
    padding: 0.8rem 0.6rem;
  }

  .steps li.current {
    background: var(--accent-soft);
  }

  .steps li.complete {
    color: var(--success);
  }

  .step-number {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 50%;
    color: var(--ink-muted);
    background: var(--paper);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .current .step-number {
    border-color: var(--ink);
    color: var(--ink);
    background: var(--accent);
  }

  .complete .step-number {
    border-color: var(--success);
    color: var(--surface);
    background: var(--success);
  }

  .step-copy {
    display: grid;
    gap: 0.15rem;
  }

  .step-copy strong {
    color: var(--ink);
    font-size: 0.98rem;
  }

  .step-copy span,
  .step-time {
    color: var(--ink-muted);
    font-size: 0.82rem;
  }

  .complete .step-copy strong {
    color: var(--success);
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
    .streak {
      font-size: 0.78rem;
    }

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
