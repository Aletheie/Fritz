<script lang="ts">
  import type { RivalStrategy } from '$lib/domain/rival/types.ts';
  import type { MotherTongue } from '$lib/domain/types.ts';
  type Props = { strategy: RivalStrategy; language: MotherTongue };
  let { strategy = $bindable('balanced'), language }: Props = $props();
  const options: RivalStrategy[] = ['balanced', 'pressure', 'counter'];
  const copy = (cs: string, en: string) => (language === 'cs' ? cs : en);
  const labels = $derived({
    balanced: copy('Vyrovnaně', 'Balanced'),
    pressure: copy('Větší výzva', 'More challenge'),
    counter: copy('Využít slabinu', 'Play to your advantage'),
  });
</script>

<details class="mt-4 border-t border-line pt-1">
  <summary class="min-h-11 cursor-pointer content-center text-[0.83rem] text-ink-700"
    ><span class="mr-[0.3rem]">{copy('Jak chceš hrát?', 'How would you like to play?')}</span>
    <strong class="inline font-[650] text-ink-950">{labels[strategy]}</strong></summary
  >
  <fieldset class="m-0 border-0 p-0">
    <legend class="sr-only">{copy('Tvoje taktika', 'Your strategy')}</legend
    >{#each options as option}<label
        class={[
          'flex min-h-11 items-start gap-[0.7rem] px-[0.4rem] py-[0.65rem]',
          strategy === option && 'rounded-lg bg-cobalt-50',
        ]}
        ><input
          class="mt-1 size-4 flex-none accent-cobalt-700"
          type="radio"
          name="strategy"
          value={option}
          bind:group={strategy}
        /><span
          ><strong class="block">{labels[option]}</strong><small
            class="mt-[0.15rem] block leading-[1.4] text-ink-600"
            >{option === 'balanced'
              ? copy(
                  'Začni zlehka. Otázky se přizpůsobí tvým odpovědím.',
                  'Start gently. Questions adapt to your answers.',
                )
              : option === 'pressure'
                ? copy('Těžší úlohy už od prvního kola.', 'Harder questions from the first round.')
                : copy(
                    'V 1., 3. a 5. kole dostaneš oblast, která robotovi jde hůř.',
                    'Rounds 1, 3 and 5 target the robot’s weaker area.',
                  )}</small
          ></span
        ></label
      >{/each}
  </fieldset>
</details>
