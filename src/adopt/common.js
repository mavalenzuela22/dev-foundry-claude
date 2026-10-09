import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';
import { canonicalJson, sha256 } from './pin.js';

// Runtime transaction data is deliberately outside .dev-foundry authority routing.
export const CUTOVER_DIR = '.dfc-cutover';

// Keep pre-manager adoption/bootstrap imports usable in bounded legacy trees.
// Absence is proven at the directory boundary; once any journal path exists,
// unavailable manager code or unreadable/partial state must block, not fall back.
export async function runtimeUpgradeState(root) {
  try {
    const info = await lstat(path.join(root, '.dfc-runtime-upgrade'));
    if (!info.isDirectory() || await pathHasSymlink(root, '.dfc-runtime-upgrade')) return { state: 'unknown', blocked: true, epoch: null };
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'none', blocked: false, epoch: null };
    return { state: 'unknown', blocked: true, epoch: null };
  }
  try {
    const { runtimeUpgradeStatus } = await import('../runtime/journal.js');
    return runtimeUpgradeStatus(await realpath(root));
  } catch { return { state: 'unknown', blocked: true, epoch: null }; }
}

export function safeRelativePath(value) {
  return typeof value === 'string' && value.length > 0 && !/[\\:\x00-\x1f]/.test(value) &&
    !path.posix.isAbsolute(value) && !path.win32.isAbsolute(value) &&
    value.split('/').every((part) => part !== '' && part !== '.' && part !== '..' &&
      !/[. ]$/.test(part) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}

// Unknown/truncated state blocks startup. Preparation alone never claims authority.
export async function cutoverState(root) {
  try {
    const info = await lstat(path.join(root, CUTOVER_DIR));
    if (!info.isDirectory() || await pathHasSymlink(root, CUTOVER_DIR)) throw new Error();
    const bytes = await readContained(root, `${CUTOVER_DIR}/intent.json`);
    const intent = JSON.parse(bytes.toString('utf8'));
    if (intent.format !== 'dev-foundry.cutover-intent.v1' || intent.plan?.planFormat !== 'dev-foundry.cutover-plan.v1' ||
        intent.plan.status !== 'ready' || !Array.isArray(intent.plan.files) ||
        sha256(canonicalJson(intent.plan)) !== intent.planSha256) throw new Error();
    const recordOk = async (file, expected, required = false) => {
      if (await pathHasSymlink(root, `${CUTOVER_DIR}/${file}`)) throw new Error();
      const data = await readContained(root, `${CUTOVER_DIR}/${file}`);
      if ((!data && required) || (data && !data.equals(Buffer.from(canonicalJson(expected))))) throw new Error();
      return Boolean(data);
    };
    const prepared = await recordOk('prepared.json', { planSha256: intent.planSha256 });
    const names = new Set(['locks', 'intent.json', 'prepared.json', 'commit.json', 'resolution.json', 'done.json']);
    const popFile = intent.plan.files.find((file) => file.path === POP_PATH);
    const barrier = parseDocument(popFile.before);
    barrier.set('status', 'cutover-in-progress');
    const barrierHash = sha256(barrier.toString({ lineWidth: 0 }));
    for (const [i, file] of intent.plan.files.entries()) {
      for (const [name, content, hash] of [['backup', file.before, file.before_sha256], ['target', file.after, file.after_sha256]]) {
        const record = `${name}-${i}.json`;
        names.add(record);
        await recordOk(record, { path: file.path, content, sha256: hash }, prepared);
      }
      for (const hash of [file.before_sha256, file.after_sha256, ...(file.path === POP_PATH ? [barrierHash] : [])]) {
        if (hash === 'absent') continue;
        names.add(`install-${i}-${hash}.bytes`);
        names.add(`displaced-${i}-${hash}.bytes`);
      }
    }
    for (const name of [...names]) if (name !== 'locks') names.add(name + '.pending');
    for (const name of await readdir(path.join(root, CUTOVER_DIR))) {
      if (!names.has(name) && !/^record-fragment-[0-9a-f]{64}\.bytes$/.test(name)) throw new Error();
      if (await pathHasSymlink(root, `${CUTOVER_DIR}/${name}`)) throw new Error();
    }
    for (const file of ['intent.json', 'commit.json', 'done.json', 'resolution.json', 'prepared.json']) {
      if (await pathHasSymlink(root, `${CUTOVER_DIR}/${file}`)) throw new Error();
    }
    const commit = await readContained(root, `${CUTOVER_DIR}/commit.json`);
    const done = await readContained(root, `${CUTOVER_DIR}/done.json`);
    if (commit && !commit.equals(Buffer.from(canonicalJson({ planSha256: intent.planSha256, restartRequired: true })))) throw new Error();
    if (done) {
      const result = JSON.parse(done.toString('utf8'));
      if (!prepared || !commit || result.planSha256 !== intent.planSha256 || !['source', 'target'].includes(result.outcome) ||
          !done.equals(Buffer.from(canonicalJson(result)))) throw new Error();
      await recordOk('resolution.json', { planSha256: intent.planSha256, outcome: result.outcome });
      return { status: result.outcome === 'target' ? 'complete' : 'rolled-back', blocked: false, epoch: sha256(commit), planSha256: intent.planSha256 };
    }
    if (commit) return { status: 'in-flight', blocked: true, epoch: sha256(commit), planSha256: intent.planSha256 };
    return { status: 'prepared', blocked: false, epoch: null, planSha256: intent.planSha256 };
  } catch (error) {
    if (error.code === 'ENOENT') return { status: 'none', blocked: false, epoch: null };
    return { status: 'unknown', blocked: true, epoch: null };
  }
}

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
