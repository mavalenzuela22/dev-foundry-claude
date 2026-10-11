import { randomUUID } from 'node:crypto';
import { assertPackageSelected } from '../runtime/resolver.js';
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { verifyPayload } from '../adopt/pin.js';
import { safeFile } from '../../tools/dashboard/server/evidence.mjs';
import { launchDashboard } from '../../tools/dashboard/server/launch.mjs';

export async function dashboardCommand({ argv, packageRoot, cwd = process.cwd(), inspect = inspectDashboard, launch = launchDashboard }) {
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
  const selectedRuntime = assertPackageSelected({ cwd: root, packageRoot });
  const listener = await inspect({ root, expect: selectedRuntime.expect, port });
  if (listener.state !== 'absent') {
    const error = new Error(`Dashboard restart-required: ${listener.state}. ${listener.owned ? `Use the owning terminal for dashboard PID ${listener.identity.pid} in ${listener.identity.repositoryRoot}, then relaunch the selected pin.` : 'Listener ownership is unavailable; select another explicit local port.'} No process was terminated.`);
    error.code = 'dashboard-restart-required'; throw error;
  }
  const server = await launch({ root, uiRoot: path.join(packageRoot, 'tools/dashboard/dist'), port });
  const handlers = server.listeners('request'); server.removeAllListeners('request');
  const instance = randomUUID();
  server.on('request', (req, res) => {
    if ((req.url ?? '').split('?')[0] !== '/api/runtime/identity') {
      for (const handler of handlers) handler.call(server, req, res);
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method) || req.headers.host !== `127.0.0.1:${port}`) {
      res.writeHead(403); res.end(); return;
    }
    let status = 'selected';
    try { assertPackageSelected({ cwd: root, packageRoot, expect: selectedRuntime.expect }); } catch { status = 'restart-required'; }
    res.writeHead(status === 'selected' ? 200 : 409, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ format: 'dev-foundry.dashboard-runtime.v1', status, pid: process.pid,
      instance, repositoryRoot: root, packageRoot: selectedRuntime.runtime.packageRoot, pin: selectedRuntime.expect,
      uiRoot: path.join(selectedRuntime.runtime.packageRoot, 'tools/dashboard/dist') }));
  });
  return server;
}


// Read-only loopback observation. A matching JSON response identifies a product
// listener, not permission to signal a PID. No process manager is introduced.
export async function inspectDashboard({ root, expect, port, request = fetch }) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Provide an explicit local port between 1024 and 65535.');
  try {
    const response = await request(`http://127.0.0.1:${port}/api/runtime/identity`, { signal: AbortSignal.timeout(1500), redirect: 'error' });
    let identity;
    try {
      if (response.body) {
        let length = 0; const chunks = [];
        for await (const chunk of response.body) {
          length += chunk.length;
          if (length > 16384) throw new Error('Unbounded listener identity');
          chunks.push(Buffer.from(chunk));
        }
        identity = JSON.parse(Buffer.concat(chunks).toString());
      } else identity = await response.json(); // injected read-only fixture
    } catch { return { state: 'occupied-unknown', owned: false }; }
    if (identity.format !== 'dev-foundry.dashboard-runtime.v1' || identity.repositoryRoot !== root || !Number.isSafeInteger(identity.pid) || identity.pid < 1 || typeof identity.instance !== 'string' || !identity.instance || typeof identity.packageRoot !== 'string') return { state: 'occupied-unknown', owned: false };
    return { state: identity.pin === expect && identity.status === 'selected' ? 'owned-selected-restart-required' : 'owned-old-restart-required', owned: true, identity };
  } catch (error) {
    return { state: error.cause?.code === 'ECONNREFUSED' ? 'absent' : 'occupied-unknown', owned: false };
  }
}
