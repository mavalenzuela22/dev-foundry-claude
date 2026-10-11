import assert from 'node:assert/strict';
import test from 'node:test';
import { BRIDGE, normalizeReport } from '../../scripts/acceptance/tsk026-report.mjs';
import { fixtureReport, fixtureReceipts, verifierFixture, withClaims } from './host-report.test.js';

test('synthetic 1.4.2 is not a published installed bridge even with passing fixture receipts', () => {
  const r = fixtureReport(); const receipts = fixtureReceipts(r); withClaims(r, receipts);
  const result = normalizeReport(r, { verifiedEvidence: receipts });
  assert.equal(result.gates.firstBridge.status, 'PENDING');
  assert.equal(result.aggregate, 'PENDING');
  assert.deepEqual(result.bridge, BRIDGE);
});
test('real bridge remains PENDING until an actual authenticated observation exists', () => {
  const r = fixtureReport(); r.scope = 'unverified';
  assert.equal(normalizeReport(r).gates.firstBridge.status, 'PENDING');
  assert.match(normalizeReport(r).nextGates.find(g => g.gate === 'firstBridge').action, /B4B.*implement and execute/);
  r.gates.firstBridge = { status: 'PASS', evidence: { executed: true, scope: 'authentic' } };
  assert.equal(normalizeReport(r).gates.firstBridge.status, 'FAIL', 'self-reported execution is not proof');
});
test('bridge requires immutable official provenance, preservation, one-time action and exact decision', () => {
  for (const change of [e => { e.executed = false; }, e => { e.officialInstalledSource = false; },
    e => { e.sourceBytesPreserved = false; }, e => { e.sourceSessionPreserved = false; },
    e => { e.oneTimeBootstrap = false; }, e => { e.laterManagedNeedsBootstrap = true; },
    e => { e.operatorDecision = ''; }, e => { e.planSha256 = 'bad'; }]) {
    const { r, receipts } = verifierFixture(); change(receipts.get('firstBridge')); withClaims(r, receipts);
    assert.equal(normalizeReport(r, { verifiedEvidence: receipts }).gates.firstBridge.status, 'FAIL');
  }
  const { r, receipts } = verifierFixture(); delete r.source.provenance;
  assert.equal(normalizeReport(r, { verifiedEvidence: receipts }).gates.firstBridge.status, 'FAIL');
});
test('later managed upgrades have a distinct model-assisted boundary and no claimed installer', () => {
  const r = fixtureReport();
  const result = normalizeReport(r);
  assert.equal(result.bridge.first, 'installed-1.4.2->managed-runtime:one-time-verified-host-bootstrap');
  assert.equal(result.bridge.later, 'managed-runtime->managed-runtime:source-governed-model-assisted');
  assert.equal(result.bridge.installerImplemented, false);
  assert.equal(result.gates.liveSemanticDecision.status, 'PENDING');
  assert.equal(result.gates.independentAudit.status, 'PENDING');
});
