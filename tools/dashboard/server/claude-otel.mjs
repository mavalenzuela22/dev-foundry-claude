import { lstat, opendir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { safeFile } from './evidence.mjs';

export const OTEL_LIMITS = Object.freeze({ entries: 4096, files: 32, fileBytes: 8 * 1024 * 1024, totalBytes: 32 * 1024 * 1024, lineBytes: 1024 * 1024, lines: 10000, records: 50000, recentRuns: 30, recentSessions: 30, breakdowns: 20 });
const base = '.dev-foundry/telemetry/local';
const filename = /^(otel|operations)-(\d{4}-\d{2}-\d{2})\.ndjson$/;
const numericFields = ['inputTokens', 'outputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens', 'totalMeasuredTokens', 'reportedCostUsd', 'requestDurationMs', 'activeDurationMs', 'apiRequests'];
const emptyMeasures = () => Object.fromEntries(numericFields.map((key) => [key, null]));
const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
const number = (v) => (typeof v === 'number' || typeof v === 'string' && /^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(v)) && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= Number.MAX_SAFE_INTEGER ? Number(v) : null;
const scalar = (v) => object(v) ? v.stringValue ?? v.intValue ?? v.doubleValue ?? v.boolValue : v;
const internalId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(v) ? v : null;
// A second presentation allowlist: no resource identity, event body, payload,
// arbitrary attributes or free-form strings ever enter a response.
const dimension = (key, v) => {
  if (typeof v !== 'string') return null;
  if (key === 'model') return /^claude-[A-Za-z0-9._-]{1,72}$/.test(v) ? v : null;
  if (key === 'effort') return ['low', 'medium', 'high', 'max', 'xhigh'].includes(v) ? v : null;
  if (key === 'querySource') return /^(main|repl_main_thread|auxiliary|subagent|agent:(?:custom|builtin)|generate_session_title|away_summary|agent_summary|prompt_suggestion)$/.test(v) ? v : null;
  if (key === 'task') return /^TSK-\d{3,6}$/.test(v) ? v : null;
  if (key === 'role') return ['governance-author', 'implementation-executor', 'mechanical-validator', 'governance-auditor', 'evidence-custodian'].includes(v) ? v : null;
  if (key === 'launchMode') return ['direct', 'dial', 'codemie'].includes(v) ? v : null;
  return null;
};
const attrKeys = new Set(['model', 'effort', 'query_source', 'type', 'event.name', 'session.id', 'request.id', 'request_id', 'timestamp', 'input_tokens', 'prompt_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_read_tokens', 'cache_creation_input_tokens', 'cache_creation_tokens', 'token_count', 'total_tokens', 'reported_cost', 'cost_usd', 'cost_usd_micros', 'duration_ms']);
function attributes(...groups) {
  const result = {};
  for (const group of groups) {
    if (Array.isArray(group)) { for (const a of group) if (attrKeys.has(a?.key)) result[a.key] = scalar(a.value); }
    else if (object(group)) { for (const key of attrKeys) if (Object.hasOwn(group, key)) result[key] = scalar(group[key]); }
  }
  return result;
}
const dims = (a) => ({ model: dimension('model', a.model), effort: dimension('effort', a.effort), querySource: dimension('querySource', a.query_source) });
function iso(v) { return typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null; }
function pointTime(p, fallback) {
  const n = p.timeUnixNano ?? p.observedTimeUnixNano;
  if (typeof n === 'string' && /^\d{1,20}$/.test(n)) { const ms = Number(BigInt(n) / 1000000n); if (ms <= 8640000000000000) return new Date(ms).toISOString(); }
  return iso(fallback);
}
function add(target, key, value) { if (value !== null) { const sum = (target[key] ?? 0) + value; target[key] = Number.isFinite(sum) ? sum : null; } }
function total(m) {
  const components = ['inputTokens', 'outputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens'].map((k) => m[k]);
  if (m.totalMeasuredTokens === null && components.some((v) => v !== null)) m.totalMeasuredTokens = components.reduce((sum, v) => sum + (v ?? 0), 0);
  return m;
}
const displayId = (id) => createHash('sha256').update(id).digest('hex').slice(0, 12);
function cacheReadRatio(m) {
  const denominator = m.inputTokens !== null && m.cacheReadInputTokens !== null && m.cacheCreationInputTokens !== null ? m.inputTokens + m.cacheReadInputTokens + m.cacheCreationInputTokens : null;
  return denominator > 0 ? m.cacheReadInputTokens / denominator : null;
}
// Shared selection semantics for both run totals and exact session partitions.
function aggregate(metricSamples, requestSamples) {
  const metrics = emptyMeasures(); const logs = emptyMeasures();
  for (const sample of metricSamples) if (sample.field !== 'sessions') add(metrics, sample.field, sample.value);
  for (const sample of requestSamples) for (const key of numericFields) add(logs, key, sample.measures[key]);
  const measures = Object.fromEntries(numericFields.map((key) => [key, metrics[key] ?? logs[key]]));
  if (metrics.totalMeasuredTokens === null && ['inputTokens', 'outputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens'].some((key) => metrics[key] !== null)) measures.totalMeasuredTokens = null;
  return total(measures);
}
function logMeasures(a) {
  const m = emptyMeasures();
  for (const [key, names] of Object.entries({ inputTokens: ['input_tokens', 'prompt_tokens'], outputTokens: ['output_tokens'], cacheReadInputTokens: ['cache_read_input_tokens', 'cache_read_tokens'], cacheCreationInputTokens: ['cache_creation_input_tokens', 'cache_creation_tokens'], totalMeasuredTokens: ['token_count', 'total_tokens'], reportedCostUsd: ['reported_cost', 'cost_usd'], requestDurationMs: ['duration_ms'] })) {
    m[key] = names.map((name) => number(a[name])).find((v) => v !== null) ?? null;
  }
  if (m.reportedCostUsd === null && number(a.cost_usd_micros) !== null) m.reportedCostUsd = number(a.cost_usd_micros) / 1000000;
  m.apiRequests = 1;
  return total(m);
}
function metricField(m, a) {
  if (m.name === 'claude_code.token.usage') return ({ input: 'inputTokens', output: 'outputTokens', cacheRead: 'cacheReadInputTokens', cache_read: 'cacheReadInputTokens', cacheCreation: 'cacheCreationInputTokens', cache_creation: 'cacheCreationInputTokens' })[a.type] ?? (a.type == null ? 'totalMeasuredTokens' : null);
  if (m.name === 'claude_code.cost.usage' && (!m.unit || m.unit === 'USD')) return 'reportedCostUsd';
  if (m.name === 'claude_code.session.count') return 'sessions';
  if (m.name === 'claude_code.active_time.total' && ['s', 'ms'].includes(m.unit)) return 'activeDurationMs';
  return null;
}

export async function readClaudeOtel(root, limits = OTEL_LIMITS) {
  const issues = new Map(); let truncated = false; let lines = 0; let records = 0; let bytes = 0; let filesRead = 0;
  const issue = (code) => issues.set(code, (issues.get(code) || 0) + 1);
  const bound = (code) => { truncated = true; issue(code); };
  const list = (value) => {
    if (value == null) return [];
    if (Array.isArray(value)) return value;
    issue('Malformed NDJSON or OTLP record excluded');
    return [];
  };
  const runs = new Map(); const markers = new Map();
  const getRun = (id) => {
    if (!runs.has(id)) runs.set(id, { id, startTime: null, endTime: null, sessions: new Set(), sessionSamples: new Map(), metricSeries: new Map(), requests: new Map(), models: new Set() });
    return runs.get(id);
  };
  const observe = (run, time, a) => {
    if (time) { if (!run.startTime || time < run.startTime) run.startTime = time; if (!run.endTime || time > run.endTime) run.endTime = time; }
    const session = internalId(a['session.id']); if (session) run.sessions.add(session);
    const model = dimension('model', a.model); if (model) run.models.add(model);
  };
  const observeSession = (run, time, a) => {
    const id = internalId(a['session.id']); if (!id) return;
    if (!run.sessionSamples.has(id)) run.sessionSamples.set(id, { startTime: null, endTime: null, models: new Set() });
    observe(run.sessionSamples.get(id), time, { model: a.model });
  };
  const candidate = () => { if (records >= limits.records) { bound('OTLP record limit reached'); return false; } records++; return true; };
  function envelope(e) {
    const run = getRun(e.telemetryRunId); observe(run, iso(e.receivedAt), {});
    if (e.signal === 'metrics') for (const r of list(e.payload.resourceMetrics)) for (const s of list(r?.scopeMetrics)) for (const m of list(s?.metrics)) {
      if (!object(m)) { issue('Malformed NDJSON or OTLP record excluded'); continue; }
      const sum = m.sum; if (!object(sum)) continue;
      for (const p of list(sum.dataPoints)) {
        if (!candidate()) return;
        if (!object(p)) { issue('Malformed NDJSON or OTLP record excluded'); continue; }
        const a = attributes(r.resource?.attributes, s.scope?.attributes, p.attributes); const time = pointTime(p, e.receivedAt); observe(run, time, a);
        const field = metricField(m, a); let value = number(p.asInt ?? p.asDouble); if (!field || value === null) continue;
        if (field === 'activeDurationMs' && m.unit === 's') value *= 1000;
        // Delta points add once per interval; cumulative points use the latest
        // snapshot of each series/start interval, never the sum of snapshots.
        const temporality = sum.aggregationTemporality;
        if (![1, 2, 'AGGREGATION_TEMPORALITY_DELTA', 'AGGREGATION_TEMPORALITY_CUMULATIVE'].includes(temporality)) { issue('Metric temporality unavailable; sample excluded'); continue; }
        const delta = temporality === 1 || temporality === 'AGGREGATION_TEMPORALITY_DELTA';
        const key = JSON.stringify([m.name, internalId(a['session.id']), dims(a), a.type ?? null, p.startTimeUnixNano ?? null, delta ? p.timeUnixNano ?? time : null]);
        const order = typeof p.timeUnixNano === 'string' && /^\d{1,20}$/.test(p.timeUnixNano) ? BigInt(p.timeUnixNano) : BigInt(time ? Date.parse(time) : 0) * 1000000n;
        observeSession(run, time, a);
        const previous = run.metricSeries.get(key);
        if (!previous || order > previous.order) run.metricSeries.set(key, { field, value, time, order, sessionId: internalId(a['session.id']), dimensions: dims(a) });
      }
    }
    if (e.signal === 'logs') for (const r of list(e.payload.resourceLogs)) for (const s of list(r?.scopeLogs)) for (const p of list(s?.logRecords)) {
      if (!candidate()) return;
      if (!object(p)) { issue('Malformed NDJSON or OTLP record excluded'); continue; }
      const a = attributes(r.resource?.attributes, s.scope?.attributes, p.attributes); const time = pointTime(p, a.timestamp ?? e.receivedAt); observe(run, time, a);
      if (!['api_request', 'claude_code.api_request'].includes(a['event.name'])) continue;
      observeSession(run, time, a);
      // Only an explicit request identity proves duplication. Equal anonymous
      // events can be different requests; count the observed records separately.
      const requestId = internalId(a['request.id'] ?? a.request_id);
      const key = requestId ? JSON.stringify([internalId(a['session.id']), requestId]) : `observed-record:${records}`;
      if (!run.requests.has(key)) run.requests.set(key, { sessionId: internalId(a['session.id']), measures: logMeasures(a), dimensions: dims(a) });
    }
  }
  let files = [];
  try {
    let current = root;
    for (const part of base.split('/')) { current = path.join(current, part); const stat = await lstat(current); if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe directory'); }
    let entries = 0;
    for await (const entry of await opendir(current)) {
      if (++entries > limits.entries) { bound('Directory entry limit reached; newest global files unknown'); break; }
      if (!filename.test(entry.name)) continue;
      if (entry.isFile()) files.push(entry.name); else issue('Unsafe telemetry file excluded');
    }
  } catch (error) { if (error.code !== 'ENOENT') issue('Telemetry directory unavailable'); }
  files.sort((a, b) => b.match(filename)[2].localeCompare(a.match(filename)[2]) || a.localeCompare(b));
  if (files.length > limits.files) { bound('Matching file limit reached'); files = files.slice(0, limits.files); }
  for (const file of files) {
    if (lines >= limits.lines || records >= limits.records || bytes >= limits.totalBytes) { bound('Total scan limit reached'); break; }
    let content;
    try { content = await safeFile(root, `${base}/${file}`, { maxBytes: Math.min(limits.fileBytes, limits.totalBytes - bytes), binary: true }); }
    catch { bound('Unreadable, unsafe or oversized file excluded'); continue; }
    filesRead++; bytes += content.length;
    for (const line of content.toString('utf8').split('\n')) {
      if (!line.trim()) continue;
      if (lines >= limits.lines || records >= limits.records) { bound('Candidate line or record limit reached'); break; }
      lines++;
      if (Buffer.byteLength(line) > limits.lineBytes) { bound('Oversized NDJSON record excluded'); continue; }
      try {
        const e = JSON.parse(line); if (!object(e) || !internalId(e.telemetryRunId)) { issue('Invalid envelope or run identity excluded'); continue; }
        if (file.startsWith('otel-') && e.schema === 'dev-foundry.claude-otel-envelope.v1' && ['metrics', 'logs'].includes(e.signal) && object(e.payload)) envelope(e);
        else if (file.startsWith('operations-') && e.schema === 'dev-foundry.claude-operation-marker.v1') {
          if (!candidate()) break;
          if (!markers.has(e.telemetryRunId)) markers.set(e.telemetryRunId, { task: new Set(), role: new Set(), launchMode: new Set() });
          for (const [key, v] of Object.entries({ task: e.taskId, role: e.selectedRoleId, launchMode: e.launchMode })) { const safe = dimension(key, v); if (safe) markers.get(e.telemetryRunId)[key].add(safe); }
        } else issue('Unsupported telemetry schema or signal excluded');
      } catch { issue('Malformed NDJSON or OTLP record excluded'); }
    }
  }
  const summary = { runs: runs.size || null, sessions: null, ...emptyMeasures(), cacheReadRatio: null };
  const groups = Object.fromEntries(['model', 'effort', 'querySource', 'task', 'role', 'launchMode'].map((key) => [key, new Map()]));
  const group = (key, value, id, measures) => {
    value ??= 'unavailable';
    const map = groups[key]; if (!map.has(value)) map.set(value, { value, runIds: new Set(), ...emptyMeasures() });
    const row = map.get(value); row.runIds.add(id); for (const field of numericFields) add(row, field, measures[field]);
  };
  const resultRuns = []; const resultSessions = []; const tasksObserved = new Set();
  const observedSessions = new Set();
  for (const run of runs.values()) {
    let measuredSessions = null;
    for (const sample of run.metricSeries.values()) if (sample.field === 'sessions') measuredSessions = (measuredSessions ?? 0) + sample.value;
    const measures = aggregate(run.metricSeries.values(), run.requests.values());
    // Partition once by the validated identity retained on each selected sample.
    const partitions = new Map([...run.sessionSamples].map(([id, observed]) => [id, { observed, metrics: [], requests: [] }]));
    for (const sample of run.metricSeries.values()) if (sample.sessionId) partitions.get(sample.sessionId).metrics.push(sample);
    for (const sample of run.requests.values()) if (sample.sessionId) partitions.get(sample.sessionId).requests.push(sample);
    for (const [id, { observed, metrics, requests }] of partitions) {
      if (observed.models.size > limits.breakdowns) bound('Session model display limit reached');
      const sessionMeasures = aggregate(metrics, requests);
      resultSessions.push({ displayId: displayId(id), runDisplayId: displayId(run.id), startTime: observed.startTime, endTime: observed.endTime, models: [...observed.models].sort().slice(0, limits.breakdowns), measures: sessionMeasures, cacheReadRatio: cacheReadRatio(sessionMeasures) });
    }
    const sessions = run.sessions.size || measuredSessions;
    for (const session of run.sessions) observedSessions.add(session);
    add(summary, 'sessions', sessions); for (const key of numericFields) add(summary, key, measures[key]);
    // Each direct dimension has its own observed coverage. Never allocate a
    // metric's totals to log-only effort/query attributes or estimate a share.
    for (const key of ['model', 'effort', 'querySource']) {
      const byValue = new Map();
      const selected = new Set();
      for (const sample of run.metricSeries.values()) if (sample.field !== 'sessions' && sample.dimensions[key]) { const value = sample.dimensions[key]; if (!byValue.has(value)) byValue.set(value, emptyMeasures()); add(byValue.get(value), sample.field, sample.value); selected.add(sample.field); }
      const componentMetrics = ['inputTokens', 'outputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens'].some((field) => selected.has(field));
      if (componentMetrics) selected.add('totalMeasuredTokens');
      for (const sample of run.requests.values()) { const value = sample.dimensions[key] ?? 'unavailable'; if (!byValue.has(value)) byValue.set(value, emptyMeasures()); for (const field of numericFields) if (!selected.has(field)) add(byValue.get(value), field, sample.measures[field]); }
      if (!byValue.size) group(key, null, run.id, measures);
      else for (const [value, m] of byValue) group(key, value, run.id, total(m));
    }
    const correlated = markers.get(run.id);
    if (run.models.size > limits.breakdowns || correlated && Object.values(correlated).some((set) => set.size > limits.breakdowns)) bound('Run dimension display limit reached');
    const correlation = Object.fromEntries(['task', 'role', 'launchMode'].map((key) => [key, correlated?.[key].size ? [...correlated[key]].sort().slice(0, limits.breakdowns) : []]));
    for (const task of correlated?.task ?? []) tasksObserved.add(task);
    // Context rows count correlated runs only; no run measurements belong to a task or role.
    for (const key of ['task', 'role', 'launchMode']) for (const value of correlated?.[key].size ? correlated[key] : [null]) group(key, value, run.id, emptyMeasures());
    resultRuns.push({ displayId: displayId(run.id), startTime: run.startTime, endTime: run.endTime, models: [...run.models].sort().slice(0, limits.breakdowns), sessions, measures, correlation });
  }
  if (observedSessions.size) summary.sessions = observedSessions.size;
  summary.cacheReadRatio = cacheReadRatio(summary);
  resultSessions.sort((a, b) => (b.endTime || '').localeCompare(a.endTime || '') || (b.startTime || '').localeCompare(a.startTime || '') || a.displayId.localeCompare(b.displayId) || a.runDisplayId.localeCompare(b.runDisplayId));
  const recentSessionsTruncated = resultSessions.length > limits.recentSessions;
  if (recentSessionsTruncated) bound('Recent session display limit reached');
  const tasksObservedTruncated = tasksObserved.size > limits.breakdowns;
  if (tasksObservedTruncated) bound('Observed task display limit reached');
  const latestObservedAt = [...runs.values()].reduce((latest, run) => run.endTime && (!latest || run.endTime > latest) ? run.endTime : latest, null);
  const breakdowns = {};
  for (const [key, map] of Object.entries(groups)) {
    const rows = [...map.values()].sort((a, b) => (b.totalMeasuredTokens ?? -1) - (a.totalMeasuredTokens ?? -1) || a.value.localeCompare(b.value));
    if (rows.length > limits.breakdowns) bound('Breakdown display limit reached');
    breakdowns[key] = rows.slice(0, limits.breakdowns).map(({ runIds, ...row }) => ({ ...row, runs: runIds.size }));
  }
  resultRuns.sort((a, b) => (b.endTime || '').localeCompare(a.endTime || '') || a.displayId.localeCompare(b.displayId));
  return { schema: 'dev-foundry.dashboard.claude-otel.v1', availability: runs.size ? 'available' : 'unavailable', semantics: { measurement: 'direct', sessions: 'Distinct observed session IDs; measured session-count metrics are fallback only when no IDs are observed', attribution: 'exact telemetryRunId correlation; shared runs are not allocated to individual operations', missing: 'unavailable (null), never estimated', totals: 'Metrics preferred independently per run or session/field; request logs fill missing fields. Token total is the measured subset; dimension coverage can differ.', cacheReadRatio: 'cache read / (input + cache read + cache creation), only when all denominator fields are measured' }, summary, breakdowns, latestObservedAt, recentSessions: resultSessions.slice(0, limits.recentSessions), recentSessionsTruncated, tasksObserved: [...tasksObserved].sort().slice(0, limits.breakdowns), tasksObservedTruncated, recentRuns: resultRuns.slice(0, limits.recentRuns), recentRunsTruncated: resultRuns.length > limits.recentRuns, truncated, issues: [...issues].map(([code, count]) => ({ code, count })), scan: { filesRead, bytesRead: bytes, candidateLines: lines, records, limits } };
}
