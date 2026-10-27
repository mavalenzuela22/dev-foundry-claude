import { createBootstrapPlan } from './bootstrap.js';
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { evaluateActivation } from './activation.js';
import {
  AGENT_PATHS, BOOTSTRAP_KEY, BOOTSTRAP_PATH, CLAUDE_MD, IGNORE_FILE, INDEX_PATH, MCP_FILE, MCP_SERVER_NAME, POP_PATH,
  PROFILE_PATHS, RECONCILIATION_FILE, RECONCILIATION_KEY, cutoverState, isObject, parseYamlStrict, pathHasSymlink, readContained, safeRelativePath,
} from './common.js';
import { buildCutoverProposal } from './cutover.js';
import { makeUnifiedDiff } from './diff.js';
import { git, planIgnore } from './ignore.js';
import { inspect, shaOrAbsent } from './inspect.js';
import { canonicalJson, parseExpect, sha256 } from './pin.js';
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

const lf = (value) => value.replaceAll('\r\n', '\n');
const lines = (value) => value.match(/[^\n]*\n|[^\n]+$/g) ?? [];

// This commitment is carried by the explicitly selected runtime configuration.
// The receipt alone is never an approval, a replacement pin or project authority.
// Like --expect, this detects drift relative to that selection; it is not a
// signature against a local actor replacing the selection and its evidence.
export function surfaceHash(file, bytes) {
  if (bytes === null) return 'absent';
  if (file === MCP_FILE) {
    const config = JSON.parse(bytes.toString('utf8'));
    const entry = config.mcpServers?.[MCP_SERVER_NAME];
    if (isObject(entry?.env)) {
      delete entry.env[RECONCILIATION_KEY];
      if (!Object.keys(entry.env).length) delete entry.env;
    }
    return sha256(canonicalJson(config));
  }
  if (file === CLAUDE_MD) {
    const span = blockSpan(bytes.toString('utf8'));
    return span && span.end >= 0 ? sha256(bytes.toString('utf8').slice(span.start, span.end)) : 'absent';
  }
  return sha256(bytes);
}

// No HEAD/worktree hash here: subsequent product work must not invalidate an
// unchanged governed surface. The apply plan still binds the full Git snapshot.
export async function reconciliationSurface(root, preconditions, writes = [], excluded = new Set()) {
  const state = {};
  const paths = new Set(Object.keys(preconditions).filter((file) => file !== RECONCILIATION_FILE));
  const inventory = async (directory) => {
    if (await pathHasSymlink(root, directory)) throw new Error('unsafe reconciliation inventory');
    let entries;
    try { entries = await readdir(path.join(root, directory), { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      const file = `${directory}/${entry.name}`;
      if (excluded.has(file)) continue;
      if (!safeRelativePath(file) || entry.isSymbolicLink()) throw new Error('unsafe reconciliation inventory');
      if (entry.isDirectory()) await inventory(file);
      else if (entry.isFile()) paths.add(file);
      else throw new Error('unsafe reconciliation inventory');
    }
  };
  await inventory('.claude/agents');
  await inventory('.dev-foundry/profiles/capability-profiles');
  for (const file of [...paths].sort()) {
    if (!safeRelativePath(file) || await pathHasSymlink(root, file)) throw new Error('unsafe reconciliation path');
    try { if (!(await lstat(path.join(root, file))).isFile()) throw new Error('unsafe reconciliation path'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const write = writes.find((item) => item.path === file);
    state[file] = surfaceHash(file, write ? Buffer.from(write.content) : await readContained(root, file));
  }
  return { files: state, cutover: await cutoverState(root) };
}

async function reconciliationReceipt(root, adapter, facts) {
  const bytes = await readContained(root, RECONCILIATION_FILE);
  let config;
  try { config = JSON.parse((await readContained(root, MCP_FILE))?.toString('utf8') ?? '{}'); }
  catch (error) { if (bytes === null) return null; throw error; }
  const anchor = config.mcpServers?.[MCP_SERVER_NAME]?.env?.[RECONCILIATION_KEY];
  if (await pathHasSymlink(root, RECONCILIATION_FILE)) throw new Error();
  try { if (!(await lstat(path.join(root, RECONCILIATION_FILE))).isFile()) throw new Error(); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (bytes === null && anchor === undefined) return null;
  const receipt = JSON.parse(bytes?.toString('utf8'));
  const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const keys = ['format', 'repository', 'project', 'source', 'target', 'previousPlanSha256', 'resolutionSha256', 'files', 'state'];
  if (!isObject(receipt) || Object.keys(receipt).length !== keys.length || !keys.every((key) => Object.hasOwn(receipt, key)) ||
      receipt.format !== 'dev-foundry.upgrade-reconciliation.v1' || !bytes.equals(Buffer.from(canonicalJson(receipt))) ||
      !hash(anchor) || sha256(bytes) !== anchor || receipt.repository !== root ||
      !isDeepStrictEqual(receipt.project, { name: facts.project, idPrefix: facts.prefix }) ||
      receipt.target !== adapter.expect || config.mcpServers?.[MCP_SERVER_NAME]?.args?.[2] !== receipt.target ||
      !hash(receipt.previousPlanSha256) || (receipt.resolutionSha256 !== null && !hash(receipt.resolutionSha256)) ||
      !Array.isArray(receipt.files) || !receipt.files.length || !isObject(receipt.state)) throw new Error();
  // Closed path set; persisted records can describe only previously reconciled
  // surfaces, never extend the configured authority/write boundary.
  const allowed = new Set([...Object.values(AGENT_PATHS), CLAUDE_MD, ...Object.values(PROFILE_PATHS), BOOTSTRAP_PATH]);
  const seen = new Set();
  parseExpect(receipt.source);
  parseExpect(receipt.target);
  for (const record of receipt.files) {
    const recordKeys = ['path', 'scope', 'classification', 'before_sha256', 'base_sha256', 'current_sha256', 'target_sha256', 'after_sha256'];
    const scope = record?.path === CLAUDE_MD ? 'managed-block' : Object.values(AGENT_PATHS).includes(record?.path) ? 'file' : 'configured-file';
    if (!isObject(record) || Object.keys(record).length !== recordKeys.length || !recordKeys.every((key) => Object.hasOwn(record, key)) ||
        !allowed.has(record.path) || seen.has(record.path) || record.scope !== scope ||
        !['base_sha256', 'current_sha256', 'target_sha256', 'after_sha256', 'before_sha256'].every((key) => hash(record[key])) ||
        !['operator-resolved', 'local-edits-preserved', 'already-target', 'line-endings-only'].includes(record.classification)) throw new Error();
    seen.add(record.path);
  }
  return { receipt, sha256: anchor };
}

// Reuse the existing deterministic line diff. Coordinates refer to the verified
// base, so only disjoint edits can be combined; boundary insertions conflict.
function managedEdits(base, value) {
  const target = lines(value);
  return [...makeUnifiedDiff('managed', base, value, 0).matchAll(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/gm)].map((match) => {
    const count = Number(match[2]);
    const start = Number(match[1]) - (count ? 1 : 0);
    const added = Number(match[4]);
    const from = Number(match[3]) - (added ? 1 : 0);
    return { start, end: start + count, replacement: target.slice(from, from + added).join('') };
  });
}

function reconcileManaged(base, current, target, owned) {
  if (!owned) return { classification: 'ownership-unverified', content: null };
  if (current === base) return { classification: 'unmodified', content: target };
  if (lf(current) === lf(base)) return { classification: 'line-endings-only', content: target };
  if (lf(current) === lf(target)) return { classification: 'already-target', content: current };
  if (lf(base) === lf(target)) return { classification: 'local-edits-preserved', content: current };
  const localEdits = managedEdits(lf(base), lf(current));
  const targetEdits = managedEdits(lf(base), lf(target));
  const edits = [...localEdits];
  for (const edit of targetEdits) {
    if (localEdits.some((local) => isDeepStrictEqual(local, edit))) continue;
    const overlap = localEdits.some((local) =>
      local.start === local.end || edit.start === edit.end
        ? local.start <= edit.end && edit.start <= local.end
        : local.start < edit.end && edit.start < local.end);
    if (overlap) return { classification: 'conflict', content: null };
    edits.push(edit);
  }
  const result = lines(lf(base));
  for (const edit of edits.sort((a, b) => b.start - a.start)) result.splice(edit.start, edit.end - edit.start, edit.replacement);
  // Preserve a consistent local CRLF representation, including semantic edits.
  const merged = result.join('');
  const crlf = current.includes('\r\n') && !current.replaceAll('\r\n', '').includes('\n');
  return { classification: 'local-edits-preserved', content: crlf ? merged.replaceAll('\n', '\r\n') : merged };
}

function agentName(content) {
  const header = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(lf(content));
  return header ? parseYamlStrict(Buffer.from(header[1]))?.name : undefined;
}

// A dirty exception is per tracked regular agent, never a worktree-wide waiver.
// Recheck the bytes here; apply also replans and checks the full Git snapshot.
export async function hasUnresolvedDirtyPaths(root, paths, reconciliation = []) {
  for (const file of new Set(paths)) {
    const status = git(root, ['status', '--porcelain', '--untracked-files=all', '--', file]);
    if (status.status !== 0) return true;
    const record = Object.values(AGENT_PATHS).includes(file)
      ? reconciliation.find((item) => item.path === file && item.classification === 'operator-resolved') : undefined;
    // Ignored untracked agents can be invisible to status; a resolution still
    // needs a tracked predecessor even when status emits no line.
    if (!status.stdout.trim() && !record) continue;
    const current = await readContained(root, file);
    const tracked = git(root, ['ls-tree', 'HEAD', '--', file]);
    const prior = git(root, ['show', `HEAD:${file}`]);
    const changes = status.stdout.split('\n').filter(Boolean);
    if (!Object.values(AGENT_PATHS).includes(file) || !record || current === null ||
        await pathHasSymlink(root, file) || sha256(current) !== record.before_sha256 || sha256(current) !== record.current_sha256 ||
        tracked.status !== 0 || !/^100(?:644|755) blob /.test(tracked.stdout) ||
        prior.status !== 0 || agentName(prior.stdout) !== agentName(current.toString('utf8')) ||
        changes.length > 1 || (changes.length === 1 && ![' M', 'M ', 'MM'].includes(changes[0].slice(0, 2)))) return true;
  }
  return false;
}

async function actorProfileId(root, profilePath) {
  const data = parseYamlStrict((await readContained(root, profilePath)) ?? Buffer.alloc(0));
  return data && typeof data.id === 'string' ? data.id : path.posix.basename(profilePath).replace(/\.yaml$/, '');
}

export async function createPlan({ root: rootArgument, project, idPrefix, remove = false, adapter, templatesRoot, managedBaseTemplatesRoot, managedResolutions = [], initialBootstrap = false, classification, operator }) {
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
  const bootstrap = renderBootstrap(params, templatesRoot, { legacyV2: facts.pop.schema_version === 'dev-foundry.project-operating-profile.v2' });
  const block = renderClaudeBlock(params, templatesRoot);
  let evidence;
  try { evidence = await reconciliationReceipt(root, adapter, facts); }
  catch {
    plan.blockers.push(blocker('upgrade-reconciliation-invalid', 'Upgrade reconciliation evidence or its selected runtime commitment is missing, changed or unsafe.'));
    return finish();
  }
  const accepted = (file, current, target) => !remove && !managedBaseTemplatesRoot && evidence?.receipt.files.some((record) =>
    record.path === file && record.after_sha256 === sha256(current) && record.target_sha256 === sha256(target));
  // Only the upgrade planner supplies this root, after verifying the exact pin.
  const baseAgents = managedBaseTemplatesRoot ? renderAgents(params, managedBaseTemplatesRoot) : null;
  const baseBlock = managedBaseTemplatesRoot ? renderClaudeBlock(params, managedBaseTemplatesRoot) : null;
  const baseConfigured = managedBaseTemplatesRoot ? {
    ...renderProfiles(params, managedBaseTemplatesRoot),
    ...renderBootstrap(params, managedBaseTemplatesRoot, { legacyV2: facts.pop.schema_version === 'dev-foundry.project-operating-profile.v2' }),
  } : null;
  if (baseAgents) plan.reconciliation = [];
  const entry = renderMcpEntry(params, templatesRoot);
  const touched = [];
  const pre = { [POP_PATH]: shaOrAbsent(facts.popBytes), [INDEX_PATH]: shaOrAbsent(facts.indexBytes) };
  for (const bootstrapEntry of facts.bootstraps) pre[bootstrapEntry.path] = shaOrAbsent(bootstrapEntry.bytes);
  const configuredPaths = [POP_PATH, INDEX_PATH, facts.pop.framework.selected_authority_index, facts.pop.framework.selected_manifest,
    ...Object.values(facts.actorProfiles), ...facts.bootstraps.map((item) => item.path),
    ...Object.values(facts.pop.actor_bindings).flatMap((item) => [item?.profile, ...(item?.capability_profiles ?? item?.selection?.required_capabilities ?? [])]),
    ...[...(facts.index.routes ?? []), ...(facts.index.bindings ?? [])].filter((item) => item?.authority_class === 'configured').map((item) => item.path),
  ].filter((item) => typeof item === 'string').map((item) => path.resolve(root, item));
  const authorityPaths = new Set([...configuredPaths, ...await Promise.all(configuredPaths.map((file) => realpath(file).catch(() => file)))]);
  if (baseAgents || evidence) for (const file of new Set(configuredPaths)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (relative && relative !== '..' && !relative.startsWith('../') && !path.isAbsolute(relative)) {
      pre[relative] = shaOrAbsent(await readContained(root, relative));
    } else plan.blockers.push(blocker('reconciliation-authority-unsafe', 'Reconciliation requires every configured authority path to remain inside the project.'));
  }
  const addCreate = (filePath, content) => { plan.create.push({ path: filePath, sha256: sha256(Buffer.from(content, 'utf8')), content }); ops.writes.push({ path: filePath, content }); touched.push(filePath); };
  const addMerge = (filePath, before, after) => {
    plan.merge.push({ path: filePath, before_sha256: sha256(Buffer.from(before, 'utf8')), after_sha256: sha256(Buffer.from(after, 'utf8')), diff: makeUnifiedDiff(filePath, before.toString('utf8'), after.toString('utf8')) });
    ops.writes.push({ path: filePath, content: after });
    touched.push(filePath);
  };
  const addDelete = (filePath, bytes) => { plan.delete.push({ path: filePath, sha256: sha256(bytes) }); ops.deletes.push(filePath); touched.push(filePath); };
  const reconcile = (filePath, base, current, target, owned, configured = false) => {
    const proven = owned && (configured || !authorityPaths.has(path.resolve(root, filePath))) && !current.includes('\u0000') && !current.includes('\ufffd');
    // Configured YAML is never automatically merged. Only verified source or
    // target semantics are decidable here; novel project policy stays blocked.
    const baseData = configured ? parseYamlStrict(Buffer.from(base)) : null;
    const targetData = configured ? parseYamlStrict(Buffer.from(target)) : null;
    const knownSemantics = (content) => {
      const data = parseYamlStrict(Buffer.from(content));
      return data && [baseData, targetData].some((expected) => isDeepStrictEqual(data, expected));
    };
    let result = configured ? { classification: proven ? 'conflict' : 'ownership-unverified', content: null } : reconcileManaged(base, current, target, proven);
    if (!configured && filePath !== CLAUDE_MD && result.content !== null && agentName(result.content) !== agentName(base)) {
      result = { classification: 'conflict', content: null };
    }
    const decision = managedResolutions.find((item) => item.path === filePath);
    if (decision) {
      const resolved = decision.resolved_content;
      const span = blockSpan(resolved);
      const identity = configured ? knownSemantics(resolved) : filePath === CLAUDE_MD
        ? span?.start === 0 && span.end === resolved.length && resolved.indexOf(BLOCK_BEGIN, BLOCK_BEGIN.length) < 0 &&
          resolved.indexOf(BLOCK_END, resolved.indexOf(BLOCK_END) + BLOCK_END.length) < 0 &&
          lf(resolved).split('\n')[0] === lf(base).split('\n')[0]
        : agentName(resolved) === agentName(base);
      if (proven && result.classification === 'conflict' && identity &&
          decision.before_sha256 === pre[filePath] && decision.base_sha256 === sha256(base) &&
          decision.current_sha256 === sha256(current) && decision.target_sha256 === sha256(target) &&
          decision.resolved_sha256 === sha256(resolved)) result = { classification: 'operator-resolved', content: resolved };
      else {
        plan.blockers.push(blocker('managed-resolution-mismatch', `${filePath}: resolution does not match a proven managed conflict, identity and exact fingerprints.`));
        result = { classification: result.classification, content: null };
      }
    }
    plan.reconciliation.push({
      path: filePath, scope: configured ? 'configured-file' : filePath === CLAUDE_MD ? 'managed-block' : 'file', classification: result.classification,
      before_sha256: pre[filePath],
      base_sha256: sha256(base), current_sha256: sha256(current), target_sha256: sha256(target),
      after_sha256: result.content === null ? null : sha256(result.content),
      ...(configured && result.content !== null ? {
        current_semantics_preserved: isDeepStrictEqual(parseYamlStrict(Buffer.from(current)), parseYamlStrict(Buffer.from(result.content))),
      } : {}),
      base_current_diff: makeUnifiedDiff(filePath, base, current), base_target_diff: makeUnifiedDiff(filePath, base, target),
      current_target_diff: makeUnifiedDiff(filePath, current, target),
      ...(decision && result.content !== null ? { current_after_diff: makeUnifiedDiff(filePath, current, result.content), target_after_diff: makeUnifiedDiff(filePath, target, result.content) } : {}),
    });
    if (result.content === null) plan.blockers.push(blocker('managed-reconciliation-unresolved', `${filePath}: ${result.classification}; review the base/current/target diffs and resolve explicitly before replanning.`));
    return result.content;
  };

  // Agent files.
  for (const [filePath, content] of Object.entries(agents)) {
    const existing = await readContained(root, filePath);
    pre[filePath] = shaOrAbsent(existing);
    if (!remove) {
      if (baseAgents && existing !== null) {
        const current = existing.toString('utf8');
        const base = baseAgents[filePath];
        const name = agentName(base);
        const after = reconcile(filePath, base, current, content, typeof name === 'string' && agentName(current) === name && agentName(content) === name);
        if (after === current) plan.noop.push(filePath);
        else if (after !== null) addMerge(filePath, current, after);
      } else if (baseAgents) reconcile(filePath, baseAgents[filePath], '', content, false);
      else if (existing === null) addCreate(filePath, content);
      else if (existing.toString('utf8') === content ||
          (accepted(filePath, existing, content) && agentName(existing.toString('utf8')) === agentName(content))) plan.noop.push(filePath);
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
  if (span && (span.end < 0 || md.indexOf(BLOCK_END) < span.start || md.indexOf(BLOCK_BEGIN, span.start + BLOCK_BEGIN.length) >= 0 || md.indexOf(BLOCK_END, span.end) >= 0)) {
    plan.blockers.push(blocker('managed-block-modified', 'The managed CLAUDE.md block is malformed.'));
    if (baseBlock !== null) reconcile(CLAUDE_MD, baseBlock, md.slice(span.start), block, false);
  }
  else {
    const outside = md === null ? '' : span ? md.slice(0, span.start) + md.slice(span.end) : md;
    if (outside.includes('resolve_governed_operation')) plan.blockers.push(blocker('claude-md-conflict', 'CLAUDE.md carries governance instructions outside the managed block.'));
    else if (!remove) {
      if (baseBlock !== null && !span) reconcile(CLAUDE_MD, baseBlock, md ?? '', block, false);
      else if (md === null) addCreate(CLAUDE_MD, block);
      else if (span) {
        if (baseBlock !== null) {
          const current = md.slice(span.start, span.end);
          const firstLine = lf(current).split('\n')[0];
          const after = reconcile(CLAUDE_MD, baseBlock, current, block,
            firstLine === lf(baseBlock).split('\n')[0] || firstLine === lf(block).split('\n')[0]);
          if (after === current) plan.noop.push(CLAUDE_MD);
          else if (after !== null) {
            // Only the managed span is UTF-8 text. Preserve every outside byte,
            // including invalid UTF-8 and mixed line endings, without decoding it.
            const start = mdBytes.indexOf(BLOCK_BEGIN);
            let end = mdBytes.indexOf(BLOCK_END, start) + Buffer.byteLength(BLOCK_END);
            if (mdBytes[end] === 13 && mdBytes[end + 1] === 10) end += 2;
            else if (mdBytes[end] === 10) end += 1;
            addMerge(CLAUDE_MD, mdBytes, Buffer.concat([mdBytes.subarray(0, start), Buffer.from(after), mdBytes.subarray(end)]));
          }
        } else if (md.slice(span.start, span.end) === block || accepted(CLAUDE_MD, md.slice(span.start, span.end), block)) plan.noop.push(CLAUDE_MD);
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
    const comparableEntry = structuredClone(existingEntry);
    if (evidence && isObject(comparableEntry?.env)) {
      delete comparableEntry.env[RECONCILIATION_KEY];
      if (!Object.keys(comparableEntry.env).length) delete comparableEntry.env;
    }
    const adapterShaped = isObject(existingEntry) && existingEntry.command === 'dev-foundry-claude' && Array.isArray(existingEntry.args) && existingEntry.args[0] === 'mcp' && existingEntry.args[1] === '--expect';
    if (existingEntry !== undefined && isDeepStrictEqual(comparableEntry, entry)) {
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
      else if (existing.toString('utf8') !== content) {
        if (!baseConfigured && accepted(filePath, existing, content)) plan.noop.push(filePath);
        else if (!baseConfigured) plan.blockers.push(blocker('artifact-collision', `${filePath}: a proposed path collides with an existing different artifact.`));
        else {
          const base = baseConfigured[filePath];
          const current = existing.toString('utf8');
          const baseData = parseYamlStrict(Buffer.from(base));
          const targetData = parseYamlStrict(Buffer.from(content));
          const currentData = parseYamlStrict(existing);
          const stable = baseData && targetData && baseData.id === targetData.id && baseData.schema_version === targetData.schema_version;
          const owned = stable && existing.equals(Buffer.from(current)) &&
            [baseData, targetData].some((expected) => isDeepStrictEqual(currentData, expected));
          if (!owned) plan.blockers.push(blocker('configured-resolution-unverified', `${filePath}: current YAML must have the stable source/target id, schema and bindings and exactly verified source or target semantics; novel configured policy requires a separately governed semantic migration.`));
          const after = reconcile(filePath, base, current, content, owned, true);
          if (after === current) plan.noop.push(filePath);
          else if (after !== null) addMerge(filePath, current, after);
        }
      }
    }
    try {
      for (const name of await readdir(path.join(root, '.dev-foundry/profiles/capability-profiles'))) {
        if (!name.endsWith('.yaml')) continue;
        const filePath = `.dev-foundry/profiles/capability-profiles/${name}`;
        const bytes = await readContained(root, filePath);
        if (baseConfigured || evidence) pre[filePath] = shaOrAbsent(bytes);
        const data = parseYamlStrict(bytes ?? Buffer.alloc(0));
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
    if (baseConfigured) {
      const routes = [...(facts.index.routes ?? []), ...(facts.index.bindings ?? [])];
      for (const filePath of newPaths) {
        const expectedId = filePath === BOOTSTRAP_PATH ? indexBindingIds.bootstrap : filePath === PROFILE_PATHS.executor ? indexBindingIds.executor : indexBindingIds.auditor;
        const atPath = routes.filter((item) => item?.path === filePath);
        if (atPath.length > 1 || atPath.some((item) => item.id !== expectedId || item.authority_class !== 'configured' ||
            (item.kind !== undefined && item.kind !== (filePath === BOOTSTRAP_PATH ? 'platform-bootstrap' : 'capability-profile')))) {
          plan.blockers.push(blocker('configured-authority-collision', `${filePath}: configured authority routing is ambiguous or unexpected.`));
        }
        for (const item of routes) {
          if (typeof item?.path === 'string' && item.path !== filePath &&
              await realpath(path.resolve(root, item.path)).catch(() => null) === path.resolve(root, filePath)) {
            plan.blockers.push(blocker('configured-authority-collision', `${filePath}: another authority route aliases this configured artifact.`));
          }
        }
      }
      // Keep preservation claims exact when an explicit decision writes YAML.
      if (ops.writes.some((item) => newPaths.has(item.path))) {
        plan.guaranteed_untouched = plan.guaranteed_untouched.filter((item) =>
          !newPaths.has(item) && item !== 'existing capability profiles and runner files' && item !== 'every existing platform bootstrap file and entry');
      }
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
  const checkedPaths = [...touched, ...(plan.reconciliation ?? []).filter((item) => item.classification === 'operator-resolved' && Object.values(AGENT_PATHS).includes(item.path)).map((item) => item.path)];
  if (await hasUnresolvedDirtyPaths(root, checkedPaths, plan.reconciliation)) plan.blockers.push(blocker('dirty-working-tree', 'A touched path has uncommitted changes without an exact tracked managed-agent resolution.'));

  if (evidence) {
    try {
      // The receipt proves the transition, not a freeze of later project work.
      // Keep runtime/framework bindings protected even when stored under docs/;
      // inspect and the resolver validate the current project Authority Index.
      const protectedPaths = new Set([
        POP_PATH, MCP_FILE, CLAUDE_MD, IGNORE_FILE, BOOTSTRAP_PATH,
        ...Object.values(AGENT_PATHS), ...Object.values(PROFILE_PATHS),
        facts.pop.framework.selected_authority_index, facts.pop.framework.selected_manifest,
        ...Object.values(facts.actorProfiles), ...facts.bootstraps.map((item) => item.path),
        ...Object.values(facts.pop.actor_bindings).flatMap((item) => [item?.profile, ...(item?.capability_profiles ?? item?.selection?.required_capabilities ?? [])]),
      ].filter((file) => typeof file === 'string').map((file) => path.relative(root, path.resolve(root, file)).split(path.sep).join('/')));
      const protectedState = (state) => ({
        ...state,
        files: Object.fromEntries(Object.entries(state.files).filter(([file]) =>
          protectedPaths.has(file) || file.startsWith('.claude/agents/') || file.startsWith('.dev-foundry/profiles/capability-profiles/'))),
      });
      if (!isDeepStrictEqual(protectedState(evidence.receipt.state), protectedState(await reconciliationSurface(root, pre)))) throw new Error();
      plan.reconciliationEvidence = { path: RECONCILIATION_FILE, sha256: evidence.sha256, previousPlanSha256: evidence.receipt.previousPlanSha256 };
      pre[RECONCILIATION_FILE] = evidence.sha256;
    } catch {
      plan.blockers.push(blocker('upgrade-reconciliation-stale', 'The managed surface, configured authority, bindings or cutover state changed after the selected upgrade.'));
    }
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
