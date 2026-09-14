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
</script>

<section class="ending" aria-labelledby="ending-title">
  <span class="resolved"
    ><Check size={18} aria-hidden="true" />{cs ? 'Případ uzavřen' : 'Case closed'}</span
  >
  <h2 id="ending-title" tabindex="-1">{cs ? 'Všechno do sebe zapadá.' : 'The pieces fit.'}</h2>
  <blockquote lang="de">{caseFile.endingDe}</blockquote>
  <p>{caseFile.takeaway[language]}</p>
  {#if caseFile.reconstruction}
    <section class="reconstruction" aria-labelledby="reconstruction-title">
      <h3 id="reconstruction-title">{cs ? 'Jak se to celé stalo' : 'What really happened'}</h3>
      <ol>
        {#each caseFile.reconstruction as moment}
          <li>
            <time>{moment.time}</time>
            <p>{moment.event[language]}</p>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
  <p class="result-detail">
    {cs
      ? `Ověřené odpovědi: ${caseFile.steps.length} ze ${caseFile.steps.length}. Na první pokus bez nápovědy: ${independent}.`
      : `Answers confirmed: ${caseFile.steps.length} of ${caseFile.steps.length}. First try without hints: ${independent}.`}
  </p>
  <details class="review">
    <summary
      >{cs ? 'Projít řešení a užitečné obraty' : 'Review the evidence and useful phrases'}</summary
    >
    {#each caseFile.steps as step, index}
      <section>
        <h3>{step.question[language]}</h3>
        <p lang="de" class="review-answer">
          {step.choices.find((choice) => choice.id === caseRules[caseFile.id].steps[index].choiceId)
            ?.textDe}
        </p>
        <ul>
          {#each caseFile.documents as document}
            {#each document.lines.filter( (line) => caseRules[caseFile.id].steps[index].clueIds.includes(line.id) ) as line}
              <li><small>{document.title[language]}</small><q lang="de">{line.textDe}</q></li>
            {/each}
          {/each}
        </ul>
        <p>{step.explanation[language]}</p>
        <p class="language-note">
          <strong lang="de">{step.language.de}</strong>{step.language.explanation[language]}
        </p>
      </section>
    {/each}
  </details>
  <div class="ending-actions">
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
  <p class="saved-note">
    {cs
      ? 'Výsledek je uložený. Případ si můžeš projít znovu.'
      : 'Result saved. You can play the case again.'}
  </p>
</section>

<style>
  .ending {
    max-width: 42rem;
    margin: 2rem auto;
  }
  .resolved {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--color-mint-800);
    font-weight: 650;
  }
  h2 {
    font-size: clamp(1.8rem, 4vw, 2.8rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.15;
    margin: 1rem 0 1.5rem;
  }
  blockquote {
    margin: 1rem 0;
    padding: 1.3rem;
    background: var(--color-mint-50);
    border-radius: 12px;
    font-size: 1.15rem;
    line-height: 1.7;
  }
  .ending > p {
    line-height: 1.65;
  }
  .result-detail,
  .saved-note {
    font-size: 0.84rem;
    color: var(--color-ink-600);
  }
  .review {
    border-top: 1px solid var(--color-line);
    border-bottom: 1px solid var(--color-line);
    margin: 1.5rem 0;
    padding: 0.35rem 0;
  }
  .reconstruction {
    margin: 1.8rem 0;
  }
  .reconstruction ol {
    list-style: none;
    margin: 0.8rem 0 0;
    padding: 0;
  }
  .reconstruction li {
    display: grid;
    grid-template-columns: 3.6rem minmax(0, 1fr);
    gap: 1rem;
    padding: 1rem 0;
    border-top: 1px solid var(--color-line);
  }
  .reconstruction time {
    font-size: 0.85rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    padding-top: 0.12rem;
  }
  .reconstruction p {
    font-size: 0.91rem;
    line-height: 1.65;
    margin: 0;
  }
  summary {
    cursor: pointer;
    min-height: 48px;
    align-content: center;
    font-weight: 600;
  }
  .review section {
    padding: 1rem 0;
  }
  .review section + section {
    border-top: 1px solid var(--color-line);
  }
  h3 {
    font-size: 1rem;
    font-weight: 650;
    margin: 0;
  }
  .review p {
    font-size: 0.9rem;
    line-height: 1.65;
  }
  .review-answer {
    font-weight: 650;
  }
  ul {
    list-style: none;
    padding: 0;
    margin: 0.6rem 0;
    display: grid;
    gap: 0.65rem;
  }
  li small {
    display: block;
    color: var(--color-ink-600);
    font-size: 0.73rem;
    margin-bottom: 0.2rem;
  }
  li q {
    font-size: 0.87rem;
    line-height: 1.55;
    display: block;
  }
  .language-note strong {
    display: block;
    margin-bottom: 0.35rem;
  }
  .ending-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  @media (max-width: 599px) {
    .ending-actions > :global(*) {
      width: 100%;
    }
  }
</style>
