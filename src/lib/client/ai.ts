import type { AiConnectionInput } from '$lib/domain/ai/connection.ts';
import { jsonRequest, streamRequest } from './http.ts';

import type {
  AiAdaptiveHintRequest,
  AiAdaptiveHintResult,
  AiCoachRequest,
  AiCoachResult,
  AiContextDrillRequest,
  AiContextDrillResult,
  AiExplanationResult,
  AiKeyStatus,
  AiSentenceEvaluationRequest,
  AiSentenceEvaluationResult,
  AiStorySelectionRequest,
  AiStorySelectionResult,
  AiStoryWordRequest,
  AiStoryWordResult,
  AiVocabularyRequest,
  AiVocabularyResult,
  AiWeeklySummaryRequest,
  AiWeeklySummaryResult,
} from '$lib/domain/ai/types.ts';

type AiExplanationRequest = {
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
};

function post<Request, Result>(path: string) {
  return (request: Request, signal?: AbortSignal) =>
    jsonRequest<Result>(path, { method: 'POST', body: JSON.stringify(request), signal });
}

export const getAiKeyStatus = () => jsonRequest<AiKeyStatus>('/api/ai/key/');
export const connectAi = post<AiConnectionInput, AiKeyStatus>('/api/ai/key/');
export const disconnectAi = () => jsonRequest<AiKeyStatus>('/api/ai/key/', { method: 'DELETE' });
export const migrateAiConnection = () =>
  jsonRequest<AiKeyStatus>('/api/ai/key/migrate/', { method: 'POST' });

export const requestVocabulary = post<AiVocabularyRequest, AiVocabularyResult>(
  '/api/ai/vocabulary/',
);
export const requestExplanation = post<AiExplanationRequest, AiExplanationResult>(
  '/api/ai/explain/',
);
export const evaluateSentence = post<AiSentenceEvaluationRequest, AiSentenceEvaluationResult>(
  '/api/ai/evaluate-sentence/',
);
/** Streams the coach's reply text through `onReply` while the full assessment is generated. */
export function requestCoachReply(
  request: AiCoachRequest,
  signal?: AbortSignal,
  onReply?: (text: string) => void,
): Promise<AiCoachResult> {
  return streamRequest<AiCoachResult>(
    '/api/ai/coach/?stream=1',
    { method: 'POST', body: JSON.stringify(request), signal },
    (event) => {
      if (event.type === 'reply' && typeof event.text === 'string') onReply?.(event.text);
    },
  );
}
export const requestStoryWord = post<AiStoryWordRequest, AiStoryWordResult>('/api/ai/story-word/');
export const requestStorySelection = post<AiStorySelectionRequest, AiStorySelectionResult>(
  '/api/ai/story-selection/',
);
export const requestContextDrills = post<AiContextDrillRequest, AiContextDrillResult>(
  '/api/ai/context-drill/',
);

export const requestAdaptiveHint = post<AiAdaptiveHintRequest, AiAdaptiveHintResult>(
  '/api/ai/adaptive-hint/',
);

export const requestWeeklySummary = post<AiWeeklySummaryRequest, AiWeeklySummaryResult>(
  '/api/ai/weekly-summary/',
);
