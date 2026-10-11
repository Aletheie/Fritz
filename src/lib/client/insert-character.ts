import { tick } from 'svelte';

type TextField = HTMLInputElement | HTMLTextAreaElement;

/** Replaces the field's current selection in `value` with `text`. */
export function insertAtSelection(
  field: TextField | undefined,
  value: string,
  text: string,
): { value: string; caret: number } {
  const start = field?.selectionStart ?? value.length;
  const end = field?.selectionEnd ?? start;
  return {
    value: `${value.slice(0, start)}${text}${value.slice(end)}`,
    caret: start + text.length,
  };
}

/** Waits for Svelte to flush the new value, then puts the caret back after the insert. */
export async function restoreCaret(
  field: TextField | undefined,
  caret: number,
  options?: FocusOptions,
): Promise<void> {
  await tick();
  field?.focus(options);
  field?.setSelectionRange(caret, caret);
}
