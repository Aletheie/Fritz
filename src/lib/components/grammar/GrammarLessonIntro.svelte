<script lang="ts">
  import { grammarLevelForLesson } from '$lib/domain/course/grammar.ts';
  import { grammarExampleTranslation } from '$lib/i18n/grammar.ts';
  import { motherTongue, tr } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import X from '@lucide/svelte/icons/x';

  import { footerInset, lessonBar, lessonShell, lightClose, pill } from './lesson-styles.ts';

  import type { GrammarLesson, GrammarLessonProgress } from '$lib/domain/course/grammar.ts';
  import type { GrammarLessonCopy } from '$lib/i18n/grammar.ts';

  let {
    lesson,
    lessonCopy,
    number,
    onPath,
    progress,
    returnHref,
    onstart,
  }: {
    lesson: GrammarLesson;
    lessonCopy: GrammarLessonCopy;
    number: number;
    onPath: boolean;
    progress?: GrammarLessonProgress;
    returnHref: string;
    onstart: () => void;
  } = $props();

  const cardLabel = 'm-0 font-mono text-[0.53rem] font-extrabold tracking-[0.07em] uppercase';
</script>

<div class="{lessonShell} grid grid-rows-[auto_minmax(0,1fr)_auto] bg-paper-100">
  <header
    class="{lessonBar} border-[color-mix(in_srgb,var(--color-ink-950)_16%,transparent)] bg-[color-mix(in_srgb,var(--color-paper-50)_94%,transparent)]"
  >
    <a class={lightClose} href={returnHref} aria-label={$tr('Zavřít lekci', 'Close lesson')}
      ><X size={20} /></a
    >
    <div class="grid min-w-0 gap-[0.05rem]">
      <span class="font-mono text-[0.52rem] font-[750] text-ink-600 uppercase"
        >{$tr('Kapitola', 'Chapter')} {lesson.unit} · {grammarLevelForLesson(lesson)}</span
      >
      <strong class="truncate text-[0.8rem] font-[850]">{lessonCopy.shortTitle}</strong>
    </div>
    <span class="{pill} ml-auto bg-paper-100"><Clock3 size={14} /> {lesson.minutes} min</span>
  </header>

  <main class="min-h-0 overflow-y-auto overscroll-contain">
    <div
      class="mx-auto w-[min(100%,54rem)] px-4 pt-5 pb-8 min-[640px]:px-6 min-[640px]:pt-8 min-[640px]:pb-12"
    >
      <div
        class="font-mono text-[clamp(3.3rem,18vw,7rem)] leading-[0.72] font-[920] tracking-[-0.04em] text-[color-mix(in_srgb,var(--color-ink-950)_17%,transparent)]"
      >
        {String(number).padStart(2, '0')}
      </div>
      <p
        class="mt-3 mb-0 font-mono text-[0.62rem] font-extrabold tracking-[0.08em] text-cobalt-700 uppercase"
      >
        {onPath
          ? $tr('Kurzová cesta · gramatika', 'Course path · grammar')
          : $tr('Lekce gramatiky', 'Grammar micro-lesson')}
      </p>
      <h1
        class="mt-[0.45rem] max-w-[13ch] text-[clamp(2.2rem,9vw,5.2rem)] leading-[0.9] font-[920] tracking-[-0.04em] text-balance"
      >
        {lessonCopy.title}
      </h1>
      <p class="mt-3 mb-0 max-w-[38rem] text-[0.9rem] leading-[1.55] text-ink-600">
        {lessonCopy.subtitle}
      </p>

      <section
        class="mt-[1.35rem] grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-ink-950 bg-acid-100 p-[0.9rem] shadow-[4px_4px_0_var(--color-ink-950)]"
      >
        <span
          class="grid size-[2.8rem] place-items-center rounded-[0.8rem] border border-ink-950 bg-acid-500"
          ><Lightbulb size={21} /></span
        >
        <div>
          <p class={cardLabel}>{$tr('Jedna myšlenka', 'One key idea')}</p>
          <h2
            class="mt-[0.28rem] text-[clamp(0.95rem,3.4vw,1.25rem)] leading-[1.25] font-extrabold tracking-[-0.025em]"
          >
            {lessonCopy.concept}
          </h2>
        </div>
      </section>

      <section class="mt-[0.85rem] rounded-2xl border border-ink-950 bg-ink-950 p-4 text-white">
        <p class="{cardLabel} text-acid-500">
          {$tr('Vzor, který si odnášíš', 'The pattern to remember')}
        </p>
        <strong
          class="mt-[0.45rem] block text-[clamp(1rem,4vw,1.35rem)] leading-[1.35] font-[780]"
          lang={$motherTongue === 'en' ? 'de' : 'cs'}>{lessonCopy.formula}</strong
        >
      </section>

      <div class="mt-[0.85rem] grid gap-[0.65rem] min-[640px]:grid-cols-2">
        {#each lesson.examples as example, index}
          {@const translation = grammarExampleTranslation($motherTongue, example)}
          <article
            class="relative rounded-[0.9rem] border border-[color-mix(in_srgb,var(--color-ink-950)_20%,transparent)] bg-paper-50 py-[0.85rem] pr-[0.85rem] pl-[2.6rem]"
          >
            <span
              class="absolute top-[0.85rem] left-[0.8rem] font-mono text-[0.52rem] font-extrabold text-ink-600"
              >{String(index + 1).padStart(2, '0')}</span
            >
            <strong class="text-[0.9rem] font-[820]" lang="de">{example.de}</strong>
            {#if translation}<p class="mt-[0.2rem] mb-0 text-[0.7rem] text-ink-600">
                {translation}
              </p>{/if}
          </article>
        {/each}
      </div>
    </div>
  </main>

  <footer
    class="safe-bottom grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-[color-mix(in_srgb,var(--color-ink-950)_18%,transparent)] bg-paper-50 px-[0.9rem] py-3 shadow-[0_-12px_35px_rgb(21_25_28/0.07)] {footerInset}"
  >
    <div class="grid gap-[0.1rem]">
      <span class="font-mono text-[0.5rem] text-ink-600"
        >{lesson.questions.length} {$tr('krátkých úloh', 'short activities')}</span
      >
      <strong class="text-[0.72rem]"
        >{progress?.completed
          ? $tr(
              `Až ${lesson.questions.length * 3} denních XP`,
              `Up to ${lesson.questions.length * 3} daily XP`,
            )
          : $tr(
              `Až ${lesson.questions.length * 12 + lesson.completionXp} XP`,
              `Up to ${lesson.questions.length * 12 + lesson.completionXp} XP`,
            )}</strong
      >
    </div>
    <button
      class="flex min-h-12 items-center justify-center gap-[0.45rem] rounded-[0.8rem] border border-ink-950 bg-acid-500 px-4 py-[0.7rem] text-[0.77rem] font-[880] shadow-[3px_3px_0_var(--color-ink-950)] [transition:transform_150ms_var(--ease-out-emil),box-shadow_150ms_var(--ease-out-emil)] active:[transform:translate(2px,2px)_scale(0.97)] active:shadow-[1px_1px_0_var(--color-ink-950)]"
      type="button"
      onclick={onstart}
    >
      {progress?.completed
        ? $tr('Zopakovat', 'Review')
        : progress?.answered
          ? $tr('Pokračovat', 'Continue')
          : $tr('Jdu na to', 'Start lesson')}
      <ArrowRight size={19} />
    </button>
  </footer>
</div>
