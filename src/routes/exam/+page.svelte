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

  const monoLabel = 'font-mono text-[0.67rem] font-extrabold tracking-[0.05em] uppercase';
  const card = 'surface p-[clamp(1rem,3vw,1.5rem)]';
  const heading2 = 'mt-[0.2rem] text-[clamp(1.3rem,3vw,1.8rem)] leading-[1.05]';
  const smallButton =
    'inline-flex min-h-11 items-center justify-center gap-[0.4rem] rounded-[0.35rem] px-[0.7rem] py-2 text-[0.74rem] font-extrabold';
  const noteBox =
    'mt-4 flex items-start gap-[0.6rem] rounded-[0.35rem] border border-line bg-paper-50 p-[0.85rem] [&_p]:text-[0.78rem] [&_p]:leading-[1.45] [&_p]:text-ink-600 [&_strong]:text-ink-950';
  const metric =
    'grid min-w-0 gap-[0.15rem] rounded-[0.4rem] border border-line bg-paper-50 p-3 max-[431px]:grid-cols-[auto_auto_1fr] max-[431px]:items-center max-[431px]:gap-2 [&>span]:text-[0.68rem] [&>span]:text-ink-600 [&>strong]:mt-[0.15rem] [&>strong]:text-[1.45rem] [&>strong]:leading-none max-[431px]:[&>strong]:m-0 max-[431px]:[&>strong]:text-[1.1rem] [&>svg]:text-cobalt-700';
</script>

<svelte:head>
  <title>Plán na písemku · Fritz</title>
  <meta name="description" content="Naplánuj si opakování slovíček na německou písemku." />
</svelte:head>

{#if !ready || !$appStore.settings}
  <LoadingState label="Počítám připravenost…" />
{:else}
  <div class="mx-auto w-[min(100%,70rem)] pb-8">
    <header class="mb-[1.2rem] grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
      <div
        class="grid size-[3.4rem] place-items-center rounded-[0.45rem_1rem_0.45rem_0.45rem] border border-ink-950 bg-acid-500 shadow-[3px_3px_0_var(--color-ink-950)]"
      >
        <CalendarCheck size={27} aria-hidden="true" />
      </div>
      <div>
        <p class="kicker">krátkodobý cíl</p>
        <h1 class="mt-1 text-[clamp(2rem,6vw,3.7rem)] leading-[0.95] font-black tracking-[-0.04em]">
          Plán na písemku
        </h1>
        <p class="mt-[0.65rem] max-w-[45rem] leading-normal text-ink-600">
          Vyber datum písemky a slovíčka, která potřebuješ umět.
        </p>
      </div>
    </header>

    <div
      class="grid grid-cols-[minmax(17rem,0.78fr)_minmax(0,1.22fr)] items-start gap-4 max-[761px]:grid-cols-1"
    >
      <section class="{card} max-[761px]:row-start-2" aria-labelledby="setup-title">
        <div class="flex items-center gap-[0.65rem] border-b border-line pb-[0.9rem]">
          <span class="font-mono text-[0.65rem] font-[850] text-cobalt-700">01</span>
          <div>
            <p class="kicker">nastavení</p>
            <h2 class={heading2} id="setup-title">Co musí být hotové</h2>
          </div>
        </div>
        <form
          class="mt-4 grid gap-4"
          onsubmit={(event) => {
            event.preventDefault();
            void savePlan();
          }}
        >
          <label class="grid gap-[0.4rem]">
            <span class={monoLabel}>Datum písemky</span>
            <input class="field" type="date" min={localDateKey()} bind:value={examDate} required />
          </label>
          <label class="grid gap-[0.4rem]">
            <span class={monoLabel}>Rozsah látky</span>
            <select class="field" bind:value={selectedTag}>
              <option value="all">Všechna slovíčka ({$appStore.notes.length})</option>
              {#each tags as tag}
                <option value={tag}
                  >{tag} ({examPlanScopeNotes($appStore.notes, tag).length})</option
                >
              {/each}
            </select>
          </label>
          <fieldset class="m-0 grid grid-cols-3 gap-[0.45rem] border-0 p-0">
            <legend class="{monoLabel} col-span-full mb-[0.4rem]">Čas denně</legend>
            {#each timeOptions as option}
              <label
                class={[
                  'flex min-h-12 cursor-pointer items-center justify-center gap-[0.35rem] rounded-[0.35rem] border focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-cobalt-700',
                  dailyMinutes === option
                    ? 'border-ink-950 bg-accent-100 shadow-[2px_2px_0_var(--color-ink-950)]'
                    : 'border-line bg-white',
                ]}
              >
                <input
                  class="absolute size-px opacity-0"
                  type="radio"
                  name="daily-minutes"
                  value={option}
                  bind:group={dailyMinutes}
                />
                <Clock3 size={18} aria-hidden="true" /><strong>{option} min</strong>
              </label>
            {/each}
          </fieldset>
          <button class="btn-base btn-primary" type="submit" disabled={saving || !examDate}>
            {saving ? 'Ukládám…' : plan ? 'Přepočítat plán' : 'Vytvořit plán'}
          </button>
          {#if plan}
            <div class="grid gap-2 border-t border-line pt-[0.85rem]">
              {#if confirmRemoval}
                <p class="text-[0.76rem] leading-[1.4] text-ink-800">
                  Opravdu zrušit jen krátkodobý plán?
                </p>
                <div class="flex flex-wrap gap-[0.45rem]">
                  <button
                    class="{smallButton} border border-coral-700 bg-coral-700 text-white"
                    type="button"
                    disabled={removing}
                    onclick={() => void removePlan()}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    {removing ? 'Ruším…' : 'Ano, zrušit plán'}
                  </button>
                  <button
                    class="{smallButton} border border-line bg-white text-ink-800"
                    type="button"
                    disabled={removing}
                    onclick={() => (confirmRemoval = false)}
                  >
                    Nechat plán
                  </button>
                </div>
              {:else}
                <button
                  class="{smallButton} justify-self-start text-coral-700"
                  type="button"
                  onclick={() => (confirmRemoval = true)}
                >
                  <Trash2 size={16} aria-hidden="true" /> Zrušit plán
                </button>
              {/if}
            </div>
          {/if}
          {#if savedMessage}<p class="text-[0.78rem] font-[750] text-mint-700" role="status">
              {savedMessage}
            </p>{/if}
          {#if errorMessage}<p class="text-[0.78rem] font-[750] text-coral-700" role="alert">
              {errorMessage}
            </p>{/if}
        </form>
      </section>

      <section class="{card} max-[761px]:row-start-1" aria-labelledby="readiness-title">
        {#if plan && readiness}
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="kicker">připravenost na {formatDate(plan.examDate)}</p>
              <h2 class={heading2} id="readiness-title">{readiness.percent} % opravdu vybaveno</h2>
            </div>
            <div
              class="flex-none rounded-full border border-ink-950 bg-accent-100 px-[0.7rem] py-[0.55rem] font-mono text-[0.72rem] font-[850]"
              aria-hidden="true"
            >
              {readiness.ready}/{readiness.total}
            </div>
          </div>
          <div
            class="mt-4 h-[0.65rem] overflow-hidden rounded-full bg-paper-200"
            role="progressbar"
            aria-label="Slovíčka vybavená bez nápovědy"
            aria-valuemin="0"
            aria-valuemax={readiness.total}
            aria-valuenow={readiness.ready}
          >
            <i
              class="block h-full w-full origin-left bg-mint-700 transition-transform duration-260 ease-out-emil"
              style:transform={`scaleX(${readiness.percent / 100})`}
            ></i>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-[0.55rem] max-[431px]:grid-cols-1">
            <article class={metric}>
              <CalendarCheck size={18} aria-hidden="true" />
              <strong>{readiness.daysRemaining}</strong><span>dní zbývá</span>
            </article>
            <article class={metric}>
              <Brain size={18} aria-hidden="true" />
              <strong>{readiness.dailyTarget}</strong><span>slov denně</span>
            </article>
            <article class={metric}>
              <ShieldCheck size={18} aria-hidden="true" />
              <strong>{readiness.unassistedReviewed}</strong><span>bez nápovědy</span>
            </article>
          </div>

          {#if !readiness.feasible}
            <div
              class="mt-4 flex items-start gap-[0.65rem] rounded-[0.45rem] border border-coral-700 bg-coral-50 p-3 text-[0.78rem] leading-[1.45] text-coral-800"
              role="alert"
            >
              <AlertTriangle class="mt-[0.08rem] flex-none" size={20} aria-hidden="true" />
              <p>
                <strong class="block">Plán se do zvoleného času nevejde.</strong>
                Potřebuješ přibližně {readiness.dailyTarget} slov denně, ale za {plan.dailyMinutes}
                minut je reálných asi {readiness.dailyCapacity}. Zvyš čas nebo zúž rozsah.
              </p>
            </div>
          {/if}

          {#if readiness.total === 0}
            <div class={noteBox}>
              <AlertTriangle class="flex-none text-orange-700" size={20} aria-hidden="true" />
              <p>
                <strong>V tomto rozsahu zatím nejsou slovíčka.</strong> Přidej je nebo zvol jiný štítek.
              </p>
            </div>
          {:else if readiness.riskNoteIds.length === 0}
            <div class={noteBox}>
              <CheckCircle2 class="flex-none text-mint-700" size={21} aria-hidden="true" />
              <p>
                <strong>Máš připraveno.</strong> U všech slov proběhl poslední pokus bez nápovědy.
              </p>
            </div>
          {:else}
            <div class="mt-[1.1rem] border-t border-line pt-4">
              <div class="flex items-end justify-between gap-4">
                <div>
                  <p class="kicker">největší riziko</p>
                  <h3 class="mt-[0.2rem] text-[1.15rem]">Těmito slovy začni</h3>
                </div>
                <span class="font-mono text-[0.67rem] font-extrabold text-coral-700"
                  >{readiness.riskNoteIds.length} zbývá</span
                >
              </div>
              <ul class="mt-[0.7rem] mb-0 grid list-none gap-[0.35rem] p-0">
                {#each riskNotes as note}
                  <li
                    class="flex min-h-[2.85rem] items-center justify-between gap-4 rounded-[0.3rem] border border-line bg-white px-[0.7rem] py-[0.55rem]"
                  >
                    <span class="font-extrabold" lang="de"
                      >{note.article ? `${note.article} ` : ''}{note.german}</span
                    >
                    <small class="text-right text-ink-600">{note.czech}</small>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if readiness.total > 0}
            <a class="btn-base btn-primary mt-4 w-full" href={sprintHref}>
              Spustit dnešní sprint <ArrowRight size={18} aria-hidden="true" />
            </a>
          {:else}
            <button class="btn-base btn-primary mt-4 w-full" type="button" disabled>
              Spustit dnešní sprint <ArrowRight size={18} aria-hidden="true" />
            </button>
          {/if}
          <p class="mt-[0.7rem] text-center text-[0.72rem] leading-[1.45] text-ink-600">
            Sprint ti pomůže s přípravou na písemku. Běžné termíny opakování se tím nemění.
          </p>
        {:else}
          <div class="grid min-h-[25rem] place-items-center content-center text-center">
            <CalendarCheck class="text-cobalt-700" size={42} aria-hidden="true" />
            <p class="kicker">připravenost</p>
            <h2 class="{heading2} mt-[0.45rem]" id="readiness-title">
              Nejdřív ulož datum a rozsah
            </h2>
            <p class="mt-[0.6rem] max-w-md leading-normal text-ink-600">
              Pak uvidíš, kolik slov si každý den zopakovat a která potřebují víc procvičit.
            </p>
          </div>
        {/if}
      </section>
    </div>
  </div>
{/if}
