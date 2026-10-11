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
        class={[
          'min-h-[2.85rem] rounded-[0.85rem] border font-[760] [transition:transform_150ms_var(--ease-out-emil),color_160ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil),border-color_160ms_var(--ease-out-emil)] active:not-disabled:[transform:scale(0.97)]',
          value === article
            ? 'border-ink-950 bg-ink-950 text-white'
            : 'border-line bg-paper-50 text-ink-600 fine-hover:not-disabled:border-ink-600 fine-hover:not-disabled:text-ink-950',
        ]}
        aria-pressed={value === article}
        onclick={() => (value = article)}
      >
        {article}
      </button>
    {/each}
  </div>
</fieldset>
