import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_PATHS, BOOTSTRAP_PATH, PROFILE_PATHS } from './common.js';

const templateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../templates');
export const BLOCK_BEGIN = '<!-- DEV-FOUNDRY-CLAUDE-ADAPTER:BEGIN';
export const BLOCK_END = '<!-- DEV-FOUNDRY-CLAUDE-ADAPTER:END -->';

export function renderTemplate(name, params, sourceRoot = templateRoot) {
  const text = readFileSync(path.join(sourceRoot, name), 'utf8');
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (typeof params[key] !== 'string') throw new Error(`Missing template parameter ${key}.`);
    return params[key];
  });
}

export const projectSlug = (project) => project.replace(/[^A-Za-z0-9]/g, '_');

// params: project, prefix, executorProfileId, auditorProfileId, authorProfile, custodianProfile
export function templateParams({ project, prefix, executorProfileId, auditorProfileId, authorProfile = '', custodianProfile = '', expect = '' }) {
  return {
    PROJECT: project,
    PROJECT_SLUG: projectSlug(project),
    PREFIX: prefix,
    EXECUTOR_ACTOR_PROFILE_ID: executorProfileId,
    AUDITOR_ACTOR_PROFILE_ID: auditorProfileId,
    AUTHOR_PROFILE: authorProfile,
    CUSTODIAN_PROFILE: custodianProfile,
    EXPECT: expect,
  };
}

export function renderAgents(params, sourceRoot) {
  return {
    [AGENT_PATHS.executor]: renderTemplate('agents/dev-foundry-executor.md.tmpl', params, sourceRoot),
    [AGENT_PATHS.auditor]: renderTemplate('agents/dev-foundry-auditor.md.tmpl', params, sourceRoot),
  };
}

export function renderProfiles(params, sourceRoot) {
  return {
    [PROFILE_PATHS.executor]: renderTemplate('capability-profiles/implementation-executor-claude-code-v2.yaml.tmpl', params, sourceRoot),
    [PROFILE_PATHS.auditor]: renderTemplate('capability-profiles/governance-auditor-claude-code-v1.yaml.tmpl', params, sourceRoot),
  };
}

export function renderBootstrap(params, sourceRoot, { legacyV2 = false } = {}) {
  let content = renderTemplate('platform-bootstrap-claude-code.yaml.tmpl', params, sourceRoot);
  if (legacyV2) {
    content = content.replace('schema_version: dev-foundry.platform-bootstrap.v3', 'schema_version: dev-foundry.platform-bootstrap.v2')
      .replace('    - operation-specific implementation selection, capability fit, and authorization must be evidenced outside the POP role binding\n', '')
      .replace('  - v3 POP role bindings contain policy and capability requirements, not concrete implementation identity\n  - bootstrap platform identity describes startup only and grants no role or operation\n', '  - concrete implementation bindings are owned by the v2 Project Operating Profile\n')
      .replace('  - the Governance Author delegates implementation only with a current compact handoff and existing native permission checks\n  - the Auditor is selected only when a named independent-review trigger applies and eligibility is evidenced\n', '  - implementation-executor and governance-auditor bindings are checked against the active v2 project roles before dispatch\n');
  }
  return { [BOOTSTRAP_PATH]: content };
}
export const renderClaudeBlock = (params, sourceRoot) => renderTemplate('claude-md-block.md.tmpl', params, sourceRoot);
export const renderMcpEntry = (params, sourceRoot) => JSON.parse(renderTemplate('mcp-entry.json.tmpl', params, sourceRoot));
