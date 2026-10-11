import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { errorText, localizedError } from '../domain/errors.ts';
import { localized } from '../i18n/index.ts';
import { jsonRequest } from './http.ts';

import type { MotherTongue } from '../domain/types.ts';

export function supportsPasskeys() {
  return (
    typeof window !== 'undefined' && window.isSecureContext && Boolean(window.PublicKeyCredential)
  );
}

function requireSupport() {
  if (!supportsPasskeys())
    throw localizedError(
      'Otevři Fritz v aktuálním Safari, Chromu nebo Firefoxu na zabezpečené adrese.',
      'Open Fritz in a current Safari, Chrome or Firefox on a secure address.',
    );
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

export function accessError(value: unknown, language: MotherTongue = 'cs'): string {
  if (
    value instanceof Error &&
    (value.name === 'NotAllowedError' ||
      value.name === 'AbortError' ||
      ('code' in value && value.code === 'ERROR_CEREMONY_ABORTED'))
  )
    return localized(language, {
      cs: 'Ověření bylo zrušené nebo vypršelo. Můžeš ho zkusit znovu.',
      en: 'Verification was cancelled or timed out. You can try again.',
    });
  return errorText(value, language, {
    cs: 'Přístup se nepodařilo ověřit. Zkus to znovu.',
    en: 'Access could not be verified. Try again.',
  });
}
