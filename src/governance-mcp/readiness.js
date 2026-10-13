import { createHash } from 'node:crypto';

/**
 * Adapter-local observation classifier, not an authorization verifier.
 * Callers must supply facts already observed by the selected Governance Author
 * or host. This module cannot authenticate arbitrary claims or establish
 * Operator identity. External runner authorization and dispatch remain
 * authoritative; this function never enqueues work.
 *
 * Input is a closed object. Its only optional property is expectedContextFingerprint.
 * Output is always { outcome, reasonCodes, nextActions, contextFingerprint,
 * handoff }; handoff is null except for READY. The fingerprint is a SHA-256
 * drift detector over safely normalized facts, not a signature or proof.
 */

const HANDOFF_LIMIT = 8192;
const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const SAFE_BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/;
const REASONS = [
  'INVALID_INPUT', 'REPOSITORY_MISMATCH', 'BRANCH_MISMATCH', 'HEAD_MISMATCH',
  'TASK_MISSING', 'TASK_INACTIVE', 'ROLE_INACTIVE_OR_UNSELECTED', 'PROFILE_INACTIVE',
  'PROFILE_ID_MISMATCH', 'PROFILE_INCOMPATIBLE', 'AUTHORITY_REFERENCE_INVALID',
  'AUTHORIZATION_MISSING', 'PREDELEGATION_NOT_READY', 'AUTHORIZATION_NOT_SOURCE_BOUND',
  'AUTHORIZATION_BINDING_MISMATCH', 'STALE_CONTEXT_FINGERPRINT', 'CONTRACT_INVALID',
  'CONTRACT_REFERENCE_MISMATCH', 'PREFLIGHT_NOT_READY', 'VALIDATION_UNAVAILABLE',
  'EXECUTOR_UNAVAILABLE', 'PATH_SCOPE_INVALID', 'HARD_EXCLUSION_COLLISION',
  'HANDOFF_TOO_LARGE', 'PRIOR_EFFECTS_UNCLEAR', 'PRIOR_EFFECTS_UNRECONCILED',
  'PRIOR_EFFECTS_INFLIGHT',
];
const ACTIONS = {
  INVALID_INPUT: 'Provide a complete object matching the documented observation contract.',
  REPOSITORY_MISMATCH: 'Reconcile the observed repository identity with the expected project.',
  BRANCH_MISMATCH: 'Reconcile the observed branch with the expected branch.',
  HEAD_MISMATCH: 'Reconcile the observed exact HEAD with the expected commit.',
  TASK_MISSING: 'Resolve and observe the indexed active task before handoff.',
  TASK_INACTIVE: 'Resolve the task lifecycle before handoff.',
  ROLE_INACTIVE_OR_UNSELECTED: 'Observe one selected, active compatible implementation role.',
  PROFILE_INACTIVE: 'Observe the selected active Capability Profile binding.',
  PROFILE_ID_MISMATCH: 'Reconcile the observed profile identity with the expected profile.',
  PROFILE_INCOMPATIBLE: 'Resolve capability fit for the bounded operation.',
  AUTHORITY_REFERENCE_INVALID: 'Supply valid repository-relative authority references and SHA-256 digests.',
  AUTHORIZATION_MISSING: 'Supply external predelegation and source-bound authorization intent evidence.',
  PREDELEGATION_NOT_READY: 'Resolve external predelegation readiness with the actual runner.',
  AUTHORIZATION_NOT_SOURCE_BOUND: 'Supply source-bound authorization intent evidence.',
  AUTHORIZATION_BINDING_MISMATCH: 'Reconcile authorization evidence identifiers and hashes with this task and authority set.',
  STALE_CONTEXT_FINGERPRINT: 'Refresh the observed evidence and its context fingerprint.',
  CONTRACT_INVALID: 'Validate the exact execution contract and its mandatory preflight.',
  CONTRACT_REFERENCE_MISMATCH: 'Reconcile the exact contract path and digest with its expected reference.',
  PREFLIGHT_NOT_READY: 'Complete the contract preflight before handoff.',
  VALIDATION_UNAVAILABLE: 'Make every mandatory validation prerequisite available.',
  EXECUTOR_UNAVAILABLE: 'Resolve actual executor availability through the external runner.',
  PATH_SCOPE_INVALID: 'Reconcile the operation scope with its exact allowed path set.',
  HARD_EXCLUSION_COLLISION: 'Remove every allowed path that intersects a hard exclusion.',
  HANDOFF_TOO_LARGE: 'Reduce the bounded handoff inputs and resolve the scope with the Governance Author.',
  PRIOR_EFFECTS_UNCLEAR: 'Reconcile prior execution effects before considering another attempt.',
  PRIOR_EFFECTS_UNRECONCILED: 'Reconcile prior execution effects to a terminal state before any retry.',
  PRIOR_EFFECTS_INFLIGHT: 'Wait for or reconcile the in-flight execution before any retry.',
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value, required, optional = []) {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  return required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key));
}
function id(value) { return typeof value === 'string' && SAFE_ID.test(value); }
function branch(value) { return typeof value === 'string' && SAFE_BRANCH.test(value) && !value.includes('..'); }
function digest(value) { return typeof value === 'string' && SHA256.test(value); }
function gitObjectId(value) { return typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value); }
function repoPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 300 || value.startsWith('/') ||
      /^[A-Za-z]:/.test(value) || value.includes('\\') || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) return false;
  const parts = value.split('/');
  if (!parts.every((part) => part && part !== '.' && part !== '..')) return false;
  // Encoded dot and separator bytes can be reinterpreted as traversal by
  // downstream path consumers. Keep literal repository path bytes unchanged.
  if (/%(?:2e|2f|5c)/i.test(value)) return false;
  return true;
}
function stringSet(value, check) {
  return Array.isArray(value) && value.length > 0 && value.every(check) && new Set(value).size === value.length;
}
function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function sorted(value) { return [...value].sort(compare); }
function sha(value) { return createHash('sha256').update(value, 'utf8').digest('hex'); }
function intersects(a, b) { return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`); }

function validShape(x) {
  return exactKeys(x, ['expected', 'observed', 'task', 'role', 'profile', 'authorityReferences', 'authorization', 'operation', 'contract', 'validation', 'executor', 'priorEffects'], ['expectedContextFingerprint']) &&
    exactKeys(x.expected, ['repository', 'branch', 'head']) && id(x.expected.repository) && branch(x.expected.branch) && gitObjectId(x.expected.head) &&
    exactKeys(x.observed, ['repository', 'branch', 'head']) && id(x.observed.repository) && branch(x.observed.branch) && gitObjectId(x.observed.head) &&
    exactKeys(x.task, ['id', 'indexed', 'active']) && id(x.task.id) && typeof x.task.indexed === 'boolean' && typeof x.task.active === 'boolean' &&
    exactKeys(x.role, ['id', 'selected', 'active', 'compatible']) && id(x.role.id) && typeof x.role.selected === 'boolean' && typeof x.role.active === 'boolean' && typeof x.role.compatible === 'boolean' &&
    exactKeys(x.profile, ['id', 'expectedId', 'active', 'fit']) && id(x.profile.id) && id(x.profile.expectedId) && typeof x.profile.active === 'boolean' && typeof x.profile.fit === 'boolean' &&
    Array.isArray(x.authorityReferences) && x.authorityReferences.length > 0 && x.authorityReferences.every((r) => exactKeys(r, ['path', 'sha256']) && repoPath(r.path) && digest(r.sha256)) && new Set(x.authorityReferences.map((r) => r.path)).size === x.authorityReferences.length &&
    exactKeys(x.authorization, ['predelegation', 'intent']) &&
    exactKeys(x.authorization.predelegation, ['outcome', 'taskId', 'authorityDigest', 'evidenceId', 'evidencePath', 'evidenceSha256']) && ['READY', 'BLOCKED', 'INDETERMINATE'].includes(x.authorization.predelegation.outcome) && id(x.authorization.predelegation.taskId) && digest(x.authorization.predelegation.authorityDigest) && id(x.authorization.predelegation.evidenceId) && repoPath(x.authorization.predelegation.evidencePath) && digest(x.authorization.predelegation.evidenceSha256) &&
    exactKeys(x.authorization.intent, ['sourceBound', 'taskId', 'authorityDigest', 'evidenceId', 'evidencePath', 'evidenceSha256']) && typeof x.authorization.intent.sourceBound === 'boolean' && id(x.authorization.intent.taskId) && digest(x.authorization.intent.authorityDigest) && id(x.authorization.intent.evidenceId) && repoPath(x.authorization.intent.evidencePath) && digest(x.authorization.intent.evidenceSha256) &&
    exactKeys(x.operation, ['scopePaths', 'allowedPaths', 'hardExclusions']) && stringSet(x.operation.scopePaths, repoPath) && stringSet(x.operation.allowedPaths, repoPath) && Array.isArray(x.operation.hardExclusions) && x.operation.hardExclusions.every(repoPath) && new Set(x.operation.hardExclusions).size === x.operation.hardExclusions.length &&
    exactKeys(x.contract, ['path', 'sha256', 'expectedPath', 'expectedSha256', 'validation', 'preflight']) && repoPath(x.contract.path) && digest(x.contract.sha256) && repoPath(x.contract.expectedPath) && digest(x.contract.expectedSha256) && ['VALID', 'INVALID'].includes(x.contract.validation) && ['READY', 'BLOCKED'].includes(x.contract.preflight) &&
    exactKeys(x.validation, ['required', 'available']) && stringSet(x.validation.required, id) && Array.isArray(x.validation.available) && x.validation.available.every(id) && new Set(x.validation.available).size === x.validation.available.length &&
    exactKeys(x.executor, ['available', 'evidenceId']) && typeof x.executor.available === 'boolean' && id(x.executor.evidenceId) &&
    ['none', 'reconciled_terminal', 'unknown', 'unreconciled', 'inflight'].includes(x.priorEffects) &&
    (x.expectedContextFingerprint === undefined || digest(x.expectedContextFingerprint));
}

function normalizedFacts(x) {
  return {
    expected: x.expected,
    observed: x.observed,
    task: x.task,
    role: x.role,
    profile: x.profile,
    authorityReferences: x.authorityReferences.map((r) => ({ ...r })).sort((a, b) => compare(a.path, b.path)),
    authorization: {
      predelegation: { ...x.authorization.predelegation },
      intent: { ...x.authorization.intent },
    },
    operation: {
      scopePaths: sorted(x.operation.scopePaths),
      allowedPaths: sorted(x.operation.allowedPaths),
      hardExclusions: sorted(x.operation.hardExclusions),
    },
    contract: x.contract,
    validation: { required: sorted(x.validation.required), available: sorted(x.validation.available) },
    executor: x.executor,
    priorEffects: x.priorEffects,
  };
}

function result(outcome, reasons, fingerprint = null, handoff = null) {
  const ordered = REASONS.filter((code) => reasons.has(code));
  return {
    outcome,
    reasonCodes: ordered,
    nextActions: ordered.map((code) => ACTIONS[code]),
    contextFingerprint: fingerprint,
    handoff,
  };
}

/** Evaluate an already-observed evidence bundle without performing I/O. */
export function evaluateReadiness(input) {
  if (!validShape(input)) {
    const malformed = new Set(['INVALID_INPUT']);
    if (isObject(input)) {
      if (!isObject(input.task) || input.task.indexed !== true) malformed.add('TASK_MISSING');
      if (!Array.isArray(input.authorityReferences) || input.authorityReferences.length === 0 || input.authorityReferences.some((r) => !isObject(r) || !repoPath(r.path) || !digest(r.sha256))) malformed.add('AUTHORITY_REFERENCE_INVALID');
      if (!isObject(input.authorization) || !isObject(input.authorization.predelegation) || !isObject(input.authorization.intent)) malformed.add('AUTHORIZATION_MISSING');
      if (['unknown', 'unreconciled', 'inflight'].includes(input.priorEffects)) {
        malformed.add(input.priorEffects === 'unknown' ? 'PRIOR_EFFECTS_UNCLEAR' : input.priorEffects === 'inflight' ? 'PRIOR_EFFECTS_INFLIGHT' : 'PRIOR_EFFECTS_UNRECONCILED');
      }
    }
    const indeterminate = ['PRIOR_EFFECTS_UNCLEAR', 'PRIOR_EFFECTS_UNRECONCILED', 'PRIOR_EFFECTS_INFLIGHT'].some((r) => malformed.has(r));
    return result(indeterminate ? 'INDETERMINATE' : 'BLOCKED', malformed);
  }

  const facts = normalizedFacts(input);
  const fingerprint = sha(JSON.stringify(facts));
  const reasons = new Set();
  const prior = input.priorEffects;
  if (prior === 'unknown') reasons.add('PRIOR_EFFECTS_UNCLEAR');
  if (prior === 'unreconciled') reasons.add('PRIOR_EFFECTS_UNRECONCILED');
  if (prior === 'inflight') reasons.add('PRIOR_EFFECTS_INFLIGHT');

  if (input.expected.repository !== input.observed.repository) reasons.add('REPOSITORY_MISMATCH');
  if (input.expected.branch !== input.observed.branch) reasons.add('BRANCH_MISMATCH');
  if (input.expected.head !== input.observed.head) reasons.add('HEAD_MISMATCH');
  if (!input.task.indexed) reasons.add('TASK_MISSING');
  else if (!input.task.active) reasons.add('TASK_INACTIVE');
  if (!input.role.selected || !input.role.active || !input.role.compatible) reasons.add('ROLE_INACTIVE_OR_UNSELECTED');
  if (!input.profile.active) reasons.add('PROFILE_INACTIVE');
  if (input.profile.id !== input.profile.expectedId) reasons.add('PROFILE_ID_MISMATCH');
  if (!input.profile.fit) reasons.add('PROFILE_INCOMPATIBLE');
  const authorityDigest = sha(JSON.stringify(facts.authorityReferences));
  const pre = input.authorization.predelegation;
  const intent = input.authorization.intent;
  if (pre.outcome === 'INDETERMINATE') reasons.add('AUTHORIZATION_MISSING');
  else if (pre.outcome !== 'READY') reasons.add('PREDELEGATION_NOT_READY');
  if (!intent.sourceBound) reasons.add('AUTHORIZATION_NOT_SOURCE_BOUND');
  const authRef = input.authorityReferences.find((ref) => ref.path === pre.evidencePath && ref.sha256 === pre.evidenceSha256);
  if (pre.taskId !== input.task.id || intent.taskId !== input.task.id || pre.authorityDigest !== authorityDigest || intent.authorityDigest !== authorityDigest || pre.evidenceId !== intent.evidenceId || pre.evidencePath !== intent.evidencePath || pre.evidenceSha256 !== intent.evidenceSha256 || !authRef) reasons.add('AUTHORIZATION_BINDING_MISMATCH');
  if (input.expectedContextFingerprint && input.expectedContextFingerprint !== fingerprint) reasons.add('STALE_CONTEXT_FINGERPRINT');
  if (input.contract.validation !== 'VALID') reasons.add('CONTRACT_INVALID');
  if (input.contract.path !== input.contract.expectedPath || input.contract.sha256 !== input.contract.expectedSha256) reasons.add('CONTRACT_REFERENCE_MISMATCH');
  if (input.contract.preflight !== 'READY') reasons.add('PREFLIGHT_NOT_READY');
  if (input.validation.required.some((r) => !input.validation.available.includes(r))) reasons.add('VALIDATION_UNAVAILABLE');
  if (!input.executor.available) reasons.add('EXECUTOR_UNAVAILABLE');
  const scope = new Set(input.operation.scopePaths);
  if (scope.size !== input.operation.allowedPaths.length || input.operation.allowedPaths.some((p) => !scope.has(p))) reasons.add('PATH_SCOPE_INVALID');
  if (input.operation.allowedPaths.some((p) => input.operation.hardExclusions.some((e) => intersects(p, e)))) reasons.add('HARD_EXCLUSION_COLLISION');

  if (reasons.size) {
    const indeterminate = ['PRIOR_EFFECTS_UNCLEAR', 'PRIOR_EFFECTS_UNRECONCILED', 'PRIOR_EFFECTS_INFLIGHT'].some((r) => reasons.has(r));
    return result(indeterminate ? 'INDETERMINATE' : 'BLOCKED', reasons, fingerprint);
  }

  const handoff = {
    project: input.expected.repository,
    task: input.task.id,
    role: { id: input.role.id, profileId: input.profile.id, capabilityFitObserved: input.profile.fit },
    authority: facts.authorityReferences,
    authorization: {
      predelegationEvidence: { id: pre.evidenceId, path: pre.evidencePath, sha256: pre.evidenceSha256 },
      intentEvidence: { id: intent.evidenceId, path: intent.evidencePath, sha256: intent.evidenceSha256 },
    },
    boundary: {
      scopePaths: facts.operation.scopePaths,
      allowedPaths: facts.operation.allowedPaths,
      hardExclusions: facts.operation.hardExclusions,
    },
    contract: { path: input.contract.path, sha256: input.contract.sha256 },
    validation: { required: facts.validation.required },
    contextFingerprint: fingerprint,
    readOnly: true,
  };
  if (Buffer.byteLength(JSON.stringify(handoff), 'utf8') >= HANDOFF_LIMIT) {
    return result('BLOCKED', new Set(['HANDOFF_TOO_LARGE']), fingerprint);
  }
  return result('READY', new Set(), fingerprint, handoff);
}
