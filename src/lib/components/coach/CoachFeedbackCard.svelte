<script lang="ts">
  import { mistakeLabel } from '$lib/i18n/mistakes.ts';
  import { motherTongue, tr } from '$lib/state/app';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';

  import type { AiCoachResult } from '$lib/domain/ai/types.ts';

  let {
    result,
    canDispute,
    disputed,
    ontoggledispute,
  }: {
    result: AiCoachResult;
    /** The latest turn has diagnostics the learner may reject. */
    canDispute: boolean;
    disputed: boolean;
    ontoggledispute: () => void;
  } = $props();

  const divider = 'border-t border-[rgb(21_25_28/0.12)]';
</script>

<aside
  class={[
    'mx-auto mt-[0.2rem] mb-[0.85rem] max-w-[42rem] animate-rise-in rounded-[0.55rem_1.1rem_0.55rem_0.55rem] border p-3 motion-reduce:animate-none',
    result.accepted ? 'border-mint-700 bg-mint-50' : 'border-butter-600 bg-butter-50',
  ]}
>
  <div class="flex items-center gap-[0.4rem]">
    {#if result.accepted}<CheckCircle2 size={17} />{:else}<Lightbulb size={17} />{/if}
    <strong class="text-[0.72rem] font-[850]"
      >{result.accepted
        ? $tr('Reakce funguje', 'Your response works')
        : result.outcome === 'needs-support'
          ? $tr('Pomůžeme ji doplnit', "Let's build the answer")
          : $tr('Zkus jinou odpověď', 'Try another answer')}</strong
    >
    <span class="ml-auto font-mono text-[0.58rem] font-[850]"
      >{result.accepted ? `${result.score}/100` : $tr('bez postupu', 'no progress')}</span
    >
  </div>
  <p class="mt-[0.45rem] mb-0 text-[0.68rem] leading-[1.45] text-ink-600">{result.feedback}</p>
  {#if result.correction}
    <div class="{divider} mt-[0.55rem] pt-2">
      <span class="block font-mono text-[0.5rem] font-extrabold text-ink-600 uppercase"
        >{$tr('Lepší verze', 'Better version')}</span
      ><strong class="mt-[0.15rem] block text-[0.75rem]" lang="de">{result.correction}</strong>
    </div>
  {/if}
  {#if canDispute && result.diagnostics.length > 0}
    <div class="{divider} mt-[0.6rem] flex items-center justify-between gap-[0.6rem] pt-[0.55rem]">
      <span class="text-[0.63rem] font-[720] text-ink-700">
        {disputed
          ? $tr('Tuhle opravu do plánu nepočítáme.', 'This correction will not affect the plan.')
          : result.diagnostics
              .map((diagnostic) => mistakeLabel(diagnostic.tag, $motherTongue))
              .join(' · ')}
      </span>
      <button
        class="flex-none border-0 bg-transparent p-1 text-[0.62rem] font-extrabold text-cobalt-700 underline underline-offset-[0.18rem]"
        type="button"
        onclick={ontoggledispute}
      >
        {disputed
          ? $tr('Vrátit hodnocení', 'Restore assessment')
          : $tr('Hodnocení nesedí', 'This assessment is off')}
      </button>
    </div>
  {/if}
  <small class="mt-2 block text-[0.63rem] leading-[1.42] font-[760]">{result.nextHint}</small>
</aside>
