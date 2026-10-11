/** Shared chrome for the immersive grammar lesson screens. */
export const lessonShell = 'h-dvh w-full overflow-hidden text-ink-950';
export const lessonBar =
  'flex min-h-[calc(4rem+var(--safe-top))] items-center gap-3 border-b px-[0.85rem] pt-(--safe-top) backdrop-blur-[18px] min-[640px]:px-5';
export const closeButton =
  'grid size-[2.65rem] flex-none place-items-center rounded-[0.78rem] border [transition:transform_140ms_var(--ease-out-emil),background-color_160ms_var(--ease-out-emil)] active:[transform:scale(0.95)]';
export const lightClose = `${closeButton} border-[color-mix(in_srgb,var(--color-ink-950)_22%,transparent)] bg-paper-50 fine-hover:bg-acid-100`;
export const pill =
  'inline-flex min-h-8 items-center gap-[0.3rem] rounded-full px-[0.6rem] font-mono text-[0.56rem] font-extrabold whitespace-nowrap';
/** Footer padding keeps actions aligned with the 44rem content column on wide screens. */
export const footerInset = 'min-[640px]:px-[max(1.25rem,calc((100vw-44rem)/2))]';
