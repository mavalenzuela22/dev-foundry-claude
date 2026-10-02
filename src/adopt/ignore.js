import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const IGNORE_LINE = '/telemetry/local/';
export const PROBE_PATH = '.dev-foundry/telemetry/local/x.ndjson';

// Repository-local ignore state only: global and system excludes are disabled.
export function gitEnv() {
  return { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0' };
}

export function git(root, args) {
  return spawnSync('git', ['-c', 'core.excludesFile=', '-C', root, ...args], { encoding: 'utf8', env: gitEnv() });
}

export const isIgnored = (root, relativePath) => git(root, ['check-ignore', '-q', '--no-index', '--', relativePath]).status === 0;

// Simulates the post-change ignore state in a throwaway repository that carries the same local
// rule sources (root .gitignore, .git/info/exclude) so a re-including negation is detected.
function simulate(root, afterText, { lowRule = null } = {}) {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'dfc-ignore-'));
  try {
    if (git(scratch, ['init', '-q']).status !== 0) return false;
    mkdirSync(path.join(scratch, '.dev-foundry'), { recursive: true });
    writeFileSync(path.join(scratch, '.dev-foundry/.gitignore'), afterText);
    if (lowRule !== null) {
      writeFileSync(path.join(scratch, '.gitignore'), lowRule);
    } else {
      const rootIgnore = path.join(root, '.gitignore');
      if (existsSync(rootIgnore)) copyFileSync(rootIgnore, path.join(scratch, '.gitignore'));
      const exclude = path.join(root, '.git/info/exclude');
      if (existsSync(exclude)) copyFileSync(exclude, path.join(scratch, '.git/info/exclude'));
    }
    return isIgnored(scratch, PROBE_PATH);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

// existing: current .dev-foundry/.gitignore text or null. Returns { state, after }.
// state: 'ok' (already ignored), 'needed', or 'blocked' (a rule re-includes the write path).
export function planIgnore(root, existing) {
  if (isIgnored(root, PROBE_PATH)) return { state: 'ok', after: existing };
  // A rule already present that re-includes the write path (it would override a lower-precedence ignore).
  if (existing !== null && !simulate(root, existing, { lowRule: '/.dev-foundry/telemetry/*\n' })) return { state: 'blocked', after: null };
  const base = existing === null ? '' : existing.length === 0 || existing.endsWith('\n') ? existing : `${existing}\n`;
  const after = `${base}${IGNORE_LINE}\n`;
  return simulate(root, after) ? { state: 'needed', after } : { state: 'blocked', after: null };
}
