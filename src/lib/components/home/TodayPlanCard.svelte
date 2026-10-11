<script lang="ts">
  import { motherTongue } from '$lib/state/app';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Brain from '@lucide/svelte/icons/brain';
  import CalendarCheck from '@lucide/svelte/icons/calendar-check';
  import Check from '@lucide/svelte/icons/check';
  import Headphones from '@lucide/svelte/icons/headphones';
  import MessageCircleMore from '@lucide/svelte/icons/message-circle-more';

  import type { ExamPlanReadiness } from '$lib/domain/exam-plan.ts';
  import type { ExamPlan } from '$lib/domain/types.ts';
  import type { HomeDailyProgress } from './home-view-model.ts';

  let {
    daily,
    dueCount,
    examPlan,
    examReadiness,
    class: className = '',
  }: {
    daily: HomeDailyProgress;
    dueCount: number;
    examPlan?: ExamPlan;
    examReadiness?: ExamPlanReadiness;
    class?: string;
  } = $props();

  const flow = $derived([
    {
      id: 'memory',
      label: $motherTongue === 'cs' ? 'Zopakovat slovíčka' : 'Review vocabulary',
      detail:
        $motherTongue === 'cs'
          ? dueCount > 0
            ? `${Math.min(dueCount, daily.minutes === 20 ? 5 : daily.minutes === 10 ? 3 : 2)} k opakování`
            : 'slova, která potřebují procvičit'
          : dueCount > 0
            ? `${Math.min(dueCount, daily.minutes === 20 ? 5 : daily.minutes === 10 ? 3 : 2)} to review`
            : 'words that need more practice',
      icon: Brain,
    },
    {
      id: 'focus',
      label: $motherTongue === 'cs' ? 'Procvičit téma' : 'Practise a topic',
      detail:
        daily.minutes === 20
          ? $motherTongue === 'cs'
            ? 'gramatika + poslech'
            : 'grammar + listening'
          : $motherTongue === 'cs'
            ? 'jedno pravidlo nebo poslech'
            : 'one pattern or listening',
      icon: Headphones,
    },
    {
      id: 'output',
      label: $motherTongue === 'cs' ? 'Odpovědět německy' : 'Reply in German',
      detail: $motherTongue === 'cs' ? 'vlastní německá replika' : 'your own German reply',
      icon: MessageCircleMore,
    },
  ]);

  function examTimingLabel(days: number): string {
    if ($motherTongue === 'en') {
      if (days === 0) return 'The test is today';
      if (days === 1) return 'The test is tomorrow';
      return `Test in ${days} days`;
    }
    if (days === 0) return 'Písemka je dnes';
    if (days === 1) return 'Písemka je zítra';
    return `Písemka za ${days} ${days < 5 ? 'dny' : 'dní'}`;
  }
</script>

<aside
  class={[
    'self-start rounded-[0.65rem_1rem_0.65rem_0.65rem] border border-ink-950 bg-ink-950 p-4 text-white max-[1100px]:static max-[1100px]:shadow-[0_4px_0_color-mix(in_srgb,var(--color-cobalt-700)_42%,transparent)] min-[1100px]:sticky min-[1100px]:top-6 min-[1100px]:shadow-[0_5px_0_color-mix(in_srgb,var(--color-cobalt-700)_52%,transparent)]',
    className,
  ]}
  data-testid="today-plan"
  aria-labelledby="today-plan-title"
>
  <header class="flex items-end justify-between gap-3">
    <div>
      <p class="kicker text-white/55">
        {$motherTongue === 'cs'
          ? `dnešních ${daily.minutes} minut`
          : `today · ${daily.minutes} min`}
      </p>
      <h2 class="mt-[0.2rem] text-[1.35rem]" id="today-plan-title">
        {$motherTongue === 'cs' ? 'Dnešní lekce' : 'Today’s lesson'}
      </h2>
    </div>
    <strong class="font-mono text-[0.78rem]">{daily.percent} %</strong>
  </header>

  <div
    class="mt-3 h-[0.42rem] overflow-hidden rounded-full bg-white/14"
    role="progressbar"
    aria-label={$motherTongue === 'cs' ? 'Postup dnešní lekcí' : "Today's lesson progress"}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={daily.percent}
  >
    <i
      class="block h-full w-full origin-left bg-acid-500 transition-transform duration-240 ease-out-emil"
      style:transform={`scaleX(${daily.percent / 100})`}
    ></i>
  </div>

  {#if examPlan && examReadiness}
    <div
      class={[
        'mt-[0.8rem] grid min-h-[3.75rem] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.55rem] rounded-[0.55rem] border bg-white/8 p-2',
        !examReadiness.feasible || examReadiness.total === 0
          ? 'border-[color-mix(in_srgb,var(--color-acid-500)_58%,transparent)]'
          : 'border-white/18',
      ]}
    >
      <span class="grid size-[2.35rem] place-items-center rounded-lg bg-acid-500 text-ink-950">
        {#if !examReadiness.feasible || examReadiness.total === 0}
          <AlertTriangle size={18} aria-hidden="true" />
        {:else}
          <CalendarCheck size={18} aria-hidden="true" />
        {/if}
      </span>
      <span class="grid min-w-0">
        <strong class="text-[0.8rem]">{examTimingLabel(examReadiness.daysRemaining)}</strong>
        <small class="mt-[0.12rem] text-[0.68rem] leading-[1.35] text-white/66">
          {examReadiness.total === 0
            ? $motherTongue === 'cs'
              ? 'Rozsah je prázdný'
              : 'The scope is empty'
            : $motherTongue === 'cs'
              ? `${examReadiness.percent} % připraveno · plán se promítne do lekce`
              : `${examReadiness.percent}% ready · included in the lesson`}
        </small>
      </span>
      {#if examReadiness.total === 0}
        <a
          class="min-h-11 content-center text-[0.72rem] text-white underline underline-offset-[0.2rem]"
          href="/exam/">{$motherTongue === 'cs' ? 'Upravit' : 'Edit'}</a
        >
      {/if}
    </div>
  {/if}

  <ol class="mt-[0.8rem] mb-0 grid list-none gap-0 p-0" data-testid="lesson-flow">
    {#each flow as step, index}
      {@const Icon = step.icon}
      <li
        class="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.55rem] border-t border-white/10"
      >
        <span class="grid size-[2.2rem] place-items-center rounded-lg bg-white/10"
          ><Icon size={18} aria-hidden="true" /></span
        >
        <span class="grid"
          ><strong class="text-[0.82rem]">{step.label}</strong><small
            class="mt-[0.08rem] text-[0.7rem] text-white/55">{step.detail}</small
          ></span
        >
        <em class="font-mono text-[0.68rem] text-white/50 not-italic"
          >{String(index + 1).padStart(2, '0')}</em
        >
      </li>
    {/each}
  </ol>

  <a
    class={[
      'mt-[0.8rem] flex min-h-[3.2rem] items-center justify-center gap-2 rounded-[0.55rem] border p-[0.65rem] font-[820] text-ink-950 [transition:transform_140ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil)] active:[transform:scale(0.98)] fine-hover:bg-white',
      daily.reached ? 'border-mint-200 bg-mint-200' : 'border-acid-500 bg-acid-500',
    ]}
    href="/today/"
  >
    {#if daily.reached}
      <Check size={19} strokeWidth={2.7} aria-hidden="true" />
      {$motherTongue === 'cs' ? 'Zobrazit dnešní souhrn' : "View today's summary"}
    {:else}
      {daily.completed > 0
        ? $motherTongue === 'cs'
          ? 'Pokračovat v lekci'
          : 'Continue lesson'
        : $motherTongue === 'cs'
          ? 'Spustit dnešní lekci'
          : "Start today's lesson"}
      <ArrowRight size={19} aria-hidden="true" />
    {/if}
  </a>

  <p class="mt-3 border-t border-white/12 pt-3 text-[0.74rem] leading-[1.45] text-white/58">
    {$motherTongue === 'cs'
      ? 'Plán zohledňuje, co je čas zopakovat, co ti dělá potíže a kde jsi v kurzu.'
      : 'The plan follows what’s due for review, what you find difficult, and your current chapter.'}
  </p>
</aside>
