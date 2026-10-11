<script lang="ts">
  import CelebrationBurst from '$lib/components/gamification/CelebrationBurst.svelte';
  import { mistakeLabel } from '$lib/i18n/mistakes.ts';
  import { motherTongue, tr } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';

  import type { ConversationController } from '$lib/state/conversation.svelte.ts';

  let {
    conversation,
    turns,
    saved,
    saving,
    rewarded,
    celebrate,
    onPath,
    error,
    onsave,
    onrestart,
  }: {
    conversation: ConversationController;
    turns: number;
    saved: boolean;
    saving: boolean;
    /** XP was awarded when the result was saved. */
    rewarded: boolean;
    celebrate: boolean;
    onPath: boolean;
    error: string;
    onsave: () => void;
    onrestart: () => void;
  } = $props();

  const hasDiagnostics = $derived(conversation.activeDiagnostics().length > 0);
  const width = 'w-[min(100%,34rem)]';
</script>

<section
  class="absolute inset-0 z-10 flex animate-complete-in flex-col items-center justify-start overflow-y-auto bg-paper-50 px-4 pt-[calc(1.2rem+var(--safe-top))] pb-[calc(1.2rem+var(--safe-bottom))] text-center motion-reduce:animate-none"
  aria-live="polite"
>
  <CelebrationBurst visible={saved && celebrate} />
  <div
    class="relative grid size-[4.2rem] place-items-center rounded-xl border border-ink-950 bg-acid-500 shadow-[3px_3px_0_var(--color-ink-950)]"
  >
    <CheckCircle2 size={27} />
  </div>
  <p class="mt-5 text-[0.72rem] font-[760] text-ink-700">
    {$tr('Rozhovor je u konce', 'Conversation complete')}
  </p>
  <h2
    class="mt-[0.35rem] max-w-[20ch] text-[2rem] leading-[1.05] font-[880] tracking-[-0.035em] text-balance"
  >
    {$tr('Domluvila ses v celé situaci.', 'You handled the whole situation.')}
  </h2>
  <p class="mt-[0.8rem] mb-0 max-w-[32rem] text-[0.8rem] leading-[1.55] text-ink-600">
    {hasDiagnostics
      ? $tr(
          'Tady najdeš, co si v dalším rozhovoru ještě procvičit.',
          'Here’s what to practise in your next conversation.',
        )
      : $tr(
          'Odpovědi byly srozumitelné. Žádná chyba se neopakovala.',
          'Your replies were clear, with no repeated mistakes.',
        )}
  </p>
  {#if hasDiagnostics}
    <div class="{width} mt-[1.2rem] border-y border-line">
      {#each conversation.turns as turn, index (turn.id)}
        {#if !turn.diagnosticsIgnored && turn.result.diagnostics.length}
          <div
            class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.7rem] py-3 text-left [&+div]:border-t [&+div]:border-line"
          >
            <span class="text-[0.65rem] text-ink-600">{$tr('Replika', 'Reply')} {index + 1}</span>
            <strong class="text-[0.75rem] font-extrabold">
              {turn.result.diagnostics
                .map((diagnostic) => mistakeLabel(diagnostic.tag, $motherTongue))
                .join(' · ')}
            </strong>
            {#if !saved}
              <button
                class="flex-none border-0 bg-transparent p-1 text-[0.62rem] font-extrabold text-cobalt-700 underline underline-offset-[0.18rem]"
                type="button"
                onclick={() => conversation.ignoreDiagnostics(turn.id)}
              >
                {$tr('Hodnocení nesedí', 'This assessment is off')}
              </button>
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
  <dl
    class="{width} mx-0 mt-4 mb-0 grid gap-[0.45rem] [&_dd]:m-0 [&_dd]:text-right [&_dd]:text-[0.68rem] [&_dd]:font-[780] [&_dt]:text-[0.68rem] [&_dt]:text-ink-600 [&>div]:flex [&>div]:justify-between [&>div]:gap-4 [&>div]:border-b [&>div]:border-line [&>div]:pb-[0.45rem] [&>div]:text-left"
  >
    <div>
      <dt>{$tr('Vlastní repliky', 'Original replies')}</dt>
      <dd>{turns}</dd>
    </div>
    <div>
      <dt>{$tr('Orientační skóre', 'Indicative score')}</dt>
      <dd>{conversation.averageScore}/100</dd>
    </div>
    <div>
      <dt>{$tr('Ukládá se', 'Stored')}</dt>
      <dd>{$tr('jen výsledek a typ chyby', 'result and error type only')}</dd>
    </div>
  </dl>
  {#if saved && !rewarded}
    <p
      class="mt-3 mb-0 max-w-[30rem] rounded-[0.65rem] bg-butter-50 px-3 py-[0.6rem] text-[0.62rem] leading-[1.45] font-[720]"
    >
      {$tr(
        'Odměnu za tento scénář už dnes máš. Samotné procvičení se ale pořád počítá.',
        'You already earned today’s reward for this scenario, but the practice still counts.',
      )}
    </p>
  {/if}
  {#if error}<p
      class="mt-3 mb-0 max-w-[34rem] text-[0.7rem] font-[750] text-coral-700"
      role="alert"
    >
      {error}
    </p>{/if}
  <div
    class="{width} mt-4 flex flex-wrap justify-center gap-[0.6rem] [&>.btn-base]:flex-[1_1_12rem]"
  >
    {#if !saved}
      <button type="button" class="btn-base btn-primary" onclick={onsave} disabled={saving}>
        {#if saving}<LoaderCircle class="animate-spin" size={18} />{/if}
        {$tr('Uložit výsledek', 'Save result')}
      </button>
    {:else}
      <a href="/" class="btn-base btn-primary">
        {onPath
          ? $tr('Pokračovat po cestě', 'Continue on the path')
          : $tr('Zpět na dnešek', 'Back to today')}
        <ArrowRight size={18} />
      </a>
      <button type="button" class="btn-base btn-secondary" onclick={onrestart}>
        <RotateCcw size={17} />
        {$tr('Zopakovat', 'Repeat')}
      </button>
      {#if !onPath}
        <a
          href="/coach/"
          class="inline-flex min-h-[2.8rem] items-center justify-center gap-[0.2rem] px-[0.6rem] text-[0.72rem] font-extrabold fine-hover:underline fine-hover:underline-offset-[0.18rem]"
        >
          {$tr('Vybrat jinou situaci', 'Choose another situation')}
          <ChevronRight size={16} />
        </a>
      {/if}
    {/if}
  </div>
</section>
