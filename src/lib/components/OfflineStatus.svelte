<script lang="ts">
  import { onMount } from 'svelte';

  let online = $state(true);

  onMount(() => {
    const updateStatus = () => {
      online = navigator.onLine;
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  });
</script>

{#if !online}
  <p class="offline-status" role="status" aria-live="polite">
    <span class="offline-dot" aria-hidden="true"></span>
    Bez připojení · změny zůstanou v zařízení
  </p>
{/if}

<style>
  .offline-status {
    display: flex;
    width: min(100%, 72rem);
    align-items: center;
    gap: 0.5rem;
    margin: 1rem auto 0;
    border: 1px solid var(--line);
    border-radius: 0.65rem;
    padding: 0.65rem 0.8rem;
    color: var(--ink);
    background: var(--accent-soft);
    font-size: 0.82rem;
    font-weight: 650;
  }

  .offline-dot {
    width: 0.5rem;
    height: 0.5rem;
    flex: 0 0 auto;
    border-radius: 50%;
    background: var(--cobalt);
  }
</style>
