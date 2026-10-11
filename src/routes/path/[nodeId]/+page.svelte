<script lang="ts">
  import { page } from '$app/state';
  import CourseAnswerList from '$lib/components/course/CourseAnswerList.svelte';
  import CourseDictation from '$lib/components/course/CourseDictation.svelte';
  import CourseInformationGap from '$lib/components/course/CourseInformationGap.svelte';
  import CourseListening from '$lib/components/course/CourseListening.svelte';
  import CourseQuestionContext from '$lib/components/course/CourseQuestionContext.svelte';
  import CourseRecallAnswer from '$lib/components/course/CourseRecallAnswer.svelte';
  import CourseWriting from '$lib/components/course/CourseWriting.svelte';
  import { pathButton } from '$lib/components/course/path-styles.ts';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { gradeCourseDictation } from '$lib/domain/course/dictation.ts';
  import {
    coursePathQuestionsForNode,
    gradeCourseRecall,
  } from '$lib/domain/course/path-activities.ts';
  import { coursePathNodeHref } from '$lib/domain/course/path-presentation.ts';
  import {
    chapterForPathNode,
    coursePathNodeById,
    coursePathNodeState,
  } from '$lib/domain/course/path.ts';
  import { localized } from '$lib/i18n';
  import { courseChapterCopy, courseNodeCopy, loadCourseCopyCatalog } from '$lib/i18n/course.ts';
  import { courseWordMeaning } from '$lib/i18n/vocabulary.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import FlaskConical from '@lucide/svelte/icons/flask-conical';
  import Headphones from '@lucide/svelte/icons/headphones';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import MessageSquareText from '@lucide/svelte/icons/message-square-text';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Star from '@lucide/svelte/icons/star';
  import Trophy from '@lucide/svelte/icons/trophy';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import { onMount, tick } from 'svelte';

  import type { CoursePathNodeType } from '$lib/domain/course/path.ts';

  let initialized = false;
  let starting = false;
  let saving = false;
  let completed = false;
  let currentIndex = 0;
  let selectedAnswer = '';
  let feedback: 'correct' | 'wrong' | undefined;
  let firstTryCorrect = 0;
  let attempted = new Set<number>();
  let sentence = '';
  let errorMessage = '';
  let successMessage = '';
  let xpAwarded = 0;
  let stars: 1 | 2 | 3 = 1;
  let unlockedReading = false;
  let dictationWithoutAudio = false;
  let questionCard: HTMLElement | undefined;
  let feedbackButton: HTMLButtonElement | undefined;

  $: node = coursePathNodeById(page.params.nodeId ?? '');
  $: chapter = node ? chapterForPathNode(node.id) : undefined;
  $: level = $appStore.settings?.grammarLevel ?? 'A1.1';
  $: state = node ? coursePathNodeState($appStore.course, node, level) : 'locked';
  $: word = chapter?.words[currentIndex];
  $: activityQuestions =
    chapter && node ? coursePathQuestionsForNode(chapter, node.type, $motherTongue) : [];
  $: question = activityQuestions[currentIndex];
  $: nodeCopy = node ? courseNodeCopy($motherTongue, node, chapter) : undefined;
  $: chapterCopy = chapter ? courseChapterCopy($motherTongue, chapter) : undefined;
  $: progressMax =
    node?.type === 'sentence'
      ? 1
      : node?.type === 'vocabulary'
        ? (chapter?.words.length ?? 1)
        : activityQuestions.length || 1;
  $: progressValue = completed
    ? progressMax
    : node?.type === 'sentence'
      ? sentence.trim().length > 0
        ? 0.5
        : 0
      : currentIndex;

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  onMount(() => {
    let cancelled = false;
    void (async () => {
      await appStore.initialize();
      if (cancelled) return;
      if ($motherTongue === 'en') await loadCourseCopyCatalog();
      if (cancelled) return;
      initialized = true;
      if (node?.type === 'sentence')
        sentence =
          $appStore.course.pathNodes[node.id]?.writingDraft?.text ??
          $appStore.course.pathNodes[node.id]?.writtenResponse ??
          '';
      if (!node || state === 'locked' || node.type === 'reading') return;
      if (node.type === 'grammar' || node.type === 'coach') return;
      starting = true;
      try {
        await appStore.startPathNode(node.id);
      } catch (error) {
        errorMessage =
          error instanceof Error
            ? error.message
            : copy('Kurzový krok se nepodařilo otevřít.', 'The course step could not be opened.');
      } finally {
        starting = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  });

  function activityLabel(type: CoursePathNodeType): string {
    const labels: Record<CoursePathNodeType, { cs: string; en: string }> = {
      vocabulary: { cs: 'Nová slovíčka', en: 'New vocabulary' },
      practice: { cs: 'Od významu k němčině', en: 'From meaning to German' },
      mix: { cs: 'Poslech a věty', en: 'Listening and sentences' },
      sentence: { cs: 'Psaní', en: 'Writing' },
      checkpoint: { cs: 'Ověření kapitoly', en: 'Chapter test' },
      grammar: { cs: 'Gramatika', en: 'Grammar' },
      coach: { cs: 'Rozhovor', en: 'Conversation' },
      reading: { cs: 'Bonusová četba', en: 'Optional reading' },
    };
    return localized($motherTongue, labels[type]);
  }

  function chooseAnswer(answer: string): void {
    if (!question || feedback || saving) return;
    selectedAnswer = answer;
    recordQuestionAttempt(answer === question.answer);
  }

  function recordQuestionAttempt(correct: boolean): void {
    const wasAttempted = attempted.has(currentIndex);
    attempted = new Set([...attempted, currentIndex]);
    if (correct && !wasAttempted) firstTryCorrect += 1;
    feedback = correct ? 'correct' : 'wrong';
    void tick().then(() => feedbackButton?.focus());
  }

  function submitDictation(answer: string): void {
    if (!question || question.kind !== 'dictation' || feedback || saving) return;
    selectedAnswer = answer;
    recordQuestionAttempt(gradeCourseDictation(answer, question.answer).correct);
  }

  function retryQuestion(): void {
    selectedAnswer = '';
    feedback = undefined;
    void tick().then(() => (questionCard?.querySelector('input') ?? questionCard)?.focus());
  }

  async function nextQuestion(): Promise<void> {
    if (!chapter || feedback !== 'correct') return;
    if (currentIndex + 1 < activityQuestions.length) {
      currentIndex += 1;
      selectedAnswer = '';
      feedback = undefined;
      void tick().then(() => questionCard?.focus());
      return;
    }
    stars =
      firstTryCorrect === activityQuestions.length
        ? 3
        : firstTryCorrect >= activityQuestions.length - 1
          ? 2
          : 1;
    await finishStandardNode(stars);
  }

  function revealNextWord(): void {
    if (!chapter) return;
    if (currentIndex + 1 < chapter.words.length) {
      currentIndex += 1;
      return;
    }
    void finishVocabularyNode();
  }

  async function finishVocabularyNode(): Promise<void> {
    if (!node || saving) return;
    saving = true;
    errorMessage = '';
    try {
      const result = await appStore.completeVocabularyPathNode({ nodeId: node.id, stars: 2 });
      completed = true;
      stars = result.completion.stars || 2;
      xpAwarded = result.completion.xpAwarded;
      successMessage =
        $motherTongue === 'en'
          ? 'The chapter vocabulary has been added to your regular reviews.'
          : result.vocabulary.message;
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : copy(
              'Slova se nepodařilo uložit. Průchod lekcí zůstal zachovaný.',
              'The words could not be saved. Your lesson progress is still safe.',
            );
    } finally {
      saving = false;
    }
  }

  async function finishStandardNode(resultStars: 1 | 2 | 3): Promise<void> {
    if (!node || saving) return;
    saving = true;
    errorMessage = '';
    try {
      const result = await appStore.completePathNode({
        nodeId: node.id,
        stars: resultStars,
        ...(node.type === 'sentence' ? { writtenResponse: sentence } : {}),
      });
      completed = true;
      stars = result.stars || resultStars;
      xpAwarded = result.xpAwarded;
      unlockedReading = Boolean(result.unlockedStoryBookId);
      successMessage = completionCopy(
        node.type,
        result.firstCompletion,
        result.starsImproved,
        result.stars,
      );
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : copy('Výsledek se nepodařilo uložit.', 'The result could not be saved.');
    } finally {
      saving = false;
    }
  }

  function completionCopy(
    type: CoursePathNodeType,
    first: boolean,
    improved: boolean,
    resultStars: number,
  ): string {
    if (!first && improved) {
      return copy(
        `Nejlepší výsledek je nově ${bestStarLabel(resultStars)}. Další XP se za opakování nepřidávají.`,
        `Your new best is ${resultStars} of 3 stars. Repeats do not award additional XP.`,
      );
    }
    if (!first) {
      return copy(
        `Při opakování jsi získala ${earnedStarLabel(resultStars)}. Nejlepší výsledek zůstává stejný a další XP se nepřidávají.`,
        `You earned ${resultStars} of 3 stars on this repeat. Your best stays unchanged and no additional XP is awarded.`,
      );
    }
    if (type === 'checkpoint')
      return copy(
        `Test kapitoly máš dokončený na ${earnedStarLabel(resultStars)}.`,
        `You completed the chapter test with ${resultStars} of 3 stars.`,
      );
    if (type === 'sentence')
      return copy(
        'Text je uložený. Kdykoli ho znovu otevřeš v tomto kroku.',
        'Your text is saved. Reopen this step to read it again.',
      );
    if (type === 'mix')
      return copy(
        `Poslech a věty máš hotové na ${earnedStarLabel(resultStars)}.`,
        `You completed listening and sentences with ${resultStars} of 3 stars.`,
      );
    const count = activityQuestions.length || chapter?.words.length || 0;
    return copy(
      `Správně jsi dokončila ${count} krátkých úloh.`,
      `You completed ${count} short activities correctly.`,
    );
  }

  function earnedStarLabel(value: number): string {
    return value === 1 ? '1 hvězdu' : `${value} hvězdy`;
  }

  function bestStarLabel(value: number): string {
    return value === 1 ? '1 hvězda' : `${value} hvězdy`;
  }

  function resetActivity(): void {
    currentIndex = 0;
    selectedAnswer = '';
    feedback = undefined;
    firstTryCorrect = 0;
    attempted = new Set<number>();
    sentence = '';
    completed = false;
    successMessage = '';
    errorMessage = '';
    xpAwarded = 0;
  }

  function speak(value: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = 'de-DE';
    window.speechSynthesis.speak(utterance);
  }

  const sheet =
    'relative rounded-[0.35rem_1.5rem_0.35rem_0.35rem] border border-ink-950 bg-paper-50 p-[clamp(1.25rem,5vw,2.4rem)] shadow-[6px_6px_0_var(--color-ink-950)]';
  const iconTile =
    'grid size-[3.25rem] place-items-center rounded-[0.3rem_1rem_0.3rem_0.3rem] border border-ink-950 bg-acid-100 shadow-[3px_3px_0_var(--color-ink-950)]';
  const pageTitle =
    'mt-[0.35rem] text-[clamp(1.8rem,7vw,3.5rem)] leading-[0.95] font-[930] tracking-[-0.04em] text-balance';
  const primary = `${pathButton} bg-acid-500 text-ink-950`;
  const secondary = `${pathButton} bg-white`;
  const centered = 'grid min-h-dvh place-items-center p-5';
  const notice =
    'w-[min(100%,34rem)] rounded-[0.35rem_1.4rem_0.35rem_0.35rem] border border-ink-950 bg-paper-50 p-[clamp(1.4rem,5vw,2.5rem)] shadow-[6px_6px_0_var(--color-ink-950)]';
  const noticeTitle =
    'mt-[0.45rem] text-[clamp(2rem,8vw,3.4rem)] leading-[0.96] font-[920] tracking-[-0.04em]';
  const noticeText = 'mt-4 mb-[1.35rem] leading-[1.55] text-ink-600';
  const badge =
    'mt-4 items-center gap-[0.45rem] border border-ink-950 px-3 py-[0.55rem] font-mono text-[0.68rem] font-[850]';
</script>

<svelte:head>
  <title
    >{nodeCopy?.title ?? localized($motherTongue, { cs: 'Kurzový krok', en: 'Course step' })} · Fritz</title
  >
  <meta
    name="description"
    content={copy(
      'Procvič si němčinu v krátké lekci kurzu Fritz.',
      'Practise German in a short Fritz lesson.',
    )}
  />
</svelte:head>

{#if !initialized || !$appStore.ready}
  <div class={centered}>
    <LoadingState label={copy('Připravuji další krok…', 'Preparing the next step…')} />
  </div>
{:else if !node || !chapter}
  <main class={centered}>
    <div class={notice}>
      <p class="kicker">{copy('Průběh kurzu', 'Course path')}</p>
      <h1 class={noticeTitle}>
        {copy('Tento krok už v kurzu není.', 'This step is no longer in the course.')}
      </h1>
      <a class="{primary} mt-4" href="/"
        ><ArrowLeft size={18} /> {copy('Zpět na dnešek', 'Back to today')}</a
      >
    </div>
  </main>
{:else if state === 'locked'}
  <main class={centered}>
    <div class={notice}>
      <span
        class="grid size-14 place-items-center rounded-[0.3rem_1rem_0.3rem_0.3rem] border border-ink-950 bg-butter-50 shadow-[3px_3px_0_var(--color-ink-950)]"
        ><LockKeyhole size={28} /></span
      >
      <p class="kicker">{copy('Zamčený krok', 'Locked step')}</p>
      <h1 class={noticeTitle}>{nodeCopy?.title}</h1>
      <p class={noticeText}>
        {copy(
          'Nejdřív dokonči předchozí krok kurzu. Dosavadní výsledky máš uložené.',
          'Finish the previous course step first. Your earlier results are saved.',
        )}
      </p>
      <a class={primary} href="/"
        ><ArrowLeft size={18} /> {copy('Zpět na cestu', 'Back to the path')}</a
      >
    </div>
  </main>
{:else if node.type === 'grammar' || node.type === 'coach' || node.type === 'reading'}
  <main class={centered}>
    <div class={notice}>
      <p class="kicker">{activityLabel(node.type)}</p>
      <h1 class={noticeTitle}>{nodeCopy?.title}</h1>
      <p class={noticeText}>
        {copy('Pokračuj do příslušné lekce.', 'Continue to the lesson.')}
      </p>
      <a class={primary} href={coursePathNodeHref(node)}
        >{copy('Otevřít aktivitu', 'Open activity')} <ArrowRight size={18} /></a
      >
    </div>
  </main>
{:else}
  <div
    class="grid min-h-dvh grid-rows-[auto_minmax(0,1fr)] bg-paper-100 bg-[linear-gradient(rgb(21_25_28/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(21_25_28/0.035)_1px,transparent_1px)] bg-size-[24px_24px]"
  >
    <header
      class="sticky top-0 z-10 grid min-h-[calc(4.1rem+var(--safe-top))] grid-cols-[auto_minmax(0,1fr)_minmax(6rem,10rem)] items-center gap-[0.65rem] border-b border-ink-950 bg-paper-50 px-3 pt-[calc(0.55rem+var(--safe-top))] pb-[0.55rem]"
    >
      <a
        href="/"
        class="grid size-11 place-items-center rounded-[0.3rem_0.85rem_0.3rem_0.3rem] border border-ink-950 bg-white shadow-[2px_2px_0_var(--color-ink-950)]"
        aria-label={copy('Pozastavit a vrátit se na cestu', 'Pause and return to the path')}
        ><ArrowLeft size={20} /></a
      >
      <div class="min-w-0 [&>*]:block [&>*]:truncate">
        <span
          class="font-mono text-[0.55rem] font-[850] tracking-[0.05em] text-cobalt-700 uppercase"
          >{copy('Kapitola', 'Chapter')}
          {String(chapter.number).padStart(2, '0')} ·
          {chapter.level}</span
        >
        <strong class="mt-[0.12rem] text-[0.84rem] font-[880]">{activityLabel(node.type)}</strong>
      </div>
      <div class="grid gap-[0.3rem]">
        <span class="justify-self-end font-mono text-[0.6rem] font-[850]"
          >{Math.min(progressMax, Math.ceil(progressValue))}/{progressMax}</span
        >
        <div
          class="h-2 overflow-hidden border border-ink-950 bg-paper-200"
          role="progressbar"
          aria-label={copy('Postup aktivitou', 'Activity progress')}
          aria-valuemin="0"
          aria-valuemax={progressMax}
          aria-valuenow={progressValue}
        >
          <i
            class="block h-full w-full origin-left bg-acid-500 [transition:transform_220ms_var(--ease-out-emil)] motion-reduce:transition-none"
            style:transform={`scaleX(${progressValue / Math.max(1, progressMax)})`}
          ></i>
        </div>
      </div>
    </header>

    {#if completed}
      <main
        class="grid min-h-0 place-items-center overflow-y-auto px-[0.85rem] pt-4 pb-[calc(1.5rem+var(--safe-bottom))]"
        aria-live="polite"
      >
        <section class="{sheet} completion-arrival w-[min(100%,46rem)] text-center">
          <span class="{iconTile} mx-auto mb-[1.2rem]"><Trophy size={31} /></span>
          <p class="kicker">{copy('Krok dokončen', 'Step complete')}</p>
          <h1 class={pageTitle}>{nodeCopy?.title}</h1>
          <p class="mx-auto mt-[0.9rem] max-w-[34rem] leading-[1.55] text-ink-600">
            {successMessage}
          </p>
          <div
            class="mt-5 flex justify-center gap-[0.35rem]"
            aria-label={copy(`${stars} ze 3 hvězd`, `${stars} of 3 stars`)}
          >
            {#each [1, 2, 3] as star}
              <Star
                class={star <= stars ? 'text-orange-500' : 'text-line'}
                size={28}
                fill={star <= stars ? 'currentColor' : 'none'}
              />
            {/each}
          </div>
          <div class="{badge} inline-flex bg-acid-100">
            <Sparkles size={18} />
            {xpAwarded > 0
              ? `+${xpAwarded} XP`
              : copy('XP už byla připsána dříve', 'XP was already awarded earlier')}
          </div>
          {#if unlockedReading}<p class="{badge} mx-auto flex w-fit bg-mint-50">
              <BookOpen size={17} />
              {copy(
                'Odemkla se bonusová četba této kapitoly.',
                'Optional reading for this chapter is now unlocked.',
              )}
            </p>{/if}
          <div class="mt-6 grid gap-[0.65rem] min-[700px]:grid-cols-2">
            <a class={primary} href="/"
              >{copy('Pokračovat po cestě', 'Continue on the path')} <ArrowRight size={18} /></a
            >
            <button class={secondary} type="button" onclick={resetActivity}
              ><RotateCcw size={17} />
              {copy('Zopakovat bez dalších XP', 'Repeat without additional XP')}</button
            >
          </div>
        </section>
      </main>
    {:else}
      <main
        class="grid min-h-0 place-items-center overflow-y-auto px-[0.85rem] pt-4 pb-[calc(1.5rem+var(--safe-bottom))]"
      >
        <section class="w-[min(100%,46rem)]">
          <div class="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-[0.8rem]">
            <span class={iconTile}>
              {#if node.type === 'vocabulary'}<BookOpen
                  size={24}
                />{:else if node.type === 'mix'}<Headphones
                  size={24}
                />{:else if node.type === 'sentence'}<MessageSquareText
                  size={24}
                />{:else if node.type === 'checkpoint'}<Trophy size={24} />{:else}<FlaskConical
                  size={24}
                />{/if}
            </span>
            <div>
              <p class="kicker">{activityLabel(node.type)} · {node.minutes} min</p>
              <h1 class={pageTitle}>{nodeCopy?.title}</h1>
              <p class="mt-[0.65rem] leading-normal text-ink-600">{nodeCopy?.description}</p>
            </div>
          </div>

          {#if node.type === 'vocabulary' && word}
            <article class="{sheet} mt-5" data-testid="path-word-card">
              <div class="font-mono text-[0.65rem] font-[850] text-cobalt-700">
                {String(currentIndex + 1).padStart(2, '0')} / {chapter.words.length}
              </div>
              <button
                type="button"
                class="absolute top-[0.9rem] right-[0.9rem] grid size-11 place-items-center rounded-full border border-ink-950 bg-acid-100"
                onclick={() => speak(word.german)}
                aria-label={copy('Přehrát výslovnost', 'Play pronunciation')}
              >
                <Volume2 size={20} />
              </button>
              <p
                class="mt-8 font-mono text-[0.58rem] font-[820] tracking-[0.05em] text-ink-600 uppercase"
              >
                {word.kind === 'noun'
                  ? copy('podstatné jméno', 'noun')
                  : word.kind === 'verb'
                    ? copy('sloveso', 'verb')
                    : copy('výraz', 'expression')}
              </p>
              <h2
                class="mt-[0.3rem] text-[clamp(2.2rem,11vw,4.5rem)] leading-[0.95] font-black tracking-[-0.04em]"
                lang="de"
              >
                {word.article ? `${word.article} ` : ''}{word.german}
              </h2>
              {#if word.plural === '—'}<p class="mt-[0.4rem] text-[0.8rem] text-ink-600">
                  {copy(
                    'V tomto významu běžně bez množného čísla.',
                    'Normally used without a plural in this sense.',
                  )}
                </p>
              {:else if word.plural}<p class="mt-[0.4rem] text-[0.8rem] text-ink-600" lang="de">
                  {copy('množné číslo', 'plural')}: {word.plural}
                </p>{/if}
              <strong class="mt-[1.15rem] block text-[1.2rem]"
                >{courseWordMeaning(word, $motherTongue)}</strong
              >
              {#if word.exampleDe}
                <blockquote
                  class="mt-[1.3rem] grid gap-1 border border-cobalt-700 bg-sky-50 px-4 py-[0.85rem]"
                >
                  <span class="font-[760]" lang="de">{word.exampleDe}</span
                  >{#if $motherTongue === 'cs'}<small class="text-ink-600">{word.exampleCs}</small
                    >{/if}
                </blockquote>
              {/if}
            </article>
            <button
              class="{primary} mt-[1.15rem] w-full"
              type="button"
              disabled={saving || starting}
              onclick={revealNextWord}
            >
              {saving
                ? copy('Ukládám slova…', 'Saving words…')
                : currentIndex + 1 === chapter.words.length
                  ? copy('Přidat do dlouhodobého učení', 'Add to long-term review')
                  : copy('Další slovo', 'Next word')}
              <ArrowRight size={18} />
            </button>
          {:else if (node.type === 'practice' || node.type === 'mix' || node.type === 'checkpoint') && question}
            <section
              bind:this={questionCard}
              tabindex="-1"
              class={[
                sheet,
                'mt-5',
                question.kind === 'error' &&
                  'bg-[linear-gradient(135deg,var(--color-coral-50)_0_0.55rem,transparent_0.55rem)] bg-size-[2.2rem_2.2rem] bg-top-right bg-no-repeat',
              ]}
              data-testid="question-card"
            >
              <p
                class="font-mono text-[0.62rem] font-[850] tracking-[0.05em] text-cobalt-700 uppercase"
              >
                {question.kind === 'dictation' && dictationWithoutAudio
                  ? copy(
                      'Vyber správnou větu bez poslechu.',
                      'Choose the correct sentence without audio.',
                    )
                  : question.instruction}
              </p>
              <CourseQuestionContext {question} />
              {#if question.kind === 'listening'}
                {#key question.id}<CourseListening {question} {feedback} {saving} />{/key}
              {/if}
              {#if question.kind === 'dictation'}
                {#key question.id}
                  <CourseDictation
                    {question}
                    {feedback}
                    {saving}
                    selected={selectedAnswer}
                    showKeyboard={$appStore.settings?.showKeyboardHints !== false}
                    onchoose={chooseAnswer}
                    onsubmit={submitDictation}
                    bind:textAlternative={dictationWithoutAudio}
                  />
                {/key}
              {:else if question.interaction}
                {#key question.id}
                  <CourseInformationGap
                    gap={question.interaction}
                    options={question.options}
                    {feedback}
                    {saving}
                    onanswer={chooseAnswer}
                  />
                {/key}
              {:else}
                {#if question.kind === 'error'}
                  <div
                    class="mt-[0.85rem] inline-flex min-h-[2.1rem] items-center gap-2 border border-coral-700 bg-coral-50 py-[0.3rem] pr-[0.65rem] pl-[0.35rem] text-[0.68rem] tracking-[0.04em] text-coral-700 uppercase"
                  >
                    <span
                      class="grid size-[1.35rem] place-items-center rounded-full bg-coral-700 font-mono font-black text-white"
                      aria-hidden="true">!</span
                    >
                    <strong>{copy('Doplň opravený úsek', 'Complete the repaired section')}</strong>
                  </div>
                {/if}
                <h2
                  class={[
                    'mt-2 font-black tracking-[-0.04em]',
                    question.kind === 'situation'
                      ? 'text-[1.15rem] leading-[1.45]'
                      : question.kind === 'error'
                        ? 'text-[clamp(1.45rem,7vw,2.5rem)] leading-[1.08]'
                        : 'text-[clamp(1.75rem,8vw,3rem)]',
                  ]}
                  lang={question.promptLang}
                >
                  {question.prompt}
                </h2>
                {#if question.response === 'recall'}
                  {#key question.id}
                    <CourseRecallAnswer
                      {feedback}
                      {saving}
                      gapOnly={question.kind === 'error' || question.kind === 'cloze'}
                      onanswer={(answer) => {
                        selectedAnswer = answer;
                        recordQuestionAttempt(gradeCourseRecall(question, answer));
                      }}
                    />
                  {/key}
                {:else}
                  <CourseAnswerList
                    options={question.options}
                    answer={question.answer}
                    selected={selectedAnswer}
                    {feedback}
                    {saving}
                    lang={question.answerLang}
                    sentences={question.kind === 'sentence' ||
                      question.kind === 'situation' ||
                      question.kind === 'listening'}
                    onchoose={chooseAnswer}
                  />
                {/if}
              {/if}
            </section>
            {#if feedback}
              <div
                id="course-question-feedback"
                class={[
                  'mt-4 rounded-[0.3rem_1rem_0.3rem_0.3rem] border p-4',
                  feedback === 'correct'
                    ? 'border-mint-700 bg-mint-50'
                    : 'border-coral-700 bg-coral-50',
                ]}
                aria-live="polite"
              >
                <strong class="text-[1rem]"
                  >{feedback === 'correct'
                    ? copy('Správně.', 'Correct.')
                    : copy('Ještě ne.', 'Not yet.')}</strong
                >
                <p class="mt-1 text-[0.78rem] text-ink-600">
                  {feedback === 'correct'
                    ? question.explanation
                    : copy(
                        `Správná odpověď je „${question.answer}“. ${question.explanation}`,
                        `The correct answer is “${question.answer}”. ${question.explanation}`,
                      )}
                </p>
                <button
                  class="{secondary} mt-[0.85rem] w-full"
                  bind:this={feedbackButton}
                  type="button"
                  onclick={feedback === 'correct' ? () => void nextQuestion() : retryQuestion}
                >
                  {feedback === 'correct'
                    ? currentIndex + 1 === activityQuestions.length
                      ? copy('Dokončit', 'Finish')
                      : copy('Další', 'Next')
                    : copy('Zkusit znovu', 'Try again')}
                  <ArrowRight size={18} />
                </button>
              </div>
            {/if}
          {:else if node.type === 'sentence'}
            <CourseWriting
              {chapter}
              bind:value={sentence}
              {saving}
              onsave={() => finishStandardNode(2)}
            />
          {/if}

          {#if errorMessage}<p
              class="mt-4 border border-coral-700 bg-coral-50 p-3 text-[0.78rem] font-[760] text-coral-700"
              role="alert"
            >
              {errorMessage}
            </p>{/if}
          <p class="mt-[0.6rem] text-[0.7rem] leading-[1.45] text-ink-600" aria-live="polite">
            {starting
              ? copy('Ukládám rozpracovaný krok…', 'Saving your in-progress step…')
              : copy(
                  'Postup se ukládá offline do tohoto zařízení.',
                  'Progress is stored offline on this device.',
                )}
          </p>
        </section>
      </main>
    {/if}
  </div>
{/if}
