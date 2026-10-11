<script lang="ts">
  import { isEncryptedBackup } from '$lib/domain/backup/encrypted.ts';
  import { createBackupFile, MAX_BACKUP_FILE_BYTES } from '$lib/domain/backup/file.ts';
  import { errorText } from '$lib/domain/errors.ts';
  import { localized } from '$lib/i18n';
  import { appStore } from '$lib/state/app';
  import DatabaseBackup from '@lucide/svelte/icons/database-backup';
  import Download from '@lucide/svelte/icons/download';
  import FileUp from '@lucide/svelte/icons/file-up';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import { onMount } from 'svelte';

  import { statusMessage, utilityActions, utilityCopy, utilitySheet } from './settings-styles.ts';
  import UtilityHeading from './UtilityHeading.svelte';

  import type { BackupPreview } from '$lib/domain/backup/encrypted.ts';
  import type { AppBackup, MotherTongue } from '$lib/domain/types.ts';

  let {
    language,
    onreplaced,
  }: {
    language: MotherTongue;
    /** Local data was restored, reset or rolled back; the form should re-read settings. */
    onreplaced: () => void;
  } = $props();

  let backupInput = $state<HTMLInputElement>();
  let message = $state('');
  let error = $state(false);
  let restoring = $state(false);
  let encrypting = $state(false);
  let backupPassphrase = $state('');
  let backupPassphraseConfirmation = $state('');
  let restorePassphrase = $state('');
  let pendingValue = $state.raw<unknown>(undefined);
  let pendingName = '';
  let pendingRestore = $state.raw<{ backup: AppBackup; preview: BackupPreview }>();
  let resetVisible = $state(false);
  let resetText = $state('');
  let storageSupported = $state(false);
  let storagePersistent = $state<boolean>();
  let storageUsage = $state<number>();
  let storageQuota = $state<number>();
  let rollbackAvailable = $state(appStore.rollbackIsAvailable());

  const copy = (cs: string, en: string) => localized(language, { cs, en });
  const resetWord = $derived(language === 'en' ? 'DELETE' : 'SMAZAT');
  const panel = 'mt-4 grid gap-3 border border-cobalt-700 bg-white/72 p-[0.9rem]';
  const panelTitle = 'text-[1rem] font-[850]';
  const panelText = 'text-[0.875rem] leading-normal text-ink-600';
  const fieldLabel = 'text-[0.8rem] font-[750] text-ink-700';
  const field =
    'min-h-11 rounded-[0.35rem] border border-ink-950 bg-paper-50 px-3 py-[0.65rem] text-[1rem]';
  const resetButton =
    'mt-[0.8rem] inline-flex min-h-11 items-center gap-[0.4rem] border-b border-current text-[0.875rem] font-[760] text-coral-700 disabled:cursor-not-allowed disabled:opacity-50';
  const keyNote = 'mt-[0.8rem] font-mono text-ink-600';

  onMount(() => void refreshStorage());

  /** Re-reads storage usage; the audio card calls this after downloads. */
  export async function refreshStorage(): Promise<void> {
    storageSupported = Boolean(navigator.storage);
    if (!navigator.storage) return;
    storagePersistent = navigator.storage.persisted
      ? await navigator.storage.persisted()
      : undefined;
    const estimate = navigator.storage.estimate ? await navigator.storage.estimate() : undefined;
    storageUsage = estimate?.usage;
    storageQuota = estimate?.quota;
  }

  function report(text: string, failed = false): void {
    message = text;
    error = failed;
    rollbackAvailable = appStore.rollbackIsAvailable();
  }

  function failure(cause: unknown, fallback: string): void {
    report(errorText(cause, language, { cs: fallback, en: fallback }), true);
  }

  function humanBytes(value: number | undefined): string {
    if (value === undefined) return copy('nezjištěno', 'unknown');
    if (value < 1024) return `${value} B`;
    if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} kB`;
    return `${(value / 1024 ** 2).toFixed(1)} MB`;
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

  const today = () => new Date().toISOString().slice(0, 10);

  async function downloadBackup(): Promise<void> {
    report('');
    try {
      downloadJson(createBackupFile(await appStore.backup()), `fritz-backup-${today()}.json`);
      report(
        copy(
          'Nešifrovaná záloha byla připravena. Ulož ji na bezpečné místo.',
          'The unencrypted backup is ready. Store it somewhere safe.',
        ),
      );
    } catch (cause) {
      failure(cause, copy('Zálohu se nepodařilo vytvořit.', 'The backup could not be created.'));
    }
  }

  async function downloadEncryptedBackup(): Promise<void> {
    report('');
    if (backupPassphrase !== backupPassphraseConfirmation) {
      report(
        copy(
          'Hesla šifrované zálohy se neshodují.',
          'The encrypted-backup passphrases do not match.',
        ),
        true,
      );
      return;
    }
    encrypting = true;
    try {
      const envelope = await appStore.encryptedBackup(backupPassphrase);
      downloadJson(createBackupFile(envelope), `fritz-backup-encrypted-${today()}.json`);
      backupPassphrase = '';
      backupPassphraseConfirmation = '';
      report(
        copy(
          'Šifrovaná záloha byla připravena. Heslo nelze obnovit.',
          'The encrypted backup is ready. The passphrase cannot be recovered.',
        ),
      );
    } catch (cause) {
      failure(
        cause,
        copy(
          'Šifrovanou zálohu se nepodařilo vytvořit.',
          'The encrypted backup could not be created.',
        ),
      );
    } finally {
      encrypting = false;
    }
  }

  async function chooseBackup(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    report('');
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      report(
        copy(
          'Záloha je příliš velká. Limit je 48 MiB.',
          'The backup is too large. The limit is 48 MiB.',
        ),
        true,
      );
      input.value = '';
      return;
    }
    restoring = true;
    try {
      pendingValue = JSON.parse(await file.text());
      pendingName = file.name;
      pendingRestore = undefined;
      restorePassphrase = '';
      if (isEncryptedBackup(pendingValue)) {
        report(
          copy(
            'Záloha je chráněná heslem. Zadej ho pro zobrazení obsahu.',
            'This backup is password-protected. Enter the password to preview it.',
          ),
        );
      } else {
        await preparePreview();
      }
    } catch (cause) {
      failure(cause, copy('Zálohu se nepodařilo načíst.', 'The backup could not be read.'));
    } finally {
      restoring = false;
      input.value = '';
    }
  }

  async function preparePreview(): Promise<void> {
    if (pendingValue === undefined) return;
    restoring = true;
    report('');
    try {
      pendingRestore = await appStore.prepareRestore(pendingValue, restorePassphrase);
      report(
        copy(
          'Zálohu lze načíst. Před obnovením si zkontroluj její obsah.',
          'The backup is ready to load. Check its contents before restoring it.',
        ),
      );
    } catch (cause) {
      pendingRestore = undefined;
      failure(cause, copy('Zálohu se nepodařilo ověřit.', 'The backup could not be verified.'));
    } finally {
      restoring = false;
    }
  }

  async function commitRestore(): Promise<void> {
    if (!pendingRestore) return;
    restoring = true;
    report('');
    try {
      await appStore.restore(pendingRestore.backup);
      onreplaced();
      report(
        copy(
          `Záloha ${pendingName} byla obnovena a ověřena. Předchozí stav lze krátkodobě vrátit.`,
          `Backup ${pendingName} was restored and verified. You can undo the previous state for a short time.`,
        ),
      );
      pendingRestore = undefined;
      pendingValue = undefined;
      restorePassphrase = '';
    } catch (cause) {
      failure(cause, copy('Zálohu se nepodařilo obnovit.', 'The backup could not be restored.'));
    } finally {
      restoring = false;
    }
  }

  async function resetData(): Promise<void> {
    if (resetText !== resetWord) return;
    report('');
    try {
      await appStore.reset();
      onreplaced();
      resetVisible = false;
      resetText = '';
      report(
        copy(
          'Ukázková data byla obnovena. Předchozí stav lze krátkodobě vrátit.',
          'Sample data was restored. You can undo the previous state for a short time.',
        ),
      );
    } catch (cause) {
      failure(cause, copy('Data se nepodařilo resetovat.', 'The data could not be reset.'));
    }
  }

  async function undoDestructiveChange(): Promise<void> {
    error = false;
    try {
      await appStore.undoDestructiveChange();
      onreplaced();
      report(copy('Předchozí data jsou obnovená.', 'Your previous data has been restored.'));
    } catch (cause) {
      failure(
        cause,
        copy('Předchozí stav nelze vrátit.', 'The previous state cannot be restored.'),
      );
    }
  }

  async function requestPersistentStorage(): Promise<void> {
    report('');
    if (!navigator.storage?.persist) {
      report(
        copy(
          'Tento prohlížeč žádost o trvalé úložiště nepodporuje.',
          'This browser does not support persistent-storage requests.',
        ),
        true,
      );
      return;
    }
    storagePersistent = await navigator.storage.persist();
    await refreshStorage();
    report(
      storagePersistent
        ? copy(
            'Prohlížeč povolil ochranu uložených dat před automatickým smazáním. Pro případ ztráty zařízení si dál vytvářej zálohy.',
            'The browser will protect saved data from automatic cleanup. Keep making backups in case you lose the device.',
          )
        : copy(
            'Prohlížeč ochranu před automatickým smazáním nepovolil. Pravidelně si stáhni zálohu.',
            'The browser could not protect your data from automatic cleanup. Download a backup regularly.',
          ),
    );
  }
</script>

<section class={utilitySheet}>
  <UtilityHeading
    icon={DatabaseBackup}
    kicker={copy('data', 'data')}
    title={copy('Záloha a obnova', 'Backup and restore')}
  />
  <p class={utilityCopy}>
    {copy(
      'Slovíčka, historie i vlastní texty zůstávají v tomto prohlížeči. Nešifrovaný JSON je čitelný každému, kdo soubor získá; pro běžné ukládání použij šifrovanou zálohu.',
      'Vocabulary, history, and your own texts stay in this browser. Anyone with an unencrypted JSON file can read it; use an encrypted backup for regular storage.',
    )}
  </p>
  <div class={utilityActions}>
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
      {restoring ? copy('Obnovuji…', 'Restoring…') : copy('Obnovit JSON', 'Restore JSON')}</button
    >
    <input
      class="sr-only"
      bind:this={backupInput}
      type="file"
      aria-label={copy('Vybrat JSON zálohu k obnovení', 'Choose a JSON backup to restore')}
      accept="application/json,.json"
      onchange={chooseBackup}
    />
  </div>
  <div class={panel}>
    <h3 class={panelTitle}>{copy('Šifrovaná záloha', 'Encrypted backup')}</h3>
    <p class={panelText}>
      {copy(
        'Zálohu otevřeš jen s tímto heslem. Fritz ho neukládá a nedokáže ho obnovit.',
        'You’ll need this password to open the backup. Fritz doesn’t store it and can’t recover it.',
      )}
    </p>
    <div class="grid gap-2">
      <label class={fieldLabel} for="backup-passphrase"
        >{copy('Heslo (min. 10 znaků)', 'Passphrase (min. 10 characters)')}</label
      >
      <input
        class={field}
        id="backup-passphrase"
        type="password"
        autocomplete="new-password"
        bind:value={backupPassphrase}
      />
      <label class={fieldLabel} for="backup-passphrase-confirmation"
        >{copy('Heslo znovu', 'Repeat passphrase')}</label
      >
      <input
        class={field}
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

  {#if pendingValue !== undefined && isEncryptedBackup(pendingValue) && !pendingRestore}
    <div class={panel} role="region" aria-labelledby="decrypt-heading">
      <h3 class={panelTitle} id="decrypt-heading">{copy('Odemknout náhled', 'Unlock preview')}</h3>
      <label class={fieldLabel} for="restore-passphrase"
        >{copy('Heslo zálohy', 'Backup passphrase')}</label
      >
      <input
        class={field}
        id="restore-passphrase"
        type="password"
        autocomplete="current-password"
        bind:value={restorePassphrase}
      />
      <button
        class="btn-base btn-secondary"
        type="button"
        disabled={restoring}
        onclick={preparePreview}
        >{copy('Ověřit a zobrazit náhled', 'Verify and show preview')}</button
      >
    </div>
  {/if}

  {#if pendingRestore}
    {@const preview = pendingRestore.preview}
    <div class={panel} role="region" aria-labelledby="restore-preview-heading">
      <h3 class={panelTitle} id="restore-preview-heading">
        {copy('Co záloha nahradí', 'What the backup will replace')}
      </h3>
      <dl
        class="grid grid-cols-2 gap-[0.55rem] [&_dd]:font-mono [&_dd]:font-extrabold [&>div]:flex [&>div]:justify-between [&>div]:gap-2 [&>div]:border-b [&>div]:border-[rgb(25_31_36/0.14)] [&>div]:pb-[0.3rem] [&>div]:text-[0.875rem]"
      >
        {#each [[copy('Balíčky', 'Decks'), preview.decks], [copy('Slovíčka', 'Words'), preview.notes], [copy('Karty', 'Cards'), preview.cards], [copy('Opakování', 'Reviews'), preview.reviews], [copy('Záznamy o učení', 'Learning records'), preview.learningEvidence], [copy('Dokončené aktivity kurzu', 'Path events'), preview.coursePathEvents]] as [label, value]}
          <div>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        {/each}
      </dl>
      <p class={panelText}>
        {copy('Rozdíl proti současnému stavu:', 'Difference from the current state:')}
        {preview.currentDifference?.notes ?? 0}
        {copy('slovíček,', 'words,')}
        {preview.currentDifference?.reviews ?? 0}
        {copy('opakování a', 'reviews and')}
        {preview.currentDifference?.learningEvidence ?? 0}
        {copy(
          'záznamů o učení. Po obnovení můžeš změnu ještě krátce vrátit.',
          'learning records. You can undo the restore for a short time afterward.',
        )}
      </p>
      <div class="flex flex-wrap gap-[0.6rem]">
        <button
          class="btn-base btn-primary"
          type="button"
          disabled={restoring}
          onclick={commitRestore}
          >{copy('Nahradit data touto zálohou', 'Replace data with this backup')}</button
        >
        <button
          class="btn-base btn-secondary"
          type="button"
          onclick={() => {
            pendingRestore = undefined;
            pendingValue = undefined;
            message = '';
          }}>{copy('Zrušit', 'Cancel')}</button
        >
      </div>
    </div>
  {/if}

  <div class={panel}>
    <h3 class={panelTitle}>{copy('Ochrana uložených dat', 'Protect saved data')}</h3>
    <p class={panelText}>
      {storageSupported
        ? copy(
            `${storagePersistent ? 'Ochrana před automatickým smazáním je zapnutá.' : 'Ochrana před automatickým smazáním není potvrzená.'} Využito ${humanBytes(storageUsage)} z přibližně ${humanBytes(storageQuota)}.`,
            `${storagePersistent ? 'Persistent storage is enabled.' : 'Protection from automatic data cleanup isn’t confirmed.'} Using ${humanBytes(storageUsage)} of approximately ${humanBytes(storageQuota)}.`,
          )
        : copy(
            'Tento prohlížeč neumí zobrazit využití úložiště.',
            'This browser can’t report how much storage is available.',
          )}
    </p>
    <button
      class="btn-base btn-secondary"
      type="button"
      disabled={!storageSupported || storagePersistent === true}
      onclick={requestPersistentStorage}
      >{copy('Zapnout ochranu uložených dat', 'Request more durable storage')}</button
    >
    <p class="{keyNote} text-[0.875rem] leading-normal">
      {copy(
        'Při ztrátě zařízení obnovíš data jen ze samostatné zálohy.',
        'If you lose the device, you’ll need a separate backup to recover your data.',
      )}
    </p>
  </div>

  {#if resetVisible}
    <div class="{panel} gap-2" role="region" aria-labelledby="reset-heading">
      <h3 class={panelTitle} id="reset-heading">
        {copy(
          'Trvale nahradit lokální data ukázkou',
          'Permanently replace local data with the sample',
        )}
      </h3>
      <p class={panelText}>
        {copy(
          'Předchozí data půjde krátce obnovit. Pro potvrzení napiš přesně',
          'You’ll be able to restore your previous data for a short time. To confirm, type exactly',
        )} <strong>{resetWord}</strong>.
      </p>
      <label class={fieldLabel} for="reset-confirmation"
        >{copy('Potvrzení resetu', 'Reset confirmation')}</label
      >
      <input class={field} id="reset-confirmation" bind:value={resetText} autocomplete="off" />
      <div class="flex flex-wrap gap-[0.6rem]">
        <button
          class={resetButton}
          type="button"
          disabled={resetText !== resetWord}
          onclick={resetData}><RotateCcw size={16} /> {copy('Resetovat data', 'Reset data')}</button
        >
        <button
          class="btn-base btn-secondary"
          type="button"
          onclick={() => {
            resetVisible = false;
            resetText = '';
          }}>{copy('Zrušit', 'Cancel')}</button
        >
      </div>
    </div>
  {:else}
    <button class={resetButton} type="button" onclick={() => (resetVisible = true)}
      ><RotateCcw size={16} />
      {copy('Smazat data a vrátit ukázku', 'Delete data and restore the sample')}</button
    >
  {/if}
  {#if rollbackAvailable}
    <button
      class="btn-base btn-secondary mt-[0.8rem] w-full"
      type="button"
      onclick={undoDestructiveChange}
      ><RotateCcw size={16} />
      {copy('Vrátit poslední obnovu nebo reset', 'Undo the latest restore or reset')}</button
    >
  {/if}
  {#if message}<p class={statusMessage(error)} aria-live={error ? 'assertive' : 'polite'}>
      {message}
    </p>{/if}
  <p class="{keyNote} text-[0.75rem]">
    {copy(
      'Záloha neobsahuje přihlašovací údaje ani nastavení přístupu k AI.',
      'Backups don’t include sign-in details or AI access settings.',
    )}
  </p>
</section>
