<script lang="ts">
  import type { CaseDocument } from '$lib/domain/cases/types.ts';
  import type { MotherTongue } from '$lib/domain/types.ts';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Highlighter from '@lucide/svelte/icons/highlighter';
  import { untrack } from 'svelte';

  let {
    documents,
    initialDocumentId,
    newDocumentIds = [],
    remainingCount = 0,
    language,
    selected,
    disabled,
    marking,
    requiredCount,
    onselect,
  }: {
    documents: CaseDocument[];
    initialDocumentId?: string;
    newDocumentIds?: string[];
    remainingCount?: number;
    language: MotherTongue;
    selected: string[];
    disabled: boolean;
    marking: boolean;
    requiredCount: number;
    onselect: (id: string) => Promise<void>;
  } = $props();
  let activeId = $state(untrack(() => initialDocumentId ?? documents[0].id));
  const document = $derived(documents.find((item) => item.id === activeId) ?? documents[0]);
  const sender = $derived(document.bylineDe.split(' · ')[0]);
  const date = $derived(document.bylineDe.split(' · ').slice(1).join(' · '));
  const cs = $derived(language === 'cs');

  const highlight =
    'bg-accent-100 text-inherit underline decoration-ink-700 decoration-1 underline-offset-4';
</script>

<section class="min-w-0" aria-labelledby="documents-title">
  <div class="mb-[0.65rem] flex items-baseline justify-between gap-4">
    <h2 class="m-0 scroll-mt-4 text-[0.85rem] font-[650]" id="documents-title" tabindex="-1">
      {cs ? 'Zprávy a podklady' : 'Messages and documents'}
    </h2>
    <span class="text-[0.75rem] text-ink-600"
      >{cs ? `Podklady: ${documents.length}` : `Documents: ${documents.length}`}</span
    >
  </div>
  <div
    class="mb-[1.1rem] flex flex-wrap gap-[0.15rem] border-b border-line"
    data-testid="document-switcher"
    role="group"
    aria-label={cs ? 'Otevřít podklad' : 'Open a document'}
  >
    {#each documents as item}
      {@const markedCount = item.lines.filter((line) => selected.includes(line.id)).length}
      <button
        class={[
          'flex min-h-12 items-center gap-[0.35rem] border-b-2 px-[0.85rem] py-[0.6rem] text-left text-[0.84rem] font-semibold max-[800px]:flex-[0_1_auto] max-[800px]:px-[0.4rem] max-[800px]:text-[0.77rem] fine-hover:bg-paper-50 fine-hover:text-ink-950',
          item.id === document.id
            ? 'border-ink-950 text-ink-950'
            : 'border-transparent text-ink-600',
        ]}
        type="button"
        aria-pressed={item.id === document.id}
        aria-controls="case-document"
        onclick={() => (activeId = item.id)}
      >
        {item.title[language]}
        {#if newDocumentIds.includes(item.id)}<span
            class="text-[0.66rem] font-[650] text-cobalt-700"
            data-testid="new-document">{cs ? 'Nové' : 'New'}</span
          >{/if}
        <span
          class={[
            'grid h-[18px] min-w-[18px] place-items-center rounded-[4px] bg-accent-100 text-[0.7rem] text-ink-950',
            markedCount === 0 && 'invisible',
          ]}
          aria-hidden={markedCount === 0}
          aria-label={cs ? 'Počet zvýrazněných pasáží' : 'Highlighted passages'}>{markedCount}</span
        >
      </button>
    {/each}
  </div>
  {#if marking}
    <div
      class="mb-[0.8rem] flex items-start gap-[0.65rem] rounded-lg bg-accent-100 px-4 py-[0.85rem]"
      id="marking-guide"
    >
      <Highlighter class="mt-[0.15rem] flex-none" size={17} aria-hidden="true" />
      <p class="m-0 text-[0.85rem] leading-[1.55]">
        {cs
          ? `Klikni na ${requiredCount === 1 ? 'pasáž, která potvrzuje' : 'dvě pasáže, které potvrzují'} tvoji odpověď. Dalším kliknutím zvýraznění zrušíš.`
          : `Click ${requiredCount === 1 ? 'the passage that supports' : 'two passages that support'} your answer. Click again to remove a highlight.`}
      </p>
    </div>
  {/if}
  <article
    id="case-document"
    class="overflow-hidden rounded-xl border border-line bg-paper-50"
    aria-labelledby="document-name"
  >
    <header
      class="mx-7 flex items-center gap-3 border-b border-line py-[1.3rem] max-[800px]:mx-[1.2rem] max-[800px]:py-[1.1rem]"
    >
      {#if document.kind === 'message'}<span
          class="grid size-9 flex-none place-items-center rounded-full bg-cobalt-100 text-[0.9rem] font-bold text-cobalt-700"
          aria-hidden="true">{sender.slice(0, 1)}</span
        >{/if}
      <div>
        <h3 class="m-0 text-[0.95rem] font-bold" id="document-name" lang="de">{sender}</h3>
        <p class="mt-1 text-[0.76rem] text-ink-600" lang="de">{date}</p>
      </div>
      <span class="ml-auto text-[0.72rem] text-ink-600 max-[800px]:hidden"
        >{document.kind === 'message'
          ? cs
            ? 'Zpráva'
            : 'Message'
          : document.kind === 'poster'
            ? cs
              ? 'Plakát'
              : 'Poster'
            : cs
              ? 'Oznámení'
              : 'Notice'}</span
      >
    </header>
    <div
      data-testid="document-body"
      class={[
        'px-7 py-[1.7rem] text-[1.13rem] leading-[1.85] [overflow-wrap:anywhere] max-[800px]:px-[1.2rem] max-[800px]:py-[1.3rem] max-[800px]:text-[1.02rem] max-[800px]:leading-[1.8] [&>p]:mt-0 [&>p]:mb-[1.1rem] [&>p:last-child]:mb-0',
        document.kind === 'poster' &&
          '[&>p:first-child]:mb-[1.4rem] [&>p:first-child]:text-[1.55rem] [&>p:first-child]:leading-[1.35] [&>p:first-child]:font-[720] [&>p:first-child]:tracking-[-0.025em] [&>p:nth-child(2)]:font-[650]',
      ]}
      lang="de"
    >
      {#each document.lines as line (line.id)}
        <p>
          {#if marking}
            <button
              data-testid="passage"
              class={[
                '-mx-1 -my-[0.12rem] block min-h-11 w-full cursor-pointer rounded-[3px] border-0 px-1 py-[0.12rem] text-left text-inherit disabled:cursor-default',
                selected.includes(line.id)
                  ? highlight
                  : 'bg-transparent fine-hover:not-disabled:bg-accent-100',
              ]}
              aria-pressed={selected.includes(line.id)}
              aria-describedby="marking-guide"
              {disabled}
              onclick={() => void onselect(line.id)}>{line.textDe}</button
            >
          {:else if selected.includes(line.id)}
            <mark class="{highlight} box-decoration-clone">{line.textDe}</mark>
          {:else}
            {line.textDe}
          {/if}
        </p>
      {/each}
    </div>
    {#key document.id}
      <details class="group border-t border-line px-7 max-[800px]:px-[1.2rem]">
        <summary
          class="flex min-h-12 cursor-pointer items-center gap-2 text-[0.82rem] font-semibold text-ink-700 after:ml-auto after:text-[1rem] after:content-['+'] group-open:after:content-['−']"
          ><BookOpen size={16} aria-hidden="true" />{cs
            ? 'Pomoc se slovíčky'
            : 'Vocabulary help'}</summary
        >
        <dl class="mt-[0.2rem] mb-[1.2rem] grid gap-[0.8rem] text-[0.88rem]">
          {#each document.glossary as word}
            <div>
              <dt class="font-[650]" lang="de">{word.de}</dt>
              <dd class="mt-[0.15rem] leading-normal text-ink-600">{word.meaning[language]}</dd>
            </div>
          {/each}
        </dl>
      </details>
    {/key}
  </article>
  {#if remainingCount > 0}
    <p class="mt-[0.9rem] text-[0.78rem] leading-[1.55] text-ink-600">
      {cs
        ? 'Další podklady získáš, až ověříš současný závěr.'
        : 'More documents will arrive once you confirm your current finding.'}
    </p>
  {/if}
</section>
