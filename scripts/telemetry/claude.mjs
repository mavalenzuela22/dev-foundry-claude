import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:os';
import path from 'node:path';
import { buildTelemetryEnvironment, DEFAULT_PORT, startCollector } from '../../src/telemetry/telemetry.js';

const projectRoot = process.cwd();
const telemetryRunId = randomUUID();
const telemetryDir = path.join(projectRoot, '.dev-foundry/telemetry/local');
let collector;
try {
  const portOption = process.env.DEV_FOUNDRY_TELEMETRY_PORT;
  if (portOption !== undefined && !/^\d+$/.test(portOption)) throw new Error('Invalid port.');
  collector = await startCollector({
    host: '127.0.0.1',
    port: portOption === undefined ? DEFAULT_PORT : Number(portOption),
    telemetryDir,
    telemetryRunId,
  });
  const env = buildTelemetryEnvironment({ telemetryDir, telemetryRunId, port: collector.port });
  const child = spawn('claude', process.argv.slice(2), { stdio: 'inherit', cwd: projectRoot, env });
  let killTimer;
  const forwardSignal = (signal) => {
    child.kill(signal);
    killTimer ??= setTimeout(() => child.kill('SIGKILL'), 5000);
    killTimer.unref();
  };
  const onInterrupt = () => forwardSignal('SIGINT');
  const onTerminate = () => forwardSignal('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  try {
    process.exitCode = await new Promise((resolve) => {
      let spawnFailed = false;
      child.once('error', () => {
        spawnFailed = true;
        console.error('Unable to launch the installed claude executable.');
      });
      child.once('close', (code, signal) => resolve(spawnFailed ? 1 : code ?? (128 + (constants.signals[signal] ?? 1))));
    });
  } finally {
    clearTimeout(killTimer);
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
  }
} catch {
  console.error('Telemetry launcher failed to start.');
  process.exitCode = 1;
} finally {
  if (collector) await collector.close();
}
