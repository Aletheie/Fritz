import { insertAtSelection, restoreCaret } from '../../client/insert-character.ts';

import type { DailyLesson } from '../../state/daily-lesson.svelte.ts';

type TextField = HTMLInputElement | HTMLTextAreaElement;

/**
 * Focuses the activity's answer field whenever the lesson asks for it after the
 * component mounted, and inserts German characters at the caret.
 */
export function answerField(getLesson: () => DailyLesson, field: () => TextField | undefined) {
  const initialRequest = getLesson().focusRequest;
  $effect(() => {
    const request = getLesson().focusRequest;
    const element = field();
    if (request !== initialRequest) element?.focus();
  });
  return {
    insert(character: string): void {
      const element = field();
      const lesson = getLesson();
      const next = insertAtSelection(element, lesson.answer, character);
      lesson.answer = next.value;
      if (element) void restoreCaret(element, next.caret);
    },
  };
}
