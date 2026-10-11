<script lang="ts">
  let {
    checked = $bindable(false),
    title,
    description,
    disabled = false,
  } = $props<{
    checked: boolean;
    title: string;
    description?: string;
    disabled?: boolean;
  }>();
</script>

<label
  class={[
    'flex min-h-[4.25rem] items-center justify-between gap-4 rounded-2xl border border-line bg-paper-50 px-4 py-[0.9rem] has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-3 has-[input:focus-visible]:outline-[color-mix(in_srgb,var(--color-sky-700)_66%,white)]',
    disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
  ]}
>
  <span class="min-w-0">
    <strong class="block text-[0.9rem]">{title}</strong>
    {#if description}<span class="mt-[0.18rem] block text-[0.82rem] leading-[1.4] text-ink-800"
        >{description}</span
      >{/if}
  </span>
  <input class="sr-only" type="checkbox" bind:checked {disabled} />
  <span
    class={[
      'relative h-[1.7rem] w-[2.9rem] flex-none rounded-full border [transition:border-color_160ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil)]',
      checked ? 'border-ink-950 bg-ink-950' : 'border-line bg-paper-200',
    ]}
    aria-hidden="true"
    ><i
      class={[
        'absolute top-[0.19rem] left-[0.2rem] size-[1.18rem] rounded-full bg-white shadow-[0_2px_6px_rgb(23_32_42/0.18)] transition-transform duration-180 ease-out-emil',
        checked && 'translate-x-[1.18rem]',
      ]}
    ></i></span
  >
</label>
