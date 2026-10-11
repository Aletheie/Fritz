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

  const status = 'inline-flex items-center gap-[0.35rem] text-[0.8rem] text-ink-700';
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

<div class="mx-auto max-w-[1050px] p-[clamp(1rem,3vw,2.5rem)]">
  <header class="max-w-[45rem] pb-8 max-[700px]:pb-[1.6rem]">
    <span
      class="inline-block rounded-[5px] bg-cobalt-100 px-[0.55rem] py-[0.3rem] text-[0.8rem] font-[650] text-cobalt-700"
      >Beta · {caseFiles.length} {cs ? 'případy' : 'cases'}</span
    >
    <h1
      class="mt-4 mb-[0.85rem] text-[clamp(2rem,5vw,3.4rem)] leading-[1.05] font-[760] tracking-[-0.04em]"
    >
      {cs ? 'Jazykové případy' : 'Language cases'}
    </h1>
    <p class="m-0 max-w-[42rem] text-[1.1rem] leading-[1.65] text-ink-700 max-[700px]:text-[1rem]">
      {cs
        ? 'Rozpleť krátké příběhy pomocí německých zpráv. Porovnej stopy, prověř svou teorii a krok po kroku odhal, co se stalo.'
        : 'Unravel short stories through German messages. Compare clues, test your theory and uncover what happened, one step at a time.'}
    </p>
    <div
      class="mt-[1.3rem] flex flex-wrap items-center gap-[0.65rem] text-[0.85rem] font-semibold max-[700px]:gap-[0.35rem] max-[700px]:text-[0.75rem] [&>svg]:flex-none [&>svg]:text-ink-600"
      aria-label={cs ? 'Jak se hraje' : 'How to play'}
    >
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
    <div>
      {#each orderedCases as item (item.id)}
        {@const progress = $appStore.course.cases?.[item.id]}
        {@const resolved = Boolean(progress?.completedAt)}
        {@const inProgress = Boolean(progress && !resolved)}
        <article
          data-testid="case-entry"
          class="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-center gap-10 border-t border-line py-[2.2rem] max-[700px]:grid-cols-[minmax(0,1fr)] max-[700px]:gap-[1.4rem] max-[700px]:py-[1.7rem]"
          aria-labelledby={`case-${item.id}`}
        >
          <div>
            <div class="flex gap-[0.8rem] text-[0.8rem] text-ink-600">
              <span class="font-[750] text-ink-950">{item.level}</span><span
                >{item.minutes} min</span
              ><span
                >{item.reconstruction
                  ? cs
                    ? 'Detektivní příběh'
                    : 'Detective story'
                  : cs
                    ? 'Krátký případ'
                    : 'Short case'}</span
              >
            </div>
            <h2
              class="mt-[0.6rem] mb-[0.8rem] text-[clamp(1.45rem,3vw,1.9rem)] leading-[1.15] tracking-[-0.025em]"
              id={`case-${item.id}`}
            >
              {item.title[$motherTongue]}
            </h2>
            <p class="m-0 text-[0.98rem] leading-[1.65]">{item.introduction[$motherTongue]}</p>
            <p class="mt-3 mb-0 text-[0.82rem] leading-[1.65] text-ink-600">
              {item.focus[$motherTongue]}
            </p>
            <div class="mt-[1.3rem] flex flex-wrap items-center gap-4">
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
              {#if resolved}<span class={status}
                  ><Check size={15} aria-hidden="true" />{cs ? 'Vyřešeno' : 'Solved'}</span
                >
              {:else if inProgress && progress}<span class={status}
                  >{cs
                    ? `Krok ${progress.stepIndex + 1} ze 3`
                    : `Step ${progress.stepIndex + 1} of 3`}</span
                >{/if}
            </div>
          </div>
          <aside
            class="rounded-xl border border-line bg-paper-50 p-6 max-[700px]:px-[1.2rem] max-[700px]:py-4"
            aria-label={cs ? 'Úryvek z případu' : 'A glimpse of the case'}
          >
            <MessageSquare
              class="text-cobalt-700 max-[700px]:hidden"
              size={20}
              aria-hidden="true"
            />
            <blockquote
              class="my-4 text-[clamp(1.05rem,2vw,1.3rem)] leading-[1.6] font-[550] max-[700px]:mt-0 max-[700px]:text-[1.05rem]"
              lang="de"
            >
              {item.previewDe}
            </blockquote>
            <span class="text-[0.8rem] text-ink-600" lang="de"
              >{item.documents.find((document) =>
                document.lines.some((line) => line.textDe === item.previewDe),
              )?.bylineDe}</span
            >
          </aside>
        </article>
      {/each}
    </div>
    <footer
      class="border-t border-line pt-6 [&_p]:mt-0 [&_p]:mb-[0.4rem] [&_p]:text-[0.82rem] [&_p]:leading-[1.6] [&_p]:text-ink-600"
    >
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
