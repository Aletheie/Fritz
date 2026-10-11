<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  let {
    icon: Icon,
    kicker,
    title,
    titleId,
    description,
    descriptionId,
    large = false,
    id,
    testId,
    aside,
    children,
  }: {
    icon: Component<{ size?: number; 'aria-hidden'?: boolean | 'true' }>;
    kicker: string;
    title: string;
    titleId?: string;
    description?: string;
    descriptionId?: string;
    /** Larger, fixed-size heading for the first sheet. */
    large?: boolean;
    id?: string;
    testId?: string;
    aside?: Snippet;
    children: Snippet;
  } = $props();
</script>

<section
  class="relative grid grid-cols-[2.7rem_minmax(0,1fr)] overflow-hidden rounded-[0.3rem] border border-ink-950 bg-paper-50 shadow-[5px_5px_0_var(--color-ink-950)]"
  {id}
  data-testid={testId}
  aria-labelledby={titleId}
>
  <div
    class="grid place-items-start justify-center border-r border-coral-500 bg-paper-100 pt-5 text-coral-700"
  >
    <Icon size={large ? 22 : 20} aria-hidden="true" />
  </div>
  <div class="min-w-0 p-[1.2rem] min-[640px]:p-6">
    <div
      class={[
        'flex justify-between',
        description ? 'items-start gap-4 max-[601px]:grid' : 'flex-wrap items-center gap-[0.8rem]',
      ]}
    >
      <div>
        <p
          class="font-mono text-[0.62rem] font-extrabold tracking-[0.075em] text-coral-700 uppercase"
        >
          {kicker}
        </p>
        <h2
          class={[
            'mt-[0.15rem] font-black',
            large
              ? 'text-[1.7rem] tracking-[-0.035em]'
              : 'text-[clamp(1.25rem,3vw,1.7rem)] tracking-[-0.04em]',
          ]}
          id={titleId}
        >
          {title}
        </h2>
        {#if description}
          <p
            class="mt-[0.35rem] max-w-[65ch] text-[0.78rem] leading-normal text-ink-800"
            id={descriptionId}
          >
            {description}
          </p>
        {/if}
      </div>
      {@render aside?.()}
    </div>
    {@render children()}
  </div>
</section>
