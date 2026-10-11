<script lang="ts">
  import { caseRules } from '$lib/domain/cases/rules.ts';
  import type { CaseFile, CaseProgress } from '$lib/domain/cases/types.ts';
  import type { MotherTongue } from '$lib/domain/types.ts';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  let {
    caseFile,
    progress,
    nextCase,
    language,
    busy,
    onrestart,
  }: {
    caseFile: CaseFile;
    progress: CaseProgress;
    nextCase?: CaseFile;
    language: MotherTongue;
    busy: boolean;
    onrestart: () => void;
  } = $props();
  const cs = $derived(language === 'cs');
  const independent = $derived(
    progress.answers.filter((item) => item.attempts === 1 && !item.hintUsed).length,
  );

  const subheading = 'm-0 text-[1rem] font-[650]';
  const reviewText = 'text-[0.9rem] leading-[1.65]';
  const note = 'text-[0.84rem] leading-[1.65] text-ink-600';
</script>

<section class="mx-auto my-8 max-w-[42rem]" aria-labelledby="ending-title">
  <span class="inline-flex items-center gap-[0.4rem] font-[650] text-mint-800"
    ><Check size={18} aria-hidden="true" />{cs ? 'Případ uzavřen' : 'Case closed'}</span
  >
  <h2
    class="mt-4 mb-6 text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.15] font-bold tracking-[-0.03em]"
    id="ending-title"
    tabindex="-1"
  >
    {cs ? 'Všechno do sebe zapadá.' : 'The pieces fit.'}
  </h2>
  <blockquote class="my-4 rounded-xl bg-mint-50 p-[1.3rem] text-[1.15rem] leading-[1.7]" lang="de">
    {caseFile.endingDe}
  </blockquote>
  <p class="leading-[1.65]">{caseFile.takeaway[language]}</p>
  {#if caseFile.reconstruction}
    <section
      class="my-[1.8rem]"
      data-testid="case-reconstruction"
      aria-labelledby="reconstruction-title"
    >
      <h3 class={subheading} id="reconstruction-title">
        {cs ? 'Jak se to celé stalo' : 'What really happened'}
      </h3>
      <ol class="mt-[0.8rem] mb-0 list-none p-0">
        {#each caseFile.reconstruction as moment}
          <li class="grid grid-cols-[3.6rem_minmax(0,1fr)] gap-4 border-t border-line py-4">
            <time class="pt-[0.12rem] text-[0.85rem] font-bold tabular-nums">{moment.time}</time>
            <p class="m-0 text-[0.91rem] leading-[1.65]">{moment.event[language]}</p>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
  <p class={note}>
    {cs
      ? `Ověřené odpovědi: ${caseFile.steps.length} ze ${caseFile.steps.length}. Na první pokus bez nápovědy: ${independent}.`
      : `Answers confirmed: ${caseFile.steps.length} of ${caseFile.steps.length}. First try without hints: ${independent}.`}
  </p>
  <details class="my-6 border-y border-line py-[0.35rem]">
    <summary class="min-h-12 cursor-pointer content-center font-semibold"
      >{cs ? 'Projít řešení a užitečné obraty' : 'Review the evidence and useful phrases'}</summary
    >
    {#each caseFile.steps as step, index}
      <section class="py-4 [&+section]:border-t [&+section]:border-line">
        <h3 class={subheading}>{step.question[language]}</h3>
        <p lang="de" class="{reviewText} font-[650]">
          {step.choices.find((choice) => choice.id === caseRules[caseFile.id].steps[index].choiceId)
            ?.textDe}
        </p>
        <ul class="my-[0.6rem] grid list-none gap-[0.65rem] p-0">
          {#each caseFile.documents as document}
            {#each document.lines.filter( (line) => caseRules[caseFile.id].steps[index].clueIds.includes(line.id) ) as line}
              <li>
                <small class="mb-[0.2rem] block text-[0.73rem] text-ink-600"
                  >{document.title[language]}</small
                ><q class="block text-[0.87rem] leading-[1.55]" lang="de">{line.textDe}</q>
              </li>
            {/each}
          {/each}
        </ul>
        <p class={reviewText}>{step.explanation[language]}</p>
        <p class={reviewText}>
          <strong class="mb-[0.35rem] block" lang="de">{step.language.de}</strong>{step.language
            .explanation[language]}
        </p>
      </section>
    {/each}
  </details>
  <div class="flex flex-wrap gap-3 max-[600px]:[&>*]:w-full">
    {#if nextCase}<a class="btn-base btn-primary" href={`/cases/${nextCase.id}/`}
        >{cs ? 'Otevřít další případ' : 'Open another case'}<ArrowRight
          size={18}
          aria-hidden="true"
        /></a
      >{/if}
    <button class="btn-base btn-secondary" disabled={busy} onclick={onrestart}
      >{cs ? 'Vyřešit znovu' : 'Solve again'}</button
    >
  </div>
  <p class={note}>
    {cs
      ? 'Výsledek je uložený. Případ si můžeš projít znovu.'
      : 'Result saved. You can play the case again.'}
  </p>
</section>
