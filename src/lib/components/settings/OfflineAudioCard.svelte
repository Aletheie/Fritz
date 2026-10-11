<script lang="ts">
  import {
    clearDownloadedLearningAudio,
    downloadLearningAudio,
  } from '$lib/client/learning-audio.ts';
  import { errorText } from '$lib/domain/errors.ts';
  import { localized } from '$lib/i18n';
  import Download from '@lucide/svelte/icons/download';
  import Headphones from '@lucide/svelte/icons/headphones';
  import Trash2 from '@lucide/svelte/icons/trash-2';

  import { statusMessage, utilityActions, utilityCopy, utilitySheet } from './settings-styles.ts';
  import UtilityHeading from './UtilityHeading.svelte';

  import type { MotherTongue } from '$lib/domain/types.ts';

  let {
    language,
    onstoragechange,
  }: {
    language: MotherTongue;
    /** Downloads change storage usage. */ onstoragechange: () => void;
  } = $props();

  let busy = $state(false);
  let message = $state('');
  let error = $state(false);

  const copy = (cs: string, en: string) => localized(language, { cs, en });

  async function run(task: () => Promise<string>, failure: string): Promise<void> {
    busy = true;
    message = '';
    error = false;
    try {
      message = await task();
      onstoragechange();
    } catch (cause) {
      error = true;
      message = errorText(cause, language, { cs: failure, en: failure });
    } finally {
      busy = false;
    }
  }

  function download(): Promise<void> {
    return run(
      async () => {
        const result = await downloadLearningAudio();
        return result.downloaded > 0
          ? copy(
              `Staženo ${result.downloaded} nahrávek pro offline poslech.${result.unavailable ? ` ${result.unavailable} se nepodařilo stáhnout.` : ''}`,
              `Downloaded ${result.downloaded} recordings for offline listening.${result.unavailable ? ` ${result.unavailable} could not be downloaded.` : ''}`,
            )
          : copy(
              'K těmto lekcím zatím nejsou nahrávky. Věty přečte německý hlas zařízení.',
              'These lessons don’t have recordings yet. Your device’s German voice will read the sentences.',
            );
      },
      copy('Audio se nepodařilo stáhnout.', 'Audio could not be downloaded.'),
    );
  }

  function clear(): Promise<void> {
    return run(
      async () =>
        (await clearDownloadedLearningAudio())
          ? copy('Stažené nahrávky byly odstraněny.', 'Downloaded recordings were removed.')
          : copy('Žádné stažené nahrávky tu nejsou.', 'There are no downloaded recordings.'),
      copy('Stažené nahrávky se nepodařilo smazat.', 'Downloaded recordings could not be deleted.'),
    );
  }
</script>

<section class={utilitySheet} aria-labelledby="audio-download-title">
  <UtilityHeading
    icon={Headphones}
    id="audio-download-title"
    kicker={copy('poslech', 'listening')}
    title={copy('Audio pro offline lekce', 'Audio for offline lessons')}
  />
  <p class={utilityCopy}>
    {copy(
      'Pokud je k větě nahrávka, přehraje se. Jinak ji přečte německý hlas zařízení. Rozpoznání řeči zajišťuje prohlížeč. Fritz tvoje nahrávky neukládá.',
      'Fritz plays a recording when one is available. Otherwise, your device’s German voice reads the sentence. The browser handles speech recognition. Fritz does not store your recordings.',
    )}
  </p>
  <div class={utilityActions}>
    <button class="btn-base btn-primary" type="button" disabled={busy} onclick={download}>
      <Download size={18} aria-hidden="true" />
      {busy
        ? copy('Pracuji…', 'Working…')
        : copy('Stáhnout dostupné audio', 'Download available audio')}
    </button>
    <button class="btn-base btn-secondary" type="button" disabled={busy} onclick={clear}>
      <Trash2 size={18} aria-hidden="true" />
      {copy('Smazat stažené nahrávky', 'Delete downloaded recordings')}
    </button>
  </div>
  {#if message}
    <p class={statusMessage(error)} aria-live={error ? 'assertive' : 'polite'}>{message}</p>
  {/if}
</section>
