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
  data-testid="rule-reminder"
  class="mt-[1.2rem] border-t border-line pt-[0.45rem] text-[0.9rem] leading-normal text-ink-800"
  bind:open
  ontoggle={() => {
    if (open) onopen?.();
  }}
>
  <summary class="flex min-h-11 cursor-pointer items-center gap-[0.4rem] font-bold text-cobalt-700"
    ><Lightbulb size={16} aria-hidden="true" />
    {localized($motherTongue, { cs: 'Připomenout pravidlo', en: 'Review the rule' })}</summary
  >
  <p>{lesson.concept}</p>
  <strong class="mt-2 block" lang={$motherTongue === 'en' ? 'de' : 'cs'}>{lesson.formula}</strong>
</details>
