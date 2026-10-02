import path from 'node:path';
import { INDEX_PATH, POP_PATH, PROFILE_PATHS, ROLES, TARGETS, isObject, readYamlContained } from './common.js';

const allUnbound = () => Object.fromEntries(ROLES.map((role) => [role, 'unbound']));
const unavailable = (reason) => ({ overall: 'partial', roles: allUnbound(), bootstrap: { activeEntries: 0, claudeActive: false }, reasons: [reason] });
const sameList = (left, right) => Array.isArray(left) && left.length === right.length && left.every((item, index) => item === right[index]);

// Pure, read-only. Derives state only from consumer authority: the POP, Platform Bootstrap files,
// the Authority Index and the profiles they reference. Adapter-owned files are never read.
export async function evaluateActivation(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) return unavailable('root-unavailable');
  const pop = await readYamlContained(root, POP_PATH);
  const index = await readYamlContained(root, INDEX_PATH);
  if (!pop || !index || pop.schema_version !== 'dev-foundry.project-operating-profile.v2' || pop.status !== 'active' ||
      !isObject(pop.repository) || typeof pop.repository.name !== 'string' || !isObject(pop.actor_bindings) ||
      index.schema_version !== 'dev-foundry.authority-index.v2' || index.status !== 'active' || !isObject(index.subject) ||
      index.subject.id !== pop.repository.name) return unavailable('authority-unreadable');
  const project = pop.repository.name;
  const routed = new Set([
    ...(Array.isArray(index.routes) ? index.routes : []),
    ...(Array.isArray(index.bindings) ? index.bindings : []),
  ].filter((item) => isObject(item) && typeof item.path === 'string').map((item) => item.path));
  const reasons = [];

  const profileOk = async (profilePath, target) => {
    if (!routed.has(profilePath)) { reasons.push('profile-not-routed'); return false; }
    const profile = await readYamlContained(root, profilePath);
    if (!profile || profile.status !== 'active' || !isObject(profile.limits) || profile.limits.repository !== project ||
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
    if (ok) for (const profilePath of target.capabilities) ok = (await profileOk(profilePath, target)) && ok;
    else reasons.push('binding-mismatch');
    roles[role] = ok ? 'claude-active' : 'unbound';
  }

  const entries = isObject(pop.platform_bootstraps) ? Object.values(pop.platform_bootstraps).filter(isObject) : [];
  const activeEntries = entries.filter((entry) => entry.status === 'active');
  let claudeActive = false;
  if (activeEntries.length === 1 && typeof activeEntries[0].path === 'string' && routed.has(activeEntries[0].path)) {
    const bootstrap = await readYamlContained(root, activeEntries[0].path);
    claudeActive = Boolean(bootstrap) && bootstrap.schema_version === 'dev-foundry.platform-bootstrap.v2' && bootstrap.kind === 'platform-bootstrap' &&
      bootstrap.status === 'active' && isObject(bootstrap.platform) && bootstrap.platform.id === 'claude-code' &&
      isObject(bootstrap.repository) && bootstrap.repository.expected_name === project;
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

  const active = ROLES.every((role) => roles[role] === 'claude-active') && claudeActive;
  const prepared = !active && claims === 0 && !claudeArtifacts && ROLES.every((role) => roles[role] !== 'claude-active');
  const overall = active ? 'active' : prepared ? 'prepared' : 'partial';
  return { overall, roles, bootstrap: { activeEntries: activeEntries.length, claudeActive }, reasons: [...new Set(reasons)].sort() };
}
