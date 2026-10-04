import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { lstat, open, opendir } from 'node:fs/promises';
import path from 'node:path';

export const LIMITS = Object.freeze({ entries: 2000, records: 200, bytes: 1024 * 1024, raw: 32768, depth: 4 });
const definitions = {
  executions: { file: 'status.json', id: 'taskId', state: 'status', schema: 'foundry-runner.status.v2', states: ['passed', 'failed', 'running', 'pending', 'blocked', 'cancelled', 'error'] },
  validations: { schema: 'foundry-runner.validation-request.v1' },
  transactions: { id: 'transactionId', state: 'status', states: ['pending', 'running', 'completed', 'failed', 'blocked', 'cancelled'] },
};
const segment = /^[A-Za-z0-9_.-]{1,200}$/;
const text = (v) => typeof v === 'string' && v.length > 0 && v.length <= 200 ? v : null;
const timestamp = (v) => typeof v === 'string' && v.length < 40 && Number.isFinite(Date.parse(v)) ? v : null;
const identity = (v) => text(v) && /^[A-Za-z0-9_-]{1,200}$/.test(v) ? v : null;
const requestStates = ['queued', 'running', 'passed', 'failed', 'blocked', 'cancelled', 'interrupted', 'error'];
const timeFields = ['createdAt', 'queuedAt', 'startedAt', 'finishedAt', 'interruptedAt', 'updatedAt', 'completedAt'];
const newestTime = (...values) => values.filter(Boolean).sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
const timeValue = (record) => record.time ? Date.parse(record.time) : -Infinity;
const rowId = (taskId, recordId) => createHash('sha256').update(JSON.stringify([taskId, recordId])).digest('base64url');
const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
const safeLabel = (v) => text(v) && v.trim() && !/[\u0000-\u001f\u007f]/.test(v) ? v : null;

function transactionLabel(facts) {
  for (const name of ['taskId', 'task', 'operation', 'branch']) {
    const value = Array.isArray(facts) ? facts.find((fact) => object(fact) && fact.name === name && safeLabel(fact.value))?.value : null;
    if (value) return `Repository transaction · ${value}`;
  }
  return 'Repository transaction';
}

async function requestExecutor(root, request) {
  const value = request.contractPath;
  if (typeof value !== 'string' || value.length > 4096 || value.includes('\\') || value.split('/').some((part) => part === '..' || part === '.')) return 'unknown';
  const relative = path.isAbsolute(value) ? path.relative(root, value) : value;
  if (!relative.startsWith('.dev-foundry/execution-contracts/') || !relative.endsWith('.json') || !relative.split('/').every((part) => segment.test(part)) || !/^sha256:[a-f0-9]{64}$/.test(request.contractFingerprint)) return 'unknown';
  try {
    const bytes = await safeFile(root, relative, { binary: true });
    if (`sha256:${createHash('sha256').update(bytes).digest('hex')}` !== request.contractFingerprint) return 'unknown';
    const contract = JSON.parse(bytes.toString('utf8'));
    return object(contract) && contract.schemaVersion === 'foundry-runner.execution-contract.v1' && contract.taskId === request.taskId && contract.executor === 'codex-cli' ? 'codex-cli' : 'unknown';
  } catch { return 'unknown'; }
}

// Only the fixed evidence roots are readable. Reject symlinks at every component,
// including .dev-foundry; neither record payload paths nor HTTP paths are trusted.
export async function safeFile(root, relative, { maxBytes = LIMITS.bytes, binary = false } = {}) {
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).some((part) => !segment.test(part) || (part === '..' || part === '.'))) throw new Error('Unsafe evidence path');
  let current = root;
  const parts = relative.split('/');
  let expectedFile;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    const stat = await lstat(current);
    if (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) throw new Error('Unsupported evidence path');
    if (i === parts.length - 1) expectedFile = stat;
  }
  const handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (stat.dev !== expectedFile.dev || stat.ino !== expectedFile.ino) throw new Error('Evidence changed during safe open');
    if (!stat.isFile() || stat.size > maxBytes) throw new Error('Evidence exceeds read bound');
    const buffer = Buffer.alloc(maxBytes + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > maxBytes) throw new Error('Evidence exceeds read bound');
    const content = buffer.subarray(0, bytesRead);
    return binary ? content : content.toString('utf8');
  } finally { await handle.close(); }
}

async function discover(root, kind, { base = `.dev-foundry/${kind === 'transactions' ? 'repository-transactions' : kind}`, registry = false } = {}) {
  const files = [];
  let visited = 0;
  let truncated = false;
  const issues = [];
  async function walk(relative, depth) {
    if (truncated) return;
    try {
      let current = root;
      for (const part of relative.split('/')) {
        current = path.join(current, part);
        const stat = await lstat(current);
        if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Evidence directory is unavailable or a symlink');
      }
      const directory = await opendir(current);
      for await (const entry of directory) {
        if (++visited > LIMITS.entries) { truncated = true; break; }
        if (!segment.test(entry.name)) { issues.push('Unsupported evidence name'); continue; }
        if (entry.isSymbolicLink()) { issues.push('Symlink evidence excluded'); continue; }
        if (entry.isDirectory() && kind !== 'transactions' && !registry) {
          if (depth < LIMITS.depth) await walk(`${relative}/${entry.name}`, depth + 1);
          else issues.push('Evidence nesting exceeds scan bound');
        } else if (entry.isFile() && (kind === 'transactions' || registry ? entry.name.endsWith('.json') : entry.name === definitions[kind].file)) {
          files.push(`${relative}/${entry.name}`);
          if (files.length >= LIMITS.records) { truncated = true; break; }
        }
        if (truncated) break;
      }
    } catch (error) {
      issues.push(error.code === 'ENOENT' ? 'Evidence directory is absent' : 'Evidence directory cannot be read safely');
    }
  }
  await walk(base, 0);
  return { files: files.sort(), truncated, issues: [...new Set(issues)].slice(0, 10) };
}

async function project(root, kind, source) {
  const definition = definitions[kind];
  const key = createHash('sha256').update(source).digest('base64url');
  const record = { id: key, kind, source, recordId: kind === 'executions' ? source.split('/').slice(2, -1).join('/') : path.basename(kind === 'transactions' ? source : path.dirname(source), '.json'), taskId: null, status: null, time: null, issue: null };
  try {
    const raw = await safeFile(root, source);
    const data = JSON.parse(raw);
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Unsupported record');
    if (definition.schema && data.schemaVersion !== definition.schema) throw new Error('Unsupported record schema');
    if (!definition.schema && data.schemaVersion !== undefined) throw new Error('Unsupported record schema');
    if (!definition.states.includes(data[definition.state])) throw new Error('Unsupported or missing recorded state');
    if (data.evidenceComplete === false) throw new Error('Evidence is marked incomplete');
    if (!text(data[definition.id]) || !/^[A-Za-z0-9_-]{1,200}$/.test(data[definition.id]) || !text(data[definition.state])) throw new Error('Partial record: identity or state missing');
    if (kind !== 'executions' && data[definition.id] !== record.recordId) throw new Error('Record identity conflicts with evidence location');
    if (kind !== 'executions') record.recordId = data[definition.id];
    if (kind === 'executions' && (source.split('/').length < 4 || !identity(source.split('/')[2]))) throw new Error('Invalid execution task directory');
    record.taskId = kind === 'executions' ? source.split('/')[2] : text(data.taskId);
    record.status = data[definition.state];
    record.time = kind === 'executions' ? newestTime(...timeFields.map((field) => timestamp(data[field]))) : timestamp(data.finishedAt) || timestamp(data.completedAt) || timestamp(data.updatedAt) || timestamp(data.startedAt) || timestamp(data.createdAt);
    // Presentation values come from the same validated record; missing values
    // stay missing. Do not infer an executor from the record directory.
    record.executor = text(data.executor) || text(data.executor?.id);
    record.evidenceComplete = typeof data.evidenceComplete === 'boolean' ? data.evidenceComplete : null;
    record.label = kind === 'transactions' ? transactionLabel(data.safeObservedFacts) : text(data.label);
    record.nextRequiredAction = text(data.nextRequiredAction);
    if (kind === 'executions') {
      // Status v2 does not always carry an execution ID. Only the fixed sibling
      // handoff can supply it; payload output paths are never followed.
      record.executionId = identity(data.executionId);
      record.requestId = identity(data.requestId);
      if (!record.executionId) {
        try {
          const handoff = JSON.parse(await safeFile(root, `${path.dirname(source)}/execution-handoff.json`));
          if (handoff?.schemaVersion === 'foundry-runner.execution-handoff.v1' && (handoff.taskId === record.taskId || handoff.taskId === data.taskId)) {
            record.executionId = identity(handoff.executionId);
            record.requestId = identity(handoff.requestId);
          }
        } catch { /* Missing or unsupported handoff cannot supply an identity. */ }
      }
      record.recordId = record.executionId || record.requestId || record.recordId;
      record.id = rowId(record.taskId, record.recordId);
      record.evidenceAvailable = true;
    }
    const rows = (value) => Array.isArray(value) ? value.slice(0, 64).filter((row) => row && typeof row === 'object' && !Array.isArray(row)) : [];
    const transaction = kind === 'transactions' ? {
      truncated: ['phases', 'findings', 'safeObservedFacts', 'sideEffectBoundariesCrossed'].some((key) => Array.isArray(data[key]) && data[key].length > 64),
      phases: rows(data.phases).map((phase) => ({ name: text(phase.name) || text(phase.phase), status: text(phase.status) })),
      findings: rows(data.findings).map((finding) => ({ severity: text(finding.severity), code: text(finding.code), message: text(finding.message) })),
      observedFacts: rows(data.safeObservedFacts).map((fact) => ({ name: text(fact.name), value: typeof fact.value === 'string' ? fact.value.slice(0, 500) : typeof fact.value === 'boolean' || (typeof fact.value === 'number' && Number.isFinite(fact.value)) ? fact.value : null })),
      boundaries: Array.isArray(data.sideEffectBoundariesCrossed) ? data.sideEffectBoundariesCrossed.slice(0, 64).map(text).filter(Boolean) : [],
    } : undefined;
    // Raw generated evidence is a bounded excerpt, never a path to follow or execute.
    return { ...record, transaction, facts: Object.fromEntries(['schemaVersion', 'taskId', 'validationId', 'transactionId', 'startedAt', 'finishedAt', 'createdAt', 'updatedAt', 'completedAt', 'durationMs', 'expectedBranch', 'observedBranch', 'expectedHead', 'observedHead', 'evidenceComplete', 'executorInvoked', 'nextRequiredAction'].filter((k) => ['string', 'number', 'boolean'].includes(typeof data[k])).map((k) => [k, typeof data[k] === 'string' ? data[k].slice(0, 300) : data[k]])), raw: raw.slice(0, LIMITS.raw), rawTruncated: raw.length > LIMITS.raw };
  } catch (error) {
    return { ...record, issue: error instanceof SyntaxError ? 'Malformed JSON evidence' : error.code ? 'Evidence cannot be read safely' : error.message };
  }
}

async function projectRequest(root, kind, source) {
  const raw = await safeFile(root, source);
  const data = JSON.parse(raw);
  const validation = kind === 'validations';
  const schema = validation ? definitions.validations.schema : 'foundry-runner.execution-request.v1';
  const prefix = validation ? 'valreq_' : 'req_';
  if (!object(data) || data.schemaVersion !== schema) throw new Error('Unsupported request schema');
  if (!identity(data.requestId) || !new RegExp(`^${prefix}[a-f0-9]{32}$`).test(data.requestId) || data.requestId !== path.basename(source, '.json') || !identity(data.taskId)) throw new Error('Invalid request identity');
  if (!requestStates.includes(data.status) || !timestamp(data.createdAt)) throw new Error('Unsupported request state or creation time');
  if (validation ? !identity(data.validationId) : data.executionId !== undefined && data.executionId !== null && !identity(data.executionId)) throw new Error('Invalid operation identity');
  for (const field of timeFields) {
    if (data[field] !== undefined && data[field] !== null && !timestamp(data[field])) throw new Error('Invalid request timestamp');
  }
  if (data.validationVerdict !== undefined && data.validationVerdict !== null && !['pass', 'fail', 'error', 'blocked', 'incomplete'].includes(data.validationVerdict)) throw new Error('Invalid validation verdict');
  if (data.evidenceComplete !== undefined && data.evidenceComplete !== null && typeof data.evidenceComplete !== 'boolean') throw new Error('Invalid evidence completeness');
  for (const field of ['failureReasons', 'errorCodes']) {
    if (data[field] !== undefined && (!Array.isArray(data[field]) || !data[field].every((value) => typeof value === 'string'))) throw new Error('Invalid request failures');
  }
  const executionId = validation ? null : identity(data.executionId);
  const recordId = validation ? data.validationId : executionId || data.requestId;
  const timing = Object.fromEntries(timeFields.filter((field) => timestamp(data[field])).map((field) => [field, data[field]]));
  return {
    id: rowId(data.taskId, validation ? data.requestId : recordId), kind, source, recordId,
    requestId: data.requestId, taskId: data.taskId, status: data.status, executionId,
    ...(validation ? { validationId: data.validationId, validationVerdict: data.validationVerdict || null } : {}),
    ...timing, time: validation ? data.createdAt : newestTime(...Object.values(timing)), issue: null,
    executor: validation ? text(data.executor) || text(data.executor?.id) : await requestExecutor(root, data),
    evidenceAvailable: validation ? !!text(data.evidenceLocation) : null,
    evidenceComplete: typeof data.evidenceComplete === 'boolean' ? data.evidenceComplete : null,
    failureCount: (data.failureReasons?.length || 0) + (data.errorCodes?.length || 0), errorCount: data.errorCodes?.length || 0,
    facts: { schemaVersion: schema, requestId: data.requestId, ...(validation ? { validationId: data.validationId } : executionId ? { executionId } : {}), ...timing },
    raw: raw.slice(0, LIMITS.raw), rawTruncated: raw.length > LIMITS.raw,
  };
}

async function requestRecords(root, kind) {
  const scan = await discover(root, kind, { base: `.dev-foundry/${kind === 'validations' ? 'validation' : 'execution'}-requests/requests`, registry: true });
  const records = [];
  for (const file of scan.files) {
    try { records.push(await projectRequest(root, kind, file)); }
    catch { scan.issues.push('Invalid or unreadable request excluded'); }
  }
  return { ...scan, records };
}

function mergeExecution(a, b) {
  const [newer, older] = timeValue(b) >= timeValue(a) ? [b, a] : [a, b];
  return { ...older, ...newer, requestId: newer.requestId || older.requestId,
    executor: (a.evidenceAvailable && a.executor) || (b.evidenceAvailable && b.executor) || newer.executor || older.executor, time: newestTime(a.time, b.time),
    evidenceAvailable: newer.evidenceAvailable ?? older.evidenceAvailable,
    evidenceComplete: newer.evidenceComplete ?? older.evidenceComplete,
    facts: { ...older.facts, ...newer.facts },
  };
}

export async function readRecords(root, kind) {
  if (!Object.hasOwn(definitions, kind)) throw new Error('Unknown evidence kind');
  if (kind !== 'transactions') {
    const requests = await requestRecords(root, kind);
    const candidates = [...requests.records];
    const scans = [requests];
    if (kind === 'executions') {
      const byRequest = new Map(requests.records.map((record) => [JSON.stringify([record.taskId, record.requestId]), record]));
      // Only execution status is durable execution evidence. Payload output paths
      // and post-execution validation artifacts never expand this discovery.
      {
        const scan = await discover(root, kind);
        scans.push(scan);
        for (const file of scan.files) {
          const record = await project(root, kind, file);
          if (record.issue) scan.issues.push(record.issue);
          else {
            // Directory identity remains authoritative even when a handoff carries
            // the base task ID. Merge only a matching task and operation identity.
            const request = byRequest.get(JSON.stringify([record.taskId, record.requestId]));
            if (request && (!record.executionId || !request.executionId || record.executionId === request.executionId)) {
              record.recordId = request.recordId;
              record.id = request.id;
              record.requestId = request.requestId;
              record.executionId = request.executionId || record.executionId;
            }
            candidates.push(record);
          }
        }
      }
    }
    const rows = new Map();
    for (const record of candidates) rows.set(record.id, rows.has(record.id) ? mergeExecution(rows.get(record.id), record) : record);
    const records = [...rows.values()].sort((a, b) => timeValue(b) - timeValue(a) || a.id.localeCompare(b.id));
    const issues = [...new Set(scans.flatMap((scan) => scan.issues))].slice(0, 10);
    return { records: records.slice(0, LIMITS.records), truncated: records.length > LIMITS.records || scans.some((scan) => scan.truncated), issues, availability: issues.length ? 'degraded' : 'available' };
  }
  const scan = await discover(root, kind);
  const records = [];
  for (const file of scan.files) records.push(await project(root, kind, file));
  records.sort((a, b) => (b.time ? Date.parse(b.time) : -Infinity) - (a.time ? Date.parse(a.time) : -Infinity) || a.id.localeCompare(b.id));
  return { records, truncated: scan.truncated, issues: scan.issues, availability: scan.issues.length ? 'degraded' : 'available' };
}

export function summary(model) {
  return { ...model, records: model.records.map(({ raw, rawTruncated, facts, transaction, ...record }) => record) };
}
