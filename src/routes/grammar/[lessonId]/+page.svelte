<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import GrammarRuleReminder from '$lib/components/course/GrammarRuleReminder.svelte';
  import GrammarLessonComplete from '$lib/components/grammar/GrammarLessonComplete.svelte';
  import GrammarLessonIntro from '$lib/components/grammar/GrammarLessonIntro.svelte';
  import {
    closeButton,
    footerInset,
    lessonBar,
    lessonShell,
    lightClose,
    pill,
  } from '$lib/components/grammar/lesson-styles.ts';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import {
    completedGrammarRunFirstTry,
    grammarChoiceOptions,
  } from '$lib/domain/course/grammar-run.ts';
  import {
    grammarLessonById,
    grammarLessons,
    grammarLessonsForLevel,
    lessonProgress,
  } from '$lib/domain/course/grammar.ts';
  import { coursePathNodeById, coursePathNodeState } from '$lib/domain/course/path.ts';
  import { localized } from '$lib/i18n';
  import {
    grammarLessonCopy,
    grammarOptionCopy,
    grammarOptionLanguage,
    grammarAnswerLanguage,
    grammarQuestionCopy,
  } from '$lib/i18n/grammar.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import X from '@lucide/svelte/icons/x';
  import { onDestroy, onMount, tick } from 'svelte';

  import type { GrammarQuestion } from '$lib/domain/course/grammar.ts';
  import type { CourseAnswerEvent } from '$lib/domain/types.ts';

  type Stage = 'intro' | 'question' | 'complete';

  type AnswerFeedback = {
    correct: boolean;
    explanation: string;
    expected: string;
    xp: number;
    firstTry: boolean;
  };

  let stage: Stage = 'intro';
  let currentIndex = 0;
  let selectedChoice = '';
  let fillAnswer = '';
  let selectedOrderIndices: number[] = [];
  let feedback: AnswerFeedback | undefined;
  let submitting = false;
  let advancing = false;
  let startedAt = Date.now();
  let sessionXp = 0;
  let sessionCorrectFirstTry = 0;
  let sessionCompletedNow = false;
  let sessionStarsImproved = false;
  let sessionPreviousStars: 0 | 1 | 2 | 3 = 0;
  let completionError = '';
  let answerSaveError = '';
  let attemptedQuestionIds = new Set<string>();
  let initiallyMasteredQuestionIds = new Set<string>();
  let reviewRun = false;
  let inputElement: HTMLInputElement | undefined;
  let initializedLessonId = '';
  let requestedPathNodeId: string | undefined;
  let pathNodeId: string | undefined;
  let pathCompletionXp = 0;
  let pathUnlockedReading = false;
  let optionOrderSeed = '';
  let questionHeading: HTMLHeadingElement | undefined;
  let feedbackButton: HTMLButtonElement | undefined;
  let ruleVisible = false;
  let ruleConsulted = false;
  let repairedQuestionIds = new Set<string>();

  $: lesson = grammarLessonById(page.params.lessonId ?? '');
  $: requestedPathNodeId = page.url.searchParams.get('path') ?? undefined;
  $: pathNode = requestedPathNodeId ? coursePathNodeById(requestedPathNodeId) : undefined;
  $: pathNodeId =
    pathNode?.type === 'grammar' && pathNode.grammarLessonId === lesson?.id
      ? pathNode.id
      : undefined;
  $: pathNodeState = pathNode
    ? coursePathNodeState($appStore.course, pathNode, $appStore.settings?.grammarLevel ?? 'A1.1')
    : undefined;
  $: pathAccessLocked = Boolean(pathNodeId && $appStore.ready && pathNodeState === 'locked');
  $: returnHref = pathNodeId ? '/' : '/grammar/';
  $: visibleLessons = grammarLessonsForLevel($appStore.settings?.grammarLevel ?? 'A1.1');
  $: persistedProgress = lesson ? lessonProgress($appStore.course, lesson) : undefined;
  $: question = lesson?.questions[currentIndex];
  $: lessonCopy = lesson ? grammarLessonCopy($motherTongue, lesson) : undefined;
  $: questionCopy =
    question && lessonCopy ? grammarQuestionCopy($motherTongue, question, lessonCopy) : undefined;
  $: displayedChoiceOptions =
    question?.kind === 'choice'
      ? grammarChoiceOptions(question.options, `${lesson?.id}:${question.id}:${optionOrderSeed}`)
      : [];
  $: selectedOrderTokens =
    question?.kind === 'order' ? selectedOrderIndices.map((index) => question.tokens[index]) : [];
  $: canSubmit = question
    ? question.kind === 'choice'
      ? Boolean(selectedChoice)
      : question.kind === 'fill'
        ? Boolean(fillAnswer.trim())
        : selectedOrderIndices.length === question.tokens.length
    : false;
  $: questionPercent = lesson
    ? Math.round(((currentIndex + (feedback?.correct ? 1 : 0)) / lesson.questions.length) * 100)
    : 0;
  $: nextLesson = lesson ? nextUnfinishedLesson(lesson.id) : undefined;
  $: nextLessonCopy = nextLesson ? grammarLessonCopy($motherTongue, nextLesson) : undefined;
  $: finalProgress = lesson ? lessonProgress($appStore.course, lesson) : undefined;
  $: nextOpenQuestionIndex = lesson
    ? findNextOpenQuestionIndex(currentIndex, $appStore.course.events)
    : -1;

  onMount(async () => {
    await appStore.initialize();
    await tick();
    initializeLesson();
    if (pathNodeId && !pathAccessLocked) {
      try {
        await appStore.startPathNode(pathNodeId);
      } catch (error) {
        completionError =
          error instanceof Error
            ? error.message
            : copy('Kurzový krok se nepodařilo otevřít.', 'The course step could not be opened.');
      }
    }
    window.addEventListener('keydown', handleKeyboard);
  });

  onDestroy(() => window.removeEventListener('keydown', handleKeyboard));

  $: if ($appStore.ready && lesson && initializedLessonId !== lesson.id) {
    initializeLesson();
  }

  function initializeLesson(): void {
    if (!lesson) {
      if ($appStore.ready) void goto('/grammar/', { replaceState: true });
      return;
    }
    initializedLessonId = lesson.id;
    const firstOpen = lesson.questions.findIndex((candidate) => !questionIsMastered(candidate));
    reviewRun = firstOpen < 0;
    currentIndex = reviewRun ? 0 : firstOpen;
    sessionXp = 0;
    sessionCorrectFirstTry = 0;
    sessionCompletedNow = false;
    sessionStarsImproved = false;
    sessionPreviousStars = persistedProgress?.stars ?? 0;
    pathCompletionXp = 0;
    pathUnlockedReading = false;
    optionOrderSeed = createOptionOrderSeed();
    completionError = '';
    answerSaveError = '';
    initiallyMasteredQuestionIds = new Set(
      lesson.questions
        .filter((question) => questionIsMastered(question))
        .map((question) => question.id),
    );
    attemptedQuestionIds = new Set<string>();
    repairedQuestionIds = new Set<string>();
    stage = 'intro';
    resetAnswer();
  }

  function nextUnfinishedLesson(currentLessonId: string) {
    const current = visibleLessons.findIndex((candidate) => candidate.id === currentLessonId);
    for (let offset = 1; offset < visibleLessons.length; offset += 1) {
      const candidate = visibleLessons[(Math.max(-1, current) + offset) % visibleLessons.length];
      if (!lessonProgress($appStore.course, candidate).completed) return candidate;
    }
    return undefined;
  }

  function questionIsMastered(
    candidate: GrammarQuestion,
    events: CourseAnswerEvent[] = $appStore.course.events,
  ): boolean {
    if (!lesson) return false;
    return events.some(
      (event) =>
        event.lessonId === lesson?.id && event.questionId === candidate.id && event.correct,
    );
  }

  function findNextOpenQuestionIndex(
    afterIndex: number,
    events: CourseAnswerEvent[] = $appStore.course.events,
  ): number {
    if (!lesson) return -1;
    if (reviewRun) return afterIndex + 1 < lesson.questions.length ? afterIndex + 1 : -1;

    const after = lesson.questions.findIndex(
      (candidate, index) => index > afterIndex && !questionIsMastered(candidate, events),
    );
    if (after >= 0) return after;
    return lesson.questions.findIndex(
      (candidate, index) => index < afterIndex && !questionIsMastered(candidate, events),
    );
  }

  function normalize(value: string): string {
    return value
      .normalize('NFKC')
      .trim()
      .toLocaleLowerCase('de-DE')
      .replace(/[.!?]+$/u, '')
      .replace(/\s+/g, ' ');
  }

  function createOptionOrderSeed(): string {
    if (typeof globalThis.crypto !== 'undefined') {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      return String(values[0]);
    }
    return `${Date.now()}:${Math.random()}`;
  }

  function expectedAnswer(current: GrammarQuestion): string {
    if (current.kind === 'choice') return grammarOptionCopy($motherTongue, current.answer);
    if (current.kind === 'fill') return current.answers[0];
    return current.answer.join(' ');
  }

  function answerIsCorrect(current: GrammarQuestion): boolean {
    if (current.kind === 'choice') return normalize(selectedChoice) === normalize(current.answer);
    if (current.kind === 'fill') {
      return current.answers.some((answer) => normalize(fillAnswer) === normalize(answer));
    }
    return selectedOrderIndices.every(
      (tokenIndex, index) =>
        normalize(current.tokens[tokenIndex]) === normalize(current.answer[index] ?? ''),
    );
  }

  function startLesson(): void {
    stage = 'question';
    resetAnswer();
    void focusInput();
  }

  function resetAnswer(): void {
    selectedChoice = '';
    fillAnswer = '';
    selectedOrderIndices = [];
    feedback = undefined;
    answerSaveError = '';
    ruleVisible = false;
    ruleConsulted = false;
    submitting = false;
    startedAt = Date.now();
  }

  async function focusInput(): Promise<void> {
    await tick();
    if (question?.kind === 'fill') inputElement?.focus();
    else questionHeading?.focus();
  }

  async function insertCharacter(character: string): Promise<void> {
    if (!inputElement || feedback || submitting) return;
    const start = inputElement.selectionStart ?? fillAnswer.length;
    const end = inputElement.selectionEnd ?? start;
    fillAnswer = fillAnswer.slice(0, start) + character + fillAnswer.slice(end);
    await tick();
    inputElement.focus();
    inputElement.setSelectionRange(start + character.length, start + character.length);
  }

  function chooseChoice(option: string): void {
    if (feedback || submitting) return;
    selectedChoice = option;
    vibrate(7);
  }

  function chooseOrderToken(index: number): void {
    if (feedback || submitting || selectedOrderIndices.includes(index)) return;
    selectedOrderIndices = [...selectedOrderIndices, index];
    vibrate(7);
  }

  function removeOrderToken(position: number): void {
    if (feedback || submitting) return;
    selectedOrderIndices = selectedOrderIndices.filter((_, index) => index !== position);
  }

  function clearOrder(): void {
    if (feedback || submitting) return;
    selectedOrderIndices = [];
  }

  function vibrate(milliseconds: number): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(milliseconds);
  }

  async function submitAnswer(): Promise<void> {
    if (!lesson || !question || !canSubmit || feedback || submitting) return;
    submitting = true;
    answerSaveError = '';
    const correct = answerIsCorrect(question);
    const firstAttemptThisRun = !attemptedQuestionIds.has(question.id);

    try {
      const result = await appStore.answerCourseQuestion({
        lessonId: lesson.id,
        questionId: question.id,
        correct,
        hintsUsed: ruleConsulted ? 1 : 0,
        responseMs: Date.now() - startedAt,
      });
      attemptedQuestionIds = new Set([...attemptedQuestionIds, question.id]);
      if (!correct) repairedQuestionIds = new Set([...repairedQuestionIds, question.id]);
      sessionXp += result.xpAwarded;
      if (correct && firstAttemptThisRun) sessionCorrectFirstTry += 1;
      sessionCompletedNow ||= result.lessonCompletedNow;
      feedback = {
        correct,
        explanation: questionCopy?.explanation ?? question.explanation,
        expected: expectedAnswer(question),
        xp: result.xpAwarded,
        firstTry: firstAttemptThisRun,
      };
      vibrate(correct ? 18 : 45);
    } catch (error) {
      answerSaveError =
        error instanceof Error
          ? error.message
          : copy('Odpověď se nepodařilo uložit.', 'The answer could not be saved.');
    } finally {
      submitting = false;
      if (feedback) {
        await tick();
        feedbackButton?.focus();
      }
    }
  }

  function retryQuestion(): void {
    if (submitting || advancing) return;
    resetAnswer();
    void focusInput();
  }

  function handleFeedbackAction(): void {
    if (!feedback || submitting || advancing) return;
    if (!feedback.correct) {
      retryQuestion();
      return;
    }
    void advance();
  }

  async function advance(): Promise<void> {
    if (!lesson || !feedback?.correct || submitting || advancing) return;
    advancing = true;
    completionError = '';
    const targetIndex = findNextOpenQuestionIndex(currentIndex, $appStore.course.events);

    try {
      if (targetIndex < 0) {
        const correctFirstTry = completedGrammarRunFirstTry({
          questionIds: lesson.questions.map((candidate) => candidate.id),
          initiallyMasteredQuestionIds,
          attemptedQuestionIds,
          sessionCorrectFirstTry,
          reviewRun,
        });
        if (correctFirstTry !== undefined) {
          submitting = true;
          try {
            const result = await appStore.completeGrammarLessonRun({
              lessonId: lesson.id,
              correctFirstTry,
              total: lesson.questions.length,
              pathNodeId,
            });
            sessionStarsImproved = result.improved;
            sessionPreviousStars = result.previousBest;
            pathCompletionXp = result.pathCompletion?.xpAwarded ?? 0;
            pathUnlockedReading = Boolean(result.pathCompletion?.unlockedStoryBookId);
          } catch (error) {
            completionError =
              error instanceof Error
                ? error.message
                : copy(
                    'Nejlepší výsledek se nepodařilo uložit.',
                    'Your best result could not be saved.',
                  );
            return;
          } finally {
            submitting = false;
          }
        }
        stage = 'complete';
        return;
      }

      currentIndex = targetIndex;
      resetAnswer();
      await focusInput();
    } finally {
      advancing = false;
    }
  }

  function handleKeyboard(event: KeyboardEvent): void {
    if (stage !== 'question' || !question || submitting || advancing) return;
    if (event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    // Let native buttons, links and disclosure controls handle Enter exactly once.
    if (
      event.key === 'Enter' &&
      event.target instanceof Element &&
      event.target.closest('button, a, summary')
    )
      return;
    if (question.kind === 'choice' && !feedback && /^[1-4]$/.test(event.key)) {
      const option = displayedChoiceOptions[Number(event.key) - 1];
      if (option) chooseChoice(option);
      return;
    }
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (feedback?.correct) {
      event.preventDefault();
      void advance();
    } else if (feedback) {
      event.preventDefault();
      retryQuestion();
    } else if (canSubmit) {
      event.preventDefault();
      void submitAnswer();
    }
  }

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  const gateTitle =
    'mt-[0.45rem] text-[clamp(1.8rem,7vw,2.8rem)] leading-[0.98] font-[920] tracking-[-0.04em]';
  const gateText = 'mx-auto mt-[0.8rem] mb-0 leading-[1.55] text-ink-600';
  const gateAction =
    'mt-[1.15rem] inline-flex min-h-12 items-center justify-center gap-[0.45rem] rounded-[0.35rem_0.9rem_0.35rem_0.35rem] border border-ink-950 bg-acid-500 px-4 py-[0.7rem] text-[0.74rem] font-[880] text-ink-950 shadow-[3px_3px_0_var(--color-ink-950)]';
  const gateKicker =
    'mt-3 mb-0 font-mono text-[0.62rem] font-extrabold tracking-[0.08em] text-cobalt-700 uppercase';
  const tokenButton =
    'min-h-[2.35rem] rounded-[0.7rem] border border-ink-950 px-[0.65rem] py-[0.45rem] text-[0.75rem] font-[760] shadow-[2px_2px_0_rgb(21_25_28/0.16)] [transition:transform_140ms_var(--ease-out-emil),opacity_140ms_var(--ease-out-emil)] fine-hover:not-disabled:[transform:translateY(-1px)]';
  const footerButton =
    'flex min-h-[2.8rem] items-center justify-center gap-[0.4rem] rounded-xl border border-ink-950 bg-ink-950 px-[0.85rem] py-[0.65rem] text-[0.84rem] font-[850] text-white [transition:transform_140ms_var(--ease-out-emil),opacity_140ms_var(--ease-out-emil)] active:not-disabled:[transform:scale(0.97)] disabled:opacity-35 min-[640px]:min-w-[8.8rem]';

  function choiceClass(option: string, answer: string) {
    const revealed = Boolean(feedback);
    const selected = selectedChoice === option;
    const tone =
      revealed && option === answer
        ? 'border-mint-700 bg-mint-50'
        : revealed && selected
          ? 'border-coral-700 bg-coral-50'
          : selected
            ? 'border-cobalt-700 bg-sky-50'
            : 'border-[color-mix(in_srgb,var(--color-ink-950)_28%,transparent)] bg-white fine-hover:not-disabled:border-ink-950 fine-hover:not-disabled:bg-paper-100 fine-hover:not-disabled:shadow-[0_3px_0_rgb(21_25_28/0.16)] fine-hover:not-disabled:[transform:translateY(-1px)]';
    return [
      'grid min-h-13 grid-cols-[1.8rem_minmax(0,1fr)_auto] items-center gap-[0.55rem] rounded-[0.82rem] border px-[0.7rem] py-[0.55rem] text-left [transition:transform_140ms_var(--ease-out-emil),border-color_160ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil),box-shadow_160ms_var(--ease-out-emil)] active:not-disabled:[transform:scale(0.98)] short-screen:min-h-11',
      selected ? 'shadow-[0_0_0_3px_rgb(49_83_199/0.12)]' : 'shadow-[0_2px_0_rgb(21_25_28/0.12)]',
      tone,
    ];
  }
</script>

<svelte:head>
  <title>{lessonCopy?.title ?? copy('Gramatická lekce', 'Grammar lesson')} · Fritz</title>
</svelte:head>

{#if !$appStore.ready}
  <div class="grid min-h-dvh place-items-center">
    <LoadingState label={copy('Připravuji lekci…', 'Preparing the lesson…')} />
  </div>
{:else if !lesson || pathAccessLocked}
  <main class="grid min-h-dvh place-items-center p-5 text-center">
    <div
      class="w-[min(100%,31rem)] rounded-[0.45rem_1.45rem_0.45rem_0.45rem] border border-ink-950 bg-paper-50 p-[clamp(1.3rem,5vw,2.25rem)] shadow-[6px_6px_0_var(--color-ink-950)]"
    >
      {#if !lesson}
        <p class={gateKicker}>{copy('Procvičení gramatiky', 'Grammar practice')}</p>
        <h1 class={gateTitle}>
          {copy('Tahle lekce už v kurzu není.', 'This lesson is no longer in the course.')}
        </h1>
        <p class={gateText}>
          {copy(
            'Vyber jinou lekci z přehledu gramatiky.',
            'Choose another short lesson from the grammar catalog.',
          )}
        </p>
        <a class={gateAction} href="/grammar/"
          ><ArrowLeft size={18} /> {copy('Zpět ke gramatice', 'Back to grammar')}</a
        >
      {:else}
        <span
          class="mx-auto mb-3 grid size-14 place-items-center rounded-[0.35rem_1rem_0.35rem_0.35rem] border border-ink-950 bg-paper-200"
          ><LockKeyhole size={28} /></span
        >
        <p class={gateKicker}>{copy('Zamčený krok cesty', 'Locked path step')}</p>
        <h1 class={gateTitle}>{lessonCopy?.shortTitle}</h1>
        <p class={gateText}>
          {copy(
            'Tahle lekce se odemkne po dokončení předchozího kroku.',
            'This lesson unlocks when you finish the previous step.',
          )}
        </p>
        <a class={gateAction} href="/"
          ><ArrowLeft size={18} /> {copy('Zpět na dnešní cestu', 'Back to today’s path')}</a
        >
      {/if}
    </div>
  </main>
{:else if stage === 'intro' && lessonCopy}
  <GrammarLessonIntro
    {lesson}
    {lessonCopy}
    number={grammarLessons.indexOf(lesson) + 1}
    onPath={Boolean(pathNodeId)}
    progress={persistedProgress}
    {returnHref}
    onstart={startLesson}
  />
{:else if stage === 'question' && question}
  <div class="{lessonShell} grid grid-rows-[auto_minmax(0,1fr)_auto] bg-paper-50">
    <header
      class="{lessonBar} min-h-[calc(3.75rem+var(--safe-top))] border-[color-mix(in_srgb,var(--color-ink-950)_16%,transparent)] bg-[color-mix(in_srgb,var(--color-paper-50)_94%,transparent)]"
    >
      <a class={lightClose} href={returnHref} aria-label={copy('Ukončit lekci', 'Exit lesson')}
        ><ArrowLeft size={20} /></a
      >
      <div
        class="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-[0.55rem]"
        aria-label={copy(
          `Otázka ${currentIndex + 1} z ${lesson.questions.length}`,
          `Question ${currentIndex + 1} of ${lesson.questions.length}`,
        )}
      >
        <div
          class="h-[0.55rem] overflow-hidden rounded-full border border-[color-mix(in_srgb,var(--color-ink-950)_16%,transparent)] bg-paper-100"
        >
          <i
            class="block h-full w-full origin-left rounded-[inherit] bg-acid-500 [transition:transform_280ms_var(--ease-out-emil)]"
            style:transform={`scaleX(${questionPercent / 100})`}
          ></i>
        </div>
        <span
          class="font-mono text-[0.55rem] font-extrabold text-ink-600"
          data-testid="question-progress">{currentIndex + 1}/{lesson.questions.length}</span
        >
      </div>
      <span class="{pill} bg-paper-100 text-cobalt-700"><Sparkles size={14} /> +{sessionXp}</span>
    </header>

    <main
      class="min-h-0 overflow-y-auto overscroll-contain px-[0.85rem] py-[clamp(0.75rem,3vh,1.5rem)] min-[640px]:px-6 short-screen:py-[0.55rem]"
    >
      <div
        class={[
          'mx-auto flex min-h-full w-[min(100%,44rem)] flex-col rounded-[1rem_1.7rem_1rem_1rem] border p-[clamp(0.9rem,3.2vw,1.5rem)] shadow-[5px_5px_0_rgb(21_25_28/0.1)] [transition:background-color_180ms_var(--ease-out-emil),border-color_180ms_var(--ease-out-emil)] short-screen:p-3',
          !feedback
            ? 'border-ink-950 bg-paper-50'
            : feedback.correct
              ? 'border-mint-700 bg-[color-mix(in_srgb,var(--color-mint-50)_65%,white)]'
              : 'border-coral-700 bg-[color-mix(in_srgb,var(--color-coral-50)_65%,white)]',
        ]}
      >
        <div class="flex items-center justify-between gap-2">
          <span
            class="rounded-full bg-ink-950 px-[0.55rem] py-[0.3rem] font-mono text-[0.5rem] font-extrabold tracking-[0.06em] text-white uppercase"
            >{question.kind === 'choice'
              ? copy('Vyber', 'Choose')
              : question.kind === 'fill'
                ? copy('Doplň', 'Complete')
                : copy('Poskládej', 'Build')}</span
          >
          <em class="truncate font-mono text-[0.5rem] font-bold text-ink-600 not-italic"
            >{questionCopy?.skill}</em
          >
        </div>
        <p
          class="mt-[clamp(0.75rem,2.5vh,1.15rem)] mb-0 text-[0.68rem] font-extrabold text-cobalt-700 short-screen:mt-[0.55rem]"
        >
          {questionCopy?.instruction}
        </p>
        <h1
          class="mt-1 max-w-[23ch] text-[clamp(1.4rem,5.5vw,2.35rem)] leading-[1.02] font-black tracking-[-0.04em] text-balance outline-none short-screen:text-[clamp(1.2rem,4.7vw,1.7rem)]"
          bind:this={questionHeading}
          tabindex="-1"
        >
          {questionCopy?.prompt}
        </h1>

        {#if question.kind === 'choice'}
          {@const choiceQuestion = question}
          <div
            class="mt-[clamp(0.85rem,3vh,1.35rem)] grid gap-[0.55rem] short-screen:mt-[0.6rem] short-screen:gap-[0.35rem]"
          >
            {#each displayedChoiceOptions as option, index}
              <button
                type="button"
                class={choiceClass(option, choiceQuestion.answer)}
                disabled={Boolean(feedback) || submitting}
                onclick={() => chooseChoice(option)}
              >
                <span
                  class="grid size-[1.65rem] place-items-center rounded-[0.52rem] bg-paper-100 font-mono text-[0.55rem] font-extrabold text-ink-600"
                  >{index + 1}</span
                >
                <strong
                  class="min-w-0 text-[clamp(0.78rem,3vw,0.95rem)] font-[750]"
                  lang={grammarOptionLanguage($motherTongue, option)}
                  >{grammarOptionCopy($motherTongue, option)}</strong
                >
                {#if feedback && option === choiceQuestion.answer}<Check size={18} />{/if}
              </button>
            {/each}
          </div>
        {:else if question.kind === 'fill'}
          {@const fillQuestion = question}
          <form
            class="mt-[0.8rem] grid flex-1 content-center"
            onsubmit={(event) => {
              event.preventDefault();
              void submitAnswer();
            }}
          >
            <div
              class="flex flex-wrap items-baseline justify-center gap-[0.35rem] rounded-2xl border border-[color-mix(in_srgb,var(--color-ink-950)_18%,transparent)] bg-white px-[0.85rem] py-[clamp(1.1rem,5vw,2.2rem)] text-center text-[clamp(1.2rem,5.5vw,2rem)] leading-[1.45] font-extrabold"
              lang="de"
            >
              <span>{fillQuestion.before}</span>
              <input
                class="w-[min(11rem,42vw)] rounded-none border-0 border-b-[3px] border-cobalt-700 bg-sky-50 px-[0.35rem] py-[0.1rem] text-center outline-none focus:border-ink-950 focus:bg-acid-100"
                bind:this={inputElement}
                bind:value={fillAnswer}
                disabled={Boolean(feedback) || submitting}
                placeholder={fillQuestion.placeholder ?? '…'}
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                aria-label={copy('Chybějící německý výraz', 'Missing German expression')}
              />
              <span>{fillQuestion.after}</span>
            </div>
            {#if !feedback}<p
                class="mt-[0.65rem] mb-0 flex items-center justify-center gap-[0.35rem] text-center text-[0.65rem] text-ink-600"
              >
                <Lightbulb size={14} />
                {questionCopy?.hint ?? fillQuestion.hint}
              </p>{/if}
            {#if !feedback}<GermanKeyboard
                oninsert={(character) => void insertCharacter(character)}
              />{/if}
          </form>
        {:else}
          {@const orderQuestion = question}
          <div class="mt-[0.8rem] grid flex-1 content-center gap-3">
            <div
              class="flex min-h-20 flex-wrap content-center justify-center gap-[0.38rem] rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--color-ink-950)_40%,transparent)] bg-white p-[0.7rem]"
              lang="de"
              aria-label={copy('Sestavená věta', 'Built sentence')}
            >
              {#if selectedOrderIndices.length === 0}
                <span class="text-[0.67rem] text-ink-600"
                  >{copy(
                    'Klepni na slova ve správném pořadí',
                    'Tap the words in the correct order',
                  )}</span
                >
              {:else}
                {#each selectedOrderTokens as token, position}
                  <button
                    class="{tokenButton} bg-sky-50"
                    type="button"
                    disabled={Boolean(feedback)}
                    onclick={() => removeOrderToken(position)}>{token}</button
                  >
                {/each}
              {/if}
            </div>
            <div
              class="flex flex-wrap justify-center gap-[0.4rem]"
              data-testid="token-bank"
              lang="de"
              aria-label={copy('Dostupná slova', 'Available words')}
            >
              {#each orderQuestion.tokens as token, index}
                {@const used = selectedOrderIndices.includes(index)}
                <button
                  class={[tokenButton, 'bg-paper-50', used && '[transform:scale(0.95)] opacity-18']}
                  type="button"
                  disabled={Boolean(feedback) || used}
                  onclick={() => chooseOrderToken(index)}>{token}</button
                >
              {/each}
            </div>
            {#if selectedOrderIndices.length > 0 && !feedback}
              <button
                class="inline-flex items-center justify-center gap-[0.3rem] justify-self-center text-[0.62rem] font-[750] text-ink-600"
                type="button"
                onclick={clearOrder}
                ><RotateCcw size={14} /> {copy('Začít znovu', 'Start over')}</button
              >
            {/if}
          </div>
        {/if}
        {#if !feedback && lessonCopy}
          <GrammarRuleReminder
            lesson={lessonCopy}
            bind:open={ruleVisible}
            onopen={() => {
              ruleConsulted = true;
            }}
          />
        {/if}
      </div>
    </main>

    <footer
      class={[
        'safe-bottom grid grid-cols-[minmax(0,1fr)_auto] items-center gap-[0.7rem] border-t border-[color-mix(in_srgb,var(--color-ink-950)_18%,transparent)] px-[0.85rem] py-[0.68rem] shadow-[0_-10px_32px_rgb(21_25_28/0.07)] [transition:background-color_180ms_var(--ease-out-emil)]',
        footerInset,
        !feedback ? 'bg-paper-50' : feedback.correct ? 'bg-mint-50' : 'bg-coral-50',
      ]}
    >
      {#if feedback}
        <div
          class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-[0.55rem]"
          role="status"
          aria-live="polite"
        >
          <span
            class={[
              'grid size-[2.15rem] place-items-center rounded-[0.65rem] bg-white',
              feedback.correct ? 'text-mint-700' : 'text-coral-700',
            ]}
          >
            {#if feedback.correct}<CheckCircle2 size={22} />{:else}<X size={22} />{/if}
          </span>
          <div
            class="[&>p]:mt-[0.16rem] [&>p]:mb-0 [&>p]:line-clamp-2 [&>p]:text-[0.75rem] [&>p]:leading-[1.45] [&>p]:text-ink-600 short-screen:[&>p]:line-clamp-1"
          >
            <div class="flex items-center gap-[0.4rem]">
              <strong class="text-[0.9rem]"
                >{feedback.correct
                  ? feedback.firstTry
                    ? copy('Přesně tak.', 'Exactly right.')
                    : copy('Teď už ano.', 'That’s right now.')
                  : copy('Ještě ne.', 'Not yet.')}</strong
              >
              {#if feedback.xp > 0}<em
                  class="rounded-full bg-white px-[0.35rem] py-[0.18rem] font-mono text-[0.66rem] font-[850] text-cobalt-700 not-italic"
                  >+{feedback.xp} XP</em
                >{/if}
            </div>
            {#if !feedback.correct}<p class="text-ink-950!">
                {copy('Správně:', 'Correct answer:')}
                <b lang={grammarAnswerLanguage($motherTongue, question)}>{feedback.expected}</b>
              </p>{/if}
            <p>{feedback.explanation}</p>
          </div>
        </div>
        <button
          class={footerButton}
          bind:this={feedbackButton}
          type="button"
          disabled={submitting || advancing}
          onclick={handleFeedbackAction}
        >
          {submitting || advancing
            ? copy('Ukládám výsledek…', 'Saving result…')
            : feedback.correct
              ? nextOpenQuestionIndex < 0
                ? completionError
                  ? copy('Zkusit dokončit znovu', 'Try to finish again')
                  : copy('Dokončit', 'Finish')
                : copy('Další', 'Next')
              : copy('Zkusit znovu', 'Try again')}
          <ArrowRight size={18} />
        </button>
        {#if completionError}<p
            class="col-span-full -mt-[0.15rem] mb-0 text-[0.75rem] font-[760] text-coral-800"
            role="alert"
          >
            {completionError}
          </p>{/if}
      {:else}
        <div
          class={[
            'grid min-w-0 gap-[0.1rem]',
            answerSaveError ? 'text-coral-800' : '[&>span]:text-ink-600',
          ]}
        >
          {#if answerSaveError}
            <span class="font-mono text-[0.75rem]" role="alert"
              >{copy(
                'Uložení se nepodařilo. Odpověď zůstala zachovaná.',
                'Saving failed. Your answer is still here.',
              )}</span
            >
            <strong class="truncate text-[0.86rem]">{answerSaveError}</strong>
          {:else}
            <span class="font-mono text-[0.75rem]"
              >{question.kind === 'choice'
                ? copy('Klávesy 1–4 fungují také', 'Number keys 1–4 work too')
                : copy('Enter = zkontrolovat', 'Enter = check')}</span
            >
            <strong class="truncate text-[0.86rem]">{questionCopy?.skill}</strong>
          {/if}
        </div>
        <button
          class={footerButton}
          type="button"
          disabled={!canSubmit || submitting}
          onclick={() => void submitAnswer()}
        >
          {submitting
            ? copy('Ukládám…', 'Saving…')
            : answerSaveError
              ? copy('Zkusit uložit znovu', 'Try saving again')
              : copy('Zkontrolovat', 'Check')}
          <ArrowRight size={18} />
        </button>
      {/if}
    </footer>
  </div>
{:else if stage === 'complete' && finalProgress && lessonCopy}
  <GrammarLessonComplete
    {lesson}
    {lessonCopy}
    progress={finalProgress}
    run={{
      xp: sessionXp,
      pathXp: pathCompletionXp,
      correctFirstTry: sessionCorrectFirstTry,
      completedNow: sessionCompletedNow,
      starsImproved: sessionStarsImproved,
      previousStars: sessionPreviousStars,
      unlockedReading: pathUnlockedReading,
      repairedQuestionIds,
    }}
    onPath={Boolean(pathNodeId)}
    {returnHref}
    next={nextLesson && nextLessonCopy
      ? { id: nextLesson.id, title: nextLessonCopy.shortTitle }
      : undefined}
  />
{/if}
