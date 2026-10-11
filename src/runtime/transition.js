import { lstatSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson, sha256 } from '../adopt/pin.js';
import { MCP_FILE } from '../adopt/common.js';
import { authorize } from './authorization.js';
import { authoritySnapshot, decodePlan, hashBytes, preservedFingerprint, readSafe, repository, revalidateSource } from './plan.js';
import { installedRuntime } from './store.js';
import { refuse, resolveConsumer, safeAbsolute } from './identity.js';
import { acquireLock, beginJournal, checkpoint, exclusiveBytes, flushDirectory, journalLocation, newOwner, runtimeUpgradeStatus, stagePlan } from './journal.js';

export { buildRuntimePlan } from './plan.js';
export { runtimeUpgradeStatus as status } from './journal.js';

function inputPlan(input) {
  const plan = decodePlan(input.planBytes, input.planSha256);
  if (plan.repository.root !== input.root) refuse('wrong-project');
  authorize(plan, input.planSha256, input.approval, input.evidence);
  journalLocation(input.root, { ignore: true });
  return plan;
}
function transaction(input) {
  const plan = inputPlan(input), current = runtimeUpgradeStatus(input.root);
  if (current.state === 'unknown' || current.planSha256 !== input.planSha256 || canonicalJson(current.plan) !== canonicalJson(plan)) refuse('journal-plan-conflict');
  return current;
}
function withLock(input, fn) {
  const owner = newOwner(input.owner), release = acquireLock(input.root, owner, { reconcile: input.reconcileLock });
  try { return fn(owner); } finally { release(); }
}

export function prepare(input) {
  const plan = inputPlan(input), current = runtimeUpgradeStatus(input.root);
  if (current.state !== 'none') {
    const tx = transaction(input);
    if (!['authorized', 'prepared'].includes(tx.state)) refuse('prepare-state-conflict');
    revalidateSource(plan, input.planSha256, { journal: true });
    if (tx.state === 'prepared') return { state: 'prepared', planSha256: input.planSha256 };
    return withLock(input, owner => { inputPlan(input); stagePlan(input.root, owner, input.failpoint); return { state: 'prepared' }; });
  }
  revalidateSource(plan, input.planSha256);
  inputPlan(input);
  const owner = newOwner(input.owner);
  const authorization = { approval: structuredClone(input.approval), evidence: structuredClone(input.evidence), authorizedAt: Date.now() };
  beginJournal(input.root, plan, input.planSha256, owner, authorization, input.failpoint);
  return withLock(input, lock => { stagePlan(input.root, lock, input.failpoint); return { state: 'prepared', planSha256: input.planSha256 }; });
}

function invariants(plan, { recoveryOutcome } = {}) {
  const root = plan.repository.root;
  if (canonicalJson(repository(root)) !== canonicalJson(plan.repository)) refuse('source-git-changed');
  if (preservedFingerprint(root, plan.files.map(f => f.path)) !== plan.preservedFingerprint) refuse('later-project-writes');
  // Never invoke the target runtime to recover; these are byte verifiers only.
  // Recovery needs only the runtime selected by the explicit outcome. A broken
  // target must not prevent restoration from durable source backups, and a
  // broken source process/package need not launch to finish a verified target.
  if (recoveryOutcome !== 'target') installedRuntime(plan.storeRoot, plan.sourcePin);
  if (recoveryOutcome !== 'source') installedRuntime(plan.storeRoot, plan.targetPin);
  try { lstatSync(path.join(root, '.dfc-cutover')); refuse('foreign-cutover-conflict'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const touched = new Set(plan.files.map(f => f.path));
  for (const [file, bytes] of Object.entries(plan.sourceAuthorityBytes)) {
    if (!touched.has(file) && hashBytes(readSafe(root, file)) !== sha256(bytes)) refuse('authority-changed');
  }
  for (const file of plan.files) {
    const hash = hashBytes(readSafe(root, file.path));
    if (![file.beforeSha256, file.afterSha256].includes(hash)) refuse('unknown-live-bytes');
  }
  for (const gate of plan.gates) if (hashBytes(readSafe(root, gate.path)) !== gate.sha256) refuse('gate-evidence-changed');
}

function liveWrite(input, owner, file, outcome, index) {
  const root = input.root, desired = outcome === 'target' ? file.after : file.before;
  const hash = outcome === 'target' ? file.afterSha256 : file.beforeSha256;
  if (hashBytes(readSafe(root, file.path)) === hash) return;
  inputPlan(input);
  invariants(runtimeUpgradeStatus(root).plan, { recoveryOutcome: input.recovery?.outcome });
  const target = safeAbsolute(path.join(root, file.path), { missing: true });
  checkpoint(root, outcome === 'target' ? 'writing' : 'rolling-back', owner, { path: file.path, outcome, beforeWrite: true }, input.failpoint);
  input.failpoint?.(`before-write:${file.path}`);
  // Validate inode and parent identities around caller failpoints. Node lacks
  // portable openat/renameat: refuse observed races; B4 owns native host proof.
  const beforeHash = hashBytes(readSafe(root, file.path));
  const parent = path.dirname(target);
  const missing = [];
  for (let p = parent; ; p = path.dirname(p)) {
    safeAbsolute(p, { missing: true });
    try { lstatSync(p); break; } catch (e) { if (e.code !== 'ENOENT') throw e; missing.push(p); }
  }
  for (const p of missing.reverse()) { mkdirSync(p, { mode: 0o700 }); flushDirectory(path.dirname(p)); }
  const parentInfo = lstatSync(safeAbsolute(parent));
  const temporary = path.join(journalLocation(root), 'locks/lease', `install-${index}-${owner.nonce}`);
  if (desired !== null) exclusiveBytes(temporary, Buffer.from(desired));
  input.failpoint?.(`before-publish:${file.path}`);
  const again = lstatSync(safeAbsolute(parent));
  if (again.ino !== parentInfo.ino || again.dev !== parentInfo.dev || hashBytes(readSafe(root, file.path)) !== beforeHash) refuse('filesystem-race');
  invariants(runtimeUpgradeStatus(root).plan, { recoveryOutcome: input.recovery?.outcome });
  inputPlan(input);
  if (desired === null) unlinkSync(target); else renameSync(temporary, target);
  flushDirectory(parent);
  input.failpoint?.(`after-write:${file.path}`);
  if (hashBytes(readSafe(root, file.path)) !== hash) refuse('write-verification-failed');
  checkpoint(root, outcome === 'target' ? 'writing' : 'rolling-back', owner, { path: file.path, outcome, afterWrite: true }, input.failpoint);
}
function reconcile(input, owner, outcome) {
  const current = runtimeUpgradeStatus(input.root), plan = current.plan;
  invariants(plan, { recoveryOutcome: input.recovery?.outcome });
  // Pin is last on forward cutover and last on source restoration. All target
  // authority and source backups were flushed before the commit barrier.
  const files = [...plan.files.filter(f => f.path !== MCP_FILE), ...plan.files.filter(f => f.path === MCP_FILE)];
  for (const [index, file] of files.entries()) liveWrite(input, owner, file, outcome, index);
  const snapshot = authoritySnapshot(input.root);
  if (snapshot.fingerprint !== (outcome === 'target' ? plan.targetAuthority : plan.sourceAuthority) ||
      resolveConsumer(input.root).expect !== (outcome === 'target' ? plan.targetPin : plan.sourcePin)) refuse('reconcile-verification-failed');
  checkpoint(input.root, outcome === 'target' ? 'await-new-session' : 'rolled-back', owner, {}, input.failpoint);
  return { state: outcome === 'target' ? 'await-new-session' : 'rolled-back', completed: false };
}

export function commit(input) {
  const current = transaction(input);
  if (current.state !== 'prepared') refuse('commit-state-conflict');
  return withLock(input, owner => {
    revalidateSource(current.plan, input.planSha256, { journal: true });
    inputPlan(input);
    checkpoint(input.root, 'committing', owner, { restartRequired: true }, input.failpoint);
    return reconcile({ ...input, recovery: undefined }, owner, 'target');
  });
}

export function recover(input) {
  const current = transaction(input);
  const recovery = input.recovery;
  if (recovery?.operatorApproved !== true || recovery.planSha256 !== input.planSha256 ||
      !['source', 'target'].includes(recovery.outcome) || !recovery.reason?.trim()) refuse('recovery-approval-required');
  if (current.state === 'rolled-back' && recovery.outcome === 'source') { invariants(current.plan, { recoveryOutcome: 'source' }); return { state: 'rolled-back' }; }
  if (['unknown', 'completed', 'authorized'].includes(current.state)) refuse('recovery-state-blocked');
  if (recovery.outcome === 'source' && (!current.plan.rollbackSafe || current.checkpoints.some(c => c.state === 'completed'))) refuse('forward-only-recovery');
  return withLock(input, owner => {
    invariants(current.plan, { recoveryOutcome: recovery.outcome });
    if (recovery.outcome === 'source') {
      checkpoint(input.root, 'rolling-back', owner, { recovery }, input.failpoint);
      return reconcile(input, owner, 'source');
    }
    if (current.state === 'prepared') revalidateSource(current.plan, input.planSha256, { journal: true });
    if (current.state === 'prepared') checkpoint(input.root, 'committing', owner, { recovery }, input.failpoint);
    else if (['committing', 'writing', 'forward-recovery', 'await-new-session', 'verifying'].includes(current.state)) checkpoint(input.root, 'forward-recovery', owner, { recovery }, input.failpoint);
    else if (current.state === 'rolling-back') refuse('rollback-in-flight');
    return reconcile(input, owner, 'target');
  });
}

// This boundary accepts a fresh independent session attestation. A source
// session ID or an observed target pin alone cannot complete the transition.
// B3 must supply actual fresh-process observations; B2 exercises explicit data.
export function verify(input) {
  const current = transaction(input), plan = current.plan, session = input.session;
  if (current.state === 'completed') {
    invariants(plan);
    if (authoritySnapshot(input.root).fingerprint !== plan.targetAuthority || resolveConsumer(input.root).expect !== plan.targetPin) refuse('target-changed');
    return { state: 'completed', completed: true };
  }
  if (!['await-new-session', 'verifying'].includes(current.state) || session?.independent !== true ||
      !session.id?.trim() || session.id === plan.proposal.sourceSessionId || session.pin !== plan.targetPin ||
      session.planSha256 !== input.planSha256 || session.authority !== plan.targetAuthority || !session.evidence?.trim()) refuse('fresh-target-verification-required');
  return withLock(input, owner => {
    invariants(plan);
    checkpoint(input.root, 'verifying', owner, { session }, input.failpoint);
    input.failpoint?.('before-verifier');
    const runtime = installedRuntime(plan.storeRoot, plan.targetPin);
    const snapshot = authoritySnapshot(input.root);
    if (snapshot.fingerprint !== plan.targetAuthority || resolveConsumer(input.root).expect !== plan.targetPin ||
        plan.files.some(f => hashBytes(readSafe(input.root, f.path)) !== f.afterSha256)) refuse('target-verification-failed');
    input.failpoint?.('after-verifier');
    inputPlan(input);
    checkpoint(input.root, 'completed', owner, { session, runtimePin: runtime.expect, authority: snapshot.fingerprint }, input.failpoint);
    return { state: 'completed', completed: true, restartRequired: true };
  });
}
