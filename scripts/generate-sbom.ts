import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
  name: string;
  version: string;
  license?: string;
};
const lockfile = await readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8');
const packagesBlock = lockfile.split(/^packages:\s*$/mu)[1]?.split(/^snapshots:\s*$/mu)[0] ?? '';
const packageKeys = [...packagesBlock.matchAll(/^  (?:'([^']+)'|([^\s][^:]*)):\s*$/gmu)]
  .map((match) => (match[1] ?? match[2]).replace(/\(.+\)$/u, ''))
  .filter((key) => key.includes('@'));

const dependencies = new Map<string, string>();
for (const key of packageKeys) {
  const splitAt = key.lastIndexOf('@');
  const name = key.slice(0, splitAt);
  const version = key.slice(splitAt + 1);
  if (name && version && !dependencies.has(`${name}@${version}`)) dependencies.set(name, version);
}

function declaredLicense(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0 && value.length <= 160) {
    return value.trim();
  }
  if (value && typeof value === 'object' && 'type' in value && typeof value.type === 'string') {
    return declaredLicense(value.type);
  }
  return undefined;
}

async function installedLicenseMap(): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const virtualStore = path.join(root, 'node_modules/.pnpm');
  const virtualEntries = await readdir(virtualStore, { withFileTypes: true }).catch(() => []);

  async function inspectPackage(packageDirectory: string): Promise<void> {
    try {
      const manifest = JSON.parse(
        await readFile(path.join(packageDirectory, 'package.json'), 'utf8'),
      ) as { name?: unknown; version?: unknown; license?: unknown; licenses?: unknown };
      if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') return;
      const legacyLicenses = Array.isArray(manifest.licenses)
        ? manifest.licenses
            .map((candidate) => declaredLicense(candidate))
            .filter((candidate): candidate is string => Boolean(candidate))
        : [];
      const license = declaredLicense(manifest.license) ?? legacyLicenses.join(' OR ');
      if (license) result.set(`${manifest.name}@${manifest.version}`, license);
    } catch {
      return;
    }
  }

  const packageDirectories = (
    await Promise.all(
      virtualEntries
        .filter((entry) => entry.isDirectory())
        .map(async (virtualEntry) => {
          const modules = path.join(virtualStore, virtualEntry.name, 'node_modules');
          const topLevel = await readdir(modules, { withFileTypes: true }).catch(() => []);
          const directories = await Promise.all(
            topLevel
              .filter((entry) => entry.isDirectory())
              .map(async (entry) => {
                if (!entry.name.startsWith('@')) return [path.join(modules, entry.name)];
                const scopeDirectory = path.join(modules, entry.name);
                const scoped = await readdir(scopeDirectory, { withFileTypes: true }).catch(
                  () => [],
                );
                return scoped
                  .filter((child) => child.isDirectory())
                  .map((child) => path.join(scopeDirectory, child.name));
              }),
          );
          return directories.flat();
        }),
    )
  ).flat();
  await Promise.all(packageDirectories.map(inspectPackage));
  return result;
}

const installedLicenses = await installedLicenseMap();

function spdxId(value: string): string {
  return `SPDXRef-${value.replace(/[^A-Za-z0-9.-]/gu, '-')}`;
}

const created = new Date(
  Number(process.env.SOURCE_DATE_EPOCH ?? Date.now()) * (process.env.SOURCE_DATE_EPOCH ? 1_000 : 1),
).toISOString();
const namespaceHash = createHash('sha256').update(lockfile).digest('hex').slice(0, 24);
const rootId = spdxId(`${packageJson.name}-${packageJson.version}`);
const packages = [
  {
    SPDXID: rootId,
    name: packageJson.name,
    versionInfo: packageJson.version,
    downloadLocation: 'NOASSERTION',
    filesAnalyzed: false,
    licenseConcluded: 'NOASSERTION',
    licenseDeclared: packageJson.license ?? 'MIT',
    copyrightText: 'NOASSERTION',
  },
  ...[...dependencies.entries()]
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([name, version]) => ({
      SPDXID: spdxId(`${name}-${version}`),
      name,
      versionInfo: version,
      downloadLocation: 'NOASSERTION',
      filesAnalyzed: false,
      licenseConcluded: 'NOASSERTION',
      licenseDeclared: installedLicenses.get(`${name}@${version}`) ?? 'NOASSERTION',
      copyrightText: 'NOASSERTION',
      externalRefs: [
        {
          referenceCategory: 'PACKAGE-MANAGER',
          referenceType: 'purl',
          referenceLocator: `pkg:npm/${encodeURIComponent(name).replace('%40', '@')}@${version}`,
        },
      ],
    })),
];

const document = {
  spdxVersion: 'SPDX-2.3',
  dataLicense: 'CC0-1.0',
  SPDXID: 'SPDXRef-DOCUMENT',
  name: `${packageJson.name}-${packageJson.version}-sbom`,
  documentNamespace: `https://fritz.local/spdx/${packageJson.version}/${namespaceHash}`,
  creationInfo: { created, creators: ['Tool: fritz-generate-sbom/1'] },
  packages,
  relationships: packages.slice(1).map((dependency) => ({
    spdxElementId: rootId,
    relationshipType: 'DEPENDS_ON',
    relatedSpdxElement: dependency.SPDXID,
  })),
};

const outputDirectory = path.join(root, 'artifacts/sbom');
await mkdir(outputDirectory, { recursive: true });
const output = path.join(outputDirectory, 'fritz.spdx.json');
await writeFile(output, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
const licenseReport = {
  generatedAt: created,
  source: 'Installed package.json metadata matched to pnpm-lock.yaml',
  packages: packages.map((entry) => ({
    name: entry.name,
    version: entry.versionInfo,
    license: entry.licenseDeclared,
  })),
};
await writeFile(
  path.join(outputDirectory, 'fritz-licenses.json'),
  `${JSON.stringify(licenseReport, null, 2)}\n`,
  { mode: 0o600 },
);
const assertedLicenses = licenseReport.packages.filter(
  (entry) => entry.license !== 'NOASSERTION',
).length;
console.log(
  `SBOM generated: ${path.relative(root, output)} (${packages.length - 1} locked packages; ${assertedLicenses}/${packages.length} licenses asserted from installed metadata).`,
);
