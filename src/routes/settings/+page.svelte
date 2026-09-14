<script lang="ts">
  import {
    clearDownloadedLearningAudio,
    downloadLearningAudio,
  } from '$lib/client/learning-audio.ts';
  import LoadingState from '$lib/components/LoadingState.svelte';
  import PageHeading from '$lib/components/PageHeading.svelte';
  import AiSettingsCard from '$lib/components/settings/AiSettingsCard.svelte';
  import BetaDiagnosticsCard from '$lib/components/settings/BetaDiagnosticsCard.svelte';
  import PlannerAdvancedControls from '$lib/components/settings/PlannerAdvancedControls.svelte';
  import ToggleRow from '$lib/components/ToggleRow.svelte';
  import { isEncryptedBackup } from '$lib/domain/backup/encrypted.ts';
  import { createBackupFile, MAX_BACKUP_FILE_BYTES } from '$lib/domain/backup/file.ts';
  import { DETAILED_CEFR_LEVELS, isDetailedCefrLevel } from '$lib/domain/levels.ts';
  import { DEFAULT_EXERCISE_PREFERENCES } from '$lib/domain/settings/defaults.ts';
  import { enabledExerciseCount, hasUniversalExercise } from '$lib/domain/settings/validation.ts';
  import { t } from '$lib/i18n';
  import { appStore } from '$lib/state/app';
  import Brain from '@lucide/svelte/icons/brain';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Clock3 from '@lucide/svelte/icons/clock-3';
  import DatabaseBackup from '@lucide/svelte/icons/database-backup';
  import Download from '@lucide/svelte/icons/download';
  import Eye from '@lucide/svelte/icons/eye';
  import FileText from '@lucide/svelte/icons/file-text';
  import FileUp from '@lucide/svelte/icons/file-up';
  import Headphones from '@lucide/svelte/icons/headphones';
  import Keyboard from '@lucide/svelte/icons/keyboard';
  import Languages from '@lucide/svelte/icons/languages';
  import Link2 from '@lucide/svelte/icons/link-2';
  import MessagesSquare from '@lucide/svelte/icons/messages-square';
  import Mic from '@lucide/svelte/icons/mic';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Save from '@lucide/svelte/icons/save';
  import Smartphone from '@lucide/svelte/icons/smartphone';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Target from '@lucide/svelte/icons/target';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { onDestroy, onMount } from 'svelte';

  import type { BackupPreview } from '$lib/domain/backup/encrypted.ts';
  import type {
    AccentTheme,
    DailyMinutes,
    DetailedCefrLevel,
    ExercisePreferences,
    LearningGoal,
    MotherTongue,
    StudyPace,
    AppBackup,
  } from '$lib/domain/types.ts';

  const accentThemes: Array<{
    value: AccentTheme;
    label: string;
    description: string;
    enLabel: string;
    enDescription: string;
  }> = [
    {
      value: 'green',
      label: 'Původní zelená',
      description: 'Limetková z původního vzhledu',
      enLabel: 'Original green',
      enDescription: 'The lime accent from the original look',
    },
    {
      value: 'moss',
      label: 'Mechová',
      description: 'Klidnější tlumená zelená',
      enLabel: 'Moss',
      enDescription: 'A calmer muted green',
    },
    {
      value: 'magenta',
      label: 'Magenta',
      description: 'Výrazná, ale ne neonová',
      enLabel: 'Magenta',
      enDescription: 'Bold without looking neon',
    },
    {
      value: 'rose',
      label: 'Starorůžová',
      description: 'Měkčí a teplejší tón',
      enLabel: 'Dusty rose',
      enDescription: 'A softer, warmer tone',
    },
    {
      value: 'blue',
      label: 'Modrá',
      description: 'Čistý chladnější akcent',
      enLabel: 'Blue',
      enDescription: 'A clean, cooler accent',
    },
    {
      value: 'teal',
      label: 'Petrolejová',
      description: 'Sytá modrozelená',
      enLabel: 'Teal',
      enDescription: 'A rich blue-green accent',
    },
  ];
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
      description: ['Nejdřív splatné dlouhodobé opakování.', 'Due long-term review first.'],
    },
    {
      value: 'conversation',
      title: ['Rozmluvit se', 'Start speaking'],
      description: ['Nejdřív aktivní použití a konverzace.', 'Active use and conversation first.'],
    },
  ];

  let hydrated = false;
  let saving = false;
  let saved = false;
  let motherTongue: MotherTongue = 'cs';
  let profileName = '';
  let grammarLevel: DetailedCefrLevel = 'A1.1';
  let learningGoal: LearningGoal = 'school';
  let desiredRetention = 90;
  let dailyNewLimit = 15;
  let dailyMinutes: DailyMinutes = 10;
  let accentTheme: AccentTheme = 'green';
  let exercisePreferences: ExercisePreferences = { ...DEFAULT_EXERCISE_PREFERENCES };
  let studyPace: StudyPace = 'guided';
  let allowKeyboardFallback = true;
  let autoSpeakGerman = false;
  let requireCorrection = true;
  let showKeyboardHints = true;
  let showStudyTips = true;
  let reduceMotion = false;
  let gamificationEnabled = true;
  let rivalryEnabled = true;
  let celebrations = true;

  let backupInput: HTMLInputElement | undefined;
  let saveMessage = '';
  let saveError = false;
  let restoreMessage = '';
  let restoreError = false;
  let restoring = false;
  let encrypting = false;
  let backupPassphrase = '';
  let backupPassphraseConfirmation = '';
  let restorePassphrase = '';
  let pendingRestoreValue: unknown;
  let pendingRestoreName = '';
  let pendingRestore: { backup: AppBackup; preview: BackupPreview } | undefined;
  let resetConfirmationVisible = false;
  let resetConfirmationText = '';
  let storageSupported = false;
  let storagePersistent: boolean | undefined;
  let storageUsage: number | undefined;
  let storageQuota: number | undefined;
  let audioBusy = false;
  let audioMessage = '';
  let audioError = false;

  $: if ($appStore.settings && !hydrated) {
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
  $: enabledCount = enabledExerciseCount(exercisePreferences);
  $: settingsFormError = validateSettingsForm(
    profileName,
    desiredRetention,
    dailyNewLimit,
    exercisePreferences,
    grammarLevel,
  );

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

  $: copy = (cs: string, en: string): string => (motherTongue === 'en' ? en : cs);

  onMount(() => {
    void appStore.initialize();
    void refreshStorageStatus();
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
        'Nech zapnuté psaní, mluvení, kartičku nebo doplňovačku jako bezpečný režim pro každé slovo.',
        'Keep typing, speaking, flashcards, or fill-in enabled as a fallback for every word.',
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
      saveMessage =
        motherTongue === 'cs' && error instanceof Error
          ? error.message
          : copy('Nastavení se nepodařilo uložit.', 'Settings could not be saved.');
    } finally {
      saving = false;
    }
  }

  async function downloadBackup(): Promise<void> {
    restoreMessage = '';
    restoreError = false;
    try {
      const backup = await appStore.backup();
      downloadJson(
        createBackupFile(backup),
        `fritz-backup-${new Date().toISOString().slice(0, 10)}.json`,
      );
      restoreMessage = copy(
        'Nešifrovaná záloha byla připravena. Ulož ji na bezpečné místo.',
        'The unencrypted backup is ready. Store it somewhere safe.',
      );
    } catch (error) {
      restoreError = true;
      restoreMessage =
        motherTongue === 'cs' && error instanceof Error
          ? error.message
          : copy('Zálohu se nepodařilo vytvořit.', 'The backup could not be created.');
    }
  }

  function downloadJson(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  async function downloadEncryptedBackup(): Promise<void> {
    restoreMessage = '';
    restoreError = false;
    if (backupPassphrase !== backupPassphraseConfirmation) {
      restoreError = true;
      restoreMessage = copy(
        'Hesla šifrované zálohy se neshodují.',
        'The encrypted-backup passphrases do not match.',
      );
      return;
    }
    encrypting = true;
    try {
      const envelope = await appStore.encryptedBackup(backupPassphrase);
      downloadJson(
        createBackupFile(envelope),
        `fritz-backup-encrypted-${new Date().toISOString().slice(0, 10)}.json`,
      );
      backupPassphrase = '';
      backupPassphraseConfirmation = '';
      restoreMessage = copy(
        'Šifrovaná záloha byla připravena. Heslo nelze obnovit.',
        'The encrypted backup is ready. The passphrase cannot be recovered.',
      );
    } catch (error) {
      restoreError = true;
      restoreMessage =
        motherTongue === 'cs' && error instanceof Error
          ? error.message
          : copy(
              'Šifrovanou zálohu se nepodařilo vytvořit.',
              'The encrypted backup could not be created.',
            );
    } finally {
      encrypting = false;
    }
  }

  async function resetData(): Promise<void> {
    if (resetConfirmationText !== (motherTongue === 'en' ? 'DELETE' : 'SMAZAT')) return;
    restoreMessage = '';
    restoreError = false;
    try {
      await appStore.reset();
      hydrated = false;
      resetConfirmationVisible = false;
      resetConfirmationText = '';
      restoreMessage = copy(
        'Ukázková data byla obnovena. Předchozí stav lze krátkodobě vrátit.',
        'Sample data was restored. You can undo the previous state for a short time.',
      );
    } catch (error) {
      restoreError = true;
      restoreMessage =
        motherTongue === 'cs' && error instanceof Error
          ? error.message
          : copy('Data se nepodařilo resetovat.', 'The data could not be reset.');
    }
  }

  async function restoreBackup(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    restoreMessage = '';
    restoreError = false;
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      restoreError = true;
      restoreMessage = copy(
        'Záloha je příliš velká. Limit je 48 MiB.',
        'The backup is too large. The limit is 48 MiB.',
      );
      input.value = '';
      return;
    }

    restoring = true;
    try {
      pendingRestoreValue = JSON.parse(await file.text());
      pendingRestoreName = file.name;
      pendingRestore = undefined;
      restorePassphrase = '';
      if (isEncryptedBackup(pendingRestoreValue)) {
        restoreMessage = copy(
          'Záloha je chráněná heslem. Zadej ho pro zobrazení obsahu.',
          'This backup is password-protected. Enter the password to preview it.',
        );
      } else {
        await prepareRestorePreview();
      }
    } catch (error) {
      restoreError = true;
      restoreMessage =
        motherTongue === 'cs' && error instanceof Error
          ? error.message
          : copy('Zálohu se nepodařilo načíst.', 'The backup could not be read.');
    } finally {
      restoring = false;
      input.value = '';
    }
  }

  async function prepareRestorePreview(): Promise<void> {
    if (pendingRestoreValue === undefined) return;
    restoring = true;
    restoreMessage = '';
    restoreError = false;
    try {
      pendingRestore = await appStore.prepareRestore(pendingRestoreValue, restorePassphrase);
      restoreMessage = copy(
        'Záloha je validní. Zkontroluj náhled před nahrazením dat.',
        'The backup is valid. Check the preview before replacing your data.',
      );
    } catch (error) {
      pendingRestore = undefined;
      restoreError = true;
      restoreMessage =
        motherTongue === 'cs' && error instanceof Error
          ? error.message
          : copy('Zálohu se nepodařilo ověřit.', 'The backup could not be verified.');
    } finally {
      restoring = false;
    }
  }

  async function commitRestore(): Promise<void> {
    if (!pendingRestore) return;
    restoring = true;
    restoreMessage = '';
    restoreError = false;
    try {
      await appStore.restore(pendingRestore.backup);
      hydrated = false;
      restoreMessage = copy(
        `Záloha ${pendingRestoreName} byla obnovena a ověřena. Předchozí stav lze krátkodobě vrátit.`,
        `Backup ${pendingRestoreName} was restored and verified. You can undo the previous state for a short time.`,
      );
      pendingRestore = undefined;
      pendingRestoreValue = undefined;
      restorePassphrase = '';
    } catch (error) {
      restoreError = true;
      restoreMessage =
        motherTongue === 'cs' && error instanceof Error
          ? error.message
          : copy('Zálohu se nepodařilo obnovit.', 'The backup could not be restored.');
    } finally {
      restoring = false;
    }
  }

  async function undoDestructiveChange(): Promise<void> {
    restoreError = false;
    try {
      await appStore.undoDestructiveChange();
      hydrated = false;
      restoreMessage = copy(
        'Předchozí lokální stav byl atomicky vrácen.',
        'The previous local state was restored atomically.',
      );
    } catch (error) {
      restoreError = true;
      restoreMessage =
        motherTongue === 'cs' && error instanceof Error
          ? error.message
          : copy('Předchozí stav nelze vrátit.', 'The previous state cannot be restored.');
    }
  }

  function humanBytes(value: number | undefined): string {
    if (value === undefined) return copy('nezjištěno', 'unknown');
    if (value < 1024) return `${value} B`;
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} kB`;
    return `${(value / 1024 ** 2).toFixed(1)} MB`;
  }

  async function refreshStorageStatus(): Promise<void> {
    storageSupported = Boolean(navigator.storage);
    if (!navigator.storage) return;
    storagePersistent = navigator.storage.persisted
      ? await navigator.storage.persisted()
      : undefined;
    const estimate = navigator.storage.estimate ? await navigator.storage.estimate() : undefined;
    storageUsage = estimate?.usage;
    storageQuota = estimate?.quota;
  }

  async function downloadCourseAudio(): Promise<void> {
    audioBusy = true;
    audioMessage = '';
    audioError = false;
    try {
      const result = await downloadLearningAudio();
      audioMessage =
        result.downloaded > 0
          ? copy(
              `Staženo ${result.downloaded} nahrávek pro offline poslech.${result.unavailable ? ` ${result.unavailable} se nepodařilo stáhnout.` : ''}`,
              `Downloaded ${result.downloaded} recordings for offline listening.${result.unavailable ? ` ${result.unavailable} could not be downloaded.` : ''}`,
            )
          : copy(
              'Pro tento obsah zatím nejsou kanonické nahrávky. Lekce bezpečně použije německý hlas zařízení.',
              'Canonical recordings are not available for this content yet. Lessons will safely use the device German voice.',
            );
      await refreshStorageStatus();
    } catch (error) {
      audioError = true;
      audioMessage =
        error instanceof Error
          ? error.message
          : copy('Audio se nepodařilo stáhnout.', 'Audio could not be downloaded.');
    } finally {
      audioBusy = false;
    }
  }

  async function clearCourseAudio(): Promise<void> {
    audioBusy = true;
    audioMessage = '';
    audioError = false;
    try {
      const removed = await clearDownloadedLearningAudio();
      audioMessage = removed
        ? copy('Stažené nahrávky byly odstraněny.', 'Downloaded recordings were removed.')
        : copy('Žádné stažené nahrávky tu nejsou.', 'There are no downloaded recordings.');
      await refreshStorageStatus();
    } catch (error) {
      audioError = true;
      audioMessage =
        error instanceof Error
          ? error.message
          : copy('Audio cache se nepodařilo vyčistit.', 'The audio cache could not be cleared.');
    } finally {
      audioBusy = false;
    }
  }

  async function requestPersistentStorage(): Promise<void> {
    restoreMessage = '';
    restoreError = false;
    if (!navigator.storage?.persist) {
      restoreError = true;
      restoreMessage = copy(
        'Tento prohlížeč žádost o trvalé úložiště nepodporuje.',
        'This browser does not support persistent-storage requests.',
      );
      return;
    }
    storagePersistent = await navigator.storage.persist();
    await refreshStorageStatus();
    restoreMessage = storagePersistent
      ? copy(
          'Prohlížeč povolil odolnější lokální úložiště. Samostatná záloha je stále nutná.',
          'The browser granted more durable local storage. A separate backup is still necessary.',
        )
      : copy(
          'Prohlížeč trvalé úložiště nepovolil. Pravidelně exportuj zálohu.',
          'The browser did not grant persistent storage. Export a backup regularly.',
        );
  }
</script>

<svelte:head>
  <title>{copy('Nastavení', 'Settings')} – Fritz</title>
</svelte:head>

{#if !$appStore.ready || !$appStore.settings}
  <LoadingState label={copy('Načítám nastavení…', 'Loading settings…')} />
{:else}
  <div class="settings-page">
    <PageHeading
      eyebrow={copy('Řídicí pult', 'Control panel')}
      title={copy(
        'Učení má sedět tobě, ne naopak.',
        'Learning should fit you—not the other way around.',
      )}
      description={copy(
        'Zapni jen formy, které chceš dělat. Adaptivní výběr pak rozhoduje podle slabiny konkrétní karty, ne podle slepého procentuálního losu.',
        'Enable only the activity types you want. Adaptive selection then responds to each card’s weakness instead of using a blind percentage mix.',
      )}
    />

    <form
      class="settings-form"
      onsubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <section class="settings-sheet language-sheet" aria-labelledby="mother-tongue-title">
        <div class="sheet-number"><Languages size={22} aria-hidden="true" /></div>
        <div class="sheet-content">
          <div class="language-heading">
            <div>
              <p class="lab-index">CS / EN → DE</p>
              <h2 id="mother-tongue-title">{t(motherTongue, 'settings.motherTongue')}</h2>
              <p id="mother-tongue-help">
                {t(motherTongue, 'settings.motherTongueDescription')}
              </p>
            </div>
            <span><Languages size={16} /> {t(motherTongue, 'settings.targetGerman')}</span>
          </div>

          <fieldset class="language-options" aria-describedby="mother-tongue-help">
            <legend class="sr-only">{t(motherTongue, 'settings.motherTongue')}</legend>
            {#each [{ value: 'cs' as const, label: t(motherTongue, 'settings.czech'), code: 'CS' }, { value: 'en' as const, label: t(motherTongue, 'settings.english'), code: 'EN' }] as option}
              <label class:active={motherTongue === option.value} class="language-option">
                <input
                  type="radio"
                  name="mother-tongue"
                  value={option.value}
                  bind:group={motherTongue}
                />
                <span aria-hidden="true">{option.code}</span>
                <strong>{option.label}</strong>
                <Check size={18} aria-hidden="true" />
              </label>
            {/each}
          </fieldset>
        </div>
      </section>

      <section class="settings-sheet learning-sheet">
        <div class="sheet-number"><Brain size={20} aria-hidden="true" /></div>
        <div class="sheet-content">
          <div class="section-heading">
            <div>
              <p class="lab-index">{copy('skladba lekce', 'lesson mix')}</p>
              <h2>{copy('Jak se chceš učit', 'How you want to learn')}</h2>
            </div>
            <span class="enabled-count">{enabledCount} / 8 {copy('aktivních', 'active')}</span>
          </div>

          <div
            class="preset-row"
            aria-label={copy('Přednastavené kombinace úloh', 'Activity presets')}
          >
            <button type="button" onclick={() => applyLearningPreset('balanced')}
              ><Brain size={16} /><span
                ><strong>{copy('Vyváženě', 'Balanced')}</strong><small
                  >{copy('adaptivní mix', 'adaptive mix')}</small
                ></span
              ></button
            >
            <button type="button" onclick={() => applyLearningPreset('typing')}
              ><Keyboard size={16} /><span
                ><strong>{copy('Jen psaní', 'Typing only')}</strong><small
                  >{copy('bez kartiček', 'no flashcards')}</small
                ></span
              ></button
            >
            <button type="button" onclick={() => applyLearningPreset('context')}
              ><Sparkles size={16} /><span
                ><strong>{copy('Kontext + hlas', 'Context + voice')}</strong><small
                  >{copy('použití jazyka', 'active language use')}</small
                ></span
              ></button
            >
          </div>

          <details class="advanced-settings exercise-settings">
            <summary>
              <span
                ><strong>{copy('Vlastní skladba úloh', 'Custom activity mix')}</strong><small
                  >{copy(
                    'Rozbalit jednotlivé typy procvičování',
                    'Expand individual activity types',
                  )}</small
                ></span
              >
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <div class="exercise-grid">
              <button
                class:active={exercisePreferences.typing}
                aria-pressed={exercisePreferences.typing}
                type="button"
                onclick={() => setExercise('typing')}
              >
                <span class="exercise-icon"><Keyboard size={19} /></span><span
                  ><strong>{copy('Psaní', 'Typing')}</strong><small
                    >{copy(
                      'Překlad z hlavy včetně členu.',
                      'Recall the German form, including its article.',
                    )}</small
                  ></span
                ><Check size={16} />
              </button>
              <button
                class:active={exercisePreferences.choice}
                aria-pressed={exercisePreferences.choice}
                type="button"
                onclick={() => setExercise('choice')}
              >
                <span class="exercise-icon"><Target size={19} /></span><span
                  ><strong>{copy('Výběr', 'Multiple choice')}</strong><small
                    >{copy(
                      'Rychlé rozpoznání nové odpovědi.',
                      'Quickly recognise the correct answer.',
                    )}</small
                  ></span
                ><Check size={16} />
              </button>
              <button
                class:active={exercisePreferences.flashcard}
                aria-pressed={exercisePreferences.flashcard}
                type="button"
                onclick={() => setExercise('flashcard')}
              >
                <span class="exercise-icon"><Eye size={19} /></span><span
                  ><strong>{copy('Kartičky', 'Flashcards')}</strong><small
                    >{copy(
                      'Odhalení a vlastní hodnocení 1–4.',
                      'Reveal and rate yourself from 1 to 4.',
                    )}</small
                  ></span
                ><Check size={16} />
              </button>
              <button
                class:active={exercisePreferences.wordOrder}
                aria-pressed={exercisePreferences.wordOrder}
                type="button"
                onclick={() => setExercise('wordOrder')}
              >
                <span class="exercise-icon"><FileText size={19} /></span><span
                  ><strong>{copy('Slovosled', 'Word order')}</strong><small
                    >{copy(
                      'Skládání frází a příkladových vět.',
                      'Build phrases and example sentences.',
                    )}</small
                  ></span
                ><Check size={16} />
              </button>
              <button
                class:active={exercisePreferences.cloze}
                aria-pressed={exercisePreferences.cloze}
                type="button"
                onclick={() => setExercise('cloze')}
              >
                <span class="exercise-icon"><Brain size={19} /></span><span
                  ><strong>{copy('Doplňování', 'Fill in')}</strong><small
                    >{copy(
                      'Příklad, plurál nebo slovesný tvar.',
                      'Complete an example, plural, or verb form.',
                    )}</small
                  ></span
                ><Check size={16} />
              </button>
              <button
                class:active={exercisePreferences.sentence}
                aria-pressed={exercisePreferences.sentence}
                type="button"
                onclick={() => setExercise('sentence')}
              >
                <span class="exercise-icon"><Sparkles size={19} /></span><span
                  ><strong>{copy('Vlastní věta', 'Your own sentence')}</strong><small
                    >{copy(
                      'Gemini posoudí smysl, tvar i přirozenost.',
                      'Gemini checks meaning, form, and naturalness.',
                    )}</small
                  ></span
                ><Check size={16} />
              </button>
              <button
                class:active={exercisePreferences.matching}
                aria-pressed={exercisePreferences.matching}
                type="button"
                onclick={() => setExercise('matching')}
              >
                <span class="exercise-icon"><Link2 size={19} /></span><span
                  ><strong>{copy('Párování', 'Matching')}</strong><small
                    >{copy(
                      'České významy propojíš s německými výrazy.',
                      'Match source-language meanings with German expressions.',
                    )}</small
                  ></span
                ><Check size={16} />
              </button>
              <button
                class:active={exercisePreferences.speaking}
                aria-pressed={exercisePreferences.speaking}
                type="button"
                onclick={() => setExercise('speaking')}
              >
                <span class="exercise-icon"><Mic size={19} /></span><span
                  ><strong>{copy('Mluvení', 'Speaking')}</strong><small
                    >{copy(
                      'Řekneš překlad nahlas a zkontroluješ přepis.',
                      'Say the German answer aloud and check the transcript.',
                    )}</small
                  ></span
                ><Check size={16} />
              </button>
            </div>
          </details>
          <p class="ai-note">
            <Sparkles size={14} />
            {copy(
              'Vlastní věta funguje i bez klíče v demo režimu. Rozpoznání mluvení zajišťuje prohlížeč a podle něj může využít online službu; přepis lze vždy opravit ručně.',
              'Your own sentence also works in demo mode without a key. Speech recognition is provided by the browser and may use an online service; you can always edit the transcript manually.',
            )}
          </p>
        </div>
      </section>

      <section class="settings-sheet pace-sheet">
        <div class="sheet-number"><Clock3 size={20} aria-hidden="true" /></div>
        <div class="sheet-content">
          <div class="section-heading">
            <div>
              <p class="lab-index">{copy('rytmus a tření', 'pace and friction')}</p>
              <h2>{copy('Jak má probíhat jedna odpověď', 'How each answer should feel')}</h2>
            </div>
            <button class="focus-preset" type="button" onclick={applyFocusPreset}
              ><Clock3 size={16} /> {copy('Rychlé soustředění', 'Quick focus')}</button
            >
          </div>

          <div class="session-rule">
            <Clock3 size={19} />
            <div>
              <strong
                >{copy(
                  'Pevná dávka bez čekacích obrazovek',
                  'A fixed batch without waiting screens',
                )}</strong
              >
              <p>
                {copy(
                  'Skupinu a 5–30 splatných karet vybereš před startem. Chyba dostane další FSRS termín, ale právě běžící dávku už nezvětší.',
                  'Choose a group and 5–30 due cards before you start. A mistake gets a new FSRS due date but never expands the current batch.',
                )}
              </p>
            </div>
          </div>

          <div class="toggle-grid">
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
                'Vypne dekorativní vstupy, oslavy a delší přechody bez ohledu na systémové nastavení.',
                'Disables decorative entrances, celebrations, and longer transitions regardless of system settings.',
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
        </div>
      </section>

      <section class="settings-sheet plan-sheet">
        <div class="sheet-number"><Target size={20} aria-hidden="true" /></div>
        <div class="sheet-content">
          <div class="section-heading">
            <div>
              <p class="lab-index">{copy('dlouhodobý plán', 'long-term plan')}</p>
              <h2>{copy('Objem a jistota', 'Volume and confidence')}</h2>
            </div>
          </div>
          <div class="plan-grid">
            <label class="field-label" for="profile-name">
              <span>{copy('Jméno v pozdravu', 'Name in greetings')}</span>
              <input
                id="profile-name"
                class="field"
                maxlength="50"
                bind:value={profileName}
                placeholder={copy('např. Klára', 'e.g. Clara')}
                autocomplete="given-name"
              />
            </label>
            <label class="field-label level-field" for="grammar-level">
              <span>{copy('Moje úroveň němčiny', 'My German level')}</span>
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
              <small id="grammar-level-help">
                {copy(
                  'Gramatika skryje jednodušší lekce pod touto úrovní; doporučená konverzace a AI sada se nastaví na stejné pásmo. Vyšší obsah zůstane otevřený.',
                  'Grammar hides easier lessons below this level; recommended conversations and AI activities use the same band. Higher content stays available.',
                )}
              </small>
            </label>
            <fieldset class="goal-mode-settings">
              <legend>{copy('Můj hlavní cíl', 'My main goal')}</legend>
              <p>
                {copy(
                  'Mění pořadí kroků v denním plánu. Splatné dlouhodobé opakování se nikdy neztratí.',
                  'Changes the order of your daily plan. Due long-term reviews always remain visible.',
                )}
              </p>
              <div>
                {#each learningGoalOptions as option}
                  <label class:selected={learningGoal === option.value}>
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
                      <strong>{copy(...option.title)}</strong>
                      <small>{copy(...option.description)}</small>
                    </span>
                  </label>
                {/each}
              </div>
            </fieldset>
            <fieldset class="time-mode-settings">
              <legend>{copy('Čas na učení denně', 'Daily learning time')}</legend>
              <p>
                {copy(
                  'Fritz podle času nastaví malou dokončitelnou dávku. XP zůstávají jen vedlejší odměnou.',
                  'Fritz turns the time into a small, finishable batch. XP stays a secondary reward.',
                )}
              </p>
              <div>
                {#each dailyMinuteOptions as option}
                  <label class:selected={dailyMinutes === option}>
                    <input
                      type="radio"
                      name="settings-daily-minutes"
                      value={option}
                      bind:group={dailyMinutes}
                    />
                    <Clock3 size={17} />
                    <strong>{option} min</strong>
                    <small
                      >{option === 5
                        ? copy('minimum', 'minimum')
                        : option === 10
                          ? copy('doporučeno', 'recommended')
                          : copy('hlubší blok', 'deeper block')}</small
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
        </div>
      </section>

      <section id="motivace" class="settings-sheet motivation-sheet">
        <div class="sheet-number"><Sparkles size={20} aria-hidden="true" /></div>
        <div class="sheet-content">
          <div class="section-heading">
            <div>
              <p class="lab-index">{copy('motivace', 'motivation')}</p>
              <h2>{copy('Body jsou volitelné', 'Points are optional')}</h2>
            </div>
          </div>
          <div class="toggle-grid">
            <ToggleRow
              bind:checked={gamificationEnabled}
              title={copy(
                'XP, úrovně, série a denní mise',
                'XP, levels, streaks, and daily quests',
              )}
              description={copy(
                'Zobrazuje herní postup a osobní rekordy. Plánovač, historie a mastery fungují i bez něj.',
                'Shows game progress and personal bests. Scheduling, history, and mastery still work without it.',
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
                'Krátký efekt jen při vzácných událostech. V režimu minima pohybu je vypnutý.',
                'A brief effect for rare events only. Disabled when reduced motion is on.',
              )}
            />
          </div>
        </div>
      </section>

      <section class="settings-sheet appearance-sheet">
        <div class="sheet-number"><Eye size={20} aria-hidden="true" /></div>
        <div class="sheet-content">
          <div class="section-heading">
            <div>
              <p class="lab-index">{copy('vzhled', 'appearance')}</p>
              <h2>{copy('Hlavní barva rozhraní', 'Interface accent color')}</h2>
            </div>
          </div>
          <p id="accent-help" class="accent-copy">
            {copy(
              'Mění tlačítka, aktivní navigaci a zvýraznění. Náhled se ukáže hned; volbu potom ulož tlačítkem dole.',
              'Changes buttons, active navigation, and highlights. The preview appears immediately; save it with the button below.',
            )}
          </p>
          <fieldset class="accent-options" aria-describedby="accent-help">
            <legend class="sr-only"
              >{copy('Vyber hlavní barvu rozhraní', 'Choose the interface accent color')}</legend
            >
            {#each accentThemes as option}
              <label
                class:active={accentTheme === option.value}
                class={`accent-option ${option.value}`}
              >
                <input
                  type="radio"
                  name="accent-theme"
                  value={option.value}
                  bind:group={accentTheme}
                  onchange={() => previewAccentTheme(option.value)}
                />
                <span class="accent-swatch" aria-hidden="true"><i></i></span>
                <span class="accent-label"
                  ><strong>{motherTongue === 'en' ? option.enLabel : option.label}</strong><small
                    >{motherTongue === 'en' ? option.enDescription : option.description}</small
                  ></span
                >
                <span class="accent-check" aria-hidden="true"><Check size={17} /></span>
              </label>
            {/each}
          </fieldset>
        </div>
      </section>

      <div class="sticky-save">
        <div>
          {#if !saveMessage && settingsFormError}
            <p class="save-message error" aria-live="polite">{settingsFormError}</p>
          {:else if saveMessage}
            <p
              class:error={saveError}
              class="save-message"
              aria-live={saveError ? 'assertive' : 'polite'}
            >
              {saveMessage}
            </p>
          {:else}
            <p class="save-hint">
              {copy(
                'Barva se ukazuje hned; všechny změny natrvalo uloží toto tlačítko.',
                'The color previews immediately; this button saves every change permanently.',
              )}
            </p>
          {/if}
        </div>
        <button
          class="btn-base btn-primary"
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

    <div class="utility-grid">
      <section class="utility-sheet">
        <div class="utility-heading">
          <Smartphone size={20} />
          <div>
            <p class="lab-index">{copy('zařízení', 'device')}</p>
            <h2>{copy('Instalace na iPhone', 'Install on iPhone')}</h2>
          </div>
        </div>
        <ol>
          <li>
            <strong>1.</strong>
            {copy('Otevři nasazenou adresu v Safari.', 'Open the deployed address in Safari.')}
          </li>
          <li><strong>2.</strong> {copy('Klepni na Sdílet.', 'Tap Share.')}</li>
          <li>
            <strong>3.</strong>
            {copy('Vyber „Přidat na plochu“.', 'Choose “Add to Home Screen”.')}
          </li>
        </ol>
        <p class="utility-note">
          {copy(
            'Po prvním online načtení funguje běžné učení offline. AI úlohy vyžadují živý server a internet.',
            'After the first online load, regular learning works offline. AI activities need a live server and internet connection.',
          )}
        </p>
      </section>

      <section class="utility-sheet" aria-labelledby="audio-download-title">
        <div class="utility-heading">
          <Headphones size={20} aria-hidden="true" />
          <div>
            <p class="lab-index">{copy('poslech', 'listening')}</p>
            <h2 id="audio-download-title">
              {copy('Audio pro offline lekce', 'Audio for offline lessons')}
            </h2>
          </div>
        </div>
        <p class="utility-copy">
          {copy(
            'Fritz přednostně použije zkontrolovanou nahrávku z manifestu. Když není dostupná, přejde na německý hlas zařízení. Volitelné rozpoznání řeči zajišťuje prohlížeč; Fritz audio neukládá.',
            'Fritz prefers a reviewed recording from the manifest. When unavailable, it uses the device German voice. Optional speech recognition is provided by the browser; Fritz does not store audio.',
          )}
        </p>
        <div class="backup-actions">
          <button
            class="btn-base btn-primary"
            type="button"
            disabled={audioBusy}
            onclick={downloadCourseAudio}
          >
            <Download size={18} aria-hidden="true" />
            {audioBusy
              ? copy('Pracuji…', 'Working…')
              : copy('Stáhnout dostupné audio', 'Download available audio')}
          </button>
          <button
            class="btn-base btn-secondary"
            type="button"
            disabled={audioBusy}
            onclick={clearCourseAudio}
          >
            <Trash2 size={18} aria-hidden="true" />
            {copy('Vyčistit audio cache', 'Clear audio cache')}
          </button>
        </div>
        {#if audioMessage}
          <p
            class:error={audioError}
            class="restore-message"
            aria-live={audioError ? 'assertive' : 'polite'}
          >
            {audioMessage}
          </p>
        {/if}
      </section>

      <section class="utility-sheet">
        <div class="utility-heading">
          <DatabaseBackup size={20} />
          <div>
            <p class="lab-index">{copy('data', 'data')}</p>
            <h2>{copy('Záloha a obnova', 'Backup and restore')}</h2>
          </div>
        </div>
        <p class="utility-copy">
          {copy(
            'Slovíčka, historie i vlastní texty zůstávají v tomto prohlížeči. Nešifrovaný JSON je čitelný každému, kdo soubor získá; pro běžné ukládání použij šifrovanou zálohu.',
            'Vocabulary, history, and your own texts stay in this browser. Anyone with an unencrypted JSON file can read it; use an encrypted backup for regular storage.',
          )}
        </p>
        <div class="backup-actions">
          <button class="btn-base btn-primary" type="button" onclick={downloadBackup}
            ><Download size={18} />
            {copy('Stáhnout čitelný JSON', 'Download readable JSON')}</button
          >
          <button
            class="btn-base btn-secondary"
            type="button"
            disabled={restoring}
            onclick={() => backupInput?.click()}
            ><FileUp size={18} />
            {restoring
              ? copy('Obnovuji…', 'Restoring…')
              : copy('Obnovit JSON', 'Restore JSON')}</button
          >
          <input
            class="sr-only"
            bind:this={backupInput}
            type="file"
            aria-label={copy('Vybrat JSON zálohu k obnovení', 'Choose a JSON backup to restore')}
            accept="application/json,.json"
            onchange={restoreBackup}
          />
        </div>
        <div class="encrypted-backup">
          <h3>{copy('Šifrovaná záloha', 'Encrypted backup')}</h3>
          <p>
            {copy(
              'AES-256-GCM s klíčem odvozeným z hesla. Fritz heslo nikam neukládá.',
              'AES-256-GCM with a key derived from your passphrase. Fritz never stores it.',
            )}
          </p>
          <div class="passphrase-grid">
            <label for="backup-passphrase"
              >{copy('Heslo (min. 10 znaků)', 'Passphrase (min. 10 characters)')}</label
            >
            <input
              id="backup-passphrase"
              type="password"
              autocomplete="new-password"
              bind:value={backupPassphrase}
            />
            <label for="backup-passphrase-confirmation"
              >{copy('Heslo znovu', 'Repeat passphrase')}</label
            >
            <input
              id="backup-passphrase-confirmation"
              type="password"
              autocomplete="new-password"
              bind:value={backupPassphraseConfirmation}
            />
          </div>
          <button
            class="btn-base btn-secondary"
            type="button"
            disabled={encrypting}
            onclick={downloadEncryptedBackup}
          >
            <DatabaseBackup size={18} />
            {encrypting
              ? copy('Šifruji…', 'Encrypting…')
              : copy('Vytvořit šifrovanou zálohu', 'Create encrypted backup')}
          </button>
        </div>

        {#if pendingRestoreValue !== undefined && isEncryptedBackup(pendingRestoreValue) && !pendingRestore}
          <div class="restore-preview" role="region" aria-labelledby="decrypt-heading">
            <h3 id="decrypt-heading">{copy('Odemknout náhled', 'Unlock preview')}</h3>
            <label for="restore-passphrase">{copy('Heslo zálohy', 'Backup passphrase')}</label>
            <input
              id="restore-passphrase"
              type="password"
              autocomplete="current-password"
              bind:value={restorePassphrase}
            />
            <button
              class="btn-base btn-secondary"
              type="button"
              disabled={restoring}
              onclick={prepareRestorePreview}
              >{copy('Ověřit a zobrazit náhled', 'Verify and show preview')}</button
            >
          </div>
        {/if}

        {#if pendingRestore}
          <div class="restore-preview" role="region" aria-labelledby="restore-preview-heading">
            <h3 id="restore-preview-heading">
              {copy('Co záloha nahradí', 'What the backup will replace')}
            </h3>
            <dl>
              <div>
                <dt>{copy('Balíčky', 'Decks')}</dt>
                <dd>{pendingRestore.preview.decks}</dd>
              </div>
              <div>
                <dt>{copy('Slovíčka', 'Words')}</dt>
                <dd>{pendingRestore.preview.notes}</dd>
              </div>
              <div>
                <dt>{copy('Karty', 'Cards')}</dt>
                <dd>{pendingRestore.preview.cards}</dd>
              </div>
              <div>
                <dt>{copy('Opakování', 'Reviews')}</dt>
                <dd>{pendingRestore.preview.reviews}</dd>
              </div>
              <div>
                <dt>{copy('Důkazy učení', 'Learning evidence')}</dt>
                <dd>{pendingRestore.preview.learningEvidence}</dd>
              </div>
              <div>
                <dt>{copy('Události cesty', 'Path events')}</dt>
                <dd>{pendingRestore.preview.coursePathEvents}</dd>
              </div>
            </dl>
            <p>
              {copy('Rozdíl proti současnému stavu:', 'Difference from the current state:')}
              {pendingRestore.preview.currentDifference?.notes ?? 0}
              {copy('slovíček,', 'words,')}
              {pendingRestore.preview.currentDifference?.reviews ?? 0}
              {copy('opakování a', 'reviews and')}
              {pendingRestore.preview.currentDifference?.learningEvidence ?? 0}
              {copy(
                'důkazů učení. Před zápisem vznikne krátkodobý rollback.',
                'learning evidence records. A short-lived rollback is created before writing.',
              )}
            </p>
            <div class="confirmation-actions">
              <button
                class="btn-base btn-primary"
                type="button"
                disabled={restoring}
                onclick={commitRestore}
                >{copy('Rozumím, atomicky obnovit', 'I understand, restore atomically')}</button
              >
              <button
                class="btn-base btn-secondary"
                type="button"
                onclick={() => {
                  pendingRestore = undefined;
                  pendingRestoreValue = undefined;
                  restoreMessage = '';
                }}>{copy('Zrušit', 'Cancel')}</button
              >
            </div>
          </div>
        {/if}

        <div class="storage-status">
          <h3>{copy('Odolnost úložiště', 'Storage resilience')}</h3>
          <p>
            {storageSupported
              ? copy(
                  `${storagePersistent ? 'Trvalé úložiště je povolené.' : 'Trvalé úložiště není potvrzené.'} Využito ${humanBytes(storageUsage)} z přibližně ${humanBytes(storageQuota)}.`,
                  `${storagePersistent ? 'Persistent storage is enabled.' : 'Persistent storage is not confirmed.'} Using ${humanBytes(storageUsage)} of approximately ${humanBytes(storageQuota)}.`,
                )
              : copy(
                  'Prohlížeč neposkytuje Storage API.',
                  'This browser does not provide the Storage API.',
                )}
          </p>
          <button
            class="btn-base btn-secondary"
            type="button"
            disabled={!storageSupported || storagePersistent === true}
            onclick={requestPersistentStorage}
            >{copy('Požádat o odolnější úložiště', 'Request more durable storage')}</button
          >
          <p class="key-note">
            {copy(
              'Ani persistent storage nenahrazuje zálohu při ztrátě zařízení.',
              'Persistent storage still does not replace a backup if the device is lost.',
            )}
          </p>
        </div>

        {#if resetConfirmationVisible}
          <div class="reset-confirmation" role="region" aria-labelledby="reset-heading">
            <h3 id="reset-heading">
              {copy(
                'Trvale nahradit lokální data ukázkou',
                'Permanently replace local data with the sample',
              )}
            </h3>
            <p>
              {copy(
                'Nejdřív vznikne rollback. Pro druhý krok napiš přesně',
                'A rollback is created first. For the second step, type exactly',
              )} <strong>{motherTongue === 'en' ? 'DELETE' : 'SMAZAT'}</strong>.
            </p>
            <label for="reset-confirmation">{copy('Potvrzení resetu', 'Reset confirmation')}</label>
            <input id="reset-confirmation" bind:value={resetConfirmationText} autocomplete="off" />
            <div class="confirmation-actions">
              <button
                class="reset-button"
                type="button"
                disabled={resetConfirmationText !== (motherTongue === 'en' ? 'DELETE' : 'SMAZAT')}
                onclick={resetData}
                ><RotateCcw size={16} /> {copy('Resetovat data', 'Reset data')}</button
              >
              <button
                class="btn-base btn-secondary"
                type="button"
                onclick={() => {
                  resetConfirmationVisible = false;
                  resetConfirmationText = '';
                }}>{copy('Zrušit', 'Cancel')}</button
              >
            </div>
          </div>
        {:else}
          <button
            class="reset-button"
            type="button"
            onclick={() => (resetConfirmationVisible = true)}
            ><RotateCcw size={16} />
            {copy('Smazat data a vrátit ukázku', 'Delete data and restore the sample')}</button
          >
        {/if}
        {#if appStore.rollbackIsAvailable()}
          <button
            class="btn-base btn-secondary undo-button"
            type="button"
            onclick={undoDestructiveChange}
            ><RotateCcw size={16} />
            {copy('Vrátit poslední obnovu nebo reset', 'Undo the latest restore or reset')}</button
          >
        {/if}
        {#if restoreMessage}<p
            class:error={restoreError}
            class="restore-message"
            aria-live={restoreError ? 'assertive' : 'polite'}
          >
            {restoreMessage}
          </p>{/if}
        <p class="key-note">
          {copy(
            'AI klíč, provider cookie ani telemetry identifikátory se nezálohují.',
            'The AI key, provider cookie, and telemetry identifiers are never included in backups.',
          )}
        </p>
      </section>
      <BetaDiagnosticsCard />
    </div>
  </div>
{/if}

<style>
  .settings-page {
    display: grid;
    gap: 1.5rem;
  }
  .settings-form {
    display: grid;
    gap: 1rem;
  }
  .settings-sheet {
    position: relative;
    display: grid;
    grid-template-columns: 2.7rem minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.3rem;
    background: var(--color-paper-50);
    box-shadow: 5px 5px 0 var(--color-ink-950);
  }
  .sheet-number {
    display: grid;
    place-items: start center;
    border-right: 1px solid var(--color-coral-500);
    background: var(--color-paper-100);
    padding-top: 1.25rem;
    color: var(--color-coral-700);
    font-family: var(--font-mono);
    font-size: 0.67rem;
    font-weight: 850;
    text-align: center;
  }
  .sheet-content {
    min-width: 0;
    padding: 1.2rem;
  }
  .language-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }
  .language-heading h2 {
    margin-top: 0.15rem;
    font-size: 1.7rem;
    font-weight: 900;
    letter-spacing: -0.035em;
  }
  .language-heading p:last-child {
    max-width: 65ch;
    margin-top: 0.35rem;
    color: var(--color-ink-800);
    font-size: 0.78rem;
    line-height: 1.5;
  }
  .language-heading > span {
    display: inline-flex;
    min-height: 2.5rem;
    flex: none;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--color-ink-950);
    background: var(--color-acid-100);
    padding: 0.5rem 0.65rem;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 800;
  }
  .language-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
    margin: 1rem 0 0;
    border: 0;
    padding: 0;
  }
  .language-option {
    display: grid;
    min-height: 4rem;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    border: 1px solid var(--color-line);
    background: var(--color-paper-100);
    padding: 0.7rem;
    cursor: pointer;
    transition:
      transform 120ms var(--ease-out-emil),
      border-color 140ms ease,
      background-color 140ms ease,
      box-shadow 120ms var(--ease-out-emil);
  }
  .language-option:active {
    transform: scale(0.98);
  }
  .language-option > span {
    display: grid;
    width: 2.2rem;
    height: 2.2rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    background: white;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 850;
  }
  .language-option > :global(svg) {
    opacity: 0;
    color: var(--color-mint-700);
  }
  .language-option.active {
    border-color: var(--color-ink-950);
    background: white;
    box-shadow: 3px 3px 0 var(--color-acid-500);
  }
  .language-option.active > span {
    background: var(--color-acid-500);
  }
  .language-option.active > :global(svg) {
    opacity: 1;
  }
  .section-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.8rem;
  }
  .section-heading h2 {
    margin-top: 0.15rem;
    font-size: clamp(1.25rem, 3vw, 1.7rem);
    font-weight: 900;
    letter-spacing: -0.04em;
  }
  .lab-index {
    color: var(--color-coral-700);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.075em;
    text-transform: uppercase;
  }
  .enabled-count {
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    background: var(--color-acid-100);
    padding: 0.38rem 0.58rem;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 800;
  }

  .advanced-settings {
    margin-top: 1rem;
    border-top: 1px solid var(--color-line);
    padding-top: 0.35rem;
  }
  .advanced-settings > summary {
    display: flex;
    min-height: 3.2rem;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    color: var(--color-cobalt-700);
    list-style: none;
  }
  .advanced-settings > summary::-webkit-details-marker {
    display: none;
  }
  .advanced-settings > summary span,
  .advanced-settings > summary strong,
  .advanced-settings > summary small {
    display: block;
  }
  .advanced-settings > summary strong {
    font-size: 0.82rem;
  }
  .advanced-settings > summary small {
    margin-top: 0.1rem;
    color: var(--color-ink-600);
    font-size: 0.7rem;
  }
  .advanced-settings > summary :global(svg) {
    flex: none;
    transition: transform 180ms var(--ease-out-emil);
  }
  .advanced-settings[open] > summary :global(svg) {
    transform: rotate(180deg);
  }

  .preset-row {
    display: grid;
    gap: 0.5rem;
    margin-top: 1rem;
  }
  .preset-row button {
    display: grid;
    min-height: 3.8rem;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.65rem;
    border: 1px solid var(--color-line);
    border-radius: 0.2rem;
    background: white;
    padding: 0.7rem;
    text-align: left;
    transition:
      transform 120ms var(--ease-out-emil),
      border-color 140ms ease,
      box-shadow 120ms var(--ease-out-emil);
  }
  .preset-row button:active {
    transform: scale(0.97);
  }
  .preset-row button :global(svg) {
    color: var(--color-cobalt-700);
  }
  .preset-row strong,
  .preset-row small {
    display: block;
  }
  .preset-row strong {
    font-size: 0.78rem;
  }
  .preset-row small {
    margin-top: 0.08rem;
    color: var(--color-ink-800);
    font-size: 0.67rem;
  }

  .exercise-grid {
    display: grid;
    gap: 0.55rem;
    margin-top: 1rem;
  }
  .exercise-grid > button {
    display: grid;
    min-height: 5.2rem;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    border: 1px solid var(--color-line);
    border-radius: 0.2rem;
    color: var(--color-ink-800);
    background: var(--color-paper-100);
    padding: 0.75rem;
    text-align: left;
    transition:
      transform 120ms var(--ease-out-emil),
      border-color 140ms ease,
      background-color 140ms ease,
      box-shadow 120ms var(--ease-out-emil);
  }
  .exercise-grid > button:active {
    transform: scale(0.98);
  }
  .exercise-grid > button > :global(svg:last-child) {
    opacity: 0;
  }
  .exercise-grid > button.active {
    border-color: var(--color-ink-950);
    color: var(--color-ink-950);
    background: white;
    box-shadow: 3px 3px 0 var(--color-acid-500);
  }
  .exercise-grid > button.active > :global(svg:last-child) {
    opacity: 1;
    color: var(--color-mint-700);
  }
  .exercise-icon {
    display: grid;
    width: 2.45rem;
    height: 2.45rem;
    place-items: center;
    border: 1px solid currentColor;
    border-radius: 999px;
  }
  .exercise-grid strong,
  .exercise-grid small {
    display: block;
  }
  .exercise-grid strong {
    font-size: 0.86rem;
  }
  .exercise-grid small {
    margin-top: 0.18rem;
    color: var(--color-ink-800);
    font-size: 0.75rem;
    line-height: 1.35;
  }
  .ai-note {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    margin-top: 0.8rem;
    color: var(--color-ink-800);
    font-size: 0.69rem;
    line-height: 1.45;
  }
  .ai-note :global(svg) {
    flex: none;
    color: var(--color-cobalt-700);
  }

  .focus-preset {
    display: inline-flex;
    min-height: 2.5rem;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid var(--color-cobalt-700);
    border-radius: 0.2rem;
    color: var(--color-cobalt-700);
    background: white;
    padding: 0.5rem 0.65rem;
    font-size: 0.72rem;
    font-weight: 800;
    box-shadow: 2px 2px 0 var(--color-cobalt-300);
    transition:
      transform 120ms var(--ease-out-emil),
      box-shadow 120ms var(--ease-out-emil);
  }
  .focus-preset:active {
    transform: translate(1px, 1px) scale(0.97);
    box-shadow: 1px 1px 0 var(--color-cobalt-300);
  }
  .session-rule {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-top: 1rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.2rem 0.9rem 0.2rem 0.2rem;
    background: white;
    padding: 0.9rem;
    box-shadow: 3px 3px 0 var(--color-cobalt-300);
  }
  .session-rule :global(svg) {
    flex: none;
    color: var(--color-cobalt-700);
  }
  .session-rule strong {
    font-size: 0.88rem;
  }
  .session-rule p {
    margin-top: 0.3rem;
    color: var(--color-ink-600);
    font-size: 0.72rem;
    line-height: 1.5;
  }
  .toggle-grid {
    display: grid;
    gap: 0.55rem;
    margin-top: 1rem;
  }

  .accent-copy {
    max-width: 65ch;
    margin-top: 0.6rem;
    color: var(--color-ink-600);
    font-size: 0.74rem;
    line-height: 1.5;
  }
  .accent-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13.5rem, 1fr));
    gap: 0.55rem;
    margin: 1rem 0 0;
    border: 0;
    padding: 0;
  }
  .accent-option {
    --accent-choice: #c9ff38;
    --accent-choice-soft: #f1ffc9;
    display: grid;
    min-height: 4.5rem;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    border: 1px solid var(--color-line);
    border-radius: 0.2rem;
    color: var(--color-ink-950);
    background: var(--color-paper-100);
    padding: 0.7rem;
    cursor: pointer;
    transition:
      transform 120ms var(--ease-out-emil),
      border-color 140ms ease,
      background-color 140ms ease,
      box-shadow 120ms var(--ease-out-emil);
  }
  .accent-option.moss {
    --accent-choice: #7c9f63;
    --accent-choice-soft: #e9f0dc;
  }
  .accent-option.magenta {
    --accent-choice: #bd659b;
    --accent-choice-soft: #f5e3ef;
  }
  .accent-option.rose {
    --accent-choice: #b97783;
    --accent-choice-soft: #f2e1e4;
  }
  .accent-option.blue {
    --accent-choice: #648ac4;
    --accent-choice-soft: #e4ebf7;
  }
  .accent-option.teal {
    --accent-choice: #51948b;
    --accent-choice-soft: #dcefeb;
  }
  .accent-option input {
    width: 1.05rem;
    height: 1.05rem;
    margin: 0;
    accent-color: var(--accent-choice);
  }
  .accent-option:has(input:focus-visible) {
    outline: 3px solid var(--color-cobalt-700);
    outline-offset: 3px;
  }
  .accent-option.active {
    border-color: var(--color-ink-950);
    background: white;
    box-shadow: 3px 3px 0 var(--accent-choice);
  }
  .accent-option:active {
    transform: scale(0.98);
  }
  .accent-swatch {
    position: relative;
    display: grid;
    width: 2.55rem;
    height: 2.55rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.2rem 0.7rem 0.2rem 0.2rem;
    background: var(--accent-choice-soft);
  }
  .accent-swatch i {
    width: 1.2rem;
    height: 1.2rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 999px;
    background: var(--accent-choice);
  }
  .accent-label strong,
  .accent-label small {
    display: block;
  }
  .accent-label strong {
    font-size: 0.84rem;
  }
  .accent-label small {
    margin-top: 0.15rem;
    color: var(--color-ink-800);
    font-size: 0.75rem;
    line-height: 1.35;
  }
  .accent-check {
    display: grid;
    place-items: center;
    opacity: 0;
  }
  .accent-option.active .accent-check {
    opacity: 1;
  }

  .plan-grid {
    display: grid;
    gap: 0.8rem;
    margin-top: 1rem;
  }
  .field-label > span {
    display: block;
    margin-bottom: 0.42rem;
    color: var(--color-ink-800);
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 780;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .goal-mode-settings,
  .time-mode-settings {
    border: 1px solid var(--color-line);
    border-radius: 0.2rem;
    background: white;
    padding: 0.9rem;
  }
  .goal-mode-settings legend,
  .time-mode-settings legend {
    padding: 0;
    color: var(--color-ink-800);
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 780;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .goal-mode-settings > p,
  .time-mode-settings > p {
    margin-top: 0.35rem;
    color: var(--color-ink-600);
    font-size: 0.69rem;
    line-height: 1.45;
  }
  .time-mode-settings > div {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.45rem;
    margin-top: 0.75rem;
  }
  .goal-mode-settings > div {
    display: grid;
    gap: 0.45rem;
    margin-top: 0.75rem;
  }
  .goal-mode-settings label {
    display: grid;
    min-height: 3.75rem;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.65rem;
    border: 1px solid var(--color-line);
    border-radius: 0.3rem;
    padding: 0.55rem 0.65rem;
    cursor: pointer;
  }
  .goal-mode-settings input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .goal-mode-settings label:focus-within {
    outline: 3px solid var(--color-cobalt-700);
    outline-offset: 2px;
  }
  .goal-mode-settings label.selected {
    border-color: var(--color-ink-950);
    background: var(--color-accent-100);
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .goal-mode-settings strong,
  .goal-mode-settings small {
    display: block;
  }
  .goal-mode-settings strong {
    font-size: 0.8rem;
  }
  .goal-mode-settings small {
    margin-top: 0.12rem;
    color: var(--color-ink-600);
    font-size: 0.66rem;
    line-height: 1.35;
  }
  .time-mode-settings label {
    display: grid;
    min-height: 3.5rem;
    grid-template-columns: auto auto;
    place-content: center;
    align-items: center;
    gap: 0.15rem 0.35rem;
    border: 1px solid var(--color-line);
    border-radius: 0.3rem;
    cursor: pointer;
  }
  .time-mode-settings input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .time-mode-settings label:focus-within {
    outline: 3px solid var(--color-cobalt-700);
    outline-offset: 2px;
  }
  .time-mode-settings label.selected {
    border-color: var(--color-ink-950);
    background: var(--color-accent-100);
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .time-mode-settings small {
    grid-column: 1 / 3;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.58rem;
    text-align: center;
    text-transform: uppercase;
  }
  .level-field small {
    display: block;
    margin-top: 0.45rem;
    color: var(--color-ink-600);
    font-size: 0.69rem;
    line-height: 1.45;
  }
  .sticky-save {
    position: sticky;
    bottom: calc(4.65rem + var(--safe-bottom));
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem;
    background: color-mix(in srgb, var(--color-paper-50) 95%, transparent);
    padding: 0.75rem;
    box-shadow: 5px 5px 0 var(--color-ink-950);
    backdrop-filter: blur(16px);
  }
  .save-message {
    color: var(--color-mint-700);
    font-size: 0.76rem;
    font-weight: 760;
  }
  .save-message.error {
    color: var(--color-coral-700);
  }
  .save-hint {
    color: var(--color-ink-600);
    font-size: 0.72rem;
  }

  .utility-grid {
    display: grid;
    gap: 1rem;
  }
  .utility-sheet {
    border: 1px solid var(--color-ink-950);
    border-radius: 0.25rem;
    background: var(--color-paper-50);
    padding: 1.2rem;
    box-shadow: 4px 4px 0 var(--color-line);
  }
  .utility-heading {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }
  .utility-heading > :global(svg) {
    color: var(--color-cobalt-700);
  }
  .utility-heading h2 {
    margin-top: 0.12rem;
    font-size: 1rem;
    font-weight: 850;
  }
  .utility-sheet ol {
    display: grid;
    gap: 0.55rem;
    margin-top: 0.9rem;
    color: var(--color-ink-600);
    font-size: 0.76rem;
    line-height: 1.45;
  }
  .utility-sheet li strong {
    color: var(--color-ink-950);
    font-family: var(--font-mono);
  }
  .utility-note,
  .utility-copy {
    margin-top: 0.9rem;
    color: var(--color-ink-600);
    font-size: 0.875rem;
    line-height: 1.5;
  }
  .utility-note {
    border: 1px solid var(--color-acid-500);
    background: white;
    padding: 0.7rem;
  }
  .backup-actions {
    display: grid;
    gap: 0.55rem;
    margin-top: 0.9rem;
  }
  .reset-button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.8rem;
    border-bottom: 1px solid currentColor;
    color: var(--color-coral-700);
    min-height: 44px;
    font-size: 0.875rem;
    font-weight: 760;
  }
  .reset-button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .encrypted-backup,
  .restore-preview,
  .storage-status,
  .reset-confirmation {
    display: grid;
    gap: 0.75rem;
    margin-top: 1rem;
    border: 1px solid var(--color-cobalt-700);
    background: rgb(255 255 255 / 0.72);
    padding: 0.9rem;
  }
  .encrypted-backup h3,
  .restore-preview h3,
  .storage-status h3,
  .reset-confirmation h3 {
    font-size: 1rem;
    font-weight: 850;
  }
  .encrypted-backup p,
  .restore-preview p,
  .storage-status p,
  .reset-confirmation p {
    color: var(--color-ink-600);
    font-size: 0.875rem;
    line-height: 1.5;
  }
  .passphrase-grid,
  .reset-confirmation {
    display: grid;
    gap: 0.5rem;
  }
  .passphrase-grid label,
  .restore-preview label,
  .reset-confirmation label {
    color: var(--color-ink-700);
    font-size: 0.8rem;
    font-weight: 750;
  }
  .passphrase-grid input,
  .restore-preview input,
  .reset-confirmation input {
    min-height: 44px;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.35rem;
    background: var(--color-paper-50);
    padding: 0.65rem 0.75rem;
    font-size: 1rem;
  }
  .restore-preview dl {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
  }
  .restore-preview dl div {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    border-bottom: 1px solid rgb(25 31 36 / 0.14);
    padding-bottom: 0.3rem;
    font-size: 0.875rem;
  }
  .restore-preview dd {
    font-family: var(--font-mono);
    font-weight: 800;
  }
  .confirmation-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }
  .undo-button {
    margin-top: 0.8rem;
    width: 100%;
  }
  .restore-message {
    margin-top: 0.8rem;
    border: 1px solid var(--color-mint-700);
    color: var(--color-mint-700);
    background: white;
    padding: 0.7rem;
    font-size: 0.875rem;
    font-weight: 700;
  }
  .restore-message.error {
    border-color: var(--color-coral-700);
    color: var(--color-coral-700);
  }
  .key-note {
    margin-top: 0.8rem;
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  @media (hover: hover) and (pointer: fine) {
    .preset-row button:hover,
    .exercise-grid > button:hover {
      border-color: var(--color-ink-950);
    }
  }
  @media (min-width: 640px) {
    .sheet-content {
      padding: 1.5rem;
    }
    .preset-row {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .exercise-grid,
    .plan-grid,
    .toggle-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .accent-option {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }
    .accent-option input {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .backup-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (min-width: 1024px) {
    .sticky-save {
      bottom: 1rem;
    }
    .utility-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 600px) {
    .language-heading {
      display: grid;
    }
    .language-heading > span {
      width: fit-content;
    }
    .language-options {
      grid-template-columns: 1fr;
    }
    .sticky-save {
      align-items: stretch;
      flex-direction: column;
    }
    .sticky-save .btn-base {
      width: 100%;
    }
  }
</style>
