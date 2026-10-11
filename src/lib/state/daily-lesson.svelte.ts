import { fromStore } from 'svelte/store';

import {
  playLearningAudio,
  stopLearningAudio,
  type LearningAudioResult,
} from '../client/learning-audio.ts';
import { SpeechCapture } from '../client/speech-capture.svelte.ts';
import { coachScenarioById, coachScenarios } from '../domain/course/coach.ts';
import { gradeCourseDictation } from '../domain/course/dictation.ts';
import { grammarLessonById, grammarLessons } from '../domain/course/grammar.ts';
import { errorText, localizedError } from '../domain/errors.ts';
import { gradeGermanAnswer } from '../domain/grading/grade.ts';
import {
  dailyActivityEvidence,
  expectedGrammarAnswer,
  gradeMeaning,
  grammarAnswerIsCorrect,
  grammarAnswerIsReady,
  orderedGrammarAnswer,
  toggleOrderIndex,
  type GrammarDraft,
} from '../domain/learning/daily-grading.ts';
import {
  buildDailyLessonPlan,
  createDailySession,
  dailySessionSummary,
} from '../domain/learning/planner.ts';
import { remainingDailyNewCards } from '../domain/stats/learning.ts';
import { grammarLessonCopy, grammarQuestionCopy } from '../i18n/grammar.ts';
import { noteMeaning } from '../i18n/vocabulary.ts';
import { appStore, motherTongue, tr } from './app.ts';
import { ConversationController } from './conversation.svelte.ts';
import { loadCoursePath } from './course-path.ts';

import type { GrammarQuestion } from '../domain/course/grammar.ts';
import type {
  DailySessionRecord,
  EvidenceModality,
  LearningEvidence,
  LessonActivity,
} from '../domain/learning/types.ts';
import type { Article, MotherTongue } from '../domain/types.ts';

export type DailyFeedback = {
  correct: boolean;
  title: string;
  message: string;
  expected?: string;
};

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

/**
 * Owns one day's unified lesson: building the plan, the active activity, grading,
 * listening, the transfer conversation and saving progress. Evidence and session
 * records cross into IndexedDB, so they are kept raw rather than deeply proxied.
 */
export class DailyLesson {
  initialized = $state(false);
  loadingError = $state('');
  session = $state.raw<DailySessionRecord | undefined>(undefined);

  answer = $state('');
  selectedArticle = $state<Article | undefined>(undefined);
  selectedChoice = $state('');
  selectedOrderIndexes = $state.raw<number[]>([]);
  feedback = $state.raw<DailyFeedback | undefined>(undefined);
  pendingEvidence = $state.raw<LearningEvidence | undefined>(undefined);
  hintVisible = $state(false);
  hintsUsed = $state(0);
  saving = $state(false);

  audioPlaying = $state(false);
  audioPlays = $state(0);
  audioSource = $state<LearningAudioResult['source'] | undefined>(undefined);
  audioError = $state('');

  /** True once the answer came from speech recognition and may need editing. */
  speechDraft = $state(false);
  transferAcceptedTurns = $state(0);
  transferAttempts = $state(0);
  exitChoice = $state('');
  /** Increments whenever the active answer field should take focus. */
  focusRequest = $state(0);

  readonly speech = new SpeechCapture();
  readonly conversation = new ConversationController();

  #app = fromStore(appStore);
  #language = fromStore(motherTongue);
  #tr = fromStore(tr);
  #activityStartedAt = 0;
  #lastActivityId = '';

  get language(): MotherTongue {
    return this.#language.current;
  }

  copy(cs: string, en: string): string {
    return this.#tr.current(cs, en);
  }

  // ---------------------------------------------------------------------------
  // Derived activity state

  get active(): LessonActivity | undefined {
    const session = this.session;
    return session?.plan.activities[session.cursor];
  }

  get summary() {
    return this.session
      ? dailySessionSummary(this.session)
      : { completed: 0, total: 0, percent: 0, finished: false };
  }

  get note() {
    const active = this.active;
    if (active?.kind !== 'review') return undefined;
    return this.#app.current.notes.find((note) => note.id === active.noteId);
  }

  get card() {
    const active = this.active;
    if (active?.kind !== 'review') return undefined;
    return this.#app.current.cards.find((card) => card.id === active.cardId);
  }

  get grammarLesson() {
    const active = this.active;
    return active?.kind === 'grammar' ? grammarLessonById(active.lessonId) : undefined;
  }

  get grammarQuestion(): GrammarQuestion | undefined {
    const active = this.active;
    if (active?.kind !== 'grammar') return undefined;
    return this.grammarLesson?.questions.find((question) => question.id === active.questionId);
  }

  get grammarCopy() {
    const lesson = this.grammarLesson;
    return lesson ? grammarLessonCopy(this.language, lesson) : undefined;
  }

  get questionCopy() {
    const question = this.grammarQuestion;
    const lessonCopy = this.grammarCopy;
    return question && lessonCopy
      ? grammarQuestionCopy(this.language, question, lessonCopy)
      : undefined;
  }

  get grammarDraft(): GrammarDraft {
    return {
      choice: this.selectedChoice,
      text: this.answer,
      orderIndexes: this.selectedOrderIndexes,
    };
  }

  get orderedAnswer(): string {
    const question = this.grammarQuestion;
    return question ? orderedGrammarAnswer(question, this.grammarDraft) : '';
  }

  get grammarReady(): boolean {
    const question = this.grammarQuestion;
    return Boolean(question && grammarAnswerIsReady(question, this.grammarDraft));
  }

  get transferScenario() {
    const active = this.active;
    return active?.kind === 'transfer' ? coachScenarioById(active.scenarioId) : undefined;
  }

  get transferPrompt(): string {
    const active = this.active;
    return (
      this.conversation.messages.findLast((item) => item.role === 'coach')?.text ??
      (active?.kind === 'transfer' ? active.prompt : '')
    );
  }

  get latestTransferTurn() {
    return this.conversation.turns.find((turn) => turn.id === this.conversation.latestTurnId);
  }

  get transferDiagnosticsIgnored(): boolean {
    return this.latestTransferTurn?.diagnosticsIgnored ?? false;
  }

  get latestTransferDiagnostics() {
    return this.latestTransferTurn?.result.diagnostics ?? [];
  }

  /** The plan points at content that no longer exists, e.g. a deleted word. */
  get activityMissing(): boolean {
    const active = this.active;
    if (!active) return false;
    if (active.kind === 'review') return !this.note || !this.card;
    if (active.kind === 'grammar') return !this.grammarQuestion;
    if (active.kind === 'transfer') return !this.transferScenario;
    return false;
  }

  phaseLabel(activity: LessonActivity | undefined = this.active): string {
    if (!activity) return '';
    const labels = {
      review: this.copy('Opakování slovíček', 'Memory refresh'),
      focus: this.copy('Dnešní téma', 'Today’s focus'),
      transfer: this.copy('Použití v situaci', 'Conversation practice'),
      close: this.copy('Uzavření lekce', 'Lesson close'),
      repair: this.copy('Zkus to znovu', 'Smart repair'),
    };
    return labels[activity.phase];
  }

  // ---------------------------------------------------------------------------
  // Lifecycle

  async initialize(isCancelled: () => boolean): Promise<void> {
    this.speech.detect();
    try {
      await appStore.initialize();
      if (isCancelled()) return;
      const app = this.#app.current;
      const settings = app.settings;
      if (!settings) {
        throw localizedError('Nastavení není dostupné.', 'Settings are unavailable.');
      }
      const path = await loadCoursePath(app.course, settings.grammarLevel, settings.motherTongue);
      const unlocked = path.chapters.filter((view) => view.unlocked).map((view) => view.chapter);
      const chapters =
        unlocked.length > 0 ? unlocked : path.chapters.slice(0, 1).map((view) => view.chapter);
      const grammarIds = new Set(chapters.flatMap((chapter) => chapter.grammarLessonIds));
      const scenarioIds = new Set(chapters.flatMap((chapter) => chapter.coachScenarioIds));
      const today = new Date();
      const plan = buildDailyLessonPlan({
        now: today,
        minutes: settings.dailyMinutes,
        learningGoal: settings.learningGoal,
        cards: app.cards,
        notes: app.notes,
        skillStates: app.skillStates,
        learningEvidence: app.learningEvidence,
        grammarLessons: grammarLessons.filter((lesson) => grammarIds.has(lesson.id)),
        coachScenarios: coachScenarios.filter((scenario) => scenarioIds.has(scenario.id)),
        chapters,
        currentChapterId: path.recommendation?.chapterId,
        examTag: settings.examPlan?.tag,
        remainingNewCards: remainingDailyNewCards(app.recentReviews, settings.dailyNewLimit, today),
      });
      this.session = await appStore.beginDailySession(createDailySession(plan));
    } catch (error) {
      this.loadingError = this.#errorText(error, {
        cs: 'Dnešní lekci se nepodařilo připravit.',
        en: 'Today’s lesson could not be prepared.',
      });
    } finally {
      this.initialized = true;
    }
  }

  destroy(): void {
    this.speech.stop(true);
    stopLearningAudio();
    this.conversation.destroy();
  }

  /**
   * Resets the per-activity state when the cursor moves to a new activity.
   * Returns true when it did, so the caller can move focus.
   */
  syncActivity(): boolean {
    const active = this.active;
    const activityId = active?.id ?? '';
    if (!activityId || activityId === this.#lastActivityId) return false;
    this.#lastActivityId = activityId;
    this.answer = '';
    this.selectedArticle = undefined;
    this.selectedChoice = '';
    this.selectedOrderIndexes = [];
    this.feedback = undefined;
    this.pendingEvidence = undefined;
    this.hintVisible = false;
    this.hintsUsed = 0;
    this.audioPlays = 0;
    this.audioSource = undefined;
    this.audioError = '';
    this.speechDraft = false;
    this.speech.reset();
    this.transferAcceptedTurns = 0;
    this.transferAttempts = 0;
    this.exitChoice = '';
    this.#activityStartedAt = now();

    const scenario = this.transferScenario;
    if (active?.kind === 'transfer' && scenario) {
      const base = {
        scenario,
        motherTongue: this.language,
        focusWords: scenario.focusWords,
        opening: active.prompt,
      };
      this.conversation.start(
        active.repair
          ? { ...base, mode: 'repair', turnsTarget: 1, repair: active.repair }
          : { ...base, mode: 'conversation', turnsTarget: active.turnsTarget },
      );
    } else {
      this.conversation.reset();
    }
    return true;
  }

  close(): void {
    this.speech.stop(true);
    stopLearningAudio();
  }

  // ---------------------------------------------------------------------------
  // Helpers

  #responseMs(): number {
    return Math.max(0, Math.round(now() - this.#activityStartedAt));
  }

  #errorText(error: unknown, fallback: { cs: string; en: string }): string {
    return errorText(error, this.language, fallback);
  }

  #evidence(input: {
    activity: LessonActivity;
    source: LearningEvidence['source'];
    sourceId: string;
    modality: EvidenceModality;
    correct: boolean;
    independent: boolean;
    mistakeTags?: LearningEvidence['mistakeTags'];
    repairOfEvidenceId?: string;
  }): LearningEvidence {
    const session = this.session;
    if (!session) {
      throw localizedError('Dnešní lekce není dostupná.', 'Today’s lesson is not available.');
    }
    return dailyActivityEvidence({
      ...input,
      session,
      hintsUsed: this.hintsUsed,
      responseMs: this.#responseMs(),
      occurredAt: new Date(),
    });
  }

  showHint(): void {
    if (this.hintVisible || this.feedback) return;
    this.hintVisible = true;
    this.hintsUsed += 1;
  }

  // ---------------------------------------------------------------------------
  // Review and grammar

  async submitReview(): Promise<void> {
    const active = this.active;
    const note = this.note;
    const card = this.card;
    if (active?.kind !== 'review' || !note || !card || !this.answer.trim() || this.saving) return;
    this.saving = true;
    try {
      const result =
        active.direction === 'cs-de'
          ? gradeGermanAnswer({
              expectedGerman: note.german,
              acceptedGerman: note.acceptedGerman,
              expectedArticle: note.article,
              selectedArticle: this.selectedArticle,
              submittedText: this.answer,
              responseMs: this.#responseMs(),
              hintsUsed: this.hintsUsed,
              allowKeyboardFallback: this.#app.current.settings?.allowKeyboardFallback,
            })
          : gradeMeaning(note, this.answer, this.#responseMs(), this.hintsUsed, this.language);
      const saved = await appStore.review({
        operationId: `daily-review:${this.session?.key}:${active.id}`,
        activityId: active.id,
        card,
        note,
        mode: 'long-term',
        rating: result.rating,
        signal: result.signal,
      });
      this.pendingEvidence = saved.evidence;
      this.feedback = {
        correct: result.correct,
        title: result.correct
          ? this.copy('Sedí to.', 'That is right.')
          : this.copy('Tady je mezera.', 'There is a gap here.'),
        message: result.message,
        expected:
          active.direction === 'cs-de'
            ? `${note.article ? `${note.article} ` : ''}${note.german}`
            : noteMeaning(note, this.language),
      };
    } catch (error) {
      this.loadingError = this.#errorText(error, {
        cs: 'Odpověď se neuložila.',
        en: 'The answer was not saved.',
      });
    } finally {
      this.saving = false;
    }
  }

  toggleOrderToken(index: number): void {
    if (this.feedback) return;
    this.selectedOrderIndexes = toggleOrderIndex(this.selectedOrderIndexes, index);
  }

  async submitGrammar(): Promise<void> {
    const active = this.active;
    const question = this.grammarQuestion;
    if (active?.kind !== 'grammar' || !question || !this.grammarReady || this.saving) return;
    const correct = grammarAnswerIsCorrect(question, this.grammarDraft);
    this.saving = true;
    try {
      const result = await appStore.answerCourseQuestion({
        operationId: `daily-grammar:${this.session?.key}:${active.id}`,
        activityId: active.id,
        hintsUsed: this.hintsUsed,
        lessonId: active.lessonId,
        questionId: active.questionId,
        correct,
        responseMs: this.#responseMs(),
      });
      this.pendingEvidence = result.evidence;
      this.feedback = {
        correct,
        title: correct
          ? this.copy('Správně.', 'The pattern holds.')
          : this.copy('Ještě upravit odpověď.', 'One adjustment needed.'),
        message: this.questionCopy?.explanation ?? question.explanation,
        expected: expectedGrammarAnswer(question, this.language),
      };
    } catch (error) {
      this.loadingError = this.#errorText(error, {
        cs: 'Odpověď se neuložila.',
        en: 'The answer was not saved.',
      });
    } finally {
      this.saving = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Listening

  async playListening(): Promise<void> {
    const active = this.active;
    if (active?.kind !== 'listening' || this.audioPlaying) return;
    this.audioPlaying = true;
    this.audioError = '';
    this.audioPlays += 1;
    try {
      const result = await playLearningAudio({ audioId: active.audioId, text: active.transcript });
      this.audioSource = result.source;
      this.focusRequest += 1;
    } catch (error) {
      this.audioError = this.#errorText(error, {
        cs: 'Zvuk se nepodařilo přehrát.',
        en: 'Audio could not be played.',
      });
    } finally {
      this.audioPlaying = false;
    }
  }

  submitListening(): void {
    const active = this.active;
    if (active?.kind !== 'listening' || !this.answer.trim() || this.feedback) return;
    const grade = gradeCourseDictation(this.answer, active.transcript);
    this.pendingEvidence = this.#evidence({
      activity: active,
      source: 'listening-dictation',
      sourceId: active.audioId,
      modality: 'dictation',
      correct: grade.correct,
      independent: grade.correct && this.audioPlays <= 1 && this.hintsUsed === 0,
      mistakeTags: grade.correct ? undefined : ['spelling'],
    });
    this.feedback = {
      correct: grade.correct,
      title: grade.correct
        ? this.copy('Slyšela jsi celou větu.', 'You caught the whole sentence.')
        : this.copy('Jedna část unikla.', 'One part slipped by.'),
      message: grade.keyboardEquivalent
        ? this.copy(
            'Význam je správně. Podívej se ještě na pravopis.',
            'The meaning is right. Check the spelling once more.',
          )
        : grade.correct
          ? this.copy('Poslech i zápis sedí.', 'Listening and spelling both match.')
          : this.copy('Větu si poslechneš znovu v opravě.', 'You’ll practise this sentence again.'),
      expected: active.transcript,
    };
  }

  // ---------------------------------------------------------------------------
  // Transfer conversation

  toggleMicrophone(): void {
    if (this.speech.listening) {
      this.speech.stop();
      return;
    }
    this.speech.start(this.language, {
      ontranscript: (transcript) => {
        this.answer = transcript;
        this.speechDraft = true;
      },
      onend: () => {
        this.focusRequest += 1;
      },
    });
  }

  #transferSucceeded(): boolean {
    const active = this.active;
    if (active?.kind !== 'transfer' || !active.repair) return true;
    return !this.conversation
      .activeDiagnostics()
      .some((diagnostic) => diagnostic.tag === active.repair?.mistakeTag);
  }

  #prepareTransferEvidence(): boolean {
    const active = this.active;
    if (active?.kind !== 'transfer' || !this.conversation.complete) return false;
    const correct = this.#transferSucceeded();
    const diagnostics = this.conversation.activeDiagnostics();
    this.pendingEvidence = this.#evidence({
      activity: active,
      source: 'transfer',
      sourceId: active.scenarioId,
      modality: 'free-production',
      correct,
      independent:
        correct &&
        this.transferAttempts === active.turnsTarget &&
        this.hintsUsed === 0 &&
        diagnostics.length === 0,
      mistakeTags: diagnostics.map((diagnostic) => diagnostic.tag),
      repairOfEvidenceId: active.repair?.evidenceId,
    });
    return correct;
  }

  async submitTransferTurn(): Promise<void> {
    const active = this.active;
    if (
      active?.kind !== 'transfer' ||
      !this.transferScenario ||
      !this.answer.trim() ||
      this.feedback ||
      this.saving
    ) {
      return;
    }
    this.transferAttempts += 1;
    this.saving = true;
    this.loadingError = '';
    const submitted = this.answer.trim();
    try {
      const result = await this.conversation.send(submitted);
      if (!result.accepted) {
        this.feedback = {
          correct: false,
          title: this.copy('Tahle replika ještě nesedí.', 'This reply does not fit yet.'),
          message: result.feedback,
        };
        return;
      }

      this.transferAcceptedTurns = this.conversation.completedTurns;
      this.answer = '';
      this.speechDraft = false;
      if (!this.conversation.complete) {
        this.feedback = {
          correct: true,
          title: this.copy('Replika funguje.', 'That reply works.'),
          message: result.feedback,
          expected: result.correction ?? undefined,
        };
        return;
      }

      const correct = this.#prepareTransferEvidence();
      this.feedback = {
        correct,
        title: correct
          ? active.repair
            ? this.copy('Teď už je to správně.', 'The repair holds.')
            : this.copy('Domluvila ses.', 'You got the message across.')
          : this.copy('Tohle si ještě procvičíš.', 'This pattern will return once more.'),
        message: correct
          ? result.feedback
          : this.copy(
              'Podle AI se tahle chyba opakuje. Pro další procvičení se uloží jen typ chyby, ne tvoje věta.',
              'The same error pattern appeared again. Only its category is stored, not your sentence.',
            ),
        expected: result.correction ?? undefined,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.answer = this.conversation.failedDraft || submitted;
      this.loadingError =
        this.conversation.error ||
        this.copy('Repliku se nepodařilo posoudit.', 'The reply could not be assessed.');
    } finally {
      this.saving = false;
    }
  }

  retryTransfer(): void {
    this.feedback = undefined;
    this.focusRequest += 1;
  }

  toggleTransferAssessment(): void {
    const turnId = this.conversation.latestTurnId;
    if (!turnId || !this.conversation.complete) return;
    if (this.transferDiagnosticsIgnored) this.conversation.restoreDiagnostics(turnId);
    else this.conversation.ignoreDiagnostics(turnId);
    const correct = this.#prepareTransferEvidence();
    this.feedback = {
      correct,
      title: correct
        ? this.copy('Výsledek bereme bez sporné opravy.', 'The disputed correction is excluded.')
        : this.copy('Tohle si ještě procvičíš.', 'This pattern will return once more.'),
      message: correct
        ? this.copy(
            'Do dalšího plánu se sporné hodnocení nepromítne.',
            'The disputed assessment will not affect the next plan.',
          )
        : this.copy(
            'Do dalšího plánu se uloží pouze typ chyby.',
            'Only the error category will be used in the next plan.',
          ),
    };
  }

  // ---------------------------------------------------------------------------
  // Progress

  async finishCurrentActivity(): Promise<void> {
    const active = this.active;
    if (!active || !this.session || this.saving) return;
    const correct = this.feedback?.correct ?? active.kind === 'exit-ticket';
    this.saving = true;
    this.loadingError = '';
    try {
      this.session = await appStore.completeDailySessionActivity({
        activityId: active.id,
        evidence: this.pendingEvidence,
        needsRepair:
          !correct &&
          active.kind !== 'exit-ticket' &&
          !(active.kind === 'transfer' && Boolean(active.repair)),
      });
    } catch (error) {
      this.loadingError = this.#errorText(error, {
        cs: 'Pokrok se nepodařilo uložit.',
        en: 'Progress could not be saved.',
      });
    } finally {
      this.saving = false;
    }
  }

  async skipMissingActivity(): Promise<void> {
    const active = this.active;
    if (!this.activityMissing || !active || !this.session || this.saving) return;
    this.saving = true;
    try {
      this.session = await appStore.completeDailySessionActivity({ activityId: active.id });
    } finally {
      this.saving = false;
    }
  }
}
