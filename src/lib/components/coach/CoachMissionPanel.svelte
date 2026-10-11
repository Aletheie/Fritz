<script lang="ts">
  import { tr } from '$lib/state/app';
  import Bot from '@lucide/svelte/icons/bot';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import Sparkles from '@lucide/svelte/icons/sparkles';

  import type { CoachScenario } from '$lib/domain/course/coach.ts';

  let {
    scenario,
    focusWords,
    onuse,
  }: { scenario: CoachScenario; focusWords: string[]; onuse: (word: string) => void } = $props();
</script>

<aside
  class="hidden min-h-0 overflow-y-auto border-r border-ink-950 bg-ink-950 p-[1.2rem] text-white min-[860px]:block"
>
  <div class="flex gap-3">
    <span
      class="grid size-12 flex-none place-items-center rounded-[0.5rem_1rem_0.5rem_0.5rem] border border-acid-500 bg-acid-500 text-ink-950"
      ><Bot size={23} /></span
    >
    <div>
      <p class="kicker text-white/48">{$tr('Dnešní mise', "Today's mission")}</p>
      <h2 class="mt-[0.35rem] text-[1.1rem] leading-[1.1] font-[880] tracking-[-0.035em]">
        {scenario.goal}
      </h2>
    </div>
  </div>
  <div
    class="mt-4 flex flex-wrap gap-[0.35rem] [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1 [&>span]:rounded-full [&>span]:border [&>span]:border-white/14 [&>span]:bg-white/6 [&>span]:px-2 [&>span]:py-[0.35rem] [&>span]:font-mono [&>span]:text-[0.53rem] [&>span]:font-[760] [&>span]:text-white/62"
  >
    <span><Clock3 size={14} /> {scenario.minutes} min</span>
    <span>{scenario.level}</span>
    <span><Sparkles size={14} /> {$tr('až 25 XP', 'up to 25 XP')}</span>
  </div>
  <div class="mt-[1.4rem] border-t border-white/14 pt-4">
    <p
      class="mt-0 mb-2 font-mono text-[0.55rem] font-extrabold tracking-[0.06em] text-white/45 uppercase"
    >
      {$tr('Zkus použít', 'Try to use')}
    </p>
    {#each focusWords as word}<button
        class="mt-[0.4rem] block w-full rounded-lg border border-white/14 bg-white/6 px-[0.65rem] py-[0.55rem] text-left text-[0.72rem] font-bold text-white [transition:background-color_150ms_var(--ease-out-emil),transform_150ms_var(--ease-out-emil)] active:[transform:scale(0.98)] fine-hover:bg-white/12"
        type="button"
        lang="de"
        onclick={() => onuse(word)}>{word}</button
      >{/each}
  </div>
  <div class="mt-[1.2rem] flex gap-2 rounded-[0.6rem] bg-acid-500 p-3 text-ink-950">
    <Lightbulb class="flex-none" size={16} />
    <p class="m-0 text-[0.65rem] leading-[1.45] font-[760]">
      {scenario.guidedHints
        ? $tr(
            'Ke každé replice máš český význam i použitelný německý vzor.',
            'Each turn includes a useful German model answer.',
          )
        : $tr(
            'Stačí krátká srozumitelná věta. AI opraví vždy jen to nejdůležitější.',
            'A short, clear sentence is enough. AI corrects only the most important issue.',
          )}
    </p>
  </div>
</aside>
