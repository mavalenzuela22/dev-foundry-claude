import { mkdir, readFile, readdir, realpath, rename, rm, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPlan, reconciliationSurface } from './plan.js';
import { isDeepStrictEqual } from 'node:util';
import { selfPin, sha256 } from './pin.js';
import { createUpgradePlan } from './upgrade.js';
import { pathHasSymlink, readContained, RECONCILIATION_FILE } from './common.js';
import { git } from './ignore.js';
import { beginRuntimeUpgrade, finishRuntimeUpgrade, installRuntime, resolveRuntime } from './runtime.js';

export class ApplyError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const readOrNull = (target) => readFile(target).catch(() => null);
const isDirectory = (target) => stat(target).then((info) => info.isDirectory(), () => false);

// Writes only the plan's create/merge/delete entries via staging and rename, with rollback.
export async function applyPlan({ planBytes, planSha256, adapter, root: rootArgument, upgrade = false, resolutionFile, targetPackageRoot, env = process.env }) {
  if (sha256(planBytes) !== planSha256) throw new ApplyError('plan-hash-mismatch', 'The plan hash does not match the plan file.');
  let supplied;
  try { supplied = JSON.parse(planBytes.toString('utf8')); } catch { throw new ApplyError('plan-invalid', 'The plan file is not valid JSON.'); }
  const upgrading = supplied.mode === 'upgrade';
  if (upgrading !== upgrade) throw new ApplyError('plan-invalid', 'The plan mode does not match the command.');
  if (supplied.status !== 'ready' && !(upgrading && supplied.status === 'noop')) throw new ApplyError('plan-not-ready', 'The plan is not ready to apply.');
  // Never discover a decision file from untrusted plan JSON: the caller must
  // select it again when authorizing application of this exact reviewed plan.
  const current = upgrading ? await createUpgradePlan({ root: rootArgument, adapter, currentPackageRoot: supplied.currentPackageRoot, resolutionFile }) : await createPlan({
    root: rootArgument, project: supplied.target?.project, idPrefix: supplied.target?.idPrefix, remove: supplied.mode === 'remove', adapter,
    initialBootstrap: supplied.mode === 'initial-bootstrap', classification: supplied.bootstrap?.classification, operator: supplied.bootstrap?.operator,
  });
  if (!current.bytes.equals(planBytes) || current.hash !== planSha256 || current.plan.status !== supplied.status) throw new ApplyError('plan-stale', 'Repository or adapter state drifted from the plan.');
  const root = await realpath(path.resolve(rootArgument ?? process.cwd()));
  const absolute = (relative) => path.join(root, ...relative.split('/'));

  const writes = [...current.ops.writes].sort((a, b) => a.path === '.mcp.json' ? 1 : b.path === '.mcp.json' ? -1 :
    a.path === RECONCILIATION_FILE ? 1 : b.path === RECONCILIATION_FILE ? -1 : a.path.localeCompare(b.path));
  let runtimeJournal;
  if (upgrading && writes.length && targetPackageRoot) {
    const installedRoot = path.resolve(targetPackageRoot);
    try {
      if (selfPin(installedRoot).expect !== adapter.expect) throw new Error();
    } catch { throw new ApplyError('target-runtime-unverified', 'The target runtime does not match the reviewed plan.'); }
    try {
      if (current.plan.currentPackageRoot) await installRuntime({ packageRoot: current.plan.currentPackageRoot, expect: current.plan.current.expect, env });
      else await resolveRuntime({ expect: current.plan.current.expect, packageRoot: installedRoot, env });
    } catch (error) { throw new ApplyError(`source-${error.code ?? 'runtime-unavailable'}`, 'The pinned source runtime must remain available for safe recovery.'); }
    try { runtimeJournal = await beginRuntimeUpgrade({ root, planBytes, planSha256, writes }); }
    catch (error) { throw new ApplyError(error.code ?? 'runtime-journal-failed', 'Upgrade could not record durable recovery intent.'); }
  }

  const journal = [];
  const createdDirs = [];
  const staged = [];
  const boundSurface = upgrading && current.plan.reconciliationEvidence
    ? await reconciliationSurface(root, current.plan.preconditions) : null;
  try {
    for (const write of writes) {
      if (await pathHasSymlink(root, write.path)) throw new ApplyError('plan-stale', 'A planned path changed during staging.');
      const target = absolute(write.path);
      const missing = [];
      for (let probe = path.dirname(target); probe !== root && !(await isDirectory(probe)); probe = path.dirname(probe)) missing.push(probe);
      await mkdir(path.dirname(target), { recursive: true });
      createdDirs.push(...missing);
      const stage = `${target}.dfc-stage-${process.pid}`;
      await writeFile(stage, write.content, { encoding: 'utf8', flag: 'wx' });
      staged.push(stage);
      journal.push({ target, stage, stagedSha256: sha256(Buffer.from(write.content)), prior: await readOrNull(target) });
    }
    // Staging must not hide a changed decision or precondition. Re-read exact
    // inputs immediately before installing any staged byte; discard on drift.
    if (upgrading && current.ops.writes.length) {
      const decision = current.plan.resolutionInput;
      if (decision && (await pathHasSymlink(path.parse(decision.path).root, decision.path.slice(path.parse(decision.path).root.length).split(path.sep).join('/')) ||
          sha256(await readOrNull(decision.path) ?? Buffer.alloc(0)) !== decision.sha256)) throw new ApplyError('plan-stale', 'Resolution input changed during staging.');
      for (const [file, expected] of Object.entries(current.plan.preconditions)) {
        const bytes = await readContained(root, file);
        if (await pathHasSymlink(root, file) || (bytes === null ? 'absent' : sha256(bytes)) !== expected) throw new ApplyError('plan-stale', 'Plan inputs changed during staging.');
      }
      try {
        if (current.plan.currentPackageRoot && selfPin(current.plan.currentPackageRoot).expect !== current.plan.current.expect) throw new Error();
      } catch { throw new ApplyError('plan-stale', 'Previous package changed during staging.'); }
      const head = git(root, ['rev-parse', 'HEAD']);
      const diff = git(root, ['diff', 'HEAD', '--binary']);
      const status = git(root, ['status', '--porcelain', '--untracked-files=all']);
      const stagePaths = new Set(staged.map((file) => path.relative(root, file).split(path.sep).join('/')));
      if (boundSurface && !isDeepStrictEqual(boundSurface, await reconciliationSurface(root, current.plan.preconditions, [], stagePaths))) {
        throw new ApplyError('plan-stale', 'The reconciliation surface changed during staging.');
      }
      const unstagedStatus = status.stdout.split('\n').filter((line) => line && !stagePaths.has(line.slice(3)) &&
        !/^\?\? \.dfc-runtime-upgrade\//.test(line)).join('\n');
      if (head.status !== 0 || diff.status !== 0 || status.status !== 0 || head.stdout.trim() !== current.plan.repository.head ||
          sha256(diff.stdout) !== current.plan.repository.diffSha256 || sha256(unstagedStatus) !== current.plan.repository.statusSha256) {
        throw new ApplyError('plan-stale', 'Repository changed during staging.');
      }
    }
    for (const entry of journal.sort((a, b) => path.basename(a.target) === '.mcp.json' ? 1 : path.basename(b.target) === '.mcp.json' ? -1 :
      path.relative(root, a.target).split(path.sep).join('/') === RECONCILIATION_FILE ? 1 :
      path.relative(root, b.target).split(path.sep).join('/') === RECONCILIATION_FILE ? -1 : a.target.localeCompare(b.target))) {
      if (await pathHasSymlink(root, path.relative(root, entry.stage).split(path.sep).join('/')) ||
          sha256(await readOrNull(entry.stage) ?? Buffer.alloc(0)) !== entry.stagedSha256) {
        throw new ApplyError('plan-stale', 'Staged content changed before installation.');
      }
      await rename(entry.stage, entry.target); entry.installed = true;
    }
    staged.length = 0;
    for (const relative of current.ops.deletes) {
      const target = absolute(relative);
      const entry = { target, prior: await readFile(target) };
      journal.push(entry);
      await unlink(target);
      entry.installed = true;
    }
    if (supplied.mode === 'remove') {
      const agentDir = absolute('.claude/agents');
      if (await isDirectory(agentDir) && (await readdir(agentDir)).length === 0) await rmdir(agentDir);
    }
    if (runtimeJournal) {
      const pinBytes = await readContained(root, '.mcp.json');
      const selected = JSON.parse(pinBytes.toString('utf8')).mcpServers?.['dev-foundry-governance']?.args?.[2];
      if (selected !== current.plan.target.expect || selfPin(path.resolve(targetPackageRoot)).expect !== current.plan.target.expect) {
        throw new ApplyError('target-runtime-unverified', 'Target selection did not verify after cutover.');
      }
      await finishRuntimeUpgrade({ root, planSha256, outcome: 'target' });
      runtimeJournal = null;
    }
  } catch (error) {
    for (const entry of [...journal].reverse()) {
      if (!entry.installed) continue;
      try {
        if (entry.prior === null) await rm(entry.target, { force: true });
        else await mkdir(path.dirname(entry.target), { recursive: true }).then(() => writeFile(entry.target, entry.prior));
      } catch { /* best effort */ }
    }
    for (const stage of staged) await rm(stage, { force: true });
    for (const dir of [...createdDirs].reverse()) await rmdir(dir).catch(() => {});
    if (runtimeJournal) {
      try { await finishRuntimeUpgrade({ root, planSha256, outcome: 'source' }); runtimeJournal = null; } catch { /* durable journal remains for explicit recovery */ }
    }
    if (error instanceof ApplyError) throw error;
    throw new ApplyError('apply-failed', 'Apply failed and was rolled back.');
  }
  return { written: current.plan.create.length + current.plan.merge.length, deleted: current.plan.delete.length };
}
