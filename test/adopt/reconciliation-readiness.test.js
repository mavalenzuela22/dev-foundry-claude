import assert from 'node:assert/strict';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parse, stringify } from 'yaml';
import { INDEX_PATH, MCP_FILE, MCP_SERVER_NAME, RECONCILIATION_FILE, RECONCILIATION_KEY } from '../../src/adopt/common.js';
import { createPlan, reconciliationSurface } from '../../src/adopt/plan.js';
import { canonicalJson, sha256 } from '../../src/adopt/pin.js';
import { adapterIdentity, makeConsumer, repoRoot } from './fixture.js';

test('historical reconciliation permits later task/index/overview work while protecting managed bytes and the receipt commitment', async (t) => {
  const c = await makeConsumer(); t.after(c.cleanup);
  const root = await realpath(c.root);
  const options = { root, adapter: adapterIdentity };
  const overview = 'docs/00-overview/OVR-001.md';
  // Include ordinary configured documentation in the historical snapshot, as
  // existing receipts do. Its current authority remains subject to live checks.
  const index = parse(await c.read(INDEX_PATH));
  index.bindings.push({ id: 'configured-overview', path: overview, authority_class: 'configured', required: true });
  await c.put(INDEX_PATH, stringify(index));
  const adoption = await createPlan(options);
  assert.equal(adoption.plan.status, 'ready', JSON.stringify(adoption.plan.blockers));
  for (const write of adoption.ops.writes) await c.put(write.path, write.content);
  c.commit();

  const agent = '.claude/agents/dev-foundry-executor.md';
  const targetAgent = await c.read(agent);
  await c.put(agent, targetAgent.replace('description: ', 'description: Consumer policy - '));
  c.commit();
  // Render against the verified base to obtain the same full read set used by
  // reconciliation. Preserve one local managed edit through record-level proof.
  const reconciled = await createPlan({ ...options, managedBaseTemplatesRoot: path.join(repoRoot, 'templates') });
  assert.equal(reconciled.plan.status, 'noop', JSON.stringify(reconciled.plan.blockers));
  const managed = reconciled.plan.reconciliation.find((record) => record.path === agent);
  assert.equal(managed.classification, 'local-edits-preserved');
  const receipt = {
    format: 'dev-foundry.upgrade-reconciliation.v1', repository: root,
    project: { name: 'acme-billing', idPrefix: 'ACME' },
    source: `1.4.2:sha256:${'a'.repeat(64)}`, target: adapterIdentity.expect,
    previousPlanSha256: reconciled.hash, resolutionSha256: null,
    files: [Object.fromEntries(['path', 'scope', 'classification', 'before_sha256', 'base_sha256', 'current_sha256', 'target_sha256', 'after_sha256']
      .map((key) => [key, managed[key]]))],
    state: await reconciliationSurface(root, reconciled.plan.preconditions),
  };
  assert.ok(Object.hasOwn(receipt.state.files, overview));
  const receiptBytes = canonicalJson(receipt);
  await c.put(RECONCILIATION_FILE, receiptBytes);
  const mcp = JSON.parse(await c.read(MCP_FILE));
  mcp.mcpServers[MCP_SERVER_NAME].env = { [RECONCILIATION_KEY]: sha256(receiptBytes) };
  await c.put(MCP_FILE, `${JSON.stringify(mcp, null, 2)}\n`);
  c.commit();
  assert.equal((await createPlan(options)).plan.status, 'noop');

  index.title = 'ACME Authority Index after task closure';
  index.routes.push({ id: 'tsk-002', path: 'docs/70-tasks/TSK-002.md', authority_class: 'task', governs: ['follow-up'], section_id: null });
  await c.put(INDEX_PATH, stringify(index));
  await c.put(overview, `${await c.read(overview)}\nThe billing task is complete.\n`);
  await c.put('docs/70-tasks/TSK-001.md', (await c.read('docs/70-tasks/TSK-001.md')).replace('IN_PROGRESS', 'COMPLETED').replace('in-progress', 'completed'));
  await c.put('docs/70-tasks/TSK-002.md', (await c.read('docs/70-tasks/TSK-001.md')).replace('TSK-001', 'TSK-002'));
  const normal = await createPlan(options);
  assert.equal(normal.plan.status, 'noop', JSON.stringify(normal.plan.blockers));
  assert.ok(!normal.plan.blockers.some(({ code }) => code === 'upgrade-reconciliation-stale'));
  assert.deepEqual(normal.ops, { writes: [], deletes: [] });
  assert.equal(await c.read(RECONCILIATION_FILE), receiptBytes);
  assert.equal(normal.plan.reconciliationEvidence.sha256, sha256(receiptBytes));

  const preservedAgent = await c.read(agent);
  await c.put(agent, `${preservedAgent}\nUnauthorized managed change.\n`);
  const tampered = await createPlan(options);
  assert.equal(tampered.plan.status, 'blocked');
  assert.ok(tampered.plan.blockers.some(({ code }) => code === 'upgrade-reconciliation-stale'));
  assert.deepEqual(tampered.ops, { writes: [], deletes: [] });
  await c.put(agent, preservedAgent);

  mcp.mcpServers[MCP_SERVER_NAME].env[RECONCILIATION_KEY] = '0'.repeat(64);
  await c.put(MCP_FILE, `${JSON.stringify(mcp, null, 2)}\n`);
  const unanchored = await createPlan(options);
  assert.equal(unanchored.plan.status, 'blocked');
  assert.ok(unanchored.plan.blockers.some(({ code }) => code === 'upgrade-reconciliation-invalid'));
  assert.deepEqual(unanchored.ops, { writes: [], deletes: [] });
});
