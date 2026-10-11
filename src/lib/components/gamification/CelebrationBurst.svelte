<script lang="ts">
  let { visible = true } = $props<{ visible?: boolean }>();
  const particles = Array.from({ length: 14 }, (_, index) => index);
</script>

{#if visible}
  <div class="pointer-events-none absolute top-1/2 left-1/2 size-px" aria-hidden="true">
    {#each particles as particle}
      <i
        class="absolute h-[0.72rem] w-[0.42rem] [transform:rotate(var(--angle))_translateY(-0.8rem)_scale(0.3)] animate-particle rounded-full bg-butter-400 opacity-0 [--angle:calc(var(--index)*25.714deg)] nth-[3n]:bg-mint-700 nth-[3n+1]:bg-coral-700 nth-[4n]:size-2"
        style={`--index:${particle}`}
      ></i>
    {/each}
  </div>
{/if}
