<script lang="ts">
  let { eyebrow, title, description } = $props<{
    eyebrow?: string;
    title: string;
    description?: string;
  }>();
</script>

<header class="max-w-3xl">
  {#if eyebrow}<p class="kicker mb-2.5">{eyebrow}</p>{/if}
  <h1
    class="text-[clamp(1.9rem,4.2vw,3rem)] leading-[1.04] font-extrabold tracking-[-0.045em] text-balance"
  >
    {title}
  </h1>
  {#if description}
    <p class="mt-3.5 max-w-2xl text-base leading-relaxed text-ink-600">{description}</p>
  {/if}
</header>
