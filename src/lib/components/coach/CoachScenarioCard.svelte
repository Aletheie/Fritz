<script lang="ts">
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Briefcase from '@lucide/svelte/icons/briefcase';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import Check from '@lucide/svelte/icons/check';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Coffee from '@lucide/svelte/icons/coffee';
  import Croissant from '@lucide/svelte/icons/croissant';
  import GraduationCap from '@lucide/svelte/icons/graduation-cap';
  import Heart from '@lucide/svelte/icons/heart';
  import HeartPulse from '@lucide/svelte/icons/heart-pulse';
  import Hotel from '@lucide/svelte/icons/hotel';
  import House from '@lucide/svelte/icons/house';
  import Luggage from '@lucide/svelte/icons/luggage';
  import MapPinned from '@lucide/svelte/icons/map-pinned';
  import MessagesSquare from '@lucide/svelte/icons/messages-square';
  import MicVocal from '@lucide/svelte/icons/mic-vocal';
  import Presentation from '@lucide/svelte/icons/presentation';
  import Scale from '@lucide/svelte/icons/scale';
  import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
  import TimerReset from '@lucide/svelte/icons/timer-reset';
  import TrainFront from '@lucide/svelte/icons/train-front';
  import Users from '@lucide/svelte/icons/users';

  import type { CoachScenario } from '$lib/domain/course/coach.ts';

  let {
    scenario,
    number,
    practiced,
    practicedToday,
    favorite,
    favoriteSaving,
    ontogglefavorite,
  }: {
    scenario: CoachScenario;
    number: number;
    practiced: boolean;
    practicedToday: boolean;
    favorite: boolean;
    favoriteSaving: boolean;
    ontogglefavorite: () => void;
  } = $props();

  const icons = {
    coffee: Coffee,
    train: TrainFront,
    school: GraduationCap,
    shopping: ShoppingBag,
    people: Users,
    food: Croissant,
    map: MapPinned,
    hotel: Hotel,
    health: HeartPulse,
    calendar: CalendarDays,
    home: House,
    work: Briefcase,
    luggage: Luggage,
    presentation: Presentation,
    timer: TimerReset,
    discussion: MessagesSquare,
    debate: Scale,
    interview: MicVocal,
  };
  const backgrounds = {
    coral: 'bg-coral-50',
    sky: 'bg-sky-50',
    mint: 'bg-mint-50',
    butter: 'bg-butter-50',
  };

  const copy = (cs: string, en: string) => localized($motherTongue, { cs, en });
  const Icon = $derived(icons[scenario.icon]);
</script>

<div class="relative min-w-0">
  <a
    class={[
      'relative flex h-full min-h-76 flex-col overflow-hidden rounded-[0.65rem_1.55rem_0.65rem_0.65rem] border border-ink-950 p-[1.15rem] text-ink-950 shadow-[5px_5px_0_rgb(21_25_28/0.12)] [transition:transform_190ms_var(--ease-out-emil),box-shadow_190ms_var(--ease-out-emil)] after:absolute after:-right-[3.8rem] after:-bottom-16 after:size-36 after:rounded-full after:border-[1.5rem] after:border-[rgb(21_25_28/0.055)] after:content-[""] max-[521px]:min-h-68 fine-hover:[transform:translateY(-3px)] fine-hover:shadow-[8px_8px_0_rgb(21_25_28/0.12)]',
      backgrounds[scenario.accent],
    ]}
    data-testid="scenario-card"
    href={`/coach/session/${scenario.id}/`}
  >
    <div class="flex items-center justify-between">
      <span
        class="grid size-[3.1rem] place-items-center rounded-[0.5rem_1rem_0.5rem_0.5rem] border border-ink-950 bg-paper-50 shadow-[3px_3px_0_var(--color-ink-950)]"
        ><Icon size={24} /></span
      >
      <span class="mr-[3.1rem] font-mono text-[0.7rem] font-black"
        >{String(number).padStart(2, '0')}</span
      >
    </div>
    <p
      class="mt-4 mb-0 font-mono text-[0.75rem] font-extrabold tracking-[0.06em] text-ink-800 uppercase"
    >
      {scenario.eyebrow}
    </p>
    <h3
      class="mt-[0.35rem] max-w-[13ch] text-[1.55rem] leading-[0.98] font-[920] tracking-[-0.04em]"
    >
      {scenario.title}
    </h3>
    <p class="mt-3 mb-0 text-[0.8rem] leading-normal text-ink-800">{scenario.description}</p>
    <div
      class="mt-4 flex items-start gap-[0.45rem] border-t border-[rgb(21_25_28/0.13)] pt-[0.8rem] text-[0.7rem] leading-[1.45] font-[760]"
    >
      <Check class="mt-[0.08rem] flex-none" size={15} />
      {scenario.goal}
    </div>
    <footer
      class="relative z-1 mt-auto flex items-center gap-2 pt-[1.2rem] font-mono text-[0.58rem] font-[820] [&>span]:inline-flex [&>span]:items-center [&>span]:gap-[0.28rem]"
    >
      <span><Clock3 size={14} /> {scenario.minutes} min</span>
      <span>{scenario.level}</span>
      <span class={practicedToday ? 'text-mint-700' : ''}
        >{practicedToday
          ? copy('dnes hotovo', 'done today')
          : practiced
            ? copy('+ až 25 XP dnes', '+ up to 25 XP today')
            : copy('+ až 25 XP', '+ up to 25 XP')}</span
      >
      <ArrowRight class="ml-auto" size={18} />
    </footer>
  </a>
  <button
    class={[
      'absolute top-4 right-4 z-2 grid size-11 place-items-center rounded-full border [transition:color_150ms_var(--ease-out-emil),background-color_150ms_var(--ease-out-emil),transform_140ms_var(--ease-out-emil)] active:[transform:scale(0.94)] disabled:cursor-wait disabled:opacity-65 fine-hover:not-disabled:bg-coral-50 fine-hover:not-disabled:text-coral-700',
      favorite
        ? 'border-coral-700 bg-coral-50 text-coral-700'
        : 'border-[color-mix(in_srgb,var(--color-ink-950)_24%,transparent)] bg-white/82 text-ink-600',
    ]}
    type="button"
    aria-label={favorite
      ? copy(`Odebrat ${scenario.title} z oblíbených`, `Remove ${scenario.title} from favorites`)
      : copy(`Přidat ${scenario.title} do oblíbených`, `Add ${scenario.title} to favorites`)}
    aria-pressed={favorite}
    disabled={favoriteSaving}
    onclick={ontogglefavorite}
  >
    <Heart size={18} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
  </button>
</div>
