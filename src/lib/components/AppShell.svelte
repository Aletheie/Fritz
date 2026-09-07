<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { AuthConnectionError, getAuthSession, logout } from '$lib/client/auth.ts';
  import { clearLongTermSession } from '$lib/client/study-session.ts';
  import { prepareLocalDataForAccount } from '$lib/data/repository.ts';
  import { gameLevelTitle, t } from '$lib/i18n';
  import { appStore, gameProgress, motherTongue } from '$lib/state/app';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import BookMarked from '@lucide/svelte/icons/book-marked';
  import BookOpenText from '@lucide/svelte/icons/book-open-text';
  import Bot from '@lucide/svelte/icons/bot';
  import Brain from '@lucide/svelte/icons/brain';
  import Flame from '@lucide/svelte/icons/flame';
  import Home from '@lucide/svelte/icons/home';
  import Library from '@lucide/svelte/icons/library';
  import LogOut from '@lucide/svelte/icons/log-out';
  import Plus from '@lucide/svelte/icons/plus';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Settings from '@lucide/svelte/icons/settings';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Trophy from '@lucide/svelte/icons/trophy';
  import WifiOff from '@lucide/svelte/icons/wifi-off';
  import { onMount } from 'svelte';
  import type { Component, Snippet } from 'svelte';
  import BrandMark from './BrandMark.svelte';

  type NavigationItem = {
    href: string;
    label: string;
    mobileLabel: string;
    icon: Component;
    matches?: string[];
    mobile?: boolean;
  };

  let { children } = $props<{ children: Snippet }>();
  const rewardNoticeExitMs = 160;
  const AUTH_SEEN_STORAGE_KEY = 'fritz_auth_seen';
  const LEGACY_AUTH_SEEN_STORAGE_KEY = 'wortly_auth_seen';

  let online = $state(true);
  let offlineReady = $state(false);
  let rewardNoticeDismissed = $state(false);
  let rewardNoticeMounted = $state(false);
  let rewardNoticeClosing = $state(false);
  let updateReady = $state(false);
  let activatingUpdate = $state(false);
  let waitingWorker = $state<ServiceWorker | undefined>(undefined);
  let authChecked = $state(false);
  let authError = $state('');
  let loggingOut = $state(false);
  let rewardNoticeCloseTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    if (
      authChecked &&
      !authError &&
      $appStore.ready &&
      $appStore.settings &&
      !$appStore.settings.onboardingCompleted &&
      !routeMatches(page.url.pathname, '/onboarding/')
    ) {
      void goto('/onboarding/', { replaceState: true });
    }
  });

  const navigation = $derived.by((): NavigationItem[] => [
    {
      href: '/',
      label: t($motherTongue, 'shell.today'),
      mobileLabel: t($motherTongue, 'shell.today'),
      icon: Home,
    },
    {
      href: '/course/',
      label: t($motherTongue, 'shell.course'),
      mobileLabel: t($motherTongue, 'shell.course'),
      icon: BookOpenText,
      matches: ['/course/', '/grammar/'],
    },
    {
      href: '/study/',
      label: t($motherTongue, 'shell.training'),
      mobileLabel: t($motherTongue, 'shell.training'),
      icon: Brain,
    },
    {
      href: '/coach/',
      label: t($motherTongue, 'shell.aiConversation'),
      mobileLabel: t($motherTongue, 'shell.aiShort'),
      icon: Bot,
    },
    {
      href: '/library/',
      label: t($motherTongue, 'shell.dictionary'),
      mobileLabel: t($motherTongue, 'shell.dictionary'),
      icon: Library,
    },
    {
      href: '/progress/',
      label: t($motherTongue, 'shell.progress'),
      mobileLabel: t($motherTongue, 'shell.progress'),
      icon: Trophy,
      matches: ['/progress/', '/reward/'],
      mobile: false,
    },
  ]);

  const mobileNavigation = $derived(navigation.filter((item) => item.mobile !== false));

  const immersive = $derived.by(() => {
    const path = page.url.pathname;
    return (
      routeMatches(path, '/today/') ||
      routeMatches(path, '/study/') ||
      routeMatches(path, '/path/') ||
      (routeMatches(path, '/grammar/') && !routeIs(path, '/grammar/')) ||
      routeMatches(path, '/coach/session/') ||
      routeMatches(path, '/onboarding/') ||
      isStorySession(path)
    );
  });

  const showRewardNotice = $derived(
    $appStore.ready &&
      $gameProgress.reward.unlocked &&
      !$gameProgress.reward.claimed &&
      !rewardNoticeDismissed &&
      !immersive &&
      !routeMatches(page.url.pathname, '/reward/'),
  );

  $effect(() => {
    if (showRewardNotice) revealRewardNotice();
    else hideRewardNotice();
  });

  function normalizedRoute(path: string): string {
    if (path === '/') return path;
    return path.replace(/\/+$/u, '');
  }

  function routeIs(pathname: string, route: string): boolean {
    return normalizedRoute(pathname) === normalizedRoute(route);
  }

  function routeMatches(pathname: string, route: string): boolean {
    const path = normalizedRoute(pathname);
    const base = normalizedRoute(route);
    return path === base || path.startsWith(`${base}/`);
  }

  function isStorySession(pathname: string): boolean {
    const parts = normalizedRoute(pathname).split('/').filter(Boolean);
    return parts.length === 3 && parts[0] === 'stories';
  }

  function clearRewardNoticeClose(): void {
    if (rewardNoticeCloseTimer) clearTimeout(rewardNoticeCloseTimer);
    rewardNoticeCloseTimer = undefined;
  }

  function revealRewardNotice(): void {
    clearRewardNoticeClose();
    rewardNoticeMounted = true;
    rewardNoticeClosing = false;
  }

  function hideRewardNotice(): void {
    if (!rewardNoticeMounted || rewardNoticeClosing) return;
    rewardNoticeClosing = true;
    rewardNoticeCloseTimer = setTimeout(() => {
      rewardNoticeCloseTimer = undefined;
      rewardNoticeMounted = false;
      rewardNoticeClosing = false;
    }, rewardNoticeExitMs);
  }

  function dismissRewardNotice(): void {
    rewardNoticeDismissed = true;
  }

  function rememberAuthenticatedBrowser(): void {
    try {
      window.localStorage.setItem(AUTH_SEEN_STORAGE_KEY, '1');
      window.localStorage.removeItem(LEGACY_AUTH_SEEN_STORAGE_KEY);
    } catch {
      // Auth remains server-enforced when storage is blocked; only offline fallback is unavailable.
    }
  }

  function browserWasAuthenticated(): boolean {
    try {
      const authenticated =
        window.localStorage.getItem(AUTH_SEEN_STORAGE_KEY) === '1' ||
        window.localStorage.getItem(LEGACY_AUTH_SEEN_STORAGE_KEY) === '1';
      if (authenticated) rememberAuthenticatedBrowser();
      return authenticated;
    } catch {
      return false;
    }
  }

  function forgetAuthenticatedBrowser(): void {
    try {
      window.localStorage.removeItem(AUTH_SEEN_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_AUTH_SEEN_STORAGE_KEY);
    } catch {
      // The server session is still cleared even if browser storage is unavailable.
    }
  }

  onMount(() => {
    let disposed = false;
    const authController = new AbortController();
    void getAuthSession(authController.signal)
      .then(async (session) => {
        if (disposed) return undefined;
        if (!session.authenticated) {
          forgetAuthenticatedBrowser();
          const destination = `${window.location.pathname}${window.location.search}`;
          void goto(`/login/?redirect=${encodeURIComponent(destination)}`, { replaceState: true });
          return undefined;
        }
        if (!session.accountId || !session.accountCreatedAt) {
          throw new Error('Server neposkytl identitu přihlášeného účtu.');
        }
        const localDataReset = await prepareLocalDataForAccount({
          accountId: session.accountId,
          accountCreatedAt: session.accountCreatedAt,
        });
        if (localDataReset) clearLongTermSession();
        if (disposed) return undefined;
        await appStore.initialize({ refresh: true });
        if (disposed) return undefined;
        authChecked = true;
        rememberAuthenticatedBrowser();
        return undefined;
      })
      .catch((error: unknown) => {
        if (disposed) return undefined;
        if (error instanceof AuthConnectionError && browserWasAuthenticated()) {
          authChecked = true;
          void appStore.initialize();
          return undefined;
        }
        authError =
          error instanceof AuthConnectionError
            ? 'Přihlášení se nepodařilo ověřit. Zkontroluj připojení a zkus to znovu.'
            : 'Aplikaci se nepodařilo bezpečně načíst. Zkus to znovu.';
        authChecked = true;
        return undefined;
      });
    online = navigator.onLine;
    appStore.refreshClock();
    const clockTimer = window.setInterval(() => appStore.refreshClock(), 30_000);

    const unsubscribe = appStore.subscribe((state) => {
      if (!state.settings) return;
      document.documentElement.dataset.motion = state.settings.reduceMotion ? 'reduced' : 'full';
      document.documentElement.dataset.accent = state.settings.accentTheme;
      document.documentElement.lang = state.settings.motherTongue === 'en' ? 'en' : 'cs';
    });

    const updateOnlineState = () => {
      online = navigator.onLine;
    };
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);

    let registration: ServiceWorkerRegistration | undefined;
    let installingWorker: ServiceWorker | undefined;
    const inspectInstallingWorker = () => {
      installingWorker = registration?.installing ?? undefined;
      installingWorker?.addEventListener('statechange', handleWorkerState);
    };
    const handleWorkerState = () => {
      if (installingWorker?.state === 'installed' && navigator.serviceWorker.controller) {
        waitingWorker = registration?.waiting ?? installingWorker;
        updateReady = true;
      }
    };
    const handleControllerChange = () => {
      if (activatingUpdate) window.location.reload();
    };

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.ready
        .then((value) => {
          if (disposed) return undefined;
          registration = value;
          offlineReady = true;
          if (registration.waiting) {
            waitingWorker = registration.waiting;
            updateReady = true;
          }
          registration.addEventListener('updatefound', inspectInstallingWorker);
          inspectInstallingWorker();
          return undefined;
        })
        .catch(() => {
          offlineReady = false;
        });
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }

    return () => {
      disposed = true;
      authController.abort();
      clearRewardNoticeClose();
      unsubscribe();
      window.clearInterval(clockTimer);
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
      registration?.removeEventListener('updatefound', inspectInstallingWorker);
      installingWorker?.removeEventListener('statechange', handleWorkerState);
      navigator.serviceWorker?.removeEventListener('controllerchange', handleControllerChange);
    };
  });

  async function signOut(): Promise<void> {
    if (loggingOut) return;
    loggingOut = true;
    try {
      await logout();
      forgetAuthenticatedBrowser();
      window.location.replace('/login/');
    } catch {
      authError = 'Odhlášení se nepodařilo dokončit. Zkus to znovu.';
      loggingOut = false;
    }
  }

  function activateWaitingUpdate(): void {
    if (!waitingWorker || activatingUpdate) return;
    activatingUpdate = true;
    // ServiceWorker.postMessage does not accept a target origin.
    // oxlint-disable-next-line unicorn/require-post-message-target-origin
    waitingWorker.postMessage('FRITZ_SKIP_WAITING');
  }

  function isActive(item: NavigationItem): boolean {
    if (item.href === '/') return routeIs(page.url.pathname, '/');
    const paths = item.matches ?? [item.href];
    return paths.some((path) => routeMatches(page.url.pathname, path));
  }
</script>

{#if !authChecked}
  <main class="auth-loading" aria-busy="true">
    <div class="surface auth-loading-card">
      <BrandMark size={48} />
      <p>Ověřuji přístup…</p>
    </div>
  </main>
{:else if authError}
  <main class="auth-loading">
    <div class="surface auth-loading-card">
      <BrandMark size={48} />
      <p role="alert">{authError}</p>
      <button class="btn-base btn-primary" type="button" onclick={() => window.location.reload()}>
        Zkusit znovu
      </button>
    </div>
  </main>
{:else}
  <div class:immersive class:home={routeIs(page.url.pathname, '/')} class="app-frame">
    {#if !immersive}
      <aside class="desktop-sidebar">
        <a href="/" class="brand-link" aria-label={t($motherTongue, 'shell.todayJourney')}>
          <BrandMark size={43} />
          <span class="brand-copy">
            <strong>Fritz</strong>
            <small>{t($motherTongue, 'shell.brandTagline')}</small>
          </span>
        </a>

        <div class="profile-strip">
          <div class="profile-level">{$gameProgress.level.level}</div>
          <div>
            <span>{$appStore.settings?.profileName || t($motherTongue, 'shell.student')}</span>
            <small
              >{gameLevelTitle($motherTongue, $gameProgress.level.title)} · {$gameProgress.totalXp}
              XP</small
            >
          </div>
        </div>

        <nav class="desktop-navigation" aria-label={t($motherTongue, 'shell.mainNavigation')}>
          {#each navigation as item}
            {@const Icon = item.icon}
            <a
              href={item.href}
              aria-current={isActive(item) ? 'page' : undefined}
              class:nav-active={isActive(item)}
              class="nav-item"
            >
              <span class="nav-icon"><Icon size={18} strokeWidth={2.2} /></span>
              <span>{item.label}</span>
            </a>
          {/each}
        </nav>

        <div class="secondary-tools" aria-label={t($motherTongue, 'shell.secondaryTools')}>
          <a class="create-link" href="/create/">
            <Plus size={18} strokeWidth={2.5} />
            {t($motherTongue, 'shell.addMaterial')}
          </a>
          <a class="reading-link" href="/stories/">
            <BookMarked size={17} />
            {t($motherTongue, 'shell.stories')}
          </a>
        </div>

        <div class="rail-footer">
          <div class="streak-card">
            <span class="streak-icon"><Flame size={19} fill="currentColor" /></span>
            <div>
              <strong>{t($motherTongue, 'shell.streak', { count: $gameProgress.streak })}</strong>
              <small>{t($motherTongue, 'common.xpToday', { xp: $gameProgress.todayXp })}</small>
            </div>
          </div>

          <div class="connection-row">
            {#if online}
              <span class="connection-dot"></span>
              {offlineReady
                ? t($motherTongue, 'shell.courseOffline')
                : t($motherTongue, 'shell.deviceOnline')}
            {:else}
              <WifiOff size={14} /> {t($motherTongue, 'shell.studyOffline')}
            {/if}
          </div>

          <a
            href="/settings/"
            aria-current={routeMatches(page.url.pathname, '/settings/') ? 'page' : undefined}
            class="settings-link"
          >
            <Settings size={17} />
            {t($motherTongue, 'common.settings')}
          </a>
          <button
            class="logout-link"
            type="button"
            onclick={() => void signOut()}
            disabled={loggingOut}
          >
            <LogOut size={17} />
            {loggingOut ? 'Odhlašuji…' : 'Odhlásit'}
          </button>
        </div>
      </aside>
    {/if}

    <div class="content-column">
      {#if updateReady}
        <aside class="update-banner" aria-live="polite">
          <div>
            <strong>{t($motherTongue, 'shell.updateReady')}</strong>
            <span>{t($motherTongue, 'shell.updateDescription')}</span>
          </div>
          <button type="button" disabled={activatingUpdate} onclick={activateWaitingUpdate}>
            <RefreshCw size={17} />
            {activatingUpdate
              ? t($motherTongue, 'shell.updating')
              : t($motherTongue, 'shell.update')}
          </button>
        </aside>
      {/if}
      {#if !immersive}
        <header class="mobile-header" style:padding-top="var(--safe-top)">
          <a href="/" class="mobile-brand" aria-label={t($motherTongue, 'shell.todayJourney')}>
            <BrandMark size={34} />
            <span
              ><strong>Fritz</strong><small>{t($motherTongue, 'shell.todayJourneyShort')}</small
              ></span
            >
          </a>
          <div class="mobile-actions">
            <a
              class="status-pill streak"
              href="/progress/"
              aria-label={t($motherTongue, 'shell.streakLabel', {
                count: $gameProgress.streak,
              })}
            >
              <Flame size={15} fill="currentColor" />
              {$gameProgress.streak}
            </a>
            <a
              class="status-pill xp"
              href="/progress/"
              aria-label={t($motherTongue, 'shell.todayXpLabel', { xp: $gameProgress.todayXp })}
            >
              <Sparkles size={14} />
              {$gameProgress.todayXp}
            </a>
            <a
              class="header-button"
              href="/create/"
              aria-label={t($motherTongue, 'shell.addMaterialShort')}><Plus size={20} /></a
            >
            <button
              class="header-button logout-header-button"
              type="button"
              aria-label="Odhlásit"
              onclick={() => void signOut()}
              disabled={loggingOut}><LogOut size={19} aria-hidden="true" /></button
            >
          </div>
        </header>
      {/if}

      <main class:immersive-main={immersive} class="main-content">
        <div class:immersive-page={immersive} class="page-enter">
          {#if $appStore.error}
            <section class="error-wrap">
              <div class="surface error-sheet">
                <span class="error-icon"><AlertTriangle size={27} /></span>
                <p class="kicker">{t($motherTongue, 'shell.localDataError')}</p>
                <h1>{t($motherTongue, 'shell.startError')}</h1>
                <p>
                  {$motherTongue === 'cs' ? $appStore.error : t('en', 'shell.errorDetails')}
                </p>
                <button
                  class="btn-base btn-primary"
                  type="button"
                  onclick={() => void appStore.initialize()}
                >
                  <RefreshCw size={18} />
                  {t($motherTongue, 'shell.tryAgain')}
                </button>
              </div>
            </section>
          {:else}
            {@render children()}
          {/if}
        </div>
      </main>

      {#if !immersive}
        <nav
          class="mobile-nav"
          style:padding-bottom="calc(0.35rem + var(--safe-bottom))"
          aria-label={t($motherTongue, 'shell.mobileNavigation')}
        >
          {#each mobileNavigation as item}
            {@const Icon = item.icon}
            <a
              href={item.href}
              aria-label={item.label}
              aria-current={isActive(item) ? 'page' : undefined}
              class:mobile-active={isActive(item)}
              class="mobile-nav-item"
            >
              <span class="mobile-icon"
                ><Icon size={20} strokeWidth={isActive(item) ? 2.55 : 2.05} /></span
              >
              <span>{item.mobileLabel}</span>
            </a>
          {/each}
        </nav>
      {/if}
    </div>

    {#if rewardNoticeMounted}
      <aside
        class="reward-notice"
        data-closing={rewardNoticeClosing ? '' : undefined}
        aria-live="polite"
      >
        <button
          type="button"
          aria-label={t($motherTongue, 'shell.closeNotice')}
          onclick={dismissRewardNotice}>×</button
        >
        <span class="reward-spark"><Sparkles size={20} /></span>
        <div>
          <strong>{t($motherTongue, 'shell.rewardTitle')}</strong>
          <p>{t($motherTongue, 'shell.rewardDescription')}</p>
        </div>
        <a href="/reward/">{t($motherTongue, 'shell.openReward')}</a>
      </aside>
    {/if}
  </div>
{/if}

<style>
  .app-frame {
    min-height: 100dvh;
  }
  .auth-loading {
    display: grid;
    min-height: 100dvh;
    place-items: center;
    padding: 1rem;
    background: var(--color-paper-100);
  }
  .auth-loading-card {
    display: grid;
    max-width: 22rem;
    justify-items: center;
    gap: 1rem;
    padding: 2rem;
    text-align: center;
  }
  .auth-loading-card p {
    color: var(--color-ink-600);
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .app-frame.immersive {
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
  }
  .content-column {
    min-width: 0;
  }
  .update-banner {
    position: sticky;
    z-index: 60;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--color-ink-950);
    color: var(--color-ink-950);
    background: var(--color-acid-200);
    padding: 0.75rem max(1rem, env(safe-area-inset-right)) 0.75rem
      max(1rem, env(safe-area-inset-left));
  }
  .update-banner div {
    display: grid;
    gap: 0.15rem;
  }
  .update-banner strong {
    font-size: 0.875rem;
  }
  .update-banner span {
    font-size: 0.75rem;
  }
  .update-banner button {
    display: inline-flex;
    min-height: 44px;
    flex: none;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.35rem;
    background: var(--color-paper-50);
    padding: 0.55rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 800;
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .update-banner button:active {
    transform: scale(0.97);
  }
  .app-frame.home .content-column {
    background: #f7f7f7;
  }
  .app-frame.immersive .content-column {
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .desktop-sidebar {
    position: sticky;
    top: 0;
    display: none;
    height: 100dvh;
    flex-direction: column;
    overflow-x: hidden;
    overflow-y: auto;
    border-right: 1px solid rgb(255 255 255 / 0.12);
    color: var(--color-paper-50);
    background: var(--color-ink-950);
    padding: 1.1rem;
  }

  .brand-link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.1rem 0.25rem 0.85rem;
  }
  .brand-copy {
    display: grid;
    min-width: 0;
    gap: 0.2rem;
  }
  .brand-copy strong {
    color: white;
    font-size: 1.35rem;
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .brand-copy small {
    overflow: hidden;
    color: rgb(255 255 255 / 0.5);
    font-size: 0.68rem;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-strip {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    border-block: 1px solid rgb(255 255 255 / 0.12);
    padding: 0.75rem 0.25rem;
  }
  .profile-level {
    display: grid;
    width: 2.4rem;
    height: 2.4rem;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid rgb(255 255 255 / 0.3);
    border-radius: 0.75rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 900;
  }
  .profile-strip div:last-child {
    display: grid;
    min-width: 0;
    gap: 0.15rem;
  }
  .profile-strip span {
    overflow: hidden;
    color: white;
    font-size: 0.86rem;
    font-weight: 800;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .profile-strip small {
    color: rgb(255 255 255 / 0.48);
    font-size: 0.62rem;
  }

  .desktop-navigation {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-top: 0.75rem;
  }
  .nav-item {
    display: grid;
    min-height: 2.8rem;
    grid-template-columns: 2rem minmax(0, 1fr);
    align-items: center;
    gap: 0.45rem;
    border: 1px solid transparent;
    border-radius: 0.75rem;
    padding: 0.55rem 0.65rem;
    color: rgb(255 255 255 / 0.7);
    font-size: 0.83rem;
    font-weight: 720;
    transition:
      transform 150ms var(--ease-out-emil),
      color 180ms var(--ease-out-emil),
      background-color 180ms var(--ease-out-emil),
      border-color 180ms var(--ease-out-emil);
  }
  .nav-icon {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 0.58rem;
    background: rgb(255 255 255 / 0.06);
  }
  .nav-active {
    border-color: rgb(255 255 255 / 0.12);
    color: white;
    background: rgb(255 255 255 / 0.085);
  }
  .nav-active .nav-icon {
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }

  .create-link {
    display: flex;
    min-height: 2.85rem;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.65rem;
    border: 1px solid rgb(255 255 255 / 0.2);
    border-radius: 0.75rem;
    color: white;
    background: rgb(255 255 255 / 0.04);
    font-size: 0.75rem;
    font-weight: 760;
    transition:
      transform 150ms var(--ease-out-emil),
      background-color 180ms var(--ease-out-emil);
  }
  .secondary-tools {
    display: grid;
    gap: 0.35rem;
    margin-top: 0.65rem;
  }
  .secondary-tools .create-link {
    margin-top: 0;
  }
  .reading-link {
    display: flex;
    min-height: 2.65rem;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: 1px dashed rgb(255 255 255 / 0.2);
    border-radius: 0.75rem;
    color: rgb(255 255 255 / 0.7);
    font-size: 0.72rem;
    font-weight: 730;
  }
  .create-link:active {
    transform: scale(0.97);
  }

  .rail-footer {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
    margin-top: auto;
    padding-top: 0.65rem;
  }
  .streak-card {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    border: 1px solid rgb(255 255 255 / 0.12);
    border-radius: 0.85rem;
    grid-column: 1 / -1;
    padding: 0.65rem;
    background: rgb(255 255 255 / 0.05);
  }
  .streak-icon {
    display: grid;
    width: 2.25rem;
    height: 2.25rem;
    place-items: center;
    border-radius: 0.7rem;
    color: var(--color-orange-500);
    background: rgb(233 154 49 / 0.12);
  }
  .streak-card div {
    display: grid;
    gap: 0.12rem;
  }
  .streak-card strong {
    color: white;
    font-size: 0.76rem;
  }
  .streak-card small {
    color: rgb(255 255 255 / 0.46);
    font-family: var(--font-mono);
    font-size: 0.56rem;
  }
  .connection-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    grid-column: 1 / -1;
    padding: 0.1rem 0.35rem;
    color: rgb(255 255 255 / 0.55);
    font-size: 0.62rem;
  }
  .connection-dot {
    width: 0.42rem;
    height: 0.42rem;
    border-radius: 99px;
    background: var(--color-mint-200);
    box-shadow: 0 0 0 3px rgb(174 231 199 / 0.12);
  }
  .settings-link {
    display: flex;
    min-height: 2.5rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 1px solid rgb(255 255 255 / 0.12);
    border-radius: 0.65rem;
    padding: 0.55rem;
    color: rgb(255 255 255 / 0.66);
    font-size: 0.68rem;
    font-weight: 700;
  }
  .logout-link {
    display: flex;
    min-height: 2.5rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 1px solid rgb(255 255 255 / 0.12);
    border-radius: 0.65rem;
    padding: 0.55rem;
    color: rgb(255 255 255 / 0.66);
    font-size: 0.68rem;
    font-weight: 700;
    text-align: left;
  }
  .logout-link:disabled {
    cursor: wait;
    opacity: 0.6;
  }

  .mobile-header {
    position: sticky;
    top: 0;
    z-index: 35;
    display: flex;
    min-height: calc(3.65rem + var(--safe-top));
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-ink-950) 16%, transparent);
    background: color-mix(in srgb, var(--color-paper-100) 91%, transparent);
    padding-inline: 0.9rem;
    backdrop-filter: blur(18px);
  }
  .mobile-brand {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.55rem;
  }
  .mobile-brand span {
    display: grid;
    min-width: 0;
    gap: 0.02rem;
  }
  .mobile-brand strong {
    font-size: 1.08rem;
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .mobile-brand small {
    color: var(--color-ink-600);
    font-size: 0.58rem;
    font-weight: 700;
  }
  .mobile-actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .status-pill,
  .header-button {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 18%, transparent);
    border-radius: 0.7rem;
    background: color-mix(in srgb, var(--color-paper-50) 85%, transparent);
  }
  .status-pill {
    gap: 0.25rem;
    padding-inline: 0.52rem;
    font-family: var(--font-mono);
    font-size: 0.63rem;
    font-weight: 850;
  }
  .status-pill.streak {
    color: var(--color-orange-700);
  }
  .status-pill.xp {
    color: var(--color-cobalt-700);
  }
  .header-button {
    width: 2.75rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }
  .status-pill:active,
  .header-button:active {
    transform: scale(0.96);
  }
  .logout-header-button {
    color: var(--color-coral-700);
    background: var(--color-paper-50);
  }
  .logout-header-button:disabled {
    cursor: wait;
    opacity: 0.6;
  }

  .main-content {
    width: 100%;
    max-width: 88rem;
    margin: 0 auto;
  }
  .main-content:not(.immersive-main) {
    padding: 1rem 0.9rem calc(6.35rem + var(--safe-bottom));
  }
  .immersive-main {
    max-width: none;
    height: 100dvh;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0;
  }
  .immersive-page {
    height: 100%;
  }
  .error-wrap {
    display: grid;
    min-height: 70dvh;
    place-items: center;
    padding: 1rem;
  }
  .error-sheet {
    max-width: 34rem;
    padding: 1.6rem;
  }
  .error-icon {
    display: grid;
    width: 3rem;
    height: 3rem;
    place-items: center;
    border-radius: 0.85rem;
    color: var(--color-coral-700);
    background: var(--color-coral-50);
  }
  .error-sheet .kicker {
    margin-top: 1.25rem;
  }
  .error-sheet h1 {
    margin: 0.35rem 0 0;
    font-size: clamp(1.8rem, 6vw, 2.6rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 0.98;
  }
  .error-sheet p:not(.kicker) {
    margin: 0.85rem 0 1.2rem;
    color: var(--color-ink-600);
    line-height: 1.55;
  }

  .mobile-nav {
    position: fixed;
    inset: auto 0 0;
    z-index: 40;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    border-top: 1px solid color-mix(in srgb, var(--color-ink-950) 17%, transparent);
    background: color-mix(in srgb, var(--color-paper-50) 94%, transparent);
    padding: 0.4rem 0.25rem 0;
    box-shadow: 0 -12px 35px rgb(21 25 28 / 0.08);
    backdrop-filter: blur(18px);
  }
  .mobile-nav-item {
    display: flex;
    min-height: 4.1rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.22rem;
    color: color-mix(in srgb, var(--color-ink-600) 88%, transparent);
    font-size: 0.62rem;
    font-weight: 720;
    transition:
      transform 140ms var(--ease-out-emil),
      color 160ms var(--ease-out-emil);
  }
  .mobile-icon {
    display: grid;
    width: 2.75rem;
    height: 1.8rem;
    place-items: center;
    border-radius: 0.7rem;
    transition: background-color 180ms var(--ease-out-emil);
  }
  .mobile-active {
    color: var(--color-ink-950);
  }
  .mobile-active .mobile-icon {
    background: var(--color-acid-500);
    box-shadow: inset 0 0 0 1px rgb(21 25 28 / 0.12);
  }
  .mobile-nav-item:active {
    transform: scale(0.95);
  }

  .reward-notice {
    position: fixed;
    right: 0.75rem;
    bottom: calc(5.6rem + var(--safe-bottom));
    left: 0.75rem;
    z-index: 60;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.7rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 1rem;
    color: white;
    background: var(--color-ink-950);
    padding: 0.85rem;
    box-shadow: 0 18px 50px rgb(21 25 28 / 0.28);
    opacity: 1;
    transform: translateY(0) scale(1);
    transform-origin: bottom center;
    transition:
      opacity 260ms var(--ease-out-emil),
      transform 260ms var(--ease-out-emil);
  }
  .reward-notice[data-closing] {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
    transition-duration: 160ms;
    transition-timing-function: var(--ease-in-out-emil);
  }
  @starting-style {
    .reward-notice {
      opacity: 0;
      transform: translateY(12px) scale(0.98);
    }
  }
  .reward-notice > button {
    position: absolute;
    top: 0.25rem;
    right: 0.45rem;
    color: rgb(255 255 255 / 0.55);
    font-size: 1.3rem;
    line-height: 1;
  }
  .reward-spark {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    place-items: center;
    border-radius: 0.75rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }
  .reward-notice div {
    padding-right: 1rem;
  }
  .reward-notice strong {
    display: block;
    font-size: 0.83rem;
    line-height: 1.25;
  }
  .reward-notice p {
    margin: 0.22rem 0 0;
    color: rgb(255 255 255 / 0.58);
    font-size: 0.66rem;
    line-height: 1.4;
  }
  .reward-notice > a {
    grid-column: 1 / -1;
    min-height: 2.45rem;
    border-radius: 0.68rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
    padding: 0.68rem;
    text-align: center;
    font-size: 0.73rem;
    font-weight: 850;
  }

  :global(html[data-motion='reduced']) .reward-notice {
    transform: none;
    transition-property: opacity;
    transition-duration: 160ms !important;
  }
  :global(html[data-motion='reduced']) .reward-notice[data-closing] {
    transform: none;
  }
  @starting-style {
    :global(html[data-motion='reduced']) .reward-notice {
      opacity: 0;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reward-notice {
      transform: none;
      transition-property: opacity;
      transition-duration: 160ms !important;
    }
    .reward-notice[data-closing] {
      transform: none;
    }
    @starting-style {
      .reward-notice {
        opacity: 0;
        transform: none;
      }
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .nav-item:hover:not(.nav-active) {
      color: white;
      background: rgb(255 255 255 / 0.05);
      transform: translateX(2px);
    }
    .create-link:hover {
      background: rgb(255 255 255 / 0.09);
      transform: translateY(-1px);
    }
    .settings-link:hover {
      color: white;
      background: rgb(255 255 255 / 0.06);
    }
    .logout-link:hover:not(:disabled) {
      color: white;
      background: rgb(255 255 255 / 0.06);
    }
    .status-pill:hover {
      border-color: color-mix(in srgb, var(--color-ink-950) 35%, transparent);
      background: white;
    }
  }

  @media (min-width: 640px) {
    .main-content:not(.immersive-main) {
      padding: 1.5rem 1.4rem 7.5rem;
    }
    .reward-notice {
      right: 1rem;
      bottom: 1rem;
      left: auto;
      width: min(25rem, calc(100vw - 2rem));
    }
  }

  @media (min-width: 1024px) {
    .app-frame:not(.immersive) {
      display: grid;
      grid-template-columns: 14rem minmax(0, 1fr);
    }
    .desktop-sidebar {
      display: flex;
      padding: 0.9rem;
    }
    .mobile-header,
    .mobile-nav {
      display: none;
    }
    .main-content:not(.immersive-main) {
      padding: 1.5rem 1.5rem 3rem;
    }
    .reward-notice {
      right: 1.25rem;
      bottom: 1.25rem;
    }
  }

  @media (min-width: 1280px) {
    .app-frame:not(.immersive) {
      grid-template-columns: 15rem minmax(0, 1fr);
    }
    .desktop-sidebar {
      padding: 1.1rem;
    }
    .main-content:not(.immersive-main) {
      padding: 2rem 2.25rem 3.25rem;
    }
  }

  @media (min-width: 1024px) and (max-height: 780px) {
    .desktop-navigation {
      gap: 0.16rem;
      margin-top: 0.65rem;
    }
    .nav-item {
      min-height: 2.8rem;
      padding-block: 0.35rem;
    }
    .create-link {
      min-height: 2.55rem;
      margin-top: 0.55rem;
    }
    .secondary-tools {
      margin-top: 0.55rem;
    }
    .streak-card {
      display: none;
    }
  }
</style>
