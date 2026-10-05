<script lang="ts">
  let { code, ondone }: { code: string; ondone?: () => void } = $props();
  let message = $state('');
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      message = 'Obnovovací kód je zkopírovaný.';
    } catch {
      message = 'Kód můžeš označit a zkopírovat ručně.';
    }
  }
</script>

<section class="recovery-code" aria-labelledby="recovery-code-title">
  <h2 id="recovery-code-title">Ulož si obnovovací kód</h2>
  <p>
    Pomůže ti při ztrátě passkey. Ulož ho do správce hesel nebo na bezpečné místo. Tento kód
    zobrazíme jen teď; můžeš ho použít jednou.
  </p>
  <label for="recovery-secret">Tvůj obnovovací kód</label>
  <textarea
    id="recovery-secret"
    class="field"
    rows="2"
    readonly
    value={code}
    spellcheck="false"
    autocomplete="off"></textarea>
  <div class="actions">
    <button class="btn-base btn-secondary" onclick={copy}>Kopírovat kód</button>
    {#if ondone}<button class="btn-base btn-primary" onclick={ondone}>Pokračovat</button>{/if}
  </div>
  {#if message}<p role="status">{message}</p>{/if}
</section>

<style>
  .recovery-code {
    display: grid;
    gap: 1rem;
  }
  h2 {
    font-size: 1.25rem;
    font-weight: 750;
  }
  p {
    color: var(--color-ink-600);
    line-height: 1.6;
  }
  textarea {
    width: 100%;
    resize: none;
    overflow-wrap: anywhere;
    font-family: monospace;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
</style>
