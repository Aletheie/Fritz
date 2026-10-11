<script lang="ts">
  import { goto } from '$app/navigation';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import CalibrationTest from '$lib/components/onboarding/CalibrationTest.svelte';
  import { errorText } from '$lib/domain/errors.ts';
  import type { CalibrationRecommendation } from '$lib/domain/onboarding/calibration.ts';
  import { onboardingLevels, parseOnboardingDraft } from '$lib/domain/onboarding/setup.ts';
  import { appStore, motherTongue, tr } from '$lib/state/app';
  import { loadCoursePath } from '$lib/state/course-path.ts';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import BookOpenCheck from '@lucide/svelte/icons/book-open-check';
  import Brain from '@lucide/svelte/icons/brain';
  import Check from '@lucide/svelte/icons/check';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import GraduationCap from '@lucide/svelte/icons/graduation-cap';
  import MessagesSquare from '@lucide/svelte/icons/messages-square';
  import Upload from '@lucide/svelte/icons/upload';
  import { onMount, tick } from 'svelte';

  import type {
    DailyMinutes,
    DetailedCefrLevel,
    LearningGoal,
    MotherTongue,
  } from '$lib/domain/types.ts';
  import type { Component } from 'svelte';

  const goals: Array<{
    id: LearningGoal;
    title: { cs: string; en: string };
    description: { cs: string; en: string };
    icon: Component;
  }> = [
    {
      id: 'school',
      title: { cs: 'Zvládnout školu a testy', en: 'Keep up with school and tests' },
      description: {
        cs: 'Denní plán upřednostní látku, kterou potřebuješ umět včas.',
        en: 'Your daily plan puts first what you need to know in time.',
      },
      icon: GraduationCap,
    },
    {
      id: 'memory',
      title: { cs: 'Pamatovat si slovíčka', en: 'Remember vocabulary' },
      description: {
        cs: 'Slovíčka si zopakuješ podle toho, jak dobře si je pamatuješ.',
        en: 'You review words based on how well you remember them.',
      },
      icon: Brain,
    },
    {
      id: 'conversation',
      title: { cs: 'Rozmluvit se', en: 'Start speaking' },
      description: {
        cs: 'Víc si procvičíš vlastní věty a rozhovory s AI.',
        en: 'You practise more of your own sentences and conversations with AI.',
      },
      icon: MessagesSquare,
    },
  ];
  const languages: Array<{ id: MotherTongue; label: string }> = [
    { id: 'cs', label: 'Čeština' },
    { id: 'en', label: 'English' },
  ];
  let changingLanguage = $state(false);

  async function changeLanguage(language: MotherTongue): Promise<void> {
    if (language === $motherTongue || changingLanguage) return;
    changingLanguage = true;
    errorMessage = '';
    try {
      await appStore.updateSettings({ motherTongue: language });
    } catch (error) {
      errorMessage = errorText(error, $motherTongue, {
        cs: 'Jazyk se nepodařilo změnit.',
        en: 'The language could not be changed.',
      });
    } finally {
      changingLanguage = false;
    }
  }

  const draftKey = 'fritz:onboarding:v1';
  const times: DailyMinutes[] = [5, 10, 20];
  let ready = $state(false);
  let loadingError = $state('');
  let saving = $state(false);
  let errorMessage = $state('');
  let step = $state(1);
  let goal = $state<LearningGoal>('school');
  let level = $state<DetailedCefrLevel>('A1.1');
  let minutes = $state<DailyMinutes>(10);
  let calibrating = $state(false);
  let calibrated = $state(false);
  let calibrationSummary = $state<CalibrationRecommendation | undefined>();
  let heading = $state<HTMLHeadingElement | undefined>();
  let firstTopic = $state<{ title: string; outcome: string; example: string }>();
  const selectedLevel = $derived(onboardingLevels.find((option) => option.level === level)!);

  onMount(() => {
    void initialize();
  });

  async function initialize(): Promise<void> {
    loadingError = '';
    try {
      await appStore.initialize();
      const currentSettings = $appStore.settings;
      if (currentSettings?.onboardingCompleted) {
        await goto('/', { replaceState: true });
        return;
      }
      if (currentSettings) {
        goal = currentSettings.learningGoal;
        level = currentSettings.grammarLevel;
        minutes = currentSettings.dailyMinutes;
      }
      try {
        const draft = parseOnboardingDraft(JSON.parse(sessionStorage.getItem(draftKey) ?? 'null'));
        if (draft) ({ step, goal, level, minutes } = draft);
      } catch {
        /* Setup remains usable if browser storage is unavailable. */
      }
      ready = true;
      if (step === 3) void loadFirstTopic();
    } catch (error) {
      loadingError = errorText(error, $motherTongue, {
        cs: 'Nastavení se nepodařilo načíst.',
        en: 'Settings could not be loaded.',
      });
    }
  }

  $effect(() => {
    const draft = { step, goal, level, minutes };
    if (!ready || saving) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      /* Best effort. */
    }
  });

  async function loadFirstTopic(): Promise<void> {
    firstTopic = undefined;
    const requestedLevel = level;
    try {
      const path = await loadCoursePath($appStore.course, requestedLevel, $motherTongue);
      const chapter = path.chapters[0]?.chapter;
      if (chapter && level === requestedLevel) {
        firstTopic = {
          title: chapter.title,
          outcome: chapter.outcomes[0] ?? chapter.mission,
          example: chapter.modelSentences[0]?.de ?? '',
        };
      }
    } catch {
      // The lesson can load the catalog again; a preview must never block setup.
    }
  }

  async function moveTo(nextStep: number): Promise<void> {
    step = nextStep;
    if (nextStep === 3) void loadFirstTopic();
    await tick();
    heading?.focus();
  }

  function startCalibration(): void {
    calibrating = true;
    calibrated = false;
    calibrationSummary = undefined;
  }

  function completeCalibration(recommendation: CalibrationRecommendation): void {
    level = recommendation.level;
    calibrationSummary = recommendation;
    calibrating = false;
    calibrated = true;
    void tick().then(() => heading?.focus());
  }

  function cancelCalibration(): void {
    calibrating = false;
    void tick().then(() => heading?.focus());
  }

  function goalTitle(value: LearningGoal): string {
    return (goals.find((option) => option.id === value) ?? goals[0]).title[$motherTongue];
  }

  async function finish(destination: 'study' | 'import'): Promise<void> {
    if (saving) return;
    saving = true;
    errorMessage = '';
    try {
      await appStore.updateSettings({
        onboardingCompleted: true,
        learningGoal: goal,
        grammarLevel: level,
        dailyMinutes: minutes,
        dailyGoal: minutes,
      });
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        /* Best effort. */
      }
      await goto(destination === 'study' ? '/today/' : '/import/', { replaceState: true });
    } catch (error) {
      errorMessage = errorText(error, $motherTongue, {
        cs: 'Nastavení se nepodařilo uložit.',
        en: 'Settings could not be saved.',
      });
      saving = false;
    }
  }

  const radio = 'absolute size-px opacity-0';
  const heading1 =
    'mt-[0.55rem] max-w-xl text-[clamp(1.8rem,6vw,3.15rem)] leading-[0.98] font-black tracking-[-0.04em] text-balance focus-visible:outline-3 focus-visible:outline-offset-[0.3rem] focus-visible:outline-cobalt-700';
  const intro = 'mt-[0.8rem] max-w-[35rem] leading-[1.55] text-ink-600';
  const meta = 'text-[0.8rem] font-[780] text-cobalt-700';
  const page =
    'grid min-h-dvh place-items-center px-4 pt-[max(1rem,var(--safe-top))] pb-[max(1.25rem,var(--safe-bottom))] max-[601px]:content-start';
  const card = 'surface w-[min(100%,46rem)] p-[clamp(1.2rem,4vw,2.4rem)]';
  const errorClass = 'mt-4 font-[750] text-coral-700';
</script>

<svelte:head>
  <title>{$tr('Začínáme', 'Getting started')} · Fritz</title>
  <meta
    name="description"
    content={$tr(
      'Krátké nastavení aplikace Fritz podle cíle, úrovně němčiny a času na učení.',
      'A short Fritz setup based on your goal, German level and study time.',
    )}
  />
</svelte:head>

{#if loadingError}
  <main class={page}>
    <section class={card}>
      <h1 class={heading1}>
        {$tr('Nastavení se nepodařilo načíst', 'Settings could not be loaded')}
      </h1>
      <p class={errorClass} role="alert">{loadingError}</p>
      <button
        class="btn-base btn-primary mt-[1.2rem] w-full"
        type="button"
        onclick={() => void initialize()}>{$tr('Zkusit znovu', 'Try again')}</button
      >
    </section>
  </main>
{:else if !ready}
  <LoadingState label={$tr('Připravuji tvůj učební plán…', 'Preparing your study plan…')} />
{:else}
  <main class={page}>
    <header
      class="mb-4 grid w-[min(100%,46rem)] grid-cols-[1fr_auto_1fr] items-start gap-4 max-[601px]:grid-cols-[1fr_auto]"
    >
      <span
        class="w-fit text-[1.35rem] font-black tracking-[-0.04em] text-ink-950 no-underline"
        aria-label="Fritz">Fritz<span class="text-cobalt-700">.</span></span
      >
      <ol
        class="m-0 flex list-none gap-2 p-0 max-[601px]:col-[1/3] max-[601px]:row-start-2 max-[601px]:justify-center"
        aria-label={$tr('Průběh nastavení', 'Setup progress')}
      >
        {#each [1, 2, 3] as item}
          <li
            class={[
              'grid size-8 place-items-center rounded-full border font-mono text-[0.7rem] font-[850]',
              item === step
                ? 'border-ink-950 bg-acid-500 text-ink-950'
                : item < step
                  ? 'border-mint-700 bg-mint-700 text-white'
                  : 'border-line bg-paper-50 text-ink-600',
            ]}
            aria-current={item === step ? 'step' : undefined}
          >
            {#if item < step}<Check size={15} aria-hidden="true" />{:else}{item}{/if}
          </li>
        {/each}
      </ol>
      <div class="flex items-center gap-[0.65rem] justify-self-end">
        <span class="font-mono text-[0.67rem] font-[750] text-ink-600 uppercase max-[601px]:hidden"
          >{$tr(`krok ${step} ze 3`, `step ${step} of 3`)}</span
        >
        <button
          class="min-h-11 text-[0.78rem] font-extrabold text-cobalt-700 underline underline-offset-[0.2rem]"
          type="button"
          disabled={saving}
          onclick={() => void finish('study')}>{$tr('Přeskočit', 'Skip')}</button
        >
      </div>
    </header>

    <section class={card} aria-labelledby="onboarding-title">
      {#if step === 1}
        <div class="max-w-[38rem]">
          <div
            class="mb-4 inline-flex gap-1 rounded-full border border-line bg-paper-50 p-1"
            role="group"
            aria-label={$tr('Jazyk rozhraní', 'Interface language')}
          >
            {#each languages as language (language.id)}
              <button
                class={[
                  'min-h-9 rounded-full px-3 text-[0.78rem] font-extrabold',
                  $motherTongue === language.id ? 'bg-ink-950 text-white' : 'text-ink-600',
                ]}
                type="button"
                lang={language.id}
                aria-pressed={$motherTongue === language.id}
                disabled={changingLanguage}
                onclick={() => void changeLanguage(language.id)}>{language.label}</button
              >
            {/each}
          </div>
          <p class={meta}>
            {$tr('První plán za méně než dvě minuty', 'Your first plan in under two minutes')}
          </p>
          <h1 class={heading1} id="onboarding-title" bind:this={heading} tabindex="-1">
            {$tr('Co chceš s němčinou zvládnout?', 'What do you want to achieve in German?')}
          </h1>
          <p class={intro}>
            {$tr(
              'Podle tvého cíle připravíme první lekci. Nastavení můžeš později změnit. Výsledky učení se ukládají v tomto zařízení.',
              'We prepare your first lesson around your goal. You can change this later. Your progress is stored on this device.',
            )}
          </p>
        </div>
        <fieldset class="m-0 mt-6 grid gap-[0.7rem] border-0 p-0">
          <legend class="sr-only">{$tr('Studijní cíl', 'Learning goal')}</legend>
          {#each goals as option (option.id)}
            {@const Icon = option.icon}
            {@const selected = goal === option.id}
            <label
              class={[
                'relative grid min-h-20 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-[0.85rem] gap-y-1 rounded-[0.35rem_1rem_0.35rem_0.35rem] border p-[0.85rem] focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-cobalt-700',
                selected
                  ? 'border-ink-950 bg-accent-100 shadow-[3px_3px_0_var(--color-ink-950)]'
                  : 'border-line bg-white',
              ]}
            >
              <input class={radio} type="radio" name="goal" value={option.id} bind:group={goal} />
              <span
                class="row-[1/3] grid size-11 place-items-center rounded-full border border-ink-950 bg-paper-50"
                ><Icon size={22} aria-hidden="true" /></span
              >
              <strong class="text-[0.96rem]">{option.title[$motherTongue]}</strong>
              <small
                class={['col-start-2 leading-[1.35]', selected ? 'text-ink-800' : 'text-ink-600']}
                >{option.description[$motherTongue]}</small
              >
              <span
                class={[
                  'grid size-[1.55rem] place-items-center rounded-full border',
                  selected
                    ? 'border-ink-950 bg-acid-500 text-ink-950'
                    : 'border-line bg-white text-transparent',
                ]}
                aria-hidden="true"><Check size={15} /></span
              >
            </label>
          {/each}
        </fieldset>
        <button
          class="btn-base btn-primary mt-[1.2rem] w-full"
          type="button"
          onclick={() => void moveTo(2)}
        >
          {$tr('Pokračovat', 'Continue')}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      {:else if step === 2}
        <div class="max-w-[38rem]">
          <p class={meta}>{$tr('Výchozí úroveň', 'Starting level')}</p>
          <h1 class={heading1} id="onboarding-title" bind:this={heading} tabindex="-1">
            {$tr('Odkud navážeme?', 'Where should we start?')}
          </h1>
          <p class={intro}>
            {$tr(
              'Vyber popis, který ti sedí. Nejde o zkoušku a začátek můžeš kdykoli změnit.',
              'Pick the description that fits you. It is not a test, and you can change it anytime.',
            )}
          </p>
        </div>

        {#if calibrating}
          <CalibrationTest oncomplete={completeCalibration} oncancel={cancelCalibration} />
        {:else}
          <fieldset class="m-0 mt-6 grid grid-cols-2 gap-[0.55rem] border-0 p-0">
            <legend class="sr-only">{$tr('Úroveň němčiny', 'German level')}</legend>
            {#each onboardingLevels as option (option.level)}
              <label
                class={[
                  'grid min-h-[3.4rem] cursor-pointer grid-cols-[auto_1fr] items-center gap-[0.7rem] rounded-[0.35rem] border p-[0.65rem] focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-cobalt-700',
                  level === option.level
                    ? 'border-ink-950 bg-acid-500 shadow-[2px_2px_0_var(--color-ink-950)]'
                    : 'border-line bg-white',
                ]}
              >
                <input
                  class={radio}
                  type="radio"
                  name="level"
                  value={option.level}
                  bind:group={level}
                  aria-label={option.level}
                  aria-describedby={`level-title-${option.level}`}
                />
                <strong>{option.level}</strong>
                <small
                  class="text-[0.8rem] leading-[1.25] text-ink-800"
                  id={`level-title-${option.level}`}
                  >{$motherTongue === 'en' ? option.titleEn : option.title}</small
                >
              </label>
            {/each}
          </fieldset>
          <div
            class="mt-[0.85rem] leading-normal"
            data-testid="level-description"
            aria-live="polite"
          >
            <p>
              {$motherTongue === 'en' ? selectedLevel.descriptionEn : selectedLevel.description}
            </p>
            <span class="mt-[0.3rem] block text-cobalt-700" lang="de">{selectedLevel.example}</span>
          </div>
          <button
            class="mt-[0.85rem] grid min-h-[4.6rem] w-full grid-cols-[auto_1fr_auto] items-center gap-[0.8rem] rounded-[0.35rem] border border-dashed border-ink-600 bg-paper-50 px-[0.9rem] py-3 text-left text-ink-950"
            type="button"
            onclick={startCalibration}
          >
            <BookOpenCheck size={19} aria-hidden="true" />
            <span class="grid gap-[0.15rem]"
              ><strong>{$tr('Nevím přesně', 'Not sure')}</strong><small class="text-ink-600"
                >{$tr('Spustit minutový test', 'Take a one-minute test')}</small
              ></span
            >
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          {#if calibrated}
            <p
              class="mt-[0.8rem] flex items-center gap-[0.45rem] text-[0.84rem] leading-[1.45] text-mint-700"
              role="status"
            >
              <Check class="mt-[0.1rem] flex-none" size={17} aria-hidden="true" />
              <span>
                {$tr('Test doporučuje úroveň', 'The test suggests level')}
                <strong>{calibrationSummary?.level}</strong>
                ({calibrationSummary?.correct ?? 0}
                {$tr('z 5', 'of 5')}). {$tr(
                  'Je to jen orientační začátek. Vybranou úroveň můžeš upravit výše.',
                  'It is only a rough starting point. You can adjust the level above.',
                )}
              </span>
            </p>
          {/if}
        {/if}

        <div class="mt-[1.2rem] grid grid-cols-[auto_1fr] gap-[0.7rem]">
          <button class="btn-base btn-secondary" type="button" onclick={() => void moveTo(1)}
            >{$tr('Zpět', 'Back')}</button
          >
          <button
            class="btn-base btn-primary"
            type="button"
            disabled={calibrating}
            onclick={() => void moveTo(3)}
          >
            {$tr('Pokračovat', 'Continue')}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      {:else}
        <div class="max-w-[38rem]">
          <p class={meta}>{$tr('Čas na učení', 'Study time')}</p>
          <h1 class={heading1} id="onboarding-title" bind:this={heading} tabindex="-1">
            {$tr('Kolik času máš běžně denně?', 'How much time do you usually have a day?')}
          </h1>
          <p class={intro}>
            {$tr(
              'Počet úloh se přizpůsobí času. Když budeš chtít, můžeš pokračovat dál.',
              'The number of activities fits your time. You can always keep going.',
            )}
          </p>
        </div>
        <fieldset
          class="m-0 mt-6 grid grid-cols-3 gap-[0.65rem] border-0 p-0 max-[601px]:gap-[0.4rem]"
        >
          <legend class="sr-only">{$tr('Denní čas na učení', 'Daily study time')}</legend>
          {#each times as option}
            <label
              class={[
                'grid min-h-28 cursor-pointer place-items-center content-center gap-[0.35rem] rounded-[0.35rem_1rem_0.35rem_0.35rem] border focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-cobalt-700 max-[601px]:min-h-24 max-[601px]:px-[0.2rem] max-[601px]:py-2',
                minutes === option
                  ? 'border-ink-950 bg-accent-100 shadow-[3px_3px_0_var(--color-ink-950)]'
                  : 'border-line bg-white',
              ]}
            >
              <input
                class={radio}
                type="radio"
                name="minutes"
                value={option}
                bind:group={minutes}
              />
              <Clock3 size={21} aria-hidden="true" />
              <strong class="text-[1.05rem] max-[601px]:text-[0.95rem]"
                >{option} {$tr('minut', 'minutes')}</strong
              >
              <small
                class="font-mono text-[0.62rem] text-ink-600 uppercase max-[601px]:font-sans max-[601px]:text-[0.66rem] max-[601px]:normal-case"
                >{option === 5
                  ? $tr('rychlé minimum', 'quick minimum')
                  : option === 10
                    ? $tr('doporučeno', 'recommended')
                    : $tr('delší procvičování', 'longer practice')}</small
              >
            </label>
          {/each}
        </fieldset>

        <div
          class="mt-4 grid gap-[0.2rem] border-t border-line pt-[0.85rem] [&>p]:text-[0.8rem] [&>p]:text-ink-600"
          data-testid="plan-preview"
          aria-live="polite"
        >
          <strong>{$tr('První plán', 'First plan')}</strong>
          <span class="font-extrabold text-cobalt-700"
            >{goalTitle(goal)} · {level} · {minutes} {$tr('minut', 'minutes')}</span
          >
          {#if firstTopic}
            <p>
              {$tr('V kurzu začneš tématem', 'Your course starts with')}
              <b>{firstTopic.title}</b>. {$tr('Cíl', 'Goal')}: {firstTopic.outcome}.
            </p>
            <span class="my-[0.35rem] font-[650] text-ink-950" lang="de">{firstTopic.example}</span>
          {/if}
          <p>
            {$tr(
              'V denní lekci spojíš slovíčka, krátké pravidlo a vlastní odpověď. Chyby si v klidu opravíš; hotové úlohy se ukládají průběžně.',
              'Each daily lesson combines words, a short rule and your own answer. You fix mistakes calmly, and finished activities are saved as you go.',
            )}
          </p>
        </div>

        <div class="mt-5 grid gap-[0.7rem]">
          <button
            class="btn-base btn-primary"
            type="button"
            disabled={saving}
            onclick={() => void finish('study')}
          >
            <Brain size={19} aria-hidden="true" />
            {saving
              ? $tr('Připravuji…', 'Preparing…')
              : $tr('Spustit první lekci', 'Start the first lesson')}
          </button>
          <button
            class="btn-base btn-secondary"
            type="button"
            disabled={saving}
            onclick={() => void finish('import')}
          >
            <Upload size={19} aria-hidden="true" />
            {$tr('Nahrát vlastní školní látku', 'Upload your own school material')}
          </button>
        </div>
        <button
          class="mx-auto mt-[0.6rem] block min-h-11 border-0 bg-transparent text-ink-600 underline underline-offset-[0.2rem]"
          type="button"
          disabled={saving}
          onclick={() => void moveTo(2)}>{$tr('Zpět k úrovni', 'Back to level')}</button
        >
      {/if}

      {#if errorMessage}<p class={errorClass} role="alert">{errorMessage}</p>{/if}
    </section>
  </main>
{/if}
