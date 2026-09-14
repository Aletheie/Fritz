<script lang="ts">
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
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

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }
</script>

<section class="mx-auto max-w-4xl pt-1 sm:pt-8">
  <a class="back-link" href="/study/"
    ><ArrowLeft size={18} /> {copy('Zpět na dlouhodobé studium', 'Back to long-term study')}</a
  >

  <div class="surface mt-4 overflow-hidden">
    <div class="grid lg:grid-cols-[1.35fr_0.65fr]">
      <div class="p-5 sm:p-8 lg:p-10">
        <span class="grid h-13 w-13 place-items-center rounded-2xl bg-coral-50 text-coral-700"
          ><Target size={25} /></span
        >
        <p class="kicker mt-5">{copy('Sprint na test', 'Test sprint')}</p>
        <h1
          class="mt-2 max-w-2xl text-[clamp(2rem,6vw,3.7rem)] leading-[0.98] font-extrabold tracking-[-0.055em] text-balance"
        >
          {copy('Co potřebuješ dostat do hlavy teď?', 'What do you need to learn right now?')}
        </h1>
        <p class="mt-4 max-w-xl leading-relaxed text-ink-600">
          {copy(
            'Slova, která ti dělají potíže, si zopakuješ za pár minut. Běžné termíny opakování se ve sprintu nemění.',
            'Words you find difficult return after a few minutes. Your regular review dates stay the same during a sprint.',
          )}
        </p>

        <fieldset class="mt-8">
          <legend class="text-sm font-extrabold">{copy('Délka sprintu', 'Sprint length')}</legend>
          <div
            class="mt-3 grid grid-cols-4 gap-2"
            aria-label={copy('Délka sprintu', 'Sprint length')}
          >
            {#each durations as minutes}
              <button
                class:active={duration === minutes}
                class="duration"
                type="button"
                aria-pressed={duration === minutes}
                onclick={() => (duration = minutes)}
                ><strong>{minutes}</strong><span>min</span></button
              >
            {/each}
          </div>
        </fieldset>

        <fieldset class="mt-7">
          <legend class="text-sm font-extrabold">{copy('Která slovíčka', 'Which words')}</legend>
          <div class="mt-3 flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-1">
            <button
              class:active={selectedTag === 'all'}
              class="tag"
              type="button"
              aria-pressed={selectedTag === 'all'}
              onclick={() => (selectedTag = 'all')}>{copy('Všechna', 'All')}</button
            >
            {#each tags as tag}
              <button
                class:active={selectedTag === tag}
                class="tag"
                type="button"
                aria-pressed={selectedTag === tag}
                onclick={() => (selectedTag = tag)}>{tag}</button
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
            {copy('Začít sprint', 'Start sprint')}
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
                  : 'karet'}{cardCount > 60 ? copy(' z prvních 60', ' from the first 60') : ''}
          </p>
        </div>
      </div>

      <aside class="principles">
        <p class="kicker">{copy('Jak sprint pozná hotovo', 'How the sprint knows you are done')}</p>
        <ol class="mt-5 space-y-5">
          <li>
            <span>1</span>
            <div>
              <strong>{copy('Nejdřív pokrytí', 'Coverage first')}</strong>
              <p>
                {copy(
                  'Nová a dosud neviděná slova mají přednost.',
                  'New and unseen words take priority.',
                )}
              </p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>{copy('Chyby se vracejí', 'Mistakes return')}</strong>
              <p>
                {copy(
                  'Ne hned po sobě, ale dost brzo na opravu.',
                  'Not immediately, but soon enough to correct them.',
                )}
              </p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>{copy('Dvě jisté odpovědi', 'Two confident answers')}</strong>
              <p>
                {copy(
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

<style>
  .back-link {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    gap: 0.45rem;
    border-radius: 0.75rem;
    color: var(--color-ink-600);
    padding: 0 0.45rem;
    font-size: 0.82rem;
    font-weight: 750;
  }
  @media (hover: hover) and (pointer: fine) {
    .back-link:hover {
      color: var(--color-ink-950);
      background: var(--color-paper-200);
    }
  }
  .duration {
    display: flex;
    min-height: 4.2rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--color-line);
    border-radius: 1rem;
    background: var(--color-paper-50);
    transition:
      transform 150ms var(--ease-out-emil),
      border-color 160ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil);
  }
  .duration:active,
  .tag:active {
    transform: scale(0.97);
  }
  .duration strong {
    font-size: 1.15rem;
    line-height: 1;
  }
  .duration span {
    margin-top: 0.2rem;
    color: var(--color-ink-600);
    font-size: 0.7rem;
    font-weight: 700;
  }
  .duration.active {
    border-color: var(--color-ink-950);
    color: white;
    background: var(--color-ink-950);
  }
  .duration.active span {
    color: rgb(255 255 255 / 0.7);
  }
  .tag {
    min-height: 2.65rem;
    border: 1px solid var(--color-line);
    border-radius: 0.85rem;
    color: var(--color-ink-600);
    background: var(--color-paper-50);
    padding: 0.55rem 0.8rem;
    font-size: 0.78rem;
    font-weight: 730;
    transition:
      transform 150ms var(--ease-out-emil),
      border-color 160ms var(--ease-out-emil),
      color 160ms var(--ease-out-emil),
      background-color 160ms var(--ease-out-emil);
  }
  .tag.active {
    border-color: var(--color-butter-400);
    color: var(--color-ink-950);
    background: var(--color-butter-50);
  }
  .principles {
    border-top: 1px solid var(--color-line);
    background: var(--color-butter-50);
    padding: 1.5rem;
  }
  .principles li {
    display: flex;
    gap: 0.75rem;
  }
  .principles li > span {
    display: grid;
    width: 2rem;
    height: 2rem;
    flex: none;
    place-items: center;
    border-radius: 0.7rem;
    color: var(--color-ink-950);
    background: var(--color-butter-200);
    font-size: 0.75rem;
    font-weight: 800;
  }
  .principles strong {
    font-size: 0.88rem;
  }
  .principles p {
    margin-top: 0.2rem;
    color: var(--color-ink-600);
    font-size: 0.76rem;
    line-height: 1.45;
  }
  @media (min-width: 1024px) {
    .principles {
      border-top: 0;
      border-left: 1px solid var(--color-line);
      padding: 2rem;
    }
  }
</style>
