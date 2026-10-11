import { createHash } from 'node:crypto';

// This module normalizes evidence; it never acquires packages or executes them.
// Trusted observations are supplied separately by an independent native verifier,
// never loaded from a report. B4A's CLI supplies none for the external gates.
export const SCHEMA = 'dev-foundry.tsk026-host-acceptance.v1';
export const REPOSITORY = 'mavalenzuela22/dev-foundry-claude';
export const PACKAGE = '@dev-foundry/claude-adapter';
export const BRIDGE = Object.freeze({
  first: 'installed-1.4.2->managed-runtime:one-time-verified-host-bootstrap',
  later: 'managed-runtime->managed-runtime:source-governed-model-assisted',
  installerImplemented: false,
});
export const REQUIRED_GATES = Object.freeze([
  'identity', 'host', 'sourceProvenance', 'targetProvenance', 'installedPackages',
  'binShims', 'nativeMac', 'nativeWindows', 'firstBridge', 'twoConsumers',
  'componentParity', 'faultRecovery', 'security', 'historicalPreservation',
  'liveSemanticDecision', 'freshTargetSession', 'independentAudit',
]);
export const FAULTS = Object.freeze(['SOURCE_ACTIVE', 'TARGET_VERIFIED', 'PLAN_READY',
  'AUTHORIZED', 'PREPARED', 'CUTOVER_IN_PROGRESS', 'AWAITING_NEW_SESSION',
  'TARGET_VERIFIED_ACTIVE', 'COMPLETED', 'RECOVERY_REQUIRED', 'ROLLED_BACK',
  'target-cli-failure', 'target-mcp-failure']);
export const SECURITY = Object.freeze(['wrong-project', 'untrusted-origin', 'wrong-hash',
  'path-escape', 'symlink', 'concurrent-writer', 'stale-session', 'unauthorized-choice']);
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const statuses = ['PASS', 'FAIL', 'BLOCKED', 'PENDING'];
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
};
export const evidenceDigest = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export const reportBinding = r => ({ repository: r.repository, producerCommit: r.producerCommit,
  sourcePin: r.source?.pin, targetPin: r.target?.pin, sourceIdentity: evidenceDigest(r.source ?? null),
  targetIdentity: evidenceDigest(r.target ?? null), installed: r.installed, host: r.host });
export function expectedShims(os) {
  const bins = ['dev-foundry-claude', 'dev-foundry-claude-launcher'];
  return os === 'win32' ? bins.flatMap(bin => [bin, `${bin}.cmd`, `${bin}.ps1`]) : bins;
}
export function pendingReport({ producerCommit = null, os = null, arch = null, node = null } = {}) {
  return { schema: SCHEMA, task: 'TSK-026', boundary: 'B4A', scope: 'unverified',
    repository: REPOSITORY, producerCommit, source: null, target: null,
    host: { os, arch, node }, installed: { source: null, target: null },
    expectedBinShims: expectedShims(os), bridge: { ...BRIDGE }, auditRequired: true,
    gates: Object.fromEntries(REQUIRED_GATES.map(g => [g, { status: 'PENDING', evidence: null }])) };
}
function validPackage(p, source) {
  return p?.name === PACKAGE && text(p.version) && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(p.version) &&
    !p.version.split('+')[0].split('-').slice(1).join('-').split('.').some(v => /^0\d+$/.test(v)) &&
    (!source || p.version === '1.4.2') && p.tag === `v${p.version}` && hash(p.payloadRoot) && hash(p.assetSha256) &&
    p.pin === `${p.version}:sha256:${p.payloadRoot}`;
}
function provenance(p) {
  const v = p?.provenance;
  const asset = `dev-foundry-claude-adapter-${p?.version}.tgz`;
  return v?.repository === REPOSITORY && v.tag === p.tag && text(v.releaseId) && text(v.assetId) &&
    v.asset === asset && v.url === `https://github.com/${REPOSITORY}/releases/download/${p.tag}/${asset}` &&
    v.observedAssetSha256 === p.assetSha256 && v.payloadSelfPin === p.pin &&
    ['independent-digest', 'operator-origin-and-hash'].includes(v.trust?.kind) &&
    v.trust.assetSha256 === p.assetSha256 && v.trust.payloadSelfPin === p.pin && text(v.trust.evidence) &&
    (v.trust.kind !== 'operator-origin-and-hash' || v.trust.approved === true);
}
const covers = (value, required) => Array.isArray(value) && required.every(item => value.includes(item));
function sufficient(gate, e, r) {
  switch (gate) {
    case 'sourceProvenance': return provenance(r.source);
    case 'targetProvenance': return provenance(r.target);
    case 'installedPackages': return e.sourceRoot === r.installed?.source && e.targetRoot === r.installed?.target &&
      text(e.sourceRoot) && text(e.targetRoot) && e.sourceRoot !== e.targetRoot && e.bytesVerified === true;
    case 'binShims': return e.os === r.host.os && covers(e.shims, expectedShims(r.host.os)) && e.native === true;
    case 'nativeMac': return e.os === 'darwin' && e.native === true && e.installed === true;
    case 'nativeWindows': return e.os === 'win32' && e.native === true && e.installed === true &&
      e.lockedFilesTested === true && covers(e.shims, expectedShims('win32'));
    case 'firstBridge': return provenance(r.source) && provenance(r.target) && e.executed === true &&
      e.officialInstalledSource === true && e.sourceBytesPreserved === true && e.sourceSessionPreserved === true &&
      e.oneTimeBootstrap === true && e.laterManagedNeedsBootstrap === false && text(e.operatorDecision) && hash(e.planSha256);
    case 'twoConsumers': return e.simultaneous === true && e.otherConsumerUnchanged === true &&
      Array.isArray(e.pins) && new Set(e.pins).size === 2 && e.pins.includes(r.source.pin) && e.pins.includes(r.target.pin);
    case 'componentParity': return covers(e.components, ['cli', 'mcp', 'dashboard', 'telemetry', 'templates', 'migration']) && e.pin === r.target.pin;
    case 'faultRecovery': return covers(e.passedFaults, FAULTS) && e.sourcePreserved === true;
    case 'security': return covers(e.passedCases, SECURITY);
    case 'historicalPreservation': return hash(e.beforeDigest) && e.beforeDigest === e.afterDigest &&
      ['compatible', 'bounded-degradation'].includes(e.readerDisposition) && text(e.schemaMeaningEvidence);
    case 'liveSemanticDecision': return e.live === true && e.sourceGoverned === true && text(e.claudeSession) &&
      text(e.operatorDecision) && hash(e.planSha256) && hash(e.authorityFingerprint);
    case 'freshTargetSession': return e.fresh === true && e.pin === r.target.pin && e.componentsVerified === true;
    case 'independentAudit': return e.independent === true && e.auditor !== e.executor && text(e.auditor) &&
      text(e.executor) && e.verdict === 'PASS' && text(e.record);
    default: return false;
  }
}

// verifiedEvidence is a caller-owned Map of gate -> independently authenticated
// observation. Copying a report's claims into it is not verification. Receipt
// equality binds every observation to this commit, package pair and host.
export function normalizeReport(input, { expectedCommit, host, verifiedEvidence = new Map(),
  fixtureOnly = false } = {}) {
  const r = input && typeof input === 'object' && !Array.isArray(input) ? structuredClone(input) : {};
  const gates = {};
  const set = (g, status, reason) => { gates[g] = { status, reason }; };
  const validIdentity = r.schema === SCHEMA && r.task === 'TSK-026' && r.boundary === 'B4A' &&
    r.repository === REPOSITORY && commit(r.producerCommit) && (!expectedCommit || r.producerCommit === expectedCommit) &&
    validPackage(r.source, true) && validPackage(r.target, false) && r.source.pin !== r.target.pin &&
    r.auditRequired === true && evidenceDigest(r.bridge ?? {}) === evidenceDigest(BRIDGE);
  set('identity', validIdentity ? 'PASS' : 'BLOCKED', validIdentity ? 'exact identities recorded; authenticity is a separate gate' : 'missing or invalid exact source/target/producer/boundary identity');
  const validHost = ['darwin', 'win32'].includes(r.host?.os) && ['arm64', 'x64'].includes(r.host?.arch) &&
    /^v?\d+\.\d+\.\d+$/.test(r.host?.node ?? '') && Number(r.host.node.replace(/^v/, '').split('.')[0]) >= 20;
  const matches = !host || ['os', 'arch', 'node'].every(k => host[k] === r.host?.[k]);
  set('host', !matches ? 'FAIL' : validHost ? 'PASS' : 'BLOCKED', !matches ? 'report differs from observed native host' : validHost ? 'supported host identity recorded' : 'native macOS/Windows and Node >=20 required');
  const binding = reportBinding(r);
  for (const g of REQUIRED_GATES.slice(2)) {
    const claim = r.gates?.[g];
    if (!claim) { set(g, 'PENDING', 'required evidence absent'); continue; }
    if (!statuses.includes(claim.status)) { set(g, 'FAIL', 'invalid gate status'); continue; }
    if (claim.status !== 'PASS') { set(g, claim.status, text(claim.reason) ? claim.reason : 'gate has no passing observation'); continue; }
    if (fixtureOnly || r.scope === 'fixture-only' || claim.evidence?.scope === 'fixture-only') {
      set(g, 'PENDING', 'fixture behavior verified; authentic acceptance remains pending'); continue;
    }
    const e = claim.evidence;
    const verified = verifiedEvidence instanceof Map ? verifiedEvidence.get(g) : undefined;
    if (!e || e.scope !== 'authentic' || !verified || evidenceDigest(verified) !== evidenceDigest(e)) {
      set(g, 'FAIL', 'unverified or forged PASS; independent observation required'); continue;
    }
    if (evidenceDigest(e.binding ?? {}) !== evidenceDigest(binding) || !text(e.record) || !sufficient(g, e, r)) {
      set(g, 'FAIL', 'evidence identity or required native/semantic proof mismatch'); continue;
    }
    set(g, validIdentity && validHost && matches ? 'PASS' : 'BLOCKED', 'independent observation checked against exact report binding');
  }
  // A reported aggregate is never an input authority.
  const values = Object.values(gates).map(g => g.status);
  let aggregate = ['FAIL', 'BLOCKED', 'PENDING'].find(s => values.includes(s)) ?? 'PASS';
  if (r.aggregate === 'PASS' && aggregate !== 'PASS') {
    set('identity', 'FAIL', 'forged aggregate PASS contradicts required gate evidence'); aggregate = 'FAIL';
  }
  return { schema: SCHEMA, task: 'TSK-026', boundary: 'B4A', scope: r.scope ?? 'unverified',
    producerCommit: r.producerCommit ?? null, source: r.source ?? null, target: r.target ?? null,
    host: r.host ?? null, installed: r.installed ?? null, expectedBinShims: expectedShims(r.host?.os),
    bridge: { ...BRIDGE }, auditRequired: true, gates, aggregate,
    nextGates: REQUIRED_GATES.filter(g => gates[g].status !== 'PASS').map(g => ({ gate: g, action:
      g === 'firstBridge' ? 'B4B: implement and execute the separately authorized one-time native bootstrap using immutable official installed 1.4.2; preserve source bytes/session.' :
      g === 'liveSemanticDecision' ? 'B4C: obtain actual source-governed Claude session and exact Operator decision.' :
      `Obtain independent ${g} evidence bound to this producer commit and exact package pair.` })) };
}
