<script lang="ts">
  import { t } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Sparkles from '@lucide/svelte/icons/sparkles';

  let {
    closing,
    height = $bindable(0),
    ondismiss,
  }: { closing: boolean; height?: number; ondismiss: () => void } = $props();
</script>

<!-- Enter/exit: 260ms slide+fade, 160ms exit; reduced motion keeps a 160ms fade only. -->
<aside
  class="fixed inset-x-3 bottom-[calc(5.6rem+var(--safe-bottom))] z-60 grid origin-bottom [transform:translateY(0)_scale(1)] grid-cols-[auto_minmax(0,1fr)] gap-[0.7rem] rounded-2xl border border-ink-950 bg-ink-950 p-[0.85rem] text-white opacity-100 shadow-[0_18px_50px_rgb(21_25_28/0.28)] [transition:opacity_260ms_var(--ease-out-emil),transform_260ms_var(--ease-out-emil)] data-closing:[transform:translateY(12px)_scale(0.98)] data-closing:opacity-0 data-closing:duration-160 data-closing:ease-(--ease-in-out-emil) motion-reduce:[transform:none] motion-reduce:duration-160! motion-reduce:[transition:opacity_160ms_var(--ease-out-emil)] motion-reduce:data-closing:[transform:none] min-[640px]:right-4 min-[640px]:bottom-4 min-[640px]:left-auto min-[640px]:w-[min(25rem,calc(100vw-2rem))] lg:right-5 lg:bottom-5 starting:[transform:translateY(12px)_scale(0.98)] starting:opacity-0 motion-reduce:starting:[transform:none] motion-off:[transform:none] motion-off:duration-160! motion-off:[transition:opacity_160ms_var(--ease-out-emil)] motion-off:data-closing:[transform:none] motion-off:starting:[transform:none]"
  data-testid="reward-notice"
  bind:clientHeight={height}
  data-closing={closing ? '' : undefined}
  aria-live="polite"
>
  <button
    class="absolute top-1 right-[0.45rem] text-[1.3rem] leading-none text-white/55"
    type="button"
    aria-label={t($motherTongue, 'shell.closeNotice')}
    onclick={ondismiss}>×</button
  >
  <span class="grid size-10 place-items-center rounded-xl bg-acid-500 text-ink-950"
    ><Sparkles size={20} /></span
  >
  <div class="pr-4">
    <strong class="block text-[0.83rem] leading-[1.25]"
      >{t($motherTongue, 'shell.rewardTitle')}</strong
    >
    <p class="mt-[0.22rem] mb-0 text-[0.66rem] leading-[1.4] text-white/58">
      {t($motherTongue, 'shell.rewardDescription')}
    </p>
  </div>
  <a
    class="col-span-full min-h-[2.45rem] rounded-[0.68rem] bg-acid-500 p-[0.68rem] text-center text-[0.73rem] font-[850] text-ink-950"
    href="/reward/">{t($motherTongue, 'shell.openReward')}</a
  >
</aside>
