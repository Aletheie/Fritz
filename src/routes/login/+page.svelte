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
  import { browserLanguage, localized } from '$lib/i18n';
  import { onMount } from 'svelte';
  import { readable } from 'svelte/store';

  // Settings live behind sign-in, so the browser language picks the copy here.
  const language = browserLanguage();
  const tr = readable((cs: string, en: string) => localized(language, { cs, en }));

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
      ? $tr('Přístup je připravený', 'Access is ready')
      : enrollment
        ? $tr('Zabezpeč svůj Fritz', 'Secure your Fritz')
        : session?.setupRequired
          ? $tr('Tvůj osobní Fritz', 'Your personal Fritz')
          : $tr('Vítej zpátky', 'Welcome back'),
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
        if (!disposed) errorMessage = accessError(value, language);
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
      errorMessage = accessError(value, language);
    } finally {
      busy = false;
    }
  }
  async function enroll() {
    const result = await registerPasskey();
    recoveryCode = result.recoveryCode ?? '';
    if (!recoveryCode) await continueLearning();
  }

  const paragraph = 'leading-[1.6] text-ink-600';
  const field = 'field min-h-11 w-full';
</script>

<svelte:head>
  <title>{$tr('Osobní přístup', 'Personal access')} · Fritz</title>
  <meta
    name="description"
    content={$tr(
      'Bezpečný přístup k osobnímu Fritz pomocí passkey.',
      'Secure access to your personal Fritz with a passkey.',
    )}
  />
</svelte:head>

<main class="grid min-h-dvh place-items-center p-5">
  <section
    class="surface grid w-[min(100%,29rem)] gap-5 p-7"
    aria-labelledby="login-title"
    aria-busy={busy || checking}
  >
    <div class="flex items-center gap-3">
      <BrandMark size={48} /><strong class="text-[1.5rem] font-[850]">Fritz.</strong>
    </div>
    <h1 class="text-[1.75rem] leading-[1.2] font-[780] tracking-[-0.025em]" id="login-title">
      {title}
    </h1>
    {#if checking}
      <p class={paragraph} role="status">{$tr('Ověřuji přístup…', 'Checking access…')}</p>
    {:else if recoveryCode}
      <RecoveryCode code={recoveryCode} ondone={() => void continueLearning()} />
    {:else if enrollment}
      <p class={paragraph}>
        {$tr(
          'Vytvoř si passkey. Příště přístup potvrdíš přes Touch ID, Face ID nebo PIN zařízení.',
          'Create a passkey. Next time you confirm access with Touch ID, Face ID or your device PIN.',
        )}
      </p>
      {#if session?.enrollmentPurpose === 'recovery'}
        <p class={paragraph}>
          {$tr(
            'Po dokončení obnovy přestanou staré přístupy fungovat. Uložený pokrok a AI připojení zůstanou zachované.',
            'After recovery, old access stops working. Your saved progress and AI connection are kept.',
          )}
        </p>
      {/if}
      <button
        class="btn-base btn-primary"
        disabled={busy || !supported}
        onclick={() => void run(enroll)}
      >
        {busy ? $tr('Ověřuji…', 'Verifying…') : $tr('Vytvořit passkey', 'Create passkey')}
      </button>
    {:else if recoveryVisible}
      <form
        class="grid gap-3"
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
        <label for="recovery-input">{$tr('Obnovovací kód', 'Recovery code')}</label>
        <input
          id="recovery-input"
          class={field}
          type="password"
          bind:value={recovery}
          required
          autocomplete="off"
          autocapitalize="none"
          spellcheck="false"
          aria-describedby="recovery-help"
        />
        <p class={paragraph} id="recovery-help">
          {$tr(
            'Po ověření vytvoříš nový passkey. Pokud kód nemáš, můžeš obnovit přístup z vlastního serveru.',
            'After verification you create a new passkey. Without a code you can recover access from your own server.',
          )}
        </p>
        <button class="btn-base btn-primary" disabled={busy || !supported}
          >{busy ? $tr('Ověřuji…', 'Verifying…') : $tr('Obnovit přístup', 'Recover access')}</button
        >
        <button
          class="btn-base btn-secondary"
          type="button"
          disabled={busy}
          onclick={() => {
            recoveryVisible = false;
            recovery = '';
            errorMessage = '';
          }}>{$tr('Zpět', 'Back')}</button
        >
      </form>
    {:else if legacy}
      <p class={paragraph}>
        {$tr(
          'Přihlas se svým dosavadním účtem. V nastavení pak můžeš přejít na passkey.',
          'Sign in with your existing account. You can switch to a passkey in settings.',
        )}
      </p>
      <form
        class="grid gap-3"
        onsubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await login(username, password);
            password = '';
            await continueLearning();
          });
        }}
      >
        <label for="username">{$tr('Uživatelské jméno', 'Username')}</label>
        <input
          id="username"
          class={field}
          bind:value={username}
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          required
        />
        <label for="password">{$tr('Heslo', 'Password')}</label>
        <input
          id="password"
          class={field}
          type="password"
          bind:value={password}
          autocomplete="current-password"
          required
          aria-describedby={errorMessage ? 'login-error' : undefined}
          aria-invalid={Boolean(errorMessage)}
        />
        <button class="btn-base btn-primary" disabled={busy}
          >{busy ? $tr('Přihlašuji…', 'Signing in…') : $tr('Přihlásit se', 'Sign in')}</button
        >
      </form>
    {:else if session?.loginMethods?.includes('passkey')}
      <p class={paragraph}>
        {$tr(
          'Otevři svůj profil pomocí Touch ID, Face ID nebo PINu zařízení.',
          'Open your profile with Touch ID, Face ID or your device PIN.',
        )}
      </p>
      <button
        class="btn-base btn-primary"
        disabled={busy || !supported}
        onclick={() =>
          void run(async () => {
            await loginWithPasskey();
            await continueLearning();
          })}
      >
        {busy
          ? $tr('Ověřuji…', 'Verifying…')
          : $tr('Pokračovat s passkey', 'Continue with passkey')}
      </button>
    {:else if session?.setupRequired}
      <p class={paragraph}>
        {$tr(
          'Otevři soukromý aktivační odkaz z vlastního serveru. Potom si vytvoříš passkey a můžeš se začít učit.',
          'Open the private activation link from your own server. Then create a passkey and start learning.',
        )}
      </p>
    {:else if !errorMessage}
      <p class={paragraph}>{$tr('Přístup se nepodařilo načíst.', 'Access could not be loaded.')}</p>
    {/if}

    {#if !checking && !recoveryCode && !legacy && !supported}
      <p class="{paragraph} text-[0.875rem]">
        {$tr(
          'Passkeys vyžadují aktuální prohlížeč a zabezpečenou adresu. Otevři Fritz v Safari, Chromu nebo Firefoxu přes HTTPS; lokálně použij localhost.',
          'Passkeys need a current browser and a secure address. Open Fritz in Safari, Chrome or Firefox over HTTPS; locally use localhost.',
        )}
      </p>
    {/if}
    {#if errorMessage}<p
        id="login-error"
        class="rounded-[10px] bg-coral-50 p-[0.85rem] leading-[1.6] text-coral-700"
        role="alert"
      >
        {errorMessage}
      </p>{/if}
    {#if !checking && !session && errorMessage}
      <button class="btn-base btn-secondary" onclick={() => window.location.reload()}
        >{$tr('Zkusit znovu', 'Try again')}</button
      >
    {/if}
    {#if !checking && !recoveryCode && !enrollment}
      <div class="grid gap-4 border-t border-line pt-4">
        {#if !recoveryVisible && !session?.setupRequired}
          <button
            class="min-h-11 text-left underline"
            disabled={busy}
            onclick={() => {
              recoveryVisible = true;
              errorMessage = '';
            }}>{$tr('Použít obnovovací kód', 'Use a recovery code')}</button
          >
        {/if}
        <details>
          <summary class="cursor-pointer py-2"
            >{session?.setupRequired
              ? $tr('Jak získat aktivační odkaz', 'How to get an activation link')
              : $tr('Obnovit přístup ze serveru', 'Recover access from the server')}</summary
          >
          <p class="my-3 text-[0.875rem] {paragraph}">
            {$tr('Na svém serveru spusť jednou:', 'Run this once on your server:')}
          </p>
          <code class="block text-[0.8rem] [overflow-wrap:anywhere] whitespace-pre-wrap"
            >docker compose exec app node scripts/access-link.mjs{session?.setupRequired
              ? ''
              : ' --recover'}</code
          >
          <p class="my-3 text-[0.875rem] {paragraph}">
            {$tr(
              'Příkaz vypíše soukromý odkaz platný 10 minut. Otevři ho pouze na svém zařízení.',
              'The command prints a private link valid for 10 minutes. Open it only on your own device.',
            )}
          </p>
        </details>
      </div>
    {/if}
  </section>
</main>
