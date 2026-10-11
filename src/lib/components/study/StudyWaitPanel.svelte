<script lang="ts">
  import { labIndex } from '$lib/components/study/study-styles.ts';
  import { formatWait } from '$lib/domain/study/results.ts';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';

  import type { StudySession } from '$lib/state/study-session.svelte.ts';

  let { session }: { session: StudySession } = $props();

  const copy = (cs: string, en: string) => session.copy(cs, en);
</script>

<section
  class="mt-5 grid min-h-[30rem] grid-cols-[auto_minmax(0,1fr)] items-center gap-6 rounded-[0.25rem] border border-ink-950 bg-paper-50 p-[clamp(1.5rem,5vw,4rem)] shadow-[7px_7px_0_var(--color-ink-950)] max-[900px]:mt-0 max-[900px]:h-full max-[900px]:min-h-0 max-[900px]:overflow-y-auto max-[900px]:rounded-none max-[900px]:border-0 max-[900px]:shadow-none"
>
  <div
    class="[transform:rotate(180deg)] font-mono text-[clamp(2rem,8vw,5rem)] leading-none font-black text-cobalt-700 [writing-mode:vertical-rl]"
  >
    {formatWait(session.waitMs)}
  </div>
  <div>
    <p class={labIndex}>learning step / {copy('krátká mezera', 'short gap')}</p>
    <h1
      class="mt-2 max-w-xl text-[clamp(2rem,6vw,4.6rem)] leading-[0.92] font-black tracking-[-0.04em]"
    >
      {copy('Za chvíli to zkusíš znovu', 'Try again in a moment')}
    </h1>
    <p class="mt-4 max-w-[34rem] leading-[1.65] text-ink-600">
      {copy(
        'Slovíčko si zopakuješ za chvíli. Teď si můžeš dát krátkou pauzu.',
        'You’ll review this word in a moment. Take a short break for now.',
      )}
    </p>
    {#if session.mode === 'cram'}
      <button class="btn-base btn-secondary mt-6" type="button" onclick={() => session.resetSetup()}
        ><ArrowLeft size={18} /> {copy('Změnit sprint', 'Change sprint')}</button
      >
    {/if}
  </div>
</section>
