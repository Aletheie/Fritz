<script lang="ts">
  import type { Article } from '$lib/domain/types';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';

  let {
    value = $bindable<Article | undefined>(),
    disabled = false,
    legend,
  } = $props<{
    value?: Article;
    disabled?: boolean;
    legend?: string;
  }>();

  const articles: Article[] = ['der', 'die', 'das'];
  let displayedLegend = $derived(legend ?? localized($motherTongue, { cs: 'Člen', en: 'Article' }));
</script>

<fieldset class="min-w-0" {disabled}>
  <legend class="mb-2 text-sm font-bold text-ink-600">{displayedLegend}</legend>
  <div class="grid grid-cols-3 gap-2" aria-label={displayedLegend}>
    {#each articles as article}
      <button
        type="button"
        class:selected={value === article}
        class="article-button"
        aria-pressed={value === article}
        onclick={() => (value = article)}
      >
        {article}
      </button>
    {/each}
  </div>
</fieldset>

<style>
  .article-button {
    min-height: 2.85rem;
    border: 1px solid var(--color-line);
    border-radius: 0.85rem;
    color: var(--color-ink-600);
    background: var(--color-paper-50);
    font-weight: 760;
    transition:
      transform 150ms var(--ease-out-emil),
      color 160ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil),
      border-color 160ms var(--ease-out-emil);
  }

  .article-button:active:not(:disabled) {
    transform: scale(0.97);
  }

  @media (hover: hover) and (pointer: fine) {
    .article-button:hover:not(:disabled) {
      border-color: var(--color-ink-600);
      color: var(--color-ink-950);
    }
  }

  .article-button.selected {
    border-color: var(--color-ink-950);
    color: white;
    background: var(--color-ink-950);
  }
</style>
