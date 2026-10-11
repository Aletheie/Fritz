<script lang="ts">
  import { localized } from '$lib/i18n';
  import Check from '@lucide/svelte/icons/check';

  import type { AccentTheme, MotherTongue } from '$lib/domain/types.ts';

  let {
    language,
    value = $bindable(),
    onpreview,
  }: {
    language: MotherTongue;
    value: AccentTheme;
    onpreview: (theme: AccentTheme) => void;
  } = $props();

  /** Swatch colours mirror the accent palettes defined in app.css. */
  const themes: Array<{
    value: AccentTheme;
    swatch: string;
    label: [string, string];
    description: [string, string];
  }> = [
    {
      value: 'green',
      swatch: '[--choice:#c9ff38] [--choice-soft:#f1ffc9]',
      label: ['Původní zelená', 'Original green'],
      description: ['Limetková z původního vzhledu', 'The lime accent from the original look'],
    },
    {
      value: 'moss',
      swatch: '[--choice:#7c9f63] [--choice-soft:#e9f0dc]',
      label: ['Mechová', 'Moss'],
      description: ['Klidnější tlumená zelená', 'A calmer muted green'],
    },
    {
      value: 'magenta',
      swatch: '[--choice:#bd659b] [--choice-soft:#f5e3ef]',
      label: ['Magenta', 'Magenta'],
      description: ['Výrazná, ale ne neonová', 'Bold without looking neon'],
    },
    {
      value: 'rose',
      swatch: '[--choice:#b97783] [--choice-soft:#f2e1e4]',
      label: ['Starorůžová', 'Dusty rose'],
      description: ['Měkčí a teplejší tón', 'A softer, warmer tone'],
    },
    {
      value: 'blue',
      swatch: '[--choice:#648ac4] [--choice-soft:#e4ebf7]',
      label: ['Modrá', 'Blue'],
      description: ['Čistý chladnější akcent', 'A clean, cooler accent'],
    },
    {
      value: 'teal',
      swatch: '[--choice:#51948b] [--choice-soft:#dcefeb]',
      label: ['Petrolejová', 'Teal'],
      description: ['Sytá modrozelená', 'A rich blue-green accent'],
    },
  ];

  const copy = ([cs, en]: [string, string]) => localized(language, { cs, en });
</script>

<fieldset
  class="mx-0 mt-4 mb-0 grid grid-cols-[repeat(auto-fit,minmax(13.5rem,1fr))] gap-[0.55rem] border-0 p-0"
  aria-describedby="accent-help"
>
  <legend class="sr-only"
    >{copy(['Vyber hlavní barvu rozhraní', 'Choose the interface accent color'])}</legend
  >
  {#each themes as theme (theme.value)}
    {@const active = value === theme.value}
    <label
      class={[
        'grid min-h-18 cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-[0.65rem] rounded-[0.2rem] border p-[0.7rem] text-ink-950 [transition:transform_120ms_var(--ease-out-emil),border-color_140ms_ease,background-color_140ms_ease,box-shadow_120ms_var(--ease-out-emil)] active:[transform:scale(0.98)] has-focus-visible:outline-3 has-focus-visible:outline-offset-3 has-focus-visible:outline-cobalt-700 min-[640px]:grid-cols-[auto_minmax(0,1fr)_auto]',
        theme.swatch,
        active
          ? 'border-ink-950 bg-white shadow-[3px_3px_0_var(--choice)]'
          : 'border-line bg-paper-100',
      ]}
    >
      <input
        class="m-0 size-[1.05rem] accent-(--choice) min-[640px]:sr-only"
        type="radio"
        name="accent-theme"
        value={theme.value}
        bind:group={value}
        onchange={() => onpreview(theme.value)}
      />
      <span
        class="relative grid size-[2.55rem] place-items-center rounded-[0.2rem_0.7rem_0.2rem_0.2rem] border border-ink-950 bg-(--choice-soft)"
        aria-hidden="true"
        ><i class="size-[1.2rem] rounded-full border border-ink-950 bg-(--choice)"></i></span
      >
      <span
        ><strong class="block text-[0.84rem]">{copy(theme.label)}</strong><small
          class="mt-[0.15rem] block text-[0.75rem] leading-[1.35] text-ink-800"
          >{copy(theme.description)}</small
        ></span
      >
      <span class={['grid place-items-center', !active && 'opacity-0']} aria-hidden="true"
        ><Check size={17} /></span
      >
    </label>
  {/each}
</fieldset>
