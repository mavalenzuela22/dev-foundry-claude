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
const historicalClaudePath = '.dev-foundry/profiles/capability-profiles/implementation-executor-claude-code-v1.yaml';
const claudePath = '.dev-foundry/profiles/capability-profiles/implementation-executor-claude-code-v2.yaml';
const auditorPath = '.dev-foundry/profiles/capability-profiles/governance-auditor-claude-code-v1.yaml';
const contractPath = 'docs/40-specifications/40 [SPC-002] PROJECT - Claude-Native Cutover Binding Contract.md';

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

function assertProducerCapabilityIndex(pop, index) {
  const activePaths = Object.values(pop.actor_bindings)
    .filter((binding) => binding.status === 'active')
    .flatMap((binding) => binding.capability_profiles);
  const active = new Set(activePaths);
  assert.equal(active.size, activePaths.length, 'Active producer capabilities must not be duplicated');
  for (const path of [historicalClaudePath, claudePath, auditorPath]) {
    assert.ok(!active.has(path), `Claude consumer capability must not be bound to the producer: ${path}`);
  }
  for (const path of active) {
    const bindings = index.bindings.filter((binding) => binding.path === path);
    assert.equal(bindings.length, 1, `Expected exactly one active capability binding: ${path}`);
    assert.equal(bindings[0].kind, 'capability-profile', path);
    assert.equal(bindings[0].authority_class, 'configured', path);
    assert.equal(bindings[0].required, true, `Active producer capability must be required: ${path}`);
  }
  for (const binding of index.bindings.filter((entry) => entry.kind === 'capability-profile')) {
    assert.equal(binding.required, active.has(binding.path),
      `Only active POP capabilities may be required: ${binding.path}`);
  }
  for (const path of [runnerV1Path, runnerPath, runnerV3Path, historicalClaudePath, claudePath, auditorPath]) {
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
  const expected = [
    ['governance-author', 'governance-author-v3', 'agent', 'operator-assisted-dev-foundry-copilot'],
    ['governance-auditor', 'governance-auditor-v2', 'agent', 'operator-assisted-dev-foundry-copilot'],
    ['evidence-custodian', 'evidence-custodian-v1', 'agent', 'operator-assisted-dev-foundry-copilot'],
    ['implementation-executor', 'implementation-executor-v2', 'tool', 'process-bound-runner-code-executor'],
    ['mechanical-validator', 'mechanical-validator-v2', 'tool', 'process-bound-runner'],
  ];
  assert.deepEqual(Object.keys(pop.actor_bindings).sort(), expected.map(([role]) => role).sort());
  for (const [role, profile, kind, identity] of expected) {
    const binding = pop.actor_bindings[role];
    assert.equal(binding.status, 'active', role);
    assert.equal(binding.profile, `.dev-foundry/releases/2.1.0/actor-profiles/${profile}.yaml`, role);
    assert.deepEqual(binding.implementation, { kind, identity, platform: 'chatgpt-project' }, role);
    assert.ok(Array.isArray(binding.capability_profiles), role);
    if (role === 'governance-author') {
      assert.ok(binding.capability_profiles.length > 0, 'Author must retain governed capabilities');
    } else if (role === 'implementation-executor') {
      assert.equal(binding.capability_profiles.length, 1, 'Producer must have exactly one bound executor capability');
    } else {
      assert.deepEqual(binding.capability_profiles, [], role);
    }
    for (const path of binding.capability_profiles) {
      assert.ok(path.startsWith('.dev-foundry/profiles/capability-profiles/'), path);
      const capability = await readYaml(path);
      assert.equal(capability.status, 'active', path);
      assert.equal(capability.implementation_class, identity, path);
      assert.equal(capability.limits.repository, 'dev-foundry-claude', path);
      if (role === 'implementation-executor') {
        assert.equal(capability.limits.hosting_purpose, 'chatgpt-governed-producer-maintenance', path);
        assert.equal(capability.limits.execution_provider, 'codex-cli', path);
        assert.ok(capability.prohibited_actions.some((action) =>
          /^invoke_claude_code_as_(?:executor_for_producer_maintenance|producer_(?:implementation_)?executor)$/.test(action)), path);
      }
    }
  }
  assertProducerCapabilityIndex(pop, await readYaml('.dev-foundry/authority-index.yaml'));
});

test('Authority Index requires exactly the active POP capabilities and retains historical/consumer profiles as non-required', async () => {
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
        /Only active POP capabilities may be required/, `Unbound required: ${binding.path}`);
    }
  }
  for (const path of [historicalClaudePath, claudePath, auditorPath]) {
    const claudeBound = structuredClone(pop);
    claudeBound.actor_bindings['implementation-executor'].capability_profiles = [path];
    assert.throws(() => assertProducerCapabilityIndex(claudeBound, index),
      /Claude consumer capability must not be bound to the producer/, path);
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

test('runner V3 binds the producer Executor to the ChatGPT-governed process-bound runner', async () => {
  const profile = await readYaml(runnerV3Path);
  assert.equal(profile.id, 'DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3');
  assert.equal(profile.implementation_class, 'process-bound-runner-code-executor');
  assert.equal(profile.limits.hosting_purpose, 'chatgpt-governed-producer-maintenance');
  assert.equal(profile.limits.execution_provider, 'codex-cli');
  assert.ok(!Object.hasOwn(profile.limits, 'hosting_phase'));
  assert.ok(profile.environment_constraints.includes('active_pop_must_bind_implementation_executor_to_this_profile'));
  assert.ok(profile.stop_conditions.includes('profile_is_not_the_active_pop_binding_for_implementation_executor'));
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

test('active ChatGPT-project Platform Bootstrap permits Author, Auditor, and Custodian and separately binds the runner', async () => {
  const bootstrap = await readYaml('.dev-foundry/platform-bootstrap.yaml');
  assert.equal(bootstrap.status, 'active');
  assert.equal(bootstrap.repository.expected_name, 'dev-foundry-claude');
  assert.equal(bootstrap.platform.id, 'chatgpt-project');
  assert.equal(bootstrap.sources.project_operating_profile, '.dev-foundry/profiles/project-operating-profile.yaml');
  assert.equal(bootstrap.sources.authority_index, '.dev-foundry/authority-index.yaml');
  assert.equal(bootstrap.actor_resolution.mode, 'governed-project-bindings');
  assert.deepEqual(bootstrap.actor_resolution.eligible_profiles, [
    '.dev-foundry/releases/2.1.0/actor-profiles/governance-author-v3.yaml',
    '.dev-foundry/releases/2.1.0/actor-profiles/governance-auditor-v2.yaml',
    '.dev-foundry/releases/2.1.0/actor-profiles/evidence-custodian-v1.yaml',
  ]);
  assert.equal(bootstrap.actor_resolution.fixed_profile, null);
  assert.equal(bootstrap.actor_resolution.default_role, 'governance-author');

  const rules = [
    bootstrap.actor_resolution.rule,
    ...bootstrap.platform.startup_constraints,
    ...bootstrap.constraints,
  ].map((rule) => rule.replace(/\s+/g, ' ').trim());
  const text = rules.join('\n');
  assert.match(text, /Implementation[- ]Executor[^.\n]*(?:separately )?bound[^.\n]*process-bound[- ]runner[- ]code[- ]executor/i);
  const pop = await readYaml(bootstrap.sources.project_operating_profile);
  const index = await readYaml(bootstrap.sources.authority_index);
  assertProducerCapabilityIndex(pop, index);
  const executor = pop.actor_bindings['implementation-executor'];
  assert.equal(executor.status, 'active');
  assert.deepEqual(executor.implementation, {
    kind: 'tool', identity: 'process-bound-runner-code-executor', platform: 'chatgpt-project',
  });
  assert.ok(!bootstrap.actor_resolution.eligible_profiles.includes(executor.profile),
    'Governance implementation must not self-select the Executor');
  assert.equal(executor.capability_profiles.length, 1);
  const capabilityPath = executor.capability_profiles[0];
  const routes = index.bindings.filter((binding) => binding.path === capabilityPath);
  assert.equal(routes.length, 1);
  const capability = await readYaml(routes[0].path);
  assert.match(capability.id, /^DFC-IMPLEMENTATION-EXECUTOR-[A-Z0-9-]+$/,
    'The active POP-bound, routed capability must identify the producer Executor');
  assert.equal(capability.status, 'active', capability.id);
  assert.equal(capability.implementation_class, executor.implementation.identity, capability.id);
  assert.equal(capability.limits.implementation_identity, executor.implementation.identity, capability.id);
  assert.equal(capability.limits.platform, bootstrap.platform.id, capability.id);
  assert.match(text, /Implementation[- ]Executor[^.\n]*separately bound in the POP[^.\n]*through the active (?:task-specific )?Capability Profile/i);
  assert.match(text, /Implementation[- ]Executor[^.\n]*not (?:be )?self-selected|not self-selected[^.\n]*Implementation[- ]Executor/i);
  assert.match(text, /Mechanical[- ]Validator[^.\n]*(?:separately )?bound[^.\n]*process-bound[- ]runner/i);
  assert.match(text, /Claude Code[^.\n]*target runtime[^.\n]*not[^.\n]*active producer platform/i);
  assert.match(text, /separation-of-duty and independence rules are satisfied/i);
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

test('managed startup discovers on-demand B3 workflow without granting upgrade authority or requiring user npm/hash edits', async () => {
  const block = await readProjectFile('templates/claude-md-block.md.tmpl');
  for (const text of ['dev-foundry://help/runtime', 'source POP/index/task/profile authority', 'actual Operator authorization', 'Never self-authorize', 'fresh independently verified target MCP session', 'one-time B4 host bootstrap']) assert.ok(block.includes(text), text);
  assert.ok(!block.includes('/update'));
  const { renderHelp } = await import('../../src/consumer/help.js');
  const help = renderHelp('runtime');
  for (const text of ['No user npm, hash-copying or JSON editing', 'Chat memory', '--yes is forbidden', 'B2', 'actual fresh target MCP process', 'no-op', 'B4 gates']) assert.ok(help.includes(text), text);
});
