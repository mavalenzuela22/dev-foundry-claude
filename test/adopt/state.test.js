import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { parse, parseDocument } from 'yaml';
import { evaluateActivation } from '../../src/adopt/activation.js';
import { applyPlan } from '../../src/adopt/apply.js';
import { BOOTSTRAP_PATH, PROFILE_PATHS, ROLES } from '../../src/adopt/common.js';
import { createPlan } from '../../src/adopt/plan.js';
import { createRemovePlan } from '../../src/adopt/remove.js';
import { resolveGovernedOperation } from '../../src/governance-mcp/resolver.js';
import { adapterIdentity, applyProposal, makeConsumer, repoRoot } from './fixture.js';

const POP = '.dev-foundry/profiles/project-operating-profile.yaml';
const INDEX = '.dev-foundry/authority-index.yaml';
const requestFor = {
  'governance-author': { requestedAction: 'author', boundaryId: 'B-1' },
  'implementation-executor': { requestedAction: 'implement', taskId: 'TSK-001' },
  'governance-auditor': { requestedAction: 'audit', boundaryId: 'B-1' },
  'mechanical-validator': { requestedAction: 'validate', boundaryId: 'B-1' },
  'evidence-custodian': { requestedAction: 'close', boundaryId: 'B-1' },
};

async function prepared(t, options) {
  const consumer = await makeConsumer(options);
  t.after(() => consumer.cleanup());
  const result = await createPlan({ root: consumer.root, adapter: adapterIdentity });
  await applyPlan({ planBytes: result.bytes, planSha256: result.hash, adapter: adapterIdentity, root: consumer.root });
  consumer.commit();
  return { consumer, proposal: result.plan.cutover_proposal };
}
async function cutOver(t) {
  const state = await prepared(t);
  await applyProposal(state.consumer.root, state.proposal);
  state.consumer.commit();
  return state.consumer;
}
async function editYaml(consumer, file, mutate) {
  const document = parseDocument(await consumer.read(file));
  mutate(document);
  await consumer.put(file, document.toString({ lineWidth: 0 }));
}

async function connect(t, projectRoot, { guard }) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'guard-entry-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const entry = path.join(dir, 'entry.mjs');
  await writeFile(entry, `${guard ? "globalThis[Symbol.for('dev-foundry-claude.consumer-mode-guard')] = true;\n" : ''}await import(${JSON.stringify(pathToFileURL(path.join(repoRoot, 'src/governance-mcp/server.js')).href)});\n`);
  const client = new Client({ name: 'state-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry], env: { CLAUDE_PROJECT_DIR: projectRoot }, cwd: os.tmpdir() }));
  t.after(() => client.close());
  const call = async (args) => JSON.parse((await client.callTool({ name: 'resolve_governed_operation', arguments: args })).content[0].text);
  return { client, call };
}
const ask = (role, project = 'acme-billing') => ({ targetProject: project, ...requestFor[role] });

test('7 8 prepared state and every partial or mixed state fail closed with BINDING_INACTIVE', async (t) => {
  const { consumer } = await prepared(t);
  const server = await connect(t, consumer.root, { guard: true });
  assert.deepEqual((await server.client.listTools()).tools.map((tool) => tool.name), ['resolve_governed_operation']);
  assert.equal((await evaluateActivation(consumer.root)).overall, 'prepared');
  for (const role of ROLES) {
    const result = await server.call(ask(role));
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'BINDING_INACTIVE');
    assert.equal(result.resolution, undefined);
  }
  assert.deepEqual(await server.call({ requestedAction: 'bogus' }), { ok: false, errorCode: 'BINDING_INACTIVE', message: 'Claude role activation is not complete for this project.' });

  const cases = {
    'four of five Claude roles': async (c) => editYaml(c, POP, (d) => d.setIn(['actor_bindings', 'evidence-custodian', 'implementation'], d.createNode({ kind: 'service', identity: 'acme-runner', platform: 'runner' }))),
    'profile files without POP bindings': async (c) => {
      const plan = await createPlan({ root: c.root, adapter: adapterIdentity });
      assert.equal(plan.plan.status, 'noop');
      for (const add of (await createPlan({ root: c.root, adapter: adapterIdentity })).plan.cutover_proposal.adds) await c.put(add.path, add.content);
    },
    'POP bindings without profile files': async (c) => { await rm(path.join(c.root, PROFILE_PATHS.executor)); },
    'profiles not routed by the Index': async (c) => editYaml(c, INDEX, (d) => d.set('bindings', d.createNode(d.toJS().bindings.filter((b) => !b.path.includes('claude-code-v')))), ),
    'wrong limits.repository': async (c) => editYaml(c, PROFILE_PATHS.auditor, (d) => d.setIn(['limits', 'repository'], 'someone-else')),
    'non-active profile status': async (c) => editYaml(c, PROFILE_PATHS.executor, (d) => d.set('status', 'stale')),
    'missing Claude active bootstrap': async (c) => editYaml(c, POP, (d) => d.setIn(['platform_bootstraps', 'claude-code-governance-agent', 'status'], 'prepared')),
    'lingering active runner bootstrap': async (c) => editYaml(c, POP, (d) => d.setIn(['platform_bootstraps', 'primary-governance-agent', 'status'], 'active')),
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const state = await cutOver(t);
    if (name === 'profile files without POP bindings') {
      const fresh = await prepared(t);
      await mutate(fresh.consumer);
      const check = await evaluateActivation(fresh.consumer.root);
      assert.equal(check.overall, 'partial', name);
      continue;
    }
    const live = await connect(t, state.root, { guard: true });
    assert.equal((await live.call(ask('governance-author'))).ok, true, `${name}: baseline active`);
    await mutate(state);
    const check = await evaluateActivation(state.root);
    assert.equal(check.overall, 'partial', name);
    for (const role of ROLES) assert.equal((await live.call(ask(role))).errorCode, name === 'profiles not routed by the Index' ? 'BINDING_INACTIVE' : 'STALE_SESSION', name);
  }
});

test('9 fixture-simulated cutover activates all five roles with consumer-owned authority only', async (t) => {
  const consumer = await cutOver(t);
  const activation = await evaluateActivation(consumer.root);
  assert.equal(activation.overall, 'active');
  assert.deepEqual(Object.values(activation.roles), Array(5).fill('claude-active'));
  const pop = parse(await consumer.read(POP));
  const server = await connect(t, consumer.root, { guard: true });
  for (const role of ROLES) {
    const result = await server.call(ask(role));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.resolution.role.id, role);
    assert.equal(result.resolution.role.actorProfilePath, pop.actor_bindings[role].profile);
    assert.deepEqual(result.resolution.role.capabilityProfilePaths, pop.actor_bindings[role].capability_profiles);
    for (const source of result.resolution.authority) {
      assert.ok(await readFile(path.join(consumer.root, source.path)), source.path);
      assert.ok(!source.path.includes('dev-foundry-claude'));
    }
    assert.equal(pop.actor_bindings[role].implementation.platform, 'claude-code');
  }
  assert.equal((await server.call(ask('governance-author', 'dev-foundry-claude'))).errorCode, 'TARGET_MISMATCH');
  assert.equal(pop.platform_bootstraps['primary-governance-agent'].status, 'retired');
  assert.equal(parse(await consumer.read('.dev-foundry/platform-bootstrap.yaml')).status, 'retired');
  assert.deepEqual(Object.entries(pop.platform_bootstraps).filter(([, entry]) => entry.status === 'active').map(([key]) => key), ['claude-code-governance-agent']);
  const index = parse(await consumer.read(INDEX));
  assert.equal(index.bindings.find((b) => b.id === 'implementation-executor-capability').required, false);
  assert.ok(parse(await consumer.read(BOOTSTRAP_PATH)).platform.id === 'claude-code');
});

test('10 guard scope: resolver.js is byte-identical to HEAD and guard-off server output equals the resolver', async (t) => {
  const head = execFileSync('git', ['show', 'HEAD:src/governance-mcp/resolver.js'], { cwd: repoRoot });
  assert.ok(head.equals(await readFile(path.join(repoRoot, 'src/governance-mcp/resolver.js'))));
  const { consumer } = await prepared(t);
  const off = await connect(t, consumer.root, { guard: false });
  for (const role of ROLES) {
    const served = await off.call(ask(role));
    const direct = await resolveGovernedOperation(ask(role), { projectRoot: consumer.root });
    assert.equal(served.ok, true);
    assert.deepEqual(served, direct);
  }
  const active = await cutOver(t);
  const on = await connect(t, active.root, { guard: true });
  for (const role of ROLES) assert.deepEqual(await on.call(ask(role)), await resolveGovernedOperation(ask(role), { projectRoot: active.root }));
});

const actions = ['inspect', 'author', 'implement', 'validate', 'audit', 'promote', 'close'];
async function matrix(root) {
  const out = [];
  for (const action of actions) {
    for (const role of [undefined, ...ROLES]) {
      for (const extra of [{ taskId: 'TSK-001' }, { boundaryId: 'B-1' }]) {
        out.push(JSON.stringify(await resolveGovernedOperation({ requestedAction: action, targetProject: 'acme-billing', ...(role ? { requestedRole: role } : {}), ...extra }, { projectRoot: root })));
      }
    }
  }
  return out;
}

test('11 12 capability grants no authority: resolver output is identical before apply, after apply, and after remove', async (t) => {
  const consumer = await makeConsumer();
  t.after(() => consumer.cleanup());
  const before = await matrix(consumer.root);
  assert.ok(before.some((entry) => JSON.parse(entry).ok === true));
  const applied = await createPlan({ root: consumer.root, adapter: adapterIdentity });
  await applyPlan({ planBytes: applied.bytes, planSha256: applied.hash, adapter: adapterIdentity, root: consumer.root });
  assert.deepEqual(await matrix(consumer.root), before);
  consumer.commit();
  const removal = await createRemovePlan({ root: consumer.root, adapter: adapterIdentity });
  await applyPlan({ planBytes: removal.bytes, planSha256: removal.hash, adapter: adapterIdentity, root: consumer.root });
  assert.deepEqual(await matrix(consumer.root), before);
});

test('12 adapter-owned paths are never authority inputs and never change activation', async (t) => {
  for (const cutover of [false, true]) {
    const consumer = cutover ? await cutOver(t) : (await prepared(t)).consumer;
    const baseline = await evaluateActivation(consumer.root);
    const resolution = await resolveGovernedOperation(ask('governance-author'), { projectRoot: consumer.root });
    const owned = /(?:\.claude\/agents|CLAUDE\.md|\.mcp\.json|dev-foundry-executor\.md|dev-foundry-auditor\.md)/;
    for (const source of resolution.resolution?.authority ?? []) assert.ok(!owned.test(source.path));
    for (const file of [POP, INDEX, '.dev-foundry/platform-bootstrap.yaml', ...(cutover ? [BOOTSTRAP_PATH, ...Object.values(PROFILE_PATHS)] : [])]) {
      assert.ok(!owned.test(await consumer.read(file)), file);
    }
    await rm(path.join(consumer.root, '.claude/agents/dev-foundry-executor.md'));
    await consumer.put('.claude/agents/dev-foundry-auditor.md', 'mutated\n');
    await consumer.put('CLAUDE.md', 'no block any more\n');
    await consumer.put('.mcp.json', '{}\n');
    assert.deepEqual(await evaluateActivation(consumer.root), baseline);
    await editYaml(consumer, POP, (d) => d.setIn(['actor_bindings', 'governance-author', 'status'], 'deferred'));
    assert.notDeepEqual(await evaluateActivation(consumer.root), baseline);
  }
});
