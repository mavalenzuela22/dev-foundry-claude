import assert from 'node:assert/strict';
import { lstat, readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../../', import.meta.url));
const runnerPath = '.dev-foundry/profiles/capability-profiles/implementation-executor-runner-v2.yaml';
const claudePath = '.dev-foundry/profiles/capability-profiles/implementation-executor-claude-code-v1.yaml';
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
    `${path} must remain absent before cutover`);
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

test('prepared Claude executor requires governance MCP and stops before an active POP binding', async () => {
  const profile = await readYaml(claudePath);
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

test('active POP still binds Implementation Executor to the ChatGPT runner capability', async () => {
  const pop = await readYaml('.dev-foundry/profiles/project-operating-profile.yaml');
  const runner = await readYaml(runnerPath);
  assert.equal(pop.status, 'active');
  assert.equal(pop.repository.name, 'dev-foundry-claude');
  const executor = pop.actor_bindings['implementation-executor'];
  assert.equal(executor.status, 'active');
  assert.equal(executor.implementation.platform, 'chatgpt-project');
  assert.equal(executor.implementation.identity, 'process-bound-runner-code-executor');
  assert.deepEqual(executor.capability_profiles, [runnerPath]);
  assert.equal(runner.id, 'DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V2');
  assert.equal(runner.status, 'active');
  for (const binding of Object.values(pop.actor_bindings)) {
    assert.ok(!binding.capability_profiles.includes(claudePath), 'Prepared Claude capability must remain unbound');
  }
});

test('current Platform Bootstrap still identifies chatgpt-project', async () => {
  const bootstrap = await readYaml('.dev-foundry/platform-bootstrap.yaml');
  assert.equal(bootstrap.repository.expected_name, 'dev-foundry-claude');
  assert.equal(bootstrap.platform.id, 'chatgpt-project');
});

test('SPC-002 defines future Claude role mappings and defers independent Governance Audit', async () => {
  const contract = await readProjectFile(contractPath);
  const metadata = frontmatter(contract);
  assert.equal(metadata.artifact.id, 'SPC-002');
  assert.equal(metadata.artifact.status, 'ACTIVE');
  const target = section(contract, '3. Cutover target state');
  assert.match(target, /A future cutover TSK SHALL atomically reconcile/);
  const mappings = target.split(/^- /m).slice(1).map((mapping) => mapping.split(/\r?\n\s*\r?\n/)[0].replace(/\s+/g, ' ').trim());
  const expected = [
    ['Governance Author', 'governance-author-v3', 'claude-main-agent'],
    ['Implementation Executor', 'implementation-executor-v2', 'claude-main-agent'],
    ['Evidence Custodian', 'evidence-custodian-v1', 'claude-main-agent'],
    ['Mechanical Validator', 'mechanical-validator-v2', 'claude-code-native-validation'],
    ['Governance Auditor', 'governance-auditor-v2', 'claude-main-agent'],
  ];
  assert.equal(mappings.length, expected.length);
  for (const [role, profile, implementation] of expected) {
    const matches = mappings.filter((mapping) => mapping.startsWith(`${role} -> `));
    assert.equal(matches.length, 1, `${role} must have one future mapping`);
    assert.ok(matches[0].includes(`canonical \`${profile}\``), role);
    assert.ok(matches[0].includes(`concrete implementation \`${implementation}\``), role);
    assert.ok(matches[0].includes('platform `claude-code`'), role);
    if (role === 'Governance Auditor') {
      assert.match(matches[0], /status `deferred` until a separately governed independent-audit implementation is activated\./);
    } else {
      assert.match(matches[0], /, active;$/);
    }
    if (role === 'Implementation Executor') {
      assert.ok(matches[0].includes('capability profile `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V1`'));
    }
  }
  const audit = section(contract, '7. Audit boundary').replace(/\s+/g, ' ');
  assert.match(audit, /Auditor binding is deferred, the operation MUST stop until a separately eligible independent implementation is governed and activated\./);
});

test('project has no Claude settings, Hooks, Skills, custom subagents, or agent-team definitions', async () => {
  // Native project definitions live under .claude; .agents/skills is also a
  // project skill discovery location. Reject even dangling configuration links.
  for (const path of ['.claude', '.agents/skills']) await assertAbsent(path);
});
