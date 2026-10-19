import { mkdir, readFile, readdir, realpath, rename, rm, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPlan } from './plan.js';
import { selfPin, sha256 } from './pin.js';
import { createUpgradePlan } from './upgrade.js';
import { pathHasSymlink, readContained } from './common.js';
import { git } from './ignore.js';

export class ApplyError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const readOrNull = (target) => readFile(target).catch(() => null);
const isDirectory = (target) => stat(target).then((info) => info.isDirectory(), () => false);

// Writes only the plan's create/merge/delete entries via staging and rename, with rollback.
export async function applyPlan({ planBytes, planSha256, adapter, root: rootArgument, upgrade = false, resolutionFile }) {
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

  const journal = [];
  const createdDirs = [];
  const staged = [];
  try {
    for (const write of current.ops.writes) {
      const target = absolute(write.path);
      const missing = [];
      for (let probe = path.dirname(target); probe !== root && !(await isDirectory(probe)); probe = path.dirname(probe)) missing.push(probe);
      await mkdir(path.dirname(target), { recursive: true });
      createdDirs.push(...missing);
      const stage = `${target}.dfc-stage-${process.pid}`;
      await writeFile(stage, write.content, { encoding: 'utf8', flag: 'wx' });
      staged.push(stage);
      journal.push({ target, stage, prior: await readOrNull(target) });
    }
    // Staging must not hide a changed decision or precondition. Re-read exact
    // inputs immediately before installing any staged byte; discard on drift.
    if (upgrading && current.plan.resolutionInput) {
      const decision = current.plan.resolutionInput;
      if (await pathHasSymlink(path.parse(decision.path).root, decision.path.slice(path.parse(decision.path).root.length).split(path.sep).join('/')) ||
          sha256(await readOrNull(decision.path) ?? Buffer.alloc(0)) !== decision.sha256) throw new ApplyError('plan-stale', 'Resolution input changed during staging.');
      for (const [file, expected] of Object.entries(current.plan.preconditions)) {
        const bytes = await readContained(root, file);
        if (await pathHasSymlink(root, file) || (bytes === null ? 'absent' : sha256(bytes)) !== expected) throw new ApplyError('plan-stale', 'Plan inputs changed during staging.');
      }
      try {
        if (selfPin(current.plan.currentPackageRoot).expect !== current.plan.current.expect) throw new Error();
      } catch { throw new ApplyError('plan-stale', 'Previous package changed during staging.'); }
      const head = git(root, ['rev-parse', 'HEAD']);
      const diff = git(root, ['diff', 'HEAD', '--binary']);
      const status = git(root, ['status', '--porcelain', '--untracked-files=all']);
      const stagePaths = new Set(staged.map((file) => path.relative(root, file).split(path.sep).join('/')));
      const unstagedStatus = status.stdout.split('\n').filter((line) => !stagePaths.has(line.slice(3))).join('\n');
      if (head.status !== 0 || diff.status !== 0 || status.status !== 0 || head.stdout.trim() !== current.plan.repository.head ||
          sha256(diff.stdout) !== current.plan.repository.diffSha256 || sha256(unstagedStatus) !== current.plan.repository.statusSha256) {
        throw new ApplyError('plan-stale', 'Repository changed during staging.');
      }
    }
    for (const entry of journal) { await rename(entry.stage, entry.target); entry.installed = true; }
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
    if (error instanceof ApplyError) throw error;
    throw new ApplyError('apply-failed', 'Apply failed and was rolled back.');
  }
  return { written: current.plan.create.length + current.plan.merge.length, deleted: current.plan.delete.length };
}
