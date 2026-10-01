import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const runnerPath = '.dev-foundry/profiles/capability-profiles/implementation-executor-runner-v2.yaml';
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

test('active POP has exactly the final Claude-native role bindings', async () => {
  const pop = await readYaml('.dev-foundry/profiles/project-operating-profile.yaml');
  assert.equal(pop.status, 'active');
  assert.equal(pop.repository.name, 'dev-foundry-claude');
  assert.equal(pop.policies.default_role, 'governance-author');
  assert.deepEqual(pop.platform_bootstraps['primary-governance-agent'], {
    path: '.dev-foundry/platform-bootstrap.yaml',
    status: 'active',
  });
  const expected = [
    ['governance-author', 'governance-author-v3', 'agent', 'claude-main-agent', []],
    ['evidence-custodian', 'evidence-custodian-v1', 'agent', 'claude-main-agent', []],
    ['implementation-executor', 'implementation-executor-v2', 'agent', 'dev-foundry-executor', [claudePath]],
    ['governance-auditor', 'governance-auditor-v2', 'agent', 'dev-foundry-auditor', [auditorPath]],
    ['mechanical-validator', 'mechanical-validator-v2', 'tool', 'claude-code-native-validation', []],
  ];
  assert.deepEqual(Object.keys(pop.actor_bindings).sort(), expected.map(([role]) => role).sort());
  for (const [role, profile, kind, identity, capabilities] of expected) {
    const binding = pop.actor_bindings[role];
    assert.equal(binding.status, 'active', role);
    assert.equal(binding.profile, `.dev-foundry/releases/2.1.0/actor-profiles/${profile}.yaml`, role);
    assert.deepEqual(binding.implementation, { kind, identity, platform: 'claude-code' }, role);
    assert.deepEqual(binding.capability_profiles, capabilities, role);
  }
});

test('Authority Index requires Claude targets and retains runner and Claude V1 as non-required history', async () => {
  const index = await readYaml('.dev-foundry/authority-index.yaml');
  for (const [path, required] of [
    [runnerPath, false],
    [claudePath, true],
    [auditorPath, true],
    [historicalClaudePath, false],
  ]) {
    const bindings = index.bindings.filter((binding) => binding.path === path);
    assert.equal(bindings.length, 1, `Expected exactly one capability binding: ${path}`);
    assert.equal(bindings[0].kind, 'capability-profile', path);
    assert.equal(bindings[0].authority_class, 'configured', path);
    assert.equal(bindings[0].required, required, path);
  }
  const runner = await readYaml(runnerPath);
  assert.equal(runner.id, 'DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V2');
  assert.equal(runner.status, 'active');
});

test('active Claude Platform Bootstrap permits only Author and Custodian on the main agent', async () => {
  const bootstrap = await readYaml('.dev-foundry/platform-bootstrap.yaml');
  assert.equal(bootstrap.status, 'active');
  assert.equal(bootstrap.repository.expected_name, 'dev-foundry-claude');
  assert.equal(bootstrap.platform.id, 'claude-code');
  assert.equal(bootstrap.sources.project_operating_profile, '.dev-foundry/profiles/project-operating-profile.yaml');
  assert.equal(bootstrap.sources.authority_index, '.dev-foundry/authority-index.yaml');
  assert.equal(bootstrap.actor_resolution.mode, 'governed-project-bindings');
  assert.deepEqual(bootstrap.actor_resolution.eligible_profiles, [
    '.dev-foundry/releases/2.1.0/actor-profiles/governance-author-v3.yaml',
    '.dev-foundry/releases/2.1.0/actor-profiles/evidence-custodian-v1.yaml',
  ]);
  assert.equal(bootstrap.actor_resolution.fixed_profile, null);
  assert.equal(bootstrap.actor_resolution.default_role, 'governance-author');

  // Inspect operational rules as well as the structured eligibility list:
  // main-agent audit eligibility must not survive in bootstrap prose.
  const rules = [
    bootstrap.actor_resolution.rule,
    ...bootstrap.platform.startup_constraints,
    ...bootstrap.constraints,
  ].map((rule) => rule.replace(/\s+/g, ' ').trim());
  const text = rules.join('\n');
  const mainEligibility = /(?:main[- ]agent|claude-main-agent)[^.\n]*eligible only[^.\n]*Governance[- ]Author[^.\n]*Evidence[- ]Custodian/i;
  assert.match(text, mainEligibility);
  for (const role of ['Implementation[- ]Executor', 'Governance[- ]Auditor']) {
    assert.ok(rules.some((rule) => new RegExp(role, 'i').test(rule)
      && /explicit/i.test(rule) && /dispatch/i.test(rule) && /(?:dedicated|dev-foundry-)[^.]*subagent/i.test(rule)),
    `${role} must be explicitly dispatched to a dedicated subagent`);
  }
  assert.match(text, /Mechanical[- ]Validator[^.\n]*(?:native Claude Code|Claude Code native|claude-code-native-validation)/i);
  for (const clause of rules.flatMap((rule) => rule.split(/[.;]\s+/))) {
    assert.doesNotMatch(clause, /(?:main[- ]agent|claude-main-agent)\s+(?:is|remains|may be)\s+eligible[^.]*Governance[- ]Auditor/i,
      'Bootstrap must not grant Governance Auditor to the main agent');
    assert.doesNotMatch(clause, /Governance[- ]Auditor\s+(?:is|remains|may be)\s+(?:eligible|bound|resolved)[^.]*(?:main[- ]agent|claude-main-agent)/i,
      'Bootstrap must not map Governance Auditor to the main agent');
  }
});

test('SPC-002 defines the Claude-native role mappings and telemetry readiness boundary', async () => {
  const contract = await readProjectFile(contractPath);
  const metadata = frontmatter(contract);
  assert.equal(metadata.artifact.id, 'SPC-002');
  assert.equal(metadata.artifact.status, 'ACTIVE');
  const target = section(contract, '3. Cutover target state');
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
  // Operator-local settings.local.json is tolerated only when Git ignores it.
  const claudeEntries = (await readdir(resolve(root, '.claude'))).sort();
  if (claudeEntries.includes('settings.local.json')) {
    execFileSync('git', ['check-ignore', '-q', '.claude/settings.local.json'], { cwd: root });
  }
  assert.deepEqual(claudeEntries.filter((name) => name !== 'settings.local.json'), ['agents']);
  assert.ok((await lstat(resolve(root, '.claude/agents'))).isDirectory());
  const definitions = ['dev-foundry-auditor.md', 'dev-foundry-executor.md'];
  assert.deepEqual((await readdir(resolve(root, '.claude/agents'))).sort(), definitions);
  for (const name of definitions) {
    assert.ok((await lstat(resolve(root, '.claude/agents', name))).isFile());
  }
  await assertAbsent('.agents/skills');
});
