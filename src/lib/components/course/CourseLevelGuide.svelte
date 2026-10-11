<script lang="ts">
  import { courseWritingProfiles } from '$lib/domain/course/course-writing-profiles.ts';
  import type { DetailedCefrLevel } from '$lib/domain/types.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';

  let { level }: { level: DetailedCefrLevel } = $props();
  const profile = $derived(courseWritingProfiles[level]);
</script>

<div class="px-1 py-2">
  <p class="m-0 max-w-[65ch] text-[0.94rem] leading-[1.6] text-ink-950">
    {localized($motherTongue, profile.outcome)}
  </p>
  <details>
    <summary class="min-h-11 cursor-pointer content-center text-[0.84rem] font-bold text-cobalt-700"
      >{localized($motherTongue, {
        cs: 'Jak na této úrovni trénovat',
        en: 'How to practise at this level',
      })}</summary
    >
    <ol
      class="max-w-[65ch] pl-[1.3rem] text-[0.88rem] leading-[1.65] text-ink-800 [&>li+li]:mt-[0.4rem]"
    >
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
    <p class="m-0 max-w-[65ch] text-[0.84rem] leading-[1.6] text-ink-800">
      {localized($motherTongue, {
        cs: 'Po psaní zkus sdělení zopakovat nahlas. Četbu vybírej tak, abys sledovala děj bez neustálého překládání.',
        en: 'After writing, try conveying the message aloud. Choose reading you can follow without translating constantly.',
      })}
    </p>
  </details>
</div>
