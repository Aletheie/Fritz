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

<details class="strategy">
  <summary
    ><span>{copy('Jak chceš hrát?', 'How would you like to play?')}</span>
    <strong>{labels[strategy]}</strong></summary
  >
  <fieldset>
    <legend class="sr-only">{copy('Tvoje taktika', 'Your strategy')}</legend
    >{#each options as option}<label class:selected={strategy === option}
        ><input type="radio" name="strategy" value={option} bind:group={strategy} /><span
          ><strong>{labels[option]}</strong><small
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

<style>
  .strategy {
    border-top: 1px solid var(--color-line);
    margin-top: 1rem;
    padding-top: 0.25rem;
  }
  .strategy fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }
  .strategy label {
    display: flex;
    gap: 0.7rem;
    padding: 0.65rem 0.4rem;
    min-height: 44px;
    align-items: flex-start;
  }
  .strategy label.selected {
    background: var(--color-cobalt-50);
    border-radius: 8px;
  }
  .strategy input {
    accent-color: var(--color-cobalt-700);
    margin-top: 0.25rem;
    width: 1rem;
    height: 1rem;
    flex: none;
  }
  .strategy strong,
  .strategy small {
    display: block;
  }
  .strategy small {
    color: var(--color-ink-600);
    margin-top: 0.15rem;
    line-height: 1.4;
  }

  summary {
    min-height: 44px;
    align-content: center;
    cursor: pointer;
    font-size: 0.83rem;
    color: var(--color-ink-700);
  }
  summary > span {
    margin-right: 0.3rem;
  }
  .strategy summary > strong {
    display: inline;
    color: var(--color-ink-950);
    font-weight: 650;
  }
</style>
