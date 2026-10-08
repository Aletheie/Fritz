import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('release SBOM retains every locked version of the same dependency', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fritz-sbom-'));
  try {
    await mkdir(join(directory, 'scripts'));
    await copyFile(
      new URL('../scripts/generate-sbom.ts', import.meta.url),
      join(directory, 'scripts/generate-sbom.ts'),
    );
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({ name: 'sbom-fixture', version: '1.0.0', type: 'module', license: 'MIT' }),
    );
    await writeFile(
      join(directory, 'pnpm-lock.yaml'),
      `lockfileVersion: '9.0'
packages:
  '@example/shared@1.0.0':
    resolution: {integrity: fixture}
  '@example/shared@2.0.0':
    resolution: {integrity: fixture}
  utility@1.0.0:
    resolution: {integrity: fixture}
snapshots:
  '@example/shared@1.0.0': {}
  '@example/shared@2.0.0': {}
  utility@1.0.0: {}
`,
    );
    const result = spawnSync(
      process.execPath,
      ['--experimental-strip-types', join(directory, 'scripts/generate-sbom.ts')],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    const document = JSON.parse(
      await readFile(join(directory, 'artifacts/sbom/fritz.spdx.json'), 'utf8'),
    ) as {
      packages: Array<{ SPDXID: string; name: string; versionInfo: string }>;
      relationships: Array<{ relatedSpdxElement: string }>;
    };
    const dependencies = document.packages.slice(1);
    assert.deepEqual(dependencies.map((entry) => `${entry.name}@${entry.versionInfo}`).toSorted(), [
      '@example/shared@1.0.0',
      '@example/shared@2.0.0',
      'utility@1.0.0',
    ]);
    assert.equal(new Set(document.packages.map((entry) => entry.SPDXID)).size, 4);
    assert.deepEqual(
      document.relationships.map((entry) => entry.relatedSpdxElement).toSorted(),
      dependencies.map((entry) => entry.SPDXID).toSorted(),
    );
    const report = JSON.parse(
      await readFile(join(directory, 'artifacts/sbom/fritz-licenses.json'), 'utf8'),
    ) as { packages: Array<{ name: string; version: string }> };
    assert.deepEqual(
      report.packages
        .filter((entry) => entry.name === '@example/shared')
        .map((entry) => entry.version),
      ['1.0.0', '2.0.0'],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
