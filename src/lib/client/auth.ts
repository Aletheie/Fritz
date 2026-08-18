type AuthResponse = {
  authenticated: boolean;
  username?: string;
  error?: string;
};

async function jsonRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Server odpověděl stavem ${response.status}.`);
  return payload;
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

export function getAuthSession(): Promise<AuthResponse> {
  return jsonRequest<AuthResponse>('/api/auth/session/');
}
