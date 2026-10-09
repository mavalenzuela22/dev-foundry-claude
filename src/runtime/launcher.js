// Trusted host bootstrap, deliberately Node-only and copyable with the bin.
// The explicit manager pin is installed/authorized by the separate B4 host
// bootstrap. This byte barrier loads B1/B2 only after verifying that manager;
// all consumer selection, provenance and transactions remain in those APIs.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const HOST_LAUNCHERS = ['bin/dev-foundry-claude-launcher.js', 'src/runtime/launcher.js'];
export const HOST_SEAL_LITERAL = "\n  const hostPinSha256 = 'unbound';\n";
const canonical = value => {
  const sort = v => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])])) : v;
  return JSON.stringify(sort(value), null, 2) + '\n';
};
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
// Startup independently rechecks sealed host bytes before loading any manager
// module. POSIX ownership is established here; Windows ACL proof remains B4C.
export function verifyHostPin(hostRoot, pinSha256) {
  const root = safe(hostRoot), file = safe(path.join(root, 'host-pin.json'));
  const bytes = readFileSync(file), pin = JSON.parse(bytes);
  if (!/^[a-f0-9]{64}$/.test(pinSha256 ?? '') || hash(bytes) !== pinSha256 || canonical(pin) !== bytes.toString() ||
      Object.keys(pin).sort().join(',') !== 'binTemplateSha256,format,hostRoot,launcherSha256,managerInstallSha256,managerPin,sourcePin,storeRoot' ||
      pin.format !== 'dev-foundry.host-pin.v1' || pin.hostRoot !== root) stop('host-pin-mismatch');
  const files = new Set([...HOST_LAUNCHERS, 'host-pin.json']);
  const directories = new Set(['', 'bin', 'src', 'src/runtime']);
  const walk = (dir, rel = '') => {
    const s = lstatSync(safe(dir));
    if (typeof process.getuid !== 'function' || s.uid !== process.getuid() || s.mode & 0o222 || s.mode & 0o077) stop('host-not-sealed');
    if (s.isDirectory()) {
      if (!directories.has(rel)) stop('host-foreign-bytes');
      for (const name of readdirSync(dir)) walk(path.join(dir, name), rel ? `${rel}/${name}` : name);
    } else if (!s.isFile() || s.nlink !== 1 || !files.delete(rel) || (s.mode & 0o777) !== (rel === HOST_LAUNCHERS[0] ? 0o500 : 0o400)) stop('host-foreign-bytes');
  };
  walk(root);
  if (files.size) stop('host-incomplete');
  const bin = readFileSync(path.join(root, HOST_LAUNCHERS[0]), 'utf8');
  const literal = `\n  const hostPinSha256 = '${pinSha256}';\n`;
  if (bin.split(literal).length !== 2 || hash(bin.replace(literal, HOST_SEAL_LITERAL)) !== pin.binTemplateSha256 ||
      hash(readFileSync(path.join(root, HOST_LAUNCHERS[1]))) !== pin.launcherSha256) stop('host-code-mismatch');
  return pin;
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
export async function stableLaunch(argv, { cwd = process.cwd(), hostRoot, hostPinSha256 } = {}) {
  const host = hostRoot ? verifyHostPin(hostRoot, hostPinSha256) : null;
  const options = {};
  let i = 0;
  for (; i < argv.length && argv[i] !== '--'; i += 2) {
    const key = argv[i], value = argv[i + 1];
    if (!['--manager-expect', '--store-root', '--root'].includes(key) || options[key] || !value || value.startsWith('--')) stop('invalid-host-invocation');
    options[key] = value;
  }
  if (host) {
    if (options['--manager-expect'] && options['--manager-expect'] !== host.managerPin ||
        options['--store-root'] && options['--store-root'] !== host.storeRoot) stop('approved-host-identity-override');
    options['--manager-expect'] = host.managerPin; options['--store-root'] = host.storeRoot;
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
  if (host && hash(readFileSync(safe(path.join(path.dirname(managerRoot), 'stage.json')))) !== host.managerInstallSha256) stop('approved-manager-record-mismatch');
  if (host && (hash(readFileSync(safe(path.join(managerRoot, HOST_LAUNCHERS[0])))) !== host.binTemplateSha256 ||
      hash(readFileSync(safe(path.join(managerRoot, HOST_LAUNCHERS[1])))) !== host.launcherSha256)) stop('approved-manager-host-code-mismatch');
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
