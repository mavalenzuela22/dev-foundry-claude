import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST_NAME, buildManifestBytes, rootOf, sha256 } from '../../src/adopt/pin.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function fail(message) {
  console.error(`payload-manifest: ${message}`);
  process.exit(1);
}

function npmPackList() {
  const execPath = process.env.npm_execpath;
  const [command, prefix] = execPath && /\.c?js$/.test(execPath) ? [process.execPath, [execPath]] : ['npm', []];
  const output = execFileSync(command, [...prefix, 'pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed) || parsed.length !== 1 || !Array.isArray(parsed[0].files)) fail('unexpected npm pack list.');
  return parsed[0].files.map((file) => file.path).filter((file) => file !== MANIFEST_NAME);
}

function checkLock(files) {
  const lock = JSON.parse(readFileSync(path.join(packageRoot, 'package-lock.json'), 'utf8'));
  const pattern = /^((?:.*\/)?node_modules\/(?:@[^/]+\/)?[^/]+)\/package\.json$/;
  for (const file of files) {
    const match = pattern.exec(file);
    if (!match) continue;
    const installed = JSON.parse(readFileSync(path.join(packageRoot, file), 'utf8')).version;
    const locked = lock.packages?.[match[1]]?.version;
    if (locked === undefined || locked !== installed) fail(`bundled dependency ${match[1]} does not match the lock.`);
  }
}

function generate() {
  const files = npmPackList();
  checkLock(files);
  const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
  const entries = files.map((file) => {
    const full = path.join(packageRoot, ...file.split('/'));
    if (!lstatSync(full).isFile()) fail(`shipped path is not a regular file: ${file}`);
    const bytes = readFileSync(full);
    return { path: file, sha256: sha256(bytes), size: bytes.length };
  });
  const bytes = buildManifestBytes({ version: pkg.version, entries });
  writeFileSync(path.join(packageRoot, MANIFEST_NAME), bytes);
  console.error(`payload-manifest: ${entries.length} files, root ${rootOf(bytes)}`);
}

// Build-time check: tarball regular files minus the manifest equal the manifest entries.
function check(tarball) {
  const listing = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const shipped = listing.filter((entry) => !entry.endsWith('/')).map((entry) => entry.replace(/^package\//, ''));
  const manifest = JSON.parse(execFileSync('tar', ['-xOzf', tarball, `package/${MANIFEST_NAME}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
  const left = shipped.filter((entry) => entry !== MANIFEST_NAME).sort();
  const right = manifest.files.map((entry) => entry.path).sort();
  if (left.length !== right.length || left.some((entry, index) => entry !== right[index])) fail('tarball and manifest differ.');
  if (shipped.includes('package-lock.json')) fail('package-lock.json must not ship.');
  console.error(`payload-manifest: tarball matches manifest (${right.length} files).`);
}

if (process.argv[2] === '--check') check(process.argv[3]);
else generate();
