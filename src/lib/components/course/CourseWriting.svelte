<script lang="ts">
  import { createWritingAutosave, type WritingSaveStatus } from '$lib/client/writing-autosave.ts';
  import { courseCommunicationForChapter } from '$lib/domain/course/course-communication.ts';
  import {
    checkCourseWriting,
    COURSE_WRITING_MAX_LENGTH,
    courseWritingCriteria,
    courseWritingLimits,
    courseWritingProfiles,
  } from '$lib/domain/course/course-writing.ts';
  import { courseWordLabel } from '$lib/domain/course/path-activities.ts';
  import type { CoursePathChapter } from '$lib/domain/course/path.ts';
  import { localized } from '$lib/i18n';
  import { courseChapterCopy } from '$lib/i18n/course.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import { onMount, tick } from 'svelte';

  let {
    chapter,
    value = $bindable(''),
    saving,
    onsave,
  }: {
    chapter: CoursePathChapter;
    value?: string;
    saving: boolean;
    onsave: () => Promise<void>;
  } = $props();

  const communication = $derived(courseCommunicationForChapter(chapter.id));
  const profile = $derived(courseWritingProfiles[chapter.level]);
  const limits = $derived(courseWritingLimits(chapter));
  const criteria = $derived(courseWritingCriteria(chapter, $motherTongue));
  const check = $derived(checkCourseWriting(chapter, value));
  const chapterCopy = $derived(courseChapterCopy($motherTongue, chapter));
  let reviewing = $state(false);
  let confirmations = $state<boolean[]>([false, false, false]);
  let error = $state('');
  let reviewHeading = $state<HTMLHeadingElement>();
  let input: HTMLTextAreaElement | undefined;
  let draftStatus = $state<WritingSaveStatus>('idle');
  let autosave: ReturnType<typeof createWritingAutosave> | undefined;
  let submitting = $state(false);

  onMount(() => {
    const nodeId = `${chapter.id}:sentence`;
    autosave = createWritingAutosave(
      (text) => appStore.saveWritingDraft(nodeId, text),
      (status) => {
        draftStatus = status;
      },
    );
    const flush = () => {
      void autosave?.flush();
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  });

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  function validate(): boolean {
    if (!check.enoughWords)
      error = copy(
        `Rozveď text alespoň na ${limits.minimumWords} slov.`,
        `Develop your text to at least ${limits.minimumWords} words.`,
      );
    else if (!check.withinLimit)
      error = copy(
        'Zkrať text na nejvýše 5 000 znaků.',
        'Shorten your text to no more than 5,000 characters.',
      );
    else if (!check.usesCourseVocabulary)
      error = copy(
        'Použij alespoň jeden výraz z nabídky slovíček.',
        'Use at least one expression from the chapter word bank.',
      );
    else {
      error = '';
      return true;
    }
    void tick().then(() => input?.focus());
    return false;
  }

  async function review(): Promise<void> {
    if (!validate()) return;
    reviewing = true;
    await tick();
    reviewHeading?.focus();
  }

  async function submit(): Promise<void> {
    if (saving || submitting || !validate()) return;
    if (!confirmations.every(Boolean)) {
      error = copy(
        'Před uložením projdi všechny tři body kontroly.',
        'Review all three checklist items before saving.',
      );
      return;
    }
    submitting = true;
    try {
      if (autosave && !(await autosave.flush())) return;
      await onsave();
    } finally {
      submitting = false;
    }
  }

  const paragraph = 'my-[0.65rem] max-w-[65ch] leading-[1.65] text-ink-950';
  const support = 'my-[0.65rem] max-w-[65ch] text-[0.85rem] leading-[1.65] text-ink-800';
  const disclosure = 'my-4 border-y border-line py-[0.4rem]';
  const summary = 'min-h-11 cursor-pointer content-center font-[750] text-cobalt-700';
</script>

<section class="rounded-xl border border-line bg-paper-50 p-[1.3rem] max-[481px]:p-4">
  <p class="my-[0.65rem] max-w-[65ch] text-[1.12rem] leading-[1.65] font-[750] text-ink-950">
    {communication
      ? localized($motherTongue, communication.writing.prompt)
      : $motherTongue === 'cs'
        ? chapter.sentencePrompt
        : chapterCopy.mission}
  </p>
  <a
    class="inline-flex min-h-11 items-center text-[0.85rem] font-bold text-cobalt-700"
    href="/progress/#writing-portfolio-title"
    >{copy('Moje rozepsané a dokončené texty', 'My drafts and finished writing')} →</a
  >
  {#if communication}
    <details class={disclosure}>
      <summary class={summary}>{copy('Podklad pro zprávu', 'Source for your message')}</summary>
      <p class={paragraph} lang="de">{communication.listening.transcript}</p>
    </details>
  {:else}
    <p class={support}>
      {limits.minimumWords === 8 && chapter.level === 'C1.2'
        ? copy(
            'Ponech text stručný. Přesnost a zachování významu mají přednost před délkou.',
            'Keep the text concise. Precision and preserving meaning matter more than length.',
          )
        : localized($motherTongue, profile.extension)}
    </p>
  {/if}
  <details class={disclosure}>
    <summary class={summary}
      >{copy('Slovíčka a gramatika k zadání', 'Vocabulary and grammar support')}</summary
    >
    <p class={paragraph} lang="de">{chapter.grammarPattern}</p>
    <ul
      class="flex list-none flex-wrap gap-x-4 gap-y-[0.4rem] p-0"
      aria-label={copy('Výrazy kapitoly', 'Chapter expressions')}
    >
      {#each chapter.words as word}<li class="text-[0.9rem] font-[650]" lang="de">
          {courseWordLabel(word)}
        </li>{/each}
    </ul>
    {#if communication}<ul>
        {#each communication.writing.phrases as phrase}<li lang="de">{phrase}</li>{/each}
      </ul>{/if}
  </details>
  <label class="mt-4 block text-[0.92rem] font-[750]" for="course-sentence"
    >{copy('Tvůj text německy', 'Your text in German')}</label
  >
  <textarea
    id="course-sentence"
    class="mt-2 block w-full min-w-0 resize-y rounded-lg border border-ink-600 bg-paper-50 p-[0.9rem] text-[1.05rem] leading-[1.65] text-ink-950 placeholder:text-ink-700 aria-invalid:border-coral-700"
    bind:this={input}
    bind:value
    oninput={(event) => {
      confirmations = [false, false, false];
      error = '';
      autosave?.update(event.currentTarget.value);
    }}
    rows={chapter.level.startsWith('A1') ? 5 : 9}
    lang="de"
    maxlength={COURSE_WRITING_MAX_LENGTH}
    readonly={saving || submitting}
    aria-describedby={`course-writing-help${error ? ' course-writing-error' : ''}`}
    aria-invalid={(Boolean(error) && !check.ready) || undefined}
    placeholder={copy('Napiš vlastní německý text…', 'Write your own German text…')}></textarea>
  <p class={support} role="status">
    {draftStatus === 'saved'
      ? copy('Rozepsaný text je uložený v tomto zařízení.', 'Your draft is saved on this device.')
      : draftStatus === 'pending' || draftStatus === 'saving'
        ? copy('Ukládám rozepsaný text…', 'Saving your draft…')
        : draftStatus === 'error'
          ? copy(
              'Text se nepodařilo uložit. Zůstává zde k úpravě.',
              'The draft could not be saved. Your text remains here to edit.',
            )
          : copy(
              'Rozepsaný text se průběžně ukládá. Najdeš ho také v přehledu svých textů.',
              'Drafts save as you write. You can also find them in your writing collection.',
            )}
  </p>
  {#if draftStatus === 'error'}<button
      type="button"
      class="mt-4 min-h-11 w-full cursor-pointer rounded-lg border border-line-strong bg-paper-50 px-4 py-[0.6rem] text-cobalt-700"
      onclick={() => void autosave?.flush()}>{copy('Zkusit uložit znovu', 'Retry saving')}</button
    >{/if}
  <p id="course-writing-help" class={support}>
    {copy(
      `${check.wordCount} slov · doporučený rozsah ${limits.suggestedWords[0]}–${limits.suggestedWords[1]} slov`,
      `${check.wordCount} words · suggested length ${limits.suggestedWords[0]}–${limits.suggestedWords[1]} words`,
    )}
    <br />{copy(
      `Pro tento krátký úkol stačí alespoň ${limits.minimumWords} slov a jeden výraz kapitoly.`,
      `For this short task, use at least ${limits.minimumWords} words and one chapter expression.`,
    )}
  </p>
  {#if reviewing}
    <div>
      <h2 class="mt-6 text-[1.2rem]" tabindex="-1" bind:this={reviewHeading}>
        {copy('Přečti, porovnej, uprav', 'Reread, compare, revise')}
      </h2>
      <p class={support}>
        {copy(
          'Kontrola ověřila délku a slovní zásobu. Význam a gramatiku nyní posuď podle bodů níže.',
          'The check verified length and vocabulary. Now review meaning and grammar using the points below.',
        )}
      </p>
      {#if communication}
        <details class={disclosure}>
          <summary class={summary}>{copy('Jedna možná odpověď', 'One possible response')}</summary>
          <p class={paragraph} lang="de">{communication.writing.model}</p>
          <p class={support}>
            {copy(
              'Tvoje formulace může být jiná. Porovnej hlavně údaje, záměr a tón.',
              'Your wording may differ. Compare the details, purpose, and tone.',
            )}
          </p>
        </details>
      {/if}
      <fieldset
        class="my-4 border-0 p-0"
        disabled={saving}
        aria-describedby={error && check.ready ? 'course-writing-error' : undefined}
      >
        <legend class="text-[0.92rem] font-[750]"
          >{copy('Moje kontrola textu', 'My text review')}</legend
        >
        {#each criteria as criterion, index}
          <label
            class="m-0 flex min-h-11 cursor-pointer items-start gap-[0.7rem] py-2 text-[0.92rem] leading-normal font-medium"
            ><input
              class="mt-[0.12rem] size-[1.15rem] flex-none accent-cobalt-700"
              type="checkbox"
              bind:checked={confirmations[index]}
              onchange={() => {
                error = '';
              }}
            /> <span>{criterion}</span></label
          >
        {/each}
      </fieldset>
      <p class={support}>
        {copy(
          'Po úpravě textu projdi kontrolu znovu. Uloží se tvůj text i dokončení; nejde o automatické hodnocení jazykové úrovně.',
          'After editing, review the checklist again. Your text and completion will be saved; this is not an automatic proficiency assessment.',
        )}
      </p>
      <details class={disclosure}>
        <summary class={summary}>{copy('Minuta pro plynulost', 'A minute for fluency')}</summary>
        <p class={paragraph}>
          {copy(
            'Odvrať pohled od textu a předej stejné sdělení nahlas vlastními slovy. Pak to zkus podruhé o něco plynuleji. Používej známé výrazy; rychlost se nehodnotí.',
            'Look away from the text and convey the same message aloud in your own words. Then try again a little more smoothly. Use familiar expressions; speed is not graded.',
          )}
        </p>
      </details>
    </div>
  {/if}
  {#if error}<p id="course-writing-error" class="{paragraph} text-coral-700" role="alert">
      {error}
    </p>{/if}
  <button
    class="btn-base btn-primary mt-4 w-full"
    type="button"
    disabled={saving || submitting}
    onclick={reviewing ? () => void submit() : () => void review()}
  >
    {saving
      ? copy('Ukládám text…', 'Saving text…')
      : reviewing
        ? copy('Uložit text a dokončit', 'Save text and finish')
        : copy('Přejít ke kontrole textu', 'Review my text')}
    <ArrowRight size={18} aria-hidden="true" />
  </button>
</section>
