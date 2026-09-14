<script lang="ts">
  let { mood = 'ready', small = false } = $props<{
    mood?: 'ready' | 'thinking' | 'pleased' | 'surprised';
    small?: boolean;
  }>();
</script>

<svg
  class:small
  class="robot"
  class:thinking={mood === 'thinking'}
  class:surprised={mood === 'surprised'}
  class:pleased={mood === 'pleased'}
  viewBox="0 0 100 100"
  fill="none"
  aria-hidden="true"
>
  <path
    d="M50 24V14M18 51H12V64H18M82 51H88V64H82"
    stroke="currentColor"
    stroke-width="3"
    stroke-linecap="round"
  />
  <circle class="signal" cx="50" cy="11" r="5" fill="currentColor" />
  <rect
    x="18"
    y="26"
    width="64"
    height="56"
    rx="16"
    fill="var(--color-cobalt-700)"
    stroke="currentColor"
    stroke-width="2"
  />
  <rect x="26" y="36" width="48" height="29" rx="9" fill="var(--color-ink-950)" />
  <g class="eyes" fill="var(--color-acid-500)">
    <rect x="35" y="44" width="7" height="13" rx="3.5" />
    <rect x="58" y="44" width="7" height="13" rx="3.5" />
  </g>
  <path
    class="mouth"
    d={mood === 'surprised' ? 'M46 72H54' : mood === 'pleased' ? 'M43 70Q50 76 57 70' : 'M43 72H57'}
    stroke="white"
    stroke-width="2.5"
    stroke-linecap="round"
  />
</svg>

<style>
  .robot {
    width: 6.25rem;
    height: 6.25rem;
    flex: none;
    color: var(--color-cobalt-700);
    overflow: visible;
  }
  .small {
    width: 3.25rem;
    height: 3.25rem;
  }
  .eyes {
    transform-origin: 50px 50px;
    transition: transform 180ms var(--ease-out-emil);
  }
  .thinking .eyes {
    transform: translateX(3px) scaleY(0.7);
  }
  .surprised .eyes {
    transform: scaleY(1.2);
  }
  .pleased .eyes {
    transform: scaleY(0.65);
  }
  .thinking .signal {
    animation: thinking 900ms ease-in-out infinite alternate;
  }
  @keyframes thinking {
    to {
      opacity: 0.35;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .eyes {
      transition: none;
    }
    .thinking .signal {
      animation: none;
    }
  }
  :global(html[data-motion='reduced']) .eyes {
    transition: none;
  }
  :global(html[data-motion='reduced']) .thinking .signal {
    animation: none;
  }
</style>
