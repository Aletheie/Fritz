<script lang="ts">
  let { size = 38 } = $props<{ size?: number }>();
</script>

<img
  class="block flex-none object-contain select-none"
  src="/icons/icon-192.png"
  alt=""
  width={size}
  height={size}
  draggable="false"
  aria-hidden="true"
/>
