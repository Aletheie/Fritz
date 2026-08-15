<script lang="ts">
  let { value, label = 'Postup' } = $props<{ value: number; label?: string }>();
  let progress = $derived(Math.max(0, Math.min(100, value)));
</script>

<div
  class="progress-track"
  role="progressbar"
  aria-label={label}
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={progress}
>
  <span class="progress-fill" style={`transform: scaleX(${progress / 100})`}></span>
</div>

<style>
  .progress-track {
    width: 100%;
    height: 0.45rem;
    overflow: hidden;
    border-radius: 999px;
    background: var(--surface-muted);
  }

  .progress-fill {
    display: block;
    width: 100%;
    height: 100%;
    transform-origin: left center;
    border-radius: inherit;
    background: var(--accent);
    transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    .progress-fill {
      transition: none;
    }
  }
</style>
