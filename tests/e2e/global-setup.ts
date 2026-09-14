import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { request } from '@playwright/test';
import type { FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const { baseURL, storageState } = config.projects[0].use;
  if (!baseURL || typeof storageState !== 'string') {
    throw new Error('E2E configuration requires a base URL and an authentication state file.');
  }
  const context = await request.newContext({ baseURL });
  const response = await context.post('/api/auth/login', {
    headers: { Origin: baseURL },
    data: { username: 'test', password: 'correct horse battery staple' },
  });
  if (!response.ok()) {
    throw new Error(`E2E login setup failed with ${response.status()}: ${await response.text()}`);
  }
  await mkdir(path.dirname(path.resolve(storageState)), { recursive: true });
  await context.storageState({ path: path.resolve(storageState) });
  await context.dispose();
}
