<script lang="ts">
  import VocabularyEditor from '$lib/components/vocabulary/VocabularyEditor.svelte';
  import type { ImportedNoteDraft } from '$lib/domain/types.ts';
  import { displayGerman } from '$lib/domain/vocabulary/display.ts';
  import { draftHasRequiredFields } from '$lib/domain/vocabulary/validation.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import { onMount } from 'svelte';

  let {
    draft = $bindable(),
    selected = $bindable(true),
    index,
    duplicate = false,
  } = $props<{
    draft: ImportedNoteDraft;
    selected: boolean;
    index: number;
    duplicate?: boolean;
  }>();

  let valid = $derived(draftHasRequiredFields(draft));
  let entering = $state(true);

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  onMount(() => {
    const timer = window.setTimeout(() => (entering = false), Math.min(index, 3) * 30 + 200);
    return () => window.clearTimeout(timer);
  });

  $effect(() => {
    if (duplicate && selected) selected = false;
  });
</script>

<article
  class:inactive={!selected}
  class="ai-card"
  data-entering={entering ? '' : undefined}
  style={`--result-delay:${Math.min(index, 3) * 30}ms`}
>
  <div class="card-heading">
    <label class="select-control">
      <input type="checkbox" bind:checked={selected} disabled={duplicate} />
      <span class:selected aria-hidden="true"
        >{#if selected}<Check size={14} />{/if}</span
      >
      <span class="sr-only">{copy(`Vybrat kartičku ${index + 1}`, `Select card ${index + 1}`)}</span
      >
    </label>
    <span class="ai-mark"><Sparkles size={15} /> {copy('AI návrh', 'AI draft')}</span>
    <div class="min-w-0 flex-1">
      <p class="truncate font-extrabold">{displayGerman(draft)}</p>
      <p class="truncate text-sm text-ink-600">
        {draft.czech || copy('Chybí český význam', 'English meaning is missing')}
      </p>
    </div>
    {#if duplicate}
      <span class="issue duplicate"
        ><AlertTriangle size={14} /> {copy('už existuje', 'already exists')}</span
      >
    {:else if !valid}
      <span class="issue"
        ><AlertTriangle size={14} /> {copy('doplň povinné údaje', 'complete required fields')}</span
      >
    {/if}
  </div>

  <details>
    <summary>
      {copy('Zkontrolovat a upravit', 'Review and edit')}
      <ChevronDown size={17} />
    </summary>
    <div class="editor-wrap">
      <VocabularyEditor bind:draft idPrefix={`ai-${index}`} compact />
    </div>
  </details>
</article>

<style>
  .ai-card {
    overflow: hidden;
    border: 1px solid var(--color-line);
    border-radius: 1.2rem;
    background: var(--color-paper-50);
    opacity: 1;
    transform: translateY(0);
    transition:
      opacity 180ms var(--ease-out-emil),
      transform 180ms var(--ease-out-emil),
      border-color 170ms var(--ease-out-emil);
  }

  .ai-card[data-entering] {
    transition-delay: var(--result-delay), var(--result-delay), 0ms;
  }

  @starting-style {
    .ai-card[data-entering] {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  .ai-card.inactive {
    opacity: 0.55;
  }

  .card-heading {
    display: flex;
    min-height: 4.5rem;
    align-items: center;
    gap: 0.8rem;
    padding: 0.9rem 1rem;
  }

  .select-control {
    flex: none;
    cursor: pointer;
  }
  .select-control input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .select-control > span:not(.sr-only) {
    display: grid;
    width: 1.6rem;
    height: 1.6rem;
    place-items: center;
    border: 1px solid var(--color-line);
    border-radius: 0.5rem;
    background: white;
  }
  .select-control > span.selected {
    border-color: var(--color-ink-950);
    color: white;
    background: var(--color-ink-950);
  }
  .select-control:has(input:focus-visible) > span:not(.sr-only) {
    outline: 3px solid var(--color-sky-200);
    outline-offset: 2px;
  }

  .ai-mark {
    display: none;
    align-items: center;
    gap: 0.32rem;
    border-radius: 999px;
    color: var(--color-sky-700);
    background: var(--color-sky-50);
    padding: 0.32rem 0.55rem;
    font-size: 0.68rem;
    font-weight: 800;
  }

  .issue {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 0.35rem;
    border-radius: 999px;
    color: var(--color-coral-700);
    background: var(--color-coral-50);
    padding: 0.35rem 0.55rem;
    font-size: 0.68rem;
    font-weight: 780;
  }
  .issue.duplicate {
    color: var(--color-butter-600);
    background: var(--color-butter-50);
  }

  details {
    border-top: 1px solid var(--color-line);
  }
  summary {
    display: flex;
    min-height: 2.9rem;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 1rem;
    color: var(--color-ink-600);
    font-size: 0.78rem;
    font-weight: 760;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary :global(svg) {
    transition: transform 180ms var(--ease-out-emil);
  }
  details[open] summary :global(svg) {
    transform: rotate(180deg);
  }
  .editor-wrap {
    border-top: 1px solid var(--color-line);
    background: var(--color-paper-100);
    padding: 1rem;
  }

  @media (min-width: 720px) {
    .ai-mark {
      display: inline-flex;
    }
  }

  :global(html[data-motion='reduced']) .ai-card {
    transform: none;
    transition-property: opacity;
    transition-duration: 140ms !important;
    transition-delay: 0ms !important;
  }

  @starting-style {
    :global(html[data-motion='reduced']) .ai-card[data-entering] {
      opacity: 0;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ai-card {
      transform: none;
      transition-property: opacity;
      transition-duration: 140ms !important;
      transition-delay: 0ms !important;
    }

    @starting-style {
      .ai-card[data-entering] {
        opacity: 0;
        transform: none;
      }
    }
  }
</style>
