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

type ApiErrorPayload = {
  error?: string;
};

async function jsonRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => ({}))) as T & ApiErrorPayload;
  if (!response.ok) {
    throw new Error(payload.error || `Server odpověděl stavem ${response.status}.`);
  }
  return payload;
}

export function getAiKeyStatus(): Promise<AiKeyStatus> {
  return jsonRequest<AiKeyStatus>('/api/ai/key/');
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
