<script lang="ts">
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { examPlanReadiness, examPlanScopeNotes } from '$lib/domain/exam-plan.ts';
  import { sortedVocabularyTags } from '$lib/domain/vocabulary/tags.ts';
  import { appStore } from '$lib/state/app';
  import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Brain from '@lucide/svelte/icons/brain';
  import CalendarCheck from '@lucide/svelte/icons/calendar-check';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { onMount } from 'svelte';

  import type { DailyMinutes, ExamPlan } from '$lib/domain/types.ts';

  const timeOptions: DailyMinutes[] = [5, 10, 20];
  let ready = $state(false);
  let saving = $state(false);
  let removing = $state(false);
  let confirmRemoval = $state(false);
  let savedMessage = $state('');
  let errorMessage = $state('');
  let examDate = $state('');
  let selectedTag = $state('all');
  let dailyMinutes = $state<DailyMinutes>(10);

  const tags = $derived(sortedVocabularyTags($appStore.notes, 'cs'));
  const plan = $derived($appStore.settings?.examPlan);
  const readiness = $derived(
    plan
      ? examPlanReadiness({
          plan,
          notes: $appStore.notes,
          cards: $appStore.cards,
          reviews: $appStore.recentReviews,
        })
      : undefined,
  );
  const noteById = $derived(new Map($appStore.notes.map((note) => [note.id, note])));
  const riskNotes = $derived(
    readiness?.riskNoteIds
      .slice(0, 6)
      .map((id) => noteById.get(id))
      .filter((note) => note !== undefined) ?? [],
  );
  const sprintHref = $derived(
    plan && readiness
      ? `/study/?mode=cram&tag=${encodeURIComponent(plan.tag)}&minutes=${plan.dailyMinutes}&start=1&distinct=1`
      : '/study/?mode=cram',
  );

  onMount(async () => {
    await appStore.initialize();
    const existing = $appStore.settings?.examPlan;
    if (existing) {
      examDate = existing.examDate;
      selectedTag = existing.tag;
      dailyMinutes = existing.dailyMinutes;
    } else {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      examDate = localDateKey(defaultDate);
      dailyMinutes = $appStore.settings?.dailyMinutes ?? 10;
    }
    if (selectedTag !== 'all' && !tags.includes(selectedTag)) selectedTag = 'all';
    ready = true;
  });

  function localDateKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDate(value: string): string {
    return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'long' }).format(
      new Date(`${value}T12:00:00`),
    );
  }

  async function savePlan(): Promise<void> {
    if (!examDate || saving) return;
    saving = true;
    confirmRemoval = false;
    savedMessage = '';
    errorMessage = '';
    const timestamp = new Date().toISOString();
    const nextPlan: ExamPlan = {
      examDate,
      tag: selectedTag,
      dailyMinutes,
      createdAt: plan?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    try {
      await appStore.updateSettings({ examPlan: nextPlan });
      savedMessage = 'Plán je uložený v tomto zařízení.';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Plán se nepodařilo uložit.';
    } finally {
      saving = false;
    }
  }

  async function removePlan(): Promise<void> {
    if (!plan || removing) return;
    removing = true;
    savedMessage = '';
    errorMessage = '';
    try {
      await appStore.updateSettings({ examPlan: undefined });
      confirmRemoval = false;
      savedMessage = 'Plán byl zrušený. Slovíčka i dlouhodobé opakování zůstávají beze změny.';
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Plán se nepodařilo zrušit.';
    } finally {
      removing = false;
    }
  }
</script>

<svelte:head>
  <title>Plán na písemku · Fritz</title>
  <meta
    name="description"
    content="Připrav se na německou písemku podle data, rozsahu a skutečné připravenosti."
  />
</svelte:head>

{#if !ready || !$appStore.settings}
  <LoadingState label="Počítám připravenost…" />
{:else}
  <div class="exam-page">
    <header class="page-head">
      <div class="head-icon"><CalendarCheck size={27} aria-hidden="true" /></div>
      <div>
        <p class="kicker">krátkodobý cíl</p>
        <h1>Plán na písemku</h1>
        <p>Vyber datum a látku. Sprint zůstává oddělený od dlouhodobého FSRS opakování.</p>
      </div>
    </header>

    <div class="exam-layout">
      <section class="surface setup-card" aria-labelledby="setup-title">
        <div class="section-heading">
          <span>01</span>
          <div>
            <p class="kicker">nastavení</p>
            <h2 id="setup-title">Co musí být hotové</h2>
          </div>
        </div>
        <form
          onsubmit={(event) => {
            event.preventDefault();
            void savePlan();
          }}
        >
          <label class="field-label">
            <span>Datum písemky</span>
            <input class="field" type="date" min={localDateKey()} bind:value={examDate} required />
          </label>
          <label class="field-label">
            <span>Rozsah látky</span>
            <select class="field" bind:value={selectedTag}>
              <option value="all">Všechna slovíčka ({$appStore.notes.length})</option>
              {#each tags as tag}
                <option value={tag}
                  >{tag} ({examPlanScopeNotes($appStore.notes, tag).length})</option
                >
              {/each}
            </select>
          </label>
          <fieldset class="time-choice">
            <legend>Čas denně</legend>
            {#each timeOptions as option}
              <label class:selected={dailyMinutes === option}>
                <input type="radio" name="daily-minutes" value={option} bind:group={dailyMinutes} />
                <Clock3 size={18} aria-hidden="true" /><strong>{option} min</strong>
              </label>
            {/each}
          </fieldset>
          <button class="btn-base btn-primary" type="submit" disabled={saving || !examDate}>
            {saving ? 'Ukládám…' : plan ? 'Přepočítat plán' : 'Vytvořit plán'}
          </button>
          {#if plan}
            <div class="remove-plan">
              {#if confirmRemoval}
                <p>Opravdu zrušit jen krátkodobý plán?</p>
                <div>
                  <button
                    class="remove-confirm"
                    type="button"
                    disabled={removing}
                    onclick={() => void removePlan()}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    {removing ? 'Ruším…' : 'Ano, zrušit plán'}
                  </button>
                  <button
                    class="remove-cancel"
                    type="button"
                    disabled={removing}
                    onclick={() => (confirmRemoval = false)}
                  >
                    Nechat plán
                  </button>
                </div>
              {:else}
                <button
                  class="remove-trigger"
                  type="button"
                  onclick={() => (confirmRemoval = true)}
                >
                  <Trash2 size={16} aria-hidden="true" /> Zrušit plán
                </button>
              {/if}
            </div>
          {/if}
          {#if savedMessage}<p class="saved-message" role="status">{savedMessage}</p>{/if}
          {#if errorMessage}<p class="error-message" role="alert">{errorMessage}</p>{/if}
        </form>
      </section>

      <section class="surface readiness-card" aria-labelledby="readiness-title">
        {#if plan && readiness}
          <div class="readiness-head">
            <div>
              <p class="kicker">připravenost na {formatDate(plan.examDate)}</p>
              <h2 id="readiness-title">{readiness.percent} % opravdu vybaveno</h2>
            </div>
            <div class="readiness-score" aria-hidden="true">
              {readiness.ready}/{readiness.total}
            </div>
          </div>
          <div
            class="readiness-bar"
            role="progressbar"
            aria-label="Slovíčka vybavená bez nápovědy"
            aria-valuemin="0"
            aria-valuemax={readiness.total}
            aria-valuenow={readiness.ready}
          >
            <i style={`--readiness:${readiness.percent / 100}`}></i>
          </div>

          <div class="metric-grid">
            <article>
              <CalendarCheck size={18} aria-hidden="true" />
              <strong>{readiness.daysRemaining}</strong><span>dní zbývá</span>
            </article>
            <article>
              <Brain size={18} aria-hidden="true" />
              <strong>{readiness.dailyTarget}</strong><span>slov denně</span>
            </article>
            <article>
              <ShieldCheck size={18} aria-hidden="true" />
              <strong>{readiness.unassistedReviewed}</strong><span>bez nápovědy</span>
            </article>
          </div>

          {#if !readiness.feasible}
            <div class="pace-warning" role="alert">
              <AlertTriangle size={20} aria-hidden="true" />
              <p>
                <strong>Plán se do zvoleného času nevejde.</strong>
                Potřebuješ přibližně {readiness.dailyTarget} slov denně, ale za {plan.dailyMinutes}
                minut je reálných asi {readiness.dailyCapacity}. Zvyš čas nebo zúž rozsah.
              </p>
            </div>
          {/if}

          {#if readiness.total === 0}
            <div class="empty-scope">
              <AlertTriangle size={20} aria-hidden="true" />
              <p>
                <strong>V tomto rozsahu zatím nejsou slovíčka.</strong> Přidej je nebo zvol jiný štítek.
              </p>
            </div>
          {:else if readiness.riskNoteIds.length === 0}
            <div class="ready-note">
              <CheckCircle2 size={21} aria-hidden="true" />
              <p>
                <strong>Máš připraveno.</strong> U všech slov proběhl poslední pokus bez nápovědy.
              </p>
            </div>
          {:else}
            <div class="risk-zone">
              <div class="risk-heading">
                <div>
                  <p class="kicker">největší riziko</p>
                  <h3>Těmito slovy začni</h3>
                </div>
                <span>{readiness.riskNoteIds.length} zbývá</span>
              </div>
              <ul>
                {#each riskNotes as note}
                  <li>
                    <span lang="de">{note.article ? `${note.article} ` : ''}{note.german}</span>
                    <small>{note.czech}</small>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if readiness.total > 0}
            <a class="btn-base btn-primary sprint-link" href={sprintHref}>
              Spustit dnešní sprint <ArrowRight size={18} aria-hidden="true" />
            </a>
          {:else}
            <button class="btn-base btn-primary sprint-link" type="button" disabled>
              Spustit dnešní sprint <ArrowRight size={18} aria-hidden="true" />
            </button>
          {/if}
          <p class="fsrs-note">
            Sprint trénuje na datum, ale neposouvá intervaly dlouhodobého opakování.
          </p>
        {:else}
          <div class="empty-plan">
            <CalendarCheck size={42} aria-hidden="true" />
            <p class="kicker">připravenost</p>
            <h2 id="readiness-title">Nejdřív ulož datum a rozsah</h2>
            <p>Pak uvidíš denní dávku i slova, která jsou před písemkou nejrizikovější.</p>
          </div>
        {/if}
      </section>
    </div>
  </div>
{/if}

<style>
  .exam-page {
    width: min(100%, 70rem);
    margin: 0 auto;
    padding-bottom: 2rem;
  }
  .page-head {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.2rem;
  }
  .head-icon {
    display: grid;
    width: 3.4rem;
    height: 3.4rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 1rem 0.45rem 0.45rem;
    background: var(--color-acid-500);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  h1 {
    margin-top: 0.25rem;
    font-size: clamp(2rem, 6vw, 3.7rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 0.95;
  }
  .page-head > div:last-child > p:last-child {
    max-width: 45rem;
    margin-top: 0.65rem;
    color: var(--color-ink-600);
    line-height: 1.5;
  }
  .exam-layout {
    display: grid;
    grid-template-columns: minmax(17rem, 0.78fr) minmax(0, 1.22fr);
    gap: 1rem;
    align-items: start;
  }
  .setup-card,
  .readiness-card {
    padding: clamp(1rem, 3vw, 1.5rem);
  }
  .section-heading {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding-bottom: 0.9rem;
    border-bottom: 1px solid var(--color-line);
  }
  .section-heading > span {
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 850;
  }
  h2 {
    margin-top: 0.2rem;
    font-size: clamp(1.3rem, 3vw, 1.8rem);
    line-height: 1.05;
  }
  form {
    display: grid;
    gap: 1rem;
    margin-top: 1rem;
  }
  .field-label {
    display: grid;
    gap: 0.4rem;
  }
  .field-label > span,
  .time-choice legend {
    font-family: var(--font-mono);
    font-size: 0.67rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .time-choice {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.45rem;
    border: 0;
    margin: 0;
    padding: 0;
  }
  .time-choice legend {
    grid-column: 1 / -1;
    margin-bottom: 0.4rem;
  }
  .time-choice label {
    display: flex;
    min-height: 3rem;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border: 1px solid var(--color-line);
    border-radius: 0.35rem;
    background: white;
    cursor: pointer;
  }
  .time-choice input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .time-choice label:focus-within {
    outline: 3px solid var(--color-cobalt-700);
    outline-offset: 2px;
  }
  .time-choice label.selected {
    border-color: var(--color-ink-950);
    background: var(--color-accent-100);
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .saved-message {
    color: var(--color-mint-700);
    font-size: 0.78rem;
    font-weight: 750;
  }
  .remove-plan {
    display: grid;
    gap: 0.5rem;
    border-top: 1px solid var(--color-line);
    padding-top: 0.85rem;
  }
  .remove-plan p {
    color: var(--color-ink-800);
    font-size: 0.76rem;
    line-height: 1.4;
  }
  .remove-plan > div {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }
  .remove-trigger,
  .remove-confirm,
  .remove-cancel {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border-radius: 0.35rem;
    padding: 0.5rem 0.7rem;
    font-size: 0.74rem;
    font-weight: 800;
  }
  .remove-trigger {
    justify-self: start;
    color: var(--color-coral-700);
  }
  .remove-confirm {
    border: 1px solid var(--color-coral-700);
    color: white;
    background: var(--color-coral-700);
  }
  .remove-cancel {
    border: 1px solid var(--color-line);
    color: var(--color-ink-800);
    background: white;
  }
  .error-message {
    color: var(--color-coral-700);
    font-size: 0.78rem;
    font-weight: 750;
  }
  .readiness-head {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
  }
  .readiness-score {
    flex: none;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    background: var(--color-accent-100);
    padding: 0.55rem 0.7rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 850;
  }
  .readiness-bar {
    height: 0.65rem;
    overflow: hidden;
    margin-top: 1rem;
    border-radius: 999px;
    background: var(--color-paper-200);
  }
  .readiness-bar i {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--color-mint-700);
    transform: scaleX(var(--readiness));
    transform-origin: left;
    transition: transform 260ms var(--ease-out-emil);
  }
  .metric-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.55rem;
    margin-top: 1rem;
  }
  .metric-grid article {
    display: grid;
    min-width: 0;
    gap: 0.15rem;
    border: 1px solid var(--color-line);
    border-radius: 0.4rem;
    background: var(--color-paper-50);
    padding: 0.75rem;
  }
  .metric-grid :global(svg) {
    color: var(--color-cobalt-700);
  }
  .metric-grid strong {
    margin-top: 0.15rem;
    font-size: 1.45rem;
    line-height: 1;
  }
  .metric-grid span {
    color: var(--color-ink-600);
    font-size: 0.68rem;
  }
  .pace-warning {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    margin-top: 1rem;
    border: 1px solid var(--color-coral-700);
    border-radius: 0.45rem;
    color: var(--color-coral-800);
    background: var(--color-coral-50);
    padding: 0.75rem;
    font-size: 0.78rem;
    line-height: 1.45;
  }
  .pace-warning :global(svg) {
    flex: none;
    margin-top: 0.08rem;
  }
  .pace-warning strong {
    display: block;
  }
  .risk-zone {
    margin-top: 1.1rem;
    border-top: 1px solid var(--color-line);
    padding-top: 1rem;
  }
  .risk-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
  }
  .risk-heading h3 {
    margin-top: 0.2rem;
    font-size: 1.15rem;
  }
  .risk-heading > span {
    color: var(--color-coral-700);
    font-family: var(--font-mono);
    font-size: 0.67rem;
    font-weight: 800;
  }
  ul {
    display: grid;
    gap: 0.35rem;
    margin: 0.7rem 0 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    min-height: 2.85rem;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border: 1px solid var(--color-line);
    border-radius: 0.3rem;
    background: white;
    padding: 0.55rem 0.7rem;
  }
  li span {
    font-weight: 800;
  }
  li small {
    color: var(--color-ink-600);
    text-align: right;
  }
  .empty-scope,
  .ready-note {
    display: flex;
    align-items: start;
    gap: 0.6rem;
    margin-top: 1rem;
    border: 1px solid var(--color-line);
    border-radius: 0.35rem;
    background: var(--color-paper-50);
    padding: 0.85rem;
  }
  .empty-scope :global(svg) {
    flex: none;
    color: var(--color-orange-700);
  }
  .ready-note :global(svg) {
    flex: none;
    color: var(--color-mint-700);
  }
  .empty-scope p,
  .ready-note p {
    color: var(--color-ink-600);
    font-size: 0.78rem;
    line-height: 1.45;
  }
  .empty-scope strong,
  .ready-note strong {
    color: var(--color-ink-950);
  }
  .sprint-link {
    width: 100%;
    margin-top: 1rem;
  }
  .fsrs-note {
    margin-top: 0.7rem;
    color: var(--color-ink-600);
    font-size: 0.72rem;
    line-height: 1.45;
    text-align: center;
  }
  .empty-plan {
    display: grid;
    min-height: 25rem;
    place-items: center;
    align-content: center;
    text-align: center;
  }
  .empty-plan :global(svg) {
    color: var(--color-cobalt-700);
  }
  .empty-plan h2 {
    margin-top: 0.45rem;
  }
  .empty-plan > p:last-child {
    max-width: 28rem;
    margin-top: 0.6rem;
    color: var(--color-ink-600);
    line-height: 1.5;
  }
  @media (max-width: 760px) {
    .exam-layout {
      grid-template-columns: 1fr;
    }
    .readiness-card {
      grid-row: 1;
    }
    .setup-card {
      grid-row: 2;
    }
  }
  @media (max-width: 430px) {
    .metric-grid {
      grid-template-columns: 1fr;
    }
    .metric-grid article {
      grid-template-columns: auto auto 1fr;
      align-items: center;
      gap: 0.5rem;
    }
    .metric-grid strong {
      margin: 0;
      font-size: 1.1rem;
    }
  }
</style>
