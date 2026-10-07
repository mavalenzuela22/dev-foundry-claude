import path from 'node:path';
import { MCP_FILE, MCP_SERVER_NAME, POP_PATH, pathHasSymlink, readContained, readYamlContained } from '../adopt/common.js';
import { canonicalJson, parseExpect, sha256 } from '../adopt/pin.js';

// Only runtime bindings enter this projection. Task content/routes, policies and
// Authority Index authoring are deliberately resolved afresh by the resolver.
export async function sessionProjection(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw new Error('Project root unavailable');
  const pop = await readYamlContained(root, POP_PATH);
  const config = JSON.parse((await readContained(root, MCP_FILE)).toString('utf8'));
  const entry = config.mcpServers?.[MCP_SERVER_NAME];
  if (entry?.command !== 'dev-foundry-claude' || entry.args?.length !== 3 || entry.args[0] !== 'mcp' || entry.args[1] !== '--expect') throw new Error('Pin unavailable');
  parseExpect(entry.args[2]);
  if (pop?.status !== 'active' || !pop.framework || !pop.actor_bindings || !pop.platform_bootstraps) throw new Error('Runtime authority unavailable');
  const identities = {};
  const include = async (file) => {
    if (await pathHasSymlink(root, file)) throw new Error('Unsafe runtime authority path');
    const data = await readYamlContained(root, file);
    if (!data) throw new Error('Runtime authority unavailable');
    identities[file] = data;
  };
  const framework = { adopted_version: pop.framework.adopted_version, selected_authority_index: pop.framework.selected_authority_index, selected_manifest: pop.framework.selected_manifest, adoption_status: pop.framework.adoption_status };
  // Immutable framework manifest identifies its bytes; ordinary project routes
  // are not part of this session identity.
  await include(framework.selected_manifest);
  await include(framework.selected_authority_index);
  const actorBindings = Object.fromEntries(Object.entries(pop.actor_bindings).filter(([, binding]) => binding.status === 'active'));
  for (const binding of Object.values(actorBindings)) {
    await include(binding.profile);
    for (const file of binding.capability_profiles ?? []) await include(file);
  }
  const bootstraps = Object.fromEntries(Object.entries(pop.platform_bootstraps).filter(([, binding]) => binding.status === 'active'));
  for (const binding of Object.values(bootstraps)) await include(binding.path);
  return { adapterPin: entry.args[2], project: pop.repository?.name, framework, actorBindings, bootstraps, identities };
}

export async function createSessionGuard(root, expectedRuntimePin) {
  let startup = null;
  try { const projection = await sessionProjection(root); if (expectedRuntimePin && projection.adapterPin !== expectedRuntimePin) throw new Error('Runtime pin mismatch'); startup = sha256(canonicalJson(projection)); } catch { /* unavailable runtime fails closed */ }
  let stale = false;
  return async () => {
    try { if (!startup || sha256(canonicalJson(await sessionProjection(root))) !== startup) stale = true; } catch { stale = true; }
    return stale ? { ok: false, errorCode: 'STALE_SESSION', message: 'This Claude session belongs to an earlier or unavailable project runtime. Start a fresh session before continuing governed work.', nextAction: 'dev-foundry-claude start' } : null;
  };
}
