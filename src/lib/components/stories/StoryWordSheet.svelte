<script lang="ts">
  import { requestStoryWord } from '$lib/client/ai.ts';
  import { aiItemToDraft } from '$lib/domain/ai/types.ts';
  import { storyGlossaryTier } from '$lib/domain/stories/engine.ts';
  import { localized } from '$lib/i18n';
  import { storyGlossaryMeaning, storyGlossaryNote } from '$lib/i18n/stories.ts';
  import { sourceMeaning } from '$lib/i18n/vocabulary.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import BookPlus from '@lucide/svelte/icons/book-plus';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import WandSparkles from '@lucide/svelte/icons/wand-sparkles';
  import X from '@lucide/svelte/icons/x';
  import { onDestroy } from 'svelte';

  import type { AiStoryWordResult } from '$lib/domain/ai/types.ts';
  import type { StoryBook, StoryGlossaryEntry } from '$lib/domain/stories/types.ts';

  let {
    open,
    book,
    episodeId,
    word,
    sentence,
    entry,
    onclose,
  }: {
    open: boolean;
    book: StoryBook;
    episodeId: string;
    word: string;
    sentence: string;
    entry?: StoryGlossaryEntry;
    onclose: () => void;
  } = $props();

  const dialogExitMs = 140;

  let dialog = $state<HTMLDialogElement>();
  let closing = $state(false);
  let result = $state<AiStoryWordResult>();
  let loading = $state(false);
  let error = $state('');
  let savedMessage = $state('');
  let saving = $state(false);
  let requestKey = $state('');
  let controller = $state<AbortController>();
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  $effect(() => {
    if (!dialog) return;
    if (open) {
      cancelDialogClose();
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) startDialogClose();
  });

  $effect(() => {
    const key = `${book.id}:${episodeId}:${word}:${sentence}`;
    if (!open || !word || key === requestKey) return;
    requestKey = key;
    result = undefined;
    error = '';
    savedMessage = '';
    void loadWord();
  });

  onDestroy(() => {
    controller?.abort();
    if (closeTimer) clearTimeout(closeTimer);
  });

  async function loadWord(): Promise<void> {
    controller?.abort();
    const activeController = new AbortController();
    controller = activeController;
    loading = true;
    try {
      result = await requestStoryWord(
        {
          motherTongue: $motherTongue,
          word,
          sentence,
          bookTitle: book.title,
          level: book.level,
          known: entry
            ? {
                german: entry.german,
                czech: sourceMeaning(entry.german, entry.czech, $motherTongue),
                kind: entry.kind,
                article: entry.article,
                plural: entry.plural,
                cefr: entry.cefr,
                learningNote: $motherTongue === 'cs' ? entry.learningNote : undefined,
              }
            : undefined,
        },
        activeController.signal,
      );
    } catch (value) {
      if (value instanceof DOMException && value.name === 'AbortError') return;
      error =
        value instanceof Error && $motherTongue === 'cs'
          ? value.message
          : copy('Rozbor slova se nepodařil.', 'The word analysis failed.');
    } finally {
      if (controller === activeController) {
        controller = undefined;
        loading = false;
      }
    }
  }

  async function saveWord(): Promise<void> {
    if (!result?.item || saving) return;
    saving = true;
    error = '';
    try {
      const draft = aiItemToDraft(result.item, book.title);
      draft.tags = [...new Set([...draft.tags, copy('četba', 'reading'), book.title])];
      const imported = await appStore.importNotes([draft]);
      if (imported.added > 0) {
        await appStore.countStorySavedWord({ bookId: book.id, episodeId });
        savedMessage = copy('Uloženo do tvého běžného opakování.', 'Saved to your regular review.');
      } else {
        savedMessage = copy(
          'Tohle slovo už ve slovníku máš.',
          'This word is already in your vocabulary.',
        );
      }
    } catch (value) {
      error =
        value instanceof Error && $motherTongue === 'cs'
          ? value.message
          : copy('Slovo se nepodařilo uložit.', 'The word could not be saved.');
    } finally {
      saving = false;
    }
  }

  function cancelDialogClose(): void {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = undefined;
    closing = false;
  }

  function finishDialogClose(): void {
    closeTimer = undefined;
    if (dialog?.open) dialog.close();
    closing = false;
  }

  function startDialogClose(): void {
    if (!dialog?.open || closing) return;
    closing = true;
    closeTimer = setTimeout(finishDialogClose, dialogExitMs);
  }

  function handleCancel(event: Event): void {
    event.preventDefault();
    close();
  }

  function handleClose(): void {
    cancelDialogClose();
    onclose();
  }

  function close(): void {
    controller?.abort();
    controller = undefined;
    requestKey = '';
    loading = false;
    if (dialog?.open) startDialogClose();
    else onclose();
  }
</script>

<dialog
  bind:this={dialog}
  class="word-dialog"
  data-closing={closing ? '' : undefined}
  aria-labelledby="word-title"
  oncancel={handleCancel}
  onclose={handleClose}
>
  <div class="sheet-handle" aria-hidden="true"></div>
  <header>
    <span class="ai-mark"><WandSparkles size={19} /></span>
    <div>
      <p>{copy('Slovo v kontextu', 'Word in context')}</p>
      <h2 id="word-title" lang="de">{word}</h2>
    </div>
    <button
      class="close-button"
      type="button"
      aria-label={copy('Zavřít rozbor slova', 'Close word analysis')}
      onclick={close}><X size={20} /></button
    >
  </header>

  <div class="sheet-body">
    <blockquote lang="de">{sentence}</blockquote>

    {#if entry}
      <section class="instant-meaning">
        <span
          >{storyGlossaryTier(entry.cefr, book.level) === 'advanced'
            ? copy(`Pokročilejší výraz · ${entry.cefr}`, `Advanced expression · ${entry.cefr}`)
            : copy(
                `Ověřený význam v textu · ${entry.cefr}`,
                `Verified meaning in context · ${entry.cefr}`,
              )}</span
        >
        <strong>{storyGlossaryMeaning(entry, $motherTongue)}</strong>
        <p>{storyGlossaryNote(entry, $motherTongue)}</p>
      </section>
    {/if}

    {#if loading}
      <div class="loading-row" aria-live="polite">
        <LoaderCircle class="spin" size={19} />
        {copy('AI dohledává tvar a vazbu…', 'AI is checking the form and usage…')}
      </div>
    {:else if result}
      <section class:unavailable={!result.available} class="ai-result">
        <div class="result-label">
          <Sparkles size={15} />
          {result.available ? copy('Rozbor', 'Analysis') : copy('Demo režim', 'Demo mode')}
        </div>
        <strong>{result.contextMeaning}</strong>
        <p>{result.grammarNote}</p>
        <dl class="companion-details">
          <div>
            <dt>{copy('Tvar', 'Form')}</dt>
            <dd>{result.morphology}</dd>
          </div>
          <div>
            <dt>{copy('Vazba v kontextu', 'Usage in context')}</dt>
            <dd>{result.collocation}</dd>
          </div>
          {#if result.registerNote}<div>
              <dt>{copy('Styl a registr', 'Style and register')}</dt>
              <dd>{result.registerNote}</dd>
            </div>{/if}
          <div>
            <dt>{copy('Zkus si vybavit', 'Try to recall')}</dt>
            <dd>{result.recallQuestion}</dd>
          </div>
        </dl>
        {#if result.item}
          <dl>
            <div>
              <dt>{copy('Základní tvar', 'Base form')}</dt>
              <dd lang="de">
                {result.item.article ? `${result.item.article} ` : ''}{result.item.german}
              </dd>
            </div>
            <div>
              <dt>{copy('Úroveň', 'Level')}</dt>
              <dd>{result.item.cefr}</dd>
            </div>
            {#if result.item.plural}<div>
                <dt>{copy('Plurál', 'Plural')}</dt>
                <dd lang="de">{result.item.plural}</dd>
              </div>{/if}
          </dl>
        {/if}
      </section>
    {/if}

    {#if error}<p class="error-message" role="alert">{error}</p>{/if}
    {#if savedMessage}<p class="saved-message" aria-live="polite">
        <CheckCircle2 size={17} />
        {savedMessage}
      </p>{/if}
  </div>

  <footer>
    <button class="save-button" type="button" disabled={!result?.item || saving} onclick={saveWord}>
      {#if saving}<LoaderCircle class="spin" size={18} />
        {copy('Ukládám…', 'Saving…')}{:else}<BookPlus size={18} />
        {copy('Uložit k opakování', 'Save for review')}{/if}
    </button>
  </footer>
</dialog>

<style>
  .word-dialog {
    width: min(100%, 30rem);
    max-width: none;
    max-height: min(88dvh, 46rem);
    margin: auto 0 0;
    overflow: hidden;
    border: 1px solid var(--color-ink-950);
    border-radius: 1.25rem 1.25rem 0 0;
    background: var(--color-paper-50);
    padding: 0;
    color: var(--color-ink-950);
    box-shadow: 0 -12px 50px rgb(21 25 28 / 0.2);
  }
  .word-dialog:open {
    opacity: 1;
    transform: translateY(0);
    transition:
      opacity 180ms var(--ease-out-emil),
      transform 180ms var(--ease-out-emil);
  }
  .word-dialog[data-closing] {
    opacity: 0;
    transform: translateY(12px);
    transition-duration: 140ms;
    transition-timing-function: var(--ease-in-out-emil);
  }
  @starting-style {
    .word-dialog:open {
      opacity: 0;
      transform: translateY(12px);
    }
  }
  .word-dialog::backdrop {
    background: rgb(21 25 28 / 0.48);
    backdrop-filter: blur(3px);
  }
  .sheet-handle {
    width: 2.5rem;
    height: 0.25rem;
    margin: 0.55rem auto 0;
    border-radius: 99px;
    background: var(--color-line);
  }
  header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.7rem;
    border-bottom: 1px solid var(--color-line);
    padding: 0.7rem 0.85rem 0.85rem;
  }
  .ai-mark {
    display: grid;
    width: 2.65rem;
    height: 2.65rem;
    place-items: center;
    border-radius: 0.78rem;
    background: var(--color-acid-500);
  }
  header p {
    margin: 0;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 850;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  header h2 {
    margin: 0.16rem 0 0;
    font-size: 1.35rem;
    font-weight: 900;
    letter-spacing: -0.04em;
  }
  .close-button {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    transition: transform 120ms var(--ease-out-emil);
  }
  .close-button:active:not(:disabled),
  .save-button:active:not(:disabled) {
    transform: scale(0.98);
  }
  .sheet-body {
    max-height: calc(88dvh - 10.5rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.9rem;
  }
  blockquote {
    margin: 0;
    border: 1px solid var(--color-cobalt-700);
    background: var(--color-sky-50);
    padding: 0.75rem;
    font-family: var(--font-reader);
    font-size: 0.9rem;
    line-height: 1.55;
  }
  .instant-meaning,
  .ai-result {
    margin-top: 0.75rem;
    border: 1px solid var(--color-line);
    border-radius: 0.8rem;
    padding: 0.8rem;
  }
  .instant-meaning {
    background: var(--color-butter-50);
  }
  .instant-meaning > span,
  .result-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 850;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .instant-meaning strong,
  .ai-result > strong {
    display: block;
    margin-top: 0.35rem;
    font-size: 1.02rem;
  }
  .instant-meaning p,
  .ai-result p {
    margin: 0.35rem 0 0;
    color: var(--color-ink-800);
    font-size: 0.875rem;
    line-height: 1.5;
  }
  .ai-result {
    background: var(--color-paper-100);
  }
  .ai-result.unavailable {
    border-style: dashed;
  }
  .ai-result dl {
    display: grid;
    gap: 0.45rem;
    margin: 0.75rem 0 0;
  }
  .ai-result dl div {
    display: grid;
    grid-template-columns: 6.5rem minmax(0, 1fr);
    gap: 0.5rem;
    border-top: 1px dashed var(--color-line);
    padding-top: 0.45rem;
  }
  .ai-result dt {
    color: var(--color-ink-600);
    font-size: 0.75rem;
  }
  .ai-result dd {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 760;
  }
  .loading-row {
    display: flex;
    min-height: 4rem;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-ink-600);
    font-size: 0.8125rem;
  }
  .error-message {
    margin: 0.75rem 0 0;
    color: var(--color-coral-700);
    font-size: 0.8125rem;
  }
  .saved-message {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0.75rem 0 0;
    color: var(--color-mint-700);
    font-size: 0.8125rem;
    font-weight: 760;
  }
  footer {
    border-top: 1px solid var(--color-line);
    background: var(--color-paper-50);
    padding: 0.75rem 0.85rem calc(0.75rem + var(--safe-bottom));
  }
  .save-button {
    display: flex;
    width: 100%;
    min-height: 3rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    border-radius: 0.78rem;
    color: white;
    background: var(--color-ink-950);
    font-size: 0.875rem;
    font-weight: 850;
    transition: transform 120ms var(--ease-out-emil);
  }
  .save-button:disabled {
    opacity: 0.38;
  }
  :global(.spin) {
    animation: spin 850ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (min-width: 700px) {
    .word-dialog {
      margin: auto 0 auto auto;
      max-height: calc(100dvh - 2rem);
      border-radius: 1.1rem 0 0 1.1rem;
    }
    .word-dialog:open {
      transform: translateX(0);
    }
    .word-dialog[data-closing] {
      transform: translateX(12px);
    }
    @starting-style {
      .word-dialog:open {
        transform: translateX(12px);
      }
    }
    .sheet-handle {
      display: none;
    }
    header {
      padding-top: 0.9rem;
    }
    .sheet-body {
      max-height: calc(100dvh - 11rem);
    }
  }
  :global(html[data-motion='reduced']) .word-dialog:open {
    transform: none;
    transition-property: opacity;
    transition-duration: 140ms !important;
  }
  :global(html[data-motion='reduced']) .word-dialog[data-closing] {
    transform: none;
  }
  :global(html[data-motion='reduced']) .close-button,
  :global(html[data-motion='reduced']) .save-button {
    transform: none;
    transition-property: opacity;
    transition-duration: 100ms !important;
  }
  :global(html[data-motion='reduced']) .close-button:active:not(:disabled),
  :global(html[data-motion='reduced']) .save-button:active:not(:disabled) {
    opacity: 0.82;
    transform: none;
  }
  @starting-style {
    :global(html[data-motion='reduced']) .word-dialog:open {
      opacity: 0;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .word-dialog:open {
      transform: none;
      transition-property: opacity;
      transition-duration: 140ms !important;
    }
    .word-dialog[data-closing] {
      transform: none;
    }
    .close-button,
    .save-button {
      transform: none;
      transition-property: opacity;
      transition-duration: 100ms !important;
    }
    .close-button:active:not(:disabled),
    .save-button:active:not(:disabled) {
      opacity: 0.82;
      transform: none;
    }
    @starting-style {
      .word-dialog:open {
        opacity: 0;
        transform: none;
      }
    }
    :global(.spin) {
      animation: none;
    }
  }
</style>
