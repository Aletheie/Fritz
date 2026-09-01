<script lang="ts">
  let {
    value,
    label,
    showValue = false,
  } = $props<{ value: number; label: string; showValue?: boolean }>();
  let clamped = $derived(Math.min(100, Math.max(0, value)));
</script>

<div class="progress-wrap">
  {#if showValue}
    <div class="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-ink-600">
      <span>{label}</span>
      <span>{Math.round(clamped)} %</span>
    </div>
  {/if}
  <div
    class="progress-track"
    role="progressbar"
    aria-label={label}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(clamped)}
  >
    <div class="progress-fill" style:transform={`scaleX(${clamped / 100})`}></div>
  </div>
</div>

<style>
  .progress-track {
    height: 0.65rem;
    overflow: hidden;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    background: var(--color-paper-200);
  }

  .progress-fill {
    width: 100%;
    height: 100%;
    transform-origin: left center;
    border-radius: inherit;
    background: var(--color-acid-500);
    transition: transform 260ms var(--ease-out-emil);
  }
</style>
