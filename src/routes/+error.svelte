<script lang="ts">
  import { page } from '$app/state';
  import { motherTongue, tr } from '$lib/state/app';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
</script>

<svelte:head>
  <title>{$tr('Něco se nepovedlo – Fritz', 'Something went wrong – Fritz')}</title>
</svelte:head>

<section class="mx-auto max-w-xl pt-8 sm:pt-20">
  <div class="surface p-7 text-center sm:p-10">
    <span class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-coral-50 text-coral-700">
      <TriangleAlert size={27} />
    </span>
    <p class="kicker mt-5">{$tr('Chyba', 'Error')} {page.status}</p>
    <h1 class="mt-2 text-3xl font-extrabold tracking-[-0.04em] text-balance">
      {$tr('Tuhle část se nepodařilo otevřít.', 'This section could not be opened.')}
    </h1>
    <p class="mt-3 leading-relaxed text-ink-600">
      {$motherTongue === 'cs' && page.error?.message
        ? page.error.message
        : $tr(
            'Data zůstala uložená v zařízení. Zkus stránku načíst znovu.',
            'Your data is still stored on this device. Try reloading the page.',
          )}
    </p>
    <div class="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
      <button class="btn-base btn-primary" type="button" onclick={() => location.reload()}>
        <RefreshCw size={18} />
        {$tr('Načíst znovu', 'Reload')}
      </button>
      <a class="btn-base btn-secondary" href="/">
        <ArrowLeft size={18} />
        {$tr('Na přehled', 'Back to overview')}
      </a>
    </div>
  </div>
</section>
