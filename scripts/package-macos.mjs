// oxlint-disable no-await-in-loop -- resolve the dependency graph before traversing each child's dependencies.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
};
const architecture = argument('--arch') ?? process.arch;
if (process.platform !== 'darwin')
  throw new Error('macOS packaging requires macOS and Xcode command-line tools.');
if (!['arm64', 'x64'].includes(architecture)) throw new Error('Use --arch arm64 or --arch x64.');
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const version = argument('--version') ?? manifest.version;
if (!/^\d+\.\d+\.\d+(?:[-.][\w.-]+)?$/u.test(version)) throw new Error('Invalid app version.');
await stat(join(root, 'build/handler.js'));
const output = resolve(argument('--output') ?? join(root, 'artifacts/release'));
await mkdir(output, { recursive: true });
const staging = await mkdtemp(join(tmpdir(), 'fritz-macos-package-'));
const application = join(staging, 'Fritz.app');
const contents = join(application, 'Contents');
const resources = join(contents, 'Resources');
const modules = join(resources, 'node_modules');

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  });
  if (result.status !== 0)
    throw new Error(
      `${command} failed: ${result.stderr || result.error?.message || result.stdout}`,
    );
  return result.stdout;
}

async function packageDirectory(name, from) {
  let cursor = from;
  while (true) {
    const candidate = join(cursor, 'node_modules', name);
    try {
      return await realpath(candidate);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    const parent = dirname(cursor);
    if (parent === cursor) throw new Error(`Missing runtime dependency ${name}`);
    cursor = parent;
  }
}

async function copyRuntimeDependencies() {
  const packages = new Map();
  const canonical = new Map();
  const pending = [];
  for (const name of Object.keys(manifest.dependencies)) {
    const source = await packageDirectory(name, root);
    canonical.set(name, source);
    pending.push(source);
  }
  while (pending.length) {
    const source = pending.shift();
    if (packages.has(source)) continue;
    const metadata = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
    const dependencies = new Map();
    packages.set(source, { name: metadata.name, dependencies });
    const required = Object.keys(metadata.dependencies ?? {});
    const optional = Object.keys({
      ...metadata.optionalDependencies,
      ...metadata.peerDependencies,
    });
    for (const name of new Set([...required, ...optional])) {
      let child;
      try {
        child = await packageDirectory(name, source);
      } catch (error) {
        if (!required.includes(name)) continue;
        throw error;
      }
      dependencies.set(name, child);
      if (!canonical.has(name)) canonical.set(name, child);
      pending.push(child);
    }
  }
  async function copyPackage(source, destination) {
    await cp(source, destination, {
      recursive: true,
      dereference: true,
      filter: (path) => path === source || basename(path) !== 'node_modules',
    });
    for (const [name, child] of packages.get(source).dependencies) {
      if (canonical.get(name) !== child)
        await copyPackage(child, join(destination, 'node_modules', name));
    }
  }
  for (const [name, source] of canonical) await copyPackage(source, join(modules, name));
  return packages.size;
}

async function bundleNode() {
  const requiredVersion = (await readFile(join(root, '.nvmrc'), 'utf8')).trim().replace(/^v/u, '');
  const destination = join(resources, 'node');
  if (architecture === process.arch && process.versions.node === requiredVersion) {
    const libraries = run('otool', ['-L', process.execPath])
      .split('\n')
      .slice(1)
      .filter((line) => line.trim());
    if (libraries.every((line) => /^\s*\/(?:usr\/lib|System\/Library)\//u.test(line))) {
      await cp(process.execPath, destination);
      await chmod(destination, 0o755);
      return requiredVersion;
    }
  }
  const archiveName = `node-v${requiredVersion}-darwin-${architecture}.tar.gz`;
  const base = `https://nodejs.org/dist/v${requiredVersion}/`;
  const [archiveResponse, checksumsResponse] = await Promise.all([
    fetch(`${base}${archiveName}`),
    fetch(`${base}SHASUMS256.txt`),
  ]);
  if (!archiveResponse.ok || !checksumsResponse.ok)
    throw new Error('Official Node runtime download failed.');
  const bytes = Buffer.from(await archiveResponse.arrayBuffer());
  const checksums = await checksumsResponse.text();
  const expected = checksums
    .split('\n')
    .map((line) => line.trim().split(/\s+/u))
    .find((entry) => entry[1] === archiveName)?.[0];
  if (!expected || createHash('sha256').update(bytes).digest('hex') !== expected)
    throw new Error('Official Node runtime checksum mismatch.');
  const archive = join(staging, archiveName);
  await writeFile(archive, bytes);
  run('tar', [
    '-xzf',
    archive,
    '-C',
    staging,
    `node-v${requiredVersion}-darwin-${architecture}/bin/node`,
    `node-v${requiredVersion}-darwin-${architecture}/LICENSE`,
  ]);
  await cp(join(staging, `node-v${requiredVersion}-darwin-${architecture}/bin/node`), destination);
  await cp(
    join(staging, `node-v${requiredVersion}-darwin-${architecture}/LICENSE`),
    join(resources, 'NODE-LICENSE'),
  );
  await chmod(destination, 0o755);
  return requiredVersion;
}

try {
  await mkdir(join(contents, 'MacOS'), { recursive: true });
  await mkdir(resources, { recursive: true });
  await cp(join(root, 'build'), join(resources, 'server'), { recursive: true });
  const bootstrap = (await readFile(join(root, 'desktop/macos/bootstrap.mjs'), 'utf8')).replace(
    '../../scripts/lib/profile-store.mjs',
    './profile-store.mjs',
  );
  await writeFile(join(resources, 'bootstrap.mjs'), bootstrap);
  await cp(join(root, 'scripts/lib/profile-store.mjs'), join(resources, 'profile-store.mjs'));
  await cp(join(root, 'LICENSE'), join(resources, 'LICENSE'));
  await writeFile(
    join(resources, 'package.json'),
    JSON.stringify({ name: 'fritz-desktop', version, private: true, type: 'module' }),
  );
  const plist = (await readFile(join(root, 'desktop/macos/Info.plist'), 'utf8')).replaceAll(
    '__VERSION__',
    version,
  );
  await writeFile(join(contents, 'Info.plist'), plist);
  const dependencyCount = await copyRuntimeDependencies();
  const nodeVersion = await bundleNode();
  if (!(await stat(join(resources, 'NODE-LICENSE')).catch(() => undefined))) {
    const installedLicense = resolve(dirname(process.execPath), '../LICENSE');
    await cp(installedLicense, join(resources, 'NODE-LICENSE'));
  }
  const iconset = join(staging, 'Fritz.iconset');
  await mkdir(iconset);
  for (const size of [16, 32, 128, 256, 512]) {
    run('sips', [
      '-z',
      String(size),
      String(size),
      join(root, 'static/icons/icon-512.png'),
      '--out',
      join(iconset, `icon_${size}x${size}.png`),
    ]);
    if (size < 512) {
      run('sips', [
        '-z',
        String(size * 2),
        String(size * 2),
        join(root, 'static/icons/icon-512.png'),
        '--out',
        join(iconset, `icon_${size}x${size}@2x.png`),
      ]);
    }
  }
  run('iconutil', ['-c', 'icns', iconset, '-o', join(resources, 'Fritz.icns')]);
  run('swiftc', [
    '-O',
    '-target',
    `${architecture === 'x64' ? 'x86_64' : 'arm64'}-apple-macos14.0`,
    '-module-cache-path',
    join(staging, 'swift-cache'),
    '-o',
    join(contents, 'MacOS/Fritz'),
    join(root, 'desktop/macos/Fritz.swift'),
  ]);
  run('codesign', ['--force', '--sign', '-', join(resources, 'node')]);
  run('codesign', ['--force', '--sign', '-', application]);
  run('codesign', ['--verify', '--deep', '--strict', application]);
  await writeFile(
    join(resources, 'runtime.json'),
    JSON.stringify({ version, architecture, nodeVersion, dependencyCount }),
  );
  // runtime.json is part of the sealed resource envelope.
  run('codesign', ['--force', '--sign', '-', application]);
  run('codesign', ['--verify', '--deep', '--strict', application]);
  const archiveName = `Fritz-macOS-${architecture}.zip`;
  const archive = join(output, archiveName);
  run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', application, archive]);
  const digest = createHash('sha256')
    .update(await readFile(archive))
    .digest('hex');
  await writeFile(`${archive}.sha256`, `${digest}  ${archiveName}\n`);
  if (process.argv.includes('--keep-app')) {
    const target = join(output, `macos-${architecture}`, 'Fritz.app');
    await mkdir(dirname(target), { recursive: true });
    // A previous build has content-hashed chunks; merging would leave stale
    // resources outside the new app's code-signature envelope.
    await rm(target, { recursive: true, force: true });
    await cp(application, target, { recursive: true });
    run('codesign', ['--verify', '--deep', '--strict', target]);
    process.stdout.write(`App: ${target}\n`);
  }
  process.stdout.write(
    `Packaged ${archiveName}; macOS 14+, Node ${nodeVersion}, ${dependencyCount} production packages.\n`,
  );
} finally {
  await rm(staging, { recursive: true, force: true });
}
