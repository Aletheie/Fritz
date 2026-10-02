<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import GrammarCorrections from '$lib/components/course/GrammarCorrections.svelte';
  import GrammarRuleReminder from '$lib/components/course/GrammarRuleReminder.svelte';
  import CelebrationBurst from '$lib/components/gamification/CelebrationBurst.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import {
    completedGrammarRunFirstTry,
    grammarChoiceOptions,
  } from '$lib/domain/course/grammar-run.ts';
  import {
    grammarLessonById,
    grammarLevelForLesson,
    grammarLessons,
    grammarLessonsForLevel,
    lessonProgress,
  } from '$lib/domain/course/grammar.ts';
  import { coursePathNodeById, coursePathNodeState } from '$lib/domain/course/path.ts';
  import { localized } from '$lib/i18n';
  import {
    grammarExampleTranslation,
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
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Star from '@lucide/svelte/icons/star';
  import Trophy from '@lucide/svelte/icons/trophy';
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
</script>

<svelte:head>
  <title>{lessonCopy?.title ?? copy('Gramatická lekce', 'Grammar lesson')} · Fritz</title>
</svelte:head>

{#if !$appStore.ready}
  <div class="immersive-loading">
    <LoadingState label={copy('Připravuji lekci…', 'Preparing the lesson…')} />
  </div>
{:else if !lesson}
  <main class="lesson-gate">
    <div>
      <p class="intro-kicker">{copy('Procvičení gramatiky', 'Grammar practice')}</p>
      <h1>{copy('Tahle lekce už v kurzu není.', 'This lesson is no longer in the course.')}</h1>
      <p>
        {copy(
          'Vyber jinou lekci z přehledu gramatiky.',
          'Choose another short lesson from the grammar catalog.',
        )}
      </p>
      <a class="gate-action" href="/grammar/"
        ><ArrowLeft size={18} /> {copy('Zpět ke gramatice', 'Back to grammar')}</a
      >
    </div>
  </main>
{:else if pathAccessLocked}
  <main class="lesson-gate">
    <div>
      <span class="gate-icon"><LockKeyhole size={28} /></span>
      <p class="intro-kicker">{copy('Zamčený krok cesty', 'Locked path step')}</p>
      <h1>{lessonCopy?.shortTitle}</h1>
      <p>
        {copy(
          'Tahle lekce se odemkne po dokončení předchozího kroku.',
          'This lesson unlocks when you finish the previous step.',
        )}
      </p>
      <a class="gate-action" href="/"
        ><ArrowLeft size={18} /> {copy('Zpět na dnešní cestu', 'Back to today’s path')}</a
      >
    </div>
  </main>
{:else if stage === 'intro'}
  <div class="lesson-shell intro-shell">
    <header class="lesson-topbar">
      <a class="close-button" href={returnHref} aria-label={copy('Zavřít lekci', 'Close lesson')}
        ><X size={20} /></a
      >
      <div class="topbar-title">
        <span>{copy('Kapitola', 'Chapter')} {lesson.unit} · {grammarLevelForLesson(lesson)}</span>
        <strong>{lessonCopy?.shortTitle}</strong>
      </div>
      <span class="time-pill"><Clock3 size={14} /> {lesson.minutes} min</span>
    </header>

    <main class="intro-scroll">
      <div class="intro-content">
        <div class="intro-number">
          {String(grammarLessons.indexOf(lesson) + 1).padStart(2, '0')}
        </div>
        <p class="intro-kicker">
          {pathNodeId
            ? copy('Kurzová cesta · gramatika', 'Course path · grammar')
            : copy('Lekce gramatiky', 'Grammar micro-lesson')}
        </p>
        <h1>{lessonCopy?.title}</h1>
        <p class="intro-subtitle">{lessonCopy?.subtitle}</p>

        <section class="concept-card">
          <span class="concept-icon"><Lightbulb size={21} /></span>
          <div>
            <p>{copy('Jedna myšlenka', 'One key idea')}</p>
            <h2>{lessonCopy?.concept}</h2>
          </div>
        </section>

        <section class="formula-card">
          <p>{copy('Vzor, který si odnášíš', 'The pattern to remember')}</p>
          <strong lang={$motherTongue === 'en' ? 'de' : 'cs'}>{lessonCopy?.formula}</strong>
        </section>

        <div class="example-grid">
          {#each lesson.examples as example, index}
            {@const translation = grammarExampleTranslation($motherTongue, example)}
            <article>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong lang="de">{example.de}</strong>
              {#if translation}<p>{translation}</p>{/if}
            </article>
          {/each}
        </div>
      </div>
    </main>

    <footer class="intro-action safe-bottom">
      <div>
        <span>{lesson.questions.length} {copy('krátkých úloh', 'short activities')}</span>
        <strong
          >{persistedProgress?.completed
            ? copy(
                `Až ${lesson.questions.length * 3} denních XP`,
                `Up to ${lesson.questions.length * 3} daily XP`,
              )
            : copy(
                `Až ${lesson.questions.length * 12 + lesson.completionXp} XP`,
                `Up to ${lesson.questions.length * 12 + lesson.completionXp} XP`,
              )}</strong
        >
      </div>
      <button class="start-button" type="button" onclick={startLesson}>
        {persistedProgress?.completed
          ? copy('Zopakovat', 'Review')
          : persistedProgress?.answered
            ? copy('Pokračovat', 'Continue')
            : copy('Jdu na to', 'Start lesson')}
        <ArrowRight size={19} />
      </button>
    </footer>
  </div>
{:else if stage === 'question' && question}
  <div class:has-feedback={Boolean(feedback)} class="lesson-shell question-shell">
    <header class="question-header">
      <a class="close-button" href={returnHref} aria-label={copy('Ukončit lekci', 'Exit lesson')}
        ><ArrowLeft size={20} /></a
      >
      <div
        class="question-progress"
        aria-label={copy(
          `Otázka ${currentIndex + 1} z ${lesson.questions.length}`,
          `Question ${currentIndex + 1} of ${lesson.questions.length}`,
        )}
      >
        <div><i style={`--question-progress:${questionPercent / 100}`}></i></div>
        <span>{currentIndex + 1}/{lesson.questions.length}</span>
      </div>
      <span class="xp-pill"><Sparkles size={14} /> +{sessionXp}</span>
    </header>

    <main class="question-main">
      <div
        class="question-card"
        class:correct-card={feedback?.correct}
        class:wrong-card={feedback && !feedback.correct}
      >
        <div class="question-label">
          <span
            >{question.kind === 'choice'
              ? copy('Vyber', 'Choose')
              : question.kind === 'fill'
                ? copy('Doplň', 'Complete')
                : copy('Poskládej', 'Build')}</span
          >
          <em>{questionCopy?.skill}</em>
        </div>
        <p class="instruction">{questionCopy?.instruction}</p>
        <h1 bind:this={questionHeading} tabindex="-1">{questionCopy?.prompt}</h1>

        {#if question.kind === 'choice'}
          {@const choiceQuestion = question}
          <div class="choice-list">
            {#each displayedChoiceOptions as option, index}
              <button
                type="button"
                class:selected={selectedChoice === option}
                class:choice-correct={Boolean(feedback) && option === choiceQuestion.answer}
                class:choice-wrong={Boolean(feedback) &&
                  selectedChoice === option &&
                  option !== choiceQuestion.answer}
                disabled={Boolean(feedback) || submitting}
                onclick={() => chooseChoice(option)}
              >
                <span>{index + 1}</span>
                <strong lang={grammarOptionLanguage($motherTongue, option)}
                  >{grammarOptionCopy($motherTongue, option)}</strong
                >
                {#if feedback && option === choiceQuestion.answer}<Check size={18} />{/if}
              </button>
            {/each}
          </div>
        {:else if question.kind === 'fill'}
          {@const fillQuestion = question}
          <form
            class="fill-area"
            onsubmit={(event) => {
              event.preventDefault();
              void submitAnswer();
            }}
          >
            <div class="fill-sentence" lang="de">
              <span>{fillQuestion.before}</span>
              <input
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
            {#if !feedback}<p class="hint">
                <Lightbulb size={14} />
                {questionCopy?.hint ?? fillQuestion.hint}
              </p>{/if}
            {#if !feedback}<GermanKeyboard
                oninsert={(character) => void insertCharacter(character)}
              />{/if}
          </form>
        {:else}
          {@const orderQuestion = question}
          <div class="order-area">
            <div
              class="order-answer"
              lang="de"
              aria-label={copy('Sestavená věta', 'Built sentence')}
            >
              {#if selectedOrderIndices.length === 0}
                <span class="order-placeholder"
                  >{copy(
                    'Klepni na slova ve správném pořadí',
                    'Tap the words in the correct order',
                  )}</span
                >
              {:else}
                {#each selectedOrderTokens as token, position}
                  <button
                    type="button"
                    disabled={Boolean(feedback)}
                    onclick={() => removeOrderToken(position)}>{token}</button
                  >
                {/each}
              {/if}
            </div>
            <div
              class="token-bank"
              lang="de"
              aria-label={copy('Dostupná slova', 'Available words')}
            >
              {#each orderQuestion.tokens as token, index}
                <button
                  type="button"
                  class:used={selectedOrderIndices.includes(index)}
                  disabled={Boolean(feedback) || selectedOrderIndices.includes(index)}
                  onclick={() => chooseOrderToken(index)}>{token}</button
                >
              {/each}
            </div>
            {#if selectedOrderIndices.length > 0 && !feedback}
              <button class="clear-order" type="button" onclick={clearOrder}
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
      class:feedback-correct={feedback?.correct}
      class:feedback-wrong={feedback && !feedback.correct}
      class="answer-footer safe-bottom"
    >
      {#if feedback}
        <div class="feedback-copy" role="status" aria-live="polite">
          <span class="feedback-icon">
            {#if feedback.correct}<CheckCircle2 size={22} />{:else}<X size={22} />{/if}
          </span>
          <div>
            <div class="feedback-title-row">
              <strong
                >{feedback.correct
                  ? feedback.firstTry
                    ? copy('Přesně tak.', 'Exactly right.')
                    : copy('Teď už ano.', 'That’s right now.')
                  : copy('Ještě ne.', 'Not yet.')}</strong
              >
              {#if feedback.xp > 0}<em>+{feedback.xp} XP</em>{/if}
            </div>
            {#if !feedback.correct}<p class="expected">
                {copy('Správně:', 'Correct answer:')}
                <b lang={grammarAnswerLanguage($motherTongue, question)}>{feedback.expected}</b>
              </p>{/if}
            <p>{feedback.explanation}</p>
          </div>
        </div>
        <button
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
        {#if completionError}<p class="completion-error" role="alert">{completionError}</p>{/if}
      {:else}
        <div class:error-prompt={Boolean(answerSaveError)} class="footer-prompt">
          {#if answerSaveError}
            <span role="alert"
              >{copy(
                'Uložení se nepodařilo. Odpověď zůstala zachovaná.',
                'Saving failed. Your answer is still here.',
              )}</span
            >
            <strong>{answerSaveError}</strong>
          {:else}
            <span
              >{question.kind === 'choice'
                ? copy('Klávesy 1–4 fungují také', 'Number keys 1–4 work too')
                : copy('Enter = zkontrolovat', 'Enter = check')}</span
            >
            <strong>{questionCopy?.skill}</strong>
          {/if}
        </div>
        <button
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
{:else if stage === 'complete' && finalProgress}
  <div class="lesson-shell complete-shell completion-arrival">
    <CelebrationBurst visible={$appStore.settings?.celebrations !== false} />
    <header class="complete-header">
      <a class="close-button" href={returnHref} aria-label={copy('Zavřít souhrn', 'Close summary')}
        ><X size={20} /></a
      >
      <span>{copy('Souhrn lekce', 'Lesson summary')}</span>
      <span class="complete-xp"><Sparkles size={14} /> +{sessionXp + pathCompletionXp} XP</span>
    </header>

    <main class="complete-main">
      <div class="complete-content">
        <div class="trophy-mark"><Trophy size={34} /></div>
        <p class="complete-kicker">{copy('Lekce dokončena', 'Lesson complete')}</p>
        <h1>{lessonCopy?.title}</h1>
        <p class="complete-lead">
          {pathNodeId && pathCompletionXp > 0
            ? copy(
                `Gramatiku máš hotovou. Za první dokončení získáváš ${pathCompletionXp} XP.`,
                `The grammar step is complete. You earned ${pathCompletionXp} XP for the first completion.`,
              )
            : sessionStarsImproved && sessionPreviousStars > 0
              ? copy(
                  `Nový osobní rekord. Lekci sis zlepšila z ${sessionPreviousStars} na ${finalProgress.stars} hvězdy.`,
                  `New personal best. You improved this lesson from ${sessionPreviousStars} to ${finalProgress.stars} stars.`,
                )
              : sessionCompletedNow
                ? copy(
                    'Lekce je dokončená. Pravidlo si ještě procvičíš v dalších větách.',
                    'Lesson complete. You’ll practise this rule in more sentences as you go.',
                  )
                : sessionXp > 0
                  ? copy(
                      'Lekci máš zopakovanou. Za první správné odpovědi dnešního dne získáváš další XP.',
                      'Lesson reviewed. You earned XP for the first correct answer to each question today.',
                    )
                  : copy(
                      'Lekci máš zopakovanou. XP za dnešní správné odpovědi už máš započítané.',
                      'Lesson reviewed. You’ve already earned today’s XP for these answers.',
                    )}
        </p>

        {#if sessionStarsImproved}
          <p class="personal-best">
            <Sparkles size={15} />
            {sessionPreviousStars > 0
              ? copy('Nový osobní rekord', 'New personal best')
              : copy('První hodnocení lekce', 'First lesson rating')}
          </p>
        {/if}

        <div
          class="star-row"
          aria-label={copy(
            `${finalProgress.stars} ze 3 hvězd`,
            `${finalProgress.stars} of 3 stars`,
          )}
        >
          {#each [1, 2, 3] as star}
            <span class:earned={star <= finalProgress.stars}
              ><Star size={29} fill={star <= finalProgress.stars ? 'currentColor' : 'none'} /></span
            >
          {/each}
        </div>

        <div class="summary-grid">
          <article>
            <strong>{finalProgress.correct}/{finalProgress.total}</strong><span
              >{copy('pravidel použitých správně', 'patterns used correctly')}</span
            >
          </article>
          <article>
            <strong>{sessionCorrectFirstTry}</strong><span
              >{copy('odpovědí napoprvé v této jízdě', 'first-try answers in this run')}</span
            >
          </article>
          <article>
            <strong>{sessionXp + pathCompletionXp}</strong><span
              >{copy('XP získaných v lekci a cestě', 'XP earned in the lesson and path')}</span
            >
          </article>
        </div>

        <section class="takeaway">
          <p><Check size={16} /> {copy('Co si odnášíš', 'Your takeaway')}</p>
          <strong lang={$motherTongue === 'en' ? 'de' : 'cs'}>{lessonCopy?.formula}</strong>
          <span>{lessonCopy?.concept}</span>
        </section>
        <GrammarCorrections {lesson} questionIds={repairedQuestionIds} />
      </div>
    </main>

    <footer class="complete-actions safe-bottom">
      {#if pathNodeId}
        <a class="primary-action" href="/"
          >{copy('Pokračovat po cestě', 'Continue on the path')} <ArrowRight size={18} /></a
        >
        {#if pathUnlockedReading}<span class="path-unlock"
            >{copy('Odemkla se bonusová četba.', 'Optional reading is now unlocked.')}</span
          >{/if}
      {:else}
        <a class="secondary-action" href="/">{copy('Dnešní cesta', 'Today’s path')}</a>
      {/if}
      {#if !pathNodeId && nextLesson}
        <a class="primary-action" href={`/grammar/${nextLesson.id}/`}
          >{copy('Další', 'Next')}: {nextLessonCopy?.shortTitle} <ArrowRight size={18} /></a
        >
      {:else if !pathNodeId}
        <a class="primary-action" href="/progress/"
          >{copy('Zobrazit pokrok', 'View progress')} <ArrowRight size={18} /></a
        >
      {/if}
    </footer>
  </div>
{/if}

<style>
  .immersive-loading {
    display: grid;
    min-height: 100dvh;
    place-items: center;
  }
  .lesson-gate {
    display: grid;
    min-height: 100dvh;
    place-items: center;
    padding: 1.25rem;
    text-align: center;
  }
  .lesson-gate > div {
    width: min(100%, 31rem);
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 1.45rem 0.45rem 0.45rem;
    background: var(--color-paper-50);
    padding: clamp(1.3rem, 5vw, 2.25rem);
    box-shadow: 6px 6px 0 var(--color-ink-950);
  }
  .lesson-gate h1 {
    margin: 0.45rem 0 0;
    font-size: clamp(1.8rem, 7vw, 2.8rem);
    font-weight: 920;
    letter-spacing: -0.04em;
    line-height: 0.98;
  }
  .lesson-gate > div > p:last-of-type {
    margin: 0.8rem auto 0;
    color: var(--color-ink-600);
    line-height: 1.55;
  }
  .gate-icon {
    display: grid;
    width: 3.5rem;
    height: 3.5rem;
    margin: 0 auto 0.75rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.35rem 1rem 0.35rem 0.35rem;
    background: var(--color-paper-200);
  }
  .gate-action {
    display: inline-flex;
    min-height: 3rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    margin-top: 1.15rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.35rem 0.9rem 0.35rem 0.35rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
    padding: 0.7rem 1rem;
    font-size: 0.74rem;
    font-weight: 880;
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .lesson-shell {
    width: 100%;
    height: 100dvh;
    overflow: hidden;
    color: var(--color-ink-950);
    background: var(--color-paper-100);
  }
  .close-button {
    display: grid;
    width: 2.65rem;
    height: 2.65rem;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 22%, transparent);
    border-radius: 0.78rem;
    background: var(--color-paper-50);
    transition:
      transform 140ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil);
  }
  .close-button:active {
    transform: scale(0.95);
  }

  .intro-shell {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
  }
  .lesson-topbar,
  .question-header,
  .complete-header {
    display: flex;
    min-height: calc(4rem + var(--safe-top));
    align-items: center;
    gap: 0.75rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-ink-950) 16%, transparent);
    padding: var(--safe-top) 0.85rem 0;
    background: color-mix(in srgb, var(--color-paper-50) 94%, transparent);
    backdrop-filter: blur(18px);
  }
  .topbar-title {
    display: grid;
    min-width: 0;
    gap: 0.05rem;
  }
  .topbar-title span {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.52rem;
    font-weight: 750;
    text-transform: uppercase;
  }
  .topbar-title strong {
    overflow: hidden;
    font-size: 0.8rem;
    font-weight: 850;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .time-pill,
  .xp-pill,
  .complete-xp {
    display: inline-flex;
    min-height: 2rem;
    align-items: center;
    gap: 0.3rem;
    margin-left: auto;
    border-radius: 99px;
    background: var(--color-paper-100);
    padding: 0 0.6rem;
    font-family: var(--font-mono);
    font-size: 0.56rem;
    font-weight: 800;
    white-space: nowrap;
  }
  .intro-scroll {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .intro-content {
    width: min(100%, 54rem);
    margin: 0 auto;
    padding: 1.25rem 1rem 2rem;
  }
  .intro-number {
    color: color-mix(in srgb, var(--color-ink-950) 17%, transparent);
    font-family: var(--font-mono);
    font-size: clamp(3.3rem, 18vw, 7rem);
    font-weight: 920;
    letter-spacing: -0.04em;
    line-height: 0.72;
  }
  .intro-kicker {
    margin: 0.75rem 0 0;
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .intro-content > h1 {
    max-width: 13ch;
    margin: 0.45rem 0 0;
    font-size: clamp(2.2rem, 9vw, 5.2rem);
    font-weight: 920;
    letter-spacing: -0.04em;
    line-height: 0.9;
    text-wrap: balance;
  }
  .intro-subtitle {
    max-width: 38rem;
    margin: 0.75rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.9rem;
    line-height: 1.55;
  }
  .concept-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.75rem;
    margin-top: 1.35rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 1rem;
    background: var(--color-acid-100);
    padding: 0.9rem;
    box-shadow: 4px 4px 0 var(--color-ink-950);
  }
  .concept-icon {
    display: grid;
    width: 2.8rem;
    height: 2.8rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.8rem;
    background: var(--color-acid-500);
  }
  .concept-card p,
  .formula-card p {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.53rem;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .concept-card h2 {
    margin: 0.28rem 0 0;
    font-size: clamp(0.95rem, 3.4vw, 1.25rem);
    font-weight: 800;
    letter-spacing: -0.025em;
    line-height: 1.25;
  }
  .formula-card {
    margin-top: 0.85rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 1rem;
    color: white;
    background: var(--color-ink-950);
    padding: 1rem;
  }
  .formula-card p {
    color: var(--color-acid-500);
  }
  .formula-card strong {
    display: block;
    margin-top: 0.45rem;
    font-size: clamp(1rem, 4vw, 1.35rem);
    font-weight: 780;
    line-height: 1.35;
  }
  .example-grid {
    display: grid;
    gap: 0.65rem;
    margin-top: 0.85rem;
  }
  .example-grid article {
    position: relative;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 20%, transparent);
    border-radius: 0.9rem;
    background: var(--color-paper-50);
    padding: 0.85rem 0.85rem 0.85rem 2.6rem;
  }
  .example-grid article > span {
    position: absolute;
    top: 0.85rem;
    left: 0.8rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.52rem;
    font-weight: 800;
  }
  .example-grid strong {
    font-size: 0.9rem;
    font-weight: 820;
  }
  .example-grid p {
    margin: 0.2rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.7rem;
  }
  .intro-action {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    border-top: 1px solid color-mix(in srgb, var(--color-ink-950) 18%, transparent);
    background: var(--color-paper-50);
    padding: 0.75rem 0.9rem;
    box-shadow: 0 -12px 35px rgb(21 25 28 / 0.07);
  }
  .intro-action > div {
    display: grid;
    gap: 0.1rem;
  }
  .intro-action span {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.5rem;
  }
  .intro-action strong {
    font-size: 0.72rem;
  }
  .start-button {
    display: flex;
    min-height: 3rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.8rem;
    background: var(--color-acid-500);
    padding: 0.7rem 1rem;
    font-size: 0.77rem;
    font-weight: 880;
    box-shadow: 3px 3px 0 var(--color-ink-950);
    transition:
      transform 150ms var(--ease-out-emil),
      box-shadow 150ms var(--ease-out-emil);
  }
  .start-button:active {
    transform: translate(2px, 2px) scale(0.97);
    box-shadow: 1px 1px 0 var(--color-ink-950);
  }

  .question-shell {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    background: var(--color-paper-50);
  }
  .question-header {
    min-height: calc(3.75rem + var(--safe-top));
  }
  .question-progress {
    display: grid;
    min-width: 0;
    flex: 1;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.55rem;
  }
  .question-progress > div {
    height: 0.55rem;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 16%, transparent);
    border-radius: 99px;
    background: var(--color-paper-100);
  }
  .question-progress i {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: inherit;
    background: var(--color-acid-500);
    transform: scaleX(var(--question-progress));
    transform-origin: left;
    transition: transform 280ms var(--ease-out-emil);
  }
  .question-progress span {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.55rem;
    font-weight: 800;
  }
  .xp-pill {
    margin-left: 0;
    color: var(--color-cobalt-700);
  }
  .question-main {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: clamp(0.75rem, 3vh, 1.5rem) 0.85rem;
  }
  .question-card {
    width: min(100%, 44rem);
    min-height: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-ink-950);
    border-radius: 1rem 1.7rem 1rem 1rem;
    background: var(--color-paper-50);
    padding: clamp(0.9rem, 3.2vw, 1.5rem);
    box-shadow: 5px 5px 0 rgb(21 25 28 / 0.1);
    transition:
      background-color 180ms var(--ease-out-emil),
      border-color 180ms var(--ease-out-emil);
  }
  .question-card.correct-card {
    border-color: var(--color-mint-700);
    background: color-mix(in srgb, var(--color-mint-50) 65%, white);
  }
  .question-card.wrong-card {
    border-color: var(--color-coral-700);
    background: color-mix(in srgb, var(--color-coral-50) 65%, white);
  }
  .question-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .question-label span {
    border-radius: 99px;
    color: white;
    background: var(--color-ink-950);
    padding: 0.3rem 0.55rem;
    font-family: var(--font-mono);
    font-size: 0.5rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .question-label em {
    overflow: hidden;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.5rem;
    font-style: normal;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .instruction {
    margin: clamp(0.75rem, 2.5vh, 1.15rem) 0 0;
    color: var(--color-cobalt-700);
    font-size: 0.68rem;
    font-weight: 800;
  }
  .question-card h1 {
    max-width: 23ch;
    margin: 0.25rem 0 0;
    font-size: clamp(1.4rem, 5.5vw, 2.35rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 1.02;
    text-wrap: balance;
  }
  .choice-list {
    display: grid;
    gap: 0.55rem;
    margin-top: clamp(0.85rem, 3vh, 1.35rem);
  }
  .choice-list button {
    display: grid;
    min-height: 3.25rem;
    grid-template-columns: 1.8rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.55rem;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 28%, transparent);
    border-radius: 0.82rem;
    background: white;
    padding: 0.55rem 0.7rem;
    text-align: left;
    box-shadow: 0 2px 0 rgb(21 25 28 / 0.12);
    transition:
      transform 140ms var(--ease-out-emil),
      border-color 160ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil),
      box-shadow 160ms var(--ease-out-emil);
  }
  .choice-list button > span {
    display: grid;
    width: 1.65rem;
    height: 1.65rem;
    place-items: center;
    border-radius: 0.52rem;
    color: var(--color-ink-600);
    background: var(--color-paper-100);
    font-family: var(--font-mono);
    font-size: 0.55rem;
    font-weight: 800;
  }
  .choice-list strong {
    min-width: 0;
    font-size: clamp(0.78rem, 3vw, 0.95rem);
    font-weight: 750;
  }
  .choice-list button.selected {
    border-color: var(--color-cobalt-700);
    background: var(--color-sky-50);
    box-shadow: 0 0 0 3px rgb(49 83 199 / 0.12);
  }
  .choice-list button.choice-correct {
    border-color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .choice-list button.choice-wrong {
    border-color: var(--color-coral-700);
    background: var(--color-coral-50);
  }
  .choice-list button:active:not(:disabled) {
    transform: scale(0.98);
  }
  .fill-area {
    display: grid;
    flex: 1;
    align-content: center;
    margin-top: 0.8rem;
  }
  .fill-sentence {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: center;
    gap: 0.35rem;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 18%, transparent);
    border-radius: 1rem;
    background: white;
    padding: clamp(1.1rem, 5vw, 2.2rem) 0.85rem;
    font-size: clamp(1.2rem, 5.5vw, 2rem);
    font-weight: 800;
    line-height: 1.45;
    text-align: center;
  }
  .fill-sentence input {
    width: min(11rem, 42vw);
    border: 0;
    border-bottom: 3px solid var(--color-cobalt-700);
    border-radius: 0;
    background: var(--color-sky-50);
    padding: 0.1rem 0.35rem;
    text-align: center;
    outline: none;
  }
  .fill-sentence input:focus {
    background: var(--color-acid-100);
    border-color: var(--color-ink-950);
  }
  .hint {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    margin: 0.65rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.65rem;
    text-align: center;
  }
  .order-area {
    display: grid;
    flex: 1;
    align-content: center;
    gap: 0.75rem;
    margin-top: 0.8rem;
  }
  .order-answer {
    display: flex;
    min-height: 5rem;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    gap: 0.38rem;
    border: 1px dashed color-mix(in srgb, var(--color-ink-950) 40%, transparent);
    border-radius: 1rem;
    background: white;
    padding: 0.7rem;
  }
  .order-answer button,
  .token-bank button {
    min-height: 2.35rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.7rem;
    background: var(--color-paper-50);
    padding: 0.45rem 0.65rem;
    font-size: 0.75rem;
    font-weight: 760;
    box-shadow: 2px 2px 0 rgb(21 25 28 / 0.16);
    transition:
      transform 140ms var(--ease-out-emil),
      opacity 140ms var(--ease-out-emil);
  }
  .order-answer button {
    background: var(--color-sky-50);
  }
  .token-bank {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
  }
  .token-bank button.used {
    opacity: 0.18;
    transform: scale(0.95);
  }
  .order-placeholder {
    color: var(--color-ink-600);
    font-size: 0.67rem;
  }
  .clear-order {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    justify-self: center;
    color: var(--color-ink-600);
    font-size: 0.62rem;
    font-weight: 750;
  }
  .answer-footer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.7rem;
    border-top: 1px solid color-mix(in srgb, var(--color-ink-950) 18%, transparent);
    background: var(--color-paper-50);
    padding: 0.68rem 0.85rem;
    box-shadow: 0 -10px 32px rgb(21 25 28 / 0.07);
    transition: background-color 180ms var(--ease-out-emil);
  }
  .answer-footer.feedback-correct {
    background: var(--color-mint-50);
  }
  .answer-footer.feedback-wrong {
    background: var(--color-coral-50);
  }
  .footer-prompt {
    display: grid;
    min-width: 0;
    gap: 0.1rem;
  }
  .footer-prompt span {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
  .footer-prompt strong {
    overflow: hidden;
    font-size: 0.86rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .footer-prompt.error-prompt span,
  .footer-prompt.error-prompt strong {
    color: var(--color-coral-800);
  }
  .answer-footer > button {
    display: flex;
    min-height: 2.8rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.75rem;
    color: white;
    background: var(--color-ink-950);
    padding: 0.65rem 0.85rem;
    font-size: 0.84rem;
    font-weight: 850;
    transition:
      transform 140ms var(--ease-out-emil),
      opacity 140ms var(--ease-out-emil);
  }
  .answer-footer > button:disabled {
    opacity: 0.35;
  }
  .answer-footer > button:active:not(:disabled) {
    transform: scale(0.97);
  }
  .completion-error {
    grid-column: 1 / -1;
    margin: -0.15rem 0 0;
    color: var(--color-coral-800);
    font-size: 0.75rem;
    font-weight: 760;
  }
  .feedback-copy {
    display: grid;
    min-width: 0;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: 0.55rem;
  }
  .feedback-icon {
    display: grid;
    width: 2.15rem;
    height: 2.15rem;
    place-items: center;
    border-radius: 0.65rem;
    color: var(--color-mint-700);
    background: white;
  }
  .feedback-wrong .feedback-icon {
    color: var(--color-coral-700);
  }
  .feedback-title-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .feedback-title-row strong {
    font-size: 0.9rem;
  }
  .feedback-title-row em {
    border-radius: 99px;
    color: var(--color-cobalt-700);
    background: white;
    padding: 0.18rem 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-style: normal;
    font-weight: 850;
  }
  .feedback-copy p {
    display: -webkit-box;
    overflow: hidden;
    margin: 0.16rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.75rem;
    line-height: 1.45;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .feedback-copy .expected {
    color: var(--color-ink-950);
  }

  .complete-shell {
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    background: var(--color-ink-950);
    color: white;
  }
  .complete-header {
    border-color: rgb(255 255 255 / 0.12);
    background: rgb(21 25 28 / 0.92);
  }
  .complete-header .close-button {
    border-color: rgb(255 255 255 / 0.16);
    color: white;
    background: rgb(255 255 255 / 0.07);
  }
  .complete-header > span:nth-child(2) {
    font-size: 0.75rem;
    font-weight: 800;
  }
  .complete-xp {
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }
  .complete-main {
    min-height: 0;
    overflow-y: auto;
  }
  .complete-content {
    width: min(100%, 42rem);
    margin: 0 auto;
    padding: clamp(1rem, 4vh, 2.5rem) 1rem 2rem;
    text-align: center;
  }
  .trophy-mark {
    display: grid;
    width: 4.4rem;
    height: 4.4rem;
    margin: 0 auto;
    place-items: center;
    border: 1px solid rgb(255 255 255 / 0.45);
    border-radius: 1.3rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
    box-shadow: 5px 5px 0 rgb(255 255 255 / 0.13);
    transform: rotate(-3deg);
  }
  .complete-kicker {
    margin: 1rem 0 0;
    color: var(--color-acid-500);
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 850;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }
  .complete-content h1 {
    margin: 0.4rem auto 0;
    font-size: clamp(2rem, 8vw, 4rem);
    font-weight: 920;
    letter-spacing: -0.04em;
    line-height: 0.9;
    text-wrap: balance;
  }
  .complete-lead {
    max-width: 35rem;
    margin: 0.75rem auto 0;
    color: rgb(255 255 255 / 0.58);
    font-size: 0.78rem;
    line-height: 1.55;
  }
  .personal-best {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0.9rem auto 0;
    border: 1px solid var(--color-acid-500);
    border-radius: 999px;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
    padding: 0.42rem 0.65rem;
    font-family: var(--font-mono);
    font-size: 0.56rem;
    font-weight: 850;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .star-row {
    display: flex;
    justify-content: center;
    gap: 0.45rem;
    margin-top: 1rem;
  }
  .star-row span {
    display: grid;
    width: 2.8rem;
    height: 2.8rem;
    place-items: center;
    border: 1px solid rgb(255 255 255 / 0.15);
    border-radius: 0.8rem;
    color: rgb(255 255 255 / 0.22);
    background: rgb(255 255 255 / 0.04);
    transform: scale(0.95);
  }
  .star-row span.earned {
    color: var(--color-orange-500);
    background: rgb(233 154 49 / 0.1);
    transform: scale(1);
  }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .summary-grid article {
    display: grid;
    gap: 0.25rem;
    border: 1px solid rgb(255 255 255 / 0.12);
    border-radius: 0.85rem;
    background: rgb(255 255 255 / 0.05);
    padding: 0.75rem 0.35rem;
  }
  .summary-grid strong {
    color: var(--color-acid-500);
    font-family: var(--font-mono);
    font-size: 1.15rem;
  }
  .summary-grid span {
    color: rgb(255 255 255 / 0.48);
    font-size: 0.52rem;
    line-height: 1.25;
  }
  .takeaway {
    margin-top: 0.7rem;
    border: 1px solid rgb(255 255 255 / 0.16);
    border-radius: 1rem;
    background: rgb(255 255 255 / 0.055);
    padding: 0.85rem;
    text-align: left;
  }
  .takeaway p {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin: 0;
    color: var(--color-acid-500);
    font-family: var(--font-mono);
    font-size: 0.53rem;
    font-weight: 800;
    text-transform: uppercase;
  }
  .takeaway strong {
    display: block;
    margin-top: 0.45rem;
    font-size: 0.9rem;
  }
  .takeaway span {
    display: block;
    margin-top: 0.35rem;
    color: rgb(255 255 255 / 0.54);
    font-size: 0.63rem;
    line-height: 1.45;
  }
  .complete-actions {
    display: grid;
    grid-template-columns: minmax(0, 0.65fr) minmax(0, 1.35fr);
    gap: 0.55rem;
    border-top: 1px solid rgb(255 255 255 / 0.12);
    background: rgb(21 25 28 / 0.94);
    padding: 0.7rem 0.85rem;
  }
  .complete-actions a {
    display: flex;
    min-height: 3rem;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border-radius: 0.78rem;
    padding: 0.65rem;
    font-size: 0.68rem;
    font-weight: 850;
    text-align: center;
  }
  .secondary-action {
    border: 1px solid rgb(255 255 255 / 0.2);
    color: white;
    background: rgb(255 255 255 / 0.06);
  }
  .primary-action {
    border: 1px solid var(--color-acid-500);
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }
  .complete-actions a:active {
    transform: scale(0.97);
  }

  @media (max-height: 650px) {
    .question-main {
      padding-block: 0.55rem;
    }
    .question-card {
      padding: 0.75rem;
    }
    .instruction {
      margin-top: 0.55rem;
    }
    .question-card h1 {
      font-size: clamp(1.2rem, 4.7vw, 1.7rem);
    }
    .choice-list {
      gap: 0.35rem;
      margin-top: 0.6rem;
    }
    .choice-list button {
      min-height: 2.75rem;
    }
    .feedback-copy p {
      -webkit-line-clamp: 1;
      line-clamp: 1;
    }
    .summary-grid article {
      padding-block: 0.5rem;
    }
    .complete-content {
      padding-top: 0.75rem;
    }
    .trophy-mark {
      width: 3.6rem;
      height: 3.6rem;
    }
  }

  @media (min-width: 640px) {
    .lesson-topbar,
    .question-header,
    .complete-header {
      padding-inline: 1.25rem;
    }
    .intro-content {
      padding: 2rem 1.5rem 3rem;
    }
    .example-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .intro-action,
    .answer-footer,
    .complete-actions {
      padding-inline: max(1.25rem, calc((100vw - 44rem) / 2));
    }
    .question-main {
      padding-inline: 1.5rem;
    }
    .answer-footer > button {
      min-width: 8.8rem;
    }
    .feedback-copy p {
      font-size: 0.75rem;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .close-button:hover {
      background: var(--color-acid-100);
    }
    .choice-list button:hover:not(:disabled):not(.selected) {
      border-color: var(--color-ink-950);
      background: var(--color-paper-100);
      transform: translateY(-1px);
      box-shadow: 0 3px 0 rgb(21 25 28 / 0.16);
    }
    .order-answer button:hover:not(:disabled),
    .token-bank button:hover:not(:disabled) {
      transform: translateY(-1px);
    }
  }
</style>
