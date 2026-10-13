import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { resolveGovernedOperation } from '../../src/governance-mcp/resolver.js';
import { makeBrownfieldProject, makeProject } from './fixture.js';

const validImplement = { requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-002' };

async function withProject(run, factory = makeProject) {
  const project = await factory();
  try { await run(project); } finally { await project.cleanup(); }
}

test('accepts a valid request and strictly rejects unknown, invalid, and cross-field inputs', async () => {
  await withProject(async ({ root }) => {
    const valid = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(valid.ok, true);
    assert.deepEqual(Object.keys(valid), ['ok', 'message', 'resolution']);
    const invalidCases = [
      [{ ...validImplement, unknown: true }, /unknown argument: unknown/],
      [{ requestedAction: 'write', targetProject: 'fixture-project', taskId: 'TSK-002' }, /requestedAction must be one of/],
      [{ requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'not valid' }, /taskId must be a 1-128 character identifier/],
      [{ requestedAction: 'author', targetProject: 'fixture-project' }, /taskId or boundaryId is required/],
      [{ requestedAction: 'implement', targetProject: 'fixture-project', boundaryId: 'pre-task' }, /taskId is required when requestedAction is implement/],
      [{ requestedAction: 'author', targetProject: '', boundaryId: 'pre-task' }, /targetProject must be a non-empty string/],
      [{ requestedAction: 'author', targetProject: 'fixture-project', boundaryId: 'pre-task', expectedContextFingerprint: 'not-a-digest' }, /expectedContextFingerprint must be a 64-character lowercase SHA-256 hex string/],
    ];
    for (const [request, diagnostic] of invalidCases) {
      const result = await resolveGovernedOperation(request, { projectRoot: root });
      assert.equal(result.ok, false);
      assert.equal(result.errorCode, 'INVALID_REQUEST');
      assert.deepEqual(Object.keys(result), ['ok', 'errorCode', 'message']);
      assert.match(result.message, diagnostic);
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
  assert.match(result.message, /taskId is required when requestedAction is implement/);
  assert.deepEqual(Object.keys(result), ['ok', 'errorCode', 'message']);
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
    assert.match(incompatible.message, /requestedRole.*role ID.*expected implementation-executor.*retry once/i);
    const popPath = '.dev-foundry/profiles/project-operating-profile.yaml';
    const pop = JSON.parse(await readFile(path.join(root, popPath), 'utf8'));
    pop.actor_bindings['implementation-executor'].status = 'deferred';
    await write(popPath, JSON.stringify(pop));
    const deferred = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(deferred.errorCode, 'ROLE_INELIGIBLE');
    assert.match(deferred.message, /project-operating-profile\.yaml: actor_bindings\.implementation-executor is deferred.*Governance Author reconciliation/i);
  });
});

test('diagnoses role ID versus profile path, Actor Profile contradictions, and missing Capability Profile paths safely', async () => {
  await withProject(async ({ root, write }) => {
    const confused = await resolveGovernedOperation({ ...validImplement, requestedRole: '.dev-foundry/profiles/implementation-executor.yaml' }, { projectRoot: root });
    assert.equal(confused.errorCode, 'ROLE_INELIGIBLE');
    assert.match(confused.message, /requestedRole must be a project role ID.*path-like value.*Actor Profile paths and Capability Profile IDs\/paths are separate.*retry once/i);
    assert.deepEqual(Object.keys(confused), ['ok', 'errorCode', 'message']);

    const popPath = '.dev-foundry/profiles/project-operating-profile.yaml';
    const pop = JSON.parse(await readFile(path.join(root, popPath), 'utf8'));
    const actorPath = pop.actor_bindings['implementation-executor'].profile;
    await write(actorPath, 'schema_version: dev-foundry.actor-profile.v2\nid: executor-profile\nstatus: deferred\nrole: governance-author\nprivate: DO_NOT_ECHO\n');
    const actor = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(actor.errorCode, 'AUTHORITY_INVALID');
    assert.match(actor.message, /Actor Profile .*actor-profiles\/implementation-executor\.yaml.*role expected implementation-executor, actual governance-author; status expected active, actual deferred.*Reconcile .*actor_bindings\.implementation-executor\.profile/i);
    assert.equal(actor.message.includes('DO_NOT_ECHO'), false);

    pop.actor_bindings['implementation-executor'].profile = '.dev-foundry/releases/2.1.0/actor-profiles/missing-executor.yaml';
    await write(popPath, JSON.stringify(pop));
    const missingActor = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(missingActor.errorCode, 'READ_FAILED');
    assert.match(missingActor.message, /missing-executor\.yaml.*Governance Author reconciliation/i);

    pop.actor_bindings['implementation-executor'].profile = actorPath;
    pop.actor_bindings['implementation-executor'].capability_profiles = ['.dev-foundry/profiles/capability-profiles/missing-capability.yaml'];
    await write(popPath, JSON.stringify(pop));
    await write(actorPath, 'schema_version: dev-foundry.actor-profile.v2\nid: executor-profile\nstatus: active\nrole: implementation-executor\n');
    const missingCapability = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(missingCapability.errorCode, 'READ_FAILED');
    assert.match(missingCapability.message, /missing-capability\.yaml.*POP\/index-bound path exists and is readable/i);

    pop.actor_bindings['implementation-executor'].capability_profiles = ['.dev-foundry/profiles/capability-profiles/executor.yaml'];
    await write(popPath, JSON.stringify(pop));
    await write('.dev-foundry/profiles/capability-profiles/executor.yaml', 'schema_version: dev-foundry.capability-profile.v1\nid: EXECUTOR-CAPABILITY\nstatus: deferred\n');
    const deferredCapability = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(deferredCapability.errorCode, 'AUTHORITY_INVALID');
    assert.match(deferredCapability.message, /Capability Profile .*executor\.yaml has status deferred; expected active.*actor_bindings\.implementation-executor\.capability_profiles/i);
  });
});

test('diagnoses missing and duplicate routed task and authority identities with configured index paths', async () => {
  await withProject(async ({ root, write }) => {
    const missing = await resolveGovernedOperation({ ...validImplement, taskId: 'TSK-TYPO' }, { projectRoot: root });
    assert.equal(missing.errorCode, 'AUTHORITY_INVALID');
    assert.match(missing.message, /taskId.*no active task route.*authority-index\.yaml.*correct the caller argument.*retry once/i);

    const indexPath = '.dev-foundry/authority-index.yaml';
    const index = JSON.parse(await readFile(path.join(root, indexPath), 'utf8'));
    index.routes.push({ ...index.routes.find(route => route.authority_class === 'task'), id: 'second-task-route' });
    await write(indexPath, JSON.stringify(index));
    const duplicate = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(duplicate.errorCode, 'AUTHORITY_INVALID');
    assert.match(duplicate.message, /taskId.*2 active routes.*authority-index\.yaml.*Governance Author/i);
  });
});

test('changed authority source with prior fingerprint returns STALE_CONTEXT', async () => {
  await withProject(async ({ root, frameworkDocPath, write }) => {
    const first = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(first.ok, true);
    await write(frameworkDocPath, `---\nschemaVersion: dev-foundry.sot-document.v2\nartifact:\n  id: OPS-001\n  type: OPS\n  status: ACTIVE\nauthority:\n  governedBy: []\nlifecycle:\n  phase: active\n---\nchanged\n`);
    const stale = await resolveGovernedOperation({ ...validImplement, expectedContextFingerprint: first.resolution.contextFingerprint }, { projectRoot: root });
    assert.equal(stale.errorCode, 'STALE_CONTEXT');
    assert.match(stale.message, /expectedContextFingerprint is stale.*Resolve this operation once without the old fingerprint.*newly returned contextFingerprint/i);
  });
});

test('missing, duplicate, malformed, and contradictory routed authority fails closed', async () => {
  await withProject(async ({ root, taskPath, write }) => {
    await write(taskPath, '---\nnot: [valid\n---\n');
    const malformed = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(malformed.errorCode, 'AUTHORITY_INVALID');
    assert.match(malformed.message, /YAML document is malformed/);
  });
  await withProject(async ({ root, taskPath, write }) => {
    await write(taskPath, `---\nschemaVersion: dev-foundry.sot-document.v2\nartifact:\n  id: TSK-002\n  type: TSK\n  status: IN_PROGRESS\nauthority:\n  governedBy: invalid\nlifecycle:\n  phase: in-progress\n---\nPRIVATE_AUTHORITY_BODY\n`);
    const malformedField = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assertAuthorityFailure(malformedField);
    assert.match(malformedField.message, /authority\.governedBy/);
    assert.equal(malformedField.message.includes('PRIVATE_AUTHORITY_BODY'), false);
    assert.deepEqual(Object.keys(malformedField), ['ok', 'errorCode', 'message']);
    assert.ok(taskPath);
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
    const missing = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(missing.errorCode, 'READ_FAILED');
    assert.match(missing.message, /docs\/tasks\/missing\.md/);
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
    const contradictory = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(contradictory.errorCode, 'AUTHORITY_INVALID');
    assert.match(contradictory.message, /project framework route contradicts the POP-selected release/);
  });
});

test('configured resolver root must be an absolute project path', async () => {
  await withProject(async ({ root }) => {
    const result = await resolveGovernedOperation(validImplement, { projectRoot: root });
    assert.equal(result.ok, true);
  });
  assert.equal((await resolveGovernedOperation(validImplement, { projectRoot: '.' })).errorCode, 'READ_FAILED');
});

async function updateIndex(project, mutate) {
  const indexPath = '.dev-foundry/authority-index.yaml';
  const index = JSON.parse(await readFile(path.join(project.root, indexPath), 'utf8'));
  mutate(index);
  await project.write(indexPath, JSON.stringify(index));
}

async function replaceTaskGovernance(project, ids) {
  const task = await readFile(path.join(project.root, project.taskPath), 'utf8');
  await project.write(project.taskPath, task.replace('governedBy: [ADR-001]', `governedBy: [${ids.join(', ')}]`));
}

function assertAuthorityFailure(result, code = 'AUTHORITY_INVALID') {
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, code);
  assert.deepEqual(Object.keys(result), ['ok', 'errorCode', 'message']);
}

test('brownfield inspect, implement and taskless author exclude historical and unused v1 authority', async () => {
  await withProject(async (project) => {
    const excluded = [project.historicalPath, project.legacyPath, project.unusedTaskPath];
    for (const request of [
      { ...validImplement, requestedAction: 'inspect', requestedRole: 'governance-author' },
      validImplement,
      { requestedAction: 'author', targetProject: 'fixture-project', boundaryId: 'first-task' },
    ]) {
      const result = await resolveGovernedOperation(request, { projectRoot: project.root });
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.resolution.role.id, request.requestedAction === 'implement' ? 'implementation-executor' : 'governance-author');
      assert.equal(result.resolution.authority.some(entry => excluded.includes(entry.path) || entry.authorityClass === 'historical'), false);
      const expectedIds = ['PROJECT-POP', 'PROJECT-AUTHORITY-INDEX', 'FRAMEWORK-AUTHORITY-INDEX',
        ...(request.taskId ? ['TSK-002', 'ADR-001', 'OPS-001'] : ['OVR-001']),
        ...(request.requestedAction === 'implement' ? ['implementation-executor-profile', 'EXECUTOR-CAPABILITY'] : ['governance-author-profile'])];
      assert.deepEqual(result.resolution.authority.map(entry => entry.id).sort(), expectedIds.sort());
      const stale = await resolveGovernedOperation({ ...request, expectedContextFingerprint: '0'.repeat(64) }, { projectRoot: project.root });
      assertAuthorityFailure(stale, 'STALE_CONTEXT');
    }
    const incompatible = await resolveGovernedOperation({ ...validImplement, requestedRole: 'governance-author' }, { projectRoot: project.root });
    assertAuthorityFailure(incompatible, 'ROLE_INELIGIBLE');
  }, makeBrownfieldProject);
});

test('historical task routes cannot authorize implement even with an eligible task lifecycle', async () => {
  await withProject(async project => {
    const historical = await readFile(path.join(project.root, project.historicalPath), 'utf8');
    await project.write(project.historicalPath, historical.replace('status: CLOSED', 'status: IN_PROGRESS').replace('phase: closed', 'phase: in-progress'));
    assertAuthorityFailure(await resolveGovernedOperation({ ...validImplement, taskId: 'TSK-001' }, { projectRoot: project.root }));
  }, makeBrownfieldProject);
});

test('historical decision and taskless overview routes cannot supply active authority', async () => {
  for (const [routeId, request] of [
    ['decision-route', validImplement],
    ['project-overview-route', { requestedAction: 'author', targetProject: 'fixture-project', boundaryId: 'first-task' }],
  ]) {
    await withProject(async project => {
      await updateIndex(project, index => { index.routes.find(route => route.id === routeId).authority_class = 'historical'; });
      assertAuthorityFailure(await resolveGovernedOperation(request, { projectRoot: project.root }));
    });
  }
});

test('closed governing task fails both through historical routing and an active-class route', async () => {
  await withProject(async project => {
    await replaceTaskGovernance(project, ['ADR-001', 'TSK-001']);
    assertAuthorityFailure(await resolveGovernedOperation(validImplement, { projectRoot: project.root }));
    await updateIndex(project, index => {
      const route = index.routes.find(route => route.path === project.historicalPath);
      route.authority_class = 'task';
      route.governs = ['previous-task'];
    });
    const closed = await resolveGovernedOperation(validImplement, { projectRoot: project.root });
    assertAuthorityFailure(closed);
    assert.equal(closed.message, 'Required authority is not active.');
  }, makeBrownfieldProject);
});

test('v1 governing authority and a directly requested v1 task fail closed without v2 reinterpretation', async () => {
  await withProject(async project => {
    await replaceTaskGovernance(project, ['SPC-LEGACY']);
    assertAuthorityFailure(await resolveGovernedOperation(validImplement, { projectRoot: project.root }));
    assertAuthorityFailure(await resolveGovernedOperation({ ...validImplement, taskId: 'TSK-UNUSED', requestedAction: 'inspect' }, { projectRoot: project.root }));
  }, makeBrownfieldProject);
});

test('unrelated stale or structurally malformed active metadata never grants authority', async () => {
  await withProject(async project => {
    // Discoverable identity, but neither supported authority schema nor lifecycle.
    await project.write(project.legacyPath, '---\nschemaVersion: dev-foundry.sot-document.v2\nartifact:\n  id: SPC-LEGACY\n  type: SPC\n  status: RETIRED\nauthority: invalid\n---\n');
    const unrelated = await resolveGovernedOperation(validImplement, { projectRoot: project.root });
    assert.equal(unrelated.ok, true);
    assert.equal(unrelated.resolution.authority.some(entry => entry.id === 'SPC-LEGACY'), false);
    await replaceTaskGovernance(project, ['SPC-LEGACY']);
    assertAuthorityFailure(await resolveGovernedOperation(validImplement, { projectRoot: project.root }));
  }, makeBrownfieldProject);
});

test('unparseable active route metadata remains a failure rather than an authority fallback', async () => {
  await withProject(async project => {
    await project.write(project.legacyPath, '---\nartifact: [invalid\n---\n');
    assertAuthorityFailure(await resolveGovernedOperation(validImplement, { projectRoot: project.root }));
  }, makeBrownfieldProject);
});

test('unknown classes and duplicate or malformed route metadata remain AUTHORITY_INVALID', async () => {
  for (const mutate of [
    index => { index.routes.at(-1).authority_class = 'unknown'; },
    index => { index.routes.push({ ...index.routes.at(-1) }); },
    index => { index.routes.at(-1).governs = ['duplicate', 'duplicate']; },
    index => { index.routes.at(-1).governs = []; },
    index => { index.routes.at(-1).path = ''; },
    index => { index.routes.at(-1).section_id = 7; },
    index => { index.routes.at(-1).governs = ['']; },
  ]) {
    await withProject(async project => {
      await updateIndex(project, mutate);
      assertAuthorityFailure(await resolveGovernedOperation(validImplement, { projectRoot: project.root }));
    }, makeBrownfieldProject);
  }
});

test('historical framework route cannot replace the POP-selected active framework', async () => {
  await withProject(async project => {
    await updateIndex(project, index => { index.routes[0].authority_class = 'historical'; });
    assertAuthorityFailure(await resolveGovernedOperation(validImplement, { projectRoot: project.root }));
  }, makeBrownfieldProject);
});

test('missing or duplicate active governing identities are refused in brownfield indexes', async () => {
  await withProject(async project => {
    await replaceTaskGovernance(project, ['SPC-MISSING']);
    assertAuthorityFailure(await resolveGovernedOperation(validImplement, { projectRoot: project.root }));
  }, makeBrownfieldProject);
  await withProject(async project => {
    const duplicatePath = 'docs/decisions/duplicate.md';
    await project.write(duplicatePath, await readFile(path.join(project.root, project.decisionPath), 'utf8'));
    await updateIndex(project, index => {
      index.routes.push({ id: 'different-route-and-filename', path: duplicatePath, authority_class: 'decision', governs: ['duplicate-decision'], section_id: null });
    });
    const result = await resolveGovernedOperation(validImplement, { projectRoot: project.root });
    assertAuthorityFailure(result);
    assert.match(result.message, /Authority artifact ADR-001 is routed 2 times.*Governance Author/);
  }, makeBrownfieldProject);
});

test('duplicate task identity remains invalid with independent route IDs and filenames', async () => {
  await withProject(async project => {
    const duplicatePath = 'docs/tasks/different.md';
    await project.write(duplicatePath, await readFile(path.join(project.root, project.taskPath), 'utf8'));
    await updateIndex(project, index => {
      index.routes.push({ id: 'different-task-route', path: duplicatePath, authority_class: 'task', governs: ['duplicate-task'], section_id: null });
    });
    const result = await resolveGovernedOperation(validImplement, { projectRoot: project.root });
    assertAuthorityFailure(result);
    assert.match(result.message, /taskId resolves through 2 active routes.*Governance Author/);
  }, makeBrownfieldProject);
});

test('existing valid fixture fingerprints remain exactly at the pre-hotfix baseline', async () => {
  await withProject(async ({ root }) => {
    const fingerprints = {
      inspect: '2afa455824c29812ca81c9a8eac3f6f5f8d35c151d19ab3ce3e97560940bea48',
      author: '4332f5946850ac63335a2def9b1164dda9c582188eb686034f497eb3dbadd9ac',
      implement: '2d588dde3ca994b3b9f7cb9262270474fe9af43e71e65ad6f5fbfb72b7618eb7',
      validate: 'a1122ef11d3815754626ea460b5674391675756ea614b8c958ecad08080f65c5',
      audit: '45c1ca68cf6fec21c79a2f7503b27d8fbaa1bfc8b255afb717481651fcd2e880',
      promote: '1c3f08efbe1d80424e05ae9a0ea4aec0d6013bf96a315a06405483745c543f48',
      close: 'efa0ed2a31ffe668732817cd411072afbf51a0c9de2fb8c5a1902a360ed79605',
    };
    for (const [requestedAction, expected] of Object.entries(fingerprints)) {
      const result = await resolveGovernedOperation({ ...validImplement, requestedAction }, { projectRoot: root });
      assert.equal(result.ok, true);
      assert.equal(result.resolution.contextFingerprint, expected, requestedAction);
    }
    const taskless = await resolveGovernedOperation({ requestedAction: 'author', targetProject: 'fixture-project', boundaryId: 'first-task' }, { projectRoot: root });
    assert.equal(taskless.ok, true);
    assert.equal(taskless.resolution.contextFingerprint, '93b8433288936139bb482274bbb3659066b6d4558f8a9a6c5eabdeb860fc6505');
  });
});

test('historical v1 bytes and unused v1 body changes do not enter the context fingerprint', async () => {
  await withProject(async project => {
    const first = await resolveGovernedOperation(validImplement, { projectRoot: project.root });
    assert.equal(first.ok, true);
    const historical = await readFile(path.join(project.root, project.historicalPath), 'utf8');
    await project.write(project.historicalPath, historical.replace('dev-foundry.sot-document.v2', 'dev-foundry.sot-document.v1'));
    const legacy = await readFile(path.join(project.root, project.legacyPath), 'utf8');
    await project.write(project.legacyPath, `${legacy}\nUnrelated body update.\n`);
    const unchanged = await resolveGovernedOperation({ ...validImplement, expectedContextFingerprint: first.resolution.contextFingerprint }, { projectRoot: project.root });
    assert.deepEqual(unchanged, first);
  }, makeBrownfieldProject);
});
