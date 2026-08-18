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

<label class:disabled class="toggle-row">
  <span class="min-w-0">
    <strong>{title}</strong>
    {#if description}<span class="description">{description}</span>{/if}
  </span>
  <input class="sr-only" type="checkbox" bind:checked {disabled} />
  <span class:active={checked} class="switch" aria-hidden="true"><i></i></span>
</label>

<style>
  .toggle-row {
    display: flex;
    min-height: 4.25rem;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border: 1px solid var(--color-line);
    border-radius: 1rem;
    background: var(--color-paper-50);
    padding: 0.9rem 1rem;
    cursor: pointer;
  }

  strong {
    display: block;
    font-size: 0.9rem;
  }

  .description {
    display: block;
    margin-top: 0.18rem;
    color: var(--color-ink-800);
    font-size: 0.82rem;
    line-height: 1.4;
  }

  .switch {
    position: relative;
    width: 2.9rem;
    height: 1.7rem;
    flex: none;
    border: 1px solid var(--color-line);
    border-radius: 999px;
    background: var(--color-paper-200);
    transition:
      border-color 160ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil);
  }

  .switch i {
    position: absolute;
    top: 0.19rem;
    left: 0.2rem;
    width: 1.18rem;
    height: 1.18rem;
    border-radius: 999px;
    background: white;
    box-shadow: 0 2px 6px rgb(23 32 42 / 0.18);
    transition: transform 180ms var(--ease-out-emil);
  }

  .switch.active {
    border-color: var(--color-ink-950);
    background: var(--color-ink-950);
  }

  .switch.active i {
    transform: translateX(1.18rem);
  }

  .toggle-row:has(input:focus-visible) {
    outline: 3px solid color-mix(in srgb, var(--color-sky-700) 66%, white);
    outline-offset: 3px;
  }

  .disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
</style>
