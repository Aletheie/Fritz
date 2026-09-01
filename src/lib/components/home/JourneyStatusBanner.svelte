<script lang="ts">
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Brain from '@lucide/svelte/icons/brain';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

  import type { HomePrimaryAction } from './home-view-model.ts';

  let { action }: { action: HomePrimaryAction } = $props();
</script>

<section class:urgent={action.urgent} class="review-branch" aria-labelledby="review-branch-title">
  <span class="branch-icon" aria-hidden="true">
    {#if action.urgent}<TriangleAlert size={25} />{:else}<Brain size={25} />{/if}
  </span>
  <div>
    <p>{action.eyebrow}</p>
    <h2 id="review-branch-title">{action.title}</h2>
    <span>{action.description}</span>
  </div>
  <a class="btn-base btn-primary" href={action.href}>{action.action}<ArrowRight size={19} /></a>
</section>

<style>
  .review-branch {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.9rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem 1rem 0.65rem 0.65rem;
    background: var(--color-acid-100);
    padding: 0.9rem;
    box-shadow: 0 4px 0 var(--color-ink-950);
  }
  .review-branch.urgent {
    background: var(--color-coral-50);
  }
  .branch-icon {
    display: grid;
    width: 3rem;
    height: 3rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.5rem 0.75rem 0.5rem 0.5rem;
    color: white;
    background: var(--color-cobalt-700);
  }
  .urgent .branch-icon {
    color: var(--color-coral-700);
  }
  p {
    margin: 0;
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.64rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  h2 {
    margin: 0.2rem 0 0;
    font-size: 1.45rem;
    line-height: 1.08;
    text-wrap: balance;
  }
  div > span {
    display: block;
    margin-top: 0.3rem;
    color: var(--color-ink-800);
    font-size: 0.88rem;
    line-height: 1.45;
  }
  a {
    flex: none;
    font-size: 1rem;
    white-space: nowrap;
  }
  @media (max-width: 679px) {
    .review-branch {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .review-branch a {
      grid-column: 1 / -1;
      width: 100%;
    }
  }
  @media (min-width: 900px) and (max-width: 1079px) {
    .review-branch {
      grid-template-columns: auto minmax(0, 1fr);
    }
    .review-branch a {
      grid-column: 1 / -1;
      width: 100%;
    }
  }
  @media (max-width: 359px) {
    .branch-icon {
      display: none;
    }
    .review-branch {
      grid-template-columns: 1fr;
    }
  }
</style>
