import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { consumerCommand, inspectConsumer } from '../../src/consumer/command.js';
import { renderHelp, helpTopics, helpUri } from '../../src/consumer/help.js';
import { createPlan } from '../../src/adopt/plan.js';
import { applyPlan } from '../../src/adopt/apply.js';
import { adapterIdentity, applyProposal, diffTrees, listTree, makeConsumer, makePresentationPackage, readSetSnapshot, repoRoot } from './fixture.js';

const presentationPackage = await makePresentationPackage();
after(presentationPackage.cleanup);
const invoke = async (c, command, argv = [], overrides = {}) => {
  const lines = [];
  const code = await consumerCommand({ command, argv, cwd: c.root, packageRoot: presentationPackage.root,
    getAdapter: () => adapterIdentity, executableAvailable: () => true, output: (line) => lines.push(line), ...overrides });
  return { code, text: lines.join('\n'), lines };
};
async function prepared(t, active = false) {
  const c = await makeConsumer(); t.after(c.cleanup);
  const plan = await createPlan({ root: c.root, adapter: adapterIdentity });
  await applyPlan({ root: c.root, adapter: adapterIdentity, planBytes: plan.bytes, planSha256: plan.hash });
  c.commit();
  if (active) { await applyProposal(c.root, plan.plan.cutover_proposal); c.commit(); }
  return c;
}
const inspectOptions = (c) => ({ root: c.root, packageRoot: presentationPackage.root, adapter: adapterIdentity, executableAvailable: () => true });

test('setup classifies fresh, governed, prepared, partial and ready and never silently writes', async (t) => {
  const fresh = await makeConsumer({ governed: false }); t.after(fresh.cleanup);
  const before = await listTree(fresh.root);
  const freshView = await inspectConsumer(inspectOptions(fresh));
  assert.equal(freshView.integration, 'initial-bootstrap');
  assert.equal(freshView.nextAction, 'dev-foundry-claude setup');
  assert.match((await invoke(fresh, 'setup')).text, /Human Operator: Test/);
  assert.deepEqual(diffTrees(before, await listTree(fresh.root)), []);
  const c = await makeConsumer(); t.after(c.cleanup);
  const authority = await readSetSnapshot(c.root);
  const inspected = await invoke(c, 'setup');
  assert.match(inspected.text, /Next: dev-foundry-claude setup --yes/);
  assert.match(inspected.text, /Application files affected: 0/);
  const plan = await createPlan({ root: c.root, adapter: adapterIdentity });
  assert.equal(plan.plan.status, 'ready');
  const applied = await invoke(c, 'setup', ['--yes', '--json']);
  const data = JSON.parse(applied.text);
  assert.equal(data.integration, 'prepared');
  assert.ok(data.plan.cutover_proposal);
  assert.equal(data.nextAction, 'dev-foundry-claude help setup');
  assert.deepEqual(await readSetSnapshot(c.root), authority);
  c.commit();
  assert.equal((await inspectConsumer(inspectOptions(c))).integration, 'prepared');
  await applyProposal(c.root, plan.plan.cutover_proposal); c.commit();
  const ready = await inspectConsumer(inspectOptions(c));
  assert.equal(ready.integration, 'ready'); assert.equal(ready.readyToWork, true);
  assert.match((await invoke(c, 'setup')).text, /Next: dev-foundry-claude start/);
  await c.put('.dev-foundry/profiles/project-operating-profile.yaml', 'invalid: true\n');
  const partial = await inspectConsumer(inspectOptions(c));
  assert.equal(partial.integration, 'partially-configured'); assert.equal(partial.readyToWork, false);
});

test('start delegates all modes and exact Claude arguments; blocks not-ready and reports real collector readiness', async (t) => {
  const c = await prepared(t, true);
  const before = await listTree(c.root);
  for (const runtime of ['direct', 'dial', 'codemie']) {
    let called;
    const args = ['-p', 'prompt with "quotes" and spaces', '--model', 'claude-test', '--', '--flag=value'];
    const result = await invoke(c, 'start', ['--runtime', runtime, '--', ...args], { launcher: async (options) => {
      called = options; options.onReady({ port: 12345 }); return 0;
    } });
    assert.equal(result.code, 0);
    assert.deepEqual(called.argv, ['--runtime', runtime, '--', ...args]); assert.equal(called.projectRoot, await realpath(c.root));
    assert.match(result.text, /Local telemetry is ready/); assert.match(result.text, /dashboard --port 4319/);
  }
  const failing = await invoke(c, 'start', [], { launcher: async () => 1 });
  assert.equal(failing.code, 1); assert.doesNotMatch(failing.text, /Local telemetry is ready/);
  assert.match(failing.text, /Next: dev-foundry-claude doctor --runtime direct/);
  const p = await prepared(t);
  let calls = 0;
  const refused = await invoke(p, 'start', [], { launcher: async () => { calls++; return 0; } });
  assert.equal(refused.code, 2); assert.equal(calls, 0); assert.match(refused.text, /owner.*approve/);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
});

test('status human and JSON answer readiness and show a concrete next action', async (t) => {
  const c = await prepared(t, true);
  const before = await listTree(c.root);
  const human = await invoke(c, 'status');
  assert.equal(human.code, 0); assert.match(human.text, /Ready to work: yes/); assert.match(human.text, /Adapter: 9.9.9/);
  assert.doesNotMatch(human.text, /POP|TSK|Authority Index|BINDING_INACTIVE/);
  const json = JSON.parse((await invoke(c, 'status', ['--json'])).text);
  assert.equal(json.readyToWork, true); assert.equal(json.telemetry, 'ready-on-start'); assert.equal(json.project, 'acme-billing');
  assert.equal(json.repository, await realpath(c.root)); assert.equal(json.selectedAdapterVersion, '9.9.9');
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
});

test('missing dashboard or failed telemetry preflight degrades observability without blocking valid start', async (t) => {
  const c = await prepared(t, true);
  const noDashboard = await mkdtemp(path.join(os.tmpdir(), 'consumer-no-dashboard-'));
  t.after(() => rm(noDashboard, { recursive: true, force: true }));
  const before = await listTree(c.root);
  for (const [dashboard, telemetry] of [[false, true], [true, false], [false, false]]) {
    const overrides = {
      packageRoot: dashboard ? presentationPackage.root : noDashboard,
      env: telemetry ? {} : { DEV_FOUNDRY_TELEMETRY_PORT: '65536' },
    };
    for (const command of ['status', 'doctor']) {
      const result = await invoke(c, command, ['--json'], overrides);
      const data = JSON.parse(result.text);
      assert.equal(result.code, 0);
      assert.equal(data.readyToWork, true);
      assert.equal(data.integration, 'ready');
      assert.equal(data.observability, 'degraded');
      assert.equal(data.telemetry, telemetry ? 'ready-on-start' : 'not-ready');
      assert.equal(data.dashboardAvailable, dashboard);
      assert.equal(data.diagnostics.includes('telemetry-not-ready'), !telemetry);
      assert.equal(data.diagnostics.includes('dashboard-unavailable'), !dashboard);
      if (command === 'doctor') {
        assert.equal(data.checks.telemetry, telemetry);
        assert.equal(data.checks.dashboard, dashboard);
        for (const key of ['runtimePin', 'managedSurface', 'activation', 'runtime']) assert.equal(data.checks[key], true);
      }
      const human = await invoke(c, command, [], overrides);
      assert.match(human.text, /Ready to work: yes/);
      assert.match(human.text, /observability.*degraded/i);
      if (command === 'doctor') assert.match(human.text, /operation-ready; observability degraded/);
    }
    let calls = 0;
    const result = await invoke(c, 'start', ['--runtime', 'dial', '--', '-p', 'literal payload'], {
      ...overrides,
      launcher: async (options) => {
        calls++;
        assert.deepEqual(options.argv, ['--runtime', 'dial', '--', '-p', 'literal payload']);
        assert.equal(options.projectRoot, await realpath(c.root));
        assert.equal(options.telemetryPreflight, telemetry);
        assert.equal(options.env, overrides.env);
        if (telemetry) options.onReady({ port: 12345 });
        return 0;
      },
    });
    assert.equal(result.code, 0);
    assert.equal(calls, 1);
    assert.match(result.text, /Warning: optional/);
    if (!dashboard) assert.doesNotMatch(result.text, /dashboard --port/);
    if (!telemetry) assert.doesNotMatch(result.text, /preflight passed|Local telemetry is ready/);
  }
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
});

test('degraded observability never hides inactive integration, exact payload mismatch or missing runtime', async (t) => {
  const active = await prepared(t, true);
  const inactive = await prepared(t);
  const mismatch = { ...adapterIdentity, payloadRoot: 'e'.repeat(64), expect: `${adapterIdentity.version}:sha256:${'e'.repeat(64)}` };
  for (const [c, overrides, expected] of [
    [inactive, {}, /owner.*approve/],
    [active, { getAdapter: () => mismatch }, /brought into sync/],
    [active, { executableAvailable: () => false }, /executable is unavailable/],
  ]) {
    const before = await listTree(c.root);
    let calls = 0;
    const options = { env: { DEV_FOUNDRY_TELEMETRY_PORT: 'invalid' }, ...overrides };
    const result = await invoke(c, 'start', [], { ...options, launcher: async () => { calls++; return 0; } });
    assert.equal(result.code, 2);
    assert.equal(calls, 0);
    assert.match(result.text, expected);
    const status = await invoke(c, 'doctor', ['--json'], options);
    const data = JSON.parse(status.text);
    assert.equal(status.code, 2);
    assert.equal(data.readyToWork, false);
    assert.equal(data.observability, 'degraded');
    if (overrides.getAdapter) assert.ok(data.diagnostics.includes('adapter-runtime-mismatch'));
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  }
});

test('setup managed preparation preserves an already active project and recommends start', async (t) => {
  const c = await prepared(t, true);
  const authority = await readSetSnapshot(c.root);
  await c.put('.dev-foundry/.gitignore', (await c.read('.dev-foundry/.gitignore')).replace('/telemetry/local/\n', '')); c.commit();
  const before = await listTree(c.root);
  const result = await invoke(c, 'setup', ['--yes', '--json']);
  const data = JSON.parse(result.text);
  assert.equal(data.readyToWork, true); assert.equal(data.integration, 'ready');
  assert.equal(data.nextAction, 'dev-foundry-claude start');
  assert.doesNotMatch(data.summary, /owner.*approve/);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), ['.dev-foundry/.gitignore']);
  assert.deepEqual(await readSetSnapshot(c.root), authority);
});

test('doctor is read-only, healthy or recoverable, with technical detail only on request', async (t) => {
  const c = await prepared(t, true);
  const healthy = await invoke(c, 'doctor', ['--json']);
  assert.equal(healthy.code, 0); assert.ok(Object.values(JSON.parse(healthy.text).checks).every(Boolean));
  await c.put('.claude/agents/dev-foundry-executor.md', 'custom product agent\n'); c.commit();
  const before = await listTree(c.root);
  const human = await invoke(c, 'doctor');
  assert.equal(human.code, 2); assert.match(human.text, /attention needed/); assert.match(human.text, /Next: dev-foundry-claude upgrade/);
  assert.doesNotMatch(human.text, /agent-file-collision/);
  assert.match((await invoke(c, 'doctor', ['--verbose'])).text, /agent-file-collision/);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
});

test('diagnostics handle missing runtime, invalid telemetry port, symlink telemetry, no Git and payload failure', async (t) => {
  const c = await prepared(t, true);
  const missing = await invoke(c, 'doctor', ['--json'], { executableAvailable: () => false });
  assert.equal(JSON.parse(missing.text).checks.runtime, false); assert.equal(missing.code, 2);
  const port = await invoke(c, 'doctor', ['--json'], { env: { DEV_FOUNDRY_TELEMETRY_PORT: '65536' } });
  assert.equal(JSON.parse(port.text).checks.telemetry, false);
  assert.equal(port.code, 0); assert.equal(JSON.parse(port.text).readyToWork, true);
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'consumer-telemetry-')); t.after(() => rm(scratch, { recursive: true, force: true }));
  await mkdir(path.join(c.root, '.dev-foundry/telemetry'), { recursive: true });
  await symlink(scratch, path.join(c.root, '.dev-foundry/telemetry/local'), 'dir');
  assert.equal((await inspectConsumer(inspectOptions(c))).telemetry, 'not-ready');
  const noGit = await invoke({ root: scratch }, 'doctor'); assert.equal(noGit.code, 2); assert.match(noGit.text, /Open a Git project/);
  const payload = await invoke(c, 'status', ['--json'], { getAdapter: () => { throw new Error(); } });
  assert.equal(payload.code, 1); assert.equal(JSON.parse(payload.text).payloadVerified, false);
});

test('guided upgrade keeps compatible pin-only flow and requires explicit apply intent', async (t) => {
  const c = await prepared(t);
  const target = { version: '1.4.0', payloadRoot: 'e'.repeat(64), expect: `1.4.0:sha256:${'e'.repeat(64)}` };
  const before = await listTree(c.root);
  const planned = await invoke(c, 'upgrade', [], { getAdapter: () => target });
  assert.match(planned.text, /compatible runtime pin upgrade/); assert.match(planned.text, /Application files affected: 0/);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  const result = await invoke(c, 'upgrade', ['--yes', '--json'], { getAdapter: () => target });
  assert.equal(JSON.parse(result.text).applied.written, 1);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), ['.mcp.json']);
});

test('canonical help covers all topics; CLI output is exactly the resource content', async () => {
  assert.equal(Object.keys(helpTopics).length, 7);
  for (const topic of Object.keys(helpTopics)) {
    const result = await invoke({ root: os.tmpdir() }, 'help', [topic]);
    assert.equal(result.text + '\n', renderHelp(topic)); assert.equal(helpUri(topic), `dev-foundry://help/${topic}`);
  }
  assert.match((await invoke({ root: os.tmpdir() }, 'help')).text, /setup[\s\S]*start/);
  assert.match(renderHelp('start'), /collector and dashboard are optional/);
  assert.match(renderHelp('start'), /Claude Desktop[\s\S]*preconfigured valid[\s\S]*without start/);
  for (const topic of ['getting-started', 'start', 'upgrade', 'cutover']) {
    assert.match(renderHelp(topic), /fresh host session/);
    assert.match(renderHelp(topic), /start is optional/);
  }
});

test('primary command option validation refuses ambiguity without mutation', async (t) => {
  const c = await prepared(t);
  const before = await listTree(c.root);
  for (const [command, args] of [['start', ['--runtime', 'other']], ['setup', ['--root']], ['doctor', ['--yes']], ['status', ['--json', '--json']], ['upgrade', ['--from-package']], ['help', ['setup', 'start']]]) {
    await assert.rejects(invoke(c, command, args), { exitCode: 2 });
  }
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
});
