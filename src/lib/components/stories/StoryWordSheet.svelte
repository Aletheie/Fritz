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
  import { onDestroy } from 'svelte';
  import StorySheet from './StorySheet.svelte';

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

  let result = $state<AiStoryWordResult>();
  let loading = $state(false);
  let error = $state('');
  let savedMessage = $state('');
  let saving = $state(false);
  let requestKey = $state('');
  let controller = $state<AbortController>();

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  $effect(() => {
    const key = `${book.id}:${episodeId}:${word}:${sentence}`;
    if (!open || !word || key === requestKey) return;
    requestKey = key;
    result = undefined;
    error = '';
    savedMessage = '';
    void loadWord();
  });

  onDestroy(() => controller?.abort());

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

  function cancelRequest(): void {
    controller?.abort();
    controller = undefined;
    requestKey = '';
    loading = false;
  }

  const box = 'mt-3 rounded-[0.8rem] border border-line p-[0.8rem]';
  const boxLabel =
    'flex items-center gap-[0.35rem] font-mono text-[0.75rem] font-[850] tracking-[0.05em] text-ink-600 uppercase';
  const boxText = 'mt-[0.35rem] text-[0.875rem] leading-normal text-ink-800';
  const row =
    'grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 border-t border-dashed border-line pt-[0.45rem] [&>dd]:m-0 [&>dd]:text-[0.8125rem] [&>dd]:font-[760] [&>dt]:text-[0.75rem] [&>dt]:text-ink-600';
</script>

<StorySheet
  {open}
  variant="word"
  testId="word-sheet"
  kicker={copy('Slovo v kontextu', 'Word in context')}
  title={word}
  titleLang="de"
  closeLabel={copy('Zavřít rozbor slova', 'Close word analysis')}
  iconClass="bg-acid-500"
  onrequestclose={cancelRequest}
  {onclose}
>
  {#snippet icon()}<WandSparkles size={19} />{/snippet}

  <blockquote
    class="m-0 border border-cobalt-700 bg-sky-50 p-3 font-(family-name:--font-reader) text-[0.9rem] leading-[1.55]"
    lang="de"
  >
    {sentence}
  </blockquote>

  {#if entry}
    <section class="{box} bg-butter-50">
      <span class={boxLabel}
        >{storyGlossaryTier(entry.cefr, book.level) === 'advanced'
          ? copy(`Pokročilejší výraz · ${entry.cefr}`, `Advanced expression · ${entry.cefr}`)
          : copy(
              `Ověřený význam v textu · ${entry.cefr}`,
              `Verified meaning in context · ${entry.cefr}`,
            )}</span
      >
      <strong class="mt-[0.35rem] block text-[1.02rem]"
        >{storyGlossaryMeaning(entry, $motherTongue)}</strong
      >
      <p class={boxText}>{storyGlossaryNote(entry, $motherTongue)}</p>
    </section>
  {/if}

  {#if loading}
    <div class="flex min-h-16 items-center gap-2 text-[0.8125rem] text-ink-600" aria-live="polite">
      <LoaderCircle class="animate-spin" size={19} />
      {copy('AI dohledává tvar a vazbu…', 'AI is checking the form and usage…')}
    </div>
  {:else if result}
    <section class={[box, 'bg-paper-100', !result.available && 'border-dashed']}>
      <div class={boxLabel}>
        <Sparkles size={15} />
        {result.available ? copy('Rozbor', 'Analysis') : copy('Demo režim', 'Demo mode')}
      </div>
      <strong class="mt-[0.35rem] block text-[1.02rem]">{result.contextMeaning}</strong>
      <p class={boxText}>{result.grammarNote}</p>
      <dl class="mt-3 grid gap-[0.45rem]">
        <div class={row}>
          <dt>{copy('Tvar', 'Form')}</dt>
          <dd>{result.morphology}</dd>
        </div>
        <div class={row}>
          <dt>{copy('Vazba v kontextu', 'Usage in context')}</dt>
          <dd>{result.collocation}</dd>
        </div>
        {#if result.registerNote}<div class={row}>
            <dt>{copy('Styl a registr', 'Style and register')}</dt>
            <dd>{result.registerNote}</dd>
          </div>{/if}
        <div class={row}>
          <dt>{copy('Zkus si vybavit', 'Try to recall')}</dt>
          <dd>{result.recallQuestion}</dd>
        </div>
      </dl>
      {#if result.item}
        <dl class="mt-3 grid gap-[0.45rem]">
          <div class={row}>
            <dt>{copy('Základní tvar', 'Base form')}</dt>
            <dd lang="de">
              {result.item.article ? `${result.item.article} ` : ''}{result.item.german}
            </dd>
          </div>
          <div class={row}>
            <dt>{copy('Úroveň', 'Level')}</dt>
            <dd>{result.item.cefr}</dd>
          </div>
          {#if result.item.plural}<div class={row}>
              <dt>{copy('Plurál', 'Plural')}</dt>
              <dd lang="de">{result.item.plural}</dd>
            </div>{/if}
        </dl>
      {/if}
    </section>
  {/if}

  {#if error}<p class="mt-3 text-[0.8125rem] text-coral-700" role="alert">{error}</p>{/if}
  {#if savedMessage}<p
      class="mt-3 flex items-center gap-[0.4rem] text-[0.8125rem] font-[760] text-mint-700"
      aria-live="polite"
    >
      <CheckCircle2 size={17} />
      {savedMessage}
    </p>{/if}

  {#snippet footer()}
    <button
      class="sheet-press flex min-h-12 w-full items-center justify-center gap-[0.45rem] rounded-[0.78rem] bg-ink-950 text-[0.875rem] font-[850] text-white disabled:opacity-38"
      type="button"
      disabled={!result?.item || saving}
      onclick={saveWord}
    >
      {#if saving}<LoaderCircle class="animate-spin" size={18} />
        {copy('Ukládám…', 'Saving…')}{:else}<BookPlus size={18} />
        {copy('Uložit k opakování', 'Save for review')}{/if}
    </button>
  {/snippet}
</StorySheet>
