<script lang="ts">
  let {
    value,
    label,
    showValue = false,
    class: className = '',
  } = $props<{ value: number; label: string; showValue?: boolean; class?: string }>();
  let clamped = $derived(Math.min(100, Math.max(0, value)));
</script>

<div class={className}>
  {#if showValue}
    <div class="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-ink-600">
      <span>{label}</span>
      <span>{Math.round(clamped)} %</span>
    </div>
  {/if}
  <div
    class="h-[0.65rem] overflow-hidden rounded-full border border-ink-950 bg-paper-200"
    role="progressbar"
    aria-label={label}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(clamped)}
  >
    <div
      class="h-full w-full origin-left rounded-[inherit] bg-acid-500 transition-transform duration-260 ease-out-emil"
      style:transform={`scaleX(${clamped / 100})`}
    ></div>
  </div>
</div>
