import { damerauLevenshtein, typoThreshold } from './distance.ts';
import { normalizeText } from './normalize.ts';

/**
 * How a target word came through browser speech recognition. This is a proxy for
 * pronunciation: the recogniser hears the learner the way an unfamiliar listener would.
 */
export type HeardWordStatus = 'clear' | 'umlaut' | 'close' | 'missing';

export type PronunciationWord = { word: string; heard?: string; status: HeardWordStatus };

export type PronunciationAssessment = {
  words: PronunciationWord[];
  /** 0–100 share of target words the recogniser understood. */
  score: number;
  level: 'clear' | 'mostly' | 'unclear';
  /** The recogniser itself was unsure, so the score is only indicative. */
  lowConfidence: boolean;
};

const WEIGHT: Record<HeardWordStatus, number> = { clear: 1, umlaut: 0.6, close: 0.6, missing: 0 };
/** How far ahead in the transcript a target word may appear (filler words, repeats). */
const LOOKAHEAD = 2;

function words(value: string): string[] {
  return normalizeText(value)
    .replace(/[.,!?;:„“”"()]/gu, ' ')
    .split(/\s+/u)
    .filter(Boolean);
}

function withoutUmlauts(word: string): string {
  return word.replace(/ä/gu, 'a').replace(/ö/gu, 'o').replace(/ü/gu, 'u').replace(/ß/gu, 'ss');
}

function compare(target: string, heard: string): HeardWordStatus {
  if (heard === target) return 'clear';
  if (withoutUmlauts(heard) === withoutUmlauts(target)) return 'umlaut';
  return damerauLevenshtein(heard, target) <= typoThreshold(target.length) ? 'close' : 'missing';
}

export function assessPronunciation(
  target: string,
  transcript: string,
  confidence?: number,
): PronunciationAssessment {
  const display = target
    .split(/\s+/u)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
  const expected = display.map(normalizeText);
  const heard = words(transcript);
  let cursor = 0;
  const result = expected.map((word, position): PronunciationWord => {
    let best: { index: number; status: HeardWordStatus } | undefined;
    for (let index = cursor; index < Math.min(heard.length, cursor + LOOKAHEAD + 1); index += 1) {
      const status = compare(word, heard[index]);
      if (status !== 'missing' && (!best || WEIGHT[status] > WEIGHT[best.status])) {
        best = { index, status };
      }
      if (status === 'clear') break;
    }
    if (!best) return { word: display[position], status: 'missing' };
    cursor = best.index + 1;
    return { word: display[position], heard: heard[best.index], status: best.status };
  });
  const score = expected.length
    ? Math.round(
        (result.reduce((sum, item) => sum + WEIGHT[item.status], 0) / expected.length) * 100,
      )
    : 0;
  return {
    words: result,
    score,
    level: score >= 90 ? 'clear' : score >= 60 ? 'mostly' : 'unclear',
    lowConfidence: confidence !== undefined && confidence < 0.6,
  };
}
