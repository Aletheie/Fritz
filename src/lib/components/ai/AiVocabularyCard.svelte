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

  const reducedMotion =
    'motion-reduce:[transform:none] motion-reduce:transition-[opacity] motion-reduce:duration-140! motion-reduce:delay-0! motion-reduce:data-entering:starting:[transform:none] motion-off:[transform:none] motion-off:transition-[opacity] motion-off:duration-140! motion-off:delay-0! motion-off:data-entering:starting:[transform:none]';
  const issue =
    'inline-flex flex-none items-center gap-[0.35rem] rounded-full px-[0.55rem] py-[0.35rem] text-[0.68rem] font-[780]';
</script>

<article
  data-testid="ai-card"
  class={[
    '[transform:translateY(0)] overflow-hidden rounded-[1.2rem] border border-line bg-paper-50 [transition:opacity_180ms_var(--ease-out-emil),transform_180ms_var(--ease-out-emil),border-color_170ms_var(--ease-out-emil)] data-entering:[transition-delay:var(--result-delay),var(--result-delay),0ms] data-entering:starting:[transform:translateY(6px)] data-entering:starting:opacity-0',
    reducedMotion,
    selected ? 'opacity-100' : 'opacity-55',
  ]}
  data-entering={entering ? '' : undefined}
  style={`--result-delay:${Math.min(index, 3) * 30}ms`}
>
  <div class="flex min-h-[4.5rem] items-center gap-[0.8rem] px-4 py-[0.9rem]">
    <label class="group flex-none cursor-pointer">
      <input
        class="absolute size-px opacity-0"
        type="checkbox"
        bind:checked={selected}
        disabled={duplicate}
      />
      <span
        class={[
          'grid size-[1.6rem] place-items-center rounded-lg border group-has-[input:focus-visible]:outline-3 group-has-[input:focus-visible]:outline-offset-2 group-has-[input:focus-visible]:outline-sky-200',
          selected ? 'border-ink-950 bg-ink-950 text-white' : 'border-line bg-white',
        ]}
        aria-hidden="true"
        >{#if selected}<Check size={14} />{/if}</span
      >
      <span class="sr-only">{copy(`Vybrat kartičku ${index + 1}`, `Select card ${index + 1}`)}</span
      >
    </label>
    <span
      class="hidden items-center gap-[0.32rem] rounded-full bg-sky-50 px-[0.55rem] py-[0.32rem] text-[0.68rem] font-extrabold text-sky-700 min-[720px]:inline-flex"
      ><Sparkles size={15} /> {copy('AI návrh', 'AI draft')}</span
    >
    <div class="min-w-0 flex-1">
      <p class="truncate font-extrabold">{displayGerman(draft)}</p>
      <p class="truncate text-sm text-ink-600">
        {draft.czech || copy('Chybí český význam', 'English meaning is missing')}
      </p>
    </div>
    {#if duplicate}
      <span class="{issue} bg-butter-50 text-butter-600"
        ><AlertTriangle size={14} /> {copy('už existuje', 'already exists')}</span
      >
    {:else if !valid}
      <span class="{issue} bg-coral-50 text-coral-700"
        ><AlertTriangle size={14} /> {copy('doplň povinné údaje', 'complete required fields')}</span
      >
    {/if}
  </div>

  <details class="group/details border-t border-line">
    <summary
      class="flex min-h-[2.9rem] cursor-pointer list-none items-center justify-between gap-4 px-4 py-[0.65rem] text-[0.78rem] font-[760] text-ink-600 [&::-webkit-details-marker]:hidden"
    >
      {copy('Zkontrolovat a upravit', 'Review and edit')}
      <ChevronDown
        class="transition-transform duration-180 ease-out-emil group-open/details:rotate-180"
        size={17}
      />
    </summary>
    <div class="border-t border-line bg-paper-100 p-4">
      <VocabularyEditor bind:draft idPrefix={`ai-${index}`} compact />
    </div>
  </details>
</article>
