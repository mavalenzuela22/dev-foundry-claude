import { spawn as nodeSpawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:os';
import path from 'node:path';
import { buildTelemetryEnvironment, startCollector as defaultStartCollector } from './telemetry.js';

export const RUNTIMES = Object.freeze(['direct', 'dial', 'codemie']);

class UsageError extends Error {}

// Accepts exactly: --runtime <name> -- <claude args>. Everything after the
// first `--` is passed through unchanged, including later `--` entries.
export function parseLauncherArgs(argv) {
  if (!Array.isArray(argv) || argv[0] !== '--runtime' || !RUNTIMES.includes(argv[1]) || argv[2] !== '--') {
    throw new UsageError('Invalid launcher arguments.');
  }
  return { runtime: argv[1], claudeArgs: argv.slice(3) };
}

export function buildLaunchPlan(runtime, claudeArgs = []) {
  if (!RUNTIMES.includes(runtime) || !Array.isArray(claudeArgs)) throw new UsageError('Invalid launcher arguments.');
  if (runtime === 'direct') return { executable: 'claude', args: [...claudeArgs] };
  if (runtime === 'dial') return { executable: 'dial', args: ['run', '--harness', 'claude-code', '--', ...claudeArgs] };
  return { executable: 'codemie-claude', args: ['--', ...claudeArgs] };
}

export async function runLauncher({
  argv,
  env = process.env,
  projectRoot = process.cwd(),
  spawn = nodeSpawn,
  startCollector = defaultStartCollector,
  signalTarget = process,
  stderr = (message) => console.error(message),
  killTimeoutMs = 5000,
} = {}) {
  let plan;
  let runtime;
  try {
    const parsed = parseLauncherArgs(argv);
    runtime = parsed.runtime;
    plan = buildLaunchPlan(runtime, parsed.claudeArgs);
  } catch {
    stderr('Usage: claude.mjs --runtime <direct|dial|codemie> -- <claude args>');
    return 2;
  }
  const telemetryRunId = randomUUID();
  const telemetryDir = path.join(projectRoot, '.dev-foundry/telemetry/local');
  let collector;
  try {
    const portOption = env.DEV_FOUNDRY_TELEMETRY_PORT;
    if (portOption !== undefined && !/^\d+$/.test(portOption)) throw new Error('Invalid port.');
    collector = await startCollector({
      host: '127.0.0.1',
      port: portOption === undefined ? 0 : Number(portOption),
      telemetryDir,
      telemetryRunId,
    });
    const childEnv = buildTelemetryEnvironment({ telemetryDir, telemetryRunId, port: collector.port, baseEnv: env, launchMode: runtime });
    const child = spawn(plan.executable, plan.args, { stdio: 'inherit', cwd: projectRoot, env: childEnv, shell: false });
    let killTimer;
    const forwardSignal = (signal) => {
      child.kill(signal);
      killTimer ??= setTimeout(() => child.kill('SIGKILL'), killTimeoutMs);
      killTimer.unref?.();
    };
    const onInterrupt = () => forwardSignal('SIGINT');
    const onTerminate = () => forwardSignal('SIGTERM');
    signalTarget.on('SIGINT', onInterrupt);
    signalTarget.on('SIGTERM', onTerminate);
    try {
      return await new Promise((resolve) => {
        let spawnFailed = false;
        child.once('error', () => {
          spawnFailed = true;
          stderr('Unable to launch the selected Claude Code runtime executable.');
          resolve(1);
        });
        child.once('close', (code, signal) => resolve(spawnFailed ? 1 : code ?? (128 + (constants.signals[signal] ?? 1))));
      });
    } finally {
      clearTimeout(killTimer);
      signalTarget.off('SIGINT', onInterrupt);
      signalTarget.off('SIGTERM', onTerminate);
    }
  } catch {
    stderr('Telemetry launcher failed to start.');
    return 1;
  } finally {
    if (collector) await collector.close();
  }
}
