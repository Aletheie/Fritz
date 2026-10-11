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

  const paragraph = 'mx-0 my-2 max-w-[65ch] leading-[1.6] text-ink-800';
  const continueLink = 'inline-flex min-h-11 items-center text-[0.9rem] font-[750] text-cobalt-700';
</script>

<section
  data-testid="writing-portfolio"
  class="border-y border-line-strong py-6"
  aria-labelledby="writing-portfolio-title"
>
  <h2 class="mt-0 mb-[0.7rem] text-[1.5rem]" id="writing-portfolio-title">
    {copy('Moje texty', 'My writing')}
  </h2>
  <p class={paragraph}>
    {copy(
      'Vrať se k rozepsané zprávě nebo přepracuj dokončený text. Vše zůstává v tomto zařízení a patří do zálohy.',
      'Return to a draft or revise a finished text. Everything stays on this device and is included in your backup.',
    )}
  </p>
  {#if entries.length}
    <div class="my-[1.2rem] flex flex-wrap items-center gap-[0.7rem]">
      <label class="text-[0.9rem] font-[650]" for="writing-filter"
        >{copy('Zobrazit texty', 'Show writing')}</label
      >
      <select
        id="writing-filter"
        class="min-h-11 rounded-lg border border-line-strong bg-paper-50 py-[0.6rem] pr-8 pl-[0.8rem] text-ink-950"
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
      <ul class="mt-0 mb-4 list-none p-0">
        {#each visible as entry (entry.nodeId)}
          <li class="border-b border-line py-4">
            <div class="flex justify-between gap-4 text-[0.8rem] text-ink-800">
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
            <h3 class="my-2 text-[1.1rem]">
              <a class="text-ink-950" href={`/path/${encodeURIComponent(entry.nodeId)}/`}
                >{entry.title}</a
              >
            </h3>
            {#if entry.text}<p
                class="{paragraph} line-clamp-3 [overflow-wrap:anywhere] text-ink-950"
                lang="de"
              >
                {entry.text}
              </p>{:else}<p class={paragraph}>
                {copy(
                  'Prázdný rozepsaný text. Otevři zadání a pokračuj.',
                  'An empty draft. Open the task to continue.',
                )}
              </p>{/if}
            <a class={continueLink} href={`/path/${encodeURIComponent(entry.nodeId)}/`}
              >{entry.draft
                ? copy('Pokračovat v psaní', 'Continue writing')
                : copy('Otevřít a upravit', 'Open and revise')} →</a
            >
          </li>
        {/each}
      </ul>
    {:else}<p class={paragraph} role="status">
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
    <p class={paragraph}>
      {copy(
        'První text se tu objeví, jakmile začneš psát v kroku Psaní.',
        'Your first text will appear here when you start the Writing step.',
      )}
    </p>
    <a class={continueLink} href="/course/">{copy('Otevřít kurz', 'Open the course')} →</a>
  {/if}
</section>
