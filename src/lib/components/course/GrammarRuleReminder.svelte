<script lang="ts">
  import { localized } from '$lib/i18n';
  import type { GrammarLessonCopy } from '$lib/i18n/grammar.ts';
  import { motherTongue } from '$lib/state/app';
  import Lightbulb from '@lucide/svelte/icons/lightbulb';

  let {
    lesson,
    open = $bindable(false),
    onopen,
  } = $props<{ lesson: GrammarLessonCopy; open?: boolean; onopen?: () => void }>();
</script>

<details
  class="rule-reminder"
  bind:open
  ontoggle={() => {
    if (open) onopen?.();
  }}
>
  <summary
    ><Lightbulb size={16} aria-hidden="true" />
    {localized($motherTongue, { cs: 'Připomenout pravidlo', en: 'Review the rule' })}</summary
  >
  <p>{lesson.concept}</p>
  <strong lang={$motherTongue === 'en' ? 'de' : 'cs'}>{lesson.formula}</strong>
</details>

<style>
  .rule-reminder {
    margin-top: 1.2rem;
    border-top: 1px solid var(--color-line);
    padding-top: 0.45rem;
    color: var(--color-ink-800);
    font-size: 0.9rem;
    line-height: 1.5;
  }
  summary {
    display: flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    color: var(--color-cobalt-700);
    font-weight: 700;
  }
  strong {
    display: block;
    margin-top: 0.5rem;
  }
</style>
