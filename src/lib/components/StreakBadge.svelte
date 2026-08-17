<script lang="ts">
  let { days = 3 } = $props<{ days?: number }>();
</script>

<p class="streak"><span aria-hidden="true">✦</span> {days} dny v řadě</p>

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
