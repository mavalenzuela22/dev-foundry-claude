import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { z } from 'zod';

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
export const inputSchema = z.object({
  requestedAction: z.enum(['inspect', 'author', 'implement', 'validate', 'audit', 'promote', 'close']),
  targetProject: z.string().min(1),
  taskId: identifier.optional(),
  boundaryId: identifier.optional(),
  requestedRole: z.string().min(1).optional(),
  expectedContextFingerprint: z.string().regex(/^[0-9a-f]{64}$/).optional(),
}).strict().superRefine((input, context) => {
  if (!input.taskId && !input.boundaryId) context.addIssue({ code: 'custom', path: ['taskId'], message: 'taskId or boundaryId is required' });
  if (input.requestedAction === 'implement' && !input.taskId) context.addIssue({ code: 'custom', path: ['taskId'], message: 'taskId is required when requestedAction is implement' });
});

const defaultRoles = {
  inspect: null,
  author: 'governance-author',
  implement: 'implementation-executor',
  validate: 'mechanical-validator',
  audit: 'governance-auditor',
  promote: 'governance-author',
  close: 'evidence-custodian',
};
const assessments = {
  inspect: ['boundary_state'],
  author: ['boundary_state', 'authorization_intent', 'audit_trigger'],
  implement: ['boundary_state', 'authorization_intent'],
  validate: ['validation_coverage', 'failure_causality'],
  audit: ['audit_trigger', 'audit_disposition'],
  promote: ['boundary_state', 'authorization_intent', 'audit_disposition'],
  close: ['closure_readiness', 'audit_disposition'],
};
const gates = {
  inspect: ['authority_resolved'],
  author: ['authority_resolved', 'semantic_self_assessment', 'independent_audit_if_triggered', 'operator_authorization'],
  implement: ['authority_resolved', 'executor_fit', 'implementation_self_verification', 'projection_reconciliation_if_needed', 'mechanical_validation'],
  validate: ['authority_resolved', 'mechanical_validation'],
  audit: ['authority_resolved', 'independent_audit_if_triggered'],
  promote: ['authority_resolved', 'mechanical_validation', 'semantic_self_assessment', 'independent_audit_if_triggered', 'operator_authorization', 'promotion_state_revalidation'],
  close: ['authority_resolved', 'closure_evidence', 'operator_authorization'],
};
const compatibleRoles = {
  inspect: null,
  author: ['governance-author'],
  implement: ['implementation-executor'],
  validate: ['mechanical-validator'],
  audit: ['governance-auditor'],
  promote: ['governance-author'],
  close: ['evidence-custodian'],
};
const authorityClasses = new Set(['methodology', 'product', 'configured', 'decision', 'task', 'profile']);
const routeAuthorityClasses = new Set([...authorityClasses, 'historical']);
const frameworkVersionsSupported = new Set(['2.1.0', '2.3.0']);

class ResolutionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const invalidAuthority = (message = 'A required authority fact is invalid or contradictory; check the active authority metadata and routes.') => new ResolutionError('AUTHORITY_INVALID', message);
const safeConfiguredPath = (value) => typeof value === 'string' && value.length <= 180 && /^[A-Za-z0-9._/ -]+$/.test(value) && !path.isAbsolute(value) && !value.split(/[\\/]/).includes('..') ? value : null;
const safeObserved = (value) => typeof value === 'string' && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) ? value : (typeof value);
const readFailure = (relativePath = null) => new ResolutionError('READ_FAILED', safeConfiguredPath(relativePath)
  ? `The configured authority source at ${safeConfiguredPath(relativePath)} could not be read. Verify that this POP/index-bound path exists and is readable; if the binding is wrong, stop for Governance Author reconciliation.`
  : 'A required authority source could not be read.');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const comparePaths = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function parseYaml(bytes) {
  const document = parseDocument(bytes.toString('utf8'), { uniqueKeys: true, prettyErrors: false });
  if (document.errors.length || document.warnings.length) throw invalidAuthority('An authority YAML document is malformed; check its syntax and duplicate keys.');
  const value = document.toJS();
  if (!isObject(value)) throw invalidAuthority('An authority YAML document must contain an object at its root.');
  return value;
}

function parseFrontmatter(bytes) {
  const text = bytes.toString('utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw invalidAuthority('An authority document is missing valid YAML frontmatter.');
  return parseYaml(Buffer.from(match[1], 'utf8'));
}

function parseSoT(bytes) {
  const frontmatter = parseFrontmatter(bytes);
  if (frontmatter.schemaVersion !== 'dev-foundry.sot-document.v2' ||
      !isObject(frontmatter.artifact) || typeof frontmatter.artifact.id !== 'string' ||
      typeof frontmatter.artifact.type !== 'string' || typeof frontmatter.artifact.status !== 'string') {
    throw invalidAuthority('Authority frontmatter must define the supported schemaVersion and artifact id, type, and status.');
  }
  if (!isObject(frontmatter.authority) || !Array.isArray(frontmatter.authority.governedBy) ||
      frontmatter.authority.governedBy.some((id) => typeof id !== 'string' || !id)) {
    throw invalidAuthority('Authority frontmatter must define authority.governedBy as an array of non-empty artifact identifiers.');
  }
  if (!isObject(frontmatter.lifecycle) || typeof frontmatter.lifecycle.phase !== 'string') throw invalidAuthority('Authority frontmatter must define lifecycle.phase as a string.');
  return frontmatter;
}

function parseAuthorityIndex(bytes) {
  const index = parseYaml(bytes);
  if (index.schema_version !== 'dev-foundry.authority-index.v2') throw invalidAuthority('Authority index schema_version must be dev-foundry.authority-index.v2.');
  if (index.status !== 'active') throw invalidAuthority('The authority index status must be active.');
  if (!Array.isArray(index.routes)) throw invalidAuthority('Authority index routes must be an array.');
  if (!isObject(index.subject) || typeof index.id !== 'string' || !index.id.trim()) throw invalidAuthority('Authority index must define subject metadata and a non-empty id.');
  const routeIds = new Set();
  for (const route of index.routes) {
    if (!isObject(route)) throw invalidAuthority('Each authority index route must be an object.');
    if (typeof route.id !== 'string' || !route.id.trim()) throw invalidAuthority('Each authority index route must define a non-empty id.');
    if (typeof route.path !== 'string' || !route.path.trim()) throw invalidAuthority('An authority index route must define a non-empty path.');
    if (!routeAuthorityClasses.has(route.authority_class)) throw invalidAuthority('An authority index route has an unsupported authority_class.');
    if (!Array.isArray(route.governs) || !route.governs.length || route.governs.some((item) => typeof item !== 'string' || !item.trim())) throw invalidAuthority('An authority index route must define governs as a non-empty list of artifact identifiers.');
    if (new Set(route.governs).size !== route.governs.length) throw invalidAuthority('An authority index route repeats an artifact in governs.');
    if (route.section_id !== null && route.section_id !== undefined && typeof route.section_id !== 'string') throw invalidAuthority('An authority index route section_id must be a string or null.');
    if (routeIds.has(route.id)) throw invalidAuthority('An authority index route id is duplicated.');
    routeIds.add(route.id);
  }
  return index;
}

function parseFrontmatterStatus(frontmatter) {
  return frontmatter.artifact.status.toUpperCase();
}

function isActiveBinding(binding) {
  return isObject(binding) && binding.status === 'active' && typeof binding.profile === 'string';
}

class Resolver {
  constructor(root) {
    this.root = path.resolve(root);
    this.sources = new Map();
    this.documentCache = new Map();
    this.identityCache = new Map();
    this.rawCache = new Map();
  }

  async readBytes(relativePath) {
    if (path.isAbsolute(relativePath)) throw invalidAuthority();
    if (this.rawCache.has(relativePath)) return this.rawCache.get(relativePath);
    const absolutePath = path.resolve(this.root, relativePath);
    const relative = path.relative(this.root, absolutePath);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw invalidAuthority();
    try {
      const canonicalRoot = await realpath(this.root);
      const canonicalFile = await realpath(absolutePath);
      const canonicalRelative = path.relative(canonicalRoot, canonicalFile);
      if (canonicalRelative === '..' || canonicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(canonicalRelative)) throw invalidAuthority();
      const bytes = await readFile(canonicalFile);
      this.rawCache.set(relativePath, bytes);
      return bytes;
    } catch (error) {
      if (error instanceof ResolutionError) throw error;
      throw readFailure(relativePath);
    }
  }

  async addSource(id, relativePath, authorityClass, sectionId = null) {
    if (this.sources.has(relativePath)) {
      const existing = this.sources.get(relativePath);
      if (existing.id !== id || existing.authorityClass !== authorityClass || existing.sectionId !== sectionId) throw invalidAuthority();
      return existing;
    }
    const bytes = await this.readBytes(relativePath);
    const entry = { id, path: relativePath, authorityClass, sha256: digest(bytes), sectionId: sectionId ?? null };
    this.sources.set(relativePath, entry);
    return entry;
  }

  async loadProjectAuthority() {
    const popPath = '.dev-foundry/profiles/project-operating-profile.yaml';
    const projectIndexPath = '.dev-foundry/authority-index.yaml';
    const popBytes = await this.readBytes(popPath);
    const pop = parseYaml(popBytes);
    const projectIndexBytes = await this.readBytes(projectIndexPath);
    const projectIndex = parseAuthorityIndex(projectIndexBytes);
    await this.addSource(pop.id ?? 'project-operating-profile', popPath, 'configured');
    await this.addSource(projectIndex.id, projectIndexPath, 'configured');
    const popSchema = pop.schema_version;
    if (!['dev-foundry.project-operating-profile.v2', 'dev-foundry.project-operating-profile.v3'].includes(popSchema) || pop.status !== 'active' ||
        !isObject(pop.repository) || typeof pop.repository.name !== 'string' ||
        !isObject(pop.framework) || typeof pop.framework.adopted_version !== 'string' ||
        typeof pop.framework.selected_authority_index !== 'string' ||
        typeof pop.framework.selected_manifest !== 'string' || pop.framework.adoption_status !== 'active' ||
        !isObject(pop.actor_bindings) || !isObject(pop.policies) || typeof pop.policies.default_role !== 'string') {
      throw invalidAuthority('The active project operating profile is missing a supported schema, repository, framework, actor_bindings, or policy field.');
    }
    if (pop.repository.name !== this.request.targetProject || projectIndex.subject.id !== this.request.targetProject ||
        projectIndex.subject.kind !== 'project') {
      throw new ResolutionError('TARGET_MISMATCH', 'The requested project does not match configured project authority.');
    }
    if (!frameworkVersionsSupported.has(pop.framework.adopted_version) ||
        (popSchema === 'dev-foundry.project-operating-profile.v2' && pop.framework.adopted_version !== '2.1.0') ||
        (popSchema === 'dev-foundry.project-operating-profile.v3' && pop.framework.adopted_version !== '2.3.0')) {
      throw new ResolutionError('UNSUPPORTED_FRAMEWORK', 'The adopted framework version is not supported by this resolver.');
    }
    if (projectIndex.subject.base_version !== pop.framework.adopted_version) throw invalidAuthority('The project and POP framework versions contradict each other.');
    const frameworkRoutes = projectIndex.routes.filter((route) => route.authority_class !== 'historical' && route.governs.includes('reusable-dev-foundry-methodology'));
    if (frameworkRoutes.length !== 1 || frameworkRoutes[0].path !== pop.framework.selected_authority_index || frameworkRoutes[0].authority_class !== 'methodology') {
      throw invalidAuthority('The project framework route contradicts the POP-selected release.');
    }
    this.pop = pop;
    this.projectIndex = projectIndex;
    this.projectIndexPath = projectIndexPath;
    this.frameworkIndexPath = pop.framework.selected_authority_index;
    const frameworkIndexBytes = await this.readBytes(this.frameworkIndexPath);
    this.frameworkIndex = parseAuthorityIndex(frameworkIndexBytes);
    await this.addSource(this.frameworkIndex.id, this.frameworkIndexPath, 'methodology');
    if (this.frameworkIndex.subject.kind !== 'framework-release' ||
        this.frameworkIndex.subject.version !== pop.framework.adopted_version ||
        this.frameworkIndex.subject.id !== `DF-FRAMEWORK-${pop.framework.adopted_version}`) {
      throw invalidAuthority('The POP-selected authority index does not identify the supported framework release.');
    }
    this.frameworkVersion = pop.framework.adopted_version;
    this.popSchema = popSchema;
    if (popSchema === 'dev-foundry.project-operating-profile.v3') {
      const manifestPath = pop.framework.selected_manifest;
      const manifestBytes = await this.readBytes(manifestPath);
      const manifest = parseYaml(manifestBytes);
      const indexArtifact = manifest.artifacts?.find((item) => item.path === this.frameworkIndexPath);
      if (manifest.framework_version !== '2.3.0' || manifest.canonical !== true || !Array.isArray(manifest.artifacts) ||
          indexArtifact?.sha256 !== digest(frameworkIndexBytes)) {
        throw invalidAuthority('The POP v3 selected manifest does not verify the canonical 2.3.0 Authority Index bytes.');
      }
      this.releaseManifest = manifest;
      await this.addSource(manifest.id ?? 'release-integrity-manifest-2.3.0', manifestPath, 'methodology');
    }
    if (popSchema === 'dev-foundry.project-operating-profile.v3') await this.validateV3Bootstrap();
  }

  async validateV3Bootstrap() {
    const active = Object.entries(this.pop.platform_bootstraps ?? {}).filter(([, binding]) => isObject(binding) && binding.status === 'active');
    if (active.length !== 1 || typeof active[0][1].path !== 'string') throw invalidAuthority('POP v3 requires one active repository-managed bootstrap for this governed Claude operation.');
    const [key, binding] = active[0];
    const bootstrapPath = binding.path;
    const bootstrap = parseYaml(await this.readBytes(bootstrapPath));
    if (bootstrap.schema_version !== 'dev-foundry.platform-bootstrap.v3' || bootstrap.kind !== 'platform-bootstrap' ||
        bootstrap.status !== 'active' || bootstrap.repository?.expected_name !== this.request.targetProject ||
        bootstrap.sources?.project_operating_profile !== '.dev-foundry/profiles/project-operating-profile.yaml' ||
        bootstrap.sources?.authority_index !== '.dev-foundry/authority-index.yaml' ||
        !['fixed', 'governed-project-bindings'].includes(bootstrap.actor_resolution?.mode)) {
      throw invalidAuthority(`Active POP v3 bootstrap ${safeConfiguredPath(bootstrapPath) ?? 'path'} is missing or inconsistent with project authority.`);
    }
    if (bootstrap.actor_resolution.mode === 'fixed') {
      const fixed = bootstrap.actor_resolution.fixed_profile;
      if (typeof fixed !== 'string' || bootstrap.actor_resolution.eligible_profiles?.length !== 0) throw invalidAuthority('Fixed v3 bootstrap profile selection is malformed.');
    } else if (bootstrap.actor_resolution.fixed_profile !== null) {
      throw invalidAuthority('Governed v3 bootstrap must not fix an Actor Profile.');
    }
    this.bootstrapBinding = { key, path: bootstrapPath, data: bootstrap };
    await this.addSource(bootstrap.id ?? key, bootstrapPath, 'configured');
  }

  async loadSoT(relativePath) {
    if (this.documentCache.has(relativePath)) return this.documentCache.get(relativePath);
    const bytes = await this.readBytes(relativePath);
    const frontmatter = parseSoT(bytes);
    const value = { bytes, frontmatter };
    this.documentCache.set(relativePath, value);
    return value;
  }

  async loadRoutedArtifact(relativePath) {
    if (/\.ya?ml$/i.test(relativePath)) {
      const bytes = await this.readBytes(relativePath);
      const value = parseYaml(bytes);
      const id = value.artifact?.id ?? value.id;
      const type = value.artifact?.type ?? value.kind;
      const status = value.artifact?.status ?? value.status;
      if (typeof id !== 'string' || typeof status !== 'string') throw invalidAuthority();
      return { bytes, frontmatter: { artifact: { id, type, status }, authority: { governedBy: [] }, lifecycle: { phase: value.lifecycle?.phase ?? 'active' } } };
    }
    return this.loadSoT(relativePath);
  }

  async loadRoutedIdentity(relativePath) {
    if (this.identityCache.has(relativePath)) return this.identityCache.get(relativePath);
    const bytes = await this.readBytes(relativePath);
    // Discovery is schema-neutral: an unused on-touch v1 document is not v2
    // authority. Only selected identities undergo loadRoutedArtifact validation.
    // Inspect actual metadata, rather than trusting route IDs or filenames, so
    // independently named routes and duplicate artifact identities remain safe.
    const value = /\.ya?ml$/i.test(relativePath) ? parseYaml(bytes) : parseFrontmatter(bytes);
    const id = value.artifact?.id ?? value.id;
    if (typeof id !== 'string' || !id.trim()) throw invalidAuthority();
    this.identityCache.set(relativePath, id);
    return id;
  }

  async resolveFromIndex(index, indexPath, artifactId, { authorityClass, requireUnique = true } = {}) {
    const matches = [];
    for (const route of index.routes) {
      if (route.authority_class === 'historical') continue;
      if (authorityClass && route.authority_class !== authorityClass) continue;
      if (await this.loadRoutedIdentity(route.path) !== artifactId) continue;
      const { frontmatter } = await this.loadRoutedArtifact(route.path);
      if (frontmatter.artifact.id !== artifactId) throw invalidAuthority();
      matches.push({ route, frontmatter });
    }
    if (matches.length !== 1 && requireUnique) {
      const sourcePath = safeConfiguredPath(indexPath) ?? 'the configured Authority Index';
      const id = safeObserved(artifactId);
      throw invalidAuthority(matches.length
        ? `Authority Index ${sourcePath} routes artifact ${id} to ${matches.length} matching sources; reconcile duplicate routes with Governance Author.`
        : `Authority artifact ${id} has no active route in Authority Index ${sourcePath}; reconcile the source authority with Governance Author.`);
    }
    return matches;
  }

  async resolveTask(taskId) {
    const matches = await this.resolveFromIndex(this.projectIndex, this.projectIndexPath, taskId, { authorityClass: 'task', requireUnique: false });
    if (matches.length !== 1) {
      const sourcePath = safeConfiguredPath(this.projectIndexPath) ?? 'the configured project Authority Index';
      throw invalidAuthority(matches.length
        ? `taskId resolves through ${matches.length} active routes in ${sourcePath}; reconcile duplicate task routes with Governance Author.`
        : `taskId has no active task route in ${sourcePath}. Check the exact taskId against the project index, correct the caller argument, and retry once.`);
    }
    const task = matches[0];
    if (task.frontmatter.artifact.type !== 'TSK') throw invalidAuthority();
    const status = parseFrontmatterStatus(task.frontmatter);
    const phase = task.frontmatter.lifecycle.phase.toLowerCase();
    if (this.request.requestedAction === 'implement' && !(status === 'IN_PROGRESS' && phase === 'in-progress')) {
      throw new ResolutionError('ROLE_INELIGIBLE', 'Implementation requires task artifact.status IN_PROGRESS and lifecycle.phase in-progress.');
    }
    return task;
  }

  async addRoutedArtifact(artifactId, stack = [], preferredIndex = this.projectIndex) {
    if (!this.resolvedArtifacts) this.resolvedArtifacts = new Map();
    const firstIndex = preferredIndex === this.frameworkIndex ? this.frameworkIndex : this.projectIndex;
    const secondIndex = firstIndex === this.projectIndex ? this.frameworkIndex : this.projectIndex;
    const firstPath = firstIndex === this.projectIndex ? this.projectIndexPath : this.frameworkIndexPath;
    const secondPath = secondIndex === this.projectIndex ? this.projectIndexPath : this.frameworkIndexPath;
    let matches = await this.resolveFromIndex(firstIndex, firstPath, artifactId, { requireUnique: false });
    let sourceIndex = firstIndex;
    if (matches.length === 0) {
      matches = await this.resolveFromIndex(secondIndex, secondPath, artifactId, { requireUnique: false });
      sourceIndex = secondIndex;
    }
    if (matches.length !== 1) {
      const id = safeObserved(artifactId);
      const configuredIndexes = [safeConfiguredPath(firstPath), safeConfiguredPath(secondPath)].filter(Boolean);
      if (matches.length) throw invalidAuthority(`Authority artifact ${id} is routed ${matches.length} times in ${configuredIndexes.join(' and ')}; reconcile duplicate routes with Governance Author.`);
      throw invalidAuthority(`Required authority artifact ${id} has no route in ${configuredIndexes.join(' or ') || 'the configured Authority Index'}. Reconcile the governing authority route with Governance Author.`);
    }
    const match = { ...matches[0], index: sourceIndex };
    const scopeKey = `${sourceIndex === this.projectIndex ? 'project' : 'framework'}:${artifactId}`;
    if (stack.includes(scopeKey)) throw invalidAuthority('The routed authority chain contains a cycle.');
    if (this.resolvedArtifacts.has(scopeKey)) return;
    const route = match.route;
    if (match.frontmatter.artifact.id !== artifactId) throw invalidAuthority();
    const status = parseFrontmatterStatus(match.frontmatter);
    if (!['ACTIVE', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETE'].includes(status)) throw invalidAuthority('Required authority is not active.');
    const entry = await this.addSource(artifactId, route.path, route.authority_class, route.section_id ?? null);
    this.resolvedArtifacts.set(scopeKey, entry);
    for (const governedId of match.frontmatter.authority.governedBy) {
      await this.addRoutedArtifact(governedId, [...stack, scopeKey], sourceIndex);
    }
  }

  async loadTasklessRoot() {
    const matches = await this.resolveFromIndex(this.projectIndex, this.projectIndexPath, 'OVR-001', { requireUnique: false });
    if (matches.length !== 1) throw invalidAuthority('Taskless governance requires one routed project boundary authority.');
    await this.addRoutedArtifact('OVR-001');
  }

  async resolveRole() {
    const action = this.request.requestedAction;
    const roleId = this.request.requestedRole ?? (defaultRoles[action] ?? this.pop.policies.default_role);
    const popPath = '.dev-foundry/profiles/project-operating-profile.yaml';
    const bindingField = `${popPath}: actor_bindings.${safeObserved(roleId)}`;
    if (action === 'inspect') {
      const binding = this.pop.actor_bindings[roleId];
      if (!isActiveBinding(binding)) {
        const status = isObject(binding) ? safeObserved(binding.status) : 'missing';
        throw new ResolutionError('ROLE_INELIGIBLE', `POP binding ${bindingField} is ${status}; expected an active project role binding. Stop for Governance Author reconciliation; do not guess another profile.`);
      }
    } else if (!compatibleRoles[action].includes(roleId)) {
      const expected = compatibleRoles[action].join(' or ');
      const pathLike = roleId.includes('/') || /\.ya?ml$/i.test(roleId);
      throw new ResolutionError('ROLE_INELIGIBLE', `requestedRole must be a project role ID compatible with requestedAction ${action}; expected ${expected}, received ${pathLike ? 'a path-like value' : safeObserved(roleId)}. Actor Profile paths and Capability Profile IDs/paths are separate POP-bound values. Set requestedRole to the expected role ID and retry once.`);
    } else if (!isActiveBinding(this.pop.actor_bindings[roleId])) {
      const binding = this.pop.actor_bindings[roleId];
      const status = isObject(binding) ? safeObserved(binding.status) : 'missing';
      throw new ResolutionError('ROLE_INELIGIBLE', `POP binding ${bindingField} is ${status}; expected active for ${action}. Stop for Governance Author reconciliation; do not guess another profile.`);
    }
    const binding = this.pop.actor_bindings[roleId];
    if (this.popSchema === 'dev-foundry.project-operating-profile.v3') {
      const selection = binding.selection;
      const keys = isObject(binding) ? Object.keys(binding).sort().join(',') : '';
      const selectionKeys = isObject(selection) ? Object.keys(selection).sort().join(',') : '';
      if (keys !== 'profile,selection,status' || !isObject(selection) ||
          selectionKeys !== 'eligibility_policy,mode,required_capabilities' ||
          selection.mode !== 'operation-scoped' || typeof selection.eligibility_policy !== 'string' || !selection.eligibility_policy.trim() ||
          selection.eligibility_policy.length > 180 || !Array.isArray(selection.required_capabilities) ||
          selection.required_capabilities.some((item) => typeof item !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(item)) ||
          new Set(selection.required_capabilities).size !== selection.required_capabilities.length) {
        throw invalidAuthority(`POP v3 role binding ${bindingField} must contain only an approved profile, active status, and valid operation-scoped selection policy.`);
      }
      const actorPath = binding.profile;
      const actorBytes = await this.readBytes(actorPath);
      const actorData = parseYaml(actorBytes);
      const releaseRoot = '.dev-foundry/releases/2.3.0/';
      const releasePath = actorPath.startsWith(releaseRoot) ? actorPath : null;
      const artifact = releasePath && this.releaseManifest?.artifacts.find((item) => item.path === releasePath);
      if (!artifact || artifact.sha256 !== digest(actorBytes)) throw invalidAuthority(`Actor Profile ${safeConfiguredPath(actorPath) ?? 'bound by the active POP'} is not verified by the selected canonical 2.3.0 manifest.`);
      if (actorData.role !== roleId || actorData.status !== 'active') throw invalidAuthority(`Actor Profile ${safeConfiguredPath(actorPath) ?? 'bound by the active POP'} does not match active role ${safeObserved(roleId)}.`);
      await this.addSource(actorData.id ?? roleId, actorPath, 'profile');
      return {
        id: roleId,
        actorProfilePath: actorPath,
        capabilityProfilePaths: [],
        requiredCapabilities: selection.required_capabilities,
        eligibilityPolicy: selection.eligibility_policy,
        operationSelection: 'unresolved',
      };
    }
    const capabilityPaths = binding.capability_profiles ?? [];
    if (!Array.isArray(capabilityPaths) || capabilityPaths.some((item) => typeof item !== 'string')) {
      throw invalidAuthority(`POP field ${popPath}: actor_bindings.${safeObserved(roleId)}.capability_profiles must be an array of configured Capability Profile paths; actual value type is ${Array.isArray(capabilityPaths) ? 'array with a non-string entry' : typeof capabilityPaths}. Stop for Governance Author reconciliation.`);
    }
    const actorPath = binding.profile;
    const actorData = parseYaml(await this.readBytes(actorPath));
    if (actorData.role !== roleId || actorData.status !== 'active') {
      const mismatches = [];
      if (actorData.role !== roleId) mismatches.push(`role expected ${safeObserved(roleId)}, actual ${safeObserved(actorData.role)}`);
      if (actorData.status !== 'active') mismatches.push(`status expected active, actual ${safeObserved(actorData.status)}`);
      throw invalidAuthority(`Actor Profile ${safeConfiguredPath(actorPath) ?? 'bound by the active POP'} has ${mismatches.join('; ')}. Reconcile ${popPath}: actor_bindings.${safeObserved(roleId)}.profile and the Actor Profile with Governance Author.`);
    }
    await this.addSource(actorData.id ?? roleId, actorPath, 'profile');
    const capabilities = [];
    for (const capabilityPath of capabilityPaths) {
      const capability = parseYaml(await this.readBytes(capabilityPath));
      if (capability.status !== 'active') throw invalidAuthority(`Capability Profile ${safeConfiguredPath(capabilityPath) ?? 'bound by the active POP'} has status ${safeObserved(capability.status)}; expected active. Reconcile ${popPath}: actor_bindings.${safeObserved(roleId)}.capability_profiles and the profile with Governance Author.`);
      await this.addSource(capability.id ?? capabilityPath, capabilityPath, 'profile');
      capabilities.push(capabilityPath);
    }
    return { id: roleId, actorProfilePath: actorPath, capabilityProfilePaths: capabilities };
  }

  async resolve(request) {
    this.request = request;
    await this.loadProjectAuthority();
    let task;
    if (request.taskId) {
      task = await this.resolveTask(request.taskId);
      await this.addRoutedArtifact(task.frontmatter.artifact.id);
    } else {
      if (!request.boundaryId) throw new ResolutionError('INVALID_REQUEST', 'boundaryId is required for taskless resolution.');
      if (request.requestedAction === 'implement') throw new ResolutionError('INVALID_REQUEST', 'taskId is required when requestedAction is implement.');
      await this.loadTasklessRoot();
    }
    const role = await this.resolveRole();
    const selector = [
      `requestedAction=${request.requestedAction}`,
      `targetProject=${request.targetProject}`,
      `taskId=${request.taskId ?? ''}`,
      `boundaryId=${request.boundaryId ?? ''}`,
      `requestedRole=${request.requestedRole ?? ''}`,
      `frameworkVersion=${this.frameworkVersion}`,
      `role=${role.id}`,
    ];
    const sourceLines = [...this.sources.values()].sort((a, b) => comparePaths(a.path, b.path)).map((source) => `source=${source.path}\t${source.sha256}`);
    const contextFingerprint = digest(Buffer.from(`${[...selector, ...sourceLines].join('\n')}\n`, 'utf8'));
    if (request.expectedContextFingerprint && request.expectedContextFingerprint !== contextFingerprint) {
      throw new ResolutionError('STALE_CONTEXT', 'expectedContextFingerprint is stale for the current POP and routed authority sources. Resolve this operation once without the old fingerprint, then use the newly returned contextFingerprint.');
    }
    const resolution = {
      targetProject: request.targetProject,
      frameworkVersion: this.frameworkVersion,
      requestedAction: request.requestedAction,
      ...(request.taskId ? { taskId: request.taskId } : {}),
      ...(request.boundaryId ? { boundaryId: request.boundaryId } : {}),
      role,
      authority: [...this.sources.values()].sort((a, b) => comparePaths(a.path, b.path)),
      requiredAssessments: assessments[request.requestedAction],
      requiredGates: gates[request.requestedAction],
      contextFingerprint,
    };
    return { ok: true, message: 'Governed operation authority resolved.', resolution };
  }
}

export async function resolveGovernedOperation(input, { projectRoot } = {}) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const diagnostics = parsed.error.issues.map((issue) => {
      const field = issue.path.length ? issue.path.join('.') : 'request';
      if (issue.code === 'unrecognized_keys') {
        const keys = issue.keys.map((key) => String(key).replace(/[^A-Za-z0-9_.-]/g, '?').slice(0, 80));
        return `unknown argument${keys.length === 1 ? '' : 's'}: ${keys.join(', ')}`;
      }
      if (issue.code === 'custom') return issue.message;
      if (field === 'requestedAction') return 'requestedAction must be one of inspect, author, implement, validate, audit, promote, or close';
      if (field === 'targetProject') return 'targetProject must be a non-empty string';
      if (field === 'taskId' || field === 'boundaryId') return `${field} must be a 1-128 character identifier using letters, digits, dot, underscore, or hyphen`;
      if (field === 'requestedRole') return 'requestedRole must be a non-empty string';
      if (field === 'expectedContextFingerprint') return 'expectedContextFingerprint must be a 64-character lowercase SHA-256 hex string';
      return `${field} is invalid`;
    });
    return { ok: false, errorCode: 'INVALID_REQUEST', message: `Invalid request: ${[...new Set(diagnostics)].join('; ')}.` };
  }
  if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot)) return { ok: false, errorCode: 'READ_FAILED', message: 'The configured project root is unavailable.' };
  try {
    return await new Resolver(projectRoot).resolve(parsed.data);
  } catch (error) {
    if (error instanceof ResolutionError) return { ok: false, errorCode: error.code, message: error.message };
    return { ok: false, errorCode: 'READ_FAILED', message: 'A required authority source could not be read.' };
  }
}
