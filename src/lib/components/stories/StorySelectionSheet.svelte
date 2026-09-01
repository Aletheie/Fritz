<script lang="ts">
  import { requestStorySelection } from '$lib/client/ai.ts';
  import { normalizeGermanKey } from '$lib/domain/grading/normalize.ts';
  import { normalizeDraft } from '$lib/domain/vocabulary/draft.ts';
  import { vocabularyDraftIssues } from '$lib/domain/vocabulary/validation.ts';
  import { localized } from '$lib/i18n';
  import { appStore, motherTongue } from '$lib/state/app';
  import BookPlus from '@lucide/svelte/icons/book-plus';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import Languages from '@lucide/svelte/icons/languages';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import X from '@lucide/svelte/icons/x';
  import { onDestroy } from 'svelte';

  import type { AiStorySelectionResult } from '$lib/domain/ai/types.ts';
  import type { StoryBook } from '$lib/domain/stories/types.ts';

  let {
    open,
    book,
    episodeId,
    text,
    context,
    initialAction,
    onclose,
  }: {
    open: boolean;
    book: StoryBook;
    episodeId: string;
    text: string;
    context: string;
    initialAction: 'translate' | 'explain';
    onclose: () => void;
  } = $props();

  const dialogExitMs = 140;

  let dialog = $state<HTMLDialogElement>();
  let closing = $state(false);
  let result = $state<AiStorySelectionResult>();
  let action = $state<'translate' | 'explain'>('translate');
  let loading = $state(false);
  let saving = $state(false);
  let error = $state('');
  let savedMessage = $state('');
  let selectionKey = $state('');
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
    const key = `${book.id}:${episodeId}:${text}:${initialAction}`;
    if (!open || key === selectionKey) return;
    selectionKey = key;
    result = undefined;
    error = '';
    savedMessage = '';
    action = initialAction;
    void run(initialAction);
  });

  onDestroy(() => {
    controller?.abort();
    if (closeTimer) clearTimeout(closeTimer);
  });

  async function run(nextAction: 'translate' | 'explain'): Promise<void> {
    if (!text.trim() || loading) return;
    controller?.abort();
    controller = new AbortController();
    action = nextAction;
    loading = true;
    error = '';
    savedMessage = '';
    try {
      const output = await requestStorySelection(
        {
          motherTongue: $motherTongue,
          action: nextAction,
          text,
          context,
          bookTitle: book.title,
          level: book.level,
        },
        controller.signal,
      );
      result = output;
      const issue = output.available ? phraseDraftIssue(output) : '';
      if (issue) {
        error = copy(
          `Návrh fráze nelze uložit: ${issue}`,
          'The suggested phrase is incomplete and cannot be saved.',
        );
      }
    } catch (value) {
      if (value instanceof DOMException && value.name === 'AbortError') return;
      error =
        value instanceof Error && $motherTongue === 'cs'
          ? value.message
          : copy(
              'Vybraný úsek se nepodařilo zpracovat.',
              'The selected passage could not be processed.',
            );
    } finally {
      loading = false;
    }
  }

  function phraseDraft(output: AiStorySelectionResult) {
    return normalizeDraft({
      german: output.suggestedGerman,
      normalizedGerman: normalizeGermanKey(output.suggestedGerman),
      czech: output.suggestedCzech,
      kind: 'phrase',
      acceptedGerman: [],
      acceptedCzech: [],
      tags: [copy('četba', 'reading'), book.title],
      exampleDe: output.suggestedGerman,
      exampleCs: output.suggestedCzech,
      cefr: book.level,
      learningNote: output.explanationCs,
      source: 'ai',
      sourceLine: 1,
    });
  }

  function phraseDraftIssue(output: AiStorySelectionResult): string {
    return vocabularyDraftIssues(phraseDraft(output))[0] ?? '';
  }

  async function savePhrase(): Promise<void> {
    if (!result?.available || !result.suggestedCzech || saving) return;
    const draft = phraseDraft(result);
    const issue = vocabularyDraftIssues(draft)[0];
    if (issue) {
      error = copy(
        `Návrh fráze nelze uložit: ${issue}`,
        'The suggested phrase is incomplete and cannot be saved.',
      );
      return;
    }
    saving = true;
    error = '';
    try {
      const imported = await appStore.importNotes([draft]);
      if (imported.added > 0) {
        await appStore.countStorySavedWord({ bookId: book.id, episodeId });
        savedMessage = copy(
          'Fráze je ve tvém běžném opakování.',
          'The phrase is now in your regular review.',
        );
      } else {
        savedMessage = copy(
          'Tuhle frázi už ve slovníku máš.',
          'This phrase is already in your vocabulary.',
        );
      }
    } catch (value) {
      error =
        value instanceof Error && $motherTongue === 'cs'
          ? value.message
          : copy('Frázi se nepodařilo uložit.', 'The phrase could not be saved.');
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
    loading = false;
    if (dialog?.open) startDialogClose();
    else onclose();
  }
</script>

<dialog
  bind:this={dialog}
  class="selection-dialog"
  data-closing={closing ? '' : undefined}
  aria-labelledby="selection-title"
  oncancel={handleCancel}
  onclose={handleClose}
>
  <div class="sheet-handle" aria-hidden="true"></div>
  <header>
    <span class="selection-mark"><Languages size={19} /></span>
    <div>
      <p>{copy('Vybraný úsek', 'Selected passage')}</p>
      <h2 id="selection-title">{copy('Překlad a vysvětlení', 'Translation and explanation')}</h2>
    </div>
    <button
      class="close-button"
      type="button"
      aria-label={copy('Zavřít nástroje k větě', 'Close sentence tools')}
      onclick={close}><X size={20} /></button
    >
  </header>

  <div class="sheet-body">
    <blockquote lang="de">{text}</blockquote>

    <div class="action-switch" aria-label={copy('Co má AI udělat', 'Choose what AI should do')}>
      <button
        class:active={action === 'translate'}
        type="button"
        disabled={loading}
        onclick={() => run('translate')}
        ><Languages size={17} /> {copy('Přeložit', 'Translate')}</button
      >
      <button
        class:active={action === 'explain'}
        type="button"
        disabled={loading}
        onclick={() => run('explain')}
        ><Lightbulb size={17} /> {copy('Vysvětlit', 'Explain')}</button
      >
    </div>

    {#if loading}
      <div class="loading-row" aria-live="polite">
        <LoaderCircle class="spin" size={19} />
        {copy('AI čte větu v okolním kontextu…', 'AI is reading the sentence in context…')}
      </div>
    {:else if result}
      <section class:unavailable={!result.available} class="result-card">
        <div class="result-label">
          <Sparkles size={15} />
          {result.available
            ? copy('Výsledek v kontextu', 'Result in context')
            : copy('Demo režim', 'Demo mode')}
        </div>
        <h3>
          {action === 'translate'
            ? copy('Překlad', 'Translation')
            : copy('Co se ve větě děje', 'How the sentence works')}
        </h3>
        <p class="translation">{result.translationCs}</p>
        <p class="explanation">{result.explanationCs}</p>
        {#if result.grammarHighlights.length}
          <ul>
            {#each result.grammarHighlights as item}<li>{item}</li>{/each}
          </ul>
        {/if}
      </section>
    {:else}
      <p class="empty-hint">
        {copy(
          'Zvol překlad nebo vysvětlení. Okolní text pošleme jen jako kontext, ne jako další zadání.',
          'Choose translation or explanation. The surrounding text is sent only as context, not as an additional task.',
        )}
      </p>
    {/if}

    {#if error}<p class="error-message" role="alert">{error}</p>{/if}
    {#if savedMessage}<p class="saved-message" aria-live="polite">
        <CheckCircle2 size={17} />
        {savedMessage}
      </p>{/if}
  </div>

  <footer>
    <button
      class="save-button"
      type="button"
      disabled={!result?.available ||
        !result.suggestedCzech ||
        Boolean(phraseDraftIssue(result)) ||
        saving}
      onclick={savePhrase}
    >
      {#if saving}<LoaderCircle class="spin" size={18} />
        {copy('Ukládám…', 'Saving…')}{:else}<BookPlus size={18} />
        {copy('Uložit frázi', 'Save phrase')}{/if}
    </button>
  </footer>
</dialog>

<style>
  .selection-dialog {
    width: min(100%, 32rem);
    max-width: none;
    max-height: min(90dvh, 48rem);
    margin: auto 0 0;
    overflow: hidden;
    border: 1px solid var(--color-ink-950);
    border-radius: 1.25rem 1.25rem 0 0;
    background: var(--color-paper-50);
    padding: 0;
    color: var(--color-ink-950);
    box-shadow: 0 -12px 50px rgb(21 25 28 / 0.2);
  }
  .selection-dialog:open {
    opacity: 1;
    transform: translateY(0);
    transition:
      opacity 180ms var(--ease-out-emil),
      transform 180ms var(--ease-out-emil);
  }
  .selection-dialog[data-closing] {
    opacity: 0;
    transform: translateY(12px);
    transition-duration: 140ms;
    transition-timing-function: var(--ease-in-out-emil);
  }
  @starting-style {
    .selection-dialog:open {
      opacity: 0;
      transform: translateY(12px);
    }
  }
  .selection-dialog::backdrop {
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
  .selection-mark {
    display: grid;
    width: 2.65rem;
    height: 2.65rem;
    place-items: center;
    border-radius: 0.78rem;
    background: var(--color-sky-200);
  }
  header p {
    margin: 0;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.57rem;
    font-weight: 850;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  header h2 {
    margin: 0.16rem 0 0;
    font-size: 1rem;
    font-weight: 880;
    letter-spacing: -0.025em;
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
  .action-switch button:active:not(:disabled),
  .save-button:active:not(:disabled) {
    transform: scale(0.98);
  }
  .sheet-body {
    max-height: calc(90dvh - 10.5rem);
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
    font-size: 0.91rem;
    line-height: 1.55;
  }
  .action-switch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.4rem;
    margin-top: 0.75rem;
    border-radius: 0.85rem;
    background: var(--color-paper-100);
    padding: 0.3rem;
  }
  .action-switch button {
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border-radius: 0.65rem;
    color: var(--color-ink-600);
    font-size: 0.72rem;
    font-weight: 800;
    transition: transform 120ms var(--ease-out-emil);
  }
  .action-switch button.active {
    color: var(--color-ink-950);
    background: var(--color-paper-50);
    box-shadow: 0 1px 4px rgb(21 25 28 / 0.11);
  }
  .loading-row {
    display: flex;
    min-height: 5rem;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-ink-600);
    font-size: 0.72rem;
  }
  .result-card {
    margin-top: 0.75rem;
    border: 1px solid var(--color-line);
    border-radius: 0.85rem;
    background: var(--color-paper-100);
    padding: 0.85rem;
  }
  .result-card.unavailable {
    border-style: dashed;
  }
  .result-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.57rem;
    font-weight: 850;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .result-card h3 {
    margin: 0.6rem 0 0;
    font-size: 0.78rem;
  }
  .translation {
    margin: 0.3rem 0 0;
    font-size: 0.9rem;
    font-weight: 680;
    line-height: 1.5;
  }
  .explanation {
    margin: 0.7rem 0 0;
    color: var(--color-ink-800);
    font-size: 0.72rem;
    line-height: 1.5;
  }
  .result-card ul {
    margin: 0.7rem 0 0;
    padding-left: 1rem;
    color: var(--color-ink-800);
    font-size: 0.69rem;
    line-height: 1.5;
  }
  .empty-hint {
    margin: 0.8rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.7rem;
    line-height: 1.45;
  }
  .error-message {
    margin: 0.75rem 0 0;
    color: var(--color-coral-700);
    font-size: 0.7rem;
  }
  .saved-message {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0.75rem 0 0;
    color: var(--color-mint-700);
    font-size: 0.72rem;
    font-weight: 760;
  }
  footer {
    border-top: 1px solid var(--color-line);
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
    font-size: 0.78rem;
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
    .selection-dialog {
      margin: auto 0 auto auto;
      max-height: calc(100dvh - 2rem);
      border-radius: 1.1rem 0 0 1.1rem;
    }
    .selection-dialog:open {
      transform: translateX(0);
    }
    .selection-dialog[data-closing] {
      transform: translateX(12px);
    }
    @starting-style {
      .selection-dialog:open {
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
  :global(html[data-motion='reduced']) .selection-dialog:open {
    transform: none;
    transition-property: opacity;
    transition-duration: 140ms !important;
  }
  :global(html[data-motion='reduced']) .selection-dialog[data-closing] {
    transform: none;
  }
  :global(html[data-motion='reduced']) .close-button,
  :global(html[data-motion='reduced']) .action-switch button,
  :global(html[data-motion='reduced']) .save-button {
    transform: none;
    transition-property: opacity;
    transition-duration: 100ms !important;
  }
  :global(html[data-motion='reduced']) .close-button:active:not(:disabled),
  :global(html[data-motion='reduced']) .action-switch button:active:not(:disabled),
  :global(html[data-motion='reduced']) .save-button:active:not(:disabled) {
    opacity: 0.82;
    transform: none;
  }
  @starting-style {
    :global(html[data-motion='reduced']) .selection-dialog:open {
      opacity: 0;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .selection-dialog:open {
      transform: none;
      transition-property: opacity;
      transition-duration: 140ms !important;
    }
    .selection-dialog[data-closing] {
      transform: none;
    }
    .close-button,
    .action-switch button,
    .save-button {
      transform: none;
      transition-property: opacity;
      transition-duration: 100ms !important;
    }
    .close-button:active:not(:disabled),
    .action-switch button:active:not(:disabled),
    .save-button:active:not(:disabled) {
      opacity: 0.82;
      transform: none;
    }
    @starting-style {
      .selection-dialog:open {
        opacity: 0;
        transform: none;
      }
    }
    :global(.spin) {
      animation: none;
    }
  }
</style>
