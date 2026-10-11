import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../../src/adopt/pin.js';
import { runtimeCommand } from '../../src/runtime/cli.js';
import { fixture, gitCommit, put } from './plan.test.js';
import { attestation, scratch } from './identity.test.js';
import { status } from '../../src/runtime/transition.js';

function inputFile(t, value) { const file = path.join(scratch(t), 'input.json'); writeFileSync(file, canonicalJson(value)); return file; }
function request(f, extra = {}) { return { format: 'dev-foundry.runtime-request.v1', root: f.a.root, plan: f.result.plan, planSha256: f.result.hash, approval: f.input.approval, evidence: f.input.evidence, ...extra }; }
function call(f, action, file, output = () => {}) { return runtimeCommand({ cwd: f.a.root, argv: [action, '--store-root', f.storeRoot, ...(file ? ['--input', file] : [])], output }); }

test('CLI proposal/plan/status/doctor are read-only and B2 requires explicit hash-bound Operator authorization', async t => {
  const f = fixture(t), before = readFileSync(path.join(f.a.root, '.mcp.json'));
  for (const action of ['status', 'doctor']) assert.equal(await call(f, action), 0);
  const stageRequest = { format: 'dev-foundry.runtime-stage-request.v1', root: f.a.root, sourcePin: f.source.expect,
    expect: f.target.expect, candidateRoot: f.target.root, permittedCandidateRoots: [f.target.root], attestation: attestation(f.target.expect, f.source.expect) };
  assert.equal(await call(f, 'stage', inputFile(t, stageRequest)), 0);
  await assert.rejects(call(f, 'stage', inputFile(t, { ...stageRequest, attestation: { ...stageRequest.attestation, provenance: {} } })), /acquisition-blocked/);
  let view;
  assert.equal(await call(f, 'proposal', inputFile(t, { format: 'dev-foundry.runtime-proposal-request.v1', root: f.a.root, sourcePin: f.source.expect, targetPin: f.target.expect }), s => { view = JSON.parse(s); }), 0);
  assert.equal(view.target.expect, f.target.expect); assert.equal(view.adoptionAuthorized, false);
  await call(f, 'plan', inputFile(t, { format: 'dev-foundry.runtime-candidate.v1', candidate: f.candidate }), s => { view = JSON.parse(s); });
  assert.equal(view.planSha256, f.result.hash); assert.equal(view.adoptionAuthorized, false);
  const denied = request(f); denied.approval = { ...denied.approval, operatorApproved: false };
  await assert.rejects(call(f, 'prepare', inputFile(t, denied)), /approval/);
  assert.equal(existsSync(path.join(f.a.root, '.dfc-runtime-upgrade')), false);
  const file = inputFile(t, request(f)); assert.equal(await call(f, 'prepare', file), 0);
  assert.deepEqual(readFileSync(path.join(f.a.root, '.mcp.json')), before);
  assert.equal(await call(f, 'commit', file), 0); assert.equal(status(f.a.root).state, 'await-new-session');
  await assert.rejects(call(f, 'verify', file), /fresh-session-evidence/);
  const forged = request(f, { session: { format: 'dev-foundry.runtime-session-request.v1', evidence: 'caller', independent: true, pin: f.target.expect } });
  await assert.rejects(call(f, 'verify', inputFile(t, forged)), /evidence-format/);
  // Stub target is not an MCP: actual fresh-process check must fail and retain pending journal.
  await assert.rejects(call(f, 'verify', inputFile(t, request(f, { session: { format: 'dev-foundry.runtime-session-request.v1', evidence: 'synthetic caller evidence' } }))), /Fresh target MCP/);
  assert.equal(status(f.a.root).state, 'await-new-session');
  assert.equal(await call(f, 'recover', inputFile(t, request(f, { recovery: f.recovery('source') }))), 0);
  assert.deepEqual(readFileSync(path.join(f.a.root, '.mcp.json')), before);
  assert.equal(readFileSync(path.join(f.a.root, 'src/product.txt'), 'utf8'), 'consumer product must remain identical');
});

test('CLI rejects unknown flags/duplicate keys/--yes, stale proposal/HEAD, unbound plan and missing local journal ignore', async t => {
  const f = fixture(t);
  for (const argv of [['prepare', '--yes'], ['doctor', '--root', f.a.root, '--root', f.a.root], ['unknown']]) await assert.rejects(runtimeCommand({ cwd: f.a.root, argv, output: () => {} }));
  const bad = path.join(scratch(t), 'duplicate.json'); writeFileSync(bad, '{"format":"a","format":"b"}');
  await assert.rejects(call(f, 'plan', bad));
  const candidate = structuredClone(f.candidate); candidate.proposal.sourceAuthority = '0'.repeat(64);
  await assert.rejects(call(f, 'plan', inputFile(t, { format: 'dev-foundry.runtime-candidate.v1', candidate })), /source-proposal/);
  const stale = inputFile(t, request(f)); gitCommit(f.a.root);
  await assert.rejects(call(f, 'prepare', stale), /source-git-changed|source-plan-changed/);
  const missing = fixture(t, { ignore: false });
  await assert.rejects(call(missing, 'prepare', inputFile(t, request(missing))), /journal-ignore-required/);
  const changed = request(missing); changed.planSha256 = '0'.repeat(64);
  await assert.rejects(call(missing, 'prepare', inputFile(t, changed)), /invalid-plan/);
});
