import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPlan } from '../../src/adopt/apply.js';
import { createPlan } from '../../src/adopt/plan.js';
import { createRemovePlan } from '../../src/adopt/remove.js';
import { canonicalJson, sha256 } from '../../src/adopt/pin.js';
import { createUpgradePlan, upgradeStatus } from '../../src/adopt/upgrade.js';
import { adapterIdentity, diffTrees, listTree, makeConsumer, readSetSnapshot } from './fixture.js';

const old = { version: '1.2.2', payloadRoot: 'a'.repeat(64), expect: `1.2.2:sha256:${'a'.repeat(64)}` };
const target = { ...adapterIdentity, version: '1.3.0', expect: `1.3.0:sha256:${adapterIdentity.payloadRoot}` };
async function prepared(t) {
  const consumer = await makeConsumer();
  t.after(consumer.cleanup);
  const adoption = await createPlan({ root: consumer.root, adapter: old });
  await applyPlan({ root: consumer.root, adapter: old, planBytes: adoption.bytes, planSha256: adoption.hash });
  consumer.commit();
  return consumer;
}
const plan = (consumer, adapter = target) => createUpgradePlan({ root: consumer.root, adapter });
const apply = (consumer, result, adapter = target) => applyPlan({ root: consumer.root, adapter, upgrade: true, planBytes: result.bytes, planSha256: result.hash });

test('compatible old pin -> exact target is deterministic, read-only, and changes only the MCP pin', async (t) => {
  const consumer = await prepared(t);
  const before = await listTree(consumer.root);
  const authority = await readSetSnapshot(consumer.root);
  const originalMcp = JSON.parse(await consumer.read('.mcp.json'));
  const result = await plan(consumer);
  assert.equal(result.plan.status, 'ready');
  assert.deepEqual(result.plan.current, old);
  assert.deepEqual(result.plan.target, target);
  assert.deepEqual(result.bytes, (await plan(consumer)).bytes);
  assert.equal(result.hash, sha256(result.bytes));
  assert.deepEqual(diffTrees(before, await listTree(consumer.root)), []);
  assert.equal((await upgradeStatus({ root: consumer.root, adapter: target })).status, 'upgrade-needed');
  assert.deepEqual(await apply(consumer, result), { written: 1, deleted: 0 });
  assert.deepEqual(diffTrees(before, await listTree(consumer.root)), ['.mcp.json']);
  const expectedMcp = structuredClone(originalMcp);
  expectedMcp.mcpServers['dev-foundry-governance'].args[2] = target.expect;
  assert.deepEqual(JSON.parse(await consumer.read('.mcp.json')), expectedMcp);
  assert.deepEqual(await readSetSnapshot(consumer.root), authority);
  consumer.commit();
  const adoption = await createPlan({ root: consumer.root, adapter: target });
  assert.equal(adoption.plan.status, 'noop');
  assert.equal(adoption.plan.activation.overall, 'prepared');
  assert.ok(!adoption.plan.blockers.some(({ code }) => code === 'adapter-runtime-mismatch'));
  const current = await plan(consumer);
  assert.equal(current.plan.status, 'noop');
  assert.deepEqual(await apply(consumer, current), { written: 0, deleted: 0 });
  assert.equal((await upgradeStatus({ root: consumer.root, adapter: target })).status, 'current');
  // Existing remove still accepts the target and rejects the previous release.
  assert.equal((await createRemovePlan({ root: consumer.root, adapter: target })).plan.status, 'ready');
  assert.ok((await createRemovePlan({ root: consumer.root, adapter: old })).plan.blockers.some(({ code }) => code === 'adapter-runtime-mismatch'));
});

test('stale current pin, dirty touched path, repository drift, plan bytes and target identity fail closed', async (t) => {
  const cases = [
    ['stale pin', async (c) => {
      const mcp = JSON.parse(await c.read('.mcp.json'));
      mcp.mcpServers['dev-foundry-governance'].args[2] = `1.2.3:sha256:${'b'.repeat(64)}`;
      await c.put('.mcp.json', JSON.stringify(mcp)); c.commit();
    }],
    ['dirty touched path', async (c) => c.put('.mcp.json', `${await c.read('.mcp.json')} `)],
    ['dirty authority', async (c) => c.put('.dev-foundry/authority-index.yaml', `${await c.read('.dev-foundry/authority-index.yaml')}\n`)],
    ['committed repo drift', async (c) => { await c.put('src/billing.js', '// changed\n'); c.commit(); }],
  ];
  for (const [name, mutate] of cases) await t.test(name, async (t) => {
    const c = await prepared(t); const result = await plan(c);
    await mutate(c); const before = await listTree(c.root);
    await assert.rejects(apply(c, result), { code: 'plan-stale' });
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
    if (name === 'dirty touched path') {
      const dirty = await plan(c);
      assert.equal(dirty.plan.status, 'blocked');
      assert.ok(dirty.plan.blockers.some(({ code }) => code === 'dirty-working-tree'));
    }
  });
  const c = await prepared(t); const result = await plan(c);
  const before = await listTree(c.root);
  await assert.rejects(apply(c, result, { ...target, payloadRoot: 'e'.repeat(64), expect: `1.3.0:sha256:${'e'.repeat(64)}` }), { code: 'plan-stale' });
  await assert.rejects(apply(c, result, { ...target, version: '1.3.1', expect: `1.3.1:sha256:${target.payloadRoot}` }), { code: 'plan-stale' });
  await assert.rejects(apply(c, { ...result, bytes: Buffer.concat([result.bytes, Buffer.from(' ')]) }), { code: 'plan-hash-mismatch' });
  const edited = { ...result.plan, current: target };
  const editedBytes = Buffer.from(canonicalJson(edited));
  await assert.rejects(apply(c, { bytes: editedBytes, hash: sha256(editedBytes) }), { code: 'plan-stale' });
  const noncanonical = Buffer.from(JSON.stringify(result.plan));
  await assert.rejects(apply(c, { bytes: noncanonical, hash: sha256(noncanonical) }), { code: 'plan-stale' });
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
});

test('changed or missing adapter-owned bytes require migration and produce zero writes', async (t) => {
  const cases = [
    ['.claude/agents/dev-foundry-executor.md', 'changed\n'],
    ['CLAUDE.md', 'changed\n'],
    ['.dev-foundry/.gitignore', 'execution-requests/\n'],
    ['.dev-foundry/profiles/capability-profiles/implementation-executor-claude-code-v2.yaml', 'changed\n'],
    ['.dev-foundry/platform-bootstrap-claude-code.yaml', 'changed\n'],
  ];
  for (const [file, contents] of cases) await t.test(file, async (t) => {
    const c = await prepared(t); await c.put(file, contents); c.commit();
    const before = await listTree(c.root); const result = await plan(c);
    assert.equal(result.plan.status, 'blocked');
    assert.ok(result.plan.blockers.some(({ code }) => code === 'upgrade-migration-required'));
    assert.deepEqual(result.ops, { writes: [], deletes: [] });
    await assert.rejects(apply(c, result), { code: 'plan-not-ready' });
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  });
});

test('missing or invalid existing pin cannot become an implicit adoption', async (t) => {
  const c = await makeConsumer(); t.after(c.cleanup);
  const before = await listTree(c.root);
  assert.ok((await plan(c)).plan.blockers.some(({ code }) => code === 'upgrade-current-pin-invalid'));
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
});

test('compatible upgrade preserves dirty tracked and untracked Kafka files and still binds repository drift', async (t) => {
  const c = await prepared(t);
  await c.put('src/kafka/consumer.js', 'export const pending = true;\n'); c.commit();
  await c.put('src/kafka/consumer.js', 'export const pending = "dirty";\n');
  await c.put('src/kafka/new-event.js', '// untracked work\n');
  const before = await listTree(c.root); const authority = await readSetSnapshot(c.root);
  const result = await plan(c);
  assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers));
  assert.deepEqual(result.ops.writes.map((item) => item.path), ['.mcp.json']);
  assert.deepEqual(result.bytes, (await plan(c)).bytes);
  await c.put('src/kafka/consumer.js', '// later tracked edit\n');
  const drifted = await listTree(c.root);
  await assert.rejects(apply(c, result), { code: 'plan-stale' });
  assert.deepEqual(diffTrees(drifted, await listTree(c.root)), []);
  await c.put('src/kafka/consumer.js', 'export const pending = "dirty";\n');
  await apply(c, result);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), ['.mcp.json']);
  assert.deepEqual(await readSetSnapshot(c.root), authority);
});

test('dirty managed agent without a selected verified resolution remains blocked and cannot refresh implicitly', async (t) => {
  const c = await prepared(t);
  await c.put('.claude/agents/dev-foundry-executor.md', (await c.read('.claude/agents/dev-foundry-executor.md')) + '\nUnreviewed local instruction.\n');
  await c.put('src/kafka/new-event.js', '// unrelated dirty work\n');
  const before = await listTree(c.root); const result = await plan(c);
  assert.equal(result.plan.status, 'blocked');
  assert.ok(result.plan.blockers.some((item) => item.code === 'agent-file-collision'));
  assert.deepEqual(result.ops, { writes: [], deletes: [] });
  await assert.rejects(apply(c, result), { code: 'plan-not-ready' });
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
});

test('C014 a receipt added after a clean pin-only upgrade cannot supply its own authorization', async (t) => {
  const consumer = await prepared(t);
  await apply(consumer, await plan(consumer));
  const config = JSON.parse(await consumer.read('.mcp.json'));
  assert.equal(config.mcpServers['dev-foundry-governance'].env, undefined);
  await consumer.put('.dfc-upgrade-reconciliation.json', canonicalJson({
    format: 'dev-foundry.upgrade-reconciliation.v1', source: old.expect, target: target.expect,
    authorization: 'operator-approved', files: [{ path: '.claude/agents/dev-foundry-executor.md', after_sha256: sha256('forged') }],
  }));
  const before = await listTree(consumer.root);
  const denied = await plan(consumer);
  assert.equal(denied.plan.status, 'blocked'); assert.deepEqual(denied.ops.writes, []);
  assert.ok(denied.plan.blockers.some((item) => item.code === 'upgrade-reconciliation-invalid'));
  await assert.rejects(apply(consumer, denied), { code: 'plan-not-ready' });
  assert.deepEqual(diffTrees(before, await listTree(consumer.root)), []);
});
