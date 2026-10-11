<script lang="ts">
  import PronunciationFeedback from '$lib/components/study/PronunciationFeedback.svelte';
  import { answerField, fieldLabel, submitButton } from '$lib/components/study/study-styles.ts';
  import { displayGerman } from '$lib/domain/vocabulary/display.ts';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Mic from '@lucide/svelte/icons/mic';
  import MicOff from '@lucide/svelte/icons/mic-off';

  import type { Note } from '$lib/domain/types.ts';
  import type { StudySession } from '$lib/state/study-session.svelte.ts';

  let { session, note }: { session: StudySession; note: Note } = $props();

  let input = $state<HTMLInputElement>();
  const copy = (cs: string, en: string) => session.copy(cs, en);
  const speech = $derived(session.speech);

  $effect(() => {
    void session.focusRequest;
    input?.focus();
  });
</script>

<form
  class="mx-auto mt-6 max-w-[44rem]"
  onsubmit={(event) => {
    event.preventDefault();
    void session.submitSpeaking();
  }}
>
  <div
    class={[
      'flex items-center gap-[0.9rem] rounded-[0.8rem] border p-3 [transition:border-color_160ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil),box-shadow_160ms_var(--ease-out-emil)]',
      speech.listening
        ? 'border-cobalt-700 bg-sky-50 shadow-[4px_4px_0_var(--color-cobalt-300)]'
        : 'border-ink-950 bg-paper-100',
    ]}
  >
    <button
      class="grid size-[4.1rem] flex-none place-items-center rounded-full border border-ink-950 bg-cobalt-700 text-white shadow-[3px_3px_0_var(--color-ink-950)] [transition:transform_140ms_var(--ease-out-emil),box-shadow_140ms_var(--ease-out-emil)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-cobalt-300 active:not-disabled:[transform:translate(2px,2px)_scale(0.97)] active:not-disabled:shadow-[1px_1px_0_var(--color-ink-950)]"
      type="button"
      disabled={!speech.available || Boolean(session.result) || session.reviewing}
      aria-pressed={speech.listening}
      aria-label={speech.listening
        ? copy('Ukončit poslech mikrofonu', 'Stop microphone listening')
        : copy('Spustit německé rozpoznání řeči', 'Start German speech recognition')}
      onclick={() => session.toggleSpeech()}
    >
      {#if speech.listening}<MicOff size={28} />{:else}<Mic size={28} />{/if}
    </button>
    <div role="status" aria-live="polite">
      <strong class="block text-[0.9rem]"
        >{!speech.available
          ? copy(
              'Mikrofon v tomto prohlížeči není dostupný',
              'The microphone is unavailable in this browser',
            )
          : speech.listening
            ? copy('Poslouchám němčinu…', 'Listening for German…')
            : copy('Mikrofon je připravený', 'The microphone is ready')}</strong
      >
      <span class="mt-[0.2rem] block text-[0.72rem] leading-[1.4] text-ink-600"
        >{!speech.available
          ? copy('Použij ruční přepis níže.', 'Use the manual transcript below.')
          : speech.listening
            ? copy('Až domluvíš, klepni znovu.', 'Tap again when you finish speaking.')
            : copy(
                'Klepni, řekni překlad a uprav přepis.',
                'Tap, say the German answer, and edit the transcript.',
              )}</span
      >
    </div>
  </div>

  <label class="mt-4 block max-[521px]:mt-[0.7rem]" for="speech-answer">
    <span class={fieldLabel}
      >{copy(
        'Rozpoznaný nebo ručně napsaný přepis',
        'Recognised or manually typed transcript',
      )}</span
    >
    <input
      id="speech-answer"
      bind:this={input}
      class={answerField(session.result?.correct)}
      bind:value={session.answer}
      disabled={Boolean(session.result) || session.reviewing}
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      enterkeyhint="done"
      lang="de"
      aria-describedby={speech.error ? 'speech-help speech-error' : 'speech-help'}
      placeholder={copy(
        'Tady se objeví, co prohlížeč slyšel',
        'What the browser heard appears here',
      )}
    />
  </label>
  <p id="speech-help" class="mt-[0.65rem] text-[0.7rem] leading-[1.45] text-ink-600">
    {copy(
      'Přepis můžeš opravit. Hodnotí se až po stisknutí tlačítka, ne během mluvení.',
      'You can edit the transcript. It is graded only after you press the button, never while you speak.',
    )}
  </p>
  {#if speech.error}<p
      id="speech-error"
      class="mt-[0.65rem] rounded-[0.45rem] bg-coral-50 px-[0.7rem] py-[0.6rem] text-[0.7rem] leading-[1.45] text-coral-700"
      role="alert"
    >
      {speech.error}
    </p>{/if}
  {#if session.result && speech.transcript}
    <PronunciationFeedback
      target={displayGerman(note)}
      transcript={speech.transcript}
      confidence={speech.confidence}
      onlisten={() => session.speak()}
    />
  {/if}
  {#if !session.result}
    <button
      class={submitButton}
      type="submit"
      disabled={!session.answer.trim() || session.reviewing || speech.listening}
    >
      {copy('Zkontrolovat přepis', 'Check transcript')}
      <ArrowRight size={18} />
    </button>
  {/if}
</form>
