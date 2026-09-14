<script lang="ts">
  import { getAiKeyStatus } from '$lib/client/ai.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Info from '@lucide/svelte/icons/info';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import { onMount } from 'svelte';

  import type { AiKeyStatus } from '$lib/domain/ai/types.ts';

  let status = $state<AiKeyStatus | undefined>();
  let loading = $state(true);
  let failed = $state(false);

  onMount(async () => {
    try {
      status = await getAiKeyStatus();
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  });

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }
</script>

<section id="ai" class="surface scroll-mt-24 overflow-hidden">
  <div class="grid xl:grid-cols-[0.84fr_1.16fr]">
    <div class="border-b border-line bg-sky-50/55 p-5 sm:p-7 xl:border-r xl:border-b-0">
      <div class="section-heading">
        <span class="section-icon" aria-hidden="true"><KeyRound size={21} /></span>
        <div>
          <h2>{copy('AI trenér a dílna', 'AI trainer and workshop')}</h2>
          <p>
            {copy('Režim', 'Mode')}: {status?.source === 'demo'
              ? copy('demo bez klíče', 'keyless demo')
              : (status?.model ?? copy('načítám', 'loading'))}
          </p>
        </div>
      </div>
      <p class="mt-5 text-sm leading-relaxed text-ink-600">
        {copy(
          'Přístup k AI nastavuje správce aplikace. V aplikaci žádný klíč nezadáváš.',
          'Your app administrator sets up AI access. You don’t need to enter a key here.',
        )}
      </p>
      <div
        class="mt-5 rounded-xl border border-sky-200 bg-paper-50 p-3.5 text-sm leading-relaxed text-sky-700"
      >
        <Info class="mr-2 inline-block align-[-0.2rem]" size={17} aria-hidden="true" />
        {copy(
          'Klíč k AI zůstává na serveru. Do prohlížeče ani záloh se neukládá.',
          'The AI key stays on the server. It isn’t stored in your browser or backups.',
        )}
      </div>
    </div>

    <div class="p-5 sm:p-7">
      {#if loading}
        <div
          class="flex min-h-36 items-center justify-center gap-3 text-sm font-semibold text-ink-600"
        >
          <LoaderCircle class="spin" size={19} aria-hidden="true" />
          {copy('Načítám stav AI…', 'Loading AI status…')}
        </div>
      {:else if failed}
        <div class="status-block warning">
          <AlertTriangle size={19} aria-hidden="true" />
          <p>
            {copy('Stav serverové AI se nepodařilo načíst.', 'Could not load server AI status.')}
          </p>
        </div>
      {:else if status?.configured}
        <div class="status-block ready">
          <ShieldCheck size={19} aria-hidden="true" />
          <div>
            <strong>{copy('Živé AI je připravené', 'Live AI is ready')}</strong>
            <p>
              {copy(
                `Server používá ${status.dataRecipient}. Klíč se do prohlížeče nikdy neposílá.`,
                `The server uses ${status.dataRecipient}. The key is never sent to the browser.`,
              )}
            </p>
          </div>
          <a class="btn-base btn-secondary" href="/ai/">
            {copy('AI dílna', 'AI workshop')}
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
      {:else}
        <div class="status-block demo">
          <Sparkles size={19} aria-hidden="true" />
          <div>
            <strong>{copy('Demo režim je připravený', 'Demo mode is ready')}</strong>
            <p>
              {copy(
                'Pro zapnutí AI požádej správce aplikace. Do té doby můžeš vyzkoušet ukázkové odpovědi.',
                'Ask your app administrator to enable AI. You can try the sample replies in the meantime.',
              )}
            </p>
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .section-heading {
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }
  .section-heading h2 {
    font-size: 1.2rem;
    font-weight: 800;
    letter-spacing: -0.03em;
  }
  .section-heading p {
    margin-top: 0.08rem;
    color: var(--color-ink-600);
    font-size: 0.8rem;
  }
  .section-icon {
    display: grid;
    width: 2.8rem;
    height: 2.8rem;
    flex: none;
    place-items: center;
    border-radius: 0.9rem;
    color: var(--color-sky-700);
    background: var(--color-sky-50);
  }
  .status-block {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    border-radius: 0.9rem;
    padding: 1rem;
    font-size: 0.85rem;
  }
  .status-block > div {
    display: grid;
    gap: 0.35rem;
    min-width: 0;
  }
  .status-block p {
    color: var(--color-ink-600);
    line-height: 1.5;
  }
  .status-block.ready {
    color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .status-block.demo {
    color: var(--color-butter-700);
    background: var(--color-butter-50);
  }
  .status-block.warning {
    color: var(--color-coral-700);
    background: var(--color-coral-50);
  }
  .status-block a {
    margin-left: auto;
    flex: none;
  }
  @media (max-width: 40rem) {
    .status-block {
      flex-wrap: wrap;
    }
    .status-block a {
      margin-left: 2rem;
    }
  }
</style>
