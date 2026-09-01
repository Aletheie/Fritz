<script lang="ts">
  let { size = 38 } = $props<{ size?: number }>();
</script>

<div class="brand-mark" style:width={`${size}px`} style:height={`${size}px`} aria-hidden="true">
  <span>F</span>
  <i></i>
  <i></i>
</div>

<style>
  .brand-mark {
    position: relative;
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.2rem 0.75rem 0.2rem 0.2rem;
    color: var(--color-ink-950);
    background: var(--color-acid-500);
    box-shadow: 3px 3px 0 currentColor;
  }

  span {
    transform: translate(4%, 3%);
    font-size: 58%;
    font-weight: 950;
    letter-spacing: -0.04em;
    line-height: 1;
  }

  i {
    position: absolute;
    top: 17%;
    width: 7%;
    aspect-ratio: 1;
    border-radius: 999px;
    background: currentColor;
  }

  i:first-of-type {
    left: 38%;
  }

  i:last-of-type {
    right: 34%;
  }
</style>
