export class ConnectionError extends Error {
  constructor(cause: unknown) {
    super('Server není dostupný. Zkontroluj připojení.', { cause });
  }
}

export async function jsonRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, cache: 'no-store' });
  } catch (cause) {
    if (init.signal?.aborted) throw cause;
    throw new ConnectionError(cause);
  }

  const statusMessage = `Server odpověděl stavem ${response.status}.`;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    if (init.signal?.aborted) throw cause;
    throw new Error(response.ok ? 'Server poslal neplatnou odpověď.' : statusMessage, { cause });
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : undefined;
    throw new Error(message || statusMessage);
  }
  return payload as T;
}
