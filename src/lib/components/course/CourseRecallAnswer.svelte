<script lang="ts">
  import { insertAtSelection, restoreCaret } from '$lib/client/insert-character.ts';
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import { appStore, tr } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';

  let {
    feedback,
    saving,
    onanswer,
    gapOnly = false,
  }: {
    feedback?: 'correct' | 'wrong';
    saving: boolean;
    onanswer: (answer: string) => void;
    gapOnly?: boolean;
  } = $props();

  let answer = $state('');
  let input: HTMLInputElement | undefined;
  let previousFeedback: typeof feedback;

  $effect(() => {
    if (!feedback && previousFeedback === 'wrong') answer = '';
    previousFeedback = feedback;
  });

  async function insertCharacter(character: string): Promise<void> {
    const next = insertAtSelection(input, answer, character);
    answer = next.value;
    await restoreCaret(input, next.caret);
  }
</script>

<form
  class="mt-5 grid gap-[0.65rem]"
  onsubmit={(event) => {
    event.preventDefault();
    if (answer.trim() && !feedback && !saving) onanswer(answer);
  }}
>
  <label class="text-[0.88rem] font-[750]" for="course-recall-answer"
    >{$tr('Tvoje odpověď německy', 'Your answer in German')}</label
  >
  <input
    id="course-recall-answer"
    class="min-h-13 w-full min-w-0 rounded-lg border border-ink-600 bg-paper-50 px-[0.85rem] py-[0.7rem] text-[1.15rem] text-ink-950 aria-invalid:border-coral-700"
    bind:this={input}
    bind:value={answer}
    aria-describedby={feedback
      ? 'course-recall-help course-question-feedback'
      : 'course-recall-help'}
    aria-invalid={feedback === 'wrong' ? 'true' : undefined}
    readonly={Boolean(feedback)}
    disabled={saving}
    autocomplete="off"
    autocapitalize="none"
    spellcheck="false"
    enterkeyhint="done"
    lang="de"
    required
  />
  <p class="m-0 max-w-[65ch] text-[0.8rem] leading-normal text-ink-800" id="course-recall-help">
    {gapOnly
      ? $tr(
          'Napiš jen chybějící úsek. Můžeš použít ae, oe, ue a ss; velká písmena a interpunkce nevadí.',
          'Type only the missing section. You can use ae, oe, ue, and ss; letter case and punctuation do not matter.',
        )
      : $tr(
          'Napiš výraz z kurzu. Můžeš použít ae, oe, ue a ss; velká písmena nevadí.',
          'Type the expression from the course. You can use ae, oe, ue, and ss; letter case does not matter.',
        )}
  </p>
  {#if $appStore.settings?.showKeyboardHints !== false && !feedback}
    <GermanKeyboard oninsert={insertCharacter} />
  {/if}
  {#if !feedback}
    <button class="btn-base btn-primary mt-[0.3rem] w-full" type="submit" disabled={saving}>
      {$tr('Zkontrolovat odpověď', 'Check answer')}<ArrowRight size={18} aria-hidden="true" />
    </button>
  {/if}
</form>
