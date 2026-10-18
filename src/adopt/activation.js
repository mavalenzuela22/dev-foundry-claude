import path from 'node:path';
import { INDEX_PATH, POP_PATH, PROFILE_PATHS, ROLES, TARGETS, cutoverState, isObject, parseYamlStrict, pathHasSymlink, readContained, readYamlContained } from './common.js';
import { sha256 } from './pin.js';

const allUnbound = () => Object.fromEntries(ROLES.map((role) => [role, 'unbound']));
const unavailable = (reason) => ({ overall: 'partial', roles: allUnbound(), bootstrap: { activeEntries: 0, claudeActive: false }, reasons: [reason] });
const sameList = (left, right) => Array.isArray(left) && left.length === right.length && left.every((item, index) => item === right[index]);

// Pure, read-only. Derives state only from consumer authority: the POP, Platform Bootstrap files,
// the Authority Index and the profiles they reference. Adapter-owned files are never read.
export async function evaluateActivation(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) return unavailable('root-unavailable');
  if ((await cutoverState(root)).blocked) return unavailable('cutover-in-flight');
  if (await pathHasSymlink(root, POP_PATH) || await pathHasSymlink(root, INDEX_PATH)) return unavailable('unsafe-authority-path');
  const pop = await readYamlContained(root, POP_PATH);
  const index = await readYamlContained(root, INDEX_PATH);
  if (!pop || !index || !['dev-foundry.project-operating-profile.v2', 'dev-foundry.project-operating-profile.v3'].includes(pop.schema_version) || pop.status !== 'active' ||
      !isObject(pop.repository) || typeof pop.repository.name !== 'string' || !isObject(pop.actor_bindings) ||
      index.schema_version !== 'dev-foundry.authority-index.v2' || index.status !== 'active' || !isObject(index.subject) ||
      index.subject.id !== pop.repository.name) return unavailable('authority-unreadable');
  const project = pop.repository.name;
  const routed = new Set([
    ...(Array.isArray(index.routes) ? index.routes : []),
    ...(Array.isArray(index.bindings) ? index.bindings : []),
  ].filter((item) => isObject(item) && typeof item.path === 'string').map((item) => item.path));
  const reasons = [];
  const configuredRouteOk = (file) => [...(index.routes ?? []), ...(index.bindings ?? [])]
    .filter((item) => item?.path === file && item.authority_class === 'configured').length === 1;

  if (pop.schema_version === 'dev-foundry.project-operating-profile.v3') {
    if (pop.framework?.adopted_version !== '2.3.0' || pop.framework?.adoption_status !== 'active' ||
        index.subject.base_version !== '2.3.0' || index.routes?.filter((route) => route?.authority_class === 'methodology' && route.governs?.includes('reusable-dev-foundry-methodology')).length !== 1 ||
        index.routes.find((route) => route?.authority_class === 'methodology' && route.governs?.includes('reusable-dev-foundry-methodology'))?.path !== pop.framework.selected_authority_index) {
      return unavailable('framework-authority-mismatch');
    }
    const roles = {};
    const releaseRoot = '.dev-foundry/releases/2.3.0/';
    const manifestBytes = await readContained(root, pop.framework.selected_manifest);
    const manifest = manifestBytes && parseYamlStrict(manifestBytes);
    const indexBytes = await readContained(root, pop.framework.selected_authority_index);
    const indexArtifact = manifest?.artifacts?.find((item) => item.path === pop.framework.selected_authority_index);
    const manifestValid = manifest?.framework_version === '2.3.0' && manifest.canonical === true && Array.isArray(manifest.artifacts) &&
      pop.framework.selected_manifest === '.dev-foundry/releases/2.3.0/release-integrity-manifest.yaml' &&
      pop.framework.selected_authority_index === '.dev-foundry/releases/2.3.0/authority-index.yaml' &&
      indexArtifact?.sha256 === sha256(Buffer.from(indexBytes ?? ''));
    for (const role of ROLES) {
      const binding = pop.actor_bindings[role];
      const selection = binding?.selection;
      const exact = isObject(binding) && Object.keys(binding).sort().join(',') === 'profile,selection,status' &&
        binding.status === 'active' && typeof binding.profile === 'string' &&
        isObject(selection) && Object.keys(selection).sort().join(',') === 'eligibility_policy,mode,required_capabilities' &&
        selection.mode === 'operation-scoped' && typeof selection.eligibility_policy === 'string' && selection.eligibility_policy.trim() &&
        Array.isArray(selection.required_capabilities) && selection.required_capabilities.every((value) => typeof value === 'string') &&
        new Set(selection.required_capabilities).size === selection.required_capabilities.length &&
        !await pathHasSymlink(root, binding.profile) && binding.profile.startsWith(releaseRoot) && manifestValid;
      const actor = exact ? await readYamlContained(root, binding.profile) : null;
      const artifactPath = exact ? binding.profile.slice(releaseRoot.length) : '';
      const manifestArtifact = exact ? manifest.artifacts.find((item) => item.path === `${releaseRoot}${artifactPath}`) : null;
      roles[role] = exact && manifestArtifact?.sha256 === sha256(Buffer.from(await readContained(root, binding.profile) ?? '')) &&
        actor?.status === 'active' && actor.role === role ? 'operation-scoped' : 'unbound';
    }
    const extras = Object.entries(pop.actor_bindings).some(([role, binding]) => !ROLES.includes(role) && binding?.status === 'active');
    const entries = isObject(pop.platform_bootstraps) ? Object.values(pop.platform_bootstraps).filter(isObject) : [];
    const activeEntries = entries.filter((entry) => entry.status === 'active');
    let bootstrapActive = false;
    if (activeEntries.length === 1 && routed.has(activeEntries[0].path) && configuredRouteOk(activeEntries[0].path) && !await pathHasSymlink(root, activeEntries[0].path)) {
      const bootstrap = await readYamlContained(root, activeEntries[0].path);
      const resolution = bootstrap?.actor_resolution;
      const expectedProfiles = [pop.actor_bindings['governance-author']?.profile, pop.actor_bindings['evidence-custodian']?.profile];
      bootstrapActive = bootstrap?.schema_version === 'dev-foundry.platform-bootstrap.v3' && bootstrap.kind === 'platform-bootstrap' &&
        bootstrap.status === 'active' && bootstrap.platform?.id === 'claude-code' &&
        bootstrap.repository?.expected_name === project && bootstrap.repository?.workspace_binding === 'repository-root' &&
        bootstrap.sources?.project_operating_profile === POP_PATH && bootstrap.sources?.authority_index === INDEX_PATH &&
        resolution?.mode === 'governed-project-bindings' && resolution.fixed_profile === null &&
        resolution.default_role === 'governance-author' && resolution.eligible_profiles?.length === 2 &&
        expectedProfiles.every((profile) => resolution.eligible_profiles.includes(profile));
    }
    const active = !extras && ROLES.every((role) => roles[role] === 'operation-scoped') && bootstrapActive;
    const reasons = [];
    if (extras) reasons.push('extra-active-role');
    if (activeEntries.length !== 1) reasons.push('bootstrap-count');
    else if (!bootstrapActive) reasons.push('bootstrap-not-claude');
    if (!active) reasons.push('operation-policy-incomplete');
    return { overall: active ? 'active' : 'partial', roles, bootstrap: { activeEntries: activeEntries.length, claudeActive: bootstrapActive }, reasons };
  }

  const profileOk = async (profilePath, target) => {
    if (!routed.has(profilePath) || !configuredRouteOk(profilePath)) { reasons.push('profile-not-routed'); return false; }
    const profile = await readYamlContained(root, profilePath);
    if (await pathHasSymlink(root, profilePath) || !profile || profile.schema_version !== 'dev-foundry.capability-profile.v1' || profile.status !== 'active' || !isObject(profile.limits) || profile.limits.repository !== project ||
        profile.limits.platform !== target.platform || profile.limits.implementation_identity !== target.identity) {
      reasons.push('profile-invalid');
      return false;
    }
    return true;
  };

  let claims = 0;
  const roles = {};
  for (const role of ROLES) {
    const target = TARGETS[role];
    const binding = pop.actor_bindings[role];
    if (!isObject(binding) || binding.status !== 'active' || typeof binding.profile !== 'string') { roles[role] = 'unbound'; continue; }
    const implementation = binding.implementation;
    const claimsClaude = isObject(implementation) && implementation.identity === target.identity && implementation.platform === target.platform;
    if (!claimsClaude) { roles[role] = 'foreign-active'; continue; }
    claims += 1;
    let ok = implementation.kind === target.kind && sameList(binding.capability_profiles ?? [], target.capabilities);
    const actor = await readYamlContained(root, binding.profile);
    ok = ok && !(await pathHasSymlink(root, binding.profile)) && actor?.status === 'active' && actor.role === role;
    if (ok) for (const profilePath of target.capabilities) ok = (await profileOk(profilePath, target)) && ok;
    else reasons.push('binding-mismatch');
    roles[role] = ok ? 'claude-active' : 'unbound';
  }

  const entries = isObject(pop.platform_bootstraps) ? Object.values(pop.platform_bootstraps).filter(isObject) : [];
  const activeEntries = entries.filter((entry) => entry.status === 'active');
  let claudeActive = false;
  if (activeEntries.length === 1 && typeof activeEntries[0].path === 'string' && routed.has(activeEntries[0].path) && configuredRouteOk(activeEntries[0].path)) {
    const bootstrap = await readYamlContained(root, activeEntries[0].path);
    claudeActive = Boolean(bootstrap) && bootstrap.schema_version === 'dev-foundry.platform-bootstrap.v2' && bootstrap.kind === 'platform-bootstrap' &&
      bootstrap.status === 'active' && isObject(bootstrap.platform) && bootstrap.platform.id === 'claude-code' &&
      isObject(bootstrap.repository) && bootstrap.repository.expected_name === project &&
      bootstrap.repository.workspace_binding === 'repository-root' && !(await pathHasSymlink(root, activeEntries[0].path)) &&
      bootstrap.sources?.project_operating_profile === POP_PATH && bootstrap.sources?.authority_index === INDEX_PATH &&
      bootstrap.actor_resolution?.mode === 'governed-project-bindings' && bootstrap.actor_resolution?.default_role === 'governance-author' &&
      bootstrap.actor_resolution?.fixed_profile === null && sameList(bootstrap.actor_resolution?.eligible_profiles,
        [pop.actor_bindings['governance-author']?.profile, pop.actor_bindings['evidence-custodian']?.profile]);
  }
  if (activeEntries.length !== 1) reasons.push('bootstrap-count');
  else if (!claudeActive) reasons.push('bootstrap-not-claude');

  // Claude artifacts in consumer authority make the state mixed even when no role is Claude-active.
  let claudeArtifacts = false;
  for (const entry of entries) {
    if (typeof entry.path !== 'string') continue;
    const bootstrap = await readYamlContained(root, entry.path);
    if (bootstrap && isObject(bootstrap.platform) && bootstrap.platform.id === 'claude-code') claudeArtifacts = true;
  }
  for (const profilePath of Object.values(PROFILE_PATHS)) {
    if (await readYamlContained(root, profilePath)) claudeArtifacts = true;
  }

  const extraActiveRoles = Object.entries(pop.actor_bindings).some(([role, binding]) => !ROLES.includes(role) && binding?.status === 'active');
  if (extraActiveRoles) reasons.push('extra-active-role');
  const active = !extraActiveRoles && ROLES.every((role) => roles[role] === 'claude-active') && claudeActive;
  const prepared = !active && claims === 0 && !claudeArtifacts && ROLES.every((role) => roles[role] !== 'claude-active');
  const overall = active ? 'active' : prepared ? 'prepared' : 'partial';
  return { overall, roles, bootstrap: { activeEntries: activeEntries.length, claudeActive }, reasons: [...new Set(reasons)].sort() };
}
