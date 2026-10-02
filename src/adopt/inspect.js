import { readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { INDEX_PATH, POP_PATH, ROLES, SUPPORTED_FRAMEWORK, isObject, parseYamlStrict, readContained } from './common.js';
import { git } from './ignore.js';
import { sha256 } from './pin.js';

const blocker = (code, message) => ({ code, message });

// Read-only preflight (section 5.1). Never writes. Returns facts plus blockers; the planner decides.
export async function inspect(rootArgument, { project, idPrefix } = {}) {
  const facts = { blockers: [], warnings: [], governed: false, root: null };
  let root;
  try {
    root = await realpath(path.resolve(rootArgument ?? process.cwd()));
  } catch {
    facts.blockers.push(blocker('root-unavailable', 'The repository root is unavailable.'));
    return facts;
  }
  facts.root = root;
  const top = git(root, ['rev-parse', '--show-toplevel']);
  if (top.status !== 0) facts.blockers.push(blocker('not-a-git-repository', 'The root is not inside a git repository.'));
  else if (await realpath(top.stdout.trim()) !== root) facts.blockers.push(blocker('not-repository-root', 'The root is not the repository top level.'));

  const popBytes = await readContained(root, POP_PATH);
  const indexBytes = await readContained(root, INDEX_PATH);
  const pop = popBytes && parseYamlStrict(popBytes);
  const index = indexBytes && parseYamlStrict(indexBytes);
  const popValid = Boolean(pop) && pop.schema_version === 'dev-foundry.project-operating-profile.v2' && pop.status === 'active' &&
    isObject(pop.repository) && typeof pop.repository.name === 'string' && isObject(pop.framework) &&
    typeof pop.framework.adopted_version === 'string' && typeof pop.framework.selected_authority_index === 'string' &&
    pop.framework.adoption_status === 'active' && isObject(pop.actor_bindings);
  const indexValid = Boolean(index) && index.schema_version === 'dev-foundry.authority-index.v2' && index.status === 'active' &&
    isObject(index.subject) && Array.isArray(index.routes);
  if (!popValid || !indexValid) return facts;
  const releaseBytes = await readContained(root, pop.framework.selected_authority_index);
  const release = releaseBytes && parseYamlStrict(releaseBytes);
  if (!release || release.schema_version !== 'dev-foundry.authority-index.v2' || !isObject(release.subject)) return facts;
  facts.governed = true;
  Object.assign(facts, { pop, popBytes, index, indexBytes, release, project: pop.repository.name });

  if (pop.repository.name !== index.subject.id || index.subject.kind !== 'project') facts.blockers.push(blocker('identity-mismatch', 'Project identity disagrees between POP and Authority Index.'));
  if (project !== undefined && project !== pop.repository.name) facts.blockers.push(blocker('identity-mismatch', 'The asserted project does not equal the POP repository name.'));
  if (pop.repository.authority_index !== undefined && pop.repository.authority_index !== INDEX_PATH) facts.blockers.push(blocker('nonstandard-authority-path', 'The Authority Index is not at the standard path.'));
  if (pop.framework.adopted_version !== SUPPORTED_FRAMEWORK || index.subject.base_version !== pop.framework.adopted_version ||
      release.subject.version !== SUPPORTED_FRAMEWORK) facts.blockers.push(blocker('unsupported-framework', 'The adopted framework version is not supported by the adapter.'));
  const frameworkRoutes = index.routes.filter((route) => isObject(route) && Array.isArray(route.governs) && route.governs.includes('reusable-dev-foundry-methodology'));
  if (frameworkRoutes.length !== 1 || frameworkRoutes[0].path !== pop.framework.selected_authority_index) facts.blockers.push(blocker('authority-ambiguous', 'The framework release route is ambiguous or contradicts the POP.'));

  // Platform bootstraps: existing entries, their files, and identity agreement.
  facts.bootstraps = [];
  const bootstrapMap = isObject(pop.platform_bootstraps) ? pop.platform_bootstraps : {};
  for (const [key, entry] of Object.entries(bootstrapMap)) {
    if (!isObject(entry) || typeof entry.path !== 'string') { facts.blockers.push(blocker('authority-ambiguous', 'A platform bootstrap entry is malformed.')); continue; }
    const bytes = await readContained(root, entry.path);
    const data = bytes && parseYamlStrict(bytes);
    facts.bootstraps.push({ key, path: entry.path, status: entry.status, bytes, data });
    if (entry.status === 'active' && (!data || !isObject(data.repository) || data.repository.expected_name !== pop.repository.name)) {
      facts.blockers.push(blocker('identity-mismatch', 'An active platform bootstrap does not name this project.'));
    }
  }

  const prefixMatch = /^(.+)-PROJECT-OPERATING-PROFILE$/.exec(typeof pop.id === 'string' ? pop.id : '');
  const prefix = idPrefix ?? (prefixMatch ? prefixMatch[1] : null);
  if (prefix === null || !/^[A-Z][A-Z0-9-]*$/.test(prefix)) facts.blockers.push(blocker('unrecognized-id-convention', 'The POP id convention is unrecognized; provide --id-prefix.'));
  facts.prefix = prefix;

  // Actor profile identity per role: the existing binding profile, else the single release profile.
  facts.actorProfiles = {};
  const releaseDir = path.posix.dirname(pop.framework.selected_authority_index);
  let releaseProfiles = null;
  for (const role of ROLES) {
    const binding = pop.actor_bindings[role];
    if (isObject(binding) && typeof binding.profile === 'string') { facts.actorProfiles[role] = binding.profile; continue; }
    if (releaseProfiles === null) {
      releaseProfiles = [];
      try {
        for (const name of (await readdir(path.join(root, ...releaseDir.split('/'), 'actor-profiles'))).sort()) {
          if (!name.endsWith('.yaml')) continue;
          const profilePath = `${releaseDir}/actor-profiles/${name}`;
          const data = parseYamlStrict((await readContained(root, profilePath)) ?? Buffer.alloc(0));
          if (data && typeof data.role === 'string') releaseProfiles.push({ path: profilePath, role: data.role });
        }
      } catch { /* absent release profiles leave the role unresolved below */ }
    }
    const candidates = releaseProfiles.filter((candidate) => candidate.role === role);
    if (candidates.length === 1) { facts.actorProfiles[role] = candidates[0].path; facts.missingBindings = [...(facts.missingBindings ?? []), role]; }
    else facts.blockers.push(blocker('role-profile-ambiguous', 'A role has no binding and the release does not hold exactly one Actor Profile for it.'));
  }
  return facts;
}

export const profileId = (profilePath) => path.posix.basename(profilePath).replace(/\.yaml$/, '');
export const shaOrAbsent = (bytes) => (bytes === null || bytes === undefined ? 'absent' : sha256(bytes));
