import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers.ts';

let mockProvider: Server;
let providerURL: string;
let received: Array<{ model: string; key?: string }> = [];

test.beforeAll(async () => {
  mockProvider = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString()) as { model: string };
    received.push({ model: body.model, key: request.headers.authorization });
    response.setHeader('content-type', 'application/json');
    if (body.model === 'invalid-model') {
      response.writeHead(404).end(JSON.stringify({ error: { message: 'Unknown test model' } }));
      return;
    }
    response.end(
      JSON.stringify({
        id: 'local-fixture',
        object: 'chat.completion',
        created: 1,
        model: body.model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '{"status":"ok"}' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    );
  });
  await new Promise<void>((resolve, reject) => {
    mockProvider.once('error', reject);
    mockProvider.listen(0, '127.0.0.1', resolve);
  });
  providerURL = `http://127.0.0.1:${(mockProvider.address() as AddressInfo).port}/v1`;
});

test.afterAll(async () => {
  mockProvider.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    mockProvider.close((error) => (error ? reject(error) : resolve())),
  );
});

test('settings connects a chosen model, keeps secrets private and preserves the working connection on failure', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000);
  received = [];
  const context = await browser.newContext({
    baseURL,
    locale: 'cs-CZ',
    viewport: { width: 390, height: 844 },
    storageState: { cookies: [], origins: [] },
  });
  const login = await context.request.post('/api/auth/login/', {
    headers: { Origin: baseURL! },
    data: { username: 'test', password: 'correct horse battery staple' },
  });
  expect(login.ok()).toBe(true);
  const page = await context.newPage();
  try {
    await completeOnboarding(page);
    await page.goto('/settings/#ai');
    await expect(page.getByRole('heading', { name: 'Tvoje AI připojení' })).toBeVisible();
    expect(
      (await page.getByLabel('Poskytovatel', { exact: true }).boundingBox())?.height,
    ).toBeGreaterThanOrEqual(44);
    await page.getByLabel('Poskytovatel', { exact: true }).selectOption('openai');
    await expect(page.getByLabel('Základní adresa API')).toHaveValue('https://api.openai.com/v1');
    await page.getByLabel('API klíč', { exact: true }).fill('must-clear-when-provider-changes');
    await page.getByLabel('Poskytovatel', { exact: true }).selectOption('local');
    await expect(page.getByLabel('API klíč (volitelný)', { exact: true })).toHaveValue('');
    await page.getByLabel('Základní adresa API').fill(providerURL);
    await page.getByLabel('ID modelu', { exact: true }).fill('chosen-local-model');
    await page.getByLabel('API klíč (volitelný)', { exact: true }).fill('only-a-test-key');
    await expect(page.getByRole('button', { name: 'Ověřit a připojit' })).toBeDisabled();
    await page.getByRole('checkbox', { name: /Souhlasím s odesíláním/u }).check();
    await page.getByRole('button', { name: 'Ověřit a připojit' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Připojení i formát odpovědi jsou ověřené' }),
    ).toBeVisible();
    await expect(page.getByLabel('API klíč (volitelný)', { exact: true })).toHaveValue('');
    expect(received).toEqual([{ model: 'chosen-local-model', key: 'Bearer only-a-test-key' }]);
    const stored = (await context.cookies()).find(
      (cookie) => cookie.name === 'fritz_ai_connection',
    );
    expect(stored?.httpOnly).toBe(true);
    expect(stored?.sameSite).toBe('Strict');
    expect(stored?.path).toBe('/api/ai');
    expect(stored?.value).not.toContain('only-a-test-key');
    expect(await page.evaluate(() => document.cookie)).not.toContain('fritz_ai_connection');
    const status = await context.request.get('/api/ai/key/');
    expect(await status.text()).not.toContain('only-a-test-key');
    expect((await status.json()).model).toBe('chosen-local-model');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page
      .locator('#ai')
      .screenshot({ path: test.info().outputPath('ai-connection-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page
      .locator('#ai')
      .screenshot({ path: test.info().outputPath('ai-connection-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });

    await page.getByLabel('ID modelu', { exact: true }).fill('invalid-model');
    await page.getByRole('checkbox', { name: /Souhlasím s odesíláním/u }).check();
    await page.getByRole('button', { name: 'Ověřit a připojit' }).click();
    await expect(page.getByRole('alert')).toContainText('Poskytovatel nepřijal model');
    await page.reload();
    await expect(page.locator('#ai')).toContainText('chosen-local-model');
    expect((await (await context.request.get('/api/ai/key/')).json()).source).toBe('user');

    await context.clearCookies({ name: 'fritz_ai_connection' });
    await page.reload();
    await expect(
      page.getByRole('status').filter({ hasText: 'Vlastní připojení vypršelo' }),
    ).toBeVisible();
    const expired = await (await context.request.get('/api/ai/key/')).json();
    expect(expired.mode).toBe('demo');
    expect(expired.userConnectionNeedsAttention).toBe(true);

    await page.getByRole('button', { name: 'Odpojit vlastní AI' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Vlastní připojení je odstraněné' }),
    ).toBeVisible();
    expect((await context.cookies()).some((cookie) => cookie.name === 'fritz_ai_connection')).toBe(
      false,
    );
    expect((await (await context.request.get('/api/ai/key/')).json()).mode).toBe('demo');
    expect((await context.cookies()).some((cookie) => cookie.name === 'fritz_ai_preference')).toBe(
      false,
    );

    const reconnect = await context.request.post('/api/ai/key/', {
      headers: { Origin: baseURL! },
      data: {
        provider: 'openai-compatible',
        apiKey: '',
        model: 'chosen-local-model',
        baseURL: providerURL,
        outputMode: 'text',
      },
    });
    expect(reconnect.ok()).toBe(true);
    expect(received.at(-1)?.key).toBeUndefined();
    const logout = await context.request.post('/api/auth/logout/', {
      headers: { Origin: baseURL! },
    });
    expect(logout.ok()).toBe(true);
    expect((await context.cookies()).some((cookie) => cookie.name === 'fritz_ai_connection')).toBe(
      false,
    );
    expect((await context.request.get('/api/ai/key/')).status()).toBe(401);
    expect((await context.cookies()).some((cookie) => cookie.name === 'fritz_ai_preference')).toBe(
      false,
    );
  } finally {
    await context.close();
  }
});
