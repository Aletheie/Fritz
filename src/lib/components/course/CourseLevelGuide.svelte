<script lang="ts">
  import { courseWritingProfiles } from '$lib/domain/course/course-writing-profiles.ts';
  import type { DetailedCefrLevel } from '$lib/domain/types.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';

  let { level }: { level: DetailedCefrLevel } = $props();
  const profile = $derived(courseWritingProfiles[level]);
</script>

<div class="level-guide">
  <p>{localized($motherTongue, profile.outcome)}</p>
  <details>
    <summary
      >{localized($motherTongue, {
        cs: 'Jak na této úrovni trénovat',
        en: 'How to practise at this level',
      })}</summary
    >
    <ol>
      <li>
        {localized($motherTongue, {
          cs: 'Slovíčka si nejdřív vybav, potom je použij s pravidlem kapitoly.',
          en: 'Recall vocabulary first, then use it with the chapter’s grammar.',
        })}
      </li>
      <li>{localized($motherTongue, profile.extension)}</li>
      <li>
        {localized($motherTongue, {
          cs: 'Před závěrem úrovně si v rozhovoru zjisti chybějící údaje. Závěrečná sada propojí nový poslech, vlastní zprávu a jiný text.',
          en: 'Before the end of the level, ask for missing details in a conversation. The final sequence connects new listening, your own message, and a different text.',
        })}
      </li>
    </ol>
    <p class="note">
      {localized($motherTongue, {
        cs: 'Po psaní zkus sdělení zopakovat nahlas. Četbu vybírej tak, abys sledovala děj bez neustálého překládání.',
        en: 'After writing, try conveying the message aloud. Choose reading you can follow without translating constantly.',
      })}
    </p>
  </details>
</div>

<style>
  .level-guide {
    padding: 0.5rem 0.25rem;
  }
  p {
    max-width: 65ch;
    margin: 0;
    color: var(--color-ink-950);
    font-size: 0.94rem;
    line-height: 1.6;
  }
  summary {
    min-height: 44px;
    align-content: center;
    color: var(--color-cobalt-700);
    font-size: 0.84rem;
    font-weight: 700;
    cursor: pointer;
  }
  ol {
    padding-left: 1.3rem;
    max-width: 65ch;
    color: var(--color-ink-800);
    font-size: 0.88rem;
    line-height: 1.65;
  }
  li + li {
    margin-top: 0.4rem;
  }
  .note {
    color: var(--color-ink-800);
    font-size: 0.84rem;
  }
</style>
