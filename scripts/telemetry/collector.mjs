import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DEFAULT_HOST, DEFAULT_PORT, startCollector } from '../../src/telemetry/telemetry.js';

try {
  const portOption = process.env.DEV_FOUNDRY_TELEMETRY_PORT;
  if (portOption !== undefined && !/^\d+$/.test(portOption)) throw new Error('Invalid port.');
  const collector = await startCollector({
    host: process.env.DEV_FOUNDRY_TELEMETRY_HOST ?? DEFAULT_HOST,
    port: portOption === undefined ? DEFAULT_PORT : Number(portOption),
    telemetryDir: process.env.DEV_FOUNDRY_TELEMETRY_DIR ?? path.join(process.cwd(), '.dev-foundry/telemetry/local'),
    telemetryRunId: process.env.DEV_FOUNDRY_TELEMETRY_RUN_ID ?? randomUUID(),
  });
  console.error(`Local telemetry collector ready at http://${collector.host}:${collector.port}`);
  const shutdown = () => collector.close().catch(() => { process.exitCode = 1; });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch {
  console.error('Local telemetry collector startup failed; check loopback host, port, directory, and run id.');
  process.exitCode = 1;
}
