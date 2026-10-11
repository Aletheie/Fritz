<script lang="ts">
  import { evaluateSentence, getAiKeyStatus, requestExplanation } from '$lib/client/ai.ts';
  import {
    speechRecognitionSupported,
    startGermanSpeechRecognition,
  } from '$lib/client/speech-recognition.ts';
  import {
    clearLongTermSession,
    loadLongTermSession,
    saveLongTermSession,
  } from '$lib/client/study-session.ts';
  import ArticlePicker from '$lib/components/ArticlePicker.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import AdaptiveHint from '$lib/components/study/AdaptiveHint.svelte';
  import FlashcardReveal from '$lib/components/study/FlashcardReveal.svelte';
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import LongTermSetup from '$lib/components/study/LongTermSetup.svelte';
  import MemoryPlanPanel from '$lib/components/study/MemoryPlanPanel.svelte';
  import PairMatchingBoard from '$lib/components/study/PairMatchingBoard.svelte';
  import PronunciationFeedback from '$lib/components/study/PronunciationFeedback.svelte';
  import SessionComplete from '$lib/components/study/SessionComplete.svelte';
  import { answerZone, labIndex, speakButton } from '$lib/components/study/study-styles.ts';
  import StudyChoiceGrid from '$lib/components/study/StudyChoiceGrid.svelte';
  import StudyFeedback from '$lib/components/study/StudyFeedback.svelte';
  import StudySessionHeader from '$lib/components/study/StudySessionHeader.svelte';
  import StudySetup from '$lib/components/study/StudySetup.svelte';
  import WordOrderBoard from '$lib/components/study/WordOrderBoard.svelte';
  import {
    buildClozeExercise,
    buildWordOrderExercise,
    gradeContextAnswer,
    gradeWordOrder,
    wordOrderAnswer,
  } from '$lib/domain/exercises/context.ts';
  import { buildVocabularyMatchingExercise } from '$lib/domain/exercises/matching.ts';
  import { masteryTier } from '$lib/domain/gamification.ts';
  import {
    gradeChoiceAnswer,
    gradeGermanAnswer,
    signalForFlashcard,
  } from '$lib/domain/grading/grade.ts';
  import { normalizeText, parseGermanAnswer } from '$lib/domain/grading/normalize.ts';
  import {
    chooseNextCramCard,
    cramProgress,
    createCramSession,
    recordCramReview,
  } from '$lib/domain/scheduler/cram.ts';
  import { isMatureFsrsCard, previewSchedule } from '$lib/domain/scheduler/fsrs.ts';
  import {
    buildChoiceOptions,
    chooseAdaptiveExercise,
    filterCardsForTraining,
    filterCardsByTag,
    selectDueCardsForTraining,
    selectDistinctNoteCards,
  } from '$lib/domain/scheduler/queue.ts';
  import {
    chooseNextLongTermCard,
    createLongTermSessionDraft,
    reconcileLongTermSessionCards,
    recordLongTermSessionReview,
  } from '$lib/domain/scheduler/session.ts';
  import { DEFAULT_EXERCISE_PREFERENCES } from '$lib/domain/settings/defaults.ts';
  import { isCountedReview, remainingDailyNewCards } from '$lib/domain/stats/learning.ts';
  import { displayGerman, displayPlural } from '$lib/domain/vocabulary/display.ts';
  import { sortedVocabularyTags } from '$lib/domain/vocabulary/tags.ts';
  import { localized } from '$lib/i18n';
  import { noteMeaning } from '$lib/i18n/vocabulary.ts';
  import { appStore, dailyProgress, gameProgress, motherTongue } from '$lib/state/app';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Brain from '@lucide/svelte/icons/brain';
  import Check from '@lucide/svelte/icons/check';
  import Eye from '@lucide/svelte/icons/eye';
  import Keyboard from '@lucide/svelte/icons/keyboard';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import Link2 from '@lucide/svelte/icons/link-2';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Mic from '@lucide/svelte/icons/mic';
  import MicOff from '@lucide/svelte/icons/mic-off';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import { onDestroy, onMount, tick } from 'svelte';

  import type { SpeechRecognitionHandle } from '$lib/client/speech-recognition.ts';
  import type { AiExplanationResult, AiSentenceEvaluationResult } from '$lib/domain/ai/types.ts';
  import type {
    ClozeExercise,
    WordOrderExercise,
    WordOrderToken,
  } from '$lib/domain/exercises/context.ts';
  import type { VocabularyMatchingExercise } from '$lib/domain/exercises/matching.ts';
  import type { CramSessionState } from '$lib/domain/scheduler/cram.ts';
  import type { SchedulePreviewOption } from '$lib/domain/scheduler/fsrs.ts';
  import type { LongTermSessionDraft } from '$lib/domain/scheduler/session.ts';
  import type { StudyResult } from '$lib/domain/study/types.ts';
  import type {
    Article,
    ExerciseKind,
    Note,
    RatingKey,
    ReviewDisputeReason,
    ReviewLog,
    StudyCard,
    StudyMode,
    TrainingSourceFilter,
  } from '$lib/domain/types.ts';

  let mode: StudyMode = 'long-term';
  let autoStartCram = false;
  let autoStartLongTerm = false;
  let distinctNoteSession = false;
  let initialized = false;
  let queue: StudyCard[] = [];
  let currentIndex = 0;
  let sessionTarget = 0;
  let sessionCompleted = 0;
  let currentCard: StudyCard | undefined;
  let currentNote: Note | undefined;
  let exercise: ExerciseKind = 'typing';
  let exerciseReason = '';
  let choices: Note[] = [];
  let answer = '';
  let selectedArticle: Article | undefined;
  let revealed = false;
  let result: StudyResult | undefined;
  let startedAt = 0;
  let reviewing = false;
  let completed = false;
  let errorMessage = '';
  let inputElement: HTMLInputElement | HTMLTextAreaElement | undefined;
  let correction = '';
  let correctionArticle: Article | undefined;
  let sessionReviews = 0;
  let sessionSuccesses = 0;
  let sessionXp = 0;
  let sessionCombo = 0;
  let sessionBestCombo = 0;
  let sessionStartLevel = 1;
  let sessionStartCompletedMissions = 0;
  let sessionStartGoalReached = false;
  let cramSession: CramSessionState | undefined;
  let cramConfigured = true;
  let longTermConfigured = false;
  let cramDuration = 20;
  let sessionSize = 10;
  let selectedTag = 'all';
  let selectedSourceFilter: TrainingSourceFilter = 'all';
  let waitMs = 0;
  let waitTimer: number | undefined;
  let activeLongTermSession: LongTermSessionDraft | undefined;
  let resumableSession: LongTermSessionDraft | undefined;
  let remainingDueCount = 0;
  let hintVisible = false;
  let hintsUsed = 0;
  let aiAvailable = false;
  let aiBusy = false;
  let aiExplanation: AiExplanationResult | undefined;
  let aiExplanationError = '';
  let explanationController: AbortController | undefined;
  let sentenceController: AbortController | undefined;
  let submittedForExplanation = '';
  let wordOrderExercise: WordOrderExercise | undefined;
  let selectedWordTokens: WordOrderToken[] = [];
  let clozeExercise: ClozeExercise | undefined;
  let matchingExercise: VocabularyMatchingExercise | undefined;
  let matchingMistakes = 0;
  let matchingComplete = false;
  let speechAvailable = false;
  let listening = false;
  let speechError = '';
  /** Raw recognition output, kept for pronunciation feedback even if the learner edits it. */
  let spokenTranscript = '';
  let spokenConfidence: number | undefined;
  let speechHandle: SpeechRecognitionHandle | undefined;
  let speechRun = 0;
  let scheduleOptions: SchedulePreviewOption[] = [];
  let nextPlannedAt: string | undefined;
  let lastSavedReviewId: string | undefined;
  let disputingReview = false;

  const currentAttempt = 1;

  $: availableTags = sortedVocabularyTags($appStore.notes, 'cs');
  $: currentMeaning = currentNote ? noteMeaning(currentNote, $motherTongue) : '';
  $: selectedCramCount = cardsForCram(selectedTag, $appStore.cards, $appStore.notes).length;
  $: dailyNewAllowance = remainingDailyNewCards(
    $appStore.recentReviews,
    $appStore.settings?.dailyNewLimit ?? 15,
    new Date(),
  );
  $: longTermTagOptions = [
    {
      value: 'all',
      count: longTermDueCount(
        'all',
        $appStore.cards,
        $appStore.notes,
        dailyNewAllowance,
        selectedSourceFilter,
      ),
    },
    ...availableTags.map((tag) => ({
      value: tag,
      count: longTermDueCount(
        tag,
        $appStore.cards,
        $appStore.notes,
        dailyNewAllowance,
        selectedSourceFilter,
      ),
    })),
  ];
  $: selectedLongTermCount = longTermDueCount(
    selectedTag,
    $appStore.cards,
    $appStore.notes,
    dailyNewAllowance,
    selectedSourceFilter,
  );
  $: resumeSummary = resumableSession
    ? {
        remaining: resumableSession.remainingCardIds.length,
        total: resumableSession.cardIds.length,
        selectedTag: resumableSession.selectedTag,
        updatedAt: resumableSession.updatedAt,
        sourceFilter: resumableSession.sourceFilter,
      }
    : undefined;
  $: correctionWordReady = currentNote
    ? normalizeText(parseGermanAnswer(correction).word) === normalizeText(currentNote.german)
    : false;
  $: correctionReady =
    !$appStore.settings?.requireCorrection ||
    (correctionWordReady && (!currentNote?.article || correctionArticle === currentNote.article));
  $: sprintProgress = cramSession
    ? cramProgress(cramSession)
    : { mastered: 0, total: 0, percent: 0 };
  $: longTermProgress =
    sessionTarget === 0 ? 0 : Math.round((sessionCompleted / sessionTarget) * 100);
  $: progress = mode === 'cram' ? sprintProgress.percent : longTermProgress;
  $: selectedWordIds = new Set(selectedWordTokens.map((token) => token.id));
  $: wordOrderReady = Boolean(
    wordOrderExercise && selectedWordTokens.length === wordOrderExercise.tokens.length,
  );
  $: activeSchedule = result?.schedulePreview ?? scheduleOptions;
  $: encounterCount = currentNote
    ? $appStore.recentReviews.filter(
        (review) => isCountedReview(review) && review.noteId === currentNote?.id,
      ).length + 1
    : 0;
  $: currentMastery = currentCard ? masteryCopy(masteryTier(currentCard)) : '';

  onMount(async () => {
    speechAvailable = speechRecognitionSupported();
    const parameters = new URLSearchParams(window.location.search);
    mode = parameters.get('mode') === 'cram' ? 'cram' : 'long-term';
    const parsedMinutes = Number(parameters.get('minutes') ?? 20);
    cramDuration = Number.isFinite(parsedMinutes) ? Math.min(180, Math.max(5, parsedMinutes)) : 20;
    const requestedSize = parameters.get('size');
    const parsedSize = Number(requestedSize ?? 10);
    sessionSize = [5, 10, 20, 30].includes(parsedSize) ? parsedSize : 10;
    autoStartCram = parameters.get('start') === '1';
    autoStartLongTerm = mode === 'long-term' && parameters.get('start') === '1';
    distinctNoteSession = parameters.get('distinct') === '1';
    selectedTag = parameters.get('tag') || 'all';
    cramConfigured = mode !== 'cram' || autoStartCram;

    await appStore.initialize();
    if (requestedSize === null) sessionSize = $appStore.settings?.dailyMinutes ?? 10;
    selectedSourceFilter = parseSourceFilter(
      parameters.get('source'),
      $appStore.settings?.trainingSourceFilter ?? 'all',
    );
    try {
      // Demo responses work without a key, so any status answer means AI tools are usable.
      await getAiKeyStatus();
      aiAvailable = true;
    } catch {
      aiAvailable = false;
    }
    if (selectedTag !== 'all' && !availableTags.includes(selectedTag)) selectedTag = 'all';
    resumableSession = loadLongTermSession();
    if (resumableSession) {
      const remaining = reconcileLongTermSessionCards(
        resumableSession,
        $appStore.cards,
        new Date(),
      );
      if (remaining.length === 0) {
        clearLongTermSession();
        resumableSession = undefined;
      } else if (
        remaining.length !== resumableSession.remainingCardIds.length ||
        (resumableSession.selectedTag !== 'all' &&
          !availableTags.includes(resumableSession.selectedTag))
      ) {
        resumableSession = {
          ...resumableSession,
          selectedTag: availableTags.includes(resumableSession.selectedTag)
            ? resumableSession.selectedTag
            : 'all',
          remainingCardIds: remaining.map((card) => card.id),
          updatedAt: new Date().toISOString(),
        };
        saveLongTermSession(resumableSession);
      }
    }
    initialized = true;
    if (mode === 'long-term' && parameters.get('resume') === '1' && resumableSession) {
      resumeLongTermSession();
    } else if (autoStartLongTerm || autoStartCram) {
      startSession();
    }
  });

  onDestroy(() => {
    if (mode === 'long-term' && activeLongTermSession) {
      saveLongTermSession(activeLongTermSession);
    }
    clearWaitTimer();
    explanationController?.abort();
    sentenceController?.abort();
    stopSpeechRecognition(true);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window)
      window.speechSynthesis.cancel();
  });

  function cardsForCram(
    currentTag = selectedTag,
    cards = $appStore.cards,
    notes = $appStore.notes,
  ): StudyCard[] {
    return filterCardsByTag(cards, notes, currentTag);
  }

  function longTermDueCards(
    currentTag: string,
    limit: number,
    cards = $appStore.cards,
    notes = $appStore.notes,
    newLimit = dailyNewAllowance,
    now = new Date(),
    sourceFilter = selectedSourceFilter,
  ): StudyCard[] {
    return selectDueCardsForTraining(
      cards,
      notes,
      { tag: currentTag, source: sourceFilter },
      now,
      limit,
      newLimit,
    );
  }

  function longTermDueCount(
    currentTag: string,
    cards = $appStore.cards,
    notes = $appStore.notes,
    newLimit = dailyNewAllowance,
    sourceFilter = selectedSourceFilter,
  ): number {
    return longTermDueCards(
      currentTag,
      cards.length,
      cards,
      notes,
      newLimit,
      new Date(),
      sourceFilter,
    ).length;
  }

  function earliestFutureDue(): string | undefined {
    const now = Date.now();
    const relevantCards =
      mode === 'long-term'
        ? filterCardsForTraining($appStore.cards, $appStore.notes, {
            tag: selectedTag,
            source: selectedSourceFilter,
          })
        : $appStore.cards;
    let earliest: string | undefined;
    let earliestTime = Number.POSITIVE_INFINITY;
    for (const card of relevantCards) {
      const dueAt = Date.parse(card.dueAt);
      if (dueAt > now && dueAt < earliestTime) {
        earliest = card.dueAt;
        earliestTime = dueAt;
      }
    }
    return earliest;
  }

  function clearWaitTimer(): void {
    if (waitTimer !== undefined) window.clearInterval(waitTimer);
    waitTimer = undefined;
  }

  function beginWait(milliseconds: number, onReady: () => void): void {
    clearWaitTimer();
    waitMs = Math.max(0, milliseconds);
    currentCard = undefined;
    currentNote = undefined;
    const target = Date.now() + waitMs;
    waitTimer = window.setInterval(() => {
      waitMs = Math.max(0, target - Date.now());
      if (waitMs <= 0) {
        clearWaitTimer();
        onReady();
      }
    }, 250);
  }

  function completeSession(nextDueAt?: string): void {
    clearWaitTimer();
    if (mode === 'long-term') {
      const newLimit = remainingDailyNewCards(
        $appStore.recentReviews,
        $appStore.settings?.dailyNewLimit ?? 15,
        new Date(),
      );
      const remaining = longTermDueCards(
        selectedTag,
        $appStore.cards.length,
        $appStore.cards,
        $appStore.notes,
        newLimit,
      );
      remainingDueCount = remaining.length;
      nextDueAt = nextDueAt ?? remaining[0]?.dueAt;
      activeLongTermSession = undefined;
      resumableSession = undefined;
      clearLongTermSession();
    }
    completed = true;
    waitMs = 0;
    nextPlannedAt = nextDueAt ?? earliestFutureDue();
    currentCard = undefined;
    currentNote = undefined;
  }

  function startSession(): void {
    clearWaitTimer();
    explanationController?.abort();
    sentenceController?.abort();
    completed = false;
    currentIndex = 0;
    sessionTarget = 0;
    sessionCompleted = 0;
    sessionReviews = 0;
    sessionSuccesses = 0;
    sessionXp = 0;
    sessionCombo = 0;
    sessionBestCombo = 0;
    sessionStartLevel = $gameProgress.level.level;
    sessionStartCompletedMissions = $gameProgress.missionSummary.completed;
    sessionStartGoalReached = $dailyProgress.reached;
    errorMessage = '';
    waitMs = 0;
    nextPlannedAt = undefined;
    remainingDueCount = 0;

    if (mode === 'long-term') {
      clearLongTermSession();
      resumableSession = undefined;
      queue = distinctNoteSession
        ? selectDistinctNoteCards(
            longTermDueCards(selectedTag, $appStore.cards.length),
            sessionSize,
          )
        : longTermDueCards(selectedTag, sessionSize);
      if (queue.length === 0) {
        longTermConfigured = false;
        errorMessage = copy(
          'V tomto výběru teď není nic k opakování.',
          'No words are due for this filter right now.',
        );
        return;
      }
      activeLongTermSession = createLongTermSessionDraft(
        queue,
        selectedTag,
        sessionSize,
        new Date(),
        selectedSourceFilter,
      );
      saveLongTermSession(activeLongTermSession);
      sessionTarget = queue.length;
      longTermConfigured = true;
      loadNextLongTermCard();
      return;
    }

    queue = distinctNoteSession
      ? selectDistinctNoteCards(cardsForCram(), 60)
      : cardsForCram().slice(0, 60);
    if (queue.length === 0) {
      cramConfigured = false;
      errorMessage = copy(
        'Pro tento výběr nejsou žádná slovíčka.',
        'There are no words in this selection.',
      );
      return;
    }
    cramSession = createCramSession(queue, cramDuration, new Date());
    loadNextCramCard();
  }

  function startConfiguredLongTerm(): void {
    if (selectedLongTermCount === 0) return;
    longTermConfigured = true;
    startSession();
  }

  function resumeLongTermSession(): void {
    const draft = resumableSession ?? loadLongTermSession();
    if (!draft) {
      longTermConfigured = false;
      return;
    }

    const remaining = reconcileLongTermSessionCards(draft, $appStore.cards, new Date());
    if (remaining.length === 0) {
      clearLongTermSession();
      resumableSession = undefined;
      longTermConfigured = false;
      return;
    }

    clearWaitTimer();
    selectedTag = draft.selectedTag;
    selectedSourceFilter = draft.sourceFilter;
    sessionSize = draft.requestedSize;
    queue = remaining;
    currentIndex = 0;
    sessionTarget = draft.cardIds.length;
    sessionCompleted = Math.max(0, draft.cardIds.length - remaining.length);
    sessionReviews = draft.reviews;
    sessionSuccesses = draft.successes;
    sessionXp = draft.xp;
    sessionCombo = draft.combo;
    sessionBestCombo = draft.bestCombo;
    sessionStartLevel = $gameProgress.level.level;
    sessionStartCompletedMissions = $gameProgress.missionSummary.completed;
    sessionStartGoalReached = $dailyProgress.reached;
    completed = false;
    errorMessage = '';
    waitMs = 0;
    nextPlannedAt = undefined;
    remainingDueCount = 0;
    activeLongTermSession = {
      ...draft,
      remainingCardIds: remaining.map((card) => card.id),
      updatedAt: new Date().toISOString(),
    };
    resumableSession = undefined;
    longTermConfigured = true;
    saveLongTermSession(activeLongTermSession);
    loadNextLongTermCard();
  }

  function resetLongTermSetup(): void {
    clearWaitTimer();
    completed = false;
    longTermConfigured = false;
    currentCard = undefined;
    currentNote = undefined;
    activeLongTermSession = undefined;
    errorMessage = '';
  }

  function parseSourceFilter(
    value: string | null,
    fallback: TrainingSourceFilter,
  ): TrainingSourceFilter {
    return value === 'all' || value === 'own' || value === 'course' || value === 'without-course'
      ? value
      : fallback;
  }

  function changeSourceFilter(value: TrainingSourceFilter): void {
    selectedSourceFilter = value;
    if ($appStore.settings?.trainingSourceFilter === value) return;
    void appStore.updateSettings({ trainingSourceFilter: value }).catch(() => {
      errorMessage = copy(
        'Volbu zdroje se nepodařilo uložit. Pro tuto relaci ale zůstává aktivní.',
        'The source filter could not be saved, but it remains active for this session.',
      );
    });
  }

  function pauseSession(): void {
    if (mode === 'long-term' && activeLongTermSession) {
      saveLongTermSession(activeLongTermSession);
    }
  }

  function startConfiguredCram(): void {
    if (selectedCramCount === 0) return;
    cramConfigured = true;
    startSession();
  }

  function resetCramSetup(): void {
    clearWaitTimer();
    cramConfigured = false;
    completed = false;
    currentCard = undefined;
    currentNote = undefined;
    cramSession = undefined;
    errorMessage = '';
  }

  function safeSchedulePreview(card: StudyCard, now = new Date()): SchedulePreviewOption[] {
    if (mode !== 'long-term') return [];
    try {
      return previewSchedule(card, $appStore.settings?.desiredRetention ?? 0.9, now);
    } catch {
      return [];
    }
  }

  function setCurrentCard(card: StudyCard): void {
    clearWaitTimer();
    explanationController?.abort();
    sentenceController?.abort();
    stopSpeechRecognition(true);
    currentCard = card;
    currentNote = $appStore.notes.find((note) => note.id === card.noteId);
    if (!currentNote) {
      errorMessage = copy('Ke kartě chybí slovíčko.', 'The word for this card is missing.');
      completeSession();
      return;
    }

    const decision = chooseAdaptiveExercise({
      card,
      note: currentNote,
      notes: $appStore.notes,
      reviews: $appStore.recentReviews,
      preferences: $appStore.settings?.exercisePreferences ?? DEFAULT_EXERCISE_PREFERENCES,
      sessionIndex: sessionReviews,
      aiAvailable,
      language: $motherTongue,
    });
    exercise = decision.kind;
    exerciseReason = decision.reason;
    choices =
      exercise === 'choice'
        ? buildChoiceOptions(currentNote, $appStore.notes, 4, sessionReviews)
        : [];
    wordOrderExercise =
      exercise === 'word-order'
        ? buildWordOrderExercise(currentNote, sessionReviews, $motherTongue)
        : undefined;
    clozeExercise =
      exercise === 'cloze'
        ? buildClozeExercise(currentNote, sessionReviews, $motherTongue)
        : undefined;
    matchingExercise =
      exercise === 'matching'
        ? buildVocabularyMatchingExercise(
            currentNote,
            $appStore.notes,
            4,
            sessionReviews,
            $motherTongue,
          )
        : undefined;

    if (exercise === 'choice' && choices.length < 2) exercise = 'typing';
    if (exercise === 'word-order' && !wordOrderExercise) exercise = 'typing';
    if (exercise === 'sentence' && !aiAvailable) exercise = 'typing';
    if (exercise === 'matching' && !matchingExercise) exercise = 'typing';

    answer = '';
    selectedArticle = undefined;
    selectedWordTokens = [];
    matchingMistakes = 0;
    matchingComplete = false;
    speechError =
      exercise === 'speaking' && !speechAvailable
        ? copy(
            'Rozpoznání řeči tu není dostupné. Odpověď můžeš napsat ručně.',
            'Speech recognition is not available here. You can type the answer instead.',
          )
        : '';
    revealed = false;
    result = undefined;
    lastSavedReviewId = undefined;
    disputingReview = false;
    correction = '';
    correctionArticle = undefined;
    hintVisible = false;
    hintsUsed = 0;
    spokenTranscript = '';
    spokenConfidence = undefined;
    aiExplanation = undefined;
    aiExplanationError = '';
    submittedForExplanation = '';
    scheduleOptions = safeSchedulePreview(card);
    startedAt = performance.now();
    waitMs = 0;

    if (
      exercise === 'typing' ||
      exercise === 'cloze' ||
      exercise === 'sentence' ||
      exercise === 'speaking'
    ) {
      void tick().then(() => inputElement?.focus());
    }
  }

  function loadNextLongTermCard(): void {
    const next = chooseNextLongTermCard(queue, currentIndex, new Date());
    if (next.complete || next.index === undefined) {
      completeSession();
      return;
    }
    if (next.waitMs > 0) {
      const dueAt = queue[next.index]?.dueAt;
      completeSession(dueAt);
      return;
    }
    if (next.index !== currentIndex) {
      [queue[currentIndex], queue[next.index]] = [queue[next.index], queue[currentIndex]];
      queue = [...queue];
    }
    setCurrentCard(queue[currentIndex]);
  }

  function loadNextCramCard(): void {
    if (!cramSession) return;
    if (Date.now() >= new Date(cramSession.endsAt).getTime()) {
      completeSession();
      return;
    }
    const next = chooseNextCramCard(cramSession, new Date());
    if (next.complete || !next.cardId) {
      completeSession();
      return;
    }
    if (next.waitMs > 0) {
      beginWait(next.waitMs, loadNextCramCard);
      return;
    }
    const card = queue.find((candidate) => candidate.id === next.cardId);
    if (!card) {
      errorMessage = copy(
        'Jednu kartičku se nepodařilo najít. Zkus procvičování spustit znovu.',
        'A card could not be found. Try restarting the practice session.',
      );
      completeSession();
      return;
    }
    setCurrentCard(card);
  }

  function responseTime(): number {
    return Math.max(0, Math.round(performance.now() - startedAt));
  }

  async function saveResult(
    nextResult: Omit<StudyResult, 'xp'>,
  ): Promise<{ card: StudyCard; log: ReviewLog } | undefined> {
    if (!currentCard || !currentNote || reviewing) return undefined;
    const reviewedCard = currentCard;
    const reviewedNote = currentNote;
    const reviewedAt = new Date();
    const previewForCard = safeSchedulePreview(reviewedCard, reviewedAt);
    reviewing = true;
    errorMessage = '';
    try {
      const saved = await appStore.review({
        card: reviewedCard,
        note: reviewedNote,
        mode,
        rating: nextResult.rating,
        signal: nextResult.signal,
        now: reviewedAt,
      });
      const xp = saved.log.xpAwarded ?? 0;
      lastSavedReviewId = saved.log.id;
      result = {
        ...nextResult,
        xp,
        scheduledFor: mode === 'long-term' ? saved.card.dueAt : undefined,
        schedulePreview: mode === 'long-term' ? previewForCard : undefined,
      };
      sessionReviews += 1;
      sessionXp += xp;
      if (nextResult.rating !== 'again') sessionSuccesses += 1;
      const cleanAnswer =
        nextResult.correct && nextResult.signal.hintsUsed === 0 && nextResult.signal.attempt === 1;
      sessionCombo = cleanAnswer ? sessionCombo + 1 : 0;
      sessionBestCombo = Math.max(sessionBestCombo, sessionCombo);

      if (mode === 'long-term') {
        if (activeLongTermSession) {
          activeLongTermSession = {
            ...recordLongTermSessionReview(
              activeLongTermSession,
              reviewedCard.id,
              nextResult.rating !== 'again',
              xp,
              reviewedAt,
            ),
            combo: sessionCombo,
            bestCombo: sessionBestCombo,
          };
          sessionCompleted = Math.min(
            sessionTarget,
            sessionTarget - activeLongTermSession.remainingCardIds.length,
          );
          saveLongTermSession(activeLongTermSession);
        }
      } else if (cramSession) {
        cramSession = recordCramReview(cramSession, reviewedCard.id, nextResult.rating, new Date());
      }

      if (nextResult.correct && $appStore.settings?.autoSpeakGerman) {
        window.setTimeout(() => speak(reviewedNote), 100);
      }
      return saved;
    } catch (error) {
      result = undefined;
      errorMessage =
        $motherTongue === 'cs' && error instanceof Error
          ? error.message
          : copy('Výsledek se nepodařilo uložit.', 'The result could not be saved.');
      return undefined;
    } finally {
      reviewing = false;
    }
  }

  async function disputeSavedReview(reason: ReviewDisputeReason): Promise<void> {
    if (
      !lastSavedReviewId ||
      !result ||
      result.disputed ||
      disputingReview ||
      (reason === 'ai-too-strict' && !result.aiSentenceEvaluation)
    )
      return;
    const previous = result;
    disputingReview = true;
    errorMessage = '';
    try {
      await appStore.disputeReview(lastSavedReviewId, reason);
      const restoredCard = currentCard
        ? $appStore.cards.find((card) => card.id === currentCard?.id)
        : undefined;
      sessionXp = Math.max(0, sessionXp - previous.xp);
      if (previous.rating !== 'again') sessionSuccesses = Math.max(0, sessionSuccesses - 1);
      sessionReviews = Math.max(0, sessionReviews - 1);
      sessionCombo = 0;
      if (mode === 'long-term' && restoredCard) {
        const shouldRetry = reason === 'ai-too-strict';
        if (shouldRetry) queue = [...queue, restoredCard];
        if (activeLongTermSession) {
          const remainingCardIds =
            shouldRetry && !activeLongTermSession.remainingCardIds.includes(restoredCard.id)
              ? [...activeLongTermSession.remainingCardIds, restoredCard.id]
              : activeLongTermSession.remainingCardIds;
          activeLongTermSession = {
            ...activeLongTermSession,
            remainingCardIds,
            reviews: Math.max(0, activeLongTermSession.reviews - 1),
            successes: Math.max(
              0,
              activeLongTermSession.successes - (previous.rating === 'again' ? 0 : 1),
            ),
            xp: Math.max(0, activeLongTermSession.xp - previous.xp),
            combo: 0,
            updatedAt: new Date().toISOString(),
          };
          if (shouldRetry) {
            sessionCompleted = Math.min(sessionTarget, sessionTarget - remainingCardIds.length);
          }
          saveLongTermSession(activeLongTermSession);
        }
      }
      result = {
        ...previous,
        disputed: true,
        disputeReason: reason,
        xp: 0,
        scheduledFor: undefined,
        message:
          reason === 'content-error'
            ? copy(
                'Položka je označená ke kontrole a tahle odpověď se nepočítá do učení ani XP.',
                'The item is flagged for review, and this answer does not count toward learning or XP.',
              )
            : copy(
                'Hodnocení je vyřazené z učení i XP. Původní termín karty byl obnoven.',
                'This result won’t affect learning or XP. The card’s previous review date has been restored.',
              ),
      };
    } catch (error) {
      errorMessage =
        $motherTongue === 'cs' && error instanceof Error
          ? error.message
          : copy('Reklamaci se nepodařilo uložit.', 'The dispute could not be saved.');
    } finally {
      disputingReview = false;
    }
  }

  async function submitTyping(): Promise<void> {
    if (!currentNote || !currentCard || !answer.trim() || result || reviewing) return;
    submittedForExplanation = answer;
    const graded = gradeGermanAnswer({
      expectedGerman: currentNote.german,
      acceptedGerman: currentNote.acceptedGerman,
      expectedArticle: currentNote.article,
      selectedArticle,
      submittedText: answer,
      responseMs: responseTime(),
      hintsUsed,
      attempt: currentAttempt,
      allowKeyboardFallback: $appStore.settings?.allowKeyboardFallback ?? true,
      isMatureCard: isMatureFsrsCard(currentCard),
    });
    await saveResult(
      $motherTongue === 'en'
        ? {
            ...graded,
            message: graded.correct
              ? 'Correct.'
              : graded.nearCorrect
                ? `Almost. The exact German answer is “${graded.expectedDisplay}”.`
                : `The correct German answer is “${graded.expectedDisplay}”.`,
          }
        : graded,
    );
  }

  function stopSpeechRecognition(cancel = false): void {
    const activeHandle = speechHandle;
    if (!activeHandle) {
      listening = false;
      return;
    }
    if (cancel) {
      speechRun += 1;
      speechHandle = undefined;
      listening = false;
      activeHandle.abort();
    } else {
      activeHandle.stop();
    }
  }

  function toggleSpeechRecognition(): void {
    if (listening) {
      stopSpeechRecognition();
      return;
    }
    if (result || reviewing) return;
    speechError = '';
    const run = ++speechRun;
    const handle = startGermanSpeechRecognition(
      {
        onstart: () => {
          if (run === speechRun) listening = true;
        },
        ontranscript: (transcript, final, confidence) => {
          if (run !== speechRun || !transcript) return;
          answer = transcript;
          if (final) {
            spokenTranscript = transcript;
            spokenConfidence = confidence;
          }
        },
        onerror: (message, code) => {
          if (run !== speechRun || code === 'aborted') return;
          speechError = message;
        },
        onend: () => {
          if (run !== speechRun) return;
          listening = false;
          speechHandle = undefined;
          void tick().then(() => inputElement?.focus());
        },
      },
      $motherTongue,
    );
    speechHandle = handle;
  }

  async function submitSpeaking(): Promise<void> {
    if (!currentNote || !currentCard || !answer.trim() || result || reviewing) return;
    stopSpeechRecognition(true);
    submittedForExplanation = answer;
    const graded = gradeGermanAnswer({
      expectedGerman: currentNote.german,
      acceptedGerman: currentNote.acceptedGerman,
      expectedArticle: currentNote.article,
      submittedText: answer,
      responseMs: responseTime(),
      hintsUsed: 0,
      attempt: currentAttempt,
      allowKeyboardFallback: $appStore.settings?.allowKeyboardFallback ?? true,
      isMatureCard: isMatureFsrsCard(currentCard),
    });
    await saveResult({
      ...graded,
      message: graded.correct
        ? copy('Přepis je správně.', 'The transcript is correct.')
        : $motherTongue === 'en'
          ? `The correct German answer is “${graded.expectedDisplay}”.`
          : graded.message,
      signal: { ...graded.signal, exercise: 'speaking' },
    });
  }

  async function submitMatching(mistakes = matchingMistakes): Promise<void> {
    if (!currentNote || !matchingExercise || result || reviewing) return;
    matchingMistakes = mistakes;
    matchingComplete = true;
    const saved = await saveResult({
      rating: mistakes === 0 ? 'good' : 'hard',
      correct: true,
      nearCorrect: mistakes > 0,
      message:
        mistakes === 0
          ? copy(
              'Všechny dvojice propojené na první pokus.',
              'Every pair matched on the first try.',
            )
          : copy(
              `Všechny dvojice jsou spojené. Počet chybných pokusů: ${mistakes}.`,
              `All pairs matched. Incorrect attempts: ${mistakes}.`,
            ),
      expectedDisplay: displayGerman(currentNote),
      signal: {
        exercise: 'matching',
        submittedText: copy(
          `${matchingExercise.pairs.length} propojené dvojice`,
          `${matchingExercise.pairs.length} matched pairs`,
        ),
        normalizedText: matchingExercise.pairs.map((pair) => pair.id).join(' '),
        expectedText: displayGerman(currentNote),
        wordCorrect: true,
        articleCorrect: true,
        exact: mistakes === 0,
        keyboardEquivalent: false,
        editDistance: mistakes,
        responseMs: responseTime(),
        hintsUsed: mistakes,
        attempt: currentAttempt,
      },
    });
    if (!saved)
      errorMessage ||= copy(
        'Výsledek párování se nepodařilo uložit.',
        'The matching result could not be saved.',
      );
  }

  async function choose(option: Note): Promise<void> {
    if (!currentNote || result || reviewing) return;
    const selectedDisplay = displayGerman(option);
    const expectedDisplay = displayGerman(currentNote);
    submittedForExplanation = selectedDisplay;
    const graded = gradeChoiceAnswer({
      selected: option.id,
      expected: currentNote.id,
      responseMs: responseTime(),
    });
    await saveResult({
      ...graded,
      expectedDisplay,
      message: graded.correct
        ? copy('Správná volba.', 'Correct choice.')
        : copy(
            `Vybrala jsi „${selectedDisplay}“. Správně je „${expectedDisplay}“.`,
            `You chose “${selectedDisplay}”. The correct answer is “${expectedDisplay}”.`,
          ),
    });
  }

  function selectWordToken(token: WordOrderToken): void {
    if (result || selectedWordIds.has(token.id)) return;
    selectedWordTokens = [...selectedWordTokens, token];
  }

  function removeWordToken(token: WordOrderToken): void {
    if (result) return;
    selectedWordTokens = selectedWordTokens.filter((candidate) => candidate.id !== token.id);
  }

  function clearWordOrder(): void {
    if (!result) selectedWordTokens = [];
  }

  async function submitWordOrder(): Promise<void> {
    if (!wordOrderExercise || !wordOrderReady || result || reviewing) return;
    const graded = gradeWordOrder(selectedWordTokens, wordOrderExercise);
    const submitted = wordOrderAnswer(selectedWordTokens);
    submittedForExplanation = submitted;
    await saveResult({
      rating: graded.rating,
      correct: graded.correct,
      nearCorrect: false,
      message: graded.correct
        ? copy('Slovosled sedí.', 'The word order is correct.')
        : copy(
            `Správné pořadí je „${wordOrderExercise.sourceText}“.`,
            `The correct order is “${wordOrderExercise.sourceText}”.`,
          ),
      expectedDisplay: wordOrderExercise.sourceText,
      signal: {
        exercise: 'word-order',
        submittedText: submitted,
        normalizedText: normalizeText(submitted),
        expectedText: wordOrderExercise.sourceText,
        wordCorrect: graded.correct,
        articleCorrect: true,
        exact: graded.exact,
        keyboardEquivalent: false,
        editDistance: graded.editDistance,
        responseMs: responseTime(),
        hintsUsed: 0,
        attempt: currentAttempt,
      },
    });
  }

  async function submitCloze(): Promise<void> {
    if (!clozeExercise || !answer.trim() || result || reviewing) return;
    const graded = gradeContextAnswer({
      submitted: answer,
      accepted: clozeExercise.acceptedAnswers,
      allowKeyboardFallback: $appStore.settings?.allowKeyboardFallback ?? true,
    });
    const acceptedAsCorrect = graded.exact || graded.keyboardEquivalent;
    submittedForExplanation = answer;
    await saveResult({
      rating: graded.rating,
      correct: acceptedAsCorrect,
      nearCorrect: graded.nearCorrect,
      message: graded.exact
        ? copy('Výraz do kontextu sedí.', 'The expression fits the context.')
        : graded.keyboardEquivalent
          ? copy(
              `Význam sedí. Přesný zápis je „${clozeExercise.answer}“.`,
              `The meaning is right. The exact spelling is “${clozeExercise.answer}”.`,
            )
          : graded.nearCorrect
            ? copy(
                `Téměř. Správně je „${clozeExercise.answer}“.`,
                `Almost. The correct answer is “${clozeExercise.answer}”.`,
              )
            : copy(
                `Do mezery patří „${clozeExercise.answer}“.`,
                `The gap needs “${clozeExercise.answer}”.`,
              ),
      expectedDisplay: clozeExercise.answer,
      signal: {
        exercise: 'cloze',
        submittedText: answer,
        normalizedText: normalizeText(answer),
        expectedText: clozeExercise.answer,
        wordCorrect: acceptedAsCorrect,
        articleCorrect: true,
        exact: graded.exact,
        keyboardEquivalent: graded.keyboardEquivalent,
        editDistance: graded.editDistance,
        responseMs: responseTime(),
        hintsUsed: 0,
        attempt: currentAttempt,
      },
    });
  }

  function sentenceRating(evaluation: AiSentenceEvaluationResult): RatingKey {
    if (!evaluation.accepted || !evaluation.targetUsedCorrectly) return 'again';
    const score = (evaluation.grammarScore + evaluation.naturalnessScore) / 2;
    return score >= 85 ? 'good' : 'hard';
  }

  async function submitSentence(): Promise<void> {
    if (!currentNote || !answer.trim() || result || reviewing || aiBusy) return;
    sentenceController?.abort();
    sentenceController = new AbortController();
    aiBusy = true;
    errorMessage = '';
    try {
      const evaluation = await evaluateSentence(
        {
          motherTongue: $motherTongue,
          german: currentNote.german,
          czech: currentMeaning,
          kind: currentNote.kind,
          article: currentNote.article,
          plural: currentNote.plural,
          verbForms: currentNote.verbForms,
          sentence: answer.trim(),
        },
        sentenceController.signal,
      );
      const rating = sentenceRating(evaluation);
      const score = Math.round((evaluation.grammarScore + evaluation.naturalnessScore) / 2);
      await saveResult({
        rating,
        correct: rating !== 'again',
        nearCorrect: rating === 'hard',
        message: evaluation.feedback,
        expectedDisplay: displayGerman(currentNote),
        aiSentenceEvaluation: evaluation,
        signal: {
          exercise: 'sentence',
          submittedText: answer.trim(),
          normalizedText: normalizeText(answer),
          expectedText: displayGerman(currentNote),
          wordCorrect: evaluation.targetUsedCorrectly,
          articleCorrect: evaluation.targetUsedCorrectly,
          exact:
            evaluation.accepted &&
            evaluation.targetUsedCorrectly &&
            evaluation.grammarScore >= 95 &&
            evaluation.naturalnessScore >= 90,
          keyboardEquivalent: false,
          editDistance: 0,
          responseMs: responseTime(),
          hintsUsed: 0,
          attempt: currentAttempt,
          aiAccepted: evaluation.accepted,
          aiScore: score,
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      errorMessage =
        $motherTongue === 'cs' && error instanceof Error
          ? error.message
          : copy('Větu se nepodařilo vyhodnotit.', 'The sentence could not be evaluated.');
    } finally {
      aiBusy = false;
    }
  }

  async function rateFlashcard(rating: RatingKey): Promise<void> {
    if (!currentNote || !currentCard || reviewing) return;
    const saved = await saveResult({
      rating,
      correct: rating !== 'again',
      message: '',
      expectedDisplay: displayGerman(currentNote),
      signal: signalForFlashcard(rating, responseTime()),
    });
    if (saved) await advance();
  }

  async function advance(): Promise<void> {
    if (reviewing) return;
    if (mode === 'long-term') {
      currentIndex += 1;
      loadNextLongTermCard();
      return;
    }
    loadNextCramCard();
  }

  function speak(note: Note | undefined = currentNote): void {
    if (!note || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(displayGerman(note));
    utterance.lang = 'de-DE';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  function revealHint(): void {
    if (hintVisible || result || !currentNote) return;
    hintVisible = true;
    hintsUsed += 1;
  }

  function hintText(note: Note): string {
    const characters = Array.from(note.german.replace(/\s+/gu, ''));
    const first = Array.from(note.german.trim())[0] ?? '';
    const words = note.german.trim().split(/\s+/u).length;
    return words > 1
      ? copy(
          `Začíná na „${first}“ a má ${words} slova.`,
          `It starts with “${first}” and has ${words} words.`,
        )
      : copy(
          `Začíná na „${first}“ a má ${characters.length} písmen.`,
          `It starts with “${first}” and has ${characters.length} letters.`,
        );
  }

  async function insertGermanCharacter(character: string): Promise<void> {
    if (!inputElement || result) return;
    const start = inputElement.selectionStart ?? answer.length;
    const end = inputElement.selectionEnd ?? start;
    answer = `${answer.slice(0, start)}${character}${answer.slice(end)}`;
    await tick();
    inputElement.focus();
    inputElement.setSelectionRange(start + character.length, start + character.length);
  }

  async function explainMistake(): Promise<void> {
    if (!currentNote || !result || result.correct || aiBusy || !aiAvailable) return;
    explanationController?.abort();
    explanationController = new AbortController();
    aiBusy = true;
    aiExplanation = undefined;
    aiExplanationError = '';
    try {
      aiExplanation = await requestExplanation(
        {
          motherTongue: $motherTongue,
          german: currentNote.german,
          czech: currentMeaning,
          article: currentNote.article,
          kind: currentNote.kind,
          submitted: submittedForExplanation,
          selectedArticle: result.signal.selectedArticle,
          wordCorrect: result.signal.wordCorrect,
          articleCorrect: result.signal.articleCorrect,
          keyboardEquivalent: result.signal.keyboardEquivalent,
          editDistance: result.signal.editDistance,
          learningNote: $motherTongue === 'cs' ? currentNote.learningNote : undefined,
        },
        explanationController.signal,
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      aiExplanationError =
        $motherTongue === 'cs' && error instanceof Error
          ? error.message
          : copy('Vysvětlení se nepodařilo načíst.', 'The explanation could not be loaded.');
    } finally {
      aiBusy = false;
    }
  }

  function formatWait(milliseconds: number): string {
    const seconds = Math.ceil(milliseconds / 1_000);
    return seconds < 60
      ? `${seconds} s`
      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function nextAllowed(): boolean {
    if (!result) return false;
    return (
      result.disputed ||
      result.correct ||
      (exercise !== 'typing' && exercise !== 'speaking') ||
      correctionReady
    );
  }

  function masteryCopy(tier: ReturnType<typeof masteryTier>): string {
    const labels = {
      new: { cs: 'Nové', en: 'New' },
      learning: { cs: 'Rozpracované', en: 'Learning' },
      familiar: { cs: 'Známé', en: 'Familiar' },
      strong: { cs: 'Pevné', en: 'Strong' },
      mastered: { cs: 'Zvládnuté', en: 'Mastered' },
    } as const;
    return localized($motherTongue, labels[tier]);
  }

  function exerciseLabel(kind: ExerciseKind): string {
    const labels: Record<ExerciseKind, { cs: string; en: string }> = {
      typing: { cs: 'aktivní vybavení', en: 'active recall' },
      choice: { cs: 'rychlé rozpoznání', en: 'quick recognition' },
      flashcard: { cs: 'vlastní hodnocení', en: 'self-rating' },
      'word-order': { cs: 'skládání vět', en: 'word-order lab' },
      cloze: { cs: 'doplnění slova', en: 'context gap' },
      sentence: { cs: 'vlastní věta s AI', en: 'your own sentence with AI' },
      matching: { cs: 'slovní spojovačka', en: 'word matching' },
      speaking: { cs: 'mluvení nahlas', en: 'speaking aloud' },
    };
    return localized($motherTongue, labels[kind]);
  }

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (completed || reviewing || !currentCard || !currentNote) return;

    if (exercise === 'sentence' && (event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!result) void submitSentence();
      else if (nextAllowed()) void advance();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (
      (exercise === 'typing' || exercise === 'cloze' || exercise === 'speaking') &&
      event.key === 'Enter'
    ) {
      if (exercise === 'speaking' && event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      if (!result) {
        if (exercise === 'typing') void submitTyping();
        else if (exercise === 'cloze') void submitCloze();
        else if (!listening) void submitSpeaking();
      } else if (nextAllowed()) void advance();
      return;
    }

    if (exercise === 'word-order' && event.key === 'Enter') {
      event.preventDefault();
      if (!result && wordOrderReady) void submitWordOrder();
      else if (result && nextAllowed()) void advance();
      return;
    }

    if (exercise === 'choice' && !result && ['1', '2', '3', '4'].includes(event.key)) {
      const option = choices[Number(event.key) - 1];
      if (option) void choose(option);
      return;
    }

    if (exercise === 'flashcard') {
      if (!revealed && event.code === 'Space') {
        event.preventDefault();
        revealed = true;
        return;
      }
      if (revealed && ['1', '2', '3', '4'].includes(event.key)) {
        const ratings: RatingKey[] = ['again', 'hard', 'good', 'easy'];
        void rateFlashcard(ratings[Number(event.key) - 1]);
      }
    }
  }

  const scrollShell =
    'h-full overflow-y-auto overscroll-contain px-[0.8rem] pt-[max(0.8rem,var(--safe-top))] pb-[max(1.5rem,var(--safe-bottom))] short-desktop:pb-[max(1.25rem,var(--safe-bottom))]';
  const promptBase =
    'mt-[clamp(2.4rem,7vw,4.6rem)] text-center max-[900px]:mt-[clamp(1.35rem,7dvh,3rem)] max-[521px]:mt-[clamp(1rem,5dvh,2rem)]';
  const promptSecondary = 'mt-[2.7rem] text-center max-[900px]:mt-[clamp(1.15rem,5dvh,2.25rem)]';
  const promptTitle =
    'mt-[0.45rem] text-[clamp(2.35rem,8vw,5.5rem)] leading-[0.9] font-black tracking-[-0.04em] text-balance max-[521px]:text-[clamp(2.05rem,12vw,3.65rem)] max-[521px]:leading-[0.92]';
  const contextTitle =
    'mt-[0.45rem] text-[clamp(1.85rem,5vw,3.6rem)] leading-[0.98] font-black tracking-[-0.04em] text-balance max-[521px]:text-[clamp(1.65rem,8vw,2.65rem)]';
  const targetTitle =
    'mt-[0.45rem] text-[clamp(2.3rem,7vw,4.8rem)] leading-[0.94] font-black tracking-[-0.04em] text-balance max-[521px]:text-[clamp(2rem,10vw,3.35rem)]';
  const promptNote = 'mt-[0.7rem] text-[0.84rem] font-bold text-ink-600';
  const fieldLabel =
    'mb-2 block font-mono text-[0.7rem] font-extrabold tracking-[0.055em] text-ink-600 uppercase';
  const submitButton = 'btn-base btn-primary mt-5 w-full max-[521px]:mt-3 max-[521px]:min-h-12';
  const answerField = (state: boolean | undefined) => [
    'mt-0 min-h-[4.3rem] w-full rounded-[0.25rem] border-2 bg-white px-4 py-[0.9rem] text-[1.25rem] font-[780] text-ink-950 [transition:border-color_150ms_var(--ease-out-emil),box-shadow_150ms_var(--ease-out-emil),transform_150ms_var(--ease-out-emil)] focus:outline-0 max-[521px]:min-h-[3.55rem] max-[521px]:px-[0.8rem] max-[521px]:py-[0.7rem] max-[521px]:text-[1.05rem]',
    state === true
      ? 'border-mint-700 shadow-[4px_4px_0_var(--color-mint-200)]'
      : state === false
        ? 'border-coral-700 shadow-[4px_4px_0_var(--color-coral-200)]'
        : 'border-ink-950 shadow-[4px_4px_0_var(--color-line)] focus:border-cobalt-700 focus:shadow-[4px_4px_0_var(--color-cobalt-300)] max-[521px]:shadow-[3px_3px_0_var(--color-line)]',
  ];
  const resultState = (value: StudyResult | undefined) => (value ? value.correct : undefined);
</script>

<svelte:head>
  <title
    >{mode === 'cram'
      ? copy('Sprint na test', 'Test sprint')
      : copy('Procvičování slovíček', 'Vocabulary practice')} – Fritz</title
  >
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

{#if !initialized || !$appStore.ready || !$appStore.settings}
  <div class={scrollShell}>
    <LoadingState label={copy('Připravuji slovíčka…', 'Preparing your vocabulary…')} />
  </div>
{:else if mode === 'long-term' && !longTermConfigured}
  <div class={scrollShell}>
    <LongTermSetup
      bind:selectedTag
      bind:sessionSize
      sourceFilter={selectedSourceFilter}
      tags={longTermTagOptions}
      dueCount={selectedLongTermCount}
      resume={resumeSummary}
      onsourcechange={changeSourceFilter}
      onstart={startConfiguredLongTerm}
      onresume={resumeLongTermSession}
    />
  </div>
{:else if mode === 'cram' && !cramConfigured}
  <div class={scrollShell}>
    <StudySetup
      bind:duration={cramDuration}
      bind:selectedTag
      tags={availableTags}
      cardCount={selectedCramCount}
      onstart={startConfiguredCram}
    />
  </div>
{:else if completed}
  <div class={scrollShell}>
    <SessionComplete
      {mode}
      reviews={sessionReviews}
      successes={sessionSuccesses}
      xp={$appStore.settings.gamificationEnabled ? sessionXp : 0}
      streak={$gameProgress.streak}
      goalReached={$dailyProgress.reached}
      goalNewlyReached={$dailyProgress.reached && !sessionStartGoalReached}
      level={$gameProgress.level}
      missionSummary={$gameProgress.missionSummary}
      rival={$appStore.settings.rivalryEnabled ? $gameProgress.rival : undefined}
      leveledUp={$gameProgress.level.level > sessionStartLevel}
      newMissions={Math.max(
        0,
        $gameProgress.missionSummary.completed - sessionStartCompletedMissions,
      )}
      bestCombo={sessionBestCombo}
      celebrations={$appStore.settings.gamificationEnabled && $appStore.settings.celebrations}
      gamificationEnabled={$appStore.settings.gamificationEnabled}
      nextDueAt={nextPlannedAt}
      {remainingDueCount}
      onsetup={mode === 'cram' ? resetCramSetup : resetLongTermSetup}
    />
  </div>
{:else}
  <div
    class="mx-auto max-w-[72rem] max-[900px]:grid max-[900px]:h-full max-[900px]:min-h-0 max-[900px]:w-full max-[900px]:max-w-none max-[900px]:grid-rows-[auto_minmax(0,1fr)] max-[900px]:overflow-hidden max-[900px]:bg-paper-50 min-[900px]:px-4 min-[900px]:pt-[clamp(1rem,3vh,2rem)] min-[900px]:pb-10"
  >
    <StudySessionHeader
      sprint={mode === 'cram'}
      {progress}
      done={mode === 'cram' ? sprintProgress.mastered : sessionCompleted}
      total={mode === 'cram' ? sprintProgress.total : sessionTarget}
      scope={selectedTag === 'all' ? copy('všechny skupiny', 'all groups') : selectedTag}
      pace={mode === 'long-term' ? copy('pevná dávka', 'fixed batch') : `${cramDuration} min`}
      xp={sessionXp}
      onpause={pauseSession}
    />

    {#if waitMs > 0}
      <section
        class="mt-5 grid min-h-[30rem] grid-cols-[auto_minmax(0,1fr)] items-center gap-6 rounded-[0.25rem] border border-ink-950 bg-paper-50 p-[clamp(1.5rem,5vw,4rem)] shadow-[7px_7px_0_var(--color-ink-950)] max-[900px]:mt-0 max-[900px]:h-full max-[900px]:min-h-0 max-[900px]:overflow-y-auto max-[900px]:rounded-none max-[900px]:border-0 max-[900px]:shadow-none"
      >
        <div
          class="[transform:rotate(180deg)] font-mono text-[clamp(2rem,8vw,5rem)] leading-none font-black text-cobalt-700 [writing-mode:vertical-rl]"
        >
          {formatWait(waitMs)}
        </div>
        <div>
          <p class={labIndex}>learning step / {copy('krátká mezera', 'short gap')}</p>
          <h1
            class="mt-2 max-w-xl text-[clamp(2rem,6vw,4.6rem)] leading-[0.92] font-black tracking-[-0.04em]"
          >
            {copy('Za chvíli to zkusíš znovu', 'Try again in a moment')}
          </h1>
          <p class="mt-4 max-w-[34rem] leading-[1.65] text-ink-600">
            {copy(
              'Slovíčko si zopakuješ za chvíli. Teď si můžeš dát krátkou pauzu.',
              'You’ll review this word in a moment. Take a short break for now.',
            )}
          </p>
          {#if mode === 'cram'}
            <button class="btn-base btn-secondary mt-6" type="button" onclick={resetCramSetup}
              ><ArrowLeft size={18} /> {copy('Změnit sprint', 'Change sprint')}</button
            >
          {/if}
        </div>
      </section>
    {:else if currentNote && currentCard}
      {@const feedbackShown = Boolean(result && exercise !== 'flashcard')}
      <div
        class="mt-5 grid gap-4 max-[900px]:mt-0 max-[900px]:h-full max-[900px]:min-h-0 max-[900px]:gap-0 max-[900px]:overflow-hidden min-[900px]:grid-cols-[minmax(0,1fr)_18rem] min-[900px]:gap-[1.35rem]"
      >
        <section
          class="relative overflow-hidden rounded-[0.35rem_1.5rem_0.35rem_0.35rem] border border-ink-950 bg-paper-50 shadow-[7px_7px_0_var(--color-ink-950)] max-[900px]:h-full max-[900px]:min-h-0 max-[900px]:rounded-none max-[900px]:border-0 max-[900px]:shadow-none"
        >
          <div
            class="absolute inset-y-0 left-0 w-[2.55rem] border-r border-coral-500 bg-[repeating-linear-gradient(to_bottom,transparent_0_27px,rgb(25_31_36/0.08)_27px_28px)] max-[900px]:w-[2.1rem] max-[521px]:w-[1.9rem]"
            aria-hidden="true"
          >
            <span
              class="sticky top-4 block pt-4 text-center font-mono text-[0.68rem] font-extrabold text-coral-700"
              >{String(sessionReviews + 1).padStart(2, '0')}</span
            >
          </div>
          <div
            class={[
              'min-h-[34rem] pt-[1.3rem] pr-5 pb-[1.6rem] pl-[3.7rem] max-[900px]:h-full max-[900px]:min-h-0 max-[900px]:[scrollbar-width:none] max-[900px]:overflow-y-auto max-[900px]:overscroll-contain max-[900px]:pt-[0.85rem] max-[900px]:pr-[0.8rem] max-[900px]:pl-[2.85rem] max-[521px]:pt-[0.7rem] max-[521px]:pr-[0.7rem] max-[521px]:pl-[2.55rem] min-[640px]:pt-[1.7rem] min-[640px]:pr-8 min-[640px]:pb-8 min-[640px]:pl-[4.6rem] [&::-webkit-scrollbar]:max-[900px]:hidden',
              feedbackShown
                ? 'max-[900px]:pb-[min(52dvh,26rem)]'
                : 'max-[900px]:pb-[calc(1rem+env(safe-area-inset-bottom))] max-[521px]:pb-[calc(0.8rem+env(safe-area-inset-bottom))]',
            ]}
          >
            <div
              class="flex flex-wrap items-center justify-between gap-3 max-[900px]:gap-[0.45rem] max-[521px]:flex-nowrap"
            >
              <span
                class="inline-flex items-center gap-[0.42rem] rounded-full border border-ink-950 bg-acid-100 px-[0.68rem] py-[0.43rem] text-[0.66rem] font-[850] tracking-[0.055em] text-ink-950 uppercase max-[900px]:px-[0.55rem] max-[900px]:py-[0.35rem] max-[900px]:text-[0.59rem] max-[521px]:max-w-[43%] max-[521px]:flex-none max-[521px]:truncate"
              >
                {#if exercise === 'typing'}<Keyboard size={14} />
                {:else if exercise === 'choice'}<Check size={14} />
                {:else if exercise === 'flashcard'}<Eye size={14} />
                {:else if exercise === 'sentence'}<Sparkles size={14} />
                {:else if exercise === 'matching'}<Link2 size={14} />
                {:else if exercise === 'speaking'}<Mic size={14} />
                {:else}<Brain size={14} />{/if}
                {exerciseLabel(exercise)}
              </span>
              <div
                class="flex flex-wrap items-center justify-end gap-[0.35rem] max-[900px]:gap-1 max-[521px]:min-w-0 max-[521px]:flex-nowrap max-[521px]:overflow-x-auto [&>span]:rounded-full [&>span]:border [&>span]:px-2 [&>span]:py-[0.32rem] [&>span]:font-mono [&>span]:text-[0.62rem] [&>span]:font-extrabold [&>span]:whitespace-nowrap max-[900px]:[&>span]:px-[0.42rem] max-[900px]:[&>span]:py-[0.28rem] max-[900px]:[&>span]:text-[0.56rem]"
                aria-label={copy(
                  'Stav procvičovaného výrazu',
                  'Practice status for this expression',
                )}
              >
                <span class="border-line bg-paper-100 text-ink-600"
                  >{encounterCount}. {copy('setkání', 'encounter')}</span
                >
                <span class="border-line bg-paper-100 text-ink-600">{currentMastery}</span>
                {#if currentNote.cefr}<span class="border-cobalt-300 bg-cobalt-50 text-cobalt-700"
                    >{currentNote.cefr}</span
                  >{/if}
              </div>
            </div>

            {#if $appStore.settings.showStudyTips}
              <p
                class="mt-3 max-w-[42rem] text-[0.77rem] leading-[1.45] text-ink-600 max-[521px]:hidden"
              >
                {$motherTongue === 'en'
                  ? 'This activity practises what you find difficult about this word.'
                  : exerciseReason}
              </p>
            {/if}

            {#if exercise === 'speaking'}
              <div class={promptSecondary}>
                <p class={labIndex}>
                  {copy(
                    'řekni německy · u podstatného jména i se členem',
                    'say it in German · include the article for nouns',
                  )}
                </p>
                <h1 class={contextTitle}>{currentMeaning}</h1>
                <p class={promptNote}>
                  {speechAvailable
                    ? copy(
                        'Promluv, pak si před odesláním zkontroluj přepis.',
                        'Speak, then check the transcript before submitting.',
                      )
                    : copy(
                        'Mikrofon tu není dostupný, ale stejnou odpověď můžeš napsat.',
                        'The microphone is unavailable, but you can type the same answer.',
                      )}
                </p>
              </div>
            {:else if exercise === 'matching'}
              <div class={promptSecondary}>
                <p class={labIndex}>
                  {copy(
                    'česky vlevo · německy vpravo',
                    'meanings on the left · German on the right',
                  )}
                </p>
                <h1 class={contextTitle}>{copy('Spoj dvojice', 'Match the word pairs')}</h1>
                <p class={promptNote}>
                  {copy(
                    'Ke každému významu najdi německý výraz.',
                    'Match each meaning with its German expression.',
                  )}
                </p>
              </div>
            {:else if exercise === 'sentence'}
              <div class={promptSecondary}>
                <p class={labIndex}>
                  {copy('použij v přirozené německé větě', 'use it in a natural German sentence')}
                </p>
                <div class="flex items-center justify-center gap-[0.8rem]">
                  <h1 class={targetTitle} lang="de">{displayGerman(currentNote)}</h1>
                  <button
                    class={speakButton}
                    type="button"
                    aria-label={copy('Přehrát německou výslovnost', 'Play German pronunciation')}
                    onclick={() => speak()}><Volume2 size={18} /></button
                  >
                </div>
                <p class="mt-[0.7rem] text-[0.9rem] font-bold text-ink-600">{currentMeaning}</p>
              </div>
            {:else if exercise === 'word-order' && wordOrderExercise}
              <div class={promptBase}>
                <p class={labIndex}>
                  {copy('poskládej německý slovosled', 'build the German word order')}
                </p>
                <h1 class={contextTitle}>{wordOrderExercise.translation ?? currentMeaning}</h1>
              </div>
            {:else if exercise === 'cloze' && clozeExercise}
              <div class={promptBase}>
                <p class={labIndex}>{clozeExercise.label}</p>
                <h1 class={contextTitle}>{clozeExercise.translation ?? currentMeaning}</h1>
              </div>
            {:else}
              <div class={promptBase}>
                <p class={labIndex}>
                  {copy('česky / vybav si německy', 'meaning / recall the German')}
                </p>
                <h1 class={promptTitle}>{currentMeaning}</h1>
                {#if currentNote.tags.length > 0}<p
                    class="mt-[0.95rem] font-mono text-[0.68rem] font-bold text-ink-600"
                  >
                    {currentNote.tags.slice(0, 3).join(' · ')}
                  </p>{/if}
              </div>
            {/if}

            {#if exercise === 'typing'}
              <form
                class={answerZone}
                onsubmit={(event) => {
                  event.preventDefault();
                  void submitTyping();
                }}
              >
                {#if currentNote.article}
                  <ArticlePicker
                    bind:value={selectedArticle}
                    disabled={Boolean(result)}
                    legend={copy('Nejdřív vyber člen', 'Choose the article first')}
                  />
                {/if}
                <label class="mt-4 block max-[521px]:mt-[0.7rem]" for="study-answer">
                  <span class={fieldLabel}>{copy('Německá odpověď', 'German answer')}</span>
                  <input
                    id="study-answer"
                    bind:this={inputElement}
                    class={answerField(resultState(result))}
                    bind:value={answer}
                    disabled={Boolean(result) || reviewing}
                    autocomplete="off"
                    autocapitalize="none"
                    spellcheck="false"
                    enterkeyhint="done"
                    lang="de"
                    placeholder={currentNote.kind === 'phrase'
                      ? copy('Napiš německou frázi', 'Type the German phrase')
                      : copy('Napiš německé slovo', 'Type the German word')}
                  />
                </label>

                <div
                  class="mt-[0.8rem] flex flex-wrap items-center justify-between gap-3 max-[521px]:mt-[0.6rem]"
                >
                  {#if $appStore.settings.showKeyboardHints}
                    <GermanKeyboard oninsert={insertGermanCharacter} />
                  {:else}<span></span>{/if}
                  {#if !result && $appStore.settings.showStudyTips}
                    <button
                      class="inline-flex min-h-[2.45rem] items-center gap-[0.4rem] border-b border-current text-[0.74rem] font-[780] text-orange-700 disabled:cursor-default disabled:opacity-100 fine-hover:text-coral-700"
                      type="button"
                      disabled={hintVisible}
                      onclick={revealHint}
                      ><Lightbulb size={15} />
                      {hintVisible
                        ? hintText(currentNote)
                        : copy('Malá nápověda', 'Small hint')}</button
                    >
                    {#if hintVisible && aiAvailable}
                      {#key currentNote.id}<AdaptiveHint
                          note={currentNote}
                          submitted={answer}
                        />{/key}
                    {/if}
                  {/if}
                </div>

                {#if !result}
                  <button
                    class={submitButton}
                    type="submit"
                    disabled={!answer.trim() ||
                      reviewing ||
                      (Boolean(currentNote.article) &&
                        !selectedArticle &&
                        !parseGermanAnswer(answer).article)}
                  >
                    {reviewing ? copy('Vyhodnocuji…', 'Checking…') : copy('Zkontrolovat', 'Check')}
                    <ArrowRight size={18} />
                  </button>
                {/if}
              </form>
            {:else if exercise === 'choice'}
              <StudyChoiceGrid
                options={choices}
                answerId={currentNote.id}
                selectedId={result?.signal.selectedChoice}
                revealed={Boolean(result)}
                disabled={Boolean(result) || reviewing}
                onchoose={(option) => void choose(option)}
              />
            {:else if exercise === 'matching' && matchingExercise}
              <div class="mx-auto mt-6 max-w-[44rem]">
                <PairMatchingBoard
                  round={matchingExercise}
                  disabled={Boolean(result) || reviewing}
                  oncomplete={submitMatching}
                />
                {#if matchingComplete && !result && errorMessage}
                  <button
                    class="btn-base btn-secondary mt-[0.8rem] w-full"
                    type="button"
                    disabled={reviewing}
                    onclick={() => void submitMatching()}
                    >{reviewing
                      ? copy('Ukládám…', 'Saving…')
                      : copy('Zkusit uložit výsledek znovu', 'Try saving the result again')}</button
                  >
                {/if}
              </div>
            {:else if exercise === 'word-order' && wordOrderExercise}
              <WordOrderBoard
                exercise={wordOrderExercise}
                selected={selectedWordTokens}
                locked={Boolean(result)}
                ready={wordOrderReady}
                {reviewing}
                onselect={selectWordToken}
                onremove={removeWordToken}
                onclear={clearWordOrder}
                onsubmit={() => void submitWordOrder()}
              />
            {:else if exercise === 'cloze' && clozeExercise}
              <form
                class={answerZone}
                onsubmit={(event) => {
                  event.preventDefault();
                  void submitCloze();
                }}
              >
                <div
                  class="flex flex-wrap items-center justify-center gap-[0.45rem] border-y border-line px-2 py-[1.4rem] text-[clamp(1.2rem,4vw,1.8rem)] leading-normal font-[780] max-[521px]:px-[0.35rem] max-[521px]:py-4 max-[521px]:text-[1.15rem]"
                  lang="de"
                >
                  {#if clozeExercise.before}<span>{clozeExercise.before}</span>{/if}
                  <input
                    class={[
                      'min-w-28 border-0 border-b-[3px] px-[0.4rem] py-[0.18rem] text-center text-ink-950 [font:inherit] focus:outline-0',
                      result?.correct
                        ? 'border-mint-700 bg-mint-50'
                        : result
                          ? 'border-coral-700 bg-coral-50'
                          : 'border-ink-950 bg-acid-100 focus:border-cobalt-700',
                    ]}
                    bind:this={inputElement}
                    bind:value={answer}
                    disabled={Boolean(result) || reviewing}
                    aria-label={copy('Chybějící německý výraz', 'Missing German expression')}
                    autocomplete="off"
                    autocapitalize="none"
                    spellcheck="false"
                    size={Math.min(18, Math.max(7, clozeExercise.answer.length))}
                  />
                  {#if clozeExercise.after}<span>{clozeExercise.after}</span>{/if}
                </div>
                {#if $appStore.settings.showKeyboardHints && !result}
                  <div class="mt-4"><GermanKeyboard oninsert={insertGermanCharacter} /></div>
                {/if}
                {#if !result}
                  <button class={submitButton} type="submit" disabled={!answer.trim() || reviewing}
                    >{copy('Doplnit', 'Complete')} <ArrowRight size={18} /></button
                  >
                {/if}
              </form>
            {:else if exercise === 'speaking'}
              <form
                class="mx-auto mt-6 max-w-[44rem]"
                onsubmit={(event) => {
                  event.preventDefault();
                  void submitSpeaking();
                }}
              >
                <div
                  class={[
                    'flex items-center gap-[0.9rem] rounded-[0.8rem] border p-3 [transition:border-color_160ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil),box-shadow_160ms_var(--ease-out-emil)]',
                    listening
                      ? 'border-cobalt-700 bg-sky-50 shadow-[4px_4px_0_var(--color-cobalt-300)]'
                      : 'border-ink-950 bg-paper-100',
                  ]}
                >
                  <button
                    class="grid size-[4.1rem] flex-none place-items-center rounded-full border border-ink-950 bg-cobalt-700 text-white shadow-[3px_3px_0_var(--color-ink-950)] [transition:transform_140ms_var(--ease-out-emil),box-shadow_140ms_var(--ease-out-emil)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-cobalt-300 active:not-disabled:[transform:translate(2px,2px)_scale(0.97)] active:not-disabled:shadow-[1px_1px_0_var(--color-ink-950)]"
                    type="button"
                    disabled={!speechAvailable || Boolean(result) || reviewing}
                    aria-pressed={listening}
                    aria-label={listening
                      ? copy('Ukončit poslech mikrofonu', 'Stop microphone listening')
                      : copy('Spustit německé rozpoznání řeči', 'Start German speech recognition')}
                    onclick={toggleSpeechRecognition}
                  >
                    {#if listening}<MicOff size={28} />{:else}<Mic size={28} />{/if}
                  </button>
                  <div role="status" aria-live="polite">
                    <strong class="block text-[0.9rem]"
                      >{!speechAvailable
                        ? copy(
                            'Mikrofon v tomto prohlížeči není dostupný',
                            'The microphone is unavailable in this browser',
                          )
                        : listening
                          ? copy('Poslouchám němčinu…', 'Listening for German…')
                          : copy('Mikrofon je připravený', 'The microphone is ready')}</strong
                    >
                    <span class="mt-[0.2rem] block text-[0.72rem] leading-[1.4] text-ink-600"
                      >{!speechAvailable
                        ? copy('Použij ruční přepis níže.', 'Use the manual transcript below.')
                        : listening
                          ? copy(
                              'Až domluvíš, klepni znovu.',
                              'Tap again when you finish speaking.',
                            )
                          : copy(
                              'Klepni, řekni překlad a uprav přepis.',
                              'Tap, say the German answer, and edit the transcript.',
                            )}</span
                    >
                  </div>
                </div>

                <label class="mt-4 block max-[521px]:mt-[0.7rem]" for="speech-answer">
                  <span class={fieldLabel}
                    >{copy(
                      'Rozpoznaný nebo ručně napsaný přepis',
                      'Recognised or manually typed transcript',
                    )}</span
                  >
                  <input
                    id="speech-answer"
                    bind:this={inputElement}
                    class={answerField(resultState(result))}
                    bind:value={answer}
                    disabled={Boolean(result) || reviewing}
                    autocomplete="off"
                    autocapitalize="none"
                    spellcheck="false"
                    enterkeyhint="done"
                    lang="de"
                    aria-describedby={speechError ? 'speech-help speech-error' : 'speech-help'}
                    placeholder={copy(
                      'Tady se objeví, co prohlížeč slyšel',
                      'What the browser heard appears here',
                    )}
                  />
                </label>
                <p id="speech-help" class="mt-[0.65rem] text-[0.7rem] leading-[1.45] text-ink-600">
                  {copy(
                    'Přepis můžeš opravit. Hodnotí se až po stisknutí tlačítka, ne během mluvení.',
                    'You can edit the transcript. It is graded only after you press the button, never while you speak.',
                  )}
                </p>
                {#if speechError}<p
                    id="speech-error"
                    class="mt-[0.65rem] rounded-[0.45rem] bg-coral-50 px-[0.7rem] py-[0.6rem] text-[0.7rem] leading-[1.45] text-coral-700"
                    role="alert"
                  >
                    {speechError}
                  </p>{/if}
                {#if result && spokenTranscript}
                  <PronunciationFeedback
                    target={displayGerman(currentNote)}
                    transcript={spokenTranscript}
                    confidence={spokenConfidence}
                    onlisten={() => speak()}
                  />
                {/if}
                {#if !result}
                  <button
                    class={submitButton}
                    type="submit"
                    disabled={!answer.trim() || reviewing || listening}
                  >
                    {copy('Zkontrolovat přepis', 'Check transcript')}
                    <ArrowRight size={18} />
                  </button>
                {/if}
              </form>
            {:else if exercise === 'sentence'}
              <form
                class={answerZone}
                onsubmit={(event) => {
                  event.preventDefault();
                  void submitSentence();
                }}
              >
                <label class={fieldLabel} for="sentence-answer"
                  >{copy('Tvoje věta', 'Your sentence')}</label
                >
                <textarea
                  class="w-full resize-y rounded-[0.25rem] border-2 border-ink-950 bg-white p-4 text-[1.05rem] leading-[1.55] font-[650] text-ink-950 shadow-[4px_4px_0_var(--color-cobalt-300)] focus:shadow-[5px_5px_0_var(--color-cobalt-700)] focus:outline-0 max-[521px]:min-h-24 max-[521px]:resize-none max-[521px]:p-3"
                  id="sentence-answer"
                  bind:this={inputElement}
                  bind:value={answer}
                  disabled={Boolean(result) || reviewing || aiBusy}
                  maxlength="600"
                  rows="4"
                  lang="de"
                  autocomplete="off"
                  spellcheck="false"
                  placeholder={copy(
                    `Např. věta, ve které přirozeně použiješ „${currentNote.german}“`,
                    `For example, a sentence that naturally uses “${currentNote.german}”`,
                  )}></textarea>
                <div
                  class="mt-[0.85rem] flex flex-wrap items-center justify-between gap-3 max-[521px]:mt-[0.55rem] max-[521px]:flex-col max-[521px]:items-stretch max-[521px]:[&>.btn-base]:min-h-[2.9rem] max-[521px]:[&>.btn-base]:w-full"
                >
                  <span class="font-mono text-[0.67rem] text-ink-600"
                    >{answer.length}/600 · Ctrl/⌘ + Enter</span
                  >
                  {#if !result}
                    <button
                      class="btn-base btn-primary"
                      type="submit"
                      disabled={answer.trim().length < 3 || aiBusy || reviewing}
                    >
                      {#if aiBusy}<LoaderCircle class="animate-spin" size={17} />
                        {copy('AI posuzuje…', 'AI is checking…')}{:else}<Sparkles size={17} />
                        {copy('Posoudit použití', 'Evaluate usage')}{/if}
                    </button>
                  {/if}
                </div>
              </form>
            {:else}
              <FlashcardReveal
                note={currentNote}
                bind:revealed
                {reviewing}
                schedule={scheduleOptions}
                onrate={(rating) => void rateFlashcard(rating)}
                onspeak={() => speak()}
              />
            {/if}
          </div>

          {#if feedbackShown && result}
            <StudyFeedback
              note={currentNote}
              {result}
              {exercise}
              gamificationEnabled={$appStore.settings.gamificationEnabled}
              combo={sessionCombo}
              requireCorrection={$appStore.settings.requireCorrection}
              showStudyTips={$appStore.settings.showStudyTips}
              aiConfigured={aiAvailable}
              {aiBusy}
              {aiExplanation}
              {aiExplanationError}
              {reviewing}
              disputing={disputingReview}
              nextAllowed={nextAllowed()}
              bind:correction
              bind:correctionArticle
              onspeak={() => speak()}
              onexplain={explainMistake}
              ondispute={disputeSavedReview}
              onadvance={advance}
            />
          {/if}
        </section>

        <MemoryPlanPanel
          sprint={mode === 'cram'}
          schedule={activeSchedule}
          rating={result?.rating}
          scheduledFor={result?.scheduledFor}
          note={$appStore.settings.showStudyTips && $motherTongue === 'cs'
            ? currentNote.learningNote
            : undefined}
        />
      </div>
    {:else}
      <LoadingState label={copy('Připravuji další otázku…', 'Preparing the next question…')} />
    {/if}

    {#if errorMessage}<p
        class="mt-4 rounded-[0.2rem] border border-coral-700 bg-coral-50 p-[0.85rem] text-[0.82rem] font-bold text-coral-700 max-[900px]:fixed max-[900px]:inset-x-3 max-[900px]:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] max-[900px]:z-50 max-[900px]:m-0 max-[900px]:shadow-[4px_4px_0_var(--color-ink-950)]"
        aria-live="assertive"
      >
        {errorMessage}
      </p>{/if}

    {#if currentNote && waitMs === 0 && $appStore.settings.showStudyTips}
      <p
        class="mt-[1.1rem] text-center font-mono text-[0.65rem] text-ink-600 max-[900px]:hidden min-[900px]:text-[0.75rem]"
      >
        {#if exercise === 'typing' || exercise === 'cloze'}{copy(
            'Enter = zkontrolovat nebo pokračovat',
            'Enter = check or continue',
          )}
        {:else if exercise === 'choice'}{copy('Klávesy 1–4 = výběr', 'Keys 1–4 = choose')}
        {:else if exercise === 'word-order'}{copy('Enter = zkontrolovat', 'Enter = check')}
        {:else if exercise === 'sentence'}{copy(
            'Ctrl/⌘ + Enter = posoudit',
            'Ctrl/⌘ + Enter = evaluate',
          )}
        {:else}{copy('Mezerník = odhalit, 1–4 = hodnocení', 'Space = reveal, 1–4 = rating')}{/if}
      </p>
    {/if}
  </div>
{/if}
