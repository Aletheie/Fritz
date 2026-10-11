<script lang="ts">
  import { forgetRememberedAccess, getAuthSession, login } from '$lib/client/auth.ts';
  import { jsonRequest } from '$lib/client/http.ts';
  import {
    accessError,
    loginWithPasskey,
    registerPasskey,
    supportsPasskeys,
  } from '$lib/client/passkeys.ts';
  import { motherTongue, tr } from '$lib/state/app';
  import { onMount } from 'svelte';
  import RecoveryCode from './RecoveryCode.svelte';

  type Passkey = { id: string; name: string; createdAt: string; current: boolean };
  let desktop = $state(false);
  let loading = $state(true);
  let busy = $state(false);
  let supported = $state(false);
  let keys = $state.raw<Passkey[]>([]);
  let freshUntil = $state(0);
  let username = $state('');
  let password = $state('');
  let name = $state($tr('Osobní passkey', 'Personal passkey'));
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
        errorMessage = accessError(value, $motherTongue);
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
      errorMessage = accessError(value, $motherTongue);
    } finally {
      busy = false;
    }
  }
  async function add() {
    const result = await registerPasskey(name.trim() || $tr('Osobní passkey', 'Personal passkey'));
    recoveryCode = result.recoveryCode ?? '';
    message = $tr(
      'Passkey je uložený. Přístup přes původní heslo se už nepoužívá.',
      'The passkey is saved. The old password sign-in is no longer used.',
    );
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
      message = $tr(
        'Passkey a jeho přihlášené relace jsou odebrané.',
        'The passkey and its signed-in sessions were removed.',
      );
    }
  }
</script>

{#if !desktop}
  <section
    id="access"
    class="surface grid gap-5 p-6"
    aria-labelledby="access-heading"
    aria-busy={busy}
  >
    <h2 class="text-[1.25rem] font-[750]" id="access-heading">
      {$tr('Přístup k osobnímu Fritz', 'Access to your personal Fritz')}
    </h2>
    <p class="max-w-[65ch] leading-[1.6] text-ink-600">
      {$tr(
        'Jeden profil pro tvoje zařízení. Passkey umožní přístup i k uloženému AI připojení. Studijní pokrok zůstává v každém prohlížeči zvlášť.',
        'One profile for your devices. A passkey also unlocks your saved AI connection. Study progress stays separate in each browser.',
      )}
    </p>
    {#if loading}
      <p class="max-w-[65ch] leading-[1.6] text-ink-600" role="status">
        {$tr('Načítám zabezpečení…', 'Loading security…')}
      </p>
    {:else}
      {#if keys.length}
        <ul class="list-none p-0">
          {#each keys as key (key.id)}
            <li class="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4">
              <div>
                <strong>{key.name}</strong><small class="mt-1 block text-ink-600"
                  >{key.current
                    ? $tr('Použitý pro toto přihlášení', 'Used for this sign-in')
                    : $tr('Uložený přístup', 'Saved access')}</small
                >
              </div>
              {#if pendingRemoval === key.id}
                <div class="flex flex-wrap items-center gap-3">
                  <span
                    >{$tr(
                      'Odhlásí také zařízení přihlášená tímto passkey.',
                      'Also signs out devices that used this passkey.',
                    )}</span
                  >
                  <button
                    class="btn-base btn-secondary"
                    disabled={busy}
                    onclick={() => void run(() => remove(key.id))}
                    >{$tr('Potvrdit odebrání', 'Confirm removal')}</button
                  >
                  <button
                    class="btn-base btn-secondary"
                    disabled={busy}
                    onclick={() => {
                      pendingRemoval = undefined;
                    }}>{$tr('Zrušit', 'Cancel')}</button
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
        {#if keys.length === 1}<p
            id="last-passkey-help"
            class="max-w-[65ch] text-[0.875rem] leading-[1.6] text-ink-600"
          >
            {$tr(
              'Poslední passkey můžeš odebrat až po přidání náhradního.',
              'You can remove your last passkey only after adding another one.',
            )}
          </p>{/if}
      {/if}
      <form
        class="grid max-w-md gap-3"
        onsubmit={(event) => {
          event.preventDefault();
          void run(add);
        }}
      >
        {#if !keys.length}
          <p class="max-w-[65ch] leading-[1.6] text-ink-600">
            {$tr(
              'Dosavadní heslo potvrď naposledy. Po vytvoření passkey se původní přihlášení odpojí a uložený pokrok zůstane zachovaný.',
              'Confirm your current password one last time. After you create a passkey, the old sign-in is disconnected and your progress is kept.',
            )}
          </p>
          <label for="access-username">{$tr('Uživatelské jméno', 'Username')}</label>
          <input
            id="access-username"
            class="field min-h-11 w-full"
            bind:value={username}
            autocomplete="username"
            required
          />
          <label for="access-password">{$tr('Dosavadní heslo', 'Current password')}</label>
          <input
            id="access-password"
            class="field min-h-11 w-full"
            type="password"
            bind:value={password}
            autocomplete="current-password"
            required
            aria-describedby={errorMessage ? 'access-error' : undefined}
          />
        {/if}
        <label for="passkey-name">{$tr('Název passkey', 'Passkey name')}</label>
        <input
          id="passkey-name"
          class="field min-h-11 w-full"
          bind:value={name}
          maxlength="80"
          required
          autocomplete="off"
        />
        <button class="btn-base btn-primary" disabled={busy || !supported || keys.length >= 20}>
          {busy
            ? $tr('Ověřuji…', 'Verifying…')
            : keys.length
              ? $tr('Přidat passkey', 'Add passkey')
              : $tr('Přejít na passkey', 'Switch to passkey')}
        </button>
      </form>
      {#if !supported}<p class="max-w-[65ch] text-[0.875rem] leading-[1.6] text-ink-600">
          {$tr(
            'Pro passkey otevři Fritz v aktuálním prohlížeči přes HTTPS; lokálně použij localhost.',
            'For passkeys, open Fritz in a current browser over HTTPS; locally use localhost.',
          )}
        </p>{/if}
      {#if keys.length}
        <div class="flex flex-wrap items-center gap-3">
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
                message = $tr(
                  'Nový obnovovací kód nahradil předchozí.',
                  'A new recovery code replaced the previous one.',
                );
              })}>{$tr('Vytvořit nový obnovovací kód', 'Create a new recovery code')}</button
          >
          <button
            class="btn-base btn-secondary"
            disabled={busy}
            onclick={() => {
              confirmLogout = true;
            }}>{$tr('Odhlásit všechna zařízení', 'Sign out all devices')}</button
          >
        </div>
        {#if confirmLogout}
          <div class="grid gap-3">
            <p class="max-w-[65ch] leading-[1.6] text-ink-600">
              {$tr(
                'Odhlásí se i tento prohlížeč. Uložené AI připojení zůstane zachované.',
                'This browser signs out too. Your saved AI connection is kept.',
              )}
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <button
                class="btn-base btn-secondary"
                disabled={busy}
                onclick={() =>
                  void run(async () => {
                    await jsonRequest('/api/auth/logout-all/', { method: 'POST' });
                    forgetRememberedAccess();
                    window.location.replace('/login/');
                  })}>{$tr('Potvrdit odhlášení', 'Confirm sign-out')}</button
              >
              <button
                class="btn-base btn-secondary"
                disabled={busy}
                onclick={() => {
                  confirmLogout = false;
                }}>{$tr('Zrušit', 'Cancel')}</button
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
    {#if errorMessage}<p
        id="access-error"
        class="max-w-[65ch] leading-[1.6] text-coral-700"
        role="alert"
      >
        {errorMessage}
      </p>{/if}
    {#if message}<p class="max-w-[65ch] leading-[1.6] text-ink-600" role="status">{message}</p>{/if}
  </section>
{/if}
