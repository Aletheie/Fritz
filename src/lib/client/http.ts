export class ConnectionError extends Error {
  constructor(cause: unknown) {
    super('Server není dostupný. Zkontroluj připojení.', { cause });
  }
}

async function send(path: string, init: RequestInit, accept: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('accept')) headers.set('accept', accept);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  try {
    return await fetch(path, { ...init, headers, cache: 'no-store' });
  } catch (cause) {
    if (init.signal?.aborted) throw cause;
    throw new ConnectionError(cause);
  }
}

function errorMessage(payload: unknown): string | undefined {
  return payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string'
    ? payload.error
    : undefined;
}

async function readJson<T>(response: Response, signal?: AbortSignal | null): Promise<T> {
  const statusMessage = `Server odpověděl stavem ${response.status}.`;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new Error(response.ok ? 'Server poslal neplatnou odpověď.' : statusMessage, { cause });
  }
  if (!response.ok) throw new Error(errorMessage(payload) || statusMessage);
  return payload as T;
}

export async function jsonRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return readJson<T>(await send(path, init, 'application/json'), init.signal);
}

/**
 * Reads a newline-delimited JSON stream of `{ type, ... }` events until a `result` event.
 * Endpoints may still answer with plain JSON (demo mode, validation errors), which is returned as is.
 */
export async function streamRequest<T>(
  path: string,
  init: RequestInit,
  onEvent: (event: { type: string } & Record<string, unknown>) => void,
): Promise<T> {
  const response = await send(path, init, 'application/x-ndjson, application/json');
  if (!response.headers.get('content-type')?.includes('ndjson') || !response.body) {
    return readJson<T>(response, init.signal);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    // Stream chunks must be read in order.
    // oxlint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    buffer += value ?? '';
    const lines = buffer.split('\n');
    buffer = done ? '' : (lines.pop() ?? '');
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as { type: string } & Record<string, unknown>;
      if (event.type === 'result') return event.result as T;
      if (event.type === 'error') throw new Error(errorMessage(event) || 'AI selhala.');
      onEvent(event);
    }
    if (done) throw new Error('Server ukončil odpověď předčasně.');
  }
}
