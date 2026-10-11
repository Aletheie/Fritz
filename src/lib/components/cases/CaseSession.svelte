<script lang="ts">
  import LoadingState from '$lib/components/LoadingState.svelte';
  import { caseFiles } from '$lib/domain/cases/catalog.ts';
  import { emptyCaseAnswer } from '$lib/domain/cases/engine.ts';
  import { caseRules } from '$lib/domain/cases/rules.ts';
  import type { CaseCommand, CaseFile, CaseStage } from '$lib/domain/cases/types.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import { onMount, tick } from 'svelte';
  import CaseDecision from './CaseDecision.svelte';
  import CaseDocuments from './CaseDocuments.svelte';
  import CaseEnding from './CaseEnding.svelte';
  import CaseNotebook from './CaseNotebook.svelte';

  let { caseFile }: { caseFile: CaseFile } = $props();
  let ready = $state(false);
  let busy = $state(false);
  let loadFailed = $state(false);
  let failedCommand = $state<CaseCommand>();
  let stageOverride = $state<CaseStage>();
  let mobilePane = $state<'documents' | 'decision'>('documents');
  const cs = $derived($motherTongue === 'cs');
  const progress = $derived($appStore.course.cases?.[caseFile.id]);
  const index = $derived(progress?.stepIndex ?? 0);
  const done = $derived(Boolean(progress?.completedAt));
  const step = $derived(caseFile.steps[Math.min(index, caseFile.steps.length - 1)]);
  const answer = $derived(progress?.answers[index] ?? emptyCaseAnswer());
  const rule = $derived(caseRules[caseFile.id].steps[Math.min(index, caseFile.steps.length - 1)]);
  const stage = $derived(
    answer.feedback === 'correct'
      ? 'feedback'
      : (stageOverride ?? (answer.choiceId ? 'evidence' : 'read')),
  );
  const documents = $derived(
    caseFile.documents.filter((document) => (document.availableFrom ?? 0) <= index),
  );
  const newDocumentIds = $derived(
    documents
      .filter((document) => document.availableFrom === index && index > 0)
      .map((document) => document.id),
  );
  const nextDocumentCount = $derived(
    caseFile.documents.filter((document) => document.availableFrom === index + 1).length,
  );
  const evidence = $derived(
    documents.flatMap((document) =>
      document.lines
        .filter((line) => answer.clueIds.includes(line.id))
        .map((line) => ({ ...line, source: document.title[$motherTongue] })),
    ),
  );
  const canSubmit = $derived(
    Boolean(answer.choiceId && evidence.length === rule.clueIds.length && !answer.feedback),
  );
  const selectedReply = $derived(
    step.choices.find((choice) => choice.id === answer.choiceId)?.textDe,
  );
  const nextCase = $derived(
    caseFiles.find(
      (item) => item.id !== caseFile.id && !$appStore.course.cases?.[item.id]?.firstCompletedAt,
    ) ?? caseFiles.find((item) => item.id !== caseFile.id),
  );
  const last = $derived(index === caseFile.steps.length - 1);

  async function focusHeading(id: string) {
    await tick();
    document.getElementById(id)?.focus();
  }
  async function initialize() {
    loadFailed = false;
    try {
      await appStore.initialize();
      ready = true;
      if (answer.feedback) mobilePane = 'decision';
      await focusHeading(done ? 'ending-title' : 'question-title');
    } catch {
      loadFailed = true;
    }
  }
  onMount(() => {
    void initialize();
  });

  function showStage(next: CaseStage) {
    if (busy) return;
    stageOverride = next;
    mobilePane = next === 'read' || next === 'evidence' ? 'documents' : 'decision';
    void focusHeading(mobilePane === 'documents' ? 'documents-title' : 'decision-title');
  }
  function showTexts() {
    mobilePane = 'documents';
    void focusHeading('documents-title');
  }
  function showDecision() {
    mobilePane = 'decision';
    void focusHeading('decision-title');
  }
  async function act(command: CaseCommand) {
    if (busy) return;
    busy = true;
    failedCommand = undefined;
    try {
      await appStore.caseAction({
        ...command,
        caseId: caseFile.id,
        revision: progress?.revision ?? 0,
      });
      if (command.type === 'choose') {
        stageOverride = 'evidence';
        mobilePane = 'documents';
        await focusHeading('documents-title');
      } else if (command.type === 'submit') {
        stageOverride = undefined;
        mobilePane = 'decision';
        await focusHeading(answer.feedback === 'correct' ? 'decision-title' : 'case-feedback');
      } else if (command.type === 'continue' || command.type === 'restart') {
        stageOverride = undefined;
        mobilePane = 'documents';
        await focusHeading(done ? 'ending-title' : 'question-title');
      }
    } catch {
      failedCommand = command;
      await focusHeading('case-save-error');
    } finally {
      busy = false;
    }
  }

  const saveError =
    'mt-5 rounded-[10px] border border-coral-700 bg-coral-50 p-4 [&_p]:mt-0 [&_p]:mb-[0.8rem] [&_p]:leading-[1.6]';
  const footerButton =
    'max-[800px]:min-h-12 max-[800px]:flex-1 max-[800px]:p-3 max-[800px]:text-[0.84rem]';
  const footerBack =
    'inline-flex min-h-12 max-w-[39%] items-center gap-[0.35rem] pr-1 text-left text-[0.8rem] text-ink-700';
  const footerHelp = 'max-w-[40%] text-[0.73rem] leading-[1.4] text-ink-600';
</script>

<svelte:head>
  <title>{caseFile.title[$motherTongue]} · {cs ? 'Případy' : 'Cases'} · Fritz</title>
  <meta name="description" content={caseFile.introduction[$motherTongue]} />
</svelte:head>

<div
  class="mx-auto max-w-[1140px] px-8 pt-[1.3rem] pb-[calc(3rem+var(--safe-bottom))] max-[800px]:px-4 max-[800px]:pt-[0.65rem] max-[800px]:pb-[calc(7.5rem+var(--safe-bottom))]"
>
  <header
    class="flex items-center gap-4 border-b border-line pb-3 max-[800px]:gap-[0.7rem] max-[800px]:pb-2"
  >
    <a
      href="/cases/"
      class="inline-flex min-h-11 flex-none items-center gap-[0.45rem] text-[0.83rem] text-ink-700 no-underline"
      ><ArrowLeft size={17} aria-hidden="true" />{cs ? 'Případy' : 'Cases'}</a
    >
    <span
      class="text-[0.85rem] font-semibold text-ink-700 max-[800px]:min-w-0 max-[800px]:truncate max-[800px]:text-[0.78rem]"
      >{caseFile.title[$motherTongue]}</span
    >
    <span class="ml-auto flex-none text-[0.75rem] text-ink-600 max-[800px]:text-[0.68rem]"
      >{caseFile.level} · Beta</span
    >
  </header>
  {#if loadFailed}
    <div role="alert" class={saveError}>
      <p>{cs ? 'Uložený případ se nepodařilo načíst.' : 'Your saved case could not be loaded.'}</p>
      <button class="btn-base btn-secondary" onclick={() => void initialize()}
        >{cs ? 'Načíst znovu' : 'Try again'}</button
      >
    </div>
  {:else if !ready}
    <LoadingState label={cs ? 'Otevírám případ…' : 'Opening the case…'} />
  {:else if done && progress}
    <h1 class="mt-6 text-[1rem] font-semibold text-ink-600">{caseFile.title[$motherTongue]}</h1>
    <CaseEnding
      {caseFile}
      {progress}
      {nextCase}
      language={$motherTongue}
      {busy}
      onrestart={() => void act({ type: 'restart' })}
    />
  {:else}
    <header class="mt-[1.9rem] mb-[1.4rem] max-[800px]:mt-[1.4rem] max-[800px]:mb-[1.6rem]">
      <div
        class="mb-3 flex justify-between gap-4 text-[0.78rem] text-ink-600 max-[800px]:gap-[0.65rem] max-[800px]:text-[0.73rem]"
      >
        <span
          >{cs
            ? `${step.title.cs} · ${index + 1} ze ${caseFile.steps.length}`
            : `${step.title.en} · ${index + 1} of ${caseFile.steps.length}`}</span
        >
        <span
          class="text-[0.72rem] max-[800px]:max-w-[55%] max-[800px]:text-right max-[800px]:text-[0.68rem]"
          role="status"
          >{failedCommand
            ? cs
              ? 'Poslední změna není uložená'
              : 'Last change not saved'
            : busy
              ? cs
                ? 'Ukládám…'
                : 'Saving…'
              : progress
                ? cs
                  ? 'Průběžně uloženo'
                  : 'Progress saved'
                : cs
                  ? 'Postup se ukládá automaticky'
                  : 'Progress saves automatically'}</span
        >
      </div>
      <h1
        class="m-0 max-w-[52rem] scroll-mt-[1.2rem] text-[clamp(1.65rem,3vw,2.45rem)] leading-[1.18] font-[740] tracking-[-0.035em]"
        id="question-title"
        tabindex="-1"
      >
        {step.question[$motherTongue]}
      </h1>
      <p
        class="mt-[0.85rem] max-w-3xl text-[1.02rem] leading-[1.65] text-ink-700 max-[800px]:mt-[0.65rem] max-[800px]:text-[0.94rem] max-[800px]:leading-[1.6]"
      >
        {step.context[$motherTongue]}
      </p>
    </header>
    <CaseNotebook {caseFile} {progress} language={$motherTongue} />
    {#if stage === 'evidence' && mobilePane === 'documents'}
      <div
        class="hidden max-[800px]:mb-5 max-[800px]:block max-[800px]:border-b max-[800px]:border-line max-[800px]:pb-4"
      >
        <span class="text-[0.75rem] text-ink-600">{cs ? 'Tvoje odpověď' : 'Your answer'}</span>
        <p class="mt-[0.35rem] text-[0.95rem] leading-[1.6] font-semibold" lang="de">
          {selectedReply}
        </p>
        <button
          class="min-h-11 text-[0.8rem] text-ink-600 underline underline-offset-[3px]"
          disabled={busy}
          onclick={() => showStage('answer')}>{cs ? 'Změnit odpověď' : 'Change answer'}</button
        >
      </div>
    {/if}
    <div
      class="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] items-start gap-12 max-[800px]:block"
    >
      <div class={['min-w-0', mobilePane !== 'documents' && 'max-[800px]:hidden']}>
        {#key index}
          <CaseDocuments
            {documents}
            initialDocumentId={step.startDocumentId}
            {newDocumentIds}
            remainingCount={caseFile.documents.length - documents.length}
            language={$motherTongue}
            selected={answer.clueIds}
            disabled={busy}
            marking={stage === 'evidence'}
            requiredCount={rule.clueIds.length}
            onselect={(clueId) => act({ type: 'evidence', clueId })}
          />
        {/key}
      </div>
      <div
        class={[
          'sticky top-4 min-w-0 pt-[1.9rem] max-[800px]:static max-[800px]:pt-0',
          mobilePane !== 'decision' && 'max-[800px]:hidden',
        ]}
      >
        <CaseDecision
          {step}
          {stage}
          {answer}
          {evidence}
          requiredCount={rule.clueIds.length}
          language={$motherTongue}
          {busy}
          {last}
          {nextDocumentCount}
          oncommand={act}
          onstage={showStage}
          onread={showTexts}
        />
      </div>
    </div>
    <footer
      class="hidden max-[800px]:fixed max-[800px]:inset-x-0 max-[800px]:bottom-0 max-[800px]:z-20 max-[800px]:flex max-[800px]:items-center max-[800px]:justify-between max-[800px]:gap-3 max-[800px]:border-t max-[800px]:border-line max-[800px]:bg-paper-50 max-[800px]:px-4 max-[800px]:pt-[0.65rem] max-[800px]:pb-[calc(0.75rem+var(--safe-bottom))]"
      aria-label={cs ? 'Další krok' : 'Next step'}
    >
      {#if stage === 'read'}
        <span class={footerHelp}
          >{cs
            ? 'Prozkoumej texty a zkus je propojit.'
            : 'Read the texts and connect the clues.'}</span
        >
        <button class="btn-base btn-primary {footerButton}" onclick={() => showStage('answer')}
          >{cs ? 'Mám teorii' : 'I have a theory'}<ArrowRight
            size={17}
            aria-hidden="true"
          /></button
        >
      {:else if stage === 'answer'}
        <button class={footerBack} onclick={showTexts}
          ><ArrowLeft size={16} aria-hidden="true" />{cs ? 'Texty' : 'Texts'}</button
        >
        {#if mobilePane === 'documents'}<button
            class="btn-base btn-primary {footerButton}"
            onclick={showDecision}
            >{cs ? 'Vybrat odpověď' : 'Choose an answer'}<ArrowRight
              size={17}
              aria-hidden="true"
            /></button
          >
        {:else}<span class={footerHelp}
            >{cs ? 'Pokračuj zvolením odpovědi.' : 'Choose an answer to continue.'}</span
          >{/if}
      {:else if stage === 'evidence'}
        <button
          class={footerBack}
          onclick={() => (mobilePane === 'documents' ? showDecision() : showTexts())}
          >{mobilePane === 'documents'
            ? cs
              ? 'Tvoje odpověď'
              : 'Your answer'
            : cs
              ? 'Zpět k textům'
              : 'Back to texts'}</button
        >
        <button
          class="btn-base btn-primary {footerButton}"
          disabled={busy || !canSubmit}
          onclick={() => void act({ type: 'submit' })}
          >{cs ? 'Potvrdit odpověď' : 'Confirm answer'}<span class="text-[0.75rem] tabular-nums"
            >{evidence.length}/{rule.clueIds.length}</span
          ></button
        >
      {:else if mobilePane === 'documents'}
        <button
          class="btn-base btn-primary {footerButton} max-[800px]:w-full"
          onclick={showDecision}
          >{cs ? 'Zpět k vysvětlení' : 'Back to the explanation'}<ArrowRight
            size={17}
            aria-hidden="true"
          /></button
        >
      {:else}
        <button class={footerBack} onclick={showTexts}>{cs ? 'Texty' : 'Texts'}</button>
        <button
          class="btn-base btn-primary {footerButton}"
          disabled={busy}
          onclick={() => void act({ type: 'continue' })}
          >{last
            ? cs
              ? 'Uzavřít případ'
              : 'Close the case'
            : cs
              ? 'Pokračovat v pátrání'
              : 'Follow the trail'}<ArrowRight size={17} aria-hidden="true" /></button
        >
      {/if}
    </footer>
  {/if}
  {#if failedCommand}
    <div class={saveError} role="alert" tabindex="-1" id="case-save-error">
      <p>
        {cs
          ? 'Poslední změnu se nepodařilo uložit. Předchozí postup zůstává zachovaný.'
          : 'The last change could not be saved. Your previous progress is preserved.'}
      </p>
      <button
        class="btn-base btn-secondary"
        disabled={busy}
        onclick={() => {
          if (failedCommand) void act(failedCommand);
        }}>{cs ? 'Zkusit uložit znovu' : 'Retry saving'}</button
      >
    </div>
  {/if}
</div>
