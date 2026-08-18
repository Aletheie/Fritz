<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import { onMount } from 'svelte';

  import { getAuthSession, login } from '$lib/client/auth.ts';
  import BrandMark from '$lib/components/BrandMark.svelte';

  let username = $state('');
  let password = $state('');
  let busy = $state(false);
  let checking = $state(true);
  let errorMessage = $state('');

  const redirectTarget = $derived.by(() => {
    const value = page.url.searchParams.get('redirect');
    return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
  });

  onMount(async () => {
    try {
      const session = await getAuthSession();
      if (session.authenticated) await goto(redirectTarget, { replaceState: true });
    } catch {
      // The login form remains usable when the session probe is unavailable.
    } finally {
      checking = false;
    }
  });

  async function submit(): Promise<void> {
    if (busy || !username.trim() || !password) return;
    busy = true;
    errorMessage = '';
    try {
      await login(username, password);
      await goto(redirectTarget, { replaceState: true });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Přihlášení se nepodařilo.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Přihlášení · Wortly</title>
  <meta name="description" content="Soukromé přihlášení do Wortly." />
</svelte:head>

<main class="login-page">
  <section class="login-card surface" aria-labelledby="login-title">
    <div class="brand-lockup">
      <BrandMark size={52} />
      <div>
        <strong>Wortly<span>.</span></strong>
        <small>němčina, která drží krok</small>
      </div>
    </div>

    <div class="login-intro">
      <span class="login-icon" aria-hidden="true"><LockKeyhole size={21} /></span>
      <p class="kicker">soukromý přístup</p>
      <h1 id="login-title">Vítej zpátky</h1>
      <p>Přihlas se ke svému osobnímu Wortly.</p>
    </div>

    <form
      onsubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label class="field-label" for="username">
        <span>Uživatelské jméno</span>
        <input
          id="username"
          class="field"
          type="text"
          bind:value={username}
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          required
          aria-describedby="login-help"
        />
      </label>

      <label class="field-label" for="password">
        <span>Heslo</span>
        <input
          id="password"
          class="field"
          type="password"
          bind:value={password}
          autocomplete="current-password"
          required
          aria-describedby={errorMessage ? 'login-error' : 'login-help'}
          aria-invalid={errorMessage ? 'true' : undefined}
        />
      </label>

      <p id="login-help" class="login-help">Přístup je určený pro jeden účet tohoto nasazení.</p>

      {#if errorMessage}
        <p id="login-error" class="login-error" role="alert">{errorMessage}</p>
      {/if}

      <button class="btn-base btn-primary login-submit" type="submit" disabled={busy || checking}>
        {#if busy}<LoaderCircle class="spin" size={18} />{:else}<KeyRound size={18} />{/if}
        {busy ? 'Přihlašuji…' : checking ? 'Ověřuji přístup…' : 'Přihlásit se'}
        {#if !busy && !checking}<ArrowRight size={18} />{/if}
      </button>
    </form>

    <p class="login-note">
      Registrace není veřejná. Účet vytvoří správce příkazem v Docker terminálu.
    </p>
  </section>
</main>

<style>
  .login-page {
    display: grid;
    min-height: 100dvh;
    place-items: center;
    padding: 1rem;
    background:
      radial-gradient(circle at 15% 0%, rgb(196 245 112 / 0.28), transparent 35%),
      var(--color-paper-100);
  }
  .login-card {
    width: min(100%, 28rem);
    padding: clamp(1.4rem, 5vw, 2.6rem);
  }
  .brand-lockup {
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }
  .brand-lockup div {
    display: grid;
    gap: 0.15rem;
  }
  .brand-lockup strong {
    font-size: 1.35rem;
    font-weight: 900;
    letter-spacing: -0.05em;
  }
  .brand-lockup strong span {
    color: var(--color-acid-600);
  }
  .brand-lockup small,
  .login-help,
  .login-note {
    color: var(--color-ink-600);
    font-size: 0.75rem;
  }
  .login-intro {
    margin: 2.5rem 0 1.7rem;
  }
  .login-icon {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border-radius: 0.85rem;
    color: var(--color-ink-950);
    background: var(--color-acid-400);
  }
  .login-intro .kicker {
    margin-top: 1.1rem;
  }
  .login-intro h1 {
    margin-top: 0.35rem;
    font-size: clamp(2rem, 8vw, 3rem);
    font-weight: 900;
    letter-spacing: -0.06em;
    line-height: 0.98;
  }
  .login-intro p:last-child {
    margin-top: 0.7rem;
    color: var(--color-ink-600);
  }
  form {
    display: grid;
    gap: 1rem;
  }
  .field-label > span {
    display: block;
    margin-bottom: 0.4rem;
    color: var(--color-ink-600);
    font-size: 0.82rem;
    font-weight: 740;
  }
  .login-help {
    margin-top: -0.15rem;
    line-height: 1.45;
  }
  .login-error {
    border-radius: 0.7rem;
    color: var(--color-coral-700);
    background: var(--color-coral-50);
    padding: 0.75rem;
    font-size: 0.82rem;
    line-height: 1.45;
  }
  .login-submit {
    width: 100%;
    justify-content: center;
  }
  .login-note {
    margin-top: 1.5rem;
    border-top: 1px solid var(--color-line);
    padding-top: 1rem;
    line-height: 1.5;
  }
</style>
