import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson, parseExpect, selfPin, verifyPayload } from '../adopt/pin.js';
import { parseYamlStrict, safeRelativePath } from '../adopt/common.js';

export class RuntimeError extends Error {
  constructor(code) { super(`Runtime foundation blocked: ${code}`); this.code = code; }
}
export const refuse = (code) => { throw new RuntimeError(code); };
export const inside = (root, target) => {
  const rel = path.relative(root, target);
  return rel === '' || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${path.sep}`));
};

// Inspect lexical components before normalization; no symlink is a trusted root.
// Missing descendants may be inspected for store creation, never for reads.
export function safeAbsolute(value, { missing = false } = {}) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || /[\x00-\x1f]/.test(value) ||
      value.split(path.sep).includes('..')) refuse('unsafe-path');
  const normalized = path.normalize(value);
  let cursor = path.parse(normalized).root;
  const parts = normalized.slice(cursor.length).split(path.sep).filter(Boolean);
  for (const [index, part] of parts.entries()) {
    cursor = path.join(cursor, part);
    try {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink() || (index < parts.length - 1 && !stat.isDirectory())) refuse('unsafe-path');
    } catch (error) {
      if (missing && error.code === 'ENOENT') continue;
      throw error;
    }
  }
  return normalized;
}

export function runtimeIdentity(expect) {
  const { version, root } = parseExpect(expect);
  // parseExpect is authoritative for pins; additionally require portable SemVer
  // directory names (it intentionally accepts some non-canonical version labels).
  const numeric = '(?:0|[1-9][0-9]*)';
  if (!new RegExp(`^${numeric}\\.${numeric}\\.${numeric}(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`).test(version) ||
      version.split('+')[0].split('-').slice(1).join('-').split('.').some((part) => /^0[0-9]+$/.test(part))) refuse('invalid-semver');
  return { version, payloadRoot: root, expect, key: `${version}-sha256-${root}` };
}

export function verifyRuntime(packageRoot, expect) {
  const root = safeAbsolute(packageRoot);
  const identity = runtimeIdentity(expect);
  verifyPayload(root, expect);
  if (selfPin(root).expect !== expect) refuse('self-pin-mismatch');
  if (JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).name !== '@dev-foundry/claude-adapter') refuse('wrong-package');
  const manifest = JSON.parse(readFileSync(path.join(root, 'payload-manifest.json'), 'utf8'));
  const names = new Map();
  for (const { path: relative } of manifest.files) {
    if (!safeRelativePath(relative)) refuse('unsafe-payload-path');
    const components = relative.split('/');
    for (let i = 1; i <= components.length; i++) {
      const name = components.slice(0, i).join('/');
      const folded = name.toLowerCase();
      if (names.has(folded) && names.get(folded) !== name) refuse('ambiguous-payload-path');
      names.set(folded, name);
    }
    safeAbsolute(path.join(root, relative));
  }
  return { ...identity, packageRoot: root };
}

export function resolveConsumer(cwd) {
  const selected = safeAbsolute(cwd);
  if (!lstatSync(selected).isDirectory()) refuse('repository-missing');
  const roots = [];
  for (let probe = selected; ; probe = path.dirname(probe)) {
    try {
      const git = lstatSync(path.join(probe, '.git'));
      // Worktree indirection requires a separately validated trust boundary.
      if (!git.isDirectory() || git.isSymbolicLink()) refuse('git-indirection-unsupported');
      for (const item of ['HEAD', 'config', 'objects']) safeAbsolute(path.join(probe, '.git', item));
      roots.push(probe);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (path.dirname(probe) === probe) break;
  }
  if (roots.length !== 1) refuse('repository-ambiguous-or-missing');
  const repositoryRoot = roots[0];
  const file = safeAbsolute(path.join(repositoryRoot, '.mcp.json'));
  const bytes = readFileSync(file);
  const config = JSON.parse(bytes.toString('utf8'));
  // JSON.parse alone silently accepts duplicate server/pin keys.
  const strict = parseYamlStrict(bytes);
  if (!strict || canonicalJson(strict) !== canonicalJson(config)) refuse('ambiguous-mcp');
  const entry = config.mcpServers?.['dev-foundry-governance'];
  if (entry?.type !== 'stdio' || entry.command !== 'dev-foundry-claude' ||
      Object.keys(entry).some((key) => !['type', 'command', 'args'].includes(key)) ||
      !Array.isArray(entry.args) || entry.args.length !== 3 || entry.args[0] !== 'mcp' || entry.args[1] !== '--expect') refuse('invalid-mcp-pin');
  return { repositoryRoot, server: 'dev-foundry-governance', ...runtimeIdentity(entry.args[2]) };
}
