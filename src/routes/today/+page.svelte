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

  const field =
    'min-h-[3.2rem] w-full rounded-[0.65rem] border border-ink-950 bg-white px-[0.9rem] py-3 text-[1.05rem] text-ink-950';
  const fieldLabel = 'text-[0.78rem] font-[760] text-ink-700';
  const prompt =
    'mt-7 grid gap-[0.35rem] border-l-[0.3rem] border-acid-500 bg-paper-100 px-[1.1rem] py-4 [&>small]:text-ink-700 [&>span]:font-mono [&>span]:text-[0.7rem] [&>span]:text-ink-700 [&>span]:uppercase [&>strong]:text-[clamp(1.25rem,4vw,1.75rem)] [&>strong]:leading-[1.25]';
  const button =
    'inline-flex min-h-[2.9rem] items-center justify-center gap-[0.45rem] rounded-[0.65rem] border px-4 py-[0.68rem] font-[780]';
  const primaryButton = `${button} border-ink-950 bg-ink-950 text-white`;
  const wideButton = `${primaryButton} mt-4 w-full`;
  const hintButton = `${button} border-line bg-paper-50 text-ink-950`;
  const formActions = 'mt-1 flex flex-wrap justify-between gap-3';
  const hint =
    'mt-[0.85rem] mb-0 rounded-[0.55rem] border border-butter-400 bg-butter-50 p-3 leading-[1.45]';
  const toggle = (selected: boolean) => [
    'min-h-12 rounded-[0.55rem] border p-[0.65rem] font-[720]',
    selected
      ? 'border-cobalt-700 bg-cobalt-700 text-white'
      : 'border-line bg-paper-50 text-ink-950',
  ];
  const choiceGrid =
    'grid grid-cols-2 gap-[0.65rem] border-0 p-0 max-[561px]:grid-cols-1 [&>legend]:col-span-full [&>legend]:mb-[0.2rem] [&>legend]:text-[0.78rem] [&>legend]:font-[760] [&>legend]:text-ink-700';
  const errorText = 'font-bold text-coral-700';
  const centered =
    'mx-auto grid min-h-[calc(100dvh-4.75rem)] w-[min(100%-2rem,42rem)] content-center justify-items-center py-12 text-center';
  const centeredTitle =
    'mt-[0.55rem] mb-0 text-[clamp(2.2rem,7vw,4rem)] leading-[1.04] tracking-[-0.045em]';
  const centeredText = 'max-w-xl leading-[1.6] text-ink-700';
  const link =
    'inline-flex min-h-12 items-center gap-[0.45rem] rounded-[0.65rem] border border-ink-950 px-4 py-[0.7rem] font-[780]';
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
  <section class={centered} aria-labelledby="today-error-title">
    <CircleAlert size={28} aria-hidden="true" />
    <h1 class={centeredTitle} id="today-error-title">
      {copy('Lekci se nepodařilo otevřít', 'The lesson could not open')}
    </h1>
    <p class={centeredText}>{loadingError}</p>
    <a class="{link} bg-ink-950 text-white" href="/"
      >{copy('Zpět na přehled', 'Back to overview')}</a
    >
  </section>
{:else if session}
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
        aria-label={copy('Uložit a zavřít lekci', 'Save and close lesson')}
      >
        <X size={20} aria-hidden="true" />
      </button>
      <div class="min-w-0">
        <div class="mb-[0.35rem] flex justify-between gap-4 text-[0.75rem]">
          <strong>{copy('Dnešní lekce', "Today's lesson")}</strong>
          <span class="font-mono text-[0.72rem] text-ink-700"
            >{summary.completed}/{summary.total}</span
          >
        </div>
        <ProgressBar
          value={summary.percent}
          label={copy('Postup dnešní lekcí', "Today's lesson progress")}
        />
      </div>
      <span class="justify-self-end font-mono text-[0.72rem] text-ink-700 max-[561px]:hidden"
        >{session.plan.minutes} min</span
      >
    </header>

    {#if summary.finished}
      <section class={centered} aria-labelledby="lesson-complete-title">
        <span
          class="grid size-[4.5rem] place-items-center rounded-[0.8rem] border border-ink-950 bg-acid-500 shadow-[4px_4px_0_var(--color-ink-950)]"
          ><Check size={34} strokeWidth={2.6} aria-hidden="true" /></span
        >
        <p
          class="mt-[1.3rem] mb-0 font-mono text-[0.72rem] font-extrabold tracking-[0.1em] text-cobalt-700 uppercase"
        >
          {copy('Lekce uzavřena', 'Lesson complete')}
        </p>
        <h1 class={centeredTitle} id="lesson-complete-title">
          {copy('Dnes je hotovo.', 'You are done for today.')}
        </h1>
        <p class={centeredText}>
          {copy(
            `Prošla jsi ${summary.total} úloh. Další termíny opakování jsou uložené v tomto zařízení.`,
            `You completed ${summary.total} activities. Your next review dates are saved on this device.`,
          )}
        </p>
        <dl
          class="my-[1.2rem] grid w-full grid-cols-3 border-y border-line max-[561px]:grid-cols-1 [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:font-extrabold [&_dt]:text-[0.72rem] [&_dt]:text-ink-700 [&>div]:px-2 [&>div]:py-4 max-[561px]:[&>div+div]:border-t max-[561px]:[&>div+div]:border-line"
        >
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
        <div class="flex flex-wrap justify-center gap-3">
          <a class="{link} bg-ink-950 text-white" href="/"
            ><ArrowLeft size={18} aria-hidden="true" />{copy('Zpět na cestu', 'Back to path')}</a
          >
          <a class="{link} bg-paper-50 text-ink-950" href="/progress/"
            >{copy('Prohlédnout pokrok', 'View progress')}<ArrowRight
              size={18}
              aria-hidden="true"
            /></a
          >
        </div>
      </section>
    {:else if active}
      <section
        class="mx-auto grid min-h-[calc(100dvh-4.75rem)] w-[min(100%-2rem,46rem)] content-center gap-4 pt-8 pb-12 max-[561px]:w-[min(100%-1rem,46rem)] max-[561px]:content-start max-[561px]:pt-3"
        aria-label={copy('Aktivita dnešní lekce', "Today's lesson activity")}
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
            <span>{phaseLabel(active)}</span>
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

          {#if activityMissing}
            <div
              class="mt-6 grid grid-cols-[auto_1fr] gap-[0.8rem] border border-coral-500 p-4"
              role="status"
            >
              <CircleAlert size={24} aria-hidden="true" />
              <div>
                <strong
                  >{copy(
                    'Obsah se mezitím změnil.',
                    'This content changed in the meantime.',
                  )}</strong
                >
                <p class="mt-[0.2rem] text-ink-700">
                  {copy(
                    'Tenhle krok přeskočíme. Do výsledků se nezapočítá.',
                    'We’ll skip this step. It won’t count toward your results.',
                  )}
                </p>
              </div>
              <button
                class="col-span-full min-h-[2.8rem] border border-ink-950 bg-ink-950 text-white"
                type="button"
                onclick={skipMissingActivity}
                disabled={saving}>{copy('Pokračovat', 'Continue')}</button
              >
            </div>
          {:else if active.kind === 'review' && activeNote}
            <div class={prompt}>
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
                class="mt-[1.4rem] grid gap-[0.8rem]"
                onsubmit={(event) => {
                  event.preventDefault();
                  void submitReview();
                }}
              >
                {#if active.direction === 'cs-de' && activeNote.article}
                  <ArticlePicker bind:value={selectedArticle} disabled={saving} />
                {/if}
                <label class={fieldLabel} for="daily-answer"
                  >{active.direction === 'cs-de'
                    ? copy('Německá odpověď', 'German answer')
                    : copy('Význam', 'Meaning')}</label
                >
                <input
                  id="daily-answer"
                  class={field}
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
                <div class={formActions}>
                  <button
                    class={hintButton}
                    type="button"
                    onclick={showHint}
                    disabled={hintVisible || saving}
                    ><Lightbulb size={18} aria-hidden="true" />{copy('Nápověda', 'Hint')}</button
                  >
                  <button class={primaryButton} type="submit" disabled={!answer.trim() || saving}
                    >{#if saving}<LoaderCircle
                        class="animate-spin"
                        size={18}
                        aria-hidden="true"
                      />{/if}{copy('Zkontrolovat', 'Check')}</button
                  >
                </div>
              </form>
              {#if hintVisible}<p class={hint} role="status">
                  {copy('Začátek:', 'Starts with:')}
                  <strong
                    >{active.direction === 'cs-de'
                      ? `${activeNote.article ? `${activeNote.article} ` : ''}${activeNote.german.slice(0, 1)}…`
                      : `${noteMeaning(activeNote, $motherTongue).slice(0, 1)}…`}</strong
                  >
                </p>{/if}
            {/if}
          {:else if active.kind === 'grammar' && grammarQuestion}
            <div class={prompt}>
              <span>{grammarCopy?.formula}</span>
              <strong>{questionCopy?.prompt}</strong>
            </div>
            {#if !feedback}
              <form
                class="mt-[1.4rem] grid gap-[0.8rem]"
                onsubmit={(event) => {
                  event.preventDefault();
                  void submitGrammar();
                }}
              >
                {#if grammarQuestion.kind === 'choice'}
                  <fieldset class={choiceGrid}>
                    <legend>{copy('Vyber odpověď', 'Choose an answer')}</legend
                    >{#each grammarQuestion.options as option}<button
                        type="button"
                        class={toggle(selectedChoice === option)}
                        aria-pressed={selectedChoice === option}
                        onclick={() => (selectedChoice = option)}
                        >{grammarOptionCopy($motherTongue, option)}</button
                      >{/each}
                  </fieldset>
                {:else if grammarQuestion.kind === 'fill'}
                  <label class={fieldLabel} for="grammar-answer"
                    >{grammarQuestion.before}<span
                      class="inline-block min-w-12 border-b-2 border-current text-center">…</span
                    >{grammarQuestion.after}</label
                  >
                  <input
                    id="grammar-answer"
                    class={field}
                    bind:this={answerInput}
                    bind:value={answer}
                    placeholder={grammarQuestion.placeholder ?? ''}
                    autocomplete="off"
                    spellcheck="false"
                  />
                  <GermanKeyboard oninsert={insertGermanCharacter} />
                {:else}
                  <div
                    class="min-h-14 border-b-2 border-ink-950 px-1 py-[0.8rem] text-[1.05rem] text-ink-700"
                    aria-live="polite"
                  >
                    {orderedAnswer || copy('Věta se skládá tady', 'Your sentence appears here')}
                  </div>
                  <div
                    class="flex flex-wrap gap-[0.55rem]"
                    aria-label={copy('Slova k seřazení', 'Words to order')}
                  >
                    {#each grammarQuestion.tokens as token, index}<button
                        type="button"
                        class={toggle(selectedOrderIndexes.includes(index))}
                        aria-pressed={selectedOrderIndexes.includes(index)}
                        onclick={() => toggleOrderToken(index)}>{token}</button
                      >{/each}
                  </div>
                {/if}
                <div class={formActions}>
                  <button class={hintButton} type="button" onclick={showHint} disabled={hintVisible}
                    ><Lightbulb size={18} aria-hidden="true" />{copy('Nápověda', 'Hint')}</button
                  >
                  <button
                    class={primaryButton}
                    type="submit"
                    disabled={!grammarAnswerIsReady(grammarQuestion) || saving}
                    >{copy('Zkontrolovat', 'Check')}</button
                  >
                </div>
              </form>
              {#if hintVisible}<p class={hint} role="status">
                  {questionCopy?.hint ?? grammarCopy?.concept}
                </p>{/if}
            {/if}
          {:else if active.kind === 'listening'}
            <div
              class="mt-[1.6rem] grid justify-items-center gap-3 rounded-[0.7rem] border border-line bg-ink-950 p-[1.4rem] text-white"
            >
              <Headphones size={30} aria-hidden="true" />
              <button
                class="{button} border-white/45 bg-acid-500 text-ink-950"
                type="button"
                onclick={playListening}
                disabled={audioPlaying}
              >
                {#if audioPlaying}<LoaderCircle
                    class="animate-spin"
                    size={20}
                    aria-hidden="true"
                  />{:else}<Volume2 size={20} aria-hidden="true" />{/if}
                {audioPlays === 0
                  ? copy('Přehrát větu', 'Play sentence')
                  : copy('Přehrát znovu', 'Play again')}
              </button>
              <small class="text-white/65"
                >{audioSource === 'canonical'
                  ? copy('Nahrávka věty', 'Sentence recording')
                  : audioSource === 'system-voice'
                    ? copy('Systémový německý hlas', 'System German voice')
                    : copy('Bez zobrazeného textu', 'Text stays hidden')}</small
              >
            </div>
            {#if audioError}<p class={errorText} role="alert">{audioError}</p>{/if}
            {#if !feedback}
              <form
                class="mt-[1.4rem] grid gap-[0.8rem]"
                onsubmit={(event) => {
                  event.preventDefault();
                  submitListening();
                }}
              >
                <label class={fieldLabel} for="dictation-answer"
                  >{copy('Napiš, co slyšíš', 'Type what you hear')}</label
                >
                <input
                  id="dictation-answer"
                  class={field}
                  bind:this={answerInput}
                  bind:value={answer}
                  autocomplete="off"
                  autocapitalize="none"
                  spellcheck="false"
                />
                <GermanKeyboard oninsert={insertGermanCharacter} />
                <div class={formActions}>
                  <button class={hintButton} type="button" onclick={showHint} disabled={hintVisible}
                    ><Lightbulb size={18} aria-hidden="true" />{copy('Význam', 'Meaning')}</button
                  >
                  <button class={primaryButton} type="submit" disabled={!answer.trim()}
                    >{copy('Zkontrolovat', 'Check')}</button
                  >
                </div>
              </form>
              {#if hintVisible}<p class={hint} role="status">{active.translation}</p>{/if}
            {/if}
          {:else if active.kind === 'transfer' && transferScenario}
            <div class={prompt}>
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
              <div class="mt-[1.4rem] grid gap-[0.8rem]">
                <label class={fieldLabel} for="transfer-answer"
                  >{copy('Tvoje německá replika', 'Your German reply')}</label
                >
                <textarea
                  id="transfer-answer"
                  class="{field} min-h-[6.5rem] resize-y"
                  bind:this={answerInput}
                  bind:value={answer}
                  rows="3"
                  spellcheck="false"
                  disabled={saving}></textarea>
                <div class="flex items-center gap-3 max-[561px]:flex-col max-[561px]:items-start">
                  <button
                    class={[
                      button,
                      microphoneListening
                        ? 'border-coral-500 bg-coral-50 text-ink-950'
                        : 'border-line bg-paper-50 text-ink-950',
                    ]}
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
                  <span class="text-[0.75rem] leading-[1.4] text-ink-700"
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
                {#if speechError}<p class={errorText} role="alert">{speechError}</p>{/if}
                <GermanKeyboard oninsert={insertGermanCharacter} />
                {#if !feedback}
                  <div class={formActions}>
                    <button
                      class={hintButton}
                      type="button"
                      onclick={showHint}
                      disabled={hintVisible}
                      ><Lightbulb size={18} aria-hidden="true" />{copy('Vzor', 'Starter')}</button
                    >
                    <button
                      class={primaryButton}
                      type="button"
                      onclick={() => void submitTransferTurn()}
                      disabled={!answer.trim() || saving}
                    >
                      {#if saving}<LoaderCircle
                          class="animate-spin"
                          size={18}
                          aria-hidden="true"
                        />{/if}
                      {copy('Odeslat repliku', 'Submit reply')}
                    </button>
                  </div>
                {/if}
              </div>
              {#if hintVisible}<p class={hint} role="status" lang="de">{active.starter}</p>{/if}
            {/if}
          {:else if active.kind === 'exit-ticket'}
            <div class="mt-6 grid justify-items-center gap-4 text-center">
              <Brain size={30} aria-hidden="true" />
              <p>{active.prompt}</p>
              <fieldset class="{choiceGrid} w-full text-left">
                <legend>{copy('Volitelně označ jednu oblast', 'Optionally choose one area')}</legend
                >{#each [copy('Slovíčka', 'Words'), copy('Gramatika', 'Grammar'), copy('Poslech', 'Listening'), copy('Mluvení', 'Speaking')] as option}<button
                    type="button"
                    class={toggle(exitChoice === option)}
                    aria-pressed={exitChoice === option}
                    onclick={() => (exitChoice = option)}>{option}</button
                  >{/each}
              </fieldset>
              <p class="m-0 text-[0.76rem] text-ink-700">
                {copy('Odpověď se nikam neposílá.', 'Your answer isn’t sent anywhere.')}
              </p>
              <button
                class={wideButton}
                type="button"
                onclick={finishCurrentActivity}
                disabled={saving}
                >{#if saving}<LoaderCircle
                    class="animate-spin"
                    size={18}
                    aria-hidden="true"
                  />{/if}{copy('Dokončit dnešek', 'Finish today')}</button
              >
            </div>
          {/if}

          {#if feedback}
            <div
              class={[
                'mt-[1.4rem] grid grid-cols-[auto_minmax(0,1fr)] gap-[0.85rem] rounded-[0.65rem] border p-4',
                feedback.correct ? 'border-mint-600 bg-mint-50' : 'border-coral-500 bg-coral-50',
              ]}
              role="status"
              aria-live="polite"
            >
              <span class="grid size-[2.35rem] place-items-center rounded-lg bg-paper-50"
                >{#if feedback.correct}<Check size={22} aria-hidden="true" />{:else}<RotateCcw
                    size={21}
                    aria-hidden="true"
                  />{/if}</span
              >
              <div>
                <strong class="block">{feedback.title}</strong>
                <p class="mt-1 mb-0 leading-[1.45]">{feedback.message}</p>
                {#if feedback.expected}<small class="mt-[0.55rem] block"
                    >{copy('Správně:', 'Expected:')} <b lang="de">{feedback.expected}</b></small
                  >{/if}
              </div>
            </div>
            {#if active.kind === 'transfer' && transferConversation.complete && latestTransferDiagnostics.length > 0}
              <div
                class="mt-[0.65rem] flex items-center justify-between gap-3 text-[0.72rem] text-ink-700"
              >
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
                <button
                  class="flex-none border-0 bg-transparent p-[0.35rem] font-extrabold text-cobalt-700 underline underline-offset-[0.18rem]"
                  type="button"
                  onclick={toggleTransferAssessment}
                >
                  {transferDiagnosticsIgnored
                    ? copy('Vrátit hodnocení', 'Restore assessment')
                    : copy('Hodnocení nesedí', 'This assessment is off')}
                </button>
              </div>
            {/if}
            {#if active.kind === 'transfer' && !pendingEvidence}
              <button class={wideButton} type="button" onclick={retryTransfer}
                >{feedback.correct
                  ? copy('Další replika', 'Next reply')
                  : copy('Upravit odpověď', 'Edit answer')}<ArrowRight
                  size={18}
                  aria-hidden="true"
                /></button
              >
            {:else}
              <button
                class={wideButton}
                type="button"
                onclick={finishCurrentActivity}
                disabled={saving}
                >{#if saving}<LoaderCircle
                    class="animate-spin"
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

          {#if loadingError}<p class={errorText} role="alert">{loadingError}</p>{/if}
        </section>
        <p
          class="m-0 flex items-start justify-center gap-[0.45rem] text-center text-[0.75rem] leading-[1.45] text-ink-700"
        >
          <Sparkles class="mt-[0.1rem] flex-none" size={16} aria-hidden="true" />{active.phase ===
          'repair'
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
