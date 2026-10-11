<script lang="ts">
  import { requestAdaptiveHint } from '$lib/client/ai.ts';
  import { noteAsLexeme } from '$lib/domain/ai/lexeme.ts';
  import { coursePathChapterById } from '$lib/domain/course/path.ts';
  import { localized } from '$lib/i18n';
  import { appStore, motherTongue } from '$lib/state/app';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import { onDestroy } from 'svelte';

  import type { AiAdaptiveHintResult } from '$lib/domain/ai/types.ts';
  import type { MistakeTag, Note } from '$lib/domain/types.ts';

  let {
    note,
    submitted,
  }: { note: Note; /** What the learner has typed so far. */ submitted: string } = $props();

  let hint = $state<AiAdaptiveHintResult>();
  let loading = $state(false);
  let error = $state('');
  let controller: AbortController | undefined;

  const copy = (cs: string, en: string) => localized($motherTongue, { cs, en });

  onDestroy(() => controller?.abort());

  /** Mistakes this learner made with the same word, most frequent first. */
  function pastMistakes(): MistakeTag[] {
    const counts = new Map<MistakeTag, number>();
    for (const review of $appStore.recentReviews) {
      if (review.noteId !== note.id || review.disputedAt) continue;
      for (const tag of review.mistakeTags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .toSorted((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([tag]) => tag);
  }

  function objectiveIds(): string[] {
    const ids = (note.courseLinks ?? []).flatMap(
      (link) => coursePathChapterById(link.chapterId)?.grammarLessonIds ?? [],
    );
    return [...new Set(ids)].slice(0, 6);
  }

  async function load(): Promise<void> {
    if (loading) return;
    controller = new AbortController();
    loading = true;
    error = '';
    try {
      hint = await requestAdaptiveHint(
        {
          motherTongue: $motherTongue,
          note: noteAsLexeme(note, $motherTongue),
          submitted: submitted.trim().slice(0, 300),
          objectiveIds: objectiveIds(),
          mistakeTags: pastMistakes(),
          revealAnswer: false,
        },
        controller.signal,
      );
    } catch (value) {
      if (value instanceof DOMException && value.name === 'AbortError') return;
      error =
        value instanceof Error && $motherTongue === 'cs'
          ? value.message
          : copy('Nápovědu se nepodařilo připravit.', 'The hint could not be prepared.');
    } finally {
      loading = false;
    }
  }
</script>

{#if hint}
  <aside
    class="mt-3 grid gap-[0.35rem] rounded-[0.25rem] border border-cobalt-700 bg-sky-50 p-3 text-left text-[0.78rem] leading-[1.45]"
    data-testid="adaptive-hint"
    aria-live="polite"
  >
    <strong class="flex items-center gap-[0.35rem] text-cobalt-700"
      ><Sparkles size={15} /> {hint.hint}</strong
    >
    <p class="text-ink-800">{hint.rule}</p>
    <p class="text-ink-600"><span lang="de">{hint.exampleDe}</span> — {hint.exampleCs}</p>
  </aside>
{:else}
  <button
    class="inline-flex min-h-[2.45rem] items-center gap-[0.4rem] border-b border-current text-[0.74rem] font-[780] text-cobalt-700 disabled:cursor-wait"
    type="button"
    disabled={loading}
    onclick={() => void load()}
  >
    {#if loading}<LoaderCircle class="animate-spin" size={15} />{:else}<Sparkles size={15} />{/if}
    {copy('Vysvětli mi to víc (AI)', 'Explain more (AI)')}
  </button>
  {#if error}<p class="mt-2 text-[0.72rem] font-bold text-coral-700" role="alert">{error}</p>{/if}
{/if}
