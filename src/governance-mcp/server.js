import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { createSessionGuard } from './session.js';
import { resolveGovernedOperation } from './resolver.js';
import { writeOperationMarker } from '../telemetry/telemetry.js';
import { helpTopics, helpUri, renderHelp } from '../consumer/help.js';

const projectRoot = process.env.CLAUDE_PROJECT_DIR;
// Opt-in consumer-mode activation guard (SPC-001 section 13). Only the packaged `mcp` entry sets this
// in-process switch; source-run launch leaves it off and behaves exactly as before.
const consumerGuard = globalThis[Symbol.for('dev-foundry-claude.consumer-mode-guard')] === true
  ? (await import('../adopt/activation.js')).evaluateActivation
  : null;
const sessionGuard = consumerGuard ? await createSessionGuard(projectRoot, globalThis[Symbol.for('dev-foundry-claude.consumer-runtime-pin')]) : null;
const server = new McpServer({
  name: 'dev-foundry-governance',
  version: '1.0.0',
  instructions: 'Use this server to resolve one bounded DEV FOUNDRY operation and its current authority references.',
});

for (const topic of Object.keys(helpTopics)) {
  const uri = helpUri(topic);
  server.registerResource(`help-${topic}`, uri, {
    title: `DEV FOUNDRY help: ${topic}`, mimeType: 'text/plain',
    description: 'Read-only explanatory product help; not repository or methodology authority.',
  }, async () => ({ contents: [{ uri, mimeType: 'text/plain', text: renderHelp(topic) }] }));
}

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
  if (sessionGuard) {
    const denied = await sessionGuard();
    if (denied) return { content: [{ type: 'text', text: JSON.stringify(denied) }] };
  }
  if (consumerGuard && (await consumerGuard(projectRoot)).overall !== 'active') {
    const denied = { ok: false, errorCode: 'BINDING_INACTIVE', message: 'Claude role activation is not complete for this project.' };
    return { content: [{ type: 'text', text: JSON.stringify(denied) }] };
  }
  const result = await resolveGovernedOperation(input, { projectRoot });
  if (result.ok === true && process.env.DEV_FOUNDRY_TELEMETRY_RUN_ID && process.env.DEV_FOUNDRY_TELEMETRY_DIR) {
    const { resolution } = result;
    try {
      await writeOperationMarker({
        requestedAction: resolution.requestedAction,
        targetProject: resolution.targetProject,
        taskId: resolution.taskId,
        boundaryId: resolution.boundaryId,
        selectedRoleId: resolution.role.id,
        actorProfilePath: resolution.role.actorProfilePath,
        capabilityProfilePaths: resolution.role.capabilityProfilePaths,
        contextFingerprint: resolution.contextFingerprint,
      });
    } catch {
      console.error('Governance telemetry operation marker could not be written.');
    }
  }
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
