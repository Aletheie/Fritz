import type { MotherTongue } from '../domain/types.ts';

/**
 * A gentle, opt-in daily reminder. Notifications belong to one browser, so the
 * preference lives on this device rather than in synced settings or backups.
 */
export type ReminderPreference = {
  enabled: boolean;
  /** Local time as HH:MM. */
  time: string;
};

const STORAGE_KEY = 'fritz:daily-reminder:v1';
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
export const DEFAULT_REMINDER: ReminderPreference = { enabled: false, time: '18:00' };

export function parseReminderPreference(value: unknown): ReminderPreference {
  if (!value || typeof value !== 'object') return DEFAULT_REMINDER;
  const record = value as Record<string, unknown>;
  return {
    enabled: record.enabled === true,
    time:
      typeof record.time === 'string' && TIME_PATTERN.test(record.time)
        ? record.time
        : DEFAULT_REMINDER.time,
  };
}

export function loadReminderPreference(): ReminderPreference {
  try {
    return parseReminderPreference(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
  } catch {
    return DEFAULT_REMINDER;
  }
}

export function saveReminderPreference(preference: ReminderPreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(parseReminderPreference(preference)));
  } catch {
    /* Private mode: the reminder simply stays off after a reload. */
  }
  window.dispatchEvent(new Event('fritz:reminder-change'));
}

export function remindersSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

/** Milliseconds from `now` until the next occurrence of `time` (today or tomorrow). */
export function msUntilReminder(time: string, now: Date): number {
  const [hours, minutes] = time.split(':').map(Number);
  const target = new Date(now);
  target.setHours(hours, minutes, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime() - now.getTime();
}

async function showReminder(language: MotherTongue): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification('Fritz', {
    body:
      language === 'cs'
        ? 'Dnešní lekce ještě čeká. Stačí pár minut.'
        : 'Today’s lesson is still waiting. A few minutes is enough.',
    icon: '/icons/icon-192.png',
    tag: 'fritz-daily-reminder',
    data: { url: '/today/' },
  });
}

/**
 * While Fritz is open (also in a background tab), fires once at the chosen time if
 * today's lesson is not finished. Returns a function that cancels the schedule.
 */
export function scheduleDailyReminder(options: {
  isDoneToday: () => boolean;
  language: () => MotherTongue;
}): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    const preference = loadReminderPreference();
    if (!preference.enabled || !remindersSupported()) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        if (
          Notification.permission === 'granted' &&
          document.visibilityState !== 'visible' &&
          !options.isDoneToday()
        ) {
          void showReminder(options.language()).catch(() => undefined);
        }
        arm();
      },
      msUntilReminder(preference.time, new Date()),
    );
  };
  arm();
  window.addEventListener('fritz:reminder-change', arm);
  return () => {
    if (timer !== undefined) clearTimeout(timer);
    window.removeEventListener('fritz:reminder-change', arm);
  };
}
