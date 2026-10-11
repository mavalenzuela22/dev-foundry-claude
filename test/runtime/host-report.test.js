import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { BRIDGE, FAULTS, SECURITY, PACKAGE, REPOSITORY, REQUIRED_GATES, evidenceDigest,
  expectedShims, normalizeReport, pendingReport, reportBinding } from '../../scripts/acceptance/tsk026-report.mjs';

export const HEAD = 'a'.repeat(40);
export const HOST = { os: 'darwin', arch: 'arm64', node: 'v20.19.5' };
export function scratch(t) {
  const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'tsk026-b4a-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
export function fixtureReport() {
  const report = pendingReport({ producerCommit: HEAD, ...HOST });
  report.scope = 'fixture-only';
  const pkg = (version, digest) => ({ name: PACKAGE, version, tag: `v${version}`, payloadRoot: digest,
    assetSha256: digest, pin: `${version}:sha256:${digest}`, provenance: {
      repository: REPOSITORY, tag: `v${version}`, releaseId: 'fixture-release', assetId: 'fixture-asset',
      asset: `dev-foundry-claude-adapter-${version}.tgz`,
      url: `https://github.com/${REPOSITORY}/releases/download/v${version}/dev-foundry-claude-adapter-${version}.tgz`,
      observedAssetSha256: digest, payloadSelfPin: `${version}:sha256:${digest}`,
      trust: { kind: 'independent-digest', assetSha256: digest, payloadSelfPin: `${version}:sha256:${digest}`,
        evidence: 'fixture-only independently selected digest, no publisher proof' } } });
  report.source = pkg('1.4.2', 'b'.repeat(64));
  report.target = pkg('1.4.3', 'c'.repeat(64));
  report.installed = { source: '/fixture/source', target: '/fixture/target' };
  return report;
}
// Fabricated verifier receipts exercise validation only. They are never host
// acceptance, real Operator approval or actual Claude/audit observations.
export function fixtureReceipts(r) {
  const binding = reportBinding(r);
  const data = {
    sourceProvenance: {}, targetProvenance: {},
    installedPackages: { sourceRoot: r.installed.source, targetRoot: r.installed.target, bytesVerified: true },
    binShims: { os: r.host.os, shims: expectedShims(r.host.os), native: true },
    nativeMac: { os: 'darwin', native: true, installed: true },
    nativeWindows: { os: 'win32', native: true, installed: true, lockedFilesTested: true, shims: expectedShims('win32') },
    firstBridge: { executed: true, officialInstalledSource: true, sourceBytesPreserved: true,
      sourceSessionPreserved: true, oneTimeBootstrap: true, laterManagedNeedsBootstrap: false,
      operatorDecision: 'fixture-only decision', planSha256: 'd'.repeat(64) },
    twoConsumers: { simultaneous: true, otherConsumerUnchanged: true, pins: [r.source.pin, r.target.pin] },
    componentParity: { components: ['cli', 'mcp', 'dashboard', 'telemetry', 'templates', 'migration'], pin: r.target.pin },
    faultRecovery: { passedFaults: [...FAULTS], sourcePreserved: true }, security: { passedCases: [...SECURITY] },
    historicalPreservation: { beforeDigest: 'e'.repeat(64), afterDigest: 'e'.repeat(64), readerDisposition: 'compatible', schemaMeaningEvidence: 'fixture-only schemas' },
    liveSemanticDecision: { live: true, sourceGoverned: true, claudeSession: 'fixture-only-session',
      operatorDecision: 'fixture-only-decision', planSha256: 'd'.repeat(64), authorityFingerprint: 'f'.repeat(64) },
    freshTargetSession: { fresh: true, pin: r.target.pin, componentsVerified: true },
    independentAudit: { independent: true, auditor: 'fixture-auditor', executor: 'fixture-executor', verdict: 'PASS' },
  };
  return new Map(Object.entries(data).map(([g, fields]) => [g, { scope: 'fixture-only', binding,
    record: 'fixture-only record; no acceptance proof', ...fields }]));
}
export function withClaims(r, receipts) {
  for (const [g, e] of receipts) r.gates[g] = { status: 'PASS', evidence: structuredClone(e) };
  return r;
}
// Deliberately hostile authentic labels test the pure function's trusted caller
// boundary. Test names/results remain fixture-only; this is not a proof bundle.
export function verifierFixture() {
  const r = fixtureReport(); r.scope = 'unverified';
  const receipts = fixtureReceipts(r);
  for (const e of receipts.values()) e.scope = 'authentic';
  withClaims(r, receipts);
  return { r, receipts };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  test('missing report exposes every required gate and exact deferred bridge boundary', () => {
    const result = normalizeReport();
    assert.deepEqual(Object.keys(result.gates), REQUIRED_GATES);
    assert.equal(result.aggregate, 'BLOCKED');
    assert.equal(result.gates.firstBridge.status, 'PENDING');
    assert.deepEqual(result.bridge, BRIDGE);
    assert.equal(result.bridge.installerImplemented, false);
    assert.equal(result.auditRequired, true);
  });
  test('fully passing fixture claims remain PENDING and input is not mutated', () => {
    const r = fixtureReport(); const receipts = fixtureReceipts(r); withClaims(r, receipts);
    const before = structuredClone(r);
    const result = normalizeReport(r, { verifiedEvidence: receipts });
    assert.equal(result.aggregate, 'PENDING');
    for (const g of REQUIRED_GATES.slice(2)) assert.equal(result.gates[g].status, 'PENDING');
    assert.deepEqual(r, before);
    assert.deepEqual(normalizeReport(r), normalizeReport(r));
  });
  test('wrong commit, hashes, source version, target pin or absent identities block', () => {
    for (const change of [r => { r.producerCommit = 'bad'; }, r => { r.source = null; },
      r => { r.source.version = '1.4.1'; }, r => { r.source.tag = 'latest'; },
      r => { r.source.assetSha256 = 'unknown'; }, r => { r.target.payloadRoot = 'bad'; },
      r => { r.target.pin = r.source.pin; }, r => { r.repository = 'attacker/repo'; },
      r => { r.auditRequired = false; }, r => { r.bridge.installerImplemented = true; }]) {
      const r = fixtureReport(); change(r);
      assert.equal(normalizeReport(r).gates.identity.status, 'BLOCKED');
    }
    assert.equal(normalizeReport(fixtureReport(), { expectedCommit: 'f'.repeat(40) }).gates.identity.status, 'BLOCKED');
  });
  test('unsupported Node and wrong OS cannot establish native host proof', () => {
    const r = fixtureReport();
    assert.equal(normalizeReport(r, { host: { ...HOST, os: 'win32' } }).gates.host.status, 'FAIL');
    r.host.node = 'v18.20.0'; assert.equal(normalizeReport(r).gates.host.status, 'BLOCKED');
    r.host.node = 'v20garbage'; assert.equal(normalizeReport(r).gates.host.status, 'BLOCKED');
  });
  test('all external authentic PASS claims require separately verified evidence', () => {
    const { r } = verifierFixture();
    const result = normalizeReport(r);
    assert.equal(result.aggregate, 'FAIL');
    for (const g of REQUIRED_GATES.slice(2)) assert.equal(result.gates[g].status, 'FAIL');
  });
  test('fixture validator accepts only complete independently bound receipts; any required unknown defeats PASS', () => {
    const { r, receipts } = verifierFixture();
    assert.equal(normalizeReport(r, { verifiedEvidence: receipts }).aggregate, 'PASS', 'unit-level validation only');
    assert.equal(normalizeReport(r, { verifiedEvidence: receipts, fixtureOnly: true }).aggregate, 'PENDING');
    for (const g of REQUIRED_GATES.slice(2)) {
      const changed = structuredClone(r); delete changed.gates[g];
      assert.equal(normalizeReport(changed, { verifiedEvidence: receipts }).aggregate, 'PENDING');
      for (const status of ['FAIL', 'BLOCKED', 'PENDING']) {
        changed.gates[g] = { status };
        assert.equal(normalizeReport(changed, { verifiedEvidence: receipts }).aggregate, status);
      }
    }
  });
  test('receipt substitution and incomplete native, semantic, preservation, fault and audit gates fail', () => {
    const changes = [
      ['nativeWindows', e => { e.os = 'darwin'; }], ['nativeWindows', e => { e.native = false; }],
      ['nativeWindows', e => { e.shims = e.shims.filter(s => !s.endsWith('.cmd')); }],
      ['installedPackages', e => { e.sourceRoot = e.targetRoot; }],
      ['liveSemanticDecision', e => { delete e.operatorDecision; }], ['liveSemanticDecision', e => { delete e.claudeSession; }],
      ['liveSemanticDecision', e => { e.live = false; }], ['faultRecovery', e => { e.passedFaults.pop(); }],
      ['security', e => { e.passedCases.pop(); }], ['historicalPreservation', e => { e.afterDigest = 'a'.repeat(64); }],
      ['independentAudit', e => { e.auditor = e.executor; }], ['componentParity', e => { e.pin = 'latest'; }],
      ['freshTargetSession', e => { e.fresh = false; }], ['firstBridge', e => { e.binding.producerCommit = 'b'.repeat(40); }],
    ];
    for (const [g, change] of changes) {
      const { r, receipts } = verifierFixture(); change(receipts.get(g)); withClaims(r, receipts);
      assert.equal(normalizeReport(r, { verifiedEvidence: receipts }).gates[g].status, 'FAIL', g);
    }
    const { r, receipts } = verifierFixture(); r.gates.security.evidence.record = 'forged';
    assert.equal(normalizeReport(r, { verifiedEvidence: receipts }).gates.security.status, 'FAIL');
    r.gates.security.status = 'SKIP'; assert.equal(normalizeReport(r).gates.security.status, 'FAIL');
  });
  test('provenance cannot use same-release checksums, mutable tag or wrong publisher/hash', () => {
    for (const change of [p => { p.repository = 'attacker/repo'; }, p => { p.tag = 'latest'; },
      p => { p.observedAssetSha256 = 'a'.repeat(64); }, p => { p.assetId = ''; },
      p => { p.trust.kind = 'same-release-SHA256SUMS'; }, p => { p.trust.payloadSelfPin = 'latest'; }]) {
      const { r, receipts } = verifierFixture(); change(r.source.provenance);
      assert.equal(normalizeReport(r, { verifiedEvidence: receipts }).gates.sourceProvenance.status, 'FAIL');
    }
    assert.equal(evidenceDigest({ b: 2, a: 1 }), evidenceDigest({ a: 1, b: 2 }));
  });
  test('changing matching origin/hash claims or installed roots invalidates independent receipt binding', () => {
    for (const change of [r => {
      r.source.assetSha256 = 'a'.repeat(64); r.source.provenance.observedAssetSha256 = r.source.assetSha256;
      r.source.provenance.trust.assetSha256 = r.source.assetSha256;
    }, r => { r.installed.target = '/fixture/foreign'; }]) {
      const { r, receipts } = verifierFixture(); change(r);
      assert.equal(normalizeReport(r, { verifiedEvidence: receipts }).gates.sourceProvenance.status, 'FAIL');
    }
    const r = fixtureReport(); r.aggregate = 'PASS';
    assert.equal(normalizeReport(r).aggregate, 'FAIL');
  });
}
