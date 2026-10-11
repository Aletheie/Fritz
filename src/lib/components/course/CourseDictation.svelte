<script lang="ts">
  import GermanKeyboard from '$lib/components/study/GermanKeyboard.svelte';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Volume2 from '@lucide/svelte/icons/volume-2';
  import { onMount, tick } from 'svelte';

  import CourseAnswerList from './CourseAnswerList.svelte';
  import { pathButton } from './path-styles.ts';

  import type { CoursePathQuestion } from '$lib/domain/course/path-activities.ts';

  let {
    question,
    feedback,
    saving,
    selected,
    showKeyboard,
    onchoose,
    onsubmit,
    textAlternative = $bindable(false),
  }: {
    question: CoursePathQuestion;
    feedback?: 'correct' | 'wrong';
    saving: boolean;
    selected: string;
    showKeyboard: boolean;
    /** Answer picked in the text alternative. */
    onchoose: (option: string) => void;
    /** Typed transcript. */
    onsubmit: (answer: string) => void;
    /** True while the learner answers without audio. */
    textAlternative?: boolean;
  } = $props();

  let answer = $state('');
  let fallback = $state(false);
  let playing = $state(false);
  let supported = $state(false);
  let input = $state<HTMLInputElement>();
  let utterance: SpeechSynthesisUtterance | undefined;
  let previousFeedback: typeof feedback;

  const locked = $derived(Boolean(feedback) || saving);
  const subtle = 'mt-[0.45rem] text-[0.72rem] leading-[1.45] text-ink-800';
  const label = 'font-mono text-[0.6rem] font-[850] tracking-[0.04em] uppercase';
  const toggleClass =
    'mx-auto mt-[0.55rem] -mb-[0.6rem] flex min-h-11 items-center justify-center gap-[0.4rem] border-0 bg-transparent p-[0.55rem] text-[0.72rem] font-extrabold text-cobalt-700 underline underline-offset-[0.2em]';
  const control =
    'inline-flex min-h-12 items-center justify-center gap-[0.45rem] rounded-[0.25rem_0.7rem_0.25rem_0.25rem] border border-ink-950 px-[0.85rem] py-[0.65rem] text-[0.78rem] font-[850] active:[transform:scale(0.97)] fine-hover:[transform:translateY(-1px)]';

  $effect(() => {
    textAlternative = fallback || !supported;
  });

  $effect(() => {
    if (!feedback && previousFeedback === 'wrong') answer = '';
    previousFeedback = feedback;
  });

  onMount(() => {
    supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    return stop;
  });

  const copy = (cs: string, en: string) => localized($motherTongue, { cs, en });

  function play(rate = 1): void {
    if (!supported) {
      fallback = true;
      return;
    }
    window.speechSynthesis.cancel();
    const current = new SpeechSynthesisUtterance(question.answer);
    current.lang = 'de-DE';
    current.rate = rate;
    utterance = current;
    playing = true;
    current.addEventListener('end', () => {
      if (utterance !== current) return;
      utterance = undefined;
      playing = false;
    });
    current.addEventListener('error', () => {
      if (utterance !== current) return;
      utterance = undefined;
      playing = false;
      fallback = true;
    });
    window.speechSynthesis.speak(current);
    void tick().then(() => input?.focus());
  }

  function stop(): void {
    utterance = undefined;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    playing = false;
  }

  function toggleFallback(): void {
    if (feedback) return;
    fallback = !fallback;
    stop();
    if (!fallback) void tick().then(() => input?.focus());
  }

  async function insertCharacter(character: string): Promise<void> {
    const start = input?.selectionStart ?? answer.length;
    const end = input?.selectionEnd ?? start;
    answer = `${answer.slice(0, start)}${character}${answer.slice(end)}`;
    await tick();
    input?.focus();
    input?.setSelectionRange(start + character.length, start + character.length);
  }

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    if (answer.trim() && !locked) onsubmit(answer);
  }
</script>

{#if textAlternative}
  <div
    class="mt-4 border-y border-cobalt-700 bg-sky-50 p-4"
    data-testid="dictation-alternative"
    id="dictation-alternative"
  >
    <span class="{label} text-cobalt-700">{copy('Textová alternativa', 'Text alternative')}</span>
    <h2
      class="mt-2 text-[1.65rem] leading-[1.05] font-black tracking-[-0.04em]"
      lang={question.promptLang}
    >
      {question.prompt}
    </h2>
    <p class={subtle}>
      {supported
        ? copy(
            'Vyber větu se stejným významem. Výsledek se počítá stejně.',
            'Choose the grammatically correct sentence. It is scored the same way.',
          )
        : copy(
            'Přehrávání zvuku tu není dostupné. Vyber správnou německou větu.',
            'Audio playback is unavailable here. Choose the correct German sentence.',
          )}
    </p>
    <CourseAnswerList
      options={question.options}
      answer={question.answer}
      {selected}
      {feedback}
      {saving}
      lang="de"
      sentences
      {onchoose}
    />
    {#if supported && !feedback}
      <button class={toggleClass} type="button" aria-pressed="true" onclick={toggleFallback}>
        <Volume2 size={16} />
        {copy('Zpět k poslechu', 'Return to listening')}
      </button>
    {/if}
  </div>
{:else}
  <div
    class="mt-4 flex items-center gap-4 rounded-[0.3rem_1rem_0.3rem_0.3rem] bg-ink-950 p-4 text-paper-50"
    data-testid="dictation-player"
    data-playing={playing}
    role="status"
    aria-live="polite"
    aria-busy={playing}
  >
    <div
      class="flex size-16 flex-none items-center justify-center gap-[0.2rem] rounded-full bg-acid-500"
      aria-hidden="true"
    >
      {#each [0, 110, 220, 110, 0] as delay}
        <span
          class={[
            'h-[1.8rem] w-[0.22rem] rounded-full bg-ink-950',
            playing
              ? 'animate-dictation-pulse motion-reduce:[transform:scaleY(0.65)] motion-reduce:animate-none'
              : '[transform:scaleY(0.3)]',
          ]}
          style:animation-delay={`${delay}ms`}
        ></span>
      {/each}
    </div>
    <div class="min-w-0">
      <span class="{label} text-acid-500">{copy('Poslechový diktát', 'Listening dictation')}</span>
      <h2 class="mt-[0.2rem] text-[1.3rem] leading-[1.1] font-black tracking-[-0.02em]">
        {playing
          ? copy('Věta právě zní…', 'The sentence is playing…')
          : copy('Poslechni, potom napiš.', 'Listen, then type.')}
      </h2>
      <p class="mt-[0.35rem] text-[0.72rem] leading-[1.4] text-paper-200">
        {copy(
          `${question.wordCount ?? 0} slov · interpunkci hodnotit nebudeme`,
          `${question.wordCount ?? 0} words · punctuation is not graded`,
        )}
      </p>
    </div>
  </div>

  <div class="mt-[0.7rem] grid grid-cols-[minmax(0,1fr)_auto] gap-[0.55rem]">
    <button
      class="{control} bg-acid-500 shadow-[3px_3px_0_var(--color-ink-950)]"
      type="button"
      disabled={locked}
      onclick={() => play(1)}
    >
      <Volume2 size={20} />
      {playing ? copy('Přehrávám…', 'Playing…') : copy('Přehrát větu', 'Play sentence')}
    </button>
    <button class="{control} bg-white" type="button" disabled={locked} onclick={() => play(0.78)}>
      {copy('Pomaleji', 'Slower')}
    </button>
  </div>

  <form class="mt-[1.2rem]" onsubmit={submit}>
    <label class="block text-[0.76rem] font-[850]" for="dictation-answer"
      >{copy('Co jsi slyšela?', 'What did you hear?')}</label
    >
    <input
      class="mt-[0.4rem] min-h-[3.4rem] w-full rounded-[0.3rem_0.85rem_0.3rem_0.3rem] border border-ink-950 bg-white px-[0.9rem] py-[0.8rem] text-[1rem] leading-[1.35] aria-invalid:border-coral-700 aria-invalid:bg-coral-50"
      id="dictation-answer"
      bind:this={input}
      bind:value={answer}
      aria-describedby="dictation-help"
      aria-invalid={feedback === 'wrong' ? 'true' : undefined}
      disabled={locked}
      autocomplete="off"
      autocapitalize="sentences"
      spellcheck="false"
      enterkeyhint="done"
      lang="de"
      placeholder={copy('Napiš celou německou větu', 'Type the full German sentence')}
    />
    <p class={subtle} id="dictation-help">
      {copy(
        'Velká písmena a tečky nevadí. Pořadí a německá slova ano.',
        'Capital letters and punctuation do not matter. Word choice and order do.',
      )}
    </p>
    {#if showKeyboard && !feedback}
      <GermanKeyboard oninsert={insertCharacter} />
    {/if}
    {#if !feedback}
      <button
        class="{pathButton} mt-[1.15rem] w-full bg-acid-500 text-ink-950"
        type="submit"
        disabled={!answer.trim() || saving}
      >
        {copy('Zkontrolovat přepis', 'Check transcript')}
        <ArrowRight size={18} />
      </button>
    {/if}
  </form>

  {#if !feedback}
    <button class={toggleClass} type="button" aria-pressed="false" onclick={toggleFallback}>
      {copy('Teď nemůžu poslouchat', 'I cannot listen right now')}
    </button>
  {/if}
{/if}
