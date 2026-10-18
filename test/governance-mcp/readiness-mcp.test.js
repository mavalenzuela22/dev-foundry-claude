import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { makeProject, makeV3Project } from './fixture.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverPath = path.join(repoRoot, 'src/governance-mcp/server.js');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const clone = (value) => structuredClone(value);

async function connected(project, { packagedGuards = false } = {}) {
  const args = packagedGuards
    ? ['--import', `data:text/javascript,globalThis[Symbol.for('dev-foundry-claude.consumer-mode-guard')]=true`, serverPath]
    : [serverPath];
  const transport = new StdioClientTransport({ command: process.execPath, args, env: { CLAUDE_PROJECT_DIR: project.root }, cwd: '/tmp' });
  const client = new Client({ name: 'readiness-mcp-regression', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

async function call(client, name, args) {
  const response = await client.callTool({ name, arguments: args });
  assert.equal(response.content.length, 1);
  assert.equal(response.content[0].type, 'text');
  return JSON.parse(response.content[0].text);
}

async function freshAuthority(client) {
  const result = await call(client, 'resolve_governed_operation', {
    requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-002', requestedRole: 'implementation-executor',
  });
  assert.equal(result.ok, true);
  return result.resolution;
}

function observedBundle(resolution) {
  const authorityReferences = resolution.authority.map(({ path, sha256 }) => ({ path, sha256 }))
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const authorityDigest = hash(JSON.stringify(authorityReferences));
  const taskSource = resolution.authority.find((entry) => entry.id === 'TSK-002');
  const capabilitySource = resolution.authority.find((entry) => entry.path === resolution.role.capabilityProfilePaths[0]);
  return {
    expected: { repository: 'fixture-project', branch: 'task/fixture', head: 'a'.repeat(40) },
    observed: { repository: 'fixture-project', branch: 'task/fixture', head: 'a'.repeat(40) },
    task: { id: 'TSK-002', indexed: true, active: true },
    role: { id: 'implementation-executor', selected: true, active: true, compatible: true },
    profile: { id: capabilitySource.id, expectedId: capabilitySource.id, active: true, fit: true },
    authorityReferences,
    authorization: {
      predelegation: { outcome: 'READY', taskId: 'TSK-002', authorityDigest, evidenceId: taskSource.id, evidencePath: taskSource.path, evidenceSha256: taskSource.sha256 },
      intent: { sourceBound: true, taskId: 'TSK-002', authorityDigest, evidenceId: taskSource.id, evidencePath: taskSource.path, evidenceSha256: taskSource.sha256 },
    },
    operation: { scopePaths: ['src/example.js', 'test/example.test.js'], allowedPaths: ['src/example.js', 'test/example.test.js'], hardExclusions: ['.dev-foundry', 'docs'] },
    contract: { path: '.dev-foundry/execution-contracts/TSK-002.json', sha256: hash('contract'), expectedPath: '.dev-foundry/execution-contracts/TSK-002.json', expectedSha256: hash('contract'), validation: 'VALID', preflight: 'READY' },
    validation: { required: ['node-tests', 'git-diff-check'], available: ['git-diff-check', 'node-tests'] },
    executor: { available: true, evidenceId: capabilitySource.id },
    priorEffects: 'none',
  };
}

function assertEnvelope(result, outcome, reasonCode) {
  assert.deepEqual(Object.keys(result), ['outcome', 'reasonCodes', 'nextActions', 'contextFingerprint', 'handoff', 'nonAuthorizing', 'dispatchAllowed']);
  assert.equal(result.outcome, outcome, JSON.stringify(result));
  assert.equal(result.nonAuthorizing, true);
  assert.equal(result.dispatchAllowed, false);
  if (reasonCode) assert.ok(result.reasonCodes.includes(reasonCode));
}

test('stdio discovery and advisory one-shot guidance never turn source hashes into authorization or host proof', async () => {
  const project = await makeProject();
  const client = await connected(project);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ['assess_predelegation_readiness', 'resolve_governed_operation']);
    assert.match(tools.find((tool) => tool.name === 'assess_predelegation_readiness').description, /after resolve_governed_operation and before implementation delegation/i);

    const missing = await call(client, 'assess_predelegation_readiness', { targetProject: 'fixture-project', taskId: 'TSK-002' });
    assertEnvelope(missing, 'INDETERMINATE', 'EVIDENCE_REQUIRED');
    assert.equal(missing.handoff, null);
    assert.ok(missing.reasonCodes.includes('OPERATOR_AUTHORIZATION_UNVERIFIED'));
    assert.ok(missing.reasonCodes.includes('GIT_STATE_UNVERIFIED'));
    assert.ok(missing.reasonCodes.includes('EXECUTION_CONTRACT_UNVERIFIED'));
    assert.ok(missing.reasonCodes.includes('EXECUTOR_AVAILABILITY_UNVERIFIED'));
    assert.ok(missing.reasonCodes.includes('PRIOR_EFFECTS_UNVERIFIED'));
    assert.match(missing.nextActions.join(' '), /Continue permitted Governance Author reading and documentation/);
    assert.match(missing.nextActions.join(' '), /existing authorized native\/host workflow/);
    assert.match(missing.nextActions.join(' '), /do not repeat this diagnostic or invent evidence/);
    assert.doesNotMatch(missing.nextActions.join(' '), /Foundry Runner|authoritative external runner|host\/runner/i);

    const resolution = await freshAuthority(client);
    const asserted = await call(client, 'assess_predelegation_readiness', {
      targetProject: 'fixture-project', taskId: 'TSK-002', expectedContextFingerprint: resolution.contextFingerprint,
      observations: observedBundle(resolution),
    });
    assertEnvelope(asserted, 'INDETERMINATE', 'OPERATOR_AUTHORIZATION_UNVERIFIED');
    assert.equal(asserted.contextFingerprint, resolution.contextFingerprint);
    assert.equal(asserted.handoff, null);
    assert.ok(asserted.reasonCodes.includes('GIT_STATE_UNVERIFIED'));
    assert.ok(asserted.reasonCodes.includes('EXECUTION_CONTRACT_UNVERIFIED'));
    assert.ok(asserted.reasonCodes.includes('EXECUTOR_AVAILABILITY_UNVERIFIED'));
    assert.ok(asserted.reasonCodes.includes('PRIOR_EFFECTS_UNVERIFIED'));
    assert.match(asserted.nextActions.join(' '), /human semantic intent and Operator authorization/);
    assert.match(asserted.nextActions.join(' '), /actual repository, branch, and exact HEAD/);
    assert.equal(JSON.stringify(asserted).includes('PRIVATE_TASK_BODY_MARKER'), false);
  } finally { await client.close(); await project.cleanup(); }
});

test('readiness preserves bounded resolver causes inside the fixed nonauthorizing envelope', async () => {
  const project = await makeProject();
  const client = await connected(project);
  try {
    const actorPath = '.dev-foundry/releases/2.1.0/actor-profiles/implementation-executor.yaml';
    await project.write(actorPath, 'schema_version: dev-foundry.actor-profile.v2\nid: executor-profile\nstatus: inactive\nrole: governance-author\nbody: NEVER_ECHO_THIS\n');
    const result = await call(client, 'assess_predelegation_readiness', { targetProject: 'fixture-project', taskId: 'TSK-002' });
    assertEnvelope(result, 'BLOCKED', 'AUTHORITY_UNAVAILABLE');
    assert.deepEqual(Object.keys(result), ['outcome', 'reasonCodes', 'nextActions', 'contextFingerprint', 'handoff', 'nonAuthorizing', 'dispatchAllowed']);
    const detail = result.nextActions.find(action => action.startsWith('Resolver detail:'));
    assert.ok(detail);
    assert.match(detail, /Actor Profile .*role expected implementation-executor, actual governance-author; status expected active, actual inactive/);
    assert.ok(detail.length <= 260);
    assert.equal(JSON.stringify(result).includes('NEVER_ECHO_THIS'), false);
    assert.doesNotMatch(result.nextActions.join(' '), /Foundry Runner|authoritative external runner|host\/runner/i);
  } finally { await client.close(); await project.cleanup(); }
});

test('wrong project, missing task, malformed input, and stale resolver fingerprint are structured and fail closed', async () => {
  const project = await makeProject();
  const client = await connected(project);
  try {
    const wrongProject = await call(client, 'assess_predelegation_readiness', { targetProject: 'other-project', taskId: 'TSK-002' });
    assertEnvelope(wrongProject, 'BLOCKED', 'TARGET_MISMATCH');
    const missingTask = await call(client, 'assess_predelegation_readiness', { targetProject: 'fixture-project' });
    assertEnvelope(missingTask, 'BLOCKED', 'TASK_UNAVAILABLE');
    const malformed = await call(client, 'assess_predelegation_readiness', { targetProject: 'fixture-project', taskId: 'bad id', unexpected: true });
    assertEnvelope(malformed, 'BLOCKED', 'INVALID_TASK_ID');
    const resolution = await freshAuthority(client);
    const stale = await call(client, 'assess_predelegation_readiness', { targetProject: 'fixture-project', taskId: 'TSK-002', expectedContextFingerprint: '0'.repeat(64), observations: observedBundle(resolution) });
    assertEnvelope(stale, 'BLOCKED', 'STALE_CONTEXT');
  } finally { await client.close(); await project.cleanup(); }
});

test('source-inconsistent authority, task, role, profile, and authorization bindings are blocked', async () => {
  const project = await makeProject();
  const client = await connected(project);
  try {
    const resolution = await freshAuthority(client);
    const base = { targetProject: 'fixture-project', taskId: 'TSK-002', observations: observedBundle(resolution) };
    const mutations = [
      [(x) => { x.observations.authorityReferences.pop(); }, 'OBSERVATION_BINDING_MISMATCH'],
      [(x) => { x.observations.task.id = 'TSK-OTHER'; }, 'OBSERVATION_BINDING_MISMATCH'],
      [(x) => { x.observations.role.id = 'governance-author'; }, 'OBSERVATION_BINDING_MISMATCH'],
      [(x) => { x.observations.profile.id = 'FABRICATED-PROFILE'; x.observations.profile.expectedId = 'FABRICATED-PROFILE'; }, 'OBSERVATION_BINDING_MISMATCH'],
      [(x) => { x.observations.authorization.predelegation.evidencePath = 'docs/fake.md'; x.observations.authorization.intent.evidencePath = 'docs/fake.md'; }, 'AUTHORIZATION_EVIDENCE_UNBOUND'],
    ];
    for (const [mutate, reason] of mutations) {
      const input = clone(base); mutate(input);
      const result = await call(client, 'assess_predelegation_readiness', input);
      assertEnvelope(result, 'BLOCKED', reason);
      assert.equal(result.handoff, null);
    }
    for (const field of ['sourceBound', 'available', 'executorEvidence']) {
      const input = clone(base);
      if (field === 'sourceBound') {
        input.observations.authorization.intent.sourceBound = false;
      } else if (field === 'available') {
        input.observations.executor.available = false;
      } else {
        input.observations.executor.evidenceId = 'FABRICATED-RUNNER';
      }
      const result = await call(client, 'assess_predelegation_readiness', input);
      assertEnvelope(result, 'INDETERMINATE', 'OPERATOR_AUTHORIZATION_UNVERIFIED');
      assert.equal(result.handoff, null);
    }
    for (const [field, value, reason] of [
      ['branch', 'other-branch', 'GIT_STATE_UNVERIFIED'],
      ['head', 'b'.repeat(40), 'GIT_STATE_UNVERIFIED'],
    ]) {
      const input = clone(base);
      input.observations.observed[field] = value;
      const result = await call(client, 'assess_predelegation_readiness', input);
      assertEnvelope(result, 'INDETERMINATE', reason);
      assert.equal(result.handoff, null);
    }
  } finally { await client.close(); await project.cleanup(); }
});

test('unknown, unreconciled, and inflight previous effects remain indeterminate and suppress handoff', async () => {
  const project = await makeProject();
  const client = await connected(project);
  try {
    const resolution = await freshAuthority(client);
    for (const [priorEffects, reason] of [['unknown', 'PRIOR_EFFECTS_UNCLEAR'], ['unreconciled', 'PRIOR_EFFECTS_UNRECONCILED'], ['inflight', 'PRIOR_EFFECTS_INFLIGHT']]) {
      const observations = observedBundle(resolution);
      observations.priorEffects = priorEffects;
      observations.executor.available = false;
      const result = await call(client, 'assess_predelegation_readiness', { targetProject: 'fixture-project', taskId: 'TSK-002', observations });
      assertEnvelope(result, 'INDETERMINATE', reason);
      assert.equal(result.handoff, null);
    }
    const staleWithUnknownEffects = await call(client, 'assess_predelegation_readiness', {
      targetProject: 'fixture-project', taskId: 'TSK-002', expectedContextFingerprint: '0'.repeat(64),
      observations: { ...observedBundle(resolution), priorEffects: 'unknown' },
    });
    assertEnvelope(staleWithUnknownEffects, 'INDETERMINATE', 'PRIOR_EFFECTS_UNCLEAR');
    assert.equal(staleWithUnknownEffects.handoff, null);
  } finally { await client.close(); await project.cleanup(); }
});

test('packaged activation and stale-session guards cannot be bypassed for either tool', async () => {
  const project = await makeProject();
  const client = await connected(project, { packagedGuards: true });
  try {
    const resolver = await call(client, 'resolve_governed_operation', { requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-002' });
    assert.equal(resolver.ok, false);
    assert.equal(resolver.errorCode, 'STALE_SESSION');
    const readiness = await call(client, 'assess_predelegation_readiness', { targetProject: 'fixture-project', taskId: 'TSK-002' });
    assertEnvelope(readiness, 'BLOCKED', 'STALE_SESSION');
    assert.equal(readiness.handoff, null);
  } finally { await client.close(); await project.cleanup(); }
});

test('existing resources and resolver DAT-001 response/error semantics remain available', async () => {
  const project = await makeProject();
  const client = await connected(project);
  try {
    const { resources } = await client.listResources();
    assert.ok(resources.length > 0);
    const success = await call(client, 'resolve_governed_operation', { requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-002' });
    assert.deepEqual(Object.keys(success), ['ok', 'message', 'resolution']);
    assert.deepEqual(Object.keys(success.resolution), ['targetProject', 'frameworkVersion', 'requestedAction', 'taskId', 'role', 'authority', 'requiredAssessments', 'requiredGates', 'contextFingerprint']);
    const failure = await call(client, 'resolve_governed_operation', { requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-002', expectedContextFingerprint: '0'.repeat(64) });
    assert.deepEqual(Object.keys(failure), ['ok', 'errorCode', 'message']);
    assert.equal(failure.errorCode, 'STALE_CONTEXT');
  } finally { await client.close(); await project.cleanup(); }
});

test('POP v3 resolves canonical role policy and bootstrap sources while keeping selection and authorization unresolved', async () => {
  const project = await makeV3Project();
  const client = await connected(project);
  try {
    const resolution = await call(client, 'resolve_governed_operation', {
      requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-029', requestedRole: 'implementation-executor',
    });
    assert.equal(resolution.ok, true, JSON.stringify(resolution));
    assert.equal(resolution.resolution.frameworkVersion, '2.3.0');
    assert.equal(resolution.resolution.role.id, 'implementation-executor');
    assert.deepEqual(resolution.resolution.role.requiredCapabilities, []);
    assert.equal(resolution.resolution.role.eligibilityPolicy, 'operator-and-actor-fit');
    assert.equal(resolution.resolution.role.operationSelection, 'unresolved');
    assert.ok(resolution.resolution.authority.some((source) => source.path === '.dev-foundry/platform-bootstrap-claude-code.yaml'));
    assert.ok(resolution.resolution.authority.some((source) => source.path === '.dev-foundry/releases/2.3.0/release-integrity-manifest.yaml'));
    assert.equal(Object.hasOwn(JSON.parse(await readFile(path.join(project.root, '.dev-foundry/profiles/project-operating-profile.yaml'), 'utf8')).actor_bindings['implementation-executor'], 'implementation'), false);

    const readiness = await call(client, 'assess_predelegation_readiness', {
      targetProject: 'fixture-project', taskId: 'TSK-029', expectedContextFingerprint: resolution.resolution.contextFingerprint,
    });
    assertEnvelope(readiness, 'INDETERMINATE', 'OPERATION_SELECTION_UNRESOLVED');
    assert.ok(readiness.reasonCodes.includes('CAPABILITY_FIT_UNVERIFIED'));
    assert.ok(readiness.reasonCodes.includes('OPERATOR_AUTHORIZATION_UNVERIFIED'));

    const popPath = '.dev-foundry/profiles/project-operating-profile.yaml';
    const pop = JSON.parse(await readFile(path.join(project.root, popPath), 'utf8'));
    pop.actor_bindings['implementation-executor'].selection.required_capabilities = ['code.edit'];
    await project.write(popPath, `${JSON.stringify(pop, null, 2)}\n`);
    const stale = await call(client, 'resolve_governed_operation', {
      requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-029',
      expectedContextFingerprint: resolution.resolution.contextFingerprint,
    });
    assert.equal(stale.ok, false);
    assert.equal(stale.errorCode, 'STALE_CONTEXT');
    pop.actor_bindings['implementation-executor'].implementation = { kind: 'agent', identity: 'fabricated', platform: 'fabricated' };
    await project.write(popPath, `${JSON.stringify(pop, null, 2)}\n`);
    const invalid = await call(client, 'resolve_governed_operation', {
      requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-029',
    });
    assert.equal(invalid.ok, false);
    assert.equal(invalid.errorCode, 'AUTHORITY_INVALID');
  } finally { await client.close(); await project.cleanup(); }
});
