import { createServer } from 'node:http';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_HOST = '127.0.0.1';
export const DEFAULT_PORT = 4318;
export const MAX_BODY_BYTES = 1024 * 1024;

const normalize = (key) => key.replace(/[^a-z0-9]/gi, '').toLowerCase();
const safeKeys = new Set([
  'sessionid', 'promptid', 'requestid', 'telemetryrunid', 'timestamp',
  'model', 'modelid', 'querysource', 'effort', 'version', 'appversion',
  'claudeversion', 'claudecodeversion', 'repository', 'repositoryid',
  'repositoryname', 'repoid', 'reponame', 'toolresultsize', 'toolresultsizebytes',
  'tooloutputsize', 'tooloutputsizebytes', 'tooldurationms', 'tooluseid',
]);

function forbiddenKey(key) {
  const normalized = normalize(key);
  if (/(authorization|authentication|credential|secret|password|apikey|privatekey|cookie)/.test(normalized)) return true;
  if (/(email|accountuuid|accountid|userid|useruuid|persistentuser|username)/.test(normalized)
    || /(?:user|account|device|machine|host|client)(?:id|uuid|identifier|name|login|hash)$/.test(normalized)) return true;
  if (safeKeys.has(normalized)) return false;
  // Counts are measurement, while bare tokens and access/refresh tokens are secrets.
  if (normalized === 'token' || normalized === 'tokens') return true;
  if (/token/.test(normalized)) return !/^(?:(?:input|output|prompt|completion|cache|read|creation|write|total|usage|count|cached|uncached))*tokens?(?:count|usage|input|output|cache|read|creation|write|total|used|consumed|s)*$/.test(normalized);
  return /(prompt|assistantresponse|modeloutput|newcontext|toolinput|tooloutput|toolparameters|toolparams|tooldetails|toolcontent|toolresult|diff|command|cmd|body|content|parameters|payload|transcript|filepath|filename|sourcepath|workspace|cwd|directory|workingdir)/.test(normalized)
    || /^(?:path|paths|file|source|input|output|response|result|text|message|stdin|stdout|stderr|params|details|args|arguments|headers|user|account)$/.test(normalized)
    || /(?:repo|repository|project|source).*path/.test(normalized);
}

// OTLP KeyValue entries need filtering by their attribute name, not just by
// the structural keys "key" and "value". This also handles nested kvlistValue.
export function sanitizeTelemetry(value) {
  if (Array.isArray(value)) return value.map(sanitizeTelemetry).filter((item) => item !== undefined);
  if (value && typeof value === 'object') {
    if (typeof value.key === 'string' && forbiddenKey(value.key)) return undefined;
    const clean = {};
    for (const [key, item] of Object.entries(value)) {
      if (forbiddenKey(key)) continue;
      const sanitized = sanitizeTelemetry(item);
      if (sanitized !== undefined) Object.defineProperty(clean, key, { value: sanitized, enumerable: true });
    }
    return clean;
  }
  // A repository identity may be retained; a host-local repository path may not.
  if (typeof value === 'string' && /^(?:\/|~\/|[a-z]:[\\/]|file:\/\/)/i.test(value)) return undefined;
  return value;
}

function validatePort(port, allowZero = false) {
  if (!Number.isInteger(port) || port < (allowZero ? 0 : 1) || port > 65535) throw new Error('Invalid telemetry port.');
}

function validateStorage(telemetryDir, telemetryRunId) {
  if (typeof telemetryDir !== 'string' || !path.isAbsolute(telemetryDir)) throw new Error('Telemetry directory must be absolute.');
  if (typeof telemetryRunId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(telemetryRunId)) throw new Error('Telemetry run id must be a UUID.');
}

async function appendRecord(telemetryDir, prefix, record, timestamp) {
  await mkdir(telemetryDir, { recursive: true });
  const filename = path.join(telemetryDir, `${prefix}-${timestamp.slice(0, 10)}.ndjson`);
  await appendFile(filename, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
}

export function buildTelemetryEnvironment({ telemetryDir, telemetryRunId, port = DEFAULT_PORT, baseEnv = process.env }) {
  validatePort(port);
  validateStorage(telemetryDir, telemetryRunId);
  const env = { ...baseEnv };
  // Per-signal overrides otherwise take precedence over the generic endpoint.
  for (const key of Object.keys(env)) {
    if (/^OTEL_EXPORTER_OTLP_(?:METRICS|LOGS|TRACES)_(?:ENDPOINT|PROTOCOL)$/.test(key) || key === 'BETA_TRACING_ENDPOINT') delete env[key];
  }
  return Object.assign(env, {
    CLAUDE_CODE_ENABLE_TELEMETRY: '1',
    OTEL_METRICS_EXPORTER: 'otlp',
    OTEL_LOGS_EXPORTER: 'otlp',
    OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
    OTEL_EXPORTER_OTLP_ENDPOINT: `http://${DEFAULT_HOST}:${port}`,
    OTEL_TRACES_EXPORTER: 'none',
    CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: '0',
    ENABLE_ENHANCED_TELEMETRY_BETA: '0',
    ENABLE_BETA_TRACING_DETAILED: '0',
    OTEL_LOG_USER_PROMPTS: '0',
    OTEL_LOG_ASSISTANT_RESPONSES: '0',
    OTEL_LOG_TOOL_DETAILS: '0',
    OTEL_LOG_TOOL_CONTENT: '0',
    OTEL_LOG_RAW_API_BODIES: '0',
    OTEL_METRICS_INCLUDE_ACCOUNT_UUID: 'false',
    OTEL_METRICS_INCLUDE_SESSION_ID: 'true',
    OTEL_METRICS_INCLUDE_VERSION: 'true',
    OTEL_METRICS_INCLUDE_ENTRYPOINT: 'true',
    OTEL_METRICS_INCLUDE_REPOSITORY: 'true',
    DEV_FOUNDRY_TELEMETRY_RUN_ID: telemetryRunId,
    DEV_FOUNDRY_TELEMETRY_DIR: telemetryDir,
  });
}

export async function startCollector({ host = DEFAULT_HOST, port = DEFAULT_PORT, telemetryDir, telemetryRunId, maxBodyBytes = MAX_BODY_BYTES }) {
  if (host !== DEFAULT_HOST) throw new Error('Telemetry collector requires host 127.0.0.1.');
  validatePort(port, true);
  validateStorage(telemetryDir, telemetryRunId);
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > MAX_BODY_BYTES) throw new Error('Invalid telemetry body limit.');
  await mkdir(telemetryDir, { recursive: true });
  let writes = Promise.resolve();
  const server = createServer(async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    const signal = req.url === '/v1/metrics' ? 'metrics' : req.url === '/v1/logs' ? 'logs' : undefined;
    if (!signal || req.method !== 'POST') {
      req.resume();
      reply(!signal ? 404 : 405, { error: 'Unsupported telemetry method or path.' });
      return;
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) {
      req.resume();
      reply(415, { error: 'JSON required.' });
      return;
    }
    let size = 0;
    let oversized = false;
    const chunks = [];
    try {
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        // Drain every remaining chunk before replying; never retain an oversized body.
        if (oversized) continue;
        if (chunk.length > maxBodyBytes - size) {
          oversized = true;
          chunks.length = 0;
          continue;
        }
        size += chunk.length;
        chunks.push(chunk);
      }
    } catch {
      if (!res.destroyed) reply(400, { error: 'Incomplete telemetry body.' });
      return;
    }
    if (oversized) {
      reply(413, { error: 'Telemetry body too large.' });
      return;
    }
    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error();
      payload = sanitizeTelemetry(payload);
    } catch {
      reply(400, { error: 'Invalid telemetry JSON.' });
      return;
    }
    const receivedAt = new Date().toISOString();
    const envelope = { schema: 'dev-foundry.claude-otel-envelope.v1', telemetryRunId, receivedAt, signal, payload };
    const write = writes.then(() => appendRecord(telemetryDir, 'otel', envelope, receivedAt));
    writes = write.catch(() => {});
    try {
      await write;
      reply(200, {});
    } catch {
      reply(500, { error: 'Telemetry persistence failed.' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  let closing;
  return {
    host,
    port: server.address().port,
    close() {
      closing ??= new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeIdleConnections();
      }).then(() => writes);
      return closing;
    },
  };
}

export async function writeOperationMarker(input, { env = process.env } = {}) {
  const telemetryRunId = env.DEV_FOUNDRY_TELEMETRY_RUN_ID;
  const telemetryDir = env.DEV_FOUNDRY_TELEMETRY_DIR;
  if (!telemetryRunId || !telemetryDir) return;
  validateStorage(telemetryDir, telemetryRunId);
  const timestamp = new Date().toISOString();
  const marker = { schema: 'dev-foundry.claude-operation-marker.v1', telemetryRunId, timestamp };
  for (const key of ['requestedAction', 'targetProject', 'taskId', 'boundaryId', 'selectedRoleId', 'actorProfilePath', 'contextFingerprint']) {
    if (typeof input[key] === 'string') marker[key] = input[key];
  }
  if (Array.isArray(input.capabilityProfilePaths)) marker.capabilityProfilePaths = input.capabilityProfilePaths.filter((item) => typeof item === 'string');
  await appendRecord(telemetryDir, 'operations', marker, timestamp);
}
