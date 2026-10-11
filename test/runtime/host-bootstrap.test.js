import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, linkSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { canonicalJson, sha256, selfPin } from '../../src/adopt/pin.js';
import { authorizeHostBootstrap, hostApprovalBinding, hostBootstrapStatus, installHostBootstrap, planHostBootstrap, prepareHostBootstrap, recoverHostBootstrap } from '../../src/runtime/host-bootstrap.js';
import { HOST_LAUNCHERS, verifyHostPin } from '../../src/runtime/launcher.js';
import { installedRuntime, promoteRuntime, stageRuntime } from '../../src/runtime/store.js';
import { attestation, consumer, fakeRuntime, replaceSealed, scratch } from './identity.test.js';
import { managerFixture } from './launcher.test.js';

const repo = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
function tree(root) {
  const result = {};
  const walk = (dir, rel = '') => { for (const name of readdirSync(dir).sort()) {
    const file = path.join(dir, name), key = rel ? `${rel}/${name}` : name, s = statSync(file);
    result[key] = s.isDirectory() ? { mode: s.mode } : { mode: s.mode, sha256: sha256(readFileSync(file)) };
    if (s.isDirectory()) walk(file, key);
  } };
  walk(root); return result;
}
function fixture(t) {
  const manager = managerFixture(t), source = fakeRuntime(t, { files: {
    'package.json': JSON.stringify({ name: '@dev-foundry/claude-adapter', version: '1.4.2', type: 'module', scripts: { preinstall: 'must-never-execute', install: 'must-never-execute' } }),
    'bin/dev-foundry-claude.js': 'console.log("fixture-source-A");' } }), a = consumer(t, source.expect), b = consumer(t, source.expect);
  // Existing offline runtime selection is fixture setup, not host-bootstrap
  // acquisition or consumer migration. The installed source root stays intact.
  promoteRuntime(stageRuntime({ storeRoot: manager.storeRoot, candidateRoot: source.root, permittedCandidateRoots: [source.root], expect: source.expect, attestation: attestation(source.expect) }));
  const parent = scratch(t), globalRoot = scratch(t);
  const options = { sourceRoot: source.root, sourceExpect: source.expect, sourceAttestation: attestation(source.expect, source.expect),
    managerExpect: manager.expect, storeRoot: manager.storeRoot, hostRoot: path.join(parent, 'isolated-host'), projectRoot: repo,
    consumerRoots: [a.root, b.root], globalNpmRoots: [globalRoot], operator: 'fixture-Operator', evidenceScope: 'offline-synthetic', expiresAt: Date.now() + 60000 };
  const planned = planHostBootstrap(options);
  const approval = { format: 'dev-foundry.host-bootstrap-approval.v1', operator: options.operator, operatorApproved: true,
    sourceOriginApproved: true, managerOriginApproved: true, expiresAt: options.expiresAt,
    bound: hostApprovalBinding(planned.plan, planned.planSha256), phases: ['prepare', 'install'] };
  const input = { planBytes: planned.planBytes, planSha256: planned.planSha256, approval };
  const recover = (outcome = 'finish') => ({ ...input, recovery: { format: 'dev-foundry.host-recovery-approval.v1', operator: options.operator,
    operatorApproved: true, sourceOriginApproved: true, managerOriginApproved: true, outcome, reason: 'fixture interrupted publication or explicit reversible uninstall',
    expiresAt: Date.now() + 60000, bound: hostApprovalBinding(planned.plan, planned.planSha256) } });
  return { manager, source, a, b, options, planned, input, recover, host: path.join(options.hostRoot, HOST_LAUNCHERS[0]) };
}
const install = f => { prepareHostBootstrap(f.input); return installHostBootstrap(f.input); };
const invoke = (f, c, flags = []) => spawnSync(process.execPath, [f.host, ...flags, '--', '--version'], { cwd: c.root, encoding: 'utf8' });

test('canonical read-only plan binds exact source/manager provenance, payloads, absent backups and separate roots; authentic v1.4.2 remains PENDING', t => {
  const f = fixture(t), before = [tree(f.source.root), tree(f.manager.packageRoot), tree(f.a.root), tree(f.b.root), tree(f.options.globalNpmRoots[0])];
  const plan = planHostBootstrap(f.options);
  assert.equal(existsSync(f.options.hostRoot), false); assert.equal(existsSync(plan.plan.transactionRoot), false);
  assert.equal(plan.planSha256, sha256(plan.planBytes)); assert.equal(plan.planBytes.toString(), canonicalJson(plan.plan));
  assert.equal(plan.plan.realReleaseProvenance, 'PENDING'); assert.equal(plan.adoptionAuthorized, false);
  assert.equal(plan.plan.source.attestation.provenance.tag, 'v1.4.2');
  assert.equal(plan.plan.source.manifestSha256, selfPin(f.source.root).root);
  assert.equal(plan.plan.manager.manifestSha256, selfPin(f.manager.packageRoot).root);
  assert.deepEqual(plan.plan.files.map(e => e.path), [...HOST_LAUNCHERS, 'host-pin.json']);
  for (const file of plan.plan.files) { assert.equal(file.before, null); assert.equal(file.beforeSha256, 'absent'); assert.equal(sha256(Buffer.from(file.after, 'base64')), file.afterSha256); }
  assert.deepEqual([tree(f.source.root), tree(f.manager.packageRoot), tree(f.a.root), tree(f.b.root), tree(f.options.globalNpmRoots[0])], before);
});

test('approval binds every byte, decisions, exact pins, expiry and phases; no implicit yes or digest-based publisher authentication', t => {
  const f = fixture(t);
  for (const mutate of [a => { a.operator = 'someone-else'; }, a => { a.operatorApproved = false; },
    a => { delete a.sourceOriginApproved; }, a => { delete a.managerOriginApproved; }, a => { a.phases = ['install']; },
    a => { a.bound.sourcePin = f.manager.expect; }, a => { a.bound.hostRoot += '-other'; }, a => { a.bound.decisions.consumerMigration = true; },
    a => { a.expiresAt = Date.now() - 1; }, a => { a.expiresAt = f.options.expiresAt + 1; }]) {
    const input = structuredClone(f.input); mutate(input.approval);
    assert.throws(() => prepareHostBootstrap(input), /approval-invalid|binding|unrecognized-fields/);
    assert.equal(existsSync(f.options.hostRoot), false); assert.equal(existsSync(f.planned.plan.transactionRoot), false);
  }
  assert.throws(() => prepareHostBootstrap({ ...f.input, approval: { yes: true } }), /unrecognized-fields/);
  assert.throws(() => authorizeHostBootstrap(f.input, f.options.expiresAt), /expired/);
  assert.throws(() => authorizeHostBootstrap(f.input, f.planned.plan.createdAt - 1), /expired/);
  const changed = JSON.parse(f.planned.planBytes); changed.files[0].after = Buffer.from('untrusted code').toString('base64');
  assert.throws(() => authorizeHostBootstrap({ ...f.input, planBytes: Buffer.from(canonicalJson(changed)) }), /wrong-plan/);
  const origin = structuredClone(f.options.sourceAttestation); origin.provenance.trust.kind = 'same-release-SHA256SUMS';
  assert.throws(() => planHostBootstrap({ ...f.options, sourceAttestation: origin }), /origin-selection/);
  assert.equal(f.planned.plan.realReleaseProvenance, 'PENDING', 'fixture trust claims never authenticate GitHub');
});

test('isolated install is replayable, preserves source/store/global/consumers, copies exactly two launchers and seals host pin', t => {
  const f = fixture(t), before = [tree(f.source.root), tree(f.manager.storeRoot), tree(f.a.root), tree(f.b.root), tree(f.options.globalNpmRoots[0])];
  assert.equal(prepareHostBootstrap(f.input).state, 'prepared');
  assert.equal(prepareHostBootstrap(f.input).state, 'prepared'); assert.equal(existsSync(f.options.hostRoot), false);
  const intent = JSON.parse(readFileSync(path.join(f.planned.plan.transactionRoot, 'intent.json')));
  assert.equal(intent.backups.hostRoot, null); assert.deepEqual(intent.backups.files.map(e => e.bytes), [null, null, null]);
  assert.equal(installHostBootstrap(f.input).state, 'installed'); assert.equal(installHostBootstrap(f.input).state, 'installed');
  assert.equal(hostBootstrapStatus(f.input).state, 'installed');
  const pin = verifyHostPin(f.options.hostRoot, sha256(canonicalJson(f.planned.plan.pin)));
  assert.equal(pin.managerPin, f.manager.expect);
  const files = Object.keys(tree(f.options.hostRoot)).filter(file => !['bin', 'src', 'src/runtime'].includes(file));
  assert.deepEqual(files.sort(), [...HOST_LAUNCHERS, 'host-pin.json'].sort());
  assert.deepEqual([tree(f.source.root), tree(f.manager.storeRoot), tree(f.a.root), tree(f.b.root), tree(f.options.globalNpmRoots[0])], before);
  assert.equal(installedRuntime(f.manager.storeRoot, f.manager.expect).packageRoot, f.manager.packageRoot);
  assert.equal(selfPin(f.source.root).expect, f.source.expect);
  const result = invoke(f, f.a); assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), 'fixture-source-A');
});

test('copied sealed launcher dispatches A/B simultaneously without manager flags; subsequent fixture pin selection leaves launcher and B intact', async t => {
  const f = fixture(t), target = fakeRuntime(t, { files: { 'package.json': JSON.stringify({ name: '@dev-foundry/claude-adapter', version: '1.4.2', type: 'module' }),
    'bin/dev-foundry-claude.js': 'console.log("selected-B");' } });
  promoteRuntime(stageRuntime({ storeRoot: f.manager.storeRoot, candidateRoot: target.root, permittedCandidateRoots: [target.root], expect: target.expect, attestation: attestation(target.expect) }));
  f.b.config.mcpServers['dev-foundry-governance'].args[2] = target.expect;
  writeFileSync(path.join(f.b.root, '.mcp.json'), JSON.stringify(f.b.config));
  install(f); const hostBefore = tree(f.options.hostRoot), bBefore = tree(f.b.root);
  const run = c => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [f.host, '--', '--version'], { cwd: c.root, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; child.stdout.on('data', bytes => { stdout += bytes; }); child.stderr.on('data', bytes => { stderr += bytes; });
    child.once('error', reject); child.once('close', status => resolve({ status, stdout, stderr }));
  });
  const [a, b] = await Promise.all([run(f.a), run(f.b)]);
  assert.equal(a.status, 0, a.stderr); assert.equal(b.status, 0, b.stderr);
  assert.equal(a.stdout.trim(), 'fixture-source-A'); assert.equal(b.stdout.trim(), 'selected-B');
  // Test data selection only, not a claimed B2 governed semantic migration.
  f.a.config.mcpServers['dev-foundry-governance'].args[2] = target.expect;
  writeFileSync(path.join(f.a.root, '.mcp.json'), JSON.stringify(f.a.config));
  assert.equal(invoke(f, f.a).stdout.trim(), 'selected-B');
  assert.deepEqual(tree(f.options.hostRoot), hostBefore); assert.deepEqual(tree(f.b.root), bBefore);
});

test('approved identity cannot be overridden or downgraded by advanced flags; cross-project executable arguments remain blocked', t => {
  const f = fixture(t); install(f);
  for (const flags of [['--manager-expect', f.source.expect], ['--store-root', path.dirname(f.manager.storeRoot)]]) {
    const result = invoke(f, f.a, flags); assert.equal(result.status, 2); assert.match(result.stderr, /identity-override/); assert.equal(result.stdout, '');
  }
  const same = invoke(f, f.a, ['--manager-expect', f.manager.expect, '--store-root', f.manager.storeRoot]); assert.equal(same.status, 0, same.stderr);
  const cross = spawnSync(process.execPath, [f.host, '--', 'status', '--root', f.b.root], { cwd: f.a.root, encoding: 'utf8' });
  assert.equal(cross.status, 2); assert.match(cross.stderr, /cross-project/);
  const arbitrary = spawnSync(process.execPath, [f.host, '--', '/untrusted/executable'], { cwd: f.a.root, encoding: 'utf8' });
  assert.equal(arbitrary.status, 2); assert.equal(arbitrary.stdout, '');
});

for (const file of ['host-pin.json', ...HOST_LAUNCHERS]) test(`startup rejects tampered ${file} before manager dispatch`, t => {
  const f = fixture(t); install(f);
  const target = path.join(f.options.hostRoot, file);
  replaceSealed(target, readFileSync(target, 'utf8') + '\n// altered bytes\n');
  const result = invoke(f, f.a); assert.equal(result.status, 2); assert.equal(result.stdout, '');
  assert.equal(hostBootstrapStatus(f.input).state, 'unknown');
  assert.throws(() => recoverHostBootstrap(f.recover('uninstall')), /unknown-live-bytes/);
  assert.equal(existsSync(target), true, 'unknown bytes are retained');
});

test('startup rejects changed manager code and sealed install record, without executing either', t => {
  const f = fixture(t); install(f);
  const record = path.join(path.dirname(f.manager.packageRoot), 'stage.json'), original = readFileSync(record);
  replaceSealed(record, original.toString() + '\n');
  const mismatch = invoke(f, f.a); assert.equal(mismatch.status, 2); assert.match(mismatch.stderr, /manager-record-mismatch/); assert.equal(mismatch.stdout, '');
  replaceSealed(record, original);
  replaceSealed(path.join(f.manager.packageRoot, 'src/runtime/dispatch.js'), 'throw new Error("untrusted code executed");');
  const damaged = invoke(f, f.a); assert.equal(damaged.status, 2); assert.match(damaged.stderr, /manager-byte-mismatch/);
  assert.doesNotMatch(damaged.stderr, /untrusted code executed/); assert.equal(damaged.stdout, '');
  assert.equal(recoverHostBootstrap(f.recover('uninstall')).state, 'uninstalled', 'host reversal does not need broken manager execution');
});

test('host root/pin mismatch and unbound downgrade fail closed', t => {
  const f = fixture(t); install(f);
  const moved = `${f.options.hostRoot}-moved`; renameSync(f.options.hostRoot, moved);
  const result = spawnSync(process.execPath, [path.join(moved, HOST_LAUNCHERS[0]), '--', '--version'], { cwd: f.a.root, encoding: 'utf8' });
  assert.equal(result.status, 2); assert.match(result.stderr, /root mismatch/);
  renameSync(moved, f.options.hostRoot);
  const bin = path.join(f.options.hostRoot, HOST_LAUNCHERS[0]), raw = readFileSync(path.join(f.manager.packageRoot, HOST_LAUNCHERS[0]));
  replaceSealed(bin, raw);
  assert.equal(invoke(f, f.a, ['--manager-expect', f.manager.expect, '--store-root', f.manager.storeRoot]).status, 2);
});

test('destination rejects traversal, symlinks, overlaps, consumers, npm roots, missing/private parent permission and existing directories', t => {
  const f = fixture(t), parent = path.dirname(f.options.hostRoot), link = path.join(parent, 'link'); symlinkSync(parent, link);
  for (const hostRoot of [path.join(f.source.root, 'host'), path.join(f.manager.packageRoot, 'host'), path.join(f.manager.storeRoot, 'host'),
    path.join(f.a.root, 'host'), path.join(f.options.globalNpmRoots[0], 'host'), `${parent}/../host`, path.join(link, 'host'),
    path.join(parent, 'missing-parent', 'host'), `${parent}/ambiguous\\host`]) assert.throws(() => planHostBootstrap({ ...f.options, hostRoot }));
  const globalRoot = f.options.globalNpmRoots[0];
  const alias = path.join(path.dirname(globalRoot), path.basename(globalRoot).toUpperCase());
  if (existsSync(alias)) assert.throws(() => planHostBootstrap({ ...f.options, hostRoot: path.join(alias, 'forbidden-host') }), /host-root-overlap/,
    'case-insensitive physical alias must not write the explicitly excluded npm root');
  chmodSync(parent, 0o500); assert.throws(() => planHostBootstrap(f.options), /unsafe-permissions/); chmodSync(parent, 0o700);
  chmodSync(parent, 0o777); assert.throws(() => planHostBootstrap(f.options), /unsafe-permissions/); chmodSync(parent, 0o700);
  mkdirSync(f.options.hostRoot); assert.throws(() => planHostBootstrap(f.options), /existing-installation/);
  assert.throws(() => prepareHostBootstrap(f.input), /existing-installation/); assert.equal(existsSync(f.planned.plan.transactionRoot), false);
});

test('source bytes, manager bytes and parent identity are reobserved before host mutation', t => {
  const f = fixture(t);
  writeFileSync(path.join(f.source.root, 'bin/dev-foundry-claude.js'), 'changed source');
  assert.throws(() => prepareHostBootstrap(f.input)); assert.equal(existsSync(f.planned.plan.transactionRoot), false);
  const g = fixture(t), parent = path.dirname(g.options.hostRoot);
  renameSync(parent, `${parent}-old`);
  mkdirSync(parent, { mode: 0o700 });
  assert.throws(() => prepareHostBootstrap(g.input), /parent-changed/);
  // Restore only disposable test boundaries for cleanup.
  rmdirSync(parent); renameSync(`${parent}-old`, parent);
});

const failpoints = ['directory-durable:.', 'directory-durable:bin', 'directory-durable:src', 'directory-durable:src/runtime',
  ...[...HOST_LAUNCHERS, 'host-pin.json'].flatMap(file => [`before-publish:${file}`, `linked:${file}`, `published:${file}`]), 'host-sealed'];
for (const point of failpoints) test(`durable interruption at ${point} retains exact evidence and recovers idempotently`, t => {
  const f = fixture(t), sourceBefore = tree(f.source.root), consumersBefore = [tree(f.a.root), tree(f.b.root)]; prepareHostBootstrap(f.input);
  assert.throws(() => installHostBootstrap({ ...f.input, failpoint: p => { if (p === point) throw new Error('injected interruption'); } }), /injected/);
  const status = hostBootstrapStatus(f.input); assert.equal(status.state, 'recovery-required', JSON.stringify(status)); assert.equal(status.evidenceRetained, true);
  const blocked = invoke(f, f.a);
  if (point === 'host-sealed') assert.equal(blocked.status, 0, 'complete sealed bytes are usable before completion checkpoint');
  else {
    if (!existsSync(f.host)) { assert.equal(blocked.status, 1); assert.match(blocked.stderr, /MODULE_NOT_FOUND/); }
    else assert.equal(blocked.status, 2);
    assert.equal(blocked.stdout, '');
  }
  assert.equal(existsSync(path.join(f.planned.plan.transactionRoot, 'intent.json')), true);
  assert.equal(recoverHostBootstrap(f.recover()).state, 'installed'); assert.equal(recoverHostBootstrap(f.recover()).state, 'installed');
  const result = invoke(f, f.a); assert.equal(result.status, 0, result.stderr); assert.deepEqual(tree(f.source.root), sourceBefore); assert.deepEqual([tree(f.a.root), tree(f.b.root)], consumersBefore);
});

test('preparation interruption is explicitly unknown, retains backups, refuses blind replay and never creates host', t => {
  const f = fixture(t);
  assert.throws(() => prepareHostBootstrap({ ...f.input, failpoint: p => { if (p === 'intent-durable') throw new Error('injected'); } }), /injected/);
  assert.equal(hostBootstrapStatus(f.input).state, 'unknown'); assert.equal(existsSync(f.options.hostRoot), false);
  assert.equal(existsSync(path.join(f.planned.plan.transactionRoot, 'intent.json')), true);
  assert.throws(() => prepareHostBootstrap(f.input)); assert.throws(() => recoverHostBootstrap(f.recover()));
});

test('foreign files and hostile hard/symbolic links are retained; no silent overwrite or recursive uninstall', t => {
  const f = fixture(t); prepareHostBootstrap(f.input);
  assert.throws(() => installHostBootstrap({ ...f.input, failpoint: p => { if (p === 'directory-durable:src/runtime') throw new Error('injected'); } }));
  const foreign = path.join(f.options.hostRoot, HOST_LAUNCHERS[0]); writeFileSync(foreign, 'foreign installation', { mode: 0o400 });
  assert.throws(() => installHostBootstrap(f.input), /unknown-live-bytes/);
  assert.throws(() => recoverHostBootstrap(f.recover('uninstall')), /unknown-live-bytes/); assert.equal(readFileSync(foreign, 'utf8'), 'foreign installation');
  const g = fixture(t); install(g); const extra = path.join(path.dirname(g.options.hostRoot), 'hostile-link');
  linkSync(path.join(g.options.hostRoot, HOST_LAUNCHERS[1]), extra);
  assert.equal(invoke(g, g.a).status, 2); assert.throws(() => recoverHostBootstrap(g.recover('uninstall')), /hostile-link/);
  unlinkSync(extra);
  const config = path.join(g.options.hostRoot, 'host-pin.json'), original = readFileSync(config);
  chmodSync(g.options.hostRoot, 0o700); unlinkSync(config); const outside = path.join(path.dirname(g.options.hostRoot), 'outside-pin'); writeFileSync(outside, original); symlinkSync(outside, config);
  assert.equal(invoke(g, g.a).status, 2); assert.throws(() => recoverHostBootstrap(g.recover('uninstall')), /unsafe-path/);
  assert.deepEqual(readFileSync(outside), original);
});

test('fresh exactly bound recovery is required; explicit uninstall removes only host bytes and retains journal/source/consumer', t => {
  const f = fixture(t); install(f); const sourceBefore = tree(f.source.root), aBefore = tree(f.a.root);
  for (const mutate of [r => { r.operatorApproved = false; }, r => { r.bound.planSha256 = '0'.repeat(64); }, r => { r.expiresAt = Date.now() - 1; }, r => { r.outcome = 'delete-everything'; }]) {
    const recovery = f.recover(); mutate(recovery.recovery); assert.throws(() => recoverHostBootstrap(recovery), /recovery-approval/);
  }
  assert.equal(recoverHostBootstrap(f.recover('uninstall')).state, 'uninstalled');
  assert.equal(recoverHostBootstrap(f.recover('uninstall')).state, 'uninstalled', 'reversal is idempotent');
  assert.equal(existsSync(f.options.hostRoot), false); assert.equal(hostBootstrapStatus(f.input).state, 'uninstalled');
  assert.equal(existsSync(path.join(f.planned.plan.transactionRoot, 'intent.json')), true);
  assert.deepEqual(tree(f.source.root), sourceBefore); assert.deepEqual(tree(f.a.root), aBefore);
  assert.throws(() => recoverHostBootstrap(f.recover()), /uninstalled-transaction/);
});

test('live concurrent lease and unknown journal evidence cannot be guessed or discarded', t => {
  const f = fixture(t); prepareHostBootstrap(f.input);
  const file = path.join(f.planned.plan.transactionRoot, 'lease.json'), lease = { pid: process.pid, planSha256: f.input.planSha256, createdAt: Date.now(), nonce: 'fixture-lease' };
  writeFileSync(file, canonicalJson(lease), { mode: 0o400 });
  assert.throws(() => installHostBootstrap(f.input), /writer-conflict/);
  assert.throws(() => recoverHostBootstrap({ ...f.recover(), reconcileLease: lease }), /writer-live/);
  assert.equal(hostBootstrapStatus(f.input).state, 'writer-or-interrupted-lease'); unlinkSync(file);
  writeFileSync(path.join(f.planned.plan.transactionRoot, 'foreign-evidence'), 'keep me');
  assert.equal(hostBootstrapStatus(f.input).state, 'unknown'); assert.throws(() => recoverHostBootstrap(f.recover('uninstall')), /unknown-journal/);
  assert.equal(existsSync(f.options.hostRoot), false);
});

test('expiration is rechecked at the visible publication barrier and fresh recovery preserves the source', t => {
  const f = fixture(t), sourceBefore = tree(f.source.root); prepareHostBootstrap(f.input);
  const currentTime = Date.now;
  try {
    assert.throws(() => installHostBootstrap({ ...f.input, failpoint: p => {
      if (p === `before-publish:${HOST_LAUNCHERS[0]}`) Date.now = () => f.options.expiresAt;
    } }), /approval-invalid-or-expired/);
  } finally { Date.now = currentTime; }
  assert.equal(existsSync(f.host), false); assert.equal(hostBootstrapStatus(f.input).state, 'recovery-required');
  assert.equal(recoverHostBootstrap(f.recover()).state, 'installed'); assert.deepEqual(tree(f.source.root), sourceBefore);
});

test('wrong self-pins, unknown publisher, mutable tag and absent observed asset identity never produce an install plan', t => {
  const f = fixture(t);
  assert.throws(() => planHostBootstrap({ ...f.options, sourceExpect: f.manager.expect }));
  assert.throws(() => planHostBootstrap({ ...f.options, managerExpect: 'latest' }));
  for (const mutate of [p => { p.repository = 'foreign/publisher'; }, p => { p.tag = 'latest'; },
    p => { delete p.observedAssetSha256; }, p => { p.payloadSelfPin = f.manager.expect; }]) {
    const sourceAttestation = structuredClone(f.options.sourceAttestation); mutate(sourceAttestation.provenance);
    assert.throws(() => planHostBootstrap({ ...f.options, sourceAttestation }), /origin-selection-incomplete/);
  }
  assert.equal(existsSync(f.options.hostRoot), false); assert.equal(existsSync(f.planned.plan.transactionRoot), false);
});
