import { parseDocument } from 'yaml';
import { mkdir, open, readdir, realpath, rename, unlink, lstat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { BOOTSTRAP_KEY, BOOTSTRAP_PATH, CUTOVER_DIR, INDEX_PATH, MCP_FILE, MCP_SERVER_NAME, POP_PATH, PROFILE_PATHS, ROLES, TARGETS, isObject, parseYamlStrict, pathHasSymlink, readContained, safeRelativePath, cutoverState } from './common.js';
import { applyUnifiedDiff, makeUnifiedDiff } from './diff.js';
import { canonicalJson, selfPin, sha256 } from './pin.js';
import { inspect, shaOrAbsent } from './inspect.js';
import { git } from './ignore.js';
import { renderBootstrap, renderProfiles, templateParams } from './render.js';

const render = (document) => document.toString({ lineWidth: 0 });

// Informational proposal retained for ordinary adoption. Only explicit cutover commits it.
export function buildCutoverProposal(facts, adds, indexBindingIds) {
  const popText = facts.popBytes.toString('utf8');
  const pop = parseDocument(popText);
  const edits = [];
  const retired = [];

  for (const role of ROLES) {
    const target = TARGETS[role];
    const implementation = { kind: target.kind, identity: target.identity, platform: target.platform };
    if (isObject(facts.pop.actor_bindings[role])) {
      pop.setIn(['actor_bindings', role, 'implementation'], pop.createNode(implementation));
      pop.setIn(['actor_bindings', role, 'capability_profiles'], pop.createNode(target.capabilities));
    } else {
      pop.setIn(['actor_bindings', role], pop.createNode({
        profile: facts.actorProfiles[role], implementation, capability_profiles: target.capabilities, status: 'active',
      }));
    }
  }
  for (const entry of facts.bootstraps) {
    if (entry.status !== 'active') continue;
    pop.setIn(['platform_bootstraps', entry.key, 'status'], 'retired');
    retired.push(entry);
  }
  pop.setIn(['platform_bootstraps', BOOTSTRAP_KEY], pop.createNode({ path: BOOTSTRAP_PATH, status: 'active' }));
  edits.push({ path: POP_PATH, base: facts.popBytes.toString('utf8'), after: render(pop) });

  for (const entry of retired) {
    if (!entry.bytes) continue;
    const document = parseDocument(entry.bytes.toString('utf8'));
    document.set('status', 'retired');
    edits.push({ path: entry.path, base: entry.bytes.toString('utf8'), after: render(document) });
  }

  const index = parseDocument(facts.indexBytes.toString('utf8'));
  const retiredCapabilities = new Set(ROLES.flatMap((role) => facts.pop.actor_bindings[role]?.capability_profiles ?? []));
  const bindings = index.get('bindings');
  if (bindings && Array.isArray(bindings.items)) {
    bindings.items.forEach((item, position) => {
      if (isObject(facts.index.bindings?.[position]) && ((facts.index.bindings[position].kind === 'capability-profile' && retiredCapabilities.has(facts.index.bindings[position].path)) ||
          retired.some((entry) => entry.path === facts.index.bindings[position].path)) && facts.index.bindings[position].required === true) {
        index.setIn(['bindings', position, 'required'], false);
      }
    });
  }
  const newBindings = [
    { id: indexBindingIds.executor, path: PROFILE_PATHS.executor, kind: 'capability-profile' },
    { id: indexBindingIds.auditor, path: PROFILE_PATHS.auditor, kind: 'capability-profile' },
    { id: indexBindingIds.bootstrap, path: BOOTSTRAP_PATH, kind: 'platform-bootstrap' },
  ];
  for (const binding of newBindings) {
    if (!index.has('bindings')) index.set('bindings', index.createNode([]));
    index.addIn(['bindings'], index.createNode({ ...binding, authority_class: 'configured', required: true }));
  }
  edits.push({ path: INDEX_PATH, base: facts.indexBytes.toString('utf8'), after: render(index) });

  return {
    atomic: false,
    logicalTransition: 'requires durable intent, startup barrier and explicit recovery across independent renames',
    authorization: 'requires consumer-governed cutover authorization; apply never writes this proposal',
    preconditions: ['every base_sha256 is current', 'runner-bound in-flight work is closed or handed off'],
    edits: edits.map((edit) => ({ path: edit.path, base_sha256: sha256(Buffer.from(edit.base, 'utf8')), diff: makeUnifiedDiff(edit.path, edit.base, edit.after) })),
    adds: Object.entries(adds).sort(([a], [b]) => (a < b ? -1 : 1)).map(([filePath, content]) => ({ path: filePath, sha256: sha256(Buffer.from(content, 'utf8')), content })),
  };
}

const FORMAT = 'dev-foundry.cutover-plan.v1';
const AUTH_FORMAT = 'dev-foundry.cutover-authorization.v1';
const IDS = { executor: 'implementation-executor-capability-claude-code-v2', auditor: 'governance-auditor-capability-claude-code-v1', bootstrap: 'platform-bootstrap-claude-code' };
const authorityWrite = (file) => safeRelativePath(file) && file.startsWith('.dev-foundry/') &&
  !/^\.dev-foundry\/(?:releases|validations|executions|repository-transactions|telemetry|prompts|execution-contracts|execution-requests|validation-requests)\//.test(file);
const fail = (code, message = code) => { throw new CutoverError(code, message); };
export class CutoverError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const adapterAt = (packageRoot) => {
  try { const pin = selfPin(packageRoot); return { version: pin.version, payloadRoot: pin.root, expect: pin.expect }; }
  catch { return fail('package-unverified'); }
};
const absolute = (root, file) => path.join(root, ...file.split('/'));

async function safeRead(root, file) {
  if (!safeRelativePath(file) || await pathHasSymlink(root, file)) fail('unsafe-path', file);
  try {
    const info = await lstat(absolute(root, file));
    if (!info.isFile()) fail('unsafe-path', file);
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const bytes = await readContained(root, file);
  if (!bytes) fail('unreadable-path', file);
  return bytes;
}
function repositoryIdentity(root) {
  const branch = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const head = git(root, ['rev-parse', '--verify', 'HEAD']);
  if (branch.status !== 0 || head.status !== 0) fail('repository-identity-unavailable');
  return { branch: branch.stdout.trim(), head: head.stdout.trim() };
}
function clean(root, files) {
  const result = git(root, ['--literal-pathspecs', 'status', '--porcelain', '--untracked-files=all', '--', ...files]);
  if (result.status !== 0 || result.stdout.trim()) fail('dirty-authority-paths');
  const ignored = git(root, ['check-ignore', '--', ...files]);
  if (ignored.status === 0) fail('ignored-authority-path', ignored.stdout.trim());
  if (ignored.status !== 1) fail('ignore-inspection-failed');
}
function targetMaterial(facts, packageRoot) {
  const params = templateParams({
    project: facts.project, prefix: facts.prefix,
    executorProfileId: facts.actorData['implementation-executor'].id,
    auditorProfileId: facts.actorData['governance-auditor'].id,
    authorProfile: facts.actorProfiles['governance-author'], custodianProfile: facts.actorProfiles['evidence-custodian'],
  });
  const adds = { ...renderProfiles(params, path.join(packageRoot, 'templates')), ...renderBootstrap(params, path.join(packageRoot, 'templates')) };
  const proposal = buildCutoverProposal(facts, adds, IDS);
  const files = [
    ...proposal.edits.map((edit) => {
      const before = edit.path === POP_PATH ? facts.popBytes : edit.path === INDEX_PATH ? facts.indexBytes : facts.bootstraps.find((item) => item.path === edit.path).bytes;
      return { path: edit.path, before: before.toString('utf8'), after: applyUnifiedDiff(before.toString('utf8'), edit.diff) };
    }),
    ...proposal.adds.map((item) => ({ path: item.path, before: null, after: item.content })),
  ].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map((item) => ({
    ...item, before_sha256: shaOrAbsent(item.before === null ? null : Buffer.from(item.before)),
    after_sha256: sha256(item.after), diff: makeUnifiedDiff(item.path, item.before ?? '', item.after),
  }));
  const target = Object.fromEntries(files.map((file) => [file.path, parseYamlStrict(Buffer.from(file.after))]));
  const pop = target[POP_PATH];
  const index = target[INDEX_PATH];
  const bootstrap = target[BOOTSTRAP_PATH];
  if (Object.values(target).some((data) => !data) || pop.schema_version !== 'dev-foundry.project-operating-profile.v2' || pop.kind !== 'project-operating-profile' ||
      pop.status !== 'active' || pop.repository?.name !== facts.project || pop.policies?.default_role !== 'governance-author' ||
      index.schema_version !== 'dev-foundry.authority-index.v2' || index.kind !== 'authority-index' || index.status !== 'active' || index.subject?.id !== facts.project ||
      bootstrap.schema_version !== 'dev-foundry.platform-bootstrap.v2' || bootstrap.kind !== 'platform-bootstrap' || bootstrap.status !== 'active' || bootstrap.platform?.id !== 'claude-code' ||
      bootstrap.repository?.expected_name !== facts.project || bootstrap.repository?.workspace_binding !== 'repository-root' ||
      bootstrap.sources?.project_operating_profile !== POP_PATH || bootstrap.sources?.authority_index !== INDEX_PATH ||
      bootstrap.actor_resolution?.mode !== 'governed-project-bindings' || bootstrap.actor_resolution?.default_role !== 'governance-author' ||
      bootstrap.actor_resolution?.fixed_profile !== null ||
      !isDeepStrictEqual(bootstrap.actor_resolution?.eligible_profiles, [facts.actorProfiles['governance-author'], facts.actorProfiles['evidence-custodian']]) ||
      Object.values(pop.platform_bootstraps).filter((entry) => entry.status === 'active').length !== 1 ||
      pop.platform_bootstraps[BOOTSTRAP_KEY]?.path !== BOOTSTRAP_PATH) fail('target-semantics-invalid');
  for (const role of ROLES) {
    const binding = pop.actor_bindings[role];
    const expected = TARGETS[role];
    if (binding.status !== 'active' || binding.profile !== facts.actorProfiles[role] ||
        !isDeepStrictEqual(binding.implementation, { kind: expected.kind, identity: expected.identity, platform: expected.platform }) ||
        !isDeepStrictEqual(binding.capability_profiles, expected.capabilities)) fail('target-semantics-invalid');
    for (const file of expected.capabilities) {
      const profile = target[file];
      if (profile.schema_version !== 'dev-foundry.capability-profile.v1' || profile.status !== 'active' || profile.limits?.repository !== facts.project ||
          profile.limits?.platform !== 'claude-code' || profile.limits?.implementation_identity !== expected.identity ||
          profile.implementation_class !== 'claude-code-project-subagent' || profile.limits?.operating_mode !== 'project_subagent' ||
          profile.limits?.governance_mcp_server !== MCP_SERVER_NAME || profile.limits?.governance_resolution !== 'resolve_governed_operation' ||
          index.bindings.filter((entry) => entry.path === file && entry.authority_class === 'configured' && entry.required === true).length !== 1) fail('target-semantics-invalid');
    }
  }
  if (index.bindings.filter((entry) => entry.path === BOOTSTRAP_PATH && entry.required === true && entry.authority_class === 'configured').length !== 1) fail('target-semantics-invalid');
  return files;
}

// Read-only. The existing role/profile choices must already be complete.
export async function createCutoverPlan({ root: argument, packageRoot }) {
  const plan = { planFormat: FORMAT, status: 'blocked', productFilesAffected: 0, source: null, target: null,
    files: [], preconditions: {}, blockers: [], atomic: false, restartRequired: true,
    observer: 'External runners may inspect read-only; no foreign active role survives the transition.' };
  try {
    const adapter = adapterAt(packageRoot);
    const facts = await inspect(argument);
    if (!facts.governed || facts.blockers.length) fail('source-authority-invalid', JSON.stringify(facts.blockers));
    const root = facts.root;
    if ((await cutoverState(root)).status !== 'none') fail('cutover-already-recorded', 'Inspect or recover the existing cutover.');
    const identity = repositoryIdentity(root);
    const { createPlan } = await import('./plan.js');
    const prepared = await createPlan({ root, adapter, templatesRoot: path.join(packageRoot, 'templates') });
    if (prepared.plan.activation?.overall !== 'prepared') fail('partial-claude-binding-state');
    if (prepared.plan.status !== 'noop') fail('managed-preparation-required', JSON.stringify(prepared.plan.blockers));
    const mcp = JSON.parse((await safeRead(root, MCP_FILE)).toString('utf8')).mcpServers?.[MCP_SERVER_NAME];
    if (mcp?.command !== 'dev-foundry-claude' || !isDeepStrictEqual(mcp.args, ['mcp', '--expect', adapter.expect])) fail('adapter-runtime-mismatch');
    const bindings = facts.pop.actor_bindings;
    if (facts.pop.operator?.kind !== 'human' || typeof facts.pop.operator?.identity !== 'string' || !facts.pop.operator.identity.trim()) fail('operator-choice-unresolved');
    if (facts.pop.policies?.default_role !== 'governance-author') fail('source-policy-choice-unresolved');
    if (Object.keys(bindings).some((role) => !ROLES.includes(role) && bindings[role]?.status === 'active')) fail('unresolved-role-choice');
    const configured = [...facts.index.routes, ...(facts.index.bindings ?? [])].filter((item) => item.authority_class === 'configured');
    const configPaths = configured.map((item) => item.path);
    const portable = (file) => file.normalize('NFC').toLowerCase();
    if (new Set(configPaths.map(portable)).size !== configPaths.length) fail('ambiguous-configured-routing');
    const active = facts.bootstraps.filter((item) => item.status === 'active');
    if (active.length !== 1 || !configPaths.includes(active[0].path) || !authorityWrite(active[0].path) ||
        active[0].data?.status !== 'active' || active[0].data?.schema_version !== 'dev-foundry.platform-bootstrap.v2' || active[0].data?.kind !== 'platform-bootstrap' ||
        typeof active[0].data?.platform?.id !== 'string' || active[0].data?.repository?.workspace_binding !== 'repository-root' ||
        active[0].data?.sources?.project_operating_profile !== POP_PATH || active[0].data?.sources?.authority_index !== INDEX_PATH ||
        active[0].data?.platform?.id === 'claude-code') fail('source-bootstrap-invalid');
    facts.actorData = {};
    const refs = new Set([POP_PATH, INDEX_PATH, MCP_FILE, facts.pop.framework.selected_manifest, facts.pop.framework.selected_authority_index,
      ...configPaths, ...Object.values(facts.actorProfiles), ...facts.bootstraps.map((item) => item.path),
      ...Object.keys(prepared.plan.preconditions)]);
    const manifest = parseYamlStrict((await safeRead(root, facts.pop.framework.selected_manifest)) ?? Buffer.alloc(0));
    if (manifest?.framework_version !== facts.pop.framework.adopted_version || manifest.canonical !== true || !Array.isArray(manifest.artifacts)) fail('framework-integrity-invalid');
    const releasePaths = new Set();
    for (const item of manifest.artifacts) {
      if (!safeRelativePath(item.path) || !item.path.startsWith(path.posix.dirname(facts.pop.framework.selected_manifest) + '/') ||
          releasePaths.has(item.path) || !/^[0-9a-f]{64}$/.test(item.sha256 ?? '')) fail('framework-integrity-invalid');
      releasePaths.add(item.path);
      if (shaOrAbsent(await safeRead(root, item.path)) !== item.sha256) fail('framework-integrity-invalid', item.path);
      refs.add(item.path);
    }
    if (!releasePaths.has(facts.pop.framework.selected_authority_index)) fail('framework-integrity-invalid');
    for (const role of ROLES) {
      const binding = bindings[role];
      if (binding?.status !== 'active' || !isObject(binding.implementation) || !binding.implementation.identity ||
          !binding.implementation.platform || binding.implementation.platform === 'claude-code' || !Array.isArray(binding.capability_profiles)) fail('source-role-incomplete', role);
      const actor = parseYamlStrict((await safeRead(root, binding.profile)) ?? Buffer.alloc(0));
      if (!releasePaths.has(binding.profile) || actor?.schema_version !== 'dev-foundry.actor-profile.v2' || actor?.status !== 'active' ||
          actor.role !== role || actor.kind !== 'actor-profile' || typeof actor.id !== 'string') fail('actor-profile-invalid', role);
      facts.actorData[role] = actor;
      for (const file of binding.capability_profiles) {
        if (!configPaths.includes(file)) fail('source-profile-not-routed', file);
        refs.add(file);
        const cap = parseYamlStrict((await safeRead(root, file)) ?? Buffer.alloc(0));
        // Foreign v1 profiles need not repeat the POP's concrete implementation.
        // Any implementation limit they do declare must agree with that binding.
        if (cap?.schema_version !== 'dev-foundry.capability-profile.v1' || cap?.status !== 'active' || cap.limits?.repository !== facts.project ||
            (cap.limits.implementation_identity !== undefined && cap.limits.implementation_identity !== binding.implementation.identity) ||
            (cap.limits.platform !== undefined && cap.limits.platform !== binding.implementation.platform)) fail('source-capability-invalid', file);
      }
    }
    for (const item of configured) {
      if (!authorityWrite(item.path)) fail('unsupported-configured-path', item.path);
      const bytes = await safeRead(root, item.path);
      if (item.required !== false && !bytes) fail('configured-authority-missing', item.path);
      if (bytes && !parseYamlStrict(bytes)) fail('configured-authority-invalid', item.path);
    }
    const files = targetMaterial(facts, packageRoot);
    for (const item of files) {
      if (!authorityWrite(item.path)) fail('unsupported-configured-path', item.path);
      refs.add(item.path);
      const bytes = await safeRead(root, item.path);
      if (shaOrAbsent(bytes) !== item.before_sha256) fail('authority-collision', item.path);
    }
    if (new Set([...refs].map(portable)).size !== refs.size) fail('authority-path-alias');
    const physicalFiles = new Set();
    for (const file of [...refs].sort()) {
      const bytes = await safeRead(root, file);
      plan.preconditions[file] = shaOrAbsent(bytes);
      if (bytes) {
        const info = await lstat(absolute(root, file));
        const identity = info.ino ? String(info.dev) + ':' + String(info.ino) : portable(await realpath(absolute(root, file)));
        if (physicalFiles.has(identity)) fail('authority-path-alias');
        physicalFiles.add(identity);
      }
    }
    clean(root, [...refs]);
    plan.source = { project: facts.project, idPrefix: facts.prefix, ...identity, actorBindings: bindings,
      activeBootstrap: { key: active[0].key, path: active[0].path, data: active[0].data }, adapterSelection: adapter.expect };
    plan.target = { adapter, actorBindings: Object.fromEntries(ROLES.map((role) => [role, {
      ...bindings[role], profile: facts.actorProfiles[role], implementation: { kind: TARGETS[role].kind, identity: TARGETS[role].identity, platform: TARGETS[role].platform },
      capability_profiles: TARGETS[role].capabilities, status: 'active',
    }])), bootstrap: { key: BOOTSTRAP_KEY, path: BOOTSTRAP_PATH } };
    plan.files = files;
    plan.status = 'ready';
  } catch (error) {
    plan.blockers.push({ code: error.code ?? 'cutover-plan-invalid', message: error.message });
  }
  const bytes = Buffer.from(canonicalJson(plan));
  return { plan, bytes, hash: sha256(bytes) };
}

function parsePlan(bytes, hash) {
  if (sha256(bytes) !== hash) fail('plan-hash-mismatch');
  let plan;
  try { plan = JSON.parse(bytes.toString('utf8')); } catch { fail('plan-invalid'); }
  if (plan.planFormat !== FORMAT || plan.status !== 'ready' || !Buffer.from(canonicalJson(plan)).equals(bytes)) fail('plan-invalid');
  return plan;
}
async function authorizationFor(root, plan, hash, authorization) {
  const required = { format: AUTH_FORMAT, project: plan.source.project, planSha256: hash,
    operator: parseYamlStrict(Buffer.from(plan.files.find((item) => item.path === POP_PATH).before))?.operator?.identity,
    sourceHead: plan.source.head, sourceBranch: plan.source.branch, targetExpect: plan.target.adapter.expect,
    actorBindings: plan.target.actorBindings, bootstrap: plan.target.bootstrap,
    allowedPaths: plan.files.map((item) => item.path), operatorApproved: true, governedApproval: true, decisionsResolved: true };
  if (!isObject(authorization) || Object.entries(required).some(([key, value]) => value === undefined || !isDeepStrictEqual(authorization[key], value)) ||
      !['closed', 'handed-off'].includes(authorization.sourceWorkDisposition)) fail('consumer-authorization-required');
  const index = parseYamlStrict(Buffer.from(plan.files.find((item) => item.path === INDEX_PATH).before));
  const checkEvidence = async (reference) => {
    if (!isObject(reference) || !/^[0-9a-f]{64}$/.test(reference.sha256 ?? '')) fail('authorization-evidence-invalid');
    const bytes = await safeRead(root, reference.path);
    if (!bytes || sha256(bytes) !== reference.sha256) fail('authorization-evidence-stale');
    return bytes;
  };
  const task = await checkEvidence(authorization.task);
  if (!(index.routes ?? []).some((item) => item.path === authorization.task.path && item.authority_class === 'task')) fail('authorization-task-unrouted');
  const document = parseDocument(task.toString('utf8').split(/^---\s*$/m)[1] ?? '');
  const metadata = document.toJS();
  if (document.errors.length || metadata?.artifact?.type !== 'TSK' || metadata.artifact.status !== 'IN_PROGRESS' ||
      metadata.lifecycle?.phase !== 'in-progress') fail('authorization-task-ineligible');
  if (authorization.validation?.status !== 'PASS') fail('cutover-validation-required');
  const evidenceStatus = (bytes) => {
    let data;
    try { data = JSON.parse(bytes.toString('utf8')); } catch {
      const text = bytes.toString('utf8');
      data = parseYamlStrict(Buffer.from(text.startsWith('---') ? text.split(/^---\s*$/m)[1] ?? '' : text));
    }
    return data?.status ?? data?.artifact?.status;
  };
  if (evidenceStatus(await checkEvidence(authorization.validation)) !== 'PASS') fail('cutover-validation-required');
  if (!['PASS', 'not-required'].includes(authorization.audit?.status)) fail('cutover-audit-unresolved');
  if (authorization.audit.status === 'PASS') {
    if (evidenceStatus(await checkEvidence(authorization.audit)) !== 'PASS') fail('cutover-audit-unresolved');
  } else if (typeof authorization.audit.reason !== 'string' || !authorization.audit.reason.trim()) fail('cutover-audit-unresolved');
}

// File contents and directory entries are flushed separately. Windows does not
// expose directory fsync on every filesystem; file flush remains mandatory.
async function syncDirectory(directory) {
  let handle;
  try { handle = await open(directory, 'r'); await handle.sync(); }
  catch (error) {
    if (process.platform !== 'win32' || !['EINVAL', 'EPERM', 'EISDIR', 'EACCES', 'ENOTSUP'].includes(error.code)) throw error;
  } finally { await handle?.close(); }
}
async function durableWrite(root, file, content) {
  if (!safeRelativePath(file) || await pathHasSymlink(root, file)) fail('unsafe-path', file);
  const destination = absolute(root, file);
  await mkdir(path.dirname(destination), { recursive: true });
  const handle = await open(destination, 'wx', 0o600);
  try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
  await syncDirectory(path.dirname(destination));
}
async function durableMaterial(root, file, content) {
  const bytes = Buffer.from(content);
  const existing = await safeRead(root, file);
  if (existing) { if (!existing.equals(bytes)) fail('transaction-record-modified', file); return; }
  // Publish each journal record only after a complete file flush. A torn pending
  // record is inert; retain its exact bytes before rebuilding from verified intent.
  const pending = file + '.pending';
  const unfinished = await safeRead(root, pending);
  if (unfinished && !unfinished.equals(bytes)) {
    const archive = CUTOVER_DIR + '/record-fragment-' + sha256(unfinished) + '.bytes';
    const saved = await safeRead(root, archive);
    if (saved && !saved.equals(unfinished)) fail('transaction-record-modified');
    if (saved) await unlink(absolute(root, pending));
    else await rename(absolute(root, pending), absolute(root, archive));
    await syncDirectory(absolute(root, CUTOVER_DIR));
  }
  if (!unfinished?.equals(bytes)) await durableWrite(root, pending, bytes);
  await rename(absolute(root, pending), absolute(root, file));
  await syncDirectory(path.dirname(absolute(root, file)));
}
async function immutableRecord(root, file, value) {
  await durableMaterial(root, file, canonicalJson(value));
}
const step = async (fault, phase) => { if (fault) await fault(phase); };

// Owner identity lives in the lock name, avoiding torn owner-document writes.
// Dead local process locks are retained as evidence, never recursively removed.
async function withLock(root, action) {
  const directory = CUTOVER_DIR + '/locks';
  if (await pathHasSymlink(root, directory)) fail('unsafe-path');
  await mkdir(absolute(root, directory), { recursive: true });
  const host = sha256(os.hostname()).slice(0, 16);
  const name = host + '-' + process.pid + '-' + randomUUID() + '.lock';
  const file = directory + '/' + name;
  await durableWrite(root, file, '');
  try {
    for (const other of await readdir(absolute(root, directory))) {
      if (other === name) continue;
      const match = /^([0-9a-f]{16})-([1-9][0-9]*)-([0-9a-f-]{36})\.lock$/.exec(other);
      if (!match || match[1] !== host || (await safeRead(root, directory + '/' + other))?.length !== 0) fail('cutover-locked');
      let alive = true;
      try { process.kill(Number(match[2]), 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
      if (alive) fail('cutover-locked');
    }
    return await action();
  } finally { await unlink(absolute(root, file)); await syncDirectory(absolute(root, directory)); }
}
function barrierOf(plan) {
  const doc = parseDocument(plan.files.find((item) => item.path === POP_PATH).before);
  doc.set('status', 'cutover-in-progress');
  return render(doc);
}

async function validateJournal(root, intent, hash, packageRoot) {
  if (intent?.format !== 'dev-foundry.cutover-intent.v1' || intent.planSha256 !== hash) fail('unknown-cutover-state');
  const plan = parsePlan(Buffer.from(canonicalJson(intent.plan)), hash);
  if (!isDeepStrictEqual(adapterAt(packageRoot), plan.target.adapter)) fail('adapter-runtime-mismatch');
  if (!isDeepStrictEqual(repositoryIdentity(root), { branch: plan.source.branch, head: plan.source.head })) fail('source-head-stale');
  const pop = parseYamlStrict(Buffer.from(plan.files.find((item) => item.path === POP_PATH).before));
  const index = parseYamlStrict(Buffer.from(plan.files.find((item) => item.path === INDEX_PATH).before));
  const actorData = {};
  for (const role of ROLES) actorData[role] = parseYamlStrict((await safeRead(root, pop.actor_bindings[role].profile)) ?? Buffer.alloc(0));
  const old = plan.files.find((item) => item.path === plan.source.activeBootstrap.path);
  const facts = { pop, index, popBytes: Buffer.from(plan.files.find((item) => item.path === POP_PATH).before),
    indexBytes: Buffer.from(plan.files.find((item) => item.path === INDEX_PATH).before), project: plan.source.project, prefix: plan.source.idPrefix,
    actorProfiles: Object.fromEntries(ROLES.map((role) => [role, pop.actor_bindings[role].profile])), actorData,
    bootstraps: [{ ...plan.source.activeBootstrap, status: 'active', bytes: Buffer.from(old.before) }] };
  if (!isDeepStrictEqual(targetMaterial(facts, packageRoot), plan.files)) fail('target-semantics-invalid');
  await authorizationFor(root, plan, hash, intent.authorization);
  const committed = await safeRead(root, CUTOVER_DIR + '/commit.json');
  if (committed && !committed.equals(Buffer.from(canonicalJson({ planSha256: hash, restartRequired: true })))) fail('transaction-record-modified');
  const allowedNames = new Set(['locks', 'intent.json', 'prepared.json', 'commit.json', 'resolution.json', 'done.json']);
  for (let i = 0; i < plan.files.length; i += 1) {
    allowedNames.add('backup-' + i + '.json');
    allowedNames.add('target-' + i + '.json');
    const item = plan.files[i];
    const known = [item.before_sha256, item.after_sha256, ...(item.path === POP_PATH ? [sha256(barrierOf(plan))] : [])].filter((value) => value !== 'absent');
    for (const value of known) {
      allowedNames.add('install-' + i + '-' + value + '.bytes');
      allowedNames.add('displaced-' + i + '-' + value + '.bytes');
    }
  }
  for (const name of [...allowedNames]) if (name !== 'locks') allowedNames.add(name + '.pending');
  for (const name of await readdir(absolute(root, CUTOVER_DIR))) {
    if (allowedNames.has(name)) continue;
    const fragment = /^record-fragment-([0-9a-f]{64})\.bytes$/.exec(name);
    if (!fragment || sha256((await safeRead(root, CUTOVER_DIR + '/' + name)) ?? '') !== fragment[1]) fail('unknown-cutover-state', name);
  }
  for (const [file, expected] of Object.entries(plan.preconditions)) {
    const item = plan.files.find((entry) => entry.path === file);
    const observed = shaOrAbsent(await safeRead(root, file));
    const allowed = item ? [item.before_sha256, item.after_sha256, ...(file === POP_PATH ? [sha256(barrierOf(plan))] : [])] : [expected];
    if (allowed.includes(observed)) continue;
    // A durable commit plus an exact retained displacement proves a rename gap.
    if (item && observed === 'absent' && committed) {
      const slot = plan.files.indexOf(item);
      let proved = false;
      for (const value of allowed.filter((value) => value !== 'absent')) {
        const bytes = await safeRead(root, CUTOVER_DIR + '/displaced-' + slot + '-' + value + '.bytes');
        if (bytes && sha256(bytes) === value) proved = true;
      }
      if (proved) continue;
    }
    fail('authority-modified', file);
  }
  return plan;
}
async function assertSource(root, plan) {
  if (!isDeepStrictEqual(repositoryIdentity(root), { branch: plan.source.branch, head: plan.source.head })) fail('source-head-stale');
  for (const [file, hash] of Object.entries(plan.preconditions)) {
    if (shaOrAbsent(await safeRead(root, file)) !== hash) fail('plan-stale', file);
  }
  clean(root, Object.keys(plan.preconditions));
}
async function stageAll(root, plan, fault) {
  for (let i = 0; i < plan.files.length; i += 1) {
    const item = plan.files[i];
    await immutableRecord(root, CUTOVER_DIR + '/backup-' + i + '.json', { path: item.path, content: item.before, sha256: item.before_sha256 });
    await immutableRecord(root, CUTOVER_DIR + '/target-' + i + '.json', { path: item.path, content: item.after, sha256: item.after_sha256 });
    await step(fault, 'stage:' + i);
  }
  await immutableRecord(root, CUTOVER_DIR + '/prepared.json', { planSha256: sha256(canonicalJson(plan)) });
  await step(fault, 'prepared');
}
async function loadIntent(root) {
  try { return JSON.parse((await safeRead(root, CUTOVER_DIR + '/intent.json')).toString('utf8')); }
  catch (error) { if (error instanceof CutoverError) throw error; fail('unknown-cutover-state'); }
}

// Authorized preparation writes runtime data only; source authority stays complete.
export async function prepareCutover({ root: argument, packageRoot, planBytes, planSha256, authorization, fault }) {
  const root = await realpath(path.resolve(argument));
  const plan = parsePlan(planBytes, planSha256);
  await authorizationFor(root, plan, planSha256, authorization);
  if ((await cutoverState(root)).status === 'none') {
    const current = await createCutoverPlan({ root, packageRoot });
    if (!current.bytes.equals(planBytes)) fail('plan-stale');
    await mkdir(absolute(root, CUTOVER_DIR));
    await syncDirectory(root);
  } else if (await pathHasSymlink(root, CUTOVER_DIR)) fail('unsafe-path');
  return withLock(root, async () => {
    const existing = await safeRead(root, CUTOVER_DIR + '/intent.json');
    if (!existing) {
      // The directory-creation crash gap can restart only with exact source
      // bytes and no undocumented transaction data.
      if ((await readdir(absolute(root, CUTOVER_DIR))).some((file) => file !== 'locks' && file !== 'intent.json.pending')) fail('unknown-cutover-state');
      await assertSource(root, plan);
      await immutableRecord(root, CUTOVER_DIR + '/intent.json', { format: 'dev-foundry.cutover-intent.v1', planSha256, plan, authorization });
    }
    const intent = await loadIntent(root);
    if (!isDeepStrictEqual(intent.authorization, authorization)) fail('consumer-authorization-required');
    await validateJournal(root, intent, planSha256, packageRoot);
    if (await safeRead(root, CUTOVER_DIR + '/commit.json')) fail('cutover-in-flight', 'Use explicit recovery.');
    await assertSource(root, plan);
    await step(fault, 'intent');
    await stageAll(root, plan, fault);
    return { status: 'prepared', planSha256, productFilesAffected: 0, nextAction: 'dev-foundry-claude cutover commit' };
  });
}

// Two renames avoid relying on Windows replacing an existing/open destination.
// Each gap is protected by the inactive POP. Exact displaced bytes are retained.
async function replaceAuthority(root, plan, item, content, fault, label) {
  const expected = content === null ? 'absent' : sha256(content);
  const observed = shaOrAbsent(await safeRead(root, item.path));
  if (observed === expected) return;
  const slot = plan.files.indexOf(item);
  const temporary = CUTOVER_DIR + '/install-' + slot + '-' + expected + '.bytes';
  const known = [item.before_sha256, item.after_sha256, ...(item.path === POP_PATH ? [sha256(barrierOf(plan))] : [])];
  if (observed !== 'absent' && !known.includes(observed)) fail('authority-modified');
  if (content !== null) {
    const pending = await safeRead(root, temporary);
    if (pending && sha256(pending) !== expected) fail('unexpected-install-state');
    if (!pending) await durableMaterial(root, temporary, content);
    await step(fault, label + ':staged:' + slot);
  }
  if (observed !== 'absent') {
    const archive = CUTOVER_DIR + '/displaced-' + slot + '-' + observed + '.bytes';
    const saved = await safeRead(root, archive);
    if (saved) {
      if (sha256(saved) !== observed) fail('unknown-displaced-state');
      await unlink(absolute(root, item.path));
    } else await rename(absolute(root, item.path), absolute(root, archive));
    await syncDirectory(path.dirname(absolute(root, item.path)));
    await syncDirectory(absolute(root, CUTOVER_DIR));
    await step(fault, label + ':remove:' + slot);
  }
  if (content !== null) {
    if (await pathHasSymlink(root, item.path)) fail('unsafe-path');
    await mkdir(path.dirname(absolute(root, item.path)), { recursive: true });
    await rename(absolute(root, temporary), absolute(root, item.path));
    await syncDirectory(path.dirname(absolute(root, item.path)));
    await syncDirectory(absolute(root, CUTOVER_DIR));
  }
  await step(fault, label + ':install:' + slot);
}
async function transition(root, plan, outcome, fault, packageRoot) {
  if (outcome === 'source') {
    const completeSource = (await Promise.all(plan.files.map(async (item) => shaOrAbsent(await safeRead(root, item.path)) === item.before_sha256))).every(Boolean);
    if (completeSource) {
      await immutableRecord(root, CUTOVER_DIR + '/done.json', { planSha256: sha256(canonicalJson(plan)), outcome });
      await step(fault, 'done');
      return { status: 'rolled-back', restartRequired: true, productFilesAffected: 0, nextAction: 'dev-foundry-claude help cutover' };
    }
  }
  const pop = plan.files.find((item) => item.path === POP_PATH);
  await replaceAuthority(root, plan, pop, barrierOf(plan), fault, 'barrier');
  await step(fault, 'barrier');
  for (const item of plan.files.filter((entry) => entry.path !== POP_PATH)) {
    await replaceAuthority(root, plan, item, outcome === 'target' ? item.after : item.before, fault, outcome);
  }
  await step(fault, 'authority-set');
  for (const item of plan.files.filter((entry) => entry.path !== POP_PATH)) {
    if (shaOrAbsent(await safeRead(root, item.path)) !== (outcome === 'target' ? item.after_sha256 : item.before_sha256)) fail('transition-incomplete');
  }
  // Reobserve package, evidence, branch/HEAD and every preserved authority input
  // after promotion, while the POP still blocks all active governed consumers.
  await validateJournal(root, await loadIntent(root), sha256(canonicalJson(plan)), packageRoot);
  // POP is always last: a valid active POP observes a complete source or target.
  await replaceAuthority(root, plan, pop, outcome === 'target' ? pop.after : pop.before, fault, outcome);
  await step(fault, 'pop-active');
  for (const item of plan.files) {
    if (shaOrAbsent(await safeRead(root, item.path)) !== (outcome === 'target' ? item.after_sha256 : item.before_sha256)) fail('transition-incomplete');
  }
  await immutableRecord(root, CUTOVER_DIR + '/done.json', { planSha256: sha256(canonicalJson(plan)), outcome });
  await step(fault, 'done');
  return { status: outcome === 'target' ? 'complete' : 'rolled-back', restartRequired: true, productFilesAffected: 0, nextAction: 'dev-foundry-claude start' };
}

export async function commitCutover({ root: argument, packageRoot, planSha256, authorization, fault }) {
  const root = await realpath(path.resolve(argument));
  // Missing approval must not even create a lock file.
  const observed = await loadIntent(root);
  await authorizationFor(root, observed.plan, planSha256, authorization);
  return withLock(root, async () => {
    const intent = await loadIntent(root);
    const plan = await validateJournal(root, intent, planSha256, packageRoot);
    if (!isDeepStrictEqual(intent.authorization, authorization)) fail('consumer-authorization-required');
    if (await safeRead(root, CUTOVER_DIR + '/commit.json')) fail('cutover-in-flight', 'Use explicit recovery.');
    await assertSource(root, plan);
    await stageAll(root, plan);
    await step(fault, 'verified');
    await assertSource(root, plan);
    if (!isDeepStrictEqual(adapterAt(packageRoot), plan.target.adapter)) fail('adapter-runtime-mismatch');
    await immutableRecord(root, CUTOVER_DIR + '/commit.json', { planSha256, restartRequired: true });
    await step(fault, 'commit-intent');
    return transition(root, plan, 'target', fault, packageRoot);
  });
}
export async function recoverCutover({ root: argument, packageRoot, planSha256, authorization, outcome, fault }) {
  if (!['source', 'target'].includes(outcome)) fail('recovery-choice-required');
  const root = await realpath(path.resolve(argument));
  const observed = await loadIntent(root);
  await authorizationFor(root, observed.plan, planSha256, authorization);
  return withLock(root, async () => {
    const intent = await loadIntent(root);
    const plan = await validateJournal(root, intent, planSha256, packageRoot);
    if (!isDeepStrictEqual(intent.authorization, authorization)) fail('consumer-authorization-required');
    const doneBytes = await safeRead(root, CUTOVER_DIR + '/done.json');
    if (doneBytes) {
      const done = JSON.parse(doneBytes);
      if (done.planSha256 !== planSha256 || done.outcome !== outcome) fail('recovery-already-settled');
      for (const item of plan.files) if (shaOrAbsent(await safeRead(root, item.path)) !== (outcome === 'target' ? item.after_sha256 : item.before_sha256)) fail('authority-modified');
      return { status: outcome === 'target' ? 'complete' : 'rolled-back', restartRequired: true, nextAction: 'dev-foundry-claude start' };
    }
    await stageAll(root, plan); // corrupted stage is never ignored or discarded
    await immutableRecord(root, CUTOVER_DIR + '/resolution.json', { planSha256, outcome });
    await immutableRecord(root, CUTOVER_DIR + '/commit.json', { planSha256, restartRequired: true });
    await step(fault, 'recovery-intent');
    return transition(root, plan, outcome, fault, packageRoot);
  });
}
export async function diagnoseCutover({ root: argument, packageRoot }) {
  const root = await realpath(path.resolve(argument));
  const state = await cutoverState(root);
  if (state.status !== 'none' && state.status !== 'unknown' && packageRoot) {
    try {
      const intent = await loadIntent(root);
      const plan = await validateJournal(root, intent, state.planSha256, packageRoot);
      for (let i = 0; i < plan.files.length; i += 1) {
        const item = plan.files[i];
        for (const [name, content, hash] of [['backup', item.before, item.before_sha256], ['target', item.after, item.after_sha256]]) {
          const file = CUTOVER_DIR + '/' + name + '-' + i + '.json';
          const bytes = await safeRead(root, file);
          if (bytes && !bytes.equals(Buffer.from(canonicalJson({ path: item.path, content, sha256: hash })))) fail('staging-modified');
        }
      }
    } catch (error) { state.blocked = true; state.code = error.code ?? 'unknown-cutover-state'; }
  }
  return { ...state, readOnly: true, productFilesAffected: 0,
    nextAction: state.blocked ? 'dev-foundry-claude cutover recover --outcome source|target' :
      state.status === 'prepared' ? 'dev-foundry-claude cutover commit' :
      state.status === 'none' ? 'dev-foundry-claude cutover plan' : 'dev-foundry-claude start' };
}
