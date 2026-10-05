import type { AiConnectionInput } from '$lib/domain/ai/connection.ts';
import { jsonRequest } from './http.ts';

import type {
  AiExplanationResult,
  AiCoachRequest,
  AiCoachResult,
  AiKeyStatus,
  AiSentenceEvaluationRequest,
  AiSentenceEvaluationResult,
  AiVocabularyRequest,
  AiVocabularyResult,
  AiStorySelectionRequest,
  AiStorySelectionResult,
  AiStoryWordRequest,
  AiStoryWordResult,
  AiContextDrillRequest,
  AiContextDrillResult,
  AiAdaptiveHintRequest,
  AiAdaptiveHintResult,
} from '$lib/domain/ai/types.ts';

export function getAiKeyStatus(): Promise<AiKeyStatus> {
  return jsonRequest<AiKeyStatus>('/api/ai/key/');
}

export function connectAi(
  connection: AiConnectionInput,
  signal?: AbortSignal,
): Promise<AiKeyStatus> {
  return jsonRequest<AiKeyStatus>('/api/ai/key/', {
    method: 'POST',
    body: JSON.stringify(connection),
    signal,
  });
}

export function disconnectAi(): Promise<AiKeyStatus> {
  return jsonRequest<AiKeyStatus>('/api/ai/key/', { method: 'DELETE' });
}

export function migrateAiConnection(): Promise<AiKeyStatus> {
  return jsonRequest<AiKeyStatus>('/api/ai/key/migrate/', { method: 'POST' });
}

export function requestVocabulary(
  request: AiVocabularyRequest,
  signal?: AbortSignal,
): Promise<AiVocabularyResult> {
  return jsonRequest<AiVocabularyResult>('/api/ai/vocabulary/', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  });
}

export function requestExplanation(
  request: {
    motherTongue?: 'cs' | 'en';
    german: string;
    czech: string;
    article?: 'der' | 'die' | 'das';
    kind: 'noun' | 'verb' | 'adjective' | 'phrase' | 'other';
    submitted: string;
    selectedArticle?: 'der' | 'die' | 'das';
    wordCorrect: boolean;
    articleCorrect: boolean;
    keyboardEquivalent: boolean;
    editDistance: number;
    learningNote?: string;
  },
  signal?: AbortSignal,
): Promise<AiExplanationResult> {
  return jsonRequest<AiExplanationResult>('/api/ai/explain/', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  });
}

export function evaluateSentence(
  request: AiSentenceEvaluationRequest,
  signal?: AbortSignal,
): Promise<AiSentenceEvaluationResult> {
  return jsonRequest<AiSentenceEvaluationResult>('/api/ai/evaluate-sentence/', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  });
}

export function requestCoachReply(
  request: AiCoachRequest,
  signal?: AbortSignal,
): Promise<AiCoachResult> {
  return jsonRequest<AiCoachResult>('/api/ai/coach/', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  });
}

export function requestStoryWord(
  request: AiStoryWordRequest,
  signal?: AbortSignal,
): Promise<AiStoryWordResult> {
  return jsonRequest<AiStoryWordResult>('/api/ai/story-word/', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  });
}

export function requestStorySelection(
  request: AiStorySelectionRequest,
  signal?: AbortSignal,
): Promise<AiStorySelectionResult> {
  return jsonRequest<AiStorySelectionResult>('/api/ai/story-selection/', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  });
}

export function requestContextDrills(
  request: AiContextDrillRequest,
  signal?: AbortSignal,
): Promise<AiContextDrillResult> {
  return jsonRequest<AiContextDrillResult>('/api/ai/context-drill/', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  });
}

export function requestAdaptiveHint(
  request: AiAdaptiveHintRequest,
  signal?: AbortSignal,
): Promise<AiAdaptiveHintResult> {
  return jsonRequest<AiAdaptiveHintResult>('/api/ai/adaptive-hint/', {
    method: 'POST',
    body: JSON.stringify(request),
    signal,
  });
}
