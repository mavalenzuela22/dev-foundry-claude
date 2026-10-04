import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readRecords } from '../server/evidence.mjs';

const requestId = (index) => `req_${index.toString(16).padStart(32, '0')}`;
const requestFile = (index) => `.dev-foundry/execution-requests/requests/${requestId(index)}.json`;
const request = (index, fields = {}) => ({ schemaVersion: 'foundry-runner.execution-request.v1', requestId: requestId(index), taskId: 'TSK-014', status: 'passed', createdAt: '2026-10-03T10:00:00Z', ...fields });
const status = (fields = {}) => ({ schemaVersion: 'foundry-runner.status.v2', taskId: 'TSK-014', status: 'passed', finishedAt: '2026-10-03T12:00:00Z', ...fields });
const fingerprint = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'dashboard-execution-parity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (file, data) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), typeof data === 'string' ? data : JSON.stringify(data));
  };
  return { root, put };
}

test('validations is never an execution source, even with matching requests, handoffs and codex status', async (t) => {
  const f = await fixture(t);
  await mkdir(path.join(f.root, '.dev-foundry/executions'), { recursive: true });
  for (const index of [1, 2]) {
    const directory = `.dev-foundry/validations/TSK-014/corrective-${index}`;
    await f.put(requestFile(index), request(index, { executionId: `execution-${index}`, outputPath: path.join(f.root, directory), executor: 'codex-cli' }));
    await f.put(`${directory}/status.json`, status({ executionId: `execution-${index}`, requestId: requestId(index), executor: 'codex-cli' }));
    await f.put(`${directory}/execution-handoff.json`, { schemaVersion: 'foundry-runner.execution-handoff.v1', taskId: 'TSK-014', executionId: `execution-${index}`, requestId: requestId(index) });
  }
  // Even malformed content here cannot degrade the execution snapshot.
  await f.put('.dev-foundry/validations/unrelated/status.json', '{broken');
  await f.put('.dev-foundry/validations/only-evidence/status.json', status());
  const model = await readRecords(f.root, 'executions');
  assert.equal(model.records.length, 2);
  assert.deepEqual(model.issues, []);
  assert.ok(model.records.every((record) => record.executor === 'unknown' && record.evidenceAvailable !== true && record.source.startsWith('.dev-foundry/execution-requests/')));
});

test('safe durable task directories anchor retry/phase identity even when payload and handoff use base task IDs', async (t) => {
  const f = await fixture(t);
  const tasks = ['TSK-009-phase-a', 'TSK-008-r3', 'TSK-008-r2', 'TSK-007-r3', 'TSK-007-r2'];
  for (let index = 0; index < tasks.length; index++) {
    const taskId = tasks[index];
    const baseTask = taskId.slice(0, 7);
    // Deliberately reuse operation IDs: different tasks still cannot collapse.
    await f.put(requestFile(index + 1), request(index + 1, { taskId: baseTask, executionId: 'shared-execution' }));
    await f.put(`.dev-foundry/executions/${taskId}/status.json`, status({ taskId: baseTask, executor: { id: 'durable-executor' }, finishedAt: `2026-10-03T12:0${index}:00Z` }));
    await f.put(`.dev-foundry/executions/${taskId}/execution-handoff.json`, { schemaVersion: 'foundry-runner.execution-handoff.v1', taskId: baseTask, executionId: 'shared-execution', requestId: requestId(index + 1) });
  }
  await f.put('.dev-foundry/executions/status.json', status());
  await f.put('.dev-foundry/executions/unsafe.task/status.json', status());
  await f.put('.dev-foundry/executions/unsafe task/status.json', status());
  await f.put('outside/status.json', status());
  await symlink(path.join(f.root, 'outside'), path.join(f.root, '.dev-foundry/executions/TSK-symlink'));
  const model = await readRecords(f.root, 'executions');
  const durable = model.records.filter((record) => record.evidenceAvailable);
  assert.deepEqual(durable.map((record) => record.taskId), [...tasks].reverse());
  assert.equal(new Set(durable.map((record) => record.id)).size, tasks.length);
  assert.ok(durable.every((record) => record.executionId === 'shared-execution' && record.executor === 'durable-executor'));
  assert.ok(model.records.some((record) => record.taskId === 'TSK-008'), 'Request base identity remains a separate row');
  assert.ok(model.issues.includes('Invalid execution task directory'));
  assert.ok(model.issues.includes('Symlink evidence excluded'));
});

test('request-only codex attribution requires exact current contract bytes, matching schema/task and truthful executor', async (t) => {
  const f = await fixture(t);
  const contractPath = '.dev-foundry/execution-contracts/TSK-014.json';
  const contract = { schemaVersion: 'foundry-runner.execution-contract.v1', taskId: 'TSK-014', executor: 'codex-cli' };
  const bytes = JSON.stringify(contract, null, 2) + '\n';
  await f.put(contractPath, bytes);
  await f.put('outside-contract.json', bytes);
  await mkdir(path.join(f.root, '.dev-foundry/execution-contracts/link'));
  await symlink(path.join(f.root, 'outside-contract.json'), path.join(f.root, '.dev-foundry/execution-contracts/symlink.json'));
  await symlink(path.join(f.root, '.dev-foundry/execution-contracts'), path.join(f.root, '.dev-foundry/execution-contracts/link/directory'));
  const cases = [
    [{ contractPath, contractFingerprint: fingerprint(bytes) }, 'codex-cli'],
    [{ contractPath: path.join(f.root, contractPath), contractFingerprint: fingerprint(bytes) }, 'codex-cli'],
    [{ contractPath, contractFingerprint: fingerprint(JSON.stringify(contract)) }, 'unknown'],
    [{ contractPath, contractFingerprint: `sha256:${'0'.repeat(64)}` }, 'unknown'],
    [{ contractPath }, 'unknown'],
    [{ executor: 'codex-cli' }, 'unknown'],
    [{ contractPath: '.dev-foundry/execution-contracts/missing.json', contractFingerprint: fingerprint(bytes) }, 'unknown'],
    [{ contractPath: '.dev-foundry/execution-contracts/symlink.json', contractFingerprint: fingerprint(bytes) }, 'unknown'],
    [{ contractPath: '.dev-foundry/execution-contracts/link/directory/TSK-014.json', contractFingerprint: fingerprint(bytes) }, 'unknown'],
    [{ contractPath: 'outside-contract.json', contractFingerprint: fingerprint(bytes) }, 'unknown'],
    [{ contractPath: '.dev-foundry/execution-contracts/../../outside-contract.json', contractFingerprint: fingerprint(bytes) }, 'unknown'],
    [{ contractPath: '/outside/TSK-014.json', contractFingerprint: fingerprint(bytes) }, 'unknown'],
    [{ contractPath, contractFingerprint: 'invalid' }, 'unknown'],
    [{ contractPath, contractFingerprint: fingerprint(bytes), taskId: 'TSK-other' }, 'unknown'],
  ];
  for (const [index, fields] of [
    [15, { ...contract, executor: 'other-executor' }],
    [16, { ...contract, schemaVersion: 'unsupported' }],
    [17, '{broken'],
  ]) {
    const content = typeof fields === 'string' ? fields : JSON.stringify(fields);
    const file = `.dev-foundry/execution-contracts/contract-${index}.json`;
    await f.put(file, content);
    cases.push([{ contractPath: file, contractFingerprint: fingerprint(content) }, 'unknown']);
  }
  for (let index = 0; index < cases.length; index++) await f.put(requestFile(index + 1), request(index + 1, cases[index][0]));
  const model = await readRecords(f.root, 'executions');
  assert.equal(model.records.length, cases.length, 'Unverifiable contract affects attribution, not request inclusion');
  for (let index = 0; index < cases.length; index++) assert.equal(model.records.find((record) => record.requestId === requestId(index + 1)).executor, cases[index][1], `case ${index + 1}`);
  await f.put(contractPath, bytes + ' ');
  assert.equal((await readRecords(f.root, 'executions')).records.find((record) => record.requestId === requestId(1)).executor, 'unknown', 'Reverify current bytes on each projection');
});

test('trustworthy durable executor wins over a newer verified request; unsupported status cannot supply one', async (t) => {
  const f = await fixture(t);
  const contractPath = '.dev-foundry/execution-contracts/TSK-014.json';
  const bytes = JSON.stringify({ schemaVersion: 'foundry-runner.execution-contract.v1', taskId: 'TSK-014', executor: 'codex-cli' });
  await f.put(contractPath, bytes);
  await f.put(requestFile(1), request(1, { executionId: 'execution-1', contractPath, contractFingerprint: fingerprint(bytes), finishedAt: '2026-10-03T14:00:00Z' }));
  await f.put('.dev-foundry/executions/TSK-014/status.json', status({ executionId: 'execution-1', executor: { id: 'durable-executor' } }));
  let model = await readRecords(f.root, 'executions');
  assert.equal(model.records.length, 1);
  assert.equal(model.records[0].executor, 'durable-executor');
  assert.equal(model.records[0].time, '2026-10-03T14:00:00Z');
  assert.equal(model.records[0].evidenceAvailable, true);
  for (const fields of [{ schemaVersion: 'unsupported' }, { status: 'invented' }, { evidenceComplete: false }]) {
    await f.put('.dev-foundry/executions/TSK-014/status.json', status({ executionId: 'execution-1', executor: 'untrustworthy', ...fields }));
    model = await readRecords(f.root, 'executions');
    assert.equal(model.records.length, 1);
    assert.equal(model.records[0].executor, 'codex-cli');
    assert.notEqual(model.records[0].evidenceAvailable, true);
  }
});

test('matching request ID cannot merge conflicting executions or distinct task identities', async (t) => {
  const f = await fixture(t);
  await f.put(requestFile(1), request(1, { executionId: 'request-execution' }));
  await f.put('.dev-foundry/executions/TSK-014/status.json', status({ requestId: requestId(1), executionId: 'other-execution', executor: 'durable' }));
  await f.put('.dev-foundry/executions/TSK-014-r2/status.json', status({ requestId: requestId(1), executionId: 'request-execution', executor: 'retry' }));
  const model = await readRecords(f.root, 'executions');
  assert.equal(model.records.length, 3);
  assert.equal(model.records.find((record) => record.source.startsWith('.dev-foundry/execution-requests/')).executor, 'unknown');
  assert.deepEqual(new Set(model.records.map((record) => record.taskId)), new Set(['TSK-014', 'TSK-014-r2']));
});
