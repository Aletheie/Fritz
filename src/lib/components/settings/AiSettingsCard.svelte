<script lang="ts">
  import { connectAi, disconnectAi, getAiKeyStatus, migrateAiConnection } from '$lib/client/ai.ts';
  import { errorText } from '$lib/domain/errors.ts';
  import { motherTongue, tr } from '$lib/state/app';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import KeyRound from '@lucide/svelte/icons/key-round';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import { onMount } from 'svelte';

  import type { AiOutputMode, UserAiProvider } from '$lib/domain/ai/connection.ts';
  import type { AiKeyStatus } from '$lib/domain/ai/types.ts';

  const presets = [
    { id: 'gemini', label: 'Google Gemini', provider: 'google-gemini', baseURL: '' },
    { id: 'anthropic', label: 'Anthropic Claude', provider: 'anthropic', baseURL: '' },
    {
      id: 'openai',
      label: 'OpenAI',
      provider: 'openai-compatible',
      baseURL: 'https://api.openai.com/v1',
    },
    {
      id: 'openrouter',
      label: 'OpenRouter',
      provider: 'openai-compatible',
      baseURL: 'https://openrouter.ai/api/v1',
    },
    {
      id: 'local',
      label: 'Ollama / LM Studio',
      provider: 'openai-compatible',
      baseURL: 'http://localhost:11434/v1',
    },
    { id: 'custom', label: 'OpenAI-compatible API', provider: 'openai-compatible', baseURL: '' },
  ] as const;

  let status = $state<AiKeyStatus | undefined>();
  let loading = $state(true);
  let busy = $state(false);
  let error = $state('');
  let message = $state('');
  let preset = $state('gemini');
  let apiKey = $state('');
  let model = $state('');
  let baseURL = $state('');
  let outputMode = $state<AiOutputMode>('json');
  let consent = $state(false);
  let controller: AbortController | undefined;
  const selected = $derived(presets.find((item) => item.id === preset) ?? presets[0]);
  const compatible = $derived(selected.provider === 'openai-compatible');
  const local = $derived(
    compatible && /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\//u.test(baseURL),
  );

  async function refresh() {
    loading = true;
    error = '';
    try {
      status = await getAiKeyStatus();
    } catch {
      error = $tr(
        'Stav AI se nepodařilo načíst. Zkus to znovu.',
        'Could not load AI status. Try again.',
      );
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void refresh();
    return () => controller?.abort();
  });

  function choosePreset(event: Event) {
    preset = (event.currentTarget as HTMLSelectElement).value;
    baseURL = presets.find((item) => item.id === preset)?.baseURL ?? '';
    model = '';
    apiKey = '';
    consent = false;
    message = '';
    error = '';
    outputMode = preset === 'openai' ? 'schema' : 'json';
  }

  async function connect(event: SubmitEvent) {
    event.preventDefault();
    if (busy || !consent) return;
    busy = true;
    error = '';
    message = '';
    controller = new AbortController();
    try {
      status = await connectAi(
        {
          provider: selected.provider as UserAiProvider,
          apiKey: apiKey.trim(),
          model: model.trim(),
          ...(compatible ? { baseURL: baseURL.trim(), outputMode } : {}),
        },
        controller.signal,
      );
      apiKey = '';
      consent = false;
      message = $tr(
        'Připojení i formát odpovědi jsou ověřené. AI je připravené.',
        'Connection and response format verified. AI is ready.',
      );
    } catch (value) {
      error = errorText(value, $motherTongue, {
        cs: 'Připojení se nezdařilo.',
        en: 'Connection failed.',
      });
    } finally {
      busy = false;
    }
  }

  async function disconnect() {
    busy = true;
    error = '';
    message = '';
    try {
      status = await disconnectAi();
      apiKey = '';
      message = $tr('Vlastní připojení je odstraněné.', 'Your connection has been removed.');
    } catch (value) {
      error = errorText(value, $motherTongue, {
        cs: 'Odpojení se nezdařilo.',
        en: 'Could not disconnect.',
      });
    } finally {
      busy = false;
    }
  }

  async function migrate() {
    busy = true;
    error = '';
    try {
      status = await migrateAiConnection();
      message = $tr(
        'AI připojení je uložené pro tuto osobní instalaci.',
        'AI connection saved for this personal installation.',
      );
    } catch (value) {
      error = errorText(value, $motherTongue, {
        cs: 'Připojení se nepodařilo přesunout.',
        en: 'Could not migrate the connection.',
      });
    } finally {
      busy = false;
    }
  }

  const introText = 'mt-[1.1rem] text-[0.9rem] leading-[1.65] text-ink-600';
  const statusBlock =
    'mb-5 grid justify-items-start gap-[0.65rem] border-b border-line pb-5 [overflow-wrap:anywhere] [&_p]:text-[0.85rem] [&_p]:text-ink-600';
  const label = 'mt-[0.55rem] text-[0.85rem] font-bold';
  const field = 'field min-h-12 w-full min-w-0';
  const help = 'text-[0.8rem] leading-normal text-ink-600';
  const chevron = 'pointer-events-none absolute top-1/2 right-4 -translate-y-1/2';
</script>

<section id="ai" class="surface scroll-mt-24" aria-labelledby="ai-settings-heading">
  <div class="grid min-[80rem]:grid-cols-[0.84fr_1.16fr]">
    <div
      class="min-w-0 border-b border-line p-6 min-[80rem]:border-r min-[80rem]:border-b-0 min-[80rem]:p-7"
    >
      <div class="flex items-center gap-3">
        <KeyRound size={23} aria-hidden="true" />
        <h2 class="text-[1.2rem] font-extrabold tracking-[-0.025em]" id="ai-settings-heading">
          {$tr('Tvoje AI připojení', 'Your AI connection')}
        </h2>
      </div>
      <p class={introText}>
        {$tr(
          'Vyber si službu a model pro konverzace, vysvětlení a vlastní slovíčka. Bez připojení zůstává k dispozici ukázkový trenér.',
          'Choose a service and model for conversations, explanations and your own vocabulary. The demo trainer stays available without a connection.',
        )}
      </p>
      <p class={introText}>
        {$tr(
          'Potřebuješ API klíč od poskytovatele. Běžné předplatné chatovací aplikace nemusí zahrnovat přístup k API. Test odešle krátký zkušební dotaz a může spotřebovat malou část API kreditu.',
          'You need an API key from your provider. A chat app subscription may not include API access. Testing sends a short request and may use a small amount of API credit.',
        )}
      </p>
      <p class="{introText} border-t border-line pt-4">
        {$tr(
          'Klíč se uloží šifrovaně v této osobní instalaci a mohou ho používat tvoje přihlášená zařízení. Zůstává uložený i po odhlášení. Odstraníš ho volbou Odpojit vlastní AI. Není součástí studijních záloh.',
          'Your key is encrypted in this personal installation and available to your signed-in devices. Signing out keeps it saved. Disconnect my AI removes it. Keys are not included in learning backups.',
        )}
      </p>
    </div>

    <div class="min-w-0 p-6 min-[80rem]:p-7">
      {#if loading}
        <p role="status">{$tr('Načítám nastavení AI…', 'Loading AI settings…')}</p>
      {:else if !status}
        <button class="btn-base btn-secondary" onclick={refresh}
          >{$tr('Zkusit znovu', 'Try again')}</button
        >
      {:else}
        {#if status.legacyMigrationAvailable}
          <div class={statusBlock}>
            <strong>{$tr('Pamatovat AI připojení', 'Remember your AI connection')}</strong>
            <p>
              {$tr(
                'Tvoje dosavadní připojení je stále jen v tomto prohlížeči a vyprší po 30 dnech. Můžeš ho přesunout do osobní instalace a zpřístupnit i dalším přihlášeným zařízením.',
                'Your existing connection is still limited to this browser and expires after 30 days. You can move it to this personal installation for your other signed-in devices.',
              )}
            </p>
            <button class="btn-base btn-secondary" disabled={busy} onclick={migrate}
              >{$tr('Uložit pro tuto instalaci', 'Save for this installation')}</button
            >
          </div>
        {/if}
        <div class={statusBlock}>
          <strong
            >{status.source === 'user'
              ? $tr('Tvoje připojení', 'Your connection')
              : status.configured
                ? $tr('Připojení správce', 'App connection')
                : $tr('Ukázkový trenér', 'Demo trainer')}</strong
          >
          <p>
            {status.configured
              ? `${status.dataRecipient} · ${status.model}`
              : $tr('Žádná data se neposílají externí AI.', 'No data is sent to an external AI.')}
          </p>
          {#if status.userConnectionNeedsAttention}
            <p role="status">
              {$tr(
                'Vlastní připojení je nedostupné. Připoj ho znovu; zatím se používá ukázkový trenér.',
                'Your connection is unavailable. Connect again; the demo trainer is active in the meantime.',
              )}
            </p>
          {/if}
          {#if status.source === 'user' || status.userConnectionNeedsAttention}
            <button class="btn-base btn-secondary" disabled={busy} onclick={disconnect}
              >{$tr('Odpojit vlastní AI', 'Disconnect my AI')}</button
            >
            <p class={help}>
              {$tr(
                'Odpojení odstraní klíč pro celou instalaci a zapne ukázkový režim.',
                'Disconnecting removes the key for the entire installation and enables demo mode.',
              )}
            </p>
          {/if}
        </div>

        {#if status.canStoreUserKey}
          <form onsubmit={connect}>
            <fieldset class="grid min-w-0 gap-2" disabled={busy}>
              <legend class="mb-4 font-extrabold"
                >{status.source === 'user'
                  ? $tr('Změnit připojení', 'Change connection')
                  : $tr('Připojit vlastní AI', 'Connect your AI')}</legend
              >
              <label class={label} for="ai-provider">{$tr('Poskytovatel', 'Provider')}</label>
              <div class="relative min-w-0">
                <select
                  class="{field} appearance-none pr-10"
                  id="ai-provider"
                  bind:value={preset}
                  onchange={choosePreset}
                >
                  {#each presets as item (item.id)}
                    <option
                      value={item.id}
                      disabled={item.id === 'local' && !status.localProvidersAllowed}
                      >{item.label}</option
                    >
                  {/each}
                </select>
                <ChevronDown class={chevron} size={17} aria-hidden="true" />
              </div>
              {#if compatible}
                <label class={label} for="ai-base-url"
                  >{$tr('Základní adresa API', 'API base URL')}</label
                >
                <input
                  class={field}
                  id="ai-base-url"
                  type="url"
                  required
                  bind:value={baseURL}
                  placeholder={selected.baseURL || 'https://example.com/v1'}
                  spellcheck="false"
                  autocapitalize="off"
                  aria-describedby="ai-endpoint-help"
                />
                <p id="ai-endpoint-help" class={help}>
                  {$tr(
                    'Vlož adresu před /chat/completions. Ollama obvykle používá port 11434, LM Studio 1234. localhost označuje počítač, na kterém běží server Fritz.',
                    'Enter the address before /chat/completions. Ollama usually uses port 11434, LM Studio 1234. localhost means the computer running the Fritz server.',
                  )}
                </p>
              {/if}
              <label class={label} for="ai-model">{$tr('ID modelu', 'Model ID')}</label>
              <input
                class={field}
                id="ai-model"
                required
                maxlength="200"
                bind:value={model}
                placeholder={$tr(
                  'Zkopíruj z nabídky svého poskytovatele',
                  'Copy from your provider’s model list',
                )}
                spellcheck="false"
                autocapitalize="off"
              />
              <label class={label} for="ai-api-key"
                >{$tr('API klíč', 'API key')}{local
                  ? $tr(' (volitelný)', ' (optional)')
                  : ''}</label
              >
              <input
                class={field}
                id="ai-api-key"
                type="password"
                required={!local}
                maxlength="512"
                bind:value={apiKey}
                autocomplete="off"
                spellcheck="false"
                autocapitalize="off"
                aria-describedby="ai-key-help"
              />
              <p id="ai-key-help" class={help}>
                {$tr(
                  'Při změně připojení vlož klíč znovu. Uložený klíč nikdy nevracíme do formuláře.',
                  'Enter your key again when changing connections. A saved key is never returned to this form.',
                )}
              </p>
              {#if compatible}
                <label class={label} for="ai-output-mode"
                  >{$tr('Formát odpovědi', 'Response format')}</label
                >
                <div class="relative min-w-0">
                  <select
                    class="{field} appearance-none pr-10"
                    id="ai-output-mode"
                    bind:value={outputMode}
                  >
                    <option value="json"
                      >{$tr('JSON — široká kompatibilita', 'JSON — broad compatibility')}</option
                    >
                    <option value="schema"
                      >{$tr(
                        'JSON Schema — přesná struktura',
                        'JSON Schema — strict structure',
                      )}</option
                    >
                    <option value="text"
                      >{$tr(
                        'Text s instrukcí JSON — základní modely',
                        'JSON instructions in text — basic models',
                      )}</option
                    >
                  </select>
                  <ChevronDown class={chevron} size={17} aria-hidden="true" />
                </div>
              {/if}
              <label
                class="mt-[0.55rem] flex cursor-pointer items-start gap-[0.7rem] py-2 text-[0.85rem] leading-normal font-medium"
                for="ai-consent"
              >
                <input
                  class="mt-[0.1rem] size-[1.15rem] flex-none"
                  id="ai-consent"
                  type="checkbox"
                  required
                  bind:checked={consent}
                />
                <span
                  >{$tr(
                    'Souhlasím s odesíláním vybraných učebních zadání této službě. Použije se jen moje zvolené připojení, bez přepínání k jinému poskytovateli.',
                    'I agree to send selected learning prompts to this service. Only my chosen connection will be used, with no fallback to another provider.',
                  )}</span
                >
              </label>
              <button class="btn-base btn-primary" type="submit" disabled={busy || !consent}>
                {#if busy}<LoaderCircle class="animate-spin" size={17} aria-hidden="true" />{/if}
                {busy
                  ? $tr('Ověřuji připojení…', 'Testing connection…')
                  : $tr('Ověřit a připojit', 'Test and connect')}
              </button>
            </fieldset>
          </form>
          {#if !status.localProvidersAllowed}
            <p class="{help} mt-4">
              {$tr(
                'Lokální modely může správce povolit pomocí AI_ALLOW_LOCAL_PROVIDERS=true na serveru.',
                'An administrator can enable local models with AI_ALLOW_LOCAL_PROVIDERS=true on the server.',
              )}
            </p>
          {/if}
        {:else}
          <p>
            {$tr(
              'Vlastní připojení vypnul správce tohoto serveru.',
              'User connections are disabled on this server.',
            )}
          </p>
        {/if}
      {/if}
      {#if error}<p class="mt-4 text-[0.85rem] leading-[1.6] text-coral-700" role="alert">
          {error}
        </p>{/if}
      {#if message}<p class="mt-4 text-[0.85rem] leading-[1.6] text-mint-700" role="status">
          {message}
        </p>{/if}
    </div>
  </div>
</section>
