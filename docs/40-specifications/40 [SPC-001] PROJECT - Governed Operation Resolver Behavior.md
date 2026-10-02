---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: SPC-001
  type: SPC
  title: Governed Operation Resolver Behavior
  status: ACTIVE
artifactVersion: "3"
authorityScope: dev-foundry-claude-governed-operation-resolution
ownerRole: governance-author
canonical: true
scope:
  owns:
    - governed-operation-resolution-behavior
    - resolver-authority-selection
    - resolver-role-selection
    - resolver-staleness-detection
    - consumer-mode-activation-guard
  appliesTo:
    capabilities:
      - claude-governance-mcp
    tasks:
      - TSK-002
      - TSK-012
  excludes:
    - repository-mutation
    - implementation-execution
    - semantic-audit-verdict
    - automatic-promotion
authority:
  governedBy:
    - ADR-001
    - ADR-002
    - ADR-003
    - ARC-001
  supersedes: []
lifecycle:
  phase: active
portability: project-specific
---

# 40 [SPC-001] dev-foundry-claude - Governed Operation Resolver Behavior

## 1. Purpose

Define the required behavior of the first Claude governance MCP capability:
resolve one bounded DEV FOUNDRY operation without forcing Claude to reconstruct
the full repository authority graph.

The resolver directs Claude to authority. It does not replace that authority and
does not execute the resolved operation.

## 2. Tool surface

The MCP SHALL expose exactly one TSK-002 tool:

`resolve_governed_operation`

No generic repository, Git, shell, promotion, validation, or implementation tool
is part of this task.

## 3. Resolution inputs

The resolver accepts the contract defined by DAT-001.

A request identifies:

- one requested action;
- the expected target project;
- an optional task ID;
- an optional boundary ID;
- an optional requested role;
- an optional previously returned context fingerprint.

At least one of `taskId` or `boundaryId` is required.

`implement` requires `taskId`. Other actions MAY resolve a legitimate
taskless governance boundary when a `boundaryId` is supplied.

## 4. Project and framework resolution

For every request, the resolver SHALL:

1. obtain the project root from `CLAUDE_PROJECT_DIR`;
2. read the configured POP and project Authority Index from their canonical
   project paths;
3. verify that the POP repository identity and Authority Index subject match
   `targetProject`;
4. resolve the POP-selected adopted framework release and reject an unsupported
   framework version;
5. fail closed when required configured authority is missing, malformed,
   conflicting, or unreadable.

TSK-002 supports the currently adopted DEV FOUNDRY `2.1.0` semantics. A later
framework adoption requires explicit compatibility work rather than silent
reinterpretation.

## 5. Task resolution

When `taskId` is present, the resolver SHALL locate the task through project
Authority Index routes with `authority_class: task` and SHALL verify the
routed document's DAT-008 frontmatter identity.

Task identity is determined by the task artifact, not by assuming that an
Authority Index route ID must equal the task ID.

Resolution fails when no active route resolves the requested task, when more
than one route resolves it, or when route metadata and the target artifact
contradict each other.

A COMPLETE task remains resolvable as historical governed state, but an
`implement` request MUST reject a task whose lifecycle does not authorize
implementation.

## 6. Taskless governance resolution

The resolver SHALL support a legitimate governance operation before a product
TSK exists.

For a taskless request:

- `boundaryId` is mandatory;
- no synthetic task artifact or task ID is created or assumed;
- product implementation is prohibited;
- resolution is limited to project/bootstrap/framework authority applicable to
  the requested governance action and role.

This behavior exists specifically to support boundaries such as first-task
authoring, adoption, configured-binding reconciliation, or equivalent governed
work without repository archaeology.

## 7. Role resolution

The resolver SHALL select exactly one role.

Action defaults are:

| requestedAction | default role |
| --- | --- |
| `inspect` | POP `default_role` |
| `author` | `governance-author` |
| `implement` | `implementation-executor` |
| `validate` | `mechanical-validator` |
| `audit` | `governance-auditor` |
| `promote` | `governance-author` |
| `close` | `evidence-custodian` |

When `requestedRole` is present it MUST name an active POP binding compatible
with the requested action. An incompatible, deferred, missing, or unresolved
binding fails closed.

Compatibility is closed as follows:

| requestedAction | compatible requested role(s) |
| --- | --- |
| `inspect` | any active POP-bound role |
| `author` | `governance-author` |
| `implement` | `implementation-executor` |
| `validate` | `mechanical-validator` |
| `audit` | `governance-auditor` |
| `promote` | `governance-author` |
| `close` | `evidence-custodian` |

The resolver SHALL return the selected Actor Profile and configured Capability
Profiles without copying their complete contents into the tool result.

### 7.1 Assessment and gate mapping

The resolver SHALL return the following exact ordered identifiers:

| requestedAction | requiredAssessments | requiredGates |
| --- | --- | --- |
| `inspect` | `boundary_state` | `authority_resolved` |
| `author` | `boundary_state`, `authorization_intent`, `audit_trigger` | `authority_resolved`, `semantic_self_assessment`, `independent_audit_if_triggered`, `operator_authorization` |
| `implement` | `boundary_state`, `authorization_intent` | `authority_resolved`, `executor_fit`, `implementation_self_verification`, `projection_reconciliation_if_needed`, `mechanical_validation` |
| `validate` | `validation_coverage`, `failure_causality` | `authority_resolved`, `mechanical_validation` |
| `audit` | `audit_trigger`, `audit_disposition` | `authority_resolved`, `independent_audit_if_triggered` |
| `promote` | `boundary_state`, `authorization_intent`, `audit_disposition` | `authority_resolved`, `mechanical_validation`, `semantic_self_assessment`, `independent_audit_if_triggered`, `operator_authorization`, `promotion_state_revalidation` |
| `close` | `closure_readiness`, `audit_disposition` | `authority_resolved`, `closure_evidence`, `operator_authorization` |

These arrays are routing outputs, not claims that any listed assessment or gate
has already passed.

## 8. Authority retrieval

The resolver SHALL return the smallest deterministic authority reference set
needed to begin the bounded operation.

For a task-bound operation this set includes:

- the task artifact;
- its recursively declared active `authority.governedBy` chain;
- the selected role's Actor Profile;
- configured Capability Profiles for that role;
- the POP and project Authority Index as resolution provenance;
- framework authority needed to resolve referenced framework artifact IDs.

For a taskless operation, the set is bounded to the project/configured/framework
authority required by the action and selected role.

Each returned reference includes a repository-relative path and observed SHA-256.
The resolver returns references and hashes, not full document bodies.

## 9. Lifecycle guidance

The resolver SHALL return stable `requiredAssessments` and `requiredGates`
identifiers sufficient to direct the next bounded step.

These identifiers summarize the adopted DEV FOUNDRY 2.1.0 lifecycle and do not
constitute new methodology authority.

The resolver SHALL NOT:

- infer a semantic Governance Audit verdict;
- claim acceptance from mechanical metadata alone;
- claim Operator authorization that was not supplied by project authority;
- convert missing evidence into PASS.

## 10. Context fingerprint

Every successful resolution SHALL return a deterministic SHA-256
`contextFingerprint`.

The fingerprint input is UTF-8 text formed from:

1. the normalized operation selector fields in DAT-001 field order; then
2. the exact resolution source set sorted by repository-relative path, with one
   line per source in the form `path<TAB>sha256`.

The selector value for an omitted optional field is the empty string.

When `expectedContextFingerprint` is supplied and does not equal the freshly
computed fingerprint, the resolver returns `STALE_CONTEXT` and no success
resolution.

## 11. Failure behavior

Failures use DAT-001 stable error codes.

The resolver MUST fail closed rather than guess when it encounters:

- invalid request shape;
- target-project mismatch;
- unsupported adopted framework;
- missing, malformed, duplicate, or contradictory authority;
- an ineligible or deferred role;
- a stale context fingerprint;
- an unreadable required source.

Failure results SHALL be concise and SHALL NOT dump repository contents.

## 12. Security and side effects

Resolution is read-only.

The resolver SHALL NOT mutate files, execute shell commands, perform Git
operations, contact provider APIs, open a listening socket, or make a promotion
decision.

Reading local repository authority under `CLAUDE_PROJECT_DIR` is the complete
runtime side-effect boundary for TSK-002 resolution.

## 13. Consumer-mode activation guard (TSK-012)

The guard is MCP-boundary behavior and is not resolver behavior. The resolver, its
authority selection, role selection, fingerprint, and every failure above are unchanged.

When the governance MCP is launched through the packaged adapter entry (ADR-003), the server
SHALL, on every `resolve_governed_operation` call and before invoking the resolver, determine
whether Claude activation is complete for the consumer project. Activation is derived only from
the consumer's POP, Platform Bootstrap files, Authority Index, and the profiles they reference;
adapter-owned files and capability grant none.

Activation is complete only when all five governed roles (Governance Author, Implementation
Executor, Governance Auditor, Mechanical Validator, Evidence Custodian) are actively bound to
their Claude implementations, their required Capability Profiles are routed, active and bound to
the project, and exactly one active Platform Bootstrap exists and is the Claude bootstrap for the
project. Absent, partial, or mixed state is not complete.

When activation is not complete the server SHALL return the DAT-001 `BINDING_INACTIVE` failure,
SHALL NOT invoke the resolver, and SHALL NOT return a role binding owned by another
implementation. The tool remains listed. The guard performs only the read-only local reads that
resolution already performs.

The guard is enabled only by the packaged entry. Source-run launch, including the self-hosted
`.mcp.json` path, SHALL leave it off and behave as before.
