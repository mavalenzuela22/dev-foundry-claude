import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { authorize } from '../../src/runtime/authorization.js';
import { prepare } from '../../src/runtime/transition.js';
import { fixture } from './plan.test.js';

test('wrong/missing/expired/changed exact approval or separately failed gate cannot create journal or authority', t => {
  const f = fixture(t);
  for (const mutate of [i => { i.approval = null; }, i => { i.planSha256 = '0'.repeat(64); }, i => { i.approval.operatorApproved = false; },
    i => { i.approval.sourceAuthorized = false; }, i => { i.approval.expiresAt = 0; }, i => { i.approval.operator = 'Imposter'; },
    ...['planSha256', 'sourceAuthority', 'sourcePin', 'targetPin', 'branch', 'head', 'sourceSessionId'].map(key => i => { i.approval.bound[key] = 'fake'; }),
    i => { i.approval.bound.choices[0].value = 'fake'; }, i => { i.approval.bound.paths.push('src/product.txt'); },
    i => { i.evidence[0].status = 'BLOCKED'; }, i => { i.evidence = []; }]) {
    const input = { ...f.input, approval: structuredClone(f.input.approval), evidence: structuredClone(f.input.evidence) }; mutate(input);
    assert.throws(() => prepare(input)); assert.equal(existsSync(path.join(f.a.root, '.dfc-runtime-upgrade')), false);
  }
  assert.doesNotThrow(() => authorize(f.result.plan, f.result.hash, f.input.approval, f.input.evidence));
});
test('a separately required audit remains BLOCKED even with exact Operator approval', t => {
  const f = fixture(t, { audit: 'required' });
  const evidence = structuredClone(f.input.evidence); evidence.find(e => e.id === 'audit').status = 'BLOCKED';
  assert.throws(() => prepare({ ...f.input, evidence }), /gates-unsatisfied/);
  assert.equal(existsSync(path.join(f.a.root, '.dfc-runtime-upgrade')), false);
});
