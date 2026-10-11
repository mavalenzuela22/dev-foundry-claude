import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { MCP_FILE, POP_PATH } from '../../src/adopt/common.js';
import { canonicalJson, sha256 } from '../../src/adopt/pin.js';
import { commit, prepare, recover, status, verify } from '../../src/runtime/transition.js';
import { createSessionGuard } from '../../src/governance-mcp/session.js';
import { installedRuntime } from '../../src/runtime/store.js';
import { replaceSealed } from './identity.test.js';
import { fixture, gitCommit, put } from './plan.test.js';

export function assertOutcome(f, outcome) {
  for (const file of f.result.plan.files) {
    const live = path.join(f.a.root, file.path);
    assert.equal(existsSync(live) ? sha256(readFileSync(live)) : 'absent', outcome === 'target' ? file.afterSha256 : file.beforeSha256, file.path);
  }
  assert.equal(readFileSync(path.join(f.a.root, 'src/product.txt'), 'utf8'), 'consumer product must remain identical');
  for (const [i, file] of f.result.plan.files.entries()) {
    const staged = JSON.parse(readFileSync(path.join(f.a.root, `.dfc-runtime-upgrade/stage-${i}.json`)));
    assert.equal(staged.before, file.before); assert.equal(staged.after, file.after);
  }
}

test('source stays active through prepare; target pending is blocked; only independently verified fresh target completes; B unaffected', async t => {
  const f = fixture(t), bHead = execFileSync('git', ['-C', f.b.root, 'rev-parse', 'HEAD']).toString(), bPin = readFileSync(path.join(f.b.root, MCP_FILE));
  const sourceGuard = await createSessionGuard(f.a.root, f.source.expect), bGuard = await createSessionGuard(f.b.root, f.source.expect);
  assert.equal(await sourceGuard(), null);
  prepare(f.input); assertOutcome(f, 'source'); assert.equal(await sourceGuard(), null);
  assert.equal(prepare(f.input).state, 'prepared');
  assert.equal(commit(f.input).state, 'await-new-session'); assertOutcome(f, 'target');
  assert.equal(status(f.a.root).blocked, true); assert.equal((await sourceGuard()).errorCode, 'STALE_SESSION');
  const pending = await createSessionGuard(f.a.root, f.target.expect); assert.equal((await pending()).errorCode, 'STALE_SESSION');
  assert.throws(() => verify(f.input), /fresh-target-verification-required/);
  assert.throws(() => verify({ ...f.input, session: { ...f.session, id: f.result.plan.proposal.sourceSessionId } }));
  assert.equal(verify({ ...f.input, session: f.session }).completed, true);
  assert.equal(status(f.a.root).state, 'completed'); assert.equal(await (await createSessionGuard(f.a.root, f.target.expect))(), null);
  assert.equal((await sourceGuard()).errorCode, 'STALE_SESSION'); assert.equal((await pending()).errorCode, 'STALE_SESSION');
  assert.deepEqual(readFileSync(path.join(f.b.root, MCP_FILE)), bPin); assert.equal(await bGuard(), null);
  assert.equal(execFileSync('git', ['-C', f.b.root, 'rev-parse', 'HEAD']).toString(), bHead);
  assert.equal(execFileSync('git', ['-C', f.b.root, 'status', '--porcelain', '--untracked-files=all']).toString(), '');
  assert.throws(() => recover({ ...f.input, recovery: f.recovery('source') }), /recovery-state-blocked/);
});

test('stale approval/source HEAD/authority block commit before live writes', t => {
  const f = fixture(t); prepare(f.input);
  const approval = structuredClone(f.input.approval); approval.bound.choices[0].value = 'invented';
  assert.throws(() => commit({ ...f.input, approval })); assertOutcome(f, 'source');
  gitCommit(f.a.root); assert.throws(() => commit(f.input), /source-git-changed|source-plan-changed/); assertOutcome(f, 'source');
});

test('approval that expires at a live-write boundary fails closed before target publication', t => {
  const f = fixture(t); prepare(f.input);
  const expiry = f.input.approval.expiresAt;
  assert.throws(() => commit({ ...f.input, failpoint: name => {
    if (name.startsWith('before-publish:')) f.input.approval.expiresAt = 0;
  } }), /approval-invalid-or-stale/);
  assertOutcome(f, 'source'); assert.equal(status(f.a.root).blocked, true);
  f.input.approval.expiresAt = expiry;
  recover({ ...f.input, recovery: f.recovery('source') }); assertOutcome(f, 'source');
});

test('rollback is explicit, repeatable, retains evidence, and invalidates source sessions', async t => {
  const f = fixture(t); const guard = await createSessionGuard(f.a.root, f.source.expect);
  prepare(f.input); commit(f.input);
  assert.throws(() => recover(f.input), /recovery-approval-required/);
  assert.equal(recover({ ...f.input, recovery: f.recovery('source') }).state, 'rolled-back'); assertOutcome(f, 'source');
  assert.equal(recover({ ...f.input, recovery: f.recovery('source') }).state, 'rolled-back');
  assert.equal((await guard()).errorCode, 'STALE_SESSION');
  assert.equal(await (await createSessionGuard(f.a.root, f.source.expect))(), null);
});

test('irreversible recipe and later product writes block rollback; explicit forward recovery remains pending', t => {
  const f = fixture(t, { rollbackSafe: false }); prepare(f.input); commit(f.input);
  assert.throws(() => recover({ ...f.input, recovery: f.recovery('source') }), /forward-only-recovery/);
  assert.equal(recover({ ...f.input, recovery: f.recovery('target') }).state, 'await-new-session');
  put(f.a.root, 'src/product.txt', 'later write');
  assert.throws(() => recover({ ...f.input, recovery: f.recovery('target') }), /later-project-writes/);
  assert.equal(status(f.a.root).blocked, true);
});

test('every prepare/stage/checkpoint/material write/pin/verifier failpoint retains proven bytes and recoverable evidence', { timeout: 600000 }, async t => {
  // Derive the material phase list from a real successful transaction; every
  // emitted failpoint must be exercised, including journal publication.
  const baseline = fixture(t), phases = [];
  const trace = name => phases.push(name);
  prepare({ ...baseline.input, failpoint: trace }); commit({ ...baseline.input, failpoint: trace }); verify({ ...baseline.input, session: baseline.session, failpoint: trace });
  const points = [...new Set(phases)];
  for (const point of points) {
    await t.test(point, async sub => {
      const f = fixture(sub), stop = name => { if (name === point) throw new Error(`power-loss:${point}`); };
      assert.throws(() => {
        prepare({ ...f.input, failpoint: stop }); commit({ ...f.input, failpoint: stop }); verify({ ...f.input, session: f.session, failpoint: stop });
      }, /power-loss/);
      const tx = status(f.a.root);
      if (tx.state === 'unknown') {
        assert.equal(tx.blocked, true); assert.equal((await (await createSessionGuard(f.a.root))()).errorCode, 'STALE_SESSION');
        assert.throws(() => recover({ ...f.input, recovery: f.recovery('source') }));
        for (const file of f.result.plan.files) assert.equal(existsSync(path.join(f.a.root, file.path)) ? sha256(readFileSync(path.join(f.a.root, file.path))) : 'absent', file.beforeSha256);
        return;
      }
      if (tx.state === 'authorized') prepare(f.input);
      if (status(f.a.root).state === 'prepared') commit(f.input);
      if (status(f.a.root).state !== 'completed') recover({ ...f.input, recovery: f.recovery('target') });
      verify({ ...f.input, session: f.session }); assertOutcome(f, 'target'); assert.equal(status(f.a.root).state, 'completed');
    });
  }
  assert.ok(points.includes(`after-write:${MCP_FILE}`)); assert.ok(points.includes('after-verifier'));
});

test('every rollback material write and durable checkpoint reconciles source safely after an interruption', { timeout: 300000 }, async t => {
  const baseline = fixture(t), phases = [];
  prepare(baseline.input); commit(baseline.input);
  recover({ ...baseline.input, recovery: baseline.recovery('source'), failpoint: p => phases.push(p) });
  for (const point of [...new Set(phases)]) {
    await t.test(point, sub => {
      const f = fixture(sub); prepare(f.input); commit(f.input);
      assert.throws(() => recover({ ...f.input, recovery: f.recovery('source'), failpoint: p => { if (p === point) throw new Error('rollback power loss'); } }));
      assert.equal(recover({ ...f.input, recovery: f.recovery('source') }).state, 'rolled-back'); assertOutcome(f, 'source');
    });
  }
});

test('observed filesystem parent race refuses live authority writes without escaping into consumer B', t => {
  const f = fixture(t); prepare(f.input);
  const parent = path.join(f.a.root, '.dev-foundry/profiles'), backup = parent + '-race-backup';
  const bBefore = readFileSync(path.join(f.b.root, POP_PATH));
  try {
    assert.throws(() => commit({ ...f.input, failpoint: name => {
      if (name === `before-publish:${POP_PATH}`) { renameSync(parent, backup); symlinkSync(path.join(f.b.root, '.dev-foundry/profiles'), parent); }
    } }), /unsafe-path/);
    assert.deepEqual(readFileSync(path.join(f.b.root, POP_PATH)), bBefore);
  } finally { if (existsSync(backup)) { rmSync(parent); renameSync(backup, parent); } }
  assert.equal(status(f.a.root).blocked, true);
  recover({ ...f.input, recovery: f.recovery('source') }); assertOutcome(f, 'source');
});

test('stable recovery API restores source even when target package cannot be verified or launched', t => {
  const f = fixture(t); prepare(f.input); commit(f.input);
  const installed = installedRuntime(f.storeRoot, f.target.expect);
  replaceSealed(path.join(installed.packageRoot, 'src/governance-mcp/server.js'), 'broken target MCP');
  assert.throws(() => verify({ ...f.input, session: f.session }));
  assert.equal(recover({ ...f.input, recovery: f.recovery('source') }).state, 'rolled-back'); assertOutcome(f, 'source');
});

test('explicit forward recovery checkpoints survive interruptions and retain the recovery decision', t => {
  for (const point of ['before-checkpoint:forward-recovery', 'after-checkpoint:forward-recovery']) {
    const f = fixture(t); prepare(f.input); commit(f.input);
    assert.throws(() => recover({ ...f.input, recovery: f.recovery('target'), failpoint: p => { if (p === point) throw new Error('forward recovery interrupted'); } }));
    recover({ ...f.input, recovery: f.recovery('target') });
    assert.ok(status(f.a.root).checkpoints.some(c => c.state === 'forward-recovery' && c.detail.recovery.operatorApproved === true));
    verify({ ...f.input, session: f.session }); assertOutcome(f, 'target');
  }
});

test('abrupt independent process death leaves lock; explicit dead owner reconciliation preserves lease and resumes without target launch', t => {
  const f = fixture(t); prepare(f.input);
  const module = fileURLToPath(new URL('../../src/runtime/transition.js', import.meta.url));
  const data = { ...f.input, planBytes: f.input.planBytes.toString() };
  const child = spawnSync(process.execPath, ['--input-type=module', '-e',
    `import {commit} from ${JSON.stringify(module)}; const input=JSON.parse(process.argv[1]); input.planBytes=Buffer.from(input.planBytes); commit({...input, failpoint:name=>{if(name==='after-write:${POP_PATH}')process.exit(73)}});`, JSON.stringify(data)], { encoding: 'utf8' });
  assert.equal(child.status, 73, child.stderr);
  const leasePath = path.join(f.a.root, '.dfc-runtime-upgrade/locks/lease/owner.json');
  const dead = JSON.parse(readFileSync(leasePath));
  assert.throws(() => recover({ ...f.input, recovery: f.recovery('target') }), /lock-conflict/);
  recover({ ...f.input, recovery: f.recovery('target'), reconcileLock: dead });
  const locks = path.join(f.a.root, '.dfc-runtime-upgrade/locks');
  const stale = readdirSync(locks).find(n => n.startsWith('stale-'));
  assert.deepEqual(JSON.parse(readFileSync(path.join(locks, stale, 'owner.json'))), dead);
  verify({ ...f.input, session: f.session }); assertOutcome(f, 'target');
});
