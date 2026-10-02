import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';

export const POP_PATH = '.dev-foundry/profiles/project-operating-profile.yaml';
export const INDEX_PATH = '.dev-foundry/authority-index.yaml';
export const SUPPORTED_FRAMEWORK = '2.1.0';
export const ROLES = ['governance-author', 'implementation-executor', 'governance-auditor', 'mechanical-validator', 'evidence-custodian'];

export const AGENT_PATHS = {
  executor: '.claude/agents/dev-foundry-executor.md',
  auditor: '.claude/agents/dev-foundry-auditor.md',
};
export const PROFILE_PATHS = {
  executor: '.dev-foundry/profiles/capability-profiles/implementation-executor-claude-code-v2.yaml',
  auditor: '.dev-foundry/profiles/capability-profiles/governance-auditor-claude-code-v1.yaml',
};
export const BOOTSTRAP_PATH = '.dev-foundry/platform-bootstrap-claude-code.yaml';
export const BOOTSTRAP_KEY = 'claude-code-governance-agent';
export const IGNORE_FILE = '.dev-foundry/.gitignore';
export const MCP_FILE = '.mcp.json';
export const CLAUDE_MD = 'CLAUDE.md';
export const MCP_SERVER_NAME = 'dev-foundry-governance';

// Section 5.8: target Claude implementation per role.
export const TARGETS = {
  'governance-author': { kind: 'agent', identity: 'claude-main-agent', platform: 'claude-code', capabilities: [] },
  'implementation-executor': { kind: 'agent', identity: 'dev-foundry-executor', platform: 'claude-code', capabilities: [PROFILE_PATHS.executor] },
  'governance-auditor': { kind: 'agent', identity: 'dev-foundry-auditor', platform: 'claude-code', capabilities: [PROFILE_PATHS.auditor] },
  'mechanical-validator': { kind: 'tool', identity: 'claude-code-native-validation', platform: 'claude-code', capabilities: [] },
  'evidence-custodian': { kind: 'agent', identity: 'claude-main-agent', platform: 'claude-code', capabilities: [] },
};

export const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function parseYamlStrict(bytes) {
  const document = parseDocument(bytes.toString('utf8'), { uniqueKeys: true, prettyErrors: false });
  if (document.errors.length || document.warnings.length) return null;
  const value = document.toJS();
  return isObject(value) ? value : null;
}

const inside = (root, target) => {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

// Root-contained read with the resolver's rules: no absolute paths, no escape through symlinks.
// Returns null when the file is absent, unreadable, or outside the root.
export async function readContained(root, relativePath) {
  try {
    if (typeof relativePath !== 'string' || path.isAbsolute(relativePath)) return null;
    const absolute = path.resolve(root, relativePath);
    if (!inside(path.resolve(root), absolute)) return null;
    const canonicalRoot = await realpath(root);
    const canonicalFile = await realpath(absolute);
    if (!inside(canonicalRoot, canonicalFile)) return null;
    return await readFile(canonicalFile);
  } catch {
    return null;
  }
}

export async function readYamlContained(root, relativePath) {
  const bytes = await readContained(root, relativePath);
  return bytes === null ? null : parseYamlStrict(bytes);
}

// Walks every component below the root; symlinks anywhere on a generated path are refused.
export async function pathHasSymlink(root, relativePath) {
  const parts = relativePath.split('/');
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      return true;
    }
  }
  return false;
}
