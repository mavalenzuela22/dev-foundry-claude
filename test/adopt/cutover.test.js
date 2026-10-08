import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { pathToFileURL } from 'node:url';
import { parse, parseDocument } from 'yaml';
import { applyPlan } from '../../src/adopt/apply.js';
import { createPlan } from '../../src/adopt/plan.js';
import { evaluateActivation } from '../../src/adopt/activation.js';
import { BOOTSTRAP_PATH, CUTOVER_DIR, INDEX_PATH, POP_PATH, PROFILE_PATHS, ROLES, TARGETS, safeRelativePath } from '../../src/adopt/common.js';
import { commitCutover, createCutoverPlan, diagnoseCutover, prepareCutover, recoverCutover } from '../../src/adopt/cutover.js';
import { buildManifestBytes, canonicalJson, selfPin, sha256 } from '../../src/adopt/pin.js';
import { createSessionGuard } from '../../src/governance-mcp/session.js';
import { resolveGovernedOperation } from '../../src/governance-mcp/resolver.js';
import { consumerCommand, inspectConsumer } from '../../src/consumer/command.js';
import { renderHelp } from '../../src/consumer/help.js';
import { diffTrees, gitIn, listTree, makeConsumer, repoRoot, treeHash } from './fixture.js';

// Synthetic immutable package with real integrity verification and shipped templates.
const packageRoot = await mkdtemp(path.join(os.tmpdir(), 'cutover-package-'));
await cp(path.join(repoRoot, 'templates'), path.join(packageRoot, 'templates'), { recursive: true });
await writeFile(path.join(packageRoot, 'package.json'), '{"name":"synthetic-cutover-runtime","version":"1.4.0"}\n');
const entries = [];
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) await collect(path.join(directory, entry.name), file);
    else { const bytes = await readFile(path.join(directory, entry.name)); entries.push({ path: file, sha256: sha256(bytes), size: bytes.length }); }
  }
}
await collect(packageRoot);
await writeFile(path.join(packageRoot, 'payload-manifest.json'), buildManifestBytes({ version: '1.4.0', entries }));
const pin = selfPin(packageRoot);
const adapter = { version: pin.version, payloadRoot: pin.root, expect: pin.expect };
after(() => rm(packageRoot, { recursive: true, force: true }));

let seed;
after(() => seed?.original.cleanup());
async function fixture(t, { crlf = false } = {}) {
  if (!seed) {
    const original = await makeConsumer();
    await original.put('.dev-foundry/validations/source.json', '{"status":"PASS","synthetic":true}\n');
    original.commit();
    const ordinary = await createPlan({ root: original.root, adapter });
    assert.equal(ordinary.plan.status, 'ready');
    await applyPlan({ root: original.root, adapter, planBytes: ordinary.bytes, planSha256: ordinary.hash });
    original.commit();
    seed = { original, result: await createCutoverPlan({ root: original.root, packageRoot }) };
  }
  const root = await mkdtemp(path.join(os.tmpdir(), 'cutover-isolated-'));
  await cp(seed.original.root, root, { recursive: true });
  const c = { root, read: (file) => readFile(path.join(root, file), 'utf8'),
    put: async (file, bytes) => { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), bytes); },
    commit: () => { gitIn(root, 'add', '-A'); gitIn(root, 'commit', '-q', '-m', 'synthetic step', '--allow-empty'); },
    cleanup: () => rm(root, { recursive: true, force: true }) };
  t.after(c.cleanup);
  if (crlf) {
    for (const file of [POP_PATH, INDEX_PATH, '.dev-foundry/platform-bootstrap.yaml']) await c.put(file, (await c.read(file)).replaceAll('\n', '\r\n'));
    c.commit();
  }
  const result = crlf ? await createCutoverPlan({ root: c.root, packageRoot }) : seed.result;
  assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers));
  const ref = async (file) => ({ path: file, sha256: sha256(await c.read(file)) });
  const authorization = {
    format: 'dev-foundry.cutover-authorization.v1', project: result.plan.source.project, operator: 'Acme Operator',
    planSha256: result.hash, sourceHead: result.plan.source.head, sourceBranch: result.plan.source.branch,
    targetExpect: result.plan.target.adapter.expect, actorBindings: result.plan.target.actorBindings,
    bootstrap: result.plan.target.bootstrap, allowedPaths: result.plan.files.map((item) => item.path),
    operatorApproved: true, governedApproval: true, decisionsResolved: true, sourceWorkDisposition: 'handed-off',
    task: await ref('docs/70-tasks/TSK-001.md'), validation: { status: 'PASS', ...await ref('.dev-foundry/validations/source.json') },
    audit: { status: 'not-required', reason: 'Synthetic consumer authority declares no audit trigger.' },
  };
  const input = { root: c.root, packageRoot, planBytes: result.bytes, planSha256: result.hash, authorization };
  return { c, result, input };
}
const preserved = (tree) => new Map([...tree].filter(([file]) => file.startsWith('src/') || file.startsWith('docs/') ||
  file.startsWith('.dev-foundry/releases/') || file.startsWith('.dev-foundry/validations/')));
async function complete(c, plan, outcome) {
  for (const item of plan.files) {
    const actual = await readFile(path.join(c.root, item.path)).catch((error) => { if (error.code === 'ENOENT') return null; throw error; });
    assert.equal(actual === null ? 'absent' : sha256(actual), outcome === 'target' ? item.after_sha256 : item.before_sha256, item.path);
  }
  const activation = await evaluateActivation(c.root);
  assert.equal(activation.overall, outcome === 'target' ? 'active' : 'prepared', JSON.stringify(activation));
  if (outcome === 'target') {
    const pop = parse(await c.read(POP_PATH));
    for (const role of ROLES) assert.deepEqual(pop.actor_bindings[role].implementation, {
      kind: TARGETS[role].kind, identity: TARGETS[role].identity, platform: 'claude-code',
    });
    assert.equal(parse(await c.read('.dev-foundry/platform-bootstrap.yaml')).status, 'retired');
    assert.equal(Object.values(pop.platform_bootstraps).filter((entry) => entry.status === 'active').length, 1);
  }
}

test('exact plan is read-only and deterministic; staging is inert; complete source becomes complete Claude target', async (t) => {
  const { c, result, input } = await fixture(t);
  const before = await listTree(c.root);
  assert.equal((await createCutoverPlan({ root: c.root, packageRoot })).hash, result.hash);
  assert.deepEqual(await listTree(c.root), before);
  assert.equal(result.plan.productFilesAffected, 0);
  assert.equal(result.plan.atomic, false);
  assert.equal(result.plan.files.length, 6);
  for (const item of result.plan.files) assert.ok(item.diff);
  const guard = await createSessionGuard(c.root, adapter.expect);
  assert.equal(await guard(), null);
  await prepareCutover(input);
  assert.equal(await guard(), null);
  assert.equal((await evaluateActivation(c.root)).overall, 'prepared');
  const staged = await listTree(c.root);
  assert.ok(diffTrees(before, staged).every((file) => file.startsWith(CUTOVER_DIR + '/')));
  for (const file of [BOOTSTRAP_PATH, ...Object.values(PROFILE_PATHS)]) assert.equal(staged.has(file), false);
  await commitCutover(input);
  await complete(c, result.plan, 'target');
  assert.deepEqual(preserved(await listTree(c.root)), preserved(before));
  assert.equal((await guard()).errorCode, 'STALE_SESSION');
  assert.equal(await (await createSessionGuard(c.root, adapter.expect))(), null);
  const ordinary = await createPlan({ root: c.root, adapter });
  assert.equal(ordinary.plan.status, 'noop', JSON.stringify(ordinary.plan.blockers));
  const recovered = await recoverCutover({ ...input, outcome: 'target' });
  assert.equal(recovered.status, 'complete');
  await assert.rejects(recoverCutover({ ...input, outcome: 'source' }), { code: 'recovery-already-settled' });
});

test('missing/wrong authorization, unresolved decisions, failed validation/audit and hashes write nothing', async (t) => {
  const { c, input } = await fixture(t);
  const baseline = await treeHash(c.root);
  for (const change of [
    null, { operatorApproved: false }, { governedApproval: false }, { decisionsResolved: false },
    { operator: 'someone else' }, { targetExpect: '1.4.0:sha256:' + '0'.repeat(64) }, { sourceHead: 'wrong' },
    { allowedPaths: [] }, { actorBindings: {} }, { bootstrap: {} }, { sourceWorkDisposition: 'open' },
    { validation: { status: 'FAIL' } }, { audit: { status: 'pending' } },
    { task: { path: 'docs/70-tasks/TSK-001.md', sha256: '0'.repeat(64) } },
  ]) {
    await assert.rejects(prepareCutover({ ...input, authorization: change === null ? undefined : { ...input.authorization, ...change } }));
    assert.equal(await treeHash(c.root), baseline);
  }
  await assert.rejects(prepareCutover({ ...input, planSha256: '0'.repeat(64) }), { code: 'plan-hash-mismatch' });
  assert.equal(await treeHash(c.root), baseline);
  await prepareCutover(input);
  const staged = await treeHash(c.root);
  await assert.rejects(commitCutover({ ...input, authorization: undefined }), { code: 'consumer-authorization-required' });
  await assert.rejects(recoverCutover({ ...input, authorization: undefined, outcome: 'target' }), { code: 'consumer-authorization-required' });
  assert.equal(await treeHash(c.root), staged);
});

test('source branch/HEAD, present/absent bytes, package and exact MCP selection cannot drift', async (t) => {
  for (const mutation of ['head', 'branch', 'pop', 'absent', 'mcp', 'actor', 'capability']) {
    await t.test(mutation, async (st) => {
      const { c, input } = await fixture(st);
      if (mutation === 'head') c.commit();
      if (mutation === 'branch') gitIn(c.root, 'checkout', '-q', '-b', 'drift');
      if (mutation === 'pop') await c.put(POP_PATH, (await c.read(POP_PATH)) + '# drift\n');
      if (mutation === 'absent') await c.put(BOOTSTRAP_PATH, 'status: active\n');
      if (mutation === 'mcp') await c.put('.mcp.json', (await c.read('.mcp.json')).replace(adapter.expect, '1.4.0:sha256:' + 'd'.repeat(64)));
      if (mutation === 'actor') await c.put(input.authorization.actorBindings['governance-author'].profile, 'status: retired\n');
      if (mutation === 'capability') await c.put('.dev-foundry/profiles/capability-profiles/implementation-executor-runner-v2.yaml', 'status: retired\n');
      const before = await treeHash(c.root);
      await assert.rejects(prepareCutover(input));
      assert.equal(await treeHash(c.root), before);
    });
  }
  const { c } = await fixture(t);
  const other = await mkdtemp(path.join(os.tmpdir(), 'cutover-other-package-'));
  t.after(() => rm(other, { recursive: true, force: true }));
  await cp(packageRoot, other, { recursive: true });
  await writeFile(path.join(other, 'package.json'), '{}');
  const before = await treeHash(c.root);
  const result = await createCutoverPlan({ root: c.root, packageRoot: other });
  assert.equal(result.plan.status, 'blocked');
  assert.equal(result.plan.blockers[0].code, 'package-unverified');
  assert.equal(await treeHash(c.root), before);
});

test('preparation failure at each durable staging boundary resumes without publishing authority', async (t) => {
  for (const phase of ['intent', ...Array.from({ length: 6 }, (_, i) => 'stage:' + i), 'prepared']) {
    await t.test(phase, async (st) => {
      const { c, result, input } = await fixture(st);
      const source = preserved(await listTree(c.root));
      await assert.rejects(prepareCutover({ ...input, fault: (event) => { if (event === phase) throw new Error('injected'); } }), /injected/);
      assert.equal((await evaluateActivation(c.root)).overall, 'prepared');
      await prepareCutover(input);
      await commitCutover(input);
      await complete(c, result.plan, 'target');
      assert.deepEqual(preserved(await listTree(c.root)), source);
    });
  }
});

// Enumerate real transition events, including the gap between each pair of renames.
let commitPhases;
test('enumerate all commit boundaries with no mixed authority ever accepted', async (t) => {
  const { c, input } = await fixture(t);
  await prepareCutover(input);
  commitPhases = [];
  await commitCutover({ ...input, fault: async (event) => {
    commitPhases.push(event);
    if (event !== 'verified' && event !== 'done') {
      assert.equal((await evaluateActivation(c.root)).overall, 'partial');
      const pop = parse(await c.read(POP_PATH).catch(() => ''));
      if (pop?.status === 'active') assert.ok(ROLES.every((role) => pop.actor_bindings[role].implementation.platform === 'claude-code') ||
        ROLES.every((role) => pop.actor_bindings[role].implementation.platform === 'runner'));
    }
  } });
  assert.ok(commitPhases.includes('barrier:remove:5'));
  assert.ok(commitPhases.some((event) => event.startsWith('target:remove:')));
});

test('interruption at EVERY commit boundary deterministically resumes or rolls back', async (t) => {
  assert.ok(commitPhases.length > 15);
  for (const phase of commitPhases) {
    for (const outcome of phase === 'done' ? ['target'] : ['source', 'target']) {
      await t.test(phase + ' -> ' + outcome, async (st) => {
        const { c, result, input } = await fixture(st);
        const before = await listTree(c.root);
        const guard = await createSessionGuard(c.root, adapter.expect);
        await prepareCutover(input);
        await assert.rejects(commitCutover({ ...input, fault: (event) => { if (event === phase) throw new Error('injected'); } }), /injected/);
        if (phase !== 'verified' && phase !== 'done') assert.equal((await evaluateActivation(c.root)).overall, 'partial');
        await recoverCutover({ ...input, outcome });
        await complete(c, result.plan, outcome);
        assert.deepEqual(preserved(await listTree(c.root)), preserved(before));
        assert.equal((await guard()).errorCode, 'STALE_SESSION');
        const again = await treeHash(c.root);
        await recoverCutover({ ...input, outcome });
        assert.equal(await treeHash(c.root), again);
      });
    }
  }
});

test('real process exit during rename gap leaves durable intent; another process recovers', async (t) => {
  const { c, result, input } = await fixture(t);
  await prepareCutover(input);
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'cutover-crash-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const inputFile = path.join(scratch, 'input.json');
  await writeFile(inputFile, canonicalJson({ ...input, planBytes: undefined }));
  const module = pathToFileURL(path.join(repoRoot, 'src/adopt/cutover.js')).href;
  const code = 'import {readFileSync} from "node:fs"; import {commitCutover,recoverCutover} from ' + JSON.stringify(module) + '; const input=JSON.parse(readFileSync(process.argv[1])); ' +
    'if(process.argv[2]==="crash") await commitCutover({...input,fault:(phase)=>{if(phase==="target:remove:0")process.exit(77)}}); else await recoverCutover({...input,outcome:"target"});';
  const crash = spawnSync(process.execPath, ['--input-type=module', '-e', code, inputFile, 'crash'], { encoding: 'utf8' });
  assert.equal(crash.status, 77, crash.stderr);
  assert.equal((await evaluateActivation(c.root)).overall, 'partial');
  const recovery = spawnSync(process.execPath, ['--input-type=module', '-e', code, inputFile, 'recover'], { encoding: 'utf8' });
  assert.equal(recovery.status, 0, recovery.stderr);
  await complete(c, result.plan, 'target');
});

test('Windows paths are refused portably; CRLF source bytes round-trip through rollback exactly', async (t) => {
  for (const file of ['../escape', '/absolute', 'C:/authority.yaml', 'C:\\authority.yaml', '\\\\server\\share\\file',
    'profiles\\..\\escape', 'file:stream', 'profiles/CON.yaml', 'profiles/NUL', 'name./file', 'name /file', './file', 'a//b']) {
    assert.equal(safeRelativePath(file), false, file);
  }
  assert.equal(safeRelativePath('.dev-foundry/profiles/correct.yaml'), true);
  const { c, result, input } = await fixture(t, { crlf: true });
  const before = await listTree(c.root);
  assert.ok(result.plan.files.find((item) => item.path === POP_PATH).before.includes('\r\n'));
  await prepareCutover(input);
  await assert.rejects(commitCutover({ ...input, fault: (phase) => { if (phase === 'authority-set') throw Object.assign(new Error('Windows busy-file simulation'), { code: 'EBUSY' }); } }));
  await recoverCutover({ ...input, outcome: 'source' });
  await complete(c, result.plan, 'source');
  assert.ok(diffTrees(before, await listTree(c.root)).every((file) => file.startsWith(CUTOVER_DIR + '/')));
});

test('symlinked authority and target parents cannot read or write outside the synthetic consumer', async (t) => {
  for (const name of ['pop', 'profile-parent', 'transaction']) {
    await t.test(name, async (st) => {
      const { c, input } = await fixture(st);
      const outside = await mkdtemp(path.join(os.tmpdir(), 'cutover-outside-'));
      st.after(() => rm(outside, { recursive: true, force: true }));
      await writeFile(path.join(outside, 'sentinel'), 'unchanged');
      if (name === 'pop') {
        await cp(path.join(c.root, POP_PATH), path.join(outside, 'pop.yaml'));
        await rm(path.join(c.root, POP_PATH));
        await symlink(path.join(outside, 'pop.yaml'), path.join(c.root, POP_PATH));
      } else if (name === 'profile-parent') {
        const directory = '.dev-foundry/profiles/capability-profiles';
        await cp(path.join(c.root, directory), outside, { recursive: true });
        await rm(path.join(c.root, directory), { recursive: true });
        await symlink(outside, path.join(c.root, directory), 'dir');
      } else await symlink(outside, path.join(c.root, CUTOVER_DIR), 'dir');
      const untouched = await treeHash(outside);
      await assert.rejects(prepareCutover(input));
      assert.equal(await treeHash(outside), untouched);
      assert.notEqual((await evaluateActivation(c.root)).overall, 'active');
    });
  }
});

test('unknown partial authority, staged edits and unrelated transaction files stay blocked with no extra deletion', async (t) => {
  for (const corruption of ['partial', 'stage', 'extra', 'intent', 'authority', 'missing']) {
    await t.test(corruption, async (st) => {
      const { c, input } = await fixture(st);
      if (corruption === 'partial') {
        await c.put(PROFILE_PATHS.executor, 'status: active\n');
        const before = await treeHash(c.root);
        const plan = await createCutoverPlan({ root: c.root, packageRoot });
        assert.equal(plan.plan.status, 'blocked');
        assert.equal(await treeHash(c.root), before);
        return;
      }
      await prepareCutover(input);
      if (corruption === 'stage') await c.put(CUTOVER_DIR + '/target-0.json', 'modified');
      if (corruption === 'extra') await c.put(CUTOVER_DIR + '/do-not-delete', 'unrelated');
      if (corruption === 'intent') await c.put(CUTOVER_DIR + '/intent.json', '{}');
      if (corruption === 'authority') await c.put(POP_PATH, (await c.read(POP_PATH)) + '# modified\n');
      if (corruption === 'missing') await rm(path.join(c.root, INDEX_PATH));
      const before = await treeHash(c.root);
      await assert.rejects(recoverCutover({ ...input, outcome: 'target' }));
      assert.equal(await treeHash(c.root), before);
      const diagnosis = await diagnoseCutover({ root: c.root, packageRoot });
      assert.equal(diagnosis.blocked, true);
      assert.equal(await treeHash(c.root), before);
    });
  }
});

test('start/status/doctor and ordinary setup, upgrade and adopt cannot treat an in-flight cutover as ready', async (t) => {
  const { c, input } = await fixture(t);
  await prepareCutover(input);
  const oldGuard = await createSessionGuard(c.root, adapter.expect);
  await assert.rejects(commitCutover({ ...input, fault: (event) => { if (event === 'barrier:remove:5') throw new Error('injected'); } }));
  assert.equal((await oldGuard()).errorCode, 'STALE_SESSION');
  assert.equal((await (await createSessionGuard(c.root, adapter.expect))()).errorCode, 'STALE_SESSION');
  const view = await inspectConsumer({ root: c.root, packageRoot, adapter, executableAvailable: () => true });
  assert.equal(view.readyToWork, false);
  assert.equal(view.integration, 'cutover-in-flight');
  let launches = 0;
  for (const [command, argv] of [['start', []], ['status', ['--json']], ['doctor', ['--json']], ['setup', ['--yes']], ['upgrade', ['--yes']]]) {
    const before = await treeHash(c.root);
    const code = await consumerCommand({ command, argv, cwd: c.root, packageRoot, getAdapter: () => adapter,
      executableAvailable: () => true, launcher: () => { launches += 1; return 0; }, output: () => {} });
    assert.notEqual(code, 0, command);
    assert.equal(await treeHash(c.root), before);
  }
  assert.equal(launches, 0);
  const plan = await createPlan({ root: c.root, adapter, remove: true });
  assert.equal(plan.plan.status, 'blocked');
  assert.ok(plan.plan.blockers.some((item) => item.code === 'cutover-in-flight'));
  // The unguarded resolver also refuses an absent/inactive POP. This models a
  // read-only foreign observer without granting it an active role.
  const result = await resolveGovernedOperation({ targetProject: 'acme-billing', requestedAction: 'author', targetArtifactType: 'TSK' }, { projectRoot: c.root });
  assert.equal(result.ok, false);
  await recoverCutover({ ...input, outcome: 'target' });
  assert.equal((await oldGuard()).errorCode, 'STALE_SESSION');
});

test('recovery is itself recoverable at every rollback boundary and its chosen direction is immutable', async (t) => {
  const initial = await fixture(t);
  await prepareCutover(initial.input);
  await assert.rejects(commitCutover({ ...initial.input, fault: (event) => { if (event === 'pop-active') throw new Error('injected'); } }));
  const phases = [];
  await recoverCutover({ ...initial.input, outcome: 'source', fault: (event) => { phases.push(event); } });
  assert.ok(phases.some((event) => event.startsWith('source:remove:')));
  for (const phase of phases) {
    await t.test(phase, async (st) => {
      const { c, result, input } = await fixture(st);
      await prepareCutover(input);
      await assert.rejects(commitCutover({ ...input, fault: (event) => { if (event === 'pop-active') throw new Error('injected'); } }));
      await assert.rejects(recoverCutover({ ...input, outcome: 'source', fault: (event) => { if (event === phase) throw new Error('injected recovery'); } }), /injected recovery/);
      if (phase !== 'done') {
        assert.equal((await evaluateActivation(c.root)).overall, 'partial');
        await assert.rejects(recoverCutover({ ...input, outcome: 'target' }));
      }
      await recoverCutover({ ...input, outcome: 'source' });
      await complete(c, result.plan, 'source');
    });
  }
});

test('live concurrent operation is rejected; completed target rejects extra foreign roles and wrong bootstrap semantics', async (t) => {
  const { c, result, input } = await fixture(t);
  await prepareCutover(input);
  await commitCutover({ ...input, fault: async (event) => {
    if (event === 'verified') await assert.rejects(commitCutover(input), { code: 'cutover-locked' });
  } });
  await complete(c, result.plan, 'target');
  const bootstrap = await c.read(BOOTSTRAP_PATH);
  const wrong = parseDocument(bootstrap);
  wrong.setIn(['sources', 'authority_index'], 'wrong.yaml');
  await c.put(BOOTSTRAP_PATH, wrong.toString());
  assert.equal((await evaluateActivation(c.root)).overall, 'partial');
  await c.put(BOOTSTRAP_PATH, bootstrap);
  const pop = parseDocument(await c.read(POP_PATH));
  pop.setIn(['actor_bindings', 'external-observer'], pop.createNode({ status: 'active', implementation: { platform: 'chatgpt-project', identity: 'windows-runner' } }));
  await c.put(POP_PATH, pop.toString());
  assert.equal((await evaluateActivation(c.root)).overall, 'partial');
  assert.match(renderHelp('cutover'), /prepare.*plan.*plan-sha256.*authorization/);
  assert.match(renderHelp('setup'), /cutover plan/);
  assert.match(renderHelp(), /cutover/);
});

test('torn unpublished journal/install material is inert, retained and rebuilt during explicit recovery', async (t) => {
  for (const outcome of ['source', 'target']) {
    await t.test(outcome, async (st) => {
      const { c, result, input } = await fixture(st);
      await prepareCutover(input);
      await assert.rejects(commitCutover({ ...input, fault: (event) => { if (event === 'authority-set') throw new Error('injected'); } }));
      const popSlot = result.plan.files.findIndex((item) => item.path === POP_PATH);
      const pop = result.plan.files[popSlot];
      const hash = outcome === 'target' ? pop.after_sha256 : pop.before_sha256;
      await c.put(CUTOVER_DIR + '/install-' + popSlot + '-' + hash + '.bytes.pending', 'torn inert material');
      await c.put(CUTOVER_DIR + '/done.json.pending', '{"torn":');
      await recoverCutover({ ...input, outcome });
      await complete(c, result.plan, outcome);
      const names = await readdir(path.join(c.root, CUTOVER_DIR));
      assert.ok(names.includes('record-fragment-' + sha256('{"torn":') + '.bytes'));
      assert.ok(names.includes('record-fragment-' + sha256('torn inert material') + '.bytes'));
    });
  }
});

test('installed CLI exposes plan/prepare/commit/status/recover; legacy run cannot bypass the startup gate', async (t) => {
  const runtime = await mkdtemp(path.join(os.tmpdir(), 'cutover-cli-package-'));
  t.after(() => rm(runtime, { recursive: true, force: true }));
  for (const name of ['src', 'bin', 'templates', 'framework']) await cp(path.join(repoRoot, name), path.join(runtime, name), { recursive: true });
  await cp(path.join(repoRoot, 'node_modules'), path.join(runtime, 'node_modules'), {
    recursive: true, filter: (source) => !source.includes(path.sep + '.bin'),
  });
  await cp(path.join(repoRoot, 'package.json'), path.join(runtime, 'package.json'));
  const files = [];
  const walk = async (directory, prefix = '') => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = prefix ? prefix + '/' + entry.name : entry.name;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), file);
      else { const bytes = await readFile(path.join(directory, entry.name)); files.push({ path: file, sha256: sha256(bytes), size: bytes.length }); }
    }
  };
  await walk(runtime);
  const { version } = JSON.parse(await readFile(path.join(runtime, 'package.json'), 'utf8'));
  await writeFile(path.join(runtime, 'payload-manifest.json'), buildManifestBytes({ version, entries: files }));
  const identity = selfPin(runtime);
  const selected = { version: identity.version, payloadRoot: identity.root, expect: identity.expect };
  const c = await makeConsumer();
  t.after(c.cleanup);
  await c.put('.dev-foundry/validations/source.json', '{"status":"PASS"}\n');
  c.commit();
  const ordinary = await createPlan({ root: c.root, adapter: selected });
  await applyPlan({ root: c.root, adapter: selected, planBytes: ordinary.bytes, planSha256: ordinary.hash });
  c.commit();
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'cutover-cli-inputs-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const cli = (...args) => spawnSync(process.execPath, [path.join(runtime, 'bin/dev-foundry-claude.js'), ...args], { cwd: c.root, encoding: 'utf8', timeout: 60000 });
  const planFile = path.join(scratch, 'plan.json');
  const planned = cli('cutover', 'plan', '--out', planFile, '--json');
  assert.equal(planned.status, 0, planned.stderr);
  const hash = JSON.parse(planned.stdout).planSha256;
  const planBytes = await readFile(planFile);
  const plan = JSON.parse(planBytes);
  const base = await treeHash(c.root);
  const refused = cli('cutover', 'prepare', '--plan', planFile, '--plan-sha256', hash);
  assert.equal(refused.status, 2);
  assert.equal(await treeHash(c.root), base);
  const ref = async (file) => ({ path: file, sha256: sha256(await c.read(file)) });
  const authorization = { format: 'dev-foundry.cutover-authorization.v1', project: plan.source.project, operator: 'Acme Operator',
    planSha256: hash, sourceHead: plan.source.head, sourceBranch: plan.source.branch, targetExpect: selected.expect,
    actorBindings: plan.target.actorBindings, bootstrap: plan.target.bootstrap, allowedPaths: plan.files.map((file) => file.path),
    operatorApproved: true, governedApproval: true, decisionsResolved: true, sourceWorkDisposition: 'closed',
    task: await ref('docs/70-tasks/TSK-001.md'), validation: { status: 'PASS', ...await ref('.dev-foundry/validations/source.json') },
    audit: { status: 'PASS', ...await ref('.dev-foundry/validations/source.json') } };
  const authFile = path.join(scratch, 'authorization.json');
  await writeFile(authFile, canonicalJson(authorization));
  const approved = ['--plan-sha256', hash, '--authorization', authFile, '--json'];
  const prepared = cli('cutover', 'prepare', '--plan', planFile, ...approved);
  assert.equal(prepared.status, 0, prepared.stderr);
  assert.equal(JSON.parse(prepared.stdout).status, 'prepared');
  await assert.rejects(commitCutover({ root: c.root, packageRoot: runtime, planSha256: hash, authorization,
    fault: (phase) => { if (phase === 'commit-intent') throw new Error('injected'); } }));
  const blockedRun = cli('run', 'direct', '--', '--version');
  assert.notEqual(blockedRun.status, 0);
  assert.match(blockedRun.stderr, /cutover needs explicit recovery/);
  const status = cli('cutover', 'status', '--json');
  assert.equal(status.status, 2);
  assert.equal(JSON.parse(status.stdout).blocked, true);
  const recovered = cli('cutover', 'recover', '--outcome', 'target', ...approved);
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal(JSON.parse(recovered.stdout).restartRequired, true);
  await complete(c, plan, 'target');
  const again = cli('cutover', 'recover', '--outcome', 'target', ...approved);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(cli('cutover', 'status', '--json').status, 0);
});

test('unresolved target YAML semantics fail before staging; a claimed PASS cannot override FAIL evidence', async (t) => {
  const c = await makeConsumer({ name: 'unsafe: project' });
  t.after(c.cleanup);
  const ordinary = await createPlan({ root: c.root, adapter });
  assert.equal(ordinary.plan.status, 'ready');
  await applyPlan({ root: c.root, adapter, planBytes: ordinary.bytes, planSha256: ordinary.hash });
  c.commit();
  const before = await treeHash(c.root);
  const invalid = await createCutoverPlan({ root: c.root, packageRoot });
  assert.equal(invalid.plan.status, 'blocked');
  assert.equal(invalid.plan.blockers[0].code, 'target-semantics-invalid');
  assert.equal(await treeHash(c.root), before);
  const good = await fixture(t);
  await good.c.put('.dev-foundry/validations/source.json', '{"status":"FAIL"}\n');
  const authorization = { ...good.input.authorization, validation: { status: 'PASS', path: '.dev-foundry/validations/source.json',
    sha256: sha256(await good.c.read('.dev-foundry/validations/source.json')) } };
  const unchanged = await treeHash(good.c.root);
  await assert.rejects(prepareCutover({ ...good.input, authorization }), { code: 'cutover-validation-required' });
  assert.equal(await treeHash(good.c.root), unchanged);
});

test('stale context or package during commit fails before readiness; exact context restoration permits recovery', async (t) => {
  for (const scenario of ['prepared-head', 'verified-package', 'promoted-context']) {
    await t.test(scenario, async (st) => {
      const { c, result, input } = await fixture(st);
      let selected = input;
      if (scenario === 'verified-package') {
        const target = await mkdtemp(path.join(os.tmpdir(), 'cutover-stale-package-'));
        st.after(() => rm(target, { recursive: true, force: true }));
        await cp(packageRoot, target, { recursive: true });
        selected = { ...input, packageRoot: target };
      }
      await prepareCutover(selected);
      const originalMcp = await c.read('.mcp.json');
      if (scenario === 'prepared-head') c.commit();
      const before = await listTree(c.root);
      await assert.rejects(commitCutover({ ...selected, fault: async (phase) => {
        if (scenario === 'verified-package' && phase === 'verified') await writeFile(path.join(selected.packageRoot, 'package.json'), '{}');
        if (scenario === 'promoted-context' && phase === 'authority-set') await c.put('.mcp.json', '{}');
      } }));
      assert.deepEqual(preserved(await listTree(c.root)), preserved(before));
      if (scenario !== 'promoted-context') {
        assert.ok(result.plan.files.every((item) => item.before === null || before.get(item.path) === item.before_sha256));
        assert.equal((await evaluateActivation(c.root)).overall, 'prepared');
        assert.equal((await listTree(c.root)).has(BOOTSTRAP_PATH), false);
      } else {
        assert.equal((await evaluateActivation(c.root)).overall, 'partial');
        await assert.rejects(recoverCutover({ ...selected, outcome: 'source' }), { code: 'authority-modified' });
        await c.put('.mcp.json', originalMcp); // explicit fixture repair, never an automatic tool repair
        await recoverCutover({ ...selected, outcome: 'source' });
        await complete(c, result.plan, 'source');
      }
    });
  }
});

test('foreign Runner v1 capability schema may rely on the POP identity; declared contradictions fail closed', async (t) => {
  const { c, input } = await fixture(t);
  const file = '.dev-foundry/profiles/capability-profiles/implementation-executor-runner-v2.yaml';
  const profile = parseDocument(await c.read(file));
  profile.deleteIn(['limits', 'platform']);
  profile.deleteIn(['limits', 'implementation_identity']);
  profile.set('implementation_class', 'process-bound-runner-code-executor');
  profile.setIn(['limits', 'execution_provider'], 'codex-cli');
  await c.put(file, profile.toString());
  c.commit();
  const result = await createCutoverPlan({ root: c.root, packageRoot });
  assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers));
  const authorized = { ...input.authorization, planSha256: result.hash, sourceHead: result.plan.source.head, sourceBranch: result.plan.source.branch,
    actorBindings: result.plan.target.actorBindings, bootstrap: result.plan.target.bootstrap, allowedPaths: result.plan.files.map((item) => item.path) };
  const selected = { ...input, planBytes: result.bytes, planSha256: result.hash, authorization: authorized };
  await prepareCutover(selected);
  await commitCutover(selected);
  await complete(c, result.plan, 'target');
  const wrong = await fixture(t);
  const mismatch = parseDocument(await wrong.c.read(file));
  mismatch.setIn(['limits', 'platform'], 'unrelated-platform');
  await wrong.c.put(file, mismatch.toString());
  wrong.c.commit();
  const blocked = await createCutoverPlan({ root: wrong.c.root, packageRoot });
  assert.equal(blocked.plan.status, 'blocked');
  assert.equal(blocked.plan.blockers[0].code, 'source-capability-invalid');
});

test('portable Windows case aliases in configured authority are rejected before any staging', async (t) => {
  const { c } = await fixture(t);
  const index = parseDocument(await c.read(INDEX_PATH));
  index.addIn(['bindings'], index.createNode({ id: 'case-alias',
    path: '.dev-foundry/profiles/capability-profiles/Implementation-executor-runner-v2.yaml',
    kind: 'capability-profile', authority_class: 'configured', required: false }));
  await c.put(INDEX_PATH, index.toString());
  c.commit();
  const before = await treeHash(c.root);
  const result = await createCutoverPlan({ root: c.root, packageRoot });
  assert.equal(result.plan.status, 'blocked');
  assert.equal(result.plan.blockers[0].code, 'ambiguous-configured-routing');
  assert.equal(await treeHash(c.root), before);
});
