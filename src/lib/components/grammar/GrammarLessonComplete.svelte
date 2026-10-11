<script lang="ts" module>
  /** What happened during this run of the lesson. */
  export type GrammarRunSummary = {
    xp: number;
    pathXp: number;
    correctFirstTry: number;
    completedNow: boolean;
    starsImproved: boolean;
    previousStars: 0 | 1 | 2 | 3;
    unlockedReading: boolean;
    repairedQuestionIds: Set<string>;
  };
</script>

<script lang="ts">
  import GrammarCorrections from '$lib/components/course/GrammarCorrections.svelte';
  import CelebrationBurst from '$lib/components/gamification/CelebrationBurst.svelte';
  import { appStore, motherTongue, tr } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Star from '@lucide/svelte/icons/star';
  import Trophy from '@lucide/svelte/icons/trophy';
  import X from '@lucide/svelte/icons/x';

  import { closeButton, footerInset, lessonBar, lessonShell, pill } from './lesson-styles.ts';

  import type { GrammarLesson, GrammarLessonProgress } from '$lib/domain/course/grammar.ts';
  import type { GrammarLessonCopy } from '$lib/i18n/grammar.ts';

  let {
    lesson,
    lessonCopy,
    progress,
    run,
    onPath,
    returnHref,
    next,
  }: {
    lesson: GrammarLesson;
    lessonCopy: GrammarLessonCopy;
    progress: GrammarLessonProgress;
    run: GrammarRunSummary;
    onPath: boolean;
    returnHref: string;
    next?: { id: string; title: string };
  } = $props();

  const totalXp = $derived(run.xp + run.pathXp);
  const action =
    'flex min-h-12 items-center justify-center gap-[0.35rem] rounded-[0.78rem] border p-[0.65rem] text-center text-[0.68rem] font-[850] active:[transform:scale(0.97)]';
  const primary = `${action} border-acid-500 bg-acid-500 text-ink-950`;

  const lead = $derived(
    onPath && run.pathXp > 0
      ? $tr(
          `Gramatiku máš hotovou. Za první dokončení získáváš ${run.pathXp} XP.`,
          `The grammar step is complete. You earned ${run.pathXp} XP for the first completion.`,
        )
      : run.starsImproved && run.previousStars > 0
        ? $tr(
            `Nový osobní rekord. Lekci sis zlepšila z ${run.previousStars} na ${progress.stars} hvězdy.`,
            `New personal best. You improved this lesson from ${run.previousStars} to ${progress.stars} stars.`,
          )
        : run.completedNow
          ? $tr(
              'Lekce je dokončená. Pravidlo si ještě procvičíš v dalších větách.',
              'Lesson complete. You’ll practise this rule in more sentences as you go.',
            )
          : run.xp > 0
            ? $tr(
                'Lekci máš zopakovanou. Za první správné odpovědi dnešního dne získáváš další XP.',
                'Lesson reviewed. You earned XP for the first correct answer to each question today.',
              )
            : $tr(
                'Lekci máš zopakovanou. XP za dnešní správné odpovědi už máš započítané.',
                'Lesson reviewed. You’ve already earned today’s XP for these answers.',
              ),
  );
</script>

<div
  class="{lessonShell} completion-arrival relative grid grid-rows-[auto_minmax(0,1fr)_auto] bg-ink-950 text-white"
>
  <CelebrationBurst visible={$appStore.settings?.celebrations !== false} />
  <header class="{lessonBar} border-white/12 bg-[rgb(21_25_28/0.92)]">
    <a
      class="{closeButton} border-white/16 bg-white/7 text-white"
      href={returnHref}
      aria-label={$tr('Zavřít souhrn', 'Close summary')}><X size={20} /></a
    >
    <span class="text-[0.75rem] font-extrabold">{$tr('Souhrn lekce', 'Lesson summary')}</span>
    <span class="{pill} ml-auto bg-acid-500 text-ink-950"><Sparkles size={14} /> +{totalXp} XP</span
    >
  </header>

  <main class="min-h-0 overflow-y-auto">
    <div
      class="mx-auto w-[min(100%,42rem)] px-4 pt-[clamp(1rem,4vh,2.5rem)] pb-8 text-center short-screen:pt-3"
    >
      <div
        class="mx-auto grid size-[4.4rem] [transform:rotate(-3deg)] place-items-center rounded-[1.3rem] border border-white/45 bg-acid-500 text-ink-950 shadow-[5px_5px_0_rgb(255_255_255/0.13)] short-screen:size-[3.6rem]"
      >
        <Trophy size={34} />
      </div>
      <p
        class="mt-4 mb-0 font-mono text-[0.6rem] font-[850] tracking-[0.09em] text-acid-500 uppercase"
      >
        {$tr('Lekce dokončena', 'Lesson complete')}
      </p>
      <h1
        class="mx-auto mt-[0.4rem] text-[clamp(2rem,8vw,4rem)] leading-[0.9] font-[920] tracking-[-0.04em] text-balance"
      >
        {lessonCopy.title}
      </h1>
      <p class="mx-auto mt-3 mb-0 max-w-[35rem] text-[0.78rem] leading-[1.55] text-white/58">
        {lead}
      </p>

      {#if run.starsImproved}
        <p
          class="mx-auto mt-[0.9rem] mb-0 inline-flex items-center gap-[0.35rem] rounded-full border border-acid-500 bg-acid-500 px-[0.65rem] py-[0.42rem] font-mono text-[0.56rem] font-[850] tracking-[0.04em] text-ink-950 uppercase"
        >
          <Sparkles size={15} />
          {run.previousStars > 0
            ? $tr('Nový osobní rekord', 'New personal best')
            : $tr('První hodnocení lekce', 'First lesson rating')}
        </p>
      {/if}

      <div
        class="mt-4 flex justify-center gap-[0.45rem]"
        aria-label={$tr(`${progress.stars} ze 3 hvězd`, `${progress.stars} of 3 stars`)}
      >
        {#each [1, 2, 3] as star}
          {@const earned = star <= progress.stars}
          <span
            class={[
              'grid size-[2.8rem] place-items-center rounded-[0.8rem] border border-white/15',
              earned
                ? 'bg-[rgb(233_154_49/0.1)] text-orange-500'
                : '[transform:scale(0.95)] bg-white/4 text-white/22',
            ]}><Star size={29} fill={earned ? 'currentColor' : 'none'} /></span
          >
        {/each}
      </div>

      <div
        class="mt-4 grid grid-cols-3 gap-2 [&_span]:text-[0.52rem] [&_span]:leading-[1.25] [&_span]:text-white/48 [&_strong]:font-mono [&_strong]:text-[1.15rem] [&_strong]:text-acid-500 [&>article]:grid [&>article]:gap-1 [&>article]:rounded-[0.85rem] [&>article]:border [&>article]:border-white/12 [&>article]:bg-white/5 [&>article]:px-[0.35rem] [&>article]:py-3 short-screen:[&>article]:py-2"
      >
        <article>
          <strong>{progress.correct}/{progress.total}</strong><span
            >{$tr('pravidel použitých správně', 'patterns used correctly')}</span
          >
        </article>
        <article>
          <strong>{run.correctFirstTry}</strong><span
            >{$tr('odpovědí napoprvé v této jízdě', 'first-try answers in this run')}</span
          >
        </article>
        <article>
          <strong>{totalXp}</strong><span
            >{$tr('XP získaných v lekci a cestě', 'XP earned in the lesson and path')}</span
          >
        </article>
      </div>

      <section
        class="mt-[0.7rem] rounded-2xl border border-white/16 bg-white/[0.055] p-[0.85rem] text-left"
      >
        <p
          class="m-0 flex items-center gap-[0.35rem] font-mono text-[0.53rem] font-extrabold text-acid-500 uppercase"
        >
          <Check size={16} />
          {$tr('Co si odnášíš', 'Your takeaway')}
        </p>
        <strong class="mt-[0.45rem] block text-[0.9rem]" lang={$motherTongue === 'en' ? 'de' : 'cs'}
          >{lessonCopy.formula}</strong
        >
        <span class="mt-[0.35rem] block text-[0.63rem] leading-[1.45] text-white/54"
          >{lessonCopy.concept}</span
        >
      </section>
      <GrammarCorrections {lesson} questionIds={run.repairedQuestionIds} />
    </div>
  </main>

  <footer
    class="safe-bottom grid grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)] gap-[0.55rem] border-t border-white/12 bg-[rgb(21_25_28/0.94)] px-[0.85rem] py-[0.7rem] {footerInset}"
  >
    {#if onPath}
      <a class={primary} href="/"
        >{$tr('Pokračovat po cestě', 'Continue on the path')} <ArrowRight size={18} /></a
      >
      {#if run.unlockedReading}<span
          >{$tr('Odemkla se bonusová četba.', 'Optional reading is now unlocked.')}</span
        >{/if}
    {:else}
      <a class="{action} border-white/20 bg-white/6 text-white" href="/"
        >{$tr('Dnešní cesta', 'Today’s path')}</a
      >
      {#if next}
        <a class={primary} href={`/grammar/${next.id}/`}
          >{$tr('Další', 'Next')}: {next.title} <ArrowRight size={18} /></a
        >
      {:else}
        <a class={primary} href="/progress/"
          >{$tr('Zobrazit pokrok', 'View progress')} <ArrowRight size={18} /></a
        >
      {/if}
    {/if}
  </footer>
</div>
