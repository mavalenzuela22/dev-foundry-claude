import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { createSessionGuard } from './session.js';
import { resolveGovernedOperation } from './resolver.js';
import { assessPredelegationReadiness, readinessInputSchema } from './readiness-mcp.js';
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
  instructions: 'Use resolve_governed_operation first to bind one action, task or boundary, project role, and POP-configured authority. Use assess_predelegation_readiness only for optional advisory checks after a fresh implementation resolution. Role IDs, task IDs, Actor Profile paths, and Capability Profile IDs/paths are different values. This local MCP reads authority and reports diagnostics; it grants no permission and dispatches no work. Recoverable caller-input errors may be corrected and retried once; contradictory project authority must stop for Governance Author reconciliation. External host facts remain advisory and belong to the existing Claude Code native/host workflow.',
});

const identifierSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
const strictToolInputSchema = z.object({
  requestedAction: z.enum(['inspect', 'author', 'implement', 'validate', 'audit', 'promote', 'close']).describe('Required operation to resolve.'),
  targetProject: z.string().min(1).describe('Required non-empty target project identifier.'),
  taskId: identifierSchema.optional().describe('Optional task artifact identifier.'),
  boundaryId: identifierSchema.optional().describe('Optional boundary identifier for taskless governance authoring.'),
  requestedRole: z.string().min(1).optional().describe('Optional active project role.'),
  expectedContextFingerprint: z.string().regex(/^[0-9a-f]{64}$/).optional().describe('Optional lowercase SHA-256 fingerprint from a prior resolution.'),
}).strict();

// The MCP SDK validates before calling the tool handler. Keep its public JSON
// Schema strict, but defer runtime validation to resolveGovernedOperation so
// malformed calls receive the DAT-001 result envelope. This Standard Schema
// adapter preserves the original value; the resolver's strict safeParse is
// the sole request enforcement point.
const dat001ToolInputSchema = {
  '~standard': {
    version: 1,
    vendor: 'dev-foundry-claude',
    jsonSchema: strictToolInputSchema['~standard'].jsonSchema,
    validate: (value) => ({ value }),
  },
};

const dat002ToolInputSchema = {
  '~standard': {
    version: 1,
    vendor: 'dev-foundry-claude',
    jsonSchema: readinessInputSchema['~standard'].jsonSchema,
    validate: (value) => ({ value }),
  },
};

async function guardGovernedCall() {
  if (sessionGuard) {
    const denied = await sessionGuard();
    if (denied) return denied;
  }
  if (consumerGuard && (await consumerGuard(projectRoot)).overall !== 'active') {
    return { ok: false, errorCode: 'BINDING_INACTIVE', message: 'Claude role activation is not complete for this project.' };
  }
  return null;
}

function contentResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

for (const topic of Object.keys(helpTopics)) {
  const uri = helpUri(topic);
  server.registerResource(`help-${topic}`, uri, {
    title: `DEV FOUNDRY help: ${topic}`, mimeType: 'text/plain',
    description: 'Read-only explanatory product help; not repository or methodology authority.',
  }, async () => ({ contents: [{ uri, mimeType: 'text/plain', text: renderHelp(topic) }] }));
}

server.registerTool('resolve_governed_operation', {
  title: 'Resolve governed operation',
  description: 'Call first to resolve one action and targetProject with taskId (or boundaryId for taskless authoring); taskId is the routed TSK artifact ID, never an Authority Index route ID. requestedRole, if supplied, is a project role ID such as implementation-executor, never an Actor Profile path or Capability Profile ID/path. Actor and Capability Profile paths come from actor_bindings in the active POP. Success returns current authority references and a context fingerprint; failure returns a DAT-001 error code and recovery message. Correct caller input and retry once; stop on contradictory POP/source authority for Governance Author reconciliation. This local resolver grants no permission and dispatches no work.',
  inputSchema: dat001ToolInputSchema,
}, async (input) => {
  const denied = await guardGovernedCall();
  if (denied) return contentResult(denied);
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
  return contentResult(result);
});

server.registerTool('assess_predelegation_readiness', {
  title: 'Assess predelegation readiness',
  description: 'Optional advisory diagnostic after resolve_governed_operation and before implementation delegation, using a fresh resolution for an implementation taskId and targetProject; taskId is the routed TSK artifact ID, never an Authority Index route ID. It rechecks the POP-bound implementation-executor role and task route, then reports evidence gaps; it cannot authenticate external host facts, Operator authorization, grant permission, or dispatch work. Follow a resolver cause to correct caller input once or stop for Governance Author reconciliation; use the existing Claude Code native/host workflow once for external facts. Never call or await an external runner from this consumer MCP.',
  inputSchema: dat002ToolInputSchema,
}, async (input) => {
  const denied = await guardGovernedCall();
  if (denied) return contentResult({
    outcome: 'BLOCKED', reasonCodes: [denied.errorCode === 'BINDING_INACTIVE' ? 'ACTIVATION_INACTIVE' : denied.errorCode],
    nextActions: [denied.nextAction ?? 'Complete the project-scoped Claude role activation before assessing readiness.'],
    contextFingerprint: null, handoff: null, nonAuthorizing: true, dispatchAllowed: false,
  });
  return contentResult(await assessPredelegationReadiness(input, { projectRoot }));
});

const transport = new StdioServerTransport();
await server.connect(transport);
