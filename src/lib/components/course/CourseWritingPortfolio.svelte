<script lang="ts">
  import { coursePathChapters } from '$lib/domain/course/path.ts';
  import { localized, languageTag } from '$lib/i18n';
  import { courseChapterCopy, loadCourseCopyCatalog } from '$lib/i18n/course.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import { onMount } from 'svelte';

  let filter = $state('all');
  let expanded = $state(false);
  let catalogReady = $state(false);
  onMount(async () => {
    if ($motherTongue !== 'en') return;
    try {
      await loadCourseCopyCatalog();
      catalogReady = true;
    } catch {
      // Keep chapter numbers when translated titles cannot be loaded.
    }
  });
  const entries = $derived(
    coursePathChapters
      .flatMap((chapter) => {
        const nodeId = `${chapter.id}:sentence`;
        const progress = $appStore.course.pathNodes[nodeId];
        if (!progress || (progress.writingDraft === undefined && !progress.writtenResponse))
          return [];
        return [
          {
            nodeId,
            title: catalogReady
              ? courseChapterCopy($motherTongue, chapter).title
              : $motherTongue === 'en'
                ? `Chapter ${chapter.number}`
                : chapter.title,
            level: chapter.level,
            draft: progress.writingDraft !== undefined,
            text: progress.writingDraft?.text ?? progress.writtenResponse ?? '',
            updatedAt: progress.writingDraft?.updatedAt ?? progress.updatedAt,
          },
        ];
      })
      .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );
  const filtered = $derived(
    entries.filter(
      (entry) => filter === 'all' || (filter === 'drafts' ? entry.draft : !entry.draft),
    ),
  );
  const visible = $derived(expanded ? filtered : filtered.slice(0, 5));

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }
</script>

<section class="writing-portfolio" aria-labelledby="writing-portfolio-title">
  <h2 id="writing-portfolio-title">{copy('Moje texty', 'My writing')}</h2>
  <p>
    {copy(
      'Vrať se k rozepsané zprávě nebo přepracuj dokončený text. Vše zůstává v tomto zařízení a patří do zálohy.',
      'Return to a draft or revise a finished text. Everything stays on this device and is included in your backup.',
    )}
  </p>
  {#if entries.length}
    <div class="filter-row">
      <label for="writing-filter">{copy('Zobrazit texty', 'Show writing')}</label>
      <select
        id="writing-filter"
        bind:value={filter}
        onchange={() => {
          expanded = false;
        }}
      >
        <option value="all">{copy('Všechny', 'All')}</option>
        <option value="drafts">{copy('Rozepsané', 'Drafts')}</option>
        <option value="finished">{copy('Dokončené', 'Finished')}</option>
      </select>
    </div>
    {#if visible.length}
      <ul>
        {#each visible as entry (entry.nodeId)}
          <li>
            <div class="entry-meta">
              <span
                >{entry.level} · {entry.draft
                  ? copy('Rozepsáno', 'Draft')
                  : copy('Dokončeno', 'Finished')}</span
              ><time datetime={entry.updatedAt}
                >{new Intl.DateTimeFormat(languageTag($motherTongue), {
                  day: 'numeric',
                  month: 'short',
                }).format(new Date(entry.updatedAt))}</time
              >
            </div>
            <h3><a href={`/path/${encodeURIComponent(entry.nodeId)}/`}>{entry.title}</a></h3>
            {#if entry.text}<p class="excerpt" lang="de">{entry.text}</p>{:else}<p>
                {copy(
                  'Prázdný rozepsaný text. Otevři zadání a pokračuj.',
                  'An empty draft. Open the task to continue.',
                )}
              </p>{/if}
            <a class="continue" href={`/path/${encodeURIComponent(entry.nodeId)}/`}
              >{entry.draft
                ? copy('Pokračovat v psaní', 'Continue writing')
                : copy('Otevřít a upravit', 'Open and revise')} →</a
            >
          </li>
        {/each}
      </ul>
    {:else}<p role="status">
        {copy(
          'V tomto výběru zatím žádné texty nejsou.',
          'There is no writing in this selection yet.',
        )}
      </p>{/if}
    {#if filtered.length > 5}<button
        class="btn-base btn-secondary"
        type="button"
        aria-expanded={expanded}
        onclick={() => {
          expanded = !expanded;
        }}
        >{expanded
          ? copy('Zobrazit méně', 'Show less')
          : copy(
              `Zobrazit všech ${filtered.length} textů`,
              `Show all ${filtered.length} texts`,
            )}</button
      >{/if}
  {:else}
    <p>
      {copy(
        'První text se tu objeví, jakmile začneš psát v kroku Psaní.',
        'Your first text will appear here when you start the Writing step.',
      )}
    </p>
    <a class="continue" href="/course/">{copy('Otevřít kurz', 'Open the course')} →</a>
  {/if}
</section>

<style>
  .writing-portfolio {
    padding-block: 1.5rem;
    border-block: 1px solid var(--color-line-strong);
  }
  h2 {
    margin: 0 0 0.7rem;
    font-size: 1.5rem;
  }
  p {
    max-width: 65ch;
    margin: 0.5rem 0;
    line-height: 1.6;
    color: var(--color-ink-800);
  }
  .filter-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.7rem;
    margin-block: 1.2rem;
  }
  label {
    font-size: 0.9rem;
    font-weight: 650;
  }
  select {
    min-height: 44px;
    padding: 0.6rem 2rem 0.6rem 0.8rem;
    border: 1px solid var(--color-line-strong);
    border-radius: 0.5rem;
    background: var(--color-paper-50);
    color: var(--color-ink-950);
    font: inherit;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
  }
  li {
    padding-block: 1rem;
    border-bottom: 1px solid var(--color-line);
  }
  h3 {
    margin-block: 0.5rem;
    font-size: 1.1rem;
  }
  h3 a {
    color: var(--color-ink-950);
  }
  .entry-meta {
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--color-ink-800);
  }
  .excerpt {
    color: var(--color-ink-950);
    overflow: hidden;
    display: -webkit-box;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow-wrap: anywhere;
  }
  .continue {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    color: var(--color-cobalt-700);
    font-size: 0.9rem;
    font-weight: 750;
  }
</style>
