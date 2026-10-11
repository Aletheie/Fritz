<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { Snippet } from 'svelte';

  import { connectorPath } from './path-geometry.ts';

  let { children }: { children: Snippet } = $props();
  let root: HTMLDivElement;
  let width = $state(0);
  let height = $state(0);
  let path = $state('');

  onMount(() => {
    let frame = 0;
    const observer = new ResizeObserver(scheduleMeasure);

    function scheduleMeasure(): void {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    }

    function measure(): void {
      const bounds = root.getBoundingClientRect();
      const anchors = [...root.querySelectorAll<HTMLElement>('[data-path-node-anchor]')];
      const points = anchors.map((anchor) => {
        const rect = anchor.getBoundingClientRect();
        return {
          x: rect.left - bounds.left + rect.width / 2,
          y: rect.top - bounds.top + rect.height / 2,
        };
      });
      width = Math.max(1, bounds.width);
      height = Math.max(1, root.scrollHeight);
      path = connectorPath(points);
    }

    void tick().then(() => {
      observer.observe(root);
      for (const anchor of root.querySelectorAll<HTMLElement>('[data-path-node-anchor]')) {
        observer.observe(anchor);
      }
      scheduleMeasure();
      return undefined;
    });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  });
</script>

<div bind:this={root} class="@container relative">
  {#if path}
    <svg
      data-testid="path-connector"
      class="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        class="fill-none stroke-[color-mix(in_srgb,var(--color-cobalt-700)_24%,var(--color-paper-200))] stroke-9 [stroke-linecap:round] [vector-effect:non-scaling-stroke]"
        d={path}
      ></path>
    </svg>
  {/if}
  {@render children()}
</div>
