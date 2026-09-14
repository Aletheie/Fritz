export type WritingSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/** Serialize writes so an older slow save cannot overwrite a newer draft.
 * A successful status always refers to the latest revision, never an earlier one. */
export function createWritingAutosave(
  write: (text: string) => Promise<void>,
  status: (value: WritingSaveStatus) => void,
  delay = 350,
): { update: (text: string) => void; flush: () => Promise<boolean> } {
  let pending: string | undefined;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue = Promise.resolve();
  let lastResult = Promise.resolve(true);

  function flush(): Promise<boolean> {
    clearTimeout(timer);
    if (pending === undefined) return lastResult;
    const text = pending;
    const savingRevision = revision;
    pending = undefined;
    status('saving');
    const task = queue.then(() => write(text));
    queue = task.catch(() => {});
    lastResult = task.then(
      () => {
        if (savingRevision === revision) status('saved');
        return true;
      },
      () => {
        if (savingRevision === revision) {
          pending = text;
          status('error');
        }
        return false;
      },
    );
    return lastResult;
  }

  return {
    update(text) {
      pending = text;
      revision += 1;
      clearTimeout(timer);
      status('pending');
      timer = setTimeout(() => {
        void flush();
      }, delay);
    },
    flush,
  };
}
