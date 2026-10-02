<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    playLearningAudio,
    stopLearningAudio,
    type LearningAudioResult,
  } from '$lib/client/learning-audio.ts';
  import {
    speechRecognitionSupported,
    startGermanSpeechRecognition,
    type SpeechRecognitionHandle,
  } from '$lib/client/speech-recognition.ts';
  import ArticlePicker from '$lib/components/ArticlePicker.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import { coachScenarioById, coachScenarios } from '$lib/domain/course/coach.ts';
  import { gradeCourseDictation } from '$lib/domain/course/dictation.ts';
  import { grammarLessonById, grammarLessons } from '$lib/domain/course/grammar.ts';
  import { gradeGermanAnswer } from '$lib/domain/grading/grade.ts';
  import { normalizeText } from '$lib/domain/grading/normalize.ts';
  import {
    buildDailyLessonPlan,
    createDailySession,
    dailySessionSummary,
  } from '$lib/domain/learning/planner.ts';
  import { remainingDailyNewCards } from '$lib/domain/stats/learning.ts';
  import { localized } from '$lib/i18n';
  import { grammarLessonCopy, grammarQuestionCopy, grammarOptionCopy } from '$lib/i18n/grammar.ts';
  import { mistakeLabel } from '$lib/i18n/mistakes.ts';
  import { noteMeaning } from '$lib/i18n/vocabulary.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import { ConversationController } from '$lib/state/conversation.svelte.ts';
  import { loadCoursePath } from '$lib/state/course-path.ts';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Brain from '@lucide/svelte/icons/brain';
  import Check from '@lucide/svelte/icons/check';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import Headphones from '@lucide/svelte/icons/headphones';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Mic from '@lucide/svelte/icons/mic';
  import MicOff from '@lucide/svelte/icons/mic-off';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import X from '@lucide/svelte/icons/x';
  import { onDestroy, onMount, tick } from 'svelte';

  import type { GrammarQuestion } from '$lib/domain/course/grammar.ts';
  import type {
    DailySessionRecord,
    EvidenceModality,
    LearningEvidence,
    LessonActivity,
  } from '$lib/domain/learning/types.ts';
  import type { AnswerSignal, Article, RatingKey } from '$lib/domain/types.ts';

  type Feedback = {
    correct: boolean;
    title: string;
    message: string;
    expected?: string;
  };

  let initialized = $state(false);
  let loadingError = $state('');
  let session = $state<DailySessionRecord | undefined>(undefined);
  let answer = $state('');
  let selectedArticle = $state<Article | undefined>(undefined);
  let selectedChoice = $state('');
  let selectedOrderIndexes = $state<number[]>([]);
  let feedback = $state<Feedback | undefined>(undefined);
  // Evidence crosses the structured-clone boundary into IndexedDB. Keep it raw
  // so Svelte never wraps the record itself in a reactive Proxy.
  let pendingEvidence = $state.raw<LearningEvidence | undefined>(undefined);
  let hintVisible = $state(false);
  let hintsUsed = $state(0);
  let saving = $state(false);
  let activityStartedAt = $state(0);
  let lastActivityId = $state('');
  let audioPlaying = $state(false);
  let audioPlays = $state(0);
  let audioSource = $state<LearningAudioResult['source'] | undefined>(undefined);
  let audioError = $state('');
  let speechAvailable = $state(false);
  let microphoneListening = $state(false);
  let speechDraft = $state(false);
  let speechError = $state('');
  let speechHandle: SpeechRecognitionHandle | undefined;
  let transferAcceptedTurns = $state(0);
  let transferAttempts = $state(0);
  let exitChoice = $state('');
  let activityHeading = $state<HTMLHeadingElement | undefined>(undefined);
  let answerInput = $state<HTMLInputElement | HTMLTextAreaElement | undefined>(undefined);
  const transferConversation = new ConversationController();

  const active = $derived(session?.plan.activities[session.cursor]);
  const summary = $derived(
    session
      ? dailySessionSummary(session)
      : { completed: 0, total: 0, percent: 0, finished: false },
  );
  const activeNote = $derived.by(() => {
    if (active?.kind !== 'review') return undefined;
    return $appStore.notes.find((note) => note.id === active.noteId);
  });
  const activeCard = $derived.by(() => {
    if (active?.kind !== 'review') return undefined;
    return $appStore.cards.find((card) => card.id === active.cardId);
  });
  const grammarQuestion = $derived.by((): GrammarQuestion | undefined => {
    if (active?.kind !== 'grammar') return undefined;
    return grammarLessonById(active.lessonId)?.questions.find(
      (question) => question.id === active.questionId,
    );
  });
  const grammarLesson = $derived(
    active?.kind === 'grammar' ? grammarLessonById(active.lessonId) : undefined,
  );
  const grammarCopy = $derived(
    grammarLesson ? grammarLessonCopy($motherTongue, grammarLesson) : undefined,
  );
  const questionCopy = $derived(
    grammarQuestion && grammarCopy
      ? grammarQuestionCopy($motherTongue, grammarQuestion, grammarCopy)
      : undefined,
  );
  const transferScenario = $derived(
    active?.kind === 'transfer' ? coachScenarioById(active.scenarioId) : undefined,
  );
  const transferPrompt = $derived(
    transferConversation.messages.findLast((item) => item.role === 'coach')?.text ??
      (active?.kind === 'transfer' ? active.prompt : ''),
  );
  const latestTransferTurn = $derived(
    transferConversation.turns.find((turn) => turn.id === transferConversation.latestTurnId),
  );
  const transferDiagnosticsIgnored = $derived(latestTransferTurn?.diagnosticsIgnored ?? false);
  const latestTransferDiagnostics = $derived(latestTransferTurn?.result.diagnostics ?? []);
  const activityMissing = $derived(
    Boolean(
      active &&
      ((active.kind === 'review' && (!activeNote || !activeCard)) ||
        (active.kind === 'grammar' && !grammarQuestion) ||
        (active.kind === 'transfer' && !transferScenario)),
    ),
  );
  const orderedAnswer = $derived(
    grammarQuestion?.kind === 'order'
      ? selectedOrderIndexes.map((index) => grammarQuestion.tokens[index]).join(' ')
      : '',
  );

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function phaseLabel(activity: LessonActivity | undefined): string {
    if (!activity) return '';
    const labels = {
      review: copy('Opakování slovíček', 'Memory refresh'),
      focus: copy('Dnešní téma', "Today's focus"),
      transfer: copy('Použití v situaci', 'Conversation practice'),
      close: copy('Uzavření lekce', 'Lesson close'),
      repair: copy('Zkus to znovu', 'Smart repair'),
    };
    return labels[activity.phase];
  }

  onMount(() => {
    let cancelled = false;
    speechAvailable = speechRecognitionSupported();
    void (async () => {
      try {
        await appStore.initialize();
        if (cancelled) return;
        const settings = $appStore.settings;
        if (!settings)
          throw new Error(copy('Nastavení není dostupné.', 'Settings are unavailable.'));
        const path = await loadCoursePath(
          $appStore.course,
          settings.grammarLevel,
          settings.motherTongue,
        );
        const availableChapters = path.chapters
          .filter((chapter) => chapter.unlocked)
          .map((chapter) => chapter.chapter);
        const plannerChapters =
          availableChapters.length > 0
            ? availableChapters
            : path.chapters.slice(0, 1).map((view) => view.chapter);
        const availableGrammarIds = new Set(
          plannerChapters.flatMap((chapter) => chapter.grammarLessonIds),
        );
        const availableScenarioIds = new Set(
          plannerChapters.flatMap((chapter) => chapter.coachScenarioIds),
        );
        const now = new Date();
        const plan = buildDailyLessonPlan({
          now,
          minutes: settings.dailyMinutes,
          learningGoal: settings.learningGoal,
          cards: $appStore.cards,
          notes: $appStore.notes,
          skillStates: $appStore.skillStates,
          learningEvidence: $appStore.learningEvidence,
          grammarLessons: grammarLessons.filter((lesson) => availableGrammarIds.has(lesson.id)),
          coachScenarios: coachScenarios.filter((scenario) =>
            availableScenarioIds.has(scenario.id),
          ),
          chapters: plannerChapters,
          currentChapterId: path.recommendation?.chapterId,
          examTag: settings.examPlan?.tag,
          remainingNewCards: remainingDailyNewCards(
            $appStore.recentReviews,
            settings.dailyNewLimit,
            now,
          ),
        });
        session = await appStore.beginDailySession(createDailySession(plan));
      } catch (error) {
        loadingError =
          error instanceof Error
            ? error.message
            : copy(
                'Dnešní lekci se nepodařilo připravit.',
                "Today's lesson could not be prepared.",
              );
      } finally {
        initialized = true;
      }
    })();
    return () => {
      cancelled = true;
      stopMicrophone(true);
      stopLearningAudio();
    };
  });

  onDestroy(() => {
    stopMicrophone(true);
    stopLearningAudio();
    transferConversation.destroy();
  });

  $effect(() => {
    const activityId = active?.id ?? '';
    if (!activityId || activityId === lastActivityId) return;
    lastActivityId = activityId;
    answer = '';
    selectedArticle = undefined;
    selectedChoice = '';
    selectedOrderIndexes = [];
    feedback = undefined;
    pendingEvidence = undefined;
    hintVisible = false;
    hintsUsed = 0;
    audioPlays = 0;
    audioSource = undefined;
    audioError = '';
    speechDraft = false;
    speechError = '';
    transferAcceptedTurns = 0;
    transferAttempts = 0;
    exitChoice = '';
    activityStartedAt = typeof performance === 'undefined' ? Date.now() : performance.now();
    if (active?.kind === 'transfer' && transferScenario) {
      transferConversation.start(
        active.repair
          ? {
              mode: 'repair',
              scenario: transferScenario,
              motherTongue: $motherTongue,
              focusWords: transferScenario.focusWords,
              turnsTarget: 1,
              opening: active.prompt,
              repair: active.repair,
            }
          : {
              mode: 'conversation',
              scenario: transferScenario,
              motherTongue: $motherTongue,
              focusWords: transferScenario.focusWords,
              turnsTarget: active.turnsTarget,
              opening: active.prompt,
            },
      );
    } else {
      transferConversation.reset();
    }
    void tick().then(() => {
      activityHeading?.focus();
      if (active?.kind === 'review' || active?.kind === 'grammar') answerInput?.focus();
      return undefined;
    });
  });

  function responseMs(): number {
    const now = typeof performance === 'undefined' ? Date.now() : performance.now();
    return Math.max(0, Math.round(now - activityStartedAt));
  }

  function insertGermanCharacter(character: string): void {
    const element = answerInput;
    if (!element) {
      answer += character;
      return;
    }
    const start = element.selectionStart ?? answer.length;
    const end = element.selectionEnd ?? start;
    answer = `${answer.slice(0, start)}${character}${answer.slice(end)}`;
    void tick().then(() => {
      element.focus();
      element.setSelectionRange(start + character.length, start + character.length);
      return undefined;
    });
  }

  function meaningGrade(submitted: string): {
    correct: boolean;
    rating: RatingKey;
    signal: AnswerSignal;
    message: string;
  } {
    if (!activeNote) throw new Error('Slovíčko není dostupné.');
    const normalized = normalizeText(submitted);
    const accepted = [activeNote.czech, ...activeNote.acceptedCzech].map(normalizeText);
    const correct = accepted.includes(normalized);
    return {
      correct,
      rating: correct ? 'good' : 'again',
      message: correct
        ? copy('Význam sis vybavila bez nápovědy.', 'You recalled the meaning without a hint.')
        : copy(
            'Význam nesedí. Tohle slovo si ještě zopakuješ.',
            'The meaning isn’t right. You’ll practise this word again.',
          ),
      signal: {
        exercise: 'typing',
        submittedText: submitted,
        normalizedText: normalized,
        expectedText: activeNote.czech,
        wordCorrect: correct,
        articleCorrect: true,
        exact: correct,
        keyboardEquivalent: false,
        editDistance: correct ? 0 : 1,
        responseMs: responseMs(),
        hintsUsed,
        attempt: 1,
      },
    };
  }

  async function submitReview(): Promise<void> {
    if (active?.kind !== 'review' || !activeNote || !activeCard || !answer.trim() || saving) return;
    saving = true;
    try {
      const result =
        active.direction === 'cs-de'
          ? gradeGermanAnswer({
              expectedGerman: activeNote.german,
              acceptedGerman: activeNote.acceptedGerman,
              expectedArticle: activeNote.article,
              selectedArticle,
              submittedText: answer,
              responseMs: responseMs(),
              hintsUsed,
              allowKeyboardFallback: $appStore.settings?.allowKeyboardFallback,
            })
          : meaningGrade(answer);
      const saved = await appStore.review({
        operationId: `daily-review:${session?.key}:${active.id}`,
        activityId: active.id,
        card: activeCard,
        note: activeNote,
        mode: 'long-term',
        rating: result.rating,
        signal: result.signal,
      });
      pendingEvidence = saved.evidence;
      feedback = {
        correct: result.correct,
        title: result.correct
          ? copy('Sedí to.', 'That is right.')
          : copy('Tady je mezera.', 'There is a gap here.'),
        message: result.message,
        expected:
          active.direction === 'cs-de'
            ? `${activeNote.article ? `${activeNote.article} ` : ''}${activeNote.german}`
            : noteMeaning(activeNote, $motherTongue),
      };
    } catch (error) {
      loadingError =
        error instanceof Error
          ? error.message
          : copy('Odpověď se neuložila.', 'The answer was not saved.');
    } finally {
      saving = false;
    }
  }

  function grammarAnswerIsReady(question: GrammarQuestion): boolean {
    if (question.kind === 'choice') return Boolean(selectedChoice);
    if (question.kind === 'fill') return Boolean(answer.trim());
    return selectedOrderIndexes.length === question.tokens.length;
  }

  function grammarAnswerIsCorrect(question: GrammarQuestion): boolean {
    if (question.kind === 'choice') return selectedChoice === question.answer;
    if (question.kind === 'fill') {
      const submitted = normalizeText(answer);
      return question.answers.map(normalizeText).includes(submitted);
    }
    return question.answer.join(' ') === orderedAnswer;
  }

  function expectedGrammarAnswer(question: GrammarQuestion): string {
    if (question.kind === 'choice') return grammarOptionCopy($motherTongue, question.answer);
    if (question.kind === 'fill') return question.answers[0];
    return question.answer.join(' ');
  }

  async function submitGrammar(): Promise<void> {
    if (
      active?.kind !== 'grammar' ||
      !grammarQuestion ||
      !grammarAnswerIsReady(grammarQuestion) ||
      saving
    )
      return;
    const correct = grammarAnswerIsCorrect(grammarQuestion);
    saving = true;
    try {
      const result = await appStore.answerCourseQuestion({
        operationId: `daily-grammar:${session?.key}:${active.id}`,
        activityId: active.id,
        hintsUsed,
        lessonId: active.lessonId,
        questionId: active.questionId,
        correct,
        responseMs: responseMs(),
      });
      pendingEvidence = result.evidence;
      feedback = {
        correct,
        title: correct
          ? copy('Správně.', 'The pattern holds.')
          : copy('Ještě upravit odpověď.', 'One adjustment needed.'),
        message: questionCopy?.explanation ?? grammarQuestion.explanation,
        expected: expectedGrammarAnswer(grammarQuestion),
      };
    } catch (error) {
      loadingError =
        error instanceof Error
          ? error.message
          : copy('Odpověď se neuložila.', 'The answer was not saved.');
    } finally {
      saving = false;
    }
  }

  function toggleOrderToken(index: number): void {
    if (feedback) return;
    selectedOrderIndexes = selectedOrderIndexes.includes(index)
      ? selectedOrderIndexes.filter((candidate) => candidate !== index)
      : [...selectedOrderIndexes, index];
  }

  async function playListening(): Promise<void> {
    if (active?.kind !== 'listening' || audioPlaying) return;
    audioPlaying = true;
    audioError = '';
    audioPlays += 1;
    try {
      const result = await playLearningAudio({ audioId: active.audioId, text: active.transcript });
      audioSource = result.source;
      await tick();
      answerInput?.focus();
    } catch (error) {
      audioError =
        error instanceof Error
          ? error.message
          : copy('Zvuk se nepodařilo přehrát.', 'Audio could not be played.');
    } finally {
      audioPlaying = false;
    }
  }

  function dailyEvidence(input: {
    activity: LessonActivity;
    source: LearningEvidence['source'];
    sourceId: string;
    modality: EvidenceModality;
    correct: boolean;
    independent: boolean;
    mistakeTags?: LearningEvidence['mistakeTags'];
    repairOfEvidenceId?: string;
  }): LearningEvidence {
    if (!session) throw new Error('Dnešní lekce není dostupná.');
    const occurredAt = new Date().toISOString();
    return {
      id: `evidence:daily:${session.key}:${input.activity.id}`,
      operationId: `daily:${session.key}:${input.activity.id}`,
      activityId: input.activity.id,
      source: input.source,
      sourceId: input.sourceId,
      skillIds: [...input.activity.skillIds],
      occurredAt,
      localDay: session.plan.localDay,
      mode: 'long-term',
      modality: input.modality,
      outcome: input.correct ? 'correct' : 'incorrect',
      hintsUsed,
      responseMs: responseMs(),
      independent: input.independent,
      mistakeTags: input.mistakeTags ? [...input.mistakeTags] : undefined,
      repairOfEvidenceId: input.repairOfEvidenceId,
    };
  }

  function submitListening(): void {
    if (active?.kind !== 'listening' || !answer.trim() || feedback) return;
    const grade = gradeCourseDictation(answer, active.transcript);
    pendingEvidence = dailyEvidence({
      activity: active,
      source: 'listening-dictation',
      sourceId: active.audioId,
      modality: 'dictation',
      correct: grade.correct,
      independent: grade.correct && audioPlays <= 1 && hintsUsed === 0,
      mistakeTags: grade.correct ? undefined : ['spelling'],
    });
    feedback = {
      correct: grade.correct,
      title: grade.correct
        ? copy('Slyšela jsi celou větu.', 'You caught the whole sentence.')
        : copy('Jedna část unikla.', 'One part slipped by.'),
      message: grade.keyboardEquivalent
        ? copy(
            'Význam je správně. Podívej se ještě na pravopis.',
            'The meaning is right. Check the spelling once more.',
          )
        : grade.correct
          ? copy('Poslech i zápis sedí.', 'Listening and spelling both match.')
          : copy('Větu si poslechneš znovu v opravě.', 'You’ll practise this sentence again.'),
      expected: active.transcript,
    };
  }

  function showHint(): void {
    if (hintVisible || feedback) return;
    hintVisible = true;
    hintsUsed += 1;
  }

  function stopMicrophone(abort = false): void {
    if (speechHandle) {
      if (abort) speechHandle.abort();
      else speechHandle.stop();
    }
    speechHandle = undefined;
    microphoneListening = false;
  }

  function toggleMicrophone(): void {
    if (microphoneListening) {
      stopMicrophone();
      return;
    }
    speechError = '';
    speechHandle = startGermanSpeechRecognition(
      {
        onstart: () => (microphoneListening = true),
        ontranscript: (transcript) => {
          answer = transcript;
          speechDraft = true;
        },
        onerror: (message) => {
          speechError = message;
          microphoneListening = false;
        },
        onend: () => {
          microphoneListening = false;
          speechHandle = undefined;
          void tick().then(() => answerInput?.focus());
        },
      },
      $motherTongue,
    );
  }

  function transferSucceeded(): boolean {
    if (active?.kind !== 'transfer' || !active.repair) return true;
    return !transferConversation
      .activeDiagnostics()
      .some((diagnostic) => diagnostic.tag === active.repair?.mistakeTag);
  }

  function prepareTransferEvidence(): boolean {
    if (active?.kind !== 'transfer' || !transferConversation.complete) return false;
    const correct = transferSucceeded();
    pendingEvidence = dailyEvidence({
      activity: active,
      source: 'transfer',
      sourceId: active.scenarioId,
      modality: 'free-production',
      correct,
      independent:
        correct &&
        transferAttempts === active.turnsTarget &&
        hintsUsed === 0 &&
        transferConversation.activeDiagnostics().length === 0,
      mistakeTags: transferConversation.activeDiagnostics().map((diagnostic) => diagnostic.tag),
      repairOfEvidenceId: active.repair?.evidenceId,
    });
    return correct;
  }

  async function submitTransferTurn(): Promise<void> {
    if (active?.kind !== 'transfer' || !transferScenario || !answer.trim() || feedback || saving) {
      return;
    }
    transferAttempts += 1;
    saving = true;
    loadingError = '';
    const submitted = answer.trim();
    try {
      const result = await transferConversation.send(submitted);
      if (!result.accepted) {
        feedback = {
          correct: false,
          title: copy('Tahle replika ještě nesedí.', 'This reply does not fit yet.'),
          message: result.feedback,
        };
        return;
      }

      transferAcceptedTurns = transferConversation.completedTurns;
      answer = '';
      speechDraft = false;
      if (!transferConversation.complete) {
        feedback = {
          correct: true,
          title: copy('Replika funguje.', 'That reply works.'),
          message: result.feedback,
          expected: result.correction ?? undefined,
        };
        return;
      }

      const correct = prepareTransferEvidence();
      feedback = {
        correct,
        title: correct
          ? active.repair
            ? copy('Teď už je to správně.', 'The repair holds.')
            : copy('Domluvila ses.', 'You got the message across.')
          : copy('Tohle si ještě procvičíš.', 'This pattern will return once more.'),
        message: correct
          ? result.feedback
          : copy(
              'Podle AI se tahle chyba opakuje. Pro další procvičení se uloží jen typ chyby, ne tvoje věta.',
              'The same error pattern appeared again. Only its category is stored, not your sentence.',
            ),
        expected: result.correction ?? undefined,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      answer = transferConversation.failedDraft || submitted;
      loadingError =
        transferConversation.error ||
        copy('Repliku se nepodařilo posoudit.', 'The reply could not be assessed.');
    } finally {
      saving = false;
    }
  }

  function retryTransfer(): void {
    feedback = undefined;
    void tick().then(() => answerInput?.focus());
  }

  function toggleTransferAssessment(): void {
    const turnId = transferConversation.latestTurnId;
    if (!turnId || !transferConversation.complete) return;
    if (transferDiagnosticsIgnored) transferConversation.restoreDiagnostics(turnId);
    else transferConversation.ignoreDiagnostics(turnId);
    const correct = prepareTransferEvidence();
    feedback = {
      correct,
      title: correct
        ? copy('Výsledek bereme bez sporné opravy.', 'The disputed correction is excluded.')
        : copy('Tohle si ještě procvičíš.', 'This pattern will return once more.'),
      message: correct
        ? copy(
            'Do dalšího plánu se sporné hodnocení nepromítne.',
            'The disputed assessment will not affect the next plan.',
          )
        : copy(
            'Do dalšího plánu se uloží pouze typ chyby.',
            'Only the error category will be used in the next plan.',
          ),
    };
  }

  async function finishCurrentActivity(): Promise<void> {
    if (!active || !session || saving) return;
    const correct = feedback?.correct ?? active.kind === 'exit-ticket';
    saving = true;
    loadingError = '';
    try {
      session = await appStore.completeDailySessionActivity({
        activityId: active.id,
        evidence: pendingEvidence,
        needsRepair:
          !correct &&
          active.kind !== 'exit-ticket' &&
          !(active.kind === 'transfer' && Boolean(active.repair)),
      });
    } catch (error) {
      loadingError =
        error instanceof Error
          ? error.message
          : copy('Pokrok se nepodařilo uložit.', 'Progress could not be saved.');
    } finally {
      saving = false;
    }
  }

  async function skipMissingActivity(): Promise<void> {
    if (!activityMissing || !active || !session || saving) return;
    saving = true;
    try {
      session = await appStore.completeDailySessionActivity({ activityId: active.id });
    } finally {
      saving = false;
    }
  }

  function closeLesson(): void {
    stopMicrophone(true);
    stopLearningAudio();
    void goto('/');
  }
</script>

<svelte:head>
  <title>{copy('Dnešní lekce · Fritz', "Today's lesson · Fritz")}</title>
  <meta
    name="description"
    content={copy(
      'Krátká lekce němčiny se slovíčky, poslechem a vlastními odpověďmi.',
      'A short German lesson with vocabulary, listening, and your own answers.',
    )}
  />
</svelte:head>

{#if !initialized}
  <LoadingState label={copy('Skládám dnešní lekci…', "Building today's lesson…")} />
{:else if loadingError && !session}
  <section class="today-error" aria-labelledby="today-error-title">
    <CircleAlert size={28} aria-hidden="true" />
    <h1 id="today-error-title">
      {copy('Lekci se nepodařilo otevřít', 'The lesson could not open')}
    </h1>
    <p>{loadingError}</p>
    <a href="/">{copy('Zpět na přehled', 'Back to overview')}</a>
  </section>
{:else if session}
  <div class="today-runner">
    <header class="runner-header">
      <button
        class="close-button"
        type="button"
        onclick={closeLesson}
        aria-label={copy('Uložit a zavřít lekci', 'Save and close lesson')}
      >
        <X size={20} aria-hidden="true" />
      </button>
      <div class="header-progress">
        <div class="progress-copy">
          <strong>{copy('Dnešní lekce', "Today's lesson")}</strong>
          <span>{summary.completed}/{summary.total}</span>
        </div>
        <ProgressBar
          value={summary.percent}
          label={copy('Postup dnešní lekcí', "Today's lesson progress")}
        />
      </div>
      <span class="time-label">{session.plan.minutes} min</span>
    </header>

    {#if summary.finished}
      <section class="lesson-complete" aria-labelledby="lesson-complete-title">
        <span class="complete-mark"><Check size={34} strokeWidth={2.6} aria-hidden="true" /></span>
        <p class="eyebrow">{copy('Lekce uzavřena', 'Lesson complete')}</p>
        <h1 id="lesson-complete-title">{copy('Dnes je hotovo.', 'You are done for today.')}</h1>
        <p>
          {copy(
            `Prošla jsi ${summary.total} úloh. Další termíny opakování jsou uložené v tomto zařízení.`,
            `You completed ${summary.total} activities. Your next review dates are saved on this device.`,
          )}
        </p>
        <dl>
          <div>
            <dt>{copy('Čas', 'Time')}</dt>
            <dd>{session.plan.minutes} min</dd>
          </div>
          <div>
            <dt>{copy('Záznamy o učení', 'Learning records')}</dt>
            <dd>{session.evidenceIds.length}</dd>
          </div>
          <div>
            <dt>{copy('Soukromí', 'Privacy')}</dt>
            <dd>{copy('jen v zařízení', 'on-device')}</dd>
          </div>
        </dl>
        <div class="complete-actions">
          <a class="primary-link" href="/"
            ><ArrowLeft size={18} aria-hidden="true" />{copy('Zpět na cestu', 'Back to path')}</a
          >
          <a class="secondary-link" href="/progress/"
            >{copy('Prohlédnout pokrok', 'View progress')}<ArrowRight
              size={18}
              aria-hidden="true"
            /></a
          >
        </div>
      </section>
    {:else if active}
      <section
        class="lesson-stage"
        aria-label={copy('Aktivita dnešní lekce', "Today's lesson activity")}
      >
        <section
          class:repair={active.phase === 'repair'}
          class="activity-card"
          aria-labelledby="activity-title"
        >
          <div class="activity-meta">
            <span>{phaseLabel(active)}</span>
            <span>{session.cursor + 1} / {session.plan.activities.length}</span>
          </div>
          <h1 id="activity-title" tabindex="-1" bind:this={activityHeading}>{active.title}</h1>
          <p class="instruction">{active.instruction}</p>

          {#if activityMissing}
            <div class="missing-state" role="status">
              <CircleAlert size={24} aria-hidden="true" />
              <div>
                <strong
                  >{copy(
                    'Obsah se mezitím změnil.',
                    'This content changed in the meantime.',
                  )}</strong
                >
                <p>
                  {copy(
                    'Tenhle krok přeskočíme. Do výsledků se nezapočítá.',
                    'We’ll skip this step. It won’t count toward your results.',
                  )}
                </p>
              </div>
              <button type="button" onclick={skipMissingActivity} disabled={saving}
                >{copy('Pokračovat', 'Continue')}</button
              >
            </div>
          {:else if active.kind === 'review' && activeNote}
            <div class="task-prompt">
              <span
                >{active.direction === 'cs-de'
                  ? copy('Česky', 'Meaning')
                  : copy('Německy', 'German')}</span
              >
              <strong
                >{active.direction === 'cs-de'
                  ? noteMeaning(activeNote, $motherTongue)
                  : `${activeNote.article ? `${activeNote.article} ` : ''}${activeNote.german}`}</strong
              >
              {#if activeNote.exampleCs && active.direction === 'cs-de'}<small
                  >{activeNote.exampleCs}</small
                >{/if}
            </div>
            {#if !feedback}
              <form
                class="answer-form"
                onsubmit={(event) => {
                  event.preventDefault();
                  void submitReview();
                }}
              >
                {#if active.direction === 'cs-de' && activeNote.article}
                  <ArticlePicker bind:value={selectedArticle} disabled={saving} />
                {/if}
                <label for="daily-answer"
                  >{active.direction === 'cs-de'
                    ? copy('Německá odpověď', 'German answer')
                    : copy('Význam', 'Meaning')}</label
                >
                <input
                  id="daily-answer"
                  bind:this={answerInput}
                  bind:value={answer}
                  autocomplete="off"
                  autocapitalize="none"
                  spellcheck="false"
                  disabled={saving}
                />
                {#if active.direction === 'cs-de'}<GermanKeyboard
                    oninsert={insertGermanCharacter}
                  />{/if}
                <div class="form-actions">
                  <button
                    class="hint-button"
                    type="button"
                    onclick={showHint}
                    disabled={hintVisible || saving}
                    ><Lightbulb size={18} aria-hidden="true" />{copy('Nápověda', 'Hint')}</button
                  >
                  <button class="primary-button" type="submit" disabled={!answer.trim() || saving}
                    >{#if saving}<LoaderCircle
                        class="spin"
                        size={18}
                        aria-hidden="true"
                      />{/if}{copy('Zkontrolovat', 'Check')}</button
                  >
                </div>
              </form>
              {#if hintVisible}<p class="hint" role="status">
                  {copy('Začátek:', 'Starts with:')}
                  <strong
                    >{active.direction === 'cs-de'
                      ? `${activeNote.article ? `${activeNote.article} ` : ''}${activeNote.german.slice(0, 1)}…`
                      : `${noteMeaning(activeNote, $motherTongue).slice(0, 1)}…`}</strong
                  >
                </p>{/if}
            {/if}
          {:else if active.kind === 'grammar' && grammarQuestion}
            <div class="grammar-prompt">
              <span>{grammarCopy?.formula}</span>
              <strong>{questionCopy?.prompt}</strong>
            </div>
            {#if !feedback}
              <form
                class="answer-form"
                onsubmit={(event) => {
                  event.preventDefault();
                  void submitGrammar();
                }}
              >
                {#if grammarQuestion.kind === 'choice'}
                  <fieldset class="choice-grid">
                    <legend>{copy('Vyber odpověď', 'Choose an answer')}</legend
                    >{#each grammarQuestion.options as option}<button
                        type="button"
                        class:selected={selectedChoice === option}
                        aria-pressed={selectedChoice === option}
                        onclick={() => (selectedChoice = option)}
                        >{grammarOptionCopy($motherTongue, option)}</button
                      >{/each}
                  </fieldset>
                {:else if grammarQuestion.kind === 'fill'}
                  <label for="grammar-answer"
                    >{grammarQuestion.before}<span class="blank">…</span
                    >{grammarQuestion.after}</label
                  >
                  <input
                    id="grammar-answer"
                    bind:this={answerInput}
                    bind:value={answer}
                    placeholder={grammarQuestion.placeholder ?? ''}
                    autocomplete="off"
                    spellcheck="false"
                  />
                  <GermanKeyboard oninsert={insertGermanCharacter} />
                {:else}
                  <div class="ordered-sentence" aria-live="polite">
                    {orderedAnswer || copy('Věta se skládá tady', 'Your sentence appears here')}
                  </div>
                  <div class="token-grid" aria-label={copy('Slova k seřazení', 'Words to order')}>
                    {#each grammarQuestion.tokens as token, index}<button
                        type="button"
                        class:selected={selectedOrderIndexes.includes(index)}
                        aria-pressed={selectedOrderIndexes.includes(index)}
                        onclick={() => toggleOrderToken(index)}>{token}</button
                      >{/each}
                  </div>
                {/if}
                <div class="form-actions">
                  <button
                    class="hint-button"
                    type="button"
                    onclick={showHint}
                    disabled={hintVisible}
                    ><Lightbulb size={18} aria-hidden="true" />{copy('Nápověda', 'Hint')}</button
                  >
                  <button
                    class="primary-button"
                    type="submit"
                    disabled={!grammarAnswerIsReady(grammarQuestion) || saving}
                    >{copy('Zkontrolovat', 'Check')}</button
                  >
                </div>
              </form>
              {#if hintVisible}<p class="hint" role="status">
                  {questionCopy?.hint ?? grammarCopy?.concept}
                </p>{/if}
            {/if}
          {:else if active.kind === 'listening'}
            <div class="listening-panel">
              <Headphones size={30} aria-hidden="true" />
              <button
                class="audio-button"
                type="button"
                onclick={playListening}
                disabled={audioPlaying}
              >
                {#if audioPlaying}<LoaderCircle
                    class="spin"
                    size={20}
                    aria-hidden="true"
                  />{:else}<Volume2 size={20} aria-hidden="true" />{/if}
                {audioPlays === 0
                  ? copy('Přehrát větu', 'Play sentence')
                  : copy('Přehrát znovu', 'Play again')}
              </button>
              <small
                >{audioSource === 'canonical'
                  ? copy('Nahrávka věty', 'Sentence recording')
                  : audioSource === 'system-voice'
                    ? copy('Systémový německý hlas', 'System German voice')
                    : copy('Bez zobrazeného textu', 'Text stays hidden')}</small
              >
            </div>
            {#if audioError}<p class="inline-error" role="alert">{audioError}</p>{/if}
            {#if !feedback}
              <form
                class="answer-form"
                onsubmit={(event) => {
                  event.preventDefault();
                  submitListening();
                }}
              >
                <label for="dictation-answer"
                  >{copy('Napiš, co slyšíš', 'Type what you hear')}</label
                >
                <input
                  id="dictation-answer"
                  bind:this={answerInput}
                  bind:value={answer}
                  autocomplete="off"
                  autocapitalize="none"
                  spellcheck="false"
                />
                <GermanKeyboard oninsert={insertGermanCharacter} />
                <div class="form-actions">
                  <button
                    class="hint-button"
                    type="button"
                    onclick={showHint}
                    disabled={hintVisible}
                    ><Lightbulb size={18} aria-hidden="true" />{copy('Význam', 'Meaning')}</button
                  >
                  <button class="primary-button" type="submit" disabled={!answer.trim()}
                    >{copy('Zkontrolovat', 'Check')}</button
                  >
                </div>
              </form>
              {#if hintVisible}<p class="hint" role="status">{active.translation}</p>{/if}
            {/if}
          {:else if active.kind === 'transfer' && transferScenario}
            <div class="scenario-prompt">
              <span
                >{active.repair
                  ? copy('Krátká oprava', 'Quick repair')
                  : copy('Situace', 'Scenario')} · {transferAcceptedTurns +
                  1}/{active.turnsTarget}</span
              ><strong lang="de">{transferPrompt}</strong><small
                >{active.repair
                  ? copy('Procvičuješ: ', 'You are practising: ') +
                    mistakeLabel(active.repair.mistakeTag, $motherTongue)
                  : transferScenario.openingCs}</small
              >
            </div>
            {#if !pendingEvidence}
              <div class="answer-form">
                <label for="transfer-answer"
                  >{copy('Tvoje německá replika', 'Your German reply')}</label
                >
                <textarea
                  id="transfer-answer"
                  bind:this={answerInput}
                  bind:value={answer}
                  rows="3"
                  spellcheck="false"
                  disabled={saving}></textarea>
                <div class="speech-row">
                  <button
                    class:listening={microphoneListening}
                    class="microphone-button"
                    type="button"
                    onclick={toggleMicrophone}
                    disabled={!speechAvailable || saving}
                    aria-pressed={microphoneListening}
                  >
                    {#if microphoneListening}<MicOff size={19} aria-hidden="true" />{copy(
                        'Zastavit',
                        'Stop',
                      )}{:else}<Mic size={19} aria-hidden="true" />{copy(
                        'Nadiktovat',
                        'Dictate',
                      )}{/if}
                  </button>
                  <span
                    >{speechDraft
                      ? copy(
                          'Přepis je návrh — před odesláním ho můžeš upravit.',
                          'The transcript is a draft — edit it before submitting.',
                        )
                      : copy(
                          'Rozpoznání zajišťuje prohlížeč (může být online). Fritz audio neukládá.',
                          'Recognition is provided by the browser (and may be online). Fritz does not store audio.',
                        )}</span
                  >
                </div>
                {#if speechError}<p class="inline-error" role="alert">{speechError}</p>{/if}
                <GermanKeyboard oninsert={insertGermanCharacter} />
                {#if !feedback}
                  <div class="form-actions">
                    <button
                      class="hint-button"
                      type="button"
                      onclick={showHint}
                      disabled={hintVisible}
                      ><Lightbulb size={18} aria-hidden="true" />{copy('Vzor', 'Starter')}</button
                    >
                    <button
                      class="primary-button"
                      type="button"
                      onclick={() => void submitTransferTurn()}
                      disabled={!answer.trim() || saving}
                    >
                      {#if saving}<LoaderCircle class="spin" size={18} aria-hidden="true" />{/if}
                      {copy('Odeslat repliku', 'Submit reply')}
                    </button>
                    >
                  </div>
                {/if}
              </div>
              {#if hintVisible}<p class="hint" role="status" lang="de">{active.starter}</p>{/if}
            {/if}
          {:else if active.kind === 'exit-ticket'}
            <div class="exit-ticket">
              <Brain size={30} aria-hidden="true" />
              <p>{active.prompt}</p>
              <fieldset>
                <legend>{copy('Volitelně označ jednu oblast', 'Optionally choose one area')}</legend
                >{#each [copy('Slovíčka', 'Words'), copy('Gramatika', 'Grammar'), copy('Poslech', 'Listening'), copy('Mluvení', 'Speaking')] as option}<button
                    type="button"
                    class:selected={exitChoice === option}
                    aria-pressed={exitChoice === option}
                    onclick={() => (exitChoice = option)}>{option}</button
                  >{/each}
              </fieldset>
              <p class="privacy-note">
                {copy('Odpověď se nikam neposílá.', 'Your answer isn’t sent anywhere.')}
              </p>
              <button
                class="primary-button wide"
                type="button"
                onclick={finishCurrentActivity}
                disabled={saving}
                >{#if saving}<LoaderCircle class="spin" size={18} aria-hidden="true" />{/if}{copy(
                  'Dokončit dnešek',
                  'Finish today',
                )}</button
              >
            </div>
          {/if}

          {#if feedback}
            <div class:correct={feedback.correct} class="feedback" role="status" aria-live="polite">
              <span class="feedback-icon"
                >{#if feedback.correct}<Check size={22} aria-hidden="true" />{:else}<RotateCcw
                    size={21}
                    aria-hidden="true"
                  />{/if}</span
              >
              <div>
                <strong>{feedback.title}</strong>
                <p>{feedback.message}</p>
                {#if feedback.expected}<small
                    >{copy('Správně:', 'Expected:')} <b lang="de">{feedback.expected}</b></small
                  >{/if}
              </div>
            </div>
            {#if active.kind === 'transfer' && transferConversation.complete && latestTransferDiagnostics.length > 0}
              <div class="assessment-control">
                <span>
                  {transferDiagnosticsIgnored
                    ? copy(
                        'Sporná oprava se do dalšího plánu neuloží.',
                        'The disputed correction will not affect the next plan.',
                      )
                    : latestTransferDiagnostics
                        .map((diagnostic) => mistakeLabel(diagnostic.tag, $motherTongue))
                        .join(' · ')}
                </span>
                <button type="button" onclick={toggleTransferAssessment}>
                  {transferDiagnosticsIgnored
                    ? copy('Vrátit hodnocení', 'Restore assessment')
                    : copy('Hodnocení nesedí', 'This assessment is off')}
                </button>
              </div>
            {/if}
            {#if active.kind === 'transfer' && !pendingEvidence}
              <button class="primary-button wide" type="button" onclick={retryTransfer}
                >{feedback.correct
                  ? copy('Další replika', 'Next reply')
                  : copy('Upravit odpověď', 'Edit answer')}<ArrowRight
                  size={18}
                  aria-hidden="true"
                /></button
              >
            {:else}
              <button
                class="primary-button wide"
                type="button"
                onclick={finishCurrentActivity}
                disabled={saving}
                >{#if saving}<LoaderCircle
                    class="spin"
                    size={18}
                    aria-hidden="true"
                  />{/if}{feedback.correct
                  ? copy('Pokračovat', 'Continue')
                  : copy('Pokračovat · vrátí se později', 'Continue · returns later')}<ArrowRight
                  size={18}
                  aria-hidden="true"
                /></button
              >
            {/if}
          {/if}

          {#if loadingError}<p class="save-error" role="alert">{loadingError}</p>{/if}
        </section>
        <p class="runner-note">
          <Sparkles size={16} aria-hidden="true" />{active.phase === 'repair'
            ? copy(
                'Slova, ve kterých chybuješ, si zopakuješ po několika dalších úlohách.',
                'Words you miss will return after a few other activities.',
              )
            : copy(
                'Úlohy vybíráme podle toho, co je čas zopakovat, co ti dělá potíže a kde jsi v kurzu.',
                'Activities follow what’s due for review, what you find difficult, and your current chapter.',
              )}
        </p>
      </section>
    {/if}
  </div>
{/if}

<style>
  :global(body) {
    background: var(--color-paper-100);
  }
  .today-runner {
    min-height: 100dvh;
    color: var(--color-ink-950);
    background: var(--color-paper-100);
  }
  .runner-header {
    position: sticky;
    z-index: 10;
    top: 0;
    display: grid;
    grid-template-columns: 2.75rem minmax(0, 34rem) 3.5rem;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    min-height: 4.75rem;
    border-bottom: 1px solid var(--color-line);
    background: color-mix(in srgb, var(--color-paper-100) 94%, transparent);
    padding: 0.65rem clamp(1rem, 3vw, 2rem);
    backdrop-filter: blur(12px);
  }
  .close-button {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border: 1px solid var(--color-line);
    border-radius: 0.65rem;
    background: var(--color-paper-50);
    color: var(--color-ink-950);
  }
  .header-progress {
    min-width: 0;
  }
  .progress-copy {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.35rem;
    font-size: 0.75rem;
  }
  .progress-copy span,
  .time-label {
    color: var(--color-ink-700);
    font-family: var(--font-mono);
    font-size: 0.72rem;
  }
  .time-label {
    justify-self: end;
  }
  .lesson-stage {
    display: grid;
    width: min(100% - 2rem, 46rem);
    min-height: calc(100dvh - 4.75rem);
    align-content: center;
    gap: 1rem;
    margin: 0 auto;
    padding: 2rem 0 3rem;
  }
  .activity-card {
    border: 1px solid var(--color-ink-950);
    border-radius: 0.8rem;
    background: var(--color-paper-50);
    padding: clamp(1.25rem, 4vw, 2.4rem);
    box-shadow: 0 5px 0 var(--color-ink-950);
  }
  .activity-card.repair {
    border-color: var(--color-coral-500);
    box-shadow: 0 5px 0 var(--color-coral-500);
  }
  .activity-meta {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 760;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0.65rem 0 0;
    font-size: clamp(1.8rem, 5vw, 2.8rem);
    line-height: 1.04;
    letter-spacing: -0.045em;
    outline: none;
  }
  .instruction {
    max-width: 40rem;
    margin: 0.75rem 0 0;
    color: var(--color-ink-700);
    line-height: 1.55;
  }
  .task-prompt,
  .grammar-prompt,
  .scenario-prompt {
    display: grid;
    gap: 0.35rem;
    margin-top: 1.75rem;
    border-left: 0.3rem solid var(--color-acid-500);
    background: var(--color-paper-100);
    padding: 1rem 1.1rem;
  }
  .task-prompt span,
  .grammar-prompt span,
  .scenario-prompt span {
    color: var(--color-ink-700);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
  }
  .task-prompt strong,
  .grammar-prompt strong,
  .scenario-prompt strong {
    font-family: var(--font-display);
    font-size: clamp(1.25rem, 4vw, 1.75rem);
    line-height: 1.25;
  }
  .task-prompt small,
  .scenario-prompt small {
    color: var(--color-ink-700);
  }
  .answer-form {
    display: grid;
    gap: 0.8rem;
    margin-top: 1.4rem;
  }
  .answer-form label,
  fieldset legend {
    color: var(--color-ink-700);
    font-size: 0.78rem;
    font-weight: 760;
  }
  input,
  textarea {
    width: 100%;
    min-height: 3.2rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem;
    background: white;
    padding: 0.75rem 0.9rem;
    color: var(--color-ink-950);
    font: inherit;
    font-size: 1.05rem;
  }
  textarea {
    min-height: 6.5rem;
    resize: vertical;
  }
  input:focus-visible,
  textarea:focus-visible,
  button:focus-visible,
  a:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--color-cobalt-700) 38%, transparent);
    outline-offset: 2px;
  }
  .form-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.25rem;
  }
  .primary-button,
  .hint-button,
  .audio-button,
  .microphone-button {
    display: inline-flex;
    min-height: 2.9rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border-radius: 0.65rem;
    padding: 0.68rem 1rem;
    font-weight: 780;
  }
  .primary-button {
    border: 1px solid var(--color-ink-950);
    background: var(--color-ink-950);
    color: white;
  }
  .primary-button.wide {
    width: 100%;
    margin-top: 1rem;
  }
  .hint-button,
  .microphone-button {
    border: 1px solid var(--color-line);
    background: var(--color-paper-50);
    color: var(--color-ink-950);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.52;
  }
  .hint {
    margin: 0.85rem 0 0;
    border: 1px solid var(--color-butter-400);
    border-radius: 0.55rem;
    background: var(--color-butter-50);
    padding: 0.75rem;
    line-height: 1.45;
  }
  .choice-grid,
  .exit-ticket fieldset {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
    border: 0;
    padding: 0;
  }
  .choice-grid legend,
  .exit-ticket legend {
    grid-column: 1 / -1;
    margin-bottom: 0.2rem;
  }
  .choice-grid button,
  .token-grid button,
  .exit-ticket fieldset button {
    min-height: 3rem;
    border: 1px solid var(--color-line);
    border-radius: 0.55rem;
    background: var(--color-paper-50);
    padding: 0.65rem;
    color: var(--color-ink-950);
    font-weight: 720;
  }
  .choice-grid button.selected,
  .token-grid button.selected,
  .exit-ticket fieldset button.selected {
    border-color: var(--color-cobalt-700);
    background: var(--color-cobalt-700);
    color: white;
  }
  .ordered-sentence {
    min-height: 3.5rem;
    border-bottom: 2px solid var(--color-ink-950);
    padding: 0.8rem 0.25rem;
    color: var(--color-ink-700);
    font-size: 1.05rem;
  }
  .token-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
  }
  .blank {
    display: inline-block;
    min-width: 3rem;
    border-bottom: 2px solid currentColor;
    text-align: center;
  }
  .listening-panel {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    margin-top: 1.6rem;
    border: 1px solid var(--color-line);
    border-radius: 0.7rem;
    background: var(--color-ink-950);
    padding: 1.4rem;
    color: white;
  }
  .audio-button {
    border: 1px solid rgb(255 255 255 / 0.45);
    background: var(--color-acid-500);
    color: var(--color-ink-950);
  }
  .listening-panel small {
    color: rgb(255 255 255 / 0.65);
  }
  .speech-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .speech-row span {
    color: var(--color-ink-700);
    font-size: 0.75rem;
    line-height: 1.4;
  }
  .microphone-button.listening {
    border-color: var(--color-coral-500);
    background: var(--color-coral-50);
  }
  .feedback {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.85rem;
    margin-top: 1.4rem;
    border: 1px solid var(--color-coral-500);
    border-radius: 0.65rem;
    background: var(--color-coral-50);
    padding: 1rem;
  }
  .feedback.correct {
    border-color: var(--color-mint-600);
    background: var(--color-mint-50);
  }
  .feedback-icon {
    display: grid;
    width: 2.35rem;
    height: 2.35rem;
    place-items: center;
    border-radius: 0.5rem;
    background: var(--color-paper-50);
  }
  .feedback strong {
    display: block;
  }
  .feedback p {
    margin: 0.25rem 0 0;
    line-height: 1.45;
  }
  .feedback small {
    display: block;
    margin-top: 0.55rem;
  }
  .assessment-control {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.65rem;
    color: var(--color-ink-700);
    font-size: 0.72rem;
  }
  .assessment-control button {
    flex: none;
    border: 0;
    color: var(--color-cobalt-700);
    background: transparent;
    padding: 0.35rem;
    font-weight: 800;
    text-decoration: underline;
    text-underline-offset: 0.18rem;
  }
  .runner-note {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 0.45rem;
    margin: 0;
    color: var(--color-ink-700);
    font-size: 0.75rem;
    line-height: 1.45;
    text-align: center;
  }
  .runner-note :global(svg) {
    flex: 0 0 auto;
    margin-top: 0.1rem;
  }
  .missing-state {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.8rem;
    margin-top: 1.5rem;
    border: 1px solid var(--color-coral-500);
    padding: 1rem;
  }
  .missing-state p {
    margin: 0.2rem 0 0;
    color: var(--color-ink-700);
  }
  .missing-state button {
    grid-column: 1 / -1;
    min-height: 2.8rem;
    border: 1px solid var(--color-ink-950);
    background: var(--color-ink-950);
    color: white;
  }
  .exit-ticket {
    display: grid;
    justify-items: center;
    gap: 1rem;
    margin-top: 1.5rem;
    text-align: center;
  }
  .exit-ticket fieldset {
    width: 100%;
    text-align: left;
  }
  .privacy-note {
    margin: 0;
    color: var(--color-ink-700);
    font-size: 0.76rem;
  }
  .inline-error,
  .save-error {
    color: var(--color-coral-700);
    font-weight: 700;
  }
  .lesson-complete,
  .today-error {
    display: grid;
    width: min(100% - 2rem, 42rem);
    min-height: calc(100dvh - 4.75rem);
    align-content: center;
    justify-items: center;
    margin: 0 auto;
    padding: 3rem 0;
    text-align: center;
  }
  .complete-mark {
    display: grid;
    width: 4.5rem;
    height: 4.5rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.8rem;
    background: var(--color-acid-500);
    box-shadow: 4px 4px 0 var(--color-ink-950);
  }
  .eyebrow {
    margin: 1.3rem 0 0;
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .lesson-complete h1,
  .today-error h1 {
    margin: 0.55rem 0 0;
    font-size: clamp(2.2rem, 7vw, 4rem);
  }
  .lesson-complete > p:not(.eyebrow),
  .today-error p {
    max-width: 36rem;
    color: var(--color-ink-700);
    line-height: 1.6;
  }
  .lesson-complete dl {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    width: 100%;
    margin: 1.2rem 0;
    border-block: 1px solid var(--color-line);
  }
  .lesson-complete dl div {
    padding: 1rem 0.5rem;
  }
  .lesson-complete dt {
    color: var(--color-ink-700);
    font-size: 0.72rem;
  }
  .lesson-complete dd {
    margin: 0.25rem 0 0;
    font-weight: 800;
  }
  .complete-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
  }
  .primary-link,
  .secondary-link,
  .today-error a {
    display: inline-flex;
    min-height: 3rem;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem;
    padding: 0.7rem 1rem;
    font-weight: 780;
  }
  .primary-link,
  .today-error a {
    background: var(--color-ink-950);
    color: white;
  }
  .secondary-link {
    background: var(--color-paper-50);
    color: var(--color-ink-950);
  }
  :global(svg.spin) {
    animation: spin 800ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (max-width: 560px) {
    .runner-header {
      grid-template-columns: 2.75rem minmax(0, 1fr);
      gap: 0.75rem;
    }
    .time-label {
      display: none;
    }
    .lesson-stage {
      width: min(100% - 1rem, 46rem);
      align-content: start;
      padding-top: 0.75rem;
    }
    .activity-card {
      border-radius: 0.65rem;
      padding: 1.1rem;
      box-shadow: 0 3px 0 var(--color-ink-950);
    }
    .choice-grid,
    .exit-ticket fieldset {
      grid-template-columns: 1fr;
    }
    .lesson-complete dl {
      grid-template-columns: 1fr;
    }
    .lesson-complete dl div + div {
      border-top: 1px solid var(--color-line);
    }
    .speech-row {
      align-items: flex-start;
      flex-direction: column;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(svg.spin) {
      animation: none;
    }
  }
</style>
