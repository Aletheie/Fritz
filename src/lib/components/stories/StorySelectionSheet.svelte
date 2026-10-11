<script lang="ts">
  import { requestStorySelection } from '$lib/client/ai.ts';
  import { errorText } from '$lib/domain/errors.ts';
  import { normalizeGermanKey } from '$lib/domain/grading/normalize.ts';
  import { normalizeDraft } from '$lib/domain/vocabulary/draft.ts';
  import { vocabularyDraftIssues } from '$lib/domain/vocabulary/validation.ts';
  import { appStore, motherTongue, tr } from '$lib/state/app';
  import BookPlus from '@lucide/svelte/icons/book-plus';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import Languages from '@lucide/svelte/icons/languages';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import { onDestroy } from 'svelte';
  import StorySheet from './StorySheet.svelte';

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

  let result = $state<AiStorySelectionResult>();
  let action = $state<'translate' | 'explain'>('translate');
  let loading = $state(false);
  let saving = $state(false);
  let error = $state('');
  let savedMessage = $state('');
  let selectionKey = $state('');
  let controller = $state<AbortController>();

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

  onDestroy(() => controller?.abort());

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
        error = $tr(
          `Návrh fráze nelze uložit: ${issue}`,
          'The suggested phrase is incomplete and cannot be saved.',
        );
      }
    } catch (value) {
      if (value instanceof DOMException && value.name === 'AbortError') return;
      error = errorText(value, $motherTongue, {
        cs: 'Vybraný úsek se nepodařilo zpracovat.',
        en: 'The selected passage could not be processed.',
      });
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
      tags: [$tr('četba', 'reading'), book.title],
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
      error = $tr(
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
        savedMessage = $tr(
          'Fráze je ve tvém běžném opakování.',
          'The phrase is now in your regular review.',
        );
      } else {
        savedMessage = $tr(
          'Tuhle frázi už ve slovníku máš.',
          'This phrase is already in your vocabulary.',
        );
      }
    } catch (value) {
      error = errorText(value, $motherTongue, {
        cs: 'Frázi se nepodařilo uložit.',
        en: 'The phrase could not be saved.',
      });
    } finally {
      saving = false;
    }
  }

  function cancelRequest(): void {
    controller?.abort();
    controller = undefined;
    loading = false;
  }

  const switchButton = (active: boolean) => [
    'sheet-press flex min-h-11 items-center justify-center gap-[0.35rem] rounded-[0.65rem] text-[0.72rem] font-extrabold',
    active ? 'bg-paper-50 text-ink-950 shadow-[0_1px_4px_rgb(21_25_28/0.11)]' : 'text-ink-600',
  ];
</script>

<StorySheet
  {open}
  variant="selection"
  testId="selection-sheet"
  kicker={$tr('Vybraný úsek', 'Selected passage')}
  title={$tr('Překlad a vysvětlení', 'Translation and explanation')}
  closeLabel={$tr('Zavřít nástroje k větě', 'Close sentence tools')}
  iconClass="bg-sky-200"
  onrequestclose={cancelRequest}
  {onclose}
>
  {#snippet icon()}<Languages size={19} />{/snippet}

  <blockquote
    class="m-0 border border-cobalt-700 bg-sky-50 p-3 font-(family-name:--font-reader) text-[0.91rem] leading-[1.55]"
    lang="de"
  >
    {text}
  </blockquote>

  <div
    class="mt-3 grid grid-cols-2 gap-[0.4rem] rounded-[0.85rem] bg-paper-100 p-[0.3rem]"
    aria-label={$tr('Co má AI udělat', 'Choose what AI should do')}
  >
    <button
      class={switchButton(action === 'translate')}
      type="button"
      disabled={loading}
      onclick={() => run('translate')}
      ><Languages size={17} /> {$tr('Přeložit', 'Translate')}</button
    >
    <button
      class={switchButton(action === 'explain')}
      type="button"
      disabled={loading}
      onclick={() => run('explain')}><Lightbulb size={17} /> {$tr('Vysvětlit', 'Explain')}</button
    >
  </div>

  {#if loading}
    <div class="flex min-h-20 items-center gap-2 text-[0.72rem] text-ink-600" aria-live="polite">
      <LoaderCircle class="animate-spin" size={19} />
      {$tr('AI čte větu v okolním kontextu…', 'AI is reading the sentence in context…')}
    </div>
  {:else if result}
    <section
      class={[
        'mt-3 rounded-[0.85rem] border border-line bg-paper-100 p-[0.85rem]',
        !result.available && 'border-dashed',
      ]}
    >
      <div
        class="flex items-center gap-[0.35rem] font-mono text-[0.57rem] font-[850] tracking-[0.05em] text-ink-600 uppercase"
      >
        <Sparkles size={15} />
        {result.available
          ? $tr('Výsledek v kontextu', 'Result in context')
          : $tr('Demo režim', 'Demo mode')}
      </div>
      <h3 class="mt-[0.6rem] text-[0.78rem]">
        {action === 'translate'
          ? $tr('Překlad', 'Translation')
          : $tr('Co se ve větě děje', 'How the sentence works')}
      </h3>
      <p class="mt-[0.3rem] text-[0.9rem] leading-normal font-[680]">{result.translationCs}</p>
      <p class="mt-[0.7rem] text-[0.72rem] leading-normal text-ink-800">{result.explanationCs}</p>
      {#if result.grammarHighlights.length}
        <ul class="mt-[0.7rem] pl-4 text-[0.69rem] leading-normal text-ink-800">
          {#each result.grammarHighlights as item}<li>{item}</li>{/each}
        </ul>
      {/if}
    </section>
  {:else}
    <p class="mt-[0.8rem] text-[0.7rem] leading-[1.45] text-ink-600">
      {$tr(
        'Vyber překlad nebo vysvětlení. AI dostane i okolní text, aby rozuměla souvislostem.',
        'Choose translation or explanation. AI also receives the surrounding text to understand the context.',
      )}
    </p>
  {/if}

  {#if error}<p class="mt-3 text-[0.7rem] text-coral-700" role="alert">{error}</p>{/if}
  {#if savedMessage}<p
      class="mt-3 flex items-center gap-[0.4rem] text-[0.72rem] font-[760] text-mint-700"
      aria-live="polite"
    >
      <CheckCircle2 size={17} />
      {savedMessage}
    </p>{/if}

  {#snippet footer()}
    <button
      class="sheet-press flex min-h-12 w-full items-center justify-center gap-[0.45rem] rounded-[0.78rem] bg-ink-950 text-[0.78rem] font-[850] text-white disabled:opacity-38"
      type="button"
      disabled={!result?.available ||
        !result.suggestedCzech ||
        Boolean(phraseDraftIssue(result)) ||
        saving}
      onclick={savePhrase}
    >
      {#if saving}<LoaderCircle class="animate-spin" size={18} />
        {$tr('Ukládám…', 'Saving…')}{:else}<BookPlus size={18} />
        {$tr('Uložit frázi', 'Save phrase')}{/if}
    </button>
  {/snippet}
</StorySheet>
