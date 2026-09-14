<script lang="ts">
  import type {
    CaseCommand,
    CaseEvidence,
    CaseStage,
    CaseStep,
    CaseStepProgress,
  } from '$lib/domain/cases/types.ts';
  import type { MotherTongue } from '$lib/domain/types.ts';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';
  import X from '@lucide/svelte/icons/x';

  let {
    step,
    stage,
    answer,
    evidence,
    requiredCount,
    language,
    busy,
    last,
    nextDocumentCount,
    oncommand,
    onstage,
    onread,
  }: {
    step: CaseStep;
    stage: CaseStage;
    answer: CaseStepProgress;
    evidence: CaseEvidence[];
    requiredCount: number;
    language: MotherTongue;
    busy: boolean;
    last: boolean;
    nextDocumentCount: number;
    oncommand: (command: CaseCommand) => Promise<void>;
    onstage: (stage: CaseStage) => void;
    onread: () => void;
  } = $props();
  const cs = $derived(language === 'cs');
  const choice = $derived(step.choices.find((item) => item.id === answer.choiceId));
  const canSubmit = $derived(
    Boolean(choice && evidence.length === requiredCount && !answer.feedback),
  );
</script>

<section class="decision" aria-labelledby="decision-title">
  {#if stage === 'read'}
    <h2 id="decision-title" tabindex="-1">
      {cs ? 'Začni u stop' : 'Start with the clues'}
    </h2>
    <ol class="reading-guide">
      <li>
        {cs
          ? 'Přečti podklady a hledej souvislosti. Mezi texty přepínáš jejich názvy.'
          : 'Read the documents and look for connections. Use their titles to switch between texts.'}
      </li>
      <li>
        {cs
          ? 'Až budeš mít teorii, vyber odpověď na otázku nahoře.'
          : 'When you have a theory, choose an answer to the question above.'}
      </li>
      <li>
        {cs
          ? 'Dolož ji zvýrazněním stop v textu. Ověřený závěr se zapíše do zápisníku.'
          : 'Support it by highlighting clues in the texts. Confirmed findings go into your notebook.'}
      </li>
    </ol>
    <button class="btn-base btn-primary main-action" onclick={() => onstage('answer')}
      >{cs ? 'Mám teorii' : 'I have a theory'}<ArrowRight size={17} aria-hidden="true" /></button
    >
    <p class="quiet-note">
      {cs
        ? 'Ke všem textům se můžeš kdykoli vrátit.'
        : 'You can return to any text whenever you need.'}
    </p>
  {:else if stage === 'answer'}
    <h2 id="decision-title" tabindex="-1">{cs ? 'Která verze sedí?' : 'Which theory fits?'}</h2>
    <p class="instruction">
      {cs
        ? 'Vyber závěr, který odpovídá stopám. Potom ho doložíš přímo v textech.'
        : 'Choose the conclusion that fits the clues. Then support it with passages from the texts.'}
    </p>
    {#if answer.feedback === 'choice' && choice}
      <p class="correction">{choice.feedback[language]}</p>
    {/if}
    <div class="answers" role="group" aria-label={cs ? 'Možné odpovědi' : 'Possible answers'}>
      {#each step.choices as item}
        <button
          class="answer"
          disabled={busy || (answer.feedback === 'choice' && item.id === answer.choiceId)}
          onclick={() => void oncommand({ type: 'choose', choiceId: item.id })}
        >
          <span lang="de">{item.textDe}</span><ArrowRight size={17} aria-hidden="true" />
        </button>
      {/each}
    </div>
    <button class="text-button" onclick={onread}
      >{cs ? 'Vrátit se k textům' : 'Return to the texts'}</button
    >
  {:else if stage === 'evidence'}
    <div class="chosen-reply">
      <div>
        <span>{cs ? 'Tvoje odpověď' : 'Your answer'}</span><button
          class="text-button"
          disabled={busy}
          onclick={() => onstage('answer')}>{cs ? 'Změnit' : 'Change'}</button
        >
      </div>
      <p lang="de">{choice?.textDe}</p>
    </div>
    <h2 id="decision-title" tabindex="-1">{cs ? 'Z čeho to vyplývá?' : 'What supports it?'}</h2>
    <p class="instruction">
      {cs
        ? `V podkladech zvýrazni ${requiredCount === 1 ? 'jednu pasáž' : 'dvě pasáže'}, které odpověď potvrzují.`
        : `Highlight ${requiredCount === 1 ? 'one passage' : 'two passages'} in the documents to support your answer.`}
    </p>
    {#if answer.feedback}
      <div class="correction" id="case-feedback" tabindex="-1">
        <h3>
          {answer.feedback === 'choice'
            ? cs
              ? 'Tuhle odpověď je potřeba změnit.'
              : 'This answer needs another look.'
            : cs
              ? 'Odpověď sedí. Zkus jiné pasáže.'
              : 'The answer fits. Try different passages.'}
        </h3>
        <p>
          {answer.feedback === 'choice'
            ? choice?.feedback[language]
            : cs
              ? 'Označený text odpověď nepotvrzuje. Podívej se znovu do podkladů; nápověda ti ukáže, co hledat.'
              : 'The highlighted text does not support your answer. Look through the documents again; a hint can show you what to look for.'}
        </p>
        <button
          class="text-button"
          onclick={() => (answer.feedback === 'choice' ? onstage('answer') : onread())}
          >{answer.feedback === 'choice'
            ? cs
              ? 'Změnit odpověď'
              : 'Change the answer'
            : cs
              ? 'Znovu se podívat do textů'
              : 'Look at the texts again'}</button
        >
      </div>
    {/if}
    <div class="evidence-list">
      <p class="evidence-count" role="status">
        {cs
          ? `Zvýrazněno ${evidence.length} ze ${requiredCount}`
          : `${evidence.length} of ${requiredCount} highlighted`}
      </p>
      {#if evidence.length}
        <ul>
          {#each evidence as item}
            <li>
              <div><small>{item.source}</small><q lang="de">{item.textDe}</q></div>
              <button
                class="remove-evidence"
                disabled={busy}
                aria-label={`${cs ? 'Zrušit zvýraznění' : 'Remove highlight'}: ${item.textDe}`}
                onclick={() => void oncommand({ type: 'evidence', clueId: item.id })}
                ><X size={15} aria-hidden="true" /></button
              >
            </li>
          {/each}
        </ul>
      {/if}
      {#if evidence.length > requiredCount}<p class="instruction">
          {cs
            ? 'Pasáží je moc. Ponech jen ty, které odpověď přímo potvrzují.'
            : 'There are too many passages. Keep only the ones that directly support the answer.'}
        </p>{/if}
    </div>
    <button
      class="btn-base btn-primary main-action"
      disabled={busy || !canSubmit}
      onclick={() => void oncommand({ type: 'submit' })}
      >{cs ? 'Potvrdit odpověď' : 'Confirm answer'}<ArrowRight
        size={17}
        aria-hidden="true"
      /></button
    >
  {:else}
    <div class="success-label">
      <Check size={18} aria-hidden="true" />{cs
        ? 'Závěr zapsán do zápisníku'
        : 'Finding added to your notebook'}
    </div>
    <h2 id="decision-title" tabindex="-1">
      {step.finding[language]}
    </h2>
    <p class="explanation">{step.explanation[language]}</p>
    <blockquote lang="de">{step.replyDe}</blockquote>
    {#if nextDocumentCount > 0}
      <p class="new-lead">
        {cs
          ? 'Pátrání pokračuje. V dalším kroku se otevřou nové podklady.'
          : 'The trail continues. New documents will open in the next step.'}
      </p>
    {/if}
    <details class="language-note">
      <summary>{cs ? 'Užitečný německý obrat' : 'A useful German phrase'}</summary>
      <strong lang="de">{step.language.de}</strong>
      <p>{step.language.explanation[language]}</p>
    </details>
    <button
      class="btn-base btn-primary main-action"
      disabled={busy}
      onclick={() => void oncommand({ type: 'continue' })}
      >{last
        ? cs
          ? 'Uzavřít případ'
          : 'Close the case'
        : cs
          ? 'Pokračovat v pátrání'
          : 'Follow the trail'}<ArrowRight size={17} aria-hidden="true" /></button
    >
    <button class="text-button" onclick={onread}
      >{cs ? 'Prohlédnout si zvýrazněné texty' : 'Review the highlighted texts'}</button
    >
  {/if}

  {#if stage !== 'read' && stage !== 'feedback'}
    {#if answer.hintUsed}
      <div class="hint">
        <Lightbulb size={17} aria-hidden="true" />
        <p>{step.hint[language]}</p>
      </div>
    {:else}
      <button
        class="text-button hint-button"
        disabled={busy}
        onclick={() => void oncommand({ type: 'hint' })}
        ><Lightbulb size={16} aria-hidden="true" />{cs
          ? 'Potřebuji nápovědu'
          : 'Give me a hint'}</button
      >
    {/if}
  {/if}
</section>

<style>
  h2 {
    margin: 0 0 0.8rem;
    font-size: 1.35rem;
    font-weight: 720;
    line-height: 1.3;
    letter-spacing: -0.02em;
    scroll-margin-top: 1.5rem;
  }
  .instruction,
  .explanation {
    margin: 0 0 1.2rem;
    color: var(--color-ink-700);
    font-size: 0.92rem;
    line-height: 1.65;
  }
  .reading-guide {
    list-style: decimal;
    margin: 1.4rem 0 1.7rem;
    padding-left: 1.25rem;
    display: grid;
    gap: 1rem;
    font-size: 0.94rem;
    line-height: 1.6;
    color: var(--color-ink-700);
  }
  .reading-guide li {
    padding-left: 0.3rem;
  }
  .reading-guide li::marker {
    color: var(--color-ink-600);
    font-size: 0.8rem;
  }
  .main-action {
    width: 100%;
    min-height: 48px;
  }
  .quiet-note {
    font-size: 0.78rem;
    line-height: 1.5;
    margin-top: 0.85rem;
    color: var(--color-ink-600);
  }
  .new-lead {
    font-size: 0.86rem;
    font-weight: 600;
    line-height: 1.6;
    color: var(--color-cobalt-700);
    margin: 0 0 1.25rem;
  }
  .answers {
    display: grid;
    gap: 0.65rem;
  }
  .answer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    min-height: 64px;
    padding: 1rem;
    background: var(--color-paper-50);
    border: 1px solid var(--color-line);
    border-radius: 10px;
    text-align: left;
  }
  .answer span {
    font-size: 1rem;
    line-height: 1.6;
  }
  .answer :global(svg) {
    flex: none;
    color: var(--color-ink-600);
  }
  .answer:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .text-button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 44px;
    padding: 0.6rem 0;
    color: var(--color-ink-700);
    font-size: 0.84rem;
    text-align: left;
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .chosen-reply {
    margin-bottom: 1.65rem;
    padding-bottom: 1.15rem;
    border-bottom: 1px solid var(--color-line);
  }
  .chosen-reply > div {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .chosen-reply > div > span {
    font-size: 0.78rem;
    color: var(--color-ink-600);
  }
  .chosen-reply p {
    margin: 0.25rem 0 0;
    font-size: 1.04rem;
    font-weight: 600;
    line-height: 1.65;
  }
  .evidence-list {
    margin: 1.1rem 0 1.4rem;
  }
  .evidence-count {
    font-size: 0.82rem;
    font-weight: 650;
    margin: 0 0 0.5rem;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 0.8rem;
  }
  ul li {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }
  li > div {
    flex: 1;
    min-width: 0;
  }
  small {
    display: block;
    color: var(--color-ink-600);
    font-size: 0.73rem;
    margin: 0.2rem 0;
  }
  q {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-size: 0.88rem;
    line-height: 1.6;
  }
  .remove-evidence {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 8px;
    color: var(--color-ink-600);
  }
  .correction {
    padding: 1rem;
    background: var(--color-orange-100);
    border-radius: 10px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    line-height: 1.65;
  }
  .correction h3 {
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
    font-weight: 700;
  }
  .correction p {
    margin: 0;
  }
  .hint {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
    padding: 0.85rem 0;
    font-size: 0.85rem;
    line-height: 1.6;
    color: var(--color-ink-700);
  }
  .hint :global(svg) {
    flex: none;
    margin-top: 0.2rem;
  }
  .hint p {
    margin: 0;
  }
  .hint-button {
    text-decoration: none;
  }
  .success-label {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.82rem;
    color: var(--color-mint-800);
    font-weight: 650;
    margin-bottom: 0.8rem;
  }
  blockquote {
    margin: 1.3rem 0;
    padding: 1.2rem;
    border-radius: 10px;
    background: var(--color-mint-50);
    font-size: 1rem;
    line-height: 1.7;
  }
  .language-note {
    margin-bottom: 1.1rem;
    font-size: 0.88rem;
    line-height: 1.6;
    border-bottom: 1px solid var(--color-line);
    padding-bottom: 0.5rem;
  }
  summary {
    min-height: 44px;
    align-content: center;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .language-note strong {
    display: block;
    margin-top: 0.5rem;
  }
  .language-note p {
    margin: 0.3rem 0 0.7rem;
  }
  @media (hover: hover) and (pointer: fine) {
    .answer:not(:disabled):hover {
      border-color: var(--color-ink-700);
    }
    .remove-evidence:hover {
      background: var(--color-paper-200);
    }
  }
  @media (max-width: 799px) {
    .main-action {
      display: none;
    }
    h2 {
      font-size: 1.22rem;
    }
  }
</style>
