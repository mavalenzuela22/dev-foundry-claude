import { createBootstrapPlan } from './bootstrap.js';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { evaluateActivation } from './activation.js';
import {
  AGENT_PATHS, BOOTSTRAP_KEY, BOOTSTRAP_PATH, CLAUDE_MD, IGNORE_FILE, INDEX_PATH, MCP_FILE, MCP_SERVER_NAME, POP_PATH,
  PROFILE_PATHS, cutoverState, isObject, parseYamlStrict, pathHasSymlink, readContained, runtimeUpgradeState,
} from './common.js';
import { buildCutoverProposal } from './cutover.js';
import { makeUnifiedDiff } from './diff.js';
import { git, planIgnore } from './ignore.js';
import { inspect, shaOrAbsent } from './inspect.js';
import { canonicalJson, sha256 } from './pin.js';
import {
  BLOCK_BEGIN, BLOCK_END, renderAgents, renderBootstrap, renderClaudeBlock, renderMcpEntry, renderProfiles, templateParams,
} from './render.js';

export const PLAN_FORMAT = 'dev-foundry.adopt-plan.v1';
export const PACKAGE_NAME = '@dev-foundry/claude-adapter';
const blocker = (code, message) => ({ code, message });
const text = (bytes) => (bytes === null ? null : bytes.toString('utf8'));
const GUARANTEED_UNTOUCHED = [
  '.claude/settings*.json', '.dev-foundry/authority-index.yaml', '.dev-foundry/profiles/project-operating-profile.yaml',
  '.dev-foundry/releases/**', 'actor_bindings (every existing role binding)', 'docs/**', 'every existing platform bootstrap file and entry',
  'existing capability profiles and runner files', 'product source',
];

function blockSpan(content) {
  const start = content.indexOf(BLOCK_BEGIN);
  if (start < 0) return null;
  const endMarker = content.indexOf(BLOCK_END, start);
  if (endMarker < 0) return { start, end: -1 };
  const end = endMarker + BLOCK_END.length;
  return { start, end: end + (content.startsWith('\r\n', end) ? 2 : content[end] === '\n' ? 1 : 0) };
}

async function actorProfileId(root, profilePath) {
  const data = parseYamlStrict((await readContained(root, profilePath)) ?? Buffer.alloc(0));
  return data && typeof data.id === 'string' ? data.id : path.posix.basename(profilePath).replace(/\.yaml$/, '');
}

export async function createPlan({ root: rootArgument, project, idPrefix, remove = false, adapter, templatesRoot, managedRefreshHashes = {}, initialBootstrap = false, classification, operator }) {
  const facts = await inspect(rootArgument, { project, idPrefix });
  const plan = {
    planFormat: PLAN_FORMAT,
    mode: remove ? 'remove' : 'adopt',
    status: 'blocked',
    target: { project: facts.project ?? null, idPrefix: facts.prefix ?? null },
    adapter: { name: PACKAGE_NAME, version: adapter.version, payloadRoot: adapter.payloadRoot, expect: adapter.expect },
    framework: { version: facts.pop?.framework?.adopted_version ?? null, selectedAuthorityIndex: facts.pop?.framework?.selected_authority_index ?? null },
    governance: { state: facts.governed ? 'governed' : 'ungoverned' },
    activation: null,
    create: [], merge: [], delete: [], noop: [],
    cutover_proposal: null,
    blockers: [...facts.blockers], warnings: [], preconditions: {}, guaranteed_untouched: [],
  };
  const ops = { writes: [], deletes: [] };
  const finish = () => {
    const bytes = Buffer.from(canonicalJson(plan), 'utf8');
    return { plan, bytes, hash: sha256(bytes), ops };
  };
  if (facts.root && (await cutoverState(facts.root)).blocked) {
    plan.blockers.push(blocker('cutover-in-flight', 'Authority cutover needs explicit recovery. Next: dev-foundry-claude help cutover'));
    return finish();
  }
  if (facts.root && !['none', 'completed', 'rolled-back'].includes((await runtimeUpgradeState(facts.root)).state)) {
    plan.blockers.push(blocker('runtime-upgrade-in-flight', 'A runtime upgrade must be verified or recovered before another managed-file operation.'));
    return finish();
  }
  if (!facts.governed && initialBootstrap && !remove) return createBootstrapPlan({ facts, adapter, project, classification, operator });
  if (!facts.governed) {
    if (!facts.blockers.length || facts.root !== null) plan.status = 'not-governed';
    return finish();
  }
  const root = facts.root;
  const activation = await evaluateActivation(root);
  plan.activation = { overall: activation.overall, roles: activation.roles };
  plan.guaranteed_untouched = [...GUARANTEED_UNTOUCHED, ...facts.bootstraps.map((entry) => entry.path)].sort();
  const sortedUnique = (list) => [...new Set(list)].sort();
  plan.guaranteed_untouched = sortedUnique(plan.guaranteed_untouched);
  if (!remove && activation.overall === 'partial') plan.blockers.push(blocker('partial-claude-binding-state', 'Claude binding state is partial or mixed; authority is ambiguous.'));
  if (plan.blockers.length) return finish();

  const prefix = facts.prefix;
  const executorProfileId = await actorProfileId(root, facts.actorProfiles['implementation-executor']);
  const auditorProfileId = await actorProfileId(root, facts.actorProfiles['governance-auditor']);
  const params = templateParams({
    project: facts.project, prefix, executorProfileId, auditorProfileId, expect: adapter.expect,
    authorProfile: facts.actorProfiles['governance-author'], custodianProfile: facts.actorProfiles['evidence-custodian'],
  });
  const agents = renderAgents(params, templatesRoot);
  const profiles = renderProfiles(params, templatesRoot);
  const bootstrap = renderBootstrap(params, templatesRoot);
  const block = renderClaudeBlock(params, templatesRoot);
  const entry = renderMcpEntry(params, templatesRoot);
  const touched = [];
  const pre = { [POP_PATH]: shaOrAbsent(facts.popBytes), [INDEX_PATH]: shaOrAbsent(facts.indexBytes) };
  for (const bootstrapEntry of facts.bootstraps) pre[bootstrapEntry.path] = shaOrAbsent(bootstrapEntry.bytes);
  const addCreate = (filePath, content) => { plan.create.push({ path: filePath, sha256: sha256(Buffer.from(content, 'utf8')), content }); ops.writes.push({ path: filePath, content }); touched.push(filePath); };
  const addMerge = (filePath, before, after) => {
    plan.merge.push({ path: filePath, before_sha256: sha256(Buffer.from(before, 'utf8')), after_sha256: sha256(Buffer.from(after, 'utf8')), diff: makeUnifiedDiff(filePath, before, after) });
    ops.writes.push({ path: filePath, content: after });
    touched.push(filePath);
  };
  const addDelete = (filePath, bytes) => { plan.delete.push({ path: filePath, sha256: sha256(bytes) }); ops.deletes.push(filePath); touched.push(filePath); };

  // Agent files.
  for (const [filePath, content] of Object.entries(agents)) {
    const existing = await readContained(root, filePath);
    pre[filePath] = shaOrAbsent(existing);
    if (!remove) {
      if (existing === null) addCreate(filePath, content);
      else if (existing.toString('utf8') === content) plan.noop.push(filePath);
      else if (managedRefreshHashes[filePath] === sha256(existing)) addMerge(filePath, existing.toString('utf8'), content);
      else plan.blockers.push(blocker('agent-file-collision', 'An agent file exists and is not byte-identical to the rendered output.'));
    } else if (existing === null) plan.noop.push(filePath);
    else if (existing.toString('utf8') === content) addDelete(filePath, existing);
    else plan.blockers.push(blocker('artifact-modified', 'An adapter-owned agent file was modified.'));
  }

  // CLAUDE.md managed block.
  const mdBytes = await readContained(root, CLAUDE_MD);
  const md = text(mdBytes);
  pre[CLAUDE_MD] = shaOrAbsent(mdBytes);
  const span = md === null ? null : blockSpan(md);
  if (span && (span.end < 0 || md.indexOf(BLOCK_BEGIN, span.start + BLOCK_BEGIN.length) >= 0 || md.indexOf(BLOCK_END, span.end) >= 0)) plan.blockers.push(blocker('managed-block-modified', 'The managed CLAUDE.md block is malformed.'));
  else {
    const outside = md === null ? '' : span ? md.slice(0, span.start) + md.slice(span.end) : md;
    if (outside.includes('resolve_governed_operation')) plan.blockers.push(blocker('claude-md-conflict', 'CLAUDE.md carries governance instructions outside the managed block.'));
    else if (!remove) {
      if (md === null) addCreate(CLAUDE_MD, block);
      else if (span) {
        if (md.slice(span.start, span.end) === block) plan.noop.push(CLAUDE_MD);
        else if (managedRefreshHashes[CLAUDE_MD] === sha256(mdBytes)) addMerge(CLAUDE_MD, md, md.slice(0, span.start) + block + md.slice(span.end));
        else plan.blockers.push(blocker('managed-block-modified', 'The managed CLAUDE.md block was modified.'));
      } else addMerge(CLAUDE_MD, md, `${md}${md.endsWith('\n') ? '' : '\n'}\n${block}`);
    } else if (!span) plan.noop.push(CLAUDE_MD);
    else if (md.slice(span.start, span.end) !== block) plan.blockers.push(blocker('artifact-modified', 'The managed CLAUDE.md block was modified.'));
    else {
      const before = md.slice(0, span.start);
      const stripped = (before.endsWith('\n\n') ? before.slice(0, -1) : before) + md.slice(span.end);
      if (stripped === '') addDelete(CLAUDE_MD, mdBytes);
      else addMerge(CLAUDE_MD, md, stripped);
    }
  }

  // .mcp.json entry and runtime pin.
  const mcpBytes = await readContained(root, MCP_FILE);
  pre[MCP_FILE] = shaOrAbsent(mcpBytes);
  let config = null;
  let mcpUsable = true;
  if (mcpBytes !== null) {
    try { config = JSON.parse(mcpBytes.toString('utf8')); } catch { config = undefined; }
    if (!isObject(config) || (config.mcpServers !== undefined && !isObject(config.mcpServers))) { mcpUsable = false; plan.blockers.push(blocker('invalid-mcp-json', '.mcp.json is not valid JSON of the expected shape.')); }
  }
  if (mcpUsable) {
    const servers = config?.mcpServers ?? {};
    const existingEntry = servers[MCP_SERVER_NAME];
    const adapterShaped = isObject(existingEntry) && existingEntry.command === 'dev-foundry-claude' && Array.isArray(existingEntry.args) && existingEntry.args[0] === 'mcp' && existingEntry.args[1] === '--expect';
    if (existingEntry !== undefined && isDeepStrictEqual(existingEntry, entry)) {
      if (!remove) plan.noop.push(MCP_FILE);
    } else if (existingEntry !== undefined && adapterShaped) {
      plan.blockers.push(blocker('adapter-runtime-mismatch', 'The existing runtime pin does not match the installed adapter.'));
    } else if (existingEntry !== undefined) {
      plan.blockers.push(blocker(remove ? 'artifact-modified' : 'mcp-entry-collision', 'A dev-foundry-governance server entry exists and is not the rendered entry.'));
    }
    if (!plan.blockers.some((item) => item.code === 'adapter-runtime-mismatch' || item.code.startsWith('mcp-entry') || (remove && item.code === 'artifact-modified'))) {
      if (!remove && existingEntry === undefined) {
        const next = { ...(config ?? {}), mcpServers: { ...servers, [MCP_SERVER_NAME]: entry } };
        const after = `${JSON.stringify(next, null, 2)}\n`;
        if (mcpBytes === null) addCreate(MCP_FILE, after); else addMerge(MCP_FILE, mcpBytes.toString('utf8'), after);
      } else if (remove && existingEntry !== undefined) {
        const rest = { ...servers };
        delete rest[MCP_SERVER_NAME];
        const next = { ...config, mcpServers: rest };
        if (Object.keys(rest).length === 0 && Object.keys(next).length === 1) addDelete(MCP_FILE, mcpBytes);
        else addMerge(MCP_FILE, mcpBytes.toString('utf8'), `${JSON.stringify(next, null, 2)}\n`);
      } else if (remove) plan.noop.push(MCP_FILE);
    }
  }

  // Telemetry ignore (forward only; remove leaves the line).
  const ignoreBytes = await readContained(root, IGNORE_FILE);
  pre[IGNORE_FILE] = shaOrAbsent(ignoreBytes);
  if (!remove) {
    const ignore = planIgnore(root, text(ignoreBytes));
    if (ignore.state === 'blocked') plan.blockers.push(blocker('ignore-reincluded', 'An existing ignore rule re-includes the telemetry write path.'));
    else if (ignore.state === 'ok') plan.noop.push(IGNORE_FILE);
    else if (ignoreBytes === null) addCreate(IGNORE_FILE, ignore.after);
    else addMerge(IGNORE_FILE, text(ignoreBytes), ignore.after);
  }

  // Cutover proposal inputs, collisions, and proposal (forward only).
  if (!remove) {
    const newIds = [`${prefix}-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V2`, `${prefix}-GOVERNANCE-AUDITOR-CLAUDE-CODE-V1`, `${prefix}-PLATFORM-BOOTSTRAP-CLAUDE-CODE`];
    const indexBindingIds = { executor: 'implementation-executor-capability-claude-code-v2', auditor: 'governance-auditor-capability-claude-code-v1', bootstrap: 'platform-bootstrap-claude-code' };
    const newPaths = new Set([...Object.values(PROFILE_PATHS), BOOTSTRAP_PATH]);
    const adds = {};
    for (const [filePath, content] of Object.entries({ ...profiles, ...bootstrap })) {
      const existing = await readContained(root, filePath);
      pre[filePath] = shaOrAbsent(existing);
      if (existing === null) adds[filePath] = content;
      else if (existing.toString('utf8') !== content) plan.blockers.push(blocker('artifact-collision', 'A proposed new path collides with an existing different artifact.'));
    }
    try {
      for (const name of await readdir(path.join(root, '.dev-foundry/profiles/capability-profiles'))) {
        if (!name.endsWith('.yaml')) continue;
        const filePath = `.dev-foundry/profiles/capability-profiles/${name}`;
        const data = parseYamlStrict((await readContained(root, filePath)) ?? Buffer.alloc(0));
        if (data && newIds.includes(data.id) && !newPaths.has(filePath)) plan.blockers.push(blocker('id-collision', 'A proposed artifact id collides with an existing different artifact.'));
      }
    } catch { /* no capability profile directory */ }
    for (const existingBootstrap of facts.bootstraps) {
      if (existingBootstrap.data && newIds.includes(existingBootstrap.data.id) && existingBootstrap.path !== BOOTSTRAP_PATH) plan.blockers.push(blocker('id-collision', 'A proposed artifact id collides with an existing different artifact.'));
      if (existingBootstrap.key === BOOTSTRAP_KEY && !(activation.overall === 'active' && existingBootstrap.path === BOOTSTRAP_PATH)) plan.blockers.push(blocker('id-collision', 'A proposed bootstrap key collides with an existing entry.'));
    }
    for (const item of [...(facts.index.routes ?? []), ...(Array.isArray(facts.index.bindings) ? facts.index.bindings : [])]) {
      if (isObject(item) && Object.values(indexBindingIds).includes(item.id) && !newPaths.has(item.path)) plan.blockers.push(blocker('id-collision', 'A proposed Authority Index id collides with an existing entry.'));
    }
    if (plan.blockers.length === 0 && activation.overall === 'prepared') {
      plan.cutover_proposal = buildCutoverProposal(facts, adds, indexBindingIds);
      plan.warnings.push('The cutover proposal has not been verified against the mature runner.');
      plan.warnings.push('Applying the cutover proposal retires the runner binding for this repository.');
    }
  } else if (activation.overall !== 'prepared') {
    plan.warnings.push('Consumer cutover appears applied; its reversal is reported and never applied by the adapter.');
  }

  // Symlink and dirty-tree checks on touched and generated paths.
  for (const filePath of new Set([...Object.keys(agents), CLAUDE_MD, MCP_FILE, IGNORE_FILE, ...(remove ? [] : [...Object.keys(profiles), BOOTSTRAP_PATH])])) {
    if (await pathHasSymlink(root, filePath)) plan.blockers.push(blocker('symlink-path', 'A generated path or parent is a symlink.'));
  }
  if (touched.length) {
    const status = git(root, ['status', '--porcelain', '--untracked-files=all', '--', ...touched]);
    if (status.status !== 0 || status.stdout.trim() !== '') plan.blockers.push(blocker('dirty-working-tree', 'A touched path has uncommitted changes.'));
  }

  const order = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  for (const key of ['create', 'merge', 'delete']) plan[key].sort(order);
  plan.noop.sort();
  const sortedPre = {};
  for (const key of Object.keys(pre).sort()) sortedPre[key] = pre[key];
  plan.preconditions = sortedPre;
  plan.blockers = [...new Map(plan.blockers.map((item) => [`${item.code}:${item.message}`, item])).values()];
  if (plan.blockers.length) {
    ops.writes.length = 0;
    ops.deletes.length = 0;
    plan.cutover_proposal = null;
    plan.status = 'blocked';
  } else plan.status = plan.create.length + plan.merge.length + plan.delete.length === 0 ? 'noop' : 'ready';
  return finish();
}
