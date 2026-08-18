<script lang="ts">
  let {
    title,
    detail,
    minutes,
    index,
    current = false,
    complete = false,
  } = $props<{
    title: string;
    detail: string;
    minutes: number;
    index: number;
    current?: boolean;
    complete?: boolean;
  }>();
</script>

<li class="lesson-step" class:current class:complete aria-current={current ? 'step' : undefined}>
  <span class="step-number" aria-hidden="true">
    {#if complete}✓{:else}{index + 1}{/if}
  </span>
  <span class="step-copy">
    <strong>{title}</strong>
    <span>{detail}</span>
  </span>
  <span class="step-time">{minutes} min</span>
</li>

<style>
  .lesson-step {
    display: grid;
    align-items: center;
    gap: 0.8rem;
    grid-template-columns: 2rem minmax(0, 1fr) auto;
    border-radius: 0.65rem;
    padding: 0.8rem 0.6rem;
  }

  .lesson-step.current {
    background: var(--accent-soft);
  }

  .lesson-step.complete {
    color: var(--success);
  }

  .step-number {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 1px solid var(--line);
    border-radius: 50%;
    color: var(--ink-muted);
    background: var(--paper);
    font-size: 0.8rem;
    font-weight: 700;
  }

  .current .step-number {
    border-color: var(--ink);
    color: var(--ink);
    background: var(--accent);
  }

  .complete .step-number {
    border-color: var(--success);
    color: var(--surface);
    background: var(--success);
  }

  .step-copy {
    display: grid;
    gap: 0.15rem;
  }

  .step-copy strong {
    color: var(--ink);
    font-size: 0.98rem;
  }

  .step-copy span,
  .step-time {
    color: var(--ink-muted);
    font-size: 0.82rem;
  }

  .complete .step-copy strong {
    color: var(--success);
  }

  @media (max-width: 420px) {
    .lesson-step {
      grid-template-columns: 2rem minmax(0, 1fr);
      row-gap: 0.35rem;
    }

    .step-time {
      grid-column: 2;
      justify-self: start;
    }
  }
</style>
