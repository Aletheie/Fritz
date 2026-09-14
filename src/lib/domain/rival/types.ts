export type RivalId = 'mila' | 'konrad' | 'nora';
export type RivalTopic = 'recall' | 'articles' | 'grammar';
export type RivalStrategy = 'balanced' | 'pressure' | 'counter';
export type RivalCopy = { cs: string; en: string };

export type RivalQuestion = {
  id: string;
  sourceId: string;
  topic: RivalTopic;
  prompt: RivalCopy;
  promptLanguage: 'de' | 'ui';
  answer: string;
  accepted: string[];
  options: string[];
  explanation: RivalCopy;
  difficulty: number;
  priority: number;
};

export type RivalMove =
  | 'opening'
  | 'weakness'
  | 'counter'
  | 'raise'
  | 'retry'
  | 'switch'
  | 'variety';

export type RivalRound = {
  question: RivalQuestion;
  move: RivalMove;
  botAnswer: string;
  botCorrect: boolean;
  botStake: 1 | 2;
  result?: { correct: boolean; stake: 1 | 2 };
};

export type RivalMatch = {
  id: string;
  rivalId: RivalId;
  strategy: RivalStrategy;
  weakness: RivalTopic;
  adjustment: number;
  rounds: RivalRound[];
  discardedSourceIds: string[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type RivalMatchSummary = {
  id: string;
  rivalId: RivalId;
  userScore: number;
  botScore: number;
  rounds: Array<{ topic: RivalTopic; correct: boolean; botCorrect: boolean }>;
  completedAt: string;
};

export type RivalryState = {
  match?: RivalMatch;
  history: RivalMatchSummary[];
};

export type RivalAction =
  | { type: 'start'; id: string; rivalId: RivalId; strategy: RivalStrategy; weakness: RivalTopic }
  | { type: 'answer'; matchId: string; questionId: string; answer: string; stake: 1 | 2 }
  | { type: 'next' | 'switch'; matchId: string; questionId: string };

export type RivalReading = {
  observations: number;
  weakness: RivalTopic;
  topics: Array<{ topic: RivalTopic; attempts: number; correct: number }>;
};
