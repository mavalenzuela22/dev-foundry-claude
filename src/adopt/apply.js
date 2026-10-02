import { mkdir, readFile, readdir, realpath, rename, rm, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createPlan } from './plan.js';
import { sha256 } from './pin.js';

export class ApplyError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const readOrNull = (target) => readFile(target).catch(() => null);
const isDirectory = (target) => stat(target).then((info) => info.isDirectory(), () => false);

// Writes only the plan's create/merge/delete entries via staging and rename, with rollback.
export async function applyPlan({ planBytes, planSha256, adapter, root: rootArgument }) {
  if (sha256(planBytes) !== planSha256) throw new ApplyError('plan-hash-mismatch', 'The plan hash does not match the plan file.');
  let supplied;
  try { supplied = JSON.parse(planBytes.toString('utf8')); } catch { throw new ApplyError('plan-invalid', 'The plan file is not valid JSON.'); }
  if (supplied.status !== 'ready') throw new ApplyError('plan-not-ready', 'The plan is not ready to apply.');
  const current = await createPlan({
    root: rootArgument, project: supplied.target?.project, idPrefix: supplied.target?.idPrefix, remove: supplied.mode === 'remove', adapter,
  });
  if (current.hash !== planSha256 || current.plan.status !== 'ready') throw new ApplyError('plan-stale', 'Repository or adapter state drifted from the plan.');
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
      await writeFile(stage, write.content, 'utf8');
      staged.push(stage);
      journal.push({ target, stage, prior: await readOrNull(target) });
    }
    for (const entry of journal) await rename(entry.stage, entry.target);
    staged.length = 0;
    for (const relative of current.ops.deletes) {
      const target = absolute(relative);
      journal.push({ target, prior: await readFile(target) });
      await unlink(target);
    }
    if (supplied.mode === 'remove') {
      const agentDir = absolute('.claude/agents');
      if (await isDirectory(agentDir) && (await readdir(agentDir)).length === 0) await rmdir(agentDir);
    }
  } catch (error) {
    for (const entry of [...journal].reverse()) {
      try {
        if (entry.prior === null) await rm(entry.target, { force: true });
        else await mkdir(path.dirname(entry.target), { recursive: true }).then(() => writeFile(entry.target, entry.prior));
      } catch { /* best effort */ }
    }
    for (const stage of staged) await rm(stage, { force: true });
    for (const dir of [...createdDirs].reverse()) await rmdir(dir).catch(() => {});
    throw new ApplyError('apply-failed', 'Apply failed and was rolled back.');
  }
  return { written: current.plan.create.length + current.plan.merge.length, deleted: current.plan.delete.length };
}
