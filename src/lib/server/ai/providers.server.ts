import { env } from '$env/dynamic/private';
import { parseTrustedProviderUrl } from './provider-policy.ts';

const DEFAULT_INKLING_MODEL = 'thinkingmachines/Inkling-NVFP4';
const DOCUMENTED_INKLING_HOST = 'eetagent--ep-inkling-nvfp4-worty-server.us-west.modal.direct';

export type InklingProviderConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
  trust: 'documented-allowlist' | 'explicit-custom';
};

function configuredBaseUrl():
  | { baseURL: string; trust: InklingProviderConfig['trust'] }
  | undefined {
  const value = env.INKLING_BASE_URL;
  if (!value) return undefined;
  const explicitlyAllowed = new Set(
    [DOCUMENTED_INKLING_HOST, ...(env.INKLING_ALLOWED_HOSTS ?? '').split(',')]
      .map((host) => host.trim().toLocaleLowerCase('en-US'))
      .filter(Boolean),
  );
  return parseTrustedProviderUrl(value, {
    allowedHosts: explicitlyAllowed,
    allowCustom: env.TRUST_CUSTOM_AI_PROVIDER === 'true',
  });
}

function configuredModel(): string {
  const value = env.INKLING_MODEL?.trim();
  return value && /^[\w./:-]{1,200}$/u.test(value) ? value : DEFAULT_INKLING_MODEL;
}

export function inklingProviderConfig(): InklingProviderConfig | undefined {
  const apiKey = env.INKLING_API_KEY?.trim();
  const endpoint = configuredBaseUrl();
  if (!apiKey || !endpoint) return undefined;
  return { apiKey, ...endpoint, model: configuredModel() };
}

export function inklingModelId(): string {
  return configuredModel();
}

export function hasInklingProvider(): boolean {
  return Boolean(inklingProviderConfig());
}
