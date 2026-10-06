import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selfPin, sha256 } from '../../src/adopt/pin.js';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));

export function selectNpmInvocation(platform, npmExecPath, comSpec) {
  if (npmExecPath && /\.c?js$/.test(npmExecPath)) return [process.execPath, [npmExecPath]];
  // Windows batch shims require the command interpreter, not direct execution.
  return platform === 'win32'
    ? [comSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd']]
    : ['npm', []];
}

// Normal npm pack owns the build and payload manifest. This script only verifies
// and arranges its immutable output; an empty destination prevents stale assets.
export async function buildReleaseAssets(outputDirectory) {
  const out = path.resolve(outputDirectory);
  await mkdir(out, { recursive: true });
  if ((await readdir(out)).length) throw new Error('Release output directory must be empty.');
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'dfc-release-'));
  try {
    const pkg = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
    if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error('Expected an exact stable release version.');
    const [command, prefix] = selectNpmInvocation(process.platform, process.env.npm_execpath, process.env.ComSpec);
    const packed = JSON.parse(execFileSync(command, [...prefix, 'pack', '--json', '--pack-destination', scratch], {
      cwd: packageRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 16 * 1024 * 1024,
    }));
    const versioned = `dev-foundry-claude-adapter-${pkg.version}.tgz`;
    const alias = 'dev-foundry-claude-adapter.tgz';
    if (packed.length !== 1 || packed[0].filename !== versioned || packed[0].version !== pkg.version) throw new Error('npm pack identity mismatch.');
    const tarball = path.join(scratch, versioned);
    execFileSync(process.execPath, [path.join(packageRoot, 'scripts/package/payload-manifest.mjs'), '--check', tarball], { stdio: ['ignore', 'ignore', 'inherit'] });
    const unpacked = path.join(scratch, 'unpacked');
    await mkdir(unpacked);
    execFileSync('tar', ['-xzf', tarball, '-C', unpacked]);
    const pin = selfPin(path.join(unpacked, 'package'));
    if (pin.version !== pkg.version) throw new Error('Packed payload identity mismatch.');
    const bytes = await readFile(tarball);
    const hash = sha256(bytes);
    await copyFile(tarball, path.join(out, versioned));
    await copyFile(tarball, path.join(out, alias));
    const aliasBytes = await readFile(path.join(out, alias));
    const versionedBytes = await readFile(path.join(out, versioned));
    if (!bytes.equals(versionedBytes) || !versionedBytes.equals(aliasBytes) || sha256(aliasBytes) !== hash) throw new Error('Release alias integrity mismatch.');
    await writeFile(path.join(out, 'SHA256SUMS'), `${hash}  ${versioned}\n${hash}  ${alias}\n`, { flag: 'wx' });
    return { version: pkg.version, expect: pin.expect, sha256: hash, files: [versioned, alias, 'SHA256SUMS'] };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== '--out') {
    console.error('Usage: node scripts/release/build-assets.mjs --out <empty-output-directory>');
    process.exitCode = 2;
  } else {
    try { console.log(JSON.stringify(await buildReleaseAssets(process.argv[3]))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
