<script lang="ts">
  import ProgressBar from '$lib/components/ProgressBar.svelte';

  let {
    value,
    completed,
    total,
    label = 'Postup dnešní lekce',
  } = $props<{
    value: number;
    completed: number;
    total: number;
    label?: string;
  }>();
  let progress = $derived(Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0);
</script>

<div class="lesson-progress">
  <ProgressBar value={progress} {label} />
  <span aria-live="polite" aria-atomic="true">{completed}/{total} · {progress}%</span>
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
    min-width: 5.6rem;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
    font-size: 0.78rem;
    text-align: right;
    white-space: nowrap;
  }
</style>
