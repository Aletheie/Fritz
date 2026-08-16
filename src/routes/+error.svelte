<script lang="ts">
  import { page } from '$app/state';

  let title = $derived(page.status === 404 ? 'Tahle stránka tu není.' : 'Tady se něco pokazilo.');
  let description = $derived(
    page.status === 404
      ? 'Odkaz už nemusí platit, ale tvoje učení zůstává v bezpečí.'
      : 'Zkus stránku načíst znovu. Tvoje lokální data zůstávají v zařízení.',
  );
</script>

<svelte:head>
  <title>{title} · Wortly</title>
  <meta name="description" content={description} />
</svelte:head>

<main class="error-page" aria-labelledby="error-title">
  <div class="error-content">
    <span class="error-mark" aria-hidden="true">!</span>
    <p class="error-code">Chyba {page.status}</p>
    <h1 id="error-title">{title}</h1>
    <p class="error-description">{description}</p>

    <div class="error-actions">
      <button class="primary-action" type="button" onclick={() => location.reload()}>
        Načíst znovu
      </button>
      <a class="secondary-action" href="/">Zpět na dnešek</a>
    </div>
  </div>
</main>

<style>
  .error-page {
    display: grid;
    min-height: 100vh;
    place-items: center;
    padding: 2rem 1.25rem;
    background: var(--paper);
  }

  .error-content {
    width: min(100%, 34rem);
    text-align: center;
  }

  .error-mark {
    display: grid;
    width: 3.5rem;
    height: 3.5rem;
    margin: 0 auto 1.4rem;
    place-items: center;
    border: 1px solid var(--danger);
    border-radius: 50%;
    color: var(--danger);
    font-size: 1.6rem;
    font-weight: 800;
  }

  .error-code {
    margin: 0 0 0.65rem;
    color: var(--danger);
    font-size: 0.8rem;
    font-weight: 750;
    letter-spacing: 0.04em;
  }

  h1 {
    margin: 0;
    font-size: 2.35rem;
    font-weight: 760;
    letter-spacing: -0.035em;
    line-height: 1.05;
    text-wrap: balance;
  }

  .error-description {
    max-width: 31rem;
    margin: 1rem auto 0;
    color: var(--ink-muted);
    font-size: 1.05rem;
    line-height: 1.5;
    text-wrap: balance;
  }

  .error-actions {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 2rem;
  }

  .primary-action,
  .secondary-action {
    display: inline-flex;
    min-height: 2.9rem;
    align-items: center;
    justify-content: center;
    border-radius: 0.7rem;
    padding: 0.75rem 1rem;
    font-size: 0.95rem;
    font-weight: 720;
    text-decoration: none;
  }

  .primary-action {
    border: 1px solid var(--ink);
    color: var(--ink);
    background: var(--accent);
    box-shadow: 3px 3px 0 var(--ink);
  }

  .secondary-action {
    border: 1px solid var(--line);
    color: var(--ink);
    background: var(--surface);
  }

  .primary-action:active {
    transform: translate(1px, 1px);
    box-shadow: 2px 2px 0 var(--ink);
  }

  @media (max-width: 420px) {
    .error-actions {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
