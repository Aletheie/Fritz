<script lang="ts">
  import { connectAi, disconnectAi, getAiKeyStatus } from '$lib/client/ai.ts';
  import { localized } from '$lib/i18n';
  import { motherTongue } from '$lib/state/app';
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

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  async function refresh() {
    loading = true;
    error = '';
    try {
      status = await getAiKeyStatus();
    } catch {
      error = copy(
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
      message = copy(
        'Připojení i formát odpovědi jsou ověřené. AI je připravené.',
        'Connection and response format verified. AI is ready.',
      );
    } catch (value) {
      error =
        value instanceof Error
          ? value.message
          : copy('Připojení se nezdařilo.', 'Connection failed.');
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
      message = copy('Vlastní připojení je odstraněné.', 'Your connection has been removed.');
    } catch (value) {
      error =
        value instanceof Error
          ? value.message
          : copy('Odpojení se nezdařilo.', 'Could not disconnect.');
    } finally {
      busy = false;
    }
  }
</script>

<section id="ai" class="surface scroll-mt-24" aria-labelledby="ai-settings-heading">
  <div class="ai-layout">
    <div class="ai-intro">
      <div class="section-heading">
        <KeyRound size={23} aria-hidden="true" />
        <h2 id="ai-settings-heading">{copy('Tvoje AI připojení', 'Your AI connection')}</h2>
      </div>
      <p>
        {copy(
          'Vyber si službu a model pro konverzace, vysvětlení a vlastní slovíčka. Bez připojení zůstává k dispozici ukázkový trenér.',
          'Choose a service and model for conversations, explanations and your own vocabulary. The demo trainer stays available without a connection.',
        )}
      </p>
      <p>
        {copy(
          'Potřebuješ API klíč od poskytovatele. Běžné předplatné chatovací aplikace nemusí zahrnovat přístup k API. Test odešle krátký zkušební dotaz a může spotřebovat malou část API kreditu.',
          'You need an API key from your provider. A chat app subscription may not include API access. Testing sends a short request and may use a small amount of API credit.',
        )}
      </p>
      <p class="privacy-note">
        {copy(
          'Klíč se uloží na 30 dní v šifrované cookie, kterou JavaScript nemůže číst. Dešifruje ho jen tento server. Klíč není součástí záloh a odhlášením se odstraní.',
          'Your key is stored for 30 days in an encrypted cookie that JavaScript cannot read. Only this server can decrypt it. Keys stay out of backups and are removed when you sign out.',
        )}
      </p>
    </div>

    <div class="ai-controls">
      {#if loading}
        <p role="status">{copy('Načítám nastavení AI…', 'Loading AI settings…')}</p>
      {:else if !status}
        <button class="btn-base btn-secondary" onclick={refresh}
          >{copy('Zkusit znovu', 'Try again')}</button
        >
      {:else}
        <div class="connection-status">
          <strong
            >{status.source === 'user'
              ? copy('Tvoje připojení', 'Your connection')
              : status.configured
                ? copy('Připojení správce', 'App connection')
                : copy('Ukázkový trenér', 'Demo trainer')}</strong
          >
          <p>
            {status.configured
              ? `${status.dataRecipient} · ${status.model}`
              : copy('Žádná data se neposílají externí AI.', 'No data is sent to an external AI.')}
          </p>
          {#if status.userConnectionNeedsAttention}
            <p role="status">
              {copy(
                'Vlastní připojení vypršelo nebo je nedostupné. Připoj ho znovu; zatím se používá ukázkový trenér.',
                'Your connection has expired or is unavailable. Connect again; the demo trainer is active in the meantime.',
              )}
            </p>
          {/if}
          {#if status.source === 'user' || status.userConnectionNeedsAttention}
            <button class="btn-base btn-secondary" disabled={busy} onclick={disconnect}
              >{copy('Odpojit vlastní AI', 'Disconnect my AI')}</button
            >
            <p class="field-help">
              {copy(
                'Odpojení obnoví připojení správce, pokud je nastavené; jinak ukázkový režim.',
                'Disconnecting restores the app connection if configured, otherwise demo mode.',
              )}
            </p>
          {/if}
        </div>

        {#if status.canStoreUserKey}
          <form onsubmit={connect} class="connection-form">
            <fieldset disabled={busy}>
              <legend
                >{status.source === 'user'
                  ? copy('Změnit připojení', 'Change connection')
                  : copy('Připojit vlastní AI', 'Connect your AI')}</legend
              >
              <label for="ai-provider">{copy('Poskytovatel', 'Provider')}</label>
              <div class="select-field">
                <select class="field" id="ai-provider" bind:value={preset} onchange={choosePreset}>
                  {#each presets as item}
                    <option
                      value={item.id}
                      disabled={item.id === 'local' && !status.localProvidersAllowed}
                      >{item.label}</option
                    >
                  {/each}
                </select>
                <ChevronDown size={17} aria-hidden="true" />
              </div>
              {#if compatible}
                <label for="ai-base-url">{copy('Základní adresa API', 'API base URL')}</label>
                <input
                  class="field"
                  id="ai-base-url"
                  type="url"
                  required
                  bind:value={baseURL}
                  placeholder={selected.baseURL || 'https://example.com/v1'}
                  spellcheck="false"
                  autocapitalize="off"
                  aria-describedby="ai-endpoint-help"
                />
                <p id="ai-endpoint-help" class="field-help">
                  {copy(
                    'Vlož adresu před /chat/completions. Ollama obvykle používá port 11434, LM Studio 1234. localhost označuje počítač, na kterém běží server Fritz.',
                    'Enter the address before /chat/completions. Ollama usually uses port 11434, LM Studio 1234. localhost means the computer running the Fritz server.',
                  )}
                </p>
              {/if}
              <label for="ai-model">{copy('ID modelu', 'Model ID')}</label>
              <input
                class="field"
                id="ai-model"
                required
                maxlength="200"
                bind:value={model}
                placeholder={copy(
                  'Zkopíruj z nabídky svého poskytovatele',
                  'Copy from your provider’s model list',
                )}
                spellcheck="false"
                autocapitalize="off"
              />
              <label for="ai-api-key"
                >{copy('API klíč', 'API key')}{local
                  ? copy(' (volitelný)', ' (optional)')
                  : ''}</label
              >
              <input
                class="field"
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
              <p id="ai-key-help" class="field-help">
                {copy(
                  'Při změně připojení vlož klíč znovu. Uložený klíč nikdy nevracíme do formuláře.',
                  'Enter your key again when changing connections. A saved key is never returned to this form.',
                )}
              </p>
              {#if compatible}
                <label for="ai-output-mode">{copy('Formát odpovědi', 'Response format')}</label>
                <div class="select-field">
                  <select class="field" id="ai-output-mode" bind:value={outputMode}>
                    <option value="json"
                      >{copy('JSON — široká kompatibilita', 'JSON — broad compatibility')}</option
                    >
                    <option value="schema"
                      >{copy(
                        'JSON Schema — přesná struktura',
                        'JSON Schema — strict structure',
                      )}</option
                    >
                    <option value="text"
                      >{copy(
                        'Text s instrukcí JSON — základní modely',
                        'JSON instructions in text — basic models',
                      )}</option
                    >
                  </select>
                  <ChevronDown size={17} aria-hidden="true" />
                </div>
              {/if}
              <label class="consent" for="ai-consent">
                <input id="ai-consent" type="checkbox" required bind:checked={consent} />
                <span
                  >{copy(
                    'Souhlasím s odesíláním vybraných učebních zadání této službě. Použije se jen moje zvolené připojení, bez přepínání k jinému poskytovateli.',
                    'I agree to send selected learning prompts to this service. Only my chosen connection will be used, with no fallback to another provider.',
                  )}</span
                >
              </label>
              <button class="btn-base btn-primary" type="submit" disabled={busy || !consent}>
                {#if busy}<LoaderCircle class="spin" size={17} aria-hidden="true" />{/if}
                {busy
                  ? copy('Ověřuji připojení…', 'Testing connection…')
                  : copy('Ověřit a připojit', 'Test and connect')}
              </button>
            </fieldset>
          </form>
          {#if !status.localProvidersAllowed}
            <p class="field-help mt-4">
              {copy(
                'Lokální modely může správce povolit pomocí AI_ALLOW_LOCAL_PROVIDERS=true na serveru.',
                'An administrator can enable local models with AI_ALLOW_LOCAL_PROVIDERS=true on the server.',
              )}
            </p>
          {/if}
        {:else}
          <p>
            {copy(
              'Vlastní připojení vypnul správce tohoto serveru.',
              'User connections are disabled on this server.',
            )}
          </p>
        {/if}
      {/if}
      {#if error}<p class="feedback error" role="alert">{error}</p>{/if}
      {#if message}<p class="feedback success" role="status">{message}</p>{/if}
    </div>
  </div>
</section>

<style>
  .ai-layout {
    display: grid;
  }
  .ai-intro,
  .ai-controls {
    min-width: 0;
    padding: 1.5rem;
  }
  .ai-intro {
    border-bottom: 1px solid var(--color-line);
  }
  .section-heading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  h2 {
    font-size: 1.2rem;
    font-weight: 800;
    letter-spacing: -0.025em;
  }
  .ai-intro p {
    margin-top: 1.1rem;
    font-size: 0.9rem;
    line-height: 1.65;
    color: var(--color-ink-600);
  }
  .ai-intro .privacy-note {
    padding-top: 1rem;
    border-top: 1px solid var(--color-line);
  }
  .connection-status {
    display: grid;
    justify-items: start;
    gap: 0.65rem;
    padding-bottom: 1.25rem;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--color-line);
    overflow-wrap: anywhere;
  }
  .connection-status p {
    font-size: 0.85rem;
    color: var(--color-ink-600);
  }
  fieldset {
    min-width: 0;
    display: grid;
    gap: 0.5rem;
  }
  legend {
    margin-bottom: 1rem;
    font-weight: 800;
  }
  label {
    margin-top: 0.55rem;
    font-size: 0.85rem;
    font-weight: 700;
  }
  .field {
    min-width: 0;
    width: 100%;
    min-height: 3rem;
  }
  .select-field {
    position: relative;
    min-width: 0;
  }
  .select-field select {
    appearance: none;
    padding-right: 2.5rem;
  }
  .select-field :global(svg) {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
  }
  .field-help {
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--color-ink-600);
  }
  .consent {
    display: flex;
    gap: 0.7rem;
    align-items: flex-start;
    padding: 0.5rem 0;
    font-weight: 500;
    line-height: 1.5;
    cursor: pointer;
  }
  .consent input {
    flex: none;
    width: 1.15rem;
    height: 1.15rem;
    margin-top: 0.1rem;
  }
  .feedback {
    margin-top: 1rem;
    font-size: 0.85rem;
    line-height: 1.6;
  }
  .error {
    color: var(--color-coral-700);
  }
  .success {
    color: var(--color-mint-700);
  }
  @media (min-width: 80rem) {
    .ai-layout {
      grid-template-columns: 0.84fr 1.16fr;
    }
    .ai-intro {
      border-bottom: 0;
      border-right: 1px solid var(--color-line);
    }
    .ai-intro,
    .ai-controls {
      padding: 1.75rem;
    }
  }
</style>
