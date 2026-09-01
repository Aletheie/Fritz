<script lang="ts">
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import Check from '@lucide/svelte/icons/check';
  import Link2 from '@lucide/svelte/icons/link-2';
  import { onDestroy } from 'svelte';

  import type { MatchingPair, MatchingRound } from '$lib/domain/exercises/matching.ts';

  let {
    round,
    disabled = false,
    compact = false,
    oncomplete,
  } = $props<{
    round: MatchingRound;
    disabled?: boolean;
    compact?: boolean;
    oncomplete: (mistakes: number) => void | Promise<void>;
  }>();

  let selectedCzech = $state('');
  let selectedGerman = $state('');
  let wrongCzech = $state('');
  let wrongGerman = $state('');
  let matched = $state<string[]>([]);
  let mistakes = $state(0);
  let resolving = $state(false);
  let completed = $state(false);
  let status = $state('');
  let roundKey = $state('');
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const nextKey = `${$motherTongue}|${round.pairs.map((pair: MatchingPair) => pair.id).join('|')}`;
    if (nextKey === roundKey) return;
    roundKey = nextKey;
    reset();
  });

  onDestroy(() => {
    if (clearTimer) clearTimeout(clearTimer);
  });

  function choose(side: 'czech' | 'german', pairId: string, label: string): void {
    if (disabled || resolving || completed || matched.includes(pairId)) return;
    const nextCzech = side === 'czech' ? pairId : selectedCzech;
    const nextGerman = side === 'german' ? pairId : selectedGerman;
    selectedCzech = nextCzech;
    selectedGerman = nextGerman;
    status = copy(
      `${side === 'czech' ? 'Česky' : 'Německy'} vybráno: ${label}.`,
      `${side === 'czech' ? 'Meaning' : 'German'} selected: ${label}.`,
    );
    if (!nextCzech || !nextGerman) return;

    resolving = true;
    if (nextCzech === nextGerman) {
      matched = [...matched, nextCzech];
      selectedCzech = '';
      selectedGerman = '';
      resolving = false;
      status = copy(
        `Spojeno ${matched.length} z ${round.pairs.length}.`,
        `Matched ${matched.length} of ${round.pairs.length}.`,
      );
      vibrate(12);
      if (matched.length === round.pairs.length) {
        completed = true;
        status =
          mistakes === 0
            ? copy('Všechny dvojice sedí bez chyby.', 'Every pair is correct with no mistakes.')
            : copy(
                `Všechny dvojice sedí. Slepé pokusy: ${mistakes}.`,
                `Every pair is correct. Blind attempts: ${mistakes}.`,
              );
        void oncomplete(mistakes);
      }
      return;
    }

    mistakes += 1;
    wrongCzech = nextCzech;
    wrongGerman = nextGerman;
    status = copy(
      'Tyhle dva výrazy k sobě nepatří. Výběr se vrací.',
      'Those two expressions do not match. The selection is being reset.',
    );
    vibrate(35);
    clearTimer = setTimeout(() => {
      selectedCzech = '';
      selectedGerman = '';
      wrongCzech = '';
      wrongGerman = '';
      resolving = false;
      status = copy('Zkus jinou dvojici.', 'Try another pair.');
    }, 430);
  }

  function reset(): void {
    if (clearTimer) clearTimeout(clearTimer);
    selectedCzech = '';
    selectedGerman = '';
    wrongCzech = '';
    wrongGerman = '';
    matched = [];
    mistakes = 0;
    resolving = false;
    completed = false;
    status = copy(
      'Vyber český a německý výraz, které patří k sobě.',
      'Choose the meaning and German expression that belong together.',
    );
  }

  function vibrate(duration: number): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(duration);
  }

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }
</script>

<section
  class:compact
  class="matching-board"
  aria-label={copy(
    'Párování českých a německých výrazů',
    'Matching meanings and German expressions',
  )}
>
  <div class="column-heading">
    <span>{copy('Česky', 'Meaning')}</span><small>{copy('význam', 'source')}</small>
  </div>
  <div class="link-heading" aria-hidden="true"><Link2 size={17} /></div>
  <div class="column-heading german">
    <span>{copy('Německy', 'German')}</span><small>{copy('výraz', 'expression')}</small>
  </div>

  <ol class="matching-column czech-column">
    {#each round.czechOptions as option}
      <li>
        <button
          class:selected={selectedCzech === option.pairId}
          class:matched={matched.includes(option.pairId)}
          class:wrong={wrongCzech === option.pairId}
          type="button"
          disabled={disabled || matched.includes(option.pairId)}
          aria-pressed={selectedCzech === option.pairId}
          aria-label={copy(
            `Česky: ${option.label}${matched.includes(option.pairId) ? ', spojeno' : ''}`,
            `Meaning: ${option.label}${matched.includes(option.pairId) ? ', matched' : ''}`,
          )}
          onclick={() => choose('czech', option.pairId, option.label)}
        >
          <strong>{option.label}</strong>
          {#if matched.includes(option.pairId)}<Check size={16} aria-hidden="true" />{/if}
        </button>
      </li>
    {/each}
  </ol>

  <div class="link-axis" aria-hidden="true"><span></span></div>

  <ol class="matching-column german-column">
    {#each round.germanOptions as option}
      <li>
        <button
          class:selected={selectedGerman === option.pairId}
          class:matched={matched.includes(option.pairId)}
          class:wrong={wrongGerman === option.pairId}
          type="button"
          disabled={disabled || matched.includes(option.pairId)}
          aria-pressed={selectedGerman === option.pairId}
          aria-label={copy(
            `Německy: ${option.label}${matched.includes(option.pairId) ? ', spojeno' : ''}`,
            `German: ${option.label}${matched.includes(option.pairId) ? ', matched' : ''}`,
          )}
          onclick={() => choose('german', option.pairId, option.label)}
        >
          <strong lang="de">{option.label}</strong>
          {#if matched.includes(option.pairId)}<Check size={16} aria-hidden="true" />{/if}
        </button>
      </li>
    {/each}
  </ol>

  <p class="matching-status" role="status" aria-live="polite">
    <span>{matched.length}/{round.pairs.length} {copy('spojeno', 'matched')}</span>
    <span>{status}</span>
  </p>
</section>

<style>
  .matching-board {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 1.4rem minmax(0, 1fr);
    gap: 0.45rem 0.25rem;
    border-radius: 0.85rem;
    background: var(--color-paper-100);
    padding: 0.8rem;
  }
  .column-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.4rem;
    padding-inline: 0.2rem;
  }
  .column-heading span {
    font-size: 0.76rem;
    font-weight: 850;
  }
  .column-heading small {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.55rem;
  }
  .column-heading.german {
    text-align: right;
  }
  .link-heading {
    display: grid;
    place-items: center;
    color: var(--color-cobalt-700);
  }
  .matching-column {
    display: grid;
    align-content: start;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .matching-column button {
    display: grid;
    width: 100%;
    min-height: 3.5rem;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid var(--color-line);
    border-radius: 0.7rem;
    color: var(--color-ink-950);
    background: var(--color-paper-50);
    padding: 0.65rem;
    text-align: left;
    transition:
      transform 160ms var(--ease-out-emil),
      border-color 160ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil),
      opacity 160ms var(--ease-out-emil);
  }
  .german-column button {
    text-align: right;
  }
  .matching-column strong {
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 0.82rem;
    line-height: 1.25;
  }
  .matching-column button:active:not(:disabled) {
    transform: scale(0.97);
  }
  .matching-column button.selected {
    border-color: var(--color-cobalt-700);
    background: var(--color-sky-50);
    box-shadow: inset 0 0 0 1px var(--color-cobalt-700);
  }
  .matching-column button.matched {
    border-color: var(--color-mint-700);
    color: var(--color-mint-700);
    background: var(--color-mint-50);
    opacity: 0.76;
  }
  .matching-column button.wrong {
    border-color: var(--color-coral-700);
    color: var(--color-coral-700);
    background: var(--color-coral-50);
    animation: pair-nudge 180ms var(--ease-out-emil);
  }
  .link-axis {
    display: flex;
    justify-content: center;
  }
  .link-axis span {
    width: 1px;
    height: 100%;
    background: var(--color-line);
  }
  .matching-status {
    display: flex;
    grid-column: 1 / -1;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.3rem 0.8rem;
    margin: 0.25rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.68rem;
    line-height: 1.35;
  }
  .matching-status span:first-child {
    flex: none;
    color: var(--color-ink-950);
    font-family: var(--font-mono);
    font-weight: 850;
  }
  .matching-board.compact {
    padding: 0.65rem;
  }
  .compact .matching-column button {
    min-height: 3.1rem;
    padding: 0.55rem;
  }
  @keyframes pair-nudge {
    50% {
      transform: translateX(3px);
    }
  }
  @media (hover: hover) and (pointer: fine) {
    .matching-column button:hover:not(:disabled, .matched) {
      border-color: var(--color-ink-950);
      transform: translateY(-1px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .matching-column button,
    .matching-column button.wrong {
      animation: none;
      transition: none;
    }
  }
</style>
