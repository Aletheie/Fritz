<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getAuthSession, login } from '$lib/client/auth.ts';
  import type { AuthResponse } from '$lib/client/auth.ts';
  import {
    accessError,
    exchangeAccessToken,
    loginWithPasskey,
    registerPasskey,
    supportsPasskeys,
  } from '$lib/client/passkeys.ts';
  import BrandMark from '$lib/components/BrandMark.svelte';
  import RecoveryCode from '$lib/components/settings/RecoveryCode.svelte';
  import { onMount } from 'svelte';

  let session = $state<AuthResponse>();
  let username = $state('');
  let password = $state('');
  let recovery = $state('');
  let recoveryVisible = $state(false);
  let recoveryCode = $state('');
  let busy = $state(false);
  let checking = $state(true);
  let supported = $state(false);
  let errorMessage = $state('');
  const redirectTarget = $derived.by(() => {
    const value = page.url.searchParams.get('redirect');
    if (!value?.startsWith('/')) return '/';
    try {
      const target = new URL(value, page.url);
      return target.origin === page.url.origin
        ? `${target.pathname}${target.search}${target.hash}`
        : '/';
    } catch {
      return '/';
    }
  });
  const enrollment = $derived(session?.enrollmentPending);
  const legacy = $derived(session?.loginMethods?.includes('password'));
  const title = $derived(
    recoveryCode
      ? 'Přístup je připravený'
      : enrollment
        ? 'Zabezpeč svůj Fritz'
        : session?.setupRequired
          ? 'Tvůj osobní Fritz'
          : 'Vítej zpátky',
  );

  function continueLearning() {
    return goto(redirectTarget, { replaceState: true });
  }

  onMount(() => {
    supported = supportsPasskeys();
    let disposed = false;
    let pending = Promise.resolve();
    async function refreshSession() {
      if (disposed) return;
      checking = true;
      errorMessage = '';
      const token = new URLSearchParams(window.location.hash.slice(1)).get('setup');
      if (token)
        window.history.replaceState(
          window.history.state,
          '',
          `${page.url.pathname}${page.url.search}`,
        );
      try {
        if (token) await exchangeAccessToken(token);
        const current = await getAuthSession();
        if (disposed) return;
        session = current;
        if (session.authenticated && !session.enrollmentPending) await continueLearning();
      } catch (value) {
        if (!disposed) errorMessage = accessError(value);
      } finally {
        if (!disposed) checking = false;
      }
    }
    const refresh = () => {
      pending = pending.then(refreshSession);
    };
    refresh();
    window.addEventListener('hashchange', refresh);
    return () => {
      disposed = true;
      window.removeEventListener('hashchange', refresh);
    };
  });

  async function run(action: () => Promise<void>) {
    if (busy) return;
    busy = true;
    errorMessage = '';
    try {
      await action();
    } catch (value) {
      errorMessage = accessError(value);
    } finally {
      busy = false;
    }
  }
  async function enroll() {
    const result = await registerPasskey();
    recoveryCode = result.recoveryCode ?? '';
    if (!recoveryCode) await continueLearning();
  }
</script>

<svelte:head>
  <title>Osobní přístup · Fritz</title>
  <meta name="description" content="Bezpečný přístup k osobnímu Fritz pomocí passkey." />
</svelte:head>

<main class="login-page">
  <section class="login-card surface" aria-labelledby="login-title" aria-busy={busy || checking}>
    <div class="brand-lockup"><BrandMark size={48} /><strong>Fritz<span>.</span></strong></div>
    <h1 id="login-title">{title}</h1>
    {#if checking}
      <p role="status">Ověřuji přístup…</p>
    {:else if recoveryCode}
      <RecoveryCode code={recoveryCode} ondone={() => void continueLearning()} />
    {:else if enrollment}
      <p>Vytvoř si passkey. Příště přístup potvrdíš přes Touch ID, Face ID nebo PIN zařízení.</p>
      {#if session?.enrollmentPurpose === 'recovery'}
        <p>
          Po dokončení obnovy přestanou staré přístupy fungovat. Uložený pokrok a AI připojení
          zůstanou zachované.
        </p>
      {/if}
      <button
        class="btn-base btn-primary"
        disabled={busy || !supported}
        onclick={() => void run(enroll)}
      >
        {busy ? 'Ověřuji…' : 'Vytvořit passkey'}
      </button>
    {:else if recoveryVisible}
      <form
        onsubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await exchangeAccessToken(recovery.trim(), true);
            recovery = '';
            session = await getAuthSession();
            recoveryVisible = false;
          });
        }}
      >
        <label for="recovery-input">Obnovovací kód</label>
        <input
          id="recovery-input"
          class="field"
          type="password"
          bind:value={recovery}
          required
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          aria-describedby="recovery-help"
        />
        <p id="recovery-help">
          Po ověření vytvoříš nový passkey. Pokud kód nemáš, můžeš obnovit přístup z vlastního
          serveru.
        </p>
        <button class="btn-base btn-primary" disabled={busy || !supported}
          >{busy ? 'Ověřuji…' : 'Obnovit přístup'}</button
        >
        <button
          class="btn-base btn-secondary"
          type="button"
          disabled={busy}
          onclick={() => {
            recoveryVisible = false;
            recovery = '';
            errorMessage = '';
          }}>Zpět</button
        >
      </form>
    {:else if legacy}
      <p>Přihlas se svým dosavadním účtem. V nastavení pak můžeš přejít na passkey.</p>
      <form
        onsubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await login(username, password);
            password = '';
            await continueLearning();
          });
        }}
      >
        <label for="username">Uživatelské jméno</label>
        <input
          id="username"
          class="field"
          bind:value={username}
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          required
        />
        <label for="password">Heslo</label>
        <input
          id="password"
          class="field"
          type="password"
          bind:value={password}
          autocomplete="current-password"
          required
          aria-describedby={errorMessage ? 'login-error' : undefined}
          aria-invalid={Boolean(errorMessage)}
        />
        <button class="btn-base btn-primary" disabled={busy}
          >{busy ? 'Přihlašuji…' : 'Přihlásit se'}</button
        >
      </form>
    {:else if session?.loginMethods?.includes('passkey')}
      <p>Otevři svůj profil pomocí Touch ID, Face ID nebo PINu zařízení.</p>
      <button
        class="btn-base btn-primary"
        disabled={busy || !supported}
        onclick={() =>
          void run(async () => {
            await loginWithPasskey();
            await continueLearning();
          })}
      >
        {busy ? 'Ověřuji…' : 'Pokračovat s passkey'}
      </button>
    {:else if session?.setupRequired}
      <p>
        Otevři soukromý aktivační odkaz z vlastního serveru. Potom si vytvoříš passkey a můžeš se
        začít učit.
      </p>
    {:else if !errorMessage}
      <p>Přístup se nepodařilo načíst.</p>
    {/if}

    {#if !checking && !recoveryCode && !legacy && !supported}
      <p class="support-note">
        Passkeys vyžadují aktuální prohlížeč a zabezpečenou adresu. Otevři Fritz v Safari, Chromu
        nebo Firefoxu přes HTTPS; lokálně použij localhost.
      </p>
    {/if}
    {#if errorMessage}<p id="login-error" class="login-error" role="alert">{errorMessage}</p>{/if}
    {#if !checking && !session && errorMessage}
      <button class="btn-base btn-secondary" onclick={() => window.location.reload()}
        >Zkusit znovu</button
      >
    {/if}
    {#if !checking && !recoveryCode && !enrollment}
      <div class="access-help">
        {#if !recoveryVisible && !session?.setupRequired}
          <button
            class="text-button"
            disabled={busy}
            onclick={() => {
              recoveryVisible = true;
              errorMessage = '';
            }}>Použít obnovovací kód</button
          >
        {/if}
        <details>
          <summary
            >{session?.setupRequired
              ? 'Jak získat aktivační odkaz'
              : 'Obnovit přístup ze serveru'}</summary
          >
          <p>Na svém serveru spusť jednou:</p>
          <code
            >docker compose exec app node scripts/access-link.mjs{session?.setupRequired
              ? ''
              : ' --recover'}</code
          >
          <p>Příkaz vypíše soukromý odkaz platný 10 minut. Otevři ho pouze na svém zařízení.</p>
        </details>
      </div>
    {/if}
  </section>
</main>

<style>
  .login-page {
    display: grid;
    min-height: 100dvh;
    place-items: center;
    padding: 1.25rem;
  }
  .login-card {
    display: grid;
    gap: 1.25rem;
    width: min(100%, 29rem);
    padding: 1.75rem;
  }
  .brand-lockup {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .brand-lockup strong {
    font-size: 1.5rem;
    font-weight: 850;
  }
  .brand-lockup span {
    color: var(--color-acid-600);
  }
  h1 {
    font-size: 1.75rem;
    font-weight: 780;
    letter-spacing: -0.025em;
    line-height: 1.2;
  }
  p {
    color: var(--color-ink-600);
    line-height: 1.6;
  }
  form {
    display: grid;
    gap: 0.75rem;
  }
  .field {
    width: 100%;
    min-height: 44px;
  }
  .login-error {
    color: var(--color-coral-700);
    background: var(--color-coral-50);
    padding: 0.85rem;
    border-radius: 10px;
  }
  .access-help {
    display: grid;
    gap: 1rem;
    border-top: 1px solid var(--color-line);
    padding-top: 1rem;
  }
  .text-button {
    text-align: left;
    text-decoration: underline;
    min-height: 44px;
  }
  summary {
    cursor: pointer;
    padding-block: 0.5rem;
  }
  details p {
    margin-block: 0.75rem;
    font-size: 0.875rem;
  }
  code {
    display: block;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 0.8rem;
  }
  .support-note {
    font-size: 0.875rem;
  }
</style>
