export type UserAiProvider = 'google-gemini' | 'anthropic' | 'openai-compatible';
export type AiOutputMode = 'schema' | 'json' | 'text';

export type AiConnectionInput = {
  provider: UserAiProvider;
  apiKey: string;
  model: string;
  baseURL?: string;
  outputMode?: AiOutputMode;
};

export type AiConnectionSummary = Omit<AiConnectionInput, 'apiKey'>;
