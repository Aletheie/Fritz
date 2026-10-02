export type AiAccessMode =
  | 'demo'
  | 'byok-only'
  | 'server-only'
  | 'sponsored-private'
  | 'explicit-fallback';
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
  feature: AiFeature;
  maxInputBytes: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxRetries: 0 | 1;
  dailyRequests: number;
  dailyInputBytes: number;
  dailyOutputTokens: number;
  concurrency: number;
};

const POLICIES: Record<AiFeature, AiFeaturePolicy> = {
  vocabulary: {
    feature: 'vocabulary',
    maxInputBytes: 24_576,
    maxOutputTokens: 3_500,
    timeoutMs: 35_000,
    maxRetries: 0,
    dailyRequests: 20,
    dailyInputBytes: 180_000,
    dailyOutputTokens: 35_000,
    concurrency: 1,
  },
  explain: {
    feature: 'explain',
    maxInputBytes: 5_120,
    maxOutputTokens: 900,
    timeoutMs: 18_000,
    maxRetries: 0,
    dailyRequests: 80,
    dailyInputBytes: 180_000,
    dailyOutputTokens: 40_000,
    concurrency: 2,
  },
  'sentence-evaluation': {
    feature: 'sentence-evaluation',
    maxInputBytes: 8_192,
    maxOutputTokens: 1_200,
    timeoutMs: 22_000,
    maxRetries: 0,
    dailyRequests: 60,
    dailyInputBytes: 220_000,
    dailyOutputTokens: 50_000,
    concurrency: 2,
  },
  coach: {
    feature: 'coach',
    maxInputBytes: 16_384,
    maxOutputTokens: 1_200,
    timeoutMs: 24_000,
    maxRetries: 0,
    dailyRequests: 100,
    dailyInputBytes: 600_000,
    dailyOutputTokens: 80_000,
    concurrency: 1,
  },
  'story-word': {
    feature: 'story-word',
    maxInputBytes: 8_192,
    maxOutputTokens: 1_200,
    timeoutMs: 20_000,
    maxRetries: 0,
    dailyRequests: 80,
    dailyInputBytes: 250_000,
    dailyOutputTokens: 50_000,
    concurrency: 2,
  },
  'story-selection': {
    feature: 'story-selection',
    maxInputBytes: 12_288,
    maxOutputTokens: 1_800,
    timeoutMs: 24_000,
    maxRetries: 0,
    dailyRequests: 40,
    dailyInputBytes: 350_000,
    dailyOutputTokens: 55_000,
    concurrency: 1,
  },
  'context-drill': {
    feature: 'context-drill',
    maxInputBytes: 12_288,
    maxOutputTokens: 2_000,
    timeoutMs: 24_000,
    maxRetries: 0,
    dailyRequests: 30,
    dailyInputBytes: 250_000,
    dailyOutputTokens: 50_000,
    concurrency: 1,
  },
  'adaptive-hint': {
    feature: 'adaptive-hint',
    maxInputBytes: 6_144,
    maxOutputTokens: 900,
    timeoutMs: 18_000,
    maxRetries: 0,
    dailyRequests: 80,
    dailyInputBytes: 220_000,
    dailyOutputTokens: 40_000,
    concurrency: 2,
  },
  'weekly-summary': {
    feature: 'weekly-summary',
    maxInputBytes: 6_144,
    maxOutputTokens: 1_000,
    timeoutMs: 18_000,
    maxRetries: 0,
    dailyRequests: 3,
    dailyInputBytes: 18_000,
    dailyOutputTokens: 3_000,
    concurrency: 1,
  },
};

export function aiFeaturePolicy(feature: AiFeature): AiFeaturePolicy {
  return POLICIES[feature];
}

export const AI_FEATURES = Object.freeze(Object.keys(POLICIES) as AiFeature[]);
