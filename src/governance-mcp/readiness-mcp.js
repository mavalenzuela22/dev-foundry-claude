import { createHash } from 'node:crypto';
import { z } from 'zod';
import { resolveGovernedOperation } from './resolver.js';

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const branch = z.string().regex(/^(?!.*\.\.)(?!\/)(?!.*\/$)[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/);
const repoPath = z.string().min(1).max(300).refine((value) => !value.startsWith('/') && !/^[A-Za-z]:/.test(value) && !value.includes('\\') && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value) && !/%(?:2e|2f|5c)/i.test(value) && value.split('/').every((part) => part && part !== '.' && part !== '..'));
const strict = (shape) => z.object(shape).strict();
const observationsSchema = strict({
  expected: strict({ repository: identifier, branch, head: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/) }),
  observed: strict({ repository: identifier, branch, head: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/) }),
  task: strict({ id: identifier, indexed: z.boolean(), active: z.boolean() }),
  role: strict({ id: identifier, selected: z.boolean(), active: z.boolean(), compatible: z.boolean() }),
  profile: strict({ id: identifier, expectedId: identifier, active: z.boolean(), fit: z.boolean() }),
  authorityReferences: z.array(strict({ path: repoPath, sha256: digest })),
  authorization: strict({
    predelegation: strict({ outcome: z.enum(['READY', 'BLOCKED', 'INDETERMINATE']), taskId: identifier, authorityDigest: digest, evidenceId: identifier, evidencePath: repoPath, evidenceSha256: digest }),
    intent: strict({ sourceBound: z.boolean(), taskId: identifier, authorityDigest: digest, evidenceId: identifier, evidencePath: repoPath, evidenceSha256: digest }),
  }),
  operation: strict({ scopePaths: z.array(repoPath), allowedPaths: z.array(repoPath), hardExclusions: z.array(repoPath) }),
  contract: strict({ path: repoPath, sha256: digest, expectedPath: repoPath, expectedSha256: digest, validation: z.enum(['VALID', 'INVALID']), preflight: z.enum(['READY', 'BLOCKED']) }),
  validation: strict({ required: z.array(identifier), available: z.array(identifier) }),
  executor: strict({ available: z.boolean(), evidenceId: identifier }),
  priorEffects: z.enum(['none', 'reconciled_terminal', 'unknown', 'unreconciled', 'inflight']),
  expectedContextFingerprint: digest.optional(),
});

export const readinessInputSchema = strict({
  targetProject: z.string().min(1),
  taskId: identifier,
  expectedContextFingerprint: digest.optional(),
  observations: observationsSchema.optional(),
});

const ACTIONS = {
  INVALID_REQUEST: 'Provide targetProject and taskId using their documented formats.',
  INVALID_TASK_ID: 'Provide taskId as a 1-128 character DAT-001 task identifier.',
  INVALID_CONTEXT_FINGERPRINT: 'Provide a lowercase 64-character resolver contextFingerprint or omit it to resolve the current context.',
  TARGET_MISMATCH: 'Set targetProject to the project identity resolved from the active project operating profile.',
  TASK_UNAVAILABLE: 'Resolve the indexed active task before assessing implementation readiness.',
  STALE_CONTEXT: 'Resolve the operation again and provide its current resolver contextFingerprint.',
  AUTHORITY_UNAVAILABLE: 'Reconcile the active task, authority routes, and selected implementation role in the project source of truth.',
  ROLE_UNAVAILABLE: 'Select the active implementation-executor role for this task.',
  EVIDENCE_REQUIRED: 'Continue permitted Governance Author reading and documentation. In the existing authorized native/host workflow, independently confirm Operator intent/authorization, actual Git branch and HEAD, the validated execution contract and preflight, executor availability, and prior-effect state; do not repeat this diagnostic or invent evidence.',
  INVALID_OBSERVATIONS: 'Correct the named source-binding field, then continue the existing authorized native/host checks for external gate facts; this advisory diagnostic does not need to be rerun.',
  OBSERVATION_BINDING_MISMATCH: 'Reconcile the named task, role, profile, repository identity, or canonical authority references with the current resolver result before continuing.',
  PROFILE_BINDING_MISMATCH: 'Reconcile the profile identity and source path with the active Capability Profile selected by the resolver.',
  AUTHORIZATION_EVIDENCE_UNBOUND: 'Reconcile authorization evidence references with the current indexed authority sources; semantic Operator intent still requires the independent authorized native/host check.',
  OPERATOR_AUTHORIZATION_UNVERIFIED: 'Complete the existing independent native/host check of human semantic intent and Operator authorization; continue permitted Governance Author evidence and documentation work meanwhile.',
  GIT_STATE_UNVERIFIED: 'Check the actual repository, branch, and exact HEAD through the existing host workflow.',
  EXECUTION_CONTRACT_UNVERIFIED: 'Validate the exact execution contract and complete its required preflight through the existing authorized workflow.',
  PROFILE_FIT_UNVERIFIED: 'Complete the existing source-directed capability fit assessment for the selected profile.',
  OPERATION_SELECTION_UNRESOLVED: 'Resolve and record one concrete implementation selection for this operation outside the POP role binding; the MCP cannot authenticate that selection.',
  VALIDATION_AVAILABILITY_UNVERIFIED: 'Confirm every required validation prerequisite in the current host environment.',
  EXECUTOR_AVAILABILITY_UNVERIFIED: 'Confirm current executor availability once through the existing Claude Code native/host workflow.',
  PRIOR_EFFECTS_UNVERIFIED: 'Reconcile actual prior execution effects to a terminal state through the existing host evidence before any retry.',
  PRIOR_EFFECTS_UNCLEAR: 'Reconcile prior execution effects before considering another delegation.',
  PRIOR_EFFECTS_UNRECONCILED: 'Reconcile prior execution effects to a terminal state before any retry.',
  PRIOR_EFFECTS_INFLIGHT: 'Wait for or reconcile the in-flight execution before any retry.',
};

function sha(value) { return createHash('sha256').update(value, 'utf8').digest('hex'); }
function output(outcome, reasonCodes, contextFingerprint = null, handoff = null, resolverDetail = null) {
  const ordered = [...new Set(reasonCodes)];
  const nextActions = ordered.map((code) => ACTIONS[code] ?? 'Reconcile the current governance evidence before proceeding.');
  if (typeof resolverDetail === 'string' && resolverDetail.length) {
    const bounded = resolverDetail.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu, ' ').replace(/\s+/g, ' ').slice(0, 240);
    if (bounded) nextActions.push(`Resolver detail: ${bounded}`);
  }
  return { outcome, reasonCodes: ordered, nextActions, contextFingerprint, handoff, nonAuthorizing: true, dispatchAllowed: false };
}
function invalidRequest(parsed) {
  const reasons = parsed.error.issues.map((issue) => {
    const field = issue.path.length ? issue.path.join('.') : 'request';
    if (field === 'targetProject') return 'TARGET_MISMATCH';
    if (field === 'taskId') return issue.code === 'invalid_type' && issue.input === undefined ? 'TASK_UNAVAILABLE' : 'INVALID_TASK_ID';
    if (field === 'expectedContextFingerprint') return 'INVALID_CONTEXT_FINGERPRINT';
    if (field === 'observations' || field.startsWith('observations.')) return 'INVALID_OBSERVATIONS';
    return 'INVALID_REQUEST';
  });
  return output('BLOCKED', reasons);
}
function priorEffectResult(observations, fingerprint = null) {
  const value = observations?.priorEffects;
  if (value === 'unknown') return output('INDETERMINATE', ['PRIOR_EFFECTS_UNCLEAR'], fingerprint);
  if (value === 'unreconciled') return output('INDETERMINATE', ['PRIOR_EFFECTS_UNRECONCILED'], fingerprint);
  if (value === 'inflight') return output('INDETERMINATE', ['PRIOR_EFFECTS_INFLIGHT'], fingerprint);
  return null;
}

const unresolvedExternalReasons = [
  'OPERATOR_AUTHORIZATION_UNVERIFIED',
  'GIT_STATE_UNVERIFIED',
  'EXECUTION_CONTRACT_UNVERIFIED',
  'PROFILE_FIT_UNVERIFIED',
  'VALIDATION_AVAILABILITY_UNVERIFIED',
  'EXECUTOR_AVAILABILITY_UNVERIFIED',
  'PRIOR_EFFECTS_UNVERIFIED',
];

export async function assessPredelegationReadiness(input, { projectRoot } = {}) {
  const parsed = readinessInputSchema.safeParse(input);
  if (!parsed.success) {
    const prior = priorEffectResult(input?.observations);
    return prior ?? invalidRequest(parsed);
  }
  const request = parsed.data;
  const unresolvedEffect = priorEffectResult(request.observations);
  const resolved = await resolveGovernedOperation({
    requestedAction: 'implement', targetProject: request.targetProject, taskId: request.taskId,
    requestedRole: 'implementation-executor',
    ...(request.expectedContextFingerprint ? { expectedContextFingerprint: request.expectedContextFingerprint } : {}),
  }, { projectRoot });
  if (!resolved.ok) {
    if (unresolvedEffect) return unresolvedEffect;
    if (resolved.errorCode === 'STALE_CONTEXT') return output('BLOCKED', ['STALE_CONTEXT'], null, null, resolved.message);
    if (resolved.errorCode === 'TARGET_MISMATCH') return output('BLOCKED', ['TARGET_MISMATCH'], null, null, resolved.message);
    if (resolved.errorCode === 'INVALID_REQUEST') return output('BLOCKED', ['TASK_UNAVAILABLE'], null, null, resolved.message);
    if (resolved.errorCode === 'ROLE_INELIGIBLE') return output('BLOCKED', ['ROLE_UNAVAILABLE'], null, null, resolved.message);
    return output('BLOCKED', ['AUTHORITY_UNAVAILABLE'], null, null, resolved.message);
  }
  const { resolution } = resolved;
  if (unresolvedEffect) return output(unresolvedEffect.outcome, unresolvedEffect.reasonCodes, resolution.contextFingerprint);

  // POP v3 intentionally carries stable role policy, not a concrete executor
  // binding. This MCP has no authenticated operation-selection or host channel;
  // caller observations therefore cannot establish that missing proof.
  if (resolution.frameworkVersion === '2.3.0' || resolution.role.operationSelection === 'unresolved') {
    return output('INDETERMINATE', ['OPERATION_SELECTION_UNRESOLVED', 'CAPABILITY_FIT_UNVERIFIED', ...unresolvedExternalReasons], resolution.contextFingerprint);
  }
  if (!request.observations) return output('INDETERMINATE', ['EVIDENCE_REQUIRED', ...unresolvedExternalReasons], resolution.contextFingerprint);

  const authority = resolution.authority.map(({ path, sha256 }) => ({ path, sha256 }));
  const observedAuthority = request.observations.authorityReferences
    .map(({ path, sha256 }) => ({ path, sha256 }))
    .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const canonicalAuthority = [...authority].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const role = resolution.role;
  const capabilityPaths = role.capabilityProfilePaths;
  const capabilitySources = resolution.authority.filter((entry) => entry.authorityClass === 'profile' && capabilityPaths.includes(entry.path));
  if (capabilitySources.length !== 1) return output('INDETERMINATE', ['PROFILE_BINDING_MISMATCH'], resolution.contextFingerprint);
  const capabilityId = capabilitySources[0].id;
  const obs = request.observations;
  const matches = JSON.stringify(observedAuthority) === JSON.stringify(canonicalAuthority) &&
    obs.expected.repository === request.targetProject &&
    obs.task.id === request.taskId && obs.task.indexed === true && obs.task.active === true &&
    obs.role.id === role.id && obs.role.selected === true && obs.role.active === true && obs.role.compatible === true &&
    obs.profile.id === capabilityId && obs.profile.expectedId === capabilityId && obs.profile.active === true;
  if (!matches) return output('BLOCKED', ['OBSERVATION_BINDING_MISMATCH'], resolution.contextFingerprint);
  if (!capabilityPaths.includes(capabilitySources[0].path)) return output('BLOCKED', ['PROFILE_BINDING_MISMATCH'], resolution.contextFingerprint);

  if (obs.authorization.predelegation.taskId !== request.taskId || obs.authorization.intent.taskId !== request.taskId) {
    return output('BLOCKED', ['OBSERVATION_BINDING_MISMATCH'], resolution.contextFingerprint);
  }

  const authDigest = sha(JSON.stringify(canonicalAuthority));
  const pre = obs.authorization.predelegation;
  const intent = obs.authorization.intent;
  const preSource = resolution.authority.find((entry) => entry.path === pre.evidencePath && entry.sha256 === pre.evidenceSha256 && entry.id === pre.evidenceId);
  const intentSource = resolution.authority.find((entry) => entry.path === intent.evidencePath && entry.sha256 === intent.evidenceSha256 && entry.id === intent.evidenceId);
  if (pre.authorityDigest !== authDigest || intent.authorityDigest !== authDigest || !preSource || !intentSource ||
      pre.evidenceId !== intent.evidenceId || pre.evidencePath !== intent.evidencePath || pre.evidenceSha256 !== intent.evidenceSha256) {
    return output('BLOCKED', ['AUTHORIZATION_EVIDENCE_UNBOUND'], resolution.contextFingerprint);
  }
  // The resolver binds source identity and content. This stdio tool has no
  // authenticated channel for semantic permission or current host/runner
  // facts, so caller-supplied positive or negative flags cannot produce READY.
  const reasons = [...unresolvedExternalReasons];
  if (obs.profile.fit !== true) reasons.push('PROFILE_FIT_UNVERIFIED');
  return output('INDETERMINATE', reasons, resolution.contextFingerprint);
}
