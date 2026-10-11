<script lang="ts">
  import { tr } from '$lib/state/app';
  import Languages from '@lucide/svelte/icons/languages';
  import Sparkles from '@lucide/svelte/icons/sparkles';

  let {
    text,
    closing,
    onselect,
  }: {
    text: string;
    closing: boolean;
    onselect: (action: 'translate' | 'explain') => void;
  } = $props();

  const action =
    'inline-flex min-h-[2.6rem] items-center gap-[0.3rem] rounded-[0.58rem] bg-white/10 px-[0.55rem] py-[0.45rem] text-[0.72rem] font-extrabold';
</script>

<!-- Enter 150ms slide+fade, exit 120ms; reduced motion keeps a 120ms fade only. -->
<div
  class="absolute inset-x-[0.6rem] bottom-[calc(5.2rem+var(--safe-bottom))] z-8 grid origin-bottom [transform:translateY(0)_scale(1)] grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-[0.3rem] rounded-[0.8rem] border border-ink-950 bg-ink-950 p-[0.4rem] text-white opacity-100 shadow-[0_10px_35px_rgb(21_25_28/0.25)] [transition:opacity_150ms_var(--ease-out-emil),transform_150ms_var(--ease-out-emil)] data-closing:[transform:translateY(6px)_scale(0.98)] data-closing:opacity-0 data-closing:duration-120 data-closing:ease-(--ease-in-out-emil) motion-reduce:[transform:none] motion-reduce:duration-120! motion-reduce:[transition:opacity_120ms_var(--ease-out-emil)] motion-reduce:data-closing:[transform:none] min-[640px]:inset-x-4 min-[640px]:mx-auto min-[640px]:w-[min(40rem,calc(100vw-2rem))] starting:[transform:translateY(6px)_scale(0.98)] starting:opacity-0 motion-reduce:starting:[transform:none] motion-off:[transform:none] motion-off:duration-120! motion-off:[transition:opacity_120ms_var(--ease-out-emil)] motion-off:data-closing:[transform:none] motion-off:starting:[transform:none]"
  data-testid="selection-toolbar"
  data-closing={closing ? '' : undefined}
  aria-label={$tr('Nástroje k označenému textu', 'Tools for selected text')}
>
  <span class="truncate pl-[0.35rem] font-(family-name:--font-reader) text-[0.62rem] text-white/62"
    >{text.length > 48 ? `${text.slice(0, 48)}…` : text}</span
  >
  <button class={action} type="button" onclick={() => onselect('translate')}
    ><Languages size={16} /> {$tr('Přeložit', 'Translate')}</button
  >
  <button class={action} type="button" onclick={() => onselect('explain')}
    ><Sparkles size={16} /> {$tr('Vysvětlit', 'Explain')}</button
  >
</div>
