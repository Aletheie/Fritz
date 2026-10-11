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

<details data-testid="case-notebook" class="group mt-0 mb-7 border-y border-line max-[800px]:mb-5">
  <summary
    class="flex min-h-12 cursor-pointer items-center gap-[0.55rem] py-[0.45rem] text-[0.83rem] font-[650] after:ml-2 after:text-[1.1rem] after:content-['+'] group-open:after:content-['−']"
  >
    <NotebookPen class="flex-none" size={17} aria-hidden="true" />
    <span>{cs ? 'Tvůj zápisník' : 'Your notebook'}</span>
    <span class="ml-auto text-[0.75rem] font-medium text-ink-600"
      >{cs
        ? `Ověřeno ${findings.length} ze ${caseFile.steps.length}`
        : `${findings.length} of ${caseFile.steps.length} confirmed`}</span
    >
  </summary>
  {#if findings.length}
    <ol class="m-0 grid max-w-3xl list-none gap-[1.3rem] px-0 pt-[0.6rem] pb-[1.1rem]">
      {#each findings as { step, answer }}
        <li class="flex items-start gap-[0.65rem]">
          <Check class="mt-[0.2rem] flex-none text-mint-800" size={17} aria-hidden="true" />
          <div>
            <h2 class="mt-0 mb-[0.7rem] text-[0.94rem] leading-[1.6] font-[650]">
              {step.finding[language]}
            </h2>
            <ul class="m-0 grid list-none gap-[0.7rem] p-0">
              {#each caseFile.documents as document}
                {#each document.lines.filter((line) => answer.clueIds.includes(line.id)) as line}
                  <li>
                    <span class="mb-[0.2rem] block text-[0.73rem] text-ink-600"
                      >{document.title[language]}</span
                    ><q class="block text-[0.87rem] leading-[1.6]" lang="de">{line.textDe}</q>
                  </li>
                {/each}
              {/each}
            </ul>
          </div>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="mt-[0.4rem] mb-[1.1rem] max-w-[42rem] text-[0.88rem] leading-[1.6] text-ink-700">
      {cs
        ? 'Zatím žádný potvrzený závěr. Jakmile svou teorii doložíš v textech, zapíše se sem i se stopami.'
        : 'No confirmed findings yet. Support your theory with passages from the texts and it will be recorded here with its evidence.'}
    </p>
  {/if}
</details>
