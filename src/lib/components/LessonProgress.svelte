<script lang="ts">
  import ProgressBar from '$lib/components/ProgressBar.svelte';

  let { value, label = 'Postup dnešní lekce' } = $props<{ value: number; label?: string }>();
</script>

<div class="lesson-progress">
  <ProgressBar {value} {label} />
  <span aria-live="polite" aria-atomic="true">{value}%</span>
</div>

<style>
  .lesson-progress {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.35rem 0.25rem;
  }

  .lesson-progress :global(.progress-track) {
    flex: 1;
  }

  .lesson-progress > span {
    width: 2.4rem;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
    font-size: 0.78rem;
    text-align: right;
  }
</style>
