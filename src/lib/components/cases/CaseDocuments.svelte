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
</script>

<section class="documents" aria-labelledby="documents-title">
  <div class="reading-heading">
    <h2 id="documents-title" tabindex="-1">
      {cs ? 'Zprávy a podklady' : 'Messages and documents'}
    </h2>
    <span>{cs ? `Podklady: ${documents.length}` : `Documents: ${documents.length}`}</span>
  </div>
  <div
    class="document-switcher"
    role="group"
    aria-label={cs ? 'Otevřít podklad' : 'Open a document'}
  >
    {#each documents as item}
      {@const markedCount = item.lines.filter((line) => selected.includes(line.id)).length}
      <button
        type="button"
        aria-pressed={item.id === document.id}
        aria-controls="case-document"
        onclick={() => (activeId = item.id)}
      >
        {item.title[language]}
        {#if newDocumentIds.includes(item.id)}<span class="new-document">{cs ? 'Nové' : 'New'}</span
          >{/if}
        <span
          class="marked-count"
          class:empty={markedCount === 0}
          aria-hidden={markedCount === 0}
          aria-label={cs ? 'Počet zvýrazněných pasáží' : 'Highlighted passages'}>{markedCount}</span
        >
      </button>
    {/each}
  </div>
  {#if marking}
    <div class="marking-guide" id="marking-guide">
      <Highlighter size={17} aria-hidden="true" />
      <p>
        {cs
          ? `Klikni na ${requiredCount === 1 ? 'pasáž, která potvrzuje' : 'dvě pasáže, které potvrzují'} tvoji odpověď. Dalším kliknutím zvýraznění zrušíš.`
          : `Click ${requiredCount === 1 ? 'the passage that supports' : 'two passages that support'} your answer. Click again to remove a highlight.`}
      </p>
    </div>
  {/if}
  <article
    id="case-document"
    class:poster={document.kind === 'poster'}
    aria-labelledby="document-name"
  >
    <header>
      {#if document.kind === 'message'}<span class="sender-avatar" aria-hidden="true"
          >{sender.slice(0, 1)}</span
        >{/if}
      <div>
        <h3 id="document-name" lang="de">{sender}</h3>
        <p lang="de">{date}</p>
      </div>
      <span class="document-kind"
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
    <div class="document-body" class:marking lang="de">
      {#each document.lines as line (line.id)}
        <p>
          {#if marking}
            <button
              class="passage"
              class:highlighted={selected.includes(line.id)}
              aria-pressed={selected.includes(line.id)}
              aria-describedby="marking-guide"
              {disabled}
              onclick={() => void onselect(line.id)}>{line.textDe}</button
            >
          {:else if selected.includes(line.id)}
            <mark>{line.textDe}</mark>
          {:else}
            {line.textDe}
          {/if}
        </p>
      {/each}
    </div>
    {#key document.id}
      <details class="glossary">
        <summary
          ><BookOpen size={16} aria-hidden="true" />{cs
            ? 'Pomoc se slovíčky'
            : 'Vocabulary help'}</summary
        >
        <dl>
          {#each document.glossary as word}
            <div>
              <dt lang="de">{word.de}</dt>
              <dd>{word.meaning[language]}</dd>
            </div>
          {/each}
        </dl>
      </details>
    {/key}
  </article>
  {#if remainingCount > 0}
    <p class="awaiting-documents">
      {cs
        ? 'Další podklady získáš, až ověříš současný závěr.'
        : 'More documents will arrive once you confirm your current finding.'}
    </p>
  {/if}
</section>

<style>
  .documents {
    min-width: 0;
  }
  .reading-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.65rem;
  }
  h2 {
    font-size: 0.85rem;
    font-weight: 650;
    margin: 0;
    scroll-margin-top: 1rem;
  }
  .reading-heading > span {
    color: var(--color-ink-600);
    font-size: 0.75rem;
  }
  .document-switcher {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem;
    border-bottom: 1px solid var(--color-line);
    margin-bottom: 1.1rem;
  }
  .document-switcher button {
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.6rem 0.85rem;
    border-bottom: 2px solid transparent;
    font-size: 0.84rem;
    font-weight: 600;
    color: var(--color-ink-600);
    text-align: left;
  }
  .document-switcher button[aria-pressed='true'] {
    border-bottom-color: var(--color-ink-950);
    color: var(--color-ink-950);
  }
  .marked-count {
    display: grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    border-radius: 4px;
    background: var(--color-accent-100);
    color: var(--color-ink-950);
    font-size: 0.7rem;
  }
  .marked-count.empty {
    visibility: hidden;
  }
  .new-document {
    color: var(--color-cobalt-700);
    font-size: 0.66rem;
    font-weight: 650;
  }
  .awaiting-documents {
    color: var(--color-ink-600);
    font-size: 0.78rem;
    line-height: 1.55;
    margin: 0.9rem 0 0;
  }
  .marking-guide {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    padding: 0.85rem 1rem;
    background: var(--color-accent-100);
    border-radius: 8px;
    margin-bottom: 0.8rem;
  }
  .marking-guide :global(svg) {
    flex: none;
    margin-top: 0.15rem;
  }
  .marking-guide p {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.55;
  }
  article {
    border: 1px solid var(--color-line);
    border-radius: 12px;
    background: var(--color-paper-50);
    overflow: hidden;
  }
  article > header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0 1.75rem;
    padding: 1.3rem 0;
    border-bottom: 1px solid var(--color-line);
  }
  .sender-avatar {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    background: var(--color-cobalt-100);
    color: var(--color-cobalt-700);
    border-radius: 50%;
    font-size: 0.9rem;
    font-weight: 700;
    flex: none;
  }
  h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
  }
  header p {
    margin: 0.25rem 0 0;
    font-size: 0.76rem;
    color: var(--color-ink-600);
  }
  .document-kind {
    margin-left: auto;
    font-size: 0.72rem;
    color: var(--color-ink-600);
  }
  .document-body {
    padding: 1.7rem 1.75rem;
    font-size: 1.13rem;
    line-height: 1.85;
    overflow-wrap: anywhere;
  }
  .document-body p {
    margin: 0 0 1.1rem;
  }
  .document-body p:last-child {
    margin-bottom: 0;
  }
  .passage {
    display: block;
    width: 100%;
    min-height: 44px;
    text-align: left;
    font: inherit;
    color: inherit;
    border: 0;
    border-radius: 3px;
    padding: 0.12rem 0.25rem;
    margin: -0.12rem -0.25rem;
    cursor: pointer;
    background: transparent;
  }
  .passage.highlighted,
  mark {
    color: inherit;
    background: var(--color-accent-100);
    text-decoration: underline;
    text-decoration-color: var(--color-ink-700);
    text-underline-offset: 4px;
    text-decoration-thickness: 1px;
  }
  mark {
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
  }
  .passage:disabled {
    cursor: default;
  }
  .poster .document-body p:first-child {
    font-size: 1.55rem;
    font-weight: 720;
    line-height: 1.35;
    letter-spacing: -0.025em;
    margin-bottom: 1.4rem;
  }
  .poster .document-body p:nth-child(2) {
    font-weight: 650;
  }
  .glossary {
    border-top: 1px solid var(--color-line);
    padding: 0 1.75rem;
  }
  summary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 48px;
    cursor: pointer;
    color: var(--color-ink-700);
    font-size: 0.82rem;
    font-weight: 600;
  }
  summary::after {
    content: '+';
    margin-left: auto;
    font-size: 1rem;
  }
  details[open] summary::after {
    content: '−';
  }
  dl {
    margin: 0.2rem 0 1.2rem;
    display: grid;
    gap: 0.8rem;
    font-size: 0.88rem;
  }
  dt {
    font-weight: 650;
  }
  dd {
    margin: 0.15rem 0 0;
    color: var(--color-ink-600);
    line-height: 1.5;
  }
  @media (hover: hover) and (pointer: fine) {
    .passage:not(:disabled):hover {
      background: var(--color-accent-100);
    }
    .document-switcher button:hover {
      color: var(--color-ink-950);
      background: var(--color-paper-50);
    }
  }
  @media (max-width: 799px) {
    .document-switcher button {
      flex: 0 1 auto;
      padding: 0.6rem 0.4rem;
      font-size: 0.77rem;
    }
    article > header {
      margin: 0 1.2rem;
      padding: 1.1rem 0;
    }
    .document-body {
      padding: 1.3rem 1.2rem;
      font-size: 1.02rem;
      line-height: 1.8;
    }
    .document-kind {
      display: none;
    }
    .glossary {
      padding: 0 1.2rem;
    }
  }
</style>
