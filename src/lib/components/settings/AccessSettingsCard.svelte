<script lang="ts">
  import { forgetRememberedAccess, getAuthSession, login } from '$lib/client/auth.ts';
  import { jsonRequest } from '$lib/client/http.ts';
  import {
    accessError,
    loginWithPasskey,
    registerPasskey,
    supportsPasskeys,
  } from '$lib/client/passkeys.ts';
  import { onMount } from 'svelte';
  import RecoveryCode from './RecoveryCode.svelte';

  type Passkey = { id: string; name: string; createdAt: string; current: boolean };
  let desktop = $state(false);
  let loading = $state(true);
  let busy = $state(false);
  let supported = $state(false);
  let keys = $state<Passkey[]>([]);
  let freshUntil = $state(0);
  let username = $state('');
  let password = $state('');
  let name = $state('Osobní passkey');
  let recoveryCode = $state('');
  let errorMessage = $state('');
  let message = $state('');
  let pendingRemoval = $state<string>();
  let confirmLogout = $state(false);

  async function refresh() {
    const session = await getAuthSession();
    desktop = session.accessMode === 'desktop';
    if (desktop) return;
    username = session.username ?? '';
    const result = await jsonRequest<{ passkeys: Passkey[]; freshUntil: number }>(
      '/api/auth/passkeys/',
    );
    keys = result.passkeys;
    freshUntil = result.freshUntil;
  }
  onMount(() => {
    supported = supportsPasskeys();
    void refresh()
      .catch((value) => {
        errorMessage = accessError(value);
      })
      .finally(() => {
        loading = false;
      });
  });
  async function ensureFresh() {
    if (keys.length && freshUntil > Date.now()) return;
    if (keys.length) await loginWithPasskey();
    else {
      await login(username, password);
      password = '';
    }
    await refresh();
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    busy = true;
    errorMessage = '';
    message = '';
    try {
      await ensureFresh();
      await action();
    } catch (value) {
      errorMessage = accessError(value);
    } finally {
      busy = false;
    }
  }
  async function add() {
    const result = await registerPasskey(name.trim() || 'Osobní passkey');
    recoveryCode = result.recoveryCode ?? '';
    message = 'Passkey je uložený. Přístup přes původní heslo se už nepoužívá.';
    await refresh();
  }
  async function remove(id: string) {
    const removingCurrent = keys.some((key) => key.id === id && key.current);
    await jsonRequest(`/api/auth/passkeys/${encodeURIComponent(id)}/`, { method: 'DELETE' });
    pendingRemoval = undefined;
    if (removingCurrent) {
      forgetRememberedAccess();
      window.location.replace('/login/');
    } else {
      await refresh();
      message = 'Passkey a jeho přihlášené relace jsou odebrané.';
    }
  }
</script>

{#if !desktop}
  <section
    id="access"
    class="surface access-settings"
    aria-labelledby="access-heading"
    aria-busy={busy}
  >
    <h2 id="access-heading">Přístup k osobnímu Fritz</h2>
    <p>
      Jeden profil pro tvoje zařízení. Passkey umožní přístup i k uloženému AI připojení. Studijní
      pokrok zůstává v každém prohlížeči zvlášť.
    </p>
    {#if loading}
      <p role="status">Načítám zabezpečení…</p>
    {:else}
      {#if keys.length}
        <ul>
          {#each keys as key (key.id)}
            <li>
              <div>
                <strong>{key.name}</strong><small
                  >{key.current ? 'Použitý pro toto přihlášení' : 'Uložený přístup'}</small
                >
              </div>
              {#if pendingRemoval === key.id}
                <div class="actions">
                  <span>Odhlásí také zařízení přihlášená tímto passkey.</span>
                  <button
                    class="btn-base btn-secondary"
                    disabled={busy}
                    onclick={() => void run(() => remove(key.id))}>Potvrdit odebrání</button
                  >
                  <button
                    class="btn-base btn-secondary"
                    disabled={busy}
                    onclick={() => {
                      pendingRemoval = undefined;
                    }}>Zrušit</button
                  >
                </div>
              {:else}
                <button
                  class="btn-base btn-secondary"
                  disabled={busy || keys.length === 1}
                  aria-describedby={keys.length === 1 ? 'last-passkey-help' : undefined}
                  onclick={() => {
                    pendingRemoval = key.id;
                  }}>Odebrat</button
                >
              {/if}
            </li>
          {/each}
        </ul>
        {#if keys.length === 1}<p id="last-passkey-help" class="help">
            Poslední passkey můžeš odebrat až po přidání náhradního.
          </p>{/if}
      {/if}
      <form
        onsubmit={(event) => {
          event.preventDefault();
          void run(add);
        }}
      >
        {#if !keys.length}
          <p>
            Dosavadní heslo potvrď naposledy. Po vytvoření passkey se původní přihlášení odpojí a
            uložený pokrok zůstane zachovaný.
          </p>
          <label for="access-username">Uživatelské jméno</label>
          <input
            id="access-username"
            class="field"
            bind:value={username}
            autocomplete="username"
            required
          />
          <label for="access-password">Dosavadní heslo</label>
          <input
            id="access-password"
            class="field"
            type="password"
            bind:value={password}
            autocomplete="current-password"
            required
            aria-describedby={errorMessage ? 'access-error' : undefined}
          />
        {/if}
        <label for="passkey-name">Název passkey</label>
        <input
          id="passkey-name"
          class="field"
          bind:value={name}
          maxlength="80"
          required
          autocomplete="off"
        />
        <button class="btn-base btn-primary" disabled={busy || !supported || keys.length >= 20}>
          {busy ? 'Ověřuji…' : keys.length ? 'Přidat passkey' : 'Přejít na passkey'}
        </button>
      </form>
      {#if !supported}<p class="help">
          Pro passkey otevři Fritz v aktuálním prohlížeči přes HTTPS; lokálně použij localhost.
        </p>{/if}
      {#if keys.length}
        <div class="actions">
          <button
            class="btn-base btn-secondary"
            disabled={busy || !supported}
            onclick={() =>
              void run(async () => {
                const result = await jsonRequest<{ recoveryCode: string }>(
                  '/api/auth/recovery-code/',
                  { method: 'POST' },
                );
                recoveryCode = result.recoveryCode;
                message = 'Nový obnovovací kód nahradil předchozí.';
              })}>Vytvořit nový obnovovací kód</button
          >
          <button
            class="btn-base btn-secondary"
            disabled={busy}
            onclick={() => {
              confirmLogout = true;
            }}>Odhlásit všechna zařízení</button
          >
        </div>
        {#if confirmLogout}
          <div class="confirmation">
            <p>Odhlásí se i tento prohlížeč. Uložené AI připojení zůstane zachované.</p>
            <div class="actions">
              <button
                class="btn-base btn-secondary"
                disabled={busy}
                onclick={() =>
                  void run(async () => {
                    await jsonRequest('/api/auth/logout-all/', { method: 'POST' });
                    forgetRememberedAccess();
                    window.location.replace('/login/');
                  })}>Potvrdit odhlášení</button
              >
              <button
                class="btn-base btn-secondary"
                disabled={busy}
                onclick={() => {
                  confirmLogout = false;
                }}>Zrušit</button
              >
            </div>
          </div>
        {/if}
      {/if}
      {#if recoveryCode}<RecoveryCode
          code={recoveryCode}
          ondone={() => {
            recoveryCode = '';
          }}
        />{/if}
    {/if}
    {#if errorMessage}<p id="access-error" class="error" role="alert">{errorMessage}</p>{/if}
    {#if message}<p role="status">{message}</p>{/if}
  </section>
{/if}

<style>
  .access-settings {
    padding: 1.5rem;
    display: grid;
    gap: 1.25rem;
  }
  h2 {
    font-size: 1.25rem;
    font-weight: 750;
  }
  p {
    max-width: 65ch;
    color: var(--color-ink-600);
    line-height: 1.6;
  }
  form {
    display: grid;
    gap: 0.75rem;
    max-width: 28rem;
  }
  ul {
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding-block: 1rem;
    border-bottom: 1px solid var(--color-line);
  }
  small {
    display: block;
    color: var(--color-ink-600);
    margin-top: 0.25rem;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
  }
  .help {
    font-size: 0.875rem;
  }
  .confirmation {
    display: grid;
    gap: 0.75rem;
  }
  .error {
    color: var(--color-coral-700);
  }
  .field {
    min-height: 44px;
    width: 100%;
  }
</style>
