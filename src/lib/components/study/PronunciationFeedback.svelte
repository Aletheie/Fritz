<script lang="ts">
  import { assessPronunciation } from '$lib/domain/grading/pronunciation.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import AudioLines from '@lucide/svelte/icons/audio-lines';
  import Volume2 from '@lucide/svelte/icons/volume-2';

  import type { HeardWordStatus } from '$lib/domain/grading/pronunciation.ts';

  let {
    target,
    transcript,
    confidence,
    onlisten,
  }: {
    target: string;
    /** What speech recognition heard, before any manual edits. */
    transcript: string;
    confidence?: number;
    onlisten: () => void;
  } = $props();

  const copy = (cs: string, en: string) => localized($motherTongue, { cs, en });
  const assessment = $derived(assessPronunciation(target, transcript, confidence));
  const tones: Record<HeardWordStatus, string> = {
    clear: 'border-mint-700 bg-mint-50 text-mint-700',
    umlaut: 'border-orange-500 bg-butter-50 text-orange-700',
    close: 'border-orange-500 bg-butter-50 text-orange-700',
    missing: 'border-coral-700 bg-coral-50 text-coral-700',
  };
  const tips = $derived(
    [
      assessment.words.some((word) => word.status === 'umlaut') &&
        copy(
          'Přehlásky zněly jako obyčejné samohlásky. U ü zaokrouhli rty jako na „u“ a řekni „i“; u ö totéž s „e“.',
          'Umlauts sounded like plain vowels. For ü, round your lips for “u” and say “ee”; for ö, do the same with “e”.',
        ),
      assessment.words.some((word) => word.status === 'close') &&
        copy(
          'Některá slova zazněla skoro správně. Vyslov je pomaleji a dotáhni konce slov.',
          'Some words came through almost right. Say them more slowly and finish the word endings.',
        ),
      assessment.words.some((word) => word.status === 'missing') &&
        copy(
          'Některá slova rozpoznávání nezachytilo. Poslechni si vzor a zkus je říct zřetelněji.',
          'Recognition missed some words. Listen to the model and say them more distinctly.',
        ),
    ].filter(Boolean) as string[],
  );
</script>

<section
  class="mt-4 grid gap-3 rounded-[0.8rem] border border-ink-950 bg-white p-3 text-left"
  data-testid="pronunciation-feedback"
  aria-labelledby="pronunciation-title"
>
  <div class="flex items-center justify-between gap-3">
    <h2 class="flex items-center gap-2 text-[0.9rem] font-extrabold" id="pronunciation-title">
      <AudioLines size={18} />
      {copy('Výslovnost', 'Pronunciation')}
    </h2>
    <span class="font-mono text-[0.72rem] font-extrabold">
      {assessment.level === 'clear'
        ? copy('srozumitelná', 'clear')
        : assessment.level === 'mostly'
          ? copy('skoro srozumitelná', 'mostly clear')
          : copy('nezřetelná', 'unclear')} · {assessment.score} %
    </span>
  </div>
  <p class="flex flex-wrap gap-[0.35rem]" lang="de">
    {#each assessment.words as word}
      <span
        class={[
          'rounded-full border px-[0.55rem] py-[0.2rem] text-[0.85rem] font-bold',
          tones[word.status],
        ]}
        title={word.heard
          ? copy(`Slyšeno: ${word.heard}`, `Heard: ${word.heard}`)
          : copy('Nezaznělo', 'Not heard')}>{word.word}</span
      >
    {/each}
  </p>
  <p class="text-[0.72rem] text-ink-600">
    {copy('Prohlížeč slyšel:', 'The browser heard:')} <q lang="de">{transcript}</q>
  </p>
  {#each tips as tip}<p class="text-[0.78rem] leading-[1.45] text-ink-800">{tip}</p>{/each}
  {#if assessment.lowConfidence}
    <p class="text-[0.72rem] text-ink-600">
      {copy(
        'Rozpoznávání si nebylo jisté, ber hodnocení jen orientačně.',
        'Recognition was unsure, so treat this as a rough guide.',
      )}
    </p>
  {/if}
  <button class="btn-base btn-secondary justify-self-start" type="button" onclick={onlisten}>
    <Volume2 size={17} />
    {copy('Poslechnout vzor', 'Hear the model')}
  </button>
</section>
