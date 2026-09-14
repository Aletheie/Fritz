<script lang="ts">
  import type { CaseFile, CaseProgress } from '$lib/domain/cases/types.ts';
  import type { MotherTongue } from '$lib/domain/types.ts';
  import Check from '@lucide/svelte/icons/check';
  import NotebookPen from '@lucide/svelte/icons/notebook-pen';

  let {
    caseFile,
    progress,
    language,
  }: {
    caseFile: CaseFile;
    progress?: CaseProgress;
    language: MotherTongue;
  } = $props();
  const cs = $derived(language === 'cs');
  const findings = $derived(
    caseFile.steps.flatMap((step, index) => {
      const answer = progress?.answers[index];
      return answer?.feedback === 'correct' ? [{ step, answer }] : [];
    }),
  );
</script>

<details class="notebook">
  <summary>
    <NotebookPen size={17} aria-hidden="true" />
    <span>{cs ? 'Tvůj zápisník' : 'Your notebook'}</span>
    <span class="note-count"
      >{cs
        ? `Ověřeno ${findings.length} ze ${caseFile.steps.length}`
        : `${findings.length} of ${caseFile.steps.length} confirmed`}</span
    >
  </summary>
  {#if findings.length}
    <ol>
      {#each findings as { step, answer }}
        <li>
          <Check size={17} aria-hidden="true" />
          <div>
            <h2>{step.finding[language]}</h2>
            <ul>
              {#each caseFile.documents as document}
                {#each document.lines.filter((line) => answer.clueIds.includes(line.id)) as line}
                  <li><span>{document.title[language]}</span><q lang="de">{line.textDe}</q></li>
                {/each}
              {/each}
            </ul>
          </div>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="empty-note">
      {cs
        ? 'Zatím žádný potvrzený závěr. Jakmile svou teorii doložíš v textech, zapíše se sem i se stopami.'
        : 'No confirmed findings yet. Support your theory with passages from the texts and it will be recorded here with its evidence.'}
    </p>
  {/if}
</details>

<style>
  .notebook {
    border-top: 1px solid var(--color-line);
    border-bottom: 1px solid var(--color-line);
    margin: 0 0 1.75rem;
  }
  summary {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-height: 48px;
    padding: 0.45rem 0;
    font-size: 0.83rem;
    font-weight: 650;
    cursor: pointer;
  }
  summary :global(svg) {
    flex: none;
  }
  summary::after {
    content: '+';
    font-size: 1.1rem;
    margin-left: 0.5rem;
  }
  details[open] summary::after {
    content: '−';
  }
  .note-count {
    margin-left: auto;
    color: var(--color-ink-600);
    font-size: 0.75rem;
    font-weight: 500;
  }
  ol,
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  ol {
    max-width: 48rem;
    padding: 0.6rem 0 1.1rem;
    display: grid;
    gap: 1.3rem;
  }
  ol > li {
    display: flex;
    gap: 0.65rem;
    align-items: flex-start;
  }
  ol > li > :global(svg) {
    color: var(--color-mint-800);
    flex: none;
    margin-top: 0.2rem;
  }
  h2 {
    margin: 0 0 0.7rem;
    font-size: 0.94rem;
    font-weight: 650;
    line-height: 1.6;
  }
  ul {
    display: grid;
    gap: 0.7rem;
  }
  ul span {
    display: block;
    font-size: 0.73rem;
    color: var(--color-ink-600);
    margin-bottom: 0.2rem;
  }
  q {
    display: block;
    font-size: 0.87rem;
    line-height: 1.6;
  }
  .empty-note {
    max-width: 42rem;
    font-size: 0.88rem;
    line-height: 1.6;
    color: var(--color-ink-700);
    margin: 0.4rem 0 1.1rem;
  }
  @media (max-width: 799px) {
    .notebook {
      margin-bottom: 1.25rem;
    }
  }
</style>
