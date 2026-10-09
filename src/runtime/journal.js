import { closeSync, constants, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { canonicalJson, sha256 } from '../adopt/pin.js';
import { git } from '../adopt/ignore.js';
import { safeAbsolute, refuse } from './identity.js';
import { decodePlan } from './plan.js';
import { authorize } from './authorization.js';

export const JOURNAL_DIR = '.dfc-runtime-upgrade';
const validOwner = owner => owner && /^[A-Za-z0-9_-]{1,64}$/.test(owner.id) && /^[0-9a-f-]{36}$/.test(owner.nonce) &&
  Number.isSafeInteger(owner.pid) && owner.pid > 0 && typeof owner.host === 'string' && owner.host.length > 0 && Number.isSafeInteger(owner.createdAt);
const states = {
  authorized: ['prepared'], prepared: ['committing', 'rolling-back'],
  committing: ['writing', 'await-new-session', 'rolling-back', 'forward-recovery'], writing: ['writing', 'await-new-session', 'rolling-back', 'forward-recovery'],
  'await-new-session': ['verifying', 'rolling-back', 'forward-recovery'],
  verifying: ['verifying', 'completed', 'rolling-back', 'forward-recovery'],
  'forward-recovery': ['writing', 'await-new-session', 'forward-recovery'],
  'rolling-back': ['rolling-back', 'rolled-back'], completed: [], 'rolled-back': [],
};
export function flushDirectory(dir) {
  const fd = openSync(safeAbsolute(dir), constants.O_RDONLY);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
export function exclusiveBytes(file, bytes) {
  safeAbsolute(file, { missing: true });
  const fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  flushDirectory(path.dirname(file));
}
function json(file) {
  safeAbsolute(file);
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.nlink !== 1) refuse('journal-unsafe');
  const bytes = readFileSync(file), value = JSON.parse(bytes);
  if (canonicalJson(value) !== bytes.toString()) refuse('journal-noncanonical');
  return value;
}
export function journalLocation(root, { ignore = false } = {}) {
  const base = safeAbsolute(root), dir = safeAbsolute(path.join(base, JOURNAL_DIR), { missing: true });
  if (ignore) {
    // Disable global ignore policy and require the directory itself to be
    // excluded. An unignored parent plus re-included children cannot qualify.
    for (const f of ['.gitignore', '.git/info/exclude']) safeAbsolute(path.join(base, f), { missing: true });
    for (const f of [JOURNAL_DIR + '/', JOURNAL_DIR + '/intent.json', JOURNAL_DIR + '/stage-0.json', JOURNAL_DIR + '/locks/lease/owner.json']) {
      if (git(base, ['check-ignore', '-q', '--no-index', '--', f]).status !== 0) refuse('journal-ignore-required');
    }
    if (git(base, ['ls-files', '--', JOURNAL_DIR]).stdout.trim()) refuse('journal-tracked');
  }
  return dir;
}

// A directory that exists but lacks a complete intent is UNKNOWN, never NONE.
export function runtimeUpgradeStatus(root) {
  let dir;
  try {
    dir = journalLocation(root);
    try { lstatSync(dir); } catch (e) { if (e.code === 'ENOENT') return { state: 'none', blocked: false, epoch: null }; throw e; }
    if (!lstatSync(dir).isDirectory()) refuse('journal-unsafe');
    const intent = json(path.join(dir, 'intent.json'));
    const plan = decodePlan(Buffer.from(canonicalJson(intent.plan)), intent.planSha256);
    if (intent.format !== 'dev-foundry.runtime-intent.v1' || plan.repository.root !== root) refuse('journal-invalid');
    if (!Number.isSafeInteger(intent.authorization?.authorizedAt) || intent.authorization.authorizedAt <= 0) refuse('journal-authorization-missing');
    authorize(plan, intent.planSha256, intent.authorization.approval, intent.authorization.evidence, intent.authorization.authorizedAt);
    const names = readdirSync(dir).sort();
    if (names.some(n => !['intent.json', 'locks'].includes(n) && !/^checkpoint-[0-9]{6}\.json$/.test(n) && !/^stage-[0-9]+\.json$/.test(n))) refuse('journal-unknown-file');
    const records = names.filter(n => n.startsWith('checkpoint-'));
    let previous = null, state = null;
    const checkpoints = [];
    for (const [i, name] of records.entries()) {
      if (name !== `checkpoint-${String(i).padStart(6, '0')}.json`) refuse('journal-gap');
      const record = json(path.join(dir, name));
      const { seal, ...body } = record;
      if (sha256(canonicalJson(body)) !== seal || record.planSha256 !== intent.planSha256 || record.previous !== previous || record.sequence !== i ||
          (state === null ? record.state !== 'authorized' : !states[state]?.includes(record.state)) ||
          !validOwner(record.owner)) refuse('journal-checkpoint-invalid');
      if (i === 0 && record.detail?.authorizationSha256 !== sha256(canonicalJson(intent.authorization))) refuse('journal-authorization-changed');
      previous = seal; state = record.state; checkpoints.push(record);
      if (state === 'completed' && (record.detail?.runtimePin !== plan.targetPin || record.detail?.authority !== plan.targetAuthority ||
          record.detail.session?.independent !== true || !record.detail.session.id || record.detail.session.id === plan.proposal.sourceSessionId ||
          record.detail.session.pin !== plan.targetPin || record.detail.session.planSha256 !== intent.planSha256 ||
          record.detail.session.authority !== plan.targetAuthority || !checkpoints.some(c => c.state === 'verifying' && canonicalJson(c.detail.session) === canonicalJson(record.detail.session)))) refuse('journal-verification-missing');
    }
    if (!state) refuse('journal-incomplete');
    for (const [i, file] of plan.files.entries()) {
      const staged = names.includes(`stage-${i}.json`);
      if (!staged && state !== 'authorized') refuse('journal-missing-backup');
      if (staged && canonicalJson(json(path.join(dir, `stage-${i}.json`))) !== canonicalJson({ path: file.path,
        before: file.before, after: file.after, beforeSha256: file.beforeSha256, afterSha256: file.afterSha256 })) refuse('journal-backup-invalid');
    }
    if (names.filter(n => n.startsWith('stage-')).length > plan.files.length) refuse('journal-unknown-file');
    const inspectLocks = locks => {
      for (const name of readdirSync(locks)) {
        if (name !== 'lease' && !/^(released|stale)-[0-9a-f-]{36}$/.test(name)) refuse('journal-unknown-lock');
        const holder = safeAbsolute(path.join(locks, name));
        if (!lstatSync(holder).isDirectory()) refuse('journal-unsafe');
        const owner = json(path.join(holder, 'owner.json'));
        if (!validOwner(owner)) refuse('journal-unknown-lock');
        for (const file of readdirSync(holder)) {
          if (file === 'owner.json') continue;
          if (!new RegExp(`^install-[0-9]+-${owner.nonce}$`).test(file)) refuse('journal-unknown-lock');
          const full = safeAbsolute(path.join(holder, file)), info = lstatSync(full);
          if (!info.isFile() || info.nlink !== 1 || !plan.files.some(f => [f.beforeSha256, f.afterSha256].includes(sha256(readFileSync(full))))) refuse('journal-unsafe');
        }
      }
    };
    if (names.includes('locks')) inspectLocks(path.join(dir, 'locks'));
    // Terminal records attest the transition at verification time. They never
    // override/freeze future configured authority: current operation authority
    // continues to be resolved by the existing governance MCP.
    return { state, blocked: !['authorized', 'prepared', 'completed', 'rolled-back'].includes(state),
      epoch: ['authorized', 'prepared'].includes(state) ? null : intent.planSha256,
      planSha256: intent.planSha256, plan, checkpoints, dir };
  } catch (error) { return { state: 'unknown', blocked: true, epoch: null, diagnostic: error.code ?? error.message }; }
}

export function checkpoint(root, state, owner, detail = {}, failpoint) {
  const current = runtimeUpgradeStatus(root);
  if (current.state === 'unknown' || !states[current.state]?.includes(state)) refuse('journal-state-conflict');
  const sequence = current.checkpoints.length;
  const body = { sequence, state, owner, detail, planSha256: current.planSha256, previous: current.checkpoints.at(-1).seal };
  failpoint?.(`before-checkpoint:${state}`);
  exclusiveBytes(path.join(current.dir, `checkpoint-${String(sequence).padStart(6, '0')}.json`), Buffer.from(canonicalJson({ ...body, seal: sha256(canonicalJson(body)) })));
  failpoint?.(`after-checkpoint:${state}`);
}

export function beginJournal(root, plan, planSha256, owner, authorization, failpoint) {
  const dir = journalLocation(root, { ignore: true });
  mkdirSync(dir, { mode: 0o700 }); flushDirectory(root);
  failpoint?.('after-journal-directory');
  exclusiveBytes(path.join(dir, 'intent.json'), Buffer.from(canonicalJson({ format: 'dev-foundry.runtime-intent.v1', plan, planSha256, authorization })));
  failpoint?.('after-intent');
  const body = { sequence: 0, state: 'authorized', owner, detail: { authorizationSha256: sha256(canonicalJson(authorization)) }, planSha256, previous: null };
  exclusiveBytes(path.join(dir, 'checkpoint-000000.json'), Buffer.from(canonicalJson({ ...body, seal: sha256(canonicalJson(body)) })));
  failpoint?.('after-checkpoint:authorized');
  return dir;
}
export function stagePlan(root, owner, failpoint) {
  const current = runtimeUpgradeStatus(root);
  if (current.state !== 'authorized') refuse('journal-state-conflict');
  for (const [i, file] of current.plan.files.entries()) {
    const target = path.join(current.dir, `stage-${i}.json`);
    try { lstatSync(target); } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      failpoint?.(`before-stage:${i}`);
      exclusiveBytes(target, Buffer.from(canonicalJson({ path: file.path, before: file.before, after: file.after,
        beforeSha256: file.beforeSha256, afterSha256: file.afterSha256 })));
      failpoint?.(`after-stage:${i}`);
    }
  }
  checkpoint(root, 'prepared', owner, {}, failpoint);
}

export function newOwner(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) refuse('lock-owner-invalid');
  return { id, nonce: randomUUID(), pid: process.pid, host: os.hostname(), createdAt: Date.now() };
}
export function acquireLock(root, owner, { reconcile } = {}) {
  if (!validOwner(owner)) refuse('lock-owner-invalid');
  const dir = journalLocation(root, { ignore: true }), locks = path.join(dir, 'locks'), lease = path.join(locks, 'lease');
  safeAbsolute(locks, { missing: true });
  try { mkdirSync(locks, { mode: 0o700 }); flushDirectory(dir); } catch (e) { if (e.code !== 'EEXIST') throw e; }
  try { mkdirSync(lease, { mode: 0o700 }); } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const old = json(path.join(lease, 'owner.json'));
    if (!reconcile || canonicalJson(reconcile) !== canonicalJson(old) || old.host !== os.hostname() || old.pid === process.pid ||
        !Number.isSafeInteger(old.pid) || old.pid <= 0 || !Number.isSafeInteger(old.createdAt) || old.createdAt > Date.now() ||
        runtimeUpgradeStatus(root).state === 'unknown') refuse('lock-conflict');
    try { process.kill(old.pid, 0); refuse('lock-owner-live'); } catch (err) { if (err.code !== 'ESRCH') throw err; }
    // Retain the exact old lock and evidence; explicit dead-owner observation
    // never repairs an unknown transaction or overwrites a competing lease.
    renameSync(lease, path.join(locks, `stale-${randomUUID()}`)); flushDirectory(locks);
    mkdirSync(lease, { mode: 0o700 });
  }
  exclusiveBytes(path.join(lease, 'owner.json'), Buffer.from(canonicalJson(owner))); flushDirectory(locks);
  return () => {
    if (canonicalJson(json(path.join(lease, 'owner.json'))) !== canonicalJson(owner)) refuse('lock-owner-changed');
    renameSync(lease, path.join(locks, `released-${owner.nonce}`)); flushDirectory(locks);
  };
}
