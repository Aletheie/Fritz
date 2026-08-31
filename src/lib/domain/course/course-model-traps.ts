const SUBJECT_PRONOUNS = new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'man']);
const SUBORDINATE_OPENERS = new Set([
  'als',
  'bevor',
  'da',
  'damit',
  'falls',
  'indem',
  'nachdem',
  'obwohl',
  'sobald',
  'solange',
  'sollte',
  'während',
  'weil',
  'wenn',
]);
const QUESTION_OPENERS = new Set([
  'wann',
  'warum',
  'was',
  'welche',
  'welcher',
  'welches',
  'wem',
  'wen',
  'wer',
  'wessen',
  'wie',
  'wo',
  'womit',
  'worauf',
]);

function normalizedToken(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('de-DE')
    .replace(/[^\p{L}\p{N}-]/gu, '');
}

function lowerInitial(value: string): string {
  return `${value.charAt(0).toLocaleLowerCase('de-DE')}${value.slice(1)}`;
}

/**
 * Creates a plausible learner word-order error while preserving the sentence's
 * complete token set. The resulting trap is useful for diagnosis instead of
 * looking like two randomly shuffled words.
 */
export function createWordOrderTrap(sentence: string, seed = 0): string {
  const finalMatch = sentence.trim().match(/^(.*?)([.!?])?$/u);
  const body = finalMatch?.[1]?.trim() ?? sentence.trim();
  const punctuation = finalMatch?.[2] ?? '.';
  const tokens = body.split(/\s+/u);
  if (tokens.length < 2) return `Nicht ${body}${punctuation}`;

  const normalizedSentence = tokens.map(normalizedToken);
  const punctuationBoundary = tokens.findIndex((token) => /[,;:.!?]$/u.test(token));
  const coordinatedBoundary = tokens.findIndex(
    (token, index) =>
      index > 1 &&
      ['aber', 'sondern', 'und'].includes(normalizedToken(token)) &&
      tokens
        .slice(index + 1, index + 5)
        .map(normalizedToken)
        .some((candidate) => SUBJECT_PRONOUNS.has(candidate)),
  );
  let segmentStart = 0;
  let segmentEnd =
    punctuationBoundary >= 0
      ? punctuationBoundary + 1
      : coordinatedBoundary >= 0
        ? coordinatedBoundary
        : tokens.length;
  if (
    punctuationBoundary >= 0 &&
    SUBORDINATE_OPENERS.has(normalizedSentence[0]) &&
    punctuationBoundary + 1 < tokens.length
  ) {
    segmentStart = punctuationBoundary + 1;
    const nextBoundary = tokens.findIndex(
      (token, index) => index >= segmentStart && /[,;:.!?]$/u.test(token),
    );
    segmentEnd = nextBoundary >= 0 ? nextBoundary + 1 : tokens.length;
  }

  const segment = tokens.slice(segmentStart, segmentEnd);
  if (segment.length < 2) return `Nicht ${body}${punctuation}`;
  const trailingPunctuation = segment.at(-1)?.match(/([,;:.!?]+)$/u)?.[1] ?? '';
  if (trailingPunctuation) {
    segment[segment.length - 1] = segment.at(-1)?.slice(0, -trailingPunctuation.length) ?? '';
  }
  const normalized = segment.map(normalizedToken);
  const pronounIndex = normalized.findIndex(
    (token, index) => index > 0 && SUBJECT_PRONOUNS.has(token),
  );

  if (SUBJECT_PRONOUNS.has(normalized[0]) && segment.length > 2) {
    const finiteVerb = segment.splice(1, 1)[0];
    segment.push(finiteVerb);
  } else if (pronounIndex > 1) {
    [segment[pronounIndex - 1], segment[pronounIndex]] = [
      segment[pronounIndex],
      segment[pronounIndex - 1],
    ];
  } else if (pronounIndex === 1) {
    if (segmentStart > 0) {
      const finiteVerb = lowerInitial(segment[0]);
      segment[0] = segment[1];
      segment[1] = finiteVerb;
    } else {
      const finiteVerb = lowerInitial(segment.shift() ?? '');
      segment.push(finiteVerb);
    }
  } else if (trailingPunctuation === '?' && !QUESTION_OPENERS.has(normalized[0])) {
    const finiteVerb = lowerInitial(segment.shift() ?? '');
    segment.push(finiteVerb);
  } else {
    const nounIndex = segment.findIndex((token, index) => index > 0 && /^\p{Lu}/u.test(token));
    const finiteVerbIndex = nounIndex >= 0 ? nounIndex + 1 : -1;
    if (finiteVerbIndex > 0 && finiteVerbIndex < segment.length) {
      const finiteVerb = segment.splice(finiteVerbIndex, 1)[0];
      segment.push(finiteVerb);
    } else {
      const swapIndex = Math.min(segment.length - 2, Math.max(1, seed % (segment.length - 1)));
      [segment[swapIndex], segment[swapIndex + 1]] = [segment[swapIndex + 1], segment[swapIndex]];
    }
  }

  if (trailingPunctuation) {
    segment[segment.length - 1] = `${segment.at(-1) ?? ''}${trailingPunctuation}`;
  }
  tokens.splice(segmentStart, segmentEnd - segmentStart, ...segment);

  const trap = `${tokens.join(' ')}${punctuation}`;
  return trap === sentence.trim() ? `Nicht ${body}${punctuation}` : trap;
}
