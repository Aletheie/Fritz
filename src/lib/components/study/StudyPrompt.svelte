<script lang="ts">
  import {
    contextTitle,
    labIndex,
    promptBase,
    promptNote,
    promptSecondary,
    promptTitle,
    speakButton,
    targetTitle,
  } from '$lib/components/study/study-styles.ts';
  import { exerciseLabel } from '$lib/domain/study/results.ts';
  import { displayGerman } from '$lib/domain/vocabulary/display.ts';
  import Brain from '@lucide/svelte/icons/brain';
  import Check from '@lucide/svelte/icons/check';
  import Eye from '@lucide/svelte/icons/eye';
  import Keyboard from '@lucide/svelte/icons/keyboard';
  import Link2 from '@lucide/svelte/icons/link-2';
  import Mic from '@lucide/svelte/icons/mic';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Volume2 from '@lucide/svelte/icons/volume-2';

  import type { StudySession } from '$lib/state/study-session.svelte.ts';

  let {
    session,
    encounterCount,
    mastery,
    returnReason,
    showStudyTips,
  }: {
    session: StudySession;
    encounterCount: number;
    mastery: string;
    /** Why this card is back, from its latest counted review; absent for new cards. */
    returnReason?: string;
    showStudyTips: boolean;
  } = $props();

  const copy = (cs: string, en: string) => session.copy(cs, en);
  const note = $derived(session.note);
</script>

{#if note}
  <div
    class="flex flex-wrap items-center justify-between gap-3 max-[900px]:gap-[0.45rem] max-[521px]:flex-nowrap"
  >
    <span
      class="inline-flex items-center gap-[0.42rem] rounded-full border border-ink-950 bg-acid-100 px-[0.68rem] py-[0.43rem] text-[0.66rem] font-[850] tracking-[0.055em] text-ink-950 uppercase max-[900px]:px-[0.55rem] max-[900px]:py-[0.35rem] max-[900px]:text-[0.59rem] max-[521px]:max-w-[43%] max-[521px]:flex-none max-[521px]:truncate"
    >
      {#if session.exercise === 'typing'}<Keyboard size={14} />
      {:else if session.exercise === 'choice'}<Check size={14} />
      {:else if session.exercise === 'flashcard'}<Eye size={14} />
      {:else if session.exercise === 'sentence'}<Sparkles size={14} />
      {:else if session.exercise === 'matching'}<Link2 size={14} />
      {:else if session.exercise === 'speaking'}<Mic size={14} />
      {:else}<Brain size={14} />{/if}
      {exerciseLabel(session.exercise, session.language)}
    </span>
    <div
      class="flex flex-wrap items-center justify-end gap-[0.35rem] max-[900px]:gap-1 max-[521px]:min-w-0 max-[521px]:flex-nowrap max-[521px]:overflow-x-auto [&>span]:rounded-full [&>span]:border [&>span]:px-2 [&>span]:py-[0.32rem] [&>span]:font-mono [&>span]:text-[0.62rem] [&>span]:font-extrabold [&>span]:whitespace-nowrap max-[900px]:[&>span]:px-[0.42rem] max-[900px]:[&>span]:py-[0.28rem] max-[900px]:[&>span]:text-[0.56rem]"
      aria-label={copy('Stav procvičovaného výrazu', 'Practice status for this expression')}
    >
      <span class="border-line bg-paper-100 text-ink-600"
        >{encounterCount}. {copy('setkání', 'encounter')}</span
      >
      <span class="border-line bg-paper-100 text-ink-600">{mastery}</span>
      {#if note.cefr}<span class="border-cobalt-300 bg-cobalt-50 text-cobalt-700">{note.cefr}</span
        >{/if}
    </div>
  </div>

  {#if showStudyTips && returnReason}
    <p
      class="mt-3 max-w-[42rem] font-mono text-[0.7rem] leading-[1.45] font-bold text-cobalt-700"
      data-testid="return-reason"
    >
      {copy('proč teď', 'why now')} · {returnReason}
    </p>
  {/if}

  {#if showStudyTips}
    <p class="mt-3 max-w-[42rem] text-[0.77rem] leading-[1.45] text-ink-600 max-[521px]:hidden">
      {session.language === 'en'
        ? 'This activity practises what you find difficult about this word.'
        : session.exerciseReason}
    </p>
  {/if}

  {#if session.exercise === 'speaking'}
    <div class={promptSecondary}>
      <p class={labIndex}>
        {copy(
          'řekni německy · u podstatného jména i se členem',
          'say it in German · include the article for nouns',
        )}
      </p>
      <h1 class={contextTitle}>{session.meaning}</h1>
      <p class={promptNote}>
        {session.speech.available
          ? copy(
              'Promluv, pak si před odesláním zkontroluj přepis.',
              'Speak, then check the transcript before submitting.',
            )
          : copy(
              'Mikrofon tu není dostupný, ale stejnou odpověď můžeš napsat.',
              'The microphone is unavailable, but you can type the same answer.',
            )}
      </p>
    </div>
  {:else if session.exercise === 'matching'}
    <div class={promptSecondary}>
      <p class={labIndex}>
        {copy('česky vlevo · německy vpravo', 'meanings on the left · German on the right')}
      </p>
      <h1 class={contextTitle}>{copy('Spoj dvojice', 'Match the word pairs')}</h1>
      <p class={promptNote}>
        {copy(
          'Ke každému významu najdi německý výraz.',
          'Match each meaning with its German expression.',
        )}
      </p>
    </div>
  {:else if session.exercise === 'sentence'}
    <div class={promptSecondary}>
      <p class={labIndex}>
        {copy('použij v přirozené německé větě', 'use it in a natural German sentence')}
      </p>
      <div class="flex items-center justify-center gap-[0.8rem]">
        <h1 class={targetTitle} lang="de">{displayGerman(note)}</h1>
        <button
          class={speakButton}
          type="button"
          aria-label={copy('Přehrát německou výslovnost', 'Play German pronunciation')}
          onclick={() => session.speak()}><Volume2 size={18} /></button
        >
      </div>
      <p class="mt-[0.7rem] text-[0.9rem] font-bold text-ink-600">{session.meaning}</p>
    </div>
  {:else if session.exercise === 'word-order' && session.wordOrder}
    <div class={promptBase}>
      <p class={labIndex}>{copy('poskládej německý slovosled', 'build the German word order')}</p>
      <h1 class={contextTitle}>{session.wordOrder.translation ?? session.meaning}</h1>
    </div>
  {:else if session.exercise === 'cloze' && session.cloze}
    <div class={promptBase}>
      <p class={labIndex}>{session.cloze.label}</p>
      <h1 class={contextTitle}>{session.cloze.translation ?? session.meaning}</h1>
    </div>
  {:else}
    <div class={promptBase}>
      <p class={labIndex}>{copy('česky / vybav si německy', 'meaning / recall the German')}</p>
      <h1 class={promptTitle}>{session.meaning}</h1>
      {#if note.tags.length > 0}<p
          class="mt-[0.95rem] font-mono text-[0.68rem] font-bold text-ink-600"
        >
          {note.tags.slice(0, 3).join(' · ')}
        </p>{/if}
    </div>
  {/if}
{/if}
