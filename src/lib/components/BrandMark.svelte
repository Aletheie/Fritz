<script lang="ts">
  let { size = 32 } = $props<{ size?: number }>();
</script>

<span class="brand-mark" style={`width: ${size}px; height: ${size}px`} aria-hidden="true">W</span>

<style>
  .brand-mark {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid var(--ink);
    border-radius: 0.6rem;
    color: var(--ink);
    background: var(--accent);
    box-shadow: 2px 2px 0 var(--ink);
    font-size: 0.9rem;
    font-weight: 850;
  }
</style>
