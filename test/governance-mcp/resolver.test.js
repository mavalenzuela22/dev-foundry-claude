import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { resolveGovernedOperation } from '../../src/governance-mcp/resolver.js';
import { makeProject } from './fixture.js';

const validImplement = { requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-002' };

async function withProject(run) {
  const project = await makeProject();
  try { await run(project); } finally { await project.cleanup(); }
}

test('accepts a valid request and strictly rejects unknown, invalid, and cross-field inputs', async () => {
  await withProject(async ({ root }) => {
    const valid = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(valid.ok, true);
    assert.deepEqual(Object.keys(valid), ['ok', 'message', 'resolution']);
    for (const request of [
      { ...validImplement, unknown: true },
      { requestedAction: 'write', targetProject: 'fixture-project', taskId: 'TSK-002' },
      { requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'not valid' },
      { requestedAction: 'author', targetProject: 'fixture-project' },
      { requestedAction: 'implement', targetProject: 'fixture-project', boundaryId: 'pre-task' },
    ]) {
      const result = await resolveGovernedOperation(request, { projectRoot: root });
      assert.equal(result.ok, false);
      assert.equal(result.errorCode, 'INVALID_REQUEST');
      assert.deepEqual(Object.keys(result), ['ok', 'errorCode', 'message']);
    }
  });
});

test('resolves TSK-002 by routed artifact identity when the route id differs', async () => {
  await withProject(async ({ root }) => {
    const result = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(result.ok, true);
    assert.equal(result.resolution.taskId, 'TSK-002');
    assert.ok(result.resolution.authority.some((entry) => entry.id === 'TSK-002' && entry.authorityClass === 'task'));
    assert.ok(result.resolution.authority.some((entry) => entry.id === 'ADR-001'));
    assert.ok(result.resolution.authority.some((entry) => entry.id === 'OPS-001'));
  });
});

test('resolves a taskless author boundary without a synthetic task', async () => {
  await withProject(async ({ root }) => {
    const result = await resolveGovernedOperation({ requestedAction: 'author', targetProject: 'fixture-project', boundaryId: 'first-task' }, { projectRoot: root });
    assert.equal(result.ok, true);
    assert.equal(result.resolution.boundaryId, 'first-task');
    assert.equal('taskId' in result.resolution, false);
    assert.equal(result.resolution.authority.some((entry) => entry.authorityClass === 'task'), false);
    assert.equal(result.resolution.role.id, 'governance-author');
  });
});

test('implement without taskId returns INVALID_REQUEST', async () => {
  const result = await resolveGovernedOperation({ requestedAction: 'implement', targetProject: 'fixture-project', boundaryId: 'implementation' }, { projectRoot: '/tmp' });
  assert.equal(result.errorCode, 'INVALID_REQUEST');
});

test('rejects target-project mismatch', async () => {
  await withProject(async ({ root }) => {
    const result = await resolveGovernedOperation({ ...validImplement, targetProject: 'other-project' }, { projectRoot: root });
    assert.equal(result.errorCode, 'TARGET_MISMATCH');
  });
});

test('rejects implementation when task lifecycle does not authorize it', async () => {
  await withProject(async ({ root, taskPath, write }) => {
    await write(taskPath, `---\nschemaVersion: dev-foundry.sot-document.v2\nartifact:\n  id: TSK-002\n  type: TSK\n  status: COMPLETE\nauthority:\n  governedBy: [ADR-001]\nlifecycle:\n  phase: complete\n---\n`);
    const result = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(result.errorCode, 'ROLE_INELIGIBLE');
  });
});

test('rejects incompatible, deferred, or inactive roles', async () => {
  await withProject(async ({ root, write }) => {
    const incompatible = await resolveGovernedOperation({ ...validImplement, requestedRole: 'governance-auditor' }, { projectRoot: root });
    assert.equal(incompatible.errorCode, 'ROLE_INELIGIBLE');
    const popPath = '.dev-foundry/profiles/project-operating-profile.yaml';
    const pop = JSON.parse(await readFile(path.join(root, popPath), 'utf8'));
    pop.actor_bindings['implementation-executor'].status = 'deferred';
    await write(popPath, JSON.stringify(pop));
    const deferred = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(deferred.errorCode, 'ROLE_INELIGIBLE');
  });
});

test('changed authority source with prior fingerprint returns STALE_CONTEXT', async () => {
  await withProject(async ({ root, frameworkDocPath, write }) => {
    const first = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(first.ok, true);
    await write(frameworkDocPath, `---\nschemaVersion: dev-foundry.sot-document.v2\nartifact:\n  id: OPS-001\n  type: OPS\n  status: ACTIVE\nauthority:\n  governedBy: []\nlifecycle:\n  phase: active\n---\nchanged\n`);
    const stale = await resolveGovernedOperation({ ...validImplement, expectedContextFingerprint: first.resolution.contextFingerprint }, { projectRoot: root });
    assert.equal(stale.errorCode, 'STALE_CONTEXT');
  });
});

test('missing, duplicate, malformed, and contradictory routed authority fails closed', async () => {
  await withProject(async ({ root, taskPath, write }) => {
    await write(taskPath, '---\nnot: [valid\n---\n');
    assert.equal((await resolveGovernedOperation(validImplement, { projectRoot: root })).errorCode, 'AUTHORITY_INVALID');
  });
  await withProject(async ({ root, taskPath, write }) => {
    const indexPath = '.dev-foundry/authority-index.yaml';
    const index = JSON.parse(await readFile(path.join(root, indexPath), 'utf8'));
    index.routes.push({ ...index.routes[1], id: 'duplicate-task-route' });
    await write(indexPath, JSON.stringify(index));
    assert.equal((await resolveGovernedOperation(validImplement, { projectRoot: root })).errorCode, 'AUTHORITY_INVALID');
    assert.ok(taskPath);
  });
  await withProject(async ({ root, taskPath, write }) => {
    const indexPath = '.dev-foundry/authority-index.yaml';
    const index = JSON.parse(await readFile(path.join(root, indexPath), 'utf8'));
    index.routes[1].path = 'docs/tasks/missing.md';
    await write(indexPath, JSON.stringify(index));
    assert.equal((await resolveGovernedOperation(validImplement, { projectRoot: root })).errorCode, 'READ_FAILED');
    await write(taskPath, '---\nschemaVersion: dev-foundry.sot-document.v2\nartifact:\n  id: ADR-001\n  type: ADR\n  status: ACTIVE\nauthority:\n  governedBy: []\nlifecycle:\n  phase: active\n---\n');
    index.routes[1].path = taskPath;
    await write(indexPath, JSON.stringify(index));
    assert.equal((await resolveGovernedOperation(validImplement, { projectRoot: root })).errorCode, 'AUTHORITY_INVALID');
  });
});

test('success returns sorted references and SHA-256 hashes without authority bodies', async () => {
  await withProject(async ({ root }) => {
    const result = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(result.ok, true);
    assert.ok(result.resolution.authority.length >= 7);
    assert.deepEqual(result.resolution.authority.map((entry) => entry.path), [...result.resolution.authority.map((entry) => entry.path)].sort());
    for (const entry of result.resolution.authority) assert.match(entry.sha256, /^[0-9a-f]{64}$/);
    assert.ok(result.resolution.authority.some((entry) => entry.path === result.resolution.role.actorProfilePath));
    for (const capabilityPath of result.resolution.role.capabilityProfilePaths) assert.ok(result.resolution.authority.some((entry) => entry.path === capabilityPath));
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes('PRIVATE_TASK_BODY_MARKER'), false);
    assert.deepEqual(Object.keys(result.resolution.authority[0]), ['id', 'path', 'authorityClass', 'sha256', 'sectionId']);
  });
});

test('context fingerprint follows DAT-001 selector order and sorted source lines', async () => {
  await withProject(async ({ root }) => {
    const result = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(result.ok, true);
    const selector = [
      'requestedAction=implement', 'targetProject=fixture-project', 'taskId=TSK-002', 'boundaryId=',
      'requestedRole=', 'frameworkVersion=2.1.0', 'role=implementation-executor',
    ];
    const sources = result.resolution.authority.map(({ path: sourcePath, sha256 }) => `source=${sourcePath}\t${sha256}`);
    const expected = createHash('sha256').update(`${[...selector, ...sources].join('\n')}\n`, 'utf8').digest('hex');
    assert.equal(result.resolution.contextFingerprint, expected);
  });
});

test('returns the exact assessment and gate mapping for every action', async () => {
  await withProject(async ({ root }) => {
    const expected = {
      inspect: [['boundary_state'], ['authority_resolved']],
      author: [['boundary_state', 'authorization_intent', 'audit_trigger'], ['authority_resolved', 'semantic_self_assessment', 'independent_audit_if_triggered', 'operator_authorization']],
      implement: [['boundary_state', 'authorization_intent'], ['authority_resolved', 'executor_fit', 'implementation_self_verification', 'projection_reconciliation_if_needed', 'mechanical_validation']],
      validate: [['validation_coverage', 'failure_causality'], ['authority_resolved', 'mechanical_validation']],
      audit: [['audit_trigger', 'audit_disposition'], ['authority_resolved', 'independent_audit_if_triggered']],
      promote: [['boundary_state', 'authorization_intent', 'audit_disposition'], ['authority_resolved', 'mechanical_validation', 'semantic_self_assessment', 'independent_audit_if_triggered', 'operator_authorization', 'promotion_state_revalidation']],
      close: [['closure_readiness', 'audit_disposition'], ['authority_resolved', 'closure_evidence', 'operator_authorization']],
    };
    for (const [requestedAction, [requiredAssessments, requiredGates]] of Object.entries(expected)) {
      const result = await resolveGovernedOperation({ requestedAction, targetProject: 'fixture-project', taskId: 'TSK-002' }, { projectRoot: root });
      assert.equal(result.ok, true, requestedAction);
      assert.deepEqual(result.resolution.requiredAssessments, requiredAssessments, requestedAction);
      assert.deepEqual(result.resolution.requiredGates, requiredGates, requestedAction);
    }
  });
});

test('selects exact action defaults and applies the closed requested-role compatibility table', async () => {
  await withProject(async ({ root }) => {
    const defaults = {
      inspect: 'governance-author', author: 'governance-author', implement: 'implementation-executor',
      validate: 'mechanical-validator', audit: 'governance-auditor', promote: 'governance-author', close: 'evidence-custodian',
    };
    for (const [requestedAction, expectedRole] of Object.entries(defaults)) {
      const result = await resolveGovernedOperation({ requestedAction, targetProject: 'fixture-project', taskId: 'TSK-002' }, { projectRoot: root });
      assert.equal(result.ok, true, requestedAction);
      assert.equal(result.resolution.role.id, expectedRole, requestedAction);
    }
    const inspectOverride = await resolveGovernedOperation({ requestedAction: 'inspect', targetProject: 'fixture-project', boundaryId: 'review', requestedRole: 'governance-auditor' }, { projectRoot: root });
    assert.equal(inspectOverride.resolution.role.id, 'governance-auditor');
    const invalidOverride = await resolveGovernedOperation({ requestedAction: 'author', targetProject: 'fixture-project', taskId: 'TSK-002', requestedRole: 'implementation-executor' }, { projectRoot: root });
    assert.equal(invalidOverride.errorCode, 'ROLE_INELIGIBLE');
  });
});

test('rejects unsupported framework versions and contradictory framework routes', async () => {
  await withProject(async ({ root, write }) => {
    const popPath = '.dev-foundry/profiles/project-operating-profile.yaml';
    const pop = JSON.parse(await readFile(path.join(root, popPath), 'utf8'));
    pop.framework.adopted_version = '2.2.0';
    await write(popPath, JSON.stringify(pop));
    assert.equal((await resolveGovernedOperation(validImplement, { projectRoot: root })).errorCode, 'UNSUPPORTED_FRAMEWORK');
  });
  await withProject(async ({ root, write }) => {
    const indexPath = '.dev-foundry/authority-index.yaml';
    const index = JSON.parse(await readFile(path.join(root, indexPath), 'utf8'));
    index.routes[0].path = '.dev-foundry/releases/1.0.0/authority-index.yaml';
    await write(indexPath, JSON.stringify(index));
    assert.equal((await resolveGovernedOperation(validImplement, { projectRoot: root })).errorCode, 'AUTHORITY_INVALID');
  });
});

test('configured resolver root must be an absolute project path', async () => {
  await withProject(async ({ root }) => {
    const result = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(result.ok, true);
  });
  assert.equal((await resolveGovernedOperation(validImplement, { projectRoot: '.' })).errorCode, 'READ_FAILED');
});
