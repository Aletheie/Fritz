import { createAccessGrant, profileDirectory, webAuthnOrigin } from './lib/profile-store.mjs';

try {
  const { origin } = webAuthnOrigin(process.env.ORIGIN || 'http://localhost:3000');
  const token = await createAccessGrant(profileDirectory(), process.argv.includes('--recover'));
  // Explicit terminal output only. The fragment never enters HTTP/proxy access logs.
  process.stdout.write(
    `Otevři tento soukromý odkaz do 10 minut:\n${origin}/login/#setup=${token}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Aktivační odkaz se nepodařilo vytvořit.'}\n`,
  );
  process.exitCode = 1;
}
