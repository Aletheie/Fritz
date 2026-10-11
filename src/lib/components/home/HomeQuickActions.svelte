<script lang="ts">
  import { t } from '$lib/i18n';
  import { rivalNames } from '$lib/i18n/rival.ts';
  import { appStore, gameProgress, motherTongue } from '$lib/state/app';
  import BookOpen from '@lucide/svelte/icons/book-open';
  import Bot from '@lucide/svelte/icons/bot';
  import CalendarCheck from '@lucide/svelte/icons/calendar-check';
  import Plus from '@lucide/svelte/icons/plus';
  import Search from '@lucide/svelte/icons/search';
  import Swords from '@lucide/svelte/icons/swords';
  const match = $derived($appStore.course.rivalry?.match);
  const rivalName = $derived(match ? rivalNames[match.rivalId] : $gameProgress.rival.profile.name);
  const canResume = $derived(Boolean(match && !match.completedAt));
  let { class: className = '' }: { class?: string } = $props();

  const link =
    'grid min-h-[4.25rem] grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.55rem] rounded-[0.5rem_0.8rem_0.5rem_0.5rem] bg-[color-mix(in_srgb,var(--color-paper-50)_68%,transparent)] p-[0.65rem] text-inherit no-underline [transition:background-color_160ms_var(--ease-out-emil),transform_140ms_var(--ease-out-emil)] max-[680px]:min-h-[3.8rem] fine-hover:bg-white active:[transform:scale(0.97)]';
  const icon =
    'grid size-8 place-items-center rounded-[0.45rem_0.65rem_0.45rem_0.45rem] bg-sky-50 text-cobalt-700';
  const label = 'grid min-w-0 [&>strong]:text-[0.79rem]';
  const detail = 'mt-[0.14rem] text-[0.66rem] leading-[1.3] text-ink-600';
</script>

<section
  class={[
    'min-w-0 border-t border-[color-mix(in_srgb,var(--color-ink-950)_16%,transparent)] pt-[0.8rem]',
    className,
  ]}
  aria-labelledby="detours-title"
>
  <header
    class="flex items-baseline justify-between gap-4 max-[680px]:grid max-[680px]:gap-[0.15rem]"
  >
    <h2 class="m-0 text-[0.92rem]" id="detours-title">{t($motherTongue, 'home.detours')}</h2>
    <span class="text-[0.7rem] text-ink-800">{t($motherTongue, 'home.detoursDescription')}</span>
  </header>

  <nav
    class="mt-[0.55rem] grid grid-cols-2 gap-2 max-[680px]:grid-cols-1"
    aria-label={t($motherTongue, 'home.detoursNavigation')}
  >
    {#if $appStore.settings?.gamificationEnabled && $appStore.settings.rivalryEnabled}
      <a class={link} href="/rival/">
        <span class={icon}><Swords size={18} aria-hidden="true" /></span>
        <span class={label}
          ><strong>{$motherTongue === 'cs' ? `Souboj: ${rivalName}` : `Duel: ${rivalName}`}</strong
          ><small class={detail}
            >{canResume && match
              ? $motherTongue === 'cs'
                ? `Pokračovat · kolo ${match.rounds.length} z 5`
                : `Continue · round ${match.rounds.length} of 5`
              : $motherTongue === 'cs'
                ? 'Pět otázek, vlastním tempem'
                : 'Five questions, at your own pace'}</small
          ></span
        >
      </a>
    {/if}
    <a class={link} href="/create/">
      <span class={icon}><Plus size={18} /></span>
      <span class={label}
        ><strong>{t($motherTongue, 'home.ownWords')}</strong><small class={detail}
          >{t($motherTongue, 'home.ownWordsDescription')}</small
        ></span
      >
    </a>
    <a class={link} href="/stories/">
      <span class={icon}><BookOpen size={18} /></span>
      <span class={label}
        ><strong>{t($motherTongue, 'home.reading')}</strong><small class={detail}
          >{t($motherTongue, 'home.readingDescription')}</small
        ></span
      >
    </a>
    <a class={link} href="/coach/">
      <span class={icon}><Bot size={18} /></span>
      <span class={label}
        ><strong>{t($motherTongue, 'home.aiLab')}</strong><small class={detail}
          >{t($motherTongue, 'home.aiLabDescription')}</small
        ></span
      >
    </a>
    <a class={link} href="/cases/">
      <span class={icon}><Search size={18} aria-hidden="true" /></span>
      <span class={label}
        ><strong
          >{$motherTongue === 'cs' ? 'Jazykové případy · Beta' : 'Language cases · Beta'}</strong
        ><small class={detail}
          >{$motherTongue === 'cs'
            ? 'Rozpleť příběh pomocí německých zpráv'
            : 'Untangle a story through German messages'}</small
        ></span
      >
    </a>
    <a class={link} href="/exam/">
      <span class={icon}><CalendarCheck size={18} /></span>
      <span class={label}
        ><strong>{$motherTongue === 'cs' ? 'Plán na písemku' : 'Test plan'}</strong><small
          class={detail}
          >{$motherTongue === 'cs'
            ? 'Co už umíš a co si zopakovat'
            : 'What you know and what to review'}</small
        ></span
      >
    </a>
  </nav>
</section>
