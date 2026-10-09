import { chmodSync, closeSync, constants, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readlinkSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canonicalJson, sha256 } from '../adopt/pin.js';
import { safeRelativePath } from '../adopt/common.js';
import { acquisitionPlan } from './acquisition.js';
import { inside, refuse, runtimeIdentity, safeAbsolute, verifyRuntime } from './identity.js';

export function defaultStoreRoot({ platform = process.platform, env = process.env, home = os.homedir() } = {}) {
  const api = platform === 'win32' ? path.win32 : path.posix;
  const base = platform === 'win32' ? env.LOCALAPPDATA : platform === 'darwin' ? api.join(home, 'Library', 'Caches') : platform === 'linux' ? (env.XDG_CACHE_HOME || api.join(home, '.cache')) : null;
  if (!base || !api.isAbsolute(base) || /[\x00-\x1f]/.test(base) || base.split(/[\\/]/).includes('..') ||
      (platform === 'win32' && (!/^[A-Za-z]:\\/.test(base) || base.slice(3).includes(':')))) refuse('unsupported-cache-root');
  return api.join(api.normalize(base), 'dev-foundry-claude', 'runtimes');
}

// POSIX mode/uid verification is a bounded permission implementation, not a
// claim that chmod seals Windows ACLs. Native Windows writes/lookup are blocked
// until that permission model is established and tested in B4.
function owned(directory, sealed = false) {
  if (process.platform === 'win32' || typeof process.getuid !== 'function') refuse('store-permissions-unsupported');
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & (sealed ? 0o222 : 0o077))) refuse('unsafe-store-permissions');
}
export function storePath(storeRoot, relative = '') {
  const root = safeAbsolute(storeRoot, { missing: true });
  if (relative && !safeRelativePath(relative)) refuse('store-escape');
  const target = path.join(root, relative);
  if (!inside(root, target)) refuse('store-escape');
  return safeAbsolute(target, { missing: true });
}
function prepare(storeRoot) {
  const root = storePath(storeRoot);
  for (let probe = root; ; probe = path.dirname(probe)) {
    try { lstatSync(path.join(probe, '.git')); refuse('consumer-store-location'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (path.dirname(probe) === probe) break;
  }
  // One missing component at a time; never chmod existing directories.
  const missing = [];
  for (let p = root; ; p = path.dirname(p)) {
    try { lstatSync(p); break; } catch (error) { if (error.code !== 'ENOENT') throw error; missing.push(p); }
  }
  for (const p of missing.reverse()) mkdirSync(p, { mode: 0o700 });
  owned(root);
  for (const name of ['staging', 'releases']) {
    const dir = storePath(root, name);
    try { mkdirSync(dir, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    owned(dir);
  }
  return root;
}
function syncDirectory(dir) {
  const fd = openSync(dir, constants.O_RDONLY);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function durableWrite(file, bytes, mode = 0o400) {
  const fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, mode);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
}
function walkTree(root, visit, { installerLinks = false } = {}) {
  const names = new Map();
  const listed = installerLinks ? new Set(JSON.parse(readFileSync(path.join(root, 'payload-manifest.json'))).files.map(e => e.path)) : null;
  const walk = (dir, rel = '') => {
    for (const name of readdirSync(dir).sort()) {
      const relative = rel ? `${rel}/${name}` : name;
      if (!safeRelativePath(relative)) refuse('unsafe-payload-path');
      const folded = relative.toLowerCase();
      if (names.has(folded) && names.get(folded) !== relative) refuse('ambiguous-payload-path');
      names.set(folded, relative);
      const full = path.join(root, relative);
      const stat = lstatSync(full);
      if (stat.isSymbolicLink() && installerLinks && path.posix.dirname(relative) === 'node_modules/.bin' && !listed.has(relative)) {
        const link = readlinkSync(full);
        if (path.isAbsolute(link) || path.win32.isAbsolute(link) || /[\\\x00-\x1f]/.test(link)) refuse('unsafe-installer-link');
        const target = path.resolve(path.dirname(full), link);
        if (!inside(root, target) || !listed.has(path.relative(root, target).split(path.sep).join('/')) ||
            !lstatSync(safeAbsolute(target)).isFile()) refuse('unsafe-installer-link');
        // Canonical verifyPayload permits npm-owned .bin shims. A safe shim is
        // installer metadata, not payload: validate it and leave it in source,
        // importing no link into the sealed runtime store.
        continue;
      }
      safeAbsolute(full);
      if (!stat.isDirectory() && (!stat.isFile() || stat.nlink !== 1)) refuse('unsafe-payload-link');
      visit(full, relative, stat);
      if (stat.isDirectory()) walk(full, relative);
    }
  };
  walk(root);
}
function sealedPackage(root) {
  owned(root, true);
  walkTree(root, (file, relative, stat) => {
    if (stat.uid !== process.getuid() || (stat.mode & 0o222)) refuse('runtime-writable');
  });
}
function attest(input, expect) {
  const plan = acquisitionPlan({ kind: 'unpacked-local', expect, ...input });
  if (plan.status !== 'approved-local-stage' || plan.identity.expect !== expect) refuse('acquisition-blocked');
  return plan;
}

// Synchronous local-copy boundary. Failure leaves unique staging evidence; there
// is no delete, overwrite, script execution, global npm or consumer mutation.
export function stageRuntime({ storeRoot, candidateRoot, permittedCandidateRoots, expect, attestation, signal } = {}) {
  if (signal?.aborted) refuse('stage-aborted');
  const candidate = safeAbsolute(candidateRoot);
  if (!Array.isArray(permittedCandidateRoots) || !permittedCandidateRoots.some((p) => safeAbsolute(p) === candidate)) refuse('candidate-not-permitted');
  const selectedStore = storePath(storeRoot);
  if (inside(candidate, selectedStore) || inside(selectedStore, candidate)) refuse('store-source-overlap');
  const plan = attest(attestation, expect);
  const identity = verifyRuntime(candidate, expect);
  // No symlink or hardlink is imported. Only contained, manifest-targeting npm
  // launch links recognized by the canonical verifier may be omitted.
  walkTree(candidate, () => {}, { installerLinks: true });
  const root = prepare(selectedStore);
  const stage = mkdtempSync(path.join(storePath(root, 'staging'), 'stage-'));
  chmodSync(stage, 0o700);
  const packageRoot = path.join(stage, 'package');
  mkdirSync(packageRoot, { mode: 0o700 });
  walkTree(candidate, (file, relative, stat) => {
    if (signal?.aborted) refuse('stage-aborted');
    const target = path.join(packageRoot, relative);
    if (stat.isDirectory()) mkdirSync(target, { mode: 0o700 });
    else durableWrite(target, readFileSync(file), stat.mode & 0o111 ? 0o500 : 0o400);
  }, { installerLinks: true });
  verifyRuntime(candidate, expect);
  verifyRuntime(packageRoot, expect);
  const dirs = [packageRoot];
  walkTree(packageRoot, (file, relative, stat) => { if (stat.isDirectory()) dirs.push(file); });
  for (const dir of dirs.reverse()) { chmodSync(dir, 0o500); syncDirectory(dir); }
  sealedPackage(packageRoot);
  const record = { format: 'dev-foundry.runtime-install.v1', expect, attestation: { provenance: plan.provenance, transition: plan.transition } };
  durableWrite(path.join(stage, 'stage.json'), Buffer.from(canonicalJson(record)));
  syncDirectory(stage);
  return { storeRoot: root, stageRoot: stage, expect: identity.expect };
}

export function installedRuntime(storeRoot, expect) {
  const identity = runtimeIdentity(expect);
  const root = storePath(storeRoot);
  owned(root);
  owned(storePath(root, 'releases'));
  const holder = storePath(root, `releases/${identity.key}`);
  owned(holder, true);
  if (readdirSync(holder).sort().join(',') !== 'package,ready.json,stage.json') refuse('runtime-incomplete');
  const bytes = readFileSync(safeAbsolute(path.join(holder, 'stage.json')));
  const record = JSON.parse(bytes);
  if (record.format !== 'dev-foundry.runtime-install.v1' || record.expect !== expect || canonicalJson(record) !== bytes.toString()) refuse('invalid-install-record');
  const ready = readFileSync(safeAbsolute(path.join(holder, 'ready.json')), 'utf8');
  if (ready !== canonicalJson({ expect, recordSha256: sha256(bytes) })) refuse('invalid-publish-record');
  for (const name of ['stage.json', 'ready.json']) {
    const stat = lstatSync(path.join(holder, name));
    if (!stat.isFile() || stat.nlink !== 1 || stat.uid !== process.getuid() || (stat.mode & 0o222)) refuse('runtime-writable');
  }
  attest(record.attestation, expect);
  const packageRoot = safeAbsolute(path.join(holder, 'package'));
  sealedPackage(packageRoot);
  return verifyRuntime(packageRoot, expect);
}

export function promoteRuntime({ storeRoot, stageRoot, expect } = {}) {
  const root = storePath(storeRoot);
  owned(root);
  const staging = storePath(root, 'staging');
  owned(staging);
  const stage = safeAbsolute(stageRoot);
  if (path.dirname(stage) !== staging || !/^stage-[A-Za-z0-9]+$/.test(path.basename(stage))) refuse('stage-escape');
  owned(stage);
  if (readdirSync(stage).sort().join(',') !== 'package,stage.json') refuse('stage-incomplete');
  const bytes = readFileSync(safeAbsolute(path.join(stage, 'stage.json')));
  const record = JSON.parse(bytes);
  if (record.format !== 'dev-foundry.runtime-install.v1' || record.expect !== expect || canonicalJson(record) !== bytes.toString()) refuse('invalid-stage-record');
  attest(record.attestation, expect);
  const source = path.join(stage, 'package');
  sealedPackage(source);
  verifyRuntime(source, expect);
  const releases = storePath(root, 'releases');
  owned(releases);
  const destination = storePath(root, `releases/${runtimeIdentity(expect).key}`);
  // Exclusive reservation prevents rename from replacing even an empty existing
  // directory. Concurrent/partial collisions block; complete collisions verify.
  try { mkdirSync(destination, { mode: 0o700 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; return { status: 'already-installed', ...installedRuntime(root, expect) }; }
  // Keep original stage metadata for historical evidence. Unknown interruption
  // leaves a non-runnable reservation, never a blind retry/overwrite.
  durableWrite(path.join(destination, 'stage.json'), bytes);
  // macOS requires write permission on the directory being moved. Only the
  // staged top directory is temporarily writable; all files stay sealed, and
  // the exclusive destination has neither readiness nor sealed permissions, so
  // installedRuntime cannot select it during this interval (or after a crash).
  chmodSync(source, 0o700);
  renameSync(source, path.join(destination, 'package'));
  chmodSync(path.join(destination, 'package'), 0o500);
  verifyRuntime(path.join(destination, 'package'), expect);
  sealedPackage(path.join(destination, 'package'));
  durableWrite(path.join(destination, 'ready.json'), Buffer.from(canonicalJson({ expect, recordSha256: sha256(bytes) })));
  syncDirectory(destination);
  chmodSync(destination, 0o500);
  syncDirectory(releases);
  syncDirectory(stage);
  return { status: 'installed', ...installedRuntime(root, expect) };
}
