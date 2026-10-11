import { env } from '$env/dynamic/private';
import { parseTrustedProviderUrl } from './provider-policy.ts';

const DEFAULT_INKLING_MODEL = 'thinkingmachines/Inkling-NVFP4';

/** Server-side OpenAI-compatible provider, enabled only with an allowlisted (or explicitly trusted) host. */
export function inklingProviderConfig():
  | { apiKey: string; baseURL: string; model: string }
  | undefined {
  const apiKey = env.INKLING_API_KEY?.trim();
  const endpoint = parseTrustedProviderUrl(env.INKLING_BASE_URL, {
    allowedHosts: new Set(
      (env.INKLING_ALLOWED_HOSTS ?? '')
        .split(',')
        .map((host) => host.trim().toLocaleLowerCase('en-US'))
        .filter(Boolean),
    ),
    allowCustom: env.TRUST_CUSTOM_AI_PROVIDER === 'true',
  });
  if (!apiKey || !endpoint) return undefined;
  const model = env.INKLING_MODEL?.trim();
  return {
    apiKey,
    baseURL: endpoint.baseURL,
    model: model && /^[\w./:-]{1,200}$/u.test(model) ? model : DEFAULT_INKLING_MODEL,
  };
}
