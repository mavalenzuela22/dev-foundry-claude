// One-time host operation only. No consumer selection/cutover, npm, download,
// lifecycle hook, source executable, PATH change or recursive cleanup.
import { accessSync, chmodSync, closeSync, constants, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { canonicalJson, selfPin, sha256 } from '../adopt/pin.js';
import { acquisitionPlan } from './acquisition.js';
import { inside, refuse, safeAbsolute, verifyRuntime } from './identity.js';
import { installedRuntime } from './store.js';
import { HOST_LAUNCHERS, HOST_SEAL_LITERAL, verifyHostPin, verifyManager } from './launcher.js';

const MAX_AGE = 60 * 60 * 1000;
const DIRECTORIES = ['', 'bin', 'src', 'src/runtime'];
const phases = ['prepare', 'install'];
const PRESERVATION = ['source-package-and-original-cli', 'source-live-sessions', 'manager-and-runtime-store', 'all-consumer-pins-and-authority', 'journals-telemetry-and-dashboard-history', 'global-npm-PATH-and-shims'];
function keys(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || required.some(k => !Object.hasOwn(value, k)) ||
      Object.keys(value).some(k => ![...required, ...optional].includes(k))) refuse('host-unrecognized-fields');
}
const absent = file => { try { lstatSync(file); return false; } catch (e) { if (e.code === 'ENOENT') return true; throw e; } };
const json = file => {
  const bytes = readFileSync(safeAbsolute(file)), value = JSON.parse(bytes);
  if (canonicalJson(value) !== bytes.toString()) refuse('host-noncanonical-record');
  return value;
};
const identity = stat => ({ dev: stat.dev, ino: stat.ino, uid: stat.uid });
function owned(file, { directory = false, writable = false, sealed = false, linked = false } = {}) {
  const stat = lstatSync(safeAbsolute(file));
  if (process.platform === 'win32' || typeof process.getuid !== 'function') refuse('host-permissions-unsupported');
  if (stat.uid !== process.getuid() || stat.mode & 0o077 || (directory ? !stat.isDirectory() : !stat.isFile()) ||
      (!directory && !linked && stat.nlink !== 1) || (sealed && stat.mode & 0o222) ||
      (writable && (stat.mode & 0o300) !== 0o300)) refuse('host-unsafe-permissions');
  if (writable) accessSync(file, constants.W_OK | constants.X_OK);
  return identity(stat);
}
function flush(dir) {
  const fd = openSync(safeAbsolute(dir), constants.O_RDONLY);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function write(file, bytes, mode = 0o400) {
  safeAbsolute(file, { missing: true });
  const fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, mode);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  flush(path.dirname(file));
}
function record(dir, name, value) {
  const target = path.join(dir, name), bytes = Buffer.from(canonicalJson(value));
  if (!absent(target)) { if (!readFileSync(safeAbsolute(target)).equals(bytes)) refuse('host-record-conflict'); return; }
  // Unique transaction owns this temporary name. An interrupted temporary is
  // retained and reported unknown, never overwritten on replay.
  const temporary = `${target}.pending`;
  write(temporary, bytes); renameSync(temporary, target); flush(dir);
}
function local(value, missing = false) {
  if (typeof value !== 'string' || /[\x00-\x1f]/.test(value) || path.normalize(value) !== value ||
      (process.platform === 'win32' ? !/^[A-Za-z]:\\/.test(value) || value.slice(3).includes(':') : /[\\:]/.test(value))) refuse('host-noncanonical-path');
  return safeAbsolute(value, { missing });
}
function noInstallationAncestor(value) {
  for (let p = value; ; p = path.dirname(p)) {
    if (path.basename(p).toLowerCase() === 'node_modules' || !absent(path.join(p, '.git')) || !absent(path.join(p, 'package.json'))) refuse('host-installation-or-consumer-location');
    if (path.dirname(p) === p) break;
  }
}
function physicalInside(root, target) {
  if (absent(root)) return false;
  const selected = lstatSync(safeAbsolute(root));
  for (let p = target; ; p = path.dirname(p)) {
    if (!absent(p)) {
      const current = lstatSync(safeAbsolute(p));
      if (current.dev === selected.dev && current.ino === selected.ino) return true;
    }
    if (path.dirname(p) === p) return false;
  }
}
const overlaps = (a, b) => {
  // Darwin realpath can retain a case alias. Compare physical ancestors too;
  // conservatively reject portable spelling collisions for missing roots.
  const folded = p => p.normalize('NFC').toLowerCase();
  return inside(a, b) || inside(b, a) || inside(folded(a), folded(b)) || inside(folded(b), folded(a)) || physicalInside(a, b) || physicalInside(b, a);
};
function boundaries(plan) {
  const root = local(plan.hostRoot, true), parent = local(path.dirname(root));
  if (canonicalJson(owned(parent, { directory: true, writable: true })) !== canonicalJson(plan.parent)) refuse('host-parent-changed');
  noInstallationAncestor(parent);
  for (const excluded of [plan.source.packageRoot, plan.manager.packageRoot, plan.storeRoot, plan.projectRoot, ...plan.consumerRoots, ...plan.globalNpmRoots]) {
    local(excluded, true);
    if (overlaps(excluded, root) || overlaps(excluded, plan.transactionRoot)) refuse('host-root-overlap');
  }
  if (plan.transactionRoot !== `${root}.bootstrap-${sha256(canonicalJson(plan.selection))}`) refuse('host-transaction-root-mismatch');
}
function packages(plan) {
  const source = verifyRuntime(plan.source.packageRoot, plan.source.expect);
  if (selfPin(source.packageRoot).expect !== plan.source.expect || selfPin(source.packageRoot).root !== plan.source.manifestSha256) refuse('host-source-pin-changed');
  const manager = installedRuntime(plan.storeRoot, plan.manager.expect);
  if (manager.packageRoot !== plan.manager.packageRoot || selfPin(manager.packageRoot).expect !== plan.manager.expect || selfPin(manager.packageRoot).root !== plan.manager.manifestSha256 ||
      verifyManager(plan.storeRoot, plan.manager.expect) !== manager.packageRoot) refuse('host-manager-pin-changed');
  const installBytes = readFileSync(safeAbsolute(path.join(path.dirname(manager.packageRoot), 'stage.json')));
  if (sha256(installBytes) !== plan.manager.installSha256) refuse('host-manager-record-changed');
  for (const pkg of [plan.source, plan.manager]) {
    const approved = acquisitionPlan({ kind: 'unpacked-local', expect: pkg.expect, ...pkg.attestation });
    if (approved.status !== 'approved-local-stage') refuse('host-origin-selection-incomplete');
  }
  const rawBin = readFileSync(safeAbsolute(path.join(manager.packageRoot, HOST_LAUNCHERS[0])), 'utf8');
  const launcher = readFileSync(safeAbsolute(path.join(manager.packageRoot, HOST_LAUNCHERS[1])));
  if (rawBin.split(HOST_SEAL_LITERAL).length !== 2 || sha256(rawBin) !== plan.pin.binTemplateSha256 ||
      sha256(launcher) !== plan.pin.launcherSha256) refuse('host-untrusted-launcher-bytes');
  const pinBytes = Buffer.from(canonicalJson(plan.pin)), seal = sha256(pinBytes);
  const expected = [Buffer.from(rawBin.replace(HOST_SEAL_LITERAL, `\n  const hostPinSha256 = '${seal}';\n`)), launcher, pinBytes];
  if (canonicalJson(plan.files) !== canonicalJson([...HOST_LAUNCHERS, 'host-pin.json'].map((file, i) => ({ path: file,
    before: null, beforeSha256: 'absent', after: expected[i].toString('base64'), afterSha256: sha256(expected[i]), mode: i === 0 ? 0o500 : 0o400 })))) refuse('host-plan-payload-mismatch');
}

// Plan is read-only. Trust remains a caller-supplied selection until the separate
// Operator approves these exact origins AND hashes. No digest authenticates a
// publisher by itself; synthetic provenance always remains PENDING.
export function planHostBootstrap(input, now = Date.now()) {
  if (!input || !input.operator?.trim() || !['offline-synthetic', 'release-selection'].includes(input.evidenceScope) ||
      !Array.isArray(input.consumerRoots) || !Array.isArray(input.globalNpmRoots) || !input.globalNpmRoots.length ||
      !Number.isSafeInteger(input.expiresAt) || input.expiresAt <= now || input.expiresAt > now + MAX_AGE) refuse('host-plan-input-invalid');
  if (Number(process.versions.node.split('.')[0]) < 20) refuse('node-20-required');
  const hostRoot = local(input.hostRoot, true), storeRoot = local(input.storeRoot), projectRoot = local(input.projectRoot);
  const source = verifyRuntime(local(input.sourceRoot), input.sourceExpect);
  const manager = installedRuntime(storeRoot, input.managerExpect);
  const installBytes = readFileSync(path.join(path.dirname(manager.packageRoot), 'stage.json'));
  const sourceAttestation = structuredClone(input.sourceAttestation);
  const managerAttestation = json(path.join(path.dirname(manager.packageRoot), 'stage.json')).attestation;
  const rawBin = readFileSync(safeAbsolute(path.join(manager.packageRoot, HOST_LAUNCHERS[0])), 'utf8');
  const launcher = readFileSync(safeAbsolute(path.join(manager.packageRoot, HOST_LAUNCHERS[1])));
  const pin = { format: 'dev-foundry.host-pin.v1', hostRoot, storeRoot, sourcePin: source.expect, managerPin: manager.expect,
    managerInstallSha256: sha256(installBytes), binTemplateSha256: sha256(rawBin), launcherSha256: sha256(launcher) };
  const pinBytes = Buffer.from(canonicalJson(pin));
  if (rawBin.split(HOST_SEAL_LITERAL).length !== 2) refuse('host-sealable-bin-required');
  const bytes = [Buffer.from(rawBin.replace(HOST_SEAL_LITERAL, `\n  const hostPinSha256 = '${sha256(pinBytes)}';\n`)), launcher, pinBytes];
  const selection = { hostRoot, storeRoot, sourcePin: source.expect, managerPin: manager.expect, operator: input.operator, expiresAt: input.expiresAt };
  const plan = { format: 'dev-foundry.host-bootstrap-plan.v1', operator: input.operator, createdAt: now, expiresAt: input.expiresAt,
    evidenceScope: input.evidenceScope, realReleaseProvenance: 'PENDING', projectRoot,
    hostRoot, storeRoot, parent: owned(path.dirname(hostRoot), { directory: true, writable: true }), selection,
    transactionRoot: `${hostRoot}.bootstrap-${sha256(canonicalJson(selection))}`,
    source: { packageRoot: source.packageRoot, expect: source.expect, manifestSha256: selfPin(source.packageRoot).root, attestation: sourceAttestation },
    manager: { packageRoot: manager.packageRoot, expect: manager.expect, manifestSha256: selfPin(manager.packageRoot).root, installSha256: sha256(installBytes), attestation: managerAttestation },
    consumerRoots: input.consumerRoots.map(p => local(p)), globalNpmRoots: input.globalNpmRoots.map(p => local(p, true)), pin,
    files: [...HOST_LAUNCHERS, 'host-pin.json'].map((file, i) => ({ path: file, before: null, beforeSha256: 'absent', after: bytes[i].toString('base64'), afterSha256: sha256(bytes[i]), mode: i === 0 ? 0o500 : 0o400 })),
    preservation: PRESERVATION,
    decisions: { installIsolatedHostOnly: true, consumerMigration: false, globalReplacement: false,
      sourceOriginAndHash: sourceAttestation?.provenance, managerOriginAndHash: managerAttestation?.provenance } };
  boundaries(plan); packages(plan);
  if (!absent(hostRoot) || !absent(plan.transactionRoot)) refuse('host-existing-installation-or-transaction');
  const canonical = Buffer.from(canonicalJson(plan));
  return { plan, planBytes: canonical, planSha256: sha256(canonical), adoptionAuthorized: false, realReleaseProvenance: 'PENDING' };
}
function decode(input) {
  if (Number(process.versions.node.split('.')[0]) < 20) refuse('node-20-required');
  const bytes = Buffer.from(input.planBytes ?? ''), plan = JSON.parse(bytes);
  if (bytes.length > 4 * 1024 * 1024 || canonicalJson(plan) !== bytes.toString() || sha256(bytes) !== input.planSha256 ||
      plan.format !== 'dev-foundry.host-bootstrap-plan.v1') refuse('host-wrong-plan');
  keys(plan, ['format', 'operator', 'createdAt', 'expiresAt', 'evidenceScope', 'realReleaseProvenance', 'projectRoot', 'hostRoot', 'storeRoot', 'parent', 'selection', 'transactionRoot', 'source', 'manager', 'consumerRoots', 'globalNpmRoots', 'pin', 'files', 'preservation', 'decisions']);
  if (!plan.operator?.trim() || !Array.isArray(plan.consumerRoots) || !Array.isArray(plan.globalNpmRoots) || !plan.globalNpmRoots.length ||
      canonicalJson(plan.preservation) !== canonicalJson(PRESERVATION)) refuse('host-plan-binding-mismatch');
  if (plan.hostRoot !== plan.pin.hostRoot || plan.storeRoot !== plan.pin.storeRoot || plan.manager.expect !== plan.pin.managerPin ||
      plan.source.expect !== plan.pin.sourcePin || plan.manager.installSha256 !== plan.pin.managerInstallSha256 ||
      plan.realReleaseProvenance !== 'PENDING' || !['offline-synthetic', 'release-selection'].includes(plan.evidenceScope) ||
      !Number.isSafeInteger(plan.createdAt) || !Number.isSafeInteger(plan.expiresAt) || plan.expiresAt <= plan.createdAt || plan.expiresAt > plan.createdAt + MAX_AGE ||
      canonicalJson(plan.selection) !== canonicalJson({ hostRoot: plan.hostRoot, storeRoot: plan.storeRoot, sourcePin: plan.source.expect, managerPin: plan.manager.expect, operator: plan.operator, expiresAt: plan.expiresAt }) ||
      plan.decisions.installIsolatedHostOnly !== true || plan.decisions.consumerMigration !== false || plan.decisions.globalReplacement !== false ||
      canonicalJson(plan.decisions.sourceOriginAndHash) !== canonicalJson(plan.source.attestation.provenance) ||
      canonicalJson(plan.decisions.managerOriginAndHash) !== canonicalJson(plan.manager.attestation.provenance)) refuse('host-plan-binding-mismatch');
  boundaries(plan); return plan;
}
export function hostApprovalBinding(plan, planSha256) {
  return { planSha256, hostRoot: plan.hostRoot, transactionRoot: plan.transactionRoot, storeRoot: plan.storeRoot,
    sourcePin: plan.source.expect, managerPin: plan.manager.expect, decisions: plan.decisions, paths: plan.files.map(f => f.path) };
}
export function authorizeHostBootstrap(input, now = Date.now()) {
  const plan = decode(input), a = input.approval;
  if (a) keys(a, ['format', 'operator', 'operatorApproved', 'sourceOriginApproved', 'managerOriginApproved', 'expiresAt', 'bound', 'phases']);
  if (now < plan.createdAt || now >= plan.expiresAt || a?.format !== 'dev-foundry.host-bootstrap-approval.v1' ||
      a.operator !== plan.operator || a.operatorApproved !== true || a.sourceOriginApproved !== true || a.managerOriginApproved !== true ||
      a.expiresAt <= now || !Number.isSafeInteger(a.expiresAt) || a.expiresAt > plan.expiresAt ||
      canonicalJson(a.bound) !== canonicalJson(hostApprovalBinding(plan, input.planSha256)) || canonicalJson(a.phases) !== canonicalJson(phases)) refuse('host-approval-invalid-or-expired');
  packages(plan); return plan;
}
function transaction(plan, input) {
  const dir = plan.transactionRoot;
  owned(dir, { directory: true, writable: true });
  const intent = json(path.join(dir, 'intent.json'));
  if (canonicalJson(intent) !== canonicalJson({ format: 'dev-foundry.host-intent.v1', plan, planSha256: input.planSha256, approval: input.approval,
    backups: { hostRoot: null, files: plan.files.map(f => ({ path: f.path, bytes: null, sha256: 'absent' })) } })) refuse('host-intent-mismatch');
  const allowed = new Set(['intent.json', 'prepared.json', 'installed.json', 'uninstalled.json', 'lease.json',
    ...DIRECTORIES.map((_, i) => `directory-${i}.json`), ...plan.files.flatMap((_, i) => [`stage-${i}`, `publish-${i}`])]);
  for (const name of readdirSync(dir)) {
    if (!allowed.has(name)) refuse('host-unknown-journal');
    owned(path.join(dir, name), { sealed: true, linked: /^publish-\d+$/.test(name) });
  }
  for (const [i, file] of plan.files.entries()) {
    const stage = path.join(dir, `stage-${i}`);
    if (sha256(readFileSync(safeAbsolute(stage))) !== file.afterSha256 || (lstatSync(stage).mode & 0o777) !== file.mode) refuse('host-stage-mismatch');
  }
  if (canonicalJson(json(path.join(dir, 'prepared.json'))) !== canonicalJson({ planSha256: input.planSha256 })) refuse('host-unprepared');
  if (!absent(path.join(dir, 'installed.json')) && canonicalJson(json(path.join(dir, 'installed.json'))) !== canonicalJson({ planSha256: input.planSha256 })) refuse('host-installed-record-mismatch');
  if (!absent(path.join(dir, 'uninstalled.json'))) {
    const inverse = json(path.join(dir, 'uninstalled.json'));
    if (inverse.planSha256 !== input.planSha256 || inverse.recovery?.outcome !== 'uninstall' || inverse.recovery.operatorApproved !== true ||
        inverse.recovery.operator !== plan.operator || canonicalJson(inverse.recovery.bound) !== canonicalJson(hostApprovalBinding(plan, input.planSha256))) refuse('host-inverse-record-mismatch');
  }
  return dir;
}
function withLease(plan, input, action) {
  const file = path.join(plan.transactionRoot, 'lease.json');
  if (!absent(file)) {
    const existing = json(file);
    if (canonicalJson(input.reconcileLease) !== canonicalJson(existing) || !Number.isSafeInteger(existing.pid) || existing.pid <= 0 || existing.planSha256 !== input.planSha256 ||
        !Number.isSafeInteger(existing.createdAt) || existing.createdAt > Date.now() || typeof existing.nonce !== 'string') refuse('host-writer-conflict');
    try { process.kill(existing.pid, 0); refuse('host-writer-live'); }
    catch (e) { if (e.code !== 'ESRCH') throw e; }
    unlinkSync(file); flush(plan.transactionRoot);
  }
  const lease = { pid: process.pid, planSha256: input.planSha256, createdAt: Date.now(), nonce: randomUUID() };
  write(file, Buffer.from(canonicalJson(lease)));
  try { return action(); } finally {
    if (canonicalJson(json(file)) !== canonicalJson(lease)) refuse('host-lease-changed');
    unlinkSync(file); flush(plan.transactionRoot);
  }
}
export function prepareHostBootstrap(input) {
  const plan = authorizeHostBootstrap(input);
  if (!absent(plan.transactionRoot)) {
    transaction(plan, input);
    if (!absent(plan.hostRoot)) refuse('host-prepare-after-switch');
    return { state: 'prepared', planSha256: input.planSha256 };
  }
  if (!absent(plan.hostRoot)) refuse('host-existing-installation');
  mkdirSync(plan.transactionRoot, { mode: 0o700 }); flush(path.dirname(plan.transactionRoot));
  return withLease(plan, input, () => {
    record(plan.transactionRoot, 'intent.json', { format: 'dev-foundry.host-intent.v1', plan, planSha256: input.planSha256, approval: input.approval,
      backups: { hostRoot: null, files: plan.files.map(f => ({ path: f.path, bytes: null, sha256: 'absent' })) } });
    input.failpoint?.('intent-durable');
    for (const [i, f] of plan.files.entries()) write(path.join(plan.transactionRoot, `stage-${i}`), Buffer.from(f.after, 'base64'), f.mode);
    record(plan.transactionRoot, 'prepared.json', { planSha256: input.planSha256 });
    input.failpoint?.('prepared-durable');
    return { state: 'prepared', planSha256: input.planSha256, hostChanged: false };
  });
}
// Only exact absent/after bytes and recorded directory inodes are recoverable.
// No atomic multi-file rename is assumed. Unknown files/links always block.
function live(plan) {
  if (absent(plan.hostRoot)) {
    if (DIRECTORIES.some((_, i) => !absent(path.join(plan.transactionRoot, `directory-${i}.json`))) && absent(path.join(plan.transactionRoot, 'uninstalled.json'))) refuse('host-directory-disappeared');
    return [];
  }
  const found = [];
  const walk = (full, rel = '') => {
    const info = lstatSync(safeAbsolute(full));
    if (info.isDirectory()) {
      const index = DIRECTORIES.indexOf(rel);
      if (index === -1 || canonicalJson(json(path.join(plan.transactionRoot, `directory-${index}.json`))) !== canonicalJson(identity(info))) refuse('host-foreign-directory');
      owned(full, { directory: true });
      for (const name of readdirSync(full)) walk(path.join(full, name), rel ? `${rel}/${name}` : name);
    } else {
      const index = plan.files.findIndex(f => f.path === rel), expected = plan.files[index];
      owned(full, { linked: true });
      if (!expected || sha256(readFileSync(full)) !== expected.afterSha256 || (info.mode & 0o777) !== expected.mode) refuse('host-unknown-live-bytes');
      const pending = path.join(plan.transactionRoot, `publish-${index}`);
      if (info.nlink !== 1) {
        if (info.nlink !== 2 || absent(pending)) refuse('host-hostile-link');
        const p = lstatSync(safeAbsolute(pending));
        if (p.ino !== info.ino || p.dev !== info.dev || p.nlink !== 2) refuse('host-hostile-link');
      }
      found.push(rel);
    }
  };
  walk(plan.hostRoot); return found;
}
function publish(plan, input, recovery = false) {
  const recheck = () => {
    boundaries(plan); packages(plan);
    if (!recovery) authorizeHostBootstrap(input);
    else if (Date.now() >= input.recovery.expiresAt) refuse('host-recovery-expired');
    transaction(plan, input); live(plan);
  };
  recheck();
  if (!absent(path.join(plan.transactionRoot, 'uninstalled.json'))) refuse('host-uninstalled-transaction');
  for (const [i, relative] of DIRECTORIES.entries()) {
    const dir = path.join(plan.hostRoot, relative);
    recheck();
    if (absent(dir)) {
      mkdirSync(dir, { mode: 0o700 }); flush(path.dirname(dir));
      record(plan.transactionRoot, `directory-${i}.json`, owned(dir, { directory: true, writable: true }));
    }
    input.failpoint?.(`directory-durable:${relative || '.'}`);
  }
  for (const [i, f] of plan.files.entries()) {
    recheck();
    const dest = path.join(plan.hostRoot, f.path), temporary = path.join(plan.transactionRoot, `publish-${i}`);
    if (absent(dest)) {
      if (absent(temporary)) write(temporary, Buffer.from(f.after, 'base64'), f.mode);
      if (sha256(readFileSync(safeAbsolute(temporary))) !== f.afterSha256 || lstatSync(temporary).nlink !== 1) refuse('host-publish-mismatch');
      input.failpoint?.(`before-publish:${f.path}`);
      recheck();
      // link is an atomic NO-REPLACE publication. A crash leaving two links is
      // recognizable by exact inode, bytes and journal-owned temporary name.
      linkSync(temporary, dest); flush(path.dirname(dest));
      input.failpoint?.(`linked:${f.path}`);
    }
    if (!absent(temporary)) {
      const a = lstatSync(safeAbsolute(temporary)), b = lstatSync(safeAbsolute(dest));
      if (a.ino !== b.ino || a.dev !== b.dev || a.nlink !== 2 || b.nlink !== 2) refuse('host-unknown-publication');
      unlinkSync(temporary); flush(plan.transactionRoot);
    }
    input.failpoint?.(`published:${f.path}`);
  }
  recheck();
  for (const rel of [...DIRECTORIES].reverse()) { chmodSync(path.join(plan.hostRoot, rel), 0o500); flush(path.join(plan.hostRoot, rel)); }
  input.failpoint?.('host-sealed');
  verifyHostPin(plan.hostRoot, sha256(canonicalJson(plan.pin)));
  record(plan.transactionRoot, 'installed.json', { planSha256: input.planSha256 });
  return { state: 'installed', hostRoot: plan.hostRoot, planSha256: input.planSha256, consumerMigration: false, realReleaseProvenance: 'PENDING' };
}
export function installHostBootstrap(input) {
  const plan = authorizeHostBootstrap(input); transaction(plan, input);
  return withLease(plan, input, () => publish(plan, input));
}
export function hostBootstrapStatus(input) {
  try {
    const plan = decode(input);
    if (absent(plan.transactionRoot)) return { state: absent(plan.hostRoot) ? 'not-prepared' : 'unknown', blocked: !absent(plan.hostRoot), realReleaseProvenance: 'PENDING' };
    transaction(plan, input);
    const files = live(plan);
    if (!absent(path.join(plan.transactionRoot, 'lease.json'))) return { state: 'writer-or-interrupted-lease', blocked: true };
    if (!absent(path.join(plan.transactionRoot, 'uninstalled.json'))) {
      if (!absent(plan.hostRoot)) refuse('host-uninstall-incomplete');
      return { state: 'uninstalled', blocked: false, evidenceRetained: true };
    }
    if (!absent(path.join(plan.transactionRoot, 'installed.json'))) {
      packages(plan); verifyHostPin(plan.hostRoot, sha256(canonicalJson(plan.pin)));
      return { state: 'installed', blocked: false, consumerMigration: false, realReleaseProvenance: 'PENDING' };
    }
    return { state: files.length || !absent(plan.hostRoot) ? 'recovery-required' : 'prepared', blocked: Boolean(files.length || !absent(plan.hostRoot)), evidenceRetained: true, realReleaseProvenance: 'PENDING' };
  } catch (e) { return { state: 'unknown', blocked: true, diagnostic: e.code ?? e.message, evidenceRetained: true, realReleaseProvenance: 'PENDING' }; }
}
export function recoverHostBootstrap(input, now = Date.now()) {
  const plan = decode(input), r = input.recovery;
  if (r) keys(r, ['format', 'operator', 'operatorApproved', 'outcome', 'reason', 'expiresAt', 'bound'], ['sourceOriginApproved', 'managerOriginApproved']);
  if (r?.format !== 'dev-foundry.host-recovery-approval.v1' || r.operator !== plan.operator || r.operatorApproved !== true ||
      !['finish', 'uninstall'].includes(r.outcome) || !r.reason?.trim() || !Number.isSafeInteger(r.expiresAt) || r.expiresAt <= now || r.expiresAt > now + MAX_AGE ||
      canonicalJson(r.bound) !== canonicalJson(hostApprovalBinding(plan, input.planSha256))) refuse('host-recovery-approval-required');
  transaction(plan, input);
  return withLease(plan, input, () => {
    if (r.outcome === 'finish') {
      if (r.sourceOriginApproved !== true || r.managerOriginApproved !== true) refuse('host-recovery-origin-approval-required');
      return publish(plan, input, true);
    }
    boundaries(plan); live(plan);
    // Safe reversal removes only recorded, still-exact host bytes. Source and
    // manager need not launch or remain healthy to undo this host installation.
    for (const rel of DIRECTORIES) {
      const dir = path.join(plan.hostRoot, rel);
      if (!absent(dir)) chmodSync(dir, 0o700);
    }
    for (const [i, f] of plan.files.entries()) {
      if (Date.now() >= r.expiresAt) refuse('host-recovery-expired');
      live(plan);
      const dest = path.join(plan.hostRoot, f.path), temporary = path.join(plan.transactionRoot, `publish-${i}`);
      if (!absent(dest)) { unlinkSync(dest); flush(path.dirname(dest)); }
      if (!absent(temporary)) { owned(temporary); if (sha256(readFileSync(temporary)) !== f.afterSha256) refuse('host-unknown-publication'); unlinkSync(temporary); flush(plan.transactionRoot); }
    }
    // Write inverse intent before removing directories so interrupted removals
    // remain recognizable. Never recursively delete or remove foreign bytes.
    if (absent(path.join(plan.transactionRoot, 'uninstalled.json'))) record(plan.transactionRoot, 'uninstalled.json', { planSha256: input.planSha256, recovery: r });
    for (const rel of [...DIRECTORIES].reverse()) {
      const dir = path.join(plan.hostRoot, rel);
      if (!absent(dir)) { rmdirSync(dir); flush(path.dirname(dir)); }
    }
    return { state: 'uninstalled', evidenceRetained: true, consumerMigration: false };
  });
}
