<script lang="ts">
  // oxlint-disable-next-line import/no-unassigned-import -- global stylesheet
  import '../app.css';
  import type { Snippet } from 'svelte';

  let { children } = $props<{ children: Snippet }>();
</script>

{@render children()}
