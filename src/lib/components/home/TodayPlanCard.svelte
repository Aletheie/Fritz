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
  }: {
    daily: HomeDailyProgress;
    dueCount: number;
    examPlan?: ExamPlan;
    examReadiness?: ExamPlanReadiness;
  } = $props();

  const flow = $derived([
    {
      id: 'memory',
      label: $motherTongue === 'cs' ? 'Obnovit paměť' : 'Refresh memory',
      detail:
        $motherTongue === 'cs'
          ? dueCount > 0
            ? `${Math.min(dueCount, daily.minutes === 20 ? 5 : daily.minutes === 10 ? 3 : 2)} termínované položky`
            : 'nejbližší slabá místa'
          : dueCount > 0
            ? `${Math.min(dueCount, daily.minutes === 20 ? 5 : daily.minutes === 10 ? 3 : 2)} due items`
            : 'nearest weak spots',
      icon: Brain,
    },
    {
      id: 'focus',
      label: $motherTongue === 'cs' ? 'Zaostřit' : 'Focus',
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
      label: $motherTongue === 'cs' ? 'Použít aktivně' : 'Use actively',
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

<aside class="today-plan" aria-labelledby="today-plan-title">
  <header>
    <div>
      <p class="kicker">
        {$motherTongue === 'cs'
          ? `dnešních ${daily.minutes} minut`
          : `today · ${daily.minutes} min`}
      </p>
      <h2 id="today-plan-title">
        {$motherTongue === 'cs' ? 'Jedna souvislá lekce' : 'One continuous lesson'}
      </h2>
    </div>
    <strong>{daily.percent} %</strong>
  </header>

  <div
    class="daily-progress"
    role="progressbar"
    aria-label={$motherTongue === 'cs' ? 'Postup dnešní lekcí' : "Today's lesson progress"}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={daily.percent}
  >
    <i style={`--daily-progress:${daily.percent / 100}`}></i>
  </div>

  {#if examPlan && examReadiness}
    <div class:warning={!examReadiness.feasible || examReadiness.total === 0} class="exam-status">
      <span class="exam-icon">
        {#if !examReadiness.feasible || examReadiness.total === 0}
          <AlertTriangle size={18} aria-hidden="true" />
        {:else}
          <CalendarCheck size={18} aria-hidden="true" />
        {/if}
      </span>
      <span>
        <strong>{examTimingLabel(examReadiness.daysRemaining)}</strong>
        <small>
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
        <a href="/exam/">{$motherTongue === 'cs' ? 'Upravit' : 'Edit'}</a>
      {/if}
    </div>
  {/if}

  <ol class="lesson-flow">
    {#each flow as step, index}
      {@const Icon = step.icon}
      <li>
        <span class="flow-icon"><Icon size={18} aria-hidden="true" /></span>
        <span><strong>{step.label}</strong><small>{step.detail}</small></span>
        <em>{String(index + 1).padStart(2, '0')}</em>
      </li>
    {/each}
  </ol>

  <a class:done={daily.reached} class="lesson-cta" href="/today/">
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

  <p class="plan-end">
    {$motherTongue === 'cs'
      ? 'Pořadí se skládá z termínů FSRS, slabých míst a aktuální kapitoly.'
      : 'The order combines FSRS due dates, weak spots, and your current chapter.'}
  </p>
</aside>

<style>
  .today-plan {
    position: sticky;
    top: 1.5rem;
    align-self: start;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem 1rem 0.65rem 0.65rem;
    background: var(--color-ink-950);
    color: white;
    padding: 1rem;
    box-shadow: 0 5px 0 color-mix(in srgb, var(--color-cobalt-700) 52%, transparent);
  }
  header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 0.75rem;
  }
  header .kicker {
    color: rgb(255 255 255 / 0.55);
  }
  h2 {
    margin: 0.2rem 0 0;
    font-size: 1.35rem;
  }
  header > strong {
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .daily-progress {
    height: 0.42rem;
    overflow: hidden;
    margin-top: 0.75rem;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.14);
  }
  .daily-progress i {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--color-acid-500);
    transform: scaleX(var(--daily-progress));
    transform-origin: left;
    transition: transform 240ms var(--ease-out-emil);
  }
  .exam-status {
    display: grid;
    min-height: 3.75rem;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.55rem;
    margin-top: 0.8rem;
    border: 1px solid rgb(255 255 255 / 0.18);
    border-radius: 0.55rem;
    background: rgb(255 255 255 / 0.08);
    padding: 0.5rem;
  }
  .exam-status.warning {
    border-color: color-mix(in srgb, var(--color-acid-500) 58%, transparent);
  }
  .exam-icon {
    display: grid;
    width: 2.35rem;
    height: 2.35rem;
    place-items: center;
    border-radius: 0.5rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }
  .exam-status > span:nth-child(2) {
    display: grid;
    min-width: 0;
  }
  .exam-status strong {
    font-size: 0.8rem;
  }
  .exam-status small {
    margin-top: 0.12rem;
    color: rgb(255 255 255 / 0.66);
    font-size: 0.68rem;
    line-height: 1.35;
  }
  .exam-status a {
    min-height: 2.75rem;
    align-content: center;
    color: white;
    font-size: 0.72rem;
    text-decoration: underline;
    text-underline-offset: 0.2rem;
  }
  .lesson-flow {
    display: grid;
    gap: 0;
    margin: 0.8rem 0 0;
    padding: 0;
    list-style: none;
  }
  .lesson-flow li {
    display: grid;
    min-height: 3.5rem;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.55rem;
    border-top: 1px solid rgb(255 255 255 / 0.1);
  }
  .flow-icon {
    display: grid;
    width: 2.2rem;
    height: 2.2rem;
    place-items: center;
    border-radius: 0.5rem;
    background: rgb(255 255 255 / 0.1);
  }
  .lesson-flow li > span:nth-child(2) {
    display: grid;
  }
  .lesson-flow strong {
    font-size: 0.82rem;
  }
  .lesson-flow small {
    margin-top: 0.08rem;
    color: rgb(255 255 255 / 0.55);
    font-size: 0.7rem;
  }
  .lesson-flow em {
    color: rgb(255 255 255 / 0.45);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-style: normal;
  }
  .lesson-cta {
    display: flex;
    min-height: 3.2rem;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.8rem;
    border: 1px solid var(--color-acid-500);
    border-radius: 0.55rem;
    background: var(--color-acid-500);
    color: var(--color-ink-950);
    padding: 0.65rem;
    font-weight: 820;
    transition:
      transform 140ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil);
  }
  .lesson-cta.done {
    border-color: var(--color-mint-200);
    background: var(--color-mint-200);
  }
  .lesson-cta:active {
    transform: scale(0.98);
  }
  .plan-end {
    margin: 0.75rem 0 0;
    border-top: 1px solid rgb(255 255 255 / 0.12);
    color: rgb(255 255 255 / 0.58);
    padding-top: 0.75rem;
    font-size: 0.74rem;
    line-height: 1.45;
  }
  @media (hover: hover) and (pointer: fine) {
    .lesson-cta:hover {
      background: white;
    }
  }
  @media (max-width: 1099px) {
    .today-plan {
      position: static;
      box-shadow: 0 4px 0 color-mix(in srgb, var(--color-cobalt-700) 42%, transparent);
    }
  }
</style>
