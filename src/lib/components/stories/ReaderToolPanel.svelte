<script lang="ts">
  import X from '@lucide/svelte/icons/x';

  import type { Snippet } from 'svelte';

  let {
    id,
    kicker,
    title,
    closeLabel,
    onclose,
    children,
  }: {
    id: string;
    kicker: string;
    title: string;
    closeLabel: string;
    onclose: () => void;
    children: Snippet;
  } = $props();
</script>

<aside
  class="mx-auto mt-4 w-[min(100%,46rem)] rounded-[0.55rem_1.1rem_0.55rem_0.55rem] border border-ink-950 bg-paper-50 p-[0.8rem]"
  aria-labelledby={id}
>
  <header class="flex items-center justify-between gap-[0.7rem]">
    <div>
      <span class="font-mono text-[0.54rem] font-extrabold tracking-[0.05em] text-ink-600 uppercase"
        >{kicker}</span
      >
      <h2 class="mt-[0.15rem] text-[0.9rem] font-[860]" {id}>{title}</h2>
    </div>
    <button
      class="grid size-11 place-items-center rounded-full border border-line"
      type="button"
      aria-label={closeLabel}
      onclick={onclose}><X size={18} /></button
    >
  </header>
  {@render children()}
</aside>
