import assert from 'node:assert/strict';
import test from 'node:test';

import { msUntilReminder, parseReminderPreference } from '../src/lib/client/reminder.ts';

test('připomínka: bezpečné parsování uložené volby', () => {
  assert.deepEqual(parseReminderPreference(null), { enabled: false, time: '18:00' });
  assert.deepEqual(parseReminderPreference({ enabled: true, time: '07:30' }), {
    enabled: true,
    time: '07:30',
  });
  assert.deepEqual(parseReminderPreference({ enabled: 'yes', time: '25:99' }), {
    enabled: false,
    time: '18:00',
  });
});

test('připomínka: čeká do dnešního času, po něm do zítřka', () => {
  const morning = new Date(2026, 9, 11, 9, 0, 0);
  assert.equal(msUntilReminder('18:00', morning), 9 * 3_600_000);
  const evening = new Date(2026, 9, 11, 19, 0, 0);
  assert.equal(msUntilReminder('18:00', evening), 23 * 3_600_000);
  assert.equal(msUntilReminder('19:00', evening), 24 * 3_600_000, 'exactly now waits a day');
});
