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
  if (!input.taskId && !input.boundaryId) context.addIssue({ code: 'custom', message: 'taskId or boundaryId is required' });
  if (input.requestedAction === 'implement' && !input.taskId) context.addIssue({ code: 'custom', message: 'implement requires taskId' });
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
const frameworkVersionSupported = '2.1.0';

class ResolutionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const invalidAuthority = (message = 'Required authority is invalid or contradictory.') => new ResolutionError('AUTHORITY_INVALID', message);
const readFailure = () => new ResolutionError('READ_FAILED', 'A required authority source could not be read.');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const comparePaths = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function parseYaml(bytes) {
  const document = parseDocument(bytes.toString('utf8'), { uniqueKeys: true, prettyErrors: false });
  if (document.errors.length || document.warnings.length) throw invalidAuthority();
  const value = document.toJS();
  if (!isObject(value)) throw invalidAuthority();
  return value;
}

function parseSoT(bytes) {
  const text = bytes.toString('utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw invalidAuthority();
  const frontmatter = parseYaml(Buffer.from(match[1], 'utf8'));
  if (frontmatter.schemaVersion !== 'dev-foundry.sot-document.v2' ||
      !isObject(frontmatter.artifact) || typeof frontmatter.artifact.id !== 'string' ||
      typeof frontmatter.artifact.type !== 'string' || typeof frontmatter.artifact.status !== 'string') {
    throw invalidAuthority();
  }
  if (!isObject(frontmatter.authority) || !Array.isArray(frontmatter.authority.governedBy) ||
      frontmatter.authority.governedBy.some((id) => typeof id !== 'string' || !id)) {
    throw invalidAuthority();
  }
  if (!isObject(frontmatter.lifecycle) || typeof frontmatter.lifecycle.phase !== 'string') throw invalidAuthority();
  return frontmatter;
}

function parseAuthorityIndex(bytes) {
  const index = parseYaml(bytes);
  if (index.schema_version !== 'dev-foundry.authority-index.v2' || index.status !== 'active' ||
      !Array.isArray(index.routes) || !isObject(index.subject) || typeof index.id !== 'string') throw invalidAuthority();
  const routeIds = new Set();
  for (const route of index.routes) {
    if (!isObject(route) || typeof route.id !== 'string' || typeof route.path !== 'string' ||
        !authorityClasses.has(route.authority_class) || !Array.isArray(route.governs) ||
        route.governs.some((item) => typeof item !== 'string') ||
        (route.section_id !== null && route.section_id !== undefined && typeof route.section_id !== 'string') ||
        routeIds.has(route.id)) throw invalidAuthority();
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
      throw readFailure();
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
    if (pop.schema_version !== 'dev-foundry.project-operating-profile.v2' || pop.status !== 'active' ||
        !isObject(pop.repository) || typeof pop.repository.name !== 'string' ||
        !isObject(pop.framework) || typeof pop.framework.adopted_version !== 'string' ||
        typeof pop.framework.selected_authority_index !== 'string' ||
        typeof pop.framework.selected_manifest !== 'string' || pop.framework.adoption_status !== 'active' ||
        !isObject(pop.actor_bindings) || !isObject(pop.policies) || typeof pop.policies.default_role !== 'string') {
      throw invalidAuthority();
    }
    if (pop.repository.name !== this.request.targetProject || projectIndex.subject.id !== this.request.targetProject ||
        projectIndex.subject.kind !== 'project') {
      throw new ResolutionError('TARGET_MISMATCH', 'The requested project does not match configured project authority.');
    }
    if (pop.framework.adopted_version !== frameworkVersionSupported) {
      throw new ResolutionError('UNSUPPORTED_FRAMEWORK', 'The adopted framework version is not supported by this resolver.');
    }
    if (projectIndex.subject.base_version !== pop.framework.adopted_version) throw invalidAuthority('The project and POP framework versions contradict each other.');
    const frameworkRoutes = projectIndex.routes.filter((route) => route.governs.includes('reusable-dev-foundry-methodology'));
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
        this.frameworkIndex.subject.version !== frameworkVersionSupported ||
        this.frameworkIndex.subject.id !== `DF-FRAMEWORK-${frameworkVersionSupported}`) {
      throw invalidAuthority();
    }
    this.frameworkVersion = pop.framework.adopted_version;
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

  async resolveFromIndex(index, indexPath, artifactId, { authorityClass, requireUnique = true } = {}) {
    const matches = [];
    for (const route of index.routes) {
      if (authorityClass && route.authority_class !== authorityClass) continue;
      const { frontmatter } = await this.loadRoutedArtifact(route.path);
      if (frontmatter.artifact.id === artifactId) matches.push({ route, frontmatter });
    }
    if (matches.length !== 1 && requireUnique) throw invalidAuthority(matches.length ? 'Authority resolves to multiple routed artifacts.' : 'A required authority artifact has no active route.');
    return matches;
  }

  async resolveTask(taskId) {
    const routes = this.projectIndex.routes.filter((route) => route.authority_class === 'task');
    const matches = [];
    for (const route of routes) {
      const { frontmatter } = await this.loadRoutedArtifact(route.path);
      if (frontmatter.artifact.type !== 'TSK') throw invalidAuthority();
      if (frontmatter.artifact.id === taskId) matches.push({ route, frontmatter });
    }
    if (matches.length !== 1) throw invalidAuthority(matches.length ? 'Task identity resolves through duplicate routes.' : 'The requested task has no active route.');
    const task = matches[0];
    if (task.frontmatter.artifact.type !== 'TSK') throw invalidAuthority();
    const status = parseFrontmatterStatus(task.frontmatter);
    const phase = task.frontmatter.lifecycle.phase.toLowerCase();
    if (this.request.requestedAction === 'implement' && !(status === 'IN_PROGRESS' && phase === 'in-progress')) {
      throw new ResolutionError('ROLE_INELIGIBLE', 'The task lifecycle does not authorize implementation.');
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
    if (matches.length !== 1) throw invalidAuthority(matches.length ? 'Authority artifact identity is routed more than once.' : 'A required authority artifact is not routed.');
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
    if (action === 'inspect') {
      const binding = this.pop.actor_bindings[roleId];
      if (!isActiveBinding(binding)) throw new ResolutionError('ROLE_INELIGIBLE', 'The selected project role is missing or inactive.');
    } else if (!compatibleRoles[action].includes(roleId) || !isActiveBinding(this.pop.actor_bindings[roleId])) {
      throw new ResolutionError('ROLE_INELIGIBLE', 'The requested role is incompatible, missing, or inactive.');
    }
    const binding = this.pop.actor_bindings[roleId];
    const capabilityPaths = binding.capability_profiles ?? [];
    if (!Array.isArray(capabilityPaths) || capabilityPaths.some((item) => typeof item !== 'string')) throw invalidAuthority();
    const actorPath = binding.profile;
    const actorData = parseYaml(await this.readBytes(actorPath));
    if (actorData.role !== roleId || actorData.status !== 'active') throw invalidAuthority();
    await this.addSource(actorData.id ?? roleId, actorPath, 'profile');
    const capabilities = [];
    for (const capabilityPath of capabilityPaths) {
      const capability = parseYaml(await this.readBytes(capabilityPath));
      if (capability.status !== 'active') throw invalidAuthority();
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
      if (request.requestedAction === 'implement') throw new ResolutionError('INVALID_REQUEST', 'implement requires taskId.');
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
      throw new ResolutionError('STALE_CONTEXT', 'The authority context changed since the supplied fingerprint was produced.');
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
  if (!parsed.success) return { ok: false, errorCode: 'INVALID_REQUEST', message: 'The request does not match the resolver contract.' };
  if (typeof projectRoot !== 'string' || !path.isAbsolute(projectRoot)) return { ok: false, errorCode: 'READ_FAILED', message: 'The configured project root is unavailable.' };
  try {
    return await new Resolver(projectRoot).resolve(parsed.data);
  } catch (error) {
    if (error instanceof ResolutionError) return { ok: false, errorCode: error.code, message: error.message };
    return { ok: false, errorCode: 'READ_FAILED', message: 'A required authority source could not be read.' };
  }
}
