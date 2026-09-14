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
</script>

<details>
  <summary>
    <span>
      <strong>{copy('Podrobnosti opakování', 'Advanced memory controls')}</strong>
      <small>
        {desiredRetention} % · {dailyNewLimit}
        {copy('nových slov denně', 'new words per day')}
      </small>
    </span>
    <ChevronDown size={18} aria-hidden="true" />
  </summary>
  <div class="controls">
    <label class="range-block" for="retention">
      <span
        ><strong>{copy('Cílová retence', 'Target retention')}</strong><b>{desiredRetention} %</b
        ></span
      >
      <input id="retention" type="range" min="80" max="95" step="1" bind:value={desiredRetention} />
      <small>
        {copy(
          'Vyšší hodnota znamená častější opakování. Výchozí nastavení je 90 %.',
          'A higher value means more frequent reviews. The default is 90%.',
        )}
      </small>
    </label>
    <label class="range-block" for="new-limit">
      <span
        ><strong>{copy('Nová slovíčka za den', 'New words per day')}</strong><b>{dailyNewLimit}</b
        ></span
      >
      <input id="new-limit" type="range" min="0" max="30" step="1" bind:value={dailyNewLimit} />
      <small>
        {copy(
          'Nejdřív přijde na řadu opakování. Hodnota 0 pozastaví přidávání nových slov.',
          'Due reviews take priority. Zero temporarily pauses new cards.',
        )}
      </small>
    </label>
  </div>
</details>

<style>
  details {
    margin-top: 1rem;
    border-top: 1px solid var(--color-line);
    padding-top: 0.35rem;
  }
  summary {
    display: flex;
    min-height: 3.2rem;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    color: var(--color-cobalt-700);
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary strong,
  summary small {
    display: block;
  }
  summary strong {
    font-size: 0.82rem;
  }
  summary small {
    margin-top: 0.1rem;
    color: var(--color-ink-600);
    font-size: 0.7rem;
  }
  summary :global(svg) {
    flex: none;
    transition: transform 180ms var(--ease-out-emil);
  }
  details[open] summary :global(svg) {
    transform: rotate(180deg);
  }
  .controls {
    display: grid;
    gap: 0.8rem;
    margin-top: 0.75rem;
  }
  .range-block {
    display: block;
    border: 1px solid var(--color-line);
    border-radius: 0.2rem;
    background: white;
    padding: 0.9rem;
  }
  .range-block > span {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.82rem;
  }
  .range-block b {
    font-family: var(--font-mono);
    font-size: 0.92rem;
  }
  .range-block input {
    width: 100%;
    margin-top: 0.8rem;
    accent-color: var(--color-cobalt-700);
  }
  .range-block small {
    display: block;
    margin-top: 0.55rem;
    color: var(--color-ink-600);
    font-size: 0.69rem;
    line-height: 1.45;
  }
</style>
