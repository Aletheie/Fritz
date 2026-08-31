import {
  LONG_TERM_SESSION_STORAGE_KEY,
  parseLongTermSessionDraft,
} from '../domain/scheduler/session.ts';

import type { LongTermSessionDraft } from '../domain/scheduler/session.ts';

const LEGACY_LONG_TERM_SESSION_STORAGE_KEY = 'wortly:long-term-session:v1';

export function loadLongTermSession(): LongTermSessionDraft | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const current = localStorage.getItem(LONG_TERM_SESSION_STORAGE_KEY);
    const legacy = current ? null : localStorage.getItem(LEGACY_LONG_TERM_SESSION_STORAGE_KEY);
    const raw = current ?? legacy;
    if (!raw) return undefined;
    const parsed = parseLongTermSessionDraft(JSON.parse(raw));
    if (!parsed || parsed.remainingCardIds.length === 0) {
      localStorage.removeItem(LONG_TERM_SESSION_STORAGE_KEY);
      localStorage.removeItem(LEGACY_LONG_TERM_SESSION_STORAGE_KEY);
      return undefined;
    }
    if (legacy) {
      localStorage.setItem(LONG_TERM_SESSION_STORAGE_KEY, JSON.stringify(parsed));
      localStorage.removeItem(LEGACY_LONG_TERM_SESSION_STORAGE_KEY);
    }
    return parsed;
  } catch {
    try {
      localStorage.removeItem(LONG_TERM_SESSION_STORAGE_KEY);
      localStorage.removeItem(LEGACY_LONG_TERM_SESSION_STORAGE_KEY);
    } catch {
      // Session recovery is best-effort; storage access must never block studying.
    }
    return undefined;
  }
}

export function saveLongTermSession(draft: LongTermSessionDraft): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LONG_TERM_SESSION_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // The review itself is already durable in IndexedDB. A full/blocked localStorage only
    // disables session resume and must not turn that committed review into a retryable failure.
  }
}

export function clearLongTermSession(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(LONG_TERM_SESSION_STORAGE_KEY);
    localStorage.removeItem(LEGACY_LONG_TERM_SESSION_STORAGE_KEY);
  } catch {
    // Best-effort for browsers that deny localStorage.
  }
}
