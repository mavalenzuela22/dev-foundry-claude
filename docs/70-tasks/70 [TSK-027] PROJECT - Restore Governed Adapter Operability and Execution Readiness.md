---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-027
  type: TSK
  title: Restore Governed Adapter Operability and Execution Readiness
  status: CLOSED
artifactVersion: "31"
authorityScope: tsk-027-governed-adapter-operability-and-readiness
ownerRole: governance-author
canonical: true
scope:
  owns:
    - governance-authoring-and-predelegation-operability
    - deterministic-execution-readiness
    - governance-mcp-contract-discoverability-and-diagnostics
    - role-handoff-efficiency-without-independence-loss
    - governed-profile-reconciliation-for-producer-maintenance
  appliesTo:
    components:
      - producer-configured-authority
      - claude-governance-mcp-resolver-and-server
      - claude-adapter-role-templates
      - governance-mcp-and-bootstrap-tests
  excludes:
    - tsk-026-runtime-lifecycle-implementation-or-evidence
    - mutation-of-consumer-or-other-repositories
    - mutation-of-immutable-dev-foundry-2-1-0-release
    - foundry-runner-product-or-methodology-repository-changes
    - implicit-implementation-executor-activation
    - removal-of-independent-audit-observation
    - bypass-of-operator-authorization-or-role-separation
    - unapproved-release-publication-or-consumer-adoption
authority:
  governedBy:
    - ADR-001
    - ADR-002
    - ADR-004
    - ADR-006
    - ARC-001
    - SPC-001
    - SPC-003
    - SPC-007
    - DAT-001
    - DAT-002
    - OPS-001
    - OPS-002
    - OPS-003
    - OPS-004
    - OPS-007
    - OPS-008
    - OPS-009
    - DAT-016
  supersedes: []
traceability:
  closureArtifact: TSK-027-CLOSURE
  derivedFrom:
    - TSK-002
    - TSK-007
    - TSK-024
    - TSK-026
lifecycle:
  phase: closed
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-027] PROJECT - Restore Governed Adapter Operability and Execution Readiness

## 1. Operator authorization and baseline

The Operator authorized a bounded governance-operability refactor of producer
`dev-foundry-claude`: identify and correct unnecessary circular BLOCKED states,
opaque governance diagnostics, inaccurate public MCP input schemas, repeated
role-resolution effort, and missing deterministic readiness checks. Preserve
security, authorization, historical evidence, audit independence and TSK-026.

The process-bound Foundry Runner verified clean `main` at
`02074d1ae7ffa258a7895c17bec0f989631398fe`. A standalone governed
branch-creation transaction established
`task/tsk-027-governance-operability-refactor` at that exact HEAD.
No TSK-026 checkout, historical profile, branch, commit, evidence or release was
modified during that transaction.

To make legitimate pre-task authoring possible, the Operator directly executed
the initial configured-authority reconciliation on that branch, changing only:
- `.dev-foundry/profiles/project-operating-profile.yaml`;
- `.dev-foundry/authority-index.yaml`;
- `.dev-foundry/profiles/capability-profiles/governance-author-producer-maintenance-v1.yaml`.

At the initial reconciliation, the runner observed exactly those three visible
paths and no hidden changes; the `change_set` validation was PASS. The active
Governance Author binding now names the reusable producer-maintenance Capability
Profile. At that historical point, the Implementation Executor still used the
TSK-025 profile; this was later reconciled to the generic runner-v3 profile for
TSK-027 as recorded in section 6.

A task-ID-required Foundry Runner request for authoring TSK-027 returned
`TASK_NOT_FOUND` before this TSK existed. This is a pre-task resolver
limitation, not authorization to fabricate an existing task or disable any
guard. Project SPC-001 expressly permits legitimate taskless governance
authoring using a boundary identifier. This initial task creation is limited
to Operator-authorized governance preparation. Re-resolve the newly indexed
TSK-027 before any later role-dependent phase or implementation.

## 2. Single outcome

An eligible Claude Code governance session can determine whether a specifically
authorized operation is ready to proceed, explain missing preconditions in
actionable language, and hand off one bounded task to a properly bound executor
without unnecessary rework or losing fail-closed and independent-audit
guarantees. This is a producer-adapter operability improvement, not a change
to the adopted DEV FOUNDRY methodology.

## 3. Findings to verify and disposition

- **F01 — Profile coupling:** Active producer author/executor bindings have
  historically been task-specific. A reusable capability is allowed by
  OPS-002/OPS-009 but never supplies task authorization by itself. Preserve
  older profiles as history and ensure executable bindings reflect actual fit.
- **F02 — Static ceilings:** SPC-003 imposes concrete context/handoff and agent
  limits. Retain necessary controls; change project authority only if measured
  evidence establishes a needless obstacle and a safer bounded alternative.
- **F03 — Subagent topology:** Exactly two initial agents and single-hop,
  non-nested delegation are project choices. Do not relax solely to reduce
  ceremony; changes require explicit authority and compatibility proof.
- **F04 — Repeated resolution:** Author and delegated executor templates may
  re-read the same authority. Assess a validated, fingerprint-bound handoff
  alternative. A governance auditor must always independently reobserve the
  material subject and evidence.
- **F05 — Path projections:** OPS-008 already distinguishes material scope from
  non-binding path projection. Correct erroneous adapter enforcement only on
  demonstrated cases; never weaken hard exclusions or authorize scope growth.
- **F06 — Opaque errors:** Generic resolver messages mask invalid fields, source
  paths and missing prerequisites. Provide safe, specific, actionable failures
  without exposing secrets or violating the contracted response envelope.
- **F07 — Public MCP schema:** Current server publishes permissive/unknown input
  fields while resolver applies strict validation. Advertise actual field
  types, action enum and conditional requirements accurately.
- **F08 — Readiness:** Introduce deterministic pre-delegation readiness evidence
  that distinguishes READY, BLOCKED and INDETERMINATE; never infer actual
  side-effect authorization, an implementation PASS or safe retry from a
  superficially healthy contract.

F01-F08 are bounded review obligations, not automatic authorization for
every speculative code or methodology change.

## 4. Scope and sequencing

**MT-001 — Governed authority and design preparation (authoring only).**
Reconcile the initial Operator change, verify POP/Index/bootstrap/profile
consistency, index this task, establish exact product contract decisions and
the smallest meaningful implementation projection. Where a project ADR/SPC/DAT
change is necessary, update that owning authority before executor handoff.

**MT-002 — Operational diagnostics and MCP discoverability (implementation,
separately authorized).** Align the public tool schema with DAT-001, make
message diagnostics useful, and add negative regression tests for invalid role,
unknown/missing field, malformed authority, missing task, and stale context.
Do not silently change the closed resolver success/error envelope.

**MT-003 — Pre-delegation readiness and targeted handoff (implementation,
separately authorized).** Build a deterministic, non-authorizing readiness
gate checking repository identity/branch/HEAD, active POP/profile fit, indexed
task, necessary evidence and contract, explicit authorization, exclusions and
executor availability. Report READY/BLOCKED/INDETERMINATE with precise causes;
no queued model-assisted work when the gate is not READY. Optimize duplicated
read operations only when a fingerprint-bound handoff proves equivalence.
Independent audit reobservation is not optional when audit is triggered.

MT-002 and MT-003 are separate material subsystems and may receive separate
bounded implementation contracts and validation. Neither is automatically
authorized by this documentation task.

## 5. Acceptance criteria

CT-001: Baseline, branch and authority identities are independently observed;
initial Operator reconciliation is limited to the declared three paths.

CT-002: This TSK and its Authority Index route resolve to a single active
TSK-027 artifact with consistent metadata, without borrowing TSK-026 scope.

CT-003: The active Governance Author has one compatible, reusable producer
capability; historical task profiles are retained but cannot authorize new work.

CT-004: No TSK-027 Implementation Executor is claimed active until the POP
binding, fit assessment, Operator authorization and execution contract all
exist and are reverified.

CT-005: Invalid or incomplete MCP requests receive field-specific safe
diagnostics; DAT-001's existing closed success/failure fields and legacy
consumers remain compatible unless the owning contract is explicitly evolved.

CT-006: MCP-public arguments reflect internal accepted field types and required
cross-field semantics, with regression tests verifying discoverability.

CT-007: Readiness outcome is machine-decidable and distinguishes a missing task,
missing authorization, stale fingerprint, wrong branch/HEAD, invalid profile,
hard exclusion, unavailable executor and indeterminate prior side effect.

CT-008: A BLOCKED or INDETERMINATE result neither launches implementation nor
labels it PASS; retries of indeterminate side effects require reconciliation.

CT-009: Existing valid author/executor/auditor workflows remain supported.
Independence checks and side-effect boundaries survive any handoff
optimization.

CT-010: SPC-003 limits and nested-agent restrictions remain in force unless
an evidenced project-authority update explicitly changes them.

CT-011: OPS-008 projection variance remains usable only within authorized
material scope; material changes require fresh authorization.

CT-012: Tests cover schema-negative cases, legacy fixtures, negative readiness,
fingerprint drift, and no false PASS; focused tests precede any full suite.

CT-013: Changes remain inside the authorized producer repository. No real
consumer repository, Foundry Runner product, or immutable methodology release
is modified.

CT-014: Exact path change set, test evidence, limitations and audit-trigger
assessment are captured. A validation PASS is not an audit or promotion PASS.

CT-015: Commit, remote publication, merge, package release and consumer
adoption remain distinct reserved boundaries. No blanket promotion approval.

## 6. Out-of-scope and dependencies

Cross-platform, platform-agnostic methodology semantics belong to a separately
governed DEV FOUNDRY evolution. This task may identify and report those
dependencies but SHALL NOT change DEV FOUNDRY 2.1.0 or claim adoption of a
future release. Foundry Runner's own diagnostics and repository transaction
capabilities are likewise governed in the runner project.

At initial task creation, the POP still bound the historical TSK-025
executor, which could not authorize TSK-027 product work. In the later
MT-002 preparation, the POP was explicitly reconciled to the existing
reusable `implementation-executor-runner-v3.yaml` profile, and the
former TSK-025 profile was retained as history. Neither this binding nor
a valid contract alone grants execution authority: the task-specific
resolver must establish eligibility before starting an executor. The initial
ineligibility in sections 10–11 was resolved through canonical contract naming,
as demonstrated in section 12. The first implementation attempt returned a
mechanical PASS without doing product work; the current corrective status is
explained in section 13.

## 7. Gates and evidence

1. Establish the exact TSK-027 route, selected role/capability and bounded
   repository state. Validate task documentation and configured-authority
   reconciliation; separately disposition any audit trigger.
2. Before MT-002/MT-003 implementation, resolve a compatible TSK-027 executor,
   author exact contracts, confirm separate Operator authorization and run
   deterministic readiness.
3. Validate affected public schemas, positive and negative fixtures, and
   integration compatibility. Preserve legacy behavior unless approved
   project authority explicitly changes it.
4. Reconcile evidence and any projection variance. Independent audit only
   when required by applicable triggers and with eligible independence.
5. Do not infer promotion, publication, package adoption or closure from
   test success. Preserve all historical TSK-026 and release evidence.

## 8. Preparation disposition and evidence

`IN_PROGRESS` (authoring and bounded preparation). The initial configured-authority reconciliation was performed
directly by the Operator and was independently reobserved by the runner.
The repository now contains exactly four visible changed paths and zero
hidden changes:

- `.dev-foundry/authority-index.yaml`;
- `.dev-foundry/profiles/project-operating-profile.yaml`;
- `.dev-foundry/profiles/capability-profiles/governance-author-producer-maintenance-v1.yaml`;
- `docs/70-tasks/70 [TSK-027] PROJECT - Restore Governed Adapter Operability and Execution Readiness.md`.

The runner's `change_set` check returned PASS for exactly those paths, with
`src/`, `test/`, `templates/` and the immutable framework release excluded.
The repository branch remains
`task/tsk-027-governance-operability-refactor` with baseline HEAD
`02074d1ae7ffa258a7895c17bec0f989631398fe`.

After this task and its unique Authority Index route were created, the
task-scoped `resolve_governed_operation` returned
`outcome: ready`, `reasonCode: READY`, `selectedRole: governance-author`,
`taskState: planned`, `authorizationState: authorized`, and
`nextPermittedAction: author`. The bound semantic assessment applied only
to the Operator-authorized governance authoring/preparation, not to
product implementation. Any later changes require fresh fingerprint/authority
observation.

**Governance self-assessment:** The initial Operator reconciliation and
task creation are within the declared producer repository and authoring
surface, retain historical capability profiles and TSK-026, and do not
modify a consumer or release. The reusable profile does not grant new
product or implementation authority. No POP audit trigger is configured
for this documentation-only preparation; reassess the triggers before any
later promotion. This is an author assessment, not an independent auditor
verdict.

No code implementation, commit, push, merge, release publication or
consumer adoption has occurred. TSK-027 implementation remains dependent
on a separately active and compatible Implementation Executor binding,
a bounded exact execution contract, and explicit implementation authorization.

## 9. MT-002 bounded implementation authorization and fit

The Operator's authorized governance-operability refactor and explicit
continuation directive encompass the bounded first implementation slice
(MT-002): make the Governance MCP resolver and public input schema
self-describing while retaining the existing DAT-001 response envelope and
fail-closed security behavior. The permitted product mutation projection is:

- `src/governance-mcp/server.js` — honest public tool argument schema;
- `src/governance-mcp/resolver.js` — safe actionable validation messages;
- `test/governance-mcp/server.test.js` — schema and MCP regression proof;
- `test/governance-mcp/resolver.test.js` — positive and negative diagnostics.

This is one cohesive subsystem and one test boundary: preliminary OPS-002
workload-fit assessment PASS for the existing reusable runner executor
Capability Profile, *conditional on* active POP binding, exact approved
execution contract, executor availability and no unseen environment blockers.
An implementation package must enforce these exact paths, forbid governance,
bootstrap, templates, consumer and release mutation, and run focused tests
before any larger suite. A new architectural decision, added dependency or
required path expansion is a stop and reassessment, not permission to improvise.

Explicitly excluded from MT-002 authorization: MT-003 implementation,
commit, push, PR, merge, release, framework/consumer mutation and
independent-audit verdict. These remain separately gated. Preparation of
this authority does not claim that execution has started or passed.

## 10. Historical MT-002 package-name blocker (resolved)

The Author prepared an MT-002-only executor prompt at
`.dev-foundry/prompts/TSK-027-MT002-MCP-DIAGNOSTICS-V001.md`
and contract at
`.dev-foundry/execution-contracts/TSK-027-MT002-MCP-DIAGNOSTICS-V001.json`.
These are process-local, git-ignored handoff inputs under the producer
`.dev-foundry/` execution surface, not a code delta or published artifact.

The runner's `validate_execution_contract` returned `ok: true`,
`valid: true` for `TSK-027`. In contrast, a subsequent task-scoped
`resolve_governed_operation` for `implementation-executor`, supplying
this exact execution-package path, returned
`outcome: blocked`, `reasonCode: EXECUTION_PACKAGE_INELIGIBLE`,
`taskState: in-progress`, `executionEligibility: ineligible`,
`authorizationState: unknown`. It did not return explanatory evidence
identifying the failed prerequisite. Do not infer that the contract
validator supplies missing implementation eligibility or authorization.

The active POP binds `implementation-executor-runner-v3.yaml` and the
former TSK-025 executor profile remains indexed historical/not-required.
The Platform Bootstrap was correspondingly reconciled to identify an
active producer-maintenance capability. These configured bindings
are **necessary but not sufficient** for execution.

**HISTORICAL ONLY — this package-name blocker was resolved.** At the
time of this observation, no `start_execution_contract` had been invoked.
Subsequently a byte-identical contract at the canonical
`.dev-foundry/execution-contracts/TSK-027.json` was validated and
the implement resolver returned READY with explicit source-bound authorization
(sections 12–13). Do not use this historical BLOCKED record as the current
implementation gate or a reason to halt a separately re-resolved authorized
corrective execution.

This earlier diagnostic remains useful for F01/F08: technical contract
validity alone cannot substitute for an actual resolver READY result.
The decisive cause was later established as an exact filename/boundary
identity mismatch rather than a dirty worktree (section 13).

## 11. Controlled eligibility diagnostic (read-only)

The runner's `implementation-executor` binding was independently probed
using task-scoped `inspect`: `outcome: ready`,
`selectedRole: implementation-executor`, and
`taskState: in-progress`. The role binding and task identity therefore
resolve for read-only inspection, not for implementation.

With the real MT-002 contract, the separate contract validator returned
`ok: true`, `valid: true`; the governance resolver still returned
`EXECUTION_PACKAGE_INELIGIBLE` and no actionable finding. As a
negative control, supplying
`.dev-foundry/execution-contracts/NOT-EXIST-TSK027.json` as the
execution-package path returned the same resolver outcome/reason code,
despite the absent contract. `validate_execution_contract` on that
negative-control path instead produced `CONTRACT_LOAD_FAILED`, with
an absent-file error. Thus the resolver demonstrably collapses at
least two different diagnostic situations into the same generic response.
Do not infer identical underlying causes or that a validated contract
is executable.

A normal `preflight` expecting a clean checkout and zero changes
returned FAIL on clean-state and visible-change-count checks, while
an otherwise identical preflight declaring the observed five
governance-only changes and `expectedCleanState: false` returned PASS.
The branch and HEAD were correct in both cases. This establishes
the current dirty state, **not** that dirtiness is the cause of
`EXECUTION_PACKAGE_INELIGIBLE`; the resolver did not reveal its
eligibility predicate.

**Reproduction for the separately governed Foundry Runner operability
corrective:** for one task with active reusable executor binding and
a valid exact execution contract, compare
`resolve_governed_operation(implement, executionPackage.contractPath)`
with `validate_execution_contract`. Also probe nonexistent contract
path. The resolver MUST report a specific safe missing/invalid path,
dirty-baseline incompatibility if actually decisive, missing semantic
authorization, or other true gating predicate. Ensure both diagnostics
and implementation remain fail-closed, and keep technical contract
validity distinct from authorization/readiness.

Producer `dev-foundry-claude` must not modify Foundry Runner source
or bypass its resolver. This historical ineligibility was removed by
the canonical contract name and verified with resolver READY, without
requiring any runner mutation. No code implementation, commit,
push, merge, release, or consumer change occurred during these
earlier diagnostic probes.

## 12. MT-002 first execution disposition — mechanical PASS, implementation absent

The canonical package-path corrective removed the eligibility blocker.
`resolve_governed_operation(implement, TSK-027.json)` returned
`outcome: ready`, `executionEligibility: eligible`,
`authorizationState: authorized`, `nextPermittedAction: implement`
after a source-bound authorization-intent assessment.

The runner accepted request
`req_d9ae2b383d0a4fbbbe2bcb94b913ccb5`, associated with execution
`execution_40c0ce554433269ebfdea07903de095aa74eeb452ff52fa2e47873e7213b6886`.
It later emitted `status: passed` and `runnerExitCode: 0`.
Focused node tests passed 32/32, `git diff --check` passed, and
path policy found zero changed product files or violations.

**Governance Author disposition: MT-002 IMPLEMENTATION NOT PERFORMED**.
The `git-status-before.txt` and `git-status-after.txt` artifacts
have the identical SHA-256
`975ebcb4c0c2ea427af383b2cffe8edcf393293ac7fc9a53e6794f2f9e1f9498`,
and the output handoff reports `changedPaths: []`. The current
`src/governance-mcp/server.js` still contains six
`z.unknown().optional()` parameter declarations; the resolver
still uses the generic error string. Those were core MT-002
deliverables, so product acceptance did not occur.

The `postExecutionValidation.executorInvoked: false` property
describes the post-execution validation stage and is not evidence that
the primary Codex executor was never invoked: the execution status
separately reports `executor.available: true`, `exitCode: 0`, and
its output log is present. The bounded artifact-read interface does not provide direct
`executor-output.log` reads. The Operator subsequently supplied the
redacted execution log, identifying the exact self-inflicted documentary
blocker as recorded in section 13. This log is evidence of the executor
decision, not independent project or methodology authority.

The primary request is terminal, all observed effects are known, and
a distinct corrective attempt may be prepared under the original
MT-002 material authorization; it must not replay the same historical
package fingerprint, infer code implementation from test-only PASS,
or cross the approved four-path product mutation allowlist. Any
unexpected prior effect would require reconciliation instead.

## 13. MT-002 corrective authorization state — resolved documentation conflict

The Operator provided the redacted Codex log from
`execution_40c0ce554433269ebfdea07903de095aa74eeb452ff52fa2e47873e7213b6886`.
Its explicit executor conclusion was **BLOCKED — no implementation started**:
the task record still claimed MT-002 was blocked by
`EXECUTION_PACKAGE_INELIGIBLE` and `authorizationState: unknown`.
Codex verified this record and appropriately performed zero product edits.
Its successful exit and the runner's 32/32 pre-existing-test PASS do **not**
constitute product acceptance.

The contradiction was introduced by the Governance Author when it preserved
sections 6, 10 and 11 as if their **earlier** blocker were still current.
The actual resolver code in the separately observed Foundry Runner requires
an execution contract basename of exactly `TSK-027.json` for an implement
request with `taskId: TSK-027` and no `boundaryId`. The earlier filename
`TSK-027-MT002-MCP-DIAGNOSTICS-V001.json` therefore classified as ineligible
even while `validate_execution_contract` returned valid. Copying the same
contract bytes to `TSK-027.json`, revalidating and submitting the resulting
`authorization_intent` assessment produced the verified resolver decision
`outcome: ready`, `executionEligibility: eligible`,
`authorizationState: authorized`, and `nextPermittedAction: implement`.
The clean-worktree preflight was a separate diagnostic and was not the
established reason for package ineligibility.

**Historical pre-V002 MT-002 disposition: CORRECTIVE RE-EXECUTION PERMITTED SUBJECT TO
A FRESH GOVERNED RESOLVER READY AND AN EXACT NEW CONTRACT FINGERPRINT.**
The first attempt is terminal and its known observed product delta was zero.
The bounded scope/Operator authorization in section 9 remains in force;
this is a correction of contradictory task evidence, not a new product
capability or implicit widening of rights. A distinct V002 prompt must
explicitly refer to this current section, distinguish sections 10–11 as
history, and require actual substantive changes in the four approved
source/test files to claim implementation success. Re-run the same focused
tests, verify change paths and acceptance behavior, and stop if a new
authorization, environment, security or architecture blocker is actually
observed. No blind retry of an indeterminate effect is permitted.

MT-003, commits, pushes, PR, merge, release and consumer adoption remain
outside this authorization. No executor may modify this governed document.

## 14. MT-002 V002 no-op: eliminate nested runner consultation

The Operator provided the redacted terminal transcript for the completed V002
execution `execution_a711dd51dcd28c96c4f9a772ebdb5ea8b3a4f3a8cff307003066d787f4df8033`.
Codex correctly read the current task and branch, but then used a tool
advertised as `codex_apps/foundry_runner.resolve_governed_operation`
**inside the delegated Implementation Executor session**. This tool was
process-bound to a **different repository**, `dev-foundry` on
`tsk-005-platform-agnostic-governed-operations`, so it returned
`TARGET_PROJECT_MISMATCH`. Codex stopped without editing the four product
paths, and reported that it did not run focused tests. The outer Cetus
execution subsequently reported mechanical `passed` with zero product
changed paths, which is not implementation acceptance.

**Correct delegation rule for MT-002 and later producer maintenance:**

- The **Governance Author**, using the correct project-bound runner,
  resolves role, profile, task, execution package and the source-bound
  authorization-intent assessment **before** dispatch.
- The **Foundry Runner** is the orchestration, contract, mutation/path-policy
  and evidence boundary; it launches a separately bound executor only after
  the applicable governance gates are proven.
- The **Implementation Executor (Codex CLI)** does **not** rediscover,
  select, invoke, or query any runner, MCP plugin, or
  `resolve_governed_operation` from inside the delegated Codex session.
  A globally visible MCP tool may belong to a different project; its
  availability is not authorization or evidence for this task.
- Codex verifies the local repository identity, branch, baseline HEAD,
  active task's bounded product authority, pre-existing change surface,
  exact hard exclusions and executable acceptance. If a real local
  contradiction is observed, it stops and reports it to the Author without
  searching for another runner or fabricating a READY.
- This avoids duplicate governance decisions; it does **not** eliminate
  checks by the external runner, pre-dispatch eligibility, Codex local
  safety checks, post-execution validation, or independent audit if
  triggered. A handoff is only execution input, never transferable
  Operator authorization to another repository.

**Historical pre-V003 MT-002 disposition: V003 corrective implementation permitted
only after a freshly observed outer-runner READY against the canonical
`TSK-027.json` contract with a new fingerprint and V003-only prompt.**
V001 and V002 are terminal zero-product-delta attempts, not successful
product implementations. The MT-002 four-path allowlist and all hard
exclusions in section 9 remain unchanged. A zero product change result
again must be classified as no implementation, whatever Codex exit code
or pre-existing focused-test results say.

Any reusable launcher/runtime-enforced tool-isolation capability would
belong to separately governed Foundry Runner work. This producer task
does not modify `foundry-runner`, `dev-foundry`, consumers or the
immutable framework.

## 15. MT-002 V003 reconciliation and functional acceptance finding

**Operator stop boundary:** Reconcile MT-002 only. Do **not** prepare,
authorize, dispatch, or otherwise implement MT-003 or any subsequent
micro-task. Commit, push, PR, merge, release and consumer adoption remain
unapproved.

The process-bound producer runner independently observed the expected
`dev-foundry-claude` repository, branch
`task/tsk-027-governance-operability-refactor`, HEAD
`02074d1ae7ffa258a7895c17bec0f989631398fe`, and nine visible
paths: five pre-existing governance/task-author changes and four
product/test paths attributable to V003. No hidden changes.

V003: request `req_5aaf3aa6e77623471fbc9ae16f711eb8`,
execution
`execution_5a6d38bf16b340a33719972fb485f8338a5fc0bd8cc9b26f1f536720e4431a8d`.
Status `passed`, executor `codex-cli`, zero path-policy violations,
focused Node tests `32/32 PASS`, `git diff --check` PASS, and
the new product-delta verification PASS. Unlike V001/V002, the
four authorized paths actually changed:
- `src/governance-mcp/server.js`;
- `src/governance-mcp/resolver.js`;
- `test/governance-mcp/server.test.js`;
- `test/governance-mcp/resolver.test.js`.

**Confirmed implemented improvement:** the published MCP JSON Schema
now identifies the requestedAction enum, required targetProject,
identifier patterns, fingerprint type and rejects unknown arguments;
direct resolver input validation and certain authority errors provide
more precise safe diagnostics. Existing focused tests passed and
existing output key tests cover the direct resolver.

**Finding TSK-027-MT002-A001 — BLOCKED functional acceptance, DAT-001
MCP failure-envelope regression.** DAT-001 sections 5 and 6 require
**every failed MCP tool result** to contain exactly one text item
whose text is the JSON serialization of
`{ok:false,errorCode:<stable code>,message:<string>}`.
V003's public `server.js` uses a strict Zod input schema passed to
the MCP SDK. For missing/wrong-typed/unknown inputs, the SDK
rejects the request **before** the registered tool callback invokes
`resolveGovernedOperation`. The changed
`test/governance-mcp/server.test.js` asserts, for an unexpected field
or invalid enum, `isError: true` and the generic MCP
`Input validation error` content instead of the DAT-001 JSON
failure envelope. This behavior is demonstrated by the V003 focused
test expectations; it is not a conjectural future issue.

The new direct-resolver diagnostics do preserve their own three-field
failure shape, but that does not repair the public MCP transport
contract. No test demonstrated both the required strict public
schema/discoverability and the retained DAT-001 failure representation
for invalid MCP arguments. This is within MT-002's own CT-005/CT-006
acceptance boundary and cannot be waived by 32 green tests.

**MT-002 disposition as of this reconciliation:**
- **IMPLEMENTATION PERFORMED** in exactly four allowed product/test paths.
- **MECHANICAL VALIDATION PASS**, no path-policy violations.
- **FUNCTIONAL ACCEPTANCE BLOCKED — finding A001** until the
  published input contract and MCP failure envelope are both
  satisfied, without violating session/activation guards or changing
  methodology authority.
- V001 and V002 remain historical no-op attempts, never accepted
  implementations.
- A bounded corrective solution must either preserve DAT-001 v1
  exactly through an evidenced compatible transport behavior, or
  seek separate authorization for an owning contract/version
  change. Do not silently change DAT-001 or weaken validation.
  Any code corrective needs fresh role/contract resolution,
  the smallest material implementation scope and positive/negative
  transport-level tests showing the exact DAT-001 error payload.
- No independent audit or promotion verdict is claimed.

**Hard stop for this operation:** the Governance Author has reviewed
and recorded MT-002 evidence; MT-003 has **not started**, and no
subsequent MT dispatch is authorized by this reconciliation.

## 16. MT-002 A001 bounded corrective V004 — transport validation ownership

The Operator's subsequent direction to continue authorizes pursuing the
existing MT-002 functional acceptance corrective A001, not silently
weakening DAT-001, mutating methodology, or claiming the previous runner
mechanical PASS satisfies acceptance. V003 remains a completed
implementation with a functional acceptance finding.

**Corrective objective:** reconcile the published strict JSON Schema and
DAT-001 sections 3, 5 and 6 at the actual MCP tools/call boundary. For
malformed/unknown/invalid enum/invalid optional field tool arguments,
the observable returned tool content must have exactly one text block
containing a JSON failure envelope with exact keys
`ok,errorCode,message`, code `INVALID_REQUEST`, and a truthful
field-specific safe message. Preserve tool discoverability (typed
properties/required fields/closed enum/additionalProperties:false),
successful results, taskless authoring, session/activation guard
precedence and stable error codes. If the installed MCP SDK pre-validates
before callback, a narrowly scoped transport-schema adapter may defer
**evaluation** to the already strict project resolver while continuing
to **advertise** the true same closed input schema. The resolver must
reject every invalid request, without normalizing fabricated inputs or
permitting previously rejected inputs. SDK-level interception,
dependency modification, undocumented global patching, and fabricated
MCP error envelopes are prohibited. Favor supported Standard Schema
adapter interfaces if actually available in the installed pinned SDK;
require tests to prove both advertisement and enforcement. If the
contract cannot be satisfied in the exact four-file MT-002 surface,
STOP and report the unmet precondition rather than silently amend
DAT-001 or expand scope.

**Boundary:** corrective implementation stays in exactly:
`src/governance-mcp/server.js`,
`src/governance-mcp/resolver.js`,
`test/governance-mcp/server.test.js`,
`test/governance-mcp/resolver.test.js`.
V003's four files have preexisting changes, which must be preserved
and treated as baseline for incremental V004 proof. V004 must make a
separately identifiable material delta (no recycling a test-only PASS
from V003). Do not touch TSK-026, consumer repositories, POP,
index/bootstrap, immutable releases, runner or package files.

This subsection is **Governance Author corrective preparation** only.
An Implementation Executor may be dispatched only after fresh exact
contract validation and external process-bound
`resolve_governed_operation(implement)` yields `READY` for the new
contract and source-bound authorization intent. Codex must not call
any runner, MCP governance connector, or re-resolve authorization from
within its implementation session. Read its local product authority
and satisfy the task, do not take ownership of authoring.

**Acceptance tests required:** MCP `listTools` exposes truthful
required/enum/pattern/no-additional-properties metadata. MCP
`callTool` returns exact DAT-001 JSON with `INVALID_REQUEST` for
unknown field, invalid requestedAction enum, missing required
targetProject, invalid taskId and invalid fingerprint; use both
MCP-level and direct-resolver tests; valid taskless request must
succeed, legacy success/target mismatch and activation guard remain
compatible; no authority body leakage; focused suite and diff check
pass. Incremental source **and** test delta must be observed.
Mechanical PASS alone is not acceptance.

**Current disposition:** MT-002 A001 **CORRECTIVE PREPARED**, not
implemented or accepted. MT-003 remains not started. No commit,
remote publication or promotion is authorized by this preparation.

## 17. MT-002 V004 reconciliation and bounded product acceptance

**Verified V004 request:** `req_ab9c7a1943202807d93633b2a868a279`;
execution
`execution_b726ec16ebad3b17f6f80e2d3cded5534183f07a3857642cb8b2889eade0f125`,
contract SHA-256
`b0ac33b89b3219c584b219a16848a7b368abaad4ec356fa65c76ac747149ae0b`.
The project-bound runner returned terminal `passed`, no errors,
`codex-cli` executor exit code 0, zero path-policy violations and
complete post-execution validation evidence.

**Observed incremental V004 delta:** only
`src/governance-mcp/server.js` and
`test/governance-mcp/server.test.js` were modified *during V004*.
A contract validation verified those two files' hashes differ from
their recorded V003 starting hashes. V003's resolver.js and
resolver.test.js product work remains in the task's cumulative
four-path implementation surface, with five earlier governance
author paths separately preserved. Repository branch and HEAD remained
`task/tsk-027-governance-operability-refactor` at
`02074d1ae7ffa258a7895c17bec0f989631398fe`;
total visible worktree changes remained nine, hidden zero.

**Transport-level product evidence:**

- The public `tools/list` advertises the strict argument schema:
  required `requestedAction` and `targetProject`, action enum,
  proper identifier/fingerprint patterns, and
  `additionalProperties:false`.
- `server.js` uses the installed MCP SDK's Standard Schema interface:
  its metadata originates from the strict Zod schema's
  `~standard.jsonSchema`, while its transport-stage
  `~standard.validate` returns the original unchanged input.
  The separately strict `resolveGovernedOperation` enforces the
  actual request via `inputSchema.safeParse` and emits the DAT-001
  exact JSON envelope. This defers evaluation, not input enforcement,
  and needs compatibility revalidation if the pinned SDK/Zod
  versions change.
- The new stdio MCP client regression directly sends
  invalid enum, unexpected field, missing `targetProject`,
  malformed `taskId`, and invalid fingerprint. Each observed
  result contains exactly one text item parseable as JSON with
  exactly `ok,errorCode,message`, `ok:false`,
  `errorCode:INVALID_REQUEST`, and a relevant safe field diagnostic.
- Positive task-bound and taskless governance, historical authority
  refusals, stale fingerprint, sorted success context/fingerprint
  tests and help parity remain covered by the focused suite.
  Session and consumer activation guard code were not modified.

**Validations:** focused Node tests `33/33 PASS`;
`git diff --check` PASS; incremental V004 source-and-test SHA
guard PASS; post-execution runner validation PASS; path policy PASS.
The V003 regression tests that had accepted a generic SDK
`Input validation error` were replaced by meaningful DAT-001
MCP response-contract assertions.

**Governance Author acceptance disposition:**
`TSK-027-MT002-A001 = RESOLVED` for the tested public MCP
input/error-envelope boundary. `MT-002 = ACCEPTED` for its
authorized bounded product slice (CT-005 and CT-006) with
mechanical and functional evidence. V001/V002 remain historical
no-op attempts; V003 is substantive implementation with the
subsequently corrected A001 finding; V004 is the closing bounded
corrective. A passing implementation is not an independent audit,
a full-suite integration verdict, or promotion authorization.

**Residual verification and separation of concerns:** broader
integration/regression coverage, project audit-trigger assessment
under current adopted methodology, full TSK-027 completion and
promotion remain separately gated. No changed product file has
been staged, committed, pushed or released by this reconciliation.
MT-003 remains an independent material subsystem under section 4;
neither MT-002 acceptance nor a runner `READY` authoring outcome
automatically authorizes MT-003 implementation. Resolve its
actual design/fit/contract and material Operator intent before
starting a new Implementation Executor.

## 18. MT-003 pre-implementation scope and owner assessment (authoring only)

The Operator requested continued work after the MT-002 A001
corrective. The Governance Author has reconciled MT-002 (section 17)
and assessed the next separately bounded MT-003 design. **No MT-003
Implementation Executor is yet activated and no MT-003 execution has
been dispatched.** Section 4 explicitly requires separate material
authorization before implementing MT-003.

**MT-003 outcome already described in section 4:** a deterministic,
non-authorizing `READY` / `BLOCKED` / `INDETERMINATE` predelegation
decision over current identity/branch/HEAD, task, POP/profile fit,
explicit authorization, required evidence/contract, exclusions,
executor availability and prior unknown side effects, with
actionable causes and a narrowly fingerprinted handoff. A missing
precondition may not be converted into PASS, and
`INDETERMINATE` requires prior-effect reconciliation before retry.

**Observed product placement constraint:** the existing
`src/governance-mcp/resolver.js` implements governed authority
references and context fingerprints, and
`src/governance-mcp/server.js` exposes a single read-oriented
`resolve_governed_operation` tool. No dedicated readiness/handoff
implementation was found in the current
`src/governance-mcp` source surface. DAT-001 fixes the resolver's
success/error envelopes, and SPC-001 fixes its existing action
semantics. Adding readiness fields to those envelopes would
breach DAT-001 without an owning contract change.

**Ownership constraints from current project authority:**

- ADR-001/ADR-002/ARC-001 keep the Claude MCP a small,
  read-oriented governance plane. Generic file/Git/provider
  operations belong to Claude's native capabilities. A second
  tool or additional MCP surface is permissible only when the
  nonduplicative deterministic value is evidenced and an owning
  project contract explicitly defines it.
- SPC-003 section 6 already defines a minimal bounded handoff;
  a new handoff implementation must reuse its reference/hash and
  role-separation rules, not copy complete authority or
  methodology. Implementation Executor may not query runners or
  resolve other repositories as a precondition of delegated work.
- Foundry Runner's own contract validation, execution
  coordination, eligibility and post-execution validation are
  separately governed product mechanics in `foundry-runner`.
  This producer task cannot modify them or treat another bound
  runner as project authority. Proposed checks that already exist
  there should be referenced/reused at the outer orchestration
  boundary, not duplicated inside the Code Executor.
- Platform-agnostic methodology semantics remain owned by the
  separate `dev-foundry` evolution; this task may not promote
  assumptions about cross-platform requirements as adopted 2.1.0
  methodology.

**Smallest MT-003 next-authoring boundary:** first reconcile
whether the incremental missing capability is (a) Claude-native
read-only project readiness/handoff presentation; (b) a
Foundry Runner feature already owned elsewhere; or (c) a
project-contract evolution needed to express new results.
Establish the concrete owner, observable gaps, schema/error
contract, security checks, exact source/test mutation allowlist,
negative-case fixtures and prior-side-effect semantics before
selecting an Implementation Executor. If the capability can be
satisfied by a compact fingerprint-bound author-to-executor
handoff from existing authority plus external runner READY,
do not introduce a second MCP tool merely for symmetry.

**Disposition:** MT-003 = `DESIGN/OWNER DECISION PENDING`;
separate Operator material authorization and fresh task/profile/
contract resolution are still required for product implementation.
This assessment neither modifies product files nor authorizes
runner work in another repository, release, PR or promotion.

## 19. MT-003 separately authorized bounded implementation: readiness projection and compact handoff

The Operator expressly approved proceeding with MT-003 after the
MT-002 reconciliation. This authorization covers the MT-003
product outcome described in section 4, **not** changes to
Foundry Runner, DEV FOUNDRY reusable methodology, other projects,
Git publication or consumer adoption. The active producer
Implementation Executor remains the runner-v3 `codex-cli`
binding; it does not self-select or reconsult any MCP runner.

**Decision F04/F08 (smallest nonduplicative first slice).**
The outer process-bound Foundry Runner already owns physical
repository preflight, exact execution-contract validation,
authorization resolution, queue/side effects, executor availability
and post-execution evidence. The Claude adapter SHALL NOT
reimplement the runner engine, fabricate executor readiness,
or add a second MCP governance tool. The adapter-owned missing
piece is a deterministic, *non-authorizing* classifier and
compact fingerprint-bound handoff that combines **already
observed** predelegation facts into an actionable and
machine-decidable disposition, and refuses to provide a
delegable package while any required evidence is absent,
stale, contradictory or indeterminate.

**MT-003-A exact implementation boundary** (new files only):
- `src/governance-mcp/readiness.js`: exported pure
  deterministic evaluator / safe compact handoff builder,
  **no repository reads, shell, network, MCP, credentials,
  writes, task mutation or runner invocation**.
- `test/governance-mcp/readiness.test.js`: positive and
  negative Node regression matrix exercising only this
  explicit contract. Do not modify existing MT-002
  product/test work, package metadata, templates, existing
  CLI/MCP tools, project authority or immutable release.

The input is an observation/evidence bundle prepared by
the active **Governance Author** or actual host orchestration,
not an Operator authorization request. It must identify
the expected and observed project, task, branch and HEAD;
selected role/Profile and active capability-fit observation;
current source-bound authority fingerprint/reference SHA;
operator-authorization decision/evidence anchor;
execution-contract path and exact SHA, path/exclusion and
preflight decision; executor-availability evidence; validation
prerequisite state; and prior-side-effect terminality.
A missing authoritative observation is NOT equivalent to
false-positive `ready`. Absent executor check, absent or
non-source-bound authorization, missing task, inactive
profile, stale context, invalid package, hard exclusion,
branch/HEAD mismatch and unavailable executor yield
`BLOCKED` with distinct safe cause codes.
Unreconciled/inflight/unknown prior effects yield
`INDETERMINATE` and no delegable handoff, even if all
other checks appear healthy. Indeterminate effects
must be reconciled rather than retried. If both
indeterminate and blocked conditions are present,
`INDETERMINATE` takes precedence for no-retry safety.

The evaluator returns one closed result containing outcome
(`READY`, `BLOCKED`, `INDETERMINATE`), deterministic
reason codes and safe next-action text, plus a compact
context fingerprint and an optional exact **read-only**
handoff **only when READY**. Handoff binds project, task,
selected implementation role/profile, directed source
paths and SHA-256 digests, role capability proof, operation
boundary/allowlist, exclusions, contract hash and
authorization evidence reference. It MUST NOT copy
repository body/credentials or become a new authorization
source. Stay within SPC-003's 8192-byte handoff ceiling;
reject overflow. Reordered equivalent inputs must not
change the digest. Any material change in observed facts
MUST change the digest; stale supplied expected digest
MUST yield `BLOCKED` (unless prior unknown effect
requires `INDETERMINATE`), not a handoff.

**Critical separation:** the evaluator is an adapter-side
decision utility, **not** a substitute for or bypass
of the outer runner's authoritative final `READY`.
A caller MAY dispatch only when *both* external runner
authorization/readiness gates and this adapter-side
classifier (when invoked) are READY. The pure function
does not enqueue executors. Producer Codex must never
use a runner or governance MCP internally to repeat
the Author's operation. Claude-native consumer roles
retain the currently adopted SPC-003 rules; no silent
relaxation of their own project-scoped governance MCP.

**MT-003-A fit and limits:** task-specific slice under the
existing compatible runner-v3 producer executor Capability
Profile; no new dependency, platform binding, API tool,
consumer surface or network listener. Actual integration
into another platform's enqueue/launcher (and host-side
verification of raw observations) is separate and MUST
not be reported as achieved by the pure helper alone.
This slice therefore cannot close the full MT-003
acceptance or TSK-027 lifecycle by itself.

**Required proof:** deterministic positive/negative
readiness matrix for task, authorization, SHA/fingerprint,
identity, head, profile, contract, path exclusions, executor
availability and prior effects; compact handoff size and
source references; stable digest and drift rejection;
no false PASS; `node --test
test/governance-mcp/readiness.test.js`, focused
existing MCP tests for regression, `git diff --check`,
and exact changed-path evidence. If the helper cannot
produce a safe usable result without extra ownership
or a new MCP/CLI contract, the executor MUST stop and
report that need instead of improvising.

**Disposition:** MT-003 material authorization:
`AUTHORIZED FOR MT-003-A ONLY`, with a fresh
source-bound resolver `READY` and canonical TSK-027
execution-contract fingerprint required before dispatch.
No automatic retry; no independent audit or promotion
claimed.

## 20. MT-003-A V001 semantic acceptance review — corrective required

The process-bound runner verified V001 request
`req_d7508bb119caf8b1d79a174763062daa`, execution
`execution_80b818d13ce57c9db6fc8c25571fc106298f04651bb713a9a881acc92b20694c`
as terminal `passed`, with the exact two new authorized paths
`src/governance-mcp/readiness.js` and
`test/governance-mcp/readiness.test.js`, zero path-policy
violations, no hidden changes and an unchanged task branch/HEAD.
The new readiness suite passed `15/15`, the existing MCP suite
`33/33`, `git diff --check` passed, and the material-new-file
guard passed. V001 is a real product implementation, **not** a
no-op and **not** full functional acceptance.

**Governance Author finding MT003-A001 — valid real Git HEAD rejected.**
The current `validShape` in `readiness.js` applies a strictly
64-hex SHA-256 validator to `expected.head` and `observed.head`.
The actual process-bound producer repository HEAD is
`02074d1ae7ffa258a7895c17bec0f989631398fe` (40 hex
characters). Therefore an otherwise eligible real
`dev-foundry-claude` observed context cannot reach READY:
`INVALID_INPUT` is produced. The V001 test fixture uses
`hash('commit')`, a 64-hex digest unlike the observed Git
commit ID. Correctly support exact Git commit IDs of 40
(SHA-1 repositories) and 64 hex (SHA-256 repositories) without
confusing them with required 64-hex content SHA-256 digests.
No arbitrary or partial prefix may pass.

**Governance Author finding MT003-A002 — real authority paths rejected.**
The V001 `repoPath` validator excludes spaces, `[` and `]`.
The current indexed source of authority itself is
`docs/70-tasks/70 [TSK-027] PROJECT - Restore Governed Adapter Operability and Execution Readiness.md`
and several other live routed authority documents use those
characters. Real `authorityReferences` and their source-bound
evidence paths therefore fail the input shape before any readiness
decision. Replace this overly narrow character whitelist with a
bounded, *canonical* repository-relative path validation that
accepts current legitimate spaces/brackets while rejecting
absolute/drive/UNC paths, empty, `.` or `..` components,
backslashes, control characters, and unsafe traversal.
No normalization may silently reinterpret a different path;
preserve and hash exact source-identifying bytes.

**Disposition:** MT-003-A implementation performed, mechanical
validation PASS, **functional acceptance BLOCKED by MT003-A001/A002**.
These are material defects of the just-authorized MT-003-A two-file
slice, not permission to introduce an unrelated readiness API.
The Operator's instruction to continue covers reconciliation and
corrective completion within this original bounded MT-003-A
authorization; no independent MT-003-B integration or runner/CLI/MCP
mutation is implied.

**V002 exact corrective bounds:** update only
`src/governance-mcp/readiness.js` and
`test/governance-mcp/readiness.test.js`. Preserve the substantive
V001 implementation, all MT-002 work and five prior governance
files. Regression tests MUST use the actual producer 40-character
HEAD form and the actual task document path above in a valid
READY fixture (no synthetic 64-hex substitute), and negative
40/64 Git ID and path traversal/absolute/controls cases. Preserve
all existing 15 readiness tests, 33 focused MCP regressions,
fingerprint/ordering drift and handoff size constraints. V002
requires a fresh canonical exact contract fingerprint and
source-bound implementation resolver READY, plus an independently
observed **incremental** source-and-test delta relative to V001.
A no-op mechanical PASS is not product acceptance.

No changes to `dev-foundry`, `foundry-runner`, consumer
repositories, package metadata, immutable releases, commits,
pushes, PRs, merges or promotions are authorized by this
corrective. Any material broader integration needs a separately
defined governing boundary after V002 acceptance.

## 21. MT-003-A V002 acceptance and separately bounded MT-003-B CLI integration

**Independent producer-runner reobservation of MT-003-A corrective V002:**
request `req_6c0f82345d09d7a24e305300a490486e`;
execution
`execution_0ffe6fcf309f3bf16101cef8cb376f1813e4eb9cfebe05a6a202d27beabc8665`;
exact contract fingerprint
`sha256:579435ee71d329c59bf711b5e4e912c1eb3f9c330082d680fa0ebe8e8815e837`.
The runner reported `passed`, `codex-cli` exit 0,
0 path-policy violations and complete post-validation evidence.
Exactly the two V001 MT-003-A files changed incrementally
(source SHA `ea53c358cab6abbe3f556a176916df0b7149c056e9a76d6895fe2e847e4a37a7`;
test SHA `ddfdc6deac8919683fe8a072c959e366f27aeed11f7ccdd49480bca231013428`).
The repository remained bound to the expected task branch and
HEAD `02074d1ae7ffa258a7895c17bec0f989631398fe`;
11 visible paths, zero hidden.

**Functional acceptance:** MT003-A001 is resolved: exact Git
object IDs of 40 hex (actual producer SHA-1) and 64 hex (Git SHA-256)
are now accepted for expected/observed commit HEAD, while all
content SHA-256s remain strictly 64 lowercase hex, and malformed
or partial commit IDs are rejected. MT003-A002 is resolved:
the exact indexed `docs/70-tasks/70 [TSK-027] ... .md` path
and bracket/space canonical source paths are accepted, with
absolute, drive, slash/backslash traversal, control characters,
dot components and encoded traversal rejected. Both outcomes
are demonstrated in a realistic test fixture using this
task branch, exact HEAD and real named authority path.
Path-byte differences change the fingerprint as required.
The pure classifier does not perform I/O or grant authorization.

The MT-003-A focused tests now pass **18/18**;
pre-existing MCP tests **33/33**; total **51/51**;
`git diff --check` PASS, V002 source-and-test delta
guard PASS and post-execution validation PASS.
No further MT-003-A functional acceptance finding is
known within this authorized two-file slice.
**Governance Author disposition:** `MT-003-A = ACCEPTED`
for bounded pure helper behavior; A001/A002 `RESOLVED`.
A mechanical and scoped functional PASS is not a full-suite,
independent audit, integration or promotion verdict.

**MT-003-B smallest actual integration gap:** MT-003-A has
no caller wired to it: the adapter CLI currently exposes
`setup/start/status/doctor/help/upgrade` and other consumer
commands, while the sole governance MCP remains
`resolve_governed_operation`. The runner already owns
predelegation authorization/queue. A new MCP control tool
or duplicate runner engine is unnecessary and would
expand authority, whereas an advanced **read-only**
CLI entrypoint making the pure helper callable from Claude's
native shell closes the producer-adapter usability gap
without altering dispatch mechanics. The owning project
CLI authority `SPC-007` section 10 was updated before
implementation to define the diagnostic contract.

**Operator MT-003 continuation:** the Operator explicitly
directed completion rather than another discretionary
waiting cycle, following MT-003-A V002 verification. This
continues the previously approved material MT-003 outcome
but authorizes **only MT-003-B diagnostic integration**,
subject to a fresh exact contract and resolver READY.
Nothing here grants cross-repository work, direct repo
implementation by the Governance Author, release,
publication, promotion, or consumer adoption.

**Exact MT-003-B implementation allowlist:**
1. `bin/dev-foundry-claude.js` — one advanced
   `readiness check --input -` command branch that parses
   a capped stdin JSON observation, calls existing
   `evaluateReadiness`, emits a closed single JSON diagnostic
   with `nonAuthorizing:true` and
   `dispatchAllowed:false`; exit codes 0 READY / 2
   BLOCKED / 3 INDETERMINATE, plus safe nonzero usage.
2. `test/bootstrap/claude-readiness-cli.test.js` —
   direct real Node CLI contract and negative-case tests.
No changes to `readiness.js`, original MT-002 files,
other CLI behavior, consumer-managed templates, POP/Index,
framework, runner, unrelated docs, packages/dependencies
or `.claude`. No new MCP tool or network listener.

**Proof and boundary:** positive ready realistic
observation and compact handoff, blocked missing source-bound
authorization, indeterminate prior effect, bad flags, malformed
and oversize JSON, no bypass via caller-claimed readiness,
and no command side effects. Verify the existing 51 focused
tests, new CLI tests, `git diff --check`, exact file
delta and narrow regression of baseline CLI command behavior.
This CLI is a classifier of *supplied* facts; the external
runner/host still must independently check actual binding,
authorization and side-effect state before any dispatch.
It is not a new mandatory condition for the outer runner's
existing jobs and is not evidence of a completed new runner
integration.

**Remaining gates after MT-003-B:** verify actual CLI
invocation; determine whether any necessary *host-side*
integration remains, without duplicating or editing another
repository; run broad product suite/mechanical checks;
separately assess applicable audit triggers and required
independence; reconcile evidence before any reserved
promotion or lifecycle closure. If useful MT-003-B
integration cannot be achieved solely on its two
authorized files, report BLOCKED instead of extending
scope.

## 22. MT-003-B completion and bounded CLI acceptance

**Observed terminal execution:** request
`req_d2728f802cf7b4af6f96710d84701327`,
execution
`execution_5195c4df8e9199ec57f783efb56f1dae05e6aef1fe41127b403b5e1db80fd1f0`,
exact contract SHA
`0b5d898c1c3fa187c1297387cab07ca27dbf558b0b12a94b9d37a7ffdf529968`.
The process-bound runner reported `passed`, executor `codex-cli`
exit 0 and runner exit 0, with no failures, zero path-policy
violations and complete post-execution validation evidence.
Expected and observed repository branch were
`task/tsk-027-governance-operability-refactor`, HEAD
`02074d1ae7ffa258a7895c17bec0f989631398fe`;
14 visible changed paths, hidden zero.

**Material product delta:** during MT-003-B only
`bin/dev-foundry-claude.js` was modified and
`test/bootstrap/claude-readiness-cli.test.js` was created.
A separate execution-contract guard verified new CLI source bytes
and the existence of the new tests. Previously accepted
MT-003-A pure helper and MT-002 product sources were preserved.

**Functional verification of actual CLI surface:**
`node bin/dev-foundry-claude.js readiness check --input -`
invokes the existing pure classifier on bounded UTF-8 JSON stdin.
The command emits one JSON result with the exact helper result
fields plus explicit `nonAuthorizing:true` and
`dispatchAllowed:false`. Exit codes are 0 for diagnostic READY,
2 for BLOCKED/usage, and 3 for INDETERMINATE; this does not
authorize dispatch. An exact argument contract and 131072-byte
stdin cap prevent arbitrary file reads and unbounded input.
The CLI tests exercise a realistic 40-hex Git HEAD and current
TSK-027 authority path with spaces/brackets; denied
authorization, HEAD drift, indeterminate prior effects,
malformed/oversize input, unknown/duplicate flags, and
side-effect-free invocation from an empty working directory.
The existing primary CLI routes remain separate.

**Evidence summary:** new real CLI process tests `6/6 PASS`;
readiness/MCP `51/51 PASS`; bootstrap/subagent `11/11 PASS`;
total `68/68` focused checks PASS. `git diff --check` PASS,
exact two-path MT-003-B change policy PASS, source/test
delta guard PASS and runner post-execution validation PASS.

**Governance Author disposition:** `MT-003-B = ACCEPTED`
for the exact authorized read-only CLI integration and
specified focused regression boundary. MT-003-A already
accepted in section 21. The MT-003 product slices now
provide a deterministic classification helper and an
invocable native CLI surface without expanding the
single-tool governance MCP or implementing another
runner/dispatcher. This is not evidence that a consumer
has adopted a new adapter release or that the host runner
automatically calls this optional CLI before dispatch.

**Residual required separation:** complete TSK-027 has not
yet passed broad integration validation or the independently
assessed audit-trigger and closure gates. Those operations
must re-resolve their own eligible roles, evidence and
task-specific authority. No standalone Governance Audit
verdict, branch promotion, commit, remote publication,
merge, release or consumer adoption is claimed or
authorized by this record. A diagnostic `READY` generated
from supplied JSON is never proof of external Operator
authorization or a runner dispatch-ready conclusion.

## 23. Operator correction: readiness must be Claude-model-facing via local governance MCP

**Operator clarification after MT-003-B:** the original operability
problem is Claude Code's *agent flow*, not the availability of a
standalone CLI. The primary diagnostics should appear through
the tiny existing `dev-foundry-governance` local stdio MCP
that Claude already uses. The previously implemented
`readiness check --input -` CLI may remain a tested optional
technical interface but **does not satisfy MT-003's user-visible
objective by itself**. This is an explicit scope correction to
the MT-003 workflow owner, not an authorization to change
another repository, copy DEV FOUNDRY methodology, or weaken
role independence.

**Verified product baseline:** the MCP source
`src/governance-mcp/server.js` currently registers only
`resolve_governed_operation` and explanatory help resources.
Its exact DAT-001 public schema and result envelope are
covered by dedicated stdio transport tests. The accepted pure
`src/governance-mcp/readiness.js` is not called by this
server; MT-003-B instead added an optional CLI entrypoint.
No Claude-model-visible readiness call or discovery guidance
has yet been demonstrated. Previous MT-003-A and MT-003-B
narrow functional acceptances and 68 focused passing tests
remain historically valid; **full MT-003 operability = OPEN**.

**Architectural owner decision:** do **not** overload or
break DAT-001 `resolve_governed_operation` payloads.
An additional, narrowly scoped **read-only**
`assess_predelegation_readiness` tool in the SAME
project-local stdio MCP is a justified deterministic
governance capability under ADR-001 §2.2 and ARC-001 §4.2,
because the Author's actionable delegation assessment
is not a generic Git/file/shell operation. Its explicit
new project contract is `DAT-002`; no new runner, transport,
service, listener or methodology rules are created.
The MCP must internally reuse the current project resolver
and selected role/profile/source SHA references, and may
reuse the accepted pure classifier **only after checking
supplied evidence against actual resolved authority**.
It must not treat self-asserted approval or arbitrary
JSON as an authenticated governance READY.
Unobservable prior side effects or authorization remain
`INDETERMINATE`, without handoff. Any diagnostic READY
is non-authorizing and cannot dispatch an executor.

**Smallest material MCP corrective boundary, separately
bound to TSK-027 under the existing operator intent:**
- Add a read-only tool to
  `src/governance-mcp/server.js` and the minimum helper
  needed for real source-bound checks, using existing
  `resolveGovernedOperation` and `evaluateReadiness`.
- Adjust only the directly impacted
  `test/governance-mcp/server.test.js` and bounded
  new MCP readiness tests to prove actual stdio
  `tools/list` and `tools/call` behavior.
- Minimal Claude model discovery guidance (root
  `CLAUDE.md` and its managed-block template if
  strictly needed) must direct the Governance Author to
  call the tool before delegation; no duplicative
  methodology or subagent instructions.
- Preserve consumer activation/session guards for
  **both** MCP tools. Do not modify the DAT-001 response,
  `readiness.js` accepted logic, CLI, unrelated
  adapter behavior, authority or runner implementation.
  Any changed product path outside the separately
  declared contract stops for reassessment.
- Fail closed on missing/mismatched task, project,
  current authority, stale fingerprint, inactive
  role/profile, absent verified authorization, hard
  path exclusions or indeterminate prior side effects.
  No naive wrapper that accepts a model-supplied
  `READY` flag is sufficient proof.

**Functional acceptance gates:** actual stdio MCP client
must discover the new capability; realistic source-bound
positive and negative fixtures must demonstrate actionable
diagnostics, no false READY, no handoff when blocked or
indeterminate, and existing DAT-001/activation/help
compatibility. Preserve small MCP metadata and all
SPC-003 context/delegation budgets. No implementation
PASS can be called actual model behavioral acceptance
without later Claude-host observation; no synthetic
model spending solely for a benchmark.

**Authority and side-effect separation:** the Operator
has clarified the intended product placement. The
Governance Author's current operation is authoring this
correction and its own DAT-002 contract; product changes
require a fresh compatible `implementation-executor`
role/Capability Profile, exact path-scoped runner contract
and per-contract `READY`. This direction does **not**
authorize committing, promotion, publication, adoption,
consumer repository modifications, independent-audit
verdicts or modifications to Foundry Runner/DEV FOUNDRY.

## 24. MT-003-C acceptance finding A001: prevent forged READY without blocking Governance Author work

**Operator intent:** fix MT-003-C's misleading predelegation
READY; do not let a new diagnostic trap Claude in an indefinite
BLOCKED/INDETERMINATE loop or force redundant human approvals.
The previously authorized MT-003-C implementation finished
with runner PASS on request
`req_29992eafe55bfbc39493d80e331a3b27`,
execution
`execution_745f8381aa7ac1ff9c828be8921f38453900dc19a6e9db00985d32483aea3c5d`.
The bounded evidence reported new MCP tests 6/6 PASS,
existing readiness/resolver/MCP 51/51 PASS, bootstrap/CLI 17/17
PASS, 74/74 focused checks total, zero path violations and
complete post-validation evidence. The six changed product
files were
`CLAUDE.md`,
`src/governance-mcp/readiness-mcp.js`,
`src/governance-mcp/server.js`,
`templates/claude-md-block.md.tmpl`,
`test/governance-mcp/readiness-mcp.test.js`,
`test/governance-mcp/server.test.js`.
Branch and HEAD remained the TSK-027 baseline, with
19 visible changed paths and none hidden.

**Finding MT003-C-A001 (semantic, BLOCKING MT-003-C acceptance):**
the source-bound positive fixture and current
`assessPredelegationReadiness` may return `READY`
and an informational handoff merely when a model-supplied
observation object uses genuine indexed authority SHA/path
references and self-asserts its `authorization`,
`executor.available`, `contract.preflight`, Git
identity, and `priorEffects:'none'`. Exact source
hash verification proves which document was referenced;
it does **not** verify semantic Operator permission,
execution contract validity, actual host executor state,
Git state or absence/reconciliation of execution effects.
DAT-002 §6 now explicitly prohibits this false-positive.
An external runner's authoritative readiness cannot be
transformed into an MCP result from unsupported booleans.

**The equally important anti-deadlock requirement:** the
local diagnostic is **advisory**, not a new mandatory
authoring or dispatch gate. Do not reclassify ordinary
missing host facts as a fatal global BLOCKED, force
Claude to synthesize a giant evidence JSON bundle,
require repeated calls, or demand reauthorization where
current source-bound authorization already exists.
The safe result for unresolved external gate truth is
`INDETERMINATE` with **specific useful next actions**
to complete the existing authorized host/native
workflow, while continuing permissible Governance
Author reading, reconciliation and documentary work.
Only real source contradictions and invalid/stale task,
role, profile and authority identity produce BLOCKED.
Explicit unknown/inflight/unreconciled prior side
effects are INDETERMINATE and cannot authorize retries.
Neither response authorizes Implementation Executor
without the independently verified proper project gates.

**V002 exact corrective scope** under the Operator's
current express correction:
- `src/governance-mcp/readiness-mcp.js` — remove the
  self-attested READY/handoff path, make unverified
  external gates truthful and targeted, preserve
  validated authority selection/guards/DAT-001.
- `test/governance-mcp/readiness-mcp.test.js` — real
  stdio regression with matching forged positive
  flags, unknown/side effects and actionable no-loop
  next steps, plus existing stale/mismatched and
  activation/session guard coverage.
- `CLAUDE.md` and
  `templates/claude-md-block.md.tmpl` — minimal
  model-facing line clarifying advisory outcome and
  nonblocking permitted authoring behavior.
No new tools, no changed server schema, no edits to
accepted `readiness.js`, existing CLI, standard
resolver, runner, methodology, DAT-001, producer
authority, user consumers or unrelated product files.

The owner-approved data contract is DAT-002 §6; no
independent new scope, generic MCP tool, auth provider,
long-lived task, scheduler or service is implied.
The current producer `implementation-executor`
remains separately bound through runner-v3
`codex-cli` and requires a newly validated exact
TSK-027 corrective contract, source-bound resolver
READY, and targeted regression validation before
dispatch. A no-op green test is not acceptance.

**Disposition:** MT-003-C = IMPLEMENTED WITH
`MT003-C-A001` OPEN, pending actual source-corrective
and independent task-bound acceptance. Earlier
MT-003-A/MT-003-B historical scoped acceptances
remain unchanged. No publication, branch promotion,
audit verdict, model behavior benchmark or TSK-027
closure is authorized or claimed.

## 25. MT-003-C-A001 V002 acceptance — source-valid is not authorization

The process-bound runner confirms the MT-003-C-A001 V002 execution
request `req_59061c1e65b92085d13520617b5e3a26`, execution
`execution_dd4a7effb90658294af6274bf50550196f610a37a80f25b77d0c00aacd8e6736`,
contract fingerprint `sha256:80bc4e9ba792524fd616314019b35ee8b5fa40c9bafb58fe8e18c0f9ae8a9758`,
terminal `passed` with Codex and runner exit 0, no error codes,
complete handoff and post-execution validation PASS. Exactly the
four authorized paths changed incrementally:
`src/governance-mcp/readiness-mcp.js`,
`test/governance-mcp/readiness-mcp.test.js`,
`CLAUDE.md` and `templates/claude-md-block.md.tmpl`.
Path-policy violations 0; task branch and HEAD remained
`task/tsk-027-governance-operability-refactor` and
`02074d1ae7ffa258a7895c17bec0f989631398fe`;
19 visible paths, 0 hidden paths.

**Semantic functional acceptance of MT003-C-A001:** the local
stdio readiness tool now treats correctly source-bound but
unverified caller assertions about Operator authorization,
Git state, execution-contract/preflight, executor availability,
profile fit, validation availability and prior effects as
`INDETERMINATE`, with distinct stable reason codes and
specific next actions, a null handoff, `nonAuthorizing:true`
and `dispatchAllowed:false`. No fabricated external
authorization or execution READY is produced, even for a
synthetic fully positive observation with valid indexed source
paths/hashes. Missing optional observations also produce
actionable advice without mandatory repeated MCP calls.
Proven contradictions in current task/role/profile/authority
references or stale resolution fingerprint stay `BLOCKED`.
Explicit unknown/unreconciled/inflight prior effects stay
`INDETERMINATE` and suppress handoff, including when another
ordinary check would be BLOCKED. The model instructions now
state that advisory indeterminacy does not prevent separately
authorized Governance Author documentation and evidence work,
and that external implementation dispatch still needs
the actual governed host/runner authorization gates.

**Proof:** actual stdio MCP readiness transport 6/6 PASS,
original resolver/readiness/MCP 51/51 PASS, existing
bootstrap/subagent/CLI 17/17 PASS; **74/74 focused tests**.
`git diff --check` PASS, four exact source/guidance
incremental SHA delta guard PASS, runner post-execution
validation PASS, and zero path-policy violations.
Original DAT-001 resolver and consumer guards remain
covered by focused tests; no new MCP tool was registered
by this corrective. The inspected
`src/governance-mcp/readiness-mcp.js` confirms that
any source-consistent observation is now evaluated only
for actionable advisory unresolved external gates,
not granted READY or a handoff.

**Disposition:** `MT003-C-A001 = RESOLVED`,
`MT-003-C V002 = ACCEPTED` **within the verified MCP
diagnostic and focused regression scope**.
This acceptance is not a full-product validation,
independent Governance Audit, evidence of real Claude
session behavior, adapter release, project promotion
or TSK-027 closure. The current MCP deliberately has
no authenticated cross-platform attestation channel
for external gate facts, so no source-only handoff
is produced. Genuine execution authorization and side
effects remain outside this diagnostic; do not treat
its INDETERMINATE result as an additional hard gate
or trigger a repeat-call loop. Broader validation,
audit-trigger assessment and publication/closure
remain separately governed and unperformed.

## 26. Closure-gate assessment — candidate ready for governed validation, not yet for promotion

**Operator intent:** continue toward full TSK-027 closure, preserving
the separate OPS-004 validation, audit-trigger, OPS-008 side-effect,
and Operator decision boundaries. This section is a Governance
Author assessment, not a Mechanical Validator or Governance
Auditor verdict and not a claim of task completion.

**State observed on the producer runner:** repository
`dev-foundry-claude`, branch
`task/tsk-027-governance-operability-refactor`,
HEAD `02074d1ae7ffa258a7895c17bec0f989631398fe`,
19 exact previously accepted visible changed paths, no hidden
changes. The full task-level `change_set` governed validator
returned `pass` (digest
`a4b4814708cdbdfc374b18e665aa6b4101e21377c7405b92f50732090091bf58`).
The most recent implementation corrected a real false-positive
readiness issue and passed 74/74 focused executor-bound tests,
but those tests are **not** yet independently repeated by the
task-level Mechanical Validator after mutation authority closed.

**Formal broader validation preparation:** created the immutable-in-intent
standalone runner contract
`.dev-foundry/execution-contracts/TSK-027-CANDIDATE-VALIDATION-V001.json`
with `npm test`, additional syntax and task/DAT metadata
checks, and `git diff --check`, restricted to read-only
validation side effects. The runner confirmed the contract
`valid:true`. The Governance Validator role for this
task independently resolved `READY` for validation.
However `start_validation` rejected BOTH the new
candidate contract and the known prior
`.dev-foundry/execution-contracts/TSK-027.json`
with `VALIDATION_REQUEST_INVALID`, accepted:false
and no field-level diagnostics or request ID.
This is a **validation orchestration/harness failure or
missing precondition**, not proven product nonconformance.
By OPS-004 §3, classify the required broad post-implementation
mechanical validation as `VALIDATION BLOCKED`,
**never** as PASS or FAIL of product. Avoid blind
retries or a Code Executor self-check substituted
for an independent mechanical validation verdict.
The existing `validate_repository integration` check
returned an expected dirty-state FAIL against its
*clean-integration* profile (19 uncommitted paths),
not evidence of a product regression or a failed
commit/integration. This profile is premature before
authorized promotion and a clean integrated state.

**Audit-trigger determination under OPS-004 §6:** the adopted
framework requires independence **when an audit is triggered**;
the project POP presently has `audit_triggers: []`
and `promotion_rules: []`. TSK-027 §§5–7, 23–25
require evaluating applicable triggers and preserving
independence, but do not explicitly impose a fresh
independent Governance Audit on this particular
producer-adapter boundary. The Operator's instruction
to finish does not separately request a fresh audit
verdict. The selected role's authoring participation
would disqualify that same concrete implementation
from an independent auditor verdict **if** a new
trigger were found. On current explicit authority
and risk evidence, the Governance Author assesses
`independentAudit.required: false`,
`triggers: []`. This is a bounded author assessment
and shall be refreshed if the Operator or future
applicable authority supplies a material audit trigger.
No AUDIT PASS is claimed or fabricated.

**Sufficiency and limitations:** bounded product surfaces,
read-oriented local MCP and both exact DAT-001/DAT-002
contracts and 74 passing focused tests are preserved.
The source-only MCP readiness intentionally returns
actionable advisory `INDETERMINATE` for unverifiable
external executor/operator facts; it is not a new
host-side authorization gate and cannot itself certify
external execution readiness. Real Claude Code host
behavior on a packaged new adapter release is not
yet observed; no consumer pin, release or other
repository is modified or claimed to be adopted.
This deliberate scope limitation should be carried
into the closure decision rather than silently
passing a hypothetical end-to-end host test.

**Closure prerequisites still unresolved:**
1. independently governed broad mechanical validation
   of the final candidate, with true evidence and
   source/state binding;
2. after that proof, separately authorize and perform
   Git commit/publication/integration as permitted by
   the Operator and bounded transaction package;
3. reobserve clean integrated state and complete
   evidence custody/closure under the correct role.
No branch promotion, commit, push, PR, merge, release,
consumer adoption, or terminal TSK status is asserted.
**Disposition: TSK-027 remains IN_PROGRESS, with its
independent validation gate currently BLOCKED
by runner-side request acceptance.**

## 27. Read-only validation acceptance unblocked by secure contract correction

**2026-10-12 Operator-directed diagnosis:** The Operator authorized
investigating the `VALIDATION_REQUEST_INVALID` failure using the
separately process-bound PCJR Foundry Runner repository. Read-only
inspection confirmed the correct PCJR binding is `foundry-runner`,
at branch `tsk-070-operational-governance-corrective`,
HEAD `c5946e880c09bb362f47d46919cd303eb30db75f`.
No Foundry Runner code or governed task was modified.

**Verified root cause:** the standalone runner loader at
`src/validation/standalone-validation.ts`
(`loadSecureStandaloneContract`) rejects `node` commands
with `-e`/`--eval` and equivalent arbitrary code-evaluation
flags as an explicit **validation safety rule**. The initial
TSK-027 integral contract used
`node --input-type=module -e ...`; the earlier scoped contract
also contained `node -e ...`. The acceptance path in
`src/validation-requests/validation-request-service.ts`
catches this loader exception and returns only generic
`VALIDATION_REQUEST_INVALID` without field-level cause.
The generic error was therefore a pre-validation request
diagnostics failure **and correct safety-policy denial**,
not product-test failure, Codex unavailability or evidence
that a runner safety guard should be bypassed.

**Smallest sufficient correction:** updated only the runner-local
validation contract
`.dev-foundry/execution-contracts/TSK-027-CANDIDATE-VALIDATION-V001.json`,
removing the forbidden Node inline-evaluation metadata
command, while preserving `npm test`, three Node
`--check` syntax checks and exact `git diff --check`.
Validation commands remain read-only and
`sideEffectPolicy.mode:'none'`. The process-bound runner
revalidated the corrected execution contract `valid:true`
and the Mechanical Validator resolved `READY` against
the current TSK source authority.

**Accepted standalone validation request:**
`validationId:tsk027-candidate-integral-20261012-v002`,
`requestId:valreq_007209f8a253857469d842846d87e5f7`,
contract fingerprint
`sha256:231ec87fa9235b296f902ed93243907fc9d547cb702382f150570582df566e1b`.
The runner reported `accepted:true`, `duplicate:false`,
`status:queued`; actual validation verdict and evidence
are **not yet observed**. No polling or executor bypass
was used. Before the final acceptance and promotion gates,
read exactly that request's terminal status and evidence
upon an external wakeup or explicit Operator status request.

**Cross-project diagnostic follow-up (not part of TSK-027):**
the distinct Foundry Runner project should make
`start_validation` self-describing for this safe
contract restriction and align diagnostics with
`validate_execution_contract`. Existing Foundry Runner
TSK-070 explicitly excludes validation runtime, so this
observation is a separate governed follow-up, not
implicit authority to mutate the PCJR source.
**Task status stays IN_PROGRESS** pending the terminal
standalone mechanical verdict and explicit reserved
promotion and closure gates.

## 28. Integral validation V002 findings and regression realignment

**Governed Mechanical Validator evidence:** standalone request
`valreq_007209f8a253857469d842846d87e5f7`, validation
`tsk027-candidate-integral-20261012-v002`,
terminal `failed`, complete evidence and executorInvoked false.
Source: `.dev-foundry/validations/tsk027-candidate-integral-20261012-v002/result.json`.
The full suite `npm test` exited 1: **354 tests, 338 PASS, 16 FAIL**;
three Node syntax checks and `git diff --check` each PASS.
No branch/HEAD drift. Failures group around intentional,
already authorized changes to producer role binding, two-tool
MCP discovery, and managed Claude instruction refresh.
This is real post-implementation test failure, not a runner
harness failure; it prohibits a full-product PASS until
corrected and independently rerun.

**Exact observed failure clusters and necessary semantic checks:**
1. `test/adopt/managed-upgrade.test.js`: six historical
   `1.2.2/1.3.0` prepared/active cases expect only
   `.mcp.json` but actual safe upgrade plan also proposes
   `CLAUDE.md`, because the managed block template changed.
   Verify ownership-limited changed bytes and original
   consumer footer preservation. Do not hide unexpected
   application/authority mutations.
2. `test/adopt/package.test.js`: the installed `1.4.2`
   `1.2.2` upgrade case expects `--json` to succeed
   without exact prior package, whereas new template bytes
   can correctly require `--from-package` to prove
   ownership. Preserve strict hash and negative provenance
   tests, then prove explicit exact historical package
   succeeds and refreshes only approved managed paths.
3. `test/adopt/state.test.js`: one prepared-state smoke
   asserts the old single-tool MCP list. Retain consumer activation denial for **both** tools without
   collapsing their distinct result contracts. The original
   DAT-001 resolver returns `ok:false`,
   `errorCode:'BINDING_INACTIVE'`; the DAT-002 readiness
   tool returns `outcome:'BLOCKED'`,
   `reasonCodes:['ACTIVATION_INACTIVE']`, `handoff:null`,
   `nonAuthorizing:true`, `dispatchAllowed:false`. Both
   enforce the same activation guard. Do not demand
   identical wire envelopes or rename either diagnostic.
4. `test/bootstrap/claude-cutover-readiness.test.js`:
   four tests assert the reusable runner-v3 executor
   capability must be historical and unbound; TSK-027
   explicitly made it the sole active producer executor
   Capability Profile. The checks must now accept *only
   the actually active POP-bound profile* as required,
   verify old runner v1/v2 remain historical and consumer
   profiles remain unbound, and retain all rejection
   tests for missing/duplicate/extra profiles.
5. `test/bootstrap/claude-telemetry.test.js`:
   two tests assert exactly one registered MCP tool.
   The live source now intentionally has two. Preserve
   the old resolver's telemetry marker semantics,
   opt-in-only emission, and the new readiness tool's
   no-side-effect behavior; do not disable marker tests.

**Governance Author corrective disposition:** one minimal
regression-coherence slice under the existing TSK-027
material outcome. The only projected test file changes are
exactly the five paths above. Do not change production code,
source authority, immutable releases, old fixtures,
historical package bytes, consumers, actual runner,
Git state, task lifecycle or promotion. Preserve negative
authorization and stale-session tests and avoid
mass replacement or weaker assertions. If a real
product regression or unsupported package migration
appears, report BLOCKED and evidence; do not massage
tests to green. The selected executor is the active
Codex CLI runner-v3, separate from Governance Author.
Require both targeted regression tests and complete
independent suite after corrective.

**Current state:** `TSK-027 = IN_PROGRESS`,
`INTEGRAL-VALIDATION-V002 = FAIL`; no broad acceptance,
no audit verdict, no promotion. There is no demonstrated
new mandatory independent-audit trigger from this
test-only correction; reassess at full candidate acceptance.

## 29. Test-realignment executor attempted wrong runner binding — no product delta

**Observed terminal request:** `req_33e15c75474da3b35a44504533621db5`,
execution `execution_a790fa84083c58ce5d0bdcd0d4cb110460c4d5e3ffcc378fff7e3c298ad167de`.
The process-bound **Cetus-named implementation of the dev-foundry-claude
runner** confirmed `status:failed`, error `VALIDATION_FAILED`, complete
evidence and task contract fingerprint
`sha256:7333b1ad986757a6e226e1f7666c9f53cc0df24c7cec23a41fc0bb06efc282fb`.
Its own execution workspace has the correct task branch
`task/tsk-027-governance-operability-refactor`, HEAD
`02074d1ae7ffa258a7895c17bec0f989631398fe`,
19 visible already known changes, zero hidden changes,
and `changedPaths:[]` for the corrective.
Executor exit 0 reflected its successful **stop**,
not implementation. The post-execution test suite was
run against unchanged sources, so the same failures
persisted. No product mutation or closure PASS occurred.

**Operator-supplied executor text:** the Codex agent reported
`BLOCKED — runner/repository binding mismatch` after querying a
Foundry Runner reporting branch
`tsk-005-platform-agnostic-governed-operations`, HEAD
`9745638911c5bed7df73e9eb1b2cad3f32bdc27b`
and six changes, and cited a model-visible governed-operation
skill and `MEMORY.md`. This is a **different repository binding**
from the execution's actual process-bound workspace.
Those observations are not TSK-027's repository or
methodology authority and cannot negate the authenticated
host-side bound task authorization. The agent appropriately
did not edit after perceiving a mismatch, but its **wrong
source selection** was the mechanism causing a false
no-op BLOCKED. The task prompt had already prohibited
external runner and cross-repository checks, demonstrating
that prompt-only prohibition was insufficient.

**Read-only adjacent runner implementation inspection:**
the separately bound PCJR `foundry-runner` source
`src/adapters/codex-cli-adapter.ts` builds the executable
command `codex --sandbox workspace-write exec --cd
<workspacePath> --color never --ephemeral -` and supplies
`cwd:request.workspacePath`. It does **not** explicitly
isolate executor-visible global skills or MCP connectors.
This is a source-derived possible mechanism for
misrouting, not proof of the exact installation's
Codex configuration: runtime-specific executor startup
must be verified before claiming the causal fix.

**Disposition:** classify this execution attempt as
`EXECUTOR HARNESS/BINDING BLOCKED` (no code edits),
distinct from the earlier independent full-suite
`INTEGRAL-VALIDATION-V002 FAIL (16 regressions)`.
A subsequent execution with the same inherited
model tooling and no changed isolation or source-routing
control should not be blindly retried. The desired
boundary is that the **host runner** verifies repository,
role, capability and authorization; the **Implementation
Executor** reads and edits only its actual
`--cd` local checkout and fails closed on **local**
identity mismatches. It must not re-resolve a separate
project through another runner or use memory as authority.
No skill/prompt may silently suppress genuine local
identity or authorization preconditions.

**Next bounded requirements:** obtain host-bound executor
startup evidence proving how Codex skills and connectors
are supplied; select a compatible, governed, isolated
executor invocation or verified source routing rather
than misleading Codex into asserting the wrong runner.
This may require a separately governed Foundry Runner
executor-harness change, which is **outside this
dev-foundry-claude task's mutation scope**.
Do not change that foreign repository, disable security
checks or claim work completed without a separate
eligible role/capability and authorization. Once the
executor is genuinely compatible, reconcile the five
test-only V001 corrective and independently rerun
the full product suite. No commit, push, merge, release,
consumer adoption or TSK-027 closure is claimed.

## 30. Operator executor no-runner instruction — all future delegated prompts

The Operator observed that Codex CLI can discover and invoke multiple
project-bound Foundry Runner connectors, but discovery **does not**
mean permission to use them while acting as a delegated
`implementation-executor`. The prior
`TSK-027-INTEGRAL-REGRESSION-REALIGN-V001.md` already
said `Do NOT use any external connector/runner`, yet the
agent used another runner/Skill to re-resolve repository
identity and stopped before any product work. Therefore a
generic no-external-runner phrase is demonstrably insufficient.

**Mandatory literal prompt boundary for every new Codex
Implementation Executor prompt authored under TSK-027:**
place a prominently labeled no-runner policy at the very
top, before the task, baseline, references and test plan.
The policy MUST say that *all* Foundry Runner tools and
MCP runner connectors are forbidden in the executor,
including runners for the correct repository, other
repositories and indirect calls through Skills, plugins,
subagents, CLIs, dashboards or scripts. Tool visibility,
memory or a skill's suggestion/claimed requirement
is never authorization to query a runner. Explicitly
name `mcp__Foundry_Runner_*`, and forbid
`resolve_governed_operation`, `inspect_repository`
and other runner APIs even for purported preflight checks.
Do not use the local Claude Governance Author MCP as a
substitute for runner re-resolution. Only native local
shell/files/Git reads within the actual `--cd` checkout
may corroborate task branch/HEAD/path identity and inspect
task-directed authority and implementation files.
If local facts contradict the bounded contract, stop
safely **without consulting a runner**. No bypass of true
local checkout mismatch, non-authorized mutation,
platform checks, audit separation or real host
authorization is permitted. The host runner, not
the delegated Codex agent, retains these responsibilities.

**Durable corrective prompt:** the previous V001 input
is retained byte-for-byte for historical request
`req_33e15c75474da3b35a44504533621db5`.
New `.dev-foundry/prompts/TSK-027-INTEGRAL-REGRESSION-REALIGN-V002.md`
includes that literal, front-loaded prohibition and
preserves the same five-test-file implementation boundary.
The canonical TSK-027 execution contract may reference
this **new** prompt without mutating prior execution
receipts or code. Future material executor prompts should
copy this exact prohibition at their start rather than
only linking to a separate file; do not modify dozens of
closed historical prompts/evidence artifacts.

**Enforcement gap remains explicit:** a prompt instruction
is not mechanical permission control. The runner launches
Codex with its checkout `--cd`, but currently observed
launcher source does not demonstrate isolation of inherited
global MCP/Skills. Thus this text must not be reported as
proof that the agent **cannot** invoke foreign runners.
A general **future** isolation/prefix-injection policy
belongs in separately governed `foundry-runner`
execution-harness authority. It should hide/deny runner
MCP tools from the Codex executor (or explicitly ensure
a fully scoped allow/deny mechanism), and install the
same prefix in each newly generated executor prompt.
An audit-free prompt edit alone cannot establish that.
The task still requires an observed no-runner attempt and
successful focused test realignment, independent complete
validation and authorized promotion before closure.

No actual new executor attempt, commit, promotion,
cross-project edit or TSK-027 acceptance is asserted.

## 31. Readiness activation envelope corrective — V002 executor no-op

**Independent source observation** after the Operator supplied the
V002 executor stop note: request
`req_e11bd24ad1798d4f3379d349be12765f`,
execution
`execution_4d181a5b80df5fbe4db8c8785402bf699f41fb9592e9a5f80f06dd43f4e37af8`
finished `failed` because post-execution tests failed.
The Codex executor exited 0 after a self-declared
`BLOCKED`, produced **zero changes**, observed the
correct task branch/HEAD/19 pre-existing dirty paths,
and consumed substantial model tokens. The runner's
path-policy reported zero changed files and zero
violations. No implementation or acceptance took place.

**Root cause is erroneous Governance Author guidance,
not a product discrepancy.** TSK-027 section 28 and
the V001/V002 corrective prompts required the new
readiness MCP to report `BINDING_INACTIVE` in exactly
the same format as the DAT-001 resolver. But verified
`src/governance-mcp/server.js` defines two
intentionally distinct successful-denial projections
under the SAME `guardGovernedCall()`:
- `resolve_governed_operation` returns the original,
  exact DAT-001 failure envelope
  `{ok:false,errorCode:'BINDING_INACTIVE',...}`.
- `assess_predelegation_readiness` returns the
  DAT-002 diagnostic envelope `outcome:'BLOCKED'`,
  `reasonCodes:['ACTIVATION_INACTIVE']`,
  `handoff:null`, `nonAuthorizing:true`,
  `dispatchAllowed:false`, with one corrective
  `nextActions` entry. Stale sessions are also
  `BLOCKED/STALE_SESSION`. The shared guard enforces
  denial; the distinct serializers preserve DAT-001
  compatibility and DAT-002 semantics.

**Accepted correction to the implementation
requirements:** the executor must update the tests to
assert the two distinct exact result shapes and that
neither tool can proceed while consumer activation is
inactive. It MUST NOT change product runtime or weaken
the denial and stale-session invariants. This section
supersedes the contradictory same-code sentence in
section 28 and the retired prompts V001/V002. Preserve
the original versions as immutable attempt evidence.
All other five-file test-only V002 acceptance limits
remain valid.

**Token-use corrective:** divide the work into two
nonoverlapping, short bounded executor slices:
A: `test/adopt/state.test.js`,
`test/bootstrap/claude-cutover-readiness.test.js`,
`test/bootstrap/claude-telemetry.test.js`; then
B: `test/adopt/managed-upgrade.test.js` and
`test/adopt/package.test.js`. Run only each slice's
focused tests for self-verification and let the
independent Mechanical Validator rerun the complete
354-test suite after both. Every Codex prompt must
begin with the absolute **NO RUNNER TOOLS** restriction
from section 30, restrict identity checks to native
local shell/Git and avoid unnecessary process/governance
rediscovery. If the real code unexpectedly differs
from the specified source, stop and report the actual
specific code line without rewriting production code.

**Current disposition:** this executor attempt is a
`NO-OP BLOCKED`, not a product FAIL beyond the
still-open integral full-suite V002 16 failures.
`TSK-027 IN_PROGRESS`; no commit, promotion, release,
consumer adoption or closure.

## 32. Regression slice A V003 accepted — prepared-state guards and bindings

**Terminal authorized implementation request:** `req_bfb6b05bb96045cdb2250944d83b4da8`,
execution `execution_2751201149872083d27935a6daf8a2f133861b9284cb743308cd684d16950cfd`,
contract fingerprint
`sha256:be88aa2436dc307886a443bd5a1dffcebb241dea495b7cacc2b45016972c72fa`.
The runner reports `passed`, Codex exit 0, no error codes,
path-policy PASS, exactly three incremental changes
(`test/adopt/state.test.js`,
`test/bootstrap/claude-cutover-readiness.test.js`,
`test/bootstrap/claude-telemetry.test.js`)
and zero violations. Governed post-execution validation PASS
and complete evidence, with branch
`task/tsk-027-governance-operability-refactor`,
HEAD `02074d1ae7ffa258a7895c17bec0f989631398fe`,
and **22 current visible changed paths, zero hidden**.
The changed-path count rose from the accepted 19 by exactly
the three scoped test files; no previous worktree state
was discarded.

**Observed focused verification:** prepared-state
`node --test test/adopt/state.test.js` 5/5 PASS;
combined bootstrap capability/telemetry tests
25/25 PASS; `git diff --check` PASS.
This validates the intentionally distinct DAT-001
`BINDING_INACTIVE` and DAT-002
`BLOCKED/ACTIVATION_INACTIVE` deny envelopes
without modifying production, preserving the
active runner-v3 producer profile and the exact
two-tool MCP plus resolver-only telemetry.
These focused tests are executor-bound self-verification,
not a second independent full-suite PASS.
The task remains `IN_PROGRESS` pending slice B
and full Mechanical Validator proof.

**Next bounded implementation:** only two historical
upgrade tests, `test/adopt/managed-upgrade.test.js`
and `test/adopt/package.test.js`, may change in
a separate canonical TSK-027 execution package.
Preserve exact package provenance and user-owned
`CLAUDE.md` material across managed refresh,
negative integrity checks, and stable historical
fixtures; do not edit product, project authority,
distribution bundles, the runner or earlier test files.
After focused PASS, independently rerun full
`npm test` and static checks using a fresh
read-only validation request; no promotion is implied.

## 33. Regression slice B V001 accepted — historical upgrades and package integrity

**Terminal governed request:** `req_daf342c20d9adf22e98d20b93018dc3e`;
execution `execution_24cb93732c6d1056fb84a7caafd43c9cb2c054788e895db2b75e9d5be9a4d8b7`.
The process-bound runner confirmed terminal `passed`, Codex exit 0,
no failure codes, and complete final handoff/evidence. Contract fingerprint:
`sha256:6d79ddf358fbf057d5c986576a023a34d410b2c2479f223fac5f1d415b71befa`.

Exactly two incremental paths were changed, as authorized:
`test/adopt/managed-upgrade.test.js` and `test/adopt/package.test.js`.
Path policy PASS, zero violations, and post-execution focused verification PASS:
21/21 managed-upgrade tests, 24/24 package tests, and `git diff --check` PASS.
The legacy bridge tests retain exact released-source/hash verification,
user-owned `CLAUDE.md` protection, refusal of altered payloads and
application/authority path protections. This is successful focused
executor verification, **not yet independent integral Mechanical Validation**.

The execution handoff binds branch
`task/tsk-027-governance-operability-refactor` and unchanged HEAD
`02074d1ae7ffa258a7895c17bec0f989631398fe`.
The recorded post-execution Git status contained 24 changed paths. At
author reconciliation, the runner observed 25 visible changes and zero
hidden changes; the additional
`.dev-foundry/bootstrap/project-system-prompt.md` change was not
an executor Slice B mutation. It is a separate configured bootstrap
derivative change and must be included in the resulting candidate's
state and validation; it is not evidence of Slice B scope expansion.

**Author projection reconciliation:** both regression slices completed
their exact test-only boundaries without product mutations or hard-exclusion
violations. The previous independent integral FAIL (338/354 PASS) remains
historical, **not superseded by these focused checks**. The next necessary
proof is one governed, independent integral run of the resulting candidate,
reusing the existing TSK-027 candidate-validation command boundary
(`npm test`, syntax checks and `git diff --check`), without another
executor run or new product corrective absent demonstrated material failure.

**Sufficiency and convergence:** preserve applicable security, integrity,
role separation and audit triggers. The MCP readiness presentation is
non-authorizing and must not become a second permission requirement when the
host runner independently establishes eligibility. Any architectural
simplification beyond this authorized correction requires a separately
justified decision, not an indefinitely expanding TSK-027 corrective.
No commit, push, PR, merge, release, consumer adoption, independent
audit verdict or task closure is claimed by this reconciliation.

## 34. Integral validation PASS and minimum-sufficiency disposition

**Governed independent Mechanical Validation:** request
`valreq_4bce695f98673da4e18f70c0f3395b3b`,
validation `TSK-027-INTEGRAL-POST-SLICES-AB-V001`.
The runner reports terminal `passed`, `validationVerdict: pass`,
`evidenceComplete: true`, `executorInvoked: false`,
no findings or errors, and a bound evidence result at
`.dev-foundry/validations/TSK-027-INTEGRAL-POST-SLICES-AB-V001/result.json`
with SHA-256
`06310753866af0f6dc24a08eb582c0341474e8952c22ee3860e754a5375c01fc`.
The retained companion `validation-report.md` records PASS and zero findings.

The `npm test` TAP summary is **354 tests, 354 pass, 0 fail**;
independent syntax checks of
`src/governance-mcp/server.js`,
`src/governance-mcp/readiness-mcp.js`, and
`bin/dev-foundry-claude.js`, plus `git diff --check`, all exited 0.
The earlier 338/354 integral FAIL is superseded for the tested candidate.
Validation observed the expected branch
`task/tsk-027-governance-operability-refactor` and HEAD
`02074d1ae7ffa258a7895c17bec0f989631398fe`,
with **25 visible paths, zero hidden**, identical pre- and post-validation.
No further implementation or validation is necessary on the current
evidence-bound state solely to repeat this proof.

**Governance Author sufficiency assessment (not an independent audit):**
The accepted changes address configured producer bindings, truthful MCP
schema/diagnostics, non-authorizing readiness, and protected legacy
compatibility. Automated tests include a real stdio MCP protocol smoke,
negative authorization and stale-state behavior, and historical upgrade
integrity. The current evidence shows no demonstrated material defect,
mandatory missing validation, unauthorized changed path or need for a
new abstraction, corrective, tool, test cycle, or document.
The additional configured
`.dev-foundry/bootstrap/project-system-prompt.md` derivative is within
the observed candidate state and retains semantic alignment with the
active Platform Bootstrap; it is not a Slice B executor change.

**Independent-audit trigger disposition:** none observed for this
boundary under active OPS-004: the adopted framework has a triggered,
not universal, audit model; the POP lists `audit_triggers: []`;
TSK-027 requires assessment only when audit is triggered; no separate
approved risk/decision or explicit Operator audit mandate was identified.
Role separation between implementation and mechanical validation
was observed. This Author review is not represented as an AUDIT PASS.

**Bounded limit:** a complete human/Claude Code live governance session
has *not* been observed in this evidence. The stdio smoke and deterministic
acceptance tests prove the present product contract, not every future
consumer runtime experience. If actual dogfood later reveals a reproducible
operability blocker, record that evidence and govern the smallest needed
change separately. Do not make a speculative benchmark, a consumer
repository mutation, or an extra readiness permission a current gate.

**Disposition:** technical acceptance evidence is sufficient for
**promotion preparation**, not automatic acceptance of reserved lifecycle
boundaries. TSK-027 remains `IN_PROGRESS` and
`promotionRequired: true`. Commit, push, pull request, merge,
release publication, consumer adoption and terminal closure require
their respective explicit Operator authorization and state checks.

## 35. Operator-authorized final MT-002 diagnostic usability corrective (producer only)

**Observed material acceptance gap:** despite 354/354 passing mechanical tests, the Claude Code mini MCP still describes its purpose and `resolve_governed_operation` arguments too vaguely for autonomous role/profile recovery. The resolver can return bare `AUTHORITY_INVALID` for Actor Profile role/status mismatches without identifying the POP binding, profile path or expected vs. observed role/status. The model-facing readiness adapter can collapse distinct resolver errors into `AUTHORITY_UNAVAILABLE`, and one diagnostic incorrectly tells Claude to consult an external runner that the consumer Claude Code runtime does not have. The Operator explicitly authorized correcting these already-observed diagnostic issues before promotion.

**Runtime ownership:** in consumer Claude Code the small local stdio `dev-foundry-governance` MCP resolves authority and explains failure; the Claude Code main Governance Author uses its **own native repository/Git tools and permitted subagent** for external checks and execution. Foundry Runner is **only** this ChatGPT producer-maintenance integration. Never instruct a consumer Claude agent to call or await Foundry Runner or an unavailable extra MCP.

**Smallest bounded product correction:** change only `src/governance-mcp/server.js`, `src/governance-mcp/resolver.js`, `src/governance-mcp/readiness-mcp.js` and their direct regressions `test/governance-mcp/server.test.js`, `test/governance-mcp/resolver.test.js`, `test/governance-mcp/readiness-mcp.test.js`. Preserve the existing two registered tools, the accurate closed input schema, exact DAT-001 success/error envelopes, stable error codes, DAT-002 result fields, source-bound authority, existing activation/session guards, no dispatch/false READY, and no product side effects. No framework, POP, index, Capability Profile, consumer, runner, CLI, template, managed `CLAUDE.md`, release or dependency changes.

- Give the MCP server and both tool definitions concise model-facing guidance: when each tool is used, what it can/cannot verify, role ID vs Actor Profile **path** vs Capability Profile **ID/path**, distinction between task ID and routed authority, and appropriate next step. Avoid dumping methodology into tool descriptions or bloating context.
- For **demonstrable** role/profile/authority input or source inconsistencies, report the relevant field/role, exact safe configured source path when known, observed vs required value/status when safe, and one authorized recovery action. A malformed **caller argument** should be retried with the corrected argument; a contradictory **POP/source binding** must stop for governed reconciliation, never auto-edit or guess an alternative profile. Unknown failures must remain honest, fail closed and not fabricate a cause. Never expose authority bodies, secrets, or full untrusted input.
- Do not discard actionable details when `assess_predelegation_readiness` translates an underlying resolver error. Preserve DAT-002's fixed diagnostic envelope and `dispatchAllowed:false` with bounded safe `nextActions`. An external fact genuinely not observable by the mini MCP stays advisory `INDETERMINATE`; advise the owning **Claude native/host** workflow exactly once, not Runner access, repeated same-input calls, fabricated attestation, or unnecessary Operator reauthorization.
- Test real stdio `tools/list` discoverability and tool description semantics plus `tools/call` for wrong role vs profile, inconsistent Actor Profile, missing routed authority and source files, malformed fields, stale context, preserved external indeterminacy, and no second-gate deadlock instructions. Retain existing negative activation, security and compatibility proofs. Run the directly affected tests and `git diff --check`; independent integral revalidation only after an actual product delta, reusing the existing validation boundary, not more executor/test loops.

**Author-side sufficiency and stops:** this is diagnostic presentation within the previously authorized TSK-027 capability, not a new permission mechanism or public wire contract. Product implementation belongs only to the active separately bound Implementation Executor and an exact contract. If any fix needs a new return field, error code, service, attestation mechanism, altered authority, package upgrade or changed public behavior beyond diagnostic strings and descriptions, stop and report the demonstrated necessity to Governance Author. Keep the prior 354/354 PASS as historical validated baseline; it cannot claim validation of these future code changes. TSK-027 stays IN_PROGRESS; no promotion or release is authorized by this corrective.

## 36. Final diagnostic-usability corrective PASS and integral acceptance

**Operator-reported PASS independently confirmed from the process-bound Runner** for the authorized TSK-027 §35 diagnostic-usability corrective. Execution request `req_4e7f245deafb040440dd10a65d507579`, execution `execution_6f1dd75b9a3a34e2bf9aba5cd9c1051f19db4fe7f78da952173898399b74227e`, terminal `passed`, runner/Codex exit 0, zero path-policy violations and no errors. The executor changed only the six projected mini-MCP product/test files; focused Node tests **43/43 PASS** and `git diff --check` PASS. The task worktree retained **25 visible and zero hidden** changes, on `task/tsk-027-governance-operability-refactor`, HEAD `02074d1ae7ffa258a7895c17bec0f989631398fe`.

**Separate complete independent Mechanical Validation** `TSK-027-INTEGRAL-POST-DIAGNOSTIC-C001`, request `valreq_e8fb1874d7a2f0be21850affebc0ee7c`: terminal `passed`, `validationVerdict:pass`, `evidenceComplete:true`, `executorInvoked:false`, **358/358 test cases PASS, 0 FAIL, 0 SKIP**, three Node syntax checks PASS, `git diff --check` PASS, no findings, and matching branch/HEAD and pre/post state. Evidence: `.dev-foundry/validations/TSK-027-INTEGRAL-POST-DIAGNOSTIC-C001/result.json`, SHA-256 `6b67f0275843d1fbaffab302bc880fffb962aaa8a41c2fa1d7d4aa245bc78724`, companion `validation-report.md`. This replaces the earlier 354/354 full candidate PASS for the final corrected product surface; it does not invalidate earlier historical evidence.

**Author sufficiency and limitation:** the correction specifically improves local mini MCP discovery and safe actionable role/profile/authority errors, preserving DAT-001/DAT-002 envelopes, activation guards, native Claude Code workflow boundaries and non-authorizing advisory readiness. No new runner dependency, MCP tool, contract gate, consumer mutation, implementation attempt, or unnecessary test iteration is justified by the currently observed results. Automated stdio and deterministic tests cannot prove real human/Claude Code behavior; future naturally occurring consumer work may supply that observation without creating an additional current acceptance gate.

**Lifecycle:** TSK-027 remains `IN_PROGRESS`, `promotionRequired: true`. Technical candidate acceptance is PASS, but commit, push, PR, merge, publication, consumer adoption and terminal closure remain unperformed and require their own applicable authority/Operator authorization. This author evidence reconciliation alone is not a separate mechanical validation, Governance Audit or promotion approval.

## 37. Documentary closure after verified producer promotion

The Operator authorized documentary closure **before** a separately governed
adapter release. The terminal evidence and bounded disposition are recorded in
`TSK-027-CLOSURE` (routed in the active project Authority Index). This terminal
update supersedes the older *time-of-writing* statements in prior sections that
commit, PR, merge or closure were still pending; it does not alter those
historical observations or their timestamps.

Producer promotion `TSK-027-PROMOTION-20261012` completed through cleanup:
[PR #53](https://github.com/mavalenzuela22/dev-foundry-claude/pull/53) merged
25 scoped paths to `main` at
`0038ed53b126922f2774156cc623e2f5bb9c359e`. The Runner verified clean
`main`, no hidden or visible changes, and deletion of the task branch.
Independent mechanical validation `TSK-027-INTEGRAL-POST-DIAGNOSTIC-C001`
passed **358/358** tests, syntax and diff checks, with complete evidence and
zero findings. POP audit triggers remain empty; independent Governance Audit was
not required. No further product changes, validations or control mechanisms are
introduced by this documentation-only closure.

**Terminal task state: CLOSED (producer code accepted and promoted).** No
adapter release containing TSK-027 changes has been published, and no
PagoElectronico or other consumer state has been inspected or changed by this
producer closure. Release identity, public assets and consumer migration belong
to future separately authorized operations. The CLOSURE artifact and this task
metadata become durably effective upon their governed documentation-only merge.
