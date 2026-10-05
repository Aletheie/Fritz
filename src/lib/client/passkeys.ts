import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { jsonRequest } from './http.ts';

export function supportsPasskeys() {
  return (
    typeof window !== 'undefined' && window.isSecureContext && Boolean(window.PublicKeyCredential)
  );
}

function requireSupport() {
  if (!supportsPasskeys())
    throw new Error('Otevři Fritz v aktuálním Safari, Chromu nebo Firefoxu na zabezpečené adrese.');
}

export function exchangeAccessToken(token: string, recovery = false) {
  return jsonRequest<{ enrollmentPending: boolean }>(
    `/api/auth/${recovery ? 'recovery' : 'setup'}/exchange/`,
    { method: 'POST', body: JSON.stringify({ token }) },
  );
}

export async function loginWithPasskey() {
  requireSupport();
  const { startAuthentication } = await import('@simplewebauthn/browser');
  const optionsJSON = await jsonRequest<PublicKeyCredentialRequestOptionsJSON>(
    '/api/auth/passkeys/authenticate/options/',
    { method: 'POST' },
  );
  const response = await startAuthentication({ optionsJSON });
  return jsonRequest<{ authenticated: boolean }>('/api/auth/passkeys/authenticate/verify/', {
    method: 'POST',
    body: JSON.stringify({ response }),
  });
}

export async function registerPasskey(name = 'Osobní passkey') {
  requireSupport();
  const { startRegistration } = await import('@simplewebauthn/browser');
  const optionsJSON = await jsonRequest<PublicKeyCredentialCreationOptionsJSON>(
    '/api/auth/passkeys/register/options/',
    { method: 'POST' },
  );
  const response = await startRegistration({ optionsJSON });
  return jsonRequest<{ authenticated: boolean; recoveryCode?: string }>(
    '/api/auth/passkeys/register/verify/',
    { method: 'POST', body: JSON.stringify({ response, name }) },
  );
}

export function accessError(value: unknown) {
  if (
    value instanceof Error &&
    (value.name === 'NotAllowedError' ||
      value.name === 'AbortError' ||
      ('code' in value && value.code === 'ERROR_CEREMONY_ABORTED'))
  )
    return 'Ověření bylo zrušené nebo vypršelo. Můžeš ho zkusit znovu.';
  return value instanceof Error ? value.message : 'Přístup se nepodařilo ověřit. Zkus to znovu.';
}
