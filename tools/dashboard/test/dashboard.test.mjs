import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { readRecords, safeFile, summary, LIMITS } from '../server/evidence.mjs';
import { dashboardServer, dashboardHandler, listenLocal, repositoryRoot } from '../server/http.mjs';
import { menu, telemetryTabs, parseRoute, recordPath } from '../ui/routes.mjs';

const requestId = (kind, index = 1) => `${kind === 'validations' ? 'valreq' : 'req'}_${index.toString(16).padStart(32, '0')}`;
const requestFile = (kind, index = 1) => `.dev-foundry/${kind === 'validations' ? 'validation' : 'execution'}-requests/requests/${requestId(kind, index)}.json`;
const request = (kind, index = 1, overrides = {}) => ({
  schemaVersion: `foundry-runner.${kind === 'validations' ? 'validation' : 'execution'}-request.v1`,
  requestId: requestId(kind, index), taskId: 'TSK-014', status: 'queued', createdAt: '2026-10-03T13:00:00Z',
  ...(kind === 'validations' ? { validationId: `validation-${index}` } : {}), ...overrides,
});

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'dashboard-proof-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  async function put(file, data) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), typeof data === 'string' ? data : JSON.stringify(data));
  }
  await put('.dev-foundry/executions/TSK-014/run-1/status.json', { schemaVersion: 'foundry-runner.status.v2', taskId: 'TSK-014', status: 'passed', finishedAt: '2026-10-03T12:00:00Z', durationMs: 10 });
  await put(requestFile('validations'), request('validations', 1, { status: 'passed', validationVerdict: 'pass', evidenceLocation: '.dev-foundry/validations/validation-1', evidenceComplete: true }));
  await put('.dev-foundry/repository-transactions/tx-1.json', { transactionId: 'tx-1', status: 'completed', completedAt: '2026-10-03T14:00:00Z' });
  await put('dist/index.html', '<html><body>Dashboard</body></html>');
  await put('dist/assets/test.js', 'console.log("local")');
  return { root, put };
}
function handler(fixture) {
  const handle = dashboardHandler({ root: fixture.root, uiRoot: path.join(fixture.root, 'dist') });
  async function call(url, method = 'GET', headers = {}) {
    const result = { status: 0, headers: {}, body: '' };
    const response = {
      setHeader(k, v) { result.headers[k.toLowerCase()] = v; },
      writeHead(status, headers) { result.status = status; for (const [k,v] of Object.entries(headers)) this.setHeader(k, v); },
      end(body) { result.body = body === undefined ? '' : body.toString(); },
    };
    await handle({ url, method, headers: { host: '127.0.0.1:43210', ...Object.fromEntries(Object.entries(headers).map(([k,v]) => [k.toLowerCase(), v])) } }, response);
    return result;
  }
  return { call };
}

test('contract menu, tabs and every list/detail route parse without fabricated sections', () => {
  assert.deepEqual(menu.map((m) => m.caption), ['Overview', 'Live Activity', 'Executions', 'Validations', 'Telemetry']);
  assert.deepEqual(telemetryTabs.map((m) => m.caption), ['Throughput', 'Claude OTEL', 'Transactions']);
  for (const url of ['/', '/calls', '/calls/call-1', '/executions', '/executions/TSK-014/run-1', '/validations', '/validations/check-1', '/telemetry', '/transactions', '/transactions/tx-1']) assert.notEqual(parseRoute(url).section, 'unknown', url);
  for (const url of ['/unknown', '/executions/one', '/validations/two/three', '/calls/%2e%2e', '/calls/%00', '/calls/%']) assert.equal(parseRoute(url).section, 'unknown', url);
});

test('real-shaped durable records project bounded lists/details without following payload paths', async (t) => {
  const f = await fixture(t);
  for (const kind of ['executions', 'validations', 'transactions']) {
    const data = await readRecords(f.root, kind);
    assert.equal(data.records.length, 1); assert.equal(data.records[0].issue, null);
    assert.equal(summary(data).records[0].raw, undefined);
    assert.ok(data.records[0].raw);
    assert.equal(parseRoute(recordPath(data.records[0])).section, kind);
  }
  await f.put(requestFile('validations', 2), '{bad');
  await f.put(requestFile('validations', 3), { validationId: 'partial' });
  await f.put(requestFile('validations', 4), request('validations', 4, { evidenceComplete: false }));
  await f.put(requestFile('validations', 5), request('validations', 5, { status: 'imagined' }));
  await f.put(requestFile('validations', 6), request('validations', 7));
  await f.put('.dev-foundry/executions/unsupported/status.json', { schemaVersion: 'unknown', taskId: 'TSK-014', status: 'passed' });
  const checks = await readRecords(f.root, 'validations');
  assert.equal(checks.records.length, 2, 'Invalid registry records are excluded from row/page counts');
  assert.equal(checks.records.find((r) => r.validationId === 'validation-4').evidenceComplete, false);
  assert.ok(checks.issues.includes('Invalid or unreadable request excluded'));
  assert.ok((await readRecords(f.root, 'executions')).issues.includes('Unsupported record schema'));
});

test('recent activity orders recorded instants across timezone offsets, without file timestamps', async (t) => {
  const f = await fixture(t);
  await f.put('.dev-foundry/executions/TSK-014/run-2/status.json', { schemaVersion: 'foundry-runner.status.v2', taskId: 'TSK-014', status: 'passed', finishedAt: '2026-10-03T14:00:00+03:00' });
  const records = (await readRecords(f.root, 'executions')).records;
  assert.ok(records[0].source.endsWith('/run-1/status.json'));
  assert.ok(records[1].source.endsWith('/run-2/status.json'));
  assert.ok(records.every((r) => r.id.length <= 64));
});

test('oversize evidence, raw excerpts, empty roots, and record scan limits are explicit', async (t) => {
  const f = await fixture(t);
  await f.put('.dev-foundry/repository-transactions/large.json', { transactionId: 'large', status: 'completed', detail: 'x'.repeat(LIMITS.raw * 2) });
  await f.put('.dev-foundry/repository-transactions/oversize.json', 'x'.repeat(LIMITS.bytes + 1));
  const data = await readRecords(f.root, 'transactions');
  assert.equal(data.records.find((r) => r.recordId === 'large').raw.length, LIMITS.raw);
  assert.equal(data.records.find((r) => r.recordId === 'large').rawTruncated, true);
  assert.match(data.records.find((r) => r.recordId === 'oversize').issue, /bound/);
  const absent = await readRecords(path.join(f.root, 'absent'), 'executions');
  assert.equal(absent.availability, 'degraded'); assert.equal(absent.records.length, 0);
  for (let i = 0; i < LIMITS.records; i++) await f.put(`.dev-foundry/repository-transactions/extra-${i}.json`, { transactionId: `extra-${i}`, status: 'pending' });
  const bounded = await readRecords(f.root, 'transactions'); assert.equal(bounded.truncated, true); assert.equal(bounded.records.length, LIMITS.records);
});

test('symlinks and traversal cannot escape any evidence root; telemetry is never a source', async (t) => {
  const f = await fixture(t);
  await f.put('outside.json', { transactionId: 'escape', status: 'completed' });
  await symlink(path.join(f.root, 'outside.json'), path.join(f.root, '.dev-foundry/repository-transactions/escape.json'));
  await symlink(path.join(f.root, '.dev-foundry/executions/TSK-014'), path.join(f.root, '.dev-foundry/executions/linked'));
  assert.ok((await readRecords(f.root, 'transactions')).issues.includes('Symlink evidence excluded'));
  assert.equal((await readRecords(f.root, 'executions')).records.length, 1);
  for (const name of ['../outside.json', '/outside.json', '.dev-foundry/../outside.json', '.dev-foundry\\..\\outside.json', '.dev-foundry/repository-transactions/escape.json']) await assert.rejects(safeFile(f.root, name));
  await assert.rejects(readRecords(f.root, 'telemetry'));
  const linkedRoot = path.join(f.root, 'linked-root'); await mkdir(linkedRoot); await symlink(path.join(f.root, '.dev-foundry'), path.join(linkedRoot, '.dev-foundry'));
  assert.equal((await readRecords(linkedRoot, 'transactions')).records.length, 0);
});

test('HTTP routes, details, HEAD, methods, host restriction, traversal, and health are truthful', async (t) => {
  const f = await fixture(t); const { call } = handler(f);
  for (const url of ['/', '/calls', '/calls/call-1', '/executions', '/executions/TSK-014/run-1', '/validations', '/validations/check-1', '/telemetry', '/transactions', '/transactions/tx-1', '/assets/test.js']) assert.equal((await call(url)).status, 200, url);
  for (const kind of ['executions', 'validations', 'transactions']) {
    const result = await call(`/api/dashboard/v1/${kind}`); assert.equal(result.status, 200);
    const r = JSON.parse(result.body).records[0];
    const detail = await call(`/api/dashboard/v1${recordPath(r)}`); assert.equal(detail.status, 200); assert.ok(JSON.parse(detail.body).raw);
    assert.equal((await call(`/api/dashboard/v1${recordPath(r)}`, 'HEAD')).body, '');
  }
  const health = JSON.parse((await call('/api/dashboard/v1/health')).body);
  assert.deepEqual(health.dashboard, { api: 'available', ui: 'available' });
  assert.equal(health.liveActivity, 'unavailable'); assert.equal(health.throughput, 'unavailable'); assert.equal(health.data.executions.records, 1);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const result = await call('/api/dashboard/v1/executions', method); assert.equal(result.status, 405); assert.equal(result.headers.allow, 'GET, HEAD');
  }
  for (const url of ['/../package.json', '/assets/%2e%2e/index.html', '/api/dashboard/v1/transactions/%2e%2e', '/%ZZ', '/assets/%5c..%5cpackage.json']) assert.equal((await call(url)).status, 400, url);
  assert.equal((await call('/api/dashboard/v1/calls')).status, 404);
  assert.equal((await call('/api/dashboard/v1/executions/WRONG/unknown')).status, 404);
  assert.equal((await call('/api/dashboard/v1/telemetry')).status, 404);
  assert.equal((await call('/api/dashboard/v1/health', 'GET', { Host: 'evil.example' })).status, 403);
  assert.equal((await call('/package.json')).status, 404);
  await rm(path.join(f.root, 'dist/index.html'));
  assert.equal(JSON.parse((await call('/api/dashboard/v1/health')).body).dashboard.ui, 'unavailable');
  assert.equal((await call('/')).status, 503);
});

test('explicit safe port and fixed loopback options never permit fallback', async () => {
  for (const value of [0, 80, 65536, NaN, '3000']) assert.throws(() => listenLocal(dashboardServer(), value));
  const server = new EventEmitter();
  server.address = () => ({ address: '127.0.0.1', port: 43210 });
  server.listen = (options, cb) => { assert.deepEqual(options, { host: '127.0.0.1', port: 43210, exclusive: true }); cb(); };
  assert.equal((await listenLocal(server, 43210)).address, '127.0.0.1');
  server.listen = () => server.emit('error', Object.assign(new Error('occupied'), { code: 'EADDRINUSE' }));
  await assert.rejects(listenLocal(server, 43210), { code: 'EADDRINUSE' });
});

test('real loopback socket and occupied-port rejection', async (t) => {
  const server = dashboardServer();
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  } catch (error) {
    if (error.code === 'EPERM') { t.skip('Host sandbox prohibits loopback sockets (EPERM)'); return; }
    throw error;
  }
  t.after(() => new Promise((resolve) => server.close(resolve)));
  assert.equal(server.address().address, '127.0.0.1');
  const collision = dashboardServer();
  await assert.rejects(listenLocal(collision, server.address().port), { code: 'EADDRINUSE' });
});

test('actual producer durable evidence supports projections and detail IDs', async () => {
  for (const kind of ['executions', 'validations', 'transactions']) {
    const model = await readRecords(repositoryRoot, kind);
    assert.ok(model.records.some((r) => !r.issue), `${kind}: real supported evidence`);
    assert.ok(model.records.length <= LIMITS.records);
    for (const record of model.records) assert.equal(parseRoute(recordPath(record)).section, kind);
  }
});

test('frozen UI dependencies and unavailable sections stay within the task contract', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  for (const name of ['@epam/assets', '@epam/loveship', '@epam/uui', '@epam/uui-components', '@epam/uui-core']) assert.equal(pkg.dependencies[name], '6.5.1');
  assert.equal(pkg.dependencies.react, '19.1.0'); assert.equal(pkg.dependencies['react-dom'], '19.1.0'); assert.equal(pkg.dependencies.history, '4.10.1');
  assert.equal(pkg.devDependencies.vite, '7.0.4'); assert.equal(pkg.devDependencies['@vitejs/plugin-react'], '4.6.0');
  for (const [name, version] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    const installed = JSON.parse(await readFile(new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8'));
    assert.equal(installed.version, version, `${name}: installed exact version`);
  }
});

test('CSP permits required UUI font origins without opening script/connect or listener policy', async (t) => {
  const f = await fixture(t);
  const response = await handler(f).call('/');
  const directives = Object.fromEntries(response.headers['content-security-policy'].split(';').map((part) => {
    const [key, ...values] = part.trim().split(/\s+/);
    return [key, values];
  }));
  assert.deepEqual(directives['font-src'], ["'self'", 'data:', 'https://static.cdn.epam.com']);
  assert.deepEqual(directives['script-src'], ["'self'"]);
  assert.deepEqual(directives['connect-src'], ["'self'"]);
  assert.deepEqual(directives['default-src'], ["'self'"]);
  // Check installed CSS rather than assuming every UUI font uses one origin.
  for (const pkg of ['uui-components', 'uui', 'loveship']) {
    const css = await readFile(new URL(`../node_modules/@epam/${pkg}/styles.css`, import.meta.url), 'utf8');
    for (const block of css.match(/@font-face\s*\{[^}]*\}/g) || []) {
      for (const [, url] of block.matchAll(/url\(["']?(https:[^"')]+)["']?\)/g)) assert.ok(directives['font-src'].includes(new URL(url).origin), url);
    }
  }
  assert.equal((await handler(f).call('/', 'GET', { Host: 'evil.example:43210' })).status, 403);
});

test('list display metadata and transaction detail phases come only from bounded validated records', async (t) => {
  const f = await fixture(t);
  await f.put('.dev-foundry/executions/TSK-014/run-1/status.json', { schemaVersion: 'foundry-runner.status.v2', taskId: 'TSK-014', status: 'passed', executor: { id: 'codex-cli' } });
  await f.put('.dev-foundry/repository-transactions/tx-1.json', { transactionId: 'tx-1', status: 'completed', label: 'Local operation', nextRequiredAction: 'await_authorized_next_phase', phases: Array.from({ length: 100 }, () => ({ name: 'preflight', status: 'completed' })), safeObservedFacts: [{ name: 'branch', value: 'main' }], findings: [{ severity: 'info', code: 'local', message: 'Recorded finding' }] });
  const execution = summary(await readRecords(f.root, 'executions')).records[0];
  assert.equal(execution.executor, 'codex-cli');
  assert.equal(summary(await readRecords(f.root, 'validations')).records[0].evidenceComplete, true);
  const transaction = (await readRecords(f.root, 'transactions')).records[0];
  assert.equal(transaction.label, 'Repository transaction · main');
  assert.equal(transaction.nextRequiredAction, 'await_authorized_next_phase');
  assert.equal(transaction.transaction.phases.length, 64);
  assert.equal(transaction.transaction.truncated, true);
  assert.deepEqual(transaction.transaction.observedFacts, [{ name: 'branch', value: 'main' }]);
  assert.equal(summary(await readRecords(f.root, 'transactions')).records[0].transaction, undefined);
  await f.put('.dev-foundry/executions/TSK-014/run-1/status.json', { schemaVersion: 'foundry-runner.status.v2', taskId: 'TSK-014', status: 'passed' });
  assert.equal((await readRecords(f.root, 'executions')).records[0].executor, null, 'No invented executor identity');
});

test('execution union deduplicates by task and execution identity, preserves request IDs and newest valid time', async (t) => {
  const f = await fixture(t);
  const status = { schemaVersion: 'foundry-runner.status.v2', taskId: 'TSK-014', status: 'passed', executor: { id: 'codex-cli' }, startedAt: '2026-10-03T09:00:00Z', finishedAt: '2026-10-03T12:00:00Z' };
  await f.put('.dev-foundry/executions/TSK-014/run-1/status.json', status);
  await f.put('.dev-foundry/executions/TSK-014/run-1/execution-handoff.json', { schemaVersion: 'foundry-runner.execution-handoff.v1', taskId: 'TSK-014', executionId: 'execution_same', requestId: requestId('executions') });
  await f.put(requestFile('executions'), request('executions', 1, { executionId: 'execution_same', status: 'passed', createdAt: '2026-10-03T10:00:00Z', finishedAt: '2026-10-03T12:30:00+01:00' }));
  await f.put(requestFile('executions', 2), request('executions', 2));
  await f.put(requestFile('executions', 3), request('executions', 3, { taskId: 'TSK-015', executionId: 'execution_same' }));
  await f.put(requestFile('executions', 4), request('executions', 4, { executionId: '../escape' }));
  await f.put('.dev-foundry/executions/TSK-014/legacy/status.json', status);
  const model = await readRecords(f.root, 'executions');
  assert.equal(model.records.length, 4);
  const merged = model.records.find((r) => r.taskId === 'TSK-014' && r.executionId === 'execution_same');
  assert.equal(merged.requestId, requestId('executions'));
  assert.equal(merged.time, status.finishedAt, 'Compare real instants across request/status timestamps');
  assert.equal(merged.executor, 'codex-cli');
  assert.equal(merged.evidenceAvailable, true);
  assert.equal(model.records.find((r) => r.recordId === requestId('executions', 2)).executor, 'unknown');
  assert.equal(model.records[0].time, '2026-10-03T13:00:00Z');
  for (const row of model.records) {
    const detail = await handler(f).call(`/api/dashboard/v1${recordPath(row)}`);
    assert.equal(detail.status, 200);
    assert.equal(JSON.parse(detail.body).recordId, row.recordId);
  }
  await f.put(requestFile('executions'), request('executions', 1, { executionId: 'execution_same', status: 'interrupted', interruptedAt: '2026-10-03T14:00:00Z' }));
  const latest = (await readRecords(f.root, 'executions')).records[0];
  assert.equal(latest.id, merged.id, 'Identity and detail URL survive request state changes');
  assert.equal(latest.status, 'interrupted');
  assert.equal(latest.time, '2026-10-03T14:00:00Z');
  assert.equal(latest.executor, 'codex-cli', 'Retain observed durable executor even when request has none');
});

test('request-backed runs remain distinct and validation-root status cannot supply an executor', async (t) => {
  const f = await fixture(t);
  const identities = ['execution_phase_a', 'execution_retry_r2', 'execution_corrective'];
  for (let index = 0; index < identities.length; index++) {
    await f.put(requestFile('executions', index + 1), request('executions', index + 1, { executionId: identities[index], outputPath: `/outside/${identities[index]}` }));
  }
  await f.put('.dev-foundry/validations/TSK-014/corrective/status.json', { schemaVersion: 'foundry-runner.status.v2', taskId: 'TSK-014', status: 'passed', executionId: identities[2], executor: 'recorded-executor' });
  const rows = (await readRecords(f.root, 'executions')).records;
  assert.equal(rows.length, identities.length + 1, 'Three identities plus evidence-only legacy execution');
  for (const executionId of identities) assert.equal(rows.filter((r) => r.executionId === executionId).length, 1);
  assert.ok(rows.filter((r) => r.executionId).every((r) => r.executor === 'unknown'));
  assert.ok(rows.every((r) => !r.source.startsWith('.dev-foundry/validations/')));
});

test('validation list reads flat governed registry only, preserves state, timing, verdict and failures', async (t) => {
  const f = await fixture(t);
  await f.put(requestFile('validations'), request('validations', 1, { status: 'passed', finishedAt: '2026-10-03T18:00:00Z' }));
  const times = { createdAt: '2026-10-03T14:00:00Z', queuedAt: '2026-10-03T14:01:00Z', startedAt: '2026-10-03T14:02:00Z', finishedAt: '2026-10-03T14:03:00Z', interruptedAt: '2026-10-03T14:04:00Z' };
  await f.put(requestFile('validations', 2), request('validations', 2, { ...times, status: 'interrupted', validationVerdict: 'fail', evidenceLocation: '.dev-foundry/validations/validation-2', evidenceComplete: false, failureReasons: ['failed check', 'incomplete evidence'], errorCodes: ['INTERRUPTED'] }));
  for (const file of ['.dev-foundry/validations/execution/result.json', '.dev-foundry/validations/TSK-014/corrective/result.json', '.dev-foundry/executions/TSK-014/validation-report.json']) {
    await f.put(file, { validationId: 'fake', taskId: 'TSK-014', verdict: 'pass' });
  }
  await f.put('.dev-foundry/validation-requests/requests/nested/' + requestId('validations', 3) + '.json', request('validations', 3));
  await f.put('.dev-foundry/validation-requests/idempotency/' + requestId('validations', 3) + '.json', request('validations', 3));
  for (const [index, overrides] of [[4, { schemaVersion: 'foundry-runner.execution-request.v1' }], [5, { validationId: '../fake' }], [6, { taskId: null }], [7, { createdAt: 'bad' }], [8, { status: 'imaginary' }], [9, { validationVerdict: 'imaginary' }], [10, { errorCodes: 'bad' }], [11, { evidenceComplete: 'yes' }]]) {
    await f.put(requestFile('validations', index), request('validations', index, overrides));
  }
  const model = await readRecords(f.root, 'validations');
  assert.equal(model.records.length, 2);
  const row = model.records[0];
  assert.equal(row.requestId, requestId('validations', 2));
  assert.equal(row.validationId, 'validation-2');
  assert.equal(row.taskId, 'TSK-014');
  assert.equal(row.status, 'interrupted');
  assert.equal(row.validationVerdict, 'fail');
  assert.equal(row.time, times.createdAt, 'Validation order uses creation, not finish/interruption');
  for (const [key, value] of Object.entries(times)) { assert.equal(row[key], value); assert.equal(row.facts[key], value); }
  assert.equal(row.evidenceAvailable, true);
  assert.equal(row.evidenceComplete, false);
  assert.equal(row.failureCount, 3);
  assert.equal(row.errorCount, 1);
  assert.ok(model.issues.includes('Invalid or unreadable request excluded'));
});

test('transaction labels choose the first safe string by taskId, task, operation, branch priority', async (t) => {
  const f = await fixture(t);
  const cases = [
    [[{ name: 'branch', value: 'main' }, { name: 'operation', value: 'merge' }, { name: 'task', value: 'task' }, { name: 'taskId', value: 'TSK-014' }], 'TSK-014'],
    [[{ name: 'taskId', value: false }, { name: 'task', value: 'task' }, { name: 'operation', value: 'merge' }], 'task'],
    [[{ name: 'taskId', value: 'bad\nlabel' }, { name: 'task', value: ' ' }, { name: 'operation', value: 'merge' }, { name: 'branch', value: 'main' }], 'merge'],
    [[{ name: 'branch', value: 'impl/tsk-009-atomic-claude-native-cutover' }], 'impl/tsk-009-atomic-claude-native-cutover'],
    [[{ name: 'branch', value: 'main' }], 'main'],
    [[{ name: 'branch', value: 12 }, { name: 'operation', value: 'x'.repeat(201) }], null],
    [[{ name: 'taskId', value: '' }, { name: 'taskId', value: 'safe-second-value' }], 'safe-second-value'],
  ];
  for (let index = 0; index < cases.length; index++) {
    const [safeObservedFacts] = cases[index];
    await f.put(`.dev-foundry/repository-transactions/tx-label-${index}.json`, { transactionId: `tx-label-${index}`, status: 'completed', label: 'Ignored payload label', safeObservedFacts });
  }
  const rows = (await readRecords(f.root, 'transactions')).records;
  for (let index = 0; index < cases.length; index++) assert.equal(rows.find((r) => r.recordId === `tx-label-${index}`).label, 'Repository transaction' + (cases[index][1] ? ` · ${cases[index][1]}` : ''));
});

test('request registries reject symlinks and exclude unsafe records from bounded projected totals', async (t) => {
  const f = await fixture(t);
  await f.put('outside-request.json', request('validations', 2));
  await symlink(path.join(f.root, 'outside-request.json'), path.join(f.root, requestFile('validations', 2)));
  const model = await readRecords(f.root, 'validations');
  assert.equal(model.records.length, 1);
  assert.ok(model.issues.includes('Symlink evidence excluded'));
  for (let index = 3; index < LIMITS.records + 3; index++) await f.put(requestFile('validations', index), request('validations', index));
  const bounded = await readRecords(f.root, 'validations');
  assert.equal(bounded.truncated, true);
  assert.equal(bounded.records.length, LIMITS.records);
});

test('MainMenu SVG bytes equal the exact frozen asset SHA-256', async () => {
  const bytes = await readFile(new URL('../public/logo.svg', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '71e8330fd12ab24d58d6a424e5094902352052a2c89dd0d5a798b1275be7549c');
});

test('request identity is stable until execution ID exists; output location alone cannot correlate rows', async (t) => {
  const f = await fixture(t);
  const directory = '.dev-foundry/executions/TSK-014/run-1';
  await f.put(requestFile('executions'), request('executions', 1, { outputPath: path.join(f.root, directory) }));
  let rows = (await readRecords(f.root, 'executions')).records;
  assert.equal(rows.length, 2, 'A shared output directory does not prove execution/request identity');
  assert.equal(rows[0].recordId, requestId('executions'));
  const before = rows[0].id;
  await f.put(`${directory}/execution-handoff.json`, { schemaVersion: 'foundry-runner.execution-handoff.v1', taskId: 'TSK-014', requestId: requestId('executions'), executionId: 'execution_later' });
  rows = (await readRecords(f.root, 'executions')).records;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, before, 'Preserve request identity until the registry supplies executionId');
  assert.equal(rows[0].recordId, requestId('executions'));
  await f.put(requestFile('executions'), request('executions', 1, { executionId: 'execution_later', outputPath: directory }));
  rows = (await readRecords(f.root, 'executions')).records;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].recordId, 'execution_later');
  await f.put(requestFile('executions', 2), request('executions', 2, { taskId: 'TSK-015', outputPath: directory }));
  assert.equal((await readRecords(f.root, 'executions')).records.length, 2, 'Task identity prevents cross-task merging');
});


test('Claude OTEL API returns session-first allowlisted evidence and global totals read-only', async (t) => {
  const f = await fixture(t);
  const rawRun = 'api-private-run'; const rawSession = 'api-private-session'; const rawRequest = 'api-private-request';
  const stamp = '2026-10-02T12:00:00.000Z';
  const telemetry = { schema: 'dev-foundry.claude-otel-envelope.v1', telemetryRunId: rawRun, signal: 'logs', receivedAt: stamp, payload: { resourceLogs: [{ scopeLogs: [{ logRecords: [{ attributes: Object.entries({ 'event.name': 'api_request', 'session.id': rawSession, 'request.id': rawRequest, input_tokens: 0, output_tokens: 7, cost_usd: 0, model: 'claude-fixture' }).map(([key, v]) => ({ key, value: typeof v === 'number' ? { doubleValue: v } : { stringValue: v } })) }] }] }] } };
  const file = '.dev-foundry/telemetry/local/otel-2026-10-02.ndjson';
  const original = JSON.stringify(telemetry) + '\n'; await f.put(file, original);
  const response = await handler(f).call('/api/dashboard/v1/claude-otel');
  assert.equal(response.status, 200); const data = JSON.parse(response.body);
  assert.equal(data.latestObservedAt, stamp); assert.equal(data.recentSessions.length, 1);
  const session = data.recentSessions[0];
  assert.equal(session.displayId, createHash('sha256').update(rawSession).digest('hex').slice(0, 12));
  assert.equal(session.runDisplayId, createHash('sha256').update(rawRun).digest('hex').slice(0, 12));
  assert.equal(session.measures.totalMeasuredTokens, 7); assert.equal(session.measures.inputTokens, 0); assert.equal(session.measures.reportedCostUsd, 0);
  assert.equal(data.summary.totalMeasuredTokens, 7); assert.equal(data.recentSessionsTruncated, false);
  for (const value of [rawRun, rawSession, rawRequest, 'payload', 'attributes']) assert.ok(!response.body.includes(value));
  assert.equal(await readFile(path.join(f.root, file), 'utf8'), original);
});
