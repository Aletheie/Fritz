<script lang="ts">
  import { localized } from '$lib/i18n';
  import Smartphone from '@lucide/svelte/icons/smartphone';

  import { utilityCopy, utilitySheet } from './settings-styles.ts';
  import UtilityHeading from './UtilityHeading.svelte';

  import type { MotherTongue } from '$lib/domain/types.ts';

  let { language }: { language: MotherTongue } = $props();

  const copy = (cs: string, en: string) => localized(language, { cs, en });
</script>

<section class={utilitySheet}>
  <UtilityHeading
    icon={Smartphone}
    kicker={copy('zařízení', 'device')}
    title={copy('Instalace na iPhone', 'Install on iPhone')}
  />
  <ol
    class="mt-[0.9rem] grid gap-[0.55rem] text-[0.76rem] leading-[1.45] text-ink-600 [&_strong]:font-mono [&_strong]:text-ink-950"
  >
    <li><strong>1.</strong> {copy('Otevři Fritz v Safari.', 'Open Fritz in Safari.')}</li>
    <li><strong>2.</strong> {copy('Klepni na Sdílet.', 'Tap Share.')}</li>
    <li>
      <strong>3.</strong>
      {copy('Vyber „Přidat na plochu“.', 'Choose “Add to Home Screen”.')}
    </li>
  </ol>
  <p class="{utilityCopy} border border-acid-500 bg-white p-[0.7rem]">
    {copy(
      'Po prvním online načtení funguje běžné učení offline. AI úlohy vyžadují živý server a internet.',
      'After the first online load, regular learning works offline. AI activities need a live server and internet connection.',
    )}
  </p>
</section>
