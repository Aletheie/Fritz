<script lang="ts">
  import { motherTongue, tr } from '$lib/state/app';
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
    status = $tr(
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
      status = $tr(
        `Spojeno ${matched.length} z ${round.pairs.length}.`,
        `Matched ${matched.length} of ${round.pairs.length}.`,
      );
      vibrate(12);
      if (matched.length === round.pairs.length) {
        completed = true;
        status =
          mistakes === 0
            ? $tr('Všechny dvojice sedí bez chyby.', 'Every pair is correct with no mistakes.')
            : $tr(
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
    status = $tr(
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
      status = $tr('Zkus jinou dvojici.', 'Try another pair.');
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
    status = $tr(
      'Vyber český a německý výraz, které patří k sobě.',
      'Choose the meaning and German expression that belong together.',
    );
  }

  function vibrate(duration: number): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(duration);
  }

  const headingRow = 'flex items-baseline justify-between gap-[0.4rem] px-[0.2rem]';
  const headingLabel = 'text-[0.76rem] font-[850]';
  const headingNote = 'font-mono text-[0.55rem] text-ink-600';
  const column = 'm-0 grid list-none content-start gap-2 p-0';

  function optionClass(pairId: string, selected: boolean, wrong: boolean, german: boolean) {
    const done = matched.includes(pairId);
    return [
      'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-[0.35rem] rounded-[0.7rem] border [transition:transform_160ms_var(--ease-out-emil),border-color_160ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil),opacity_160ms_var(--ease-out-emil)] active:not-disabled:[transform:scale(0.97)] motion-reduce:transition-none',
      compact ? 'min-h-[3.1rem] p-[0.55rem]' : 'min-h-14 p-[0.65rem]',
      german ? 'text-right' : 'text-left',
      wrong
        ? 'animate-pair-nudge border-coral-700 bg-coral-50 text-coral-700 motion-reduce:animate-none'
        : done
          ? 'border-mint-700 bg-mint-50 text-mint-700 opacity-76'
          : selected
            ? 'border-cobalt-700 bg-sky-50 text-ink-950 shadow-[inset_0_0_0_1px_var(--color-cobalt-700)]'
            : 'border-line bg-paper-50 text-ink-950',
      !done &&
        'fine-hover:not-disabled:border-ink-950 fine-hover:not-disabled:[transform:translateY(-1px)]',
    ];
  }
</script>

<section
  class={[
    'grid grid-cols-[minmax(0,1fr)_1.4rem_minmax(0,1fr)] gap-x-1 gap-y-[0.45rem] rounded-[0.85rem] bg-paper-100',
    compact ? 'p-[0.65rem]' : 'p-[0.8rem]',
  ]}
  aria-label={$tr(
    'Párování českých a německých výrazů',
    'Matching meanings and German expressions',
  )}
>
  <div class={headingRow}>
    <span class={headingLabel}>{$tr('Česky', 'Meaning')}</span><small class={headingNote}
      >{$tr('význam', 'source')}</small
    >
  </div>
  <div class="grid place-items-center text-cobalt-700" aria-hidden="true"><Link2 size={17} /></div>
  <div class="{headingRow} text-right">
    <span class={headingLabel}>{$tr('Německy', 'German')}</span><small class={headingNote}
      >{$tr('výraz', 'expression')}</small
    >
  </div>

  <ol class={column} data-testid="czech-column">
    {#each round.czechOptions as option (option.pairId)}
      <li>
        <button
          class={optionClass(
            option.pairId,
            selectedCzech === option.pairId,
            wrongCzech === option.pairId,
            false,
          )}
          type="button"
          disabled={disabled || matched.includes(option.pairId)}
          aria-pressed={selectedCzech === option.pairId}
          aria-label={$tr(
            `Česky: ${option.label}${matched.includes(option.pairId) ? ', spojeno' : ''}`,
            `Meaning: ${option.label}${matched.includes(option.pairId) ? ', matched' : ''}`,
          )}
          onclick={() => choose('czech', option.pairId, option.label)}
        >
          <strong class="min-w-0 text-[0.82rem] leading-[1.25] [overflow-wrap:anywhere]"
            >{option.label}</strong
          >
          {#if matched.includes(option.pairId)}<Check size={16} aria-hidden="true" />{/if}
        </button>
      </li>
    {/each}
  </ol>

  <div class="flex justify-center" aria-hidden="true">
    <span class="h-full w-px bg-line"></span>
  </div>

  <ol class={column} data-testid="german-column">
    {#each round.germanOptions as option (option.pairId)}
      <li>
        <button
          class={optionClass(
            option.pairId,
            selectedGerman === option.pairId,
            wrongGerman === option.pairId,
            true,
          )}
          type="button"
          disabled={disabled || matched.includes(option.pairId)}
          aria-pressed={selectedGerman === option.pairId}
          aria-label={$tr(
            `Německy: ${option.label}${matched.includes(option.pairId) ? ', spojeno' : ''}`,
            `German: ${option.label}${matched.includes(option.pairId) ? ', matched' : ''}`,
          )}
          onclick={() => choose('german', option.pairId, option.label)}
        >
          <strong class="min-w-0 text-[0.82rem] leading-[1.25] [overflow-wrap:anywhere]" lang="de"
            >{option.label}</strong
          >
          {#if matched.includes(option.pairId)}<Check size={16} aria-hidden="true" />{/if}
        </button>
      </li>
    {/each}
  </ol>

  <p
    class="col-span-full mt-1 mb-0 flex flex-wrap justify-between gap-x-[0.8rem] gap-y-[0.3rem] text-[0.68rem] leading-[1.35] text-ink-600"
    role="status"
    aria-live="polite"
  >
    <span class="flex-none font-mono font-[850] text-ink-950"
      >{matched.length}/{round.pairs.length} {$tr('spojeno', 'matched')}</span
    >
    <span>{status}</span>
  </p>
</section>
