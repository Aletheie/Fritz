<script lang="ts">
  import {
    loadReminderPreference,
    remindersSupported,
    saveReminderPreference,
    type ReminderPreference,
  } from '$lib/client/reminder.ts';
  import { localized } from '$lib/i18n';
  import BellRing from '@lucide/svelte/icons/bell-ring';
  import { onMount } from 'svelte';

  import ToggleRow from '../ToggleRow.svelte';
  import { utilityCopy, utilitySheet } from './settings-styles.ts';
  import UtilityHeading from './UtilityHeading.svelte';

  import type { MotherTongue } from '$lib/domain/types.ts';

  let { language }: { language: MotherTongue } = $props();

  const copy = (cs: string, en: string) => localized(language, { cs, en });
  let supported = $state(false);
  let preference = $state<ReminderPreference>({ enabled: false, time: '18:00' });
  let permission = $state<NotificationPermission>('default');

  onMount(() => {
    supported = remindersSupported();
    preference = loadReminderPreference();
    if (supported) permission = Notification.permission;
  });

  async function setEnabled(enabled: boolean): Promise<void> {
    if (enabled && permission !== 'granted') {
      permission = await Notification.requestPermission();
      if (permission !== 'granted') enabled = false;
    }
    preference = { ...preference, enabled };
    saveReminderPreference(preference);
  }

  function setTime(time: string): void {
    preference = { ...preference, time };
    saveReminderPreference(preference);
  }
</script>

<section class={utilitySheet} data-testid="reminder-settings">
  <UtilityHeading
    icon={BellRing}
    kicker={copy('zařízení', 'device')}
    title={copy('Denní připomínka', 'Daily reminder')}
  />
  {#if supported}
    <div class="mt-[0.9rem] grid gap-3">
      <div
        onchange={(event) => {
          if (event.target instanceof HTMLInputElement) void setEnabled(event.target.checked);
        }}
      >
        <ToggleRow
          title={copy('Připomenout dnešní lekci', 'Remind me about today’s lesson')}
          description={copy(
            'Jen jednou denně a jen když lekce ještě není hotová.',
            'Once a day, and only when the lesson is not done yet.',
          )}
          checked={preference.enabled}
          disabled={permission === 'denied'}
        />
      </div>
      {#if preference.enabled}
        <label class="grid gap-[0.35rem] text-[0.78rem] font-[760]">
          {copy('Čas připomínky', 'Reminder time')}
          <input
            class="field max-w-[10rem]"
            type="time"
            value={preference.time}
            onchange={(event) => setTime(event.currentTarget.value)}
          />
        </label>
      {/if}
      <p class={utilityCopy}>
        {permission === 'denied'
          ? copy(
              'Oznámení jsou v prohlížeči zablokovaná. Povolit je můžeš v nastavení webu.',
              'Notifications are blocked in this browser. You can allow them in the site settings.',
            )
          : copy(
              'Připomínka přijde, když máš Fritz otevřený nebo nainstalovaný a běží na pozadí. Nastavení platí jen pro toto zařízení.',
              'The reminder arrives while Fritz is open or installed and running in the background. It applies to this device only.',
            )}
      </p>
    </div>
  {:else}
    <p class={utilityCopy}>
      {copy(
        'Tento prohlížeč oznámení nepodporuje. Na iPhonu fungují po instalaci na plochu.',
        'This browser does not support notifications. On iPhone they work after adding Fritz to the Home Screen.',
      )}
    </p>
  {/if}
</section>
