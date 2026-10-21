import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildManifestBytes, canonicalJson, formatExpect, rootOf, sha256 } from '../../src/adopt/pin.js';
import { beginRuntimeUpgrade, installRuntime, markTargetSessionStarted, readConsumerPin, recoverRuntimeUpgrade, resolveRuntime, runtimeUpgradeState } from '../../src/adopt/runtime.js';

async function packageFixture(parent, version, marker) {
  const root = path.join(parent, `${version}-${marker}`);
  await mkdir(path.join(root, 'bin'), { recursive: true });
  const pkg = Buffer.from(JSON.stringify({ name: '@dev-foundry/claude-adapter', version, type: 'module' }));
  const file = Buffer.from(marker);
  await writeFile(path.join(root, 'package.json'), pkg);
  await writeFile(path.join(root, 'bin', 'marker'), file);
  const entries = [
    { path: 'package.json', sha256: sha256(pkg), size: pkg.length },
    { path: 'bin/marker', sha256: sha256(file), size: file.length },
  ];
  const manifest = buildManifestBytes({ version, entries });
  await writeFile(path.join(root, 'payload-manifest.json'), manifest);
  return { root, expect: formatExpect(version, rootOf(manifest)) };
}

test('project runtime selection resolves exact package identities and isolates consumer pins', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'dfc-runtime-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const store = path.join(temp, 'runtimes');
  const v1 = await packageFixture(temp, '1.4.2', 'source');
  const v2 = await packageFixture(temp, '1.5.3', 'target');
  for (const item of [v1, v2]) {
    const slot = path.join(store, `${item.expect.split(':')[0]}--${item.expect.split(':')[2]}`);
    await mkdir(path.dirname(slot), { recursive: true });
    await rm(slot, { recursive: true, force: true });
    await cp(item.root, slot, { recursive: true });
  }
  const consumer = async (name, expect) => {
    const root = path.join(temp, name);
    await mkdir(root);
    await writeFile(path.join(root, '.mcp.json'), JSON.stringify({ mcpServers: {
      'dev-foundry-governance': { command: 'dev-foundry-claude', args: ['mcp', '--expect', expect] },
    } }));
    return root;
  };
  const a = await consumer('consumer-a', v1.expect);
  const b = await consumer('consumer-b', v2.expect);
  await assert.rejects(readConsumerPin(path.join(temp, 'missing-consumer')), { code: 'ENOENT' });
  assert.equal(await readConsumerPin(a), v1.expect);
  assert.equal(await resolveRuntime({ expect: v1.expect, packageRoot: v2.root, env: { DEV_FOUNDRY_RUNTIME_STORE: store } }), await realpath(path.join(store, `1.4.2--${v1.expect.split(':')[2]}`)));
  assert.equal(await resolveRuntime({ expect: v2.expect, packageRoot: v1.root, env: { DEV_FOUNDRY_RUNTIME_STORE: store } }), await realpath(path.join(store, `1.5.3--${v2.expect.split(':')[2]}`)));
  assert.equal(await readConsumerPin(b), v2.expect);
});

test('project runtime selection fails closed for missing, invalid, and modified identities', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'dfc-runtime-invalid-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const source = await packageFixture(temp, '1.4.2', 'source');
  const store = path.join(temp, 'runtimes');
  const missingPin = path.join(temp, 'missing-pin');
  await mkdir(missingPin);
  await assert.rejects(readConsumerPin(missingPin), { code: 'consumer-pin-missing' });
  const invalidPin = path.join(temp, 'invalid-pin');
  await mkdir(invalidPin);
  await writeFile(path.join(invalidPin, '.mcp.json'), '{');
  await assert.rejects(readConsumerPin(invalidPin), { code: 'consumer-pin-invalid' });
  await assert.rejects(resolveRuntime({ expect: source.expect, packageRoot: path.join(temp, 'missing'), env: { DEV_FOUNDRY_RUNTIME_STORE: store } }), { code: 'selected-runtime-unavailable' });
  await assert.rejects(resolveRuntime({ expect: '1.4.2:sha256:bad', packageRoot: source.root, env: { DEV_FOUNDRY_RUNTIME_STORE: store } }));
  const slot = path.join(store, `1.4.2--${source.expect.split(':')[2]}`);
  await mkdir(path.dirname(slot), { recursive: true });
  await cp(source.root, slot, { recursive: true });
  await writeFile(path.join(slot, 'bin/marker'), 'tampered');
  await assert.rejects(resolveRuntime({ expect: source.expect, packageRoot: path.join(temp, 'missing'), env: { DEV_FOUNDRY_RUNTIME_STORE: store } }), { code: 'selected-runtime-unavailable' });
});

test('verified source packages are installed side by side without replacing their exact-pin slot', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'dfc-runtime-install-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const source = await packageFixture(temp, '1.4.2', 'source');
  const target = await packageFixture(temp, '1.5.3', 'target');
  const store = path.join(temp, 'runtimes');
  const installed = await installRuntime({ packageRoot: source.root, expect: source.expect, env: { DEV_FOUNDRY_RUNTIME_STORE: store } });
  assert.equal(installed, await realpath(installed));
  assert.equal(await resolveRuntime({ expect: source.expect, packageRoot: target.root, env: { DEV_FOUNDRY_RUNTIME_STORE: store } }), installed);
  await assert.rejects(installRuntime({ packageRoot: target.root, expect: source.expect, env: { DEV_FOUNDRY_RUNTIME_STORE: store } }));
  assert.equal(await resolveRuntime({ expect: source.expect, packageRoot: target.root, env: { DEV_FOUNDRY_RUNTIME_STORE: store } }), installed);
});

test('durable upgrade intent blocks sessions and recovers source or verified target after process loss', async (t) => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'dfc-runtime-recovery-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const source = await packageFixture(temp, '1.4.2', 'source');
  const target = await packageFixture(temp, '1.5.3', 'target');
  const consumer = path.join(temp, 'consumer');
  await mkdir(consumer);
  const sourcePin = JSON.stringify({ mcpServers: { 'dev-foundry-governance': { command: 'dev-foundry-claude', args: ['mcp', '--expect', source.expect] } } });
  const targetPin = JSON.stringify({ mcpServers: { 'dev-foundry-governance': { command: 'dev-foundry-claude', args: ['mcp', '--expect', target.expect] } } });
  await writeFile(path.join(consumer, '.mcp.json'), sourcePin);
  await writeFile(path.join(consumer, 'managed.txt'), 'source-bytes');
  const makePlan = (id) => Buffer.from(canonicalJson({ id, mode: 'upgrade', status: 'ready', current: { expect: source.expect }, target: { expect: target.expect },
    create: [], merge: [
      { path: 'managed.txt', before_sha256: sha256('source-bytes'), after_sha256: sha256('target-bytes') },
      { path: '.mcp.json', before_sha256: sha256(sourcePin), after_sha256: sha256(targetPin) },
    ] }));

  const sourcePlan = makePlan('rollback');
  const sourceHash = sha256(sourcePlan);
  await beginRuntimeUpgrade({ root: consumer, planBytes: sourcePlan, planSha256: sourceHash, writes: [
    { path: 'managed.txt', content: 'target-bytes' }, { path: '.mcp.json', content: targetPin },
  ] });
  await writeFile(path.join(consumer, 'managed.txt'), 'target-bytes');
  assert.deepEqual(await runtimeUpgradeState(consumer), { blocked: true, status: 'in-progress', planSha256: sourceHash });
  await writeFile(path.join(consumer, '.dfc-runtime-upgrade', `${sourceHash}.lock`), JSON.stringify({ pid: 99999999 }));
  assert.deepEqual(await recoverRuntimeUpgrade({ root: consumer, planSha256: sourceHash, outcome: 'source', packageRoot: target.root,
    sourcePackageRoot: source.root }), { status: 'ROLLED_BACK', planSha256: sourceHash });
  assert.equal(await readFile(path.join(consumer, 'managed.txt'), 'utf8'), 'source-bytes');
  assert.equal((await readConsumerPin(consumer)), source.expect);
  assert.equal((await runtimeUpgradeState(consumer)).blocked, false);

  const targetPlan = makePlan('forward');
  const targetHash = sha256(targetPlan);
  await beginRuntimeUpgrade({ root: consumer, planBytes: targetPlan, planSha256: targetHash, writes: [
    { path: 'managed.txt', content: 'target-bytes' }, { path: '.mcp.json', content: targetPin },
  ] });
  await writeFile(path.join(consumer, 'managed.txt'), 'target-bytes');
  await writeFile(path.join(consumer, '.mcp.json'), targetPin);
  await writeFile(path.join(consumer, '.dfc-runtime-upgrade', `${targetHash}.lock`), JSON.stringify({ pid: 99999999 }));
  assert.deepEqual(await recoverRuntimeUpgrade({ root: consumer, planSha256: targetHash, outcome: 'target', packageRoot: target.root }),
    { status: 'TARGET_VERIFIED', planSha256: targetHash });
  assert.equal(await readFile(path.join(consumer, 'managed.txt'), 'utf8'), 'target-bytes');
  assert.equal(await readConsumerPin(consumer), target.expect);
  await markTargetSessionStarted(consumer, target.expect);
  await assert.rejects(recoverRuntimeUpgrade({ root: consumer, planSha256: targetHash, outcome: 'source', packageRoot: target.root,
    sourcePackageRoot: source.root }), { code: 'runtime-source-rollback-unsafe' });
  assert.equal((await runtimeUpgradeState(consumer)).blocked, false);
});
