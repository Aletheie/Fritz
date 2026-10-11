<script lang="ts">
  import { goto } from '$app/navigation';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import {
    centered,
    centeredText,
    centeredTitle,
    errorClass,
    link,
  } from '$lib/components/today/today-styles.ts';
  import TodayComplete from '$lib/components/today/TodayComplete.svelte';
  import TodayExitTicket from '$lib/components/today/TodayExitTicket.svelte';
  import TodayFeedback from '$lib/components/today/TodayFeedback.svelte';
  import TodayGrammar from '$lib/components/today/TodayGrammar.svelte';
  import TodayListening from '$lib/components/today/TodayListening.svelte';
  import TodayReview from '$lib/components/today/TodayReview.svelte';
  import TodayTransfer from '$lib/components/today/TodayTransfer.svelte';
  import { tr } from '$lib/state/app';
  import { DailyLesson } from '$lib/state/daily-lesson.svelte.ts';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import X from '@lucide/svelte/icons/x';
  import { onDestroy, onMount, tick, untrack } from 'svelte';

  const lesson = new DailyLesson();
  let activityHeading = $state<HTMLHeadingElement | undefined>(undefined);

  onMount(() => {
    let cancelled = false;
    void lesson.initialize(() => cancelled);
    return () => {
      cancelled = true;
      lesson.close();
    };
  });

  onDestroy(() => lesson.destroy());

  // A new activity starts clean: focus its heading, then the answer field if it has one.
  $effect(() => {
    void lesson.active?.id;
    if (!untrack(() => lesson.syncActivity())) return;
    const kind = lesson.active?.kind;
    void tick().then(() => {
      activityHeading?.focus();
      if (kind === 'review' || kind === 'grammar') lesson.focusRequest += 1;
      return undefined;
    });
  });

  function closeLesson(): void {
    lesson.close();
    void goto('/');
  }
</script>

<svelte:head>
  <title>{$tr('Dnešní lekce · Fritz', "Today's lesson · Fritz")}</title>
  <meta
    name="description"
    content={$tr(
      'Krátká lekce němčiny se slovíčky, poslechem a vlastními odpověďmi.',
      'A short German lesson with vocabulary, listening, and your own answers.',
    )}
  />
</svelte:head>

{#if !lesson.initialized}
  <LoadingState label={$tr('Skládám dnešní lekci…', "Building today's lesson…")} />
{:else if lesson.loadingError && !lesson.session}
  <section class={centered} aria-labelledby="today-error-title">
    <CircleAlert size={28} aria-hidden="true" />
    <h1 class={centeredTitle} id="today-error-title">
      {$tr('Lekci se nepodařilo otevřít', 'The lesson could not open')}
    </h1>
    <p class={centeredText}>{lesson.loadingError}</p>
    <a class="{link} bg-ink-950 text-white" href="/">{$tr('Zpět na přehled', 'Back to overview')}</a
    >
  </section>
{:else if lesson.session}
  {@const session = lesson.session}
  {@const summary = lesson.summary}
  {@const active = lesson.active}
  <div
    class="min-h-dvh bg-paper-100 text-ink-950 [&_:is(input,textarea,button,a):focus-visible]:outline-offset-2 [&_:is(input,textarea,button,a):focus-visible]:outline-[color-mix(in_srgb,var(--color-cobalt-700)_38%,transparent)] [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-52"
  >
    <header
      class="sticky top-0 z-10 grid min-h-[4.75rem] grid-cols-[2.75rem_minmax(0,34rem)_3.5rem] items-center justify-center gap-4 border-b border-line bg-[color-mix(in_srgb,var(--color-paper-100)_94%,transparent)] px-[clamp(1rem,3vw,2rem)] py-[0.65rem] backdrop-blur-md max-[561px]:grid-cols-[2.75rem_minmax(0,1fr)] max-[561px]:gap-3"
    >
      <button
        class="grid size-11 place-items-center rounded-[0.65rem] border border-line bg-paper-50 text-ink-950"
        type="button"
        onclick={closeLesson}
        aria-label={$tr('Uložit a zavřít lekci', 'Save and close lesson')}
      >
        <X size={20} aria-hidden="true" />
      </button>
      <div class="min-w-0">
        <div class="mb-[0.35rem] flex justify-between gap-4 text-[0.75rem]">
          <strong>{$tr('Dnešní lekce', "Today's lesson")}</strong>
          <span class="font-mono text-[0.72rem] text-ink-700"
            >{summary.completed}/{summary.total}</span
          >
        </div>
        <ProgressBar
          value={summary.percent}
          label={$tr('Postup dnešní lekcí', "Today's lesson progress")}
        />
      </div>
      <span class="justify-self-end font-mono text-[0.72rem] text-ink-700 max-[561px]:hidden"
        >{session.plan.minutes} min</span
      >
    </header>

    {#if summary.finished}
      <TodayComplete {session} total={summary.total} />
    {:else if active}
      <section
        class="mx-auto grid min-h-[calc(100dvh-4.75rem)] w-[min(100%-2rem,46rem)] content-center gap-4 pt-8 pb-12 max-[561px]:w-[min(100%-1rem,46rem)] max-[561px]:content-start max-[561px]:pt-3"
        aria-label={$tr('Aktivita dnešní lekce', "Today's lesson activity")}
      >
        <section
          data-testid="activity-card"
          class={[
            'rounded-[0.8rem] border bg-paper-50 p-[clamp(1.25rem,4vw,2.4rem)] max-[561px]:rounded-[0.65rem] max-[561px]:p-[1.1rem]',
            active.phase === 'repair'
              ? 'border-coral-500 shadow-[0_5px_0_var(--color-coral-500)] max-[561px]:shadow-[0_3px_0_var(--color-coral-500)]'
              : 'border-ink-950 shadow-[0_5px_0_var(--color-ink-950)] max-[561px]:shadow-[0_3px_0_var(--color-ink-950)]',
          ]}
          aria-labelledby="activity-title"
        >
          <div
            class="flex justify-between gap-4 font-mono text-[0.7rem] font-[760] tracking-[0.08em] text-cobalt-700 uppercase"
          >
            <span>{lesson.phaseLabel(active)}</span>
            <span>{session.cursor + 1} / {session.plan.activities.length}</span>
          </div>
          <h1
            class="mt-[0.65rem] text-[clamp(1.8rem,5vw,2.8rem)] leading-[1.04] tracking-[-0.045em] outline-none"
            id="activity-title"
            tabindex="-1"
            bind:this={activityHeading}
          >
            {active.title}
          </h1>
          <p class="mt-3 max-w-[40rem] leading-[1.55] text-ink-700">{active.instruction}</p>

          {#if lesson.activityMissing}
            <div
              class="mt-6 grid grid-cols-[auto_1fr] gap-[0.8rem] border border-coral-500 p-4"
              role="status"
            >
              <CircleAlert size={24} aria-hidden="true" />
              <div>
                <strong
                  >{$tr(
                    'Obsah se mezitím změnil.',
                    'This content changed in the meantime.',
                  )}</strong
                >
                <p class="mt-[0.2rem] text-ink-700">
                  {$tr(
                    'Tenhle krok přeskočíme. Do výsledků se nezapočítá.',
                    'We’ll skip this step. It won’t count toward your results.',
                  )}
                </p>
              </div>
              <button
                class="col-span-full min-h-[2.8rem] border border-ink-950 bg-ink-950 text-white"
                type="button"
                onclick={() => void lesson.skipMissingActivity()}
                disabled={lesson.saving}>{$tr('Pokračovat', 'Continue')}</button
              >
            </div>
          {:else if active.kind === 'review' && lesson.note}
            <TodayReview {lesson} activity={active} note={lesson.note} />
          {:else if active.kind === 'grammar' && lesson.grammarQuestion}
            <TodayGrammar {lesson} question={lesson.grammarQuestion} />
          {:else if active.kind === 'listening'}
            <TodayListening {lesson} activity={active} />
          {:else if active.kind === 'transfer' && lesson.transferScenario}
            <TodayTransfer {lesson} activity={active} scenario={lesson.transferScenario} />
          {:else if active.kind === 'exit-ticket'}
            <TodayExitTicket {lesson} activity={active} />
          {/if}

          {#if lesson.feedback}
            <TodayFeedback {lesson} activity={active} feedback={lesson.feedback} />
          {/if}

          {#if lesson.loadingError}<p class={errorClass} role="alert">{lesson.loadingError}</p>{/if}
        </section>
        <p
          class="m-0 flex items-start justify-center gap-[0.45rem] text-center text-[0.75rem] leading-[1.45] text-ink-700"
        >
          <Sparkles class="mt-[0.1rem] flex-none" size={16} aria-hidden="true" />{active.phase ===
          'repair'
            ? $tr(
                'Slova, ve kterých chybuješ, si zopakuješ po několika dalších úlohách.',
                'Words you miss will return after a few other activities.',
              )
            : $tr(
                'Úlohy vybíráme podle toho, co je čas zopakovat, co ti dělá potíže a kde jsi v kurzu.',
                'Activities follow what’s due for review, what you find difficult, and your current chapter.',
              )}
        </p>
      </section>
    {/if}
  </div>
{/if}
