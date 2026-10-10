import { lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { refuse, safeAbsolute } from './identity.js';
import { resolveRuntime } from './resolver.js';

// Closed entrypoint inventory only; no arbitrary argv, shell command, child
// process, listener management or authority mutation. B3 owns live integration.
export function dispatchPlan(options) {
  const selection = resolveRuntime(options);
  const root = selection.runtime.packageRoot;
  const manifest = JSON.parse(readFileSync(path.join(root, 'payload-manifest.json'), 'utf8'));
  const listed = new Set(manifest.files.map((entry) => entry.path));
  const file = (relative) => {
    if (!listed.has(relative)) refuse('entrypoint-unowned');
    const full = safeAbsolute(path.join(root, relative));
    if (!lstatSync(full).isFile()) refuse('entrypoint-missing');
    return full;
  };
  const cli = file('bin/dev-foundry-claude.js');
  return { format: 'dev-foundry.runtime-dispatch-plan.v1', status: 'verified-plan',
    execution: 'deferred-B3', repositoryRoot: selection.repositoryRoot, expect: selection.expect,
    packageRoot: root, entrypoints: {
      cli,
      mcp: { cli, args: ['mcp', '--expect', selection.expect], server: file('src/governance-mcp/server.js') },
      dashboard: { command: file('src/dashboard/command.js'), server: file('tools/dashboard/server/http.mjs'),
        launcher: file('tools/dashboard/server/launch.mjs'), evidence: file('tools/dashboard/server/evidence.mjs'),
        collector: file('tools/dashboard/server/claude-otel.mjs'), ui: file('tools/dashboard/dist/index.html') },
      telemetry: { launcher: file('src/telemetry/launch.js'), collector: file('src/telemetry/telemetry.js') },
    } };
}

// Closed orchestration transport. The stable host loads this only from its
// independently pinned manager; the selected package is verified by B1 again.
const valueFlags = new Set(['--root', '--runtime', '--port', '--store-root', '--input', '--out', '--plan', '--plan-sha256', '--authorization', '--from-package', '--project', '--classification', '--operator', '--id-prefix', '--expect', '--outcome']);
const booleanFlags = new Set(['--json', '--verbose', '--yes', '--apply', '--remove']);
export function validateInvocation(argv, root) {
  if (!Array.isArray(argv) || !argv.length || argv.length > 256 || argv.some(a => typeof a !== 'string' || /[\x00-\x1f]/.test(a))) refuse('invalid-invocation');
  const [command, ...rest] = argv;
  if (!['help', '--help', '--version', 'status', 'doctor', 'setup', 'start', 'runtime', 'mcp', 'dashboard', 'run', 'upgrade', 'adopt', 'cutover', 'migration'].includes(command)) refuse('unknown-invocation');
  if (['--version', 'migration', '--help'].includes(command) && rest.length) refuse('invalid-invocation');
  if (command === 'help') { if (rest.length > 1 || rest.some(a => a.startsWith('-'))) refuse('invalid-invocation'); return; }
  if (command === 'mcp') { if (rest.length !== 2 || rest[0] !== '--expect') refuse('invalid-invocation'); return; }
  let args = rest;
  if (command === 'run') {
    if (!['direct', 'dial', 'codemie'].includes(rest[0]) || rest[1] !== '--') refuse('invalid-invocation');
    return;
  }
  if (['runtime', 'cutover', 'adopt', 'upgrade'].includes(command) && args[0] && !args[0].startsWith('--')) {
    const actions = command === 'runtime' ? ['status', 'doctor', 'stage', 'proposal', 'plan', 'prepare', 'commit', 'recover', 'verify'] : command === 'cutover' ? ['plan', 'status', 'prepare', 'commit', 'recover', 'help'] : command === 'adopt' ? ['plan', 'apply', 'status'] : ['plan', 'apply', 'status'];
    if (!actions.includes(args[0])) refuse('unknown-invocation'); args = args.slice(1);
  } else if (command === 'runtime') refuse('unknown-invocation');
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--' && command === 'start') return;
    if (seen.has(flag) || (!valueFlags.has(flag) && !booleanFlags.has(flag))) refuse('unknown-invocation');
    seen.add(flag);
    if (valueFlags.has(flag)) {
      const value = args[++i]; if (!value || value.startsWith('--')) refuse('invalid-invocation');
      if (flag === '--root' && safeAbsolute(value) !== root) refuse('cross-project-invocation');
    }
  }
}
export async function launchRuntime({ cwd, storeRoot, managerRoot, managerExpect, node, argv }) {
  const { resolveConsumer } = await import('./identity.js');
  const { installedRuntime } = await import('./store.js');
  const { spawn } = await import('node:child_process');
  const consumer = resolveConsumer(cwd), root = consumer.repositoryRoot;
  validateInvocation(argv, root);
  const manager = installedRuntime(storeRoot, managerExpect);
  if (manager.packageRoot !== managerRoot) refuse('manager-root-mismatch');
  const lifecycle = argv[0] === 'runtime';
  let cli, pin;
  if (lifecycle) {
    // Recovery/status use the verified independent manager even if target
    // launch is broken. B2 validates exact journal/source/target invariants.
    cli = path.join(managerRoot, 'bin/dev-foundry-claude.js'); pin = managerExpect;
  } else {
    const plan = dispatchPlan({ cwd: root, storeRoot, pendingMcp: argv[0] === 'mcp' });
    cli = plan.entrypoints.cli; pin = plan.expect;
    if (argv[0] === 'mcp' && argv[2] !== pin) refuse('selected-pin-mismatch');
  }
  if (cli === process.argv[1] && path.basename(cli) === 'dev-foundry-claude-launcher.js') refuse('launcher-recursion');
  if (safeAbsolute(node) !== safeAbsolute(process.execPath)) refuse('node-executable-mismatch');
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['NODE_OPTIONS', 'NODE_PATH', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE'].includes(key)));
  Object.assign(env, { CLAUDE_PROJECT_DIR: root, DEV_FOUNDRY_RUNTIME_STORE: storeRoot, DEV_FOUNDRY_RUNTIME_EXPECT: pin });
  const child = spawn(node, [cli, ...argv], { cwd: root, env, stdio: 'inherit', shell: false });
  // Only this invocation's child receives ordinary termination signals. No
  // port lookup, process enumeration, force-kill, PATH or global-shim mutation.
  const interrupt = () => child.kill('SIGINT'), terminate = () => child.kill('SIGTERM');
  process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
  try { return await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => resolve(code ?? 1)); }); }
  finally { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate); }
}
