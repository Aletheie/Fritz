<script lang="ts">
  import type { GrammarLesson, GrammarQuestion } from '$lib/domain/course/grammar.ts';
  import { localized } from '$lib/i18n';
  import {
    grammarLessonCopy,
    grammarQuestionCopy,
    grammarOptionCopy,
    grammarOptionLanguage,
  } from '$lib/i18n/grammar.ts';
  import { motherTongue } from '$lib/state/app';

  let { lesson, questionIds } = $props<{
    lesson: GrammarLesson;
    questionIds: ReadonlySet<string>;
  }>();
  const lessonCopy = $derived(grammarLessonCopy($motherTongue, lesson));
  function expectedAnswer(question: GrammarQuestion): string {
    return question.kind === 'choice'
      ? grammarOptionCopy($motherTongue, question.answer)
      : question.kind === 'fill'
        ? question.answers[0]
        : question.answer.join(' ');
  }
</script>

{#if questionIds.size > 0}
  <section
    class="repair-notes"
    aria-label={localized($motherTongue, {
      cs: 'Co se podařilo opravit',
      en: 'What you corrected',
    })}
  >
    <h2>
      {localized($motherTongue, {
        cs: 'Tady už víš, na co si dát pozor',
        en: 'Patterns to remember',
      })}
    </h2>
    <ul>
      {#each lesson.questions.filter((item: GrammarQuestion) => questionIds.has(item.id)) as item}
        <li>
          <strong
            lang={item.kind === 'choice' ? grammarOptionLanguage($motherTongue, item.answer) : 'de'}
            >{expectedAnswer(item)}</strong
          >
          <p>{grammarQuestionCopy($motherTongue, item, lessonCopy).explanation}</p>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .repair-notes {
    margin-top: 1.2rem;
    text-align: left;
  }
  h2 {
    font-size: 1rem;
    font-weight: 800;
  }
  ul {
    padding-left: 1.2rem;
  }
  li {
    margin-top: 0.8rem;
  }
  p {
    margin-top: 0.2rem;
    color: var(--color-ink-600);
    line-height: 1.5;
  }
</style>
