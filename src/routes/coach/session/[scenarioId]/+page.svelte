<script lang="ts">
  import { page } from '$app/state';
  import CoachComposer from '$lib/components/coach/CoachComposer.svelte';
  import CoachFeedbackCard from '$lib/components/coach/CoachFeedbackCard.svelte';
  import CoachMessage from '$lib/components/coach/CoachMessage.svelte';
  import CoachMissionPanel from '$lib/components/coach/CoachMissionPanel.svelte';
  import CoachSessionComplete from '$lib/components/coach/CoachSessionComplete.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { coachScenarioById } from '$lib/domain/course/coach.ts';
  import { coursePathNodeById, coursePathNodeState } from '$lib/domain/course/path.ts';
  import { errorText } from '$lib/domain/errors.ts';
  import { coachScenarioCopy } from '$lib/i18n/coach.ts';
  import { appStore, dueCards, motherTongue, tr } from '$lib/state/app';
  import { ConversationController } from '$lib/state/conversation.svelte.ts';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import { onMount, tick } from 'svelte';

  const conversation = new ConversationController();
  let message = $state('');
  let awardedXp = $state(0);
  let pathXp = $state(0);
  let chatElement = $state<HTMLDivElement | undefined>(undefined);
  let inputElement = $state<HTMLInputElement | undefined>(undefined);
  let initializedScenarioId = $state('');
  let completionSaved = $state(false);
  let savingCompletion = $state(false);
  let failedMessage = $state('');

  const rawScenario = $derived(coachScenarioById(page.params.scenarioId ?? ''));
  const scenario = $derived(
    rawScenario ? coachScenarioCopy(rawScenario, $motherTongue) : undefined,
  );
  const requestedPathNodeId = $derived(page.url.searchParams.get('path') ?? undefined);
  const pathNode = $derived(
    requestedPathNodeId ? coursePathNodeById(requestedPathNodeId) : undefined,
  );
  const pathNodeId = $derived(
    pathNode?.type === 'coach' && pathNode.coachScenarioId === scenario?.id
      ? pathNode.id
      : undefined,
  );
  const pathNodeState = $derived(
    pathNode
      ? coursePathNodeState($appStore.course, pathNode, $appStore.settings?.grammarLevel ?? 'A1.1')
      : undefined,
  );
  const pathAccessLocked = $derived(
    Boolean(pathNodeId && $appStore.ready && pathNodeState === 'locked'),
  );
  const returnHref = $derived(pathNodeId ? '/' : '/coach/');
  const noteById = $derived(new Map($appStore.notes.map((note) => [note.id, note])));
  const weakWords = $derived(
    $dueCards
      .slice(0, 5)
      .map((card) => noteById.get(card.noteId)?.german)
      .filter((word): word is string => Boolean(word)),
  );
  const focusWords = $derived.by(() =>
    [...new Set([...(scenario?.focusWords ?? []), ...weakWords])].slice(0, 4),
  );
  const completedTurns = $derived(conversation.completedTurns);
  const currentTurn = $derived(Math.min(scenario?.turns ?? 3, completedTurns + 1));
  const averageScore = $derived(conversation.averageScore);
  const progress = $derived(scenario ? Math.round((completedTurns / scenario.turns) * 100) : 0);
  const guidedHint = $derived(
    scenario?.guidedHints?.[Math.min(completedTurns, Math.max(0, scenario.guidedHints.length - 1))],
  );
  const sessionComplete = $derived(conversation.complete);
  const messages = $derived(conversation.messages);
  const latestResult = $derived(conversation.latestResult);
  const sending = $derived(conversation.sending);
  const latestDiagnosticsIgnored = $derived(
    conversation.turns.find((turn) => turn.id === conversation.latestTurnId)?.diagnosticsIgnored ??
      false,
  );

  onMount(() => {
    let cancelled = false;
    void (async () => {
      try {
        await appStore.initialize();
      } catch (error) {
        if (!cancelled) {
          failedMessage = errorText(error, $motherTongue, {
            cs: 'Konverzaci se nepodařilo připravit.',
            en: 'The conversation could not be prepared.',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
      conversation.destroy();
    };
  });

  $effect(() => {
    if (!$appStore.ready || !scenario || initializedScenarioId === scenario.id) return;
    initializedScenarioId = scenario.id;
    restart();
    if (pathNodeId && !pathAccessLocked) {
      void appStore.startPathNode(pathNodeId).catch((error: unknown) => {
        failedMessage = errorText(error, $motherTongue, {
          cs: 'Kurzový krok se nepodařilo otevřít.',
          en: 'The course step could not be opened.',
        });
      });
    }
  });

  function restart(): void {
    if (!scenario) return;
    conversation.start({
      mode: 'conversation',
      scenario,
      motherTongue: $motherTongue,
      focusWords,
      turnsTarget: scenario.turns,
    });
    message = '';
    failedMessage = '';
    awardedXp = 0;
    pathXp = 0;
    completionSaved = false;
    savingCompletion = false;
    void tick().then(() => {
      inputElement?.focus();
      return undefined;
    });
  }

  async function scrollChat(): Promise<void> {
    await tick();
    if (chatElement) {
      chatElement.scrollTo({
        top: chatElement.scrollHeight,
        behavior: $appStore.settings?.reduceMotion ? 'auto' : 'smooth',
      });
    }
  }

  function usePrompt(prompt: string): void {
    message = prompt;
    inputElement?.focus();
  }

  async function sendMessage(): Promise<void> {
    if (!scenario || conversation.sending || sessionComplete || message.trim().length < 2) return;
    const text = message.trim();
    message = '';
    failedMessage = '';
    if ('vibrate' in navigator) navigator.vibrate(10);
    await scrollChat();

    try {
      const result = await conversation.send(text);
      if ('vibrate' in navigator) navigator.vibrate(result.accepted ? 18 : [12, 42, 12]);
      await scrollChat();
      if (!conversation.complete) {
        await tick();
        inputElement?.focus();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      message = conversation.failedDraft || text;
      failedMessage =
        conversation.error && $motherTongue === 'cs'
          ? conversation.error
          : $tr('Trenér teď nedokázal odpovědět.', 'The coach could not respond right now.');
      await tick();
      inputElement?.focus();
    }
  }

  async function persistCompletion(): Promise<void> {
    if (!scenario || !sessionComplete || completionSaved || savingCompletion) return;
    savingCompletion = true;
    failedMessage = '';
    try {
      const saved = await appStore.completeCoachSession({
        scenarioId: scenario.id,
        score: averageScore,
        turns: scenario.turns,
        independentTurns: conversation.independentTurns,
        mistakeTags: conversation.activeDiagnostics().map((diagnostic) => diagnostic.tag),
        pathNodeId,
      });
      awardedXp = saved.event.xpAwarded;
      pathXp = saved.pathCompletion?.xpAwarded ?? 0;
      completionSaved = true;
    } catch (error) {
      failedMessage = errorText(error, $motherTongue, {
        cs: 'Výsledek se nepodařilo uložit.',
        en: 'The result could not be saved.',
      });
    } finally {
      savingCompletion = false;
    }
  }

  const notice = 'grid min-h-dvh place-items-center p-6 text-center';
  const noticeTitle = 'mt-2 mb-6 text-[2rem] font-black tracking-[-0.04em]';
  const gutter = 'min-[860px]:px-[1.2rem]';
</script>

<svelte:head>
  <title
    >{scenario
      ? `${scenario.title} · ${$tr('AI trenér', 'AI coach')}`
      : $tr('Scénář nenalezen', 'Scenario not found')} · Fritz</title
  >
  <meta
    name="description"
    content={$tr(
      'Krátký situační rozhovor v němčině s okamžitou zpětnou vazbou.',
      'A short situational conversation in German with instant feedback.',
    )}
  />
</svelte:head>

{#if !$appStore.ready}
  <div class="grid min-h-dvh place-items-center">
    <LoadingState label={$tr('Připravuji konverzaci…', 'Preparing the conversation…')} />
  </div>
{:else if !scenario}
  <main class={notice}>
    <div>
      <p class="kicker">{$tr('Scénář nenalezen', 'Scenario not found')}</p>
      <h1 class={noticeTitle}>
        {$tr('Tahle konverzace neexistuje.', 'This conversation does not exist.')}
      </h1>
      <a class="btn-base btn-primary" href={returnHref}
        ><ArrowLeft size={18} /> {$tr('Zpět', 'Back')}</a
      >
    </div>
  </main>
{:else if pathAccessLocked}
  <main class={notice}>
    <div
      class="w-[min(100%,31rem)] rounded-[0.45rem_1.45rem_0.45rem_0.45rem] border border-ink-950 bg-paper-50 p-[clamp(1.3rem,5vw,2.25rem)] shadow-[6px_6px_0_var(--color-ink-950)]"
    >
      <span
        class="mx-auto mb-3 grid size-14 place-items-center rounded-[0.35rem_1rem_0.35rem_0.35rem] border border-ink-950 bg-paper-200"
        ><LockKeyhole size={28} /></span
      >
      <p class="kicker">{$tr('Zamčený krok cesty', 'Locked course step')}</p>
      <h1 class={noticeTitle}>{scenario.title}</h1>
      <p class="mx-auto mt-0 mb-[1.2rem] leading-[1.55] text-ink-600">
        {$tr(
          'Tahle lekce se odemkne po dokončení předchozího kroku.',
          'This lesson unlocks when you finish the previous step.',
        )}
      </p>
      <a class="btn-base btn-primary" href="/"
        ><ArrowLeft size={18} /> {$tr('Zpět na dnešní cestu', "Back to today's path")}</a
      >
    </div>
  </main>
{:else}
  <main class="grid h-dvh grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-paper-100 text-ink-950">
    <header
      class="grid grid-cols-[auto_minmax(0,1fr)_minmax(6.5rem,10rem)] items-center gap-[0.7rem] border-b border-ink-950 bg-paper-50 px-[0.7rem] pt-[calc(0.55rem+var(--safe-top))] pb-[0.65rem] min-[860px]:grid-cols-[auto_minmax(0,1fr)_minmax(10rem,13rem)] min-[860px]:px-4"
    >
      <a
        href={returnHref}
        class="grid size-[2.65rem] place-items-center rounded-[0.45rem_0.9rem_0.45rem_0.45rem] border border-ink-950 bg-white shadow-[2px_2px_0_var(--color-ink-950)] [transition:transform_140ms_var(--ease-out-emil),box-shadow_140ms_var(--ease-out-emil)] active:[transform:scale(0.96)] active:shadow-[0_0_0_var(--color-ink-950)]"
        aria-label={$tr('Ukončit konverzaci', 'End conversation')}><ArrowLeft size={20} /></a
      >
      <div class="min-w-0">
        <p
          class="m-0 truncate font-mono text-[0.51rem] font-extrabold tracking-[0.055em] text-ink-600 uppercase"
        >
          {scenario.eyebrow}
        </p>
        <h1 class="mt-[0.12rem] truncate text-[0.88rem] font-[880] tracking-[-0.025em]">
          {scenario.title}
        </h1>
      </div>
      <div
        class="grid gap-[0.28rem]"
        aria-label={$tr(`Dokončeno ${progress} procent`, `${progress} percent complete`)}
      >
        <span class="justify-self-end font-mono text-[0.57rem] font-[850]"
          >{completedTurns}/{scenario.turns}</span
        >
        <div class="h-[0.45rem] overflow-hidden rounded-full border border-ink-950 bg-paper-200">
          <i
            class="block h-full w-full origin-left bg-acid-500 [transition:transform_260ms_var(--ease-out-emil)]"
            style:transform={`scaleX(${progress / 100})`}
          ></i>
        </div>
      </div>
    </header>

    <section class="grid min-h-0 min-[860px]:grid-cols-[18rem_minmax(0,1fr)]">
      <CoachMissionPanel {scenario} {focusWords} onuse={usePrompt} />

      <div class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
        <div
          class="flex items-center justify-between gap-2 border-b border-line bg-[color-mix(in_srgb,var(--color-paper-50)_88%,transparent)] px-3 py-[0.55rem] {gutter}"
        >
          <span class="font-mono text-[0.58rem] font-[850] tracking-[0.04em] uppercase"
            >{$tr(
              `Replika ${currentTurn} z ${scenario.turns}`,
              `Turn ${currentTurn} of ${scenario.turns}`,
            )}</span
          >
          <small class="truncate text-[0.56rem] font-bold text-ink-600"
            >{$tr('Ty', 'You')}: {scenario.learnerRole} · AI: {scenario.coachRole}</small
          >
        </div>

        <div
          class="min-h-0 scroll-pb-4 overflow-y-auto overscroll-contain px-3 pt-[0.8rem] pb-4 {gutter}"
          bind:this={chatElement}
          aria-live="polite"
        >
          <div
            class="mx-auto mb-[0.9rem] max-w-[34rem] rounded-[0.7rem] border border-dashed border-line bg-[rgb(255_253_245/0.65)] px-3 py-[0.65rem] text-center"
          >
            <p class="m-0 text-[0.65rem] leading-[1.45] text-ink-600">{scenario.description}</p>
            <span class="mt-[0.3rem] block text-[0.62rem] font-[760]">{scenario.openingCs}</span>
          </div>

          {#each messages as item (item.id)}
            <CoachMessage role={item.role} text={item.text} />
          {/each}

          {#if sending}
            <CoachMessage role="coach" text={conversation.draftReply || undefined} />
          {/if}

          {#if latestResult && !sessionComplete}
            <CoachFeedbackCard
              result={latestResult}
              canDispute={Boolean(conversation.latestTurnId)}
              disputed={latestDiagnosticsIgnored}
              ontoggledispute={() =>
                latestDiagnosticsIgnored
                  ? conversation.restoreDiagnostics(conversation.latestTurnId!)
                  : conversation.ignoreDiagnostics(conversation.latestTurnId!)}
            />
          {/if}

          {#if failedMessage}
            <div
              class="mx-auto my-2 flex max-w-[42rem] items-center justify-between gap-[0.7rem] rounded-[0.6rem] border border-[color-mix(in_srgb,var(--color-coral-700)_36%,transparent)] bg-coral-50 p-[0.7rem] text-[0.68rem] font-[750] text-coral-700"
              role="alert"
            >
              <span>{failedMessage}</span>
              <button
                class="flex-none rounded-[0.4rem] border border-current bg-white px-[0.55rem] py-[0.38rem] text-[0.61rem] font-[850] [transition:transform_140ms_var(--ease-out-emil)] active:[transform:scale(0.97)]"
                type="button"
                onclick={() => void sendMessage()}
                disabled={sending}>{$tr('Zkusit znovu', 'Try again')}</button
              >
            </div>
          {/if}
        </div>

        {#if !sessionComplete}
          <CoachComposer
            bind:value={message}
            bind:input={inputElement}
            turn={currentTurn}
            hint={guidedHint}
            starters={completedTurns === 0 ? scenario.starterPrompts.slice(0, 2) : []}
            {sending}
            onsubmit={() => void sendMessage()}
          />
        {/if}
      </div>
    </section>

    {#if sessionComplete}
      <CoachSessionComplete
        {conversation}
        turns={scenario.turns}
        saved={completionSaved}
        saving={savingCompletion}
        rewarded={awardedXp + pathXp > 0}
        celebrate={$appStore.settings?.celebrations !== false}
        onPath={Boolean(pathNodeId)}
        error={failedMessage}
        onsave={persistCompletion}
        onrestart={restart}
      />
    {/if}
  </main>
{/if}
