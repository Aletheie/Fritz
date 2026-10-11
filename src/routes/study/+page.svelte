<script lang="ts">
  import { page } from '$app/state';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import ClozeAnswer from '$lib/components/study/ClozeAnswer.svelte';
  import FlashcardReveal from '$lib/components/study/FlashcardReveal.svelte';
  import LongTermSetup from '$lib/components/study/LongTermSetup.svelte';
  import MemoryPlanPanel from '$lib/components/study/MemoryPlanPanel.svelte';
  import PairMatchingBoard from '$lib/components/study/PairMatchingBoard.svelte';
  import SentenceAnswer from '$lib/components/study/SentenceAnswer.svelte';
  import SessionComplete from '$lib/components/study/SessionComplete.svelte';
  import SpeakingAnswer from '$lib/components/study/SpeakingAnswer.svelte';
  import StudyChoiceGrid from '$lib/components/study/StudyChoiceGrid.svelte';
  import StudyFeedback from '$lib/components/study/StudyFeedback.svelte';
  import StudyPrompt from '$lib/components/study/StudyPrompt.svelte';
  import StudySessionHeader from '$lib/components/study/StudySessionHeader.svelte';
  import StudySetup from '$lib/components/study/StudySetup.svelte';
  import StudyWaitPanel from '$lib/components/study/StudyWaitPanel.svelte';
  import TypingAnswer from '$lib/components/study/TypingAnswer.svelte';
  import WordOrderBoard from '$lib/components/study/WordOrderBoard.svelte';
  import { masteryTier } from '$lib/domain/gamification.ts';
  import { isCountedReview, remainingDailyNewCards } from '$lib/domain/stats/learning.ts';
  import { parseStudySearchParams } from '$lib/domain/study/params.ts';
  import { weakSpotStudyHref } from '$lib/domain/study/params.ts';
  import { masteryLabel } from '$lib/domain/study/results.ts';
  import { cardReturnReason } from '$lib/domain/study/return-reason.ts';
  import { weakSpots } from '$lib/domain/study/weak-spots.ts';
  import { confusionTip } from '$lib/domain/vocabulary/confusables.ts';
  import { sortedVocabularyTags } from '$lib/domain/vocabulary/tags.ts';
  import { mistakeLabel } from '$lib/i18n/mistakes.ts';
  import { appStore, dailyProgress, gameProgress } from '$lib/state/app';
  import { StudySession } from '$lib/state/study-session.svelte.ts';
  import { onDestroy, untrack } from 'svelte';

  let session = $state.raw(new StudySession());
  let startedSearch: string | undefined;
  const copy = (cs: string, en: string) => session.copy(cs, en);

  const availableTags = $derived(sortedVocabularyTags($appStore.notes, 'cs'));
  const dailyNewAllowance = $derived(
    remainingDailyNewCards(
      $appStore.recentReviews,
      $appStore.settings?.dailyNewLimit ?? 15,
      new Date(),
    ),
  );
  const longTermTagOptions = $derived(
    ['all', ...availableTags].map((tag) => ({
      value: tag,
      count: session.dueCount(tag, dailyNewAllowance, session.sourceFilter),
    })),
  );
  const selectedLongTermCount = $derived(
    longTermTagOptions.find((option) => option.value === session.selectedTag)?.count ??
      session.dueCount(session.selectedTag, dailyNewAllowance, session.sourceFilter),
  );
  const topWeakSpot = $derived.by(() => {
    const spot = weakSpots($appStore.recentReviews, new Date())[0];
    if (!spot) return undefined;
    return {
      label: mistakeLabel(spot.tag, session.language),
      words: spot.noteIds.length,
      href: weakSpotStudyHref(spot.tag),
    };
  });
  const selectedCramCount = $derived(session.cramCards(session.selectedTag).length);
  const encounterCount = $derived.by(() => {
    const noteId = session.note?.id;
    if (!noteId) return 0;
    return (
      $appStore.recentReviews.filter(
        (review) => isCountedReview(review) && review.noteId === noteId,
      ).length + 1
    );
  });
  const returnReason = $derived(
    session.card
      ? cardReturnReason($appStore.recentReviews, session.card.id, new Date(), session.language)
      : undefined,
  );
  const mastery = $derived(
    session.card ? masteryLabel(masteryTier(session.card), session.language) : '',
  );

  // A link to /study/ with other parameters reuses this page, so each new query
  // string starts a fresh session instead of keeping the previous one.
  $effect(() => {
    const search = page.url.search;
    untrack(() => {
      if (search === startedSearch) return;
      if (startedSearch !== undefined) {
        session.destroy();
        session = new StudySession();
      }
      startedSearch = search;
      void session.initialize(parseStudySearchParams(new URLSearchParams(search)));
    });
  });

  onDestroy(() => session.destroy());

  const scrollShell =
    'h-full overflow-y-auto overscroll-contain px-[0.8rem] pt-[max(0.8rem,var(--safe-top))] pb-[max(1.5rem,var(--safe-bottom))] short-desktop:pb-[max(1.25rem,var(--safe-bottom))]';
</script>

<svelte:head>
  <title
    >{session.mode === 'cram'
      ? copy('Sprint na test', 'Test sprint')
      : copy('Procvičování slovíček', 'Vocabulary practice')} – Fritz</title
  >
</svelte:head>

<svelte:window onkeydown={(event) => session.handleKeydown(event)} />

{#if session.phase === 'loading' || !$appStore.ready || !$appStore.settings}
  <div class={scrollShell}>
    <LoadingState label={copy('Připravuji slovíčka…', 'Preparing your vocabulary…')} />
  </div>
{:else if session.phase === 'setup' && session.mode === 'long-term'}
  <div class={scrollShell}>
    <LongTermSetup
      bind:selectedTag={session.selectedTag}
      bind:sessionSize={session.sessionSize}
      sourceFilter={session.sourceFilter}
      tags={longTermTagOptions}
      dueCount={selectedLongTermCount}
      resume={session.resumeSummary}
      weakSpot={topWeakSpot}
      onsourcechange={(value) => session.changeSourceFilter(value)}
      onstart={() => session.startConfiguredLongTerm()}
      onresume={() => session.resume()}
    />
    {#if session.errorMessage}<p
        class="mx-auto mt-4 max-w-[39rem] rounded-[0.2rem] border border-coral-700 bg-coral-50 p-[0.85rem] text-[0.82rem] font-bold text-coral-700"
        role="alert"
      >
        {session.errorMessage}
      </p>{/if}
  </div>
{:else if session.phase === 'setup'}
  <div class={scrollShell}>
    <StudySetup
      bind:duration={session.cramDuration}
      bind:selectedTag={session.selectedTag}
      tags={availableTags}
      cardCount={selectedCramCount}
      onstart={() => session.startConfiguredCram()}
    />
    {#if session.errorMessage}<p
        class="mx-auto mt-4 max-w-[39rem] rounded-[0.2rem] border border-coral-700 bg-coral-50 p-[0.85rem] text-[0.82rem] font-bold text-coral-700"
        role="alert"
      >
        {session.errorMessage}
      </p>{/if}
  </div>
{:else if session.phase === 'complete'}
  {@const settings = $appStore.settings}
  <div class={scrollShell}>
    <SessionComplete
      mode={session.mode}
      reviews={session.reviews}
      successes={session.successes}
      xp={settings.gamificationEnabled ? session.xp : 0}
      streak={$gameProgress.streak}
      goalReached={$dailyProgress.reached}
      goalNewlyReached={$dailyProgress.reached && !session.startGoalReached}
      level={$gameProgress.level}
      missionSummary={$gameProgress.missionSummary}
      rival={settings.rivalryEnabled ? $gameProgress.rival : undefined}
      leveledUp={$gameProgress.level.level > session.startLevel}
      newMissions={Math.max(
        0,
        $gameProgress.missionSummary.completed - session.startCompletedMissions,
      )}
      bestCombo={session.bestCombo}
      celebrations={settings.gamificationEnabled && settings.celebrations}
      gamificationEnabled={settings.gamificationEnabled}
      nextDueAt={session.nextPlannedAt}
      remainingDueCount={session.remainingDueCount}
      onsetup={() => session.resetSetup()}
    />
  </div>
{:else}
  {@const settings = $appStore.settings}
  <div
    class="mx-auto max-w-[72rem] max-[900px]:grid max-[900px]:h-full max-[900px]:min-h-0 max-[900px]:w-full max-[900px]:max-w-none max-[900px]:grid-rows-[auto_minmax(0,1fr)] max-[900px]:overflow-hidden max-[900px]:bg-paper-50 min-[900px]:px-4 min-[900px]:pt-[clamp(1rem,3vh,2rem)] min-[900px]:pb-10"
  >
    <StudySessionHeader
      sprint={session.mode === 'cram'}
      progress={session.progress}
      done={session.mode === 'cram' ? session.sprintProgress.mastered : session.completedCount}
      total={session.mode === 'cram' ? session.sprintProgress.total : session.target}
      scope={session.weakSpot
        ? copy('slabiny', 'weak spots')
        : session.selectedTag === 'all'
          ? copy('všechny skupiny', 'all groups')
          : session.selectedTag}
      pace={session.mode === 'long-term'
        ? copy('pevná dávka', 'fixed batch')
        : `${session.cramDuration} min`}
      xp={session.xp}
      onpause={() => session.pause()}
    />

    {#if session.phase === 'waiting'}
      <StudyWaitPanel {session} />
    {:else if session.phase === 'question' && session.note && session.card}
      {@const note = session.note}
      {@const result = session.result}
      {@const feedbackShown = Boolean(result && session.exercise !== 'flashcard')}
      <div
        class="mt-5 grid gap-4 max-[900px]:mt-0 max-[900px]:h-full max-[900px]:min-h-0 max-[900px]:gap-0 max-[900px]:overflow-hidden min-[900px]:grid-cols-[minmax(0,1fr)_18rem] min-[900px]:gap-[1.35rem]"
      >
        <section
          class="relative overflow-hidden rounded-[0.35rem_1.5rem_0.35rem_0.35rem] border border-ink-950 bg-paper-50 shadow-[7px_7px_0_var(--color-ink-950)] max-[900px]:h-full max-[900px]:min-h-0 max-[900px]:rounded-none max-[900px]:border-0 max-[900px]:shadow-none"
        >
          <div
            class="absolute inset-y-0 left-0 w-[2.55rem] border-r border-coral-500 bg-[repeating-linear-gradient(to_bottom,transparent_0_27px,rgb(25_31_36/0.08)_27px_28px)] max-[900px]:w-[2.1rem] max-[521px]:w-[1.9rem]"
            aria-hidden="true"
          >
            <span
              class="sticky top-4 block pt-4 text-center font-mono text-[0.68rem] font-extrabold text-coral-700"
              >{String(session.reviews + 1).padStart(2, '0')}</span
            >
          </div>
          <div
            class={[
              'min-h-[34rem] pt-[1.3rem] pr-5 pb-[1.6rem] pl-[3.7rem] max-[900px]:h-full max-[900px]:min-h-0 max-[900px]:[scrollbar-width:none] max-[900px]:overflow-y-auto max-[900px]:overscroll-contain max-[900px]:pt-[0.85rem] max-[900px]:pr-[0.8rem] max-[900px]:pl-[2.85rem] max-[521px]:pt-[0.7rem] max-[521px]:pr-[0.7rem] max-[521px]:pl-[2.55rem] min-[640px]:pt-[1.7rem] min-[640px]:pr-8 min-[640px]:pb-8 min-[640px]:pl-[4.6rem] [&::-webkit-scrollbar]:max-[900px]:hidden',
              feedbackShown
                ? 'max-[900px]:pb-[min(52dvh,26rem)]'
                : 'max-[900px]:pb-[calc(1rem+env(safe-area-inset-bottom))] max-[521px]:pb-[calc(0.8rem+env(safe-area-inset-bottom))]',
            ]}
          >
            <StudyPrompt
              {session}
              {encounterCount}
              {mastery}
              {returnReason}
              showStudyTips={settings.showStudyTips}
            />

            {#if session.exercise === 'typing'}
              <TypingAnswer
                {session}
                {note}
                showKeyboardHints={settings.showKeyboardHints}
                showStudyTips={settings.showStudyTips}
              />
            {:else if session.exercise === 'choice'}
              <StudyChoiceGrid
                options={session.choices}
                answerId={note.id}
                selectedId={result?.signal.selectedChoice}
                revealed={Boolean(result)}
                disabled={Boolean(result) || session.reviewing}
                onchoose={(option) => void session.choose(option)}
              />
            {:else if session.exercise === 'matching' && session.matching}
              <div class="mx-auto mt-6 max-w-[44rem]">
                <PairMatchingBoard
                  round={session.matching}
                  disabled={Boolean(result) || session.reviewing}
                  oncomplete={(mistakes) => session.submitMatching(mistakes)}
                />
                {#if session.matchingComplete && !result && session.errorMessage}
                  <button
                    class="btn-base btn-secondary mt-[0.8rem] w-full"
                    type="button"
                    disabled={session.reviewing}
                    onclick={() => void session.submitMatching()}
                    >{session.reviewing
                      ? copy('Ukládám…', 'Saving…')
                      : copy('Zkusit uložit výsledek znovu', 'Try saving the result again')}</button
                  >
                {/if}
              </div>
            {:else if session.exercise === 'word-order' && session.wordOrder}
              <WordOrderBoard
                exercise={session.wordOrder}
                selected={session.selectedTokens}
                locked={Boolean(result)}
                ready={session.wordOrderReady}
                reviewing={session.reviewing}
                onselect={(token) => session.selectToken(token)}
                onremove={(token) => session.removeToken(token)}
                onclear={() => session.clearTokens()}
                onsubmit={() => void session.submitWordOrder()}
              />
            {:else if session.exercise === 'cloze' && session.cloze}
              <ClozeAnswer
                {session}
                cloze={session.cloze}
                showKeyboardHints={settings.showKeyboardHints}
              />
            {:else if session.exercise === 'speaking'}
              <SpeakingAnswer {session} {note} />
            {:else if session.exercise === 'sentence'}
              <SentenceAnswer {session} {note} />
            {:else}
              <FlashcardReveal
                {note}
                bind:revealed={session.revealed}
                reviewing={session.reviewing}
                schedule={session.scheduleOptions}
                onrate={(rating) => void session.rateFlashcard(rating)}
                onspeak={() => session.speak()}
              />
            {/if}
          </div>

          {#if feedbackShown && result}
            <StudyFeedback
              {note}
              {result}
              exercise={session.exercise}
              gamificationEnabled={settings.gamificationEnabled}
              combo={session.combo}
              requireCorrection={settings.requireCorrection}
              showStudyTips={settings.showStudyTips}
              aiConfigured={session.aiAvailable}
              aiBusy={session.aiBusy}
              aiExplanation={session.aiExplanation}
              aiExplanationError={session.aiExplanationError}
              reviewing={session.reviewing}
              disputing={session.disputing}
              nextAllowed={session.nextAllowed}
              confusionTip={confusionTip(note, session.language)}
              bind:correction={session.correction}
              bind:correctionArticle={session.correctionArticle}
              onspeak={() => session.speak()}
              onexplain={() => session.explainMistake()}
              ondispute={(reason) => session.dispute(reason)}
              onadvance={() => session.advance()}
            />
          {/if}
        </section>

        <MemoryPlanPanel
          sprint={session.mode === 'cram'}
          schedule={result?.schedulePreview ?? session.scheduleOptions}
          rating={result?.rating}
          scheduledFor={result?.scheduledFor}
          note={settings.showStudyTips && session.language === 'cs' ? note.learningNote : undefined}
        />
      </div>
    {:else}
      <LoadingState label={copy('Připravuji další otázku…', 'Preparing the next question…')} />
    {/if}

    {#if session.errorMessage}<p
        class="mt-4 rounded-[0.2rem] border border-coral-700 bg-coral-50 p-[0.85rem] text-[0.82rem] font-bold text-coral-700 max-[900px]:fixed max-[900px]:inset-x-3 max-[900px]:bottom-[calc(0.75rem+env(safe-area-inset-bottom))] max-[900px]:z-50 max-[900px]:m-0 max-[900px]:shadow-[4px_4px_0_var(--color-ink-950)]"
        aria-live="assertive"
      >
        {session.errorMessage}
      </p>{/if}

    {#if session.note && session.waitMs === 0 && settings.showStudyTips}
      <p
        class="mt-[1.1rem] text-center font-mono text-[0.65rem] text-ink-600 max-[900px]:hidden min-[900px]:text-[0.75rem]"
      >
        {#if session.exercise === 'typing' || session.exercise === 'cloze'}{copy(
            'Enter = zkontrolovat nebo pokračovat',
            'Enter = check or continue',
          )}
        {:else if session.exercise === 'choice'}{copy('Klávesy 1–4 = výběr', 'Keys 1–4 = choose')}
        {:else if session.exercise === 'word-order'}{copy('Enter = zkontrolovat', 'Enter = check')}
        {:else if session.exercise === 'sentence'}{copy(
            'Ctrl/⌘ + Enter = posoudit',
            'Ctrl/⌘ + Enter = evaluate',
          )}
        {:else}{copy('Mezerník = odhalit, 1–4 = hodnocení', 'Space = reveal, 1–4 = rating')}{/if}
      </p>
    {/if}
  </div>
{/if}
