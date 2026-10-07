import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { parse } from 'yaml';
import { createPlan } from '../../src/adopt/plan.js';
import { applyPlan } from '../../src/adopt/apply.js';
import { frameworkFiles, ONBOARDING_TASK, ONBOARDING_OVERVIEW } from '../../src/adopt/bootstrap.js';
import { canonicalJson, sha256 } from '../../src/adopt/pin.js';
import { resolveGovernedOperation } from '../../src/governance-mcp/resolver.js';
import { createSessionGuard } from '../../src/governance-mcp/session.js';
import { currentMigrationMaterial, migrationRequiresGovernedSession } from '../../src/adopt/migration.js';
import { consumerCommand, inspectConsumer } from '../../src/consumer/command.js';
import { diffTrees, gitIn, listTree, makeConsumer, makePresentationPackage, repoRoot } from './fixture.js';
const presentationPackage = await makePresentationPackage();
after(presentationPackage.cleanup);
const adapter = { version: '1.4.0', payloadRoot: 'f'.repeat(64), expect: `1.4.0:sha256:${'f'.repeat(64)}` };
const planFor = (c, inputs = {}) => createPlan({ root: c.root, adapter, initialBootstrap: true, ...inputs });
const apply = (c, result) => applyPlan({ root: c.root, adapter, planBytes: result.bytes, planSha256: result.hash });
async function empty(t, configured = true) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zero-governed-')); t.after(() => rm(root, { recursive: true, force: true }));
  gitIn(root, 'init', '-q');
  if (configured) gitIn(root, 'config', 'user.name', 'Human Owner');
  const put = async (file, bytes) => { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), bytes); };
  return { root, put, read: (file) => readFile(path.join(root, file), 'utf8') };
}

test('framework bundle exactly equals producer immutable release file set and bytes', async () => {
  const files = await frameworkFiles();
  const before = await listTree(path.join(repoRoot, '.dev-foundry/releases/2.1.0'));
  assert.deepEqual([...files.keys()].map((file) => file.replace('.dev-foundry/releases/2.1.0/', '')), [...before.keys()].sort());
  for (const [file, bytes] of files) assert.deepEqual(bytes, await readFile(path.join(repoRoot, file)));
});

test('zero-to-governed preview/apply: inferred greenfield and explicit brownfield; resolver usable, no application mutations, idempotent', async (t) => {
  for (const brownfield of [false, true]) await t.test(brownfield ? 'brownfield' : 'greenfield', async (t) => {
    const c = brownfield ? await makeConsumer({ governed: false }) : await empty(t);
    if (brownfield) t.after(c.cleanup);
    const inputs = brownfield ? { project: 'pago-shaped', classification: 'brownfield', operator: 'Explicit Human' } : {};
    const before = await listTree(c.root);
    const preview = await planFor(c, inputs);
    assert.equal(preview.plan.status, 'ready', JSON.stringify(preview.plan.blockers));
    assert.deepEqual(preview.bytes, (await planFor(c, inputs)).bytes);
    assert.equal(preview.plan.bootstrap.classification, brownfield ? 'brownfield' : 'greenfield');
    assert.equal(preview.plan.bootstrap.operator, brownfield ? 'Explicit Human' : 'Human Owner');
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
    const output = [];
    await consumerCommand({ command: 'setup', cwd: c.root, packageRoot: presentationPackage.root, getAdapter: () => adapter, executableAvailable: () => true, output: (line) => output.push(line), argv: Object.entries(inputs).flatMap(([key,value]) => [`--${key}`, value]) });
    assert.match(output.join('\n'), /Human Operator:/); assert.match(output.join('\n'), /Selected framework: DEV FOUNDRY 2.1.0/); assert.match(output.join('\n'), /Application files affected: 0/);
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
    await assert.rejects(apply(c, { ...preview, hash: '0'.repeat(64) }), { code: 'plan-hash-mismatch' });
    await apply(c, preview);
    const after = await listTree(c.root);
    assert.deepEqual(diffTrees(before, after), [...preview.plan.create, ...preview.plan.merge].map((entry) => entry.path).sort());
    for (const [file, hash] of before) if (!['CLAUDE.md', '.mcp.json', '.dev-foundry/.gitignore'].includes(file)) assert.equal(after.get(file), hash, file);
    assert.ok(preview.plan.declaredInitialAuthorityPaths.includes(ONBOARDING_TASK));
    const pop = parse(await c.read('.dev-foundry/profiles/project-operating-profile.yaml'));
    assert.equal(pop.operator.identity, preview.plan.bootstrap.operator);
    assert.equal(pop.repository.classification, preview.plan.bootstrap.classification);
    const index = parse(await c.read('.dev-foundry/authority-index.yaml'));
    assert.ok(index.routes.some((route) => route.path === ONBOARDING_TASK)); assert.ok(index.routes.some((route) => route.path === ONBOARDING_OVERVIEW));
    assert.match(await c.read(ONBOARDING_TASK), /observation and bounded onboarding evidence only/);
    if (brownfield) assert.match(await c.read(ONBOARDING_TASK), /before ordinary product implementation/);
    assert.equal((await resolveGovernedOperation({ requestedAction: 'inspect', targetProject: pop.repository.name, taskId: 'TSK-001' }, { projectRoot: c.root })).ok, true);
    assert.equal((await resolveGovernedOperation({ requestedAction: 'author', targetProject: pop.repository.name, boundaryId: 'initial-observation' }, { projectRoot: c.root })).ok, true);
    assert.equal((await inspectConsumer({ root: c.root, adapter, packageRoot: presentationPackage.root, executableAvailable: () => true })).readyToWork, true);
    assert.equal((await planFor(c)).plan.status, 'noop');
    assert.deepEqual(diffTrees(after, await listTree(c.root)), []);
  });
});

test('bootstrap missing human input, partial authority, collision, symlink, dirty touched path and stale/forged plan refuse without writes', async (t) => {
  const missing = await empty(t, false); const denied = await planFor(missing);
  assert.equal(denied.plan.status, 'blocked'); assert.match(denied.plan.blockers[0].message, /setup --operator/);
  const explicit = await planFor(missing, { project: 'chosen', classification: 'greenfield', operator: 'Human' }); assert.equal(explicit.plan.status, 'ready');
  for (const [name, mutate] of [
    ['partial', (c) => c.put('.dev-foundry/profiles/project-operating-profile.yaml', 'invalid: true')],
    ['symlink', async (c) => { await mkdir(path.join(c.root, '.claude')); await symlink(os.tmpdir(), path.join(c.root, '.claude/agents'), 'dir'); }],
    ['collision', (c) => c.put('.claude/agents/dev-foundry-executor.md', 'custom instructions')],
    ['dirty', (c) => c.put('CLAUDE.md', 'pending project notes')],
  ]) await t.test(name, async (t) => {
    const c = await empty(t); const planned = await planFor(c); await mutate(c);
    const result = await planFor(c); assert.equal(result.plan.status, 'blocked'); assert.deepEqual(result.ops.writes, []);
    await assert.rejects(apply(c, planned), { code: 'plan-stale' });
  });
  const c = await empty(t); const planned = await planFor(c);
  const forged = structuredClone(planned.plan); forged.create.push({ path: 'src/application.js', content: 'bad' });
  const bytes = Buffer.from(canonicalJson(forged)); await assert.rejects(apply(c, { bytes, hash: sha256(bytes) }), { code: 'plan-stale' });
  await apply(missing, explicit); assert.equal((await planFor(missing)).plan.status, 'noop');
});

test('startup projection tolerates normal task/index authoring; runtime cutovers stale permanently and require restart', async (t) => {
  const c = await empty(t); await apply(c, await planFor(c));
  const check = await createSessionGuard(c.root, adapter.expect);
  assert.equal(await check(), null);
  await c.put(ONBOARDING_TASK, `${await c.read(ONBOARDING_TASK)}\nObserved baseline note.\n`);
  const index = parse(await c.read('.dev-foundry/authority-index.yaml'));
  index.routes.push({ id: 'new-task', path: '.dev-foundry/onboarding/TSK-002.md', authority_class: 'task', governs: ['new-boundary'], section_id: null });
  await c.put('.dev-foundry/authority-index.yaml', (await import('yaml')).stringify(index));
  assert.equal(await check(), null);
  for (const [name, mutate] of [
    ['pin', async () => { const mcp = JSON.parse(await c.read('.mcp.json')); mcp.mcpServers['dev-foundry-governance'].args[2] = `1.4.1:sha256:${'a'.repeat(64)}`; await c.put('.mcp.json', JSON.stringify(mcp)); }],
    ['framework', async () => { const pop = parse(await c.read('.dev-foundry/profiles/project-operating-profile.yaml')); pop.framework.adopted_version = '2.2.0'; await c.put('.dev-foundry/profiles/project-operating-profile.yaml', (await import('yaml')).stringify(pop)); }],
    ['binding', async () => { const pop = parse(await c.read('.dev-foundry/profiles/project-operating-profile.yaml')); pop.actor_bindings['governance-author'].implementation.identity = 'successor-main-agent'; await c.put('.dev-foundry/profiles/project-operating-profile.yaml', (await import('yaml')).stringify(pop)); }],
    ['capability', async () => { const file = '.dev-foundry/profiles/capability-profiles/implementation-executor-claude-code-v2.yaml'; const data = parse(await c.read(file)); data.limits.implementation_identity = 'successor-executor'; await c.put(file, (await import('yaml')).stringify(data)); }],
    ['bootstrap', async () => { const file = '.dev-foundry/platform-bootstrap-claude-code.yaml'; const data = parse(await c.read(file)); data.artifact_version = 'successor'; await c.put(file, (await import('yaml')).stringify(data)); }],
  ]) await t.test(name, async () => {
    const current = await listTree(c.root); const originals = new Map();
    for (const file of current.keys()) if (file.endsWith('.yaml') || file === '.mcp.json') originals.set(file, await c.read(file));
    const guard = await createSessionGuard(c.root); assert.equal(await guard(), null); await mutate();
    const denied = await guard(); assert.equal(denied.errorCode, 'STALE_SESSION'); assert.equal(denied.nextAction, 'dev-foundry-claude start');
    for (const [file, bytes] of originals) await c.put(file, bytes);
    assert.equal((await guard()).errorCode, 'STALE_SESSION');
    assert.equal(await (await createSessionGuard(c.root))(), null);
  });
});


test('setup --apply keeps explicit choices in the preview next action and confirms initial authority', async (t) => {
  const c = await empty(t, false);
  const inputs = ['--project', 'explicit-project', '--classification', 'greenfield', '--operator', 'Human Operator'];
  const output = [];
  const invoke = (argv) => consumerCommand({ command: 'setup', argv, cwd: c.root, packageRoot: presentationPackage.root, getAdapter: () => adapter, executableAvailable: () => true, output: (line) => output.push(line) });
  await invoke([...inputs, '--json']);
  const next = JSON.parse(output.pop()).nextAction;
  assert.match(next, /setup --yes --project/); assert.match(next, /explicit-project/); assert.match(next, /greenfield/); assert.match(next, /Human Operator/);
  await invoke([...inputs, '--apply', '--json']);
  const applied = JSON.parse(output.pop()); assert.equal(applied.readyToWork, true); assert.equal(applied.nextAction, 'dev-foundry-claude start');
  assert.equal(parse(await c.read('.dev-foundry/profiles/project-operating-profile.yaml')).operator.identity, 'Human Operator');
});


test('target migration material routes semantic/configured-authority and framework adoption deltas to source governance', async () => {
  const { material } = await currentMigrationMaterial();
  assert.equal(migrationRequiresGovernedSession(material, '2.1.0'), false);
  for (const target of [
    { ...material, frameworkVersion: '2.2.0' },
    { ...material, selfUpdate: { ...material.selfUpdate, requiresGovernedReconciliation: true } },
    { ...material, selfUpdate: { ...material.selfUpdate, configuredAuthorityTransforms: ['operator-reserved-semantic-choice'] } },
    { ...material, selfUpdate: { ...material.selfUpdate, mode: 'unknown-future-mode' } },
  ]) assert.equal(migrationRequiresGovernedSession(target, '2.1.0'), true);
});
