<script lang="ts">
  import LoadingState from '$lib/components/LoadingState.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import { DOUBLE_XP_NEXT_NODE } from '$lib/domain/course/wallet.ts';
  import { languageTag, localized } from '$lib/i18n';
  import { appStore, gameProgress, motherTongue, walletProgress } from '$lib/state/app';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Check from '@lucide/svelte/icons/check';
  import Copy from '@lucide/svelte/icons/copy';
  import Download from '@lucide/svelte/icons/download';
  import Gift from '@lucide/svelte/icons/gift';
  import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
  import Share2 from '@lucide/svelte/icons/share-2';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import Trophy from '@lucide/svelte/icons/trophy';
  import { onMount } from 'svelte';

  let canvas: HTMLCanvasElement | undefined;
  let studentName = '';
  let signedBy = 'Tvoje sestra';
  let rewardText = 'Společná odměna podle tvého výběru';
  let personalMessage = 'Jsem na tebe pyšná. Tohle sis opravdu odmakala.';
  let message = '';
  let failed = false;
  let sharing = false;
  let purchasing = false;
  let shopMessage = '';
  let shopFailed = false;

  function copy(cs: string, en: string): string {
    return localized($motherTongue, { cs, en });
  }

  onMount(async () => {
    await appStore.initialize();
    studentName =
      $appStore.settings?.profileName.trim() || copy('Německá hvězda', 'German superstar');
    signedBy = copy('Tvoje sestra', 'Your sister');
    rewardText = copy('Společná odměna podle tvého výběru', 'A shared reward of your choice');
    personalMessage = copy(
      'Jsem na tebe pyšná. Tohle sis opravdu odmakala.',
      "I'm proud of you. You truly earned this.",
    );
    if ('fonts' in document) await document.fonts.ready;
    drawCertificate();
  });

  $: if (canvas && $appStore.ready) {
    studentName;
    signedBy;
    rewardText;
    personalMessage;
    $motherTongue;
    $gameProgress.totalXp;
    drawCertificate();
  }

  function drawCertificate(): void {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = 1200;
    const height = 1200;
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#fffdf5';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#15191c';
    ctx.lineWidth = 18;
    roundedRect(ctx, 44, 44, width - 88, height - 88, 36);
    ctx.stroke();

    ctx.fillStyle = '#c9ff38';
    roundedRect(ctx, 70, 70, width - 140, 170, 26);
    ctx.fill();

    ctx.strokeStyle = '#15191c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(1035, 155, 150, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(1035, 155, 95, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#15191c';
    ctx.font = '800 26px "Figtree Variable", sans-serif';
    ctx.fillText('FRITZ / MILESTONE 2000', 110, 135);
    ctx.font = '950 62px "Figtree Variable", sans-serif';
    ctx.fillText(copy('ODMĚNA ODEMČENA', 'REWARD UNLOCKED'), 110, 202);

    ctx.font = '800 27px "Figtree Variable", sans-serif';
    ctx.fillStyle = '#687077';
    ctx.fillText(copy('PRO', 'FOR'), 110, 340);

    ctx.fillStyle = '#15191c';
    fitText(
      ctx,
      studentName || copy('Německá hvězda', 'German superstar'),
      980,
      92,
      48,
      110,
      435,
      1.05,
    );

    ctx.fillStyle = '#3153c7';
    ctx.font = '950 176px "Figtree Variable", sans-serif';
    ctx.fillText(formatNumber($gameProgress.totalXp), 102, 635);
    ctx.font = '900 46px "Figtree Variable", sans-serif';
    ctx.fillText('XP', 102, 700);

    ctx.fillStyle = '#15191c';
    ctx.font = '900 42px "Figtree Variable", sans-serif';
    wrapText(
      ctx,
      rewardText || copy('Společná odměna podle tvého výběru', 'A shared reward of your choice'),
      520,
      550,
      520,
      52,
      3,
    );

    ctx.strokeStyle = '#cfc7b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(105, 775);
    ctx.lineTo(1095, 775);
    ctx.stroke();

    ctx.fillStyle = '#30373c';
    ctx.font = '700 33px "Figtree Variable", sans-serif';
    wrapText(
      ctx,
      `“${personalMessage || copy('Jsem na tebe pyšná.', "I'm proud of you.")}”`,
      110,
      850,
      980,
      46,
      3,
    );

    ctx.fillStyle = '#687077';
    ctx.font = '800 22px "Figtree Variable", sans-serif';
    ctx.fillText(copy('PODEPSÁNO', 'SIGNED'), 110, 1040);
    ctx.fillStyle = '#15191c';
    ctx.font = '900 italic 43px "Figtree Variable", sans-serif';
    ctx.fillText(signedBy || copy('Tvoje sestra', 'Your sister'), 110, 1095);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#687077';
    ctx.font = '750 22px "Figtree Variable", sans-serif';
    ctx.fillText(
      new Intl.DateTimeFormat(languageTag($motherTongue), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
      1085,
      1095,
    );
    ctx.textAlign = 'left';
  }

  function roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    const safeRadius = Math.max(0, Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, width, height, safeRadius);
      return;
    }
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
  }

  function fitText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    startSize: number,
    minSize: number,
    x: number,
    y: number,
    lineHeight: number,
  ): void {
    let size = startSize;
    do {
      ctx.font = `950 ${size}px "Figtree Variable", sans-serif`;
      if (ctx.measureText(text).width <= maxWidth || size <= minSize) break;
      size -= 2;
    } while (size >= minSize);
    const words = text.split(/\s+/u);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const visibleLines = lines.slice(0, 2);
    for (const [index, item] of visibleLines.entries()) {
      ctx.fillText(item, x, y + index * size * lineHeight);
    }
  }

  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number,
  ): void {
    const words = text.split(/\s+/u);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const visibleLines = lines.slice(0, maxLines);
    for (const [index, item] of visibleLines.entries()) {
      ctx.fillText(item, x, y + index * lineHeight);
    }
  }

  function formatNumber(value: number): string {
    return Math.max(2000, value).toLocaleString(languageTag($motherTongue));
  }

  function certificateBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!canvas) {
        reject(new Error(copy('Náhled ještě není připravený.', 'The preview is not ready yet.')));
        return;
      }
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else
            reject(
              new Error(copy('Obrázek se nepodařilo vytvořit.', 'The image could not be created.')),
            );
        },
        'image/png',
        0.96,
      );
    });
  }

  async function markClaimed(): Promise<void> {
    if (!$gameProgress.reward.claimed) await appStore.claimReward('xp-2000');
  }

  function saveBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fritz-${copy('odmena', 'reward')}-${slug(studentName)}.png`;
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadCertificate(): Promise<void> {
    if (!$gameProgress.reward.unlocked) return;
    failed = false;
    message = '';
    try {
      const blob = await certificateBlob();
      saveBlob(blob);
      await markClaimed();
      message = copy('Podepsaný obrázek je připravený.', 'Your signed image is ready.');
    } catch (error) {
      failed = true;
      message =
        error instanceof Error && $motherTongue === 'cs'
          ? error.message
          : copy('Obrázek se nepodařilo vytvořit.', 'The image could not be created.');
    }
  }

  async function shareCertificate(): Promise<void> {
    if (!$gameProgress.reward.unlocked || sharing) return;
    sharing = true;
    failed = false;
    message = '';
    try {
      const blob = await certificateBlob();
      const file = new File([blob], `fritz-${copy('odmena', 'reward')}-${slug(studentName)}.png`, {
        type: 'image/png',
      });
      const text = copy(
        `${studentName} právě překonala 2 000 XP v aplikaci Fritz. ${personalMessage}`,
        `${studentName} has just passed 2,000 XP in Fritz. ${personalMessage}`,
      );
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'Fritz · 2 000 XP',
          text,
          files: [file],
        });
        message = copy(
          'Odměna byla předaná do nabídky sdílení.',
          'The reward is ready in the sharing menu.',
        );
      } else {
        saveBlob(blob);
        let copied = false;
        if (navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(text);
            copied = true;
          } catch {
            copied = false;
          }
        }
        message = copied
          ? copy(
              'Přímé sdílení tu není dostupné. Obrázek se stáhl a zpráva je zkopírovaná.',
              'Direct sharing is unavailable. The image was downloaded and the message copied.',
            )
          : copy(
              'Sdílení tu není dostupné. Obrázek se stáhl do zařízení.',
              'Sharing isn’t available here. The image was downloaded to your device.',
            );
      }
      await markClaimed();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      failed = true;
      message =
        error instanceof Error && $motherTongue === 'cs'
          ? error.message
          : copy('Sdílení se nepodařilo.', 'Sharing failed.');
    } finally {
      sharing = false;
    }
  }

  async function buyDoubleXp(): Promise<void> {
    if (purchasing || $walletProgress.activeBoost) return;
    purchasing = true;
    shopMessage = '';
    shopFailed = false;
    try {
      await appStore.purchaseDoubleXp();
      shopMessage = copy(
        'Za první dokončení dalšího kroku kurzu dostaneš dvojnásobné XP.',
        'You’ll earn double XP the first time you finish your next course step.',
      );
    } catch (error) {
      shopFailed = true;
      shopMessage =
        error instanceof Error && $motherTongue === 'cs'
          ? error.message
          : copy(
              'Odměnu se nepodařilo aktivovat. XP zůstala zachovaná.',
              'The reward could not be activated. Your XP balance is unchanged.',
            );
    } finally {
      purchasing = false;
    }
  }

  async function copyMessage(): Promise<void> {
    failed = false;
    try {
      await navigator.clipboard.writeText(
        copy(
          `${studentName} právě překonala 2 000 XP v aplikaci Fritz. ${personalMessage}`,
          `${studentName} has just passed 2,000 XP in Fritz. ${personalMessage}`,
        ),
      );
      message = copy('Zpráva pro odměnu je zkopírovaná.', 'The reward message was copied.');
    } catch {
      failed = true;
      message = copy(
        'Kopírování není v tomto prohlížeči dostupné.',
        'Copying is unavailable in this browser.',
      );
    }
  }

  function slug(value: string): string {
    return (
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/gu, '')
        .toLocaleLowerCase(languageTag($motherTongue))
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-|-$/gu, '') || copy('studentka', 'student')
    );
  }
</script>

<svelte:head>
  <title>{copy('Odměny a obchod · Fritz', 'Rewards and shop · Fritz')}</title>
  <meta
    name="description"
    content={copy(
      'Vytvoř podepsaný obrázek jako osobní odměnu za dosažení 2 000 XP.',
      'Create a signed image as a personal reward for reaching 2,000 XP.',
    )}
  />
</svelte:head>

{#if !$appStore.ready}
  <LoadingState label={copy('Připravuji odměny…', 'Preparing rewards…')} />
{:else}
  <div class="reward-page">
    <a class="back-link" href="/"
      ><ArrowLeft size={17} /> {copy('Zpět na dnešní cestu', "Back to today's path")}</a
    >

    <section class="xp-shop" aria-labelledby="xp-shop-title">
      <header class="shop-heading">
        <div>
          <p class="kicker">{copy('Odměny za získané XP', 'Rewards for earned XP')}</p>
          <h1 id="xp-shop-title">
            {copy('Za co můžeš utratit XP', 'Spend your XP')}
          </h1>
          <p>
            {copy(
              'Tady vidíš XP, které můžeš utratit. Celkový počet získaných XP najdeš v Pokroku.',
              'These are the XP you can spend. Your total earned XP is shown in Progress.',
            )}
          </p>
        </div>
        <dl class="wallet-score">
          <div>
            <dt>{copy('Dostupné', 'Available')}</dt>
            <dd>{$walletProgress.balance.toLocaleString(languageTag($motherTongue))} XP</dd>
          </div>
          <div>
            <dt>{copy('Utraceno', 'Spent')}</dt>
            <dd>{$walletProgress.spent.toLocaleString(languageTag($motherTongue))} XP</dd>
          </div>
        </dl>
      </header>

      <article class:active={Boolean($walletProgress.activeBoost)} class="shop-item">
        <span class="shop-icon"><Sparkles size={23} /></span>
        <div class="shop-copy">
          <span
            >{$walletProgress.activeBoost
              ? copy('Aktivní bonus', 'Active boost')
              : copy('Jednorázový bonus', 'One-time boost')}</span
          >
          <h2>{copy(DOUBLE_XP_NEXT_NODE.title, '2× XP for the next step')}</h2>
          <p>
            {copy(
              DOUBLE_XP_NEXT_NODE.description,
              'Double XP when you complete your next course step for the first time.',
            )}
          </p>
          <small
            >{copy(
              DOUBLE_XP_NEXT_NODE.scope,
              'Applies to one new course step. Review dates and learning results stay the same.',
            )}</small
          >
        </div>
        <div class="shop-buy">
          <strong>{DOUBLE_XP_NEXT_NODE.price} XP</strong>
          <button
            class="btn-base btn-primary"
            type="button"
            disabled={purchasing ||
              Boolean($walletProgress.activeBoost) ||
              $walletProgress.balance < DOUBLE_XP_NEXT_NODE.price}
            onclick={() => void buyDoubleXp()}
          >
            {purchasing
              ? copy('Aktivuji…', 'Activating…')
              : $walletProgress.activeBoost
                ? copy('Platí pro další krok', 'Applies to the next step')
                : $walletProgress.balance < DOUBLE_XP_NEXT_NODE.price
                  ? copy(
                      `Chybí ${DOUBLE_XP_NEXT_NODE.price - $walletProgress.balance} XP`,
                      `${DOUBLE_XP_NEXT_NODE.price - $walletProgress.balance} XP short`,
                    )
                  : copy('Aktivovat', 'Activate')}
          </button>
        </div>
      </article>

      <p class="shop-rule">
        {copy(
          'Za první dokončení dalšího kroku kurzu získáš dvojnásobné XP. Termíny opakování a hodnocení odpovědí zůstanou stejné.',
          'Earn double XP the first time you finish your next course step. Review dates and answer grading stay the same.',
        )}
      </p>
      {#if shopMessage}
        <p class:error={shopFailed} class="shop-status" role={shopFailed ? 'alert' : 'status'}>
          {shopMessage}
        </p>
      {/if}
    </section>

    <header class:unlocked={$gameProgress.reward.unlocked} class="reward-hero">
      <div>
        <p class="hero-kicker">
          {#if $gameProgress.reward.unlocked}<Sparkles size={15} />
            {copy('Milník dosažen', 'Milestone reached')}{:else}<LockKeyhole size={15} />
            {copy('Milník 2 000 XP', '2,000 XP milestone')}{/if}
        </p>
        <h1>
          {$gameProgress.reward.unlocked
            ? copy('Máš 2 000 XP. Vyber si odměnu.', 'You’ve reached 2,000 XP. Choose your reward.')
            : copy('Připrav si svou odměnu', 'Prepare your reward')}
        </h1>
        <p>
          {$gameProgress.reward.unlocked
            ? copy(
                'Uprav podpis a vzkaz. Hotový obrázek si stáhni nebo ho někomu pošli.',
                'Edit the signature and message. Fritz creates the image on your device, ready to download or share.',
              )
            : copy(
                `Ještě ${Math.max(0, 2000 - $gameProgress.totalXp)} XP. Náhled si můžeš připravit už teď, export se odemkne po dosažení milníku.`,
                `${Math.max(0, 2000 - $gameProgress.totalXp)} XP to go. You can prepare the preview now; export unlocks at the milestone.`,
              )}
        </p>
      </div>
      <div class="milestone-score">
        <span>{copy('Celkem', 'Total')}</span>
        <strong>{$gameProgress.totalXp.toLocaleString(languageTag($motherTongue))}</strong>
        <small>/ 2 000 XP</small>
        <ProgressBar
          value={$gameProgress.reward.percent}
          label={copy('Postup k odměně', 'Progress to reward')}
        />
      </div>
    </header>

    <div class="reward-workspace">
      <section class="editor-card">
        <div class="section-heading">
          <span><Gift size={21} /></span>
          <div>
            <p class="kicker">{copy('Osobní odměna', 'Personal reward')}</p>
            <h2>{copy('Uprav vzkaz a podpis', 'Edit the message and signature')}</h2>
          </div>
        </div>

        <label for="student-name">
          <span>{copy('Jméno na certifikátu', 'Name on the certificate')}</span>
          <input id="student-name" class="field" bind:value={studentName} maxlength="45" />
        </label>
        <label for="reward-text">
          <span>{copy('Co si zaslouží', 'Reward')}</span>
          <input id="reward-text" class="field" bind:value={rewardText} maxlength="70" />
        </label>
        <label for="personal-message">
          <span>{copy('Osobní vzkaz', 'Personal message')}</span>
          <textarea id="personal-message" class="field" bind:value={personalMessage} maxlength="150"
          ></textarea>
        </label>
        <label for="signed-by">
          <span>{copy('Podpis', 'Signature')}</span>
          <input
            id="signed-by"
            class="field signature-input"
            bind:value={signedBy}
            maxlength="45"
          />
        </label>

        <div class="privacy-note">
          <Check size={17} />
          <p>
            {copy(
              'Obrázek vzniká lokálně v prohlížeči. Jména ani vzkaz se neposílají do AI.',
              'The image is created locally in your browser. Names and messages are not sent to AI.',
            )}
          </p>
        </div>

        <div class="action-grid">
          <button
            class="btn-base btn-primary"
            type="button"
            disabled={!$gameProgress.reward.unlocked || sharing}
            onclick={() => void shareCertificate()}
          >
            <Share2 size={18} />
            {sharing ? copy('Připravuji…', 'Preparing…') : copy('Sdílet obrázek', 'Share image')}
          </button>
          <button
            class="btn-base btn-secondary"
            type="button"
            disabled={!$gameProgress.reward.unlocked}
            onclick={() => void downloadCertificate()}
          >
            <Download size={18} />
            {copy('Stáhnout PNG', 'Download PNG')}
          </button>
          <button class="copy-button" type="button" onclick={() => void copyMessage()}
            ><Copy size={16} /> {copy('Zkopírovat zprávu', 'Copy message')}</button
          >
        </div>

        {#if !$gameProgress.reward.unlocked}
          <p class="locked-note">
            <LockKeyhole size={15} />
            {copy('Export se odemkne přesně při 2 000 XP.', 'Export unlocks at exactly 2,000 XP.')}
          </p>
        {/if}
        {#if message}<p
            class:error={failed}
            class="status-message"
            aria-live={failed ? 'assertive' : 'polite'}
          >
            {message}
          </p>{/if}
      </section>

      <section class="preview-card">
        <div class="preview-heading">
          <div>
            <p class="kicker">{copy('Živý náhled', 'Live preview')}</p>
            <h2>{copy('Podepsaný obrázek 1:1', 'Signed square image')}</h2>
          </div>
          {#if $gameProgress.reward.claimed}<span
              ><Trophy size={15} /> {copy('vyzvednuto', 'claimed')}</span
            >{/if}
        </div>
        <div class:locked={!$gameProgress.reward.unlocked} class="canvas-frame">
          <canvas
            bind:this={canvas}
            aria-label={copy('Náhled podepsané odměny', 'Signed reward preview')}
          ></canvas>
          {#if !$gameProgress.reward.unlocked}
            <div class="canvas-lock">
              <LockKeyhole size={28} /><strong
                >{copy(
                  `Ještě ${Math.max(0, 2000 - $gameProgress.totalXp)} XP`,
                  `${Math.max(0, 2000 - $gameProgress.totalXp)} XP to go`,
                )}</strong
              >
            </div>
          {/if}
        </div>
        <p>
          {copy(
            'Formát 1200 × 1200 px je připravený pro zprávu, Instagram i tisk.',
            'The 1200 × 1200 px format is ready for messages, Instagram, or print.',
          )}
        </p>
      </section>
    </div>
  </div>
{/if}

<style>
  .reward-page {
    max-width: 72rem;
    margin: 0 auto;
  }
  .back-link {
    display: inline-flex;
    min-height: 2.5rem;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-ink-600);
    font-size: 0.7rem;
    font-weight: 800;
  }
  .xp-shop {
    margin-top: 0.6rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.65rem 1.6rem 0.65rem 0.65rem;
    background: var(--color-paper-50);
    padding: 1rem;
    box-shadow: 5px 5px 0 var(--color-ink-950);
  }
  .shop-heading {
    display: grid;
    gap: 1rem;
    border-bottom: 1px dashed var(--color-line);
    padding-bottom: 1rem;
  }
  .shop-heading h1 {
    margin: 0.3rem 0 0;
    font-size: clamp(1.65rem, 6vw, 2.8rem);
    font-weight: 920;
    letter-spacing: -0.04em;
    line-height: 0.95;
  }
  .shop-heading > div > p:last-child {
    max-width: 42rem;
    margin: 0.65rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.75rem;
    line-height: 1.5;
  }
  .wallet-score {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
    margin: 0;
  }
  .wallet-score div {
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 0.85rem 0.45rem 0.45rem;
    background: var(--color-cobalt-50);
    padding: 0.7rem;
  }
  .wallet-score dt {
    color: var(--color-ink-600);
    font-family: var(--font-mono);
    font-size: 0.55rem;
    font-weight: 850;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .wallet-score dd {
    margin: 0.25rem 0 0;
    font-size: 1rem;
    font-weight: 900;
  }
  .shop-item {
    display: grid;
    gap: 0.8rem;
    margin-top: 1rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.55rem 1.15rem 0.55rem 0.55rem;
    background: var(--color-paper-100);
    padding: 0.85rem;
  }
  .shop-item.active {
    background: var(--color-mint-50);
    box-shadow: inset 0 0 0 2px var(--color-mint-300);
  }
  .shop-icon {
    display: grid;
    width: 3rem;
    height: 3rem;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.45rem 0.95rem 0.45rem 0.45rem;
    background: var(--color-acid-500);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .shop-copy > span {
    color: var(--color-cobalt-700);
    font-family: var(--font-mono);
    font-size: 0.57rem;
    font-weight: 850;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .shop-copy h2 {
    margin: 0.22rem 0 0;
    font-size: 1.15rem;
    font-weight: 900;
    letter-spacing: -0.035em;
  }
  .shop-copy p,
  .shop-copy small {
    display: block;
    margin: 0.35rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.68rem;
    line-height: 1.45;
  }
  .shop-buy {
    display: grid;
    gap: 0.45rem;
  }
  .shop-buy > strong {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }
  .shop-buy .btn-base {
    width: 100%;
  }
  .shop-rule,
  .shop-status {
    margin: 0.75rem 0 0;
    border-radius: 0.55rem;
    padding: 0.65rem;
    font-size: 0.63rem;
    line-height: 1.48;
  }
  .shop-rule {
    color: var(--color-ink-600);
    background: var(--color-cobalt-50);
  }
  .shop-status {
    color: var(--color-mint-700);
    background: var(--color-mint-50);
    font-weight: 780;
  }
  .shop-status.error {
    color: var(--color-coral-700);
    background: var(--color-coral-50);
  }

  .reward-hero {
    display: grid;
    overflow: hidden;
    margin-top: 0.6rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.75rem 1.8rem 0.75rem 0.75rem;
    color: white;
    background: var(--color-ink-950);
    box-shadow: 7px 7px 0 rgb(21 25 28 / 0.13);
  }
  .reward-hero.unlocked {
    color: var(--color-ink-950);
    background: var(--color-acid-500);
  }
  .reward-hero > div:first-child {
    padding: clamp(1.35rem, 5vw, 3rem);
  }
  .hero-kicker {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    color: var(--color-acid-500);
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 850;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }
  .unlocked .hero-kicker {
    color: var(--color-ink-950);
  }
  .reward-hero h1 {
    max-width: 13ch;
    margin: 0.7rem 0 0;
    font-size: clamp(2.5rem, 8vw, 5.2rem);
    font-weight: 930;
    letter-spacing: -0.04em;
    line-height: 0.88;
    text-wrap: balance;
  }
  .reward-hero > div:first-child > p:last-child {
    max-width: 42rem;
    margin: 1rem 0 0;
    color: rgb(255 255 255 / 0.62);
    font-size: 0.85rem;
    line-height: 1.58;
  }
  .unlocked > div:first-child > p:last-child {
    color: rgb(21 25 28 / 0.68);
  }
  .milestone-score {
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-top: 1px solid rgb(255 255 255 / 0.16);
    background: rgb(255 255 255 / 0.05);
    padding: 1.25rem;
  }
  .unlocked .milestone-score {
    border-color: var(--color-ink-950);
    background: rgb(255 255 255 / 0.25);
  }
  .milestone-score > span {
    font-family: var(--font-mono);
    font-size: 0.57rem;
    font-weight: 850;
    text-transform: uppercase;
  }
  .milestone-score > strong {
    margin-top: 0.5rem;
    font-size: clamp(3rem, 12vw, 5rem);
    font-weight: 930;
    letter-spacing: -0.04em;
    line-height: 0.82;
  }
  .milestone-score > small {
    margin-top: 0.3rem;
    color: rgb(255 255 255 / 0.55);
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 760;
  }
  .unlocked .milestone-score > small {
    color: rgb(21 25 28 / 0.62);
  }
  .milestone-score :global(.progress-track) {
    margin-top: 0.9rem;
  }

  .reward-workspace {
    display: grid;
    gap: 1rem;
    margin-top: 1.4rem;
  }
  .editor-card,
  .preview-card {
    border: 1px solid var(--color-ink-950);
    border-radius: 0.6rem 1.45rem 0.6rem 0.6rem;
    background: var(--color-paper-50);
    padding: 1rem;
    box-shadow: 5px 5px 0 rgb(21 25 28 / 0.1);
  }
  .section-heading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .section-heading > span {
    display: grid;
    width: 3rem;
    height: 3rem;
    flex: none;
    place-items: center;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.5rem 1rem 0.5rem 0.5rem;
    background: var(--color-acid-500);
    box-shadow: 3px 3px 0 var(--color-ink-950);
  }
  .section-heading h2,
  .preview-heading h2 {
    margin: 0.28rem 0 0;
    font-size: 1.25rem;
    font-weight: 900;
    letter-spacing: -0.04em;
  }
  .editor-card label {
    display: block;
    margin-top: 0.9rem;
  }
  .editor-card label > span {
    display: block;
    margin-bottom: 0.38rem;
    color: var(--color-ink-600);
    font-size: 0.66rem;
    font-weight: 780;
  }
  .editor-card textarea {
    min-height: 6rem;
    resize: vertical;
  }
  .signature-input {
    font-size: 1rem;
    font-style: italic;
    font-weight: 800;
  }
  .privacy-note {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
    border-radius: 0.65rem;
    color: var(--color-mint-700);
    background: var(--color-mint-50);
    padding: 0.7rem;
  }
  .privacy-note :global(svg) {
    flex: none;
  }
  .privacy-note p {
    margin: 0;
    font-size: 0.62rem;
    font-weight: 720;
    line-height: 1.45;
  }
  .action-grid {
    display: grid;
    gap: 0.55rem;
    margin-top: 1rem;
  }
  .copy-button {
    display: inline-flex;
    min-height: 2.6rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border-radius: 0.5rem;
    color: var(--color-cobalt-700);
    font-size: 0.66rem;
    font-weight: 820;
  }
  .locked-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    margin: 0.75rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.6rem;
    font-weight: 760;
  }
  .status-message {
    margin: 0.75rem 0 0;
    border-radius: 0.6rem;
    color: var(--color-mint-700);
    background: var(--color-mint-50);
    padding: 0.65rem;
    font-size: 0.65rem;
    font-weight: 760;
  }
  .status-message.error {
    color: var(--color-coral-700);
    background: var(--color-coral-50);
  }

  .preview-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 0.7rem;
  }
  .preview-heading > span {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    border-radius: 99px;
    color: var(--color-mint-700);
    background: var(--color-mint-50);
    padding: 0.4rem 0.55rem;
    font-family: var(--font-mono);
    font-size: 0.52rem;
    font-weight: 820;
  }
  .canvas-frame {
    position: relative;
    overflow: hidden;
    margin-top: 0.85rem;
    border: 1px solid var(--color-ink-950);
    border-radius: 0.55rem 1.15rem 0.55rem 0.55rem;
    background: var(--color-paper-100);
    box-shadow: 4px 4px 0 var(--color-ink-950);
  }
  .canvas-frame canvas {
    display: block;
    width: 100%;
    height: auto;
  }
  .canvas-frame.locked canvas {
    filter: grayscale(0.7) blur(1.5px);
    opacity: 0.5;
  }
  .canvas-lock {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.5rem;
    background: rgb(243 239 228 / 0.55);
    backdrop-filter: blur(2px);
  }
  .canvas-lock strong {
    border: 1px solid var(--color-ink-950);
    border-radius: 99px;
    background: var(--color-paper-50);
    padding: 0.5rem 0.75rem;
    font-size: 0.68rem;
    box-shadow: 2px 2px 0 var(--color-ink-950);
  }
  .preview-card > p {
    margin: 0.8rem 0 0;
    color: var(--color-ink-600);
    font-size: 0.6rem;
    line-height: 1.45;
  }

  @media (min-width: 760px) {
    .shop-heading {
      grid-template-columns: minmax(0, 1fr) 18rem;
      align-items: end;
    }
    .shop-item {
      grid-template-columns: auto minmax(0, 1fr) 12rem;
      align-items: center;
    }
    .shop-buy {
      justify-items: stretch;
      text-align: right;
    }
    .reward-hero {
      grid-template-columns: minmax(0, 1fr) 18rem;
    }
    .milestone-score {
      border-top: 0;
      border-left: 1px solid rgb(255 255 255 / 0.16);
    }
    .unlocked .milestone-score {
      border-color: var(--color-ink-950);
    }
    .action-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .copy-button {
      grid-column: 1 / -1;
    }
  }

  @media (min-width: 1020px) {
    .reward-workspace {
      grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
      align-items: start;
    }
    .preview-card {
      position: sticky;
      top: 1.5rem;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .back-link:hover,
    .copy-button:hover {
      color: var(--color-ink-950);
    }
    .copy-button:hover {
      background: var(--color-sky-50);
    }
  }
</style>
