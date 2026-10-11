<script lang="ts">
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Bot from '@lucide/svelte/icons/bot';

  let {
    role,
    text,
  }: { role: 'coach' | 'learner'; /** Omit to show the typing indicator. */ text?: string } =
    $props();

  const avatar =
    'grid size-[1.9rem] flex-none place-items-center rounded-full border border-ink-950 font-mono text-[0.47rem] font-black';
</script>

<article
  class={[
    'mx-auto mb-[0.7rem] flex max-w-[42rem] animate-message-in items-end gap-[0.4rem] motion-reduce:animate-none',
    role === 'learner' && 'justify-end',
  ]}
  data-testid="{role}-message"
>
  {#if role === 'coach'}<span class="{avatar} bg-acid-500"><Bot size={16} /></span>{/if}
  {#if text === undefined}
    <div
      class="flex min-w-14 gap-[0.24rem] rounded-[0.45rem_1rem_1rem_1rem] border border-ink-950 bg-paper-50 px-[0.82rem] py-[0.9rem] shadow-[2px_2px_0_rgb(21_25_28/0.13)]"
    >
      {#each [0, 120, 240] as delay}<i
          class="size-[0.35rem] animate-typing rounded-full bg-ink-600"
          style:animation-delay={`${delay}ms`}
        ></i>{/each}
    </div>
  {:else}
    <div
      class={[
        'max-w-[min(82%,29rem)] border border-ink-950 px-[0.82rem] py-[0.72rem] text-[clamp(0.84rem,3.8vw,1rem)] leading-[1.42] font-[660]',
        role === 'learner'
          ? 'rounded-[1rem_0.45rem_1rem_1rem] bg-ink-950 text-white shadow-[2px_2px_0_var(--color-cobalt-300)]'
          : 'rounded-[0.45rem_1rem_1rem_1rem] bg-paper-50 shadow-[2px_2px_0_rgb(21_25_28/0.13)]',
      ]}
      data-testid="message-bubble"
      lang="de"
    >
      {text}
    </div>
  {/if}
  {#if role === 'learner'}<span class="{avatar} bg-ink-950 text-white"
      >{localized($motherTongue, { cs: 'TY', en: 'YOU' })}</span
    >{/if}
</article>
