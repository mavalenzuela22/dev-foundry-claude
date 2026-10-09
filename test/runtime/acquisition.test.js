import assert from 'node:assert/strict';
import test from 'node:test';
import { acquisitionPlan } from '../../src/runtime/acquisition.js';
import { attestation } from './identity.test.js';

const expect = `1.4.2:sha256:${'a'.repeat(64)}`;
const input = () => ({ kind: 'unpacked-local', expect, ...attestation(expect) });
test('explicit independent digest or bounded Operator approval permits only local staging', () => {
  const i = input(); const plan = acquisitionPlan(i);
  assert.equal(plan.status, 'approved-local-stage'); assert.equal(plan.runnable, false);
  i.provenance.trust.kind = 'operator-origin-and-hash'; i.provenance.trust.approved = true;
  assert.equal(acquisitionPlan(i).status, 'approved-local-stage');
  assert.equal(plan.provenance.trust.kind, 'independent-digest', 'plan retains a detached attestation');
});
test('same-release checksums, missing trust, wrong official origin/tag/asset/hash or unsupported transition block', () => {
  for (const mutate of [i => { i.provenance.trust.kind = 'same-release-SHA256SUMS'; },
    i => { delete i.provenance.trust; }, i => { i.provenance.repository = 'attacker/repo'; },
    i => { i.provenance.tag = 'latest'; }, i => { i.provenance.asset = '../asset.tgz'; },
    i => { i.provenance.url = 'http://github.com/asset'; }, i => { i.provenance.observedAssetSha256 = 'unknown'; },
    i => { i.provenance.payloadSelfPin = `1.4.2:sha256:${'b'.repeat(64)}`; },
    i => { i.provenance.trust.assetSha256 = 'b'.repeat(64); }, i => { i.provenance.trust.evidence = ''; },
    i => { i.provenance.trust.kind = 'operator-origin-and-hash'; i.provenance.trust.approved = false; },
    i => { i.transition.supported = false; }, i => { delete i.transition.source; },
    i => { i.transition.target = 'latest'; }, i => { i.transition.declaration = 'unreviewed'; }]) {
    const i = input(); mutate(i); const plan = acquisitionPlan(i);
    assert.equal(plan.status, 'blocked'); assert.equal(plan.runnable, false);
  }
});
test('every archive/remote/unknown acquisition is non-runnable even with approved provenance', () => {
  for (const kind of ['archive', 'tgz', 'zip', 'remote', undefined]) {
    const plan = acquisitionPlan({ ...input(), kind });
    assert.equal(plan.status, 'blocked'); assert.equal(plan.code, 'offline-unpacked-only'); assert.equal(plan.runnable, false);
  }
  assert.equal(acquisitionPlan().status, 'blocked');
});
