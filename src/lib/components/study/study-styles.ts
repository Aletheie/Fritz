/** Coral mono label used across the study screen. */
export const labIndex =
  'font-mono text-[0.67rem] font-extrabold tracking-[0.08em] text-coral-700 uppercase';
/** Answer blocks share a centred column below the prompt. */
export const answerZone =
  'mx-auto mt-[2.1rem] max-w-[44rem] max-[900px]:mt-[clamp(1.15rem,4dvh,1.8rem)] max-[521px]:mt-[clamp(0.95rem,3.5dvh,1.45rem)]';
export const speakButton =
  'grid size-[2.7rem] flex-none place-items-center rounded-full border border-current bg-white [transition:transform_120ms_var(--ease-out-emil)] active:[transform:scale(0.95)]';
export const tokenButton =
  'min-h-[2.65rem] rounded-[0.25rem] border border-ink-950 bg-paper-50 px-[0.72rem] py-[0.55rem] font-[760] shadow-[2px_2px_0_var(--color-ink-950)] [transition:transform_120ms_var(--ease-out-emil),box-shadow_120ms_var(--ease-out-emil),opacity_120ms_ease] active:not-disabled:shadow-[1px_1px_0_var(--color-ink-950)] active:not-disabled:[transform:translate(1px,1px)_scale(0.97)] fine-hover:not-disabled:bg-acid-100 max-[521px]:min-h-[2.35rem] max-[521px]:px-[0.58rem] max-[521px]:py-[0.45rem]';
export const promptBase =
  'mt-[clamp(2.4rem,7vw,4.6rem)] text-center max-[900px]:mt-[clamp(1.35rem,7dvh,3rem)] max-[521px]:mt-[clamp(1rem,5dvh,2rem)]';
export const promptSecondary =
  'mt-[2.7rem] text-center max-[900px]:mt-[clamp(1.15rem,5dvh,2.25rem)]';
export const promptTitle =
  'mt-[0.45rem] text-[clamp(2.35rem,8vw,5.5rem)] leading-[0.9] font-black tracking-[-0.04em] text-balance max-[521px]:text-[clamp(2.05rem,12vw,3.65rem)] max-[521px]:leading-[0.92]';
export const contextTitle =
  'mt-[0.45rem] text-[clamp(1.85rem,5vw,3.6rem)] leading-[0.98] font-black tracking-[-0.04em] text-balance max-[521px]:text-[clamp(1.65rem,8vw,2.65rem)]';
export const targetTitle =
  'mt-[0.45rem] text-[clamp(2.3rem,7vw,4.8rem)] leading-[0.94] font-black tracking-[-0.04em] text-balance max-[521px]:text-[clamp(2rem,10vw,3.35rem)]';
export const promptNote = 'mt-[0.7rem] text-[0.84rem] font-bold text-ink-600';
export const fieldLabel =
  'mb-2 block font-mono text-[0.7rem] font-extrabold tracking-[0.055em] text-ink-600 uppercase';
export const submitButton =
  'btn-base btn-primary mt-5 w-full max-[521px]:mt-3 max-[521px]:min-h-12';
/** Text answer field; `correct` is undefined until the answer has been graded. */
export const answerField = (correct: boolean | undefined) => [
  'mt-0 min-h-[4.3rem] w-full rounded-[0.25rem] border-2 bg-white px-4 py-[0.9rem] text-[1.25rem] font-[780] text-ink-950 [transition:border-color_150ms_var(--ease-out-emil),box-shadow_150ms_var(--ease-out-emil),transform_150ms_var(--ease-out-emil)] focus:outline-0 max-[521px]:min-h-[3.55rem] max-[521px]:px-[0.8rem] max-[521px]:py-[0.7rem] max-[521px]:text-[1.05rem]',
  correct === true
    ? 'border-mint-700 shadow-[4px_4px_0_var(--color-mint-200)]'
    : correct === false
      ? 'border-coral-700 shadow-[4px_4px_0_var(--color-coral-200)]'
      : 'border-ink-950 shadow-[4px_4px_0_var(--color-line)] focus:border-cobalt-700 focus:shadow-[4px_4px_0_var(--color-cobalt-300)] max-[521px]:shadow-[3px_3px_0_var(--color-line)]',
];
