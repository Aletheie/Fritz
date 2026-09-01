<script lang="ts">
  // oxlint-disable-next-line import/no-unassigned-import -- global stylesheet
  import '../app.css';
  import { page } from '$app/state';
  import AppShell from '$lib/components/AppShell.svelte';
  import type { Snippet } from 'svelte';

  let { children } = $props<{ children: Snippet }>();
  const loginRoute = $derived(
    (page.url.pathname as string) === '/login' || page.url.pathname === '/login/',
  );
</script>

{#if loginRoute}
  {@render children()}
{:else}
  <AppShell>
    {@render children()}
  </AppShell>
{/if}
