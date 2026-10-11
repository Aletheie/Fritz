import { get, writable } from 'svelte/store';
import { subscribeDatabaseSync } from '../../data/db.ts';
import { loadSnapshot } from '../../data/repository.ts';
import { createCourseProgress } from '../../domain/course/course-progress.ts';
import { errorText, type ErrorCopy } from '../../domain/errors.ts';
import { applyEvidenceToSkillState } from '../../domain/learning/skills.ts';
import { createReviewStats, type ReviewStats } from '../../domain/stats/review-stats.ts';
import { browserLanguage, localized } from '../../i18n/index.ts';

import type {
  DailySessionRecord,
  LearningEvidence,
  SkillState,
} from '../../domain/learning/types.ts';
import type {
  AppSettings,
  CourseProgress,
  Deck,
  Note,
  ReviewLog,
  StudyCard,
} from '../../domain/types.ts';

export type AppState = {
  ready: boolean;
  loading: boolean;
  error?: string;
  decks: Deck[];
  notes: Note[];
  cards: StudyCard[];
  recentReviews: ReviewLog[];
  reviewStats: ReviewStats;
  learningEvidence: LearningEvidence[];
  skillStates: SkillState[];
  dailySessions: DailySessionRecord[];
  dailySession?: DailySessionRecord;
  settings?: AppSettings;
  course: CourseProgress;
};

const initialState: AppState = {
  ready: false,
  loading: false,
  decks: [],
  notes: [],
  cards: [],
  recentReviews: [],
  reviewStats: createReviewStats(new Date(0)),
  learningEvidence: [],
  skillStates: [],
  dailySessions: [],
  course: createCourseProgress(new Date(0)),
};

export const state = writable<AppState>(initialState);

export const clock = writable(Date.now());

let initialization: Promise<void> | undefined;

let remoteRefresh: Promise<void> | undefined;

let remoteRefreshPending = false;

let syncSubscribed = false;

let indexedEvidence: LearningEvidence[] | undefined;

let evidencePositions = new Map<string, number>();

let indexedCards: StudyCard[] | undefined;

let cardPositions = new Map<string, number>();

function evidencePosition(evidence: LearningEvidence[], id: string): number {
  if (indexedEvidence !== evidence) {
    indexedEvidence = evidence;
    evidencePositions = new Map(evidence.map((item, index) => [item.id, index]));
  }
  return evidencePositions.get(id) ?? -1;
}

export function replaceCard(cards: StudyCard[], card: StudyCard): StudyCard[] {
  if (indexedCards !== cards) {
    indexedCards = cards;
    cardPositions = new Map(cards.map((item, index) => [item.id, index]));
  }
  const index = cardPositions.get(card.id);
  if (index === undefined) return cards;
  const updated = cards.slice();
  updated[index] = card;
  indexedCards = updated;
  return updated;
}

export function stateWithEvidence(value: AppState, evidence: LearningEvidence): AppState {
  const existingIndex = evidencePosition(value.learningEvidence, evidence.id);
  if (existingIndex >= 0) {
    const learningEvidence = value.learningEvidence.slice();
    learningEvidence[existingIndex] = evidence;
    indexedEvidence = learningEvidence;
    return { ...value, learningEvidence };
  }

  const skillStateById = new Map(
    value.skillStates.map((skillState) => [skillState.skillId, skillState]),
  );
  if (
    !evidence.excludedFromLearning &&
    evidence.mode !== 'cram' &&
    evidence.outcome !== 'skipped'
  ) {
    for (const skillId of new Set(evidence.skillIds)) {
      skillStateById.set(
        skillId,
        applyEvidenceToSkillState(skillStateById.get(skillId), evidence, skillId),
      );
    }
  }
  const learningEvidence = [...value.learningEvidence, evidence];
  indexedEvidence = learningEvidence;
  evidencePositions.set(evidence.id, learningEvidence.length - 1);
  return {
    ...value,
    learningEvidence,
    skillStates: [...skillStateById.values()],
  };
}

function requestRemoteRefresh(): void {
  remoteRefreshPending = true;
  if (remoteRefresh) return;
  remoteRefresh = (async () => {
    while (remoteRefreshPending) {
      remoteRefreshPending = false;
      // Refreshes are intentionally serialized so a later tab update cannot be overwritten.
      // oxlint-disable-next-line no-await-in-loop
      showSnapshot(await loadSnapshot());
    }
  })()
    .catch((error: unknown) => {
      state.update((value) => ({
        ...value,
        error: storeErrorText(error, {
          cs: 'Změnu z jiné karty se nepodařilo načíst.',
          en: 'A change from another tab could not be loaded.',
        }),
      }));
    })
    .finally(() => {
      remoteRefresh = undefined;
      if (remoteRefreshPending) requestRemoteRefresh();
    });
}

/** Store-level errors use the saved interface language, or the browser's before settings load. */
function storeErrorText(error: unknown, fallback: ErrorCopy): string {
  return errorText(error, get(state).settings?.motherTongue ?? browserLanguage(), fallback);
}

export function showSnapshot(snapshot: Awaited<ReturnType<typeof loadSnapshot>>): void {
  state.set({ ready: true, loading: false, ...snapshot });
}

export function minimumLevel(): AppSettings['grammarLevel'] {
  return get(state).settings?.grammarLevel ?? 'A1.1';
}

export async function initialize(options: { refresh?: boolean } = {}): Promise<void> {
  if (!syncSubscribed && typeof window !== 'undefined') {
    syncSubscribed = true;
    subscribeDatabaseSync((event) => {
      if (event.type === 'db-versionchange') {
        state.update((value) => ({
          ...value,
          error: localized(value.settings?.motherTongue ?? browserLanguage(), {
            cs: 'Je dostupná nová verze lokální databáze. Ulož práci a znovu načti kartu.',
            en: 'A new version of the local database is available. Save your work and reload the tab.',
          }),
        }));
        return;
      }
      if (event.type === 'mutation-committed') requestRemoteRefresh();
    });
  }
  if (get(state).ready && !options.refresh) return;
  if (initialization) return initialization;

  initialization = (async () => {
    state.update((value) => ({
      ...(options.refresh ? initialState : value),
      loading: true,
      error: undefined,
    }));
    try {
      showSnapshot(await loadSnapshot());
    } catch (error) {
      state.update((value) => ({
        ...value,
        loading: false,
        error: storeErrorText(error, {
          cs: 'Aplikaci se nepodařilo načíst.',
          en: 'Your saved data could not be loaded. Try again. This won’t erase anything.',
        }),
      }));
    } finally {
      initialization = undefined;
    }
  })();

  return initialization;
}

export function refreshClock(now = Date.now()): void {
  clock.set(now);
}

export function currentCourse(): CourseProgress {
  return get(state).course;
}

/** Publishes course progress that the repository has already committed. */
export function setCourse(course: CourseProgress): void {
  state.update((value) => ({ ...value, course }));
}
