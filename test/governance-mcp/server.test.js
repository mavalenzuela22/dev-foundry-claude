import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { makeBrownfieldProject, makeProject, makeV3Project } from './fixture.js';
import { helpTopics, helpUri, renderHelp } from '../../src/consumer/help.js';
import { execFileSync } from 'node:child_process';
import { parse, stringify } from 'yaml';
import { canonicalJson, sha256 } from '../../src/adopt/pin.js';
import { beginRuntimeUpgrade } from '../../src/adopt/runtime.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverPath = path.join(repoRoot, 'src/governance-mcp/server.js');

test('consumer MCP propagates distinct session denials and recovery actions to readiness', async (t) => {
  const sourcePin = `1.5.5:sha256:${'a'.repeat(64)}`;
  const targetPin = `1.5.6:sha256:${'b'.repeat(64)}`;
  const mcp = (pin) => canonicalJson({ mcpServers: { 'dev-foundry-governance': { command: 'dev-foundry-claude', args: ['mcp', '--expect', pin] } } });
  const read = (project, file) => readFile(path.join(project.root, file), 'utf8');
  const start = `globalThis[Symbol.for('dev-foundry-claude.consumer-mode-guard')] = true;
    globalThis[Symbol.for('dev-foundry-claude.consumer-runtime-pin')] = ${JSON.stringify(sourcePin)};
    await import(${JSON.stringify(serverPath)});`;
  for (const [name, expected] of [
    ['missing host root', 'PROJECT_CONTEXT_UNAVAILABLE'],
    ['corrupt binding', 'RUNTIME_BINDING_INVALID'],
    ['pending upgrade', 'RUNTIME_RECOVERY_REQUIRED'],
    ['blocked cutover', 'CUTOVER_RECOVERY_REQUIRED'],
    ['runtime drift', 'STALE_SESSION'],
    ['inactive activation', 'BINDING_INACTIVE'],
  ]) await t.test(name, async (st) => {
    const project = await makeV3Project();
    st.after(project.cleanup);
    await project.write('.mcp.json', mcp(sourcePin));
    // Complete the fixture's host role activation for the direct MCP path.
    const pop = JSON.parse(await read(project, '.dev-foundry/profiles/project-operating-profile.yaml'));
    const bootstrapPath = pop.platform_bootstraps['claude-code'].path;
    const bootstrap = JSON.parse(await read(project, bootstrapPath));
    bootstrap.actor_resolution.eligible_profiles = [pop.actor_bindings['governance-author'].profile, pop.actor_bindings['evidence-custodian'].profile];
    if (name !== 'inactive activation') await project.write(bootstrapPath, canonicalJson(bootstrap));
    if (name === 'corrupt binding') await project.write('.mcp.json', '{PRIVATE_SECRET');
    if (name === 'pending upgrade') {
      const bytes = Buffer.from(canonicalJson({ mode: 'upgrade', status: 'ready', current: { expect: sourcePin }, target: { expect: targetPin }, create: [],
        merge: [{ path: '.mcp.json', before_sha256: sha256(mcp(sourcePin)), after_sha256: sha256(mcp(targetPin)) }] }));
      await beginRuntimeUpgrade({ root: project.root, planBytes: bytes, planSha256: sha256(bytes), writes: [{ path: '.mcp.json', content: mcp(targetPin) }] });
    }
    if (name === 'blocked cutover') await project.write('.dfc-cutover/intent.json', '{PRIVATE_SECRET');
    const transport = new StdioClientTransport({ command: process.execPath, args: ['--input-type=module', '--eval', start],
      env: { CLAUDE_PROJECT_DIR: name === 'missing host root' ? '' : project.root }, cwd: '/tmp' });
    const client = new Client({ name: 'session-diagnostics', version: '1.0.0' });
    const call = async (name, args) => JSON.parse((await client.callTool({ name, arguments: args })).content[0].text);
    const request = { requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-029' };
    try {
      await client.connect(transport);
      if (name === 'runtime drift') {
        assert.equal((await call('resolve_governed_operation', request)).ok, true);
        // The resolver must still observe task edits within a valid session.
        const taskPath = 'docs/tasks/task.md';
        const task = await read(project, taskPath);
        await project.write(taskPath, task.replace('status: IN_PROGRESS', 'status: CLOSED'));
        const current = await call('resolve_governed_operation', request);
        assert.equal(current.ok, false);
        assert.notEqual(current.errorCode, 'STALE_SESSION');
        await project.write(taskPath, task);
        const indexPath = '.dev-foundry/authority-index.yaml';
        const index = parse(await read(project, indexPath));
        index.artifact_version = 'ordinary-index-edit';
        await project.write(indexPath, stringify(index));
        assert.equal((await call('resolve_governed_operation', request)).ok, true);
        await project.write('.mcp.json', mcp(targetPin));
      }
      const denied = await call('resolve_governed_operation', request);
      assert.equal(denied.errorCode, expected);
      const readiness = await call('assess_predelegation_readiness', { targetProject: request.targetProject, taskId: request.taskId });
      assert.equal(readiness.outcome, 'BLOCKED');
      assert.deepEqual(readiness.reasonCodes, [expected === 'BINDING_INACTIVE' ? 'ACTIVATION_INACTIVE' : expected]);
      if (denied.nextAction) assert.deepEqual(readiness.nextActions, [denied.nextAction]);
      assert.equal(readiness.nonAuthorizing, true);
      assert.equal(readiness.dispatchAllowed, false);
      assert.equal(readiness.contextFingerprint, null);
      assert.equal(readiness.handoff, null);
      assert.equal(JSON.stringify({ denied, readiness }).includes(project.root), false);
      assert.doesNotMatch(JSON.stringify({ denied, readiness }), /PRIVATE_SECRET/);
    } finally { await client.close(); }
  });
});

test('read-only MCP help and installed CLI render the same canonical versioned content', async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath], cwd: '/tmp' });
  const client = new Client({ name: 'help-parity', version: '1.0.0' });
  try {
    await client.connect(transport);
    const { resources } = await client.listResources();
    assert.deepEqual(resources.map((resource) => resource.uri).sort(), Object.keys(helpTopics).map(helpUri).sort());
    for (const topic of Object.keys(helpTopics)) {
      const resource = await client.readResource({ uri: helpUri(topic) });
      assert.equal(resource.contents[0].text, renderHelp(topic));
      const cli = execFileSync(process.execPath, [path.join(repoRoot, 'bin/dev-foundry-claude.js'), 'help', topic], { encoding: 'utf8', cwd: '/tmp' });
      assert.equal(cli, resource.contents[0].text);
    }
  } finally { await client.close(); }
});

test('stdio MCP smoke lists exactly two tools with strict schemas and calls the resolver', async () => {
  const project = await makeProject();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: { CLAUDE_PROJECT_DIR: project.root },
    cwd: '/tmp',
  });
  const client = new Client({ name: 'governance-mcp-smoke', version: '1.0.0' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ['assess_predelegation_readiness', 'resolve_governed_operation']);
    const descriptions = Object.fromEntries(tools.map(tool => [tool.name, tool.description]));
    assert.match(descriptions.resolve_governed_operation, /requestedRole.*project role ID.*Actor Profile path.*Capability Profile.*POP/i);
    assert.match(descriptions.resolve_governed_operation, /taskId is the routed TSK artifact ID, never an Authority Index route ID/i);
    assert.match(descriptions.resolve_governed_operation, /correct caller input and retry once.*stop.*Governance Author reconciliation/i);
    assert.match(descriptions.assess_predelegation_readiness, /Optional advisory diagnostic after resolve_governed_operation and before implementation delegation.*fresh resolution.*taskId is the routed TSK artifact ID.*cannot authenticate external host facts/i);
    assert.doesNotMatch(descriptions.assess_predelegation_readiness, /consult Foundry Runner|call Foundry Runner|await Foundry Runner/i);
    const schema = tools.find((tool) => tool.name === 'resolve_governed_operation').inputSchema;
    assert.deepEqual(schema.required, ['requestedAction', 'targetProject']);
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.properties.requestedAction.enum, ['inspect', 'author', 'implement', 'validate', 'audit', 'promote', 'close']);
    assert.equal(schema.properties.requestedAction.type, 'string');
    assert.equal(schema.properties.targetProject.type, 'string');
    assert.equal(schema.properties.taskId.type, 'string');
    assert.equal(schema.properties.taskId.pattern, '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$');
    assert.equal(schema.properties.boundaryId.type, 'string');
    assert.equal(schema.properties.boundaryId.pattern, '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$');
    assert.equal(schema.properties.requestedRole.type, 'string');
    assert.equal(schema.properties.expectedContextFingerprint.type, 'string');
    assert.equal(schema.properties.expectedContextFingerprint.pattern, '^[0-9a-f]{64}$');
    const readiness = tools.find((tool) => tool.name === 'assess_predelegation_readiness');
    assert.deepEqual(readiness.inputSchema.required, ['targetProject', 'taskId']);
    assert.equal(readiness.inputSchema.additionalProperties, false);
    assert.equal(readiness.inputSchema.properties.targetProject.type, 'string');
    assert.equal(readiness.inputSchema.properties.taskId.type, 'string');
    assert.equal(readiness.inputSchema.properties.taskId.pattern, '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$');
    assert.equal(readiness.inputSchema.properties.expectedContextFingerprint.pattern, '^[0-9a-f]{64}$');
    assert.equal(readiness.inputSchema.properties.observations.type, 'object');
    assert.equal(readiness.inputSchema.properties.observations.additionalProperties, false);
    const result = await client.callTool({ name: 'resolve_governed_operation', arguments: {
      requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-002',
    } });
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, 'text');
    assert.equal(JSON.parse(result.content[0].text).ok, true);
    const taskless = await client.callTool({ name: 'resolve_governed_operation', arguments: {
      requestedAction: 'author', targetProject: 'fixture-project', boundaryId: 'pre-task',
    } });
    assert.equal(JSON.parse(taskless.content[0].text).ok, true);
    const implementWithoutTask = await client.callTool({ name: 'resolve_governed_operation', arguments: {
      requestedAction: 'implement', targetProject: 'fixture-project', boundaryId: 'implementation',
    } });
    assert.deepEqual(JSON.parse(implementWithoutTask.content[0].text), {
      ok: false, errorCode: 'INVALID_REQUEST', message: 'Invalid request: taskId is required when requestedAction is implement.',
    });
  } finally {
    await client.close();
    await project.cleanup();
  }
});

test('stdio recovery messages distinguish role input, contradictory profiles, and missing POP-bound sources', async () => {
  const project = await makeProject();
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath], env: { CLAUDE_PROJECT_DIR: project.root }, cwd: '/tmp' });
  const client = new Client({ name: 'governance-mcp-recovery', version: '1.0.0' });
  const call = async (name, args) => {
    const response = await client.callTool({ name, arguments: args });
    assert.equal(response.content.length, 1);
    assert.equal(response.content[0].type, 'text');
    return JSON.parse(response.content[0].text);
  };
  const request = { requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-002' };
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name).sort(), ['assess_predelegation_readiness', 'resolve_governed_operation']);
    const rolePath = await call('resolve_governed_operation', { ...request, requestedRole: '.dev-foundry/profiles/executor.yaml' });
    assert.equal(rolePath.errorCode, 'ROLE_INELIGIBLE');
    assert.match(rolePath.message, /requestedRole must be a project role ID.*expected implementation-executor.*path-like value.*retry once/i);

    const popRelative = '.dev-foundry/profiles/project-operating-profile.yaml';
    const popPath = path.join(project.root, popRelative);
    const pop = JSON.parse(await readFile(popPath, 'utf8'));
    const actorPath = pop.actor_bindings['implementation-executor'].profile;
    await project.write(actorPath, 'schema_version: dev-foundry.actor-profile.v2\nid: executor-profile\nstatus: deferred\nrole: governance-author\nprivate: PRIVATE_PROFILE_BODY\n');
    const actor = await call('resolve_governed_operation', request);
    assert.equal(actor.errorCode, 'AUTHORITY_INVALID');
    assert.match(actor.message, /Actor Profile .*role expected implementation-executor, actual governance-author; status expected active, actual deferred/i);
    assert.equal(JSON.stringify(actor).includes('PRIVATE_PROFILE_BODY'), false);
    const readinessActor = await call('assess_predelegation_readiness', { targetProject: 'fixture-project', taskId: 'TSK-002' });
    assert.deepEqual(Object.keys(readinessActor), ['outcome', 'reasonCodes', 'nextActions', 'contextFingerprint', 'handoff', 'nonAuthorizing', 'dispatchAllowed']);
    assert.ok(readinessActor.reasonCodes.includes('AUTHORITY_UNAVAILABLE'));
    assert.match(readinessActor.nextActions.join(' '), /Actor Profile .*role expected implementation-executor/i);

    pop.actor_bindings['implementation-executor'].profile = '.dev-foundry/releases/2.1.0/actor-profiles/missing-executor.yaml';
    await project.write(popRelative, JSON.stringify(pop));
    const missing = await call('resolve_governed_operation', request);
    assert.equal(missing.errorCode, 'READ_FAILED', JSON.stringify(missing));
    assert.match(missing.message, /missing-executor\.yaml.*POP\/index-bound path exists and is readable/i);
    const readinessMissing = await call('assess_predelegation_readiness', { targetProject: 'fixture-project', taskId: 'TSK-002' });
    assert.ok(readinessMissing.nextActions.join(' ').includes('missing-executor.yaml'));
    assert.doesNotMatch(readinessMissing.nextActions.join(' '), /Foundry Runner|repeat this diagnostic/i);
  } finally {
    await client.close();
    await project.cleanup();
  }
});

test('stdio MCP wraps invalid tool arguments in DAT-001 failure envelopes', async () => {
  const project = await makeProject();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: { CLAUDE_PROJECT_DIR: project.root },
    cwd: '/tmp',
  });
  const client = new Client({ name: 'governance-mcp-invalid-inputs', version: '1.0.0' });
  const invalidRequests = [
    [{ requestedAction: 'execute', targetProject: 'fixture-project', taskId: 'TSK-002' }, /requestedAction must be one of/],
    [{ requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-002', unexpected: true }, /unknown argument: unexpected/],
    [{ requestedAction: 'implement', taskId: 'TSK-002' }, /targetProject must be a non-empty string/],
    [{ requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'not valid' }, /taskId must be a 1-128 character identifier/],
    [{ requestedAction: 'author', targetProject: 'fixture-project', boundaryId: 'pre-task', expectedContextFingerprint: 'not-a-digest' }, /expectedContextFingerprint must be a 64-character lowercase SHA-256 hex string/],
  ];
  try {
    await client.connect(transport);
    for (const [argumentsValue, messagePattern] of invalidRequests) {
      const result = await client.callTool({ name: 'resolve_governed_operation', arguments: argumentsValue });
      assert.equal(result.content.length, 1);
      assert.equal(result.content[0].type, 'text');
      const failure = JSON.parse(result.content[0].text);
      assert.deepEqual(Object.keys(failure), ['ok', 'errorCode', 'message']);
      assert.equal(failure.ok, false);
      assert.equal(failure.errorCode, 'INVALID_REQUEST');
      assert.match(failure.message, messagePattern);
    }
  } finally {
    await client.close();
    await project.cleanup();
  }
});

test('project MCP configuration selects local stdio Node launch without alwaysLoad', async () => {
  const config = JSON.parse(await readFile(path.join(repoRoot, '.mcp.json'), 'utf8'));
  const servers = Object.values(config.mcpServers);
  assert.equal(servers.length, 1);
  assert.equal(servers[0].type, 'stdio');
  assert.equal(servers[0].command, 'node');
  assert.deepEqual(servers[0].args, ['${CLAUDE_PROJECT_DIR:-.}/src/governance-mcp/server.js']);
  assert.notEqual(servers[0].alwaysLoad, true);
});

test('stdio MCP resolves synthetic brownfield authority and refuses historical governing references', async () => {
  const project = await makeBrownfieldProject();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: { CLAUDE_PROJECT_DIR: project.root },
    cwd: '/tmp',
  });
  const client = new Client({ name: 'brownfield-resolver-proof', version: '1.0.0' });
  const call = async argumentsValue => {
    const result = await client.callTool({ name: 'resolve_governed_operation', arguments: argumentsValue });
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, 'text');
    assert.equal(result.content[0].text.includes('PRIVATE_TASK_BODY_MARKER'), false);
    return JSON.parse(result.content[0].text);
  };
  const implement = { requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-002' };
  try {
    await client.connect(transport);
    for (const argumentsValue of [
      { ...implement, requestedAction: 'inspect', requestedRole: 'governance-author' },
      implement,
    ]) {
      const result = await call(argumentsValue);
      assert.equal(result.ok, true);
      assert.equal(result.resolution.authority.some(entry => ['TSK-001', 'SPC-LEGACY', 'TSK-UNUSED'].includes(entry.id) || entry.authorityClass === 'historical'), false);
    }
    const stale = await call({ ...implement, expectedContextFingerprint: '0'.repeat(64) });
    assert.deepEqual(Object.keys(stale), ['ok', 'errorCode', 'message']);
    assert.equal(stale.errorCode, 'STALE_CONTEXT');
    const historical = await call({ ...implement, taskId: 'TSK-001' });
    assert.equal(historical.errorCode, 'AUTHORITY_INVALID');
    const task = await readFile(path.join(project.root, project.taskPath), 'utf8');
    await project.write(project.taskPath, task.replace('governedBy: [ADR-001]', 'governedBy: [ADR-001, TSK-001]'));
    const closed = await call(implement);
    assert.equal(closed.errorCode, 'AUTHORITY_INVALID');
    assert.deepEqual(Object.keys(closed), ['ok', 'errorCode', 'message']);
  } finally {
    await client.close();
    await project.cleanup();
  }
});
