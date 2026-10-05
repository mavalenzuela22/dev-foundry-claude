import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readClaudeOtel, OTEL_LIMITS } from '../server/claude-otel.mjs';
import { dashboardHandler } from '../server/http.mjs';
import { telemetryTabs, telemetryTab, telemetryTabPath } from '../ui/routes.mjs';

const runId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const time = '2026-10-02T12:00:00.000Z';
const attr = (key, value) => ({ key, value: typeof value === 'number' ? { doubleValue: value } : { stringValue: value } });
const attrs = (v) => Object.entries(v).map(([key, value]) => attr(key, value));
const envelope = (signal, payload, id = runId) => ({ schema: 'dev-foundry.claude-otel-envelope.v1', telemetryRunId: id, receivedAt: time, signal, payload });
const metric = (name, value, a = {}, options = {}) => ({ name, unit: options.unit, sum: { aggregationTemporality: options.temporality ?? 1, dataPoints: [{ asDouble: value, startTimeUnixNano: '1', timeUnixNano: options.time ?? '1790942400000000000', attributes: attrs(a) }] } });
const metrics = (m, id = runId) => envelope('metrics', { resourceMetrics: [{ resource: { attributes: attrs({ 'session.id': 'fixture-session', model: 'claude-fixture' }) }, scopeMetrics: [{ metrics: m }] }] }, id);
const log = (a = {}, id = runId) => envelope('logs', { resourceLogs: [{ resource: { attributes: attrs({ 'session.id': 'fixture-session' }) }, scopeLogs: [{ logRecords: [{ timeUnixNano: '1790942400000000000', attributes: attrs({ 'event.name': 'api_request', 'request.id': 'fixture-request', ...a }) }] }] }] }, id);
const marker = (a = {}, id = runId) => ({ schema: 'dev-foundry.claude-operation-marker.v1', telemetryRunId: id, timestamp: time, taskId: 'TSK-015', selectedRoleId: 'implementation-executor', launchMode: 'direct', ...a });
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'claude-otel-proof-')); t.after(() => rm(root, { recursive: true, force: true }));
  const dir = path.join(root, '.dev-foundry/telemetry/local'); await mkdir(dir, { recursive: true });
  return { root, dir, put: (name, records) => writeFile(path.join(dir, name), typeof records === 'string' ? records : records.map((r) => JSON.stringify(r)).join('\n') + '\n') };
}

test('sanitized metrics/logs aggregate direct token, cost, cache and durations without double counting', async (t) => {
  const f = await fixture(t);
  await f.put('otel-2026-10-02.ndjson', [metrics([
    metric('claude_code.token.usage', 100, { type: 'input' }), metric('claude_code.token.usage', 20, { type: 'output' }),
    metric('claude_code.token.usage', 50, { type: 'cacheRead' }), metric('claude_code.token.usage', 10, { type: 'cacheCreation' }),
    metric('claude_code.cost.usage', 0.25, {}, { unit: 'USD' }), metric('claude_code.active_time.total', 3, {}, { unit: 's' }),
  ]), log({ model: 'claude-fixture', effort: 'high', query_source: 'main', input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50, cache_creation_input_tokens: 10, reported_cost: 0.25, duration_ms: 1500 }),
  log({ model: 'claude-fixture', effort: 'high', query_source: 'main', input_tokens: 100, output_tokens: 20, reported_cost: 0.25, duration_ms: 1500 })]);
  const m = await readClaudeOtel(f.root);
  assert.deepEqual(m.summary, { runs: 1, sessions: 1, apiRequests: 1, inputTokens: 100, outputTokens: 20, cacheReadInputTokens: 50, cacheCreationInputTokens: 10, totalMeasuredTokens: 180, reportedCostUsd: 0.25, requestDurationMs: 1500, activeDurationMs: 3000, cacheReadRatio: 50 / 160 });
  assert.equal(m.breakdowns.model[0].totalMeasuredTokens, 180);
  assert.equal(m.breakdowns.effort[0].value, 'high');
  assert.equal(m.breakdowns.querySource[0].value, 'main');
  assert.equal(m.issues.length, 0);
});

test('cumulative series use latest snapshot; delta intervals deduplicate and add, resets stay distinct', async (t) => {
  const f = await fixture(t);
  const snapshot = (v, stamp) => metrics([metric('claude_code.token.usage', v, { type: 'input' }, { temporality: 2, time: stamp })]);
  const reset = snapshot(5, '1790942400000000003'); reset.payload.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints[0].startTimeUnixNano = '2';
  const delta = metrics([metric('claude_code.token.usage', 4, { type: 'output' }, { time: '1790942400000000001' })]);
  await f.put('otel-2026-10-02.ndjson', [snapshot(20, '1790942400000000002'), snapshot(10, '1790942399000000000'), reset, delta, delta, metrics([metric('claude_code.token.usage', 6, { type: 'output' }, { time: '1790942400000000002' })])]);
  const m = await readClaudeOtel(f.root);
  assert.equal(m.summary.inputTokens, 25); assert.equal(m.summary.outputTokens, 10); assert.equal(m.summary.totalMeasuredTokens, 35);
});

test('mixed metric categories and log-only categories form the measured subset total after fallback', async (t) => {
  const f = await fixture(t);
  await f.put('otel-2026-10-02.ndjson', [metrics([metric('claude_code.token.usage', 100, { type: 'input' })]), log({ model: 'claude-fixture', input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50 })]);
  const m = await readClaudeOtel(f.root);
  assert.equal(m.summary.totalMeasuredTokens, 170);
  assert.equal(m.recentRuns[0].measures.totalMeasuredTokens, 170);
  assert.equal(m.breakdowns.model[0].totalMeasuredTokens, 170);
  assert.equal(m.summary.cacheCreationInputTokens, null);
});

test('anonymous identical API events remain distinct observed requests', async (t) => {
  const f = await fixture(t);
  const request = log({ input_tokens: 3, duration_ms: 4 });
  const a = request.payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;
  a.splice(a.findIndex((x) => x.key === 'request.id'), 1);
  await f.put('otel-2026-10-02.ndjson', [request, request]);
  const m = await readClaudeOtel(f.root);
  assert.equal(m.summary.apiRequests, 2);
  assert.equal(m.summary.inputTokens, 6);
  assert.equal(m.summary.requestDurationMs, 8);
});

test('malformed OTLP siblings do not hide subsequent valid points or logs', async (t) => {
  const f = await fixture(t);
  const ms = metrics([metric('claude_code.token.usage', 9, { type: 'input' })]);
  ms.payload.resourceMetrics[0].scopeMetrics[0].metrics.unshift(null);
  ms.payload.resourceMetrics[0].scopeMetrics[0].metrics[1].sum.dataPoints.unshift(null);
  const ls = log({ output_tokens: 2 });
  ls.payload.resourceLogs[0].scopeLogs[0].logRecords.unshift(null);
  await f.put('otel-2026-10-02.ndjson', [ms, ls]);
  const m = await readClaudeOtel(f.root);
  assert.equal(m.summary.totalMeasuredTokens, 11);
  assert.equal(m.summary.apiRequests, 1);
  assert.equal(m.issues[0].count, 3);
});

test('logs recognize collector aliases, numeric AnyValues and ignore content-bearing non-request events', async (t) => {
  const f = await fixture(t);
  const request = log({ input_tokens: 3, output_tokens: 4, cache_read_tokens: 5, cache_creation_tokens: 6, cost_usd_micros: 1200, duration_ms: 7 });
  const nonRequest = log({ 'event.name': 'subagent_completed', 'request.id': 'other', total_tokens: 999 });
  await f.put('otel-2026-10-02.ndjson', [request, nonRequest]);
  const m = await readClaudeOtel(f.root);
  assert.equal(m.summary.totalMeasuredTokens, 18); assert.equal(m.summary.reportedCostUsd, 0.0012); assert.equal(m.summary.requestDurationMs, 7); assert.equal(m.summary.apiRequests, 1);
});

test('operation correlation is exact run-id only; multi-operation runs do not invent per-task allocation', async (t) => {
  const f = await fixture(t);
  await f.put('otel-2026-10-02.ndjson', [log({ input_tokens: 10 }), log({}, otherId)]);
  await f.put('operations-2026-10-02.ndjson', [marker(), marker({ taskId: 'TSK-014' }), marker({ taskId: 'TSK-999' }, '00000000-0000-4000-8000-000000000003')]);
  const m = await readClaudeOtel(f.root); assert.equal(m.summary.runs, 2);
  assert.equal(m.summary.sessions, 1, 'A resumed session observed across two run IDs is counted once');
  const matching = m.recentRuns.find((r) => r.measures.inputTokens === 10);
  assert.deepEqual(matching.correlation, { task: ['TSK-014', 'TSK-015'], role: ['implementation-executor'], launchMode: ['direct'] });
  assert.deepEqual(m.recentRuns.find((r) => r !== matching).correlation, { task: [], role: [], launchMode: [] });
  assert.deepEqual(m.tasksObserved, ['TSK-014', 'TSK-015']);
  assert.deepEqual(m.breakdowns.task.map((r) => r.value), ['TSK-014', 'TSK-015', 'unavailable']);
  for (const key of ['task', 'role', 'launchMode']) for (const row of m.breakdowns[key]) for (const field of Object.keys(m.recentRuns[0].measures)) assert.equal(row[field], null);
  assert.ok(!JSON.stringify(m).includes('TSK-999'));
});

test('missing fields are unavailable, direct zeros stay zero, cache ratio needs its full denominator', async (t) => {
  const f = await fixture(t); await f.put('otel-2026-10-02.ndjson', [log({ output_tokens: 0, cache_read_tokens: 10 })]);
  const m = await readClaudeOtel(f.root);
  assert.equal(m.summary.inputTokens, null); assert.equal(m.summary.outputTokens, 0); assert.equal(m.summary.reportedCostUsd, null); assert.equal(m.summary.cacheReadRatio, null);
  assert.equal(m.summary.totalMeasuredTokens, 10); assert.equal(m.breakdowns.model[0].value, 'unavailable');
  assert.deepEqual(m.recentRuns[0].models, []);
  const empty = await readClaudeOtel(path.join(f.root, 'absent')); assert.equal(empty.availability, 'unavailable'); assert.equal(empty.summary.runs, null);
});

test('safe non-UUID run identities correlate exactly and include the mechanical-validator role', async (t) => {
  const f = await fixture(t);
  await f.put('otel-2026-10-02.ndjson', [log({ input_tokens: 4 }, 'fixture-run-A')]);
  await f.put('operations-2026-10-02.ndjson', [marker({ selectedRoleId: 'mechanical-validator' }, 'fixture-run-A'), marker({ taskId: 'TSK-999' }, 'fixture-run-a')]);
  const m = await readClaudeOtel(f.root);
  assert.equal(m.summary.runs, 1);
  assert.deepEqual(m.recentRuns[0].correlation.role, ['mechanical-validator']);
  assert.deepEqual(m.recentRuns[0].correlation.task, ['TSK-015']);
  assert.ok(!JSON.stringify(m).includes('fixture-run-A'));
});

test('untyped token usage is a direct measured total; unsupported schemas/temporality do not produce guessed numbers', async (t) => {
  const f = await fixture(t); const unsupported = metrics([metric('claude_code.token.usage', 999)]); unsupported.schema = 'unknown';
  await f.put('otel-2026-10-02.ndjson', [metrics([metric('claude_code.token.usage', 120)]), unsupported, metrics([metric('claude_code.cost.usage', 999, {}, { temporality: 99 })])]);
  const m = await readClaudeOtel(f.root); assert.equal(m.summary.totalMeasuredTokens, 120); assert.equal(m.summary.inputTokens, null); assert.equal(m.summary.reportedCostUsd, null); assert.ok(m.issues.length);
});

test('malformed NDJSON and malformed OTLP structures tolerate individual records and continue', async (t) => {
  const f = await fixture(t);
  await f.put('otel-2026-10-02.ndjson', ['{broken', JSON.stringify(envelope('logs', { resourceLogs: {} })), JSON.stringify(log({ input_tokens: 4 })), '{truncated'].join('\n'));
  const m = await readClaudeOtel(f.root); assert.equal(m.summary.inputTokens, 4); assert.equal(m.issues.find((x) => x.code.includes('Malformed')).count, 3);
});

test('file/byte/line/record bounds are explicit; files are selected newest first without recursion', async (t) => {
  const f = await fixture(t);
  await f.put('otel-2026-10-01.ndjson', [log({ input_tokens: 999 }, otherId)]);
  await f.put('otel-2026-10-02.ndjson', [log({ input_tokens: 7 })]);
  await mkdir(path.join(f.dir, 'nested')); await writeFile(path.join(f.dir, 'nested/otel-2026-10-03.ndjson'), JSON.stringify(log({ input_tokens: 9999 })));
  await f.put('codemie-analytics.json', JSON.stringify({ content: 'FORBIDDEN' }));
  const limits = (v) => ({ ...OTEL_LIMITS, ...v });
  const newest = await readClaudeOtel(f.root, limits({ files: 1 })); assert.equal(newest.summary.inputTokens, 7); assert.equal(newest.truncated, true); assert.equal(newest.scan.filesRead, 1);
  const oversized = await readClaudeOtel(f.root, limits({ fileBytes: 1 })); assert.equal(oversized.availability, 'unavailable'); assert.equal(oversized.truncated, true);
  const total = await readClaudeOtel(f.root, limits({ totalBytes: 1 })); assert.equal(total.truncated, true); assert.equal(total.scan.bytesRead, 0);
  const record = await readClaudeOtel(f.root, limits({ records: 1 })); assert.equal(record.scan.records, 1); assert.equal(record.summary.inputTokens, 7); assert.equal(record.truncated, true);
  const line = await readClaudeOtel(f.root, limits({ lines: 1 })); assert.equal(line.scan.candidateLines, 1); assert.equal(line.truncated, true);
  const lineBytes = await readClaudeOtel(f.root, limits({ lineBytes: 2 })); assert.equal(lineBytes.summary.runs, null); assert.equal(lineBytes.truncated, true);
  const directory = await readClaudeOtel(f.root, limits({ entries: 1 })); assert.equal(directory.truncated, true);
});

test('privacy allowlist excludes raw payloads, sensitive content in arbitrary or allowed attributes and operation paths', async (t) => {
  const f = await fixture(t); const forbidden = 'PRIVATE_CONTENT user@example.com /private/workspace secret=fixture';
  const contaminated = log({ model: forbidden, query_source: forbidden, effort: forbidden, 'session.id': forbidden, 'request.id': forbidden, input_tokens: 5, prompt: forbidden, tool_content: forbidden, command: forbidden, 'user.email': forbidden });
  contaminated.payload.resourceLogs[0].scopeLogs[0].logRecords[0].body = { stringValue: forbidden };
  contaminated.payload.resourceLogs[0].resource.attributes.push(attr('authorization', forbidden));
  await f.put('otel-2026-10-02.ndjson', [contaminated]);
  await f.put('operations-2026-10-02.ndjson', [marker({ taskId: forbidden, selectedRoleId: forbidden, launchMode: forbidden, actorProfilePath: forbidden, capabilityProfilePaths: [forbidden], contextFingerprint: forbidden, requestedAction: forbidden })]);
  const m = await readClaudeOtel(f.root); assert.equal(m.summary.inputTokens, 5);
  const serialized = JSON.stringify(m);
  for (const value of [forbidden, 'PRIVATE_CONTENT', 'user@example.com', '/private/workspace', 'payload', 'attributes', 'body', 'request.id', 'session.id', 'actorProfilePath', 'authorization', runId]) assert.ok(!serialized.includes(value), value);
});

test('symlinks are excluded at file and runtime directory boundary', async (t) => {
  const f = await fixture(t); await writeFile(path.join(f.root, 'outside.ndjson'), JSON.stringify(log({ input_tokens: 999 })));
  await symlink(path.join(f.root, 'outside.ndjson'), path.join(f.dir, 'otel-2026-10-02.ndjson'));
  let m = await readClaudeOtel(f.root); assert.equal(m.summary.runs, null); assert.ok(m.issues.length);
  await rm(f.dir, { recursive: true }); await symlink(f.root, f.dir);
  m = await readClaudeOtel(f.root); assert.equal(m.availability, 'unavailable'); assert.ok(m.issues.length);
});

test('GET Claude OTEL, HEAD and non-GET preserve host-validated read-only API invariants', async (t) => {
  const f = await fixture(t); await f.put('otel-2026-10-02.ndjson', [log({ input_tokens: 8 })]);
  const handler = dashboardHandler({ root: f.root });
  const call = async (method, host = '127.0.0.1:12345', url = '/api/dashboard/v1/claude-otel') => {
    const r = { headers: {} }; await handler({ method, headers: { host }, url }, { setHeader(k, v) { r.headers[k.toLowerCase()] = v; }, writeHead(status) { r.status = status; }, end(body) { r.body = body; } }); return r;
  };
  const get = await call('GET'); assert.equal(get.status, 200); assert.equal(JSON.parse(get.body).summary.inputTokens, 8); assert.equal(get.headers['access-control-allow-origin'], undefined);
  const head = await call('HEAD'); assert.equal(head.status, 200); assert.equal(head.body, undefined);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) assert.equal((await call(method)).status, 405);
  assert.equal((await call('GET', 'evil.example:12345')).status, 403);
  assert.equal((await call('GET', '127.0.0.1:12345', '/api/dashboard/v1/claude-otel/extra')).status, 404);
});

test('stable OTEL query navigation preserves Throughput and both Transactions entry paths', () => {
  assert.deepEqual(telemetryTabs.map((x) => x.caption), ['Throughput', 'Claude OTEL', 'Transactions']);
  assert.equal(telemetryTab('tab=claude-otel'), 'claude-otel'); assert.equal(telemetryTabPath('claude-otel'), '/telemetry?tab=claude-otel');
  assert.equal(telemetryTab('tab=transactions'), 'transactions'); assert.equal(telemetryTabPath('transactions'), '/telemetry?tab=transactions');
  assert.equal(telemetryTabs[2].path, '/transactions'); assert.equal(telemetryTab('tab=unknown'), 'throughput'); assert.equal(telemetryTabPath('throughput'), '/telemetry');
});

test('recent-run and breakdown output remains bounded while summary retains considered measurements', async (t) => {
  const f = await fixture(t);
  await f.put('otel-2026-10-02.ndjson', [
    log({ model: 'claude-fixture-a', input_tokens: 3 }),
    log({ model: 'claude-fixture-b', input_tokens: 5 }, otherId),
  ]);
  const m = await readClaudeOtel(f.root, { ...OTEL_LIMITS, recentRuns: 1, breakdowns: 1 });
  assert.equal(m.summary.runs, 2); assert.equal(m.summary.inputTokens, 8);
  assert.equal(m.recentRuns.length, 1); assert.equal(m.recentRunsTruncated, true);
  assert.equal(m.breakdowns.model.length, 1); assert.equal(m.breakdowns.model[0].value, 'claude-fixture-b'); assert.equal(m.truncated, true);
});

const hash = (id) => createHash('sha256').update(id).digest('hex').slice(0, 12);
const nano = (stamp) => String(BigInt(Date.parse(stamp)) * 1000000n);
function sessionMetric(id, stamp, name, value, a = {}, options = {}, run = runId) {
  return metrics([metric(name, value, { 'session.id': id, ...a }, { ...options, time: nano(stamp) })], run);
}
function sessionLog(id, stamp, a = {}, run = runId) {
  const e = log({ 'session.id': id, ...a }, run);
  e.payload.resourceLogs[0].scopeLogs[0].logRecords[0].timeUnixNano = nano(stamp);
  return e;
}

test('exact sessions in one run select metrics/fallback independently, retain zeros and own ranges/models', async (t) => {
  const f = await fixture(t);
  const early = '2026-10-01T10:00:00.000Z'; const later = '2026-10-01T10:05:00.000Z'; const last = '2026-10-01T11:00:00.000Z';
  await f.put('otel-2026-10-02.ndjson', [
    sessionMetric('session-A', early, 'claude_code.token.usage', 0, { type: 'input', model: 'claude-a' }),
    sessionMetric('session-A', later, 'claude_code.cost.usage', 0, { model: 'claude-a' }, { unit: 'USD' }),
    sessionLog('session-A', later, { model: 'claude-log-a', input_tokens: 900, output_tokens: 2, cache_read_tokens: 8, cache_creation_tokens: 0, reported_cost: 99, duration_ms: 0 }),
    sessionMetric('session-B', last, 'claude_code.token.usage', 30, { type: 'output', model: 'claude-b' }),
    sessionLog('session-B', last, { model: 'claude-b', input_tokens: 4, output_tokens: 999, cost_usd: 0.3, duration_ms: 50 }),
    sessionMetric(null, time, 'claude_code.token.usage', 10000, { type: 'input', model: 'claude-unattributed' }),
    sessionLog(null, time, { input_tokens: 20000, reported_cost: 100 }),
    sessionLog('invalid/session', time, { output_tokens: 3 }),
  ]);
  const m = await readClaudeOtel(f.root);
  assert.equal(m.recentSessions.length, 2);
  const a = m.recentSessions.find((s) => s.displayId === hash('session-A'));
  const b = m.recentSessions.find((s) => s.displayId === hash('session-B'));
  assert.deepEqual(a.measures, { inputTokens: 0, outputTokens: 2, cacheReadInputTokens: 8, cacheCreationInputTokens: 0, totalMeasuredTokens: 10, reportedCostUsd: 0, requestDurationMs: 0, activeDurationMs: null, apiRequests: 1 });
  assert.equal(a.cacheReadRatio, 1);
  assert.deepEqual(b.measures, { inputTokens: 4, outputTokens: 30, cacheReadInputTokens: null, cacheCreationInputTokens: null, totalMeasuredTokens: 34, reportedCostUsd: 0.3, requestDurationMs: 50, activeDurationMs: null, apiRequests: 1 });
  assert.equal(b.cacheReadRatio, null);
  assert.equal(a.startTime, early); assert.equal(a.endTime, later);
  assert.equal(b.startTime, last); assert.equal(b.endTime, last);
  assert.equal(a.runDisplayId, hash(runId)); assert.equal(b.runDisplayId, a.runDisplayId);
  assert.deepEqual(a.models, ['claude-a', 'claude-log-a']); assert.deepEqual(b.models, ['claude-b']);
  assert.equal(m.summary.inputTokens, 10000, 'Global semantics are unchanged; session fallback is independent');
  assert.equal(m.latestObservedAt, time, 'Latest observed telemetry includes unattributed samples/envelopes');
  for (const raw of ['session-A', 'session-B', 'invalid/session', 'fixture-request', runId]) assert.ok(!JSON.stringify(m).includes(raw));
  const again = await readClaudeOtel(f.root);
  assert.deepEqual(again.recentSessions, m.recentSessions);
});

test('the same session identity in two runs remains two independent direct projections', async (t) => {
  const f = await fixture(t);
  await f.put('otel-2026-10-02.ndjson', [sessionLog('resumed-session', time, { input_tokens: 3 }), sessionLog('resumed-session', time, { input_tokens: 7 }, otherId)]);
  const m = await readClaudeOtel(f.root);
  assert.equal(m.recentSessions.length, 2); assert.equal(m.summary.sessions, 1);
  assert.equal(new Set(m.recentSessions.map((s) => s.displayId)).size, 1);
  assert.equal(new Set(m.recentSessions.map((s) => s.runDisplayId)).size, 2);
  assert.deepEqual(m.recentSessions.map((s) => s.measures.inputTokens).sort(), [3, 7]);
});

test('session series preserve cumulative/reset and delta deduplication; non-request logs cannot alter a session', async (t) => {
  const f = await fixture(t);
  const early = '2026-10-01T10:00:00.000Z'; const last = '2026-10-01T10:05:00.000Z';
  const snapshot = (value, stamp) => sessionMetric('snap-session', stamp, 'claude_code.token.usage', value, { type: 'input' }, { temporality: 2 });
  const reset = snapshot(5, last); reset.payload.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints[0].startTimeUnixNano = '2';
  const delta = sessionMetric('snap-session', last, 'claude_code.token.usage', 4, { type: 'output' });
  await f.put('otel-2026-10-02.ndjson', [snapshot(20, last), snapshot(10, early), reset, delta, delta,
    sessionMetric('snap-session', last, 'claude_code.active_time.total', 2, {}, { unit: 's' }),
    sessionLog('snap-session', time, { 'event.name': 'subagent_completed', model: 'claude-not-a-measurement', total_tokens: 999 }),
    sessionLog('only-non-request', time, { 'event.name': 'subagent_completed' }),
  ]);
  const m = await readClaudeOtel(f.root); assert.equal(m.recentSessions.length, 1);
  const s = m.recentSessions[0]; assert.equal(s.measures.inputTokens, 25); assert.equal(s.measures.outputTokens, 4);
  assert.equal(s.measures.totalMeasuredTokens, 29); assert.equal(s.measures.activeDurationMs, 2000); assert.equal(s.measures.apiRequests, null);
  assert.equal(s.startTime, early); assert.equal(s.endTime, last); assert.deepEqual(s.models, ['claude-fixture']);
});

test('recent sessions sort by end, start, hash and expose truncation without losing global totals/freshness', async (t) => {
  const f = await fixture(t);
  const earlier = '2026-10-01T09:00:00.000Z'; const later = '2026-10-01T10:00:00.000Z';
  const ids = Array.from({ length: 32 }, (_, i) => `ordered-session-${i}`);
  await f.put('otel-2026-10-02.ndjson', ids.map((id) => sessionLog(id, later, { input_tokens: 1 })));
  const expected = ids.map(hash).sort();
  let m = await readClaudeOtel(f.root);
  assert.equal(OTEL_LIMITS.recentSessions, 30); assert.equal(m.scan.limits.recentSessions, 30);
  assert.equal(m.recentSessions.length, 30); assert.deepEqual(m.recentSessions.map((s) => s.displayId), expected.slice(0, 30));
  assert.equal(m.recentSessionsTruncated, true); assert.equal(m.truncated, true); assert.equal(m.summary.inputTokens, 32);
  assert.equal(m.latestObservedAt, time);
  const newer = '2026-10-03T10:00:00.000Z';
  await f.put('otel-2026-10-03.ndjson', [sessionLog('older-start', earlier), sessionLog('older-start', newer, { 'request.id': 'second' }), sessionLog('newer-start', later), sessionLog('newer-start', newer, { 'request.id': 'second' })]);
  m = await readClaudeOtel(f.root, { ...OTEL_LIMITS, recentSessions: 2 });
  assert.deepEqual(m.recentSessions.map((s) => s.displayId), [hash('newer-start'), hash('older-start')]);
  assert.equal(m.latestObservedAt, newer); assert.equal(m.recentSessionsTruncated, true);
  const full = await readClaudeOtel(f.root, { ...OTEL_LIMITS, recentSessions: 40 }); assert.equal(full.recentSessionsTruncated, false);
});

test('missing/invalid session identities produce no session projection and empty freshness is null', async (t) => {
  const f = await fixture(t);
  await f.put('otel-2026-10-02.ndjson', [sessionLog(null, time, { input_tokens: 0 }), sessionLog('invalid id', time, { cost_usd: 0, 'request.id': 'another-request' })]);
  const m = await readClaudeOtel(f.root); assert.deepEqual(m.recentSessions, []); assert.equal(m.recentSessionsTruncated, false);
  assert.equal(m.summary.inputTokens, 0); assert.equal(m.summary.reportedCostUsd, 0); assert.equal(m.latestObservedAt, time);
  const empty = await readClaudeOtel(path.join(f.root, 'absent')); assert.equal(empty.latestObservedAt, null); assert.deepEqual(empty.recentSessions, []);
});

test('tasks observed union includes runs outside recent history, with no task consumption allocation', async (t) => {
  const f = await fixture(t);
  await f.put('otel-2026-10-02.ndjson', [sessionLog('one', time, { input_tokens: 100, cost_usd: 2 }), sessionLog('two', time, { input_tokens: 300, cost_usd: 4 }, otherId)]);
  await f.put('operations-2026-10-02.ndjson', [marker({ taskId: 'TSK-010' }), marker({ taskId: 'TSK-011' }), marker({ taskId: 'TSK-012' }, otherId), marker({ taskId: 'TSK-013' }, otherId)]);
  const m = await readClaudeOtel(f.root, { ...OTEL_LIMITS, recentRuns: 1 });
  assert.deepEqual(m.tasksObserved, ['TSK-010', 'TSK-011', 'TSK-012', 'TSK-013']); assert.equal(m.tasksObservedTruncated, false);
  for (const row of m.breakdowns.task) { assert.equal(row.runs, 1); assert.equal(row.totalMeasuredTokens, null); assert.equal(row.reportedCostUsd, null); }
  for (const session of m.recentSessions) assert.equal(session.correlation, undefined, 'Session evidence does not identify tasks');
  const bounded = await readClaudeOtel(f.root, { ...OTEL_LIMITS, breakdowns: 2 });
  assert.deepEqual(bounded.tasksObserved, ['TSK-010', 'TSK-011']); assert.equal(bounded.tasksObservedTruncated, true);
});
