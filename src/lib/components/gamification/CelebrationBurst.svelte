<script lang="ts">
  let { visible = true } = $props<{ visible?: boolean }>();
  const particles = Array.from({ length: 14 }, (_, index) => index);
</script>

{#if visible}
  <div class="burst" aria-hidden="true">
    {#each particles as particle}
      <i style={`--index:${particle}`}></i>
    {/each}
  </div>
{/if}

<style>
  .burst {
    position: absolute;
    inset: 50% auto auto 50%;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }

  i {
    --angle: calc(var(--index) * 25.714deg);
    position: absolute;
    width: 0.42rem;
    height: 0.72rem;
    border-radius: 999px;
    background: var(--color-butter-400);
    opacity: 0;
    transform: rotate(var(--angle)) translateY(-0.8rem) scale(0.3);
    animation: particle 700ms var(--ease-out-emil) calc(var(--index) * 12ms) both;
  }

  i:nth-child(3n) {
    background: var(--color-mint-700);
  }
  i:nth-child(3n + 1) {
    background: var(--color-coral-700);
  }
  i:nth-child(4n) {
    width: 0.5rem;
    height: 0.5rem;
  }

  @keyframes particle {
    0% {
      opacity: 0;
      transform: rotate(var(--angle)) translateY(-0.8rem) scale(0.3);
    }
    22% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: rotate(var(--angle)) translateY(-5rem) scale(1);
    }
  }
</style>
