import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hashLearningAudioTranscript,
  parseLearningAudioManifest,
} from '../src/lib/client/learning-audio.ts';

test('audio manifest accepts bounded same-origin canonical entries', () => {
  const manifest = parseLearningAudioManifest({
    schemaVersion: 1,
    generatedAt: '2026-08-13T00:00:00.000Z',
    entries: [
      {
        id: 'chapter-a1-listening-1',
        url: '/audio/chapter-a1-listening-1.mp3',
        transcriptHash: 'a'.repeat(64),
        durationMs: 1800,
        voice: 'reviewed-de-DE-1',
        license: 'Fritz course audio',
        version: 1,
      },
    ],
  });
  assert.equal(manifest.entries[0].id, 'chapter-a1-listening-1');
});

test('audio manifest rejects duplicate IDs and paths outside /audio', () => {
  const entry = {
    id: 'same',
    url: '/audio/same.mp3',
    transcriptHash: 'b'.repeat(64),
    durationMs: 1000,
    voice: 'voice',
    license: 'license',
    version: 1,
  };
  assert.throws(
    () =>
      parseLearningAudioManifest({
        schemaVersion: 1,
        generatedAt: '2026-08-13T00:00:00.000Z',
        entries: [entry, entry],
      }),
    /duplicitní identitu/u,
  );
  assert.throws(
    () =>
      parseLearningAudioManifest({
        schemaVersion: 1,
        generatedAt: '2026-08-13T00:00:00.000Z',
        entries: [{ ...entry, url: 'https://example.com/audio.mp3' }],
      }),
    /identitu/u,
  );
  assert.throws(
    () =>
      parseLearningAudioManifest({
        schemaVersion: 1,
        generatedAt: '2026-08-13T00:00:00.000Z',
        entries: [{ ...entry, url: '/audio/same.mp3?stale=1' }],
      }),
    /identitu/u,
  );
});

test('canonical transcript hash is deterministic and sensitive to the reviewed text', async () => {
  const first = await hashLearningAudioTranscript('Guten Morgen');
  const same = await hashLearningAudioTranscript('Guten Morgen');
  const changed = await hashLearningAudioTranscript('Guten Morgen!');

  assert.match(first, /^[a-f0-9]{64}$/u);
  assert.equal(first, same);
  assert.notEqual(first, changed);
});
