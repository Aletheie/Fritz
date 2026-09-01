<script lang="ts">
  import { t } from '$lib/i18n';
  import { courseChapterCopy, coursePhaseCopy } from '$lib/i18n/course.ts';
  import { motherTongue } from '$lib/state/app';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import Target from '@lucide/svelte/icons/target';
  import Trophy from '@lucide/svelte/icons/trophy';
  import { onMount } from 'svelte';

  import { coursePathPhaseInfo } from '../../domain/course/path-presentation.ts';
  import { normalizedPathPosition } from './path-geometry.ts';
  import PathConnector from './PathConnector.svelte';
  import PathNode from './PathNode.svelte';

  import type { CoursePathChapterView } from '../../domain/course/path.ts';
  import type { HomeCourseAction } from './home-view-model.ts';

  let {
    chapter,
    number,
    total,
    minutes,
    courseAction,
    reviewIsPrimary,
    previousChapter,
    nextChapter,
  }: {
    chapter: CoursePathChapterView;
    number: number;
    total: number;
    minutes: number;
    courseAction?: HomeCourseAction;
    reviewIsPrimary: boolean;
    previousChapter?: CoursePathChapterView;
    nextChapter?: CoursePathChapterView;
  } = $props();

  let compactMobile = $state(false);
  let showFullPath = $state(false);
  const compactStart = $derived.by(() => {
    const actionIndex = courseAction
      ? chapter.nodes.findIndex((view) => view.node.id === courseAction.node.id)
      : -1;
    if (actionIndex >= 0) return actionIndex;
    const nextIndex = chapter.nodes.findIndex(
      (view) =>
        view.state === 'current' || view.state === 'in-progress' || view.state === 'available',
    );
    return Math.max(0, nextIndex);
  });
  const visibleNodes = $derived(
    compactMobile && !showFullPath
      ? chapter.nodes.slice(compactStart, compactStart + 2)
      : chapter.nodes,
  );

  onMount(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => (compactMobile = query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  });

  const copy = $derived(courseChapterCopy($motherTongue, chapter.chapter));
  const previousCopy = $derived(
    previousChapter ? courseChapterCopy($motherTongue, previousChapter.chapter) : undefined,
  );
  const nextCopy = $derived(
    nextChapter ? courseChapterCopy($motherTongue, nextChapter.chapter) : undefined,
  );

  function phaseStep(index: number): number {
    let count = 0;
    for (let cursor = 0; cursor <= index; cursor += 1) {
      if (
        cursor === 0 ||
        chapter.nodes[cursor - 1]?.node.phase !== chapter.nodes[cursor]?.node.phase
      ) {
        count += 1;
      }
    }
    return count;
  }
</script>

<section id={chapter.chapter.id} class="chapter-section" aria-labelledby="journey-chapter-title">
  {#if previousChapter}
    <a class="previous-tail" href={`/#${previousChapter.chapter.id}`}>
      <span><Check size={15} strokeWidth={3} /></span>
      <span
        ><small>{t($motherTongue, 'home.done')}</small><strong>{previousCopy?.title}</strong></span
      >
    </a>
  {/if}

  <header class="chapter-band">
    <div class="chapter-stamp" aria-hidden="true">
      <span>{t($motherTongue, 'home.chapterAbbreviation')}</span>
      <strong>{String(number).padStart(2, '0')}</strong>
    </div>

    <div class="chapter-heading">
      <p>
        {t($motherTongue, 'home.chapterPosition', {
          level: chapter.chapter.level,
          number,
          total,
        })}
      </p>
      <h2 id="journey-chapter-title">{copy.title}</h2>
      <span>{copy.subtitle}</span>
    </div>

    <div
      class="chapter-progress"
      role="progressbar"
      aria-label={t($motherTongue, 'home.chapterProgress', { title: copy.title })}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={chapter.percent}
    >
      <div>
        <strong>{chapter.completedRequired}/{chapter.requiredTotal}</strong>
        <span>{t($motherTongue, 'home.requiredSteps')}</span>
      </div>
      <i><b style={`--chapter-progress:${chapter.percent / 100}`}></b></i>
    </div>

    <div class="chapter-mission">
      <Target size={21} />
      <div>
        <span>{t($motherTongue, 'home.chapterGoal')}</span>
        <strong>{copy.mission}</strong>
      </div>
    </div>
  </header>

  <details class="chapter-brief">
    <summary>
      <span>{t($motherTongue, 'home.chapterContents')}</span>
      <strong
        >{t($motherTongue, 'home.expressionsAndMinutes', {
          count: chapter.chapter.words.length,
          minutes,
        })}</strong
      >
      <ChevronDown class="chevron" size={18} />
    </summary>
    <div class="brief-content">
      <ul>
        {#each copy.outcomes as outcome}
          <li><Check size={16} /><span>{outcome}</span></li>
        {/each}
      </ul>
      <aside>
        <span>{t($motherTongue, 'home.corePattern')}</span>
        <code lang="de">{chapter.chapter.grammarPattern}</code>
      </aside>
    </div>
  </details>

  <div class="path-caption">
    <span>{t($motherTongue, 'home.pathThroughChapter')}</span>
    <strong
      >{t($motherTongue, 'home.stepsDone', {
        done: chapter.completedRequired,
        total: chapter.requiredTotal,
      })}</strong
    >
  </div>

  <PathConnector>
    <ol class="learning-path">
      {#each visibleNodes as view, index}
        {#if index === 0 || visibleNodes[index - 1]?.node.phase !== view.node.phase}
          {@const phase = coursePhaseCopy(
            $motherTongue,
            view.node.phase,
            coursePathPhaseInfo[view.node.phase],
          )}
          <li class="phase-marker">
            <span>{String(phaseStep(index)).padStart(2, '0')}</span>
            <div>
              <strong>{phase.label}</strong>
              <small>{phase.description}</small>
            </div>
          </li>
        {/if}
        <PathNode
          {view}
          position={normalizedPathPosition(index, visibleNodes.length)}
          action={courseAction?.node.id === view.node.id ? courseAction : undefined}
          secondaryAction={reviewIsPrimary}
        />
      {/each}
    </ol>
  </PathConnector>

  {#if compactMobile && !showFullPath && chapter.nodes.length > visibleNodes.length}
    <button class="show-full-path" type="button" onclick={() => (showFullPath = true)}>
      {t($motherTongue, 'home.pathThroughChapter')} · {chapter.nodes.length} kroků
      <ChevronDown size={17} aria-hidden="true" />
    </button>
  {/if}

  <footer class="checkpoint-note">
    <Trophy size={21} />
    <div>
      <strong
        >{chapter.completed
          ? t($motherTongue, 'home.chapterClosed')
          : t($motherTongue, 'home.closeWithoutSupport')}</strong
      >
      <span>
        {chapter.completed
          ? t($motherTongue, 'home.checkpointRepeat')
          : t($motherTongue, 'home.checkpointDescription')}
      </span>
    </div>
  </footer>

  {#if nextChapter}
    <aside class="next-preview">
      <span class="next-lock"><LockKeyhole size={18} /></span>
      <div>
        <span>{t($motherTongue, 'home.then', { level: nextChapter.chapter.level })}</span>
        <strong>{nextCopy?.title}</strong>
      </div>
    </aside>
  {/if}
</section>

<style>
  .chapter-section {
    min-width: 0;
  }
  .previous-tail {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.55rem;
    margin-bottom: 0.65rem;
    color: var(--color-mint-700);
    text-decoration: none;
  }
  .previous-tail > span:first-child {
    display: grid;
    width: 1.7rem;
    height: 1.7rem;
    place-items: center;
    border-radius: 50%;
    background: var(--color-mint-50);
  }
  .previous-tail > span:last-child {
    display: grid;
  }
  .previous-tail small {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 760;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .previous-tail strong {
    color: var(--color-ink-950);
    font-size: 0.8rem;
  }
  .chapter-band {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 8.25rem;
    gap: 0.9rem 1rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem 1rem 0.65rem 0.65rem;
    color: white;
    background: var(--color-cobalt-700);
    padding: 1rem;
    box-shadow: 5px 5px 0 var(--color-ink-950);
  }
  .chapter-stamp {
    display: grid;
    width: 3.7rem;
    height: 3.7rem;
    align-content: center;
    justify-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 0.8rem 0.45rem 0.45rem;
    color: var(--color-ink-950);
    background: var(--color-accent-500);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .chapter-stamp span {
    font-family: var(--font-mono);
    font-size: 0.55rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .chapter-stamp strong {
    margin-top: 0.05rem;
    font-family: var(--font-mono);
    font-size: 1.25rem;
    line-height: 1;
  }
  .chapter-heading {
    min-width: 0;
  }
  .chapter-heading p {
    margin: 0;
    color: color-mix(in srgb, white 75%, var(--color-cobalt-300));
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  h2 {
    margin: 0.22rem 0 0;
    font-size: 2rem;
    font-weight: 920;
    letter-spacing: -0.035em;
    line-height: 1.02;
    text-wrap: balance;
  }
  .chapter-heading > span {
    display: block;
    max-width: 38rem;
    margin-top: 0.35rem;
    color: rgb(255 255 255 / 0.78);
    font-size: 0.84rem;
    line-height: 1.4;
  }
  .chapter-progress {
    align-self: center;
  }
  .chapter-progress div {
    display: grid;
    justify-items: end;
  }
  .chapter-progress strong {
    font-family: var(--font-mono);
    font-size: 1rem;
  }
  .chapter-progress span {
    color: rgb(255 255 255 / 0.7);
    font-size: 0.68rem;
  }
  .chapter-progress i {
    display: block;
    height: 0.45rem;
    overflow: hidden;
    margin-top: 0.42rem;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.18);
  }
  .chapter-progress b {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--color-accent-500);
    transform: scaleX(var(--chapter-progress));
    transform-origin: left;
    transition: transform 220ms var(--ease-out-emil);
  }
  .chapter-mission {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.65rem;
    border-top: 1px solid rgb(255 255 255 / 0.2);
    padding-top: 0.8rem;
    color: var(--color-accent-500);
  }
  .chapter-mission div {
    display: grid;
  }
  .chapter-mission span {
    color: rgb(255 255 255 / 0.68);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 780;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .chapter-mission strong {
    margin-top: 0.12rem;
    color: white;
    font-size: 0.87rem;
    line-height: 1.4;
  }
  .chapter-brief {
    margin: 0.85rem 0 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-ink-950) 18%, transparent);
  }
  summary {
    display: grid;
    min-height: 2.85rem;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 0.55rem;
    padding: 0.55rem 0.35rem;
    font-size: 0.82rem;
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary > span {
    font-weight: 820;
  }
  summary > strong {
    color: var(--color-ink-800);
    font-size: 0.73rem;
  }
  summary :global(.chevron) {
    transition: transform 160ms var(--ease-out-emil);
  }
  details[open] summary :global(.chevron) {
    transform: rotate(180deg);
  }
  .brief-content {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(12rem, 0.72fr);
    gap: 0.9rem;
    padding: 0.3rem 0.35rem 0.85rem;
  }
  .brief-content ul {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .brief-content li {
    display: flex;
    align-items: start;
    gap: 0.4rem;
    color: var(--color-ink-800);
    font-size: 0.8rem;
    line-height: 1.4;
  }
  .brief-content li :global(svg) {
    flex: none;
    margin-top: 0.08rem;
    color: var(--color-mint-700);
  }
  .brief-content aside {
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 18%, transparent);
    border-radius: 0.5rem 0.8rem 0.5rem 0.5rem;
    background: var(--color-paper-50);
    padding: 0.65rem;
  }
  .brief-content aside span {
    color: var(--color-ink-600);
    font-size: 0.68rem;
  }
  code {
    display: block;
    margin-top: 0.28rem;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 760;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .path-caption {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin: 1.1rem auto 0;
    padding: 0 0.35rem;
  }
  .path-caption span {
    font-size: 0.92rem;
    font-weight: 880;
  }
  .path-caption strong {
    color: var(--color-ink-800);
    font-family: var(--font-mono);
    font-size: 0.67rem;
  }
  .learning-path {
    width: min(100%, 39rem);
    margin: 0.55rem auto 0;
    padding: 0;
    list-style: none;
  }
  .show-full-path {
    display: flex;
    width: min(100%, 31rem);
    min-height: 2.85rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    margin: 0.5rem auto 0.9rem;
    border: 1px solid var(--color-line);
    border-radius: 0.35rem;
    color: var(--color-cobalt-700);
    background: var(--color-paper-50);
    font-size: 0.75rem;
    font-weight: 780;
  }
  .phase-marker {
    position: relative;
    z-index: 2;
    display: grid;
    width: min(100%, 31rem);
    min-height: 3.1rem;
    grid-template-columns: 2rem minmax(0, 1fr);
    align-items: center;
    gap: 0.55rem;
    margin: 0.35rem auto 0.6rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-ink-950) 16%, transparent);
    background: var(--color-paper-100);
    padding: 0 0.25rem 0.55rem;
  }
  .phase-marker > span {
    display: grid;
    width: 1.85rem;
    height: 1.85rem;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--color-ink-950) 24%, transparent);
    border-radius: 50%;
    color: var(--color-cobalt-700);
    background: var(--color-paper-50);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 850;
  }
  .phase-marker div {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .phase-marker strong {
    font-size: 0.82rem;
  }
  .phase-marker small {
    max-width: 17rem;
    color: var(--color-ink-800);
    font-size: 0.68rem;
    line-height: 1.35;
    text-align: right;
  }
  .checkpoint-note,
  .next-preview {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.7rem;
    padding: 0.8rem 0.85rem;
  }
  .checkpoint-note {
    border: 1px solid color-mix(in srgb, var(--color-orange-700) 34%, transparent);
    border-radius: 0.55rem 0.9rem 0.55rem 0.55rem;
    color: var(--color-orange-700);
    background: var(--color-orange-100);
  }
  .next-preview {
    margin-top: 0.55rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-ink-950) 15%, transparent);
    color: var(--color-ink-600);
  }
  .next-lock {
    display: grid;
    width: 2.3rem;
    height: 2.3rem;
    place-items: center;
    border-radius: 50%;
    background: var(--color-paper-200);
  }
  .checkpoint-note div,
  .next-preview div {
    display: grid;
  }
  .checkpoint-note strong,
  .next-preview strong {
    color: var(--color-ink-950);
    font-size: 0.84rem;
  }
  .checkpoint-note span,
  .next-preview div > span {
    margin-top: 0.12rem;
    color: var(--color-ink-800);
    font-size: 0.75rem;
    line-height: 1.4;
  }
  @media (max-width: 639px) {
    .chapter-band {
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.8rem;
      padding: 0.85rem;
      box-shadow: 4px 4px 0 var(--color-ink-950);
    }
    .chapter-stamp {
      width: 3.2rem;
      height: 3.2rem;
    }
    h2 {
      font-size: 1.65rem;
    }
    .chapter-progress {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: 0.7rem;
    }
    .chapter-progress div {
      justify-items: start;
    }
    .chapter-progress i {
      margin-top: 0;
    }
    .brief-content {
      grid-template-columns: 1fr;
    }
    summary {
      grid-template-columns: minmax(0, 1fr) auto;
    }
    summary > strong {
      grid-column: 1;
      grid-row: 2;
    }
    summary :global(.chevron) {
      grid-column: 2;
      grid-row: 1 / span 2;
    }
    .phase-marker div {
      display: grid;
      gap: 0.12rem;
    }
    .phase-marker small {
      text-align: left;
    }
  }
  @media (max-width: 359px) {
    .chapter-heading > span {
      display: none;
    }
    .chapter-stamp {
      width: 2.85rem;
      height: 2.85rem;
    }
    h2 {
      font-size: 1.48rem;
    }
  }
</style>
