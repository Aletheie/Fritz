<script lang="ts">
  import type { Component } from 'svelte';

  let {
    icon: Icon,
    kicker,
    title,
    id,
  }: {
    icon: Component<{ size?: number; 'aria-hidden'?: boolean | 'true' }>;
    kicker: string;
    title: string;
    id?: string;
  } = $props();
</script>

<div class="flex items-center gap-[0.65rem]">
  <span class="text-cobalt-700"><Icon size={20} aria-hidden="true" /></span>
  <div>
    <p class="font-mono text-[0.62rem] font-extrabold tracking-[0.075em] text-coral-700 uppercase">
      {kicker}
    </p>
    <h2 class="mt-[0.12rem] text-[1rem] font-[850]" {id}>{title}</h2>
  </div>
</div>
