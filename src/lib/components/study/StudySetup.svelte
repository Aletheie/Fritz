<script lang="ts">
  import { motherTongue, tr } from '$lib/state/app';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import Target from '@lucide/svelte/icons/target';

  let {
    duration = $bindable(20),
    selectedTag = $bindable('all'),
    tags,
    cardCount,
    onstart,
  } = $props<{
    duration: number;
    selectedTag: string;
    tags: string[];
    cardCount: number;
    onstart: () => void;
  }>();

  const durations = [10, 20, 30, 45];

  const step =
    'flex gap-3 [&>span]:grid [&>span]:size-8 [&>span]:flex-none [&>span]:place-items-center [&>span]:rounded-[0.7rem] [&>span]:bg-butter-200 [&>span]:text-[0.75rem] [&>span]:font-extrabold [&>span]:text-ink-950 [&_p]:mt-[0.2rem] [&_p]:text-[0.76rem] [&_p]:leading-[1.45] [&_p]:text-ink-600 [&_strong]:text-[0.88rem]';
  const tag =
    'min-h-[2.65rem] rounded-[0.85rem] border px-[0.8rem] py-[0.55rem] text-[0.78rem] font-[730] [transition:transform_150ms_var(--ease-out-emil),border-color_160ms_var(--ease-out-emil),color_160ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil)] active:[transform:scale(0.97)]';
  const tagState = (active: boolean) =>
    active ? 'border-butter-400 bg-butter-50 text-ink-950' : 'border-line bg-paper-50 text-ink-600';
</script>

<section class="mx-auto max-w-4xl pt-1 sm:pt-8">
  <a
    class="inline-flex min-h-11 items-center gap-[0.45rem] rounded-xl px-[0.45rem] text-[0.82rem] font-[750] text-ink-600 fine-hover:bg-paper-200 fine-hover:text-ink-950"
    href="/study/"
    ><ArrowLeft size={18} /> {$tr('Zpět na dlouhodobé studium', 'Back to long-term study')}</a
  >

  <div class="surface mt-4 overflow-hidden">
    <div class="grid lg:grid-cols-[1.35fr_0.65fr]">
      <div class="p-5 sm:p-8 lg:p-10">
        <span class="grid h-13 w-13 place-items-center rounded-2xl bg-coral-50 text-coral-700"
          ><Target size={25} /></span
        >
        <p class="kicker mt-5">{$tr('Sprint na test', 'Test sprint')}</p>
        <h1
          class="mt-2 max-w-2xl text-[clamp(2rem,6vw,3.7rem)] leading-[0.98] font-extrabold tracking-[-0.055em] text-balance"
        >
          {$tr('Co potřebuješ dostat do hlavy teď?', 'What do you need to learn right now?')}
        </h1>
        <p class="mt-4 max-w-xl leading-relaxed text-ink-600">
          {$tr(
            'Slova, která ti dělají potíže, si zopakuješ za pár minut. Běžné termíny opakování se ve sprintu nemění.',
            'Words you find difficult return after a few minutes. Your regular review dates stay the same during a sprint.',
          )}
        </p>

        <fieldset class="mt-8">
          <legend class="text-sm font-extrabold">{$tr('Délka sprintu', 'Sprint length')}</legend>
          <div
            class="mt-3 grid grid-cols-4 gap-2"
            aria-label={$tr('Délka sprintu', 'Sprint length')}
          >
            {#each durations as minutes}
              <button
                class={[
                  'flex min-h-[4.2rem] flex-col items-center justify-center rounded-2xl border [transition:transform_150ms_var(--ease-out-emil),border-color_160ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil)] active:[transform:scale(0.97)]',
                  duration === minutes
                    ? 'border-ink-950 bg-ink-950 text-white'
                    : 'border-line bg-paper-50',
                ]}
                type="button"
                aria-pressed={duration === minutes}
                onclick={() => (duration = minutes)}
                ><strong class="text-[1.15rem] leading-none">{minutes}</strong><span
                  class={[
                    'mt-[0.2rem] text-[0.7rem] font-bold',
                    duration === minutes ? 'text-white/70' : 'text-ink-600',
                  ]}>min</span
                ></button
              >
            {/each}
          </div>
        </fieldset>

        <fieldset class="mt-7">
          <legend class="text-sm font-extrabold">{$tr('Která slovíčka', 'Which words')}</legend>
          <div class="mt-3 flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-1">
            <button
              class={[tag, tagState(selectedTag === 'all')]}
              type="button"
              aria-pressed={selectedTag === 'all'}
              onclick={() => (selectedTag = 'all')}>{$tr('Všechna', 'All')}</button
            >
            {#each tags as tagName}
              <button
                class={[tag, tagState(selectedTag === tagName)]}
                type="button"
                aria-pressed={selectedTag === tagName}
                onclick={() => (selectedTag = tagName)}>{tagName}</button
              >
            {/each}
          </div>
        </fieldset>

        <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            class="btn-base btn-primary"
            type="button"
            disabled={cardCount === 0}
            onclick={onstart}
          >
            {$tr('Začít sprint', 'Start sprint')}
            <ArrowRight size={18} />
          </button>
          <p class="text-sm font-semibold text-ink-600">
            {Math.min(60, cardCount)}
            {$motherTongue === 'en'
              ? cardCount === 1
                ? 'card'
                : 'cards'
              : cardCount === 1
                ? 'karta'
                : cardCount < 5
                  ? 'karty'
                  : 'karet'}{cardCount > 60 ? $tr(' z prvních 60', ' from the first 60') : ''}
          </p>
        </div>
      </div>

      <aside class="border-t border-line bg-butter-50 p-6 lg:border-t-0 lg:border-l lg:p-8">
        <p class="kicker">{$tr('Jak sprint pozná hotovo', 'How the sprint knows you are done')}</p>
        <ol class="mt-5 space-y-5">
          <li class={step}>
            <span>1</span>
            <div>
              <strong>{$tr('Nejdřív pokrytí', 'Coverage first')}</strong>
              <p>
                {$tr(
                  'Nová a dosud neviděná slova mají přednost.',
                  'New and unseen words take priority.',
                )}
              </p>
            </div>
          </li>
          <li class={step}>
            <span>2</span>
            <div>
              <strong>{$tr('Chyby se vracejí', 'Mistakes return')}</strong>
              <p>
                {$tr(
                  'Ne hned po sobě, ale dost brzo na opravu.',
                  'Not immediately, but soon enough to correct them.',
                )}
              </p>
            </div>
          </li>
          <li class={step}>
            <span>3</span>
            <div>
              <strong>{$tr('Dvě jisté odpovědi', 'Two confident answers')}</strong>
              <p>
                {$tr(
                  'Karta je pro sprint hotová po dvou úspěších v řadě.',
                  'A card is complete for the sprint after two successes in a row.',
                )}
              </p>
            </div>
          </li>
        </ol>
      </aside>
    </div>
  </div>
</section>
