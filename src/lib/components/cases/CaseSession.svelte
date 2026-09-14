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
</script>

<svelte:head>
  <title>{caseFile.title[$motherTongue]} · {cs ? 'Případy' : 'Cases'} · Fritz</title>
  <meta name="description" content={caseFile.introduction[$motherTongue]} />
</svelte:head>

<div class="case-shell">
  <header class="session-header">
    <a href="/cases/" class="back-link"
      ><ArrowLeft size={17} aria-hidden="true" />{cs ? 'Případy' : 'Cases'}</a
    >
    <span class="case-name">{caseFile.title[$motherTongue]}</span>
    <span class="case-meta">{caseFile.level} · Beta</span>
  </header>
  {#if loadFailed}
    <div role="alert" class="save-error">
      <p>{cs ? 'Uložený případ se nepodařilo načíst.' : 'Your saved case could not be loaded.'}</p>
      <button class="btn-base btn-secondary" onclick={() => void initialize()}
        >{cs ? 'Načíst znovu' : 'Try again'}</button
      >
    </div>
  {:else if !ready}
    <LoadingState label={cs ? 'Otevírám případ…' : 'Opening the case…'} />
  {:else if done && progress}
    <h1 class="completed-name">{caseFile.title[$motherTongue]}</h1>
    <CaseEnding
      {caseFile}
      {progress}
      {nextCase}
      language={$motherTongue}
      {busy}
      onrestart={() => void act({ type: 'restart' })}
    />
  {:else}
    <header class="question-header">
      <div class="question-meta">
        <span
          >{cs
            ? `${step.title.cs} · ${index + 1} ze ${caseFile.steps.length}`
            : `${step.title.en} · ${index + 1} of ${caseFile.steps.length}`}</span
        >
        <span class="saved-note" role="status"
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
      <h1 id="question-title" tabindex="-1">{step.question[$motherTongue]}</h1>
      <p>{step.context[$motherTongue]}</p>
    </header>
    <CaseNotebook {caseFile} {progress} language={$motherTongue} />
    {#if stage === 'evidence' && mobilePane === 'documents'}
      <div class="mobile-reply">
        <span>{cs ? 'Tvoje odpověď' : 'Your answer'}</span>
        <p lang="de">{selectedReply}</p>
        <button disabled={busy} onclick={() => showStage('answer')}
          >{cs ? 'Změnit odpověď' : 'Change answer'}</button
        >
      </div>
    {/if}
    <div class="workbench">
      <div class="reading-pane" class:mobile-hidden={mobilePane !== 'documents'}>
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
      <div class="decision-pane" class:mobile-hidden={mobilePane !== 'decision'}>
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
    <footer class="mobile-actions" aria-label={cs ? 'Další krok' : 'Next step'}>
      {#if stage === 'read'}
        <span class="footer-help"
          >{cs
            ? 'Prozkoumej texty a zkus je propojit.'
            : 'Read the texts and connect the clues.'}</span
        >
        <button class="btn-base btn-primary" onclick={() => showStage('answer')}
          >{cs ? 'Mám teorii' : 'I have a theory'}<ArrowRight
            size={17}
            aria-hidden="true"
          /></button
        >
      {:else if stage === 'answer'}
        <button class="footer-back" onclick={showTexts}
          ><ArrowLeft size={16} aria-hidden="true" />{cs ? 'Texty' : 'Texts'}</button
        >
        {#if mobilePane === 'documents'}<button class="btn-base btn-primary" onclick={showDecision}
            >{cs ? 'Vybrat odpověď' : 'Choose an answer'}<ArrowRight
              size={17}
              aria-hidden="true"
            /></button
          >
        {:else}<span class="footer-help"
            >{cs ? 'Pokračuj zvolením odpovědi.' : 'Choose an answer to continue.'}</span
          >{/if}
      {:else if stage === 'evidence'}
        <button
          class="footer-back"
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
          class="btn-base btn-primary"
          disabled={busy || !canSubmit}
          onclick={() => void act({ type: 'submit' })}
          >{cs ? 'Potvrdit odpověď' : 'Confirm answer'}<span class="footer-count"
            >{evidence.length}/{rule.clueIds.length}</span
          ></button
        >
      {:else if mobilePane === 'documents'}
        <button class="btn-base btn-primary full-width" onclick={showDecision}
          >{cs ? 'Zpět k vysvětlení' : 'Back to the explanation'}<ArrowRight
            size={17}
            aria-hidden="true"
          /></button
        >
      {:else}
        <button class="footer-back" onclick={showTexts}>{cs ? 'Texty' : 'Texts'}</button>
        <button
          class="btn-base btn-primary"
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
    <div class="save-error" role="alert" tabindex="-1" id="case-save-error">
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

<style>
  .case-shell {
    max-width: 1140px;
    margin: 0 auto;
    padding: 1.3rem 2rem calc(3rem + var(--safe-bottom));
  }
  .session-header {
    display: flex;
    gap: 1rem;
    align-items: center;
    border-bottom: 1px solid var(--color-line);
    padding-bottom: 0.75rem;
  }
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 44px;
    font-size: 0.83rem;
    color: var(--color-ink-700);
    text-decoration: none;
    flex: none;
  }
  .case-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-ink-700);
  }
  .case-meta {
    margin-left: auto;
    flex: none;
    font-size: 0.75rem;
    color: var(--color-ink-600);
  }
  .question-header {
    margin: 1.9rem 0 1.4rem;
  }
  .question-meta {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.78rem;
    color: var(--color-ink-600);
    margin-bottom: 0.75rem;
  }
  .saved-note {
    font-size: 0.72rem;
  }
  h1 {
    max-width: 52rem;
    margin: 0;
    font-size: clamp(1.65rem, 3vw, 2.45rem);
    font-weight: 740;
    line-height: 1.18;
    letter-spacing: -0.035em;
    scroll-margin-top: 1.2rem;
  }
  .question-header > p {
    max-width: 48rem;
    margin: 0.85rem 0 0;
    color: var(--color-ink-700);
    font-size: 1.02rem;
    line-height: 1.65;
  }
  .workbench {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
    gap: 3rem;
    align-items: start;
  }
  .reading-pane,
  .decision-pane {
    min-width: 0;
  }
  .decision-pane {
    padding-top: 1.9rem;
    position: sticky;
    top: 1rem;
  }
  .mobile-actions,
  .mobile-reply {
    display: none;
  }
  .completed-name {
    margin-top: 1.5rem;
    font-size: 1rem;
    color: var(--color-ink-600);
    font-weight: 600;
  }
  .save-error {
    border: 1px solid var(--color-coral-700);
    border-radius: 10px;
    background: var(--color-coral-50);
    padding: 1rem;
    margin-top: 1.25rem;
  }
  .save-error p {
    margin: 0 0 0.8rem;
    line-height: 1.6;
  }
  @media (max-width: 799px) {
    .case-shell {
      padding: 0.65rem 1rem calc(7.5rem + var(--safe-bottom));
    }
    .session-header {
      gap: 0.7rem;
      padding-bottom: 0.5rem;
    }
    .case-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.78rem;
    }
    .case-meta {
      font-size: 0.68rem;
    }
    .question-header {
      margin: 1.4rem 0 1.6rem;
    }
    .question-meta {
      gap: 0.65rem;
      font-size: 0.73rem;
    }
    .saved-note {
      max-width: 55%;
      text-align: right;
      font-size: 0.68rem;
    }
    .question-header > p {
      font-size: 0.94rem;
      line-height: 1.6;
      margin-top: 0.65rem;
    }
    .workbench {
      display: block;
    }
    .mobile-hidden {
      display: none;
    }
    .decision-pane {
      padding-top: 0;
      position: static;
    }
    .mobile-reply {
      display: block;
      padding: 0 0 1rem;
      margin-bottom: 1.25rem;
      border-bottom: 1px solid var(--color-line);
    }
    .mobile-reply > span {
      font-size: 0.75rem;
      color: var(--color-ink-600);
    }
    .mobile-reply p {
      margin: 0.35rem 0 0;
      font-size: 0.95rem;
      font-weight: 600;
      line-height: 1.6;
    }
    .mobile-reply button {
      min-height: 44px;
      font-size: 0.8rem;
      color: var(--color-ink-600);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .mobile-actions {
      position: fixed;
      inset: auto 0 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.65rem 1rem calc(0.75rem + var(--safe-bottom));
      background: var(--color-paper-50);
      border-top: 1px solid var(--color-line);
    }
    .mobile-actions .btn-base {
      font-size: 0.84rem;
      padding: 0.75rem;
      min-height: 48px;
      flex: 1;
    }
    .footer-back {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      min-height: 48px;
      text-align: left;
      font-size: 0.8rem;
      color: var(--color-ink-700);
      padding-right: 0.25rem;
      max-width: 39%;
    }
    .footer-help {
      max-width: 40%;
      font-size: 0.73rem;
      line-height: 1.4;
      color: var(--color-ink-600);
    }
    .footer-count {
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
    }
    .mobile-actions .full-width {
      width: 100%;
    }
  }
</style>
