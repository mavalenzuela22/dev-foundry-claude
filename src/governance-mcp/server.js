import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { resolveGovernedOperation } from './resolver.js';

const projectRoot = process.env.CLAUDE_PROJECT_DIR;
const server = new McpServer({
  name: 'dev-foundry-governance',
  version: '1.0.0',
  instructions: 'Use this server to resolve one bounded DEV FOUNDRY operation and its current authority references.',
});

server.registerTool('resolve_governed_operation', {
  title: 'Resolve governed operation',
  description: 'Resolve role, authority references, lifecycle routing, and a context fingerprint. Inputs are checked strictly; unknown fields are rejected.',
  inputSchema: z.object({
    requestedAction: z.unknown().optional().describe('Required: inspect, author, implement, validate, audit, promote, or close.'),
    targetProject: z.unknown().optional().describe('Required: non-empty target project identifier.'),
    taskId: z.unknown().optional().describe('Optional task artifact identifier.'),
    boundaryId: z.unknown().optional().describe('Optional taskless governance boundary identifier.'),
    requestedRole: z.unknown().optional().describe('Optional active project role.'),
    expectedContextFingerprint: z.unknown().optional().describe('Optional lowercase SHA-256 fingerprint from a prior resolution.'),
  }).passthrough(),
}, async (input) => {
  const result = await resolveGovernedOperation(input, { projectRoot });
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
