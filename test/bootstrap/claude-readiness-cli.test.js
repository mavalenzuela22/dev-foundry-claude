import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluateReadiness } from '../../src/governance-mcp/readiness.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cliPath = path.join(packageRoot, 'bin/dev-foundry-claude.js');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const HEAD = '02074d1ae7ffa258a7895c17bec0f989631398fe';
const TASK_PATH = 'docs/70-tasks/70 [TSK-027] PROJECT - Restore Governed Adapter Operability and Execution Readiness.md';
const authorityReferences = [
  { path: TASK_PATH, sha256: hash('source evidence') },
  { path: 'docs/authority.md', sha256: hash('authority') },
  { path: 'docs/task.md', sha256: hash('task authority') },
].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
const authorityDigest = hash(JSON.stringify(authorityReferences));

function readyInput() {
  return {
    expected: { repository: 'dev-foundry-claude', branch: 'task/tsk-027-governance-operability-refactor', head: HEAD },
    observed: { repository: 'dev-foundry-claude', branch: 'task/tsk-027-governance-operability-refactor', head: HEAD },
    task: { id: 'TSK-027', indexed: true, active: true },
    role: { id: 'implementation-executor', selected: true, active: true, compatible: true },
    profile: { id: 'DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3', expectedId: 'DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3', active: true, fit: true },
    authorityReferences: authorityReferences.map((reference) => ({ ...reference })),
    authorization: {
      predelegation: { outcome: 'READY', taskId: 'TSK-027', authorityDigest, evidenceId: 'AUTH-1', evidencePath: TASK_PATH, evidenceSha256: hash('source evidence') },
      intent: { sourceBound: true, taskId: 'TSK-027', authorityDigest, evidenceId: 'AUTH-1', evidencePath: TASK_PATH, evidenceSha256: hash('source evidence') },
    },
    operation: { scopePaths: ['bin/dev-foundry-claude.js', 'test/bootstrap/claude-readiness-cli.test.js'], allowedPaths: ['bin/dev-foundry-claude.js', 'test/bootstrap/claude-readiness-cli.test.js'], hardExclusions: ['docs', '.dev-foundry'] },
    contract: { path: '.dev-foundry/execution-contracts/TSK-027.json', sha256: hash('contract'), expectedPath: '.dev-foundry/execution-contracts/TSK-027.json', expectedSha256: hash('contract'), validation: 'VALID', preflight: 'READY' },
    validation: { required: ['node-tests', 'git-diff-check'], available: ['git-diff-check', 'node-tests'] },
    executor: { available: true, evidenceId: 'EXEC-1' },
    priorEffects: 'none',
  };
}

function runCli(args, input, cwd = packageRoot) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 1024 * 1024,
  });
}

function assertSingleDiagnostic(result, expectedOutcome, expectedCode) {
  assert.equal(result.status, expectedCode, result.stderr);
  assert.equal(result.signal, null);
  assert.equal(result.stdout.endsWith('\n'), true);
  assert.equal(result.stdout.trim().split('\n').length, 1);
  const diagnostic = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(diagnostic), [
    'outcome', 'reasonCodes', 'nextActions', 'contextFingerprint', 'handoff',
    'nonAuthorizing', 'dispatchAllowed',
  ]);
  assert.equal(diagnostic.outcome, expectedOutcome);
  assert.equal(diagnostic.nonAuthorizing, true);
  assert.equal(diagnostic.dispatchAllowed, false);
  return diagnostic;
}

test('real CLI accepts the documented stdin contract and emits one non-authorizing READY diagnostic', () => {
  const input = readyInput();
  const expected = evaluateReadiness(input);
  const result = runCli(['readiness', 'check', '--input', '-'], JSON.stringify(input));
  const diagnostic = assertSingleDiagnostic(result, 'READY', 0);
  assert.deepEqual({
    outcome: diagnostic.outcome,
    reasonCodes: diagnostic.reasonCodes,
    nextActions: diagnostic.nextActions,
    contextFingerprint: diagnostic.contextFingerprint,
    handoff: diagnostic.handoff,
  }, expected);
  assert.ok(Buffer.byteLength(JSON.stringify(diagnostic.handoff), 'utf8') < 8192);
  assert.equal(diagnostic.handoff.readOnly, true);
  assert.equal(diagnostic.handoff.authority[0].path, TASK_PATH);
  assert.equal(diagnostic.handoff.authority.some((reference) => reference.path === TASK_PATH), true);
});

test('missing source-bound authorization and mismatched repository facts are BLOCKED', () => {
  const missingAuth = readyInput();
  missingAuth.authorization.intent.sourceBound = false;
  const authResult = runCli(['readiness', 'check', '--input', '-'], JSON.stringify(missingAuth));
  const authDiagnostic = assertSingleDiagnostic(authResult, 'BLOCKED', 2);
  assert.equal(authDiagnostic.handoff, null);
  assert.ok(authDiagnostic.reasonCodes.includes('AUTHORIZATION_NOT_SOURCE_BOUND'));

  const mismatch = readyInput();
  mismatch.observed.head = '1111111111111111111111111111111111111111';
  const mismatchResult = runCli(['readiness', 'check', '--input', '-'], JSON.stringify(mismatch));
  const mismatchDiagnostic = assertSingleDiagnostic(mismatchResult, 'BLOCKED', 2);
  assert.equal(mismatchDiagnostic.handoff, null);
  assert.ok(mismatchDiagnostic.reasonCodes.includes('HEAD_MISMATCH'));
});

test('unknown, unreconciled and inflight prior effects are INDETERMINATE with no handoff', () => {
  for (const priorEffects of ['unknown', 'unreconciled', 'inflight']) {
    const input = readyInput();
    input.priorEffects = priorEffects;
    const result = runCli(['readiness', 'check', '--input', '-'], JSON.stringify(input));
    const diagnostic = assertSingleDiagnostic(result, 'INDETERMINATE', 3);
    assert.equal(diagnostic.handoff, null);
    assert.ok(diagnostic.reasonCodes.some((reason) => reason.startsWith('PRIOR_EFFECTS_')));
  }
});

test('malformed and oversized JSON fail safely without echoing input or reporting readiness', () => {
  const secret = 'caller-secret-that-must-not-leak';
  const malformed = runCli(['readiness', 'check', '--input', '-'], `{"credential":"${secret}"`);
  assert.equal(malformed.status, 2);
  assert.equal(malformed.stdout, '');
  assert.doesNotMatch(malformed.stderr, new RegExp(secret));

  const oversized = runCli(['readiness', 'check', '--input', '-'], Buffer.alloc(131073, 0x20));
  assert.equal(oversized.status, 2);
  assert.equal(oversized.stdout, '');
  assert.match(oversized.stderr, /^Invalid or oversized readiness JSON input\./);
});

test('only exact readiness arguments are accepted, with stable usage failure and no diagnostic output', () => {
  for (const args of [
    ['readiness'],
    ['readiness', 'check'],
    ['readiness', 'check', '--input'],
    ['readiness', 'check', '--input', 'caller.json'],
    ['readiness', 'check', '--input', '-', '--input', '-'],
    ['readiness', 'check', '--unknown', '--input', '-'],
    ['readiness', 'check', '--input', '-', 'extra'],
  ]) {
    const result = runCli(args, JSON.stringify(readyInput()));
    assert.equal(result.status, 2, args.join(' '));
    assert.equal(result.stdout, '', args.join(' '));
    assert.equal(result.stderr, 'Usage: dev-foundry-claude readiness check --input -\n', args.join(' '));
  }
});

test('command branch invokes only the pure classifier and leaves no files behind', () => {
  const cli = readFileSync(cliPath, 'utf8');
  const branchStart = cli.indexOf('async function readinessCommand');
  const branchEnd = cli.indexOf('\nfunction flags', branchStart);
  assert.notEqual(branchStart, -1);
  assert.notEqual(branchEnd, -1);
  const branch = cli.slice(branchStart, branchEnd);
  assert.match(branch, /\.\.\/src\/governance-mcp\/readiness\.js/);
  assert.doesNotMatch(branch, /spawnSync|consumerCommand|server\.js|fetch\s*\(|https?:\/\//);
  assert.doesNotMatch(readFileSync(path.join(packageRoot, 'README.md'), 'utf8'), /readiness check/);

  const emptyCwd = mkdtempSync(path.join(os.tmpdir(), 'claude-readiness-cli-'));
  try {
    assert.deepEqual(readdirSync(emptyCwd), []);
    const result = runCli(['readiness', 'check', '--input', '-'], JSON.stringify(readyInput()), emptyCwd);
    assertSingleDiagnostic(result, 'READY', 0);
    assert.deepEqual(readdirSync(emptyCwd), []);
  } finally {
    rmSync(emptyCwd, { recursive: true, force: true });
  }
});
