<script lang="ts">
  let {
    mood = 'ready',
    small = false,
    class: className = '',
  } = $props<{
    mood?: 'ready' | 'thinking' | 'pleased' | 'surprised';
    small?: boolean;
    class?: string;
  }>();
  const eyeTransforms: Record<string, string> = {
    ready: '',
    thinking: '[transform:translateX(3px)_scaleY(0.7)]',
    surprised: '[transform:scaleY(1.2)]',
    pleased: '[transform:scaleY(0.65)]',
  };
</script>

<svg
  class={[
    'flex-none overflow-visible text-cobalt-700',
    small ? 'size-13' : 'size-[6.25rem]',
    className,
  ]}
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
  <circle
    class={mood === 'thinking'
      ? 'animate-thinking motion-reduce:animate-none motion-off:animate-none'
      : undefined}
    cx="50"
    cy="11"
    r="5"
    fill="currentColor"
  />
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
  <g
    data-testid="rival-eyes"
    class={[
      'origin-[50px_50px] transition-transform duration-180 ease-out-emil motion-reduce:transition-none motion-off:transition-none',
      eyeTransforms[mood],
    ]}
    fill="var(--color-acid-500)"
  >
    <rect x="35" y="44" width="7" height="13" rx="3.5" />
    <rect x="58" y="44" width="7" height="13" rx="3.5" />
  </g>
  <path
    d={mood === 'surprised' ? 'M46 72H54' : mood === 'pleased' ? 'M43 70Q50 76 57 70' : 'M43 72H57'}
    stroke="white"
    stroke-width="2.5"
    stroke-linecap="round"
  />
</svg>
