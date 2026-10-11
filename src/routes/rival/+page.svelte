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
  const compact = $derived(playing || Boolean(match?.completedAt));

  const details = 'mt-4 text-[0.83rem]';
  const summary = 'min-h-11 cursor-pointer content-center text-ink-800';
  const note = 'mt-4 text-[0.75rem] leading-[1.55] text-ink-600';

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
    class="mt-3 flex flex-wrap gap-[0.4rem]"
    role="group"
    aria-label={copy('Promluvit se soupeřem', 'Talk to your rival')}
  >
    {#each [['reading', copy('Jak mě čteš?', 'What do you notice?')], ['plan', copy('Prozraď svůj plán', 'Tell me your plan')]] as [value, label]}
      <button
        class={[
          'min-h-11 rounded-lg border px-[0.65rem] py-[0.45rem] text-[0.79rem] transition-transform duration-140 ease-out-emil active:[transform:scale(0.97)] motion-reduce:transition-none',
          conversation === value
            ? 'border-cobalt-700 bg-cobalt-50 text-cobalt-700'
            : 'border-line bg-transparent text-ink-800',
        ]}
        aria-pressed={conversation === value}
        onclick={() => (conversation = value as 'reading' | 'plan')}>{label}</button
      >
    {/each}
  </div>
  <div class="mt-[1.4rem]">
    <p class="flex justify-between gap-4 border-b border-line py-[0.6rem] text-[0.8rem]">
      <span class="text-ink-600">{copy('Slabší místo soupeře', 'Rival’s weaker side')}</span><strong
        class="text-right">{rivalTopics[rivalWeakness(rivalId)][$motherTongue]}</strong
      >
    </p>
    {#if record.length}<p
        class="flex justify-between gap-4 border-b border-line py-[0.6rem] text-[0.8rem]"
      >
        <span class="text-ink-600">{copy('Vzájemné souboje', 'Head-to-head record')}</span><strong
          class="text-right"
          >{copy(`${wins} výher · ${losses} proher`, `${wins} wins · ${losses} losses`)}</strong
        >
      </p>{/if}
  </div>
  <details class={details}>
    <summary class={summary}>{copy('Z čeho soupeř vychází', 'What the rival has seen')}</summary>
    <p class="mt-[0.3rem] mb-[0.6rem] text-[0.76rem] leading-normal text-ink-600">
      {copy(
        'Posledních 30 dní. Jen skutečné odpovědi, bez vyřazených hodnocení a sprintů.',
        'The last 30 days. Actual answers, excluding disputed reviews and cram sessions.',
      )}
    </p>
    <ul>
      {#each reading.topics as topic}<li class="flex justify-between gap-2 py-[0.35rem]">
          <span>{rivalTopics[topic.topic][$motherTongue]}</span><strong
            class="font-[650] tabular-nums"
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

<div
  class="mx-auto w-[min(100%,66rem)] px-5 pt-4 pb-[max(2rem,var(--safe-bottom))]"
  data-testid="rival-arena"
>
  <header
    class="flex items-center justify-between gap-4 border-b border-line pb-6 max-[761px]:pb-2"
  >
    <a
      href="/"
      class="inline-flex min-h-11 items-center gap-[0.45rem] text-[0.85rem] text-ink-800 no-underline"
      ><ArrowLeft size={18} aria-hidden="true" />
      {playing ? copy('Přerušit souboj', 'Pause match') : copy('Zpět domů', 'Back home')}</a
    >
    <span class="text-[0.8rem] text-ink-600 max-[481px]:text-[0.7rem]"
      >{copy('Soukromý souboj', 'Private duel')}</span
    >
  </header>

  {#if !ready || !$appStore.ready}
    <LoadingState label={copy('Připravuji soupeře…', 'Preparing your rival…')} />
  {:else if !enabled}
    <section class="grid justify-items-center gap-[1.2rem] px-4 py-12 text-center">
      <RivalAvatar />
      <h1 class="my-1 text-[1.8rem] leading-[1.1] tracking-[-0.035em]">
        {copy('Soupeření máš vypnuté.', 'Rivalry is switched off.')}
      </h1>
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
    <div
      class="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] items-start gap-12 pt-[2.3rem] max-[761px]:grid-cols-[minmax(0,1fr)] max-[761px]:gap-4 max-[761px]:pt-[1.2rem]"
    >
      <aside
        class={[
          'min-w-0',
          compact &&
            'max-[761px]:grid max-[761px]:grid-cols-[3.25rem_minmax(0,1fr)] max-[761px]:items-start max-[761px]:gap-3',
        ]}
        aria-label={copy('Tvůj soupeř', 'Your rival')}
      >
        <div
          class={[
            'flex items-center gap-4 max-[761px]:gap-[0.8rem]',
            compact &&
              'max-[761px]:grid max-[761px]:flex-none max-[761px]:justify-items-center max-[761px]:gap-0',
          ]}
        >
          <RivalAvatar {mood} small={compact} class={compact ? '' : 'max-[761px]:size-16'} />
          <div>
            <p class="text-[0.8rem] text-ink-600 max-[761px]:hidden">
              {copy('Tvůj soupeř', 'Your rival')}
            </p>
            <h1
              class={[
                'my-1 leading-[1.1] tracking-[-0.035em]',
                compact
                  ? 'text-[1.65rem] max-[761px]:m-0 max-[761px]:text-[0.8rem]'
                  : 'text-[2.5rem] max-[761px]:text-[1.8rem] max-[481px]:text-[2rem]',
              ]}
            >
              {name}
            </h1>
            <p
              class={['text-[0.88rem] leading-[1.4] text-ink-700', compact && 'max-[761px]:hidden']}
            >
              {rivalPersonalities[rivalId].title[$motherTongue]}
            </p>
          </div>
        </div>
        <div
          class={[
            'rounded-xl border border-cobalt-100 bg-cobalt-50 text-ink-800',
            compact
              ? 'mt-[1.7rem] px-[1.2rem] py-[1.1rem] text-[0.88rem] leading-[1.65] max-[761px]:m-0 max-[761px]:p-3 max-[761px]:text-[0.8rem] max-[761px]:leading-[1.45]'
              : 'mt-[1.7rem] px-[1.2rem] py-[1.1rem] text-[0.98rem] leading-[1.65] max-[761px]:mt-[0.8rem] max-[761px]:px-[0.9rem] max-[761px]:py-3 max-[761px]:text-[0.85rem] max-[761px]:leading-normal',
          ]}
          data-testid="rival-speech"
          aria-live={playing ? 'off' : 'polite'}
        >
          <p>{quote}</p>
        </div>
        {#if !playing}
          <details
            class={['mt-4 text-[0.83rem] max-[761px]:mt-1', compact && 'max-[761px]:col-span-full']}
          >
            <summary class={summary}>{copy('Promluvit se soupeřem', 'Talk to your rival')}</summary>
            {@render scoutingContent()}
          </details>
        {/if}
      </aside>

      <div class="min-w-0">
        {#if error}<p
            role="alert"
            class="mb-4 rounded-[10px] border border-coral-200 bg-coral-50 p-[0.9rem] text-coral-800"
          >
            {error}
          </p>{/if}
        {#if playing && match && lastRound}
          <div
            class="mb-4 flex items-center justify-between gap-4 text-[0.88rem] [&_strong]:text-[1.8rem] [&_strong]:tabular-nums"
            role="group"
            aria-label={copy(
              `Skóre: Ty ${score.user}, ${name} ${score.bot}`,
              `Score: You ${score.user}, ${name} ${score.bot}`,
            )}
          >
            <span class="flex items-center gap-[0.7rem]"
              >{copy('Ty', 'You')} <strong>{score.user}</strong></span
            >
            <div class="flex gap-[0.3rem]" aria-hidden="true">
              {#each [0, 1, 2, 3, 4] as index}<i
                  class={[
                    'size-[0.45rem] rounded-full',
                    rounds[index]?.result
                      ? 'bg-cobalt-700'
                      : index === rounds.length - 1
                        ? 'bg-ink-950'
                        : 'bg-paper-200',
                  ]}
                ></i>{/each}
            </div>
            <span class="flex items-center gap-[0.7rem]"><strong>{score.bot}</strong> {name}</span>
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
          <section
            class="rounded-[14px] border border-line bg-paper-50 p-[1.8rem] max-[481px]:p-[1.2rem]"
          >
            <p class="mb-3 text-[0.8rem] text-ink-600">
              {copy('5 otázek · bez časomíry', '5 questions · no timer')} · {$appStore.settings
                ?.grammarLevel ?? 'A1.1'}
            </p>
            <h2
              class="text-[1.9rem] leading-[1.2] tracking-[-0.03em] text-balance [overflow-wrap:anywhere] max-[481px]:text-[1.65rem]"
            >
              {copy('Dáme si souboj?', 'Ready for a match?')}
            </h2>
            <p class="mt-[0.9rem] text-[0.94rem] leading-[1.6] text-ink-700">
              {copy(
                'Procvičíš svá slovíčka a gramatiku. Soupeř se přizpůsobí tvým odpovědím a po každém kole uvidíš vysvětlení.',
                'Practise your vocabulary and grammar. Your rival adapts to your answers, with an explanation after each round.',
              )}
            </p>
            <RivalStrategyPicker bind:strategy language={$motherTongue} />
            <button
              class="btn-base btn-primary mt-[0.65rem] w-full"
              onclick={start}
              disabled={busy || !hasEnoughQuestions}
              >{busy
                ? copy('Připravuji první tah…', 'Preparing the opening…')
                : copy('Začít souboj', 'Start match')}<ArrowRight
                size={18}
                aria-hidden="true"
              /></button
            >
            {#if !hasEnoughQuestions}<p class={note}>
                {copy(
                  'Na souboj chybí otázky. Přidej slovíčka do knihovny.',
                  'Not enough questions for a match. Add vocabulary to your library.',
                )} <a href="/create/">{copy('Přidat slovíčka', 'Add vocabulary')}</a>
              </p>{/if}
            <details class="mt-3 text-[0.83rem]">
              <summary class={summary}>{copy('Jak se hraje', 'How to play')}</summary>
              <ul
                class="mt-[0.4rem] grid list-disc gap-2 pb-2 pl-[1.1rem] text-[0.85rem] leading-normal"
              >
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
        {#if playing || !match?.completedAt}<p class={note}>
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
