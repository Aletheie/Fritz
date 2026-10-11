<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import { onDestroy } from 'svelte';

  import type { Snippet } from 'svelte';

  let {
    open,
    variant,
    testId,
    kicker,
    title,
    titleLang,
    closeLabel,
    iconClass,
    icon,
    children,
    footer,
    onrequestclose,
    onclose,
  }: {
    open: boolean;
    variant: 'word' | 'selection';
    testId: string;
    kicker: string;
    title: string;
    titleLang?: string;
    closeLabel: string;
    iconClass: string;
    icon: Snippet;
    children: Snippet;
    footer: Snippet;
    /** Runs before the exit animation, e.g. to abort a pending request. */
    onrequestclose?: () => void;
    /** Runs after the dialog has fully closed. */
    onclose: () => void;
  } = $props();

  const EXIT_MS = 140;
  const titleId = $props.id();

  let dialog = $state<HTMLDialogElement>();
  let closing = $state(false);
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    if (!dialog) return;
    if (open) {
      cancelClose();
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) startClose();
  });

  onDestroy(() => clearTimeout(closeTimer));

  function cancelClose(): void {
    clearTimeout(closeTimer);
    closeTimer = undefined;
    closing = false;
  }

  function startClose(): void {
    if (!dialog?.open || closing) return;
    closing = true;
    closeTimer = setTimeout(() => {
      closeTimer = undefined;
      if (dialog?.open) dialog.close();
      closing = false;
    }, EXIT_MS);
  }

  function close(): void {
    onrequestclose?.();
    if (dialog?.open) startClose();
    else onclose();
  }
</script>

<dialog
  bind:this={dialog}
  class={[
    'story-sheet',
    variant === 'word'
      ? 'max-h-[min(88dvh,46rem)] w-[min(100%,30rem)]'
      : 'max-h-[min(90dvh,48rem)] w-[min(100%,32rem)]',
    'min-[700px]:max-h-[calc(100dvh-2rem)]',
  ]}
  data-testid={testId}
  data-closing={closing ? '' : undefined}
  aria-labelledby={titleId}
  oncancel={(event) => {
    event.preventDefault();
    close();
  }}
  onclose={() => {
    cancelClose();
    onclose();
  }}
>
  <div
    class="mx-auto mt-[0.55rem] h-1 w-10 rounded-full bg-line min-[700px]:hidden"
    aria-hidden="true"
  ></div>
  <header
    class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.7rem] border-b border-line px-[0.85rem] pt-[0.7rem] pb-[0.85rem] min-[700px]:pt-[0.9rem]"
  >
    <span class="grid size-[2.65rem] place-items-center rounded-[0.78rem] {iconClass}"
      >{@render icon()}</span
    >
    <div>
      <p
        class={[
          'm-0 font-mono font-[850] tracking-[0.06em] text-ink-600 uppercase',
          variant === 'word' ? 'text-[0.75rem]' : 'text-[0.57rem]',
        ]}
      >
        {kicker}
      </p>
      <h2
        class={[
          'mt-[0.16rem]',
          variant === 'word'
            ? 'text-[1.35rem] font-black tracking-[-0.04em]'
            : 'text-[1rem] font-[880] tracking-[-0.025em]',
        ]}
        id={titleId}
        lang={titleLang}
      >
        {title}
      </h2>
    </div>
    <button
      class="sheet-press grid size-11 place-items-center rounded-full border border-line"
      type="button"
      aria-label={closeLabel}
      onclick={close}><X size={20} /></button
    >
  </header>

  <div
    class={[
      'overflow-y-auto overscroll-contain p-[0.9rem] min-[700px]:max-h-[calc(100dvh-11rem)]',
      variant === 'word' ? 'max-h-[calc(88dvh-10.5rem)]' : 'max-h-[calc(90dvh-10.5rem)]',
    ]}
  >
    {@render children()}
  </div>

  <footer
    class="border-t border-line bg-paper-50 px-[0.85rem] pt-3 pb-[calc(0.75rem+var(--safe-bottom))]"
  >
    {@render footer()}
  </footer>
</dialog>
