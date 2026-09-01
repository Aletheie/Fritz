import { requestCoachReply } from '../client/ai.ts';
import { createId } from '../domain/id.ts';

import type { AiCoachMessage, AiCoachResult, CoachDiagnostic } from '../domain/ai/types.ts';
import type { CoachScenario } from '../domain/course/coach.ts';
import type { MistakeTag, MotherTongue } from '../domain/types.ts';

export type ConversationMessage = {
  id: string;
  /** Rejected attempts stay visible, but must not replace the active conversational context. */
  contextual?: boolean;
} & AiCoachMessage;

export type ConversationTurn = {
  id: string;
  result: AiCoachResult;
  diagnosticsIgnored: boolean;
};

type ConversationSetupBase = {
  scenario: CoachScenario;
  motherTongue: MotherTongue;
  focusWords: string[];
  turnsTarget: number;
  opening?: string;
};

export type ConversationSetup =
  | (ConversationSetupBase & { mode: 'conversation' })
  | (ConversationSetupBase & {
      mode: 'repair';
      repair: { evidenceId: string; mistakeTag: MistakeTag };
    });

/**
 * Owns ephemeral conversation text and request state. Consumers persist only the
 * bounded signals returned by activeDiagnostics(), never this controller.
 */
export class ConversationController {
  setup = $state.raw<ConversationSetup | undefined>(undefined);
  messages = $state.raw<ConversationMessage[]>([]);
  turns = $state.raw<ConversationTurn[]>([]);
  latestResult = $state.raw<AiCoachResult | undefined>(undefined);
  latestTurnId = $state<string | undefined>(undefined);
  sending = $state(false);
  error = $state('');
  failedDraft = $state('');

  #controller: AbortController | undefined;

  get completedTurns(): number {
    return this.turns.length;
  }

  get complete(): boolean {
    return Boolean(this.setup && this.completedTurns >= this.setup.turnsTarget);
  }

  get averageScore(): number {
    if (this.turns.length === 0) return 0;
    return Math.round(
      this.turns.reduce((sum, turn) => sum + turn.result.score, 0) / this.turns.length,
    );
  }

  get independentTurns(): number {
    return this.turns.filter(
      (turn) =>
        turn.result.score >= 70 &&
        (turn.diagnosticsIgnored || turn.result.diagnostics.length === 0),
    ).length;
  }

  start(setup: ConversationSetup): void {
    this.#controller?.abort();
    this.setup = setup;
    this.messages = [
      {
        id: createId('message'),
        role: 'coach',
        text: setup.opening ?? setup.scenario.opening,
      },
    ];
    this.turns = [];
    this.latestResult = undefined;
    this.latestTurnId = undefined;
    this.sending = false;
    this.error = '';
    this.failedDraft = '';
  }

  reset(): void {
    this.#controller?.abort();
    this.setup = undefined;
    this.messages = [];
    this.turns = [];
    this.latestResult = undefined;
    this.latestTurnId = undefined;
    this.sending = false;
    this.error = '';
    this.failedDraft = '';
  }

  activeDiagnostics(): CoachDiagnostic[] {
    const diagnostics = new Map<MistakeTag, CoachDiagnostic>();
    for (const turn of this.turns) {
      if (turn.diagnosticsIgnored) continue;
      for (const diagnostic of turn.result.diagnostics) {
        const prior = diagnostics.get(diagnostic.tag);
        if (!prior || (prior.confidence === 'medium' && diagnostic.confidence === 'high')) {
          diagnostics.set(diagnostic.tag, diagnostic);
        }
      }
    }
    return [...diagnostics.values()].slice(0, 3);
  }

  ignoreDiagnostics(turnId: string): void {
    this.turns = this.turns.map((turn) =>
      turn.id === turnId ? { ...turn, diagnosticsIgnored: true } : turn,
    );
  }

  restoreDiagnostics(turnId: string): void {
    this.turns = this.turns.map((turn) =>
      turn.id === turnId ? { ...turn, diagnosticsIgnored: false } : turn,
    );
  }

  async send(rawMessage: string): Promise<AiCoachResult> {
    const setup = this.setup;
    const message = rawMessage.trim();
    if (!setup || this.sending || this.complete || message.length < 2) {
      throw new Error('Konverzace teď nemůže přijmout další repliku.');
    }

    const turn = this.completedTurns + 1;
    const history = this.messages
      .filter((item) => item.contextual !== false)
      .slice(-16)
      .map(({ role, text }) => ({ role, text }));
    const previousMessages = this.messages;
    const learnerMessageId = createId('message');
    this.messages = [...this.messages, { id: learnerMessageId, role: 'learner', text: message }];
    this.latestResult = undefined;
    this.latestTurnId = undefined;
    this.sending = true;
    this.error = '';
    this.failedDraft = '';
    this.#controller?.abort();
    this.#controller = new AbortController();

    try {
      const requestBase = {
        motherTongue: setup.motherTongue,
        scenarioId: setup.scenario.id,
        scenarioTitle: setup.scenario.title,
        goal: setup.scenario.goal,
        level: setup.scenario.level,
        turn,
        maxTurns: setup.turnsTarget,
        message,
        focusWords: setup.focusWords,
        history,
      };
      const result =
        setup.mode === 'repair'
          ? await requestCoachReply(
              {
                ...requestBase,
                mode: 'repair',
                turn: 1,
                maxTurns: 1,
                repair: setup.repair,
              },
              this.#controller.signal,
            )
          : await requestCoachReply(
              { ...requestBase, mode: 'conversation' },
              this.#controller.signal,
            );
      this.latestResult = result;
      this.messages = [
        ...this.messages.map((item) =>
          item.id === learnerMessageId && !result.accepted ? { ...item, contextual: false } : item,
        ),
        {
          id: createId('message'),
          role: 'coach',
          text: result.reply,
          contextual: result.accepted,
        },
      ];
      if (result.accepted) {
        const turnId = createId('conversation-turn');
        this.turns = [...this.turns, { id: turnId, result, diagnosticsIgnored: false }];
        this.latestTurnId = turnId;
      }
      return result;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        this.messages = previousMessages;
        this.failedDraft = message;
        this.error = error instanceof Error ? error.message : 'Konverzace se přerušila.';
      }
      throw error;
    } finally {
      this.sending = false;
    }
  }

  destroy(): void {
    this.#controller?.abort();
  }
}
