import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { makeBrownfieldProject, makeProject } from './fixture.js';
import { helpTopics, helpUri, renderHelp } from '../../src/consumer/help.js';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverPath = path.join(repoRoot, 'src/governance-mcp/server.js');

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

test('stdio MCP smoke lists exactly one tool and calls the resolver', async () => {
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
    assert.deepEqual(tools.map((tool) => tool.name), ['resolve_governed_operation']);
    const result = await client.callTool({ name: 'resolve_governed_operation', arguments: {
      requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-002',
    } });
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, 'text');
    assert.equal(JSON.parse(result.content[0].text).ok, true);
    const invalid = await client.callTool({ name: 'resolve_governed_operation', arguments: {
      requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-002', unexpected: true,
    } });
    assert.equal(invalid.content.length, 1);
    assert.deepEqual(JSON.parse(invalid.content[0].text), {
      ok: false, errorCode: 'INVALID_REQUEST', message: 'The request does not match the resolver contract.',
    });
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
