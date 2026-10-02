import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildTelemetryEnvironment, sanitizeTelemetry, startCollector, writeOperationMarker } from '../../src/telemetry/telemetry.js';
import { makeProject } from '../governance-mcp/fixture.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverPath = path.join(repoRoot, 'src/governance-mcp/server.js');
const contentFlags = ['OTEL_LOG_USER_PROMPTS', 'OTEL_LOG_ASSISTANT_RESPONSES', 'OTEL_LOG_TOOL_DETAILS', 'OTEL_LOG_TOOL_CONTENT', 'OTEL_LOG_RAW_API_BODIES'];

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'claude-telemetry-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function records(directory, prefix) {
  const files = (await readdir(directory)).filter((name) => name.startsWith(`${prefix}-`));
  const result = [];
  for (const name of files) {
    const lines = (await readFile(path.join(directory, name), 'utf8')).trim().split('\n');
    for (const line of lines) {
      const record = JSON.parse(line);
      assert.equal(name, `${prefix}-${(record.receivedAt ?? record.timestamp).slice(0, 10)}.ndjson`);
      result.push(record);
    }
  }
  return result;
}

function send(port, { method = 'POST', url = '/v1/metrics', body = '{}', bodyChunks, contentType = 'application/json' } = {}) {
  return new Promise((resolve, reject) => {
    // Node does not automatically frame bodies for GET/DELETE. Unframed bytes
    // become an invalid next request and can reset a reused keep-alive socket.
    const headers = { 'Content-Type': contentType, ...(bodyChunks ? { 'Transfer-Encoding': 'chunked' } : { 'Content-Length': Buffer.byteLength(body) }) };
    const req = request({ host: '127.0.0.1', port, method, path: url, headers }, (res) => {
      let response = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { response += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, contentType: res.headers['content-type'], body: JSON.parse(response) }));
      res.on('error', reject);
    });
    req.on('error', reject);
    if (bodyChunks) {
      for (const chunk of bodyChunks) req.write(chunk);
      req.end();
    } else {
      req.end(body);
    }
  });
}

test('environment pins OTLP JSON metrics/logs to loopback and disables content and beta tracing', async (t) => {
  const telemetryDir = await temporaryDirectory(t);
  const telemetryRunId = randomUUID();
  const baseEnv = {
    KEEP_ME: 'unchanged', ANTHROPIC_MODEL: 'existing-choice',
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: 'https://example.invalid/metrics',
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: 'https://example.invalid/logs',
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'https://example.invalid/traces',
    OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: 'grpc',
    OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: 'http/protobuf',
    CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: '1', ENABLE_ENHANCED_TELEMETRY_BETA: '1',
    ENABLE_BETA_TRACING_DETAILED: '1', BETA_TRACING_ENDPOINT: 'https://example.invalid/beta',
    ...Object.fromEntries(contentFlags.map((flag) => [flag, '1'])),
  };
  const original = { ...baseEnv };
  const env = buildTelemetryEnvironment({ telemetryDir, telemetryRunId, port: 12345, baseEnv });
  assert.equal(env.CLAUDE_CODE_ENABLE_TELEMETRY, '1');
  assert.equal(env.OTEL_METRICS_EXPORTER, 'otlp');
  assert.equal(env.OTEL_LOGS_EXPORTER, 'otlp');
  assert.equal(env.OTEL_EXPORTER_OTLP_PROTOCOL, 'http/json');
  assert.equal(env.OTEL_EXPORTER_OTLP_ENDPOINT, 'http://127.0.0.1:12345');
  assert.equal(env.OTEL_TRACES_EXPORTER, 'none');
  for (const flag of contentFlags) assert.equal(env[flag], '0');
  for (const flag of ['CLAUDE_CODE_ENHANCED_TELEMETRY_BETA', 'ENABLE_ENHANCED_TELEMETRY_BETA', 'ENABLE_BETA_TRACING_DETAILED']) assert.equal(env[flag], '0');
  assert.equal(env.OTEL_METRICS_INCLUDE_ACCOUNT_UUID, 'false');
  for (const metadata of ['SESSION_ID', 'VERSION', 'ENTRYPOINT', 'REPOSITORY']) assert.equal(env[`OTEL_METRICS_INCLUDE_${metadata}`], 'true');
  for (const key of Object.keys(baseEnv).filter((key) => /_(ENDPOINT|PROTOCOL)$/.test(key))) assert.equal(env[key], undefined);
  assert.equal(env.DEV_FOUNDRY_TELEMETRY_RUN_ID, telemetryRunId);
  assert.equal(env.DEV_FOUNDRY_TELEMETRY_DIR, telemetryDir);
  assert.equal(env.KEEP_ME, 'unchanged');
  assert.equal(env.ANTHROPIC_MODEL, baseEnv.ANTHROPIC_MODEL);
  assert.deepEqual(baseEnv, original);
  assert.equal(buildTelemetryEnvironment({ telemetryDir, telemetryRunId, baseEnv: {} }).OTEL_EXPORTER_OTLP_ENDPOINT, 'http://127.0.0.1:4318');
  assert.throws(() => buildTelemetryEnvironment({ telemetryDir: 'relative', telemetryRunId }));
  assert.throws(() => buildTelemetryEnvironment({ telemetryDir, telemetryRunId, port: 0 }));
});

const forbidden = [
  'prompt', 'user_prompt', 'system_prompt_preview', 'assistant.response', 'response.model_output',
  'tool.input', 'tool_output', 'tool.parameters', 'tool_content', 'tool_details', 'tool_result',
  'diff', 'full_command', 'command', 'source_file_path', 'workspace_path', 'file.path',
  'api.request.body', 'raw_api_response_body', 'user.email', 'user.account_uuid', 'account_id',
  'user.id', 'persistent_user_identifier', 'user.login', 'device.id',
  'authorization', 'credentials', 'secret', 'token', 'tokens', 'api_token', 'access_token', 'password', 'api_key',
  'file', 'source', 'stdout', 'stderr', 'text', 'message',
];
const safe = {
  model: 'claude-model', query_source: 'subagent', effort: 'high',
  input_tokens: 120, output_tokens: 30, token_count: 150, prompt_tokens: 120,
  cache_read_input_tokens: 90, cache_creation_input_tokens: 10, reported_cost: 0.02,
  'request.id': 'request-1', 'prompt.id': 'prompt-1', 'session.id': 'session-1',
  timestamp: '2026-10-01T00:00:00.000Z', duration_ms: 800, 'app.version': '2.1',
  'app.entrypoint': 'cli', 'vcs.repository.name': 'dev-foundry-claude',
};
const attribute = (key, value) => ({ key, value: typeof value === 'number' ? { doubleValue: value } : { stringValue: value } });

test('sanitizer removes forbidden scalar and OTLP keys recursively and preserves correlation and measurements', () => {
  const forbiddenScalars = Object.fromEntries(forbidden.map((key) => [key, 'PRIVATE_CONTENT']));
  const payload = {
    ...safe, ...forbiddenScalars,
    nested: [{ ...safe, ...forbiddenScalars }],
    attributes: [...Object.entries(safe).map(([key, value]) => attribute(key, value)), ...forbidden.map((key) => attribute(key, 'PRIVATE_CONTENT'))],
    resource: { attributes: [attribute('vcs.repository.url', '/private/workspace/project'), attribute('vcs.repository.name', 'dev-foundry-claude')] },
    nestedAttributes: [{ key: 'metadata', value: { kvlistValue: { values: [attribute('tool.input', 'PRIVATE_CONTENT'), attribute('model', 'claude-model')] } } }],
    body: { stringValue: 'PRIVATE_CONTENT' },
  };
  const before = JSON.stringify(payload);
  const clean = sanitizeTelemetry(payload);
  for (const [key, value] of Object.entries(safe)) assert.equal(clean[key], value);
  assert.deepEqual(clean.nested, [safe]);
  assert.deepEqual(clean.attributes, Object.entries(safe).map(([key, value]) => attribute(key, value)));
  assert.deepEqual(clean.nestedAttributes[0].value.kvlistValue.values, [attribute('model', 'claude-model')]);
  assert.ok(!JSON.stringify(clean).includes('PRIVATE_CONTENT'));
  assert.ok(!JSON.stringify(clean).includes('/private/workspace'));
  assert.equal(JSON.stringify(payload), before);
});

test('loopback collector persists sanitized metrics/logs as UTC-dated NDJSON and closes its listener', async (t) => {
  const telemetryDir = await temporaryDirectory(t);
  const telemetryRunId = randomUUID();
  const collector = await startCollector({ telemetryDir, telemetryRunId, port: 0 });
  t.after(() => collector.close());
  assert.equal(collector.host, '127.0.0.1');
  const metrics = { resourceMetrics: [{ resource: { attributes: [attribute('model', 'claude-model'), attribute('user.email', 'PRIVATE_CONTENT')] }, scopeMetrics: [{ metrics: [{ name: 'claude_code.token.usage', sum: { dataPoints: [{ asInt: '120', timeUnixNano: '1790812800000000000', attributes: [attribute('session.id', 'session-1')] }] } }] }] }] };
  const logs = { resourceLogs: [{ scopeLogs: [{ logRecords: [{ timeUnixNano: '1790812800000000000', body: { stringValue: 'PRIVATE_CONTENT' }, attributes: [attribute('query_source', 'main'), attribute('prompt', 'PRIVATE_CONTENT'), attribute('request.id', 'request-1')] }] }] }] };
  const responses = await Promise.all(Array.from({ length: 8 }, (_, i) => send(collector.port, { url: i % 2 ? '/v1/logs' : '/v1/metrics', body: JSON.stringify(i % 2 ? logs : metrics) })));
  for (const res of responses) assert.deepEqual(res, { status: 200, contentType: 'application/json', body: {} });
  const stored = await records(telemetryDir, 'otel');
  assert.equal(stored.length, 8);
  for (const envelope of stored) {
    assert.deepEqual(Object.keys(envelope), ['schema', 'telemetryRunId', 'receivedAt', 'signal', 'payload']);
    assert.equal(envelope.schema, 'dev-foundry.claude-otel-envelope.v1');
    assert.equal(envelope.telemetryRunId, telemetryRunId);
    assert.match(envelope.receivedAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
    assert.deepEqual(envelope.payload, sanitizeTelemetry(envelope.signal === 'logs' ? logs : metrics));
    assert.ok(!JSON.stringify(envelope).includes('PRIVATE_CONTENT'));
  }
  assert.equal(stored.filter((record) => record.signal === 'metrics').length, 4);
  await collector.close();
  await assert.rejects(send(collector.port), (error) => ['ECONNREFUSED', 'ECONNRESET'].includes(error.code));
});

test('collector rejects unsupported routes/methods, malformed/non-JSON and oversized bodies without persistence', async (t) => {
  const telemetryDir = await temporaryDirectory(t);
  const collector = await startCollector({ telemetryDir, telemetryRunId: randomUUID(), port: 0, maxBodyBytes: 256 });
  t.after(() => collector.close());
  for (const url of ['/v1/traces', '/unknown', '/v1/logs?query=1']) assert.equal((await send(collector.port, { url })).status, 404);
  for (const method of ['GET', 'PUT', 'DELETE']) assert.equal((await send(collector.port, { method })).status, 405);
  assert.equal((await send(collector.port, { contentType: 'text/plain' })).status, 415);
  for (const body of ['{broken', 'null', '[]', '"text"']) assert.equal((await send(collector.port, { body })).status, 400);
  const oversizedBody = JSON.stringify({ large: 'x'.repeat(1024) });
  const tooLarge = { status: 413, contentType: 'application/json', body: { error: 'Telemetry body too large.' } };
  assert.deepEqual(await send(collector.port, { body: oversizedBody }), tooLarge);
  assert.deepEqual(await send(collector.port, { body: 'x'.repeat(257) }), tooLarge);
  assert.deepEqual(await send(collector.port, { bodyChunks: [oversizedBody.slice(0, 128), oversizedBody.slice(128, 384), oversizedBody.slice(384)] }), tooLarge);
  assert.deepEqual(await readdir(telemetryDir), []);
  assert.equal((await send(collector.port)).status, 200);
});

test('collector rejects non-loopback startup before touching storage and bounds options', async (t) => {
  const directory = await temporaryDirectory(t);
  const options = { telemetryDir: path.join(directory, 'unused'), telemetryRunId: randomUUID(), port: 0 };
  for (const host of ['0.0.0.0', '::', 'localhost', '127.0.0.2']) await assert.rejects(startCollector({ ...options, host }), /127\.0\.0\.1/);
  for (const port of [-1, 65536, 1.5, '4318']) await assert.rejects(startCollector({ ...options, port }));
  for (const maxBodyBytes of [0, Infinity, 2 * 1024 * 1024]) await assert.rejects(startCollector({ ...options, maxBodyBytes }));
  await assert.rejects(startCollector({ ...options, telemetryDir: 'relative' }));
  assert.deepEqual(await readdir(directory), []);
});

test('operation markers project only the allowlist, with separate UTC files and generated identity/time', async (t) => {
  const telemetryDir = await temporaryDirectory(t);
  const telemetryRunId = randomUUID();
  const env = { DEV_FOUNDRY_TELEMETRY_RUN_ID: telemetryRunId, DEV_FOUNDRY_TELEMETRY_DIR: telemetryDir };
  const fields = {
    requestedAction: 'implement', targetProject: 'dev-foundry-claude', taskId: 'TSK-008',
    selectedRoleId: 'implementation-executor', actorProfilePath: '.dev-foundry/releases/2.1.0/actor-profiles/implementation-executor-v2.yaml',
    capabilityProfilePaths: ['.dev-foundry/profiles/capability-profiles/implementation-executor-runner-v2.yaml'],
    contextFingerprint: 'a'.repeat(64),
  };
  await writeOperationMarker({ ...fields, prompt: 'PRIVATE_CONTENT', result: { authority: 'PRIVATE_CONTENT' }, telemetryRunId: 'spoofed', timestamp: 'spoofed', schema: 'spoofed' }, { env });
  await writeOperationMarker({ ...fields, taskId: undefined, boundaryId: 'boundary-1', capabilityProfilePaths: ['safe.yaml', { body: 'PRIVATE_CONTENT' }] }, { env });
  const stored = await records(telemetryDir, 'operations');
  assert.equal(stored.length, 2);
  const { timestamp, ...marker } = stored[0];
  assert.match(timestamp, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.deepEqual(marker, { schema: 'dev-foundry.claude-operation-marker.v1', telemetryRunId, ...fields });
  assert.equal(stored[1].taskId, undefined);
  assert.equal(stored[1].boundaryId, 'boundary-1');
  assert.deepEqual(stored[1].capabilityProfilePaths, ['safe.yaml']);
  assert.ok(!JSON.stringify(stored).includes('PRIVATE_CONTENT'));
  assert.deepEqual(await records(telemetryDir, 'otel'), []);
});

test('marker writer is a no-op unless both telemetry variables are present', async (t) => {
  const telemetryDir = await temporaryDirectory(t);
  for (const env of [{}, { DEV_FOUNDRY_TELEMETRY_DIR: telemetryDir }, { DEV_FOUNDRY_TELEMETRY_RUN_ID: randomUUID() }]) await writeOperationMarker(null, { env });
  assert.deepEqual(await readdir(telemetryDir), []);
});

// Speak the newline-delimited stdio protocol directly; no model or Claude
// process participates in these smoke checks.
async function startMcp(t, projectRoot, telemetryEnv = {}) {
  // Launcher-owned variables are removed so results do not depend on whether
  // the suite runs inside or outside the launcher.
  const env = { ...process.env, CLAUDE_PROJECT_DIR: projectRoot };
  for (const key of Object.keys(env)) {
    if (key === 'DEV_FOUNDRY_CLAUDE_LAUNCH_MODE' || key.startsWith('DEV_FOUNDRY_TELEMETRY_') || key.startsWith('OTEL_')
      || ['CLAUDE_CODE_ENABLE_TELEMETRY', 'CLAUDE_CODE_ENHANCED_TELEMETRY_BETA', 'ENABLE_ENHANCED_TELEMETRY_BETA', 'ENABLE_BETA_TRACING_DETAILED', 'BETA_TRACING_ENDPOINT'].includes(key)) delete env[key];
  }
  Object.assign(env, telemetryEnv);
  const child = spawn(process.execPath, [serverPath], { cwd: os.tmpdir(), env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, 'close');
      child.kill('SIGTERM');
      await closed;
    }
  });
  const pending = new Map();
  let nextId = 0;
  let buffer = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const message = JSON.parse(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      const handler = pending.get(message.id);
      if (handler) {
        pending.delete(message.id);
        clearTimeout(handler.timer);
        if (message.error) handler.reject(new Error(JSON.stringify(message.error)));
        else handler.resolve(message.result);
      }
    }
  });
  function rpc(method, params) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('MCP smoke timed out.')); }, 10000);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }
  await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'telemetry-test', version: '1.0.0' } });
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  return { rpc, stderr: () => stderr };
}

test('MCP markers follow successful resolution only and preserve exact results when disabled/enabled/failing', async (t) => {
  const project = await makeProject();
  t.after(() => project.cleanup());
  const telemetryDir = await temporaryDirectory(t);
  const telemetryRunId = randomUUID();
  const disabled = await startMcp(t, project.root);
  const enabled = await startMcp(t, project.root, { DEV_FOUNDRY_TELEMETRY_RUN_ID: telemetryRunId, DEV_FOUNDRY_TELEMETRY_DIR: telemetryDir });
  const tools = await enabled.rpc('tools/list', {});
  assert.deepEqual(tools.tools.map((tool) => tool.name), ['resolve_governed_operation']);
  const args = { requestedAction: 'implement', targetProject: 'fixture-project', taskId: 'TSK-002' };
  const call = (server, arguments_) => server.rpc('tools/call', { name: 'resolve_governed_operation', arguments: arguments_ });
  const expected = await call(disabled, args);
  assert.equal(JSON.parse(expected.content[0].text).ok, true);
  assert.deepEqual(await readdir(telemetryDir), []);
  assert.deepEqual(await call(enabled, args), expected);
  const invalid = { ...args, unexpected: true };
  assert.deepEqual(await call(enabled, invalid), await call(disabled, invalid));
  assert.equal(JSON.parse((await call(enabled, invalid)).content[0].text).ok, false);
  const stored = await records(telemetryDir, 'operations');
  assert.equal(stored.length, 1);
  const { resolution } = JSON.parse(expected.content[0].text);
  const { timestamp, ...marker } = stored[0];
  assert.deepEqual(marker, {
    schema: 'dev-foundry.claude-operation-marker.v1', telemetryRunId,
    ...args, selectedRoleId: resolution.role.id, actorProfilePath: resolution.role.actorProfilePath,
    capabilityProfilePaths: resolution.role.capabilityProfilePaths, contextFingerprint: resolution.contextFingerprint,
  });
  const notDirectory = path.join(telemetryDir, 'not-a-directory');
  await writeFile(notDirectory, 'test');
  const failing = await startMcp(t, project.root, { DEV_FOUNDRY_TELEMETRY_RUN_ID: telemetryRunId, DEV_FOUNDRY_TELEMETRY_DIR: notDirectory });
  assert.deepEqual(await call(failing, args), expected);
  // The warning travels on a separate pipe; allow its data event to arrive.
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(failing.stderr(), /operation marker could not be written/);
  assert.ok(!failing.stderr().includes(notDirectory));
});

test('server source keeps one tool and opt-in marker after resolver success; launcher remains passive', async () => {
  const server = await readFile(serverPath, 'utf8');
  assert.equal((server.match(/\.registerTool\(/g) ?? []).length, 1);
  const resolution = server.indexOf('const result = await resolveGovernedOperation');
  const gate = server.indexOf('if (result.ok === true && process.env.DEV_FOUNDRY_TELEMETRY_RUN_ID && process.env.DEV_FOUNDRY_TELEMETRY_DIR)');
  assert.ok(gate > resolution);
  assert.ok(server.indexOf('await writeOperationMarker', gate) > gate);
  assert.ok(server.indexOf("return { content: [{ type: 'text', text: JSON.stringify(result) }] }") > gate);
  const entry = await readFile(path.join(repoRoot, 'scripts/telemetry/claude.mjs'), 'utf8');
  assert.match(entry, /runLauncher\(\{ argv: process\.argv\.slice\(2\) \}\)/);
  const launcher = await readFile(path.join(repoRoot, 'src/telemetry/launch.js'), 'utf8');
  assert.match(launcher, /projectRoot = process\.cwd\(\)/);
  assert.match(launcher, /const telemetryRunId = randomUUID\(\)/);
  assert.match(launcher, /spawn\(plan\.executable, plan\.args, \{ stdio: 'inherit', cwd: projectRoot, env: childEnv, shell: false \}\)/);
  assert.ok(launcher.indexOf('await startCollector') < launcher.indexOf('spawn(plan.executable'));
  assert.match(launcher, /finally \{\s*if \(collector\) await collector\.close\(\)/);
  for (const script of ['scripts/telemetry/claude.mjs', 'scripts/telemetry/collector.mjs', 'src/telemetry/launch.js']) execFileSync(process.execPath, ['--check', path.join(repoRoot, script)]);
});

test('local telemetry directory is Git-ignored', async () => {
  const ignore = await readFile(path.join(repoRoot, '.gitignore'), 'utf8');
  assert.ok(ignore.split(/\r?\n/).includes('.dev-foundry/telemetry/local/'));
  const ignored = execFileSync('git', ['check-ignore', '.dev-foundry/telemetry/local/probe.ndjson'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(ignored.trim(), '.dev-foundry/telemetry/local/probe.ndjson');
});
