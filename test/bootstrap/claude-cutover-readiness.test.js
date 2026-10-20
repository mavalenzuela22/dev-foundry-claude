import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const runnerV1Path = '.dev-foundry/profiles/capability-profiles/implementation-executor-runner-v1.yaml';
const runnerPath = '.dev-foundry/profiles/capability-profiles/implementation-executor-runner-v2.yaml';
const runnerV3Path = '.dev-foundry/profiles/capability-profiles/implementation-executor-runner-v3.yaml';
const authorPath = '.dev-foundry/profiles/capability-profiles/governance-author-producer-maintenance-v1.yaml';
const historicalClaudePath = '.dev-foundry/profiles/capability-profiles/implementation-executor-claude-code-v1.yaml';
const claudePath = '.dev-foundry/profiles/capability-profiles/implementation-executor-claude-code-v2.yaml';
const auditorPath = '.dev-foundry/profiles/capability-profiles/governance-auditor-claude-code-v1.yaml';
const contractPath = 'docs/40-specifications/40 [SPC-002] PROJECT - Claude-Native Cutover Binding Contract.md';
const producerActors = [
  ['governance-author', 'governance-author-v4'],
  ['governance-auditor', 'governance-auditor-v2'],
  ['evidence-custodian', 'evidence-custodian-v1'],
  ['implementation-executor', 'implementation-executor-v2'],
  ['mechanical-validator', 'mechanical-validator-v2'],
];
const producerCapabilities = [
  [authorPath, 'governance-author-capability-producer-maintenance-v1'],
  [runnerV3Path, 'implementation-executor-capability-producer-maintenance'],
];

async function readProjectFile(path) {
  const absolute = resolve(root, path);
  const withinRoot = relative(root, absolute);
  assert.ok(withinRoot && withinRoot !== '..' && !withinRoot.startsWith(`..${sep}`),
    `Readiness evidence must stay inside the project: ${path}`);
  return readFile(absolute, 'utf8');
}

async function readYaml(path) {
  return parse(await readProjectFile(path));
}

function frontmatter(document) {
  const match = document.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  assert.ok(match, 'Authority document must have YAML frontmatter');
  return parse(match[1]);
}

function section(document, heading) {
  const sections = document.split(/^## /m);
  const matches = sections.filter((part) => part.startsWith(`${heading}\n`) || part.startsWith(`${heading}\r\n`));
  assert.equal(matches.length, 1, `Expected exactly one contract section: ${heading}`);
  return matches[0];
}

async function assertAbsent(path) {
  await assert.rejects(lstat(resolve(root, path)), { code: 'ENOENT' },
    `${path} must remain absent in the Claude-native topology`);
}

function assertProducerRoleSelection(pop) {
  assert.equal(pop.schema_version, 'dev-foundry.project-operating-profile.v3');
  assert.equal(pop.framework.adopted_version, '2.3.0');
  assert.equal(pop.framework.adoption_status, 'active');
  assert.equal(pop.framework.selected_authority_index, '.dev-foundry/releases/2.3.0/authority-index.yaml');
  assert.equal(pop.framework.selected_manifest, '.dev-foundry/releases/2.3.0/release-integrity-manifest.yaml');
  assert.deepEqual(Object.keys(pop.actor_bindings).sort(), producerActors.map(([role]) => role).sort());
  for (const [role, profile] of producerActors) {
    const binding = pop.actor_bindings[role];
    assert.equal(binding.status, 'active', role);
    assert.equal(binding.profile, `.dev-foundry/releases/2.3.0/actor-profiles/${profile}.yaml`, role);
    assert.deepEqual(binding.selection, {
      mode: 'operation-scoped',
      required_capabilities: [],
      eligibility_policy: 'operator-and-actor-fit',
    }, `Producer role requires operation-scoped selection, not a Claude consumer capability binding: ${role}`);
    assert.ok(!Object.hasOwn(binding, 'implementation'), `Concrete implementation is selected per operation: ${role}`);
    assert.ok(!Object.hasOwn(binding, 'capability_profiles'), `Capability fit is proven per operation: ${role}`);
  }
}

function assertProducerCapabilityIndex(pop, index) {
  assertProducerRoleSelection(pop);
  assert.equal(index.status, 'active');
  assert.equal(index.rules.runtime_capability_grants_authority, false);
  // Configured capability routes are fit candidates, not POP role assignments.
  const active = new Set(producerCapabilities.map(([path]) => path));
  for (const [path, id] of producerCapabilities) {
    const bindings = index.bindings.filter((binding) => binding.path === path);
    assert.equal(bindings.length, 1, `Expected exactly one active capability binding: ${path}`);
    assert.equal(bindings[0].id, id, `Active capability route must retain its configured identity: ${path}`);
    assert.equal(index.bindings.filter((binding) => binding.id === id).length, 1, `Capability route ID must be unique: ${id}`);
    assert.equal(bindings[0].kind, 'capability-profile', path);
    assert.equal(bindings[0].authority_class, 'configured', path);
    assert.equal(bindings[0].required, true, `Active producer capability must be required: ${path}`);
  }
  for (const binding of index.bindings.filter((entry) => entry.kind === 'capability-profile')) {
    assert.equal(binding.authority_class, 'configured', binding.path);
    assert.equal(index.bindings.filter((entry) => entry.path === binding.path).length, 1,
      `Capability route must be unique: ${binding.path}`);
    assert.equal(binding.required, active.has(binding.path),
      `Only active producer capability routes may be required: ${binding.path}`);
  }
  for (const path of [runnerV1Path, runnerPath, historicalClaudePath, claudePath, auditorPath]) {
    const bindings = index.bindings.filter((binding) => binding.path === path);
    assert.equal(bindings.length, 1, `Expected exactly one historical/consumer capability binding: ${path}`);
    assert.equal(bindings[0].kind, 'capability-profile', path);
    assert.equal(bindings[0].authority_class, 'configured', path);
    assert.equal(bindings[0].required, false, path);
    assert.ok(!active.has(path), `Historical/consumer capability must remain unbound: ${path}`);
  }
}

test('cutover prerequisites TSK-002, TSK-003, and TSK-004 are COMPLETE', async () => {
  const index = await readYaml('.dev-foundry/authority-index.yaml');
  for (const id of ['TSK-002', 'TSK-003', 'TSK-004']) {
    const routes = index.routes.filter((route) => route.id === id);
    assert.equal(routes.length, 1, `${id} must have exactly one authority route`);
    assert.equal(routes[0].authority_class, 'task');
    assert.ok(routes[0].path.startsWith(`docs/70-tasks/70 [${id}] `));
    const task = frontmatter(await readProjectFile(routes[0].path));
    assert.equal(task.artifact.id, id);
    assert.equal(task.artifact.type, 'TSK');
    assert.equal(task.artifact.status, 'COMPLETE', `${id} must be COMPLETE`);
    assert.equal(task.lifecycle.phase, 'complete', `${id} lifecycle must agree`);
  }
});

test('root CLAUDE.md references the governed operation resolver', async () => {
  assert.match(await readProjectFile('CLAUDE.md'), /\bresolve_governed_operation\b/);
});

test('project MCP has exactly one stdio Node server with the current project-directory fallback', async () => {
  const config = JSON.parse(await readProjectFile('.mcp.json'));
  assert.deepEqual(Object.keys(config.mcpServers), ['dev-foundry-governance']);
  const server = config.mcpServers['dev-foundry-governance'];
  assert.equal(server.type, 'stdio');
  assert.equal(server.command, 'node');
  assert.deepEqual(server.args, ['${CLAUDE_PROJECT_DIR:-.}/src/governance-mcp/server.js']);
});

test('historical prepared Claude executor V1 retains its pre-cutover safeguards', async () => {
  const profile = await readYaml(historicalClaudePath);
  assert.equal(profile.id, 'DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V1');
  assert.equal(profile.status, 'active');
  assert.equal(profile.implementation_class, 'claude-code-native-agent');
  assert.equal(profile.limits.platform, 'claude-code');
  assert.equal(profile.limits.governance_resolution, 'project_mcp_resolve_governed_operation');
  for (const constraint of [
    'project_governance_mcp_must_be_connected',
    'active_pop_must_bind_implementation_executor_to_this_profile',
  ]) assert.ok(profile.environment_constraints.includes(constraint), constraint);
  for (const condition of [
    'profile_is_not_the_active_pop_binding_for_implementation_executor',
    'governance_mcp_is_unavailable_or_returns_failure',
  ]) assert.ok(profile.stop_conditions.includes(condition), condition);
  assert.ok(profile.prohibited_actions.includes('use_this_profile_before_project_cutover_binding_is_active'));
});

for (const [path, id, role, identity] of [
  [claudePath, 'DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V2', 'implementation_executor', 'dev-foundry-executor'],
  [auditorPath, 'DFC-GOVERNANCE-AUDITOR-CLAUDE-CODE-V1', 'governance_auditor', 'dev-foundry-auditor'],
]) {
  test(`active Claude target ${id} requires governance MCP and an active POP binding`, async () => {
    const profile = await readYaml(path);
    assert.equal(profile.id, id);
    assert.equal(profile.status, 'active');
    assert.equal(profile.implementation_class, 'claude-code-project-subagent');
    assert.equal(profile.limits.platform, 'claude-code');
    assert.equal(profile.limits.implementation_identity, identity);
    assert.equal(profile.limits.governance_mcp_server, 'dev-foundry-governance');
    assert.equal(profile.limits.governance_resolution, 'resolve_governed_operation');
    for (const constraint of [
      'project_governance_mcp_must_be_connected',
      `active_pop_must_bind_${role}_to_this_profile`,
    ]) assert.ok(profile.environment_constraints.includes(constraint), constraint);
    for (const condition of [
      `profile_is_not_the_active_pop_binding_for_${role}`,
      'governance_mcp_is_unavailable_or_returns_failure',
    ]) assert.ok(profile.stop_conditions.includes(condition), condition);
    assert.ok(profile.prohibited_actions.includes('use_this_profile_before_project_cutover_binding_is_active'));
  });
}

test('active POP has exactly the ChatGPT-project producer-maintenance role bindings', async () => {
  const pop = await readYaml('.dev-foundry/profiles/project-operating-profile.yaml');
  assert.equal(pop.status, 'active');
  assert.equal(pop.repository.name, 'dev-foundry-claude');
  assert.equal(pop.policies.default_role, 'governance-author');
  assert.deepEqual(pop.platform_bootstraps['primary-governance-agent'], {
    path: '.dev-foundry/platform-bootstrap.yaml',
    status: 'active',
  });
  assertProducerCapabilityIndex(pop, await readYaml('.dev-foundry/authority-index.yaml'));
  for (const [path, id, identity] of [
    [authorPath, 'DFC-GOVERNANCE-AUTHOR-PRODUCER-MAINTENANCE-V1', 'operator-assisted-dev-foundry-copilot'],
    [runnerV3Path, 'DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3', 'process-bound-runner-code-executor'],
  ]) {
    const capability = await readYaml(path);
    assert.equal(capability.id, id, path);
    assert.equal(capability.status, 'active', path);
    assert.equal(capability.implementation_class, identity, path);
    assert.equal(capability.limits.repository, 'dev-foundry-claude', path);
    if (path === runnerV3Path) {
      assert.equal(capability.limits.hosting_purpose, 'chatgpt-governed-producer-maintenance', path);
      assert.equal(capability.limits.execution_provider, 'codex-cli', path);
      assert.ok(capability.prohibited_actions.includes('invoke_claude_code_as_executor_for_producer_maintenance'), path);
    } else {
      assert.equal(capability.limits.platform, 'chatgpt-project', path);
      assert.equal(capability.limits.task_binding, 'operation_scoped_explicit_authority', path);
      assert.equal(capability.limits.implementation, 'prohibited', path);
    }
  }
});

test('Authority Index requires exactly the active producer capabilities and retains historical/consumer profiles as non-required', async () => {
  const pop = await readYaml('.dev-foundry/profiles/project-operating-profile.yaml');
  const index = await readYaml('.dev-foundry/authority-index.yaml');
  assertProducerCapabilityIndex(pop, index);
});

test('producer capability checks reject missing, duplicate, non-required, and unbound required profiles', async () => {
  const pop = await readYaml('.dev-foundry/profiles/project-operating-profile.yaml');
  const index = await readYaml('.dev-foundry/authority-index.yaml');
  assertProducerCapabilityIndex(pop, index);
  for (const binding of index.bindings.filter((entry) => entry.kind === 'capability-profile')) {
    if (binding.required) {
      const missing = structuredClone(index);
      missing.bindings = missing.bindings.filter((entry) => entry.path !== binding.path);
      assert.throws(() => assertProducerCapabilityIndex(pop, missing),
        /Expected exactly one active capability binding/, `Missing: ${binding.path}`);
      const duplicate = structuredClone(index);
      duplicate.bindings.push(structuredClone(binding));
      assert.throws(() => assertProducerCapabilityIndex(pop, duplicate),
        /Expected exactly one active capability binding/, `Duplicate: ${binding.path}`);
      const nonRequired = structuredClone(index);
      nonRequired.bindings.find((entry) => entry.path === binding.path).required = false;
      assert.throws(() => assertProducerCapabilityIndex(pop, nonRequired),
        /Active producer capability must be required/, `Non-required: ${binding.path}`);
    } else {
      const unboundRequired = structuredClone(index);
      unboundRequired.bindings.find((entry) => entry.path === binding.path).required = true;
      assert.throws(() => assertProducerCapabilityIndex(pop, unboundRequired),
        /Only active producer capability routes may be required/, `Unbound required: ${binding.path}`);
    }
  }
  for (const path of [historicalClaudePath, claudePath, auditorPath]) {
    const claudeBound = structuredClone(pop);
    claudeBound.actor_bindings['implementation-executor'].selection.required_capabilities = [path];
    assert.throws(() => assertProducerCapabilityIndex(claudeBound, index),
      /Producer role requires operation-scoped selection, not a Claude consumer capability binding/, path);
  }
  for (const [path] of producerCapabilities) {
    for (const [key, value] of [['authority_class', 'methodology'], ['kind', 'actor-profile'], ['id', 'wrong-capability-route']]) {
      const misrouted = structuredClone(index);
      misrouted.bindings.find((entry) => entry.path === path)[key] = value;
      assert.throws(() => assertProducerCapabilityIndex(pop, misrouted), { code: 'ERR_ASSERTION' }, `${key}: ${path}`);
    }
  }
});

test('runner V2 remains unmodified pre-cutover history', async () => {
  const text = await readProjectFile(runnerPath);
  assert.match(text, /^status: active$/m);
  const runner = parse(text);
  assert.equal(runner.id, 'DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V2');
  assert.equal(runner.status, 'active');
  assert.equal(runner.limits.hosting_phase, 'chatgpt-governed-pre-cutover');
});

test('runner V3 requires matching operation-scoped executor capability proof for POP v3 and preserves v2 compatibility', async () => {
  const profile = await readYaml(runnerV3Path);
  assert.equal(profile.id, 'DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3');
  assert.equal(profile.implementation_class, 'process-bound-runner-code-executor');
  assert.equal(profile.limits.hosting_purpose, 'chatgpt-governed-producer-maintenance');
  assert.equal(profile.limits.execution_provider, 'codex-cli');
  assert.ok(!Object.hasOwn(profile.limits, 'hosting_phase'));
  assert.ok(profile.environment_constraints.includes('v2_pop_must_bind_implementation_executor_to_this_profile_or_v3_operation_selection_must_prove_matching_executor_capability'));
  assert.ok(profile.stop_conditions.includes('v2_pop_binding_mismatch_or_v3_operation_selection_lacks_matching_executor_capability_proof'));
  for (const action of [
    'invoke_claude_code_as_executor_for_producer_maintenance',
    'mutate_any_consumer_repository',
  ]) assert.ok(profile.prohibited_actions.includes(action), action);
});

test('ADR-004 is routed and ACCEPTED, SPC-005 is routed and ACTIVE', async () => {
  const index = await readYaml('.dev-foundry/authority-index.yaml');
  for (const [prefix, id, status] of [
    ['docs/10-decisions/10 [ADR-004] ', 'ADR-004', 'ACCEPTED'],
    ['docs/40-specifications/40 [SPC-005] ', 'SPC-005', 'ACTIVE'],
  ]) {
    const routes = index.routes.filter((route) => route.path.startsWith(prefix));
    assert.equal(routes.length, 1, `${id} must have exactly one authority route`);
    const metadata = frontmatter(await readProjectFile(routes[0].path));
    assert.equal(metadata.artifact.id, id);
    assert.equal(metadata.artifact.status, status, id);
  }
});

test('active ChatGPT-project Platform Bootstrap permits Author, Auditor, and Custodian and requires separate runner selection', async () => {
  const bootstrap = await readYaml('.dev-foundry/platform-bootstrap.yaml');
  assert.equal(bootstrap.schema_version, 'dev-foundry.platform-bootstrap.v3');
  assert.equal(bootstrap.status, 'active');
  assert.equal(bootstrap.methodology_authority, false);
  assert.equal(bootstrap.repository.expected_name, 'dev-foundry-claude');
  assert.equal(bootstrap.repository.workspace_binding, 'process-bound-repository');
  assert.equal(bootstrap.platform.id, 'chatgpt-project');
  assert.equal(bootstrap.sources.project_operating_profile, '.dev-foundry/profiles/project-operating-profile.yaml');
  assert.equal(bootstrap.sources.authority_index, '.dev-foundry/authority-index.yaml');
  assert.equal(bootstrap.actor_resolution.mode, 'governed-project-bindings');
  assert.deepEqual(bootstrap.actor_resolution.eligible_profiles, [
    '.dev-foundry/releases/2.3.0/actor-profiles/governance-author-v4.yaml',
    '.dev-foundry/releases/2.3.0/actor-profiles/governance-auditor-v2.yaml',
    '.dev-foundry/releases/2.3.0/actor-profiles/evidence-custodian-v1.yaml',
  ]);
  assert.equal(bootstrap.actor_resolution.fixed_profile, null);
  assert.equal(bootstrap.actor_resolution.default_role, 'governance-author');

  const rules = [
    bootstrap.actor_resolution.rule,
    ...bootstrap.platform.startup_constraints,
    ...bootstrap.constraints,
  ].map((rule) => rule.replace(/\s+/g, ' ').trim());
  const text = rules.join('\n');
  assert.match(text, /Resolve one role and versioned Actor Profile from the active POP v3 for each bounded operation/i);
  assert.match(text, /select the concrete implementation only for that operation after verifying identity, capability fit, Operator authorization and the applicable separation-of-duty or independent-audit rules/i);
  assert.match(text, /concrete implementations and Capability Profiles are proven and selected per operation/i);
  const pop = await readYaml(bootstrap.sources.project_operating_profile);
  const index = await readYaml(bootstrap.sources.authority_index);
  assertProducerCapabilityIndex(pop, index);
  const executor = pop.actor_bindings['implementation-executor'];
  assert.equal(executor.status, 'active');
  assert.equal(executor.selection.mode, 'operation-scoped');
  assert.ok(!bootstrap.actor_resolution.eligible_profiles.includes(executor.profile),
    'Governance implementation must not self-select the Executor');
  const validator = pop.actor_bindings['mechanical-validator'];
  assert.equal(validator.selection.mode, 'operation-scoped');
  assert.ok(!bootstrap.actor_resolution.eligible_profiles.includes(validator.profile),
    'Mechanical Validator requires separate operation selection');
  const routes = index.bindings.filter((binding) => binding.path === runnerV3Path);
  assert.deepEqual(routes, [{
    id: 'implementation-executor-capability-producer-maintenance',
    path: runnerV3Path, kind: 'capability-profile', authority_class: 'configured', required: true,
  }]);
  const capability = await readYaml(runnerV3Path);
  assert.equal(capability.id, 'DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3');
  assert.equal(capability.status, 'active', capability.id);
  assert.equal(capability.implementation_class, 'process-bound-runner-code-executor', capability.id);
  assert.equal(capability.limits.hosting_purpose, 'chatgpt-governed-producer-maintenance', capability.id);
  assert.equal(capability.limits.execution_provider, 'codex-cli', capability.id);
  assert.match(text, /Implementation Executor is separately selected per operation and must prove fit to the existing implementation-executor-runner-v3 Capability Profile where applicable/i);
  assert.match(text, /governance author does not self-select that role/i);
  assert.match(text, /Mechanical Validator is separately selected with trustworthy process-bound Runner evidence for the actual operation/i);
  assert.match(text, /Claude Code[^.\n]*target runtime[^.\n]*not[^.\n]*active producer platform/i);
  assert.match(text, /independent audit eligibility is established from actual prior participation and active separation-of-duty rules/i);
  assert.match(text, /repository identity authority state and required capability mismatches fail closed/i);
  assert.match(text, /capability (?:does not|never) grants? authority|capabilit[^.\n]*not grant authority|does not grant authority/i);
  for (const clause of rules.flatMap((rule) => rule.split(/[.;]\s+/))) {
    assert.doesNotMatch(clause, /Implementation[- ]Executor\s+(?:is|remains|may be)\s+(?:bound|resolved)[^.]*(?:claude-main-agent|dev-foundry-executor)/i,
      'Bootstrap must not map the producer Executor to Claude');
  }
});

test('SPC-002 defines the Claude-native binding model and telemetry readiness boundary', async () => {
  const contract = await readProjectFile(contractPath);
  const metadata = frontmatter(contract);
  assert.equal(metadata.artifact.id, 'SPC-002');
  assert.equal(metadata.artifact.status, 'ACTIVE');
  section(contract, '2. Historical Claude-native producer state');
  assert.doesNotMatch(contract, /^## 2\. Historical pre-cutover state$/m);
  const target = section(contract, '3. Claude-native binding target state');
  const mappings = target.split(/^- /m).slice(1).map((mapping) => mapping.split(/\r?\n\s*\r?\n/)[0].replace(/\s+/g, ' ').trim());
  const expected = [
    ['Governance Author', 'governance-author-v3', 'claude-main-agent'],
    ['Implementation Executor', 'implementation-executor-v2', 'dev-foundry-executor', 'DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V2'],
    ['Evidence Custodian', 'evidence-custodian-v1', 'claude-main-agent'],
    ['Mechanical Validator', 'mechanical-validator-v2', 'claude-code-native-validation'],
    ['Governance Auditor', 'governance-auditor-v2', 'dev-foundry-auditor', 'DFC-GOVERNANCE-AUDITOR-CLAUDE-CODE-V1'],
  ];
  assert.equal(mappings.length, expected.length);
  for (const [role, profile, implementation, capability] of expected) {
    const matches = mappings.filter((mapping) => mapping.startsWith(`${role} -> `));
    assert.equal(matches.length, 1, `${role} must have one Claude-native mapping`);
    assert.ok(matches[0].includes(`canonical \`${profile}\``), role);
    assert.ok(matches[0].includes(`concrete implementation \`${implementation}\``), role);
    assert.ok(matches[0].includes('platform `claude-code`'), role);
    assert.match(matches[0], /, active[;.]$/);
    if (capability) {
      assert.ok(matches[0].includes(`capability profile \`${capability}\``), role);
      assert.ok(matches[0].includes('kind `subagent`'), role);
    }
  }
  const audit = section(contract, '7. Isolation and audit boundary').replace(/\s+/g, ' ');
  assert.match(audit, /cutover SHALL NOT occur until the dedicated Executor and Auditor subagents are implemented and statically qualified under SPC-003 and the local operational-telemetry path is mechanically ready under SPC-004\./);
  assert.match(audit, /Paid synthetic Claude benchmarking is not a cutover prerequisite\./);
  assert.match(audit, /independent Governance Audit, it is dispatched explicitly to `dev-foundry-auditor`\./);
  assert.match(audit, /main agent cannot issue that required independent verdict\./);
});

test('project has exactly the two authorized subagents and no Claude settings, Hooks, Skills, or agent teams', async () => {
  // An exact tree excludes settings variants, Hooks, Skills, teams, extra
  // agents, nested definitions, and dangling configuration links.
  assert.ok((await lstat(resolve(root, '.claude'))).isDirectory());
  // Operator-local settings.local.json is tolerated only when the repository's
  // own .gitignore ignores it, independent of global or user-level ignores.
  const claudeEntries = (await readdir(resolve(root, '.claude'))).sort();
  const checkIgnore = (path) => spawnSync('git', ['-c', 'core.excludesFile=/dev/null', 'check-ignore', '-v', path], { cwd: root, encoding: 'utf8' });
  const localSettings = checkIgnore('.claude/settings.local.json');
  assert.equal(localSettings.status, 0);
  assert.match(localSettings.stdout, /^\.gitignore:\d+:\.claude\/settings\.local\.json\t/);
  assert.equal(checkIgnore('.claude/settings.json').status, 1);
  assert.equal(checkIgnore('.claude/agents/dev-foundry-executor.md').status, 1);
  assert.deepEqual(claudeEntries.filter((name) => name !== 'settings.local.json'), ['agents']);
  assert.ok((await lstat(resolve(root, '.claude/agents'))).isDirectory());
  const definitions = ['dev-foundry-auditor.md', 'dev-foundry-executor.md'];
  assert.deepEqual((await readdir(resolve(root, '.claude/agents'))).sort(), definitions);
  for (const name of definitions) {
    assert.ok((await lstat(resolve(root, '.claude/agents', name))).isFile());
  }
  await assertAbsent('.agents/skills');
});
