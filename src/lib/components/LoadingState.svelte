<script lang="ts">
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  let { label } = $props<{ label?: string }>();
  let displayedLabel = $derived(
    label ?? localized($motherTongue, { cs: 'Načítám…', en: 'Loading…' }),
  );
</script>

<div class="surface flex min-h-52 flex-col items-center justify-center gap-3 p-8 text-center">
  <LoaderCircle class="animate-spin" size={25} />
  <p class="font-semibold text-ink-600">{displayedLabel}</p>
</div>
