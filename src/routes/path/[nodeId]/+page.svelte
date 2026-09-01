<script lang="ts">
  import { page } from '$app/state';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import { gradeCourseDictation } from '$lib/domain/course/dictation.ts';
  import {
    coursePathQuestionsForNode,
    courseWordLabel,
    sentenceUsesCourseWord,
  } from '$lib/domain/course/path-activities.ts';
  import { coursePathNodeHref } from '$lib/domain/course/path-presentation.ts';
  import {
    chapterForPathNode,
    coursePathNodeById,
    coursePathNodeState,
  } from '$lib/domain/course/path.ts';
  import { normalizeText } from '$lib/domain/grading/normalize.ts';
  import { localized } from '$lib/i18n';
  import { courseChapterCopy, courseNodeCopy, loadCourseCopyCatalog } from '$lib/i18n/course.ts';
  import { courseWordMeaning } from '$lib/i18n/vocabulary.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Check from '@lucide/svelte/icons/check';
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
  let dictationAnswer = '';
  let dictationFallback = false;
  let dictationPlaying = false;
  let speechSupported = false;
  let dictationInput: HTMLInputElement | undefined;
  let dictationUtterance: SpeechSynthesisUtterance | undefined;

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
    speechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    void (async () => {
      await appStore.initialize();
      if (cancelled) return;
      if ($motherTongue === 'en') await loadCourseCopyCatalog();
      if (cancelled) return;
      initialized = true;
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
      stopDictation();
    };
  });

  function activityLabel(type: CoursePathNodeType): string {
    const labels: Record<CoursePathNodeType, { cs: string; en: string }> = {
      vocabulary: { cs: 'Nová slovíčka', en: 'New vocabulary' },
      practice: { cs: 'Význam bez nápovědy', en: 'Recall without hints' },
      mix: { cs: 'Poslech a věty', en: 'Listening and sentences' },
      sentence: { cs: 'Vlastní výstup', en: 'Your own output' },
      checkpoint: { cs: 'Ověření kapitoly', en: 'Chapter checkpoint' },
      grammar: { cs: 'Gramatika', en: 'Grammar' },
      coach: { cs: 'Řízená situace', en: 'Guided scenario' },
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
  }

  function submitDictation(): void {
    if (!question || question.kind !== 'dictation' || !dictationAnswer.trim() || feedback || saving)
      return;
    selectedAnswer = dictationAnswer;
    recordQuestionAttempt(gradeCourseDictation(dictationAnswer, question.answer).correct);
  }

  function retryQuestion(): void {
    selectedAnswer = '';
    dictationAnswer = '';
    feedback = undefined;
    if (question?.kind === 'dictation' && !dictationFallback) {
      void tick().then(() => dictationInput?.focus());
    }
  }

  async function nextQuestion(): Promise<void> {
    if (!chapter || feedback !== 'correct') return;
    if (currentIndex + 1 < activityQuestions.length) {
      currentIndex += 1;
      selectedAnswer = '';
      dictationAnswer = '';
      dictationFallback = false;
      stopDictation();
      feedback = undefined;
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
          ? 'The chapter vocabulary is now connected to your long-term review.'
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
      const result = await appStore.completePathNode({ nodeId: node.id, stars: resultStars });
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
        `Checkpoint jsi dokončila na ${earnedStarLabel(resultStars)}.`,
        `You completed the checkpoint with ${resultStars} of 3 stars.`,
      );
    if (type === 'sentence')
      return copy(
        'Použila jsi slovní zásobu kapitoly ve vlastní větě.',
        'You used the chapter vocabulary in an original sentence.',
      );
    if (type === 'mix')
      return copy(
        `Zachytila jsi mluvenou větu a propojila slovní zásobu s gramatikou na ${earnedStarLabel(resultStars)}.`,
        `You caught a spoken sentence and connected vocabulary with grammar for ${resultStars} of 3 stars.`,
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

  function sentenceIsReady(): boolean {
    if (!chapter) return false;
    const normalized = normalizeText(sentence);
    const words = normalized.split(/\s+/u).filter(Boolean);
    return words.length >= 4 && sentenceUsesCourseWord(sentence, chapter.words);
  }

  function submitSentence(): void {
    errorMessage = '';
    if (!sentenceIsReady()) {
      errorMessage = copy(
        'Napiš alespoň čtyři slova a použij jeden německý výraz z této kapitoly.',
        'Write at least four words and use one German expression from this chapter.',
      );
      return;
    }
    void finishStandardNode(2);
  }

  function resetActivity(): void {
    currentIndex = 0;
    selectedAnswer = '';
    feedback = undefined;
    firstTryCorrect = 0;
    attempted = new Set<number>();
    sentence = '';
    dictationAnswer = '';
    dictationFallback = false;
    stopDictation();
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

  function playDictation(rate = 1): void {
    if (!question || question.kind !== 'dictation') return;
    if (!speechSupported || !('speechSynthesis' in window)) {
      dictationFallback = true;
      return;
    }

    dictationUtterance = undefined;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(question.answer);
    utterance.lang = 'de-DE';
    utterance.rate = rate;
    dictationUtterance = utterance;
    dictationPlaying = true;
    utterance.addEventListener('end', () => {
      if (dictationUtterance !== utterance) return;
      dictationUtterance = undefined;
      dictationPlaying = false;
    });
    utterance.addEventListener('error', () => {
      if (dictationUtterance !== utterance) return;
      dictationUtterance = undefined;
      dictationPlaying = false;
      dictationFallback = true;
    });
    window.speechSynthesis.speak(utterance);
    void tick().then(() => dictationInput?.focus());
  }

  function stopDictation(): void {
    dictationUtterance = undefined;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    dictationPlaying = false;
  }

  function toggleDictationFallback(): void {
    if (feedback) return;
    dictationFallback = !dictationFallback;
    stopDictation();
    if (!dictationFallback) void tick().then(() => dictationInput?.focus());
  }

  async function insertDictationCharacter(character: string): Promise<void> {
    const start = dictationInput?.selectionStart ?? dictationAnswer.length;
    const end = dictationInput?.selectionEnd ?? start;
    dictationAnswer = `${dictationAnswer.slice(0, start)}${character}${dictationAnswer.slice(end)}`;
    await tick();
    dictationInput?.focus();
    dictationInput?.setSelectionRange(start + character.length, start + character.length);
  }
</script>

<svelte:head>
  <title
    >{nodeCopy?.title ?? localized($motherTongue, { cs: 'Kurzový krok', en: 'Course step' })} · Fritz</title
  >
  <meta
    name="description"
    content={copy(
      'Krátký uzel vedené učební cesty v aplikaci Fritz.',
      'A short guided step on the Fritz course path.',
    )}
  />
</svelte:head>

{#if !initialized || !$appStore.ready}
  <div class="path-loading">
    <LoadingState label={copy('Připravuji další krok…', 'Preparing the next step…')} />
  </div>
{:else if !node || !chapter}
  <main class="missing-path">
    <div>
      <p class="kicker">{copy('Kurzová cesta', 'Course path')}</p>
      <h1>{copy('Tento krok už v kurzu není.', 'This step is no longer in the course.')}</h1>
      <a class="primary-button" href="/"
        ><ArrowLeft size={18} /> {copy('Zpět na dnešek', 'Back to today')}</a
      >
    </div>
  </main>
{:else if state === 'locked'}
  <main class="locked-path">
    <div class="locked-sheet">
      <span><LockKeyhole size={28} /></span>
      <p class="kicker">{copy('Zamčený krok', 'Locked step')}</p>
      <h1>{nodeCopy?.title}</h1>
      <p>
        {copy(
          'Nejdřív dokonči předchozí krok cesty. Uložený historický progres zůstává zachovaný.',
          'Complete the previous step first. Your saved history remains unchanged.',
        )}
      </p>
      <a class="primary-button" href="/"
        ><ArrowLeft size={18} /> {copy('Zpět na cestu', 'Back to the path')}</a
      >
    </div>
  </main>
{:else if node.type === 'grammar' || node.type === 'coach' || node.type === 'reading'}
  <main class="missing-path">
    <div>
      <p class="kicker">{activityLabel(node.type)}</p>
      <h1>{nodeCopy?.title}</h1>
      <p>
        {copy(
          'Tento krok používá existující část aplikace Fritz, aby nevznikal paralelní obsah.',
          'This step opens the corresponding Fritz activity so your progress stays connected.',
        )}
      </p>
      <a class="primary-button" href={coursePathNodeHref(node)}
        >{copy('Otevřít aktivitu', 'Open activity')} <ArrowRight size={18} /></a
      >
    </div>
  </main>
{:else}
  <div class="path-shell">
    <header class="path-header">
      <a
        href="/"
        class="back-button"
        aria-label={copy('Pozastavit a vrátit se na cestu', 'Pause and return to the path')}
        ><ArrowLeft size={20} /></a
      >
      <div class="header-copy">
        <span
          >{copy('Kapitola', 'Chapter')}
          {String(chapter.number).padStart(2, '0')} ·
          {chapter.level}</span
        >
        <strong>{activityLabel(node.type)}</strong>
      </div>
      <div class="header-progress">
        <span>{Math.min(progressMax, Math.ceil(progressValue))}/{progressMax}</span>
        <div
          role="progressbar"
          aria-label={copy('Postup aktivitou', 'Activity progress')}
          aria-valuemin="0"
          aria-valuemax={progressMax}
          aria-valuenow={progressValue}
        >
          <i style={`--activity-progress:${progressValue / Math.max(1, progressMax)}`}></i>
        </div>
      </div>
    </header>

    {#if completed}
      <main class="completion-screen" aria-live="polite">
        <section class="completion-sheet completion-arrival">
          <span class="completion-icon"><Trophy size={31} /></span>
          <p class="kicker">{copy('Krok dokončen', 'Step complete')}</p>
          <h1>{nodeCopy?.title}</h1>
          <p class="completion-copy">{successMessage}</p>
          <div class="stars" aria-label={copy(`${stars} ze 3 hvězd`, `${stars} of 3 stars`)}>
            {#each [1, 2, 3] as star}
              <Star
                size={28}
                fill={star <= stars ? 'currentColor' : 'none'}
                class={star <= stars ? 'earned' : ''}
              />
            {/each}
          </div>
          <div class="reward-line">
            <Sparkles size={18} />
            {xpAwarded > 0
              ? `+${xpAwarded} XP`
              : copy('XP už byla připsána dříve', 'XP was already awarded earlier')}
          </div>
          {#if unlockedReading}<p class="unlock-note">
              <BookOpen size={17} />
              {copy(
                'Odemkla se bonusová četba této kapitoly.',
                'Optional reading for this chapter is now unlocked.',
              )}
            </p>{/if}
          <div class="completion-actions">
            <a class="primary-button" href="/"
              >{copy('Pokračovat po cestě', 'Continue on the path')} <ArrowRight size={18} /></a
            >
            <button class="secondary-button" type="button" onclick={resetActivity}
              ><RotateCcw size={17} />
              {copy('Zopakovat bez farmení XP', 'Repeat without additional XP')}</button
            >
          </div>
        </section>
      </main>
    {:else}
      <main class="activity-main">
        <section class="activity-sheet">
          <div class="activity-heading">
            <span class="activity-icon">
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
              <h1>{nodeCopy?.title}</h1>
              <p>{nodeCopy?.description}</p>
            </div>
          </div>

          {#if node.type === 'vocabulary' && word}
            <article class="word-card">
              <div class="word-index">
                {String(currentIndex + 1).padStart(2, '0')} / {chapter.words.length}
              </div>
              <button
                type="button"
                class="speak-button"
                onclick={() => speak(word.german)}
                aria-label={copy('Přehrát výslovnost', 'Play pronunciation')}
              >
                <Volume2 size={20} />
              </button>
              <p class="word-kind">
                {word.kind === 'noun'
                  ? copy('podstatné jméno', 'noun')
                  : word.kind === 'verb'
                    ? copy('sloveso', 'verb')
                    : copy('výraz', 'expression')}
              </p>
              <h2 lang="de">{word.article ? `${word.article} ` : ''}{word.german}</h2>
              {#if word.plural}<p class="plural" lang="de">
                  {copy('množné číslo', 'plural')}: {word.plural}
                </p>{/if}
              <strong>{courseWordMeaning(word, $motherTongue)}</strong>
              {#if word.exampleDe}
                <blockquote>
                  <span lang="de">{word.exampleDe}</span>{#if $motherTongue === 'cs'}<small
                      >{word.exampleCs}</small
                    >{/if}
                </blockquote>
              {/if}
            </article>
            <button
              class="primary-button full"
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
              class:correct={feedback === 'correct'}
              class:dictation-question={question.kind === 'dictation'}
              class:error-question={question.kind === 'error'}
              class:wrong={feedback === 'wrong'}
              class="question-card"
            >
              <p>
                {question.kind === 'dictation' && (dictationFallback || !speechSupported)
                  ? copy(
                      'Vyber správnou větu bez poslechu.',
                      'Choose the correct sentence without audio.',
                    )
                  : question.instruction}
              </p>
              {#if question.kind === 'dictation'}
                {#if dictationFallback || !speechSupported}
                  <div class="dictation-alternative" id="dictation-alternative">
                    <span>{copy('Textová alternativa', 'Text alternative')}</span>
                    <h2 lang={question.promptLang}>{question.prompt}</h2>
                    <p>
                      {speechSupported
                        ? copy(
                            'Vyber větu se stejným významem. Výsledek se počítá stejně.',
                            'Choose the grammatically correct sentence. It is scored the same way.',
                          )
                        : copy(
                            'Přehrávání zvuku tu není dostupné. Vyber správnou německou větu.',
                            'Audio playback is unavailable here. Choose the correct German sentence.',
                          )}
                    </p>
                    <div class="answer-list sentence-options">
                      {#each question.options as option, index}
                        <button
                          type="button"
                          class:selected={selectedAnswer === option}
                          class:answer-correct={Boolean(feedback) && option === question.answer}
                          class:answer-wrong={feedback === 'wrong' && selectedAnswer === option}
                          disabled={Boolean(feedback) || saving}
                          onclick={() => chooseAnswer(option)}
                        >
                          <span>{index + 1}</span><strong lang="de">{option}</strong>
                          {#if feedback && option === question.answer}<Check size={18} />{/if}
                        </button>
                      {/each}
                    </div>
                    {#if speechSupported && !feedback}
                      <button
                        class="alternative-toggle"
                        type="button"
                        aria-pressed="true"
                        onclick={toggleDictationFallback}
                      >
                        <Volume2 size={16} />
                        {copy('Zpět k poslechu', 'Return to listening')}
                      </button>
                    {/if}
                  </div>
                {:else}
                  <div
                    class:listening={dictationPlaying}
                    class="dictation-player"
                    role="status"
                    aria-live="polite"
                    aria-busy={dictationPlaying}
                  >
                    <div class="dictation-signal" aria-hidden="true">
                      <span></span><span></span><span></span><span></span><span></span>
                    </div>
                    <div>
                      <span>{copy('Poslechový diktát', 'Listening dictation')}</span>
                      <h2>
                        {dictationPlaying
                          ? copy('Věta právě zní…', 'The sentence is playing…')
                          : copy('Poslechni, potom napiš.', 'Listen, then type.')}
                      </h2>
                      <p>
                        {copy(
                          `${question.wordCount ?? 0} slov · interpunkci hodnotit nebudeme`,
                          `${question.wordCount ?? 0} words · punctuation is not graded`,
                        )}
                      </p>
                    </div>
                  </div>

                  <div class="dictation-controls">
                    <button
                      class="dictation-play"
                      type="button"
                      disabled={Boolean(feedback) || saving}
                      onclick={() => playDictation(1)}
                    >
                      <Volume2 size={20} />
                      {dictationPlaying
                        ? copy('Přehrávám…', 'Playing…')
                        : copy('Přehrát větu', 'Play sentence')}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(feedback) || saving}
                      onclick={() => playDictation(0.78)}
                    >
                      {copy('Pomaleji', 'Slower')}
                    </button>
                  </div>

                  <form
                    class="dictation-form"
                    onsubmit={(event) => {
                      event.preventDefault();
                      submitDictation();
                    }}
                  >
                    <label for="dictation-answer"
                      >{copy('Co jsi slyšela?', 'What did you hear?')}</label
                    >
                    <input
                      id="dictation-answer"
                      bind:this={dictationInput}
                      bind:value={dictationAnswer}
                      aria-describedby="dictation-help"
                      aria-invalid={feedback === 'wrong' ? 'true' : undefined}
                      disabled={Boolean(feedback) || saving}
                      autocomplete="off"
                      autocapitalize="sentences"
                      spellcheck="false"
                      enterkeyhint="done"
                      lang="de"
                      placeholder={copy(
                        'Napiš celou německou větu',
                        'Type the full German sentence',
                      )}
                    />
                    <p id="dictation-help">
                      {copy(
                        'Velká písmena a tečky nevadí. Pořadí a německá slova ano.',
                        'Capital letters and punctuation do not matter. Word choice and order do.',
                      )}
                    </p>
                    {#if $appStore.settings?.showKeyboardHints !== false && !feedback}
                      <GermanKeyboard oninsert={insertDictationCharacter} />
                    {/if}
                    {#if !feedback}
                      <button
                        class="primary-button full"
                        type="submit"
                        disabled={!dictationAnswer.trim() || saving}
                      >
                        {copy('Zkontrolovat přepis', 'Check transcript')}
                        <ArrowRight size={18} />
                      </button>
                    {/if}
                  </form>

                  {#if !feedback}
                    <button
                      class="alternative-toggle"
                      type="button"
                      aria-pressed="false"
                      onclick={toggleDictationFallback}
                    >
                      {copy('Teď nemůžu poslouchat', 'I cannot listen right now')}
                    </button>
                  {/if}
                {/if}
              {:else}
                {#if question.kind === 'error'}
                  <div class="error-clinic-mark">
                    <span aria-hidden="true">!</span>
                    <strong>{copy('Chybná věta', 'Sentence with an error')}</strong>
                  </div>
                {/if}
                <h2 lang={question.promptLang}>{question.prompt}</h2>
                <div class:sentence-options={question.kind === 'sentence'} class="answer-list">
                  {#each question.options as option, index}
                    <button
                      type="button"
                      class:selected={selectedAnswer === option}
                      class:answer-correct={Boolean(feedback) && option === question.answer}
                      class:answer-wrong={feedback === 'wrong' && selectedAnswer === option}
                      disabled={Boolean(feedback) || saving}
                      onclick={() => chooseAnswer(option)}
                    >
                      <span>{index + 1}</span><strong lang={question.answerLang}>{option}</strong>
                      {#if feedback && option === question.answer}<Check size={18} />{/if}
                    </button>
                  {/each}
                </div>
              {/if}
            </section>
            {#if feedback}
              <div class:positive={feedback === 'correct'} class="feedback" aria-live="polite">
                <strong
                  >{feedback === 'correct'
                    ? copy('Správně.', 'Correct.')
                    : copy('Ještě ne.', 'Not yet.')}</strong
                >
                <p>
                  {feedback === 'correct'
                    ? question.explanation
                    : copy(
                        `Správná odpověď je „${question.answer}“. ${question.explanation}`,
                        `The correct answer is “${question.answer}”. ${question.explanation}`,
                      )}
                </p>
                <button
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
            <section class="sentence-card">
              <p class="sentence-task">
                {$motherTongue === 'en'
                  ? `Write one original German sentence for “${chapterCopy?.title ?? 'this chapter'}”.`
                  : chapter.sentencePrompt}
              </p>
              <div class="sentence-pattern">
                <span>{copy('Větný vzorec', 'Sentence pattern')}</span>
                <strong lang="de">{chapter.grammarPattern}</strong>
              </div>
              <div
                class="word-bank"
                aria-label={copy('Slovní opora z kapitoly', 'Vocabulary support from the chapter')}
              >
                {#each chapter.words as candidate}
                  <span lang="de">{courseWordLabel(candidate)}</span>
                {/each}
              </div>
              <label for="course-sentence">{copy('Tvoje věta', 'Your sentence')}</label>
              <textarea
                id="course-sentence"
                bind:value={sentence}
                rows="5"
                lang="de"
                maxlength="280"
                placeholder={$motherTongue === 'en'
                  ? 'Write your German sentence…'
                  : chapter.sentenceStarter}></textarea>
              <div class="sentence-checklist">
                <strong>{copy('Než větu odešleš', 'Before you submit')}</strong>
                <ul>
                  {#each $motherTongue === 'en' ? ['Use at least four words.', 'Include one expression from this chapter.', 'Check the verb position and ending.'] : chapter.sentenceChecklist as item}<li
                    >
                      <Check size={14} />
                      {item}
                    </li>{/each}
                </ul>
              </div>
              <p class="sentence-help">
                {copy(
                  'Slovní opora je v základním tvaru; ve větě ji podle potřeby uprav. Kontrola délky a použitého výrazu funguje offline.',
                  'The word bank uses dictionary forms; adapt them as needed. Length and vocabulary checks work offline.',
                )}
              </p>
              <button
                class="primary-button full"
                type="button"
                disabled={saving}
                onclick={submitSentence}
              >
                {saving
                  ? copy('Ukládám větu…', 'Saving sentence…')
                  : copy('Dokončit aktivní použití', 'Complete active use')}
                <ArrowRight size={18} />
              </button>
            </section>
          {/if}

          {#if errorMessage}<p class="error-message" role="alert">{errorMessage}</p>{/if}
          <p class="save-note" aria-live="polite">
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

<style>
  .path-loading,
  .missing-path,
  .locked-path {
    display: grid;
    min-height: 100dvh;
    place-items: center;
    padding: 1.25rem;
  }
  .missing-path > div,
  .locked-sheet {
    width: min(100%, 34rem);
    border: 1px solid var(--color-ink-950);
    border-radius: 0.35rem 1.4rem 0.35rem 0.35rem;
    background: var(--color-paper-50);
    padding: clamp(1.4rem, 5vw, 2.5rem);
    box-shadow: 6px 6px 0 var(--color-ink-950);
  }
  .missing-path h1,
  .locked-sheet h1 {
    margin-top: 0.45rem;
    font-size: clamp(2rem, 8vw, 3.4rem);
    font-weight: 920;
    letter-spacing: -0.04em;
    line-height: 0.96;
  }
  .missing-path p:not(.kicker),
  .locked-sheet p:not(.kicker) {
    margin: 1rem 0 1.35rem;
    color: var(--color-ink-600);
    line-height: 1.55;
  }
  .locked-sheet > span {
    display: grid;
    width: 3.5rem;
    height: 3.5rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.3rem 1rem 0.3rem 0.3rem;
    background: var(--color-butter-50);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .path-shell {
    display: grid;
    min-height: 100dvh;
    grid-template-rows: auto minmax(0, 1fr);
    background-color: var(--color-paper-100);
    background-image:
      linear-gradient(rgb(21 25 28 / 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgb(21 25 28 / 0.035) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  .path-header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: grid;
    min-height: calc(4.1rem + var(--safe-top));
    grid-template-columns: auto minmax(0, 1fr) minmax(6rem, 10rem);
    align-items: center;
    gap: 0.65rem;
    border-bottom: 1px solid var(--color-ink-950);
    background: var(--color-paper-50);
    padding: calc(0.55rem + var(--safe-top)) 0.75rem 0.55rem;
  }
  .back-button {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.3rem 0.85rem 0.3rem 0.3rem;
    background: white;
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .header-copy {
    min-width: 0;
  }
  .header-copy span,
  .header-copy strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .header-copy span {
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.55rem;
    font-weight: 850;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .header-copy strong {
    margin-top: 0.12rem;
    font-size: 0.84rem;
    font-weight: 880;
  }
  .header-progress {
    display: grid;
    gap: 0.3rem;
  }
  .header-progress > span {
    justify-self: end;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 850;
  }
  .header-progress > div {
    height: 0.5rem;
    overflow: hidden;
    border: 1px solid var(--color-ink-950);
    background: var(--color-paper-200);
  }
  .header-progress i {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--color-acid-500);
    transform: scaleX(var(--activity-progress));
    transform-origin: left;
    transition: transform 220ms var(--ease-out-emil);
  }
  .activity-main,
  .completion-screen {
    display: grid;
    min-height: 0;
    place-items: center;
    overflow-y: auto;
    padding: 1rem 0.85rem calc(1.5rem + var(--safe-bottom));
  }
  .activity-sheet,
  .completion-sheet {
    width: min(100%, 46rem);
  }
  .activity-heading {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.8rem;
    align-items: start;
  }
  .activity-icon,
  .completion-icon {
    display: grid;
    width: 3.25rem;
    height: 3.25rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.3rem 1rem 0.3rem 0.3rem;
    background: var(--color-acid-100);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .activity-heading h1,
  .completion-sheet h1 {
    margin-top: 0.35rem;
    text-wrap: balance;
    font-size: clamp(1.8rem, 7vw, 3.5rem);
    font-weight: 930;
    letter-spacing: -0.04em;
    line-height: 0.95;
  }
  .activity-heading p:last-child {
    margin-top: 0.65rem;
    color: var(--color-ink-600);
    line-height: 1.5;
  }
  .word-card,
  .question-card,
  .sentence-card,
  .completion-sheet {
    position: relative;
    margin-top: 1.25rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.35rem 1.5rem 0.35rem 0.35rem;
    background: var(--color-paper-50);
    padding: clamp(1.25rem, 5vw, 2.4rem);
    box-shadow: 6px 6px 0 var(--color-ink-950);
  }
  .word-index {
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 850;
  }
  .speak-button {
    position: absolute;
    top: 0.9rem;
    right: 0.9rem;
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 50%;
    background: var(--color-acid-100);
  }
  .word-kind {
    margin-top: 2rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 820;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .word-card h2 {
    margin-top: 0.3rem;
    font-size: clamp(2.2rem, 11vw, 4.5rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 0.95;
  }
  .word-card > strong {
    display: block;
    margin-top: 1.15rem;
    font-size: 1.2rem;
  }
  .plural {
    margin-top: 0.4rem;
    color: var(--color-ink-600);
    font-size: 0.8rem;
  }
  blockquote {
    display: grid;
    gap: 0.25rem;
    margin-top: 1.3rem;
    border: 1px solid var(--color-cobalt-700);
    background: var(--color-sky-50);
    padding: 0.85rem 1rem;
  }
  blockquote span {
    font-weight: 760;
  }
  blockquote small {
    color: var(--color-ink-600);
  }
  .primary-button,
  .secondary-button,
  .feedback button {
    display: inline-flex;
    min-height: 2.9rem;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem 0.7rem 0.25rem 0.25rem;
    padding: 0.7rem 1rem;
    font-size: 0.8rem;
    font-weight: 850;
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .primary-button {
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }
  .secondary-button {
    background: white;
  }
  .primary-button.full {
    width: 100%;
    margin-top: 1.15rem;
  }
  .primary-button:active,
  .secondary-button:active,
  .feedback button:active,
  .answer-list button:active {
    transform: scale(0.97);
  }
  .question-card > p {
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 850;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .question-card h2 {
    margin-top: 0.5rem;
    font-size: clamp(1.75rem, 8vw, 3rem);
    font-weight: 900;
    letter-spacing: -0.04em;
  }
  .error-question {
    background:
      linear-gradient(135deg, var(--color-coral-50) 0 0.55rem, transparent 0.55rem) top right /
        2.2rem 2.2rem no-repeat,
      var(--color-paper-50);
  }
  .error-clinic-mark {
    display: inline-flex;
    min-height: 2.1rem;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.85rem;
    border: 1px solid var(--color-coral-700);
    background: var(--color-coral-50);
    padding: 0.3rem 0.65rem 0.3rem 0.35rem;
    color: var(--color-coral-700);
    font-size: 0.68rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .error-clinic-mark span {
    display: grid;
    width: 1.35rem;
    height: 1.35rem;
    place-items: center;
    border-radius: 50%;
    color: white;
    background: var(--color-coral-700);
    font-family: var(--font-mono);
    font-weight: 900;
  }
  .error-question .error-clinic-mark + h2 {
    font-size: clamp(1.45rem, 7vw, 2.5rem);
    line-height: 1.08;
  }
  .dictation-player {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
    border-radius: 0.3rem 1rem 0.3rem 0.3rem;
    color: var(--color-paper-50);
    background: var(--color-ink-950);
    padding: 1rem;
  }
  .dictation-player > div:last-child {
    min-width: 0;
  }
  .dictation-player > div:last-child > span,
  .dictation-alternative > span {
    color: var(--color-acid-500);
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 850;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .dictation-player h2 {
    margin-top: 0.2rem;
    font-size: 1.3rem;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  .dictation-player p {
    margin-top: 0.35rem;
    color: var(--color-paper-200);
    font-size: 0.72rem;
    line-height: 1.4;
  }
  .dictation-signal {
    display: flex;
    width: 4rem;
    height: 4rem;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    border-radius: 50%;
    background: var(--color-acid-500);
  }
  .dictation-signal span {
    width: 0.22rem;
    height: 1.8rem;
    border-radius: 999px;
    background: var(--color-ink-950);
    transform: scaleY(0.3);
  }
  .dictation-player.listening .dictation-signal span {
    animation: dictation-pulse 650ms var(--ease-out-emil) infinite alternate;
  }
  .dictation-player.listening .dictation-signal span:nth-child(2),
  .dictation-player.listening .dictation-signal span:nth-child(4) {
    animation-delay: 110ms;
  }
  .dictation-player.listening .dictation-signal span:nth-child(3) {
    animation-delay: 220ms;
  }
  .dictation-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.55rem;
    margin-top: 0.7rem;
  }
  .dictation-controls button {
    display: inline-flex;
    min-height: 3rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem 0.7rem 0.25rem 0.25rem;
    background: white;
    padding: 0.65rem 0.85rem;
    font-size: 0.78rem;
    font-weight: 850;
  }
  .dictation-controls .dictation-play {
    background: var(--color-acid-500);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .dictation-controls button:active {
    transform: scale(0.97);
  }
  .dictation-form {
    margin-top: 1.2rem;
  }
  .dictation-form label {
    display: block;
    font-size: 0.76rem;
    font-weight: 850;
  }
  .dictation-form input {
    width: 100%;
    min-height: 3.4rem;
    margin-top: 0.4rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.3rem 0.85rem 0.3rem 0.3rem;
    background: white;
    padding: 0.8rem 0.9rem;
    font-size: 1rem;
    line-height: 1.35;
  }
  .dictation-form input[aria-invalid='true'] {
    border-color: var(--color-coral-700);
    background: var(--color-coral-50);
  }
  .dictation-form > p,
  .dictation-alternative > p {
    margin-top: 0.45rem;
    color: var(--color-ink-800);
    font-size: 0.72rem;
    line-height: 1.45;
  }
  .alternative-toggle {
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    margin: 0.55rem auto -0.6rem;
    border: 0;
    color: var(--color-cobalt-700);
    background: transparent;
    padding: 0.55rem;
    font-size: 0.72rem;
    font-weight: 800;
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }
  .dictation-alternative {
    margin-top: 1rem;
    border-top: 1px solid var(--color-cobalt-700);
    border-bottom: 1px solid var(--color-cobalt-700);
    background: var(--color-sky-50);
    padding: 1rem;
  }
  .dictation-alternative > span {
    color: var(--color-cobalt-700);
  }
  .dictation-alternative h2 {
    font-size: 1.65rem;
    line-height: 1.05;
  }
  @keyframes dictation-pulse {
    from {
      transform: scaleY(0.28);
    }
    to {
      transform: scaleY(1);
    }
  }
  .answer-list {
    display: grid;
    gap: 0.55rem;
    margin-top: 1.35rem;
  }
  .answer-list button {
    display: grid;
    min-height: 3.5rem;
    grid-template-columns: 2rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.6rem;
    border: 1px solid var(--color-line);
    border-radius: 0.3rem 0.8rem 0.3rem 0.3rem;
    background: white;
    padding: 0.65rem;
    text-align: left;
  }
  .answer-list button strong {
    line-height: 1.35;
  }
  .answer-list button > span {
    display: grid;
    width: 1.8rem;
    height: 1.8rem;
    place-items: center;
    border: 1px solid var(--color-line);
    font-family: var(--font-mono);
    font-size: 0.65rem;
  }
  .answer-list button.selected {
    border-color: var(--color-ink-950);
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .answer-list button.answer-correct {
    border-color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .answer-list button.answer-wrong {
    border-color: var(--color-coral-700);
    background: var(--color-coral-50);
  }
  .feedback {
    margin-top: 1rem;
    border: 1px solid var(--color-coral-700);
    border-radius: 0.3rem 1rem 0.3rem 0.3rem;
    background: var(--color-coral-50);
    padding: 1rem;
  }
  .feedback.positive {
    border-color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .feedback strong {
    font-size: 1rem;
  }
  .feedback p {
    margin-top: 0.25rem;
    color: var(--color-ink-600);
    font-size: 0.78rem;
  }
  .feedback button {
    width: 100%;
    margin-top: 0.85rem;
    background: white;
  }
  .sentence-task {
    font-size: 1rem;
    font-weight: 800;
    line-height: 1.45;
  }
  .sentence-pattern {
    display: grid;
    gap: 0.35rem;
    margin-top: 0.9rem;
    border: 1px solid var(--color-cobalt-700);
    background: var(--color-sky-50);
    padding: 0.8rem;
  }
  .sentence-pattern span {
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 850;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .sentence-pattern strong {
    font-size: 0.82rem;
    line-height: 1.45;
  }
  .word-bank {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin: 0.9rem 0 1.2rem;
  }
  .word-bank span {
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem;
    background: var(--color-butter-50);
    padding: 0.5rem 0.7rem;
    font-size: 0.75rem;
    font-weight: 760;
  }
  .sentence-card label {
    display: block;
    font-size: 0.75rem;
    font-weight: 850;
  }
  .sentence-card textarea {
    width: 100%;
    min-height: 8rem;
    margin-top: 0.4rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.3rem 1rem 0.3rem 0.3rem;
    background: white;
    padding: 0.9rem;
    font-size: 1rem;
    line-height: 1.5;
    resize: vertical;
  }
  .sentence-help,
  .save-note {
    margin-top: 0.6rem;
    color: var(--color-ink-600);
    font-size: 0.7rem;
    line-height: 1.45;
  }
  .sentence-checklist {
    margin-top: 0.75rem;
    border-top: 1px solid var(--color-line);
    border-bottom: 1px solid var(--color-line);
    padding: 0.7rem 0;
  }
  .sentence-checklist > strong {
    font-size: 0.72rem;
  }
  .sentence-checklist ul {
    display: grid;
    gap: 0.35rem;
    margin-top: 0.5rem;
  }
  .sentence-checklist li {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    color: var(--color-ink-600);
    font-size: 0.7rem;
    line-height: 1.4;
  }
  .sentence-checklist li :global(svg) {
    flex: none;
    margin-top: 0.08rem;
    color: var(--color-mint-700);
  }
  .error-message {
    margin-top: 1rem;
    border: 1px solid var(--color-coral-700);
    background: var(--color-coral-50);
    padding: 0.75rem;
    color: var(--color-coral-700);
    font-size: 0.78rem;
    font-weight: 760;
  }
  .completion-sheet {
    margin-top: 0;
    text-align: center;
  }
  .completion-icon {
    margin: 0 auto 1.2rem;
  }
  .completion-copy {
    max-width: 34rem;
    margin: 0.9rem auto 0;
    color: var(--color-ink-600);
    line-height: 1.55;
  }
  .stars {
    display: flex;
    justify-content: center;
    gap: 0.35rem;
    margin-top: 1.25rem;
    color: var(--color-line);
  }
  .stars :global(.earned) {
    color: var(--color-orange-500);
  }
  .reward-line,
  .unlock-note {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    margin-top: 1rem;
    border: 1px solid var(--color-ink-950);
    background: var(--color-acid-100);
    padding: 0.55rem 0.75rem;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 850;
  }
  .unlock-note {
    display: flex;
    width: fit-content;
    margin-inline: auto;
    background: var(--color-mint-50);
  }
  .completion-actions {
    display: grid;
    gap: 0.65rem;
    margin-top: 1.5rem;
  }
  @media (min-width: 700px) {
    .answer-list:not(.sentence-options) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .completion-actions {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (hover: hover) and (pointer: fine) {
    .primary-button:hover,
    .secondary-button:hover,
    .feedback button:hover {
      transform: translateY(-2px);
      box-shadow: 5px 5px 0 var(--color-ink-950);
    }
    .dictation-controls button:hover {
      transform: translateY(-1px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .header-progress i,
    .primary-button,
    .secondary-button,
    .answer-list button {
      transition: none;
    }
    .dictation-player.listening .dictation-signal span {
      animation: none;
      transform: scaleY(0.65);
    }
  }
</style>
