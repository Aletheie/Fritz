<script lang="ts">
  import { readLearner, rivalWeakness } from '$lib/domain/rival/engine.ts';
  import { localized } from '$lib/i18n';
  import {
    rivalPersonalities,
    rivalReadingLine,
    rivalRematchLine,
    rivalTopics,
  } from '$lib/i18n/rival.ts';
  import { appStore, motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Bot from '@lucide/svelte/icons/bot';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import UserRound from '@lucide/svelte/icons/user-round';
  import RivalAvatar from './RivalAvatar.svelte';

  import type { WeeklyRival } from '$lib/domain/gamification.ts';

  type Props = {
    rival: WeeklyRival;
    userName?: string;
    compact?: boolean;
  };
  let { rival, userName = 'Ty', compact = false }: Props = $props();

  const avatar =
    'grid size-[2.35rem] flex-none place-items-center rounded-full border border-ink-950 font-mono text-[0.63rem] font-black';
  const playerName = 'block truncate text-[0.78rem] font-[850]';
  const playerXp = 'mt-[0.08rem] block font-mono text-[0.64rem] font-extrabold';
  const track = 'h-[0.58rem] overflow-hidden rounded-full bg-paper-200';
  const fill =
    'block h-full w-full origin-left rounded-[inherit] transition-transform duration-220 ease-out-emil';
  const note = 'mt-[0.2rem] text-[0.7rem] leading-[1.45] text-ink-600';

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  const reading = $derived(readLearner($appStore.recentReviews, $appStore.course.events));
  const activeMatch = $derived($appStore.course.rivalry?.match);
  const lastResult = $derived(
    $appStore.course.rivalry?.history.findLast((match) => match.rivalId === rival.profile.id),
  );

  let deadlineLabel = $derived(
    rival.daysLeft === 1
      ? copy('poslední den', 'last day')
      : copy(
          `${rival.daysLeft} ${rival.daysLeft >= 2 && rival.daysLeft <= 4 ? 'dny' : 'dní'}`,
          `${rival.daysLeft} days`,
        ),
  );

  let statusMessage = $derived(
    $motherTongue === 'cs'
      ? rival.message
      : rival.standing === 'leading'
        ? `You lead by ${rival.difference} XP.`
        : rival.standing === 'trailing'
          ? `${rival.profile.name} leads by ${Math.abs(rival.difference)} XP.`
          : 'You are tied.',
  );

  let rivalStyle = $derived(
    $motherTongue === 'cs'
      ? rival.profile.style
      : rival.profile.id === 'konrad'
        ? 'strong finish'
        : rival.profile.id === 'nora'
          ? 'short daily sessions'
          : 'steady pace',
  );
</script>

<div class={['grid', compact ? 'gap-3' : 'gap-4']} data-testid="rival-duel">
  <header class="flex items-center justify-between gap-4 max-[431px]:items-start">
    <div class="flex min-w-0 items-center gap-[0.65rem]">
      <span
        class={[
          'grid flex-none place-items-center rounded-full border border-ink-950 bg-sky-50 text-cobalt-700',
          compact ? 'size-[2.1rem]' : 'size-[2.45rem]',
        ]}
        aria-hidden="true"><Bot size={19} /></span
      >
      <div>
        <p
          class="font-mono text-[0.59rem] font-extrabold tracking-[0.065em] text-ink-600 uppercase"
        >
          {copy('Soukromý soupeř', 'Private rival')}
        </p>
        <h3 class="mt-[0.1rem] text-[1.05rem] font-[880] tracking-[-0.025em]">
          {userName} vs. {rival.profile.name}
        </h3>
      </div>
    </div>
    <span
      class="flex flex-none items-center gap-[0.3rem] rounded-full border border-line bg-paper-50 px-2 py-[0.35rem] font-mono text-[0.58rem] font-[780] text-ink-600 max-[431px]:border-0 max-[431px]:bg-transparent max-[431px]:px-0"
      ><Clock3 size={13} /> {deadlineLabel}</span
    >
  </header>

  <div
    class="flex items-center justify-between gap-[0.65rem]"
    role="group"
    aria-label={copy(
      `Týdenní duel: ${userName} ${rival.userXp} XP, ${rival.profile.name} ${rival.rivalXp} XP`,
      `Weekly duel: ${userName} ${rival.userXp} XP, ${rival.profile.name} ${rival.rivalXp} XP`,
    )}
  >
    <div
      class={[
        'flex min-w-0 flex-1 items-center gap-[0.55rem]',
        rival.standing === 'leading' ? 'text-ink-950' : 'text-ink-600',
      ]}
    >
      <span class="{avatar} bg-acid-500 text-ink-950" aria-hidden="true"
        ><UserRound size={19} /></span
      >
      <div>
        <strong class={playerName}>{userName}</strong><small class={playerXp}
          >{rival.userXp} XP</small
        >
      </div>
    </div>
    <span class="font-mono text-[0.55rem] font-black text-ink-600">VS</span>
    <div
      class={[
        'flex min-w-0 flex-1 items-center justify-end gap-[0.55rem] text-right',
        rival.standing === 'trailing' ? 'text-ink-950' : 'text-ink-600',
      ]}
    >
      <div>
        <strong class={playerName}>{rival.profile.name}</strong><small class={playerXp}
          >{rival.rivalXp} XP</small
        >
      </div>
      <span class="{avatar} bg-cobalt-700 text-white" aria-hidden="true"
        >{rival.profile.initials}</span
      >
    </div>
  </div>

  <div class="grid gap-[0.35rem]">
    <div
      class={track}
      role="progressbar"
      aria-label={`${userName}: ${rival.userXp} XP`}
      aria-valuemin="0"
      aria-valuemax={Math.max(rival.targetXp, rival.userXp, rival.rivalXp)}
      aria-valuenow={rival.userXp}
    >
      <i class="{fill} bg-acid-500" style:transform={`scaleX(${rival.userPercent / 100})`}></i>
    </div>
    <div
      class={track}
      role="progressbar"
      aria-label={`${rival.profile.name}: ${rival.rivalXp} XP`}
      aria-valuemin="0"
      aria-valuemax={Math.max(rival.targetXp, rival.userXp, rival.rivalXp)}
      aria-valuenow={rival.rivalXp}
    >
      <i class="{fill} bg-cobalt-700" style:transform={`scaleX(${rival.rivalPercent / 100})`}></i>
    </div>
  </div>

  <div>
    <strong class="block text-[0.82rem]">{statusMessage}</strong>
    <span class="{note} block">{rivalStyle} · {rival.weekLabel}</span>
  </div>

  {#if !compact}
    <div
      class="flex items-start gap-[0.65rem] rounded-[10px] bg-cobalt-50 p-3"
      data-testid="rival-thought"
    >
      <RivalAvatar small />
      <p class="text-[0.81rem] leading-[1.55] text-ink-800">
        {lastResult
          ? rivalRematchLine(
              lastResult.rounds.filter((round) => round.correct).length,
              $motherTongue,
            )
          : rivalReadingLine(reading, $motherTongue)}
      </p>
    </div>
    <details class="text-[0.8rem] leading-normal">
      <summary class="min-h-11 cursor-pointer content-center"
        >{copy('Přečíst soupeřovu taktiku', 'Read your rival’s strategy')}</summary
      >
      <p class="mb-2 text-ink-700">{rivalPersonalities[rival.profile.id].plan[$motherTongue]}</p>
      <strong
        >{copy('Slabší místo:', 'Weaker side:')}
        {rivalTopics[rivalWeakness(rival.profile.id)][$motherTongue]}</strong
      >
    </details>
  {/if}
  <a
    class="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-cobalt-700 bg-cobalt-50 px-[0.8rem] py-[0.65rem] text-[0.83rem] font-[750] text-cobalt-700 no-underline transition-transform duration-140 ease-out-emil active:[transform:scale(0.97)] fine-hover:bg-cobalt-100"
    href="/rival/"
    >{activeMatch && !activeMatch.completedAt
      ? copy('Pokračovat v souboji', 'Resume duel')
      : copy('Vyzvat na souboj · 5 kol', 'Challenge rival · 5 rounds')}<ArrowRight
      size={16}
      aria-hidden="true"
    /></a
  >

  {#if !compact}
    <p class="{note} border-t border-line pt-3">
      {copy(
        'Týdenní tempo i soupeř jsou lokální simulace. V přímém souboji robot reaguje na tvoje odpovědi a pamatuje si odvety.',
        'The weekly pace and rival are simulated locally. In a direct duel the robot adapts to your answers and remembers rematches.',
      )}
    </p>
  {/if}
</div>
