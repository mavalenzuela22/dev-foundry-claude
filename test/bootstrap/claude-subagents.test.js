import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';

const root = new URL('../../', import.meta.url);
const profileDirectory = '.dev-foundry/profiles/capability-profiles/';
const roles = [
  {
    role: 'implementation-executor',
    name: 'dev-foundry-executor',
    profile: 'implementation-executor-claude-code-v2.yaml',
    id: 'DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V2',
    tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'mcp__dev-foundry-governance__*'],
  },
  {
    role: 'governance-auditor',
    name: 'dev-foundry-auditor',
    profile: 'governance-auditor-claude-code-v1.yaml',
    id: 'DFC-GOVERNANCE-AUDITOR-CLAUDE-CODE-V1',
    tools: ['Read', 'Grep', 'Glob', 'mcp__dev-foundry-governance__*'],
  },
];
const prohibitedFields = [
  'model', 'skills', 'hooks', 'memory', 'background', 'isolation', 'effort',
  'initialPrompt', 'permissionMode', 'experimental',
];

async function readProjectFile(path) {
  return readFile(new URL(path, root), 'utf8');
}

async function readYaml(path) {
  return parse(await readProjectFile(path));
}

async function agentFiles(directory = '.claude/agents') {
  const files = [];
  for (const entry of await readdir(new URL(`${directory}/`, root), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    assert.ok(!entry.isSymbolicLink(), `Agent definitions must not use symlinks: ${path}`);
    if (entry.isDirectory()) files.push(...await agentFiles(path));
    else {
      assert.ok(entry.isFile(), `Expected a regular agent definition: ${path}`);
      files.push(path);
    }
  }
  return files.sort();
}

test('exactly two project agent definitions exist recursively', async () => {
  assert.deepEqual(await agentFiles(), roles.map(({ name }) => `.claude/agents/${name}.md`).sort());
});

for (const { role, name, profile, id, tools } of roles) {
  test(`${name} has only authorized YAML frontmatter, tools, MCP, and static context budgets`, async () => {
    const document = await readProjectFile(`.claude/agents/${name}.md`);
    const match = document.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]+)$/);
    assert.ok(match, 'Definition must contain YAML frontmatter and a system prompt');
    const metadata = parse(match[1]);
    assert.equal(metadata.name, name);
    assert.equal(typeof metadata.description, 'string');
    assert.ok(metadata.description.trim().length > 0);
    assert.ok(Buffer.byteLength(metadata.description, 'utf8') <= 240);
    assert.ok(Buffer.byteLength(document, 'utf8') <= 8192);
    assert.ok(document.split(/\r?\n/).filter((line) => line.trim()).length <= 100);
    assert.deepEqual(Object.keys(metadata).sort(), ['description', 'mcpServers', 'name', 'tools']);
    for (const field of prohibitedFields) assert.ok(!Object.hasOwn(metadata, field), field);
    assert.deepEqual(metadata.tools, tools);
    assert.ok(metadata.tools.every((tool) => !/^Agent(?:\(|$)/i.test(tool)), 'No nested Agent access');
    assert.ok(metadata.tools.every((tool) => !/^(?:Skill|Skills)(?:\(|$)/i.test(tool)), 'No Skills tool');
    assert.deepEqual(metadata.mcpServers, ['dev-foundry-governance']);
  });

  test(`${name} capability matches identity, platform, tools, budgets, and nesting constraints`, async () => {
    const capability = await readYaml(`${profileDirectory}${profile}`);
    assert.equal(capability.schema_version, 'dev-foundry.capability-profile.v1');
    assert.equal(capability.id, id);
    assert.equal(capability.status, 'active');
    assert.equal(capability.implementation_class, 'claude-code-project-subagent');
    const expectedLimits = {
      repository: 'dev-foundry-claude',
      platform: 'claude-code',
      implementation_identity: name,
      operating_mode: 'project_subagent',
      allowed_tools: tools,
      governance_mcp_server: 'dev-foundry-governance',
      governance_resolution: 'resolve_governed_operation',
      delegation_depth: 1,
      nested_agent_access: false,
      skills_preloaded: false,
      description_max_utf8_bytes: 240,
      definition_max_utf8_bytes: 8192,
      definition_max_nonempty_lines: 100,
      handoff_max_utf8_bytes: 8192,
      disposition_max_utf8_bytes: 4096,
    };
    for (const [key, value] of Object.entries(expectedLimits)) {
      assert.deepEqual(capability.limits[key], value, key);
    }
    for (const prohibition of [
      'spawn_subagents_or_agent_teams', 'preload_project_skills',
      'use_this_profile_before_project_cutover_binding_is_active',
    ]) assert.ok(capability.prohibited_actions.includes(prohibition), prohibition);
    assert.ok(capability.environment_constraints.includes(`active_pop_must_bind_${role.replaceAll('-', '_')}_to_this_profile`));
    assert.ok(capability.stop_conditions.includes(`profile_is_not_the_active_pop_binding_for_${role.replaceAll('-', '_')}`));
    if (role === 'governance-auditor') {
      assert.equal(capability.limits.repository_mutation, 'forbidden');
      assert.equal(capability.limits.shell_execution, 'forbidden');
      assert.ok(capability.prohibited_actions.includes('edit_write_or_delete_repository_files'));
      assert.ok(capability.prohibited_actions.includes('run_shell_or_powershell_commands'));
    }
  });
}

test('current POP stays chatgpt-project with both Claude target capabilities unbound', async () => {
  const pop = await readYaml('.dev-foundry/profiles/project-operating-profile.yaml');
  assert.equal(pop.repository.name, 'dev-foundry-claude');
  assert.equal(pop.status, 'active');
  for (const binding of Object.values(pop.actor_bindings)) {
    assert.equal(binding.implementation.platform, 'chatgpt-project');
    for (const { name, profile, id } of roles) {
      assert.notEqual(binding.implementation.identity, name);
      assert.ok(!binding.capability_profiles.includes(`${profileDirectory}${profile}`));
      assert.ok(!binding.capability_profiles.includes(id));
    }
  }
  assert.deepEqual(pop.actor_bindings['implementation-executor'].capability_profiles,
    [`${profileDirectory}implementation-executor-runner-v2.yaml`]);
  const config = JSON.parse(await readProjectFile('.mcp.json'));
  assert.ok(Object.hasOwn(config.mcpServers, 'dev-foundry-governance'));
});
