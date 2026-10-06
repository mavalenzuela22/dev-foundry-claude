import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, symlink, writeFile, chmod } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { parseDocument } from 'yaml';
import { evaluateActivation } from '../../src/adopt/activation.js';
import { applyPlan } from '../../src/adopt/apply.js';
import { BOOTSTRAP_PATH, PROFILE_PATHS } from '../../src/adopt/common.js';
import { createPlan } from '../../src/adopt/plan.js';
import { createRemovePlan } from '../../src/adopt/remove.js';
import { adapterIdentity, applyProposal, diffTrees, listTree, makeConsumer, readSetSnapshot, repoRoot, treeHash } from './fixture.js';

const POP = '.dev-foundry/profiles/project-operating-profile.yaml';
const plan = (consumer, extra = {}) => createPlan({ root: consumer.root, adapter: adapterIdentity, ...extra });
const withConsumer = async (t, options) => {
  const consumer = await makeConsumer(options);
  t.after(() => consumer.cleanup());
  return consumer;
};
async function editPop(consumer, mutate) {
  const document = parseDocument(await consumer.read(POP));
  mutate(document);
  await consumer.put(POP, document.toString({ lineWidth: 0 }));
  consumer.commit();
}

async function withRenderedLineEnding(t, lineEnding) {
  // Model installed template bytes on each platform without changing producer templates.
  const root = await mkdtemp(path.join(os.tmpdir(), 'adopt-line-ending-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const relative of ['src/adopt', 'templates', 'node_modules/yaml']) {
    await cp(path.join(repoRoot, relative), path.join(root, relative), { recursive: true });
  }
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n');
  const template = path.join(root, 'templates/claude-md-block.md.tmpl');
  await writeFile(template, (await readFile(template, 'utf8')).replace(/\r?\n/g, lineEnding));
  const planner = await import(pathToFileURL(path.join(root, 'src/adopt/plan.js')).href);
  const applier = await import(pathToFileURL(path.join(root, 'src/adopt/apply.js')).href);
  return { ...planner, ...applier };
}

for (const [name, lineEnding] of [['LF', '\n'], ['CRLF', '\r\n']]) {
  test(`${name} managed block apply -> commit -> replan is noop and preserves outside bytes`, async (t) => {
    const consumer = await withConsumer(t);
    const runtime = await withRenderedLineEnding(t, lineEnding);
    const original = '# Acme billing\r\n\r\nKeep invoices immutable.\n';
    await consumer.put('CLAUDE.md', original);
    consumer.commit();
    const first = await runtime.createPlan({ root: consumer.root, adapter: adapterIdentity });
    assert.equal(first.plan.status, 'ready');
    await runtime.applyPlan({ planBytes: first.bytes, planSha256: first.hash, adapter: adapterIdentity, root: consumer.root });
    const applied = await consumer.read('CLAUDE.md');
    assert.ok(applied.startsWith(original));
    assert.ok(applied.endsWith(`<!-- DEV-FOUNDRY-CLAUDE-ADAPTER:END -->${lineEnding}`));
    assert.ok(applied.includes(`${lineEnding}## DEV FOUNDRY Claude adapter${lineEnding}`));
    consumer.commit();
    const unchanged = await runtime.createPlan({ root: consumer.root, adapter: adapterIdentity });
    assert.equal(unchanged.plan.status, 'noop');
    assert.deepEqual(unchanged.plan.blockers, []);
    // An extra line ending after the block belongs to the untouched consumer surface.
    await consumer.put('CLAUDE.md', `${applied}\r\n# Consumer notes\n`);
    consumer.commit();
    const before = await treeHash(consumer.root);
    const again = await runtime.createPlan({ root: consumer.root, adapter: adapterIdentity });
    assert.equal(again.plan.status, 'noop');
    assert.deepEqual(again.plan.blockers, []);
    assert.equal(again.plan.create.length + again.plan.merge.length + again.plan.delete.length, 0);
    assert.deepEqual(again.ops, { writes: [], deletes: [] });
    assert.ok(again.plan.noop.includes('CLAUDE.md'));
    assert.equal(again.plan.activation.overall, 'prepared');
    assert.ok(again.plan.cutover_proposal);
    assert.equal(await treeHash(consumer.root), before);
  });

  test(`${name} managed block content edits fail closed for adoption and removal`, async (t) => {
    const consumer = await withConsumer(t);
    const runtime = await withRenderedLineEnding(t, lineEnding);
    const first = await runtime.createPlan({ root: consumer.root, adapter: adapterIdentity });
    assert.equal(first.plan.status, 'ready');
    await runtime.applyPlan({ planBytes: first.bytes, planSha256: first.hash, adapter: adapterIdentity, root: consumer.root });
    const applied = await consumer.read('CLAUDE.md');
    const modified = applied.replace('## DEV FOUNDRY Claude adapter', '## DEV FOUNDRY edited adapter');
    assert.notEqual(modified, applied);
    await consumer.put('CLAUDE.md', modified);
    consumer.commit();
    const before = await treeHash(consumer.root);
    for (const [remove, code] of [[false, 'managed-block-modified'], [true, 'artifact-modified']]) {
      const result = await runtime.createPlan({ root: consumer.root, adapter: adapterIdentity, remove });
      assert.equal(result.plan.status, 'blocked');
      assert.ok(result.plan.blockers.some((item) => item.code === code), JSON.stringify(result.plan.blockers));
      assert.deepEqual(result.ops, { writes: [], deletes: [] });
      assert.equal(result.plan.cutover_proposal, null);
      assert.equal(await treeHash(consumer.root), before);
      await assert.rejects(runtime.applyPlan({ planBytes: result.bytes, planSha256: result.hash, adapter: adapterIdentity, root: consumer.root }), { code: 'plan-not-ready' });
    }
  });
}

test('1 plan is non-mutating, deterministic, host-path free, and its proposal applies cleanly to a copy', async (t) => {
  const consumer = await withConsumer(t);
  const before = await treeHash(consumer.root);
  const first = await plan(consumer);
  const second = await plan(consumer);
  assert.equal(await treeHash(consumer.root), before);
  assert.equal(first.hash, second.hash);
  assert.ok(first.bytes.equals(second.bytes));
  assert.equal(first.plan.status, 'ready');
  assert.equal(first.plan.target.project, 'acme-billing');
  assert.equal(first.plan.adapter.expect, adapterIdentity.expect);
  assert.equal(first.plan.adapter.payloadRoot, adapterIdentity.payloadRoot);
  assert.equal(first.plan.activation.overall, 'prepared');
  assert.deepEqual(Object.values(first.plan.activation.roles), Array(5).fill('foreign-active'));
  assert.ok(!first.bytes.toString('utf8').includes(consumer.root));
  assert.equal(first.plan.cutover_proposal.edits.length, 3);
  assert.equal(first.plan.cutover_proposal.adds.length, 3);
  assert.ok(first.plan.warnings.some((w) => w.includes('not been verified against the mature runner')));
  assert.ok(first.plan.warnings.some((w) => w.includes('retires the runner binding')));
  const copy = await mkdtemp(path.join(os.tmpdir(), 'acme-copy-'));
  t.after(() => rm(copy, { recursive: true, force: true }));
  await cp(consumer.root, copy, { recursive: true });
  await applyProposal(copy, first.plan.cutover_proposal);
  assert.equal((await evaluateActivation(copy)).overall, 'active');
});

test('2 ungoverned and identity-mismatch repositories write nothing', async (t) => {
  const ungoverned = await withConsumer(t, { governed: false });
  const mismatch = await withConsumer(t, { indexSubject: 'other-project' });
  const bootstrap = await withConsumer(t, { bootstrapName: 'someone-else' });
  for (const [consumer, status, extra] of [[ungoverned, 'not-governed', {}], [mismatch, 'blocked', {}], [bootstrap, 'blocked', {}], [await withConsumer(t), 'blocked', { project: 'dev-foundry-claude' }]]) {
    const before = await treeHash(consumer.root);
    const result = await plan(consumer, extra);
    assert.equal(result.plan.status, status);
    assert.equal(await treeHash(consumer.root), before);
    assert.equal(result.ops.writes.length, 0);
    assert.equal(result.plan.create.length + result.plan.merge.length, 0);
  }
});

const blockerCases = {
  'invalid mcp json': [async (c) => { await c.put('.mcp.json', '{'); }, 'invalid-mcp-json'],
  'existing server entry': [async (c) => { await c.put('.mcp.json', JSON.stringify({ mcpServers: { 'dev-foundry-governance': { command: 'node' } } })); }, 'mcp-entry-collision'],
  'different agent file': [async (c) => { await c.put('.claude/agents/dev-foundry-executor.md', 'mine\n'); }, 'agent-file-collision'],
  'CLAUDE.md governance instructions': [async (c) => { await c.put('CLAUDE.md', 'Use resolve_governed_operation always.\n'); }, 'claude-md-conflict'],
  'symlinked generated path': [async (c) => { await rm(path.join(c.root, 'CLAUDE.md')); await symlink('/etc/hosts', path.join(c.root, 'CLAUDE.md')); }, 'symlink-path'],
  'artifact path collision': [async (c) => { await c.put(BOOTSTRAP_PATH, 'something: else\n'); }, 'artifact-collision'],
  'id collision': [async (c) => { await c.put('.dev-foundry/profiles/capability-profiles/other.yaml', 'id: ACME-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V2\nstatus: active\n'); }, 'id-collision'],
  'unrecognized id convention': [null, 'unrecognized-id-convention', { popId: 'WEIRD' }],
  'partial claude binding': [async (c) => editPop(c, (d) => {
    d.setIn(['actor_bindings', 'governance-author', 'implementation'], d.createNode({ kind: 'agent', identity: 'claude-main-agent', platform: 'claude-code' }));
  }), 'partial-claude-binding-state'],
  'unsupported framework': [async (c) => editPop(c, (d) => d.setIn(['framework', 'adopted_version'], '2.0.0')), 'unsupported-framework'],
  'nonstandard authority path': [async (c) => editPop(c, (d) => d.setIn(['repository', 'authority_index'], 'elsewhere/index.yaml')), 'nonstandard-authority-path'],
  'pin mismatch': [async (c) => { await c.put('.mcp.json', JSON.stringify({ mcpServers: { 'dev-foundry-governance': { type: 'stdio', command: 'dev-foundry-claude', args: ['mcp', '--expect', `1.0.0:sha256:${'a'.repeat(64)}`] } } })); }, 'adapter-runtime-mismatch'],
  'ignore re-inclusion': [null, 'ignore-reincluded', { ignore: 'telemetry/*\n!/telemetry/local/\n' }],
};
for (const [name, [mutate, code, options]] of Object.entries(blockerCases)) {
  test(`3 blocker fails closed with zero writes: ${name}`, async (t) => {
    const consumer = await withConsumer(t, options);
    if (mutate) { await mutate(consumer); if (!name.startsWith('partial') && !name.startsWith('unsupported') && !name.startsWith('nonstandard')) consumer.commit(); }
    const before = await treeHash(consumer.root);
    const result = await plan(consumer);
    assert.equal(result.plan.status, 'blocked');
    assert.ok(result.plan.blockers.some((item) => item.code === code), JSON.stringify(result.plan.blockers));
    assert.equal(await treeHash(consumer.root), before);
    assert.equal(result.ops.writes.length, 0);
    assert.equal(result.plan.cutover_proposal, null);
    await assert.rejects(applyPlan({ planBytes: result.bytes, planSha256: result.hash, adapter: adapterIdentity, root: consumer.root }), { code: 'plan-not-ready' });
  });
}

test('3 id-prefix lets an unrecognized POP id convention proceed; dirty touched path blocks', async (t) => {
  const consumer = await withConsumer(t, { popId: 'WEIRD' });
  const ready = await plan(consumer, { idPrefix: 'ACME' });
  assert.equal(ready.plan.status, 'ready');
  assert.equal(ready.plan.target.idPrefix, 'ACME');
  await consumer.put('CLAUDE.md', 'edited, uncommitted\n');
  assert.ok((await plan(consumer, { idPrefix: 'ACME' })).plan.blockers.some((item) => item.code === 'dirty-working-tree'));
});

test('4 5 apply writes exactly the planned paths and preserves everything else', async (t) => {
  const consumer = await withConsumer(t);
  const before = await listTree(consumer.root);
  const snapshot = await readSetSnapshot(consumer.root);
  const original = { claude: await consumer.read('CLAUDE.md'), ignore: await consumer.read('.dev-foundry/.gitignore'), settings: await consumer.read('.claude/settings.local.json'), mcp: JSON.parse(await consumer.read('.mcp.json')) };
  const result = await plan(consumer);
  await assert.rejects(applyPlan({ planBytes: result.bytes, planSha256: '0'.repeat(64), adapter: adapterIdentity, root: consumer.root }), { code: 'plan-hash-mismatch' });
  await applyPlan({ planBytes: result.bytes, planSha256: result.hash, adapter: adapterIdentity, root: consumer.root });
  const after = await listTree(consumer.root);
  const planned = [...result.plan.create, ...result.plan.merge].map((item) => item.path).sort();
  assert.deepEqual(diffTrees(before, after), planned);
  assert.deepEqual(planned, ['.claude/agents/dev-foundry-auditor.md', '.claude/agents/dev-foundry-executor.md', '.dev-foundry/.gitignore', '.mcp.json', 'CLAUDE.md']);
  assert.deepEqual(await readSetSnapshot(consumer.root), snapshot);
  assert.equal(await consumer.read('.claude/settings.local.json'), original.settings);
  assert.ok((await consumer.read('CLAUDE.md')).startsWith(original.claude));
  assert.equal(await consumer.read('.dev-foundry/.gitignore'), `${original.ignore}/telemetry/local/\n`);
  const mcp = JSON.parse(await consumer.read('.mcp.json'));
  assert.deepEqual(mcp.mcpServers.other, original.mcp.mcpServers.other);
  assert.deepEqual(mcp.mcpServers['dev-foundry-governance'], { type: 'stdio', command: 'dev-foundry-claude', args: ['mcp', '--expect', adapterIdentity.expect] });
  for (const file of planned) {
    const content = await consumer.read(file);
    const stripped = file === '.mcp.json' ? content.replace(/"command": "dev-foundry-claude"/, '') : content;
    assert.ok(!stripped.includes('dev-foundry-claude'), file);
  }
  assert.ok((await consumer.read('.claude/agents/dev-foundry-executor.md')).includes('acme-billing'));
  const proposalText = JSON.stringify(result.plan.cutover_proposal);
  for (const marker of ['TSK-012', 'ADR-003', 'dev-foundry-claude']) assert.ok(!proposalText.includes(marker), marker);
  for (const file of after.keys()) assert.ok(!/TSK-012|ADR-003/.test(await readFile(path.join(consumer.root, file), 'utf8')) || file.startsWith('.dev-foundry/releases/'));
  // A drifted repository refuses a previously valid plan.
  const second = await withConsumer(t);
  const stale = await plan(second);
  await second.put('CLAUDE.md', 'drift\n');
  await assert.rejects(applyPlan({ planBytes: stale.bytes, planSha256: stale.hash, adapter: adapterIdentity, root: second.root }), { code: 'plan-stale' });
  await assert.rejects(applyPlan({ planBytes: stale.bytes, planSha256: stale.hash, adapter: { ...adapterIdentity, version: '9.9.8', expect: `9.9.8:sha256:${'f'.repeat(64)}` }, root: second.root }), { code: 'plan-stale' });
});

test('4 apply rolls back completely on a write failure', { skip: process.getuid?.() === 0 }, async (t) => {
  const consumer = await withConsumer(t);
  const result = await plan(consumer);
  const before = await listTree(consumer.root);
  await chmod(path.join(consumer.root, '.dev-foundry'), 0o555);
  try {
    await assert.rejects(applyPlan({ planBytes: result.bytes, planSha256: result.hash, adapter: adapterIdentity, root: consumer.root }), { code: 'apply-failed' });
  } finally {
    await chmod(path.join(consumer.root, '.dev-foundry'), 0o755);
  }
  assert.deepEqual(diffTrees(before, await listTree(consumer.root)), []);
});

test('17 21 reapply is a no-op; remove restores the adapter-owned surface and is refused when stale', async (t) => {
  const consumer = await withConsumer(t);
  const before = await listTree(consumer.root);
  const first = await plan(consumer);
  await applyPlan({ planBytes: first.bytes, planSha256: first.hash, adapter: adapterIdentity, root: consumer.root });
  consumer.commit();
  const again = await plan(consumer);
  assert.equal(again.plan.status, 'noop');
  assert.equal(again.plan.create.length + again.plan.merge.length + again.plan.delete.length, 0);
  assert.equal(again.plan.activation.overall, 'prepared');
  await assert.rejects(applyPlan({ planBytes: again.bytes, planSha256: again.hash, adapter: adapterIdentity, root: consumer.root }), { code: 'plan-not-ready' });
  const afterApply = await treeHash(consumer.root);

  // Pin mismatch: a different installed build is adapter-runtime-mismatch for plan and remove.
  const other = { ...adapterIdentity, payloadRoot: 'e'.repeat(64), expect: `9.9.9:sha256:${'e'.repeat(64)}` };
  assert.ok((await createPlan({ root: consumer.root, adapter: other })).plan.blockers.some((item) => item.code === 'adapter-runtime-mismatch'));
  assert.ok((await createRemovePlan({ root: consumer.root, adapter: other })).plan.blockers.some((item) => item.code === 'adapter-runtime-mismatch'));

  // Modified adapter-owned artifact blocks removal.
  await consumer.put('.claude/agents/dev-foundry-auditor.md', 'modified\n');
  consumer.commit();
  assert.ok((await createRemovePlan({ root: consumer.root, adapter: adapterIdentity })).plan.blockers.some((item) => item.code === 'artifact-modified'));
  const ownedAuditor = (await createPlan({ root: consumer.root, adapter: adapterIdentity })).plan.blockers.map((item) => item.code);
  assert.ok(ownedAuditor.includes('agent-file-collision'));
  await consumer.put('.claude/agents/dev-foundry-auditor.md', first.plan.create.find((item) => item.path.endsWith('auditor.md')).content);
  consumer.commit();
  assert.equal(await treeHash(consumer.root), afterApply);

  const removal = await createRemovePlan({ root: consumer.root, adapter: adapterIdentity });
  assert.equal(removal.plan.status, 'ready');
  assert.equal(removal.plan.mode, 'remove');
  await applyPlan({ planBytes: removal.bytes, planSha256: removal.hash, adapter: adapterIdentity, root: consumer.root });
  const restored = await listTree(consumer.root);
  assert.deepEqual(diffTrees(before, restored), ['.dev-foundry/.gitignore']);
  assert.equal(await consumer.read('.dev-foundry/.gitignore'), `${await readFile(path.join(consumer.root, '.dev-foundry/.gitignore'), 'utf8')}`);
  assert.ok((await consumer.read('.dev-foundry/.gitignore')).endsWith('/telemetry/local/\n'));
  assert.deepEqual(await readSetSnapshot(consumer.root), Object.fromEntries([...before].filter(([key]) => (key.startsWith('.dev-foundry/') && key !== '.dev-foundry/.gitignore') || key.startsWith('docs/')).sort()));
});

test('7 after apply and before cutover consumer authority is unchanged and Claude is prepared, not active', async (t) => {
  const consumer = await withConsumer(t);
  const snapshot = await readSetSnapshot(consumer.root);
  const result = await plan(consumer);
  await applyPlan({ planBytes: result.bytes, planSha256: result.hash, adapter: adapterIdentity, root: consumer.root });
  assert.deepEqual(await readSetSnapshot(consumer.root), snapshot);
  const activation = await evaluateActivation(consumer.root);
  assert.equal(activation.overall, 'prepared');
  assert.deepEqual(Object.values(activation.roles), Array(5).fill('foreign-active'));
  for (const file of [BOOTSTRAP_PATH, ...Object.values(PROFILE_PATHS)]) assert.equal((await listTree(consumer.root)).has(file), false);
});
