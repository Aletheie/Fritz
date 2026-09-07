type AuthResponse = {
  authenticated: boolean;
  username?: string;
  accountId?: string;
  accountCreatedAt?: string;
  error?: string;
};

export class AuthConnectionError extends Error {}

async function jsonRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 10_000);
  init.signal?.addEventListener('abort', abort, { once: true });
  if (init.signal?.aborted) abort();
  try {
    let response: Response;
    try {
      response = await fetch(path, {
        ...init,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          ...(init.body ? { 'content-type': 'application/json' } : {}),
          ...init.headers,
        },
        cache: 'no-store',
      });
    } catch (cause) {
      throw new AuthConnectionError('Server není dostupný. Zkontroluj připojení.', { cause });
    }
    const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok)
      throw new Error(payload.error || `Server odpověděl stavem ${response.status}.`);
    return payload;
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abort);
  }
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return jsonRequest<AuthResponse>('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<AuthResponse> {
  return jsonRequest<AuthResponse>('/api/auth/logout/', { method: 'POST' });
}

export function getAuthSession(signal?: AbortSignal): Promise<AuthResponse> {
  return jsonRequest<AuthResponse>('/api/auth/session/', { signal });
}
