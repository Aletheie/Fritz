<script lang="ts">
  let { days = 3 } = $props<{ days?: number }>();
  let unit = $derived(days === 1 ? 'den' : days >= 2 && days <= 4 ? 'dny' : 'dní');
</script>

<p class="streak"><span aria-hidden="true">✦</span> {days} {unit} v řadě</p>

<style>
  .streak {
    margin: 0;
    color: var(--ink-muted);
    font-size: 0.875rem;
  }

  .streak span {
    margin-right: 0.25rem;
    color: var(--cobalt);
  }

  @media (max-width: 420px) {
    .streak {
      font-size: 0.78rem;
    }
  }
</style>
