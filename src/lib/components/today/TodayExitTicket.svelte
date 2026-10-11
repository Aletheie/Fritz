<script lang="ts">
  import { tr } from '$lib/state/app';
  import Brain from '@lucide/svelte/icons/brain';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import { choiceGrid, toggle, wideButton } from './today-styles.ts';

  import type { ExitTicketLessonActivity } from '$lib/domain/learning/types.ts';
  import type { DailyLesson } from '$lib/state/daily-lesson.svelte.ts';

  let { lesson, activity }: { lesson: DailyLesson; activity: ExitTicketLessonActivity } = $props();

  const areas = $derived([
    $tr('Slovíčka', 'Words'),
    $tr('Gramatika', 'Grammar'),
    $tr('Poslech', 'Listening'),
    $tr('Mluvení', 'Speaking'),
  ]);
</script>

<div class="mt-6 grid justify-items-center gap-4 text-center">
  <Brain size={30} aria-hidden="true" />
  <p>{activity.prompt}</p>
  <fieldset class="{choiceGrid} w-full text-left">
    <legend>{$tr('Volitelně označ jednu oblast', 'Optionally choose one area')}</legend
    >{#each areas as option (option)}<button
        type="button"
        class={toggle(lesson.exitChoice === option)}
        aria-pressed={lesson.exitChoice === option}
        onclick={() => (lesson.exitChoice = option)}>{option}</button
      >{/each}
  </fieldset>
  <p class="m-0 text-[0.76rem] text-ink-700">
    {$tr('Odpověď se nikam neposílá.', 'Your answer isn’t sent anywhere.')}
  </p>
  <button
    class={wideButton}
    type="button"
    onclick={() => void lesson.finishCurrentActivity()}
    disabled={lesson.saving}
    >{#if lesson.saving}<LoaderCircle class="animate-spin" size={18} aria-hidden="true" />{/if}{$tr(
      'Dokončit dnešek',
      'Finish today',
    )}</button
  >
</div>
