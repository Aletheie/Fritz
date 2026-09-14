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
</script>

<section class="writing-workspace">
  <p class="task">
    {communication
      ? localized($motherTongue, communication.writing.prompt)
      : $motherTongue === 'cs'
        ? chapter.sentencePrompt
        : chapterCopy.mission}
  </p>
  <a class="writing-collection" href="/progress/#writing-portfolio-title"
    >{copy('Moje rozepsané a dokončené texty', 'My drafts and finished writing')} →</a
  >
  {#if communication}
    <details class="source-material">
      <summary>{copy('Podklad pro zprávu', 'Source for your message')}</summary>
      <p lang="de">{communication.listening.transcript}</p>
    </details>
  {:else}
    <p class="support">
      {limits.minimumWords === 8 && chapter.level === 'C1.2'
        ? copy(
            'Ponech text stručný. Přesnost a zachování významu mají přednost před délkou.',
            'Keep the text concise. Precision and preserving meaning matter more than length.',
          )
        : localized($motherTongue, profile.extension)}
    </p>
  {/if}
  <details class="language-support">
    <summary>{copy('Slovíčka a gramatika k zadání', 'Vocabulary and grammar support')}</summary>
    <p lang="de">{chapter.grammarPattern}</p>
    <ul class="word-bank" aria-label={copy('Výrazy kapitoly', 'Chapter expressions')}>
      {#each chapter.words as word}<li lang="de">{courseWordLabel(word)}</li>{/each}
    </ul>
    {#if communication}<ul>
        {#each communication.writing.phrases as phrase}<li lang="de">{phrase}</li>{/each}
      </ul>{/if}
  </details>
  <label for="course-sentence">{copy('Tvůj text německy', 'Your text in German')}</label>
  <textarea
    id="course-sentence"
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
  <p class="support" role="status">
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
      class="retry-save"
      onclick={() => void autosave?.flush()}>{copy('Zkusit uložit znovu', 'Retry saving')}</button
    >{/if}
  <p id="course-writing-help" class="support">
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
    <div class="writing-review">
      <h2 tabindex="-1" bind:this={reviewHeading}>
        {copy('Přečti, porovnej, uprav', 'Reread, compare, revise')}
      </h2>
      <p class="support">
        {copy(
          'Kontrola ověřila délku a slovní zásobu. Význam a gramatiku nyní posuď podle bodů níže.',
          'The check verified length and vocabulary. Now review meaning and grammar using the points below.',
        )}
      </p>
      {#if communication}
        <details>
          <summary>{copy('Jedna možná odpověď', 'One possible response')}</summary>
          <p lang="de">{communication.writing.model}</p>
          <p class="support">
            {copy(
              'Tvoje formulace může být jiná. Porovnej hlavně údaje, záměr a tón.',
              'Your wording may differ. Compare the details, purpose, and tone.',
            )}
          </p>
        </details>
      {/if}
      <fieldset
        disabled={saving}
        aria-describedby={error && check.ready ? 'course-writing-error' : undefined}
      >
        <legend>{copy('Moje kontrola textu', 'My text review')}</legend>
        {#each criteria as criterion, index}
          <label class="criterion"
            ><input
              type="checkbox"
              bind:checked={confirmations[index]}
              onchange={() => {
                error = '';
              }}
            /> <span>{criterion}</span></label
          >
        {/each}
      </fieldset>
      <p class="support">
        {copy(
          'Po úpravě textu projdi kontrolu znovu. Uloží se tvůj text i dokončení; nejde o automatické hodnocení jazykové úrovně.',
          'After editing, review the checklist again. Your text and completion will be saved; this is not an automatic proficiency assessment.',
        )}
      </p>
      <details>
        <summary>{copy('Minuta pro plynulost', 'A minute for fluency')}</summary>
        <p>
          {copy(
            'Odvrať pohled od textu a předej stejné sdělení nahlas vlastními slovy. Pak to zkus podruhé o něco plynuleji. Používej známé výrazy; rychlost se nehodnotí.',
            'Look away from the text and convey the same message aloud in your own words. Then try again a little more smoothly. Use familiar expressions; speed is not graded.',
          )}
        </p>
      </details>
    </div>
  {/if}
  {#if error}<p id="course-writing-error" class="writing-error" role="alert">{error}</p>{/if}
  <button
    class="btn-base btn-primary"
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

<style>
  .writing-collection {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--color-cobalt-700);
    font-size: 0.85rem;
    font-weight: 700;
  }
  .retry-save {
    min-height: 44px;
    padding: 0.6rem 1rem;
    border: 1px solid var(--color-line-strong);
    border-radius: 0.5rem;
    color: var(--color-cobalt-700);
    background: var(--color-paper-50);
    font: inherit;
    cursor: pointer;
  }
  .writing-workspace {
    padding: 1.3rem;
    border: 1px solid var(--color-line);
    border-radius: 0.75rem;
    background: var(--color-paper-50);
  }
  p {
    max-width: 65ch;
    margin-block: 0.65rem;
    line-height: 1.65;
    color: var(--color-ink-950);
  }
  .task {
    font-size: 1.12rem;
    font-weight: 750;
  }
  .support {
    font-size: 0.85rem;
    color: var(--color-ink-800);
  }
  details {
    margin-block: 1rem;
    padding-block: 0.4rem;
    border-block: 1px solid var(--color-line);
  }
  summary {
    min-height: 44px;
    align-content: center;
    cursor: pointer;
    font-weight: 750;
    color: var(--color-cobalt-700);
  }
  .word-bank {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1rem;
    padding: 0;
    list-style: none;
  }
  .word-bank li {
    font-weight: 650;
    font-size: 0.9rem;
  }
  label {
    display: block;
    margin-top: 1rem;
    font-size: 0.92rem;
    font-weight: 750;
  }
  textarea {
    display: block;
    width: 100%;
    min-width: 0;
    margin-top: 0.5rem;
    padding: 0.9rem;
    resize: vertical;
    border: 1px solid var(--color-ink-600);
    border-radius: 0.5rem;
    background: var(--color-paper-50);
    color: var(--color-ink-950);
    font-size: 1.05rem;
    line-height: 1.65;
  }
  textarea::placeholder {
    color: var(--color-ink-700);
  }
  textarea[aria-invalid='true'] {
    border-color: var(--color-coral-700);
  }
  h2 {
    margin-top: 1.5rem;
    font-size: 1.2rem;
  }
  fieldset {
    padding: 0;
    margin: 1rem 0;
    border: 0;
  }
  legend {
    font-size: 0.92rem;
    font-weight: 750;
  }
  .criterion {
    display: flex;
    align-items: start;
    gap: 0.7rem;
    min-height: 44px;
    padding-block: 0.5rem;
    margin: 0;
    font-weight: 500;
    line-height: 1.5;
    cursor: pointer;
  }
  .criterion input {
    flex: none;
    width: 1.15rem;
    height: 1.15rem;
    margin-top: 0.12rem;
    accent-color: var(--color-cobalt-700);
  }
  .writing-error {
    color: var(--color-coral-700);
  }
  button {
    width: 100%;
    margin-top: 1rem;
  }
  @media (max-width: 480px) {
    .writing-workspace {
      padding: 1rem;
    }
  }
</style>
