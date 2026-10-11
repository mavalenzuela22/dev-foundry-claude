import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { authoritySnapshot } from '../runtime/plan.js';
import { assertPackageSelected } from '../runtime/resolver.js';
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

// Read-only identity observation is available during pending cutover. It does
// not bypass the existing session/activation guards on governed tool calls.
const runtimeSessionId = randomUUID();
const packageRoot = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '');
server.registerResource('runtime-identity', 'dev-foundry://runtime/identity', {
  title: 'Selected runtime identity', mimeType: 'application/json',
  description: 'Read-only fresh process identity; grants no governed authority.',
}, async () => {
  const selected = assertPackageSelected({ cwd: projectRoot, packageRoot,
    expect: globalThis[Symbol.for('dev-foundry-claude.consumer-runtime-pin')], pendingMcp: true });
  const authority = authoritySnapshot(selected.repositoryRoot);
  const activation = await (consumerGuard ?? (await import('../adopt/activation.js')).evaluateActivation)(selected.repositoryRoot);
  return { contents: [{ uri: 'dev-foundry://runtime/identity', mimeType: 'application/json', text: JSON.stringify({
    format: 'dev-foundry.runtime-identity.v1', sessionId: runtimeSessionId, pid: process.pid,
    probe: process.env.DEV_FOUNDRY_RUNTIME_PROBE ?? null, repositoryRoot: selected.repositoryRoot,
    packageRoot: selected.runtime.packageRoot, pin: selected.expect, authority: authority.fingerprint, activation: activation.overall,
    journalState: selected.journal.state, planSha256: selected.journal.planSha256 ?? null,
  }) }] };
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
