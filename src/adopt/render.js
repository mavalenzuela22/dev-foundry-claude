import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_PATHS, BOOTSTRAP_PATH, PROFILE_PATHS } from './common.js';

const templateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../templates');
export const BLOCK_BEGIN = '<!-- DEV-FOUNDRY-CLAUDE-ADAPTER:BEGIN';
export const BLOCK_END = '<!-- DEV-FOUNDRY-CLAUDE-ADAPTER:END -->';

export function renderTemplate(name, params) {
  const text = readFileSync(path.join(templateRoot, name), 'utf8');
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

export function renderAgents(params) {
  return {
    [AGENT_PATHS.executor]: renderTemplate('agents/dev-foundry-executor.md.tmpl', params),
    [AGENT_PATHS.auditor]: renderTemplate('agents/dev-foundry-auditor.md.tmpl', params),
  };
}

export function renderProfiles(params) {
  return {
    [PROFILE_PATHS.executor]: renderTemplate('capability-profiles/implementation-executor-claude-code-v2.yaml.tmpl', params),
    [PROFILE_PATHS.auditor]: renderTemplate('capability-profiles/governance-auditor-claude-code-v1.yaml.tmpl', params),
  };
}

export const renderBootstrap = (params) => ({ [BOOTSTRAP_PATH]: renderTemplate('platform-bootstrap-claude-code.yaml.tmpl', params) });
export const renderClaudeBlock = (params) => renderTemplate('claude-md-block.md.tmpl', params);
export const renderMcpEntry = (params) => JSON.parse(renderTemplate('mcp-entry.json.tmpl', params));
