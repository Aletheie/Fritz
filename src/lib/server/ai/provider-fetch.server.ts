import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

import { isLoopbackHost, isPublicProviderAddress } from './connection-policy.ts';

const MAX_RESPONSE_BYTES = 1_048_576;

export async function resolveProviderAddress(
  hostname: string,
  allowLocal: boolean,
  resolve = lookup,
): Promise<{ address: string; family: number }> {
  const host = hostname.replace(/^\[|\]$/gu, '');
  if (isLoopbackHost(host) && allowLocal) {
    return { address: host === '::1' ? '::1' : '127.0.0.1', family: host === '::1' ? 6 : 4 };
  }
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await resolve(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicProviderAddress(address))) {
    throw new Error('AI endpoint musí mít veřejnou IP adresu.');
  }
  return addresses.find(({ family }) => family === 4) ?? addresses[0];
}

/** Pin DNS results at the actual socket, refuse redirects and bound response memory. */
export function createProviderFetch(baseURL: string, allowLocal = false): typeof fetch {
  const base = new URL(baseURL);
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (
      url.origin !== base.origin ||
      !url.pathname.startsWith(`${base.pathname.replace(/\/$/u, '')}/`)
    ) {
      throw new Error('AI endpoint změnil cíl požadavku.');
    }
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    signal?.throwIfAborted();
    // The SDK deadline also bounds DNS, even on a resolver that never responds.
    const address = await new Promise<{ address: string; family: number }>((resolve, reject) => {
      const aborted = () => reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
      signal?.addEventListener('abort', aborted, { once: true });
      void resolveProviderAddress(url.hostname, allowLocal)
        .then(resolve, reject)
        .finally(() => {
          signal?.removeEventListener('abort', aborted);
        });
    });
    signal?.throwIfAborted();
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    // No decompression is needed or permitted; the response cap bounds actual bytes consumed.
    headers['accept-encoding'] = 'identity';
    return new Promise<Response>((resolve, reject) => {
      const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
      const request = send(
        url,
        {
          method: init?.method ?? 'POST',
          headers,
          signal: signal ?? undefined,
          agent: false,
          lookup: (_host, _options, done) => {
            if (_options.all) done(null, [address]);
            else done(null, address.address, address.family);
          },
        },
        (response) => {
          const status = response.statusCode ?? 502;
          if (status >= 300 && status < 400) {
            response.destroy();
            reject(new Error('AI endpoint nesmí přesměrovávat požadavky.'));
            return;
          }
          let bytes = 0;
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > MAX_RESPONSE_BYTES) {
              response.destroy(new Error('AI response exceeds size limit.'));
              return;
            }
            chunks.push(chunk);
          });
          response.on('error', reject);
          response.on('end', () => {
            try {
              const responseHeaders = new Headers();
              for (const [key, value] of Object.entries(response.headers)) {
                if (value !== undefined)
                  responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
              }
              resolve(
                new Response(status === 204 || status === 205 ? null : Buffer.concat(chunks), {
                  status,
                  headers: responseHeaders,
                }),
              );
            } catch (error) {
              reject(error);
            }
          });
        },
      );
      request.on('error', (error) => reject(signal?.aborted ? signal.reason : error));
      if (typeof init?.body !== 'string') {
        request.destroy(new Error('AI request body must be JSON text.'));
        return;
      }
      request.end(init.body);
    });
  };
}
