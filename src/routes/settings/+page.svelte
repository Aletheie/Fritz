<script lang="ts">
  import LoadingState from '$lib/components/LoadingState.svelte';
  import PageHeading from '$lib/components/PageHeading.svelte';
  import AccentThemePicker from '$lib/components/settings/AccentThemePicker.svelte';
  import AccessSettingsCard from '$lib/components/settings/AccessSettingsCard.svelte';
  import AiSettingsCard from '$lib/components/settings/AiSettingsCard.svelte';
  import BetaDiagnosticsCard from '$lib/components/settings/BetaDiagnosticsCard.svelte';
  import DataBackupCard from '$lib/components/settings/DataBackupCard.svelte';
  import ExerciseMixPicker from '$lib/components/settings/ExerciseMixPicker.svelte';
  import InstallAppCard from '$lib/components/settings/InstallAppCard.svelte';
  import OfflineAudioCard from '$lib/components/settings/OfflineAudioCard.svelte';
  import PlannerAdvancedControls from '$lib/components/settings/PlannerAdvancedControls.svelte';
  import ReminderCard from '$lib/components/settings/ReminderCard.svelte';
  import SettingsSheet from '$lib/components/settings/SettingsSheet.svelte';
  import ToggleRow from '$lib/components/ToggleRow.svelte';
  import { errorText } from '$lib/domain/errors.ts';
  import { DETAILED_CEFR_LEVELS, isDetailedCefrLevel } from '$lib/domain/levels.ts';
  import { DEFAULT_EXERCISE_PREFERENCES } from '$lib/domain/settings/defaults.ts';
  import { enabledExerciseCount, hasUniversalExercise } from '$lib/domain/settings/validation.ts';
  import { t } from '$lib/i18n';
  import { appStore } from '$lib/state/app';
  import Brain from '@lucide/svelte/icons/brain';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import Eye from '@lucide/svelte/icons/eye';
  import Keyboard from '@lucide/svelte/icons/keyboard';
  import Languages from '@lucide/svelte/icons/languages';
  import MessagesSquare from '@lucide/svelte/icons/messages-square';
  import Save from '@lucide/svelte/icons/save';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Target from '@lucide/svelte/icons/target';
  import { onDestroy, onMount } from 'svelte';

  import type {
    AccentTheme,
    DailyMinutes,
    DetailedCefrLevel,
    ExercisePreferences,
    LearningGoal,
    MotherTongue,
    StudyPace,
  } from '$lib/domain/types.ts';

  const dailyMinuteOptions: DailyMinutes[] = [5, 10, 20];
  const learningGoalOptions: Array<{
    value: LearningGoal;
    title: [string, string];
    description: [string, string];
  }> = [
    {
      value: 'school',
      title: ['Škola a testy', 'School and tests'],
      description: ['Nejdřív gramatika a látka s termínem.', 'Grammar and dated material first.'],
    },
    {
      value: 'memory',
      title: ['Pamatovat si slovíčka', 'Remember vocabulary'],
      description: ['Nejdřív slovíčka, která je čas zopakovat.', 'Due long-term review first.'],
    },
    {
      value: 'conversation',
      title: ['Rozmluvit se', 'Start speaking'],
      description: ['Nejdřív aktivní použití a konverzace.', 'Active use and conversation first.'],
    },
  ];

  let hydrated = $state(false);
  let saving = $state(false);
  let saved = $state(false);
  let motherTongue: MotherTongue = $state('cs');
  let profileName = $state('');
  let grammarLevel: DetailedCefrLevel = $state('A1.1');
  let learningGoal: LearningGoal = $state('school');
  let desiredRetention = $state(90);
  let dailyNewLimit = $state(15);
  let dailyMinutes: DailyMinutes = $state(10);
  let accentTheme: AccentTheme = $state('green');
  let exercisePreferences: ExercisePreferences = $state.raw({ ...DEFAULT_EXERCISE_PREFERENCES });
  let studyPace: StudyPace = $state('guided');
  let allowKeyboardFallback = $state(true);
  let autoSpeakGerman = $state(false);
  let requireCorrection = $state(true);
  let showKeyboardHints = $state(true);
  let showStudyTips = $state(true);
  let reduceMotion = $state(false);
  let gamificationEnabled = $state(true);
  let rivalryEnabled = $state(true);
  let celebrations = $state(true);

  let saveMessage = $state('');
  let saveError = $state(false);
  let backupCard: DataBackupCard | undefined = $state();

  function validateSettingsForm(
    currentProfileName = profileName,
    currentDesiredRetention = desiredRetention,
    currentDailyNewLimit = dailyNewLimit,
    currentPreferences = exercisePreferences,
    currentGrammarLevel = grammarLevel,
  ): string {
    if (currentProfileName.trim().length > 50)
      return copy('Jméno může mít nejvýše 50 znaků.', 'Your name can be at most 50 characters.');
    if (
      !Number.isInteger(currentDesiredRetention) ||
      currentDesiredRetention < 80 ||
      currentDesiredRetention > 95
    ) {
      return copy(
        'Cílová retence musí být celé procento od 80 do 95.',
        'Target retention must be a whole percentage from 80 to 95.',
      );
    }
    if (
      !Number.isInteger(currentDailyNewLimit) ||
      currentDailyNewLimit < 0 ||
      currentDailyNewLimit > 30
    ) {
      return copy(
        'Počet nových slovíček musí být celé číslo od 0 do 30.',
        'The number of new words must be a whole number from 0 to 30.',
      );
    }
    if (enabledExerciseCount(currentPreferences) === 0)
      return copy('Zapni alespoň jeden typ procvičování.', 'Enable at least one activity type.');
    if (!hasUniversalExercise(currentPreferences)) {
      return copy(
        'Nech zapnuté alespoň psaní, mluvení, kartičku nebo doplňovačku. Ostatní režimy nemusí být dostupné u každého slova.',
        'Keep typing, speaking, flashcards, or fill-in enabled. Other modes may not be available for every word.',
      );
    }
    if (!isDetailedCefrLevel(currentGrammarLevel))
      return copy('Vyber platnou úroveň gramatiky.', 'Choose a valid grammar level.');
    return '';
  }

  onMount(() => {
    void appStore.initialize();
  });

  onDestroy(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.accent = $appStore.settings?.accentTheme ?? 'green';
  });

  function previewAccentTheme(theme: AccentTheme): void {
    accentTheme = theme;
    document.documentElement.dataset.accent = theme;
    saveMessage = '';
    saveError = false;
  }

  function setExercise(key: keyof ExercisePreferences): void {
    const next = { ...exercisePreferences, [key]: !exercisePreferences[key] };
    if (enabledExerciseCount(next) === 0) {
      saveError = true;
      saveMessage = copy(
        'Poslední aktivní typ úlohy nejde vypnout.',
        'The last active activity type cannot be disabled.',
      );
      return;
    }
    if (!hasUniversalExercise(next)) {
      saveError = true;
      saveMessage = copy(
        'Nech zapnuté alespoň psaní, mluvení, kartičku nebo doplňovačku. Tyto úlohy fungují u všech slov.',
        'Keep at least one of typing, speaking, flashcards, or fill-in enabled. These work for every word.',
      );
      return;
    }
    exercisePreferences = next;
    saveMessage = '';
    saveError = false;
  }

  function applyLearningPreset(preset: 'balanced' | 'typing' | 'context'): void {
    if (preset === 'typing') {
      exercisePreferences = {
        typing: true,
        choice: false,
        flashcard: false,
        wordOrder: false,
        cloze: false,
        sentence: false,
        matching: false,
        speaking: false,
      };
    } else if (preset === 'context') {
      exercisePreferences = {
        typing: true,
        choice: false,
        flashcard: false,
        wordOrder: true,
        cloze: true,
        sentence: true,
        matching: true,
        speaking: true,
      };
    } else {
      exercisePreferences = { ...DEFAULT_EXERCISE_PREFERENCES };
    }
    saveMessage = '';
    saveError = false;
  }

  function applyFocusPreset(): void {
    reduceMotion = true;
    showStudyTips = false;
    requireCorrection = false;
    celebrations = false;
    saveMessage = copy(
      'Rychlé soustředění je připravené. Ještě změny ulož.',
      'Focus mode is ready. Save the changes to keep it.',
    );
    saveError = false;
  }

  async function save(): Promise<void> {
    if (!$appStore.settings) return;
    const validationMessage = validateSettingsForm();
    if (validationMessage) {
      saveError = true;
      saveMessage = validationMessage;
      return;
    }
    saving = true;
    saved = false;
    saveMessage = '';
    saveError = false;
    try {
      await appStore.updateSettings({
        motherTongue,
        profileName: profileName.trim().slice(0, 50),
        grammarLevel,
        learningGoal,
        accentTheme,
        desiredRetention: desiredRetention / 100,
        dailyNewLimit,
        dailyMinutes,
        dailyGoal: dailyMinutes,
        exercisePreferences: { ...exercisePreferences },
        studyPace,
        allowKeyboardFallback,
        autoSpeakGerman,
        requireCorrection,
        showKeyboardHints,
        showStudyTips,
        reduceMotion,
        gamificationEnabled,
        rivalryEnabled,
        celebrations,
      });
      document.documentElement.dataset.motion = reduceMotion ? 'reduced' : 'full';
      document.documentElement.dataset.accent = accentTheme;
      document.documentElement.lang = motherTongue === 'en' ? 'en' : 'cs';
      saved = true;
      saveMessage = copy('Nastavení je uložené.', 'Settings saved.');
      window.setTimeout(() => (saved = false), 2_400);
    } catch (error) {
      saveError = true;
      saveMessage = errorText(error, motherTongue, {
        cs: 'Nastavení se nepodařilo uložit.',
        en: 'Settings could not be saved.',
      });
    } finally {
      saving = false;
    }
  }

  const presetButton =
    'grid min-h-[3.8rem] grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.65rem] rounded-[0.2rem] border border-line bg-white p-[0.7rem] text-left [transition:transform_120ms_var(--ease-out-emil),border-color_140ms_ease,box-shadow_120ms_var(--ease-out-emil)] active:[transform:scale(0.97)] fine-hover:border-ink-950 [&>svg]:text-cobalt-700';
  const monoLabel = 'font-mono text-[0.65rem] font-[780] tracking-[0.05em] text-ink-800 uppercase';
  const choiceFieldset = 'rounded-[0.2rem] border border-line bg-white p-[0.9rem]';
  const choiceHelp = 'mt-[0.35rem] text-[0.69rem] leading-[1.45] text-ink-600';
  const choice = (selected: boolean) => [
    'cursor-pointer rounded-[0.3rem] border focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-cobalt-700 [&>input]:absolute [&>input]:size-px [&>input]:opacity-0',
    selected
      ? 'border-ink-950 bg-accent-100 shadow-[2px_2px_0_var(--color-ink-950)]'
      : 'border-line',
  ];
  const toggleGrid = 'mt-4 grid gap-[0.55rem] min-[640px]:grid-cols-2';
  $effect.pre(() => {
    if ($appStore.settings && !hydrated) {
      motherTongue = $appStore.settings.motherTongue;
      profileName = $appStore.settings.profileName;
      grammarLevel = $appStore.settings.grammarLevel;
      learningGoal = $appStore.settings.learningGoal;
      desiredRetention = Math.round($appStore.settings.desiredRetention * 100);
      dailyNewLimit = $appStore.settings.dailyNewLimit;
      dailyMinutes = $appStore.settings.dailyMinutes;
      accentTheme = $appStore.settings.accentTheme;
      exercisePreferences = { ...$appStore.settings.exercisePreferences };
      studyPace = $appStore.settings.studyPace;
      allowKeyboardFallback = $appStore.settings.allowKeyboardFallback;
      autoSpeakGerman = $appStore.settings.autoSpeakGerman;
      requireCorrection = $appStore.settings.requireCorrection;
      showKeyboardHints = $appStore.settings.showKeyboardHints;
      showStudyTips = $appStore.settings.showStudyTips;
      reduceMotion = $appStore.settings.reduceMotion;
      gamificationEnabled = $appStore.settings.gamificationEnabled;
      rivalryEnabled = $appStore.settings.rivalryEnabled;
      celebrations = $appStore.settings.celebrations;
      hydrated = true;
    }
  });
  const enabledCount = $derived(enabledExerciseCount(exercisePreferences));
  const settingsFormError = $derived(
    validateSettingsForm(
      profileName,
      desiredRetention,
      dailyNewLimit,
      exercisePreferences,
      grammarLevel,
    ),
  );
  const copy = $derived((cs: string, en: string): string => (motherTongue === 'en' ? en : cs));
</script>

<svelte:head>
  <title>{copy('Nastavení', 'Settings')} – Fritz</title>
</svelte:head>

{#if !$appStore.ready || !$appStore.settings}
  <LoadingState label={copy('Načítám nastavení…', 'Loading settings…')} />
{:else}
  <div class="grid gap-6" data-testid="settings-page">
    <PageHeading
      eyebrow={copy('Nastavení aplikace', 'App settings')}
      title={copy('Vyber si, jak se chceš učit', 'Choose how you want to practise')}
      description={copy(
        'Vyber si typy úloh, které ti vyhovují. Fritz je bude střídat podle toho, co potřebuješ procvičit.',
        'Choose the activities you prefer. Fritz will vary them based on what you need to practise.',
      )}
    />

    <form
      class="grid gap-4"
      onsubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <SettingsSheet
        icon={Languages}
        kicker="CS / EN → DE"
        title={t(motherTongue, 'settings.motherTongue')}
        titleId="mother-tongue-title"
        description={t(motherTongue, 'settings.motherTongueDescription')}
        descriptionId="mother-tongue-help"
        large
      >
        {#snippet aside()}
          <span
            class="inline-flex min-h-10 w-fit flex-none items-center gap-[0.4rem] border border-ink-950 bg-acid-100 px-[0.65rem] py-2 font-mono text-[0.66rem] font-extrabold"
            ><Languages size={16} /> {t(motherTongue, 'settings.targetGerman')}</span
          >
        {/snippet}
        <fieldset
          class="mx-0 mt-4 mb-0 grid grid-cols-2 gap-[0.65rem] border-0 p-0 max-[601px]:grid-cols-1"
          aria-describedby="mother-tongue-help"
        >
          <legend class="sr-only">{t(motherTongue, 'settings.motherTongue')}</legend>
          {#each [{ value: 'cs' as const, label: t(motherTongue, 'settings.czech'), code: 'CS' }, { value: 'en' as const, label: t(motherTongue, 'settings.english'), code: 'EN' }] as option}
            {@const active = motherTongue === option.value}
            <label
              class={[
                'grid min-h-16 cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-[0.65rem] border p-[0.7rem] [transition:transform_120ms_var(--ease-out-emil),border-color_140ms_ease,background-color_140ms_ease,box-shadow_120ms_var(--ease-out-emil)] active:[transform:scale(0.98)]',
                active
                  ? 'border-ink-950 bg-white shadow-[3px_3px_0_var(--color-acid-500)]'
                  : 'border-line bg-paper-100',
              ]}
            >
              <input
                type="radio"
                name="mother-tongue"
                value={option.value}
                bind:group={motherTongue}
              />
              <span
                class={[
                  'grid size-[2.2rem] place-items-center border border-ink-950 font-mono text-[0.68rem] font-[850]',
                  active ? 'bg-acid-500' : 'bg-white',
                ]}
                aria-hidden="true">{option.code}</span
              >
              <strong>{option.label}</strong>
              <Check class={active ? 'text-mint-700' : 'opacity-0'} size={18} aria-hidden="true" />
            </label>
          {/each}
        </fieldset>
      </SettingsSheet>

      <SettingsSheet
        icon={Brain}
        testId="learning-sheet"
        kicker={copy('skladba lekce', 'lesson mix')}
        title={copy('Jak se chceš učit', 'How you want to learn')}
      >
        {#snippet aside()}
          <span
            class="rounded-full border border-ink-950 bg-acid-100 px-[0.58rem] py-[0.38rem] font-mono text-[0.62rem] font-extrabold"
            >{enabledCount} / 8 {copy('aktivních', 'active')}</span
          >
        {/snippet}
        <div
          class="mt-4 grid gap-2 min-[640px]:grid-cols-3 [&_small]:mt-[0.08rem] [&_small]:block [&_small]:text-[0.67rem] [&_small]:text-ink-800 [&_strong]:block [&_strong]:text-[0.78rem]"
          aria-label={copy('Přednastavené kombinace úloh', 'Activity presets')}
        >
          <button class={presetButton} type="button" onclick={() => applyLearningPreset('balanced')}
            ><Brain size={16} /><span
              ><strong>{copy('Vyváženě', 'Balanced')}</strong><small
                >{copy('různé typy úloh', 'a mix of activities')}</small
              ></span
            ></button
          >
          <button class={presetButton} type="button" onclick={() => applyLearningPreset('typing')}
            ><Keyboard size={16} /><span
              ><strong>{copy('Jen psaní', 'Typing only')}</strong><small
                >{copy('bez kartiček', 'no flashcards')}</small
              ></span
            ></button
          >
          <button class={presetButton} type="button" onclick={() => applyLearningPreset('context')}
            ><Sparkles size={16} /><span
              ><strong>{copy('Kontext + hlas', 'Context + voice')}</strong><small
                >{copy('použití jazyka', 'active language use')}</small
              ></span
            ></button
          >
        </div>

        <details
          class="group mt-4 border-t border-line pt-[0.35rem]"
          data-testid="exercise-settings"
        >
          <summary
            class="flex min-h-[3.2rem] list-none items-center justify-between gap-3 text-cobalt-700 [&::-webkit-details-marker]:hidden"
          >
            <span class="block"
              ><strong class="block text-[0.82rem]"
                >{copy('Vlastní skladba úloh', 'Custom activity mix')}</strong
              ><small class="mt-[0.1rem] block text-[0.7rem] text-ink-600"
                >{copy(
                  'Rozbalit jednotlivé typy procvičování',
                  'Expand individual activity types',
                )}</small
              ></span
            >
            <ChevronDown
              class="flex-none [transition:transform_180ms_var(--ease-out-emil)] group-open:rotate-180"
              size={18}
              aria-hidden="true"
            />
          </summary>
          <ExerciseMixPicker
            language={motherTongue}
            preferences={exercisePreferences}
            ontoggle={setExercise}
          />
        </details>
        <p
          class="mt-[0.8rem] flex items-start gap-[0.4rem] text-[0.69rem] leading-[1.45] text-ink-800"
        >
          <Sparkles class="flex-none text-cobalt-700" size={14} />
          {copy(
            'Vlastní věta funguje i bez klíče v demo režimu. Rozpoznání mluvení zajišťuje prohlížeč a podle něj může využít online službu; přepis lze vždy opravit ručně.',
            'Your own sentence also works in demo mode without a key. Speech recognition is provided by the browser and may use an online service; you can always edit the transcript manually.',
          )}
        </p>
      </SettingsSheet>

      <SettingsSheet
        icon={Clock3}
        kicker={copy('průběh procvičování', 'practice preferences')}
        title={copy('Jak má probíhat jedna odpověď', 'How each answer should feel')}
      >
        {#snippet aside()}
          <button
            class="inline-flex min-h-10 items-center gap-[0.45rem] rounded-[0.2rem] border border-cobalt-700 bg-white px-[0.65rem] py-2 text-[0.72rem] font-extrabold text-cobalt-700 shadow-[2px_2px_0_var(--color-cobalt-300)] [transition:transform_120ms_var(--ease-out-emil),box-shadow_120ms_var(--ease-out-emil)] active:[transform:translate(1px,1px)_scale(0.97)] active:shadow-[1px_1px_0_var(--color-cobalt-300)]"
            type="button"
            onclick={applyFocusPreset}
            ><Clock3 size={16} /> {copy('Rychlé soustředění', 'Quick focus')}</button
          >
        {/snippet}
        <div
          class="mt-4 flex items-start gap-3 rounded-[0.2rem_0.9rem_0.2rem_0.2rem] border border-ink-950 bg-white p-[0.9rem] shadow-[3px_3px_0_var(--color-cobalt-300)]"
        >
          <Clock3 class="flex-none text-cobalt-700" size={19} />
          <div>
            <strong class="text-[0.88rem]"
              >{copy(
                'Pevná dávka bez čekacích obrazovek',
                'A fixed batch without waiting screens',
              )}</strong
            >
            <p class="mt-[0.3rem] text-[0.72rem] leading-normal text-ink-600">
              {copy(
                'Před začátkem si vybereš skupinu a 5–30 kartiček k opakování. Chybné odpovědi počet úloh nezvýší.',
                'Choose a group and 5–30 cards to review before you start. Wrong answers won’t add more activities.',
              )}
            </p>
          </div>
        </div>

        <div class={toggleGrid}>
          <ToggleRow
            bind:checked={showStudyTips}
            title={copy('Tipy a vysvětlující texty', 'Tips and explanations')}
            description={copy(
              'Zobrazuje důvod typu úlohy, klávesové zkratky, gramatické detaily a možnost AI vysvětlení chyby.',
              'Shows why an activity was chosen, keyboard shortcuts, grammar details, and optional AI explanations.',
            )}
          />
          <ToggleRow
            bind:checked={requireCorrection}
            title={copy('Po chybě vyžadovat opravu', 'Require a correction after mistakes')}
            description={copy(
              'U psaní je před pokračováním potřeba jednou zadat přesnou podobu. Vypnutí zrychlí rytmus.',
              'For typing activities, enter the exact form once before continuing. Disable this for a faster pace.',
            )}
          />
          <ToggleRow
            bind:checked={reduceMotion}
            title={copy('Minimum pohybu', 'Reduce motion')}
            description={copy(
              'Omezí animace a vypne oslavy.',
              'Reduces animations and turns off celebrations.',
            )}
          />
          <ToggleRow
            bind:checked={showKeyboardHints}
            title={copy('Německá miniklávesnice', 'German mini keyboard')}
            description={copy(
              'Pod psacím polem zobrazí ä, ö, ü a ß pro dotykové ovládání.',
              'Shows ä, ö, ü, and ß below typing fields for touch input.',
            )}
          />
          <ToggleRow
            bind:checked={allowKeyboardFallback}
            title={copy('Přijímat ae, oe, ue a ss', 'Accept ae, oe, ue, and ss')}
            description={copy(
              'Náhradní zápis se počítá jako téměř správný a zobrazí přesnou německou podobu.',
              'Fallback spelling counts as nearly correct and shows the exact German form.',
            )}
          />
          <ToggleRow
            bind:checked={autoSpeakGerman}
            title={copy('Automaticky přehrát němčinu', 'Play German automatically')}
            description={copy(
              'Po správné odpovědi přehraje výslovnost, pokud ji zařízení podporuje.',
              'Plays pronunciation after a correct answer when the device supports it.',
            )}
          />
        </div>
      </SettingsSheet>

      <SettingsSheet
        icon={Target}
        kicker={copy('dlouhodobý plán', 'long-term plan')}
        title={copy('Denní učení', 'Daily practice')}
      >
        <div class="mt-4 grid gap-[0.8rem] min-[640px]:grid-cols-2">
          <label for="profile-name">
            <span class="{monoLabel} mb-[0.42rem] block"
              >{copy('Jméno v pozdravu', 'Name in greetings')}</span
            >
            <input
              id="profile-name"
              class="field"
              maxlength="50"
              bind:value={profileName}
              placeholder={copy('např. Klára', 'e.g. Clara')}
              autocomplete="given-name"
            />
          </label>
          <label for="grammar-level">
            <span class="{monoLabel} mb-[0.42rem] block"
              >{copy('Moje úroveň němčiny', 'My German level')}</span
            >
            <select
              id="grammar-level"
              class="field"
              bind:value={grammarLevel}
              aria-describedby="grammar-level-help"
            >
              {#each DETAILED_CEFR_LEVELS as item}
                <option value={item}>{item}</option>
              {/each}
            </select>
            <small
              class="mt-[0.45rem] block text-[0.69rem] leading-[1.45] text-ink-600"
              id="grammar-level-help"
            >
              {copy(
                'Jednodušší gramatické lekce se skryjí. Rozhovory a AI slovíčka se přizpůsobí této úrovni. Náročnější lekce můžeš dál otevřít.',
                'Easier grammar lessons are hidden. Conversations and AI vocabulary follow this level. You can still open more advanced lessons.',
              )}
            </small>
          </label>
          <fieldset class={choiceFieldset}>
            <legend class="{monoLabel} p-0">{copy('Můj hlavní cíl', 'My main goal')}</legend>
            <p class={choiceHelp}>
              {copy(
                'Podle cíle se změní pořadí úloh v denním plánu. Slovíčka k opakování v něm zůstanou.',
                'Your goal changes the order of activities in the daily plan. Words due for review stay included.',
              )}
            </p>
            <div class="mt-3 grid gap-[0.45rem]">
              {#each learningGoalOptions as option (option.value)}
                <label
                  class={[
                    choice(learningGoal === option.value),
                    'grid min-h-15 grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.65rem] px-[0.65rem] py-[0.55rem]',
                  ]}
                >
                  <input
                    type="radio"
                    name="settings-learning-goal"
                    value={option.value}
                    bind:group={learningGoal}
                  />
                  {#if option.value === 'school'}
                    <Target size={18} aria-hidden="true" />
                  {:else if option.value === 'memory'}
                    <Brain size={18} aria-hidden="true" />
                  {:else}
                    <MessagesSquare size={18} aria-hidden="true" />
                  {/if}
                  <span>
                    <strong class="block text-[0.8rem]">{copy(...option.title)}</strong>
                    <small class="mt-[0.12rem] block text-[0.66rem] leading-[1.35] text-ink-600"
                      >{copy(...option.description)}</small
                    >
                  </span>
                </label>
              {/each}
            </div>
          </fieldset>
          <fieldset class={choiceFieldset}>
            <legend class="{monoLabel} p-0"
              >{copy('Čas na učení denně', 'Daily learning time')}</legend
            >
            <p class={choiceHelp}>
              {copy(
                'Podle času se upraví počet úloh v denní lekci.',
                'The number of activities in your daily lesson adjusts to the time you choose.',
              )}
            </p>
            <div class="mt-3 grid grid-cols-3 gap-[0.45rem]">
              {#each dailyMinuteOptions as option}
                <label
                  class={[
                    choice(dailyMinutes === option),
                    'grid min-h-14 grid-cols-[auto_auto] place-content-center items-center gap-x-[0.35rem] gap-y-[0.15rem]',
                  ]}
                >
                  <input
                    type="radio"
                    name="settings-daily-minutes"
                    value={option}
                    bind:group={dailyMinutes}
                  />
                  <Clock3 size={17} />
                  <strong>{option} min</strong>
                  <small
                    class="col-span-2 text-center font-mono text-[0.58rem] text-ink-600 uppercase"
                    >{option === 5
                      ? copy('minimum', 'minimum')
                      : option === 10
                        ? copy('doporučeno', 'recommended')
                        : copy('delší procvičování', 'longer practice')}</small
                  >
                </label>
              {/each}
            </div>
          </fieldset>
          <PlannerAdvancedControls
            language={motherTongue}
            bind:desiredRetention
            bind:dailyNewLimit
          />
        </div>
      </SettingsSheet>

      <SettingsSheet
        id="motivace"
        icon={Sparkles}
        kicker={copy('motivace', 'motivation')}
        title={copy('Body jsou volitelné', 'Points are optional')}
      >
        <div class={toggleGrid}>
          <ToggleRow
            bind:checked={gamificationEnabled}
            title={copy('XP, úrovně, série a denní mise', 'XP, levels, streaks, and daily quests')}
            description={copy(
              'Zobrazí body, úrovně a osobní rekordy. Vypnutím se tvé výsledky ani plán opakování nezmění.',
              'Shows points, levels, and personal bests. Turning this off won’t change your results or review schedule.',
            )}
          />
          <ToggleRow
            bind:checked={rivalryEnabled}
            disabled={!gamificationEnabled}
            title={copy('Soukromý soupeř', 'Private rival')}
            description={copy(
              'Porovnej týdenní XP s robotem nebo ho vyzvi na pět otázek. Obtížnost přizpůsobí tvým odpovědím. Vše funguje v tomto zařízení.',
              'Compare weekly XP with a bot or challenge it to five questions. It adjusts to your answers and runs entirely on this device.',
            )}
          />
          <ToggleRow
            bind:checked={celebrations}
            disabled={!gamificationEnabled || reduceMotion}
            title={copy('Jemné oslavy milníků', 'Subtle milestone celebrations')}
            description={copy(
              'Krátká animace při splnění cíle nebo dosažení nové úrovně. Při omezeném pohybu se nezobrazí.',
              'A short animation when you reach a goal or a new level. Hidden when reduced motion is on.',
            )}
          />
        </div>
      </SettingsSheet>

      <SettingsSheet
        icon={Eye}
        kicker={copy('vzhled', 'appearance')}
        title={copy('Hlavní barva rozhraní', 'Interface accent color')}
      >
        <p
          id="accent-help"
          class="mt-[0.6rem] max-w-[65ch] text-[0.74rem] leading-normal text-ink-600"
        >
          {copy(
            'Mění tlačítka, aktivní navigaci a zvýraznění. Náhled se ukáže hned; volbu potom ulož tlačítkem dole.',
            'Changes buttons, active navigation, and highlights. The preview appears immediately; save it with the button below.',
          )}
        </p>
        <AccentThemePicker
          language={motherTongue}
          bind:value={accentTheme}
          onpreview={previewAccentTheme}
        />
      </SettingsSheet>

      <div
        class="sticky bottom-[calc(4.65rem+var(--safe-bottom))] z-20 flex items-center justify-between gap-4 rounded-[0.25rem] border border-ink-950 bg-[color-mix(in_srgb,var(--color-paper-50)_95%,transparent)] p-3 shadow-[5px_5px_0_var(--color-ink-950)] backdrop-blur-[16px] max-[601px]:flex-col max-[601px]:items-stretch lg:bottom-4"
      >
        <div>
          {#if !saveMessage && settingsFormError}
            <p class="text-[0.76rem] font-[760] text-coral-700" aria-live="polite">
              {settingsFormError}
            </p>
          {:else if saveMessage}
            <p
              class={['text-[0.76rem] font-[760]', saveError ? 'text-coral-700' : 'text-mint-700']}
              aria-live={saveError ? 'assertive' : 'polite'}
            >
              {saveMessage}
            </p>
          {:else}
            <p class="text-[0.72rem] text-ink-600">
              {copy(
                'Barva se ukazuje hned; všechny změny natrvalo uloží toto tlačítko.',
                'The color previews immediately; this button saves every change permanently.',
              )}
            </p>
          {/if}
        </div>
        <button
          class="btn-base btn-primary max-[601px]:w-full"
          type="submit"
          disabled={saving || Boolean(settingsFormError)}
        >
          {#if saved}<Check size={18} />{:else}<Save size={18} />{/if}
          {saved
            ? copy('Uloženo', 'Saved')
            : saving
              ? copy('Ukládám…', 'Saving…')
              : copy('Uložit nastavení', 'Save settings')}
        </button>
      </div>
    </form>

    <AiSettingsCard />
    <AccessSettingsCard />

    <div class="grid gap-4 lg:grid-cols-2">
      <ReminderCard language={motherTongue} />
      <InstallAppCard language={motherTongue} />
      <OfflineAudioCard
        language={motherTongue}
        onstoragechange={() => void backupCard?.refreshStorage()}
      />
      <DataBackupCard
        bind:this={backupCard}
        language={motherTongue}
        onreplaced={() => (hydrated = false)}
      />
      <BetaDiagnosticsCard />
    </div>
  </div>
{/if}
