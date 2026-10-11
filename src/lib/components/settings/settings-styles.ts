/** Shared look for the device and data cards below the settings form. */
export const utilitySheet =
  'rounded-[0.25rem] border border-ink-950 bg-paper-50 p-[1.2rem] shadow-[4px_4px_0_var(--color-line)]';
export const utilityCopy = 'mt-[0.9rem] text-[0.875rem] leading-normal text-ink-600';
export const utilityActions = 'mt-[0.9rem] grid gap-[0.55rem] min-[640px]:grid-cols-2';
export const statusMessage = (error: boolean) => [
  'mt-[0.8rem] border bg-white p-[0.7rem] text-[0.875rem] font-bold',
  error ? 'border-coral-700 text-coral-700' : 'border-mint-700 text-mint-700',
];
