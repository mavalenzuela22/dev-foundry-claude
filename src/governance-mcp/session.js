import { stat } from 'node:fs/promises';
import path from 'node:path';
import { INDEX_PATH, MCP_FILE, MCP_SERVER_NAME, POP_PATH, cutoverState, isObject, pathHasSymlink, readContained, readYamlContained, safeRelativePath } from '../adopt/common.js';
import { canonicalJson, parseExpect, sha256 } from '../adopt/pin.js';
import { markTargetSessionStarted, runtimeUpgradeState } from '../adopt/runtime.js';

const diagnostics = {
  PROJECT_CONTEXT_UNAVAILABLE: {
    message: 'The MCP host has not supplied an available absolute project directory.',
    nextAction: 'Configure the MCP host to supply CLAUDE_PROJECT_DIR as the absolute project repository directory, then start a fresh project-bound Claude Desktop or Claude Code session. If the host cannot supply this binding, use a host that can.',
  },
  RUNTIME_RECOVERY_REQUIRED: {
    message: 'The runtime upgrade journal requires explicit recovery before governed work can continue.',
    nextAction: 'Inspect dev-foundry-claude upgrade status --root <project>. Only after verifying the journal, exact plan SHA-256 and source or target choice, use dev-foundry-claude upgrade recover --root <project> --plan-sha256 <verified-hash> --outcome source|target. Do not delete journals or recover automatically.',
  },
  CUTOVER_RECOVERY_REQUIRED: {
    message: 'The authority cutover is incomplete or unsafe and requires recovery.',
    nextAction: 'Inspect dev-foundry-claude cutover status --root <project> --json and follow the existing explicit, authorized cutover recovery procedure. Preserve the journal.',
  },
  RUNTIME_BINDING_INVALID: {
    message: 'The project runtime binding is missing, invalid or unsafe.',
    nextAction: 'Inspect the project POP, MCP pin, selected framework, actor profiles and bootstrap bindings through the governed project process. After correcting the binding, start a fresh project-bound Claude Desktop or Claude Code session.',
  },
  STALE_SESSION: {
    message: 'The project runtime identity changed after this MCP session was established.',
    nextAction: 'Start a fresh Claude Desktop or Claude Code session bound to this project and its selected runtime, then resolve current authority again.',
  },
};

class SessionBindingError extends Error {
  constructor(code) { super(diagnostics[code].message); this.code = code; }
}
const deny = (code) => ({ ok: false, errorCode: code, ...diagnostics[code] });
const bindingFailure = (error) => deny(error instanceof SessionBindingError ? error.code : 'RUNTIME_BINDING_INVALID');

// Only runtime bindings enter this projection. Task content/routes, policies and
// Authority Index authoring are deliberately resolved afresh by the resolver.
export async function sessionProjection(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root) || !await stat(root).then((info) => info.isDirectory(), () => false)) {
    throw new SessionBindingError('PROJECT_CONTEXT_UNAVAILABLE');
  }
  const cutover = await cutoverState(root);
  if (cutover.blocked) throw new SessionBindingError('CUTOVER_RECOVERY_REQUIRED');
  if ((await runtimeUpgradeState(root)).blocked) throw new SessionBindingError('RUNTIME_RECOVERY_REQUIRED');
  if (await pathHasSymlink(root, POP_PATH) || await pathHasSymlink(root, MCP_FILE)) throw new Error('Unsafe runtime authority path');
  const pop = await readYamlContained(root, POP_PATH);
  const config = JSON.parse((await readContained(root, MCP_FILE)).toString('utf8'));
  const entry = config.mcpServers?.[MCP_SERVER_NAME];
  if (entry?.command !== 'dev-foundry-claude' || !Array.isArray(entry.args) || entry.args.length !== 3 || entry.args[0] !== 'mcp' || entry.args[1] !== '--expect') throw new Error('Pin unavailable');
  parseExpect(entry.args[2]);
  if (pop?.status !== 'active' || !isObject(pop.framework) || !isObject(pop.actor_bindings) || !isObject(pop.platform_bootstraps) ||
      typeof pop.repository?.name !== 'string' || !pop.repository.name.trim() ||
      typeof pop.framework.adopted_version !== 'string' || !pop.framework.adopted_version || pop.framework.adoption_status !== 'active') throw new Error('Runtime authority unavailable');
  const identities = {};
  const include = async (file) => {
    if (!safeRelativePath(file) || await pathHasSymlink(root, file)) throw new Error('Unsafe runtime authority path');
    const data = await readYamlContained(root, file);
    if (!data) throw new Error('Runtime authority unavailable');
    identities[file] = data;
  };
  const framework = { adopted_version: pop.framework.adopted_version, selected_authority_index: pop.framework.selected_authority_index, selected_manifest: pop.framework.selected_manifest, adoption_status: pop.framework.adoption_status };
  // Immutable framework manifest identifies its bytes; ordinary project routes
  // are not part of this session identity.
  await include(framework.selected_manifest);
  await include(framework.selected_authority_index);
  const actorBindings = Object.fromEntries(Object.entries(pop.actor_bindings).filter(([, binding]) => binding?.status === 'active'));
  if (!Object.keys(actorBindings).length) throw new Error('Runtime actors unavailable');
  for (const binding of Object.values(actorBindings)) {
    await include(binding.profile);
    if (binding.capability_profiles !== undefined && !Array.isArray(binding.capability_profiles)) throw new Error('Runtime capabilities invalid');
    for (const file of binding.capability_profiles ?? []) await include(file);
  }
  const bootstraps = Object.fromEntries(Object.entries(pop.platform_bootstraps).filter(([, binding]) => binding?.status === 'active'));
  if (!Object.keys(bootstraps).length) throw new Error('Runtime bootstrap unavailable');
  for (const binding of Object.values(bootstraps)) await include(binding.path);
  if (await pathHasSymlink(root, INDEX_PATH)) throw new Error('Unsafe runtime authority path');
  const index = await readYamlContained(root, INDEX_PATH);
  if (index?.status !== 'active') throw new Error('Runtime routes unavailable');
  const runtimePaths = new Set([POP_PATH, ...Object.keys(identities)]);
  const runtimeRoutes = [...(index.routes ?? []), ...(index.bindings ?? [])].filter((route) => runtimePaths.has(route.path));
  return { adapterPin: entry.args[2], cutoverEpoch: cutover.epoch, project: pop.repository?.name, framework, actorBindings, bootstraps, runtimeRoutes, identities };
}

export async function createSessionGuard(root, expectedRuntimePin) {
  let startup = null;
  let startupDenial = null;
  try {
    const projection = await sessionProjection(root);
    if (expectedRuntimePin && projection.adapterPin !== expectedRuntimePin) throw new Error('Runtime pin mismatch');
    await markTargetSessionStarted(root, projection.adapterPin);
    startup = sha256(canonicalJson(projection));
  } catch (error) { startupDenial = bindingFailure(error); }
  let stale = false;
  return async () => {
    // An instance that never bound successfully cannot silently adopt a later
    // runtime. Recovery requires a fresh, independently bound session.
    if (startupDenial) return startupDenial;
    try {
      if (sha256(canonicalJson(await sessionProjection(root))) !== startup) stale = true;
    } catch (error) { return bindingFailure(error); }
    return stale ? deny('STALE_SESSION') : null;
  };
}
