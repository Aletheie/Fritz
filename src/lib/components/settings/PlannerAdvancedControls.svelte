<script lang="ts">
  import { localized } from '$lib/i18n';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';

  import type { MotherTongue } from '$lib/domain/types.ts';

  let {
    language,
    desiredRetention = $bindable(),
    dailyNewLimit = $bindable(),
  } = $props<{
    language: MotherTongue;
    desiredRetention: number;
    dailyNewLimit: number;
  }>();

  function copy(cs: string, en: string): string {
    return localized(language, { cs, en });
  }

  const block = 'block rounded-[0.2rem] border border-line bg-white p-[0.9rem]';
</script>

<details class="group mt-4 border-t border-line pt-[0.35rem]">
  <summary
    class="flex min-h-[3.2rem] list-none items-center justify-between gap-3 text-cobalt-700 [&::-webkit-details-marker]:hidden"
  >
    <span>
      <strong class="block text-[0.82rem]"
        >{copy('Podrobnosti opakování', 'Advanced memory controls')}</strong
      >
      <small class="mt-[0.1rem] block text-[0.7rem] text-ink-600">
        {desiredRetention} % · {dailyNewLimit}
        {copy('nových slov denně', 'new words per day')}
      </small>
    </span>
    <ChevronDown
      class="flex-none transition-transform duration-180 ease-out-emil group-open:rotate-180"
      size={18}
      aria-hidden="true"
    />
  </summary>
  <div class="mt-3 grid gap-[0.8rem]">
    <label class={block} for="retention">
      <span class="flex items-center justify-between gap-4 text-[0.82rem]"
        ><strong>{copy('Cílová retence', 'Target retention')}</strong><b
          class="font-mono text-[0.92rem]">{desiredRetention} %</b
        ></span
      >
      <input
        class="mt-[0.8rem] w-full accent-cobalt-700"
        id="retention"
        type="range"
        min="80"
        max="95"
        step="1"
        bind:value={desiredRetention}
      />
      <small class="mt-[0.55rem] block text-[0.69rem] leading-[1.45] text-ink-600">
        {copy(
          'Vyšší hodnota znamená častější opakování. Výchozí nastavení je 90 %.',
          'A higher value means more frequent reviews. The default is 90%.',
        )}
      </small>
    </label>
    <label class={block} for="new-limit">
      <span class="flex items-center justify-between gap-4 text-[0.82rem]"
        ><strong>{copy('Nová slovíčka za den', 'New words per day')}</strong><b
          class="font-mono text-[0.92rem]">{dailyNewLimit}</b
        ></span
      >
      <input
        class="mt-[0.8rem] w-full accent-cobalt-700"
        id="new-limit"
        type="range"
        min="0"
        max="30"
        step="1"
        bind:value={dailyNewLimit}
      />
      <small class="mt-[0.55rem] block text-[0.69rem] leading-[1.45] text-ink-600">
        {copy(
          'Nejdřív přijde na řadu opakování. Hodnota 0 pozastaví přidávání nových slov.',
          'Due reviews take priority. Zero temporarily pauses new cards.',
        )}
      </small>
    </label>
  </div>
</details>
