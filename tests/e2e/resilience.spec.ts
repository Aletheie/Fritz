import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';
import { decryptBackup, encryptBackup } from '../../src/lib/domain/backup/encrypted.ts';
import { createBackupFile, MAX_BACKUP_FILE_BYTES } from '../../src/lib/domain/backup/file.ts';
import { backupWithLongHistory } from '../fixtures/large-backup.ts';
import { completeOnboarding } from './helpers.ts';

test('production responses enforce CSP and private API caching policy', async ({ page }) => {
  const response = await page.goto('/');
  expect(response).not.toBeNull();
  const headers = response?.headers() ?? {};
  const csp = headers['content-security-policy'] ?? '';
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain("'unsafe-eval'");

  const api = await page.request.get('/api/ai/key/');
  expect(api.status()).toBe(200);
  expect(api.headers()['cache-control']).toContain('no-store');
  expect(await api.json()).toMatchObject({
    configured: false,
    mode: 'demo',
    source: 'demo',
    sponsoredAvailable: false,
  });
});

test('AI provider configuration cannot be mutated from the web', async ({ request }) => {
  const response = await request.delete('/api/ai/key/');
  expect(response.status()).toBe(405);
});

test('Settings restores and exports an encrypted backup larger than 10 MB', async ({ page }) => {
  const passphrase = 'synthetic backup test passphrase';
  const backup = backupWithLongHistory();
  const file = createBackupFile(await encryptBackup(backup, passphrase));
  expect(file.size).toBeGreaterThan(10_000_000);
  expect(file.size).toBeLessThanOrEqual(MAX_BACKUP_FILE_BYTES);
  await completeOnboarding(page);
  await page.goto('/settings/');
  await page.getByLabel('Vybrat JSON zálohu k obnovení').setInputFiles({
    name: 'large-encrypted-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(await file.arrayBuffer()),
  });
  await page.getByLabel('Heslo zálohy', { exact: true }).fill(passphrase);
  await page.getByRole('button', { name: 'Ověřit a zobrazit náhled' }).click();
  const preview = page.getByRole('region', { name: 'Co záloha nahradí' });
  await expect(preview).toContainText('1000');
  await page.getByRole('button', { name: 'Rozumím, atomicky obnovit' }).click();
  await expect(
    page.getByText('Záloha large-encrypted-backup.json byla obnovena a ověřena.', { exact: false }),
  ).toBeVisible();

  await page.getByLabel('Heslo (min. 10 znaků)', { exact: true }).fill(passphrase);
  await page.getByLabel('Heslo znovu', { exact: true }).fill(passphrase);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Vytvořit šifrovanou zálohu' }).click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  const bytes = await readFile(downloadedPath!);
  expect(bytes.length).toBeGreaterThan(10_000_000);
  expect(bytes.length).toBeLessThanOrEqual(MAX_BACKUP_FILE_BYTES);
  const restored = await decryptBackup(JSON.parse(bytes.toString('utf8')), passphrase);
  expect(restored.reviews).toHaveLength(backup.reviews.length);
  expect(restored.reviews[0].signal.submittedText).toBe(backup.reviews[0].signal.submittedText);

  await page.getByLabel('Vybrat JSON zálohu k obnovení').setInputFiles(downloadedPath!);
  await page.getByLabel('Heslo zálohy', { exact: true }).fill(passphrase);
  await page.getByRole('button', { name: 'Ověřit a zobrazit náhled' }).click();
  await expect(preview).toContainText('1000');
});

test('Settings accepts the file-size boundary and rejects one byte over it', async ({ page }) => {
  const backup = { ...backupWithLongHistory(), reviews: [] };
  // JSON whitespace lets the same valid backup exercise the exact file-size boundary.
  const bytes = Buffer.alloc(MAX_BACKUP_FILE_BYTES + 1, ' ');
  bytes.write(JSON.stringify(backup), 'utf8');
  await completeOnboarding(page);
  await page.goto('/settings/');
  const input = page.getByLabel('Vybrat JSON zálohu k obnovení');
  await input.setInputFiles({
    name: 'too-large.json',
    mimeType: 'application/json',
    buffer: bytes,
  });
  await expect(
    page.getByText('Záloha je příliš velká. Limit je 48 MiB.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Co záloha nahradí' })).toHaveCount(0);

  await input.setInputFiles({
    name: 'at-limit.json',
    mimeType: 'application/json',
    buffer: bytes.subarray(0, MAX_BACKUP_FILE_BYTES),
  });
  await expect(page.getByRole('region', { name: 'Co záloha nahradí' })).toBeVisible();
  await expect(
    page.getByText('Záloha je příliš velká. Limit je 48 MiB.', { exact: true }),
  ).toHaveCount(0);
});

test('installed service worker serves the app shell offline and never caches API responses', async ({
  context,
  page,
}) => {
  await completeOnboarding(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();

  const apiWasCached = await page.evaluate(async () => {
    const names = await caches.keys();
    const matches = await Promise.all(
      names.map(async (name) => (await caches.open(name)).match('/api/ai/key/')),
    );
    return matches.some(Boolean);
  });
  expect(apiWasCached).toBe(false);

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Kam dál' })).toBeVisible();
  await context.setOffline(false);
});
