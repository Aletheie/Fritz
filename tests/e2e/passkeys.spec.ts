import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { test as base, expect } from '@playwright/test';
import type { BrowserContext, CDPSession, Page } from '@playwright/test';
import type { AuthenticationResponseJSON } from '@simplewebauthn/browser';
import {
  createAccessGrant,
  issueSession,
  readProfile,
  tokenHash,
  updateProfile,
} from '../../scripts/lib/profile-store.mjs';
import { encryptStoredApiKey } from '../../src/lib/server/ai/key-crypto.server.ts';
import { hashPassword } from '../../src/lib/server/auth/password.server.ts';
import { completeOnboarding } from './helpers.ts';

const secret = Buffer.alloc(32, 19).toString('base64url');
type Personal = {
  directory: string;
  origin: string;
  context: BrowserContext;
  page: Page;
  cdp: CDPSession;
  authenticatorId: string;
};
const test = base.extend<{ personal: Personal }>({
  // Virtual authenticators belong to a dedicated browser process, independent of other UI suites.
  browser: [
    async ({ playwright, browserName, launchOptions }, use) => {
      const browser = await playwright[browserName].launch(launchOptions);
      try {
        await use(browser);
      } finally {
        await browser.close();
      }
    },
    { scope: 'worker' },
  ],
  personal: async ({ browser }, use) => {
    const directory = await mkdtemp(join(tmpdir(), 'fritz-passkey-e2e-'));
    const child = spawn(process.execPath, ['tests/fixtures/personal-server.mjs'], {
      env: {
        ...process.env,
        FRITZ_AUTH_DATA_DIR: directory,
        FRITZ_RUNTIME: 'web',
        AI_KEY_ENCRYPTION_SECRET: secret,
        AI_SPONSORED_MODE: 'off',
        AI_USER_CONNECTIONS: 'on',
        AI_ALLOW_LOCAL_PROVIDERS: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += String(data);
    });
    let context: BrowserContext | undefined;
    try {
      const origin = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`Personal server timeout: ${stderr}`)),
          20_000,
        );
        let buffer = '';
        child.stdout.on('data', (data) => {
          buffer += String(data);
          const match = buffer.match(/\{"origin":"([^"\n]+)"\}/u);
          if (match) {
            clearTimeout(timeout);
            resolve(match[1]);
          }
        });
        child.once('error', (value) => {
          clearTimeout(timeout);
          reject(value);
        });
        child.once('exit', (code) => {
          clearTimeout(timeout);
          reject(new Error(`Personal server exited ${code}: ${stderr}`));
        });
      });
      context = await browser.newContext({
        baseURL: origin,
        storageState: { cookies: [], origins: [] },
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send('WebAuthn.enable');
      const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
          protocol: 'ctap2',
          transport: 'internal',
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      });
      await use({ directory, origin, context, page, cdp, authenticatorId });
    } finally {
      await context?.close();
      if (child.exitCode === null && child.signalCode === null) {
        const exit = once(child, 'exit');
        child.kill('SIGTERM');
        await exit;
      }
      await rm(directory, { recursive: true, force: true });
    }
  },
});

async function activate(personal: Personal) {
  const token = await createAccessGrant(personal.directory);
  await personal.page.goto(`/login/#setup=${token}`);
  await expect(personal.page.getByRole('button', { name: 'Vytvořit passkey' })).toBeEnabled();
  expect(new URL(personal.page.url()).hash).toBe('');
  expect((await personal.context.request.get('/api/ai/key/')).status()).toBe(401);
  await personal.page.getByRole('button', { name: 'Vytvořit passkey' }).click();
  await expect(personal.page.getByLabel('Tvůj obnovovací kód')).toBeVisible();
  const recovery = await personal.page.getByLabel('Tvůj obnovovací kód').inputValue();
  expect(recovery).toMatch(/^[\w-]{43}$/u);
  await personal.page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await completeOnboarding(personal.page);
  return { token, recovery };
}

test('ordinary logout is public and idempotent while retaining origin checks', async ({
  personal,
}) => {
  const { context, origin, directory } = personal;
  expect(readProfile(directory)).toBeUndefined();
  expect((await context.request.post('/api/auth/logout')).status()).toBe(403);
  expect(
    (
      await context.request.post('/api/auth/logout', {
        headers: { Origin: 'https://attacker.example' },
      })
    ).status(),
  ).toBe(403);
  const first = await context.request.post('/api/auth/logout', { headers: { Origin: origin } });
  expect(first.status()).toBe(200);
  expect(await first.json()).toEqual({ authenticated: false });
  expect(first.headers()['cache-control']).toContain('no-store');
  expect(
    (await context.request.post('/api/auth/logout', { headers: { Origin: origin } })).status(),
  ).toBe(200);
  expect(readProfile(directory)).toBeUndefined();
  expect(
    (await context.request.post('/api/auth/logout-all', { headers: { Origin: origin } })).status(),
  ).toBe(401);
});

for (const state of ['expired', 'revoked'] as const) {
  test(`ordinary logout clears remembered offline access after a session is ${state}`, async ({
    personal,
  }) => {
    const { context, page, directory, origin } = personal;
    await activate(personal);
    expect(await page.evaluate(() => localStorage.getItem('fritz_auth_seen'))).toBeTruthy();
    await page.evaluate(() => localStorage.setItem('wortly_auth_seen', '1'));
    await context.addCookies([
      {
        name: 'fritz_ai_connection',
        value: 'synthetic-old-connection',
        domain: 'localhost',
        path: '/api/ai',
        httpOnly: true,
        sameSite: 'Strict',
      },
    ]);
    const cookie = (await context.cookies()).find((value) => value.name === 'fritz_session')!;
    await updateProfile(directory, (profile) => {
      const hash = tokenHash(cookie.value);
      if (state === 'expired') profile.sessions[hash].expiresAt = Date.now() - 1;
      else delete profile.sessions[hash];
    });
    expect(
      (
        await context.request.post('/api/auth/logout-all', { headers: { Origin: origin } })
      ).status(),
    ).toBe(401);
    const loggedOut = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url() === `${origin}/api/auth/logout`,
    );
    await page.getByRole('button', { name: 'Odhlásit', exact: true }).first().click();
    expect((await loggedOut).status()).toBe(200);
    await expect(page).toHaveURL(`${origin}/login/`);
    expect(
      await page.evaluate(() => [
        localStorage.getItem('fritz_auth_seen'),
        localStorage.getItem('wortly_auth_seen'),
      ]),
    ).toEqual([null, null]);
    expect(
      (await context.cookies()).filter((value) =>
        ['fritz_session', 'fritz_ai_connection'].includes(value.name),
      ),
    ).toEqual([]);
    expect(
      (await context.request.post('/api/auth/logout', { headers: { Origin: origin } })).status(),
    ).toBe(200);
    expect(Object.keys(readProfile(directory)!.sessions)).toHaveLength(0);
  });
}

test('personal activation, passkey login and persistent AI work across authorized browsers', async ({
  personal,
  browser,
}, info) => {
  test.setTimeout(90_000);
  const { page, context, origin, directory, cdp, authenticatorId } = personal;
  await Promise.all(
    [
      '/api/ai/key/',
      '/api/auth/passkeys/',
      '/api/auth/recovery-code/',
      '/api/auth/logout-all/',
    ].map(async (path) => {
      const response = await context.request.get(path);
      expect(response.status()).toBe(401);
    }),
  );
  await page.goto('/login/');
  await expect(page.getByRole('heading', { name: 'Tvůj osobní Fritz' })).toBeVisible();
  const { token, recovery } = await activate(personal);
  const accountId = readProfile(directory)!.accountId;
  expect((await readFile(join(directory, 'auth.json'), 'utf8')).includes(recovery)).toBe(false);
  expect(
    (
      await context.request.post('/api/auth/setup/exchange/', {
        headers: { Origin: origin },
        data: { token },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await context.request.post('/api/auth/passkeys/register/verify/', {
        headers: { Origin: origin },
        data: { response: {} },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await context.request.post('/api/auth/logout-all/', {
        headers: { Origin: 'https://attacker.example' },
      })
    ).status(),
  ).toBe(403);
  expect(await page.evaluate(() => document.cookie)).not.toContain('fritz_session');

  let calls = 0;
  const provider = createServer(async (request, response) => {
    calls += 1;
    for await (const chunk of request) {
      void chunk;
    }
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({
        id: 'test',
        object: 'chat.completion',
        created: 1,
        model: 'test',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '{"status":"ok"}' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      }),
    );
  });
  await new Promise<void>((resolve) => provider.listen(0, '127.0.0.1', resolve));
  const address = provider.address();
  if (!address || typeof address === 'string') throw new Error('Missing mock provider address');
  const other = await browser.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [] },
  });
  try {
    const connection = {
      provider: 'openai-compatible',
      apiKey: 'synthetic-personal-key',
      model: 'test',
      baseURL: `http://localhost:${address.port}/v1`,
      outputMode: 'json',
    };
    const saved = await context.request.post('/api/ai/key/', {
      headers: { Origin: origin },
      data: connection,
    });
    expect(saved.status(), await saved.text()).toBe(200);
    expect(calls).toBe(1);
    expect((await readFile(join(directory, 'auth.json'), 'utf8')).includes(connection.apiKey)).toBe(
      false,
    );
    expect((await context.cookies()).some((cookie) => cookie.name === 'fritz_ai_connection')).toBe(
      false,
    );
    const oldSession = (await context.cookies()).find((cookie) => cookie.name === 'fritz_session')!;
    await context.request.post('/api/auth/logout/', { headers: { Origin: origin } });
    expect((await context.request.get('/api/ai/key/')).status()).toBe(401);
    await page.goto('/login/');
    await expect(page.getByRole('button', { name: 'Pokračovat s passkey' })).toBeVisible();
    await page.screenshot({ path: info.outputPath('passkey-login-mobile.png') });
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Pokračovat s passkey' }).click();
    await expect(page).not.toHaveURL(/\/login/u);
    const status = await context.request.get('/api/ai/key/');
    expect((await status.json()).configured).toBe(true);
    expect(await status.text()).not.toContain(connection.apiKey);
    expect(
      (
        await fetch(`${origin}/api/ai/key/`, {
          headers: { Cookie: `fritz_session=${oldSession.value}` },
        })
      ).status,
    ).toBe(401);
    expect(readProfile(directory)!.accountId).toBe(accountId);

    const secondPage = await other.newPage();
    const secondCdp = await other.newCDPSession(secondPage);
    await secondCdp.send('WebAuthn.enable');
    const secondAuth = await secondCdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
      },
    });
    const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
    await secondCdp.send('WebAuthn.addCredential', {
      authenticatorId: secondAuth.authenticatorId,
      credential: credentials[0],
    });
    await secondPage.goto('/login/');
    await secondPage.getByRole('button', { name: 'Pokračovat s passkey' }).click();
    await expect(secondPage).not.toHaveURL(/\/login/u);
    expect((await (await other.request.get('/api/ai/key/')).json()).configured).toBe(true);
    await context.request.delete('/api/ai/key/', { headers: { Origin: origin } });
    expect((await (await other.request.get('/api/ai/key/')).json()).mode).toBe('demo');
    const stale = encryptStoredApiKey(JSON.stringify({ accountId, connection }), secret);
    await other.addCookies([
      {
        name: 'fritz_ai_connection',
        value: stale,
        domain: 'localhost',
        path: '/api/ai',
        httpOnly: true,
        sameSite: 'Strict',
      },
    ]);
    expect(
      (await other.request.post('/api/ai/key/migrate/', { headers: { Origin: origin } })).status(),
    ).toBe(409);
    expect((await (await other.request.get('/api/ai/key/')).json()).mode).toBe('demo');
    expect(calls).toBe(1);
    await context.request.post('/api/auth/logout-all/', { headers: { Origin: origin } });
    expect((await other.request.get('/api/ai/key/')).status()).toBe(401);
    expect((await context.request.get('/api/auth/passkeys/')).status()).toBe(401);
  } finally {
    await other.close();
    provider.closeAllConnections();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
});

test('recovery replaces lost credentials, keeps profile identity and rejects expired grants', async ({
  personal,
}) => {
  test.setTimeout(90_000);
  const { context, page, directory, origin, cdp, authenticatorId } = personal;
  const { recovery } = await activate(personal);
  const before = readProfile(directory)!;
  const oldCredentialId = before.passkeys[0].id;
  const oldCookie = (await context.cookies()).find((cookie) => cookie.name === 'fritz_session')!;
  await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
  const replacement = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  await context.clearCookies();
  await page.goto('/login/');
  await page.getByRole('button', { name: 'Použít obnovovací kód' }).click();
  await page.getByLabel('Obnovovací kód', { exact: true }).fill(recovery);
  await page.getByRole('button', { name: 'Obnovit přístup', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Vytvořit passkey' })).toBeVisible();
  expect((await context.request.get('/api/ai/key/')).status()).toBe(401);
  await page.getByRole('button', { name: 'Vytvořit passkey' }).click();
  await expect(page.getByLabel('Tvůj obnovovací kód')).toBeVisible();
  const nextRecovery = await page.getByLabel('Tvůj obnovovací kód').inputValue();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze())
      .violations,
  ).toEqual([]);
  expect(nextRecovery).not.toBe(recovery);
  const after = readProfile(directory)!;
  expect(after.accountId).toBe(before.accountId);
  expect(after.createdAt).toBe(before.createdAt);
  expect(after.passkeys).toHaveLength(1);
  expect(after.passkeys[0].id).not.toBe(oldCredentialId);
  expect(
    (
      await fetch(`${origin}/api/ai/key/`, {
        headers: { Cookie: `fritz_session=${oldCookie.value}` },
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await context.request.post('/api/auth/recovery/exchange/', {
        headers: { Origin: origin },
        data: { token: recovery },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await context.request.delete(`/api/auth/passkeys/${after.passkeys[0].id}/`, {
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(409);
  const expired = await createAccessGrant(directory, true, Date.now() - 11 * 60_000);
  expect(
    (
      await context.request.post('/api/auth/setup/exchange/', {
        headers: { Origin: origin },
        data: { token: expired },
      })
    ).status(),
  ).toBe(400);
  const newLink = await createAccessGrant(directory, true);
  expect(
    (
      await context.request.post('/api/auth/setup/exchange/', {
        headers: { Origin: origin },
        data: { token: newLink },
      })
    ).status(),
  ).toBe(200);
  await cdp.send('WebAuthn.removeVirtualAuthenticator', {
    authenticatorId: replacement.authenticatorId,
  });
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  await page.goto('/login/');
  await page.getByRole('button', { name: 'Vytvořit passkey' }).click();
  await expect(page.getByLabel('Tvůj obnovovací kód')).toBeVisible();
  expect(readProfile(directory)!.passkeys[0].id).not.toBe(after.passkeys[0].id);
  expect(readProfile(directory)!.accountId).toBe(before.accountId);
});

test('legacy password and AI cookie migrate explicitly without resetting learning identity', async ({
  personal,
}) => {
  test.setTimeout(60_000);
  const { directory, context, page, origin } = personal;
  const createdAt = '2026-01-01T00:00:00.000Z';
  const password = 'synthetic legacy password';
  await writeFile(
    join(directory, 'auth.json'),
    JSON.stringify({
      version: 1,
      username: 'test',
      createdAt,
      passwordHash: hashPassword(password),
      sessions: {},
    }),
  );
  const accountId = tokenHash(`${createdAt}\u0000test`);
  await page.goto('/login/');
  await page.getByLabel('Uživatelské jméno').fill('test');
  await page.getByLabel('Heslo', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await expect(page).not.toHaveURL(/\/login/u);
  await completeOnboarding(page);
  const connection = {
    provider: 'google-gemini',
    apiKey: 'only-synthetic-legacy-key',
    model: 'synthetic-model',
  };
  await context.addCookies([
    {
      name: 'fritz_ai_connection',
      value: encryptStoredApiKey(JSON.stringify({ accountId, connection }), secret),
      domain: 'localhost',
      path: '/api/ai',
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  await page.goto('/settings/');
  await expect(page.getByRole('button', { name: 'Uložit pro tuto instalaci' })).toBeVisible();
  expect(readProfile(directory)!.ai).toBeUndefined();
  await page.getByRole('button', { name: 'Uložit pro tuto instalaci' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'AI připojení je uložené' }),
  ).toBeVisible();
  expect(readProfile(directory)!.ai?.state).toBe('connected');
  await page.getByLabel('Dosavadní heslo').fill(password);
  await page.getByRole('button', { name: 'Přejít na passkey' }).click();
  await expect(page.getByLabel('Tvůj obnovovací kód')).toBeVisible();
  expect(readProfile(directory)!.accountId).toBe(accountId);
  expect(readProfile(directory)!.passwordHash).toBeUndefined();
  expect((await (await context.request.get('/api/ai/key/')).json()).configured).toBe(true);
  expect(
    (
      await context.request.post('/api/auth/login/', {
        headers: { Origin: origin },
        data: { username: 'test', password },
      })
    ).status(),
  ).toBe(401);
  await page.reload();
  await expect(page.locator('.settings-page')).toBeVisible();
  await updateProfile(directory, (profile) => {
    for (const session of Object.values(profile.sessions)) session.authenticatedAt = 0;
  });
  expect(
    (
      await context.request.post('/api/auth/recovery-code/', { headers: { Origin: origin } })
    ).status(),
  ).toBe(403);
  expect(
    (await context.request.post('/api/auth/logout-all', { headers: { Origin: origin } })).status(),
  ).toBe(403);
});

test('adding and removing a passkey revokes its other sessions and keeps the last key', async ({
  personal,
}) => {
  test.setTimeout(60_000);
  const { page, directory, cdp, authenticatorId, origin, context } = personal;
  await activate(personal);
  const original = readProfile(directory)!.passkeys[0];
  const otherSession = await updateProfile(directory, (profile) =>
    issueSession(profile, 'passkey', original.id),
  );
  expect(
    (
      await fetch(`${origin}/api/ai/key/`, {
        headers: { Cookie: `fritz_session=${otherSession.token}` },
      })
    ).status,
  ).toBe(200);
  await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  await page.goto('/settings/');
  await page.getByLabel('Název passkey').fill('Telefon');
  await page.getByRole('button', { name: 'Přidat passkey' }).click();
  await expect(page.locator('#access li')).toHaveCount(2);
  const oldKey = page.locator('#access li').filter({ hasText: 'Osobní passkey' });
  await oldKey.getByRole('button', { name: 'Odebrat', exact: true }).click();
  await oldKey.getByRole('button', { name: 'Potvrdit odebrání' }).click();
  await expect(page.locator('#access li')).toHaveCount(1);
  await expect(
    page.locator('#access').getByRole('button', { name: 'Odebrat', exact: true }),
  ).toBeDisabled();
  expect(
    (
      await fetch(`${origin}/api/ai/key/`, {
        headers: { Cookie: `fritz_session=${otherSession.token}` },
      })
    ).status,
  ).toBe(401);
  await updateProfile(directory, (profile) => {
    for (const session of Object.values(profile.sessions)) session.authenticatedAt = 0;
  });
  expect(
    (
      await context.request.post('/api/auth/recovery-code/', { headers: { Origin: origin } })
    ).status(),
  ).toBe(403);
  await page.reload();
  await page.getByRole('button', { name: 'Vytvořit nový obnovovací kód' }).click();
  await expect(page.getByLabel('Tvůj obnovovací kód')).toBeVisible();
});

test('passkey verification rejects replay, another browser, changed origin, expiry and invalid proofs', async ({
  personal,
  browser,
}) => {
  test.setTimeout(60_000);
  const { context, page, directory, origin, cdp, authenticatorId } = personal;
  await activate(personal);
  await context.request.post('/api/auth/logout', { headers: { Origin: origin } });
  await page.goto('/login/');

  const proof = async () => {
    const response = await context.request.post('/api/auth/passkeys/authenticate/options', {
      headers: { Origin: origin },
    });
    expect(response.status()).toBe(200);
    const options = await response.json();
    return page.evaluate(async (requestOptions) => {
      const credential = (await navigator.credentials.get({
        publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(requestOptions),
      })) as PublicKeyCredential;
      return { response: credential.toJSON() };
    }, options);
  };
  const verify = (data: Awaited<ReturnType<typeof proof>>) =>
    context.request.post('/api/auth/passkeys/authenticate/verify', {
      headers: { Origin: origin },
      data,
    });
  const valid = await proof();
  const other = await browser.newContext({
    baseURL: origin,
    storageState: { cookies: [], origins: [] },
  });
  try {
    expect(
      (
        await other.request.post('/api/auth/passkeys/authenticate/verify', {
          headers: { Origin: origin },
          data: valid,
        })
      ).status(),
    ).toBe(400);
    expect((await verify(valid)).status()).toBe(200);
    expect((await verify(valid)).status()).toBe(400);
    await context.request.post('/api/auth/logout', { headers: { Origin: origin } });

    const original = await proof();
    const tampered = structuredClone(original);
    const response = tampered.response as AuthenticationResponseJSON;
    const clientData = JSON.parse(
      Buffer.from(response.response.clientDataJSON, 'base64url').toString(),
    );
    clientData.origin = 'https://attacker.example';
    response.response.clientDataJSON = Buffer.from(JSON.stringify(clientData)).toString(
      'base64url',
    );
    expect((await verify(tampered)).status()).toBe(400);
    expect((await verify(original)).status()).toBe(400);

    const expired = await proof();
    await updateProfile(directory, (profile) => {
      for (const challenge of Object.values(profile.challenges))
        challenge.expiresAt = Date.now() - 1;
    });
    expect((await verify(expired)).status()).toBe(400);

    await cdp.send('WebAuthn.setResponseOverrideBits', { authenticatorId, isBadUV: true });
    expect((await verify(await proof())).status()).toBe(400);
    await cdp.send('WebAuthn.setResponseOverrideBits', {
      authenticatorId,
      isBadUV: false,
      isBogusSignature: true,
    });
    expect((await verify(await proof())).status()).toBe(400);
    expect((await context.request.get('/api/ai/key')).status()).toBe(401);
    expect(Object.keys(readProfile(directory)!.sessions)).toHaveLength(0);
  } finally {
    await other.close();
  }
});
