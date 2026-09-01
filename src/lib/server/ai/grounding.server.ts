import { normalizeText } from '../../domain/grading/normalize.ts';

import type { AiAdaptiveHintResult, AiContextDrill } from '../../domain/ai/types.ts';

export class AiGroundingError extends Error {
  constructor(message = 'AI odpověď obsahuje nepovolenou referenci.') {
    super(message);
    this.name = 'AiGroundingError';
  }
}

export function assertContextDrillReferences(
  drills: Array<Pick<AiContextDrill, 'sourceNoteIds' | 'objectiveIds'>>,
  allowedNoteIds: ReadonlySet<string>,
  allowedObjectiveIds: ReadonlySet<string>,
): void {
  for (const drill of drills) {
    if (drill.sourceNoteIds.some((id) => !allowedNoteIds.has(id))) {
      throw new AiGroundingError('AI odpověď odkazuje na neznámé slovíčko.');
    }
    if (drill.objectiveIds.some((id) => !allowedObjectiveIds.has(id))) {
      throw new AiGroundingError('AI odpověď odkazuje na neznámý studijní cíl.');
    }
  }
}

export function assertAdaptiveHintGrounding(
  hint: Pick<AiAdaptiveHintResult, 'hint' | 'sourceObjectiveIds'>,
  allowedObjectiveIds: ReadonlySet<string>,
  answer: string,
  revealAnswer: boolean,
): void {
  if (hint.sourceObjectiveIds.some((id) => !allowedObjectiveIds.has(id))) {
    throw new AiGroundingError('AI nápověda odkazuje na neznámý studijní cíl.');
  }
  const normalizedAnswer = normalizeText(answer);
  if (
    !revealAnswer &&
    normalizedAnswer.length >= 3 &&
    normalizeText(hint.hint).includes(normalizedAnswer)
  ) {
    throw new AiGroundingError('AI nápověda předčasně prozradila cílovou odpověď.');
  }
}
