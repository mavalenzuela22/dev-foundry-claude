import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { evaluateReadiness } from '../../src/governance-mcp/readiness.js';

const hash = (s) => createHash('sha256').update(s).digest('hex');
const CURRENT_HEAD = '02074d1ae7ffa258a7895c17bec0f989631398fe';
const TASK_AUTHORITY_PATH = 'docs/70-tasks/70 [TSK-027] PROJECT - Restore Governed Adapter Operability and Execution Readiness.md';
const authority = [
  { path: TASK_AUTHORITY_PATH, sha256: hash('source evidence') },
  { path: 'docs/authority.md', sha256: hash('authority') },
  { path: 'docs/task.md', sha256: hash('task authority') },
].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const authorityDigest = hash(JSON.stringify(authority));

function readyInput() {
  return {
    expected: { repository: 'dev-foundry-claude', branch: 'task/tsk-027-governance-operability-refactor', head: CURRENT_HEAD },
    observed: { repository: 'dev-foundry-claude', branch: 'task/tsk-027-governance-operability-refactor', head: CURRENT_HEAD },
    task: { id: 'TSK-027', indexed: true, active: true },
    role: { id: 'implementation-executor', selected: true, active: true, compatible: true },
    profile: { id: 'DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3', expectedId: 'DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3', active: true, fit: true },
    authorityReferences: authority.map((reference) => ({ ...reference })),
    authorization: {
      predelegation: { outcome: 'READY', taskId: 'TSK-027', authorityDigest, evidenceId: 'AUTH-1', evidencePath: TASK_AUTHORITY_PATH, evidenceSha256: hash('source evidence') },
      intent: { sourceBound: true, taskId: 'TSK-027', authorityDigest, evidenceId: 'AUTH-1', evidencePath: TASK_AUTHORITY_PATH, evidenceSha256: hash('source evidence') },
    },
    operation: { scopePaths: ['src/new.js', 'test/new.test.js'], allowedPaths: ['src/new.js', 'test/new.test.js'], hardExclusions: ['docs', '.dev-foundry'] },
    contract: { path: '.dev-foundry/execution-contracts/TSK-027.json', sha256: hash('contract'), expectedPath: '.dev-foundry/execution-contracts/TSK-027.json', expectedSha256: hash('contract'), validation: 'VALID', preflight: 'READY' },
    validation: { required: ['node-tests', 'git-diff-check'], available: ['git-diff-check', 'node-tests'] },
    executor: { available: true, evidenceId: 'EXEC-1' },
    priorEffects: 'none',
  };
}

const clone = (x) => structuredClone(x);

test('READY produces a compact, fingerprint-bound handoff with references only', () => {
  const input = readyInput();
  const out = evaluateReadiness(input);
  assert.equal(out.outcome, 'READY');
  assert.deepEqual(out.reasonCodes, []);
  assert.deepEqual(out.nextActions, []);
  assert.equal(out.handoff.project, input.expected.repository);
  assert.equal(out.handoff.task, input.task.id);
  assert.equal(out.handoff.contract.sha256, input.contract.sha256);
  assert.deepEqual(out.handoff.authority, input.authorityReferences);
  assert.ok(Buffer.byteLength(JSON.stringify(out.handoff), 'utf8') < 8192);
  assert.equal(JSON.stringify(out).includes('source evidence'), false);
  assert.equal(JSON.stringify(out).includes('conversation'), false);
  assert.equal(JSON.stringify(out).includes('executor credentials'), false);
  assert.equal(out.handoff.readOnly, true);
});

test('expected and observed repository identity mismatch blocks with no handoff', () => {
  const input = readyInput(); input.observed.repository = 'other-project';
  const out = evaluateReadiness(input);
  assert.equal(out.outcome, 'BLOCKED'); assert.ok(out.reasonCodes.includes('REPOSITORY_MISMATCH')); assert.equal(out.handoff, null);
});

test('missing and inactive tasks fail closed', () => {
  for (const patch of [{ indexed: false }, { active: false }]) {
    const input = readyInput(); Object.assign(input.task, patch);
    const out = evaluateReadiness(input);
    assert.equal(out.outcome, 'BLOCKED'); assert.equal(out.handoff, null);
    assert.ok(out.reasonCodes.includes(patch.indexed === false ? 'TASK_MISSING' : 'TASK_INACTIVE'));
  }
  const absent = readyInput(); delete absent.task;
  const out = evaluateReadiness(absent);
  assert.equal(out.outcome, 'BLOCKED'); assert.ok(out.reasonCodes.includes('TASK_MISSING')); assert.equal(out.handoff, null);
});

test('authorization requires external READY and cross-checked source-bound evidence', () => {
  for (const mutate of [
    (x) => { x.authorization.predelegation.outcome = 'BLOCKED'; },
    (x) => { x.authorization.intent.sourceBound = false; },
    (x) => { x.authorization.intent.taskId = 'TSK-OTHER'; },
    (x) => { x.authorization.intent.evidenceSha256 = hash('different'); },
    (x) => { x.authorization.predelegation.authorityDigest = hash('different authority'); },
  ]) {
    const input = readyInput(); mutate(input);
    const out = evaluateReadiness(input);
    assert.notEqual(out.outcome, 'READY'); assert.equal(out.handoff, null);
  }
  const absent = readyInput(); delete absent.authorization.intent;
  assert.equal(evaluateReadiness(absent).outcome, 'BLOCKED');
  assert.equal(evaluateReadiness(absent).handoff, null);
});

test('a caller-supplied stale expected context digest blocks', () => {
  const input = readyInput(); input.expectedContextFingerprint = hash('stale');
  const out = evaluateReadiness(input);
  assert.equal(out.outcome, 'BLOCKED'); assert.ok(out.reasonCodes.includes('STALE_CONTEXT_FINGERPRINT')); assert.equal(out.handoff, null);
});

test('wrong branch and exact HEAD block independently', () => {
  const input = readyInput(); input.observed.branch = 'main'; input.observed.head = hash('other commit');
  const out = evaluateReadiness(input);
  assert.equal(out.outcome, 'BLOCKED');
  assert.ok(out.reasonCodes.includes('BRANCH_MISMATCH')); assert.ok(out.reasonCodes.includes('HEAD_MISMATCH')); assert.equal(out.handoff, null);
});

test('accepts exact SHA-1 and SHA-256 Git object IDs while rejecting malformed and partial IDs', () => {
  const sha256Input = readyInput();
  sha256Input.expected.head = 'a'.repeat(64);
  sha256Input.observed.head = 'a'.repeat(64);
  assert.equal(evaluateReadiness(sha256Input).outcome, 'READY');

  for (const malformed of [
    'a'.repeat(39), 'a'.repeat(41), 'a'.repeat(63), 'a'.repeat(65),
    'A'.repeat(40), 'g'.repeat(40), 'a'.repeat(12),
  ]) {
    for (const key of ['expected', 'observed']) {
      const input = readyInput(); input[key].head = malformed;
      const out = evaluateReadiness(input);
      assert.equal(out.outcome, 'BLOCKED', `${key} accepted ${malformed.length}-character malformed OID`);
      assert.deepEqual(out.reasonCodes, ['INVALID_INPUT']);
      assert.equal(out.handoff, null);
    }
  }
});

test('canonical authority paths accept literal spaces and brackets and reject unsafe forms', () => {
  assert.equal(evaluateReadiness(readyInput()).outcome, 'READY');
  const invalidPaths = [
    '/docs/authority.md', '//server/share/authority.md', 'C:/docs/authority.md',
    '../docs/authority.md', './docs/authority.md', 'docs/./authority.md',
    'docs/../authority.md', 'docs\\authority.md', 'docs/authority\0.md',
    'docs/authority\n.md', 'docs//authority.md', 'docs/%2e%2e/authority.md',
  ];
  for (const path of invalidPaths) {
    const input = readyInput(); input.authorityReferences[0].path = path;
    const out = evaluateReadiness(input);
    assert.equal(out.outcome, 'BLOCKED', `accepted unsafe path ${JSON.stringify(path)}`);
    assert.ok(out.reasonCodes.includes('AUTHORITY_REFERENCE_INVALID'));
    assert.equal(out.handoff, null);
  }
});

test('literal space and bracket path bytes remain digest-sensitive', () => {
  const original = readyInput();
  const before = evaluateReadiness(original);
  const changed = readyInput();
  changed.authorityReferences[0].path = TASK_AUTHORITY_PATH.replace('[TSK-027]', '[TSK 027]');
  const digestForChangedAuthority = hash(JSON.stringify(changed.authorityReferences));
  changed.authorization.predelegation.authorityDigest = digestForChangedAuthority;
  changed.authorization.intent.authorityDigest = digestForChangedAuthority;
  changed.authorization.predelegation.evidencePath = changed.authorityReferences[0].path;
  changed.authorization.intent.evidencePath = changed.authorityReferences[0].path;
  const after = evaluateReadiness(changed);
  assert.equal(before.outcome, 'READY');
  assert.equal(after.outcome, 'READY');
  assert.notEqual(before.contextFingerprint, after.contextFingerprint);
});

test('unselected role and inactive or incompatible profile block', () => {
  for (const mutate of [
    (x) => { x.role.selected = false; },
    (x) => { x.profile.active = false; },
    (x) => { x.profile.fit = false; },
    (x) => { x.profile.id = 'OTHER-PROFILE'; },
  ]) {
    const input = readyInput(); mutate(input);
    const out = evaluateReadiness(input);
    assert.equal(out.outcome, 'BLOCKED'); assert.equal(out.handoff, null);
  }
});

test('invalid or mismatched contract and unavailable executor block', () => {
  const badContract = readyInput(); badContract.contract.validation = 'INVALID';
  const c = evaluateReadiness(badContract); assert.equal(c.outcome, 'BLOCKED'); assert.ok(c.reasonCodes.includes('CONTRACT_INVALID')); assert.equal(c.handoff, null);
  const badRef = readyInput(); badRef.contract.expectedSha256 = hash('other');
  const r = evaluateReadiness(badRef); assert.ok(r.reasonCodes.includes('CONTRACT_REFERENCE_MISMATCH')); assert.equal(r.handoff, null);
  const unavailable = readyInput(); unavailable.executor.available = false;
  const e = evaluateReadiness(unavailable); assert.ok(e.reasonCodes.includes('EXECUTOR_UNAVAILABLE')); assert.equal(e.handoff, null);
});

test('missing mandatory validation prerequisites block', () => {
  const input = readyInput(); input.validation.available = ['git-diff-check'];
  const out = evaluateReadiness(input);
  assert.equal(out.outcome, 'BLOCKED'); assert.ok(out.reasonCodes.includes('VALIDATION_UNAVAILABLE')); assert.equal(out.handoff, null);
});

test('scope mismatch and hard exclusion collisions block', () => {
  const wrongScope = readyInput(); wrongScope.operation.allowedPaths.pop();
  const a = evaluateReadiness(wrongScope); assert.ok(a.reasonCodes.includes('PATH_SCOPE_INVALID')); assert.equal(a.handoff, null);
  const collision = readyInput(); collision.operation.hardExclusions.push('src');
  const b = evaluateReadiness(collision); assert.ok(b.reasonCodes.includes('HARD_EXCLUSION_COLLISION')); assert.equal(b.handoff, null);
});

test('unclear, unreconciled and inflight prior effects dominate other blockers', () => {
  for (const priorEffects of ['unknown', 'unreconciled', 'inflight']) {
    const input = readyInput(); input.priorEffects = priorEffects; input.executor.available = false;
    const out = evaluateReadiness(input);
    assert.equal(out.outcome, 'INDETERMINATE'); assert.equal(out.handoff, null);
    assert.ok(out.reasonCodes.some((r) => r.startsWith('PRIOR_EFFECTS_')));
  }
  const malformed = readyInput(); malformed.priorEffects = 'unknown'; delete malformed.task;
  const out = evaluateReadiness(malformed);
  assert.equal(out.outcome, 'INDETERMINATE'); assert.equal(out.handoff, null);
});

test('reordering logically unordered refs and path sets preserves the digest', () => {
  const a = readyInput(); const b = readyInput();
  b.authorityReferences.reverse(); b.operation.scopePaths.reverse(); b.operation.allowedPaths.reverse(); b.operation.hardExclusions.reverse(); b.validation.required.reverse(); b.validation.available.reverse();
  assert.equal(evaluateReadiness(a).contextFingerprint, evaluateReadiness(b).contextFingerprint);
});

test('changed material facts change the digest and a fresh supplied digest is accepted', () => {
  const a = readyInput(); const before = evaluateReadiness(a);
  const b = readyInput(); b.observed.head = hash('changed');
  const after = evaluateReadiness(b);
  assert.notEqual(before.contextFingerprint, after.contextFingerprint);
  assert.equal(after.outcome, 'BLOCKED');
  const fresh = readyInput(); fresh.expectedContextFingerprint = evaluateReadiness(fresh).contextFingerprint;
  assert.equal(evaluateReadiness(fresh).outcome, 'READY');
});

test('oversized valid handoff fails closed', () => {
  const input = readyInput();
  input.operation.scopePaths = []; input.operation.allowedPaths = [];
  for (let i = 0; i < 350; i += 1) {
    const p = `src/generated-${String(i).padStart(4, '0')}-${'x'.repeat(35)}.js`;
    input.operation.scopePaths.push(p); input.operation.allowedPaths.push(p);
  }
  const out = evaluateReadiness(input);
  assert.equal(out.outcome, 'BLOCKED'); assert.ok(out.reasonCodes.includes('HANDOFF_TOO_LARGE')); assert.equal(out.handoff, null);
});

test('closed input rejects unknown fields and never returns a false PASS', () => {
  const input = readyInput(); input.syntheticOperatorApproval = true;
  const out = evaluateReadiness(input);
  assert.equal(out.outcome, 'BLOCKED'); assert.deepEqual(out.reasonCodes, ['INVALID_INPUT']); assert.equal(out.handoff, null);
});
