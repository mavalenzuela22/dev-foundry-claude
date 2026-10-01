import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { makeProject } from './fixture.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverPath = path.join(repoRoot, 'src/governance-mcp/server.js');

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
