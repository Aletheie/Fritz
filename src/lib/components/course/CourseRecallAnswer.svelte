<script lang="ts">
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import { localized } from '$lib/i18n';
  import { appStore, motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import { tick } from 'svelte';

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

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  async function insertCharacter(character: string): Promise<void> {
    const start = input?.selectionStart ?? answer.length;
    const end = input?.selectionEnd ?? start;
    answer = `${answer.slice(0, start)}${character}${answer.slice(end)}`;
    await tick();
    input?.focus();
    input?.setSelectionRange(start + character.length, start + character.length);
  }
</script>

<form
  onsubmit={(event) => {
    event.preventDefault();
    if (answer.trim() && !feedback && !saving) onanswer(answer);
  }}
>
  <label for="course-recall-answer">{copy('Tvoje odpověď německy', 'Your answer in German')}</label>
  <input
    id="course-recall-answer"
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
  <p id="course-recall-help">
    {gapOnly
      ? copy(
          'Napiš jen chybějící úsek. Můžeš použít ae, oe, ue a ss; velká písmena a interpunkce nevadí.',
          'Type only the missing section. You can use ae, oe, ue, and ss; letter case and punctuation do not matter.',
        )
      : copy(
          'Napiš výraz z kurzu. Můžeš použít ae, oe, ue a ss; velká písmena nevadí.',
          'Type the expression from the course. You can use ae, oe, ue, and ss; letter case does not matter.',
        )}
  </p>
  {#if $appStore.settings?.showKeyboardHints !== false && !feedback}
    <GermanKeyboard oninsert={insertCharacter} />
  {/if}
  {#if !feedback}
    <button class="btn-base btn-primary" type="submit" disabled={saving}>
      {copy('Zkontrolovat odpověď', 'Check answer')}<ArrowRight size={18} aria-hidden="true" />
    </button>
  {/if}
</form>

<style>
  form {
    display: grid;
    gap: 0.65rem;
    margin-top: 1.25rem;
  }
  label {
    font-size: 0.88rem;
    font-weight: 750;
  }
  input {
    width: 100%;
    min-width: 0;
    min-height: 3.25rem;
    border: 1px solid var(--color-ink-600);
    border-radius: 0.5rem;
    background: var(--color-paper-50);
    color: var(--color-ink-950);
    padding: 0.7rem 0.85rem;
    font-size: 1.15rem;
  }
  input[aria-invalid='true'] {
    border-color: var(--color-coral-700);
  }
  p {
    margin: 0;
    max-width: 65ch;
    color: var(--color-ink-800);
    font-size: 0.8rem;
    line-height: 1.5;
  }
  button {
    width: 100%;
    margin-top: 0.3rem;
  }
</style>
