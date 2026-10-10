import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { canonicalJson, selfPin, sha256 } from '../../src/adopt/pin.js';
import { assertPackageSelected, resolveRuntime } from '../../src/runtime/resolver.js';
import { installedRuntime, stageRuntime, promoteRuntime } from '../../src/runtime/store.js';
import { buildRuntimePlan, authoritySnapshot, repository } from '../../src/runtime/plan.js';
import { approvedFields } from '../../src/runtime/authorization.js';
import { prepare, commit, recover, status } from '../../src/runtime/transition.js';
import { observeFreshMcp, runtimeCommand } from '../../src/runtime/cli.js';
import { dashboardCommand, inspectDashboard } from '../../src/dashboard/command.js';
import { runLauncher } from '../../src/telemetry/launch.js';
import { attestation, consumer, fakeRuntime, replaceSealed, scratch } from './identity.test.js';
import { fixture, gitCommit, put } from './plan.test.js';
import { copiedHost } from './launcher.test.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));
async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
function stage(storeRoot, candidateRoot, expect, source = expect) {
  return promoteRuntime(stageRuntime({ storeRoot, candidateRoot, permittedCandidateRoots: [candidateRoot], expect, attestation: attestation(expect, source) }));
}
export function installedPair(t, recipe) {
  const tree = scratch(t), destination = scratch(t), cache = scratch(t);
  for (const relative of ['package.json', 'package-lock.json', 'README.md', 'bin', 'src', 'templates', 'framework', 'migrations', 'scripts/package']) cpSync(path.join(repo, relative), path.join(tree, relative), { recursive: true });
  cpSync(path.join(repo, 'tools/dashboard'), path.join(tree, 'tools/dashboard'), { recursive: true,
    filter: source => !['node_modules', 'dist'].includes(path.relative(path.join(repo, 'tools/dashboard'), source).split(path.sep)[0]) });
  symlinkSync(path.join(repo, 'tools/dashboard/node_modules'), path.join(tree, 'tools/dashboard/node_modules'), 'dir');
  cpSync(path.join(repo, 'node_modules'), path.join(tree, 'node_modules'), { recursive: true,
    filter: source => !source.includes(`${path.sep}node_modules${path.sep}@modelcontextprotocol${path.sep}client`) });
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(npm_|DEV_FOUNDRY_|OTEL_|CLAUDE)/i.test(key))),
    npm_config_cache: cache, npm_config_offline: 'true', npm_config_registry: 'http://127.0.0.1:9/', npm_config_update_notifier: 'false' };
  const npm = (args, cwd) => execFileSync('npm', args, { cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const build = () => {
    const dest = path.join(destination, String(Math.random())); mkdirSync(dest);
    const info = JSON.parse(npm(['pack', '--pack-destination', dest, '--json'], tree))[0];
    const prefix = scratch(t);
    npm(['install', '--prefix', prefix, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', path.join(dest, info.filename)], prefix);
    const root = path.join(prefix, 'node_modules/@dev-foundry/claude-adapter');
    return { root, expect: selfPin(root).expect };
  };
  const source = build();
  recipe = { ...recipe, targetVersion: '1.4.2', sources: [source.expect] };
  put(tree, 'migrations/runtime.json', canonicalJson(recipe));
  // Synthetic future migration material; producer recipe/distribution stays frozen.
  const pkg = JSON.parse(readFileSync(path.join(tree, 'package.json'))); pkg.files.push('migrations/runtime.json');
  put(tree, 'package.json', canonicalJson(pkg));
  const target = build();
  // Required pack dry-run is evaluated on this exact disposable candidate:
  // prepack writes dist/manifest, both forbidden producer mutation surfaces.
  const dryRun = JSON.parse(npm(['pack', '--dry-run', '--json'], tree))[0];
  assert.ok(dryRun.files.some(f => f.path === 'bin/dev-foundry-claude-launcher.js'));
  assert.ok(dryRun.files.some(f => f.path === 'src/runtime/cli.js'));
  rmSync(tree, { recursive: true, force: true });
  return { source, target, dryRun };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  test('journal unknown/in-flight blocks dispatch; intact source stays selected during prepare and explicit safe rollback', t => {
    const f = fixture(t);
    assert.equal(resolveRuntime({ cwd: f.a.root, storeRoot: f.storeRoot }).expect, f.source.expect);
    prepare(f.input); assert.equal(resolveRuntime({ cwd: f.a.root, storeRoot: f.storeRoot }).expect, f.source.expect);
    commit(f.input); assert.throws(() => resolveRuntime({ cwd: f.a.root, storeRoot: f.storeRoot }), /runtime-journal/);
    assert.equal(resolveRuntime({ cwd: f.a.root, storeRoot: f.storeRoot, pendingMcp: true }).expect, f.target.expect);
    replaceSealed(path.join(installedRuntime(f.storeRoot, f.target.expect).packageRoot, 'src/governance-mcp/server.js'), 'damaged target');
    recover({ ...f.input, recovery: f.recovery('source') });
    assert.equal(resolveRuntime({ cwd: f.a.root, storeRoot: f.storeRoot }).expect, f.source.expect);
    put(f.b.root, '.dfc-runtime-upgrade/unknown.json', '{}');
    assert.throws(() => resolveRuntime({ cwd: f.b.root, storeRoot: f.storeRoot }), /runtime-journal-unknown/);
  });

  test('native packed installed runtime: independent stable host, live MCP/dashboard/telemetry parity, fresh verification and consumer B isolation', { timeout: 600000 }, async t => {
    const f = fixture(t), pair = installedPair(t, f.result.plan.recipe), storeRoot = path.join(scratch(t), 'store');
    const source = stage(storeRoot, pair.source.root, pair.source.expect), target = stage(storeRoot, pair.target.root, pair.target.expect, pair.source.expect);
    const host = copiedHost(t, source.packageRoot);
    const sourceConfig = structuredClone(f.a.config); sourceConfig.mcpServers['dev-foundry-governance'].args[2] = source.expect;
    put(f.a.root, '.mcp.json', canonicalJson(sourceConfig)); put(f.b.root, '.mcp.json', canonicalJson(sourceConfig));
    // Real MCP activation uses configured route classes in addition to B2's
    // byte/authority checks. Establish them explicitly in these fixtures.
    for (const consumerRoot of [f.a.root, f.b.root]) {
      const indexPath = '.dev-foundry/authority-index.yaml';
      const index = JSON.parse(readFileSync(path.join(consumerRoot, indexPath)));
      for (const route of index.routes) route.authority_class = 'methodology';
      for (const binding of index.bindings) binding.authority_class = 'configured';
      put(consumerRoot, indexPath, canonicalJson(index)); gitCommit(consumerRoot);
    }
    const identity = repository(f.a.root), authority = authoritySnapshot(f.a.root);
    const candidate = structuredClone(f.candidate);
    Object.assign(candidate, { storeRoot, sourcePin: source.expect, targetPin: target.expect, branch: identity.branch, head: identity.head });
    Object.assign(candidate.proposal, { sourcePin: source.expect, sourceAuthority: authority.fingerprint });
    const config = structuredClone(sourceConfig); config.mcpServers['dev-foundry-governance'].args[2] = target.expect;
    const pinFile = candidate.files.find(file => file.path === '.mcp.json');
    Object.assign(pinFile, { beforeSha256: sha256(readFileSync(path.join(f.a.root, '.mcp.json'))), after: canonicalJson(config), afterSha256: sha256(canonicalJson(config)) });
    const result = buildRuntimePlan(candidate);
    const approval = { ...f.input.approval, bound: approvedFields(result.plan, result.hash) };
    const input = { ...f.input, planBytes: result.bytes, planSha256: result.hash, approval };
    const bBefore = execFileSync('git', ['-C', f.b.root, 'status', '--porcelain', '--untracked-files=all']).toString();
    const bPin = readFileSync(path.join(f.b.root, '.mcp.json'));
    const invoke = (root, args) => execFileSync(process.execPath, [host, '--manager-expect', source.expect, '--store-root', storeRoot, '--', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
    assert.equal(invoke(f.a.root, ['--version']).trim(), '1.4.2');
    const bClient = new Client({ name: 'independent-B', version: '1' });
    const oldAClient = new Client({ name: 'old-A', version: '1' });
    const connect = async (client, root) => client.connect(new StdioClientTransport({ command: process.execPath, args: [source.packageRoot + '/bin/dev-foundry-claude.js', 'mcp', '--expect', source.expect], env: { CLAUDE_PROJECT_DIR: root }, cwd: root }));
    await connect(bClient, f.b.root); await connect(oldAClient, f.a.root);
    t.after(() => bClient.close()); t.after(() => oldAClient.close());
    const beforeIdentity = JSON.parse((await bClient.readResource({ uri: 'dev-foundry://runtime/identity' })).contents[0].text);
    assert.equal(beforeIdentity.pin, source.expect); assert.equal(beforeIdentity.activation, 'active');
    // Independent stable recovery uses the pinned source manager even when
    // the selected target MCP bytes are damaged. Only isolated fixture data.
    const recoveryRoot = path.join(scratch(t), 'consumer');
    cpSync(f.a.root, recoveryRoot, { recursive: true });
    const recoveryCandidate = { ...candidate, root: recoveryRoot };
    const recoveryPlan = buildRuntimePlan(recoveryCandidate);
    const recoveryApproval = { ...approval, bound: approvedFields(recoveryPlan.plan, recoveryPlan.hash) };
    const recoveryRequest = { format: 'dev-foundry.runtime-request.v1', root: recoveryRoot, plan: recoveryPlan.plan,
      planSha256: recoveryPlan.hash, approval: recoveryApproval, evidence: input.evidence };
    const recoveryFile = path.join(scratch(t), 'recovery-request.json'); writeFileSync(recoveryFile, canonicalJson(recoveryRequest));
    assert.equal(JSON.parse(invoke(recoveryRoot, ['runtime', 'prepare', '--input', recoveryFile])).state, 'prepared');
    assert.equal(JSON.parse(invoke(recoveryRoot, ['runtime', 'commit', '--input', recoveryFile])).state, 'await-new-session');
    const damagedFile = path.join(target.packageRoot, 'src/governance-mcp/server.js'), originalBytes = readFileSync(damagedFile);
    try {
      replaceSealed(damagedFile, 'throw new Error("broken target must never execute during recovery");');
      writeFileSync(recoveryFile, canonicalJson({ ...recoveryRequest, recovery: { operatorApproved: true,
        planSha256: recoveryPlan.hash, outcome: 'source', reason: 'explicit synthetic broken-target recovery proof' } }));
      assert.equal(JSON.parse(invoke(recoveryRoot, ['runtime', 'recover', '--input', recoveryFile])).state, 'rolled-back');
      assert.equal(resolveRuntime({ cwd: recoveryRoot, storeRoot }).expect, source.expect);
    } finally { replaceSealed(damagedFile, originalBytes); }
    prepare(input); commit(input);
    const oldResult = await oldAClient.callTool({ name: 'resolve_governed_operation', arguments: { requestedAction: 'inspect', targetProject: 'Synthetic', boundaryId: 'runtime-proof' } });
    assert.equal(JSON.parse(oldResult.content[0].text).errorCode, 'STALE_SESSION');
    const observation = await observeFreshMcp({ root: f.a.root, runtime: target, planSha256: result.hash, authority: result.plan.targetAuthority });
    assert.equal(observation.pin, target.expect); assert.equal(observation.activation, 'active'); assert.notEqual(observation.sessionId, candidate.proposal.sourceSessionId);
    const request = { format: 'dev-foundry.runtime-request.v1', root: f.a.root, plan: result.plan, planSha256: result.hash, approval, evidence: input.evidence,
      session: { format: 'dev-foundry.runtime-session-request.v1', evidence: 'synthetic mechanical acceptance only; real Claude model remains B4' } };
    const file = path.join(scratch(t), 'request.json'); writeFileSync(file, canonicalJson(request));
    assert.equal(await runtimeCommand({ cwd: f.a.root, argv: ['verify', '--store-root', storeRoot, '--input', file], output: () => {} }), 0);
    assert.equal(status(f.a.root).state, 'completed');
    await t.test('live loopback dashboard ownership and selected UI (host gate)', async sub => {
      let port;
      try { port = await freePort(); } catch (error) {
        if (error.code === 'EPERM') { sub.skip('Host prohibits loopback sockets; live dashboard ownership/UI remains B4 unverified'); return; }
        throw error;
      }
      const oldDashboard = spawn(process.execPath, [source.packageRoot + '/bin/dev-foundry-claude.js', 'dashboard', '--port', String(port)], { cwd: f.b.root, env: { ...process.env, CLAUDE_PROJECT_DIR: f.b.root }, stdio: ['ignore', 'pipe', 'pipe'] });
      sub.after(() => oldDashboard.kill('SIGTERM'));
      await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('dashboard startup timeout')), 10000); oldDashboard.stdout.once('data', () => { clearTimeout(timer); resolve(); }); oldDashboard.once('exit', () => { clearTimeout(timer); reject(new Error('dashboard exited')); }); });
      assert.equal((await inspectDashboard({ root: f.b.root, expect: source.expect, port })).state, 'owned-selected-restart-required');
      assert.equal(oldDashboard.exitCode, null, 'listening process was not terminated');
      const targetPort = await freePort();
      const dashboard = await dashboardCommand({ argv: ['--port', String(targetPort)], packageRoot: target.packageRoot, cwd: f.a.root });
      sub.after(() => new Promise(resolve => dashboard.close(resolve)));
      const dashboardIdentity = await (await fetch(`http://127.0.0.1:${targetPort}/api/runtime/identity`)).json();
      assert.equal(dashboardIdentity.pin, target.expect); assert.equal(dashboardIdentity.uiRoot, path.join(target.packageRoot, 'tools/dashboard/dist'));
      assert.match(await (await fetch(`http://127.0.0.1:${targetPort}/`)).text(), /<html/);
    });
    let ready;
    const { EventEmitter } = await import('node:events');
    const signals = new EventEmitter();
    let child;
    const { runLauncher: targetTelemetry } = await import(pathToFileURL(path.join(target.packageRoot, 'src/telemetry/launch.js')).href);
    const telemetry = targetTelemetry({ argv: ['--runtime', 'direct', '--', '--resume'], projectRoot: f.a.root, packageRoot: target.packageRoot, signalTarget: signals,
      startCollector: async options => { assert.equal(options.host, '127.0.0.1'); return { port: 5555, close: async () => {} }; },
      onReady: value => { ready = value; }, spawn: () => { child = new EventEmitter(); child.kill = () => { throw new Error('No external termination permitted'); }; setImmediate(() => child.emit('close', 0)); return child; } });
    assert.equal(await telemetry, 0); assert.equal(ready.runtimeIdentity.pin, target.expect); assert.equal(ready.runtimeIdentity.packageRoot, target.packageRoot);
    assert.equal(invoke(f.a.root, ['--version']).trim(), '1.4.2'); assert.equal(invoke(f.b.root, ['--version']).trim(), '1.4.2');
    const afterIdentity = JSON.parse((await bClient.readResource({ uri: 'dev-foundry://runtime/identity' })).contents[0].text);
    assert.equal(afterIdentity.sessionId, beforeIdentity.sessionId); assert.equal(afterIdentity.pin, source.expect);
    const bResult = await bClient.callTool({ name: 'resolve_governed_operation', arguments: { requestedAction: 'inspect', targetProject: 'Synthetic', boundaryId: 'runtime-proof' } });
    assert.notEqual(JSON.parse(bResult.content[0].text).errorCode, 'STALE_SESSION');
    assert.notEqual(JSON.parse(bResult.content[0].text).errorCode, 'BINDING_INACTIVE');
    assert.deepEqual(readFileSync(path.join(f.b.root, '.mcp.json')), bPin);
    assert.equal(execFileSync('git', ['-C', f.b.root, 'status', '--porcelain', '--untracked-files=all']).toString(), bBefore);
    assert.equal(readFileSync(path.join(f.a.root, 'src/product.txt'), 'utf8'), 'consumer product must remain identical');
    t.diagnostic(`native installed synthetic 1.4.2 builds ${source.expect} -> ${target.expect}; real release/Claude/Windows acceptance is B4 unverified`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  test('dashboard ownership diagnostics refuse old/unknown listeners without signalling; identity becomes restart-required on cutover', async t => {
    const { EventEmitter } = await import('node:events');
    const f = fixture(t), source = installedRuntime(f.storeRoot, f.source.expect), port = 45123;
    const oldIdentity = { format: 'dev-foundry.dashboard-runtime.v1', status: 'selected', repositoryRoot: f.a.root, packageRoot: source.packageRoot, pin: f.source.expect, pid: 123, instance: 'observed-instance' };
    const request = async url => { assert.equal(url, `http://127.0.0.1:${port}/api/runtime/identity`); return { json: async () => oldIdentity }; };
    assert.equal((await inspectDashboard({ root: f.a.root, expect: f.target.expect, port, request })).state, 'owned-old-restart-required');
    assert.equal((await inspectDashboard({ root: f.b.root, expect: f.target.expect, port, request })).state, 'occupied-unknown');
    for (const identity of [oldIdentity, { invalid: true }]) {
      let launchCount = 0;
      await assert.rejects(dashboardCommand({ argv: ['--port', String(port)], packageRoot: source.packageRoot, cwd: f.a.root,
        inspect: args => inspectDashboard({ ...args, request: async () => ({ json: async () => identity }) }), launch: () => { launchCount++; } }), /restart-required/);
      assert.equal(launchCount, 0);
    }
    const originalFetch = globalThis.fetch;
    let doctor;
    try {
      globalThis.fetch = async () => ({ json: async () => ({ ...oldIdentity, pin: f.target.expect }) });
      assert.equal(await runtimeCommand({ cwd: f.a.root, argv: ['doctor', '--store-root', f.storeRoot, '--port', String(port)], output: value => { doctor = JSON.parse(value); } }), 2);
      assert.equal(doctor.dashboard.state, 'owned-old-restart-required'); assert.equal(doctor.blocked, true); assert.match(doctor.nextAction, /restart-required/);
    } finally { globalThis.fetch = originalFetch; }
    const server = new EventEmitter(); let uiRoot;
    const listening = await dashboardCommand({ argv: ['--port', String(port)], packageRoot: source.packageRoot, cwd: f.a.root,
      inspect: async () => ({ state: 'absent' }), launch: async options => { uiRoot = options.uiRoot; return server; } });
    assert.equal(listening, server); assert.equal(uiRoot, path.join(source.packageRoot, 'tools/dashboard/dist'));
    const identityResponse = () => {
      let code, body;
      server.emit('request', { method: 'GET', url: '/api/runtime/identity', headers: { host: `127.0.0.1:${port}` } }, { writeHead: value => { code = value; }, end: value => { body = value && JSON.parse(value); } });
      return { code, body };
    };
    assert.equal(identityResponse().code, 200);
    prepare(f.input); commit(f.input);
    assert.equal(identityResponse().code, 409); assert.equal(identityResponse().body.status, 'restart-required');
    assert.equal(identityResponse().body.pin, f.source.expect, 'old dashboard never impersonates target');
  });
}
