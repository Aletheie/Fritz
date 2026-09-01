<script lang="ts">
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  let { value, size = 76, label } = $props<{ value: number; size?: number; label?: string }>();
  let clamped = $derived(Math.min(100, Math.max(0, value)));
</script>

<div
  class="ring"
  style:width={`${size}px`}
  style:height={`${size}px`}
  style:--progress={`${clamped * 3.6}deg`}
  aria-label={label ?? localized($motherTongue, { cs: 'Průběh', en: 'Progress' })}
  role="progressbar"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={Math.round(clamped)}
>
  <div class="inner">
    <strong>{Math.round(clamped)}%</strong>
  </div>
</div>

<style>
  .ring {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 999px;
    background: conic-gradient(var(--color-mint-700) var(--progress), var(--color-paper-200) 0);
  }

  .inner {
    display: grid;
    width: calc(100% - 9px);
    height: calc(100% - 9px);
    place-items: center;
    border-radius: 999px;
    background: var(--color-paper-50);
  }

  strong {
    font-size: 0.88rem;
    font-variant-numeric: tabular-nums;
  }
</style>
