// Trusted host bootstrap, deliberately Node-only and copyable with the bin.
// The explicit manager pin is installed/authorized by the separate B4 host
// bootstrap. This byte barrier loads B1/B2 only after verifying that manager;
// all consumer selection, provenance and transactions remain in those APIs.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const stop = code => { const e = new Error(`Stable launcher blocked: ${code}. One-time verified host bootstrap is required for unmanaged 1.4.2 (B4); keep the source installation. Use runtime doctor for managed recovery.`); e.code = code; throw e; };
function safe(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || /[\x00-\x1f]/.test(value) || value.split(path.sep).includes('..')) stop('unsafe-host-path');
  let p = path.parse(value).root;
  for (const part of value.slice(p.length).split(path.sep).filter(Boolean)) {
    p = path.join(p, part);
    if (lstatSync(p).isSymbolicLink()) stop('symlink-host-path');
  }
  return path.normalize(value);
}
export function verifyManager(storeRoot, expect) {
  const match = /^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?):sha256:([a-f0-9]{64})$/.exec(expect ?? '');
  if (!match) stop('exact-manager-pin-required');
  const root = safe(path.join(safe(storeRoot), 'releases', `${match[1]}-sha256-${match[2]}`, 'package'));
  const manifestBytes = readFileSync(safe(path.join(root, 'payload-manifest.json')));
  if (hash(manifestBytes) !== match[2]) stop('manager-byte-mismatch');
  const manifest = JSON.parse(manifestBytes), pkg = JSON.parse(readFileSync(safe(path.join(root, 'package.json'))));
  if (manifest.format !== 'dev-foundry.payload-manifest.v1' || manifest.version !== match[1] || pkg.version !== match[1] || pkg.name !== '@dev-foundry/claude-adapter' || !Array.isArray(manifest.files)) stop('manager-package-mismatch');
  const listed = new Set(['payload-manifest.json']);
  for (const entry of manifest.files) {
    if (typeof entry.path !== 'string' || !entry.path || /[\\:\x00-\x1f]/.test(entry.path) || entry.path.startsWith('/') || entry.path.split('/').some(p => !p || p === '..' || p === '.') || listed.has(entry.path)) stop('manager-path-mismatch');
    listed.add(entry.path);
    const file = safe(path.join(root, entry.path)), info = lstatSync(file);
    if (!info.isFile() || info.nlink !== 1 || info.size !== entry.size || hash(readFileSync(file)) !== entry.sha256) stop('manager-byte-mismatch');
  }
  const walk = (dir, rel = '') => {
    const info = lstatSync(dir);
    if (typeof process.getuid !== 'function' || info.uid !== process.getuid() || info.mode & 0o222) stop('manager-not-immutable');
    if (info.isDirectory()) for (const name of readdirSync(dir)) walk(safe(path.join(dir, name)), rel ? `${rel}/${name}` : name);
    else if (!info.isFile() || !listed.has(rel)) stop('manager-unowned-bytes');
  };
  walk(root);
  if (!listed.has('src/runtime/dispatch.js')) stop('manager-bootstrap-required');
  return root;
}
export async function stableLaunch(argv, { cwd = process.cwd() } = {}) {
  const options = {};
  let i = 0;
  for (; i < argv.length && argv[i] !== '--'; i += 2) {
    const key = argv[i], value = argv[i + 1];
    if (!['--manager-expect', '--store-root', '--root'].includes(key) || options[key] || !value || value.startsWith('--')) stop('invalid-host-invocation');
    options[key] = value;
  }
  if (argv[i] !== '--' || !options['--store-root']) stop('host-bootstrap-required');
  if (Number(process.versions.node.split('.')[0]) < 20) stop('node-20-required');
  const node = safe(process.execPath);
  let storeRoot;
  try { storeRoot = safe(options['--store-root']); }
  catch (error) { if (error.code === 'ENOENT') stop('manager-host-bootstrap-required'); throw error; }
  let managerRoot;
  try { managerRoot = verifyManager(storeRoot, options['--manager-expect']); }
  catch (error) { if (error.code === 'ENOENT') stop('manager-host-bootstrap-required'); throw error; }
  const api = await import(pathToFileURL(path.join(managerRoot, 'src/runtime/dispatch.js')).href);
  if (typeof api.launchRuntime !== 'function') stop('manager-bootstrap-required');
  try {
    return await api.launchRuntime({ cwd: safe(options['--root'] ?? cwd), storeRoot, managerRoot,
      managerExpect: options['--manager-expect'], node, argv: argv.slice(i + 1) });
  } catch (error) {
    if (error.code === 'ENOENT') stop('selected-runtime-bootstrap-required');
    error.message += ' Next: runtime doctor using this verified manager; preserve source bytes and journal, and authorize explicit recovery.';
    throw error;
  }
}
