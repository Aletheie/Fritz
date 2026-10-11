<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { AuthConnectionError, getAuthSession, logout } from '$lib/client/auth.ts';
  import { clearLongTermSession } from '$lib/client/study-session.ts';
  import { prepareLocalDataForAccount } from '$lib/data/repository.ts';
  import { t } from '$lib/i18n';
  import { appStore, gameProgress, motherTongue } from '$lib/state/app';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import BookOpenText from '@lucide/svelte/icons/book-open-text';
  import Bot from '@lucide/svelte/icons/bot';
  import Brain from '@lucide/svelte/icons/brain';
  import Home from '@lucide/svelte/icons/home';
  import Library from '@lucide/svelte/icons/library';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import Trophy from '@lucide/svelte/icons/trophy';
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import BrandMark from './BrandMark.svelte';
  import DesktopSidebar from './shell/DesktopSidebar.svelte';
  import MobileHeader from './shell/MobileHeader.svelte';
  import MobileNav from './shell/MobileNav.svelte';
  import type { NavigationItem } from './shell/navigation.ts';
  import RewardNotice from './shell/RewardNotice.svelte';

  type NavigationEntry = Omit<NavigationItem, 'active'> & { matches?: string[]; mobile?: boolean };

  let { children } = $props<{ children: Snippet }>();
  const rewardNoticeExitMs = 160;
  const AUTH_SEEN_STORAGE_KEY = 'fritz_auth_seen';
  const LEGACY_AUTH_SEEN_STORAGE_KEY = 'wortly_auth_seen';

  let online = $state(true);
  let offlineReady = $state(false);
  let rewardNoticeDismissed = $state(false);
  let rewardNoticeMounted = $state(false);
  let rewardNoticeClosing = $state(false);
  let rewardNoticeHeight = $state(0);
  let updateReady = $state(false);
  let activatingUpdate = $state(false);
  let waitingWorker = $state<ServiceWorker | undefined>(undefined);
  let authChecked = $state(false);
  let authError = $state('');
  let loggingOut = $state(false);
  let desktopMode = $state(false);
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

  const navigation = $derived.by((): NavigationEntry[] => [
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
      matches: ['/progress/', '/reward/', '/rival/'],
      mobile: false,
    },
  ]);

  const navigationItems = $derived(
    navigation.map((item): NavigationItem => ({ ...item, active: isActive(item) })),
  );
  const mobileNavigation = $derived(
    navigationItems.filter((_, index) => navigation[index].mobile !== false),
  );

  const caseSession = $derived(
    routeMatches(page.url.pathname, '/cases/') && !routeIs(page.url.pathname, '/cases/'),
  );
  const immersive = $derived.by(() => {
    const path = page.url.pathname;
    return (
      routeMatches(path, '/today/') ||
      routeMatches(path, '/rival/') ||
      caseSession ||
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
        desktopMode = session.accessMode === 'desktop';
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
            : 'Aplikaci se nepodařilo načíst. Zkus to znovu.';
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

  function isActive(item: NavigationEntry): boolean {
    if (item.href === '/') return routeIs(page.url.pathname, '/');
    const paths = item.matches ?? [item.href];
    return paths.some((path) => routeMatches(page.url.pathname, path));
  }
</script>

{#if !authChecked || authError}
  <main class="grid min-h-dvh place-items-center bg-paper-100 p-4" aria-busy={!authChecked}>
    <div class="surface grid max-w-[22rem] justify-items-center gap-4 p-8 text-center">
      <BrandMark size={48} />
      {#if authError}
        <p class="text-[0.85rem] leading-normal text-ink-600" role="alert">{authError}</p>
        <button class="btn-base btn-primary" type="button" onclick={() => window.location.reload()}>
          Zkusit znovu
        </button>
      {:else}
        <p class="text-[0.85rem] leading-normal text-ink-600">Ověřuji přístup…</p>
      {/if}
    </div>
  </main>
{:else}
  <div
    class={[
      immersive
        ? 'h-dvh min-h-0 overflow-hidden'
        : 'min-h-dvh lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]',
    ]}
    style:--reward-notice-space={`${rewardNoticeMounted ? rewardNoticeHeight : 0}px`}
  >
    {#if !immersive}
      <DesktopSidebar
        items={navigationItems}
        {online}
        {offlineReady}
        settingsActive={routeMatches(page.url.pathname, '/settings/')}
        showLogout={!desktopMode}
        {loggingOut}
        onsignout={() => void signOut()}
      />
    {/if}

    <div
      class={[
        'min-w-0',
        immersive && 'h-full min-h-0 overflow-hidden',
        routeIs(page.url.pathname, '/') && 'bg-[#f7f7f7]',
      ]}
    >
      {#if updateReady}
        <aside
          class="sticky top-0 z-60 flex items-center justify-between gap-4 border-b border-ink-950 bg-acid-200 py-3 pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] text-ink-950"
          aria-live="polite"
        >
          <div class="grid gap-[0.15rem]">
            <strong class="text-[0.875rem]">{t($motherTongue, 'shell.updateReady')}</strong>
            <span class="text-[0.75rem]">{t($motherTongue, 'shell.updateDescription')}</span>
          </div>
          <button
            class="inline-flex min-h-11 flex-none items-center gap-[0.4rem] rounded-[0.35rem] border border-ink-950 bg-paper-50 px-3 py-[0.55rem] text-[0.875rem] font-extrabold shadow-[3px_3px_0_var(--color-ink-950)] active:[transform:scale(0.97)]"
            type="button"
            disabled={activatingUpdate}
            onclick={activateWaitingUpdate}
          >
            <RefreshCw size={17} />
            {activatingUpdate
              ? t($motherTongue, 'shell.updating')
              : t($motherTongue, 'shell.update')}
          </button>
        </aside>
      {/if}
      {#if !immersive}
        <MobileHeader showLogout={!desktopMode} {loggingOut} onsignout={() => void signOut()} />
      {/if}

      <main
        class={[
          'mx-auto w-full',
          immersive
            ? 'h-dvh max-w-none overflow-x-hidden overflow-y-auto overscroll-contain p-0'
            : 'max-w-[88rem] px-[0.9rem] pt-4 pb-[calc(6.35rem+var(--safe-bottom)+var(--reward-notice-space))] min-[640px]:px-[1.4rem] min-[640px]:pt-6 min-[640px]:pb-[calc(7.5rem+var(--reward-notice-space))] lg:px-6 lg:pb-[calc(3rem+var(--reward-notice-space))] xl:px-9 xl:pt-8 xl:pb-[calc(3.25rem+var(--reward-notice-space))]',
        ]}
      >
        <div class={[immersive && 'h-full', !caseSession && 'page-enter']}>
          {#if $appStore.error}
            <section class="grid min-h-[70dvh] place-items-center p-4">
              <div class="surface max-w-[34rem] p-[1.6rem]">
                <span
                  class="grid size-12 place-items-center rounded-[0.85rem] bg-coral-50 text-coral-700"
                  ><AlertTriangle size={27} /></span
                >
                <p class="kicker mt-5">{t($motherTongue, 'shell.localDataError')}</p>
                <h1
                  class="mt-[0.35rem] text-[clamp(1.8rem,6vw,2.6rem)] leading-[0.98] font-black tracking-[-0.04em]"
                >
                  {t($motherTongue, 'shell.startError')}
                </h1>
                <p class="mt-[0.85rem] mb-[1.2rem] leading-[1.55] text-ink-600">
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
        <MobileNav items={mobileNavigation} />
      {/if}
    </div>

    {#if rewardNoticeMounted}
      <RewardNotice
        closing={rewardNoticeClosing}
        bind:height={rewardNoticeHeight}
        ondismiss={dismissRewardNotice}
      />
    {/if}
  </div>
{/if}
