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

  const heading =
    'mt-0 mb-[0.8rem] scroll-mt-6 text-[1.35rem] leading-[1.3] font-[720] tracking-[-0.02em] max-[800px]:text-[1.22rem]';
  const instruction = 'mt-0 mb-[1.2rem] text-[0.92rem] leading-[1.65] text-ink-700';
  const mainAction = 'btn-base btn-primary min-h-12 w-full max-[800px]:hidden';
  const textButton =
    'inline-flex min-h-11 items-center gap-[0.4rem] py-[0.6rem] text-left text-[0.84rem] text-ink-700';
  const underline = 'underline underline-offset-4';
  const correction = 'mb-4 rounded-[10px] bg-orange-100 p-4 text-[0.9rem] leading-[1.65]';
</script>

<section aria-labelledby="decision-title">
  {#if stage === 'read'}
    <h2 class={heading} id="decision-title" tabindex="-1">
      {cs ? 'Začni u stop' : 'Start with the clues'}
    </h2>
    <ol
      class="mt-[1.4rem] mb-[1.7rem] grid list-decimal gap-4 pl-5 text-[0.94rem] leading-[1.6] text-ink-700 [&>li]:pl-[0.3rem] [&>li]:marker:text-[0.8rem] [&>li]:marker:text-ink-600"
    >
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
    <button class={mainAction} onclick={() => onstage('answer')}
      >{cs ? 'Mám teorii' : 'I have a theory'}<ArrowRight size={17} aria-hidden="true" /></button
    >
    <p class="mt-[0.85rem] text-[0.78rem] leading-normal text-ink-600">
      {cs
        ? 'Ke všem textům se můžeš kdykoli vrátit.'
        : 'You can return to any text whenever you need.'}
    </p>
  {:else if stage === 'answer'}
    <h2 class={heading} id="decision-title" tabindex="-1">
      {cs ? 'Která verze sedí?' : 'Which theory fits?'}
    </h2>
    <p class={instruction}>
      {cs
        ? 'Vyber závěr, který odpovídá stopám. Potom ho doložíš přímo v textech.'
        : 'Choose the conclusion that fits the clues. Then support it with passages from the texts.'}
    </p>
    {#if answer.feedback === 'choice' && choice}
      <p class="{correction} m-0">{choice.feedback[language]}</p>
    {/if}
    <div
      class="grid gap-[0.65rem]"
      role="group"
      aria-label={cs ? 'Možné odpovědi' : 'Possible answers'}
    >
      {#each step.choices as item (item.id)}
        <button
          class="flex min-h-16 w-full items-center justify-between gap-3 rounded-[10px] border border-line bg-paper-50 p-4 text-left disabled:cursor-default disabled:opacity-55 fine-hover:not-disabled:border-ink-700"
          disabled={busy || (answer.feedback === 'choice' && item.id === answer.choiceId)}
          onclick={() => void oncommand({ type: 'choose', choiceId: item.id })}
        >
          <span class="text-[1rem] leading-[1.6]" lang="de">{item.textDe}</span><ArrowRight
            class="flex-none text-ink-600"
            size={17}
            aria-hidden="true"
          />
        </button>
      {/each}
    </div>
    <button class="{textButton} {underline}" onclick={onread}
      >{cs ? 'Vrátit se k textům' : 'Return to the texts'}</button
    >
  {:else if stage === 'evidence'}
    <div class="mb-[1.65rem] border-b border-line pb-[1.15rem]">
      <div class="flex items-center justify-between">
        <span class="text-[0.78rem] text-ink-600">{cs ? 'Tvoje odpověď' : 'Your answer'}</span
        ><button class="{textButton} {underline}" disabled={busy} onclick={() => onstage('answer')}
          >{cs ? 'Změnit' : 'Change'}</button
        >
      </div>
      <p class="mt-1 text-[1.04rem] leading-[1.65] font-semibold" lang="de">{choice?.textDe}</p>
    </div>
    <h2 class={heading} id="decision-title" tabindex="-1">
      {cs ? 'Z čeho to vyplývá?' : 'What supports it?'}
    </h2>
    <p class={instruction}>
      {cs
        ? `V podkladech zvýrazni ${requiredCount === 1 ? 'jednu pasáž' : 'dvě pasáže'}, které odpověď potvrzují.`
        : `Highlight ${requiredCount === 1 ? 'one passage' : 'two passages'} in the documents to support your answer.`}
    </p>
    {#if answer.feedback}
      <div class={correction} id="case-feedback" tabindex="-1">
        <h3 class="mt-0 mb-2 text-[0.95rem] font-bold">
          {answer.feedback === 'choice'
            ? cs
              ? 'Tuhle odpověď je potřeba změnit.'
              : 'This answer needs another look.'
            : cs
              ? 'Odpověď sedí. Zkus jiné pasáže.'
              : 'The answer fits. Try different passages.'}
        </h3>
        <p class="m-0">
          {answer.feedback === 'choice'
            ? choice?.feedback[language]
            : cs
              ? 'Označený text odpověď nepotvrzuje. Podívej se znovu do podkladů; nápověda ti ukáže, co hledat.'
              : 'The highlighted text does not support your answer. Look through the documents again; a hint can show you what to look for.'}
        </p>
        <button
          class="{textButton} {underline}"
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
    <div class="mt-[1.1rem] mb-[1.4rem]">
      <p class="mt-0 mb-2 text-[0.82rem] font-[650]" role="status">
        {cs
          ? `Zvýrazněno ${evidence.length} ze ${requiredCount}`
          : `${evidence.length} of ${requiredCount} highlighted`}
      </p>
      {#if evidence.length}
        <ul class="m-0 grid list-none gap-[0.8rem] p-0">
          {#each evidence as item (item.id)}
            <li class="flex items-start gap-2">
              <div class="min-w-0 flex-1">
                <small class="my-[0.2rem] block text-[0.73rem] text-ink-600">{item.source}</small><q
                  class="line-clamp-3 text-[0.88rem] leading-[1.6]"
                  lang="de">{item.textDe}</q
                >
              </div>
              <button
                class="grid size-11 flex-none place-items-center rounded-lg text-ink-600 fine-hover:bg-paper-200"
                disabled={busy}
                aria-label={`${cs ? 'Zrušit zvýraznění' : 'Remove highlight'}: ${item.textDe}`}
                onclick={() => void oncommand({ type: 'evidence', clueId: item.id })}
                ><X size={15} aria-hidden="true" /></button
              >
            </li>
          {/each}
        </ul>
      {/if}
      {#if evidence.length > requiredCount}<p class={instruction}>
          {cs
            ? 'Pasáží je moc. Ponech jen ty, které odpověď přímo potvrzují.'
            : 'There are too many passages. Keep only the ones that directly support the answer.'}
        </p>{/if}
    </div>
    <button
      class={mainAction}
      disabled={busy || !canSubmit}
      onclick={() => void oncommand({ type: 'submit' })}
      >{cs ? 'Potvrdit odpověď' : 'Confirm answer'}<ArrowRight
        size={17}
        aria-hidden="true"
      /></button
    >
  {:else}
    <div class="mb-[0.8rem] flex items-center gap-[0.4rem] text-[0.82rem] font-[650] text-mint-800">
      <Check size={18} aria-hidden="true" />{cs
        ? 'Závěr zapsán do zápisníku'
        : 'Finding added to your notebook'}
    </div>
    <h2 class={heading} id="decision-title" tabindex="-1">
      {step.finding[language]}
    </h2>
    <p class={instruction}>{step.explanation[language]}</p>
    <blockquote
      class="my-[1.3rem] rounded-[10px] bg-mint-50 p-[1.2rem] text-[1rem] leading-[1.7]"
      lang="de"
    >
      {step.replyDe}
    </blockquote>
    {#if nextDocumentCount > 0}
      <p class="mt-0 mb-5 text-[0.86rem] leading-[1.6] font-semibold text-cobalt-700">
        {cs
          ? 'Pátrání pokračuje. V dalším kroku se otevřou nové podklady.'
          : 'The trail continues. New documents will open in the next step.'}
      </p>
    {/if}
    <details class="mb-[1.1rem] border-b border-line pb-2 text-[0.88rem] leading-[1.6]">
      <summary class="min-h-11 cursor-pointer content-center text-[0.85rem] font-semibold"
        >{cs ? 'Užitečný německý obrat' : 'A useful German phrase'}</summary
      >
      <strong class="mt-2 block" lang="de">{step.language.de}</strong>
      <p class="mt-[0.3rem] mb-[0.7rem]">{step.language.explanation[language]}</p>
    </details>
    <button class={mainAction} disabled={busy} onclick={() => void oncommand({ type: 'continue' })}
      >{last
        ? cs
          ? 'Uzavřít případ'
          : 'Close the case'
        : cs
          ? 'Pokračovat v pátrání'
          : 'Follow the trail'}<ArrowRight size={17} aria-hidden="true" /></button
    >
    <button class="{textButton} {underline}" onclick={onread}
      >{cs ? 'Prohlédnout si zvýrazněné texty' : 'Review the highlighted texts'}</button
    >
  {/if}

  {#if stage !== 'read' && stage !== 'feedback'}
    {#if answer.hintUsed}
      <div
        class="flex items-start gap-[0.6rem] py-[0.85rem] text-[0.85rem] leading-[1.6] text-ink-700"
      >
        <Lightbulb class="mt-[0.2rem] flex-none" size={17} aria-hidden="true" />
        <p class="m-0">{step.hint[language]}</p>
      </div>
    {:else}
      <button class={textButton} disabled={busy} onclick={() => void oncommand({ type: 'hint' })}
        ><Lightbulb size={16} aria-hidden="true" />{cs
          ? 'Potřebuji nápovědu'
          : 'Give me a hint'}</button
      >
    {/if}
  {/if}
</section>
