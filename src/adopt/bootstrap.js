import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';
import { BOOTSTRAP_KEY, BOOTSTRAP_PATH, CLAUDE_MD, INDEX_PATH, MCP_FILE, MCP_SERVER_NAME, POP_PATH, PROFILE_PATHS, ROLES, TARGETS, pathHasSymlink, parseYamlStrict, readContained } from './common.js';
import { canonicalJson, sha256 } from './pin.js';
import { git, planIgnore } from './ignore.js';
import { makeUnifiedDiff } from './diff.js';
import { BLOCK_BEGIN, BLOCK_END, renderAgents, renderBootstrap, renderClaudeBlock, renderMcpEntry, renderProfiles, templateParams } from './render.js';

export const FRAMEWORK_BUNDLE = 'framework/dev-foundry-2.1.0.bundle.json';
const packageRoot = new URL('../../', import.meta.url);
export const ONBOARDING_OVERVIEW = '.dev-foundry/onboarding/OVR-001.md';
export const ONBOARDING_TASK = '.dev-foundry/onboarding/TSK-001.md';
const releaseRoot = '.dev-foundry/releases/2.1.0';

export async function frameworkFiles() {
  const bundle = JSON.parse(await readFile(new URL(FRAMEWORK_BUNDLE, packageRoot), 'utf8'));
  if (bundle.format !== 'dev-foundry.framework-bundle.v1' || bundle.version !== '2.1.0' || !Array.isArray(bundle.files)) throw new Error('Invalid framework bundle');
  const files = new Map();
  let previous = '';
  for (const entry of bundle.files) {
    if (typeof entry.path !== 'string' || entry.path <= previous || entry.path.startsWith('/') || entry.path.includes('\\') || entry.path.split('/').some((s) => !s || s === '.' || s === '..')) throw new Error('Unsafe framework bundle path');
    const bytes = Buffer.from(entry.base64, 'base64');
    if (bytes.toString('base64') !== entry.base64 || bytes.length !== entry.size || sha256(bytes) !== entry.sha256) throw new Error('Invalid framework bundle bytes');
    files.set(`${releaseRoot}/${entry.path}`, bytes); previous = entry.path;
  }
  const manifest = parseYamlStrict(files.get(`${releaseRoot}/release-integrity-manifest.yaml`));
  if (manifest?.framework_version !== '2.1.0' || manifest.canonical !== true || !Array.isArray(manifest.artifacts)) throw new Error('Invalid framework manifest');
  if (files.size !== manifest.artifacts.length + 1 || manifest.artifacts.some((entry) => !files.has(entry.path) || sha256(files.get(entry.path)) !== entry.sha256)) throw new Error('Framework manifest mismatch');
  return files;
}

const sot = (id, type, title, status, governedBy, phase, body, owns) => `---\n${stringify({ schemaVersion: 'dev-foundry.sot-document.v2', artifact: { id, type, title, status }, artifactVersion: '1', authorityScope: 'initial-project-onboarding', ownerRole: 'governance-author', canonical: true, scope: { owns, excludes: ['ordinary-product-implementation'] }, authority: { governedBy, supersedes: [] }, lifecycle: { phase }, portability: 'project-specific' })}---\n\n${body}\n`;

// Extends the same deterministic plan/apply model. This function never writes.
export async function createBootstrapPlan({ facts, adapter, project, classification, operator }) {
  const plan = { planFormat: 'dev-foundry.adopt-plan.v1', mode: 'initial-bootstrap', status: 'blocked', target: { project: null, idPrefix: null }, adapter,
    framework: { version: '2.1.0', selectedAuthorityIndex: `${releaseRoot}/authority-index.yaml` }, governance: { state: 'initial-bootstrap' }, activation: null,
    create: [], merge: [], delete: [], noop: [], blockers: [...facts.blockers], warnings: [], preconditions: {}, guaranteed_untouched: ['application/product files', 'existing project documents', 'historical evidence', 'other MCP entries', 'CLAUDE.md outside managed block'], applicationFilesAffected: 0 };
  const ops = { writes: [], deletes: [] };
  const finish = () => { if (plan.blockers.length) { ops.writes = []; plan.status = 'blocked'; } const bytes = Buffer.from(canonicalJson(plan)); return { plan, bytes, hash: sha256(bytes), ops }; };
  const block = (code, message) => plan.blockers.push({ code, message });
  const root = facts.root;
  if (!root || plan.blockers.length) return finish();
  // Existing incomplete authority is never overwritten or adopted as a blank project.
  const entries = await readdir(path.join(root, '.dev-foundry')).catch(() => []);
  if (entries.some((name) => name !== '.gitignore' && name !== 'telemetry')) block('bootstrap-authority-ambiguous', 'Existing project governance needs review. Next: dev-foundry-claude doctor --verbose');
  const tracked = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  if (tracked.status !== 0) block('bootstrap-repository-unavailable', 'Repository facts are unavailable. Next: dev-foundry-claude doctor');
  const files = [...new Set(tracked.stdout.split('\0').filter(Boolean))].sort();
  const product = files.filter((file) => !/^(?:\.dev-foundry\/|\.claude\/|\.mcp\.json$|CLAUDE\.md$|README(?:\.[^/]+)?$|LICENSE(?:\.[^/]+)?$|\.gitignore$)/i.test(file));
  project ??= path.basename(root);
  classification ??= product.length ? 'brownfield' : 'greenfield';
  operator ??= git(root, ['config', '--local', '--get', 'user.name']).stdout.trim() || null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(project)) block('bootstrap-project-required', 'Choose a project name. Next: dev-foundry-claude setup --project <name>');
  if (!['greenfield', 'brownfield'].includes(classification)) block('bootstrap-classification-required', 'Choose greenfield or brownfield. Next: dev-foundry-claude setup --classification brownfield');
  if (typeof operator !== 'string' || !operator.trim() || operator.length > 128 || /[\r\n\x00-\x1f]/.test(operator)) block('bootstrap-operator-required', 'Identify the human project owner. Next: dev-foundry-claude setup --operator "Your name"');
  const prefix = `PROJECT-${project.replace(/[^A-Za-z0-9]/g, '-').toUpperCase()}`;
  plan.target = { project, idPrefix: prefix };
  plan.bootstrap = { project, classification, operator, observedFiles: files, productFactsVerified: false };
  // Bind all repository facts used for inference and the exact working-tree state.
  const head = git(root, ['rev-parse', '--verify', 'HEAD']);
  const status = git(root, ['status', '--porcelain', '--untracked-files=all']);
  plan.repository = { head: head.status === 0 ? head.stdout.trim() : null, files, localOperator: git(root, ['config', '--local', '--get', 'user.name']).stdout.trim(), statusSha256: sha256(status.stdout) };
  if (plan.blockers.length) return finish();
  const framework = await frameworkFiles();
  const actorProfiles = {};
  for (const [file, bytes] of framework) {
    if (!file.includes('/actor-profiles/')) continue;
    const profile = parseYamlStrict(bytes); actorProfiles[profile.role] = { path: file, id: profile.id };
  }
  const params = templateParams({ project, prefix, expect: adapter.expect, executorProfileId: actorProfiles['implementation-executor'].id, auditorProfileId: actorProfiles['governance-auditor'].id, authorProfile: actorProfiles['governance-author'].path, custodianProfile: actorProfiles['evidence-custodian'].path });
  const pop = { schema_version: 'dev-foundry.project-operating-profile.v2', id: `${prefix}-PROJECT-OPERATING-PROFILE`, title: `${project} Project Operating Profile`, kind: 'project-operating-profile', status: 'active', artifact_version: '2.1.0-local.1', canonical: false,
    repository: { name: project, classification, authority_index: INDEX_PATH }, framework: { adopted_version: '2.1.0', selected_authority_index: `${releaseRoot}/authority-index.yaml`, selected_manifest: `${releaseRoot}/release-integrity-manifest.yaml`, adoption_status: 'active' }, operator: { kind: 'human', identity: operator },
    actor_bindings: Object.fromEntries(ROLES.map((role) => { const target = TARGETS[role]; return [role, { profile: actorProfiles[role].path, implementation: { kind: target.kind, identity: target.identity, platform: target.platform }, capability_profiles: target.capabilities, status: 'active' }]; })),
    platform_bootstraps: { [BOOTSTRAP_KEY]: { path: BOOTSTRAP_PATH, status: 'active' } }, policies: { frontmatter_schema: 'dev-foundry.sot-document.v2', metadata_migration_mode: 'on-touch', audit_triggers: [], promotion_rules: [], default_role: 'governance-author' }, deviations: [] };
  const route = (id, file, authority_class, governs) => ({ id, path: file, authority_class, governs, section_id: null });
  const binding = (id, file, kind) => ({ id, path: file, kind, authority_class: 'configured', required: true });
  const index = { schema_version: 'dev-foundry.authority-index.v2', id: `${prefix}-AUTHORITY-INDEX`, title: `${project} Authority Index`, kind: 'authority-index', status: 'active', artifact_version: '2.1.0-local.1', canonical: false,
    subject: { kind: 'project', id: project, version: null, base_version: '2.1.0', manifest: null }, routes: [route('active-framework', `${releaseRoot}/authority-index.yaml`, 'methodology', ['reusable-dev-foundry-methodology']), route('project-overview', ONBOARDING_OVERVIEW, 'product', ['project-purpose', 'documentation-routing']), route('initial-onboarding', ONBOARDING_TASK, 'task', ['initial-project-baseline'])],
    bindings: [binding('project-operating-profile', POP_PATH, 'project-operating-profile'), binding('platform-bootstrap-claude-code', BOOTSTRAP_PATH, 'platform-bootstrap'), binding('implementation-executor-capability-claude-code-v2', PROFILE_PATHS.executor, 'capability-profile'), binding('governance-auditor-capability-claude-code-v1', PROFILE_PATHS.auditor, 'capability-profile')],
    rules: { single_authoritative_home_required: true, unindexed_active_authority_forbidden: true, evidence_is_normative: false, consumer_copy_is_canonical: false, runtime_capability_grants_authority: false, automatic_framework_upgrade: false } };
  const overview = sot('OVR-001', 'OVR', 'Project onboarding overview', 'ACTIVE', [], 'active', `# ${project}\n\nThe human Operator selected ${classification} adoption of DEV FOUNDRY 2.1.0.\nProduct purpose, architecture and behavior have not yet been verified.\n\nRouting: ${INDEX_PATH}. Initial baseline: ${ONBOARDING_TASK}.\nExisting project files remain unchanged. Product decisions require current project authority.`, ['project-purpose', 'documentation-routing']);
  const task = sot('TSK-001', 'TSK', 'Observe and establish the initial project baseline', 'IN_PROGRESS', ['OVR-001', 'OPS-001', 'OPS-005'], 'in-progress', `# Initial ${classification} baseline\n\nObserve repository files, available checks and existing decisions. Record a verified baseline, unknowns and validation limits under the selected framework.\n${classification === 'brownfield' ? 'Establish the existing system baseline before ordinary product implementation. No product behavior is asserted by bootstrap.' : 'Establish the initial repository baseline and obtain project decisions before ordinary product implementation.'}\n\nAuthorized surface: observation and bounded onboarding evidence only.\nProduct/application modification, release promotion and changes to the immutable framework are excluded. Human Operator decisions remain reserved.`, ['initial-project-baseline']);
  const generated = new Map([...framework, ...Object.entries({ [POP_PATH]: stringify(pop), [INDEX_PATH]: stringify(index), [ONBOARDING_OVERVIEW]: overview, [ONBOARDING_TASK]: task, ...renderProfiles(params), ...renderBootstrap(params), ...renderAgents(params) }).map(([file, content]) => [file, Buffer.from(content)])]);
  const add = async (file, bytes, allowMerge = false) => {
    if (await pathHasSymlink(root, file)) { block('symlink-path', 'A setup path is unsafe. Next: dev-foundry-claude doctor --verbose'); return; }
    const before = await readContained(root, file);
    plan.preconditions[file] = before === null ? 'absent' : sha256(before);
    if (before?.equals(bytes)) { plan.noop.push(file); return; }
    if (before !== null && !allowMerge) { block('bootstrap-path-collision', 'A required setup file already exists. Next: dev-foundry-claude doctor --verbose'); return; }
    if (before === null) plan.create.push({ path: file, sha256: sha256(bytes), base64: bytes.toString('base64') });
    else plan.merge.push({ path: file, before_sha256: sha256(before), after_sha256: sha256(bytes), diff: makeUnifiedDiff(file, before.toString('utf8'), bytes.toString('utf8')) });
    ops.writes.push({ path: file, content: bytes });
  };
  for (const [file, bytes] of generated) await add(file, bytes);
  const md = await readContained(root, CLAUDE_MD);
  const outside = md?.toString('utf8') ?? '';
  if (outside.includes(BLOCK_BEGIN) || outside.includes(BLOCK_END) || outside.includes('resolve_governed_operation')) block('bootstrap-managed-collision', 'Existing Claude guidance needs review. Next: dev-foundry-claude doctor --verbose');
  else await add(CLAUDE_MD, Buffer.from(`${outside}${outside && !outside.endsWith('\n') ? '\n' : ''}${outside ? '\n' : ''}${renderClaudeBlock(params)}`), true);
  let config;
  const mcp = await readContained(root, MCP_FILE);
  try { config = mcp === null ? {} : JSON.parse(mcp.toString('utf8')); if (!config || Array.isArray(config) || typeof config !== 'object' || (config.mcpServers !== undefined && (!config.mcpServers || typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers))) || config.mcpServers?.[MCP_SERVER_NAME] !== undefined) throw new Error(); }
  catch { block('bootstrap-mcp-collision', 'Existing MCP configuration needs review. Next: dev-foundry-claude doctor --verbose'); }
  if (config && !plan.blockers.some((b) => b.code === 'bootstrap-mcp-collision')) await add(MCP_FILE, Buffer.from(`${JSON.stringify({ ...config, mcpServers: { ...config.mcpServers, [MCP_SERVER_NAME]: renderMcpEntry(params) } }, null, 2)}\n`), true);
  const ignorePath = '.dev-foundry/.gitignore'; const ignoreBytes = await readContained(root, ignorePath);
  const ignore = planIgnore(root, ignoreBytes?.toString('utf8') ?? null);
  if (ignore.state === 'blocked') block('ignore-reincluded', 'Telemetry cannot be safely ignored. Next: dev-foundry-claude doctor --verbose');
  else if (ignore.state === 'needed') await add(ignorePath, Buffer.from(ignore.after), true);
  else { plan.preconditions[ignorePath] = ignoreBytes === null ? 'absent' : sha256(ignoreBytes); plan.noop.push(ignorePath); }
  const touched = git(root, ['status', '--porcelain', '--untracked-files=all', '--', ...ops.writes.map((op) => op.path)]);
  if (touched.status !== 0 || touched.stdout.trim()) block('dirty-working-tree', 'A setup path has pending changes. Next: dev-foundry-claude doctor --verbose');
  plan.create.sort((a, b) => a.path < b.path ? -1 : 1); plan.merge.sort((a, b) => a.path < b.path ? -1 : 1); plan.noop.sort();
  plan.declaredInitialAuthorityPaths = [...generated.keys()].filter((file) => file.startsWith('.dev-foundry/')).sort();
  plan.activation = { overall: 'initial-adoption', next: 'active-on-confirmed-apply' };
  plan.status = 'ready'; return finish();
}
