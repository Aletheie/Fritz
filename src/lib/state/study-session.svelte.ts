import { fromStore, get } from 'svelte/store';
import { errorText } from '../domain/errors.ts';

import { evaluateSentence, getAiKeyStatus, requestExplanation } from '../client/ai.ts';
import { SpeechCapture } from '../client/speech-capture.svelte.ts';
import {
  clearLongTermSession,
  loadLongTermSession,
  saveLongTermSession,
} from '../client/study-session.ts';
import {
  buildClozeExercise,
  buildWordOrderExercise,
  gradeContextAnswer,
  gradeWordOrder,
  wordOrderAnswer,
} from '../domain/exercises/context.ts';
import { buildVocabularyMatchingExercise } from '../domain/exercises/matching.ts';
import {
  gradeChoiceAnswer,
  gradeGermanAnswer,
  signalForFlashcard,
} from '../domain/grading/grade.ts';
import { normalizeText, parseGermanAnswer } from '../domain/grading/normalize.ts';
import {
  chooseNextCramCard,
  cramProgress,
  createCramSession,
  recordCramReview,
} from '../domain/scheduler/cram.ts';
import { isMatureFsrsCard, previewSchedule } from '../domain/scheduler/fsrs.ts';
import {
  buildChoiceOptions,
  chooseAdaptiveExercise,
  filterCardsByTag,
  filterCardsForTraining,
  selectDistinctNoteCards,
  selectDueCardsForTraining,
} from '../domain/scheduler/queue.ts';
import {
  chooseNextLongTermCard,
  createLongTermSessionDraft,
  reconcileLongTermSessionCards,
  recordLongTermSessionReview,
} from '../domain/scheduler/session.ts';
import { DEFAULT_EXERCISE_PREFERENCES } from '../domain/settings/defaults.ts';
import { remainingDailyNewCards } from '../domain/stats/learning.ts';
import { parseSourceFilter, type StudyStartOptions } from '../domain/study/params.ts';
import {
  choiceResult,
  clozeResult,
  disputedResult,
  isCleanAnswer,
  matchingResult,
  sentenceResult,
  speakingResult,
  typingResult,
  wordOrderResult,
  type PendingStudyResult,
} from '../domain/study/results.ts';
import { displayGerman } from '../domain/vocabulary/display.ts';
import { sortedVocabularyTags } from '../domain/vocabulary/tags.ts';
import { localized } from '../i18n/index.ts';
import { noteMeaning } from '../i18n/vocabulary.ts';
import { appStore, dailyProgress, gameProgress, motherTongue } from './app.ts';

import type { AiExplanationResult } from '../domain/ai/types.ts';
import type {
  ClozeExercise,
  WordOrderExercise,
  WordOrderToken,
} from '../domain/exercises/context.ts';
import type { VocabularyMatchingExercise } from '../domain/exercises/matching.ts';
import type { CramSessionState } from '../domain/scheduler/cram.ts';
import type { SchedulePreviewOption } from '../domain/scheduler/fsrs.ts';
import type { LongTermSessionDraft } from '../domain/scheduler/session.ts';
import type { StudyResult } from '../domain/study/types.ts';
import type {
  Article,
  ExerciseKind,
  MotherTongue,
  Note,
  RatingKey,
  ReviewDisputeReason,
  ReviewLog,
  StudyCard,
  StudyMode,
  TrainingSourceFilter,
} from '../domain/types.ts';

/**
 * What the study screen shows. Derived from the session fields so that the
 * template never has to combine several boolean flags itself.
 */
export type StudyPhase = 'loading' | 'setup' | 'complete' | 'waiting' | 'question' | 'preparing';

const FLASHCARD_RATINGS: RatingKey[] = ['again', 'hard', 'good', 'easy'];
const TEXT_EXERCISES = new Set<ExerciseKind>(['typing', 'cloze', 'sentence', 'speaking']);
const CRAM_QUEUE_LIMIT = 60;

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Owns one vocabulary practice run: setup, queue, the active card, grading, AI help
 * and speech. Objects handed to the repository are kept raw, never deep proxies.
 */
export class StudySession {
  // Configuration
  mode = $state<StudyMode>('long-term');
  cramDuration = $state(20);
  sessionSize = $state(10);
  selectedTag = $state('all');
  sourceFilter = $state<TrainingSourceFilter>('all');
  distinct = $state(false);
  initialized = $state(false);
  cramConfigured = $state(true);
  longTermConfigured = $state(false);
  aiAvailable = $state(false);

  // Queue
  queue = $state.raw<StudyCard[]>([]);
  currentIndex = $state(0);
  target = $state(0);
  completedCount = $state(0);
  cram = $state.raw<CramSessionState | undefined>(undefined);
  activeDraft = $state.raw<LongTermSessionDraft | undefined>(undefined);
  resumable = $state.raw<LongTermSessionDraft | undefined>(undefined);
  remainingDueCount = $state(0);
  waitMs = $state(0);
  nextPlannedAt = $state<string | undefined>(undefined);
  completed = $state(false);
  errorMessage = $state('');

  // Session stats
  reviews = $state(0);
  successes = $state(0);
  xp = $state(0);
  combo = $state(0);
  bestCombo = $state(0);
  startLevel = $state(1);
  startCompletedMissions = $state(0);
  startGoalReached = $state(false);

  // Active card
  /** Increments for every new prompt so answer components remount and refocus. */
  cardRun = $state(0);
  /** Increments whenever the active answer field should take focus again. */
  focusRequest = $state(0);
  card = $state.raw<StudyCard | undefined>(undefined);
  note = $state.raw<Note | undefined>(undefined);
  exercise = $state<ExerciseKind>('typing');
  exerciseReason = $state('');
  choices = $state.raw<Note[]>([]);
  wordOrder = $state.raw<WordOrderExercise | undefined>(undefined);
  selectedTokens = $state.raw<WordOrderToken[]>([]);
  cloze = $state.raw<ClozeExercise | undefined>(undefined);
  matching = $state.raw<VocabularyMatchingExercise | undefined>(undefined);
  matchingMistakes = $state(0);
  matchingComplete = $state(false);
  answer = $state('');
  selectedArticle = $state<Article | undefined>(undefined);
  revealed = $state(false);
  result = $state.raw<StudyResult | undefined>(undefined);
  reviewing = $state(false);
  correction = $state('');
  correctionArticle = $state<Article | undefined>(undefined);
  hintVisible = $state(false);
  hintsUsed = $state(0);
  scheduleOptions = $state.raw<SchedulePreviewOption[]>([]);
  disputing = $state(false);

  // AI
  aiBusy = $state(false);
  aiExplanation = $state.raw<AiExplanationResult | undefined>(undefined);
  aiExplanationError = $state('');

  readonly speech = new SpeechCapture();

  #startedAt = 0;
  #submittedForExplanation = '';
  #lastSavedReviewId: string | undefined;
  #waitTimer: number | undefined;
  #explanationController: AbortController | undefined;
  #sentenceController: AbortController | undefined;

  // ---------------------------------------------------------------------------
  // Store access

  #appState = fromStore(appStore);
  #language = fromStore(motherTongue);

  /** Reactive inside templates and deriveds, a plain snapshot read elsewhere. */
  get #app() {
    return this.#appState.current;
  }

  get language(): MotherTongue {
    return this.#language.current;
  }

  copy(cs: string, en: string): string {
    return localized(this.language, { cs, en });
  }

  get #dailyNewAllowance(): number {
    const app = this.#app;
    return remainingDailyNewCards(app.recentReviews, app.settings?.dailyNewLimit ?? 15, new Date());
  }

  // ---------------------------------------------------------------------------
  // Derived view state

  get phase(): StudyPhase {
    if (!this.initialized) return 'loading';
    if (this.mode === 'long-term' && !this.longTermConfigured) return 'setup';
    if (this.mode === 'cram' && !this.cramConfigured) return 'setup';
    if (this.completed) return 'complete';
    if (this.waitMs > 0) return 'waiting';
    if (this.card && this.note) return 'question';
    return 'preparing';
  }

  get meaning(): string {
    return this.note ? noteMeaning(this.note, this.language) : '';
  }

  get sprintProgress(): { mastered: number; total: number; percent: number } {
    return this.cram ? cramProgress(this.cram) : { mastered: 0, total: 0, percent: 0 };
  }

  get progress(): number {
    if (this.mode === 'cram') return this.sprintProgress.percent;
    return this.target === 0 ? 0 : Math.round((this.completedCount / this.target) * 100);
  }

  get wordOrderReady(): boolean {
    return Boolean(this.wordOrder && this.selectedTokens.length === this.wordOrder.tokens.length);
  }

  get correctionReady(): boolean {
    const note = this.note;
    if (!this.#app.settings?.requireCorrection) return true;
    if (!note) return false;
    const wordReady =
      normalizeText(parseGermanAnswer(this.correction).word) === normalizeText(note.german);
    return wordReady && (!note.article || this.correctionArticle === note.article);
  }

  get nextAllowed(): boolean {
    const result = this.result;
    if (!result) return false;
    return (
      Boolean(result.disputed) ||
      result.correct ||
      (this.exercise !== 'typing' && this.exercise !== 'speaking') ||
      this.correctionReady
    );
  }

  get resumeSummary() {
    const draft = this.resumable;
    return draft
      ? {
          remaining: draft.remainingCardIds.length,
          total: draft.cardIds.length,
          selectedTag: draft.selectedTag,
          updatedAt: draft.updatedAt,
          sourceFilter: draft.sourceFilter,
        }
      : undefined;
  }

  availableTags(notes: Note[]): string[] {
    return sortedVocabularyTags(notes, 'cs');
  }

  cramCards(tag = this.selectedTag): StudyCard[] {
    const app = this.#app;
    return filterCardsByTag(app.cards, app.notes, tag);
  }

  dueCards(
    tag: string,
    limit: number,
    newLimit = this.#dailyNewAllowance,
    source = this.sourceFilter,
  ): StudyCard[] {
    const app = this.#app;
    return selectDueCardsForTraining(
      app.cards,
      app.notes,
      { tag, source },
      new Date(),
      limit,
      newLimit,
    );
  }

  dueCount(tag: string, newLimit = this.#dailyNewAllowance, source = this.sourceFilter): number {
    return this.dueCards(tag, this.#app.cards.length, newLimit, source).length;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle

  async initialize(options: StudyStartOptions): Promise<void> {
    this.speech.detect();
    this.mode = options.mode;
    this.cramDuration = options.cramDuration;
    this.sessionSize = options.sessionSize ?? 10;
    this.distinct = options.distinct;
    this.selectedTag = options.tag;
    this.cramConfigured = options.mode !== 'cram' || options.autoStart;

    await appStore.initialize();
    const app = this.#app;
    if (options.sessionSize === undefined) this.sessionSize = app.settings?.dailyMinutes ?? 10;
    this.sourceFilter = parseSourceFilter(
      options.source,
      app.settings?.trainingSourceFilter ?? 'all',
    );
    try {
      // Demo responses work without a key, so any status answer means AI tools are usable.
      await getAiKeyStatus();
      this.aiAvailable = true;
    } catch {
      this.aiAvailable = false;
    }
    const tags = this.availableTags(this.#app.notes);
    if (this.selectedTag !== 'all' && !tags.includes(this.selectedTag)) this.selectedTag = 'all';
    this.resumable = this.#reconcileStoredDraft(tags);
    this.initialized = true;

    if (this.mode === 'long-term' && options.resume && this.resumable) {
      this.resume();
    } else if (options.autoStart) {
      this.start();
    }
  }

  #reconcileStoredDraft(tags: string[]): LongTermSessionDraft | undefined {
    const draft = loadLongTermSession();
    if (!draft) return undefined;
    const remaining = reconcileLongTermSessionCards(draft, this.#app.cards, new Date());
    if (remaining.length === 0) {
      clearLongTermSession();
      return undefined;
    }
    const tagMissing = draft.selectedTag !== 'all' && !tags.includes(draft.selectedTag);
    if (remaining.length === draft.remainingCardIds.length && !tagMissing) return draft;
    const reconciled: LongTermSessionDraft = {
      ...draft,
      selectedTag: tagMissing ? 'all' : draft.selectedTag,
      remainingCardIds: remaining.map((card) => card.id),
      updatedAt: new Date().toISOString(),
    };
    saveLongTermSession(reconciled);
    return reconciled;
  }

  destroy(): void {
    this.pause();
    this.#clearWaitTimer();
    this.#explanationController?.abort();
    this.#sentenceController?.abort();
    this.speech.stop(true);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  pause(): void {
    if (this.mode === 'long-term' && this.activeDraft) saveLongTermSession(this.activeDraft);
  }

  #resetStats(draft?: LongTermSessionDraft): void {
    const game = get(gameProgress);
    this.reviews = draft?.reviews ?? 0;
    this.successes = draft?.successes ?? 0;
    this.xp = draft?.xp ?? 0;
    this.combo = draft?.combo ?? 0;
    this.bestCombo = draft?.bestCombo ?? 0;
    this.startLevel = game.level.level;
    this.startCompletedMissions = game.missionSummary.completed;
    this.startGoalReached = get(dailyProgress).reached;
    this.completed = false;
    this.errorMessage = '';
    this.waitMs = 0;
    this.nextPlannedAt = undefined;
    this.remainingDueCount = 0;
    this.currentIndex = 0;
  }

  start(): void {
    this.#clearWaitTimer();
    this.#explanationController?.abort();
    this.#sentenceController?.abort();
    this.#resetStats();
    this.target = 0;
    this.completedCount = 0;

    if (this.mode === 'long-term') {
      clearLongTermSession();
      this.resumable = undefined;
      this.queue = this.distinct
        ? selectDistinctNoteCards(
            this.dueCards(this.selectedTag, this.#app.cards.length),
            this.sessionSize,
          )
        : this.dueCards(this.selectedTag, this.sessionSize);
      if (this.queue.length === 0) {
        this.longTermConfigured = false;
        this.errorMessage = this.copy(
          'V tomto výběru teď není nic k opakování.',
          'No words are due for this filter right now.',
        );
        return;
      }
      this.activeDraft = createLongTermSessionDraft(
        this.queue,
        this.selectedTag,
        this.sessionSize,
        new Date(),
        this.sourceFilter,
      );
      saveLongTermSession(this.activeDraft);
      this.target = this.queue.length;
      this.longTermConfigured = true;
      this.#loadNextLongTermCard();
      return;
    }

    const cards = this.cramCards();
    this.queue = this.distinct
      ? selectDistinctNoteCards(cards, CRAM_QUEUE_LIMIT)
      : cards.slice(0, CRAM_QUEUE_LIMIT);
    if (this.queue.length === 0) {
      this.cramConfigured = false;
      this.errorMessage = this.copy(
        'Pro tento výběr nejsou žádná slovíčka.',
        'There are no words in this selection.',
      );
      return;
    }
    this.cram = createCramSession(this.queue, this.cramDuration, new Date());
    this.#loadNextCramCard();
  }

  startConfiguredLongTerm(): void {
    if (this.dueCount(this.selectedTag) === 0) return;
    this.longTermConfigured = true;
    this.start();
  }

  startConfiguredCram(): void {
    if (this.cramCards().length === 0) return;
    this.cramConfigured = true;
    this.start();
  }

  resume(): void {
    const draft = this.resumable ?? loadLongTermSession();
    if (!draft) {
      this.longTermConfigured = false;
      return;
    }
    const remaining = reconcileLongTermSessionCards(draft, this.#app.cards, new Date());
    if (remaining.length === 0) {
      clearLongTermSession();
      this.resumable = undefined;
      this.longTermConfigured = false;
      return;
    }

    this.#clearWaitTimer();
    this.selectedTag = draft.selectedTag;
    this.sourceFilter = draft.sourceFilter;
    this.sessionSize = draft.requestedSize;
    this.queue = remaining;
    this.target = draft.cardIds.length;
    this.completedCount = Math.max(0, draft.cardIds.length - remaining.length);
    this.#resetStats(draft);
    this.activeDraft = {
      ...draft,
      remainingCardIds: remaining.map((card) => card.id),
      updatedAt: new Date().toISOString(),
    };
    this.resumable = undefined;
    this.longTermConfigured = true;
    saveLongTermSession(this.activeDraft);
    this.#loadNextLongTermCard();
  }

  #clearActiveCard(): void {
    this.card = undefined;
    this.note = undefined;
  }

  resetSetup(): void {
    this.#clearWaitTimer();
    this.completed = false;
    this.#clearActiveCard();
    this.errorMessage = '';
    if (this.mode === 'cram') {
      this.cramConfigured = false;
      this.cram = undefined;
    } else {
      this.longTermConfigured = false;
      this.activeDraft = undefined;
    }
  }

  changeSourceFilter(value: TrainingSourceFilter): void {
    this.sourceFilter = value;
    if (this.#app.settings?.trainingSourceFilter === value) return;
    void appStore.updateSettings({ trainingSourceFilter: value }).catch(() => {
      this.errorMessage = this.copy(
        'Volbu zdroje se nepodařilo uložit. Pro tuto relaci ale zůstává aktivní.',
        'The source filter could not be saved, but it remains active for this session.',
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Queue progression

  #clearWaitTimer(): void {
    if (this.#waitTimer !== undefined) window.clearInterval(this.#waitTimer);
    this.#waitTimer = undefined;
  }

  #beginWait(milliseconds: number, onReady: () => void): void {
    this.#clearWaitTimer();
    this.waitMs = Math.max(0, milliseconds);
    this.#clearActiveCard();
    const target = Date.now() + this.waitMs;
    this.#waitTimer = window.setInterval(() => {
      this.waitMs = Math.max(0, target - Date.now());
      if (this.waitMs <= 0) {
        this.#clearWaitTimer();
        onReady();
      }
    }, 250);
  }

  #earliestFutureDue(): string | undefined {
    const app = this.#app;
    const now = Date.now();
    const cards =
      this.mode === 'long-term'
        ? filterCardsForTraining(app.cards, app.notes, {
            tag: this.selectedTag,
            source: this.sourceFilter,
          })
        : app.cards;
    let earliest: string | undefined;
    let earliestTime = Number.POSITIVE_INFINITY;
    for (const card of cards) {
      const dueAt = Date.parse(card.dueAt);
      if (dueAt > now && dueAt < earliestTime) {
        earliest = card.dueAt;
        earliestTime = dueAt;
      }
    }
    return earliest;
  }

  #complete(nextDueAt?: string): void {
    this.#clearWaitTimer();
    if (this.mode === 'long-term') {
      const remaining = this.dueCards(this.selectedTag, this.#app.cards.length);
      this.remainingDueCount = remaining.length;
      nextDueAt = nextDueAt ?? remaining[0]?.dueAt;
      this.activeDraft = undefined;
      this.resumable = undefined;
      clearLongTermSession();
    }
    this.completed = true;
    this.waitMs = 0;
    this.nextPlannedAt = nextDueAt ?? this.#earliestFutureDue();
    this.#clearActiveCard();
  }

  #loadNextLongTermCard(): void {
    const next = chooseNextLongTermCard(this.queue, this.currentIndex, new Date());
    if (next.complete || next.index === undefined) {
      this.#complete();
      return;
    }
    if (next.waitMs > 0) {
      this.#complete(this.queue[next.index]?.dueAt);
      return;
    }
    if (next.index !== this.currentIndex) {
      const queue = [...this.queue];
      [queue[this.currentIndex], queue[next.index]] = [queue[next.index], queue[this.currentIndex]];
      this.queue = queue;
    }
    this.#setCard(this.queue[this.currentIndex]);
  }

  #loadNextCramCard(): void {
    const cram = this.cram;
    if (!cram) return;
    if (Date.now() >= new Date(cram.endsAt).getTime()) {
      this.#complete();
      return;
    }
    const next = chooseNextCramCard(cram, new Date());
    if (next.complete || !next.cardId) {
      this.#complete();
      return;
    }
    if (next.waitMs > 0) {
      this.#beginWait(next.waitMs, () => this.#loadNextCramCard());
      return;
    }
    const card = this.queue.find((candidate) => candidate.id === next.cardId);
    if (!card) {
      this.errorMessage = this.copy(
        'Jednu kartičku se nepodařilo najít. Zkus procvičování spustit znovu.',
        'A card could not be found. Try restarting the practice session.',
      );
      this.#complete();
      return;
    }
    this.#setCard(card);
  }

  #safeSchedulePreview(card: StudyCard, now = new Date()): SchedulePreviewOption[] {
    if (this.mode !== 'long-term') return [];
    try {
      return previewSchedule(card, this.#app.settings?.desiredRetention ?? 0.9, now);
    } catch {
      return [];
    }
  }

  #chooseExercise(card: StudyCard, note: Note): void {
    const app = this.#app;
    const language = this.language;
    const decision = chooseAdaptiveExercise({
      card,
      note,
      notes: app.notes,
      reviews: app.recentReviews,
      preferences: app.settings?.exercisePreferences ?? DEFAULT_EXERCISE_PREFERENCES,
      sessionIndex: this.reviews,
      aiAvailable: this.aiAvailable,
      language,
    });
    let exercise = decision.kind;
    this.exerciseReason = decision.reason;
    this.choices =
      exercise === 'choice' ? buildChoiceOptions(note, app.notes, 4, this.reviews) : [];
    this.wordOrder =
      exercise === 'word-order' ? buildWordOrderExercise(note, this.reviews, language) : undefined;
    this.cloze =
      exercise === 'cloze' ? buildClozeExercise(note, this.reviews, language) : undefined;
    this.matching =
      exercise === 'matching'
        ? buildVocabularyMatchingExercise(note, app.notes, 4, this.reviews, language)
        : undefined;

    if (exercise === 'choice' && this.choices.length < 2) exercise = 'typing';
    if (exercise === 'word-order' && !this.wordOrder) exercise = 'typing';
    if (exercise === 'sentence' && !this.aiAvailable) exercise = 'typing';
    if (exercise === 'matching' && !this.matching) exercise = 'typing';
    this.exercise = exercise;
  }

  #setCard(card: StudyCard): void {
    this.#clearWaitTimer();
    this.#explanationController?.abort();
    this.#sentenceController?.abort();
    this.speech.stop(true);
    const note = this.#app.notes.find((candidate) => candidate.id === card.noteId);
    this.card = card;
    this.note = note;
    if (!note) {
      this.errorMessage = this.copy(
        'Ke kartě chybí slovíčko.',
        'The word for this card is missing.',
      );
      this.#complete();
      return;
    }

    this.#chooseExercise(card, note);
    this.answer = '';
    this.selectedArticle = undefined;
    this.selectedTokens = [];
    this.matchingMistakes = 0;
    this.matchingComplete = false;
    this.speech.reset(
      this.exercise === 'speaking' && !this.speech.available
        ? this.copy(
            'Rozpoznání řeči tu není dostupné. Odpověď můžeš napsat ručně.',
            'Speech recognition is not available here. You can type the answer instead.',
          )
        : '',
    );
    this.revealed = false;
    this.result = undefined;
    this.#lastSavedReviewId = undefined;
    this.disputing = false;
    this.correction = '';
    this.correctionArticle = undefined;
    this.hintVisible = false;
    this.hintsUsed = 0;
    this.aiExplanation = undefined;
    this.aiExplanationError = '';
    this.#submittedForExplanation = '';
    this.scheduleOptions = this.#safeSchedulePreview(card);
    this.#startedAt = performance.now();
    this.waitMs = 0;
    this.cardRun += 1;
    if (TEXT_EXERCISES.has(this.exercise)) this.focusRequest += 1;
  }

  advance(): void {
    if (this.reviewing) return;
    if (this.mode === 'long-term') {
      this.currentIndex += 1;
      this.#loadNextLongTermCard();
      return;
    }
    this.#loadNextCramCard();
  }

  // ---------------------------------------------------------------------------
  // Saving results

  #responseTime(): number {
    return Math.max(0, Math.round(performance.now() - this.#startedAt));
  }

  #errorText(error: unknown, fallbackCs: string, fallbackEn: string): string {
    return errorText(error, this.language, { cs: fallbackCs, en: fallbackEn });
  }

  #canSubmit(): boolean {
    return Boolean(this.card && this.note && !this.result && !this.reviewing);
  }

  async #save(
    pending: PendingStudyResult,
  ): Promise<{ card: StudyCard; log: ReviewLog } | undefined> {
    const card = this.card;
    const note = this.note;
    if (!card || !note || this.reviewing) return undefined;
    const mode = this.mode;
    const reviewedAt = new Date();
    const preview = this.#safeSchedulePreview(card, reviewedAt);
    this.reviewing = true;
    this.errorMessage = '';
    try {
      const saved = await appStore.review({
        card,
        note,
        mode,
        rating: pending.rating,
        signal: pending.signal,
        now: reviewedAt,
      });
      const xp = saved.log.xpAwarded ?? 0;
      const passed = pending.rating !== 'again';
      this.#lastSavedReviewId = saved.log.id;
      this.result = {
        ...pending,
        xp,
        scheduledFor: mode === 'long-term' ? saved.card.dueAt : undefined,
        schedulePreview: mode === 'long-term' ? preview : undefined,
      };
      this.reviews += 1;
      this.xp += xp;
      if (passed) this.successes += 1;
      this.combo = isCleanAnswer(pending) ? this.combo + 1 : 0;
      this.bestCombo = Math.max(this.bestCombo, this.combo);

      if (mode === 'long-term' && this.activeDraft) {
        this.activeDraft = {
          ...recordLongTermSessionReview(this.activeDraft, card.id, passed, xp, reviewedAt),
          combo: this.combo,
          bestCombo: this.bestCombo,
        };
        this.completedCount = Math.min(
          this.target,
          this.target - this.activeDraft.remainingCardIds.length,
        );
        saveLongTermSession(this.activeDraft);
      } else if (mode === 'cram' && this.cram) {
        this.cram = recordCramReview(this.cram, card.id, pending.rating, new Date());
      }

      if (pending.correct && this.#app.settings?.autoSpeakGerman) {
        window.setTimeout(() => this.speak(note), 100);
      }
      return saved;
    } catch (error) {
      this.result = undefined;
      this.errorMessage = this.#errorText(
        error,
        'Výsledek se nepodařilo uložit.',
        'The result could not be saved.',
      );
      return undefined;
    } finally {
      this.reviewing = false;
    }
  }

  async dispute(reason: ReviewDisputeReason): Promise<void> {
    const previous = this.result;
    const reviewId = this.#lastSavedReviewId;
    if (
      !reviewId ||
      !previous ||
      previous.disputed ||
      this.disputing ||
      (reason === 'ai-too-strict' && !previous.aiSentenceEvaluation)
    ) {
      return;
    }
    this.disputing = true;
    this.errorMessage = '';
    try {
      await appStore.disputeReview(reviewId, reason);
      const cardId = this.card?.id;
      const restoredCard = cardId ? this.#app.cards.find((card) => card.id === cardId) : undefined;
      const passed = previous.rating !== 'again';
      this.xp = Math.max(0, this.xp - previous.xp);
      if (passed) this.successes = Math.max(0, this.successes - 1);
      this.reviews = Math.max(0, this.reviews - 1);
      this.combo = 0;
      if (this.mode === 'long-term' && restoredCard) {
        this.#requeueDisputed(restoredCard, reason === 'ai-too-strict', previous.xp, passed);
      }
      this.result = disputedResult(previous, reason, this.language);
    } catch (error) {
      this.errorMessage = this.#errorText(
        error,
        'Reklamaci se nepodařilo uložit.',
        'The dispute could not be saved.',
      );
    } finally {
      this.disputing = false;
    }
  }

  #requeueDisputed(card: StudyCard, retry: boolean, xp: number, passed: boolean): void {
    if (retry) this.queue = [...this.queue, card];
    const draft = this.activeDraft;
    if (!draft) return;
    const remainingCardIds =
      retry && !draft.remainingCardIds.includes(card.id)
        ? [...draft.remainingCardIds, card.id]
        : draft.remainingCardIds;
    this.activeDraft = {
      ...draft,
      remainingCardIds,
      reviews: Math.max(0, draft.reviews - 1),
      successes: Math.max(0, draft.successes - (passed ? 1 : 0)),
      xp: Math.max(0, draft.xp - xp),
      combo: 0,
      updatedAt: new Date().toISOString(),
    };
    if (retry) {
      this.completedCount = Math.min(this.target, this.target - remainingCardIds.length);
    }
    saveLongTermSession(this.activeDraft);
  }

  // ---------------------------------------------------------------------------
  // Exercise submissions

  #gradeGerman(selectedArticle: Article | undefined, hintsUsed: number) {
    const note = this.note as Note;
    return gradeGermanAnswer({
      expectedGerman: note.german,
      acceptedGerman: note.acceptedGerman,
      expectedArticle: note.article,
      selectedArticle,
      submittedText: this.answer,
      responseMs: this.#responseTime(),
      hintsUsed,
      attempt: 1,
      allowKeyboardFallback: this.#app.settings?.allowKeyboardFallback ?? true,
      isMatureCard: isMatureFsrsCard(this.card as StudyCard),
    });
  }

  async submitTyping(): Promise<void> {
    if (!this.#canSubmit() || !this.answer.trim()) return;
    this.#submittedForExplanation = this.answer;
    const graded = this.#gradeGerman(this.selectedArticle, this.hintsUsed);
    await this.#save(typingResult(graded, this.language));
  }

  async submitSpeaking(): Promise<void> {
    if (!this.#canSubmit() || !this.answer.trim()) return;
    this.speech.stop(true);
    this.#submittedForExplanation = this.answer;
    const graded = this.#gradeGerman(undefined, 0);
    await this.#save(speakingResult(graded, this.language));
  }

  async submitMatching(mistakes = this.matchingMistakes): Promise<void> {
    const note = this.note;
    const matching = this.matching;
    if (!note || !matching || this.result || this.reviewing) return;
    this.matchingMistakes = mistakes;
    this.matchingComplete = true;
    const saved = await this.#save(
      matchingResult(note, matching, mistakes, this.#responseTime(), this.language),
    );
    if (!saved) {
      this.errorMessage ||= this.copy(
        'Výsledek párování se nepodařilo uložit.',
        'The matching result could not be saved.',
      );
    }
  }

  async choose(option: Note): Promise<void> {
    const note = this.note;
    if (!note || this.result || this.reviewing) return;
    this.#submittedForExplanation = displayGerman(option);
    const graded = gradeChoiceAnswer({
      selected: option.id,
      expected: note.id,
      responseMs: this.#responseTime(),
    });
    await this.#save(choiceResult(graded, option, note, this.language));
  }

  selectToken(token: WordOrderToken): void {
    if (this.result || this.selectedTokens.some((selected) => selected.id === token.id)) return;
    this.selectedTokens = [...this.selectedTokens, token];
  }

  removeToken(token: WordOrderToken): void {
    if (this.result) return;
    this.selectedTokens = this.selectedTokens.filter((candidate) => candidate.id !== token.id);
  }

  clearTokens(): void {
    if (!this.result) this.selectedTokens = [];
  }

  async submitWordOrder(): Promise<void> {
    const exercise = this.wordOrder;
    if (!exercise || !this.wordOrderReady || this.result || this.reviewing) return;
    const graded = gradeWordOrder(this.selectedTokens, exercise);
    const submitted = wordOrderAnswer(this.selectedTokens);
    this.#submittedForExplanation = submitted;
    await this.#save(
      wordOrderResult(graded, exercise, submitted, this.#responseTime(), this.language),
    );
  }

  async submitCloze(): Promise<void> {
    const exercise = this.cloze;
    if (!exercise || !this.answer.trim() || this.result || this.reviewing) return;
    const graded = gradeContextAnswer({
      submitted: this.answer,
      accepted: exercise.acceptedAnswers,
      allowKeyboardFallback: this.#app.settings?.allowKeyboardFallback ?? true,
    });
    this.#submittedForExplanation = this.answer;
    await this.#save(
      clozeResult(graded, exercise, this.answer, this.#responseTime(), this.language),
    );
  }

  async submitSentence(): Promise<void> {
    const note = this.note;
    if (!note || !this.answer.trim() || this.result || this.reviewing || this.aiBusy) return;
    this.#sentenceController?.abort();
    const controller = new AbortController();
    this.#sentenceController = controller;
    this.aiBusy = true;
    this.errorMessage = '';
    const sentence = this.answer;
    try {
      const evaluation = await evaluateSentence(
        {
          motherTongue: this.language,
          german: note.german,
          czech: this.meaning,
          kind: note.kind,
          article: note.article,
          plural: note.plural,
          verbForms: note.verbForms,
          sentence: sentence.trim(),
        },
        controller.signal,
      );
      await this.#save(sentenceResult(evaluation, note, sentence, this.#responseTime()));
    } catch (error) {
      if (isAbort(error)) return;
      this.errorMessage = this.#errorText(
        error,
        'Větu se nepodařilo vyhodnotit.',
        'The sentence could not be evaluated.',
      );
    } finally {
      this.aiBusy = false;
    }
  }

  async rateFlashcard(rating: RatingKey): Promise<void> {
    const note = this.note;
    if (!note || !this.card || this.reviewing) return;
    const saved = await this.#save({
      rating,
      correct: rating !== 'again',
      message: '',
      expectedDisplay: displayGerman(note),
      signal: signalForFlashcard(rating, this.#responseTime()),
    });
    if (saved) this.advance();
  }

  // ---------------------------------------------------------------------------
  // Help: hints, speech, AI explanation

  revealHint(): void {
    if (this.hintVisible || this.result || !this.note) return;
    this.hintVisible = true;
    this.hintsUsed += 1;
  }

  speak(note: Note | undefined = this.note): void {
    if (!note || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(displayGerman(note));
    utterance.lang = 'de-DE';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  toggleSpeech(): void {
    if (this.speech.listening) {
      this.speech.stop();
      return;
    }
    if (this.result || this.reviewing) return;
    this.speech.start(this.language, {
      ontranscript: (transcript) => {
        this.answer = transcript;
      },
      onend: () => {
        this.focusRequest += 1;
      },
    });
  }

  async explainMistake(): Promise<void> {
    const note = this.note;
    const result = this.result;
    if (!note || !result || result.correct || this.aiBusy || !this.aiAvailable) return;
    this.#explanationController?.abort();
    const controller = new AbortController();
    this.#explanationController = controller;
    this.aiBusy = true;
    this.aiExplanation = undefined;
    this.aiExplanationError = '';
    try {
      this.aiExplanation = await requestExplanation(
        {
          motherTongue: this.language,
          german: note.german,
          czech: this.meaning,
          article: note.article,
          kind: note.kind,
          submitted: this.#submittedForExplanation,
          selectedArticle: result.signal.selectedArticle,
          wordCorrect: result.signal.wordCorrect,
          articleCorrect: result.signal.articleCorrect,
          keyboardEquivalent: result.signal.keyboardEquivalent,
          editDistance: result.signal.editDistance,
          learningNote: this.language === 'cs' ? note.learningNote : undefined,
        },
        controller.signal,
      );
    } catch (error) {
      if (isAbort(error)) return;
      this.aiExplanationError = this.#errorText(
        error,
        'Vysvětlení se nepodařilo načíst.',
        'The explanation could not be loaded.',
      );
    } finally {
      this.aiBusy = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts

  handleKeydown(event: KeyboardEvent): void {
    if (this.completed || this.reviewing || !this.card || !this.note) return;
    const exercise = this.exercise;
    const result = this.result;

    if (exercise === 'sentence' && (event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!result) void this.submitSentence();
      else if (this.nextAllowed) this.advance();
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
        if (exercise === 'typing') void this.submitTyping();
        else if (exercise === 'cloze') void this.submitCloze();
        else if (!this.speech.listening) void this.submitSpeaking();
      } else if (this.nextAllowed) this.advance();
      return;
    }

    if (exercise === 'word-order' && event.key === 'Enter') {
      event.preventDefault();
      if (!result && this.wordOrderReady) void this.submitWordOrder();
      else if (result && this.nextAllowed) this.advance();
      return;
    }

    if (exercise === 'choice' && !result && ['1', '2', '3', '4'].includes(event.key)) {
      const option = this.choices[Number(event.key) - 1];
      if (option) void this.choose(option);
      return;
    }

    if (exercise === 'flashcard') {
      if (!this.revealed && event.code === 'Space') {
        event.preventDefault();
        this.revealed = true;
        return;
      }
      if (this.revealed && ['1', '2', '3', '4'].includes(event.key)) {
        void this.rateFlashcard(FLASHCARD_RATINGS[Number(event.key) - 1]);
      }
    }
  }
}
