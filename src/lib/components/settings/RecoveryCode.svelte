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

<section class="grid gap-4" aria-labelledby="recovery-code-title">
  <h2 class="text-[1.25rem] font-[750]" id="recovery-code-title">Ulož si obnovovací kód</h2>
  <p class="leading-[1.6] text-ink-600">
    Pomůže ti při ztrátě passkey. Ulož ho do správce hesel nebo na bezpečné místo. Tento kód
    zobrazíme jen teď; můžeš ho použít jednou.
  </p>
  <label for="recovery-secret">Tvůj obnovovací kód</label>
  <textarea
    id="recovery-secret"
    class="field w-full resize-none font-[monospace] [overflow-wrap:anywhere]"
    rows="2"
    readonly
    value={code}
    spellcheck="false"
    autocomplete="off"></textarea>
  <div class="flex flex-wrap gap-3">
    <button class="btn-base btn-secondary" onclick={copy}>Kopírovat kód</button>
    {#if ondone}<button class="btn-base btn-primary" onclick={ondone}>Pokračovat</button>{/if}
  </div>
  {#if message}<p class="leading-[1.6] text-ink-600" role="status">{message}</p>{/if}
</section>
