<script lang="ts">
  import { storyGlossaryTier } from '$lib/domain/stories/engine.ts';
  import { storyGlossaryMeaning } from '$lib/i18n/stories.ts';
  import { motherTongue, tr } from '$lib/state/app';

  import type { StoryReaderToken } from '$lib/domain/stories/reading-support.ts';
  import type { CefrLevel } from '$lib/domain/types.ts';

  let {
    rows,
    level,
    article = $bindable(),
    onclick,
    onpointerdown,
    onpointerup,
    onpointercancel,
  }: {
    /** One token row per paragraph. */
    rows: StoryReaderToken[][];
    level: CefrLevel;
    article?: HTMLElement;
    onclick: (event: MouseEvent) => void;
    onpointerdown: (event: PointerEvent) => void;
    onpointerup: (event: PointerEvent) => void;
    onpointercancel: () => void;
  } = $props();
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events (delegated touch/click reader; explicit keyboard word and sentence tools are directly below) -->
<article
  bind:this={article}
  class="mx-auto mt-4 w-[min(100%,65ch)] cursor-text rounded-[0.55rem_1.35rem_0.55rem_0.55rem] border border-ink-950 bg-paper-50 p-[clamp(1.15rem,5vw,2.6rem)] shadow-[5px_6px_0_rgb(21_25_28/0.09)] select-text before:mb-4 before:block before:w-10 before:border-t-[3px] before:border-(--book-accent) before:content-[''] motion-safe:animate-story-page-in lg:mt-3 lg:px-[2.8rem] lg:py-[2.2rem]"
  data-testid="story-text"
  lang="de"
  {onclick}
  {onpointerdown}
  {onpointerup}
  {onpointercancel}
>
  {#each rows as row}
    <p
      class="m-0 font-(family-name:--font-reader) text-[1.125rem] leading-[1.7] tracking-[-0.008em] text-pretty hyphens-auto [font-variation-settings:'opsz'_18] min-[640px]:text-[1.1875rem] lg:text-[1.25rem] lg:leading-[1.65] [&+p]:mt-[1em]"
    >
      {#each row as token}
        {#if token.word}
          {#if token.glossary && token.highlight}
            {@const tier = storyGlossaryTier(token.glossary.cefr, level)}
            {@const meaning = storyGlossaryMeaning(token.glossary, $motherTongue)}
            <button
              class={[
                'relative inline cursor-help border-b-2 border-cobalt-700 leading-[inherit] no-underline select-text after:pointer-events-none after:absolute after:bottom-[calc(100%+0.45rem)] after:left-1/2 after:z-5 after:w-max after:max-w-[min(14rem,70vw)] after:[transform:translate(-50%,0.2rem)] after:rounded-[0.55rem] after:border after:border-ink-950 after:bg-ink-950 after:px-[0.55rem] after:py-[0.38rem] after:font-sans after:text-[0.64rem] after:leading-[1.3] after:font-[720] after:text-white after:opacity-0 after:content-[attr(data-meaning)] after:[transition:opacity_130ms_ease,transform_130ms_ease] focus-visible:after:[transform:translate(-50%,0)] focus-visible:after:opacity-100 motion-reduce:after:[transform:translate(-50%,0)] motion-reduce:after:transition-none fine-hover:after:[transform:translate(-50%,0)] fine-hover:after:opacity-100',
                tier === 'advanced'
                  ? 'rounded-[0.15rem] border-solid bg-cobalt-100 box-decoration-clone px-[0.08em] font-[720]'
                  : 'rounded-none border-dotted',
              ]}
              type="button"
              data-word={token.word}
              data-meaning={meaning}
              data-tier={tier}
              aria-label={`${token.word}: ${meaning}${
                tier === 'advanced'
                  ? $tr(
                      `, pokročilejší výraz úrovně ${token.glossary.cefr}`,
                      `, advanced ${token.glossary.cefr} expression`,
                    )
                  : ''
              }`}>{token.value}</button
            >
          {:else}
            <span
              class="rounded-[0.15rem] fine-hover:bg-acid-100"
              data-testid="story-word"
              data-word={token.word}>{token.value}</span
            >
          {/if}
        {:else}{token.value}{/if}
      {/each}
    </p>
  {/each}
</article>
