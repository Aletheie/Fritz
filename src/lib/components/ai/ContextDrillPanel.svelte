<script lang="ts">
  import { requestContextDrills } from '$lib/client/ai.ts';
  import { normalizeText } from '$lib/domain/grading/normalize.ts';
  import { aggregateMistakes } from '$lib/domain/learning/mistakes.ts';
  import { localized } from '$lib/i18n';
  import { sourceMeaning } from '$lib/i18n/vocabulary.ts';
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

  function asLexeme(note: Note): AiContextLexeme {
    return {
      noteId: note.id,
      german: note.german,
      czech: sourceMeaning(note.german, note.czech, $motherTongue),
      kind: note.kind,
      article: note.article,
      acceptedGerman: note.acceptedGerman,
      acceptedCzech: $motherTongue === 'cs' ? note.acceptedCzech : [],
      exampleDe: note.exampleDe,
      exampleCs: $motherTongue === 'cs' ? note.exampleCs : undefined,
    };
  }

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
          lexemes: selectedNotes.map(asLexeme),
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
          : copy(
              'Mikrotrénink se nepodařilo připravit.',
              'The mini practice could not be prepared.',
            );
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
</script>

<section class="context-panel" aria-labelledby="context-drill-title">
  <header>
    <div class="context-icon"><Brain size={24} /></div>
    <div>
      <p class="eyebrow">{copy('Moje slova v kontextu', 'My words in context')}</p>
      <h2 id="context-drill-title">
        {copy('Krátký trénink bez zásahu do rozvrhu', 'Quick practice outside your schedule')}
      </h2>
      <p>
        {copy(
          'Vybere 3–8 due nebo slabších vlastních slov a propojí je s aktuální kapitolou. Výsledky zde nemění FSRS, XP ani odemčení.',
          'This uses 3–8 due or weaker words from your vocabulary and connects them to the current chapter. Results here do not affect FSRS, XP, or unlocks.',
        )}
      </p>
    </div>
  </header>

  <div class="privacy-note">
    <ShieldCheck size={18} />
    <span
      ><strong>{copy('Příjemce dat:', 'Data recipient:')}</strong>
      {dataRecipient}.
      {copy(
        'Odesílají se jen vybrané lexémy, úroveň a strukturované tagy chyb.',
        'Only selected lexemes, the level, and structured mistake tags are sent.',
      )}</span
    >
  </div>

  {#if selectedNotes.length < 3}
    <p class="empty">
      {copy(
        'Pro mikrotrénink jsou potřeba alespoň tři vlastní slovníkové záznamy.',
        'Add at least three of your own vocabulary entries to use this mini practice.',
      )}
    </p>
  {:else if drills.length === 0}
    <button class="generate" type="button" onclick={generate} disabled={loading}>
      {#if loading}<span class="spin"><LoaderCircle size={19} /></span>{:else}<Brain
          size={19}
        />{/if}
      {loading
        ? copy('Připravuji mikrotrénink…', 'Preparing mini practice…')
        : copy(
            `Procvičit ${selectedNotes.length} vybraných slov`,
            `Practice ${selectedNotes.length} selected words`,
          )}
    </button>
  {:else}
    <ol class="drills">
      {#each drills as drill, index (drill.id)}
        <li>
          <p class="drill-meta">
            {index + 1}. {drill.type} · {drill.provenance === 'demo-template'
              ? 'offline demo'
              : copy('AI návrh', 'AI draft')}
          </p>
          <p class="prompt">{drill.prompt}</p>
          <form
            onsubmit={(event) => {
              event.preventDefault();
              checked[drill.id] = true;
            }}
          >
            <label for={`context-answer-${index}`}>{copy('Tvoje odpověď', 'Your answer')}</label>
            <div>
              <input
                id={`context-answer-${index}`}
                value={answers[drill.id] ?? ''}
                oninput={(event) => (answers[drill.id] = event.currentTarget.value)}
                autocomplete="off"
                lang="de"
                disabled={checked[drill.id]}
              />
              <button type="submit" disabled={!answers[drill.id]?.trim() || checked[drill.id]}
                >{copy('Ověřit', 'Check')}</button
              >
            </div>
          </form>
          {#if checked[drill.id]}
            <div
              class:correct={isCorrect(drill)}
              class:incorrect={!isCorrect(drill)}
              class="feedback"
              role="status"
            >
              <CheckCircle2 size={18} />
              <span>
                <strong
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
    <footer>
      <span>{model}</span>
      <button type="button" onclick={generate} disabled={loading}>
        <RefreshCw size={17} />
        {copy('Jiná sada', 'Another set')}
      </button>
    </footer>
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .context-panel {
    padding: clamp(1rem, 3vw, 1.75rem);
    border-radius: var(--radius-card, 1.25rem) 1.25rem 0.7rem 1.25rem;
    background: color-mix(in srgb, var(--color-mint-50) 62%, var(--color-paper-50));
    border: 1px solid color-mix(in srgb, var(--color-mint-600) 24%, transparent);
  }
  header {
    display: flex;
    gap: 0.9rem;
    align-items: flex-start;
  }
  .context-icon {
    display: grid;
    flex: 0 0 3rem;
    width: 3rem;
    height: 3rem;
    place-items: center;
    border-radius: 0.9rem 0.9rem 0.4rem 0.9rem;
    color: var(--color-ink-950);
    background: var(--color-acid-400);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .eyebrow,
  .drill-meta {
    margin: 0;
    font: 760 0.75rem/1.3 var(--font-mono);
    letter-spacing: 0.055em;
    text-transform: uppercase;
    color: var(--color-mint-800);
  }
  h2 {
    margin: 0.25rem 0 0;
    font-size: clamp(1.2rem, 2.4vw, 1.65rem);
    line-height: 1.15;
  }
  header p:last-child {
    max-width: 48rem;
    margin: 0.55rem 0 0;
    color: var(--color-ink-700);
    font-size: 0.9rem;
    line-height: 1.55;
  }
  .privacy-note {
    display: flex;
    gap: 0.6rem;
    margin: 1.1rem 0;
    padding: 0.8rem;
    border-radius: 0.85rem;
    background: color-mix(in srgb, white 72%, transparent);
    color: var(--color-ink-700);
    font-size: 0.82rem;
    line-height: 1.45;
  }
  .privacy-note :global(svg) {
    flex: none;
    color: var(--color-mint-700);
  }
  .generate,
  footer button,
  form button {
    min-height: 44px;
    border: 1px solid var(--color-ink-950);
    font-weight: 780;
  }
  .generate {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.72rem 1rem;
    border-radius: 0.8rem 0.8rem 0.35rem 0.8rem;
    background: var(--color-acid-400);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .drills {
    display: grid;
    gap: 0.85rem;
    margin: 1rem 0 0;
    padding: 0;
    list-style: none;
  }
  .drills li {
    padding: 1rem;
    border-radius: 0.95rem;
    background: color-mix(in srgb, white 78%, var(--color-paper-50));
  }
  .prompt {
    margin: 0.4rem 0 0.8rem;
    font-size: 1rem;
    font-weight: 680;
    line-height: 1.45;
  }
  form label {
    display: block;
    margin-bottom: 0.3rem;
    color: var(--color-ink-700);
    font-size: 0.78rem;
    font-weight: 700;
  }
  form > div {
    display: flex;
    gap: 0.5rem;
  }
  input {
    min-width: 0;
    min-height: 44px;
    flex: 1;
    border: 1px solid var(--color-ink-400);
    border-radius: 0.65rem;
    padding: 0.65rem 0.75rem;
    background: white;
    font-size: 1rem;
  }
  form button,
  footer button {
    border-radius: 0.65rem;
    padding-inline: 0.85rem;
    background: var(--color-paper-50);
  }
  .feedback {
    display: flex;
    gap: 0.55rem;
    margin-top: 0.75rem;
    padding: 0.7rem;
    border-radius: 0.7rem;
    font-size: 0.83rem;
    line-height: 1.45;
  }
  .feedback :global(svg) {
    flex: none;
  }
  .feedback span,
  .feedback strong {
    display: block;
  }
  .correct {
    color: var(--color-mint-900);
    background: var(--color-mint-50);
  }
  .incorrect {
    color: var(--color-coral-800);
    background: var(--color-coral-50);
  }
  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1rem;
    color: var(--color-ink-600);
    font-size: 0.78rem;
  }
  footer button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .empty,
  .error {
    margin: 0.8rem 0 0;
    font-size: 0.875rem;
  }
  .error {
    color: var(--color-coral-800);
  }
  .spin {
    display: inline-flex;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  button:active:not(:disabled) {
    transform: scale(0.97);
  }
  @media (max-width: 32rem) {
    form > div,
    footer {
      align-items: stretch;
      flex-direction: column;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spin {
      animation: none;
    }
  }
</style>
