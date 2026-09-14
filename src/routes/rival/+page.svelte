<script lang="ts">
  import RivalAvatar from '$lib/components/gamification/RivalAvatar.svelte';
  import RivalResult from '$lib/components/gamification/RivalResult.svelte';
  import RivalRound from '$lib/components/gamification/RivalRound.svelte';
  import RivalStrategyPicker from '$lib/components/gamification/RivalStrategyPicker.svelte';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { createId } from '$lib/domain/id.ts';
  import { readLearner, rivalScore, rivalWeakness } from '$lib/domain/rival/engine.ts';
  import { buildRivalQuestions } from '$lib/domain/rival/questions.ts';
  import type { RivalAction, RivalStrategy } from '$lib/domain/rival/types.ts';
  import {
    rivalNames,
    rivalPersonalities,
    rivalReaction,
    rivalRematchLine,
    rivalReadingLine,
    rivalTopics,
  } from '$lib/i18n/rival.ts';
  import { appStore, gameProgress, motherTongue } from '$lib/state/app';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import { onMount } from 'svelte';

  let ready = $state(false);
  let grammar = $state<typeof import('$lib/domain/course/grammar.ts')>();
  let strategy = $state<RivalStrategy>('balanced');
  let busy = $state(false);
  let error = $state('');
  let showSummary = $state(true);
  let conversation = $state<'reading' | 'plan'>('reading');

  const enabled = $derived(
    Boolean($appStore.settings?.gamificationEnabled && $appStore.settings?.rivalryEnabled),
  );
  const rivalry = $derived($appStore.course.rivalry ?? { history: [] });
  const match = $derived(rivalry.match);
  const rivalId = $derived(match?.rivalId ?? $gameProgress.rival.profile.id);
  const name = $derived(rivalNames[rivalId]);
  const reading = $derived(readLearner($appStore.recentReviews, $appStore.course.events));
  const pool = $derived(
    buildRivalQuestions(
      $appStore.notes,
      $appStore.recentReviews,
      grammar?.grammarLessons.filter(
        (lesson) =>
          grammar?.grammarLevelForLesson(lesson) === ($appStore.settings?.grammarLevel ?? 'A1.1'),
      ) ?? [],
    ),
  );
  const score = $derived(match ? rivalScore(match) : { user: 0, bot: 0 });
  const hasEnoughQuestions = $derived(new Set(pool.map((question) => question.sourceId)).size >= 6);
  const playing = $derived(Boolean(match && (!match.completedAt || !showSummary)));
  const rounds = $derived(match?.rounds ?? []);
  const lastRound = $derived(rounds.at(-1));
  const mood = $derived(
    busy
      ? 'thinking'
      : playing && lastRound?.result
        ? lastRound.botCorrect
          ? 'pleased'
          : 'surprised'
        : 'ready',
  );
  const quote = $derived(
    playing && match
      ? rivalReaction(match, $motherTongue)
      : conversation === 'plan'
        ? rivalPersonalities[rivalId].plan[$motherTongue]
        : match?.completedAt
          ? rivalRematchLine(
              match.rounds.filter((round) => round.result?.correct).length,
              $motherTongue,
            )
          : rivalReadingLine(reading, $motherTongue),
  );
  const record = $derived(rivalry.history.filter((item) => item.rivalId === rivalId));
  const wins = $derived(record.filter((item) => item.userScore > item.botScore).length);
  const losses = $derived(record.filter((item) => item.userScore < item.botScore).length);
  const copy = (cs: string, en: string) => ($motherTongue === 'cs' ? cs : en);

  onMount(async () => {
    try {
      await appStore.initialize();
      strategy = $appStore.course.rivalry?.match?.strategy ?? 'balanced';
      grammar = await import('$lib/domain/course/grammar.ts');
    } catch (cause) {
      error =
        cause instanceof Error
          ? cause.message
          : copy(
              'Otázky se nepodařilo načíst. Zkus obnovit stránku.',
              'Could not load the questions. Reload the page.',
            );
    } finally {
      ready = true;
    }
  });

  async function act(action: RivalAction): Promise<void> {
    if (busy || !enabled) return;
    busy = true;
    error = '';
    try {
      await appStore.rivalAction(action, pool);
      if (action.type === 'start' || action.type === 'answer') showSummary = false;
    } catch (cause) {
      error =
        cause instanceof Error
          ? cause.message
          : copy(
              'Tah se neuložil. Zkus ho odeslat znovu.',
              'The move was not saved. Try sending it again.',
            );
    } finally {
      busy = false;
    }
  }

  function start(): void {
    void act({
      type: 'start',
      id: createId('rival'),
      rivalId,
      strategy,
      weakness: reading.weakness,
    });
  }

  function next(): void {
    if (!match || !lastRound) return;
    if (match.completedAt) {
      showSummary = true;
      conversation = 'reading';
    } else void act({ type: 'next', matchId: match.id, questionId: lastRound.question.id });
  }
</script>

{#snippet scoutingContent()}
  <div
    class="conversation-actions"
    role="group"
    aria-label={copy('Promluvit se soupeřem', 'Talk to your rival')}
  >
    <button aria-pressed={conversation === 'reading'} onclick={() => (conversation = 'reading')}
      >{copy('Jak mě čteš?', 'What do you notice?')}</button
    >
    <button aria-pressed={conversation === 'plan'} onclick={() => (conversation = 'plan')}
      >{copy('Prozraď svůj plán', 'Tell me your plan')}</button
    >
  </div>
  <div class="scouting">
    <p>
      <span>{copy('Slabší místo soupeře', 'Rival’s weaker side')}</span><strong
        >{rivalTopics[rivalWeakness(rivalId)][$motherTongue]}</strong
      >
    </p>
    {#if record.length}<p>
        <span>{copy('Vzájemné souboje', 'Head-to-head record')}</span><strong
          >{copy(`${wins} výher · ${losses} proher`, `${wins} wins · ${losses} losses`)}</strong
        >
      </p>{/if}
  </div>
  <details class="reading">
    <summary>{copy('Z čeho soupeř vychází', 'What the rival has seen')}</summary>
    <p>
      {copy(
        'Posledních 30 dní. Jen skutečné odpovědi, bez vyřazených hodnocení a sprintů.',
        'The last 30 days. Actual answers, excluding disputed reviews and cram sessions.',
      )}
    </p>
    <ul>
      {#each reading.topics as topic}<li>
          <span>{rivalTopics[topic.topic][$motherTongue]}</span><strong
            >{topic.attempts
              ? `${topic.correct} / ${topic.attempts}`
              : copy('zatím neznámé', 'not enough data')}</strong
          >
        </li>{/each}
    </ul>
  </details>
{/snippet}

<svelte:head>
  <title>{copy('Souboj s robotem · Fritz', 'Robot duel · Fritz')}</title>
  <meta
    name="description"
    content={copy(
      'Pět kol němčiny proti soupeři, který mění taktiku podle tvých odpovědí.',
      'Five rounds of German against a rival who adapts to your answers.',
    )}
  />
</svelte:head>

<div class="arena">
  <header class="arena-header">
    <a href="/" class="back"
      ><ArrowLeft size={18} aria-hidden="true" />
      {playing ? copy('Přerušit souboj', 'Pause match') : copy('Zpět domů', 'Back home')}</a
    >
    <span>{copy('Soukromý souboj', 'Private duel')}</span>
  </header>

  {#if !ready || !$appStore.ready}
    <LoadingState label={copy('Připravuji soupeře…', 'Preparing your rival…')} />
  {:else if !enabled}
    <section class="disabled-state">
      <RivalAvatar />
      <h1>{copy('Soupeření máš vypnuté.', 'Rivalry is switched off.')}</h1>
      <p>
        {copy(
          'Robot počká. Souboje můžeš zapnout v nastavení herních prvků.',
          'Your rival can wait. Enable duels in your game settings.',
        )}
      </p>
      <a class="btn-base btn-secondary" href="/settings/"
        >{copy('Otevřít nastavení', 'Open settings')}</a
      >
    </section>
  {:else}
    <div class="arena-layout" class:compact-opponent={playing || Boolean(match?.completedAt)}>
      <aside class="opponent" aria-label={copy('Tvůj soupeř', 'Your rival')}>
        <div class="opponent-heading">
          <RivalAvatar {mood} small={playing || Boolean(match?.completedAt)} />
          <div>
            <p class="rival-label">{copy('Tvůj soupeř', 'Your rival')}</p>
            <h1>{name}</h1>
            <p class="personality">{rivalPersonalities[rivalId].title[$motherTongue]}</p>
          </div>
        </div>
        <div class="speech" aria-live={playing ? 'off' : 'polite'}><p>{quote}</p></div>
        {#if !playing}
          <details class="debrief">
            <summary>{copy('Promluvit se soupeřem', 'Talk to your rival')}</summary>
            {@render scoutingContent()}
          </details>
        {/if}
      </aside>

      <div class="game-area">
        {#if error}<p role="alert" class="error">{error}</p>{/if}
        {#if playing && match && lastRound}
          <div
            class="match-score"
            role="group"
            aria-label={copy(
              `Skóre: Ty ${score.user}, ${name} ${score.bot}`,
              `Score: You ${score.user}, ${name} ${score.bot}`,
            )}
          >
            <span>{copy('Ty', 'You')} <strong>{score.user}</strong></span>
            <div class="round-dots" aria-hidden="true">
              {#each [0, 1, 2, 3, 4] as index}<i
                  class:done={Boolean(rounds[index]?.result)}
                  class:current={index === rounds.length - 1 && !rounds[index]?.result}
                ></i>{/each}
            </div>
            <span><strong>{score.bot}</strong> {name}</span>
          </div>
          {#key `${match.id}:${lastRound.question.id}`}
            <RivalRound
              {match}
              language={$motherTongue}
              {busy}
              onanswer={(answer, stake) => {
                if (match && lastRound)
                  void act({
                    type: 'answer',
                    matchId: match.id,
                    questionId: lastRound.question.id,
                    answer,
                    stake,
                  });
              }}
              onnext={() => void next()}
              onswitch={() => {
                if (match && lastRound)
                  void act({
                    type: 'switch',
                    matchId: match.id,
                    questionId: lastRound.question.id,
                  });
              }}
            />
          {/key}
        {:else if match?.completedAt}
          <RivalResult {match} language={$motherTongue} {busy} bind:strategy onrematch={start} />
        {:else}
          <section class="invitation">
            <p class="match-preview">
              {copy('5 otázek · bez časomíry', '5 questions · no timer')} · {$appStore.settings
                ?.grammarLevel ?? 'A1.1'}
            </p>
            <h2>{copy('Dáme si souboj?', 'Ready for a match?')}</h2>
            <p class="intro">
              {copy(
                'Procvičíš svá slovíčka a gramatiku. Soupeř se přizpůsobí tvým odpovědím a po každém kole uvidíš vysvětlení.',
                'Practise your vocabulary and grammar. Your rival adapts to your answers, with an explanation after each round.',
              )}
            </p>
            <RivalStrategyPicker bind:strategy language={$motherTongue} />
            <button
              class="btn-base btn-primary start-button"
              onclick={start}
              disabled={busy || !hasEnoughQuestions}
              >{busy
                ? copy('Připravuji první tah…', 'Preparing the opening…')
                : copy('Začít souboj', 'Start match')}<ArrowRight
                size={18}
                aria-hidden="true"
              /></button
            >
            {#if !hasEnoughQuestions}<p class="small-note">
                {copy(
                  'Na souboj chybí otázky. Přidej slovíčka do knihovny.',
                  'Not enough questions for a match. Add vocabulary to your library.',
                )} <a href="/create/">{copy('Přidat slovíčka', 'Add vocabulary')}</a>
              </p>{/if}
            <details class="how-to-play">
              <summary>{copy('Jak se hraje', 'How to play')}</summary>
              <ul class="rules">
                <li>
                  {copy(
                    'Za správnou odpověď získáš bod. Za chybu nic neztrácíš.',
                    'A correct answer earns a point. Mistakes never cost you points.',
                  )}
                </li>
                <li>
                  {copy(
                    'Jednou za souboj můžeš zapnout bonus za 2 body. Jednou můžeš vyměnit otázku.',
                    'Once per match, use a bonus to earn 2 points. You also get one question swap.',
                  )}
                </li>
                <li>
                  {copy(
                    'Robot odpovídá na stejné otázky a také dělá chyby.',
                    'Your rival answers the same questions and makes mistakes too.',
                  )}
                </li>
              </ul>
            </details>
          </section>
        {/if}
        {#if playing || !match?.completedAt}<p class="local-note">
            {playing
              ? copy(
                  'Potvrzené odpovědi se ukládají automaticky. K souboji se můžeš vrátit později.',
                  'Confirmed answers save automatically. You can return to this match later.',
                )
              : copy(
                  'Hraješ svým tempem. Souboj můžeš kdykoli přerušit.',
                  'Play at your own pace. You can pause the match at any time.',
                )}
          </p>{/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .arena {
    width: min(100%, 66rem);
    margin: 0 auto;
    padding: 1rem 1.25rem max(2rem, var(--safe-bottom));
  }
  .arena-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--color-line);
  }
  .back {
    display: inline-flex;
    gap: 0.45rem;
    align-items: center;
    min-height: 44px;
    color: var(--color-ink-800);
    text-decoration: none;
    font-size: 0.85rem;
  }
  .arena-header > span {
    color: var(--color-ink-600);
    font-size: 0.8rem;
  }
  .arena-layout {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.3fr);
    gap: 3rem;
    padding-top: 2.3rem;
    align-items: start;
  }
  .opponent,
  .game-area {
    min-width: 0;
  }
  .opponent-heading {
    display: flex;
    gap: 1rem;
    align-items: center;
  }
  .rival-label {
    font-size: 0.8rem;
    color: var(--color-ink-600);
  }
  h1 {
    font-size: 2.5rem;
    line-height: 1.1;
    letter-spacing: -0.035em;
    margin: 0.25rem 0;
  }
  .personality {
    font-size: 0.88rem;
    color: var(--color-ink-700);
    line-height: 1.4;
  }
  .speech {
    margin-top: 1.7rem;
    padding: 1.1rem 1.2rem;
    background: var(--color-cobalt-50);
    border: 1px solid var(--color-cobalt-100);
    border-radius: 12px;
    color: var(--color-ink-800);
    font-size: 0.98rem;
    line-height: 1.65;
  }
  .conversation-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.75rem;
  }
  .conversation-actions button {
    min-height: 44px;
    border-radius: 8px;
    border: 1px solid var(--color-line);
    background: transparent;
    padding: 0.45rem 0.65rem;
    font-size: 0.79rem;
    color: var(--color-ink-800);
    transition: transform 140ms var(--ease-out-emil);
  }
  .conversation-actions button[aria-pressed='true'] {
    border-color: var(--color-cobalt-700);
    color: var(--color-cobalt-700);
    background: var(--color-cobalt-50);
  }
  .conversation-actions button:active {
    transform: scale(0.97);
  }
  .scouting {
    margin-top: 1.4rem;
  }
  .scouting p {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.8rem;
    padding-block: 0.6rem;
    border-bottom: 1px solid var(--color-line);
  }
  .scouting span {
    color: var(--color-ink-600);
  }
  .scouting strong {
    text-align: right;
  }
  details {
    margin-top: 1rem;
    font-size: 0.83rem;
  }
  summary {
    min-height: 44px;
    align-content: center;
    cursor: pointer;
    color: var(--color-ink-800);
  }
  .reading p {
    font-size: 0.76rem;
    line-height: 1.5;
    color: var(--color-ink-600);
    margin: 0.3rem 0 0.6rem;
  }
  .reading li {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.35rem 0;
  }
  .reading li strong {
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  .invitation {
    border: 1px solid var(--color-line);
    background: var(--color-paper-50);
    border-radius: 14px;
    padding: 1.8rem;
  }
  .match-preview {
    font-size: 0.8rem;
    color: var(--color-ink-600);
    margin-bottom: 0.75rem;
  }
  h2 {
    font-size: 1.9rem;
    letter-spacing: -0.03em;
    line-height: 1.2;
    text-wrap: balance;
    overflow-wrap: anywhere;
  }
  .intro {
    font-size: 0.94rem;
    line-height: 1.6;
    color: var(--color-ink-700);
    margin-top: 0.9rem;
  }
  .rules {
    list-style: disc;
    padding-left: 1.1rem;
    display: grid;
    gap: 0.5rem;
    font-size: 0.85rem;
    line-height: 1.5;
    margin-top: 0.4rem;
    padding-bottom: 0.5rem;
  }
  .start-button {
    width: 100%;
    margin-top: 0.65rem;
  }
  .how-to-play {
    margin-top: 0.75rem;
  }
  .local-note,
  .small-note {
    color: var(--color-ink-600);
    font-size: 0.75rem;
    line-height: 1.55;
    margin-top: 1rem;
  }
  .match-score {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    font-size: 0.88rem;
  }
  .match-score > span {
    display: flex;
    gap: 0.7rem;
    align-items: center;
  }
  .match-score strong {
    font-size: 1.8rem;
    font-variant-numeric: tabular-nums;
  }
  .round-dots {
    display: flex;
    gap: 0.3rem;
  }
  .round-dots i {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: var(--color-paper-200);
  }
  .round-dots i.done {
    background: var(--color-cobalt-700);
  }
  .round-dots i.current {
    background: var(--color-ink-950);
  }
  .compact-opponent .speech {
    font-size: 0.88rem;
  }
  .compact-opponent h1 {
    font-size: 1.65rem;
  }
  .error {
    border: 1px solid var(--color-coral-200);
    background: var(--color-coral-50);
    border-radius: 10px;
    padding: 0.9rem;
    color: var(--color-coral-800);
    margin-bottom: 1rem;
  }
  .disabled-state {
    text-align: center;
    display: grid;
    justify-items: center;
    gap: 1.2rem;
    padding: 3rem 1rem;
  }
  .disabled-state h1 {
    font-size: 1.8rem;
  }
  @media (max-width: 760px) {
    .arena-layout {
      grid-template-columns: minmax(0, 1fr);
      gap: 1rem;
      padding-top: 1.2rem;
    }
    .arena-header {
      padding-bottom: 0.5rem;
    }
    .opponent-heading {
      gap: 0.8rem;
    }
    .rival-label {
      display: none;
    }
    .opponent-heading :global(.robot) {
      width: 4rem;
      height: 4rem;
    }
    h1 {
      font-size: 1.8rem;
    }
    .speech {
      margin-top: 0.8rem;
      padding: 0.75rem 0.9rem;
      font-size: 0.85rem;
      line-height: 1.5;
    }
    .debrief {
      margin-top: 0.25rem;
    }
    .compact-opponent .personality,
    .compact-opponent .rival-label {
      display: none;
    }
    .compact-opponent .opponent {
      display: grid;
      grid-template-columns: 3.25rem minmax(0, 1fr);
      gap: 0.75rem;
      align-items: flex-start;
    }
    .compact-opponent .debrief {
      grid-column: 1 / -1;
    }
    .compact-opponent .opponent-heading {
      display: grid;
      gap: 0;
      justify-items: center;
      flex: none;
    }
    .compact-opponent .opponent-heading :global(.robot) {
      width: 3.25rem;
      height: 3.25rem;
    }
    .compact-opponent h1 {
      font-size: 0.8rem;
      margin: 0;
    }
    .compact-opponent .speech {
      margin: 0;
      padding: 0.75rem;
      font-size: 0.8rem;
      line-height: 1.45;
    }
    .compact-opponent {
      gap: 1rem;
    }
  }
  @media (max-width: 480px) {
    .invitation {
      padding: 1.2rem;
    }
    h2 {
      font-size: 1.65rem;
    }
    h1 {
      font-size: 2rem;
    }
    .arena-header > span {
      font-size: 0.7rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .conversation-actions button {
      transition: none;
    }
  }
</style>
