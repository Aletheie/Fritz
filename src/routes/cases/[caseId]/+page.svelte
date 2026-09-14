<script lang="ts">
  import CaseSession from '$lib/components/cases/CaseSession.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
</script>

{#key data.caseFile.id}<CaseSession caseFile={data.caseFile} />{/key}
