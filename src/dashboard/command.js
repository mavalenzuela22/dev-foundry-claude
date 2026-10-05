import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { verifyPayload } from '../adopt/pin.js';
import { safeFile } from '../../tools/dashboard/server/evidence.mjs';
import { launchDashboard } from '../../tools/dashboard/server/launch.mjs';

export async function dashboardCommand({ argv, packageRoot, cwd = process.cwd() }) {
  const options = {};
  const invalid = () => {
    const error = new Error('Usage: dev-foundry-claude dashboard --port <1024-65535> [--root <consumer-repo>]');
    error.exitCode = 2;
    throw error;
  };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!['--port', '--root'].includes(key) || Object.hasOwn(options, key) || !value || value.startsWith('--')) invalid();
    options[key] = value;
  }
  const port = Number(options['--port']);
  if (!/^\d+$/.test(options['--port'] ?? '') || !Number.isInteger(port) || port < 1024 || port > 65535) invalid();
  const selected = path.resolve(cwd, options['--root'] ?? '.');
  // Directory selection, not ambient Git repository overrides, owns the root.
  const gitEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE'].includes(key)));
  const top = spawnSync('git', ['-C', selected, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', env: gitEnv });
  if (top.status !== 0 || !top.stdout.trim()) throw new Error('Dashboard requires a consumer git repository.');
  const root = realpathSync(top.stdout.trim());
  try {
    const pop = parse(await safeFile(root, '.dev-foundry/profiles/project-operating-profile.yaml'));
    if (pop?.schema_version !== 'dev-foundry.project-operating-profile.v2' || !pop.repository?.name) throw new Error();
  } catch { throw new Error('Dashboard requires a DEV FOUNDRY consumer project operating profile.'); }
  // Use the consumer's immutable adapter expectation, as mcp/run do. Preparation
  // suffices for this observational view; it grants no governed role authority.
  try {
    const entry = JSON.parse(await safeFile(root, '.mcp.json')).mcpServers?.['dev-foundry-governance'];
    if (entry?.command !== 'dev-foundry-claude' || entry.args?.length !== 3 || entry.args[0] !== 'mcp' || entry.args[1] !== '--expect') throw new Error();
    verifyPayload(packageRoot, entry.args[2]);
  } catch { throw new Error('Adapter runtime verification failed.'); }
  return launchDashboard({ root, uiRoot: path.join(packageRoot, 'tools/dashboard/dist'), port });
}
