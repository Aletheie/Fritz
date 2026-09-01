<script lang="ts">
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';

  let { oninsert } = $props<{ oninsert: (character: string) => void }>();
  const characters = ['ä', 'ö', 'ü', 'ß'];

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }
</script>

<div class="keyboard" aria-label={copy('Německé znaky', 'German characters')}>
  {#each characters as character}
    <button
      type="button"
      onclick={() => oninsert(character)}
      aria-label={copy(`Vložit ${character}`, `Insert ${character}`)}
    >
      {character}
    </button>
  {/each}
</div>

<style>
  .keyboard {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  button {
    display: grid;
    min-width: 2.75rem;
    min-height: 2.75rem;
    place-items: center;
    border: 1px solid var(--color-line);
    border-radius: 0.75rem;
    color: var(--color-ink-950);
    background: var(--color-paper-50);
    font-weight: 800;
    box-shadow: 0 2px 0 var(--color-paper-200);
    transition:
      transform 140ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil);
  }

  @media (hover: hover) and (pointer: fine) {
    button:hover {
      background: white;
    }
  }

  button:active {
    transform: translateY(1px) scale(0.97);
    box-shadow: none;
  }
</style>
