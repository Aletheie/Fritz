<script lang="ts">
  import { page } from '$app/state';
  import CelebrationBurst from '$lib/components/gamification/CelebrationBurst.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { coachScenarioById } from '$lib/domain/course/coach.ts';
  import { coursePathNodeById, coursePathNodeState } from '$lib/domain/course/path.ts';
  import { localized } from '$lib/i18n';
  import { coachScenarioCopy } from '$lib/i18n/coach.ts';
  import { mistakeLabel } from '$lib/i18n/mistakes.ts';
  import { appStore, dueCards, motherTongue } from '$lib/state/app';
  import { ConversationController, type ConversationTurn } from '$lib/state/conversation.svelte.ts';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Bot from '@lucide/svelte/icons/bot';
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import MessageCircleMore from '@lucide/svelte/icons/message-circle-more';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Send from '@lucide/svelte/icons/send';
  import Sparkles from '@lucide/svelte/icons/sparkles';
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

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

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
  const activeDiagnostics = $derived.by(() => conversation.activeDiagnostics());

  onMount(() => {
    let cancelled = false;
    void (async () => {
      try {
        await appStore.initialize();
      } catch (error) {
        if (!cancelled) {
          failedMessage =
            error instanceof Error
              ? error.message
              : copy(
                  'Konverzaci se nepodařilo připravit.',
                  'The conversation could not be prepared.',
                );
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
        failedMessage =
          error instanceof Error && $motherTongue === 'cs'
            ? error.message
            : copy('Kurzový krok se nepodařilo otevřít.', 'The course step could not be opened.');
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

  function onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    void sendMessage();
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
          : copy('Trenér teď nedokázal odpovědět.', 'The coach could not respond right now.');
      await tick();
      inputElement?.focus();
    }
  }

  function turnDiagnostics(turn: ConversationTurn): ConversationTurn['result']['diagnostics'] {
    return turn.diagnosticsIgnored ? [] : turn.result.diagnostics;
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
      failedMessage =
        error instanceof Error
          ? error.message
          : copy('Výsledek se nepodařilo uložit.', 'The result could not be saved.');
    } finally {
      savingCompletion = false;
    }
  }
</script>

<svelte:head>
  <title
    >{scenario
      ? `${scenario.title} · ${copy('AI trenér', 'AI coach')}`
      : copy('Scénář nenalezen', 'Scenario not found')} · Fritz</title
  >
  <meta
    name="description"
    content={copy(
      'Krátký situační rozhovor v němčině s okamžitou zpětnou vazbou.',
      'A short situational conversation in German with instant feedback.',
    )}
  />
</svelte:head>

{#if !$appStore.ready}
  <div class="session-loading">
    <LoadingState label={copy('Připravuji konverzaci…', 'Preparing the conversation…')} />
  </div>
{:else if !scenario}
  <main class="missing-screen">
    <div>
      <p class="kicker">{copy('Scénář nenalezen', 'Scenario not found')}</p>
      <h1>{copy('Tahle konverzace neexistuje.', 'This conversation does not exist.')}</h1>
      <a class="btn-base btn-primary" href={returnHref}
        ><ArrowLeft size={18} /> {copy('Zpět', 'Back')}</a
      >
    </div>
  </main>
{:else if pathAccessLocked}
  <main class="missing-screen">
    <div class="locked-sheet">
      <span class="locked-icon"><LockKeyhole size={28} /></span>
      <p class="kicker">{copy('Zamčený krok cesty', 'Locked course step')}</p>
      <h1>{scenario.title}</h1>
      <p>
        {copy(
          'Tahle lekce se odemkne po dokončení předchozího kroku.',
          'This lesson unlocks when you finish the previous step.',
        )}
      </p>
      <a class="btn-base btn-primary" href="/"
        ><ArrowLeft size={18} /> {copy('Zpět na dnešní cestu', "Back to today's path")}</a
      >
    </div>
  </main>
{:else}
  <main class="session-shell" class:complete={sessionComplete}>
    <header class="session-header">
      <a
        href={returnHref}
        class="back-button"
        aria-label={copy('Ukončit konverzaci', 'End conversation')}><ArrowLeft size={20} /></a
      >
      <div class="header-copy">
        <p>{scenario.eyebrow}</p>
        <h1>{scenario.title}</h1>
      </div>
      <div
        class="header-progress"
        aria-label={copy(`Dokončeno ${progress} procent`, `${progress} percent complete`)}
      >
        <span>{completedTurns}/{scenario.turns}</span>
        <div><i style={`--session-progress:${progress / 100}`}></i></div>
      </div>
    </header>

    <section class="session-body">
      <aside class="mission-panel">
        <div class="mission-top">
          <span class="bot-orbit"><Bot size={23} /></span>
          <div>
            <p class="kicker">{copy('Dnešní mise', "Today's mission")}</p>
            <h2>{scenario.goal}</h2>
          </div>
        </div>
        <div class="mission-meta">
          <span><Clock3 size={14} /> {scenario.minutes} min</span>
          <span>{scenario.level}</span>
          <span><Sparkles size={14} /> {copy('až 25 XP', 'up to 25 XP')}</span>
        </div>
        <div class="word-bank">
          <p>{copy('Zkus použít', 'Try to use')}</p>
          {#each focusWords as word}<button type="button" lang="de" onclick={() => usePrompt(word)}
              >{word}</button
            >{/each}
        </div>
        <div class="micro-rule">
          <Lightbulb size={16} />
          <p>
            {scenario.guidedHints
              ? copy(
                  'Ke každé replice máš český význam i použitelný německý vzor.',
                  'Each turn includes a useful German model answer.',
                )
              : copy(
                  'Stačí krátká srozumitelná věta. AI opraví vždy jen to nejdůležitější.',
                  'A short, clear sentence is enough. AI corrects only the most important issue.',
                )}
          </p>
        </div>
      </aside>

      <div class="conversation-panel">
        <div class="turn-label">
          <span
            >{copy(
              `Replika ${currentTurn} z ${scenario.turns}`,
              `Turn ${currentTurn} of ${scenario.turns}`,
            )}</span
          >
          <small>{copy('Ty', 'You')}: {scenario.learnerRole} · AI: {scenario.coachRole}</small>
        </div>

        <div class="chat" bind:this={chatElement} aria-live="polite">
          <div class="scenario-context">
            <p>{scenario.description}</p>
            <span>{scenario.openingCs}</span>
          </div>

          {#each messages as item (item.id)}
            <article
              class:coach-message={item.role === 'coach'}
              class:learner-message={item.role === 'learner'}
              class="message-row"
            >
              {#if item.role === 'coach'}<span class="avatar"><Bot size={16} /></span>{/if}
              <div class="bubble" lang="de">{item.text}</div>
              {#if item.role === 'learner'}<span class="avatar learner">{copy('TY', 'YOU')}</span
                >{/if}
            </article>
          {/each}

          {#if sending}
            <article class="message-row coach-message">
              <span class="avatar"><Bot size={16} /></span>
              <div class="bubble typing"><i></i><i></i><i></i></div>
            </article>
          {/if}

          {#if latestResult && !sessionComplete}
            <aside
              class:accepted={latestResult.accepted}
              class:support={latestResult.outcome === 'needs-support'}
              class="feedback-card"
            >
              <div class="feedback-title">
                {#if latestResult.accepted}<CheckCircle2 size={17} />{:else}<Lightbulb
                    size={17}
                  />{/if}
                <strong
                  >{latestResult.accepted
                    ? copy('Reakce funguje', 'Your response works')
                    : latestResult.outcome === 'needs-support'
                      ? copy('Pomůžeme ji doplnit', "Let's build the answer")
                      : copy('Zkus jinou odpověď', 'Try another answer')}</strong
                >
                <span
                  >{latestResult.accepted
                    ? `${latestResult.score}/100`
                    : copy('bez postupu', 'no progress')}</span
                >
              </div>
              <p>{latestResult.feedback}</p>
              {#if latestResult.correction}
                <div class="correction">
                  <span>{copy('Lepší verze', 'Better version')}</span><strong lang="de"
                    >{latestResult.correction}</strong
                  >
                </div>
              {/if}
              {#if latestResult.diagnostics.length > 0 && conversation.latestTurnId}
                <div class="diagnostic-actions">
                  <span>
                    {latestDiagnosticsIgnored
                      ? copy(
                          'Tuhle opravu do plánu nepočítáme.',
                          'This correction will not affect the plan.',
                        )
                      : latestResult.diagnostics
                          .map((diagnostic) => mistakeLabel(diagnostic.tag, $motherTongue))
                          .join(' · ')}
                  </span>
                  <button
                    type="button"
                    onclick={() =>
                      latestDiagnosticsIgnored
                        ? conversation.restoreDiagnostics(conversation.latestTurnId!)
                        : conversation.ignoreDiagnostics(conversation.latestTurnId!)}
                  >
                    {latestDiagnosticsIgnored
                      ? copy('Vrátit hodnocení', 'Restore assessment')
                      : copy('Hodnocení nesedí', 'This assessment is off')}
                  </button>
                </div>
              {/if}
              <small>{latestResult.nextHint}</small>
            </aside>
          {/if}

          {#if failedMessage}
            <div class="error-message" role="alert">
              <span>{failedMessage}</span>
              <button type="button" onclick={() => void sendMessage()} disabled={sending}
                >{copy('Zkusit znovu', 'Try again')}</button
              >
            </div>
          {/if}
        </div>

        {#if !sessionComplete}
          <form class="composer" onsubmit={onSubmit}>
            {#if guidedHint}
              <div
                class="guided-hint"
                aria-label={copy(
                  `Nápověda k replice ${currentTurn}`,
                  `Hint for turn ${currentTurn}`,
                )}
              >
                <span><Lightbulb size={15} /></span>
                <span>
                  <small>{guidedHint.label}</small>
                  <button type="button" lang="de" onclick={() => usePrompt(guidedHint.german)}
                    >{guidedHint.german}</button
                  >
                  <em>{guidedHint.czech}</em>
                </span>
              </div>
            {:else if completedTurns === 0 && message.length === 0}
              <div
                class="starter-row"
                aria-label={copy('Nápovědy pro první odpověď', 'Hints for your first answer')}
              >
                {#each scenario.starterPrompts.slice(0, 2) as prompt}
                  <button type="button" onclick={() => usePrompt(prompt)}>{prompt}</button>
                {/each}
              </div>
            {/if}
            <div class="input-row">
              <label class="sr-only" for="coach-message"
                >{copy('Německá odpověď', 'Answer in German')}</label
              >
              <input
                id="coach-message"
                bind:this={inputElement}
                bind:value={message}
                maxlength="600"
                autocomplete="off"
                autocapitalize="sentences"
                spellcheck="false"
                placeholder={copy('Odpověz německy…', 'Reply in German…')}
                disabled={sending}
              />
              <button
                type="submit"
                aria-label={copy('Odeslat odpověď', 'Send answer')}
                disabled={sending || message.trim().length < 2}
              >
                {#if sending}<LoaderCircle class="spin" size={20} />{:else}<Send size={20} />{/if}
              </button>
            </div>
            <p>
              <MessageCircleMore size={13} />
              {copy(
                'Krátká věta stačí. Enter odešle.',
                'A short sentence is enough. Press Enter to send.',
              )}
            </p>
          </form>
        {/if}
      </div>
    </section>

    {#if sessionComplete}
      <section class="complete-sheet" aria-live="polite">
        <CelebrationBurst visible={completionSaved && $appStore.settings?.celebrations !== false} />
        <div class="complete-icon"><CheckCircle2 size={27} /></div>
        <p class="completion-label">{copy('Rozhovor je u konce', 'Conversation complete')}</p>
        <h2>{copy('Domluvila ses v celé situaci.', 'You handled the whole situation.')}</h2>
        <p class="complete-lead">
          {activeDiagnostics.length
            ? copy(
                'Tady najdeš, co si v dalším rozhovoru ještě procvičit.',
                'Here’s what to practise in your next conversation.',
              )
            : copy(
                'Odpovědi byly srozumitelné. Žádná chyba se neopakovala.',
                'Your replies were clear, with no repeated mistakes.',
              )}
        </p>
        {#if activeDiagnostics.length}
          <div class="learning-summary">
            {#each conversation.turns as turn, index (turn.id)}
              {#if turnDiagnostics(turn).length}
                <div>
                  <span>{copy('Replika', 'Reply')} {index + 1}</span>
                  <strong>
                    {turnDiagnostics(turn)
                      .map((diagnostic) => mistakeLabel(diagnostic.tag, $motherTongue))
                      .join(' · ')}
                  </strong>
                  {#if !completionSaved}
                    <button type="button" onclick={() => conversation.ignoreDiagnostics(turn.id)}>
                      {copy('Hodnocení nesedí', 'This assessment is off')}
                    </button>
                  {/if}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
        <dl class="session-facts">
          <div>
            <dt>{copy('Vlastní repliky', 'Original replies')}</dt>
            <dd>{scenario.turns}</dd>
          </div>
          <div>
            <dt>{copy('Orientační skóre', 'Indicative score')}</dt>
            <dd>{averageScore}/100</dd>
          </div>
          <div>
            <dt>{copy('Ukládá se', 'Stored')}</dt>
            <dd>{copy('jen výsledek a typ chyby', 'result and error type only')}</dd>
          </div>
        </dl>
        {#if completionSaved && awardedXp + pathXp === 0}
          <p class="repeat-note">
            {copy(
              'Odměnu za tento scénář už dnes máš. Samotné procvičení se ale pořád počítá.',
              'You already earned today’s reward for this scenario, but the practice still counts.',
            )}
          </p>
        {/if}
        {#if failedMessage}<p class="completion-error" role="alert">{failedMessage}</p>{/if}
        <div class="complete-actions">
          {#if !completionSaved}
            <button
              type="button"
              class="btn-base btn-primary"
              onclick={persistCompletion}
              disabled={savingCompletion}
            >
              {#if savingCompletion}<LoaderCircle class="spin" size={18} />{/if}
              {copy('Uložit výsledek', 'Save result')}
            </button>
          {:else}
            <a href="/" class="btn-base btn-primary">
              {pathNodeId
                ? copy('Pokračovat po cestě', 'Continue on the path')
                : copy('Zpět na dnešek', 'Back to today')}
              <ArrowRight size={18} />
            </a>
            <button type="button" class="btn-base btn-secondary" onclick={restart}>
              <RotateCcw size={17} />
              {copy('Zopakovat', 'Repeat')}
            </button>
            {#if !pathNodeId}
              <a href="/coach/" class="text-link">
                {copy('Vybrat jinou situaci', 'Choose another situation')}
                <ChevronRight size={16} />
              </a>
            {/if}
          {/if}
        </div>
      </section>
    {/if}
  </main>
{/if}

<style>
  .session-loading {
    display: grid;
    min-height: 100dvh;
    place-items: center;
  }
  .missing-screen {
    display: grid;
    min-height: 100dvh;
    place-items: center;
    padding: 1.5rem;
    text-align: center;
  }
  .missing-screen h1 {
    margin: 0.5rem 0 1.5rem;
    font-size: 2rem;
    font-weight: 900;
    letter-spacing: -0.04em;
  }
  .locked-sheet {
    width: min(100%, 31rem);
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 1.45rem 0.45rem 0.45rem;
    background: var(--color-paper-50);
    padding: clamp(1.3rem, 5vw, 2.25rem);
    box-shadow: 6px 6px 0 var(--color-ink-950);
  }
  .locked-sheet > p:not(.kicker) {
    margin: 0 auto 1.2rem;
    color: var(--color-ink-600);
    line-height: 1.55;
  }
  .locked-icon {
    display: grid;
    width: 3.5rem;
    height: 3.5rem;
    margin: 0 auto 0.75rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.35rem 1rem 0.35rem 0.35rem;
    background: var(--color-paper-200);
  }
  .session-shell {
    display: grid;
    height: 100dvh;
    overflow: hidden;
    grid-template-rows: auto minmax(0, 1fr);
    color: var(--color-ink-950);
    background: var(--color-paper-100);
  }
  .session-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) minmax(6.5rem, 10rem);
    align-items: center;
    gap: 0.7rem;
    border-bottom: 1px solid var(--color-ink-950);
    background: var(--color-paper-50);
    padding: calc(0.55rem + var(--safe-top)) 0.7rem 0.65rem;
  }
  .back-button {
    display: grid;
    width: 2.65rem;
    height: 2.65rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 0.9rem 0.45rem 0.45rem;
    background: white;
    box-shadow: 2px 2px 0 var(--color-ink-950);
    transition:
      transform 140ms var(--ease-out-emil),
      box-shadow 140ms var(--ease-out-emil);
  }
  .back-button:active {
    transform: scale(0.96);
    box-shadow: 0 0 0 var(--color-ink-950);
  }
  .header-copy {
    min-width: 0;
  }
  .header-copy p {
    margin: 0;
    overflow: hidden;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.51rem;
    font-weight: 800;
    letter-spacing: 0.055em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .header-copy h1 {
    margin: 0.12rem 0 0;
    overflow: hidden;
    font-size: 0.88rem;
    font-weight: 880;
    letter-spacing: -0.025em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .header-progress {
    display: grid;
    gap: 0.28rem;
  }
  .header-progress > span {
    justify-self: end;
    font-family: var(--font-mono);
    font-size: 0.57rem;
    font-weight: 850;
  }
  .header-progress > div {
    height: 0.45rem;
    overflow: hidden;
    border: 1px solid var(--color-ink-950);
    border-radius: 99px;
    background: var(--color-paper-200);
  }
  .header-progress i {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--color-acid-500);
    transform: scaleX(var(--session-progress));
    transform-origin: left;
    transition: transform 260ms var(--ease-out-emil);
  }

  .session-body {
    display: grid;
    min-height: 0;
  }
  .mission-panel {
    display: none;
  }
  .conversation-panel {
    display: grid;
    min-height: 0;
    grid-template-rows: auto minmax(0, 1fr) auto;
  }
  .turn-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    border-bottom: 1px solid var(--color-line);
    background: color-mix(in srgb, var(--color-paper-50) 88%, transparent);
    padding: 0.55rem 0.75rem;
  }
  .turn-label span {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 850;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .turn-label small {
    overflow: hidden;
    color: var(--color-ink-600);
    font-size: 0.56rem;
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chat {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.8rem 0.75rem 1rem;
    scroll-padding-bottom: 1rem;
  }
  .scenario-context {
    max-width: 34rem;
    margin: 0 auto 0.9rem;
    border: 1px dashed var(--color-line);
    border-radius: 0.7rem;
    background: rgb(255 253 245 / 0.65);
    padding: 0.65rem 0.75rem;
    text-align: center;
  }
  .scenario-context p {
    margin: 0;
    color: var(--color-ink-600);
    font-size: 0.65rem;
    line-height: 1.45;
  }
  .scenario-context span {
    display: block;
    margin-top: 0.3rem;
    font-size: 0.62rem;
    font-weight: 760;
  }
  .message-row {
    display: flex;
    max-width: 42rem;
    align-items: flex-end;
    gap: 0.4rem;
    margin: 0 auto 0.7rem;
    animation: message-in 220ms var(--ease-out-emil) both;
  }
  .learner-message {
    justify-content: flex-end;
  }
  .avatar {
    display: grid;
    width: 1.9rem;
    height: 1.9rem;
    flex: none;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 50%;
    background: var(--color-acid-500);
    font-family: var(--font-mono);
    font-size: 0.47rem;
    font-weight: 900;
  }
  .avatar.learner {
    color: white;
    background: var(--color-ink-950);
  }
  .bubble {
    max-width: min(82%, 29rem);
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 1rem 1rem 1rem;
    background: var(--color-paper-50);
    padding: 0.72rem 0.82rem;
    font-size: clamp(0.84rem, 3.8vw, 1rem);
    font-weight: 660;
    line-height: 1.42;
    box-shadow: 2px 2px 0 rgb(21 25 28 / 0.13);
  }
  .learner-message .bubble {
    border-radius: 1rem 0.45rem 1rem 1rem;
    color: white;
    background: var(--color-ink-950);
    box-shadow: 2px 2px 0 var(--color-cobalt-300);
  }
  .typing {
    display: flex;
    min-width: 3.5rem;
    gap: 0.24rem;
    padding-block: 0.9rem;
  }
  .typing i {
    width: 0.35rem;
    height: 0.35rem;
    border-radius: 50%;
    background: var(--color-ink-600);
    animation: typing 900ms ease-in-out infinite;
  }
  .typing i:nth-child(2) {
    animation-delay: 120ms;
  }
  .typing i:nth-child(3) {
    animation-delay: 240ms;
  }
  .feedback-card {
    max-width: 42rem;
    margin: 0.2rem auto 0.85rem;
    border: 1px solid var(--color-butter-600);
    border-radius: 0.55rem 1.1rem 0.55rem 0.55rem;
    background: var(--color-butter-50);
    padding: 0.75rem;
    animation: feedback-in 240ms var(--ease-out-emil) both;
  }
  .feedback-card.accepted {
    border-color: var(--color-mint-700);
    background: var(--color-mint-50);
  }
  .feedback-title {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .feedback-title strong {
    font-size: 0.72rem;
    font-weight: 850;
  }
  .feedback-title span {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 0.58rem;
    font-weight: 850;
  }
  .feedback-card > p {
    margin: 0.45rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.68rem;
    line-height: 1.45;
  }
  .feedback-card > small {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.63rem;
    font-weight: 760;
    line-height: 1.42;
  }
  .correction {
    margin-top: 0.55rem;
    border-top: 1px solid rgb(21 25 28 / 0.12);
    padding-top: 0.5rem;
  }
  .correction span {
    display: block;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.5rem;
    font-weight: 800;
    text-transform: uppercase;
  }
  .correction strong {
    display: block;
    margin-top: 0.15rem;
    font-size: 0.75rem;
  }
  .diagnostic-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    margin-top: 0.6rem;
    border-top: 1px solid rgb(21 25 28 / 0.12);
    padding-top: 0.55rem;
  }
  .diagnostic-actions span {
    color: var(--color-ink-700);
    font-size: 0.63rem;
    font-weight: 720;
  }
  .diagnostic-actions button,
  .learning-summary button {
    flex: none;
    border: 0;
    color: var(--color-cobalt-700);
    background: transparent;
    padding: 0.25rem;
    font-size: 0.62rem;
    font-weight: 800;
    text-decoration: underline;
    text-underline-offset: 0.18rem;
  }
  .error-message {
    display: flex;
    max-width: 42rem;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
    margin: 0.5rem auto;
    border: 1px solid color-mix(in srgb, var(--color-coral-700) 36%, transparent);
    border-radius: 0.6rem;
    color: var(--color-coral-700);
    background: var(--color-coral-50);
    padding: 0.7rem;
    font-size: 0.68rem;
    font-weight: 750;
  }
  .error-message button {
    flex: none;
    border: 1px solid currentColor;
    border-radius: 0.4rem;
    background: white;
    padding: 0.38rem 0.55rem;
    font-size: 0.61rem;
    font-weight: 850;
    transition: transform 140ms var(--ease-out-emil);
  }
  .error-message button:active {
    transform: scale(0.97);
  }

  .composer {
    border-top: 1px solid var(--color-ink-950);
    background: var(--color-paper-50);
    padding: 0.55rem 0.65rem calc(0.55rem + var(--safe-bottom));
    box-shadow: 0 -10px 30px rgb(21 25 28 / 0.07);
  }
  .guided-hint {
    display: grid;
    max-width: 42rem;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.55rem;
    margin: 0 auto 0.5rem;
    border: 1px solid var(--color-butter-600);
    border-radius: 0.45rem 0.9rem 0.45rem 0.45rem;
    background: var(--color-butter-50);
    padding: 0.5rem 0.6rem;
  }
  .guided-hint > span:first-child {
    display: grid;
    width: 1.8rem;
    height: 1.8rem;
    place-items: center;
    border-radius: 999px;
    color: var(--color-ink-950);
    background: var(--color-butter-200);
  }
  .guided-hint small,
  .guided-hint button,
  .guided-hint em {
    display: block;
  }
  .guided-hint small {
    color: var(--color-butter-600);
    font-family: var(--font-mono);
    font-size: 0.49rem;
    font-weight: 850;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .guided-hint button {
    margin-top: 0.08rem;
    border-bottom: 1px dashed currentColor;
    font-size: 0.67rem;
    font-weight: 850;
    text-align: left;
  }
  .guided-hint em {
    margin-top: 0.08rem;
    color: var(--color-ink-600);
    font-size: 0.57rem;
    font-style: normal;
  }
  .starter-row {
    display: flex;
    max-width: 42rem;
    gap: 0.4rem;
    margin: 0 auto 0.45rem;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .starter-row::-webkit-scrollbar {
    display: none;
  }
  .starter-row button {
    flex: none;
    border: 1px solid var(--color-line);
    border-radius: 99px;
    color: var(--color-ink-600);
    background: var(--color-paper-100);
    padding: 0.38rem 0.58rem;
    font-size: 0.59rem;
    font-weight: 760;
  }
  .input-row {
    display: grid;
    max-width: 42rem;
    margin: 0 auto;
    grid-template-columns: minmax(0, 1fr) 3rem;
    gap: 0.45rem;
  }
  .input-row input {
    min-width: 0;
    height: 3rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 0.95rem 0.45rem 0.45rem;
    background: white;
    padding: 0 0.8rem;
    font-size: 0.84rem;
    font-weight: 660;
    box-shadow: inset 0 -2px 0 rgb(21 25 28 / 0.06);
  }
  .input-row input:focus {
    border-color: var(--color-cobalt-700);
    box-shadow: 0 0 0 3px rgb(49 83 199 / 0.13);
    outline: none;
  }
  .input-row button {
    display: grid;
    width: 3rem;
    height: 3rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 0.95rem 0.45rem 0.45rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
    box-shadow: 3px 3px 0 var(--color-ink-950);
    transition:
      transform 140ms var(--ease-out-emil),
      box-shadow 140ms var(--ease-out-emil),
      opacity 140ms var(--ease-out-emil);
  }
  .input-row button:active:not(:disabled) {
    transform: scale(0.95);
    box-shadow: 0 0 0 var(--color-ink-950);
  }
  .input-row button:disabled {
    opacity: 0.42;
  }
  .composer > p {
    display: flex;
    max-width: 42rem;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    margin: 0.38rem auto 0;
    color: var(--color-ink-600);
    font-size: 0.52rem;
    font-weight: 680;
  }

  .complete-sheet {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    overflow-y: auto;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    background: var(--color-paper-50);
    padding: calc(1.2rem + var(--safe-top)) 1rem calc(1.2rem + var(--safe-bottom));
    text-align: center;
    animation: complete-in 220ms var(--ease-out-emil) both;
  }
  .complete-icon {
    position: relative;
    display: grid;
    width: 4.2rem;
    height: 4.2rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.75rem;
    background: var(--color-acid-500);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .completion-label {
    margin-top: 1.25rem;
    color: var(--color-ink-700);
    font-size: 0.72rem;
    font-weight: 760;
  }
  .complete-sheet h2 {
    max-width: 20ch;
    margin: 0.35rem 0 0;
    font-size: 2rem;
    font-weight: 880;
    letter-spacing: -0.035em;
    line-height: 1.05;
    text-wrap: balance;
  }
  .complete-lead {
    max-width: 32rem;
    margin: 0.8rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.8rem;
    line-height: 1.55;
  }
  .learning-summary {
    width: min(100%, 34rem);
    margin-top: 1.2rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-block: 1px solid var(--color-line);
  }
  .learning-summary > div {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.7rem;
    padding: 0.75rem 0;
    text-align: left;
  }
  .learning-summary > div + div {
    border-top: 1px solid var(--color-line);
  }
  .learning-summary span {
    color: var(--color-ink-600);
    font-size: 0.65rem;
  }
  .learning-summary strong {
    font-size: 0.75rem;
    font-weight: 800;
  }
  .session-facts {
    display: grid;
    width: min(100%, 34rem);
    gap: 0.45rem;
    margin: 1rem 0 0;
  }
  .session-facts > div {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    border-bottom: 1px solid var(--color-line);
    padding-bottom: 0.45rem;
    text-align: left;
  }
  .session-facts dt {
    color: var(--color-ink-600);
    font-size: 0.68rem;
  }
  .session-facts dd {
    margin: 0;
    font-size: 0.68rem;
    font-weight: 780;
    text-align: right;
  }
  .completion-error {
    max-width: 34rem;
    margin: 0.75rem 0 0;
    color: var(--color-coral-700);
    font-size: 0.7rem;
    font-weight: 750;
  }
  .repeat-note {
    max-width: 30rem;
    margin: 0.75rem 0 0;
    border-radius: 0.65rem;
    background: var(--color-butter-50);
    padding: 0.6rem 0.75rem;
    font-size: 0.62rem;
    font-weight: 720;
    line-height: 1.45;
  }
  .complete-actions {
    display: flex;
    width: min(100%, 34rem);
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
    margin-top: 1rem;
  }
  .complete-actions .btn-base {
    flex: 1 1 12rem;
  }
  .text-link {
    display: inline-flex;
    min-height: 2.8rem;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    padding-inline: 0.6rem;
    font-size: 0.72rem;
    font-weight: 800;
  }

  @keyframes message-in {
    from {
      opacity: 0;
      transform: translateY(0.35rem) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @keyframes feedback-in {
    from {
      opacity: 0;
      transform: translateY(0.4rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes complete-in {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  @keyframes typing {
    0%,
    60%,
    100% {
      opacity: 0.3;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-0.2rem);
    }
  }
  :global(.spin) {
    animation: spin 900ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (min-width: 860px) {
    .session-header {
      grid-template-columns: auto minmax(0, 1fr) minmax(10rem, 13rem);
      padding-inline: 1rem;
    }
    .session-body {
      grid-template-columns: 18rem minmax(0, 1fr);
    }
    .mission-panel {
      display: block;
      min-height: 0;
      overflow-y: auto;
      border-right: 1px solid var(--color-ink-950);
      background: var(--color-ink-950);
      padding: 1.2rem;
      color: white;
    }
    .mission-top {
      display: flex;
      gap: 0.75rem;
    }
    .bot-orbit {
      display: grid;
      width: 3rem;
      height: 3rem;
      flex: none;
      place-items: center;
      border: 1px solid var(--color-acid-500);
      border-radius: 0.5rem 1rem 0.5rem 0.5rem;
      color: var(--color-ink-950);
      background: var(--color-acid-500);
    }
    .mission-top .kicker {
      color: rgb(255 255 255 / 0.48);
    }
    .mission-top h2 {
      margin: 0.35rem 0 0;
      font-size: 1.1rem;
      font-weight: 880;
      letter-spacing: -0.035em;
      line-height: 1.1;
    }
    .mission-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-top: 1rem;
    }
    .mission-meta span {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      border: 1px solid rgb(255 255 255 / 0.14);
      border-radius: 99px;
      background: rgb(255 255 255 / 0.06);
      padding: 0.35rem 0.5rem;
      color: rgb(255 255 255 / 0.62);
      font-family: var(--font-mono);
      font-size: 0.53rem;
      font-weight: 760;
    }
    .word-bank {
      margin-top: 1.4rem;
      border-top: 1px solid rgb(255 255 255 / 0.14);
      padding-top: 1rem;
    }
    .word-bank p {
      margin: 0 0 0.5rem;
      color: rgb(255 255 255 / 0.45);
      font-family: var(--font-mono);
      font-size: 0.55rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .word-bank button {
      display: block;
      width: 100%;
      margin-top: 0.4rem;
      border: 1px solid rgb(255 255 255 / 0.14);
      border-radius: 0.5rem;
      color: white;
      background: rgb(255 255 255 / 0.06);
      padding: 0.55rem 0.65rem;
      text-align: left;
      font-size: 0.72rem;
      font-weight: 700;
      transition:
        background-color 150ms var(--ease-out-emil),
        transform 150ms var(--ease-out-emil);
    }
    .word-bank button:active {
      transform: scale(0.98);
    }
    .micro-rule {
      display: flex;
      gap: 0.5rem;
      margin-top: 1.2rem;
      border-radius: 0.6rem;
      color: var(--color-ink-950);
      background: var(--color-acid-500);
      padding: 0.75rem;
    }
    .micro-rule :global(svg) {
      flex: none;
    }
    .micro-rule p {
      margin: 0;
      font-size: 0.65rem;
      font-weight: 760;
      line-height: 1.45;
    }
    .turn-label,
    .chat,
    .composer {
      padding-inline: 1.2rem;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .starter-row button:hover {
      border-color: var(--color-ink-950);
      color: var(--color-ink-950);
      background: var(--color-acid-100);
    }
    .word-bank button:hover {
      background: rgb(255 255 255 / 0.12);
    }
    .text-link:hover {
      text-decoration: underline;
      text-underline-offset: 0.18rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .message-row,
    .feedback-card,
    .complete-sheet {
      animation: none;
    }
    .chat {
      scroll-behavior: auto;
    }
  }
</style>
