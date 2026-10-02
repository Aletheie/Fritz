import { isIP } from 'node:net';
import { z } from 'zod';

export const aiConnectionSchema = z
  .object({
    provider: z.enum(['google-gemini', 'anthropic', 'openai-compatible']),
    apiKey: z
      .string()
      .trim()
      .max(512)
      .refine(
        (value) =>
          ![...value].some(
            (character) =>
              /\s/u.test(character) ||
              character.charCodeAt(0) < 32 ||
              character.charCodeAt(0) === 127,
          ),
      ),
    model: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[\w./:@+-]+$/u),
    baseURL: z.string().trim().max(512).optional(),
    outputMode: z.enum(['schema', 'json', 'text']).default('json'),
  })
  .strict();

export function userConnectionsAllowed(value: string | undefined): boolean {
  return !['off', 'false', '0'].includes(value?.trim().toLowerCase() ?? '');
}

export function isLoopbackHost(host: string): boolean {
  const value = host.replace(/^\[|\]$/gu, '').toLowerCase();
  return value === 'localhost' || value === '::1' || value === '127.0.0.1';
}

/** Only globally routable addresses are permitted for user-selected remote endpoints. */
export function isPublicProviderAddress(address: string): boolean {
  const value = address.replace(/^\[|\]$/gu, '').toLowerCase();
  if (isIP(value) === 4) {
    const [a, b, c] = value.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && ((b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99) || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  const [first, second] = value.split(':').map((group) => Number.parseInt(group || '0', 16));
  // Restrict IPv6 to global unicast; exclude special-purpose, documentation and IPv4 tunnels.
  return (
    isIP(value) === 6 &&
    /^[23][0-9a-f]{3}:/u.test(value) &&
    !(first === 0x2001 && (second <= 0x1ff || second === 0xdb8)) &&
    first !== 0x2002 &&
    first !== 0x3fff
  );
}

export function parseUserProviderUrl(value: string, allowLocal: boolean): string | undefined {
  try {
    const url = new URL(value);
    const local = isLoopbackHost(url.hostname);
    if (
      value !== value.trim() ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.protocol !== 'https:' && !(allowLocal && local && url.protocol === 'http:')) ||
      (local && !allowLocal) ||
      (!local &&
        isIP(url.hostname.replace(/^\[|\]$/gu, '')) &&
        !isPublicProviderAddress(url.hostname)) ||
      (/(?:^|\.)(?:localhost|local|internal|home|lan)$/iu.test(url.hostname) && !local)
    )
      return undefined;
    return url.toString().replace(/\/+$/u, '');
  } catch {
    return undefined;
  }
}

export function parseAiConnection(value: unknown, allowLocal: boolean) {
  const parsed = aiConnectionSchema.safeParse(value);
  if (!parsed.success) return undefined;
  const config = parsed.data;
  if (config.provider !== 'openai-compatible') {
    return config.apiKey
      ? { ...config, baseURL: undefined, outputMode: 'schema' as const }
      : undefined;
  }
  const baseURL = parseUserProviderUrl(config.baseURL ?? '', allowLocal);
  if (!baseURL || (!config.apiKey && !isLoopbackHost(new URL(baseURL).hostname))) return undefined;
  return { ...config, baseURL };
}
