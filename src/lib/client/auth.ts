import { ConnectionError, jsonRequest } from './http.ts';

export { ConnectionError as AuthConnectionError };

type AuthResponse = {
  authenticated: boolean;
  username?: string;
  accountId?: string;
  accountCreatedAt?: string;
  error?: string;
};

async function authRequest(path: string, init: RequestInit = {}): Promise<AuthResponse> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 10_000);
  init.signal?.addEventListener('abort', abort, { once: true });
  if (init.signal?.aborted) abort();
  try {
    return await jsonRequest<AuthResponse>(path, { ...init, signal: controller.signal });
  } catch (cause) {
    if (controller.signal.aborted && !init.signal?.aborted) throw new ConnectionError(cause);
    throw cause;
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abort);
  }
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return authRequest('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<AuthResponse> {
  return authRequest('/api/auth/logout/', { method: 'POST' });
}

export function getAuthSession(signal?: AbortSignal): Promise<AuthResponse> {
  return authRequest('/api/auth/session/', { signal });
}
