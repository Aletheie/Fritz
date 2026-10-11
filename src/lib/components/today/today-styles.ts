export const field =
  'min-h-[3.2rem] w-full rounded-[0.65rem] border border-ink-950 bg-white px-[0.9rem] py-3 text-[1.05rem] text-ink-950';
export const fieldLabel = 'text-[0.78rem] font-[760] text-ink-700';
export const prompt =
  'mt-7 grid gap-[0.35rem] border-l-[0.3rem] border-acid-500 bg-paper-100 px-[1.1rem] py-4 [&>small]:text-ink-700 [&>span]:font-mono [&>span]:text-[0.7rem] [&>span]:text-ink-700 [&>span]:uppercase [&>strong]:text-[clamp(1.25rem,4vw,1.75rem)] [&>strong]:leading-[1.25]';
export const button =
  'inline-flex min-h-[2.9rem] items-center justify-center gap-[0.45rem] rounded-[0.65rem] border px-4 py-[0.68rem] font-[780]';
export const primaryButton = `${button} border-ink-950 bg-ink-950 text-white`;
export const wideButton = `${primaryButton} mt-4 w-full`;
export const hintButton = `${button} border-line bg-paper-50 text-ink-950`;
export const formActions = 'mt-1 flex flex-wrap justify-between gap-3';
export const answerForm = 'mt-[1.4rem] grid gap-[0.8rem]';
export const hint =
  'mt-[0.85rem] mb-0 rounded-[0.55rem] border border-butter-400 bg-butter-50 p-3 leading-[1.45]';
export const toggle = (selected: boolean) => [
  'min-h-12 rounded-[0.55rem] border p-[0.65rem] font-[720]',
  selected ? 'border-cobalt-700 bg-cobalt-700 text-white' : 'border-line bg-paper-50 text-ink-950',
];
export const choiceGrid =
  'grid grid-cols-2 gap-[0.65rem] border-0 p-0 max-[561px]:grid-cols-1 [&>legend]:col-span-full [&>legend]:mb-[0.2rem] [&>legend]:text-[0.78rem] [&>legend]:font-[760] [&>legend]:text-ink-700';
export const errorClass = 'font-bold text-coral-700';
export const centered =
  'mx-auto grid min-h-[calc(100dvh-4.75rem)] w-[min(100%-2rem,42rem)] content-center justify-items-center py-12 text-center';
export const centeredTitle =
  'mt-[0.55rem] mb-0 text-[clamp(2.2rem,7vw,4rem)] leading-[1.04] tracking-[-0.045em]';
export const centeredText = 'max-w-xl leading-[1.6] text-ink-700';
export const link =
  'inline-flex min-h-12 items-center gap-[0.45rem] rounded-[0.65rem] border border-ink-950 px-4 py-[0.7rem] font-[780]';
