import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { AGENT_PATHS, BOOTSTRAP_PATH, CLAUDE_MD, INDEX_PATH, MCP_FILE, MCP_SERVER_NAME, POP_PATH, PROFILE_PATHS, ROLES, parseYamlStrict, safeRelativePath } from '../adopt/common.js';
import { canonicalJson, sha256 } from '../adopt/pin.js';
import { git } from '../adopt/ignore.js';
import { installedRuntime } from './store.js';
import { resolveConsumer, safeAbsolute, refuse } from './identity.js';

export const hashBytes = bytes => bytes === null ? 'absent' : sha256(bytes);
export const ownedPath = file => safeRelativePath(file) && [POP_PATH, INDEX_PATH, BOOTSTRAP_PATH, ...Object.values(PROFILE_PATHS), MCP_FILE, CLAUDE_MD, ...Object.values(AGENT_PATHS)].includes(file);
export function readSafe(root, file) {
  if (!safeRelativePath(file)) refuse('unsafe-path');
  const full = safeAbsolute(path.join(safeAbsolute(root), file), { missing: true });
  try {
    const info = lstatSync(full);
    if (!info.isFile() || info.nlink !== 1) refuse('unsafe-file');
    return readFileSync(full);
  } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
export function repository(root) {
  const run = args => { const r = git(root, args); if (r.status !== 0) refuse('repository-unavailable'); return r.stdout.trim(); };
  return { root: safeAbsolute(root), branch: run(['symbolic-ref', '--quiet', '--short', 'HEAD']), head: run(['rev-parse', '--verify', 'HEAD']) };
}
export function cleanPaths(root, files) {
  const r = git(root, ['--literal-pathspecs', 'status', '--porcelain', '--untracked-files=all', '--', ...files]);
  if (r.status !== 0 || r.stdout.trim()) refuse('dirty-touched-path');
  if (git(root, ['check-ignore', '--no-index', '--', ...files]).status !== 1) refuse('ignored-authority');
}
export function preservedFingerprint(root, files) {
  const excluded = files.map(f => `:(literal,exclude)${f}`);
  const diff = git(root, ['diff', 'HEAD', '--binary', '--', '.', ...excluded]);
  const status = git(root, ['status', '--porcelain', '--untracked-files=all', '--', '.', ...excluded]);
  if (diff.status || status.status) refuse('repository-unavailable');
  // Hash untracked bytes too: a pathname alone cannot prove rollback safety.
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z', '--', '.', ...excluded]);
  if (untracked.status) refuse('repository-unavailable');
  return sha256(canonicalJson({ diff: diff.stdout, status: status.stdout,
    untracked: untracked.stdout.split('\0').filter(Boolean).map(f => [f, hashBytes(readSafe(root, f))]) }));
}

// Mechanical consistency of the configured runtime, not semantic authorization
// or an alternate operation/role resolver. The existing MCP remains authoritative.
export function authoritySnapshot(root, overlay = {}) {
  const bytes = {}, data = {};
  const load = file => {
    if (!safeRelativePath(file)) refuse('unknown-authority');
    const value = Object.hasOwn(overlay, file) ? Buffer.from(overlay[file]) : readSafe(root, file);
    if (value === null) refuse('missing-authority');
    bytes[file] = value.toString('utf8');
    const parsed = parseYamlStrict(value);
    if (!parsed) refuse('ambiguous-authority');
    data[file] = parsed;
    return parsed;
  };
  const pop = load(POP_PATH), index = load(INDEX_PATH);
  if (pop.schema_version !== 'dev-foundry.project-operating-profile.v2' || pop.kind !== 'project-operating-profile' || pop.status !== 'active' ||
      index.schema_version !== 'dev-foundry.authority-index.v2' || index.kind !== 'authority-index' || index.status !== 'active' ||
      !pop.repository?.name || index.subject?.id !== pop.repository.name || pop.repository.authority_index !== INDEX_PATH ||
      pop.framework?.adoption_status !== 'active' || !pop.operator?.identity || pop.policies?.default_role !== 'governance-author') refuse('inconsistent-authority');
  const f = pop.framework, prefix = `.dev-foundry/releases/${f.adopted_version}/`;
  if (f.adopted_version !== '2.1.0' || f.selected_manifest !== prefix + 'release-integrity-manifest.yaml' ||
      f.selected_authority_index !== prefix + 'authority-index.yaml' || index.subject.base_version !== f.adopted_version) refuse('framework-version-mismatch');
  const manifest = load(f.selected_manifest), frameworkIndex = load(f.selected_authority_index);
  if (manifest.framework_version !== f.adopted_version || manifest.canonical !== true || manifest.kind !== 'release-integrity-manifest' ||
      frameworkIndex.subject?.version !== f.adopted_version || !Array.isArray(manifest.artifacts) || !manifest.artifacts.length) refuse('framework-invalid');
  const seen = new Set();
  for (const artifact of manifest.artifacts) {
    if (!safeRelativePath(artifact.path) || !artifact.path.startsWith(prefix) || seen.has(artifact.path)) refuse('framework-invalid');
    seen.add(artifact.path);
    const value = readSafe(root, artifact.path);
    if (hashBytes(value) !== artifact.sha256) refuse('framework-integrity');
    bytes[artifact.path] = value.toString('utf8');
  }
  if (!seen.has(f.selected_authority_index)) refuse('framework-invalid');
  const routes = [...(index.routes ?? []), ...(index.bindings ?? [])];
  const ids = new Set();
  for (const route of routes) {
    if (!route.id || ids.has(route.id) || !safeRelativePath(route.path)) refuse('inconsistent-index');
    ids.add(route.id);
    if (route.required === true && !readSafe(root, route.path) && !Object.hasOwn(overlay, route.path)) refuse('missing-binding');
  }
  if (!routes.some(r => r.path === f.selected_authority_index)) refuse('framework-route-missing');
  for (const role of ROLES) {
    const binding = pop.actor_bindings?.[role];
    if (binding?.status !== 'active' || !binding.profile?.startsWith(prefix) || !Array.isArray(binding.capability_profiles) ||
        !binding.implementation?.identity || !binding.implementation?.kind || binding.implementation.platform !== 'claude-code') refuse('active-binding-invalid');
    const profile = load(binding.profile);
    if (profile.kind !== 'actor-profile' || profile.status !== 'active' || profile.role !== role || !seen.has(binding.profile)) refuse('actor-profile-invalid');
    for (const file of binding.capability_profiles) {
      const capability = load(file);
      if (capability.schema_version !== 'dev-foundry.capability-profile.v1' || capability.status !== 'active' || !capability.implementation_class ||
          capability.limits?.implementation_identity !== binding.implementation.identity || capability.limits?.repository !== pop.repository.name ||
          capability.limits?.platform !== binding.implementation.platform ||
          !routes.some(r => r.path === file && r.required === true)) refuse('capability-binding-invalid');
    }
  }
  const bootstraps = Object.values(pop.platform_bootstraps ?? {}).filter(b => b.status === 'active');
  if (bootstraps.length !== 1) refuse('bootstrap-ambiguous');
  const bootstrap = load(bootstraps[0].path);
  if (bootstrap.kind !== 'platform-bootstrap' || bootstrap.status !== 'active' || bootstrap.platform?.id !== 'claude-code' ||
      bootstrap.repository?.expected_name !== pop.repository.name || bootstrap.repository?.workspace_binding !== 'repository-root' ||
      bootstrap.sources?.project_operating_profile !== POP_PATH || bootstrap.sources?.authority_index !== INDEX_PATH ||
      bootstrap.actor_resolution?.mode !== 'governed-project-bindings' || bootstrap.actor_resolution?.default_role !== pop.policies.default_role ||
      !routes.some(r => r.path === bootstraps[0].path && r.required === true)) refuse('bootstrap-invalid');
  return { project: pop.repository.name, operator: pop.operator.identity, framework: f,
    fingerprint: sha256(canonicalJson(bytes)), bytes };
}

export function buildRuntimePlan(input) { return constructPlan(input, false); }
function constructPlan(input, allowJournal) {
  const { root, storeRoot, sourcePin, targetPin, proposal, choices, gates, framework } = input;
  const current = resolveConsumer(root);
  if (current.repositoryRoot !== root || current.expect !== sourcePin || sourcePin === targetPin) refuse('source-pin-mismatch');
  for (const name of ['.dfc-cutover', '.dfc-runtime-upgrade']) {
    if (allowJournal && name === '.dfc-runtime-upgrade') continue;
    try { lstatSync(path.join(root, name)); refuse('existing-transaction'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  const source = installedRuntime(storeRoot, sourcePin), target = installedRuntime(storeRoot, targetPin);
  const releaseEvidence = pin => JSON.parse(readFileSync(path.join(path.dirname(pin.packageRoot), 'stage.json'))).attestation;
  const attestation = releaseEvidence(target);
  if (attestation.transition.source !== sourcePin || attestation.transition.target !== targetPin) refuse('unsupported-transition');
  const recipeBytes = readSafe(target.packageRoot, 'migrations/runtime.json');
  let recipe;
  try { recipe = recipeBytes && JSON.parse(recipeBytes); } catch { refuse('unsupported-recipe'); }
  if (canonicalJson(recipe) !== canonicalJson(recipeBytes && parseYamlStrict(recipeBytes))) refuse('unsupported-recipe');
  if (recipe?.format !== 'dev-foundry.runtime-migration.v1' || recipe.targetVersion !== target.version ||
      !recipe.sources?.includes(sourcePin) || recipe.frameworkVersion !== '2.1.0' || recipe.restartRequired !== true ||
      typeof recipe.rollbackSafe !== 'boolean' || !Array.isArray(recipe.paths) || !Array.isArray(recipe.choices) ||
      !Array.isArray(recipe.gates) || !recipe.gates.includes('validation') || !['required', 'not-required'].includes(recipe.audit)) refuse('unsupported-recipe');
  const legacyMaterial = readSafe(target.packageRoot, 'migrations/release.json');
  if (legacyMaterial) {
    let declared;
    try { declared = JSON.parse(legacyMaterial); } catch { refuse('conflicting-migration-material'); }
    if (declared.frameworkVersion !== recipe.frameworkVersion || declared.targetVersion !== recipe.targetVersion ||
        declared.selfUpdate?.mandatoryRestart !== true) refuse('conflicting-migration-material');
  }
  if (new Set(recipe.choices.map(c => c.id)).size !== recipe.choices.length || recipe.choices.some(c =>
      typeof c.id !== 'string' || !c.id.trim() || !Array.isArray(c.options) || !c.options.length ||
      c.options.some(o => typeof o !== 'string' || !o.trim())) || new Set(recipe.gates).size !== recipe.gates.length ||
      recipe.gates.some(g => typeof g !== 'string' || !g.trim())) refuse('unsupported-recipe');
  const authority = authoritySnapshot(root);
  const sourcePop = parseYamlStrict(Buffer.from(authority.bytes[POP_PATH]));
  if (!Array.isArray(sourcePop.policies.audit_triggers) ||
      (sourcePop.policies.audit_triggers.length > 0 && recipe.audit !== 'required')) refuse('audit-requirement-unresolved');
  if (canonicalJson(framework) !== canonicalJson(authority.framework)) refuse('framework-version-mismatch');
  if (proposal?.kind !== 'source-governed-claude' || proposal.sourcePin !== sourcePin || proposal.sourceAuthority !== authority.fingerprint ||
      !proposal.evidence?.trim() || !proposal.sourceSessionId?.trim()) refuse('source-proposal-unverified');
  const recipePaths = recipe.paths.map(p => p.path);
  if (recipePaths.length > 32 || new Set(recipePaths.map(p => p.toLowerCase())).size !== recipePaths.length ||
      recipe.paths.some(p => !ownedPath(p.path) || p.owner !== (p.path === MCP_FILE ? 'pin' : p.path.startsWith('.dev-foundry/') ? 'configured' : 'managed')) || !recipePaths.includes(MCP_FILE)) refuse('unknown-owned-path');
  if (!Array.isArray(input.files) || !input.files.length || new Set(input.files.map(f => f.path)).size !== input.files.length) refuse('invalid-files');
  const files = input.files.map(file => {
    const owner = recipe.paths.find(p => p.path === file.path);
    if (!owner || owner.owner !== file.owner || !ownedPath(file.path) || typeof file.after !== 'string') refuse('unknown-owned-path');
    const before = readSafe(root, file.path);
    if (before !== null && !Buffer.from(before.toString('utf8')).equals(before)) refuse('non-utf8-source');
    if (hashBytes(before) !== file.beforeSha256 || sha256(file.after) !== file.afterSha256) refuse('file-hash-mismatch');
    return { ...file, before: before === null ? null : before.toString('utf8') };
  }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
  if (!files.some(f => f.path === MCP_FILE)) refuse('pin-switch-missing');
  cleanPaths(root, [...new Set([...Object.keys(authority.bytes), ...files.map(f => f.path)])]);
  const overlay = Object.fromEntries(files.map(f => [f.path, f.after]));
  const afterAuthority = authoritySnapshot(root, overlay);
  if (afterAuthority.project !== authority.project || afterAuthority.operator !== authority.operator ||
      canonicalJson(afterAuthority.framework) !== canonicalJson(authority.framework)) refuse('framework-or-project-change');
  let config;
  try { config = JSON.parse(overlay[MCP_FILE]); } catch { refuse('config-invalid-json'); }
  if (canonicalJson(parseYamlStrict(Buffer.from(overlay[MCP_FILE]))) !== canonicalJson(config)) refuse('config-collision');
  const beforeConfig = JSON.parse(readSafe(root, MCP_FILE));
  const expectedConfig = structuredClone(beforeConfig);
  expectedConfig.mcpServers[MCP_SERVER_NAME].args[2] = targetPin;
  if (canonicalJson(config) !== canonicalJson(expectedConfig)) refuse('config-collision');
  if (!Array.isArray(choices) || choices.length !== recipe.choices.length || new Set(choices.map(c => c.id)).size !== choices.length ||
      choices.some(c => !recipe.choices.some(r => r.id === c.id && r.options.includes(c.value)))) refuse('unresolved-operator-choice');
  const gateIds = [...recipe.gates, ...(recipe.audit === 'required' ? ['audit'] : ['audit-disposition'])];
  if (!Array.isArray(gates) || gates.length !== gateIds.length || new Set(gates.map(g => g.id)).size !== gates.length ||
      gates.some(g => !gateIds.includes(g.id) || !safeRelativePath(g.path) || files.some(f => f.path === g.path) || hashBytes(readSafe(root, g.path)) !== g.sha256)) refuse('gate-evidence-invalid');
  const repo = repository(root);
  if (repo.branch !== input.branch || repo.head !== input.head) refuse('source-git-changed');
  const plan = { format: 'dev-foundry.runtime-plan.v1', project: authority.project, operator: authority.operator,
    repository: repo, storeRoot: safeAbsolute(storeRoot), sourcePin, targetPin, sourceAuthority: authority.fingerprint,
    targetAuthority: afterAuthority.fingerprint, sourceAuthorityBytes: authority.bytes, targetAuthorityBytes: afterAuthority.bytes,
    framework, files, choices, gates, proposal, recipe, recipeSha256: sha256(recipeBytes),
    provenance: { source: releaseEvidence(source), target: attestation }, rollbackSafe: recipe.rollbackSafe,
    preservedFingerprint: preservedFingerprint(root, files.map(f => f.path)), restartRequired: true };
  const bytes = Buffer.from(canonicalJson(plan));
  return { plan, bytes, hash: sha256(bytes) };
}

export function decodePlan(bytes, hash) {
  const plan = JSON.parse(bytes);
  if (sha256(bytes) !== hash || canonicalJson(plan) !== bytes.toString() || plan.format !== 'dev-foundry.runtime-plan.v1' ||
      !plan.project || !plan.operator || !plan.repository?.root || !plan.repository.branch || !/^[0-9a-f]{40,64}$/.test(plan.repository.head) ||
      !/^[0-9a-f]{64}$/.test(plan.sourceAuthority) || !/^[0-9a-f]{64}$/.test(plan.targetAuthority) ||
      !plan.sourceAuthorityBytes || !plan.targetAuthorityBytes || !plan.proposal?.sourceSessionId || !plan.provenance?.target ||
      !Array.isArray(plan.gates) || !plan.gates.length || !Array.isArray(plan.choices) || typeof plan.rollbackSafe !== 'boolean' ||
      !Array.isArray(plan.files) || !plan.files.length || plan.files.length > 32 || new Set(plan.files.map(f => f.path)).size !== plan.files.length ||
      !plan.files.some(f => f.path === MCP_FILE) || plan.files.some(f => !ownedPath(f.path) ||
        hashBytes(f.before) !== f.beforeSha256 || typeof f.after !== 'string' || sha256(f.after) !== f.afterSha256)) refuse('invalid-plan');
  return plan;
}

export function revalidateSource(plan, hash, { journal = false } = {}) {
  const replay = constructPlan({ ...plan, root: plan.repository.root, branch: plan.repository.branch,
    head: plan.repository.head }, journal);
  if (replay.hash !== hash) refuse('source-plan-changed');
}
