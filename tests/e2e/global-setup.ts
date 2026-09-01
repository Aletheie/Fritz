import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { request } from '@playwright/test';

export default async function globalSetup(): Promise<void> {
  const baseURL = 'http://127.0.0.1:4173';
  const context = await request.newContext({ baseURL });
  const response = await context.post('/api/auth/login', {
    headers: { Origin: baseURL },
    data: { username: 'test', password: 'correct horse battery staple' },
  });
  if (!response.ok()) {
    throw new Error(`E2E login setup failed with ${response.status()}: ${await response.text()}`);
  }
  await mkdir(path.resolve('artifacts/playwright'), { recursive: true });
  await context.storageState({ path: path.resolve('artifacts/playwright/auth.json') });
  await context.dispose();
}
