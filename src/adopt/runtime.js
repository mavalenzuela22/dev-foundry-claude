import { cp, mkdir, open, readFile, realpath, rename, rm, readdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { MCP_FILE, MCP_SERVER_NAME, pathHasSymlink, readContained, safeRelativePath } from './common.js';
import { canonicalJson, parseExpect, selfPin, sha256, verifyPayload } from './pin.js';

export class RuntimeError extends Error {
  constructor(code) { super('Adapter runtime could not be selected safely.'); this.code = code; }
}

const fail = (code) => { throw new RuntimeError(code); };
const storeRoot = (env = process.env) => path.resolve(env.DEV_FOUNDRY_RUNTIME_STORE ?? path.join(os.homedir(), '.dev-foundry-claude', 'runtimes'));
const journalDir = '.dfc-runtime-upgrade';
const journalFormat = 'dev-foundry.runtime-upgrade-intent.v1';
const slotName = (expect) => {
  const pin = parseExpect(expect);
  return `${pin.version}--${pin.root}`;
};
async function verifyAdapterPackage(root, expect) {
  const pin = verifyPayload(root, expect);
  let pkg;
  try { pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')); } catch { fail('selected-runtime-unavailable'); }
  if (pkg.name !== '@dev-foundry/claude-adapter' || pkg.version !== pin.version) fail('selected-runtime-unavailable');
  return pin;
}

export async function readConsumerPin(root) {
  const base = await realpath(root);
  if (await pathHasSymlink(base, MCP_FILE)) fail('unsafe-consumer-pin');
  let config;
  try {
    const bytes = await readContained(base, MCP_FILE);
    if (bytes === null) fail('consumer-pin-missing');
    config = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    if (error instanceof RuntimeError) throw error;
    fail('consumer-pin-invalid');
  }
  const entry = config?.mcpServers?.[MCP_SERVER_NAME];
  if (entry === undefined) fail('consumer-pin-missing');
  if (entry?.command !== 'dev-foundry-claude' || !Array.isArray(entry.args) || entry.args.length !== 3 ||
      entry.args[0] !== 'mcp' || entry.args[1] !== '--expect') fail('consumer-pin-invalid');
  parseExpect(entry.args[2]);
  return entry.args[2];
}

export async function resolveRuntime({ expect, packageRoot, env = process.env } = {}) {
  parseExpect(expect);
  try {
    const installed = await realpath(packageRoot);
    if (await verifyAdapterPackage(installed, expect) && selfPin(installed).expect === expect) return installed;
  } catch { /* resolve the selected immutable installation below */ }
  const requestedRoot = storeRoot(env);
  let root;
  try {
    const parent = await realpath(path.dirname(requestedRoot));
    root = path.join(parent, path.basename(requestedRoot));
    if (await pathHasSymlink(path.parse(root).root, root.slice(path.parse(root).root.length).split(path.sep).join('/'))) fail('runtime-store-unsafe');
  } catch (error) {
    if (error instanceof RuntimeError) throw error;
    fail('selected-runtime-unavailable');
  }
  const selected = path.join(root, slotName(expect));
  try {
    const canonical = await realpath(selected);
    const canonicalStore = await realpath(root);
    const relative = path.relative(canonicalStore, canonical);
    if (relative.startsWith('..') || path.isAbsolute(relative) || await pathHasSymlink(root, slotName(expect))) fail('runtime-store-unsafe');
    await verifyAdapterPackage(canonical, expect);
    return canonical;
  } catch (error) {
    if (error instanceof RuntimeError) throw error;
    fail('selected-runtime-unavailable');
  }
}

export async function selectConsumerRuntime({ root, packageRoot, env = process.env } = {}) {
  const expect = await readConsumerPin(root);
  return { expect, packageRoot: await resolveRuntime({ expect, packageRoot, env }) };
}

// Publish an already acquired and verified package into its immutable exact-pin
// slot. This never edits a consumer and refuses to replace an existing slot.
export async function installRuntime({ packageRoot, expect, env = process.env } = {}) {
  parseExpect(expect);
  let source;
  try { source = await realpath(packageRoot); await verifyAdapterPackage(source, expect); }
  catch { fail('runtime-package-unverified'); }
  const requestedRoot = storeRoot(env);
  let root;
  try {
    await mkdir(path.dirname(requestedRoot), { recursive: true });
    root = path.join(await realpath(path.dirname(requestedRoot)), path.basename(requestedRoot));
    if (await pathHasSymlink(path.parse(root).root, root.slice(path.parse(root).root.length).split(path.sep).join('/'))) fail('runtime-store-unsafe');
    await mkdir(root, { mode: 0o700, recursive: true });
  } catch (error) { if (error instanceof RuntimeError) throw error; fail('runtime-store-unavailable'); }
  const slot = path.join(root, slotName(expect));
  try {
    await verifyAdapterPackage(await realpath(slot), expect);
    return await realpath(slot);
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof RuntimeError)) fail('runtime-store-collision');
  }
  const stage = `${slot}.stage-${process.pid}-${randomUUID()}`;
  try {
    await cp(source, stage, { recursive: true, verbatimSymlinks: true, errorOnExist: true });
    await verifyAdapterPackage(stage, expect);
    await rename(stage, slot);
    return await realpath(slot);
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    if (error.code === 'EEXIST') {
      try { await verifyAdapterPackage(await realpath(slot), expect); return await realpath(slot); } catch { fail('runtime-store-collision'); }
    }
    if (error instanceof RuntimeError) throw error;
    fail('runtime-install-failed');
  }
}

const journalPath = (root, hash) => path.join(root, journalDir, `${hash}.json`);
const lockPath = (root, hash) => path.join(root, journalDir, `${hash}.lock`);
const fileHash = (bytes) => bytes === null ? 'absent' : sha256(bytes);

async function writeDurable(file, bytes) {
  const temporary = `${file}.${process.pid}.${randomUUID()}.pending`;
  const handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, file);
  // Windows does not provide a portable fsync for directory handles. File
  // bytes are still synced above; directory-entry durability is unavailable.
  if (process.platform === 'win32') return;
  const directory = await open(path.dirname(file), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}

async function acquireRuntimeLock(root, hash) {
  const file = lockPath(root, hash);
  try {
    const handle = await open(file, 'wx', 0o600);
    await handle.writeFile(canonicalJson({ pid: process.pid, token: randomUUID() }));
    await handle.sync();
    return handle;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let owner;
    try { owner = JSON.parse(await readFile(file, 'utf8')); } catch { fail('runtime-upgrade-lock-unknown'); }
    try { process.kill(owner.pid, 0); fail('runtime-upgrade-locked'); }
    catch (probe) { if (probe.code !== 'ESRCH') throw probe; }
    await rm(file);
    return acquireRuntimeLock(root, hash);
  }
}

function sealJournal(body) {
  return canonicalJson({ ...body, journalSha256: sha256(canonicalJson(body)) });
}

function parseJournal(bytes, expectedHash) {
  let journal;
  try { journal = JSON.parse(bytes.toString('utf8')); } catch { fail('runtime-journal-invalid'); }
  const { journalSha256, ...body } = journal ?? {};
  if (!bytes.equals(Buffer.from(sealJournal(body))) || journal.format !== journalFormat || journal.planSha256 !== expectedHash ||
      journalSha256 !== sha256(canonicalJson(body)) || !['PREPARED', 'IN_PROGRESS', 'TARGET_VERIFIED', 'ROLLED_BACK'].includes(journal.phase) ||
      typeof journal.planBytes !== 'string' || sha256(Buffer.from(journal.planBytes, 'base64')) !== journal.planSha256 ||
      !Array.isArray(journal.files) || !journal.files.length || new Set(journal.files.map((item) => item.path)).size !== journal.files.length || journal.files.some((item) =>
        !safeRelativePath(item.path) || typeof item.before !== 'string' && item.before !== null || typeof item.after !== 'string' ||
        fileHash(item.before === null ? null : Buffer.from(item.before, 'base64')) !== item.beforeSha256 ||
        sha256(Buffer.from(item.after, 'base64')) !== item.afterSha256)) fail('runtime-journal-invalid');
  let plan;
  try { plan = JSON.parse(Buffer.from(journal.planBytes, 'base64').toString('utf8')); } catch { fail('runtime-journal-invalid'); }
  const planned = new Map([...(plan.create ?? []).map((item) => [item.path, { before: 'absent', after: item.sha256 }]),
    ...(plan.merge ?? []).map((item) => [item.path, { before: item.before_sha256, after: item.after_sha256 }])]);
  if (plan.mode !== 'upgrade' || plan.status !== 'ready' || plan.current?.expect !== journal.source || plan.target?.expect !== journal.target ||
      journal.files.some((item) => { const record = planned.get(item.path); return !record || record.before !== item.beforeSha256 || record.after !== item.afterSha256; })) fail('runtime-journal-invalid');
  return journal;
}

// Called by upgrade apply after it has regenerated the exact reviewed plan and
// before the first consumer byte is replaced. The record contains complete
// inverse/forward bytes, so a new process can recover without the source MCP.
export async function beginRuntimeUpgrade({ root: rootArgument, planBytes, planSha256, writes }) {
  if (sha256(planBytes) !== planSha256) fail('runtime-plan-hash-mismatch');
  const plan = JSON.parse(planBytes.toString('utf8'));
  if (plan.mode !== 'upgrade' || plan.status !== 'ready' || !plan.current?.expect || !plan.target?.expect || !Array.isArray(writes) || !writes.length) fail('runtime-plan-invalid');
  const root = await realpath(rootArgument);
  const directory = path.join(root, journalDir);
  if (await pathHasSymlink(root, journalDir)) fail('runtime-journal-unsafe');
  if ((await runtimeUpgradeState(root)).blocked) fail('runtime-recovery-required');
  await mkdir(directory, { mode: 0o700, recursive: true });
  const file = journalPath(root, planSha256);
  const lock = await acquireRuntimeLock(root, planSha256);
  try {
    if (await readFile(file).then(() => true, (error) => error.code === 'ENOENT' ? false : Promise.reject(error))) {
      const prior = parseJournal(await readFile(file), planSha256);
      if (prior.phase !== 'ROLLED_BACK') fail('runtime-recovery-required');
      for (const item of prior.files) {
        if (fileHash(await readContained(root, item.path)) !== item.beforeSha256) fail('runtime-recovery-required');
      }
      const retry = { ...prior, phase: 'IN_PROGRESS', outcome: undefined, lockOwner: { pid: process.pid, token: randomUUID() } };
      delete retry.journalSha256;
      await writeDurable(file, Buffer.from(sealJournal(retry)));
      await lock.close();
      return { root, planSha256, path: file };
    }
    const files = [];
    for (const write of writes) {
      if (!safeRelativePath(write.path) || await pathHasSymlink(root, write.path)) fail('runtime-journal-unsafe');
      const before = await readContained(root, write.path);
      files.push({ path: write.path, before: before === null ? null : before.toString('base64'), after: Buffer.from(write.content).toString('base64'),
        beforeSha256: fileHash(before), afterSha256: sha256(Buffer.from(write.content)) });
    }
    const body = { format: journalFormat, repository: root, planSha256, source: plan.current.expect, target: plan.target.expect,
      phase: 'PREPARED', lockOwner: { pid: process.pid, token: randomUUID() }, planBytes: planBytes.toString('base64'), files };
    await writeDurable(file, Buffer.from(sealJournal(body)));
    const active = { ...body, phase: 'IN_PROGRESS' };
    await writeDurable(file, Buffer.from(sealJournal(active)));
    await lock.close();
    return { root, planSha256, path: file };
  } catch (error) { await lock.close(); await rm(lockPath(root, planSha256), { force: true }); throw error; }
}

export async function finishRuntimeUpgrade({ root: rootArgument, planSha256, outcome }) {
  const root = await realpath(rootArgument);
  const file = journalPath(root, planSha256);
  const current = parseJournal(await readFile(file), planSha256);
  if (current.phase !== 'IN_PROGRESS' || !['target', 'source'].includes(outcome)) fail('runtime-journal-invalid');
  const phase = outcome === 'target' ? 'TARGET_VERIFIED' : 'ROLLED_BACK';
  const { journalSha256: _discard, ...body } = current;
  await writeDurable(file, Buffer.from(sealJournal({ ...body, phase, outcome, lockOwner: null })));
  await rm(lockPath(root, planSha256), { force: true }).catch(() => {});
}

export async function runtimeUpgradeState(rootArgument) {
  const root = await realpath(rootArgument);
  if (await pathHasSymlink(root, journalDir)) return { blocked: true, status: 'unknown' };
  let files;
  try { files = await readdir(path.join(root, journalDir)); }
  catch (error) { if (error.code === 'ENOENT') return { blocked: false, status: 'none' }; return { blocked: true, status: 'unknown' }; }
  if (files.some((name) => !/^[a-f0-9]{64}\.(?:json|lock)$/.test(name))) return { blocked: true, status: 'unknown' };
  for (const name of files) {
    if (await pathHasSymlink(root, `${journalDir}/${name}`)) return { blocked: true, status: 'unknown' };
    if (name.endsWith('.lock') && !files.includes(name.slice(0, -5) + '.json')) return { blocked: true, status: 'unknown' };
  }
  for (const name of files.filter((item) => item.endsWith('.json'))) {
    try {
      const journal = parseJournal(await readFile(path.join(root, journalDir, name)), name.slice(0, -5));
      if (journal.phase === 'IN_PROGRESS') return { blocked: true, status: 'in-progress', planSha256: journal.planSha256 };
      if (journal.phase === 'PREPARED') return { blocked: true, status: 'prepared-recovery-required', planSha256: journal.planSha256 };
    } catch { return { blocked: true, status: 'unknown' }; }
  }
  return { blocked: false, status: 'complete' };
}

// Once the selected target has constructed a source-current session guard, its
// journal records that target work may have begun. A source rollback is then
// no longer presumed safe from bytes alone.
export async function markTargetSessionStarted(rootArgument, expect) {
  const root = await realpath(rootArgument);
  if (await pathHasSymlink(root, journalDir)) return;
  let names;
  try { names = await readdir(path.join(root, journalDir)); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const name of names.filter((item) => item.endsWith('.json') && /^[a-f0-9]{64}\.json$/.test(item))) {
    const file = path.join(root, journalDir, name);
    const journal = parseJournal(await readFile(file), name.slice(0, -5));
    if (journal.phase === 'TARGET_VERIFIED' && journal.outcome === 'target' && journal.target === expect && journal.targetSessionStarted !== true) {
      const { journalSha256: _discard, ...body } = journal;
      await writeDurable(file, Buffer.from(sealJournal({ ...body, targetSessionStarted: true })));
    }
  }
}

// Explicit, hash-bound maintenance recovery. Every current path must still be
// exactly at its recorded before or after bytes; ambiguity is never guessed.
export async function recoverRuntimeUpgrade({ root: rootArgument, planSha256, outcome, packageRoot, sourcePackageRoot, env = process.env } = {}) {
  if (!/^[a-f0-9]{64}$/.test(planSha256 ?? '') || !['source', 'target'].includes(outcome)) fail('runtime-recovery-authorization-required');
  const root = await realpath(rootArgument);
  if (await pathHasSymlink(root, journalDir)) fail('runtime-journal-unsafe');
  const file = journalPath(root, planSha256);
  const lock = await acquireRuntimeLock(root, planSha256);
  try {
    let journal = parseJournal(await readFile(file), planSha256);
    if (journal.repository !== root) fail('runtime-recovery-not-required');
    if (journal.phase === 'PREPARED') {
      if (outcome !== 'source') fail('runtime-recovery-not-required');
      if (sourcePackageRoot) {
        if ((await verifyAdapterPackage(await realpath(sourcePackageRoot), journal.source))?.version !== parseExpect(journal.source).version) fail('runtime-recovery-package-mismatch');
      } else await resolveRuntime({ expect: journal.source, packageRoot, env });
      for (const item of journal.files) {
        if (await pathHasSymlink(root, item.path)) fail('runtime-recovery-unsafe-path');
        if (fileHash(await readContained(root, item.path)) !== item.beforeSha256) fail('runtime-recovery-ambiguous-bytes');
      }
      const { journalSha256: _discard, ...body } = journal;
      await writeDurable(file, Buffer.from(sealJournal({ ...body, phase: 'ROLLED_BACK', outcome: 'source', lockOwner: null })));
      return { status: 'ROLLED_BACK', planSha256 };
    }
    if (journal.phase !== 'IN_PROGRESS') {
      if (outcome === 'source' && journal.phase === 'TARGET_VERIFIED' && journal.targetSessionStarted === true) fail('runtime-source-rollback-unsafe');
      fail('runtime-recovery-not-required');
    }
    const expected = outcome === 'source' ? journal.source : journal.target;
    if (outcome === 'target') {
      if ((await verifyAdapterPackage(await realpath(packageRoot), expected))?.version !== parseExpect(expected).version || selfPin(packageRoot).expect !== expected) fail('runtime-recovery-package-mismatch');
    } else {
      if (sourcePackageRoot) {
        if ((await verifyAdapterPackage(await realpath(sourcePackageRoot), expected))?.version !== parseExpect(expected).version) fail('runtime-recovery-package-mismatch');
      } else await resolveRuntime({ expect: expected, packageRoot, env });
      const pin = JSON.parse((await readContained(root, MCP_FILE)).toString('utf8')).mcpServers?.[MCP_SERVER_NAME]?.args?.[2];
      if (pin === journal.target && journal.targetSessionStarted === true) fail('runtime-source-rollback-unsafe');
    }
    const ordered = [...journal.files].sort((a, b) => a.path === MCP_FILE ? 1 : b.path === MCP_FILE ? -1 : a.path.localeCompare(b.path));
    for (const item of ordered) {
      if (await pathHasSymlink(root, item.path)) fail('runtime-recovery-unsafe-path');
      const current = await readContained(root, item.path);
      const hash = fileHash(current);
      if (hash !== item.beforeSha256 && hash !== item.afterSha256) fail('runtime-recovery-ambiguous-bytes');
      const bytes = Buffer.from(outcome === 'source' ? item.before ?? '' : item.after, 'base64');
      const target = path.join(root, ...item.path.split('/'));
      if (outcome === 'source' && item.before === null) await rm(target, { force: true });
      else {
        await mkdir(path.dirname(target), { recursive: true });
        const stage = `${target}.recovery-${process.pid}-${randomUUID()}`;
        await writeFile(stage, bytes, { flag: 'wx', mode: 0o600 });
        if (await pathHasSymlink(root, item.path)) { await rm(stage, { force: true }); fail('runtime-recovery-unsafe-path'); }
        await rename(stage, target);
      }
      const written = await readContained(root, item.path);
      if (fileHash(written) !== (outcome === 'source' ? item.beforeSha256 : item.afterSha256)) fail('runtime-recovery-write-unverified');
    }
    journal = parseJournal(await readFile(file), planSha256);
    const { journalSha256: _discard, ...body } = journal;
    const phase = outcome === 'source' ? 'ROLLED_BACK' : 'TARGET_VERIFIED';
    await writeDurable(file, Buffer.from(sealJournal({ ...body, phase, outcome, lockOwner: null })));
    return { status: phase, planSha256 };
  } finally { await lock.close(); await rm(lockPath(root, planSha256), { force: true }); }
}

