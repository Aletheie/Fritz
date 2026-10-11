export type AiProviderId =
  | 'google-gemini'
  | 'anthropic'
  | 'openai-compatible'
  | 'inkling-compatible';

export type AiFeature =
  | 'vocabulary'
  | 'explain'
  | 'sentence-evaluation'
  | 'coach'
  | 'story-word'
  | 'story-selection'
  | 'context-drill'
  | 'adaptive-hint'
  | 'weekly-summary';

export type AiFeaturePolicy = {
  /** Request body limit in bytes. */
  maxInputBytes: number;
  /** Requests per client and route in a 10-minute window. */
  requestsPer10Min: number;
  maxOutputTokens: number;
  timeoutMs: number;
};

export const AI_FEATURE_POLICY: Readonly<Record<AiFeature, AiFeaturePolicy>> = {
  vocabulary: {
    maxInputBytes: 24_576,
    requestsPer10Min: 12,
    maxOutputTokens: 3_500,
    timeoutMs: 35_000,
  },
  explain: { maxInputBytes: 5_120, requestsPer10Min: 20, maxOutputTokens: 900, timeoutMs: 18_000 },
  'sentence-evaluation': {
    maxInputBytes: 8_192,
    requestsPer10Min: 30,
    maxOutputTokens: 1_200,
    timeoutMs: 22_000,
  },
  coach: { maxInputBytes: 16_384, requestsPer10Min: 40, maxOutputTokens: 1_200, timeoutMs: 24_000 },
  'story-word': {
    maxInputBytes: 8_192,
    requestsPer10Min: 30,
    maxOutputTokens: 1_200,
    timeoutMs: 20_000,
  },
  'story-selection': {
    maxInputBytes: 12_288,
    requestsPer10Min: 20,
    maxOutputTokens: 1_800,
    timeoutMs: 24_000,
  },
  'context-drill': {
    maxInputBytes: 12_288,
    requestsPer10Min: 20,
    maxOutputTokens: 1_800,
    timeoutMs: 24_000,
  },
  'adaptive-hint': {
    maxInputBytes: 6_144,
    requestsPer10Min: 30,
    maxOutputTokens: 900,
    timeoutMs: 18_000,
  },
  'weekly-summary': {
    maxInputBytes: 8_192,
    requestsPer10Min: 6,
    maxOutputTokens: 1_200,
    timeoutMs: 24_000,
  },
};
