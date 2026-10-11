<script lang="ts">
  import LoadingState from '$lib/components/LoadingState.svelte';
  import ProgressBar from '$lib/components/ProgressBar.svelte';
  import { DOUBLE_XP_NEXT_NODE } from '$lib/domain/course/wallet.ts';
  import { errorText } from '$lib/domain/errors.ts';
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

  let canvas: HTMLCanvasElement | undefined = $state();
  let studentName = $state('');
  let signedBy = $state('Tvoje sestra');
  let rewardText = $state('Společná odměna podle tvého výběru');
  let personalMessage = $state('Jsem na tebe pyšná. Tohle sis opravdu odmakala.');
  let message = $state('');
  let failed = $state(false);
  let sharing = $state(false);
  let purchasing = $state(false);
  let shopMessage = $state('');
  let shopFailed = $state(false);

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
      message = errorText(error, $motherTongue, {
        cs: 'Obrázek se nepodařilo vytvořit.',
        en: 'The image could not be created.',
      });
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
      message = errorText(error, $motherTongue, {
        cs: 'Sdílení se nepodařilo.',
        en: 'Sharing failed.',
      });
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
      shopMessage = errorText(error, $motherTongue, {
        cs: 'Odměnu se nepodařilo aktivovat. XP zůstala zachovaná.',
        en: 'The reward could not be activated. Your XP balance is unchanged.',
      });
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

  const card =
    'rounded-[0.6rem_1.45rem_0.6rem_0.6rem] border border-ink-950 bg-paper-50 p-4 shadow-[5px_5px_0_rgb(21_25_28/0.1)]';
  const cardTitle = 'mt-[0.28rem] text-[1.25rem] font-black tracking-[-0.04em]';
  const fieldLabel = 'mt-[0.9rem] block';
  const fieldCaption = 'mb-[0.38rem] block text-[0.66rem] font-[780] text-ink-600';
  const stickerIcon =
    'grid size-12 flex-none place-items-center border border-ink-950 bg-acid-500 shadow-[3px_3px_0_var(--color-ink-950)]';
  const notice = 'mt-3 rounded-[0.55rem] p-[0.65rem] text-[0.63rem] leading-[1.48]';
  // Redraw the certificate whenever any of its visible inputs change.
  $effect(() => {
    if (!canvas || !$appStore.ready) return;
    void [studentName, signedBy, rewardText, personalMessage, $motherTongue, $gameProgress.totalXp];
    drawCertificate();
  });
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
  <div class="mx-auto max-w-[72rem]">
    <a
      class="inline-flex min-h-10 items-center gap-[0.35rem] text-[0.7rem] font-extrabold text-ink-600 fine-hover:text-ink-950"
      href="/"><ArrowLeft size={17} /> {copy('Zpět na dnešní cestu', "Back to today's path")}</a
    >

    <section
      class="mt-[0.6rem] rounded-[0.65rem_1.6rem_0.65rem_0.65rem] border border-ink-950 bg-paper-50 p-4 shadow-[5px_5px_0_var(--color-ink-950)]"
      aria-labelledby="xp-shop-title"
    >
      <header
        class="grid gap-4 border-b border-dashed border-line pb-4 min-[760px]:grid-cols-[minmax(0,1fr)_18rem] min-[760px]:items-end"
      >
        <div>
          <p class="kicker">{copy('Odměny za získané XP', 'Rewards for earned XP')}</p>
          <h1
            class="mt-[0.3rem] text-[clamp(1.65rem,6vw,2.8rem)] leading-[0.95] font-[920] tracking-[-0.04em]"
            id="xp-shop-title"
          >
            {copy('Za co můžeš utratit XP', 'Spend your XP')}
          </h1>
          <p class="mt-[0.65rem] max-w-[42rem] text-[0.75rem] leading-normal text-ink-600">
            {copy(
              'Tady vidíš XP, které můžeš utratit. Celkový počet získaných XP najdeš v Pokroku.',
              'These are the XP you can spend. Your total earned XP is shown in Progress.',
            )}
          </p>
        </div>
        <dl class="m-0 grid grid-cols-2 gap-[0.55rem]">
          {#each [[copy('Dostupné', 'Available'), $walletProgress.balance], [copy('Utraceno', 'Spent'), $walletProgress.spent]] as [label, value]}
            <div
              class="rounded-[0.45rem_0.85rem_0.45rem_0.45rem] border border-ink-950 bg-cobalt-50 p-[0.7rem]"
            >
              <dt
                class="font-mono text-[0.55rem] font-[850] tracking-[0.05em] text-ink-600 uppercase"
              >
                {label}
              </dt>
              <dd class="mt-1 text-[1rem] font-black">
                {Number(value).toLocaleString(languageTag($motherTongue))} XP
              </dd>
            </div>
          {/each}
        </dl>
      </header>

      <article
        class={[
          'mt-4 grid gap-[0.8rem] rounded-[0.55rem_1.15rem_0.55rem_0.55rem] border border-ink-950 p-[0.85rem] min-[760px]:grid-cols-[auto_minmax(0,1fr)_12rem] min-[760px]:items-center',
          $walletProgress.activeBoost
            ? 'bg-mint-50 shadow-[inset_0_0_0_2px_var(--color-mint-300)]'
            : 'bg-paper-100',
        ]}
      >
        <span class="{stickerIcon} rounded-[0.45rem_0.95rem_0.45rem_0.45rem]"
          ><Sparkles size={23} /></span
        >
        <div>
          <span
            class="font-mono text-[0.57rem] font-[850] tracking-[0.05em] text-cobalt-700 uppercase"
            >{$walletProgress.activeBoost
              ? copy('Aktivní bonus', 'Active boost')
              : copy('Jednorázový bonus', 'One-time boost')}</span
          >
          <h2 class="mt-[0.22rem] text-[1.15rem] font-black tracking-[-0.035em]">
            {copy(DOUBLE_XP_NEXT_NODE.title, '2× XP for the next step')}
          </h2>
          <p class="mt-[0.35rem] block text-[0.68rem] leading-[1.45] text-ink-600">
            {copy(
              DOUBLE_XP_NEXT_NODE.description,
              'Double XP when you complete your next course step for the first time.',
            )}
          </p>
          <small class="mt-[0.35rem] block text-[0.68rem] leading-[1.45] text-ink-600"
            >{copy(
              DOUBLE_XP_NEXT_NODE.scope,
              'Applies to one new course step. Review dates and learning results stay the same.',
            )}</small
          >
        </div>
        <div class="grid gap-[0.45rem] min-[760px]:justify-items-stretch min-[760px]:text-right">
          <strong class="font-mono text-[0.8rem]">{DOUBLE_XP_NEXT_NODE.price} XP</strong>
          <button
            class="btn-base btn-primary w-full"
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

      <p class="{notice} bg-cobalt-50 text-ink-600">
        {copy(
          'Za první dokončení dalšího kroku kurzu získáš dvojnásobné XP. Termíny opakování a hodnocení odpovědí zůstanou stejné.',
          'Earn double XP the first time you finish your next course step. Review dates and answer grading stay the same.',
        )}
      </p>
      {#if shopMessage}
        <p
          class={[
            notice,
            'font-[780]',
            shopFailed ? 'bg-coral-50 text-coral-700' : 'bg-mint-50 text-mint-700',
          ]}
          role={shopFailed ? 'alert' : 'status'}
        >
          {shopMessage}
        </p>
      {/if}
    </section>

    <header
      class={[
        'mt-[0.6rem] grid overflow-hidden rounded-[0.75rem_1.8rem_0.75rem_0.75rem] border border-ink-950 shadow-[7px_7px_0_rgb(21_25_28/0.13)] min-[760px]:grid-cols-[minmax(0,1fr)_18rem]',
        $gameProgress.reward.unlocked ? 'bg-acid-500 text-ink-950' : 'bg-ink-950 text-white',
      ]}
    >
      <div class="p-[clamp(1.35rem,5vw,3rem)]">
        <p
          class={[
            'm-0 inline-flex items-center gap-[0.4rem] font-mono text-[0.62rem] font-[850] tracking-[0.07em] uppercase',
            $gameProgress.reward.unlocked ? 'text-ink-950' : 'text-acid-500',
          ]}
        >
          {#if $gameProgress.reward.unlocked}<Sparkles size={15} />
            {copy('Milník dosažen', 'Milestone reached')}{:else}<LockKeyhole size={15} />
            {copy('Milník 2 000 XP', '2,000 XP milestone')}{/if}
        </p>
        <h1
          class="mt-[0.7rem] max-w-[13ch] text-[clamp(2.5rem,8vw,5.2rem)] leading-[0.88] font-[930] tracking-[-0.04em] text-balance"
        >
          {$gameProgress.reward.unlocked
            ? copy('Máš 2 000 XP. Vyber si odměnu.', 'You’ve reached 2,000 XP. Choose your reward.')
            : copy('Připrav si svou odměnu', 'Prepare your reward')}
        </h1>
        <p
          class={[
            'mt-4 max-w-[42rem] text-[0.85rem] leading-[1.58]',
            $gameProgress.reward.unlocked ? 'text-ink-950/68' : 'text-white/62',
          ]}
        >
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
      <div
        class={[
          'flex flex-col justify-center border-t p-5 min-[760px]:border-t-0 min-[760px]:border-l',
          $gameProgress.reward.unlocked
            ? 'border-ink-950 bg-white/25'
            : 'border-white/16 bg-white/5',
        ]}
      >
        <span class="font-mono text-[0.57rem] font-[850] uppercase">{copy('Celkem', 'Total')}</span>
        <strong
          class="mt-2 text-[clamp(3rem,12vw,5rem)] leading-[0.82] font-[930] tracking-[-0.04em]"
          >{$gameProgress.totalXp.toLocaleString(languageTag($motherTongue))}</strong
        >
        <small
          class={[
            'mt-[0.3rem] font-mono text-[0.6rem] font-[760]',
            $gameProgress.reward.unlocked ? 'text-ink-950/62' : 'text-white/55',
          ]}>/ 2 000 XP</small
        >
        <ProgressBar
          class="mt-[0.9rem]"
          value={$gameProgress.reward.percent}
          label={copy('Postup k odměně', 'Progress to reward')}
        />
      </div>
    </header>

    <div
      class="mt-[1.4rem] grid gap-4 min-[1020px]:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] min-[1020px]:items-start"
    >
      <section class={card}>
        <div class="flex items-center gap-3">
          <span class="{stickerIcon} rounded-[0.5rem_1rem_0.5rem_0.5rem]"><Gift size={21} /></span>
          <div>
            <p class="kicker">{copy('Osobní odměna', 'Personal reward')}</p>
            <h2 class={cardTitle}>
              {copy('Uprav vzkaz a podpis', 'Edit the message and signature')}
            </h2>
          </div>
        </div>

        <label class={fieldLabel} for="student-name">
          <span class={fieldCaption}>{copy('Jméno na certifikátu', 'Name on the certificate')}</span
          >
          <input id="student-name" class="field" bind:value={studentName} maxlength="45" />
        </label>
        <label class={fieldLabel} for="reward-text">
          <span class={fieldCaption}>{copy('Co si zaslouží', 'Reward')}</span>
          <input id="reward-text" class="field" bind:value={rewardText} maxlength="70" />
        </label>
        <label class={fieldLabel} for="personal-message">
          <span class={fieldCaption}>{copy('Osobní vzkaz', 'Personal message')}</span>
          <textarea
            id="personal-message"
            class="field min-h-24 resize-y"
            bind:value={personalMessage}
            maxlength="150"></textarea>
        </label>
        <label class={fieldLabel} for="signed-by">
          <span class={fieldCaption}>{copy('Podpis', 'Signature')}</span>
          <input
            id="signed-by"
            class="field text-[1rem] font-extrabold italic"
            bind:value={signedBy}
            maxlength="45"
          />
        </label>

        <div class="mt-4 flex gap-2 rounded-[0.65rem] bg-mint-50 p-[0.7rem] text-mint-700">
          <Check class="flex-none" size={17} />
          <p class="m-0 text-[0.62rem] leading-[1.45] font-[720]">
            {copy(
              'Obrázek vzniká lokálně v prohlížeči. Jména ani vzkaz se neposílají do AI.',
              'The image is created locally in your browser. Names and messages are not sent to AI.',
            )}
          </p>
        </div>

        <div class="mt-4 grid gap-[0.55rem] min-[760px]:grid-cols-2">
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
          <button
            class="inline-flex min-h-[2.6rem] items-center justify-center gap-[0.4rem] rounded-lg text-[0.66rem] font-[820] text-cobalt-700 min-[760px]:col-span-full fine-hover:bg-sky-50 fine-hover:text-ink-950"
            type="button"
            onclick={() => void copyMessage()}
            ><Copy size={16} /> {copy('Zkopírovat zprávu', 'Copy message')}</button
          >
        </div>

        {#if !$gameProgress.reward.unlocked}
          <p
            class="mt-3 flex items-center justify-center gap-[0.35rem] text-[0.6rem] font-[760] text-ink-600"
          >
            <LockKeyhole size={15} />
            {copy('Export se odemkne přesně při 2 000 XP.', 'Export unlocks at exactly 2,000 XP.')}
          </p>
        {/if}
        {#if message}<p
            class={[
              'mt-3 rounded-[0.6rem] p-[0.65rem] text-[0.65rem] font-[760]',
              failed ? 'bg-coral-50 text-coral-700' : 'bg-mint-50 text-mint-700',
            ]}
            aria-live={failed ? 'assertive' : 'polite'}
          >
            {message}
          </p>{/if}
      </section>

      <section class="{card} min-[1020px]:sticky min-[1020px]:top-6">
        <div class="flex items-start justify-between gap-[0.7rem]">
          <div>
            <p class="kicker">{copy('Živý náhled', 'Live preview')}</p>
            <h2 class={cardTitle}>{copy('Podepsaný obrázek 1:1', 'Signed square image')}</h2>
          </div>
          {#if $gameProgress.reward.claimed}<span
              class="inline-flex items-center gap-[0.3rem] rounded-full bg-mint-50 px-[0.55rem] py-[0.4rem] font-mono text-[0.52rem] font-[820] text-mint-700"
              ><Trophy size={15} /> {copy('vyzvednuto', 'claimed')}</span
            >{/if}
        </div>
        <div
          class="relative mt-[0.85rem] overflow-hidden rounded-[0.55rem_1.15rem_0.55rem_0.55rem] border border-ink-950 bg-paper-100 shadow-[4px_4px_0_var(--color-ink-950)]"
        >
          <canvas
            class={[
              'block h-auto w-full',
              !$gameProgress.reward.unlocked && 'opacity-50 [filter:grayscale(0.7)_blur(1.5px)]',
            ]}
            bind:this={canvas}
            aria-label={copy('Náhled podepsané odměny', 'Signed reward preview')}
          ></canvas>
          {#if !$gameProgress.reward.unlocked}
            <div
              class="absolute inset-0 grid place-content-center justify-items-center gap-2 bg-[rgb(243_239_228/0.55)] backdrop-blur-[2px]"
            >
              <LockKeyhole size={28} /><strong
                class="rounded-full border border-ink-950 bg-paper-50 px-3 py-2 text-[0.68rem] shadow-[2px_2px_0_var(--color-ink-950)]"
                >{copy(
                  `Ještě ${Math.max(0, 2000 - $gameProgress.totalXp)} XP`,
                  `${Math.max(0, 2000 - $gameProgress.totalXp)} XP to go`,
                )}</strong
              >
            </div>
          {/if}
        </div>
        <p class="mt-[0.8rem] text-[0.6rem] leading-[1.45] text-ink-600">
          {copy(
            'Formát 1200 × 1200 px je připravený pro zprávu, Instagram i tisk.',
            'The 1200 × 1200 px format is ready for messages, Instagram, or print.',
          )}
        </p>
      </section>
    </div>
  </div>
{/if}
