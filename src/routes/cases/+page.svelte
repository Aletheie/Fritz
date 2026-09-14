<script lang="ts">
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { caseFiles } from '$lib/domain/cases/catalog.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import { onMount } from 'svelte';

  let loadFailed = $state(false);
  const cs = $derived($motherTongue === 'cs');
  const orderedCases = caseFiles.toSorted(
    (a, b) => Number(Boolean(b.reconstruction)) - Number(Boolean(a.reconstruction)),
  );
  const recommended = $derived(
    orderedCases.find(
      (item) => $appStore.course.cases?.[item.id] && !$appStore.course.cases[item.id]?.completedAt,
    )?.id ?? orderedCases.find((item) => !$appStore.course.cases?.[item.id]?.firstCompletedAt)?.id,
  );
  async function initialize() {
    loadFailed = false;
    try {
      await appStore.initialize();
    } catch {
      loadFailed = true;
    }
  }
  onMount(() => {
    void initialize();
  });
</script>

<svelte:head>
  <title>{cs ? 'Jazykové případy' : 'Language cases'} · Fritz</title>
  <meta
    name="description"
    content={cs
      ? 'Krátké případy v němčině. Sleduj stopy, odhal rozpory ve zprávách a rozlušti záhadu prázdného rámu.'
      : 'Short cases in German. Follow clues, uncover contradictions and solve the mystery of the empty frame.'}
  />
</svelte:head>

<div class="case-catalog">
  <header class="catalog-intro">
    <span class="beta">Beta · {caseFiles.length} {cs ? 'případy' : 'cases'}</span>
    <h1>{cs ? 'Jazykové případy' : 'Language cases'}</h1>
    <p>
      {cs
        ? 'Rozpleť krátké příběhy pomocí německých zpráv. Porovnej stopy, prověř svou teorii a krok po kroku odhal, co se stalo.'
        : 'Unravel short stories through German messages. Compare clues, test your theory and uncover what happened, one step at a time.'}
    </p>
    <div class="how-it-works" aria-label={cs ? 'Jak se hraje' : 'How to play'}>
      <span>{cs ? 'Přečti podklady' : 'Read the documents'}</span><ArrowRight
        size={15}
        aria-hidden="true"
      />
      <span>{cs ? 'Sestav teorii' : 'Form a theory'}</span><ArrowRight
        size={15}
        aria-hidden="true"
      />
      <span>{cs ? 'Dolož ji stopami v textu' : 'Support it with clues in the text'}</span>
    </div>
  </header>

  {#if loadFailed}
    <div role="alert">
      <p>{cs ? 'Postup se nepodařilo načíst.' : 'Your progress could not be loaded.'}</p>
      <button class="btn-base btn-secondary" onclick={() => void initialize()}
        >{cs ? 'Načíst znovu' : 'Try again'}</button
      >
    </div>
  {:else if !$appStore.ready}
    <LoadingState />
  {:else}
    <div class="case-list">
      {#each orderedCases as item}
        {@const progress = $appStore.course.cases?.[item.id]}
        {@const resolved = Boolean(progress?.completedAt)}
        {@const inProgress = Boolean(progress && !resolved)}
        <article class="case-entry" aria-labelledby={`case-${item.id}`}>
          <div class="case-description">
            <div class="case-meta">
              <span>{item.level}</span><span>{item.minutes} min</span><span
                >{item.reconstruction
                  ? cs
                    ? 'Detektivní příběh'
                    : 'Detective story'
                  : cs
                    ? 'Krátký případ'
                    : 'Short case'}</span
              >
            </div>
            <h2 id={`case-${item.id}`}>{item.title[$motherTongue]}</h2>
            <p>{item.introduction[$motherTongue]}</p>
            <p class="focus">{item.focus[$motherTongue]}</p>
            <div class="entry-action">
              <a
                class={item.id === recommended ? 'btn-base btn-primary' : 'btn-base btn-secondary'}
                href={`/cases/${item.id}/`}
                aria-label={`${resolved ? (cs ? 'Prohlédnout řešení' : 'Review the solution') : inProgress ? (cs ? 'Pokračovat' : 'Continue') : cs ? 'Otevřít případ' : 'Open case'}: ${item.title[$motherTongue]}`}
              >
                {resolved
                  ? cs
                    ? 'Prohlédnout řešení'
                    : 'Review the solution'
                  : inProgress
                    ? cs
                      ? 'Pokračovat'
                      : 'Continue'
                    : cs
                      ? 'Otevřít případ'
                      : 'Open case'}<ArrowRight size={17} aria-hidden="true" />
              </a>
              {#if resolved}<span class="case-status"
                  ><Check size={15} aria-hidden="true" />{cs ? 'Vyřešeno' : 'Solved'}</span
                >
              {:else if inProgress && progress}<span class="case-status"
                  >{cs
                    ? `Krok ${progress.stepIndex + 1} ze 3`
                    : `Step ${progress.stepIndex + 1} of 3`}</span
                >{/if}
            </div>
          </div>
          <aside
            class="message-preview"
            aria-label={cs ? 'Úryvek z případu' : 'A glimpse of the case'}
          >
            <MessageSquare size={20} aria-hidden="true" />
            <blockquote lang="de">{item.previewDe}</blockquote>
            <span lang="de"
              >{item.documents.find((document) =>
                document.lines.some((line) => line.textDe === item.previewDe),
              )?.bylineDe}</span
            >
          </aside>
        </article>
      {/each}
    </div>
    <footer>
      <p>
        {cs
          ? 'Vlastním tempem, se slovní pomocí. K řešení máš všechny potřebné stopy v podkladech.'
          : 'At your own pace, with vocabulary support. Every clue you need is in the documents.'}
      </p>
      <p>
        {cs
          ? 'Postup se ukládá do zařízení a je součástí zálohy. Postavy a podklady jsou smyšlené.'
          : 'Progress is saved on this device and included in backups. The characters and documents are fictional.'}
      </p>
    </footer>
  {/if}
</div>

<style>
  .case-catalog {
    max-width: 1050px;
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 2.5rem);
  }
  .catalog-intro {
    padding-bottom: 2rem;
    max-width: 45rem;
  }
  .beta {
    display: inline-block;
    font-size: 0.8rem;
    font-weight: 650;
    color: var(--color-cobalt-700);
    background: var(--color-cobalt-100);
    padding: 0.3rem 0.55rem;
    border-radius: 5px;
  }
  h1 {
    margin: 1rem 0 0.85rem;
    font-size: clamp(2rem, 5vw, 3.4rem);
    line-height: 1.05;
    letter-spacing: -0.04em;
    font-weight: 760;
  }
  .catalog-intro > p {
    font-size: 1.1rem;
    line-height: 1.65;
    max-width: 42rem;
    margin: 0;
    color: var(--color-ink-700);
  }
  .how-it-works {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.65rem;
    margin-top: 1.3rem;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .how-it-works :global(svg) {
    color: var(--color-ink-600);
    flex: none;
  }
  .case-entry {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    gap: 2.5rem;
    padding: 2.2rem 0;
    border-top: 1px solid var(--color-line);
    align-items: center;
  }
  .case-meta {
    display: flex;
    gap: 0.8rem;
    color: var(--color-ink-600);
    font-size: 0.8rem;
  }
  .case-meta span:first-child {
    font-weight: 750;
    color: var(--color-ink-950);
  }
  h2 {
    margin: 0.6rem 0 0.8rem;
    font-size: clamp(1.45rem, 3vw, 1.9rem);
    letter-spacing: -0.025em;
    line-height: 1.15;
  }
  .case-description > p {
    font-size: 0.98rem;
    line-height: 1.65;
    margin: 0;
  }
  .case-description > p.focus {
    font-size: 0.82rem;
    color: var(--color-ink-600);
    margin-top: 0.75rem;
  }
  .entry-action {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 1.3rem;
  }
  .case-status {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
    font-size: 0.8rem;
    color: var(--color-ink-700);
  }
  .message-preview {
    background: var(--color-paper-50);
    border: 1px solid var(--color-line);
    border-radius: 12px;
    padding: 1.5rem;
  }
  .message-preview > :global(svg) {
    color: var(--color-cobalt-700);
  }
  blockquote {
    margin: 1rem 0;
    font-size: clamp(1.05rem, 2vw, 1.3rem);
    line-height: 1.6;
    font-weight: 550;
  }
  .message-preview > span {
    font-size: 0.8rem;
    color: var(--color-ink-600);
  }
  footer {
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-line);
  }
  footer p {
    margin: 0 0 0.4rem;
    font-size: 0.82rem;
    color: var(--color-ink-600);
    line-height: 1.6;
  }
  @media (max-width: 699px) {
    .case-entry {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.4rem;
      padding: 1.7rem 0;
    }
    .message-preview {
      padding: 1rem 1.2rem;
    }
    .message-preview > :global(svg) {
      display: none;
    }
    blockquote {
      margin-top: 0;
      font-size: 1.05rem;
    }
    .catalog-intro {
      padding-bottom: 1.6rem;
    }
    .catalog-intro > p {
      font-size: 1rem;
    }
    .how-it-works {
      font-size: 0.75rem;
      gap: 0.35rem;
    }
  }
</style>
