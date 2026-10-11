<script lang="ts">
  import { requestContextDrills } from '$lib/client/ai.ts';
  import { noteAsLexeme } from '$lib/domain/ai/lexeme.ts';
  import { normalizeText } from '$lib/domain/grading/normalize.ts';
  import { aggregateMistakes } from '$lib/domain/learning/mistakes.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Brain from '@lucide/svelte/icons/brain';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import RefreshCw from '@lucide/svelte/icons/refresh-cw';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';

  import type { AiContextDrill, AiContextLexeme } from '$lib/domain/ai/types.ts';
  import type { CoursePathChapter } from '$lib/domain/course/path.ts';
  import type { CefrLevel, Note, ReviewLog, StudyCard } from '$lib/domain/types.ts';

  let {
    notes,
    cards,
    reviews,
    level,
    chapter,
    dataRecipient,
  }: {
    notes: Note[];
    cards: StudyCard[];
    reviews: ReviewLog[];
    level: CefrLevel;
    chapter?: CoursePathChapter;
    dataRecipient: string;
  } = $props();

  let drills = $state<AiContextDrill[]>([]);
  let answers = $state<Record<string, string>>({});
  let checked = $state<Record<string, boolean>>({});
  let loading = $state(false);
  let error = $state('');
  let model = $state('');
  let controller = $state<AbortController>();

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  const selectedNotes = $derived.by(() => {
    const now = Date.now();
    const dueNoteIds = new Set<string>();
    for (const card of cards) {
      if (Date.parse(card.dueAt) <= now) dueNoteIds.add(card.noteId);
    }
    return notes
      .toSorted((left, right) => Number(dueNoteIds.has(right.id)) - Number(dueNoteIds.has(left.id)))
      .slice(0, 8);
  });

  async function generate(): Promise<void> {
    if (selectedNotes.length < 3 || loading) return;
    controller?.abort();
    controller = new AbortController();
    loading = true;
    error = '';
    checked = {};
    answers = {};
    try {
      const mistakes = aggregateMistakes(reviews, new Date(Date.now() - 30 * 86_400_000))
        .slice(0, 5)
        .map(({ tag, count }) => ({ tag, count }));
      const result = await requestContextDrills(
        {
          motherTongue: $motherTongue,
          chapterId: chapter?.id,
          level,
          lexemes: selectedNotes.map((note) => noteAsLexeme(note, $motherTongue)),
          objectiveIds: chapter?.grammarLessonIds ?? [],
          mistakes,
        },
        controller.signal,
      );
      drills = result.drills;
      model = result.model;
    } catch (value) {
      if (value instanceof DOMException && value.name === 'AbortError') return;
      error =
        value instanceof Error && $motherTongue === 'cs'
          ? value.message
          : copy('Cvičení se nepodařilo připravit.', 'The mini practice could not be prepared.');
    } finally {
      loading = false;
    }
  }

  function isCorrect(drill: AiContextDrill): boolean {
    const submitted = normalizeText(answers[drill.id] ?? '');
    return [drill.answer, ...drill.acceptedAnswers].some(
      (candidate) => normalizeText(candidate) === submitted,
    );
  }

  const mono =
    'm-0 font-mono text-[0.75rem] leading-[1.3] font-[760] tracking-[0.055em] text-mint-800 uppercase';
  const outlineButton =
    'min-h-11 rounded-[0.65rem] border border-ink-950 bg-paper-50 px-[0.85rem] font-[780] active:not-disabled:[transform:scale(0.97)]';
</script>

<section
  class="rounded-[1.25rem_1.25rem_0.7rem_1.25rem] border border-[color-mix(in_srgb,var(--color-mint-600)_24%,transparent)] bg-[color-mix(in_srgb,var(--color-mint-50)_62%,var(--color-paper-50))] p-[clamp(1rem,3vw,1.75rem)]"
  aria-labelledby="context-drill-title"
>
  <header class="flex items-start gap-[0.9rem]">
    <div
      class="grid size-12 flex-[0_0_3rem] place-items-center rounded-[0.9rem_0.9rem_0.4rem_0.9rem] bg-acid-400 text-ink-950 shadow-[3px_3px_0_var(--color-ink-950)]"
    >
      <Brain size={24} />
    </div>
    <div>
      <p class={mono}>{copy('Moje slova v kontextu', 'My words in context')}</p>
      <h2 class="mt-1 text-[clamp(1.2rem,2.4vw,1.65rem)] leading-[1.15]" id="context-drill-title">
        {copy('Krátký trénink bez zásahu do rozvrhu', 'Quick practice outside your schedule')}
      </h2>
      <p class="mt-[0.55rem] max-w-3xl text-[0.9rem] leading-[1.55] text-ink-700">
        {copy(
          'Procvičíš 3–8 vlastních slov, která je čas zopakovat nebo ti dělají potíže. Tohle cvičení nemění termíny opakování ani postup v kurzu a nepřidává XP.',
          'Practise 3–8 of your words that are due for review or need more work. This activity doesn’t change review dates or course progress and doesn’t award XP.',
        )}
      </p>
    </div>
  </header>

  <div
    class="my-[1.1rem] flex gap-[0.6rem] rounded-[0.85rem] bg-white/72 p-[0.8rem] text-[0.82rem] leading-[1.45] text-ink-700"
  >
    <ShieldCheck class="flex-none text-mint-700" size={18} />
    <span
      ><strong>{copy('Příjemce dat:', 'Data recipient:')}</strong>
      {dataRecipient}.
      {copy(
        'AI dostane jen vybraná slovíčka, tvou úroveň a typy chyb.',
        'AI receives only the selected words, your level, and types of mistakes.',
      )}</span
    >
  </div>

  {#if selectedNotes.length < 3}
    <p class="mt-[0.8rem] text-[0.875rem]">
      {copy(
        'Nejdřív si přidej alespoň tři vlastní slovíčka.',
        'Add at least three of your own vocabulary entries to use this mini practice.',
      )}
    </p>
  {:else if drills.length === 0}
    <button
      class="inline-flex min-h-11 items-center gap-[0.55rem] rounded-[0.8rem_0.8rem_0.35rem_0.8rem] border border-ink-950 bg-acid-400 px-4 py-[0.72rem] font-[780] shadow-[3px_3px_0_var(--color-ink-950)] active:not-disabled:[transform:scale(0.97)]"
      type="button"
      onclick={generate}
      disabled={loading}
    >
      {#if loading}<span class="inline-flex animate-spin motion-reduce:animate-none"
          ><LoaderCircle size={19} /></span
        >{:else}<Brain size={19} />{/if}
      {loading
        ? copy('Připravuji cvičení…', 'Preparing mini practice…')
        : copy(
            `Procvičit ${selectedNotes.length} vybraných slov`,
            `Practice ${selectedNotes.length} selected words`,
          )}
    </button>
  {:else}
    <ol class="mt-4 mb-0 grid list-none gap-[0.85rem] p-0">
      {#each drills as drill, index (drill.id)}
        <li class="rounded-[0.95rem] bg-[color-mix(in_srgb,white_78%,var(--color-paper-50))] p-4">
          <p class={mono}>
            {index + 1}. {drill.type} · {drill.provenance === 'demo-template'
              ? 'offline demo'
              : copy('AI návrh', 'AI draft')}
          </p>
          <p class="mt-[0.4rem] mb-[0.8rem] text-[1rem] leading-[1.45] font-[680]">
            {drill.prompt}
          </p>
          <form
            onsubmit={(event) => {
              event.preventDefault();
              checked[drill.id] = true;
            }}
          >
            <label
              class="mb-[0.3rem] block text-[0.78rem] font-bold text-ink-700"
              for={`context-answer-${index}`}>{copy('Tvoje odpověď', 'Your answer')}</label
            >
            <div class="flex gap-2 max-[32rem]:flex-col max-[32rem]:items-stretch">
              <input
                class="min-h-11 min-w-0 flex-1 rounded-[0.65rem] border border-ink-400 bg-white px-3 py-[0.65rem] text-[1rem]"
                id={`context-answer-${index}`}
                value={answers[drill.id] ?? ''}
                oninput={(event) => (answers[drill.id] = event.currentTarget.value)}
                autocomplete="off"
                lang="de"
                disabled={checked[drill.id]}
              />
              <button
                class={outlineButton}
                type="submit"
                disabled={!answers[drill.id]?.trim() || checked[drill.id]}
                >{copy('Ověřit', 'Check')}</button
              >
            </div>
          </form>
          {#if checked[drill.id]}
            <div
              class={[
                'mt-3 flex gap-[0.55rem] rounded-[0.7rem] p-[0.7rem] text-[0.83rem] leading-[1.45]',
                isCorrect(drill) ? 'bg-mint-50 text-mint-900' : 'bg-coral-50 text-coral-800',
              ]}
              role="status"
            >
              <CheckCircle2 class="flex-none" size={18} />
              <span class="block">
                <strong class="block"
                  >{isCorrect(drill)
                    ? copy('Sedí.', 'Correct.')
                    : copy(`Správně: ${drill.answer}`, `Correct answer: ${drill.answer}`)}</strong
                >
                {drill.explanation}
              </span>
            </div>
          {/if}
        </li>
      {/each}
    </ol>
    <footer
      class="mt-4 flex items-center justify-between gap-3 text-[0.78rem] text-ink-600 max-[32rem]:flex-col max-[32rem]:items-stretch"
    >
      <span>{model}</span>
      <button
        class="{outlineButton} inline-flex items-center gap-[0.4rem]"
        type="button"
        onclick={generate}
        disabled={loading}
      >
        <RefreshCw size={17} />
        {copy('Jiná sada', 'Another set')}
      </button>
    </footer>
  {/if}

  {#if error}<p class="mt-[0.8rem] text-[0.875rem] text-coral-800" role="alert">{error}</p>{/if}
</section>
