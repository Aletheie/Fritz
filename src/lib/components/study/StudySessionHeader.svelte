<script lang="ts">
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import { appStore, tr } from '$lib/state/app';
  import Brain from '@lucide/svelte/icons/brain';
  import Pause from '@lucide/svelte/icons/pause';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Target from '@lucide/svelte/icons/target';
  import X from '@lucide/svelte/icons/x';

  let {
    sprint,
    progress,
    done,
    total,
    scope,
    pace,
    xp,
    onpause,
  }: {
    /** Cram sprint rather than long-term review. */
    sprint: boolean;
    progress: number;
    done: number;
    total: number;
    scope: string;
    pace: string;
    xp: number;
    onpause: () => void;
  } = $props();

  const badge =
    'inline-flex min-h-[2.3rem] items-center gap-[0.35rem] rounded-full border border-line bg-paper-50 px-[0.65rem] py-[0.45rem] text-[0.68rem] font-extrabold whitespace-nowrap';
</script>

<header
  class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.8rem] max-[900px]:relative max-[900px]:z-20 max-[900px]:gap-[0.65rem] max-[900px]:border-b max-[900px]:border-ink-950 max-[900px]:bg-[rgb(255_253_247/0.96)] max-[900px]:px-3 max-[900px]:pt-[max(0.55rem,env(safe-area-inset-top))] max-[900px]:pb-[0.65rem] max-[900px]:backdrop-blur-[14px] min-[900px]:grid-cols-[auto_minmax(0,1fr)_auto]"
>
  <a
    class="inline-flex min-h-11 items-center justify-center gap-[0.45rem] rounded-[0.25rem] border border-ink-950 bg-paper-50 px-[0.72rem] text-[0.72rem] font-[820] text-ink-950 shadow-[3px_3px_0_var(--color-ink-950)] [transition:transform_140ms_var(--ease-out-emil),box-shadow_140ms_var(--ease-out-emil)] active:[transform:translate(2px,2px)_scale(0.97)] active:shadow-[1px_1px_0_var(--color-ink-950)] max-[900px]:min-h-[2.55rem] max-[900px]:shadow-[2px_2px_0_var(--color-ink-950)] max-[521px]:min-h-[2.45rem] max-[521px]:w-[2.6rem] max-[521px]:px-0 max-[521px]:[&>span]:hidden"
    href="/"
    aria-label={sprint
      ? $tr('Ukončit sprint', 'End sprint')
      : $tr('Pozastavit studijní dávku', 'Pause study batch')}
    onclick={onpause}
  >
    {#if sprint}<X size={18} /><span>{$tr('Ukončit', 'End')}</span>{:else}<Pause size={18} /><span
        >{$tr('Pozastavit', 'Pause')}</span
      >{/if}
  </a>
  <div class="min-w-0">
    <div
      class="mb-[0.45rem] flex items-center justify-between gap-4 text-[0.72rem] font-[780] tracking-[0.06em] text-ink-600 uppercase max-[900px]:mb-[0.32rem] max-[900px]:text-[0.61rem] max-[900px]:tracking-[0.045em]"
    >
      <span class="inline-flex items-center gap-[0.4rem]">
        {#if sprint}<Target size={14} />
          {$tr('Sprint na test', 'Test sprint')}{:else}<Brain size={14} />
          {$tr('Opakování slovíček', 'Vocabulary review')}{/if}
      </span>
      <span>
        {done}/{total}
        {sprint ? $tr('jistých', 'confident') : $tr('hotovo', 'done')}
      </span>
    </div>
    <ProgressBar value={progress} label={$tr('Postup studijní dávkou', 'Study batch progress')} />
  </div>
  <div class="hidden items-center gap-2 min-[900px]:flex">
    {#if !sprint}
      <span class="{badge} max-w-36 truncate text-cobalt-700">{scope}</span>
    {/if}
    <span class={badge}>{pace}</span>
    {#if $appStore.settings?.gamificationEnabled}
      <span class="{badge} text-orange-700"><Sparkles size={14} /> {xp} XP</span>
    {/if}
  </div>
</header>
