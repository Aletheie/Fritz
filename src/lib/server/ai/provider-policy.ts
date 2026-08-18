export type TrustedProviderEndpoint = {
  baseURL: string;
  trust: 'documented-allowlist' | 'explicit-custom';
};

export function parseTrustedProviderUrl(
  value: string | undefined,
  options: { allowedHosts: ReadonlySet<string>; allowCustom: boolean },
): TrustedProviderEndpoint | undefined {
  if (!value || value !== value.trim()) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/v1' && url.pathname !== '/v1/')
    ) {
      return undefined;
    }
    const hostname = url.hostname.toLocaleLowerCase('en-US');
    if (options.allowedHosts.has(hostname)) {
      return {
        baseURL: url.toString().replace(/\/$/u, ''),
        trust: 'documented-allowlist',
      };
    }
    return options.allowCustom
      ? { baseURL: url.toString().replace(/\/$/u, ''), trust: 'explicit-custom' }
      : undefined;
  } catch {
    return undefined;
  }
}
