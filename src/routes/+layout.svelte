<script lang="ts">
  // oxlint-disable-next-line import/no-unassigned-import -- global stylesheet
  import '../app.css';
  import type { Snippet } from 'svelte';

  let { children } = $props<{ children: Snippet }>();
</script>

<a class="skip-link" href="#main-content">Přeskočit na hlavní obsah</a>

{@render children()}

<style>
  .skip-link {
    position: fixed;
    z-index: 10;
    top: 1rem;
    left: 1rem;
    transform: translateY(-160%);
    border: 1px solid var(--ink);
    border-radius: 0.6rem;
    padding: 0.7rem 0.9rem;
    color: var(--ink);
    background: var(--accent);
    box-shadow: 3px 3px 0 var(--ink);
    font-weight: 700;
    text-decoration: none;
    transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  .skip-link:focus-visible {
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .skip-link {
      transition: none;
    }
  }
</style>
