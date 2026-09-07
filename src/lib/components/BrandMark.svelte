<script lang="ts">
  let { size = 38 } = $props<{ size?: number }>();
</script>

<img
  class="brand-mark"
  src="/icons/icon-192.png"
  alt=""
  width={size}
  height={size}
  draggable="false"
  aria-hidden="true"
/>

<style>
  .brand-mark {
    display: block;
    flex: 0 0 auto;
    object-fit: contain;
    user-select: none;
  }
</style>
