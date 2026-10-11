<script lang="ts">
  import { tr } from '$lib/state/app';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Check from '@lucide/svelte/icons/check';
  import { centered, centeredText, centeredTitle, link } from './today-styles.ts';

  import type { DailySessionRecord } from '$lib/domain/learning/types.ts';

  let { session, total }: { session: DailySessionRecord; total: number } = $props();
</script>

<section class={centered} aria-labelledby="lesson-complete-title">
  <span
    class="grid size-[4.5rem] place-items-center rounded-[0.8rem] border border-ink-950 bg-acid-500 shadow-[4px_4px_0_var(--color-ink-950)]"
    ><Check size={34} strokeWidth={2.6} aria-hidden="true" /></span
  >
  <p
    class="mt-[1.3rem] mb-0 font-mono text-[0.72rem] font-extrabold tracking-[0.1em] text-cobalt-700 uppercase"
  >
    {$tr('Lekce uzavřena', 'Lesson complete')}
  </p>
  <h1 class={centeredTitle} id="lesson-complete-title">
    {$tr('Dnes je hotovo.', 'You are done for today.')}
  </h1>
  <p class={centeredText}>
    {$tr(
      `Prošla jsi ${total} úloh. Další termíny opakování jsou uložené v tomto zařízení.`,
      `You completed ${total} activities. Your next review dates are saved on this device.`,
    )}
  </p>
  <dl
    class="my-[1.2rem] grid w-full grid-cols-3 border-y border-line max-[561px]:grid-cols-1 [&_dd]:mt-1 [&_dd]:mb-0 [&_dd]:font-extrabold [&_dt]:text-[0.72rem] [&_dt]:text-ink-700 [&>div]:px-2 [&>div]:py-4 max-[561px]:[&>div+div]:border-t max-[561px]:[&>div+div]:border-line"
  >
    <div>
      <dt>{$tr('Čas', 'Time')}</dt>
      <dd>{session.plan.minutes} min</dd>
    </div>
    <div>
      <dt>{$tr('Záznamy o učení', 'Learning records')}</dt>
      <dd>{session.evidenceIds.length}</dd>
    </div>
    <div>
      <dt>{$tr('Soukromí', 'Privacy')}</dt>
      <dd>{$tr('jen v zařízení', 'on-device')}</dd>
    </div>
  </dl>
  <div class="flex flex-wrap justify-center gap-3">
    <a class="{link} bg-ink-950 text-white" href="/"
      ><ArrowLeft size={18} aria-hidden="true" />{$tr('Zpět na cestu', 'Back to path')}</a
    >
    <a class="{link} bg-paper-50 text-ink-950" href="/progress/"
      >{$tr('Prohlédnout pokrok', 'View progress')}<ArrowRight size={18} aria-hidden="true" /></a
    >
  </div>
</section>
