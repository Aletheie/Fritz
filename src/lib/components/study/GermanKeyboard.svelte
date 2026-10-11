<script lang="ts">
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';

  let { oninsert } = $props<{ oninsert: (character: string) => void }>();
  const characters = ['ä', 'ö', 'ü', 'ß'];

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }
</script>

<div class="flex flex-wrap gap-[0.45rem]" aria-label={copy('Německé znaky', 'German characters')}>
  {#each characters as character}
    <button
      class="grid min-h-11 min-w-11 place-items-center rounded-xl border border-line bg-paper-50 font-extrabold text-ink-950 shadow-[0_2px_0_var(--color-paper-200)] [transition:transform_140ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil)] active:[transform:translateY(1px)_scale(0.97)] active:shadow-none fine-hover:bg-white"
      type="button"
      onclick={() => oninsert(character)}
      aria-label={copy(`Vložit ${character}`, `Insert ${character}`)}
    >
      {character}
    </button>
  {/each}
</div>
