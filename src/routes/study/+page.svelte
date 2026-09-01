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
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import LongTermSetup from '$lib/components/study/LongTermSetup.svelte';
  import PairMatchingBoard from '$lib/components/study/PairMatchingBoard.svelte';
  import SessionComplete from '$lib/components/study/SessionComplete.svelte';
  import StudyFeedback from '$lib/components/study/StudyFeedback.svelte';
  import StudySetup from '$lib/components/study/StudySetup.svelte';
  import { aiEndpointAvailable } from '$lib/domain/ai/types.ts';
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
  import {
    formatDueMoment,
    formatScheduleInterval,
    isMatureFsrsCard,
    previewSchedule,
  } from '$lib/domain/scheduler/fsrs.ts';
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
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Eye from '@lucide/svelte/icons/eye';
  import Keyboard from '@lucide/svelte/icons/keyboard';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import Link2 from '@lucide/svelte/icons/link-2';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Mic from '@lucide/svelte/icons/mic';
  import MicOff from '@lucide/svelte/icons/mic-off';
  import Pause from '@lucide/svelte/icons/pause';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Target from '@lucide/svelte/icons/target';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import X from '@lucide/svelte/icons/x';
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

  const englishTimeFormatter = new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const englishDateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

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
      const status = await getAiKeyStatus();
      aiAvailable = aiEndpointAvailable(status);
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
          'Pro tento filtr teď nejsou žádná splatná slova.',
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
        'Studijní fronta obsahuje neznámou kartu.',
        'The study queue contains an unknown card.',
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
                'The verdict is excluded from learning and XP. The card’s previous due date was restored.',
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
        ontranscript: (transcript) => {
          if (run !== speechRun || !transcript) return;
          answer = transcript;
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
        ? copy('Slyším to správně. Přepis sedí.', 'That sounds right. The transcript matches.')
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
              `Všechny dvojice propojené. Příště zkus ubrat slepé pokusy: ${mistakes}.`,
              `Every pair is matched. Next time, try to reduce blind attempts: ${mistakes}.`,
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

  function scheduleLabel(rating: RatingKey): string {
    const option = scheduleOptions.find((candidate) => candidate.rating === rating);
    return option ? intervalLabel(option.intervalMs) : '';
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

  function intervalLabel(milliseconds: number): string {
    if ($motherTongue === 'cs') return formatScheduleInterval(milliseconds);
    const seconds = Math.max(0, Math.round(milliseconds / 1_000));
    if (seconds < 45) return 'now';
    if (seconds < 90) return 'in 1 min';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `in ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `in ${hours} hr`;
    const days = Math.round(hours / 24);
    if (days < 31) return `in ${days} d`;
    const months = Math.round(days / 30.44);
    if (months < 18) return `in ${months} mo`;
    return `in ${Math.round((days / 365.25) * 10) / 10} yr`;
  }

  function dueMomentLabel(value: string | Date): string {
    if ($motherTongue === 'cs') return formatDueMoment(value);
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'unknown due date';
    const now = new Date();
    const interval = date.getTime() - now.getTime();
    if (interval < 20 * 60_000) return intervalLabel(interval);
    const time = englishTimeFormatter.format(date);
    if (date.toDateString() === now.toDateString()) return `today at ${time}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return `tomorrow at ${time}`;
    return englishDateFormatter.format(date);
  }

  function exerciseLabel(kind: ExerciseKind): string {
    const labels: Record<ExerciseKind, { cs: string; en: string }> = {
      typing: { cs: 'aktivní vybavení', en: 'active recall' },
      choice: { cs: 'rychlé rozpoznání', en: 'quick recognition' },
      flashcard: { cs: 'vlastní hodnocení', en: 'self-rating' },
      'word-order': { cs: 'laboratoř slovosledu', en: 'word-order lab' },
      cloze: { cs: 'kontextová mezera', en: 'context gap' },
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
</script>

<svelte:head>
  <title
    >{mode === 'cram'
      ? copy('Sprint na test', 'Test sprint')
      : copy('Paměťová laboratoř', 'Memory lab')} – Fritz</title
  >
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

{#if !initialized || !$appStore.ready || !$appStore.settings}
  <div class="study-scroll-shell">
    <LoadingState label={copy('Skládám paměťovou trasu…', 'Building your memory route…')} />
  </div>
{:else if mode === 'long-term' && !longTermConfigured}
  <div class="study-scroll-shell">
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
  <div class="study-scroll-shell">
    <StudySetup
      bind:duration={cramDuration}
      bind:selectedTag
      tags={availableTags}
      cardCount={selectedCramCount}
      onstart={startConfiguredCram}
    />
  </div>
{:else if completed}
  <div class="study-scroll-shell">
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
  <div class="study-lab active-session">
    <header class="study-header">
      <a
        class="pause-study"
        href="/"
        aria-label={mode === 'long-term'
          ? copy('Pozastavit studijní dávku', 'Pause study batch')
          : copy('Ukončit sprint', 'End sprint')}
        onclick={pauseSession}
      >
        {#if mode === 'long-term'}<Pause size={18} /><span>{copy('Pozastavit', 'Pause')}</span
          >{:else}<X size={18} /><span>{copy('Ukončit', 'End')}</span>{/if}
      </a>
      <div class="session-meter">
        <div class="session-meta">
          <span>
            {#if mode === 'cram'}<Target size={14} />
              {copy('Sprint na test', 'Test sprint')}{:else}<Brain size={14} />
              {copy('Paměťová trasa', 'Memory route')}{/if}
          </span>
          <span>
            {#if mode === 'cram'}{sprintProgress.mastered}/{sprintProgress.total}
              {copy('jistých', 'confident')}{:else}{sessionCompleted}/{sessionTarget}
              {copy('hotovo', 'done')}{/if}
          </span>
        </div>
        <ProgressBar
          value={progress}
          label={copy('Postup studijní dávkou', 'Study batch progress')}
        />
      </div>
      <div class="session-badges">
        {#if mode === 'long-term'}
          <span class="scope-badge"
            >{selectedTag === 'all' ? copy('všechny skupiny', 'all groups') : selectedTag}</span
          >
        {/if}
        <span class="pace-badge"
          >{mode === 'long-term' ? copy('pevná dávka', 'fixed batch') : `${cramDuration} min`}</span
        >
        {#if $appStore.settings.gamificationEnabled}
          <span class="session-xp"><Sparkles size={14} /> {sessionXp} XP</span>
        {/if}
      </div>
    </header>

    {#if waitMs > 0}
      <section class="wait-sheet">
        <div class="wait-number">{formatWait(waitMs)}</div>
        <div>
          <p class="lab-index">learning step / {copy('krátká mezera', 'short gap')}</p>
          <h1>
            {copy('Nech odpověď na chvíli zmizet.', 'Let the answer disappear for a moment.')}
          </h1>
          <p>
            {copy(
              'Stejná karta se nevrací okamžitě. Po krátkém rozptýlení ji musíš skutečně znovu vybavit.',
              'The same card does not return immediately. After a short distraction, you must genuinely recall it again.',
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
      <div class="study-grid">
        <section
          class:has-feedback={Boolean(result && exercise !== 'flashcard')}
          class="study-card"
        >
          <div class="card-ruler" aria-hidden="true">
            <span>{String(sessionReviews + 1).padStart(2, '0')}</span>
          </div>
          <div class="question-area">
            <div class="question-topline">
              <span class="exercise-pill">
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
                class="word-stage"
                aria-label={copy(
                  'Stav procvičovaného výrazu',
                  'Practice status for this expression',
                )}
              >
                <span>{encounterCount}. {copy('setkání', 'encounter')}</span>
                <span>{currentMastery}</span>
                {#if currentNote.cefr}<span class="cefr">{currentNote.cefr}</span>{/if}
              </div>
            </div>

            {#if $appStore.settings.showStudyTips}
              <p class="exercise-reason">
                {$motherTongue === 'en'
                  ? 'This activity targets the card’s current memory signal.'
                  : exerciseReason}
              </p>
            {/if}

            {#if exercise === 'speaking'}
              <div class="prompt prompt-context prompt-speaking">
                <p class="lab-index">
                  {copy(
                    'řekni německy · u podstatného jména i se členem',
                    'say it in German · include the article for nouns',
                  )}
                </p>
                <h1>{currentMeaning}</h1>
                <p>
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
              <div class="prompt prompt-context prompt-matching">
                <p class="lab-index">
                  {copy(
                    'česky vlevo · německy vpravo',
                    'meanings on the left · German on the right',
                  )}
                </p>
                <h1>{copy('Najdi slovní parťáky', 'Match the word pairs')}</h1>
                <p>
                  {copy(
                    'Čtyři významy, čtyři výrazy, žádný vetřelec.',
                    'Four meanings, four expressions, no decoys.',
                  )}
                </p>
              </div>
            {:else if exercise === 'sentence'}
              <div class="prompt prompt-sentence">
                <p class="lab-index">
                  {copy('použij v přirozené německé větě', 'use it in a natural German sentence')}
                </p>
                <div class="target-word">
                  <h1 lang="de">{displayGerman(currentNote)}</h1>
                  <button
                    class="speak-button"
                    type="button"
                    aria-label={copy('Přehrát německou výslovnost', 'Play German pronunciation')}
                    onclick={() => speak()}><Volume2 size={18} /></button
                  >
                </div>
                <p>{currentMeaning}</p>
              </div>
            {:else if exercise === 'word-order' && wordOrderExercise}
              <div class="prompt prompt-context">
                <p class="lab-index">
                  {copy('poskládej německý slovosled', 'build the German word order')}
                </p>
                <h1>{wordOrderExercise.translation ?? currentMeaning}</h1>
              </div>
            {:else if exercise === 'cloze' && clozeExercise}
              <div class="prompt prompt-context">
                <p class="lab-index">{clozeExercise.label}</p>
                <h1>{clozeExercise.translation ?? currentMeaning}</h1>
              </div>
            {:else}
              <div class="prompt">
                <p class="lab-index">
                  {copy('česky / vybav si německy', 'meaning / recall the German')}
                </p>
                <h1>{currentMeaning}</h1>
                {#if currentNote.tags.length > 0}<p class="tags">
                    {currentNote.tags.slice(0, 3).join(' · ')}
                  </p>{/if}
              </div>
            {/if}

            {#if exercise === 'typing'}
              <form
                class="answer-zone"
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
                <label class="answer-label" for="study-answer">
                  <span>{copy('Německá odpověď', 'German answer')}</span>
                  <input
                    id="study-answer"
                    bind:this={inputElement}
                    class:answer-correct={result?.correct}
                    class:answer-wrong={result && !result.correct}
                    class="answer-field"
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

                <div class="answer-tools">
                  {#if $appStore.settings.showKeyboardHints}
                    <GermanKeyboard oninsert={insertGermanCharacter} />
                  {:else}<span></span>{/if}
                  {#if !result && $appStore.settings.showStudyTips}
                    <button
                      class="hint-button"
                      type="button"
                      disabled={hintVisible}
                      onclick={revealHint}
                      ><Lightbulb size={15} />
                      {hintVisible
                        ? hintText(currentNote)
                        : copy('Malá nápověda', 'Small hint')}</button
                    >
                  {/if}
                </div>

                {#if !result}
                  <button
                    class="btn-base btn-primary submit-button"
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
              <div class="choice-grid">
                {#each choices as option, index}
                  <button
                    class:choice-correct={result && option.id === currentNote.id}
                    class:choice-wrong={result &&
                      result.signal.selectedChoice === option.id &&
                      option.id !== currentNote.id}
                    class="choice-button"
                    type="button"
                    disabled={Boolean(result) || reviewing}
                    onclick={() => void choose(option)}
                    lang="de"
                    ><span>{index + 1}</span><strong>{displayGerman(option)}</strong></button
                  >
                {/each}
              </div>
            {:else if exercise === 'matching' && matchingExercise}
              <div class="matching-zone">
                <PairMatchingBoard
                  round={matchingExercise}
                  disabled={Boolean(result) || reviewing}
                  oncomplete={submitMatching}
                />
                {#if matchingComplete && !result && errorMessage}
                  <button
                    class="btn-base btn-secondary matching-retry"
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
              <div class="word-order-zone">
                <div
                  class:empty={selectedWordTokens.length === 0}
                  class="sentence-canvas"
                  aria-label={copy('Sestavená věta', 'Built sentence')}
                >
                  {#if selectedWordTokens.length === 0}
                    <span
                      >{copy(
                        'Klepni na slova ve správném pořadí',
                        'Tap the words in the correct order',
                      )}</span
                    >
                  {:else}
                    {#each selectedWordTokens as token}
                      <button
                        type="button"
                        disabled={Boolean(result)}
                        onclick={() => removeWordToken(token)}>{token.text}</button
                      >
                    {/each}
                  {/if}
                </div>
                <div class="token-bank" aria-label={copy('Dostupná slova', 'Available words')}>
                  {#each wordOrderExercise.shuffled as token}
                    <button
                      type="button"
                      class:selected={selectedWordIds.has(token.id)}
                      disabled={Boolean(result) || selectedWordIds.has(token.id)}
                      onclick={() => selectWordToken(token)}>{token.text}</button
                    >
                  {/each}
                </div>
                {#if !result}
                  <div class="word-order-actions">
                    <button
                      class="btn-base btn-secondary"
                      type="button"
                      disabled={selectedWordTokens.length === 0}
                      onclick={clearWordOrder}>{copy('Vyčistit', 'Clear')}</button
                    >
                    <button
                      class="btn-base btn-primary"
                      type="button"
                      disabled={!wordOrderReady || reviewing}
                      onclick={() => void submitWordOrder()}
                      >{copy('Zkontrolovat', 'Check')} <ArrowRight size={18} /></button
                    >
                  </div>
                {/if}
              </div>
            {:else if exercise === 'cloze' && clozeExercise}
              <form
                class="cloze-zone"
                onsubmit={(event) => {
                  event.preventDefault();
                  void submitCloze();
                }}
              >
                <div class="cloze-sentence" lang="de">
                  {#if clozeExercise.before}<span>{clozeExercise.before}</span>{/if}
                  <input
                    bind:this={inputElement}
                    bind:value={answer}
                    disabled={Boolean(result) || reviewing}
                    class:answer-correct={result?.correct}
                    class:answer-wrong={result && !result.correct}
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
                  <button
                    class="btn-base btn-primary submit-button"
                    type="submit"
                    disabled={!answer.trim() || reviewing}
                    >{copy('Doplnit', 'Complete')} <ArrowRight size={18} /></button
                  >
                {/if}
              </form>
            {:else if exercise === 'speaking'}
              <form
                class="speaking-zone"
                onsubmit={(event) => {
                  event.preventDefault();
                  void submitSpeaking();
                }}
              >
                <div class:listening class="microphone-card">
                  <button
                    class="microphone-button"
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
                    <strong
                      >{!speechAvailable
                        ? copy(
                            'Mikrofon v tomto prohlížeči není dostupný',
                            'The microphone is unavailable in this browser',
                          )
                        : listening
                          ? copy('Poslouchám němčinu…', 'Listening for German…')
                          : copy('Mikrofon je připravený', 'The microphone is ready')}</strong
                    >
                    <span
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

                <label class="answer-label" for="speech-answer">
                  <span
                    >{copy(
                      'Rozpoznaný nebo ručně napsaný přepis',
                      'Recognised or manually typed transcript',
                    )}</span
                  >
                  <input
                    id="speech-answer"
                    bind:this={inputElement}
                    class:answer-correct={result?.correct}
                    class:answer-wrong={result && !result.correct}
                    class="answer-field"
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
                <p id="speech-help" class="speech-help">
                  {copy(
                    'Přepis můžeš opravit. Hodnotí se až po stisknutí tlačítka, ne během mluvení.',
                    'You can edit the transcript. It is graded only after you press the button, never while you speak.',
                  )}
                </p>
                {#if speechError}<p id="speech-error" class="speech-error" role="alert">
                    {speechError}
                  </p>{/if}
                {#if !result}
                  <button
                    class="btn-base btn-primary submit-button"
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
                class="sentence-zone"
                onsubmit={(event) => {
                  event.preventDefault();
                  void submitSentence();
                }}
              >
                <label for="sentence-answer">{copy('Tvoje věta', 'Your sentence')}</label>
                <textarea
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
                <div class="sentence-footer">
                  <span>{answer.length}/600 · Ctrl/⌘ + Enter</span>
                  {#if !result}
                    <button
                      class="btn-base btn-primary"
                      type="submit"
                      disabled={answer.trim().length < 3 || aiBusy || reviewing}
                    >
                      {#if aiBusy}<LoaderCircle class="spin" size={17} />
                        {copy('AI posuzuje…', 'AI is checking…')}{:else}<Sparkles size={17} />
                        {copy('Posoudit použití', 'Evaluate usage')}{/if}
                    </button>
                  {/if}
                </div>
              </form>
            {:else}
              <div class="flash-zone">
                {#if !revealed}
                  <button
                    class="reveal-button"
                    type="button"
                    disabled={reviewing}
                    onclick={() => (revealed = true)}
                    ><Eye size={20} /> {copy('Odhalit němčinu', 'Reveal the German')}</button
                  >
                  <p>{copy('Mezerník funguje také.', 'The space bar works too.')}</p>
                {:else}
                  <div class="flash-answer">
                    <p class="lab-index">{copy('německy', 'German')}</p>
                    <div class="target-word">
                      <h2 lang="de">{displayGerman(currentNote)}</h2>
                      <button
                        class="speak-button"
                        type="button"
                        aria-label={copy(
                          'Přehrát německou výslovnost',
                          'Play German pronunciation',
                        )}
                        onclick={() => speak()}><Volume2 size={19} /></button
                      >
                    </div>
                    {#if displayPlural(currentNote.plural)}<p class="plural" lang="de">
                        {displayPlural(currentNote.plural)}
                      </p>{/if}
                    {#if currentNote.exampleDe}<p class="example" lang="de">
                        „{currentNote.exampleDe}“
                      </p>{/if}
                  </div>
                  <p class="rating-prompt">
                    {copy('Jak dobře sis odpověď vybavila?', 'How well did you recall the answer?')}
                  </p>
                  <div class="rating-grid">
                    <button
                      class="rating again"
                      type="button"
                      disabled={reviewing}
                      onclick={() => void rateFlashcard('again')}
                      ><span>1</span><strong>{copy('Znovu', 'Again')}</strong><small
                        >{scheduleLabel('again')}</small
                      ></button
                    >
                    <button
                      class="rating hard"
                      type="button"
                      disabled={reviewing}
                      onclick={() => void rateFlashcard('hard')}
                      ><span>2</span><strong>{copy('Těžké', 'Hard')}</strong><small
                        >{scheduleLabel('hard')}</small
                      ></button
                    >
                    <button
                      class="rating good"
                      type="button"
                      disabled={reviewing}
                      onclick={() => void rateFlashcard('good')}
                      ><span>3</span><strong>{copy('Dobré', 'Good')}</strong><small
                        >{scheduleLabel('good')}</small
                      ></button
                    >
                    <button
                      class="rating easy"
                      type="button"
                      disabled={reviewing}
                      onclick={() => void rateFlashcard('easy')}
                      ><span>4</span><strong>{copy('Lehké', 'Easy')}</strong><small
                        >{scheduleLabel('easy')}</small
                      ></button
                    >
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          {#if result && exercise !== 'flashcard'}
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

        <aside class="memory-plan">
          <div class="plan-heading">
            <span><Clock3 size={17} /></span>
            <div>
              <p class="lab-index">{copy('paměťový plán', 'memory plan')}</p>
              <h2>{copy('Kdy se karta vrátí', 'When this card returns')}</h2>
            </div>
          </div>

          {#if mode === 'cram'}
            <div class="cram-note">
              <strong>{copy('Sprint je oddělený.', 'The sprint is separate.')}</strong>
              <p>
                {copy(
                  'Procvičení na test nemění dlouhodobé intervaly ani stav FSRS.',
                  'Test practice does not change long-term intervals or FSRS state.',
                )}
              </p>
            </div>
          {:else if activeSchedule.length > 0}
            <div class="schedule-list">
              {#each activeSchedule as option}
                <div class:selected={result?.rating === option.rating} class="schedule-row">
                  <span class={`rating-dot ${option.rating}`}></span>
                  <div>
                    <strong
                      >{option.rating === 'again'
                        ? copy('Znovu', 'Again')
                        : option.rating === 'hard'
                          ? copy('Těžké', 'Hard')
                          : option.rating === 'good'
                            ? copy('Dobré', 'Good')
                            : copy('Lehké', 'Easy')}</strong
                    >
                    <small>{intervalLabel(option.intervalMs)}</small>
                  </div>
                  <time datetime={option.dueAt}>{dueMomentLabel(option.dueAt)}</time>
                </div>
              {/each}
            </div>
            {#if result?.scheduledFor}
              <div class="selected-plan">
                <Check size={17} />
                <p>
                  <strong>{copy('Uloženo:', 'Saved:')}</strong>
                  {copy('tuto kartu uvidíš znovu', 'you will see this card again')}
                  {dueMomentLabel(result.scheduledFor)}.
                </p>
              </div>
            {:else}
              <p class="plan-footnote">
                {copy(
                  'Konkrétní větev zvolí kvalita odpovědi. Po uložení ji zvýrazníme.',
                  'Answer quality selects the exact branch. It will be highlighted after saving.',
                )}
              </p>
            {/if}
          {:else}
            <p class="plan-footnote">
              {copy(
                'Plán se ukáže po načtení stavu karty.',
                'The plan appears after the card state loads.',
              )}
            </p>
          {/if}

          {#if $appStore.settings.showStudyTips && $motherTongue === 'cs' && currentNote.learningNote}
            <div class="margin-note">
              <Lightbulb size={16} />
              <p>{currentNote.learningNote}</p>
            </div>
          {/if}
        </aside>
      </div>
    {:else}
      <LoadingState label={copy('Připravuji další otázku…', 'Preparing the next question…')} />
    {/if}

    {#if errorMessage}<p class="error-message" aria-live="assertive">{errorMessage}</p>{/if}

    {#if currentNote && waitMs === 0 && $appStore.settings.showStudyTips}
      <p class="keyboard-note">
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

<style>
  .study-scroll-shell {
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: max(0.8rem, var(--safe-top)) 0.8rem max(1.5rem, var(--safe-bottom));
  }

  .study-lab {
    max-width: 72rem;
    margin: 0 auto;
  }
  .study-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.8rem;
  }
  .pause-study {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem;
    color: var(--color-ink-950);
    background: var(--color-paper-50);
    padding: 0 0.72rem;
    font-size: 0.72rem;
    font-weight: 820;
    box-shadow: 3px 3px 0 var(--color-ink-950);
    transition:
      transform 140ms var(--ease-out-emil),
      box-shadow 140ms var(--ease-out-emil);
  }
  .pause-study:active {
    transform: translate(2px, 2px) scale(0.97);
    box-shadow: 1px 1px 0 var(--color-ink-950);
  }
  .session-meter {
    min-width: 0;
  }
  .session-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.45rem;
    color: var(--color-ink-600);
    font-size: 0.72rem;
    font-weight: 780;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .session-meta span:first-child {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .session-badges {
    display: none;
    align-items: center;
    gap: 0.5rem;
  }
  .pace-badge,
  .scope-badge,
  .session-xp {
    display: inline-flex;
    min-height: 2.3rem;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    background: var(--color-paper-50);
    padding: 0.45rem 0.65rem;
    font-size: 0.68rem;
    font-weight: 800;
    white-space: nowrap;
  }
  .scope-badge {
    max-width: 9rem;
    overflow: hidden;
    color: var(--color-cobalt-700);
    text-overflow: ellipsis;
  }
  .session-xp {
    color: var(--color-orange-700);
  }

  .study-grid {
    display: grid;
    gap: 1rem;
    margin-top: 1.25rem;
  }
  .study-card {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.35rem 1.5rem 0.35rem 0.35rem;
    background: var(--color-paper-50);
    box-shadow: 7px 7px 0 var(--color-ink-950);
  }
  .card-ruler {
    position: absolute;
    inset: 0 auto 0 0;
    width: 2.55rem;
    border-right: 1px solid var(--color-coral-500);
    background: repeating-linear-gradient(
      to bottom,
      transparent 0 27px,
      rgb(25 31 36 / 0.08) 27px 28px
    );
  }
  .card-ruler span {
    position: sticky;
    top: 1rem;
    display: block;
    padding-top: 1rem;
    color: var(--color-coral-700);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 800;
    text-align: center;
  }
  .question-area {
    min-height: 34rem;
    padding: 1.3rem 1.25rem 1.6rem 3.7rem;
  }
  .question-topline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .exercise-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.42rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    color: var(--color-ink-950);
    background: var(--color-acid-100);
    padding: 0.43rem 0.68rem;
    font-size: 0.66rem;
    font-weight: 850;
    text-transform: uppercase;
    letter-spacing: 0.055em;
  }
  .word-stage {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.35rem;
  }
  .word-stage > span {
    border: 1px solid var(--color-line);
    border-radius: 999px;
    color: var(--color-ink-600);
    background: var(--color-paper-100);
    padding: 0.32rem 0.5rem;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 800;
    white-space: nowrap;
  }
  .word-stage .cefr {
    border-color: var(--color-cobalt-300);
    color: var(--color-cobalt-700);
    background: var(--color-cobalt-50);
  }
  .exercise-reason {
    margin-top: 0.75rem;
    max-width: 42rem;
    color: var(--color-ink-600);
    font-size: 0.77rem;
    line-height: 1.45;
  }
  .lab-index {
    color: var(--color-coral-700);
    font-family: var(--font-mono);
    font-size: 0.67rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .prompt {
    margin-top: clamp(2.4rem, 7vw, 4.6rem);
    text-align: center;
  }
  .prompt h1 {
    margin-top: 0.45rem;
    text-wrap: balance;
    font-size: clamp(2.35rem, 8vw, 5.5rem);
    font-weight: 900;
    line-height: 0.9;
    letter-spacing: -0.04em;
  }
  .prompt .tags {
    margin-top: 0.95rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 700;
  }
  .prompt-context h1 {
    font-size: clamp(1.85rem, 5vw, 3.6rem);
    line-height: 0.98;
  }
  .prompt-sentence {
    margin-top: 2.7rem;
  }
  .prompt-sentence p:last-child {
    margin-top: 0.7rem;
    color: var(--color-ink-600);
    font-size: 0.9rem;
    font-weight: 700;
  }
  .prompt-speaking,
  .prompt-matching {
    margin-top: 2.7rem;
  }
  .prompt-speaking > p:last-child,
  .prompt-matching > p:last-child {
    margin-top: 0.7rem;
    color: var(--color-ink-600);
    font-size: 0.84rem;
    font-weight: 700;
  }
  .target-word {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.8rem;
  }
  .target-word h1,
  .target-word h2 {
    margin-top: 0.45rem;
    text-wrap: balance;
    font-size: clamp(2.3rem, 7vw, 4.8rem);
    font-weight: 900;
    line-height: 0.94;
    letter-spacing: -0.04em;
  }

  .answer-zone,
  .cloze-zone,
  .sentence-zone,
  .word-order-zone,
  .choice-grid,
  .flash-zone {
    max-width: 44rem;
    margin: 2.1rem auto 0;
  }
  .matching-zone,
  .speaking-zone {
    max-width: 44rem;
    margin: 1.5rem auto 0;
  }
  .matching-retry {
    width: 100%;
    margin-top: 0.8rem;
  }
  .microphone-card {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.8rem;
    background: var(--color-paper-100);
    padding: 0.75rem;
    transition:
      border-color 160ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil),
      box-shadow 160ms var(--ease-out-emil);
  }
  .microphone-card.listening {
    border-color: var(--color-cobalt-700);
    background: var(--color-sky-50);
    box-shadow: 4px 4px 0 var(--color-cobalt-300);
  }
  .microphone-button {
    display: grid;
    width: 4.1rem;
    height: 4.1rem;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    color: white;
    background: var(--color-cobalt-700);
    box-shadow: 3px 3px 0 var(--color-ink-950);
    transition:
      transform 140ms var(--ease-out-emil),
      box-shadow 140ms var(--ease-out-emil);
  }
  .microphone-button:active:not(:disabled) {
    transform: translate(2px, 2px) scale(0.97);
    box-shadow: 1px 1px 0 var(--color-ink-950);
  }
  .microphone-button:focus-visible {
    outline: 3px solid var(--color-cobalt-300);
    outline-offset: 3px;
  }
  .microphone-card strong,
  .microphone-card span {
    display: block;
  }
  .microphone-card strong {
    font-size: 0.9rem;
  }
  .microphone-card span {
    margin-top: 0.2rem;
    color: var(--color-ink-600);
    font-size: 0.72rem;
    line-height: 1.4;
  }
  .speech-help,
  .speech-error {
    margin-top: 0.65rem;
    font-size: 0.7rem;
    line-height: 1.45;
  }
  .speech-help {
    color: var(--color-ink-600);
  }
  .speech-error {
    border-radius: 0.45rem;
    color: var(--color-coral-700);
    background: var(--color-coral-50);
    padding: 0.6rem 0.7rem;
  }
  .answer-label {
    display: block;
    margin-top: 1rem;
  }
  .answer-label > span,
  .sentence-zone > label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.055em;
  }
  .answer-field {
    width: 100%;
    min-height: 4.3rem;
    border: 2px solid var(--color-ink-950);
    border-radius: 0.25rem;
    color: var(--color-ink-950);
    background: white;
    padding: 0.9rem 1rem;
    font-size: 1.25rem;
    font-weight: 780;
    box-shadow: 4px 4px 0 var(--color-line);
    transition:
      border-color 150ms var(--ease-out-emil),
      box-shadow 150ms var(--ease-out-emil),
      transform 150ms var(--ease-out-emil);
  }
  .answer-field:focus {
    border-color: var(--color-cobalt-700);
    box-shadow: 4px 4px 0 var(--color-cobalt-300);
    outline: 0;
  }
  .answer-field.answer-correct {
    border-color: var(--color-mint-700);
    box-shadow: 4px 4px 0 var(--color-mint-200);
  }
  .answer-field.answer-wrong {
    border-color: var(--color-coral-700);
    box-shadow: 4px 4px 0 var(--color-coral-200);
  }
  .answer-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.8rem;
  }
  .hint-button {
    display: inline-flex;
    min-height: 2.45rem;
    align-items: center;
    gap: 0.4rem;
    border-bottom: 1px solid currentColor;
    color: var(--color-orange-700);
    font-size: 0.74rem;
    font-weight: 780;
  }
  .hint-button:disabled {
    cursor: default;
    opacity: 1;
  }
  .submit-button {
    width: 100%;
    margin-top: 1.25rem;
  }

  .choice-grid {
    display: grid;
    gap: 0.65rem;
  }
  .choice-button {
    display: grid;
    min-height: 4.65rem;
    grid-template-columns: 2rem minmax(0, 1fr);
    align-items: center;
    gap: 0.8rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem;
    color: var(--color-ink-950);
    background: white;
    padding: 0.85rem;
    text-align: left;
    box-shadow: 3px 3px 0 var(--color-line);
    transition:
      transform 140ms var(--ease-out-emil),
      box-shadow 140ms var(--ease-out-emil),
      background-color 150ms ease;
  }
  .choice-button:active:not(:disabled) {
    transform: translate(2px, 2px) scale(0.98);
    box-shadow: 1px 1px 0 var(--color-line);
  }
  .choice-button > span {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 800;
  }
  .choice-button strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .choice-button.choice-correct {
    border-color: var(--color-mint-700);
    background: var(--color-mint-50);
    box-shadow: 3px 3px 0 var(--color-mint-200);
  }
  .choice-button.choice-wrong {
    border-color: var(--color-coral-700);
    background: var(--color-coral-50);
    box-shadow: 3px 3px 0 var(--color-coral-200);
  }

  .sentence-canvas {
    display: flex;
    min-height: 7rem;
    flex-wrap: wrap;
    align-content: center;
    gap: 0.55rem;
    border: 2px solid var(--color-ink-950);
    border-radius: 0.25rem;
    background: white;
    padding: 1rem;
    box-shadow: inset 0 -1.5rem 0 rgb(196 255 47 / 0.08);
  }
  .sentence-canvas.empty {
    align-items: center;
    justify-content: center;
    color: var(--color-ink-600);
    font-size: 0.82rem;
    font-weight: 700;
  }
  .sentence-canvas button,
  .token-bank button {
    min-height: 2.65rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem;
    background: var(--color-paper-50);
    padding: 0.55rem 0.72rem;
    font-weight: 760;
    box-shadow: 2px 2px 0 var(--color-ink-950);
    transition:
      transform 120ms var(--ease-out-emil),
      box-shadow 120ms var(--ease-out-emil),
      opacity 120ms ease;
  }
  .sentence-canvas button:active,
  .token-bank button:active:not(:disabled) {
    transform: translate(1px, 1px) scale(0.97);
    box-shadow: 1px 1px 0 var(--color-ink-950);
  }
  .token-bank {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.55rem;
    margin-top: 1rem;
  }
  .token-bank button.selected {
    opacity: 0.18;
    box-shadow: none;
  }
  .word-order-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.7rem;
    margin-top: 1.2rem;
  }

  .cloze-sentence {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border-block: 1px solid var(--color-line);
    padding: 1.4rem 0.5rem;
    font-size: clamp(1.2rem, 4vw, 1.8rem);
    font-weight: 780;
    line-height: 1.5;
  }
  .cloze-sentence input {
    min-width: 7rem;
    border: 0;
    border-bottom: 3px solid var(--color-ink-950);
    color: var(--color-ink-950);
    background: var(--color-acid-100);
    padding: 0.18rem 0.4rem;
    font: inherit;
    text-align: center;
  }
  .cloze-sentence input:focus {
    border-color: var(--color-cobalt-700);
    outline: 0;
  }
  .cloze-sentence input.answer-correct {
    border-color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .cloze-sentence input.answer-wrong {
    border-color: var(--color-coral-700);
    background: var(--color-coral-50);
  }

  .sentence-zone textarea {
    width: 100%;
    resize: vertical;
    border: 2px solid var(--color-ink-950);
    border-radius: 0.25rem;
    color: var(--color-ink-950);
    background: white;
    padding: 1rem;
    font-size: 1.05rem;
    font-weight: 650;
    line-height: 1.55;
    box-shadow: 4px 4px 0 var(--color-cobalt-300);
  }
  .sentence-zone textarea:focus {
    box-shadow: 5px 5px 0 var(--color-cobalt-700);
    outline: 0;
  }
  .sentence-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 0.85rem;
  }
  .sentence-footer > span {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.67rem;
  }
  .spin {
    animation: spin 760ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .flash-zone {
    text-align: center;
  }
  .reveal-button {
    display: inline-flex;
    min-height: 4rem;
    align-items: center;
    gap: 0.6rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem;
    color: white;
    background: var(--color-ink-950);
    padding: 0.9rem 1.25rem;
    font-weight: 820;
    box-shadow: 5px 5px 0 var(--color-acid-500);
    transition:
      transform 140ms var(--ease-out-emil),
      box-shadow 140ms var(--ease-out-emil);
  }
  .reveal-button:active {
    transform: translate(3px, 3px) scale(0.97);
    box-shadow: 2px 2px 0 var(--color-acid-500);
  }
  .reveal-button + p {
    margin-top: 0.75rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.67rem;
  }
  .flash-answer {
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem;
    background: var(--color-acid-100);
    padding: 1.5rem 1rem;
    box-shadow: 5px 5px 0 var(--color-ink-950);
  }
  .flash-answer .plural {
    margin-top: 0.55rem;
    font-weight: 700;
  }
  .flash-answer .example {
    margin-top: 1rem;
    color: var(--color-ink-600);
    font-size: 0.86rem;
    font-style: italic;
  }
  .speak-button {
    display: grid;
    width: 2.7rem;
    height: 2.7rem;
    flex: none;
    place-items: center;
    border: 1px solid currentColor;
    border-radius: 999px;
    color: inherit;
    background: white;
    transition: transform 120ms var(--ease-out-emil);
  }
  .speak-button:active {
    transform: scale(0.95);
  }
  .rating-prompt {
    margin-top: 1.4rem;
    font-size: 0.82rem;
    font-weight: 800;
  }
  .rating-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
    margin-top: 0.75rem;
  }
  .rating {
    display: grid;
    min-height: 4.4rem;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    align-items: center;
    column-gap: 0.45rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem;
    background: white;
    padding: 0.65rem;
    text-align: left;
    box-shadow: 3px 3px 0 var(--color-line);
    transition:
      transform 130ms var(--ease-out-emil),
      box-shadow 130ms var(--ease-out-emil),
      background-color 140ms ease;
  }
  .rating:active {
    transform: translate(2px, 2px) scale(0.97);
    box-shadow: 1px 1px 0 var(--color-line);
  }
  .rating > span {
    grid-row: 1 / 3;
    display: grid;
    width: 1.8rem;
    height: 1.8rem;
    place-items: center;
    border-radius: 999px;
    background: var(--color-paper-100);
    font-family: var(--font-mono);
    font-size: 0.65rem;
  }
  .rating strong {
    font-size: 0.8rem;
  }
  .rating small {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.63rem;
  }

  .memory-plan {
    align-self: start;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem;
    background: var(--color-paper-50);
    padding: 1rem;
    box-shadow: 4px 4px 0 var(--color-cobalt-300);
  }
  .plan-heading {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    border-bottom: 1px solid var(--color-line);
    padding-bottom: 0.85rem;
  }
  .plan-heading > span {
    display: grid;
    width: 2.3rem;
    height: 2.3rem;
    flex: none;
    place-items: center;
    border-radius: 999px;
    color: white;
    background: var(--color-cobalt-700);
  }
  .plan-heading h2 {
    margin-top: 0.15rem;
    font-size: 1rem;
    font-weight: 850;
    letter-spacing: -0.025em;
  }
  .schedule-list {
    margin-top: 0.7rem;
  }
  .schedule-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.6rem;
    border-bottom: 1px solid var(--color-line);
    padding: 0.72rem 0.1rem;
  }
  .schedule-row.selected {
    margin-inline: -0.45rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.2rem;
    background: var(--color-acid-100);
    padding-inline: 0.45rem;
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .rating-dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    background: var(--color-line);
  }
  .rating-dot.again {
    background: var(--color-coral-700);
  }
  .rating-dot.hard {
    background: var(--color-orange-500);
  }
  .rating-dot.good {
    background: var(--color-mint-700);
  }
  .rating-dot.easy {
    background: var(--color-cobalt-700);
  }
  .schedule-row strong,
  .schedule-row small {
    display: block;
  }
  .schedule-row strong {
    font-size: 0.76rem;
  }
  .schedule-row small {
    margin-top: 0.08rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.62rem;
  }
  .schedule-row time {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    text-align: right;
  }
  .plan-footnote,
  .cram-note p {
    margin-top: 0.8rem;
    color: var(--color-ink-600);
    font-size: 0.72rem;
    line-height: 1.5;
  }
  .selected-plan {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    margin-top: 0.85rem;
    border: 1px solid var(--color-mint-700);
    background: var(--color-mint-50);
    padding: 0.75rem;
    color: var(--color-mint-700);
  }
  .selected-plan :global(svg) {
    flex: none;
    margin-top: 0.08rem;
  }
  .selected-plan p {
    color: var(--color-ink-800);
    font-size: 0.74rem;
    line-height: 1.45;
  }
  .cram-note {
    margin-top: 0.9rem;
    border: 1px solid var(--color-cobalt-700);
    padding: 0.65rem 0.75rem;
  }
  .cram-note strong {
    font-size: 0.8rem;
  }
  .margin-note {
    display: flex;
    align-items: flex-start;
    gap: 0.55rem;
    margin-top: 1rem;
    border-top: 1px dashed var(--color-coral-500);
    padding-top: 0.85rem;
    color: var(--color-coral-700);
  }
  .margin-note :global(svg) {
    flex: none;
  }
  .margin-note p {
    color: var(--color-ink-600);
    font-size: 0.72rem;
    line-height: 1.5;
  }

  .wait-sheet {
    display: grid;
    min-height: 30rem;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 1.5rem;
    margin-top: 1.25rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem;
    background: var(--color-paper-50);
    padding: clamp(1.5rem, 5vw, 4rem);
    box-shadow: 7px 7px 0 var(--color-ink-950);
  }
  .wait-number {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: clamp(2rem, 8vw, 5rem);
    font-weight: 900;
    line-height: 1;
  }
  .wait-sheet h1 {
    margin-top: 0.5rem;
    max-width: 36rem;
    font-size: clamp(2rem, 6vw, 4.6rem);
    font-weight: 900;
    line-height: 0.92;
    letter-spacing: -0.04em;
  }
  .wait-sheet p:last-of-type {
    max-width: 34rem;
    margin-top: 1rem;
    color: var(--color-ink-600);
    line-height: 1.65;
  }
  .error-message {
    margin-top: 1rem;
    border: 1px solid var(--color-coral-700);
    border-radius: 0.2rem;
    color: var(--color-coral-700);
    background: var(--color-coral-50);
    padding: 0.85rem;
    font-size: 0.82rem;
    font-weight: 700;
  }
  .keyboard-note {
    margin-top: 1.1rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-align: center;
  }

  @media (max-width: 899px) {
    .study-lab.active-session {
      display: grid;
      width: 100%;
      max-width: none;
      height: 100%;
      min-height: 0;
      grid-template-rows: auto minmax(0, 1fr);
      overflow: hidden;
      background: var(--color-paper-50);
    }
    .study-header {
      position: relative;
      z-index: 20;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.65rem;
      border-bottom: 1px solid var(--color-ink-950);
      background: rgb(255 253 247 / 0.96);
      padding: max(0.55rem, env(safe-area-inset-top)) 0.75rem 0.65rem;
      backdrop-filter: blur(14px);
    }
    .pause-study {
      min-height: 2.55rem;
      box-shadow: 2px 2px 0 var(--color-ink-950);
    }
    .session-meta {
      margin-bottom: 0.32rem;
      font-size: 0.61rem;
      letter-spacing: 0.045em;
    }
    .study-grid {
      height: 100%;
      min-height: 0;
      gap: 0;
      margin-top: 0;
      overflow: hidden;
    }
    .study-card {
      height: 100%;
      min-height: 0;
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
    .card-ruler {
      width: 2.1rem;
    }
    .question-area {
      height: 100%;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 0.85rem 0.8rem calc(1rem + env(safe-area-inset-bottom)) 2.85rem;
      scrollbar-width: none;
    }
    .question-area::-webkit-scrollbar {
      display: none;
    }
    .study-card.has-feedback .question-area {
      padding-bottom: min(52dvh, 26rem);
    }
    .memory-plan,
    .keyboard-note,
    .session-badges {
      display: none;
    }
    .wait-sheet {
      height: 100%;
      min-height: 0;
      margin-top: 0;
      border: 0;
      border-radius: 0;
      box-shadow: none;
      overflow-y: auto;
    }
    .error-message {
      position: fixed;
      z-index: 50;
      right: 0.75rem;
      bottom: calc(0.75rem + env(safe-area-inset-bottom));
      left: 0.75rem;
      margin: 0;
      box-shadow: 4px 4px 0 var(--color-ink-950);
    }
    .question-topline {
      gap: 0.45rem;
    }
    .exercise-pill {
      padding: 0.35rem 0.55rem;
      font-size: 0.59rem;
    }
    .word-stage {
      gap: 0.25rem;
    }
    .word-stage > span {
      padding: 0.28rem 0.42rem;
      font-size: 0.56rem;
    }
    .prompt {
      margin-top: clamp(1.35rem, 7dvh, 3rem);
    }
    .prompt-sentence {
      margin-top: clamp(1.15rem, 5dvh, 2.25rem);
    }
    .answer-zone,
    .cloze-zone,
    .sentence-zone,
    .word-order-zone,
    .choice-grid,
    .flash-zone {
      margin-top: clamp(1.15rem, 4dvh, 1.8rem);
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .choice-button:hover:not(:disabled),
    .rating:hover:not(:disabled),
    .sentence-canvas button:hover:not(:disabled),
    .token-bank button:hover:not(:disabled) {
      background: var(--color-acid-100);
    }
    .hint-button:hover {
      color: var(--color-coral-700);
    }
  }

  @media (min-width: 960px) and (max-height: 900px) {
    .study-scroll-shell {
      padding-bottom: max(1.25rem, var(--safe-bottom));
    }
  }

  @media (min-width: 640px) {
    .question-area {
      padding: 1.7rem 2rem 2rem 4.6rem;
    }
    .choice-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .rating-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (min-width: 900px) {
    .study-lab.active-session {
      padding: clamp(1rem, 3vh, 2rem) 1rem 2.5rem;
    }
    .study-header {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }
    .session-badges {
      display: flex;
    }
    .study-grid {
      grid-template-columns: minmax(0, 1fr) 18rem;
      gap: 1.35rem;
    }
    .memory-plan {
      position: sticky;
      top: 1rem;
    }
    .keyboard-note {
      font-size: 0.75rem;
    }
  }

  @media (max-width: 520px) {
    .pause-study {
      width: 2.6rem;
      min-height: 2.45rem;
      padding: 0;
    }
    .pause-study span {
      display: none;
    }
    .card-ruler {
      width: 1.9rem;
    }
    .question-area {
      padding: 0.7rem 0.7rem calc(0.8rem + env(safe-area-inset-bottom)) 2.55rem;
    }
    .question-topline {
      flex-wrap: nowrap;
    }
    .exercise-pill {
      flex: none;
      max-width: 43%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .word-stage {
      flex-wrap: nowrap;
      min-width: 0;
      overflow-x: auto;
    }
    .exercise-reason {
      display: none;
    }
    .prompt {
      margin-top: clamp(1rem, 5dvh, 2rem);
    }
    .prompt h1 {
      font-size: clamp(2.05rem, 12vw, 3.65rem);
      line-height: 0.92;
    }
    .prompt-context h1 {
      font-size: clamp(1.65rem, 8vw, 2.65rem);
    }
    .target-word h1,
    .target-word h2 {
      font-size: clamp(2rem, 10vw, 3.35rem);
    }
    .answer-zone,
    .cloze-zone,
    .sentence-zone,
    .word-order-zone,
    .choice-grid,
    .flash-zone {
      margin-top: clamp(0.95rem, 3.5dvh, 1.45rem);
    }
    .answer-label {
      margin-top: 0.7rem;
    }
    .answer-field {
      min-height: 3.55rem;
      padding: 0.7rem 0.8rem;
      font-size: 1.05rem;
      box-shadow: 3px 3px 0 var(--color-line);
    }
    .answer-tools {
      margin-top: 0.6rem;
    }
    .submit-button {
      min-height: 3rem;
      margin-top: 0.75rem;
    }
    .choice-grid {
      gap: 0.5rem;
    }
    .choice-button {
      min-height: 3.55rem;
      grid-template-columns: 1.75rem minmax(0, 1fr);
      gap: 0.6rem;
      padding: 0.65rem;
    }
    .choice-button > span {
      width: 1.65rem;
      height: 1.65rem;
    }
    .sentence-canvas {
      min-height: 4.7rem;
      padding: 0.7rem;
    }
    .sentence-canvas button,
    .token-bank button {
      min-height: 2.35rem;
      padding: 0.45rem 0.58rem;
    }
    .token-bank {
      gap: 0.42rem;
      margin-top: 0.7rem;
    }
    .word-order-actions {
      flex-direction: column-reverse;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }
    .word-order-actions .btn-base {
      width: 100%;
      min-height: 2.8rem;
    }
    .cloze-sentence {
      padding: 1rem 0.35rem;
      font-size: 1.15rem;
    }
    .sentence-zone textarea {
      min-height: 6rem;
      resize: none;
      padding: 0.75rem;
    }
    .sentence-footer {
      align-items: stretch;
      flex-direction: column;
      margin-top: 0.55rem;
    }
    .sentence-footer .btn-base {
      width: 100%;
      min-height: 2.9rem;
    }
    .flash-answer {
      padding: 1rem 0.75rem;
      box-shadow: 3px 3px 0 var(--color-ink-950);
    }
    .rating-prompt {
      margin-top: 0.9rem;
    }
    .rating-grid {
      gap: 0.4rem;
      margin-top: 0.55rem;
    }
    .rating {
      min-height: 3.55rem;
      padding: 0.5rem;
    }
  }
</style>
